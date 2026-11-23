'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ff = require('./lib/ffmpeg');
const { Library } = require('./lib/library');
const { MapStore } = require('./lib/maps');
const { Studio } = require('./lib/studio');
const { Editor } = require('./lib/editor');
let editor = null;
let maps = null;
let studio = null;

app.setName('Tonix');
const DATA_DIR = process.env.TONIX_DATA || process.env.TUNEFORGE_DATA; // for testing only
if (DATA_DIR) app.setPath('userData', DATA_DIR);

let win = null;
let lib = null;
let server = null;
let baseUrl = '';
const TOKEN = crypto.randomBytes(12).toString('hex');
const RENDERER = path.join(__dirname, 'renderer');

// ---------- logging to the in-app terminal ----------
function log(level, msg) {
  const line = { level, msg: String(msg), time: Date.now() };
  if (win && !win.isDestroyed()) win.webContents.send('log', line);
  if (process.env.TONIX_DEBUG || process.env.TUNEFORGE_DEBUG) console.log(`[${level}] ${msg}`);
}
function send(channel, payload) { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); }

// ---------- local media server (127.0.0.1 only, random token in every URL) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
};

function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end(); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
    const range = req.headers.range && req.headers.range.match(/bytes=(\d*)-(\d*)/);
    if (range && (range[1] || range[2])) {
      let start = range[1] ? parseInt(range[1], 10) : st.size - parseInt(range[2], 10);
      let end = range[1] && range[2] ? parseInt(range[2], 10) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
      end = Math.min(end, st.size - 1);
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
      fs.createReadStream(file).pipe(res);
    }
  });
}

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (parts[0] !== TOKEN) { res.writeHead(403); res.end(); return; }
      if (parts[1] === 'app') {
        const file = path.normalize(path.join(RENDERER, ...parts.slice(2)));
        if (!file.startsWith(RENDERER)) { res.writeHead(403); res.end(); return; }
        return serveFile(req, res, file);
      }
      const t = lib.byId(parts[2]);
      if (parts[1] === 'media' && t) return serveFile(req, res, t.mediaPath);
      if (parts[1] === 'mapasset' && /^[a-f0-9]{12}-[a-f0-9]{8}\.png$/.test(parts[2] || '')) return serveFile(req, res, path.join(maps.assetDir, parts[2]));
      if (parts[1] === 'edit' && editor && /^[a-f0-9]{10}$/.test(parts[2] || '') && /^v[\d-]+\.flac$/.test(parts[3] || '')) return serveFile(req, res, path.join(editor.dir, parts[2], parts[3]));
      if (parts[1] === 'studio' && studio) { const f = studio.fileFor(parts[2] || ''); if (f) return serveFile(req, res, f); }
      if (parts[1] === 'plcover') { const p = lib.playlistById(parts[2]); if (p && p.cover) return serveFile(req, res, path.join(lib.coverDir, p.cover)); }
      if (parts[1] === 'cover' && t && t.cover) return serveFile(req, res, lib.coverPath(t));
      res.writeHead(404); res.end();
    });
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/${TOKEN}`;
      resolve();
    });
  });
}

// ---------- helpers ----------
function safeName(name, fallback = 'Untitled') {
  let n = String(name || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').trim();
  if (!n) n = fallback;
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(n)) n = `_${n}`;
  return n.slice(0, 150).replace(/[. ]+$/, '') || fallback; // Windows names can't end in a dot or space
}
// A free name: "Song.mp3" -> "Song (2).mp3". Folders have no extension ("Vol. 2" stays "Vol. 2 (2)").
function uniquePath(p, isDir = false) {
  if (!fs.existsSync(p)) return p;
  const { dir, name, ext } = isDir ? { dir: path.dirname(p), name: path.basename(p), ext: '' } : path.parse(p);
  for (let i = 2; ; i++) { const c = path.join(dir, `${name} (${i})${ext}`); if (!fs.existsSync(c)) return c; }
}
function collectFiles(paths) {
  const out = [];
  const walk = (p, depth) => {
    let st;
    try { st = fs.statSync(p); } catch (_) { return; }
    if (st.isDirectory()) {
      if (depth > 25) return;
      let entries = [];
      try { entries = fs.readdirSync(p); } catch (_) { return; }
      entries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      for (const e of entries) walk(path.join(p, e), depth + 1);
    } else if (st.isFile() && ff.isSupported(p)) out.push(p);
  };
  for (const p of paths) walk(p, 0);
  return out;
}
function exportDir() {
  const d = lib.settings.exportDir || path.join(app.getPath('music'), 'Tonix Exports');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function trackForUi(t) {
  const origName = t.imported ? t.title : path.basename(t.srcPath || '', path.extname(t.srcPath || ''));
  return { ...t, origName, coverUrl: t.cover ? `${baseUrl}/cover/${t.id}?v=${t.coverVersion || 0}` : null, mediaUrl: `${baseUrl}/media/${t.id}` };
}
// How saved songs are named (Settings → Saving).
function fileName(t) {
  const mode = lib.settings.fileNames;
  if (!t.artist || mode === 'title') return t.title;
  return mode === 'title-artist' ? `${t.title} - ${t.artist}` : `${t.artist} - ${t.title}`;
}
function oldVersionsDir() { return path.join(app.getPath('documents'), 'Tonix', 'Old versions'); }
function playlistForUi(p) {
  return { ...p, coverUrl: p.cover ? `${baseUrl}/plcover/${p.id}?v=${p.coverVersion || 0}` : null };
}
function state() {
  return { playClock: lib.playClock, playlists: lib.playlists.map(playlistForUi), tracks: lib.tracks.map(trackForUi), settings: { ...lib.settings, exportDir: exportDir() }, baseUrl, libraryDir: lib.dataDir, limits: ff.LIMITS, defaults: ff.DEFAULT_FX };
}
async function setCoverFromImage(t, imagePath) {
  const name = `${t.id}.jpg`;
  await ff.imageToJpg(imagePath, path.join(lib.coverDir, name));
  t.cover = name;
  t.coverVersion = (t.coverVersion || 0) + 1;
  lib.save();
}

// ---------- import ----------
let importing = Promise.resolve();
function importPaths(paths) {
  const job = importing.then(() => doImport(paths));
  importing = job.catch(() => {});
  return job;
}
async function doImport(paths) {
  const files = collectFiles(paths);
  const added = [];
  const ids = []; // every song from these files, new or already in the library, in order
  let skipped = 0, failed = 0;
  if (!files.length) { log('warn', 'No supported audio or video files found.'); return { added, skipped, failed, ids }; }
  log('info', `Importing ${files.length} file(s)...`);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = path.basename(file);
    send('import-progress', { done: i, total: files.length, name });
    const known = lib.bySource(file);
    if (known) { skipped++; ids.push(known.id); continue; }
    try {
      const { info, tags } = await ff.probe(file);
      if (!info.hasAudio) throw new Error('this file has no sound track');
      const id = lib.newId();
      let mediaPath = file;
      let converted = false;
      if (!info.directPlay) {
        mediaPath = path.join(lib.mediaDir, `${id}.mp3`);
        log('info', `Converting ${name} to MP3...`);
        await ff.toMp3(file, mediaPath, {
          bitrate: lib.settings.bitrate, duration: info.duration,
          onProgress: (p) => send('import-progress', { done: i + p, total: files.length, name }),
        });
        converted = true;
      }
      let cover = null;
      try {
        if (await ff.extractCover(file, info.coverStream, path.join(lib.coverDir, `${id}.jpg`))) cover = `${id}.jpg`;
      } catch (e) { log('warn', `${name}: could not read its cover picture`); }
      const { mark, ...rest } = tags; // a blacklist / favourite saved in the file starts fresh here
      let t = lib.add({ id, ...rest, srcPath: file, mediaPath, converted, duration: info.duration, cover, isVideo: info.isVideo });
      if (mark) t = lib.mark([id], mark)[0];
      added.push(trackForUi(t));
      ids.push(t.id);
      log('ok', `Added "${t.title}"${converted ? ' (converted to MP3)' : ''}`);
    } catch (e) {
      failed++;
      log('error', `${name}: ${e.message}`);
    }
  }
  send('import-progress', { done: files.length, total: files.length, name: '' });
  lib.flush();
  log('info', `Import finished: ${added.length} added, ${skipped} already in library, ${failed} failed.`);
  return { added, skipped, failed, ids };
}

// ---------- export ----------
async function chooseDest(defaultName, ext) {
  if (!lib.settings.askWhereToSave) return uniquePath(path.join(exportDir(), `${safeName(defaultName)}.${ext}`));
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(exportDir(), `${safeName(defaultName)}.${ext}`),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  return r.canceled ? null : r.filePath;
}
async function chooseDir(defaultName) {
  if (!lib.settings.askWhereToSave) return uniquePath(path.join(exportDir(), safeName(defaultName)), true);
  const r = await dialog.showOpenDialog(win, { title: 'Choose where to put the album folder', defaultPath: exportDir(), properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : uniquePath(path.join(r.filePaths[0], safeName(defaultName)), true);
}

function activeMark(t) { return t.mark && (!Number.isFinite(t.markUntil) || lib.playClock < t.markUntil) ? t.mark : ''; }
function tagsOf(t) {
  return { title: t.title, artist: t.artist, album: t.album, date: t.date, genre: t.genre, label: t.label, track: t.track,
    stars: t.stars || '', mark: activeMark(t), plays: t.plays || '' };
}

async function exportTrack(id, opts = {}) {
  const t = lib.byId(id);
  if (!t) throw new Error('Song not found');
  if (opts.tags) lib.update(id, opts.tags);
  if (opts.coverImage) await setCoverFromImage(t, opts.coverImage);
  const format = ff.formatOf(opts.format || lib.settings.format);
  const bitrate = [128, 192, 256, 320].includes(+opts.bitrate) ? +opts.bitrate : lib.settings.bitrate;
  let dest;
  if (opts.dir) { // the save window chose the folder and the file name
    fs.mkdirSync(opts.dir, { recursive: true });
    dest = uniquePath(path.join(opts.dir, `${safeName(opts.name || fileName(t))}.${format}`));
  } else dest = await chooseDest(fileName(t), format);
  if (!dest) return { canceled: true };
  log('info', `Saving "${t.title}" (speed ${t.fx.speed}%, pitch ${t.fx.pitch}%, volume ${t.fx.volume}%, fade in ${t.fx.fadeIn}s, fade out ${t.fx.fadeOut}s)...`);
  const started = Date.now();
  await ff.exportOne({
    src: t.mediaPath, dest, fx: t.fx, duration: t.duration, tags: tagsOf(t), coverPath: lib.coverPath(t),
    format, bitrate,
    onProgress: (p) => send('export-progress', { p, label: t.title }),
  });
  send('export-progress', { p: 1, label: t.title });
  lib.setSettings({ format, bitrate, ...(opts.dir ? { exportDir: opts.dir } : {}) }); // saved fine: remembered for next time
  log('ok', `Saved ${dest} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  return { path: dest, track: trackForUi(t) };
}

