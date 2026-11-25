# Sound editor (📏 Edit page)

Its own page: the **📏 Edit** button in the top bar (or **Ctrl+3**), or right-click a song → **📏 Edit…**
Now laid out like a music studio program, design B (see **Version 3** below). Bottom tabs: **Sound · Effects · Mixer · Trim · Split · Loop · Connect**.
*Before (2026-11-24):* version 2, with panels **Trim · Split · Effects · Loop · Connect** and a left inspector strip.
*Before (2026-11-23):* tabs **Trim · Split · Effects · Loop · Layers** under one big waveform.

## Version 3 — design B: marks, Smart loop v2, Sound + Fades for every track 🔄 (2026-11-25)
You tried version 2 and said: loops were hard to make (dragging the exact spot, zoom moving by itself), the play bar at the
bottom was confusing, Speed / Pitch / Volume / Fade in / Fade out were missing, and the emojis looked poor. You picked
**design B (dark pro studio), improved**, after seeing 3 designs. Built "all at once".
*Before:* version 2 (see below): a left "inspector" strip, emojis, tool bar + panel buttons in two rows, no marks.

### What you see
1. **Top bar (one row, drawn icons):** start · back 5 s · ▶ play · ■ stop · forward 5 s · **Loop A–B** · **Rec** · green clocks
   (**TIME**, **BAR | BEAT**, **TEMPO**) · tools **Select / Cut / Keep / Move** · **Snap** (Off → Beat → Bar, click to change) ·
   **Mark (M)** · Undo / Redo · zoom − / + · **Follow** (off: the view stays where you put it) · Open · how to save · **Save**.
2. **Left column:**
   - **MARKS:** your landmarks. Each has a colour, a name you can type, its time (click it to jump there), **A**, **B** and ✕.
   - **Part:** the A → B part.
   - **Smart loop**, and its results.
   - **ADD A TRACK:** Song track, Built-in sound, Record voice.
3. **The tracks:**
   - **Overview strip:** the whole song.
   - **Ruler with 3 rows:** time, bars, and **marks** (coloured flags; the A and B marks are green).
   - **One row per track:** a coloured strip, its icon, **M**, **S**, volume, a level meter, and a short line like "Speed 100% · Pitch +0.0 · 2 effects · fades".
   - **Fades are drawn on each track** as a white curve. The selected track shows **two white squares** you can drag to change the fades.
4. **Bottom tabs:**
   - **Sound:** for the selected track. Three sections side by side:
     - **SOUND:** Speed, Pitch (with semitones), Volume. Each has a slider, the exact number (you can type it), and **−25 −5 −1 ↺ +1 +5 +25** buttons. **Natural voice**, **Reset all**.
     - **FADES:** Fade in, Fade out, each with **−1 −0.5 −0.1 ↺ +0.1 +0.5 +1** second buttons. Three shapes: **Straight**, **Smooth**, **Slow start**. A small picture of the fades.
     - **TRACK:** Left ⟷ Right. For an added track also: which part of the sound to use, where it starts, Repeat, Match beat, Auto-quiet.
   - **Effects:** the 6 live knobs.
   - **Mixer:** a strip per track with a fader, a meter, left/right, M and S, plus **MASTER**.
   - **Trim, Split, Loop, Connect:** the same as before.
5. **The Library player** becomes a small, quiet bar at the bottom while you are on the Edit page.

### Marks (landmarks on the song)
- **Put one:** press **M** while the song plays (or is stopped), click **Mark (M)**, or click the **bottom row of the ruler**.
- **Move one:** drag its flag. **Rename:** type in the list (or double-click the flag). **Remove:** ✕.
- **Choose a part:** press **A** on one mark and **B** on a later one. The part between them is selected, ready for
  Loop, Cut, Keep or Smart loop. Snap (Beat / Bar) also puts new marks on the beat.
- When you **cut**, **keep** or **trim**, the marks move with the music. Marks inside a removed part go away.
  *Not done yet:* Undo does not bring removed marks back.

### Smart loop v2
- Press **Smart loop** (left column, or in the Loop tab) after choosing A and B.
- **What it does:** Tonix looks at **every beat up to 4 bars before and after your A and your B**. For each possible
  start and end, it checks how alike the music sounds around the end and around the start:
  - the notes and tone, in 24 bands from low to high;
  - the loudness.
  Joins that are a whole number of bars get a small bonus, because they feel natural. It also prefers to stay close to your marks.
