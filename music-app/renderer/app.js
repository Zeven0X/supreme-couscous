'use strict';
/* global ICONS, tf */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) e.style.setProperty(sk, sv); else e.style[sk] = sv; }
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return hh ? `${hh}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}
function hashHue(s) { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x) % 360; }

// ---------------------------------------------------------------- state
const S = {
  tracks: [], byId: new Map(), settings: {}, limits: {}, defaults: {},
  view: 'library', selected: [], anchor: null,
  currentId: null, queue: [], tabs: [], activeTab: null,
  filters: { q: '', artist: '', date: '', label: '', genre: '' },
  muted: false, peaks: null, logs: [],
};
const cur = () => S.byId.get(S.currentId) || null;
function setTracks(list) { S.tracks = list; S.byId = new Map(list.map((t) => [t.id, t])); }
function upsertTrack(t) {
  if (!t) return;
  const i = S.tracks.findIndex((x) => x.id === t.id);
  if (i >= 0) S.tracks[i] = t; else S.tracks.push(t);
  S.byId.set(t.id, t);
}

// ---------------------------------------------------------------- covers
function coverEl(t, cls = '') {
  const box = h('div', { class: `cover-box ${cls}`, style: { width: '100%', height: '100%' } });
  if (t && t.coverUrl) {
    const img = h('img', { class: 'cover-img', src: t.coverUrl, alt: '', draggable: 'false' });
    img.onerror = () => img.replaceWith(placeholder(t));
    box.append(img);
  } else box.append(placeholder(t));
  return box;
}
function placeholder(t) {
  const name = t ? t.title : '';
  const hue = hashHue(name || 'x');
  return h('div', { class: 'ph', style: { background: t ? `linear-gradient(140deg, hsl(${hue} 45% 32%), hsl(${(hue + 50) % 360} 50% 16%))` : '#111' } },
    t ? h('span', {}, name) : h('span', { style: { width: '34%', height: '34%', opacity: '.25', display: 'block' }, html: ICONS.note }));
}

// ---------------------------------------------------------------- toasts + log
function toast(msg, { type = '', action, actionLabel, ms = 4500 } = {}) {
  const t = h('div', { class: `toast ${type}` }, msg);
  if (action) t.append(h('button', { onclick: () => { action(); t.remove(); } }, actionLabel));
  $('#toasts').append(t);
  setTimeout(() => t.remove(), ms);
}
function addLog(level, msg, time = Date.now()) {
  S.logs.push({ level, msg, time });
  if (S.logs.length > 1000) S.logs.shift();
  const term = $('#terminal');
  const stick = term.scrollTop + term.clientHeight >= term.scrollHeight - 4;
  const d = new Date(time);
  term.append(h('div', {}, h('span', { class: 't' }, `[${d.toLocaleTimeString()}] `), h('span', { class: level }, msg)));
  while (term.childElementCount > 1000) term.firstChild.remove();
  if (stick) term.scrollTop = term.scrollHeight;
}
async function guard(fn, errPrefix = '') {
  try { return await fn(); } catch (e) {
    toast(`${errPrefix}${e.message}`, { type: 'error', ms: 7000 });
    addLog('error', `${errPrefix}${e.message}`);
    return undefined;
  }
}

// ---------------------------------------------------------------- audio engine
const audio = new Audio();
audio.crossOrigin = 'anonymous';
audio.preload = 'auto';
audio.preservesPitch = true;
let actx = null, shifter = null, gainNode = null, engine = null;
function ensureEngine() {
  if (engine) return engine;
  engine = (async () => {
    actx = new AudioContext({ latencyHint: 'playback' });
    const src = actx.createMediaElementSource(audio);
    gainNode = actx.createGain();
    try {
      await actx.audioWorklet.addModule('pitch-worklet.js');
      shifter = new AudioWorkletNode(actx, 'pitch-shifter', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      src.connect(shifter).connect(gainNode);
    } catch (e) {
      addLog('warn', `Pitch preview not available (${e.message}). Saved files still get the pitch change.`);
      src.connect(gainNode);
    }
    gainNode.connect(actx.destination);
    applyFx();
  })();
  return engine;
}
function envelope(t, fx, dur) {
  const sp = fx.speed / 100;
  let e = 1;
  if (fx.fadeIn > 0) e = Math.min(e, (t / sp) / fx.fadeIn);
  if (fx.fadeOut > 0 && dur > 0) e = Math.min(e, ((dur - t) / sp) / fx.fadeOut);
  return Math.max(0, Math.min(1, e));
}
function applyFx() {
  const t = cur();
  const fx = t ? t.fx : S.defaults;
  audio.defaultPlaybackRate = fx.speed / 100;
  audio.playbackRate = fx.speed / 100;
  audio.preservesPitch = true;
  if (shifter) shifter.parameters.get('pitch').setValueAtTime(fx.pitch / 100, actx.currentTime);
  updateGain(true);
}
function updateGain(now) {
  if (!gainNode) return;
  const t = cur();
  const fx = t ? t.fx : S.defaults;
  const dur = audio.duration || (t && t.duration) || 0;
  const target = S.muted ? 0 : (fx.volume / 100) * envelope(audio.currentTime, fx, dur);
  if (now) gainNode.gain.setValueAtTime(target, actx.currentTime);
  else gainNode.gain.setTargetAtTime(target, actx.currentTime, 0.015);
}
async function play() {
  if (!cur()) { const first = visibleTracks()[0]; if (first) return playTrack(first.id); return; }
  await ensureEngine();
  if (actx.state === 'suspended') await actx.resume();
  updateGain(true);
  try { await audio.play(); } catch (e) { if (e.name !== 'AbortError') toast(`Can't play this file: ${e.message}`, { type: 'error' }); }
}
function pause() { audio.pause(); }
function togglePlay() { if (audio.paused) play(); else pause(); }
function seek(t) {
  if (!cur()) return;
  const d = audio.duration || cur().duration || 0;
  audio.currentTime = Math.max(0, Math.min(d ? d - 0.05 : 0, t));
  updateGain(true);
  drawWave();
}
const skip = (s) => seek(audio.currentTime + s);

