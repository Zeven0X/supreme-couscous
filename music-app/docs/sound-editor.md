# Sound editor (📏 Edit page)

Its own page, opened with the caliper button in the top bar. Tabs: **Trim · Split · Effects · Loop · Layers**.
Status: designed (concept pictures shown 2026-11-23), **not built yet**.

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
- 2026-11-23: designed. Before: the caliper button was hidden with no plan.
