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

// ---------- Smart loop v2: the best joins near A and B, on the beat ----------
// A small FFT (radix 2), for the sound "fingerprint" of short moments.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k], br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi; re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
// Every short moment (23 ms) as 24 bands (low .. high sounds, log loudness) + its loudness.
function soundPrint(x, rate, hop = 512, size = 2048, bands = 24) {
  const edges = Array.from({ length: bands + 1 }, (_, i) => Math.round((60 * Math.pow(8000 / 60, i / bands) / rate) * size));
  const win = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
  const frames = [], loud = [];
  const re = new Float64Array(size), im = new Float64Array(size);
  for (let i = 0; i + size <= x.length; i += hop) {
    let e = 0;
    for (let k = 0; k < size; k++) { const v = x[i + k]; re[k] = v * win[k]; im[k] = 0; e += v * v; }
    fft(re, im);
    const f = new Float32Array(bands);
    for (let b = 0; b < bands; b++) { let s = 0; for (let k = edges[b]; k < Math.max(edges[b] + 1, edges[b + 1]); k++) s += re[k] * re[k] + im[k] * im[k]; f[b] = Math.log(1e-6 + s); }
    frames.push(f); loud.push(Math.sqrt(e / size));
  }
  return { frames, loud, fps: rate / hop };
}
// How alike two moments of the song sound (-1 .. 1): the band shapes around them, frame by frame.
function alike(P, fa, fb, w, mean) {
  let dot = 0, na = 0, nb = 0;
  for (let k = -w; k < w; k++) {
    const A = P.frames[fa + k], B = P.frames[fb + k];
    if (!A || !B) continue;
    for (let b = 0; b < A.length; b++) { const p = A[b] - mean[b], q = B[b] - mean[b]; dot += p * q; na += p * p; nb += q * q; }
  }
  return dot / (Math.sqrt(na * nb) || 1e-9);
}
// segA / segB: { x (mono sound), t0 (its start, song seconds) } around A and around B (the same object when they overlap).
// A, B: your marks (song seconds). grid: { bpm, first } (beats). songDur: the song's length (so A can stay at 0 / B at the end).
// Returns up to `top` joins { a, b, score (0-100), beats } at most `bars` bars away from your marks.
function findLoopsIn(segA, segB, rate, A, B, grid = {}, { bars = 4, top = 3, songDur = Infinity } = {}) {
  const PA = soundPrint(segA.x, rate), PB = segB === segA ? PA : soundPrint(segB.x, rate);
  const nb = PA.frames[0] ? PA.frames[0].length : 24;
  const mean = new Float64Array(nb);
  const all = PB === PA ? PA.frames : [...PA.frames, ...PB.frames];
  all.forEach((f) => f.forEach((v, b) => { mean[b] += v / all.length; }));
  const beat = grid.bpm > 30 ? 60 / grid.bpm : 0.25; // no beat found: every quarter second
  const first = grid.bpm > 30 ? (grid.first || 0) : 0;
  const reach = Math.max(1, bars) * 4 * beat;
  const onGrid = (seg, lo, hi, keep) => {
    const end = seg.t0 + seg.x.length / rate, out = [];
    for (let k = Math.ceil((lo - first) / beat); first + k * beat <= hi; k++) { const t = first + k * beat; if (t >= Math.max(0, seg.t0) && t <= Math.min(end, songDur)) out.push(t); }
    if (keep >= seg.t0 && keep <= end && !out.some((t) => Math.abs(t - keep) < 1e-3)) out.push(keep); // your own mark is always a choice (the very start / end too)
    return out;
  };
  const As = onGrid(segA, A - reach, A + reach, A), Bs = onGrid(segB, B - reach, B + reach, B);
  const w = Math.max(4, Math.round(Math.min(2 * beat, 1.5) * PA.fps)); // compare about 2 beats each side
  const frA = (t) => Math.round((t - segA.t0) * PA.fps), frB = (t) => Math.round((t - segB.t0) * PB.fps);
  const lw = (P, f) => { let s = 0, n = 0; for (let k = -w; k < w; k++) if (P.loud[f + k] !== undefined) { s += P.loud[f + k]; n++; } return n ? s / n : 0; };
  const alike2 = (fa, fb) => {
    let dot = 0, na = 0, nbb = 0;
    for (let k = -w; k < w; k++) {
      const p = PA.frames[fa + k], q = PB.frames[fb + k];
      if (!p || !q) continue;
      for (let b = 0; b < p.length; b++) { const u = p[b] - mean[b], v = q[b] - mean[b]; dot += u * v; na += u * u; nbb += v * v; }
    }
    return dot / (Math.sqrt(na * nbb) || 1e-9);
  };
  const found = [];
  for (const a of As) for (const b of Bs) {
    const L = b - a;
    if (L < Math.max(beat, 0.5)) continue;
    const sim = alike2(frA(a), frB(b)); // the sound around B is like the sound around A: the jump back is hidden
    const la = lw(PA, frA(a)), lb = lw(PB, frB(b));
    const loud = Math.min(la, lb) / (Math.max(la, lb) || 1e-9); // same loudness at both ends
    const nBeats = Math.round(L / beat);
    const onBeat = Math.abs(L / beat - nBeats) < 0.02;
    const bar = grid.bpm > 30 && onBeat ? (nBeats % 4 === 0 ? 0.06 : nBeats % 2 === 0 ? 0.02 : 0) : 0; // whole bars feel natural
    const near = (Math.abs(a - A) + Math.abs(b - B)) / (2 * reach || 1); // stay close to your marks
    found.push({ a, b, beats: nBeats, raw: 0.75 * sim + 0.25 * loud + bar - 0.06 * near });
  }
  found.sort((p, q) => q.raw - p.raw);
  const pick = [];
  for (const c of found) {
    if (pick.some((p) => Math.abs(p.a - c.a) < beat * 0.99 && Math.abs(p.b - c.b) < beat * 0.99)) continue; // not nearly the same join twice
    pick.push(c);
    if (pick.length >= top) break;
  }
  // fine-tune each join to the sample: the waveform at B lines up with the one at A (no click)
  const search = Math.min(0.03, beat / 8), win = Math.round(0.04 * rate), r = Math.round(search * rate);
  return pick.map((c) => {
    const xa = segA.x, xb = segB.x;
    const ia = zeroCross(xa, Math.max(0, Math.min(xa.length - win - 1, Math.round((c.a - segA.t0) * rate))), Math.round(0.005 * rate));
    let ea = 0; for (let k = 0; k < win; k++) ea += (xa[ia + k] || 0) ** 2;
    ea = Math.sqrt(ea) || 1e-9;
    const ib0 = Math.round((c.b - segB.t0) * rate);
    let best = ib0, bestScore = -Infinity;
    for (let ib = Math.max(0, ib0 - r); ib <= Math.min(xb.length - win - 1, ib0 + r); ib++) {
      let dot = 0, eb = 0;
      for (let k = 0; k < win; k++) { const p = xa[ia + k] || 0, q = xb[ib + k] || 0; dot += p * q; eb += q * q; }
      const sc = dot / (ea * (Math.sqrt(eb) || 1e-9)) - (Math.abs(ib - ib0) / (r || 1)) * 0.02;
      if (sc > bestScore) { bestScore = sc; best = ib; }
    }
    const a = ia / rate + segA.t0, b = Math.min(best / rate + segB.t0, songDur);
    return { a: +a.toFixed(4), b: +b.toFixed(4), beats: c.beats, score: Math.round(100 * clamp(0.5 + 0.5 * c.raw, 0, 1)) };
  }).filter((j) => j.b - j.a > 0.2);
}
// one piece of sound that holds both A and B
function findLoops(x, rate, t0, A, B, grid = {}, opts = {}) { const seg = { x, t0 }; return findLoopsIn(seg, seg, rate, A, B, grid, opts); }

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
// Sound (speed / pitch, studio quality) and fades of one track. speed / pitch in %, fades in output seconds.
const TEMPO_LIMITS = [0.25, 4];
const trackTempo = (speed = 100, extra = 1) => clamp((speed / 100) * extra, TEMPO_LIMITS[0], TEMPO_LIMITS[1]); // Match beat x Speed, kept in range
function soundFilter({ speed = 100, pitch = 100, natural = true } = {}, extraTempo = 1) {
  const tempo = trackTempo(speed, extraTempo), p = pitch / 100;
  if (Math.abs(tempo - 1) < 1e-4 && Math.abs(p - 1) < 1e-4) return [];
  return [`rubberband=tempo=${tempo.toFixed(5)}:pitch=${p.toFixed(5)}:formant=${natural === false ? 'shifted' : 'preserved'}:pitchq=quality:channels=together`];
}
function fadeFilters({ fadeIn = 0, fadeOut = 0, fadeShape = 'lin' } = {}, len) {
  const curve = FXM.FADE_SHAPES[fadeShape] || 'tri';
  const fi = clamp(+fadeIn || 0, 0, len), fo = clamp(+fadeOut || 0, 0, Math.max(0, len - fi));
  const out = [];
  if (fi > 0.001) out.push(`afade=t=in:st=0:d=${f4(fi)}:curve=${curve}`);
  if (fo > 0.001) out.push(`afade=t=out:st=${f4(len - fo)}:d=${f4(fo)}:curve=${curve}`);
  return out;
}
function mixGraph(layers, songDur, { songVolume = 100, songPan = 0, songMute = false, songSolo = false, songFx = {}, songSound = {}, songFade = {} } = {}) {
  const songSpeed = trackTempo(songSound.speed ?? 100);
  const rate = FXM.params(songFx).rate * songSpeed; // song seconds per real second
  const outDur = songDur / rate;
  const solo = songSolo || layers.some((L) => L.solo && !L.mute); // any solo: only solo tracks are heard
  const live = layers.map((L, i) => ({ ...L, input: i + 1 })).filter((L) => !L.mute && (!solo || L.solo));
  const g = [], outs = [], ducks = [];
  for (const L of live) {
    const chain = [`aresample=${RATE}`, `aformat=sample_rates=${RATE}:channel_layouts=stereo`];
    if (L.to > L.from) chain.push(`atrim=${f4(L.from || 0)}:${f4(L.to)}`, 'asetpts=N/SR/TB');
    const tempo = trackTempo(L.speed ?? 100, L.tempo || 1); // Match beat x the track's own speed
    chain.push(...soundFilter(L, L.tempo || 1));
    const len = ((L.to || 0) - (L.from || 0)) / tempo;
    const start = (L.offset || 0) / rate;
    const reps = L.repeat === 0 && len > 0 ? Math.ceil(Math.max(0, outDur - start) / len) : (L.repeat || 1);
    if (reps > 1 && len > 0) chain.push(`aloop=loop=${Math.min(999, reps - 1)}:size=${Math.round(len * RATE)}:start=0`);
    if (L.repeat === 0) chain.push(`atrim=0:${f4(Math.max(0.01, outDur - start))}`);
    chain.push(...effectFilters(L.fx, { noRate: true }));
    chain.push(...fadeFilters(L, Math.min(L.repeat === 0 ? outDur - start : len * reps, Math.max(0.01, outDur - start)))); // fades at the track's start and end
    chain.push(`volume=${((L.volume ?? 100) / 100).toFixed(4)}`, panFilter(L.pan));
    const ms = Math.round(start * 1000);
    if (ms > 0) chain.push(`adelay=${ms}|${ms}`);
    const tag = `l${L.input}`;
    if (L.duck) { chain.push(`asplit=2[${tag}][${tag}d]`); ducks.push(`[${tag}d]`); g.push(`[${L.input}:a]${chain.join(',')}`); } else g.push(`[${L.input}:a]${chain.join(',')}[${tag}]`);
    outs.push(`[${tag}]`);
  }
  const vol = songMute || (solo && !songSolo) ? 0 : songVolume;
  const song = [`aresample=${RATE}`, `aformat=sample_rates=${RATE}:channel_layouts=stereo`, ...soundFilter(songSound), ...effectFilters(songFx), ...fadeFilters(songFade, outDur), `volume=${(vol / 100).toFixed(4)}`];
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
  soundFilter, fadeFilters, trackTempo, findLoops, findLoopsIn, soundPrint, RATE, TRIM_LEVELS, parseSilence, silences, trimPoints, splitPoints, loudness, sameLoudness, decodeMono,
  smartLoop, zeroCross, beats, snapToBeat, tempoMatch, EFFECTS, effectChain, loopLength, loopGraph, panFilter,
  mixGraph, effectFilters, BLENDS, connectGraph, SOUNDS, makeSound,
};
