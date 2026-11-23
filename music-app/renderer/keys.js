'use strict';
// Keyboard shortcuts: the list of actions, how keys are written ("Ctrl+Shift+KeyO"), how they are shown
// ("Ctrl + Shift + O"), and clash checks. No screen code here, so it can be tested on its own.
// Keys are stored by their place on the keyboard (e.code), so they work the same in any keyboard language.
(function (root) {
  // scope: where a shortcut works. 'global' = everywhere, 'library' / 'map' = only on that page.
  // fixed: shown in the list but cannot be changed (they are families of keys).
  const ACTIONS = [
    // Playing
    { id: 'playPause', group: 'Playing', label: 'Play / pause', keys: ['Space'], scope: 'global' },
    { id: 'back5', group: 'Playing', label: 'Back 5 s', keys: ['ArrowLeft'], scope: 'global' },
    { id: 'fwd5', group: 'Playing', label: 'Forward 5 s', keys: ['ArrowRight'], scope: 'global' },
    { id: 'back30', group: 'Playing', label: 'Back 30 s', keys: ['Shift+ArrowLeft'], scope: 'global' },
    { id: 'fwd30', group: 'Playing', label: 'Forward 30 s', keys: ['Shift+ArrowRight'], scope: 'global' },
    { id: 'next', group: 'Playing', label: 'Next song', keys: ['Ctrl+ArrowRight'], scope: 'global' },
    { id: 'prev', group: 'Playing', label: 'Previous song', keys: ['Ctrl+ArrowLeft'], scope: 'global' },
    { id: 'mute', group: 'Playing', label: 'Mute', keys: ['KeyM'], scope: 'global' },
    { id: 'volUp', group: 'Playing', label: 'Main volume up', keys: ['Ctrl+ArrowUp'], scope: 'global' },
    { id: 'volDown', group: 'Playing', label: 'Main volume down', keys: ['Ctrl+ArrowDown'], scope: 'global' },
    // Sound of the playing song (Shift = 5 times bigger steps)
    { id: 'speedDown', group: 'Sound', label: 'Speed −1', keys: ['BracketLeft'], scope: 'global', boost: true },
    { id: 'speedUp', group: 'Sound', label: 'Speed +1', keys: ['BracketRight'], scope: 'global', boost: true },
    { id: 'pitchDown', group: 'Sound', label: 'Pitch −1', keys: ['Minus'], scope: 'global', boost: true },
    { id: 'pitchUp', group: 'Sound', label: 'Pitch +1', keys: ['Equal'], scope: 'global', boost: true },
    { id: 'volCardDown', group: 'Sound', label: 'Volume −1', keys: ['Comma'], scope: 'global', boost: true },
    { id: 'volCardUp', group: 'Sound', label: 'Volume +1', keys: ['Period'], scope: 'global', boost: true },
    { id: 'shiftBoost', group: 'Sound', label: 'Hold Shift for ×5 steps', keys: ['Shift'], scope: 'global', fixed: true },
    { id: 'resetSound', group: 'Sound', label: 'Reset all sound', keys: ['Alt+KeyR'], scope: 'global' },
    // Library
    { id: 'search', group: 'Library', label: 'Search', keys: ['Ctrl+KeyF'], scope: 'global' },
    { id: 'uploadFiles', group: 'Library', label: 'Upload files', keys: ['Ctrl+KeyO'], scope: 'global' },
    { id: 'uploadFolder', group: 'Library', label: 'Upload folder', keys: ['Ctrl+Shift+KeyO'], scope: 'global' },
    { id: 'selectAll', group: 'Library', label: 'Select all', keys: ['Ctrl+KeyA'], scope: 'library' },
    { id: 'playSelected', group: 'Library', label: 'Play selected', keys: ['Enter'], scope: 'library' },
    { id: 'saveSong', group: 'Library', label: 'Save song', keys: ['Ctrl+KeyS'], scope: 'global' },
    { id: 'saveAlbum', group: 'Library', label: 'Save album', keys: ['Ctrl+Shift+KeyS'], scope: 'global' },
    { id: 'picsBigger', group: 'Library', label: 'Bigger pictures', keys: ['Ctrl+Equal'], scope: 'library' },
    { id: 'picsSmaller', group: 'Library', label: 'Smaller pictures', keys: ['Ctrl+Minus'], scope: 'library' },
    { id: 'removeSongs', group: 'Library', label: 'Remove selected songs', keys: ['Delete'], scope: 'library' },
    // Map
    { id: 'mapPlay', group: 'Map', label: 'Play / stop map', keys: ['Ctrl+Enter'], scope: 'map' },
    { id: 'mapChoose', group: 'Map', label: 'Choose next path', keys: ['1–9'], scope: 'map', fixed: true },
    { id: 'mapPath', group: 'Map', label: 'Path tool', keys: ['KeyP'], scope: 'map' },
    { id: 'mapAdd', group: 'Map', label: 'Add songs', keys: ['KeyA'], scope: 'map' },
    { id: 'mapStart', group: 'Map', label: 'Set Start', keys: ['KeyS'], scope: 'map' },
    { id: 'mapLock', group: 'Map', label: 'Lock selected path', keys: ['KeyL'], scope: 'map' },
    { id: 'mapBg', group: 'Map', label: 'Background', keys: ['KeyB'], scope: 'map' },
    { id: 'mapFit', group: 'Map', label: 'Show all', keys: ['KeyF'], scope: 'map' },
    { id: 'mapRemove', group: 'Map', label: 'Remove selected', keys: ['Delete', 'Backspace'], scope: 'map' },
    { id: 'mapMaps', group: 'Map', label: 'Your maps', keys: ['Ctrl+KeyM'], scope: 'map' },
    { id: 'undo', group: 'Map', label: 'Undo', keys: ['Ctrl+KeyZ'], scope: 'map' },
    { id: 'redo', group: 'Map', label: 'Redo', keys: ['Ctrl+KeyY', 'Ctrl+Shift+KeyZ'], scope: 'map' },
    // App
    { id: 'page1', group: 'App', label: 'Library page', keys: ['Ctrl+Digit1'], scope: 'global' },
    { id: 'page2', group: 'App', label: 'Map page', keys: ['Ctrl+Digit2'], scope: 'global' },
    { id: 'page3', group: 'App', label: 'Edit page', keys: ['Ctrl+Digit3'], scope: 'global' },
    { id: 'page4', group: 'App', label: 'Settings page', keys: ['Ctrl+Digit4'], scope: 'global' },
    { id: 'settings', group: 'App', label: 'Settings', keys: ['Ctrl+Comma'], scope: 'global' },
    { id: 'cheat', group: 'App', label: 'Show all shortcuts', keys: ['Shift+Slash', 'F1'], scope: 'global' },
    { id: 'escape', group: 'App', label: 'Close window / cancel', keys: ['Escape'], scope: 'global', fixed: true },
  ];
  const GROUPS = ['Playing', 'Sound', 'Library', 'Map', 'App'];

  // A key press -> "Ctrl+Shift+KeyO". Number pad digits count as normal digits.
  function fromEvent(e) {
    let code = e.code || '';
    if (/^Numpad\d$/.test(code)) code = `Digit${code.slice(6)}`;
    if (code === 'NumpadEnter') code = 'Enter';
    const mods = [];
    if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    return [...mods, code].join('+');
  }
  const isModifier = (code) => /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/.test(code);

  const NAMES = {
    Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=',
    Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'", Backquote: '`', Escape: 'Esc', Delete: 'Delete',
    Backspace: 'Backspace', Enter: 'Enter', Tab: 'Tab', Home: 'Home', End: 'End', PageUp: 'Page Up', PageDown: 'Page Down', Insert: 'Insert',
  };
  // "Ctrl+Shift+KeyO" -> "Ctrl + Shift + O". Shift + / is shown as "?".
  function label(combo) {
    if (combo === 'Shift+Slash') return '?';
    return combo.split('+').map((p) => {
      if (/^Key[A-Z]$/.test(p)) return p.slice(3);
      if (/^Digit\d$/.test(p)) return p.slice(5);
      return NAMES[p] || p;
    }).join(' + ');
  }

  const overlap = (a, b) => a === 'global' || b === 'global' || a === b;
  // The keys every action has now: the user's changes on top of the defaults.
  function current(custom = {}) {
    const out = {};
    for (const a of ACTIONS) out[a.id] = Array.isArray(custom[a.id]) ? custom[a.id].slice() : a.keys.slice();
    return out;
  }
  // Which other action already uses this combo where `id` works too? (null = free)
  function clash(id, combo, custom = {}) {
    const me = ACTIONS.find((a) => a.id === id);
    const keys = current(custom);
    for (const a of ACTIONS) {
      if (a.id === id || a.fixed || !overlap(a.scope, me.scope)) continue;
      if (keys[a.id].includes(combo)) return a;
    }
    return null;
  }
  // Keys that should not be taken: they belong to typing or to Windows itself.
  function refuse(combo) {
    if (/^(Shift\+)?(Key[A-Z]|Digit\d)$/.test(combo) && combo.startsWith('Shift')) return 'Shift + a letter types a capital letter. Add Ctrl or Alt.';
    if (['Alt+F4', 'Ctrl+Alt+Delete', 'Alt+Tab', 'Ctrl+Escape'].includes(combo)) return 'Windows uses these keys.';
    if (['Ctrl+KeyC', 'Ctrl+KeyV', 'Ctrl+KeyX'].includes(combo)) return 'These are copy / paste / cut. Pick other keys.';
    if (combo === 'Escape' || combo === 'Tab' || combo === 'Shift+Tab') return 'Esc and Tab must stay free.';
    return null;
  }
  // Give `id` the combo (replacing its first key). mode: 'swap' gives the other action our old key,
  // 'steal' just removes it from the other action.
  function assign(id, combo, custom = {}, mode = 'steal') {
    const next = JSON.parse(JSON.stringify(custom));
    const keys = current(custom);
    const other = clash(id, combo, custom);
    const old = keys[id][0];
    if (other) {
      const rest = keys[other.id].filter((k) => k !== combo);
      if (mode === 'swap' && old && !rest.includes(old)) rest.unshift(old);
      next[other.id] = rest;
    }
    next[id] = [combo, ...keys[id].slice(1).filter((k) => k !== combo)];
    return next;
  }
  function resetOne(id, custom = {}) { const next = { ...custom }; delete next[id]; return next; }

  // Which action does this key press run? `where` = 'library' | 'map' | other page.
  // Returns { action, boost } or null. Shift on a "boost" action means 5× steps.
  function match(combo, where, custom = {}) {
    const keys = current(custom);
    const ok = (a) => !a.fixed && (a.scope === 'global' || a.scope === where);
    const pick = (c) => {
      const found = ACTIONS.filter((a) => ok(a) && keys[a.id].includes(c));
      return found.find((a) => a.scope === where) || found[0] || null; // a page's own shortcut wins
    };
    const a = pick(combo);
    if (a) return { action: a, boost: 1 };
    if (combo.includes('Shift+')) {
      const b = pick(combo.replace('Shift+', ''));
      if (b && b.boost) return { action: b, boost: 5 };
    }
    return null;
  }

  const api = { ACTIONS, GROUPS, fromEvent, isModifier, label, current, clash, refuse, assign, resetOne, match };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TFKeys = api;
})(typeof window !== 'undefined' ? window : globalThis);
