# Sound editor (📏 Edit page)

Its own page: the **📏 Edit** button in the top bar (or **Ctrl+3**), or right-click a song → **📏 Edit…**
Tabs: **Trim · Split · Effects · Loop · Layers**.
Status: **all 8 parts built** (2026-11-23). Click a tab to open its panel under the waveform; click it again to close it.

## Build plan (agreed 2026-11-23; you chose "all at once" for parts 2–8)
1. ✅ The Edit page: big waveform, select, zoom, cut out / keep only, Undo / Redo, Save in 3 modes.
2. ✅ Trim (silent start / end).
3. ✅ Split + Same loudness.
4. ✅ Effects (Echo, Slowed + reverb, Nightcore, Bass boost, 8D, 1D).
5. ✅ Loop + smart loop.
6. ✅ Layers part 1 (songs, built-in sounds, your voice on top).
7. ✅ Layers part 2: Smart connect.
8. ✅ Layers part 3: auto-quiet, match beat, repeat.

## Every tab, in short
- Every change makes a new working copy, so **Undo** works for all of them. **▶ Preview / Listen** buttons let you hear a change first: a blue bar says "You are hearing how it would sound. Nothing is changed yet." with **Stop preview**.
- Nothing touches your files until you press **Save** (or Split's **Save all parts**).

## Part 2 — Trim ✅
- Opens with the song checked straight away. The silent start and end turn **red** on the waveform, with "Silent start: 1.50 s · Silent end: 1.00 s".
- **What counts as silent:** Very quiet (near-total silence) / Quiet (also soft hiss) / A bit quiet (also quiet intros and endings).
- **▶ Listen to the result**, then **✓ Confirm: remove them**.
- If the whole song is quieter than the level, nothing is trimmed and it says so.

## Part 3 — Split ✅
- **🔍 Find the songs:** finds quiet gaps between songs in one long file and puts an **orange cut** in the middle of each. Gap length: Short gaps / Normal / Long gaps.
- **Drag** an orange line to move a cut. **+ Add a cut at the playhead** adds one. **✕** on a part removes the cut after it (joins it with the next).
- **Each part:** a name (e.g. "Mix - Part 1"), its time, **Speed / Pitch / Volume** boxes, **▶** to play it.
- **🔊 Same loudness:** measures how loud each part is on average (the way radio stations measure it) and sets the volumes so they all sound equally loud.
- **💾 Save all N parts as songs:** each part becomes its own file **next to the original** (never replacing anything), with its own speed / pitch / volume, track number "1/5", picture and information, and joins your library.

## Part 4 — Effects ✅
- 6 cards, each with an on / off switch and a **strength** slider:
  - **Echo:** repeats, like a big hall.
  - **Slowed + reverb:** slower and lower, with a soft room. (The song gets longer.)
  - **Nightcore:** faster and higher. (The song gets shorter.)
  - **Bass boost:** stronger low sounds.
  - **8D:** the sound slowly moves around your head (best with headphones).
  - **1D:** every speaker plays the same; nothing moves left or right.
- Several can be on together. **▶ Preview**, then **✓ Apply effects**. A limiter stops it from getting too loud.

## Part 5 — Loop ✅
- Select the part on the waveform: start = **A**, end = **B** (green letters, with "×3").
- **✨ Smart loop:** moves A and B a tiny bit (at most 0.25 s) to the spot where the end flows into the start without a bump. It tells you how far it moved them.
- **Play it − 3 + times**, with **New length: 4:21 (now 3:10)**.
- **▶ Listen to the join** plays the moment where B jumps back to A. **✓ Apply loop**.

## Parts 6–8 — Layers + Smart connect ✅
- **Add a layer** (it starts at the playhead):
  - **+ Song…**: any song from your library.
  - **+ Built-in sound…**: Rain, Ocean waves, Vinyl crackle, Wind, Campfire, Beat (120 BPM click). Tonix makes these itself from noise and tones; nothing is copied. They repeat until the song ends.
  - **🎙 Record your voice**: the song plays while you record, so you can talk or sing along. Your voice gets **Auto-quiet** switched on.
- **The layer lanes:** each layer as a strip with its little waveform, on the same timeline as the song. **Drag a strip** left or right to move it.
- **Each layer:** Starts at, Part (from – to: use only a piece of it), Volume, Left ⟷ Right, Repeat (1× / 2× / 4× / 8× / Until the end), **♪ Match beat** (speeds the layer up or down so its beat matches the song), **🔉 Auto-quiet** (the song gets quieter while this layer sounds), **M** mute, **S** solo, **✕** remove. Plus **Song volume** for the song itself.
- **▶ Preview the mix**, then **✓ Mix in** (one change; Undo takes the layers out again).
- **Smart connect** (bottom of the Layers panel):
  1. **The piece:** "Use the selection" (a part of this song) or "From another song…" (pick a song, type from / to).
  2. **Where it goes:** move the playhead there, "Use the playhead" (a green line shows it).
  3. **How:** Hard cut / Smooth (0.5 s blend) / Long blend (3 s), and "Then the song goes on" or "The song ends there", and **Land on the beat** (moves the cuts to the nearest beat, at most 0.25 s).
  - **▶ Preview** (starts 3 s before the join), then **✓ Connect**.

## Edit many songs together ✅ (2026-11-24)
- **Where:**
  - Library: select songs, right-click → **📏 Edit N songs together…**. With several songs selected, the menu also has **📏 Edit this song…** for just the one you clicked.
  - Edit page (no song open): **Edit many songs at once…** → tick the songs (or **Pick all**).
- **The changes** (the same on every song, chosen for you because they need no hand-picking):
  - **Trim the silent start and end** (Very quiet / Quiet / A bit quiet).
  - **Effects:** Echo, Slowed + reverb, Nightcore, Bass boost, 8D, 1D, each with its strength.
  - Loop, Split and Layers stay one song at a time, because you point at places in each song.
- **Save each song** in one of the 3 ways: **Keep both** ("Name New" next to each original, the default) / **New takes the name** (originals become "Name Old") / **Replace the originals** (to the Recycle Bin; Tonix asks first).
- Tonix works through the songs one by one (progress at the top) and you can keep using it. At the end a window says "Done: 8 saved, 2 skipped" and lists **why** a song was skipped (for example "nothing to change (no silent start or end)", or "the file is not on your PC any more"). **Show the files** opens the folder.
- **Checked** in the real app: 4 songs, Trim + Echo, Keep both → 4 "… New" files next to the originals, 3 s of silence gone from the trimmed ones, originals untouched; a song with nothing to trim is skipped with the reason; the Edit page's tick-the-songs picker works.

## How it works (simple words)
- **Silence and gaps:** Tonix listens for parts quieter than the chosen level (in decibels).
- **Loudness:** measured like radio stations do (LUFS), then each part's volume is set to reach the average.
- **Smart loop:** Tonix compares the sound right after A with the sound around B and picks the B that looks most alike, so the jump back is smooth.
- **Beats:** Tonix looks for the moments the sound suddenly gets louder (drums), finds how often that repeats (the tempo), and puts the beats on that grid. It prefers usual tempos (60–180) because half or double speed look alike.
- **Recording:** your microphone recording becomes a normal sound file right away (in the library folder, "recordings").

## Checked (parts 2–8)
- Automatic tests (9 groups, real sound): trim finds 1.5 s / 1.0 s of silence; split finds the gap at 5.5 s; same loudness makes two parts equally loud (within 0.3 dB); smart loop lands on whole sound waves; the 120 BPM beat is found; all 6 effects alone and together; loop × 3 gives the right length; layers with delay, repeat-until-end, auto-quiet, mute and solo; smart connect from this or another song, also at the very start and the very end.
- In the real app (17/17) on a test file with 2 songs: trim 29.0 → 26.5 s; split finds the cut at 13.25 s; same loudness sets 58 % / 171 %; 2 part files saved; effects preview + apply; loop × 3; rain + a song + a recorded voice (fake microphone) mixed in; smart connect; tab switching doesn't pile up listeners.
- An independent code review found 10 problems (a smart connect at 0:00 gave a broken file, a trim failure could retry forever, a recording timer could run forever, mouse listeners piled up, preview edge cases, numbers not checked); all fixed and tested.
- **Not yet tried by you**, and the microphone was only tested with a fake one.

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

### Edit many songs together ✅ (2026-11-24)
- **Where:**
  - Library: select songs, right-click → **📏 Edit N songs together…**. With several songs selected, the menu also has **📏 Edit this song…** for just the one you clicked.
  - Edit page (no song open): **Edit many songs at once…** → tick the songs (or **Pick all**).
- **The changes** (the same on every song, chosen for you because they need no hand-picking):
  - **Trim the silent start and end** (Very quiet / Quiet / A bit quiet).
  - **Effects:** Echo, Slowed + reverb, Nightcore, Bass boost, 8D, 1D, each with its strength.
  - Loop, Split and Layers stay one song at a time, because you point at places in each song.
- **Save each song** in one of the 3 ways: **Keep both** ("Name New" next to each original, the default) / **New takes the name** (originals become "Name Old") / **Replace the originals** (to the Recycle Bin; Tonix asks first).
- Tonix works through the songs one by one (progress at the top) and you can keep using it. At the end a window says "Done: 8 saved, 2 skipped" and lists **why** a song was skipped (for example "nothing to change (no silent start or end)", or "the file is not on your PC any more"). **Show the files** opens the folder.
- **Checked** in the real app: 4 songs, Trim + Echo, Keep both → 4 "… New" files next to the originals, 3 s of silence gone from the trimmed ones, originals untouched; a song with nothing to trim is skipped with the reason; the Edit page's tick-the-songs picker works.

## How it works (simple words)
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
- 2026-11-24: **Edit many songs together** added (Trim and / or Effects on many songs, each saved in one of the 3 ways). Your choice: "Same edit on many songs, save each".
- 2026-11-23: Parts 2–8 built in one go (your choice): Trim, Split + Same loudness, Effects, Loop + smart loop, Layers with built-in sounds and voice recording, Smart connect, auto-quiet, match beat, repeat. Previews for every change.
- 2026-11-23: Part 1 built (the Edit page). The 📏 Edit button is back in the top bar.
- 2026-11-23: designed. Before: the caliper button was hidden with no plan.
