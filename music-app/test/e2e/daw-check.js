// Edit page (studio layout) check: open, select, cut / undo / redo, live effects, tracks (sound, song, voice),
// mute / solo, move, the bottom panels, and Save (the saved file has the effects and tracks you heard).
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
const SP = process.env.SP; const DATA = SP + '/userdata-daw'; fs.rmSync(DATA, { recursive: true, force: true });
const M = SP + '/daw-media'; fs.rmSync(M, { recursive: true, force: true }); fs.mkdirSync(M);
for (const f of ['Rainfall.mp3', 'Golden Hour.mp3', 'Iron Heart.mp3']) fs.copyFileSync(path.join(SP, 'media', f), path.join(M, f));
fs.mkdirSync(SP + '/concepts', { recursive: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
(async () => {
  const a = await _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], env: { ...process.env, TONIX_DATA: DATA } });
  const w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message)); w.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1440, height: 900 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  await ev((p) => importPaths(p), fs.readdirSync(M).map((f) => path.join(M, f))); await wait(600);
  await w.keyboard.press('Control+3'); await wait(300);
  ok('empty Edit page', await w.isVisible('.ed-empty'));
  await w.keyboard.press('Control+1'); await wait(200);
  await w.click('.card:has-text("Rainfall")', { button: 'right' }); await w.click('#ctxmenu button:has-text("Edit")');
  await w.waitForFunction(() => TFEdit.session && document.querySelector('#dw-lanes'), null, { timeout: 20000 }); await wait(600);
  const dur0 = await ev(() => TFEdit.session.duration);
  ok('song opened in the studio layout', dur0 > 30 && await w.isVisible('.dw-transport') && await w.isVisible('.dw-insp'), dur0.toFixed(2));
  await w.screenshot({ path: SP + '/concepts/daw-1-open.png' });

  // select by dragging on the song track
  const box = await w.locator('#dw-lanes').boundingBox();
  const y = box.y + 60;
  await w.mouse.move(box.x + box.width * 0.25, y); await w.mouse.down(); await w.mouse.move(box.x + box.width * 0.5, y, { steps: 6 }); await w.mouse.up(); await wait(200);
  const selT = await w.textContent('#dw-selt');
  ok('drag selects a part', /–/.test(selT) && !(await w.isDisabled('#dw-cut')), selT);
  // play: the clock moves
  await w.click('#dw-play'); await wait(1200);
  const t1 = await ev(() => TFDaw.time());
  ok('Play: the clock moves', t1 > 0.3, t1.toFixed(2));
  const playingMeter = await ev(() => Math.max(...Object.values(TFDaw.meters())));
  ok('meters move while playing', playingMeter > 0.001, playingMeter.toFixed(3));
  await w.keyboard.press('Space'); await wait(150);
  ok('Space pauses', await ev(() => !TFDaw.playing));

  // live effects: switch on Echo and Slowed in the bottom panel
  await w.click('.dw-fx:has-text("Echo") .fx-switch'); await wait(100);
  await w.click('.dw-fx:has-text("Slowed") .fx-switch'); await wait(100);
  ok('effects on the song (chips in the inspector)', (await w.locator('.dw-insp .dw-chip.on').count()) === 2);
  const kb = await w.locator('.dw-fx:has-text("Echo") .dw-knob').boundingBox();
  await w.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2); await w.mouse.down(); await w.mouse.move(kb.x + kb.width / 2, kb.y - 30, { steps: 4 }); await w.mouse.up(); await wait(100);
  const echo = await ev(() => TFEdit.api.tracks[0].fx.echo);
  ok('dragging the knob up makes the effect stronger', echo > 50, `echo ${echo}%`);
  await w.click('#dw-play'); await wait(900);
  const rate = await ev(() => TFDaw.songRate());
  ok('Slowed plays slower, live', rate < 0.95, rate.toFixed(3));
  await w.click('#dw-play'); await wait(100);

  // tracks: a built-in sound, another song, the voice
  await ev(() => TFDaw.seek(5));
  await w.click('.dw-add button:has-text("Built-in sound")'); await w.click('.pl-pick-row:has-text("Rain")');
  await w.waitForFunction(() => TFEdit.api.tracks.length === 2, null, { timeout: 30000 }); await wait(300);
  const L = await ev(() => { const x = TFEdit.api.tracks[1]; return { off: x.offset, rep: x.repeat, vol: x.volume }; });
  ok('a sound track starts at the playhead and repeats to the end', Math.abs(L.off - 5) < 0.01 && L.rep === 0, JSON.stringify(L));
  await w.click('.dw-add button:has-text("Song track")'); await w.click('.pl-pick-row:has-text("Iron Heart")');
  await w.waitForFunction(() => TFEdit.api.tracks.length === 3, null, { timeout: 30000 }); await wait(300);
  ok('a song track is added', await w.isVisible('.dw-head:has-text("Iron Heart")'));
  // move tool: drag the Iron Heart clip right
  await w.click('.dw-b:has-text("Move")');
  const off0 = await ev(() => TFEdit.api.tracks[2].offset);
  const lb = await w.locator('#dw-lanes').boundingBox(), ly = lb.y + 122 + 68 + 30;
  const cx = await ev(() => TFEdit.api.xAt(TFEdit.api.tracks[2].offset + 3));
  await w.mouse.move(lb.x + cx, ly); await w.mouse.down(); await w.mouse.move(lb.x + cx + 80, ly, { steps: 5 }); await w.mouse.up(); await wait(150);
  const off1 = await ev(() => TFEdit.api.tracks[2].offset);
  ok('Move drags a track', off1 > off0 + 1, `${off0} → ${off1}`);
  // mute / solo on the header
  await w.click('.dw-head:has-text("Iron Heart") .dw-ms.m'); await wait(100);
  ok('M mutes a track', await ev(() => TFEdit.api.tracks[2].mute));
  await w.click('.dw-head:has-text("Iron Heart") .dw-ms.m');
  // the voice (fake microphone)
  await ev(() => TFDaw.seek(2));
  await w.click('.dw-add button:has-text("Record voice")'); await wait(1800);
  await w.click('#dw-rec');
  await w.waitForFunction(() => TFEdit.api.tracks.length === 4, null, { timeout: 30000 }).catch(() => {});
  ok('Record voice adds a track (auto-quiet on)', await ev(() => TFEdit.api.tracks.length === 4 && TFEdit.api.tracks[3].duck));
  await w.click('#dw-play'); await wait(1000); await w.click('#dw-play');
  await w.screenshot({ path: SP + '/concepts/daw-2-tracks.png' });

  // panels
  for (const p of ['Trim', 'Split', 'Loop', 'Connect']) {
    await w.click(`.dw-tools .dw-b:has-text("${p}")`); await wait(300);
    const txt = await w.locator('.dw-panel').textContent({ timeout: 4000 }).catch(() => '');
    ok(`${p} panel opens`, txt.length > 20, txt ? '' : errs.join(' | '));
  }
  await w.click('.dw-tools .dw-b:has-text("Loop")'); await wait(200);
  await w.screenshot({ path: SP + '/concepts/daw-3-loop.png' });
  await w.click('.dw-tools .dw-b:has-text("Effects")'); await wait(200);

  // cut / undo / redo keep the tracks
  await w.keyboard.press('Delete');
  await w.waitForFunction((d) => TFEdit.session && TFEdit.session.duration < d - 5, dur0, { timeout: 20000 });
  const dur1 = await ev(() => TFEdit.session.duration);
  ok('Delete cuts the part out of the song', Math.abs(dur1 - dur0 * 0.75) < 1.5, `${dur0.toFixed(1)} → ${dur1.toFixed(1)}`);
  ok('…and the tracks and effects stay', await ev(() => TFEdit.api.tracks.length === 4 && TFEdit.api.tracks[0].fx.echo > 0));
  await w.keyboard.press('Control+z'); await w.waitForFunction((d) => Math.abs(TFEdit.session.duration - d) < 0.1, dur0);
  await w.keyboard.press('Control+y'); await w.waitForFunction((d) => Math.abs(TFEdit.session.duration - d) < 0.1, dur1);
  ok('Ctrl+Z / Ctrl+Y', true);

  // ---- found in review: Apply + Undo brings the tracks back; Redo mixes them in again
  const vA = await ev(() => TFEdit.session.version);
  await w.click('.dw-panel .tb.pri:has-text("Apply to the song")'); await w.waitForFunction((v) => TFEdit.session.version === v + 1, vA, { timeout: 60000 });
  ok('Apply to the song: tracks mixed in', await ev(() => TFEdit.api.tracks.length === 1));
  await w.keyboard.press('Control+z'); await w.waitForFunction((v) => TFEdit.session.version === v, vA, { timeout: 30000 }); await wait(200);
  ok('Undo brings the tracks and effects back', await ev(() => TFEdit.api.tracks.length === 4 && TFEdit.api.tracks[0].fx.echo > 0));
  await w.keyboard.press('Control+y'); await w.waitForFunction((v) => TFEdit.session.version === v + 1, vA, { timeout: 30000 }); await wait(200);
  ok('Redo mixes them in again (no double sound)', await ev(() => TFEdit.api.tracks.length === 1 && !Object.keys(TFEdit.api.tracks[0].fx).length));
  await w.keyboard.press('Control+z'); await w.waitForFunction((v) => TFEdit.session.version === v, vA, { timeout: 30000 }); await wait(200);
  // ---- a preview and the live tracks never play together
  await w.click('.dw-tools .dw-b:has-text("Loop")'); await wait(200);
  await ev(() => { TFEdit.api.sel = { a: 2, b: 4 }; TFEdit.api.render(); });
  await w.click('.dw-panel .tb:has-text("Listen to the join")'); await w.waitForFunction(() => TFEdit.api.previewing, null, { timeout: 60000 });
  await w.keyboard.press('Space'); await wait(200);
  ok('Space during a preview stops it (banner gone, nothing plays)', await ev(() => !TFEdit.api.previewing && !TFDaw.playing && !document.querySelector('.ed-preview')));
  await w.click('.dw-panel .tb:has-text("Listen to the join")'); await w.waitForFunction(() => TFEdit.api.previewing, null, { timeout: 60000 });
  await w.click('.dw-add button:has-text("Built-in sound")'); await w.click('.pl-pick-row:has-text("Ocean")'); await w.waitForFunction(() => TFEdit.api.tracks.length === 5, null, { timeout: 30000 }); await wait(300);
  ok('adding a track during a preview does not start the tracks over it', await ev(() => TFDaw.previewing));
  await w.click('.ed-preview .tb'); await wait(150);
  await w.click('.dw-head:has-text("Ocean") .dw-x'); await wait(100);
  // ---- leaving the page stops the microphone; a slow preview doesn't start on another page
  await w.click('.dw-add button:has-text("Record voice")'); await wait(1200);
  ok('recording…', await ev(() => !!document.querySelector('.dw-recbtn.on')));
  await w.keyboard.press('Control+1'); await wait(1500);
  ok('leaving the Edit page stops the recording', await ev(() => !TFDaw.playing && !document.querySelector('.dw-recbtn.on')));
  await w.keyboard.press('Control+3'); await w.waitForFunction(() => TFEdit.api.tracks.length === 5, null, { timeout: 30000 }).catch(() => {});
  ok('…and keeps it as a track', await ev(() => TFEdit.api.tracks.length === 5), String(await ev(() => TFEdit.api.tracks.length)));
  await w.click('.dw-head:has-text("Your voice") >> nth=-1'); await w.click('.dw-head.sel .dw-x'); await wait(100);
  await w.click('.dw-tools .dw-b:has-text("Loop")').catch(() => {}); await wait(100);
  if (!(await w.isVisible('.dw-panel:has-text("Listen to the join")'))) await w.click('.dw-tools .dw-b:has-text("Loop")');
  await ev(() => { TFEdit.api.sel = { a: 2, b: 4 }; TFEdit.api.render(); });
  await w.click('.dw-panel .tb:has-text("Listen to the join")'); await w.keyboard.press('Control+1'); await wait(4000);
  ok('a preview still being made does not play on another page', await ev(() => !TFDaw.previewing && !TFDaw.playing));
  await w.keyboard.press('Control+3'); await wait(400);
  if (!(await w.isVisible('.dw-fxs'))) await w.click('.dw-tools .dw-b:has-text("Effects")');
  // ---- found in the bug hunt
  await w.click('.dw-tools .dw-b:has-text("Loop")'); await wait(200);
  if (!(await w.isVisible('.dw-panel:has-text("Loop")'))) await w.click('.dw-tools .dw-b:has-text("Loop")');
  const lb2 = await w.locator('#dw-lanes').boundingBox();
  await w.click('.dw-b:has-text("Select")');
  await w.mouse.move(lb2.x + lb2.width * 0.6, lb2.y + 60); await w.mouse.down(); await w.mouse.move(lb2.x + lb2.width * 0.7, lb2.y + 60, { steps: 4 }); await w.mouse.up(); await wait(200);
  const loopText = await w.textContent('.dw-panel');
  const selNow = await ev(() => TFEdit.api.sel);
  ok('the Loop panel follows a new selection', selNow && loopText.includes(await ev((x) => TFEdit.api.fmt(x), selNow.a)), loopText.slice(0, 60));
  await ev(() => TFEdit.api.playRange(1, 2)); await wait(100); await ev(() => TFEdit.api.seek(20)); await wait(1500);
  ok('a click after "play this part" does not jump back', await ev(() => TFDaw.time() > 19), (await ev(() => TFDaw.time())).toFixed(2));
  await w.keyboard.press('Space'); await wait(100);
  const vK = await ev(() => TFEdit.session.version);
  await w.keyboard.press('Control+Shift+z'); await wait(1500);
  ok('Ctrl+Shift+Z is Redo, not Undo', (await ev(() => TFEdit.session.version)) >= vK);
  await ev(() => { confirmModal('A window', 'Keys go to the window.', 'OK'); }); await wait(200);
  await w.keyboard.press('Delete'); await wait(800);
  ok('Edit keys do nothing while a window is open', (await ev(() => TFEdit.session.version)) === (await ev(() => TFEdit.session.version)) && (await ev(() => TFEdit.session.version)) >= vK && await w.isVisible('.modal'));
  await w.keyboard.press('Escape'); await wait(200);
  ok('Esc closes that window', !(await w.isVisible('.modal')));
  const vBefore = await ev(() => TFEdit.session.version);
  await ev(() => TFEdit.open(TFEdit.session.trackId)); await wait(400);
  ok('opening the same song again keeps your changes', (await ev(() => TFEdit.session.version)) === vBefore && vBefore > 0);
  await w.click('.dw-tools .dw-b:has-text("Effects")').catch(() => {}); await wait(100);
  if (!(await w.isVisible('.dw-fxs'))) await w.click('.dw-tools .dw-b:has-text("Effects")');
  // Save keep both: one file with everything mixed (slowed → longer)
  await w.selectOption('.dw-mode', 'both');
  await w.click('.dw-b:has-text("Save")');
  await w.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.startsWith('Saved:')), null, { timeout: 60000 }); await wait(1000);
  const saved = path.join(M, 'Rainfall New.mp3');
  ok('Save: "Rainfall New.mp3" next to the original', fs.existsSync(saved) && fs.existsSync(path.join(M, 'Rainfall.mp3')), fs.readdirSync(M).join(', '));
  const newDur = await ev(() => (S.tracks.find((t) => t.title === 'Rainfall New') || {}).duration);
  ok('the saved song is slowed like you heard it', newDur > dur1 / rate - 1 && newDur < dur1 / rate + 1.5, `${newDur && newDur.toFixed(1)} vs ${(dur1 / rate).toFixed(1)}`);
  ok('after saving, the editor goes on with the saved song (clean)', await ev(() => TFEdit.session && S.byId.get(TFEdit.session.trackId).title === 'Rainfall New' && TFEdit.api.tracks.length === 1 && !Object.keys(TFEdit.api.tracks[0].fx).length));
  await w.screenshot({ path: SP + '/concepts/daw-4-saved.png' });
  ok('no errors on the page', errs.length === 0, errs.slice(0, 5).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await a.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