function loadTrack(id, { autoplay = false, keepQueue = true } = {}) {
  const t = S.byId.get(id);
  if (!t) return;
  S.currentId = id;
  if (!keepQueue || !S.queue.includes(id)) S.queue = visibleTracks().map((x) => x.id);
  audio.src = t.mediaUrl;
  audio.load();
  applyFx();
  openTab(id, false);
  S.peaks = null;
  tf.peaks(id).then((p) => { if (S.currentId === id) { S.peaks = p; drawWave(); } }).catch((e) => addLog('warn', `Waveform: ${e.message}`));
  renderNow();
  renderFx();
  renderNext();
  markPlaying();
  drawWave();
  if (autoplay) play();
}
function playTrack(id) {
  S.queue = visibleTracks().map((x) => x.id);
  if (!S.queue.includes(id)) S.queue.unshift(id);
  loadTrack(id, { autoplay: true });
}
function upNext() {
  const i = S.queue.indexOf(S.currentId);
  return S.queue.slice(i + 1).map((id) => S.byId.get(id)).filter(Boolean);
}

audio.addEventListener('loadedmetadata', () => { applyFx(); drawWave(); });
audio.addEventListener('play', () => setPlayIcon(true));
audio.addEventListener('pause', () => setPlayIcon(false));
audio.addEventListener('ended', () => {
  const n = upNext()[0];
  if (n) loadTrack(n.id, { autoplay: true }); else { setPlayIcon(false); }
});
audio.addEventListener('error', () => {
  const t = cur();
  if (t && audio.src) toast(`Can't play "${t.title}". The file may have been moved or deleted.`, { type: 'error', ms: 7000 });
});
function setPlayIcon(playing) {
  const b = $('#play');
  b.innerHTML = playing ? ICONS.pause : ICONS.play;
  b.classList.toggle('playing', playing);
}
// steady UI tick (waveform playhead, time, fades)
setInterval(() => {
  if (!audio.paused) { updateGain(false); drawWave(); }
}, 40);

// ---------------------------------------------------------------- effect cards
const FX = [
  { key: 'fadeIn', label: 'Fade in', color: '#e03b3b', unit: 's', steps: [0.2, 0.05, 0.01], dec: 2 },
  { key: 'fadeOut', label: 'Fade out', color: '#9a46e3', unit: 's', steps: [0.2, 0.05, 0.01], dec: 2 },
  { key: 'speed', label: 'Speed', color: '#3d74e3', unit: '%', steps: [25, 5, 1], dec: 3 },
  { key: 'volume', label: 'Volume', color: '#41b553', unit: '%', steps: [25, 5, 1], dec: 3, mute: true },
  { key: 'pitch', label: 'Pitch', color: '#22b8a6', unit: '%', steps: [25, 5, 1], dec: 3, wide: true },
];
const fmtVal = (v, dec) => (dec === 2 ? Number(v).toFixed(2) : String(+Number(v).toFixed(dec)));
function stepLabel(f, s, sign) {
  return f.unit === 's' ? `${sign}${s.toFixed(2)}` : `${sign}${s}%`;
}
function buildFxCards() {
  const wrap = $('#fx-cards');
  wrap.innerHTML = '';
  for (const f of FX) {
    const [lo, hi] = S.limits[f.key];
    const input = h('input', { class: 'fx-val', 'data-key': f.key, spellcheck: 'false', title: `Type an exact value (${lo}–${hi} ${f.unit === 's' ? 'seconds' : '%'}) and press Enter` });
    const range = h('input', { type: 'range', min: lo, max: hi, step: f.unit === 's' ? 0.01 : 0.001, 'data-key': f.key, style: { '--c': f.color } });
    const btns = h('div', { class: 'fx-btns' },
      ...f.steps.map((s) => h('button', { title: `${stepLabel(f, s, '−')}`, onclick: () => nudge(f, -s) }, stepLabel(f, s, '-'))),
      h('button', { title: 'Back to default', onclick: () => setFx(f.key, S.defaults[f.key]) }, 'Reset'),
      ...[...f.steps].reverse().map((s) => h('button', { title: stepLabel(f, s, '+'), onclick: () => nudge(f, s) }, stepLabel(f, s, '+'))),
    );
    const card = h('div', { class: `fx${f.wide ? ' wide' : ''}`, style: { '--c': f.color }, 'data-key': f.key },
      h('div', { class: 'fx-head' }, h('span', { class: 'fx-label' }, f.label), f.key === 'pitch' ? h('span', { class: 'fx-semis' }) : null, input, h('span', { class: 'fx-unit' }, f.unit === 's' ? 's' : '%')),
      range, btns,
      f.mute ? h('div', { class: 'fx-extra' }, h('button', { class: 'mini', id: 'mute', onclick: toggleMute }, 'Mute')) : null,
    );
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { commitInput(input, f); input.blur(); }
      if (e.key === 'Escape') { input.blur(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); nudge(f, (e.key === 'ArrowUp' ? 1 : -1) * f.steps[2]); }
    });
    input.addEventListener('blur', () => { commitInput(input, f); renderFx(); });
    range.addEventListener('input', () => setFx(f.key, +range.value, { fromSlider: true }));
    wrap.append(card);
  }
}
function commitInput(input, f) {
  const raw = input.value.replace(',', '.').replace(/[^\d.+-]/g, '');
  const v = parseFloat(raw);
  if (Number.isFinite(v)) setFx(f.key, v);
}
function nudge(f, d) {
  const t = cur();
  if (!t) return;
  setFx(f.key, t.fx[f.key] + d);
}
let saveFxTimer = null;
function setFx(key, value, { fromSlider = false } = {}) {
  const t = cur();
  if (!t) return;
  const f = FX.find((x) => x.key === key);
  const [lo, hi] = S.limits[key];
  const p = 10 ** f.dec;
  t.fx[key] = Math.min(hi, Math.max(lo, Math.round(value * p) / p));
  applyFx();
  renderFx(fromSlider ? key : null);
  drawWave();
  clearTimeout(saveFxTimer);
  const id = t.id, fx = { ...t.fx };
  saveFxTimer = setTimeout(() => tf.updateTrack(id, { fx }).catch((e) => addLog('error', e.message)), 250);
}
function renderFx(skipSliderKey) {
  const t = cur();
  $('#fx-cards').classList.toggle('disabled', !t);
  const fx = t ? t.fx : S.defaults;
  for (const f of FX) {
    const card = $(`.fx[data-key="${f.key}"]`);
    const input = $('.fx-val', card);
    const range = $('input[type=range]', card);
    if (document.activeElement !== input) input.value = fmtVal(fx[f.key], f.dec);
    if (skipSliderKey !== f.key) range.value = fx[f.key];
    const [lo, hi] = S.limits[f.key];
    range.style.setProperty('--pct', `${((fx[f.key] - lo) / (hi - lo)) * 100}%`);
    if (f.key === 'pitch') {
      const semis = 12 * Math.log2(fx.pitch / 100);
      $('.fx-semis', card).textContent = `${semis >= 0 ? '+' : ''}${semis.toFixed(2)} semitones`;
    }
  }
  $('#mute').classList.toggle('on', S.muted);
}
function toggleMute() { S.muted = !S.muted; updateGain(true); renderFx(); }

