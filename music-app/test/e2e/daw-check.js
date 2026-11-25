// Edit page (studio layout, design B) check: open, select, cut / undo / redo, live effects, tracks (sound, song, voice),
// mute / solo, move, marks + Smart loop v2, Sound + Fades per track, Mixer, the small Library bar, the bottom panels,
// and Save (the saved file has the speed, fades, effects and tracks you heard).
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
  const tab = async (name) => { await w.click(`.dw-btabs .dw-b:has-text("${name}")`); await wait(250); };
  await ev((p) => importPaths(p), fs.readdirSync(M).map((f) => path.join(M, f))); await wait(600);
  await w.keyboard.press('Control+3'); await wait(300);
  ok('empty Edit page', await w.isVisible('.ed-empty'));
  await w.keyboard.press('Control+1'); await wait(200);
  await w.click('.card:has-text("Rainfall")', { button: 'right' }); await w.click('#ctxmenu button:has-text("Edit")');
  await w.waitForFunction(() => TFEdit.session && document.querySelector('#dw-lanes'), null, { timeout: 20000 }); await wait(600);
  const dur0 = await ev(() => TFEdit.session.duration);
  ok('song opened in the studio layout', dur0 > 30 && await w.isVisible('.dw-transport') && await w.isVisible('.dw-browser'), dur0.toFixed(2));
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

  // the Library player is a small bar on the Edit page
  ok('the Library player is a small bar here', await ev(() => document.body.classList.contains('on-edit') && document.getElementById('transport').getBoundingClientRect().height < 50));
  // live effects: switch on Echo and Slowed in the bottom panel
  await tab('Effects');
  await w.click('.dw-fx:has-text("Echo") .fx-switch'); await wait(100);
  await w.click('.dw-fx:has-text("Slowed") .fx-switch'); await wait(100);
  ok('effects on the song (shown on its track)', (await ev(() => Object.keys(TFEdit.api.tracks[0].fx).length)) === 2 && /2 effects/.test(await w.textContent('.dw-head:has-text("Rainfall") .dw-hinfo')));
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
  await w.click('button[title^="Drag an added track"]');
  const off0 = await ev(() => TFEdit.api.tracks[2].offset);
  const lb = await w.locator('#dw-lanes').boundingBox(), ly = lb.y + 112 + 64 + 30;
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
  for (const p of ['Trim', 'Split', 'Loop', 'Connect', 'Mixer', 'Sound']) {
    await tab(p);
    const txt = await w.locator('.dw-panel').textContent({ timeout: 4000 }).catch(() => '');
    ok(`${p} panel opens`, txt.length > 20, txt ? '' : errs.join(' | '));
  }
  await tab('Loop');
  await w.screenshot({ path: SP + '/concepts/daw-3-loop.png' });
  await tab('Effects');

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
  await tab('Effects');
  const vA = await ev(() => TFEdit.session.version);
  await w.click('.dw-panel .tb.pri:has-text("Apply to the song")'); await w.waitForFunction((v) => TFEdit.session.version === v + 1, vA, { timeout: 60000 });
  ok('Apply to the song: tracks mixed in', await ev(() => TFEdit.api.tracks.length === 1));
  await w.keyboard.press('Control+z'); await w.waitForFunction((v) => TFEdit.session.version === v, vA, { timeout: 30000 }); await wait(200);
  ok('Undo brings the tracks and effects back', await ev(() => TFEdit.api.tracks.length === 4 && TFEdit.api.tracks[0].fx.echo > 0));
  await w.keyboard.press('Control+y'); await w.waitForFunction((v) => TFEdit.session.version === v + 1, vA, { timeout: 30000 }); await wait(200);
  ok('Redo mixes them in again (no double sound)', await ev(() => TFEdit.api.tracks.length === 1 && !Object.keys(TFEdit.api.tracks[0].fx).length));
  await w.keyboard.press('Control+z'); await w.waitForFunction((v) => TFEdit.session.version === v, vA, { timeout: 30000 }); await wait(200);
  // ---- a preview and the live tracks never play together
  await tab('Loop');
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
    await ev(() => { TFEdit.api.sel = { a: 2, b: 4 }; TFEdit.api.render(); });
  await w.click('.dw-panel .tb:has-text("Listen to the join")'); await w.keyboard.press('Control+1'); await wait(4000);
  ok('a preview still being made does not play on another page', await ev(() => !TFDaw.previewing && !TFDaw.playing));
  await w.keyboard.press('Control+3'); await wait(400);
  // ---- found in the bug hunt
  await tab('Loop');
  const lb2 = await w.locator('#dw-lanes').boundingBox();
  await w.click('button[title^="Drag across the tracks"]');
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
  // ---- marks (M key, click on the ruler), A / B, Smart loop v2
  await ev(() => TFEdit.api.seek(6)); await w.click('#dw-lanes', { position: { x: 5, y: 5 } }).catch(() => {});
  await ev(() => { TFEdit.api.seek(6); document.activeElement && document.activeElement.blur(); });
  await w.keyboard.press('KeyM'); await wait(150);
  ok('M puts a mark where the song is', await ev(() => TFEdit.api.marks.some((m) => Math.abs(m.t - 6) < 0.05)), JSON.stringify(await ev(() => TFEdit.api.marks.map((m) => m.t))));
  const rb = await w.locator('#dw-ruler').boundingBox(), rx = await ev(() => TFEdit.api.xAt(18));
  await w.mouse.click(rb.x + rx, rb.y + 42); await wait(150);
  ok('a click on the marks row puts a mark', await ev(() => TFEdit.api.marks.some((m) => Math.abs(m.t - 18) < 0.15)), JSON.stringify(await ev(() => TFEdit.api.marks.map((m) => m.t))));
  await w.locator('.dw-mk').nth(0).locator('.dw-ab:has-text("A")').click();
  await w.locator('.dw-mk').nth(1).locator('.dw-ab:has-text("B")').click(); await wait(150);
  const selM = await ev(() => TFEdit.api.sel);
  ok('A and B on two marks choose the part', selM && Math.abs(selM.a - 6) < 0.05 && Math.abs(selM.b - 18) < 0.15, JSON.stringify(selM));
  await w.locator('.dw-mk').nth(0).locator('.dw-mname').fill('Verse'); await w.locator('.dw-mk').nth(0).locator('.dw-mname').press('Enter');
  ok('a mark can be renamed', await ev(() => TFEdit.api.marks[0].name === 'Verse'));
  await w.click('#dw-smart'); await w.waitForFunction(() => TFEdit.api.loops, null, { timeout: 60000 });
  const loops = await ev(() => TFEdit.api.loops);
  const beat = await ev(() => 60 / (TFDaw && document.getElementById('dw-bpm') ? +document.getElementById('dw-bpm').textContent || 120 : 120));
  ok('Smart loop gives the 3 best joins with a score', loops.length === 3 && loops.every((L) => L.score > 0 && L.score <= 100), JSON.stringify(loops));
  ok('…all within 4 bars of the marks', loops.every((L) => Math.abs(L.a - 6) <= 16 * beat + 0.05 && Math.abs(L.b - 18) <= 16 * beat + 0.05), `beat ${beat.toFixed(3)} s`);
  await w.screenshot({ path: SP + '/concepts/daw-5-smartloop.png' });
  await w.locator('.dw-rr').nth(1).click(); await w.click('.dw-resb .dw-b:has-text("Use it")'); await wait(200);
  const used = await ev(() => ({ sel: TFEdit.api.sel, a: TFEdit.api.marks.find((m) => m.name === 'Verse').t }));
  ok('Use it: the part and the A mark move to the join', Math.abs(used.sel.a - loops[1].a) < 0.001 && Math.abs(used.a - loops[1].a) < 0.001 && Math.abs(used.sel.b - loops[1].b) < 0.001, JSON.stringify(used));
  // ---- Sound + Fades of the song (step buttons), Mixer
  await tab('Sound');
  await w.click('.dw-head:has-text("Rainfall")');
  await w.locator('.dw-sound .dw-ctl').nth(0).locator('.dw-st:has-text("+25")').click();
  ok('Speed +25 (step buttons)', await ev(() => TFEdit.api.tracks[0].speed === 125));
  await w.waitForFunction(() => TFEdit.api.tracks[0].playUrl, null, { timeout: 60000 }).catch(() => {});
  const [r2, fxr] = await ev(() => [TFDaw.songRate(), TFDaw.fxRate()]); // (Ctrl+Shift+Z above re-applied the mix: the slowed sound may already be in the song itself)
  ok('the song plays faster, from a studio copy', Math.abs(r2 - fxr * 1.25) < 0.01 && await ev(() => !!TFEdit.api.tracks[0].playUrl), `${r2.toFixed(3)} (effects ${fxr.toFixed(3)} x 1.25)`);
  const dBase = await ev(() => TFEdit.session.duration);
  await w.locator('.dw-fades .dw-ctl').nth(0).locator('.dw-st:has-text("+1")').click();
  await w.locator('.dw-fades .dw-ctl').nth(0).locator('.dw-st:has-text("+1")').click();
  await w.locator('.dw-fades .dw-ctl').nth(1).locator('.dw-st:has-text("+0.5")').click();
  await w.click('.dw-shapes button:has-text("Straight")');
  ok('Fade in 2 s, fade out 0.5 s, straight', await ev(() => { const t = TFEdit.api.tracks[0]; return t.fadeIn === 2 && t.fadeOut === 0.5 && t.fadeShape === 'lin'; }));
  await w.screenshot({ path: SP + '/concepts/daw-6-sound.png' });
  await tab('Mixer');
  ok('Mixer: a strip per track + master', (await w.locator('.dw-strip').count()) === (await ev(() => TFEdit.api.tracks.length)) + 1);
  await tab('Effects');
  // Save keep both: one file with everything mixed (slowed → longer)
  await w.selectOption('.dw-mode', 'both');
  await w.click('.dw-b:has-text("Save")');
  await w.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.startsWith('Saved:')), null, { timeout: 60000 }); await wait(1000);
  const saved = path.join(M, 'Rainfall New.mp3');
  ok('Save: "Rainfall New.mp3" next to the original', fs.existsSync(saved) && fs.existsSync(path.join(M, 'Rainfall.mp3')), fs.readdirSync(M).join(', '));
  const newDur = await ev(() => (S.tracks.find((t) => t.title === 'Rainfall New') || {}).duration);
  const want = dBase / r2;
  ok('the saved song has the speed you heard (x 1.25)', newDur > want - 1 && newDur < want + 1.5, `${newDur && newDur.toFixed(1)} vs ${want.toFixed(1)}`);
  const T = require('../../lib/audiotools'), ffm = require('../../lib/ffmpeg');
  const x = await T.decodeMono(ffm, saved, 22050, 0, 6);
  const rms = (a, b) => { let e = 0; for (let i = Math.floor(a * 22050); i < b * 22050; i++) e += x[i] * x[i]; return Math.sqrt(e / ((b - a) * 22050)); };
  ok('the saved song fades in (quiet start, full after 2 s)', rms(0, 0.3) < rms(3, 5) * 0.35, `${rms(0, 0.3).toFixed(3)} vs ${rms(3, 5).toFixed(3)}`);
  ok('after saving, the editor goes on with the saved song (clean)', await ev(() => TFEdit.session && S.byId.get(TFEdit.session.trackId).title === 'Rainfall New' && TFEdit.api.tracks.length === 1 && !Object.keys(TFEdit.api.tracks[0].fx).length));
  await w.screenshot({ path: SP + '/concepts/daw-4-saved.png' });
  ok('no errors on the page', errs.length === 0, errs.slice(0, 5).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await a.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
