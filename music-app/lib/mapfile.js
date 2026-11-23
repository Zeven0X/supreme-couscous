'use strict';
// The .tonixmap file: one file that holds a whole map, its songs, covers and pictures.
// Layout: "TONIXMAP1\n" · 4-byte length · a JSON list of what is inside · the files, one after another.
// Nothing in a received file is trusted: names inside it are never used as file paths, sizes are checked,
// and the map itself is rebuilt field by field (cleanMap).
const fs = require('fs');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');

const MAGIC = Buffer.from('TONIXMAP1\n');
const MAX_INDEX = 20 * 1024 * 1024; // the JSON list can never be bigger than this
const VERSION = 1;

// files: [{ id, path }] in the order they are written. index gets a `files` list with sizes.
async function writeMapFile(dest, index, files, onProgress) {
  const list = files.map((f) => ({ id: f.id, size: fs.statSync(f.path).size }));
  const json = Buffer.from(JSON.stringify({ ...index, version: VERSION, files: list }), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(json.length);
  const total = list.reduce((a, f) => a + f.size, 0) || 1;
  let done = 0;
  const tmp = `${dest}.part`;
  const out = fs.createWriteStream(tmp);
  try {
    await new Promise((res, rej) => out.write(Buffer.concat([MAGIC, len, json]), (e) => (e ? rej(e) : res())));
    for (const f of files) {
      const count = new Transform({ transform(chunk, _e, cb) { done += chunk.length; if (onProgress) onProgress(done / total); cb(null, chunk); } });
      await pipeline(fs.createReadStream(f.path), count, out, { end: false });
    }
    await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())));
    fs.renameSync(tmp, dest);
  } catch (e) {
    out.destroy();
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  return dest;
}

// Reads and checks the list of contents. Returns { index, offsets: Map(id -> { start, size }) }.
function readIndex(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const head = Buffer.alloc(MAGIC.length + 4);
    if (fs.readSync(fd, head, 0, head.length, 0) !== head.length || !head.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('This is not a Tonix map file');
    }
    const n = head.readUInt32BE(MAGIC.length);
    if (n < 2 || n > MAX_INDEX || head.length + n > size) throw new Error('This map file is damaged');
    const buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, head.length);
    let index;
    try { index = JSON.parse(buf.toString('utf8')); } catch (_) { throw new Error('This map file is damaged'); }
    if (!index || typeof index !== 'object' || !Array.isArray(index.files) || !index.map || typeof index.map !== 'object') throw new Error('This map file is damaged');
    if (index.version > VERSION) throw new Error('This map was made by a newer Tonix. Please update Tonix to open it.');
    const offsets = new Map();
    let pos = head.length + n;
    for (const f of index.files) {
      if (!f || typeof f.id !== 'string' || !Number.isSafeInteger(f.size) || f.size < 0 || offsets.has(f.id)) throw new Error('This map file is damaged');
      offsets.set(f.id, { start: pos, size: f.size });
      pos += f.size;
    }
    if (pos !== size) throw new Error('This map file is damaged or not complete');
    return { index, offsets };
  } finally {
    fs.closeSync(fd);
  }
}

// Copies one file out of the map file to `dest` (a path chosen by Tonix, never by the file).
async function extract(file, offsets, id, dest) {
  const o = offsets.get(id);
  if (!o) throw new Error('This map file is missing a part');
  if (o.size === 0) { fs.writeFileSync(dest, ''); return dest; }
  await pipeline(fs.createReadStream(file, { start: o.start, end: o.start + o.size - 1 }), fs.createWriteStream(dest));
  return dest;
}

// ---------- rebuilding a received map safely ----------
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const color = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null);

// stopTrack: Map(old stop id -> new track id) for stops whose song came through. Other stops are dropped.
// bgFiles: Map(old picture file name -> new file name). normFx: cleans a song's sound settings.
function cleanMap(m, { id, stopTrack, bgFiles, cover, normFx, newId }) {
  const stopIds = new Map(); // old stop id -> new stop id
  const stops = [];
  for (const s of Array.isArray(m.stops) ? m.stops : []) {
    if (!s || !stopTrack.has(s.id) || stopIds.has(s.id)) continue;
    const nid = newId();
    stopIds.set(s.id, nid);
    stops.push({ id: nid, trackId: stopTrack.get(s.id), x: Math.round(num(s.x, -1e6, 1e6, 0)), y: Math.round(num(s.y, -1e6, 1e6, 0)), fx: normFx(s.fx || {}) });
  }
  const paths = [];
  const seen = new Set();
  for (const p of Array.isArray(m.paths) ? m.paths : []) {
    if (!p || !stopIds.has(p.from) || !stopIds.has(p.to)) continue;
    const from = stopIds.get(p.from), to = stopIds.get(p.to);
    if (seen.has(`${from}>${to}`)) continue;
    seen.add(`${from}>${to}`);
    const blend = p.blend && typeof p.blend === 'object' ? p.blend : {};
    const path = {
      id: newId(), from, to,
      chance: Math.round(num(p.chance, 0, 100, 0)),
      locked: !!p.locked,
      blend: { type: ['crossfade', 'silence', 'cut'].includes(blend.type) ? blend.type : 'crossfade', secs: num(blend.secs, 0, 15, 3) },
      color: color(p.color),
      style: ['solid', 'dashed', 'dotted'].includes(p.style) ? p.style : 'solid',
      name: str(p.name, 30),
    };
    if (Array.isArray(p.pts)) {
      const pts = p.pts.filter((q) => Array.isArray(q) && q.length === 2 && q.every((v) => Number.isFinite(Number(v)))).slice(0, 40)
        .map((q) => [num(q[0], -1e4, 1e4, 0), num(q[1], -1e4, 1e4, 0)]);
      if (pts.length) path.pts = pts;
    }
    paths.push(path);
  }
  const customBgs = [];
  for (const b of Array.isArray(m.customBgs) ? m.customBgs : []) {
    if (b && bgFiles.has(b.file)) customBgs.push({ file: bgFiles.get(b.file), w: Math.round(num(b.w, 1, 4096, 512)), h: Math.round(num(b.h, 1, 4096, 512)), label: str(b.label, 80) || 'picture' });
  }
  let bg = { kind: 'builtin', id: 'dots' };
  if (m.bg && m.bg.kind === 'custom' && bgFiles.has(m.bg.file)) {
    const b = customBgs.find((x) => x.file === bgFiles.get(m.bg.file));
    bg = { kind: 'custom', file: bgFiles.get(m.bg.file), w: b ? b.w : 512, h: b ? b.h : 512 };
  } else if (m.bg && m.bg.kind === 'builtin' && typeof m.bg.id === 'string' && /^[a-z]{2,20}$/.test(m.bg.id)) bg = { kind: 'builtin', id: m.bg.id };
  const names = m.names && ['auto', 'light', 'dark', 'custom'].includes(m.names.mode) ? { mode: m.names.mode, color: color(m.names.color) || '#ffffff' } : { mode: 'auto', color: '#ffffff' };
  const v = m.view || {};
  return {
    id,
    name: str(m.name, 200).trim() || 'Imported map',
    cover,
    startId: stopIds.get(m.startId) || (stops[0] ? stops[0].id : null),
    stops, paths,
    view: { x: num(v.x, -1e6, 1e6, 0), y: num(v.y, -1e6, 1e6, 0), zoom: num(v.zoom, 0.3, 2.5, 1) },
    progress: null,
    bg, names, customBgs,
  };
}

module.exports = { writeMapFile, readIndex, extract, cleanMap, MAGIC };