// ---------------------------------------------------------------- left panel
function renderNow() {
  const t = cur();
  const c = $('#now-cover');
  c.innerHTML = '';
  c.append(coverEl(t));
  $('#now-title').innerHTML = t ? `${esc(t.title)}${t.artist ? ` <span class="artist">— ${esc(t.artist)}</span>` : ''}` : '<span class="artist">Nothing playing</span>';
  document.title = t ? `${t.title} — Tune Forge` : 'Tune Forge';
}
function renderNext() {
  const box = $('#next-thumbs');
  box.innerHTML = '';
  for (const t of upNext().slice(0, 4)) {
    box.append(h('div', { class: 'thumb', title: `${t.title}${t.artist ? ` — ${t.artist}` : ''}`, onclick: () => loadTrack(t.id, { autoplay: true }) }, coverEl(t)));
  }
}

// ---------------------------------------------------------------- waveform
const wave = $('#wave');
function drawWave() {
  const box = $('#wave-box');
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.round(box.clientWidth * dpr)), H = Math.max(1, Math.round(box.clientHeight * dpr));
  if (wave.width !== W || wave.height !== H) { wave.width = W; wave.height = H; }
  const g = wave.getContext('2d');
  g.clearRect(0, 0, W, H);
  const t = cur();
  const dur = audio.duration || (t && t.duration) || 0;
  const pos = dur ? audio.currentTime / dur : 0;
  $('#t-cur').textContent = fmtTime(audio.currentTime);
  $('#t-dur').textContent = fmtTime(dur);
  if (!t) return;
  // fade areas (fades are in output seconds -> source seconds = s * speed)
  const sp = t.fx.speed / 100;
  if (dur) {
    if (t.fx.fadeIn > 0) { g.fillStyle = 'rgba(224,59,59,.22)'; g.fillRect(0, 0, Math.min(1, (t.fx.fadeIn * sp) / dur) * W, H); }
    if (t.fx.fadeOut > 0) { const w = Math.min(1, (t.fx.fadeOut * sp) / dur) * W; g.fillStyle = 'rgba(154,70,227,.25)'; g.fillRect(W - w, 0, w, H); }
  }
  const bar = Math.max(2, Math.round(3 * dpr)), gap = Math.max(1, Math.round(dpr));
  const n = Math.floor(W / (bar + gap));
  const peaks = S.peaks;
  const mid = H / 2;
  for (let i = 0; i < n; i++) {
    const x = i * (bar + gap);
    let v = 0.04;
    if (peaks && peaks.length) {
      const a = Math.floor((i / n) * peaks.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length));
      v = 0;
      for (let j = a; j < b; j++) v = Math.max(v, peaks[j]);
      v = Math.max(0.04, v);
    }
    const hh = v * (H * 0.86);
    g.fillStyle = x / W < pos ? '#e3923a' : '#7a7a7a';
    g.fillRect(x, mid - hh / 2, bar, hh);
  }
  g.fillStyle = '#fff';
  g.fillRect(Math.round(pos * W) - dpr, 0, 2 * dpr, H);
}
new ResizeObserver(() => drawWave()).observe($('#wave-box'));
(function waveMouse() {
  const box = $('#wave-box');
  const tip = $('#wave-hover');
  const timeAt = (e) => { const r = box.getBoundingClientRect(); const d = audio.duration || (cur() && cur().duration) || 0; return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * d; };
  let dragging = false;
  box.addEventListener('mousedown', (e) => { if (!cur()) return; dragging = true; seek(timeAt(e)); });
  window.addEventListener('mousemove', (e) => { if (dragging) seek(timeAt(e)); });
  window.addEventListener('mouseup', () => { dragging = false; });
  box.addEventListener('mousemove', (e) => {
    if (!cur()) return;
    const r = box.getBoundingClientRect();
    tip.hidden = false;
    tip.style.left = `${e.clientX - r.left}px`;
    tip.textContent = fmtTime(timeAt(e));
  });
  box.addEventListener('mouseleave', () => { tip.hidden = true; });
})();

