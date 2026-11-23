# Tonix (music app)

## Quick facts
- Offline music app for Windows. Built with Electron (a way to make desktop apps with web code) + ffmpeg (the sound engine).
- Folder: `music-app\`. Current name in code: "Tune Forge". New name decided: **Tonix** (rename not done yet).
- Updates: Claude installs them on the user's PC. Old installer goes to `Documents\Tonix\Old versions` (not built yet).

## How to run
- Get the Windows app: GitHub → Actions → "Tune Forge (Windows build)" → newest run → Artifacts.
- Developers: `cd music-app`, `npm install`, `npm start`. Tests: `npm test`.

## Where we stopped
- 2026-11-23: Map backgrounds done (20 built-in, own pictures, song-name color). Next: Map step 3, path settings.

## Pages
1. [Map](docs/map.md): songs connected by paths with chances, played by luck.
2. [Sound editor](docs/sound-editor.md): Trim, Split, Effects, Loop, Layers (designed, not built).

## Top bar buttons
| Button | Status |
|---|---|
| 🔍 Search (library) | ✅ Working |
| 🗺 Map | 🧪 Being built (step 2 of 8 done) |
| 📏 Sound editor | 🎨 Designed, not built yet |
| ⚙ Settings | 💤 Hidden, not planned yet |

## Recent changes
- 2026-11-23: App look chosen: **Midnight glass** (dark blue frosted glass, silver highlights) with the improved layout. Not built yet.
- 2026-11-23: Midnight glass part 1 built: new colors and glass panels, top bar (logo, Library/Map buttons with words, search box), Now playing card, Sound panel (one tidy list, ↺ reset in the middle of each row, Reset all). Waveform and map paths now silver. 
- 2026-11-23: Midnight glass part 2 built: Library page (title + song count, tabs All / Recently added / From videos, cards with artist names, new toolbar with words, "Save 2 songs" shows how many are picked) and Filters panel (typing box + clickable name chips per group, "Clear", how many songs match).
- 2026-11-23: Midnight glass part 3 built: player bar (song info on the left; smaller skip buttons labeled 30 / 5 / 5 / 30 with the waveform under them; **main volume** slider 0-100% on the right, remembered between starts, only changes what you hear and never the saved files). Left to restyle: Map toolbar and pop-up windows.
- Build order decided 2026-11-23: 1) finish the new look (player bar + map page), 2) finish the Map (steps 3–8), 3) the sound editor.
- 2026-11-23: Sound editor designed (5 tabs, smart connect, 3 save modes).
- 2026-11-23: Map backgrounds: 20 built-in, your own pictures (tiles), song-name color.
- 2026-11-23: Paths can be drawn by hand and bent with handles.
- 2026-11-23: Map step 2. Path button, paths with even-split chances, loops, remove with Undo.
- 2026-11-23: Map step 1. Map button with the loop-trail icon.
- 2026-11-23: Page, caliper and gear buttons hidden (code kept) until planned with the user.

## Ideas for later
- Lyrics, equalizer, visualizer.
- Drag songs straight from the Search page onto the Map.
