#!/usr/bin/env python3
"""Build route polylines from OpenStreetMap named ways (promenades, park drives)."""
from __future__ import annotations

import heapq
import json
import math
import ssl
import urllib.request
from collections import defaultdict

_ssl = ssl.create_default_context()
_ssl.check_hostname = False
_ssl.verify_mode = ssl.CERT_NONE

OVERPASS = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "RunCast/1.0 osm-path-builder"}


def _dist_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    r = 6371000
    d_lat = math.radians(b[0] - a[0])
    d_lng = math.radians(b[1] - a[1])
    s = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(a[0]))
        * math.cos(math.radians(b[0]))
        * math.sin(d_lng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(min(1.0, s)))


_segment_cache: dict[tuple, list[list[tuple[float, float]]]] = {}


def overpass(query: str, retries: int = 4) -> list[dict]:
    import time

    for attempt in range(retries):
        time.sleep(3.0 + attempt)
        req = urllib.request.Request(OVERPASS, data=query.encode(), headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=60, context=_ssl) as resp:
                data = json.loads(resp.read())
            return data.get("elements", [])
        except Exception as e:
            if attempt == retries - 1:
                raise e
    return []


def _segments_for_names(
    bbox: tuple[float, float, float, float],
    name_patterns: list[str],
    highway_filter: str = "footway|pedestrian|cycleway|primary|secondary|tertiary|unclassified|residential",
) -> list[list[tuple[float, float]]]:
    s, w, n, e = bbox
    name_clauses = "\n".join(
        f'  way["highway"~"{highway_filter}"]["name"~"{pat}",i]({s},{w},{n},{e});'
        for pat in name_patterns
    )
    query = f"[out:json][timeout:30];\n(\n{name_clauses}\n);\nout geom;"
    elements = overpass(query)
    segments: list[list[tuple[float, float]]] = []
    for el in elements:
        if el.get("type") != "way":
            continue
        geom = el.get("geometry")
        if not geom or len(geom) < 2:
            continue
        segments.append([(p["lat"], p["lon"]) for p in geom])
    return segments


def _chain_segments(
    segments: list[list[tuple[float, float]]],
    max_gap_m: float = 60,
) -> list[tuple[float, float]]:
    if not segments:
        return []
    unused = sorted(segments, key=len, reverse=True)
    path = list(unused.pop(0))
    while unused:
        tail = path[-1]
        best_idx, best_dist, best_rev = -1, float("inf"), False
        for i, seg in enumerate(unused):
            for rev, head in ((False, seg[0]), (True, seg[-1])):
                d = _dist_m(tail, head)
                if d < best_dist:
                    best_dist, best_idx, best_rev = d, i, rev
        if best_idx < 0 or best_dist > max_gap_m:
            break
        seg = unused.pop(best_idx)
        if best_rev:
            seg = list(reversed(seg))
        path.extend(seg[1:])
    return path


def _nearest_index(path: list[tuple[float, float]], point: tuple[float, float]) -> int:
    return min(range(len(path)), key=lambda i: _dist_m(path[i], point))


def _slice_path(
    path: list[tuple[float, float]],
    start: tuple[float, float],
    end: tuple[float, float],
) -> list[tuple[float, float]]:
    if not path:
        return []
    i0 = _nearest_index(path, start)
    i1 = _nearest_index(path, end)
    if i0 <= i1:
        return path[i0 : i1 + 1]
    return list(reversed(path[i1 : i0 + 1]))


def _fetch_network_segments(
    bbox: tuple[float, float, float, float],
    name_patterns: list[str] | None = None,
    trail_filter: str = "footway|path|cycleway|pedestrian|steps",
    street_filter: str = "primary|secondary|tertiary|unclassified|residential|living_street",
) -> list[list[tuple[float, float]]]:
    """
    Trail footways + (optionally) named runnable streets.
    Named streets are required for urban routes like Embarcadero / JFK Drive.
    """
    cache_key = (bbox, trail_filter, street_filter, tuple(name_patterns or ()))
    if cache_key in _segment_cache:
        return _segment_cache[cache_key]

    s, w, n, e = bbox
    clauses = [f'  way["highway"~"{trail_filter}"]({s},{w},{n},{e});']
    for pat in name_patterns or []:
        clauses.append(
            f'  way["highway"~"{street_filter}"]["name"~"{pat}",i]({s},{w},{n},{e});'
        )
    query = "[out:json][timeout:60];\n(\n" + "\n".join(clauses) + "\n);\nout geom;"
    elements = overpass(query)
    segments: list[list[tuple[float, float]]] = []
    for el in elements:
        if el.get("type") != "way":
            continue
        geom = el.get("geometry")
        if not geom or len(geom) < 2:
            continue
        segments.append([(p["lat"], p["lon"]) for p in geom])
    _segment_cache[cache_key] = segments
    return segments


