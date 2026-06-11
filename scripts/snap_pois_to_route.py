#!/usr/bin/env python3
"""
After route geometry changes, POIs can end up off the new path so their audio
trigger (triggerDistanceM) never fires. This snaps every POI's `location` to the
nearest point on its OWN route's coordinates.

Only snaps POIs within MAX_SNAP_M of the path (further ones likely belong to a
different route / are genuinely off-route — reported, not moved).

Usage:  python3 scripts/snap_pois_to_route.py
"""
import math
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
ROUTES_DIR = ROOT / "src" / "data" / "routes"
MAX_SNAP_M = 600


def hav(a, b):
    R = 6371000
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return 2 * R * math.asin(math.sqrt(math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2))


def find_array(ts, key, start):
    """Return (open_idx, close_idx) of the bracketed array for `key:` after start."""
    km = re.search(rf"\b{key}\s*:", ts[start:])
    if not km:
        return None
    open_idx = start + km.end() + ts[start + km.end():].index("[")
    depth = 0
    for i in range(open_idx, len(ts)):
        if ts[i] == "[":
            depth += 1
        elif ts[i] == "]":
            depth -= 1
            if depth == 0:
                return open_idx, i
    return None


def main():
    total_moved = 0
    for f in sorted(ROUTES_DIR.glob("*.ts")):
        ts = f.read_text()
        # route object boundaries: each starts at an `id: '...'`
        id_positions = [(m.start(), m.group(1)) for m in re.finditer(r"id:\s*'([a-z0-9_]+)'", ts)]
        # keep only top-level route ids (those followed by a coordinates array before the next id)
        edits = []  # (loc_start, loc_end, new_text)
        for idx, (pos, rid) in enumerate(id_positions):
            nxt = id_positions[idx + 1][0] if idx + 1 < len(id_positions) else len(ts)
            coord_span = find_array(ts, "coordinates", pos)
            if not coord_span or coord_span[0] > nxt:
                continue  # this id is a POI id, not a route
            cs, ce = coord_span
            coords = [(float(a), float(b)) for a, b in re.findall(r"lat:\s*([\d.\-]+),\s*lng:\s*([\d.\-]+)", ts[cs:ce])]
            if len(coords) < 2:
                continue
            pois_span = find_array(ts, "pois", pos)
            if not pois_span:
                continue
            ps, pe = pois_span
            # each POI location within [ps, pe] (full pois array, brace-matched)
            for lm in re.finditer(r"location:\s*\{\s*lat:\s*([\d.\-]+),\s*lng:\s*([\d.\-]+)\s*\}", ts[ps:pe]):
                lat, lng = float(lm.group(1)), float(lm.group(2))
                nearest = min(coords, key=lambda c: hav(c, (lat, lng)))
                d = hav(nearest, (lat, lng))
                if 8 < d <= MAX_SNAP_M:
                    new = f"location: {{ lat: {nearest[0]:.6f}, lng: {nearest[1]:.6f} }}"
                    s = ps + lm.start(); e = ps + lm.end()
                    edits.append((s, e, new, rid, d))
        # apply edits back-to-front
        for s, e, new, rid, d in sorted(edits, key=lambda x: -x[0]):
            ts = ts[:s] + new + ts[e:]
            print(f"  {f.name}: snapped POI in {rid} (was {d:.0f}m off)")
            total_moved += 1
        if edits:
            f.write_text(ts)
    print(f"\nSnapped {total_moved} POIs onto their route paths.")


if __name__ == "__main__":
    main()
