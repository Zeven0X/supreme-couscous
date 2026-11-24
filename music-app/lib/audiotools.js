'use strict';
// Sound editor tools: finding silence, loudness, smart loop points and beats, plus the ffmpeg "recipes"
// (filter graphs) for Effects, Loop, Layers and Smart connect. Pure helpers are exported for tests.
const RATE = 44100;
const f4 = (n) => Math.max(0, n).toFixed(4);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- silence ----------
const TRIM_LEVELS = { veryquiet: -60, quiet: -45, bitquiet: -35 }; // "Silence" = quieter than this (dB)
function parseSilence(stderr) {
  const out = [];
  for (const line of String(stderr).split(/\r?\n/)) {
    let m = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (m) out.push({ start: Math.max(0, +m[1]), end: null });
    m = line.match(/silence_end:\s*([\d.]+)/);
    if (m && out.length && out[out.length - 1].end === null) out[out.length - 1].end = +m[1];
  }
  return out;
}
async function silences(ff, file, db, minSecs) {
  const { stderr } = await ff.run(['-i', file, '-map', '0:a:0', '-af', `silencedetect=n=${db}dB:d=${minSecs}`, '-f', 'null', '-']);
  return parseSilence(stderr);
}
// Trim: how much silence there is at the very start and the very end.
function trimPoints(sil, dur, eps = 0.05) {
  let head = 0, tail = dur;
  const first = sil[0], last = sil[sil.length - 1];
  if (first && first.start <= eps) head = first.end === null ? dur : first.end;
  if (last && (last.end === null || last.end >= dur - eps) && last.start > head) tail = last.start;
  if (head >= tail) return { head: 0, tail: dur, empty: true }; // all silent: leave it alone
  return { head, tail };
}
// Split: the middle of every quiet gap inside the song (not at the very start or end).
function splitPoints(sil, dur, eps = 0.05) {
  return sil.filter((s) => s.start > eps && s.end !== null && s.end < dur - eps).map((s) => +((s.start + s.end) / 2).toFixed(3));
}

// ---------- loudness ----------
async function loudness(ff, file, a, b) {
  const { stderr } = await ff.run(['-ss', f4(a), '-to', f4(b), '-i', file, '-map', '0:a:0', '-af', 'ebur128', '-f', 'null', '-']);
  const all = [...String(stderr).matchAll(/I:\s+(-?[\d.]+|-inf) LUFS/g)];
  const v = all.length ? all[all.length - 1][1] : '-inf';
  return v === '-inf' ? -70 : +v;
}
// Same loudness: every part gets the volume that brings it to the average loudness of all parts.
function sameLoudness(louds) {
  const ok = louds.filter((l) => l > -60);
  if (!ok.length) return louds.map(() => 100);
  const target = ok.reduce((s, l) => s + l, 0) / ok.length;
  return louds.map((l) => (l > -60 ? clamp(Math.round(100 * 10 ** ((target - l) / 20) * 10) / 10, 1, 500) : 100));
}

// ---------- samples ----------
async function decodeMono(ff, file, rate = 22050, a = 0, len = 0) {
  const args = [];
  if (a > 0) args.push('-ss', f4(a));
  if (len > 0) args.push('-t', f4(len));
  const { stdout } = await ff.run([...args, '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-']);
  return new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.length));
}

