'use strict';
// The studio pitch copies used for listening: made once, reused, replaced, cleaned up.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ff = require('../lib/ffmpeg');
const { Studio } = require('../lib/studio');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tonix-studio-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('whole copy is made once and reused; parts start where asked', async () => {
  const src = path.join(tmp, 'song.wav');
  await ff.run(['-y', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=44100:duration=8', src]);
  const st = new Studio(path.join(tmp, 'cache'), ff);
  const a = await st.render({ file: src, duration: 8, pitch: 1.2, natural: true, group: 'whole' });
  assert.strictEqual(a.len, 0);
  const file = st.fileFor(a.name);
  assert.ok(file && fs.existsSync(file));
  const t = fs.statSync(file).mtimeMs;
  const b = await st.render({ file: src, duration: 8, pitch: 1.2, natural: true, group: 'whole' });
  assert.strictEqual(b.name, a.name, 'same settings reuse the same copy');
  assert.ok(fs.statSync(file).mtimeMs >= t);
  const other = await st.render({ file: src, duration: 8, pitch: 1.2, natural: false });
  assert.notStrictEqual(other.name, a.name, 'Natural voice off is a different copy');

  const p = await st.render({ file: src, duration: 8, pitch: 0.9, start: 2, len: 3, group: 'part' });
  assert.deepStrictEqual([p.start, p.len], [2, 3]);
  const tail = await st.render({ file: src, duration: 8, pitch: 0.9, start: 6, len: 3, group: 'part' });
  assert.strictEqual(tail.len, 0, 'a part that reaches the end runs to the end of the song');
  assert.ok(st.size() > 0);
  assert.strictEqual(st.fileFor('../../etc/passwd'), null, 'only its own files are served');
});

test('a newer request in the same group stops the old one', async () => {
  const src = path.join(tmp, 'long.wav');
  await ff.run(['-y', '-f', 'lavfi', '-i', 'anoisesrc=d=120:a=0.2', '-ar', '44100', src]);
  const st = new Studio(path.join(tmp, 'cache2'), ff);
  const first = st.render({ file: src, duration: 120, pitch: 1.5, group: 'whole' });
  await new Promise((r) => setTimeout(r, 150));
  const second = st.render({ file: src, duration: 120, pitch: 1.5, start: 0, len: 2, group: 'whole' });
  await assert.rejects(first, (e) => e.cancelled === true);
  const r = await second;
  assert.strictEqual(r.len, 2);
  assert.ok(!fs.readdirSync(path.join(tmp, 'cache2')).some((f) => f.endsWith('.tmp.flac')), 'no half-made files left');
});

test('old copies are removed when the cache is too big; a new start clears parts', () => {
  const dir = path.join(tmp, 'cache3');
  const st = new Studio(dir, ff);
  for (let i = 0; i < 3; i++) {
    const f = path.join(dir, `${String(i).repeat(40)}.flac`);
    fs.writeFileSync(f, Buffer.alloc(1000));
    fs.utimesSync(f, new Date(1000 * (i + 1)), new Date(1000 * (i + 1)));
  }
  fs.writeFileSync(path.join(st.partDir, `${'a'.repeat(40)}.flac`), 'x');
  st.prune(2500);
  const left = fs.readdirSync(dir).filter((f) => f.endsWith('.flac')).sort();
  assert.deepStrictEqual(left, [`${'1'.repeat(40)}.flac`, `${'2'.repeat(40)}.flac`], 'the oldest one went');
  new Studio(dir, ff);
  assert.deepStrictEqual(fs.readdirSync(st.partDir), []);
});
