'use strict';
// Smart shuffle: picks the next song by luck, but each song has a weight ("how many lottery tickets").
//  - A song that played a lot lately gets fewer tickets, a song that hardly played gets more.
//  - Blacklist = about 1 in 10 as often, favourite = 3 times as often.
//  - "Lately" = the last (number of songs x 4) plays. After that many plays, everything is back to normal.
// Works in the app (window.TFShuffle) and in Node tests.
(function (root) {
  const BLACK = 0.1; // blacklisted: about 1 in 10 as often
  const FAV = 3; // favourite: 3 times as often
  const windowOf = (n) => Math.max(4, Math.round(n) * 4); // songs x 4 (your rule)
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // How many times the song played in the last `window` plays (stamps = the play clock at each play).
  function recentPlays(t, clock, n) {
    const from = clock - windowOf(n);
    return (t.stamps || []).filter((s) => s > from).length;
  }
  // A mark (blacklist / favourite) counts until (songs x 4) plays have happened since it was set.
  // markUntil is fixed when you mark the song, so it is the same in the library, playlists and shuffle.
  function activeMark(t, clock, n) {
    if (t.mark !== 'black' && t.mark !== 'fav') return null;
    const until = Number.isFinite(t.markUntil) ? t.markUntil : (t.markAt || 0) + windowOf(n);
    return clock < until ? t.mark : null;
  }
  // Your marks win: blacklist 0.1, favourite 3. Unmarked songs: each is expected about 4 times per window,
  // so played 4 times = normal (1), never = 3x, a lot = down to 0.1 (Tonix "blacklists" it by itself).
  function weight(t, clock, n) {
    const m = activeMark(t, clock, n);
    if (m === 'black') return BLACK;
    if (m === 'fav') return FAV;
    return clamp(5 / (recentPlays(t, clock, n) + 1), 0.1, 3);
  }
  // Pick the next song. `avoid` = songs that just played or are already coming up (never twice in a row).
  function pick(pool, avoid, clock, rnd = Math.random) {
    const n = pool.length;
    if (!n) return null;
    const keep = Math.min(Math.floor(n / 3), n - 1); // how many of the latest songs to skip
    const skip = new Set(avoid.slice(-keep));
    if (!keep && avoid.length) skip.add(avoid[avoid.length - 1]);
    let cand = pool.filter((t) => !skip.has(t.id));
    if (!cand.length) cand = pool;
    const ws = cand.map((t) => weight(t, clock, n));
    let r = rnd() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < cand.length; i++) { r -= ws[i]; if (r <= 0) return cand[i]; }
    return cand[cand.length - 1];
  }
  // For the song list: 'black' / 'fav' (your marks), 'less' / 'more' (Tonix's own idea), or ''.
  function badge(t, clock, n) {
    const m = activeMark(t, clock, n);
    if (m) return m;
    const k = recentPlays(t, clock, n);
    if (k >= 9) return 'less';
    return '';
  }
  const api = { weight, pick, badge, windowOf, recentPlays, activeMark, BLACK, FAV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TFShuffle = api;
})(typeof window !== 'undefined' ? window : globalThis);
