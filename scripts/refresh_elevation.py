#!/usr/bin/env python3
"""
Compute real elevation gain for every route and patch `elevationGainM` into the
.ts files. Uses the Open-Meteo elevation API and the SAME sampling/threshold as
the app's live elevation profile (src/hooks/useElevation.ts), so the summary
number matches the chart.

Usage:
    python3 scripts/refresh_elevation.py
"""
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
MANIFEST = ROOT / "scripts" / "routes_raw" / "real_coords.json"
ROUTES_DIR = ROOT / "src" / "data" / "routes"
MAX_SAMPLES = 40  # matches useElevation.ts
NOISE_M = 0.5     # matches useElevation.ts
_ssl = ssl.create_default_context()
_ssl.check_hostname = False
_ssl.verify_mode = ssl.CERT_NONE


def downsample(arr, n):
    if len(arr) <= n:
        return arr
    return [arr[round(i * (len(arr) - 1) / (n - 1))] for i in range(n)]


def fetch_elevations(coords):
    lats = ",".join(f"{c['lat']:.6f}" for c in coords)
    lngs = ",".join(f"{c['lng']:.6f}" for c in coords)
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lngs}"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=30, context=_ssl) as r:
                return json.load(r)["elevation"]
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 + attempt)


def gain_loss(elevs):
    gain = loss = 0.0
    for i in range(1, len(elevs)):
        d = elevs[i] - elevs[i - 1]
        if d > NOISE_M:
            gain += d
        elif d < -NOISE_M:
            loss -= d
    return round(gain), round(loss)


def patch_elevation(ts: str, route_id: str, gain: int) -> str:
    id_pat = re.compile(rf"id:\s*['\"]{re.escape(route_id)}['\"]")
    m = id_pat.search(ts)
    if not m:
        return ts
    block_end = m.start() + 1200
    existing = re.search(r"\belevationGainM:\s*\d+", ts[m.start():block_end])
    if existing:
        s = m.start() + existing.start()
        e = m.start() + existing.end()
        return ts[:s] + f"elevationGainM: {gain}" + ts[e:]
    # insert after distanceKm if no existing field
    dm = re.search(r"\bdistanceKm:\s*[\d.]+", ts[m.start():block_end])
    if not dm:
        return ts
    at = m.start() + dm.end()
    return ts[:at] + f",\n  elevationGainM: {gain}" + ts[at:]


def main():
    routes = json.loads(MANIFEST.read_text())
    results = {}
    for r in routes:
        rid = r["id"]
        coords = r.get("coords") or []
        if len(coords) < 2:
            continue
        sampled = downsample(coords, MAX_SAMPLES)
        elevs = fetch_elevations(sampled)
        gain, loss = gain_loss(elevs)
        results[rid] = gain
        print(f"{rid:<32} ↑{gain:>4}m  ↓{loss:>4}m  (min {round(min(elevs))} / max {round(max(elevs))})")
        time.sleep(0.6)  # be polite to Open-Meteo

    for ts_file in sorted(ROUTES_DIR.glob("*.ts")):
        ts = ts_file.read_text()
        orig = ts
        for rid, gain in results.items():
            ts = patch_elevation(ts, rid, gain)
        if ts != orig:
            ts_file.write_text(ts)
            print(f"patched {ts_file.name}")


if __name__ == "__main__":
    main()
