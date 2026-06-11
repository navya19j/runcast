"""
collect_routes.py
─────────────────
Pulls running route data from free, no-key sources and generates Explore Mode
routes — stitched, city-optimised loops that work without a user start point.

Sources:
  1. OSM Overpass API  — named foot/running paths with community tagging
  2. Reddit JSON API   — top posts mentioning routes (needs OAuth, manual fallback)
  3. Open-Meteo       — elevation batch API

Outputs:
  scripts/routes_raw/sf_candidates.json
  scripts/routes_raw/mumbai_candidates.json
  scripts/routes_raw/sf_explore.json
  scripts/routes_raw/mumbai_explore.json

Run:
  python3 scripts/collect_routes.py
"""

import json, time, math, sys, os, ssl
from urllib.request import urlopen, Request
from urllib.error import URLError
from urllib.parse import quote

# macOS ships without bundled CA certs for Python — bypass for this research script
_SSL_CTX = ssl.create_default_context()
try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX.check_hostname = False
    _SSL_CTX.verify_mode = ssl.CERT_NONE

RAW_DIR = os.path.join(os.path.dirname(__file__), "routes_raw")
os.makedirs(RAW_DIR, exist_ok=True)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def fetch(url: str, label: str, headers: dict | None = None) -> dict | list | None:
    req = Request(url, headers={"User-Agent": "RunCast/0.1 route-research (+github.com/runcast)"})
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        with urlopen(req, timeout=20, context=_SSL_CTX) as r:
            return json.loads(r.read())
    except URLError as e:
        print(f"  ✗ {label}: {e}")
        return None

def haversine_km(a: tuple, b: tuple) -> float:
    R = 6371
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    s = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(s), math.sqrt(1-s))

def path_length_km(coords: list[tuple]) -> float:
    return sum(haversine_km(coords[i], coords[i+1]) for i in range(len(coords)-1))

def sample_coords(coords: list[tuple], n: int = 20) -> list[tuple]:
    if len(coords) <= n:
        return coords
    step = (len(coords) - 1) / (n - 1)
    return [coords[round(i * step)] for i in range(n)]

# ─── OSM Overpass ─────────────────────────────────────────────────────────────

OVERPASS = "https://overpass-api.de/api/interpreter"

def overpass_query(ql: str) -> dict | None:
    url = f"{OVERPASS}?data={quote(ql)}"
    return fetch(url, "Overpass")

def fetch_osm_routes(city_name: str, bbox: tuple) -> list[dict]:
    """
    bbox = (south, west, north, east)
    Fetches:
      - named relations with route=foot or route=running
      - named ways tagged highway=footway/path/pedestrian with name= in the bbox
      - leisure=track ways (athletics tracks — filter later)
    """
    s, w, n, e = bbox
    bb = f"{s},{w},{n},{e}"

    print(f"\n[OSM] Fetching routes for {city_name}…")

    # Query 1: named running/foot route relations
    q_relations = f"""
[out:json][timeout:60];
(
  relation["route"="running"]({bb});
  relation["route"="foot"]({bb});
  relation["route"="hiking"]["name"]({bb});
);
out body;
>;
out skel qt;
"""
    # Query 2: named long footways / promenades / waterfront paths
    q_ways = f"""
[out:json][timeout:60];
(
  way["highway"~"footway|path|pedestrian"]["name"]({bb});
  way["leisure"="promenade"]["name"]({bb});
  way["tourism"="yes"]["foot"="yes"]["name"]({bb});
);
out body;
>;
out skel qt;
"""
    routes = []

    for label, query in [("relations", q_relations), ("named paths", q_ways)]:
        data = overpass_query(query)
        if not data:
            continue
        elements = data.get("elements", [])
        print(f"  → {len(elements)} elements ({label})")

        # Build node id→coords map
        nodes: dict[int, tuple] = {}
        for el in elements:
            if el["type"] == "node":
                nodes[el["id"]] = (el["lat"], el["lon"])

        # Process ways and relations
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("official_name") or tags.get("loc_name")
            if not name:
                continue

            if el["type"] == "way":
                coords = [nodes[nid] for nid in el.get("nodes", []) if nid in nodes]
                if len(coords) < 5:
                    continue
                dist_km = path_length_km(coords)
                if dist_km < 0.3:  # skip tiny segments
                    continue
                routes.append({
                    "source":      "osm_way",
                    "osm_id":      el["id"],
                    "name":        name,
                    "dist_km":     round(dist_km, 2),
                    "coordinates": sample_coords(coords, 30),
                    "tags":        tags,
                    "score":       0,  # will be enriched
                })

            elif el["type"] == "relation":
                # Collect all way coords in order
                member_ways = [m["ref"] for m in el.get("members", []) if m.get("type") == "way"]
                coords = []
                for el2 in elements:
                    if el2["type"] == "way" and el2["id"] in member_ways:
                        coords += [nodes[nid] for nid in el2.get("nodes", []) if nid in nodes]
                if len(coords) < 5:
                    continue
                dist_km = path_length_km(coords)
                routes.append({
                    "source":      "osm_relation",
                    "osm_id":      el["id"],
                    "name":        name,
                    "dist_km":     round(dist_km, 2),
                    "coordinates": sample_coords(coords, 30),
                    "tags":        tags,
                    "score":       0,
                })

    # Deduplicate by name (keep longest version)
    by_name: dict[str, dict] = {}
    for r in routes:
        key = r["name"].lower().strip()
        if key not in by_name or r["dist_km"] > by_name[key]["dist_km"]:
            by_name[key] = r

    result = sorted(by_name.values(), key=lambda r: r["dist_km"], reverse=True)
    print(f"  ✓ {len(result)} unique named routes/paths")
    return result


