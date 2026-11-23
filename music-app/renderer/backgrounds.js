'use strict';
// The 20 built-in map backgrounds. Each is a small picture tile (made in code) that repeats with no seams:
// anything near a tile edge is also drawn on the opposite side, so the copies meet perfectly.
(function (root) {
  // same random numbers every time, so a background always looks the same
  function rng(seed) { let s = seed % 2147483647 || 1; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
  // draw a shape 9 times (the tile and its 8 neighbours) so it wraps around the edges
  function wrap(W, H, fn) { let o = ''; for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) o += fn(dx, dy); return o; }
  const svg = (W, H, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
  const f = (n) => +n.toFixed(1);
  // smooth line through points (closed = joins back to the start)
  function smooth(P, closed) {
    const n = P.length, at = (i) => P[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    let d = `M${f(P[0][0])} ${f(P[0][1])}`;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d + (closed ? 'Z' : '');
  }

  const list = [];
  const add = (id, name, color, W, H, make) => list.push({ id, name, color, W, H, svg: make ? svg(W, H, ...[].concat(make(W, H))) : null });

  // 1 Dark dots (the default)
  add('dots', 'Dark dots', '#252525', 40, 40, () => '<circle cx="20" cy="20" r="1.4" fill="#3d3d3d"/>');

  // 2 Graph paper
  add('graph', 'Graph paper', '#1f2124', 120, 120, (W) => {
    let o = '';
    for (let i = 0; i < W; i += 20) o += `<path d="M${i} 0V${W}M0 ${i}H${W}" stroke="${i === 0 ? '#3a3f46' : '#2a2d32'}" stroke-width="${i === 0 ? 1.4 : 1}"/>`;
    return o;
  });

  // 3 Old parchment
  add('parchment', 'Old parchment', '#d9c39a', 360, 360, (W, H) => {
    const r = rng(3); let o = '';
    for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, rr = 18 + r() * 60, a = 0.05 + r() * 0.09, c = r() < 0.5 ? '#a8824a' : '#efe0bf';
      o += wrap(W, H, (dx, dy) => `<circle cx="${f(x + dx)}" cy="${f(y + dy)}" r="${f(rr)}" fill="${c}" opacity="${f(a * 100) / 100}" filter="url(#b)"/>`); }
    for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H; o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.6 + r())}" fill="#8a6a3a" opacity=".18"/>`; }
    return [o, '<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>'];
  });

  // 4 Treasure map: parchment with faint grid and dotted trails
  add('treasure', 'Treasure map', '#cfb27c', 400, 400, (W, H) => {
    const r = rng(4); let o = '';
    for (let i = 0; i < 18; i++) { const x = r() * W, y = r() * H, rr = 30 + r() * 70, c = r() < 0.5 ? '#9c7440' : '#ead6a8';
      o += wrap(W, H, (dx, dy) => `<circle cx="${f(x + dx)}" cy="${f(y + dy)}" r="${f(rr)}" fill="${c}" opacity=".12" filter="url(#b)"/>`); }
    for (let i = 0; i <= W; i += 100) o += `<path d="M${i} 0V${H}M0 ${i}H${W}" stroke="#8a6534" stroke-width="1" opacity=".25" stroke-dasharray="2 6"/>`;
    o += wrap(W, H, (dx, dy) => `<path d="M${30 + dx} ${300 + dy}c60-40 90 20 150-30s70-90 150-60" fill="none" stroke="#7a4a1c" stroke-width="2" stroke-dasharray="7 7" opacity=".28"/><path d="M${318 + dx} ${196 + dy}l10 10m0-10-10 10" stroke="#7a2a1c" stroke-width="2.5" opacity=".35"/>`);
    return [o, '<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>'];
  });

  // 5 Night sky
  add('night', 'Night sky', '#0b1022', 300, 300, (W, H) => {
    const r = rng(5); let o = '';
    for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H, s = r(), rr = s < 0.85 ? 0.5 + r() * 0.8 : 1.4 + r(), op = f((0.35 + r() * 0.65) * 100) / 100;
      o += wrap(W, H, (dx, dy) => `<circle cx="${f(x + dx)}" cy="${f(y + dy)}" r="${f(rr)}" fill="#fff" opacity="${op}"/>`); }
    return o;
  });

  // 6 Galaxy
  add('galaxy', 'Galaxy', '#120a24', 420, 420, (W, H) => {
    const r = rng(6); let o = '';
    const cols = ['#6b2fb3', '#2b4fb3', '#b32f8a', '#1f8ab3'];
    for (let i = 0; i < 9; i++) { const x = r() * W, y = r() * H, rr = 60 + r() * 90, c = cols[i % 4];
      o += wrap(W, H, (dx, dy) => `<ellipse cx="${f(x + dx)}" cy="${f(y + dy)}" rx="${f(rr)}" ry="${f(rr * 0.6)}" fill="${c}" opacity=".28" filter="url(#b)"/>`); }
    for (let i = 0; i < 110; i++) { const x = r() * W, y = r() * H, rr = r() < 0.9 ? 0.5 + r() * 0.7 : 1.5 + r(), op = f((0.4 + r() * 0.6) * 100) / 100;
      o += wrap(W, H, (dx, dy) => `<circle cx="${f(x + dx)}" cy="${f(y + dy)}" r="${f(rr)}" fill="#fff" opacity="${op}"/>`); }
    return [o, '<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>'];
  });

  // 7 Deep ocean: soft waves
  add('ocean', 'Deep ocean', '#0d2a40', 160, 60, (W) => {
    let o = '';
    for (const [y, a] of [[15, 0.35], [45, 0.22]]) o += `<path d="M0 ${y}q${W / 4} -10 ${W / 2} 0t${W / 2} 0" fill="none" stroke="#3f88b5" stroke-width="2" opacity="${a}"/>`;
    return o;
  });

  // 8 Tropical sea with little islands
  add('islands', 'Tropical sea', '#1b6f8a', 480, 480, (W, H) => {
    const r = rng(8); let o = '';
    for (let i = 0; i < 5; i++) { const x = r() * W, y = r() * H, s = 22 + r() * 26;
      const blob = (dx, dy) => { let d = ''; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, rr = s * (0.75 + 0.5 * Math.sin(k * 2.3 + i)); d += `${k ? 'L' : 'M'}${f(x + dx + Math.cos(a) * rr)} ${f(y + dy + Math.sin(a) * rr)}`; } return d + 'Z'; };
      o += wrap(W, H, (dx, dy) => `<path d="${blob(dx, dy)}" fill="#7fd6d0" opacity=".35" stroke="#a7ece4" stroke-width="10" stroke-opacity=".12" stroke-linejoin="round"/><path d="${blob(dx, dy)}" fill="#e3cc8a" opacity=".55" transform="translate(${f(x + dx)} ${f(y + dy)}) scale(.62) translate(${f(-(x + dx))} ${f(-(y + dy))})"/>`); }
    for (let i = 0; i < 22; i++) { const x = r() * W, y = r() * H; o += wrap(W, H, (dx, dy) => `<path d="M${f(x + dx)} ${f(y + dy)}q6 -4 12 0t12 0" fill="none" stroke="#bfeef2" stroke-width="1.5" opacity=".25"/>`); }
    return o;
  });

  // 9 Forest: little pine trees from above
  add('forest', 'Forest', '#16281a', 300, 300, (W, H) => {
    const r = rng(9); let o = '';
    for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, s = 9 + r() * 9, c = r() < 0.5 ? '#24452a' : '#2c5533';
      o += wrap(W, H, (dx, dy) => `<path d="M${f(x + dx)} ${f(y + dy - s * 1.6)}l${f(s)} ${f(s * 1.4)}h${f(-s * 0.55)}l${f(s * 0.75)} ${f(s * 1.1)}h${f(-s * 2.4)}l${f(s * 0.75)} ${f(-s * 1.1)}h${f(-s * 0.55)}Z" fill="${c}"/>`); }
    return o;
  });

  // 10 Topographic contour lines: one hill in each quarter, soft wobbly rings
  add('topo', 'Mountains (contour lines)', '#1e2420', 400, 400, (W, H) => {
    const r = rng(10); let o = '';
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * 200 + 60 + r() * 80, y = Math.floor(i / 2) * 200 + 60 + r() * 80, ph = r() * 6, rot = r() * Math.PI;
      for (let k = 1; k <= 6; k++) {
        const P = [];
        for (let j = 0; j < 12; j++) {
          const a = (j / 12) * Math.PI * 2, rad = k * 15 * (1 + 0.18 * Math.sin(a * 3 + ph + k * 0.4));
          const ex = Math.cos(a) * rad * 1.3, ey = Math.sin(a) * rad;
          P.push([x + ex * Math.cos(rot) - ey * Math.sin(rot), y + ex * Math.sin(rot) + ey * Math.cos(rot)]);
        }
        const d = smooth(P, true);
        o += wrap(W, H, (dx, dy) => `<path d="${d}" transform="translate(${dx} ${dy})" fill="none" stroke="#5f7a5a" stroke-width="${k === 4 ? 1.6 : 1}" opacity=".45"/>`);
      }
    }
    return o;
  });

  // 11 Neon grid (synthwave)
  add('neon', 'Neon grid', '#160b24', 80, 80, (W) => `<path d="M0 0H${W}M0 0V${W}" stroke="#d63ad6" stroke-width="2" opacity=".5"/><path d="M0 0H${W}M0 0V${W}" stroke="#ff7af0" stroke-width="6" opacity=".08"/>`);

  // 12 Circuit board
  add('circuit', 'Circuit board', '#0e1f18', 200, 200, (W, H) => {
    const lines = [[10, 30, 90, 30, 120, 60, 190, 60], [30, 100, 30, 150, 70, 190], [100, 120, 150, 120, 150, 170], [160, 10, 160, 40], [60, 70, 100, 70]];
    let o = '';
    for (const l of lines) { let d = `M${l[0]} ${l[1]}`; for (let i = 2; i < l.length; i += 2) d += `L${l[i]} ${l[i + 1]}`;
      o += `<path d="${d}" fill="none" stroke="#2f8a5c" stroke-width="2" opacity=".55"/><circle cx="${l[0]}" cy="${l[1]}" r="3.5" fill="none" stroke="#3fb57a" stroke-width="2" opacity=".6"/><circle cx="${l[l.length - 2]}" cy="${l[l.length - 1]}" r="3.5" fill="#3fb57a" opacity=".6"/>`; }
    return o;
  });

  // 13 Desert dunes
  add('desert', 'Desert dunes', '#c98a4b', 240, 120, (W) => {
    let o = '';
    for (const [y, c, a] of [[30, '#e0a868', 0.5], [70, '#a86a34', 0.35], [105, '#e0a868', 0.35]]) o += `<path d="M0 ${y}c${W / 6} -26 ${W / 3} -26 ${W / 2} 0s${W / 3} 26 ${W / 2} 0" fill="none" stroke="${c}" stroke-width="3" opacity="${a}"/>`;
    return o;
  });

  // 14 Snow field
  add('snow', 'Snow field', '#cfe0ec', 260, 260, (W, H) => {
    const r = rng(14); let o = '';
    for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, s = 3 + r() * 5;
      o += wrap(W, H, (dx, dy) => { let d = ''; for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; d += `M${f(x + dx - Math.cos(a) * s)} ${f(y + dy - Math.sin(a) * s)}L${f(x + dx + Math.cos(a) * s)} ${f(y + dy + Math.sin(a) * s)}`; } return `<path d="${d}" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>`; }); }
    return o;
  });

  // 15 Lava: soft glowing cracks
  add('lava', 'Lava', '#1c0b08', 360, 360, (W, H) => {
    const r = rng(15); let o = '';
    for (let i = 0; i < 9; i++) {
      let x = (i % 3) * 120 + r() * 100, y = Math.floor(i / 3) * 120 + r() * 100, a = r() * Math.PI * 2;
      const P = [[x, y]];
      for (let k = 0; k < 5; k++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * 26; y += Math.sin(a) * 26; P.push([x, y]); }
      const d = smooth(P, false);
      o += wrap(W, H, (dx, dy) => `<g transform="translate(${dx} ${dy})" fill="none" stroke-linecap="round"><path d="${d}" stroke="#ff7a2a" stroke-width="12" opacity=".08"/><path d="${d}" stroke="#ff5a1f" stroke-width="3" opacity=".5"/><path d="${d}" stroke="#ffc070" stroke-width="1" opacity=".5"/></g>`);
    }
    return o;
  });

  // 16 Blueprint
  add('blueprint', 'Blueprint', '#173a6b', 100, 100, (W) => {
    let o = '';
    for (let i = 0; i < W; i += 20) o += `<path d="M${i} 0V${W}M0 ${i}H${W}" stroke="#7fa8dc" stroke-width="${i === 0 ? 1.2 : 0.6}" opacity="${i === 0 ? 0.55 : 0.3}"/>`;
    return o;
  });

  // 17 Chalkboard
  add('chalk', 'Chalkboard', '#22352b', 360, 360, (W, H) => {
    const r = rng(17); let o = '';
    for (let i = 0; i < 14; i++) { const x = r() * W, y = r() * H, w = 60 + r() * 120, rot = f(r() * 40 - 20), hh = 14 + r() * 20;
      o += wrap(W, H, (dx, dy) => `<rect x="${f(x + dx)}" y="${f(y + dy)}" width="${f(w)}" height="${f(hh)}" transform="rotate(${rot} ${f(x + dx)} ${f(y + dy)})" fill="#e8efe8" opacity=".05" filter="url(#b)"/>`); }
    return [o, '<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>'];
  });

  // 18 Sheet music: staff lines with a few faint notes
  add('sheet', 'Sheet music', '#efe9dc', 300, 140, (W) => {
    let o = '';
    for (let k = 0; k < 5; k++) o += `<path d="M0 ${30 + k * 10}H${W}" stroke="#7d7466" stroke-width="1" opacity=".45"/>`;
    for (const [x, y] of [[40, 65], [100, 50], [160, 60], [230, 45]]) o += `<ellipse cx="${x}" cy="${y}" rx="6" ry="4.5" transform="rotate(-20 ${x} ${y})" fill="#7d7466" opacity=".35"/><path d="M${x + 5.5} ${y - 1}V${y - 30}" stroke="#7d7466" stroke-width="1.4" opacity=".35"/>`;
    return o;
  });

  // 19 Vinyl records
  add('vinyl', 'Vinyl records', '#141414', 180, 180, () => {
    let o = '';
    for (let k = 0; k < 7; k++) o += `<circle cx="90" cy="90" r="${78 - k * 9}" fill="none" stroke="#2b2b2b" stroke-width="${k === 0 ? 2.5 : 1.2}"/>`;
    o += '<circle cx="90" cy="90" r="16" fill="#6b2a1c" opacity=".55"/><circle cx="90" cy="90" r="2.5" fill="#141414"/>';
    return o;
  });

  // 20 Honeycomb
  add('honey', 'Honeycomb', '#2a2010', 60, 104, () => {
    const hex = (cx, cy) => { let d = ''; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; d += `${k ? 'L' : 'M'}${f(cx + Math.cos(a) * 34)} ${f(cy + Math.sin(a) * 34)}`; } return d + 'Z'; };
    let o = '';
    for (const [x, y] of [[0, 0], [60, 0], [30, 52], [0, 104], [60, 104]]) o += `<path d="${hex(x, y)}" fill="none" stroke="#c98f2a" stroke-width="2" opacity=".35"/>`;
    return o;
  });

  // Which backgrounds are light (songs' names get a darker shadow on these).
  const LIGHT = new Set(['parchment', 'treasure', 'desert', 'snow', 'sheet']);
  for (const b of list) {
    b.light = LIGHT.has(b.id);
    b.url = b.svg ? `url('data:image/svg+xml,${encodeURIComponent(b.svg)}')` : 'none';
  }
  const api = { list, byId: (id) => list.find((b) => b.id === id) || list[0] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TFBackgrounds = api;
})(typeof window !== 'undefined' ? window : globalThis);
