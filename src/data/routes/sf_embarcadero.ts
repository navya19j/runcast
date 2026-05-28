import { Route } from '../types';

// Rincon Hill → Embarcadero waterfront → Fisherman's Wharf → loop back via North Beach
// ~7.8km loop, mostly flat, 100% on the waterfront path or quiet streets
const SF_EMBARCADERO_ROUTE: Route = {
  id: 'sf_embarcadero_loop',
  city: 'San Francisco',
  name: 'The Embarcadero Loop',
  description:
    'San Francisco\'s most iconic waterfront run. Bay Bridge to Fisherman\'s Wharf along the water, loop back through North Beach. Flat, scenic, no red lights for the first 4km.',
  distanceKm: 7.8,
  startLocation: { lat: 37.7878, lng: -122.3882 },

  // Outbound: Rincon Park → Embarcadero waterfront → Fisherman's Wharf → Aquatic Park
  // Return: Aquatic Park → Columbus Ave → North Beach → Battery St → Rincon
  coordinates: [
    // --- Outbound: waterfront path ---
    { lat: 37.7878, lng: -122.3882 }, // Start: Rincon Park
    { lat: 37.7895, lng: -122.3895 }, // Along Embarcadero South
    { lat: 37.7920, lng: -122.3908 }, // Under Bay Bridge approach
    { lat: 37.7938, lng: -122.3920 }, // Piers 1-3 area
    { lat: 37.7955, lng: -122.3934 }, // Ferry Building
    { lat: 37.7972, lng: -122.3954 }, // Pier 7
    { lat: 37.7988, lng: -122.3970 }, // Pier 14
    { lat: 37.8016, lng: -122.3989 }, // Exploratorium / Pier 15
    { lat: 37.8030, lng: -122.4010 }, // Pier 17
    { lat: 37.8052, lng: -122.4038 }, // Pier 23
    { lat: 37.8065, lng: -122.4062 }, // Pier 27
    { lat: 37.8076, lng: -122.4082 }, // Pier 33
    { lat: 37.8087, lng: -122.4098 }, // Pier 39 / Sea Lions
    { lat: 37.8085, lng: -122.4172 }, // Fisherman's Wharf
    { lat: 37.8086, lng: -122.4244 }, // Aquatic Park (turnaround)
    // --- Return: inland via North Beach ---
    { lat: 37.8060, lng: -122.4230 }, // Ghirardelli Square
    { lat: 37.8044, lng: -122.4185 }, // Columbus Ave / Beach
    { lat: 37.8025, lng: -122.4130 }, // Columbus / Chestnut
    { lat: 37.8008, lng: -122.4101 }, // Columbus / Vallejo
    { lat: 37.7985, lng: -122.4012 }, // Broadway / Battery
    { lat: 37.7965, lng: -122.3975 }, // Battery / Sacramento
    { lat: 37.7940, lng: -122.3950 }, // Battery / California
    { lat: 37.7920, lng: -122.3928 }, // Main / Howard
    { lat: 37.7900, lng: -122.3910 }, // Spear / Folsom
    { lat: 37.7878, lng: -122.3882 }, // Back to Rincon Park
  ],

  pois: [
    {
      id: 'bay_bridge',
      name: 'Bay Bridge',
      location: { lat: 37.7920, lng: -122.3908 },
      triggerDistanceM: 200,
      clips: {
        history: {
          script:
            "[warm, building energy] You're running under the Bay Bridge. It opened in November 1936 — six months before the Golden Gate. It's longer, carries more traffic, and for decades got almost none of the recognition. [conspiratorial] Sound familiar? San Francisco has always been complicated about this bridge. [brief pause] It's worth looking up right now.",
          audioFile: 'sf_embarcadero/bay_bridge_history.mp3',
          durationSec: 32,
        },
        sightseeing: {
          script:
            "[excited] Look up. That white light installation on the bridge — that's Bay Lights. Twenty-five thousand LEDs, two miles across the western span. [warm] The artist spent two years programming it. At night, running this exact spot, it's something else. Keep going — the Ferry Building is ahead.",
          audioFile: 'sf_embarcadero/bay_bridge_sightseeing.mp3',
          durationSec: 28,
        },
      },
    },
    {
      id: 'ferry_building',
      name: 'Ferry Building',
      location: { lat: 37.7955, lng: -122.3934 },
      triggerDistanceM: 180,
      clips: {
        history: {
          script:
            "[reverent] The Ferry Building survived the 1906 earthquake when most of San Francisco was rubble. Then for fifty years a highway ran in front of it, blocking the waterfront entirely. [building] That highway came down in 1991 — torn out after the Loma Prieta earthquake. The building you're running past was restored in 2003. [warm] Cities can heal themselves. San Francisco keeps proving it.",
          audioFile: 'sf_embarcadero/ferry_building_history.mp3',
          durationSec: 38,
        },
        food: {
          script:
            "[enthusiastic, warm] Right there — Acme Bread, Blue Bottle Coffee, Cowgirl Creamery, Hog Island Oyster. [conspiratorial] The Saturday farmers market sets up outside at eight in the morning. You might be running past the best breakfast in San Francisco right now and can't stop. [amused] Remember this spot.",
          audioFile: 'sf_embarcadero/ferry_building_food.mp3',
          durationSec: 30,
        },
        sightseeing: {
          script:
            "[calm, expansive] Look across the bay. That's Oakland and Berkeley. The hills behind them. On a clear morning you can see Mount Diablo — fifty miles east. [pause] You're running through the middle of the most beautiful bay in California. Don't rush this stretch.",
          audioFile: 'sf_embarcadero/ferry_building_sightseeing.mp3',
          durationSec: 26,
        },
      },
    },
    {
      id: 'pier_14',
      name: 'Pier 14',
      location: { lat: 37.7988, lng: -122.3970 },
      triggerDistanceM: 150,
      clips: {
        sightseeing: {
          script:
            "[urgent, excited] Slow down for five seconds at this pier. No barriers — just water and open sky in every direction. Bay Bridge to your right. Bay to your left. Open water straight ahead. [soft] This is the best view on the entire run. You've earned a look.",
          audioFile: 'sf_embarcadero/pier_14_sightseeing.mp3',
          durationSec: 24,
        },
        local: {
          script:
            "[warm, conspiratorial] Local runners meet here Saturday mornings. Seven a.m., before the tourists arrive. The Embarcadero at dawn is a completely different city than what you'll see in three hours. [pause] You chose the right time.",
          audioFile: 'sf_embarcadero/pier_14_local.mp3',
          durationSec: 22,
        },
      },
    },
    {
      id: 'exploratorium',
      name: 'Exploratorium',
      location: { lat: 37.8016, lng: -122.3989 },
      triggerDistanceM: 160,
      clips: {
        history: {
          script:
            "[thoughtful] The Exploratorium was founded in 1969 by Frank Oppenheimer — younger brother of Robert, the atomic bomb physicist. [building] Frank was blacklisted during McCarthy's era. Couldn't get a university job anywhere. [warm] So he built one of the best science museums in the world instead. Sometimes being forced out is what creates something genuinely new.",
          audioFile: 'sf_embarcadero/exploratorium_history.mp3',
          durationSec: 34,
        },
      },
    },
    {
      id: 'pier_39_sea_lions',
      name: 'Pier 39 — Sea Lions',
      location: { lat: 37.8087, lng: -122.4098 },
      triggerDistanceM: 200,
      clips: {
        history: {
          script:
            "[amused, warm] After the 1989 Loma Prieta earthquake, California sea lions started hauling out on the docks here. The marina tried to remove them. Wildlife agencies got involved. [pause, then building] The sea lions won. There are usually three to nine hundred of them at any time. [amused] The noise you're about to hear? That's them claiming their territory. Respect it.",
          audioFile: 'sf_embarcadero/sea_lions_history.mp3',
          durationSec: 36,
        },
        sightseeing: {
          script:
            "[excited] You're at Pier 39. Look left — Alcatraz sitting in the middle of the bay, a mile and a quarter out. Angel Island behind it. Marin Headlands beyond that. [warm] You've covered about four kilometers. Fisherman's Wharf is two minutes ahead.",
          audioFile: 'sf_embarcadero/sea_lions_sightseeing.mp3',
          durationSec: 26,
        },
      },
    },
    {
      id: 'fishermans_wharf',
      name: "Fisherman's Wharf",
      location: { lat: 37.8085, lng: -122.4172 },
      triggerDistanceM: 180,
      clips: {
        history: {
          script:
            "[warm, storytelling] Fisherman's Wharf was built by Italian immigrants — mostly from Genoa and Sicily — who arrived in the 1850s. Not to mine gold. To fish. [pause] The Dungeness crab boats still go out from here before dawn. It's more working waterfront than it looks under all the tourists.",
          audioFile: 'sf_embarcadero/fishermans_wharf_history.mp3',
          durationSec: 30,
        },
        food: {
          script:
            "[warm, enthusiastic] Boudin Sourdough has been baking with the same starter culture since 1849. [conspiratorial] The starter survived the 1906 earthquake — they carried it out in buckets as the city burned. [amused] The bread is genuinely, unreasonably good. Worth the stop after your run.",
          audioFile: 'sf_embarcadero/fishermans_wharf_food.mp3',
          durationSec: 28,
        },
      },
    },
    {
      id: 'aquatic_park',
      name: 'Aquatic Park',
      location: { lat: 37.8086, lng: -122.4244 },
      triggerDistanceM: 150,
      clips: {
        sightseeing: {
          script:
            "[warm, satisfied] Aquatic Park. The small beach ahead is one of the only safe swimming spots in the entire bay — cold, but locals swim here year-round. [building] You've covered about five kilometers. [energetic] Now we turn inland, cut through North Beach, and bring it home. The hardest part is behind you.",
          audioFile: 'sf_embarcadero/aquatic_park_sightseeing.mp3',
          durationSec: 32,
        },
        local: {
          script:
            "[conspiratorial, warm] The Dolphin Club and South End Rowing Club have their boathouses right here. Founded in the 1870s. Members swim in the bay every morning regardless of temperature. [amused] San Franciscans have a particular relationship with discomfort. They're proud of it.",
          audioFile: 'sf_embarcadero/aquatic_park_local.mp3',
          durationSec: 28,
        },
      },
    },
    {
      id: 'north_beach',
      name: 'North Beach',
      location: { lat: 37.8025, lng: -122.4130 },
      triggerDistanceM: 160,
      clips: {
        history: {
          script:
            "[warm, storytelling] You're running through North Beach — San Francisco's Italian neighborhood, and the birthplace of the Beat Generation. Kerouac, Ginsberg, Ferlinghetti. City Lights bookstore is two blocks west — still open, still independent, still carrying the books they were banned for selling in 1956. [pause] Some cities remember who they are.",
          audioFile: 'sf_embarcadero/north_beach_history.mp3',
          durationSec: 34,
        },
        food: {
          script:
            "[enthusiastic] You're in the middle of the best Italian neighborhood on the West Coast. [warm] Caffe Trieste on Vallejo — oldest espresso bar in SF, opened 1956. Francis Ford Coppola wrote parts of The Godfather there. [amused] You're almost back. One kilometer left. Coffee is close.",
          audioFile: 'sf_embarcadero/north_beach_food.mp3',
          durationSec: 28,
        },
      },
    },
    {
      id: 'finish',
      name: 'Rincon Park — Finish',
      location: { lat: 37.7890, lng: -122.3900 },
      triggerDistanceM: 150,
      clips: {
        sightseeing: {
          script:
            "[warm, satisfied, building to finish] You're almost back. Rincon Park ahead. [pause] You just ran the Embarcadero — Bay Bridge to Fisherman's Wharf and back. About eight kilometers of the best running in San Francisco. [warm] The Bay Bridge that never gets enough credit? You ran under it. Twice. [energetic] Bring it home.",
          audioFile: 'sf_embarcadero/finish_sightseeing.mp3',
          durationSec: 36,
        },
        history: {
          script:
            "[warm, reflective] Coming back to where you started — Rincon Park. In 1906, this entire area was rubble. The earthquake and fire destroyed everything from here to Market Street. [building] What you just ran through was rebuilt from nothing in four years. [satisfied] San Francisco has always known how to come back.",
          audioFile: 'sf_embarcadero/finish_history.mp3',
          durationSec: 30,
        },
      },
    },
  ],
};

export default SF_EMBARCADERO_ROUTE;
