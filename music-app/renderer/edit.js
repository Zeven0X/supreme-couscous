'use strict';
/* global S, h, tf, guard, toast, coverEl, fmtTime, modal, confirmModal, upsertTrack, renderGrid, pause, ICONS, TFPlaylists, TFEditTabs */
// The Edit page (📏): one song at a time. A big waveform: drag to select a part, click to jump, Ctrl + wheel
// to zoom. Every change makes a new working copy (Undo / Redo); Save writes it next to the original file.
window.TFEdit = (() => {
  const E = { s: null, sel: null, zoom: 1, scroll: 0, busy: false, mode: 'both', tab: '', preview: null };
  const player = new Audio();
  player.preload = 'auto';
  const el = (id) => document.getElementById(id);
  const fmt = (t) => { const s = Math.max(0, t || 0); return `${fmtTime(s)}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`; };
  const track = () => (E.s ? S.byId.get(E.s.trackId) : null);

  // ---------- opening a song ----------
  async function open(trackId) {
    const t = S.byId.get(trackId);
    if (!t) return;
    if (E.s && E.s.trackId !== trackId && E.s.version > 0) {
      const ok = await confirmModal('Leave the song you are editing?', `"${(track() || {}).title}" has changes that are not saved. They will be lost.`, 'Leave without saving');
      if (!ok) return;
    }
    window.showView('edit');
    if (E.s) { tf.editClose(E.s.id).catch(() => {}); E.s = null; }
    E.sel = null; E.zoom = 1; E.scroll = 0;
    TFEditTabs.reset();
    busy(`Opening "${t.title}"…`);
    const st = await guard(() => tf.editOpen(trackId), 'Edit: ');
    busy(null);
    if (!st) { render(); return; }
    show({ ...st, trackId });
  }
  function show(st) {
    const keep = E.s ? E.s.trackId : st.trackId;
    E.preview = null;
    E.s = { ...st, trackId: st.trackId || keep };
    TFEditTabs.onVersion();
    const at = player.currentTime;
    player.src = st.url;
    player.currentTime = Math.min(at || 0, st.duration);
    if (E.sel && E.sel.b > st.duration) E.sel = null;
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

  // ---------- changes ----------
  function busy(msg) { E.busy = !!msg; const b = el('ed-busy'); if (b) { b.hidden = !msg; b.textContent = msg || ''; } }
  async function change(fn, msg) {
    if (!E.s || E.busy) return;
    player.pause();
    busy(msg);
    const st = await guard(fn, 'Edit: ');
    busy(null);
    if (st) show(st);
  }
  const cut = () => { if (!E.sel) return toast('Select a part first: drag across the waveform.'); const { a, b } = E.sel; E.sel = null; return change(() => tf.editApply(E.s.id, { type: 'cut', a, b }), 'Cutting…'); };
  const keep = () => { if (!E.sel) return toast('Select a part first: drag across the waveform.'); const { a, b } = E.sel; E.sel = null; return change(() => tf.editApply(E.s.id, { type: 'keep', a, b }), 'Keeping the selected part…'); };
  const undo = () => E.s && E.s.canUndo && change(() => tf.editUndo(E.s.id), 'Undo…');
  const redo = () => E.s && E.s.canRedo && change(() => tf.editRedo(E.s.id), 'Redo…');

  async function save() {
    const t = track();
    if (!E.s || !t || E.busy) return;
    if (E.s.version === 0) { toast('Nothing changed yet. Cut or keep a part first.'); return; }
    if (E.mode === 'replace') {
      const ok = await confirmModal(`Replace the original file of "${t.title}"?`,
        `The edited song is saved with the original's name, and the original file is moved to the Recycle Bin: ${t.srcPath}. You can get it back from the Recycle Bin.`, 'Replace the original');
      if (!ok) return;
    }
    player.pause();
    busy('Saving…');
    const r = await guard(() => tf.editSave(E.s.id, E.mode), 'Save: ');
    busy(null);
    if (!r) return;
    for (const x of [...r.changed, ...(r.added ? [r.added] : [])]) upsertTrack(x);
    renderGrid();
    TFPlaylists.render();
    toast(`Saved: ${r.dest}`, { type: 'ok', action: () => tf.showItem(r.dest), actionLabel: 'Show', ms: 8000 });
    // start again from the saved song, so further edits build on it
    const next = E.mode === 'both' && r.added ? r.added.id : E.s.trackId;
    tf.editClose(E.s.id).catch(() => {});
    E.s = null;
    open(next);
  }

  // ---------- previews: hear a change before making it ----------
  async function preview(op, { from = null, label = 'Preview' } = {}) {
    if (!E.s || E.busy) return;
    player.pause();
    busy('Making a preview…');
    const p = await guard(() => tf.editPreview(E.s.id, op), 'Preview: ');
    busy(null);
    if (!p) return;
    const back = E.preview ? E.preview.back : player.currentTime; // a new preview during a preview: go back to the edit's spot
    E.preview = { ...p, label, back };
    E.stopAt = null;
    player.src = p.url;
    player.addEventListener('loadedmetadata', () => {
      if (!E.preview || !player.src.endsWith(p.url.split('/').pop())) return; // stopped or replaced meanwhile
      player.currentTime = Math.max(0, Math.min(p.duration - 0.1, from ?? back));
      pause();
      player.play().catch(() => {});
    }, { once: true });
    render();
  }
  function stopPreview() {
    if (!E.preview) return;
    const back = E.preview.back;
    E.preview = null;
    E.stopAt = null;
    player.pause();
    player.src = E.s.url;
    player.addEventListener('loadedmetadata', () => { player.currentTime = Math.min(back, E.s.duration); }, { once: true });
    render();
  }

  // ---------- playing ----------
  function playPause() {
    if (!E.s) return;
    if (player.paused) { pause(); E.stopAt = null; player.play().catch(() => {}); } else player.pause();
  }
  function playSel() {
    if (!E.s || !E.sel) return;
    pause();
    player.currentTime = E.sel.a;
    E.stopAt = E.sel.b;
    player.play().catch(() => {});
  }
  player.addEventListener('play', () => drawBar());
  player.addEventListener('pause', () => drawBar());
  (function tick() {
    if (!player.paused && E.stopAt && player.currentTime >= E.stopAt) { player.pause(); player.currentTime = E.stopAt; E.stopAt = null; }
    if (E.s && !player.paused) { draw(); drawBar(); }
    requestAnimationFrame(tick);
  })();

  // ---------- the waveform ----------
  const W = () => el('ed-canvas');
  const view = () => { const c = W(); const w = c ? c.clientWidth : 1; const span = E.s ? E.s.duration / E.zoom : 1; return { w, span, t0: E.scroll, pps: w / span }; };
  const timeAt = (x) => { const v = view(); return Math.max(0, Math.min(E.s.duration, v.t0 + x / v.pps)); };
  const xAt = (t) => { const v = view(); return (t - v.t0) * v.pps; };
  function clampScroll() { const v = view(); E.scroll = Math.max(0, Math.min(E.s.duration - v.span, E.scroll)); }
  function zoomTo(z, aroundX) {
    if (!E.s) return;
    const t = aroundX === undefined ? E.scroll + view().span / 2 : timeAt(aroundX);
    const frac = aroundX === undefined ? 0.5 : aroundX / view().w;
    E.zoom = Math.max(1, Math.min(400, z));
    E.scroll = t - view().span * frac;
    clampScroll();
    draw(); drawBar();
  }
  function draw() {
    const c = W();
    if (!c || !E.s) return;
    const dpr = window.devicePixelRatio || 1;
    const Wd = Math.round(c.clientWidth * dpr), Hd = Math.round(c.clientHeight * dpr);
    if (c.width !== Wd || c.height !== Hd) { c.width = Wd; c.height = Hd; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, Wd, Hd);
    const st = getComputedStyle(document.body);
    const accent = st.getPropertyValue('--accent').trim() || '#c9d6ff';
    const todo = st.getPropertyValue('--wave-todo').trim() || 'rgba(255,255,255,.3)';
    const v = view(), p = E.s.peaks, n = p.length, ruler = 22 * dpr, mid = ruler + (Hd - ruler) / 2, amp = (Hd - ruler) / 2 - 4 * dpr;
    // ruler: seconds marks that fit the zoom
    const steps = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const step = steps.find((s) => s * v.pps >= 70) || 600;
    g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, 0, Wd, ruler);
    g.font = `${11 * dpr}px system-ui, sans-serif`; g.fillStyle = 'rgba(255,255,255,.45)'; g.strokeStyle = 'rgba(255,255,255,.12)';
    for (let t = Math.ceil(v.t0 / step) * step; t <= v.t0 + v.span; t += step) {
      const x = xAt(t) * dpr;
      g.fillRect(x, ruler - 6 * dpr, 1, 6 * dpr);
      g.fillText(step < 1 ? fmt(t) : fmtTime(t), x + 3 * dpr, 14 * dpr);
    }
    // selection
    if (E.sel) {
      const a = xAt(E.sel.a) * dpr, b = xAt(E.sel.b) * dpr;
      g.fillStyle = 'rgba(120,160,255,.18)'; g.fillRect(a, ruler, b - a, Hd - ruler);
      g.fillStyle = accent; g.fillRect(a - dpr, ruler, 2 * dpr, Hd - ruler); g.fillRect(b - dpr, ruler, 2 * dpr, Hd - ruler);
    }
    if (!E.preview) TFEditTabs.overlay(g, { dpr, Wd, Hd, ruler, xAt, view: v, duration: E.s.duration, tab: E.tab });
    // the wave: one bar per pixel column
    const played = player.currentTime;
    for (let x = 0; x < Wd; x++) {
      const t1 = v.t0 + (x / dpr) / v.pps, t2 = v.t0 + ((x + 1) / dpr) / v.pps;
      let i1 = Math.floor((t1 / E.s.duration) * n), i2 = Math.max(i1 + 1, Math.ceil((t2 / E.s.duration) * n));
      let m = 0;
      for (let i = Math.max(0, i1); i < Math.min(n, i2); i++) if (p[i] > m) m = p[i];
      const hgt = Math.max(dpr, m * amp);
      g.fillStyle = t1 <= played ? accent : todo;
      g.fillRect(x, mid - hgt, 1, hgt * 2);
    }
    // playhead (not while a preview plays: the preview has its own length)
    if (!E.preview) { const px = xAt(played) * dpr; g.fillStyle = '#fff'; g.fillRect(px - dpr / 2, ruler, dpr * 1.5, Hd - ruler); }
  }
  function drawBar() {
    if (!E.s) return;
    const t = el('ed-time'); if (t) t.textContent = `${fmt(player.currentTime)} / ${fmt(E.preview ? E.preview.duration : E.s.duration)}`;
    const p = el('ed-play'); if (p) p.innerHTML = player.paused ? ICONS.play : ICONS.pause;
    const s = el('ed-sel');
    if (s) s.textContent = E.sel ? `Selected ${fmt(E.sel.a)} – ${fmt(E.sel.b)} (${(E.sel.b - E.sel.a).toFixed(2)} s)` : 'Drag across the waveform to select a part';
    for (const id of ['ed-cut', 'ed-keep', 'ed-playsel', 'ed-clear']) { const b = el(id); if (b) b.disabled = !E.sel; }
    const z = el('ed-zoom'); if (z) z.textContent = `${Math.round(E.zoom * 100)}%`;
    const sb = el('ed-scroll');
    if (sb) { const max = Math.max(0, E.s.duration - view().span); sb.max = String(max); sb.value = String(E.scroll); sb.disabled = max <= 0; }
  }
  let wired = null; // listeners of the current page; removed when the page is drawn again
  function wireCanvas(c) {
    if (wired) wired.abort();
    wired = new AbortController();
    const signal = wired.signal;
    let down = null;
    c.addEventListener('mousedown', (e) => {
      if (!E.s || e.button !== 0) return;
      const r = c.getBoundingClientRect(), x = e.clientX - r.left, t = timeAt(x);
      const own = !E.preview && TFEditTabs.mouseDown({ x, t, xAt, e, tab: E.tab });
      if (own) { down = { own }; e.preventDefault(); return; }
      // grab an edge of the selection to move it
      const near = (tt) => Math.abs(xAt(tt) - x) < 6;
      if (E.sel && near(E.sel.a)) down = { edge: 'a' };
      else if (E.sel && near(E.sel.b)) down = { edge: 'b' };
      else if (e.shiftKey && E.sel) { down = { edge: t < E.sel.a ? 'a' : 'b' }; E.sel[down.edge] = t; }
      else down = { start: t, x, moved: false };
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!down || !E.s || !c.isConnected) return;
      const r = c.getBoundingClientRect(), x = Math.max(0, Math.min(r.width, e.clientX - r.left)), t = timeAt(x);
      if (down.own) { down.own.move(t); draw(); return; }
      if (down.edge) { E.sel[down.edge] = t; if (E.sel.a > E.sel.b) { [E.sel.a, E.sel.b] = [E.sel.b, E.sel.a]; down.edge = down.edge === 'a' ? 'b' : 'a'; } }
      else if (Math.abs(x - down.x) > 3) { down.moved = true; E.sel = { a: Math.min(down.start, t), b: Math.max(down.start, t) }; }
      draw(); drawBar();
    }, { signal });
    window.addEventListener('mouseup', () => {
      if (!down) return;
      if (down.own) { if (down.own.up) down.own.up(); down = null; draw(); return; }
      if (!down.edge && !down.moved && !E.preview) { player.currentTime = down.start; E.sel = null; } // a click: jump there
      if (E.sel && E.sel.b - E.sel.a < 0.01) E.sel = null;
      down = null;
      draw(); drawBar();
    }, { signal });
    c.addEventListener('wheel', (e) => {
      if (!E.s) return;
      e.preventDefault();
      const r = c.getBoundingClientRect();
      if (e.ctrlKey) zoomTo(E.zoom * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX - r.left);
      else { E.scroll += (e.deltaY + e.deltaX) / view().pps; clampScroll(); draw(); drawBar(); }
    }, { passive: false });
    const ro = new ResizeObserver(() => draw());
    ro.observe(c);
    signal.addEventListener('abort', () => ro.disconnect());
  }

  // ---------- the page ----------
  function render() {
    const root = el('view-edit');
    if (!root) return;
    root.innerHTML = '';
    const t = track();
    if (!E.s || !t) {
      root.append(h('div', { class: 'ed-empty' },
        h('div', { class: 'ed-empty-ic', html: ICONS.caliper }),
        h('b', {}, 'Edit a song'),
        h('p', {}, 'Right-click a song in the Library → Edit…, or open one here. You can cut parts out, keep only a part, and save in 3 ways. Trim, Split, Effects, Loop and Layers come next.'),
        h('button', { class: 'tb pri', onclick: pick }, 'Open a song…'),
        h('div', { id: 'ed-busy', class: 'ed-busy', hidden: true })));
      return;
    }
    const tabs = [['trim', 'Trim', 'Remove silent bits at the start and end'], ['split', 'Split', 'Cut one long file into separate songs'], ['effects', 'Effects', 'Echo, slowed + reverb, nightcore, bass, 8D, 1D'], ['loop', 'Loop', 'Repeat a part, with a smooth join'], ['layers', 'Layers', 'Sounds on top, your voice, smart connect']];
    root.append(...[
      h('div', { class: 'ed-top' },
        h('div', { class: 'ed-song' }, h('div', { class: 'pl-mini' }, coverEl(t)),
          h('div', {}, h('b', {}, t.title), h('span', {}, `${t.artist || 'Unknown artist'} · ${E.s.versions[E.s.version]}${E.s.version ? ` (change ${E.s.version})` : ''}`))),
        h('div', { class: 'ed-tabs seg' }, ...tabs.map(([k, n, tip]) => h('button', { class: E.tab === k ? 'on' : '', title: tip, onclick: () => { E.tab = E.tab === k ? '' : k; if (E.preview) stopPreview(); render(); } }, n))),
        h('div', { class: 'ed-top-r' },
          h('button', { class: 'tb', disabled: !E.s.canUndo, title: 'Undo (Ctrl+Z)', onclick: undo }, '↶ Undo'),
          h('button', { class: 'tb', disabled: !E.s.canRedo, title: 'Redo (Ctrl+Y)', onclick: redo }, '↷ Redo'),
          h('button', { class: 'tb', onclick: pick, title: 'Edit another song' }, 'Open…'))),
      h('div', { class: 'ed-wave' }, h('canvas', { id: 'ed-canvas' }), h('div', { id: 'ed-busy', class: 'ed-busy', hidden: true })),
      h('input', { type: 'range', id: 'ed-scroll', class: 'ed-scroll', min: 0, step: 0.01, value: 0, title: 'Scroll along the song', oninput: (e) => { E.scroll = +e.target.value; draw(); } }),
      h('div', { class: 'ed-bar' },
        h('button', { class: 'ed-playbtn', id: 'ed-play', title: 'Play / pause the edited song', onclick: playPause }),
        h('span', { class: 'ed-time', id: 'ed-time' }),
        h('span', { class: 'ed-sel', id: 'ed-sel' }),
        h('span', { class: 'grow' }),
        h('button', { class: 'tb', id: 'ed-playsel', onclick: playSel, title: 'Play only the selected part' }, '▶ Play selection'),
        h('button', { class: 'tb', id: 'ed-cut', onclick: cut, title: 'Remove the selected part (Delete)' }, '✂ Cut out'),
        h('button', { class: 'tb', id: 'ed-keep', onclick: keep, title: 'Keep only the selected part' }, '⬚ Keep only this'),
        h('button', { class: 'tb', id: 'ed-clear', onclick: () => { E.sel = null; draw(); drawBar(); }, title: 'Select nothing' }, 'Clear'),
        h('div', { class: 'ed-zoombox' },
          h('button', { class: 'tb', onclick: () => zoomTo(E.zoom / 1.5), title: 'Zoom out' }, '−'),
          h('span', { id: 'ed-zoom', title: 'Ctrl + mouse wheel on the waveform zooms too' }),
          h('button', { class: 'tb', onclick: () => zoomTo(E.zoom * 1.5), title: 'Zoom in' }, '+'),
          h('button', { class: 'tb', onclick: () => zoomTo(1), title: 'See the whole song' }, 'Fit'))),
      E.preview ? h('div', { class: 'ed-preview' }, h('b', {}, `🎧 ${E.preview.label}`), h('span', {}, 'You are hearing how it would sound. Nothing is changed yet.'), h('span', { class: 'grow' }),
        h('button', { class: 'tb', onclick: stopPreview }, 'Stop preview')) : null,
      E.tab ? h('div', { class: 'ed-panel' }, TFEditTabs.panel(E.tab)) : null,
      saveBox()].filter(Boolean));
    wireCanvas(el('ed-canvas'));
    requestAnimationFrame(() => { draw(); drawBar(); });
  }
  function saveBox() {
    const t = track();
    const name = t.srcPath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
    const modes = [
      ['both', 'Keep both', `New file "${name} New". The original stays as it is.`],
      ['newname', 'New takes the name', `New file "${name}". The original becomes "${name} Old".`],
      ['replace', 'Replace the original', `New file "${name}". The original goes to the Recycle Bin (Tonix asks first).`],
    ];
    return h('div', { class: 'ed-save' },
      h('div', { class: 'sv-l' }, 'Save'),
      h('div', { class: 'sv-modes ed-modes' }, ...modes.map(([m, l, d]) => h('button', { class: `sv-mode${E.mode === m ? ' on' : ''}${m === 'replace' ? ' danger' : ''}`, onclick: () => { E.mode = m; render(); } }, h('b', {}, l), h('span', {}, d)))),
      h('button', { class: 'btn primary', disabled: !E.s.version, title: E.s.version ? 'Save the edited song next to the original file' : 'Nothing changed yet', onclick: save }, 'Save'));
  }

  // keys on the Edit page (the Library / Map keys don't apply here)
  document.addEventListener('keydown', (e) => {
    if (S.view !== 'edit' || !E.s || e.target.closest('input, textarea, .modal')) return;
    const k = `${e.ctrlKey ? 'Ctrl+' : ''}${e.code}`;
    const run = { Space: playPause, Delete: cut, 'Ctrl+KeyZ': undo, 'Ctrl+KeyY': redo, Escape: () => { E.sel = null; draw(); drawBar(); } }[k];
    if (run) { e.preventDefault(); e.stopImmediatePropagation(); run(); }
  }, true);

  const stop = () => { if (!player.paused) player.pause(); };
  // what the tabs (edittabs.js) can use
  const api = {
    get session() { return E.s; }, get sel() { return E.sel; }, set sel(v) { E.sel = v; draw(); drawBar(); },
    get busy() { return E.busy; }, get previewing() { return !!E.preview; }, player, fmt, track,
    draw: () => { draw(); drawBar(); }, render, change, preview, stopPreview, busy, timeAt: (x) => timeAt(x),
    seek: (t) => { player.currentTime = t; draw(); drawBar(); },
    xAt: (t) => xAt(t), view: () => view(),
    playRange: (a, b) => { if (!E.s) return; pause(); player.currentTime = a; E.stopAt = b; player.play().catch(() => {}); },
  };
  return { open, render, pick, stop, api, get session() { return E.s; } };
})();
