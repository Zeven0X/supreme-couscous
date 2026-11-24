'use strict';
// The library is one JSON file (songs + settings) plus folders for converted
// media, covers and cached waveforms.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_FX, normalizeFx } = require('./ffmpeg');

const DEFAULT_SETTINGS = {
  exportDir: '', // filled in by main.js
  askWhereToSave: false,
  bitrate: 320,
  zoom: 150,
  // General
  openOn: 'last', // 'library' | 'map' | 'last'
  lastView: 'library',
  continueOnOpen: false,
  confirmRemove: true,
  // Look
  theme: 'midnight',
  textSize: 'normal', // 'small' | 'normal' | 'big'
  blur: 70, // 0-100 %
  animations: true,
  // Playing
  whenEnds: 'next', // 'next' | 'repeat' | 'stop'
  shuffle: false,
  libraryBlend: 0, // seconds of crossfade between library songs (0 = off)
  volumeLimit: 500,
  rememberMaster: true,
  // Saving
  format: 'mp3',
  albumFormat: 'mp3', // saving many songs remembers its own type
  smartShuffle: {}, // smart playlists (genre + stars): shuffle on / off, by playlist
  albumMode: 'album', // saving many songs: 'album' (one file per song) or 'single' (one big file)
  fileNames: 'artist-title', // 'artist-title' | 'title' | 'title-artist'
  // Library
  videoBadge: true,
  // Map
  mapJoin: { type: 'crossfade', secs: 3 },
  mapBg: 'dots',
  pathLabels: 'name', // 'chance' | 'name' (name + chance) | 'hidden'
  mapFollow: true,
  mapDot: true,
  // Keyboard: only the shortcuts the user changed
  keys: {},
};

