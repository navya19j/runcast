import { Route } from '../types';

/**
 * MUMBAI ROUTE 1: The Bandra Soul
 * ─────────────────────────────────
 * Start: Joggers Park, Carter Road (10-min Uber from Bandra East)
 * Route: Carter Road Promenade → Chimbai Village → Bandstand Promenade
 *        → Mannat → Bandra Fort (and back)
 * Distance: ~5km out-and-back
 * Traffic lights: ZERO — entire route is on dedicated seafront promenades
 * Surface: Paved promenade paths, well-lit
 * Best time: 5:30–7am (sunrise, fishermen returning, city asleep)
 *            or 7–9pm (Sea Link lit up, cool sea breeze, social scene)
 *
 * ROAD CONDITION NOTE (May 2026):
 * Bandra West interior roads have active concretisation works since Oct 2024
 * — broken roads, dug pipelines. The PROMENADES are unaffected.
 * Uber directly to Joggers Park (tell driver "Joggers Park, Carter Road, Bandra")
 * to avoid the mess on St Alexious Rd and BJ Road.
 *
 * BKC running note: BKC has a rubberized jogging track (5am-10pm, well-lit)
 * and is walkable from Bandra East — but it's laps in a park, not a city run.
 */
export const MUMBAI_BANDRA_WATERFRONT: Route = {
  id: 'mumbai_bandra_soul',
  city: 'Mumbai',
  name: 'The Bandra Soul',
  description:
    'Carter Road to Bandra Fort along the Arabian Sea. Portuguese history, Bollywood, ' +
    'ancient fishing villages, and the view every Mumbaikar considers theirs. ' +
    'Zero traffic lights. Uber to Joggers Park — 10 min from Bandra East.',
  distanceKm: 5.0,
  startLocation: { lat: 19.0580, lng: 72.8205 },

  coordinates: [
    // Start: Joggers Park, Carter Road (south end)
    { lat: 19.0580, lng: 72.8205 },
    // Carter Road promenade — run north along the sea
    { lat: 19.0592, lng: 72.8202 },
    { lat: 19.0605, lng: 72.8198 },
    { lat: 19.0620, lng: 72.8193 }, // Carter Road north end
    // Turn south, cut through toward Chimbai Village
    { lat: 19.0600, lng: 72.8180 },
    { lat: 19.0572, lng: 72.8168 }, // Chimbai fishing village
    // Bandstand Promenade begins
    { lat: 19.0545, lng: 72.8172 },
    { lat: 19.0520, lng: 72.8178 },
    { lat: 19.0495, lng: 72.8185 }, // Near Mannat (SRK's bungalow)
    { lat: 19.0470, lng: 72.8198 },
    { lat: 19.0450, lng: 72.8210 }, // Bandra Fort approach
    { lat: 19.0445, lng: 72.8218 }, // Bandra Fort / Castella de Aguada
    // Return same way
    { lat: 19.0450, lng: 72.8210 },
    { lat: 19.0470, lng: 72.8198 },
    { lat: 19.0495, lng: 72.8185 },
    { lat: 19.0520, lng: 72.8178 },
    { lat: 19.0545, lng: 72.8172 },
    { lat: 19.0572, lng: 72.8168 },
    { lat: 19.0600, lng: 72.8180 },
    { lat: 19.0620, lng: 72.8193 },
    { lat: 19.0605, lng: 72.8198 },
    { lat: 19.0592, lng: 72.8202 },
    { lat: 19.0580, lng: 72.8205 }, // Back to Joggers Park
  ],

  pois: [
    {
      id: 'joggers_park_start',
      name: 'Joggers Park',
      location: { lat: 19.0580, lng: 72.8205 },
      triggerDistanceM: 50,
      clips: {
        history: {
          script:
            "[warm, conspiratorial] Where you're standing was a garbage dump. [pause] A retired schoolteacher named Sitaram Rane — everyone called him Sir — spent years petitioning the BMC to convert it into a park. They finally agreed in the 1980s. [building] The park opened in 1982. Sir then founded India's first laughing club here — grown adults, gathered at dawn, laughing together on purpose. [warm, amused] It caught on globally. There are thousands of laughing clubs worldwide now. It started here, at what used to be a garbage dump in Bandra.",
          audioFile: 'mumbai_bandra/joggers_park_history.mp3',
          durationSec: 42,
        },
        local: {
          script:
            "[warm] This park sees over two thousand people on a typical weekday morning. [conspiratorial] The real Bandra runs here — not the cafes on Hill Road, not the bars on Carter Road at night. The morning crowd: serious runners doing repeats on the mud track, uncles doing their third round at 55, women in saris power-walking, personal trainers with clients, the laughing club in the corner. [pause] You just moved here. This is where you'll meet your neighbourhood.",
          audioFile: 'mumbai_bandra/joggers_park_local.mp3',
          durationSec: 36,
        },
      },
    },
    {
      id: 'carter_road_sea',
      name: 'Carter Road — Arabian Sea',
      location: { lat: 19.0612, lng: 72.8195 },
      triggerDistanceM: 160,
      clips: {
        sightseeing: {
          script:
            "[expansive, calm] Look west. That's the Arabian Sea. [pause] On a clear morning you can see nothing — just water until the horizon curves. Mumbai sits on a peninsula, surrounded on three sides by this same sea. [building] The city of sixteen million people exists because of that water. Trade routes, monsoons, the fishing communities that were here before any of this. [warm] Right now it's early. The sea is still. This is the best version of Mumbai.",
          audioFile: 'mumbai_bandra/carter_road_sightseeing.mp3',
          durationSec: 34,
        },
        local: {
          script:
            "[warm, conspiratorial] Carter Road is being upgraded — new lighting, canopy walkways, a sensory garden. The upgrade plans were actually presented to residents here on a Saturday morning run in early 2025. [amused] Only in Bandra does infrastructure planning happen during people's morning jog. [pause] The promenade gets over two thousand visitors on weekdays. On Sundays — just don't come after 8am.",
          audioFile: 'mumbai_bandra/carter_road_local.mp3',
          durationSec: 30,
        },
      },
    },
    {
      id: 'chimbai_village',
      name: 'Chimbai Village',
      location: { lat: 19.0572, lng: 72.8168 },
      triggerDistanceM: 170,
      clips: {
        history: {
          script:
            "[reverent, storytelling] The people you might see mending nets along this stretch are Koli fishermen. [pause] The Kolis have lived on this coast for over two thousand years — long before the Portuguese, the British, the Bollywood stars, the bankers in BKC. [building] Bandra, Mahim, Worli, Dharavi — all Koli fishing settlements. The name Mumbai itself comes from Mumbadevi, the Koli goddess of the sea. [warm] This city belongs to them first. Everything else was built on top.",
          audioFile: 'mumbai_bandra/chimbai_history.mp3',
          durationSec: 40,
        },
        food: {
          script:
            "[warm, enthusiastic] The Koli community makes Bombay Duck — nothing to do with duck, it's a fish. [amused] The name comes from the British, who called the Bombay mail train the 'Bombay Dak.' The fish, transported on the same railway, took the name. [conspiratorial] Dried Bombay Duck with rice and curry is one of the most aggressively flavoured things you'll ever eat. Someone in Bandra will cook it for you eventually. You'll either love it or not.",
          audioFile: 'mumbai_bandra/chimbai_food.mp3',
          durationSec: 32,
        },
      },
    },
    {
      id: 'bandstand_promenade',
      name: 'Bandstand Promenade',
      location: { lat: 19.0530, lng: 72.8175 },
      triggerDistanceM: 170,
      clips: {
        sightseeing: {
          script:
            "[warm, building] The promenade opens up here — you can see the Bandra-Worli Sea Link ahead. Five point six kilometres of cable-stayed bridge, opened 2009, cut travel time from Bandra to Worli from 45 minutes to 5. [pause] At night it's lit up white and gold. From where you're running, it frames the view perfectly. [excited] This is the view people mean when they say they love Bandra. You're in it now.",
          audioFile: 'mumbai_bandra/bandstand_sightseeing.mp3',
          durationSec: 34,
        },
        local: {
          script:
            "[conspiratorial, warm] The Bandstand Promenade is where Bandra does its social life outdoors. Evenings especially — young couples, cricket on any flat surface, kids on bikes, teenage boys doing exactly nothing but looking cool. [amused] And on the rocks below, at 6am, people doing yoga while the tide comes in. [pause] You recently moved here. Give yourself three months. This stretch will start to feel like yours.",
          audioFile: 'mumbai_bandra/bandstand_local.mp3',
          durationSec: 32,
        },
      },
    },
    {
      id: 'mannat',
      name: 'Mannat — Shah Rukh Khan',
      location: { lat: 19.0495, lng: 72.8185 },
      triggerDistanceM: 160,
      clips: {
        local: {
          script:
            "[warm, amused] The white bungalow on your left — with the nameplate at the gate and the people taking photos even at this hour — that's Mannat. Shah Rukh Khan's home since 2001. [conspiratorial] On his birthday in November, the street outside fills with thousands of fans. He comes to the balcony and waves. In the age of Instagram, people queue for hours. [pause] In Mumbai, Bollywood isn't the film industry — it's the city's emotional infrastructure. Mannat is one of its cathedrals.",
          audioFile: 'mumbai_bandra/mannat_local.mp3',
          durationSec: 36,
        },
        history: {
          script:
            "[warm, storytelling] This stretch of the seafront was colonised by Bollywood in the 1990s as the industry moved from central Mumbai to the western suburbs. Salman Khan lives two kilometres north. Katrina Kaif. Deepika Padukone. [building] Bandra became Bollywood's residential address not by planning but by gravity — one star moved here, then another followed, then the industry followed the stars. [warm] The fishing village and the film industry, side by side on the same promenade. That's Mumbai.",
          audioFile: 'mumbai_bandra/mannat_history.mp3',
          durationSec: 36,
        },
      },
    },
    {
      id: 'bandra_fort',
      name: 'Bandra Fort — Castella de Aguada',
      location: { lat: 19.0445, lng: 72.8218 },
      triggerDistanceM: 180,
      clips: {
        history: {
          script:
            "[reverent, building] You've reached Bandra Fort — or what remains of it. The Portuguese built Castella de Aguada here in 1640. [pause] 'Castle of the Water Spring.' It protected the harbour from Dutch attack. The Portuguese held Bandra for nearly 150 years before the British took it in 1774. [building] The walls you're looking at are almost 400 years old. The view they had — the same sea, the same horizon. The Bandra-Worli Sea Link in the distance is 400 years newer. [warm] These walls have seen every version of this city.",
          audioFile: 'mumbai_bandra/bandra_fort_history.mp3',
          durationSec: 44,
        },
        sightseeing: {
          script:
            "[excited, expansive] This is the view. Stop for a moment. [pause] The Sea Link stretching north. The Arabian Sea all the way to the horizon. Bandra below you, the promenade you just ran. [warm] On a clear morning — and mornings are your best bet — you can see the city waking up from here. The fishing boats. The first local trains. The light changing over the water. [satisfied] This is your turnaround point. You've earned it.",
          audioFile: 'mumbai_bandra/bandra_fort_sightseeing.mp3',
          durationSec: 36,
        },
        food: {
          script:
            "[warm, amused] At the base of the fort there are usually vendors — cutting chai in clay cups, bun maska, vada pav. [enthusiastic] Vada pav is Mumbai's soul food — a spiced potato fritter in a bread roll with three chutneys. Thirty rupees. Every Mumbaikar has an opinion about which stall does it best. [conspiratorial] The one near Bandra Fort is perfectly acceptable. After a 5km run at dawn, it's exceptional.",
          audioFile: 'mumbai_bandra/bandra_fort_food.mp3',
          durationSec: 32,
        },
      },
    },
    {
      id: 'return_sea_link_view',
      name: 'Sea Link — On the Return',
      location: { lat: 19.0510, lng: 72.8180 },
      triggerDistanceM: 150,
      clips: {
        sightseeing: {
          script:
            "[warm] On your way back, the Sea Link is ahead of you now instead of to the side. [pause] The bridge has eight lanes, can carry 100,000 vehicles a day, and transformed how Mumbai thinks about its geography. Before it, Bandra and Worli were psychologically 45 minutes apart. Now they're the same neighbourhood. [building] Mumbai is always doing this — collapsing distance, connecting what seemed separated. You're running a city that never stops building itself.",
          audioFile: 'mumbai_bandra/sea_link_sightseeing.mp3',
          durationSec: 30,
        },
      },
    },
    {
      id: 'joggers_park_finish',
      name: 'Back at Joggers Park',
      location: { lat: 19.0583, lng: 72.8207 },
      triggerDistanceM: 120,
      clips: {
        local: {
          script:
            "[warm, satisfied] You're back. Five kilometres along the Arabian Sea. [pause] This run — Joggers Park to Bandra Fort and back — is what serious Bandra runners do every morning. You now know the route. [building] One thing every newcomer learns: Mumbai rewards the early riser. The city at 6am is a different creature from the city at noon. Quieter, kinder, cooler. [warm] You've just seen the best version of Bandra. Remember where to come back.",
          audioFile: 'mumbai_bandra/finish_local.mp3',
          durationSec: 38,
        },
        history: {
          script:
            "[warm, reflective] Bandra was a Portuguese settlement, then a British suburb, then a working-class neighbourhood, then a Bollywood address, now a tech-finance hub with BKC next door. [pause] It's gone through more identities than most cities. [building] And yet the promenade is still the promenade. The fishermen still mend nets at dawn. The fort is still standing. [warm] Some things in Mumbai are older than all of it.",
          audioFile: 'mumbai_bandra/finish_history.mp3',
          durationSec: 34,
        },
      },
    },
  ],
};

