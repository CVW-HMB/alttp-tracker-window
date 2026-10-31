#!/bin/zsh
# Refresh vendor/z3rTracker from the latest okay-dude/z3rTracker release.
set -euo pipefail
cd "${0:A:h}/.."
TAG=$(gh api repos/okay-dude/z3rTracker/releases/latest --jq .tag_name)
TMP=$(mktemp -d)
gh api "repos/okay-dude/z3rTracker/zipball/$TAG" > "$TMP/z.zip"
ditto -x -k "$TMP/z.zip" "$TMP/x"
rm -rf vendor/z3rTracker
mkdir -p vendor
mv "$TMP"/x/*/ vendor/z3rTracker
echo "$TAG" > vendor/z3rTracker/VERSION
# Default autotracking to SNI's port instead of QUsb2snes's.
sed -i '' 's/autoTrackingPort: 8080/autoTrackingPort: 23074/' vendor/z3rTracker/js/settings.js
sed -i '' 's/id="auto-tracking-port"/&/; s/value="8080" id="auto-tracking-port"/value="23074" id="auto-tracking-port"/' vendor/z3rTracker/index.html
sed -i '' 's/"autoTrackingPort": *"8080"/"autoTrackingPort":"23074"/g' vendor/z3rTracker/js/default-config.js vendor/z3rTracker/config.json
rm -rf "$TMP"
echo "z3rTracker $TAG"
