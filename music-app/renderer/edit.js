'use strict';
/* global S, h, tf, guard, toast, coverEl, fmtTime, modal, confirmModal, upsertTrack, renderGrid, pause, ICONS, TFPlaylists, TFEditTabs, TFDaw, TFFxMath */
// The Edit page (📏), laid out like a music studio program (DAW):
//   transport bar (play, loop, record, clocks) · tool bar (tools, snap, panels, zoom)
//   inspector strip (selected track: effects, left/right, volume fader, meters) · tracks (overview, rulers,
//   one lane per track: the song + its layers) · the bottom panel (Trim, Split, Effects, Loop, Connect).
// Everything plays live (renderer/dawengine.js). Changes to the song's shape (cut, trim, split, loop,
// connect) make a new working copy (Undo / Redo). Save mixes the tracks the same way you heard them.
window.TFEdit = (() => {
  const E = {
    s: null, sel: null, zoom: 1, scroll: 0, busy: false, mode: 'both', panel: 'effects', tool: 'select', snap: 'off',
    loopOn: false, beats: null, tracks: [], selTrack: 'song', preview: null, stopAt: null, playFrom: 0, rec: null,
  };
  const COLORS = ['#7aa8ff', '#ff9ad5', '#ffd36b', '#5cf2a8', '#c59bff', '#ff9f6b'];
  const SONG_H = 122, LAYER_H = 68, HEAD_W = 230;
  const el = (id) => document.getElementById(id);
  const fmt = (t) => { const s = Math.max(0, t || 0); return `${fmtTime(s)}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`; };
  const track = () => (E.s ? S.byId.get(E.s.trackId) : null);
  const song = () => E.tracks[0];
  const layers = () => E.tracks.slice(1);
  const selT = () => E.tracks.find((t) => t.id === E.selTrack) || song();
  const dur = () => (E.s ? E.s.duration : 0);
  let nextLayer = 1;

  // ---------- opening a song ----------
  const unsaved = () => E.s && (E.s.version > 0 || mixPending());
  async function open(trackId) {
    const t = S.byId.get(trackId);
    if (!t) return;
    if (E.s && E.s.trackId !== trackId && unsaved()) {
      const ok = await confirmModal('Leave the song you are editing?', `"${(track() || {}).title}" has changes that are not saved. They will be lost.`, 'Leave without saving');
      if (!ok) return;
    }
    window.showView('edit');
    stopAll();
    if (E.s) { tf.editClose(E.s.id).catch(() => {}); E.s = null; }
    Object.assign(E, { sel: null, zoom: 1, scroll: 0, beats: null, tracks: [], selTrack: 'song', loopOn: false, preview: null });
    TFEditTabs.reset();
    render();
    busy(`Opening "${t.title}"…`);
    const st = await guard(() => tf.editOpen(trackId), 'Edit: ');
    busy(null);
    if (!st) { render(); return; }
    E.tracks = [{ id: 'song', kind: 'song', name: t.title, color: '#c9d6ff', volume: 100, pan: 0, mute: false, solo: false, fx: {} }];
    show({ ...st, trackId });
  }
  function show(st) {
    const keep = E.s ? E.s.trackId : st.trackId;
    const at = TFDaw.time();
    stopAll();
    E.preview = null;
    E.s = { ...st, trackId: st.trackId || keep };
    Object.assign(song(), { url: st.url, peaks: st.peaks, duration: st.duration });
    TFDaw.setTracks(E.tracks);
    TFDaw.seek(Math.min(at || 0, st.duration));
    TFEditTabs.onVersion();
    if (E.sel && E.sel.b > st.duration) E.sel = null;
    E.beats = null;
    tf.editBpm(E.s.id).then((b) => { if (E.s && E.s.id === st.id) { E.beats = b; drawAll(); drawBar(); } }).catch(() => {});
    TFDaw.load(st.url).catch(() => {}); // get the song ready to play
    render();
  }
  function pick() {
    return modal((box, close) => {
      box.style.width = 'min(560px, 94vw)';
      const q = h('input', { placeholder: 'Search your songs…', spellcheck: 'false', autofocus: true });
      const list = h('div', { class: 'pl-pick' });
      const fill = () => {
        list.innerHTML = '';
        const n = q.value.trim().toLowerCase();
        for (const t of S.tracks.filter((x) => !n || `${x.title} ${x.artist}`.toLowerCase().includes(n)).slice(0, 200)) {
          list.append(h('button', { class: 'pl-pick-row', onclick: () => { close(); open(t.id); } }, h('div', { class: 'pl-mini' }, coverEl(t)), h('span', { class: 't' }, t.title), h('span', { class: 'muted' }, t.artist || '')));
        }
        if (!list.childElementCount) list.append(h('p', { class: 'muted' }, S.tracks.length ? 'No song matches.' : 'Your library is empty. Upload songs first.'));
      };
      q.addEventListener('input', fill);
      fill();
      box.append(h('h2', {}, 'Open a song to edit'), q, list, h('div', { class: 'foot' }, h('span'), h('button', { class: 'btn', onclick: () => close() }, 'Cancel')));
    });
  }

  // ---------- changes to the song's shape (new working copy) ----------
  function busy(msg) { E.busy = !!msg; const b = el('ed-busy'); if (b) { b.hidden = !msg; b.textContent = msg || ''; } }
  async function change(fn, msg) {
    if (!E.s || E.busy) return null;
    stopAll();
    busy(msg);
    const st = await guard(fn, 'Edit: ');
    busy(null);
    if (st) show(st);
    return st;
  }
  const needSel = () => { if (!E.sel) { toast('Select a part first: drag across the song.'); return false; } return true; };
  const cut = () => { if (!needSel()) return; const { a, b } = E.sel; E.sel = null; E.loopOn = false; return change(() => tf.editApply(E.s.id, { type: 'cut', a, b }), 'Cutting…'); };
  const keep = () => { if (!needSel()) return; const { a, b } = E.sel; E.sel = null; E.loopOn = false; return change(() => tf.editApply(E.s.id, { type: 'keep', a, b }), 'Keeping the selected part…'); };
  const undo = () => E.s && E.s.canUndo && change(() => tf.editUndo(E.s.id), 'Undo…');
  const redo = () => E.s && E.s.canRedo && change(() => tf.editRedo(E.s.id), 'Redo…');

  // ---------- the live mix → saved the same way ----------
  const fxOf = (t) => Object.fromEntries(Object.entries(t.fx || {}).filter(([, v]) => v !== undefined && v !== null));
  function mixPending() {
    const s = song();
    return !!s && (Object.keys(fxOf(s)).length > 0 || s.volume !== 100 || +s.pan !== 0 || s.mute || layers().length > 0);
  }
  function mixOp() {
    const s = song();
    return {
      type: 'mix',
      song: { fx: fxOf(s), volume: s.volume, pan: s.pan, mute: s.mute, solo: s.solo },
      layers: layers().map((L) => ({ src: L.src, offset: L.offset, from: L.from, to: L.to, volume: L.volume, pan: L.pan, mute: L.mute, solo: L.solo, repeat: L.repeat, matchBeat: L.matchBeat, duck: L.duck, fx: fxOf(L) })),
    };
  }
  async function bake() { // "Apply to the song": the tracks become one working copy (Undo takes it back)
    if (!mixPending()) { toast('Nothing to apply: no effects, volume change or layers.'); return null; }
    const st = await change(() => tf.editDo(E.s.id, mixOp()), 'Mixing the tracks into the song…');
    if (st) { Object.assign(song(), { fx: {}, volume: 100, pan: 0, mute: false, solo: false }); E.tracks = [song()]; E.selTrack = 'song'; TFDaw.setTracks(E.tracks); TFDaw.fxChanged(song()); render(); }
    return st;
  }
  async function save() {
    const t = track();
    if (!E.s || !t || E.busy) return;
    if (E.s.version === 0 && !mixPending()) { toast('Nothing changed yet.'); return; }
    if (E.mode === 'replace') {
      const ok = await confirmModal(`Replace the original file of "${t.title}"?`,
        `The edited song is saved with the original's name, and the original file is moved to the Recycle Bin: ${t.srcPath}. You can get it back from the Recycle Bin.`, 'Replace the original');
      if (!ok) return;
    }
    if (mixPending() && !(await bake())) return; // what you heard (effects, volumes, layers) goes into the file
    stopAll();
    busy('Saving…');
    const r = await guard(() => tf.editSave(E.s.id, E.mode), 'Save: ');
    busy(null);
    if (!r) return;
    for (const x of [...r.changed, ...(r.added ? [r.added] : [])]) upsertTrack(x);
    renderGrid();
    TFPlaylists.render();
    toast(`Saved: ${r.dest}`, { type: 'ok', action: () => tf.showItem(r.dest), actionLabel: 'Show', ms: 8000 });
    const next = E.mode === 'both' && r.added ? r.added.id : E.s.trackId; // go on from the saved song
    tf.editClose(E.s.id).catch(() => {});
    E.s = null;
    open(next);
  }

  // ---------- layers (tracks on top of the song) ----------
  async function addLayer(src, extra = {}) {
    const info = await guard(() => tf.editSource(src), 'Track: ');
    if (!info || !E.s) return;
    const L = {
      id: `L${nextLayer}`, kind: 'layer', src, name: extra.name || info.name, color: COLORS[(nextLayer - 1) % COLORS.length], url: info.url, peaks: info.peaks, duration: info.duration,
      offset: +TFDaw.time().toFixed(2), from: 0, to: +info.duration.toFixed(3), volume: 70, pan: 0, mute: false, solo: false, repeat: 1, matchBeat: false, duck: false, fx: {}, ...extra,
    };
    nextLayer++;
    E.tracks.push(L);
    E.selTrack = L.id;
    TFDaw.setTracks(E.tracks);
    TFDaw.load(L.url).catch(() => toast(`"${L.name}" could not be loaded.`, { type: 'error' }));
    if (TFDaw.playing) TFDaw.play(TFDaw.time());
    render();
  }
  async function setMatchBeat(L, on) {
    L.matchBeat = on;
    if (!on) { L.playUrl = null; L.stretch = 1; layerChanged(L); return; }
    busy('Matching the beat…');
    const r = await guard(() => tf.editMatchBeat(E.s.id, L.src), 'Match beat: ');
    busy(null);
    if (!r) { L.matchBeat = false; render(); return; }
    L.playUrl = r.url; L.stretch = r.tempo;
    toast(r.tempo === 1 ? 'Already at the same beat.' : `Beat matched: ${Math.round(r.layerBpm)} → ${Math.round(r.songBpm)} BPM.`, { ms: 2500 });
    layerChanged(L);
  }
  function layerChanged(L, rerender = true) { TFDaw.apply(L); if (TFDaw.playing && !TFDaw.previewing) TFDaw.play(TFDaw.time()); if (rerender) render(); else drawAll(); }
  function removeLayer(L) { E.tracks = E.tracks.filter((t) => t !== L); if (E.selTrack === L.id) E.selTrack = 'song'; TFDaw.setTracks(E.tracks); if (TFDaw.playing) TFDaw.play(TFDaw.time()); render(); }

  // record your voice while everything plays
  async function toggleRecord() {
    if (E.rec) { E.rec.stop(); return; }
    let stream, rec;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); rec = new MediaRecorder(stream); } catch (e) {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      toast(`Tonix can't use the microphone (${e.message}). Check Windows Settings → Privacy → Microphone.`, { type: 'error', ms: 8000 });
      return;
    }
    const chunks = [], at = TFDaw.time(), sid = E.s.id, t0 = Date.now();
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timer);
      E.rec = null;
      TFDaw.pause();
      if (!E.s || E.s.id !== sid) return; // another song was opened meanwhile
      const buf = new Uint8Array(await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer());
      if (buf.length < 2000) { toast('Nothing was recorded.'); render(); return; }
      const src = await guard(() => tf.editRecording(buf), 'Recording: ');
      if (src) { TFDaw.seek(at); await addLayer(src, { volume: 100, duck: true, name: 'Your voice' }); }
      render();
    };
    const timer = setInterval(() => { const b = el('dw-rec'); if (b) b.textContent = `■ Stop (${fmtTime((Date.now() - t0) / 1000)})`; }, 250);
    E.rec = rec;
    rec.start(250);
    TFDaw.play(at); // talk / sing along
    render();
  }

  // ---------- playing ----------
  function stopAll() { TFDaw.pause(); E.stopAt = null; if (E.preview) { E.preview = null; } }
  async function playPause() {
    if (!E.s) return;
    if (TFDaw.playing) { TFDaw.pause(); drawBar(); return; }
    pause(); // the main player stops: one thing plays at a time
    E.stopAt = null; E.playFrom = TFDaw.time();
    if (TFDaw.time() >= dur() - 0.05) TFDaw.seek(0);
    await TFDaw.play(TFDaw.time() >= dur() - 0.05 ? 0 : TFDaw.time());
    drawBar();
  }
  function stopButton() { TFDaw.pause(); TFDaw.seek(E.playFrom || 0); E.stopAt = null; drawAll(); drawBar(); }
  function playRange(a, b) { if (!E.s) return; pause(); E.stopAt = b; TFDaw.play(a); drawBar(); }
  const seek = (t) => { TFDaw.seek(Math.max(0, Math.min(dur(), t))); drawAll(); drawBar(); };
  TFDaw.onEnd(() => { if (E.preview && !TFDaw.previewing) { E.preview = null; render(); } drawBar(); });
  (function tick() {
    if (E.s && TFDaw.playing) {
      const t = TFDaw.time();
      if (!E.preview) {
        if (E.stopAt !== null && t >= E.stopAt) { TFDaw.pause(); TFDaw.seek(E.stopAt); E.stopAt = null; }
        else if (E.loopOn && E.sel && t >= E.sel.b) TFDaw.play(E.sel.a); // Loop A–B
        follow(t);
      }
      drawAll(); drawBar(); drawMeters();
    }
    requestAnimationFrame(tick);
  })();
  // keep the playhead on screen while playing (zoomed in)
  function follow(t) { const v = view(); if (E.zoom > 1 && (t < v.t0 || t > v.t0 + v.span * 0.92)) { E.scroll = t - v.span * 0.1; clampScroll(); } }

  // ---------- previews (Trim / Loop / Connect): hear a change before making it ----------
  async function preview(op, { from = null, label = 'Preview' } = {}) {
    if (!E.s || E.busy) return;
    stopAll();
    busy('Making a preview…');
    const p = await guard(() => tf.editPreview(E.s.id, op), 'Preview: ');
    busy(null);
    if (!p) return;
    E.preview = { ...p, label, back: TFDaw.time() };
    await TFDaw.playPreview(p.url, from ?? E.preview.back);
    render();
  }
  function stopPreview() { if (!E.preview) return; const back = E.preview.back; E.preview = null; TFDaw.stopPreview(true); TFDaw.seek(back); render(); }

  // ---------- time ↔ pixels; snapping; bars ----------
  const lanesW = () => { const c = el('dw-lanes'); return c ? c.clientWidth : 1; };
  const view = () => { const w = lanesW(); const span = dur() / E.zoom || 1; return { w, span, t0: E.scroll, pps: w / span }; };
  const timeAt = (x) => { const v = view(); return Math.max(0, Math.min(dur(), v.t0 + x / v.pps)); };
  const xAt = (t) => { const v = view(); return (t - v.t0) * v.pps; };
  function clampScroll() { const v = view(); E.scroll = Math.max(0, Math.min(Math.max(0, dur() - v.span), E.scroll)); }
  function zoomTo(z, aroundX) {
    if (!E.s) return;
    const t = aroundX === undefined ? E.scroll + view().span / 2 : timeAt(aroundX);
    const frac = aroundX === undefined ? 0.5 : aroundX / view().w;
    E.zoom = Math.max(1, Math.min(400, z));
    E.scroll = t - view().span * frac;
    clampScroll();
    drawAll(); drawBar();
  }
  const beatLen = () => (E.beats && E.beats.bpm ? 60 / E.beats.bpm : 0);
  const firstBeat = () => (E.beats && E.beats.times && E.beats.times.length ? E.beats.times[0] % (beatLen() || 1) : 0);
  function snap(t) {
    if (E.snap === 'off' || !beatLen()) return t;
    const step = beatLen() * (E.snap === 'bar' ? 4 : 1), f = firstBeat();
    return Math.max(0, Math.min(dur(), f + Math.round((t - f) / step) * step));
  }
  function barBeat(t) {
    if (!beatLen()) return '–';
    const n = Math.floor((t - firstBeat()) / beatLen() + 1e-6);
    if (n < 0) return '000 | 0';
    return `${String(Math.floor(n / 4) + 1).padStart(3, '0')} | ${String((n % 4) + 1).padStart(2, '0')}`;
  }
  // a layer's clips (one per repeat), in song time
  function clips(L) {
    const rate = TFDaw.songRate();
    const lenST = ((L.to - L.from) / (L.stretch || 1)) * rate;
    if (!(lenST > 0.01)) return [];
    const reps = L.repeat === 0 ? Math.ceil(Math.max(0, dur() - L.offset) / lenST) : Math.max(1, L.repeat || 1);
    const out = [];
    for (let k = 0; k < Math.min(reps, 400); k++) { const a = L.offset + k * lenST; let b = a + lenST; if (L.repeat === 0) b = Math.min(b, dur()); if (b > a) out.push([a, b]); }
    return out;
  }

  // ---------- drawing ----------
  const css = () => { const st = getComputedStyle(document.body); return { accent: st.getPropertyValue('--accent').trim() || '#c9d6ff' }; };
  function sizeCanvas(c) {
    const dpr = window.devicePixelRatio || 1, W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    return { g: c.getContext('2d'), dpr, W, H };
  }
  function drawAll() { drawOverview(); drawRuler(); drawLanes(); }
  function drawOverview() {
    const c = el('dw-over'); if (!c || !E.s) return;
    const { g, dpr, W, H } = sizeCanvas(c);
    g.clearRect(0, 0, W, H);
    const p = song().peaks || [], n = p.length;
    g.fillStyle = 'rgba(201,214,255,.45)';
    for (let x = 0; x < W; x++) { const v = p[Math.floor((x / W) * n)] || 0; g.fillRect(x, H / 2 - (v * H) / 2.4, 1, Math.max(1, (v * H) / 1.2)); }
    if (E.zoom > 1) { const a = (E.scroll / dur()) * W, b = ((E.scroll + view().span) / dur()) * W; g.fillStyle = 'rgba(201,214,255,.12)'; g.fillRect(a, 0, b - a, H); g.strokeStyle = css().accent; g.lineWidth = 2 * dpr; g.strokeRect(a + dpr, dpr, b - a - 2 * dpr, H - 2 * dpr); }
    const px = (TFDaw.time() / dur()) * W; g.fillStyle = '#ff6b6b'; g.fillRect(px, 0, 1.5 * dpr, H);
  }
  function drawRuler() {
    const c = el('dw-ruler'); if (!c || !E.s) return;
    const { g, dpr, W, H } = sizeCanvas(c);
    g.clearRect(0, 0, W, H);
    const v = view();
    g.font = `${11 * dpr}px system-ui, sans-serif`;
    const steps = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const step = steps.find((s) => s * v.pps >= 70) || 600;
    for (let t = Math.ceil(v.t0 / step) * step; t <= v.t0 + v.span + 1e-9; t += step) {
      const x = xAt(t) * dpr; g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x, 16 * dpr, 1, 5 * dpr); g.fillText(step < 1 ? fmt(t) : fmtTime(t), x + 3 * dpr, 13 * dpr);
    }
    if (beatLen()) { // bars
      const bar = beatLen() * 4, f = firstBeat();
      let every = 1; while (bar * every * v.pps < 26) every *= 2;
      for (let k = Math.max(0, Math.floor((v.t0 - f) / bar)); f + k * bar <= v.t0 + v.span; k++) {
        const x = xAt(f + k * bar) * dpr;
        if (k % every) continue;
        g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x, 34 * dpr, 1, 6 * dpr);
        if (k % (every * 4) === 0) { g.fillStyle = 'rgba(255,255,255,.45)'; g.fillText(String(k + 1), x + 3 * dpr, 32 * dpr); }
      }
    }
    // markers: A–B (selection), split cuts, connect point
    const mk = (t, txt, col) => { const x = xAt(t) * dpr; g.fillStyle = col; g.beginPath(); g.arc(x, 54 * dpr, 7.5 * dpr, 0, 7); g.fill(); g.fillStyle = '#141924'; g.font = `bold ${9.5 * dpr}px system-ui`; g.fillText(txt, x - 3.2 * dpr, 57.5 * dpr); g.font = `${11 * dpr}px system-ui, sans-serif`; };
    if (E.sel) { g.fillStyle = E.loopOn ? 'rgba(92,242,168,.45)' : 'rgba(120,160,255,.35)'; g.fillRect(xAt(E.sel.a) * dpr, 52 * dpr, (xAt(E.sel.b) - xAt(E.sel.a)) * dpr, 4 * dpr); mk(E.sel.a, 'A', E.loopOn ? '#5cf2a8' : '#9db4ff'); mk(E.sel.b, 'B', E.loopOn ? '#5cf2a8' : '#9db4ff'); }
    TFEditTabs.markers({ mk, tab: E.panel });
    const px = xAt(TFDaw.time()) * dpr; g.fillStyle = '#ff6b6b'; g.fillRect(px, 0, 1.5 * dpr, H);
  }
  function laneTops() { let y = 0; return E.tracks.map((t) => { const top = y; y += t.kind === 'song' ? SONG_H : LAYER_H; return top; }); }
  function drawLanes() {
    const c = el('dw-lanes'); if (!c || !E.s) return;
    const { g, dpr, W, H } = sizeCanvas(c);
    g.clearRect(0, 0, W, H);
    const v = view(), tops = laneTops(), accent = css().accent;
    if (beatLen()) { const bar = beatLen() * 4, f = firstBeat(); let every = 1; while (bar * every * v.pps < 22) every *= 2; for (let k = Math.max(0, Math.floor((v.t0 - f) / bar)); f + k * bar <= v.t0 + v.span; k += every) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(xAt(f + k * bar) * dpr, 0, 1, H); } }
    if (E.sel) { g.fillStyle = E.loopOn ? 'rgba(92,242,168,.07)' : 'rgba(120,160,255,.06)'; g.fillRect(xAt(E.sel.a) * dpr, 0, (xAt(E.sel.b) - xAt(E.sel.a)) * dpr, H); }
    E.tracks.forEach((t, i) => {
      const top = tops[i] * dpr, h = (t.kind === 'song' ? SONG_H : LAYER_H) * dpr;
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, top + h - dpr, W, dpr);
      if (t.id === E.selTrack) { g.fillStyle = 'rgba(201,214,255,.035)'; g.fillRect(0, top, W, h); }
      const segs = t.kind === 'song' ? [[0, dur()]] : clips(t);
      const quiet = t.mute || (E.tracks.some((x) => x.solo && !x.mute) && !t.solo);
      for (const [a, b] of segs) {
        const x1 = xAt(a) * dpr, x2 = xAt(b) * dpr;
        if (x2 < 0 || x1 > W) continue;
        const col = t.kind === 'song' ? accent : t.color;
        g.fillStyle = quiet ? 'rgba(255,255,255,.04)' : `${col}22`; roundRect(g, x1 + dpr, top + 3 * dpr, x2 - x1 - 2 * dpr, h - 6 * dpr, 6 * dpr); g.fill();
        g.fillStyle = quiet ? 'rgba(255,255,255,.08)' : `${col}55`; roundRect(g, x1 + dpr, top + 3 * dpr, x2 - x1 - 2 * dpr, 15 * dpr, [6 * dpr, 6 * dpr, 0, 0]); g.fill();
        g.fillStyle = quiet ? 'rgba(255,255,255,.4)' : '#fff'; g.font = `bold ${10.5 * dpr}px system-ui`;
        g.fillText(`${t.name}${quiet ? '  (muted)' : ''}`, Math.max(x1, 0) + 7 * dpr, top + 14 * dpr);
        // the wave
        const p = t.peaks || [], n = p.length, mid = top + 18 * dpr + (h - 22 * dpr) / 2, amp = (h - 26 * dpr) / 2;
        g.fillStyle = quiet ? 'rgba(255,255,255,.22)' : col;
        const played = TFDaw.time();
        for (let x = Math.max(0, Math.floor(x1 + 2 * dpr)); x < Math.min(W, x2 - 2 * dpr); x++) {
          const tt = v.t0 + (x / dpr) / v.pps;
          const tt2 = v.t0 + ((x + 1) / dpr) / v.pps;
          // which part of this track's sound is under this pixel (in the track's own seconds)
          const own = (u) => (t.kind === 'song' ? u : t.from + ((u - a) / TFDaw.songRate()) * (t.stretch || 1));
          const len = t.kind === 'song' ? dur() : t.duration || 1;
          const i1 = Math.floor((own(tt) / len) * n), i2 = Math.max(i1 + 1, Math.floor((own(tt2) / len) * n));
          let m = 0; for (let k = Math.max(0, i1); k < Math.min(n, i2); k++) if (p[k] > m) m = p[k];
          if (t.kind === 'song') g.fillStyle = quiet ? 'rgba(255,255,255,.22)' : tt <= played ? accent : 'rgba(201,214,255,.42)';
          g.fillRect(x, mid - m * amp, 1, Math.max(dpr, m * amp * 2));
        }
      }
      if (t.kind === 'song' && !E.preview) TFEditTabs.overlay(g, { dpr, Wd: W, Hd: top + h, ruler: top, xAt, view: v, duration: dur(), tab: E.panel });
    });
    if (E.sel) { g.fillStyle = accent; for (const tt of [E.sel.a, E.sel.b]) g.fillRect(xAt(tt) * dpr - dpr, 0, 2 * dpr, H); }
    const px = xAt(TFDaw.time()) * dpr; g.fillStyle = '#ff6b6b'; g.fillRect(px - dpr / 2, 0, 1.5 * dpr, H);
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, Math.max(0, w), Math.max(0, h), r); else g.rect(x, y, Math.max(0, w), Math.max(0, h)); }
  function drawBar() {
    if (!E.s) return;
    const now = E.preview ? TFDaw.time() : TFDaw.time();
    const set = (id, v) => { const x = el(id); if (x && x.textContent !== v) x.textContent = v; };
    set('dw-time', fmt(now));
    set('dw-bars', E.preview ? '–' : barBeat(now));
    set('dw-bpm', E.beats && E.beats.bpm ? `♩ ${Math.round(E.beats.bpm)}` : '♩ –');
    set('dw-selt', E.sel ? `${fmt(E.sel.a)} – ${fmt(E.sel.b)} · ${(E.sel.b - E.sel.a).toFixed(1)} s` : 'nothing');
    const p = el('dw-play'); if (p) { const playing = TFDaw.playing; if (p.dataset.on !== String(playing)) { p.dataset.on = String(playing); p.innerHTML = playing ? ICONS.pause : ICONS.play; } }
    for (const id of ['dw-cut', 'dw-keep']) { const b = el(id); if (b) b.disabled = !E.sel; }
    const lp = el('dw-loop'); if (lp) { lp.disabled = !E.sel; lp.classList.toggle('on', E.loopOn && !!E.sel); }
    set('dw-zoom', `${Math.round(E.zoom * 100)}%`);
  }
  const meterTmp = {};
  function drawMeters() {
    const m = TFDaw.meters();
    for (const t of E.tracks) {
      const bar = el(`dw-m-${t.id}`);
      if (bar) { const v = Math.min(1, m[t.id] || 0); meterTmp[t.id] = Math.max(v, (meterTmp[t.id] || 0) * 0.9); bar.style.setProperty('--lv', `${Math.round(meterTmp[t.id] * 100)}%`); }
    }
    const big = el('dw-meter'); if (big) { const v = Math.min(1, m[selT().id] || 0); meterTmp.big = Math.max(v, (meterTmp.big || 0) * 0.92); big.style.setProperty('--lv', `${Math.round(meterTmp.big * 100)}%`); }
  }

  // ---------- mouse ----------
  let wired = null;
  function wire() {
    if (wired) wired.abort();
    wired = new AbortController();
    const signal = wired.signal;
    const lanes = el('dw-lanes'), ruler = el('dw-ruler'), over = el('dw-over');
    let down = null;
    const pos = (e, c) => { const r = c.getBoundingClientRect(); return { x: Math.max(0, Math.min(r.width, e.clientX - r.left)), y: e.clientY - r.top }; };
    const laneAt = (y) => { const tops = laneTops(); for (let i = tops.length - 1; i >= 0; i--) if (y >= tops[i]) return E.tracks[i]; return song(); };
    lanes.addEventListener('mousedown', (e) => {
      if (!E.s || e.button !== 0 || E.preview) return;
      const { x, y } = pos(e, lanes), t = timeAt(x), T = laneAt(y);
      if (T.id !== E.selTrack) { E.selTrack = T.id; renderSide(); }
      e.preventDefault();
      // Split cuts (song lane)
      const own = T.kind === 'song' && TFEditTabs.mouseDown({ x, t, xAt, e, tab: E.panel });
      if (own) { down = { own }; return; }
      // Move tool: drag a layer's clip
      if (E.tool === 'move' && T.kind === 'layer') { down = { layer: T, x0: e.clientX, off0: T.offset }; return; }
      const near = (tt) => Math.abs(xAt(tt) - x) < 6;
      if (E.sel && near(E.sel.a)) down = { edge: 'a' };
      else if (E.sel && near(E.sel.b)) down = { edge: 'b' };
      else if (e.shiftKey && E.sel) { down = { edge: t < E.sel.a ? 'a' : 'b' }; E.sel[down.edge] = snap(t); }
      else down = { start: snap(t), x, moved: false };
    });
    ruler.addEventListener('mousedown', (e) => { if (!E.s || e.button !== 0 || E.preview) return; const { x } = pos(e, ruler); down = { start: snap(timeAt(x)), x, moved: false, ruler: true }; e.preventDefault(); });
    over.addEventListener('mousedown', (e) => { if (!E.s) return; down = { over: true }; moveOver(e); e.preventDefault(); });
    const moveOver = (e) => { const r = over.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * dur(); E.scroll = t - view().span / 2; clampScroll(); drawAll(); };
    window.addEventListener('mousemove', (e) => {
      if (!down || !E.s || !lanes.isConnected) return;
      if (down.over) { moveOver(e); return; }
      const { x } = pos(e, down.ruler ? ruler : lanes), t = timeAt(x);
      if (down.own) { down.own.move(t); drawAll(); return; }
      if (down.layer) { down.layer.offset = +Math.max(0, snap(down.off0 + (e.clientX - down.x0) / view().pps)).toFixed(3); drawLanes(); return; }
      if (down.edge) { E.sel[down.edge] = snap(t); if (E.sel.a > E.sel.b) { [E.sel.a, E.sel.b] = [E.sel.b, E.sel.a]; down.edge = down.edge === 'a' ? 'b' : 'a'; } }
      else if (Math.abs(x - down.x) > 3) { down.moved = true; const s2 = snap(t); E.sel = { a: Math.min(down.start, s2), b: Math.max(down.start, s2) }; }
      drawAll(); drawBar();
    }, { signal });
    window.addEventListener('mouseup', () => {
      if (!down) return;
      const d = down; down = null;
      if (d.over) return;
      if (d.own) { if (d.own.up) d.own.up(); drawAll(); return; }
      if (d.layer) { layerChanged(d.layer); return; }
      if (!d.edge && !d.moved) { seek(d.start); if (!d.ruler) E.sel = null; } // a click: jump there
      if (E.sel && E.sel.b - E.sel.a < 0.01) E.sel = null;
      if (E.panel === 'loop' || E.sel) TFEditTabs.refresh(E.panel);
      drawAll(); drawBar();
    }, { signal });
    const wheel = (e) => {
      if (!E.s) return;
      const r = lanes.getBoundingClientRect();
      if (e.ctrlKey) { e.preventDefault(); zoomTo(E.zoom * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX - r.left); return; }
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || el('dw-scroll').scrollHeight <= el('dw-scroll').clientHeight) { e.preventDefault(); E.scroll += (e.deltaY + e.deltaX) / view().pps; clampScroll(); drawAll(); }
    };
    lanes.addEventListener('wheel', wheel, { passive: false });
    ruler.addEventListener('wheel', wheel, { passive: false });
    const ro = new ResizeObserver(() => drawAll());
    ro.observe(lanes);
    signal.addEventListener('abort', () => ro.disconnect());
  }

  // ---------- the page ----------
  const tb = (label, onclick, { cls = '', title = '', id, disabled = false, html } = {}) => h('button', { class: `dw-b ${cls}`, title, id, disabled, onclick, html }, html ? null : label);
  const seg = (items, value, onPick, title = '') => h('div', { class: 'dw-grp', title }, ...items.map(([v, l, tip]) => tb(l, () => onPick(v), { cls: v === value ? 'on' : '', title: tip || '' })));
  function render() {
    const root = el('view-edit');
    if (!root) return;
    root.innerHTML = '';
    root.classList.toggle('dw', !!E.s);
    const t = track();
    if (!E.s || !t) {
      root.append(h('div', { class: 'ed-empty' },
        h('div', { class: 'ed-empty-ic', html: ICONS.caliper }),
        h('b', {}, 'Edit a song'),
        h('p', {}, 'Right-click a song in the Library → Edit…, or open one here. Cut and keep parts, trim silence, split a long file, add live effects, loop a part, put sounds or your voice on top, and save in 3 ways.'),
        h('div', { class: 'ed-empty-btns' }, h('button', { class: 'tb pri', onclick: pick }, 'Open a song…'),
          h('button', { class: 'tb', onclick: () => window.TFBatch.pickMany(), title: 'The same Trim and / or Effects on many songs, each saved separately' }, 'Edit many songs at once…')),
        h('div', { id: 'ed-busy', class: 'ed-busy', hidden: !E.busy }, E.busy ? 'Opening…' : '')));
      return;
    }
    const clock = (label, id, cls = '') => h('div', { class: 'dw-clockbox' }, h('span', { class: 'dw-lab' }, label), h('div', { class: `dw-clock ${cls}`, id }));
    const transport = h('div', { class: 'dw-bar dw-transport' },
      h('div', { class: 'dw-grp' },
        tb('⏮', () => seek(0), { title: 'To the start (Home)' }), tb('⏪', () => seek(TFDaw.time() - 5), { title: 'Back 5 s' }),
        tb('', playPause, { cls: 'dw-play', id: 'dw-play', title: 'Play / pause (Space)', html: TFDaw.playing ? ICONS.pause : ICONS.play }),
        tb('■', stopButton, { title: 'Stop: back to where you pressed Play' }), tb('⏩', () => seek(TFDaw.time() + 5), { title: 'Forward 5 s' })),
      h('div', { class: 'dw-grp' },
        tb('⟲ Loop A–B', () => { E.loopOn = !E.loopOn; drawAll(); drawBar(); }, { cls: 'dw-loop', id: 'dw-loop', title: 'Play the selected part over and over (L)' }),
        tb(E.rec ? '■ Stop' : '● Rec voice', toggleRecord, { cls: `dw-recbtn${E.rec ? ' on' : ''}`, id: 'dw-rec', title: 'Record your voice on a new track while everything plays' })),
      clock('Time', 'dw-time', 'big'), clock('Bar | Beat', 'dw-bars'), clock('Tempo', 'dw-bpm'), clock('Selected', 'dw-selt'),
      h('span', { class: 'grow' }),
      h('div', { class: 'dw-grp' }, tb('↶ Undo', undo, { disabled: !E.s.canUndo, title: 'Undo (Ctrl+Z)' }), tb('↷ Redo', redo, { disabled: !E.s.canRedo, title: 'Redo (Ctrl+Y)' })),
      h('div', { class: 'dw-grp' },
        tb('📂 Open…', pick, { title: 'Edit another song' }),
        (() => { const s = h('select', { class: 'dw-mode', title: 'How to save' }, ...[['both', 'Keep both'], ['newname', 'New takes the name'], ['replace', 'Replace the original']].map(([v, l]) => h('option', { value: v, selected: E.mode === v }, l))); s.addEventListener('change', () => { E.mode = s.value; }); return s; })(),
        tb('💾 Save', save, { cls: 'pri', title: 'Save the edited song (with the effects, volumes and tracks you hear) next to the original file' })));
    const tools = h('div', { class: 'dw-bar dw-tools' },
      h('span', { class: 'dw-lab' }, 'Tool'),
      h('div', { class: 'dw-grp' },
        tb('⬚ Select', () => { E.tool = 'select'; render(); }, { cls: E.tool === 'select' ? 'on' : '', title: 'Drag across the tracks to select a part; click to jump there' }),
        tb('✂ Cut out', cut, { id: 'dw-cut', title: 'Remove the selected part of the song (Delete)' }),
        tb('◧ Keep only', keep, { id: 'dw-keep', title: 'Keep only the selected part of the song' }),
        tb('↔ Move', () => { E.tool = 'move'; render(); }, { cls: E.tool === 'move' ? 'on' : '', title: 'Drag a track\'s sound (not the song) left or right' })),
      h('span', { class: 'dw-lab' }, 'Snap'),
      seg([['off', 'Off'], ['beat', 'Beat'], ['bar', 'Bar']], E.snap, (v) => { E.snap = v; render(); }, 'Selections and moved sounds land on the beat / bar'),
      h('span', { class: 'dw-lab' }, 'Panel'),
      seg([['trim', 'Trim'], ['split', 'Split'], ['effects', 'Effects'], ['loop', 'Loop'], ['connect', 'Connect']], E.panel, (v) => { E.panel = E.panel === v ? '' : v; if (E.preview) stopPreview(); render(); }),
      h('span', { class: 'grow' }),
      h('div', { class: 'dw-grp' }, tb('−', () => zoomTo(E.zoom / 1.5), { title: 'Zoom out' }), h('span', { class: 'dw-zoom', id: 'dw-zoom' }), tb('+', () => zoomTo(E.zoom * 1.5), { title: 'Zoom in (Ctrl + mouse wheel too)' }), tb('Fit', () => zoomTo(1), { title: 'The whole song' })));
    const heads = h('div', { class: 'dw-heads', id: 'dw-heads' });
    const lanesH = E.tracks.reduce((s, x) => s + (x.kind === 'song' ? SONG_H : LAYER_H), 0);
    const editArea = h('div', { class: 'dw-edit' },
      h('div', { class: 'dw-rh' }, 'Overview'), h('canvas', { id: 'dw-over', class: 'dw-over', title: 'The whole song: click or drag to look at another part' }),
      h('div', { class: 'dw-rh dw-rh3' }, h('span', {}, 'Time'), h('span', {}, 'Bars'), h('span', {}, 'Markers')), h('canvas', { id: 'dw-ruler', class: 'dw-ruler', title: 'Click to jump; drag to select' }),
      h('div', { class: 'dw-scroll', id: 'dw-scroll' },
        h('div', { class: 'dw-rows', style: { height: `${lanesH}px` } }, heads, h('canvas', { id: 'dw-lanes', class: `dw-lanes tool-${E.tool}`, style: { height: `${lanesH}px` } })),
        h('div', { class: 'dw-add' },
          tb('+ Song track', () => TFEditTabs.pickSong('Add a song on a new track', (x) => addLayer({ kind: 'track', id: x.id })), { title: 'Another song from your library on top' }),
          tb('+ Built-in sound', () => TFEditTabs.pickSound((key) => addLayer({ kind: 'sound', key }, { volume: 35, repeat: 0 })), { title: 'Rain, ocean, vinyl crackle, wind, campfire, a beat' }),
          tb(E.rec ? '■ Stop recording' : '+ Record voice', toggleRecord, { title: 'Record your voice on a new track while everything plays' }))),
      h('div', { id: 'ed-busy', class: 'ed-busy', hidden: !E.busy }));
    for (const T of E.tracks) heads.append(header(T));
    const mid = h('div', { class: 'dw-mid' }, h('div', { class: 'dw-insp', id: 'dw-insp' }), editArea);
    root.append(...[transport, tools, mid,
      E.preview ? h('div', { class: 'ed-preview' }, h('b', {}, `🎧 ${E.preview.label}`), h('span', {}, 'You are hearing how it would sound. Nothing is changed yet.'), h('span', { class: 'grow' }), h('button', { class: 'tb', onclick: stopPreview }, 'Stop preview')) : null,
      E.panel ? h('div', { class: 'dw-panel' }, E.panel === 'effects' ? fxPanel() : TFEditTabs.panel(E.panel)) : null].filter(Boolean));
    renderSide();
    wire();
    requestAnimationFrame(() => { clampScroll(); drawAll(); drawBar(); });
  }
  function header(T) {
    const isSong = T.kind === 'song';
    const vol = h('input', { type: 'range', min: 0, max: 200, value: T.volume, title: `Volume ${T.volume}%`, style: { '--c': isSong ? 'var(--accent)' : T.color } });
    vol.addEventListener('input', () => { T.volume = +vol.value; vol.title = `Volume ${T.volume}%`; TFDaw.apply(T); renderSide(); });
    const pan = h('input', { type: 'range', class: 'dw-pan', min: -100, max: 100, value: T.pan, title: panText(T.pan) });
    pan.addEventListener('input', () => { T.pan = +pan.value; pan.title = panText(T.pan); TFDaw.apply(T); renderSide(); });
    pan.addEventListener('dblclick', () => { T.pan = 0; pan.value = 0; TFDaw.apply(T); renderSide(); });
    const tg = (k, label, title, cls) => h('button', { class: `dw-ms ${cls}${T[k] ? ' on' : ''}`, title, onclick: (e) => { e.stopPropagation(); T[k] = !T[k]; for (const x of E.tracks) TFDaw.apply(x); render(); } }, label);
    const fxN = Object.keys(fxOf(T)).length;
    return h('div', { class: `dw-head${T.id === E.selTrack ? ' sel' : ''}`, style: { height: `${isSong ? SONG_H : LAYER_H}px`, '--c': isSong ? 'var(--accent)' : T.color }, onclick: () => { E.selTrack = T.id; render(); } },
      h('div', { class: 'dw-hn' }, h('span', { class: 'dw-hname', title: T.name }, `${isSong ? '🎵' : T.src && T.src.kind === 'sound' ? '🌧' : T.src && T.src.kind === 'rec' ? '🎙' : '🎶'} ${T.name}`),
        isSong ? null : h('button', { class: 'dw-x', title: 'Remove this track', onclick: (e) => { e.stopPropagation(); removeLayer(T); } }, '✕')),
      h('div', { class: 'dw-hrow' }, tg('mute', 'M', 'Mute', 'm'), tg('solo', 'S', 'Solo: only solo tracks are heard', 's'), vol, pan),
      h('div', { class: 'dw-hmeter', id: `dw-m-${T.id}` }),
      isSong ? h('div', { class: 'dw-hinfo' }, `${T.volume}% · ${panText(T.pan)}${fxN ? ` · ${fxN} effect${fxN === 1 ? '' : 's'}` : ''}`) : null);
  }
  const panText = (p) => (+p ? (p < 0 ? `Left ${-p}` : `Right ${p}`) : 'Middle');
  // the inspector strip: the selected track
  function renderSide() {
    const box = el('dw-insp'); if (!box) return;
    const T = selT(), isSong = T.kind === 'song';
    box.innerHTML = '';
    const chips = TFFxMath.ORDER.filter((k) => fxOf(T)[k] !== undefined).map((k) => h('button', { class: 'dw-chip on', title: 'Click to switch off', onclick: () => { delete T.fx[k]; fxChanged(T); } }, h('i'), FX_NAMES[k], h('em', {}, `${T.fx[k]}%`)));
    const fader = h('input', { type: 'range', class: 'dw-fader', min: 0, max: 200, value: T.volume, orient: 'vertical', title: 'Volume' });
    fader.addEventListener('input', () => { T.volume = +fader.value; TFDaw.apply(T); el('dw-vol').textContent = `${T.volume}%`; const hv = document.querySelector(`.dw-head.sel input[type=range]:not(.dw-pan)`); if (hv) hv.value = T.volume; });
    const pan = h('input', { type: 'range', min: -100, max: 100, value: T.pan, class: 'dw-ipan' });
    pan.addEventListener('input', () => { T.pan = +pan.value; TFDaw.apply(T); el('dw-pantext').textContent = panText(T.pan); });
    box.append(
      h('span', { class: 'dw-lab' }, 'Selected track'),
      h('b', { class: 'dw-iname', title: T.name }, T.name),
      h('span', { class: 'dw-note' }, isSong ? `${(track() || {}).artist || 'Unknown artist'} · ${fmtTime(dur())}` : `${fmtTime(T.duration)} · starts at ${fmt(T.offset)}`),
      h('span', { class: 'dw-lab' }, 'Effect chain ', h('span', { class: 'dw-live' }, 'LIVE')),
      ...chips,
      h('button', { class: 'dw-chip add', onclick: () => { E.panel = 'effects'; render(); } }, '+ Add effect'),
      isSong ? null : layerBox(T),
      h('span', { class: 'dw-lab' }, 'Left ⟷ Right ', h('span', { class: 'dw-note', id: 'dw-pantext' }, panText(T.pan))), pan,
      h('div', { class: 'dw-faderbox' }, fader, h('div', { class: 'dw-bigmeter', id: 'dw-meter' })),
      h('div', { class: 'dw-ifoot' }, h('span', {}, 'Vol ', h('b', { id: 'dw-vol' }, `${T.volume}%`)),
        h('span', {}, h('button', { class: `dw-ms m${T.mute ? ' on' : ''}`, onclick: () => { T.mute = !T.mute; for (const x of E.tracks) TFDaw.apply(x); render(); } }, 'M'), ' ', h('button', { class: `dw-ms s${T.solo ? ' on' : ''}`, onclick: () => { T.solo = !T.solo; for (const x of E.tracks) TFDaw.apply(x); render(); } }, 'S'))));
  }
  function layerBox(L) {
    const n = (v, set, max, title) => { const i = h('input', { class: 'ed-num', value: (+v).toFixed(2), title, style: { width: '58px' } }); i.addEventListener('change', () => { const x = parseFloat(i.value); if (Number.isFinite(x)) set(Math.max(0, Math.min(max, x))); }); return i; };
    const rep = h('select', { class: 'dw-sel' }, ...[[1, '1×'], [2, '2×'], [4, '4×'], [8, '8×'], [0, 'Until the end']].map(([v, l]) => h('option', { value: v, selected: L.repeat === v }, l)));
    rep.addEventListener('change', () => { L.repeat = +rep.value; layerChanged(L); });
    return h('div', { class: 'dw-lbox' },
      h('span', { class: 'dw-lab' }, 'Part of this sound'),
      h('div', { class: 'dw-lrow' }, n(L.from, (v) => { L.from = Math.min(v, L.to - 0.05); layerChanged(L); }, L.duration, 'From (seconds)'), '–', n(L.to, (v) => { L.to = Math.max(v, L.from + 0.05); layerChanged(L); }, L.duration, 'To (seconds)')),
      h('div', { class: 'dw-lrow' }, h('span', { class: 'dw-note' }, 'Starts at'), n(L.offset, (v) => { L.offset = v; layerChanged(L); }, 36000, 'Starts at (seconds)'), h('span', { class: 'dw-note' }, 'Repeat'), rep),
      h('div', { class: 'dw-lrow' },
        h('button', { class: `dw-chip tog${L.matchBeat ? ' on' : ''}`, title: 'Speed this track up or down so its beat matches the song (pitch stays)', onclick: () => setMatchBeat(L, !L.matchBeat) }, h('i'), 'Match beat'),
        h('button', { class: `dw-chip tog${L.duck ? ' on' : ''}`, title: 'The song gets quieter while this track sounds (good for talking)', onclick: () => { L.duck = !L.duck; layerChanged(L); } }, h('i'), 'Auto-quiet')));
  }

  // ---------- live effects (bottom panel) ----------
  const FX_NAMES = { echo: 'Echo', slowed: 'Slowed + reverb', nightcore: 'Nightcore', bass: 'Bass boost', eightd: '8D', oned: '1D' };
  const FX_TIPS = { echo: 'Repeats the sound, like in a big hall', slowed: 'Slower and lower, with a soft room', nightcore: 'Faster and higher', bass: 'Stronger low sounds', eightd: 'Moves around your head (headphones)', oned: 'Every speaker the same; nothing moves' };
  const lastStr = { echo: 40, slowed: 50, nightcore: 50, bass: 50, eightd: 50, oned: 100 };
  let fxTimer = null;
  function fxChanged(T, rerender = true) { clearTimeout(fxTimer); fxTimer = setTimeout(() => TFDaw.fxChanged(T), 60); if (rerender) render(); else { renderSide(); renderHeads(); } }
  function renderHeads() { const box = el('dw-heads'); if (!box) return; box.innerHTML = ''; for (const T of E.tracks) box.append(header(T)); }
  function fxPanel() {
    const T = selT(), isSong = T.kind === 'song';
    const card = (k) => {
      const on = T.fx[k] !== undefined, rateFx = TFFxMath.RATE_FX.includes(k), blocked = rateFx && !isSong;
      const val = on ? T.fx[k] : lastStr[k];
      const knob = h('div', { class: 'dw-knob', style: { '--k': `${val * 0.75}%` }, title: blocked ? 'Only on the song track (it changes the speed)' : 'Drag up / down or use the mouse wheel', tabindex: 0 }, h('span', {}, on ? `${val}%` : 'off'));
      const setVal = (v) => { v = Math.max(0, Math.min(100, Math.round(v))); lastStr[k] = v; if (T.fx[k] === undefined) T.fx[k] = v; else T.fx[k] = v; knob.style.setProperty('--k', `${v * 0.75}%`); knob.firstChild.textContent = `${v}%`; fxChanged(T, false); };
      if (!blocked) {
        knob.addEventListener('mousedown', (e) => {
          if (!on) { T.fx[k] = lastStr[k]; fxChanged(T); return; }
          const y0 = e.clientY, v0 = T.fx[k];
          const mv = (ev) => setVal(v0 + (y0 - ev.clientY) * 0.6);
          const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); render(); };
          window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
          e.preventDefault();
        });
        knob.addEventListener('wheel', (e) => { if (T.fx[k] === undefined) return; e.preventDefault(); setVal(T.fx[k] + (e.deltaY < 0 ? 5 : -5)); }, { passive: false });
      }
      return h('div', { class: `dw-fx${on ? ' on' : ''}${blocked ? ' blocked' : ''}` },
        h('button', { class: `fx-switch${on ? ' on' : ''}`, disabled: blocked, onclick: () => { if (on) delete T.fx[k]; else T.fx[k] = lastStr[k]; fxChanged(T); } }, h('span', { class: 'knob' }), FX_NAMES[k]),
        knob, h('span', { class: 'dw-note' }, blocked ? 'Song track only' : FX_TIPS[k]));
    };
    return h('div', {},
      h('div', { class: 'ed-row' }, h('b', {}, `Effects on "${T.name}"`), h('span', { class: 'dw-live' }, 'LIVE'),
        h('span', { class: 'ed-note' }, 'Switch an effect on and turn its knob while the music plays: you hear it at once. Click a track on the left to give it its own effects. Save keeps what you hear.'),
        h('span', { class: 'grow' }),
        h('button', { class: 'tb', onclick: () => { T.fx = {}; fxChanged(T); } }, '↺ All off'),
        h('button', { class: 'tb pri', title: 'Mix the tracks, effects and volumes into the song now (Undo takes it back)', onclick: bake }, 'Apply to the song')),
      h('div', { class: 'dw-fxs' }, ...TFFxMath.ORDER.map(card)));
  }

  // ---------- keys on the Edit page ----------
  document.addEventListener('keydown', (e) => {
    if (S.view !== 'edit' || !E.s || e.target.closest('input, textarea, select, .modal')) return;
    const k = `${e.ctrlKey ? 'Ctrl+' : ''}${e.code}`;
    const run = {
      Space: playPause, Delete: cut, 'Ctrl+KeyZ': undo, 'Ctrl+KeyY': redo, Home: () => seek(0), KeyL: () => { if (E.sel) { E.loopOn = !E.loopOn; drawAll(); drawBar(); } },
      Escape: () => { if (E.preview) stopPreview(); else { E.sel = null; E.loopOn = false; drawAll(); drawBar(); } },
    }[k];
    if (run) { e.preventDefault(); e.stopImmediatePropagation(); run(); }
  }, true);

  const stop = () => { TFDaw.pause(); if (E.preview) { E.preview = null; TFDaw.stopPreview(true); } drawBar(); };
  // a small stand-in for the old <audio> player, used by the panels (edittabs.js)
  const player = {
    get currentTime() { return TFDaw.time(); }, set currentTime(t) { seek(t); },
    get paused() { return !TFDaw.playing; }, play: () => playPause(), pause: () => { TFDaw.pause(); drawBar(); },
  };
  const api = {
    get session() { return E.s; }, get sel() { return E.sel; }, set sel(v) { E.sel = v; drawAll(); drawBar(); },
    get previewing() { return !!E.preview; }, player, fmt, track,
    draw: () => { drawAll(); drawBar(); }, render, change, preview, stopPreview, busy, timeAt: (x) => timeAt(x),
    seek, xAt: (t) => xAt(t), view: () => view(), playRange, get tracks() { return E.tracks; }, get panel() { return E.panel; },
  };
  return { open, render, pick, stop, api, get session() { return E.s; } };
})();
