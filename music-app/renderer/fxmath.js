'use strict';
// The effect numbers, shared by the live player (Edit page, Web Audio) and the saving engine (ffmpeg), so
// what you hear live is what gets saved. strength 0..100 for each switched-on effect, e.g. { echo: 40 }.
// Works in the app (window.TFFxMath) and in Node (lib/audiotools.js).
(function (root) {
  const ORDER = ['slowed', 'nightcore', 'bass', 'echo', 'eightd', 'oned']; // always this order
  const RATE_FX = ['slowed', 'nightcore']; // these change the speed (and pitch) of the whole track
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function params(fx = {}) {
    const on = (k) => fx[k] !== undefined && fx[k] !== null && fx[k] !== false;
    const s = (k) => clamp((+fx[k] || 0) / 100, 0, 1);
    const p = { rate: 1, list: [] };
    for (const k of ORDER) {
      if (!on(k)) continue;
      if (k === 'slowed') {
        const f = 1 - 0.08 - 0.17 * s(k);
        p.rate *= f;
        p.list.push({ k, rate: f, room: { inGain: 0.8, outGain: 0.85, taps: [[60, 0.25 + 0.2 * s(k)], [120, 0.2 + 0.15 * s(k)], [190, 0.15 + 0.1 * s(k)], [280, 0.1 + 0.08 * s(k)]] } });
      }
      if (k === 'nightcore') { const f = 1.1 + 0.25 * s(k); p.rate *= f; p.list.push({ k, rate: f }); }
      if (k === 'bass') p.list.push({ k, gain: 3 + 12 * s(k), freq: 100 });
      if (k === 'echo') p.list.push({ k, inGain: 0.8, outGain: 0.9, ms: Math.round(150 + 350 * s(k)), decay: 0.2 + 0.45 * s(k) });
      if (k === 'eightd') p.list.push({ k, hz: 0.06 + 0.14 * s(k), amount: 0.5 + 0.5 * s(k), room: { inGain: 0.8, outGain: 0.6, taps: [[40, 0.15]] } });
      if (k === 'oned') p.list.push({ k, mix: 0.5 * (0.4 + 0.6 * s(k)) });
    }
    return p;
  }
  const api = { ORDER, RATE_FX, params };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TFFxMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
