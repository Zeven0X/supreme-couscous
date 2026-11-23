'use strict';
// Checks the drawn-path math: points survive save/load, follow moved songs, and shaky lines get cleaned up.
const test = require('node:test');
const assert = require('node:assert');
const Sh = require('../renderer/pathshape');
const near = (p, q, tol = 1e-6) => assert.ok(Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol, `${p} vs ${q}`);

test('a point converts to the stored form and back unchanged', () => {
  const a = { x: 10, y: 20 }, b = { x: 310, y: -80 };
  for (const p of [[100, 50], [-40, 300], [310, -80]]) near(Sh.fromNorm(a, b, Sh.toNorm(a, b, p)), p);
});

test('drawn points follow when a song is moved', () => {
  const a = { x: 0, y: 0 }, b = { x: 200, y: 0 };
  const q = Sh.toNorm(a, b, [100, 50]); // halfway, 50 to the side
  near(Sh.fromNorm(a, { x: 400, y: 0 }, q), [200, 100]); // twice as far: twice as big
  near(Sh.fromNorm(a, { x: 0, y: 200 }, q), [-50, 100]); // turned a quarter: the drawing turns too
});

test('loop points move with their song', () => {
  const a = { x: 50, y: 50 };
  const q = Sh.toNorm(a, a, [80, 10]);
  near(Sh.fromNorm({ x: 500, y: 300 }, { x: 500, y: 300 }, q), [530, 260]);
});

test('a shaky straight line becomes 2 points, a corner is kept', () => {
  const line = Array.from({ length: 200 }, (_, i) => [i * 2, Math.sin(i) * 3]);
  assert.strictEqual(Sh.simplify(line, 14).length, 2);
  const corner = [...Array.from({ length: 50 }, (_, i) => [i * 4, 0]), ...Array.from({ length: 50 }, (_, i) => [200, i * 4])];
  const out = Sh.simplify(corner, 14);
  assert.strictEqual(out.length, 3);
  near(out[1], [200, 0], 5);
});

test('a wild scribble is limited to the max number of points', () => {
  const wild = Array.from({ length: 600 }, (_, i) => [i * 3, Math.sin(i / 4) * 120]);
  assert.ok(Sh.simplifyTo(wild, 14, 14).length <= 14);
});

test('the smooth curve passes through every point', () => {
  const P = [[0, 0], [50, 80], [120, 20], [200, 100]];
  const { d, mids } = Sh.spline(P);
  for (const p of P.slice(1)) assert.ok(d.includes(`${p[0]} ${p[1]}`));
  assert.strictEqual(mids.length, 3);
});
