// WebAudio synth: every sound and every jukebox tune is generated here.
let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, comp = null;
export const A = { muted: false, musicVol: 0.5, sfxVol: 0.9, track: null, nextT: 0, step: 0 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  master = ctx.createGain(); master.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.connect(master); musBus = ctx.createGain(); musBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVol();
}
export function applyVol() { if (!ctx) return; master.gain.value = A.muted ? 0 : 1; sfxBus.gain.value = A.sfxVol; musBus.gain.value = A.musicVol * 0.55; }
export function setMuted(m) { A.muted = m; applyVol(); }

function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function osc(type, f, t, dur, peak, bus = sfxBus, f2 = null, a = 0.004) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, a, peak, dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + a + dur + 0.05); return o;
}
function noise(t, dur, peak, type = 'bandpass', f = 1000, q = 1, bus = sfxBus, f2 = null, a = 0.003) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, a, peak, dur); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
}
const R = (a, b) => a + Math.random() * (b - a);

export function sfx(name, vol = 1) {
  if (!ctx || A.muted) return; const t = ctx.currentTime + 0.005; vol = Math.min(1.5, vol);
  switch (name) {
    case 'punch': osc('sine', R(140, 170), t, 0.12, 0.7 * vol, sfxBus, 50); noise(t, 0.06, 0.5 * vol, 'lowpass', 2200, 0.7); break;
    case 'heavy': osc('sine', R(90, 110), t, 0.22, 0.95 * vol, sfxBus, 35); noise(t, 0.12, 0.7 * vol, 'lowpass', 1500, 0.7); noise(t, 0.04, 0.3 * vol, 'highpass', 3000); break;
    case 'smack': osc('triangle', R(220, 260), t, 0.08, 0.5 * vol, sfxBus, 90); noise(t, 0.05, 0.6 * vol, 'highpass', 1800, 0.8); break;
    case 'whiff': noise(t, 0.16, 0.18 * vol, 'bandpass', 600, 2, sfxBus, 2400, 0.04); break;
    case 'block': osc('square', 180, t, 0.07, 0.25 * vol, sfxBus, 120); noise(t, 0.08, 0.4 * vol, 'bandpass', 900, 3); break;
    case 'parry': osc('triangle', 1400, t, 0.25, 0.35 * vol, sfxBus, 1800); osc('triangle', 2100, t + 0.02, 0.2, 0.2 * vol); noise(t, 0.05, 0.4 * vol, 'highpass', 4000); break;
    case 'glass': for (let i = 0; i < 9; i++) osc('sine', R(2400, 6200), t + R(0, 0.12), R(0.05, 0.25), R(0.06, 0.16) * vol); noise(t, 0.25, 0.55 * vol, 'highpass', 3500, 0.7); osc('sine', 300, t, 0.05, 0.3 * vol, sfxBus, 120); break;
    case 'wood': noise(t, 0.18, 0.75 * vol, 'bandpass', R(500, 800), 1.5); osc('square', R(90, 130), t, 0.09, 0.25 * vol, sfxBus, 50); noise(t + 0.05, 0.12, 0.35 * vol, 'bandpass', 1500, 2); break;
    case 'crash': noise(t, 0.5, 0.8 * vol, 'lowpass', 1800, 0.5, sfxBus, 300); osc('sine', 70, t, 0.35, 0.8 * vol, sfxBus, 30); noise(t + 0.03, 0.2, 0.4 * vol, 'bandpass', 700, 2); break;
    case 'metal': for (let i = 0; i < 4; i++) osc('triangle', R(300, 900), t, R(0.3, 0.7), 0.15 * vol); noise(t, 0.08, 0.5 * vol, 'bandpass', 2000, 4); break;
    case 'thud': osc('sine', 80, t, 0.18, 0.6 * vol, sfxBus, 40); noise(t, 0.1, 0.35 * vol, 'lowpass', 600); break;
    case 'land': osc('sine', 60, t, 0.25, 0.8 * vol, sfxBus, 30); noise(t, 0.2, 0.5 * vol, 'lowpass', 900); break;
    case 'throw': noise(t, 0.22, 0.25 * vol, 'bandpass', 500, 1.5, sfxBus, 1800, 0.05); break;
    case 'grab': noise(t, 0.08, 0.3 * vol, 'bandpass', 1200, 1); osc('sine', 300, t, 0.05, 0.12 * vol, sfxBus, 200); break;
    case 'drink': for (let i = 0; i < 4; i++) osc('sine', R(160, 240), t + i * 0.11, 0.09, 0.3 * vol, sfxBus, R(90, 120), 0.02); break;
    case 'burp': { const o = osc('sawtooth', 95, t, 0.45, 0.28 * vol, sfxBus, 70, 0.03); noise(t, 0.4, 0.2 * vol, 'lowpass', 400); break; }
    case 'hurt': osc('sawtooth', R(130, 150), t, 0.18, 0.18 * vol, sfxBus, 80); noise(t, 0.12, 0.3 * vol, 'lowpass', 800); break;
    case 'ooh': for (let i = 0; i < 3; i++) { const f = [520, 780, 1100][i]; noise(t, 0.9, 0.12 * vol, 'bandpass', f, 9, sfxBus, f * 0.8, 0.25); } break;
    case 'cheer': for (let i = 0; i < 6; i++) noise(t + i * 0.05, 0.7, 0.09 * vol, 'bandpass', R(600, 2400), 4, sfxBus, null, 0.08); break;
    case 'bell': for (const f of [880, 1320, 2200]) osc('sine', f, t, 1.2, 0.18 * vol, sfxBus, null, 0.002); break;
    case 'ko': osc('sine', 600, t, 0.5, 0.25 * vol, sfxBus, 150); osc('square', 80, t, 0.3, 0.2 * vol, sfxBus, 40); break;
    case 'twinkle': for (let i = 0; i < 3; i++) osc('sine', 1800 + i * 500, t + i * 0.06, 0.15, 0.07 * vol); break;
    case 'combo': osc('triangle', 660, t, 0.12, 0.15 * vol); osc('triangle', 990, t + 0.07, 0.15, 0.15 * vol); break;
    case 'strum': for (let i = 0; i < 6; i++) osc('sawtooth', [82, 110, 147, 196, 247, 330][i], t + i * 0.018, 0.9, 0.08 * vol, sfxBus, null, 0.002); break;
    case 'pop': osc('square', 400, t, 0.06, 0.1 * vol, sfxBus, 900); break;
    case 'foam': noise(t, 1.2, 0.6 * vol, 'highpass', 1200, 0.5, sfxBus, 4000, 0.01); osc('sine', 60, t, 0.3, 0.6 * vol, sfxBus, 30); break;
    case 'door': osc('square', 70, t, 0.3, 0.2 * vol, sfxBus, 50); noise(t, 0.25, 0.3 * vol, 'lowpass', 500); break;
    case 'stomp': osc('sine', 55, t, 0.6, 1 * vol, sfxBus, 25); noise(t, 0.5, 0.6 * vol, 'lowpass', 400); break;
    case 'ui': osc('triangle', 880, t, 0.06, 0.12 * vol, sfxBus, 1200); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, t + i * 0.12, 0.35, 0.2 * vol)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => osc('triangle', f, t + i * 0.18, 0.4, 0.18 * vol)); break;
  }
}

