'use strict';
// Shapes of hand-drawn paths.
// A drawn path is a few points. They are stored relative to the two songs it connects
// (how far along the line from A to B, and how far sideways), so when a song is moved
// the whole drawing stretches and turns with it. A loop stores plain offsets from its song.
(function (root) {
  const isLoop = (a, b) => a === b || (a.x === b.x && a.y === b.y);

  function toNorm(a, b, p) {
    if (isLoop(a, b)) return [p[0] - a.x, p[1] - a.y];
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const rx = p[0] - a.x, ry = p[1] - a.y;
    return [(rx * dx + ry * dy) / l2, (rx * -dy + ry * dx) / l2];
  }
  function fromNorm(a, b, q) {
    if (isLoop(a, b)) return [a.x + q[0], a.y + q[1]];
    const dx = b.x - a.x, dy = b.y - a.y;
    return [a.x + q[0] * dx + q[1] * -dy, a.y + q[0] * dy + q[1] * dx];
  }

  // Keep only the points that matter (Ramer-Douglas-Peucker): a shaky hand-drawn line
  // with hundreds of points becomes a handful of corner points.
  function simplify(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [s, e] = stack.pop();
      const ax = pts[s][0], ay = pts[s][1], bx = pts[e][0], by = pts[e][1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      let worst = -1, far = eps;
      for (let i = s + 1; i < e; i++) {
        const d = len ? Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
        if (d > far) { far = d; worst = i; }
      }
      if (worst > 0) { keep[worst] = true; stack.push([s, worst], [worst, e]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  // Simplify until there are at most `max` points.
  function simplifyTo(pts, eps, max) {
    let out = simplify(pts, eps);
    for (let k = 0; out.length > max && k < 20; k++) { eps *= 1.4; out = simplify(pts, eps); }
    return out;
  }

  // A smooth curve that passes through every point (Catmull-Rom spline as SVG path text).
  function spline(P) {
    let d = `M${P[0][0]} ${P[0][1]}`;
    let lastC2 = P[Math.max(0, P.length - 2)];
    const mids = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
      mids.push([(p1[0] + 3 * c1[0] + 3 * c2[0] + p2[0]) / 8, (p1[1] + 3 * c1[1] + 3 * c2[1] + p2[1]) / 8]);
      lastC2 = c2;
    }
    return { d, lastC2, mids };
  }

  const api = { toNorm, fromNorm, simplify, simplifyTo, spline };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TFShape = api;
})(typeof window !== 'undefined' ? window : globalThis);