// ---------------------------------------------------------------- library + filters
function visibleTracks() {
  const f = S.filters;
  const q = f.q.trim().toLowerCase();
  const has = (v, needle) => !needle || String(v || '').toLowerCase().includes(needle.trim().toLowerCase());
  return S.tracks.filter((t) => {
    if (q && ![t.title, t.artist, t.album, t.label, t.genre, t.date].some((v) => String(v || '').toLowerCase().includes(q))) return false;
    return has(t.artist, f.artist) && has(t.date, f.date) && has(t.label, f.label) && has(t.genre, f.genre);
  });
}
function renderGrid() {
  const grid = $('#grid');
  grid.innerHTML = '';
  const list = visibleTracks();
  grid.classList.toggle('fixed', list.length < 6);
  if (!S.tracks.length) {
    grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' }, html: 'Your library is empty.<br><b>Drop music or video files here</b>, or use the upload buttons below.<br>Videos are turned into MP3 automatically.' }));
  } else if (!list.length) {
    grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, 'No songs match your search or filters.'));
  }
  for (const t of list) {
    const card = h('div', { class: 'card', 'data-id': t.id, title: [t.title, t.artist, t.album].filter(Boolean).join(' — ') },
      h('div', { class: 'art' }, coverEl(t), t.isVideo ? h('span', { class: 'badge' }, 'from video') : null,
        h('button', { class: 'hover-play', title: 'Play', html: ICONS.play, onclick: (e) => { e.stopPropagation(); playTrack(t.id); } })),
      h('div', { class: 'name' }, t.title));
    grid.append(card);
  }
  markSelection();
  markPlaying();
  updateDatalists();
}
function markSelection() {
  const sel = new Set(S.selected);
  for (const c of $$('#grid .card')) c.classList.toggle('selected', sel.has(c.dataset.id));
  const n = S.selected.length;
  $('#sel-info').textContent = n > 1 ? `${n} selected` : `${visibleTracks().length} of ${S.tracks.length} songs`;
}
function markPlaying() { for (const c of $$('#grid .card')) c.classList.toggle('playing', c.dataset.id === S.currentId); }
function selectClick(id, e) {
  const ids = visibleTracks().map((t) => t.id);
  if (e.shiftKey && S.anchor && ids.includes(S.anchor)) {
    const [a, b] = [ids.indexOf(S.anchor), ids.indexOf(id)].sort((x, y) => x - y);
    const range = ids.slice(a, b + 1);
    S.selected = e.ctrlKey || e.metaKey ? [...new Set([...S.selected, ...range])] : range;
  } else if (e.ctrlKey || e.metaKey) {
    S.selected = S.selected.includes(id) ? S.selected.filter((x) => x !== id) : [...S.selected, id];
    S.anchor = id;
  } else {
    S.selected = [id];
    S.anchor = id;
  }
  markSelection();
}
$('#grid').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) { if (!e.ctrlKey && !e.shiftKey) { S.selected = []; markSelection(); } return; }
  selectClick(card.dataset.id, e);
});
$('#grid').addEventListener('dblclick', (e) => { const card = e.target.closest('.card'); if (card) playTrack(card.dataset.id); });
$('#grid').addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  e.preventDefault();
  if (!S.selected.includes(card.dataset.id)) { S.selected = [card.dataset.id]; S.anchor = card.dataset.id; markSelection(); }
  showCardMenu(e.clientX, e.clientY, card.dataset.id);
});
function updateDatalists() {
  for (const k of ['artist', 'date', 'label', 'genre']) {
    const vals = [...new Set(S.tracks.map((t) => (t[k] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    $(`#dl-${k}`).innerHTML = vals.map((v) => `<option value="${esc(v)}">`).join('');
  }
}
function setZoom(v) {
  v = Math.max(80, Math.min(280, +v));
  $('#grid').style.setProperty('--size', `${v}px`);
  $('#zoom').value = v;
  $('#zoom').style.setProperty('--pct', `${((v - 80) / 200) * 100}%`);
  clearTimeout(setZoom.t);
  setZoom.t = setTimeout(() => tf.settings({ zoom: v }), 400);
}
$('#zoom').addEventListener('input', (e) => setZoom(e.target.value));
$('#zoom-in').addEventListener('click', () => setZoom(+$('#zoom').value + 20));
$('#zoom-out').addEventListener('click', () => setZoom(+$('#zoom').value - 20));
$('#grid-wrap').addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); setZoom(+$('#zoom').value - Math.sign(e.deltaY) * 12); } }, { passive: false });

for (const [id, key] of [['#search', 'q'], ['#f-artist', 'artist'], ['#f-date', 'date'], ['#f-label', 'label'], ['#f-genre', 'genre']]) {
  $(id).addEventListener('input', (e) => { S.filters[key] = e.target.value; renderGrid(); if (S.view !== 'library') showView('library'); });
}
$('#f-clear').addEventListener('click', () => {
  S.filters = { q: '', artist: '', date: '', label: '', genre: '' };
  for (const id of ['#search', '#f-artist', '#f-date', '#f-label', '#f-genre']) $(id).value = '';
  renderGrid();
});

// ---------------------------------------------------------------- context menu
function showCardMenu(x, y, id) {
  const m = $('#ctxmenu');
  const many = S.selected.length > 1;
  const items = [
    ['Play', () => playTrack(id)],
    ['Change picture…', () => changeCover(id)],
    null,
    ['Save as MP3…', () => openSaveModal(id)],
    many ? [`Save ${S.selected.length} songs as album / one file…`, () => openAlbumModal()] : null,
    null,
    ['Show original file', () => tf.showItem(S.byId.get(id).srcPath)],
    [many ? `Remove ${S.selected.length} songs from library` : 'Remove from library', () => removeSelected()],
  ];
  m.innerHTML = '';
  let lastSep = true;
  for (const it of items) {
    if (it === null) { if (!lastSep) m.append(h('hr')); lastSep = true; continue; }
    if (!it) continue;
    m.append(h('button', { onclick: () => { hideMenu(); it[1](); } }, it[0]));
    lastSep = false;
  }
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = `${Math.min(x, innerWidth - r.width - 6)}px`;
  m.style.top = `${Math.min(y, innerHeight - r.height - 6)}px`;
}
function hideMenu() { $('#ctxmenu').hidden = true; }
window.addEventListener('mousedown', (e) => { if (!e.target.closest('#ctxmenu')) hideMenu(); });
window.addEventListener('blur', hideMenu);