class Library {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'library.json');
    this.mediaDir = path.join(dataDir, 'media');
    this.coverDir = path.join(dataDir, 'covers');
    this.peakDir = path.join(dataDir, 'waveforms');
    for (const d of [dataDir, this.mediaDir, this.coverDir, this.peakDir]) fs.mkdirSync(d, { recursive: true });
    this.data = { tracks: [], settings: { ...DEFAULT_SETTINGS }, playlists: [], playClock: 0 };
    if (fs.existsSync(this.file)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.data.tracks = Array.isArray(loaded.tracks) ? loaded.tracks : [];
        this.data.settings = { ...DEFAULT_SETTINGS, ...(loaded.settings || {}) };
        this.data.playlists = Array.isArray(loaded.playlists) ? loaded.playlists : [];
        this.data.playClock = Number.isFinite(loaded.playClock) ? loaded.playClock : 0;
      } catch (e) {
        // Keep the broken file so nothing is lost, start fresh.
        fs.copyFileSync(this.file, `${this.file}.broken-${Date.now()}`);
      }
    }
    this._timer = null;
  }

  newId() { return crypto.randomBytes(6).toString('hex'); }
  get tracks() { return this.data.tracks; }
  get settings() { return this.data.settings; }
  byId(id) { return this.data.tracks.find((t) => t.id === id); }
  bySource(p) { const n = path.resolve(p).toLowerCase(); return this.data.tracks.find((t) => path.resolve(t.srcPath).toLowerCase() === n); }

  add(track) {
    const t = { fx: { ...DEFAULT_FX }, addedAt: Date.now(), cover: null, ...track };
    this.data.tracks.push(t);
    this.save();
    return t;
  }

  update(id, patch) {
    const t = this.byId(id);
    if (!t) return null;
    const allowed = ['title', 'artist', 'album', 'date', 'label', 'genre', 'track'];
    for (const k of allowed) if (k in patch) t[k] = String(patch[k] ?? '').slice(0, 500);
    if ('stars' in patch) { const n = Math.round(Number(patch.stars)); t.stars = n >= 1 && n <= 10 ? n : null; } // 1-10, null = no stars
    if (patch.fx) t.fx = normalizeFx({ ...t.fx, ...patch.fx });
    this.save();
    return t;
  }

  remove(ids) {
    const set = new Set(ids);
    for (const t of this.data.tracks.filter((x) => set.has(x.id))) {
      // Only delete files the app created itself, never the user's originals.
      if (t.converted && t.mediaPath && t.mediaPath.startsWith(this.mediaDir)) fs.rmSync(t.mediaPath, { force: true });
      if (t.cover) fs.rmSync(path.join(this.coverDir, t.cover), { force: true });
      fs.rmSync(path.join(this.peakDir, `${t.id}.json`), { force: true });
    }
    this.data.tracks = this.data.tracks.filter((t) => !set.has(t.id));
    for (const pl of this.data.playlists) pl.trackIds = pl.trackIds.filter((id) => !set.has(id)); // gone from playlists too
    this.save();
  }

  // Same loudness: set many songs' Volume at once (one save). volumes = { id: percent }
  setVolumes(volumes) {
    const out = [];
    for (const [id, v] of Object.entries(volumes || {})) {
      const t = this.byId(id);
      if (!t || !Number.isFinite(+v)) continue;
      t.fx = normalizeFx({ ...t.fx, volume: +v });
      out.push(t);
    }
    this.save();
    return out;
  }

  // ---- smart shuffle: the play clock counts every song heard; each song remembers when it played.
  get playClock() { return this.data.playClock; }
  played(id) {
    const t = this.byId(id);
    if (!t) return null;
    this.data.playClock += 1;
    t.stamps = [...(t.stamps || []), this.data.playClock].slice(-60);
    t.plays = (t.plays || 0) + 1;
    this.save();
    return t;
  }
  // mark: 'black' (plays much less), 'fav' (plays more) or null (normal). Ends by itself after
  // (n songs x 4) plays, n = the songs in the playlist or library where it was marked. One save for all.
  mark(ids, mark, n = this.data.tracks.length) {
    const out = [];
    for (const id of [].concat(ids)) {
      const t = this.byId(id);
      if (!t) continue;
      t.mark = mark === 'black' || mark === 'fav' ? mark : null;
      t.markAt = this.data.playClock;
      t.markUntil = t.mark ? this.data.playClock + Math.max(4, Math.round(n) * 4) : null;
      out.push(t);
    }
    this.save();
    return out;
  }

  // ---- playlists: { id, name, trackIds (in order), cover, coverVersion, shuffle, createdAt }
  get playlists() { return this.data.playlists; }
  playlistById(id) { return this.data.playlists.find((p) => p.id === id); }
  cleanIds(ids) {
    const have = new Set(this.data.tracks.map((t) => t.id));
    return [...new Set((Array.isArray(ids) ? ids : []).filter((id) => have.has(id)))]; // each song once
  }
  createPlaylist(name, trackIds = []) {
    const p = { id: this.newId(), name: String(name || '').trim().slice(0, 120) || 'New playlist', trackIds: this.cleanIds(trackIds), cover: null, coverVersion: 0, shuffle: false, createdAt: Date.now() };
    this.data.playlists.push(p);
    this.save();
    return p;
  }
  updatePlaylist(id, patch = {}) {
    const p = this.playlistById(id);
    if (!p) return null;
    if ('name' in patch) p.name = String(patch.name || '').trim().slice(0, 120) || p.name;
    if ('trackIds' in patch) p.trackIds = this.cleanIds(patch.trackIds);
    if ('shuffle' in patch) p.shuffle = !!patch.shuffle;
    this.save();
    return p;
  }
  deletePlaylist(id) {
    const p = this.playlistById(id);
    if (!p) return false;
    if (p.cover) fs.rmSync(path.join(this.coverDir, p.cover), { force: true });
    this.data.playlists = this.data.playlists.filter((x) => x !== p);
    this.save();
    return true;
  }

  setSettings(patch) {
    Object.assign(this.data.settings, patch);
    this.save();
    return this.data.settings;
  }

  // The sound editor saved a new file for this song: point the song at it (only these fields).
  setTrackFile(id, fields) {
    const t = this.byId(id);
    if (!t) return null;
    for (const k of ['srcPath', 'mediaPath', 'converted', 'duration', 'title']) if (k in fields) t[k] = fields[k];
    fs.rmSync(path.join(this.peakDir, `${t.id}.json`), { force: true }); // the waveform is made again
    this.save();
    return t;
  }
  coverPath(t) { return t && t.cover ? path.join(this.coverDir, t.cover) : null; }

  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 300);
  }
  flush() {
    clearTimeout(this._timer);
    const tmp = `${this.file}.tmp`;
    for (let attempt = 1; attempt <= 5; attempt++) { // antivirus / indexer can lock the file for a moment on Windows
      try {
        fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
        fs.renameSync(tmp, this.file);
        this.saveError = null;
        return true;
      } catch (e) {
        this.saveError = e;
        const until = Date.now() + 60 * attempt; while (Date.now() < until) { /* short wait before trying again */ }
      }
    }
    console.error(`Tonix: could not save the library (${this.saveError.message}); trying again with the next change.`);
    this._timer = setTimeout(() => this.flush(), 2000);
    return false;
  }
}

module.exports = { Library, DEFAULT_SETTINGS };
