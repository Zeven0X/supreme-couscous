'use strict';
/* global tf */
// Studio pitch for listening.
// Each player ("deck") keeps playing the original song as the clock everyone else reads (time, fades,
// waveform, map). When the pitch is not 100%, a clean pitched copy made by the studio tool plays in step
// with it, and the original is silenced. Copies come in two kinds: a short part from where the music is
// (ready in about a second) and the whole song (ready a few seconds later, kept on disk for next time).
window.TFStudio = (() => {
  const PART = 20; // seconds in a quick part
  const AHEAD = 6; // ask for the next part this many seconds before a part ends
  const FADE = 0.05; // seconds to blend from one copy to another
  const DRIFT = 0.12; // re-align a copy that drifts more than this (seconds)
  let actx = null, decks = [], hooks = {};
  const cache = new Map(); // "id|pitch|natural" -> entry

  const wantOf = (id, fx) => (id && fx && Math.abs(fx.pitch - 100) > 1e-6 ? { id, pitch: fx.pitch / 100, natural: fx.natural !== false } : null);
  const keyOf = (w) => (w ? `${w.id}|${w.pitch.toFixed(6)}|${w.natural ? 1 : 0}` : '');
  function entry(w) {
    const k = keyOf(w);
    let e = cache.get(k);
    if (!e) {
      e = { w, whole: null, wholeP: null, parts: [], partP: null, partStart: -1, failed: 0 };
      cache.set(k, e);
      if (cache.size > 300) cache.delete(cache.keys().next().value);
    }
    return e;
  }
  function fail(e, err) {
    e.failed++;
    if (hooks.log) hooks.log('warn', `Studio pitch: ${err.message}`);
    if (e.failed >= 2 && hooks.onFallback) hooks.onFallback();
  }
  function requestWhole(e, group) {
    if (e.whole || e.wholeP || e.failed >= 2) return;
    e.wholeP = tf.studioRender(e.w.id, { pitch: e.w.pitch, natural: e.w.natural, group })
      .then((r) => { e.wholeP = null; if (r) { e.whole = r; kick(); } })
      .catch((err) => { e.wholeP = null; fail(e, err); });
  }
  function requestPart(e, start, group) {
    if (e.whole || e.failed >= 2) return;
    start = Math.max(0, Math.floor(start * 10) / 10);
    if (e.parts.some((r) => covers(r, start + 0.3))) return;
    if (e.partP && e.partStart <= start + 0.3 && start < e.partStart + PART - AHEAD) return; // already on its way
    e.partStart = start;
    const p = e.partP = tf.studioRender(e.w.id, { pitch: e.w.pitch, natural: e.w.natural, start, len: PART, group })
      .then((r) => {
        if (e.partP === p) e.partP = null;
        if (r) { e.parts.push(r); if (e.parts.length > 6) e.parts.shift(); kick(); }
      })
      .catch((err) => { if (e.partP === p) e.partP = null; fail(e, err); });
  }
  // r.end 0 = until the end of the song
  // A part is used from 0.5 s after its start (the studio tool settles in during the first moments).
  const covers = (r, pos) => !!r && !r.bad && (r.start ? r.start + 0.5 : 0) <= pos + 0.02 && (!r.end || pos < r.end - 0.35);
  function best(e, pos) {
    if (covers(e.whole, pos)) return e.whole;
    let b = null;
    for (const r of e.parts) if (covers(r, pos) && (!b || (r.end || 1e9) > (b.end || 1e9))) b = r;
    return b;
  }

  // ---------- per deck ----------
  function attach(ctx, list, h = {}) {
    actx = ctx; decks = list; hooks = h;
    for (const d of decks) {
      d.st = { want: null, keep: false, on: 'orig', slots: [] };
      for (let i = 0; i < 2; i++) {
        const el = new Audio();
        el.crossOrigin = 'anonymous';
        el.preload = 'auto';
        el.preservesPitch = true;
        const gain = actx.createGain();
        gain.gain.value = 0;
        actx.createMediaElementSource(el).connect(gain).connect(d.gain);
        d.st.slots.push({ el, gain, r: null, ready: false, loading: null });
      }
      for (const ev of ['play', 'pause', 'ratechange']) d.el.addEventListener(ev, () => tick(d));
      d.el.addEventListener('seeking', () => { d.st.keep = false; tick(d); });
    }
    setInterval(() => { for (const d of decks) tick(d); }, 100);
  }
  function audible(d, target) {
    const st = d.st, now = actx.currentTime;
    const set = (g, v) => { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(v, now + FADE); };
    set(d.orig, target === 'orig' ? 1 : 0);
    for (const s of st.slots) set(s.gain, s === target ? 1 : 0);
    st.on = target;
    if (hooks.onStatus) hooks.onStatus();
  }
  function syncSlots(d) {
    const el = d.el;
    for (const s of d.st.slots) {
      if (s.switching) continue;
      if (!s.ready || s !== d.st.on) { if (!s.el.paused) s.el.pause(); continue; }
      if (s.el.playbackRate !== el.playbackRate) s.el.playbackRate = el.playbackRate;
      if (el.paused) { if (!s.el.paused) s.el.pause(); continue; }
      const want = el.currentTime - s.r.start;
      if (Math.abs(s.el.currentTime - want) > DRIFT) s.el.currentTime = Math.max(0, want);
      if (s.el.paused) s.el.play().catch(() => {});
    }
  }
  async function loadSlot(d, r) {
    const st = d.st;
    if (st.slots.some((x) => x.switching)) return;
    let s = st.slots.find((x) => x.r === r && x.ready && x !== st.on);
    if (!s) {
      if (st.slots.some((x) => x.loading === r)) return;
      s = st.slots.find((x) => x !== st.on);
      s.loading = r; s.ready = false; s.r = null;
      s.el.src = r.url;
      const ac = new AbortController();
      try {
        await new Promise((res, rej) => {
          s.el.addEventListener('loadedmetadata', res, { signal: ac.signal });
          s.el.addEventListener('error', () => rej(new Error('could not open the pitched copy')), { signal: ac.signal });
        });
      } catch (err) {
        if (s.loading !== r) return;
        s.loading = null;
        r.bad = true; // never try this copy again; a new one is made
        const e = st.want && entry(st.want);
        if (e) { if (e.whole === r) e.whole = null; e.parts = e.parts.filter((x) => x !== r); fail(e, err); }
        return;
      } finally { ac.abort(); }
      if (s.loading !== r) return; // replaced meanwhile
      s.loading = null; s.r = r; s.ready = true;
    }
    s.switching = true;
    try {
      s.el.playbackRate = d.el.playbackRate;
      s.el.currentTime = Math.max(0, d.el.currentTime - r.start);
      if (!d.el.paused) await s.el.play().catch(() => {});
      if (!covers(r, d.el.currentTime) || keyOf(st.want) !== r.key) return;
      if (Math.abs(s.el.currentTime - (d.el.currentTime - r.start)) > 0.03) s.el.currentTime = Math.max(0, d.el.currentTime - r.start);
      audible(d, s);
    } finally { s.switching = false; }
  }
  function tick(d) {
    if (!actx || !d.st) return;
    const st = d.st, pos = d.el.currentTime;
    syncSlots(d);
    if (!st.want) { if (st.on !== 'orig') audible(d, 'orig'); return; }
    const e = entry(st.want);
    if (e.failed >= 2) { if (st.on !== 'orig') audible(d, 'orig'); return; } // old live shifter takes over
    const main = hooks.main && hooks.main() === d;
    if (main) requestWhole(e, 'whole');
    const b = best(e, pos);
    if (b) {
      b.key = keyOf(st.want);
      if (st.on && st.on !== 'orig' && st.on.r === b) {
        if (!e.whole && b.end && pos > b.end - AHEAD) requestPart(e, b.end - 2, main ? 'part' : 'oldpart');
        return;
      }
      loadSlot(d, b);
      return;
    }
    requestPart(e, pos - 0.5, main ? 'part' : 'oldpart'); // starts a little earlier, so it is usable right here. The fading-out song also keeps its clean sound
    // nothing ready here yet: keep the old sound after a pitch change, otherwise stay quiet for a moment
    const keepOld = st.keep && (st.on === 'orig' || (st.on && covers(st.on.r, pos)));
    if (!keepOld && st.on !== null) audible(d, null);
  }

  // The app calls this when a song loads (fresh) or its pitch changes.
  function update(d, id, fx, { fresh = false } = {}) {
    if (!d.st) return;
    const st = d.st;
    if (fresh) {
      for (const s of st.slots) { s.el.pause(); s.r = null; s.ready = false; s.loading = null; s.switching = false; }
      st.keep = false;
      st.want = null;
      audible(d, 'orig');
    }
    const w = wantOf(id, fx);
    if (keyOf(w) !== keyOf(st.want)) {
      st.want = w;
      if (!fresh) st.keep = !d.el.paused; // while playing, the old sound goes on until the new copy is ready
    }
    tick(d);
    if (hooks.onStatus) hooks.onStatus();
  }
  // Wait (up to ms) until the deck can play with the right pitch. Used before pressing play on a song.
  function ready(d, ms = 6000) {
    const t0 = performance.now();
    return new Promise((res) => {
      const check = () => {
        tick(d);
        const st = d.st;
        if (!st || !st.want || entry(st.want).failed >= 2 || (st.on && st.on !== 'orig') || performance.now() - t0 > ms) return res();
        setTimeout(check, 40);
      };
      check();
    });
  }
  // Prepare the start of a song that may play soon (next song, next map stops).
  let prefetching = 0;
  function prefetch(id, fx) {
    const w = wantOf(id, fx);
    if (!w || prefetching >= 3) return;
    const e = entry(w);
    if (e.whole || e.partP || e.parts.some((r) => r.start === 0)) return;
    prefetching++;
    requestPart(e, 0, null);
    (e.partP || Promise.resolve()).finally(() => { prefetching--; });
  }
  function kick() { for (const d of decks) tick(d); }
  // For the Pitch card: 'off' (pitch 100%), 'ready', 'preparing', 'fallback'
  function status(d) {
    if (!d || !d.st || !d.st.want) return 'off';
    const e = entry(d.st.want);
    if (e.failed >= 2) return 'fallback';
    return d.st.on && d.st.on !== 'orig' && d.st.on.r && d.st.on.r.key === keyOf(d.st.want) ? 'ready' : 'preparing';
  }
  const fallback = (d) => !!(d && d.st && d.st.want && entry(d.st.want).failed >= 2);
  return { attach, update, ready, prefetch, status, fallback, PART };
})();
