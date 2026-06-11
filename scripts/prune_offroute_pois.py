#!/usr/bin/env python3
"""
Final POI alignment pass. For each route:
  - POIs within KEEP_M of the path  → snap location onto nearest path point (keep)
  - POIs beyond KEEP_M              → the route no longer passes them → DROP,
                                        UNLESS dropping leaves <1 POI, in which case
                                        snap them on anyway (stopgap so audio plays).
Dropped POIs only lose their map placement here; their audio files stay on disk.

Usage:  python3 scripts/prune_offroute_pois.py
"""
import math
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
ROUTES_DIR = ROOT / "src" / "data" / "routes"
KEEP_M = 250


def hav(a, b):
    R = 6371000
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return 2 * R * math.asin(math.sqrt(math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2))


def find_array(ts, key, start):
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


def split_objects(arr_text):
    """Yield (start,end) of each top-level {..} object inside an array body."""
    spans = []
    depth = 0
    obj_start = None
    for i, ch in enumerate(arr_text):
        if ch == "{":
            if depth == 0:
                obj_start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                spans.append((obj_start, i + 1))
    return spans


def main():
    total_drop = total_snap = 0
    for f in sorted(ROUTES_DIR.glob("*.ts")):
        ts = f.read_text()
        ids = [(m.start(), m.group(1)) for m in re.finditer(r"id:\s*'([a-z0-9_]+)'", ts)]
        # process routes back-to-front so indices stay valid
        routes = []
        for idx, (pos, rid) in enumerate(ids):
            nxt = ids[idx + 1][0] if idx + 1 < len(ids) else len(ts)
            cspan = find_array(ts, "coordinates", pos)
            if not cspan or cspan[0] > nxt:
                continue
            routes.append((pos, rid, cspan))
        for pos, rid, cspan in reversed(routes):
            coords = [(float(a), float(b)) for a, b in re.findall(r"lat:\s*([\d.\-]+),\s*lng:\s*([\d.\-]+)", ts[cspan[0]:cspan[1]])]
            pspan = find_array(ts, "pois", pos)
            if not pspan:
                continue
            ps, pe = pspan
            body = ts[ps + 1:pe]  # inside [ ]
            objs = split_objects(body)
            if not objs:
                continue
            # classify
            entries = []  # (text, off, nearest)
            for (a, b) in objs:
                otext = body[a:b]
                lm = re.search(r"location:\s*\{\s*lat:\s*([\d.\-]+),\s*lng:\s*([\d.\-]+)\s*\}", otext)
                if not lm:
                    entries.append((otext, 0, None)); continue
                lat, lng = float(lm.group(1)), float(lm.group(2))
                nearest = min(coords, key=lambda c: hav(c, (lat, lng)))
                entries.append((otext, hav(nearest, (lat, lng)), nearest))
            near = [e for e in entries if e[1] <= KEEP_M]
            keep_all = len(near) < 1  # would go empty → keep+snap everything
            kept, dropped, snapped = [], 0, 0
            for otext, off, nearest in entries:
                if off <= KEEP_M or keep_all:
                    if nearest and off > 8:
                        otext = re.sub(
                            r"location:\s*\{\s*lat:\s*[\d.\-]+,\s*lng:\s*[\d.\-]+\s*\}",
                            f"location: {{ lat: {nearest[0]:.6f}, lng: {nearest[1]:.6f} }}",
                            otext, count=1)
                        snapped += 1
                    kept.append(otext)
                else:
                    dropped += 1
            if dropped == 0 and snapped == 0:
                continue
            # rebuild pois array body with kept objects, 4-space indent
            new_body = "\n" + ",\n".join("    " + o.strip() for o in kept) + ",\n  "
            ts = ts[:ps + 1] + new_body + ts[pe:]
            total_drop += dropped; total_snap += snapped
            note = []
            if snapped: note.append(f"snapped {snapped}")
            if dropped: note.append(f"dropped {dropped}")
            if keep_all and snapped: note[-0:] = ["(kept-all: geometry mismatch)"]
            print(f"  {rid:<30} {', '.join(note)}")
        f.write_text(ts)
    print(f"\nDone: snapped {total_snap}, dropped {total_drop} off-route POIs.")


if __name__ == "__main__":
    main()
