'use strict';
// The star filter: 6⭐ or more, exactly 6⭐, 4⭐ or less. Songs without stars are hidden while it is on.
const test = require('node:test');
const assert = require('node:assert');
const { matches, label } = require('../renderer/stars');

test('star filter', () => {
  const songs = [0, 3, 4, 6, 10].map((stars) => ({ stars }));
  const pick = (f) => songs.filter((t) => matches(t, f)).map((t) => t.stars);
  assert.deepStrictEqual(pick({ n: 6, mode: 'more' }), [6, 10]);
  assert.deepStrictEqual(pick({ n: 4, mode: 'less' }), [3, 4]);
  assert.deepStrictEqual(pick({ n: 6, mode: 'exact' }), [6]);
  assert.deepStrictEqual(pick(null), [0, 3, 4, 6, 10], 'no filter: every song');
  assert.strictEqual(label({ n: 6, mode: 'more' }), '6⭐ or more');
  assert.strictEqual(label({ n: 4, mode: 'less' }), '4⭐ or less');
});
