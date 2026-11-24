'use strict';
/* global ICONS, tf, TFStudio, TFSaveName, TFPlaylists, TFShuffle, TFStars, TFSmart, TFEdit, TFBatch */
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
  filters: { q: '', artist: '', date: '', label: '', genre: '', stars: null },
  libTab: 'all', // All / Recently added / From videos
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
// Two players ("decks"). One is the main player. During a crossfade the old song keeps playing on its
// deck while it fades out, and the other deck becomes the main player for the next song.
function makePlayer() {
  const a = new Audio();
  a.crossOrigin = 'anonymous';
  a.preload = 'auto';
  a.preservesPitch = true;
  return a;
}
const decks = [{ el: makePlayer() }, { el: makePlayer() }];
let deck = decks[0];
let audio = deck.el; // always the main player
let actx = null, shifter = null, gainNode = null, engine = null;
// listen on both players, but only react to the main one
function onAudio(type, fn) { for (const d of decks) d.el.addEventListener(type, (e) => { if (e.target === audio) fn(e); }); }
function ensureEngine() {
  if (engine) return engine;
  engine = (async () => {
    actx = new AudioContext({ latencyHint: 'playback' });
    let pitchOk = true;
    try { await actx.audioWorklet.addModule('pitch-worklet.js'); } catch (e) {
      pitchOk = false;
      addLog('warn', `Pitch preview not available (${e.message}). Saved files still get the pitch change.`);
    }
    for (const d of decks) {
      const src = actx.createMediaElementSource(d.el);
      d.gain = actx.createGain();
      d.orig = actx.createGain(); // the original song; silenced while a studio-pitched copy plays (studio.js)
      if (pitchOk) {
        d.shifter = new AudioWorkletNode(actx, 'pitch-shifter', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
        src.connect(d.shifter).connect(d.orig);
      } else src.connect(d.orig);
      d.orig.connect(d.gain);
      d.gain.connect(actx.destination);
    }
    shifter = deck.shifter || null;
    gainNode = deck.gain;
    TFStudio.attach(actx, decks, { main: () => deck, onStatus: renderStudio, onFallback: () => applyFx(), log: addLog });
    applyFx();
  })();
  return engine;
}
// Start a crossfade: the playing song fades out over `secs` on its own deck, and the other deck takes over
// (the next song loaded after this call fades in over the same time).
function beginCrossfade(secs) {
  if (!gainNode || !(secs > 0)) return false;
  const old = deck, now = actx.currentTime;
  old.gain.gain.cancelScheduledValues(now);
  old.gain.gain.setValueAtTime(old.gain.gain.value, now);
  old.gain.gain.linearRampToValueAtTime(0, now + secs);
  clearTimeout(old.tail);
  old.tail = setTimeout(() => old.el.pause(), secs * 1000 + 200);
  deck = decks[1 - decks.indexOf(old)];
  clearTimeout(deck.tail);
  deck.gain.gain.cancelScheduledValues(now);
  audio = deck.el;
  shifter = deck.shifter || null;
  gainNode = deck.gain;
  S.fadeIn = { t0: now, secs };
  return true;
}
function envelope(t, fx, dur) {
  const sp = fx.speed / 100;
  let e = 1;
  if (fx.fadeIn > 0) e = Math.min(e, (t / sp) / fx.fadeIn);
  if (fx.fadeOut > 0 && dur > 0) e = Math.min(e, ((dur - t) / sp) / fx.fadeOut);
  return Math.max(0, Math.min(1, e));
}
// The Sound panel normally edits the playing song. On the Map it can edit one song stop's own copy
// instead (S.edit), and a stop played from the map uses that copy for the sound (S.playFx).
// Order: the selected map song, else the map song that is playing, else the playing library song.
const editTarget = () => S.edit || S.playStop || null;
const editFx = () => (editTarget() ? editTarget().fx : (cur() ? cur().fx : null));
const liveFx = () => S.playFx || (cur() ? cur().fx : S.defaults);
function setEdit(target) { S.edit = target; renderFx(); }
function applyFx() {
  const fx = liveFx();
  audio.defaultPlaybackRate = fx.speed / 100;
  audio.playbackRate = fx.speed / 100;
  audio.preservesPitch = true;
  TFStudio.update(deck, S.currentId, fx);
  // the old live shifter is only a backup, used if the studio tool cannot run
  if (shifter) shifter.parameters.get('pitch').setValueAtTime(TFStudio.fallback(deck) ? fx.pitch / 100 : 1, actx.currentTime);
  updateGain(true);
  renderStudio();
}
function updateGain(now) {
  if (!gainNode) return;
  const t = cur();
  const fx = liveFx();
  const dur = audio.duration || (t && t.duration) || 0;
  let xf = 1; // fading in during a crossfade
  if (S.fadeIn) { xf = Math.min(1, (actx.currentTime - S.fadeIn.t0) / S.fadeIn.secs); if (xf >= 1) S.fadeIn = null; }
  const vol = Math.min(fx.volume, S.settings.volumeLimit || 500);
  const target = S.muted ? 0 : (vol / 100) * ((S.master ?? 100) / 100) * envelope(audio.currentTime, fx, dur) * xf;
  if (now) gainNode.gain.setValueAtTime(target, actx.currentTime);
  else gainNode.gain.setTargetAtTime(target, actx.currentTime, 0.015);
}
async function play() {
  if (!cur()) { const first = visibleTracks()[0]; if (first) return playTrack(first.id); return; }
  TFEdit.stop(); // one thing plays at a time
  await ensureEngine();
  if (actx.state === 'suspended') await actx.resume();
  const waitFrom = actx.currentTime;
  await TFStudio.ready(deck, S.fadeIn ? 2500 : 6000); // a changed pitch: wait (about a second) for the clean studio copy
  if (S.fadeIn && actx.currentTime - waitFrom > 0.1) S.fadeIn.t0 = actx.currentTime; // waited: the blend-in starts now
  updateGain(true);
  try { await audio.play(); } catch (e) { if (e.name !== 'AbortError') toast(`Can't play this file: ${e.message}`, { type: 'error' }); }
}
function pause() { for (const d of decks) d.el.pause(); }
function togglePlay() {
  if (window.TFMap && window.TFMap.skipGap()) return; // in a quiet gap between two map songs: go on to the next song now
  if (audio.paused) play(); else pause();
}
function seek(t) {
  if (!cur()) return;
  const d = audio.duration || cur().duration || 0;
  audio.currentTime = Math.max(0, Math.min(d ? d - 0.05 : 0, t));
  updateGain(true);
  drawWave();
}
const skip = (s) => seek(audio.currentTime + s);

function loadTrack(id, { autoplay = false, keepQueue = true, stop = null } = {}) {
  const t = S.byId.get(id);
  if (!t) return;
  countPlay(); // the song that was playing: did you hear enough of it to count?
  S.currentId = id;
  S.heardId = id; S.heard = 0;
  if (!stop && window.TFMap) window.TFMap.stopPlay(); // a normal song was started: the map stops leading
  S.playStop = stop; // set when a song is played from the map: { fx, title, save }
  S.playFx = stop ? stop.fx : null;
  if (stop) { /* a map song: the map leads, the library / playlist order stays as it was */ }
  else if (!keepQueue || !S.queue.includes(id)) { S.queue = makeQueue(id); S.qPos = 0; }
  else if (S.queue[S.qPos] !== id) S.qPos = S.queue[(S.qPos ?? -1) + 1] === id ? (S.qPos ?? -1) + 1 : S.queue.lastIndexOf(id);
  if (!stop) topUpShuffle();
  audio.src = t.mediaUrl;
  audio.load();
  TFStudio.update(deck, id, liveFx(), { fresh: true });
  applyFx();
  const n = upNext()[0];
  if (n && !stop) TFStudio.prefetch(n.id, n.fx);
  openTab(id, false);
  S.peaks = null;
  tf.peaks(id).then((p) => { if (S.currentId === id) { S.peaks = p; drawWave(); } }).catch((e) => addLog('warn', `Waveform: ${e.message}`));
  renderNow();
  renderFx();
  renderNext();
  markPlaying();
  TFPlaylists.render();
  drawWave();
  if (autoplay) play();
}
// The order songs play in: the library as shown, or smart shuffle (Settings → Playing). The chosen song goes first.
function makeQueue(id) {
  const ids = visibleTracks().map((x) => x.id);
  if (!S.settings.shuffle) { S.shufflePool = null; if (!ids.includes(id)) ids.unshift(id); return ids; }
  return startShuffle(ids, id);
}
// Smart shuffle (shuffle.js): the next songs are picked one by one by weighted luck, always 3 ahead.
function startShuffle(poolIds, firstId) {
  S.shufflePool = poolIds.slice();
  S.queue = [firstId];
  S.qPos = -1; // the first song is not loaded yet
  topUpShuffle();
  return S.queue;
}
function topUpShuffle() {
  if (!S.shufflePool) return;
  const pool = S.shufflePool.map((id) => S.byId.get(id)).filter(Boolean);
  if (!pool.length) return;
  const i = Math.max(0, qPos());
  while (S.queue.length - 1 - i < 3) {
    const t = TFShuffle.pick(pool, S.queue, S.playClock || 0);
    if (!t) break;
    S.queue.push(t.id);
  }
  if (S.queue.length > 300) { const cut = S.queue.length - 200; S.queue = S.queue.slice(cut); S.qPos = Math.max(0, (S.qPos || 0) - cut); }
}
// A song counts as "played" for smart shuffle once you heard at least 30 s of it (or half, if shorter).
function countPlay() {
  const id = S.heardId, secs = S.heard || 0;
  S.heard = 0; S.heardId = null;
  const t = id && S.byId.get(id);
  if (!t || secs < Math.min(30, (t.duration || 60) / 2)) return;
  tf.trackPlayed(id).then((r) => { if (r) { upsertTrack(r.track); S.playClock = r.clock; markSongs(); } }).catch(() => {});
}
async function setMark(ids, mark, pool = S.tracks.length) {
  const list = await guard(() => tf.trackMark(ids, mark, pool));
  if (!list) return;
  for (const t of list) upsertTrack(t);
  markSongs();
  const n = ids.length === 1 ? `"${S.byId.get(ids[0]).title}"` : `${ids.length} songs`;
  toast(mark === 'black' ? `${n} will play much less in shuffle (about 1 in 10) for the next ${TFShuffle.windowOf(pool)} songs.`
    : mark === 'fav' ? `${n} will play more often in shuffle for the next ${TFShuffle.windowOf(pool)} songs.` : `${n} is back to normal.`, { type: 'ok', ms: 4000 });
}
// Little marks on song cards and playlist rows: 🚫 blacklisted, ♥ favourite, ↓ played a lot lately.
function markSongs() {
  const n = S.tracks.length;
  for (const c of $$('#grid .card')) {
    const t = S.byId.get(c.dataset.id);
    const b = t ? TFShuffle.badge(t, S.playClock || 0, n) : '';
    c.dataset.mark = b;
  }
  TFPlaylists.render();
}
function playTrack(id) {
  S.playlistId = null; // a library song: the library order, not a playlist
  S.queue = makeQueue(id);
  S.qPos = -1;
  loadTrack(id, { autoplay: true });
}
// Next / previous song (also used by the keyboard).
function nextSong() {
  if (window.TFMap && window.TFMap.playing) { window.TFMap.onEnded(); return; }
  const n = upNext()[0];
  if (n) loadTrack(n.id, { autoplay: true }); else toast('This is the last song.', { ms: 1500 });
}
function prevSong() {
  if (audio.currentTime > 3 || (window.TFMap && window.TFMap.playing)) { seek(0); return; }
  const i = qPos();
  if (i > 0) { S.qPos = i - 1; loadTrack(S.queue[i - 1], { autoplay: true }); } else seek(0);
}
// Blend library songs (Settings → Playing): start the next song a little before this one ends.
setInterval(() => {
  const secs = +S.settings.libraryBlend || 0;
  if (!secs || audio.paused || !(audio.duration > 0) || S.playFx || (window.TFMap && window.TFMap.playing)) return;
  if (S.settings.whenEnds !== 'next') return;
  const left = (audio.duration - audio.currentTime) / (audio.playbackRate || 1);
  const n = upNext()[0];
  if (!n || left > Math.min(secs, audio.duration / 2) || left < 0.15) return;
  if (beginCrossfade(left)) loadTrack(n.id, { autoplay: true });
}, 100);
// Where the playing song is in the play order. A song can be in the order more than once (shuffle),
// so the exact place is remembered (S.qPos) instead of searching for the song.
function qPos() {
  if (S.queue[S.qPos] === S.currentId) return S.qPos;
  return S.queue.lastIndexOf(S.currentId);
}
function upNext() {
  const i = qPos();
  return S.queue.slice(i + 1).map((id) => S.byId.get(id)).filter(Boolean);
}

onAudio('loadedmetadata', () => { applyFx(); drawWave(); });
onAudio('play', () => setPlayIcon(true));
onAudio('pause', () => setPlayIcon(false));
onAudio('ended', () => {
  countPlay(); // heard to the end: counts for smart shuffle
  S.heardId = S.currentId; // (a repeat of the same song counts again)
  if (window.TFMap && window.TFMap.onEnded()) return; // a map is playing: it picks the next song itself
  if (S.playFx) { setPlayIcon(false); return; }
  if (S.settings.whenEnds === 'repeat') { audio.currentTime = 0; play(); return; }
  if (S.settings.whenEnds === 'stop') { setPlayIcon(false); return; }
  const n = upNext()[0];
  if (n) loadTrack(n.id, { autoplay: true }); else { setPlayIcon(false); }
});
onAudio('error', () => {
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
  if (!audio.paused) { updateGain(false); drawWave(); S.heard = (S.heard || 0) + 0.04 * (audio.playbackRate || 1); }
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
  return f.unit === 's' ? `${sign}${s.toFixed(2)}` : `${sign}${s}`;
}
function buildFxCards() {
  const wrap = $('#fx-cards');
  wrap.innerHTML = '';
  for (const f of FX) {
    const [lo, hi] = S.limits[f.key];
    const input = h('input', { class: 'fx-val', 'data-key': f.key, spellcheck: 'false', title: `Type an exact value (${lo}–${hi} ${f.unit === 's' ? 'seconds' : '%'}) and press Enter` });
    const range = h('input', { type: 'range', min: lo, max: hi, step: f.unit === 's' ? 0.01 : 0.001, 'data-key': f.key, style: { '--c': f.color } });
    const btns = h('div', { class: 'fx-btns' },
      ...f.steps.map((s) => h('button', { title: `${stepLabel(f, s, '−')}`, onclick: () => nudge(f, -s) }, stepLabel(f, s, '−'))),
      h('button', { class: 'rs', title: 'Back to normal', onclick: () => setFx(f.key, S.defaults[f.key]), html: ICONS.reset }),
      ...[...f.steps].reverse().map((s) => h('button', { title: stepLabel(f, s, '+'), onclick: () => nudge(f, s) }, stepLabel(f, s, '+'))),
    );
    const card = h('div', { class: 'fx', style: { '--c': f.color }, 'data-key': f.key },
      h('div', { class: 'fx-head' }, h('span', { class: 'fx-dot' }), h('span', { class: 'fx-label' }, f.label),
        f.key === 'pitch' ? h('span', { class: 'fx-semis' }) : null,
        f.mute ? h('button', { class: 'mini', id: 'mute', onclick: toggleMute, title: 'Mute / unmute' }, 'Mute') : null,
        h('label', { class: 'fx-box', title: input.title }, input, h('span', { class: 'fx-unit' }, f.unit === 's' ? 's' : '%'))),
      range, btns,
      f.key === 'pitch' ? h('div', { class: 'fx-opt' },
        h('button', { class: 'fx-switch', id: 'fx-natural', role: 'switch', title: 'On: singers keep a human voice. Off: the classic chipmunk (higher) or deep (lower) voice.', onclick: () => setNatural(!(editFx() && editFx().natural !== false)) },
          h('span', { class: 'knob' }), 'Natural voice'),
        h('span', { class: 'fx-studio', id: 'fx-studio' })) : null,
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
// Main volume for the whole app (0-100%). It only changes what you hear, never saved files.
let masterTimer = null;
function setMaster(v, save = true) {
  v = Math.max(0, Math.min(100, Math.round(+v)));
  S.master = v;
  const m = $('#master');
  m.value = v;
  m.style.setProperty('--pct', `${v}%`);
  $('#master-val').textContent = `${v}%`;
  updateGain(true);
  if (save) { clearTimeout(masterTimer); masterTimer = setTimeout(() => tf.settings({ master: v }).catch(() => {}), 400); }
}
$('#master').addEventListener('input', (e) => setMaster(e.target.value));
function resetAllFx() {
  if (!editFx()) return;
  for (const f of FX) setFx(f.key, S.defaults[f.key]);
  setNatural(true);
  toast('All sound settings are back to normal');
}
$('#fx-reset-all').addEventListener('click', resetAllFx);
function commitInput(input, f) {
  const raw = input.value.replace(',', '.').replace(/[^\d.+-]/g, '');
  const v = parseFloat(raw);
  if (Number.isFinite(v)) setFx(f.key, v);
}
function nudge(f, d) {
  const fx = editFx();
  if (!fx) return;
  setFx(f.key, fx[f.key] + d);
}
let saveFxTimer = null;
function setFx(key, value, { fromSlider = false } = {}) {
  const target = editFx();
  if (!target) return;
  const f = FX.find((x) => x.key === key);
  const [lo, hi] = S.limits[key];
  const p = 10 ** f.dec;
  target[key] = Math.min(hi, Math.max(lo, Math.round(value * p) / p));
  applyFx();
  renderFx(fromSlider ? key : null);
  drawWave();
  if (editTarget()) { editTarget().save(); return; } // a map song: saved with the map, the library song is not touched
  const t = cur();
  clearTimeout(saveFxTimer);
  const id = t.id, fx = { ...t.fx };
  saveFxTimer = setTimeout(() => tf.updateTrack(id, { fx }).catch((e) => addLog('error', e.message)), 250);
}
function setNatural(on) {
  const target = editFx();
  if (!target) return;
  target.natural = !!on;
  applyFx();
  renderFx();
  if (editTarget()) { editTarget().save(); return; }
  const t = cur();
  clearTimeout(saveFxTimer);
  const id = t.id, fx = { ...t.fx };
  saveFxTimer = setTimeout(() => tf.updateTrack(id, { fx }).catch((e) => addLog('error', e.message)), 250);
}
// Pitch card: is the clean studio copy playing yet?
function renderStudio() {
  const el = $('#fx-studio');
  if (!el) return;
  const st = editFx() === liveFx() ? TFStudio.status(deck) : 'off';
  el.dataset.s = st;
  el.textContent = { preparing: 'Preparing clean sound…', ready: 'Studio quality', fallback: 'Basic preview (studio tool failed)' }[st] || '';
}
function renderFx(skipSliderKey) {
  const fx = editFx() || S.defaults;
  $('#fx-cards').classList.toggle('disabled', !editFx());
  $('#fx-for').textContent = editTarget() ? `on the map: ${editTarget().title}` : '';
  $('.fx-panel').classList.toggle('map-edit', !!editTarget());
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
  const nat = $('#fx-natural');
  nat.classList.toggle('on', fx.natural !== false);
  nat.setAttribute('aria-checked', String(fx.natural !== false));
  renderStudio();
}
function toggleMute() { S.muted = !S.muted; updateGain(true); renderFx(); }

// ---------------------------------------------------------------- left panel
function renderNow() {
  const t = cur();
  const c = $('#now-cover');
  c.innerHTML = '';
  c.append(coverEl(t));
  // the small song info in the player bar
  const fc = $('#ft-cover');
  fc.innerHTML = '';
  fc.append(coverEl(t));
  $('#ft-title').textContent = t ? t.title : 'Nothing playing';
  $('#ft-artist').textContent = t ? (t.artist || 'Unknown artist') : '';
  $('#now-title').innerHTML = t
    ? `<div class="np-title">${esc(t.title)}</div><div class="np-artist">${esc([t.artist || 'Unknown artist', t.genre].filter(Boolean).join(' · '))}</div>`
    : '<div class="np-title dim">Nothing playing</div><div class="np-artist">Double-click a song to play it</div>';
  document.title = t ? `${t.title} — Tonix` : 'Tonix';
}
function renderNext() {
  const box = $('#next-thumbs');
  box.innerHTML = '';
  const next = upNext();
  for (const t of next.slice(0, 3)) {
    box.append(h('div', { class: 'thumb', title: `${t.title}${t.artist ? ` — ${t.artist}` : ''}`, onclick: () => loadTrack(t.id, { autoplay: true }) }, coverEl(t)));
  }
  if (next.length > 3) box.append(h('div', { class: 'thumb more', title: next.slice(3).map((t) => t.title).join(', ') }, `+${next.length - 3}`));
  if (!next.length) box.append(h('span', { class: 'none' }, 'Nothing after this song'));
}

// ---------------------------------------------------------------- waveform
const wave = $('#wave');
const css = (n, d) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d;
// waveform colors come from the theme; refreshed when the look changes
let WAVE_DONE = '#c9d6ff', WAVE_TODO = 'rgba(255,255,255,.22)';
function refreshWaveColors() {
  const st = getComputedStyle(document.body);
  WAVE_DONE = st.getPropertyValue('--accent').trim() || WAVE_DONE;
  WAVE_TODO = st.getPropertyValue('--wave-todo').trim() || WAVE_TODO;
  drawWave();
}
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
  const lf = liveFx();
  const sp = lf.speed / 100;
  if (dur) {
    if (lf.fadeIn > 0) { g.fillStyle = 'rgba(224,59,59,.22)'; g.fillRect(0, 0, Math.min(1, (lf.fadeIn * sp) / dur) * W, H); }
    if (lf.fadeOut > 0) { const w = Math.min(1, (lf.fadeOut * sp) / dur) * W; g.fillStyle = 'rgba(154,70,227,.25)'; g.fillRect(W - w, 0, w, H); }
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
    g.fillStyle = x / W < pos ? WAVE_DONE : WAVE_TODO;
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
  const list = S.tracks.filter((t) => {
    if (S.libTab === 'video' && !t.isVideo) return false;
    if (q && ![t.title, t.artist, t.album, t.label, t.genre, t.date].some((v) => String(v || '').toLowerCase().includes(q))) return false;
    return has(t.artist, f.artist) && has(t.date, f.date) && has(t.label, f.label) && has(t.genre, f.genre) && TFStars.matches(t, f.stars);
  });
  if (S.libTab === 'recent') list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  return list;
}
function renderGrid() {
  const grid = $('#grid');
  grid.innerHTML = '';
  const list = visibleTracks();
  grid.classList.toggle('fixed', list.length < 6);
  const artists = new Set(S.tracks.map((t) => (t.artist || '').trim().toLowerCase()).filter(Boolean)).size;
  $('#lib-count').textContent = `${S.tracks.length} song${S.tracks.length === 1 ? '' : 's'} · ${artists} artist${artists === 1 ? '' : 's'}`;
  if (!S.tracks.length) {
    grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' }, html: 'Your library is empty.<br><b>Drop music or video files here</b>, or use the upload buttons below.<br>Videos are turned into MP3 automatically.' }));
  } else if (!list.length) {
    grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, S.libTab === 'video' ? 'No songs came from video files yet.' : 'No songs match your search or filters.'));
  }
  for (const t of list) {
    const card = h('div', { class: 'card', draggable: 'true', 'data-id': t.id, title: [t.title, t.artist, t.album].filter(Boolean).join(' — ') },
      h('div', { class: 'art' }, coverEl(t), t.isVideo && S.settings.videoBadge !== false ? h('span', { class: 'badge' }, 'from video') : null,
        h('button', { class: 'hover-play', title: 'Play', html: ICONS.play, onclick: (e) => { e.stopPropagation(); playTrack(t.id); } })),
      h('div', { class: 'name' }, t.title),
      h('div', { class: 'artist' }, t.artist || 'Unknown artist'),
      TFStars.row(t.stars, (n) => setStars(t.id, n), { small: true }));
    grid.append(card);
  }
  markSelection();
  markPlaying();
  markSongs();
  updateDatalists();
}
function markSelection() {
  const sel = new Set(S.selected);
  for (const c of $$('#grid .card')) c.classList.toggle('selected', sel.has(c.dataset.id));
  const n = S.selected.length;
  $('#btn-save-many span:last-child').textContent = n > 1 ? `Save ${n} songs` : 'Save album';
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
// drag song cards onto a playlist (a bar with the playlists appears)
$('#grid').addEventListener('dragstart', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const ids = S.selected.includes(card.dataset.id) ? [...S.selected] : [card.dataset.id];
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/x-tonix-songs', ids.join(','));
  TFPlaylists.startDrag(ids);
});
$('#grid').addEventListener('dragend', () => TFPlaylists.endDrag());
$('#grid').addEventListener('dblclick', (e) => { const card = e.target.closest('.card'); if (card) playTrack(card.dataset.id); });
$('#grid').addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  e.preventDefault();
  if (!S.selected.includes(card.dataset.id)) { S.selected = [card.dataset.id]; S.anchor = card.dataset.id; markSelection(); }
  showCardMenu(e.clientX, e.clientY, card.dataset.id);
});
// Stars 1-10 for a song (0 = no stars). Saved right away.
async function setStars(id, n) {
  const t = await guard(() => tf.updateTrack(id, { stars: n || null }));
  if (!t) return;
  upsertTrack(t);
  if (S.filters.stars && S.filters.stars.n) renderGrid(); // it may now match the star filter, or not
  TFPlaylists.render(); // smart playlists (genre + stars) move the song by themselves
}
// Filters → Stars: pick a number of stars, then "or more" / "exactly" / "or less". Click the star again to clear.
function renderStarFilter() {
  const box = $('#f-stars');
  const f = S.filters.stars || { n: 0, mode: 'more' };
  box.innerHTML = '';
  box.append(TFStars.row(f.n, (n) => { S.filters.stars = n ? { n, mode: f.mode } : null; renderStarFilter(); renderGrid(); }, { title: 'Star filter' }),
    h('div', { class: 'seg fstar-seg' }, ...[['more', 'or more'], ['exact', 'exactly'], ['less', 'or less']].map(([m, l]) => h('button', {
      class: f.n && f.mode === m ? 'on' : '', disabled: !f.n, title: f.n ? `${f.n}⭐ ${l}` : 'Click a star first',
      onclick: () => { S.filters.stars = { n: f.n, mode: m }; renderStarFilter(); renderGrid(); } }, l))),
    h('div', { class: 'fnone' }, f.n ? `Showing ${TFStars.label(f)} (songs without stars are hidden)` : 'Click a star to filter, e.g. 6 then "or more"'));
}
function updateDatalists() {
  for (const k of ['artist', 'date', 'label', 'genre']) {
    const vals = [...new Set(S.tracks.map((t) => (t[k] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    $(`#dl-${k}`).innerHTML = vals.map((v) => `<option value="${esc(v)}">`).join('');
    // Clickable chips: the most common values first (at most 8). Click to filter, click again to clear.
    const count = new Map();
    for (const t of S.tracks) { const v = (t[k] || '').trim(); if (v) count.set(v, (count.get(v) || 0) + 1); }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1] || (k === 'date' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]))).slice(0, 8);
    const box = $(`.chips[data-key="${k}"]`);
    box.innerHTML = '';
    const on = S.filters[k].trim().toLowerCase();
    for (const [v, n] of top) {
      box.append(h('button', { class: `fchip${on && v.toLowerCase() === on ? ' on' : ''}`, title: `${n} song${n === 1 ? '' : 's'}`, onclick: () => setFilter(k, on === v.toLowerCase() ? '' : v) }, v));
    }
    if (!top.length) box.append(h('span', { class: 'fnone' }, 'Nothing yet'));
  }
  const nOn = ['artist', 'date', 'label', 'genre'].filter((k) => S.filters[k].trim()).length + (S.filters.q.trim() ? 1 : 0) + (S.filters.stars && S.filters.stars.n ? 1 : 0);
  $('#f-note').textContent = nOn ? `${nOn} filter${nOn === 1 ? '' : 's'} on · ${visibleTracks().length} song${visibleTracks().length === 1 ? '' : 's'} match` : 'Click a name to filter';
}
function setFilter(k, v) {
  S.filters[k] = v;
  $(`#f-${k}`).value = v;
  renderGrid();
}
for (const b of $$('#lib-tabs button')) {
  b.addEventListener('click', () => {
    S.libTab = b.dataset.tab;
    for (const x of $$('#lib-tabs button')) x.classList.toggle('on', x === b);
    const pl = S.libTab === 'playlists';
    $('#grid-wrap').hidden = pl;
    $('#pl-view').hidden = !pl;
    $('#view-library').classList.toggle('pl-mode', pl);
    if (pl) TFPlaylists.render(); else renderGrid();
  });
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
  S.filters = { q: '', artist: '', date: '', label: '', genre: '', stars: null };
  for (const id of ['#search', '#f-artist', '#f-date', '#f-label', '#f-genre']) $(id).value = '';
  renderStarFilter();
  renderGrid();
});