- It shows the **3 best joins**, each with a score ("97%"), the bars ("Bar 6 → 13") and the length. Press ▶ on one to
  hear the moment the end jumps back to the start, then **Use it**. Your A and B marks move to that join, and the Loop tab opens.
- Each join is then fine-tuned to the exact sample so the waveforms line up, with no click.
- *Before (version 1–2):* Smart loop only moved B by at most 0.25 s.

### Sound + Fades for every track
- **Speed / Pitch:** Tonix makes a studio-quality copy of the track at that speed and pitch in the background (you see
  "Making the new sound…" for a moment). The live player then plays that copy. Natural voice works as in the Library.
  When the song itself is faster or slower, the added tracks move with it, like with Slowed.
- **Volume and fades** change at once while it plays.
- **Fade curves** use exactly the same maths live and in the saved file: Straight = straight line, Smooth = half a wave,
  Slow start = squared. They were checked against ffmpeg's own fades.
- **Save** writes everything: speed, pitch, volume, fades, effects and tracks.

### Fixed after the independent review (14 findings, 2026-11-25)
- **Apply to the song** with Speed / Pitch changed could play the song twice as fast afterwards. Fixed.
- **Undo / Redo** now bring your marks (and the A–B part) back to where they were.
- Marks now also move after **Apply loop**, **Smart connect** and a speed change from **Apply to the song**.
- Old Smart loop results disappear when the song changes. A track's fade handle no longer sits past the song's end.
- **Speed x Match beat** is kept between 0.25x and 4x everywhere (live, the timeline and the saved file).
- The same speed copy asked for twice at once is made only once (before, two jobs could write the same file).
- Old speed copies are freed from memory. A removed track or another song no longer gets a late copy.
- **Smart loop** now looks only at the sound around A and around B (faster on long parts), can keep a mark at 0:00
  or at the very end, and a missing setting no longer breaks it.
- A fade that fails to schedule falls back to full volume instead of a half fade.

### Checked
- **Unit tests:** 76 pass (new: Smart loop with two separate windows; a join that starts at 0:00; speed limits). Earlier: Smart loop v2 on a made-up song with chords repeating every 4 bars finds 3 perfect
  8 s and 16 s loops on the beat, in 0.24 s; a join into a different part scores lower.
- **In the real app (automatic):** studio check 59 / 59 (new: no double speed-up after Apply, marks follow it and come back on Undo; small Library bar, M key mark, ruler-click mark, A/B, rename,
  Smart loop 3 results within 4 bars, Use it, Speed +25 plays faster from a copy, fades, Mixer strips, saved file has the
  speed (29.3 s as expected) and fades in); Edit check 14 / 14; panels check 20 / 20 (a mark after B moves with Apply loop).
- **Not checked:** how it sounds through speakers; a real microphone; Smart loop on many real songs (only the 3 test songs).

## Version 2 — studio layout with live effects 🔄 (2026-11-24, reworked in version 3)
You showed a screenshot of a music studio program (Ardour) and asked for the editing to look like that, and chose
**live effects** (heard at once while playing). Concept v2 approved ("A1"), then built.
*Before:* one big waveform, 5 tabs under it, and every effect / layer needed **Preview** then **Apply**.

### What you see (top to bottom)
1. **Transport bar:** ⏮ start · ⏪ back 5 s · ▶ play / pause · ■ stop (back to where you pressed Play) · ⏩ forward 5 s ·
   **⟲ Loop A–B** (plays the selected part over and over, key **L**) · **● Rec voice** · the clocks: **Time** (green),
   **Bar | Beat**, **Tempo** (BPM), **Selected** · **↶ Undo / ↷ Redo** · **📂 Open…** · how to save (Keep both / New takes the name /
   Replace the original) · **💾 Save**.