async function exportMany(ids, opts) {
  const tracks = ids.map((id) => lib.byId(id)).filter(Boolean);
  if (!tracks.length) throw new Error('No songs selected');
  const title = opts.title || 'My Album';
  // The cover: a picture the user picked, or the cover of one of the songs.
  let coverPath = null;
  let tmpCover = null;
  if (opts.coverImage) {
    tmpCover = path.join(os.tmpdir(), `tonix-cover-${Date.now()}.jpg`);
    await ff.imageToJpg(opts.coverImage, tmpCover);
    coverPath = tmpCover;
  } else if (opts.coverPlaylistId) { // the playlist's own picture
    const pl = lib.playlistById(opts.coverPlaylistId);
    if (pl && pl.cover) coverPath = path.join(lib.coverDir, pl.cover);
  } else if (opts.coverTrackId) coverPath = lib.coverPath(lib.byId(opts.coverTrackId));
  const albumTags = { album: title, albumArtist: opts.artist, date: opts.date, genre: opts.genre, label: opts.label };
  let format = ff.formatOf(opts.format || 'mp3');
  if (opts.mode === 'single' && !ff.FORMATS[format].chapters) format = 'mp3'; // one big file: only types that hold chapter marks
  const bitrate = [128, 192, 256, 320].includes(+opts.bitrate) ? +opts.bitrate : lib.settings.bitrate;
  const baseName = safeName(opts.name || (opts.artist ? `${opts.artist} - ${title}` : title));
  if (opts.dir) fs.mkdirSync(opts.dir, { recursive: true });
  const remember = () => lib.setSettings({ albumFormat: format, bitrate, albumMode: opts.mode === 'single' ? 'single' : 'album', ...(opts.dir ? { exportDir: opts.dir } : {}) });
  try {
    if (opts.mode === 'single') {
      const dest = opts.dir ? uniquePath(path.join(opts.dir, `${baseName}.${format}`)) : await chooseDest(baseName, format);
      if (!dest) return { canceled: true };
      log('info', `Joining ${tracks.length} songs into one ${format.toUpperCase()}...`);
      await ff.exportCombined({
        items: tracks.map((t) => ({ src: t.mediaPath, fx: t.fx, duration: t.duration, title: t.title })),
        dest, tags: { ...albumTags, title, artist: opts.artist }, coverPath, bitrate, format, tmpDir: os.tmpdir(),
        onProgress: (p) => send('export-progress', { p, label: title }),
      });
      send('export-progress', { p: 1, label: title });
      remember();
      log('ok', `Saved ${dest}`);
      return { path: dest };
    }
    const dir = opts.dir ? uniquePath(path.join(opts.dir, baseName), true) : await chooseDir(baseName);
    if (!dir) return { canceled: true };
    fs.mkdirSync(dir, { recursive: true });
    log('info', `Saving album "${title}" (${tracks.length} songs) to ${dir}...`);
    const pad = String(tracks.length).length < 2 ? 2 : String(tracks.length).length;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const dest = path.join(dir, `${String(i + 1).padStart(pad, '0')} - ${safeName(t.title)}.${format}`);
      await ff.exportOne({
        src: t.mediaPath, dest, fx: t.fx, duration: t.duration, bitrate, format,
        tags: { ...tagsOf(t), ...Object.fromEntries(Object.entries(albumTags).filter(([, v]) => v)), track: `${i + 1}/${tracks.length}` },
        coverPath: coverPath || lib.coverPath(t),
        onProgress: (p) => send('export-progress', { p: (i + p) / tracks.length, label: `${title}: ${t.title}` }),
      });
    }
    if (coverPath) fs.copyFileSync(coverPath, path.join(dir, 'cover.jpg'));
    send('export-progress', { p: 1, label: title });
    remember();
    log('ok', `Saved album to ${dir}`);
    return { path: dir };
  } finally {
    if (tmpCover) fs.rmSync(tmpCover, { force: true });
  }
}


