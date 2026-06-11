#!/usr/bin/env python3
"""Read/write GPX track files — gold-standard route geometry (Strava, Komoot, etc.)."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

GPX_NS = {"gpx": "http://www.topografix.com/GPX/1/1"}


def load_gpx(path: Path) -> list[dict]:
    root = ET.parse(path).getroot()
    coords: list[dict] = []
    for trkpt in root.findall(".//gpx:trkpt", GPX_NS) + root.findall(".//trkpt"):
        lat = trkpt.get("lat")
        lon = trkpt.get("lon")
        if lat is None or lon is None:
            continue
        coords.append({"lat": round(float(lat), 6), "lng": round(float(lon), 6)})
    if not coords:
        for rtept in root.findall(".//gpx:rtept", GPX_NS) + root.findall(".//rtept"):
            lat = rtept.get("lat")
            lon = rtept.get("lon")
            if lat is None or lon is None:
                continue
            coords.append({"lat": round(float(lat), 6), "lng": round(float(lon), 6)})
    return coords


def write_gpx(path: Path, coords: list[dict], name: str = "route") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    gpx = ET.Element(
        "gpx",
        attrib={
            "version": "1.1",
            "creator": "RunCast",
            "xmlns": "http://www.topografix.com/GPX/1/1",
        },
    )
    trk = ET.SubElement(gpx, "trk")
    ET.SubElement(trk, "name").text = name
    seg = ET.SubElement(trk, "trkseg")
    for c in coords:
        ET.SubElement(seg, "trkpt", attrib={"lat": f"{c['lat']:.6f}", "lon": f"{c['lng']:.6f}"})
    ET.ElementTree(gpx).write(path, encoding="utf-8", xml_declaration=True)
