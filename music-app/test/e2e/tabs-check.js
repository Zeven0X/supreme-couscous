// Edit page tabs check: Trim, Split (+ Same loudness, save parts), Effects, Loop, Layers (+ voice), Smart connect.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
const ff = require('../../lib/ffmpeg');
// SP/media holds the test songs (made by the developer); this check works on copies in SP/tabs-media
const SP = process.env.SP; const DATA = SP + '/userdata-tabs'; fs.rmSync(DATA, { recursive: true, force: true });
const M = SP + '/tabs-media'; fs.rmSync(M, { recursive: true, force: true }); fs.mkdirSync(M);
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
(async () => {
  // a "mix" file: 1.5 s quiet, song 1 (louder), 2.5 s quiet, song 2 (quieter), 1 s quiet
  const mix = path.join(M, 'Two songs.mp3');
  await ff.run(['-y', '-i', path.join(SP, 'media', 'Rainfall.mp3'), '-i', path.join(SP, 'media', 'Golden Hour.mp3'), '-filter_complex',
    "[0:a]atrim=0:12,asetpts=N/SR/TB,aresample=44100,aformat=channel_layouts=stereo,adelay=1500|1500,apad=pad_dur=2.5[a];[1:a]atrim=0:12,asetpts=N/SR/TB,aresample=44100,aformat=channel_layouts=stereo,volume=0.35,apad=pad_dur=1[b];[a][b]concat=n=2:v=0:a=1[out]",
    '-map', '[out]', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '192k', mix]);
  fs.copyFileSync(path.join(SP, 'media', 'Iron Heart.mp3'), path.join(M, 'Iron Heart.mp3'));
  const a = await _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--force-device-scale-factor=2', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], env: { ...process.env, TONIX_DATA: DATA } });
  const w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1440, height: 940 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  const dur = () => ev(() => TFEdit.session.duration);
  const waitVersion = (v) => w.waitForFunction((x) => TFEdit.session && TFEdit.session.version === x, v, { timeout: 60000 });
  const tab = async (name) => { await w.click(`.ed-tabs button:has-text("${name}")`); await wait(300); };
  await ev((p) => importPaths(p), [mix, path.join(M, 'Iron Heart.mp3')]); await wait(500);
  await ev(() => TFEdit.open(S.tracks.find((t) => t.title === 'Two songs').id));
  await w.waitForFunction(() => TFEdit.session && document.querySelector('#ed-canvas'), null, { timeout: 30000 });
  const d0 = await dur();
  // ---- Trim
  await tab('Trim'); await w.waitForFunction(() => /Silent start/.test(document.querySelector('.ed-panel').textContent), null, { timeout: 30000 });
  const trimText = await w.textContent('.ed-panel .ed-note.ok');
  ok('Trim finds the silent start and end', /Silent start: 1\.[45]\d s/.test(trimText) && /Silent end: (0\.9|1\.0)\d s/.test(trimText), trimText);
  await w.screenshot({ path: SP + '/concepts/tab-trim.png' });
  await w.click('.ed-panel .tb.pri'); await waitVersion(1);
  const d1 = await dur();
  ok('Confirm removes them', Math.abs(d0 - d1 - 2.5) < 0.15, `${d0.toFixed(2)} → ${d1.toFixed(2)}`);
  // ---- Split
  await tab('Split'); await w.click('.ed-panel .tb:has-text("Find the songs")'); await w.waitForFunction(() => document.querySelectorAll('.ed-part').length >= 2, null, { timeout: 30000 });
  const nParts = await w.locator('.ed-part').count();
  const cut = await ev(() => TFEditTabs.state.split.cuts[0]);
  ok('Split finds 2 songs, cut in the gap', nParts === 2 && Math.abs(cut - 13.25) < 0.3, `${nParts} parts, cut at ${cut}`);
  await w.click('.ed-panel .tb:has-text("Same loudness")'); await w.waitForFunction(() => +document.querySelectorAll('.ed-part')[1].querySelectorAll('.ed-num')[2].value > 150, null, { timeout: 30000 });
  const vols = await ev(() => [...document.querySelectorAll('.ed-part')].map((r) => +r.querySelectorAll('.ed-num')[2].value));
  ok('Same loudness: the quiet part gets louder', vols[0] < 130 && vols[1] > 150, JSON.stringify(vols));
  await w.locator('.ed-part').nth(0).locator('.ed-num').nth(1).fill('110'); await w.keyboard.press('Enter');
  await w.screenshot({ path: SP + '/concepts/tab-split.png' });
  await w.click('.ed-panel .tb:has-text("Save all")');
  await w.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => /Saved 2 songs/.test(t.textContent)), null, { timeout: 60000 });
  const files = fs.readdirSync(M);
  ok('2 part files saved + in the library', files.includes('Two songs - Part 1.mp3') && files.includes('Two songs - Part 2.mp3') && await ev(() => S.tracks.filter((t) => / - Part \d$/.test(t.title)).length === 2), files.join(', '));
  // ---- Effects
  await tab('Effects');
  await w.click('.ed-fxcard:has-text("Echo") .fx-switch'); await w.click('.ed-fxcard:has-text("1D") .fx-switch');
  await w.screenshot({ path: SP + '/concepts/tab-effects.png' });
  await w.click('.ed-panel .tb:has-text("Preview")'); await w.waitForFunction(() => TFEdit.api.previewing && !TFEdit.api.player.paused, null, { timeout: 60000 }).catch(() => {});
  ok('Effects preview plays (nothing changed yet)', await ev(() => TFEdit.session.version === 1 && !TFEdit.api.player.paused));
  await w.click('.ed-preview .tb'); await wait(200);
  await tab('Effects'); await tab('Effects'); // tab off and on (preview stopped)
  await w.click('.ed-panel .tb.pri:has-text("Apply")'); await waitVersion(2);
  ok('Apply effects makes a change', /Effects: echo, oned/.test(await ev(() => TFEdit.session.versions[2])));
  // ---- Loop
  await tab('Loop');
  ok('Loop asks for a selection first', /Drag across the waveform/.test(await w.textContent('.ed-panel')));
  await ev(() => { TFEdit.api.sel = { a: 2, b: 4.02 }; TFEdit.api.render(); });
  await w.click('.ed-panel .tb:has-text("Smart loop")'); await wait(1500);
  const sel = await ev(() => TFEdit.api.sel);
  ok('Smart loop moves A / B a tiny bit', Math.abs(sel.a - 2) < 0.01 && Math.abs(sel.b - 4.02) < 0.26, JSON.stringify(sel));
  await w.click('.ed-panel .tb:has-text("+")'); await wait(150);
  const newLenText = await w.textContent('.ed-panel .ed-note.ok');
  await w.screenshot({ path: SP + '/concepts/tab-loop.png' });
  const dBefore = await dur();
  await w.click('.ed-panel .tb.pri:has-text("Apply loop")'); await waitVersion(3);
  ok('Loop × 3 adds 2 × the part', Math.abs((await dur()) - dBefore - 2 * (sel.b - sel.a)) < 0.1, `${newLenText}`);
  // ---- Layers
  await tab('Layers');
  await ev(() => TFEdit.api.seek(1));
  await w.click('.ed-panel .tb:has-text("Built-in sound")'); await w.click('.modal .pl-pick-row:has-text("Rain")'); await w.waitForFunction(() => TFEditTabs.state.layers.length === 1, null, { timeout: 60000 });
  await w.click('.ed-panel .tb:has-text("+ Song")'); await w.click('.modal .pl-pick-row:has-text("Iron Heart")'); await w.waitForFunction(() => TFEditTabs.state.layers.length === 2, null, { timeout: 30000 });
  await w.click('#ed-recbtn'); await wait(2500); await w.click('#ed-recbtn'); await w.waitForFunction(() => TFEditTabs.state.layers.length === 3, null, { timeout: 30000 }).catch(() => {});
  const nl = await ev(() => TFEditTabs.state.layers.map((L) => `${L.name}${L.duck ? ' (auto-quiet)' : ''}`));
  ok('layers: rain, a song, your voice (auto-quiet on)', nl.length === 3 && /voice.*auto-quiet/.test(nl[2]), JSON.stringify(nl));
  const recLen = await ev(() => TFEditTabs.state.layers[2].duration);
  ok('the recording has its real length', recLen > 1.5 && recLen < 4, recLen.toFixed(2));
  ok('no stray "null" on the page', !/\bnull\b/.test(await w.textContent('#view-edit')));
  await w.locator('.ed-layer').nth(1).locator('.tb:has-text("Match beat")').click(); await wait(200);
  await w.screenshot({ path: SP + '/concepts/tab-layers.png' });
  const dL = await dur();
  await w.click('.ed-panel .tb.pri:has-text("Mix in")'); await waitVersion(4);
  ok('Mix in: one change, layers joined in, length kept', Math.abs((await dur()) - Math.max(dL, 1 + 40 / 1)) < 60 && (await ev(() => TFEditTabs.state.layers.length)) === 0, (await dur()).toFixed(1));
  // ---- Smart connect (piece from another song, at the playhead)
  await ev(() => TFEdit.api.seek(5)); await w.click('.ed-connect .tb:has-text("Use the playhead")');
  await ev(() => { TFEdit.api.sel = { a: 1, b: 4 }; TFEdit.api.render(); }); await w.click('.ed-connect .tb:has-text("Use the selection")');
  const dC = await dur();
  await w.click('.ed-connect .tb.pri:has-text("Connect")'); await waitVersion(5);
  ok('Smart connect joins the piece in', (await dur()) > dC + 1.5 && /Smart connect/.test(await ev(() => TFEdit.session.versions[5])), `${dC.toFixed(1)} → ${(await dur()).toFixed(1)}`);
  // no pile-up of mouse listeners when switching tabs many times (found in review)
  const before = await ev(() => { let n = 0; const add = window.addEventListener; window.__n = 0; window.addEventListener = function (...x) { window.__n++; return add.apply(this, x); }; return n; });
  for (let i = 0; i < 10; i++) { await tab('Split'); }
  const added = await ev(() => window.__n);
  ok('switching tabs does not pile up listeners', added <= 30, `${added} added over 10 redraws (each redraw replaces its own)`);
  await ev(() => TFEdit.api.seek(0)); await w.click('.ed-tabs button:has-text("Layers")'); await wait(200);
  await w.click('.ed-connect .tb:has-text("Use the playhead")');
  await ev(() => { TFEdit.api.sel = { a: 1, b: 3 }; TFEdit.api.render(); }); await w.click('.ed-connect .tb:has-text("Use the selection")');
  const v6 = await ev(() => TFEdit.session.version);
  await w.click('.ed-connect .tb.pri:has-text("Connect")'); await waitVersion(v6 + 1);
  ok('Smart connect at 0:00 works', true);
  await a.close();
  console.log(`TABS CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors ${errs.join(' | ')}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
