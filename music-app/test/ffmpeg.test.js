'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ff = require('../lib/ffmpeg');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-test-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// ---------- pure helpers ----------
test('limits are clamped (volume max 500%, fades 0..15 s)', () => {
  const fx = ff.normalizeFx({ volume: 900, fadeIn: 20, fadeOut: -1, speed: 1, pitch: 999 });
  assert.deepStrictEqual(fx, { speed: 25, pitch: 200, volume: 500, fadeIn: 15, fadeOut: 0, natural: true });
  assert.strictEqual(ff.normalizeFx({ natural: false }).natural, false);
});

test('filter: speed only changes tempo, output length = length / speed', () => {
  const { filter, outDuration } = ff.buildFilter({ speed: 200 }, 10);
  assert.strictEqual(outDuration, 5);
  assert.match(filter, /rubberband=tempo=2\.000000:pitch=1\.000000/);
});

test('filter: fade out starts at the end of the sped-up song', () => {
  const { filter } = ff.buildFilter({ speed: 200, fadeOut: 1.5, fadeIn: 0.25 }, 10);
  assert.match(filter, /afade=t=in:st=0:d=0\.250/);
  assert.match(filter, /afade=t=out:st=3\.500:d=1\.500/);
});

test('filter: pitch uses the studio tool, Natural voice keeps the voice shape', () => {
  const { filter } = ff.buildFilter({ pitch: 101.001 }, 10);
  assert.match(filter, /rubberband=tempo=1\.000000:pitch=1\.010010:formant=preserved/);
  assert.match(ff.buildFilter({ pitch: 150, natural: false }, 10).filter, /formant=shifted/);
  assert.doesNotMatch(ff.buildFilter({ volume: 80 }, 10).filter, /rubberband/); // nothing to stretch: untouched
});

test('ffmetadata parsing handles escapes and tag names', () => {
  const tags = ff.parseFfmetadata(';FFMETADATA1\ntitle=Hi\\=there\\;x\nARTIST=Bob\npublisher=Lbl\n');
  assert.deepStrictEqual(ff.pickTags(tags, '/x/song.mp3'), { title: 'Hi=there;x', artist: 'Bob', album: '', date: '', label: 'Lbl', genre: '' });
  assert.strictEqual(ff.pickTags({}, '/x/My Song.flac').title, 'My Song');
});

// ---------- real ffmpeg runs ----------
async function makeTone(file, freq, seconds, extra = []) {
  await ff.run(['-y', '-f', 'lavfi', '-i', `sine=frequency=${freq}:sample_rate=44100:duration=${seconds}`, ...extra, file]);
}
async function decode(file) {
  const { stdout } = await ff.run(['-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '44100', '-f', 'f32le', '-']);
  return new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.length));
}
function freqOf(samples) {
  // count rising zero crossings in the middle half (skips fades / codec padding)
  const a = Math.floor(samples.length * 0.25), b = Math.floor(samples.length * 0.75);
  let n = 0;
  for (let i = a + 1; i < b; i++) if (samples[i - 1] <= 0 && samples[i] > 0) n++;
  return n / ((b - a) / 44100);
}
function rms(s, a, b) { let x = 0; for (let i = a; i < b; i++) x += s[i] * s[i]; return Math.sqrt(x / (b - a)); }

test('export: pitch 200% doubles the frequency, speed 150% shortens to 1/1.5', async () => {
  const src = path.join(tmp, 'tone.wav');
  await makeTone(src, 440, 6);
  const dest = path.join(tmp, 'out.wav');
  await ff.exportOne({ src, dest, fx: { speed: 150, pitch: 200 }, duration: 6, format: 'wav' });
  const s = await decode(dest);
  const dur = s.length / 44100;
  assert.ok(Math.abs(dur - 4) < 0.08, `duration ${dur}`);
  const f = freqOf(s);
  assert.ok(Math.abs(f - 880) < 8, `frequency ${f}`);
});

test('export: speed 50% keeps the pitch', async () => {
  const src = path.join(tmp, 'tone2.wav');
  await makeTone(src, 500, 3);
  const dest = path.join(tmp, 'slow.wav');
  await ff.exportOne({ src, dest, fx: { speed: 50 }, duration: 3, format: 'wav' });
  const s = await decode(dest);
  assert.ok(Math.abs(s.length / 44100 - 6) < 0.08);
  assert.ok(Math.abs(freqOf(s) - 500) < 6, `frequency ${freqOf(s)}`);
});

test('listening copy: same length and timing, pitch moves, a part starts where asked', async () => {
  const src = path.join(tmp, 'tone5.wav');
  await makeTone(src, 400, 5);
  const full = path.join(tmp, 'p-full.flac');
  await ff.renderPitched({ src, dest: full, pitch: 1.5, natural: true, duration: 5 });
  const s = await decode(full);
  assert.ok(Math.abs(s.length / 44100 - 5) < 0.03, `length ${s.length / 44100}`);
  assert.ok(Math.abs(freqOf(s) - 600) < 6, `frequency ${freqOf(s)}`);
  const part = path.join(tmp, 'p-part.flac');
  await ff.renderPitched({ src, dest: part, pitch: 0.75, natural: false, start: 1, len: 2, duration: 5 });
  const p = await decode(part);
  assert.ok(Math.abs(p.length / 44100 - 2) < 0.03, `part length ${p.length / 44100}`);
  assert.ok(Math.abs(freqOf(p) - 300) < 5, `part frequency ${freqOf(p)}`);
});

