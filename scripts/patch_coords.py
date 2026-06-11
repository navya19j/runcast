#!/usr/bin/env python3
"""
patch_coords.py
───────────────
Reads scripts/routes_raw/real_coords.json (produced by fetch_real_coords.py)
and patches the `coordinates: [...]` and POI `location: { lat, lng }` arrays
inside the TypeScript route files.

Works on:
  src/data/routes/curated.ts
  src/data/routes/sf_embarcadero.ts
  src/data/routes/mumbai_bandra_waterfront.ts

Usage:
    cd runcast
    python3 scripts/patch_coords.py [--dry-run]
"""

import json, re, sys
from pathlib import Path

MANIFEST = Path(__file__).parent / "routes_raw" / "real_coords.json"
ROUTES_DIR = Path(__file__).parent.parent / "src" / "data" / "routes"

# ── Helpers ───────────────────────────────────────────────────────────────────

def fmt_coord(c: dict) -> str:
    return f"{{ lat: {c['lat']:.6f}, lng: {c['lng']:.6f} }}"

def fmt_coords_array(coords: list[dict], indent: int = 4) -> str:
    """Render a compact multi-line coordinate array."""
    pad = " " * indent
    inner_pad = " " * (indent + 2)
    lines = [f"{inner_pad}{fmt_coord(c)}" for c in coords]
    return "[\n" + ",\n".join(lines) + ",\n" + pad + "]"

def patch_coordinates_block(ts: str, route_id: str, new_coords: list[dict]) -> str:
    """
    Replace the  coordinates: [ ... ]  block for the given route.

    Strategy: find the route by its id string, then locate the `coordinates:`
    key that follows it and replace its value (the bracketed array).
    We use a bracket-depth counter so nested objects inside the array don't
    confuse the parser.
    """
    # Find where the route with this id starts
    id_pattern = re.compile(rf"id:\s*['\"]({re.escape(route_id)})['\"]")
    m = id_pattern.search(ts)
    if not m:
        print(f"  [patch_coordinates] route id '{route_id}' not found — skipping")
        return ts

    route_start = m.start()

    # From there, find 'coordinates:'
    coords_key_pattern = re.compile(r'\bcoordinates\s*:', re.MULTILINE)
    km = coords_key_pattern.search(ts, route_start)
    if not km:
        print(f"  [patch_coordinates] no 'coordinates:' found after route {route_id}")
        return ts

    # Find the opening '[' of the array
    open_idx = ts.index('[', km.end())

    # Find the matching ']' using bracket depth
    depth, close_idx = 0, open_idx
    for i, ch in enumerate(ts[open_idx:], open_idx):
        if ch == '[': depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0:
                close_idx = i
                break

    old_array = ts[open_idx: close_idx + 1]
    new_array = fmt_coords_array(new_coords, indent=4)

    print(f"  coordinates: {len(new_coords)} points  (was {old_array.count('lat:')} points)")
    return ts[:open_idx] + new_array + ts[close_idx + 1:]


def patch_poi_location(ts: str, poi_id: str, new_loc: dict) -> str:
    """
    Replace `location: { lat: ..., lng: ... }` for the POI with the given id.
    """
    # Find the POI by its id field
    id_pattern = re.compile(rf"id:\s*['\"]({re.escape(poi_id)})['\"]")
    m = id_pattern.search(ts)
    if not m:
        # POI id might not be in this file — skip silently
        return ts

    poi_start = m.start()

    # Find 'location:' within the next ~400 chars after the id
    loc_pattern = re.compile(r'\blocation\s*:\s*\{[^}]+\}')
    lm = loc_pattern.search(ts, poi_start, poi_start + 400)
    if not lm:
        return ts

    new_loc_str = f"location: {fmt_coord(new_loc)}"
    print(f"    POI {poi_id}: {new_loc['lat']:.5f}, {new_loc['lng']:.5f}")
    return ts[:lm.start()] + new_loc_str + ts[lm.end():]


def patch_start_location(ts: str, route_id: str, new_loc: dict) -> str:
    """
    Replace `startLocation: { lat: ..., lng: ... }` for the given route.
    """
    id_pattern = re.compile(rf"id:\s*['\"]({re.escape(route_id)})['\"]")
    m = id_pattern.search(ts)
    if not m:
        return ts

    route_start = m.start()
    sl_pattern = re.compile(r'\bstartLocation\s*:\s*\{[^}]+\}')
    sm = sl_pattern.search(ts, route_start, route_start + 800)
    if not sm:
        return ts

    new_sl_str = f"startLocation: {fmt_coord(new_loc)}"
    print(f"  startLocation: {new_loc['lat']:.5f}, {new_loc['lng']:.5f}")
    return ts[:sm.start()] + new_sl_str + ts[sm.end():]


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    dry_run = "--dry-run" in sys.argv

    if not MANIFEST.exists():
        print(f"ERROR: {MANIFEST} not found.")
        print("Run first:  python3 scripts/fetch_real_coords.py")
        sys.exit(1)

    data: list[dict] = json.loads(MANIFEST.read_text())
    print(f"Loaded {len(data)} routes from manifest\n")

    # Build lookup by route id
    by_id = {r["id"]: r for r in data}

    # Discover all .ts files in routes dir
    ts_files = sorted(ROUTES_DIR.glob("*.ts"))

    for ts_file in ts_files:
        print(f"{'[DRY-RUN] ' if dry_run else ''}Patching {ts_file.name}…")
        ts = ts_file.read_text(encoding="utf-8")
        original = ts

        for route_id, rdata in by_id.items():
            # Patch coordinates array
            if rdata.get("coords"):
                ts = patch_coordinates_block(ts, route_id, rdata["coords"])

            # Patch startLocation
            if rdata.get("startLocation"):
                ts = patch_start_location(ts, route_id, rdata["startLocation"])

            # Patch POI locations
            for poi_id, loc in rdata.get("pois", {}).items():
                ts = patch_poi_location(ts, poi_id, loc)

        if ts != original:
            if dry_run:
                print(f"  (dry-run) would write {len(ts)} chars")
            else:
                ts_file.write_text(ts, encoding="utf-8")
                print(f"  ✓ written ({len(ts)} chars)")
        else:
            print(f"  (no changes)")

    print("\nDone. Run:  npx tsc --noEmit  to verify.")


if __name__ == "__main__":
    main()