// ---------------------------------------------------------------- context menu
function showCardMenu(x, y, id) {
  const m = $('#ctxmenu');
  const many = S.selected.length > 1;
  const items = [
    ['Play', () => playTrack(id)],
    ['Change picture…', () => changeCover(id)],
    [many ? '📏 Edit this song…' : '📏 Edit…', () => TFEdit.open(id)],
    many ? [`📏 Edit ${S.selected.length} songs together…`, () => TFBatch.open([...S.selected])] : null,
    null,
    [many ? `Add ${S.selected.length} songs to playlist…` : 'Add to playlist…', () => TFPlaylists.pickFor(many ? [...S.selected] : [id])],
    null,
    ['Save song…', () => openSaveModal(id)],
    null,
    S.byId.get(id).mark === 'black' && TFShuffle.badge(S.byId.get(id), S.playClock || 0, S.tracks.length) === 'black'
      ? ['Back to normal in shuffle', () => setMark(many ? [...S.selected] : [id], null)]
      : ['🚫 Blacklist: play much less in shuffle', () => setMark(many ? [...S.selected] : [id], 'black')],
    S.byId.get(id).mark === 'fav' && TFShuffle.badge(S.byId.get(id), S.playClock || 0, S.tracks.length) === 'fav'
      ? ['Back to normal in shuffle', () => setMark(many ? [...S.selected] : [id], null)]
      : ['♥ Favourite: play more in shuffle', () => setMark(many ? [...S.selected] : [id], 'fav')],
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
  let paths = [...e.dataTransfer.files].map((f) => tf.pathForFile(f)).filter(Boolean);
  const mapFiles = paths.filter((p) => /\.tonixmap$/i.test(p)); // a shared map: open it as a map
  paths = paths.filter((p) => !/\.tonixmap$/i.test(p));
  (async () => { for (const f of mapFiles) await window.TFMap.importMapFile(f); })();
  if (!paths.length) return;
  if (e.target.closest?.('#convert-drop')) addConvertFiles(paths);
  else importPaths(paths);
});

