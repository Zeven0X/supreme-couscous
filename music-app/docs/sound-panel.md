# Sound panel (left side)

The Sound panel changes how a song sounds: fade in, fade out, speed, pitch, volume.
Each song keeps its own settings. A song on a map keeps its own copy (see [Map](map.md)).

## Pitch — current state ✅ (studio quality, 2026-11-23)

### What you see
- The Pitch card: exact number box (50–200 %), slider, −25 / −5 / −1, reset, +1 / +5 / +25, and the change in semitones.
- **Natural voice** switch (on by default):
  - **On:** singers keep a human voice when the pitch goes up or down.
  - **Off:** the classic voice change: higher = chipmunk, lower = deep and slow-sounding voice.
- A small status on the right of the switch:
  - **Preparing clean pitch…** (spinning ring): the clean copy is being made (usually under 1 second).
  - **Studio quality**: you are hearing the clean copy.
  - **Basic preview (studio tool failed)** (orange): only if the studio tool could not run twice in a row. The old simple shifter is then used for listening. Saved files are still studio quality.

### How it works (simple words)
1. Tonix has a professional pitch tool built in (called **Rubber Band**, it comes inside ffmpeg). It changes the pitch without the wobble and echo the old method had.
2. **Saved files:** the tool changes speed and pitch together in one go.
3. **Listening:** the tool can't run "live" inside the player, so Tonix makes a **pitched copy** of the song:
   - First a **20-second part** starting where the music is. Ready in about **0.7 seconds**.
   - Then the **whole song** (about 10 seconds for a 4-minute song). It takes over without a gap.
   - Think of it like a translator who first translates the next sentence quickly, then the whole book.
4. The original song keeps playing **silently** underneath, like a metronome. The copy plays exactly in step with it, so the time, the waveform, the fades and the map all keep working as before.
5. **Changing the pitch while a song plays:** you keep hearing the old sound until the new copy is ready, then it blends over in 0.05 s. No wrong sound in between.
6. **Pressing play on a song with a changed pitch:** Tonix waits about a second for the clean copy, then starts. It never starts with the wrong sound.
7. **Next songs are prepared early:** the next library song when a song starts, and on a map every song a path can lead to, 30 seconds before the end.
8. **Speed** while listening still uses the player's own speed control. It keeps the pitch and only follows the clean copy.
9. Copies are kept on your PC (`%APPDATA%\Tonix\library\studio-pitch`), so the same song with the same pitch starts at once next time. The oldest copies are removed after 2 GB. **Settings → Library → Clean pitch copies** shows the space used and has a **Clear** button.

### Checked
- Automatic tests: saved file at pitch 200 % is exactly double the frequency; speed 150 % gives the right length; the listening copy keeps the same length and timing; parts start where asked; old jobs are stopped when a newer one comes; the cache removes the oldest copies.
- In the real app (on this build computer): a 440 Hz tone at 150 % comes out at 660 Hz; still right after a jump, after a speed change, after pause / play, with Natural voice off; 100 % plays the original again; a song started at 75 % starts at 330 Hz; the next map song is ready when the crossfade starts.
- **Not yet heard by you on your PC.**

### History
- 🔄 2026-11-23: **Studio quality pitch.** Before: listening used a simple live shifter (small 70 ms pieces glued together, which caused the wobble and echo you heard), and saved files used "speed up the tape, then slow it back down" (asetrate + atempo), which also smeared the sound. Both replaced by the Rubber Band tool. Added the Natural voice switch and the status text. Reason: "The pitch is bad and sounds so bad on the music."
- 2026-11-23: Pitch card made wider, shows semitones.

## Speed, volume, fades — current state ✅
- Speed 25–400 %, volume 0–500 %, fade in / out 0–15 s. Exact number boxes, sliders and step buttons. **Reset all** puts everything back to normal (Natural voice back on too).
- Saved files: speed now uses the same studio tool as pitch (2026-11-23). Before: atempo.
