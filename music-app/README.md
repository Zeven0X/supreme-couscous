# Tune Forge

An offline music editor for Windows. It works like VS Code, but for music:
upload any video or audio file and it becomes an MP3 you can play. You can
change speed, pitch, volume and fades, then save it instantly with a cover picture.
No internet is needed. ffmpeg is built into the app.

## Get the app (no coding needed)

1. On GitHub, open the repository's **Actions** tab, then **Tune Forge (Windows build)**.
2. Click the newest green run, scroll down to **Artifacts** and download **Tune-Forge-Windows**.
3. Unzip it. You get two files:
   - `Tune-Forge-Setup-1.0.0.exe`: installs the app with a desktop shortcut.
   - `Tune-Forge-Portable-1.0.0.exe`: runs without installing.

Windows SmartScreen may warn you because the app is not signed. Click
**More info → Run anyway**.

## Run from source (developers)

```
cd music-app
npm install
npm start        # run the app
npm test         # tests: real ffmpeg exports + pitch shifter
npm run dist     # build dist/Tune-Forge-Setup-1.0.0.exe and the portable exe (on Windows)
```

## What it does

| Area | What you get |
|---|---|
| Top bar | 🔍 Library + search · 📄 Song details (tabs) · 📏 Tools (convert, export, log) · ⚙ Settings |
| Left | **Next** queue (4 covers), big cover, effect cards |
| Effect cards | **Fade in / Fade out**: 0–15 s, buttons ±0.01 / ±0.05 / ±0.20 s, Reset. **Speed**: 25–400 %. **Volume**: 0–500 % + Mute. **Pitch**: 50–200 % (shows semitones). Speed, Volume and Pitch have ±1 / ±5 / ±25 % buttons and Reset. Every card has a slider and a box where you type an exact value (e.g. `101.001`). |
| Bottom | Back 30 s · Back 5 s · Play/Pause · Forward 5 s · Forward 30 s, plus a clickable waveform. Fade areas are tinted. |
| Library | Upload files, upload a folder, drag & drop. Each song shows its cover, or its name on a colored square if it has no cover. A slider sets the picture size (or Ctrl + mouse wheel). |
| Save | 💾 saves one song as an MP3 with its effects, tags and cover. The 💾-in-folder button saves several selected songs either as **one big MP3** (with chapter marks) or as an **album folder** (numbered MP3s, same cover). |
| Search | Search box plus Artist, Date, Label and Genre filters (with suggestions). |

Each song remembers its own effect settings. By default, saving goes straight into
`Music\Tune Forge Exports` without asking. Change this in Settings.

## How it works

- `main.js`: Electron main process. It runs a small local server (127.0.0.1 only) for media, handles import and export, and stores the library in `%APPDATA%\Tune Forge\library\`.
- `lib/ffmpeg.js`: ffmpeg calls. The effect chain is
  `asetrate` (pitch) → `atempo` (speed back to target) → `volume` → `afade`.
- `renderer/`: the UI. Live preview uses the player's pitch-preserving speed plus
  `pitch-worklet.js` (a real-time WSOLA pitch shifter). Saved files are rendered by
  ffmpeg at higher quality with the same settings.
- Music files are played from where they are. Videos and formats Windows can't play are
  converted to MP3 inside the library folder. Removing a song never deletes your original file.
