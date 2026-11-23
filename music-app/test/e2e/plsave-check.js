// Save playlist check: one file per song (numbered, album = playlist name) and one big file with chapters.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
// SP/media holds the test songs (made by the developer)
const SP = process.env.SP; const DATA = SP + '/userdata-plsave'; fs.rmSync(DATA, { recursive: true, force: true });
const OUT = SP + '/plsave-out'; fs.rmSync(OUT, { recursive: true, force: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
const ff = require('../../lib/ffmpeg');
(async () => {
  const a = await _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--force-device-scale-factor=2'], env: { ...process.env, TONIX_DATA: DATA } });
  const w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady); await w.setViewportSize({ width: 1320, height: 900 });
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  await ev((p) => importPaths(p), ['Rainfall.mp3', 'Golden Hour.mp3', 'Iron Heart.mp3'].map((f) => path.join(SP, 'media', f))); await wait(500);
  await ev(async (o) => { S.settings.exportDir = o; const p = await tf.playlistCreate('Night drive', S.tracks.map((t) => t.id).reverse()); TFPlaylists.setAll([p]); }, OUT);
  const plCoverImg = path.join(SP, 'media', 'c2.png');
  await ev(async (img) => { const r = await tf.playlistCover(TFPlaylists.list[0].id, img); TFPlaylists.setAll([r]); }, plCoverImg);
  await w.click('#lib-tabs button[data-tab=playlists]'); await wait(300);
  await w.click('.pl-btns .tb:has-text("Save")'); await wait(500);
  ok('album name = playlist name', (await w.inputValue('.save-win .sv-grid input >> nth=0')) === 'Night drive');
  ok('3 songs in playlist order', (await w.locator('.save-win .song-row').count()) === 3);
  await w.locator('.modal').screenshot({ path: SP + '/concepts/save-playlist.png' });
  // one file per song, FLAC
  await w.click('.sv-r .seg button:has-text("FLAC")'); await w.click('.save-win .foot .btn.primary'); await wait(9000);
  const folder = path.join(OUT, 'Night drive');
  const files = fs.existsSync(folder) ? fs.readdirSync(folder).sort() : [];
  ok('folder with numbered FLAC files + cover', files.length === 4 && files[0].startsWith('01 - ') && files.filter((f) => f.endsWith('.flac')).length === 3, files.join(', '));
  const order = await ev(() => TFPlaylists.list[0].trackIds.map((id) => S.byId.get(id).title));
  if (files.length) {
    const p1 = await ff.probe(path.join(folder, files[0]));
    ok('first file = first playlist song, tags', p1.tags.title === order[0] && p1.tags.album === 'Night drive', `${p1.tags.title} / ${p1.tags.album}`);
    ok('picture inside the file', p1.info.coverStream !== null);
  }
  // one big file, M4A (remembered choices: FLAC is not allowed for one big file)
  await w.click('.pl-btns .tb:has-text("Save")'); await wait(400);
  ok('remembered: FLAC + folder', (await w.textContent('.sv-r .seg button.on')) === 'FLAC' && (await w.textContent('.sv-dir')) === OUT);
  await w.click('.sv-mode:has-text("One big file")'); await wait(200);
  ok('one big file: only MP3 / M4A', await ev(() => [...document.querySelectorAll('.sv-r .seg')[0].querySelectorAll('button')].filter((b) => !b.disabled).map((b) => b.textContent).join()) === 'MP3,M4A');
  await ev(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await w.click('.sv-r .seg button:has-text("M4A")'); await w.click('.save-win .foot .btn.primary');
  await w.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.startsWith('Saved:')), null, { timeout: 60000 });
  const big = path.join(OUT, 'Night drive.m4a');
  ok('one big M4A saved', fs.existsSync(big));
  if (fs.existsSync(big)) { const { stderr } = await ff.run(['-i', big, '-f', 'null', '-']); ok('chapter for each song', (stderr.split('Output #0')[0].match(/Chapter #/g) || []).length === 3); }
  await a.close();
  console.log(`PLAYLIST SAVE CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors ${errs.join(' | ')}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
