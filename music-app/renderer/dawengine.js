'use strict';
/* global TFFxMath */
// The Edit page's live player (Web Audio). Every track (the song + its layers) plays together through its own
// effects, volume, left/right and mute/solo, so changes are heard at once. Saving builds the same mix with
// ffmpeg from the same numbers (renderer/fxmath.js), so the file sounds like what you heard.
// Times are "song time" (seconds into the song track as it is now); Slowed / Nightcore on the song make real
// time run slower / faster than song time, and the layers move with it.
window.TFDaw = (() => {
  let ctx = null, master = null, limiter = null, masterMeter = null;
  const buffers = new Map(); // url -> Promise<AudioBuffer>
  let tracks = []; // set by the page: [{ id, kind: 'song'|'layer', url, ... }]
  let playing = null; // { c0, t0, rate, sources: [] }
  let gen = 0;
  let loading = null; // song time a Play is loading from (a seek meanwhile restarts it)
  let duckRaf = 0; // goes up on every stop, so a Play that is still loading knows it was cancelled
  let pos = 0; // song time when stopped
  let preview = null; // { buffer, c0, t0, src } — hearing a preview file instead of the tracks
  const listeners = { end: [] };

  function audio() {
    if (ctx) return ctx;
    ctx = new AudioContext({ latencyHint: 'interactive' });
    master = ctx.createGain();
    limiter = ctx.createDynamicsCompressor(); // like the saved file's limiter: stops it from getting too loud
    limiter.threshold.value = -0.3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.08;
    masterMeter = ctx.createAnalyser(); masterMeter.fftSize = 1024;
    master.connect(limiter).connect(masterMeter).connect(ctx.destination);
    return ctx;
  }
  function load(url) {
    if (!url) return Promise.resolve(null);
    if (!buffers.has(url)) {
      buffers.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`could not load (${r.status})`); return r.arrayBuffer(); }).then((b) => audio().decodeAudioData(b)).catch((e) => { buffers.delete(url); throw e; }));
      // keep memory in check: decoded songs are big (5 min ≈ 115 MB); never drop a track that is in use
      const inUse = new Set(tracks.flatMap((t) => [t.url, t.playUrl]));
      for (const k of [...buffers.keys()]) { if (buffers.size <= 8) break; if (!inUse.has(k) && k !== url) buffers.delete(k); }
    }
    return buffers.get(url);
  }
  const songTrack = () => tracks.find((t) => t.kind === 'song');
  const songRate = () => TFFxMath.params((songTrack() || {}).fx).rate;

  // ---------- one track's sound chain: [sources] -> effects -> volume -> left/right -> meter -> (auto-quiet) -> master
  function buildChain(t) {
    const c = audio();
    const n = { input: c.createGain(), vol: c.createGain(), meter: c.createAnalyser(), duck: c.createGain(), fx: [] };
    // mono sources become stereo first (like the saved file), so 8D / 1D / left-right work on them too
    n.input.channelCount = 2; n.input.channelCountMode = 'explicit'; n.input.channelInterpretation = 'speakers';
    // left / right exactly like the saved file: turn one side down (no folding of the other side in)
    n.split = c.createChannelSplitter(2); n.gL = c.createGain(); n.gR = c.createGain(); n.merge = c.createChannelMerger(2);
    n.split.connect(n.gL, 0); n.split.connect(n.gR, 1); n.gL.connect(n.merge, 0, 0); n.gR.connect(n.merge, 0, 1);
    n.meter.fftSize = 1024;
    let last = n.input;
    const link = (node) => { last.connect(node); last = node; return node; };
    for (const e of TFFxMath.params(t.fx).list) {
      if (e.rate && t.kind !== 'song') continue; // speed effects are for the song track
      if (e.k === 'bass') { const b = link(c.createBiquadFilter()); b.type = 'lowshelf'; b.frequency.value = e.freq; b.gain.value = e.gain; n.fx.push(b); }
      if (e.k === 'echo') last = taps(last, { inGain: e.inGain, outGain: e.outGain, taps: [[e.ms, e.decay]] }, n.fx);
      if (e.k === 'eightd') last = pulsate(last, e, n.fx);
      if (e.k === 'oned') last = matrix(last, e.mix, n.fx);
      if (e.room) last = taps(last, e.room, n.fx); // reverb taps after the effect, like the saved file (Slowed's room, 8D's small room)
    }
    last.connect(n.vol);
    n.vol.connect(n.split); n.merge.connect(n.meter).connect(n.duck).connect(master);
    t.nodes = n;
    apply(t);
    return n;
  }
  // aecho-like: out = outGain * (inGain * x + sum(decay_i * x delayed by ms_i))
  function taps(from, r, keep) {
    const c = audio(), out = c.createGain(), dry = c.createGain();
    out.gain.value = r.outGain; dry.gain.value = r.inGain;
    from.connect(dry).connect(out);
    for (const [ms, g] of r.taps) { const d = c.createDelay(2); d.delayTime.value = ms / 1000; const gg = c.createGain(); gg.gain.value = g; from.connect(d).connect(gg).connect(out); keep.push(d, gg); }
    keep.push(out, dry);
    return out;
  }
  // 8D: left and right get louder and quieter in turn (a slow wave), so the sound moves around your head
  function pulsate(from, e, keep) {
    const c = audio(), split = c.createChannelSplitter(2), merge = c.createChannelMerger(2), gl = c.createGain(), gr = c.createGain();
    const lfo = c.createOscillator(), depthL = c.createGain(), depthR = c.createGain();
    lfo.frequency.value = e.hz; depthL.gain.value = -e.amount / 2; depthR.gain.value = e.amount / 2;
    gl.gain.value = 1 - e.amount / 2; gr.gain.value = 1 - e.amount / 2;
    lfo.connect(depthL).connect(gl.gain); lfo.connect(depthR).connect(gr.gain); lfo.start();
    from.connect(split); split.connect(gl, 0); split.connect(gr, 1); gl.connect(merge, 0, 0); gr.connect(merge, 0, 1);
    keep.push(split, merge, gl, gr, lfo, depthL, depthR);
    return merge;
  }
  // 1D: left and right mixed together
  function matrix(from, k, keep) {
    const c = audio(), split = c.createChannelSplitter(2), merge = c.createChannelMerger(2);
    const g = [[1 - k, 0, 0], [k, 0, 1], [k, 1, 0], [1 - k, 1, 1]].map(([v, inCh, outCh]) => { const n = c.createGain(); n.gain.value = v; split.connect(n, inCh); n.connect(merge, 0, outCh); return n; });
    from.connect(split);
    keep.push(split, merge, ...g);
    return merge;
  }
  function audibleGain(t) {
    const anySolo = tracks.some((x) => x.solo && !x.mute);
    if (t.mute || (anySolo && !t.solo)) return 0;
    return (t.volume ?? 100) / 100;
  }
  // volume / left-right / mute / solo change: no rebuild needed
  function apply(t) {
    if (!t.nodes) return;
    const now = audio().currentTime;
    t.nodes.vol.gain.setTargetAtTime(audibleGain(t), now, 0.015);
    const x = Math.max(-1, Math.min(1, (+t.pan || 0) / 100));
    t.nodes.gL.gain.setTargetAtTime(Math.min(1, 1 - x), now, 0.015);
    t.nodes.gR.gain.setTargetAtTime(Math.min(1, 1 + x), now, 0.015);
  }
  function teardown(t) {
    if (!t.nodes) return;
    for (const n of [t.nodes.input, ...t.nodes.fx, t.nodes.vol, t.nodes.split, t.nodes.gL, t.nodes.gR, t.nodes.merge, t.nodes.meter, t.nodes.duck]) { try { n.disconnect(); } catch (_) { /* gone */ } if (n.stop) try { n.stop(); } catch (_) { /* not started */ } }
    t.nodes = null;
  }

  // ---------- the clock + playing
  function time() {
    if (preview) return preview.t0 + (audio().currentTime - preview.c0);
    if (!playing) return pos;
    return playing.t0 + (audio().currentTime - playing.c0) * playing.rate;
  }
  function duration() { const s = songTrack(); return s ? s.duration : 0; }
  async function play(from = time()) {
    stop(true); stopPreview(true);
    const my = gen;
    loading = from;
    const c = audio();
    if (c.state === 'suspended') await c.resume();
    const all = await Promise.all(tracks.map((t) => load(t.playUrl || t.url).then((b) => [t, b]).catch(() => [t, null])));
    if (my !== gen) return; // paused / stopped / played again while loading
    loading = null;
    const songBuf = (all.find(([t]) => t.kind === 'song') || [])[1];
    if (!songBuf) throw new Error('The song could not be loaded. Try opening it again.');
    stop(true);
    const rate = songRate();
    const c0 = c.currentTime + 0.06; // a moment to get everything started together
    const p = { c0, t0: from, rate, sources: [] };
    for (const [t, buf] of all) {
      if (!buf) continue;
      if (!t.nodes) buildChain(t);
      if (t.kind === 'song') {
        if (from >= buf.duration) continue;
        const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
        src.connect(t.nodes.input); src.start(c0, from);
        src.onended = () => { if (playing === p && time() >= duration() - 0.05) { stop(); pos = duration(); listeners.end.forEach((f) => f()); } };
        p.sources.push(src);
        continue;
      }
      // a layer: its part (from..to) plays at its start time, repeated; times are song time, real time = song time / rate
      const tFrom = t.from || 0, tTo = t.to > tFrom ? t.to : buf.duration;
      const lenReal = (tTo - tFrom) / (t.stretch || 1); // Match beat: a ready-made copy at the song's tempo (stretch = tempo)
      if (!(lenReal > 0.01)) continue;
      const songDurReal = duration() / rate;
      const startReal = (t.offset || 0) / rate;
      const reps = t.repeat === 0 ? Math.ceil(Math.max(0, songDurReal - startReal) / lenReal) : Math.max(1, t.repeat || 1);
      const fromReal = from / rate;
      for (let k = 0; k < Math.min(reps, 999); k++) {
        const segStart = startReal + k * lenReal;
        let segEnd = segStart + lenReal;
        if (t.repeat === 0) segEnd = Math.min(segEnd, songDurReal);
        if (segEnd <= fromReal) continue;
        const skip = Math.max(0, fromReal - segStart);
        const src = c.createBufferSource(); src.buffer = buf;
        src.connect(t.nodes.input);
        const bufFrom = (tFrom / (t.stretch || 1)) + skip;
        src.start(c0 + Math.max(0, segStart - fromReal), bufFrom, segEnd - segStart - skip);
        p.sources.push(src);
      }
    }
    playing = p;
    duckLoop();
  }
  function stop() {
    gen++; loading = null;
    if (playing) { pos = time(); for (const s of playing.sources) { try { s.onended = null; s.stop(); } catch (_) { /* done */ } } }
    playing = null;
  }
  function pause() { if (playing) { pos = time(); stop(true); } else { gen++; loading = null; } stopPreview(true); if (songTrack() && songTrack().nodes) songTrack().nodes.duck.gain.value = 1; }
  function seek(t) { const was = !!playing || loading !== null; pos = Math.max(0, Math.min(duration(), t)); if (was) play(pos).catch(() => {}); }
  // auto-quiet: while a layer with Auto-quiet sounds, the song gets quieter (like the saved file's sidechain)
  function duckLoop() {
    cancelAnimationFrame(duckRaf);
    if (!playing) return;
    const song = songTrack(), keys = tracks.filter((t) => t.kind !== 'song' && t.duck && t.nodes && audibleGain(t) > 0);
    if (song && song.nodes) {
      let loud = 0;
      for (const t of keys) loud = Math.max(loud, level(t.nodes.meter));
      song.nodes.duck.gain.setTargetAtTime(loud > 0.03 ? 0.28 : 1, audio().currentTime, loud > 0.03 ? 0.02 : 0.35);
    }
    duckRaf = requestAnimationFrame(duckLoop);
  }
  const tmp = new Float32Array(1024);
  function level(an) { if (!an) return 0; an.getFloatTimeDomainData(tmp); let m = 0; for (let i = 0; i < tmp.length; i++) { const v = Math.abs(tmp[i]); if (v > m) m = v; } return m; }

  // ---------- previews (Trim / Loop / Connect): one ready-made file, no live tracks
  async function playPreview(url, from = 0) {
    stop(true); stopPreview(true);
    const my = gen;
    const c = audio();
    if (c.state === 'suspended') await c.resume();
    const buf = await load(url);
    if (my !== gen) return;
    const src = c.createBufferSource(); src.buffer = buf; src.connect(master);
    const c0 = c.currentTime + 0.03; src.start(c0, Math.max(0, Math.min(buf.duration - 0.05, from)));
    preview = { src, c0, t0: from, duration: buf.duration };
    src.onended = () => { if (preview && preview.src === src) { preview = null; listeners.end.forEach((f) => f()); } };
  }
  function stopPreview(quiet) { if (preview) { try { preview.src.onended = null; preview.src.stop(); } catch (_) { /* done */ } preview = null; if (!quiet) listeners.end.forEach((f) => f()); } }

  // ---------- the page tells the engine what the tracks are
  function setTracks(list) {
    const keep = new Set(list);
    for (const t of tracks) if (!keep.has(t)) teardown(t);
    tracks = list;
  }
  // an effect was switched or turned: rebuild that track's chain (and restart if the song's speed changed)
  function fxChanged(t) {
    if (t.nodes) teardown(t);
    if (playing) play(time()); // restart right where it is, through the new chain (a speed change needs this too)
  }
  function meters() {
    const out = {};
    for (const t of tracks) out[t.id] = t.nodes && playing ? level(t.nodes.meter) : 0;
    out.master = masterMeter && playing ? level(masterMeter) : 0;
    return out;
  }
  function forget(url) { buffers.delete(url); }
  return {
    load, play, pause, stop, seek, time, duration, setTracks, apply, fxChanged, meters, forget, playPreview, stopPreview,
    get playing() { return !!playing || !!preview; }, get previewing() { return !!preview; }, get previewDuration() { return preview ? preview.duration : 0; },
    onEnd: (f) => listeners.end.push(f), songRate,
    latency: () => (ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0), // how late the sound reaches the speakers
  };
})();
