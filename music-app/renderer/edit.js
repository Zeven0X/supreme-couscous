'use strict';
/* global S, h, tf, guard, toast, coverEl, fmtTime, modal, confirmModal, upsertTrack, renderGrid, pause, ICONS, TFPlaylists, TFEditTabs, TFDaw, TFFxMath, TFIcon */
// The Edit page, laid out like a music studio program (design B, approved 2026-11-25):
//   transport bar (play, loop, record, clocks, tools, snap, marks, zoom, save) · left: your marks + Smart loop +
//   add a track · the tracks (overview, ruler with marks, one lane per track) · the bottom panel (Sound + Fades,
//   Effects, Mixer, Trim, Split, Loop, Connect) · the Library player shrinks to a small bar meanwhile.
// Everything plays live (renderer/dawengine.js). Changes to the song's shape (cut, trim, split, loop,
// connect) make a new working copy (Undo / Redo). Save mixes the tracks the same way you heard them.
window.TFEdit = (() => {
  const E = {
    s: null, sel: null, zoom: 1, scroll: 0, busy: false, mode: 'both', panel: 'sound', tool: 'select', snap: 'off',
    marks: [], markA: null, markB: null, // your marks on the song; A and B = the part to loop
    markHist: {}, // the marks at each version, so Undo / Redo bring them back
    follow: false, // when zoomed in, the view follows the playhead (off: it stays where you put it)
    loopOn: false, beats: null, tracks: [], selTrack: 'song', preview: null, stopAt: null, playFrom: 0, rec: null,
    tok: 0, // goes up when something is stopped, so slow work that finishes later knows it is not wanted any more
    bakes: {}, // "Apply to the song": the tracks before it, so Undo brings them back
    recStarting: false,
  };
  const COLORS = ['#7aa8ff', '#ff9ad5', '#ffd36b', '#5cf2a8', '#c59bff', '#ff9f6b'];
  const SONG_H = 112, LAYER_H = 64;
  const el = (id) => document.getElementById(id);
  const fmt = (t) => { const s = Math.max(0, t || 0); return `${fmtTime(s)}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`; };
  const track = () => (E.s ? S.byId.get(E.s.trackId) : null);
  const song = () => E.tracks[0];
  const layers = () => E.tracks.slice(1);
  const selT = () => E.tracks.find((t) => t.id === E.selTrack) || song();
  const dur = () => (E.s ? E.s.duration : 0);
  const songTime = () => (E.preview ? E.preview.back : TFDaw.time()); // where you are in the song (a preview has its own clock)
  let nextLayer = 1, nextMark = 1;
  const SOUND0 = { speed: 100, pitch: 100, natural: true, fadeIn: 0, fadeOut: 0, fadeShape: 'smooth' }; // a track's Sound + Fades
  const soundOn = (t) => Math.abs(t.speed - 100) > 1e-6 || Math.abs(t.pitch - 100) > 1e-6;
  const fadeOn = (t) => t.fadeIn > 0 || t.fadeOut > 0;
  const MARK_COLORS = ['#7aa8ff', '#5cf2a8', '#ff9ad5', '#ffd36b', '#c59bff', '#ff9f6b'];

  // ---------- opening a song ----------
  const unsaved = () => E.s && (E.s.version > 0 || mixPending());
  async function open(trackId) {
    const t = S.byId.get(trackId);
    if (!t) return;
    if (E.busy) { toast('Wait a moment: Tonix is still working on the song.'); return; }
    if (E.s && E.s.trackId === trackId) { window.showView('edit'); return; } // already open: keep your changes
    if (E.s && E.s.trackId !== trackId && unsaved()) {
      const ok = await confirmModal('Leave the song you are editing?', `"${(track() || {}).title}" has changes that are not saved. They will be lost.`, 'Leave without saving');
      if (!ok) return;
    }
    window.showView('edit');
    stopRec(); // a recording for the other song is dropped
    stopAll();
    if (E.s) { tf.editClose(E.s.id).catch(() => {}); E.s = null; }
    for (const k of Object.keys(variantTimers)) { clearTimeout(variantTimers[k]); delete variantTimers[k]; }
    Object.assign(E, { sel: null, zoom: 1, scroll: 0, beats: null, tracks: [], selTrack: 'song', loopOn: false, preview: null, bakes: {}, marks: [], markA: null, markB: null, markHist: {} });
    TFEditTabs.reset();
    render();
    busy(`Opening "${t.title}"…`);
    const st = await guard(() => tf.editOpen(trackId), 'Edit: ');
    busy(null);
    if (!st) { render(); return; }
    E.tracks = [{ id: 'song', kind: 'song', name: t.title, color: '#ff8a3d', volume: 100, pan: 0, mute: false, solo: false, fx: {}, ...SOUND0 }];
    show({ ...st, trackId });
  }
  function show(st) {
    const keep = E.s ? E.s.trackId : st.trackId;
    const at = E.s && E.s.id === st.id ? TFDaw.time() : 0; // another song starts at the beginning
    stopAll();
    E.preview = null;
    E.s = { ...st, trackId: st.trackId || keep };
    const b = E.bakes[st.version];
    let restored = false;
    if (b && !mixPending()) { E.tracks = copyTracks(b.snap); E.selTrack = 'song'; b.restored = true; restored = true; } // Undo after "Apply to the song": the tracks come back
    for (const x of Object.values(E.bakes)) if (x.after === st.version && x.restored) { x.restored = false; cleanTracks(); } // Redo: mixed in again
    const oldUrl = song().url;
    if (oldUrl && oldUrl !== st.url) TFDaw.forget(oldUrl); // free the memory of the old working copy
    Object.assign(song(), { url: st.url, peaks: st.peaks, duration: st.duration });
    if (soundOn(song())) { if (song().playUrl) TFDaw.forget(song().playUrl); song().playUrl = null; song().stretch = 1; updateVariant(song()); } // the new copy at your speed / pitch
    if (restored) for (const L of layers()) if (soundOn(L) || L.matchBeat) updateVariant(L);
    for (const m of E.marks) m.t = Math.min(m.t, st.duration);
    TFDaw.setTracks(E.tracks);
    TFDaw.seek(Math.min(at || 0, st.duration));
    TFEditTabs.onVersion();
    if (E.sel && E.sel.b > st.duration) E.sel = null;
    E.beats = null;
    tf.editBpm(E.s.id).then((b) => { if (E.s && E.s.id === st.id) { E.beats = b; drawAll(); drawBar(); } }).catch(() => {});
    TFDaw.load(st.url).catch(() => {}); // get the song ready to play
    render();
  }
  // close the song: the Edit page becomes empty (the song stays in your library, the file is not touched)
  async function closeSong() {
    if (!E.s || E.busy) return;
    const t = track();
    if (unsaved()) {
      const ok = await confirmModal('Close this song?', `"${t ? t.title : 'This song'}" has changes that are not saved. They will be lost.`, 'Close without saving');
      if (!ok) return;
    }
    stopRec(); stopAll();
    for (const k of Object.keys(variantTimers)) { clearTimeout(variantTimers[k]); delete variantTimers[k]; }
    for (const x of E.tracks) { if (x.url) TFDaw.forget(x.url); if (x.playUrl) TFDaw.forget(x.playUrl); }
    TFDaw.setTracks([]);
    tf.editClose(E.s.id).catch(() => {});
    E.s = null;
    Object.assign(E, { sel: null, zoom: 1, scroll: 0, beats: null, tracks: [], selTrack: 'song', loopOn: false, preview: null, bakes: {}, marks: [], markA: null, markB: null, markHist: {} });
    TFEditTabs.reset();
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
  async function change(fn, msg, history = false, shift = null) {
    if (!E.s || E.busy) return null;
    stopAll();
    const sid = E.s.id, v = E.s.version;
    E.markHist[v] = snapMarks(); // how the marks are now, for Undo / Redo
    busy(msg);
    const st = await guard(fn, 'Edit: ');
    busy(null);
    if (!st || !E.s || E.s.id !== sid) return null; // another song was opened meanwhile
    if (!history) for (const k of Object.keys(E.bakes)) if (+k >= v) delete E.bakes[k]; // a new change: older Redo steps are gone
    if (history && E.markHist[st.version]) restoreMarks(E.markHist[st.version]);
    else if (shift) moveMarks(shift);
    show(st);
    return st;
  }
  const copyTracks = (list) => list.map((t) => ({ ...t, fx: { ...t.fx }, nodes: null, making: false, want: null }));
  const snapMarks = () => ({ marks: E.marks.map((m) => ({ ...m })), a: E.markA, b: E.markB, sel: E.sel ? { ...E.sel } : null });
  function restoreMarks(h) { E.marks = h.marks.map((m) => ({ ...m })); E.markA = h.a; E.markB = h.b; E.sel = h.sel ? { ...h.sel } : null; }
  function cleanTracks() {
    const s = song();
    clearTimeout(variantTimers[s.id]); delete variantTimers[s.id];
    if (s.playUrl) TFDaw.forget(s.playUrl);
    Object.assign(s, { fx: {}, volume: 100, pan: 0, mute: false, solo: false, ...SOUND0, playUrl: null, stretch: 1, want: null, making: false }); E.tracks = [s]; E.selTrack = 'song'; TFDaw.setTracks(E.tracks); TFDaw.fxChanged(s); }
  const needSel = () => { if (!E.sel) { toast('Select a part first: drag across the song.'); return false; } return true; };
  const cut = () => { if (!needSel()) return; const { a, b } = E.sel; E.sel = null; E.loopOn = false; return change(() => tf.editApply(E.s.id, { type: 'cut', a, b }), 'Cutting…', false, { cut: [a, b] }); };
  const keep = () => { if (!needSel()) return; const { a, b } = E.sel; E.sel = null; E.loopOn = false; return change(() => tf.editApply(E.s.id, { type: 'keep', a, b }), 'Keeping the selected part…', false, { keep: [a, b] }); };
  const undo = () => E.s && E.s.canUndo && change(() => tf.editUndo(E.s.id), 'Undo…', true);
  const redo = () => E.s && E.s.canRedo && change(() => tf.editRedo(E.s.id), 'Redo…', true);

  // ---------- the live mix → saved the same way ----------
  const fxOf = (t) => Object.fromEntries(Object.entries(t.fx || {}).filter(([, v]) => v !== undefined && v !== null));
  function mixPending() {
    const s = song();
    return !!s && (Object.keys(fxOf(s)).length > 0 || s.volume !== 100 || +s.pan !== 0 || s.mute || soundOn(s) || fadeOn(s) || layers().some((L) => !L.mute));
  }
  const soundOf = (t) => ({ speed: t.speed, pitch: t.pitch, natural: t.natural, fadeIn: t.fadeIn, fadeOut: t.fadeOut, fadeShape: t.fadeShape });
  function mixOp() {
    const s = song();
    return {
      type: 'mix',
      song: { fx: fxOf(s), volume: s.volume, pan: s.pan, mute: s.mute, solo: s.solo && !s.mute, ...soundOf(s) },
      layers: layers().filter((L) => !L.mute).map((L) => ({ src: L.src, offset: L.offset, from: L.from, to: L.to, volume: L.volume, pan: L.pan, mute: L.mute, solo: L.solo && !L.mute, repeat: L.repeat, matchBeat: L.matchBeat, duck: L.duck, fx: fxOf(L), ...soundOf(L) })),
    };
  }
  async function bake() { // "Apply to the song": the tracks become one working copy (Undo takes it back)
    if (!mixPending()) { toast('Nothing to apply: no effects, volume change or layers.'); return null; }
    const v = E.s.version, snap = copyTracks(E.tracks), s0 = song();
    const rate = TFFxMath.params(fxOf(s0)).rate * Math.min(4, Math.max(0.25, s0.speed / 100)); // the mixed song is this much faster
    const st = await change(() => tf.editDo(E.s.id, mixOp()), 'Mixing the tracks into the song…', false, Math.abs(rate - 1) > 1e-6 ? { scale: 1 / rate } : null);
    if (st) { E.bakes[v] = { snap, after: st.version, restored: false }; cleanTracks(); render(); }
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
    const next = r.added ? r.added.id : E.s.trackId; // go on with the saved song
    tf.editClose(E.s.id).catch(() => {});
    E.s = null;
    open(next);
  }

  // ---------- layers (tracks on top of the song) ----------
  async function addLayer(src, extra = {}) {
    const sid = E.s && E.s.id;
    const info = await guard(() => tf.editSource(src), 'Track: ');
    if (!info || !E.s || E.s.id !== sid) return; // another song was opened meanwhile
    const L = {
      id: `L${nextLayer}`, kind: 'layer', src, name: extra.name || info.name, color: COLORS[(nextLayer - 1) % COLORS.length], url: info.url, peaks: info.peaks, duration: info.duration,
      offset: +songTime().toFixed(2), from: 0, to: +info.duration.toFixed(3), volume: 70, pan: 0, mute: false, solo: false, repeat: 1, matchBeat: false, duck: false, fx: {}, ...SOUND0, ...extra,
    };
    nextLayer++;
    E.tracks.push(L);
    E.selTrack = L.id;
    TFDaw.setTracks(E.tracks);
    TFDaw.load(L.url).catch(() => toast(`"${L.name}" could not be loaded.`, { type: 'error' }));
    if (TFDaw.playing && !TFDaw.previewing) TFDaw.play(TFDaw.time()).catch(() => {});
    render();
  }
  async function setMatchBeat(L, on) {
    L.matchBeat = on;
    if (!on) { L.matchTempo = 1; await updateVariant(L); render(); return; }
    busy('Matching the beat…');
    const r = await guard(() => tf.editMatchBeat(E.s.id, L.src), 'Match beat: ');
    busy(null);
    if (!r) { L.matchBeat = false; render(); return; }
    L.matchTempo = r.tempo;
    toast(r.tempo === 1 ? 'Already at the same beat.' : `Beat matched: ${Math.round(r.layerBpm)} → ${Math.round(r.songBpm)} BPM.`, { ms: 2500 });
    await updateVariant(L);
    render();
  }
  // ---------- a track's Sound (speed / pitch): played from a studio-quality copy, made in the background ----------
  const variantTimers = {};
  function restart() { if (TFDaw.playing && !TFDaw.previewing) TFDaw.play(TFDaw.time()).catch(() => {}); drawAll(); renderHeads(); }
  function soundChanged(T) { clearTimeout(variantTimers[T.id]); variantTimers[T.id] = setTimeout(() => updateVariant(T), 350); renderHeads(); drawAll(); }
  async function updateVariant(T) {
    if (!E.s) return;
    if (!E.tracks.includes(T)) return; // removed meanwhile
    const sid = E.s.id, mt = T.kind === 'layer' && T.matchBeat ? (T.matchTempo || 1) : 1;
    const tempo = Math.min(4, Math.max(0.25, (mt * T.speed) / 100)), pitch = T.pitch / 100;
    const wantOf = () => `${Math.min(4, Math.max(0.25, ((T.kind === 'layer' && T.matchBeat ? (T.matchTempo || 1) : 1) * T.speed) / 100))}|${T.pitch / 100}|${T.natural}|${T.kind === 'song' && E.s ? E.s.version : ''}`;
    const want = wantOf();
    T.want = want;
    const use = (url, st) => { if (T.playUrl && T.playUrl !== url) TFDaw.forget(T.playUrl); T.playUrl = url; T.stretch = st; };
    if (Math.abs(tempo - 1) < 1e-4 && Math.abs(pitch - 1) < 1e-4) { use(null, 1); T.making = false; status(); restart(); return; }
    T.making = true; status();
    const r = await guard(() => tf.editVariant(sid, T.kind === 'song' ? null : T.src, { tempo, pitch, natural: T.natural }), 'Sound: ');
    const stale = () => !E.s || E.s.id !== sid || T.want !== want || wantOf() !== want || !E.tracks.includes(T);
    if (stale()) return; // changed again, removed, or another song meanwhile
    if (r && r.url) { await TFDaw.load(r.url).catch(() => {}); if (stale()) { TFDaw.forget(r.url); return; } use(r.url, r.tempo || tempo); }
    T.making = false;
    status();
    restart();
  }
  function status() {
    const b = el('dw-status'); if (!b) return;
    const n = E.tracks.filter((t) => t.making).length;
    b.hidden = !n; b.textContent = n ? 'Making the new sound…' : '';
  }
  // ---------- your marks (landmarks on the song) ----------
  const markById = (id) => E.marks.find((m) => m.id === id) || null;
  function addMark(t, name) {
    if (!E.s) return null;
    t = +Math.max(0, Math.min(dur(), snap(t))).toFixed(3);
    const near = E.marks.find((m) => Math.abs(m.t - t) < 0.05);
    if (near) return near;
    const m = { id: nextMark, t, name: name || `Mark ${E.marks.length + 1}`, color: MARK_COLORS[(nextMark - 1) % MARK_COLORS.length] };
    nextMark++;
    E.marks.push(m);
    E.marks.sort((x, y) => x.t - y.t);
    renderBrowser(); drawAll();
    return m;
  }
  function removeMark(m) { E.marks = E.marks.filter((x) => x !== m); if (E.markA === m.id) E.markA = null; if (E.markB === m.id) E.markB = null; renderBrowser(); drawAll(); }
  function setAB(which, m) {
    if (which === 'a') E.markA = E.markA === m.id ? null : m.id; else E.markB = E.markB === m.id ? null : m.id;
    syncAB(true);
  }
  // A and B marks make the selection (the part to loop)
  function syncAB(tell) {
    const a = markById(E.markA), b = markById(E.markB);
    if (a && b) {
      if (a.t < b.t - 0.05) { E.sel = { a: a.t, b: b.t }; } else if (tell) toast('A must be before B: choose an earlier mark for A.');
    }
    renderBrowser(); TFEditTabs.refresh(E.panel); drawAll(); drawBar();
  }
  // after a cut / keep: marks move with the music (marks in a removed part go away)
  function moveMarks({ cut, keep, loop, connect, scale }) {
    const out = [];
    const sh = (t) => {
      if (cut) return t < cut[0] ? t : t > cut[1] ? t - (cut[1] - cut[0]) : null;
      if (keep) return t >= keep[0] && t <= keep[1] ? t - keep[0] : null;
      if (loop) return t > loop[1] ? t + (loop[1] - loop[0]) * (loop[2] - 1) : t; // after B: later by the repeats
      if (connect) return t <= connect[0] ? t : connect[2] === 'end' ? null : t + connect[1]; // after the piece goes in
      if (scale) return t * scale; // the song got faster / slower
      return t;
    };
    for (const m of E.marks) { const t = sh(m.t); if (t !== null && t !== undefined) { m.t = +t.toFixed(3); out.push(m); } }
    if (E.sel && (loop || connect || scale)) { const a = sh(E.sel.a), b = sh(E.sel.b); E.sel = a !== null && b !== null && b > a ? { a, b } : null; }
    E.marks = out;
    if (!markById(E.markA)) E.markA = null;
    if (!markById(E.markB)) E.markB = null;
  }
  // ---------- Smart loop (the original): A and B move a tiny bit so the end flows into the start ----------
  async function smartLoop() {
    if (!E.s) return;
    if (!E.sel) { toast('Choose the part first: press A and B on two marks (or drag across the song).'); return; }
    const sid = E.s.id, sel = E.sel;
    const r = await guard(() => tf.editSmartLoop(sid, sel.a, sel.b), 'Smart loop: ');
    if (!r || !E.s || E.s.id !== sid) return;
    const da = r.a - sel.a, db = r.b - sel.b;
    E.sel = { a: r.a, b: r.b };
    const A = markById(E.markA), B = markById(E.markB); // the A and B marks move with it
    if (A && B) { A.t = r.a; B.t = r.b; }
    const moved = (n, x) => (Math.abs(x) < 0.0005 ? `${n} stays put` : `${n} moved ${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(3)} s`);
    toast(`${moved('A', da)}, ${moved('B', db)}, so the end joins the start smoothly.`, { type: 'ok', ms: 5000 });
    renderBrowser(); TFEditTabs.refresh(E.panel); drawAll(); drawBar();
  }
  function layerChanged(L, rerender = true) { TFDaw.apply(L); if (TFDaw.playing && !TFDaw.previewing) TFDaw.play(TFDaw.time()).catch(() => {}); if (rerender) render(); else drawAll(); }
  function removeLayer(L) { clearTimeout(variantTimers[L.id]); delete variantTimers[L.id]; if (L.playUrl) TFDaw.forget(L.playUrl); E.tracks = E.tracks.filter((t) => t !== L); if (E.selTrack === L.id) E.selTrack = 'song'; TFDaw.setTracks(E.tracks); if (TFDaw.playing && !TFDaw.previewing) TFDaw.play(TFDaw.time()).catch(() => {}); render(); }

  // stop the recording (a recorder that has not started yet is just dropped)
  function stopRec() { const r = E.rec; if (!r) return; if (r.state === 'inactive') E.rec = null; else r.stop(); }
  // record your voice while everything plays
  async function toggleRecord() {
    if (E.rec) { stopRec(); return; }
    if (E.recStarting || !E.s) return; // a double click doesn't start two recordings
    if (E.preview) stopPreview();
    let stream, rec;
    E.recStarting = true;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); rec = new MediaRecorder(stream); } catch (e) {
      E.recStarting = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      toast(`Tonix can't use the microphone (${e.message}). Check Windows Settings → Privacy → Microphone.`, { type: 'error', ms: 8000 });
      return;
    }
    E.recStarting = false;
    const chunks = [], at = TFDaw.time(), sid = E.s.id, t0 = Date.now();
    let startT = at; // the song time you heard when the recording started
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
      // the voice lines up with what you heard (the sound reaches the speakers a little late)
      const rate = TFDaw.songRate();
      if (src) { TFDaw.seek(at); await addLayer(src, { volume: 100, duck: true, name: 'Your voice', offset: +Math.max(0, startT).toFixed(3), from: +Math.max(0, -startT / rate).toFixed(3) }); }
      render();
    };
    const timer = setInterval(() => { const b = el('dw-rec-t'); if (b) b.textContent = `Stop ${fmtTime((Date.now() - t0) / 1000)}`; }, 250);
    E.rec = rec;
    try { await TFDaw.play(at); } catch (_) { /* the song could not load: record anyway */ } // talk / sing along
    if (!E.s || E.s.id !== sid || E.rec !== rec) { stream.getTracks().forEach((t) => t.stop()); clearInterval(timer); if (E.rec === rec) E.rec = null; return; }
    rec.start(250);
    startT = TFDaw.time() - TFDaw.latency() * TFDaw.songRate();
    render();
  }

  // ---------- playing ----------
  function stopAll() { TFDaw.pause(); E.stopAt = null; E.tok++; if (E.preview) { TFDaw.forget(E.preview.url); E.preview = null; } }
  async function playPause() {
    if (!E.s || E.busy) return;
    if (E.preview) { stopPreview(); return; }
    if (TFDaw.playing) { TFDaw.pause(); drawBar(); return; }
    pause(); // the main player stops: one thing plays at a time
    E.stopAt = null; E.playFrom = TFDaw.time();
    if (TFDaw.time() >= dur() - 0.05) TFDaw.seek(0);
    await TFDaw.play(TFDaw.time() >= dur() - 0.05 ? 0 : TFDaw.time()).catch((e) => toast(e.message, { type: 'error' }));
    drawBar();
  }
  function stopButton() { TFDaw.pause(); TFDaw.seek(E.playFrom || 0); E.stopAt = null; drawAll(); drawBar(); }
  function playRange(a, b) { if (!E.s || E.busy) return; if (E.preview) stopPreview(); pause(); E.stopAt = b; TFDaw.play(a).catch((e) => toast(e.message, { type: 'error' })); drawBar(); }
  const seek = (t) => { E.stopAt = null; TFDaw.seek(Math.max(0, Math.min(dur(), t))); drawAll(); drawBar(); };
  TFDaw.onEnd(() => { if (E.preview && !TFDaw.previewing) { TFDaw.forget(E.preview.url); E.preview = null; render(); } drawBar(); });
  (function tick() {
    if (E.s && E.preview && !TFDaw.previewing && !E.busy) { E.preview = null; render(); } // the preview was stopped elsewhere
    if (E.s && TFDaw.playing) {
      const t = TFDaw.time();
      if (!E.preview) {
        if (E.stopAt !== null && t >= E.stopAt) { TFDaw.pause(); TFDaw.seek(E.stopAt); E.stopAt = null; }
        else if (t >= dur() && !(E.loopOn && E.sel)) { TFDaw.pause(); TFDaw.seek(dur()); } // the end (even if the song itself stopped early)
        else if (E.loopOn && E.sel && t >= E.sel.b) TFDaw.play(E.sel.a).catch(() => {}); // Loop A–B
        follow(t);
      }
      drawAll(); drawBar(); drawMeters();
    }
    requestAnimationFrame(tick);
  })();
  // keep the playhead on screen while playing (zoomed in)
  function follow(t) { if (!E.follow) return; const v = view(); if (E.zoom > 1 && (t < v.t0 || t > v.t0 + v.span * 0.92)) { E.scroll = t - v.span * 0.1; clampScroll(); } }

  // ---------- previews (Trim / Loop / Connect): hear a change before making it ----------
  async function preview(op, { from = null, label = 'Preview' } = {}) {
    if (!E.s || E.busy) return;
    stopAll();
    const tok = E.tok, sid = E.s.id, back = TFDaw.time();
    busy('Making a preview…');
    const p = await guard(() => tf.editPreview(E.s.id, op), 'Preview: ');
    busy(null);
    if (!p || tok !== E.tok || S.view !== 'edit' || !E.s || E.s.id !== sid) return; // stopped, another page or another song meanwhile
    await TFDaw.playPreview(p.url, from ?? back);
    if (tok !== E.tok) { TFDaw.stopPreview(true); return; }
    E.preview = { ...p, label, back };
    render();
  }
  function stopPreview() { if (!E.preview) return; const back = E.preview.back; TFDaw.forget(E.preview.url); E.preview = null; TFDaw.stopPreview(true); TFDaw.seek(back); render(); }

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
    const px = (songTime() / dur()) * W; g.fillStyle = '#ff6b6b'; g.fillRect(px, 0, 1.5 * dpr, H);
  }
  function drawRuler() {
    const c = el('dw-ruler'); if (!c || !E.s) return;
    const { g, dpr, W, H } = sizeCanvas(c);
    g.clearRect(0, 0, W, H);
    const v = view();
    g.font = `${10.5 * dpr}px Consolas, 'DejaVu Sans Mono', monospace`;
    // row 1: time
    const steps = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const step = steps.find((s) => s * v.pps >= 70) || 600;
    for (let t = Math.ceil(v.t0 / step) * step; t <= v.t0 + v.span + 1e-9; t += step) {
      const x = xAt(t) * dpr; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, 11 * dpr, 1, 4 * dpr); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText(step < 1 ? fmt(t) : fmtTime(t), x + 3 * dpr, 10 * dpr);
    }
    // row 2: bars
    if (beatLen()) {
      const bar = beatLen() * 4, f = firstBeat();
      let every = 1; while (bar * every * v.pps < 26) every *= 2;
      for (let k = Math.max(0, Math.floor((v.t0 - f) / bar)); f + k * bar <= v.t0 + v.span; k++) {
        if (k % every) continue;
        const x = xAt(f + k * bar) * dpr;
        g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, 26 * dpr, 1, 5 * dpr);
        if (k % (every * 4) === 0) { g.fillStyle = 'rgba(255,138,61,.75)'; g.fillText(String(k + 1), x + 3 * dpr, 24 * dpr); }
      }
    }
    // row 3: your marks (flags), the selection, split cuts / connect point
    g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, 32 * dpr, W, H - 32 * dpr);
    const mk = (t, txt, col) => { const x = xAt(t) * dpr; g.fillStyle = col; g.beginPath(); g.arc(x, 41 * dpr, 7 * dpr, 0, 7); g.fill(); g.fillStyle = '#0b0d11'; g.font = `bold ${9.5 * dpr}px system-ui`; g.fillText(txt, x - 3 * dpr, 44.5 * dpr); };
    const fromMarks = markById(E.markA) && markById(E.markB);
    if (E.sel) { g.fillStyle = E.loopOn ? 'rgba(63,224,160,.35)' : 'rgba(255,138,61,.28)'; g.fillRect(xAt(E.sel.a) * dpr, 32 * dpr, (xAt(E.sel.b) - xAt(E.sel.a)) * dpr, 3 * dpr); }
    // your marks: a thin line with a small pin, the name in its colour on a dark label (shortened when marks are close)
    if (fromMarks) { const a = xAt(markById(E.markA).t) * dpr, b = xAt(markById(E.markB).t) * dpr; g.fillStyle = 'rgba(63,224,160,.10)'; g.fillRect(a, 33 * dpr, b - a, H - 33 * dpr); }
    g.font = `600 ${10.5 * dpr}px system-ui, sans-serif`;
    const shown = E.marks.map((m) => ({ m, x: xAt(m.t) * dpr })).filter((k) => k.x > -300 * dpr && k.x < W + 2 * dpr).sort((p, q) => p.x - q.x);
    shown.forEach(({ m, x }, i) => {
      const ab = E.markA === m.id ? 'A' : E.markB === m.id ? 'B' : '';
      const col = ab ? '#3fe0a0' : m.color;
      g.fillStyle = col; g.fillRect(x - 0.5 * dpr, 34 * dpr, 1.5 * dpr, H - 34 * dpr); // the line
      g.beginPath(); g.moveTo(x - 4 * dpr, 34 * dpr); g.lineTo(x + 4 * dpr, 34 * dpr); g.lineTo(x, 39 * dpr); g.closePath(); g.fill(); // the pin
      const room = (i + 1 < shown.length ? shown[i + 1].x : W) - x - 8 * dpr; // up to the next mark
      const badge = ab ? 13 * dpr : 0;
      let text = m.name;
      const max = room - badge - 14 * dpr;
      if (g.measureText(text).width > max) { while (text.length > 1 && g.measureText(`${text}…`).width > max) text = text.slice(0, -1); text = max > 12 * dpr ? `${text}…` : ''; }
      if (!text && !ab) return;
      const w = (text ? g.measureText(text).width + 12 * dpr : 6 * dpr) + badge, lx = x + 4 * dpr, ly = 34.5 * dpr, lh = 14 * dpr;
      g.fillStyle = 'rgba(11,13,17,.9)'; roundRect(g, lx, ly, w, lh, 4 * dpr); g.fill();
      g.strokeStyle = col; g.lineWidth = dpr; roundRect(g, lx + 0.5 * dpr, ly + 0.5 * dpr, w - dpr, lh - dpr, 4 * dpr); g.stroke();
      if (ab) { g.fillStyle = '#3fe0a0'; g.beginPath(); g.arc(lx + 8.5 * dpr, ly + lh / 2, 5.5 * dpr, 0, 7); g.fill(); g.fillStyle = '#06120d'; g.font = `800 ${8.5 * dpr}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillText(ab, lx + 8.5 * dpr, ly + lh / 2 + 3 * dpr); g.textAlign = 'left'; g.font = `600 ${10.5 * dpr}px system-ui, sans-serif`; }
      if (text) { g.fillStyle = col; g.fillText(text, lx + 6 * dpr + badge, ly + 10.5 * dpr); }
    });
    if (E.sel && !fromMarks) { mk(E.sel.a, 'A', E.loopOn ? '#3fe0a0' : '#ffb27a'); mk(E.sel.b, 'B', E.loopOn ? '#3fe0a0' : '#ffb27a'); }
    TFEditTabs.markers({ mk, tab: E.panel });
    const px = xAt(songTime()) * dpr; g.fillStyle = '#ff5d6c'; g.fillRect(px, 0, 1.5 * dpr, H);
  }
  function laneTops() { let y = 0; return E.tracks.map((t) => { const top = y; y += t.kind === 'song' ? SONG_H : LAYER_H; return top; }); }
  // a track's start and end on the song's timeline (song seconds)
  function span(t) { if (t.kind === 'song') return [0, dur()]; const c = clips(t).filter(([a]) => a < dur()); return c.length ? [c[0][0], Math.min(dur(), c[c.length - 1][1])] : [t.offset, t.offset]; }
  // the fade handles (white squares): where they are, in song seconds
  function fadeSpots(t) {
    const [a, b] = span(t), r = TFDaw.songRate();
    const len = (b - a) / r, fi = Math.min(t.fadeIn || 0, len), fo = Math.min(t.fadeOut || 0, Math.max(0, len - fi));
    return { a, b, fiAt: a + fi * r, foAt: b - fo * r, fi, fo, len };
  }
  function drawLanes() {
    const c = el('dw-lanes'); if (!c || !E.s) return;
    const { g, dpr, W, H } = sizeCanvas(c);
    g.clearRect(0, 0, W, H);
    const v = view(), tops = laneTops();
    if (beatLen()) { const bar = beatLen() * 4, f = firstBeat(); let every = 1; while (bar * every * v.pps < 22) every *= 2; for (let k = Math.max(0, Math.floor((v.t0 - f) / bar)); f + k * bar <= v.t0 + v.span; k += every) { g.fillStyle = 'rgba(255,255,255,.045)'; g.fillRect(xAt(f + k * bar) * dpr, 0, 1, H); } }
    if (E.sel) { g.fillStyle = E.loopOn ? 'rgba(63,224,160,.07)' : 'rgba(255,138,61,.05)'; g.fillRect(xAt(E.sel.a) * dpr, 0, (xAt(E.sel.b) - xAt(E.sel.a)) * dpr, H); }
    const played = songTime();
    E.tracks.forEach((t, i) => {
      const top = tops[i] * dpr, h = (t.kind === 'song' ? SONG_H : LAYER_H) * dpr;
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, top + h - dpr, W, dpr);
      const segs = t.kind === 'song' ? [[0, dur()]] : clips(t);
      const quiet = t.mute || (E.tracks.some((x) => x.solo && !x.mute) && !t.solo);
      const col = t.color;
      for (const [a, b] of segs) {
        const x1 = xAt(a) * dpr, x2 = xAt(b) * dpr;
        if (x2 < 0 || x1 > W) continue;
        const y = top + 4 * dpr, hh = h - 8 * dpr;
        g.fillStyle = quiet ? 'rgba(255,255,255,.035)' : `${col}2e`; roundRect(g, x1 + dpr, y, x2 - x1 - 2 * dpr, hh, 6 * dpr); g.fill();
        g.strokeStyle = quiet ? 'rgba(255,255,255,.15)' : col; g.lineWidth = dpr; roundRect(g, x1 + 1.5 * dpr, y + 0.5 * dpr, x2 - x1 - 3 * dpr, hh - dpr, 6 * dpr); g.stroke();
        g.fillStyle = quiet ? 'rgba(255,255,255,.4)' : col; g.font = `bold ${10.5 * dpr}px system-ui`;
        g.fillText(`${t.name}${quiet ? '  (muted)' : ''}`, Math.max(x1, 0) + 7 * dpr, y + 12 * dpr);
        // the wave
        const p = t.peaks || [], n = p.length, mid = y + 15 * dpr + (hh - 17 * dpr) / 2, amp = (hh - 21 * dpr) / 2;
        const own = (u) => (t.kind === 'song' ? u : t.from + ((u - a) / TFDaw.songRate()) * ((t.playUrl && t.stretch) || 1));
        const len = t.kind === 'song' ? dur() : t.duration || 1;
        for (let x = Math.max(0, Math.floor(x1 + 2 * dpr)); x < Math.min(W, x2 - 2 * dpr); x++) {
          const tt = v.t0 + (x / dpr) / v.pps, tt2 = v.t0 + ((x + 1) / dpr) / v.pps;
          const i1 = Math.floor((own(tt) / len) * n), i2 = Math.max(i1 + 1, Math.floor((own(tt2) / len) * n));
          let m = 0; for (let k = Math.max(0, i1); k < Math.min(n, i2); k++) if (p[k] > m) m = p[k];
          g.fillStyle = quiet ? 'rgba(255,255,255,.2)' : t.kind === 'song' && tt > played ? `${col}99` : col;
          g.fillRect(x, mid - m * amp, 1, Math.max(dpr, m * amp * 2));
        }
      }
      // fades: the dimmed part + the curve + the white squares you can drag
      const f = fadeSpots(t);
      const y0 = top + 4 * dpr, y1 = top + h - 4 * dpr;
      const curve = (from, to, out) => {
        const xa = xAt(from) * dpr, xb = xAt(to) * dpr;
        if (xb - xa < 1) return;
        g.beginPath(); g.moveTo(xa, y0);
        for (let k = 0; k <= 40; k++) { const q = k / 40, gain = TFFxMath.fadeGain(t.fadeShape, out ? 1 - q : q); g.lineTo(xa + (xb - xa) * q, y1 - gain * (y1 - y0)); }
        g.lineTo(xb, y0); g.closePath(); g.fillStyle = 'rgba(11,13,17,.62)'; g.fill();
        g.beginPath(); for (let k = 0; k <= 40; k++) { const q = k / 40, gain = TFFxMath.fadeGain(t.fadeShape, out ? 1 - q : q); g[k ? 'lineTo' : 'moveTo'](xa + (xb - xa) * q, y1 - gain * (y1 - y0)); }
        g.strokeStyle = '#fff'; g.lineWidth = 1.5 * dpr; g.stroke();
      };
      if (f.fi > 0) curve(f.a, f.fiAt, false);
      if (f.fo > 0) curve(f.foAt, f.b, true);
      if (t.id === E.selTrack && !E.preview) for (const at of [f.fiAt, f.foAt]) { const x = xAt(at) * dpr; g.fillStyle = '#fff'; g.fillRect(x - 4.5 * dpr, y0 + 1 * dpr, 9 * dpr, 9 * dpr); g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(x - 4.5 * dpr, y0 + 1 * dpr, 9 * dpr, 9 * dpr); }
      if (t.kind === 'song' && !E.preview) TFEditTabs.overlay(g, { dpr, Wd: W, Hd: top + h, ruler: top, xAt, view: v, duration: dur(), tab: E.panel });
    });
    g.setLineDash([2 * dpr, 4 * dpr]); g.lineWidth = dpr;
    for (const m of E.marks) { const x = xAt(m.t) * dpr; if (x < 0 || x > W) continue; g.strokeStyle = `${E.markA === m.id || E.markB === m.id ? '#3fe0a0' : m.color}66`; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    g.setLineDash([]);
    if (E.sel) { g.fillStyle = E.loopOn ? '#3fe0a0' : '#ff8a3d'; for (const tt of [E.sel.a, E.sel.b]) g.fillRect(xAt(tt) * dpr - dpr / 2, 0, 1.5 * dpr, H); }
    const px = xAt(songTime()) * dpr; g.fillStyle = '#ff5d6c'; g.fillRect(px - dpr / 2, 0, 1.5 * dpr, H);
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, Math.max(0, w), Math.max(0, h), r); else g.rect(x, y, Math.max(0, w), Math.max(0, h)); }
  function drawBar() {
    if (!E.s) return;
    const now = TFDaw.time(); // a preview shows its own time
    const set = (id, v) => { const x = el(id); if (x && x.textContent !== v) x.textContent = v; };
    set('dw-time', fmt(now));
    set('dw-bars', E.preview ? '–' : barBeat(now));
    set('dw-bpm', E.beats && E.beats.bpm ? E.beats.bpm.toFixed(1) : '–');
    set('dw-selt', E.sel ? `${fmt(E.sel.a)} – ${fmt(E.sel.b)} · ${(E.sel.b - E.sel.a).toFixed(1)} s` : 'nothing yet');
    const p = el('dw-play'); if (p) { const playing = TFDaw.playing; if (p.dataset.on !== String(playing)) { p.dataset.on = String(playing); p.innerHTML = playing ? ICONS.pause : ICONS.play; } }
    for (const id of ['dw-cut', 'dw-keep']) { const b = el(id); if (b) b.disabled = !E.sel; }
    const lp = el('dw-loop'); if (lp) { lp.disabled = !E.sel; lp.classList.toggle('on', E.loopOn && !!E.sel); }
    const sm = el('dw-smart'); if (sm) sm.disabled = !E.sel;
    set('dw-zoom', `${Math.round(E.zoom * 100)}%`);
  }
  const meterTmp = {};
  function drawMeters() {
    const m = TFDaw.meters();
    const put = (id, key, v) => { const bar = el(id); if (!bar) return; meterTmp[id] = Math.max(Math.min(1, v || 0), (meterTmp[id] || 0) * 0.9); bar.style.setProperty('--lv', `${Math.round(meterTmp[id] * 100)}%`); };
    for (const t of E.tracks) { put(`dw-m-${t.id}`, t.id, m[t.id]); put(`dw-mm-${t.id}`, t.id, m[t.id]); }
    put('dw-mm-master', 'master', m.master);
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
      e.preventDefault();
      if (T.id !== E.selTrack) selectTrack(T.id);
      // the fade squares (top corners of the selected track)
      const top = laneTops()[E.tracks.indexOf(T)], f = fadeSpots(T);
      if (y - top < 18) {
        if (Math.abs(xAt(f.fiAt) - x) < 8) { down = { fade: T, which: 'in' }; return; }
        if (Math.abs(xAt(f.foAt) - x) < 8) { down = { fade: T, which: 'out' }; return; }
      }
      // Split cuts (song lane)
      const own = T.kind === 'song' && TFEditTabs.mouseDown({ x, t, xAt, e, tab: E.panel });
      if (own) { down = { own }; return; }
      // Move tool: drag a track's sound
      if (E.tool === 'move' && T.kind === 'layer') { down = { layer: T, x0: e.clientX, off0: T.offset }; return; }
      const near = (tt) => Math.abs(xAt(tt) - x) < 6;
      if (E.sel && near(E.sel.a)) down = { edge: 'a' };
      else if (E.sel && near(E.sel.b)) down = { edge: 'b' };
      else if (e.shiftKey && E.sel) { down = { edge: t < E.sel.a ? 'a' : 'b' }; E.sel[down.edge] = snap(t); }
      else down = { start: snap(t), x, moved: false };
    });
    ruler.addEventListener('mousedown', (e) => {
      if (!E.s || e.button !== 0 || E.preview) return;
      const { x, y } = pos(e, ruler);
      e.preventDefault();
      if (y >= 31) { // the marks row: drag a mark, or click to put a new one
        const m = [...E.marks].reverse().find((k) => Math.abs(xAt(k.t) - x) < 7 || (x >= xAt(k.t) && x <= xAt(k.t) + 70 && y >= 36));
        down = m ? { mark: m, x, moved: false } : { newMark: true, x };
        return;
      }
      down = { start: snap(timeAt(x)), x, moved: false, ruler: true };
    });
    ruler.addEventListener('dblclick', (e) => { const { x } = pos(e, ruler); const m = E.marks.find((k) => x >= xAt(k.t) - 8 && x <= xAt(k.t) + 60); if (m) { const inp = document.querySelector(`.dw-mk[data-id="${m.id}"] .dw-mname`); if (inp) { inp.focus(); inp.select(); } } });
    over.addEventListener('mousedown', (e) => { if (!E.s) return; down = { over: true }; moveOver(e); e.preventDefault(); });
    const moveOver = (e) => { const r = over.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * dur(); E.scroll = t - view().span / 2; clampScroll(); drawAll(); };
    window.addEventListener('mousemove', (e) => {
      if (!down || !E.s || !lanes.isConnected) return;
      if (down.over) { moveOver(e); return; }
      const { x } = pos(e, down.ruler || down.mark || down.newMark ? ruler : lanes), t = timeAt(x);
      if (down.newMark) return;
      if (down.mark) { if (Math.abs(x - down.x) > 3) down.moved = true; if (down.moved) { down.mark.t = +snap(t).toFixed(3); syncAB(false); } return; }
      if (down.fade) {
        const T = down.fade, f = fadeSpots(T), r = TFDaw.songRate();
        if (down.which === 'in') T.fadeIn = +Math.max(0, Math.min(f.len - (T.fadeOut || 0), (t - f.a) / r)).toFixed(2);
        else T.fadeOut = +Math.max(0, Math.min(f.len - (T.fadeIn || 0), (f.b - t) / r)).toFixed(2);
        drawLanes(); return;
      }
      if (down.own) { down.own.move(t); drawAll(); return; }
      if (down.layer) { down.layer.offset = +Math.max(0, snap(down.off0 + (e.clientX - down.x0) / view().pps)).toFixed(3); drawLanes(); return; }
      if (down.edge) { E.sel[down.edge] = snap(t); if (E.sel.a > E.sel.b) { [E.sel.a, E.sel.b] = [E.sel.b, E.sel.a]; down.edge = down.edge === 'a' ? 'b' : 'a'; } E.markA = E.markB = null; }
      else if (Math.abs(x - down.x) > 3) { down.moved = true; const s2 = snap(t); E.sel = { a: Math.min(down.start, s2), b: Math.max(down.start, s2) }; E.markA = E.markB = null; }
      drawAll(); drawBar();
    }, { signal });
    window.addEventListener('mouseup', () => {
      if (!down) return;
      const d = down; down = null;
      if (d.over) return;
      if (d.newMark) { addMark(timeAt(d.x)); return; }
      if (d.mark) { if (!d.moved) seek(d.mark.t); E.marks.sort((a, b) => a.t - b.t); renderBrowser(); drawAll(); return; }
      if (d.fade) { restart(); if (E.panel === 'sound') renderPanel(); return; }
      if (d.own) { if (d.own.up) d.own.up(); drawAll(); return; }
      if (d.layer) { layerChanged(d.layer, false); renderPanel(); return; }
      if (!d.edge && !d.moved) { seek(d.start); if (!d.ruler) { if (E.sel) { E.sel = null; E.markA = E.markB = null; } } } // a click: jump there
      if (E.sel && E.sel.b - E.sel.a < 0.01) E.sel = null;
      TFEditTabs.refresh(E.panel);
      renderBrowser(); drawAll(); drawBar();
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
  const ib = (icon, onclick, { label, cls = '', title = '', id, disabled = false } = {}) => h('button', { class: `dw-b ${cls}`, title, id, disabled, onclick }, TFIcon(icon), label !== undefined ? h('span', { class: 'dw-bt', id: id ? `${id}-t` : undefined }, label) : null);
  const lab = (node, text) => h('div', { class: 'dw-lbl' }, node, h('span', {}, text));
  const sep = () => h('span', { class: 'dw-sep' });
  const lcd = (label, id, cls = '') => h('div', { class: `dw-lcd ${cls}` }, h('small', {}, label), h('div', { id, class: 'mono' }));
  const iconFor = (t) => (t.kind === 'song' ? 'music' : t.src && t.src.kind === 'sound' ? 'rain' : t.src && t.src.kind === 'rec' ? 'user' : 'music');
  const panText = (p) => (+p ? (p < 0 ? `Left ${-p}` : `Right ${p}`) : 'Middle');
  const semis = (p) => { const s = 12 * Math.log2((p || 100) / 100); return `${s >= 0 ? '+' : ''}${s.toFixed(1)}`; };
  const TABS = [['sound', 'Sound', 'sound'], ['effects', 'Effects', 'fx'], ['mixer', 'Mixer', 'mixer'], ['trim', 'Trim', 'trim'], ['split', 'Split', 'split'], ['loop', 'Loop', 'loop'], ['connect', 'Connect', 'link']];
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
        h('p', {}, 'Right-click a song in the Library → Edit…, or open one here. Put marks on it, make perfect loops, cut and keep parts, trim silence, split a long file, change speed, pitch and fades, add live effects, put sounds or your voice on top, and save in 3 ways.'),
        h('div', { class: 'ed-empty-btns' }, h('button', { class: 'tb pri', onclick: pick }, 'Open a song…'),
          h('button', { class: 'tb', onclick: () => window.TFBatch.pickMany(), title: 'The same Trim and / or Effects on many songs, each saved separately' }, 'Edit many songs at once…')),
        h('div', { id: 'ed-busy', class: 'ed-busy', hidden: !E.busy }, E.busy ? 'Opening…' : '')));
      return;
    }
    const mode = h('select', { class: 'dw-mode', title: 'How to save' }, ...[['both', 'Keep both'], ['newname', 'New takes the name'], ['replace', 'Replace the original']].map(([v, l]) => h('option', { value: v, selected: E.mode === v }, l)));
    mode.addEventListener('change', () => { E.mode = mode.value; });
    const transport = h('div', { class: 'dw-bar dw-transport' },
      ib('start', () => seek(0), { title: 'To the start (Home)' }), ib('back', () => seek(TFDaw.time() - 5), { title: 'Back 5 s (←)' }),
      h('button', { class: 'dw-b on dw-play', id: 'dw-play', title: 'Play / pause (Space)', onclick: playPause, html: TFDaw.playing ? ICONS.pause : ICONS.play }),
      ib('stop', stopButton, { title: 'Stop: back to where you pressed Play' }), ib('fwd', () => seek(TFDaw.time() + 5), { title: 'Forward 5 s (→)' }),
      ib('loop', () => { E.loopOn = !E.loopOn; drawAll(); drawBar(); }, { label: 'Loop A–B', cls: 't dw-loop', id: 'dw-loop', title: 'Play the part between A and B over and over (L)' }),
      ib('mic', toggleRecord, { label: E.rec ? 'Stop' : 'Rec', cls: `r dw-recbtn${E.rec ? ' on' : ''}`, id: 'dw-rec', title: 'Record your voice on a new track while everything plays' }),
      sep(), lcd('TIME', 'dw-time', 'big'), lcd('BAR | BEAT', 'dw-bars'), lcd('TEMPO', 'dw-bpm'), sep(),
      lab(ib('select', () => { E.tool = 'select'; render(); }, { cls: E.tool === 'select' ? 'on' : '', title: 'Drag across the tracks to select a part; click to jump there' }), 'SELECT'),
      lab(ib('cut', cut, { id: 'dw-cut', title: 'Remove the selected part of the song (Delete)' }), 'CUT'),
      lab(ib('keep', keep, { id: 'dw-keep', title: 'Keep only the selected part of the song' }), 'KEEP'),
      lab(ib('move', () => { E.tool = 'move'; render(); }, { cls: E.tool === 'move' ? 'on' : '', title: 'Drag an added track left or right' }), 'MOVE'),
      sep(),
      lab(ib('magnet', () => { E.snap = { off: 'beat', beat: 'bar', bar: 'off' }[E.snap]; render(); }, { label: { off: 'Off', beat: 'Beat', bar: 'Bar' }[E.snap], cls: E.snap !== 'off' ? 'on2' : '', title: 'Snap: selections, marks and moved tracks land on the beat / the bar (click to change)' }), 'SNAP'),
      lab(ib('flag', () => addMark(songTime()), { label: 'M', title: 'Put a mark where the song is now (M)' }), 'MARK'),
      h('span', { class: 'grow' }), h('span', { class: 'dw-status', id: 'dw-status', hidden: true }),
      ib('undo', undo, { disabled: !E.s.canUndo, title: 'Undo (Ctrl+Z)' }), ib('redo', redo, { disabled: !E.s.canRedo, title: 'Redo (Ctrl+Y)' }),
      ib('zout', () => zoomTo(E.zoom / 1.5), { title: 'Zoom out' }), h('span', { class: 'dw-zoom mono', id: 'dw-zoom' }), ib('zin', () => zoomTo(E.zoom * 1.5), { title: 'Zoom in (Ctrl + mouse wheel too)' }),
      ib('follow', () => { E.follow = !E.follow; render(); }, { cls: E.follow ? 'on2' : '', title: E.follow ? 'Follow is on: the view moves with the playhead (click to stop)' : 'Follow is off: the view stays where you put it (click to follow the playhead)' }),
      ib('folder', pick, { title: 'Edit another song' }), ib('x', closeSong, { label: 'Close', id: 'dw-close', title: 'Close this song: the Edit page becomes empty (your file is not touched)' }), mode,
      ib('save', save, { label: 'Save', cls: 'on', title: 'Save the edited song (with everything you hear) next to the original file' }));
    const lanesH = E.tracks.reduce((s, x) => s + (x.kind === 'song' ? SONG_H : LAYER_H), 0);
    const arr = h('div', { class: 'dw-arr' },
      h('div', { class: 'dw-corner' }, h('span', { class: 'dw-hint' }, 'Overview')), h('canvas', { id: 'dw-over', class: 'dw-over', title: 'The whole song: click or drag to look at another part' }),
      h('div', { class: 'dw-corner dw-rh3' }, h('span', {}, 'Time'), h('span', {}, 'Bars'), h('span', {}, 'Marks · click to add')), h('canvas', { id: 'dw-ruler', class: 'dw-ruler', title: 'Top: click to jump, drag to select · Bottom row: click to put a mark, drag a mark to move it, double-click to rename' }),
      h('div', { class: 'dw-scroll', id: 'dw-scroll' },
        h('div', { class: 'dw-rows', style: { height: `${lanesH}px` } }, h('div', { class: 'dw-heads', id: 'dw-heads' }), h('canvas', { id: 'dw-lanes', class: `dw-lanes tool-${E.tool}`, style: { height: `${lanesH}px` } }))),
      h('div', { id: 'ed-busy', class: 'ed-busy', hidden: !E.busy }));
    const bot = h('div', { class: 'dw-bot' },
      h('div', { class: 'dw-btabs' }, ...TABS.map(([k, l, i]) => ib(i, () => { if (E.preview) stopPreview(); E.panel = k; render(); }, { label: l, cls: E.panel === k ? 'on' : '' }))),
      h('div', { class: 'dw-panel', id: 'dw-panel' }));
    root.append(...[transport, h('div', { class: 'dw-mid' }, h('div', { class: 'dw-browser', id: 'dw-browser' }), arr),
      E.preview ? h('div', { class: 'ed-preview' }, TFIcon('headphones'), h('b', {}, E.preview.label), h('span', {}, 'You are hearing how it would sound. Nothing is changed yet.'), h('span', { class: 'grow' }), h('button', { class: 'tb', onclick: stopPreview }, 'Stop preview')) : null,
      bot].filter(Boolean));
    renderHeads(); renderBrowser(); renderPanel(); status();
    wire();
    requestAnimationFrame(() => { clampScroll(); drawAll(); drawBar(); });
  }
  function selectTrack(id) { E.selTrack = id; renderHeads(); if (['sound', 'effects', 'mixer'].includes(E.panel)) renderPanel(); drawLanes(); }
  function renderHeads() { const box = el('dw-heads'); if (!box) return; box.innerHTML = ''; for (const T of E.tracks) box.append(header(T)); }
  function renderPanel() { const p = el('dw-panel'); if (!p) return; p.innerHTML = ''; p.append(E.panel === 'sound' ? soundPanel() : E.panel === 'effects' ? fxPanel() : E.panel === 'mixer' ? mixerPanel() : TFEditTabs.panel(E.panel)); }
  const infoText = (T) => {
    const n = Object.keys(fxOf(T)).length;
    return [`Speed ${+T.speed.toFixed(1)}%`, `Pitch ${semis(T.pitch)}`, n ? `${n} effect${n === 1 ? '' : 's'}` : '', fadeOn(T) ? 'fades' : '', T.making ? 'making…' : ''].filter(Boolean).join(' · ');
  };
  function header(T) {
    const isSong = T.kind === 'song';
    const [vlo, vhi] = (S.limits && S.limits.volume) || [0, 400];
    const vol = filled(h('input', { type: 'range', min: vlo, max: Math.min(vhi, 400), value: T.volume, title: `Volume ${T.volume}%`, style: { '--c': T.color } }));
    vol.addEventListener('input', () => { T.volume = +vol.value; vol.title = `Volume ${T.volume}%`; TFDaw.apply(T); if (E.selTrack === T.id && E.panel !== 'effects') renderPanel(); });
    const tg = (k, label, title, cls) => h('button', { class: `dw-ms ${cls}${T[k] ? ' on' : ''}`, title, onclick: (e) => { e.stopPropagation(); T[k] = !T[k]; for (const x of E.tracks) TFDaw.apply(x); renderHeads(); drawLanes(); if (E.panel === 'mixer') renderPanel(); } }, label);
    return h('div', { class: `dw-head${T.id === E.selTrack ? ' sel' : ''}`, style: { height: `${isSong ? SONG_H : LAYER_H}px`, '--c': T.color }, onclick: () => selectTrack(T.id) },
      h('div', { class: 'dw-hn' }, TFIcon(iconFor(T)), h('span', { class: 'dw-hname', title: T.name }, T.name),
        isSong ? null : h('button', { class: 'dw-x', title: 'Remove this track', onclick: (e) => { e.stopPropagation(); removeLayer(T); } }, TFIcon('x'))),
      h('div', { class: 'dw-hrow' }, tg('mute', 'M', 'Mute', 'm'), tg('solo', 'S', 'Solo: only solo tracks are heard', 's'), vol),
      h('div', { class: 'dw-hmeter', id: `dw-m-${T.id}` }),
      h('div', { class: 'dw-hinfo' }, infoText(T)));
  }
  // left column: your marks, Smart loop, add a track
  function renderBrowser() {
    const box = el('dw-browser'); if (!box || !E.s) return;
    box.innerHTML = '';
    box.append(h('div', { class: 'dw-bh' }, TFIcon('flag'), 'MARKS', h('span', { class: 'grow' }), h('span', { class: 'dw-hint' }, 'press M')));
    if (!E.marks.length) box.append(h('p', { class: 'dw-hint dw-help' }, 'Press M while the song plays, or click the bottom row of the ruler, to put a mark. Then press A and B on two marks to choose the part to loop.'));
    for (const m of E.marks) {
      const name = h('input', { class: 'dw-mname', value: m.name, spellcheck: 'false', title: 'Type a name for this mark' });
      name.addEventListener('change', () => { m.name = name.value.trim() || m.name; name.value = m.name; drawAll(); });
      box.append(h('div', { class: 'dw-mk', style: { '--c': m.color }, 'data-id': m.id }, h('i'), name,
        h('button', { class: 'dw-mt mono', title: 'Jump here', onclick: () => seek(m.t) }, fmt(m.t)),
        h('button', { class: `dw-ab${E.markA === m.id ? ' on' : ''}`, title: 'The start of the part (A)', onclick: () => setAB('a', m) }, 'A'),
        h('button', { class: `dw-ab${E.markB === m.id ? ' on' : ''}`, title: 'The end of the part (B)', onclick: () => setAB('b', m) }, 'B'),
        h('button', { class: 'dw-x', title: 'Remove this mark', onclick: () => removeMark(m) }, TFIcon('x'))));
    }
    box.append(h('div', { class: 'dw-selrow' }, h('span', { class: 'dw-hint' }, 'Part: '), h('b', { id: 'dw-selt', class: 'mono' })));
    box.append(h('button', { class: 'dw-b t dw-smart', id: 'dw-smart', disabled: !E.sel, onclick: smartLoop, title: 'Move A and B a tiny bit so the end flows into the start without a bump' }, TFIcon('spark'), h('span', {}, 'Smart loop')));
    box.append(h('div', { class: 'dw-bh' }, TFIcon('plus'), 'ADD A TRACK'),
      h('div', { class: 'dw-add' },
        ib('music', () => TFEditTabs.pickSong('Add a song on a new track', (x) => addLayer({ kind: 'track', id: x.id })), { label: 'Song track', title: 'Another song from your library on top' }),
        ib('rain', () => TFEditTabs.pickSound((key) => addLayer({ kind: 'sound', key }, { volume: 35, repeat: 0 })), { label: 'Built-in sound', title: 'Rain, ocean, vinyl crackle, wind, campfire, a beat' }),
        ib('mic', toggleRecord, { label: E.rec ? 'Stop recording' : 'Record voice', title: 'Record your voice on a new track while everything plays' })));
    drawBar();
  }
  // ---------- bottom panel: Sound + Fades (+ the track's part) of the selected track ----------
  const clampV = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // the coloured part of a slider (the app's sliders read --pct)
  function filled(r) { const f = () => r.style.setProperty('--pct', `${((+r.value - +r.min) / ((+r.max - +r.min) || 1)) * 100}%`); f(); r.addEventListener('input', f); return r; }
  function control(T, { key, label, color, lo, hi, steps, unit, dec, def, note, onSet }) {
    const shown = (v) => (unit === 's' ? `${(+v).toFixed(2)} s` : `${+(+v).toFixed(dec)} %`);
    const range = h('input', { type: 'range', min: lo, max: hi, step: unit === 's' ? 0.01 : 0.1, value: T[key], style: { '--c': color } });
    const val = h('input', { class: 'dw-val mono', value: shown(T[key]), spellcheck: 'false', title: 'Type an exact value and press Enter' });
    const noteEl = note ? h('span', { class: 'dw-cnote' }, note(T[key])) : null;
    const fill = () => range.style.setProperty('--pct', `${((T[key] - lo) / (hi - lo || 1)) * 100}%`);
    const set = (v) => { v = +clampV(+(+v).toFixed(dec), lo, hi); T[key] = v; range.value = v; val.value = shown(v); fill(); if (noteEl) noteEl.textContent = note(v); onSet(v); };
    range.addEventListener('input', () => set(+range.value));
    val.addEventListener('change', () => { const v = parseFloat(val.value.replace(',', '.')); if (Number.isFinite(v)) set(v); else val.value = shown(T[key]); });
    val.addEventListener('keydown', (e) => { if (e.key === 'Enter') val.blur(); });
    fill();
    const sb = (txt, d) => h('button', { class: 'dw-st', title: d === null ? 'Back to normal' : `${txt}`, onclick: () => set(d === null ? def : T[key] + d), html: d === null ? ICONS.reset : undefined }, d === null ? null : txt);
    const fmtS = (s) => (unit === 's' ? String(s) : String(s));
    return h('div', { class: 'dw-ctl' },
      h('b', {}, label, noteEl), range, val,
      h('div', { class: 'dw-steps' }, ...steps.map((s) => sb(`−${fmtS(s)}`, -s)), sb('', null), ...[...steps].reverse().map((s) => sb(`+${fmtS(s)}`, s))));
  }
  let fadeTimer = null;
  function soundPanel() {
    const T = selT();
    const lim = (k, d) => (S.limits && S.limits[k]) || d;
    const [slo, shi] = lim('speed', [25, 400]), [plo, phi] = lim('pitch', [50, 200]), [vlo, vhi] = lim('volume', [0, 400]);
    const heads = () => { renderHeads(); drawLanes(); };
    const nat = h('button', { class: `fx-switch${T.natural ? ' on' : ''}`, role: 'switch', title: 'On: singers keep a human voice. Off: the classic chipmunk (higher) or deep (lower) voice.', onclick: () => { T.natural = !T.natural; nat.classList.toggle('on', T.natural); soundChanged(T); } }, h('span', { class: 'knob' }), 'Natural voice');
    const sound = h('div', { class: 'dw-sec dw-sound' },
      h('div', { class: 'dw-sh' }, TFIcon('sound'), 'SOUND', h('span', { class: 'dw-tr' }, `· ${T.name}`), h('span', { class: 'grow' }), nat,
        h('button', { class: 'dw-b dw-small', title: 'Speed, pitch and volume back to normal', onclick: () => { Object.assign(T, { speed: 100, pitch: 100, natural: true, volume: 100 }); TFDaw.apply(T); soundChanged(T); renderPanel(); } }, h('span', {}, 'Reset all'))),
      control(T, { key: 'speed', label: 'Speed', color: '#7aa8ff', lo: slo, hi: shi, steps: [25, 5, 1], unit: '%', dec: 1, def: 100, onSet: () => soundChanged(T) }),
      control(T, { key: 'pitch', label: 'Pitch', color: '#c59bff', lo: plo, hi: phi, steps: [25, 5, 1], unit: '%', dec: 1, def: 100, note: (v) => ` ${semis(v)} semitones`, onSet: () => soundChanged(T) }),
      control(T, { key: 'volume', label: 'Volume', color: '#3fe0a0', lo: vlo, hi: Math.min(vhi, 400), steps: [25, 5, 1], unit: '%', dec: 1, def: 100, onSet: () => { TFDaw.apply(T); heads(); } }));
    const len = fadeSpots(T).len || 1;
    const fadeSet = () => { clearTimeout(fadeTimer); fadeTimer = setTimeout(restart, 200); heads(); };
    const preview = h('canvas', { class: 'dw-curve' });
    const shapes = h('div', { class: 'dw-shapes' }, ...[['lin', 'Straight'], ['smooth', 'Smooth'], ['slow', 'Slow start']].map(([k, l]) => h('button', { class: T.fadeShape === k ? 'on' : '', onclick: () => { T.fadeShape = k; fadeSet(); renderPanel(); } }, l)));
    const fades = h('div', { class: 'dw-sec dw-fades' },
      h('div', { class: 'dw-sh' }, TFIcon('fade'), 'FADES', h('span', { class: 'dw-tr' }, `· ${T.name}`)),
      control(T, { key: 'fadeIn', label: 'Fade in', color: '#ffd36b', lo: 0, hi: +Math.min(120, len).toFixed(2), steps: [1, 0.5, 0.1], unit: 's', dec: 2, def: 0, onSet: () => { fadeSet(); drawCurve(); } }),
      control(T, { key: 'fadeOut', label: 'Fade out', color: '#ff8a3d', lo: 0, hi: +Math.min(120, len).toFixed(2), steps: [1, 0.5, 0.1], unit: 's', dec: 2, def: 0, onSet: () => { fadeSet(); drawCurve(); } }),
      shapes, preview);
    function drawCurve() {
      requestAnimationFrame(() => {
        const { g, dpr, W, H } = sizeCanvas(preview);
        g.clearRect(0, 0, W, H);
        const fi = Math.min(T.fadeIn, len), fo = Math.min(T.fadeOut, len - fi), x = (s) => (s / len) * W;
        g.beginPath();
        for (let k = 0; k <= 120; k++) {
          const s = (k / 120) * len;
          const gain = s < fi ? TFFxMath.fadeGain(T.fadeShape, s / fi) : s > len - fo ? TFFxMath.fadeGain(T.fadeShape, (len - s) / fo) : 1;
          g[k ? 'lineTo' : 'moveTo'](x(s), H - 3 * dpr - gain * (H - 8 * dpr));
        }
        g.strokeStyle = '#ffb27a'; g.lineWidth = 2 * dpr; g.stroke();
        g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fillStyle = 'rgba(255,138,61,.12)'; g.fill();
      });
    }
    drawCurve();
    const pan = filled(h('input', { type: 'range', min: -100, max: 100, value: T.pan, style: { '--c': '#7aa8ff' } }));
    const panT = h('span', { class: 'dw-cnote' }, ` ${panText(T.pan)}`);
    pan.addEventListener('input', () => { T.pan = +pan.value; panT.textContent = ` ${panText(T.pan)}`; TFDaw.apply(T); });
    pan.addEventListener('dblclick', () => { T.pan = 0; pan.value = 0; panT.textContent = ' Middle'; TFDaw.apply(T); });
    const trackSec = h('div', { class: 'dw-sec dw-trk' }, h('div', { class: 'dw-sh' }, TFIcon('part'), 'TRACK'),
      h('div', { class: 'dw-row2' }, h('b', {}, 'Left ⟷ Right', panT)), pan);
    if (T.kind === 'layer') {
      const n = (v, setv, max, title) => { const i = h('input', { class: 'dw-val mono', value: (+v).toFixed(2), title }); i.addEventListener('change', () => { const x = parseFloat(i.value); if (Number.isFinite(x)) setv(clampV(x, 0, max)); }); return i; };
      const rep = h('select', { class: 'dw-sel' }, ...[[1, '1×'], [2, '2×'], [4, '4×'], [8, '8×'], [0, 'Until the end']].map(([v, l]) => h('option', { value: v, selected: T.repeat === v }, l)));
      rep.addEventListener('change', () => { T.repeat = +rep.value; layerChanged(T, false); });
      trackSec.append(
        h('div', { class: 'dw-row2' }, h('span', { class: 'dw-hint' }, 'Use'), n(T.from, (v) => { T.from = Math.min(v, T.to - 0.05); layerChanged(T, false); renderPanel(); }, T.duration, 'From (seconds of this sound)'), '–', n(T.to, (v) => { T.to = Math.max(v, T.from + 0.05); layerChanged(T, false); renderPanel(); }, T.duration, 'To (seconds of this sound)')),
        h('div', { class: 'dw-row2' }, h('span', { class: 'dw-hint' }, 'Starts at'), n(T.offset, (v) => { T.offset = v; layerChanged(T, false); }, 36000, 'Starts at (song seconds)'), h('span', { class: 'dw-hint' }, 'Repeat'), rep),
        h('div', { class: 'dw-row2' },
          h('button', { class: `dw-chip${T.matchBeat ? ' on' : ''}`, title: 'Speed this track up or down so its beat matches the song (pitch stays)', onclick: () => setMatchBeat(T, !T.matchBeat) }, h('i'), 'Match beat'),
          h('button', { class: `dw-chip${T.duck ? ' on' : ''}`, title: 'The song gets quieter while this track sounds (good for talking)', onclick: () => { T.duck = !T.duck; layerChanged(T, false); renderPanel(); } }, h('i'), 'Auto-quiet')));
    } else trackSec.append(h('p', { class: 'dw-hint dw-help' }, 'Speed and Pitch are made in studio quality in the background (a moment); volume and fades change at once. Save keeps everything you hear.'));
    return h('div', { class: 'dw-secs' }, sound, fades, trackSec);
  }
  // ---------- bottom panel: Mixer (every track side by side) ----------
  function mixerPanel() {
    const strip = (T) => {
      const fader = h('input', { type: 'range', class: 'dw-vfader', min: 0, max: 200, value: Math.min(200, T.volume), title: `Volume ${T.volume}%`, style: { '--c': T.color } });
      const fill = () => fader.style.setProperty('--pct', `${(Math.min(200, T.volume) / 200) * 100}%`);
      fill();
      fader.addEventListener('input', () => { T.volume = +fader.value; fader.title = `Volume ${T.volume}%`; val.textContent = `${T.volume}%`; fill(); TFDaw.apply(T); renderHeads(); });
      const val = h('span', { class: 'mono dw-mv' }, `${T.volume}%`);
      const pan = filled(h('input', { type: 'range', class: 'dw-mpan', min: -100, max: 100, value: T.pan, title: panText(T.pan), style: { '--c': T.color } }));
      pan.addEventListener('input', () => { T.pan = +pan.value; pan.title = panText(T.pan); TFDaw.apply(T); });
      const tg = (k, l, cls) => h('button', { class: `dw-ms ${cls}${T[k] ? ' on' : ''}`, onclick: () => { T[k] = !T[k]; for (const x of E.tracks) TFDaw.apply(x); renderHeads(); renderPanel(); drawLanes(); } }, l);
      return h('div', { class: `dw-strip${T.id === E.selTrack ? ' sel' : ''}`, style: { '--c': T.color }, onclick: (e) => { if (e.target === e.currentTarget) selectTrack(T.id); } },
        h('b', { title: T.name }, T.name), pan, h('div', { class: 'dw-fwrap' }, fader, h('div', { class: 'dw-vm', id: `dw-mm-${T.id}` })), val, h('div', { class: 'dw-msrow' }, tg('mute', 'M', 'm'), tg('solo', 'S', 's')));
    };
    return h('div', { class: 'dw-mixer' }, ...E.tracks.map(strip),
      h('div', { class: 'dw-strip master', style: { '--c': '#d9dee8' } }, h('b', {}, 'MASTER'), h('span', { class: 'dw-hint' }, 'All tracks'), h('div', { class: 'dw-fwrap' }, h('div', { class: 'dw-vm big', id: 'dw-mm-master' })), h('span', { class: 'dw-hint' }, 'limiter on')));
  }

  // ---------- live effects (bottom panel) ----------
  const FX_NAMES = { echo: 'Echo', slowed: 'Slowed + reverb', nightcore: 'Nightcore', bass: 'Bass boost', eightd: '8D', oned: '1D' };
  const FX_TIPS = { echo: 'Repeats the sound, like in a big hall', slowed: 'Slower and lower, with a soft room', nightcore: 'Faster and higher', bass: 'Stronger low sounds', eightd: 'Moves around your head (headphones)', oned: 'Every speaker the same; nothing moves' };
  const lastStr = { echo: 40, slowed: 50, nightcore: 50, bass: 50, eightd: 50, oned: 100 };
  let fxTimer = null;
  function fxChanged(T, rerender = true) { clearTimeout(fxTimer); fxTimer = setTimeout(() => TFDaw.fxChanged(T), rerender ? 30 : 220); renderHeads(); if (rerender) renderPanel(); drawAll(); }
  function fxPanel() {
    const T = selT(), isSong = T.kind === 'song';
    const card = (k) => {
      const on = T.fx[k] !== undefined, rateFx = TFFxMath.RATE_FX.includes(k), blocked = rateFx && !isSong;
      const val = on ? T.fx[k] : lastStr[k];
      const knob = h('div', { class: 'dw-knob', style: { '--k': `${val * 0.75}%` }, title: blocked ? 'Only on the song track (it changes the speed)' : 'Drag up / down or use the mouse wheel', tabindex: 0 }, h('span', {}, on ? `${val}%` : 'off'));
      const setVal = (v) => { v = Math.max(0, Math.min(100, Math.round(v))); lastStr[k] = v; T.fx[k] = v; knob.style.setProperty('--k', `${v * 0.75}%`); knob.firstChild.textContent = `${v}%`; fxChanged(T, false); };
      if (!blocked) {
        knob.addEventListener('mousedown', (e) => {
          if (!on) { T.fx[k] = lastStr[k]; fxChanged(T); return; }
          const y0 = e.clientY, v0 = T.fx[k];
          const mv = (ev) => setVal(v0 + (y0 - ev.clientY) * 0.6);
          const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); renderPanel(); };
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
        h('span', { class: 'ed-note' }, 'Switch an effect on and turn its knob while the music plays: you hear it at once. Click a track to give it its own effects. Save keeps what you hear.'),
        h('span', { class: 'grow' }),
        h('button', { class: 'tb', onclick: () => { T.fx = {}; fxChanged(T); } }, 'All off'),
        h('button', { class: 'tb pri', title: 'Mix the tracks, effects, sound and fades into the song now (Undo brings the tracks back)', onclick: bake }, 'Apply to the song')),
      h('div', { class: 'dw-fxs' }, ...TFFxMath.ORDER.map(card)));
  }

  // ---------- keys on the Edit page ----------
  document.addEventListener('keydown', (e) => {
    if (S.view !== 'edit' || !E.s || document.querySelector('.modal-back')) return; // a window is open: the keys are for it
    const slider = e.target.matches && e.target.matches('input[type=range], button');
    if (e.target.closest('input, textarea, select') && !(slider && e.code === 'Space')) return; // typing; Space on a slider still plays
    const k = `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.code}`;
    const nothing = () => {}; // the Library player's keys do nothing here
    const run = {
      Space: playPause, Delete: cut, 'Ctrl+KeyZ': undo, 'Ctrl+KeyY': redo, 'Ctrl+Shift+KeyZ': redo, Home: () => seek(0), End: () => seek(dur()),
      ArrowLeft: () => seek(TFDaw.time() - 5), ArrowRight: () => seek(TFDaw.time() + 5), 'Ctrl+ArrowLeft': nothing, 'Ctrl+ArrowRight': nothing, ArrowUp: nothing, ArrowDown: nothing,
      KeyL: () => { if (E.sel) { E.loopOn = !E.loopOn; drawAll(); drawBar(); } }, KeyM: () => addMark(songTime()),
      Escape: () => { if (E.preview) stopPreview(); else { E.sel = null; E.loopOn = false; drawAll(); drawBar(); } },
    }[k];
    if (run) { e.preventDefault(); e.stopImmediatePropagation(); run(); }
  }, true);

  // leaving the page or playing in the main player: everything here goes quiet, the microphone too
  const stop = () => { stopRec(); E.tok++; TFDaw.pause(); if (E.preview) { TFDaw.forget(E.preview.url); E.preview = null; TFDaw.stopPreview(true); } drawBar(); };
  // a small stand-in for the old <audio> player, used by the panels (edittabs.js)
  const player = {
    get currentTime() { return songTime(); }, set currentTime(t) { seek(t); },
    get paused() { return !TFDaw.playing; }, play: () => playPause(), pause: () => { if (E.preview) stopPreview(); else TFDaw.pause(); drawBar(); },
  };
  const api = {
    get session() { return E.s; }, get sel() { return E.sel; }, set sel(v) { E.sel = v; drawAll(); drawBar(); },
    get previewing() { return !!E.preview; }, player, fmt, track,
    draw: () => { drawAll(); drawBar(); }, render, change, preview, stopPreview, busy, timeAt: (x) => timeAt(x),
    seek, xAt: (t) => xAt(t), view: () => view(), playRange, get tracks() { return E.tracks; }, get panel() { return E.panel; },
    smartLoop, get marks() { return E.marks; }, addMark, setAB, selectTrack,
  };
  return { open, render, pick, stop, api, closeSong, get session() { return E.s; } };
})();
