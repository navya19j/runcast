#!/usr/bin/env python3
"""
Build src/data/routes/expansion.ts from:
  - geometry pulled into scripts/routes_raw/gpx/<id>.gpx  (coordinates/distance/loop)
  - Open-Meteo elevation
  - hand-authored CONTENT below (name, description, metadata, POIs + scripts)

POI scripts are grounded in well-known facts where confident, experiential otherwise.
Run:  python3 scripts/build_expansion_routes.py
Then: python3 scripts/extract_audio_manifest.py && python3 scripts/generate_audio.py --route expansion --backend edge
"""
import json
import math
import re
import ssl
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
GPX = ROOT / "scripts" / "routes_raw" / "gpx"
OUT = ROOT / "src" / "data" / "routes" / "expansion.ts"
_ssl = ssl.create_default_context(); _ssl.check_hostname = False; _ssl.verify_mode = ssl.CERT_NONE


def hav(a, b):
    R = 6371000
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return 2 * R * math.asin(math.sqrt(math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2))


def read_gpx(rid):
    txt = (GPX / f"{rid}.gpx").read_text()
    return [(float(a), float(b)) for a, b in re.findall(r'lat="([\d.\-]+)" lon="([\d.\-]+)"', txt)]


def densify(pts, step=22):
    out = [pts[0]]
    for i in range(1, len(pts)):
        a, b = pts[i-1], pts[i]; d = hav(a, b); n = max(1, int(d/step))
        for j in range(1, n+1):
            t = j/n; out.append((a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])))
    return out


def downsample(pts, n):
    if len(pts) <= n: return pts
    return [pts[round(i*(len(pts)-1)/(n-1))] for i in range(n)]


def elevation_gain(pts):
    s = downsample(pts, 40)
    lats = ",".join(f"{p[0]:.6f}" for p in s); lngs = ",".join(f"{p[1]:.6f}" for p in s)
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lngs}"
    for _ in range(4):
        try:
            e = json.load(urllib.request.urlopen(url, timeout=30, context=_ssl))["elevation"]
            return round(sum(max(0, e[i]-e[i-1]) for i in range(1, len(e)) if e[i]-e[i-1] > 0.5))
        except Exception:
            time.sleep(2)
    return 0


def nearest(pts, lat, lng):
    return min(pts, key=lambda p: hav(p, (lat, lng)))


def words(s):  # for durationSec estimate (~150 wpm)
    return len(re.findall(r"\w+", s))