# ─── Reddit ───────────────────────────────────────────────────────────────────

REDDIT_SEARCH = "https://www.reddit.com/search.json?q={q}&sort=top&limit=50&t=all&type=link"
SUBREDDIT_SEARCH = "https://www.reddit.com/r/{sub}/search.json?q={q}&sort=top&limit=50&t=all&restrict_sr=1"

RUNNING_KEYWORDS = [
    "running route", "run route", "favourite run", "favorite run",
    "best run", "running path", "running trail", "morning run",
    "loop run", "where to run",
]

SF_SUBS   = ["sanfrancisco", "bayarearunners", "running", "strava"]
MUM_SUBS  = ["mumbai", "india", "running"]

# Place names used to score reddit posts by city relevance
SF_PLACES = [
    "embarcadero", "golden gate", "marin headlands", "crissy field",
    "presidio", "fisherman", "bay trail", "ocean beach", "dolores",
    "gg park", "golden gate park", "marina", "lands end",
]
MUM_PLACES = [
    "bandra", "marine drive", "worli", "carter road", "bandstand",
    "juhu", "powai", "sion", "mahalaxmi", "promenade", "sea link",
    "bkc", "gorai", "versova", "madh island",
]

def reddit_mentions(city_name: str, subreddits: list[str],
                    city_places: list[str]) -> list[dict]:
    print(f"\n[Reddit] Searching for {city_name} running routes…")
    seen_ids: set[str] = set()
    posts: list[dict] = []

    for sub in subreddits:
        for kw in RUNNING_KEYWORDS[:4]:  # limit to avoid hammering
            url = SUBREDDIT_SEARCH.format(sub=sub, q=quote(kw))
            data = fetch(url, f"r/{sub} '{kw}'")
            time.sleep(1.2)  # be polite to Reddit
            if not data:
                continue
            for post in data.get("data", {}).get("children", []):
                d = post.get("data", {})
                pid = d.get("id")
                if not pid or pid in seen_ids:
                    continue
                title = (d.get("title") or "").lower()
                selftext = (d.get("selftext") or "").lower()
                body = title + " " + selftext

                # Only keep posts that mention a city place name
                place_hits = [p for p in city_places if p in body]
                if not place_hits:
                    continue

                seen_ids.add(pid)
                posts.append({
                    "source":       "reddit",
                    "id":           pid,
                    "subreddit":    d.get("subreddit"),
                    "title":        d.get("title"),
                    "score":        d.get("score", 0),
                    "num_comments": d.get("num_comments", 0),
                    "url":          "https://reddit.com" + d.get("permalink", ""),
                    "place_hits":   place_hits,
                    "created_utc":  d.get("created_utc"),
                })

    # Deduplicate + sort by upvotes
    posts.sort(key=lambda p: p["score"], reverse=True)
    print(f"  ✓ {len(posts)} relevant posts")
    return posts


# ─── Elevation enrichment ─────────────────────────────────────────────────────

def fetch_elevation(coords: list[tuple]) -> list[float]:
    """Batch fetch elevations from Open-Meteo (same API used in the app)."""
    lats = ",".join(str(round(c[0], 5)) for c in coords)
    lngs = ",".join(str(round(c[1], 5)) for c in coords)
    url  = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lngs}"
    data = fetch(url, "Open-Meteo elevation")
    if data and "elevation" in data:
        return data["elevation"]
    return [0.0] * len(coords)

