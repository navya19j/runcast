"""
RunCast Audio Generator
-----------------------
Reads all POI scripts from the route data and generates MP3 files via ElevenLabs.

Usage:
    pip install -r requirements.txt
    export ELEVENLABS_API_KEY=your_key_here
    python generate_audio.py --route sf_embarcadero --mode all

Voice mapping per mode:
  history    → Adam   (warm, authoritative male)
  food       → Bella  (enthusiastic, warm female)
  sightseeing→ Josh   (energetic, excited male)
  local      → Elli   (conspiratorial, intimate female)
"""

import os
import sys
import json
import argparse
import re
from pathlib import Path

try:
    from elevenlabs.client import ElevenLabs
    from elevenlabs import VoiceSettings
except ImportError:
    print("Install dependencies: pip install -r requirements.txt")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")

# ElevenLabs voice IDs (these are real pre-made voices)
VOICE_IDS: dict[str, str] = {
    "history":     "pNInz6obpgDQGcFmaJgB",  # Adam — warm, authoritative
    "food":        "EXAVITQu4vr4xnSDxMaL",  # Bella — warm, enthusiastic
    "sightseeing": "TxGEqnHWrfWFTfGW9XjX",  # Josh — energetic
    "local":       "MF3mGyEYCl7XYWbV9V6O",  # Elli — intimate, conversational
}

# Voice settings per mode — lower stability = more expressive
VOICE_SETTINGS: dict[str, VoiceSettings] = {
    "history":     VoiceSettings(stability=0.40, similarity_boost=0.80, style=0.60, use_speaker_boost=True),
    "food":        VoiceSettings(stability=0.30, similarity_boost=0.80, style=0.75, use_speaker_boost=True),
    "sightseeing": VoiceSettings(stability=0.25, similarity_boost=0.80, style=0.80, use_speaker_boost=True),
    "local":       VoiceSettings(stability=0.35, similarity_boost=0.80, style=0.70, use_speaker_boost=True),
}

# ---------------------------------------------------------------------------
# Route data — mirrored from TypeScript for Python processing
# ---------------------------------------------------------------------------