// ---------- map export / import (.tonixmap) ----------
const MF = require('./lib/mapfile');
const Chance = require('./renderer/chance');
const hex = (n) => crypto.randomBytes(n).toString('hex');

async function exportMap(mapId) {
  const m = maps.get(mapId);
  const dest = await chooseDest(m.name, 'tonixmap');
  if (!dest) return { canceled: true };
  const files = [];
  const add = (p) => { if (!p || !fs.existsSync(p)) return null; const id = `f${files.length}`; files.push({ id, path: p }); return id; };
  const songs = [];
  for (const trackId of [...new Set(m.stops.map((s) => s.trackId))]) {
    const t = lib.byId(trackId);
    if (!t || !fs.existsSync(t.mediaPath)) continue; // a song removed from the library cannot travel
    songs.push({
      key: trackId, title: t.title, artist: t.artist, album: t.album, date: t.date, label: t.label, genre: t.genre, duration: t.duration,
      ext: path.extname(t.mediaPath).slice(1).toLowerCase(), media: add(t.mediaPath), cover: add(lib.coverPath(t)),
    });
  }
  const bgs = (m.customBgs || []).map((b) => ({ file: b.file, f: add(path.join(maps.assetDir, b.file)) })).filter((b) => b.f);
  const mapCover = m.cover ? add(path.join(maps.assetDir, m.cover)) : null;
  const index = { app: 'Tonix', exportedAt: new Date().toISOString(), map: { ...m, progress: null }, songs, bgs, mapCover };
  log('info', `Exporting map "${m.name}" with ${songs.length} song(s)...`);
  await MF.writeMapFile(dest, index, files, (p) => send('export-progress', { p, label: m.name }));
  send('export-progress', { p: 1, label: m.name });
  const missing = new Set(m.stops.map((s) => s.trackId)).size - songs.length;
  log('ok', `Saved ${dest}`);
  return { path: dest, songs: songs.length, missing };
}

