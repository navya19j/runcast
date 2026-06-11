#!/usr/bin/env python3
"""Build Route objects for newly-added loved routes and APPEND to expansion.ts
(does not regenerate the existing routes). Geometry from gpx/<id>.gpx; POIs+meta authored."""
import json, math, re, ssl, urllib.request
from pathlib import Path
ROOT=Path(__file__).parent.parent
GPX=ROOT/"scripts"/"routes_raw"/"gpx"; OUT=ROOT/"src"/"data"/"routes"/"expansion.ts"
_ssl=ssl.create_default_context(); _ssl.check_hostname=False; _ssl.verify_mode=ssl.CERT_NONE

def hav(a,b):
    R=6371000;la1,lo1,la2,lo2=map(math.radians,(a[0],a[1],b[0],b[1]))
    return 2*R*math.asin(math.sqrt(math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2))
def read_gpx(rid): return [(float(a),float(b)) for a,b in re.findall(r'lat="([\d.\-]+)" lon="([\d.\-]+)"',(GPX/f"{rid}.gpx").read_text())]
def densify(pts,step=20):
    out=[pts[0]]
    for i in range(1,len(pts)):
        a,b=pts[i-1],pts[i];d=hav(a,b);n=max(1,int(d/step))
        for j in range(1,n+1):
            t=j/n;out.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
    return out
def elev(pts):
    s=[pts[round(i*(len(pts)-1)/39)] for i in range(40)] if len(pts)>40 else pts
    try:
        e=json.load(urllib.request.urlopen(f"https://api.open-meteo.com/v1/elevation?latitude={','.join(f'{p[0]:.5f}' for p in s)}&longitude={','.join(f'{p[1]:.5f}' for p in s)}",timeout=30,context=_ssl))["elevation"]
        return round(sum(max(0,e[i]-e[i-1]) for i in range(1,len(e)) if e[i]-e[i-1]>0.5))
    except: return 0
def words(s): return len(re.findall(r"\w+",s))
def ts_str(s): return '"'+s.replace("\\","\\\\").replace('"','\\"')+'"'
def near(pts,la,ln): return min(pts,key=lambda c:hav(c,(la,ln)))

CONTENT={
 "sf_lake_merced":{"const":"SF_LAKE_MERCED","oab":False,"city":"San Francisco","name":"Lake Merced Loop",
  "desc":"A flat 7 km loop around a freshwater lake on the city's quiet southwest edge — the local training favourite. No tourists, no hills, just a smooth path, rowers on the water, and Harding Park's cypress-lined fairways alongside.",
  "meta":{"surface":"paved path + sidewalk","shade":"partial","gradientCharacter":"flat — the city's flattest long loop","bestTime":"any time; gorgeous at sunset","soloFemaleSafe":True,"headphonesSafe":True,"whoItsFor":"all levels, tempo + long runs","neighbourhoodVibe":"local — run clubs and crew teams own it","landmarks":["Lake Merced","Harding Park","Boathouse"],"runClubUsage":["West Valley Track Club","Impala Racing Team long runs"]},
  "pois":[
   {"id":"boathouse","name":"Lake Merced Boathouse","lat":37.7266,"lng":-122.5021,"clips":{
     "history":"[warm] Lake Merced is a freshwater lake — rare for a coastal city — and it was San Francisco's original drinking-water reservoir back in the 1800s, before the city reached out to the Sierra. [pause] Today it's all recreation: rowing crews slicing across at dawn, anglers after stocked trout, and runners like you doing laps on the flattest long loop in town.",
     "local":"[conspiratorial] This is where the city's serious runners come to train — no hills, no traffic lights, no tourists. [pause] You'll see the same crews and track clubs here every weekend morning, grinding out tempo loops. It's San Francisco's open secret for actually getting fit."}},
   {"id":"harding_park","name":"Harding Park","lat":37.7245,"lng":-122.4985,"clips":{
     "sightseeing":"[energetic] Those manicured fairways and tall cypress trees across the water are Harding Park — TPC Harding Park, a championship public golf course. [pause] In 2020 it hosted the PGA Championship, one of golf's majors, right here on the lake shore. You're running the perimeter of a major-championship venue."}},
   {"id":"lm_southwest","name":"Southwest Shore","lat":37.7210,"lng":-122.5010,"clips":{
     "sightseeing":"[warm] The far side of the loop opens up — water on one side, the green of the golf course and Fort Funston's bluffs beyond. [pause] On a clear evening the light comes low across the lake and the whole place glows. This stretch is why locals keep coming back."}},
  ]},
 "mumbai_bandstand":{"const":"MUMBAI_BANDSTAND","oab":True,"city":"Mumbai","name":"Bandstand Promenade",
  "desc":"Bandra's iconic seafront promenade — a short, scenic out-and-back along the rocks of the Arabian Sea, past Bollywood mansions and a sunset crowd. Mumbai's most-run stretch by sheer numbers.",
  "meta":{"surface":"paved promenade","shade":"none","gradientCharacter":"flat","bestTime":"early morning or sunset","monsoonSafe":True,"soloFemaleSafe":True,"headphonesSafe":True,"whoItsFor":"all levels, easy runs","neighbourhoodVibe":"Bandra at its most social — couples, families, fitness crowd","landmarks":["Bandstand Promenade","Mannat","Taj Lands End"],"runClubUsage":["Bandra running groups"]},
  "pois":[
   {"id":"bandstand_amphi","name":"Bandstand Amphitheatre","lat":37.0,"lng":72.0,"_ll":(19.0543,72.8233),"clips":{
     "local":"[warm] Welcome to Bandstand — by the numbers, the most-run stretch in all of Mumbai, with thousands of people every single day. [pause] Built out on reclaimed rock along the sea, the promenade and its little amphitheatre fill every evening: walkers, couples, fitness boot-camps, and kids on the rocks watching the waves. This is Bandra's living room.",
     "sightseeing":"[energetic] The Arabian Sea is right there over the rocks, and on a clear day you can see the Bandra-Worli Sea Link sweeping south. [pause] Sunset here is a Mumbai institution — the sky goes orange and the whole promenade stops to watch."}},
   {"id":"mannat","name":"Mannat","lat":37.0,"lng":72.0,"_ll":(19.0488,72.8197),"clips":{
     "local":"[conspiratorial] That sea-facing mansion is Mannat — Shah Rukh Khan's home, and probably the most-photographed house in India. [pause] There are almost always fans gathered at the gate hoping for a wave from the balcony. You just ran past Bollywood royalty's front door."}},
  ]},
}