def _node_key(lat: float, lng: float) -> tuple[float, float]:
    return (round(lat, 5), round(lng, 5))


def _snap_node(
    nodes: dict[tuple[float, float], tuple[float, float]],
    lat: float,
    lng: float,
    merge_m: float = 18,
) -> tuple[float, float]:
    """Snap to an existing node within merge_m — fixes OSM way gaps at intersections."""
    best_k, best_d = None, float("inf")
    for k, coord in nodes.items():
        d = _dist_m((lat, lng), coord)
        if d < best_d:
            best_d, best_k = d, k
    if best_k is not None and best_d <= merge_m:
        return best_k
    k = _node_key(lat, lng)
    nodes[k] = (lat, lng)
    return k


def _build_trail_graph(
    segments: list[list[tuple[float, float]]],
) -> tuple[dict[tuple[float, float], list[tuple[tuple[float, float], float]]], dict[tuple[float, float], tuple[float, float]]]:
    """Undirected weighted graph of trail nodes. Returns adjacency + node coords."""
    adj: dict[tuple[float, float], list[tuple[tuple[float, float], float]]] = defaultdict(list)
    nodes: dict[tuple[float, float], tuple[float, float]] = {}

    def add_edge(ka: tuple[float, float], kb: tuple[float, float]) -> None:
        if ka == kb:
            return
        w = _dist_m(nodes[ka], nodes[kb])
        if w < 1:
            return
        adj[ka].append((kb, w))
        adj[kb].append((ka, w))

    for seg in segments:
        keys = [_snap_node(nodes, lat, lng) for lat, lng in seg]
        for i in range(len(keys) - 1):
            add_edge(keys[i], keys[i + 1])

    return adj, nodes


def _nearest_node(
    nodes: dict[tuple[float, float], tuple[float, float]],
    point: tuple[float, float],
    max_m: float = 450,
) -> tuple[float, float] | None:
    best_k, best_d = None, float("inf")
    for k, coord in nodes.items():
        d = _dist_m(point, coord)
        if d < best_d:
            best_d, best_k = d, k
    return best_k if best_k is not None and best_d <= max_m else None


def _dijkstra(
    adj: dict[tuple[float, float], list[tuple[tuple[float, float], float]]],
    start: tuple[float, float],
    end: tuple[float, float],
) -> list[tuple[float, float]] | None:
    dist: dict[tuple[float, float], float] = {start: 0.0}
    prev: dict[tuple[float, float], tuple[float, float] | None] = {start: None}
    heap: list[tuple[float, tuple[float, float]]] = [(0.0, start)]

    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, float("inf")):
            continue
        if u == end:
            break
        for v, w in adj.get(u, []):
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(heap, (nd, v))

    if end not in prev:
        return None

    path_keys: list[tuple[float, float]] = []
    cur: tuple[float, float] | None = end
    while cur is not None:
        path_keys.append(cur)
        cur = prev[cur]
    path_keys.reverse()
    return path_keys


def _network_leg(
    adj: dict[tuple[float, float], list[tuple[tuple[float, float], float]]],
    nodes: dict[tuple[float, float], tuple[float, float]],
    start: tuple[float, float],
    end: tuple[float, float],
) -> list[tuple[float, float]]:
    start_k = _nearest_node(nodes, start)
    end_k = _nearest_node(nodes, end)
    if not start_k or not end_k:
        return []
    keys = _dijkstra(adj, start_k, end_k)
    if not keys:
        return []
    return [nodes[k] for k in keys]


def _interpolate_leg_tuple(
    a: tuple[float, float],
    b: tuple[float, float],
    step_m: float = 15,
) -> list[tuple[float, float]]:
    d = _dist_m(a, b)
    if d <= step_m:
        return [a, b]
    steps = max(2, int(math.ceil(d / step_m)))
    out = [a]
    for j in range(1, steps + 1):
        t = j / steps
        out.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
    return out


def _chain_all_segments(
    segments: list[list[tuple[float, float]]],
    max_gap_m: float = 30,
) -> list[list[tuple[float, float]]]:
    unused = [list(s) for s in segments if len(s) >= 2]
    chains: list[list[tuple[float, float]]] = []
    while unused:
        path = unused.pop(0)
        extended = True
        while extended:
            extended = False
            tail = path[-1]
            best_i, best_d, best_rev = -1, float("inf"), False
            for i, seg in enumerate(unused):
                for rev, head in ((False, seg[0]), (True, seg[-1])):
                    d = _dist_m(tail, head)
                    if d < best_d:
                        best_d, best_i, best_rev = d, i, rev
            if best_i >= 0 and best_d <= max_gap_m:
                seg = unused.pop(best_i)
                if best_rev:
                    seg = list(reversed(seg))
                path.extend(seg[1:])
                extended = True
        chains.append(path)
    return sorted(chains, key=len, reverse=True)


