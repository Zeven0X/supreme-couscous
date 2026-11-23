# Library

The Library page holds all your songs: upload, search, tabs, filters, picture size, save.

## Clear all music — current state ✅ (2026-11-23)
- **Where:** Library toolbar, red **🗑 Clear all** button.
- **What it does:** removes every song from Tonix in one go.
  - Your music files on your PC are **never** deleted. You can upload them again any time.
  - The MP3 copies Tonix made from **videos** are deleted (the videos themselves stay).
  - **Maps are kept**, but their songs show as missing (your choice: "songs from Tonix only").
  - The music stops if something was playing.
- **Safety:** a window asks "Clear all 3 songs from Tonix?" and explains the points above. **Cancel** is pre-selected, so pressing Enter by accident does nothing. The red button says how many songs go ("Clear all 3").
- Empty library: just a short note, no window.
- **Checked:** in the real app on the build computer (9/9): Cancel keeps the songs, Clear all empties the library, the music stops, original files stay, the video copy goes, the map keeps its 2 stops, still empty after a restart. **Not yet tried by you.**

### History
- 2026-11-23: Added. Your request: "In the library, add a button that clears all the music."

## Playlists — current state ✅ part 1 of 5 (2026-11-23)
- **Where:** Library → **Playlists** tab (next to All / Recently added / From videos).
- **Left:** your playlists (picture, name, number of songs) and **+ New playlist**.
- **Right:** the open playlist:
  - Picture: click it to choose one. Until you do, it shows the first song's picture (your choice B4).
  - Name: click it to rename.
  - "12 songs · 43:10": the total time already counts each song's own speed.
  - Buttons: **▶ Play**, **🔀 Shuffle on/off**, **📂 Add files**, **🗑 Delete**.
  - The songs, numbered. Drag the **⋮⋮** handle to change the order. Hover a song and press **✕** to take it out (it stays in your library). Double-click a song to play the playlist from there.
- **Ways to add songs (your choice C1, all of them):**
  1. Right-click songs in **All** → **Add to playlist…** → pick a playlist (or **+ New playlist**).
  2. Drag song cards: a bar with your playlists appears at the top; drop on one (or on "+ New playlist").
  3. **📂 Add files** in the playlist: pick files on your PC. New ones join the library, and all of them go into the playlist.
- Each song is in a playlist only once. Adding it again says "Already in …".
- **Playing:** the playlist plays in its order and Next follows it. With **Shuffle on**, it plays in a random order but the list itself stays as it is (your choice A2). Smart shuffle comes in part 2.
- Removing a song from the library (or Clear all) also takes it out of every playlist. Deleting a playlist never removes songs.
- Playlists are kept in the library file and stay after a restart.
- The toolbar hides "Save album" and the picture-size slider on the Playlists tab. On smaller windows, "Upload folder" and "Save album" show only their icon (hover for the name).

### Checked
- Automatic test: order kept, each song once, unknown songs dropped, a removed song leaves the playlist, saved and loaded again.
- In the real app on the build computer (14/14): make, right-click add, drag add, upload reports known + new songs, drag to reorder, play in order, Next follows, shuffle keeps the list, take out, rename, kept after restart, removed song leaves the playlist, delete keeps the songs.
- **Not yet tried by you.**

### History
- 2026-11-23: Part 1 built. Your request: "the player can create a playlist that he can add the songs that he wants. And the user can organize them…", plus "add a button for opening files" and "shuffle mode".

## Coming next (your order)
2. **Smart shuffle:** songs that played a lot come up less often, and rarely played songs more often. You can also mark **blacklist** (about 1 in 10 as often) or **favourite** (more often). Everything goes back to normal after **(number of songs × 4)** songs have played (your rule).
3. **Save a playlist:** you choose one file per song or one big file. The playlist name becomes the album name and the songs are numbered.
4. **Star ratings 1–10** in every save window and on each song card, plus a star filter (6⭐ or more, 4⭐ or less).
5. **Information inside saved files:** label, track number, stars, blacklist, favourite and more. Tonix reads it back when you upload the file again.
