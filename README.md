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

## Install standalone app on an iPhone (no Metro)

Use this when you want RunCast on a real phone **without** keeping a Mac running or starting Metro. The JavaScript bundle is baked into the app at build time (`main.jsbundle`).

### Who needs what

| Role | Needs |
|------|--------|
| **Builder** (Mac) | Xcode, CocoaPods, Node, Apple ID in Xcode |
| **Runner** (iPhone) | USB cable (first install); device registered in builder’s Apple developer account |

- **Free Apple ID:** install to your own devices; builds expire after ~7 days (rebuild to refresh).
- **Paid Apple Developer Program ($99/yr):** longer-lived installs; share via TestFlight.

### One-time Mac setup

```bash
git clone https://github.com/navya19j/runcast.git
cd runcast
npm install
cp .env.example .env          # optional for maps keys; Apple Maps works without them on iOS
npx expo prebuild --platform ios
cd ios && pod install && cd ..
```

If `pod install` fails on `react-native-google-maps`, run prebuild again (`app.config.js` fixes the Podfile) or change `pod 'react-native-google-maps'` → `pod 'react-native-maps'` in `ios/Podfile`.

If the build fails with `Undefined symbols … Sealable`, add to `ios/Podfile.properties.json`:

```json
{
  "expo.jsEngine": "hermes",
  "EXPO_USE_PRECOMPILED_MODULES": "false",
  "ios.buildReactNativeFromSource": "true"
}
```

Then `cd ios && pod install`.

Sign in to Xcode: **Xcode → Settings → Accounts** → add your Apple ID.

### Find your Team ID and device UDID

**Team ID** — Xcode → Settings → Accounts → your Apple ID → Team (ID shown underneath). Xcode also prints it during build: `Auto signing app using team(s): XXXXXXXXXX`.

**Device UDID** — plug in the iPhone, unlock it, then:

```bash
xcrun xctrace list devices 2>&1 | grep -v Simulator | grep iPhone
```

Copy the UDID in parentheses, e.g. `00008140-000654C22EFB001C`.

### Build and install (command line)

Replace `YOUR_DEVICE_UDID` and `YOUR_TEAM_ID`.

```bash
cd runcast/ios

xcodebuild \
  -workspace RunCast.xcworkspace \
  -scheme RunCast \
  -configuration Release \
  -destination 'id=YOUR_DEVICE_UDID' \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=YOUR_TEAM_ID
```

When the build finishes:

```bash
APP="$HOME/Library/Developer/Xcode/DerivedData/RunCast-"*/Build/Products/Release-iphoneos/RunCast.app
xcrun devicectl device install app --device YOUR_DEVICE_UDID "$APP"
```

**Shorter alternative** (Expo bundles JS, then builds):

```bash
cd runcast
npx expo run:ios --device "YOUR_DEVICE_UDID" --configuration Release
```

If signing fails with Expo, use the `xcodebuild` steps above with `-allowProvisioningUpdates`.

### On the iPhone (first time only)

1. **Unlock** the phone during install.
2. **Trust the developer:** Settings → General → **VPN & Device Management** (or **Device Management**) → your developer profile → **Trust**.
3. Open **RunCast** from the home screen.

You do **not** need Metro, Wi‑Fi to your Mac, or `expo start` after this.

### Build and install (Xcode GUI)

1. Open `ios/RunCast.xcworkspace` (not `.xcodeproj`).
2. Select the physical iPhone in the device dropdown.
3. **RunCast** target → **Signing & Capabilities** → **Automatically manage signing** → pick your **Team**.
4. Product → Scheme → Edit Scheme → **Run** → Build Configuration → **Release**.
5. Product → **Run** (⌘R).

### Verify it’s standalone

- Release builds load `main.jsbundle` from the app bundle (`ios/RunCast/AppDelegate.swift`, `#else` branch).
- Quit Metro on your Mac, disable Wi‑Fi on the phone, launch RunCast — it should still open.
- Optional check:
  ```bash
  ls -lh ~/Library/Developer/Xcode/DerivedData/RunCast-*/Build/Products/Release-iphoneos/RunCast.app/main.jsbundle
  ```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `device is locked` | Unlock the iPhone and retry |
| `profile has not been explicitly trusted` | Settings → VPN & Device Management → Trust |
| `Provisioning profile doesn't include … device` | Rebuild with `-allowProvisioningUpdates`, or add device UDID in [Apple Developer → Devices](https://developer.apple.com/account/resources/devices/list) |
| `Sealable` linker error | Set `ios.buildReactNativeFromSource: true` in `Podfile.properties.json` |
| Redbox / “Could not connect to development server” | You installed **Debug**; rebuild **Release** |
| App stops opening after ~7 days | Free Apple ID limit — rebuild and reinstall |

### Sharing with someone without a Mac

- **TestFlight** (paid account): `eas build --platform ios --profile production`, then distribute via App Store Connect.
- **Direct install:** add their device UDID to your developer account, build Release, install with `devicectl` as above.

---

## Other build modes

### Development build (Metro + hot reload)

Phone and Mac must be on the **same Wi‑Fi**.

```bash
# Terminal 1 — bundler
REACT_NATIVE_PACKAGER_HOSTNAME=$(ipconfig getifaddr en0) npx expo start --host lan

# Terminal 2 — build & install Debug
npx expo run:ios --device "YOUR_DEVICE_UDID"
```

Debug builds load JS from Metro (`AppDelegate` uses `RCTBundleURLProvider` in `#if DEBUG`).

### Simulator

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

## Weather

Forecasts come from [Open-Meteo](https://open-meteo.com/) using **city-specific** run thresholds (heat, monsoon months for Mumbai).

- **Home screen:** city overview by default; switches to **route start** when you tap a route card to preview it on the map.
- **Route detail:** conditions at that route’s `startLocation` (not the city center).

Scoring still uses the parent city’s climate rules (e.g. Mumbai monsoon Jun–Sep).

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
