#!/usr/bin/env python3
"""
Build super-accurate route polylines (user GPX → OSM corridor → cache),
write real_coords.json, patch .ts files, and sync distanceKm.

Drop a Strava/Komoot trace at scripts/routes_raw/gpx/{route_id}.gpx for gold standard.

Usage:
    python3 scripts/refresh_all_coords.py          # use cache / GPX
    python3 scripts/refresh_all_coords.py --force  # rebuild from OSM
"""
import json
import math
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# Import route definitions from sibling script
sys.path.insert(0, str(Path(__file__).parent))
from fetch_real_coords import ROUTES  # noqa: E402
from gpx_io import load_gpx, write_gpx  # noqa: E402
from osm_path import (  # noqa: E402
    path_from_osm_corridor_waypoints,
    path_from_osm_network_waypoints,
)

ROOT = Path(__file__).parent.parent
MANIFEST = Path(__file__).parent / "routes_raw" / "real_coords.json"
GPX_DIR = Path(__file__).parent / "routes_raw" / "gpx"
POLY_DIR = Path(__file__).parent / "routes_raw" / "polylines"
ROUTES_DIR = ROOT / "src" / "data" / "routes"

LOOP_IDS = {
    "sf_embarcadero_loop",
    "sf_gg_park_big_lap",
    "sf_ocean_beach",
    "sf_bernal_heights",  # loop in park
    "mumbai_powai_lake",
    "mumbai_shivaji_park",
    "mumbai_priyadarshini_park",
}

INTERPOLATE_STEP_M = 15
MAX_SEGMENT_M = 20  # tight — map draws straight chords between points


def dist_m(a: dict, b: dict) -> float:
    r = 6371000
    d_lat = math.radians(b["lat"] - a["lat"])
    d_lng = math.radians(b["lng"] - a["lng"])
    s = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(a["lat"]))
        * math.cos(math.radians(b["lat"]))
        * math.sin(d_lng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(min(1.0, s)))


def interpolate_waypoints(waypoints: list[tuple[float, float]], step_m: float = INTERPOLATE_STEP_M) -> list[dict]:
    """Densify straight segments between turning points (promenades / park drives)."""
    if not waypoints:
        return []
    out: list[dict] = [{"lat": waypoints[0][0], "lng": waypoints[0][1]}]
    for i in range(1, len(waypoints)):
        a, b = waypoints[i - 1], waypoints[i]
        d = dist_m({"lat": a[0], "lng": a[1]}, {"lat": b[0], "lng": b[1]})
        steps = max(1, int(d / step_m))
        for j in range(1, steps + 1):
            t = j / steps
            out.append({"lat": round(a[0] + t * (b[0] - a[0]), 6), "lng": round(a[1] + t * (b[1] - a[1]), 6)})
    return clean_coords(out)


def densify_path(coords: list[dict], max_m: float = MAX_SEGMENT_M) -> list[dict]:
    """Insert points along long chords so map lines follow the path, not shortcuts."""
    if len(coords) < 2:
        return coords
    out: list[dict] = [coords[0]]
    for i in range(1, len(coords)):
        a, b = coords[i - 1], coords[i]
        d = dist_m(a, b)
        if d <= max_m:
            out.append(b)
            continue
        steps = max(2, int(math.ceil(d / max_m)))
        for j in range(1, steps + 1):
            t = j / steps
            out.append(
                {
                    "lat": round(a["lat"] + t * (b["lat"] - a["lat"]), 6),
                    "lng": round(a["lng"] + t * (b["lng"] - a["lng"]), 6),
                }
            )
    return out


def clean_coords(coords: list[dict]) -> list[dict]:
    if not coords:
        return coords
    out = [coords[0]]
    for c in coords[1:]:
        if c["lat"] == out[-1]["lat"] and c["lng"] == out[-1]["lng"]:
            continue
        if dist_m(out[-1], c) < 5:
            continue
        if len(out) >= 2:
            a, b = out[-2], out[-1]
            v1 = (b["lat"] - a["lat"], b["lng"] - a["lng"])
            v2 = (c["lat"] - b["lat"], c["lng"] - b["lng"])
            if v1[0] * v2[0] + v1[1] * v2[1] < 0 and dist_m(a, c) < 40:
                out[-1] = c
                continue
        out.append(c)
    return out