// ---------------------------------------------------------------- import
async function importPaths(paths) {
  if (!paths || !paths.length) return;
  const r = await guard(() => tf.importPaths(paths), 'Import: ');
  if (!r) return;
  for (const t of r.added) upsertTrack(t);
  renderGrid();
  const parts = [`${r.added.length} added`];
  if (r.skipped) parts.push(`${r.skipped} already in library`);
  if (r.failed) parts.push(`${r.failed} failed (the file may be damaged or have no sound)`);
  toast(parts.join(', '), { type: r.failed ? 'error' : 'ok' });
  if (r.added.length) { S.selected = r.added.map((t) => t.id); markSelection(); if (!S.currentId) loadTrack(r.added[0].id); }
}
$('#btn-upload-file').addEventListener('click', async () => importPaths(await guard(() => tf.pickFiles())));
$('#btn-upload-folder').addEventListener('click', async () => importPaths(await guard(() => tf.pickFolder())));

// drag & drop anywhere
let dragDepth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; if (!e.target.closest?.('#convert-drop')) $('#drop-overlay').hidden = false; });
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#drop-overlay').hidden = true; });
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('#drop-overlay').hidden = true;
  const paths = [...e.dataTransfer.files].map((f) => tf.pathForFile(f)).filter(Boolean);
  if (e.target.closest?.('#convert-drop')) addConvertFiles(paths);
  else importPaths(paths);
});

// ---------------------------------------------------------------- remove / cover
async function removeSelected() {
  const ids = [...S.selected];
  if (!ids.length) return;
  const ok = await confirmModal(`Remove ${ids.length === 1 ? `"${S.byId.get(ids[0]).title}"` : `${ids.length} songs`} from the library?`, 'Your original files are not deleted. Converted MP3s made from videos are deleted.', 'Remove');
  if (!ok) return;
  await guard(() => tf.removeTracks(ids));
  for (const id of ids) {
    S.byId.delete(id);
    S.tabs = S.tabs.filter((x) => x !== id);
    if (S.currentId === id) { audio.pause(); audio.removeAttribute('src'); audio.load(); S.currentId = null; S.peaks = null; }
  }
  S.tracks = S.tracks.filter((t) => !ids.includes(t.id));
  S.queue = S.queue.filter((id) => !ids.includes(id));
  S.selected = [];
  if (!S.tabs.includes(S.activeTab)) S.activeTab = S.tabs[0] || null;
  renderAll();
}
async function changeCover(id) {
  const img = await guard(() => tf.pickImage());
  if (!img) return;
  const t = await guard(() => tf.setCover(id, img), 'Picture: ');
  if (t) { upsertTrack(t); renderAll(); toast('Picture updated', { type: 'ok' }); }
}
async function removeCover(id) {
  const t = await guard(() => tf.setCover(id, null));
  if (t) { upsertTrack(t); renderAll(); }
}

// ---------------------------------------------------------------- modals
function modal(build) {
  return new Promise((resolve) => {
    const back = h('div', { class: 'modal-back' });
    const box = h('div', { class: 'modal' });
    back.append(box);
    const close = (v) => { back.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(undefined); } };
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(undefined); });
    build(box, close);
    $('#modal-root').append(back);
    const first = box.querySelector('[autofocus]') || box.querySelector('input, button.primary');
    if (first) first.focus();
  });
}
function confirmModal(title, text, okLabel = 'OK') {
  return modal((box, close) => {
    box.style.width = 'min(480px, 94vw)';
    box.append(h('h2', {}, title), h('p', { class: 'muted' }, text),
      h('div', { class: 'foot' }, h('span', { class: 'muted' }), h('button', { class: 'btn', onclick: () => close(false) }, 'Cancel'), h('button', { class: 'btn primary danger', onclick: () => close(true) }, okLabel)));
  });
}
function saveTargetText() {
  return S.settings.askWhereToSave ? 'You will choose where to save.' : `Saves instantly to: ${S.settings.exportDir}`;
}
function fxSummary(fx) {
  const d = S.defaults;
  const p = [];
  if (fx.speed !== d.speed) p.push(`speed ${fx.speed}%`);
  if (fx.pitch !== d.pitch) p.push(`pitch ${fx.pitch}%`);
  if (fx.volume !== d.volume) p.push(`volume ${fx.volume}%`);
  if (fx.fadeIn) p.push(`fade in ${fx.fadeIn.toFixed(2)} s`);
  if (fx.fadeOut) p.push(`fade out ${fx.fadeOut.toFixed(2)} s`);
  return p.length ? `Effects: ${p.join(', ')}` : 'No effects (original sound)';
}
async function chosenPicture(img) {
  const url = await tf.imagePreview(img).catch(() => null);
  return url ? h('img', { class: 'cover-img', src: url, alt: '' }) : h('div', { class: 'ph', style: { background: '#333' } }, h('span', {}, 'New picture chosen'));
}
async function afterSave(r) {
  if (!r || r.canceled) return;
  if (r.track) upsertTrack(r.track);
  renderAll();
  toast(`Saved: ${r.path}`, { type: 'ok', action: () => tf.showItem(r.path), actionLabel: 'Show', ms: 8000 });
}

