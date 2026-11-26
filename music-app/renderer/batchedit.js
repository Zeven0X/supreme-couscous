'use strict';
/* global S, h, tf, guard, toast, modal, confirmModal, coverEl, fmtTime, upsertTrack, renderGrid, TFPlaylists */
// Edit many songs together: the same Trim and / or Effects on every song, each saved separately
// in one of the 3 ways (Keep both / New takes the name / Replace the originals).
window.TFBatch = (() => {
  const FX = [['echo', 'Echo'], ['slowed', 'Slowed + reverb'], ['nightcore', 'Nightcore'], ['bass', 'Bass boost'], ['eightd', '8D'], ['oned', '1D']];
  const B = { trim: true, level: 'quiet', fxOn: {}, str: { echo: 40, slowed: 50, nightcore: 50, bass: 50, eightd: 50, oned: 100 }, mode: 'both' };

  // pick songs when nothing is selected (from the Edit page)
  function pickMany() {
    return modal((box, close) => {
      box.style.width = 'min(560px, 94vw)';
      const chosen = new Set(S.selected.filter((id) => S.byId.has(id)));
      const q = h('input', { placeholder: 'Search your songs…', spellcheck: 'false', autofocus: true });
      const list = h('div', { class: 'pl-pick' });
      const go = h('button', { class: 'btn primary' });
      const count = () => { go.textContent = `Next: ${chosen.size} song${chosen.size === 1 ? '' : 's'}`; go.disabled = chosen.size < 1; };
      const fill = () => {
        list.innerHTML = '';
        const n = q.value.trim().toLowerCase();
        for (const t of S.tracks.filter((x) => !n || `${x.title} ${x.artist}`.toLowerCase().includes(n)).slice(0, 300)) {
          const cb = h('input', { type: 'checkbox', checked: chosen.has(t.id) });
          const rowEl = h('label', { class: 'pl-pick-row bt-pick' }, cb, h('div', { class: 'pl-mini' }, coverEl(t)), h('span', { class: 't' }, t.title), h('span', { class: 'muted' }, fmtTime(t.duration)));
          cb.addEventListener('change', () => { if (cb.checked) chosen.add(t.id); else chosen.delete(t.id); count(); });
          list.append(rowEl);
        }
      };
      q.addEventListener('input', fill); fill(); count();
      go.addEventListener('click', () => { close(); open([...chosen]); });
      box.append(h('h2', {}, 'Edit many songs: pick them'), q, list,
        h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => { S.tracks.forEach((t) => chosen.add(t.id)); fill(); count(); } }, 'Pick all'), h('span'), h('button', { class: 'btn', onclick: () => close() }, 'Cancel'), go));
    });
  }

  function open(idsIn) {
    const ids = [...new Set(idsIn || S.selected)].filter((id) => S.byId.has(id));
    if (!ids.length) return pickMany();
    return modal((box, close) => {
      box.classList.add('save-win', 'bt-win');
      const body = h('div');
      const draw = () => {
        body.innerHTML = '';
        const names = ids.slice(0, 6).map((id) => S.byId.get(id).title).join(', ') + (ids.length > 6 ? ` and ${ids.length - 6} more` : '');
        const fxRows = FX.map(([k, name]) => {
          const range = h('input', { type: 'range', min: 0, max: 100, value: B.str[k], disabled: !B.fxOn[k] });
          range.style.setProperty('--pct', `${B.str[k]}%`);
          const val = h('span', { class: 'ed-fxv' }, `${B.str[k]}%`);
          range.addEventListener('input', () => { B.str[k] = +range.value; val.textContent = `${range.value}%`; range.style.setProperty('--pct', `${range.value}%`); });
          return h('div', { class: 'bt-fx' }, h('button', { class: `fx-switch${B.fxOn[k] ? ' on' : ''}`, onclick: () => { B.fxOn[k] = !B.fxOn[k]; draw(); } }, h('span', { class: 'knob' }), name), range, val);
        });
        const modes = [
          ['both', 'Keep both', 'Each new file is "Name New", next to its original. The originals stay as they are.'],
          ['newname', 'New takes the name', 'Each new file gets the original\'s name; the originals become "Name Old".'],
          ['replace', 'Replace the originals', 'Each new file gets the original\'s name; the originals go to the Recycle Bin (asks first).'],
        ];
        const anyFx = FX.some(([k]) => B.fxOn[k]);
        const go = h('button', { class: 'btn primary', disabled: !B.trim && !anyFx }, `Edit and save ${ids.length} song${ids.length === 1 ? '' : 's'}`);
        go.addEventListener('click', () => run(ids, close));
        body.append(
          h('h2', {}, `Edit ${ids.length} song${ids.length === 1 ? '' : 's'} together`),
          h('div', { class: 'sv-sub' }, names),
          h('div', { class: 'bt-sec' },
            h('button', { class: `fx-switch${B.trim ? ' on' : ''}`, onclick: () => { B.trim = !B.trim; draw(); } }, h('span', { class: 'knob' }), 'Trim the silent start and end'),
            h('div', { class: `seg${B.trim ? '' : ' off'}` }, ...[['veryquiet', 'Very quiet'], ['quiet', 'Quiet'], ['bitquiet', 'A bit quiet']].map(([v, l]) => h('button', { class: B.level === v ? 'on' : '', disabled: !B.trim, onclick: () => { B.level = v; draw(); } }, l)))),
          h('div', { class: 'bt-sec col' }, h('div', { class: 'sv-l' }, 'Effects (the same on every song)'), h('div', { class: 'bt-fxs' }, ...fxRows)),
          h('div', { class: 'sv-l', style: { marginTop: '12px' } }, 'Save each song'),
          h('div', { class: 'sv-modes' }, ...modes.map(([m, l, d]) => h('button', { class: `sv-mode${B.mode === m ? ' on' : ''}${m === 'replace' ? ' danger' : ''}`, onclick: () => { B.mode = m; draw(); } }, h('b', {}, l), h('span', {}, d)))),
          h('p', { class: 'muted', style: { marginTop: '10px' } }, 'Songs are saved next to their original files. A song with nothing to change (no silent start or end, no effects) is skipped. You can keep using Tonix while it works.'),
          h('div', { class: 'foot' }, h('span'), h('button', { class: 'btn', onclick: () => close() }, 'Cancel'), go));
      };
      draw();
      box.append(body);
    });
  }

  async function run(ids, close) {
    if (B.mode === 'replace') {
      const ok = await confirmModal(`Replace the original files of ${ids.length} songs?`, 'Each edited song is saved with its original\'s name, and every original file is moved to the Recycle Bin. You can get them back from the Recycle Bin.', 'Replace the originals');
      if (!ok) return;
    }
    close();
    const fx = Object.fromEntries(FX.filter(([k]) => B.fxOn[k]).map(([k]) => [k, B.str[k]]));
    toast(`Editing ${ids.length} songs… you can see the progress at the top.`, { ms: 3000 });
    const r = await guard(() => tf.batchEdit(ids, { trim: B.trim ? B.level : null, fx, mode: B.mode }), 'Edit many: ');
    if (!r) return;
    for (const t of [...r.changed, ...r.added]) upsertTrack(t);
    renderGrid(); TFPlaylists.render();
    modal((box, done) => {
      box.style.width = 'min(560px, 94vw)';
      box.append(...[h('h2', {}, `Done: ${r.done.length} saved${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}`),
        r.done.length ? h('p', { class: 'muted' }, `Saved next to the originals${B.mode === 'both' ? ' as "… New"' : ''}. They are in your library too.`) : null,
        r.skipped.length ? h('div', { class: 'bt-skipped' }, h('div', { class: 'sv-l' }, 'Skipped'), ...r.skipped.map((x) => h('div', {}, h('b', {}, x.title), ` — ${x.why}`))) : null,
        h('div', { class: 'foot' }, h('span'), r.done.length ? h('button', { class: 'btn', onclick: () => tf.showItem(r.done[0].dest) }, 'Show the files') : null, h('button', { class: 'btn primary', onclick: () => done() }, 'OK'))].filter(Boolean)); // (no "null" text: found in the bug hunt)
    });
  }
  return { open, pickMany };
})();
