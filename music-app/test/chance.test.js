'use strict';
// Checks the path-chance math: always whole percents that add up to 100, locks respected, luck follows the chances.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../renderer/chance');
const P = (chance, locked = false) => ({ chance, locked });
const sum = (ps) => ps.reduce((a, p) => a + p.chance, 0);

test('even split: 3 paths -> 34/33/33', () => {
  const ps = C.evenSplit([P(0), P(0), P(0)]);
  assert.deepStrictEqual(ps.map((p) => p.chance), [34, 33, 33]);
});

test('even split keeps locked paths', () => {
  const ps = C.evenSplit([P(40, true), P(0), P(0)]);
  assert.deepStrictEqual(ps.map((p) => p.chance), [40, 30, 30]);
});

test('removing a path: the rest grow in proportion to 100', () => {
  const ps = C.fillTo100([P(60), P(20)]); // a 20% path was removed
  assert.deepStrictEqual(ps.map((p) => p.chance), [75, 25]);
});

test('set one path: others share the rest, locked stays', () => {
  const ps = [P(25, true), P(25), P(50)];
  C.setChance(ps, ps[1], 55);
  assert.deepStrictEqual(ps.map((p) => p.chance), [25, 55, 20]);
  assert.strictEqual(sum(ps), 100);
  C.setChance(ps, ps[1], 500); // cannot go past what is free
  assert.deepStrictEqual(ps.map((p) => p.chance), [25, 75, 0]);
});

test('always adds to 100 for many random cases', () => {
  for (let k = 0; k < 500; k++) {
    const n = 1 + Math.floor(Math.random() * 7);
    const ps = Array.from({ length: n }, () => P(Math.floor(Math.random() * 60)));
    C.fillTo100(ps);
    assert.strictEqual(sum(ps), 100);
    for (const p of ps) assert.ok(Number.isInteger(p.chance) && p.chance >= 0);
  }
});

test('luck follows the chances (70/30 over 20,000 picks)', () => {
  const ps = [P(70), P(30)];
  let a = 0;
  for (let i = 0; i < 20000; i++) if (C.pick(ps) === ps[0]) a++;
  assert.ok(Math.abs(a / 20000 - 0.7) < 0.02, `got ${a / 20000}`);
  assert.strictEqual(C.pick([]), null);
  const q = [P(0), P(100)]; // a 0% path is never picked, even with the lowest roll
  assert.strictEqual(C.pick(q, 0), q[1]);
});
