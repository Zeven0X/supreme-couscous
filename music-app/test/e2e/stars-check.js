// Stars + information inside files: rate, filter, save, then upload the saved file into a brand-new Tonix.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
// SP/media holds the test songs (made by the developer)
const SP = process.env.SP; const DATA = SP + '/userdata-stars', DATA2 = SP + '/userdata-stars2';
for (const d of [DATA, DATA2]) fs.rmSync(d, { recursive: true, force: true });
const OUT = SP + '/stars-out'; fs.rmSync(OUT, { recursive: true, force: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
const launch = (d) => _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--force-device-scale-factor=2'], env: { ...process.env, TONIX_DATA: d } });
(async () => {
  let a = await launch(DATA); let w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1320, height: 880 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  await ev((p) => importPaths(p), ['Rainfall.mp3', 'Golden Hour.mp3', 'Iron Heart.mp3', 'Midnight Drive.mp3'].map((f) => path.join(SP, 'media', f))); await wait(500);
  await ev((o) => { S.settings.exportDir = o; S.selected = []; markSelection(); }, OUT);
  // rate on the cards: 7, 3, 9 stars (4th song: none)
  for (const [i, n] of [[0, 7], [1, 3], [2, 9]]) { await w.locator('.card').nth(i).hover(); await w.locator('.card').nth(i).locator('.star').nth(n - 1).click(); await wait(250); }
  ok('stars saved', JSON.stringify(await ev(() => S.tracks.map((t) => t.stars || 0))) === '[7,3,9,0]', JSON.stringify(await ev(() => S.tracks.map((t) => t.stars || 0))));
  ok('clicking a card star does not select the card', (await ev(() => S.selected.length)) === 0);
  // filter: 6 or more, then 4 or less, then exactly 3, then clear
  await w.locator('#f-stars .star').nth(5).click(); await wait(200);
  ok('6⭐ or more → 2 songs', (await w.locator('#grid .card').count()) === 2);
  await w.click('#f-stars button:has-text("or less")'); await wait(200);
  ok('6⭐ or less → 1 song (3⭐; unrated hidden)', (await w.locator('#grid .card').count()) === 1);
  await w.locator('#f-stars .star').nth(2).click(); await w.click('#f-stars button:has-text("exactly")'); await wait(200);
  ok('exactly 3⭐ → 1 song', (await w.locator('#grid .card').count()) === 1);
  await w.screenshot({ path: SP + '/concepts/stars-library.png' });
  await w.click('#f-clear'); await wait(200);
  ok('Clear shows all again', (await w.locator('#grid .card').count()) === 4);
  // Save song window: stars + track number; blacklist + plays travel too
  await ev(async () => { const id = S.tracks[2].id; await setMark([id], 'black'); S.tracks[2].plays = 0; });
  await w.click('.card >> nth=2'); await w.keyboard.press('Control+s'); await wait(400);
  ok('save window shows the stars', (await w.locator('.sv-stars .star.on').count()) === 9);
  await w.locator('.sv-stars .star').nth(7).click(); // change to 8
  await w.fill('.save-win .sv-grid label:has-text("Track number") input', '3/12');
  await w.locator('.modal').screenshot({ path: SP + '/concepts/stars-save.png' });
  await w.click('.sv-r .seg button:has-text("M4A")'); await w.click('.save-win .foot .btn.primary');
  await w.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.startsWith('Saved:')), null, { timeout: 30000 });
  ok('stars changed in the window are kept', await ev(() => S.tracks[2].stars === 8 && S.tracks[2].track === '3/12'));
  const saved = fs.readdirSync(OUT).filter((f) => f.endsWith('.m4a')).map((f) => path.join(OUT, f))[0];
  ok('M4A saved', !!saved, saved);
  await a.close();
  // a friend (or you, later) uploads that file into a brand-new Tonix
  a = await launch(DATA2); w = await a.firstWindow(); w.on('pageerror', (e) => errs.push(e.message)); await w.waitForFunction(() => window.__tfReady);
  await w.evaluate((p) => importPaths(p), [saved]); await w.waitForTimeout(500);
  const t = await w.evaluate(() => { const x = S.tracks[0]; return { stars: x.stars, mark: x.mark, track: x.track, label: x.label, album: x.album }; });
  ok('upload brings back stars, blacklist, track number, label', t.stars === 8 && t.mark === 'black' && /^3/.test(t.track) && !!t.label, JSON.stringify(t));
  ok('blacklist starts fresh in the new library', await w.evaluate(() => TFShuffle.badge(S.tracks[0], S.playClock, 1) === 'black'));
  await a.close();
  console.log(`STARS CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors ${errs.join(' | ')}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