# ─── CONTENT (authored) ────────────────────────────────────────────────────
# clips: mode -> script. Locations snapped to nearest path point.
CONTENT = {
 "sf_angel_island": {
  "city": "San Francisco", "name": "Angel Island Perimeter",
  "desc": "A ferry ride from the city drops you onto the largest island in the Bay — a car-free 11 km perimeter road with nonstop water views and a heavy layer of history, from a Gold Rush quarantine station to the 'Ellis Island of the West'.",
  "meta": {"surface": "paved perimeter road", "shade": "partial", "gradientCharacter": "rolling, one sustained climb", "bestTime": "midday between ferries", "soloFemaleSafe": True, "headphonesSafe": True, "whoItsFor": "intermediate, advanced", "neighbourhoodVibe": "state park — joggers, hikers, day-trippers", "landmarks": ["Ayala Cove", "Immigration Station", "Camp Reynolds"]},
  "pois": [
   {"id": "ayala_cove", "name": "Ayala Cove", "lat": 37.8665, "lng": -122.4340, "clips": {
     "history": "[warm, storyteller] You land at Ayala Cove, named for Juan de Ayala — the first European to sail a ship into San Francisco Bay, in 1775. [pause] He anchored right about here and spent weeks mapping the bay while his crew recovered. For decades after, this cove was a quarantine station: ships from overseas had to stop here first, and anyone sick stayed behind. [building] You're starting your run at the Bay's original front door.",
     "sightseeing": "[energetic] Turn around for a second. That's the San Francisco skyline across the water, the Bay Bridge to your left, and Sausalito tucked into the Marin hills on your right. [pause] On the whole eleven-kilometre loop ahead, you're never out of sight of water. Pace yourself — the views get even better on the far side."}},
   {"id": "immigration_station", "name": "Immigration Station", "lat": 37.8645, "lng": -122.4205, "clips": {
     "history": "[somber, measured] This is the Angel Island Immigration Station — often called the Ellis Island of the West, but the story here is harder. [pause] From 1910 to 1940, this is where immigrants from across the Pacific were processed, and many were detained for weeks or months under the Chinese Exclusion Act. [quiet] Detainees carved poems into the wooden barrack walls — grief, anger, hope. Many are still there, preserved. Over half a million people passed through these rooms.",
     "local": "[reflective] Most people who ride the ferry never make it to this side of the island. [pause] If you have time after your run, the barracks are open — the carved poems on the walls are worth the detour. It's one of the quietest, most moving spots in the whole Bay Area, and you've got it nearly to yourself out here."}},
   {"id": "camp_reynolds", "name": "Camp Reynolds", "lat": 37.8615, "lng": -122.4435, "clips": {
     "history": "[warm] Coming up on the west side is Camp Reynolds, a Civil War-era Army garrison built in the 1860s to defend the Bay. [pause] The island stayed military for almost a century — Civil War, both World Wars, even a Nike missile site during the Cold War, aimed at incoming Soviet bombers. [amused] Today the only thing being launched is you, around the back half of this loop."}},
  ]},
 "sf_attpark_vista": {
  "city": "San Francisco", "name": "Ballpark to the Bridge",
  "desc": "A long, flat, almost entirely waterfront point-to-point from the Giants' ballpark, up the Embarcadero and through the Marina, finishing at the Golden Gate Bridge's Vista Point. The single best way to see the city's whole northern shoreline on foot.",
  "meta": {"surface": "paved promenade + sidewalk", "shade": "none", "gradientCharacter": "flat until the bridge climb", "bestTime": "morning before the wind", "soloFemaleSafe": True, "headphonesSafe": True, "whoItsFor": "advanced — it's long", "neighbourhoodVibe": "tourists, commuters, runners", "landmarks": ["Oracle Park", "Ferry Building", "Marina Green", "Golden Gate Bridge"]},
  "pois": [
   {"id": "oracle_park", "name": "Oracle Park", "lat": 37.7785, "lng": -122.3892, "clips": {
     "sightseeing": "[energetic] You're starting at Oracle Park, home of the Giants — and that body of water just beyond the right-field wall is McCovey Cove. [amused] When a lefty crushes one out, it lands in the bay, and kayakers paddle around out there waiting to fish the ball out of the water. They call them splash hits. There's a counter on the wall.",
     "local": "[warm] This stretch of waterfront didn't exist as a runner's paradise until pretty recently — it was rail yards and piers. Now the ballpark anchors the whole south Embarcadero. [conspiratorial] Local tip: on a game day, start your run early. Once first pitch nears, this promenade fills with forty thousand people in orange and black."}},
   {"id": "ferry_building", "name": "Ferry Building", "lat": 37.7955, "lng": -122.3937, "clips": {
     "food": "[warm, indulgent] The Ferry Building — that clock tower has watched over the waterfront since 1898. [pause] Inside is one of the best food markets in the country: local oysters, Cowgirl Creamery cheese, Blue Bottle coffee. [amused] On Saturdays the farmers market spills outside and the whole place smells like roasting chiles and fresh bread. Maybe a post-run reward.",
     "history": "[storyteller] Before the bridges were built, this was the second-busiest transit terminal in the world — fifty thousand commuters a day arrived by ferry right here. [pause] Then the Bay Bridge opened in 1936, the Golden Gate in '37, and the ferries nearly died overnight. The building survived, and so did the clock — still keeping time."}},
   {"id": "vista_point", "name": "Golden Gate Vista Point", "lat": 37.8320, "lng": -122.4780, "clips": {
     "sightseeing": "[triumphant] You made it — the Golden Gate Bridge, right above you. [pause] That International Orange paint was originally just a sealant primer, but the architect loved how it looked against the fog and the hills, and fought to keep it. [building] Fifteen kilometres of waterfront behind you, and the most famous bridge on earth in front. Catch your breath. You earned this one."}},
  ]},
 "sf_crissy_fort_point": {
  "city": "San Francisco", "name": "Crissy Field & Fort Point",
  "desc": "A flat waterfront loop through Crissy Field's restored marsh and out to Fort Point, the Civil War brick fortress tucked directly beneath the Golden Gate Bridge. Postcard views the entire way.",
  "meta": {"surface": "gravel promenade + paved path", "shade": "none", "gradientCharacter": "flat", "bestTime": "morning", "soloFemaleSafe": True, "headphonesSafe": True, "whoItsFor": "all levels", "neighbourhoodVibe": "windsurfers, dog walkers, families", "landmarks": ["Crissy Field", "Warming Hut", "Fort Point"]},
  "pois": [
   {"id": "crissy_marsh", "name": "Crissy Field Marsh", "lat": 37.8045, "lng": -122.4530, "clips": {
     "history": "[warm] This grassy field was a U.S. Army airfield for most of the twentieth century — biplanes and military transports took off where you're running. [pause] When the Army left in the nineties, the community pulled up the asphalt and rebuilt the tidal marsh by hand. [building] The herons and egrets you might see in the wetland to your right? They came back on their own once the water returned.",
     "sightseeing": "[energetic] Look across the water — that's the Golden Gate Bridge framed perfectly ahead, with Alcatraz sitting out in the bay behind you. [amused] On a windy afternoon this whole stretch fills with kitesurfers launching off the beach. It's one of the windiest, most beautiful spots in the city."}},
   {"id": "warming_hut", "name": "Warming Hut", "lat": 37.8065, "lng": -122.4720, "clips": {
     "food": "[warm] Just ahead is the Warming Hut — a tiny cafe near the foot of the bridge. [pause] Hot chocolate, coffee, soup, and a wall of National Park books. [amused] It's the perfect turnaround treat, and on a cold foggy morning, that's not a want, it's a need."}},
   {"id": "fort_point", "name": "Fort Point", "lat": 37.8105, "lng": -122.4770, "clips": {
     "history": "[storyteller] Fort Point sits directly under the south end of the bridge — a massive brick fortress finished in 1861 to guard the Golden Gate during the Civil War. [pause] Its cannons never fired a shot in battle. When the bridge was designed seventy years later, the engineer Joseph Strauss refused to demolish the fort — he built a special arch over it instead, just to save it. [warm] Stand underneath and look straight up. That arch exists because someone thought this old fort was worth keeping."}},
  ]},
 "sf_bridge_lands_end": {
  "city": "San Francisco", "name": "Bridge to Lands End",
  "desc": "From the Golden Gate Bridge along the wild western edge of the city to Lands End — cliffs, cypress groves, shipwreck views, and the ruins of the Sutro Baths. The most dramatic coastline in San Francisco.",
  "meta": {"surface": "trail + paved path", "shade": "partial", "gradientCharacter": "rolling with stairs", "bestTime": "clear afternoon", "soloFemaleSafe": True, "headphonesSafe": True, "whoItsFor": "intermediate", "neighbourhoodVibe": "trail runners, hikers", "landmarks": ["Golden Gate Bridge", "Baker Beach", "Sutro Baths"]},
  "pois": [
   {"id": "baker_beach", "name": "Baker Beach", "lat": 37.7935, "lng": -122.4836, "clips": {
     "sightseeing": "[energetic] Baker Beach gives you the classic shot — the Golden Gate Bridge rising over the surf, the Marin Headlands beyond. [pause] This is the postcard everyone tries to take. [amused] Fun fact: the very first Burning Man happened right here on this beach in 1986, before it moved to the desert."}},
   {"id": "lands_end_trail", "name": "Lands End", "lat": 37.7855, "lng": -122.5055, "clips": {
     "sightseeing": "[hushed, awed] This is Lands End — where the city meets the open Pacific. [pause] Look down at the water near the rocks at low tide and you can sometimes spot the ribs of old shipwrecks; this entrance to the bay has claimed dozens of vessels. [building] Cypress trees, crashing surf, and the bridge behind you. There's nowhere else in the city quite like this."}},
   {"id": "sutro_baths", "name": "Sutro Baths", "lat": 37.7800, "lng": -122.5135, "clips": {
     "history": "[storyteller] Those concrete ruins below you are the Sutro Baths. [pause] In 1896 a wealthy former mayor named Adolph Sutro built the largest indoor swimming complex in the world right here — seven saltwater pools under a glass roof, room for ten thousand people. [somber] It limped along for decades, then burned down in 1966 while being demolished. The fire left exactly what you see: a haunting concrete maze that fills with the tide."}},
  ]},
 "sf_presidio_gg_loop": {
  "city": "San Francisco", "name": "Presidio Golden Gate Loop",
  "desc": "A forested loop through the Presidio — a 1,500-acre former Army base turned national park — climbing through eucalyptus and cypress to overlooks of the Golden Gate Bridge.",
  "meta": {"surface": "trail + park road", "shade": "good", "gradientCharacter": "hilly", "bestTime": "morning", "soloFemaleSafe": True, "headphonesSafe": True, "whoItsFor": "intermediate", "neighbourhoodVibe": "trail runners, dog walkers", "landmarks": ["Main Post", "Inspiration Point", "Golden Gate Overlook"]},
  "pois": [
   {"id": "main_post", "name": "Presidio Main Post", "lat": 37.7985, "lng": -122.4575, "clips": {
     "history": "[warm, storyteller] The Presidio is one of the oldest places in the city — the Spanish founded a military fort right here in 1776, the same year as the American Revolution. [pause] It stayed an active army base under Spain, Mexico, and then the United States, all the way until 1994. [building] Over two hundred years of soldiers, and now it's a national park you get to run through. The old brick barracks around you are the originals."}},
   {"id": "presidio_forest", "name": "Presidio Forest", "lat": 37.8000, "lng": -122.4650, "clips": {
     "local": "[warm] Here's something most people don't realize — this entire forest is planted. [pause] The Presidio was bare, windswept dunes until the Army planted hundreds of thousands of eucalyptus, pine, and cypress in the late 1800s to make it feel less desolate. [amused] So you're running through a hundred-and-fifty-year-old landscaping project. It worked."}},
   {"id": "gg_overlook", "name": "Golden Gate Overlook", "lat": 37.8055, "lng": -122.4710, "clips": {
     "sightseeing": "[energetic] You've climbed for this — the Golden Gate Bridge laid out below through the cypress trees. [pause] This overlook catches the bridge at an angle you don't get from the tourist spots. [warm] Take the photo, then enjoy the downhill back toward the start."}},
  ]},
 "sf_the_presidio": {
  "city": "San Francisco", "name": "The Presidio Loop",
  "desc": "A shorter loop through the heart of the Presidio — past the Main Post, the new Tunnel Tops park built over the highway, and Andy Goldsworthy's towering wooden Spire hidden in the forest.",
  "meta": {"surface": "trail + park road", "shade": "good", "gradientCharacter": "rolling", "bestTime": "morning", "soloFemaleSafe": True, "headphonesSafe": True, "whoItsFor": "all levels", "neighbourhoodVibe": "families, runners, art-lovers", "landmarks": ["Main Post", "Tunnel Tops", "The Spire"]},
  "pois": [
   {"id": "tunnel_tops", "name": "Presidio Tunnel Tops", "lat": 37.8010, "lng": -122.4560, "clips": {
     "sightseeing": "[energetic] The green parkland you're running across is called Tunnel Tops — and the name is literal. [pause] It's built on the roof of the highway tunnels below, opened in 2022, turning what was a roaring freeway into rolling lawns with full bridge-and-bay views. [amused] You'd never know there are cars rushing beneath your feet."}},
   {"id": "the_spire", "name": "The Spire", "lat": 37.7965, "lng": -122.4630, "clips": {
     "local": "[hushed] Tucked in the forest near here stands The Spire — a ninety-foot tower built by the artist Andy Goldsworthy from the trunks of cypress trees cleared during the forest's renewal. [pause] As the young trees planted around it grow, they'll slowly swallow the sculpture until it disappears into the canopy. [warm] It's art designed to vanish. Worth a short detour to find it among the trees."}},
   {"id": "main_post_2", "name": "Main Post", "lat": 37.7985, "lng": -122.4575, "clips": {
     "history": "[warm] You're passing the Main Post, the historic core of a military base that ran for over two centuries — Spanish, Mexican, then American, right up to 1994. [pause] The parade ground and brick barracks are all original. It's a national park now, but the bones of an old army town are everywhere you look."}},
  ]},
 "sf_candlestick_mclaren": {
  "city": "San Francisco", "name": "Candlestick to McLaren",
  "desc": "An off-the-tourist-map run from the windy shoreline at Candlestick Point up into McLaren Park — the city's wild, underrated second-largest park. A real local's route in the city's southeast.",
  "meta": {"surface": "bay trail + park path", "shade": "partial", "gradientCharacter": "flat then a climb into the park", "bestTime": "afternoon", "soloFemaleSafe": True, "headphonesSafe": True, "whoItsFor": "intermediate", "neighbourhoodVibe": "local — few tourists", "landmarks": ["Candlestick Point", "McLaren Park"]},
  "pois": [
   {"id": "candlestick", "name": "Candlestick Point", "lat": 37.7150, "lng": -122.3870, "clips": {
     "history": "[warm, storyteller] This windswept point is where Candlestick Park stood — the stadium where the Giants and the 49ers played for decades. [pause] It was famous for being brutally cold and windy; players called night games here miserable. The Beatles played their very last concert here in 1966. [pause] The stadium came down in 2015. Now it's open shoreline again, and the wind hasn't changed a bit.",
     "local": "[conspiratorial] Almost no tourist ever comes down here, and that's exactly the appeal. [pause] This is the southeast corner of the city — bay breeze, open space, and locals who have the trail to themselves. You're running the real San Francisco that doesn't make the postcards."}},
   {"id": "mclaren_park", "name": "McLaren Park", "lat": 37.7165, "lng": -122.3905, "clips": {
     "local": "[warm] Climbing into McLaren Park now — at over three hundred acres it's the second-largest park in the city, after Golden Gate Park. [amused] But where Golden Gate Park is always packed, this one stays gloriously empty. [pause] It's named for John McLaren, the gardener who ran Golden Gate Park for over fifty years and planted much of the city's greenery. Locals guard this place as their secret."}},
  ]},
 "mumbai_palm_beach_navi": {
  "city": "Mumbai", "name": "Palm Beach Road",
  "desc": "Navi Mumbai's grand palm-lined arterial — a wide, smooth, green-medianed road running alongside creek wetlands. Locals call it the Marine Drive of Navi Mumbai, and in winter the nearby wetlands fill with flamingos.",
  "meta": {"surface": "wide smooth road + sidewalk", "shade": "partial", "gradientCharacter": "flat", "bestTime": "early morning", "monsoonSafe": False, "soloFemaleSafe": True, "headphonesSafe": True, "whoItsFor": "all levels", "neighbourhoodVibe": "Navi Mumbai's premium stretch", "landmarks": ["Palm Beach Road", "creek wetlands"]},
  "pois": [
   {"id": "palm_beach_start", "name": "Palm Beach Road", "lat": 19.0476, "lng": 73.0084, "clips": {
     "local": "[warm] Welcome to Palm Beach Road — Navi Mumbai's showpiece. [pause] Wide lanes, a planted green median, rows of palms, and none of the chaos of the island city across the creek. [amused] People here proudly call it the Marine Drive of Navi Mumbai. It's flat, smooth, and built for exactly what you're doing right now.",
     "sightseeing": "[energetic] To one side you've got gleaming new high-rises; to the other, open creek and wetland stretching toward the hills. [pause] In the winter months, those wetlands nearby fill with flamingos — thousands of them, turning the mudflats pink. Keep an eye out as you run."}},
   {"id": "palm_beach_creek", "name": "Creek Wetlands", "lat": 19.0320, "lng": 73.0089, "clips": {
     "local": "[warm] This whole side opens onto the creek — one of the reasons the air feels different out here than in the dense city. [pause] Early morning is the magic hour: cool breeze off the water, the road nearly empty, and serious runners and cyclists owning the lanes before the traffic wakes up."}},
  ]},
 "mumbai_rajiv_gandhi_joggers": {
  "city": "Mumbai", "name": "Rajiv Gandhi Joggers Park",
  "desc": "A compact, well-loved jogging park in Navi Mumbai — a soft-surface perimeter loop, gardens, and a dependable morning crowd. Short laps, big community.",
  "meta": {"surface": "jogging track", "shade": "good", "gradientCharacter": "flat", "bestTime": "early morning", "monsoonSafe": False, "soloFemaleSafe": True, "headphonesSafe": True, "whoItsFor": "all levels", "neighbourhoodVibe": "neighbourhood regulars", "landmarks": ["Rajiv Gandhi Joggers Park"]},
  "pois": [
   {"id": "rg_park_gate", "name": "Joggers Park", "lat": 19.0834, "lng": 72.9953, "clips": {
     "local": "[warm] This is the kind of park every Mumbai neighbourhood relies on — a dedicated jogging loop with a soft track that's kind to the knees. [pause] Come at dawn and you'll find the same faces every day: uncles on their morning rounds, walking groups, a yoga circle in the corner. [amused] Do a few laps and you're basically a regular."}},
  ]},
}