// ---------- smart loop ----------
// Keeps A (moved to the nearest upward zero crossing) and moves B a little (within ±search seconds) to the
// spot where the sound after B looks most like the sound after A, so jumping from B back to A is seamless.
function zeroCross(x, i, maxShift) {
  for (let d = 0; d <= maxShift; d++) {
    for (const j of [i + d, i - d]) if (j > 0 && j < x.length && x[j - 1] <= 0 && x[j] > 0) return j;
  }
  return i;
}
function smartLoop(x, rate, A, B, { search = 0.25, win = 0.04 } = {}) {
  const ia = zeroCross(x, Math.round(A * rate), Math.round(0.005 * rate));
  const w = Math.round(win * rate);
  const ib0 = Math.round(B * rate), r = Math.round(search * rate);
  let best = ib0, bestScore = -Infinity;
  const ea = (() => { let e = 0; for (let k = 0; k < w; k++) e += x[ia + k] * x[ia + k] || 0; return Math.sqrt(e) || 1e-9; })();
  for (let ib = Math.max(ia + w * 2, ib0 - r); ib <= Math.min(x.length - w - 1, ib0 + r); ib++) {
    let dot = 0, eb = 0;
    for (let k = 0; k < w; k++) { const p = x[ia + k] || 0, q = x[ib + k] || 0; dot += p * q; eb += q * q; }
    const score = dot / (ea * (Math.sqrt(eb) || 1e-9)) - (Math.abs(ib - ib0) / (r || 1)) * 0.02; // a tiny pull to stay close
    if (score > bestScore) { bestScore = score; best = ib; }
  }
  return { a: ia / rate, b: best / rate, score: +bestScore.toFixed(3) };
}

// ---------- beats ----------
// A simple beat finder: how much louder each short moment gets (onsets), the tempo that repeats best,
// then the beat times on that grid. Good enough to snap cuts and match tempos.
function beats(x, rate) {
  const hop = 512, frame = 1024;
  const env = [];
  let prev = 0;
  for (let i = 0; i + frame < x.length; i += hop) {
    let e = 0;
    for (let k = 0; k < frame; k++) e += x[i + k] * x[i + k];
    const le = Math.log(1e-9 + e);
    env.push(Math.max(0, le - prev));
    prev = le;
  }
  const fps = rate / hop;
  if (env.length < fps * 4) return { bpm: 0, times: [] };
  let bestLag = 0, bestVal = -Infinity;
  for (let bpm = 60; bpm <= 180; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    let s = 0;
    for (let i = 0; i + lag * 2 < env.length; i++) s += env[i] * (env[Math.round(i + lag)] + 0.5 * env[Math.round(i + lag * 2)]);
    s /= env.length;
    s *= Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2); // half / double tempo look alike: prefer the usual range
    if (s > bestVal) { bestVal = s; bestLag = lag; }
  }
  const bpm = Math.round((60 / (bestLag / fps)) * 10) / 10;
  let bestPhase = 0, bestSum = -Infinity;
  for (let ph = 0; ph < bestLag; ph++) {
    let s = 0;
    for (let i = ph; i < env.length; i += bestLag) s += env[Math.round(i)] || 0;
    if (s > bestSum) { bestSum = s; bestPhase = ph; }
  }
  const times = [];
  for (let i = bestPhase; i < env.length; i += bestLag) times.push(+((i * hop) / rate).toFixed(3));
  return { bpm, times };
}
function snapToBeat(t, times, max = 0.25) {
  let best = t, d = max;
  for (const b of times) { const e = Math.abs(b - t); if (e < d) { d = e; best = b; } }
  return best;
}
// Tempo change that makes a layer match the song: allows half / double time.
function tempoMatch(songBpm, layerBpm) {
  if (!(songBpm > 0) || !(layerBpm > 0)) return 1;
  let f = songBpm / layerBpm;
  while (f > 1.5) f /= 2;
  while (f < 0.75) f *= 2;
  return Math.round(f * 10000) / 10000;
}