def build(rid,c):
    raw=read_gpx(rid); pts=densify(raw)
    if c["oab"]: pts=pts+pts[-2::-1]
    if len(pts)>700: pts=[pts[round(i*(len(pts)-1)/699)] for i in range(700)]
    km=round(sum(hav(pts[i-1],pts[i]) for i in range(1,len(pts)))/1000,1)
    is_loop=hav(pts[0],pts[-1])<150 and not c["oab"]
    gain=elev(pts); start=pts[0]
    poi_ts=[]
    for p in c["pois"]:
        la,ln=p.get("_ll",(p["lat"],p["lng"])); loc=near(pts,la,ln)
        clips=[]
        for mode,script in p["clips"].items():
            dur=max(15,round(words(script)/2.5))
            clips.append(f"        {mode}: {{\n          script:\n            {ts_str(script)},\n          audioFile: '{rid}/{p['id']}_{mode}.mp3',\n          durationSec: {dur},\n        }},")
        poi_ts.append("    {\n"+f"      id: '{p['id']}',\n      name: {ts_str(p['name'])},\n      location: {{ lat: {loc[0]:.6f}, lng: {loc[1]:.6f} }},\n      triggerDistanceM: 60,\n      clips: {{\n"+"\n".join(clips)+"\n      },\n    },")
    meta=dict(c["meta"]); meta["elevationGainM"]=gain
    if is_loop: meta["loop"]=True
    if c["oab"]: meta["outAndBack"]=True
    ml=[]
    for k,v in meta.items():
        if isinstance(v,bool): ml.append(f"  {k}: {'true' if v else 'false'},")
        elif isinstance(v,(int,float)): ml.append(f"  {k}: {v},")
        elif isinstance(v,list): ml.append(f"  {k}: [{', '.join(ts_str(x) for x in v)}],")
        else: ml.append(f"  {k}: {ts_str(v)},")
    coords=",\n".join(f"    {{ lat: {p[0]:.6f}, lng: {p[1]:.6f} }}" for p in pts)
    return (f"\nexport const {c['const']}: Route = {{\n  id: '{rid}',\n  city: {ts_str(c['city'])},\n  name: {ts_str(c['name'])},\n  description:\n    {ts_str(c['desc'])},\n  distanceKm: {km},\n"+"\n".join(ml)+f"\n  startLocation: {{ lat: {start[0]:.6f}, lng: {start[1]:.6f} }},\n  coordinates: [\n{coords},\n  ],\n  pois: [\n"+"\n".join(poi_ts)+"\n  ],\n}};\n",km,gain,len(pts))

ts=OUT.read_text()
for rid,c in CONTENT.items():
    if f"id: '{rid}'" in ts:
        print(f"· {rid} already in expansion.ts, skipping"); continue
    block,km,gain,n=build(rid,c)
    ts+=block
    print(f"✓ appended {rid}: {n}pts {km}km ↑{gain}m")
OUT.write_text(ts)
