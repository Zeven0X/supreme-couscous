'use strict';
// Everything that talks to ffmpeg lives here. Pure helpers (filter building,
// parsing) are exported separately so they can be unit tested without ffmpeg.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac', 'wma', 'aiff', 'aif', 'alac', 'mka'];
const VIDEO_EXT = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v', 'wmv', 'flv', '3gp', 'mpeg', 'mpg', 'ts', 'mts', 'm2ts', 'vob', 'ogv'];
// Containers + codecs the built-in (Chromium) player can play without converting.
const DIRECT_EXT = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac'];
const DIRECT_CODECS = ['mp3', 'aac', 'vorbis', 'opus', 'flac', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le', 'pcm_u8'];

const LIMITS = {
  speed: [25, 400], // percent
  pitch: [50, 200], // percent (50% = one octave down, 200% = one octave up)
  volume: [0, 500], // percent
  fadeIn: [0, 15], // seconds
  fadeOut: [0, 15],
};
const DEFAULT_FX = { speed: 100, pitch: 100, volume: 100, fadeIn: 0, fadeOut: 0 };

let ffmpegPath = null;
function resolveFfmpeg() {
  if (ffmpegPath) return ffmpegPath;
  const candidates = [];
  if (process.env.TUNEFORGE_FFMPEG) candidates.push(process.env.TUNEFORGE_FFMPEG);
  try {
    // In a packaged app the binary is unpacked next to app.asar.
    candidates.push(require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked'));
  } catch (_) { /* not installed */ }
  for (const c of candidates) if (c && fs.existsSync(c)) return (ffmpegPath = c);
  return (ffmpegPath = 'ffmpeg'); // fall back to one on PATH
}

function extOf(p) { return path.extname(p).slice(1).toLowerCase(); }
function isSupported(p) { const e = extOf(p); return AUDIO_EXT.includes(e) || VIDEO_EXT.includes(e); }

function clamp(v, [lo, hi]) { v = Number(v); if (!Number.isFinite(v)) v = lo; return Math.min(hi, Math.max(lo, v)); }
function normalizeFx(fx = {}) {
  const out = {};
  for (const k of Object.keys(DEFAULT_FX)) out[k] = clamp(fx[k] ?? DEFAULT_FX[k], LIMITS[k]);
  return out;
}

// Split a tempo factor into atempo steps that each stay in [0.5, 2] (best quality).
function atempoChain(factor) {
  const steps = [];
  let f = factor;
  while (f > 2) { steps.push(2); f /= 2; }
  while (f < 0.5) { steps.push(0.5); f /= 0.5; }
  if (Math.abs(f - 1) > 1e-9) steps.push(f);
  return steps.map((s) => `atempo=${s.toFixed(9)}`);
}

const OUT_RATE = 44100;
const PITCH_RATE = 192000; // high internal rate so tiny pitch steps (0.001%) stay precise

/**
 * Builds the ffmpeg audio filter for one song.
 * speed changes tempo only, pitch changes pitch only, fades are in output seconds.
 * Returns { filter, outDuration }.
 */
function buildFilter(fxIn, duration) {
  const fx = normalizeFx(fxIn);
  const speed = fx.speed / 100;
  const pitch = fx.pitch / 100;
  const parts = [];
  let tempo = speed;
  if (Math.abs(pitch - 1) > 1e-9) {
    const rate = Math.round(PITCH_RATE * pitch);
    const realPitch = rate / PITCH_RATE;
    parts.push(`aresample=${PITCH_RATE}`, `asetrate=${rate}`, `aresample=${OUT_RATE}`);
    tempo = speed / realPitch; // asetrate also sped it up by realPitch; undo that
  } else {
    parts.push(`aresample=${OUT_RATE}`);
  }
  parts.push(...atempoChain(tempo));
  if (Math.abs(fx.volume - 100) > 1e-9) parts.push(`volume=${(fx.volume / 100).toFixed(5)}`);
  const outDuration = duration > 0 ? duration / speed : 0;
  if (fx.fadeIn > 0) parts.push(`afade=t=in:st=0:d=${fx.fadeIn.toFixed(3)}`);
  if (fx.fadeOut > 0 && outDuration > 0) {
    const d = Math.min(fx.fadeOut, outDuration);
    parts.push(`afade=t=out:st=${Math.max(0, outDuration - d).toFixed(3)}:d=${d.toFixed(3)}`);
  }
  parts.push(`aformat=sample_fmts=fltp:sample_rates=${OUT_RATE}:channel_layouts=stereo`);
  return { filter: parts.join(','), outDuration };
}

// ---- parsing ffmpeg's text output ----
function unescapeMeta(v) { return v.replace(/\\(.)/g, '$1'); }
function parseFfmetadata(text) {
  const tags = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith(';') || line.startsWith('[')) continue;
    const m = line.match(/^((?:[^=\\]|\\.)+)=(.*)$/);
    if (m) tags[unescapeMeta(m[1]).toLowerCase()] = unescapeMeta(m[2]).trim();
  }
  return tags;
}
function parseInfo(stderr) {
  const info = { duration: 0, audioCodec: null, hasAudio: false, coverStream: null, hasVideo: false, sampleRate: 0 };
  const d = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (d) info.duration = +d[1] * 3600 + +d[2] * 60 + +d[3];
  for (const line of stderr.split(/\r?\n/)) {
    const m = line.match(/Stream #(\d+):(\d+)[^:]*:\s*(Audio|Video):\s*([a-z0-9_]+)/i);
    if (!m) continue;
    if (m[3] === 'Audio' && !info.hasAudio) {
      info.hasAudio = true;
      info.audioCodec = m[4].toLowerCase();
      const sr = line.match(/(\d+) Hz/);
      if (sr) info.sampleRate = +sr[1];
    }
    if (m[3] === 'Video') {
      if (/attached pic/.test(line)) { if (info.coverStream === null) info.coverStream = +m[2]; } else info.hasVideo = true;
    }
  }
  return info;
}
function pickTags(tags, filePath) {
  const get = (...keys) => { for (const k of keys) if (tags[k]) return tags[k]; return ''; };
  return {
    title: get('title') || path.basename(filePath, path.extname(filePath)),
    artist: get('artist', 'album_artist', 'albumartist', 'author'),
    album: get('album'),
    date: get('date', 'year', 'originaldate'),
    label: get('label', 'publisher', 'organization', 'tpub', 'copyright'),
    genre: get('genre'),
  };
}

// ---- running ffmpeg ----
function run(args, { onProgress, duration, onLine } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(resolveFfmpeg(), ['-hide_banner', ...args], { windowsHide: true });
    const out = [];
    let err = '';
    proc.stdout.on('data', (b) => out.push(b));
    proc.stderr.on('data', (b) => {
      const s = b.toString();
      err += s;
      if (err.length > 200000) err = err.slice(-100000);
      if (onLine) onLine(s);
      if (onProgress && duration > 0) {
        const m = s.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g);
        if (m) {
          const t = m[m.length - 1].match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
          onProgress(Math.min(1, (+t[1] * 3600 + +t[2] * 60 + +t[3]) / duration));
        }
      }
    });
    proc.on('error', (e) => reject(new Error(`Could not start ffmpeg (${e.message})`)));
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err });
      else {
        const tail = err.trim().split(/\r?\n/).slice(-4).join(' | ');
        const e = new Error(`ffmpeg failed (code ${code}): ${tail}`);
        e.stderr = err;
        reject(e);
      }
    });
  });
}

