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
  // Map: torn page with a loop trail to an X (cut out, so it works in any color).
  const PAPER = 'M9.36 7.54Q9.00 3.28 10.94 3.63Q12.88 3.97 14.29 4.50Q15.70 5.03 17.35 4.55Q19.00 4.07 20.81 4.58Q22.62 5.09 24.28 5.01Q25.94 4.92 27.67 5.08Q29.39 5.24 30.82 4.71Q32.26 4.18 34.04 4.57Q35.82 4.96 37.41 4.94Q39.00 4.92 39.42 6.46Q39.84 8.00 39.05 10.81Q38.25 13.61 39.05 16.13Q39.85 18.64 39.57 21.33Q39.29 24.02 39.56 26.60Q39.82 29.17 39.28 32.08Q38.74 34.99 39.21 37.32Q39.67 39.66 39.34 41.17Q39.00 42.69 37.53 43.02Q36.05 43.35 34.58 43.96Q33.11 44.57 31.44 44.32Q29.78 44.07 27.87 43.27Q25.96 42.46 24.50 43.06Q23.05 43.67 21.42 43.50Q19.78 43.33 18.39 43.92Q17.00 44.50 15.70 43.85Q14.41 43.20 11.71 43.56Q9.00 43.91 9.01 41.96Q9.03 40.00 8.92 37.83Q8.81 35.67 8.77 33.39Q8.73 31.10 8.70 28.68Q8.67 26.25 8.95 23.72Q9.23 21.19 9.52 18.96Q9.81 16.72 9.77 14.27Q9.73 11.81 9.36 7.54Z';
  I.map = `<svg viewBox="0 0 48 48"><defs><mask id="tf-map-mask"><rect width="48" height="48" fill="#fff"/>
    <path d="M14 40C18 37 25 37.5 27.5 33C30.5 27.5 27 21 21.5 22S15.5 30.5 21.5 31.5S30.5 24 30 15.5" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="2.6 2.8" fill="none"/>
    <path d="M30 8.5l5 5M35 8.5l-5 5" stroke="#000" stroke-width="2.8" stroke-linecap="round"/></mask></defs>
    <path d="${PAPER}" fill="currentColor" mask="url(#tf-map-mask)"/></svg>`;
  I.plus = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  I.flag = '<svg viewBox="0 0 24 24"><path d="M6 21V3.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path fill="currentColor" d="M7 4c3-1.6 5.5 1.4 8.5 0S19 3 19 3v9s-1.5 1.2-3.5 1.6c-3 .6-5.5-2.2-8.5-.6Z"/></svg>';
  I.trash = '<svg viewBox="0 0 24 24"><path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  I.fit = '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  I.path = '<svg viewBox="0 0 24 24"><circle cx="5" cy="18" r="2.6" fill="currentColor"/><circle cx="19" cy="6" r="2.6" fill="currentColor"/><path d="M7 16.5C12 15 9 9 16.6 7.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13.8 5.2l3.4 1.9-1.6 3.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  I.image = '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="9.5" r="1.8" fill="currentColor"/><path d="M4 18l5.5-5.5 4 4 2.5-2.5 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  I.reset = '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><path d="M4 3.5v4.8h4.8" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  I.speaker = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  window.ICONS = I;
})();
