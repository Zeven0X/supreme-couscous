'use strict';
// Sound editor work area: cut / keep, undo / redo, and the 3 save modes on real files.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ff = require('../lib/ffmpeg');
const { Editor } = require('../lib/editor');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tonix-edit-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const dur = async (f) => (await ff.probe(f)).info.duration;

test('cut, keep, undo, redo', async () => {
  const src = path.join(tmp, 'Song.mp3');
  await ff.run(['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=10', '-c:a', 'libmp3lame', src]);
  const ed = new Editor(path.join(tmp, 'work'), ff);
  let st = await ed.open('t1', src);
  assert.ok(Math.abs(st.duration - 10) < 0.1);
  st = await ed.apply(st.id, { type: 'cut', a: 2, b: 5 });
  assert.ok(Math.abs(st.duration - 7) < 0.05, `cut: ${st.duration}`);
  st = await ed.apply(st.id, { type: 'keep', a: 1, b: 4 });
  assert.ok(Math.abs(st.duration - 3) < 0.05, `keep: ${st.duration}`);
  assert.deepStrictEqual(st.versions, ['Original', 'Cut out 3.00 s', 'Kept 3.00 s']);
  st = await ed.undo(st.id);
  assert.ok(Math.abs(st.duration - 7) < 0.05 && st.canRedo);
  st = await ed.redo(st.id);
  assert.ok(Math.abs(st.duration - 3) < 0.05 && !st.canRedo);
  st = await ed.undo(st.id); st = await ed.undo(st.id);
  st = await ed.apply(st.id, { type: 'cut', a: 0, b: 1 }); // a new change after undo drops the redo steps
  assert.deepStrictEqual(st.versions, ['Original', 'Cut out 1.00 s']);
  await assert.rejects(ed.apply(st.id, { type: 'cut', a: 0, b: 99 }), /whole song/);
  assert.ok(Math.abs((await dur(src)) - 10) < 0.1, 'the original file is untouched while editing');
});

test('save: keep both, new takes the name, replace (to the bin)', async () => {
  const ed = new Editor(path.join(tmp, 'work2'), ff);
  const make = async (name) => { const p = path.join(tmp, name); await ff.run(['-y', '-f', 'lavfi', '-i', 'sine=d=6', '-c:a', 'libmp3lame', p]); return p; };
  const enc = ['-c:a', 'libmp3lame', '-b:a', '192k'];

  const a = await make('Alpha.mp3');
  let st = await ed.open('a', a); st = await ed.apply(st.id, { type: 'cut', a: 0, b: 2 });
  let r = await ed.save(st.id, { orig: a, mode: 'both', format: 'mp3', encodeArgs: enc });
  assert.strictEqual(path.basename(r.dest), 'Alpha New.mp3');
  assert.ok(fs.existsSync(a) && Math.abs((await dur(r.dest)) - 4) < 0.1);

  const b = await make('Beta.mp3');
  st = await ed.open('b', b); st = await ed.apply(st.id, { type: 'cut', a: 0, b: 2 });
  r = await ed.save(st.id, { orig: b, mode: 'newname', format: 'mp3', encodeArgs: enc });
  assert.strictEqual(path.basename(r.dest), 'Beta.mp3');
  assert.strictEqual(path.basename(r.old), 'Beta Old.mp3');
  assert.ok(Math.abs((await dur(r.dest)) - 4) < 0.1 && Math.abs((await dur(r.old)) - 6) < 0.1);

  const c = await make('Gamma.mp3');
  const binned = [];
  st = await ed.open('c', c); st = await ed.apply(st.id, { type: 'cut', a: 0, b: 2 });
  r = await ed.save(st.id, { orig: c, mode: 'replace', format: 'mp3', encodeArgs: enc, trash: async (f) => { binned.push(f); fs.renameSync(f, path.join(tmp, 'bin-Gamma.mp3')); } });
  assert.deepStrictEqual(binned, [c], 'the original went to the bin');
  assert.strictEqual(r.dest, c);
  assert.ok(Math.abs((await dur(r.dest)) - 4) < 0.1);

  // if writing the new file fails, the original is not touched
  const d = await make('Delta.mp3');
  st = await ed.open('d', d);
  await assert.rejects(ed.save(st.id, { orig: d, mode: 'replace', format: 'mp3', encodeArgs: ['-c:a', 'nosuchcodec'], trash: async () => { throw new Error('should not be called'); } }));
  assert.ok(fs.existsSync(d));
});
