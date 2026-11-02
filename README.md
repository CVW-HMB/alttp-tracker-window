# ALttP Tracker

One window for racing A Link to the Past Randomizer: the muffins item and map tracker, the Stonks stats tracker, GGW's z3rTracker panels for entrance seeds, and a racetime.gg race room.

## Download

Grab the latest build from [Releases](https://github.com/CVW-HMB/alttp-tracker-window/releases):

- **Windows**: `ALttP-Tracker-Setup-x.y.z.exe` installs it. `ALttP-Tracker-x.y.z-portable.exe` runs without installing.
- **macOS (Apple Silicon)**: `ALttP-Tracker-x.y.z-mac-arm64.zip`.

The builds are not code-signed. Windows SmartScreen shows "Windows protected your PC": click **More info**, then **Run anyway**. On macOS, right-click the app and choose **Open** the first time.

Autotracking needs [SNI](https://github.com/alttpo/sni) (or QUsb2snes) running, same as in a browser. Classic muffins, Stonks and z3rTracker use port 23074; muffins 2.0 uses SNI's port 8190.

## Using it

The launcher opens first:

- **Muffins tracker**: **New seed settings…** opens the muffins launcher, Classic or 2.0. Press its Launch Tracker button and the settings come back to the app. Cmd/Ctrl+U does this from the main window.
- **xkeys panels**: GGW's z3rTracker panels appear when the muffins settings have entrance shuffle on. Its settings screen has a setup picker; the most recently used setup loads by default. OK Dude and Menu > Save setup save into it. If its Show maps option is on, its maps replace the muffins maps.
- **Stats tracker**: **Change stats…** opens the Stonks launcher the same way.
- **Racetime**: show or hide the race room, and set the room link. The bar above the race room hides chat and blurs finish times.

**Wide** layout, with muffins maps set beside the items:

- Row 1: items, light world map, dark world map.
- Row 2: xkeys panels (entrance seeds only).
- Row 3: stats tracker and race room.

Drag the dividers to resize; double-click one to reset it. View > Layout has two other arrangements.

**Vertical** layout, for smaller screens: items over the light and dark world maps on the left, sized to the window height; xkeys panels, stats tracker and race room on the right. The muffins tracker is switched to stacked maps for it (for 2.0, the session's own map mode comes back in Wide). GGW's maps are not shown in Vertical.

## Privacy

- The app sends nothing anywhere. It has no analytics, telemetry or update checks.
- The trackers and racetime.gg load from their own sites, exactly as in a browser.
- Logins (racetime.gg) stay signed in through the site's normal session cookie in the app's own profile. The app never sees or stores passwords, and on Windows the cookie store is encrypted by the OS.
- Pages get no camera, microphone, location or notification access. The trackers may reach your local network, for SNI and emulators; the race room may not. Links to other sites open in your default browser.
- Settings and xkeys setups are plain JSON in the app's data folder (`%APPDATA%\ALttP Tracker` on Windows, `~/Library/Application Support/ALttP Tracker` on macOS).

## Credits

- [Muffins tracker](https://alttprtracker.mfns.dev/) and [2.0](https://volatile.alttprtracker.mfns.dev/) ([source](https://github.com/KrisDavie/alttptracker)) by muffins and contributors.
- [Stonks Tracker](https://thettracker.vercel.app/) by StructuralMike.
- [z3rTracker](https://github.com/okay-dude/z3rTracker) by GGW, fearagent, dunka and bonta; bundled in `vendor/z3rTracker`.
- [racetime.gg](https://racetime.gg/).

## License

The app's own code is [MIT](LICENSE).

That license does not cover anything the app loads or bundles from others:

- `vendor/z3rTracker` is z3rTracker by GGW and contributors, included as published with its credits in `vendor/z3rTracker/about.txt`. It stays under its authors' terms.
- The muffins tracker, Stonks Tracker and racetime.gg are loaded from their own sites and belong to their owners.
- The Legend of Zelda and its sprites, including the boots in the app icon, are property of Nintendo. This is an unofficial fan tool.

## Building

```
npm install
npm start            # run from source
npm run dist:win     # Windows installer and portable exe in dist.nosync/
npm run dist:mac     # macOS zip
```

`scripts/update-z3r.sh` refreshes the bundled z3rTracker from its latest release.
