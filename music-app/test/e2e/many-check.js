// Many songs check: save separately (no folder, no numbers) and the same edit on many songs, each saved.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
const ff = require('../../lib/ffmpeg');
// SP/media holds the test songs (made by the developer); copies with silent edges go to SP/many-media
const SP = process.env.SP; const DATA = SP + '/userdata-many'; fs.rmSync(DATA, { recursive: true, force: true });
const M = SP + '/many-media'; const OUT = SP + '/many-out';
for (const d of [M, OUT]) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d); }
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
const dur = async (f) => (await ff.probe(f)).info.duration;
(async () => {
  for (const name of ['Rainfall', 'Golden Hour', 'Iron Heart']) {
    await ff.run(['-y', '-i', path.join(SP, 'media', `${name}.mp3`), '-af', 'adelay=1500|1500,apad=pad_dur=1.5', '-c:a', 'libmp3lame', '-b:a', '192k', path.join(M, `${name}.mp3`)]);
  }
  fs.copyFileSync(path.join(SP, 'media', 'Midnight Drive.mp3'), path.join(M, 'Midnight Drive.mp3')); // no silent edges
  const a = await _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--force-device-scale-factor=2'], env: { ...process.env, TONIX_DATA: DATA } });
  const w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1440, height: 900 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  await ev((p) => importPaths(p), fs.readdirSync(M).map((f) => path.join(M, f))); await wait(500);
  await ev((o) => { S.settings.exportDir = o; }, OUT);
  // ---- save 3 songs separately
  await ev(() => { S.selected = S.tracks.filter((t) => t.title !== 'Midnight Drive').map((t) => t.id); markSelection(); });
  await w.click('#btn-save-many'); await wait(300);
  await w.click('.sv-mode:has-text("Separate songs")'); await wait(150);
  ok('separate: album, name and picture are hidden', !(await w.isVisible('.save-win .sv-top')) && !(await w.isVisible('.sv-namebox')));
  await w.locator('.modal').screenshot({ path: SP + '/concepts/many-separate.png' });
  await w.click('.save-win .foot .btn.primary');
  await w.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.startsWith('Saved:')), null, { timeout: 60000 });
  const outFiles = fs.readdirSync(OUT).sort();
  ok('3 files with their own names, no folder, no numbers', outFiles.length === 3 && outFiles.every((f) => f.endsWith('.mp3') && !/^\d\d - /.test(f)), outFiles.join(', '));
  const p0 = await ff.probe(path.join(OUT, outFiles[0]));
  ok('each keeps its own information (not one album name)', !!p0.tags.title && p0.tags.album !== 'My Album', `${p0.tags.title} / ${p0.tags.album}`);
  ok('remembered for next time', await ev(() => S.settings.albumMode === 'separate'));
  // ---- the same edit on all 4: trim + echo, keep both
  await ev(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await ev(() => { S.selected = S.tracks.map((t) => t.id); markSelection(); });
  await w.click('.card >> nth=0', { button: 'right' }); await w.click('#ctxmenu button:has-text("songs together")'); await wait(300);
  await w.click('.bt-fx:has-text("Echo") .fx-switch'); await wait(100);
  await w.locator('.modal').screenshot({ path: SP + '/concepts/many-edit.png' });
  await w.click('.bt-win .foot .btn.primary');
  await w.waitForFunction(() => /Done:/.test(document.querySelector('.modal h2') ? document.querySelector('.modal h2').textContent : ''), null, { timeout: 180000 });
  const doneText = await w.textContent('.modal h2');
  ok('all 4 edited and saved', /Done: 4 saved/.test(doneText), doneText);
  const news = fs.readdirSync(M).filter((f) => / New\.mp3$/.test(f));
  ok('"Name New" files next to the originals', news.length === 4, news.join(', '));
  const d0 = await dur(path.join(M, 'Rainfall.mp3')), d1 = await dur(path.join(M, 'Rainfall New.mp3'));
  ok('trimmed: 3 s of silence gone', Math.abs(d0 - d1 - 3) < 0.3, `${d0.toFixed(1)} → ${d1.toFixed(1)} s`);
  ok('originals untouched', fs.readdirSync(M).filter((f) => !/ New\.mp3$/.test(f)).length === 4);
  await w.click('.modal .btn.primary');
  // ---- trim only on the song without silence: skipped with a reason
  const md = await ev(() => S.tracks.find((t) => t.title === 'Midnight Drive').id);
  await ev((id) => { TFBatch.open([id]); }, md); await wait(300); // (don't wait for the window to close)
  await w.click('.bt-fx:has-text("Echo") .fx-switch'); await wait(100); // echo off again
  await w.click('.bt-win .foot .btn.primary');
  await w.waitForFunction(() => /Done:/.test(document.querySelector('.modal h2') ? document.querySelector('.modal h2').textContent : ''), null, { timeout: 60000 });
  ok('nothing to trim: skipped, with the reason', /0 saved, 1 skipped/.test(await w.textContent('.modal h2')) && /nothing to change/.test(await w.textContent('.bt-skipped')));
  await w.click('.modal .btn.primary');
  // ---- Edit page: "Edit many songs at once…" opens a picker
  await ev(() => { S.selected = []; }); await w.keyboard.press('Control+3'); await wait(300);
  await w.click('.ed-empty-btns .tb:has-text("Edit many")'); await wait(300);
  ok('Edit page: pick songs with ticks', (await w.locator('.bt-pick').count()) >= 4);
  await a.close();
  console.log(`MANY CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors ${errs.join(' | ')}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
