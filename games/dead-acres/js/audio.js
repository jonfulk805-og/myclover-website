// DEAD ACRES - procedural WebAudio: guns, zombies, round stingers, ambient drone + music. No audio files.
export class Audio {
  constructor() { this.ctx = null; this.enabled = localStorage.getItem('da_sound') !== '0'; this.music = localStorage.getItem('da_music') !== '0'; this.last = {}; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.enabled ? 0.85 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5;
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.gain.value = this.music ? 0.3 : 0; this.mus.connect(this.master);
    const len = c.sampleRate * 2; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
    // wind + cricket ambience
    const wn = this.noiseSrc(true), wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = 0.6; this.windG = c.createGain(); this.windG.gain.value = 0.05; wn.connect(wf).connect(this.windG).connect(this.sfx); wn.start();
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 260; lfo.connect(lg).connect(wf.frequency); lfo.start();
    // low drone
    this.drone = c.createGain(); this.drone.gain.value = 0; this.drone.connect(this.mus);
    for (const f of [55, 55.4, 82.4]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; const g = c.createGain(); g.gain.value = 0.18; o.connect(lp).connect(g).connect(this.drone); o.start(); }
    this.step = 0; this.nextT = c.currentTime + 0.1; this.playing = false;
    setInterval(() => this.schedule(), 40);
    setInterval(() => { if (this.enabled && this.ctx && Math.random() < 0.5) this.cricket(); }, 1300);
  }
  setEnabled(v) { this.enabled = v; localStorage.setItem('da_sound', v ? '1' : '0'); if (this.master) this.master.gain.setTargetAtTime(v ? 0.85 : 0, this.ctx.currentTime, 0.05); }
  setMusic(v) { this.music = v; localStorage.setItem('da_music', v ? '1' : '0'); if (this.mus) this.mus.gain.setTargetAtTime(v ? 0.3 : 0, this.ctx.currentTime, 0.1); }
  noiseSrc(loop = false) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; return s; }
  throttle(k, ms) { const n = performance.now(); if (this.last[k] && n - this.last[k] < ms) return true; this.last[k] = n; return false; }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  out(pan) { if (!pan) return this.sfx; const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.sfx); return p; }
  tone(type, f0, f1, dur, vol, dest = this.sfx, t = this.ctx.currentTime) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, 0.004, vol, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, type, f0, f1, q = 1, dest = this.sfx, t = this.ctx.currentTime) {
    const s = this.noiseSrc(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this.env(g, t, 0.003, vol, dur); s.connect(f).connect(g).connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  cricket() { const t = this.ctx.currentTime, f = 4200 + Math.random() * 600, d = this.out((Math.random() - 0.5) * 1.6); for (let i = 0; i < 3; i++) this.tone('sine', f, f, 0.03, 0.012, d, t + i * 0.06); }
  // zombie vocal: formant-ish growl, vol by distance, pan by bearing
  groan(vol, pan, kind = 0) {
    if (!this.ctx || !this.enabled || vol < 0.02) return; if (this.throttle('groan' + kind, 180)) return;
    const c = this.ctx, t = c.currentTime, dur = 0.6 + Math.random() * 0.9, d = this.out(pan);
    const o = c.createOscillator(); o.type = 'sawtooth'; const f0 = kind === 2 ? 55 : 80 + Math.random() * 50; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.7 + Math.random() * 0.5), t + dur);
    const vib = c.createOscillator(); vib.frequency.value = 6 + Math.random() * 10; const vg = c.createGain(); vg.gain.value = f0 * 0.12; vib.connect(vg).connect(o.frequency); vib.start(t); vib.stop(t + dur);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 400 + Math.random() * 300; f1.Q.value = 3;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1000 + Math.random() * 600; f2.Q.value = 4;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * vol, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(d); o.start(t); o.stop(t + dur + 0.05);
    const n = this.noiseSrc(), nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.08 * vol, t + 0.1); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8); n.connect(nf).connect(ng).connect(d); n.start(t, Math.random()); n.stop(t + dur);
  }
  gun(id, pap) {
    if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime;
    const P = { m45: [0.16, 1800, 0.5, 120], farmhand: [0.42, 1200, 0.95, 70], rattler: [0.09, 2400, 0.4, 150], carbine: [0.14, 2000, 0.55, 110], harvester: [0.16, 1600, 0.65, 90], longhorn: [0.6, 1500, 1.0, 55], thresher: [0.3, 1300, 0.8, 75] }[id];
    if (id === 'ray') { this.tone('sine', pap ? 1800 : 1400, 200, 0.35, 0.18); this.tone('square', 700, 90, 0.3, 0.05); this.noise(0.2, 0.08, 'bandpass', 3000, 600, 3); return; }
    if (!P) return;
    this.noise(P[0], P[2], 'lowpass', P[1] * 3, P[1] * 0.25, 0.7, this.sfx, t);
    this.tone('sine', P[3] * 2, P[3] * 0.5, P[0] * 0.9, P[2] * 0.7, this.sfx, t);
    this.noise(0.03, P[2] * 0.4, 'highpass', 5000, 3000, 1, this.sfx, t);
    if (pap) this.tone('sine', 1600, 400, 0.15, 0.06, this.sfx, t);
  }
  play(name, opt = 0) {
    if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime;
    switch (name) {
      case 'empty': this.tone('square', 2400, 2200, 0.02, 0.05); break;
      case 'reload': this.noise(0.06, 0.18, 'bandpass', 1800, 1200, 4); this.noise(0.06, 0.2, 'bandpass', 2600, 1800, 4, this.sfx, t + opt * 0.6); this.tone('square', 600, 400, 0.04, 0.05, this.sfx, t + opt * 0.9); break;
      case 'hit': if (this.throttle('hit', 35)) return; this.noise(0.07, 0.25, 'lowpass', 900, 200, 1); this.tone('triangle', 2200, 1800, 0.04, 0.05); break;
      case 'head': this.noise(0.12, 0.4, 'lowpass', 1400, 150); this.tone('triangle', 2800, 2600, 0.06, 0.08); break;
      case 'splat': this.noise(0.25, 0.3, 'lowpass', 700, 90, 1.5); break;
      case 'knife': this.noise(0.12, 0.25, 'bandpass', 3000, 900, 2); break;
      case 'knifeHit': this.noise(0.15, 0.35, 'lowpass', 900, 120); this.tone('sine', 160, 60, 0.12, 0.3); break;
      case 'boom': this.noise(1.1, 0.8, 'lowpass', 2400, 50, 0.8); this.tone('sine', 100, 28, 0.8, 0.7); break;
      case 'pin': this.tone('square', 3000, 2800, 0.03, 0.05); this.noise(0.04, 0.1, 'highpass', 6000, 4000); break;
      case 'board': this.noise(0.14, 0.4, 'lowpass', 1400, 200, 1, this.out(opt)); this.tone('square', 180, 90, 0.08, 0.08, this.out(opt)); break;
      case 'hammer': this.tone('square', 900, 300, 0.05, 0.1); this.noise(0.05, 0.25, 'bandpass', 2600, 1500, 3); break;
      case 'hurt': this.noise(0.3, 0.6, 'lowpass', 1100, 150); this.tone('sine', 120, 50, 0.3, 0.4); break;
      case 'buy': [880, 1320].forEach((f, i) => this.tone('square', f, f, 0.1, 0.06, this.sfx, t + i * 0.08)); this.noise(0.15, 0.15, 'bandpass', 4000, 2000, 2, this.sfx, t + 0.05); break;
      case 'deny': this.tone('square', 180, 160, 0.18, 0.08); break;
      case 'door': this.noise(1.0, 0.45, 'lowpass', 600, 80, 1.2); this.tone('sawtooth', 70, 50, 0.8, 0.06); break;
      case 'power': this.tone('sawtooth', 40, 120, 2.2, 0.2); this.noise(0.4, 0.5, 'lowpass', 300, 1200, 1); [0, 0.5, 0.9].forEach((d) => this.noise(0.08, 0.4, 'highpass', 3000, 2000, 1, this.sfx, t + 1.0 + d)); break;
      case 'perk': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.1, this.sfx, t + i * 0.1)); this.noise(0.3, 0.15, 'bandpass', 2500, 800, 1.5, this.sfx, t + 0.5); break;
      case 'boxSpin': for (let i = 0; i < 26; i++) this.tone('triangle', 800 + (i % 5) * 160, 800 + (i % 5) * 160, 0.06, 0.05, this.sfx, t + i * (0.06 + i * 0.004)); break;
      case 'boxDone': [784, 1046, 1568].forEach((f, i) => this.tone('sine', f, f, 0.3, 0.1, this.sfx, t + i * 0.08)); break;
      case 'laugh': for (let i = 0; i < 5; i++) this.tone('sawtooth', 260 - i * 18, 200 - i * 18, 0.14, 0.12, this.sfx, t + i * 0.17); break;
      case 'forge': this.noise(1.5, 0.4, 'lowpass', 400, 2000, 1); [0, 0.4, 0.8, 1.2].forEach((d) => { this.tone('square', 1200, 900, 0.05, 0.12, this.sfx, t + d); this.noise(0.05, 0.3, 'bandpass', 3500, 2500, 3, this.sfx, t + d); }); break;
      case 'power-up': [660, 880, 990, 1320].forEach((f, i) => this.tone('sine', f, f, 0.18, 0.12, this.sfx, t + i * 0.06)); break;
      case 'nuke': this.noise(2.0, 0.9, 'lowpass', 1800, 40, 0.7); this.tone('sine', 70, 20, 1.8, 0.8); break;
      case 'drop': this.tone('sine', 1300, 1300, 0.5, 0.05); this.tone('sine', 1950, 1950, 0.5, 0.03); break;
      case 'roundStart': ['', ''].forEach(() => 0); [110, 104, 98].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, 1.0, 0.12, this.mus, t + i * 0.55)); this.noise(2.0, 0.15, 'lowpass', 300, 60, 1, this.mus, t); break;
      case 'roundEnd': [196, 233, 262, 311, 294].forEach((f, i) => this.tone('triangle', f, f, 0.7, 0.1, this.mus, t + i * 0.42)); break;
      case 'down': [220, 185, 147, 110].forEach((f, i) => this.tone('sawtooth', f, f * 0.95, 0.5, 0.1, this.sfx, t + i * 0.28)); break;
      case 'brute': this.tone('sawtooth', 70, 40, 1.6, 0.3); this.noise(1.4, 0.4, 'bandpass', 500, 150, 2); break;
      case 'step': if (this.throttle('step', 220)) return; this.noise(0.06, 0.06 * (opt || 1), 'lowpass', 500, 150, 1); break;
      case 'click': this.tone('triangle', 900, 1200, 0.05, 0.06); break;
    }
  }
  setDrone(level) { if (this.drone) this.drone.gain.setTargetAtTime(level, this.ctx.currentTime, 1.5); }
  startMusic() { this.playing = true; } stopMusic() { this.playing = false; }
  // sparse horror music: pulse + creepy music-box melody, intensity rises with round
  schedule() {
    if (!this.ctx || !this.playing) return;
    const spb = 60 / 84 / 2; const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const mel = [69, 72, 71, 67, 69, 64, -1, -1, 69, 72, 76, 75, 74, 71, -1, -1];
    while (this.nextT < this.ctx.currentTime + 0.2) {
      const st = this.step, t = this.nextT, s8 = st % 16, bar = Math.floor(st / 16) % 4;
      if (s8 % 4 === 0) this.tone('sine', 62, 38, 0.35, 0.35, this.mus, t);
      if (s8 % 8 === 6) this.noise(0.25, 0.06, 'bandpass', 600, 300, 2, this.mus, t);
      if (bar >= 2) { const n = mel[s8]; if (n > 0) { this.tone('sine', hz(n + 12), hz(n + 12), 0.5, 0.03, this.mus, t); this.tone('triangle', hz(n + 24), hz(n + 24), 0.25, 0.008, this.mus, t); } }
      if (s8 === 0 && bar === 0) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = hz(33); const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 1); g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 32); o.connect(f).connect(g).connect(this.mus); o.start(t); o.stop(t + spb * 32 + 0.1); }
      this.step++; this.nextT += spb;
    }
  }
}