def compute_gain(elevations: list[float]) -> int:
    gain = 0.0
    for i in range(1, len(elevations)):
        diff = elevations[i] - elevations[i-1]
        if diff > 0.5:
            gain += diff
    return round(gain)

def enrich_with_elevation(routes: list[dict]) -> list[dict]:
    print("\n[Elevation] Fetching from Open-Meteo…")
    for i, r in enumerate(routes):
        coords = r.get("coordinates", [])
        if not coords:
            continue
        # Downsample to max 20 for the batch call
        sampled = sample_coords(coords, 20)
        elevs = fetch_elevation(sampled)
        gain  = compute_gain(elevs)
        r["elevation_profile"] = [round(e, 1) for e in elevs]
        r["elevation_gain_m"]  = gain
        r["elevation_max_m"]   = round(max(elevs)) if elevs else 0
        r["elevation_min_m"]   = round(min(elevs)) if elevs else 0
        sys.stdout.write(f"\r  enriched {i+1}/{len(routes)}")
        sys.stdout.flush()
        time.sleep(0.3)
    print()
    return routes


# ─── Scoring ──────────────────────────────────────────────────────────────────
# We don't have Strava data so we score OSM routes by:
#   • Are they on the waterfront / in a park? (higher = better for running)
#   • Are they a good runnable length? (1–15 km sweet spot)
#   • How many Reddit posts mention them?

def score_routes(osm_routes: list[dict], reddit_posts: list[dict],
                 city_places: list[str]) -> list[dict]:
    # Build a reddit mention map: place_name → total upvotes mentioning it
    place_reddit_score: dict[str, int] = {}
    for post in reddit_posts:
        for place in post.get("place_hits", []):
            place_reddit_score[place] = place_reddit_score.get(place, 0) + post["score"]

    for r in osm_routes:
        name_lower = r["name"].lower()
        tags = r.get("tags", {})

        # Distance score: peak at 5–10 km
        d = r["dist_km"]
        dist_score = max(0, 1 - abs(d - 7) / 10) * 30

        # Surface / running suitability
        surface = tags.get("surface", "")
        surface_score = 20 if surface in ("asphalt", "paved", "concrete") else \
                        15 if surface in ("", "compacted", "fine_gravel") else 5

        # Waterfront / park bonus
        nature_score = 0
        if any(kw in name_lower for kw in ("bay", "promenade", "waterfront",
                                            "embarcadero", "bandstand", "carter",
                                            "marine", "coastal", "beach", "shore")):
            nature_score += 25
        if any(kw in name_lower for kw in ("park", "garden", "trail", "path")):
            nature_score += 10

        # Reddit signal — any place mentioned in this route's name?
        reddit_score = 0
        for place, upvotes in place_reddit_score.items():
            if place in name_lower:
                reddit_score += min(upvotes / 50, 20)  # cap at 20pts

        # Elevation bonus for mixed routes (flat or moderate = better for running)
        gain = r.get("elevation_gain_m", 0)
        elev_score = 15 if gain < 30 else 10 if gain < 80 else 5

        r["score"] = round(dist_score + surface_score + nature_score + reddit_score + elev_score)

    return sorted(osm_routes, key=lambda r: r["score"], reverse=True)


# ─── Explore Mode ─────────────────────────────────────────────────────────────
#
# Goal: given all scored route segments for a city, produce a small set of
# "featured explore routes" — stitched loops that showcase different areas,
# require no specified start point, and are labelled with a character + highlights.
#
# Algorithm:
#   1. Cluster segments by proximity (start/end within STITCH_RADIUS_KM).
#   2. Greedily stitch clusters into a route of target length.
#   3. Score the stitched route by: diversity of segment types, landmark
#      density, surface quality, total gain (penalise extremes).
#   4. Produce 3–5 explore routes per city covering different distance buckets
#      (short 3–5 km, medium 5–8 km, long 8–15 km) and different areas.

STITCH_RADIUS_KM = 2.5   # max gap allowed between segment endpoints to stitch
                          # Mumbai promenades are 1–2km apart; needs wider radius
DISTANCE_BUCKETS = [
    ("short",  3,   5),
    ("medium", 5,   9),
    ("long",   9,  15),
]

# ─── Strava Segments ──────────────────────────────────────────────────────────

