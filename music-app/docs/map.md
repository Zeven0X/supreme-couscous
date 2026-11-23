# Map

A music board. Songs are placed anywhere and connected by paths. When a song ends, Tonix picks one of its paths by chance and plays the song it leads to.

## Decisions (2026-11-23)
| # | Decision |
|---|---|
| 1 | Songs are dragged anywhere. The user picks the Start song (🚩). |
| 2 | Path chances are percents that add to 100%: auto even split, auto balance, lock 🔒, quick buttons, thick line = likely. |
| 3 | A song with no paths out → music stops. |
| 4 | Loops allowed, a map can play forever. |
| 5 | Paths have color, line style and a name/label. |
| 6 | Each path picks its blend: crossfade (length set), silence, or cut. |
| 7 | A song added to a map starts with its library effects; map changes are separate. |
| 8 | The same song can be on a map more than once. |
| 9 | A Path button adds paths and connects songs. |
| 10 | While playing: a glowing dot travels the path and the view follows. |
| 11 | Listeners can click a path to choose it. |
| 12 | Export = one file with songs, names, covers, paths, changes + a map cover. |
| 13 | Others open it in Tonix and it becomes their copy. |
| 14 | One map open at a time, as many maps as wanted, autosave + resume where playback stopped. |
| 15 | Paths can be **drawn by hand** (freehand route) and reshaped with **bend handles**. (Added 2026-11-23.) |
| 16 | Each map has its own **background**: 20 built-in ones (mix of themes) or the user's own picture (repeats like tiles, travels inside the export file). It moves and zooms with the map. (Decided 2026-11-23, not built yet.) |
| — | Icon: torn page with a loop trail to an X. Page style: dark "winding trail". |

## Build steps
1. ✅ Map page: board, add songs, move, zoom, Start.
2. ✅ Path button. 🔄 2026-11-23: + draw paths by hand, bend handles.
2b. ⬜ Backgrounds: previews of 20 first, then the Background button.
3. ⬜ Path settings.
4. ⬜ Song settings on the map.
5. ⬜ Playing a map.
6. ⬜ Many maps.
7. ⬜ Export / Import.
8. ⬜ Tests + Windows build.

## Elements

### Board
- **Now:** dark dotted area. Drag empty space to move around. Mouse wheel or the slider zooms (30–250%). "Show all" (F) fits every song on screen.
- **History:** 2026-11-23 added.

### Song stops
- **Now:** round cover with orange ring and name. Drag to move. Click to select (white ring). Right-click: Set as Start / Remove from map. Delete key removes, with an Undo button.
- If a song is removed from the library, its stop turns grey and says "Missing song".
- **History:** 2026-11-23 added.

### Add songs
- **Now:** "Add songs" opens a picker with search. Click songs to tick them (numbered in pick order), then "Add N songs". They appear in neat rows in the middle of the view. Each keeps its own copy of the song's effects.
- **History:** 2026-11-23 added.

### Start song
- **Now:** orange flag on the cover. The first song added becomes Start automatically. Change it with "Set start" or the S key.
- **History:** 2026-11-23 added.

### Saving
- **Now:** every change saves by itself, about half a second later. Each map is its own file in the library folder (`maps\`). Moving around and zoom are remembered too.
- **History:** 2026-11-23 added.

### Path button
- **Now:** "Path" in the toolbar (or the P key) turns Path mode on: the button glows and the cursor becomes a cross.
  - Click a song (it gets a white ring), then click the song the path goes to. A dotted line follows the mouse in between.
  - Dragging from one song and letting go on another also works.
  - Click the same song twice for a **loop** (the song can repeat itself).
  - Path mode stays on, so you can connect many songs in a row. Esc cancels the half-made path; Esc again (or the button) turns Path mode off.
  - Right-click a song → "Start a path from here".
  - Connecting the same two songs the same way twice is refused with a message.
- **History:** 2026-11-23 added.

### Drawing paths by hand
- **Now:** in Path mode, press on a song and **draw** to another song, then let go. The path follows your drawing.
  - Your line is cleaned up: shaky bits are smoothed and only the important points are kept (14 at most).
  - A quick click on one song then another still makes the automatic curve. A nearly straight drawing also becomes the automatic curve.
  - Draw away from a song and back onto it for a hand-drawn **loop**.
  - Drawing between two songs that are already connected that way **redraws** that path.
  - Letting go on empty space cancels, with a message.
  - Move a song and its drawn paths **stretch and turn with it**, keeping their shape.
- **History:** 2026-11-23 added. Before: paths could only be connected, always as an automatic curve.

### Bend handles
- **Now:** click a path to select it. White dots are its points: drag them to bend the path. Small faint dots add a new point when dragged. Double-click a white dot to remove it.
  - **Straighten** (button above the map, or right-click the path) goes back to the automatic curve, with Undo.
- **History:** 2026-11-23 added.

### Paths
- **Now:** curved lines with an arrow. A→B and B→A bend to opposite sides so both stay visible. A loop is an arc over the cover.
  - Each path shows its chance in a small label, and **thicker lines = more likely**.
  - A new path splits the song's chances evenly (2 paths = 50/50, 3 = 34/33/33). Always whole numbers adding to 100.
  - Click a path (or its label) to select it. Delete or right-click → "Remove path", with Undo. The other paths from that song grow back to 100%, keeping their sizes relative to each other.
  - Removing a song also removes its paths and fixes the chances of songs that pointed to it.
  - Songs with no paths out show a grey **END** badge (the music stops there). It only appears once the map has at least one path.
  - Every path already stores its blend (crossfade 3 s), color, line style and name, ready for step 3.
- **History:** 2026-11-23 added.

## How it works (simple words)
- The map is a list of stops. Each stop remembers which song it is, where it sits (x, y) and its own effects.
- A path remembers: which song it starts from, which song it goes to, and its chance. The chance math lives in `renderer/chance.js` and is tested on its own (6 tests): whole numbers, always 100, locks respected, and luck really follows the chances (70/30 over 20,000 tries).
- A drawn path stores a few points measured from its two songs (how far along the way from A to B, and how far to the side). That is why the drawing follows when a song moves. This math is in `renderer/pathshape.js` with 6 tests.
- The view is like a camera over a big table: moving changes where the camera is, zoom changes how close it is. Songs keep their real place on the table.
