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
        out.push({ id: m.id, name: m.name, updatedAt: m.updatedAt || 0, stops: (m.stops || []).length });
      } catch (_) { /* skip broken files, never delete them */ }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id) { return JSON.parse(fs.readFileSync(this.file(id), 'utf8')); }

  create(name = 'My first map') {
    const m = {
      id: crypto.randomBytes(6).toString('hex'), name, cover: null, startId: null,
      stops: [], paths: [], view: { x: 0, y: 0, zoom: 1 }, progress: null,
      bg: { kind: 'builtin', id: 'dots' }, names: { mode: 'auto', color: '#ffffff' }, updatedAt: Date.now(),
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