// ---------- recipes (filter graphs) ----------
// Effects: strength 0..100. Order is fixed so the result is the same whichever you switch on first.
const EFFECTS = ['slowed', 'nightcore', 'bass', 'echo', 'eightd', 'oned'];
const FXM = require('../renderer/fxmath');
const tapsFilter = (r) => `aecho=${r.inGain}:${r.outGain}:${r.taps.map((t) => t[0]).join('|')}:${r.taps.map((t) => t[1].toFixed(2)).join('|')}`;
// The ffmpeg filters for a set of effects (numbers from renderer/fxmath.js, shared with the live player).
// noRate: layers can't use the speed effects (Slowed / Nightcore); those are for the song track.
function effectFilters(fx = {}, { noRate = false } = {}) {
  const out = [];
  for (const e of FXM.params(fx).list) {
    if (e.rate && noRate) continue;
    if (e.k === 'slowed') out.push(`asetrate=${Math.round(RATE * e.rate)}`, `aresample=${RATE}`, tapsFilter(e.room));
    if (e.k === 'nightcore') out.push(`asetrate=${Math.round(RATE * e.rate)}`, `aresample=${RATE}`);
    if (e.k === 'bass') out.push(`bass=g=${e.gain.toFixed(1)}:f=${e.freq}:w=0.6`);
    if (e.k === 'echo') out.push(`aecho=${e.inGain}:${e.outGain}:${e.ms}:${e.decay.toFixed(2)}`);
    if (e.k === 'eightd') out.push(`apulsator=mode=sine:hz=${e.hz.toFixed(3)}:amount=${e.amount.toFixed(2)}`, tapsFilter(e.room));
    if (e.k === 'oned') out.push(`pan=stereo|c0=${(1 - e.mix).toFixed(3)}*c0+${e.mix.toFixed(3)}*c1|c1=${e.mix.toFixed(3)}*c0+${(1 - e.mix).toFixed(3)}*c1`);
  }
  return out;
}
function effectChain(fx = {}) {
  const parts = effectFilters(fx);
  if (!parts.length) return null;
  parts.push('alimiter=limit=0.97:level=false', `aformat=sample_rates=${RATE}:channel_layouts=stereo`);
  return `[0:a]${parts.join(',')}[out]`;
}

// Loop: A..B plays `times` times, the rest of the song stays around it.
function loopLength(A, B, times, dur) { return dur + (B - A) * (Math.max(1, times) - 1); }
function loopGraph(A, B, times, dur) {
  times = clamp(Math.round(times), 1, 200);
  const size = Math.round((B - A) * RATE);
  const segs = [], lab = [];
  const has0 = A > 0.005, has2 = B < dur - 0.005;
  segs.push(`[0:a]asplit=${1 + has0 + has2}${['[p]', has0 ? '[q]' : '', has2 ? '[r]' : ''].join('')}`);
  if (has0) { segs.push(`[q]atrim=0:${f4(A)},asetpts=N/SR/TB[x]`); lab.push('[x]'); }
  segs.push(`[p]atrim=${f4(A)}:${f4(B)},asetpts=N/SR/TB,aloop=loop=${times - 1}:size=${size}:start=0[y]`); lab.push('[y]');
  if (has2) { segs.push(`[r]atrim=start=${f4(B)},asetpts=N/SR/TB[z]`); lab.push('[z]'); }
  segs.push(`${lab.join('')}concat=n=${lab.length}:v=0:a=1[out]`);
  return segs.join(';');
}

