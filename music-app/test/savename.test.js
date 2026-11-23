'use strict';
// "Fill from name" in the save window: artist and title read from the original file name.
const test = require('node:test');
const assert = require('node:assert');
const { parseName } = require('../renderer/savename');

test('artist - title, extras like (Official Audio) are dropped', () => {
  assert.deepStrictEqual(parseName('Nova Lane - Midnight Drive (Official Audio)'), { artist: 'Nova Lane', title: 'Midnight Drive' });
  assert.deepStrictEqual(parseName('Nova Lane – Midnight Drive [Official Music Video] (HD)'), { artist: 'Nova Lane', title: 'Midnight Drive' });
  assert.deepStrictEqual(parseName('Nova_Lane_-_Midnight_Drive_(Lyrics)'), { artist: 'Nova Lane', title: 'Midnight Drive' });
});

test('feat. and remix stay in the title', () => {
  assert.deepStrictEqual(parseName('Nova Lane - Midnight Drive (feat. Kai) (Official Video)'), { artist: 'Nova Lane', title: 'Midnight Drive (feat. Kai)' });
  assert.deepStrictEqual(parseName('Nova Lane - Midnight Drive (Sky Remix)'), { artist: 'Nova Lane', title: 'Midnight Drive (Sky Remix)' });
});

test('track numbers, channel names and dashes without spaces', () => {
  assert.deepStrictEqual(parseName('03. Nova Lane - Midnight Drive'), { artist: 'Nova Lane', title: 'Midnight Drive' });
  assert.deepStrictEqual(parseName('Nova Lane - Midnight Drive | Some Channel'), { artist: 'Nova Lane', title: 'Midnight Drive' });
  assert.deepStrictEqual(parseName('NovaLane-MidnightDrive'), { artist: 'NovaLane', title: 'MidnightDrive' });
  assert.deepStrictEqual(parseName('Nova Lane - Midnight Drive - Live'), { artist: 'Nova Lane', title: 'Midnight Drive - Live' });
});

test('no artist in the name: only the title is filled', () => {
  assert.deepStrictEqual(parseName('Midnight Drive (Official Video)'), { artist: '', title: 'Midnight Drive' });
  assert.deepStrictEqual(parseName('Re-Wind Pre-Show Mix'), { artist: '', title: 'Re-Wind Pre-Show Mix' });
});
