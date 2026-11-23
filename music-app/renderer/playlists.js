'use strict';
/* global S, h, $, tf, guard, toast, coverEl, placeholder, fmtTime, modal, confirmModal, loadTrack, upsertTrack, renderGrid, ICONS, TFShuffle, startShuffle, setMark, openAlbumModal */
// Playlists: a tab in the Library. Each playlist keeps its songs in your order. Songs get in by
// right-click → Add to playlist, by dragging song cards onto a playlist, or with "Add files".
window.TFPlaylists = (() => {
  const P = { list: [], openId: null, dragIds: null };
  const byId = (id) => P.list.find((p) => p.id === id);
  const songs = (p) => p.trackIds.map((id) => S.byId.get(id)).filter(Boolean);
  const view = () => $('#pl-view');

  function setAll(list) { P.list = list || []; if (!byId(P.openId)) P.openId = P.list[0] ? P.list[0].id : null; }
  function replace(p) { const i = P.list.findIndex((x) => x.id === p.id); if (i >= 0) P.list[i] = p; else P.list.push(p); }
  function plCover(p, cls = '') {
    if (p.coverUrl) return h('div', { class: `cover-box ${cls}`, style: { width: '100%', height: '100%' } }, h('img', { class: 'cover-img', src: p.coverUrl, alt: '', draggable: 'false' }));
    const first = songs(p)[0];
    return first ? coverEl(first, cls) : placeholder({ title: p.name });
  }
  const totalTime = (p) => songs(p).reduce((s, t) => s + (t.duration || 0) / ((t.fx && t.fx.speed ? t.fx.speed : 100) / 100), 0);

  // ---------- changes (saved right away) ----------
  async function save(p, patch) {
    const r = await guard(() => tf.playlistUpdate(p.id, patch));
    if (r) { replace(r); render(); }
    return r;
  }
  async function create(trackIds = []) {
    const name = await askName('New playlist', '', 'Create');
    if (name === undefined) return null;
    const p = await guard(() => tf.playlistCreate(name, trackIds));
    if (!p) return null;
    P.list.push(p);
    P.openId = p.id;
    render();
    toast(`Playlist "${p.name}" made${trackIds.length ? ` with ${trackIds.length} song${trackIds.length === 1 ? '' : 's'}` : ''}`, { type: 'ok' });
    return p;
  }
  async function addTo(p, ids) {
    const before = new Set(p.trackIds);
    const fresh = ids.filter((id) => !before.has(id));
    if (!fresh.length) { toast(`Already in "${p.name}"`, { ms: 2000 }); return; }
    const r = await save(p, { trackIds: [...p.trackIds, ...fresh] });
    if (r) toast(`Added ${fresh.length} song${fresh.length === 1 ? '' : 's'} to "${r.name}"${ids.length > fresh.length ? ` (${ids.length - fresh.length} already there)` : ''}`, { type: 'ok', ms: 2500 });
  }
  function askName(title, value, okLabel) {
    return modal((box, close) => {
      box.style.width = 'min(440px, 94vw)';
      const inp = h('input', { value, placeholder: 'Playlist name', spellcheck: 'false', autofocus: true, maxlength: 120 });
      const ok = () => close(inp.value.trim() || 'New playlist');
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
      box.append(h('h2', {}, title), h('label', { class: 'field' }, 'Name', inp),
        h('div', { class: 'foot' }, h('span'), h('button', { class: 'btn', onclick: () => close(undefined) }, 'Cancel'), h('button', { class: 'btn primary', onclick: ok }, okLabel)));
    });
  }
  // "Add to playlist" window from the right-click menu
  function pickFor(ids) {
    return modal((box, close) => {
      box.style.width = 'min(460px, 94vw)';
      const list = h('div', { class: 'pl-pick' });
      for (const p of P.list) {
        list.append(h('button', { class: 'pl-pick-row', onclick: () => { close(); addTo(p, ids); } },
          h('div', { class: 'pl-mini' }, plCover(p)), h('span', { class: 't' }, p.name), h('span', { class: 'muted' }, `${p.trackIds.length} song${p.trackIds.length === 1 ? '' : 's'}`)));
      }
      box.append(h('h2', {}, `Add ${ids.length === 1 ? `"${S.byId.get(ids[0]).title}"` : `${ids.length} songs`} to…`),
        P.list.length ? list : h('p', { class: 'muted' }, 'No playlists yet.'),
        h('div', { class: 'foot' }, h('span'), h('button', { class: 'btn', onclick: () => close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => { close(); create(ids); } }, '+ New playlist')));
    });
  }

  // ---------- playing ----------
  function play(p, startId = null) {
    const list = songs(p);
    let ids = list.map((t) => t.id);
    if (!ids.length) { toast('This playlist is empty. Add some songs first.'); return; }
    if (p.shuffle) { // smart shuffle: weighted luck, the list itself stays as it is
      const first = startId || TFShuffle.pick(list, [], S.playClock || 0).id;
      startShuffle(ids, first); // (sets the place in the order too)
      ids = S.queue;
    } else {
      S.shufflePool = null;
      if (startId) ids = ids.slice(ids.indexOf(startId));
      S.queue = ids;
      S.qPos = -1;
    }
    S.playlistId = p.id;
    loadTrack(ids[0], { autoplay: true, keepQueue: true });
    render();
  }

  // ---------- drawing ----------
  function render() {
    const v = view();
    if (!v || S.libTab !== 'playlists') return;
    if (P.rowDrag) { P.redraw = true; return; } // never redraw under a row that is being dragged
    v.innerHTML = '';
    const side = h('div', { class: 'pl-side' },
      h('button', { class: 'tb pri pl-new', onclick: () => create() }, '+ New playlist'));
    for (const p of P.list) {
      const row = h('div', { class: `pl-item${p.id === P.openId ? ' on' : ''}${p.id === S.playlistId ? ' playing' : ''}`, 'data-id': p.id, onclick: () => { P.openId = p.id; render(); } },
        h('div', { class: 'pl-mini' }, plCover(p)),
        h('div', { class: 'pl-item-t' }, h('b', {}, p.name), h('span', {}, `${p.trackIds.length} song${p.trackIds.length === 1 ? '' : 's'}`)));
      dropTarget(row, p);
      side.append(row);
    }
    if (!P.list.length) side.append(h('p', { class: 'pl-none' }, 'No playlists yet.'));
    const p = byId(P.openId);
    v.append(side, p ? detail(p) : h('div', { class: 'pl-detail pl-empty' },
      h('div', {}, h('b', {}, 'Make your first playlist'), h('p', {}, 'Press "+ New playlist". Then add songs: right-click songs in All → Add to playlist, drag song cards onto a playlist, or use Add files.'))));
  }
  function detail(p) {
    const list = songs(p);
    const art = h('div', { class: 'pl-art', title: 'Click to choose a picture' }, plCover(p), h('span', { class: 'sv-art-tip' }, p.cover ? 'Change picture' : 'Choose a picture'));
    art.addEventListener('click', async () => {
      const img = await guard(() => tf.pickImage());
      if (!img) return;
      const r = await guard(() => tf.playlistCover(p.id, img), 'Picture: ');
      if (r) { replace(r); render(); }
    });
    const title = h('h2', { class: 'pl-title', title: 'Click to rename' }, p.name);
    title.addEventListener('click', async () => { const n = await askName('Rename playlist', p.name, 'Rename'); if (n !== undefined) save(p, { name: n }); });
    const head = h('div', { class: 'pl-head' }, art,
      h('div', { class: 'pl-info' },
        h('div', { class: 'pl-kind' }, 'Playlist'), title,
        h('div', { class: 'pl-meta' }, `${list.length} song${list.length === 1 ? '' : 's'} · ${fmtTime(totalTime(p))}`),
        h('div', { class: 'pl-btns' },
          h('button', { class: 'tb pri', onclick: () => play(p), html: `${ICONS.play}<span>Play</span>` }),
          h('button', { class: `tb pl-shuffle${p.shuffle ? ' on' : ''}`, title: 'Smart shuffle: random order, songs played a lot come less often, ♥ more, 🚫 much less (the list stays as it is)', onclick: () => save(p, { shuffle: !p.shuffle }) }, `🔀 Shuffle ${p.shuffle ? 'on' : 'off'}`)),
        h('div', { class: 'pl-btns pl-btns2' },
          h('button', { class: 'tb', title: 'Add music or video files from your PC to this playlist', onclick: () => addFiles(p) }, '📂 Add files'),
          h('button', { class: 'tb', title: 'Save the whole playlist: one file per song, or one big file', onclick: () => openAlbumModal(songs(p).map((t) => t.id), { playlist: p }) }, '💾 Save'),
          h('button', { class: 'tb danger', title: 'Delete this playlist (the songs stay in your library)', onclick: () => remove(p) }, '🗑 Delete'))));
    dropTarget(head, p);
    const rows = h('div', { class: 'pl-rows' });
    list.forEach((t, i) => {
      const row = h('div', { class: `pl-row${t.id === S.currentId && S.playlistId === p.id ? ' playing' : ''}`, draggable: 'true', 'data-id': t.id, title: 'Drag to change the order · double-click to play' },
        h('span', { class: 'pl-grip' }, '⋮⋮'), h('span', { class: 'n' }, i + 1),
        h('div', { class: 'pl-mini' }, coverEl(t)),
        h('div', { class: 'pl-row-t' }, h('b', {}, t.title), h('span', {}, t.artist || 'Unknown artist')),
        markEl(t, list.length),
        h('span', { class: 'pl-len' }, fmtTime((t.duration || 0) / ((t.fx.speed || 100) / 100))),
        h('button', { class: 'pl-x', title: 'Take out of this playlist (stays in your library)', html: ICONS.close, onclick: (e) => { e.stopPropagation(); save(p, { trackIds: p.trackIds.filter((x) => x !== t.id) }); } }));
      row.addEventListener('dblclick', () => play(p, t.id));
      row.addEventListener('dragstart', (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-tonix-row', t.id); row.classList.add('dragging'); P.rowDrag = true; });
      row.addEventListener('dragend', () => { row.classList.remove('dragging'); P.rowDrag = false; if (P.redraw) { P.redraw = false; render(); } });
      row.addEventListener('dragover', (e) => {
        if (![...e.dataTransfer.types].includes('application/x-tonix-row')) return;
        e.preventDefault();
        const r = row.getBoundingClientRect();
        row.classList.toggle('drop-before', e.clientY < r.top + r.height / 2);
        row.classList.toggle('drop-after', e.clientY >= r.top + r.height / 2);
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after'));
      row.addEventListener('drop', (e) => {
        const moving = e.dataTransfer.getData('application/x-tonix-row');
        if (!moving) return;
        e.preventDefault(); e.stopPropagation();
        P.rowDrag = false;
        const after = row.classList.contains('drop-after');
        row.classList.remove('drop-before', 'drop-after');
        if (moving === t.id) return;
        const ids = p.trackIds.filter((x) => x !== moving);
        ids.splice(ids.indexOf(t.id) + (after ? 1 : 0), 0, moving);
        save(p, { trackIds: ids });
      });
      rows.append(row);
    });
    if (!list.length) rows.append(h('div', { class: 'pl-hint' }, 'Empty playlist. Add songs: right-click songs in All → Add to playlist, drag song cards onto a playlist name, or use 📂 Add files.'));
    return h('div', { class: 'pl-detail' }, head, rows);
  }
  // ♥ / 🚫 for smart shuffle. The mark shows while it counts (songs x 4 plays), then the song is normal again.
  function markEl(t, n) {
    const b = TFShuffle.badge(t, S.playClock || 0, n);
    const btn = (kind, label, tip) => h('button', { class: `pl-mk ${kind}${b === kind ? ' on' : ''}`, title: b === kind ? 'Back to normal in shuffle' : tip,
      onclick: (e) => { e.stopPropagation(); setMark([t.id], b === kind ? null : kind, n); } }, label);
    return h('span', { class: 'pl-marks' },
      b === 'less' ? h('span', { class: 'pl-auto', title: 'Played a lot lately: smart shuffle picks it less for now' }, '↓') : null,
      btn('fav', '♥', 'Favourite: play more in shuffle'), btn('black', '🚫', 'Blacklist: play much less in shuffle (about 1 in 10)'));
  }
  async function addFiles(p) {
    const paths = await guard(() => tf.pickFiles());
    if (!paths || !paths.length) return;
    const r = await guard(() => tf.importPaths(paths), 'Add files: ');
    if (!r) return;
    for (const t of r.added) upsertTrack(t);
    renderGrid();
    if (r.failed) toast(`${r.failed} file${r.failed === 1 ? '' : 's'} could not be added (damaged or no sound).`, { type: 'error' });
    if (r.ids && r.ids.length) await addTo(byId(p.id), r.ids);
  }
  async function remove(p) {
    const ok = await confirmModal(`Delete the playlist "${p.name}"?`, 'Only the playlist goes. Its songs stay in your library and your files stay on your PC.', 'Delete playlist');
    if (!ok) return;
    if (!(await guard(() => tf.playlistDelete(p.id)))) return;
    P.list = P.list.filter((x) => x !== p);
    if (S.playlistId === p.id) S.playlistId = null;
    if (P.openId === p.id) P.openId = P.list[0] ? P.list[0].id : null;
    render();
  }

  // ---------- dragging song cards onto playlists ----------
  function dropTarget(el, p) {
    el.addEventListener('dragover', (e) => { if (P.dragIds) { e.preventDefault(); el.classList.add('drop-on'); } });
    el.addEventListener('dragleave', () => el.classList.remove('drop-on'));
    el.addEventListener('drop', (e) => { if (!P.dragIds) return; e.preventDefault(); e.stopPropagation(); el.classList.remove('drop-on'); const ids = P.dragIds; endDrag(); addTo(byId(p.id), ids); });
  }
  // While a song card is dragged, a bar with the playlists shows at the top of the Library.
  function startDrag(ids) {
    P.dragIds = ids;
    const bar = $('#pl-dropbar');
    bar.innerHTML = '';
    bar.append(h('span', { class: 'pl-drop-l' }, `Drop ${ids.length === 1 ? 'the song' : `${ids.length} songs`} on a playlist:`));
    for (const p of P.list) { const b = h('div', { class: 'pl-chip' }, h('div', { class: 'pl-mini' }, plCover(p)), p.name); dropTarget(b, p); bar.append(b); }
    const nb = h('div', { class: 'pl-chip new' }, '+ New playlist');
    nb.addEventListener('dragover', (e) => { e.preventDefault(); nb.classList.add('drop-on'); });
    nb.addEventListener('dragleave', () => nb.classList.remove('drop-on'));
    nb.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); const d = P.dragIds; endDrag(); create(d); });
    bar.append(nb);
    bar.hidden = false;
  }
  function endDrag() { P.dragIds = null; const bar = $('#pl-dropbar'); if (bar) bar.hidden = true; }

  function onTracksRemoved(ids) {
    const gone = new Set(ids);
    for (const p of P.list) p.trackIds = p.trackIds.filter((id) => !gone.has(id));
    render();
  }
  return { setAll, render, pickFor, startDrag, endDrag, onTracksRemoved, play, get list() { return P.list; }, get open() { return byId(P.openId); } };
})();
