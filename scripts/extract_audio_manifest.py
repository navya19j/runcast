"""
extract_audio_manifest.py
─────────────────────────
Parses all TypeScript route files and extracts POI audio clip data into a
flat JSON manifest: routes_raw/audio_manifest.json

Schema:
  {
    "clips": {
      "sf_embarcadero/bay_bridge_history.mp3": {
        "route_id":  "sf_embarcadero_loop",
        "poi_id":    "bay_bridge",
        "poi_name":  "Bay Bridge",
        "mode":      "history",
        "script":    "...",
        "audioFile": "sf_embarcadero/bay_bridge_history.mp3"
      },
      ...
    },
    "routes": {
      "sf_embarcadero_loop": ["sf_embarcadero/bay_bridge_history.mp3", ...],
      ...
    }
  }

The flat keying by audioFile path means the same POI appearing in multiple
routes (due to file concatenation during parsing) is de-duplicated naturally.

Usage:
  python3 scripts/extract_audio_manifest.py
"""

import re
import json
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
ROUTES_DIR = REPO_ROOT / "src" / "data" / "routes"
OUT_PATH   = Path(__file__).parent / "routes_raw" / "audio_manifest.json"

MODES = ('history', 'food', 'sightseeing', 'local')


def extract_clips_from_ts(ts_text: str) -> list[dict]:
    """
    Walk through a TypeScript source file and extract every AudioClip entry.
    Returns a flat list of dicts with: route_id, poi_id, poi_name, mode, script, audioFile.
    """
    clips = []

    # ── 1. Find each route block ──────────────────────────────────────────────
    # Match: (export )?const VARNAME: Route = {
    route_starts = list(re.finditer(
        r'(?:export\s+)?const\s+\w+\s*:\s*Route\s*=\s*\{', ts_text
    ))

    for ri, rs in enumerate(route_starts):
        block_start = rs.start()
        block_end   = route_starts[ri + 1].start() if ri + 1 < len(route_starts) else len(ts_text)
        block       = ts_text[block_start:block_end]

        # Extract route id
        id_m = re.search(r"id:\s*'([^']+)'", block[:400]) or \
               re.search(r'id:\s*"([^"]+)"',  block[:400])
        if not id_m:
            continue
        route_id = id_m.group(1)

        # ── 2. Find the pois: [ ... ] section ────────────────────────────────
        pois_m = re.search(r'\bpois\s*:\s*\[', block)
        if not pois_m:
            continue

        # Bracket-count to find the matching ] for pois array
        pois_content_start = pois_m.end()
        depth  = 1
        pos    = pois_content_start
        while pos < len(block) and depth > 0:
            if block[pos] == '[':
                depth += 1
            elif block[pos] == ']':
                depth -= 1
            pos += 1
        pois_section = block[pois_content_start:pos - 1]

        # ── 3. Find each POI object inside the pois array ───────────────────
        # Split on top-level { } boundaries
        poi_objects = _split_top_level_objects(pois_section)

        for poi_obj in poi_objects:
            # Extract poi id and name
            poi_id_m = re.search(r"(?<!\w)id:\s*'([^']+)'", poi_obj) or \
                       re.search(r'(?<!\w)id:\s*"([^"]+)"', poi_obj)
            if not poi_id_m:
                continue
            poi_id = poi_id_m.group(1)

            poi_name_m = re.search(r"name:\s*'([^']+)'", poi_obj) or \
                         re.search(r'name:\s*"([^"]+)"', poi_obj)
            poi_name = poi_name_m.group(1) if poi_name_m else poi_id

            # ── 4. Find clips: { … } ────────────────────────────────────────
            clips_m = re.search(r'\bclips\s*:\s*\{', poi_obj)
            if not clips_m:
                continue

            clips_start = clips_m.end()
            depth2  = 1
            pos2    = clips_start
            while pos2 < len(poi_obj) and depth2 > 0:
                if poi_obj[pos2] == '{':
                    depth2 += 1
                elif poi_obj[pos2] == '}':
                    depth2 -= 1
                pos2 += 1
            clips_section = poi_obj[clips_start:pos2 - 1]

            # ── 5. Extract each mode block ───────────────────────────────────
            for mode in MODES:
                mode_m = re.search(rf'(?<!\w){mode}\s*:\s*\{{', clips_section)
                if not mode_m:
                    continue

                # Bracket-count to extract this mode's object
                mb_start = mode_m.end()
                depth3   = 1
                pos3     = mb_start
                while pos3 < len(clips_section) and depth3 > 0:
                    if clips_section[pos3] == '{':
                        depth3 += 1
                    elif clips_section[pos3] == '}':
                        depth3 -= 1
                    pos3 += 1
                mode_obj = clips_section[mb_start:pos3 - 1]

                # Extract script (handles multi-line string concatenation)
                script = _extract_ts_string_field('script', mode_obj)
                audio  = _extract_ts_string_field('audioFile', mode_obj)

                if script and audio:
                    clips.append({
                        'route_id':  route_id,
                        'poi_id':    poi_id,
                        'poi_name':  poi_name,
                        'mode':      mode,
                        'script':    script,
                        'audioFile': audio,
                    })

    return clips


