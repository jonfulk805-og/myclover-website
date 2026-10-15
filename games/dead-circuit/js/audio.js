// Procedural WebAudio: SFX, rotor hum, and a looping darksynth track. No audio files.
export class Audio {
  constructor() { this.ctx = null; this.enabled = localStorage.getItem('dcw_sound') !== '0'; this.music = localStorage.getItem('dcw_music') !== '0'; this.last = {}; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.enabled ? 0.8 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.gain.value = this.music ? 0.32 : 0; this.mus.connect(this.master);
    const len = c.sampleRate * 2; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
    // rotor hum
    this.hum = c.createGain(); this.hum.gain.value = 0; this.hum.connect(this.sfx);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const tremG = c.createGain(); tremG.gain.value = 0.75; lp.connect(tremG).connect(this.hum); this.humLP = lp;
    this.humOsc = [];
    for (const f of [92, 93.7, 184]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = c.createGain(); g.gain.value = f > 150 ? 0.15 : 0.3; o.connect(g).connect(lp); o.start(); this.humOsc.push(o); }
    const trem = c.createOscillator(); trem.frequency.value = 26; const tg = c.createGain(); tg.gain.value = 0.25; trem.connect(tg).connect(tremG.gain); trem.start();
    // boost noise
    this.boostG = c.createGain(); this.boostG.gain.value = 0; const bn = this.noiseSrc(true); const bf = c.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 900; bf.Q.value = 0.7; bn.connect(bf).connect(this.boostG).connect(this.sfx); bn.start();
    this.step = 0; this.nextT = c.currentTime + 0.1; this.playing = false;
    setInterval(() => this.schedule(), 30);
  }
  setEnabled(v) { this.enabled = v; localStorage.setItem('dcw_sound', v ? '1' : '0'); if (this.master) this.master.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05); }
  setMusic(v) { this.music = v; localStorage.setItem('dcw_music', v ? '1' : '0'); if (this.mus) this.mus.gain.setTargetAtTime(v ? 0.32 : 0, this.ctx.currentTime, 0.1); }
  noiseSrc(loop = false) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; return s; }
  throttle(k, ms) { const n = performance.now(); if (this.last[k] && n - this.last[k] < ms) return true; this.last[k] = n; return false; }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  tone(type, f0, f1, dur, vol, dest = this.sfx, t = this.ctx.currentTime) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, 0.004, vol, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, type, f0, f1, q = 1, dest = this.sfx, t = this.ctx.currentTime) {
    const s = this.noiseSrc(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this.env(g, t, 0.005, vol, dur); s.connect(f).connect(g).connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  play(name, opt = 0) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'shoot': if (this.throttle('shoot', 50)) return; this.tone('square', 880, 220, 0.08, 0.08); this.noise(0.06, 0.12, 'highpass', 3000, 1200); break;
      case 'hit': if (this.throttle('hit', 40)) return; this.tone('triangle', 1400 + Math.random() * 400, 600, 0.12, 0.12); this.noise(0.08, 0.16, 'bandpass', 2400, 900, 3); break;
      case 'houseHit': if (this.throttle('hit', 40)) return; this.noise(0.18, 0.25, 'lowpass', 1800, 300); this.tone('sine', 140, 60, 0.18, 0.2); break;
      case 'boom': { const s = opt || 1; this.noise(0.9 * s, 0.7, 'lowpass', 2400, 60, 0.8); this.tone('sine', 110, 30, 0.7 * s, 0.6); this.noise(0.3, 0.3, 'highpass', 4000, 1500); break; }
      case 'bigboom': this.noise(1.8, 0.9, 'lowpass', 2000, 40, 0.7); this.tone('sine', 80, 22, 1.5, 0.8); this.noise(0.5, 0.4, 'bandpass', 900, 200, 1); setTimeout(() => this.ctx && this.noise(1.2, 0.35, 'lowpass', 600, 80), 250); break;
      case 'charge': if (this.throttle('charge', 120)) return; this.tone('sine', 300, 900, 0.4, 0.03); break;
      case 'enemyShot': if (this.throttle('eshot', 60)) return; this.tone('sawtooth', 520, 90, 0.25, 0.07); this.tone('sine', 1200, 300, 0.18, 0.05); break;
      case 'hurt': this.noise(0.25, 0.5, 'lowpass', 1200, 200); this.tone('square', 160, 50, 0.25, 0.15); break;
      case 'shock': this.noise(0.9, 0.5, 'bandpass', 200, 3000, 0.8); this.tone('sine', 70, 28, 0.9, 0.8); this.tone('sawtooth', 200, 1400, 0.5, 0.06); break;
      case 'lock': if (this.throttle('lock', 90)) return; this.tone('sine', 1760, 1760, 0.05, 0.05); this.tone('sine', 2350, 2350, 0.05, 0.04, this.sfx, this.ctx.currentTime + 0.06); break;
      case 'click': this.tone('triangle', 900, 1200, 0.05, 0.06); break;
      case 'heal': [660, 880, 1320].forEach((f, i) => this.tone('sine', f, f, 0.18, 0.08, this.sfx, this.ctx.currentTime + i * 0.07)); break;
      case 'alarm': if (this.throttle('alarm', 900)) return; this.tone('square', 740, 740, 0.12, 0.05); this.tone('square', 520, 520, 0.12, 0.05, this.sfx, this.ctx.currentTime + 0.16); break;
      case 'clear': [440, 554, 659, 880, 1108].forEach((f, i) => this.tone('square', f, f, 0.22, 0.06, this.sfx, this.ctx.currentTime + i * 0.09)); break;
      case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone('square', f, f, 0.28, 0.06, this.sfx, this.ctx.currentTime + i * 0.13)); break;
      case 'fail': [392, 330, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, 0.4, 0.07, this.sfx, this.ctx.currentTime + i * 0.22)); break;
    }
  }
  setHum(on, speed = 0, boost = false) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.hum.gain.setTargetAtTime(on ? 0.12 : 0, t, 0.2);
    const k = 1 + speed * 0.012 + (boost ? 0.25 : 0);
    this.humOsc[0].frequency.setTargetAtTime(92 * k, t, 0.15); this.humOsc[1].frequency.setTargetAtTime(93.7 * k, t, 0.15); this.humOsc[2].frequency.setTargetAtTime(184 * k, t, 0.15);
    this.humLP.frequency.setTargetAtTime(220 + speed * 8, t, 0.2);
    this.boostG.gain.setTargetAtTime(boost && on ? 0.12 : 0, t, 0.08);
  }
  startMusic() { this.playing = true; }
  stopMusic() { this.playing = false; }
  // 110 bpm, A minor darksynth: bass 16ths, kick/snare/hat, pad chords
  schedule() {
    if (!this.ctx || !this.playing) return;
    const spb = 60 / 110 / 4;
    const prog = [[45, 52, 57], [41, 48, 53], [48, 55, 60], [43, 50, 55]];
    while (this.nextT < this.ctx.currentTime + 0.15) {
      const st = this.step, t = this.nextT, bar = Math.floor(st / 16) % 4, s16 = st % 16, ch = prog[bar];
      const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
      // bass
      if (s16 % 2 === 0 || s16 % 4 === 3) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = hz(ch[0] - 12 + (s16 === 14 ? 12 : 0)); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(160, t + 0.12); this.env(g, t, 0.005, 0.22, 0.13); o.connect(f).connect(g).connect(this.mus); o.start(t); o.stop(t + 0.2); }
      if (s16 % 4 === 0) this.tone('sine', 140, 40, 0.22, 0.6, this.mus, t);
      if (s16 === 4 || s16 === 12) this.noise(0.16, 0.25, 'bandpass', 1800, 900, 0.8, this.mus, t);
      if (s16 % 2 === 1) this.noise(0.04, 0.08, 'highpass', 8000, 7000, 1, this.mus, t);
      if (s16 === 0) for (const n of ch) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'triangle'; o.frequency.value = hz(n + 12); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 16); o.connect(g).connect(this.mus); o.start(t); o.stop(t + spb * 16 + 0.05); }
      if (bar % 2 === 1 && [0, 3, 6, 10].includes(s16)) this.tone('square', hz(ch[2] + 12 + (s16 === 10 ? 3 : 0)), hz(ch[2] + 12), 0.12, 0.025, this.mus, t);
      this.step++; this.nextT += spb;
    }
  }
}
