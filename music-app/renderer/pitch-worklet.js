// Real-time pitch shifter for the preview (speed is handled separately by the
// player, which keeps pitch). Two read heads glide through a short delay line
// and cross-fade, so pitch changes without changing tempo.
// Saved files use ffmpeg instead (higher quality), with the same pitch ratio.
class PitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'pitch', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this.size = 1 << 15;
    this.mask = this.size - 1;
    this.buf = [new Float32Array(this.size), new Float32Array(this.size)];
    this.w = 0;
    this.phase = 0;
    this.win = Math.round(sampleRate * 0.07); // 70 ms grains
    // Extra delay per read head, chosen when that head restarts so its new grain
    // lines up with the waveform of the other head (WSOLA). Without this, grains
    // restart out of phase and the pitch drifts off by up to one grain rate.
    this.off = [0, 0];
    this.search = Math.round(sampleRate * 0.016); // up to 16 ms shift
    this.corrLen = Math.round(sampleRate * 0.006); // compare 6 ms of sound
  }

  bestOffset(w, phNew, phOther, offOther) {
    const W = this.win, b = this.buf[0], m = this.mask, L = this.corrLen;
    const rO = w - phOther * W - offOther - 1 + this.size;
    const base = w - phNew * W - 1 + this.size;
    // Reference segment from the head that is playing now.
    const ref = this.ref || (this.ref = new Float32Array(L));
    for (let j = 0; j < L; j++) ref[j] = this.read(b, rO - j);
    let best = 0, bestScore = -Infinity;
    for (let off = 0; off <= this.search; off++) {
      let dot = 0, en = 1e-9;
      const r0 = Math.floor(base - off);
      for (let j = 0; j < L; j++) { const x = b[(r0 - j) & m]; dot += x * ref[j]; en += x * x; }
      const score = dot / Math.sqrt(en);
      if (score > bestScore) { bestScore = score; best = off; }
    }
    return best;
  }

  read(b, pos) {
    const i = Math.floor(pos);
    const f = pos - i;
    const a = b[i & this.mask];
    return a + (b[(i + 1) & this.mask] - a) * f;
  }

  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    const n = output[0].length;
    const p = params.pitch[0];
    const outCh = output.length;
    if (!input || input.length === 0) {
      for (let c = 0; c < outCh; c++) output[c].fill(0);
      return true;
    }
    const bypass = Math.abs(p - 1) < 1e-7;
    const W = this.win;
    const rate = (1 - p) / W;
    for (let i = 0; i < n; i++) {
      const w = this.w;
      for (let c = 0; c < 2; c++) this.buf[c][w] = input[Math.min(c, input.length - 1)][i];
      if (bypass) {
        for (let c = 0; c < outCh; c++) output[c][i] = this.buf[Math.min(c, 1)][w];
      } else {
        const ph0 = this.phase;
        const ph1 = (ph0 + 0.5) % 1;
        const g0 = Math.sin(Math.PI * ph0) ** 2; // g0 + g1 = 1
        const g1 = 1 - g0;
        const r0 = w - ph0 * W - this.off[0] - 1;
        const r1 = w - ph1 * W - this.off[1] - 1;
        for (let c = 0; c < outCh; c++) {
          const b = this.buf[Math.min(c, 1)];
          output[c][i] = this.read(b, r0 + this.size) * g0 + this.read(b, r1 + this.size) * g1;
        }
        let ph = ph0 + rate;
        const wrapped0 = ph < 0 || ph >= 1;
        ph -= Math.floor(ph);
        const nph1 = (ph + 0.5) % 1;
        const wrapped1 = (rate > 0 && nph1 < ph1) || (rate < 0 && nph1 > ph1);
        this.phase = ph;
        // A head that just restarted is silent (weight 0): re-align it.
        if (wrapped0) this.off[0] = this.bestOffset(w + 1, ph, nph1, this.off[1]);
        if (wrapped1) this.off[1] = this.bestOffset(w + 1, nph1, ph, this.off[0]);
      }
      this.w = (w + 1) & this.mask;
    }
    return true;
  }
}

registerProcessor('pitch-shifter', PitchShifter);
