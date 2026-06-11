#!/usr/bin/env python3
"""
sync_route_metadata.py
──────────────────────
Patch RouteMetadata fields in src/data/routes/*.ts from curated_routes.json
matched by route_id (or name fallback).

Does not touch coordinates, distanceKm, POI scripts, or audio paths —
use refresh_all_coords.py for geometry.

Usage:
  python3 scripts/sync_route_metadata.py
  python3 scripts/sync_route_metadata.py --dry-run
  python3 scripts/sync_route_metadata.py --route mumbai_juhu_beach
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
CURATED = Path(__file__).parent / "routes_raw" / "curated_routes.json"
ROUTES_DIR = ROOT / "src" / "data" / "routes"

# Fallback when curated entry lacks route_id
NAME_TO_ROUTE_ID: dict[str, str] = {
    "Embarcadero to Crissy Field": "sf_embarcadero_loop",
    "Golden Gate Park Big Lap": "sf_gg_park_big_lap",
    "Ocean Beach / Great Highway": "sf_ocean_beach",
    "Batteries to Bluffs (Presidio)": "sf_batteries_to_bluffs",
    "Crissy Field to Baker Beach": "sf_crissy_to_baker",
    "Bernal Heights Loop": "sf_bernal_heights",
    "Glen Canyon to Twin Peaks": "sf_glen_canyon_twin_peaks",
    "Lands End Trail": "sf_lands_end",
    "Marine Drive Full Loop": "mumbai_marine_drive",
    "Carter Road to Bandstand Loop": "mumbai_bandra_soul",
    "Mumbai Coastal Road Promenade": "mumbai_coastal_promenade",
    "Danda to Versova Beach Walk": "mumbai_danda_versova",
    "Powai Lake Loop": "mumbai_powai_lake",
    "Shivaji Park Circuit": "mumbai_shivaji_park",
    "Worli Seaface": "mumbai_worli_seaface",
    "Priyadarshini Park Loop (Malabar Hill)": "mumbai_priyadarshini_park",
    "Bandra–Worli Coastal Promenade": "mumbai_bandra_worli_coastal",
    "Juhu Beach": "mumbai_juhu_beach",
    "Mahalaxmi Race Course": "mumbai_mahalaxmi_racecourse",
}

# curated key → (ts field, optional transform)
FIELD_MAP: list[tuple[str, str, str | None]] = [
    ("elevation_gain_m", "elevationGainM", "number"),
    ("gradient_character", "gradientCharacter", "string"),
    ("surface", "surface", "string"),
    ("surface_quality", "surfaceQuality", "string"),
    ("width", "width", "string"),
    ("shade", "shade", "shade"),
    ("obstacles", "obstacles", "string"),
    ("best_time", "bestTime", "string"),
    ("monsoon_safe", "monsoonSafe", "bool"),
    ("best_season", "bestSeason", "string"),
    ("crowd_levels", "crowdLevels", "object"),
    ("lighting", "lighting", "lighting"),
    ("solo_female_safe", "soloFemaleSafe", "bool"),
    ("headphones_safe", "headphonesSafe", "bool"),
    ("who_its_for", "whoItsFor", "string"),
    ("best_use", "bestUse", "string"),
    ("heat_warning", "heatWarning", "heat"),
    ("water_on_route", "waterOnRoute", "bool"),
    ("restrooms_on_route", "restroomsOnRoute", "bool"),
    ("transit_to_start", "transitToStart", "string"),
    ("post_run_food", "postRunFood", "string"),
    ("local_tip", "localTip", "string"),
    ("instagram_moment", "instagramMoment", "string"),
    ("historical_hook", "historicalHook", "string"),
    ("neighbourhood_vibe", "neighbourhoodVibe", "string"),
    ("landmarks", "landmarks", "array"),
    ("poi_density", "poiDensity", "poi_density"),
    ("content_richness", "contentRichness", "object"),
    ("run_club_usage", "runClubUsage", "array"),
    ("event_association", "eventAssociation", "nullable_string"),
    ("community_rating", "communityRating", "number"),
    ("loop", "loop", "bool"),
]


def normalize_shade(val: str) -> str:
    v = val.lower()
    if "partial" in v or "canopy" in v:
        return "partial"
    if "good" in v or "shade" in v and "none" not in v:
        return "good"
    return "none"


def normalize_lighting(val: str) -> str:
    v = val.lower()
    if "fully" in v or "lit" in v and "not" not in v and "unlit" not in v:
        return "fully lit"
    if "partial" in v or "some" in v:
        return "partial"
    return "none"


def normalize_poi_density(val: str) -> str:
    base = val.split("—")[0].split("-")[0].strip().lower()
    if base.startswith("high"):
        return "high"
    if base.startswith("low"):
        return "low"
    return "medium"


def normalize_heat(val: str) -> str:
    return val.lower().split("—")[0].strip()


def ts_string(val: str) -> str:
    return "'" + val.replace("\\", "\\\\").replace("'", "\\'") + "'"


def fmt_ts_value(val, kind: str) -> str:
    if kind == "number":
        return str(val)
    if kind == "bool":
        return "true" if val else "false"
    if kind == "nullable_string":
        return "null" if val is None else ts_string(str(val))
    if kind == "string":
        return ts_string(str(val))
    if kind == "shade":
        return ts_string(normalize_shade(str(val)))
    if kind == "lighting":
        return ts_string(normalize_lighting(str(val)))
    if kind == "poi_density":
        return ts_string(normalize_poi_density(str(val)))
    if kind == "heat":
        return ts_string(normalize_heat(str(val)))
    if kind == "array":
        items = ", ".join(ts_string(str(x)) for x in val)
        return f"[{items}]"
    if kind == "object":
        if not val:
            return "{}"
        parts = []
        for k, v in val.items():
            key = ts_string(str(k)) if not re.match(r"^[a-zA-Z_][\w]*$", str(k)) else str(k)
            parts.append(f"{key}: {ts_string(str(v))}")
        return "{ " + ", ".join(parts) + " }"
    raise ValueError(f"unknown kind {kind}")


# Matches a single TS literal value (string, array, object, bool, number, null)
_TS_VALUE = (
    r"(?:'(?:\\'|[^'])*'"
    r'|"(?:\\"|[^"])*"'
    r"|\{(?:[^{}]|\{[^{}]*\})*\}"
    r"|\[(?:[^\[\]]|\[[^\[\]]*\])*\]"
    r"|true|false|null"
    r"|-?\d+(?:\.\d+)?)"
)


def load_curated_by_id() -> dict[str, dict]:
    data = json.loads(CURATED.read_text(encoding="utf-8"))
    out: dict[str, dict] = {}
    for city in data["cities"].values():
        for route in city["routes"]:
            rid = route.get("route_id") or NAME_TO_ROUTE_ID.get(route["name"])
            if rid:
                route["route_id"] = rid
                out[rid] = route
    return out


def patch_route_block(ts: str, route_id: str, curated: dict) -> tuple[str, int]:
    id_pat = re.compile(rf"id:\s*['\"]{re.escape(route_id)}['\"]")
    m = id_pat.search(ts)
    if not m:
        return ts, 0

    # Block ends at next route export or file end
    next_route = re.search(
        r"\nexport const \w+",
        ts[m.end() :],
    )
    end = m.end() + next_route.start() if next_route else len(ts)
    block = ts[m.start() : end]
    patched = block
    changes = 0

    for ckey, tskey, kind in FIELD_MAP:
        if ckey not in curated:
            continue
        val = curated[ckey]
        if val is None and kind != "nullable_string":
            continue
        new_val = fmt_ts_value(val, kind)
        field_re = re.compile(rf"\b{re.escape(tskey)}\s*:\s*{_TS_VALUE}", re.DOTALL)
        fm = field_re.search(patched)
        if fm:
            old = fm.group(0)
            replacement = f"{tskey}: {new_val}"
            if old.strip() != replacement.strip():
                patched = patched[: fm.start()] + replacement + patched[fm.end() :]
                changes += 1
        else:
            # Insert after distanceKm
            dm = re.search(r"\bdistanceKm:\s*[\d.]+", patched)
            if dm:
                insert = f",\n  {tskey}: {new_val}"
                patched = patched[: dm.end()] + insert + patched[dm.end() :]
                changes += 1

    if patched != block:
        ts = ts[: m.start()] + patched + ts[end:]
    return ts, changes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--route", help="Sync a single route_id only")
    args = parser.parse_args()

    by_id = load_curated_by_id()
    if args.route:
        if args.route not in by_id:
            print(f"Unknown route_id: {args.route}")
            raise SystemExit(1)
        by_id = {args.route: by_id[args.route]}

    total = 0
    for ts_file in sorted(ROUTES_DIR.glob("*.ts")):
        ts = ts_file.read_text(encoding="utf-8")
        original = ts
        file_changes = 0
        for rid, curated in by_id.items():
            ts, n = patch_route_block(ts, rid, curated)
            file_changes += n
        if file_changes:
            print(f"{ts_file.name}: {file_changes} field(s) updated")
            total += file_changes
            if not args.dry_run:
                ts_file.write_text(ts, encoding="utf-8")
        elif any(rid in ts for rid in by_id):
            print(f"{ts_file.name}: (no changes)")

    print(f"\n{'Would update' if args.dry_run else 'Updated'} {total} metadata field(s) across routes")


if __name__ == "__main__":
    main()
