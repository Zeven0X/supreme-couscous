'use strict';
/* global h */
// Star ratings 1-10. A row of 10 stars: click a star to set that many, click the same star again to clear.
// Also the star filter: "6⭐ or more", "exactly 6⭐", "4⭐ or less".
(function (root) {
  // value: 0 / null = no stars. onSet(n) gets 1-10 or 0 (cleared).
  function row(value, onSet, { small = false, title = 'Stars' } = {}) {
    const box = h('div', { class: `stars${small ? ' small' : ''}`, role: 'slider', 'aria-valuemin': 0, 'aria-valuemax': 10, 'aria-valuenow': value || 0, title: value ? `${value} of 10 stars` : `${title}: not rated` });
    const paint = (n) => { [...box.children].forEach((s, i) => s.classList.toggle('on', i < n)); };
    for (let i = 1; i <= 10; i++) {
      const s = h('button', { class: 'star', type: 'button', tabindex: '-1', 'aria-label': `${i} star${i === 1 ? '' : 's'}` }, '★');
      s.addEventListener('mouseenter', () => { box.classList.add('hover'); paint(i); });
      s.addEventListener('click', (e) => { e.stopPropagation(); value = value === i ? 0 : i; paint(value); box.title = value ? `${value} of 10 stars` : `${title}: not rated`; box.setAttribute('aria-valuenow', value); onSet(value); });
      s.addEventListener('dblclick', (e) => e.stopPropagation());
      s.addEventListener('mousedown', (e) => e.stopPropagation());
      box.append(s);
    }
    box.addEventListener('mouseleave', () => { box.classList.remove('hover'); paint(value || 0); });
    paint(value || 0);
    return box;
  }
  // The filter: { n: 1-10, mode: 'more' | 'exact' | 'less' } or null
  function matches(t, f) {
    if (!f || !f.n) return true;
    const s = t.stars || 0;
    if (!s) return false; // songs without stars are hidden while a star filter is on
    return f.mode === 'less' ? s <= f.n : f.mode === 'exact' ? s === f.n : s >= f.n;
  }
  const label = (f) => (f && f.n ? `${f.n}⭐${f.mode === 'less' ? ' or less' : f.mode === 'exact' ? ' exactly' : ' or more'}` : '');
  const api = { row, matches, label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TFStars = api;
})(typeof window !== 'undefined' ? window : globalThis);
