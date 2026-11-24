// Bug-hunt fixes check (2026-11-24): each line is a bug that was found and fixed.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
// SP/media holds the test songs (made by the developer)
const SP = process.env.SP; const DATA = SP + '/userdata-bugfix'; fs.rmSync(DATA, { recursive: true, force: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
(async () => {
  const a = await _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'], env: { ...process.env, TONIX_DATA: DATA } });
  const w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1080, height: 700 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  await ev((p) => importPaths(p), ['Rainfall.mp3', 'Golden Hour.mp3', 'Iron Heart.mp3'].map((f) => path.join(SP, 'media', f))); await wait(400);
  // a bad web address to Tonix's own little server must not crash it
  const status = await ev(async () => { const base = S.tracks[0].mediaUrl.split('/media/')[0]; const r = await fetch(`${base}/media/%E0%A4%A`).catch(() => null); const r2 = await fetch(S.tracks[0].mediaUrl, { headers: { Range: 'bytes=-999999999' } }); return [r && r.status, r2.status]; });
  ok('bad address → 400, huge range → plays from the start (no crash)', status[0] === 400 && status[1] === 206, JSON.stringify(status));
  // Esc closes only the top window
  await ev(() => { modal((b) => b.append(h('h2', {}, 'first'))); setTimeout(() => modal((b) => b.append(h('h2', {}, 'second'))), 50); }); await wait(200);
  await w.keyboard.press('Escape'); await wait(150);
  ok('Esc closes only the top window', (await ev(() => [...document.querySelectorAll('.modal h2')].map((x) => x.textContent).join())) === 'first');
  await w.keyboard.press('Escape'); await wait(100);
  // Playlists tab: Ctrl+A / Delete don't touch the hidden library
  await w.click('#lib-tabs button[data-tab=playlists]'); await wait(200);
  await ev(() => { S.selected = []; document.activeElement.blur(); });
  await w.keyboard.press('Control+a'); await w.keyboard.press('Delete'); await wait(200);
  ok('Playlists tab: Ctrl+A + Delete do nothing', (await ev(() => S.selected.length)) === 0 && !(await w.isVisible('.modal')));
  // typing a search on the Playlists tab shows the songs
  await w.fill('#search', 'Rain'); await wait(200);
  ok('search on the Playlists tab switches to the songs', await ev(() => S.libTab === 'all' && document.querySelectorAll('#grid .card').length === 1));
  await w.fill('#search', ''); await wait(100);
  // recording a shortcut stops when you leave Settings
  await w.keyboard.press('Control+4'); await wait(300);
  await w.click('.snav button:has-text("Keyboard")').catch(() => ev(() => TFSettings.open('keyboard'))); await wait(300);
  await w.locator('.kr:not(.fixed)').first().click(); await wait(100);
  await w.keyboard.press('Control+1'); await wait(200);
  await w.fill('#search', 'k'); await wait(150);
  ok('shortcut recording stops on leaving Settings (typing works)', (await w.inputValue('#search')) === 'k');
  await w.fill('#search', ''); await ev(() => document.activeElement.blur());
  // removing the playing map song stops the map
  await w.keyboard.press('Control+2'); await wait(500);
  await w.keyboard.press('a'); await wait(300); await w.click('.pick >> nth=0'); await w.click('.modal .btn.primary'); await wait(300);
  await w.keyboard.press('Control+Enter'); await w.waitForFunction(() => TFMap.playing && !audio.paused, null, { timeout: 15000 });
  await ev(async () => { S.settings.confirmRemove = false; S.selected = [S.currentId]; await removeSelected(); }); await wait(300);
  ok('removing the playing map song stops the map', await ev(() => !TFMap.playing && !S.playStop));
  // one song + shuffle doesn't repeat forever
  await ev(() => { S.filters.q = S.tracks[0].title; S.settings.shuffle = true; playTrack(S.tracks[0].id); }); await wait(300); // only 1 song shown = a pool of 1
  ok('one song in the pool + shuffle: no "Alpha Alpha Alpha"', await ev(() => S.queue.filter((id) => id === S.currentId).length === 1));
  // time shown at the song's speed
  await ev(() => { cur().fx.speed = 50; applyFx(); drawWave(); }); await wait(100);
  ok('time shows the listening length at 50% speed', await ev(() => document.querySelector('#t-dur').textContent === fmtTime(cur().duration * 2)));
  await a.close();
  console.log(`BUGFIX CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors ${errs.join(' | ')}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