def _nearest_on_polylines(
    polylines: list[list[tuple[float, float]]],
    point: tuple[float, float],
) -> tuple[int, int, float]:
    best_pi, best_i, best_d = 0, 0, float("inf")
    for pi, pl in enumerate(polylines):
        for i, pt in enumerate(pl):
            d = _dist_m(point, pt)
            if d < best_d:
                best_pi, best_i, best_d = pi, i, d
    return best_pi, best_i, best_d


def _slice_polylines(
    polylines: list[list[tuple[float, float]]],
    start: tuple[float, float],
    end: tuple[float, float],
    max_snap_m: float = 150,
) -> list[tuple[float, float]]:
    pi0, i0, d0 = _nearest_on_polylines(polylines, start)
    pi1, i1, d1 = _nearest_on_polylines(polylines, end)
    if d0 > max_snap_m or d1 > max_snap_m or pi0 != pi1:
        return []
    pl = polylines[pi0]
    if i0 <= i1:
        return pl[i0 : i1 + 1]
    return list(reversed(pl[i1 : i0 + 1]))


def _footways_in_bbox(bbox: tuple[float, float, float, float]) -> list[list[tuple[float, float]]]:
    """Unnamed footways/paths in bbox — for coastal parks where trails lack consistent names."""
    s, w, n, e = bbox
    query = (
        f"[out:json][timeout:45];\n"
        f'way["highway"~"footway|path|steps"]["access"!~"private"]({s},{w},{n},{e});\n'
        f"out geom;"
    )
    segments: list[list[tuple[float, float]]] = []
    for el in overpass(query):
        if el.get("type") != "way":
            continue
        geom = el.get("geometry")
        if geom and len(geom) >= 2:
            segments.append([(p["lat"], p["lon"]) for p in geom])
    return segments


def _fetch_corridor_segments(
    bbox: tuple[float, float, float, float],
    name_patterns: list[str] | None,
    *,
    trail_footways: bool = False,
) -> list[list[tuple[float, float]]]:
    """Named streets + named trails; optional park footways in bbox (never city-wide street graph)."""
    if not name_patterns:
        return _fetch_network_segments(bbox, None)

    street_types = (
        "footway|path|pedestrian|cycleway|primary|secondary|tertiary|"
        "unclassified|residential|living_street"
    )
    segments = _segments_for_names(bbox, name_patterns, highway_filter=street_types)

    s, w, n, e = bbox
    trail_clauses = "\n".join(
        f'  way["highway"~"footway|path|cycleway|pedestrian|steps"]["name"~"{pat}",i]({s},{w},{n},{e});'
        for pat in name_patterns
    )
    query = f"[out:json][timeout:45];\n(\n{trail_clauses}\n);\nout geom;"
    for el in overpass(query):
        if el.get("type") != "way":
            continue
        geom = el.get("geometry")
        if geom and len(geom) >= 2:
            segments.append([(p["lat"], p["lon"]) for p in geom])

    if trail_footways:
        segments.extend(_footways_in_bbox(bbox))

    return segments


def _best_corridor_leg(
    chains: list[list[tuple[float, float]]],
    adj: dict[tuple[float, float], list[tuple[tuple[float, float], float]]],
    nodes: dict[tuple[float, float], tuple[float, float]],
    a: tuple[float, float],
    b: tuple[float, float],
) -> list[tuple[float, float]]:
    """Slice exact OSM vertices; network fallback only on corridor segments (never city-wide footways)."""
    best: list[tuple[float, float]] = []
    for chain in chains:
        leg = _slice_polylines([chain], a, b, max_snap_m=220)
        if leg and (not best or _leg_len_m(leg) < _leg_len_m(best)):
            best = leg
    if best:
        return best
    net = _network_leg(adj, nodes, a, b)
    if net:
        direct = _dist_m(a, b)
        if _leg_len_m(net) <= direct * 2.2 + 250:
            return net
    return _interpolate_leg_tuple(a, b, step_m=15)


def _leg_len_m(leg: list[tuple[float, float]]) -> float:
    return sum(_dist_m(leg[i - 1], leg[i]) for i in range(1, len(leg)))


