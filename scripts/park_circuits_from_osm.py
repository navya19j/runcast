#!/usr/bin/env python3
"""
Rebuild park-lap routes from authoritative OSM boundary polygons (not eyeballed
waypoints). Replaces coordinates + startLocation + distanceKm in the route's TS,
and snaps that route's POIs onto the corrected loop.

Usage:  python3 scripts/park_circuits_from_osm.py
"""
import json
import math
import re
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
ROUTES_DIR = ROOT / "src" / "data" / "routes"
_ssl = ssl.create_default_context(); _ssl.check_hostname = False; _ssl.verify_mode = ssl.CERT_NONE

# route_id -> OSM way id (the real park / racecourse perimeter)
PARK_WAYS = {
    "mumbai_shivaji_park":         113711205,
    "mumbai_mahalaxmi_racecourse": 1289073486,
    "mumbai_priyadarshini_park":   38757942,
}


def overpass_way(way_id):
    q = f"[out:json][timeout:40];way({way_id});out geom;"
    data = urllib.parse.urlencode({"data": q}).encode()
    req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=data, headers={"User-Agent": "runcast/1.0"})
    els = json.load(urllib.request.urlopen(req, timeout=60, context=_ssl))["elements"]
    return [(p["lat"], p["lon"]) for p in els[0]["geometry"]]


def hav(a, b):
    R = 6371000
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return 2 * R * math.asin(math.sqrt(math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2))


def densify(pts, step=18):
    out = [pts[0]]
    for i in range(1, len(pts)):
        a, b = pts[i-1], pts[i]; d = hav(a, b); n = max(1, int(d/step))
        for j in range(1, n+1):
            t = j/n; out.append((a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])))
    return out


def find_array(ts, key, start):
    km = re.search(rf"\b{key}\s*:", ts[start:])
    open_idx = start + km.end() + ts[start + km.end():].index("[")
    depth = 0
    for i in range(open_idx, len(ts)):
        if ts[i] == "[": depth += 1
        elif ts[i] == "]":
            depth -= 1
            if depth == 0: return open_idx, i


def route_file(rid):
    for f in ROUTES_DIR.glob("*.ts"):
        if f"id: '{rid}'" in f.read_text():
            return f


def main():
    for rid, way_id in PARK_WAYS.items():
        poly = overpass_way(way_id)
        if poly[0] != poly[-1]:
            poly.append(poly[0])  # close loop
        pts = densify(poly)
        km = round(sum(hav(pts[i-1], pts[i]) for i in range(1, len(pts)))/1000, 1)

        f = route_file(rid)
        ts = f.read_text()
        pos = ts.find(f"id: '{rid}'")
        # replace coordinates
        cs, ce = find_array(ts, "coordinates", pos)
        coords_ts = "[\n" + ",\n".join(f"    {{ lat: {p[0]:.6f}, lng: {p[1]:.6f} }}" for p in pts) + ",\n  ]"
        ts = ts[:cs] + coords_ts + ts[ce+1:]
        # refresh positions after edit
        pos = ts.find(f"id: '{rid}'")
        # startLocation
        ts = re.sub(r"(id: '" + rid + r"'[\s\S]{0,1200}?startLocation:\s*)\{[^}]+\}",
                    rf"\g<1>{{ lat: {pts[0][0]:.6f}, lng: {pts[0][1]:.6f} }}", ts, count=1)
        # distanceKm
        ts = re.sub(r"(id: '" + rid + r"'[\s\S]{0,1200}?distanceKm:\s*)[\d.]+", rf"\g<1>{km}", ts, count=1)
        # snap this route's POIs onto the new loop
        pos = ts.find(f"id: '{rid}'")
        ps, pe = find_array(ts, "pois", pos)
        body = ts[ps:pe]
        def snap(m):
            lat, lng = float(m.group(1)), float(m.group(2))
            n = min(pts, key=lambda c: hav(c, (lat, lng)))
            return f"location: {{ lat: {n[0]:.6f}, lng: {n[1]:.6f} }}"
        new_body = re.sub(r"location:\s*\{\s*lat:\s*([\d.\-]+),\s*lng:\s*([\d.\-]+)\s*\}", snap, body)
        ts = ts[:ps] + new_body + ts[pe:]
        f.write_text(ts)
        print(f"✓ {rid}: {len(pts)} pts, {km} km/lap  (OSM way {way_id})  → {f.name}")


if __name__ == "__main__":
    main()
