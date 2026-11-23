'use strict';
/* global S, h, $, $$, coverEl, ICONS, modal, guard, toast, tf */
// The Map page: songs placed on a board. (Paths and playing come in later steps.)
(function () {
  const M = { map: null, selected: null, loaded: false, saveTimer: null };
  const board = $('#map-board');
  const world = $('#map-world');
  const STOP = 96; // cover size in world pixels
  const ZMIN = 0.3, ZMAX = 2.5;

  // ---------- saving ----------
  function save() {
    clearTimeout(M.saveTimer);
    M.saveTimer = setTimeout(() => { if (M.map) tf.mapSave(M.map).catch((e) => toast(`Map not saved: ${e.message}`, { type: 'error' })); }, 400);
  }

  // ---------- view (move + zoom) ----------
  function applyView() {
    const v = M.map.view;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
    // grid dots move with the map, so moving around feels real
    board.style.backgroundPosition = `${v.x}px ${v.y}px`;
    board.style.backgroundSize = `${40 * v.zoom}px ${40 * v.zoom}px`;
    const z = $('#map-zoom');
    z.value = Math.round(v.zoom * 100);
    z.style.setProperty('--pct', `${((v.zoom * 100 - 30) / 220) * 100}%`);
  }
  function zoomAt(newZoom, cx, cy) {
    const v = M.map.view;
    const z = Math.min(ZMAX, Math.max(ZMIN, newZoom));
    // keep the point under the mouse in the same place
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
    const pad = 110;
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad + 30;
    const z = Math.min(ZMAX, Math.max(ZMIN, Math.min(board.clientWidth / (maxX - minX), board.clientHeight / (maxY - minY), 1.4)));
    M.map.view = { zoom: z, x: board.clientWidth / 2 - ((minX + maxX) / 2) * z, y: board.clientHeight / 2 - ((minY + maxY) / 2) * z };
    applyView();
    save();
  }
  const toWorld = (sx, sy) => { const v = M.map.view; return [(sx - v.x) / v.zoom, (sy - v.y) / v.zoom]; };

  // ---------- drawing ----------
  function render() {
    world.innerHTML = '';
    for (const s of M.map.stops) {
      const t = S.byId.get(s.trackId);
      const el = h('div', {
        class: `mstop${s.id === M.selected ? ' selected' : ''}${s.id === M.map.startId ? ' start' : ''}${t ? '' : ' missing'}`,
        'data-id': s.id, style: { left: `${s.x - STOP / 2}px`, top: `${s.y - STOP / 2}px` },
        title: t ? [t.title, t.artist].filter(Boolean).join(' — ') : 'This song was removed from your library',
      },
      h('div', { class: 'mart' }, coverEl(t || { title: 'Missing song' })),
      h('div', { class: 'mname' }, t ? t.title : 'Missing song'),
      s.id === M.map.startId ? h('div', { class: 'mflag', html: ICONS.flag, title: 'Start' }) : null);
      world.append(el);
    }
    $('#map-empty').hidden = M.map.stops.length > 0;
    $('#map-name').textContent = M.map.name;
    $('#map-start').disabled = !M.selected || M.selected === M.map.startId;
    $('#map-remove').disabled = !M.selected;
  }
  function select(id) { M.selected = id; render(); }

  // ---------- mouse: drag songs, move the map ----------
  let drag = null;
  board.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const stopEl = e.target.closest('.mstop');
    if (stopEl) {
      const s = M.map.stops.find((x) => x.id === stopEl.dataset.id);
      if (M.selected !== s.id) select(s.id);
      drag = { kind: 'stop', s, sx: e.clientX, sy: e.clientY, ox: s.x, oy: s.y, moved: false };
    } else {
      if (M.selected) select(null);
      drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: M.map.view.x, oy: M.map.view.y, moved: false };
      board.classList.add('panning');
    }
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (drag.kind === 'stop') {
      drag.s.x = Math.round(drag.ox + dx / M.map.view.zoom);
      drag.s.y = Math.round(drag.oy + dy / M.map.view.zoom);
      const el = world.querySelector(`.mstop[data-id="${drag.s.id}"]`);
      if (el) { el.style.left = `${drag.s.x - STOP / 2}px`; el.style.top = `${drag.s.y - STOP / 2}px`; el.classList.add('dragging'); }
    } else {
      M.map.view.x = drag.ox + dx;
      M.map.view.y = drag.oy + dy;
      applyView();
    }
  });
  window.addEventListener('mouseup', () => {
    if (!drag) return;
    if (drag.moved) save();
    const el = drag.kind === 'stop' && world.querySelector(`.mstop[data-id="${drag.s.id}"]`);
    if (el) el.classList.remove('dragging');
    board.classList.remove('panning');
    drag = null;
  });
  board.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = board.getBoundingClientRect();
    zoomAt(M.map.view.zoom * Math.pow(1.0015, -e.deltaY), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  board.addEventListener('contextmenu', (e) => {
    const stopEl = e.target.closest('.mstop');
    if (!stopEl) return;
    e.preventDefault();
    select(stopEl.dataset.id);
    const m = $('#ctxmenu');
    m.innerHTML = '';
    m.append(
      h('button', { onclick: () => { m.hidden = true; setStart(); } }, 'Set as Start'),
      h('button', { onclick: () => { m.hidden = true; removeSelected(); } }, 'Remove from map'),
    );
    m.hidden = false;
    m.style.left = `${Math.min(e.clientX, innerWidth - 200)}px`;
    m.style.top = `${Math.min(e.clientY, innerHeight - 90)}px`;
  });

  // ---------- actions ----------
  function setStart() {
    if (!M.selected) return;
    M.map.startId = M.selected;
    render();
    save();
  }
  function removeSelected() {
    const s = M.map.stops.find((x) => x.id === M.selected);
    if (!s) return;
    const before = JSON.parse(JSON.stringify(M.map));
    M.map.stops = M.map.stops.filter((x) => x.id !== s.id);
    M.map.paths = M.map.paths.filter((p) => p.from !== s.id && p.to !== s.id);
    if (M.map.startId === s.id) M.map.startId = M.map.stops[0] ? M.map.stops[0].id : null;
    M.selected = null;
    render();
    save();
    const t = S.byId.get(s.trackId);
    toast(`Removed "${t ? t.title : 'song'}" from the map`, { action: () => { M.map = before; render(); applyView(); save(); }, actionLabel: 'Undo' });
  }
  function newId() { return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join(''); }
  function addTracks(ids) {
    if (!ids.length) return;
    // place new songs in a neat row in the middle of what you can see
    const [cx, cy] = toWorld(board.clientWidth / 2, board.clientHeight / 2);
    const gap = 170, perRow = Math.min(5, ids.length);
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
  $('#map-start').addEventListener('click', setStart);
  $('#map-remove').addEventListener('click', removeSelected);
  $('#map-fit').addEventListener('click', fit);
  $('#map-zoom').addEventListener('input', (e) => zoomCenter(+e.target.value / 100));
  $('#map-zoom-in').addEventListener('click', () => zoomCenter(M.map.view.zoom * 1.2));
  $('#map-zoom-out').addEventListener('click', () => zoomCenter(M.map.view.zoom / 1.2));
  document.addEventListener('keydown', (e) => {
    if (S.view !== 'map' || !M.map || $('.modal-back')) return;
    if (e.target.closest('input, textarea, select') && e.target.type !== 'range') return;
    const k = e.key.toLowerCase();
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
    else if (k === 's' && !e.ctrlKey && !e.metaKey) setStart();
    else if (k === 'f' && !e.ctrlKey && !e.metaKey) fit();
    else if (e.key === 'Escape') select(null);
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
  for (const el of $$('#map-toolbar .ic')) el.innerHTML = ICONS[el.dataset.icon];

  window.TFMap = { show, get map() { return M.map; } };
})();