// 6.2 save one song as MP3 with picture
async function openSaveModal(id) {
  id = id || (S.selected.length === 1 ? S.selected[0] : S.currentId) || S.selected[0];
  const t = S.byId.get(id);
  if (!t) { toast('Pick a song first (click one in the library).'); return; }
  let coverImage = null;
  await modal((box, close) => {
    const fields = {};
    const field = (k, label, cls = '') => h('label', { class: `field ${cls}` }, label, (fields[k] = h('input', { value: t[k] || '', spellcheck: 'false' })));
    const art = h('div', { class: 'cover-pick', title: 'Click to choose a picture' }, coverEl(t));
    const warn = h('div', { class: 'warn-text', hidden: !!t.coverUrl }, 'No picture yet — click the square to choose one.');
    art.addEventListener('click', async () => {
      const img = await guard(() => tf.pickImage());
      if (!img) return;
      coverImage = img;
      art.innerHTML = '';
      art.append(await chosenPicture(img));
      warn.hidden = true;
    });
    const doSave = async () => {
      const tags = Object.fromEntries(Object.entries(fields).map(([k, i]) => [k, i.value.trim()]));
      if (!tags.title) tags.title = t.title;
      close();
      await afterSave(await guard(() => tf.exportTrack(t.id, { tags, coverImage }), 'Save: '));
    };
    box.append(
      h('h2', {}, 'Save song as MP3'),
      h('div', { class: 'ed' },
        h('div', {}, art, warn),
        h('div', { class: 'form' }, field('title', 'Title', 'full'), field('artist', 'Artist'), field('album', 'Album'), field('date', 'Date'), field('genre', 'Genre'), field('label', 'Label', 'full'))),
      h('p', { class: 'muted', style: { marginTop: '14px' } }, fxSummary(t.fx)),
      h('div', { class: 'foot' }, h('span', { class: 'muted' }, saveTargetText()), h('button', { class: 'btn', onclick: () => close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: doSave }, 'Save MP3')),
    );
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
  });
}

// 6.3 save many songs as one big MP3 or as an album
async function openAlbumModal() {
  let ids = S.selected.filter((id) => S.byId.has(id));
  if (ids.length < 2) { toast('Select 2 or more songs first: Ctrl+click or Shift+click them in the library (Ctrl+A selects all).', { ms: 7000 }); return; }
  let coverImage = null, coverPreview = null;
  let coverTrackId = (ids.map((id) => S.byId.get(id)).find((t) => t.coverUrl) || {}).id || null;
  await modal((box, close) => {
    const first = S.byId.get(ids[0]);
    const inp = (v, ph) => h('input', { value: v || '', placeholder: ph || '', spellcheck: 'false' });
    const f = { title: inp(first.album || 'My Album'), artist: inp(first.artist), date: inp(first.date), genre: inp(first.genre), label: inp(first.label) };
    const art = h('div', { class: 'cover-pick', title: 'Click to choose a picture' });
    const warn = h('div', { class: 'warn-text' }, 'No picture yet — click the square, or click a song\'s small picture below.');
    const list = h('div', { class: 'song-list' });
    const renderCover = () => {
      art.innerHTML = '';
      if (coverImage) art.append(coverPreview || h('div', { class: 'ph', style: { background: '#333' } }, h('span', {}, 'New picture chosen')));
      else if (coverTrackId) art.append(coverEl(S.byId.get(coverTrackId)));
      else art.append(placeholder({ title: f.title.value || 'Album' }));
      warn.hidden = !!(coverImage || coverTrackId);
    };
    const renderList = () => {
      list.innerHTML = '';
      ids.forEach((id, i) => {
        const t = S.byId.get(id);
        const mini = h('div', { class: `mini-art${!coverImage && coverTrackId === id ? ' chosen' : ''}`, title: t.coverUrl ? 'Use this picture as the cover' : 'No picture' }, coverEl(t));
        if (t.coverUrl) mini.addEventListener('click', () => { coverTrackId = id; coverImage = null; renderCover(); renderList(); });
        list.append(h('div', { class: 'song-row' }, h('span', { class: 'n' }, i + 1), mini, h('span', { class: 't' }, t.title, t.artist ? h('span', { class: 'muted' }, ` — ${t.artist}`) : null),
          h('button', { title: 'Move up', html: ICONS.up, disabled: i === 0, onclick: () => { [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; renderList(); } }),
          h('button', { title: 'Move down', html: ICONS.down, disabled: i === ids.length - 1, onclick: () => { [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; renderList(); } }),
          h('button', { title: 'Leave out', html: ICONS.close, disabled: ids.length <= 2, onclick: () => { ids = ids.filter((x) => x !== id); if (coverTrackId === id) coverTrackId = null; renderList(); renderCover(); } })));
      });
    };
    art.addEventListener('click', async () => {
      const img = await guard(() => tf.pickImage());
      if (img) { coverImage = img; coverPreview = await chosenPicture(img); renderCover(); renderList(); }
    });
    f.title.addEventListener('input', () => { if (!coverImage && !coverTrackId) renderCover(); });
    const radio = (val, title, text, checked) => h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'mode', value: val, checked }), h('div', {}, h('b', {}, title), h('div', { class: 'muted' }, text)));
    const modes = h('div', {},
      radio('single', 'One big MP3', 'All songs joined into one file, with a chapter mark at each song.', true),
      radio('album', 'Album folder', 'One MP3 per song in a new folder, numbered, all with the album name and this picture.', false));
    const doSave = async () => {
      const mode = $('input[name=mode]:checked', box).value;
      const opts = { mode, title: f.title.value.trim() || 'My Album', artist: f.artist.value.trim(), date: f.date.value.trim(), genre: f.genre.value.trim(), label: f.label.value.trim(), coverImage, coverTrackId: coverImage ? null : coverTrackId };
      close();
      await afterSave(await guard(() => tf.exportMany(ids, opts), 'Save: '));
    };
    renderCover();
    renderList();
    box.append(
      h('h2', {}, `Save ${ids.length} songs together`),
      h('div', { class: 'ed' },
        h('div', {}, art, warn),
        h('div', {},
          h('div', { class: 'form' },
            h('label', { class: 'field full' }, 'Album / file name', f.title),
            h('label', { class: 'field' }, 'Artist', f.artist), h('label', { class: 'field' }, 'Date', f.date),
            h('label', { class: 'field' }, 'Genre', f.genre), h('label', { class: 'field' }, 'Label', f.label)),
          modes)),
      h('p', { class: 'muted', style: { margin: '14px 0 6px' } }, 'Order (each song keeps its own speed, pitch, volume and fades):'),
      list,
      h('div', { class: 'foot' }, h('span', { class: 'muted' }, saveTargetText()), h('button', { class: 'btn', onclick: () => close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: doSave }, 'Save')),
    );
  });
}
$('#btn-save').addEventListener('click', () => openSaveModal());
$('#btn-save-many').addEventListener('click', () => openAlbumModal());

