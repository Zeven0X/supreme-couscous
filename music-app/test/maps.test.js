'use strict';
// Checks that maps save, load and list correctly, and that bad ids can't touch other files.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MapStore } = require('../lib/maps');

test('create, save, reload and list maps', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-maps-'));
  try {
    const store = new MapStore(dir);
    const m = store.create('Road trip');
    m.stops.push({ id: 'a1', trackId: 't1', x: 10, y: -20, fx: { speed: 110 } });
    m.startId = 'a1';
    store.save(m);
    const back = store.get(m.id);
    assert.strictEqual(back.name, 'Road trip');
    assert.deepStrictEqual(back.stops[0], { id: 'a1', trackId: 't1', x: 10, y: -20, fx: { speed: 110 } });
    assert.strictEqual(back.startId, 'a1');
    store.create('Second');
    const list = store.list();
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list.find((x) => x.id === m.id).stops, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('bad map ids are refused', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-maps-'));
  try {
    const store = new MapStore(dir);
    assert.throws(() => store.get('../../library'), /Bad map id/);
    assert.throws(() => store.save({ id: '..\\x' }), /Bad map id/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('background, song-name color and own pictures are saved with the map', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-maps-'));
  try {
    const store = new MapStore(dir);
    const m = store.create('Bg test');
    assert.deepStrictEqual(m.bg, { kind: 'builtin', id: 'dots' }); // new maps start on Dark dots
    m.bg = { kind: 'custom', file: 'abc.png', w: 300, h: 200 };
    m.names = { mode: 'custom', color: '#ff00aa' };
    m.customBgs = [{ file: 'abc.png', w: 300, h: 200, label: 'me.png' }];
    store.save(m);
    const back = store.get(m.id);
    assert.deepStrictEqual([back.bg, back.names, back.customBgs], [m.bg, m.names, m.customBgs]);
    assert.ok(fs.existsSync(store.assetDir));
    assert.strictEqual(store.list().length, 1); // the pictures folder is not counted as a map
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