test('export: volume 50% halves the level, fades start/end silent', async () => {
  const src = path.join(tmp, 'tone3.wav');
  await makeTone(src, 300, 6);
  const plain = await decode(src);
  const dest = path.join(tmp, 'vol.wav');
  await ff.exportOne({ src, dest, fx: { volume: 50, fadeIn: 1, fadeOut: 1 }, duration: 6, format: 'wav' });
  const s = await decode(dest);
  const ratio = rms(s, 44100 * 2, 44100 * 4) / rms(plain, 44100 * 2, 44100 * 4);
  assert.ok(Math.abs(ratio - 0.5) < 0.02, `ratio ${ratio}`);
  assert.ok(rms(s, 0, 2000) < 0.02, 'fade in starts quiet');
  assert.ok(rms(s, s.length - 2000, s.length) < 0.02, 'fade out ends quiet');
});

test('video -> mp3 import path, cover + tags on save, combined file with chapters', async () => {
  const video = path.join(tmp, 'clip.mp4');
  await ff.run(['-y', '-f', 'lavfi', '-i', 'testsrc=d=3:s=160x120', '-f', 'lavfi', '-i', 'sine=f=440:d=3', '-shortest', '-metadata', 'title=Clip', video]);
  const { info, tags } = await ff.probe(video);
  assert.ok(info.isVideo && info.hasAudio && !info.directPlay);
  assert.strictEqual(tags.title, 'Clip');
  const mp3 = path.join(tmp, 'clip.mp3');
  await ff.toMp3(video, mp3, { duration: info.duration });
  const p2 = await ff.probe(mp3);
  assert.strictEqual(p2.info.audioCodec, 'mp3');
  assert.ok(p2.info.directPlay);

  const cover = path.join(tmp, 'cover.png');
  await ff.run(['-y', '-f', 'lavfi', '-i', 'color=c=orange:s=300x300', '-frames:v', '1', cover]);
  const saved = path.join(tmp, 'saved.mp3');
  await ff.exportOne({ src: mp3, dest: saved, fx: { speed: 101.001 }, duration: p2.info.duration, tags: { title: 'Saved', artist: 'Me', label: 'Lbl', genre: 'Pop', date: '2026' }, coverPath: cover });
  const p3 = await ff.probe(saved);
  assert.notStrictEqual(p3.info.coverStream, null, 'cover is embedded');
  assert.deepStrictEqual([p3.tags.title, p3.tags.artist, p3.tags.label, p3.tags.genre, p3.tags.date], ['Saved', 'Me', 'Lbl', 'Pop', '2026']);
  const coverOut = path.join(tmp, 'c.jpg');
  assert.ok(await ff.extractCover(saved, p3.info.coverStream, coverOut));

  const big = path.join(tmp, 'big.mp3');
  const tone = path.join(tmp, 'tone4.wav');
  await makeTone(tone, 600, 2);
  const r = await ff.exportCombined({
    items: [{ src: mp3, fx: {}, duration: p2.info.duration, title: 'One' }, { src: tone, fx: { speed: 200 }, duration: 2, title: 'Two' }],
    dest: big, tags: { title: 'Album', artist: 'Me' }, coverPath: cover, tmpDir: tmp,
  });
  assert.ok(Math.abs(r.duration - (p2.info.duration + 1)) < 0.01);
  const p4 = await ff.probe(big);
  assert.ok(Math.abs(p4.info.duration - r.duration) < 0.15, `big duration ${p4.info.duration} vs ${r.duration}`);
  assert.notStrictEqual(p4.info.coverStream, null);
  const { stderr } = await ff.run(['-i', big, '-f', 'null', '-']);
  assert.match(stderr, /Chapters:/);
  assert.match(stderr, /title\s*:\s*Two/);
});

test('save as every file type: right codec, tags, picture where the type can hold one', async () => {
  const src = path.join(tmp, 'tone6.wav');
  await makeTone(src, 440, 3);
  const cover = path.join(tmp, 'cover6.jpg');
  await ff.run(['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=200x200', '-frames:v', '1', cover]);
  const want = { mp3: 'mp3', m4a: 'aac', flac: 'flac', wav: 'pcm_s16le', ogg: 'vorbis' };
  for (const [fmt, codec] of Object.entries(want)) {
    const dest = path.join(tmp, `typed.${fmt}`);
    await ff.exportOne({ src, dest, fx: { pitch: 110 }, duration: 3, format: fmt, bitrate: 192, tags: { title: 'Typed', artist: 'Me' }, coverPath: cover });
    const { info, tags } = await ff.probe(dest);
    assert.strictEqual(info.audioCodec, codec, fmt);
    assert.ok(Math.abs(info.duration - 3) < 0.15, `${fmt} length ${info.duration}`);
    assert.strictEqual(tags.title, 'Typed', `${fmt} title`);
    if (fmt !== 'wav') assert.strictEqual(tags.artist, 'Me', `${fmt} artist`);
    assert.strictEqual(info.coverStream !== null, ff.FORMATS[fmt].cover, `${fmt} picture`);
  }
});
