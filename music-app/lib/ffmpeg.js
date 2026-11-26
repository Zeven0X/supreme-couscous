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
const DEFAULT_FX = { speed: 100, pitch: 100, volume: 100, fadeIn: 0, fadeOut: 0, natural: true };

let ffmpegPath = null;
function resolveFfmpeg() {
  if (ffmpegPath) return ffmpegPath;
  const candidates = [];
  for (const v of ['TONIX_FFMPEG', 'TUNEFORGE_FFMPEG']) if (process.env[v]) candidates.push(process.env[v]);
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
  for (const k of Object.keys(LIMITS)) out[k] = clamp(fx[k] ?? DEFAULT_FX[k], LIMITS[k]);
  out.natural = fx.natural !== false; // Natural voice: keep singers sounding human when the pitch changes
  return out;
}

const OUT_RATE = 44100;

// The studio pitch and speed tool (Rubber Band, built into ffmpeg). Same settings are used for saved
// files and for the pitched copy the player listens to, so what you hear is what you save.
function rubberband({ tempo = 1, pitch = 1, natural = true }) {
  return `rubberband=tempo=${tempo.toFixed(6)}:pitch=${pitch.toFixed(6)}:formant=${natural ? 'preserved' : 'shifted'}:pitchq=quality:channels=together`;
}

/**
 * Builds the ffmpeg audio filter for one song.
 * speed changes tempo only, pitch changes pitch only, fades are in output seconds.
 * Returns { filter, outDuration }.
 */
