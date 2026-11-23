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
    this.data = { tracks: [], settings: { ...DEFAULT_SETTINGS } };
    if (fs.existsSync(this.file)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.data.tracks = Array.isArray(loaded.tracks) ? loaded.tracks : [];
        this.data.settings = { ...DEFAULT_SETTINGS, ...(loaded.settings || {}) };
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
    const allowed = ['title', 'artist', 'album', 'date', 'label', 'genre'];
    for (const k of allowed) if (k in patch) t[k] = String(patch[k] ?? '').slice(0, 500);
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
    this.save();
  }

  setSettings(patch) {
    Object.assign(this.data.settings, patch);
    this.save();
    return this.data.settings;
  }

  coverPath(t) { return t && t.cover ? path.join(this.coverDir, t.cover) : null; }

  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 300);
  }
  flush() {
    clearTimeout(this._timer);
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Library, DEFAULT_SETTINGS };
