// Hand-drawn SVG icons (no icon font, works offline).
(function () {
  function gear() {
    // 8-tooth gear outline with a steering-wheel style middle (like the mockup).
    const teeth = 8, rO = 11, rI = 8.6, cx = 12, cy = 12;
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const s = Math.PI / teeth;
      const pts = [[rI, a - s * 0.95], [rO, a - s * 0.5], [rO, a + s * 0.5], [rI, a + s * 0.95]];
      pts.forEach(([r, t], j) => {
        d += `${i === 0 && j === 0 ? 'M' : 'L'}${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
      });
    }
    d += 'Z';
    const ring = 'M12 5.6a6.4 6.4 0 1 0 0 12.8a6.4 6.4 0 1 0 0-12.8Z';
    return `<svg viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="${d}${ring}"/>
      <path fill="currentColor" d="M12 9.6a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0-4.8Z M10.9 6h2.2v4h-2.2Z M5.9 15.2l3.5-2 1.1 1.9-3.5 2Z M18.1 15.2l-3.5-2-1.1 1.9 3.5 2Z"/></svg>`;
  }

  const I = {
    search: '<svg viewBox="0 0 24 24"><circle cx="9.5" cy="9.5" r="6.3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M14.2 14.2 21 21" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>',
    // Torn page (jagged edges, like the mockup)
    page: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5.2 1.6 7 2.3l1.9-.6 2 .6 1.9-.5 2 .6 1.9-.6 1.8.5-.4 1.6.6 1.7-.5 1.8.5 1.9-.6 1.8.6 1.9-.5 1.8.5 1.8-.6 1.9.5 1.7-1.9.6-1.9-.5-2 .5-1.9-.6-2 .6-1.9-.5-1.8.6.4-1.8-.5-1.8.6-1.9-.5-1.8.5-1.9-.6-1.8.5-1.9-.5-1.8.6-1.8-.6-1.7Z"/></svg>',
    // Caliper (drawn upright, turned 45 degrees)
    caliper: '<svg viewBox="0 0 24 24"><g fill="currentColor" transform="rotate(-45 12 12)"><path d="M10.6 3h2.8v18.2a1.4 1.4 0 0 1-2.8 0Z"/><path d="M2.6 1.6h10.8v2.6H6.4L2.6 3.2Z"/><path d="M9.4 6.2h5.4v4.6H9.4Z"/><path d="M3.6 7h6.2v2.2H6.8Z"/><rect x="11.3" y="12" width="1.4" height="7" rx=".7" fill="#000"/></g></svg>',
    gear: gear(),
    cloudUp: '<svg viewBox="0 0 32 32"><path d="M9 25H8a6 6 0 0 1-.6-12A8 8 0 0 1 23 10.6 6.5 6.5 0 0 1 24.5 25H23" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 29V16m-5 5 5-5 5 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    folderUp: '<svg viewBox="0 0 32 32"><path fill="currentColor" d="M3 7.5A2.5 2.5 0 0 1 5.5 5h7l3 3h11A2.5 2.5 0 0 1 29 10.5v14a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 3 24.5Z"/><g fill="none" stroke="#2a2a2a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.4 23.4h-1a3.6 3.6 0 0 1-.3-7.2 4.8 4.8 0 0 1 9.3-1.4 3.9 3.9 0 0 1 .6 7.8h-1.2"/><path d="M16 25.4v-6.4m-2.7 2.7 2.7-2.7 2.7 2.7"/></g></svg>',
    save: '<svg viewBox="0 0 32 32"><path d="M5 7a2 2 0 0 1 2-2h15.5L27 9.5V25a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M10 5.5v6h11v-6M10 27v-8h12v8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
    saveMany: '<svg viewBox="0 0 32 32"><path fill="currentColor" d="M3 7.5A2.5 2.5 0 0 1 5.5 5h7l3 3h11A2.5 2.5 0 0 1 29 10.5v14a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 3 24.5Z"/><g fill="none" stroke="#2a2a2a" stroke-width="1.7" stroke-linejoin="round"><path d="M10.5 12.5a1 1 0 0 1 1-1h7.6l2.4 2.4v9.6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z"/><path d="M13 11.7v3h5v-3M13 24.3v-4h6v4"/></g></svg>',
    zoomIn: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15 15 6 6M7 10h6M10 7v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    zoomOut: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15 15 6 6M7 10h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    back30: '<svg viewBox="0 0 60 30"><path fill="currentColor" d="M2 15 20 3v24Zm17 0L37 3v24Zm17 0L54 3v24Z"/></svg>',
    back5: '<svg viewBox="0 0 44 30"><path fill="currentColor" d="M3 15 21 3v24Zm18 0L39 3v24Z"/></svg>',
    fwd5: '<svg viewBox="0 0 44 30"><path fill="currentColor" d="M41 15 23 3v24Zm-18 0L5 3v24Z"/></svg>',
    fwd30: '<svg viewBox="0 0 60 30"><path fill="currentColor" d="M58 15 40 3v24Zm-17 0L23 3v24Zm-17 0L6 3v24Z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 4.5v15l12-7.5Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6.5 4.5h4v15h-4Zm7 0h4v15h-4Z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 18.5a3 3 0 1 1-2-2.83V5l12-2v12.5a3 3 0 1 1-2-2.83V7.1L9 8.5Z"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  window.ICONS = I;
})();
