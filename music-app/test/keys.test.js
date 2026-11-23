'use strict';
// Checks the shortcut rules: reading key presses, clashes, swapping, and which action a key runs where.
const test = require('node:test');
const assert = require('node:assert');
const K = require('../renderer/keys');
const ev = (code, m = {}) => ({ code, ctrlKey: !!m.ctrl, shiftKey: !!m.shift, altKey: !!m.alt, metaKey: false });

test('key presses become combos and readable labels', () => {
  assert.strictEqual(K.fromEvent(ev('KeyO', { ctrl: true, shift: true })), 'Ctrl+Shift+KeyO');
  assert.strictEqual(K.fromEvent(ev('Numpad3')), 'Digit3');
  assert.strictEqual(K.label('Ctrl+Shift+KeyO'), 'Ctrl + Shift + O');
  assert.strictEqual(K.label('Shift+ArrowLeft'), 'Shift + ←');
  assert.strictEqual(K.label('Shift+Slash'), '?');
});

test('every default shortcut is free of clashes', () => {
  for (const a of K.ACTIONS) {
    if (a.fixed) continue;
    for (const k of a.keys) assert.strictEqual(K.clash(a.id, k), null, `${a.id} ${k}`);
  }
});

test('the right action runs on each page', () => {
  assert.strictEqual(K.match('KeyS', 'map').action.id, 'mapStart');
  assert.strictEqual(K.match('KeyS', 'library'), null); // S does nothing in the library
  assert.strictEqual(K.match('Delete', 'library').action.id, 'removeSongs');
  assert.strictEqual(K.match('Delete', 'map').action.id, 'mapRemove');
  assert.strictEqual(K.match('Space', 'settings').action.id, 'playPause');
  const b = K.match('Shift+BracketRight', 'library'); // Shift = 5× steps
  assert.deepStrictEqual([b.action.id, b.boost], ['speedUp', 5]);
  assert.strictEqual(K.match('Shift+ArrowLeft', 'library').action.id, 'back30'); // own shortcut wins over boost
});

test('changing a shortcut: clash, swap and steal', () => {
  // Ctrl+M is "Your maps" on the map page. Giving it to "Next song" (works everywhere) clashes.
  assert.strictEqual(K.clash('next', 'Ctrl+KeyM').id, 'mapMaps');
  const swapped = K.assign('next', 'Ctrl+KeyM', {}, 'swap');
  assert.deepStrictEqual(K.current(swapped).next, ['Ctrl+KeyM']);
  assert.deepStrictEqual(K.current(swapped).mapMaps, ['Ctrl+ArrowRight']);
  const stolen = K.assign('next', 'Ctrl+KeyM', {}, 'steal');
  assert.deepStrictEqual(K.current(stolen).mapMaps, []);
  // a map-only key does not clash with a library-only key
  assert.strictEqual(K.clash('mapLock', 'Ctrl+KeyA'), null);
  // reset brings the default back
  assert.deepStrictEqual(K.current(K.resetOne('next', swapped)).next, ['Ctrl+ArrowRight']);
});

test('keys that must stay free are refused', () => {
  assert.ok(K.refuse('Shift+KeyA'));
  assert.ok(K.refuse('Ctrl+KeyC'));
  assert.ok(K.refuse('Escape'));
  assert.strictEqual(K.refuse('Ctrl+Alt+KeyK'), null);
});
