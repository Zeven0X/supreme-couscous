# Settings (⚙) and keyboard shortcuts

Open with the ⚙ **Settings** button in the top bar, **Ctrl + ,** or **Ctrl + 4**. A list on the left jumps to each section.
Every change is saved right away and works right away. Built 2026-11-23.

## Sections
| Section | What it does |
|---|---|
| General | Open on (Library / Map / Last page) · Continue the map's music when Tonix opens · "Are you sure?" before removing songs |
| Look | 7 looks: Midnight, Warm glass, Sunset, Ocean, Aurora, Pastel (light), Cover colors (the colors come from the playing song's picture) · Text size (Small / Normal / Big) · Glass blur · Animations on/off |
| Playing | When a library song ends: next / repeat / stop · Shuffle · Blend library songs (crossfade 0–12 s) · Volume safety limit (200 / 300 / 500 %) for the Volume card · Remember the main volume |
| Saving | Save folder · Ask where to save · File type for single songs (MP3 / WAV) · MP3 quality · File names (Artist - Title / Title / Title - Artist) |
| Library | Library folder · Find missing songs (their file was moved or deleted) and remove them · "From video" badge on/off |
| Map | What new paths join with (Crossfade / Silence / Cut + seconds) · Background new maps start with (any of the 20) · Labels on paths (Chance / Name + chance / Hidden) · Follow the playing song · Glowing dot |
| Map trash | Deleted maps: **Restore**, or **Delete forever** (asks first) |
| Keyboard | All shortcuts, changeable (below) |
| About & updates | Version and sound engine · Open log · Old versions folder (Documents\Tonix\Old versions) |

## Keyboard shortcuts
- **Press ? or F1 anywhere** for the cheat sheet. Any key closes it.
- Buttons show their shortcut in their tooltip, e.g. "Save song (Ctrl + S)".
- Shortcuts never run while you type in a box (except Ctrl/Alt ones that are not copy/paste/undo etc.).

| Group | Shortcuts |
|---|---|
| Playing | Space play/pause · ← / → 5 s · Shift + ← / → 30 s · Ctrl + → next song · Ctrl + ← previous song (or back to the start) · M mute · Ctrl + ↑ / ↓ main volume ±5 % |
| Sound (playing song) | [ ] speed ∓1 · - = pitch ∓1 · , . volume ∓1 · **hold Shift for 5× steps** · Alt + R reset all sound |
| Library | Ctrl + F search · Ctrl + O upload files · Ctrl + Shift + O upload folder · Ctrl + A select all · Enter play selected · Ctrl + S save song · Ctrl + Shift + S save album · Ctrl + = / Ctrl + - picture size · Delete remove selected |
| Map | Ctrl + Enter play/stop · **1–9 choose the next path** (numbers show on the glowing paths) · P path tool · A add songs · S set Start · L lock selected path · B background · F show all · Delete / Backspace remove selected · Ctrl + M your maps · **Ctrl + Z undo · Ctrl + Y (or Ctrl + Shift + Z) redo** |
| App | Ctrl + 1 / 2 / 3 / 4 pages · Ctrl + , settings · ? / F1 cheat sheet · Esc close / cancel |

### Changing a shortcut
1. Settings → Keyboard → click the shortcut → press the new keys (Esc cancels).
2. If the keys are already used where this shortcut works: **Swap them** (the other one gets your old key), **Use it anyway** (the other one loses it), or **Cancel**.
3. Some keys are refused: copy/paste/cut, Shift + a letter (that types a capital), Esc, Tab, Windows keys.
4. A changed shortcut shows "changed" and a ↺ to go back. **Reset all** puts every shortcut back.
- Keys are stored by their place on the keyboard, so they work the same in any keyboard language.

### Undo / redo (map)
- Every real change to a map can be undone: adding, moving or removing songs and paths, chances, locks, colors, joins, Start, background, sound settings on map songs. Up to 100 steps per map.
- Moving around and zooming are not changes, so they are not undone.

## How it works (simple words)
- Settings live in the library file next to your songs. Only shortcuts you changed are stored.
- The shortcut list is in `renderer/keys.js` (5 tests: key reading, no clashes in the defaults, the right action per page, swap/steal, refused keys).
- Themes only change colors (`renderer/themes.css`); the layout stays the same.

## History
- 2026-11-23: built. Before: the ⚙ button was hidden; there were about 10 fixed shortcuts.
