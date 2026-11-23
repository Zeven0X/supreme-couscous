'use strict';
// Smart shuffle: weights, blacklist / favourite, back to normal after (songs x 4) plays, no repeats.
const test = require('node:test');
const assert = require('node:assert');
const { weight, pick, badge, windowOf } = require('../renderer/shuffle');

function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const songs = (n) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, stamps: [] }));

test('window is songs x 4', () => {
  assert.strictEqual(windowOf(10), 40);
  assert.strictEqual(windowOf(1), 4);
});

test('played a lot = fewer tickets, never played = more, 4 plays = normal', () => {
  const clock = 100, n = 10; // window 40: plays after clock 60 count
  assert.strictEqual(weight({ stamps: [] }, clock, n), 3);
  assert.strictEqual(weight({ stamps: [70, 80, 90, 95] }, clock, n), 1);
  assert.ok(weight({ stamps: Array.from({ length: 30 }, (_, i) => 61 + i) }, clock, n) < 0.2);
  assert.strictEqual(weight({ stamps: [10, 20, 30, 40, 50] }, clock, n), 3, 'old plays (before the window) are forgotten');
});

test('blacklist about 1 in 10, favourite 3x, both end after songs x 4 plays', () => {
  const n = 10;
  const base = { stamps: [70, 80, 90, 95] };
  assert.ok(Math.abs(weight({ ...base, mark: 'black', markAt: 90 }, 100, n) - 0.1) < 1e-9);
  assert.strictEqual(weight({ stamps: Array.from({ length: 20 }, (_, i) => 70 + i), mark: 'fav', markAt: 90 }, 100, n), 3, 'a favourite stays 3x even when it played a lot');
  assert.strictEqual(weight({ stamps: [], mark: 'black', markAt: 50 }, 90, n), 3, 'blacklist over after 40 plays: back to normal');
  assert.strictEqual(badge({ stamps: [], mark: 'black', markAt: 60 }, 99, n), 'black');
  assert.strictEqual(badge({ stamps: [], mark: 'black', markAt: 59 }, 99, n), '');
});

test('in a long run a blacklisted song plays about 10x less, a favourite about 3x more', () => {
  const pool = songs(10);
  pool[0].mark = 'black'; pool[1].mark = 'fav';
  const rnd = seeded(7);
  const count = {};
  const recent = [];
  for (let i = 0; i < 6000; i++) {
    for (const t of pool) if (t.mark) t.markAt = i; // keep the marks fresh for this test
    const t = pick(pool, recent, i, rnd);
    count[t.id] = (count[t.id] || 0) + 1;
    t.stamps.push(i + 1); // the play counts, like in the app
    recent.push(t.id);
  }
  const normal = (count.s2 + count.s3 + count.s4 + count.s5) / 4;
  console.log(`  blacklisted ${count.s0}, favourite ${count.s1}, normal about ${Math.round(normal)} of 6000`);
  assert.ok(count.s0 < normal / 4, `blacklisted ${count.s0} vs normal ${normal}`);
  assert.ok(count.s1 > normal * 1.5, `favourite ${count.s1} vs normal ${normal}`);
});

test('never the same song twice in a row, recent songs are skipped', () => {
  const pool = songs(6);
  const rnd = seeded(3);
  const recent = [];
  for (let i = 0; i < 500; i++) {
    const t = pick(pool, recent, i, rnd);
    assert.ok(!recent.slice(-2).includes(t.id), 'one of the last 2 songs came again');
    recent.push(t.id);
  }
  const two = songs(2);
  assert.notStrictEqual(pick(two, ['s0'], 0, () => 0).id, 's0');
  assert.strictEqual(pick(songs(1), ['s0'], 0).id, 's0', 'a one-song playlist still plays');
});
