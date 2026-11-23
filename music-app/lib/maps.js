'use strict';
// Maps are saved one file per map in <library>/maps/<id>.json.
// A map: { id, name, cover, startId, stops: [{ id, trackId, x, y, fx }], paths: [], view, progress, updatedAt }
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class MapStore {
  constructor(dir) {
    this.dir = dir;
    this.assetDir = path.join(dir, 'assets'); // background pictures added by the user
    fs.mkdirSync(this.assetDir, { recursive: true });
  }

  file(id) {
    if (!/^[a-f0-9]{12}$/.test(id)) throw new Error('Bad map id');
    return path.join(this.dir, `${id}.json`);
  }

  list() {
    const out = [];
    for (const f of fs.readdirSync(this.dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const m = JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8'));
        out.push({ id: m.id, name: m.name, updatedAt: m.updatedAt || 0, stops: (m.stops || []).length, paths: (m.paths || []).length, cover: m.cover || null, bg: m.bg || null });
      } catch (_) { /* skip broken files, never delete them */ }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id) { return JSON.parse(fs.readFileSync(this.file(id), 'utf8')); }

  // "Delete" never destroys a map: its file is moved into the trash folder.
  remove(id) {
    const f = this.file(id);
    if (!fs.existsSync(f)) return null;
    const trash = path.join(this.dir, 'trash');
    fs.mkdirSync(trash, { recursive: true });
    const dest = path.join(trash, `${id}-${Date.now()}.json`);
    fs.renameSync(f, dest);
    return dest;
  }

  // Deleted maps waiting in the trash folder, newest first.
  trashList() {
    const dir = path.join(this.dir, 'trash');
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^([a-f0-9]{12})-(\d+)\.json$/);
      if (!m) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        out.push({ file: f, name: j.name || 'Untitled map', stops: (j.stops || []).length, deletedAt: +m[2], cover: j.cover || null, bg: j.bg || null });
      } catch (_) { /* skip broken files */ }
    }
    return out.sort((a, b) => b.deletedAt - a.deletedAt);
  }
  trashFile(file) {
    if (!/^[a-f0-9]{12}-\d+\.json$/.test(file)) throw new Error('Bad trash file');
    return path.join(this.dir, 'trash', file);
  }
  // Bring a map back. If a map with the same id exists again, it gets a new id.
  restore(file) {
    const src = this.trashFile(file);
    const m = JSON.parse(fs.readFileSync(src, 'utf8'));
    if (!/^[a-f0-9]{12}$/.test(m.id) || fs.existsSync(this.file(m.id))) m.id = crypto.randomBytes(6).toString('hex');
    const saved = this.save(m);
    fs.rmSync(src, { force: true });
    return saved;
  }
  // Delete forever (the user confirmed in the app).
  purge(file) { fs.rmSync(this.trashFile(file), { force: true }); return true; }

  create(name = 'My first map', bgId = 'dots') {
    const m = {
      id: crypto.randomBytes(6).toString('hex'), name, cover: null, startId: null,
      stops: [], paths: [], view: { x: 0, y: 0, zoom: 1 }, progress: null,
      bg: { kind: 'builtin', id: /^[a-z]{2,20}$/.test(bgId) ? bgId : 'dots' }, names: { mode: 'auto', color: '#ffffff' }, updatedAt: Date.now(),
    };
    this.save(m);
    return m;
  }

  save(m) {
    if (!m || typeof m !== 'object') throw new Error('Bad map');
    const clean = {
      id: m.id,
      name: String(m.name || 'Untitled map').slice(0, 200),
      cover: m.cover || null,
      startId: m.startId || null,
      stops: Array.isArray(m.stops) ? m.stops : [],
      paths: Array.isArray(m.paths) ? m.paths : [],
      view: m.view || { x: 0, y: 0, zoom: 1 },
      progress: m.progress || null,
      bg: m.bg || { kind: 'builtin', id: 'dots' },
      names: m.names || { mode: 'auto', color: '#ffffff' },
      customBgs: Array.isArray(m.customBgs) ? m.customBgs : [], // the user's own background pictures (go into the export)
      updatedAt: Date.now(),
    };
    const f = this.file(clean.id);
    fs.writeFileSync(`${f}.tmp`, JSON.stringify(clean));
    fs.renameSync(`${f}.tmp`, f);
    return clean;
  }
}

module.exports = { MapStore };
