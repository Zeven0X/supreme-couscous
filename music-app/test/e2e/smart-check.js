// Smart playlists check: Tonix makes "6⭐ Rock" style playlists by itself and keeps them up to date.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
// SP/media holds the test songs (made by the developer)
const SP = process.env.SP; const DATA = SP + '/userdata-smart'; fs.rmSync(DATA, { recursive: true, force: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
const launch = () => _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--force-device-scale-factor=2', '--autoplay-policy=no-user-gesture-required'], env: { ...process.env, TONIX_DATA: DATA } });
(async () => {
  let a = await launch(); let w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1320, height: 880 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  await ev((p) => importPaths(p), ['Rainfall.mp3', 'Golden Hour.mp3', 'Iron Heart.mp3', 'Midnight Drive.mp3'].map((f) => path.join(SP, 'media', f))); await wait(500);
  await ev(async () => { for (const t of S.tracks) { const u = await tf.updateTrack(t.id, { genre: t.title === 'Golden Hour' ? 'Pop' : 'Rock' }); upsertTrack(u); } renderGrid(); });
  await w.click('#lib-tabs button[data-tab=playlists]'); await wait(200);
  ok('no stars yet: a hint, no smart playlists', (await w.locator('.pl-item.smart').count()) === 0);
  // rate on the cards: Rainfall 6, Golden Hour 2, Iron Heart 6, Midnight Drive 9
  await w.click('#lib-tabs button[data-tab=all]'); await wait(200);
  const rate = async (title, n) => { const c = w.locator('.card', { hasText: title }); await c.hover(); await c.locator('.star').nth(n - 1).click(); await wait(250); };
  await rate('Rainfall', 6); await rate('Golden Hour', 2); await rate('Iron Heart', 6); await rate('Midnight Drive', 9);
  await w.click('#lib-tabs button[data-tab=playlists]'); await wait(300);
  const names = async () => (await w.locator('.pl-item.smart b').allTextContents()).join(', ');
  ok('Tonix made them by itself', (await names()) === '2⭐ Pop, 9⭐ Rock, 6⭐ Rock', await names());
  await w.click('.pl-item.smart:has-text("6⭐ Rock")'); await wait(200);
  ok('6⭐ Rock = the two Rock songs with exactly 6 stars', (await w.locator('.pl-row').count()) === 2);
  ok('no rename / delete / add files on a smart playlist', (await w.locator('.pl-btns2 .tb').count()) === 1 && (await w.locator('.pl-x').count()) === 0);
  await w.screenshot({ path: SP + '/concepts/smart-playlists.png' });
  // rate Iron Heart 9: it moves to 9⭐ Rock by itself
  await w.click('#lib-tabs button[data-tab=all]'); await wait(200); await rate('Iron Heart', 9);
  await w.click('#lib-tabs button[data-tab=playlists]'); await wait(300);
  ok('a re-rated song moves by itself', (await names()) === '2⭐ Pop, 9⭐ Rock, 6⭐ Rock' && (await ev(() => TFPlaylists.smart.find((p) => p.name === '9⭐ Rock').trackIds.length)) === 2);
  // play + shuffle, kept after restart
  await w.click('.pl-item.smart:has-text("9⭐ Rock")'); await wait(200);
  await w.click('.pl-shuffle'); await wait(200); await w.click('.pl-btns .tb.pri'); await w.waitForFunction(() => !audio.paused);
  ok('plays a song from 9⭐ Rock', await ev(() => TFPlaylists.smart.find((p) => p.name === '9⭐ Rock').trackIds.includes(S.currentId)));
  await w.click('.pl-btns2 .tb:has-text("Save")'); await wait(300);
  ok('Save: album name = "9⭐ Rock"', (await w.inputValue('.save-win .sv-grid input >> nth=0')) === '9⭐ Rock'); await w.keyboard.press('Escape');
  await a.close();
  a = await launch(); w = await a.firstWindow(); w.on('pageerror', (e) => errs.push(e.message)); await w.waitForFunction(() => window.__tfReady);
  ok('after restart: smart playlists + shuffle kept', await w.evaluate(() => TFPlaylists.smart.length === 3 && TFPlaylists.smart.find((p) => p.name === '9⭐ Rock').shuffle));
  await a.close();
  console.log(`SMART CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors ${errs.join(' | ')}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
