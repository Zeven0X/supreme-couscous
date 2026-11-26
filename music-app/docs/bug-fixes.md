# Bug fixes (big bug hunts)

Every bug found in a hunt, in simple words. Newest hunt first. "Checked" says how we know it's fixed.

## Bug hunt 2 — "Test all the features and fix all the bugs" (2026-11-26)
You asked to test everything. Four testers used the real app at the same time, each one an area. All fixes were then
checked again (unit tests: 82 pass, incl. a new file `test/bughunt.test.js`; studio check 68 / 68; every other app check).

### Most important (could lose your files or work)
- **Saving a song over its own file deleted it.** (Ask where to save → you picked the song's own file.) Now refused with a
  clear message, any letter case.
- **Every save is now written whole first** (under a hidden temporary name next to it) and renamed at the end, trying again
  for a moment if Windows holds the file. A failed or stopped save never leaves half a song behind.
- **Closing Tonix during a save** left half-written files in your folders. Now they are removed.
- **Replace (Edit page)**: if Windows refused the last rename, both the original and your edit could be gone. Now your edit
  is always kept (as "… New" if needed); the original is in the Recycle Bin with its own name.
- **Replace on a video or an unusual file type** (.opus, .aiff, .wma…) put an MP3 in its place and binned the original. Now
  the original is always kept; the edit is saved next to it (a note says so).
- **Starting Tonix a second time** wiped the open Edit page's undo history. Now the second start only shows the first window.
- **The library file** is now really written to the disk and a last good copy (`library.json.bak`) is kept, so a power cut
  can't empty your library.

### Library and saving
- A Sound change (speed, pitch, volume, fades) was lost if you switched songs or closed Tonix within ¼ second. Now saved at once.
- Uploading a "One big file" Tonix made gave it the last song's title. Fixed.
- Saving many songs stopped at the first missing file. Now missing songs are skipped and listed; the others are saved.
- "Save song" with a missing file stored the new tags anyway. Now it says the file is gone and changes nothing.
- WAV files lost the Label. Fixed; a label with ; or = keeps them.
- Album save copied song 1's genre / date / label onto every song. Now those boxes are only filled when all songs share them.
- Saved files can't be louder than your Volume safety limit (you already heard them capped).
- A failed save no longer makes the next file "Song (2)".
- "Keep both" no longer copies a 🚫 / ♥ shuffle mark that never ends.
- Same loudness says when a song's file is missing. Renaming a playlist to nothing keeps its old name. Full playlist names show
  on hover. "Show the file" says when a file was moved or deleted. The next-song key says nothing when nothing plays.
- Removing the playing song during a Blend also stops the song that was fading out.
- Notices now appear in the middle above the player (they covered the Sound buttons); the Sound panel fits at 1280 × 800.
- Names with spaces like "Hello_World-Remix" are no longer split into artist and title at the hyphen.
  *Still the same on purpose:* "Self-Control" (no spaces) is read as "Self" – "Control", because "Artist-Title" looks the same.

### Map, Settings and keys
- A map whose only paths were 0 % crashed and got stuck. Now 0 % paths are picked evenly.
- Undo on the map while its song played left the sound out of step. Fixed.
- A playing song taken off the map now still follows its old paths (it said "END").
- Esc in the "Your maps" rename box saved the name and closed the window. Now Esc cancels the typing only.
- The path name box showed an old name after Undo. A lone locked path now always counts 100 %; L can't lock a song's only path.
- Map changes made just before closing were lost. Now saved on close (and where the song is).
- Changing a shortcut only freed the first other action using that key. Now all of them. Keys 1–9 are kept for choosing
  map paths. Arrow keys on a slider move the slider (not the song).
- On the Edit page, the Library player's keys (speed, pitch, volume, skip) no longer change the Library song.
- The map hint no longer hides under the map-name card; the map toolbar wraps with Big text.

### Edit page
- At 1280 px wide the TRACK settings (Repeat, Use from–to, Match beat, Auto-quiet, Left ⟷ Right) were hidden. Now shown.
- Changes made while "Apply to the song" or Save was working were thrown away. Now the whole page waits (with its message).
- Added tracks now move with the music after Cut, Keep, Trim, Loop and Connect (and come back with Undo).
- Removing the open song from the Library left a hidden song that still played. Now the Edit page closes it.
- Marks after Smart connect / Loop moved by the wrong amount; now by the real change. Marks right at A / B stay after Cut.
- If Cut can't run (busy), your selection stays. Dragging B before A clears the part. Esc clears A / B too.
- **Loop A–B now jumps back exactly on time** (no small gap at each jump).
- A track added at the very end starts at 0:00 (it was invisible and left out of the file).
- Split: renaming / volume of a part are kept when you drag its cut; Save all parts / Same loudness can't run twice; cut
  numbers on the ruler are in order. Edit many showed the word "null". Mark names never repeat.
- Songs with no beat (a held tone, rain, talking) no longer get a made-up tempo.
- The Save button no longer runs off the edge at 1280 / 1440 px. The Mixer fader goes to 400 % like the rest.
- One effect timer per track (a fast click could leave a track's live effects out of date).

### Smaller back-end fixes
- A broken web request can't freeze Tonix. Match-beat copies are written safely and only once. Map pictures with % in their
  name. Split save checks every part first and reports any that failed. A tag saying "Duration: 1:00:00" can't fake the
  length. A missing album picture can't turn a finished album into an error. Fast pitch changes never end with no sound.
  No long freeze when the library file is locked. Old speed copies are tidied (newest 40 kept). Shorter temporary names
  for very long song names.

### Known and left for later
- Joining 300+ songs into one file may be too long a command for Windows.
- Importing a whole drive can make Tonix wait while it looks through the folders.
- Edit page copies of long songs use disk space until the song is closed.

## Bug hunt 1 (2026-11-24)
See the Sound editor page ("Fixed after the independent review", "Fixed after the Edit-page bug hunt") and PROJECT.md
"Recent changes" for the first hunt (server crash, stream leaks, single instance, save order, Esc stack, and more).
