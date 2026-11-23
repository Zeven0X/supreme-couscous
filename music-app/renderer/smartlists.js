'use strict';
// Smart playlists made by Tonix: one for each genre and star count, e.g. "6⭐ Rock" = Rock songs with
// exactly 6 stars. They fill themselves from your songs, so a song moves by itself when you rate it or
// change its genre. A song with "Rock; Pop" as genre is in both. Songs without stars or genre are left out.
// Works in the app (window.TFSmart) and in Node tests.
(function (root) {
  const splitGenres = (g) => String(g || '').split(/[;,/]/).map((x) => x.trim()).filter(Boolean);
  function build(tracks) {
    const groups = new Map(); // "rock|6" -> { genre, stars, ids }
    const names = new Map(); // "rock" -> how it is written most often
    const counts = new Map();
    for (const t of tracks) {
      const stars = Math.round(t.stars || 0);
      if (stars < 1 || stars > 10) continue;
      for (const g of splitGenres(t.genre)) {
        const key = g.toLowerCase();
        const c = counts.get(`${key}|${g}`) || 0;
        counts.set(`${key}|${g}`, c + 1);
        if (!names.has(key) || c + 1 > (counts.get(`${key}|${names.get(key)}`) || 0)) names.set(key, g);
        const k = `${key}|${stars}`;
        if (!groups.has(k)) groups.set(k, { key, stars, songs: [] });
        const grp = groups.get(k);
        if (!grp.songs.includes(t)) grp.songs.push(t);
      }
    }
    return [...groups.values()]
      .map((g) => ({
        id: `smart|${g.key}|${g.stars}`, smart: true, genre: names.get(g.key), stars: g.stars,
        name: `${g.stars}⭐ ${names.get(g.key)}`,
        trackIds: g.songs.sort((a, b) => String(a.title).localeCompare(String(b.title), undefined, { numeric: true })).map((t) => t.id),
      }))
      .sort((a, b) => a.genre.localeCompare(b.genre) || b.stars - a.stars); // by genre, best first
  }
  const api = { build, splitGenres };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TFSmart = api;
})(typeof window !== 'undefined' ? window : globalThis);
