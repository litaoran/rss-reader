#!/bin/bash
# Create a macOS DMG installer from the packaged Antenna.app
# Usage: ./scripts/make-dmg.sh [arch]
# arch defaults to arm64
#
# Requires: brew install create-dmg

set -euo pipefail

ARCH="${1:-arm64}"
VERSION=$(node -p "require('./package.json').version")
APP_PATH="out/Antenna-darwin-${ARCH}/Antenna.app"
DMG_NAME="Antenna-${VERSION}-${ARCH}.dmg"
DMG_PATH="out/make/${DMG_NAME}"
BG_IMAGE="assets/dmg/background.png"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: $APP_PATH not found. Run 'npm run make' first."
  exit 1
fi

echo "Creating DMG: ${DMG_NAME}"
mkdir -p "$(dirname "$DMG_PATH")"
rm -f "$DMG_PATH"

create-dmg \
  --volname "Antenna Installer" \
  --background "$BG_IMAGE" \
  --window-pos 200 120 \
  --window-size 660 400 \
  --icon-size 128 \
  --icon "Antenna.app" 170 170 \
  --app-drop-link 490 170 \
  --hide-extension "Antenna.app" \
  --no-internet-enable \
  "$DMG_PATH" \
  "$APP_PATH"

echo "Done: ${DMG_PATH}"
ls -lh "$DMG_PATH"
