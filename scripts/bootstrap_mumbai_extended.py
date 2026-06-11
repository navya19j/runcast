#!/usr/bin/env python3
"""Build polylines for new Mumbai routes and patch mumbai_extended.ts."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_real_coords import ROUTES  # noqa: E402
from refresh_all_coords import (  # noqa: E402
    LOOP_IDS,
    OUT_AND_BACK_IDS,
    build_path,
    patch_coordinates_block,
    patch_distance_km,
    patch_loop_flag,
    patch_out_and_back_flag,
    patch_start_location,
    path_km,
)

NEW_IDS = [
    "mumbai_bandra_worli_coastal",
    "mumbai_juhu_beach",
    "mumbai_danda_versova",
    "mumbai_mahalaxmi_racecourse",
]

TS = Path(__file__).parent.parent / "src" / "data" / "routes" / "mumbai_extended.ts"


def main():
    ts = TS.read_text(encoding="utf-8")
    for rid in NEW_IDS:
        route = next(r for r in ROUTES if r["id"] == rid)
        print(f"[{rid}] building path…")
        coords = build_path(route, force=True)
        km = path_km(coords)
        print(f"  → {len(coords)} pts, {km:.2f} km")
        ts = patch_coordinates_block(ts, rid, coords)
        ts = patch_start_location(ts, rid, coords[0])
        ts = patch_distance_km(ts, rid, km)
        ts = patch_loop_flag(ts, rid, rid in LOOP_IDS)
        ts = patch_out_and_back_flag(ts, rid, rid in OUT_AND_BACK_IDS)
    TS.write_text(ts, encoding="utf-8")
    print(f"\n✓ Patched {TS}")


if __name__ == "__main__":
    main()
