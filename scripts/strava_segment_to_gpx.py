#!/usr/bin/env python3
"""
Fetch a Strava segment OR route geometry and save it as
scripts/routes_raw/gpx/<route_id>.gpx.

Usage:
    python3 scripts/strava_segment_to_gpx.py <segment_or_route_url_or_id> <route_id>

Accepts either a Strava segment (https://strava.com/segments/<id>) or a Strava
route (https://strava.com/routes/<id>) URL/id — it auto-detects which.

Reads Strava credentials from .env (auto-refreshes the access token).
"""
import json
import math
import os
import re
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


def load_env() -> dict:
    env = {}
    for line in (ROOT / ".env").read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"').strip("'")
    return env


def refresh_token(env: dict) -> str:
    data = urllib.parse.urlencode(
        {
            "client_id": env["STRAVA_CLIENT_ID"],
            "client_secret": env["STRAVA_CLIENT_SECRET"],
            "grant_type": "refresh_token",
            "refresh_token": env["STRAVA_REFRESH_TOKEN"],
        }
    ).encode()
    req = urllib.request.Request("https://www.strava.com/oauth/token", data=data)
    return json.load(urllib.request.urlopen(req, timeout=30, context=_ssl))["access_token"]


def get_segment(seg_id: int, token: str) -> dict:
    req = urllib.request.Request(
        f"https://www.strava.com/api/v3/segments/{seg_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    return json.load(urllib.request.urlopen(req, timeout=30, context=_ssl))


def get_route_gpx(route_id: int, token: str) -> tuple[str, str, float]:
    """Returns (gpx_text, name, distance_km) for a Strava route."""
    hdr = {"Authorization": f"Bearer {token}"}
    meta = json.load(
        urllib.request.urlopen(
            urllib.request.Request(f"https://www.strava.com/api/v3/routes/{route_id}", headers=hdr),
            timeout=30,
            context=_ssl,
        )
    )
    gpx = urllib.request.urlopen(
        urllib.request.Request(
            f"https://www.strava.com/api/v3/routes/{route_id}/export_gpx", headers=hdr
        ),
        timeout=30,
        context=_ssl,
    ).read().decode()
    return gpx, meta.get("name", str(route_id)), meta.get("distance", 0) / 1000


def decode_polyline(s: str) -> list[tuple[float, float]]:
    """Google encoded polyline, precision 5."""
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


def write_gpx(pts: list[tuple[float, float]], name: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="strava-api">',
        f"<trk><name>{name}</name><trkseg>",
    ]
    lines += [f'<trkpt lat="{la:.6f}" lon="{lo:.6f}"></trkpt>' for la, lo in pts]
    lines += ["</trkseg></trk>", "</gpx>", ""]
    path.write_text("\n".join(lines))


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    seg_arg, route_id = sys.argv[1], sys.argv[2]
    is_route = "/routes/" in seg_arg
    obj_id = int(re.search(r"(\d+)", seg_arg).group(1))

    env = load_env()
    token = refresh_token(env)
    out = GPX_DIR / f"{route_id}.gpx"

    if is_route:
        gpx, name, km = get_route_gpx(obj_id, token)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(gpx)
        pts = [(float(a), float(b)) for a, b in re.findall(r'lat="([\d.\-]+)" lon="([\d.\-]+)"', gpx)]
        kind = "Route"
    else:
        seg = get_segment(obj_id, token)
        poly = seg.get("map", {}).get("polyline") or seg.get("map", {}).get("summary_polyline")
        if not poly:
            print(f"Segment {obj_id} has no polyline.")
            sys.exit(1)
        pts = decode_polyline(poly)
        km = sum(haversine(pts[i - 1], pts[i]) for i in range(1, len(pts))) / 1000
        write_gpx(pts, seg.get("name", route_id), out)
        name = seg.get("name")
        kind = "Segment"

    print(f'{kind} {obj_id}: "{name}" — {km:.2f} km, {len(pts)} pts')
    if pts:
        print(f"  start {pts[0][0]:.5f},{pts[0][1]:.5f}  end {pts[-1][0]:.5f},{pts[-1][1]:.5f}")
    print(f"  wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