// ---------------------------------------------------------------- editor (tabs + details)
function openTab(id, activate = true) {
  if (!S.tabs.includes(id)) S.tabs.push(id);
  if (activate || !S.activeTab) S.activeTab = id;
  if (!activate) S.activeTab = id;
  renderEditor();
}
function closeTab(id) {
  const i = S.tabs.indexOf(id);
  S.tabs = S.tabs.filter((x) => x !== id);
  if (S.activeTab === id) S.activeTab = S.tabs[Math.min(i, S.tabs.length - 1)] || null;
  renderEditor();
}
function renderEditor() {
  const tabs = $('#tabs');
  tabs.innerHTML = '';
  for (const id of S.tabs) {
    const t = S.byId.get(id);
    if (!t) continue;
    const tab = h('div', { class: `tab${id === S.activeTab ? ' active' : ''}`, title: t.title },
      h('span', {}, t.title),
      h('button', { class: 'x', html: ICONS.close, title: 'Close', onclick: (e) => { e.stopPropagation(); closeTab(id); } }));
    tab.addEventListener('click', () => { S.activeTab = id; if (S.currentId !== id) loadTrack(id); else renderEditor(); });
    tab.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(id); });
    tabs.append(tab);
  }
  const body = $('#editor-body');
  body.innerHTML = '';
  const t = S.byId.get(S.activeTab);
  if (!t) { body.append(h('div', { class: 'empty' }, 'No song open. Play or double-click a song in the library to open it here.')); return; }
  const save = (k) => async (e) => {
    const v = e.target.value.trim();
    if ((t[k] || '') === v) return;
    if (k === 'title' && !v) { e.target.value = t.title; return; }
    const r = await guard(() => tf.updateTrack(t.id, { [k]: v }));
    if (r) { upsertTrack(r); renderGrid(); renderNow(); renderNext(); $$('#tabs .tab span')[S.tabs.indexOf(t.id)].textContent = r.title; }
  };
  const field = (k, label, cls = '') => h('label', { class: `field ${cls}` }, label, h('input', { value: t[k] || '', spellcheck: 'false', onchange: save(k), list: ['artist', 'date', 'label', 'genre'].includes(k) ? `dl-${k}` : null }));
  body.append(h('div', { class: 'ed' },
    h('div', {},
      h('div', { class: 'ed-cover' }, coverEl(t)),
      h('div', { class: 'ed-cover-btns' },
        h('button', { class: 'btn', onclick: () => changeCover(t.id) }, 'Change picture…'),
        t.coverUrl ? h('button', { class: 'btn', onclick: () => removeCover(t.id) }, 'Remove') : null)),
    h('div', {},
      h('div', { class: 'form' }, field('title', 'Title', 'full'), field('artist', 'Artist'), field('album', 'Album'), field('date', 'Date'), field('label', 'Label'), field('genre', 'Genre', 'full')),
      h('div', { class: 'row', style: { marginTop: '16px' } },
        h('button', { class: 'btn primary', onclick: () => openSaveModal(t.id) }, 'Save as MP3…'),
        h('button', { class: 'btn', onclick: () => { if (S.currentId !== t.id) loadTrack(t.id, { autoplay: true }); else togglePlay(); } }, 'Play'),
        h('button', { class: 'btn', onclick: () => { if (S.currentId === t.id) { for (const f of FX) t.fx[f.key] = S.defaults[f.key]; setFx('speed', S.defaults.speed); } else { tf.updateTrack(t.id, { fx: { ...S.defaults } }).then(upsertTrack); } toast('Effects reset'); } }, 'Reset all effects')),
      h('div', { class: 'info' },
        h('div', {}, h('b', {}, 'Length: '), fmtTime(t.duration), '   ', h('b', {}, fxSummary(t.fx))),
        h('div', {}, h('b', {}, 'Original file: '), t.srcPath),
        t.converted ? h('div', {}, h('b', {}, 'Converted MP3: '), t.mediaPath) : null))));
}

// ---------------------------------------------------------------- tools
let convertList = [];
function addConvertFiles(paths) {
  convertList = [...new Set([...convertList, ...(paths || [])])];
  renderConvert();
}
function renderConvert() {
  const l = $('#convert-list');
  l.innerHTML = '';
  l.classList.toggle('muted', !convertList.length);
  if (!convertList.length) l.textContent = 'No files chosen';
  for (const p of convertList) l.append(h('div', {}, p));
  $('#convert-go').disabled = !convertList.length;
  $('#convert-dest').textContent = `→ ${S.settings.exportDir || ''}`;
}
$('#convert-pick').addEventListener('click', async () => addConvertFiles(await guard(() => tf.pickFiles())));
$('#convert-pick-folder').addEventListener('click', async () => addConvertFiles(await guard(() => tf.pickFolder())));
$('#convert-clear').addEventListener('click', () => { convertList = []; renderConvert(); });
$('#convert-go').addEventListener('click', async () => {
  const files = convertList;
  convertList = [];
  renderConvert();
  const r = await guard(() => tf.convertFiles(files, S.settings.exportDir), 'Convert: ');
  if (r) toast(`Converted ${r.length} file(s)`, { type: 'ok', action: () => tf.openPath(S.settings.exportDir), actionLabel: 'Open folder' });
});
const cd = $('#convert-drop');
cd.addEventListener('dragover', (e) => { e.preventDefault(); cd.classList.add('over'); });
cd.addEventListener('dragleave', () => cd.classList.remove('over'));
cd.addEventListener('drop', () => cd.classList.remove('over'));
async function exportCurrent(format) {
  const t = cur();
  if (!t) { toast('Play a song first.'); return; }
  await afterSave(await guard(() => tf.exportTrack(t.id, { format }), 'Save: '));
}
$('#export-mp3').addEventListener('click', () => exportCurrent('mp3'));
$('#export-wav').addEventListener('click', () => exportCurrent('wav'));
$('#log-clear').addEventListener('click', () => { $('#terminal').innerHTML = ''; });