async function probe(file) {
  const { stdout, stderr } = await run(['-i', file, '-f', 'ffmetadata', '-']);
  const info = parseInfo(stderr);
  const tags = pickTags(parseFfmetadata(stdout.toString('utf8')), file);
  const ext = extOf(file);
  info.isVideo = VIDEO_EXT.includes(ext) || info.hasVideo;
  info.directPlay = !info.isVideo && DIRECT_EXT.includes(ext) && DIRECT_CODECS.includes(info.audioCodec);
  return { info, tags };
}

function bitrateArg(kbps) { return `${[128, 192, 256, 320].includes(+kbps) ? +kbps : 320}k`; }

// Video (or odd audio) -> MP3, keeping the tags.
function toMp3(src, dest, { bitrate = 320, duration, onProgress } = {}) {
  return run(['-y', '-i', src, '-map', '0:a:0', '-vn', '-map_metadata', '0', '-c:a', 'libmp3lame', '-b:a', bitrateArg(bitrate), '-id3v2_version', '3', dest], { duration, onProgress });
}

// Pull the embedded cover picture (if any) into a jpg.
async function extractCover(src, coverStream, dest) {
  if (coverStream === null || coverStream === undefined) return false;
  await run(['-y', '-i', src, '-map', `0:${coverStream}`, '-frames:v', '1', '-vf', "scale='min(800,iw)':-2", '-q:v', '3', dest]);
  return fs.existsSync(dest);
}

// Any picture the user chooses -> normalized jpg.
function imageToJpg(src, dest) {
  return run(['-y', '-i', src, '-frames:v', '1', '-vf', "scale='min(1000,iw)':-2", '-q:v', '3', dest]);
}

