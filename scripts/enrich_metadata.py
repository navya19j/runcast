#!/usr/bin/env python3
"""Enrich the newer routes with the runner-detail metadata fields the originals
already carry. Values researched/grounded (Strava popularity → communityRating;
locations → transit/food/water/lighting). Inserts only fields not already present,
right before each route's `startLocation:`."""
import re
from pathlib import Path
ROUTES_DIR = Path(__file__).parent.parent / "src" / "data" / "routes"

# rid -> {field: value}. bool/int/str/list handled.
META = {
 "sf_angel_island": {"surfaceQuality":"smooth paved perimeter road, well-maintained","bestSeason":"spring–fall (ferry-dependent)","lighting":"none","waterOnRoute":True,"restroomsOnRoute":True,"transitToStart":"Ferry from Pier 41 SF or Tiburon to Ayala Cove","postRunFood":"Cove Cafe at Ayala Cove (seasonal)","localTip":"Check the last-ferry time before you start — miss it and you're stranded overnight.","historicalHook":"The 'Ellis Island of the West' — 500k+ immigrants processed 1910–1940.","communityRating":5},
 "sf_attpark_vista": {"surfaceQuality":"paved promenade + sidewalk, excellent","bestSeason":"year-round; mornings before the wind","lighting":"fully lit","waterOnRoute":True,"restroomsOnRoute":True,"transitToStart":"Muni Metro/Caltrain to Oracle Park; bus 28 back from the bridge","postRunFood":"Ferry Building Marketplace, mid-route","localTip":"It's point-to-point — plan your ride back from the bridge.","historicalHook":"Passes the Ferry Building, once the world's 2nd-busiest transit terminal.","communityRating":5},
 "sf_crissy_fort_point": {"surfaceQuality":"gravel promenade + paved path, good","bestSeason":"year-round; clearest Sep–Nov","lighting":"partial","waterOnRoute":True,"restroomsOnRoute":True,"transitToStart":"PresidiGo shuttle or bus 30 to Crissy Field","postRunFood":"Warming Hut cafe near Fort Point","localTip":"Windiest in the afternoon — go early for calm water and clear bridge views.","historicalHook":"Fort Point: a Civil War brick fort the bridge was built to arch over, not demolish.","communityRating":5},
 "sf_bridge_lands_end": {"surfaceQuality":"mixed trail + paved, some stairs","bestSeason":"year-round; clear afternoons for views","lighting":"none","waterOnRoute":True,"restroomsOnRoute":True,"transitToStart":"Bus 18 to Lands End / 28 to the bridge","postRunFood":"Lands End Lookout cafe","localTip":"Don't run the cliff trail in the dark or fog — footing and visibility get dangerous.","historicalHook":"Sutro Baths: the world's largest indoor pools (1896), now haunting ruins.","communityRating":5},
 "sf_presidio_gg_loop": {"surfaceQuality":"trail + park road, good","bestSeason":"year-round","lighting":"partial","waterOnRoute":True,"restroomsOnRoute":True,"transitToStart":"PresidiGo shuttle (free) from downtown","postRunFood":"Presidio Main Post cafes / Tunnel Tops food trucks","localTip":"The whole forest is planted — windless and quiet even when the coast is blowing.","historicalHook":"A military base from 1776 to 1994 — Spain, Mexico, then the US.","communityRating":4},
 "sf_the_presidio": {"surfaceQuality":"trail + park road, good","bestSeason":"year-round","lighting":"partial","waterOnRoute":True,"restroomsOnRoute":True,"transitToStart":"PresidiGo shuttle (free) from downtown","postRunFood":"Tunnel Tops food trucks, Presidio Main Post","localTip":"Detour to find Goldsworthy's hidden wooden Spire in the forest.","historicalHook":"Tunnel Tops park (2022) is built on the roof of the highway tunnels.","communityRating":4},
 "sf_candlestick_mclaren": {"surfaceQuality":"bay trail + park path, mixed","bestSeason":"year-round; afternoons","lighting":"partial","waterOnRoute":True,"restroomsOnRoute":True,"transitToStart":"Bus 29 to Candlestick Point","postRunFood":"limited on-route — bring your own","localTip":"The city's quietest big run — you'll often have the trail to yourself.","historicalHook":"Candlestick Park hosted the Beatles' last concert (1966); demolished 2015.","communityRating":3},
 "sf_lake_merced": {"surfaceQuality":"paved path + sidewalk, good","bestSeason":"year-round; sunset is best","lighting":"partial","waterOnRoute":True,"restroomsOnRoute":True,"transitToStart":"Muni M-line / bus 18 to Lake Merced","postRunFood":"Boathouse / nearby Sunset District cafes","localTip":"The flattest long loop in SF — ideal for tempo and marathon-pace runs.","historicalHook":"The city's original freshwater reservoir before Hetch Hetchy.","communityRating":4},
 "mumbai_palm_beach_navi": {"surfaceQuality":"wide smooth tarmac + sidewalk, excellent","bestSeason":"Oct–Mar; avoid monsoon","lighting":"fully lit","waterOnRoute":False,"restroomsOnRoute":False,"transitToStart":"Vashi/Nerul stations + auto; or drive","postRunFood":"Palm Beach Road cafes, Seawoods Grand Central mall","localTip":"In winter the nearby NRI/DPS wetlands fill with flamingos — go at dawn.","communityRating":4},
 "mumbai_rajiv_gandhi_joggers": {"surfaceQuality":"jogging track, soft, good","bestSeason":"Oct–Mar; covered if light monsoon","lighting":"fully lit","waterOnRoute":True,"restroomsOnRoute":True,"transitToStart":"Vashi station + short auto","postRunFood":"Vashi sector markets","localTip":"Pure neighbourhood loop — easy on the knees, friendly dawn regulars.","communityRating":3},
 "mumbai_bandstand": {"surfaceQuality":"paved promenade, good","bestSeason":"year-round; monsoon spray is part of the charm","lighting":"fully lit","waterOnRoute":False,"restroomsOnRoute":True,"transitToStart":"Bandra station (W) + 10-min walk/auto","postRunFood":"Hill Road & Carter Road cafes (Candies, Bagel Shop)","localTip":"Sunset is a Mumbai ritual — and the most-run stretch in the city.","historicalHook":"Built on reclaimed sea rock; Shah Rukh Khan's Mannat anchors the strip.","communityRating":5},
}

def fmt(k,v):
    if isinstance(v,bool): return f"  {k}: {'true' if v else 'false'},"
    if isinstance(v,(int,float)): return f"  {k}: {v},"
    if isinstance(v,list): return f"  {k}: [{', '.join(chr(39)+x+chr(39) for x in v)}],"
    return f"  {k}: {chr(39)+v.replace(chr(39), chr(92)+chr(39))+chr(39)},"

def route_block_bounds(ts, rid):
    i = ts.find(f"id: '{rid}'")
    sl = ts.find("startLocation:", i)
    return i, sl

for f in ROUTES_DIR.glob("*.ts"):
    ts = f.read_text(); changed = False
    for rid, fields in META.items():
        if f"id: '{rid}'" not in ts: continue
        i, sl = route_block_bounds(ts, rid)
        block = ts[i:sl]
        ins = [fmt(k,v) for k,v in fields.items() if not re.search(rf"\b{k}:", block)]
        if not ins: continue
        # line start of startLocation
        line_start = ts.rfind("\n", 0, sl) + 1
        ts = ts[:line_start] + "\n".join(ins) + "\n" + ts[line_start:]
        changed = True
        print(f"✓ {rid}: +{len(ins)} fields")
    if changed: f.write_text(ts)
