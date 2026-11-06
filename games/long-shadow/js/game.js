// LONG SHADOW: Silent Contracts - stealth sniper. MyClover Arcade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { G, P, inp, REF, ZOOMS, STANCE, AMMO } from './state.js';
import { CONTRACTS, DIFFS } from './contracts.js';
import { buildScene, animateWorld } from './world.js';
import { groundH, groundN, RIDGE_Z, PLAY } from './terrain.js';
import { GEN } from './compound.js';
import { spawnAgents, updateAgents, detectionTick, startFlee, heliDust, losClear, angDiff } from './ai.js';
import { fireRifle, updateBullets, predict, traceSeg, zeroAngle, resetBallistics } from './ballistics.js';
import { drawHUD } from './hud.js';
import { makePerson, poseRig, hitVolumes } from './people.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { setAniso } from './textures.js';

const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MANUAL = location.search.includes('manual');
const BASE_FOV = 70;

// ---------------- quality ----------------
const QUALITY = {
  high: { shadows: true, shadowRes: 4096, bloom: true, pr: Math.min(window.devicePixelRatio || 1, 2), particles: 2200, grass: 9000, label: 'High' },
  low: { shadows: false, shadowRes: 1024, bloom: false, pr: 1, particles: 1200, grass: 3500, label: 'Low' },
};
let qKey = localStorage.getItem('ls_quality') || 'high'; if (!QUALITY[qKey]) qKey = 'high';
const Q = QUALITY[qKey]; REF.Q = Q;
REF.settings = { killcam: localStorage.getItem('ls_killcam') !== '0' };
G.sens = +(localStorage.getItem('ls_sens') || 1);