// ---------------------------------------------------------------- remove / cover
async function removeSelected() {
  const ids = [...S.selected];
  if (!ids.length) return;
  const ok = S.settings.confirmRemove === false || await confirmModal(`Remove ${ids.length === 1 ? `"${S.byId.get(ids[0]).title}"` : `${ids.length} songs`} from the library?`, 'Your original files are not deleted. Converted MP3s made from videos are deleted.', 'Remove');
  if (!ok) return;
  await forgetTracks(ids);
}
// Same loudness: Tonix listens to every song in the group (library, playlist or map) and sets each one's
// Volume so they all sound equally loud. Files are not changed. apply(volumes) returns an undo function.
async function sameLoudness(ids, where, apply, note = '') {
  ids = [...new Set(ids)].filter((id) => S.byId.has(id));
  if (ids.length < 2) { toast(`Add at least 2 songs ${where} first.`); return; }
  const ok = await confirmModal(`Make the ${ids.length} songs ${where} equally loud?`,
    `Tonix listens to each song once and sets its Volume so they all sound as loud as each other. Your music files are not changed, and you can undo it. ${note}The first time takes a moment for many songs (you see the progress at the top).`,
    'Make them equally loud');
  if (!ok) return;
  const r = await guard(() => tf.loudnessEven(ids), 'Same loudness: ');
  if (!r) return;
  const undo = await apply(r.volumes);
  const n = Object.keys(r.volumes).length;
  toast(`${n} songs now sound equally loud${r.silent.length ? ` (${r.silent.length} silent song${r.silent.length === 1 ? '' : 's'} left alone)` : ''}.`, { type: 'ok', action: () => undo && undo(), actionLabel: 'Undo', ms: 15000 });
}
// for the Library and playlists: the songs' own Volume
async function setSongVolumes(volumes) {
  const before = {};
  for (const id of Object.keys(volumes)) before[id] = S.byId.get(id).fx.volume;
  const apply = async (v) => {
    const list = await guard(() => tf.tracksSetVolumes(v));
    if (!list) return;
    for (const t of list) upsertTrack(t);
    applyFx(); renderFx(); drawWave();
  };
  await apply(volumes);
  return () => apply(before).then(() => toast('Volumes are back as they were.', { ms: 2500 }));
}
$('#btn-loud').addEventListener('click', () => sameLoudness(S.tracks.map((t) => t.id), 'in your library', setSongVolumes));

