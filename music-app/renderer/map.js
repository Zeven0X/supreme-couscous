'use strict';
/* global S, h, $, $$, coverEl, ICONS, modal, guard, toast, tf, TFChance, TFBackgrounds, TFStudio, sameLoudness, applyFx, renderFx */
// The Map page: songs on a board, connected by paths. (Path settings and playing come in later steps.)
(function () {
  const M = {
    map: null, loaded: false, saveTimer: null,
    selected: null, // selected song stop id
    selPath: null, // selected path id
    pathMode: false, // Path button is on
    from: null, // in Path mode: the song a new path starts from
    pointer: null, // mouse position in map coordinates (for the line that follows the mouse)
    draw: null, // points of the line being drawn by hand right now
  };
  const Sh = window.TFShape;
  const BG = window.TFBackgrounds;
  let assetUrl = '';
  const board = $('#map-board');
  const world = $('#map-world');
  const STOP = 96; // cover size in map pixels
  const R = STOP / 2;
  const ZMIN = 0.3, ZMAX = 2.5;
  const SVGNS = 'http://www.w3.org/2000/svg';

  // ---------- saving ----------
  // Undo / redo: each save compares the map with the last saved copy. If something real changed
  // (not just moving around, zooming or the music's position), the old copy goes on the undo list.
  const content = (m) => JSON.stringify({ ...m, view: null, progress: null, updatedAt: null });
  M.undo = []; M.redo = []; M.last = null;
  function remember() {
    if (!M.map) return;
    const now = content(M.map);
    if (M.last !== null && now !== M.last) {
      M.undo.push(M.last);
      if (M.undo.length > 100) M.undo.shift();
      M.redo = [];
    }
    M.last = now;
  }
  function resetHistory() { M.undo = []; M.redo = []; M.last = M.map ? content(M.map) : null; }
  function save() {
    clearTimeout(M.saveTimer);
    M.saveTimer = setTimeout(() => {
      if (!M.map) return;
      remember();
      tf.mapSave(M.map).catch((e) => toast(`Map not saved: ${e.message}`, { type: 'error' }));
    }, 400);
  }
  function undoRedo(dir) {
    clearTimeout(M.saveTimer);
    remember(); // a change still waiting to be saved counts too
    const from = dir < 0 ? M.undo : M.redo, to = dir < 0 ? M.redo : M.undo;
    if (!from.length) { toast(dir < 0 ? 'Nothing to undo' : 'Nothing to redo', { ms: 1500 }); return; }
    to.push(M.last);
    const back = JSON.parse(from.pop());
    M.map = { ...back, view: M.map.view, progress: M.map.progress };
    M.last = content(M.map);
    if (!stopById(M.selected)) M.selected = null;
    if (!M.map.paths.some((p) => p.id === M.selPath)) M.selPath = null;
    render();
    applyView();
    tf.mapSave(M.map).catch(() => {});
    toast(dir < 0 ? 'Undone' : 'Redone', { ms: 1200 });
  }
  const snapshot = () => JSON.parse(JSON.stringify(M.map));
  function undoToast(msg, before) {
    toast(msg, { action: () => { M.map = before; M.selected = null; M.selPath = null; render(); applyView(); save(); }, actionLabel: 'Undo' });
  }

  // ---------- view (move + zoom) ----------
  function applyView() {
    const v = M.map.view;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
    // the background is a tile that repeats; it moves and zooms with the map
    const t = bgTile();
    board.style.backgroundColor = t.color;
    board.style.backgroundImage = t.url;
    board.style.backgroundPosition = `${v.x}px ${v.y}px`;
    board.style.backgroundSize = `${t.W * v.zoom}px ${t.H * v.zoom}px`;
    const z = $('#map-zoom');
    z.value = Math.round(v.zoom * 100);
    z.style.setProperty('--pct', `${((v.zoom * 100 - 30) / 220) * 100}%`);
  }
  function bgTile(bg = M.map.bg) {
    if (bg && bg.kind === 'custom' && bg.file) return { color: '#202020', url: `url('${assetUrl}${bg.file}')`, W: bg.w || 512, H: bg.h || 512, light: false };
    const b = BG.byId(bg && bg.id);
    return { color: b.color, url: b.url, W: b.W, H: b.H, light: b.light };
  }
  // Song name color: Auto picks dark text on light backgrounds; or the user's choice.
  function nameStyle() {
    const n = M.map.names || { mode: 'auto' };
    const color = n.mode === 'light' ? '#ffffff' : n.mode === 'dark' ? '#1a1a1a' : n.mode === 'custom' ? n.color : (bgTile().light ? '#1a1a1a' : '#ffffff');
    const hex = color.replace('#', ''), lum = (0.299 * parseInt(hex.slice(0, 2), 16) + 0.587 * parseInt(hex.slice(2, 4), 16) + 0.114 * parseInt(hex.slice(4, 6), 16)) / 255;
    board.style.setProperty('--mname', color);
    board.style.setProperty('--mshadow', lum > 0.55 ? '0 1px 3px #000, 0 0 2px #000' : '0 1px 3px rgba(255,255,255,.85), 0 0 2px rgba(255,255,255,.7)');
  }
  function zoomAt(newZoom, cx, cy) {
    const v = M.map.view;
    const z = Math.min(ZMAX, Math.max(ZMIN, newZoom));
    v.x = cx - ((cx - v.x) * z) / v.zoom;
    v.y = cy - ((cy - v.y) * z) / v.zoom;
    v.zoom = z;
    applyView();
    save();
  }
  function zoomCenter(z) { zoomAt(z, board.clientWidth / 2, board.clientHeight / 2); }
  function fit() {
    const stops = M.map.stops;
    if (!stops.length) { M.map.view = { x: board.clientWidth / 2, y: board.clientHeight / 2, zoom: 1 }; applyView(); save(); return; }
    const xs = stops.map((s) => s.x), ys = stops.map((s) => s.y);
    const pad = 130;
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad - 40, maxY = Math.max(...ys) + pad + 30;
    const z = Math.min(ZMAX, Math.max(ZMIN, Math.min(board.clientWidth / (maxX - minX), board.clientHeight / (maxY - minY), 1.4)));
    M.map.view = { zoom: z, x: board.clientWidth / 2 - ((minX + maxX) / 2) * z, y: board.clientHeight / 2 - ((minY + maxY) / 2) * z };
    applyView();
    save();
  }
  function toWorld(clientX, clientY) {
    const r = board.getBoundingClientRect(), v = M.map.view;
    return [(clientX - r.left - v.x) / v.zoom, (clientY - r.top - v.y) / v.zoom];
  }

  // ---------- path geometry ----------
  const stopById = (id) => M.map.stops.find((s) => s.id === id);
  const pathsFrom = (id) => M.map.paths.filter((p) => p.from === id);

  // A gently bent curve from edge to edge. Paths A→B and B→A bend to opposite sides, so they never overlap.
  function curve(a, b) {
    if (a === b) {
      // a loop back to the same song: an arc over the top of the cover
      const sx = a.x + R * Math.cos(-1.1), sy = a.y + R * Math.sin(-1.1);
      const ex = a.x + R * Math.cos(-2.04), ey = a.y + R * Math.sin(-2.04);
      return { d: `M${sx} ${sy}C${a.x + 95} ${a.y - 150} ${a.x - 95} ${a.y - 150} ${ex} ${ey}`, end: [ex, ey], dir: [ex - (a.x - 95), ey - (a.y - 150)], mid: [a.x, a.y - 118] };
    }
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; // sideways direction
    const bend = Math.min(60, len * 0.18);
    const cx = (a.x + b.x) / 2 + nx * bend, cy = (a.y + b.y) / 2 + ny * bend;
    const edge = (p, toX, toY, pad) => { const l = Math.hypot(toX - p.x, toY - p.y) || 1; return [p.x + ((toX - p.x) / l) * pad, p.y + ((toY - p.y) / l) * pad]; };
    const [sx, sy] = edge(a, cx, cy, R + 4);
    const [ex, ey] = edge(b, cx, cy, R + 7);
    return { d: `M${sx} ${sy}Q${cx} ${cy} ${ex} ${ey}`, end: [ex, ey], dir: [ex - cx, ey - cy], mid: [0.25 * sx + 0.5 * cx + 0.25 * ex, 0.25 * sy + 0.5 * cy + 0.25 * ey] };
  }
  function arrowHead(end, dir, size) {
    const l = Math.hypot(dir[0], dir[1]) || 1, ux = dir[0] / l, uy = dir[1] / l;
    const bx = end[0] - ux * size * 1.5, by = end[1] - uy * size * 1.5;
    return `${end[0]},${end[1]} ${bx - uy * size},${by + ux * size} ${bx + uy * size},${by - ux * size}`;
  }
  // The full shape of a path: the automatic curve, or a smooth line through its hand-drawn points.
  function geom(p, a, b) {
    const pts = (p.pts || []).map((q) => Sh.fromNorm(a, b, q));
    if (!pts.length) return { ...curve(a, b), pts, mids: [] };
    const edge = (c, to, pad) => { const l = Math.hypot(to[0] - c.x, to[1] - c.y) || 1; return [c.x + ((to[0] - c.x) / l) * pad, c.y + ((to[1] - c.y) / l) * pad]; };
    const end = edge(b, pts[pts.length - 1], R + 7);
    const sp = Sh.spline([edge(a, pts[0], R + 4), ...pts, end]);
    return { d: sp.d, end, dir: [end[0] - sp.lastC2[0], end[1] - sp.lastC2[1]], pts, mids: sp.mids };
  }
  const el = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

  // ---------- drawing ----------
  function drawLines() {
    let svg = world.querySelector('svg.mlines');
    if (!svg) { svg = el('svg', { class: 'mlines', width: 1, height: 1 }); world.prepend(svg); }
    svg.innerHTML = '';
    for (const p of M.map.paths) {
      const a = stopById(p.from), b = stopById(p.to);
      if (!a || !b) continue;
      const c = geom(p, a, b);
      const w = 2.5 + (p.chance / 100) * 6; // thick line = likely path
      const sel = p.id === M.selPath;
      const live = M.play && p.from === M.play.stopId;
      const g = el('g', { class: `mpath${sel ? ' selected' : ''}${live ? ' live' : ''}${M.play && (M.play.chosen === p.id || M.travelPath === p.id) ? ' chosen' : ''}`, 'data-id': p.id, style: `color:${p.color && p.color !== '#e3923a' ? p.color : 'var(--accent)'}` });
      const line = el('path', { d: c.d, class: 'line', 'stroke-width': w });
      if (p.style === 'dashed') line.setAttribute('stroke-dasharray', `${w * 2.4} ${w * 2}`);
      if (p.style === 'dotted') line.setAttribute('stroke-dasharray', `0.01 ${w * 2.1}`);
      g.append(el('path', { d: c.d, class: 'hit' }), line, el('polygon', { points: arrowHead(c.end, c.dir, 5 + w * 0.6), class: 'head' }));
      svg.append(g);
      // the chance label sits halfway along the line, whatever its shape
      const len = line.getTotalLength();
      const at = (f) => { const q = line.getPointAtLength(len * f); return [q.x, q.y]; };
      const mid = at(0.5);
      const num = live ? outsOf(M.play.stopId).indexOf(p) + 1 : 0; // number key that chooses this path
      const showName = S.settings.pathLabels !== 'chance';
      const label = `${num > 0 && num < 10 ? `${num} · ` : ''}${showName && p.name ? `${p.name} · ` : ''}${p.chance}%${p.locked ? ' 🔒' : ''}`;
      if (S.settings.pathLabels === 'hidden' && !sel && !(num > 0)) continue; // no label (the line stays clickable)
      const lw = 14 + label.length * 7.3 + (p.locked ? 6 : 0);
      g.append(el('rect', { x: mid[0] - lw / 2, y: mid[1] - 11, width: lw, height: 22, rx: 11, class: 'pill' }));
      const t = el('text', { x: mid[0], y: mid[1] + 5, class: 'pct' });
      t.textContent = label;
      g.append(t);
      // bend handles: big dots are the path's points, small faint dots add a new point
      if (sel && !M.pathMode) {
        const ghosts = c.pts.length ? c.mids.map((m, i) => [m, i]) : [[at(0.28), 0], [at(0.72), 0]];
        for (const [m, i] of ghosts) g.append(el('circle', { cx: m[0], cy: m[1], r: 6, class: 'handle ghost', 'data-i': i }));
        c.pts.forEach((q, i) => g.append(el('circle', { cx: q[0], cy: q[1], r: 8, class: 'handle', 'data-i': i })));
      }
    }
    // while making a path: your drawing so far, or a straight line that follows the mouse
    if (M.pathMode && M.from) {
      const a = stopById(M.from);
      if (M.draw && M.draw.length > 1) svg.append(el('polyline', { points: M.draw.map((q) => q.join(',')).join(' '), class: 'rubber drawn' }));
      else if (a && M.pointer) svg.append(el('line', { x1: a.x, y1: a.y, x2: M.pointer[0], y2: M.pointer[1], class: 'rubber' }));
    }
  }

  function render() {
    world.querySelectorAll('.mstop').forEach((n) => n.remove());
    for (const s of M.map.stops) {
      const t = S.byId.get(s.trackId);
      const outs = pathsFrom(s.id).length;
      world.append(h('div', {
        class: `mstop${M.play && M.play.stopId === s.id ? ' playing' : ''}${s.id === M.selected ? ' selected' : ''}${s.id === M.map.startId ? ' start' : ''}${s.id === M.from ? ' from' : ''}${t ? '' : ' missing'}`,
        'data-id': s.id, style: { left: `${s.x - R}px`, top: `${s.y - R}px` },
        title: t ? `${[t.title, t.artist].filter(Boolean).join(' — ')}\nDouble-click to play the map from this song` : 'This song was removed from your library',
      },
      h('div', { class: 'mart' }, coverEl(t || { title: 'Missing song' })),
      h('div', { class: 'mname' }, t ? t.title : 'Missing song'),
      s.id === M.map.startId ? h('div', { class: 'mflag', html: ICONS.flag, title: 'Start' }) : null,
      h('div', { class: 'mfx', title: 'This song has its own sound settings on this map', hidden: !t || !s.fx || sameFx(s.fx, S.defaults) }, 'FX'),
      outs === 0 && M.map.paths.length ? h('div', { class: 'mend', title: 'No paths out: the music stops here' }, 'END') : null));
    }
    drawLines();
    nameStyle();
    pathPanel();
    syncEdit();
    $('#map-empty').hidden = M.map.stops.length > 0;
    $('#map-name').textContent = `${M.map.name} ▾`;
    const ns = M.map.stops.length, np = M.map.paths.length;
    $('#map-name').dataset.sub = `${ns} song${ns === 1 ? '' : 's'} · ${np} path${np === 1 ? '' : 's'}`;
    $('#map-start').disabled = !M.selected || M.selected === M.map.startId;
    $('#map-remove').disabled = !M.selected && !M.selPath;
    $('#map-path').classList.toggle('on', M.pathMode);
    board.classList.toggle('path-mode', M.pathMode);
    const hint = $('#map-hint');
    const selP = !M.pathMode && M.map.paths.find((p) => p.id === M.selPath);
    const playHint = M.play && !M.pathMode && !selP && outsOf(M.play.stopId).length > 1;
    hint.hidden = !M.pathMode && !selP && !playHint;
    $('#map-play').classList.toggle('on', !!M.play);
    const rp = !M.play && resumePoint();
    $('#map-play span:last-child').textContent = M.play ? 'Stop map' : rp ? 'Continue' : 'Play map';
    const tip = M.play ? 'Stop the map (it remembers where)' : rp ? `Continue where the music stopped: ${(S.byId.get(stopById(rp.stopId).trackId) || {}).title || ''}` : 'Play this map from its Start song';
    const pk = TFKeys.current(S.settings.keys || {}).mapPlay[0];
    $('#map-play').dataset.tip = tip;
    $('#map-play').title = pk ? `${tip} (${TFKeys.label(pk)})` : tip;
    $('#map-restart').hidden = !rp;
    $('#map-play .ic').innerHTML = M.play ? ICONS.stop : ICONS.play;
    $('#map-follow').hidden = !M.play;
    $('#map-follow').classList.toggle('on', !M.noFollow);
    hint.textContent = playHint ? (M.play.chosen ? 'Next song chosen ✓ · click the path again to leave it to luck' : 'Click a glowing path to choose the next song, or leave it to luck')
      : selP ? 'Drag the dots to bend this path · double-click a dot to remove it'
      : !M.from ? 'Path: click a song, or press on it and draw your path to another song'
        : M.draw ? 'Keep drawing to the song it goes to, then let go'
          : 'Now click the song it goes to (click the same song for a loop) · Esc to cancel';
    $('#map-straighten').hidden = !(selP && selP.pts && selP.pts.length);
  }
  function select(id) { M.selected = id; M.selPath = null; render(); }
  // The Sound panel on the left edits the selected song's own map copy of the settings.
  const sameFx = (a, b) => ['speed', 'pitch', 'volume', 'fadeIn', 'fadeOut'].every((k) => (a[k] || 0) === (b[k] || 0)) && (a.natural !== false) === (b.natural !== false);
  function syncEdit() {
    const s = !M.pathMode && stopById(M.selected);
    const t = s && S.byId.get(s.trackId);
    if (!s || !t) { if (S.edit) setEdit(null); return; }
    if (!s.fx) s.fx = { ...t.fx };
    if (!S.edit || S.edit.fx !== s.fx) setEdit(editObj(s, t));
  }
  function editObj(s, t) {
    return { fx: s.fx, title: t.title, save: () => {
      const n = world.querySelector(`.mstop[data-id="${s.id}"] .mfx`);
      if (n) n.hidden = sameFx(s.fx, S.defaults);
      save();
    } };
  }
  function playStop(s) {
    const t = s && S.byId.get(s.trackId);
    if (!t) return;
    if (!s.fx) s.fx = { ...t.fx };
    loadTrack(s.trackId, { autoplay: true, stop: editObj(s, t) });
  }
  function selectPath(id) { M.selPath = id; M.selected = null; render(); }


  // ---------- path settings panel (shows when a path is selected) ----------
  const COLORS = [null, '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#b197fc', '#f783ac'];
  const stopName = (id) => { const s = stopById(id); const t = s && S.byId.get(s.trackId); return t ? t.title : 'Missing song'; };
  function pathPanel() {
    const box = $('#map-pathpanel');
    const p = !M.pathMode && M.map.paths.find((x) => x.id === M.selPath);
    if (!p) { box.hidden = true; M.panelFor = null; return; }
    box.hidden = false;
    if (M.panelFor !== p.id) { buildPanel(box, p.id); M.panelFor = p.id; }
    refreshPanel(box, p);
  }
  function buildPanel(box, id) {
    const P = () => M.map.paths.find((x) => x.id === id);
    const sib = () => pathsFrom(P().from);
    const changed = () => { drawLines(); refreshPanel(box, P()); save(); };
    const setChance = (v) => { if (sib().length < 2) return; TFChance.setChance(sib(), P(), v); changed(); };
    const enter = (e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); };

    const name = h('input', { class: 'pp-name', placeholder: 'Name (optional)', maxlength: '30', spellcheck: 'false' });
    name.addEventListener('input', () => { P().name = name.value; drawLines(); save(); });
    name.addEventListener('keydown', enter);

    const chance = h('input', { class: 'pp-num', 'data-f': 'chance', spellcheck: 'false', title: 'Type an exact chance and press Enter' });
    chance.addEventListener('change', () => { const v = parseFloat(chance.value.replace(',', '.')); if (Number.isFinite(v)) setChance(v); else refreshPanel(box, P()); });
    chance.addEventListener('keydown', enter);
    const slider = h('input', { type: 'range', min: '0', max: '100', step: '1', 'data-f': 'slider' });
    slider.addEventListener('input', () => setChance(+slider.value));
    const lock = h('button', { class: 'pp-lock', title: 'Lock: this chance stays put when other paths change', onclick: () => { P().locked = !P().locked; changed(); } }, '🔒 Lock');
    const steps = h('div', { class: 'fx-btns' }, ...[-25, -5, -1, 1, 5, 25].map((d) => h('button', { onclick: () => setChance(P().chance + d) }, `${d > 0 ? '+' : '−'}${Math.abs(d)}`)));
    const even = h('button', { class: 'chip', title: 'Give every unlocked path from this song the same chance', onclick: () => { TFChance.evenSplit(sib()); changed(); } }, 'Even split');

    const secs = h('input', { class: 'pp-num', 'data-f': 'secs', spellcheck: 'false', title: '0 to 15 seconds' });
    secs.addEventListener('change', () => { const v = parseFloat(secs.value.replace(',', '.')); if (Number.isFinite(v)) P().blend.secs = Math.round(Math.min(15, Math.max(0, v)) * 100) / 100; changed(); });
    secs.addEventListener('keydown', enter);
    const blend = h('div', { class: 'seg', 'data-f': 'blend' }, ...[['crossfade', 'Crossfade', 'The first song fades out while the next fades in'], ['silence', 'Silence', 'A short quiet gap between the songs'], ['cut', 'Cut', 'The next song starts right away']]
      .map(([k, l, tip]) => h('button', { 'data-k': k, title: tip, onclick: () => { P().blend = { type: k, secs: P().blend && P().blend.secs !== undefined ? P().blend.secs : 3 }; changed(); } }, l)));

    const custom = h('input', { type: 'color', title: 'Any color' });
    custom.addEventListener('input', () => { P().color = custom.value; changed(); });
    const colors = h('div', { class: 'pp-colors', 'data-f': 'colors' },
      ...COLORS.map((c) => h('button', { class: 'sw', 'data-c': c || '', title: c ? '' : 'Normal', style: { background: c || 'var(--accent)' }, onclick: () => { P().color = c; changed(); } })),
      h('label', { class: 'sw any', title: 'Any color' }, '+', custom));
    const style = h('div', { class: 'seg', 'data-f': 'style' }, ...[['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']].map(([k, l]) => h('button', { 'data-k': k, onclick: () => { P().style = k; changed(); } }, l)));

    box.innerHTML = '';
    box.append(
      h('div', { class: 'pp-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Path'), h('div', { class: 'pp-title' })),
        h('button', { class: 'pp-x', html: ICONS.close, title: 'Close (Esc)', onclick: () => { M.selPath = null; render(); } })),
      name,
      h('div', { class: 'pp-row' }, h('span', { class: 'fl' }, 'Chance'), h('span', { class: 'grow' }), h('label', { class: 'fx-box' }, chance, h('span', { class: 'fx-unit' }, '%')), lock),
      slider, steps,
      h('div', { class: 'pp-row' }, h('span', { class: 'pp-sibh' }), even),
      h('div', { class: 'pp-sib' }),
      h('div', { class: 'pp-row' }, h('span', { class: 'fl' }, 'Join'), blend),
      h('div', { class: 'pp-row pp-secs' }, h('span', { class: 'pp-secs-l' }), h('label', { class: 'fx-box' }, secs, h('span', { class: 'fx-unit' }, 's'))),
      colors,
      h('div', { class: 'pp-row' }, h('span', { class: 'fl' }, 'Line'), style),
      h('button', { class: 'btn pp-remove', onclick: removeSelected }, 'Remove path'),
    );
    $('.pp-name', box).value = P().name || '';
  }
  function refreshPanel(box, p) {
    if (!p) return;
    const even = box.querySelector('.pp-row .chip');
    const q = (f) => box.querySelector(`[data-f="${f}"]`);
    const sibs = pathsFrom(p.from);
    const alone = sibs.length < 2;
    box.querySelector('.pp-title').textContent = p.from === p.to ? `${stopName(p.from)} ↻ repeats` : `${stopName(p.from)} → ${stopName(p.to)}`;
    if (document.activeElement !== q('chance')) q('chance').value = p.chance;
    q('slider').value = p.chance;
    q('slider').style.setProperty('--pct', `${p.chance}%`);
    q('slider').style.setProperty('--c', p.color && p.color !== '#e3923a' ? p.color : 'var(--accent)');
    for (const el2 of [q('chance'), q('slider'), ...box.querySelectorAll('.fx-btns button'), box.querySelector('.pp-lock')]) el2.disabled = alone;
    box.querySelector('.pp-lock').classList.toggle('on', !!p.locked);
    const sibBox = box.querySelector('.pp-sib');
    sibBox.innerHTML = '';
    box.querySelector('.pp-sibh').textContent = alone ? `The only path out of “${stopName(p.from)}”: always 100%.` : `Paths out of “${stopName(p.from)}”`;
    even.hidden = alone;
    if (!alone) {
      for (const s of sibs) {
        sibBox.append(h('button', { class: `pp-s${s === p ? ' me' : ''}`, title: 'Click to open this path', onclick: () => { M.selPath = s.id; render(); } },
          h('span', {}, `${s.locked ? '🔒 ' : ''}${s.from === s.to ? '↻ repeat' : `→ ${stopName(s.to)}`}`), h('b', {}, `${s.chance}%`)));
      }
    }
    const b = p.blend || { type: 'crossfade', secs: 3 };
    for (const x of q('blend').children) x.classList.toggle('on', x.dataset.k === b.type);
    box.querySelector('.pp-secs').hidden = b.type === 'cut';
    box.querySelector('.pp-secs-l').textContent = b.type === 'silence' ? 'Quiet gap of' : 'Blend for';
    if (document.activeElement !== q('secs')) q('secs').value = (b.secs !== undefined ? b.secs : 3).toFixed(2);
    const col = p.color && p.color !== '#e3923a' ? p.color : '';
    let known = false;
    for (const x of q('colors').querySelectorAll('button.sw')) { const on = x.dataset.c === col; x.classList.toggle('on', on); known = known || on; }
    q('colors').querySelector('.any').classList.toggle('on', !known);
    for (const x of q('style').children) x.classList.toggle('on', x.dataset.k === (p.style || 'solid'));
  }



  // ---------- many maps ----------
  async function saveNow() {
    clearTimeout(M.saveTimer);
    if (M.map) await tf.mapSave(M.map).catch((e) => toast(`Map not saved: ${e.message}`, { type: 'error' }));
  }
  // where "Continue" would pick up, or null
  function resumePoint() {
    const pr = M.map && M.map.progress;
    const s = pr && stopById(pr.stopId);
    if (!s || !S.byId.get(s.trackId)) return null;
    return (pr.stopId !== M.map.startId || (pr.time || 0) > 3) ? pr : null;
  }
  async function openMap(id) {
    if (M.play) { stopPlay(); pause(); } // remembers where it stopped
    await saveNow();
    const m = await guard(() => tf.mapGet(id));
    if (!m) return;
    M.map = m;
    M.map.bg = M.map.bg || { kind: 'builtin', id: 'dots' };
    M.selected = null; M.selPath = null; M.pathMode = false; M.from = null;
    if (!M.map.stops.length) M.map.view = { x: board.clientWidth / 2, y: board.clientHeight / 2, zoom: 1 };
    resetHistory();
    tf.settings({ lastMapId: id }).catch(() => {});
    applyView();
    render();
  }
  function openMaps() {
    modal(async (box, close) => {
      box.classList.add('wide');
      const grid = h('div', { class: 'maps-grid' });
      box.append(h('h2', {}, 'Your maps'), grid,
        h('div', { class: 'foot' }, h('span', { class: 'muted' }, 'Click a map to open it. Every map saves by itself and remembers where its music stopped.'), h('button', { class: 'btn primary', onclick: () => close() }, 'Done')));
      await saveNow();
      let editing = null, sure = null;
      const change = async (id, fn) => { // change one map (the open one, or another one on disk)
        if (id === M.map.id) { fn(M.map); await saveNow(); render(); } else { const m = await tf.mapGet(id); fn(m); await tf.mapSave(m); }
      };
      const draw = async () => {
        const list = await guard(() => tf.mapsList());
        if (!list) return;
        list.sort((a, b) => (b.id === M.map.id) - (a.id === M.map.id) || b.updatedAt - a.updatedAt);
        grid.innerHTML = '';
        for (const m of list) {
          const t = bgTile(m.bg || { kind: 'builtin', id: 'dots' });
          const thumb = m.cover ? h('div', { class: 'map-th', style: { backgroundImage: `url('${assetUrl}${m.cover}')`, backgroundSize: 'cover', backgroundPosition: 'center' } })
            : h('div', { class: 'map-th', style: { backgroundColor: t.color, backgroundImage: t.url, backgroundSize: `${Math.round(t.W * 0.5)}px ${Math.round(t.H * 0.5)}px` } }, h('span', { class: 'map-th-ic', html: ICONS.map }));
          let nameEl;
          if (editing === m.id) {
            nameEl = h('input', { class: 'map-rename', value: m.name, maxlength: '60', spellcheck: 'false' });
            const done = async (keep) => { if (editing !== m.id) return; editing = null; const v = nameEl.value.trim(); if (keep && v && v !== m.name) await change(m.id, (x) => { x.name = v; }); draw(); };
            nameEl.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
            nameEl.addEventListener('blur', () => done(true));
            nameEl.addEventListener('click', (e) => e.stopPropagation());
            setTimeout(() => { nameEl.focus(); nameEl.select(); }, 0);
          } else nameEl = h('div', { class: 'map-n' }, m.name);
          const act = (label, title, fn, cls = '') => h('button', { class: `map-act ${cls}`, title, onclick: (e) => { e.stopPropagation(); fn(); } }, label);
          grid.append(h('div', { class: `map-card${m.id === M.map.id ? ' on' : ''}`, title: 'Open this map', onclick: async () => { if (m.id !== M.map.id) await openMap(m.id); close(); } },
            thumb, nameEl,
            h('div', { class: 'map-s' }, `${m.stops} song${m.stops === 1 ? '' : 's'} · ${m.paths} path${m.paths === 1 ? '' : 's'}${m.id === M.map.id ? ' · open now' : ''}`),
            h('div', { class: 'map-acts' },
              act('Rename', 'Change the name', () => { editing = m.id; sure = null; draw(); }),
              act('Cover', 'Choose a cover picture for this map', async () => {
                const img = await guard(() => tf.pickImage());
                if (!img) return;
                const got = await guard(() => tf.mapBgAdd(m.id, img), 'Picture: ');
                if (got) { await change(m.id, (x) => { x.cover = got.file; }); draw(); }
              }),
              act('Export', 'Save this map as one file (songs, covers and pictures inside) to share it', () => exportMap(m.id)),
              act(sure === m.id ? 'Sure? Delete' : 'Delete', 'Delete this map (a copy is kept in the trash folder)', async () => {
                if (sure !== m.id) { sure = m.id; draw(); return; }
                sure = null;
                if (m.id === M.map.id) { // deleting the open map: open another one first (or a fresh one)
                  const other = list.find((x) => x.id !== m.id) || await tf.mapCreate('My first map');
                  await openMap(other.id);
                }
                await guard(() => tf.mapDelete(m.id));
                toast(`“${m.name}” deleted. A copy is kept in the library's maps\\trash folder.`, { ms: 7000 });
                draw();
              }, sure === m.id ? 'danger' : ''))));
        }
        grid.append(h('div', { class: 'map-card new', title: 'Make a new empty map', onclick: async () => {
          const names = new Set(list.map((x) => x.name));
          let n = list.length + 1, name = `Map ${n}`;
          while (names.has(name)) name = `Map ${++n}`;
          const m = await guard(() => tf.mapCreate(name));
          if (m) { await openMap(m.id); editing = m.id; draw(); }
        } }, h('div', { class: 'map-th plus', html: ICONS.plus }), h('div', { class: 'map-n' }, 'New map'), h('div', { class: 'map-s' }, 'Start with an empty board')));
        grid.append(h('div', { class: 'map-card new', title: 'Open a .tonixmap file someone shared with you', onclick: async () => {
          const f = await guard(() => tf.pickMapFile());
          if (f) { close(); await importMapFile(f); }
        } }, h('div', { class: 'map-th plus', html: ICONS.cloudUp }), h('div', { class: 'map-n' }, 'Import a map'), h('div', { class: 'map-s' }, 'Open a .tonixmap file')));
      };
      draw();
    });
  }
  $('#map-name').addEventListener('click', openMaps);
  async function exportMap(id) {
    if (id === M.map.id) await saveNow();
    const r = await guard(() => tf.mapExport(id), 'Export: ');
    if (!r || r.canceled) return;
    const miss = r.missing ? ` ${r.missing} song${r.missing === 1 ? ' was' : 's were'} left out because ${r.missing === 1 ? 'it is' : 'they are'} no longer in your library.` : '';
    toast(`Map saved with ${r.songs} song${r.songs === 1 ? '' : 's'}: ${r.path}.${miss}`, { type: 'ok', action: () => tf.showItem(r.path), actionLabel: 'Show', ms: 9000 });
  }
  async function importMapFile(file) {
    const r = await guard(() => tf.mapImport(file), 'Import: ');
    if (!r) return;
    for (const t of r.tracks) upsertTrack(t);
    renderGrid();
    if (S.view !== 'map') showView('map');
    await show();
    await openMap(r.map.id);
    const bits = [`${r.tracks.length} new song${r.tracks.length === 1 ? '' : 's'} added to your library`];
    if (r.reused) bits.push(`${r.reused} you already had`);
    if (r.skipped) bits.push(`${r.skipped} could not be read`);
    toast(`Map “${r.map.name}” imported: ${bits.join(', ')}.`, { type: r.skipped ? 'error' : 'ok', ms: 9000 });
  }
  // remember where the music is, every few seconds, so "Continue" works even after closing the app
  setInterval(() => {
    if (!M.play || M.play.gap || audio.paused || !M.map.progress || M.map.progress.stopId !== M.play.stopId) return;
    M.map.progress.time = audio.currentTime;
    save();
  }, 5000);

  // ---------- playing the map ----------
  // M.play = { stopId, chosen (path id the listener clicked), gap (timer while waiting in a quiet gap), token }
  const playable = (p) => { const s = stopById(p.to); return !!(s && S.byId.get(s.trackId)); };
  const outsOf = (id) => pathsFrom(id).filter(playable);
  function redraw() { if (S.view === 'map') render(); }
  function startMap(stopId, time = 0) {
    const s = stopById(stopId || M.map.startId) || M.map.stops[0];
    if (!s || !S.byId.get(s.trackId)) { toast('Add a song to the map first, then press Play map.'); return; }
    clearTimeout(M.play && M.play.gap);
    M.play = { stopId: s.id, chosen: null, gap: null, token: (M.play ? M.play.token : 0) + 1 };
    M.map.progress = { stopId: s.id, time };
    save();
    playStop(s);
    if (time > 0) { // continue in the middle of the song
      const pl = audio;
      pl.addEventListener('loadedmetadata', () => { if (time < pl.duration - 1) pl.currentTime = time; }, { once: true });
    }
    redraw();
    follow(s);
  }
  function stopPlay() {
    if (!M.play) return;
    clearTimeout(M.play.gap);
    if (M.map.progress && M.map.progress.stopId === M.play.stopId && !M.play.gap && audio.currentTime > 0) { M.map.progress.time = audio.currentTime; save(); }
    M.play = null;
    M.travelPath = null;
    $('#map-dot').hidden = true;
    redraw();
  }
  // The playing song reached its end: pick a path (the listener's choice, or luck) and travel it.
  function onEnded() {
    if (!M.play) return false;
    const outs = outsOf(M.play.stopId);
    if (!outs.length) {
      toast('The map reached an END. The music stops here.');
      stopPlay();
      M.map.progress = null; // finished: next time it starts from the Start song
      save();
      redraw();
      setPlayIcon(false);
      return true;
    }
    const p = outs.find((x) => x.id === M.play.chosen) || outs.find((x) => x.id === M.play.picked) || TFChance.pick(outs);
    const blend = p.blend || { type: 'crossfade', secs: 3 };
    const token = M.play.token;
    const go = () => { if (M.play && M.play.token === token) { M.play.gap = null; startMap(p.to); } };
    if (blend.type === 'silence' && blend.secs > 0) {
      // a quiet gap: the dot travels during it, then the next song starts
      travel(p, blend.secs * 1000);
      M.play.gap = setTimeout(go, blend.secs * 1000);
      M.play.gapGo = go;
      setPlayIcon(true);
    } else {
      travel(p, 700);
      go();
    }
    return true;
  }
  // Crossfade: must start before the song ends, so the two songs overlap. A few times a second we check
  // how much of the playing song is left. Luck picks its path a little early (15 s before the end).
  setInterval(() => {
    if (!M.play || M.play.gap || audio.paused || !(audio.duration > 0)) return;
    const speed = ((S.playFx && S.playFx.speed) || 100) / 100;
    const left = (audio.duration - audio.currentTime) / speed; // seconds you will still hear
    const outs = outsOf(M.play.stopId);
    if (!outs.length) return;
    if (!M.play.picked && left <= 15.5) M.play.picked = TFChance.pick(outs).id;
    if (!M.play.pre && left <= 30) { // get the clean pitch of the songs that may come next ready in time
      M.play.pre = true;
      for (const o of outs) { const s = stopById(o.to); const t = s && S.byId.get(s.trackId); if (t) TFStudio.prefetch(t.id, s.fx || t.fx); }
    }
    const p = outs.find((x) => x.id === M.play.chosen) || outs.find((x) => x.id === M.play.picked);
    const b = p && (p.blend || { type: 'crossfade', secs: 3 });
    if (!b || b.type !== 'crossfade' || !(b.secs > 0)) return;
    const secs = Math.min(b.secs, audio.duration / speed / 2); // never more than half the song
    if (left <= secs && left > 0.15 && beginCrossfade(left)) {
      travel(p, left * 1000);
      startMap(p.to);
    }
  }, 100);
  function skipGap() {
    if (!M.play || !M.play.gap) return false;
    clearTimeout(M.play.gap);
    M.play.gapGo();
    return true;
  }
  // the glowing dot runs along a path
  function travel(p, ms) {
    const dot = $('#map-dot');
    const t0 = performance.now();
    const token = M.play.token;
    M.travelPath = p.id;
    const step = (now) => {
      const f = Math.min(1, (now - t0) / ms);
      const line = S.view === 'map' && world.querySelector(`.mpath[data-id="${p.id}"] .line`);
      if (line && S.settings.mapDot !== false) {
        const q = line.getPointAtLength(line.getTotalLength() * f);
        const v = M.map.view;
        dot.hidden = false;
        dot.style.transform = `translate(${q.x * v.zoom + v.x}px, ${q.y * v.zoom + v.y}px)`;
        dot.style.color = getComputedStyle(line).stroke;
      } else dot.hidden = true;
      if (f < 1 && M.play) requestAnimationFrame(step);
      else { dot.hidden = true; if (M.travelPath === p.id) { M.travelPath = null; redraw(); } }
    };
    requestAnimationFrame(step);
    redraw();
  }
  // keep the playing song in view (glide there if it is near the edge or off screen)
  function follow(s) {
    if (M.noFollow || S.view !== 'map' || drag) return;
    const v = M.map.view, W = board.clientWidth, H = board.clientHeight;
    const sx = s.x * v.zoom + v.x, sy = s.y * v.zoom + v.y;
    const pad = 150;
    if (sx > pad && sx < W - pad && sy > pad && sy < H - pad - 40) return;
    const fromX = v.x, fromY = v.y, toX = W / 2 - s.x * v.zoom, toY = H / 2 - s.y * v.zoom;
    const t0 = performance.now();
    const step = (now) => {
      if (drag) return;
      const f = Math.min(1, (now - t0) / 600), e = 1 - (1 - f) ** 3;
      M.map.view.x = fromX + (toX - fromX) * e;
      M.map.view.y = fromY + (toY - fromY) * e;
      applyView();
      if (f < 1) requestAnimationFrame(step); else save();
    };
    requestAnimationFrame(step);
  }
  function choose(pathId) {
    M.play.chosen = M.play.chosen === pathId ? null : pathId;
    render();
  }
  $('#map-play').addEventListener('click', () => {
    if (M.play) { stopPlay(); pause(); return; }
    const rp = resumePoint();
    if (rp) startMap(rp.stopId, rp.time || 0); else startMap();
  });
  $('#map-restart').addEventListener('click', () => startMap());
  $('#map-follow').addEventListener('click', () => { M.noFollow = !M.noFollow; render(); });

  // ---------- paths ----------
  function newId() { return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join(''); }
  function addPath(fromId, toId, pts) {
    remember(); // each action is its own undo step
    const old = M.map.paths.find((p) => p.from === fromId && p.to === toId);
    if (old) {
      // drawing over an existing path gives it the new shape
      if (pts && pts.length) { old.pts = pts; save(); toast('Path redrawn'); } else toast('These songs are already connected that way. Click the path to select it.');
      return;
    }
    const p = { id: newId(), from: fromId, to: toId, chance: 0, locked: false, blend: { ...(S.settings.mapJoin || { type: 'crossfade', secs: 3 }) }, color: null, style: 'solid', name: '' };
    if (pts && pts.length) p.pts = pts;
    M.map.paths.push(p);
    TFChance.evenSplit(pathsFrom(fromId)); // every path out of this song gets the same share
    save();
  }
  function setPathMode(on) {
    M.pathMode = on;
    M.from = null;
    M.pointer = null;
    M.draw = null;
    render();
  }
  // Turn a hand-drawn line into a path: keep the few points that matter, drop the bits on top of the covers.
  function drawnPoints(a, b, raw) {
    const clear = (q, s) => Math.hypot(q[0] - s.x, q[1] - s.y) > R + 12;
    return Sh.simplifyTo(raw, 14, 14).filter((q) => clear(q, a) && clear(q, b)).map((q) => Sh.toNorm(a, b, q));
  }
  function straighten() {
    const p = M.map.paths.find((x) => x.id === M.selPath);
    if (!p || !p.pts) return;
    const before = snapshot();
    delete p.pts;
    render();
    save();
    undoToast('Path straightened', before);
  }

  // ---------- mouse ----------
  let drag = null;
  board.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const stopEl = e.target.closest('.mstop');
    const pathEl = e.target.closest('.mpath');
    const handle = e.target.closest('.handle');
    if (handle && !M.pathMode) {
      const p = M.map.paths.find((x) => x.id === M.selPath);
      const a = stopById(p.from), b = stopById(p.to);
      const i = +handle.dataset.i;
      if (handle.classList.contains('ghost')) {
        // a faint dot becomes a real point where it sits, then follows the mouse
        p.pts = p.pts || [];
        p.pts.splice(i, 0, Sh.toNorm(a, b, [+handle.getAttribute('cx'), +handle.getAttribute('cy')]));
        render();
      }
      drag = { kind: 'handle', p, a, b, i, moved: false };
      e.preventDefault();
      return;
    }
    if (M.pathMode && stopEl) {
      const id = stopEl.dataset.id;
      if (!M.from) {
        M.from = id;
        M.pointer = toWorld(e.clientX, e.clientY);
        drag = { kind: 'connect', id, raw: [M.pointer], sx: e.clientX, sy: e.clientY, moved: false };
        render();
      } else { addPath(M.from, id); M.from = null; render(); }
      e.preventDefault();
      return;
    }
    if (pathEl && !M.pathMode && M.play && !e.target.closest('.handle')) {
      const lp = M.map.paths.find((x) => x.id === pathEl.dataset.id);
      if (lp && lp.from === M.play.stopId && playable(lp) && M.selPath !== lp.id) { choose(lp.id); e.preventDefault(); return; }
    }
    if (pathEl && !M.pathMode) { selectPath(pathEl.dataset.id); e.preventDefault(); return; }
    if (stopEl) {
      const s = stopById(stopEl.dataset.id);
      if (M.selected !== s.id) select(s.id);
      drag = { kind: 'stop', s, sx: e.clientX, sy: e.clientY, ox: s.x, oy: s.y, moved: false };
    } else {
      if (M.selected || M.selPath) { M.selected = null; M.selPath = null; render(); }
      drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: M.map.view.x, oy: M.map.view.y, moved: false };
      board.classList.add('panning');
    }
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (M.pathMode && M.from) { M.pointer = toWorld(e.clientX, e.clientY); drawLines(); }
    if (!drag) return;
    if (drag.kind === 'connect') {
      // drawing by hand: remember where the mouse has been
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true;
      const last = drag.raw[drag.raw.length - 1];
      if (Math.hypot(M.pointer[0] - last[0], M.pointer[1] - last[1]) > 5) drag.raw.push(M.pointer);
      if (drag.moved) { const first = !M.draw; M.draw = drag.raw; if (first) render(); else drawLines(); }
      return;
    }
    if (drag.kind === 'handle') {
      drag.p.pts[drag.i] = Sh.toNorm(drag.a, drag.b, toWorld(e.clientX, e.clientY));
      drag.moved = true;
      drawLines();
      return;
    }
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (drag.kind === 'stop') {
      drag.s.x = Math.round(drag.ox + dx / M.map.view.zoom);
      drag.s.y = Math.round(drag.oy + dy / M.map.view.zoom);
      const n = world.querySelector(`.mstop[data-id="${drag.s.id}"]`);
      if (n) { n.style.left = `${drag.s.x - R}px`; n.style.top = `${drag.s.y - R}px`; n.classList.add('dragging'); }
      drawLines();
    } else {
      M.map.view.x = drag.ox + dx;
      M.map.view.y = drag.oy + dy;
      applyView();
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (!drag) return;
    if (drag.kind === 'handle') { save(); drag = null; return; }
    if (drag.kind === 'connect') {
      // letting go on a song finishes the drawing; a plain click just picks the first song
      const d = drag;
      drag = null;
      M.draw = null;
      if (!d.moved || M.from !== d.id) { drawLines(); return; }
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const stopEl = target && target.closest && target.closest('.mstop');
      if (!stopEl) { toast('To draw a path, end your line on a song.'); M.from = null; render(); return; }
      const a = stopById(d.id), b = stopById(stopEl.dataset.id);
      const pts = drawnPoints(a, b, d.raw);
      if (a === b && !pts.length) { render(); return; } // a tiny wiggle on one song is not a loop
      addPath(a.id, b.id, pts);
      M.from = null;
      render();
      return;
    }
    if (drag.moved) save();
    else if (drag.kind === 'pan' && M.pathMode && M.from) { M.from = null; render(); } // click on empty space cancels
    const n = drag.kind === 'stop' && world.querySelector(`.mstop[data-id="${drag.s.id}"]`);
    if (n) n.classList.remove('dragging');
    board.classList.remove('panning');
    drag = null;
  });
  board.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = board.getBoundingClientRect();
    zoomAt(M.map.view.zoom * Math.pow(1.0015, -e.deltaY), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  function menu(x, y, items) {
    const m = $('#ctxmenu');
    m.innerHTML = '';
    for (const [label, fn] of items) m.append(h('button', { onclick: () => { m.hidden = true; fn(); } }, label));
    m.hidden = false;
    m.style.left = `${Math.min(x, innerWidth - 210)}px`;
    m.style.top = `${Math.min(y, innerHeight - items.length * 34 - 12)}px`;
  }
  board.addEventListener('contextmenu', (e) => {
    const stopEl = e.target.closest('.mstop');
    const pathEl = e.target.closest('.mpath');
    if (stopEl) {
      e.preventDefault();
      select(stopEl.dataset.id);
      menu(e.clientX, e.clientY, [
        ['Play the map from here', () => startMap(stopEl.dataset.id)],
        ['Use the library settings again', () => {
          const s = stopById(stopEl.dataset.id), t = s && S.byId.get(s.trackId);
          if (!t) return;
          const before = snapshot();
          Object.assign(s.fx, t.fx);
          applyFx(); renderFx(); render(); save();
          undoToast('Sound settings copied from the library', before);
        }],
        ['Set as Start', setStart],
        ['Start a path from here', () => { M.pathMode = true; M.from = stopEl.dataset.id; M.pointer = toWorld(e.clientX, e.clientY); render(); }],
        ['Remove from map', removeSelected],
      ]);
    } else if (pathEl) {
      e.preventDefault();
      selectPath(pathEl.dataset.id);
      const p = M.map.paths.find((x) => x.id === pathEl.dataset.id);
      menu(e.clientX, e.clientY, [...(p && p.pts ? [['Straighten path', straighten]] : []), ['Remove path', removeSelected]]);
    }
  });
  board.addEventListener('dblclick', (e) => {
    const stopEl = e.target.closest('.mstop');
    if (stopEl && !M.pathMode) { startMap(stopEl.dataset.id); return; }
    const handle = e.target.closest('.handle:not(.ghost)');
    const p = handle && M.map.paths.find((x) => x.id === M.selPath);
    if (!p || !p.pts) return;
    p.pts.splice(+handle.dataset.i, 1);
    if (!p.pts.length) delete p.pts;
    render();
    save();
  });
  $('#map-straighten').addEventListener('click', straighten);

  // ---------- actions ----------
  function setStart() {
    if (!M.selected) return;
    remember();
    M.map.startId = M.selected;
    render();
    save();
  }
  function removeSelected() {
    remember();
    if (M.selPath) {
      const p = M.map.paths.find((x) => x.id === M.selPath);
      if (!p) return;
      const before = snapshot();
      M.map.paths = M.map.paths.filter((x) => x !== p);
      TFChance.fillTo100(pathsFrom(p.from)); // the other paths grow back to 100%
      M.selPath = null;
      render();
      save();
      undoToast('Path removed', before);
      return;
    }
    const s = stopById(M.selected);
    if (!s) return;
    const before = snapshot();
    const touched = new Set(M.map.paths.filter((p) => p.to === s.id).map((p) => p.from));
    M.map.stops = M.map.stops.filter((x) => x.id !== s.id);
    M.map.paths = M.map.paths.filter((p) => p.from !== s.id && p.to !== s.id);
    for (const id of touched) TFChance.fillTo100(pathsFrom(id));
    if (M.map.startId === s.id) M.map.startId = M.map.stops[0] ? M.map.stops[0].id : null;
    M.selected = null;
    render();
    save();
    const t = S.byId.get(s.trackId);
    undoToast(`Removed "${t ? t.title : 'song'}" from the map`, before);
  }
  function addTracks(ids) {
    if (!ids.length) return;
    remember();
    const [cx, cy] = toWorld(board.getBoundingClientRect().left + board.clientWidth / 2, board.getBoundingClientRect().top + board.clientHeight / 2);
    const gap = 190, perRow = Math.min(5, ids.length);
    const added = ids.map((trackId, i) => {
      const t = S.byId.get(trackId);
      return {
        id: newId(), trackId,
        x: Math.round(cx + ((i % perRow) - (perRow - 1) / 2) * gap),
        y: Math.round(cy + (Math.floor(i / perRow) - (Math.ceil(ids.length / perRow) - 1) / 2) * gap),
        fx: { ...t.fx }, // the map keeps its own copy of the effects
      };
    });
    M.map.stops.push(...added);
    if (!M.map.startId) M.map.startId = added[0].id;
    M.selected = added[added.length - 1].id;
    M.selPath = null;
    render();
    save();
  }

  // Song picker: search, click to tick, add.
  function openPicker() {
    if (!S.tracks.length) { toast('Your library is empty. Add songs on the 🔍 page first.'); return; }
    const chosen = [];
    modal((box, close) => {
      const q = h('input', { class: 'pick-search', placeholder: 'Search songs', spellcheck: 'false', autofocus: true });
      const grid = h('div', { class: 'pick-grid' });
      const go = h('button', { class: 'btn primary', disabled: true }, 'Add songs');
      const draw = () => {
        const needle = q.value.trim().toLowerCase();
        grid.innerHTML = '';
        for (const t of S.tracks) {
          if (needle && ![t.title, t.artist, t.album, t.genre].some((v) => String(v || '').toLowerCase().includes(needle))) continue;
          const n = chosen.indexOf(t.id);
          grid.append(h('div', { class: `pick${n >= 0 ? ' on' : ''}`, title: [t.title, t.artist].filter(Boolean).join(' — '), onclick: () => {
            const i = chosen.indexOf(t.id);
            if (i >= 0) chosen.splice(i, 1); else chosen.push(t.id);
            draw();
          } }, h('div', { class: 'pick-art' }, coverEl(t), n >= 0 ? h('span', { class: 'pick-n' }, n + 1) : null), h('div', { class: 'pick-name' }, t.title)));
        }
        go.disabled = !chosen.length;
        go.textContent = chosen.length ? `Add ${chosen.length} song${chosen.length > 1 ? 's' : ''}` : 'Add songs';
      };
      q.addEventListener('input', draw);
      go.addEventListener('click', () => { close(); addTracks(chosen); });
      box.append(h('h2', {}, 'Add songs to the map'), q, grid,
        h('div', { class: 'foot' }, h('span', { class: 'muted' }, 'Click songs to pick them. They are added in the order you pick.'), h('button', { class: 'btn', onclick: () => close() }, 'Cancel'), go));
      draw();
    });
  }

  // Background picker: the 20 built-in tiles, your own pictures, and the song-name color.
  function openBackgrounds() {
    const before = JSON.stringify({ bg: M.map.bg, names: M.map.names, c: M.map.customBgs });
    M.map.customBgs = M.map.customBgs || []; // pictures you added to this map (kept for export)
    modal((box, close) => {
      const grid = h('div', { class: 'bg-grid' });
      const sw = (t) => ({ backgroundColor: t.color, backgroundImage: t.url, backgroundSize: `${Math.round(t.W * (t.W > 250 ? 0.42 : 0.7))}px ${Math.round(t.H * (t.W > 250 ? 0.42 : 0.7))}px` });
      const isOn = (bg) => (bg.kind === 'custom' ? M.map.bg.file === bg.file : M.map.bg.kind !== 'custom' && M.map.bg.id === bg.id);
      const choose = (bg) => { M.map.bg = bg; applyView(); render(); draw(); };
      const draw = () => {
        grid.innerHTML = '';
        for (const b of BG.list) {
          const bg = { kind: 'builtin', id: b.id };
          grid.append(h('div', { class: `bg-card${isOn(bg) ? ' on' : ''}`, onclick: () => choose(bg), title: b.name },
            h('div', { class: 'bg-sw', style: sw(bgTile(bg)) }), h('div', { class: 'bg-name' }, b.name)));
        }
        for (const c of M.map.customBgs) {
          const bg = { kind: 'custom', file: c.file, w: c.w, h: c.h };
          grid.append(h('div', { class: `bg-card${isOn(bg) ? ' on' : ''}`, onclick: () => choose(bg), title: c.label },
            h('div', { class: 'bg-sw', style: sw(bgTile(bg)) }), h('div', { class: 'bg-name' }, `★ ${c.label}`),
            h('button', { class: 'bg-x', html: ICONS.close, title: 'Take this picture out of this map', onclick: (e) => {
              e.stopPropagation();
              M.map.customBgs = M.map.customBgs.filter((x) => x !== c);
              if (isOn(bg)) M.map.bg = { kind: 'builtin', id: 'dots' };
              applyView(); render(); draw();
            } })));
        }
        grid.append(h('div', { class: 'bg-card add', onclick: addPicture, title: 'Use your own picture. It repeats like tiles and is saved inside the map.' },
          h('div', { class: 'bg-sw plus', html: ICONS.plus }), h('div', { class: 'bg-name' }, 'Add my picture')));
        for (const b of $$('.nm', box)) b.classList.toggle('on', (M.map.names || { mode: 'auto' }).mode === b.dataset.mode);
      };
      async function addPicture() {
        const img = await guard(() => tf.pickImage());
        if (!img) return;
        const got = await guard(() => tf.mapBgAdd(M.map.id, img), 'Picture: ');
        if (!got) return;
        M.map.customBgs.push(got);
        choose({ kind: 'custom', file: got.file, w: got.w, h: got.h });
      }
      const setNames = (mode, color) => { M.map.names = { mode, color: color || (M.map.names && M.map.names.color) || '#ffffff' }; render(); draw(); };
      const picker = h('input', { type: 'color', value: (M.map.names && M.map.names.color) || '#ffffff', title: 'Pick any color' });
      picker.addEventListener('input', () => setNames('custom', picker.value));
      const names = h('div', { class: 'row names-row' }, h('b', {}, 'Song names:'),
        ...[['auto', 'Auto'], ['light', 'White'], ['dark', 'Dark']].map(([m, l]) => h('button', { class: 'btn nm', 'data-mode': m, onclick: () => setNames(m) }, l)),
        h('label', { class: 'btn nm', 'data-mode': 'custom' }, 'Color ', picker));
      box.classList.add('wide');
      box.append(h('h2', {}, 'Map background'), grid, names,
        h('p', { class: 'muted' }, 'Auto = dark names on light backgrounds, white names on dark ones. Your pictures repeat like tiles and are saved inside this map.'),
        h('div', { class: 'foot' }, h('span', { class: 'muted' }), h('button', { class: 'btn primary', onclick: () => close() }, 'Done')));
      draw();
    }).then(() => { if (JSON.stringify({ bg: M.map.bg, names: M.map.names, c: M.map.customBgs }) !== before) save(); });
  }
  $('#map-bg').addEventListener('click', openBackgrounds);
  $('#map-add').addEventListener('click', openPicker);
  $('#map-path').addEventListener('click', () => setPathMode(!M.pathMode));
  $('#map-start').addEventListener('click', setStart);
  $('#map-remove').addEventListener('click', removeSelected);
  $('#map-fit').addEventListener('click', fit);
  $('#map-zoom').addEventListener('input', (e) => zoomCenter(+e.target.value / 100));
  $('#map-zoom-in').addEventListener('click', () => zoomCenter(M.map.view.zoom * 1.2));
  $('#map-zoom-out').addEventListener('click', () => zoomCenter(M.map.view.zoom / 1.2));
  // keys: see renderer/shortcuts.js

  // ---------- open ----------
  // Loads the map the first time the page opens. Called twice at once? Both wait for the same loading.
  function load() {
    if (!M.loading) {
      M.loading = (async () => {
        const list = await guard(() => tf.mapsList());
        const last = list && (list.find((m) => m.id === S.settings.lastMapId) || list[0]); // the map that was open last time
        const m = !list ? null : last ? await guard(() => tf.mapGet(last.id)) : await guard(() => tf.mapCreate('My first map'));
        if (!m) { M.loading = null; return false; }
        assetUrl = await tf.mapAssetUrl();
        M.map = m;
        M.map.bg = M.map.bg || { kind: 'builtin', id: 'dots' };
        if (!M.map.stops.length) M.map.view = { x: board.clientWidth / 2, y: board.clientHeight / 2, zoom: 1 };
        M.noFollow = S.settings.mapFollow === false;
        resetHistory();
        return true;
      })();
    }
    return M.loading;
  }
  async function show() {
    if (!(await load())) return;
    applyView();
    render();
  }
  for (const [sel, name] of [['#map-zoom-in', 'zoomIn'], ['#map-zoom-out', 'zoomOut']]) $(sel).innerHTML = ICONS[name];
  for (const n of $$('#map-toolbar .ic')) n.innerHTML = ICONS[n.dataset.icon];

  // Same loudness for this map: each map song has its own copy of the sound settings, so only the map changes.
  $('#map-loud').addEventListener('click', () => {
    const stops = M.map.stops.filter((s) => S.byId.get(s.trackId));
    sameLoudness(stops.map((s) => s.trackId), 'on this map', async (volumes) => {
      const before = {};
      for (const s of stops) {
        if (!(s.trackId in volumes)) continue;
        if (!s.fx) s.fx = { ...S.byId.get(s.trackId).fx };
        before[s.id] = s.fx.volume;
        s.fx.volume = volumes[s.trackId];
      }
      save(); render(); applyFx(); renderFx();
      return () => { for (const s of M.map.stops) if (s.id in before) s.fx.volume = before[s.id]; save(); render(); applyFx(); renderFx(); toast('Volumes are back as they were.', { ms: 2500 }); };
    }, 'Only the songs on this map change; the same songs in your library keep their own Volume. ');
  });

  // Actions the keyboard shortcuts can run (Settings → Keyboard).
  const actions = {
    playStop: () => $('#map-play').click(),
    chooseNumber: (n) => {
      if (!M.play) return false;
      const p = outsOf(M.play.stopId)[n - 1];
      if (!p) return false;
      choose(p.id);
      return true;
    },
    pathTool: () => setPathMode(!M.pathMode),
    addSongs: () => openPicker(),
    setStart: () => setStart(),
    lock: () => {
      const p = M.map.paths.find((x) => x.id === M.selPath);
      if (!p) { toast('Click a path first, then press L to lock it.'); return; }
      remember();
      p.locked = !p.locked;
      render();
      save();
      toast(p.locked ? 'Path locked 🔒' : 'Path unlocked', { ms: 1500 });
    },
    background: () => openBackgrounds(),
    fit: () => fit(),
    remove: () => removeSelected(),
    maps: () => openMaps(),
    undo: () => undoRedo(-1),
    redo: () => undoRedo(1),
    escape: () => {
      if (M.from) { M.from = null; render(); } else if (M.pathMode) setPathMode(false); else if (M.selected || M.selPath) { M.selected = null; M.selPath = null; render(); } else return false;
      return true;
    },
    refresh: () => { if (M.map) { M.noFollow = S.settings.mapFollow === false; render(); } },
    continueIfAny: () => { if (!M.play && resumePoint()) $('#map-play').click(); },
  };
  window.TFMap = { show, onEnded, stopPlay, skipGap, importMapFile, actions, get map() { return M.map; }, get playing() { return M.play; } };
})();