STRAVA_API = "https://www.strava.com/api/v3"

def strava_access_token() -> str | None:
    env = {}
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        for line in open(env_path):
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    access = env.get("STRAVA_ACCESS_TOKEN")
    if access:
        return access
    client_id = env.get("STRAVA_CLIENT_ID")
    client_secret = env.get("STRAVA_CLIENT_SECRET")
    refresh = env.get("STRAVA_REFRESH_TOKEN")
    if not (client_id and client_secret and refresh):
        return None
    data = f"client_id={client_id}&client_secret={client_secret}&refresh_token={refresh}&grant_type=refresh_token"
    req = Request("https://www.strava.com/oauth/token",
                  data=data.encode(), method="POST",
                  headers={"Content-Type": "application/x-www-form-urlencoded"})
    result = json.loads(urlopen(req, timeout=15, context=_SSL_CTX).read())
    return result.get("access_token")


def fetch_strava_segments(city_name: str, bbox: tuple) -> list[dict]:
    token = strava_access_token()
    if not token:
        print("  ✗ No Strava token — skipping")
        return []
    s, w, n, e = bbox
    url = f"{STRAVA_API}/segments/explore?bounds={s},{w},{n},{e}&activity_type=running"
    req = Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        data = json.loads(urlopen(req, timeout=15, context=_SSL_CTX).read())
    except Exception as ex:
        print(f"  ✗ Strava explore: {ex}")
        return []
    segments = []
    for seg in data.get("segments", []):
        dist_km = round(seg.get("distance", 0) / 1000, 2)
        if dist_km < 0.2:
            continue
        start = seg.get("start_latlng") or []
        end   = seg.get("end_latlng") or []
        coords = []
        if len(start) == 2: coords.append(tuple(start))
        if len(end) == 2:   coords.append(tuple(end))
        segments.append({
            "source":    "strava_segment",
            "strava_id": seg.get("id"),
            "name":      seg.get("name", ""),
            "dist_km":   dist_km,
            "avg_grade": seg.get("avg_grade", 0),
            "coordinates": coords,
            "tags":      {},
            "score":     0,
        })
    print(f"\n[Strava] {len(segments)} segments in {city_name}")
    for seg in segments[:8]:
        print(f"    {seg['avg_grade']:>5.1f}%  {seg['dist_km']:>5.1f}km  {seg['name']}")
    return segments


# City-specific "area" definitions for diversity scoring
CITY_AREA_KEYWORDS = {
    "San Francisco": {
        "Waterfront":   ["embarcadero", "bay trail", "fisherman", "pier", "ferry"],
        "Ocean":        ["great highway", "ocean beach", "sunset", "dunes", "pacific"],
        "Presidio":     ["presidio", "batteries", "bluffs", "crissy", "fort mason"],
        "Parks":        ["golden gate park", "park trail", "gg park", "dolores", "bernal"],
        "Trails":       ["crosstown", "philosopher", "glen canyon", "mclaren"],
    },
    "Mumbai": {
        "Bandra":       ["carter", "bandstand", "bandra", "sea link"],
        "Marine Drive": ["marine drive", "marine lines", "queens necklace", "nariman"],
        "Beaches":      ["juhu", "versova", "danda", "chowpatty", "gorai"],
        "Trails":       ["tansa", "mama bhanja", "vikhroli", "sanjay gandhi"],
        "Parks":        ["powai", "jogging track", "priyadarshini"],
    },
}

# Curated "character" descriptors for stitched explore routes
# Keyed by dominant area type
ROUTE_CHARACTERS = {
    "Waterfront": {
        "name_template": "{city} Waterfront Run",
        "tagline":       "Sea air, open skies, zero traffic.",
        "best_time":     "Early morning or golden hour.",
    },
    "Ocean": {
        "name_template": "Ocean Edge",
        "tagline":       "Pacific coast the entire way. Sand and salt.",
        "best_time":     "Sunrise or sunset — never midday.",
    },
    "Presidio": {
        "name_template": "The Bluffs Loop",
        "tagline":       "Coastal cliffs, eucalyptus groves, bridge views.",
        "best_time":     "Morning before the fog clears.",
    },
    "Parks": {
        "name_template": "Green Corridor",
        "tagline":       "Car-free, shaded, the city's lungs.",
        "best_time":     "Any time — parks are always good.",
    },
    "Trails": {
        "name_template": "Urban Trail",
        "tagline":       "Hidden city trails most residents never run.",
        "best_time":     "Weekday mornings for solitude.",
    },
    "Bandra": {
        "name_template": "Bandra Soul Loop",
        "tagline":       "Carter Road to Bandstand and back. Sea on both sides.",
        "best_time":     "5:30–7:30 AM before the heat.",
    },
    "Marine Drive": {
        "name_template": "Queen's Necklace",
        "tagline":       "Mumbai's most iconic run. Curved seafront, full city view.",
        "best_time":     "Pre-sunrise or post-sunset.",
    },
    "Beaches": {
        "name_template": "Beach Hop",
        "tagline":       "Three beaches in one go. Soft sand, zero signals.",
        "best_time":     "Low tide, early morning.",
    },
    "Trails": {
        "name_template": "Hidden Trails",
        "tagline":       "Mumbai's surprising green escapes.",
        "best_time":     "Monsoon season transforms these completely.",
    },
}

