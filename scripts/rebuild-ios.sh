#!/usr/bin/env bash
# Build a standalone Release app on a connected iPhone (no Metro required at runtime).
#
# Usage:
#   npm run ios:release
#   npm run ios:release -- 00008140-000654C22EFB001C   # explicit UDID
#   IOS_DEVICE_UDID=... npm run ios:release
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Optional: IOS_DEVICE_UDID in .env
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

UDID="${1:-${IOS_DEVICE_UDID:-}}"

if [[ -z "$UDID" ]]; then
  echo "→ No UDID set — looking for a connected iPhone…"
  UDID="$(
    xcrun xctrace list devices 2>&1 \
      | grep -E 'iPhone.*\([0-9A-Fa-f-]{20,}\)' \
      | grep -v Simulator \
      | head -1 \
      | sed -E 's/.*\(([0-9A-Fa-f-]+)\).*/\1/'
  )"
fi

if [[ -z "$UDID" ]]; then
  echo "No iPhone found. Plug in your phone, unlock it, then retry."
  echo "Or pass a UDID:  npm run ios:release -- YOUR_UDID"
  echo "List devices:    xcrun xctrace list devices 2>&1 | grep iPhone"
  exit 1
fi

if [[ ! -d ios ]]; then
  echo "→ ios/ missing — running expo prebuild…"
  npx expo prebuild --platform ios
  echo "→ pod install…"
  (cd ios && pod install)
fi

# Personal team (Navya Jain). Adobe org = JQ525L2MZD — override via APPLE_TEAM_ID in .env
TEAM_ID="${APPLE_TEAM_ID:-DCM2GY42X4}"
export DEVELOPMENT_TEAM="$TEAM_ID"

echo "→ Building Release for device $UDID (team $TEAM_ID, JS bundle baked in — no Metro needed)"
export EXPO_XCODE_BUILD_ARGS="-allowProvisioningUpdates"
npx expo run:ios --device "$UDID" --configuration Release

echo ""
echo "✓ Done. Open RunCast on your iPhone."
echo "  If the app won't open: Settings → General → VPN & Device Management → Trust."