def path_from_osm_corridor_waypoints(
    bbox: tuple[float, float, float, float],
    waypoints: list[tuple[float, float]],
    name_patterns: list[str] | None = None,
    *,
    trail_footways: bool = False,
) -> list[dict]:
    """
    Super-accurate: follow exact OSM way vertices along named trails/streets.
    Slices the merged corridor between waypoints — no OSRM / no off-trail shortcuts.
    """
    if len(waypoints) < 2:
        return []

    segments = _fetch_corridor_segments(bbox, name_patterns, trail_footways=trail_footways)
    chains = _chain_all_segments(segments, max_gap_m=90)
    adj, nodes = _build_trail_graph(segments)

    out: list[tuple[float, float]] = []
    for i in range(len(waypoints) - 1):
        a, b = waypoints[i], waypoints[i + 1]
        leg = _best_corridor_leg(chains, adj, nodes, a, b)
        if out and leg:
            if out[-1] == leg[0]:
                leg = leg[1:]
            elif _dist_m(out[-1], leg[0]) < 5:
                leg = leg[1:]
        out.extend(leg)

    return [{"lat": round(lat, 6), "lng": round(lng, 6)} for lat, lng in out]


def path_from_osm_network(
    bbox: tuple[float, float, float, float],
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    via: list[tuple[float, float]] | None = None,
    name_patterns: list[str] | None = None,
) -> list[dict]:
    """
    Route along OSM trails and/or named runnable streets (Dijkstra).
    Pass `via` (or use path_from_osm_network_waypoints) to anchor routes.
    """
    segments = _fetch_network_segments(bbox, name_patterns)
    if not segments:
        return []

    adj, nodes = _build_trail_graph(segments)
    if not adj:
        return []

    anchors = [start, *(via or []), end]
    coords: list[tuple[float, float]] = []
    for i in range(len(anchors) - 1):
        a, b = anchors[i], anchors[i + 1]
        leg = _network_leg(adj, nodes, a, b)
        if not leg:
            leg = _interpolate_leg_tuple(a, b, step_m=15)
        if coords and leg and _dist_m(coords[-1], leg[0]) < 5:
            leg = leg[1:]
        coords.extend(leg)

    return [{"lat": round(lat, 6), "lng": round(lng, 6)} for lat, lng in coords]


def path_from_osm_network_waypoints(
    bbox: tuple[float, float, float, float],
    waypoints: list[tuple[float, float]],
    name_patterns: list[str] | None = None,
) -> list[dict]:
    """Network path through each waypoint — anchors routes to real streets/trails."""
    if len(waypoints) < 2:
        return []
    return path_from_osm_network(
        bbox, waypoints[0], waypoints[-1], via=waypoints[1:-1], name_patterns=name_patterns
    )


def path_from_osm_names(
    bbox: tuple[float, float, float, float],
    name_patterns: list[str],
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    loop: bool = False,
    leg_patterns: list[list[str]] | None = None,
) -> list[dict]:
    """
    Build a lat/lng path along named OSM ways between start and end.
    For loops, pass leg_patterns = [[names leg1], [names leg2], ...] in order.
    """
    if loop and leg_patterns:
        coords: list[tuple[float, float]] = []
        for patterns in leg_patterns:
            segs = _segments_for_names(bbox, patterns)
            leg = _chain_segments(segs)
            if not leg:
                continue
            if not coords:
                coords.extend(leg)
            else:
                join = _nearest_index(leg, coords[-1])
                part = leg[join:] + leg[: join + 1]
                coords.extend(part[1:])
        if coords and _dist_m(coords[0], coords[-1]) > 30:
            coords.append(coords[0])
        return [{"lat": round(lat, 6), "lng": round(lng, 6)} for lat, lng in coords]

    segs = _segments_for_names(bbox, name_patterns)
    chained = _chain_segments(segs)
    sliced = _slice_path(chained, start, end)
    return [{"lat": round(lat, 6), "lng": round(lng, 6)} for lat, lng in sliced]


def rdp(points: list[tuple[float, float]], epsilon: float = 0.00003) -> list[tuple[float, float]]:
    """Ramer-Douglas-Peucker on (lat,lng) points. epsilon ~3m."""
    if len(points) < 3:
        return points

    def perp(p, a, b):
        dx, dy = b[1] - a[1], b[0] - a[0]
        if dx == dy == 0:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
        t = max(0, min(1, t))
        px, py = a[0] + t * dx, a[1] + t * dy
        return math.hypot(p[0] - px, p[1] - py)

    dmax, idx = 0.0, 0
    a, b = points[0], points[-1]
    for i in range(1, len(points) - 1):
        d = perp(points[i], a, b)
        if d > dmax:
            dmax, idx = d, i
    if dmax >= epsilon:
        left = rdp(points[: idx + 1], epsilon)
        right = rdp(points[idx:], epsilon)
        return left[:-1] + right
    return [a, b]