def endpoint_dist(r1: dict, r2: dict) -> float:
    """Min distance between any endpoint pair of two routes."""
    c1, c2 = r1["coordinates"], r2["coordinates"]
    endpoints = [(c1[0], c2[0]), (c1[0], c2[-1]), (c1[-1], c2[0]), (c1[-1], c2[-1])]
    return min(haversine_km(a, b) for a, b in endpoints)

def detect_area(name: str, city_name: str) -> str:
    """Return the best-matching area keyword for a route name."""
    name_lower = name.lower()
    areas = CITY_AREA_KEYWORDS.get(city_name, {})
    best, best_score = "Parks", 0
    for area, keywords in areas.items():
        hits = sum(1 for kw in keywords if kw in name_lower)
        if hits > best_score:
            best, best_score = area, hits
    return best

def stitch_segments(segments: list[dict], target_min: float,
                    target_max: float) -> list[dict] | None:
    """
    Greedy stitch: start with the highest-scored segment, keep adding the
    closest compatible segment until we hit [target_min, target_max] km.
    Returns the list of stitched segments or None if target can't be met.
    """
    if not segments:
        return None

    remaining = list(segments)
    chain = [remaining.pop(0)]
    total = chain[0]["dist_km"]

    while total < target_max and remaining:
        # Find the closest segment to the current chain endpoint
        best_idx, best_dist = -1, float("inf")
        for i, seg in enumerate(remaining):
            d = endpoint_dist(chain[-1], seg)
            if d < best_dist:
                best_dist, best_idx = d, i

        if best_idx < 0 or best_dist > STITCH_RADIUS_KM:
            break

        nxt = remaining.pop(best_idx)
        total += nxt["dist_km"]
        chain.append(nxt)

        if total >= target_min:
            break

    if total < target_min:
        return None
    return chain

def build_explore_routes(scored_routes: list[dict], city_name: str) -> list[dict]:
    """
    Build a small set of explore routes covering different distance buckets
    and different city areas.
    """
    # Filter to runnable only (< 20km, > 0.5km, not garbage names)
    EXCLUDE = ["shipwreck", "skywalk", "sky walk", "station", "mandal",
               "matunga", "koliwada", "bridge", "pipeline", "achanak"]
    runnable = [
        r for r in scored_routes
        if 0.5 < r["dist_km"] < 20
        and not any(kw in r["name"].lower() for kw in EXCLUDE)
    ]

    explore_routes: list[dict] = []
    used_names: set[str] = set()

    for bucket_label, dist_min, dist_max in DISTANCE_BUCKETS:
        # Try each area as a seed to maximise coverage
        areas_tried: set[str] = set()
        for seed in runnable:
            seed_area = detect_area(seed["name"], city_name)
            if seed_area in areas_tried:
                continue
            areas_tried.add(seed_area)

            # Pool: seed + others in same or complementary area
            pool = [seed] + [
                r for r in runnable
                if r["name"] not in used_names
                and r["name"] != seed["name"]
                and endpoint_dist(seed, r) < STITCH_RADIUS_KM * 2
            ]

            chain = stitch_segments(pool, dist_min, dist_max)
            if chain is None:
                continue

            # Compute combined stats
            total_dist = sum(s["dist_km"] for s in chain)
            total_gain = sum(s.get("elevation_gain_m", 0) for s in chain)
            all_coords  = []
            for seg in chain:
                all_coords.extend(seg.get("coordinates", []))

            # Detect dominant area across all segments
            area_counts: dict[str, int] = {}
            for seg in chain:
                a = detect_area(seg["name"], city_name)
                area_counts[a] = area_counts.get(a, 0) + 1
            dominant_area = max(area_counts, key=area_counts.get)

            char = ROUTE_CHARACTERS.get(dominant_area, ROUTE_CHARACTERS["Parks"])
            route_name = char["name_template"].replace("{city}", city_name.split()[0])

            # Avoid near-duplicate routes
            if route_name in used_names:
                route_name = f"{route_name} ({bucket_label})"

            highlights = list({detect_area(s["name"], city_name) for s in chain})

            explore_routes.append({
                "mode":           "explore",
                "name":           route_name,
                "bucket":         bucket_label,
                "dist_km":        round(total_dist, 1),
                "elevation_gain_m": round(total_gain),
                "dominant_area":  dominant_area,
                "tagline":        char["tagline"],
                "best_time":      char["best_time"],
                "segments":       [s["name"] for s in chain],
                "highlights":     highlights,
                "coordinates":    sample_coords(all_coords, 40),
                "no_start_needed": True,
                "sources":        list({s["source"] for s in chain}),
            })
            for seg in chain:
                used_names.add(seg["name"])
            used_names.add(route_name)

            break  # one route per bucket per area pass

    return explore_routes


