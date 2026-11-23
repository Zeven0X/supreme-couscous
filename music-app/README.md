# Tonix

An offline music app for Windows. Turn videos into MP3s, change speed, pitch, volume and fades,
build **maps** where songs are connected by paths and luck picks the way, and save everything
with covers. No internet needed. The sound engine (ffmpeg) is built in.

## Get the app (no coding needed)

1. On GitHub, open the repository's **Actions** tab, then **Tonix (Windows build)**.
2. Click the newest green run, scroll down to **Artifacts** and download **Tonix-Windows**.
3. Unzip it. You get two files:
   - `Tonix-Setup-1.2.0.exe`: installs the app with a desktop shortcut.
   - `Tonix-Portable-1.2.0.exe`: runs without installing.

Windows SmartScreen may warn you because the app is not signed. Click
**More info → Run anyway**.

## What's inside

| Page | What you can do |
|---|---|
| 🔍 **Library** | Upload files or whole folders (videos become MP3), covers or name squares, search, tabs (All / Recently added / From videos), filters by artist, date, label and genre, picture size, save a song or a whole album with a cover |
| 🗺 **Map** | Put songs on a board, connect them with paths (click or draw by hand, bend them), give each path a chance, lock, join (crossfade / silence / cut), color, line and name, set each song's own sound, 20 backgrounds or your own picture, play the map (luck or your choice, glowing dot), many maps, continue where you stopped, export / import a map as one `.tonixmap` file, undo / redo |
| 📏 **Edit** | Cut out / keep only, Trim silent edges, Split a long file into songs (+ same loudness), Effects (echo, slowed + reverb, nightcore, bass boost, 8D, 1D), Loop with smart loop, Layers (songs, built-in sounds, your voice), Smart connect, save in 3 ways |
| ⚙ **Settings** | 7 looks, text size, playing options, saving options, find missing songs, map defaults, map trash, keyboard shortcuts, about |
| Left side | Now playing + the Sound panel: fade in, fade out, speed, pitch (studio quality, Natural voice switch), volume (type exact numbers, sliders, step buttons) |
| Bottom | Play, ±5 s, ±30 s, waveform, main volume |

Press **?** or **F1** in the app to see every keyboard shortcut. All of them can be changed in
Settings → Keyboard.

More detail: [`PROJECT.md`](PROJECT.md), [`docs/map.md`](docs/map.md), [`docs/settings.md`](docs/settings.md),
[`docs/sound-editor.md`](docs/sound-editor.md) (designed, not built yet).

## Run from source (developers)

```
cd music-app
npm install
npm start        # run the app
npm test         # tests: real ffmpeg exports, studio pitch copies, chances, path shapes, maps, map files, shortcuts
npm run dist     # build dist/Tonix-Setup-1.2.0.exe and the portable exe (on Windows)
```

## Where things are kept
- Your library, maps and settings: `%APPDATA%\Tonix\library\`. Deleted maps wait in `maps\trash`.
- Saved songs and maps: `Music\Tonix Exports` (change it in Settings → Saving).
- Music files stay where they are. Videos and formats Windows can't play are converted to MP3
  inside the library folder. Removing a song never deletes your original file.
