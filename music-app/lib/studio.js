'use strict';
// Studio pitch: makes pitched copies of songs for listening, with the same tool used for saved files.
// A whole-song copy is kept on disk (reused next time). A short "part" from where the music is playing
// is made first, so a pitch change can be heard within about a second.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function rm(f) { try { fs.rmSync(f, { force: true }); } catch (_) { /* in use: next time */ } }
const MAX_BYTES = 2 * 1024 ** 3; // keep at most about 2 GB of whole-song copies, oldest removed first
const PARTS_MAX = 300 * 1024 ** 2; // short parts: at most about 300 MB during a session

class Studio {
  constructor(dir, ff, log = () => {}) {
    this.dir = dir;
    this.partDir = path.join(dir, 'parts');
    this.ff = ff;
    this.log = log;
    this.jobs = new Map(); // key -> promise
    this.groups = new Map(); // group -> { key, proc }
    this.procs = new Set(); // every running ffmpeg job (stopped when Tonix closes)
    fs.mkdirSync(this.partDir, { recursive: true });
    for (const f of fs.readdirSync(this.partDir)) rm(path.join(this.partDir, f));
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.tmp.flac')) rm(path.join(dir, f));
  }

  key(file, { pitch, natural, start = 0, len = 0 }) {
    const st = fs.statSync(file);
    return crypto.createHash('sha1')
      .update([file, st.size, st.mtimeMs, pitch.toFixed(6), natural ? 1 : 0, start.toFixed(2), len.toFixed(2)].join('|'))
      .digest('hex');
  }

  fileFor(name) {
    if (!/^[a-f0-9]{40}\.flac$/.test(name)) return null;
    const a = path.join(this.dir, name);
    if (fs.existsSync(a)) return a;
    const b = path.join(this.partDir, name);
    return fs.existsSync(b) ? b : null;
  }

  // Stop the unfinished job of a group (a newer request in that group replaces it).
  cancel(group, exceptKey) {
    const g = this.groups.get(group);
    if (g && g.key !== exceptKey && g.proc) { g.cancelled = true; try { g.proc.kill(); } catch (_) { /* gone */ } }
    if (g && g.key !== exceptKey) this.groups.delete(group);
  }

  // Returns { name, start, len } once the copy is ready. len 0 = the whole song.
  render({ file, duration, pitch, natural = true, start = 0, len = 0, group }) {
    pitch = Math.min(2, Math.max(0.5, +pitch || 1));
    start = Math.max(0, +start || 0);
    len = Math.max(0, +len || 0);
    if (len && duration && start + len >= duration - 0.5) len = 0; // part reaches the end: the rest of the song
    const whole = !start && !len;
    const key = this.key(file, { pitch, natural, start, len });
    const name = `${key}.flac`;
    const dest = path.join(whole ? this.dir : this.partDir, name);
    const result = { name, start, len };
    if (group) this.cancel(group, key);
    if (fs.existsSync(dest)) { if (whole) this.touch(dest); return Promise.resolve(result); }
    if (this.jobs.has(key)) return this.jobs.get(key);
    const tmp = dest.replace(/\.flac$/, '.tmp.flac');
    const g = group ? { key, proc: null } : null;
    if (g) this.groups.set(group, g);
    const t0 = Date.now();
    const job = this.ff.renderPitched({ src: file, dest: tmp, pitch, natural, start, len, duration, onSpawn: (p) => { if (g) g.proc = p; this.procs.add(p); p.on('close', () => this.procs.delete(p)); } })
      .then(() => {
        fs.renameSync(tmp, dest);
        this.log('info', `Studio pitch ${Math.round(pitch * 1000) / 10}%${whole ? '' : ` (part from ${start.toFixed(1)} s)`} ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        try { if (whole) this.prune(); else this.prune(PARTS_MAX, this.partDir); } catch (_) { /* tidying can wait */ }
        return result;
      })
      .catch((e) => {
        fs.rmSync(tmp, { force: true });
        if (g && g.cancelled) { const c = new Error('cancelled'); c.cancelled = true; throw c; }
        throw e;
      })
      .finally(() => {
        this.jobs.delete(key);
        if (g && this.groups.get(group) === g) this.groups.delete(group);
      });
    this.jobs.set(key, job);
    return job;
  }

  touch(f) { try { const now = new Date(); fs.utimesSync(f, now, now); } catch (_) { /* ignore */ } }

  stopAll() { for (const p of this.procs) { try { p.kill(); } catch (_) { /* gone */ } } }

  prune(max = MAX_BYTES, dir = this.dir) {
    const files = fs.readdirSync(dir).filter((f) => /^[a-f0-9]{40}\.flac$/.test(f))
      .map((f) => { const p = path.join(dir, f); const st = fs.statSync(p); return { p, size: st.size, t: st.mtimeMs }; })
      .sort((a, b) => b.t - a.t);
    let total = 0;
    for (const f of files) { total += f.size; if (total > max) rm(f.p); }
  }

  // Files in use right now (Windows locks them) are skipped.
  clear() {
    for (const d of [this.dir, this.partDir]) for (const f of fs.readdirSync(d)) if (f.endsWith('.flac')) rm(path.join(d, f));
  }

  size() {
    let n = 0;
    for (const d of [this.dir, this.partDir]) for (const f of fs.readdirSync(d)) if (f.endsWith('.flac')) n += fs.statSync(path.join(d, f)).size;
    return n;
  }
}

module.exports = { Studio, MAX_BYTES };
