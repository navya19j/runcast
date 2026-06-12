#!/usr/bin/env python3
"""Add 1-2 grounded POIs to the thin (1-POI) routes; place on path; reuse audio dir."""
import re, math
from pathlib import Path
RD = Path(__file__).parent.parent / "src" / "data" / "routes"

def hav(a,b):
    R=6371000;la1,lo1,la2,lo2=map(math.radians,(a[0],a[1],b[0],b[1]))
    return 2*R*math.asin(math.sqrt(math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2))
def fa(ts,key,start):
    km=re.search(rf"\b{key}\s*:",ts[start:]);o=start+km.end()+ts[start+km.end():].index("[");d=0
    for i in range(o,len(ts)):
        if ts[i]=="[":d+=1
        elif ts[i]=="]":
            d-=1
            if d==0:return o,i
def words(s): return len(re.findall(r"\w+",s))
def ts_str(s): return '"'+s.replace('"','\\"')+'"'

# rid -> audio_dir, [ (poi_id, name, lat, lng, {mode: script}) ]
ADD = {
 "sf_ocean_beach": ("sf_ocean_beach", [
   ("great_walkway","The Great Walkway",37.7566,-122.5093,{"local":"[warm] The road beside you — the old Great Highway — is now the Great Walkway. [pause] San Franciscans voted in 2024 to make this oceanfront stretch permanently car-free, turning four lanes of traffic into one of the largest car-free spaces in the country. [amused] Runners, cyclists, skaters, kids — with the whole Pacific as the backdrop."}),
   ("ocean_beach_north","Ocean Beach North",37.7732,-122.5108,{"sightseeing":"[energetic] The north end, below the old Cliff House and the ruins of the Sutro Baths. [pause] Ocean Beach runs more than three miles — the city's longest — straight into serious Pacific swells. There are almost always surfers out in the lineup, wetsuited against the cold."}),
 ]),
 "sf_bernal_heights": ("sf_bernal", [
   ("bernal_views","Bernal Summit Views",37.74232,-122.41207,{"sightseeing":"[triumphant] A full 360 from up here — downtown's towers, the Bay, Sutro Tower, Twin Peaks, the hills beyond. [pause] One of the best free viewpoints in all of San Francisco, and you ran up to earn every degree of it."}),
   ("bernal_local","Bernal Mountain",37.74228,-122.41229,{"local":"[warm, amused] Locals call this Bernal Mountain, and it belongs to the dogs — off-leash, all day. [pause] At dawn and dusk the summit fills with neighbours and runners, and there's a famous unofficial rope swing people keep rebuilding every time the city takes it down."}),
 ]),
 "mumbai_shivaji_park": ("mumbai_shivaji", [
   ("shivaji_statue","Shivaji Statue & Cricket Nurseries",19.02829,72.83956,{"history":"[warm, storyteller] This maidan is the cradle of Indian cricket. [pause] On these pitches the coaching nurseries trained Sachin Tendulkar, Sunil Gavaskar, and generations of greats. It's named for Chhatrapati Shivaji Maharaj, whose statue presides over it — and Dadar around you is the beating heart of Marathi Mumbai."}),
   ("shivaji_katta","The Morning Maidan",19.02600,72.83661,{"local":"[warm] At dawn the whole maidan is alive — laughter clubs, walking groups, kids at cricket coaching, old-timers on the kattas. [conspiratorial] This is no tourist park. It's where Dadar actually lives, every single morning."}),
 ]),
 "mumbai_priyadarshini_park": ("mumbai_priyadarshini", [
   ("pdp_seafront","Malabar Hill Seafront",18.95837,72.79928,{"sightseeing":"[warm] Priyadarshini Park sits right on the Malabar Hill seafront, the Arabian Sea breaking on the rocks just below. [pause] A rare pocket of green-and-blue calm in one of Mumbai's most exclusive neighbourhoods — a soft track, a sports complex, and an endless sea horizon."}),
 ]),
 "mumbai_rajiv_gandhi_joggers": ("mumbai_rajiv_gandhi_joggers", [
   ("rg_garden","Garden Loop",19.07951,72.99190,{"sightseeing":"[warm] The loop winds through landscaped gardens — manicured lawns, shade trees, and the planned calm Navi Mumbai was built for. [pause] The kind of green breathing space the crowded island city across the creek rarely manages."}),
 ]),
}

def near(coords,la,ln): return min(coords,key=lambda c:hav(c,(la,ln)))

for rid,(adir,pois) in ADD.items():
    f=next(p for p in RD.glob("*.ts") if f"id: '{rid}'" in p.read_text())
    ts=f.read_text(); i=ts.find(f"id: '{rid}'")
    cs,ce=fa(ts,"coordinates",i); coords=[(float(a),float(b)) for a,b in re.findall(r"lat:\s*([\d.\-]+),\s*lng:\s*([\d.\-]+)",ts[cs:ce])]
    ps,pe=fa(ts,"pois",i)
    blocks=[]
    for pid,name,la,ln,clips in pois:
        if f"id: '{pid}'" in ts[ps:pe]: continue
        loc=near(coords,la,ln)
        cl=[]
        for mode,script in clips.items():
            cl.append(f"        {mode}: {{\n          script:\n            {ts_str(script)},\n          audioFile: '{adir}/{pid}_{mode}.mp3',\n          durationSec: {max(15,round(words(script)/2.5))},\n        }},")
        blocks.append("    {\n"+f"      id: '{pid}',\n      name: {ts_str(name)},\n      location: {{ lat: {loc[0]:.6f}, lng: {loc[1]:.6f} }},\n      triggerDistanceM: 60,\n      clips: {{\n"+"\n".join(cl)+"\n      },\n    },")
    if not blocks:
        print(f"· {rid}: nothing to add"); continue
    last=ts.rfind("},",ps,pe)+2
    ts=ts[:last]+"\n"+"\n".join(blocks)+ts[last:]
    f.write_text(ts)
    print(f"✓ {rid}: +{len(blocks)} POIs")
