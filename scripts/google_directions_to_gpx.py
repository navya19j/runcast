#!/usr/bin/env python3
"""
Build a route via the Google Directions API (walking mode) and save it as
scripts/routes_raw/gpx/<route_id>.gpx.

Usage:
    python3 scripts/google_directions_to_gpx.py <route_id> "lat,lng" "lat,lng" ... [--loop]

The first/last coords are origin/destination; any in between are waypoints.
Pass --loop to make it an out-and-back (returns to origin via the same waypoints).

Reads GOOGLE_MAPS_API_KEY_IOS/ANDROID from .env.
"""
import json
import math
import ssl
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
GPX_DIR = ROOT / "scripts" / "routes_raw" / "gpx"
_ssl = ssl.create_default_context()
_ssl.check_hostname = False
_ssl.verify_mode = ssl.CERT_NONE


def load_key() -> str:
    env = {}
    for line in (ROOT / ".env").read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"').strip("'")
    return env.get("GOOGLE_MAPS_API_KEY_IOS") or env["GOOGLE_MAPS_API_KEY_ANDROID"]


def decode_polyline(s: str) -> list[tuple[float, float]]:
    coords, i, lat, lng = [], 0, 0, 0
    while i < len(s):
        for axis in range(2):
            shift = res = 0
            while True:
                b = ord(s[i]) - 63
                i += 1
                res |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            d = ~(res >> 1) if res & 1 else res >> 1
            if axis == 0:
                lat += d
            else:
                lng += d
        coords.append((lat / 1e5, lng / 1e5))
    return coords


def haversine(a, b) -> float:
    R = 6371000
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return 2 * R * math.asin(
        math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2)
    )


def directions(coords: list[str], key: str) -> list[tuple[float, float]]:
    params = {"origin": coords[0], "destination": coords[-1], "mode": "walking", "key": key}
    if len(coords) > 2:
        params["waypoints"] = "|".join(coords[1:-1])
    url = "https://maps.googleapis.com/maps/api/directions/json?" + urllib.parse.urlencode(params)
    d = json.load(urllib.request.urlopen(url, timeout=30, context=_ssl))
    if d.get("status") != "OK":
        raise RuntimeError(f"{d.get('status')}: {d.get('error_message')}")
    # Stitch decoded step polylines (denser than overview_polyline)
    pts: list[tuple[float, float]] = []
    for leg in d["routes"][0]["legs"]:
        for step in leg["steps"]:
            seg = decode_polyline(step["polyline"]["points"])
            if pts and seg and haversine(pts[-1], seg[0]) < 1:
                seg = seg[1:]
            pts.extend(seg)
    return pts


def write_gpx(pts, name, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx version="1.1" creator="google-directions">',
             f"<trk><name>{name}</name><trkseg>"]
    lines += [f'<trkpt lat="{la:.6f}" lon="{lo:.6f}"></trkpt>' for la, lo in pts]
    lines += ["</trkseg></trk>", "</gpx>", ""]
    path.write_text("\n".join(lines))


def main():
    args = sys.argv[1:]
    loop = "--loop" in args
    args = [a for a in args if a != "--loop"]
    route_id, coords = args[0], args[1:]
    if len(coords) < 2:
        print(__doc__)
        sys.exit(1)

    key = load_key()
    pts = directions(coords, key)
    if loop:
        back = directions(list(reversed(coords)), key)
        if pts and back and haversine(pts[-1], back[0]) < 1:
            back = back[1:]
        pts += back

    km = sum(haversine(pts[i - 1], pts[i]) for i in range(1, len(pts))) / 1000
    out = GPX_DIR / f"{route_id}.gpx"
    write_gpx(pts, route_id, out)
    print(f"{route_id}: {km:.2f} km, {len(pts)} pts {'(out-and-back)' if loop else ''}")
    print(f"  start {pts[0][0]:.5f},{pts[0][1]:.5f}  end {pts[-1][0]:.5f},{pts[-1][1]:.5f}")
    print(f"  wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
