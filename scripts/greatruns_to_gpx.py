#!/usr/bin/env python3
"""
Extract a route from a greatruns.com page (which embeds a MapMyRun route) and
save it as scripts/routes_raw/gpx/<route_id>.gpx.

Usage:
    python3 scripts/greatruns_to_gpx.py <greatruns_url> <route_id>

greatruns pages embed a MapMyRun route whose view page exposes the full point
list (lat/lng/elevation) as JSON — we pull that directly.
"""
import json
import math
import re
import ssl
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
GPX_DIR = ROOT / "scripts" / "routes_raw" / "gpx"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
_ssl = ssl.create_default_context()
_ssl.check_hostname = False
_ssl.verify_mode = ssl.CERT_NONE


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=30, context=_ssl).read().decode("utf-8", "replace")


def haversine(a, b) -> float:
    R = 6371000
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return 2 * R * math.asin(
        math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2)
    )


def extract_points(html: str) -> list[tuple[float, float]]:
    """Pull the MapMyRun `points` array (list of {lng,lat,ele,...})."""
    m = re.search(r'"points"\s*:\s*(\[\{.*?\}\])', html, re.DOTALL)
    if not m:
        return []
    raw = json.loads(m.group(1))
    return [(p["lat"], p["lng"]) for p in raw if "lat" in p and "lng" in p]


def write_gpx(pts, name, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx version="1.1" creator="greatruns-mapmyrun">',
             f"<trk><name>{name}</name><trkseg>"]
    lines += [f'<trkpt lat="{la:.6f}" lon="{lo:.6f}"></trkpt>' for la, lo in pts]
    lines += ["</trkseg></trk>", "</gpx>", ""]
    path.write_text("\n".join(lines))


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    url, route_id = sys.argv[1], sys.argv[2]

    page = fetch(url)
    m = re.search(r"mapmyrun\.com/routes/view/(?:embedded/)?(\d+)", page)
    if not m:
        print("No MapMyRun route found on page.")
        sys.exit(1)
    mmr_id = m.group(1)
    view = fetch(f"https://www.mapmyrun.com/routes/view/{mmr_id}/")
    pts = extract_points(view)
    if not pts:
        print(f"Could not extract points from MapMyRun route {mmr_id}.")
        sys.exit(1)

    km = sum(haversine(pts[i - 1], pts[i]) for i in range(1, len(pts))) / 1000
    out = GPX_DIR / f"{route_id}.gpx"
    write_gpx(pts, route_id, out)
    print(f"MapMyRun {mmr_id}: {len(pts)} pts, {km:.2f} km")
    print(f"  start {pts[0][0]:.5f},{pts[0][1]:.5f}  end {pts[-1][0]:.5f},{pts[-1][1]:.5f}")
    print(f"  wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
