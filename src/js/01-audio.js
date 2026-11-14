// =====================================================================
//  AUDIO — every sound is synthesized with the Web Audio API
// =====================================================================
const SFX = {
  ctx: null, master: null, music: null, sfx: null, amb: null, verb: null, noiseBuf: null, loops: {},
  mb: null, endMus: null, hbNext: 0, fear: 0,
  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let ctx; try { ctx = new AC(); } catch (e) { return; }
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = CFG.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(2.8, 2.6);
    const vg = ctx.createGain(); vg.gain.value = 0.55; this.verb.connect(vg); vg.connect(this.master);
    this.music = this.bus(0.6, 0.5); this.sfx = this.bus(0.9, 0.18); this.amb = this.bus(0.85, 0.12);
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.makeLoops();
    this.resume();
  },
  bus(vol, send) {
    const g = this.ctx.createGain(); g.gain.value = vol; g.connect(this.master);
    const s = this.ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verb); return g;
  },
  impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setVolume(v) { if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); },
  get now() { return this.ctx.currentTime; },
  noiseSrc(loop) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = !!loop; return s; },
  makeLoops() {
    const ctx = this.ctx, L = this.loops;
    const lfo = (freq, depth, target, type = 'sine') => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; const g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(target); o.start(); };
    { // wind
      const src = this.noiseSrc(true), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.8;
      const trem = ctx.createGain(); trem.gain.value = 0.65; const g = ctx.createGain(); g.gain.value = 0;
      lfo(0.07, 260, bp.frequency); lfo(0.11, 0.35, trem.gain);
      src.connect(bp); bp.connect(trem); trem.connect(g); g.connect(this.amb); src.start(); L.wind = g;
    }
    { // low rumble
      const src = this.noiseSrc(true); src.playbackRate.value = 0.5; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(lp); lp.connect(g); g.connect(this.amb); src.start(); L.rumble = g;
    }
    { // drone
      const g = ctx.createGain(); g.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 2;
      [[41.2, 'sine', 1], [41.7, 'sawtooth', 0.35], [61.9, 'sine', 0.35], [82.6, 'triangle', 0.18], [97.9, 'sine', 0.12]].forEach(([f, t, v]) => {
        const o = ctx.createOscillator(); o.type = t; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(lp); o.start();
      });
      lfo(0.05, 90, lp.frequency); lp.connect(g); g.connect(this.amb); L.drone = g; L.droneFilter = lp;
    }
    { // static hiss
      const src = this.noiseSrc(true), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(hp); hp.connect(g); g.connect(this.sfx); src.start(); L.static = g;
    }
    { // water lapping
      const src = this.noiseSrc(true); src.playbackRate.value = 0.7; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      const trem = ctx.createGain(); trem.gain.value = 0.5; lfo(0.33, 0.45, trem.gain);
      const g = ctx.createGain(); g.gain.value = 0; src.connect(lp); lp.connect(trem); trem.connect(g); g.connect(this.amb); src.start(); L.water = g;
    }
    { // fire bed
      const src = this.noiseSrc(true), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(lp); lp.connect(g); g.connect(this.amb); src.start(); L.fire = g;
    }
    { // rain: a hiss over a soft roar, with patter
      const src = this.noiseSrc(true), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      const src2 = this.noiseSrc(true); src2.playbackRate.value = 0.6; const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 600;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(hp); hp.connect(lp); lp.connect(g); const g2 = ctx.createGain(); g2.gain.value = 0.7; src2.connect(lp2); lp2.connect(g2); g2.connect(g); g.connect(this.amb); src.start(); src2.start(); L.rain = g;
    }
    { // boat engine
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 48; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      const am = ctx.createGain(); am.gain.value = 0.5; lfo(9, 0.4, am.gain, 'square');
      const g = ctx.createGain(); g.gain.value = 0; o.connect(lp); lp.connect(am); am.connect(g); g.connect(this.sfx); o.start(); L.engine = g;
    }
  },
  chatPing(kind) { if (!this.ctx) return; const t = this.now; if (kind === 'joury') { this.osc('sine', 220, t, 0.35, 0.08, null, { slide: 160 }); this.osc('square', 440, t, 0.05, 0.03); } else this.osc('sine', kind === 'server' ? 1300 : 900, t, 0.12, 0.04, null, { slide: kind === 'server' ? 1500 : 1100 }); },
  typing() { if (!this.ctx) return; const t = this.now; for (let i = 0; i < 9; i++) this.burst(t + i * 0.13 + Math.random() * 0.05, 0.02, 0.03, 'highpass', 3500, 1); },
  kidCall(pan, vol, sob) {
    if (!this.ctx || this.full(1.6)) return; const t = this.now, ctx = this.ctx, dest = this.panner(pan);
    const o = ctx.createOscillator(); o.type = 'triangle'; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.value = 1400;
    const base = sob ? 300 : 420; o.frequency.setValueAtTime(base, t);
    const pts = sob ? [380, 300, 360, 280, 330] : [520, 470, 560, 430, 600, 380];
    pts.forEach((v, i) => o.frequency.linearRampToValueAtTime(v * rand(0.95, 1.05), t + 0.18 * (i + 1)));
    o.frequency.linearRampToValueAtTime(base * 0.5, t + 0.18 * (pts.length + 1)); // the last word drops much too low
    const vib = ctx.createOscillator(); vib.frequency.value = 7; const vg = ctx.createGain(); vg.gain.value = 18; vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + 1.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.06); g.gain.setValueAtTime(vol * 0.5, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + 1.6);
    this.burst(t, 1.3, 0.05 * vol, 'bandpass', 3000, 2, dest);
  },
  thunder(vol = 0.7) { if (!this.ctx) return; const t = this.now; this.burst(t, 0.25, vol * 0.6, 'lowpass', 2000, 0.5, null, 1, 0.005); this.burst(t + 0.1, 3.2, vol, 'lowpass', 160, 0.8, null, 0.45, 0.08); this.burst(t + 0.4, 2.4, vol * 0.5, 'lowpass', 90, 0.6, null, 0.35, 0.3); this.osc('sine', 48, t + 0.1, 2.2, vol * 0.4, null, { slide: 30, attack: 0.1 }); },
  tick() { if (!this.ctx) return; const t = this.now; this.osc('triangle', 1800, t, 0.05, 0.025, null, { slide: 1200 }); },
  snuff() { if (!this.ctx) return; const t = this.now; this.burst(t, 0.35, 0.08, 'bandpass', 900, 1.5, null, 1, 0.01); },
  pageTurn() { if (!this.ctx) return; const t = this.now; this.burst(t, 0.18, 0.12, 'highpass', 2500, 0.7); this.burst(t + 0.12, 0.12, 0.08, 'bandpass', 4000, 2); },
  // only tell the audio system when a loop's volume actually changes (calling this every frame piles up volume events)
  setLoop(name, v, tc = 0.3) { if (!this.ctx) return; const g = this.loops[name]; if (!g) return; v = Math.max(0, v); const last = g._v === undefined ? -1 : g._v; if (Math.abs(v - last) < 0.004 && !(v === 0 && last !== 0)) return; g._v = v; g.gain.setTargetAtTime(v, this.ctx.currentTime, tc); },
  allLoopsOff(tc = 0.4) { ['wind', 'rumble', 'drone', 'static', 'water', 'fire', 'engine', 'rain'].forEach((n) => this.setLoop(n, 0, tc)); },

  // ---- building blocks ----
  // a limit on how many one-shot sounds can ring at once, so a busy moment never piles up hundreds of voices
  voiceEnds: [], MAX_VOICES: 40,
  full(dur = 0.5) {
    const now = this.ctx.currentTime, v = this.voiceEnds; let n = 0;
    for (let i = 0; i < v.length; i++) if (v[i] > now) v[n++] = v[i]; v.length = n;
    if (n >= this.MAX_VOICES) return true; v.push(now + dur + 0.1); return false;
  },
  mute: { frequency: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }, connect() {}, start() {}, stop() {} },
  osc(type, f, t, dur, vol, dest, o = {}) {
    if (this.full(t - this.ctx.currentTime + dur)) return this.mute;
    const ctx = this.ctx, osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (o.detune) osc.detune.value = o.detune;
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || dur));
    const g = ctx.createGain(), a = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(dest || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  },
  burst(t, dur, vol, type, freq, q, dest, rate = 1, attack = 0.002) {
    if (this.full(t - this.ctx.currentTime + dur)) return this.mute;
    const ctx = this.ctx, s = this.noiseSrc(false); s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx);
    s.start(t, Math.random() * Math.max(0.01, 3.8 - dur)); s.stop(t + dur + 0.05);
    return f;
  },
  panner(p) { const pn = this.ctx.createStereoPanner(); pn.pan.value = clamp(p, -1, 1); pn.connect(this.sfx); return pn; },
  distCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x)); } return c; },

  // ---- one-shots ----
  ok() { return !!this.ctx; },
  step(surface, vol = 1) {
    if (!this.ctx) return; const t = this.now;
    if (surface === 'wood') { this.osc('sine', rand(95, 125), t, 0.12, 0.22 * vol, null, { slide: 60 }); this.burst(t, 0.07, 0.1 * vol, 'bandpass', rand(900, 1300), 1.2); }
    else { this.burst(t, 0.17, 0.2 * vol, 'lowpass', rand(650, 1050), 0.7, null, rand(0.8, 1.2)); this.burst(t + 0.01, 0.06, 0.06 * vol, 'highpass', 3200, 0.5); }
  },
  jouryStep(pan, vol) { if (!this.ctx) return; const t = this.now, d = this.panner(pan); this.osc('sine', 70, t, 0.25, 0.5 * vol, d, { slide: 40 }); this.burst(t, 0.2, 0.25 * vol, 'lowpass', 500, 1, d); },
  thump(t, v) { this.osc('sine', 62, t, 0.17, 0.6 * v, this.sfx, { slide: 38, attack: 0.008 }); this.osc('sine', 58, t + 0.24, 0.15, 0.38 * v, this.sfx, { slide: 36, attack: 0.008 }); },
  bell(f, t, vol, dur = 1.6, dest) { dest = dest || this.music; this.osc('sine', f, t, dur, vol, dest, { attack: 0.003 }); this.osc('sine', f * 2.0, t, dur * 0.6, vol * 0.33, dest, { attack: 0.003 }); this.osc('sine', f * 3.01, t, dur * 0.3, vol * 0.13, dest, { attack: 0.002 }); },
  chime() { if (!this.ctx) return; const t = this.now; [784, 988, 1175, 1568, 1976].forEach((f, i) => this.bell(f, t + i * 0.08, 0.17, 1.4, this.sfx)); },
  pickup() { if (!this.ctx) return; const t = this.now; this.osc('triangle', 660, t, 0.14, 0.18, null, { slide: 1320 }); this.bell(1320, t + 0.07, 0.1, 0.6, this.sfx); },
  beep(f = 880) { if (!this.ctx) return; this.osc('square', f, this.now, 0.09, 0.1); },
  buzz() { if (!this.ctx) return; const t = this.now; this.osc('sawtooth', 110, t, 0.5, 0.22); this.osc('sawtooth', 117, t, 0.5, 0.22); },
  unlock() { if (!this.ctx) return; const t = this.now; [523, 659, 784, 1047].forEach((f, i) => this.osc('square', f, t + i * 0.07, 0.12, 0.1)); this.burst(t + 0.3, 0.4, 0.3, 'lowpass', 400, 1); },
  uiClick() { if (!this.ctx) return; this.osc('triangle', 1200, this.now, 0.05, 0.06); },
  type() { if (!this.ctx) return; const t = this.now; this.burst(t, 0.025, 0.05, 'highpass', 3000, 0.7); this.osc('square', rand(1700, 2100), t, 0.012, 0.02); },
  click() { if (!this.ctx) return; const t = this.now; this.osc('square', 2400, t, 0.02, 0.08); this.burst(t, 0.03, 0.1, 'highpass', 2500, 1); },
  flashlight(on) { if (!this.ctx) return; const t = this.now; this.osc('square', on ? 1800 : 1400, t, 0.02, 0.07); this.burst(t, 0.04, 0.08, 'highpass', 2000, 1); },
  owl() { if (!this.ctx) return; const t = this.now, d = this.panner(rand(-0.8, 0.8)); [0, 0.45, 0.75].forEach((o, i) => this.osc('sine', i === 1 ? 360 : 390, t + o, 0.35, 0.05, d, { slide: 340, attack: 0.06 })); },
  twig(pan = 0, vol = 0.25) { if (!this.ctx) return; const t = this.now, d = this.panner(pan); this.burst(t, 0.05, vol, 'highpass', 1800, 0.8, d); this.burst(t + 0.04, 0.08, vol * 0.7, 'bandpass', 1200, 2, d); },
  whoosh(pan = 0) { if (!this.ctx) return; const t = this.now, d = this.panner(pan); const f = this.burst(t, 0.9, 0.18, 'bandpass', 300, 2, d, 1, 0.3); f.frequency.exponentialRampToValueAtTime(2200, t + 0.45); f.frequency.exponentialRampToValueAtTime(250, t + 0.9); },
  creak() { if (!this.ctx || this.full(1)) return; const t = this.now, ctx = this.ctx; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(110, t + 0.6); o.frequency.linearRampToValueAtTime(80, t + 1.2); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 12; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3); o.connect(bp); bp.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 1.4); },
  knock() { if (!this.ctx) return; const t = this.now; this.osc('sine', 190, t, 0.12, 0.35, null, { slide: 90 }); this.burst(t, 0.06, 0.2, 'bandpass', 1400, 1); },
  slam(vol = 0.5) { if (!this.ctx) return; const t = this.now; this.osc('sine', 80, t, 0.5, vol, null, { slide: 35 }); this.burst(t, 0.4, vol * 0.7, 'lowpass', 900, 0.8); },
  splash() { if (!this.ctx) return; const t = this.now; this.burst(t, 0.9, 0.35, 'lowpass', 900, 0.7, null, 0.8, 0.02); this.burst(t + 0.05, 0.5, 0.15, 'highpass', 2500, 0.5); },
  crash() { if (!this.ctx) return; const t = this.now; this.burst(t, 0.35, 0.5, 'highpass', 1500, 0.6); this.osc('square', 300, t, 0.08, 0.2, null, { slide: 120 }); [0.06, 0.13, 0.21].forEach((o) => this.burst(t + o, 0.05, 0.25, 'bandpass', rand(1500, 3500), 3)); },
  firework() {
    if (!this.ctx) return; const t = this.now;
    this.osc('sine', 500, t, 0.6, 0.05, null, { slide: 1500, attack: 0.05 });
    this.burst(t + 0.6, 0.45, 0.45, 'lowpass', 1100, 0.7);
    for (let i = 0; i < 14; i++) this.burst(t + 0.7 + Math.random() * 0.6, 0.03, 0.08, 'highpass', 3500, 1);
  },
  gull() { if (!this.ctx) return; const t = this.now; [0, 0.32].forEach((o) => this.osc('sine', 1500, t + o, 0.28, 0.04, null, { slide: 950, attack: 0.03 })); },
  cheer() { if (!this.ctx) return; const t = this.now; for (let i = 0; i < 5; i++) this.osc('triangle', rand(500, 800), t + i * 0.03, 0.4, 0.04, null, { slide: rand(900, 1300) }); },
  voice(pan = 0, vol = 0.55, angry = false) {
    if (!this.ctx) return; const t = this.now, ctx = this.ctx, dest = this.panner(pan);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(angry ? 95 : 76, t);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.setValueAtTime(600, t);
    for (let i = 0; i < 9; i++) { o.frequency.linearRampToValueAtTime(rand(angry ? 80 : 58, angry ? 140 : 100), t + 0.12 * (i + 1)); f1.frequency.linearRampToValueAtTime(rand(380, 1200), t + 0.12 * (i + 1)); }
    const ws = ctx.createWaveShaper(); ws.curve = this.distCurve(angry ? 140 : 50);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.05); g.gain.setValueAtTime(vol, t + 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    o.connect(f1); f1.connect(ws); ws.connect(g); g.connect(dest); o.start(t); o.stop(t + 1.2);
    this.burst(t, 1.0, 0.07 * vol, 'bandpass', 2400, 3, dest);
  },
  jumpscare() {
    if (!this.ctx) return; const t = this.now, ctx = this.ctx;
    const ws = ctx.createWaveShaper(); ws.curve = this.distCurve(400);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.85, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.7); ws.connect(g); g.connect(this.master);
    [220, 233, 311, 466].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 3.2, t + 0.22); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 1.6); o.connect(ws); o.start(t); o.stop(t + 1.7); });
    const n = this.noiseSrc(false), ng = ctx.createGain(); ng.gain.setValueAtTime(0.8, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 1.4); n.connect(ng); ng.connect(ws); n.start(t); n.stop(t + 1.5);
    this.osc('sine', 72, t, 1.0, 0.9, this.master, { slide: 28 });
  },
  sting() { if (!this.ctx) return; const t = this.now; [146.8, 155.6, 207.7].forEach((f) => this.osc('sawtooth', f, t, 1.6, 0.06, this.music, { attack: 0.02 })); this.burst(t, 1.2, 0.12, 'bandpass', 3000, 2, this.music, 1, 0.05); },

  // ---- music ----
  startMusicBox() { if (!this.ctx) return; this.endMus = null; this.mb = { next: this.now + 0.15, step: 0, dur: 0.34 }; },
  stopMusic() { this.mb = null; this.endMus = null; },
  mbNote(step, t) {
    const N = { A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, Gs5: 830.6, A5: 880, B5: 987.8, C6: 1046.5, D6: 1174.7, E6: 1318.5, A3: 220, F3: 174.6, E3: 164.8, D3: 146.8 };
    const mel = ['A5', 0, 'E6', 0, 'D6', 'C6', 'B5', 0, 'C6', 0, 'A5', 0, 'E5', 0, 0, 0, 'F5', 0, 'A5', 0, 'C6', 'B5', 'A5', 0, 'Gs5', 0, 'B5', 0, 'E5', 0, 0, 0];
    const bass = ['A3', 'A3', 'F3', 'E3'];
    const i = step % 32, n = mel[i];
    const det = rand(-9, 9);
    if (n) { this.osc('sine', N[n], t, 1.7, 0.11, this.music, { attack: 0.002, detune: det }); this.osc('sine', N[n] * 2, t, 0.7, 0.03, this.music, { attack: 0.002, detune: det }); this.osc('sine', N[n] * 4.02, t, 0.25, 0.012, this.music, { attack: 0.001 }); }
    if (i % 8 === 0) { const b = N[bass[(i / 8) | 0]]; this.osc('triangle', b, t, 2.4, 0.06, this.music, { attack: 0.01 }); }
    if (i === 31) this.mb.dur = this.mb.dur > 0.42 ? 0.34 : this.mb.dur + 0.02; // winds down, then rewinds
  },
  startEndingMusic() {
    if (!this.ctx) return; this.mb = null;
    const C = [261.6, 329.6, 392, 523.3], F = [349.2, 440, 523.3, 698.5], G = [392, 493.9, 587.3, 784], Am = [440, 523.3, 659.3, 880];
    const prog = [C, G, Am, F, C, G, F, C]; const t0 = this.now + 0.2;
    prog.forEach((ch, ci) => { for (let k = 0; k < 8; k++) this.bell(ch[k % 4] * (k > 3 ? 1 : 1), t0 + ci * 2.0 + k * 0.25, 0.07, 1.6, this.music); this.osc('triangle', ch[0] / 2, t0 + ci * 2, 2.2, 0.06, this.music, { attack: 0.05 }); });
  },
  update(dt, fear) {
    if (!this.ctx) return; const t = this.now;
    if (this.mb) while (this.mb.next < t + 0.25) { this.mbNote(this.mb.step, this.mb.next); this.mb.next += this.mb.dur; this.mb.step++; }
    this.fear = fear;
    if (fear > 0.08) {
      if (this.hbNext < t) this.hbNext = t + 0.05;
      if (this.hbNext < t + 0.1) { this.thump(this.hbNext, clamp(0.25 + fear, 0.25, 1)); this.hbNext += 60 / (62 + fear * 100); }
    }
  },
};
