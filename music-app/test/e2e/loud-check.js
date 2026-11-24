// Same loudness check: library, playlist and map buttons; files untouched; Undo.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
const ff = require('../../lib/ffmpeg');
// SP/media holds the test songs (made by the developer); copies at different loudness go to SP/loud-media
const SP = process.env.SP; const DATA = SP + '/userdata-loud'; fs.rmSync(DATA, { recursive: true, force: true });
const M = SP + '/loud-media'; fs.rmSync(M, { recursive: true, force: true }); fs.mkdirSync(M);
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
(async () => {
  const src = path.join(SP, 'media', 'Rainfall.mp3');
  for (const [name, g] of [['Loud', 1], ['Quiet', 0.3], ['Middle', 0.6], ['Other', 0.5]]) {
    await ff.run(['-y', '-i', src, '-af', `volume=${g}`, '-map_metadata', '-1', '-metadata', `title=${name}`, '-c:a', 'libmp3lame', '-b:a', '192k', path.join(M, `${name}.mp3`)]);
  }
  const sizes = Object.fromEntries(fs.readdirSync(M).map((f) => [f, fs.statSync(path.join(M, f)).size]));
  const a = await _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--force-device-scale-factor=2'], env: { ...process.env, TONIX_DATA: DATA } });
  const w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1500, height: 900 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  await ev((p) => importPaths(p), ['Loud', 'Quiet', 'Middle'].map((n) => path.join(M, `${n}.mp3`))); await wait(400);
  const vol = () => ev(() => Object.fromEntries(S.tracks.map((t) => [t.title, t.fx.volume])));
  const done = () => w.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => /equally loud\./.test(t.textContent)), null, { timeout: 60000 });
  await w.screenshot({ path: SP + '/concepts/loud-toolbar.png', clip: { x: 380, y: 760, width: 760, height: 90 } });
  // library
  await w.click('#btn-loud'); await wait(200);
  ok('asks first, says files are not changed', /not changed/.test(await w.textContent('.modal')));
  await w.click('.modal .btn.danger'); await done();
  let v = await vol();
  const ratio = v.Quiet / v.Loud, ratio2 = v.Middle / v.Loud;
  ok('library: the quiet song gets about 3.3× the volume of the loud one', Math.abs(ratio - 1 / 0.3) < 0.25, JSON.stringify(v));
  ok('library: the middle one about 1.7×', Math.abs(ratio2 - 1 / 0.6) < 0.15, ratio2.toFixed(2));
  ok('your files are not changed', fs.readdirSync(M).every((f) => fs.statSync(path.join(M, f)).size === sizes[f]));
  await w.click('.toast button:has-text("Undo")'); await wait(500);
  ok('Undo puts the volumes back', JSON.stringify(Object.values(await vol())) === '[100,100,100]', JSON.stringify(await vol()));
  // playlist: only its songs change
  await ev(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await ev(async () => { const ids = S.tracks.filter((t) => t.title !== 'Middle').map((t) => t.id); const p = await tf.playlistCreate('Mix', ids); TFPlaylists.setAll([p]); });
  await w.click('#lib-tabs button[data-tab=playlists]'); await wait(300);
  await w.screenshot({ path: SP + '/concepts/loud-playlist.png' });
  await w.click('.pl-btns2 .tb:has-text("Loudness")'); await w.click('.modal .btn.danger'); await done();
  v = await vol();
  ok('playlist: only its 2 songs change', v.Middle === 100 && Math.abs(v.Quiet / v.Loud - 1 / 0.3) < 0.25, JSON.stringify(v));
  // map: only the map's own copies change
  await ev(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await ev(async () => { await tf.tracksSetVolumes(Object.fromEntries(S.tracks.map((t) => [t.id, 100]))).then((l) => l.forEach(upsertTrack)); });
  await w.keyboard.press('Control+2'); await wait(600);
  await w.keyboard.press('a'); await wait(300); for (const n of [0, 1, 2]) await w.click(`.pick >> nth=${n}`); await w.click('.modal .btn.primary'); await wait(400);
  await w.click('#map-loud'); await w.click('.modal .btn.danger'); await done();
  const mv = await ev(() => Object.fromEntries(TFMap.map.stops.map((s) => [S.byId.get(s.trackId).title, s.fx.volume])));
  v = await vol();
  ok('map: its songs get their own volumes', Math.abs(mv.Quiet / mv.Loud - 1 / 0.3) < 0.25, JSON.stringify(mv));
  ok('map: the library volumes stay 100%', Object.values(v).every((x) => x === 100), JSON.stringify(v));
  // second time is quick: loudness remembered
  const t0 = Date.now();
  await ev(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await w.click('#map-loud'); await w.click('.modal .btn.danger'); await done();
  ok('the second time is quick (remembered)', Date.now() - t0 < 3000, `${Date.now() - t0} ms`);
  await a.close();
  console.log(`LOUDNESS CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors ${errs.join(' | ')}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
