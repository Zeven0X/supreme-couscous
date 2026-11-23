# Saving songs

## Save song window — current state ✅ (2026-11-23)
Opens with **Ctrl+S** or the Save button in the Library.

### What you see
1. **Title line:** "Save song", and under it the sound settings the saved file keeps (for example "pitch 110%, fade out 3.00 s").
2. **Picture** on the left. Click it to choose another picture. A yellow note says when there is no picture, or when the chosen type can't hold one (WAV, OGG).
3. **Original name bar:** shows the song's original file name, with a **✨ Fill from name** button.
4. **Artist ⇄ Title:** the ⇄ button swaps the two boxes, in case they were filled the wrong way round.
5. **All other boxes** are always shown: Album, Date, Genre, Label.
6. **Type:** MP3, M4A, FLAC, WAV or OGG, with a short hint for each.
7. **Quality:** 128 / 192 / 256 / 320 kbps, and the file size. FLAC and WAV are lossless, so quality is greyed out.
8. **File name:** made from Artist and Title (the order follows Settings → Saving). You can type your own. A yellow note warns if a file with that name already exists. Nothing is ever replaced: the new file gets "(2)" at the end.
9. **Save in:** the folder, with **Change…**.
10. **Save MP3 / Save FLAC / …**: the button names the chosen type.

### How "Fill from name" works (simple words)
- It reads the original file name, for example `Nova Lane - Midnight Drive (Official Audio)`.
- The part before the dash becomes the **Artist**, the part after it the **Title**.
- Extras that are not part of the song name are removed: (Official Video), [Lyrics], (HD), (Remastered), "| channel name", track numbers like "03.".
- Useful extras stay: (feat. Someone), (Sky Remix), - Live.
- No dash in the name: only the Title is filled, and a short note says so.
- It only runs when you press the button (your choice, 2026-11-23).

### Remembered choices
Type, quality and folder are remembered for next time (your choice, 2026-11-23). They are the same values as in **Settings → Saving**, so changing one changes the other.

### Picture inside the file
| Type | Picture inside | Tags (title, artist…) |
|---|---|---|
| MP3 | ✅ | ✅ |
| M4A | ✅ | ✅ |
| FLAC | ✅ | ✅ |
| WAV | ❌ | title and artist only |
| OGG | ❌ | ✅ |

### Checked
- Automatic tests: every type saves with the right sound format, length, tags, and a picture where the type can hold one; 4 tests for reading names (extras removed, feat. kept, no-artist names).
- In the real app on the build computer: Fill, Swap, file name, FLAC save, remembered type and folder, "already exists" note.
- **Not yet tried by you on your PC.**

### History
- 🔄 2026-11-23: **New save window.** Before: "Save song as MP3" with a big picture, 6 boxes, and only "Saves instantly to: …" at the bottom; the type and quality could only be changed in Settings (MP3 or WAV); no way to choose the name or folder in the window. Now: Fill from name, Swap, 5 types, quality with size, file name, folder. Reason: "The save menu is bad."
- 2026-11-23: Right-click menu (Cut / Copy / Paste) added to all typing boxes. Before: right-click did nothing.
- Fixed at the same time: OGG songs you import now keep their title and artist (Tonix looked for them in the wrong place).

## Save album window — 🎨 next (part 2)
Will get the same new style. Not built yet.
