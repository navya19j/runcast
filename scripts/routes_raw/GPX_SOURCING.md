# GPX Sourcing Guide

Real GPS traces are the gold standard for route geometry — they follow the exact
path a runner actually ran. This guide lists what to search for each route.

## How to add a route (two ways)

### Option A — Strava segment (easiest, fully automated)
1. Find the segment on Strava (browse / search / Segment Explore).
2. Copy the segment URL, e.g. `https://www.strava.com/segments/5581335`
3. **Paste the URL to Claude.** The Strava API keys are already in `.env`, so Claude
   fetches the polyline, decodes it, and writes `gpx/<route_id>.gpx` automatically.

### Option B — Download GPX yourself
- **Strava routes:** open a route → `⋯ → Export GPX`
- **AllTrails:** trail page → `⋯ → Download route → GPX` (best for trails)
- **Komoot / Plotaroute / Garmin Connect:** all have GPX export
- **Trace it manually:** [gpx.studio](https://gpx.studio) — click along the path on
  satellite view, export GPX (~10 min/route, perfectly accurate)
- Save the file as **`scripts/routes_raw/gpx/<route_id>.gpx`** (exact id below)

After adding files, run:
```
python3 scripts/refresh_all_coords.py
```
The pipeline prefers user GPX over everything else (`<route_id>.gpx` beats cache/OSM).
Note: `<route_id>.generated.gpx` files are auto-generated outputs — do NOT overwrite
those; your manual file must be `<route_id>.gpx`.

## Status (real geometry locked in)
- [x] `sf_gg_park_big_lap` — Strava segment 5581335 "Golden Gate Park 10k" (9.94 km)
- [x] `sf_ocean_beach` — Strava segment 5482063 "Ocean Beach 5k" (4.94 km)
- [x] `sf_bernal_heights` — Strava route 18361446 "Bernal Heights" (5.96 km)
- [x] `sf_embarcadero_loop` — Strava route 18424193 "Ballpark to Ferry Building" (5.10 km)
- [x] `sf_crissy_to_baker` — Google Directions, Crissy→Baker out-and-back (10.11 km)

- [x] `sf_lands_end` — Google Directions, Sutro→Legion of Honor (3.38 km)
- [x] `sf_glen_canyon_twin_peaks` — Google Directions, Creeks to Peaks (3.90 km)
- [x] `mumbai_marine_drive` — greatruns/MapMyRun (4.29 km)
- [x] `mumbai_worli_seaface` — greatruns/MapMyRun (2.75 km)
- [x] `mumbai_bandra_soul` — greatruns/MapMyRun "Carter Road" (3.68 km)
- [x] `mumbai_juhu_beach` — Google Directions out-and-back (5.74 km)
- [x] `mumbai_danda_versova` — Google Directions out-and-back (11.43 km)
- [x] `mumbai_powai_lake` — Google Directions loop (9.60 km)
- [x] `mumbai_coastal_promenade` — direct coastal interp, out-and-back (11.39 km)
      (Google can't route this — the new sea-facing promenade isn't in its
      pedestrian network, so it detours to 34 km. Direct interp along coastal
      waypoints is accurate here because the coast is near-straight.)

- [x] `sf_batteries_to_bluffs` — Google Directions, Presidio coastal trail (2.82 km)
- [x] `mumbai_shivaji_park` — perimeter waypoints, loop (2.32 km/lap)
- [x] `mumbai_mahalaxmi_racecourse` — perimeter waypoints, loop (2.23 km/lap)
- [x] `mumbai_priyadarshini_park` — seafront perimeter waypoints, loop (1.14 km/lap)
- [x] `mumbai_bandra_worli_coastal` — direct coastal interp, Bandra waterfront out-and-back (5.77 km)

ALL 19 ROUTES NOW ON REAL GEOMETRY. ✅

NOTE: `sf_bernal_heights` and `sf_embarcadero_loop` use real Strava routes; if you
prefer the shorter summit/waterfront variants, paste those URLs to replace them.

greatruns.com pages that work (they embed MapMyRun): search "greatruns <area>".
Google Directions fails where a path isn't in its pedestrian network (new promenades,
beaches) — falls back to street detours; use direct interp or a real GPX there.

