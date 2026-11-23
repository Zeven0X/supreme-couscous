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
    await this.ff.run(['-y', '-i', src, '-map', '0:a:0', '-vn', '-ar', '44100', '-ac', '2', '-c:a', 'flac', '-compression_level', '0', v0]);
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

  // Make a new version with an ffmpeg filter graph from the current one. Later redo steps are dropped.
  async apply(id, op) {
    const s = this.get(id);
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
    } else if (op.type === 'graph') { // used by the later tabs (Trim, Effects, Loop…)
      graph = op.graph;
      label = op.label || 'Change';
    } else throw new Error(`Unknown change: ${op.type}`);
    const file = path.join(s.folder, `v${Date.now()}-${s.versions.length}.flac`);
    await this.ff.run(['-y', '-i', this.current(s), '-filter_complex', graph, '-map', '[out]', '-c:a', 'flac', '-compression_level', '0', file]);
    for (const v of s.versions.splice(s.at + 1)) rm(v.file); // a new change after Undo: the undone copies go
    s.versions.push({ file, label });
    s.at = s.versions.length - 1;
    return this.state(s);
  }
  undo(id) { const s = this.get(id); if (s.at > 0) s.at--; return this.state(s); }
  redo(id) { const s = this.get(id); if (s.at < s.versions.length - 1) s.at++; return this.state(s); }
  close(id) { const s = this.sessions.get(id); if (s) { rm(s.folder); this.sessions.delete(id); } }

  /**
   * Save the edited sound next to the original file (orig).
   *  mode 'both'    - keep both: new file "Name New.ext", the original is untouched
   *  mode 'newname' - the new file takes the name, the original is renamed "Name Old.ext"
   *  mode 'replace' - the new file takes the name, the original goes to the Recycle Bin (trash(file))
   * The new file is always written completely first; the original is only touched after that worked.
   * Returns { dest, old } (old = where the original is now, or null when it went to the bin).
   */
  async save(id, { orig, mode, format, encodeArgs = [], extraInputs = [], trash }) {
    const s = this.get(id);
    if (!orig || !fs.existsSync(orig)) throw new Error('The original file is not on your PC any more, so Tonix does not know where to save. Use "Save song" in the Library instead.');
    const dir = path.dirname(orig), ext = path.extname(orig), base = path.basename(orig, ext);
    const tmp = path.join(s.folder, `save-${Date.now()}.${format}`);
    await this.ff.run(['-y', '-i', this.current(s), ...extraInputs.flatMap((f) => ['-i', f]), '-map', '0:a:0', ...encodeArgs, tmp]);
    const move = (from, to) => { try { fs.renameSync(from, to); } catch (e) { if (e.code !== 'EXDEV') throw e; fs.copyFileSync(from, to); fs.rmSync(from, { force: true }); } };
    if (mode === 'both') {
      const dest = uniquePath(path.join(dir, `${base} New.${format}`));
      move(tmp, dest);
      return { dest, old: orig };
    }
    if (mode === 'newname') {
      const old = uniquePath(path.join(dir, `${base} Old${ext}`));
      fs.renameSync(orig, old); // if Windows refuses (file in use), nothing has changed yet
      const dest = uniquePath(path.join(dir, `${base}.${format}`));
      move(tmp, dest);
      return { dest, old };
    }
    if (mode === 'replace') {
      if (typeof trash !== 'function') throw new Error('Cannot reach the Recycle Bin.');
      await trash(orig);
      const dest = uniquePath(path.join(dir, `${base}.${format}`));
      move(tmp, dest);
      return { dest, old: null };
    }
    throw new Error(`Unknown save mode: ${mode}`);
  }
}

module.exports = { Editor, FADE };
