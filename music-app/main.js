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
let maps = null;

app.setName('Tune Forge');
if (process.env.TUNEFORGE_DATA) app.setPath('userData', process.env.TUNEFORGE_DATA);

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
  if (process.env.TUNEFORGE_DEBUG) console.log(`[${level}] ${msg}`);
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
  return n.slice(0, 150);
}
function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const { dir, name, ext } = path.parse(p);
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
  const d = lib.settings.exportDir || path.join(app.getPath('music'), 'Tune Forge Exports');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function trackForUi(t) {
  return { ...t, coverUrl: t.cover ? `${baseUrl}/cover/${t.id}?v=${t.coverVersion || 0}` : null, mediaUrl: `${baseUrl}/media/${t.id}` };
}
function state() {
  return { tracks: lib.tracks.map(trackForUi), settings: { ...lib.settings, exportDir: exportDir() }, baseUrl, libraryDir: lib.dataDir, limits: ff.LIMITS, defaults: ff.DEFAULT_FX };
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
  let skipped = 0, failed = 0;
  if (!files.length) { log('warn', 'No supported audio or video files found.'); return { added, skipped, failed }; }
  log('info', `Importing ${files.length} file(s)...`);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = path.basename(file);
    send('import-progress', { done: i, total: files.length, name });
    if (lib.bySource(file)) { skipped++; continue; }
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
      const t = lib.add({ id, ...tags, srcPath: file, mediaPath, converted, duration: info.duration, cover, isVideo: info.isVideo });
      added.push(trackForUi(t));
      log('ok', `Added "${t.title}"${converted ? ' (converted to MP3)' : ''}`);
    } catch (e) {
      failed++;
      log('error', `${name}: ${e.message}`);
    }
  }
  send('import-progress', { done: files.length, total: files.length, name: '' });
  lib.flush();
  log('info', `Import finished: ${added.length} added, ${skipped} already in library, ${failed} failed.`);
  return { added, skipped, failed };
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
  if (!lib.settings.askWhereToSave) return uniquePath(path.join(exportDir(), safeName(defaultName)));
  const r = await dialog.showOpenDialog(win, { title: 'Choose where to put the album folder', defaultPath: exportDir(), properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : uniquePath(path.join(r.filePaths[0], safeName(defaultName)));
}

function tagsOf(t) { return { title: t.title, artist: t.artist, album: t.album, date: t.date, genre: t.genre, label: t.label }; }

async function exportTrack(id, opts = {}) {
  const t = lib.byId(id);
  if (!t) throw new Error('Song not found');
  if (opts.tags) lib.update(id, opts.tags);
  if (opts.coverImage) await setCoverFromImage(t, opts.coverImage);
  const format = opts.format === 'wav' ? 'wav' : 'mp3';
  const dest = await chooseDest(t.artist ? `${t.artist} - ${t.title}` : t.title, format);
  if (!dest) return { canceled: true };
  log('info', `Saving "${t.title}" (speed ${t.fx.speed}%, pitch ${t.fx.pitch}%, volume ${t.fx.volume}%, fade in ${t.fx.fadeIn}s, fade out ${t.fx.fadeOut}s)...`);
  const started = Date.now();
  await ff.exportOne({
    src: t.mediaPath, dest, fx: t.fx, duration: t.duration, tags: tagsOf(t), coverPath: lib.coverPath(t),
    format, bitrate: lib.settings.bitrate,
    onProgress: (p) => send('export-progress', { p, label: t.title }),
  });
  send('export-progress', { p: 1, label: t.title });
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
    tmpCover = path.join(os.tmpdir(), `tuneforge-cover-${Date.now()}.jpg`);
    await ff.imageToJpg(opts.coverImage, tmpCover);
    coverPath = tmpCover;
  } else if (opts.coverTrackId) coverPath = lib.coverPath(lib.byId(opts.coverTrackId));
  const albumTags = { album: title, albumArtist: opts.artist, date: opts.date, genre: opts.genre, label: opts.label };
  try {
    if (opts.mode === 'single') {
      const dest = await chooseDest(opts.artist ? `${opts.artist} - ${title}` : title, 'mp3');
      if (!dest) return { canceled: true };
      log('info', `Joining ${tracks.length} songs into one MP3...`);
      await ff.exportCombined({
        items: tracks.map((t) => ({ src: t.mediaPath, fx: t.fx, duration: t.duration, title: t.title })),
        dest, tags: { ...albumTags, title, artist: opts.artist }, coverPath, bitrate: lib.settings.bitrate, tmpDir: os.tmpdir(),
        onProgress: (p) => send('export-progress', { p, label: title }),
      });
      send('export-progress', { p: 1, label: title });
      log('ok', `Saved ${dest}`);
      return { path: dest };
    }
    const dir = await chooseDir(opts.artist ? `${opts.artist} - ${title}` : title);
    if (!dir) return { canceled: true };
    fs.mkdirSync(dir, { recursive: true });
    log('info', `Saving album "${title}" (${tracks.length} songs) to ${dir}...`);
    const pad = String(tracks.length).length < 2 ? 2 : String(tracks.length).length;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const dest = path.join(dir, `${String(i + 1).padStart(pad, '0')} - ${safeName(t.title)}.mp3`);
      await ff.exportOne({
        src: t.mediaPath, dest, fx: t.fx, duration: t.duration, bitrate: lib.settings.bitrate,
        tags: { ...tagsOf(t), ...Object.fromEntries(Object.entries(albumTags).filter(([, v]) => v)), track: `${i + 1}/${tracks.length}` },
        coverPath: coverPath || lib.coverPath(t),
        onProgress: (p) => send('export-progress', { p: (i + p) / tracks.length, label: `${title}: ${t.title}` }),
      });
    }
    if (coverPath) fs.copyFileSync(coverPath, path.join(dir, 'cover.jpg'));
    send('export-progress', { p: 1, label: title });
    log('ok', `Saved album to ${dir}`);
    return { path: dir };
  } finally {
    if (tmpCover) fs.rmSync(tmpCover, { force: true });
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
    const tmp = path.join(os.tmpdir(), `tuneforge-preview-${Date.now()}.jpg`);
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
  handle('export-track', (id, opts) => exportTrack(id, opts));
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
  handle('map-create', (name) => maps.create(name));
  handle('map-delete', (id) => maps.remove(id));
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
    backgroundColor: '#000000', title: 'Tune Forge', show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.once('ready-to-show', () => win.show());
  // Links never open inside the app.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(baseUrl)) e.preventDefault(); });
  await win.loadURL(`${baseUrl}/app/index.html`);
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  lib = new Library(path.join(app.getPath('userData'), 'library'));
  maps = new MapStore(path.join(lib.dataDir, 'maps'));
  await startServer();
  registerIpc();
  await createWindow();
  log('info', `Tune Forge ready. ${lib.tracks.length} song(s) in library.`);
});

app.on('window-all-closed', () => {
  if (lib) lib.flush();
  if (server) server.close();
  app.quit();
});
