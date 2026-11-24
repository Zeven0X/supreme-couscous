'use strict';
// The sound editor's work area. Every change makes a new working copy (version) of the song in its own
// folder, so Undo / Redo just step between copies and the user's file is never touched while editing.
// Saving writes the result next to the original file, in one of 3 ways (see save()).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FADE = 0.006; // seconds: a tiny fade at every cut, so a cut never clicks

function rm(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* in use: next start */ } }
function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const { dir, name, ext } = path.parse(p);
  for (let i = 2; ; i++) { const c = path.join(dir, `${name} (${i})${ext}`); if (!fs.existsSync(c)) return c; }
}
const fix = (n) => Math.max(0, n).toFixed(4);

class Editor {
  constructor(dir, ff) {
    this.dir = dir;
    this.ff = ff;
    this.sessions = new Map();
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) rm(path.join(dir, f)); // copies from last time are not needed any more
  }

  async open(trackId, src) {
    const id = crypto.randomBytes(5).toString('hex');
    const folder = path.join(this.dir, id);
    fs.mkdirSync(folder, { recursive: true });
    const v0 = path.join(folder, 'v0.flac'); // a clean copy of the sound only, the same for every file type
    try {
      await this.ff.run(['-y', '-i', src, '-map', '0:a:0', '-vn', '-ar', '44100', '-ac', '2', '-c:a', 'flac', '-compression_level', '0', v0]);
    } catch (e) { rm(folder); throw e; }
    const s = { id, trackId, src, folder, versions: [{ file: v0, label: 'Original' }], at: 0 };
    this.sessions.set(id, s);
    return this.state(s);
  }
  get(id) { const s = this.sessions.get(id); if (!s) throw new Error('This edit was closed. Open the song again.'); return s; }
  current(s) { return s.versions[s.at].file; }
  async state(s) {
    const { info } = await this.ff.probe(this.current(s));
    return { id: s.id, file: this.current(s), duration: info.duration, version: s.at, versions: s.versions.map((v) => v.label), canUndo: s.at > 0, canRedo: s.at < s.versions.length - 1 };
  }

  // The ffmpeg graph for a change (op), from the current version of session s.
  async graphFor(s, op) {
    const { info } = await this.ff.probe(this.current(s));
    const dur = info.duration;
    let graph, label;
    if (op.type === 'cut') { // remove a..b
      const a = Math.max(0, Math.min(op.a, op.b)), b = Math.min(dur, Math.max(op.a, op.b));
      if (b - a < 0.01) throw new Error('Select a longer part first.');
      if (a < 0.01 && b > dur - 0.01) throw new Error('That would cut out the whole song.');
      const parts = [];
      if (a > 0.01) parts.push(`[0:a]atrim=0:${fix(a)},asetpts=N/SR/TB,afade=t=out:st=${fix(a - FADE)}:d=${FADE}[x]`);
      if (b < dur - 0.01) parts.push(`[0:a]atrim=start=${fix(b)},asetpts=N/SR/TB,afade=t=in:st=0:d=${FADE}[y]`);
      graph = parts.length === 2 ? `${parts.join(';')};[x][y]concat=n=2:v=0:a=1[out]` : parts[0].replace(/\[[xy]\]$/, '[out]');
      label = `Cut out ${(b - a).toFixed(2)} s`;
    } else if (op.type === 'keep') { // keep only a..b
      const a = Math.max(0, Math.min(op.a, op.b)), b = Math.min(dur, Math.max(op.a, op.b));
      if (b - a < 0.05) throw new Error('Select a longer part first.');
      graph = `[0:a]atrim=${fix(a)}:${fix(b)},asetpts=N/SR/TB,afade=t=in:st=0:d=${FADE},afade=t=out:st=${fix(b - a - FADE)}:d=${FADE}[out]`;
      label = `Kept ${(b - a).toFixed(2)} s`;
    } else if (op.type === 'graph') { // used by the tabs (Trim, Split, Effects, Loop, Layers)
      graph = op.graph;
      label = op.label || 'Change';
    } else throw new Error(`Unknown change: ${op.type}`);
    return { graph, label, inputs: (op.inputs || []).filter((f) => typeof f === 'string') };
  }
  async render(s, op, file) {
    const { graph, label, inputs } = await this.graphFor(s, op);
    for (const f of inputs) if (!fs.existsSync(f)) throw new Error(`A sound file is missing: ${path.basename(f)}`);
    await this.ff.run(['-y', '-i', this.current(s), ...inputs.flatMap((f) => ['-i', f]), '-filter_complex', graph, '-map', '[out]', '-ar', '44100', '-c:a', 'flac', '-compression_level', '0', file]);
    return label;
  }
  // Hear a change before making it: the result plays, but it is not a version (Undo is not needed).
  async preview(id, op) {
    const s = this.get(id);
    const file = path.join(s.folder, `v${Date.now()}-preview.flac`);
    for (const f of fs.readdirSync(s.folder)) if (f.endsWith('-preview.flac')) rm(path.join(s.folder, f));
    await this.render(s, op, file);
    const { info } = await this.ff.probe(file);
    return { file, duration: info.duration };
  }
  // Make a new version from the current one. Later redo steps are dropped.
  // Changes, undo, redo and saving of one edit wait for each other (two quick clicks can't lose a change).
  queue(s, job) {
    const run = (s.busy || Promise.resolve()).catch(() => {}).then(() => { if (s.closed) throw new Error('This edit was closed. Open the song again.'); return job(); });
    s.busy = run;
    return run;
  }
  apply(id, op) {
    const s = this.get(id);
    return this.queue(s, async () => {
      const file = path.join(s.folder, `v${Date.now()}-${s.versions.length}.flac`);
      const label = await this.render(s, op, file);
      for (const v of s.versions.splice(s.at + 1)) rm(v.file); // a new change after Undo: the undone copies go
      s.versions.push({ file, label });
      s.at = s.versions.length - 1;
      return this.state(s);
    });
  }
  undo(id) { const s = this.get(id); return this.queue(s, () => { if (s.at > 0) s.at--; return this.state(s); }); }
  redo(id) { const s = this.get(id); return this.queue(s, () => { if (s.at < s.versions.length - 1) s.at++; return this.state(s); }); }
  close(id) {
    const s = this.sessions.get(id);
    if (!s) return;
    s.closed = true;
    this.sessions.delete(id);
    (s.busy || Promise.resolve()).catch(() => {}).then(() => rm(s.folder)); // after a running change has finished
  }

  /**
   * Save the edited sound next to the original file (orig).
   *  mode 'both'    - keep both: new file "Name New.ext", the original is untouched
   *  mode 'newname' - the new file takes the name, the original is renamed "Name Old.ext"
   *  mode 'replace' - the new file takes the name, the original goes to the Recycle Bin (trash(file))
   * The new file is always written completely first; the original is only touched after that worked.
   * Returns { dest, old } (old = where the original is now, or null when it went to the bin).
   */
  // internal: the song's file is Tonix's own copy (e.g. from an imported map). Then nothing is renamed or binned:
  // the new file goes into saveDir with the song's title, and the song (or a new one) points at it.
  save(id, opts) { const s = this.get(id); return this.queue(s, () => this.saveNow(s, opts)); }
  async saveNow(s, { orig, mode, format, encodeArgs = [], extraInputs = [], trash, internal = false, saveDir, title }) {
    if (!['both', 'newname', 'replace'].includes(mode)) throw new Error(`Unknown save mode: ${mode}`);
    if (!internal && (!orig || !fs.existsSync(orig))) throw new Error('The original file is not on your PC any more, so Tonix does not know where to save. Use "Save song" in the Library instead.');
    const dir = internal ? saveDir : path.dirname(orig), ext = internal ? `.${format}` : path.extname(orig);
    const base = internal ? String(title || 'Edited song') : path.basename(orig, ext);
    fs.mkdirSync(dir, { recursive: true });
    // 1. the whole new file is written next to where it will live (same drive), under a temporary name
    const tmp = path.join(dir, `.${base}.tonix-saving-${Date.now()}.${format}`);
    try {
      await this.ff.run(['-y', '-i', this.current(s), ...extraInputs.flatMap((f) => ['-i', f]), '-map', '0:a:0', ...encodeArgs, tmp]);
    } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
    const finish = (to) => { fs.renameSync(tmp, to); return to; };
    try {
      if (internal) return { dest: finish(uniquePath(path.join(dir, `${base}${mode === 'both' ? ' New' : ''}.${format}`))), old: orig };
      if (mode === 'both') return { dest: finish(uniquePath(path.join(dir, `${base} New.${format}`))), old: orig };
      if (mode === 'newname') {
        const old = uniquePath(path.join(dir, `${base} Old${ext}`));
        fs.renameSync(orig, old); // 2. only now is the original touched; if Windows refuses, nothing has changed
        try { return { dest: finish(uniquePath(path.join(dir, `${base}.${format}`))), old }; } catch (e) { fs.renameSync(old, orig); throw e; } // put it back
      }
      if (typeof trash !== 'function') throw new Error('Cannot reach the Recycle Bin.');
      await trash(orig);
      return { dest: finish(uniquePath(path.join(dir, `${base}.${format}`))), old: null };
    } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
  }
}

module.exports = { Editor, FADE };
