'use strict';
// Sound editor tools on real sound: silence, loudness, smart loop, beats, and every recipe runs in ffmpeg.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ff = require('../lib/ffmpeg');
const T = require('../lib/audiotools');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tonix-tools-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const dur = async (f) => (await ff.probe(f)).info.duration;
async function render(graph, out, inputs = []) {
  await ff.run(['-y', ...inputs.flatMap((f) => ['-i', f]), '-filter_complex', graph, '-map', '[out]', '-c:a', 'flac', out]);
  return dur(out);
}
// 1.5 s quiet, 3 s tone, 2 s quiet, 3 s tone (half as loud), 1 s quiet = 10.5 s
const song = path.join(tmp, 'gaps.wav');
test.before(async () => {
  await ff.run(['-y', '-f', 'lavfi', '-i', "aevalsrc='if(between(t,1.5,4.5),0.5*sin(2*PI*330*t),if(between(t,6.5,9.5),0.25*sin(2*PI*440*t),0))':s=44100:d=10.5", '-ac', '2', song]);
});

test('silence: trim finds the quiet start and end, split finds the gap', async () => {
  const sil = await T.silences(ff, song, T.TRIM_LEVELS.quiet, 0.3);
  const t = T.trimPoints(sil, 10.5);
  assert.ok(Math.abs(t.head - 1.5) < 0.05 && Math.abs(t.tail - 9.5) < 0.05, JSON.stringify(t));
  const cuts = T.splitPoints(await T.silences(ff, song, -40, 1), 10.5);
  assert.strictEqual(cuts.length, 1);
  assert.ok(Math.abs(cuts[0] - 5.5) < 0.05, `cut at ${cuts[0]}`);
  assert.deepStrictEqual(T.trimPoints([], 10), { head: 0, tail: 10 }, 'nothing quiet: nothing to trim');
});

test('same loudness: the quieter part gets louder, then both match', async () => {
  const louds = [await T.loudness(ff, song, 1.5, 4.5), await T.loudness(ff, song, 6.5, 9.5)];
  assert.ok(louds[0] - louds[1] > 5, `${louds}`);
  const vols = T.sameLoudness(louds);
  const after = louds.map((l, i) => l + 20 * Math.log10(vols[i] / 100));
  assert.ok(Math.abs(after[0] - after[1]) < 0.3, `after: ${after}`);
  assert.deepStrictEqual(T.sameLoudness([-70, -70]), [100, 100], 'silent parts are left alone');
});

test('smart loop: the loop length lands on a whole number of waves', async () => {
  const f = path.join(tmp, 'sine.wav');
  await ff.run(['-y', '-f', 'lavfi', '-i', 'sine=frequency=200:sample_rate=22050:duration=4', f]);
  const x = await T.decodeMono(ff, f, 22050);
  const r = T.smartLoop(x, 22050, 1.0, 2.0123);
  const waves = (r.b - r.a) * 200;
  assert.ok(Math.abs(waves - Math.round(waves)) < 0.03, `${waves} waves`);
  assert.ok(Math.abs(r.b - 2.0123) < 0.25);
});

test('beats: a 120 BPM click is found, tempos can be matched', async () => {
  const f = path.join(tmp, 'click.wav');
  await T.makeSound(ff, 'beat', f);
  const x = await T.decodeMono(ff, f, 22050, 0, 12);
  const b = T.beats(x, 22050);
  assert.ok(Math.abs(b.bpm - 120) < 2, `bpm ${b.bpm}`);
  assert.ok(b.times.length > 15);
  assert.strictEqual(T.snapToBeat(1.04, [0, 0.5, 1, 1.5]), 1);
  assert.strictEqual(T.snapToBeat(1.3, [0, 0.5, 1, 1.5], 0.1), 1.3, 'too far from a beat: stays');
  assert.strictEqual(T.tempoMatch(120, 90), 1.3333);
  assert.strictEqual(T.tempoMatch(120, 240), 1);
  assert.strictEqual(T.tempoMatch(120, 60), 1);
});

test('effects: each one and all together work; slowed is longer, nightcore shorter', async () => {
  for (const k of T.EFFECTS) {
    const d = await render(T.effectChain({ [k]: 60 }), path.join(tmp, `fx-${k}.flac`), [song]);
    if (k === 'slowed') assert.ok(d > 11.5, `slowed ${d}`);
    else if (k === 'nightcore') assert.ok(d < 9.6, `nightcore ${d}`);
    else assert.ok(Math.abs(d - 10.5) < 0.6, `${k} ${d}`);
  }
  const all = await render(T.effectChain(Object.fromEntries(T.EFFECTS.map((k) => [k, 50]))), path.join(tmp, 'fx-all.flac'), [song]);
  assert.ok(all > 5);
  assert.strictEqual(T.effectChain({}), null);
});

test('loop: A..B three times makes the song longer by 2 x (B - A)', async () => {
  assert.strictEqual(T.loopLength(2, 4, 3, 10.5), 14.5);
  const d = await render(T.loopGraph(2, 4, 3, 10.5), path.join(tmp, 'loop.flac'), [song]);
  assert.ok(Math.abs(d - 14.5) < 0.05, `loop ${d}`);
  const d2 = await render(T.loopGraph(0, 2, 2, 10.5), path.join(tmp, 'loop0.flac'), [song]);
  assert.ok(Math.abs(d2 - 12.5) < 0.05, `loop from the start ${d2}`);
});