// Peaks for the waveform: one value 0..1 per bucket.
async function peaks(src, buckets = 1600) {
  const rate = 4000;
  const { stdout } = await run(['-i', src, '-map', '0:a:0', '-ac', '1', '-ar', String(rate), '-f', 's16le', '-']);
  const samples = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 2));
  const n = Math.max(1, Math.min(buckets, samples.length));
  const per = samples.length / n;
  const res = new Array(n);
  let max = 1;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const a = Math.floor(i * per), b = Math.floor((i + 1) * per);
    for (let j = a; j < b; j++) { const v = Math.abs(samples[j]); if (v > m) m = v; }
    res[i] = m;
    if (m > max) max = m;
  }
  return res.map((v) => +(v / max).toFixed(3));
}

function tagArgs(tags = {}) {
  const map = { title: 'title', artist: 'artist', album: 'album', date: 'date', genre: 'genre', label: 'publisher', albumArtist: 'album_artist', track: 'track' };
  const args = [];
  for (const [k, key] of Object.entries(map)) if (tags[k]) args.push('-metadata', `${key}=${tags[k]}`);
  return args;
}
function coverOutArgs(streamIndex) {
  return ['-map', `${streamIndex}:v:0`, '-c:v', 'mjpeg', '-disposition:v:0', 'attached_pic', '-metadata:s:v:0', 'title=Album cover', '-metadata:s:v:0', 'comment=Cover (front)'];
}

// Export one song with its effects (+ cover + tags). format: 'mp3' | 'wav'
function exportOne({ src, dest, fx, duration, tags, coverPath, format = 'mp3', bitrate = 320, onProgress }) {
  const { filter, outDuration } = buildFilter(fx, duration);
  const args = ['-y', '-i', src];
  const withCover = format === 'mp3' && coverPath && fs.existsSync(coverPath);
  if (withCover) args.push('-i', coverPath);
  args.push('-map', '0:a:0', '-af', filter);
  if (withCover) args.push(...coverOutArgs(1));
  args.push('-map_metadata', '-1', ...tagArgs(tags));
  if (format === 'wav') args.push('-c:a', 'pcm_s16le');
  else args.push('-c:a', 'libmp3lame', '-b:a', bitrateArg(bitrate), '-id3v2_version', '3');
  args.push(dest);
  return run(args, { duration: outDuration, onProgress });
}

function escapeMeta(v) { return String(v).replace(/([=;#\\\n])/g, '\\$1'); }

// Several songs -> one big MP3, each with its own effects, with chapter marks.
async function exportCombined({ items, dest, tags, coverPath, bitrate = 320, tmpDir, onProgress }) {
  const args = ['-y'];
  const chains = [];
  const chapters = [];
  let t = 0;
  items.forEach((it, i) => {
    args.push('-i', it.src);
    const { filter, outDuration } = buildFilter(it.fx, it.duration);
    chains.push(`[${i}:a:0]${filter}[a${i}]`);
    chapters.push({ start: t, end: t + outDuration, title: it.title });
    t += outDuration;
  });
  const metaFile = path.join(tmpDir, `chapters-${Date.now()}.txt`);
  let meta = ';FFMETADATA1\n';
  for (const c of chapters) meta += `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(c.start * 1000)}\nEND=${Math.round(c.end * 1000)}\ntitle=${escapeMeta(c.title)}\n`;
  fs.writeFileSync(metaFile, meta);
  const metaIdx = items.length;
  args.push('-f', 'ffmetadata', '-i', metaFile);
  const withCover = coverPath && fs.existsSync(coverPath);
  if (withCover) args.push('-i', coverPath);
  const graph = chains.join(';') + ';' + items.map((_, i) => `[a${i}]`).join('') + `concat=n=${items.length}:v=0:a=1[out]`;
  args.push('-filter_complex', graph, '-map', '[out]');
  if (withCover) args.push(...coverOutArgs(metaIdx + 1));
  args.push('-map_metadata', '-1', '-map_chapters', String(metaIdx), ...tagArgs(tags), '-c:a', 'libmp3lame', '-b:a', bitrateArg(bitrate), '-id3v2_version', '3', dest);
  try {
    await run(args, { duration: t, onProgress });
  } finally {
    fs.rmSync(metaFile, { force: true });
  }
  return { duration: t, chapters };
}

module.exports = {
  AUDIO_EXT, VIDEO_EXT, LIMITS, DEFAULT_FX,
  resolveFfmpeg, isSupported, extOf, normalizeFx, atempoChain, buildFilter,
  parseFfmetadata, parseInfo, pickTags,
  run, probe, toMp3, extractCover, imageToJpg, peaks, exportOne, exportCombined,
};