// Layers: input 0 = the song, inputs 1.. = layers. Each layer: { offset, from, to, volume (0-500 %),
// pan (-100 left .. 100 right), mute, solo, repeat (1.. times, or 0 = until the song ends), tempo, duck }.
function panFilter(p) {
  const x = clamp((+p || 0) / 100, -1, 1);
  const l = Math.min(1, 1 - x), r = Math.min(1, 1 + x);
  return `pan=stereo|c0=${l.toFixed(3)}*c0|c1=${r.toFixed(3)}*c1`;
}
// The whole Edit page as one recipe: the song track (its effects, volume, left/right, mute) + every layer
// (part, tempo, repeat, its effects, volume, left/right, auto-quiet). Layer start times are in song time;
// when the song's own effects change its speed (Slowed / Nightcore), the layers move with it.
function mixGraph(layers, songDur, { songVolume = 100, songPan = 0, songMute = false, songSolo = false, songFx = {} } = {}) {
  const rate = FXM.params(songFx).rate;
  const outDur = songDur / rate;
  const solo = songSolo || layers.some((L) => L.solo && !L.mute); // any solo: only solo tracks are heard
  const live = layers.map((L, i) => ({ ...L, input: i + 1 })).filter((L) => !L.mute && (!solo || L.solo));
  const g = [], outs = [], ducks = [];
  for (const L of live) {
    const chain = [`aresample=${RATE}`, `aformat=sample_rates=${RATE}:channel_layouts=stereo`];
    if (L.to > L.from) chain.push(`atrim=${f4(L.from || 0)}:${f4(L.to)}`, 'asetpts=N/SR/TB');
    if (L.tempo && Math.abs(L.tempo - 1) > 1e-4) chain.push(`rubberband=tempo=${L.tempo.toFixed(5)}:pitchq=quality:channels=together`);
    const len = ((L.to || 0) - (L.from || 0)) / (L.tempo || 1);
    const start = (L.offset || 0) / rate;
    const reps = L.repeat === 0 && len > 0 ? Math.ceil(Math.max(0, outDur - start) / len) : (L.repeat || 1);
    if (reps > 1 && len > 0) chain.push(`aloop=loop=${Math.min(999, reps - 1)}:size=${Math.round(len * RATE)}:start=0`);
    if (L.repeat === 0) chain.push(`atrim=0:${f4(Math.max(0.01, outDur - start))}`);
    chain.push(...effectFilters(L.fx, { noRate: true }));
    chain.push(`volume=${((L.volume ?? 100) / 100).toFixed(4)}`, panFilter(L.pan));
    const ms = Math.round(start * 1000);
    if (ms > 0) chain.push(`adelay=${ms}|${ms}`);
    const tag = `l${L.input}`;
    if (L.duck) { chain.push(`asplit=2[${tag}][${tag}d]`); ducks.push(`[${tag}d]`); g.push(`[${L.input}:a]${chain.join(',')}`); } else g.push(`[${L.input}:a]${chain.join(',')}[${tag}]`);
    outs.push(`[${tag}]`);
  }
  const vol = songMute || (solo && !songSolo) ? 0 : songVolume;
  const song = [`aresample=${RATE}`, `aformat=sample_rates=${RATE}:channel_layouts=stereo`, ...effectFilters(songFx), `volume=${(vol / 100).toFixed(4)}`];
  if (+songPan) song.push(panFilter(songPan));
  g.unshift(`[0:a]${song.join(',')}[song]`);
  let songTag = '[song]';
  if (ducks.length) { // auto-quiet: the song gets quieter while these layers sound
    const key = ducks.length > 1 ? (g.push(`${ducks.join('')}amix=inputs=${ducks.length}:normalize=0[key]`), '[key]') : ducks[0];
    g.push(`${key}apad[keyp]`); // the key goes on (silent) after it ends, so the song is not cut short there
    g.push(`${songTag}[keyp]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450:makeup=1[songd]`);
    songTag = '[songd]';
  }
  if (!outs.length) return `${g[0].replace('[song]', ',alimiter=limit=0.97:level=false[out]').replace(',,', ',')}`;
  g.push(`${songTag}${outs.join('')}amix=inputs=${outs.length + 1}:duration=first:normalize=0,alimiter=limit=0.97:level=false[out]`);
  return g.join(';');
}