# ─── Main ─────────────────────────────────────────────────────────────────────

CITIES = {
    "sf": {
        "name":   "San Francisco",
        "bbox":   (37.700, -122.520, 37.830, -122.350),
        "subs":   SF_SUBS,
        "places": SF_PLACES,
    },
    "mumbai": {
        "name":   "Mumbai",
        "bbox":   (18.880, 72.780, 19.280, 72.980),
        "subs":   MUM_SUBS,
        "places": MUM_PLACES,
    },
}

def run():
    for city_id, cfg in CITIES.items():
        print(f"\n{'='*56}")
        print(f"  {cfg['name']}")
        print(f"{'='*56}")

        # 1. OSM
        osm = fetch_osm_routes(cfg["name"], cfg["bbox"])

        # 2. Strava segments
        strava = fetch_strava_segments(cfg["name"], cfg["bbox"])

        # 3. Reddit (403 blocked — kept for when OAuth becomes available)
        reddit = reddit_mentions(cfg["name"], cfg["subs"], cfg["places"])

        # 4. Merge OSM + Strava, deduplicate by name
        all_routes: dict[str, dict] = {}
        for r in osm + strava:
            key = r["name"].lower().strip()
            if key not in all_routes or r["dist_km"] > all_routes[key]["dist_km"]:
                all_routes[key] = r
        merged = list(all_routes.values())
        print(f"\n  Combined: {len(merged)} unique routes (OSM + Strava)")

        # 5. Elevation (top 25 candidates)
        top_osm = merged[:25]
        top_osm = enrich_with_elevation(top_osm)

        # 6. Score
        top_osm = score_routes(top_osm, reddit, cfg["places"])

        # 5. Explore routes — stitch into city loops
        print(f"\n[Explore] Building stitched city routes…")
        explore = build_explore_routes(top_osm, cfg["name"])
        print(f"  ✓ {len(explore)} explore routes generated")
        for e in explore:
            print(f"    [{e['bucket']:>6}]  {e['dist_km']:>5.1f}km  ↑{e['elevation_gain_m']}m  {e['name']}")
            print(f"              Segments: {' → '.join(e['segments'])}")

        # 6. Save candidates
        out = {
            "city":         cfg["name"],
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "osm_routes":   top_osm,
            "reddit_posts": reddit[:30],
        }
        path = os.path.join(RAW_DIR, f"{city_id}_candidates.json")
        with open(path, "w") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)

        # 7. Save explore routes separately
        explore_out = {
            "city":         cfg["name"],
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "explore_routes": explore,
        }
        explore_path = os.path.join(RAW_DIR, f"{city_id}_explore.json")
        with open(explore_path, "w") as f:
            json.dump(explore_out, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Saved → {path}")
        print(f"✓ Saved → {explore_path}")
        print(f"\n  Top 5 candidates:")
        for r in top_osm[:5]:
            print(f"    {r['score']:>3}pt  {r['dist_km']:>5.1f}km  {r['name']}")
        print(f"  Top Reddit posts:")
        for p in reddit[:5]:
            print(f"    {p['score']:>5}↑  {p['title'][:60]}")

        time.sleep(2)  # be kind between cities

    print("\n✓ All done. Check scripts/routes_raw/ for results.")

if __name__ == "__main__":
    run()
