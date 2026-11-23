# Tonix (music app)

## Quick facts
- Offline music app for Windows. Built with Electron (a way to make desktop apps with web code) + ffmpeg (the sound engine).
- Folder: `music-app\`. Current name in code: "Tune Forge". New name decided: **Tonix** (rename not done yet).
- Updates: Claude installs them on the user's PC. Old installer goes to `Documents\Tonix\Old versions` (not built yet).

## How to run
- Get the Windows app: GitHub → Actions → "Tune Forge (Windows build)" → newest run → Artifacts.
- Developers: `cd music-app`, `npm install`, `npm start`. Tests: `npm test`.

## Where we stopped
- 2026-11-23: Map step 2 done (Path button, curved paths with chances). Next: Map step 3, path settings.

## Pages
1. [Map](docs/map.md): songs connected by paths with chances, played by luck.

## Top bar buttons
| Button | Status |
|---|---|
| 🔍 Search (library) | ✅ Working |
| 🗺 Map | 🧪 Being built (step 2 of 8 done) |
| 📏 Sound editing tool | 💤 Hidden, not planned yet |
| ⚙ Settings | 💤 Hidden, not planned yet |

## Recent changes
- 2026-11-23: Map step 2. Path button, paths with even-split chances, loops, remove with Undo.
- 2026-11-23: Map step 1. Map button with the loop-trail icon.
- 2026-11-23: Page, caliper and gear buttons hidden (code kept) until planned with the user.

## Ideas for later
- Lyrics, equalizer, visualizer.
- Drag songs straight from the Search page onto the Map.