// Clear all music: every song leaves Tonix. Original files stay on the PC; maps are kept (their songs show as missing).
async function clearAll() {
  const n = S.tracks.length;
  if (!n) { toast('The library is already empty.'); return; }
  const videos = S.tracks.filter((t) => t.isVideo).length;
  const ok = await confirmModal(`Clear all ${n} song${n === 1 ? '' : 's'} from Tonix?`,
    `Your music files stay on your PC: you can upload them again any time. ${videos ? `The ${videos} MP3 copy${videos === 1 ? '' : 'ies'} Tonix made from videos ${videos === 1 ? 'is' : 'are'} deleted (the videos stay). ` : ''}Maps are kept, but their songs will show as missing. This can't be undone.`,
    `Clear all ${n}`);
  if (!ok) return;
  if (window.TFMap) window.TFMap.stopPlay();
  await forgetTracks(S.tracks.map((t) => t.id));
  toast(`Cleared ${n} song${n === 1 ? '' : 's'}. Your files are still on your PC.`, { type: 'ok' });
}
async function forgetTracks(ids) {
  if (await guard(() => tf.removeTracks(ids)) === undefined) return;
  TFPlaylists.onTracksRemoved(ids);
  for (const id of ids) {
    S.byId.delete(id);
    S.tabs = S.tabs.filter((x) => x !== id);
    if (S.currentId === id) { audio.pause(); audio.removeAttribute('src'); audio.load(); S.currentId = null; S.peaks = null; }
  }
  S.tracks = S.tracks.filter((t) => !ids.includes(t.id));
  S.queue = S.queue.filter((id) => !ids.includes(id));
  S.qPos = S.queue.lastIndexOf(S.currentId);
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
      h('div', { class: 'foot' }, h('span', { class: 'muted' }), h('button', { class: 'btn', autofocus: true, onclick: () => close(false) }, 'Cancel'), h('button', { class: 'btn primary danger', onclick: () => close(true) }, okLabel)));
  });
}
function saveTargetText() {
  return S.settings.askWhereToSave ? 'You will choose where to save.' : `Saves instantly to: ${S.settings.exportDir}`;
}
function fxSummary(fx) {
  const d = S.defaults;
  const p = [];
  if (fx.speed !== d.speed) p.push(`speed ${fx.speed}%`);
  if (fx.pitch !== d.pitch) p.push(`pitch ${fx.pitch}%${fx.natural === false ? ' (classic voice)' : ''}`);
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

// 6.2 save one song (with picture, tags, file type, quality, name and folder)
const SAVE_TYPES = [
  { id: 'mp3', label: 'MP3', lossy: true, cover: true, hint: 'Plays everywhere' },
  { id: 'm4a', label: 'M4A', lossy: true, cover: true, hint: 'Good for iPhone and Apple Music' },
  { id: 'flac', label: 'FLAC', lossy: false, cover: true, hint: 'Lossless: perfect sound, bigger file' },
  { id: 'wav', label: 'WAV', lossy: false, cover: false, hint: 'Lossless, biggest file, no picture inside' },
  { id: 'ogg', label: 'OGG', lossy: true, cover: false, hint: 'Small and good, no picture inside' },
];
const fmtSize = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(1)} MB`);
function nameFor(artist, title) {
  const mode = S.settings.fileNames;
  if (!artist || mode === 'title') return title;
  return mode === 'title-artist' ? `${title} - ${artist}` : `${artist} - ${title}`;
}
async function openSaveModal(id) {
  id = id || (S.selected.length === 1 ? S.selected[0] : S.currentId) || S.selected[0];
  const t = S.byId.get(id);
  if (!t) { toast('Pick a song first (click one in the library).'); return; }
  let coverImage = null;
  let type = SAVE_TYPES.find((x) => x.id === S.settings.format) || SAVE_TYPES[0];
  let kbps = [128, 192, 256, 320].includes(+S.settings.bitrate) ? +S.settings.bitrate : 320;
  let dir = S.settings.exportDir;
  let nameTouched = false;
  let stars = t.stars || 0;
  await modal((box, close) => {
    box.classList.add('save-win');
    const fields = {};
    const inp = (k) => (fields[k] = h('input', { value: t[k] || '', spellcheck: 'false' }));
    const field = (k, label) => h('label', { class: 'field' }, label, inp(k));
    // picture
    const art = h('div', { class: 'cover-pick', title: 'Click to choose a picture' }, coverEl(t), h('span', { class: 'sv-art-tip' }, 'Click to change picture'));
    const warn = h('div', { class: 'warn-text' });
    art.addEventListener('click', async () => {
      const img = await guard(() => tf.pickImage());
      if (!img) return;
      coverImage = img;
      art.firstChild.replaceWith(await chosenPicture(img));
      update();
    });
    // fill from the original name + swap
    const fillMsg = h('span', { class: 'sv-fillmsg' });
    const fill = () => {
      const r = TFSaveName.parseName(t.origName || t.title);
      if (r.artist) fields.artist.value = r.artist;
      fields.title.value = r.title || fields.title.value;
      fillMsg.textContent = r.artist ? '' : 'No artist found in the name, only the title was filled.';
      update();
    };
    const swap = () => { [fields.artist.value, fields.title.value] = [fields.title.value, fields.artist.value]; update(); };
    // type, quality, name, folder
    const typeSeg = h('div', { class: 'seg' });
    const typeHint = h('span', { class: 'sv-hint' });
    const qSeg = h('div', { class: 'seg' });
    const qHint = h('span', { class: 'sv-hint' });
    const nameIn = h('input', { class: 'sv-name', spellcheck: 'false' });
    const extEl = h('span', { class: 'sv-ext' });
    const nameHint = h('div', { class: 'sv-hint sv-exists' });
    const dirEl = h('div', { class: 'sv-dir', title: '' });
    const saveBtn = h('button', { class: 'btn primary' });
    nameIn.addEventListener('input', () => { nameTouched = !!nameIn.value.trim(); update(); });
    let existsTimer = null;
    function update() {
      if (!nameTouched) nameIn.value = nameFor(fields.artist.value.trim(), fields.title.value.trim() || t.title);
      typeSeg.innerHTML = '';
      for (const x of SAVE_TYPES) typeSeg.append(h('button', { class: x === type ? 'on' : '', onclick: () => { type = x; update(); } }, x.label));
      typeHint.textContent = type.hint;
      qSeg.innerHTML = '';
      for (const q of [128, 192, 256, 320]) qSeg.append(h('button', { class: type.lossy && q === kbps ? 'on' : '', disabled: !type.lossy, onclick: () => { kbps = q; update(); } }, q === 320 ? '320 kbps' : String(q)));
      const secs = (t.duration || 0) / ((t.fx.speed || 100) / 100);
      const bytes = type.lossy ? (kbps * 1000 / 8) * secs : (type.id === 'wav' ? 176400 : 176400 * 0.6) * secs;
      qHint.textContent = `${type.lossy ? 'About' : 'Best quality, about'} ${fmtSize(bytes)}`;
      extEl.textContent = `.${type.id}`;
      dirEl.textContent = S.settings.askWhereToSave ? 'Windows will ask where (Settings → Saving)' : dir;
      dirEl.title = dir;
      saveBtn.textContent = `Save ${type.label}`;
      const hasPic = coverImage || t.coverUrl;
      warn.textContent = !type.cover ? `${type.label} files can't hold a picture. The song is saved without it.` : (hasPic ? '' : 'No picture yet: click the square to choose one.');
      clearTimeout(existsTimer);
      existsTimer = setTimeout(async () => {
        const ex = await tf.fileExists(dir, nameIn.value.trim() || t.title, type.id).catch(() => false);
        nameHint.textContent = ex ? 'A file with this name is already there. The new one gets "(2)" at the end, nothing is replaced.' : '';
      }, 150);
    }
    const doSave = async () => {
      const tags = Object.fromEntries(Object.entries(fields).map(([k, i]) => [k, i.value.trim()]));
      if (!tags.title) tags.title = t.title;
      tags.stars = stars || null;
      close();
      const ask = S.settings.askWhereToSave; // Settings → Saving: Windows asks where to save
      const r = await guard(() => tf.exportTrack(t.id, { tags, coverImage, format: type.id, bitrate: kbps, name: nameIn.value.trim() || tags.title, dir: ask ? null : dir }), 'Save: ');
      if (r && r.path) Object.assign(S.settings, { format: type.id, bitrate: kbps, ...(ask ? {} : { exportDir: dir }) }); // remembered for next time
      await afterSave(r);
    };
    const row = (label, ...kids) => [h('span', { class: 'sv-l' }, label), h('div', { class: 'sv-r' }, ...kids)];
    box.append(
      h('h2', {}, 'Save song'),
      h('div', { class: 'sv-sub' }, fxSummary(t.fx).replace(/^Effects: /, 'The song keeps its sound settings: ').replace('No effects (original sound)', 'No sound changes: the original sound is saved.')),
      h('div', { class: 'sv-top' },
        h('div', { class: 'sv-left' }, art, warn),
        h('div', { class: 'sv-right' },
          h('div', { class: 'sv-src' }, h('span', { class: 'sv-orig', title: t.origName || t.title }, 'Original name: ', h('b', {}, t.origName || t.title)),
            h('button', { class: 'btn primary sv-fill', onclick: fill, title: 'Read the artist and title from the original name' }, '✨ Fill from name')),
          fillMsg,
          h('div', { class: 'sv-pair' }, field('artist', 'Artist'), h('button', { class: 'sv-swap', title: 'Swap artist and title', onclick: swap, html: '&#8644;' }), field('title', 'Title')),
          h('div', { class: 'sv-grid' }, field('album', 'Album'), field('date', 'Date'), field('genre', 'Genre'), field('label', 'Label'), field('track', 'Track number')),
          h('div', { class: 'field sv-stars' }, 'Stars', TFStars.row(stars, (n) => { stars = n; })))),
      h('div', { class: 'sv-opts' },
        ...row('Type', typeSeg, typeHint),
        ...row('Quality', qSeg, qHint),
        h('span', { class: 'sv-l' }, 'File name'), h('div', { class: 'sv-r sv-col' }, h('div', { class: 'sv-namebox' }, nameIn, extEl), nameHint),
        ...row('Save in', dirEl, h('button', { class: 'btn', onclick: async () => { const d = await guard(() => tf.pickDir(dir)); if (d) { dir = d; update(); } } }, 'Change…'))),
      h('div', { class: 'foot' }, h('span', { class: 'muted' }), h('button', { class: 'btn', onclick: () => close() }, 'Cancel'), saveBtn),
    );
    saveBtn.addEventListener('click', doSave);
    for (const k of ['artist', 'title']) fields[k].addEventListener('input', update);
    update();
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); doSave(); } });
  });
}

