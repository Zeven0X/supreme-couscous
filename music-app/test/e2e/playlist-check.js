// Playlist check: a brand-new Tonix, playlists made, filled (right-click, drag, files), ordered, played, kept.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
const SP = process.env.SP; // SP/media holds the test songs (made by the developer)
const DATA = SP + '/userdata-pl'; fs.rmSync(DATA, { recursive: true, force: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
const launch = () => _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--force-device-scale-factor=2', '--autoplay-policy=no-user-gesture-required'], env: { ...process.env, TONIX_DATA: DATA } });
(async () => {
  let a = await launch(); let w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1320, height: 880 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  const media = ['Rainfall.mp3', 'Golden Hour.mp3', 'Iron Heart.mp3', 'Midnight Drive.mp3'].map((f) => path.join(SP, 'media', f));
  await ev((p) => importPaths(p), media.slice(0, 3)); await wait(500);
  // make a playlist
  await w.click('#lib-tabs button[data-tab=playlists]'); await wait(200);
  ok('empty playlists screen', await w.isVisible('.pl-empty'));
  await w.click('.pl-new'); await wait(200); await w.fill('.modal input', 'Road trip'); await w.keyboard.press('Enter'); await wait(400);
  ok('playlist made', (await ev(() => TFPlaylists.list.map((p) => p.name).join())) === 'Road trip');
  // right-click → Add to playlist
  await w.click('#lib-tabs button[data-tab=all]'); await wait(200);
  await w.click('.card >> nth=1'); await w.click('.card >> nth=1', { button: 'right' }); await w.click('#ctxmenu button:has-text("to playlist")'); await wait(200);
  await w.click('.pl-pick-row'); await wait(400);
  // drag a card onto the playlist in the bar
  await w.click('.card >> nth=0'); await w.locator('.card').nth(0).dragTo(w.locator('#pl-dropbar .pl-chip').first()).catch(() => {});
  await wait(500);
  let n = await ev(() => TFPlaylists.list[0].trackIds.length);
  if (n < 2) { // Playwright drag can miss the bar that appears mid-drag; drag by hand
    const c = await w.locator('.card').nth(0).boundingBox();
    await w.mouse.move(c.x + 40, c.y + 40); await w.mouse.down(); await w.mouse.move(c.x + 60, c.y + 60, { steps: 5 }); await wait(300);
    const t = await w.locator('#pl-dropbar .pl-chip').first().boundingBox();
    await w.mouse.move(t.x + 20, t.y + 10, { steps: 8 }); await w.mouse.up(); await wait(500);
    n = await ev(() => TFPlaylists.list[0].trackIds.length);
  }
  ok('right-click + drag added 2 songs', n === 2, n);
  // "Add files": a new file and one already in the library
  const r = await ev((p) => tf.importPaths(p), [media[3], media[2]]);
  ok('upload reports every song id (new + known)', r.ids.length === 2 && r.added.length === 1);
  await ev((x) => x.added.forEach(upsertTrack), r); // what the Add files button does with new songs
  await w.click('#lib-tabs button[data-tab=playlists]'); await wait(200);
  await ev(async (ids) => { const p = TFPlaylists.list[0]; await tf.playlistUpdate(p.id, { trackIds: [...p.trackIds, ...ids] }).then((x) => { TFPlaylists.setAll([x]); TFPlaylists.render(); }); }, r.ids);
  ok('4 songs in order', (await w.locator('.pl-row').count()) === 4);
  // reorder: drag row 4 above row 1
  const before = await ev(() => TFPlaylists.list[0].trackIds.slice());
  await w.locator('.pl-row').nth(3).dragTo(w.locator('.pl-row').nth(0), { targetPosition: { x: 100, y: 5 } }); await wait(500);
  const after = await ev(() => TFPlaylists.list[0].trackIds.slice());
  ok('drag to reorder', after[0] === before[3] && after.length === 4, JSON.stringify(after.map((x) => before.indexOf(x))));
  // play in order, next song follows the playlist
  await w.click('.pl-btns .tb.pri'); await w.waitForFunction(() => !audio.paused);
  ok('plays the first song', await ev(() => S.currentId === TFPlaylists.list[0].trackIds[0] && S.playlistId === TFPlaylists.list[0].id));
  await ev(() => nextSong()); await wait(300);
  ok('next = second in the playlist', await ev(() => S.currentId === TFPlaylists.list[0].trackIds[1]));
  // shuffle: random order, list unchanged
  await w.click('.pl-shuffle'); await wait(300);
  const listBefore = await ev(() => TFPlaylists.list[0].trackIds.join());
  await w.click('.pl-btns .tb.pri'); await wait(300);
  ok('shuffle on, list unchanged, queue has all songs', await ev(() => TFPlaylists.list[0].shuffle && S.queue.length === 4) && listBefore === await ev(() => TFPlaylists.list[0].trackIds.join()));
  // take one out, rename
  await w.locator('.pl-row').nth(1).hover(); await w.locator('.pl-row').nth(1).locator('.pl-x').click(); await wait(300);
  ok('take out of playlist (stays in library)', (await w.locator('.pl-row').count()) === 3 && (await ev(() => S.tracks.length)) === 4);
  await w.click('.pl-title'); await w.fill('.modal input', 'Night drive'); await w.keyboard.press('Enter'); await wait(300);
  ok('rename', (await w.textContent('.pl-title')) === 'Night drive');
  await w.screenshot({ path: SP + '/concepts/playlists.png' });
  await a.close();
  // restart: kept
  a = await launch(); w = await a.firstWindow(); w.on('pageerror', (e) => errs.push(e.message)); await w.waitForFunction(() => window.__tfReady);
  ok('after restart: playlist kept', await w.evaluate(() => TFPlaylists.list.length === 1 && TFPlaylists.list[0].name === 'Night drive' && TFPlaylists.list[0].trackIds.length === 3 && TFPlaylists.list[0].shuffle));
  // removing a song from the library takes it out of the playlist
  await w.evaluate(() => { S.selected = [TFPlaylists.list[0].trackIds[0]]; S.settings.confirmRemove = false; return removeSelected(); }); await w.waitForTimeout(300);
  ok('removed song leaves the playlist', await w.evaluate(() => TFPlaylists.list[0].trackIds.length === 2));
  await w.click('#lib-tabs button[data-tab=playlists]'); await w.waitForTimeout(200);
  await w.click('.pl-btns .tb.danger'); await w.click('.modal .btn.danger'); await w.waitForTimeout(300);
  ok('delete playlist, songs stay', await w.evaluate(() => TFPlaylists.list.length === 0 && S.tracks.length === 3));
  await a.close();
  console.log(`PLAYLIST CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors ${errs.join(' | ')}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
