'use strict';
// Path chances: the paths leaving one song always add up to 100 (whole percents).
// Locked paths keep their number; the unlocked ones share what is left.
(function (root) {
  // Split `total` into whole numbers that follow `weights` and add up exactly to `total`.
  function share(total, weights) {
    const n = weights.length;
    if (!n) return [];
    const sum = weights.reduce((a, b) => a + b, 0);
    const w = sum > 0 ? weights : weights.map(() => 1);
    const wsum = sum > 0 ? sum : n;
    const raw = w.map((x) => (x / wsum) * total);
    const out = raw.map(Math.floor);
    let left = total - out.reduce((a, b) => a + b, 0);
    // give the leftover points to the biggest remainders (first one wins ties)
    const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k][1]]++;
    return out;
  }

  const free = (paths) => Math.max(0, 100 - paths.filter((p) => p.locked).reduce((a, p) => a + p.chance, 0));

  // Every unlocked path gets the same share.
  function evenSplit(paths) {
    if (paths.length && free(paths) <= 0 && paths.some((p) => !p.locked)) paths.forEach((p) => { p.locked = false; }); // a new path never gets 0 % because of locks
    const open = paths.filter((p) => !p.locked);
    share(free(paths), open.map(() => 1)).forEach((c, i) => { open[i].chance = c; });
    return paths;
  }

  // Unlocked paths grow or shrink together (keeping their sizes relative to each other) so all add to 100.
  function fillTo100(paths) {
    if (paths.length && paths.every((p) => p.locked) && paths.reduce((a, p) => a + p.chance, 0) !== 100) paths.forEach((p) => { p.locked = false; }); // (found in the bug hunt)
    const open = paths.filter((p) => !p.locked);
    share(free(paths), open.map((p) => Math.max(0, p.chance))).forEach((c, i) => { open[i].chance = c; });
    return paths;
  }

  // Set one path's chance; the other unlocked paths share the rest.
  function setChance(paths, target, value) {
    const others = paths.filter((p) => p !== target && !p.locked);
    const lockedOthers = paths.filter((p) => p !== target && p.locked).reduce((a, p) => a + p.chance, 0);
    const max = 100 - lockedOthers;
    // nobody left to share with: this path must take everything that is free
    if (!others.length) { target.chance = max; return paths; }
    target.chance = Math.round(Math.min(Math.max(0, value), max));
    const rest = 100 - lockedOthers - target.chance;
    share(rest, others.map((p) => Math.max(0, p.chance))).forEach((c, i) => { others[i].chance = c; });
    return paths;
  }

  // Pick a path by luck. rnd is a number from 0 to <1.
  function pick(paths, rnd = Math.random()) {
    const total = paths.reduce((a, p) => a + Math.max(0, p.chance), 0);
    if (!paths.length) return null;
    if (total <= 0) return paths[Math.min(paths.length - 1, Math.floor(rnd * paths.length))]; // all 0 %: every path the same chance
    let r = rnd * total;
    for (const p of paths) { r -= Math.max(0, p.chance); if (r < 0) return p; }
    return paths[paths.length - 1];
  }

  const api = { share, evenSplit, fillTo100, setChance, pick };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TFChance = api;
})(typeof window !== 'undefined' ? window : globalThis);
