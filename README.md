# RunCast

> GPS-triggered audio running tours for travel runners.  
> Explore cities on foot — history, food, sightseeing, and local life narrated as you run past them.

Your music plays. When you pass something worth knowing about, the audio ducks and a clip plays. After it finishes, 5 seconds of silence — look around, absorb it — then your music comes back.

---

## First route: SF Embarcadero Loop (7.8km)

**Rincon Hill → Bay Bridge → Ferry Building → Pier 39 → Fisherman's Wharf → Aquatic Park → North Beach → back**

9 points of interest. 4 modes. Each mode tells a completely different story about the same run.

| Mode | Voice | What you hear |
|---|---|---|
| 🏛 History | Warm, authoritative | Earthquakes, McCarthyism, Italian immigrants, the Beat Generation |
| 🥐 Food | Enthusiastic, warm | Sourdough starter that survived 1906, best 7am espresso, Hog Island Oyster |
| 📸 Sightseeing | Energetic | Best view angles, Bay Lights, Alcatraz from Pier 39 |
| 🏘 Local Life | Conspiratorial | Where locals actually run, the Dolphin Club, Saturday morning run clubs |

---

## How it works

```
You run → GPS tracks position
        → Proximity engine checks POIs ahead
        → Pace-adjusted trigger (faster pace = earlier trigger)
        → System audio ducks (Spotify/Apple Music goes quiet)
        → Narration plays
        → 5-second "enjoy the moment" pause
        → Your music returns
```

---

## Project structure

```
src/
├── data/
│   ├── types.ts                   Core types: Route, POI, Mode, AudioClip
│   └── routes/
│       └── sf_embarcadero.ts     7.8km SF loop with full POI scripts
├── utils/
│   └── geo.ts                    Haversine + pace-adjusted trigger distance
├── hooks/
│   ├── useGPS.ts                 GPS tracking + rolling pace calculation
│   ├── useAudio.ts               Playback + music ducking + moment pause
│   └── useProximity.ts           Pace-aware POI proximity detection
└── components/
    ├── RunMap.tsx                 Map with route overlay and POI markers
    └── NowPlaying.tsx            Animated "now playing" overlay
scripts/
└── generate_audio.py             ElevenLabs batch audio generator
```

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Generate audio clips (requires ElevenLabs API key)

```bash
cd scripts
pip install -r requirements.txt
export ELEVENLABS_API_KEY=your_key_here

# Preview what would be generated
python generate_audio.py --dry-run

# Generate one mode first
python generate_audio.py --mode sightseeing

# Generate all modes
python generate_audio.py --mode all
```

Audio files are saved to `assets/audio/sf_embarcadero/`.

### 3. Run the app

```bash
# iOS (requires development build for react-native-maps)
npx expo run:ios

# Android
npx expo run:android
```

> **Note:** `react-native-maps` requires a development build on iOS — it won't work in Expo Go.  
> Run `npx expo install expo-dev-client` and then `npx expo run:ios` for the first build.

---

## Adding a new city

1. Add a new route file in `src/data/routes/` following the `Route` type
2. Add POI scripts for each mode — write them like a great tour guide who runs
3. Add the route to `ROUTES` in `scripts/generate_audio.py`
4. Run `python generate_audio.py --route your_route`
5. Import and display in `App.tsx`

---

## Roadmap

- [ ] Additional SF routes (Bernal Hill, GGP, Presidio)
- [ ] NYC: Central Park, Brooklyn Bridge, High Line
- [ ] Paris, Tokyo, London
- [ ] Community route contributions
- [ ] GPX export to Garmin / Strava
- [ ] Language learning mode

---

## Tech stack

- **Expo / React Native** — iOS + Android
- **expo-location** — GPS with background tracking
- **expo-av** — audio playback + system music ducking
- **react-native-maps** — Google Maps on Android, Apple Maps on iOS
- **ElevenLabs** — TTS narration with per-mode voice characters
- **TypeScript** throughout