ROUTES = {
    "sf_embarcadero": {
        "pois": [
            {
                "id": "bay_bridge",
                "name": "Bay Bridge",
                "clips": {
                    "history": {
                        "script": "[warm, building energy] You're running under the Bay Bridge. It opened in November 1936 — six months before the Golden Gate. It's longer, carries more traffic, and for decades got almost none of the recognition. [conspiratorial] Sound familiar? San Francisco has always been complicated about this bridge. [brief pause] It's worth looking up right now.",
                        "audioFile": "sf_embarcadero/bay_bridge_history.mp3",
                    },
                    "sightseeing": {
                        "script": "[excited] Look up. That white light installation on the bridge — that's Bay Lights. Twenty-five thousand LEDs, two miles across the western span. [warm] The artist spent two years programming it. At night, running this exact spot, it's something else. Keep going — the Ferry Building is ahead.",
                        "audioFile": "sf_embarcadero/bay_bridge_sightseeing.mp3",
                    },
                },
            },
            {
                "id": "ferry_building",
                "name": "Ferry Building",
                "clips": {
                    "history": {
                        "script": "[reverent] The Ferry Building survived the 1906 earthquake when most of San Francisco was rubble. Then for fifty years a highway ran in front of it, blocking the waterfront entirely. [building] That highway came down in 1991 — torn out after the Loma Prieta earthquake. The building you're running past was restored in 2003. [warm] Cities can heal themselves. San Francisco keeps proving it.",
                        "audioFile": "sf_embarcadero/ferry_building_history.mp3",
                    },
                    "food": {
                        "script": "[enthusiastic, warm] Right there — Acme Bread, Blue Bottle Coffee, Cowgirl Creamery, Hog Island Oyster. [conspiratorial] The Saturday farmers market sets up outside at eight in the morning. You might be running past the best breakfast in San Francisco right now and can't stop. [amused] Remember this spot.",
                        "audioFile": "sf_embarcadero/ferry_building_food.mp3",
                    },
                    "sightseeing": {
                        "script": "[calm, expansive] Look across the bay. That's Oakland and Berkeley. The hills behind them. On a clear morning you can see Mount Diablo — fifty miles east. [pause] You're running through the middle of the most beautiful bay in California. Don't rush this stretch.",
                        "audioFile": "sf_embarcadero/ferry_building_sightseeing.mp3",
                    },
                },
            },
            {
                "id": "pier_14",
                "name": "Pier 14",
                "clips": {
                    "sightseeing": {
                        "script": "[urgent, excited] Slow down for five seconds at this pier. No barriers — just water and open sky in every direction. Bay Bridge to your right. Bay to your left. Open water straight ahead. [soft] This is the best view on the entire run. You've earned a look.",
                        "audioFile": "sf_embarcadero/pier_14_sightseeing.mp3",
                    },
                    "local": {
                        "script": "[warm, conspiratorial] Local runners meet here Saturday mornings. Seven a.m., before the tourists arrive. The Embarcadero at dawn is a completely different city than what you'll see in three hours. [pause] You chose the right time.",
                        "audioFile": "sf_embarcadero/pier_14_local.mp3",
                    },
                },
            },
            {
                "id": "exploratorium",
                "name": "Exploratorium",
                "clips": {
                    "history": {
                        "script": "[thoughtful] The Exploratorium was founded in 1969 by Frank Oppenheimer — younger brother of Robert, the atomic bomb physicist. [building] Frank was blacklisted during McCarthy's era. Couldn't get a university job anywhere. [warm] So he built one of the best science museums in the world instead. Sometimes being forced out is what creates something genuinely new.",
                        "audioFile": "sf_embarcadero/exploratorium_history.mp3",
                    },
                },
            },
            {
                "id": "pier_39_sea_lions",
                "name": "Pier 39 — Sea Lions",
                "clips": {
                    "history": {
                        "script": "[amused, warm] After the 1989 Loma Prieta earthquake, California sea lions started hauling out on the docks here. The marina tried to remove them. Wildlife agencies got involved. [pause, then building] The sea lions won. There are usually three to nine hundred of them at any time. [amused] The noise you're about to hear? That's them claiming their territory. Respect it.",
                        "audioFile": "sf_embarcadero/sea_lions_history.mp3",
                    },
                    "sightseeing": {
                        "script": "[excited] You're at Pier 39. Look left — Alcatraz sitting in the middle of the bay, a mile and a quarter out. Angel Island behind it. Marin Headlands beyond that. [warm] You've covered about four kilometers. Fisherman's Wharf is two minutes ahead.",
                        "audioFile": "sf_embarcadero/sea_lions_sightseeing.mp3",
                    },
                },
            },
            {
                "id": "fishermans_wharf",
                "name": "Fisherman's Wharf",
                "clips": {
                    "history": {
                        "script": "[warm, storytelling] Fisherman's Wharf was built by Italian immigrants — mostly from Genoa and Sicily — who arrived in the 1850s. Not to mine gold. To fish. [pause] The Dungeness crab boats still go out from here before dawn. It's more working waterfront than it looks under all the tourists.",
                        "audioFile": "sf_embarcadero/fishermans_wharf_history.mp3",
                    },
                    "food": {
                        "script": "[warm, enthusiastic] Boudin Sourdough has been baking with the same starter culture since 1849. [conspiratorial] The starter survived the 1906 earthquake — they carried it out in buckets as the city burned. [amused] The bread is genuinely, unreasonably good. Worth the stop after your run.",
                        "audioFile": "sf_embarcadero/fishermans_wharf_food.mp3",
                    },
                },
            },
            {
                "id": "aquatic_park",
                "name": "Aquatic Park",
                "clips": {
                    "sightseeing": {
                        "script": "[warm, satisfied] Aquatic Park. The small beach ahead is one of the only safe swimming spots in the entire bay — cold, but locals swim here year-round. [building] You've covered about five kilometers. [energetic] Now we turn inland, cut through North Beach, and bring it home. The hardest part is behind you.",
                        "audioFile": "sf_embarcadero/aquatic_park_sightseeing.mp3",
                    },
                    "local": {
                        "script": "[conspiratorial, warm] The Dolphin Club and South End Rowing Club have their boathouses right here. Founded in the 1870s. Members swim in the bay every morning regardless of temperature. [amused] San Franciscans have a particular relationship with discomfort. They're proud of it.",
                        "audioFile": "sf_embarcadero/aquatic_park_local.mp3",
                    },
                },
            },
            {
                "id": "north_beach",
                "name": "North Beach",
                "clips": {
                    "history": {
                        "script": "[warm, storytelling] You're running through North Beach — San Francisco's Italian neighborhood, and the birthplace of the Beat Generation. Kerouac, Ginsberg, Ferlinghetti. City Lights bookstore is two blocks west — still open, still independent, still carrying the books they were banned for selling in 1956. [pause] Some cities remember who they are.",
                        "audioFile": "sf_embarcadero/north_beach_history.mp3",
                    },
                    "food": {
                        "script": "[enthusiastic] You're in the middle of the best Italian neighborhood on the West Coast. [warm] Caffe Trieste on Vallejo — oldest espresso bar in SF, opened 1956. Francis Ford Coppola wrote parts of The Godfather there. [amused] You're almost back. One kilometer left. Coffee is close.",
                        "audioFile": "sf_embarcadero/north_beach_food.mp3",
                    },
                },
            },
            {
                "id": "finish",
                "name": "Rincon Park — Finish",
                "clips": {
                    "sightseeing": {
                        "script": "[warm, satisfied, building to finish] You're almost back. Rincon Park ahead. [pause] You just ran the Embarcadero — Bay Bridge to Fisherman's Wharf and back. About eight kilometers of the best running in San Francisco. [warm] The Bay Bridge that never gets enough credit? You ran under it. Twice. [energetic] Bring it home.",
                        "audioFile": "sf_embarcadero/finish_sightseeing.mp3",
                    },
                    "history": {
                        "script": "[warm, reflective] Coming back to where you started — Rincon Park. In 1906, this entire area was rubble. The earthquake and fire destroyed everything from here to Market Street. [building] What you just ran through was rebuilt from nothing in four years. [satisfied] San Francisco has always known how to come back.",
                        "audioFile": "sf_embarcadero/finish_history.mp3",
                    },
                },
            },
        ]
    }
}