test('layers: delay, repeat until the end, auto-quiet, solo / mute', async () => {
  const rain = path.join(tmp, 'rain.flac');
  await T.makeSound(ff, 'rain', rain);
  assert.ok(Math.abs((await dur(rain)) - 30) < 0.1);
  const g = T.mixGraph([{ offset: 2, from: 0, to: 1.5, volume: 80, pan: -50, repeat: 0, duck: true }, { offset: 0, from: 0, to: 3, mute: true }], 10.5);
  const d = await render(g, path.join(tmp, 'mix.flac'), [song, rain, rain]);
  assert.ok(Math.abs(d - 10.5) < 0.1, `mix ${d}`);
  const solo = T.mixGraph([{ offset: 0, from: 0, to: 2, solo: true }, { offset: 0, from: 0, to: 2 }], 10.5);
  assert.ok(solo.includes('[1:a]') && !solo.includes('[2:a]'), 'only the solo layer is mixed');
  assert.ok(T.mixGraph([{ mute: true }], 10.5).endsWith('[out]'));
  assert.strictEqual(T.panFilter(-100), 'pan=stereo|c0=1.000*c0|c1=0.000*c1');
});

test('smart connect: a piece joins in, with blends, from this song or another one', async () => {
  const c1 = T.connectGraph({ P: 5, a: 2, b: 4, src: 0, after: 'continue', blend: 'smooth', dur: 10.5 });
  const d1 = await render(c1.graph, path.join(tmp, 'con1.flac'), [song]);
  assert.ok(Math.abs(d1 - c1.length) < 0.05 && Math.abs(d1 - 11.5) < 0.05, `continue ${d1} vs ${c1.length}`);
  const c2 = T.connectGraph({ P: 3, a: 0, b: 2, src: 1, after: 'end', blend: 'hard', dur: 10.5 });
  const d2 = await render(c2.graph, path.join(tmp, 'con2.flac'), [song, song]);
  assert.ok(Math.abs(d2 - c2.length) < 0.05 && d2 < 5.1, `end ${d2}`);
  const c3 = T.connectGraph({ P: 5, a: 1, b: 9, src: 1, after: 'continue', blend: 'long', dur: 10.5 });
  assert.ok(Math.abs((await render(c3.graph, path.join(tmp, 'con3.flac'), [song, song])) - c3.length) < 0.05);
});

test('smart connect at the very start or the very end still works (found in review)', async () => {
  for (const [P, after, want] of [[0, 'continue', 2 + 10.5], [0, 'end', 2], [10.5, 'continue', 10.5 + 2], [10.5, 'end', 10.5 + 2]]) {
    const c = T.connectGraph({ P, a: 2, b: 4, src: 0, after, blend: 'smooth', dur: 10.5 });
    const d = await render(c.graph, path.join(tmp, `edge-${P}-${after}.flac`), [song]);
    assert.ok(Math.abs(d - c.length) < 0.05 && Math.abs(d - want) < 0.6, `P=${P} ${after}: ${d} vs ${c.length} (about ${want})`);
  }
  const o = T.connectGraph({ P: 0, a: 0, b: 2, src: 1, after: 'continue', blend: 'hard', dur: 10.5 });
  assert.ok(Math.abs((await render(o.graph, path.join(tmp, 'edge-other.flac'), [song, song])) - o.length) < 0.05);
});

test('the whole Edit page as one mix: song effects + volume / pan / mute / solo, layer effects', async () => {
  const rain = path.join(tmp, 'rain2.flac');
  await T.makeSound(ff, 'rain', rain);
  // the song slowed down: layers move with it, the mix is longer
  const g = T.mixGraph([{ offset: 2, from: 0, to: 2, volume: 80, pan: 30, repeat: 1, fx: { echo: 50, bass: 40, slowed: 50 } }], 10.5, { songFx: { slowed: 50 }, songVolume: 90, songPan: -20 });
  assert.ok(!/asetrate=[\\d]+[^;]*\\[l1\\]/.test(g.split(';')[1] || ''), 'layers never get the speed effects');
  const d = await render(g, path.join(tmp, 'mix2.flac'), [song, rain]);
  const rate = require('../renderer/fxmath').params({ slowed: 50 }).rate;
  assert.ok(d - 10.5 / rate > -0.1 && d - 10.5 / rate < 0.35, `slowed mix ${d} vs ${10.5 / rate} (+ up to 0.28 s of reverb tail)`);
  // song muted / a layer solo / the song solo: valid recipes
  for (const opts of [{ songMute: true }, { songSolo: true }, {}]) {
    const gg = T.mixGraph([{ offset: 0, from: 0, to: 2, solo: !opts.songSolo && !opts.songMute }], 10.5, opts);
    assert.ok((await render(gg, path.join(tmp, `mix-${Object.keys(opts).join('') || 'solo'}.flac`), [song, rain])) > 10);
  }
  assert.ok(T.mixGraph([], 10.5, { songFx: { echo: 30 } }).includes('aecho'), 'no layers: just the song with its effects');
  // a layer longer than the song stops where the song ends (like the live player)
  const long = T.mixGraph([{ offset: 8, from: 0, to: 2, repeat: 4 }], 10.5);
  assert.ok(Math.abs((await render(long, path.join(tmp, 'mix-long.flac'), [song, rain])) - 10.5) < 0.1, 'stops with the song');
  // a short auto-quiet layer doesn't cut the song short (found by the studio page check)
  const short = T.mixGraph([{ offset: 1, from: 0, to: 1, duck: true }], 10.5);
  assert.ok(Math.abs((await render(short, path.join(tmp, 'mix-short-duck.flac'), [song, rain])) - 10.5) < 0.1, 'the song plays to its end');
  // the shared numbers make the same filters as before
  assert.ok(T.effectChain({ echo: 40 }).includes('aecho=0.8:0.9:290:0.38'));
});