/**
 * MUMBAI ROUTE 2: The New Mumbai — Coastal Road Promenade
 * ────────────────────────────────────────────────────────
 * Start: Worli end of the Mumbai Coastal Road Promenade
 *        (Uber to "Worli Sea Face near Sea Link" — 15 min from Bandra East)
 * Route: 7.5km promenade running south toward Breach Candy and back
 *        (or shorter — do as much as you want, same path back)
 *
 * WHAT THIS IS (important for newcomers):
 * Mumbai spent ₹13,000 crore building a coastal highway. The 7.5km promenade
 * that runs alongside it opened in August 2025. It's BRAND NEW. Longer than
 * Marine Drive. Zero cars. 24 hours. Sea on one side, the city on the other.
 * Access via pedestrian underpasses spaced every 400-500m.
 * This is currently the best uninterrupted running surface in Mumbai.
 *
 * Uber drop: "Worli Sea Face, near Bandra-Worli Sea Link south tower"
 */
export const MUMBAI_COASTAL_PROMENADE: Route = {
  id: 'mumbai_coastal_promenade',
  city: 'Mumbai',
  name: 'The New Mumbai',
  description:
    'Mumbai\'s brand-new 7.5km coastal promenade — longer than Marine Drive, opened August 2025. ' +
    'Zero traffic, 24 hours, sea on one side. The best uninterrupted running surface in the city. ' +
    'Uber to Worli Sea Face. Run as far south as you want, same path back.',
  distanceKm: 7.5,
  startLocation: { lat: 19.0180, lng: 72.8178 },

  coordinates: [
    { lat: 19.0180, lng: 72.8178 }, // Worli entry near Sea Link south tower
    { lat: 19.0155, lng: 72.8165 },
    { lat: 19.0130, lng: 72.8148 }, // Worli Village area
    { lat: 19.0100, lng: 72.8128 },
    { lat: 19.0075, lng: 72.8112 }, // Near Haji Ali view
    { lat: 19.0048, lng: 72.8100 },
    { lat: 19.0020, lng: 72.8095 }, // Mahalaxmi area
    { lat: 18.9990, lng: 72.8090 },
    { lat: 18.9960, lng: 72.8085 },
    { lat: 18.9930, lng: 72.8082 },
    { lat: 18.9900, lng: 72.8080 }, // Worli Dairy area / Pedder Road end
    // Can continue further to Breach Candy (18.97, 72.808) for full 7.5km
  ],

  pois: [
    {
      id: 'sea_link_south_tower',
      name: 'Bandra-Worli Sea Link',
      location: { lat: 19.0178, lng: 72.8175 },
      triggerDistanceM: 200,
      clips: {
        history: {
          script:
            "[building, reverent] The bridge you're standing under took nine years to build and opened in 2009 after one of Mumbai's most fraught infrastructure projects. [pause] Thousands of workers. Multiple contractor disputes. A cost overrun from 1,600 crore to over 16,000 crore. Three workers died in construction accidents. [warm] And then it opened, and Bandra and Worli became neighbours. Mumbai always pays a heavy price for its ambition. The bridge is worth it.",
          audioFile: 'mumbai_coastal/sea_link_history.mp3',
          durationSec: 38,
        },
        sightseeing: {
          script:
            "[excited] Look up. You're at the base of one of Mumbai's cable-stayed towers — 128 metres high. [pause] The bridge carries 100,000 vehicles a day. Eight lanes. At night, the cables are lit and the whole thing reflects on the water. [warm] You're about to run one of the most dramatic openings of any run in India. The promenade south from here — sea on your right, Mumbai skyline on your left. [energetic] Let's go.",
          audioFile: 'mumbai_coastal/sea_link_sightseeing.mp3',
          durationSec: 32,
        },
      },
    },
    {
      id: 'promenade_itself',
      name: 'The Coastal Road Promenade',
      location: { lat: 19.0130, lng: 72.8148 },
      triggerDistanceM: 150,
      clips: {
        history: {
          script:
            "[warm, storytelling] What you're running on is reclaimed sea. [pause] Mumbai spent ₹13,000 crore — roughly 1.5 billion dollars — to build the coastal highway alongside you. The promenade is what came with it: 70 hectares of land pulled from the Arabian Sea, turned into public open space. [building] The promenade opened in August 2025 — almost brand new. You're running on something most of this city hasn't discovered yet. [warm] This is the longest promenade in Mumbai. Twice the length of Marine Drive.",
          audioFile: 'mumbai_coastal/promenade_history.mp3',
          durationSec: 40,
        },
        sightseeing: {
          script:
            "[expansive, calm] No traffic lights. No cars. Just the sea to your right and the Mumbai skyline to your left. [pause] On a clear morning the Western Ghats are visible to the east. The Sahyadri mountains — 1,500 metres high — sitting behind the city like a backdrop. [warm] Most people in Mumbai have never seen this view because the coastal highway had no pedestrian access for years. You're seeing it now. At the best time of day.",
          audioFile: 'mumbai_coastal/promenade_sightseeing.mp3',
          durationSec: 30,
        },
      },
    },
    {
      id: 'worli_village',
      name: 'Worli Village',
      location: { lat: 19.0090, lng: 72.8115 },
      triggerDistanceM: 170,
      clips: {
        history: {
          script:
            "[reverent, storytelling] Inland from here, behind the glass towers and the five-star hotels, is Worli Village — one of the oldest Koli fishing settlements in Mumbai, predating British colonisation by centuries. [pause] The Kolis here still fish the same waters their ancestors did, though the catch is smaller now and the waters more polluted. [building] Corporate Mumbai and ancient Mumbai exist side by side in a way that most cities have long resolved one way or the other. Mumbai hasn't. [warm] It might be the most honest thing about this city.",
          audioFile: 'mumbai_coastal/worli_village_history.mp3',
          durationSec: 40,
        },
        food: {
          script:
            "[warm, enthusiastic] The Koli community around Worli makes some of the freshest seafood in the city — bought directly off the boats in the early morning. [conspiratorial] The Worli fish market opens around 5am. The prawns coming in right now will be in someone's kitchen by 7am. [amused] The restaurants on Worli Sea Face charge 800 rupees for the same prawn curry you can eat at the market for 80. Both versions are worth knowing.",
          audioFile: 'mumbai_coastal/worli_village_food.mp3',
          durationSec: 32,
        },
      },
    },
    {
      id: 'haji_ali_view',
      name: 'Haji Ali Dargah — Floating Mosque',
      location: { lat: 19.0065, lng: 72.8105 },
      triggerDistanceM: 180,
      clips: {
        sightseeing: {
          script:
            "[warm, reverent] Look out to sea — the white structure on the small island is Haji Ali Dargah. A mosque and tomb, built in 1431, sitting on a rock 500 metres offshore. [pause] At low tide there's a narrow causeway and pilgrims walk out to it. At high tide it appears to float. [warm] It's one of the most visited religious sites in Mumbai — Hindu, Muslim, people of every faith come here. [building] That's a particular Mumbai thing. The city has always been crowded enough that the religions had to learn to share space.",
          audioFile: 'mumbai_coastal/haji_ali_sightseeing.mp3',
          durationSec: 38,
        },
        history: {
          script:
            "[storytelling] Haji Ali was a wealthy Muslim merchant from Bukhara — Central Asia — who gave up his wealth and came to Mumbai as a saint. He died in 1431 and was buried here, on this rock. [pause] The British tried to demolish the Dargah for a road project in the 1800s. There was such public resistance — Hindu and Muslim residents together — that they abandoned the plan. [warm] Mumbai has fought for this mosque for 600 years. The mosque is still there.",
          audioFile: 'mumbai_coastal/haji_ali_history.mp3',
          durationSec: 36,
        },
      },
    },
    {
      id: 'mahalaxmi_racecourse',
      name: 'Mahalaxmi Racecourse',
      location: { lat: 19.0020, lng: 72.8095 },
      triggerDistanceM: 180,
      clips: {
        history: {
          script:
            "[warm, amused] The vast green space inland from here — that's the Mahalaxmi Racecourse. One of the oldest horse racing venues in Asia, established by the British in 1883. [pause] The racing season runs from November to April. On race days, the grandstands fill, the bookmakers line up, and old Mumbai money comes out. [building] The land is worth tens of thousands of crores in one of the world's most expensive cities, and it remains a horse racing track because nobody has successfully argued it shouldn't be. [warm] Some things in Mumbai survive just through sheer insistence.",
          audioFile: 'mumbai_coastal/racecourse_history.mp3',
          durationSec: 40,
        },
        local: {
          script:
            "[conspiratorial] From 5am to 9am and 4pm to 8pm, the Racecourse opens its 2km mud track to the public for running. Free entry. [warm] It's one of the best running surfaces in Mumbai — proper mud, the horses train on the outer track simultaneously, the grandstands are empty and quiet. [amused] You can run laps on the same track as thoroughbreds that race for crores. Very few cities offer that.",
          audioFile: 'mumbai_coastal/racecourse_local.mp3',
          durationSec: 28,
        },
      },
    },
  ],
};

export default MUMBAI_BANDRA_WATERFRONT;
