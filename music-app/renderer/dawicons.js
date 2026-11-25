'use strict';
// Line icons for the Edit page (drawn for Tonix, simple shapes on a 24 x 24 grid). TFIcon('play') -> <span> with an SVG.
window.TFIcon = (() => {
  const P = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
  start: '<path d="M6 5v14"/><path d="M18 6l-9 6 9 6z" fill="currentColor"/>',
  back: '<path d="M12 6l-7 6 7 6z" fill="currentColor"/><path d="M20 6l-7 6 7 6z" fill="currentColor"/>',
  fwd: '<path d="M4 6l7 6-7 6z" fill="currentColor"/><path d="M12 6l7 6-7 6z" fill="currentColor"/>',
  loop: '<path d="M4 11V9a3 3 0 0 1 3-3h11"/><path d="M15 3l3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H6"/><path d="M9 21l-3-3 3-3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
  cut: '<circle cx="6" cy="17" r="2.6"/><circle cx="6" cy="7" r="2.6"/><path d="M8.2 8.4L20 17"/><path d="M8.2 15.6L20 7"/>',
  keep: '<path d="M6 3v13a2 2 0 0 0 2 2h13"/><path d="M3 6h13a2 2 0 0 1 2 2v13"/>',
  move: '<path d="M3 12h18"/><path d="M7 8l-4 4 4 4"/><path d="M17 8l4 4-4 4"/>',
  select: '<rect x="4" y="5" width="16" height="14" rx="2" stroke-dasharray="3 2.4"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>',
  magnet: '<path d="M6 4v7a6 6 0 0 0 12 0V4"/><path d="M6 8h3M15 8h3"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12" transform="translate(0 -6)"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 0 0 0 12" transform="translate(0 -6)"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  save: '<path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2z"/><path d="M8 3v5h7V3"/><rect x="7.5" y="13" width="9" height="6" rx="1"/>',
  sound: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  trim: '<path d="M4 12h16"/><path d="M8 7v10M16 7v10"/><path d="M4 8v8M20 8v8"/>',
  split: '<path d="M12 3v18" stroke-dasharray="2.5 2.5"/><path d="M3 9h6v6H3zM15 9h6v6h-6z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  fx: '<circle cx="12" cy="12" r="7.5"/><path d="M12 12l3.5-4"/><path d="M12 4.5v1.5M19.5 12H18M4.5 12H6"/>',
  zin: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8 11h6M11 8v6"/>',
  zout: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8 11h6"/>',
  vol: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  rain: '<path d="M7 15a4.5 4.5 0 0 1-.6-9 5.5 5.5 0 0 1 10.6 1.5A3.75 3.75 0 0 1 17.5 15z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.7"/><circle cx="12" cy="16.8" r=".6" fill="currentColor"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  bin: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  dots: '<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/>',
};
  P.search = '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>';
  P.follow = '<path d="M4 12h12"/><path d="M12 7l5 5-5 5"/><path d="M20 5v14"/>';
  P.mixer = '<path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="13" width="4" height="3" rx="1" fill="currentColor"/><rect x="10" y="7" width="4" height="3" rx="1" fill="currentColor"/><rect x="16" y="11" width="4" height="3" rx="1" fill="currentColor"/>';
  P.fade = '<path d="M3 19C9 19 9 5 13 5h8"/>';
  P.loudness = '<path d="M4 15v-6M8 18V6M12 15v-6M16 20V4M20 15v-6"/>';
  P.part = '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M9 7v10M15 7v10" stroke-dasharray="2 2"/>';
  const make = (name, size) => {
    const s = document.createElement('span');
    s.className = 'ic';
    if (size) s.style.cssText = `width:${size}px;height:${size}px`;
    s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
    return s;
  };
  make.has = (name) => !!P[name];
  return make;
})();