// ---- jukebox: tiny step sequencer per venue -----------------------------
const N = n => 440 * Math.pow(2, (n - 69) / 12);
const TRACKS = {
  pub: { bpm: 168, steps: 12, // jig in 6/8 feel, D major
    lead: [74, 0, 76, 78, 0, 76, 74, 0, 71, 73, 0, 74, 76, 0, 78, 81, 0, 78, 76, 0, 74, 73, 0, 71], bass: [50, 0, 0, 57, 0, 0, 50, 0, 0, 55, 0, 0, 47, 0, 0, 54, 0, 0, 45, 0, 0, 57, 0, 0],
    drum: 'x..o..x..o..', leadW: 'square', leadV: .05, bassW: 'triangle', bassV: .16 },
  saloon: { bpm: 132, steps: 8, // honky tonk stride
    lead: [67, 71, 74, 71, 72, 0, 71, 69, 67, 0, 64, 67, 69, 72, 71, 69, 67, 71, 74, 79, 78, 76, 74, 72, 71, 69, 67, 0, 62, 0, 67, 0], bass: [43, 0, 55, 0, 38, 0, 55, 0, 48, 0, 60, 0, 43, 0, 59, 0, 43, 0, 55, 0, 38, 0, 55, 0, 50, 0, 62, 0, 43, 0, 55, 0],
    drum: 'x.o.x.o.', leadW: 'triangle', leadV: .09, bassW: 'triangle', bassV: .17, chord: true },
  disco: { bpm: 122, steps: 16,
    lead: [0, 0, 72, 0, 0, 72, 0, 75, 0, 0, 70, 0, 0, 70, 0, 67, 0, 0, 72, 0, 0, 72, 0, 77, 0, 0, 75, 0, 72, 0, 70, 0], bass: [36, 48, 36, 48, 36, 48, 36, 48, 41, 53, 41, 53, 43, 55, 43, 55, 36, 48, 36, 48, 36, 48, 36, 48, 41, 53, 41, 53, 43, 55, 46, 58],
    drum: 'x.h.xoh.x.h.xoh.', leadW: 'sawtooth', leadV: .035, bassW: 'sawtooth', bassV: .1 },
  road: { bpm: 104, steps: 8, // blues rock shuffle in E
    lead: [0, 0, 0, 0, 0, 0, 64, 67, 69, 0, 67, 64, 0, 0, 62, 64, 0, 0, 0, 0, 0, 0, 71, 69, 67, 0, 64, 62, 64, 0, 0, 0], bass: [40, 40, 44, 44, 47, 47, 49, 47, 40, 40, 44, 44, 47, 47, 49, 47, 45, 45, 49, 49, 52, 52, 54, 52, 40, 40, 44, 44, 47, 47, 49, 47],
    drum: 'x.o.x.o.', leadW: 'square', leadV: .045, bassW: 'sawtooth', bassV: .1, dist: true },
  title: { bpm: 96, steps: 8,
    lead: [74, 0, 0, 73, 71, 0, 69, 0, 71, 0, 0, 0, 66, 0, 0, 0, 67, 0, 0, 69, 71, 0, 74, 0, 73, 0, 0, 0, 0, 0, 0, 0], bass: [38, 0, 50, 0, 38, 0, 50, 0, 35, 0, 47, 0, 35, 0, 47, 0, 31, 0, 43, 0, 31, 0, 43, 0, 33, 0, 45, 0, 33, 0, 45, 0],
    drum: 'x...o...', leadW: 'triangle', leadV: .07, bassW: 'triangle', bassV: .14 },
};
export function playMusic(name) { if (!ctx) return; A.track = TRACKS[name] || null; A.step = 0; A.nextT = ctx.currentTime + 0.1; }
export function stopMusic() { A.track = null; }
export function tickMusic(intensity = 0) {
  if (!ctx || !A.track || A.muted) return;
  const T = A.track, sp = 60 / T.bpm / (T.steps === 12 ? 3 : 2) * (T.steps === 16 ? 1 : 1);
  while (A.nextT < ctx.currentTime + 0.15) {
    const i = A.step, t = A.nextT;
    const l = T.lead[i % T.lead.length], b = T.bass[i % T.bass.length], dch = T.drum[i % T.drum.length];
    if (l) { osc(T.leadW, N(l), t, sp * 1.6, T.leadV, musBus, null, 0.01); if (T.chord && i % 4 === 0) { osc('triangle', N(l - 5), t, sp * 1.4, .04, musBus); osc('triangle', N(l - 8), t, sp * 1.4, .04, musBus); } }
    if (b) osc(T.bassW, N(b), t, sp * (T.dist ? 1.1 : 1.6), T.bassV, musBus, null, 0.01);
    if (dch === 'x') { osc('sine', 120, t, 0.14, 0.35 + intensity * .2, musBus, 40); }
    if (dch === 'o') noise(t, 0.12, 0.16 + intensity * .1, 'bandpass', 1800, 0.8, musBus);
    if (dch === 'h' || (intensity > 0.5 && i % 2)) noise(t, 0.03, 0.05, 'highpass', 7000, 1, musBus);
    A.step++; A.nextT += sp;
  }
}
export function audioTime() { return ctx ? ctx.currentTime : 0; }
