# Tonix (music app)

## Quick facts
- Offline music app for Windows. Built with Electron (a way to make desktop apps with web code) + ffmpeg (the sound engine).
- Folder: `music-app\`. Name: **Tonix** (renamed from "Tune Forge" 2026-11-23). Version 1.2.0 (studio pitch).
- Updates: Claude installs them on the user's PC. Old installer goes to `Documents\Tonix\Old versions` (not built yet).

## How to run
- Get the Windows app: GitHub → Actions → "Tonix (Windows build)" → newest run → Artifacts.
- Developers: `cd music-app`, `npm install`, `npm start`. Tests: `npm test`.

## Where we stopped
- 2026-11-23: **Playlists part 1** built (Playlists tab, add by right-click / drag / Add files, reorder, shuffle, picture, rename, delete). Next: part 2, smart shuffle (play counts + blacklist / favourite, back to normal after songs × 4 plays). Then save a playlist, stars 1–10, information inside saved files.

## Pages
1. [Map](docs/map.md): songs connected by paths with chances, played by luck.
2. [Settings and keyboard shortcuts](docs/settings.md): 9 sections, 7 looks, 46 shortcuts you can change, map undo/redo.
3. [Sound panel](docs/sound-panel.md): pitch (studio quality, Natural voice), speed, volume, fades.
4. [Saving songs](docs/saving.md): the save window, Fill from name, file types.
5. [Library](docs/library.md): Clear all music, Playlists (part 1); smart shuffle, playlist saving and stars planned.
6. [Sound editor](docs/sound-editor.md): Trim, Split, Effects, Loop, Layers (designed, not built).

## Top bar buttons
| Button | Status |
|---|---|
| 🔍 Search (library) | ✅ Working |
| 🗺 Map | ✅ Working (all 8 steps done) |
| 📏 Sound editor | 🎨 Designed, not built yet |
| ⚙ Settings | ✅ Working (9 sections) |

## Recent changes
- 2026-11-23: **Playlists tab** in the Library: make playlists, add songs (right-click, drag cards, Add files), drag to reorder, Play, Shuffle, picture, rename, delete.
- 2026-11-23: **Clear all** button in the Library toolbar (songs leave Tonix, files stay on your PC, maps kept).
- 2026-11-23: **Speed fixed while listening.** It used the player's own simple speed control (the bad sound you heard); now the studio tool makes the copy at the new speed too. Pitch checks 21/21.
- 2026-11-23: **New Save song window**: Fill from name (reads artist and title from the original file name), ⇄ Swap, all boxes shown, Type (MP3 / M4A / FLAC / WAV / OGG), Quality with file size, File name, Save in + Change…, last choices remembered. OGG imports now keep their names.
- 2026-11-23: **Right-click menu** added everywhere you type (Undo, Redo, Cut, Copy, Paste, Delete, Select all) and on selected text (Copy). Before: right-click did nothing. Found by you in the save window. Pitch fixes from the code review: a broken copy no longer leaves the song silent, the song blending out keeps its clean pitch, at most 3 songs are prepared ahead, short parts are tidied up, all jobs stop when Tonix closes.
- 2026-11-23: **Pitch fixed.** A professional pitch tool (Rubber Band) now does pitch and speed for saved files, and makes a clean pitched copy for listening (first 20 s ready in under a second, whole song a few seconds later, kept for next time). New **Natural voice** switch on the Pitch card. Settings → Library shows the space the copies use, with Clear. Checks: 44 automatic tests, pitch check 18/18, final check 21/21.
- 2026-11-23: Renamed everything to Tonix (1.1.0). Undo now keeps quick actions as separate steps. Final check script: `test/e2e/final-check.js`.
- 2026-11-23: Settings page (9 sections, 7 looks), keyboard shortcuts for everything (changeable, cheat sheet with ? / F1), map undo/redo (Ctrl+Z / Ctrl+Y), number keys choose the next map path. Fixed a start-up timing bug.
- 2026-11-23: Map step 7: export a map as one .tonixmap file (songs, covers, pictures inside) and import it as your own copy.
- 2026-11-23: Map step 6: many maps (new, rename, cover, delete to trash, switch) and Continue where the music stopped.
- 2026-11-23: Map step 5 part 2: real crossfades (two songs overlap and blend). The app now has two players inside.
- 2026-11-23: Map step 5 part 1: Play map follows the paths by chance, with quiet gaps, the glowing dot, Follow, and click-to-choose. Crossfade still plays like a cut.
- 2026-11-23: Map step 4: each song on the map has its own sound settings, edited with the Sound panel; double-click plays it.
- 2026-11-23: Map step 3: path settings panel (name, chance with lock and even split, join type, color, line style).
- 2026-11-23: App look chosen: **Midnight glass** (dark blue frosted glass, silver highlights) with the improved layout. Not built yet.
- 2026-11-23: Midnight glass part 1 built: new colors and glass panels, top bar (logo, Library/Map buttons with words, search box), Now playing card, Sound panel (one tidy list, ↺ reset in the middle of each row, Reset all). Waveform and map paths now silver. 
- 2026-11-23: Midnight glass part 2 built: Library page (title + song count, tabs All / Recently added / From videos, cards with artist names, new toolbar with words, "Save 2 songs" shows how many are picked) and Filters panel (typing box + clickable name chips per group, "Clear", how many songs match).
- 2026-11-23: Midnight glass part 3 built: player bar (song info on the left; smaller skip buttons labeled 30 / 5 / 5 / 30 with the waveform under them; **main volume** slider 0-100% on the right, remembered between starts, only changes what you hear and never the saved files). Left to restyle: Map toolbar and pop-up windows.
- 2026-11-23: Midnight glass part 4 built: Map page (grouped toolbar, glass label with map name + song/path count, silver rings and glow) and all pop-up windows (save windows, song picker, background picker). **The new look is now on every screen.**
- Build order decided 2026-11-23: 1) finish the new look (player bar + map page), 2) finish the Map (steps 3–8), 3) the sound editor.
- 2026-11-23: Sound editor designed (5 tabs, smart connect, 3 save modes).
- 2026-11-23: Map backgrounds: 20 built-in, your own pictures (tiles), song-name color.
- 2026-11-23: Paths can be drawn by hand and bent with handles.
- 2026-11-23: Map step 2. Path button, paths with even-split chances, loops, remove with Undo.
- 2026-11-23: Map step 1. Map button with the loop-trail icon.
- 2026-11-23: Page, caliper and gear buttons hidden (code kept) until planned with the user.

## Ideas for later
- Compare speed/pitch tools by ear (Rubber Band vs Signalsmith Stretch) with one good-quality song, for the last 10% of quality.
- Lyrics, equalizer, visualizer.
- Drag songs straight from the Search page onto the Map.
