// Pitch check: a brand-new Tonix plays a 440 Hz tone with the pitch changed and we listen to what comes out.
const { _electron } = require('playwright'); const fs = require('fs'), path = require('path');
const SP = process.env.SP; // SP/pmedia holds "Tone 440.mp3" (a 60 s, 440 Hz tone)
const DATA = SP + '/userdata-pitch'; fs.rmSync(DATA, { recursive: true, force: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) { pass++; console.log('✓', n, x); } else { fail++; console.log('✗', n, x); } };
(async () => {
  const a = await _electron.launch({ executablePath: 'node_modules/electron/dist/electron', args: ['.', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'], env: { ...process.env, TONIX_DATA: DATA } });
  const w = await a.firstWindow(); const errs = []; w.on('pageerror', (e) => errs.push(e.message));
  await w.waitForFunction(() => window.__tfReady);
  const ev = (f, x) => w.evaluate(f, x), wait = (ms) => w.waitForTimeout(ms);
  await ev((p) => importPaths(p), [path.join(SP, 'pmedia', 'Tone 440.mp3')]); await wait(400);
  await w.dblclick('.card >> nth=0'); await w.waitForFunction(() => !audio.paused && audio.duration > 0);
  // listen to what the player sends to the speakers
  await ev(() => { window.__an = []; for (const d of decks) { const an = actx.createAnalyser(); an.fftSize = 16384; an.smoothingTimeConstant = 0; d.gain.connect(an); window.__an.push(an); } });
  const freq = () => ev(() => { const an = window.__an[decks.indexOf(deck)]; const b = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(b); let m = 0; for (let i = 1; i < b.length; i++) if (b[i] > b[m]) m = i; return Math.round(m * actx.sampleRate / an.fftSize); });
  await wait(600); ok('plain tone is 440 Hz', Math.abs(await freq() - 440) < 6, await freq());
  // change the pitch while playing
  const t0 = Date.now();
  await w.fill('.fx[data-key=pitch] .fx-val', '150'); await w.press('.fx[data-key=pitch] .fx-val', 'Enter');
  ok('old sound goes on while preparing', Math.abs(await freq() - 440) < 6);
  await w.waitForFunction(() => TFStudio.status(deck) === 'ready', null, { timeout: 15000 });
  ok('clean pitch ready', true, `${Date.now() - t0} ms`);
  await wait(500);
  ok('you hear 660 Hz (150%)', Math.abs(await freq() - 660) < 8, await freq());
  ok('status text', (await w.textContent('#fx-studio')) === 'Studio quality');
  ok('original is silent', await ev(() => deck.orig.gain.value < 0.01));
  const inStep = () => ev(() => { const s = deck.st.on; return Math.abs(s.el.currentTime * s.r.tempo + s.r.start - audio.currentTime); });
  const drift = await inStep();
  ok('copy plays in step', drift < 0.12, drift.toFixed(3));
  // whole song copy replaces the quick part
  await w.waitForFunction(() => deck.st.on && deck.st.on.r && deck.st.on.r.end === 0, null, { timeout: 20000 });
  ok('whole-song copy in use', true);
  // jump far ahead: right pitch straight away (whole copy is ready)
  await ev(() => seek(45)); await wait(500);
  ok('after a jump still 660 Hz', Math.abs(await freq() - 660) < 8, await freq());
  // speed: the studio tool makes a new copy at 80% speed, played at normal rate
  await w.fill('.fx[data-key=speed] .fx-val', '80'); await w.press('.fx[data-key=speed] .fx-val', 'Enter');
  await w.waitForFunction(() => TFStudio.status(deck) === 'ready', null, { timeout: 15000 }); await wait(600);
  ok('speed 80% keeps 660 Hz', Math.abs(await freq() - 660) < 8, await freq());
  ok('speed copy plays at normal rate', await ev(() => deck.st.on.el.playbackRate === 1 && deck.st.on.r.tempo === 0.8));
  const d3 = await inStep(); ok('speed copy in step with the song clock', d3 < 0.12, d3.toFixed(3));
  const t3 = await ev(() => audio.currentTime); await wait(2000); const moved = (await ev(() => audio.currentTime)) - t3;
  ok('song clock moves at 80%', Math.abs(moved - 1.6) < 0.25, moved.toFixed(2));
  // Natural voice switch makes a new copy
  await w.click('#fx-natural'); ok('natural off saved', await ev(() => cur().fx.natural === false));
  await w.waitForFunction(() => TFStudio.status(deck) === 'ready', null, { timeout: 15000 }); await wait(400);
  ok('classic voice still 660 Hz', Math.abs(await freq() - 660) < 8, await freq());
  // pause / play keeps the copy in step
  await ev(() => pause()); await wait(400); await ev(() => play()); await wait(600);
  const drift2 = await inStep();
  ok('in step after pause', drift2 < 0.12, drift2.toFixed(3));
  // pitch back to 100% but speed still 80%: still the studio copy (speed only)
  await w.click('.fx[data-key=pitch] .rs');
  await w.waitForFunction(() => TFStudio.status(deck) === 'ready', null, { timeout: 15000 }); await wait(500);
  ok('speed only: studio copy, 440 Hz', Math.abs(await freq() - 440) < 6 && await ev(() => deck.orig.gain.value < 0.01), await freq());
  // back to 100% speed too: the original plays again
  await w.click('.fx[data-key=speed] .rs'); await wait(400);
  ok('100% plays the original', Math.abs(await freq() - 440) < 6 && await ev(() => deck.orig.gain.value > 0.99), await freq());
  // a song that starts with a changed pitch waits for the clean copy instead of playing it wrong
  await w.fill('.fx[data-key=pitch] .fx-val', '75'); await w.press('.fx[data-key=pitch] .fx-val', 'Enter');
  await ev(() => pause());
  const t1 = Date.now(); await ev(() => { loadTrack(S.tracks[0].id, { autoplay: false }); return play(); });
  ok('start waits for the clean copy', await ev(() => TFStudio.status(deck) === 'ready'), `${Date.now() - t1} ms`);
  await wait(500); ok('starts at 330 Hz', Math.abs(await freq() - 330) < 6, await freq());
  const saved = await ev(() => { const t = cur(); return t.fx.pitch; }); ok('pitch kept', saved === 75);
  await a.close();
  console.log(`PITCH CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
})().catch((e) => { console.log('FAIL', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