function buildFilter(fxIn, duration) {
  const fx = normalizeFx(fxIn);
  const speed = fx.speed / 100;
  const pitch = fx.pitch / 100;
  const parts = [`aresample=${OUT_RATE}`];
  if (Math.abs(speed - 1) > 1e-9 || Math.abs(pitch - 1) > 1e-9) parts.push(rubberband({ tempo: speed, pitch, natural: fx.natural }));
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

// A copy of a song for listening, at its new speed and pitch (length = original length / tempo).
// start/len (seconds of the original) render only a part, so a change can be heard within about a second.
function renderPitched({ src, dest, pitch = 1, tempo = 1, natural, start = 0, len = 0, duration, onProgress, onSpawn }) {
  const args = ['-y'];
  if (start > 0) args.push('-ss', start.toFixed(3));
  if (len > 0) args.push('-t', len.toFixed(3));
  args.push('-i', src, '-map', '0:a:0', '-vn', '-af',
    `aresample=${OUT_RATE},${rubberband({ tempo, pitch, natural })},aformat=sample_fmts=s16:channel_layouts=stereo`,
    '-c:a', 'flac', '-compression_level', '0', dest);
  return run(args, { duration: (len || duration) / tempo, onProgress, onSpawn });
}

// ---- parsing ffmpeg's text output ----
function unescapeMeta(v) { return v.replace(/\\(.)/g, '$1'); }
function parseFfmetadata(text) {
  const tags = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('[')) break; // [CHAPTER] / [STREAM] parts follow: their titles are not the song's title
    if (!line || line.startsWith(';')) continue;
    const m = line.match(/^((?:[^=\\]|\\.)+)=(.*)$/);
    if (m) tags[unescapeMeta(m[1]).toLowerCase()] = unescapeMeta(m[2]).trim();
  }
  return tags;
}
function parseInfo(stderr) {
  const info = { duration: 0, audioCodec: null, hasAudio: false, coverStream: null, hasVideo: false, sampleRate: 0 };
  const d = stderr.match(/^\s*Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/m); // only the real "Duration:" line, not a tag that says it (found in the bug hunt)
  if (d) info.duration = +d[1] * 3600 + +d[2] * 60 + +d[3];
  for (const line of stderr.split(/\r?\n/)) {
    const m = line.match(/^\s*Stream #(\d+):(\d+)[^:]*:\s*(Audio|Video):\s*([a-z0-9_]+)/i);
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
  const out = {
    title: get('title') || path.basename(filePath, path.extname(filePath)),
    artist: get('artist', 'album_artist', 'albumartist', 'author'),
    album: get('album'),
    date: get('date', 'year', 'originaldate'),
    label: '',
    genre: get('genre'),
    track: get('track', 'tracknumber', 'trck'),
  };
  // Tonix's own information, written into files Tonix saved (see tagArgs)
  const cm = String(get('comment', 'icmt')).match(/Tonix:\s*(.*)$/); // M4A / WAV: "Tonix: stars=7; shuffle=black; plays=12"
  if (cm) {
    for (const part of cm[1].split(/(?<!\\);/)) {
      const i = part.search(/(?<!\\)=/);
      if (i < 1) continue;
      const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim().replace(/\\([\\;=])/g, '$1');
      if (k && v) tags[`tonix_${k}`] = v;
    }
  }
  out.label = get('label', 'publisher', 'organization', 'tpub', 'tonix_label', 'copyright');
  const stars = parseInt(get('tonix_stars'), 10);
  if (stars >= 1 && stars <= 10) out.stars = stars;
  const mark = get('tonix_shuffle');
  if (mark === 'black' || mark === 'fav') out.mark = mark;
  const plays = parseInt(get('tonix_plays'), 10);
  if (plays > 0) out.plays = plays;
  return out;
}

// ---- running ffmpeg ----
const running = new Set(); // every ffmpeg job, so they can all be stopped when Tonix closes
const partFiles = new Set(); // files being written right now (removed if Tonix closes halfway)
function stopAll() {
  for (const p of running) { try { p.kill(); } catch (_) { /* gone */ } }
  for (const f of partFiles) { try { fs.rmSync(f, { force: true }); } catch (_) { /* still locked */ } } // no half-written files left (found in the bug hunt)
}
const sameFile = (a, b) => !!a && !!b && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
// rename, trying again for a moment when Windows (antivirus, search indexer) still holds the file
function renameRetry(from, to, tries = 12) {
  for (let i = 0; ; i++) {
    try { fs.renameSync(from, to); return to; } catch (e) { if (i >= tries || !['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw e; pause(150); }
  }
}
let partN = 0;
// write a file safely: first under a temporary name next to it, renamed only when complete. Never over a file it reads from.
async function writeSafely(dest, reads, write) {
  if (reads.some((r) => sameFile(r, dest))) throw new Error("A song can't be saved over its own file. Choose another name or folder.");
  const p = path.parse(dest);
  const tmp = path.join(p.dir, `.tonix-part-${process.pid}-${++partN}${p.ext}`);
  partFiles.add(tmp);
  try { await write(tmp); renameRetry(tmp, dest); return dest; } catch (e) { fs.rmSync(tmp, { force: true }); throw e; } finally { partFiles.delete(tmp); }
}
function run(args, { onProgress, duration, onLine, onSpawn } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(resolveFfmpeg(), ['-hide_banner', ...args], { windowsHide: true });
    running.add(proc);
    proc.on('close', () => running.delete(proc));
    if (onSpawn) onSpawn(proc);
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
  let raw = parseFfmetadata(stdout.toString('utf8'));
  if (!raw.title && info.hasAudio) { // OGG / Opus keep their tags on the sound stream, not on the file
    try {
      const s = await run(['-i', file, '-map_metadata', '0:s:a:0', '-f', 'ffmetadata', '-']);
      raw = { ...parseFfmetadata(s.stdout.toString('utf8')), ...raw };
    } catch (_) { /* no stream tags */ }
  }
  const tags = pickTags(raw, file);
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

// A picture as input. A name with % in it ("50%d off.png") would be read as a numbered series of pictures,
// so then the plain picture reader is used with numbering switched off.
function imageInput(src) { return String(src).includes('%') ? ['-f', 'image2', '-pattern_type', 'none', '-i', src] : ['-i', src]; }
// Any picture the user chooses -> normalized jpg.
function imageToJpg(src, dest) {
  return run(['-y', ...imageInput(src), '-frames:v', '1', '-update', '1', '-vf', "scale='min(1000,iw)':-2", '-q:v', '3', dest]);
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

// Song information written into a saved file. The TONIX_ ones are Tonix's own (stars 1-10, blacklist /
// favourite, plays); other music apps keep them but don't use them.
// M4A and WAV can't hold unusual tags (M4A would lose its picture), so there the Tonix part goes into
// the normal Comment field: "Tonix: stars=7; shuffle=black; plays=12".
function tagArgs(tags = {}, format = 'mp3') {
  const map = { title: 'title', artist: 'artist', album: 'album', date: 'date', genre: 'genre', label: 'publisher', albumArtist: 'album_artist', track: 'track' };
  const own = { stars: 'TONIX_STARS', mark: 'TONIX_SHUFFLE', plays: 'TONIX_PLAYS' };
  const args = [];
  for (const [k, key] of Object.entries(map)) if (tags[k]) args.push('-metadata', `${key}=${tags[k]}`);
  if (FORMATS[format] && FORMATS[format].infoInComment) {
    const parts = [[['m4a', 'wav'].includes(format) ? 'label' : '', tags.label], ['stars', tags.stars], ['shuffle', tags.mark], ['plays', tags.plays]] // M4A / WAV have no label field
      .filter(([k, v]) => k && v).map(([k, v]) => `${k}=${String(v).replace(/[\\;=]/g, (c) => `\\${c}`)}`); // \; \= \\ keep those characters
    if (parts.length) args.push('-metadata', `comment=Tonix: ${parts.join('; ')}`);
  } else for (const [k, key] of Object.entries(own)) if (tags[k]) args.push('-metadata', `${key}=${tags[k]}`);
  return args;
}
function coverOutArgs(streamIndex) {
  return ['-map', `${streamIndex}:v:0`, '-c:v', 'mjpeg', '-disposition:v:0', 'attached_pic', '-metadata:s:v:0', 'title=Album cover', '-metadata:s:v:0', 'comment=Cover (front)'];
}

// File types a song can be saved as. lossy = has a quality (kbps); cover = can hold a picture.
const FORMATS = {
  mp3: { label: 'MP3', lossy: true, cover: true, chapters: true, codec: (b) => ['-c:a', 'libmp3lame', '-b:a', bitrateArg(b), '-id3v2_version', '3'] },
  m4a: { label: 'M4A', lossy: true, cover: true, chapters: true, codec: (b) => ['-c:a', 'aac', '-b:a', bitrateArg(b), '-movflags', '+faststart'], infoInComment: true },
  flac: { label: 'FLAC', lossy: false, cover: true, codec: () => ['-c:a', 'flac', '-sample_fmt', 's16'] },
  wav: { label: 'WAV', lossy: false, cover: false, codec: () => ['-c:a', 'pcm_s16le'], infoInComment: true },
  ogg: { label: 'OGG', lossy: true, cover: false, codec: (b) => ['-c:a', 'libvorbis', '-b:a', bitrateArg(b)] },
};
const formatOf = (f) => (FORMATS[f] ? f : 'mp3');

// Export one song with its effects (+ cover + tags). format: a key of FORMATS
function exportOne({ src, dest, fx, duration, tags, coverPath, format = 'mp3', bitrate = 320, onProgress }) {
  format = formatOf(format);
  const { filter, outDuration } = buildFilter(fx, duration);
  const args = ['-y', '-i', src];
  const withCover = FORMATS[format].cover && coverPath && fs.existsSync(coverPath);
  if (withCover) args.push('-i', coverPath);
  args.push('-map', '0:a:0', '-af', filter);
  if (withCover) args.push(...coverOutArgs(1));
  args.push('-map_metadata', '-1', ...tagArgs(tags, format), ...FORMATS[format].codec(bitrate));
  return writeSafely(dest, [src, coverPath], (tmp) => run([...args, tmp], { duration: outDuration, onProgress })); // no broken file left, never the source
}

function escapeMeta(v) { return String(v).replace(/([=;#\\\n])/g, '\\$1'); }

// Several songs -> one big MP3, each with its own effects, with chapter marks.
async function exportCombined({ items, dest, tags, coverPath, bitrate = 320, format = 'mp3', tmpDir, onProgress }) {
  format = FORMATS[format] && FORMATS[format].chapters ? format : 'mp3';
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
  const graphFile = path.join(tmpDir, `join-${Date.now()}.txt`); // a long recipe would not fit on a Windows command line
  fs.writeFileSync(graphFile, graph);
  args.push('-filter_complex_script', graphFile, '-map', '[out]');
  if (withCover) args.push(...coverOutArgs(metaIdx + 1));
  args.push('-map_metadata', '-1', '-map_chapters', String(metaIdx), ...tagArgs(tags, format), ...FORMATS[format].codec(bitrate));
  try {
    await writeSafely(dest, [...items.map((it) => it.src), coverPath], (tmp) => run([...args, tmp], { duration: t, onProgress }));
  } finally {
    fs.rmSync(metaFile, { force: true });
    fs.rmSync(graphFile, { force: true });
  }
  return { duration: t, chapters };
}

module.exports = {
  AUDIO_EXT, VIDEO_EXT, LIMITS, DEFAULT_FX, FORMATS, formatOf,
  resolveFfmpeg, isSupported, extOf, normalizeFx, buildFilter, renderPitched, rubberband,
  parseFfmetadata, parseInfo, pickTags,
  run, stopAll, imageInput, writeSafely, renameRetry, sameFile, partFiles, probe, toMp3, extractCover, imageToJpg, peaks, exportOne, exportCombined, tagArgs, coverOutArgs,
};