def clean_script(script: str) -> str:
    """Remove stage direction brackets for cleaner TTS input on some voices."""
    # ElevenLabs newer models respond to [emotion] tags — keep them
    # but strip any double spaces
    return re.sub(r" {2,}", " ", script).strip()


def generate_clip(client: ElevenLabs, script: str, mode: str, output_path: Path) -> bool:
    """Generate a single audio clip. Returns True on success."""
    if output_path.exists():
        print(f"  ✓ Already exists: {output_path.name}")
        return True

    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        print(f"  ⏳ Generating: {output_path.name}")
        audio = client.text_to_speech.convert(
            voice_id=VOICE_IDS[mode],
            text=clean_script(script),
            model_id="eleven_multilingual_v2",
            voice_settings=VOICE_SETTINGS[mode],
            output_format="mp3_44100_128",
        )
        with open(output_path, "wb") as f:
            for chunk in audio:
                f.write(chunk)
        print(f"  ✅ Done: {output_path.name}")
        return True
    except Exception as e:
        print(f"  ❌ Failed: {output_path.name} — {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate RunCast audio clips")
    parser.add_argument("--route", default="sf_embarcadero", choices=list(ROUTES.keys()))
    parser.add_argument("--mode", default="all", choices=["all", "history", "food", "sightseeing", "local"])
    parser.add_argument("--dry-run", action="store_true", help="Print what would be generated without calling the API")
    args = parser.parse_args()

    if not ELEVENLABS_API_KEY and not args.dry_run:
        print("Error: ELEVENLABS_API_KEY environment variable not set.")
        print("  export ELEVENLABS_API_KEY=your_key_here")
        sys.exit(1)

    client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if not args.dry_run else None
    assets_dir = Path(__file__).parent.parent / "assets" / "audio"

    route_data = ROUTES[args.route]
    modes_to_generate = list(VOICE_IDS.keys()) if args.mode == "all" else [args.mode]

    total = 0
    generated = 0

    for poi in route_data["pois"]:
        for mode, clip in poi["clips"].items():
            if mode not in modes_to_generate:
                continue
            total += 1
            output_path = assets_dir / clip["audioFile"]

            if args.dry_run:
                print(f"[dry-run] Would generate: {clip['audioFile']} (voice: {mode})")
                print(f"  Script preview: {clip['script'][:80]}...")
                continue

            success = generate_clip(client, clip["script"], mode, output_path)
            if success:
                generated += 1

    if not args.dry_run:
        print(f"\n{'='*50}")
        print(f"Generated {generated}/{total} clips for route: {args.route}")
        if generated < total:
            print("Re-run to retry failed clips.")

if __name__ == "__main__":
    main()
