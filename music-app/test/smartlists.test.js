'use strict';
// Smart playlists made by Tonix: one per genre and exact star count.
const test = require('node:test');
const assert = require('node:assert');
const { build } = require('../renderer/smartlists');

test('one playlist per genre + exact stars, best first, fills and empties itself', () => {
  const songs = [
    { id: 'a', title: 'B song', genre: 'Rock', stars: 6 },
    { id: 'b', title: 'A song', genre: 'rock', stars: 6 },
    { id: 'c', title: 'C song', genre: 'Rock', stars: 9 },
    { id: 'd', title: 'D song', genre: 'Pop', stars: 2 },
    { id: 'e', title: 'E song', genre: 'Rock; Pop', stars: 2 },
    { id: 'f', title: 'No stars', genre: 'Rock' },
    { id: 'g', title: 'No genre', stars: 5 },
  ];
  const lists = build(songs);
  assert.deepStrictEqual(lists.map((p) => p.name), ['2⭐ Pop', '9⭐ Rock', '6⭐ Rock', '2⭐ Rock']);
  assert.deepStrictEqual(lists.find((p) => p.name === '6⭐ Rock').trackIds, ['b', 'a'], 'exactly 6 stars, any spelling of Rock, sorted by title');
  assert.deepStrictEqual(lists.find((p) => p.name === '2⭐ Pop').trackIds, ['d', 'e'], 'a song with two genres is in both');
  assert.ok(lists.every((p) => p.smart && p.id.startsWith('smart|')));
  songs[0].stars = 9; // rate a song again: it moves by itself
  const again = build(songs);
  assert.deepStrictEqual(again.find((p) => p.name === '9⭐ Rock').trackIds, ['a', 'c']);
  assert.deepStrictEqual(again.find((p) => p.name === '6⭐ Rock').trackIds, ['b']);
  assert.deepStrictEqual(build([]), []);
});
