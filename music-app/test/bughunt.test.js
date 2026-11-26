'use strict';
// Checks for bugs found in the big bug hunt (2026-11-26), so they stay fixed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ff = require('../lib/ffmpeg');
const T = require('../lib/audiotools');
const Chance = require('../renderer/chance');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tonix-hunt-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const tone = async (name, secs = 3, extra = []) => { const f = path.join(tmp, name); await ff.run(['-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${secs}`, ...extra, f]); return f; };

test('saving over the song\'s own file is refused and the file is kept', async () => {
  const f = await tone('own.mp3');
  const size = fs.statSync(f).size;
  await assert.rejects(ff.exportOne({ src: f, dest: f, fx: ff.DEFAULT_FX, duration: 3, tags: {}, format: 'mp3' }), /own file/);
  await assert.rejects(ff.exportOne({ src: f, dest: f.toUpperCase().replace('OWN.MP3', 'Own.mp3').replace(tmp.toUpperCase(), tmp), fx: ff.DEFAULT_FX, duration: 3, tags: {}, format: 'mp3' }), /own file/, 'other letter case too');
  assert.strictEqual(fs.statSync(f).size, size, 'the original is untouched');
});

test('a save writes the whole file first: no half file, no temporary file left', async () => {
  const f = await tone('src.wav');
  const dest = path.join(tmp, 'out.mp3');
  await ff.exportOne({ src: f, dest, fx: ff.DEFAULT_FX, duration: 3, tags: { title: 'Out' }, format: 'mp3' });
  assert.ok(fs.existsSync(dest));
  assert.deepStrictEqual(fs.readdirSync(tmp).filter((x) => x.includes('tonix-part')), []);
  await assert.rejects(ff.exportOne({ src: path.join(tmp, 'missing.wav'), dest: path.join(tmp, 'never.mp3'), fx: ff.DEFAULT_FX, duration: 3, tags: {}, format: 'mp3' }));
  assert.ok(!fs.existsSync(path.join(tmp, 'never.mp3')));
  assert.deepStrictEqual(fs.readdirSync(tmp).filter((x) => x.includes('tonix-part')), []);
});

test('a tag that says "Duration: 01:00:00" does not change the song\'s length', async () => {
  const f = await tone('fake.mp3', 4, ['-metadata', 'comment=Duration: 01:00:00.00']);
  const d = (await ff.probe(f)).info.duration;
  assert.ok(Math.abs(d - 4) < 0.2, `length ${d}`);
});

test('one big file keeps its own title (not the last chapter\'s)', () => {
  assert.deepStrictEqual(ff.parseFfmetadata(';FFMETADATA1\ntitle=Big\nartist=A\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=10\ntitle=Song 1\n'), { title: 'Big', artist: 'A' });
});

test('WAV keeps the label, and ; = in values survive', async () => {
  const f = await tone('lab.wav', 1);
  const out = path.join(tmp, 'lab-out.wav');
  await ff.exportOne({ src: f, dest: out, fx: ff.DEFAULT_FX, duration: 1, tags: { title: 'L', label: 'My;Label=x', stars: 7 }, format: 'wav' });
  const tags = (await ff.probe(out)).tags || {};
  const all = JSON.stringify(tags);
  assert.ok(/My;Label=x/.test(all), all);
});

test('map: paths that are all 0 % still lead somewhere; a lone locked path is 100 %', () => {
  const p = Chance.pick([{ id: 'a', chance: 0 }, { id: 'b', chance: 0 }], 0.9);
  assert.strictEqual(p.id, 'b');
  const one = [{ chance: 50, locked: true }];
  Chance.fillTo100(one);
  assert.strictEqual(one[0].chance, 100);
});

test('a held tone or noise has no beat (no made-up tempo)', async () => {
  const f = await tone('held.wav', 12);
  const b = T.beats(await T.decodeMono(ff, f, 22050, 0, 12), 22050);
  assert.strictEqual(b.bpm, 0);
});