def _split_top_level_objects(text: str) -> list[str]:
    """Split a string on top-level { } blocks."""
    objects = []
    depth   = 0
    start   = None
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                objects.append(text[start:i + 1])
                start = None
    return objects


def _extract_ts_string_field(field: str, text: str) -> str:
    """
    Extract the string value of a TS object field.
    Handles: field: 'value', field: "value", and field:\n  'part1' +\n  'part2'
    """
    # Match field name followed by colon and optional whitespace/newlines
    m = re.search(rf'\b{re.escape(field)}\s*:\s*', text)
    if not m:
        return ''

    rest = text[m.end():]
    parts = []

    # Collect string parts (handles 'a' + 'b' concatenation)
    i = 0
    while i < len(rest):
        # Skip whitespace and +
        while i < len(rest) and rest[i] in (' ', '\t', '\n', '\r', '+'):
            i += 1

        if i >= len(rest):
            break

        q = rest[i]
        if q not in ('"', "'"):
            break

        i += 1
        part = []
        while i < len(rest):
            ch = rest[i]
            if ch == '\\':
                i += 1
                esc = rest[i] if i < len(rest) else ''
                part.append({'n': '\n', 't': '\t', 'r': '\r'}.get(esc, esc))
            elif ch == q:
                i += 1
                break
            else:
                part.append(ch)
            i += 1
        parts.append(''.join(part))

        # Look for continuation: optional whitespace then + then another string
        j = i
        while j < len(rest) and rest[j] in (' ', '\t', '\n', '\r'):
            j += 1
        if j < len(rest) and rest[j] == '+':
            i = j + 1
            continue
        break

    return ''.join(parts)


def main():
    all_clips: dict[str, dict]           = {}   # audioFile → clip entry
    routes_index: dict[str, list[str]]   = {}   # route_id  → [audioFile, ...]

    ts_files = sorted(ROUTES_DIR.glob('*.ts'))
    print(f"Scanning {len(ts_files)} route file(s) in {ROUTES_DIR}...")

    for ts_file in ts_files:
        text   = ts_file.read_text(encoding='utf-8')
        clips  = extract_clips_from_ts(text)

        file_new = 0
        for clip in clips:
            key = clip['audioFile']
            if key not in all_clips:
                all_clips[key] = clip
                file_new += 1
            route_clips = routes_index.setdefault(clip['route_id'], [])
            if key not in route_clips:
                route_clips.append(key)

        print(f"  {ts_file.name}: {file_new} new clips extracted")

    manifest = {'clips': all_clips, 'routes': routes_index}

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    total_clips = len(all_clips)
    print(f"\n{'='*56}")
    print(f"{'Route':<40} {'Clips':>5}")
    print(f"{'-'*56}")
    for rid, clip_keys in sorted(routes_index.items()):
        print(f"  {rid:<38} {len(clip_keys):>5}")
    print(f"{'─'*56}")
    print(f"  {'TOTAL':<38} {total_clips:>5}")
    print(f"\n✓ Manifest written → {OUT_PATH}")


if __name__ == '__main__':
    main()