// 6.3 save many songs (a playlist, or songs picked in the library): one file per song, or one big file
async function openAlbumModal(idsIn, { playlist = null } = {}) {
  let ids = (idsIn || S.selected).filter((id) => S.byId.has(id));
  if (ids.length < 2) { toast(playlist ? 'Add at least 2 songs to the playlist first.' : 'Select 2 or more songs first: Ctrl+click or Shift+click them in the library (Ctrl+A selects all).', { ms: 7000 }); return; }
  let coverImage = null, coverPreview = null;
  let coverTrackId = (ids.map((id) => S.byId.get(id)).find((t) => t.coverUrl) || {}).id || null;
  const usePlCover = !!(playlist && playlist.coverUrl);
  let plCover = usePlCover;
  let mode = ['single', 'separate'].includes(S.settings.albumMode) ? S.settings.albumMode : 'album';
  let type = SAVE_TYPES.find((x) => x.id === (S.settings.albumFormat || S.settings.format)) || SAVE_TYPES[0];
  let kbps = [128, 192, 256, 320].includes(+S.settings.bitrate) ? +S.settings.bitrate : 320;
  let dir = S.settings.exportDir;
  let nameTouched = false;
  await modal((box, close) => {
    box.classList.add('save-win');
    const first = S.byId.get(ids[0]);
    const inp = (v) => h('input', { value: v || '', spellcheck: 'false' });
    const f = { title: inp(playlist ? playlist.name : (first.album || 'My Album')), artist: inp(playlist ? '' : first.artist), date: inp(first.date), genre: inp(first.genre), label: inp(first.label) };
    const field = (k, label) => h('label', { class: 'field' }, label, f[k]);
    const art = h('div', { class: 'cover-pick', title: 'Click to choose a picture' });
    const warn = h('div', { class: 'warn-text' });
    const list = h('div', { class: 'song-list' });
    const renderCover = () => {
      art.innerHTML = '';
      if (coverImage) art.append(coverPreview || h('div', { class: 'ph', style: { background: '#333' } }, h('span', {}, 'New picture chosen')));
      else if (plCover) art.append(h('img', { class: 'cover-img', src: playlist.coverUrl, alt: '' }));
      else if (coverTrackId) art.append(coverEl(S.byId.get(coverTrackId)));
      else art.append(placeholder({ title: f.title.value || 'Album' }));
      art.append(h('span', { class: 'sv-art-tip' }, 'Click to change picture'));
      update();
    };
    const renderList = () => {
      list.innerHTML = '';
      ids.forEach((id, i) => {
        const t = S.byId.get(id);
        const chosen = !coverImage && !plCover && coverTrackId === id;
        const mini = h('div', { class: `mini-art${chosen ? ' chosen' : ''}`, title: t.coverUrl ? 'Use this picture as the cover' : 'No picture' }, coverEl(t));
        if (t.coverUrl) mini.addEventListener('click', () => { coverTrackId = id; coverImage = null; plCover = false; renderCover(); renderList(); });
        list.append(h('div', { class: 'song-row' }, h('span', { class: 'n' }, i + 1), mini, h('span', { class: 't' }, t.title, t.artist ? h('span', { class: 'muted' }, ` — ${t.artist}`) : null),
          TFStars.row(t.stars, (n) => setStars(id, n), { small: true }),
          h('button', { title: 'Move up', html: ICONS.up, disabled: i === 0, onclick: () => { [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; renderList(); } }),
          h('button', { title: 'Move down', html: ICONS.down, disabled: i === ids.length - 1, onclick: () => { [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; renderList(); } }),
          h('button', { title: 'Leave out of this save', html: ICONS.close, disabled: ids.length <= 2, onclick: () => { ids = ids.filter((x) => x !== id); if (coverTrackId === id) coverTrackId = null; renderList(); renderCover(); } })));
      });
      update();
    };
    art.addEventListener('click', async () => {
      const img = await guard(() => tf.pickImage());
      if (img) { coverImage = img; coverPreview = await chosenPicture(img); renderCover(); renderList(); }
    });
    // how to save: one file per song, or one big file
    const modeBox = h('div', { class: 'sv-modes' });
    const typeSeg = h('div', { class: 'seg' });
    const typeHint = h('span', { class: 'sv-hint' });
    const qSeg = h('div', { class: 'seg' });
    const qHint = h('span', { class: 'sv-hint' });
    const nameIn = h('input', { class: 'sv-name', spellcheck: 'false' });
    const extEl = h('span', { class: 'sv-ext' });
    const dirEl = h('div', { class: 'sv-dir' });
    const saveBtn = h('button', { class: 'btn primary' });
    nameIn.addEventListener('input', () => { nameTouched = !!nameIn.value.trim(); update(); });
    const listLabel = h('div', { class: 'sv-l' });
    const okTypes = () => (mode === 'single' ? SAVE_TYPES.filter((x) => x.id === 'mp3' || x.id === 'm4a') : SAVE_TYPES);
    function update() {
      const title = f.title.value.trim() || 'My Album', artist = f.artist.value.trim();
      if (!nameTouched) nameIn.value = artist ? `${artist} - ${title}` : title;
      if (!okTypes().includes(type)) type = SAVE_TYPES[0];
      modeBox.innerHTML = '';
      box.classList.toggle('sep-mode', mode === 'separate'); // separate songs: no album, name or picture to set
      listLabel.textContent = mode === 'separate' ? `The ${ids.length} songs (each saved with its own name, no numbers)` : `Order (${ids.length} songs, numbered when saved)`;
      for (const [m, label, text] of [['separate', 'Separate songs', 'Each song as its own file in the folder, with its own name, picture and information. No new folder, no numbers.'], ['album', 'One file per song, as an album', 'A new folder, songs numbered 01, 02… all with the album name and picture'], ['single', 'One big file', 'All songs joined into one file, with a chapter mark at each song']]) {
        modeBox.append(h('button', { class: `sv-mode${mode === m ? ' on' : ''}`, onclick: () => { mode = m; update(); } }, h('b', {}, label), h('span', {}, text)));
      }
      typeSeg.innerHTML = '';
      for (const x of SAVE_TYPES) {
        const off = !okTypes().includes(x);
        typeSeg.append(h('button', { class: x === type ? 'on' : '', disabled: off, title: off ? 'One big file can only be MP3 or M4A (they hold chapter marks)' : x.hint, onclick: () => { type = x; update(); } }, x.label));
      }
      typeHint.textContent = mode === 'single' ? 'One big file: MP3 or M4A' : type.hint;
      qSeg.innerHTML = '';
      for (const q of [128, 192, 256, 320]) qSeg.append(h('button', { class: type.lossy && q === kbps ? 'on' : '', disabled: !type.lossy, onclick: () => { kbps = q; update(); } }, q === 320 ? '320 kbps' : String(q)));
      const secs = ids.reduce((s, id) => { const t = S.byId.get(id); return s + (t.duration || 0) / ((t.fx.speed || 100) / 100); }, 0);
      const bytes = type.lossy ? (kbps * 1000 / 8) * secs : (type.id === 'wav' ? 176400 : 176400 * 0.6) * secs;
      qHint.textContent = `${type.lossy ? 'About' : 'Best quality, about'} ${fmtSize(bytes)} · ${fmtTime(secs)} in total`;
      extEl.textContent = mode === 'single' ? `.${type.id}` : '  (folder)';
      dirEl.textContent = S.settings.askWhereToSave ? 'Windows will ask where (Settings → Saving)' : dir;
      dirEl.title = dir;
      saveBtn.textContent = `Save ${ids.length} songs`;
      warn.textContent = type.cover ? (coverImage || plCover || coverTrackId ? '' : 'No picture yet: click the square, or a song\'s small picture below.') : `${type.label} files can't hold a picture.`;
    }
    for (const k of ['title', 'artist']) f[k].addEventListener('input', () => { if (!coverImage && !plCover && !coverTrackId) renderCover(); else update(); });
    const doSave = async () => {
      const opts = { mode, title: f.title.value.trim() || 'My Album', artist: f.artist.value.trim(), date: f.date.value.trim(), genre: f.genre.value.trim(), label: f.label.value.trim(),
        coverImage, coverTrackId: coverImage || plCover ? null : coverTrackId, format: type.id, bitrate: kbps, name: nameIn.value.trim(), dir: S.settings.askWhereToSave ? null : dir };
      if (plCover && !coverImage) opts.coverPlaylistId = playlist.id;
      close();
      const r = await guard(() => tf.exportMany(ids, opts), 'Save: ');
      if (r && r.path) Object.assign(S.settings, { ...(S.settings.askWhereToSave ? {} : { exportDir: dir }), bitrate: kbps, albumFormat: type.id, albumMode: mode }); // remembered for next time
      await afterSave(r);
    };
    const row = (label, ...kids) => [h('span', { class: 'sv-l' }, label), h('div', { class: 'sv-r' }, ...kids)];
    box.append(
      h('h2', {}, playlist ? `Save playlist "${playlist.name}"` : `Save ${ids.length} songs together`),
      h('div', { class: 'sv-sub' }, 'Each song keeps its own speed, pitch, volume and fades.'),
      h('div', { class: 'sv-top' },
        h('div', { class: 'sv-left' }, art, warn),
        h('div', { class: 'sv-right' },
          h('div', { class: 'sv-grid sv-grid-top' }, field('title', 'Album'), field('artist', 'Album artist'), field('date', 'Date'), field('genre', 'Genre'), field('label', 'Label')))),
      h('div', { class: 'sv-songs' }, listLabel, list),
      h('div', { class: 'sv-opts' },
        ...row('Save as', modeBox),
        ...row('Type', typeSeg, typeHint),
        ...row('Quality', qSeg, qHint),
        h('span', { class: 'sv-l sv-namerow' }, 'Name'), h('div', { class: 'sv-r sv-namerow' }, h('div', { class: 'sv-namebox' }, nameIn, extEl)),
        ...row('Save in', dirEl, h('button', { class: 'btn', onclick: async () => { const d = await guard(() => tf.pickDir(dir)); if (d) { dir = d; update(); } } }, 'Change…'))),
      h('div', { class: 'foot' }, h('span', { class: 'muted' }), h('button', { class: 'btn', onclick: () => close() }, 'Cancel'), saveBtn),
    );
    saveBtn.addEventListener('click', doSave);
    renderCover();
    renderList();
  });
}
$('#btn-save').addEventListener('click', () => openSaveModal());
$('#btn-save-many').addEventListener('click', () => openAlbumModal());
$('#btn-clear-all').addEventListener('click', () => clearAll());

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
  renderConvert();
  if (window.TFSettings && S.view === 'settings') window.TFSettings.render();
}
async function patchSettings(p) {
  const s = await guard(() => tf.settings(p));
  if (s) { S.settings = s; renderSettings(); }
}

// ---------------------------------------------------------------- views
// Hidden until each button is planned with the user. The code is kept.
const HIDDEN_VIEWS = ['editor', 'tools'];
function showView(v) {
  if (HIDDEN_VIEWS.includes(v)) return;
  S.view = v;
  for (const b of $$('.nav')) b.classList.toggle('active', b.dataset.view === v);
  for (const el of $$('.view')) el.classList.toggle('active', el.id === `view-${v}`);
  $('#main').classList.toggle('no-right', v !== 'library');
  if (v === 'tools') { const term = $('#terminal'); term.scrollTop = term.scrollHeight; }
  if (v !== 'map' && S.edit) setEdit(null); // away from the map, the Sound panel edits the playing song again
  if (v === 'map' && window.TFMap) window.TFMap.show();
  if (v === 'settings' && window.TFSettings) window.TFSettings.render();
  if (v === 'edit') TFEdit.render(); else TFEdit.stop();
  if ((v === 'library' || v === 'map') && S.settings && S.settings.lastView !== v) { S.settings.lastView = v; tf.settings({ lastView: v }).catch(() => {}); }
  requestAnimationFrame(drawWave);
}
for (const b of $$('.nav')) {
  b.hidden = HIDDEN_VIEWS.includes(b.dataset.view);
  b.addEventListener('click', () => showView(b.dataset.view));
}

function renderAll() {
  renderGrid();
  TFPlaylists.render();
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
// keys: see renderer/shortcuts.js
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
  // Wait until every script file (map, settings, shortcuts…) has loaded before starting.
  if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  const NAV = { library: ['search', 'Library'], map: ['map', 'Map'], edit: ['caliper', 'Edit'], editor: ['page', 'Details'], tools: ['page', 'Tools'], settings: ['gear', 'Settings'] };
  for (const b of $$('.nav')) { const [ic, label] = NAV[b.dataset.view]; b.innerHTML = `<span class="nav-ic">${ICONS[ic]}</span><span class="nav-l">${label}</span>`; }
  $('#logo').innerHTML = ICONS.note;
  $('#vol-ic').innerHTML = ICONS.speaker;
  $('#ts-ic').innerHTML = ICONS.search;
  const icon = (sel, name) => { $(sel).innerHTML = ICONS[name]; };
  for (const el of $$('#lib-toolbar .ic')) el.innerHTML = ICONS[el.dataset.icon];
  icon('#zoom-in', 'zoomIn'); icon('#zoom-out', 'zoomOut');
  icon('#back30', 'back30'); icon('#back5', 'back5'); icon('#fwd5', 'fwd5'); icon('#fwd30', 'fwd30'); icon('#play', 'play');
  const st = await tf.state();
  setTracks(st.tracks);
  TFPlaylists.setAll(st.playlists);
  S.playClock = st.playClock || 0;
  renderStarFilter();
  S.settings = st.settings;
  setMaster(S.settings.rememberMaster === false ? 100 : (S.settings.master ?? 100), false);
  S.limits = st.limits;
  S.defaults = st.defaults;
  S.libraryDir = st.libraryDir;
  if (window.TFSettings) window.TFSettings.applyAll(); // look, text size, volume limit…
  buildFxCards();
  setZoom(S.settings.zoom || 150);
  const first = S.settings.openOn === 'map' ? 'map' : S.settings.openOn === 'library' ? 'library' : (S.settings.lastView === 'map' ? 'map' : 'library');
  showView(first);
  renderAll();
  if (S.settings.continueOnOpen && window.TFMap) window.TFMap.show().then(() => window.TFMap.actions.continueIfAny());
  tf.ffmpegInfo().catch(() => {
    toast('ffmpeg was not found, so converting and saving will not work. See README.', { type: 'error', ms: 12000 });
  });
  window.__tfReady = true;
})();