def path_km(coords: list[dict]) -> float:
    return sum(dist_m(coords[i - 1], coords[i]) for i in range(1, len(coords))) / 1000


def fmt_coord(c: dict) -> str:
    return f"{{ lat: {c['lat']:.6f}, lng: {c['lng']:.6f} }}"


def fmt_coords_array(coords: list[dict], indent: int = 4) -> str:
    pad = " " * indent
    inner = " " * (indent + 2)
    lines = [f"{inner}{fmt_coord(c)}" for c in coords]
    return "[\n" + ",\n".join(lines) + ",\n" + pad + "]"


def patch_coordinates_block(ts: str, route_id: str, new_coords: list[dict]) -> str:
    id_pattern = re.compile(rf"id:\s*['\"]({re.escape(route_id)})['\"]")
    m = id_pattern.search(ts)
    if not m:
        return ts
    sub = ts[m.start() :]
    km = re.search(r"\bcoordinates\s*:", sub)
    if not km:
        return ts
    open_idx = m.start() + km.end() + sub[km.end() :].index("[")
    depth, close_idx = 0, open_idx
    for i, ch in enumerate(ts[open_idx:], open_idx):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                close_idx = i
                break
    new_array = fmt_coords_array(new_coords, indent=4)
    return ts[:open_idx] + new_array + ts[close_idx + 1 :]


def patch_start_location(ts: str, route_id: str, loc: dict) -> str:
    id_pattern = re.compile(rf"id:\s*['\"]({re.escape(route_id)})['\"]")
    m = id_pattern.search(ts)
    if not m:
        return ts
    sl_pattern = re.compile(r"\bstartLocation\s*:\s*\{[^}]+\}")
    sm = sl_pattern.search(ts, m.start(), m.start() + 800)
    if not sm:
        return ts
    return ts[: sm.start()] + f"startLocation: {fmt_coord(loc)}" + ts[sm.end() :]


def patch_distance_km(ts: str, route_id: str, km: float) -> str:
    id_pattern = re.compile(rf"id:\s*['\"]({re.escape(route_id)})['\"]")
    m = id_pattern.search(ts)
    if not m:
        return ts
    dk_pattern = re.compile(r"\bdistanceKm:\s*[\d.]+")
    dm = dk_pattern.search(ts, m.start(), m.start() + 600)
    if not dm:
        return ts
    return ts[: dm.start()] + f"distanceKm: {km:.1f}" + ts[dm.end() :]


def patch_loop_flag(ts: str, route_id: str, is_loop: bool) -> str:
    id_pattern = re.compile(rf"id:\s*['\"]({re.escape(route_id)})['\"]")
    m = id_pattern.search(ts)
    if not m:
        return ts
    block = ts[m.start() : m.start() + 1200]
    if is_loop:
        if re.search(r"\bloop:\s*true", block):
            return ts
        dm = re.search(r"\bdistanceKm:\s*[\d.]+", block)
        if not dm:
            return ts
        insert_at = m.start() + dm.end()
        return ts[:insert_at] + ",\n  loop: true" + ts[insert_at:]
    else:
        return re.sub(
            rf"(id:\s*['\"]{re.escape(route_id)}['\"][\s\S]{{0,800}}?)loop:\s*true,?\n\s*",
            r"\1",
            ts,
            count=1,
        )


def _bbox_for_route(route: dict) -> tuple[float, float, float, float]:
    o = route.get("osm") or {}
    if o.get("bbox"):
        return tuple(o["bbox"])
    wpts = route["waypoints"]
    lats = [w[0] for w in wpts]
    lngs = [w[1] for w in wpts]
    pad = 0.006
    return (min(lats) - pad, min(lngs) - pad, max(lats) + pad, max(lngs) + pad)


def _names_for_route(route: dict) -> list[str]:
    return list((route.get("osm") or {}).get("names") or [])


