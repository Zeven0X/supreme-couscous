'use strict';
// Playlists stored in the library: order kept, each song once, removed songs leave playlists, saved to disk.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Library } = require('../lib/library');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tonix-pl-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('make, fill, reorder, rename, remove songs, delete, reload', () => {
  const dir = path.join(tmp, 'lib');
  const lib = new Library(dir);
  const [a, b, c] = ['A', 'B', 'C'].map((title) => lib.add({ id: lib.newId(), title, srcPath: `/x/${title}.mp3`, mediaPath: `/x/${title}.mp3` }));
  const p = lib.createPlaylist('  Road trip  ', [b.id, a.id, b.id, 'nope']);
  assert.strictEqual(p.name, 'Road trip');
  assert.deepStrictEqual(p.trackIds, [b.id, a.id], 'order kept, each song once, unknown songs dropped');
  lib.updatePlaylist(p.id, { trackIds: [c.id, a.id, b.id], name: 'Night drive', shuffle: true });
  assert.deepStrictEqual(lib.playlistById(p.id).trackIds, [c.id, a.id, b.id]);
  assert.strictEqual(lib.playlistById(p.id).name, 'Night drive');
  lib.updatePlaylist(p.id, { name: '   ' });
  assert.strictEqual(lib.playlistById(p.id).name, 'Night drive', 'an empty name keeps the old one');
  lib.remove([a.id]);
  assert.deepStrictEqual(lib.playlistById(p.id).trackIds, [c.id, b.id], 'a removed song leaves the playlist');
  const q = lib.createPlaylist('', []);
  assert.strictEqual(q.name, 'New playlist');
  lib.flush();
  const again = new Library(dir);
  assert.strictEqual(again.playlists.length, 2);
  assert.deepStrictEqual(again.playlistById(p.id).trackIds, [c.id, b.id]);
  assert.strictEqual(again.playlistById(p.id).shuffle, true);
  assert.ok(again.deletePlaylist(q.id));
  assert.strictEqual(again.playlists.length, 1);
  again.flush();
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'library.json'), 'utf8')).playlists.length, 1, 'saved to disk');
});

test('smart shuffle memory: play clock, play stamps, marks', () => {
  const dir = path.join(tmp, 'lib2');
  const lib = new Library(dir);
  const a = lib.add({ id: lib.newId(), title: 'A', srcPath: '/x/A.mp3', mediaPath: '/x/A.mp3' });
  lib.played(a.id); lib.played(a.id);
  assert.strictEqual(lib.playClock, 2);
  assert.deepStrictEqual(lib.byId(a.id).stamps, [1, 2]);
  assert.strictEqual(lib.byId(a.id).plays, 2);
  lib.mark([a.id], 'black', 5);
  assert.deepStrictEqual([lib.byId(a.id).mark, lib.byId(a.id).markAt, lib.byId(a.id).markUntil], ['black', 2, 22], 'counts for 5 songs x 4 plays');
  lib.mark(a.id, 'nonsense');
  assert.strictEqual(lib.byId(a.id).mark, null, 'only black / fav / normal');
  for (let i = 0; i < 70; i++) lib.played(a.id);
  assert.strictEqual(lib.byId(a.id).stamps.length, 60, 'keeps the last 60 plays only');
  lib.flush();
  assert.strictEqual(new Library(dir).playClock, 72, 'the clock is saved');
});
