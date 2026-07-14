#!/usr/bin/env bash
set -euo pipefail

# Sync shared source files to both the Wails frontend and the web project.
#
# Usage:
#   ./sync.sh              # copy shared/ → frontend/src/ (for Wails)
#   ./sync.sh --web PATH   # copy shared/ → PATH (for beaconator-web)
#
# The shared/ directory is the source of truth. Edit files there, then run
# this script to propagate. Both copies are tracked in git so clones work
# without running sync.

SHARED="$(cd "$(dirname "$0")" && pwd)/shared"
TARGET="${1:-frontend/src}"

if [ "${1:-}" = "--web" ] && [ -n "${2:-}" ]; then
  TARGET="$2"
fi

echo "Syncing $SHARED → $TARGET"

cp "$SHARED/config.js"           "$TARGET/config.js"
cp "$SHARED/github.js"           "$TARGET/github.js"
cp "$SHARED/ui.js"               "$TARGET/ui.js"
cp "$SHARED/ui-utils.js"         "$TARGET/ui-utils.js"
cp "$SHARED/ui-crypto.js"        "$TARGET/ui-crypto.js"
cp "$SHARED/ai.js"               "$TARGET/ai.js"
cp "$SHARED/ai-providers.js"     "$TARGET/ai-providers.js"
cp "$SHARED/notifications.js"    "$TARGET/notifications.js"
cp "$SHARED/i18n.js"             "$TARGET/i18n.js"
cp "$SHARED/themes.js"           "$TARGET/themes.js"
cp "$SHARED/metrics.js"          "$TARGET/metrics.js"
cp "$SHARED/icon.svg"            "$TARGET/icon.svg"
cp "$SHARED/locales/en.json"     "$TARGET/locales/en.json"
cp "$SHARED/locales/es.json"     "$TARGET/locales/es.json"

echo "Done — $SHARED synced to $TARGET"
