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
    "mumbai_bandra_soul": {
        "pois": [
            {
                "id": "joggers_park_start",
                "name": "Joggers Park",
                "clips": {
                    "history": {
                        "script": "[warm, conspiratorial] Where you're standing was a garbage dump. [pause] A retired schoolteacher named Sitaram Rane — everyone called him Sir — spent years petitioning the BMC to convert it into a park. They finally agreed in the 1980s. [building] The park opened in 1982. Sir then founded India's first laughing club here — grown adults, gathered at dawn, laughing together on purpose. [warm, amused] It caught on globally. There are thousands of laughing clubs worldwide now. It started here, at what used to be a garbage dump in Bandra.",
                        "audioFile": "mumbai_bandra/joggers_park_history.mp3",
                    },
                    "local": {
                        "script": "[warm] This park sees over two thousand people on a typical weekday morning. [conspiratorial] The real Bandra runs here — not the cafes on Hill Road, not the bars on Carter Road at night. The morning crowd: serious runners doing repeats on the mud track, uncles doing their third round at 55, women in saris power-walking, personal trainers with clients, the laughing club in the corner. [pause] You just moved here. This is where you'll meet your neighbourhood.",
                        "audioFile": "mumbai_bandra/joggers_park_local.mp3",
                    },
                },
            },
            {
                "id": "carter_road_sea",
                "name": "Carter Road — Arabian Sea",
                "clips": {
                    "sightseeing": {
                        "script": "[expansive, calm] Look west. That's the Arabian Sea. [pause] On a clear morning you can see nothing — just water until the horizon curves. Mumbai sits on a peninsula, surrounded on three sides by this same sea. [building] The city of sixteen million people exists because of that water. Trade routes, monsoons, the fishing communities that were here before any of this. [warm] Right now it's early. The sea is still. This is the best version of Mumbai.",
                        "audioFile": "mumbai_bandra/carter_road_sightseeing.mp3",
                    },
                    "local": {
                        "script": "[warm, conspiratorial] Carter Road is being upgraded — new lighting, canopy walkways, a sensory garden. The upgrade plans were actually presented to residents here on a Saturday morning run in early 2025. [amused] Only in Bandra does infrastructure planning happen during people's morning jog. [pause] The promenade gets over two thousand visitors on weekdays. On Sundays — just don't come after 8am.",
                        "audioFile": "mumbai_bandra/carter_road_local.mp3",
                    },
                },
            },
            {
                "id": "chimbai_village",
                "name": "Chimbai Village",
                "clips": {
                    "history": {
                        "script": "[reverent, storytelling] The people you might see mending nets along this stretch are Koli fishermen. [pause] The Kolis have lived on this coast for over two thousand years — long before the Portuguese, the British, the Bollywood stars, the bankers in BKC. [building] Bandra, Mahim, Worli, Dharavi — all Koli fishing settlements. The name Mumbai itself comes from Mumbadevi, the Koli goddess of the sea. [warm] This city belongs to them first. Everything else was built on top.",
                        "audioFile": "mumbai_bandra/chimbai_history.mp3",
                    },
                    "food": {
                        "script": "[warm, enthusiastic] The Koli community makes Bombay Duck — nothing to do with duck, it's a fish. [amused] The name comes from the British, who called the Bombay mail train the 'Bombay Dak.' The fish, transported on the same railway, took the name. [conspiratorial] Dried Bombay Duck with rice and curry is one of the most aggressively flavoured things you'll ever eat. Someone in Bandra will cook it for you eventually. You'll either love it or not.",
                        "audioFile": "mumbai_bandra/chimbai_food.mp3",
                    },
                },
            },
            {
                "id": "bandstand_promenade",
                "name": "Bandstand Promenade",
                "clips": {
                    "sightseeing": {
                        "script": "[warm, building] The promenade opens up here — you can see the Bandra-Worli Sea Link ahead. Five point six kilometres of cable-stayed bridge, opened 2009, cut travel time from Bandra to Worli from 45 minutes to 5. [pause] At night it's lit up white and gold. From where you're running, it frames the view perfectly. [excited] This is the view people mean when they say they love Bandra. You're in it now.",
                        "audioFile": "mumbai_bandra/bandstand_sightseeing.mp3",
                    },
                    "local": {
                        "script": "[conspiratorial, warm] The Bandstand Promenade is where Bandra does its social life outdoors. Evenings especially — young couples, cricket on any flat surface, kids on bikes, teenage boys doing exactly nothing but looking cool. [amused] And on the rocks below, at 6am, people doing yoga while the tide comes in. [pause] You recently moved here. Give yourself three months. This stretch will start to feel like yours.",
                        "audioFile": "mumbai_bandra/bandstand_local.mp3",
                    },
                },
            },
            {
                "id": "mannat",
                "name": "Mannat — Shah Rukh Khan",
                "clips": {
                    "local": {
                        "script": "[warm, amused] The white bungalow on your left — with the nameplate at the gate and the people taking photos even at this hour — that's Mannat. Shah Rukh Khan's home since 2001. [conspiratorial] On his birthday in November, the street outside fills with thousands of fans. He comes to the balcony and waves. In the age of Instagram, people queue for hours. [pause] In Mumbai, Bollywood isn't the film industry — it's the city's emotional infrastructure. Mannat is one of its cathedrals.",
                        "audioFile": "mumbai_bandra/mannat_local.mp3",
                    },
                    "history": {
                        "script": "[warm, storytelling] This stretch of the seafront was colonised by Bollywood in the 1990s as the industry moved from central Mumbai to the western suburbs. Salman Khan lives two kilometres north. Katrina Kaif. Deepika Padukone. [building] Bandra became Bollywood's residential address not by planning but by gravity — one star moved here, then another followed, then the industry followed the stars. [warm] The fishing village and the film industry, side by side on the same promenade. That's Mumbai.",
                        "audioFile": "mumbai_bandra/mannat_history.mp3",
                    },
                },
            },
            {
                "id": "bandra_fort",
                "name": "Bandra Fort — Castella de Aguada",
                "clips": {
                    "history": {
                        "script": "[reverent, building] You've reached Bandra Fort — or what remains of it. The Portuguese built Castella de Aguada here in 1640. [pause] 'Castle of the Water Spring.' It protected the harbour from Dutch attack. The Portuguese held Bandra for nearly 150 years before the British took it in 1774. [building] The walls you're looking at are almost 400 years old. The view they had — the same sea, the same horizon. The Bandra-Worli Sea Link in the distance is 400 years newer. [warm] These walls have seen every version of this city.",
                        "audioFile": "mumbai_bandra/bandra_fort_history.mp3",
                    },
                    "sightseeing": {
                        "script": "[excited, expansive] This is the view. Stop for a moment. [pause] The Sea Link stretching north. The Arabian Sea all the way to the horizon. Bandra below you, the promenade you just ran. [warm] On a clear morning — and mornings are your best bet — you can see the city waking up from here. The fishing boats. The first local trains. The light changing over the water. [satisfied] This is your turnaround point. You've earned it.",
                        "audioFile": "mumbai_bandra/bandra_fort_sightseeing.mp3",
                    },
                    "food": {
                        "script": "[warm, amused] At the base of the fort there are usually vendors — cutting chai in clay cups, bun maska, vada pav. [enthusiastic] Vada pav is Mumbai's soul food — a spiced potato fritter in a bread roll with three chutneys. Thirty rupees. Every Mumbaikar has an opinion about which stall does it best. [conspiratorial] The one near Bandra Fort is perfectly acceptable. After a 5km run at dawn, it's exceptional.",
                        "audioFile": "mumbai_bandra/bandra_fort_food.mp3",
                    },
                },
            },
            {
                "id": "return_sea_link_view",
                "name": "Sea Link — On the Return",
                "clips": {
                    "sightseeing": {
                        "script": "[warm] On your way back, the Sea Link is ahead of you now instead of to the side. [pause] The bridge has eight lanes, can carry 100,000 vehicles a day, and transformed how Mumbai thinks about its geography. Before it, Bandra and Worli were psychologically 45 minutes apart. Now they're the same neighbourhood. [building] Mumbai is always doing this — collapsing distance, connecting what seemed separated. You're running a city that never stops building itself.",
                        "audioFile": "mumbai_bandra/sea_link_sightseeing.mp3",
                    },
                },
            },
            {
                "id": "joggers_park_finish",
                "name": "Back at Joggers Park",
                "clips": {
                    "local": {
                        "script": "[warm, satisfied] You're back. Five kilometres along the Arabian Sea. [pause] This run — Joggers Park to Bandra Fort and back — is what serious Bandra runners do every morning. You now know the route. [building] One thing every newcomer learns: Mumbai rewards the early riser. The city at 6am is a different creature from the city at noon. Quieter, kinder, cooler. [warm] You've just seen the best version of Bandra. Remember where to come back.",
                        "audioFile": "mumbai_bandra/finish_local.mp3",
                    },
                    "history": {
                        "script": "[warm, reflective] Bandra was a Portuguese settlement, then a British suburb, then a working-class neighbourhood, then a Bollywood address, now a tech-finance hub with BKC next door. [pause] It's gone through more identities than most cities. [building] And yet the promenade is still the promenade. The fishermen still mend nets at dawn. The fort is still standing. [warm] Some things in Mumbai are older than all of it.",
                        "audioFile": "mumbai_bandra/finish_history.mp3",
                    },
                },
            },
        ]
    },
    "mumbai_coastal_promenade": {
        "pois": [
            {
                "id": "sea_link_south_tower",
                "name": "Bandra-Worli Sea Link",
                "clips": {
                    "history": {
                        "script": "[building, reverent] The bridge you're standing under took nine years to build and opened in 2009 after one of Mumbai's most fraught infrastructure projects. [pause] Thousands of workers. Multiple contractor disputes. A cost overrun from 1,600 crore to over 16,000 crore. Three workers died in construction accidents. [warm] And then it opened, and Bandra and Worli became neighbours. Mumbai always pays a heavy price for its ambition. The bridge is worth it.",
                        "audioFile": "mumbai_coastal/sea_link_history.mp3",
                    },
                    "sightseeing": {
                        "script": "[excited] Look up. You're at the base of one of Mumbai's cable-stayed towers — 128 metres high. [pause] The bridge carries 100,000 vehicles a day. Eight lanes. At night, the cables are lit and the whole thing reflects on the water. [warm] You're about to run one of the most dramatic openings of any run in India. The promenade south from here — sea on your right, Mumbai skyline on your left. [energetic] Let's go.",
                        "audioFile": "mumbai_coastal/sea_link_sightseeing.mp3",
                    },
                },
            },
            {
                "id": "promenade_itself",
                "name": "The Coastal Road Promenade",
                "clips": {
                    "history": {
                        "script": "[warm, storytelling] What you're running on is reclaimed sea. [pause] Mumbai spent thirteen thousand crore — roughly 1.5 billion dollars — to build the coastal highway alongside you. The promenade is what came with it: 70 hectares of land pulled from the Arabian Sea, turned into public open space. [building] The promenade opened in August 2025 — almost brand new. You're running on something most of this city hasn't discovered yet. [warm] This is the longest promenade in Mumbai. Twice the length of Marine Drive.",
                        "audioFile": "mumbai_coastal/promenade_history.mp3",
                    },
                    "sightseeing": {
                        "script": "[expansive, calm] No traffic lights. No cars. Just the sea to your right and the Mumbai skyline to your left. [pause] On a clear morning the Western Ghats are visible to the east. The Sahyadri mountains — 1,500 metres high — sitting behind the city like a backdrop. [warm] Most people in Mumbai have never seen this view because the coastal highway had no pedestrian access for years. You're seeing it now. At the best time of day.",
                        "audioFile": "mumbai_coastal/promenade_sightseeing.mp3",
                    },
                },
            },
            {
                "id": "worli_village",
                "name": "Worli Village",
                "clips": {
                    "history": {
                        "script": "[reverent, storytelling] Inland from here, behind the glass towers and the five-star hotels, is Worli Village — one of the oldest Koli fishing settlements in Mumbai, predating British colonisation by centuries. [pause] The Kolis here still fish the same waters their ancestors did, though the catch is smaller now and the waters more polluted. [building] Corporate Mumbai and ancient Mumbai exist side by side in a way that most cities have long resolved one way or the other. Mumbai hasn't. [warm] It might be the most honest thing about this city.",
                        "audioFile": "mumbai_coastal/worli_village_history.mp3",
                    },
                    "food": {
                        "script": "[warm, enthusiastic] The Koli community around Worli makes some of the freshest seafood in the city — bought directly off the boats in the early morning. [conspiratorial] The Worli fish market opens around 5am. The prawns coming in right now will be in someone's kitchen by 7am. [amused] The restaurants on Worli Sea Face charge 800 rupees for the same prawn curry you can eat at the market for 80. Both versions are worth knowing.",
                        "audioFile": "mumbai_coastal/worli_village_food.mp3",
                    },
                },
            },
            {
                "id": "haji_ali_view",
                "name": "Haji Ali Dargah — Floating Mosque",
                "clips": {
                    "sightseeing": {
                        "script": "[warm, reverent] Look out to sea — the white structure on the small island is Haji Ali Dargah. A mosque and tomb, built in 1431, sitting on a rock 500 metres offshore. [pause] At low tide there's a narrow causeway and pilgrims walk out to it. At high tide it appears to float. [warm] It's one of the most visited religious sites in Mumbai — Hindu, Muslim, people of every faith come here. [building] That's a particular Mumbai thing. The city has always been crowded enough that the religions had to learn to share space.",
                        "audioFile": "mumbai_coastal/haji_ali_sightseeing.mp3",
                    },
                    "history": {
                        "script": "[storytelling] Haji Ali was a wealthy Muslim merchant from Bukhara — Central Asia — who gave up his wealth and came to Mumbai as a saint. He died in 1431 and was buried here, on this rock. [pause] The British tried to demolish the Dargah for a road project in the 1800s. There was such public resistance — Hindu and Muslim residents together — that they abandoned the plan. [warm] Mumbai has fought for this mosque for 600 years. The mosque is still there.",
                        "audioFile": "mumbai_coastal/haji_ali_history.mp3",
                    },
                },
            },
            {
                "id": "mahalaxmi_racecourse",
                "name": "Mahalaxmi Racecourse",
                "clips": {
                    "history": {
                        "script": "[warm, amused] The vast green space inland from here — that's the Mahalaxmi Racecourse. One of the oldest horse racing venues in Asia, established by the British in 1883. [pause] The racing season runs from November to April. On race days, the grandstands fill, the bookmakers line up, and old Mumbai money comes out. [building] The land is worth tens of thousands of crores in one of the world's most expensive cities, and it remains a horse racing track because nobody has successfully argued it shouldn't be. [warm] Some things in Mumbai survive just through sheer insistence.",
                        "audioFile": "mumbai_coastal/racecourse_history.mp3",
                    },
                    "local": {
                        "script": "[conspiratorial] From 5am to 9am and 4pm to 8pm, the Racecourse opens its 2km mud track to the public for running. Free entry. [warm] It's one of the best running surfaces in Mumbai — proper mud, the horses train on the outer track simultaneously, the grandstands are empty and quiet. [amused] You can run laps on the same track as thoroughbreds that race for crores. Very few cities offer that.",
                        "audioFile": "mumbai_coastal/racecourse_local.mp3",
                    },
                },
            },
        ]
    },
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
    parser.add_argument("--route", default="sf_embarcadero", choices=list(ROUTES.keys()),
                        help="Route to generate audio for. Available: " + ", ".join(ROUTES.keys()))
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