def build_path(route: dict, *, force: bool = False) -> list[dict]:
    """
    Priority: user GPX → cached polyline → OSM corridor (exact way vertices).
    Never OSRM (routes on wrong streets).
    """
    rid = route["id"]
    wpts = route["waypoints"]
    user_gpx = GPX_DIR / f"{rid}.gpx"

    if user_gpx.exists() and not force:
        print("  source: user GPX")
        return finalize_path(load_gpx(user_gpx))

    poly_path = POLY_DIR / f"{rid}.json"
    if poly_path.exists() and not force:
        print("  source: cached polyline")
        return finalize_path(json.loads(poly_path.read_text(encoding="utf-8")))

    mode = route.get("path_mode", "exact")
    bbox = _bbox_for_route(route)
    names = _names_for_route(route)

    if mode == "direct":
        print("  source: park track waypoints")
        latlng = [{"lat": round(lat, 6), "lng": round(lng, 6)} for lat, lng in wpts]
    else:
        print("  source: OSM corridor (exact trail/street geometry)")
        trail_footways = bool((route.get("osm") or {}).get("trail_footways"))
        latlng = path_from_osm_corridor_waypoints(
            bbox, wpts, names, trail_footways=trail_footways
        )
        if len(latlng) < 8:
            print("  corridor thin — augmenting with trail network legs")
            latlng = path_from_osm_network_waypoints(bbox, wpts, names)
        if len(latlng) < 8:
            print("  fallback: dense waypoint interpolation")
            latlng = interpolate_waypoints(wpts, step_m=INTERPOLATE_STEP_M)

    latlng = finalize_path(latlng)

    POLY_DIR.mkdir(parents=True, exist_ok=True)
    GPX_DIR.mkdir(parents=True, exist_ok=True)
    poly_path.write_text(json.dumps(latlng, indent=2), encoding="utf-8")
    gen_gpx = GPX_DIR / f"{rid}.generated.gpx"
    write_gpx(gen_gpx, latlng, rid)

    return latlng


def finalize_path(coords: list[dict]) -> list[dict]:
    return densify_path(clean_coords(coords))


def fetch_all() -> list[dict]:
    results = []
    for route in ROUTES:
        rid = route["id"]
        mode = route.get("path_mode", "exact")
        print(f"\n[{rid}] {mode}…", flush=True)
        force = "--force" in sys.argv
        latlng = build_path(route, force=force)
        km = path_km(latlng)
        print(f"  → {len(latlng)} pts, {km:.2f} km")
        results.append(
            {
                "id": rid,
                "coords": latlng,
                "startLocation": latlng[0],
                "pois": {},
                "path_km": round(km, 1),
                "loop": rid in LOOP_IDS,
            }
        )
        if mode not in ("direct",) and "--force" in sys.argv:
            time.sleep(0.5)
    return results


def patch_files(routes: list[dict]) -> None:
    by_id = {r["id"]: r for r in routes}
    for ts_file in sorted(ROUTES_DIR.glob("*.ts")):
        print(f"\nPatching {ts_file.name}…")
        ts = ts_file.read_text(encoding="utf-8")
        original = ts
        for rid, data in by_id.items():
            if data.get("coords"):
                ts = patch_coordinates_block(ts, rid, data["coords"])
                ts = patch_start_location(ts, rid, data["startLocation"])
                ts = patch_distance_km(ts, rid, data["path_km"])
                ts = patch_loop_flag(ts, rid, data["loop"])
        if ts != original:
            ts_file.write_text(ts, encoding="utf-8")
            print("  ✓ written")
        else:
            print("  (no changes)")


def main():
    if "--force" in sys.argv:
        print("Force rebuild — ignoring cached polylines (user GPX still wins)\n")
        from osm_path import _segment_cache  # noqa: E402

        _segment_cache.clear()
    routes = fetch_all()
    MANIFEST.write_text(json.dumps(routes, indent=2))
    print(f"\nWrote {MANIFEST}")
    patch_files(routes)
    print("\n✓ All routes refreshed")


if __name__ == "__main__":
    main()
