#!/usr/bin/env python3
"""Patch the 3 park routes' coordinates from their (newly pulled) Strava GPX,
snap POIs onto the corrected loop, recompute distance + elevation. Targeted —
does NOT touch other routes."""
import json, math, re, ssl, urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
GPX = ROOT / "scripts" / "routes_raw" / "gpx"
ROUTES_DIR = ROOT / "src" / "data" / "routes"
_ssl = ssl.create_default_context(); _ssl.check_hostname=False; _ssl.verify_mode=ssl.CERT_NONE
PARKS = ["mumbai_shivaji_park", "mumbai_mahalaxmi_racecourse", "mumbai_priyadarshini_park"]


def hav(a,b):
    R=6371000; la1,lo1,la2,lo2=map(math.radians,(a[0],a[1],b[0],b[1]))
    return 2*R*math.asin(math.sqrt(math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2))

def densify(pts, step=15):
    out=[pts[0]]
    for i in range(1,len(pts)):
        a,b=pts[i-1],pts[i]; d=hav(a,b); n=max(1,int(d/step))
        for j in range(1,n+1):
            t=j/n; out.append((a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])))
    return out

def read_gpx(rid):
    txt=(GPX/f"{rid}.gpx").read_text()
    return [(float(a),float(b)) for a,b in re.findall(r'lat="([\d.\-]+)" lon="([\d.\-]+)"',txt)]

def find_array(ts,key,start):
    km=re.search(rf"\b{key}\s*:",ts[start:]); o=start+km.end()+ts[start+km.end():].index("["); d=0
    for i in range(o,len(ts)):
        if ts[i]=="[":d+=1
        elif ts[i]=="]":
            d-=1
            if d==0:return o,i

def elev_gain(pts):
    s=[pts[round(i*(len(pts)-1)/39)] for i in range(40)] if len(pts)>40 else pts
    lat=",".join(f"{p[0]:.6f}" for p in s); lng=",".join(f"{p[1]:.6f}" for p in s)
    try:
        e=json.load(urllib.request.urlopen(f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lng}",timeout=30,context=_ssl))["elevation"]
        return round(sum(max(0,e[i]-e[i-1]) for i in range(1,len(e)) if e[i]-e[i-1]>0.5))
    except Exception:
        return 0

def rfile(rid):
    for f in ROUTES_DIR.glob("*.ts"):
        if f"id: '{rid}'" in f.read_text(): return f

for rid in PARKS:
    pts=densify(read_gpx(rid))
    km=round(sum(hav(pts[i-1],pts[i]) for i in range(1,len(pts)))/1000,1)
    gain=elev_gain(pts)
    f=rfile(rid); ts=f.read_text(); pos=ts.find(f"id: '{rid}'")
    cs,ce=find_array(ts,"coordinates",pos)
    coords="[\n"+",\n".join(f"    {{ lat: {p[0]:.6f}, lng: {p[1]:.6f} }}" for p in pts)+",\n  ]"
    ts=ts[:cs]+coords+ts[ce+1:]
    ts=re.sub(r"(id: '"+rid+r"'[\s\S]{0,1400}?startLocation:\s*)\{[^}]+\}", rf"\g<1>{{ lat: {pts[0][0]:.6f}, lng: {pts[0][1]:.6f} }}", ts, count=1)
    ts=re.sub(r"(id: '"+rid+r"'[\s\S]{0,1400}?distanceKm:\s*)[\d.]+", rf"\g<1>{km}", ts, count=1)
    ts=re.sub(r"(id: '"+rid+r"'[\s\S]{0,1400}?elevationGainM:\s*)\d+", rf"\g<1>{gain}", ts, count=1)
    pos=ts.find(f"id: '{rid}'"); ps,pe=find_array(ts,"pois",pos)
    def snap(m):
        lat,lng=float(m.group(1)),float(m.group(2)); n=min(pts,key=lambda c:hav(c,(lat,lng)))
        return f"location: {{ lat: {n[0]:.6f}, lng: {n[1]:.6f} }}"
    ts=ts[:ps]+re.sub(r"location:\s*\{\s*lat:\s*([\d.\-]+),\s*lng:\s*([\d.\-]+)\s*\}",snap,ts[ps:pe])+ts[pe:]
    f.write_text(ts)
    print(f"✓ {rid}: {len(pts)} pts, {km} km, ↑{gain}m  → {f.name}")
