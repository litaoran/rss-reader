#!/bin/bash
# Create a macOS DMG installer from the packaged Antenna.app
# Usage: ./scripts/make-dmg.sh [arch]
# arch defaults to arm64

set -euo pipefail

ARCH="${1:-arm64}"
VERSION=$(node -p "require('./package.json').version")
APP_PATH="out/Antenna-darwin-${ARCH}/Antenna.app"
DMG_NAME="Antenna-${VERSION}-${ARCH}.dmg"
DMG_PATH="out/make/${DMG_NAME}"
VOLUME_NAME="Antenna"
STAGING_DIR=$(mktemp -d)

if [ ! -d "$APP_PATH" ]; then
  echo "Error: $APP_PATH not found. Run 'npm run make' first."
  exit 1
fi

echo "Creating DMG: ${DMG_NAME}"

# Set up staging directory with app and Applications symlink
cp -R "$APP_PATH" "${STAGING_DIR}/Antenna.app"
ln -s /Applications "${STAGING_DIR}/Applications"

# Create DMG
mkdir -p "$(dirname "$DMG_PATH")"
rm -f "$DMG_PATH"
hdiutil create \
  -volname "$VOLUME_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

# Clean up
rm -rf "$STAGING_DIR"

echo "Done: ${DMG_PATH}"
ls -lh "$DMG_PATH"
