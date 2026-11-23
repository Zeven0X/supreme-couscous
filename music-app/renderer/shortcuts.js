'use strict';
/* global S, h, $, $$, TFKeys, toast, togglePlay, skip, nextSong, prevSong, toggleMute, setMaster, nudge, FX, resetAllFx, showView,
   visibleTracks, markSelection, playTrack, openSaveModal, openAlbumModal, setZoom, removeSelected */
// Keyboard shortcuts: one place that listens for keys and runs the matching action (see keys.js for the list).
(function () {
  const map = () => window.TFMap && window.TFMap.actions;
  const fx = (key) => FX.find((f) => f.key === key);
  // What each shortcut does. `boost` is 5 when Shift is held on a sound key.
  const RUN = {
    playPause: () => togglePlay(),
    back5: () => skip(-5), fwd5: () => skip(5), back30: () => skip(-30), fwd30: () => skip(30),
    next: () => nextSong(), prev: () => prevSong(),
    mute: () => toggleMute(),
    volUp: () => { setMaster((S.master ?? 100) + 5); hint(`Main volume ${S.master}%`); },
    volDown: () => { setMaster((S.master ?? 100) - 5); hint(`Main volume ${S.master}%`); },
    speedDown: (b) => nudge(fx('speed'), -b), speedUp: (b) => nudge(fx('speed'), b),
    pitchDown: (b) => nudge(fx('pitch'), -b), pitchUp: (b) => nudge(fx('pitch'), b),
    volCardDown: (b) => nudge(fx('volume'), -b), volCardUp: (b) => nudge(fx('volume'), b),
    resetSound: () => resetAllFx(),
    search: () => { showView('library'); $('#search').focus(); $('#search').select(); },
    uploadFiles: () => $('#btn-upload-file').click(),
    uploadFolder: () => $('#btn-upload-folder').click(),
    selectAll: () => { S.selected = visibleTracks().map((t) => t.id); markSelection(); },
    playSelected: () => { if (S.selected.length === 1) playTrack(S.selected[0]); },
    saveSong: () => openSaveModal(),
    saveAlbum: () => openAlbumModal(),
    picsBigger: () => setZoom(+$('#zoom').value + 20),
    picsSmaller: () => setZoom(+$('#zoom').value - 20),
    removeSongs: () => { if (S.selected.length) removeSelected(); },
    mapPlay: () => map().playStop(),
    mapPath: () => map().pathTool(), mapAdd: () => map().addSongs(), mapStart: () => map().setStart(), mapLock: () => map().lock(),
    mapBg: () => map().background(), mapFit: () => map().fit(), mapRemove: () => map().remove(), mapMaps: () => map().maps(),
    undo: () => map().undo(), redo: () => map().redo(),
    page1: () => showView('library'), page2: () => showView('map'),
    page3: () => showView('edit'),
    page4: () => showView('settings'), settings: () => showView('settings'),
    cheat: () => cheat(),
  };
  // a small note for keys that change something you cannot see (main volume)
  function hint(msg) { toast(msg, { ms: 900 }); }

  // Keys that keep their normal job while you type in a box.
  const TEXT_KEYS = /^Ctrl\+(Shift\+)?(KeyA|KeyC|KeyV|KeyX|KeyZ|KeyY|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Backspace|Delete|Home|End)$/;
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || TFKeys.isModifier(e.code)) return;
    if (closeCheat()) { e.preventDefault(); return; } // any key closes the cheat sheet
    if ($('.modal-back')) return; // a window is open: it handles its own keys
    const combo = TFKeys.fromEvent(e);
    const t = e.target;
    const typing = t.closest && t.closest('input, textarea, select') && !['range', 'checkbox', 'color', 'radio'].includes(t.type);
    if (combo === 'Escape') {
      if (typing) { t.blur(); return; }
      if (S.view === 'map' && map() && map().escape()) e.preventDefault();
      return;
    }
    if (typing && (!/^(Ctrl|Alt)\+/.test(combo) || TEXT_KEYS.test(combo)) && !/^F\d+$/.test(combo)) return;
    // map: number keys choose the next path while a map plays
    if (S.view === 'map' && /^Digit[1-9]$/.test(combo) && map() && map().chooseNumber(+combo.slice(5))) { e.preventDefault(); return; }
    const m = TFKeys.match(combo, S.view, S.settings.keys || {});
    if (!m || !RUN[m.action.id]) return;
    e.preventDefault();
    RUN[m.action.id](m.boost);
  });

  // ---------- cheat sheet (? or F1) ----------
  let sheet = null;
  function cheat() {
    if (sheet) { closeCheat(); return; }
    const keys = TFKeys.current(S.settings.keys || {});
    const cols = h('div', { class: 'kcols three' });
    for (const g of TFKeys.GROUPS) {
      const box = h('div', { class: 'kg' }, h('h4', {}, g === 'Sound' ? 'Sound (playing song)' : g));
      for (const a of TFKeys.ACTIONS.filter((x) => x.group === g)) {
        const chips = keys[a.id].map((k) => h('kbd', {}, a.id === 'mapChoose' ? '1 – 9' : TFKeys.label(k)));
        box.append(h('div', { class: 'kr' }, h('span', { class: 'n' }, a.label), h('span', { class: 'ks' }, ...(chips.length ? chips.flatMap((c, i) => (i ? [h('i', {}, '/'), c] : [c])) : [h('span', { class: 'knone' }, 'none')]))));
      }
      cols.append(box);
    }
    sheet = h('div', { class: 'cheat-back', onclick: () => closeCheat() },
      h('div', { class: 'cheat' }, h('h2', {}, 'Shortcuts'),
        h('p', {}, 'Press ', h('kbd', {}, '?'), ' or ', h('kbd', {}, 'F1'), ' anywhere to see this. Press any key to close. Change them in Settings → Keyboard.'), cols));
    document.body.append(sheet);
  }
  function closeCheat() { if (!sheet) return false; sheet.remove(); sheet = null; return true; }

  // ---------- tooltips show the shortcut, e.g. "Play / pause (Space)" ----------
  const TIPS = {
    playPause: '#play', back5: '#back5', fwd5: '#fwd5', back30: '#back30', fwd30: '#fwd30', mute: '#mute', resetSound: '#fx-reset-all',
    uploadFiles: '#btn-upload-file', uploadFolder: '#btn-upload-folder', saveSong: '#btn-save', saveAlbum: '#btn-save-many',
    picsBigger: '#zoom-in', picsSmaller: '#zoom-out', mapPlay: '#map-play', mapPath: '#map-path', mapAdd: '#map-add', mapStart: '#map-start',
    mapBg: '#map-bg', mapFit: '#map-fit', mapRemove: '#map-remove', mapMaps: '#map-name',
    page1: '.nav[data-view="library"]', page2: '.nav[data-view="map"]', page4: '.nav[data-view="settings"]',
  };
  function refresh() {
    const keys = TFKeys.current(S.settings.keys || {});
    for (const [id, sel] of Object.entries(TIPS)) {
      for (const el of $$(sel)) {
        if (el.dataset.tip === undefined) el.dataset.tip = (el.getAttribute('title') || '').replace(/\s*\([^()]*\)\s*$/, '');
        const k = keys[id][0];
        el.title = k ? `${el.dataset.tip} (${TFKeys.label(k)})` : el.dataset.tip;
      }
    }
  }
  // some buttons are re-made later (Mute), so refresh again a moment after start
  setTimeout(refresh, 0);
  setTimeout(refresh, 1500);

  window.TFShortcuts = { cheat, refresh, closeCheat };
})();
