"""
enrich_curated.py
─────────────────
Takes curated_routes.json (LLM-distilled knowledge) and enriches each route
with real elevation data from Open-Meteo using the approximate start coordinates.

Also prints a summary table for review.

Run:
  python3 scripts/enrich_curated.py
"""

import json, time, math, os, ssl

try:
    import certifi
    _CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _CTX = ssl.create_default_context()
    _CTX.check_hostname = False
    _CTX.verify_mode = ssl.CERT_NONE

from urllib.request import urlopen, Request

RAW_DIR = os.path.join(os.path.dirname(__file__), "routes_raw")

def fetch(url):
    req = Request(url, headers={"User-Agent": "RunCast/0.1"})
    with urlopen(req, timeout=15, context=_CTX) as r:
        return json.loads(r.read())

def get_elevation(lat, lng):
    d = fetch(f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lng}")
    return round(d["elevation"][0], 1) if d.get("elevation") else 0

def main():
    with open(os.path.join(RAW_DIR, "curated_routes.json")) as f:
        data = json.load(f)

    print(f"{'City':<15} {'Route':<42} {'Dist':>6}  {'Gain':>5}  {'Surface':<10}  {'Time'}")
    print("─" * 110)

    for city_id, city_data in data["cities"].items():
        city_name = city_id.replace("_", " ").title()
        for r in city_data["routes"]:
            lat, lng = r["start_lat"], r["start_lng"]
            elev = get_elevation(lat, lng)
            r["start_elevation_m"] = elev
            time.sleep(0.2)

            flag = "⚠️ " if r["community_rating"] < 4 else ("🌟" if r["community_rating"] == 5 else "✓ ")
            print(f"{city_name:<15} {r['name']:<42} {r['dist_km_approx']:>5.1f}km"
                  f"  ↑{r['elevation_gain_m']:>3}m  {r['surface']:<10}"
                  f"  {r['best_time'][:30]}")

    # Save enriched
    out_path = os.path.join(RAW_DIR, "curated_routes_enriched.json")
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Saved → {out_path}")
    print(f"\n{'='*50}")
    print("  SUMMARY")
    print(f"{'='*50}")
    for city_id, city_data in data["cities"].items():
        routes = city_data["routes"]
        city_name = city_id.replace("_", " ").title()
        stars5 = [r for r in routes if r["community_rating"] == 5]
        print(f"\n  {city_name} — {len(routes)} routes ({len(stars5)} top-rated):")
        for r in sorted(routes, key=lambda x: -x["community_rating"]):
            tag = "★★★★★" if r["community_rating"] == 5 else "★★★★ "
            print(f"    {tag}  {r['dist_km_approx']:>5.1f}km  {r['name']}")

if __name__ == "__main__":
    main()