// Picture from a received file -> a fresh PNG made by ffmpeg (proves it is really a picture).
async function importPicture(src, mapId) {
  const name = `${mapId}-${hex(4)}.png`;
  await ff.run(['-y', '-i', src, '-frames:v', '1', '-vf', "scale='min(1024,iw)':-2", path.join(maps.assetDir, name)]);
  return name;
}

async function importMap(file) {
  const { index, offsets } = MF.readIndex(file);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tonix-import-'));
  const mapId = hex(6);
  const added = [];
  let reused = 0, skipped = 0;
  try {
    const songs = Array.isArray(index.songs) ? index.songs.slice(0, 2000) : [];
    const trackFor = new Map(); // song key in the file -> track id in this library
    for (let i = 0; i < songs.length; i++) {
      const sg = songs[i] || {};
      const title = String(sg.title || '').slice(0, 300) || 'Imported song';
      send('import-progress', { done: i, total: songs.length, name: title });
      try {
        const ext = ff.AUDIO_EXT.includes(String(sg.ext)) ? sg.ext : 'mp3';
        const tmpMedia = await MF.extract(file, offsets, String(sg.media), path.join(tmp, `${i}.${ext}`));
        const { info } = await ff.probe(tmpMedia);
        if (!info.hasAudio) throw new Error('no sound');
        // Already in this library (same title, same length, same file size)? Use that one.
        const size = fs.statSync(tmpMedia).size;
        const same = lib.tracks.find((t) => t.title.toLowerCase() === title.toLowerCase() && Math.abs((t.duration || 0) - info.duration) < 0.6
          && fs.existsSync(t.mediaPath) && fs.statSync(t.mediaPath).size === size);
        if (same) { trackFor.set(sg.key, same.id); reused++; continue; }
        const id = lib.newId();
        let mediaPath = path.join(lib.mediaDir, `${id}.${ext}`);
        if (info.directPlay) { fs.copyFileSync(tmpMedia, mediaPath); } else { mediaPath = path.join(lib.mediaDir, `${id}.mp3`); await ff.toMp3(tmpMedia, mediaPath, { bitrate: lib.settings.bitrate, duration: info.duration }); }
        let cover = null;
        if (sg.cover && offsets.has(String(sg.cover))) {
          try {
            const c = await MF.extract(file, offsets, String(sg.cover), path.join(tmp, `${i}-cover`));
            await ff.imageToJpg(c, path.join(lib.coverDir, `${id}.jpg`));
            cover = `${id}.jpg`;
          } catch (_) { /* no cover, the song still comes in */ }
        }
        const str = (v) => String(v || '').slice(0, 500);
        const t = lib.add({ id, title, artist: str(sg.artist), album: str(sg.album), date: str(sg.date), label: str(sg.label), genre: str(sg.genre),
          srcPath: mediaPath, mediaPath, converted: true, duration: info.duration, cover, isVideo: false, imported: true });
        added.push(trackForUi(t));
        trackFor.set(sg.key, id);
      } catch (e) {
        skipped++;
        log('warn', `Map import: skipped "${title}" (${e.message})`);
      }
    }
    send('import-progress', { done: songs.length, total: songs.length, name: '' });
    const bgFiles = new Map();
    for (const b of Array.isArray(index.bgs) ? index.bgs.slice(0, 50) : []) {
      try { bgFiles.set(b.file, await importPicture(await MF.extract(file, offsets, String(b.f), path.join(tmp, `bg-${bgFiles.size}`)), mapId)); } catch (_) { /* skip */ }
    }
    let cover = null;
    if (index.mapCover && offsets.has(String(index.mapCover))) {
      try { cover = await importPicture(await MF.extract(file, offsets, String(index.mapCover), path.join(tmp, 'map-cover')), mapId); } catch (_) { /* skip */ }
    }
    const stopTrack = new Map();
    for (const s of Array.isArray(index.map.stops) ? index.map.stops : []) if (s && trackFor.has(s.trackId)) stopTrack.set(s.id, trackFor.get(s.trackId));
    const clean = MF.cleanMap(index.map, { id: mapId, stopTrack, bgFiles, cover, normFx: ff.normalizeFx, newId: () => hex(6) });
    // chances: the paths out of every song add up to 100 again (some paths may have been dropped)
    for (const s of clean.stops) Chance.fillTo100(clean.paths.filter((p) => p.from === s.id));
    const names = new Set(maps.list().map((x) => x.name));
    if (names.has(clean.name)) { let k = 2; const base = `${clean.name} (imported)`; clean.name = base; while (names.has(clean.name)) clean.name = `${base} ${k++}`; }
    maps.save(clean);
    lib.flush();
    log('ok', `Imported map "${clean.name}": ${added.length} new song(s), ${reused} already in your library, ${skipped} skipped.`);
    return { map: { id: clean.id, name: clean.name }, tracks: added, reused, skipped };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------- IPC ----------
function handle(name, fn) {
  ipcMain.handle(name, async (_e, ...args) => {
    try { return { ok: true, value: await fn(...args) }; } catch (e) {
      log('error', e.message);
      return { ok: false, error: e.message };
    }
  });
}

const IMAGE_FILTER = [{ name: 'Pictures', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }];
const MEDIA_FILTER = [
  { name: 'Audio and video', extensions: [...ff.AUDIO_EXT, ...ff.VIDEO_EXT] },
  { name: 'All files', extensions: ['*'] },
];

function registerIpc() {
  handle('state', () => state());
  handle('pick-files', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Upload music or video files', properties: ['openFile', 'multiSelections'], filters: MEDIA_FILTER });
    return r.canceled ? [] : r.filePaths;
  });
  handle('pick-folder', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Upload a whole folder', properties: ['openDirectory'] });
    return r.canceled ? [] : r.filePaths;
  });
  handle('pick-image', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose a cover picture', properties: ['openFile'], filters: IMAGE_FILTER });
    return r.canceled ? null : r.filePaths[0];
  });
  handle('image-preview', async (imagePath) => {
    const tmp = path.join(os.tmpdir(), `tonix-preview-${Date.now()}.jpg`);
    try {
      await ff.run(['-y', '-i', imagePath, '-frames:v', '1', '-vf', "scale='min(400,iw)':-2", '-q:v', '4', tmp]);
      return `data:image/jpeg;base64,${fs.readFileSync(tmp).toString('base64')}`;
    } finally { fs.rmSync(tmp, { force: true }); }
  });
  handle('pick-dir', async (current) => {
    const r = await dialog.showOpenDialog(win, { defaultPath: current || undefined, properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  handle('import', (paths) => importPaths(paths));
  handle('update-track', (id, patch) => { const t = lib.update(id, patch); return t && trackForUi(t); });
  handle('remove-tracks', (ids) => { lib.remove(ids); return true; });
  handle('set-cover', async (id, imagePath) => {
    const t = lib.byId(id);
    if (!t) throw new Error('Song not found');
    if (imagePath) await setCoverFromImage(t, imagePath);
    else { if (t.cover) fs.rmSync(lib.coverPath(t), { force: true }); t.cover = null; lib.save(); }
    return trackForUi(t);
  });
  handle('peaks', async (id) => {
    const t = lib.byId(id);
    if (!t) throw new Error('Song not found');
    const cache = path.join(lib.peakDir, `${id}.json`);
    if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
    const p = await ff.peaks(t.mediaPath);
    fs.writeFileSync(cache, JSON.stringify(p));
    return p;
  });
  // Studio pitch: a pitched copy of a song (or a part of it) to listen to. null = replaced by a newer request.
  handle('studio-render', async (id, opts = {}) => {
    const t = lib.byId(id);
    if (!t || !fs.existsSync(t.mediaPath)) throw new Error('Song file not found');
    try {
      const r = await studio.render({ file: t.mediaPath, duration: t.duration, pitch: opts.pitch, tempo: opts.tempo, natural: opts.natural !== false, start: opts.start, len: opts.len, group: opts.group });
      return { url: `${baseUrl}/studio/${r.name}`, start: r.start, end: r.len ? r.start + r.len : 0 };
    } catch (e) {
      if (e.cancelled) return null;
      throw e;
    }
  });
  handle('studio-cancel', (group) => { studio.cancel(group); return true; });
  handle('studio-size', () => studio.size());
  handle('studio-clear', () => { studio.clear(); return true; });
  handle('track-played', (id) => { const t = lib.played(id); return t ? { track: trackForUi(t), clock: lib.playClock } : null; });
  handle('track-mark', (ids, mark, n) => lib.mark(ids, mark, n).map(trackForUi));
  // ---- sound editor (Edit page)
  const editView = async (st) => {
    const buckets = Math.round(Math.min(30000, Math.max(1600, st.duration * 60)));
    return { ...st, url: `${baseUrl}/edit/${st.id}/${path.basename(st.file)}`, peaks: await ff.peaks(st.file, buckets), file: undefined };
  };
  handle('edit-open', async (id) => {
    const t = lib.byId(id);
    if (!t || !fs.existsSync(t.mediaPath)) throw new Error('Song file not found');
    log('info', `Edit: opening "${t.title}"`);
    return editView(await editor.open(id, t.mediaPath));
  });
  handle('edit-apply', async (sid, op) => editView(await editor.apply(sid, op)));
  handle('edit-undo', async (sid) => editView(await editor.undo(sid)));
  handle('edit-redo', async (sid) => editView(await editor.redo(sid)));
  handle('edit-close', (sid) => { editor.close(sid); return true; });
  handle('edit-save', async (sid, mode) => {
    const s = editor.get(sid);
    const t = lib.byId(s.trackId);
    if (!t) throw new Error('This song is not in the library any more.');
    const ext = path.extname(t.srcPath).slice(1).toLowerCase();
    const format = ff.FORMATS[ext] ? ext : 'mp3'; // videos and other types are saved as MP3
    const cover = ff.FORMATS[format].cover && lib.coverPath(t) && fs.existsSync(lib.coverPath(t)) ? lib.coverPath(t) : null;
    const encodeArgs = [...(cover ? ff.coverOutArgs(1) : []), '-map_metadata', '-1', ...ff.tagArgs(tagsOf(t), format), ...ff.FORMATS[format].codec(lib.settings.bitrate)];
    const r = await editor.save(sid, { orig: t.srcPath, mode, format, encodeArgs, extraInputs: cover ? [cover] : [], trash: (f) => shell.trashItem(f) });
    const { info } = await ff.probe(r.dest);
    const copyCover = (to) => { if (!t.cover) return null; const name = `${to}.jpg`; try { fs.copyFileSync(lib.coverPath(t), path.join(lib.coverDir, name)); return name; } catch (_) { return null; } };
    const fresh = (title) => {
      const id = lib.newId();
      return lib.add({ ...tagsOf(t), id, title, srcPath: r.dest, mediaPath: r.dest, converted: false, duration: info.duration, cover: copyCover(id), fx: { ...t.fx }, stars: t.stars || null, isVideo: false });
    };
    let changed = [], added = null;
    if (mode === 'both') added = fresh(`${t.title} New`);
    else if (mode === 'newname') {
      lib.setTrackFile(t.id, { srcPath: r.old, ...(t.converted ? {} : { mediaPath: r.old }), title: `${t.title} Old` });
      changed = [t];
      added = fresh(t.title.replace(/ Old$/, ''));
    } else { // replace: the song now plays the new file
      if (t.converted && t.mediaPath.startsWith(lib.mediaDir)) fs.rmSync(t.mediaPath, { force: true });
      lib.setTrackFile(t.id, { srcPath: r.dest, mediaPath: r.dest, converted: false, duration: info.duration });
      changed = [t];
    }
    log('ok', `Edit saved: ${r.dest}${r.old && r.old !== t.srcPath ? ` (original now: ${path.basename(r.old)})` : ''}${mode === 'replace' ? ' (original moved to the Recycle Bin)' : ''}`);
    return { dest: r.dest, changed: changed.map(trackForUi), added: added ? trackForUi(added) : null };
  });
  handle('playlist-create', (name, trackIds) => playlistForUi(lib.createPlaylist(name, trackIds)));
  handle('playlist-update', (id, patch) => { const p = lib.updatePlaylist(id, patch); if (!p) throw new Error('Playlist not found'); return playlistForUi(p); });
  handle('playlist-delete', (id) => lib.deletePlaylist(id));
  handle('playlist-cover', async (id, imagePath) => {
    const p = lib.playlistById(id);
    if (!p) throw new Error('Playlist not found');
    const v = (p.coverVersion || 0) + 1;
    const name = `pl-${p.id}-${v}.jpg`;
    await ff.imageToJpg(imagePath, path.join(lib.coverDir, name));
    if (p.cover) fs.rmSync(path.join(lib.coverDir, p.cover), { force: true });
    p.cover = name; p.coverVersion = v;
    lib.save();
    return playlistForUi(p);
  });
  handle('export-track', (id, opts) => exportTrack(id, opts));
  handle('file-exists', (dir, name, ext) => fs.existsSync(path.join(dir, `${safeName(name)}.${ext}`)));
  handle('export-many', (ids, opts) => exportMany(ids, opts));
  handle('convert-files', async (paths, outDir) => {
    const files = collectFiles(paths);
    const dir = outDir || exportDir();
    fs.mkdirSync(dir, { recursive: true });
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const { info } = await ff.probe(f);
        if (!info.hasAudio) throw new Error('no sound track');
        const dest = uniquePath(path.join(dir, `${safeName(path.basename(f, path.extname(f)))}.mp3`));
        await ff.toMp3(f, dest, { bitrate: lib.settings.bitrate, duration: info.duration, onProgress: (p) => send('export-progress', { p: (i + p) / files.length, label: path.basename(f) }) });
        log('ok', `Converted ${path.basename(f)} -> ${dest}`);
        results.push(dest);
      } catch (e) { log('error', `${path.basename(f)}: ${e.message}`); }
    }
    send('export-progress', { p: 1, label: '' });
    return results;
  });
  handle('maps-list', () => maps.list());
  handle('map-get', (id) => maps.get(id));
  handle('map-create', (name) => maps.create(name, lib.settings.mapBg));
  handle('map-trash', () => maps.trashList());
  handle('map-restore', (file) => { const m = maps.restore(file); return { id: m.id, name: m.name }; });
  handle('map-purge', (file) => maps.purge(file));
  // Songs whose file is gone from the PC (moved or deleted).
  handle('find-missing', () => lib.tracks.filter((t) => !fs.existsSync(t.mediaPath)).map((t) => ({ id: t.id, title: t.title, artist: t.artist, path: t.srcPath })));
  handle('about', async () => {
    let ffv = '';
    try { const { stdout } = await ff.run(['-version']); ffv = (stdout.toString().match(/ffmpeg version (\S+)/) || [])[1] || ''; } catch (_) { /* shown as unknown */ }
    return { version: app.getVersion(), ffmpeg: ffv, oldVersions: oldVersionsDir(), libraryDir: lib.dataDir };
  });
  handle('open-old-versions', () => { fs.mkdirSync(oldVersionsDir(), { recursive: true }); return shell.openPath(oldVersionsDir()); });
  handle('map-delete', (id) => maps.remove(id));
  handle('map-export', (id) => exportMap(id));
  handle('map-import', (file) => importMap(file));
  handle('pick-mapfile', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Open a Tonix map', properties: ['openFile'], filters: [{ name: 'Tonix map', extensions: ['tonixmap'] }] });
    return r.canceled ? null : r.filePaths[0];
  });
  handle('map-save', (m) => ({ updatedAt: maps.save(m).updatedAt }));
  // A picture for a map background: shrunk to at most 1024 px and kept as PNG (so see-through parts stay see-through).
  handle('map-bg-add', async (mapId, imagePath) => {
    if (!/^[a-f0-9]{12}$/.test(mapId)) throw new Error('Bad map id');
    const name = `${mapId}-${crypto.randomBytes(4).toString('hex')}.png`;
    const dest = path.join(maps.assetDir, name);
    await ff.run(['-y', '-i', imagePath, '-frames:v', '1', '-vf', "scale='min(1024,iw)':-2", dest]);
    const { stdout, stderr } = await ff.run(['-i', dest, '-f', 'null', '-']).catch((e) => ({ stderr: e.stderr || '' }));
    const m = (stderr || '').match(/, (\d+)x(\d+)/);
    return { file: name, w: m ? +m[1] : 512, h: m ? +m[2] : 512, label: path.basename(imagePath) };
  });
  handle('map-asset-url', () => `${baseUrl}/mapasset/`);
  handle('settings', (patch) => ({ ...lib.setSettings(patch), exportDir: exportDir() }));
  handle('show-item', (p) => { if (fs.existsSync(p) && fs.statSync(p).isDirectory()) shell.openPath(p); else shell.showItemInFolder(p); return true; });
  handle('open-path', (p) => shell.openPath(p));
  handle('ffmpeg-info', async () => {
    const { stdout } = await ff.run(['-version']);
    return { path: ff.resolveFfmpeg(), version: stdout.toString().split(/\r?\n/)[0] };
  });
}

