#!/usr/bin/env python3
"""
Fetch a scenic landmark photo for each route from Wikimedia/Wikipedia, download a
web-sized version into assets/images/routes/<route_id>.jpg, and record the license
attribution (Wikimedia requires crediting author + license).

Usage:
    python3 scripts/fetch_route_images.py
"""
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
IMG_DIR = ROOT / "assets" / "images" / "routes"
CREDITS = ROOT / "scripts" / "routes_raw" / "image_credits.json"
TARGET_W = 1000
UA = "runcast/1.0 (route photos; contact navyaj@adobe.com)"
_ssl = ssl.create_default_context()
_ssl.check_hostname = False
_ssl.verify_mode = ssl.CERT_NONE

# route_id -> ordered candidate Wikipedia titles (first with a lead image wins)
ROUTE_TITLES = {
    "sf_gg_park_big_lap":        ["Golden Gate Park"],
    "sf_ocean_beach":            ["Ocean Beach, San Francisco"],
    "sf_batteries_to_bluffs":    ["Baker Beach", "Presidio of San Francisco"],
    "sf_crissy_to_baker":        ["Crissy Field"],
    "sf_bernal_heights":         ["Bernal Heights, San Francisco", "Bernal Heights"],
    "sf_lands_end":              ["Lands End (San Francisco)"],
    "sf_glen_canyon_twin_peaks": ["Twin Peaks (San Francisco)"],
    "sf_embarcadero_loop":       ["The Embarcadero", "Embarcadero (San Francisco)"],
    "mumbai_marine_drive":       ["Marine Drive, Mumbai"],
    "mumbai_powai_lake":         ["Powai Lake", "Powai"],
    "mumbai_shivaji_park":       ["Shivaji Park"],
    "mumbai_worli_seaface":      ["Worli Sea Face", "Worli"],
    "mumbai_priyadarshini_park": ["Priyadarshini Park", "Malabar Hill"],
    "mumbai_bandra_soul":        ["Bandstand, Mumbai", "Bandra Fort", "Bandra"],
    "mumbai_coastal_promenade":  ["Mumbai Coastal Road", "Worli"],
    "mumbai_bandra_worli_coastal": ["Bandra–Worli Sea Link"],
    "mumbai_juhu_beach":         ["Juhu Beach", "Juhu"],
    "mumbai_danda_versova":      ["Versova", "Versova Beach"],
    "mumbai_mahalaxmi_racecourse": ["Mahalakshmi Racecourse", "Mahalaxmi Racecourse", "Mahalaxmi"],
    # expansion routes
    "sf_angel_island":           ["Angel Island (California)"],
    "sf_attpark_vista":          ["Oracle Park", "Golden Gate Bridge"],
    "sf_crissy_fort_point":      ["Fort Point (San Francisco)", "Crissy Field"],
    "sf_bridge_lands_end":       ["Lands End (San Francisco)", "Golden Gate Bridge"],
    "sf_presidio_gg_loop":       ["Presidio of San Francisco"],
    "sf_the_presidio":           ["Presidio of San Francisco"],
    "sf_candlestick_mclaren":    ["John McLaren Park", "Candlestick Point"],
    "mumbai_palm_beach_navi":    ["Palm Beach Road", "Navi Mumbai"],
    "mumbai_rajiv_gandhi_joggers": ["Vashi", "Navi Mumbai"],
}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30, context=_ssl)


def summary(title):
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
    try:
        d = json.load(get(url))
    except Exception:
        return None
    if d.get("type") == "disambiguation":
        return None
    orig = d.get("originalimage", {}).get("source")
    thumb = d.get("thumbnail", {}).get("source")
    return orig or thumb


def thumb_url(src, width=TARGET_W):
    """Turn an upload.wikimedia.org URL into a fixed-width thumbnail URL."""
    if "/thumb/" in src:
        # already a thumb: .../thumb/a/ab/File.jpg/NNNpx-File.jpg
        base = src.rsplit("/", 1)[0]
        fname = base.rsplit("/", 1)[1]
        return f"{base}/{width}px-{fname}"
    m = re.match(r"(https://upload\.wikimedia\.org/wikipedia/commons)/([0-9a-f])/([0-9a-f]{2})/(.+)$", src)
    if not m:
        return src
    host, a, ab, fname = m.groups()
    if not re.search(r"\.(jpg|jpeg|png)$", fname, re.I):
        return src  # svg/gif — use original
    return f"{host}/thumb/{a}/{ab}/{fname}/{width}px-{fname}"


def attribution(src):
    """Fetch artist + license for the Commons file behind an upload URL."""
    fname = urllib.parse.unquote(src.split("/thumb/")[0].rsplit("/", 1)[1] if "/thumb/" in src else src.rsplit("/", 1)[1])
    api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
           f"&iiprop=extmetadata&titles=File:{urllib.parse.quote(fname)}")
    try:
        d = json.load(get(api))
        page = next(iter(d["query"]["pages"].values()))
        ext = page["imageinfo"][0]["extmetadata"]
        artist = re.sub(r"<[^>]+>", "", ext.get("Artist", {}).get("value", "")).strip()
        lic = ext.get("LicenseShortName", {}).get("value", "").strip()
        return f"{artist} / {lic}".strip(" /") or "Wikimedia Commons"
    except Exception:
        return "Wikimedia Commons"


def main():
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    credits = {}
    if CREDITS.exists():
        credits = json.loads(CREDITS.read_text())
    for rid, titles in ROUTE_TITLES.items():
        if (IMG_DIR / f"{rid}.jpg").exists():
            print(f"· {rid}: already have image, skipping")
            continue
        src = None
        for t in titles:
            src = summary(t)
            if src:
                break
            time.sleep(0.3)
        if not src:
            print(f"✗ {rid}: no image found ({titles})")
            continue
        url = thumb_url(src)
        try:
            data = get(url).read()
        except Exception:
            data = get(src).read()  # fall back to original
        (IMG_DIR / f"{rid}.jpg").write_bytes(data)
        credits[rid] = attribution(src)
        print(f"✓ {rid:<30} {len(data)//1024:>4} KB  — {credits[rid][:50]}")
        time.sleep(0.4)

    CREDITS.write_text(json.dumps(credits, indent=2))
    print(f"\nwrote {len(credits)} images to {IMG_DIR.relative_to(ROOT)}")
    print(f"credits → {CREDITS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
