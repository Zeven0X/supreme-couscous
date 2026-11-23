# Sound editor (📏 Edit page)

Its own page: the **📏 Edit** button in the top bar (or **Ctrl+3**), or right-click a song → **📏 Edit…**
Tabs: **Trim · Split · Effects · Loop · Layers**.
Status: **part 1 of 8 built** (the page, the waveform, cut / keep, undo / redo, the 3 save modes). The tabs are shown but greyed out until their part is built.

## Build plan (agreed 2026-11-23)
1. ✅ The Edit page: big waveform, select, zoom, cut out / keep only, Undo / Redo, Save in 3 modes.
2. Trim (silent start / end).
3. Split + Same loudness.
4. Effects (Echo, Slowed + reverb, Nightcore, Bass boost, 8D, 1D).
5. Loop + smart loop.
6. Layers part 1 (songs, built-in sounds, your voice on top).
7. Layers part 2: Smart connect.
8. Layers part 3: auto-quiet, match beat, repeat.

## Part 1 — the Edit page ✅ (2026-11-23)
### What you see
- **Top:** the song (picture, title, artist, and which change you are on), the 5 tabs (greyed out for now), **↶ Undo**, **↷ Redo**, **Open…** (edit another song).
- **The waveform** with a time ruler:
  - **Drag** across it to select a part (it turns blue). Drag a blue edge to change it. Shift + click makes the selection bigger.
  - **Click** to jump there.
  - **Ctrl + mouse wheel** zooms around the mouse; the mouse wheel alone scrolls. Or use **− / + / Fit**. When zoomed in, a scroll bar appears under the waveform.
- **Under it:** ▶ play / pause (the edited song), the time, what is selected, **▶ Play selection**, **✂ Cut out**, **⬚ Keep only this**, **Clear**.
- **Save** with 3 choices (big cards), then **Save**:
  - **Keep both:** new file "Song New" next to the original; the original stays as it is. The new song joins your library as "Song New".
  - **New takes the name:** the new file gets the original's name; the original file becomes "Song Old" (in the library too).
  - **Replace the original:** asks first, then the new file takes the name and the original file goes to the **Recycle Bin** (you can still get it back there). The song in your library now plays the new file.
- **Keys on the Edit page:** Space = play / pause, Delete = cut out, Ctrl+Z / Ctrl+Y = undo / redo, Esc = select nothing.

### How it works (simple words)
1. Opening a song makes a clean working copy. Your file is **never touched while you edit**.
2. Each change (cut, keep…) makes a **new copy**. Undo and Redo just step between the copies, like pages in a flip book.
3. Every cut gets a tiny 6-millisecond fade, so it never clicks.
4. Saving writes the whole new file **first**. Only when that worked is the original renamed or moved to the bin. If something goes wrong, your original stays as it was.
5. The new file keeps the song's information (title, artist, stars, label, picture…). Videos and unusual file types are saved as MP3.
6. The working copies are deleted when Tonix closes.

### Checked
- Automatic tests: cut, keep, undo, redo, a new change after undo, "can't cut the whole song", the original untouched while editing; the 3 save modes on real files; a failed save leaves the original alone.
- In the real app (14/14, on copies of songs): opens from right-click → Edit; drag selects 0:10–0:20; Delete cuts 40 s → 30 s; Ctrl+Z / Ctrl+Y; zoom; Keep both → "Rainfall New.mp3" (original kept, new song in the library); New takes the name → "Golden Hour Old.mp3" + new "Golden Hour.mp3"; Replace asks first, Cancel does nothing, then the shorter file has the name and the original went to the bin.
- **Not yet tried by you.** The Recycle Bin was tested on Linux, not on Windows.

## Decisions (2026-11-23)
| # | Decision |
|---|---|
| 1 | Trim ("smart cut"): finds the silent parts at the start and end, **shows them**, removes them when you click **Confirm**. "Silence" level: Very quiet / Quiet / A bit quiet. |
| 2 | Split: finds where songs change inside one big file and cuts it into parts. Cuts can be moved or added. Each part gets its own speed, pitch and volume. All parts are saved as separate songs. |
| 3 | **Same loudness** button (Split): measures how loud each part is on average and changes their volumes so they all sound equally loud. |
| 4 | Effects: Echo, Slowed + reverb, Nightcore, Bass boost, 8D, and **1D** (same sound from every speaker, nothing moves). Each has on/off + a strength slider. |
| 5 | Loop: choose a start (A) and an end (B). **Smart loop** moves A and B a tiny bit so the end joins the start smoothly. Choose how many times; the new length is shown. |
| 6 | Layers: put other songs, beats, built-in sounds (rain, vinyl crackle, ocean…) or your recorded voice on top. As many layers as wanted. Tools: move, cut, volume, left/right, mute/solo, auto-quiet, match beat, repeat, record. |
| 7 | **Smart connect** (Layers): cut a part of a song and join it to a different part (same or other song). Tonix moves the cut so it lands on the beat and blends the join: Hard cut / Smooth / Long blend. |
| 8 | Save has 3 modes: **Keep both** (new = "Name New", original keeps its name) · **New takes the name** (original becomes "Name Old") · **Replace the original** (save new, delete original, asks first). |
| 9 | "Replace the original" also deletes the **real file on the PC**, always after an "are you sure?" question. (Decided 2026-11-23.) |

## History
- 2026-11-23: Part 1 built (the Edit page). The 📏 Edit button is back in the top bar.
- 2026-11-23: designed. Before: the caliper button was hidden with no plan.
