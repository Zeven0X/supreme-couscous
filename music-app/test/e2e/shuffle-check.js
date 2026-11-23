// Smart shuffle check: marks, counted plays, 3 songs ahead, no repeats, back to normal.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
// SP/media holds the test songs (made by the developer)
const SP = process.env.SP; const DATA = SP + '/userdata-shuf'; fs.rmSync(DATA, { recursive: true, force: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
const launch = () => _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--force-device-scale-factor=2', '--autoplay-policy=no-user-gesture-required'], env: { ...process.env, TONIX_DATA: DATA } });
(async () => {
  let a = await launch(); let w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1320, height: 880 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  const media = ['Rainfall.mp3', 'Golden Hour.mp3', 'Iron Heart.mp3', 'Midnight Drive.mp3', 'nocover.flac'].map((f) => path.join(SP, 'media', f));
  await ev((p) => importPaths(p), media); await wait(500);
  await ev(async () => { const p = await tf.playlistCreate('Mix', S.tracks.map((t) => t.id)); TFPlaylists.setAll([p]); });
  await w.click('#lib-tabs button[data-tab=playlists]'); await wait(200);
  await w.click('.pl-shuffle'); await wait(300);
  // blacklist the first row with its 🚫 button
  const blackId = await ev(() => TFPlaylists.list[0].trackIds[0]);
  await w.locator('.pl-row').nth(0).hover(); await w.locator('.pl-row').nth(0).locator('.pl-mk.black').click(); await wait(400);
  ok('🚫 marks the song', await ev((id) => S.byId.get(id).mark === 'black', blackId));
  ok('🚫 stays visible on the row', await w.locator('.pl-row').nth(0).locator('.pl-mk.black.on').count() === 1);
  await w.locator('.pl-row').nth(1).hover(); await w.locator('.pl-row').nth(1).locator('.pl-mk.fav').click(); await wait(300);
  await w.click('.pl-btns .tb.pri'); await w.waitForFunction(() => !audio.paused);
  ok('3 songs lined up ahead', await ev(() => S.queue.length - S.queue.indexOf(S.currentId) - 1 >= 3));
  // play 40 songs quickly: each "heard" 40 s, then Next
  const order = [];
  for (let i = 0; i < 40; i++) { order.push(await ev(() => S.currentId)); await ev(() => { S.heard = 40; nextSong(); }); await wait(60); }
  await wait(500);
  ok('never the same song twice in a row', order.every((id, i) => i === 0 || id !== order[i - 1]));
  ok('plays were counted', (await ev(() => S.playClock)) >= 38, await ev(() => S.playClock));
  const blackPlays = order.filter((id) => id === blackId).length;
  const early = order.slice(0, 18).filter((id) => id === blackId).length, late = order.slice(22).filter((id) => id === blackId).length;
  ok('blacklisted song rare while blacklisted (first 20 plays)', early <= 2, `${early} of 18`);
  ok('back to normal afterwards: it comes again', late >= 2, `${late} of 18`);
  ok('every song gets a turn', new Set(order).size === 5, new Set(order).size);
  // short listens do not count
  const before = await ev(() => S.playClock);
  await ev(() => { S.heard = 5; nextSong(); }); await wait(300);
  ok('5 s listen does not count', (await ev(() => S.playClock)) === before);
  // marks end by themselves after songs x 4 = 20 plays (they were set at clock 0)
  ok('blacklist over after 20 plays (5 songs x 4)', await ev((id) => TFShuffle.badge(S.byId.get(id), S.playClock, 5) !== 'black', blackId));
  await w.screenshot({ path: SP + '/concepts/shuffle.png' });
  await a.close();
  a = await launch(); w = await a.firstWindow(); await w.waitForFunction(() => window.__tfReady);
  ok('after restart: play clock + stamps kept', await w.evaluate(() => S.playClock >= 38 && S.tracks.some((t) => (t.stamps || []).length > 3)));
  await a.close();
  console.log(`SHUFFLE CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors ${errs.join(' | ')}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