2. **Tool bar:** **⬚ Select** · **✂ Cut out** · **◧ Keep only** · **↔ Move** (drag a track's sound left / right) ·
   **Snap** Off / Beat / Bar (selections and moved sounds land on the beat or the bar) · **Panel** Trim / Split / Effects / Loop / Connect ·
   zoom − / + / Fit (Ctrl + mouse wheel zooms too).
3. **Left: the selected track** (click a track to select it): its name, its **effect chain** (green dot = on, **LIVE**;
   click a chip to switch it off), **+ Add effect**, Left ⟷ Right, a big **volume fader** with a level meter, **M** / **S**.
   For an added track also: which part of the sound to use, where it starts, Repeat, **Match beat**, **Auto-quiet**.
4. **The tracks:** an **overview** of the whole song (click / drag to look at another part when zoomed in), a ruler with
   **Time**, **Bars** and **Markers** (A and B of the selection, the split cuts, the Connect point), then one row per track.
   Each row has a coloured strip, **M** (mute), **S** (solo: only solo tracks are heard), a volume slider and a left / right
   slider; its sound is drawn as a rounded clip with a title bar. Under them: **+ Song track**, **+ Built-in sound**, **+ Record voice**.
5. **Bottom panel:** **Effects** = 6 knob cards (switch on, then drag the knob up / down or use the mouse wheel), **All off**,
   **Apply to the song**. Or Trim, Split, Loop, Connect (they work as before).
- On the Edit page the left column (Now playing, Sound) is hidden so the tracks get the whole width. It comes back on the other pages.

### How it works (simple words)
- **Everything plays live.** Each track goes through its own chain: effects → volume → left / right → level meter → the main output.
  Turning a knob or a slider changes what you hear right away; switching an effect on or off restarts the sound at the same spot
  (a tiny jump you may hear).
- **The same numbers for listening and saving.** One small file (`fxmath.js`) holds the effect numbers (how long the echo is,
  how much bass, …). The live player and the saving engine both read it, so the saved file sounds like what you heard.
- **Save** first mixes everything you hear (effects, volumes, left / right, mute / solo, added tracks) into the song as one change,
  then saves it in the way you picked. **Apply to the song** does the mixing step only (Undo takes it back).
- **Slowed + reverb** and **Nightcore** change the speed, so they only work on the song track (on other tracks they are greyed out).
  The added tracks move with the song when it is slowed.
- **Cut, Trim, Split, Loop, Connect** still change the song itself (a new working copy each time, so Undo works). Your added tracks
  and live effects stay while you do that.
- **Auto-quiet** (good for your voice): the song gets quieter while that track sounds, live and in the saved file.
- The saved mix stops when the song ends (like the live player); a longer added track is cut there.

### Fixed while building it
- A voice track with **Auto-quiet** used to cut the saved song short where the voice ended. Now the song plays to its end.
- Pressing Play then Pause quickly could still start the sound a moment later. Now Pause wins.

### Fixed after the independent review (14 findings, 2026-11-24)
- A preview and the live tracks could play on top of each other; Space during a preview left the blue bar stuck.
- **Rec voice** kept the microphone on after leaving the Edit page or opening another song. Now it stops (and keeps the recording as a track on the same song).
- A preview that took a while could start playing on another page. Now it is dropped.
- Memory: old working copies stayed decoded in memory (≈ 115 MB each for a 5-minute song). Now only what is in use is kept.
- The auto-quiet helper piled up while playing for a long time. Now there is only one.
- **Left ⟷ Right** sounded different live than in the saved file. Now both turn one side down the same way.
- Your voice landed a little late in the mix. Now it lines up with what you heard.
- 8D and 1D sounded lopsided live on mono songs. Fixed (mono becomes stereo first, like the saved file).
- **Apply to the song**, then Undo, lost the tracks and effects. Now Undo brings them back and Redo mixes them in again.
- Play could run past the end if the song failed to load; now it stops at the end or shows an error.
- A slow change (cut, trim…) finishing after you opened another song could land on the wrong song. Now it is dropped, and opening waits until the change is done.
- Trim could stay stuck on "Looking for silent parts…" after an Undo.
- "Use the playhead" during a preview used the preview's time. Now it stops the preview first.
- Double-click on Rec started two recordings; a muted solo track counted as solo in the saved file only; 8D's room order differed.

### Fixed after the Edit-page bug hunt (20 findings, 2026-11-24)
- **Split** ignored names / speed / pitch / volume typed after the panel opened. Now it saves what you typed; a part keeps its settings when you add or remove another cut.
- **Loop** and **Smart connect** used an old selection. Now they use the one you see.
- Edit keys (Delete, Ctrl+Z…) worked behind an open window (like "Replace the original?"), and Esc couldn't close it. Now the window gets the keys.
- After **New takes the name**, the editor reopened the old original. Now it goes on with the new song.
- A click after "play this part" jumped back. Ctrl+Shift+Z now redoes (it undid). Opening the same song again no longer throws your changes away. Another song starts at 0:00.
- The arrow keys moved the Library player on the Edit page; now ← / → move 5 s here (End = the end). Space on a slider plays the Edit page.
- Undo / Redo are faster on long songs (each copy's waveform is made once).
- **Replace** on a song from a video no longer shows it as a video. Muted tracks are not mixed in.
- **Edit many songs:** a fully quiet song now says why it is skipped; songs no longer in the library are counted; a missing original is noticed before the work starts.
- Already fixed before this report: tracks making the saved song longer, Trim stuck on "Looking…".

### Checked
- **Unit tests:** 74 pass (new: a track longer than the song stops with it; a short auto-quiet track doesn't cut the song).
- **In the real app (automatic):** new studio check 40 / 40 (the review's and the bug hunt's scenarios too; open, select, play, meters, Space, live Echo + Slowed, knob drag,
  rain / song / voice tracks, Move, Mute, all panels, cut / undo / redo keep the tracks, Save = slowed file with everything mixed);
  Edit check 14 / 14 (3 save modes); panels check 18 / 18 (Trim, Split + Same loudness, live effects + Apply, Loop + Smart loop,
  tracks + Match beat + Apply, Smart connect).
- **Not checked:** how it *sounds* to a person (the test machine has no speakers); a real microphone (only a fake one).


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

## Part 4 — Effects 🔄 (now live knobs, see Version 2)
- 6 cards, each with an on / off switch and a **strength** slider:
  - **Echo:** repeats, like a big hall.
  - **Slowed + reverb:** slower and lower, with a soft room. (The song gets longer.)
  - **Nightcore:** faster and higher. (The song gets shorter.)
  - **Bass boost:** stronger low sounds.
  - **8D:** the sound slowly moves around your head (best with headphones).
  - **1D:** every speaker plays the same; nothing moves left or right.
- Several can be on together. A limiter stops it from getting too loud.
- *Before (2026-11-23):* **▶ Preview**, then **✓ Apply effects**, on the song only. Now each track has its own effects, heard live.

## Part 5 — Loop 🔄 (Smart loop v2 + marks, see Version 3)
- Select the part on the waveform: start = **A**, end = **B** (green letters, with "×3").
- **✨ Smart loop:** moves A and B a tiny bit (at most 0.25 s) to the spot where the end flows into the start without a bump. It tells you how far it moved them.
- **Play it − 3 + times**, with **New length: 4:21 (now 3:10)**.
- **▶ Listen to the join** plays the moment where B jumps back to A. **✓ Apply loop**.

## Parts 6–8 — Layers + Smart connect 🔄 (layers are now tracks, see Version 2)
- **Add a layer** (it starts at the playhead):
  - **+ Song…**: any song from your library.
  - **+ Built-in sound…**: Rain, Ocean waves, Vinyl crackle, Wind, Campfire, Beat (120 BPM click). Tonix makes these itself from noise and tones; nothing is copied. They repeat until the song ends.
  - **🎙 Record your voice**: the song plays while you record, so you can talk or sing along. Your voice gets **Auto-quiet** switched on.
- **The layer lanes:** each layer as a strip with its little waveform, on the same timeline as the song. **Drag a strip** left or right to move it.
- **Each layer:** Starts at, Part (from – to: use only a piece of it), Volume, Left ⟷ Right, Repeat (1× / 2× / 4× / 8× / Until the end), **♪ Match beat** (speeds the layer up or down so its beat matches the song), **🔉 Auto-quiet** (the song gets quieter while this layer sounds), **M** mute, **S** solo, **✕** remove. Plus **Song volume** for the song itself.
- *Before (2026-11-23):* **▶ Preview the mix**, then **✓ Mix in**, in a Layers panel with small lanes. Now each layer is a track row, heard live, and **Save** mixes it in.
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
