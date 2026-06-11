#!/usr/bin/env python3
"""Cross-check all route files: path length vs distanceKm, backtracks, point count."""
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
ROUTES_DIR = ROOT / "src" / "data" / "routes"


def dist_m(a: dict, b: dict) -> float:
    r = 6371000
    d_lat = math.radians(b["lat"] - a["lat"])
    d_lng = math.radians(b["lng"] - a["lng"])
    s = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(a["lat"]))
        * math.cos(math.radians(b["lat"]))
        * math.sin(d_lng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(min(1.0, s)))


def parse_routes(ts: str) -> list[dict]:
    routes = []
    # Top-level Route exports only (skip POI id fields nested in pointsOfInterest)
    for m in re.finditer(
        r"(?:export )?const \w+: Route = \{[^}]*?id:\s*['\"]([^'\"]+)['\"]",
        ts,
        re.DOTALL,
    ):
        rid = m.group(1)
        block = ts[m.start() : m.start() + 12000]
        dk = re.search(r"distanceKm:\s*([\d.]+)", block)
        if not dk:
            continue
        declared = float(dk.group(1))
        cm = re.search(r"coordinates\s*:\s*\[", block)
        if not cm:
            continue
        start = m.start() + cm.end() - 1
        depth, end = 0, start
        for i, ch in enumerate(ts[start:], start):
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        coord_block = ts[start : end + 1]
        coords = [
            {"lat": float(lat), "lng": float(lng)}
            for lat, lng in re.findall(r"lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)", coord_block)
        ]
        if coords:
            routes.append({"id": rid, "declared_km": declared, "coords": coords})
    return routes


def backtrack_count(coords: list[dict]) -> int:
    n = 0
    for i in range(2, len(coords)):
        a, b, c = coords[i - 2], coords[i - 1], coords[i]
        v1 = (b["lat"] - a["lat"], b["lng"] - a["lng"])
        v2 = (c["lat"] - b["lat"], c["lng"] - b["lng"])
        if v1[0] * v2[0] + v1[1] * v2[1] < 0 and dist_m(a, c) < 50:
            n += 1
    return n


def audit_route(r: dict) -> dict:
    coords = r["coords"]
    path_km = sum(dist_m(coords[i - 1], coords[i]) for i in range(1, len(coords))) / 1000
    declared = r["declared_km"]
    delta = abs(path_km - declared) / declared if declared else 0
    bt = backtrack_count(coords)
    status = "OK"
    issues = []
    if delta > 0.15:
        status = "WARN"
        issues.append(f"path {path_km:.1f} vs declared {declared:.1f} km ({delta*100:.0f}% off)")
    if bt > 3:
        status = "WARN"
        issues.append(f"{bt} micro-backtracks")
    if len(coords) > 900:
        status = "WARN"
        issues.append(f"{len(coords)} points (heavy)")
    if len(coords) < 5:
        status = "WARN"
        issues.append(f"only {len(coords)} points")
    segs = [dist_m(coords[i - 1], coords[i]) for i in range(1, len(coords))]
    max_seg = max(segs) if segs else 0
    if max_seg > 80:
        status = "WARN"
        issues.append(f"max segment {max_seg:.0f}m (lines cut across map)")
    return {
        "id": r["id"],
        "status": status,
        "path_km": round(path_km, 1),
        "declared_km": declared,
        "points": len(coords),
        "backtracks": bt,
        "issues": issues,
    }


def main():
    all_routes: list[dict] = []
    for f in sorted(ROUTES_DIR.glob("*.ts")):
        all_routes.extend(parse_routes(f.read_text(encoding="utf-8")))

    print(f"Auditing {len(all_routes)} routes\n")
    ok = warn = 0
    for r in sorted((audit_route(x) for x in all_routes), key=lambda x: x["id"]):
        icon = "✓" if r["status"] == "OK" else "⚠"
        line = f"{icon} {r['id']}: {r['path_km']} km path, {r['declared_km']} km declared, {r['points']} pts"
        if r["issues"]:
            line += " — " + "; ".join(r["issues"])
        print(line)
        ok += r["status"] == "OK"
        warn += r["status"] == "WARN"

    print(f"\n{ok} OK, {warn} WARN")
    sys.exit(1 if warn else 0)


if __name__ == "__main__":
    main()
