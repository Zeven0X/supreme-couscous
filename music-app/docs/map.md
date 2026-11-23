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
| — | Icon: torn page with a loop trail to an X. Page style: dark "winding trail". |

## Build steps
1. ✅ Map page: board, add songs, move, zoom, Start.
2. ⬜ Path button.
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

## How it works (simple words)
- The map is a list of stops. Each stop remembers which song it is, where it sits (x, y) and its own effects.
- The view is like a camera over a big table: moving changes where the camera is, zoom changes how close it is. Songs keep their real place on the table.
