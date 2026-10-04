# Apex Formula

3D open-wheel racing game with keyboard and gamepad controls, AI rivals,
local split-screen, driving settings, sound controls and personal race records.

## Play locally in a browser

Install Python 3, then run from the repository root:

```sh
python -m http.server 8080 --bind 127.0.0.1 --directory source/app
```

Open http://127.0.0.1:8080 in a browser with WebGL support.

## Windows desktop development

Install Node.js LTS. From `source`, run `npm ci`, then `npm start`.
Optional native controller vibration: run `npm run build:native` on Windows
with the .NET Framework C# compiler installed.
To build a portable Windows executable, run `npm run dist` in `source`.
Desktop packaging with these pinned development tools has not been verified.

## Controls

- W/S or arrow keys: accelerate/brake; A/D: steer.
- Shift: boost; Q/E: manual gears; C: camera; R: recover; P/Esc: pause.
- Gamepad: left stick steers; triggers accelerate/brake.

## Tests

Node.js 22 or newer: `node --test tests/*.test.mjs`.
See VALIDATION.md for the published snapshot's actual test results.

## Snapshot and licensing

Game files are taken from the installed desktop snapshot, with the additional
camera-feel module retained for tests. Local backups, diagnostics, profiles,
credentials and compiled executables are excluded.
The original game metadata is UNLICENSED; publication does not add an open-source
license. Bundled Three.js and fonts retain their MIT and OFL notices in
`source/app/street/vendor/THREE-LICENSE.txt` and `source/app/formula/fonts/`.
