#!/usr/bin/env python3
"""
fetch_real_coords.py
────────────────────
Fetches accurate GPS coordinates for all RunCast routes and POIs.

Route paths:  OSRM public foot-routing API (OpenStreetMap)
POI coords:   Nominatim geocoder (OpenStreetMap)

Output: scripts/routes_raw/real_coords.json

Usage:
    cd runcast
    python3 scripts/fetch_real_coords.py

Then run patch_coords.py to inject the results into the .ts files.
"""

import json, math, time, sys, ssl
from pathlib import Path
import urllib.request
import urllib.parse

# Fix macOS SSL certificate issue
ssl_ctx = ssl.create_default_context()
try:
    import certifi
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

# ── API endpoints ─────────────────────────────────────────────────────────────
OSRM_URL      = "https://router.project-osrm.org/route/v1/foot"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS       = {"User-Agent": "RunCast/1.0 route-coord-fetcher (opensource running app)"}
OUT_PATH      = Path(__file__).parent / "routes_raw" / "real_coords.json"

# ── Ramer-Douglas-Peucker simplification ─────────────────────────────────────

def _perp_dist(p, a, b):
    """Perpendicular distance from point p to line segment a–b (all [lon,lat])."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    if dx == dy == 0:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
    t = max(0, min(1, t))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)

def rdp(points: list, epsilon: float = 0.00005) -> list:
    """Simplify a polyline. epsilon ~0.00005° ≈ 5m."""
    if len(points) < 3:
        return points
    dmax, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        d = _perp_dist(points[i], points[0], points[-1])
        if d > dmax:
            dmax, idx = d, i
    if dmax >= epsilon:
        left  = rdp(points[:idx + 1], epsilon)
        right = rdp(points[idx:],     epsilon)
        return left[:-1] + right
    return [points[0], points[-1]]

# ── HTTP helpers ──────────────────────────────────────────────────────────────

def get_json(url: str, params: dict = None) -> dict | list | None:
    full = url + ("?" + urllib.parse.urlencode(params) if params else "")
    req  = urllib.request.Request(full, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20, context=ssl_ctx) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  [HTTP error] {e}  url={full[:120]}")
        return None

# ── OSRM ─────────────────────────────────────────────────────────────────────

def osrm_route(
    waypoints: list[tuple[float, float]],
    *,
    simplify_eps: float = 0.0,
) -> list[tuple[float, float]] | None:
    """
    waypoints: list of (lat, lng) turning-points.
    Returns a [lon,lat] polyline or None on failure.
    OSRM expects lon,lat order in the URL path.
    """
    coord_str = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
    url = f"{OSRM_URL}/{coord_str}"
    data = get_json(url, {"geometries": "geojson", "overview": "full", "steps": "false"})
    if not data or data.get("code") != "Ok":
        print(f"  [OSRM] bad response: {data.get('code') if data else 'None'}")
        return None
    raw = data["routes"][0]["geometry"]["coordinates"]  # list of [lon,lat]
    if simplify_eps > 0:
        return rdp(raw, epsilon=simplify_eps)
    return raw


def osrm_segmented_path(waypoints: list[tuple[float, float]]) -> list[tuple[float, float]] | None:
    """Route each leg separately — avoids OSRM collapsing long multi-stop paths into few points."""
    if len(waypoints) < 2:
        return None
    combined: list[tuple[float, float]] = []
    for i in range(len(waypoints) - 1):
        seg = osrm_route([waypoints[i], waypoints[i + 1]])
        if not seg:
            pair = [
                (waypoints[i][1], waypoints[i][0]),
                (waypoints[i + 1][1], waypoints[i + 1][0]),
            ]
            if combined and pair:
                pair = pair[1:]
            combined.extend(pair)
        else:
            if combined:
                seg = seg[1:]
            combined.extend(seg)
        time.sleep(0.2)
    return combined or None

# ── Nominatim ─────────────────────────────────────────────────────────────────

def nominatim(query: str, viewbox: tuple | None = None) -> tuple[float, float] | None:
    """Returns (lat, lng) for the best match, or None."""
    params: dict = {"q": query, "format": "json", "limit": 1}
    if viewbox:
        # viewbox: (min_lat, min_lng, max_lat, max_lng) → Nominatim wants "left,top,right,bottom"
        ml, wl, xl, el = viewbox
        params["viewbox"] = f"{wl},{xl},{el},{ml}"
        params["bounded"] = 1
    data = get_json(NOMINATIM_URL, params)
    time.sleep(1.1)   # Nominatim usage policy: ≤1 req/s
    if data and len(data) > 0:
        return float(data[0]["lat"]), float(data[0]["lon"])
    return None

# ── Route definitions ─────────────────────────────────────────────────────────
# Each route: id, waypoints [(lat,lng)], poi_queries [{"id","query","viewbox"}]
# Waypoints are the key turning-points — OSRM fills in the actual path.

SF_BOX  = (37.70, -122.55, 37.82, -122.35)
MUM_BOX = (18.85,  72.74,  19.28,  73.02)

ROUTES = [

  # ── San Francisco ─────────────────────────────────────────────────────────

  {
    "id": "sf_embarcadero_loop",
    "path_mode": "osm_network",
    "osm": {
      "bbox": (37.793, -122.425, 37.810, -122.390),
      "names": ["Embarcadero", "Jefferson", "Beach", "Hyde", "Columbus", "Broadway", "The Embarcadero"],
    },
    "waypoints": [
      (37.7953, -122.3939),  # Rincon Hill / Ferry Building
      (37.7970, -122.3948),  # Pier 7
      (37.7990, -122.3965),  # Embarcadero mid
      (37.8010, -122.3980),  # Pier 17 / Exploratorium
      (37.8030, -122.4005),  # Pier 27
      (37.8055, -122.4035),  # Bay Bridge views
      (37.8080, -122.4090),  # Pier 39 approach
      (37.8085, -122.4120),  # Pier 39
      (37.8080, -122.4178),  # Fisherman's Wharf
      (37.8070, -122.4205),  # Aquatic Park
      (37.8040, -122.4225),  # Ghirardelli / Hyde St
      (37.8010, -122.4145),  # Columbus Ave
      (37.7985, -122.4070),  # Broadway & Embarcadero
      (37.7953, -122.3939),  # loop back
    ],
    "pois": [
      {"id": "ferry_building",    "query": "Ferry Building San Francisco"},
      {"id": "bay_bridge",        "query": "Bay Bridge San Francisco"},
      {"id": "pier_39",           "query": "Pier 39 San Francisco"},
      {"id": "fishermans_wharf",  "query": "Fisherman's Wharf San Francisco"},
      {"id": "aquatic_park",      "query": "Aquatic Park San Francisco"},
      {"id": "fort_mason",        "query": "Fort Mason San Francisco"},
      {"id": "north_beach",       "query": "North Beach neighborhood San Francisco"},
    ],
  },

  {
    "id": "sf_gg_park_big_lap",
    "path_mode": "osm_network",
    "osm": {
      "bbox": (37.765, -122.515, 37.775, -122.450),
      "names": ["John F Kennedy", "Martin Luther King", "Chain of Lakes", "MLK"],
    },
    "waypoints": [
      (37.7711, -122.4531),  # Panhandle / Stanyan
      (37.7713, -122.4608),  # Conservatory of Flowers
      (37.7713, -122.4750),  # JFK mid
      (37.7713, -122.4940),  # Bison Paddock
      (37.7713, -122.5093),  # Dutch Windmill (west end JFK)
      (37.7688, -122.5093),  # MLK & Great Hwy
      (37.7683, -122.4750),  # MLK mid
      (37.7685, -122.4531),  # MLK east
      (37.7711, -122.4531),  # loop back
    ],
    "pois": [
      {"id": "gg_conservatory",  "query": "Conservatory of Flowers San Francisco"},
      {"id": "gg_bison_paddock", "query": "bison paddock Golden Gate Park San Francisco"},
      {"id": "gg_dutch_windmill","query": "Dutch Windmill Golden Gate Park San Francisco"},
      {"id": "gg_stow_lake",     "query": "Stow Lake Golden Gate Park San Francisco"},
      {"id": "gg_de_young",      "query": "de Young Museum San Francisco"},
    ],
  },

  {
    "id": "sf_ocean_beach",
    "path_mode": "direct",  # single road — dense waypoints beat OSM graph detours
    "osm": {
      "bbox": (37.728, -122.515, 37.775, -122.505),
      "names": ["Great Highway", "John Muir Drive"],
    },
    "waypoints": [
      (37.7736, -122.5107),  # Balboa / north end
      (37.7680, -122.5106),
      (37.7603, -122.5102),
      (37.7521, -122.5099),
      (37.7441, -122.5087),
      (37.7355, -122.5092),  # Sloat turnaround (~4.2 km south)
      (37.7441, -122.5087),
      (37.7521, -122.5099),
      (37.7603, -122.5102),
      (37.7680, -122.5106),
      (37.7736, -122.5107),  # return north
    ],
    "pois": [
      {"id": "ocean_beach_north",  "query": "Ocean Beach San Francisco north end"},
      {"id": "sf_zoo",             "query": "San Francisco Zoo"},
      {"id": "fort_funston",       "query": "Fort Funston San Francisco"},
      {"id": "sutro_baths_south",  "query": "Cliff House San Francisco"},
    ],
  },

  {
    "id": "sf_batteries_to_bluffs",
    "path_mode": "osm_network",  # Presidio coastal trail network — not OSRM streets
    "osm": {
      "bbox": (37.787, -122.515, 37.806, -122.440),
      "names": ["Coastal Trail", "Presidio Promenade", "Batteries to Bluffs", "Battery East"],
      "trail_footways": True,
    },
    "waypoints": [
      (37.8013, -122.4669),  # Battery East Trail
      (37.7990, -122.4726),  # Trail mid
      (37.7967, -122.4753),  # Battery Chamberlin
      (37.7950, -122.4836),  # Baker Beach north
    ],
    "pois": [
      {"id": "battery_east",      "query": "Battery East Trail Presidio San Francisco"},
      {"id": "battery_chamberlin","query": "Battery Chamberlin Baker Beach San Francisco"},
      {"id": "baker_beach",       "query": "Baker Beach San Francisco"},
      {"id": "marshall_beach",    "query": "Marshall Beach San Francisco"},
      {"id": "golden_gate_bridge","query": "Golden Gate Bridge San Francisco"},
    ],
  },

  {
    "id": "sf_crissy_to_baker",
    "path_mode": "osm_network",
    "osm": {
      "bbox": (37.792, -122.492, 37.808, -122.440),
      "names": ["Coastal Trail", "Presidio Promenade", "Crissy Field", "Mason"],
      "trail_footways": True,
    },
    "waypoints": [
      (37.8044, -122.4451),  # Crissy Field east
      (37.8043, -122.4533),  # Crissy mid
      (37.8036, -122.4617),  # East Beach
      (37.8028, -122.4667),  # Warming Hut
      (37.8005, -122.4750),  # coastal trail
      (37.7975, -122.4800),  # Baker approach
      (37.7950, -122.4836),  # Baker Beach
    ],
    "pois": [
      {"id": "crissy_field",      "query": "Crissy Field San Francisco"},
      {"id": "palace_fine_arts",  "query": "Palace of Fine Arts San Francisco"},
      {"id": "warming_hut",       "query": "Warming Hut Crissy Field San Francisco"},
      {"id": "fort_point",        "query": "Fort Point National Historic Site San Francisco"},
      {"id": "baker_beach_cf",    "query": "Baker Beach San Francisco"},
      {"id": "gg_bridge_cf",      "query": "Golden Gate Bridge"},
    ],
  },

  {
    "id": "sf_bernal_heights",
    "path_mode": "direct",  # park perimeter — OSM has no single named loop
    "osm": {
      "bbox": (37.735, -122.428, 37.745, -122.415),
      "names": ["Bernal", "Cortland", "Holly Park", "Folsom"],
    },
    "waypoints": [
      (37.7422, -122.4186),  # Cortland entrance
      (37.7410, -122.4180),
      (37.7395, -122.4178),
      (37.7380, -122.4185),
      (37.7375, -122.4200),
      (37.7378, -122.4215),
      (37.7386, -122.4228),
      (37.7398, -122.4238),
      (37.7412, -122.4235),
      (37.7422, -122.4220),
      (37.7425, -122.4200),
      (37.7422, -122.4186),
    ],
    "pois": [
      {"id": "bernal_summit",     "query": "Bernal Heights Hill summit San Francisco"},
      {"id": "bernal_park",       "query": "Bernal Heights Park San Francisco"},
      {"id": "holly_park",        "query": "Holly Park San Francisco"},
      {"id": "cortland_ave",      "query": "Cortland Avenue San Francisco"},
    ],
  },

  {
    "id": "sf_lands_end",
    "path_mode": "osm_network",
    "osm": {
      "bbox": (37.776, -122.518, 37.788, -122.493),
      "names": ["Coastal Trail", "Lands End", "El Camino del Mar", "Sutro"],
      "trail_footways": True,
    },
    "waypoints": [
      (37.7793, -122.5133),  # Sutro Baths / Lands End trailhead
      (37.7810, -122.5106),  # Coastal Trail start
      (37.7839, -122.5062),  # Eagle Point area
      (37.7852, -122.5030),  # Point Lobos view
      (37.7840, -122.5010),  # Merrie Way
      (37.7826, -122.4987),  # Legion of Honor approach
      (37.7820, -122.4960),  # Legion of Honor
    ],
    "pois": [
      {"id": "sutro_baths",       "query": "Sutro Baths San Francisco"},
      {"id": "lands_end_trail",   "query": "Lands End Trail San Francisco"},
      {"id": "mile_rock_beach",   "query": "Mile Rock Beach San Francisco"},
      {"id": "eagle_point",       "query": "Eagle Point Lands End San Francisco"},
      {"id": "legion_of_honor",   "query": "California Palace of the Legion of Honor San Francisco"},
    ],
  },

  {
    "id": "sf_glen_canyon_twin_peaks",
    "path_mode": "osm_network",
    "osm": {
      "bbox": (37.733, -122.455, 37.758, -122.434),
      "names": ["Glen Canyon", "Twin Peaks", "Portola", "Duncan", "Bosworth", "Clipper", "Twin Peaks Boulevard"],
      "trail_footways": True,
    },
    "waypoints": [
      (37.7378, -122.4443),  # Glen Canyon Park Bosworth entrance
      (37.7410, -122.4400),  # Canyon trail
      (37.7440, -122.4369),  # Upper canyon
      (37.7470, -122.4390),  # Diamond Heights Blvd
      (37.7490, -122.4430),  # Portola Dr area
      (37.7500, -122.4460),  # Twin Peaks Blvd south
      (37.7524, -122.4476),  # Twin Peaks summit south
      (37.7546, -122.4469),  # Twin Peaks summit north (Eureka)
    ],
    "pois": [
      {"id": "glen_canyon",       "query": "Glen Canyon Park San Francisco"},
      {"id": "diamond_heights",   "query": "Diamond Heights San Francisco"},
      {"id": "twin_peaks_south",  "query": "Christmas Tree Point Twin Peaks San Francisco"},
      {"id": "twin_peaks_north",  "query": "Twin Peaks north summit San Francisco"},
      {"id": "corona_heights",    "query": "Corona Heights Park San Francisco"},
    ],
  },

  # ── Mumbai ────────────────────────────────────────────────────────────────

  {
    "id": "mumbai_bandra_soul",
    "path_mode": "exact",
    "osm": {
      "bbox": (19.046, 72.814, 19.065, 72.835),
      "names": ["Carter Road", "Bandstand", "Bandra", "Reclamation"],
    },
    "waypoints": [
      (19.0484, 72.8183),   # Bandstand promenade south
      (19.0510, 72.8168),   # Bandra Fort
      (19.0530, 72.8188),   # Bandra Fort walkway
      (19.0555, 72.8239),   # Carter Road south
      (19.0579, 72.8273),   # Carter Road mid
      (19.0600, 72.8297),   # Carter Road north
      (19.0620, 72.8308),   # Land's End promenade
      (19.0632, 72.8328),   # Bandra Reclamation
    ],
    "pois": [
      {"id": "bandstand",         "query": "Bandstand Bandra Mumbai"},
      {"id": "bandra_fort",       "query": "Bandra Fort Mumbai"},
      {"id": "carter_road",       "query": "Carter Road Bandra Mumbai"},
      {"id": "mannat",            "query": "Mannat Shah Rukh Khan Bandra Mumbai"},
      {"id": "sea_link",          "query": "Bandra-Worli Sea Link Mumbai"},
      {"id": "joggers_park",      "query": "Joggers Park Bandra Mumbai"},
      {"id": "chimbai_village",   "query": "Chimbai Village Bandra Mumbai"},
    ],
  },

  {
    "id": "mumbai_coastal_promenade",
    "path_mode": "exact",
    "osm": {
      "bbox": (19.035, 72.815, 19.065, 72.842),
      "names": ["Carter Road", "Bandra", "Reclamation", "Mahim"],
    },
    "waypoints": [
      (19.0372, 72.8406),   # Mahim Bay promenade
      (19.0430, 72.8370),   # Mahim causeway area
      (19.0484, 72.8312),   # Bandra south (Reclamation)
      (19.0540, 72.8270),   # Carter Road area
      (19.0600, 72.8250),   # Bandra Bandstand
      (19.0620, 72.8183),   # Bandra Fort end
    ],
    "pois": [
      {"id": "mahim_bay",         "query": "Mahim Bay Mumbai"},
      {"id": "mahim_church",      "query": "Our Lady of Salvation Mahim Mumbai"},
      {"id": "bandra_reclamation","query": "Bandra Reclamation Mumbai"},
      {"id": "sea_link_view",     "query": "Bandra-Worli Sea Link Mumbai"},
      {"id": "land_end_bandra",   "query": "Land's End Bandra Mumbai"},
    ],
  },

  {
    "id": "mumbai_marine_drive",
    "path_mode": "osm",
    "osm": {
      "bbox": (18.924, 72.807, 18.956, 72.825),
      "names": ["Marine Drive"],
    },
    "waypoints": [
      (18.9256, 72.8235),   # Nariman Point
      (18.9285, 72.8228),
      (18.9315, 72.8222),
      (18.9345, 72.8210),
      (18.9375, 72.8195),
      (18.9405, 72.8175),
      (18.9435, 72.8155),
      (18.9465, 72.8135),
      (18.9495, 72.8115),
      (18.9525, 72.8095),
      (18.9543, 72.8083),   # Girgaum Chowpatty
    ],
    "pois": [
      {"id": "nariman_point",     "query": "Nariman Point Mumbai"},
      {"id": "marine_drive_mid",  "query": "Marine Drive Mumbai"},
      {"id": "churchgate",        "query": "Churchgate Station Mumbai"},
      {"id": "chowpatty_beach",   "query": "Girgaum Chowpatty Beach Mumbai"},
      {"id": "queens_necklace",   "query": "Queen's Necklace Mumbai Marine Drive"},
    ],
  },

  {
    "id": "mumbai_powai_lake",
    "path_mode": "exact",
    "osm": {
      "bbox": (19.116, 72.898, 19.130, 72.918),
      "names": ["Powai", "Hiranandani", "Lake"],
    },
    "waypoints": [
      (19.1188, 72.9059),   # Hiranandani Gardens main gate
      (19.1210, 72.9020),   # Lake west side
      (19.1240, 72.9010),   # Lake NW corner
      (19.1270, 72.9040),   # Lake north
      (19.1270, 72.9090),   # Lake NE corner
      (19.1250, 72.9140),   # Lake east
      (19.1210, 72.9150),   # Lake SE
      (19.1188, 72.9120),   # Lake south
      (19.1188, 72.9059),   # Back to start
    ],
    "pois": [
      {"id": "powai_lake",        "query": "Powai Lake Mumbai"},
      {"id": "hiranandani_gardens","query": "Hiranandani Gardens Powai Mumbai"},
      {"id": "iit_bombay",        "query": "IIT Bombay Powai Mumbai"},
      {"id": "powai_plaza",       "query": "Powai Plaza Mumbai"},
    ],
  },

  {
    "id": "mumbai_shivaji_park",
    "path_mode": "direct",  # park jogging track — OSRM uses surrounding streets
    "waypoints": [
      (19.0258, 72.8405),   # Main entrance Dadar
      (19.0258, 72.8378),   # West side
      (19.0232, 72.8360),   # SW corner
      (19.0208, 72.8370),   # South gate
      (19.0200, 72.8400),   # SE corner
      (19.0210, 72.8430),   # East side
      (19.0235, 72.8440),   # NE
      (19.0258, 72.8430),   # North gate
      (19.0258, 72.8405),   # Back to main entrance
    ],
    "pois": [
      {"id": "shivaji_park_main", "query": "Shivaji Park Dadar Mumbai"},
      {"id": "shivaji_statue_dp", "query": "Shivaji Park memorial Dadar Mumbai"},
      {"id": "dadar_beach",       "query": "Dadar Beach Mumbai"},
      {"id": "tilak_smarak",      "query": "Bal Gangadhar Tilak memorial Dadar Mumbai"},
    ],
  },

  {
    "id": "mumbai_worli_seaface",
    "path_mode": "osm",
    "osm": {
      "bbox": (18.98, 72.808, 19.013, 72.817),
      "names": ["Worli Promenade", "Coastal Road Promenade"],
    },
    "waypoints": [
      (19.0113, 72.8155),   # north — Sea Link end
      (19.0095, 72.8148),
      (19.0075, 72.8140),
      (19.0055, 72.8132),
      (19.0035, 72.8125),
      (19.0015, 72.8118),
      (18.9995, 72.8112),
      (18.9975, 72.8106),
      (18.9955, 72.8100),
      (18.9935, 72.8096),
      (18.9915, 72.8093),
      (18.9895, 72.8091),
      (18.9840, 72.8090),   # south — Haji Ali approach
      (18.9815, 72.8088),
    ],
    "pois": [
      {"id": "worli_sea_face",    "query": "Worli Sea Face Mumbai"},
      {"id": "sea_link_worli",    "query": "Bandra Worli Sea Link Worli end Mumbai"},
      {"id": "worli_dairy",       "query": "Worli Dairy Mumbai"},
      {"id": "haji_ali",          "query": "Haji Ali Dargah Mumbai"},
      {"id": "mahalakshmi_temple","query": "Mahalakshmi Temple Mumbai"},
    ],
  },

  {
    "id": "mumbai_priyadarshini_park",
    "path_mode": "direct",  # gated park track
    "waypoints": [
      (18.9676, 72.8036),   # Priyadarshini Park main entrance (Nepean Sea Rd)
      (18.9680, 72.8010),   # West side
      (18.9698, 72.7998),   # NW corner
      (18.9715, 72.8010),   # North side
      (18.9718, 72.8040),   # NE corner
      (18.9705, 72.8058),   # East side
      (18.9686, 72.8055),   # SE corner
      (18.9676, 72.8036),   # Back to entrance
    ],
    "pois": [
      {"id": "priyadarshini_park","query": "Priyadarshini Park Mumbai Breach Candy"},
      {"id": "breach_candy",      "query": "Breach Candy Mumbai"},
      {"id": "hanging_gardens",   "query": "Pherozeshah Mehta Gardens Hanging Gardens Mumbai"},
      {"id": "malabar_hill",      "query": "Malabar Hill Mumbai"},
    ],
  },

]

# ── Mumbai Bandra waterfront (also in mumbai_bandra_waterfront.ts) ────────────
# Already covered by mumbai_bandra_soul above, but add the Coastal Promenade
# as an extension route.

# ── Main ─────────────────────────────────────────────────────────────────────

def fetch_route(route: dict) -> dict:
    rid   = route["id"]
    wpts  = route["waypoints"]

    print(f"\n[{rid}]")
    print(f"  Fetching OSRM path ({len(wpts)} waypoints)…")

    coords = osrm_route(wpts)
    if coords:
        latlng = [{"lat": c[1], "lng": c[0]} for c in coords]
        print(f"  → {len(latlng)} points after simplification")
    else:
        # Fallback: use the raw waypoints as a coarse path
        latlng = [{"lat": lat, "lng": lng} for lat, lng in wpts]
        print(f"  → OSRM failed, using {len(latlng)} raw waypoints")

    time.sleep(0.5)  # be polite to OSRM

    poi_coords: dict[str, dict] = {}
    for poi in route.get("pois", []):
        pid   = poi["id"]
        query = poi["query"]
        vbox  = poi.get("viewbox")
        print(f"  Nominatim: {query}")
        result = nominatim(query, vbox)
        if result:
            poi_coords[pid] = {"lat": result[0], "lng": result[1]}
            print(f"    → {result[0]:.5f}, {result[1]:.5f}")
        else:
            print(f"    → not found")

    return {
        "id":        rid,
        "coords":    latlng,
        "startLocation": latlng[0] if latlng else None,
        "pois":      poi_coords,
    }


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Resume from partial output if it exists
    if OUT_PATH.exists():
        existing = json.loads(OUT_PATH.read_text())
        done_ids = {r["id"] for r in existing}
        print(f"Resuming — already have {len(done_ids)} routes: {', '.join(sorted(done_ids))}")
    else:
        existing = []
        done_ids = set()

    results = list(existing)

    for route in ROUTES:
        if route["id"] in done_ids:
            print(f"Skipping {route['id']} (already fetched)")
            continue
        result = fetch_route(route)
        results.append(result)
        # Write after every route so crashes don't lose progress
        OUT_PATH.write_text(json.dumps(results, indent=2))

    total_pts  = sum(len(r["coords"]) for r in results)
    total_pois = sum(len(r["pois"])   for r in results)
    print(f"\n✓ Done — {len(results)} routes, {total_pts} path points, {total_pois} POI coordinates")
    print(f"  Output → {OUT_PATH}")
    print(f"\nNext step: python3 scripts/patch_coords.py")


if __name__ == "__main__":
    main()
