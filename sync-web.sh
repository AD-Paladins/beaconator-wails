#!/usr/bin/env bash
set -euo pipefail

# Sync shared source files to the beaconator-web project root.
#
# The shared/ directory is the source of truth. Edit files there, then run
# this script to propagate to the root (where index.html imports them).
# Both copies are tracked in git so clones work without running sync.
#
# Files NOT touched by sync (web-specific, stay at root):
#   main.js, index.html, style.css, jira.js
#
# Before using this for the first time:
#   1. cp jira.js shared/jira.js  (backup before modifying)
#   2. Update jira.js to accept options parameter (see docs)
#   3. Replace metrics.js with the shared version
#   4. Run ./sync.sh

SHARED="$(cd "$(dirname "$0")" && pwd)/shared"
TARGET="$(cd "$(dirname "$0")" && pwd)"

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
