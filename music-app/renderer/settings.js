'use strict';
/* global S, h, $, $$, ICONS, tf, toast, guard, confirmModal, modal, cur, setMaster, buildFxCards, renderFx, makeQueue, renderNext,
   renderGrid, upsertTrack, TFKeys, TFBackgrounds, FX */
// The Settings page (⚙). Every change is saved right away and takes effect right away.
(function () {
  const SECTIONS = [
    ['general', 'General', '⚙'], ['look', 'Look', '🎨'], ['playing', 'Playing', '▶'], ['saving', 'Saving', '💾'], ['library', 'Library', '📚'],
    ['map', 'Map', '🗺'], ['trash', 'Map trash', '🗑'], ['keyboard', 'Keyboard', '⌨'], ['about', 'About & updates', 'ℹ'],
  ];
  const THEMES = [
    ['midnight', 'Midnight', 'radial-gradient(circle at 30% 0%,#2a3346,#141924 45%,#0a0c11)', '#c9d6ff'],
    ['warm', 'Warm glass', 'radial-gradient(circle at 20% 10%,#5a2a6e,#2a1238 35%,#120a1a)', '#ff8fc8'],
    ['sunset', 'Sunset', 'radial-gradient(circle at 15% 0%,#8a3a1f,#4a1a2a 40%,#1a0b14)', '#ffa35c'],
    ['ocean', 'Ocean', 'radial-gradient(circle at 80% 0%,#0f6b7a,#0b3550 40%,#06121f)', '#5fe3ff'],
    ['aurora', 'Aurora', 'linear-gradient(160deg,#0a1f1c,#123d33 30%,#2c1f55 70%,#0d0a1c)', '#5cf2a8'],
    ['pastel', 'Pastel (light)', 'linear-gradient(135deg,#ffd9ec,#e3dcff 45%,#cfeeff)', '#8a5cff'],
    ['cover', 'Cover colors', 'radial-gradient(circle at 30% 20%,#ff6fd8,#5a2a8a 45%,#1a1030)', '#ff8af0'],
  ];
  const ZOOM = { small: 0.9, normal: 1, big: 1.12 };

  // ---------- saving one setting ----------
  async function patch(k, v) {
    S.settings[k] = v;
    const got = await guard(() => tf.settings({ [k]: v }));
    if (got) S.settings = { ...S.settings, ...got };
    apply(k);
  }
  function apply(k) {
    if (k === 'theme') applyTheme();
    if (k === 'textSize') tf.setZoomFactor(ZOOM[S.settings.textSize] || 1);
    if (k === 'blur') document.body.style.setProperty('--blur', `${Math.round((S.settings.blur ?? 70) * 0.32)}px`);
    if (k === 'animations') document.body.classList.toggle('no-anim', S.settings.animations === false);
    if (k === 'volumeLimit') applyVolumeLimit(true);
    if (k === 'shuffle' && cur()) { S.queue = makeQueue(S.currentId); renderNext(); }
    if (k === 'videoBadge') renderGrid();
    if (['pathLabels', 'mapFollow', 'mapDot'].includes(k) && window.TFMap) window.TFMap.actions.refresh();
  }
  function applyAll() {
    for (const k of ['theme', 'textSize', 'blur', 'animations']) apply(k);
    applyVolumeLimit(false);
  }
  // The Volume card can never go above the safety limit.
  function applyVolumeLimit(rebuild) {
    const lim = S.settings.volumeLimit || 500;
    S.limits = { ...S.limits, volume: [0, lim] };
    if (rebuild) { buildFxCards(); renderFx(); }
  }

  // ---------- look ----------
  function applyTheme() {
    const th = S.settings.theme || 'midnight';
    document.body.dataset.theme = th;
    if (th !== 'cover') for (const v of ['--bg-grad', '--bg-base', '--accent', '--accent-2', '--on-accent', '--glow', '--surface', '--surface-deep', '--surface-glass', '--accent-soft', '--orange-hi']) document.body.style.removeProperty(v);
    else { coverSeen = null; coverTheme(); }
    refreshWaveColors();
  }
  // "Cover colors": find the main color of the playing song's picture and build the colors from it.
  let coverSeen = null;
  function coverTheme() {
    if (S.settings.theme !== 'cover') return;
    const t = cur();
    const url = t && t.coverUrl;
    if (url === coverSeen) return;
    coverSeen = url;
    const set = (hue, sat) => {
      const st = document.body.style;
      const s2 = Math.round(sat);
      st.setProperty('--bg-grad', `radial-gradient(circle at 25% 0%, hsl(${hue} ${s2}% 26%) 0, hsl(${hue} ${s2 - 5}% 13%) 45%, hsl(${hue} ${s2 - 10}% 6%) 90%)`);
      st.setProperty('--bg-base', `hsl(${hue} ${s2 - 10}% 6%)`);
      st.setProperty('--accent', `hsl(${hue} 85% 78%)`);
      st.setProperty('--accent-2', `hsl(${(hue + 40) % 360} 80% 66%)`);
      st.setProperty('--on-accent', `hsl(${hue} 45% 12%)`);
      st.setProperty('--glow', `hsl(${hue} 85% 70% / .45)`);
      st.setProperty('--surface', `hsl(${hue} 30% 15%)`);
      st.setProperty('--surface-deep', `hsl(${hue} 30% 10%)`);
      st.setProperty('--surface-glass', `hsl(${hue} 30% 15% / .82)`);
      st.setProperty('--accent-soft', `hsl(${hue} 85% 78% / .12)`);
      st.setProperty('--orange-hi', `hsl(${hue} 85% 86%)`);
      refreshWaveColors();
    };
    if (!url) { set(225, 30); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 24;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, 24, 24);
      const d = g.getImageData(0, 0, 24, 24).data;
      // colorful pixels count more than grey ones
      let x = 0, y = 0, wsum = 0, ssum = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), ch = mx - mn;
        if (ch < 0.08) continue;
        let hh = mx === r ? ((gg - b) / ch) % 6 : mx === gg ? (b - r) / ch + 2 : (r - gg) / ch + 4;
        hh *= 60;
        const w = ch * ch;
        x += Math.cos((hh * Math.PI) / 180) * w; y += Math.sin((hh * Math.PI) / 180) * w; wsum += w; ssum += ch;
      }
      if (!wsum) { set(225, 20); return; }
      const hue = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
      set(hue, Math.min(60, 25 + (ssum / (d.length / 4)) * 90));
    };
    img.onerror = () => set(225, 30);
    img.src = url;
  }
  setInterval(coverTheme, 600);

  // ---------- small building blocks ----------
  const seg = (k, opts) => h('div', { class: 'seg' }, ...opts.map(([v, l]) => h('button', { class: S.settings[k] === v ? 'on' : '', onclick: async () => { await patch(k, v); render(); } }, l)));
  const tog = (k, def = true) => {
    const on = S.settings[k] === undefined ? def : !!S.settings[k];
    return h('button', { class: `stog${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(on), onclick: async () => { await patch(k, !on); render(); } }, h('i'));
  };
  const row = (title, desc, ...ctl) => h('div', { class: 'srow' }, h('div', { class: 'st' }, h('b', {}, title), desc ? h('span', {}, desc) : null), h('div', { class: 'sc' }, ...ctl));
  const card = (id, title, ...rows) => h('section', { class: 'scard', id: `set-${id}`, 'data-sec': id }, h('h3', {}, title), ...rows);
  const btn = (label, fn, cls = '') => h('button', { class: `sbtn ${cls}`, onclick: fn }, label);
  const pathBox = (p) => h('span', { class: 'spath', title: p }, p || '—');
  function slider(k, min, max, step, show, onDone) {
    const v = S.settings[k] ?? min;
    const out = h('b', { class: 'slv' }, show(v));
    const r = h('input', { type: 'range', min, max, step, value: v });
    const pct = () => r.style.setProperty('--pct', `${((+r.value - min) / (max - min)) * 100}%`);
    pct();
    r.addEventListener('input', () => { out.textContent = show(+r.value); pct(); S.settings[k] = +r.value; apply(k); });
    r.addEventListener('change', () => { patch(k, +r.value); if (onDone) onDone(); });
    return h('div', { class: 'ssl' }, r, out);
  }

  // ---------- the sections ----------
  function general() {
    return card('general', 'General',
      row('Open on', 'The page you see when Tonix starts', seg('openOn', [['library', 'Library'], ['map', 'Map'], ['last', 'Last page']])),
      row('Continue when Tonix opens', 'Start the map where its music stopped last time', tog('continueOnOpen', false)),
      row('Ask before removing songs', '"Are you sure?" before songs leave the library', tog('confirmRemove')));
  }
  function look() {
    const grid = h('div', { class: 'themes' }, ...THEMES.map(([id, name, bg, ac]) => h('button', {
      class: `th${(S.settings.theme || 'midnight') === id ? ' on' : ''}`, onclick: async () => { await patch('theme', id); render(); },
    }, h('div', { class: 'thp', style: { background: bg } }, h('i', { style: { background: ac } }), h('i', { class: 'b' }), h('i', { class: 'c' })), h('span', {}, name))));
    return card('look', 'Look', grid,
      row('Text size', 'Makes everything in Tonix bigger or smaller', seg('textSize', [['small', 'Small'], ['normal', 'Normal'], ['big', 'Big']])),
      row('Glass blur', 'How blurry the see-through panels are', slider('blur', 0, 100, 1, (v) => `${v}%`)),
      row('Animations', 'Glows, the pulsing ring, sliding views. Off = calmer', tog('animations')));
  }
  function playing() {
    return card('playing', 'Playing',
      row('When a song ends in the library', '', seg('whenEnds', [['next', 'Next song'], ['repeat', 'Repeat it'], ['stop', 'Stop']])),
      row('Shuffle the library', 'Play library songs in a random order', tog('shuffle', false)),
      row('Blend library songs', 'Crossfade from one library song to the next (0 = off)', slider('libraryBlend', 0, 12, 0.5, (v) => (v ? `${v.toFixed(1)} s` : 'Off'))),
      row('Volume safety limit', 'The Volume card can go up to this. Protects ears and speakers', seg('volumeLimit', [[200, '200%'], [300, '300%'], [500, '500%']])),
      row('Remember main volume', 'Keep the bottom-right volume between starts', tog('rememberMaster')));
  }
  function saving() {
    return card('saving', 'Saving',
      row('Save folder', '', pathBox(S.settings.exportDir), btn('Change…', async () => { const d = await guard(() => tf.pickDir(S.settings.exportDir)); if (d) { await patch('exportDir', d); render(); } }), btn('Open', () => tf.openPath(S.settings.exportDir))),
      row('Ask where to save every time', 'Off = save instantly into the save folder', tog('askWhereToSave', false)),
      row('Saved file type', 'For single songs. Albums are always MP3', seg('format', [['mp3', 'MP3'], ['wav', 'WAV']])),
      row('MP3 quality', 'Higher = better sound, bigger files', seg('bitrate', [[128, '128'], [192, '192'], [256, '256'], [320, '320']])),
      row('File names', 'How saved songs are named', seg('fileNames', [['artist-title', 'Artist - Title'], ['title', 'Title'], ['title-artist', 'Title - Artist']])));
  }
  let missing = null;
  function library() {
    const list = h('div', { class: 'slist' });
    if (missing) {
      if (!missing.length) list.append(h('p', { class: 'note' }, 'All songs are where they should be. ✓'));
      for (const m of missing) {
        list.append(h('div', { class: 'trow' }, h('div', { class: 'st' }, h('b', {}, m.title), h('span', {}, `${m.artist ? `${m.artist} · ` : ''}was at ${m.path}`)),
          btn('Remove from library', async () => {
            const ok = await confirmModal(`Remove "${m.title}"?`, 'Its file is already gone from your PC, so it cannot be played.', 'Remove');
            if (!ok) return;
            await guard(() => tf.removeTracks([m.id]));
            S.tracks = S.tracks.filter((t) => t.id !== m.id); S.byId.delete(m.id);
            missing = missing.filter((x) => x.id !== m.id);
            renderGrid(); render();
          })));
      }
    }
    const studioBox = h('span', { class: 'svalue' }, '…');
    const showSize = () => tf.studioSize().then((n) => { studioBox.textContent = `${(n / 1024 ** 2).toFixed(n < 1024 ** 2 * 10 ? 1 : 0)} MB `; studioBox.append(btn('Clear', async () => { await guard(() => tf.studioClear()); showSize(); })); }).catch(() => { studioBox.textContent = ''; });
    showSize();
    return card('library', 'Library',
      row('Library folder', 'Where Tonix keeps its copies of videos, covers and maps', pathBox(S.libraryDir), btn('Open', () => tf.openPath(S.libraryDir))),
      row('Find missing songs', 'Songs whose file was moved or deleted on your PC', btn('Check now', async () => { missing = await guard(() => tf.findMissing()); render(); })),
      list,
      row('Clean pitch copies', 'Songs with a changed pitch are prepared once and kept, so they start at once next time (oldest removed after 2 GB)', studioBox),
      row('"From video" badge', 'The little badge on songs that came from videos', tog('videoBadge')));
  }
  function mapSec() {
    const j = S.settings.mapJoin || { type: 'crossfade', secs: 3 };
    const setJoin = async (patchJ) => { await patch('mapJoin', { ...j, ...patchJ }); render(); };
    const secs = h('input', { class: 'snum', value: (j.secs ?? 3).toFixed(2), title: '0 to 15 seconds' });
    secs.addEventListener('change', () => { const v = parseFloat(secs.value.replace(',', '.')); if (Number.isFinite(v)) setJoin({ secs: Math.round(Math.min(15, Math.max(0, v)) * 100) / 100 }); });
    secs.addEventListener('keydown', (e) => { if (e.key === 'Enter') secs.blur(); });
    const joinSeg = h('div', { class: 'seg' }, ...[['crossfade', 'Crossfade'], ['silence', 'Silence'], ['cut', 'Cut']].map(([v, l]) => h('button', { class: j.type === v ? 'on' : '', onclick: () => setJoin({ type: v }) }, l)));
    const bgs = h('div', { class: 'sbgs' }, ...TFBackgrounds.list.map((b) => h('button', {
      class: (S.settings.mapBg || 'dots') === b.id ? 'on' : '', title: b.name,
      style: { backgroundColor: b.color, backgroundImage: b.url, backgroundSize: `${Math.round(b.W * 0.4)}px ${Math.round(b.H * 0.4)}px` },
      onclick: async () => { await patch('mapBg', b.id); render(); },
    })));
    return card('map', 'Map',
      row('New paths join with', 'What every new path starts with (each path can still be changed)', joinSeg, j.type === 'cut' ? null : h('label', { class: 'sbox' }, secs, 's')),
      row('New maps start with background', (TFBackgrounds.byId(S.settings.mapBg || 'dots') || {}).name || ''),
      bgs,
      row('Labels on paths', '', seg('pathLabels', [['chance', 'Chance'], ['name', 'Name + chance'], ['hidden', 'Hidden']])),
      row('Follow the playing song', 'The view glides to the song that plays', tog('mapFollow')),
      row('Glowing dot', 'The dot that travels along a path', tog('mapDot')));
  }
  let trash = null;
  function trashSec() {
    const box = card('trash', 'Map trash', h('p', { class: 'note' }, 'Deleted maps wait here. Restore brings one back with all its songs, paths and settings.'));
    if (!trash) { box.append(h('p', { class: 'note' }, 'Loading…')); guard(() => tf.mapTrash()).then((t) => { trash = t || []; render(); }); return box; }
    if (!trash.length) box.append(h('p', { class: 'note' }, 'The trash is empty.'));
    for (const m of trash) {
      const b = TFBackgrounds.byId((m.bg && m.bg.id) || 'dots');
      const when = new Date(m.deletedAt);
      box.append(h('div', { class: 'trow' },
        h('div', { class: 'tth', style: { backgroundColor: b.color, backgroundImage: b.url, backgroundSize: `${Math.round(b.W * 0.3)}px ${Math.round(b.H * 0.3)}px` } }),
        h('div', { class: 'st' }, h('b', {}, m.name), h('span', {}, `${m.stops} song${m.stops === 1 ? '' : 's'} · deleted ${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)),
        btn('Restore', async () => {
          const r = await guard(() => tf.mapRestore(m.file));
          if (!r) return;
          trash = null;
          toast(`“${r.name}” is back in Your maps.`, { type: 'ok' });
          render();
        }),
        btn('Delete forever', async () => {
          const ok = await confirmModal(`Delete “${m.name}” forever?`, 'This cannot be undone. The songs stay in your library.', 'Delete forever');
          if (!ok) return;
          await guard(() => tf.mapPurge(m.file));
          trash = null;
          render();
        }, 'red')));
    }
    return box;
  }

  // ---------- keyboard ----------
  let keyFilter = '', recording = null, pending = null; // pending = { id, combo, other } while asking about a clash
  function keyboard() {
    const custom = S.settings.keys || {};
    const keys = TFKeys.current(custom);
    const search = h('input', { class: 'ksearch', placeholder: 'Find a shortcut…', value: keyFilter, spellcheck: 'false' });
    search.addEventListener('input', () => { keyFilter = search.value; const p = search.selectionStart; render(); const n = $('.ksearch'); n.focus(); n.setSelectionRange(p, p); });
    const top = h('div', { class: 'ktop' }, search, btn('Show cheat sheet (?)', () => window.TFShortcuts.cheat()),
      btn('Reset all', async () => {
        if (!Object.keys(custom).length) { toast('All shortcuts are already the normal ones.'); return; }
        const ok = await confirmModal('Reset all shortcuts?', 'Every shortcut goes back to how Tonix came.', 'Reset all');
        if (ok) { await patch('keys', {}); window.TFShortcuts.refresh(); render(); }
      }));
    const groups = h('div', { class: 'kcols' });
    const f = keyFilter.trim().toLowerCase();
    for (const g of TFKeys.GROUPS) {
      const acts = TFKeys.ACTIONS.filter((a) => a.group === g && (!f || a.label.toLowerCase().includes(f) || keys[a.id].some((k) => TFKeys.label(k).toLowerCase().includes(f))));
      if (!acts.length) continue;
      const box = h('div', { class: 'kg' }, h('h4', {}, g === 'Sound' ? 'Sound (playing song)' : g));
      for (const a of acts) box.append(keyRow(a, keys[a.id], custom));
      groups.append(box);
    }
    if (!groups.children.length) groups.append(h('p', { class: 'note' }, 'No shortcut matches.'));
    return card('keyboard', 'Keyboard shortcuts', top, groups,
      h('p', { class: 'note' }, 'Click a shortcut to change it, then press the new keys. Tonix tells you if they are already used. Shortcuts never work while you type in a box.'));
  }
  function keyRow(a, combos, custom) {
    const changed = !!custom[a.id];
    const chips = combos.length ? combos.map((k) => h('kbd', {}, a.id === 'mapChoose' ? '1 – 9' : TFKeys.label(k))) : [h('span', { class: 'knone' }, 'none')];
    if (recording === a.id) {
      return h('div', { class: 'kr rec' }, h('span', { class: 'n' }, a.label), h('span', { class: 'wait' }, 'Press the new keys… (Esc = cancel)'));
    }
    const r = h('div', { class: `kr${a.fixed ? ' fixed' : ''}${pending && pending.id === a.id ? ' clash' : ''}`, title: a.fixed ? 'This one cannot be changed' : 'Click to change' },
      h('span', { class: 'n' }, a.label, changed ? h('em', {}, 'changed') : null),
      h('span', { class: 'ks' }, ...chips.flatMap((c, i) => (i ? [h('i', {}, '/'), c] : [c]))),
      changed ? h('button', { class: 'kreset', title: 'Back to the normal key', onclick: async (e) => { e.stopPropagation(); await patch('keys', TFKeys.resetOne(a.id, S.settings.keys || {})); window.TFShortcuts.refresh(); render(); } }, '↺') : null);
    if (!a.fixed) r.addEventListener('click', () => { if (pending) return; recording = a.id; render(); });
    if (pending && pending.id === a.id) {
      r.append(h('div', { class: 'clashmsg' }, `⚠ ${TFKeys.label(pending.combo)} is already “${pending.other.label}”.`,
        h('button', { onclick: (e) => { e.stopPropagation(); finish('swap'); } }, 'Swap them'),
        h('button', { onclick: (e) => { e.stopPropagation(); finish('steal'); } }, 'Use it anyway'),
        h('button', { onclick: (e) => { e.stopPropagation(); pending = null; render(); } }, 'Cancel')));
    }
    return r;
  }
  async function finish(mode) {
    const { id, combo } = pending;
    pending = null;
    await patch('keys', TFKeys.assign(id, combo, S.settings.keys || {}, mode));
    window.TFShortcuts.refresh();
    render();
    toast(`Done: ${TFKeys.label(combo)}`, { ms: 1500 });
  }
  // While recording, this sees the keys before anything else does.
  window.addEventListener('keydown', async (e) => {
    if (!recording) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (TFKeys.isModifier(e.code)) return;
    const id = recording;
    if (e.code === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) { recording = null; render(); return; }
    const combo = TFKeys.fromEvent(e);
    recording = null;
    const why = TFKeys.refuse(combo);
    if (why) { toast(`${TFKeys.label(combo)}: ${why}`, { type: 'error' }); render(); return; }
    const other = TFKeys.clash(id, combo, S.settings.keys || {});
    if (other) { pending = { id, combo, other }; render(); return; }
    await patch('keys', TFKeys.assign(id, combo, S.settings.keys || {}));
    window.TFShortcuts.refresh();
    render();
    toast(`Done: ${TFKeys.label(combo)}`, { ms: 1500 });
  }, true);

  // ---------- about ----------
  let about = null;
  function aboutSec() {
    if (!about) guard(() => tf.about()).then((a) => { about = a || {}; render(); });
    const a = about || {};
    return card('about', 'About & updates',
      row('Tonix', `Version ${a.version || '…'} · sound engine: ffmpeg ${a.ffmpeg || '…'}`, btn('Open log', openLog)),
      row('Old versions', 'Every update moves the old installer into this folder. Nothing is deleted', pathBox(a.oldVersions), btn('Open', () => tf.openOldVersions())));
  }
  function openLog() {
    modal((box, close) => {
      box.classList.add('wide');
      const term = h('div', { class: 'logbox' });
      term.innerHTML = $('#terminal').innerHTML || '<span class="muted">Nothing yet.</span>';
      box.append(h('h2', {}, 'Log'), term, h('div', { class: 'foot' }, h('span', { class: 'muted' }, 'Everything Tonix did since it started.'), h('button', { class: 'btn primary', onclick: () => close() }, 'Close')));
      setTimeout(() => { term.scrollTop = term.scrollHeight; }, 0);
    });
  }

  // ---------- the page ----------
  let active = 'general';
  function render() {
    if (S.view !== 'settings') return;
    const body = $('#sbody');
    const top = body.scrollTop;
    body.innerHTML = '';
    body.append(general(), look(), playing(), saving(), library(), mapSec(), trashSec(), keyboard(), aboutSec());
    body.scrollTop = top;
    const nav = $('#snav');
    nav.innerHTML = '';
    nav.append(h('div', { class: 'snav-h' }, 'Settings'), ...SECTIONS.map(([id, name, ic]) => h('button', {
      class: id === active ? 'on' : '', 'data-sec': id,
      onclick: () => { active = id; $(`#set-${id}`).scrollIntoView({ behavior: 'smooth', block: 'start' }); markNav(); },
    }, h('span', {}, ic), name)));
  }
  function markNav() { for (const b of $$('#snav button')) b.classList.toggle('on', b.dataset.sec === active); }
  // the section you are looking at lights up in the list
  $('#sbody').addEventListener('scroll', () => {
    const body = $('#sbody');
    const y = body.getBoundingClientRect().top + 40;
    let cur2 = SECTIONS[0][0];
    for (const c of $$('.scard', body)) if (c.getBoundingClientRect().top <= y) cur2 = c.dataset.sec;
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 4) cur2 = SECTIONS[SECTIONS.length - 1][0];
    if (cur2 !== active) { active = cur2; markNav(); }
  });
  function open(section) {
    if (window.showView) window.showView('settings');
    if (section) { active = section; render(); const c = $(`#set-${section}`); if (c) c.scrollIntoView({ block: 'start' }); markNav(); }
  }

  window.TFSettings = { render: () => { trash = null; about = null; render(); }, applyAll, open, patch };
})();