## Tooling (for Claude)
- Strava segment or route → GPX: `python3 scripts/strava_segment_to_gpx.py <url> <route_id>`
- Google walking route → GPX: `python3 scripts/google_directions_to_gpx.py <route_id> "lat,lng" ... [--loop]`
- greatruns.com page → GPX: `python3 scripts/greatruns_to_gpx.py <url> <route_id>`

---

## San Francisco

| Save as | Dist | Search terms | Best site |
|---|---|---|---|
| `sf_gg_park_big_lap.gpx` | 10 km | "Golden Gate Park 10k" / "JFK MLK loop" | Strava ✅ done |
| `sf_ocean_beach.gpx` | 8.4 km | "Ocean Beach Great Highway run" / "Great Walkway Sloat to Lincoln" | Strava |
| `sf_batteries_to_bluffs.gpx` | 2.2 km | "Batteries to Bluffs Trail" / "Baker Beach Coastal Trail Presidio" | AllTrails |
| `sf_crissy_to_baker.gpx` | 8.3 km | "Crissy Field to Baker Beach" / "Presidio Coastal Trail Crissy" | AllTrails / Strava |
| `sf_bernal_heights.gpx` | 1.7 km | "Bernal Heights Park summit loop" | Strava |
| `sf_lands_end.gpx` | 4.6 km | "Lands End Trail" / "Sutro Baths to Legion of Honor" | AllTrails |
| `sf_glen_canyon_twin_peaks.gpx` | 5.4 km | "Glen Canyon Park to Twin Peaks" | AllTrails / Strava |
| `sf_embarcadero_loop.gpx` | 6.4 km | "Embarcadero run Ferry Building" / "Embarcadero waterfront loop" | Strava |

## Mumbai

| Save as | Dist | Search terms | Best site |
|---|---|---|---|
| `mumbai_marine_drive.gpx` | 4.1 km | "Marine Drive Mumbai run" / "Nariman Point to Chowpatty" | Strava |
| `mumbai_worli_seaface.gpx` | 4.0 km | "Worli Seaface run" / "Worli Sea Face promenade" | Strava |
| `mumbai_bandra_worli_coastal.gpx` | 8.9 km | "Bandra to Worli coastal run" / "Worli Sea Link Bandra" | Strava |
| `mumbai_coastal_promenade.gpx` | 7.1 km | "Mumbai Coastal Road promenade run Worli" | Strava |
| `mumbai_bandra_soul.gpx` | 2.7 km | "Carter Road Bandstand Bandra run" / "Bandra Fort Carter Road" | Strava |
| `mumbai_juhu_beach.gpx` | 4.7 km | "Juhu Beach run" / "Juhu Chowpatty beach run" | Strava |
| `mumbai_danda_versova.gpx` | 9.4 km | "Juhu to Versova beach run" / "Danda Versova" | Strava |
| `mumbai_powai_lake.gpx` | 3.8 km | "Powai Lake loop run" / "Hiranandani Powai Lake jog" | Strava |
| `mumbai_shivaji_park.gpx` | 2.4 km | "Shivaji Park Dadar jogging track" | Strava |
| `mumbai_mahalaxmi_racecourse.gpx` | 2.3 km | "Mahalaxmi Racecourse run" / "Mahalaxmi race course jogging" | Strava |
| `mumbai_priyadarshini_park.gpx` | 1.7 km | "Priyadarshini Park Malabar Hill jogging track" | Strava |

## Tips
- **Match the distance** — if a Strava trace reads ~4 km for Marine Drive, it's the right one.
- **Out-and-backs** (Juhu, Worli, Coastal Promenade, Danda–Versova): grab a trace that goes
  out *and* back so the return leg is included.
- **Loops** (Powai, Shivaji, Mahalaxmi, Bernal, GGP, Embarcadero): make sure it closes.
- You don't need all at once — even just the messy ones (Lands End, Marine Drive,
  Worli Seaface) make the biggest difference. The rest keep their current geometry.
