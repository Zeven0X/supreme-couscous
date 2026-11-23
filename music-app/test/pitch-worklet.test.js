'use strict';
// Runs the preview pitch shifter outside the browser and measures its output.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadShifter(sr) {
  let Cls = null;
  const ctx = { sampleRate: sr, AudioWorkletProcessor: class {}, registerProcessor: (_n, c) => { Cls = c; }, Math, Float32Array };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../renderer/pitch-worklet.js'), 'utf8'), ctx);
  return new Cls();
}
function run(pitch, freq, seconds, sr = 48000) {
  const p = loadShifter(sr);
  const n = Math.floor(sr * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 128) {
    const inp = new Float32Array(128).map((_, k) => Math.sin((2 * Math.PI * freq * (i + k)) / sr));
    const o = [new Float32Array(128), new Float32Array(128)];
    p.process([[inp]], [o], { pitch: [pitch] });
    out.set(o[0].subarray(0, Math.min(128, n - i)), i);
  }
  return out;
}
// Dominant frequency via a coarse DFT scan (robust to grain cross-fades).
function peakFreq(s, sr, lo, hi) {
  const a = Math.floor(s.length / 4), b = a + Math.floor(sr * 0.5);
  let best = 0, bestF = 0;
  for (let f = lo; f <= hi; f += 1) {
    let re = 0, im = 0;
    for (let i = a; i < b; i++) { const w = (2 * Math.PI * f * i) / sr; re += s[i] * Math.cos(w); im += s[i] * Math.sin(w); }
    const m = re * re + im * im;
    if (m > best) { best = m; bestF = f; }
  }
  return bestF;
}
test('pitch 1 is a clean pass-through', () => {
  const s = run(1, 440, 0.2);
  for (let i = 0; i < s.length; i++) assert.ok(Math.abs(s[i] - Math.sin((2 * Math.PI * 440 * i) / 48000)) < 1e-6);
});
for (const [pitch, expect] of [[2, 880], [0.5, 220], [1.25, 550], [1.01001, 444.4]]) {
  test(`pitch ${pitch} moves 440 Hz to ~${expect} Hz without changing length`, () => {
    const s = run(pitch, 440, 1.2);
    assert.strictEqual(s.length, Math.floor(48000 * 1.2));
    const f = peakFreq(s, 48000, Math.floor(expect - 30), Math.ceil(expect + 30));
    assert.ok(Math.abs(f - expect) <= 2.5, `got ${f}`);
  });
}
