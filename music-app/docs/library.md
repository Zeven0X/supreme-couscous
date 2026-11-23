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
- The playlist buttons: ▶ Play and 🔀 Shuffle on top; 📂 Add files, 💾 Save, 🗑 Delete below.
- The toolbar hides "Save album" and the picture-size slider on the Playlists tab. On smaller windows, "Upload folder" and "Save album" show only their icon (hover for the name).

### Checked
- Automatic test: order kept, each song once, unknown songs dropped, a removed song leaves the playlist, saved and loaded again.
- In the real app on the build computer (14/14): make, right-click add, drag add, upload reports known + new songs, drag to reorder, play in order, Next follows, shuffle keeps the list, take out, rename, kept after restart, removed song leaves the playlist, delete keeps the songs.
- **Not yet tried by you.**

### History
- 2026-11-23: Part 1 built. Your request: "the player can create a playlist that he can add the songs that he wants. And the user can organize them…", plus "add a button for opening files" and "shuffle mode".

## Smart shuffle — current state ✅ part 2 of 5 (2026-11-23)
- **Where:** a playlist's **🔀 Shuffle on**, and Settings → Playing → **Smart shuffle in the library**.
- **How it works (simple words):** every song gets "lottery tickets". The next song is drawn by luck, but songs with more tickets win more often. Tonix always lines up the next 3 songs (you see them under "Up next").
  - **Played a lot lately** → fewer tickets, down to about 1 in 10. Tonix does this by itself (a small **↓** shows on the song).
  - **Hardly played lately** → more tickets (up to 3×), so forgotten songs come back.
  - **🚫 Blacklist** (your mark) → about 1 in 10 as often.
  - **♥ Favourite** (your mark) → more often. In tests it played about 1.7× as often; it can't reach the full 3× because a song never comes back too soon.
  - A song never plays twice in a row. The songs that just played are skipped (the last third of the playlist).
- **"Lately" = the last (number of songs × 4) plays** (your rule). In a 10-song playlist that's 40 songs. After that many plays, marks end by themselves and everything is back to normal. The end of a mark is fixed when you set it, so it is the same in the library and in playlists.
- **What counts as "played":** you heard at least 30 seconds (or half of a short song). Quick skips don't count.
- **Where to mark:**
  - Right-click songs → **🚫 Blacklist** / **♥ Favourite** / **Back to normal**. Works for many songs at once.
  - In a playlist, hover a song → **♥** or **🚫**. A switched-on mark stays visible.
  - Song cards show **🚫**, **♥** or **↓** in the corner.
- Songs from the **Map** don't change your library or playlist order.

### Checked
- Automatic tests: tickets (played a lot = fewer, never = more, 4 plays = normal), marks end after songs × 4 plays, never the same song twice. In 6,000 test picks from 10 songs: blacklisted 62, a normal song about 610, favourite 1,030.
- In the real app on the build computer (11/11): marks set and shown; 3 songs lined up; 40 songs played: never twice in a row, every song got a turn, the blacklisted song played 0 times while blacklisted and 5 of 18 afterwards; a 5-second listen doesn't count; kept after a restart.
- **Not yet tried by you.**

### History
- 2026-11-23: Part 2 built. Your words: "Make it smarter. If a song appears so much, it should be blacklisted and appear much less. Vice versa", "they can return back to normal after a while", "after the amount of songs × 4".
- 2026-11-23: Fixed while building: when a song came up a second time in shuffle, Tonix looked for its first place in the order and kept bouncing between 2 songs. Now Tonix remembers its exact place.

