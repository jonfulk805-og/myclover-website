// LONG SHADOW - procedural WebAudio. No audio files.
export class Audio {
  constructor() { this.ctx = null; this.enabled = localStorage.getItem('ls_sound') !== '0'; this.music = localStorage.getItem('ls_music') !== '0'; this.last = {}; this.loops = {}; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.enabled ? 0.9 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0.0; this.amb.connect(this.master);
    this.mus = c.createGain(); this.mus.gain.value = this.music ? 0.32 : 0; this.mus.connect(this.master);
    const len = c.sampleRate * 2; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
    // valley echo send: two delay taps through a lowpass, fed by loud sounds
    this.echo = c.createGain(); this.echo.gain.value = 1;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; this.echo.connect(lp);
    for (const [dt, g] of [[0.42, 0.42], [0.95, 0.3], [1.7, 0.2], [2.6, 0.12]]) { const dl = c.createDelay(4); dl.delayTime.value = dt; const gg = c.createGain(); gg.gain.value = g; lp.connect(dl).connect(gg).connect(this.sfx); }
    // ambience: wind bed
    const wn = this.noiseSrc(true), wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.5; this.windG = c.createGain(); this.windG.gain.value = 0.07; wn.connect(wf).connect(this.windG).connect(this.amb); wn.start();
    const lfo = c.createOscillator(); lfo.frequency.value = 0.06; const lg = c.createGain(); lg.gain.value = 220; lfo.connect(lg).connect(wf.frequency); lfo.start();
    // music pad
    this.pad = c.createGain(); this.pad.gain.value = 0; this.pad.connect(this.mus);
    for (const f of [55, 82.4, 110.2, 130.8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12; const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 260; const g = c.createGain(); g.gain.value = 0.08; o.connect(lp2).connect(g).connect(this.pad); o.start(); }
    this.tens = c.createGain(); this.tens.gain.value = 0; this.tens.connect(this.mus);
    { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 220; const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 233.1; const g = c.createGain(); g.gain.value = 0.05; o.connect(g); o2.connect(g); g.connect(this.tens); o.start(); o2.start(); }
    this.pulseOn = 0; this.nextBeat = c.currentTime;
    setInterval(() => this.tick(), 50);
  }
  setEnabled(v) { this.enabled = v; localStorage.setItem('ls_sound', v ? '1' : '0'); if (this.master) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05); }
  setMusic(v) { this.music = v; localStorage.setItem('ls_music', v ? '1' : '0'); if (this.mus) this.mus.gain.setTargetAtTime(v ? 0.32 : 0, this.ctx.currentTime, 0.1); }
  ok() { return this.ctx && this.enabled; }
  noiseSrc(loop = false) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; return s; }
  throttle(k, ms) { const n = performance.now(); if (this.last[k] && n - this.last[k] < ms) return true; this.last[k] = n; return false; }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  pan(p) { const n = this.ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p || 0)); n.connect(this.sfx); return n; }
  tone(type, f0, f1, dur, vol, dest = this.sfx, t = this.ctx.currentTime, a = 0.004) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, a, vol, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + a + 0.05);
  }
  noise(dur, vol, type, f0, f1, q = 1, dest = this.sfx, t = this.ctx.currentTime, a = 0.003) {
    const s = this.noiseSrc(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this.env(g, t, a, vol, dur); s.connect(f).connect(g).connect(dest); s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
  }
  // ---------- weapons ----------
  shot(sub) {
    if (!this.ok()) return; const t = this.ctx.currentTime;
    if (sub) { this.noise(0.12, 0.5, 'lowpass', 900, 200, 1, this.sfx, t); this.tone('sine', 120, 50, 0.12, 0.5, this.sfx, t); this.noise(0.05, 0.18, 'bandpass', 3000, 2000, 2, this.sfx, t + 0.01); return; }
    this.noise(0.05, 1.0, 'highpass', 4000, 1500, 0.7, this.sfx, t);
    this.noise(0.45, 0.95, 'lowpass', 2400, 120, 0.8, this.sfx, t);
    this.tone('sine', 140, 38, 0.5, 0.9, this.sfx, t);
    this.noise(0.6, 0.55, 'lowpass', 1400, 120, 0.7, this.echo, t);
  }
  bolt(t0 = 0.35) { if (!this.ok()) return; const t = this.ctx.currentTime + t0; this.noise(0.03, 0.3, 'bandpass', 3200, 2600, 4, this.sfx, t); this.noise(0.08, 0.18, 'bandpass', 1800, 900, 2, this.sfx, t + 0.09); this.noise(0.07, 0.2, 'bandpass', 2000, 1200, 2, this.sfx, t + 0.25); this.noise(0.03, 0.32, 'bandpass', 3400, 2800, 4, this.sfx, t + 0.36); }
  reload() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noise(0.04, 0.3, 'bandpass', 2400, 2000, 3, this.sfx, t + 0.1); this.noise(0.1, 0.12, 'bandpass', 900, 600, 2, this.sfx, t + 0.4); this.noise(0.05, 0.35, 'bandpass', 2600, 2200, 3, this.sfx, t + 1.1); this.bolt(1.5); }
  dry() { if (!this.ok()) return; this.noise(0.03, 0.25, 'bandpass', 3000, 2600, 4); }
  swap() { if (!this.ok()) return; this.noise(0.05, 0.2, 'bandpass', 1800, 1500, 3); this.tone('square', 880, 880, 0.04, 0.03); }
  impact(kind, dist) {
    if (!this.ok()) return; const t = this.ctx.currentTime + Math.min(1.2, (dist || 0) / 343); const v = Math.max(0.05, 0.7 - (dist || 0) / 500);
    if (kind === 'flesh') { this.noise(0.09, v * 0.9, 'lowpass', 900, 200, 1, this.sfx, t); this.tone('sine', 90, 50, 0.1, v * 0.5, this.sfx, t); }
    else if (kind === 'metal') { this.tone('triangle', 2400, 1900, 0.35, v * 0.4, this.sfx, t); this.noise(0.04, v * 0.4, 'highpass', 3000, 2000, 1, this.sfx, t); }
    else { this.noise(0.12, v * 0.5, 'lowpass', 1200, 300, 1, this.sfx, t); }
  }
  killcamImpact() { if (!this.ok()) return; const t = this.ctx.currentTime; this.noise(0.3, 0.9, 'lowpass', 600, 80, 1, this.sfx, t); this.tone('sine', 70, 30, 0.6, 0.8, this.sfx, t); }
  killcamWhoosh(dur) { if (!this.ok()) return; const t = this.ctx.currentTime; this.noise(dur, 0.35, 'bandpass', 300, 1800, 3, this.sfx, t, 0.15); this.tone('sine', 50, 90, dur, 0.25, this.sfx, t, 0.2); }
  whiz(p) { if (!this.ok() || this.throttle('whiz', 90)) return; const d = this.pan(p); this.noise(0.18, 0.5, 'bandpass', 4200, 1200, 6, d); }
  enemyShot(dist, p) { if (!this.ok() || this.throttle('es', 50)) return; const t = this.ctx.currentTime + Math.min(1.5, dist / 343); const v = Math.max(0.06, 0.5 - dist / 700); const d = this.pan(p); this.noise(0.18, v, 'lowpass', 1800, 250, 0.8, d, t); this.tone('sine', 110, 50, 0.18, v * 0.6, d, t); }
  explosion(dist) { if (!this.ok()) return; const t = this.ctx.currentTime + Math.min(1.5, dist / 343); this.noise(1.6, 1.0, 'lowpass', 900, 60, 0.7, this.sfx, t); this.tone('sine', 60, 25, 1.4, 1, this.sfx, t); this.noise(1.5, 0.6, 'lowpass', 600, 80, 0.7, this.echo, t); }
  hurt() { if (!this.ok()) return; this.noise(0.15, 0.6, 'lowpass', 500, 100); this.tone('sine', 80, 40, 0.25, 0.6); }
  // ---------- world ----------
  genCough(dist) { if (!this.ok()) return; const t = this.ctx.currentTime + dist / 343; const v = Math.max(0.15, 0.9 - dist / 400); for (let i = 0; i < 4; i++) { this.noise(0.22, v * (i ? 0.5 : 1), 'lowpass', 700, 80, 0.8, this.sfx, t + i * 0.28 + Math.random() * 0.05); this.tone('sine', 70, 40, 0.2, v * 0.6, this.sfx, t + i * 0.28); } this.noise(0.8, v * 0.4, 'lowpass', 500, 90, 0.7, this.echo, t); }
  plane(dur) { if (!this.ok()) return; const c = this.ctx, t = c.currentTime; const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = 58; o2.frequency.value = 61; f.type = 'lowpass'; f.frequency.value = 320; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(f); o2.connect(f); f.connect(g).connect(this.sfx); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1); this.noise(dur, 0.25, 'lowpass', 300, 200, 0.5, this.sfx, t, dur * 0.45); }
  thunder(delay = 0) { if (!this.ok()) return; const t = this.ctx.currentTime + delay; this.noise(0.25, 0.9, 'lowpass', 2500, 400, 0.6, this.sfx, t); this.noise(3.2, 0.9, 'lowpass', 400, 50, 0.6, this.sfx, t + 0.05, 0.2); this.tone('sine', 45, 28, 3, 0.6, this.sfx, t + 0.1, 0.3); }
  bell(n = 3) { if (!this.ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < n; i++) for (const [f, v] of [[392, 0.25], [784, 0.08], [1176, 0.04]]) this.tone('sine', f, f * 0.995, 3.5, v, this.echo, t + i * 1.6, 0.003); }
  loop(name, on, opt = {}) {
    if (!this.ctx) return; const c = this.ctx; let L = this.loops[name];
    if (on && !L) {
      const g = c.createGain(); g.gain.value = 0.0001; g.connect(opt.music ? this.mus : this.sfx);
      const nodes = [];
      if (name === 'rain') { const s = this.noiseSrc(true), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900; s.connect(f).connect(g); s.start(); nodes.push(s); const s2 = this.noiseSrc(true), f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 500; const g2 = c.createGain(); g2.gain.value = 0.5; s2.connect(f2).connect(g2).connect(g); s2.start(0, 0.7); nodes.push(s2); }
      if (name === 'alarm') { const o = c.createOscillator(); o.type = 'sawtooth'; const l = c.createOscillator(); l.frequency.value = 0.55; const lg = c.createGain(); lg.gain.value = 260; l.connect(lg).connect(o.frequency); o.frequency.value = 640; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.2; o.connect(f).connect(g); o.start(); l.start(); nodes.push(o, l); }
      if (name === 'gen') { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 48; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; o.connect(f).connect(g); o.start(); nodes.push(o); }
      if (name === 'heart') { /* scheduled in tick */ }
      if (name === 'birds' || name === 'crickets') { /* scheduled in tick */ }
      L = this.loops[name] = { g, nodes, vol: 0 };
    }
    if (!L) return;
    const v = on ? (opt.vol ?? 0.3) : 0.0001; if (Math.abs(L.vol - v) > 0.005) { L.g.gain.setTargetAtTime(Math.max(0.0001, v), c.currentTime, 0.25); L.vol = v; }
  }
  stopLoops() { for (const k in this.loops) { const L = this.loops[k]; L.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1); L.vol = 0; } }
  setScene(s) { this.sceneKind = s; if (this.amb) this.amb.gain.setTargetAtTime(s ? 1 : 0, this.ctx.currentTime, 0.5); }
  setTension(k, alarm) { if (!this.ctx) return; const t = this.ctx.currentTime; this.pad.gain.setTargetAtTime(this.sceneKind ? 0.5 + k * 0.4 : 0.25, t, 0.6); this.tens.gain.setTargetAtTime(k > 0.05 ? 0.15 + k * 0.5 : 0, t, 0.3); this.pulseOn = alarm ? 2 : k > 0.3 ? 1 : 0; }
  heart(rate) { this.heartRate = rate; }
  tick() {
    if (!this.ctx || !this.enabled) return; const c = this.ctx, t = c.currentTime;
    if (this.heartRate && t > (this.nextHeart || 0)) { this.nextHeart = t + 60 / this.heartRate; this.tone('sine', 62, 40, 0.12, 0.35, this.sfx, t); this.tone('sine', 55, 36, 0.12, 0.22, this.sfx, t + 0.18); }
    if (this.pulseOn && t > this.nextBeat) { const fast = this.pulseOn === 2; this.nextBeat = t + (fast ? 0.32 : 0.6); this.tone('sine', fast ? 98 : 73.4, 40, 0.25, fast ? 0.22 : 0.16, this.mus, t); }
    if (this.sceneKind === 'day' && Math.random() < 0.02) this.bird();
    if (this.sceneKind === 'dusk' && Math.random() < 0.008) this.bird();
    if (this.sceneKind === 'night' && Math.random() < 0.03) this.cricket();
  }
  bird() { const c = this.ctx, t = c.currentTime, f = 2400 + Math.random() * 1800, n = 2 + (Math.random() * 4 | 0), p = this.ctx.createStereoPanner(); p.pan.value = Math.random() * 2 - 1; p.connect(this.amb); for (let i = 0; i < n; i++) this.tone('sine', f, f * (0.75 + Math.random() * 0.5), 0.07, 0.04, p, t + i * 0.11); }
  cricket() { const c = this.ctx, t = c.currentTime, p = c.createStereoPanner(); p.pan.value = Math.random() * 2 - 1; p.connect(this.amb); for (let i = 0; i < 3; i++) this.tone('square', 4400, 4300, 0.035, 0.012, p, t + i * 0.06); }
  // ---------- UI ----------
  ui(kind) {
    if (!this.ok()) return; const t = this.ctx.currentTime;
    if (kind === 'tag') { this.tone('sine', 1320, 1320, 0.06, 0.08, this.sfx, t); this.tone('sine', 1760, 1760, 0.08, 0.06, this.sfx, t + 0.06); }
    if (kind === 'target') { for (const [f, d] of [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.3]]) this.tone('triangle', f, f, 0.35, 0.12, this.sfx, t + d); }
    if (kind === 'suspicious') { this.tone('sine', 300, 700, 0.5, 0.08, this.sfx, t, 0.3); }
    if (kind === 'spotted') { this.tone('sawtooth', 220, 220, 0.15, 0.15, this.sfx, t); this.tone('sawtooth', 330, 330, 0.3, 0.15, this.sfx, t + 0.12); this.noise(0.4, 0.3, 'bandpass', 1500, 800, 2, this.sfx, t); }
    if (kind === 'click') { this.tone('sine', 900, 900, 0.03, 0.06, this.sfx, t); }
    if (kind === 'fail') { for (const [f, d] of [[392, 0], [311, 0.25], [233, 0.5]]) this.tone('triangle', f, f * 0.98, 0.6, 0.14, this.sfx, t + d); }
    if (kind === 'win') { for (const [f, d] of [[392, 0], [523, 0.15], [659, 0.3], [784, 0.45], [1046, 0.6]]) this.tone('triangle', f, f, 0.7, 0.13, this.sfx, t + d); }
    if (kind === 'breath') { this.noise(0.6, 0.08, 'bandpass', 700, 400, 1.5, this.sfx, t, 0.2); }
    if (kind === 'exhale') { this.noise(0.7, 0.09, 'bandpass', 500, 300, 1.5, this.sfx, t, 0.05); }
    if (kind === 'zoom') { this.noise(0.04, 0.05, 'bandpass', 3500, 3000, 6, this.sfx, t); }
  }
}
