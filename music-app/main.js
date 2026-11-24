'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const os = require('os');
const crypto = require('crypto');
const ff = require('./lib/ffmpeg');
const { Library } = require('./lib/library');
const { MapStore } = require('./lib/maps');
const { Studio } = require('./lib/studio');
const { Editor } = require('./lib/editor');
const T = require('./lib/audiotools');
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
      let start = range[1] ? parseInt(range[1], 10) : Math.max(0, st.size - parseInt(range[2], 10));
      let end = range[1] && range[2] ? parseInt(range[2], 10) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
      end = Math.min(end, st.size - 1);
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      pipeline(fs.createReadStream(file, { start, end }), res, () => {}); // closes the file on aborts and errors
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
      pipeline(fs.createReadStream(file), res, () => {});
    }
  });
}

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      let parts;
      try { parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); } catch (_) { res.writeHead(400); res.end(); return; }
      if (parts[0] !== TOKEN) { res.writeHead(403); res.end(); return; }
      if (parts[1] === 'app') {
        const file = path.normalize(path.join(RENDERER, ...parts.slice(2)));
        if (!file.startsWith(RENDERER)) { res.writeHead(403); res.end(); return; }
        return serveFile(req, res, file);
      }
      const t = lib.byId(parts[2]);
      if (parts[1] === 'media' && t) return serveFile(req, res, t.mediaPath);
      if (parts[1] === 'mapasset' && /^[a-f0-9]{12}-[a-f0-9]{8}\.png$/.test(parts[2] || '')) return serveFile(req, res, path.join(maps.assetDir, parts[2]));
      if (parts[1] === 'editsrc' && lib) { // built-in sounds and voice recordings for the Edit page's live player
        const dir = { sound: 'sounds', rec: 'recordings', stretch: 'stretch' }[parts[2]] ? path.join(lib.dataDir, { sound: 'sounds', rec: 'recordings', stretch: 'stretch' }[parts[2]]) : null;
        if (dir && /^[\w-]+\.flac$/.test(parts[3] || '')) return serveFile(req, res, path.join(dir, parts[3]));
      }
      if (parts[1] === 'edit' && editor && /^[a-f0-9]{10}$/.test(parts[2] || '') && /^v[\w-]+\.flac$/.test(parts[3] || '')) return serveFile(req, res, path.join(editor.dir, parts[2], parts[3]));
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
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(n)) n = `_${n}`;
  return Array.from(n).slice(0, 150).join('').replace(/[. ]+$/, '') || fallback; // whole characters; no dot / space at the end
}
// A free name: "Song.mp3" -> "Song (2).mp3". Folders have no extension ("Vol. 2" stays "Vol. 2 (2)").
const reservedNames = new Set(); // names just handed out (the file may not be written yet)
function uniquePath(p, isDir = false) {
  const free = (c) => !fs.existsSync(c) && !reservedNames.has(c.toLowerCase());
  const take = (c) => { reservedNames.add(c.toLowerCase()); setTimeout(() => reservedNames.delete(c.toLowerCase()), 10 * 60 * 1000); return c; };
  if (free(p)) return take(p);
  const { dir, name, ext } = isDir ? { dir: path.dirname(p), name: path.basename(p), ext: '' } : path.parse(p);
  for (let i = 2; ; i++) { const c = path.join(dir, `${name} (${i})${ext}`); if (free(c)) return take(c); }
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
  const fallback = path.join(app.getPath('music'), 'Tonix Exports');
  const d = lib.settings.exportDir || fallback;
  try { fs.mkdirSync(d, { recursive: true }); return d; } catch (e) {
    log('warn', `The save folder ${d} can't be used (${e.code || e.message}), so Tonix saves to ${fallback}.`);
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}
// Is this file inside Tonix's own library folder (converted / imported copies), not one of the user's files?
function isInternal(p) { return !!p && path.resolve(p).toLowerCase().startsWith(path.resolve(lib.mediaDir).toLowerCase() + path.sep); }
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
        try {
          await ff.toMp3(file, mediaPath, {
            bitrate: lib.settings.bitrate, duration: info.duration,
            onProgress: (p) => send('import-progress', { done: i + p, total: files.length, name }),
          });
        } catch (e) { fs.rmSync(mediaPath, { force: true }); throw e; } // no half-made copy left behind
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
  } else dest = await chooseDest(opts.askName || fileName(t), format); // Windows asks; the typed name is suggested
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
  const remember = () => lib.setSettings({ albumFormat: format, bitrate, albumMode: ['single', 'separate'].includes(opts.mode) ? opts.mode : 'album', ...(opts.dir ? { exportDir: opts.dir } : {}) });
  try {
    if (opts.mode === 'separate') {
      let dir = opts.dir;
      if (!dir) {
        if (!lib.settings.askWhereToSave) dir = exportDir();
        else { const r = await dialog.showOpenDialog(win, { title: 'Choose where to save the songs', defaultPath: exportDir(), properties: ['openDirectory', 'createDirectory'] }); if (r.canceled) return { canceled: true }; dir = r.filePaths[0]; }
      }
      fs.mkdirSync(dir, { recursive: true });
      log('info', `Saving ${tracks.length} songs separately to ${dir}...`);
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        const dest = uniquePath(path.join(dir, `${safeName(fileName(t))}.${format}`));
        await ff.exportOne({
          src: t.mediaPath, dest, fx: t.fx, duration: t.duration, bitrate, format, tags: tagsOf(t), coverPath: lib.coverPath(t),
          onProgress: (p) => send('export-progress', { p: (i + p) / tracks.length, label: `${t.title} (${i + 1} of ${tracks.length})` }),
        });
      }
      send('export-progress', { p: 1, label: 'Saved separately' });
      remember();
      log('ok', `Saved ${tracks.length} songs to ${dir}`);
      return { path: dir };
    }
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
  await ff.run(['-y', ...ff.imageInput(src), '-frames:v', '1', '-update', '1', '-vf', "scale='min(1024,iw)':-2", path.join(maps.assetDir, name)]);
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
      send('export-progress', { p: 1, label: '' }); // a job that failed must not leave the progress bar stuck
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
      await ff.run(['-y', ...ff.imageInput(imagePath), '-frames:v', '1', '-update', '1', '-vf', "scale='min(400,iw)':-2", '-q:v', '4', tmp]);
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
    if (fs.existsSync(cache)) { try { return JSON.parse(fs.readFileSync(cache, 'utf8')); } catch (_) { fs.rmSync(cache, { force: true }); } }
    const p = await ff.peaks(t.mediaPath);
    fs.writeFileSync(`${cache}.tmp`, JSON.stringify(p));
    fs.renameSync(`${cache}.tmp`, cache);
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
  // Same loudness (Library / playlist / map): how loud each song is on average (measured once, remembered
  // until the file changes), then the Volume that brings every song to the group's average.
  handle('loudness-even', async (ids) => {
    const list = [...new Set(ids)].map((id) => lib.byId(id)).filter((t) => t && fs.existsSync(t.mediaPath));
    const louds = [];
    for (let i = 0; i < list.length; i++) {
      const t = list[i], st = fs.statSync(t.mediaPath), key = `${st.size}|${st.mtimeMs}`;
      send('export-progress', { p: i / list.length, label: `Listening to "${t.title}" (${i + 1} of ${list.length})` });
      if (t.lufsKey !== key || !Number.isFinite(t.lufs)) { t.lufs = await T.loudness(ff, t.mediaPath, 0, (t.duration || 3600) + 1); t.lufsKey = key; }
      louds.push(t.lufs);
    }
    send('export-progress', { p: 1, label: 'Same loudness' });
    lib.save();
    const vols = T.sameLoudness(louds);
    const volumes = {}, silent = [];
    list.forEach((t, i) => { if (louds[i] > -60) volumes[t.id] = vols[i]; else silent.push(t.title); });
    log('ok', `Same loudness: ${Object.keys(volumes).length} songs${silent.length ? `, ${silent.length} silent song(s) left alone` : ''}`);
    return { volumes, silent, missing: ids.length - list.length };
  });
  handle('tracks-set-volumes', (volumes) => lib.setVolumes(volumes).map(trackForUi));
  handle('track-played', (id) => { const t = lib.played(id); return t ? { track: trackForUi(t), clock: lib.playClock } : null; });
  handle('track-mark', (ids, mark, n) => lib.mark(ids, mark, Number.isFinite(+n) && +n > 0 ? +n : lib.tracks.length).map(trackForUi));
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
  handle('edit-apply', async (sid, op) => editView(await editor.apply(sid, await resolveOp(sid, op))));
  handle('edit-undo', async (sid) => editView(await editor.undo(sid)));
  handle('edit-redo', async (sid) => editView(await editor.redo(sid)));
  handle('edit-close', (sid) => { editor.close(sid); return true; });

  // ---- the editor's tabs. The page sends what it wants (op); the files and recipes are worked out here.
  const soundDir = () => { const d = path.join(lib.dataDir, 'sounds'); fs.mkdirSync(d, { recursive: true }); return d; };
  const recDir = () => { const d = path.join(lib.dataDir, 'recordings'); fs.mkdirSync(d, { recursive: true }); return d; };
  async function sourceFile(src = {}) { // a layer / piece: a library song, a built-in sound, or a recording of your voice
    if (src.kind === 'track') { const t = lib.byId(src.id); if (!t || !fs.existsSync(t.mediaPath)) throw new Error('That song is not on your PC any more.'); return { file: t.mediaPath, name: t.title }; }
    if (src.kind === 'sound') {
      if (!Object.hasOwn(T.SOUNDS, src.key)) throw new Error('Unknown sound');
      const f = path.join(soundDir(), `${src.key}.flac`);
      if (!fs.existsSync(f)) await T.makeSound(ff, src.key, f);
      return { file: f, name: T.SOUNDS[src.key].name };
    }
    if (src.kind === 'rec' && /^voice-\d+\.flac$/.test(src.name || '')) return { file: path.join(recDir(), src.name), name: 'Your voice' };
    throw new Error('Unknown sound source');
  }
  const bpmCache = new Map();
  async function bpmOf(file) {
    const st = fs.statSync(file), k = `${file}|${st.mtimeMs}`;
    if (!bpmCache.has(k)) {
      bpmCache.set(k, T.beats(await T.decodeMono(ff, file, 22050, 0, 900), 22050)); // the whole song (up to 15 min)
      if (bpmCache.size > 40) bpmCache.delete(bpmCache.keys().next().value);
    }
    return bpmCache.get(k);
  }
  async function resolveOp(sid, op) {
    const s = editor.get(sid), cur = editor.current(s);
    const dur = (await ff.probe(cur)).info.duration;
    const t = (x) => Math.min(dur, Math.max(0, +x)); // a time inside the song
    for (const k of ['a', 'b', 'P', 'head', 'tail']) if (k in op && !Number.isFinite(+op[k])) throw new Error('A time is not a number.');
    switch (op.type) {
      case 'cut': case 'keep': return op;
      case 'trim': return { type: 'keep', a: t(op.head), b: t(op.tail), label: 'Trimmed silent start / end' };
      case 'effects': {
        const graph = T.effectChain(op.fx || {});
        if (!graph) throw new Error('Switch on at least one effect.');
        return { type: 'graph', graph, label: `Effects: ${Object.keys(op.fx).join(', ')}` };
      }
      case 'loop': {
        const a = t(op.a), b = t(op.b), times = Math.round(+op.times);
        if (!(b - a >= 0.05)) throw new Error('Select a longer part to loop.');
        if (!(times >= 1 && times <= 200)) throw new Error('Choose how many times (1 to 200).');
        return { type: 'graph', graph: T.loopGraph(a, b, times, dur), label: `Loop ${(b - a).toFixed(2)} s × ${times}` };
      }
      case 'mix': case 'layers': {
        const inputs = [], layers = [];
        op.layers = Array.isArray(op.layers) ? op.layers : [];
        const song = op.layers.some((L) => L.matchBeat) ? await bpmOf(cur) : null;
        for (const L of op.layers) {
          const { file } = await sourceFile(L.src);
          inputs.push(file);
          const tempo = L.matchBeat && song && song.bpm ? T.tempoMatch(song.bpm, (await bpmOf(file)).bpm) : 1;
          layers.push({ ...L, tempo });
        }
        const sg = op.song || {};
        const songFx = sg.fx && typeof sg.fx === 'object' ? sg.fx : {};
        if (op.type === 'layers' && !layers.length) throw new Error('Add a layer first.');
        const opts = { songVolume: Number.isFinite(+sg.volume) ? +sg.volume : (op.songVolume ?? 100), songPan: +sg.pan || 0, songMute: !!sg.mute, songSolo: !!sg.solo, songFx };
        const what = [Object.keys(songFx).length ? `effects: ${Object.keys(songFx).join(', ')}` : '', layers.length ? `${layers.filter((L) => !L.mute).length} layer(s)` : ''].filter(Boolean).join(' + ');
        return { type: 'graph', graph: T.mixGraph(layers, dur, opts), inputs, label: `Mixed (${what || 'volume'})` };
      }
      case 'connect': {
        let P = t(op.P), a = Math.max(0, +op.a), b = Math.max(0, +op.b);
        const other = op.src && op.src.kind === 'track' && op.src.id !== s.trackId;
        const srcFile = other ? (await sourceFile(op.src)).file : cur;
        if (op.snap) { // land the cuts on the beat
          P = T.snapToBeat(P, (await bpmOf(cur)).times);
          const bt = (await bpmOf(srcFile)).times;
          a = T.snapToBeat(a, bt); b = T.snapToBeat(b, bt);
        }
        const srcDur = other ? (await ff.probe(srcFile)).info.duration : dur;
        b = Math.min(b, srcDur);
        if (b - a < 0.2) throw new Error('The piece is too short.');
        const c = T.connectGraph({ P, a, b, src: other ? 1 : 0, after: op.after, blend: op.blend, dur });
        return { type: 'graph', graph: c.graph, inputs: other ? [srcFile] : [], label: `Smart connect (${(b - a).toFixed(1)} s piece at ${P.toFixed(1)} s)` };
      }
      default: throw new Error(`Unknown change: ${op.type}`);
    }
  }
  handle('edit-do', async (sid, op) => editView(await editor.apply(sid, await resolveOp(sid, op))));
  handle('edit-preview', async (sid, op) => {
    const p = await editor.preview(sid, await resolveOp(sid, op));
    return { url: `${baseUrl}/edit/${sid}/${path.basename(p.file)}`, duration: p.duration };
  });
  handle('edit-trim-find', async (sid, level) => {
    const s = editor.get(sid), cur = editor.current(s);
    const dur = (await ff.probe(cur)).info.duration;
    const db = Object.hasOwn(T.TRIM_LEVELS, level) ? T.TRIM_LEVELS[level] : -45;
    return { ...T.trimPoints(await T.silences(ff, cur, db, 0.08), dur), duration: dur, version: s.at };
  });
  handle('edit-split-find', async (sid, gap = 1.2) => {
    const s = editor.get(sid), cur = editor.current(s);
    const dur = (await ff.probe(cur)).info.duration;
    return T.splitPoints(await T.silences(ff, cur, -42, Math.max(0.3, +gap || 1.2)), dur);
  });
  handle('edit-loudness', async (sid, ranges) => {
    const cur = editor.current(editor.get(sid));
    const louds = [];
    for (const [a, b] of ranges) louds.push(await T.loudness(ff, cur, a, b));
    return T.sameLoudness(louds);
  });
  handle('edit-smartloop', async (sid, a, b) => {
    const cur = editor.current(editor.get(sid));
    if (!(Number.isFinite(+a) && Number.isFinite(+b) && b - a >= 0.05)) throw new Error('Select a longer part to loop.');
    const from = Math.max(0, a - 0.5);
    const x = await T.decodeMono(ff, cur, 22050, from, b - from + 1);
    const r = T.smartLoop(x, 22050, a - from, b - from);
    return { a: r.a + from, b: r.b + from, score: r.score };
  });
  handle('edit-sounds', () => Object.entries(T.SOUNDS).map(([key, s]) => ({ key, name: s.name })));
  handle('edit-source', async (src) => { // a layer's length, little waveform and web address (for the live player)
    const { file, name } = await sourceFile(src);
    const url = src.kind === 'track' ? `${baseUrl}/media/${src.id}` : `${baseUrl}/editsrc/${src.kind === 'sound' ? 'sound' : 'rec'}/${path.basename(file)}`;
    return { name, url, duration: (await ff.probe(file)).info.duration, peaks: await ff.peaks(file, 2000) };
  });
  // Match beat for the live player: a copy of the layer at the song's tempo (studio quality, same pitch)
  const stretchDir = () => { const d = path.join(lib.dataDir, 'stretch'); fs.mkdirSync(d, { recursive: true }); return d; };
  handle('edit-matchbeat', async (sid, src) => {
    const cur = editor.current(editor.get(sid));
    const { file } = await sourceFile(src);
    const song = await bpmOf(cur), layer = await bpmOf(file);
    const tempo = T.tempoMatch(song.bpm, layer.bpm);
    if (Math.abs(tempo - 1) < 1e-4) return { tempo: 1, url: null, songBpm: song.bpm, layerBpm: layer.bpm };
    const st = fs.statSync(file);
    const name = `${crypto.createHash('sha1').update(`${file}|${st.size}|${st.mtimeMs}|${tempo}`).digest('hex').slice(0, 20)}.flac`;
    const dest = path.join(stretchDir(), name);
    if (!fs.existsSync(dest)) await ff.run(['-y', '-i', file, '-map', '0:a:0', '-af', `aresample=44100,rubberband=tempo=${tempo.toFixed(5)}:pitchq=quality:channels=together`, '-ac', '2', '-c:a', 'flac', dest]);
    return { tempo, url: `${baseUrl}/editsrc/stretch/${name}`, songBpm: song.bpm, layerBpm: layer.bpm };
  });
  // tempo + beat times of the song being edited (bar | beat clock, snapping)
  handle('edit-bpm', async (sid) => { const b = await bpmOf(editor.current(editor.get(sid))); return { bpm: b.bpm, times: b.times }; });
  handle('edit-recording', async (bytes) => {
    // the browser's recording has no length inside, so it becomes a normal FLAC file right away
    const stamp = Date.now(), raw = path.join(recDir(), `voice-${stamp}.webm`), name = `voice-${stamp}.flac`;
    fs.writeFileSync(raw, Buffer.from(bytes));
    try { await ff.run(['-y', '-i', raw, '-map', '0:a:0', '-ar', '44100', '-ac', '2', '-c:a', 'flac', path.join(recDir(), name)]); } finally { fs.rmSync(raw, { force: true }); }
    return { kind: 'rec', name };
  });
  // Split: every part becomes its own song file next to the original, with its own speed / pitch / volume.
  handle('edit-split-save', async (sid, parts) => {
    const s = editor.get(sid), cur = editor.current(s);
    const t = lib.byId(s.trackId);
    if (!t) throw new Error('This song is not in the library any more.');
    const dir = !isInternal(t.srcPath) && fs.existsSync(path.dirname(t.srcPath)) ? path.dirname(t.srcPath) : exportDir(); // never into Tonix's own folder
    const ext = path.extname(t.srcPath).slice(1).toLowerCase();
    const format = ff.FORMATS[ext] ? ext : 'mp3';
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const title = String(p.name || `${t.title} - Part ${i + 1}`).trim().slice(0, 300) || `${t.title} - Part ${i + 1}`;
      const name = safeName(title); // the file name; the title keeps every character
      const dest = uniquePath(path.join(dir, `${name}.${format}`));
      const { filter } = ff.buildFilter(p.fx || {}, p.b - p.a);
      const tags = { ...tagsOf(t), title, track: `${i + 1}/${parts.length}` };
      await ff.run(['-y', '-ss', p.a.toFixed(4), '-to', p.b.toFixed(4), '-i', cur, '-map', '0:a:0', '-af', filter, '-map_metadata', '-1', ...ff.tagArgs(tags, format), ...ff.FORMATS[format].codec(lib.settings.bitrate), dest],
        { duration: p.b - p.a, onProgress: (x) => send('export-progress', { p: (i + x) / parts.length, label: name }) });
      const info = (await ff.probe(dest)).info;
      const id = lib.newId();
      let cover = null;
      if (t.cover) { try { fs.copyFileSync(lib.coverPath(t), path.join(lib.coverDir, `${id}.jpg`)); cover = `${id}.jpg`; } catch (_) { /* no picture */ } }
      out.push(trackForUi(lib.add({ ...tagsOf(t), id, title, track: `${i + 1}/${parts.length}`, srcPath: dest, mediaPath: dest, converted: false, duration: info.duration, cover, isVideo: false })));
    }
    send('export-progress', { p: 1, label: 'Split' });
    log('ok', `Split "${t.title}" into ${out.length} songs in ${dir}`);
    return { dir, added: out };
  });
  handle('edit-save', (sid, mode) => saveSession(sid, mode));
  async function saveSession(sid, mode) {
    const s = editor.get(sid);
    const t = lib.byId(s.trackId);
    if (!t) throw new Error('This song is not in the library any more.');
    const ext = path.extname(t.srcPath).slice(1).toLowerCase();
    const format = ff.FORMATS[ext] ? ext : 'mp3'; // videos and other types are saved as MP3
    const cover = ff.FORMATS[format].cover && lib.coverPath(t) && fs.existsSync(lib.coverPath(t)) ? lib.coverPath(t) : null;
    const encodeArgs = [...(cover ? ff.coverOutArgs(1) : []), '-map_metadata', '-1', ...ff.tagArgs(tagsOf(t), format), ...ff.FORMATS[format].codec(lib.settings.bitrate)];
    // a song whose file is Tonix's own copy (imported map, …): never rename / bin it; save into the save folder
    const internal = isInternal(t.srcPath);
    const r = await editor.save(sid, { orig: t.srcPath, mode, format, encodeArgs, extraInputs: cover ? [cover] : [], trash: (f) => shell.trashItem(f), internal, saveDir: internal ? exportDir() : null, title: safeName(t.title) });
    const { info } = await ff.probe(r.dest);
    const copyCover = (to) => { if (!t.cover) return null; const name = `${to}.jpg`; try { fs.copyFileSync(lib.coverPath(t), path.join(lib.coverDir, name)); return name; } catch (_) { return null; } };
    const fresh = (title) => {
      const id = lib.newId();
      return lib.add({ ...tagsOf(t), id, title, srcPath: r.dest, mediaPath: r.dest, converted: false, duration: info.duration, cover: copyCover(id), fx: { ...t.fx }, stars: t.stars || null, isVideo: false });
    };
    let changed = [], added = null;
    if (mode === 'both') added = fresh(`${t.title} New`);
    else if (mode === 'newname') {
      // the old song keeps playing its original sound (its file was renamed, or it is Tonix's own copy)
      lib.setTrackFile(t.id, { ...(internal ? {} : { srcPath: r.old }), ...(t.converted || internal ? {} : { mediaPath: r.old }), title: `${t.title} Old` });
      changed = [t];
      added = fresh(t.title.replace(/ Old$/, ''));
    } else { // replace: the song now plays the new file; Tonix's own old copy goes (never the new file)
      const oldCopy = t.mediaPath;
      lib.setTrackFile(t.id, { srcPath: r.dest, mediaPath: r.dest, converted: false, duration: info.duration });
      if (isInternal(oldCopy) && path.resolve(oldCopy) !== path.resolve(r.dest)) fs.rmSync(oldCopy, { force: true });
      changed = [t];
    }
    log('ok', `Edit saved: ${r.dest}${r.old && r.old !== t.srcPath ? ` (original now: ${path.basename(r.old)})` : ''}${mode === 'replace' ? ' (original moved to the Recycle Bin)' : ''}`);
    return { dest: r.dest, changed: changed.map(trackForUi), added: added ? trackForUi(added) : null };
  }
  // The same edit on many songs: each song is opened, trimmed and / or given effects, saved in one of the
  // 3 ways, and closed. A song that can't be done is skipped with the reason; the others go on.
  handle('batch-edit', async (ids, opts = {}) => {
    const mode = ['both', 'newname', 'replace'].includes(opts.mode) ? opts.mode : 'both';
    const fxGraph = opts.fx && Object.keys(opts.fx).length ? T.effectChain(opts.fx) : null;
    const level = opts.trim && Object.hasOwn(T.TRIM_LEVELS, opts.trim) ? T.TRIM_LEVELS[opts.trim] : null;
    if (level === null && !fxGraph) throw new Error('Choose at least one change: Trim or an effect.');
    const done = [], skipped = [], changed = [], added = [];
    const list = ids.map((id) => lib.byId(id)).filter(Boolean);
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      send('export-progress', { p: i / list.length, label: `Editing "${t.title}" (${i + 1} of ${list.length})` });
      let st = null;
      try {
        if (!fs.existsSync(t.mediaPath)) throw new Error('the file is not on your PC any more');
        st = await editor.open(t.id, t.mediaPath);
        if (level !== null) {
          const tp = T.trimPoints(await T.silences(ff, st.file, level, 0.08), st.duration);
          if (!tp.empty && (tp.head > 0.02 || tp.tail < st.duration - 0.02)) st = await editor.apply(st.id, { type: 'keep', a: tp.head, b: tp.tail, label: 'Trimmed' });
        }
        if (fxGraph) st = await editor.apply(st.id, { type: 'graph', graph: fxGraph, label: 'Effects' });
        if (st.version === 0) { skipped.push({ title: t.title, why: 'nothing to change (no silent start or end)' }); continue; }
        const r = await saveSession(st.id, mode);
        changed.push(...r.changed); if (r.added) added.push(r.added);
        done.push({ title: t.title, dest: r.dest });
      } catch (e) {
        skipped.push({ title: t.title, why: e.message });
        log('warn', `Edit many: "${t.title}" skipped: ${e.message}`);
      } finally { if (st) editor.close(st.id); }
    }
    send('export-progress', { p: 1, label: 'Edit many songs' });
    log('ok', `Edit many: ${done.length} saved, ${skipped.length} skipped`);
    return { done, skipped, changed, added };
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
  handle('open-path', (p) => { // folders only (the library folder, the save folder, …): never runs a program
    if (!p || !fs.existsSync(p) || !fs.statSync(p).isDirectory()) throw new Error('That folder is not there any more.');
    return shell.openPath(p);
  });
  handle('ffmpeg-info', async () => {
    const { stdout } = await ff.run(['-version']);
    return { path: ff.resolveFfmpeg(), version: stdout.toString().split(/\r?\n/)[0] };
  });
}