## Save a playlist — current state ✅ part 3 of 5 (2026-11-23)
- **Where:** a playlist's **💾 Save** button. (Library → select songs → **Save album** opens the same window.)
- **The window** (same style as Save song):
  - Picture: the playlist's picture, or click a song's small picture, or choose a new one.
  - **Album** = the playlist name, filled in for you. Also Album artist, Date, Genre, Label.
  - **Order:** the songs, numbered. You can move or leave out songs for this save only (the playlist itself doesn't change).
  - **Save as** (you choose each time, your choice C3):
    - **One file per song:** a new folder; files named "01 - Song", "02 - Song"…; every file gets the album name, its track number ("1/12") and the picture; a cover.jpg goes in the folder too.
    - **One big file:** all songs joined, with a chapter mark at each song. Only MP3 or M4A can hold chapter marks, so the other types are greyed out.
  - **Type**, **Quality** (with size and total time), **Name**, **Save in** + Change…
  - Last choices are remembered (one file per song or one big file, type, quality, folder). Saving many songs has its own remembered type, so it doesn't change the Save song window.
- If **Settings → Saving → Ask where to save every time** is on, the "Save in" row says "Windows will ask where", and Windows asks.

### Checked
- Automatic tests: one big M4A with chapter marks.
- In the real app (9/9): album name = playlist name; songs in playlist order; one file per song as FLAC → "Night drive" folder with "01 - Iron Heart.flac"… + cover.jpg, right title / album / picture inside; choices remembered; one big file allows only MP3 / M4A; one big M4A with a chapter for each song.
- **Not yet tried by you.**

### History
- 2026-11-23: Part 3 built (replaces the old "Save N songs together" window). Your words: "can save them all and in this save menu it can automatically save the album name" and "I choose each time".

## Star ratings 1–10 — current state ✅ part 4 of 5 (2026-11-23)
- **On each song card:** a row of 10 small stars under the artist. Hover the card and click a star to rate. Click the same star again to remove the stars. Clicking stars never selects or plays the song. Songs without stars only show the row when you hover.
- **In the save windows:**
  - Save song: a **Stars** row (big stars) and a new **Track number** box.
  - Save playlist / many songs: small stars on each song in the list.
  - Stars changed there are kept on the song.
- **Star filter:** Filters → **Stars** (the first group at the top of the panel). Click a number of stars, then **or more** / **exactly** / **or less**. Example: 6 stars + "or more" = **6⭐+**. Songs without stars are hidden while the star filter is on. **Clear** at the top of Filters turns it off. Click the same star again to turn the filter off.

### Checked
- Automatic test: 6⭐ or more / 4⭐ or less / exactly 6⭐, unrated hidden.
- In the real app (11/11, together with part 5): rate on cards; 6⭐ or more, 6⭐ or less, exactly 3⭐; Clear; the save window shows and changes stars.
- **Not yet tried by you.**

### History
- 🔄 2026-11-23: Star filter moved to the **top** of the Filters panel. Before: at the bottom, you had to scroll to find it. Your words: "Star filter should be in the filter section."
- 2026-11-23: Built. Your words: "in any save menu, the user can rate the song from 1-10 stars so in the library can select the songs to listen to with the amount of stars. For example 6⭐️+ or 4⭐️-".

## Information inside saved files — current state ✅ part 5 of 5 (2026-11-23)
- **Every saved file now carries:** title, artist, album, album artist, date, genre, **label**, **track number**, picture, and Tonix's own information: **stars**, **🚫 blacklist / ♥ favourite** (if still active), and **how many times you played it**.
- **Where it sits inside the file:**
  - **MP3, FLAC, OGG:** the Tonix part goes in its own fields (TONIX_STARS, TONIX_SHUFFLE, TONIX_PLAYS). Other music apps keep them but ignore them.
  - **M4A, WAV:** these can't hold extra fields (M4A would lose its picture), so the Tonix part goes into the normal **Comment** field as "Tonix: stars=8; shuffle=black; plays=12". On M4A the **label** goes there too, because M4A has no label field. Before this, labels were lost when saving as M4A.
- **Upload it again** (into your Tonix or a friend's): stars, blacklist / favourite, plays, track number and label come back. A blacklist / favourite starts fresh in the new library (it lasts songs × 4 plays from then).
- **Not inside:** the sound settings (speed, pitch, fades…). They are already baked into the saved sound, so storing them would apply them twice on upload.
- **Windows Explorer** won't show Tonix's 1–10 stars: Windows uses its own 5-star system, which the sound engine can't write.

### Checked
- Automatic test: save with stars 7, blacklist, 12 plays, track 3/12 and a label in **all 5 types**, read back: everything comes back in every type.
- In the real app: saved as M4A, uploaded into a brand-new Tonix → 8 stars, blacklist, track 3/12 and label all back.
- **Not yet tried by you.**

### History
- 2026-11-23: Built. Your words: "the music that is saved from Tonix should have all the properties like label, number, star rating, black listing. And etc", "The information should be saved with the video".

## Smart playlists (made by Tonix) — current state ✅ (2026-11-23)
- **What:** Tonix makes a playlist for **every genre + star count** by itself, e.g. **"6⭐ Rock"** = Rock songs with **exactly** 6 stars, **"2⭐ Pop"** = Pop songs with exactly 2 stars (your choices: exact stars, Tonix makes them, no maximum size).
- **Where:** Library → Playlists, under **"Made by Tonix (genre + stars)"**, grouped by genre, best stars first. Your own playlists stay on top under "Your playlists".
- **They fill themselves:** rate a song or change its genre and it moves to the right playlist straight away. A playlist with no songs left disappears. Songs without stars or without a genre are not in any smart playlist.
- A song with two genres (like "Rock; Pop") is in both.
- **You can:** ▶ Play, 🔀 Shuffle (remembered for each smart playlist), 💾 Save (the album name becomes "6⭐ Rock"), and ♥ / 🚫 the songs.
- **You can't:** rename, change the picture, reorder, add or take out songs by hand, or delete. Tonix decides from the stars and the genre. The order is by song title.

### Checked
- Automatic test: one playlist per genre + exact stars, any spelling of the genre ("Rock" / "rock"), two genres = both playlists, a re-rated song moves.
- In the real app (8/8): none before rating; after rating "2⭐ Pop, 9⭐ Rock, 6⭐ Rock" appear by themselves; 6⭐ Rock has the 2 right songs; no rename / delete / add buttons; re-rating moves a song; play; Save names the album "9⭐ Rock"; shuffle kept after a restart.
- **Not yet tried by you.**

### History
- 2026-11-23: Built. Your words: "A playlist of the stars amount for that genre. 6⭐️ rock. 2⭐️ pop", exact stars (B1), Tonix makes them (B2), no maximum (B4).

## Ideas for later (playlists)
- Show stars in playlist rows too; sort a playlist by stars.
