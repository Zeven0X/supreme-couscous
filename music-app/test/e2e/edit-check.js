// Edit page check (part 1): open, select, cut, keep, undo / redo, and the 3 save modes on copies of songs.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
// SP/media holds the test songs (made by the developer); this check works on copies in SP/edit-media
const SP = process.env.SP; const DATA = SP + '/userdata-edit'; fs.rmSync(DATA, { recursive: true, force: true });
const M = SP + '/edit-media'; fs.rmSync(M, { recursive: true, force: true }); fs.mkdirSync(M);
for (const f of ['Rainfall.mp3', 'Golden Hour.mp3', 'Iron Heart.mp3']) fs.copyFileSync(path.join(SP, 'media', f), path.join(M, f));
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
(async () => {
  const a = await _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--force-device-scale-factor=2', '--autoplay-policy=no-user-gesture-required'], env: { ...process.env, TONIX_DATA: DATA } });
  const w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1320, height: 880 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  await ev((p) => importPaths(p), fs.readdirSync(M).map((f) => path.join(M, f))); await wait(500);
  await w.keyboard.press('Control+3'); await wait(300);
  ok('Edit page opens (empty: "Open a song…")', await w.isVisible('.ed-empty'));
  await w.keyboard.press('Control+1'); await wait(200);
  await w.click('.card:has-text("Rainfall")', { button: 'right' }); await w.click('#ctxmenu button:has-text("Edit")');
  await w.waitForFunction(() => TFEdit.session && document.querySelector('#ed-canvas'), null, { timeout: 20000 }); await wait(400);
  const dur0 = await ev(() => TFEdit.session.duration);
  ok('song opened in the editor', dur0 > 30, dur0.toFixed(2));
  // drag to select about 25%..50% of the wave
  const box = await w.locator('#ed-canvas').boundingBox();
  await w.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2); await w.mouse.down(); await w.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 6 }); await w.mouse.up(); await wait(200);
  const selText = await w.textContent('#ed-sel');
  ok('drag selects a part', /^Selected/.test(selText), selText);
  await w.locator('.ed-wave').screenshot({ path: SP + '/concepts/edit-wave.png' });
  await w.screenshot({ path: SP + '/concepts/edit-page.png' });
  await w.keyboard.press('Delete'); await w.waitForFunction((d) => TFEdit.session && TFEdit.session.duration < d - 5, dur0, { timeout: 20000 });
  const dur1 = await ev(() => TFEdit.session.duration);
  ok('Delete cuts the part out', Math.abs(dur1 - dur0 * 0.75) < 1, `${dur0.toFixed(1)} → ${dur1.toFixed(1)} s`);
  await w.keyboard.press('Control+z'); await w.waitForFunction((d) => Math.abs(TFEdit.session.duration - d) < 0.1, dur0);
  ok('Ctrl+Z undoes', true);
  await w.keyboard.press('Control+y'); await w.waitForFunction((d) => Math.abs(TFEdit.session.duration - d) < 0.1, dur1);
  ok('Ctrl+Y redoes', true);
  await w.click('.tb:has-text("+")'); await w.click('.tb:has-text("+")'); await wait(100);
  ok('zoom in', (await w.textContent('#ed-zoom')) === '225%');
  // Save: keep both
  await w.click('.sv-mode:has-text("Keep both")'); await w.click('.ed-save .btn.primary');
  await w.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.startsWith('Saved:')), null, { timeout: 30000 }); await wait(800);
  ok('Keep both: "Rainfall New.mp3" + original untouched', fs.existsSync(path.join(M, 'Rainfall New.mp3')) && fs.existsSync(path.join(M, 'Rainfall.mp3')), fs.readdirSync(M).join(', '));
  ok('the new song is in the library', await ev(() => S.tracks.some((t) => t.title === 'Rainfall New')));
  // Save: new takes the name (on Golden Hour)
  await ev(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await ev(() => TFEdit.open(S.tracks.find((t) => t.title === 'Golden Hour').id));
  await w.waitForFunction(() => TFEdit.session && S.byId.get(TFEdit.session.trackId).title === 'Golden Hour', null, { timeout: 20000 }); await wait(300);
  await ev(async () => { const s = TFEdit.session; await tf.editApply(s.id, { type: 'keep', a: 1, b: 11 }).then(() => TFEdit.open(s.trackId)); });
  await wait(300);
  const gb = await w.locator('#ed-canvas').boundingBox();
  await w.mouse.move(gb.x + 10, gb.y + 60); await w.mouse.down(); await w.mouse.move(gb.x + gb.width * 0.3, gb.y + 60, { steps: 4 }); await w.mouse.up();
  await w.click('#ed-keep'); await w.waitForFunction(() => TFEdit.session && TFEdit.session.version > 0, null, { timeout: 20000 });
  await w.click('.sv-mode:has-text("New takes the name")'); await w.click('.ed-save .btn.primary');
  await w.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.startsWith('Saved:')), null, { timeout: 30000 }); await wait(800);
  ok('New takes the name: "Golden Hour.mp3" new + "Golden Hour Old.mp3"', fs.existsSync(path.join(M, 'Golden Hour Old.mp3')) && fs.existsSync(path.join(M, 'Golden Hour.mp3')), fs.readdirSync(M).join(', '));
  ok('library: old song renamed, new one added', await ev(() => S.tracks.some((t) => t.title === 'Golden Hour Old') && S.tracks.some((t) => t.title === 'Golden Hour')));
  // Save: replace (asks first, original to the Recycle Bin)
  await ev(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await ev(() => TFEdit.open(S.tracks.find((t) => t.title === 'Iron Heart').id));
  await w.waitForFunction(() => TFEdit.session && S.byId.get(TFEdit.session.trackId).title === 'Iron Heart', null, { timeout: 20000 }); await wait(300);
  const ib = await w.locator('#ed-canvas').boundingBox();
  await w.mouse.move(ib.x + 10, ib.y + 60); await w.mouse.down(); await w.mouse.move(ib.x + ib.width * 0.2, ib.y + 60, { steps: 4 }); await w.mouse.up();
  await w.keyboard.press('Delete'); await w.waitForFunction(() => TFEdit.session && TFEdit.session.version > 0, null, { timeout: 20000 });
  await w.click('.sv-mode:has-text("Replace the original")'); await w.click('.ed-save .btn.primary'); await wait(300);
  ok('Replace asks first', await w.isVisible('.modal:has-text("Recycle Bin")'));
  await w.click('.modal .btn:has-text("Cancel")'); await wait(200);
  ok('Cancel: nothing happens', fs.readdirSync(M).filter((f) => f.startsWith('Iron Heart')).length === 1);
  await w.click('.ed-save .btn.primary'); await w.click('.modal .btn.danger');
  await w.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => /Saved:|Save:/.test(t.textContent)), null, { timeout: 30000 }); await wait(500);
  const toastText = await ev(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
  const ff = require('../../lib/ffmpeg');
  const ih = path.join(M, 'Iron Heart.mp3');
  const d = fs.existsSync(ih) ? (await ff.probe(ih)).info.duration : 0;
  ok('Replace: the shorter new file has the name, the original went to the bin', /^Saved:/.test(toastText) && d > 1 && d < 35, d.toFixed(1));
  await a.close();
  console.log(`EDIT CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors ${errs.join(' | ')}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