// ---------------------------------------------------------------- settings
function renderSettings() {
  $('#set-export-dir').value = S.settings.exportDir || '';
  $('#set-ask').checked = !!S.settings.askWhereToSave;
  $('#set-bitrate').value = String(S.settings.bitrate || 320);
  renderConvert();
}
async function patchSettings(p) {
  const s = await guard(() => tf.settings(p));
  if (s) { S.settings = s; renderSettings(); }
}
$('#set-export-pick').addEventListener('click', async () => { const d = await guard(() => tf.pickDir(S.settings.exportDir)); if (d) patchSettings({ exportDir: d }); });
$('#set-export-open').addEventListener('click', () => tf.openPath(S.settings.exportDir));
$('#set-ask').addEventListener('change', (e) => patchSettings({ askWhereToSave: e.target.checked }));
$('#set-bitrate').addEventListener('change', (e) => patchSettings({ bitrate: +e.target.value }));
$('#set-lib-open').addEventListener('click', () => tf.openPath($('#set-lib-dir').value));

// ---------------------------------------------------------------- views
// Hidden until each button is planned with the user. The code is kept.
const HIDDEN_VIEWS = ['editor', 'tools', 'settings'];
function showView(v) {
  if (HIDDEN_VIEWS.includes(v)) return;
  S.view = v;
  for (const b of $$('.nav')) b.classList.toggle('active', b.dataset.view === v);
  for (const el of $$('.view')) el.classList.toggle('active', el.id === `view-${v}`);
  $('#main').classList.toggle('no-right', v !== 'library');
  if (v === 'tools') { const term = $('#terminal'); term.scrollTop = term.scrollHeight; }
  requestAnimationFrame(drawWave);
}
for (const b of $$('.nav')) {
  b.hidden = HIDDEN_VIEWS.includes(b.dataset.view);
  b.addEventListener('click', () => showView(b.dataset.view));
}

function renderAll() {
  renderGrid();
  renderNow();
  renderNext();
  renderFx();
  renderEditor();
  renderSettings();
  drawWave();
}

// ---------------------------------------------------------------- transport + keys
$('#back30').addEventListener('click', () => skip(-30));
$('#back5').addEventListener('click', () => skip(-5));
$('#fwd5').addEventListener('click', () => skip(5));
$('#fwd30').addEventListener('click', () => skip(30));
$('#play').addEventListener('click', togglePlay);
document.addEventListener('keydown', (e) => {
  const typing = e.target.closest('input, textarea, select') && e.target.type !== 'range' && e.target.type !== 'checkbox';
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); showView('library'); $('#search').focus(); $('#search').select(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (!$('.modal-back')) openSaveModal(); return; }
  if (mod && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); showView(['library', 'editor', 'tools', 'settings'][+e.key - 1]); return; }
  if (typing || $('.modal-back')) return;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); skip(e.shiftKey ? -30 : -5); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); skip(e.shiftKey ? 30 : 5); }
  else if (mod && e.key.toLowerCase() === 'a' && S.view === 'library') { e.preventDefault(); S.selected = visibleTracks().map((t) => t.id); markSelection(); }
  else if (e.key === 'Delete' && S.view === 'library' && S.selected.length) removeSelected();
  else if (e.key === 'Enter' && S.view === 'library' && S.selected.length === 1) playTrack(S.selected[0]);
});
// Keep the space bar from "clicking" the last pressed button.
document.addEventListener('keyup', (e) => { if (e.key === ' ' && e.target.tagName === 'BUTTON') e.preventDefault(); });
document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.closest('.modal')) b.blur(); });

// ---------------------------------------------------------------- progress from main
function showJob(label, p) {
  const job = $('#job');
  job.hidden = false;
  $('#job-label').textContent = label;
  $('#job-fill').style.width = `${Math.round(p * 100)}%`;
  clearTimeout(showJob.t);
  if (p >= 1) showJob.t = setTimeout(() => { job.hidden = true; }, 1200);
}
tf.onImportProgress(({ done, total, name }) => showJob(done >= total ? 'Import done' : `Adding ${Math.floor(done) + 1}/${total}: ${name}`, total ? done / total : 1));
tf.onExportProgress(({ p, label }) => showJob(p >= 1 ? 'Saved' : `Saving ${label}… ${Math.round(p * 100)}%`, p));
tf.onLog(({ level, msg, time }) => addLog(level, msg, time));

// ---------------------------------------------------------------- start
(async function init() {
  for (const b of $$('.nav')) b.innerHTML = ICONS[{ library: 'search', editor: 'page', tools: 'caliper', settings: 'gear' }[b.dataset.view]];
  const icon = (sel, name) => { $(sel).innerHTML = ICONS[name]; };
  icon('#btn-upload-file', 'cloudUp'); icon('#btn-upload-folder', 'folderUp'); icon('#btn-save', 'save'); icon('#btn-save-many', 'saveMany');
  icon('#zoom-in', 'zoomIn'); icon('#zoom-out', 'zoomOut');
  icon('#back30', 'back30'); icon('#back5', 'back5'); icon('#fwd5', 'fwd5'); icon('#fwd30', 'fwd30'); icon('#play', 'play');
  const st = await tf.state();
  setTracks(st.tracks);
  S.settings = st.settings;
  S.limits = st.limits;
  S.defaults = st.defaults;
  $('#set-lib-dir').value = st.libraryDir;
  buildFxCards();
  setZoom(S.settings.zoom || 150);
  showView('library');
  renderAll();
  tf.ffmpegInfo().then((i) => { $('#ffmpeg-info').textContent = `Audio engine: ${i.version}`; }).catch((e) => {
    $('#ffmpeg-info').textContent = `ffmpeg not found: ${e.message}`;
    toast('ffmpeg was not found, so converting and saving will not work. See README.', { type: 'error', ms: 12000 });
  });
  window.__tfReady = true;
})();