// ---------------- renderer ----------------
const canvas = $('view'), hud = $('hud'), hctx = hud.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pr); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = Q.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene(); REF.scene = scene;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 16 / 9, 0.05, 2000); camera.rotation.order = 'YXZ'; scene.add(camera); REF.camera = camera;
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.45, 0.5, 0.92); bloom.enabled = Q.bloom; composer.addPass(bloom);
const nvPass = new ShaderPass({ uniforms: { tDiffuse: { value: null }, t: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float t; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + t*43.0) * 43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.3,0.59,0.11)); l = pow(l * 9.0, 0.7) * 0.55; l += (h(vUv*800.0)-0.5)*0.12; float v = smoothstep(0.85, 0.35, length(vUv-0.5)); vec3 g = vec3(0.25, 1.0, 0.35) * l * v; gl_FragColor = vec4(g, 1.0); }` });
nvPass.enabled = false; composer.addPass(nvPass); composer.addPass(new OutputPass());
const audio = new Audio(); REF.audio = audio;

// ---------------- viewmodel rifle ----------------
const VM = new THREE.Group(); camera.add(VM);
const vmParts = {};
{
  const blk = new THREE.MeshStandardMaterial({ color: 0x1e2124, roughness: 0.45, metalness: 0.7 }), stock = new THREE.MeshStandardMaterial({ color: 0x5b5a3e, roughness: 0.8 }), glass = new THREE.MeshStandardMaterial({ color: 0x0a1a24, roughness: 0.05, metalness: 0.9, emissive: 0x0a1820 });
  const add = (g, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.x = rx; VM.add(o); return o; };
  add(new THREE.BoxGeometry(0.07, 0.09, 0.42), blk, 0, 0, 0);
  add(new THREE.CylinderGeometry(0.014, 0.017, 0.62, 10).rotateX(Math.PI / 2), blk, 0, 0.012, -0.5);
  add(new THREE.BoxGeometry(0.075, 0.12, 0.44), stock, 0, -0.03, 0.4); add(new THREE.BoxGeometry(0.06, 0.1, 0.1), stock, 0, -0.1, 0.12, -0.3);
  add(new THREE.BoxGeometry(0.06, 0.06, 0.32), stock, 0, -0.025, -0.3);
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.34, 14).rotateX(Math.PI / 2), blk, 0, 0.09, -0.02);
  add(new THREE.CylinderGeometry(0.038, 0.03, 0.08, 14).rotateX(Math.PI / 2), blk, 0, 0.09, -0.21); add(new THREE.CylinderGeometry(0.036, 0.03, 0.07, 14).rotateX(Math.PI / 2), blk, 0, 0.09, 0.17);
  add(new THREE.CircleGeometry(0.034, 18), glass, 0, 0.09, -0.252).rotation.y = Math.PI;
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), blk, 0, 0.135, -0.02); add(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8).rotateZ(Math.PI / 2), blk, 0.045, 0.09, -0.02);
  const bolt = add(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6).rotateZ(Math.PI / 2), blk, 0.05, 0.01, 0.1); vmParts.bolt = bolt;
  add(new THREE.SphereGeometry(0.014, 8, 6), blk, 0.085, 0.01, 0.1);
  add(new THREE.BoxGeometry(0.035, 0.07, 0.06), blk, 0, -0.07, -0.02);
  const sup = add(new THREE.CylinderGeometry(0.024, 0.024, 0.2, 12).rotateX(Math.PI / 2), blk, 0, 0.012, -0.9); vmParts.sup = sup;
  for (const s of [-1, 1]) { const l = add(new THREE.CylinderGeometry(0.007, 0.007, 0.2, 6), blk, s * 0.03, -0.1, -0.52); l.rotation.z = s * 0.25; l.rotation.x = 0.4; }
  // gloves
  const glove = new THREE.MeshStandardMaterial({ color: 0x2c2b22, roughness: 0.9 });
  add(new THREE.BoxGeometry(0.07, 0.07, 0.11), glove, 0.005, -0.08, 0.13); add(new THREE.BoxGeometry(0.07, 0.06, 0.12), glove, -0.01, -0.06, -0.33);
  VM.traverse((o) => { if (o.isMesh) { o.renderOrder = 10; } });
}
VM.scale.setScalar(0.5); VM.position.set(0.17, -0.16, -0.42);
{ const vl = new THREE.PointLight(0xfff0e0, 0.5, 1.2, 1); vl.position.set(0.1, 0.15, -0.1); camera.add(vl); }

// ---------------- plane (sound masking) ----------------
let plane = null;
function makePlane() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.6, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 26, 10).rotateZ(Math.PI / 2), m); g.add(body);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 40), m)); const tail = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.4), m); tail.position.set(-12, 2.5, 0); g.add(tail);
  const t2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 12), m); t2.position.set(-12, 0.8, 0); g.add(t2);
  for (const z of [-9, -16, 9, 16]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3, 8).rotateZ(Math.PI / 2), m); e.position.set(1.5, -0.6, z); g.add(e); }
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3030 })); blink.position.set(0, -1.6, 0); g.add(blink); g.userData.blink = blink;
  g.visible = false; scene.add(g); return g;
}

// ---------------- load a contract ----------------
let fx = null;
function loadContract(i, forTitle = false) {
  G.cIdx = i; const C = CONTRACTS[i]; G.contract = C;
  buildScene(scene, C, Q);
  fx = new FX(scene, Q); REF.fx = fx;
  plane = makePlane();
  renderer.toneMappingExposure = C.pal.exposure;
  scene.add(camera);
  if (forTitle) { for (const a of G.agents) scene.remove(a.rig.root); G.agents = []; G.D = DIFFS[G.diff]; G.stats = freshStats(); spawnAgents(C); }
  REF.loadedIdx = i;
}
function freshStats() { return { shots: 0, kills: 0, heads: 0, targets: 0, guards: 0, longest: 0, spotted: 0, alarms: 0, bodies: 0, sus: 0, masked: 0, accidents: 0, score: 0, time: 0 }; }

function startContract() {
  const C = CONTRACTS[G.cIdx];
  if (REF.loadedIdx !== G.cIdx || REF.dirty) loadContract(G.cIdx);
  else { // reset world bits that change in play
    loadContract(G.cIdx);
  }
  REF.dirty = true;
  G.D = DIFFS[G.diff]; G.stats = freshStats(); G.t = 0; G.ts = 1; G.clock = C.exfil * G.D.exfil; G.leaving = false;
  G.alarm = 'none'; G.alarmT = 0; G.lastKnown = null; G.lastSeenT = -99; G.shotHeardT = []; G.bullets = []; G.tracers = []; G.popups = []; G.banner = { text: C.name.toUpperCase(), sub: `${C.sub}  /  ${C.time}  /  ${C.weather}`, t: 4, col: '#ffb648' };
  G.over = false; G.overT = 0; G.result = null; G.killcam = null; G.map = false; G.escaped = false; G.aboard = []; G.heliState = 'idle'; G.heliT = 0; G.flash = 0; REF.heliSpin = 0; G.maxMeter = 0;
  G.nv = false; nvPass.enabled = false;
  const ws = rnd(C.wind[0], C.wind[1]), wa = rnd(-0.6, 0.6) + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2); G.windBase = { s: ws, a: wa }; G.wind = { x: Math.sin(wa) * ws, z: Math.cos(wa) * ws };
  spawnAgents(C); resetBallistics();
  // player
  const sp = pickSpawn(); P.x = sp[0]; P.z = sp[1]; P.y = groundH(P.x, P.z); P.yaw = Math.PI; P.pitch = -0.08; P.stance = 1; P.eye = STANCE[1].eye;
  P.hp = P.max = G.D.php; P.dead = false; P.mag = 5; P.magType = 'super'; P.ammo = { super: 20, sub: 10 }; P.fireCD = 0; P.reloadT = 0; P.boltT = 0; P.breath = 1; P.breathLock = 0; P.heart = 70; P.scoped = false; P.scopeK = 0; P.binoc = false; P.zoomI = 2; P.tagK = 0; P.tagAim = null; P.vx = P.vz = 0; P.regenT = 0;
  vmParts.sup.visible = false;
  // masking schedule
  G.nextMask = {}; for (const k in C.masking) G.nextMask[k] = rnd(C.masking[k][0], C.masking[k][1]) * (k === 'gen' ? 0.45 : 0.6);
  G.mask = { until: 0, kind: '', len: 1, warnAt: 0, warnKind: '' };
  audio.init(); audio.stopLoops(); audio.setScene(C.pal.scene); audio.loop('gen', true, { vol: 0.02 }); if (C.rain) audio.loop('rain', true, { vol: 0.16 });
  setScreen(null); G.state = 'play'; lockPointer();
}

// a spot on the ridge with a clear crouched view of the villa and the yard
function pickSpawn() {
  const good = [], bushy = [];
  for (let x = -70; x <= 70; x += 5) for (let d = 2; d <= 24; d += 2) {
    const z = RIDGE_Z(x) + d; if (groundN(x, z, _n).y < 0.8) continue; const y = groundH(x, z) + 1.02;
    if (REF.veg.trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.5)) continue;
    const nb = REF.veg.bushes.find((b) => Math.hypot(b.x - x, b.z - z) < b.r + 1.5);
    if (losClear(x, y, z, 0, 5, 64) && losClear(x, y, z, -50, 2, 22) && losClear(x, y, z, 40, 2, 20)) {
      if (!nb) good.push([x, z]);
      else { // tuck in at the front edge of the bush, facing the valley
        const bx = nb.x, bz = nb.z + nb.r * 0.62; if (groundN(bx, bz, _n).y > 0.8 && losClear(bx, groundH(bx, bz) + 1.02, bz, 0, 5, 64)) bushy.push([bx, bz]);
      }
    }
  }
  if (bushy.length) return bushy[(Math.random() * bushy.length) | 0];
  if (!good.length) return [0, RIDGE_Z(0) + 10];
  return good[(Math.random() * good.length) | 0];
}

// ---------------- screens ----------------
const SCREENS = ['loading', 'title', 'brief', 'pause', 'over', 'how'];
function setScreen(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); $('touchUI').classList.toggle('hidden', !(REF.touch && !id && G.state === 'play')); }
function lockPointer() { if (REF.touch || MANUAL) return; try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
function pause() { if (G.state !== 'play') return; G.state = 'paused'; setScreen('pause'); if (document.pointerLockElement) document.exitPointerLock(); }
function resume() { G.state = 'play'; setScreen(null); lockPointer(); }
function toTitle() { G.state = 'title'; audio.stopLoops?.(); audio.setScene?.(null); setScreen('title'); if (document.pointerLockElement) document.exitPointerLock(); if (REF.loadedIdx !== G.cIdx || REF.dirty) { loadContract(G.cIdx, true); REF.dirty = false; } renderTitle(); }

// title contract cards
function bestOf(id) { try { return JSON.parse(localStorage.getItem(`ls_best_${id}_${G.diff}`) || 'null'); } catch (e) { return null; } }
function renderTitle() {
  const el = $('contracts'); el.innerHTML = '';
  CONTRACTS.forEach((C, i) => {
    const b = bestOf(C.id); const d = document.createElement('button'); d.className = 'ct' + (i === G.cIdx ? ' sel' : '');
    const sw = `background: radial-gradient(circle at 35% 35%, ${C.pal.sunColor}, ${C.pal.skyTop}); box-shadow: 0 0 12px ${C.pal.sunColor}55;`;
    d.innerHTML = `<span class="sw" style="${sw}"></span><div class="n">${C.sub}</div><div class="t">${C.name}</div><div class="w">${C.time} &middot; ${C.weather}</div><div class="r">${b ? `${'&#9733;'.repeat(b.stars)} ${b.rating} &middot; ${b.score}` : ''}</div>`;
    d.onclick = () => { audio.init(); audio.ui('click'); if (G.cIdx === i) return; G.cIdx = i; renderTitle(); showLoading('Moving to a new valley...', () => { loadContract(i, true); REF.dirty = false; }); };
    el.appendChild(d);
  });
  for (const b of $('diffSel').children) b.classList.toggle('sel', b.dataset.d === G.diff);
  const D = DIFFS[G.diff]; $('diffNote').textContent = G.diff === 'easy' ? 'Guards are slower to notice you, the impact marker is always on, light wind.' : G.diff === 'normal' ? 'Hold your breath to see where the round will land. Real wind.' : 'No impact marker. Sharper eyes, stronger wind, less time. Ghosts only.'; void D;
}
function showLoading(msg, fn) { $('loadTxt').textContent = msg; $('loading').classList.remove('hidden'); setTimeout(() => { fn(); $('loading').classList.add('hidden'); }, 40); }
function openBrief() {
  const C = CONTRACTS[G.cIdx]; $('bSub').textContent = C.sub; $('bTime').textContent = C.time; $('bWeather').textContent = C.weather; $('bName').textContent = C.name; $('bBlurb').textContent = C.blurb;
  const tg = $('bTargets'); tg.innerHTML = '';
  for (const t of C.targets) { const d = document.createElement('div'); d.className = 'tg'; const cv = portrait(t); d.appendChild(cv); const info = document.createElement('div'); info.innerHTML = `<span>${t.role}</span><b>${t.name}</b><p>${t.tell}</p>`; d.appendChild(info); tg.appendChild(d); }
  const m = C.masking, intel = [];
  if (m.gen) intel.push('<b>Generator:</b> the old genset by the comms shack coughs every half minute or so. A supersonic shot during the cough is masked.');
  if (m.plane) intel.push('<b>Cargo flights:</b> a low transport crosses the valley every minute or two. Its drone masks shots for several seconds.');
  if (m.thunder) intel.push('<b>Storm:</b> after each lightning flash the thunder takes about a second to arrive and then covers a shot for a few seconds. The flash also lights you up.');
  if (C.searchlight) intel.push('<b>Searchlight</b> on the north-east tower sweeps the ridge. Do not be in the beam. Night vision: <b>N</b>.');
  if (C.id === 'dusk') intel.push('<b>Low sun</b> behind the compound. Scoping toward it puts a glint on your lens.');
  intel.push(`<b>Wind:</b> ${C.wind[0]}-${C.wind[1]} m/s across the valley. Exfil in about ${Math.round(C.exfil * DIFFS[G.diff].exfil / 60)} minutes.`);
  $('bIntel').innerHTML = intel.map((s) => `<li>${s}</li>`).join('');
  setScreen('brief');
}
// tiny rendered portrait of a target
const pR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); pR.setSize(88, 88); pR.outputColorSpace = THREE.SRGBColorSpace;
function portrait(t) {
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2)); const dl = new THREE.DirectionalLight(0xffe0c0, 2.2); dl.position.set(1, 2, 2); sc.add(dl);
  const rig = makePerson({ ...t.look }, false); sc.add(rig.root); poseRig(rig, { walk: 0, phase: 0, act: 'idle', headYaw: 0.25, t: 0 });
  const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 20); cam.position.set(0.25, 1.62, 1.6); cam.lookAt(0, 1.5, 0);
  pR.render(sc, cam); const c = document.createElement('canvas'); c.width = 88; c.height = 88; c.getContext('2d').drawImage(pR.domElement, 0, 0); return c;
}

// ---------------- popups / scoring hooks ----------------
REF.popup = (text, sub, col) => { G.popups.push({ text, sub, col, t: 0, age: 0 }); if (G.popups.length > 3) G.popups.shift(); };
REF.score = (base, head, dist) => { G.stats.score += base + head + Math.round(dist * 2); };
REF.onPlayerHit = (dmg, dir) => { if (P.dead || G.over) return; P.hp -= dmg; P.regenT = 0; G.dmgT = 1; G.dmgDir = dir; P.heart = Math.min(150, P.heart + 25); audio.hurt(); if (P.hp <= 0) { P.dead = true; endContract(false, 'You were shot', 'They found the ridge and put enough rounds into it.'); } };

// ---------------- input ----------------
const keys = {};
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  if (keys[e.code]) return; keys[e.code] = true;
  if (G.state === 'play' && !G.killcam) {
    if (e.code === 'KeyC') setStance(P.stance === 1 ? 0 : 1);
    if (e.code === 'KeyZ' || e.code === 'KeyX') setStance(P.stance === 2 ? 1 : 2);
    if (e.code === 'Space') setStance(P.stance === 0 ? 1 : 0);
    if (e.code === 'KeyF') toggleBinoc();
    if (e.code === 'KeyR') reload();
    if (e.code === 'KeyB') switchAmmo();
    if (e.code === 'KeyN') toggleNV();
    if (e.code === 'Tab') G.map = true;
    if (e.code === 'Equal' || e.code === 'NumpadAdd') zoom(1); if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoom(-1);
  }
  if (G.killcam && (e.code === 'Space' || e.code === 'Enter')) skipKillcam();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') pause(); else if (G.state === 'paused') resume(); }
  if (e.code === 'KeyM') { audio.init(); audio.setEnabled(!audio.enabled); syncLabels(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Tab') G.map = false; });
canvas.addEventListener('mousedown', (e) => {
  audio.init();
  if (G.state !== 'play') return;
  if (!document.pointerLockElement && !MANUAL && !REF.touch) { lockPointer(); return; }
  if (G.killcam) { skipKillcam(); return; }
  if (e.button === 0) { inp.fire = true; inp.fireEdge = true; }
  if (e.button === 2) { inp.scope = true; }
});
addEventListener('mouseup', (e) => { if (e.button === 0) inp.fire = false; if (e.button === 2) inp.scope = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => { if (G.state !== 'play' || !document.pointerLockElement || G.killcam) return; look(e.movementX, e.movementY, 0.0022); });
addEventListener('wheel', (e) => { if (G.state === 'play') zoom(e.deltaY < 0 ? 1 : -1); }, { passive: true });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.state === 'play' && !MANUAL && !REF.touch && !G.over) pause(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; inp.fire = inp.scope = false; });
function look(dx, dy, k) { const f = camera.fov / BASE_FOV; P.yaw -= dx * k * G.sens * (0.35 + 0.65 * f); P.pitch = clamp(P.pitch - dy * k * G.sens * (0.35 + 0.65 * f), -1.3, 1.2); }
function setStance(s) { if (s === P.stance) return; P.stance = s; audio.ui('click'); }
function toggleBinoc() { P.binoc = !P.binoc; if (P.binoc) { inp.scope = false; P.scoped = false; } audio.ui('zoom'); P.tagK = 0; }
function zoom(d) { if (!(P.scopeK > 0.5 || P.scoped)) return; const n = clamp(P.zoomI + d, 0, ZOOMS.length - 1); if (n !== P.zoomI) { P.zoomI = n; audio.ui('zoom'); } }
function toggleNV() { G.nv = !G.nv; nvPass.enabled = G.nv; audio.ui('click'); }
function reload(type) {
  if (P.reloadT > 0) return; const t = type || P.magType; if (P.ammo[t] <= 0 || (t === P.magType && P.mag >= 5)) { if (!type) audio.dry(); return; }
  P.pendingType = t; P.reloadDur = P.reloadT = 2.2; audio.reload();
}
function switchAmmo() { const t = P.magType === 'super' ? 'sub' : 'super'; if (P.ammo[t] <= 0) { REF.popup('No ' + AMMO[t].label.toLowerCase() + ' left', '', '#ff8a6a'); return; } P.reloadT = 0; reload(t); }
function finishReload() {
  const t = P.pendingType || P.magType;
  if (t !== P.magType) { P.ammo[P.magType] += P.mag; P.mag = 0; P.magType = t; }
  const need = 5 - P.mag, take = Math.min(need, P.ammo[t]); P.mag += take; P.ammo[t] -= take; P.pendingType = null; vmParts.sup.visible = P.magType === 'sub';
}

// touch
REF.touch = matchMedia('(pointer: coarse)').matches || location.search.includes('touch');
if (REF.touch) document.body.classList.add('touch');
{
  let lookId = null, lx = 0, ly = 0, stickId = null, sx = 0, sy = 0;
  const tl = $('tLook'), ts = $('tStick'), knob = $('tKnob');
  tl.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; if (G.killcam) skipKillcam(); e.preventDefault(); }, { passive: false });
  tl.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) { look(t.clientX - lx, t.clientY - ly, 0.0042); lx = t.clientX; ly = t.clientY; } e.preventDefault(); }, { passive: false });
  tl.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; });
  ts.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; stickId = t.identifier; const r = ts.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
  ts.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === stickId) { let dx = (t.clientX - sx) / 50, dy = (t.clientY - sy) / 50; const L = Math.hypot(dx, dy); if (L > 1) { dx /= L; dy /= L; } inp.lx = dx; inp.ly = dy; knob.style.transform = `translate(${dx * 36}px,${dy * 36}px)`; } e.preventDefault(); }, { passive: false });
  const endStick = (e) => { for (const t of e.changedTouches) if (t.identifier === stickId) { stickId = null; inp.lx = inp.ly = 0; knob.style.transform = ''; } };
  ts.addEventListener('touchend', endStick); ts.addEventListener('touchcancel', endStick);
  const btn = (id, down, up) => { const b = $(id); b.addEventListener('touchstart', (e) => { e.preventDefault(); audio.init(); down(b); }, { passive: false }); if (up) b.addEventListener('touchend', (e) => { e.preventDefault(); up(b); }, { passive: false }); };
  btn('tFire', () => { inp.fire = true; inp.fireEdge = true; }, () => { inp.fire = false; });
  btn('tScope', (b) => { REF.touchScope = !REF.touchScope; b.classList.toggle('on', REF.touchScope); if (REF.touchScope) P.binoc = false; });
  btn('tBreath', (b) => { inp.breathT = true; b.classList.add('on'); }, (b) => { inp.breathT = false; b.classList.remove('on'); });
  btn('tStance', () => setStance((P.stance + 1) % 3));
  btn('tBino', () => { toggleBinoc(); REF.touchScope = false; $('tScope').classList.remove('on'); });
  btn('tReload', () => reload()); btn('tAmmo', () => switchAmmo()); btn('tZin', () => zoom(1)); btn('tZout', () => zoom(-1));
  btn('tMap', () => { G.map = !G.map; }); btn('tPause', () => pause());
}
// gamepad
const padPrev = {};
function pollPad(dt) {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null; if (!gp) return;
  const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
  inp.px = dz(gp.axes[0]); inp.py = dz(gp.axes[1]);
  const rx = dz(gp.axes[2]), ry = dz(gp.axes[3]); if (G.state === 'play' && !G.killcam) look(rx * 900 * dt, ry * 650 * dt, 0.0022);
  const b = (i) => gp.buttons[i] && gp.buttons[i].pressed; const edge = (i) => b(i) && !padPrev[i];
  if (G.state === 'play') {
    inp.padScope = b(6); if (edge(7)) { inp.fireEdge = true; } inp.padFire = b(7); inp.padBreath = b(5);
    if (edge(3)) toggleBinoc(); if (edge(1)) setStance((P.stance + 1) % 3); if (edge(2)) reload(); if (edge(4)) switchAmmo();
    if (edge(12)) zoom(1); if (edge(13)) zoom(-1); G.padMap = b(8); if (edge(9)) pause(); if (edge(0) && G.killcam) skipKillcam();
  } else if (G.state === 'paused' && edge(9)) resume();
  for (let i = 0; i < gp.buttons.length; i++) padPrev[i] = b(i);
}

// ---------------- player ----------------
const _n = new THREE.Vector3(), _f = new THREE.Vector3(), _up = new THREE.Vector3(), _o = new THREE.Vector3();
function updatePlayer(dt) {
  const st = STANCE[P.stance];
  P.eye += (st.eye - P.eye) * Math.min(1, dt * 7);
  const wantScope = (inp.scope || REF.touchScope || inp.padScope) && P.reloadT <= 0 && !P.binoc;
  P.scoped = wantScope; P.scopeK = clamp(P.scopeK + (wantScope ? dt * 5 : -dt * 7), 0, 1);
  // move
  let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + (inp.lx || 0) + (inp.px || 0), mz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + (inp.ly || 0) + (inp.py || 0);
  const L = Math.hypot(mx, mz); if (L > 1) { mx /= L; mz /= L; }
  const sprint = keys.ShiftLeft && P.stance === 0 && !P.scoped && !P.binoc && mz < 0;
  let spd = sprint ? 5.6 : st.spd; if (P.scoped || P.binoc) spd *= 0.4;
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const tvx = (rx * mx - fx * mz) * spd, tvz = (rz * mx - fz * mz) * spd;
  P.vx += (tvx - P.vx) * Math.min(1, dt * 10); P.vz += (tvz - P.vz) * Math.min(1, dt * 10);
  let nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
  const ok = (x, z) => x > PLAY.x0 && x < PLAY.x1 && z > PLAY.z0 && z < PLAY.z1 && z - RIDGE_Z(x) < 30 && groundN(x, z, _n).y > 0.6;
  if (!ok(nx, nz)) { if (ok(nx, P.z)) nz = P.z; else if (ok(P.x, nz)) nx = P.x; else { nx = P.x; nz = P.z; } if (z0warn(nz)) REF.popup('Stay on the ridge', 'Down there you are just another target.', '#ffb648'); }
  // trunks + rocks
  for (const t of REF.veg.trees) { if (Math.abs(t.x - nx) > 2 || Math.abs(t.z - nz) > 2) continue; const d = Math.hypot(nx - t.x, nz - t.z), r = t.r + 0.35; if (d < r && d > 1e-4) { nx = t.x + (nx - t.x) / d * r; nz = t.z + (nz - t.z) / d * r; } }
  for (const t of REF.veg.rocks) { if (t.r < 0.9 || Math.abs(t.x - nx) > 4 || Math.abs(t.z - nz) > 4) continue; const d = Math.hypot(nx - t.x, nz - t.z), r = t.r * 0.8 + 0.3; if (d < r && d > 1e-4) { nx = t.x + (nx - t.x) / d * r; nz = t.z + (nz - t.z) / d * r; } }
  P.speed = Math.hypot(nx - P.x, nz - P.z) / Math.max(dt, 1e-4); P.x = nx; P.z = nz; P.y = groundH(P.x, P.z);
  P.bob += dt * P.speed * 2.2;
  P.inBush = REF.veg.bushes.some((b) => Math.abs(b.x - P.x) < 3 && Math.abs(b.z - P.z) < 3 && Math.hypot(b.x - P.x, b.z - P.z) < b.r * 0.85);
  // light
  P.inLight = false; const S = REF.search;
  if (S && S.dir) { const dx = P.x - S.L.position.x, dy = P.y + 0.5 - S.L.position.y, dz = P.z - S.L.position.z, l = Math.hypot(dx, dy, dz); const c = (dx * S.dir.x + dy * S.dir.y + dz * S.dir.z) / l; if (c > Math.cos(S.angle * 1.25)) P.inLight = true; }
  // glint
  P.glint = false; if (G.contract.id === 'dusk' && P.scopeK > 0.9) { camera.getWorldDirection(_f); const sd = REF.sunDir; const a = Math.acos(clamp((_f.x * sd.x + _f.z * sd.z) / (Math.hypot(_f.x, _f.z) * Math.hypot(sd.x, sd.z)), -1, 1)); if (a < 0.5) P.glint = true; }
  // breath + sway
  const wantHold = (keys.ShiftLeft || keys.ShiftRight || inp.breathT || inp.padBreath) && P.scopeK > 0.5 && P.breathLock <= 0;
  if (wantHold && !P.holding && P.breath > 0.15) { P.holding = true; audio.ui('breath'); }
  if (!wantHold && P.holding) { P.holding = false; audio.ui('exhale'); }
  if (P.holding) { P.breath -= dt / 5.5; if (P.breath <= 0) { P.breath = 0; P.holding = false; P.breathLock = 2.6; audio.ui('exhale'); P.heart = Math.min(150, P.heart + 15); } }
  else { P.breath = Math.min(1, P.breath + dt / 3.2); P.breathLock = Math.max(0, P.breathLock - dt); }
  if (sprint) P.heart = Math.min(150, P.heart + dt * 14); else P.heart += (68 - P.heart) * Math.min(1, dt * 0.25);
  const ampK = st.sway * (1 + (P.heart - 70) / 55) * (P.holding ? 0.07 : 1) * (P.breathLock > 0 ? 1.9 : 1) * (1 + P.speed * 0.6);
  P.sway += (ampK - P.sway) * Math.min(1, dt * 4);
  const t = G.t * 1; const A = 0.0042 * P.sway;
  P.swayX = A * (Math.sin(t * 0.83) * 0.6 + Math.sin(t * 1.97 + 1.1) * 0.3 + Math.sin(t * 3.7 + 2) * 0.1);
  P.swayY = A * (Math.sin(t * 1.21 + 0.5) * 0.55 + Math.sin(t * 2.43 + 0.3) * 0.3 + Math.sin(t * 0.47) * 0.25) + (P.holding ? 0 : Math.sin(t * 1.6) * A * 0.4);
  audio.heart(P.scopeK > 0.5 && (P.holding || P.heart > 95) ? P.heart : 0);
  // health regen
  P.regenT += dt; if (P.regenT > 7 && P.hp < P.max) P.hp = Math.min(P.max, P.hp + dt * 6);
  // timers
  P.boltT = Math.max(0, P.boltT - dt); P.fireCD = Math.max(0, P.fireCD - dt);
  if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) finishReload(); }
  P.recoil = Math.max(0, P.recoil - dt * 3);
  // fire
  if (inp.fireEdge) {
    inp.fireEdge = false;
    if (P.reloadT <= 0 && P.boltT <= 0 && !P.binoc) {
      if (P.mag <= 0) { audio.dry(); reload(); }
      else fire();
    }
  }
}
let warnCD = 0; function z0warn() { if (warnCD > 0) return false; warnCD = 4; return true; }
function aimDir(out) { camera.updateMatrixWorld(); camera.getWorldDirection(out); return out; }
function fire() {
  aimDir(_f); _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  if (P.scopeK < 0.9) { _f.x += rnd(-0.025, 0.025); _f.y += rnd(-0.02, 0.02); _f.z += rnd(-0.025, 0.025); _f.normalize(); }
  _f.addScaledVector(_up, zeroAngle(P.magType)).normalize();
  camera.getWorldPosition(_o);
  fireRifle({ x: _o.x, y: _o.y, z: _o.z }, _f);
  P.mag--; P.boltT = 1.15; P.recoil = 1; P.heart = Math.min(150, P.heart + 6); audio.bolt();
  if (P.magType === 'super') { fx.smokePuff(_o.x + _f.x * 1.5, _o.y - 0.2, _o.z + _f.z * 1.5, 0.6, 0.6, 1.4, 0.5); if (P.stance === 2) for (let k = 0; k < 4; k++) fx.smokePuff(_o.x + _f.x * 1.2 + rnd(-0.6, 0.6), P.y + 0.1, _o.z + _f.z * 1.2, 0.8, 0.55, 1.6, 0.4); }
  if (P.mag <= 0 && (P.ammo[P.magType] > 0)) setTimeout(() => { if (G.state === 'play' && P.mag <= 0) reload(); }, 900);
}

// ---------------- camera ----------------
function updateCamera(dt) {
  const k = P.scopeK, bino = P.binoc;
  const zoomFov = BASE_FOV / ZOOMS[P.zoomI];
  const targetFov = bino ? BASE_FOV / 8 : BASE_FOV + (zoomFov - BASE_FOV) * (k > 0.9 ? 1 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 18); if (Math.abs(camera.fov - targetFov) < 0.01) camera.fov = targetFov;
  camera.updateProjectionMatrix();
  const bob = P.speed > 0.2 && k < 0.5 ? Math.sin(P.bob) * 0.03 : 0;
  camera.position.set(P.x, P.y + P.eye + bob, P.z);
  const sw = k > 0.5 || bino ? 1 : 0.25;
  camera.rotation.set(P.pitch + P.swayY * sw + P.recoil * P.recoil * 0.035 * (k > 0.5 ? 1 : 0.4), P.yaw + P.swayX * sw, 0);
  // viewmodel
  const showVM = k < 0.9 && !bino && !REF.touch; VM.visible = showVM;
  VM.position.set(0.1 * (1 - k) + Math.sin(P.bob * 0.5) * 0.004 * (1 - k), -0.095 + k * 0.045 + Math.abs(Math.cos(P.bob * 0.5)) * 0.003 - (P.reloadT > 0 ? 0.05 : 0), -0.2 + k * 0.05 + P.recoil * 0.03);
  VM.rotation.set(P.reloadT > 0 ? 0.35 : P.recoil * 0.1, 0, P.reloadT > 0 ? 0.3 : 0);
  vmParts.bolt.position.z = 0.1 + (P.boltT > 0.3 && P.boltT < 0.9 ? 0.07 : 0);
}

// ---------------- masking events ----------------
function updateMasking(dt) {
  const C = G.contract; const genD = Math.hypot(P.x - GEN.x, P.z - GEN.z);
  for (const kind in G.nextMask) {
    G.nextMask[kind] -= dt;
    if (kind === 'gen') { G.mask.warnAt = G.t + G.nextMask.gen; G.mask.warnKind = 'Generator is rattling...'; }
    if (kind === 'plane' && G.nextMask.plane < 9 && !plane.visible) { plane.visible = true; plane.userData.t = 0; G.mask.warnAt = G.t + G.nextMask.plane; G.mask.warnKind = 'Cargo plane inbound'; audio.plane(20); }
    if (G.nextMask[kind] > 0) continue;
    const r = C.masking[kind]; G.nextMask[kind] = rnd(r[0], r[1]);
    if (kind === 'gen') { setMask(2.6, 'Generator'); audio.genCough(genD); for (let i = 0; i < 6; i++) setTimeout(() => fx.smokePuff(GEN.x + 1.1, 3.3, GEN.z - 0.5, 1.2, 0.12, 2.2, 2.4), i * 160); }
    if (kind === 'plane') { setMask(8.5, 'Cargo plane'); }
    if (kind === 'thunder') { G.flash = 1; setTimeout(() => { G.flash = 0.8; }, 180); audio.thunder(1.0); setTimeout(() => setMask(3.4, 'Thunder'), 1000); }
  }
  if (plane.visible) { const u = plane.userData; u.t += dt; const x = -520 + u.t * 55; plane.position.set(x, 170, 30 + Math.sin(u.t * 0.05) * 20); plane.rotation.set(0, 0, 0.02); u.blink.visible = (u.t % 1.2) < 0.15; if (x > 520) plane.visible = false; }
  if (G.flash > 0) { G.flash = Math.max(0, G.flash - dt * 2.2); }
  REF.hemi.intensity = REF.hemiBase + G.flash * 3.2 + (REF.flashT > 0 ? REF.flashT * 2 : 0); if (REF.flashT > 0) REF.flashT -= dt;
}
function setMask(len, kind) { G.mask.until = G.t + len; G.mask.len = len; G.mask.kind = kind; }

// ---------------- tagging / range / marker ----------------
let aimTick = 0; const _p = new THREE.Vector3();
function updateAim(dt) {
  aimTick++;
  const zoomed = P.scopeK > 0.9 || P.binoc;
  if (zoomed && aimTick % 3 === 0) {
    aimDir(_f); camera.getWorldPosition(_o);
    const h = traceSeg(_o.x, _o.y, _o.z, _o.x + _f.x * 900, _o.y + _f.y * 900, _o.z + _f.z * 900);
    P.range = h ? Math.hypot(h.x - _o.x, h.y - _o.y, h.z - _o.z) : 0;
  }
  // impact marker
  const mode = G.D.marker; P.markerOn = P.scopeK > 0.9 && (mode === 'always' || (mode === 'breath' && P.holding));
  if (P.markerOn && aimTick % 2 === 0) { aimDir(_f); _up.set(0, 1, 0).applyQuaternion(camera.quaternion); _f.addScaledVector(_up, zeroAngle(P.magType)).normalize(); camera.getWorldPosition(_o); P.marker = predict(_o, _f, P.magType); }
  // tagging
  if (!zoomed) { P.tagAim = null; P.tagK = 0; return; }
  let best = null, bd = Math.min(innerWidth, innerHeight) * 0.05;
  for (const a of G.agents) {
    if (a.hidden || a.gone || (a.tagged && !a.isTarget) || (a.tagged && a.dead)) continue;
    _p.set(a.x, a.y + 1.2, a.z).project(camera); if (_p.z > 1) continue;
    const sx = _p.x * innerWidth / 2, sy = _p.y * innerHeight / 2; const d = Math.hypot(sx, sy); if (d < bd) { bd = d; best = a; }
  }
  if (best && best.tagged) best = null;
  if (best !== P.tagAim) { P.tagAim = best; P.tagK = 0; }
  if (best) {
    if (aimTick % 6 === 0) best._los = losClear(_o.x, _o.y, _o.z, best.x, best.y + 1.4, best.z);
    if (best._los !== false) { P.tagK += dt / (P.binoc ? 0.45 : 0.9); if (P.tagK >= 1) { best.tagged = true; audio.ui('tag'); if (best.isTarget) REF.popup('TARGET IDENTIFIED', `${best.name} - ${best.role}`, '#ffd36a'); P.tagK = 0; P.tagAim = null; } }
  }
}

// ---------------- kill cam ----------------
const _kc = new THREE.Vector3(), _kl = new THREE.Vector3();
let bulletMesh = null;
function ensureBulletMesh() {
  if (bulletMesh && bulletMesh.parent === scene) return bulletMesh;
  const g = new THREE.Group(); const cu = new THREE.MeshStandardMaterial({ color: 0xd08848, metalness: 0.45, roughness: 0.3, emissive: 0x1a0c04 }); const br = new THREE.MeshStandardMaterial({ color: 0xe0b868, metalness: 0.45, roughness: 0.3, emissive: 0x1a1404 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0043, 0.0043, 0.022, 14).rotateX(Math.PI / 2), cu); g.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0043, 0.02, 14).rotateX(-Math.PI / 2), cu); tip.position.z = -0.021; g.add(tip);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0043, 0.004, 14).rotateX(Math.PI / 2), br); base.position.z = 0.013; g.add(base);
  const light = new THREE.PointLight(0xffe0c0, 0.35, 1.2); light.position.set(0.06, 0.08, 0.04); g.add(light);
  g.scale.setScalar(3.2); scene.add(g); bulletMesh = g; return g;
}
function updateKillcam(rdt) {
  const k = G.killcam; k.t += rdt; VM.visible = false;
  const bm = ensureBulletMesh();
  if (k.phase === 'fly') {
    const b = k.b; bm.visible = true; bm.position.set(b.x, b.y, b.z);
    _kc.set(b.vx, b.vy, b.vz).normalize(); bm.lookAt(b.x - _kc.x, b.y - _kc.y, b.z - _kc.z);
    // slow down further over the last stretch
    const left = Math.hypot(k.agent.x - b.x, k.agent.y + 1.4 - b.y, k.agent.z - b.z) / 860;
    G.ts = Math.max(0.012, Math.min(G.ts, left < 0.03 ? 0.035 : G.ts));
    const side = new THREE.Vector3(-_kc.z, 0, _kc.x).normalize(); const orbit = Math.sin(k.t * 0.9) * 0.1;
    camera.position.set(b.x - _kc.x * 0.42 + side.x * (0.09 + orbit), b.y - _kc.y * 0.42 + 0.05, b.z - _kc.z * 0.42 + side.z * (0.09 + orbit));
    camera.lookAt(b.x + _kc.x * 0.4, b.y + _kc.y * 0.4, b.z + _kc.z * 0.4); camera.fov = 55; camera.updateProjectionMatrix();
    k.lastDir = _kc.clone();
  } else {
    bm.visible = false;
    if (!k.impactSnd) { k.impactSnd = true; audio.killcamImpact(); }
    const a = k.agent; const d = k.lastDir || new THREE.Vector3(0, 0, 1);
    const side = new THREE.Vector3(-d.z, 0, d.x).normalize();
    const ang = k.t * 0.35;
    _kl.set(a.x, a.y + 0.9 - Math.min(0.6, k.t * 0.4), a.z);
    camera.position.set(a.x - d.x * 3.2 * Math.cos(ang) + side.x * 2.6 * Math.sin(ang + 0.6), a.y + 1.5, a.z - d.z * 3.2 * Math.cos(ang) + side.z * 2.6 * Math.sin(ang + 0.6));
    camera.lookAt(_kl); camera.fov = 50; camera.updateProjectionMatrix();
    if (k.t > 2.2) skipKillcam();
  }
}
function skipKillcam() { if (!G.killcam) return; const k = G.killcam; if (k.phase === 'fly') { // finish the flight instantly
    G.ts = 1; let n = 0; while (G.bullets.includes(k.b) && n++ < 400) updateBullets(1 / 120); }
  G.killcam = null; G.ts = 1; if (bulletMesh) bulletMesh.visible = false; VM.visible = true; }

// ---------------- contract end ----------------
function endContract(win, title, sub) {
  if (G.over) return; G.over = true; G.overT = 0;
  const s = G.stats; s.time = G.t;
  let rating, stars;
  if (win) {
    const ghost = s.alarms === 0 && s.spotted === 0 && s.bodies === 0 && s.guards === 0 && s.accidents === 0;
    const silent = s.alarms === 0 && s.spotted === 0 && s.bodies === 0;
    rating = ghost ? 'Ghost' : silent ? 'Silent Assassin' : s.alarms <= 1 ? 'Professional' : 'Contractor'; stars = ghost ? 3 : silent ? 3 : s.alarms <= 1 ? 2 : 1;
    if (ghost) stars = 3;
    s.score += (s.alarms === 0 ? 1500 : 0) + (s.spotted === 0 ? 1000 : 0) + (s.bodies === 0 ? 500 : 0) + s.masked * 100 + Math.round(Math.max(0, G.clock) * 2) - s.alarms * 500 + (ghost ? 2000 : 0);
    s.score = Math.max(0, s.score);
  } else { rating = 'Failed'; stars = 0; }
  G.result = { win, rating, stars, title: title || rating, sub };
  audio.ui(win ? 'win' : 'fail'); audio.loop('alarm', false);
  setTimeout(() => showResult(), win ? 1400 : 1800);
}
function showResult() {
  const r = G.result, s = G.stats, C = G.contract;
  G.state = 'over'; if (document.pointerLockElement) document.exitPointerLock();
  $('ovEyebrow').innerHTML = `<i></i>${r.win ? 'Contract complete' : 'Contract failed'}`; $('ovEyebrow').classList.toggle('red', !r.win);
  $('ovTitle').textContent = r.win ? r.rating : r.title; $('ovSub').textContent = r.win ? ratingLine(r.rating) : r.sub;
  $('ovStars').innerHTML = r.win ? '&#9733;'.repeat(r.stars) + '<i>' + '&#9733;'.repeat(3 - r.stars) + '</i>' : '';
  $('ovScore').textContent = r.win ? s.score.toLocaleString() : '-';
  const st = [[`${s.targets}/${C.targets.length}`, 'Targets'], [s.heads, 'Headshots'], [`${Math.round(s.longest)} m`, 'Longest shot'], [s.guards, 'Guards killed'], [s.spotted, 'Times spotted'], [s.bodies, 'Bodies found'], [`${s.masked}/${s.shots}`, 'Masked shots'], [s.accidents, 'Accidents'], [fmtT(s.time), 'Time']];
  $('ovStats').innerHTML = st.map(([b, l]) => `<div><b>${b}</b><span>${l}</span></div>`).join('');
  let bestTxt = '';
  if (r.win) { const key = `ls_best_${C.id}_${G.diff}`; const prev = bestOf(C.id); if (!prev || s.score > prev.score) { localStorage.setItem(key, JSON.stringify({ score: s.score, rating: r.rating, stars: r.stars })); bestTxt = prev ? `New best on ${DIFFS[G.diff].label}! (was ${prev.score.toLocaleString()})` : `First clear on ${DIFFS[G.diff].label}.`; } else bestTxt = `Best on ${DIFFS[G.diff].label}: ${prev.score.toLocaleString()} (${prev.rating})`; }
  $('ovBest').textContent = bestTxt;
  $('btnNext').classList.toggle('hidden', !(r.win && G.cIdx < CONTRACTS.length - 1));
  setScreen('over');
}
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function ratingLine(r) { return { Ghost: 'Only the targets died, and nobody ever knew you were there.', 'Silent Assassin': 'Nobody saw you and nobody found a body.', Professional: 'They knew something was wrong, but the job got done.', Contractor: 'Loud and messy. The client will pay, but they will not call again.' }[r]; }

// ---------------- main update ----------------
function update(rdt) {
  if (G.state !== 'play') return;
  if (G.killcam) updateKillcam(rdt);
  const dt = rdt * G.ts;
  G.t += dt; G.stats.time = G.t;
  if (!G.killcam) { updatePlayer(dt); updateCamera(rdt); updateAim(rdt); }
  updateMasking(dt);
  REF.veg.clearU.value.set(P.x, [0.001, 2.4, 4.2][P.stance] + (P.scopeK > 0.5 ? 1.2 : 0), P.z);
  { const zoomed = P.scopeK > 0.5 || P.binoc; REF.veg.laneU.value.set(-Math.sin(P.yaw), -Math.cos(P.yaw), zoomed ? [6, 12, 22][P.stance] : 0, 1.6); }
  // wind gusts
  const ws = G.windBase.s * (0.85 + 0.25 * Math.sin(G.t * 0.13) + 0.1 * Math.sin(G.t * 0.41)), wa = G.windBase.a + Math.sin(G.t * 0.07) * 0.2; G.wind.x = Math.sin(wa) * ws; G.wind.z = Math.cos(wa) * ws;
  updateAgents(dt); if (!G.over) detectionTick(dt); heliDust();
  updateBullets(dt);
  fx.update(dt);
  for (const p of G.popups) { p.t += rdt; p.age += rdt; } G.popups = G.popups.filter((p) => p.age < 2.4);
  if (G.banner) G.banner.t -= rdt; G.dmgT = Math.max(0, G.dmgT - rdt * 1.5); warnCD -= rdt;
  for (const tr of G.tracers) tr.t -= rdt; G.tracers = G.tracers.filter((t) => t.t > -0.01 && (!t.ghost || (t.life -= rdt) > 0));
  // clock
  if (!G.over) {
    G.clock -= dt;
    if (G.clock <= 0 && !G.leaving) { G.leaving = true; G.banner = { text: 'THEY ARE LEAVING', sub: 'The targets are heading for the helicopter.', t: 3.5, col: '#ff4a3a' }; for (const a of G.agents) if (a.isTarget && !a.dead) startFlee(a, false); }
    const T = G.agents.filter((a) => a.isTarget);
    if (T.every((a) => a.dead) && !G.killcam) endContract(true);
    else if (G.escaped && G.aboard.some((a) => !a.dead)) endContract(false, 'A target escaped', `${G.aboard.find((a) => !a.dead).name} made it onto the helicopter.`);
  }
  const tension = G.alarm === 'alarm' ? 1 : Math.max(G.maxMeter || 0, G.alarm === 'search' ? 0.6 : 0);
  audio.setTension(tension, G.alarm === 'alarm');
  audio.loop('gen', true, { vol: clamp(0.06 - Math.hypot(P.x - GEN.x, P.z - GEN.z) / 5000, 0.01, 0.05) });
}

// tracer lines (enemy fire + your round's ghost trail)
const trGeo = new THREE.BufferGeometry(); const trPos = new Float32Array(600 * 6); trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3).setUsage(THREE.DynamicDrawUsage));
const trMesh = new THREE.LineSegments(trGeo, new THREE.LineBasicMaterial({ color: 0xffd090, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); trMesh.frustumCulled = false;
const ghGeo = new THREE.BufferGeometry(); const ghPos = new Float32Array(2000 * 6); ghGeo.setAttribute('position', new THREE.BufferAttribute(ghPos, 3).setUsage(THREE.DynamicDrawUsage));
const ghMesh = new THREE.LineSegments(ghGeo, new THREE.LineBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })); ghMesh.frustumCulled = false;
function drawTracers() {
  if (trMesh.parent !== scene) scene.add(trMesh); if (ghMesh.parent !== scene) scene.add(ghMesh);
  let n = 0, g = 0;
  for (const t of G.tracers) {
    if (t.ghost) { const tr = t.trail; for (let i = 1; i < tr.length && g < 2000; i++) { ghPos.set([...tr[i - 1], ...tr[i]], g * 6); g++; } continue; }
    if (t.t <= 0 || n >= 600) continue; const k = 1 - t.t / 0.09; const ax = t.a[0] + (t.b[0] - t.a[0]) * k * 0.7, ay = t.a[1] + (t.b[1] - t.a[1]) * k * 0.7, az = t.a[2] + (t.b[2] - t.a[2]) * k * 0.7;
    trPos.set([ax, ay, az, ax + (t.b[0] - t.a[0]) * 0.3, ay + (t.b[1] - t.a[1]) * 0.3, az + (t.b[2] - t.a[2]) * 0.3], n * 6); n++;
  }
  // live bullets: short streak
  for (const b of G.bullets) { if (g >= 2000) break; const tr = b.trail; for (let i = 1; i < tr.length && g < 2000; i++) { ghPos.set([...tr[i - 1], ...tr[i]], g * 6); g++; } }
  trGeo.setDrawRange(0, n * 2); trGeo.attributes.position.needsUpdate = true; ghGeo.setDrawRange(0, g * 2); ghGeo.attributes.position.needsUpdate = true;
  ghMesh.material.opacity = P.scopeK > 0.9 ? 0.3 : 0.12;
}

// ---------------- title camera ----------------
function titleCam(t) {
  const a = t * 0.035; const x = Math.sin(a) * 50; const z = RIDGE_Z(x) + 20; const y = groundH(x, z) + 6;
  camera.position.set(x, y, z); camera.fov = 52; camera.updateProjectionMatrix(); camera.lookAt(Math.sin(a * 0.7) * 25, 6, 55); VM.visible = false;
  for (const a2 of G.agents) { /* idle patrols keep the valley alive */ void a2; }
}

// ---------------- loop ----------------
let last = performance.now(), titleT = 0;
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  const dpr = Math.min(window.devicePixelRatio || 1, 2); hud.width = w * dpr; hud.height = h * dpr; REF.hudScale = dpr * clamp(Math.min(w / 1280, h / 720) * 1.05, 0.72, 1.25);
}
addEventListener('resize', resize);
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  stepFrame(rdt);
  render();
}
function stepFrame(rdt) {
  pollPad(rdt);
  if (G.state === 'play') update(rdt);
  else if (G.state === 'title' || G.state === 'brief') { titleT += rdt; titleCam(titleT); G.t += rdt; if (G.agents.length && G.stats) { updateAgentsTitle(rdt); } }
  const tt = G.state === 'play' ? G.t : titleT;
  animateWorld(rdt * (G.state === 'play' ? G.ts : 1), tt, camera, REF.search?.focus);
  if (REF.veg?.grassU) { /* reserved */ }
  if (fx && G.state !== 'play') fx.update(rdt);
  nvPass.uniforms.t.value = tt;
}
function updateAgentsTitle(dt) { const saveAlarm = G.alarm; G.alarm = 'none'; updateAgents(dt); G.alarm = saveAlarm; }
function render() {
  drawTracers();
  composer.render();
  drawHUD(hctx, hud.width, hud.height, REF.hudScale, camera);
}

// ---------------- UI wiring ----------------
function syncLabels() {
  document.querySelectorAll('.qualLbl').forEach((e) => (e.textContent = Q.label)); document.querySelectorAll('.sndLbl').forEach((e) => (e.textContent = audio.enabled ? 'On' : 'Off'));
  document.querySelectorAll('.musLbl').forEach((e) => (e.textContent = audio.music ? 'On' : 'Off')); document.querySelectorAll('.kcLbl').forEach((e) => (e.textContent = REF.settings.killcam ? 'On' : 'Off'));
}
$('diffSel').addEventListener('click', (e) => { const d = e.target.closest('button')?.dataset.d; if (!d) return; G.diff = d; localStorage.setItem('ls_diff', d); audio.init(); audio.ui('click'); renderTitle(); });
$('btnStart').onclick = () => { audio.init(); audio.ui('click'); openBrief(); G.state = 'brief'; };
$('btnBack').onclick = () => { G.state = 'title'; setScreen('title'); };
$('btnGo').onclick = () => { audio.init(); showLoading('Moving into position...', startContract); };
$('btnResume').onclick = resume; $('btnRestart').onclick = () => showLoading('Resetting the valley...', startContract); $('btnQuit').onclick = () => showLoading('Leaving the ridge...', toTitle);
$('btnAgain').onclick = () => showLoading('Resetting the valley...', startContract); $('btnMenu').onclick = () => showLoading('Leaving the ridge...', toTitle);
$('btnNext').onclick = () => { G.cIdx = Math.min(CONTRACTS.length - 1, G.cIdx + 1); REF.dirty = true; G.state = 'brief'; showLoading('Moving to a new valley...', () => { loadContract(G.cIdx, true); openBrief(); }); };
let howFrom = 'title';
$('btnHow').onclick = () => { howFrom = 'title'; setScreen('how'); }; $('btnHowP').onclick = () => { howFrom = 'pause'; setScreen('how'); }; $('btnHowClose').onclick = () => setScreen(howFrom);
document.querySelectorAll('.btnSnd').forEach((b) => (b.onclick = () => { audio.init(); audio.setEnabled(!audio.enabled); syncLabels(); }));
document.querySelectorAll('.btnMus').forEach((b) => (b.onclick = () => { audio.init(); audio.setMusic(!audio.music); syncLabels(); }));
document.querySelectorAll('.btnKc').forEach((b) => (b.onclick = () => { REF.settings.killcam = !REF.settings.killcam; localStorage.setItem('ls_killcam', REF.settings.killcam ? '1' : '0'); syncLabels(); }));
document.querySelectorAll('.btnQual').forEach((b) => (b.onclick = () => { localStorage.setItem('ls_quality', qKey === 'high' ? 'low' : 'high'); location.reload(); }));
$('sens').value = G.sens; $('sensVal').textContent = G.sens.toFixed(2);
$('sens').oninput = (e) => { G.sens = +e.target.value; $('sensVal').textContent = G.sens.toFixed(2); localStorage.setItem('ls_sens', G.sens); };

// ---------------- boot ----------------
G.diff = localStorage.getItem('ls_diff') || 'normal'; if (!DIFFS[G.diff]) G.diff = 'normal';
resize(); syncLabels();
setTimeout(() => {
  loadContract(0, true); REF.dirty = false; G.state = 'title'; setScreen('title'); renderTitle();
  requestAnimationFrame(frame);
}, 30);

// ---------------- test hooks ----------------
window.__LS = { G, P, REF, inp, keys, CONTRACTS, DIFFS, start: (i = 0, d = 'normal') => { G.cIdx = i; G.diff = d; startContract(); }, step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) stepFrame(dt); }, render: () => render(), fire: () => { inp.fireEdge = true; }, aimAt: (x, y, z) => { const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, predict, zeroAngle, traceSeg, camera, skipKillcam, toTitle, setScreen, angDiff, hitVolumes, losClear,
  fireDir: (d) => { camera.getWorldPosition(_o); fireRifle({ x: _o.x, y: _o.y, z: _o.z }, d); P.mag--; P.boltT = 1.15; if (P.mag <= 0) reload(); }, camPos: () => { camera.getWorldPosition(_o); return { x: _o.x, y: _o.y, z: _o.z }; } };
