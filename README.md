# RunCast

GPS-triggered audio running tours for travel runners. Pick a city route, choose a lens (history, food, sightseeing, local life), and hear narration as you pass landmarks — with light turn-by-turn nudges along the way.

**15 routes** across San Francisco and Mumbai. Your music keeps playing; RunCast ducks it for clips, then hands audio back.

---

## Requirements

| Tool | Version |
|------|---------|
| Node.js | 20+ (see `package.json` engines if added) |
| npm | 10+ |
| Xcode | 16+ (iOS device builds) |
| CocoaPods | 1.15+ |
| Apple Developer account | For physical iPhone installs |

`react-native-maps` needs a **development build** — Expo Go is not supported.

---

## Setup

```bash
git clone https://github.com/navya19j/runcast.git
cd runcast
npm install
cp .env.example .env   # add Google Maps keys at minimum
```

### Environment variables

| Variable | Required for app | Purpose |
|----------|------------------|---------|
| `GOOGLE_MAPS_API_KEY_IOS` | iOS maps (if using Google provider) | Injected via `app.config.js` at prebuild |
| `GOOGLE_MAPS_API_KEY_ANDROID` | Android maps | Same |
| `ELEVENLABS_API_KEY` | Audio generation only | `scripts/generate_audio.py` |
| `STRAVA_*` | Route tooling only | Optional Strava import in scripts |

---

## Building for iOS

Native projects are **not** committed (`ios/` is gitignored). Generate them once:

```bash
npx expo prebuild --platform ios
cd ios && pod install && cd ..
```

`app.config.js` patches the Podfile so `react-native-maps` uses the correct pod name (`react-native-maps`, not `react-native-google-maps`).

### Linker fix (if build fails on `Sealable` symbol)

After prebuild, ensure `ios/Podfile.properties.json` includes:

```json
{
  "expo.jsEngine": "hermes",
  "EXPO_USE_PRECOMPILED_MODULES": "false",
  "ios.buildReactNativeFromSource": "true"
}
```

Then `cd ios && pod install`.

### List connected devices

```bash
xcrun xctrace list devices 2>&1 | grep iPhone
```

Copy the UDID in parentheses, e.g. `00008140-000654C22EFB001C`.

---

## Build modes

### 1. Standalone on device (no Metro) — **recommended for real runs**

Embeds JavaScript in the app (`main.jsbundle`). Works offline from your Mac after install. No dev server at launch.

```bash
cd ios
xcodebuild \
  -workspace RunCast.xcworkspace \
  -scheme RunCast \
  -configuration Release \
  -destination 'id=YOUR_DEVICE_UDID' \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=YOUR_TEAM_ID

xcrun devicectl device install app --device YOUR_DEVICE_UDID \
  "$HOME/Library/Developer/Xcode/DerivedData/RunCast-"*/Build/Products/Release-iphoneos/RunCast.app
```

Or via Expo (bundles JS at build time, skips starting Metro):

```bash
npx expo run:ios --device "YOUR_DEVICE_UDID" --configuration Release
```

**First install:** on the iPhone go to **Settings → General → VPN & Device Management** and trust your developer certificate.

### 2. Development build (Metro + hot reload)

Phone and Mac must be on the **same Wi‑Fi**.

```bash
# Terminal 1 — bundler
REACT_NATIVE_PACKAGER_HOSTNAME=$(ipconfig getifaddr en0) npx expo start --host lan

# Terminal 2 — build & install Debug
npx expo run:ios --device "YOUR_DEVICE_UDID"
```

Debug builds load JS from Metro (`AppDelegate` uses `RCTBundleURLProvider` in `#if DEBUG`).

### 3. Simulator

```bash
npx expo run:ios
```

---

## Testing without running outside

On the run screen (before **Start Run**), tap **Simulate** to walk the route virtually:

- Turn navigation nudges and POI audio fire along the polyline
- **Drift off route (test)** triggers the off-route warning
- No GPS or location permission needed

---

## Route data pipeline

Accurate paths: user GPX → cached polyline → OSM corridor geometry (no OSRM street routing).

```bash
# Rebuild all route coordinates and patch .ts files
python3 scripts/refresh_all_coords.py

# Force rebuild from OpenStreetMap (ignores cache; user GPX still wins)
python3 scripts/refresh_all_coords.py --force

# Validate path quality
python3 scripts/audit_routes.py
```

**Gold-standard geometry:** drop a Strava/Komoot export at  
`scripts/routes_raw/gpx/{route_id}.gpx`  
then run `refresh_all_coords.py`.

Generated references: `scripts/routes_raw/polylines/` and `scripts/routes_raw/gpx/*.generated.gpx`.

---

## Audio generation

```bash
cd scripts
pip install -r requirements.txt
export ELEVENLABS_API_KEY="your_key"

python generate_audio.py --dry-run
python generate_audio.py --mode sightseeing
python generate_audio.py --mode all
```

Clips land in `assets/audio/{route_folder}/`. Regenerate `src/data/audioAssets.ts`:

```bash
python3 scripts/extract_audio_manifest.py
```

---

## Project layout

```
src/
├── data/routes/          Route polylines, POIs, scripts
├── hooks/
│   ├── useGPS.ts         Live location + pace
│   ├── useProximity.ts   POI trigger engine
│   ├── useNavigation.ts  Turn / off-route nudges
│   ├── useSimulatedRun.ts  Indoor route simulation
│   └── useAudio.ts       Narration + TTS nudges (expo-speech)
├── screens/              Home, detail, run complete
└── utils/
    ├── geo.ts            Distance, map simplify, route progress
    └── navigation.ts     Turn detection from polyline

scripts/
├── refresh_all_coords.py   Build paths → patch TS + manifest
├── osm_path.py             OSM corridor / trail geometry
├── gpx_io.py               GPX import/export
└── audit_routes.py         Path QA

App.tsx                   Run screen, simulate mode, navigation wiring
```

---

## EAS / TestFlight (optional)

`eas.json` is included. For cloud builds:

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile production
```

---

## Tech stack

- **Expo SDK 56** / React Native 0.85
- **expo-location** + TaskManager — foreground + background GPS
- **expo-audio** — narration with music ducking
- **expo-speech** — short navigation nudges
- **react-native-maps** — Apple Maps on iOS (see `src/utils/mapProvider.ts`)
- **TypeScript** throughout

---

## License

Private / personal project — see repository owner for terms.
