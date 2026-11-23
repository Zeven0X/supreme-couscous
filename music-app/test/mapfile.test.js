'use strict';
// Checks the .tonixmap file: what goes in comes out byte for byte, and broken or tricky files are refused.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const MF = require('../lib/mapfile');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-mapfile-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const write = (name, data) => { const p = path.join(tmp, name); fs.writeFileSync(p, data); return p; };

test('files go in and come out exactly the same', async () => {
  const a = write('a.bin', Buffer.from(Array.from({ length: 300000 }, (_, i) => i % 251)));
  const b = write('b.bin', 'hello');
  const e = write('e.bin', '');
  const dest = path.join(tmp, 'x.tonixmap');
  let last = 0;
  await MF.writeMapFile(dest, { map: { name: 'M' }, songs: [] }, [{ id: 'f0', path: a }, { id: 'f1', path: b }, { id: 'f2', path: e }], (p) => { last = p; });
  assert.strictEqual(last, 1);
  assert.ok(!fs.existsSync(`${dest}.part`));
  const { index, offsets } = MF.readIndex(dest);
  assert.strictEqual(index.map.name, 'M');
  for (const [id, src] of [['f0', a], ['f1', b], ['f2', e]]) {
    const out = await MF.extract(dest, offsets, id, path.join(tmp, `out-${id}`));
    assert.ok(fs.readFileSync(out).equals(fs.readFileSync(src)), id);
  }
});

test('broken or tricky files are refused', async () => {
  assert.throws(() => MF.readIndex(write('n1', 'just some text file')), /not a Tonix map/);
  const huge = Buffer.concat([MF.MAGIC, Buffer.from([0xff, 0xff, 0xff, 0xff]), Buffer.from('{}')]);
  assert.throws(() => MF.readIndex(write('n2', huge)), /damaged/);
  const good = path.join(tmp, 'g.tonixmap');
  await MF.writeMapFile(good, { map: {} }, [{ id: 'f0', path: write('c.bin', 'abcdef') }]);
  const full = fs.readFileSync(good);
  assert.throws(() => MF.readIndex(write('n3', full.subarray(0, full.length - 2))), /not complete/); // cut short
  assert.throws(() => MF.readIndex(write('n4', Buffer.concat([full, Buffer.from('xx')]))), /not complete/); // extra bytes
  const { offsets } = MF.readIndex(good);
  await assert.rejects(MF.extract(good, offsets, '../../evil', path.join(tmp, 'z')), /missing a part/);
});

test('a received map is rebuilt safely', () => {
  let n = 0;
  const newId = () => `id${++n}`;
  const m = {
    name: '<b>Party</b>', startId: 's2', view: { x: 5, y: 'oops', zoom: 99 },
    stops: [{ id: 's1', trackId: 'x', x: 10, y: 20, fx: { speed: 999 } }, { id: 's2', x: 1e12, y: 0 }, { id: 'gone', x: 0, y: 0 }],
    paths: [
      { id: 'p1', from: 's1', to: 's2', chance: 250, color: 'red;evil', style: 'wavy', blend: { type: 'boom', secs: 99 }, pts: [[1, 2], ['a', 3], [4]] },
      { id: 'p2', from: 's1', to: 's2' }, // same two songs again: dropped
      { id: 'p3', from: 's2', to: 'gone' }, // song did not come through: dropped
    ],
    bg: { kind: 'custom', file: 'old.png' }, customBgs: [{ file: 'old.png', w: 300, h: 200, label: 'me' }, { file: 'unknown.png' }],
    names: { mode: 'custom', color: '#AABBCC' },
  };
  const out = MF.cleanMap(m, {
    id: 'newmap', cover: null, newId,
    stopTrack: new Map([['s1', 't1'], ['s2', 't2']]), bgFiles: new Map([['old.png', 'newmap-1.png']]),
    normFx: (fx) => ({ speed: Math.min(400, fx.speed || 100) }),
  });
  assert.strictEqual(out.stops.length, 2);
  assert.deepStrictEqual(out.stops[0], { id: 'id1', trackId: 't1', x: 10, y: 20, fx: { speed: 400 } });
  assert.strictEqual(out.stops[1].x, 1e6);
  assert.strictEqual(out.startId, 'id2');
  assert.strictEqual(out.paths.length, 1);
  assert.deepStrictEqual(out.paths[0], { id: 'id3', from: 'id1', to: 'id2', chance: 100, locked: false, blend: { type: 'crossfade', secs: 15 }, color: null, style: 'solid', name: '', pts: [[1, 2]] });
  assert.deepStrictEqual(out.bg, { kind: 'custom', file: 'newmap-1.png', w: 300, h: 200 });
  assert.strictEqual(out.customBgs.length, 1);
  assert.deepStrictEqual(out.view, { x: 5, y: 0, zoom: 2.5 });
  assert.strictEqual(out.names.color, '#AABBCC');
  assert.strictEqual(out.progress, null);
});
