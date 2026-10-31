#!/bin/zsh
# Package the app, install it to ~/Applications, and put an alias on the Desktop.
set -euo pipefail
cd "${0:A:h}/.."
OUT="build.nosync"
APP_NAME="ALttP Tracker"
DEST="$HOME/Applications/$APP_NAME.app"

npx electron-packager . "$APP_NAME" --platform=darwin --arch=arm64 --out="$OUT" --overwrite \
  --icon=build/icon.icns --app-bundle-id=io.github.cvwhmb.alttptracker \
  --ignore='^/build' --ignore='^/build\.nosync' --ignore='^/scripts' --ignore='^/vendor/z3rTracker/tools' --ignore='^/node_modules' --prune=false

pkill -f "$DEST/Contents/MacOS" 2>/dev/null || true
rm -rf "$DEST"
ditto --norsrc --noextattr "$OUT/$APP_NAME-darwin-arm64/$APP_NAME.app" "$DEST"
xattr -cr "$DEST"
codesign --force --deep --sign - "$DEST"
codesign --verify --deep "$DEST"

ALIAS="$HOME/Desktop/$APP_NAME"
[[ -e "$ALIAS" ]] || osascript -e "tell application \"Finder\" to make alias file to (POSIX file \"$DEST\") at (path to desktop folder)" >/dev/null
echo "Installed $DEST"
