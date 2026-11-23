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
| 16 | Each map has its own **background**: 20 built-in ones (mix of themes) or the user's own picture (repeats like tiles, travels inside the export file). It moves and zooms with the map. Song-name color: Auto (dark on light backgrounds), White, Dark or any color. (Built 2026-11-23.) |
| — | Icon: torn page with a loop trail to an X. Page style: dark "winding trail". |

## Build steps
1. ✅ Map page: board, add songs, move, zoom, Start.
2. ✅ Path button. 🔄 2026-11-23: + draw paths by hand, bend handles.
2b. ✅ Backgrounds: 20 built-in, your own pictures, song-name color.
3. ✅ Path settings.
4. ✅ Song settings on the map.
5. ✅ Playing a map (follow paths by chance, quiet gaps, cut, real crossfades, dot, follow view, choose).
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

### Backgrounds
- **Now:** "Background" in the map toolbar opens a picker with 20 built-in backgrounds:
  Dark dots, Graph paper, Old parchment, Treasure map, Night sky, Galaxy, Deep ocean, Tropical sea, Forest, Mountains (contour lines), Neon grid, Circuit board, Desert dunes, Snow field, Lava, Blueprint, Chalkboard, Sheet music, Vinyl records, Honeycomb.
  - Each map has its own background. It moves and zooms with the map and repeats with no seams.
  - Clicking a background changes the map right away, so you can try them while the picker is open.
  - New maps start on Dark dots.
- **History:** 2026-11-23 added. Before: every map had the same dark dotted background.

### Your own background pictures
- **Now:** "Add my picture" in the picker. The picture is copied into the library (`maps\assets\`), shrunk to at most 1024 px wide, and repeats like tiles.
  - Your pictures appear in the picker with a ★ and can be reused. Hover one and click × to take it out of this map (the copy stays on disk).
  - They are listed inside the map so they will go into the exported file (step 7).
  - A photo that isn't made to repeat will show its edges where the copies meet; patterns look best.
- **History:** 2026-11-23 added.

### Song-name color
- **Now:** in the picker: **Auto** (dark names on light backgrounds like parchment, snow, desert, sheet music; white names on dark ones), **White**, **Dark**, or **Color** (any color). A matching outline keeps names readable. Saved per map.
- **History:** 2026-11-23 added.

### Path settings panel
- **Now:** click a path and a panel opens on the right side of the map. Close it with × or Esc.
  - **Name:** optional. It shows on the path's label next to the chance.
  - **Chance:** type an exact number, drag the slider, or use −25 −5 −1 +1 +5 +25. The other paths from the same song share what is left, keeping their sizes relative to each other. Always whole numbers that add up to 100.
  - **Lock 🔒:** a locked path keeps its chance when the others change. A 🔒 shows on its label.
  - **Even split:** gives every unlocked path from that song the same chance.
  - **Paths out of this song:** a small list with each chance. Click one to jump to that path.
  - The only path out of a song is always 100%, so its chance controls are switched off.
  - **Join** (how one song flows into the next): Crossfade (blend for 0–15 s), Silence (quiet gap of 0–15 s), or Cut (next song starts right away). Saved now; you will hear it when map playing is built (step 5).
  - **Color:** 9 ready colors or any color. **Line:** Solid, Dashed or Dotted.
  - **Remove path** button.
- Pop-up messages now appear at the bottom left (under the Sound panel) so they never cover the map panel.
- **History:** 2026-11-23 added.

### Song settings on the map
- **Now:** click a song on the map and the **Sound panel on the left** edits that song's own map copy (fade in, fade out, speed, pitch, volume). The panel gets a silver frame and says "on the map: <song>".
  - The song in the library is **not changed**. The same song placed twice on a map can sound different each time.
  - A small **FX** badge shows on songs that have any sound change.
  - **Double-click** a song on the map to play it with its map settings (it stops at its end; full map playing is step 5). While it plays, the panel keeps editing that song, and you hear changes right away.
  - Right-click → "Play with its map settings" or "Use the library settings again" (with Undo).
  - Click empty space and, if nothing from the map is playing, the panel goes back to the playing library song. Leaving the Map page does the same.
- **History:** 2026-11-23 added. Before: map songs had a hidden copy of the settings that could not be changed.

### Playing a map
- **Now:** **Play map** (bottom left of the map) starts at the Start song 🚩. Double-click any song to play the map from there. The button turns into **Stop map**.
  - The playing song has a pulsing ring. Its outgoing paths glow.
  - When a song ends, Tonix picks one of its paths **by chance** (using the percents) and plays the song it leads to.
  - **Choose instead of luck:** click a glowing path. It lights up white and will be taken next. Click it again to leave it to luck.
  - **The glowing dot** travels along the path that was taken.
  - **Join types:** Silence = the dot travels during the quiet gap, then the next song starts (pressing Play during the gap skips it). Cut = the next song starts right away. Crossfade = the next song starts **before** the old one ends, so both play together for the blend time: the old one fades out while the new one fades in, and the dot travels during the blend. The blend is never longer than half the song.
  - **Follow** (next to Stop map): the view glides to the playing song when it is near the edge or off screen. Click Follow to turn it off.
  - A song with no paths out is an END: the music stops with a message.
  - Paths to missing songs are skipped.
  - Playing a normal library song stops the map.
  - The map remembers which song it reached (used for "continue" in step 6).
  - For a crossfade, luck has to decide a little early (15 seconds before the song ends). You can still click a path to choose until the blend starts.
- **History:** 2026-11-23 part 1 added. 2026-11-23 part 2: real crossfades (🔄 before: crossfade played like a cut). 🔄 Before (step 4): double-clicking a map song played only that one song and stopped.

## How it works (simple words)
- The map is a list of stops. Each stop remembers which song it is, where it sits (x, y) and its own effects.
- A path remembers: which song it starts from, which song it goes to, and its chance. The chance math lives in `renderer/chance.js` and is tested on its own (6 tests): whole numbers, always 100, locks respected, and luck really follows the chances (70/30 over 20,000 tries).
- A drawn path stores a few points measured from its two songs (how far along the way from A to B, and how far to the side). That is why the drawing follows when a song moves. This math is in `renderer/pathshape.js` with 6 tests.
- The built-in backgrounds are tiny pictures made in code (`renderer/backgrounds.js`), so they add almost nothing to the app's size. Anything near a tile's edge is also drawn on the opposite edge, so the repeated copies meet with no seams.
- The Sound panel asks one question before every change: "what am I editing?" The answer is, in order: the selected map song, else the map song that is playing, else the playing library song. So it always edits what you see or hear.
- The app has two music players inside. Normally only one plays. During a crossfade the old song keeps playing on its player and fades out, while the second player starts the next song and becomes the main one.
- The view is like a camera over a big table: moving changes where the camera is, zoom changes how close it is. Songs keep their real place on the table.