// ---------- window ----------
async function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 880, minWidth: 1080, minHeight: 700,
    backgroundColor: '#000000', title: 'Tonix', show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.once('ready-to-show', () => win.show());
  // Links never open inside the app.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // Right-click menu: Cut / Copy / Paste in typing boxes, Copy on selected text.
  win.webContents.on('context-menu', (_e, p) => {
    const f = p.editFlags || {};
    let items = [];
    if (p.isEditable) {
      items = [
        { role: 'undo', label: 'Undo', enabled: f.canUndo }, { role: 'redo', label: 'Redo', enabled: f.canRedo }, { type: 'separator' },
        { role: 'cut', label: 'Cut', enabled: f.canCut }, { role: 'copy', label: 'Copy', enabled: f.canCopy },
        { role: 'paste', label: 'Paste', enabled: f.canPaste }, { role: 'delete', label: 'Delete', enabled: f.canDelete },
        { type: 'separator' }, { role: 'selectAll', label: 'Select all', enabled: f.canSelectAll },
      ];
    } else if (p.selectionText && p.selectionText.trim()) items = [{ role: 'copy', label: 'Copy' }];
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(baseUrl)) e.preventDefault(); });
  await win.loadURL(`${baseUrl}/app/index.html`);
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  lib = new Library(path.join(app.getPath('userData'), 'library'));
  maps = new MapStore(path.join(lib.dataDir, 'maps'));
  studio = new Studio(path.join(lib.dataDir, 'studio-pitch'), ff, log);
  editor = new Editor(path.join(lib.dataDir, 'editing'), ff);
  await startServer();
  registerIpc();
  await createWindow();
  log('info', `Tonix ready. ${lib.tracks.length} song(s) in library.`);
});

app.on('window-all-closed', () => {
  if (editor) for (const id of [...editor.sessions.keys()]) editor.close(id);
  if (studio) studio.stopAll();
  if (lib) lib.flush();
  if (server) server.close();
  app.quit();
});