LOOP_THRESH_M = 150
OAB_IDS = {"sf_bridge_lands_end", "sf_attpark_vista", "sf_candlestick_mclaren", "mumbai_palm_beach_navi"}


def fmt_coord(p):
    return f"{{ lat: {p[0]:.6f}, lng: {p[1]:.6f} }}"


def ts_string(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def build_route(rid, c):
    raw = read_gpx(rid)
    pts = densify(raw)
    if len(pts) > 700:
        pts = downsample(pts, 700)
    dist_km = round(sum(hav(pts[i-1], pts[i]) for i in range(1, len(pts))) / 1000, 1)
    is_loop = hav(pts[0], pts[-1]) < LOOP_THRESH_M and rid not in OAB_IDS
    gain = elevation_gain(pts)
    start = pts[0]

    # POIs
    poi_ts = []
    for p in c["pois"]:
        loc = nearest(pts, p["lat"], p["lng"])
        clips_ts = []
        for mode, script in p["clips"].items():
            dur = max(15, round(words(script) / 2.5))
            af = f"{rid}/{p['id']}_{mode}.mp3"
            clips_ts.append(
                f"        {mode}: {{\n"
                f"          script:\n            {ts_string(script)},\n"
                f"          audioFile: '{af}',\n"
                f"          durationSec: {dur},\n"
                f"        }},"
            )
        poi_ts.append(
            "    {\n"
            f"      id: '{p['id']}',\n"
            f"      name: {ts_string(p['name'])},\n"
            f"      location: {fmt_coord(loc)},\n"
            f"      triggerDistanceM: 50,\n"
            f"      clips: {{\n" + "\n".join(clips_ts) + "\n      },\n"
            "    },"
        )

    meta = dict(c["meta"])
    meta["elevationGainM"] = gain
    if is_loop:
        meta["loop"] = True
    if rid in OAB_IDS:
        meta["outAndBack"] = True
    meta_lines = []
    for k, v in meta.items():
        if isinstance(v, bool):
            meta_lines.append(f"  {k}: {'true' if v else 'false'},")
        elif isinstance(v, (int, float)):
            meta_lines.append(f"  {k}: {v},")
        elif isinstance(v, list):
            meta_lines.append(f"  {k}: [{', '.join(ts_string(x) for x in v)}],")
        else:
            meta_lines.append(f"  {k}: {ts_string(v)},")

    coords_ts = ",\n".join(f"    {fmt_coord(p)}" for p in pts)
    const = rid.upper()
    return const, (
        f"export const {const}: Route = {{\n"
        f"  id: '{rid}',\n"
        f"  city: {ts_string(c['city'])},\n"
        f"  name: {ts_string(c['name'])},\n"
        f"  description:\n    {ts_string(c['desc'])},\n"
        f"  distanceKm: {dist_km},\n"
        + "\n".join(meta_lines) + "\n"
        f"  startLocation: {fmt_coord(start)},\n"
        f"  coordinates: [\n{coords_ts},\n  ],\n"
        f"  pois: [\n" + "\n".join(poi_ts) + "\n  ],\n"
        "};\n"
    )


def main():
    blocks, consts = [], []
    for rid, c in CONTENT.items():
        print(f"building {rid}…", flush=True)
        const, block = build_route(rid, c)
        consts.append(const)
        blocks.append(block)
        time.sleep(0.4)
    header = "// AUTO-GENERATED by scripts/build_expansion_routes.py — geometry from GPX, scripts authored.\nimport { Route } from '../types';\n\n"
    OUT.write_text(header + "\n".join(blocks))
    print(f"\nwrote {OUT.relative_to(ROOT)} with {len(consts)} routes:")
    print("  " + ", ".join(consts))


if __name__ == "__main__":
    main()
