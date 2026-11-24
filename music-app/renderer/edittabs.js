'use strict';
/* global S, h, tf, guard, toast, coverEl, fmtTime, modal, upsertTrack, renderGrid, TFEdit, TFPlaylists */
// The bottom panels of the Edit page: Trim, Split, Loop, Smart connect (Effects live in edit.js).
// Each panel sits under the tracks, may draw on the song track, and may take the mouse there.
window.TFEditTabs = (() => {
  const A = () => TFEdit.api;
  const sid = () => A().session.id;
  const dur = () => A().session.duration;
  const fresh = () => ({
    trim: { level: 'quiet', res: null, loading: false },
    split: { cuts: [], gap: 1.2, set: {}, found: null },
    loop: { times: 2 },
    connect: { piece: null, at: null, blend: 'smooth', after: 'continue', snap: true },
  });
  let T = fresh();
  let sounds = null;
  const seg = (items, value, onPick, cls = '') => h('div', { class: `seg ${cls}` }, ...items.map(([v, l, tip]) => h('button', { class: v === value ? 'on' : '', title: tip || '', onclick: () => onPick(v) }, l)));
  const num = (value, onSet, { min = 0, max = 999, step = 1, w = 64, title = '' } = {}) => {
    const i = h('input', { class: 'ed-num', value: String(value), title, style: { width: `${w}px` } });
    const go = () => { const v = parseFloat(i.value.replace(',', '.')); if (Number.isFinite(v)) onSet(Math.min(max, Math.max(min, Math.round(v / step) * step))); };
    i.addEventListener('change', go);
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { go(); i.blur(); } });
    return i;
  };
  const btn = (label, onclick, { cls = 'tb', title = '', disabled = false } = {}) => h('button', { class: cls, title, disabled, onclick }, label);
  const row = (...kids) => h('div', { class: 'ed-row' }, ...kids);
  const note = (text, cls = '') => h('div', { class: `ed-note ${cls}` }, text);
  const timeText = (t) => A().fmt(t);

  // ================= Trim =================
  async function trimFind() {
    const P = T.trim, ver = A().session.version, id = sid();
    P.loading = true; P.res = null; P.failed = false;
    const r = await guard(() => tf.editTrimFind(id, P.level), 'Trim: ');
    if (T.trim !== P || !A().session || A().session.id !== id || A().session.version !== ver) return; // the song changed meanwhile
    P.loading = false; P.res = r || null; P.failed = !r; // a failure is shown once, with a Try again button
    A().render();
  }
  function trimPanel() {
    const P = T.trim;
    if (!P.res && !P.loading && !P.failed) setTimeout(trimFind);
    const r = P.res;
    if (P.failed) return h('div', {}, row(h('b', {}, 'Trim'), note('Could not look for silent parts.')), row(btn('Try again', trimFind, { cls: 'tb pri' })));
    const has = r && !r.empty && (r.head > 0.02 || r.tail < r.duration - 0.02);
    const text = !r ? 'Looking for silent parts…' : r.empty ? 'The whole song is quieter than this level, so nothing is trimmed. Try "Very quiet".'
      : !has ? 'No silent start or end found at this level.' : `Silent start: ${r.head.toFixed(2)} s · Silent end: ${(r.duration - r.tail).toFixed(2)} s · shown in red on the song track`;
    return h('div', {},
      row(h('b', {}, 'Trim'), note('Finds the silent bits at the very start and end of the song. Check the red parts, then Confirm.')),
      row(h('span', { class: 'ed-l' }, 'What counts as silent'),
        seg([['veryquiet', 'Very quiet', 'Only near-total silence'], ['quiet', 'Quiet', 'Silence and soft hiss'], ['bitquiet', 'A bit quiet', 'Also quiet intros / endings']], P.level, (v) => { P.level = v; trimFind(); })),
      row(note(text, has ? 'ok' : '')),
      row(btn('▶ Listen to the result', () => A().preview({ type: 'trim', head: r.head, tail: r.tail }, { from: 0, label: 'Trimmed' }), { disabled: !has }),
        btn('✓ Confirm: remove them', () => A().change(() => tf.editDo(sid(), { type: 'trim', head: r.head, tail: r.tail }), 'Trimming…'), { cls: 'tb pri', disabled: !has })));
  }

  // ================= Split =================
  const bounds = () => [0, ...T.split.cuts.slice().sort((a, b) => a - b), dur()];
  function parts() {
    const b = bounds(), t = A().track();
    return b.slice(0, -1).map((a, i) => {
      const s = T.split.set[i] || {};
      return { a, b: b[i + 1], name: s.name ?? `${t ? t.title : 'Song'} - Part ${i + 1}`, fx: { speed: s.speed ?? 100, pitch: s.pitch ?? 100, volume: s.volume ?? 100 } };
    });
  }
  async function splitFind() {
    const cuts = await guard(() => tf.editSplitFind(sid(), T.split.gap), 'Split: ');
    if (!cuts) return;
    T.split.cuts = cuts; T.split.set = {}; T.split.found = cuts.length;
    toast(cuts.length ? `Found ${cuts.length + 1} songs. Check the orange lines; drag them to move a cut.` : 'No quiet gaps found between songs. Add cuts by hand, or try "Short gaps".', { ms: 4500 });
    A().render();
  }
  function splitPanel() {
    const P = T.split, list = parts();
    const set = (i, k, v) => { P.set[i] = { ...(P.set[i] || {}), [k]: v }; };
    const rows = list.map((p, i) => h('div', { class: 'ed-part' },
      h('span', { class: 'n' }, i + 1),
      (() => { const inp = h('input', { class: 'ed-pname', value: p.name, spellcheck: 'false' }); inp.addEventListener('change', () => set(i, 'name', inp.value.trim())); return inp; })(),
      h('span', { class: 'ed-pt' }, `${timeText(p.a)} – ${timeText(p.b)}`, h('small', {}, ` (${fmtTime(p.b - p.a)})`)),
      h('label', { class: 'ed-mini', title: 'Speed %' }, 'Speed', num(p.fx.speed, (v) => set(i, 'speed', v), { min: 25, max: 400, w: 52 })),
      h('label', { class: 'ed-mini', title: 'Pitch %' }, 'Pitch', num(p.fx.pitch, (v) => set(i, 'pitch', v), { min: 50, max: 200, w: 52 })),
      h('label', { class: 'ed-mini', title: 'Volume %' }, 'Volume', num(p.fx.volume, (v) => set(i, 'volume', v), { min: 0, max: 500, step: 0.1, w: 58 })),
      btn('▶', () => A().playRange(p.a, p.b), { title: 'Play this part' }),
      i < list.length - 1 ? btn('✕', () => { P.cuts = P.cuts.filter((c) => Math.abs(c - p.b) > 1e-6); P.set = {}; A().render(); }, { title: 'Remove the cut after this part (join it with the next)' }) : h('span')));
    return h('div', {},
      row(h('b', {}, 'Split'), note('Cuts one long file into separate songs. Each part can have its own speed, pitch and volume, and is saved as its own song.')),
      row(btn('🔍 Find the songs', splitFind, { cls: 'tb pri' }),
        seg([[0.6, 'Short gaps'], [1.2, 'Normal'], [2.5, 'Long gaps']], P.gap, (v) => { P.gap = v; A().render(); }),
        btn('+ Add a cut at the playhead', () => { const t = A().player.currentTime; if (t < 0.3 || t > dur() - 0.3 || P.cuts.some((c) => Math.abs(c - t) < 0.3)) return toast('Move the playhead to where the cut should be (not right next to another cut).'); P.cuts.push(+t.toFixed(3)); P.set = {}; A().render(); }),
        note('Drag the orange lines on the song track to move a cut.')),
      h('div', { class: 'ed-parts' }, ...rows),
      row(btn('🔊 Same loudness', async () => {
        const vols = await guard(() => tf.editLoudness(sid(), list.map((p) => [p.a, p.b])), 'Same loudness: ');
        if (!vols) return;
        vols.forEach((v, i) => set(i, 'volume', v));
        toast('Volumes set so every part sounds equally loud.', { type: 'ok' });
        A().render();
      }, { title: 'Measure how loud each part is and set the volumes so they all sound the same', disabled: list.length < 2 }),
      h('span', { class: 'grow' }),
      btn(`💾 Save all ${list.length} parts as songs`, async () => {
        if (list.length < 2) return toast('Add at least one cut first (Find the songs, or Add a cut).');
        A().busy('Saving the parts…');
        const r = await guard(() => tf.editSplitSave(sid(), list), 'Split: ');
        A().busy(null);
        if (!r) return;
        for (const t of r.added) upsertTrack(t);
        renderGrid(); TFPlaylists.render();
        toast(`Saved ${r.added.length} songs next to the original. They are in your library too.`, { type: 'ok', action: () => tf.showItem(r.added[0].srcPath), actionLabel: 'Show', ms: 8000 });
      }, { cls: 'tb pri', disabled: list.length < 2 })));
  }

  // ================= Loop =================
  function loopPanel() {
    const P = T.loop, sel = A().sel;
    if (!sel) {
      return h('div', {}, row(h('b', {}, 'Loop'), note('Repeat a part of the song.')),
        row(note('1. Drag across the song track to select the part to repeat: its start is A, its end is B.', 'big')));
    }
    const len = (x) => x.b - x.a;
    const newLen = dur() + len(sel) * (P.times - 1);
    return h('div', {},
      row(h('b', {}, 'Loop'), note(`A = ${timeText(sel.a)} · B = ${timeText(sel.b)} · the part is ${len(sel).toFixed(2)} s`)),
      row(btn('✨ Smart loop', async () => {
        const r = await guard(() => tf.editSmartLoop(sid(), sel.a, sel.b), 'Smart loop: ');
        if (!r) return;
        const da = r.a - sel.a, db = r.b - sel.b;
        A().sel = { a: r.a, b: r.b };
        const moved = (n, x) => (Math.abs(x) < 0.0005 ? `${n} stays put` : `${n} moved ${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(3)} s`);
        toast(`${moved('A', da)}, ${moved('B', db)}, so the end joins the start smoothly.`, { type: 'ok', ms: 5000 });
        A().render();
      }, { cls: 'tb pri', title: 'Move A and B a tiny bit so the end flows into the start without a bump' }),
        h('span', { class: 'ed-l' }, 'Play it'),
        btn('−', () => { P.times = Math.max(2, P.times - 1); A().render(); }),
        num(P.times, (v) => { P.times = v; A().render(); }, { min: 2, max: 100, w: 46 }),
        btn('+', () => { P.times = Math.min(100, P.times + 1); A().render(); }),
        h('span', { class: 'ed-l' }, 'times'),
        note(`New length: ${fmtTime(newLen)} (now ${fmtTime(dur())})`, 'ok')),
      row(btn('▶ Listen to the join', () => A().preview({ type: 'loop', a: sel.a, b: sel.b, times: 2 }, { from: Math.max(0, sel.b - 2.5), label: 'Loop join' }), { title: 'Plays the moment where B jumps back to A' }),
        btn('✓ Apply loop', () => A().change(() => tf.editDo(sid(), { type: 'loop', a: sel.a, b: sel.b, times: P.times }), 'Making the loop…'), { cls: 'tb pri' })));
  }

  // ================= pickers (used by the track buttons on the Edit page) =================
  function pickSong(title, onPick) {
    return modal((box, close) => {
      box.style.width = 'min(520px, 94vw)';
      const q = h('input', { placeholder: 'Search your songs…', spellcheck: 'false', autofocus: true });
      const list = h('div', { class: 'pl-pick' });
      const fill = () => {
        list.innerHTML = '';
        const n = q.value.trim().toLowerCase();
        for (const t of S.tracks.filter((x) => !n || `${x.title} ${x.artist}`.toLowerCase().includes(n)).slice(0, 200)) {
          list.append(h('button', { class: 'pl-pick-row', onclick: () => { close(); onPick(t); } }, h('div', { class: 'pl-mini' }, coverEl(t)), h('span', { class: 't' }, t.title), h('span', { class: 'muted' }, fmtTime(t.duration))));
        }
        if (!list.childElementCount) list.append(h('p', { class: 'muted' }, 'No song matches.'));
      };
      q.addEventListener('input', fill); fill();
      box.append(h('h2', {}, title), q, list, h('div', { class: 'foot' }, h('span'), h('button', { class: 'btn', onclick: () => close() }, 'Cancel')));
    });
  }
  async function pickSound(onPick) {
    if (!sounds) sounds = await guard(() => tf.editSounds());
    if (!sounds) return;
    return modal((box, close) => {
      box.style.width = 'min(420px, 94vw)';
      box.append(h('h2', {}, 'Add a built-in sound'), h('p', { class: 'muted' }, 'Made by Tonix (no copied sounds). They repeat until the song ends; change that on the left when the track is selected.'),
        h('div', { class: 'pl-pick' }, ...sounds.map((s) => h('button', { class: 'pl-pick-row', onclick: () => { close(); onPick(s.key); } }, h('span', { class: 't' }, s.name)))),
        h('div', { class: 'foot' }, h('span'), h('button', { class: 'btn', onclick: () => close() }, 'Cancel')));
    });
  }

  function connectPanel() {
    const C = T.connect, sel = A().sel;
    const pieceText = C.piece ? `${C.piece.name}: ${timeText(C.piece.a)} – ${timeText(C.piece.b)} (${(C.piece.b - C.piece.a).toFixed(1)} s)` : 'no piece yet';
    const at = C.at ?? null;
    const ok = C.piece && at !== null;
    const op = () => ({ type: 'connect', src: C.piece.src, a: C.piece.a, b: C.piece.b, P: at, blend: C.blend, after: C.after, snap: C.snap });
    return h('div', {},
      row(h('b', {}, 'Smart connect'), note('Join a piece of a song to another place. Tonix lands the cuts on the beat and blends the joins.')),
      row(h('span', { class: 'ed-l' }, '1. The piece'),
        btn('Use the selection', () => { if (!sel) return toast('Select a part first: drag across the song track.'); const t = A().track(); C.piece = { src: { kind: 'track', id: A().session.trackId }, a: sel.a, b: sel.b, name: t ? t.title : 'This song' }; A().render(); }),
        btn('From another song…', () => pickSong('Take a piece from…', (t) => modal((box, close) => {
          box.style.width = 'min(420px, 94vw)';
          const a = num(0, () => {}, { max: t.duration, step: 0.01, w: 80 }), b = num(Math.min(30, t.duration).toFixed(2), () => {}, { max: t.duration, step: 0.01, w: 80 });
          box.append(h('h2', {}, `A piece of "${t.title}"`), h('p', { class: 'muted' }, `The song is ${fmtTime(t.duration)} long. Type the start and end in seconds.`),
            row(h('label', { class: 'ed-mini' }, 'From', a), h('label', { class: 'ed-mini' }, 'To', b)),
            h('div', { class: 'foot' }, h('span'), h('button', { class: 'btn', onclick: () => close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => {
              const x = parseFloat(a.value), y = parseFloat(b.value);
              if (!(y - x >= 0.2)) return toast('The end must be after the start.');
              C.piece = { src: { kind: 'track', id: t.id }, a: x, b: Math.min(y, t.duration), name: t.title }; close(); A().render();
            } }, 'Use this piece')));
        }))),
        note(pieceText, C.piece ? 'ok' : '')),
      row(h('span', { class: 'ed-l' }, '2. Where it goes'),
        btn('Use the playhead', () => { C.at = +A().player.currentTime.toFixed(3); A().render(); }, { title: 'Move the playhead (click the song track) to the spot first' }),
        note(at === null ? 'not chosen yet' : `at ${timeText(at)}`, at === null ? '' : 'ok')),
      row(h('span', { class: 'ed-l' }, '3. How'),
        seg([['hard', 'Hard cut'], ['smooth', 'Smooth'], ['long', 'Long blend']], C.blend, (v) => { C.blend = v; A().render(); }),
        seg([['continue', 'Then the song goes on'], ['end', 'The song ends there']], C.after, (v) => { C.after = v; A().render(); }),
        h('label', { class: 'ed-check' }, (() => { const c = h('input', { type: 'checkbox', checked: C.snap }); c.addEventListener('change', () => { C.snap = c.checked; }); return c; })(), 'Land on the beat')),
      row(btn('▶ Preview', () => A().preview(op(), { from: Math.max(0, at - 3), label: 'Smart connect' }), { disabled: !ok }),
        btn('✓ Connect', () => A().change(() => tf.editDo(sid(), op()), 'Connecting…'), { cls: 'tb pri', disabled: !ok })));
  }

  // ================= song track: drawing + mouse =================
  function overlay(g, o) {
    const { dpr, Hd, ruler, xAt, tab } = o;
    if (tab === 'trim' && T.trim.res && !T.trim.res.empty) {
      g.fillStyle = 'rgba(255,80,80,.28)';
      g.fillRect(0, ruler, xAt(T.trim.res.head) * dpr, Hd - ruler);
      const x = xAt(T.trim.res.tail) * dpr; g.fillRect(x, ruler, (xAt(o.duration) * dpr) - x, Hd - ruler);
    }
    if (tab === 'split') {
      const b = bounds();
      g.font = `bold ${12 * dpr}px system-ui`;
      b.slice(0, -1).forEach((a, i) => { g.fillStyle = 'rgba(255,170,60,.9)'; g.fillText(String(i + 1), xAt((a + b[i + 1]) / 2) * dpr - 4 * dpr, ruler + 16 * dpr); });
      for (const c of T.split.cuts) { const x = xAt(c) * dpr; g.fillStyle = '#ffaa3c'; g.fillRect(x - dpr, ruler, 3 * dpr, Hd - ruler); g.fillRect(x - 5 * dpr, ruler, 11 * dpr, 6 * dpr); }
    }
    if (tab === 'loop' && A().sel) {
      const s = A().sel;
      g.fillStyle = 'rgba(92,242,168,.9)'; g.font = `bold ${13 * dpr}px system-ui`;
      g.fillText(`A`, xAt(s.a) * dpr + 4 * dpr, ruler + 16 * dpr); g.fillText(`B  ×${T.loop.times}`, xAt(s.b) * dpr - 48 * dpr, ruler + 16 * dpr);
    }
    if (tab === 'connect' && T.connect.at !== null) {
      const x = xAt(T.connect.at) * dpr; g.fillStyle = '#5cf2a8'; g.fillRect(x - dpr, ruler, 2 * dpr, Hd - ruler);
    }
  }
  function mouseDown({ x, xAt, tab }) {
    if (tab !== 'split') return null;
    const i = T.split.cuts.findIndex((c) => Math.abs(xAt(c) - x) < 7);
    if (i < 0) return null;
    return {
      move: (t) => {
        const others = T.split.cuts.filter((_, j) => j !== i);
        const lo = Math.max(0.2, ...others.filter((c) => c < T.split.cuts[i]).map((c) => c + 0.2));
        const hi = Math.min(dur() - 0.2, ...others.filter((c) => c > T.split.cuts[i]).map((c) => c - 0.2));
        T.split.cuts[i] = +Math.min(hi, Math.max(lo, t)).toFixed(3);
      },
      up: () => A().render(),
    };
  }

  function panel(tab) {
    const f = { trim: trimPanel, split: splitPanel, loop: loopPanel, connect: connectPanel }[tab];
    return f ? f() : h('div');
  }
  // the little round markers on the ruler (split cuts, the connect point)
  function markers({ mk, tab }) {
    if (tab === 'split') T.split.cuts.forEach((c, i) => mk(c, String(i + 1), '#ffaa3c'));
    if (tab === 'connect' && T.connect.at !== null) mk(T.connect.at, 'C', '#5cf2a8');
  }
  // the selection changed: the Loop panel shows A and B
  function refresh(tab) { if (tab === 'loop') A().render(); }
  function onVersion() { T.trim.res = null; T.split.cuts = []; T.split.set = {}; T.connect.at = null; }
  function reset() { T = fresh(); }
  return { panel, overlay, mouseDown, markers, refresh, pickSong, pickSound, onVersion, reset, get state() { return T; } };
})();