// Smart connect: put piece [a, b] (from input `src`: 0 = this song, 1 = another song) at position P of this
// song. after = 'continue' (the song goes on after the piece) or 'end' (the song ends with the piece).
// blend: 'hard' (6 ms), 'smooth' (0.5 s), 'long' (3 s) crossfades at the joins.
const BLENDS = { hard: 0.006, smooth: 0.5, long: 3 };
function connectGraph({ P, a, b, src = 0, after = 'continue', blend = 'smooth', dur }) {
  P = clamp(+P || 0, 0, dur);
  const piece = b - a;
  const hasHead = P > 0.05; // joining at the very start: no head, the piece comes first
  const hasTail = after === 'continue' && P < dur - 0.05; // joining at the very end: nothing comes after
  let d = BLENDS[blend] || BLENDS.smooth;
  d = Math.max(0.006, Math.min(d, piece / 3, hasHead ? P / 2 : d, hasTail ? (dur - P) / 2 : d));
  const norm = `aresample=${RATE},aformat=sample_rates=${RATE}:channel_layouts=stereo`;
  const fromSong = ['head', src === 0 ? 'piece' : null, 'tail'].filter((x) => x && (x !== 'head' || hasHead) && (x !== 'tail' || hasTail));
  const g = [];
  const lab = Object.fromEntries(fromSong.map((x, i) => [x, `[s${i}]`]));
  if (fromSong.length > 1) g.push(`[0:a]${norm},asplit=${fromSong.length}${fromSong.map((_, i) => `[s${i}]`).join('')}`);
  else if (fromSong.length === 1) g.push(`[0:a]${norm}[s0]`);
  const pieceIn = src === 0 ? lab.piece : `[1:a]${norm},`; // the piece: from this song, or from the other song
  g.push(`${pieceIn}atrim=${f4(a)}:${f4(b)},asetpts=N/SR/TB[piece]`);
  let cur = '[piece]';
  if (hasHead) {
    g.push(`${lab.head}atrim=0:${f4(P)},asetpts=N/SR/TB[head]`);
    g.push(`[head]${cur}acrossfade=d=${f4(d)}:c1=tri:c2=tri[hp]`);
    cur = '[hp]';
  }
  if (hasTail) {
    g.push(`${lab.tail}atrim=start=${f4(P)},asetpts=N/SR/TB[tail]`);
    g.push(`${cur}[tail]acrossfade=d=${f4(d)}:c1=tri:c2=tri[out]`);
  } else g.push(`${cur}anull[out]`);
  const joins = (hasHead ? 1 : 0) + (hasTail ? 1 : 0);
  return { graph: g.join(';'), length: (hasHead ? P : 0) + piece + (hasTail ? dur - P : 0) - d * joins, blendSecs: d };
}

// ---------- built-in sounds (made here from noise and tones, nothing copied) ----------
const SOUNDS = {
  rain: { name: 'Rain', src: 'anoisesrc=d=30:c=pink:a=0.35:r=44100', fx: 'highpass=f=350,lowpass=f=6500,volume=0.8' },
  ocean: { name: 'Ocean waves', src: 'anoisesrc=d=32:c=brown:a=0.6:r=44100', fx: "lowpass=f=1100,volume='0.25+0.35*(0.5+0.5*sin(2*PI*t/8))':eval=frame" },
  vinyl: { name: 'Vinyl crackle', src: "aevalsrc='if(lt(random(0),0.0009),(random(1)-0.5)*1.4,0)+0.004*(random(2)-0.5)':s=44100:d=30", fx: 'highpass=f=700,lowpass=f=5000' },
  wind: { name: 'Wind', src: 'anoisesrc=d=33:c=brown:a=0.7:r=44100', fx: "bandpass=f=450:w=350,volume='0.2+0.35*(0.5+0.5*sin(2*PI*t/11))':eval=frame" },
  fire: { name: 'Campfire', src: "aevalsrc='if(lt(random(0),0.002),(random(1)-0.5)*1.2,0)':s=44100:d=30", fx: 'lowpass=f=3000,highpass=f=200,volume=0.9' },
  beat: { name: 'Beat (120 BPM click)', src: "aevalsrc='0.7*sin(2*PI*900*t)*exp(-70*mod(t,0.5))':s=44100:d=30", fx: 'volume=0.8' },
};
async function makeSound(ff, key, dest) {
  const s = SOUNDS[key];
  if (!s) throw new Error('Unknown sound');
  await ff.run(['-y', '-f', 'lavfi', '-i', s.src, '-af', `${s.fx},aformat=sample_rates=${RATE}:channel_layouts=stereo`, '-c:a', 'flac', dest]);
  return dest;
}

module.exports = {
  RATE, TRIM_LEVELS, parseSilence, silences, trimPoints, splitPoints, loudness, sameLoudness, decodeMono,
  smartLoop, zeroCross, beats, snapToBeat, tempoMatch, EFFECTS, effectChain, loopLength, loopGraph, panFilter,
  mixGraph, effectFilters, BLENDS, connectGraph, SOUNDS, makeSound,
};