// ---------- window ----------
async function createWindow() {
  // Windows log-off / shut-down: save at once
  try { require('electron').powerMonitor.on('shutdown', shutdown); } catch (_) { /* not on every system */ }
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

if (!app.requestSingleInstanceLock()) app.quit(); // Tonix is already open: show that one instead (below)
app.on('second-instance', () => { if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(async () => {
  try {
    Menu.setApplicationMenu(null);
    lib = new Library(path.join(app.getPath('userData'), 'library'));
    maps = new MapStore(path.join(lib.dataDir, 'maps'));
    studio = new Studio(path.join(lib.dataDir, 'studio-pitch'), ff, log);
    editor = new Editor(path.join(lib.dataDir, 'editing'), ff);
    fs.rmSync(path.join(lib.dataDir, 'stretch'), { recursive: true, force: true }); // match-beat copies: made again when needed
    await startServer();
    registerIpc();
    await createWindow();
    try { require('electron').powerMonitor.on('shutdown', shutdown); } catch (_) { /* Windows log-off: save at once */ }
    log('info', `Tonix ready. ${lib.tracks.length} song(s) in library.`);
  } catch (e) { // never a running Tonix without a window
    dialog.showErrorBox('Tonix could not start', `${e.message}\n\nYour songs and settings are not lost. Try starting Tonix again; if this keeps happening, send this message to the developer.`);
    app.exit(1);
  }
});
// 21 + 9: save the library and stop ffmpeg jobs on every way of closing (also Windows log-off)
function shutdown() {
  try { if (lib) lib.flush(); } catch (_) { /* logged in flush */ }
  ff.stopAll();
}
app.on('before-quit', shutdown);

app.on('window-all-closed', () => {
  if (studio) studio.stopAll();
  shutdown();
  if (editor) for (const id of [...editor.sessions.keys()]) editor.close(id);
  if (server) server.close();
  app.quit();
});
