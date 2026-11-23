'use strict';
/* global S, h, $, $$, coverEl, ICONS, modal, guard, toast, tf, TFChance */
// The Map page: songs on a board, connected by paths. (Path settings and playing come in later steps.)
(function () {
  const M = {
    map: null, loaded: false, saveTimer: null,
    selected: null, // selected song stop id
    selPath: null, // selected path id
    pathMode: false, // Path button is on
    from: null, // in Path mode: the song a new path starts from
    pointer: null, // mouse position in map coordinates (for the line that follows the mouse)
  };
  const board = $('#map-board');
  const world = $('#map-world');
  const STOP = 96; // cover size in map pixels
  const R = STOP / 2;
  const ZMIN = 0.3, ZMAX = 2.5;
  const SVGNS = 'http://www.w3.org/2000/svg';

  // ---------- saving ----------
  function save() {
    clearTimeout(M.saveTimer);
    M.saveTimer = setTimeout(() => { if (M.map) tf.mapSave(M.map).catch((e) => toast(`Map not saved: ${e.message}`, { type: 'error' })); }, 400);
  }
  const snapshot = () => JSON.parse(JSON.stringify(M.map));
  function undoToast(msg, before) {
    toast(msg, { action: () => { M.map = before; M.selected = null; M.selPath = null; render(); applyView(); save(); }, actionLabel: 'Undo' });
  }

  // ---------- view (move + zoom) ----------
  function applyView() {
    const v = M.map.view;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
    board.style.backgroundPosition = `${v.x}px ${v.y}px`;
    board.style.backgroundSize = `${40 * v.zoom}px ${40 * v.zoom}px`;
    const z = $('#map-zoom');
    z.value = Math.round(v.zoom * 100);
    z.style.setProperty('--pct', `${((v.zoom * 100 - 30) / 220) * 100}%`);
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
  const el = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

  // ---------- drawing ----------
  function drawLines() {
    let svg = world.querySelector('svg.mlines');
    if (!svg) { svg = el('svg', { class: 'mlines', width: 1, height: 1 }); world.prepend(svg); }
    svg.innerHTML = '';
    for (const p of M.map.paths) {
      const a = stopById(p.from), b = stopById(p.to);
      if (!a || !b) continue;
      const c = curve(a, b);
      const w = 2.5 + (p.chance / 100) * 6; // thick line = likely path
      const g = el('g', { class: `mpath${p.id === M.selPath ? ' selected' : ''}`, 'data-id': p.id, style: `color:${p.color || '#e3923a'}` });
      g.append(
        el('path', { d: c.d, class: 'hit' }),
        el('path', { d: c.d, class: 'line', 'stroke-width': w }),
        el('polygon', { points: arrowHead(c.end, c.dir, 5 + w * 0.6), class: 'head' }),
      );
      const label = `${p.chance}%`;
      const lw = 12 + label.length * 8;
      g.append(el('rect', { x: c.mid[0] - lw / 2, y: c.mid[1] - 11, width: lw, height: 22, rx: 11, class: 'pill' }));
      const t = el('text', { x: c.mid[0], y: c.mid[1] + 5, class: 'pct' });
      t.textContent = label;
      g.append(t);
      svg.append(g);
    }
    // the line that follows the mouse while you pick the second song
    if (M.pathMode && M.from && M.pointer) {
      const a = stopById(M.from);
      if (a) svg.append(el('line', { x1: a.x, y1: a.y, x2: M.pointer[0], y2: M.pointer[1], class: 'rubber' }));
    }
  }

  function render() {
    world.querySelectorAll('.mstop').forEach((n) => n.remove());
    for (const s of M.map.stops) {
      const t = S.byId.get(s.trackId);
      const outs = pathsFrom(s.id).length;
      world.append(h('div', {
        class: `mstop${s.id === M.selected ? ' selected' : ''}${s.id === M.map.startId ? ' start' : ''}${s.id === M.from ? ' from' : ''}${t ? '' : ' missing'}`,
        'data-id': s.id, style: { left: `${s.x - R}px`, top: `${s.y - R}px` },
        title: t ? [t.title, t.artist].filter(Boolean).join(' — ') : 'This song was removed from your library',
      },
      h('div', { class: 'mart' }, coverEl(t || { title: 'Missing song' })),
      h('div', { class: 'mname' }, t ? t.title : 'Missing song'),
      s.id === M.map.startId ? h('div', { class: 'mflag', html: ICONS.flag, title: 'Start' }) : null,
      outs === 0 && M.map.paths.length ? h('div', { class: 'mend', title: 'No paths out: the music stops here' }, 'END') : null));
    }
    drawLines();
    $('#map-empty').hidden = M.map.stops.length > 0;
    $('#map-name').textContent = M.map.name;
    $('#map-start').disabled = !M.selected || M.selected === M.map.startId;
    $('#map-remove').disabled = !M.selected && !M.selPath;
    $('#map-path').classList.toggle('on', M.pathMode);
    board.classList.toggle('path-mode', M.pathMode);
    const hint = $('#map-hint');
    hint.hidden = !M.pathMode;
    hint.textContent = !M.from ? 'Path: click the song the path starts from' : 'Now click the song it goes to (click the same song for a loop) · Esc to cancel';
  }
  function select(id) { M.selected = id; M.selPath = null; render(); }
  function selectPath(id) { M.selPath = id; M.selected = null; render(); }

  // ---------- paths ----------
  function newId() { return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join(''); }
  function addPath(fromId, toId) {
    if (M.map.paths.some((p) => p.from === fromId && p.to === toId)) {
      toast('These songs are already connected that way. Click the path to select it.');
      return;
    }
    const p = { id: newId(), from: fromId, to: toId, chance: 0, locked: false, blend: { type: 'crossfade', secs: 3 }, color: '#e3923a', style: 'solid', name: '' };
    M.map.paths.push(p);
    TFChance.evenSplit(pathsFrom(fromId)); // every path out of this song gets the same share
    save();
  }
  function setPathMode(on) {
    M.pathMode = on;
    M.from = null;
    M.pointer = null;
    render();
  }

  // ---------- mouse ----------
  let drag = null;
  board.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const stopEl = e.target.closest('.mstop');
    const pathEl = e.target.closest('.mpath');
    if (M.pathMode && stopEl) {
      const id = stopEl.dataset.id;
      if (!M.from) { M.from = id; M.pointer = toWorld(e.clientX, e.clientY); render(); drag = { kind: 'connect', id }; }
      else { addPath(M.from, id); M.from = null; render(); }
      e.preventDefault();
      return;
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
    if (drag.kind === 'connect') return;
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
    if (drag.kind === 'connect') {
      // dragging from one song and letting go on another also makes a path
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const stopEl = target && target.closest && target.closest('.mstop');
      if (stopEl && stopEl.dataset.id !== drag.id && M.from === drag.id) { addPath(M.from, stopEl.dataset.id); M.from = null; render(); }
      drag = null;
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
        ['Set as Start', setStart],
        ['Start a path from here', () => { M.pathMode = true; M.from = stopEl.dataset.id; M.pointer = toWorld(e.clientX, e.clientY); render(); }],
        ['Remove from map', removeSelected],
      ]);
    } else if (pathEl) {
      e.preventDefault();
      selectPath(pathEl.dataset.id);
      menu(e.clientX, e.clientY, [['Remove path', removeSelected]]);
    }
  });

  // ---------- actions ----------
  function setStart() {
    if (!M.selected) return;
    M.map.startId = M.selected;
    render();
    save();
  }
  function removeSelected() {
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

  $('#map-add').addEventListener('click', openPicker);
  $('#map-path').addEventListener('click', () => setPathMode(!M.pathMode));
  $('#map-start').addEventListener('click', setStart);
  $('#map-remove').addEventListener('click', removeSelected);
  $('#map-fit').addEventListener('click', fit);
  $('#map-zoom').addEventListener('input', (e) => zoomCenter(+e.target.value / 100));
  $('#map-zoom-in').addEventListener('click', () => zoomCenter(M.map.view.zoom * 1.2));
  $('#map-zoom-out').addEventListener('click', () => zoomCenter(M.map.view.zoom / 1.2));
  document.addEventListener('keydown', (e) => {
    if (S.view !== 'map' || !M.map || $('.modal-back')) return;
    if (e.target.closest('input, textarea, select') && e.target.type !== 'range') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
    else if (k === 'p') setPathMode(!M.pathMode);
    else if (k === 's') setStart();
    else if (k === 'f') fit();
    else if (e.key === 'Escape') {
      if (M.from) { M.from = null; render(); } else if (M.pathMode) setPathMode(false); else { M.selected = null; M.selPath = null; render(); }
    }
  });

  // ---------- open ----------
  async function show() {
    if (!M.loaded) {
      M.loaded = true;
      const list = await guard(() => tf.mapsList());
      if (!list) { M.loaded = false; return; }
      M.map = list.length ? await guard(() => tf.mapGet(list[0].id)) : await guard(() => tf.mapCreate('My first map'));
      if (!M.map) { M.loaded = false; return; }
      if (!M.map.stops.length) M.map.view = { x: board.clientWidth / 2, y: board.clientHeight / 2, zoom: 1 };
    }
    applyView();
    render();
  }
  for (const [sel, name] of [['#map-zoom-in', 'zoomIn'], ['#map-zoom-out', 'zoomOut']]) $(sel).innerHTML = ICONS[name];
  for (const n of $$('#map-toolbar .ic')) n.innerHTML = ICONS[n.dataset.icon];

  window.TFMap = { show, get map() { return M.map; } };
})();
