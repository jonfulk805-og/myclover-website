// DEAD CIRCUIT: WARZONE - main game.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildSector, THEMES, mat } from './world.js';
import { FX } from './fx.js';
import { makeDrone, makeRobot, makeTurret, makeReticle } from './entities.js';
import { Audio } from './audio.js';
import { setAniso } from './textures.js';

// ---------------- config ----------------
const ALT = 11, DRONE_R = 1.5, LOCK_RANGE = 55, FIRE_CD = 0.34, BOLT_SPEED = 80;
const SHOCK_R = 17, SHOCK_CLEAR_R = 26, SHOCK_CD = 7;
const SPEED = 15, BOOST_SPEED = 31, BOOST_DRAIN = 48, BOOST_REGEN = 26;
const SECTORS = [
  { lots: 6, robots: 6, houses: 4, wrecks: 3, brutes: [5] },
  { lots: 7, robots: 8, houses: 6, wrecks: 4, brutes: [3, 7] },
  { lots: 8, robots: 10, houses: 6, wrecks: 5, brutes: [2, 6, 9] },
];
const DIFFS = {
  recruit: { dmg: 0.6, rate: 0.7, spd: 0.9, score: 0.75, label: 'Recruit' },
  veteran: { dmg: 1, rate: 1, spd: 1, score: 1, label: 'Veteran' },
  elite: { dmg: 1.4, rate: 1.3, spd: 1.15, score: 1.5, label: 'Elite' },
};
const QUALITY = {
  high: { shadows: true, bloom: true, pr: Math.min(window.devicePixelRatio || 1, 2), particles: 3200, label: 'High' },
  low: { shadows: false, bloom: false, pr: 1, particles: 3200, label: 'Low' },
};
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (id) => document.getElementById(id);

// ---------------- renderer ----------------
let qualityKey = localStorage.getItem('dcw_quality') || 'high';
let Q = QUALITY[qualityKey];
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pr);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = Q.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.5, 900);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.4, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 3); scene.add(sun); scene.add(sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
const sunDir = new THREE.Vector3();

// sky dome
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; varying vec3 vP;
    void main(){ float h = clamp(vP.y, -0.2, 1.0); vec3 c = mix(hor, top, pow(max(h,0.0), 0.55));
      float s = max(dot(normalize(vP), normalize(sunDir)), 0.0); c += sunCol * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.35);
      gl_FragColor = vec4(c, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat); sky.renderOrder = -1; scene.add(sky);
const pmrem = new THREE.PMREMGenerator(renderer);

const fx = new FX(scene, Q);
const audio = new Audio();

// ---------------- drone ----------------
const drone = makeDrone(); scene.add(drone.group);
const D = { x: 0, y: ALT, z: 8, vx: 0, vz: 0, boost: 100, boostLock: false, boostIdle: 0, fireCD: 0, shockCD: 0, muzzle: 0, flashT: 0, dead: false, deadT: 0, fallV: 0 };
const reticle = makeReticle(); scene.add(reticle.group); reticle.group.visible = false;

// projectile pools
const boltGeo = new THREE.SphereGeometry(0.36, 12, 8);
const bigBoltGeo = new THREE.SphereGeometry(0.55, 14, 10);
const boltMat = new THREE.MeshBasicMaterial({ toneMapped: false }); boltMat.color.setRGB(0.7, 2.6, 0.9);
const markerMat = new THREE.MeshBasicMaterial({ color: 0x56ff6e, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false });
const markerGeo = new THREE.RingGeometry(0.35, 0.6, 16).rotateX(-Math.PI / 2);
const tracerGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6).rotateX(Math.PI / 2);
const tracerMat = new THREE.MeshBasicMaterial({ toneMapped: false }); tracerMat.color.setRGB(4, 2.4, 0.7);
const enemyBolts = [], playerBolts = [];
const glowDiscGeo = new THREE.CircleGeometry(1.6, 24).rotateX(-Math.PI / 2).translate(0, 0.09, 0);
const glowDiscMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 8, 32, 32, 32); g.addColorStop(0, 'rgba(90,255,120,0.0)'); g.addColorStop(0.7, 'rgba(90,255,120,0.55)'); g.addColorStop(1, 'rgba(90,255,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; })()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

// ---------------- state ----------------
const G = {
  state: 'title', diff: localStorage.getItem('dcw_diff') || 'veteran', sector: 0, score: 0, hull: 100, kills: 0,
  robots: 0, houses: 0, mult: 1, chainT: 0, time: 0, shots: 0, hits: 0, taken: 0, timers: [], world: null, targets: [],
  lock: null, manual: false, clearing: false, firing: false, burners: [], keys: {}, scrap: [],
};
if (!DIFFS[G.diff]) G.diff = 'veteran';
const bestKey = () => 'dcw_best_' + G.diff;
const getBest = () => +(localStorage.getItem(bestKey()) || 0);

// ---------------- world/sector ----------------
function disposeWorld() {
  if (!G.world) return;
  G.world.group.traverse(o => { if (o.isMesh && o.userData.own) o.geometry.dispose(); if (o.isMesh && o.userData.ownMat) o.material.dispose(); });
  scene.remove(G.world.group);
  for (const t of G.targets) if (t.type === 'robot' && t.model) scene.remove(t.model.group);
  G.world = null; G.targets = [];
}

function applyTheme(th) {
  scene.fog = new THREE.FogExp2(th.fog, th.density);
  hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); hemi.intensity = th.hemi[2];
  sun.color.setHex(th.sun[0]); sun.intensity = th.sun[1];
  sunDir.set(...th.sunDir).normalize();
  skyMat.uniforms.top.value.setHex(th.sky[0]); skyMat.uniforms.hor.value.setHex(th.fog); skyMat.uniforms.sunDir.value.copy(sunDir); skyMat.uniforms.sunCol.value.setHex(th.sun[0]);
  // environment reflections from the sky
  const envScene = new THREE.Scene(); const s2 = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat.clone()); envScene.add(s2);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: th.hemi[1] })); ground.position.y = -1; envScene.add(ground);
  if (scene.environment) scene.environment.dispose();
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.55;
  s2.geometry.dispose(); s2.material.dispose();
}

function startSector(i) {
  disposeWorld(); fx.clear(); clearBolts(); G.burners = [];
  const cfg = SECTORS[i];
  const w = buildSector(scene, i, cfg, Q);
  G.world = w; G.sector = i; G.clearing = false; G.lock = null; G.manual = false;
  applyTheme(w.theme);
  // robots
  w.robotSpots.forEach((sp, k) => {
    const kind = cfg.brutes.includes(k) ? 'brute' : 'walker';
    const m = makeRobot(kind); m.group.position.set(sp.x, 0, sp.z); scene.add(m.group);
    const gl = new THREE.Mesh(glowDiscGeo, glowDiscMat); gl.scale.setScalar(m.scale); gl.renderOrder = 2; m.group.add(gl);
    G.targets.push({ type: 'robot', kind, hp: 3, maxHp: 3, x: sp.x, z: sp.z, yaw: rnd(-1, 1), model: m, alive: true, active: false,
      fireT: rnd(0.8, 2.2), chargeT: 0, stun: 0, phase: rnd(0, 6), strafe: rnd(0, 6), flashT: 0, radius: 1.2 * m.scale, aimY: 2.1 * m.scale, topY: m.height,
      name: kind === 'brute' ? 'Brute unit' : 'Walker unit', twitch: 0 });
  });
  // strongholds
  const nums = [12, 18, 24, 31, 37, 45, 52, 58];
  w.strongholds.forEach((sh, k) => {
    const mats = [];
    sh.group.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.userData.ownMat = true; mats.push({ m: o.material, c0: o.material.color.clone() }); } });
    const tur = makeTurret(); tur.group.position.set(0, sh.plan.turretY - 0.35, 0); sh.group.add(tur.group);
    G.targets.push({ type: 'house', hp: 6, maxHp: 6, x: sh.x, z: sh.z, model: sh.group, turret: tur, plan: sh.plan, alive: true, active: false,
      fireT: rnd(2, 4), chargeT: 0, radius: 6.5, aimY: 3.5, topY: sh.plan.H, mats, flashT: 0, side: sh.side, collapse: -1,
      name: `${nums[k % nums.length] + i * 100} ${w.theme.name}` });
  });
  D.x = 0; D.z = 8; D.vx = D.vz = 0; D.y = ALT;
  cam.pos.set(0, ALT + 17, D.z + 18); cam.look.set(0, 2, D.z - 16);
  showBanner(`SECTOR 0${i + 1}`, w.theme.name.toUpperCase(), `${w.theme.time} - ${cfg.robots} robots - ${cfg.houses} strongholds`, 3.2);
  updateHud(true);
}

function clearBolts() {
  for (const b of enemyBolts) { scene.remove(b.mesh); scene.remove(b.marker); } enemyBolts.length = 0;
  for (const b of playerBolts) scene.remove(b.mesh); playerBolts.length = 0;
}

// ---------------- game flow ----------------
function newGame() {
  audio.init(); audio.startMusic();
  Object.assign(G, { score: 0, hull: 100, kills: 0, robots: 0, houses: 0, mult: 1, chainT: 0, time: 0, shots: 0, hits: 0, taken: 0, timers: [] });
  Object.assign(D, { boost: 100, fireCD: 0, shockCD: 0, dead: false, deadT: 0, flashT: 0 });
  drone.group.visible = true; drone.group.rotation.set(0, 0, 0);
  startSector(0);
  setState('play');
}
function setState(s) {
  G.state = s;
  $('title').classList.toggle('hidden', s !== 'title');
  $('pause').classList.toggle('hidden', s !== 'paused');
  $('end').classList.toggle('hidden', s !== 'won' && s !== 'lost');
  $('hud').classList.toggle('hidden', s === 'title');
  $('app').classList.toggle('playing', s === 'play');
  if (s === 'paused' || s === 'title') audio.setHum(false);
  if (s === 'paused') audio.stopMusic(); else if (s === 'play') audio.startMusic();
}
function pauseToggle() {
  if (G.state === 'play') { setState('paused'); audio.play('click'); }
  else if (G.state === 'paused') { setState('play'); audio.play('click'); }
}
function after(t, fn) { G.timers.push({ t, fn }); }

function sectorCleared() {
  G.clearing = true; G.lock = null;
  heal(15, 'SECTOR BONUS');
  const bonus = Math.round((1500 + G.hull * 10) * DIFFS[G.diff].score);
  G.score += bonus;
  audio.play('clear');
  const last = G.sector === SECTORS.length - 1;
  showBanner(`SECTOR 0${G.sector + 1} CLEARED`, last ? 'DISTRICT LIBERATED' : 'ALL TARGETS DOWN', `+${bonus.toLocaleString()} pts - +15 hull`, 3.4);
  after(3.6, () => { if (last) missionWon(); else { fadeOut(() => startSector(G.sector + 1)); } });
}
function fadeOut(fn) {
  const l = $('loading'); l.classList.remove('hidden'); l.style.opacity = '0.0'; l.style.transition = 'opacity .35s';
  requestAnimationFrame(() => { l.style.opacity = '1'; });
  setTimeout(() => { fn(); renderFrame(0); setTimeout(() => { l.style.opacity = '0'; setTimeout(() => l.classList.add('hidden'), 360); }, 60); }, 380);
}
function missionWon() {
  const tb = Math.round(Math.max(0, 600 - G.time) * 6 * DIFFS[G.diff].score);
  G.score += Math.round(5000 * DIFFS[G.diff].score) + tb;
  audio.play('win'); endScreen(true, tb);
}
function missionFailed() { audio.play('fail'); endScreen(false, 0); }
function endScreen(won, tb) {
  const best = getBest(), nb = G.score > best;
  if (nb) localStorage.setItem(bestKey(), String(G.score));
  setState(won ? 'won' : 'lost');
  const card = document.querySelector('#end .card'); card.classList.toggle('fail', !won);
  $('endEyebrow').innerHTML = `<i></i>${won ? 'Mission report' : 'Signal lost'} - ${DIFFS[G.diff].label}`;
  $('endTitle').textContent = won ? 'District liberated' : 'Drone down';
  $('endText').textContent = won ? 'No surviving machines. No standing strongholds. The street is quiet again.' : `Your drone went down in Sector 0${G.sector + 1}, ${G.world.theme.name}. The machines still hold the district.`;
  const acc = G.shots ? Math.round(100 * G.hits / G.shots) : 0;
  const mm = Math.floor(G.time / 60), ss = String(Math.floor(G.time % 60)).padStart(2, '0');
  $('endStats').innerHTML = `<div class="wideStat">Final score<b>${G.score.toLocaleString()}</b></div>
    <div>Robots<b>${G.robots} / 24</b></div><div>Strongholds<b>${G.houses} / 16</b></div>
    <div>Accuracy<b>${acc}%</b></div><div>Mission time<b>${mm}:${ss}</b></div>
    <div>Hull lost<b>${Math.round(G.taken)}</b></div><div>${won ? 'Time bonus' : 'Personal best'}<b>${won ? tb.toLocaleString() : Math.max(best, G.score).toLocaleString()}</b></div>`;
  $('endBest').classList.toggle('hidden', !nb);
  $('best').textContent = Math.max(best, G.score).toLocaleString();
}

// ---------------- combat ----------------
function heal(n, why) {
  const before = G.hull; G.hull = Math.min(100, G.hull + n);
  popup(`+${n} HULL${why ? ' - ' + why : ''}`, D.x, D.y + 2.5, D.z, 'heal');
  if (G.hull > before) audio.play('heal');
}
function damageDrone(dmg) {
  if (D.dead || G.clearing) return;
  dmg *= DIFFS[G.diff].dmg;
  G.hull -= dmg; G.taken += dmg; G.mult = 1; G.chainT = 0;
  D.flashT = 0.25; fx.shake = Math.min(1.4, fx.shake + 0.5);
  fx.sparks(D.x, D.y, D.z, 26, [1, 0.6, 0.2], 10);
  fx.add.emit({ x: D.x, y: D.y, z: D.z, life: 0.2, s0: 6, s1: 9, r: 1, g: 2.5, b: 1, a: 0.8 });
  hurtFlash(); audio.play('hurt');
  if (G.hull <= 0) { G.hull = 0; droneDestroyed(); }
}
let hurtT = 0;
function hurtFlash() { hurtT = 0.35; }
function droneDestroyed() {
  D.dead = true; D.deadT = 0; D.fallV = 0;
  fx.explosion(D.x, D.y, D.z, 1.3, ['#333', '#555', '#d99a4a']); audio.play('bigboom');
  after(2.4, () => missionFailed());
}

function targetPoint(t) {
  if (t.type === 'robot') return new THREE.Vector3(t.x, t.aimY, t.z);
  return new THREE.Vector3(t.x + rnd(-2.5, 2.5) - t.side * 2, rnd(1.6, 5.5), t.z + rnd(-3, 3));
}
function fire() {
  D.fireCD = FIRE_CD; G.shots++;
  const mz = drone.muzzles[D.muzzle ^= 1]; const p = new THREE.Vector3(); mz.getWorldPosition(p);
  let vel, tgt = G.lock, tp = null;
  if (tgt) { tp = targetPoint(tgt); vel = tp.clone().sub(p).normalize().multiplyScalar(BOLT_SPEED); }
  else vel = new THREE.Vector3(0, -0.45, -1).normalize().multiplyScalar(BOLT_SPEED);
  const mesh = new THREE.Mesh(tracerGeo, tracerMat); mesh.position.copy(p); scene.add(mesh);
  playerBolts.push({ p, v: vel, tgt, tp, life: 1.6, mesh });
  drone.flash.visible = true; drone.flash.position.copy(mz.position); D.muzzleT = 0.05;
  fx.add.emit({ x: p.x, y: p.y, z: p.z, life: 0.08, s0: 1.6, s1: 0.4, r: 3, g: 1.8, b: 0.6 });
  audio.play('shoot');
}
function hitTarget(t, dmg, p, viaShock) {
  if (!t.alive) return;
  t.hp -= dmg; t.flashT = 0.12;
  if (t.type === 'robot') {
    fx.sparks(p.x, p.y, p.z, 16, [1, 0.8, 0.4], 12); audio.play('hit');
    fx.spawnDebris(p.x, p.y, p.z, 2, ['#5f6458', '#3a3d38'], 6, 0.15);
  } else {
    fx.sparks(p.x, p.y, p.z, 12, [1, 0.7, 0.3], 9);
    fx.smokePuff(p.x, p.y, p.z, 1.8, 0.45, 1.6, 1.5);
    fx.spawnDebris(p.x, p.y, p.z, 4, ['#d8d0bc', '#8a6a4a', '#555'], 7, 0.25);
    audio.play('houseHit');
    // char materials
    const k = clamp(1 - t.hp / t.maxHp, 0, 1) * 0.72;
    const char = new THREE.Color(0x24201c);
    for (const { m, c0 } of t.mats) m.color.copy(c0).lerp(char, k);
  }
  if (t.hp <= 0) killTarget(t, viaShock);
}
function killTarget(t, viaShock) {
  t.alive = false;
  if (G.lock === t) { G.lock = null; G.manual = false; }
  G.chainT > 0 ? (G.mult = Math.min(5, G.mult + 1)) : (G.mult = 1);
  G.chainT = 4;
  const base = t.type === 'house' ? 500 : t.kind === 'brute' ? 350 : 250;
  const pts = Math.round((base + (viaShock ? 150 : 0)) * G.mult * DIFFS[G.diff].score);
  G.score += pts; G.kills++;
  popup(`+${pts}${G.mult > 1 ? '  x' + G.mult : ''}`, t.x, t.topY + 1, t.z, t.type === 'house' ? 'big' : '');
  if (t.type === 'robot') {
    G.robots++;
    const m = t.model;
    fx.explosion(t.x, 1.5 * m.scale, t.z, 0.85 * m.scale, ['#5f6458', '#3a3d38', '#6f4a2a']);
    // limbs fly
    fx.spawnDebris(t.x, 2, t.z, 6, ['#4c5148', '#2a2d2a'], 11, 0.45);
    audio.play('boom', 0.8);
    scene.remove(m.group);
    leaveScrap(t.x, t.z, m.scale);
  } else {
    G.houses++;
    collapseHouse(t);
  }
  if (G.kills % 4 === 0) heal(8, 'KILL STREAK');
  if (!G.clearing && G.targets.every(o => !o.alive)) after(1.2, sectorCleared);
}
function leaveScrap(x, z, s) {
  const grp = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(box, mat(i % 2 ? 'burnt' : 'rust')); m.position.set(x + rnd(-1, 1) * s, 0.15, z + rnd(-1, 1) * s); m.scale.set(rnd(0.3, 0.9) * s, rnd(0.15, 0.4), rnd(0.3, 0.8) * s); m.rotation.y = rnd(0, 6); m.castShadow = true; grp.add(m); }
  G.world.group.add(grp);
  G.burners.push({ x, z, y: 0.5, rate: 0.12, fire: 0.3, t: 0, s: 0.6, life: 12 });
}
function collapseHouse(t) {
  const g = t.model;
  fx.explosion(t.x, 3, t.z, 2.2, ['#d8d0bc', '#6b5a48', '#3c3a36', '#8a6a4a']);
  audio.play('bigboom');
  for (let k = 0; k < 3; k++) after(0.25 + k * 0.3, () => { fx.explosion(t.x + rnd(-4, 4), rnd(2, 6), t.z + rnd(-4, 4), 1.1, ['#d8d0bc', '#555']); audio.play('boom', 0.7); });
  t.collapse = 0; t.tilt = rnd(-0.12, 0.12);
  after(1.3, () => {
    g.visible = false;
    // rubble
    const grp = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const keys = ['burnt', 'burnt', 'brick', 'rust', 'concrete'];
    for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(box, mat(keys[i % keys.length])); const r = Math.sqrt(Math.random()) * 5; const a = rnd(0, 6.28); m.position.set(t.x + Math.cos(a) * r, rnd(0.2, 1.6) * (1 - r / 7), t.z + Math.sin(a) * r); m.scale.set(rnd(0.6, 2.4), rnd(0.3, 1), rnd(0.6, 2)); m.rotation.set(rnd(-0.4, 0.4), rnd(0, 6), rnd(-0.4, 0.4)); m.castShadow = m.receiveShadow = true; grp.add(m); }
    // a few standing charred beams
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(box, mat('burnt')); m.position.set(t.x + rnd(-4, 4), 1.5, t.z + rnd(-3, 3)); m.scale.set(0.3, rnd(2, 4), 0.3); m.rotation.set(rnd(-0.5, 0.5), 0, rnd(-0.5, 0.5)); m.castShadow = true; grp.add(m); }
    G.world.group.add(grp);
    fx.decal(t.x, t.z, 15);
    G.burners.push({ x: t.x, z: t.z, y: 1.2, rate: 0.5, fire: 0.6, t: 0, s: 1.5, spread: 4, life: 999 });
  });
}
function shockwave() {
  if (D.shockCD > 0 || D.dead) return;
  D.shockCD = SHOCK_CD;
  fx.ring(D.x, 0.4, D.z, SHOCK_R, 0.7, 0xffc070); fx.ring(D.x, D.y, D.z, SHOCK_R * 0.8, 0.5, 0x9fffb0);
  fx.flash(D.x, D.y, D.z, 0xffd090, 300, 0.4, 40);
  fx.shake = Math.min(1.4, fx.shake + 0.8);
  for (let k = 0; k < 48; k++) { const a = k / 48 * 6.283; fx.smokePuff(D.x + Math.cos(a) * 3, 0.5, D.z + Math.sin(a) * 3, 2.2, 0.55, 1.6, 0.5); fx.smoke.emit({ x: D.x, y: 0.6, z: D.z, vx: Math.cos(a) * 26, vz: Math.sin(a) * 26, vy: 1, life: 0.9, s0: 2, s1: 5, r: 0.6, g: 0.55, b: 0.5, a: 0.6, drag: 3 }); }
  for (let k = 0; k < 60; k++) { const a = rnd(0, 6.28); fx.add.emit({ x: D.x, y: D.y, z: D.z, vx: Math.cos(a) * 30, vy: rnd(-8, 4), vz: Math.sin(a) * 30, life: 0.5, s0: 1, s1: 0.2, r: 2.5, g: 2, b: 1, drag: 2 }); }
  audio.play('shock');
  for (let i = enemyBolts.length - 1; i >= 0; i--) {
    const b = enemyBolts[i];
    if (Math.hypot(b.p.x - D.x, b.p.y - D.y, b.p.z - D.z) < SHOCK_CLEAR_R) { fx.sparks(b.p.x, b.p.y, b.p.z, 8, [0.4, 1, 0.5], 6); removeEnemyBolt(i); }
  }
  for (const t of G.targets) {
    if (!t.alive) continue;
    const d = Math.hypot(t.x - D.x, t.z - D.z) - (t.type === 'house' ? 4 : 0);
    if (d < SHOCK_R) {
      hitTarget(t, 1, new THREE.Vector3(t.x, t.aimY, t.z), true);
      if (t.alive) { t.stun = 1.6; t.chargeT = 0; if (t.type === 'robot') { const k = 4 / Math.max(1, d); t.x += (t.x - D.x) * k; t.z += (t.z - D.z) * k; } }
    }
  }
}
function spawnEnemyBolt(from, aimAt, speed, dmg, big) {
  const v = aimAt.clone().sub(from).normalize().multiplyScalar(speed * DIFFS[G.diff].spd);
  const mesh = new THREE.Mesh(big ? bigBoltGeo : boltGeo, boltMat); mesh.position.copy(from); scene.add(mesh);
  const marker = new THREE.Mesh(markerGeo, markerMat); marker.scale.setScalar(big ? 1.5 : 1); scene.add(marker);
  enemyBolts.push({ p: from.clone(), v, dmg, big, life: 4.5, mesh, marker, r: big ? 0.55 : 0.36 });
  fx.add.emit({ x: from.x, y: from.y, z: from.z, life: 0.15, s0: 3, s1: 1, r: 0.8, g: 3, b: 1 });
  audio.play('enemyShot');
}
function removeEnemyBolt(i) { const b = enemyBolts[i]; scene.remove(b.mesh); scene.remove(b.marker); enemyBolts.splice(i, 1); }
function leadAim(from, speed) {
  const dist = Math.hypot(D.x - from.x, D.y - from.y, D.z - from.z);
  const tf = dist / (speed * DIFFS[G.diff].spd) * 0.8;
  return new THREE.Vector3(D.x + D.vx * tf, D.y, D.z + D.vz * tf);
}

// ---------------- target lock ----------------
function inRange(t) { return t.alive && Math.hypot(t.x - D.x, t.z - D.z) < LOCK_RANGE; }
function updateLock() {
  if (G.lock && (!G.lock.alive || Math.hypot(G.lock.x - D.x, G.lock.z - D.z) > LOCK_RANGE * 1.15)) { G.lock = null; G.manual = false; }
  if (G.manual && G.lock) return;
  let best = null, bd = 1e9;
  for (const t of G.targets) { if (!t.alive) continue; const d = Math.hypot(t.x - D.x, t.z - D.z) - (t.type === 'house' ? 3 : 0); if (d < LOCK_RANGE && d < bd) { bd = d; best = t; } }
  if (best !== G.lock) { G.lock = best; if (best && G.state === 'play') audio.play('lock'); }
}
function cycleTarget() {
  const c = G.targets.filter(inRange).sort((a, b) => Math.hypot(a.x - D.x, a.z - D.z) - Math.hypot(b.x - D.x, b.z - D.z));
  if (!c.length) return;
  const i = c.indexOf(G.lock); G.lock = c[(i + 1) % c.length]; G.manual = true; audio.play('lock');
}

// ---------------- simulation step ----------------
const tmpV = new THREE.Vector3();
function step(dt) {
  G.time += dt;
  for (let i = G.timers.length - 1; i >= 0; i--) { const t = G.timers[i]; t.t -= dt; if (t.t <= 0) { G.timers.splice(i, 1); t.fn(); } }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.add('hidden'); }
  G.chainT = Math.max(0, G.chainT - dt); if (G.chainT === 0 && G.mult > 1) G.mult = 1;
  const L = G.world.length;
  // --- drone
  if (!D.dead) {
    const k = G.keys;
    let ix = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    let iz = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    const il = Math.hypot(ix, iz); if (il > 0) { ix /= il; iz /= il; }
    const wantBoost = (k.ShiftLeft || k.ShiftRight) && il > 0;
    let boosting = false;
    if (wantBoost && !D.boostLock && D.boost > 0) { boosting = true; D.boost -= BOOST_DRAIN * dt; D.boostIdle = 0; if (D.boost <= 0) { D.boost = 0; D.boostLock = true; } }
    else { D.boostIdle += dt; if (D.boostIdle > 0.5) D.boost = Math.min(100, D.boost + BOOST_REGEN * dt); if (D.boost > 25) D.boostLock = false; }
    D.boosting = boosting;
    const sp = boosting ? BOOST_SPEED : SPEED;
    const a = Math.min(1, dt * (boosting ? 8 : 5));
    D.vx += (ix * sp - D.vx) * a; D.vz += (iz * sp - D.vz) * a;
    D.x = clamp(D.x + D.vx * dt, -32, 32); D.z = clamp(D.z + D.vz * dt, -L - 4, 16);
    D.y = ALT + Math.sin(G.time * 2.1) * 0.22;
    if (boosting) for (let j = 0; j < 2; j++) fx.add.emit({ x: D.x + rnd(-1, 1), y: D.y, z: D.z + 1.2, vx: -D.vx * 0.2, vz: -D.vz * 0.2, life: 0.35, s0: 1.2, s1: 0.1, r: 0.6, g: 1.6, b: 1, a: 0.6 });
    // weapons
    D.fireCD -= dt; D.shockCD = Math.max(0, D.shockCD - dt);
    updateLock();
    if (G.firing && D.fireCD <= 0 && !G.clearing) fire();
  } else {
    D.deadT += dt; D.fallV += 18 * dt; D.y = Math.max(0.6, D.y - D.fallV * dt);
    if (Math.random() < 0.6) fx.smokePuff(D.x, D.y, D.z, 1.5, 0.15, 1.5, 1);
    if (Math.random() < 0.4) fx.fire(D.x, D.y, D.z, 0.7);
    if (D.y <= 0.6 && !D.landed) { D.landed = true; fx.explosion(D.x, 0.6, D.z, 1, ['#333', '#555']); audio.play('boom'); drone.group.visible = false; }
  }
  if (D.muzzleT > 0) { D.muzzleT -= dt; if (D.muzzleT <= 0) drone.flash.visible = false; }
  // --- player bolts
  for (let i = playerBolts.length - 1; i >= 0; i--) {
    const b = playerBolts[i]; b.life -= dt;
    if (b.tgt && b.tgt.alive) { tmpV.copy(b.tp).sub(b.p); const d = tmpV.length(); tmpV.multiplyScalar(BOLT_SPEED / Math.max(0.001, d)); b.v.lerp(tmpV, Math.min(1, dt * 14));
      if (d < BOLT_SPEED * dt + 0.6) { G.hits++; hitTarget(b.tgt, 1, b.tp, false); scene.remove(b.mesh); playerBolts.splice(i, 1); continue; } }
    b.p.addScaledVector(b.v, dt);
    if (b.p.y < 0.1) { fx.sparks(b.p.x, 0.2, b.p.z, 6, [1, 0.7, 0.3], 6); fx.smokePuff(b.p.x, 0.3, b.p.z, 0.8, 0.5, 0.8, 1); b.life = 0; }
    if (b.life <= 0) { scene.remove(b.mesh); playerBolts.splice(i, 1); continue; }
    b.mesh.position.copy(b.p); b.mesh.lookAt(tmpV.copy(b.p).add(b.v));
    if (Math.random() < 0.5) fx.add.emit({ x: b.p.x, y: b.p.y, z: b.p.z, life: 0.12, s0: 0.7, s1: 0.1, r: 2, g: 1.1, b: 0.3, a: 0.7 });
  }
  // --- enemy bolts
  for (let i = enemyBolts.length - 1; i >= 0; i--) {
    const b = enemyBolts[i]; b.life -= dt; b.p.addScaledVector(b.v, dt);
    b.mesh.position.copy(b.p); b.mesh.scale.setScalar(1 + Math.sin(G.time * 30 + i) * 0.12);
    b.marker.position.set(b.p.x, 0.08, b.p.z); b.marker.material.opacity = 0.45;
    if (Math.random() < 0.6) fx.add.emit({ x: b.p.x, y: b.p.y, z: b.p.z, life: 0.3, s0: b.big ? 1.3 : 0.9, s1: 0.1, r: 0.25, g: 1.2, b: 0.35, a: 0.6 });
    if (!D.dead && Math.hypot(b.p.x - D.x, b.p.y - D.y, b.p.z - D.z) < DRONE_R + b.r) { damageDrone(b.dmg); removeEnemyBolt(i); continue; }
    if (b.p.y < 0.2 || b.life <= 0) { if (b.p.y < 0.2) { fx.sparks(b.p.x, 0.3, b.p.z, 10, [0.4, 1, 0.5], 7); fx.smokePuff(b.p.x, 0.3, b.p.z, 1, 0.4, 1, 1); } removeEnemyBolt(i); }
  }
  // --- enemies
  const rate = DIFFS[G.diff].rate;
  const canFire = !D.dead && !G.clearing && G.state === 'play';
  for (const t of G.targets) {
    if (!t.alive) { if (t.type === 'house' && t.collapse >= 0 && t.collapse < 1.3) houseCollapseAnim(t, dt); continue; }
    const dx = D.x - t.x, dz = D.z - t.z, dist = Math.hypot(dx, dz);
    if (!t.active && dist < (t.type === 'house' ? 64 : 80)) t.active = true;
    t.flashT = Math.max(0, t.flashT - dt);
    if (t.type === 'robot') stepRobot(t, dt, dx, dz, dist, rate, canFire); else stepHouse(t, dt, dx, dz, dist, rate, canFire);
  }
  // --- burners (burning ruins / scrap)
  for (const b of G.burners) {
    b.t += dt; if (b.life < 900) b.life -= dt;
    const s = b.spread || 0.5;
    if (b.life > 0 && Math.random() < b.rate) fx.smokePuff(b.x + rnd(-s, s), b.y + 1, b.z + rnd(-s, s), b.s * 1.6, 0.18, 3.5, 2.2);
    if (b.life > 0 && Math.random() < b.fire) fx.fire(b.x + rnd(-s, s), b.y, b.z + rnd(-s, s), b.s * 0.8);
  }
  fx.update(dt);
}

function stepRobot(t, dt, dx, dz, dist, rate, canFire) {
  const m = t.model; let moving = 0;
  if (t.stun > 0) { t.stun -= dt; if (Math.random() < 0.3) { const p = m.head.getWorldPosition(tmpV); fx.sparks(p.x, p.y, p.z, 2, [0.6, 0.9, 1], 5); } }
  if (t.active && t.stun <= 0) {
    t.strafe += dt * 0.6;
    const want = t.kind === 'brute' ? 16 : 20;
    let mx = 0, mz = 0;
    if (dist > want + 4) { mx = dx / dist; mz = dz / dist; } else if (dist < want - 7) { mx = -dx / dist; mz = -dz / dist; }
    mx += Math.cos(t.strafe) * 0.5;
    // separation
    for (const o of G.targets) { if (o === t || !o.alive || o.type !== 'robot') continue; const ox = t.x - o.x, oz = t.z - o.z, od = Math.hypot(ox, oz); if (od < 3 && od > 0.01) { mx += ox / od; mz += oz / od; } }
    const ml = Math.hypot(mx, mz); const sp = (t.kind === 'brute' ? 1.7 : 2.7) * (t.chargeT > 0 ? 0.3 : 1);
    if (ml > 0.05) { t.x += mx / ml * sp * dt; t.z += mz / ml * sp * dt; moving = 1; }
    t.x = clamp(t.x, -18, 18); t.z = clamp(t.z, -G.world.length - 2, 10);
    // face drone
    const yaw = Math.atan2(-dx, -dz); let dy = yaw - t.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; t.yaw += dy * Math.min(1, dt * 4);
    // weapons
    if (canFire) {
      if (t.chargeT > 0) {
        t.chargeT -= dt; const k = 1 - t.chargeT / 0.6;
        m.tip.scale.setScalar(1 + k * 1.8); m.tipMat.color.setRGB(0.4 + k * 1.2, 1.6 + k * 4, 0.5 + k * 1.5);
        if (m.tip2) m.tip2.scale.setScalar(1 + k * 1.8);
        if (Math.random() < 0.5) { const p = m.tip.getWorldPosition(tmpV); fx.add.emit({ x: p.x + rnd(-0.6, 0.6), y: p.y + rnd(-0.6, 0.6), z: p.z + rnd(-0.6, 0.6), vx: 0, life: 0.2, s0: 0.5, s1: 0.1, r: 0.5, g: 2.5, b: 0.7 }); }
        if (t.chargeT <= 0) {
          m.tip.scale.setScalar(1); m.tipMat.color.setRGB(0.4, 1.6, 0.5); if (m.tip2) m.tip2.scale.setScalar(1);
          const from = m.tip.getWorldPosition(new THREE.Vector3());
          if (t.kind === 'brute') {
            const aim = leadAim(from, 17); const base = aim.clone().sub(from);
            for (const ang of [-0.2, 0, 0.2]) { const v = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang); spawnEnemyBolt(from, from.clone().add(v), 17, 9, true); }
          } else spawnEnemyBolt(from, leadAim(from, 24), 24, 8, false);
          t.fireT = (t.kind === 'brute' ? rnd(3.0, 4.2) : rnd(1.7, 2.9));
        }
      } else if (dist < 58) {
        t.fireT -= dt * rate;
        if (t.fireT <= 0) { t.chargeT = 0.6; audio.play('charge'); }
      }
    }
  }
  // animation
  t.phase += dt * (moving ? (t.kind === 'brute' ? 4.5 : 6) : 1.2);
  const ph = t.phase, amp = moving ? 0.55 : 0.05;
  m.legs[0].thigh.rotation.x = Math.sin(ph) * amp; m.legs[1].thigh.rotation.x = -Math.sin(ph) * amp * 0.6; // limp
  m.legs[0].shin.rotation.x = Math.max(0, -Math.sin(ph)) * amp * 1.3; m.legs[1].shin.rotation.x = Math.max(0, Math.sin(ph)) * amp * 0.9;
  m.hips.position.y = 1.5 + Math.abs(Math.sin(ph)) * 0.08 * (moving ? 1 : 0.2);
  m.hips.rotation.z = Math.sin(ph) * (moving ? 0.07 : 0.02);
  t.twitch -= dt; if (t.twitch < 0) { t.twitch = rnd(0.8, 3); m.head.rotation.y = rnd(-0.5, 0.5); m.head.rotation.z = rnd(-0.3, 0.3); }
  m.armL.rotation.x = Math.sin(ph + 1) * 0.25;
  // aim gun arm at drone
  const pitch = Math.atan2(D.y - 3, Math.max(4, dist));
  m.armR.rotation.x = -1.35 - pitch * 0.9 - t.model.torso.rotation.x;
  m.group.position.set(t.x, 0, t.z); m.group.rotation.y = t.yaw;
  const f = t.flashT > 0 ? t.flashT / 0.12 : 0;
  for (const mm of m.mats) mm.emissive.setRGB(f * 1.2, f * 1.0, f * 0.7);
  const eyeK = t.chargeT > 0 ? 2 : 1; m.eyeMat.color.setRGB(0.6 * eyeK, 3.2 * eyeK, 0.9 * eyeK);
  // damaged robots smoke
  if (t.hp < t.maxHp && Math.random() < (t.hp === 1 ? 0.35 : 0.12)) fx.smokePuff(t.x, 2.6 * m.scale, t.z, 0.8, 0.2, 1.4, 1.5);
  if (t.hp === 1 && Math.random() < 0.08) fx.sparks(t.x, 2.2 * m.scale, t.z, 3, [1, 0.8, 0.4], 5);
}

function stepHouse(t, dt, dx, dz, dist, rate, canFire) {
  const tur = t.turret;
  // turret yaw in house-local space
  const localYaw = Math.atan2(-dx, -dz) - t.model.rotation.y;
  let dy = localYaw - tur.yaw.rotation.y; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283;
  if (t.active) tur.yaw.rotation.y += dy * Math.min(1, dt * 3); else tur.yaw.rotation.y += dt * 0.4;
  if (t.stun > 0) t.stun -= dt;
  if (t.active && canFire && !(t.stun > 0)) {
    if (t.chargeT > 0) {
      t.chargeT -= dt; const k = 1 - t.chargeT / 0.75;
      tur.tip.scale.setScalar(1 + k * 2); tur.tipMat.color.setRGB(0.4 + k * 1.4, 1.4 + k * 4.5, 0.5 + k * 1.5);
      if (t.chargeT <= 0) {
        tur.tip.scale.setScalar(1); tur.tipMat.color.setRGB(0.4, 1.4, 0.5);
        const from = tur.tip.getWorldPosition(new THREE.Vector3());
        spawnEnemyBolt(from, leadAim(from, 18), 18, 12, true);
        after(0.3, () => { if (t.alive && !D.dead) spawnEnemyBolt(tur.tip.getWorldPosition(new THREE.Vector3()), leadAim(from, 18), 18, 12, true); });
        t.fireT = rnd(2.6, 4);
      }
    } else if (dist < 56) { t.fireT -= dt * rate; if (t.fireT <= 0) { t.chargeT = 0.75; audio.play('charge'); } }
  }
  // damage effects
  const top = t.plan.H;
  if (t.hp <= 4 && Math.random() < (t.hp <= 2 ? 0.5 : 0.2)) fx.smokePuff(t.x + rnd(-3, 3), top, t.z + rnd(-3, 3), 2.4, t.hp <= 2 ? 0.12 : 0.35, 3.2, 2.5);
  if (t.hp <= 2 && Math.random() < 0.7) fx.fire(t.x + rnd(-3.5, 3.5) - t.side * 3, rnd(1, 4), t.z + rnd(-4, 4), 1.1);
  if (t.hp <= 3 && Math.random() < 0.03) fx.sparks(t.x - t.side * 4, rnd(1.5, 4), t.z + rnd(-3, 3), 6, [1, 0.8, 0.4], 6);
  const f = t.flashT > 0 ? t.flashT / 0.12 : 0;
  if (f > 0 || t._lastF > 0) { for (const { m } of t.mats) if (m.emissive) m.emissive.setRGB(f * 0.6, f * 0.4, f * 0.2); t._lastF = f; }
}
function houseCollapseAnim(t, dt) {
  t.collapse += dt; const k = clamp(t.collapse / 1.3, 0, 1), e = k * k;
  t.model.scale.y = 1 - e * 0.85; t.model.position.y = -e * 0.5; t.model.rotation.z = t.tilt * e;
  if (Math.random() < 0.9) fx.smokePuff(t.x + rnd(-6, 6), rnd(0.5, 3), t.z + rnd(-6, 6), 4, 0.5, 3, 1.5);
}

// ---------------- camera + visuals ----------------
const cam = { pos: new THREE.Vector3(0, 28, 26), look: new THREE.Vector3(0, 2, -10), fov: 55 };
function updateVisuals(dt, realDt) {
  // drone visuals
  drone.group.position.set(D.x, D.y, D.z);
  drone.tilt.rotation.x = D.vz * 0.02; drone.tilt.rotation.z = -D.vx * 0.022;
  if (D.dead) { drone.group.rotation.x += realDt * 3; drone.group.rotation.z += realDt * 5; }
  const spin = (D.dead ? 10 : 60) * realDt;
  drone.rotors.forEach((r, i) => r.rotation.y += (i % 2 ? spin : -spin));
  const tgt = G.lock;
  if (tgt && !D.dead) {
    const dx = tgt.x - D.x, dz = tgt.z - D.z, dy = tgt.aimY - (D.y - 0.5);
    drone.turret.rotation.y = Math.atan2(-dx, -dz); drone.pitch.rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
  } else { drone.turret.rotation.y *= 0.9; drone.pitch.rotation.x += (-0.35 - drone.pitch.rotation.x) * 0.1; }
  const fl = D.flashT > 0 ? D.flashT / 0.25 : 0; D.flashT = Math.max(0, D.flashT - realDt);
  drone.hullMat.emissive.setRGB(fl * 1.5, fl * 0.2, fl * 0.1);
  const blink = Math.sin(performance.now() * 0.006) > 0.6 ? 1 : 0.2;
  drone.navL.material.color.setRGB(4 * blink, 0.3 * blink, 0.2 * blink); drone.navR.material.color.setRGB(0.3 * blink, 4 * blink, 0.5 * blink);
  // reticle
  if (tgt && tgt.alive && G.state !== 'title') {
    reticle.group.visible = true;
    const r = tgt.type === 'house' ? 7.5 : 1.8 * tgt.model.scale;
    reticle.ring.position.set(tgt.x, 0.15, tgt.z); reticle.ring.scale.setScalar(r); reticle.ring.rotation.y += realDt * 1.5;
    reticle.chevron.position.set(tgt.x, tgt.topY + 1.6 + Math.sin(performance.now() * 0.006) * 0.3, tgt.z);
    reticle.chevron.rotation.y += realDt * 2;
    const man = G.manual; reticle.mat.color.setRGB(man ? 0.6 : 2.2, man ? 2.6 : 1.2, man ? 0.8 : 0.35);
  } else reticle.group.visible = false;
  // camera
  const ahead = 15 - Math.min(6, Math.max(-4, -D.vz * 0.25));
  const wantPos = tmpV.set(D.x * 0.72, ALT + 16.5, D.z + 17.5);
  cam.pos.lerp(wantPos, 1 - Math.exp(-realDt * 5));
  cam.look.lerp(new THREE.Vector3(D.x * 0.85, 2, D.z - ahead), 1 - Math.exp(-realDt * 5));
  const wantFov = D.boosting ? 61 : 55; cam.fov += (wantFov - cam.fov) * (1 - Math.exp(-realDt * 4));
  const sh = fx.shake * fx.shake * 0.8;
  camera.position.set(cam.pos.x + rnd(-sh, sh), cam.pos.y + rnd(-sh, sh), cam.pos.z + rnd(-sh, sh));
  camera.lookAt(cam.look);
  if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position);
  // sun follows focus for crisp shadows
  sun.target.position.set(D.x * 0.8, 0, D.z - 12);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 120);
  fx.add.mat.uniforms.scale.value = fx.smoke.mat.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  // hurt overlay
  hurtT = Math.max(0, hurtT - realDt);
  $('hurt').style.opacity = String(Math.max(hurtT / 0.35, G.state === 'play' && G.hull < 30 ? 0.25 + Math.sin(performance.now() * 0.008) * 0.15 : 0));
  // audio
  if (G.state === 'play') { audio.setHum(!D.dead, Math.hypot(D.vx, D.vz), D.boosting); if (G.hull < 30 && !D.dead) audio.play('alarm'); }
}

// ---------------- HUD ----------------
const hullSegs = $('hullSegs'); for (let i = 0; i < 20; i++) hullSegs.appendChild(document.createElement('i'));
const H = {};
function setText(id, v) { if (H[id] !== v) { H[id] = v; $(id).textContent = v; } }
function updateHud(force) {
  if (force) for (const k in H) delete H[k];
  setText('score', String(G.score).padStart(6, '0'));
  setText('best', Math.max(getBest(), 0).toLocaleString());
  setText('mult', 'x' + G.mult); $('mult').classList.toggle('hot', G.mult > 1);
  const total = G.targets.length, dead = G.targets.filter(t => !t.alive).length;
  setText('sectorName', `Sector 0${G.sector + 1} / 03`); setText('sectorCount', `${dead}/${total}`);
  $('sectorBar').style.width = (total ? dead / total * 100 : 0) + '%';
  if (G.world) setText('sectorStreet', `${G.world.theme.name} - ${G.world.theme.time}`);
  const hull = Math.ceil(G.hull); setText('hullNum', String(hull));
  if (H._hull !== hull) { H._hull = hull; const on = Math.ceil(hull / 5); [...hullSegs.children].forEach((s, i) => s.classList.toggle('on', i < on)); hullSegs.className = 'segs' + (hull < 30 ? ' crit' : hull < 55 ? ' warn' : ''); }
  $('lowHull').classList.toggle('hidden', !(hull < 30 && hull > 0 && G.state === 'play'));
  setText('robotsN', String(G.robots)); setText('housesN', String(G.houses));
  // boost
  const bb = $('boostBar'); bb.style.width = D.boost + '%'; bb.classList.toggle('low', D.boostLock);
  // shock
  const k = 1 - D.shockCD / SHOCK_CD; $('shockArc').style.strokeDashoffset = String(113.1 * (1 - k));
  setText('shockState', D.shockCD > 0 ? D.shockCD.toFixed(1) + 's' : 'READY'); $('shockState').classList.toggle('cd', D.shockCD > 0);
  // target
  const t = G.lock;
  if (t && t.alive) {
    setText('targetName', t.name); setText('targetDist', `${Math.round(Math.hypot(t.x - D.x, t.z - D.z))} m - ${t.type === 'house' ? 'stronghold' : 'hostile machine'}`);
    const key = t.hp + '/' + t.maxHp; if (H._pips !== key) { H._pips = key; $('targetPips').innerHTML = Array.from({ length: t.maxHp }, (_, i) => `<i class="${i < t.hp ? '' : 'gone'}"></i>`).join(''); }
  } else { setText('targetName', 'No target'); setText('targetDist', 'Fly closer to acquire'); if (H._pips !== '') { H._pips = ''; $('targetPips').innerHTML = ''; } }
  setText('lockMode', G.manual ? 'MANUAL' : 'AUTO'); $('lockMode').classList.toggle('man', G.manual);
}
let bannerT = 0;
function showBanner(top, main, sub, dur) { $('bannerTop').textContent = top; $('bannerMain').textContent = main; $('bannerSub').textContent = sub; const b = $('banner'); b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; bannerT = dur; }
function popup(text, x, y, z, cls = '') {
  const v = new THREE.Vector3(x, y, z).project(camera); if (v.z > 1) return;
  const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text;
  el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  $('popups').appendChild(el); setTimeout(() => el.remove(), 1000);
}

// ---------------- input ----------------
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) { G.keys[e.code] = true; return; }
  G.keys[e.code] = true;
  if (e.code === 'KeyM') toggleSound();
  if (G.state === 'title' && (e.code === 'Enter')) { newGame(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (!$('how').classList.contains('hidden')) { closeHow(); return; } pauseToggle(); return; }
  if (G.state !== 'play') return;
  if (e.code === 'Space') G.firing = true;
  if (e.code === 'KeyQ') cycleTarget();
  if (e.code === 'KeyE') shockwave();
});
addEventListener('keyup', (e) => { G.keys[e.code] = false; if (e.code === 'Space') G.firing = false; });
canvas.addEventListener('mousedown', (e) => { if (e.button === 0 && G.state === 'play') G.firing = true; });
addEventListener('mouseup', (e) => { if (e.button === 0 && !G.keys.Space) G.firing = false; });
addEventListener('blur', () => { G.keys = {}; G.firing = false; if (G.state === 'play') setState('paused'); });

// ---------------- UI wiring ----------------
function toggleSound() { audio.init(); audio.setEnabled(!audio.enabled); syncLabels(); }
function setQuality(k) {
  qualityKey = k; Q = QUALITY[k]; localStorage.setItem('dcw_quality', k);
  renderer.setPixelRatio(Q.pr); renderer.shadowMap.enabled = Q.shadows; sun.castShadow = Q.shadows;
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  resize(); syncLabels();
}
function syncLabels() {
  document.querySelectorAll('.sndLbl').forEach(e => e.textContent = audio.enabled ? 'On' : 'Off');
  document.querySelectorAll('.musLbl').forEach(e => e.textContent = audio.music ? 'On' : 'Off');
  document.querySelectorAll('.qualLbl').forEach(e => e.textContent = Q.label);
  $('btnSound').classList.toggle('off', !audio.enabled);
  document.querySelectorAll('#diffSel button').forEach(b => b.classList.toggle('on', b.dataset.d === G.diff));
  $('bestTitle').textContent = getBest().toLocaleString();
}
let howFrom = null;
function openHow(from) { howFrom = from; $('how').classList.remove('hidden'); }
function closeHow() { $('how').classList.add('hidden'); }
const on = (id, fn) => $(id).addEventListener('click', (e) => { e.currentTarget.blur(); audio.init(); audio.play('click'); fn(); });
on('btnStart', newGame);
on('btnHowTitle', () => openHow('title')); on('btnHowPause', () => openHow('pause')); on('btnHowClose', closeHow);
on('btnQualTitle', () => setQuality(qualityKey === 'high' ? 'low' : 'high')); on('btnQualPause', () => setQuality(qualityKey === 'high' ? 'low' : 'high'));
on('btnSndTitle', toggleSound); on('btnSndPause', toggleSound); on('btnSound', toggleSound);
on('btnMusPause', () => { audio.setMusic(!audio.music); syncLabels(); });
on('btnPause', pauseToggle); on('btnResume', pauseToggle);
on('btnRestart', newGame); on('btnAgain', newGame);
const toTitle = () => { clearBolts(); setState('title'); audio.stopMusic(); syncLabels(); };
on('btnQuit', toTitle); on('btnEndTitle', toTitle);
document.querySelectorAll('#diffSel button').forEach(b => b.addEventListener('click', () => { G.diff = b.dataset.d; localStorage.setItem('dcw_diff', G.diff); audio.init(); audio.play('click'); syncLabels(); }));

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setPixelRatio(Q.pr); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------------- loop ----------------
let last = performance.now(), acc = 0, titleT = 0;
const STEP = 1 / 60;
function renderFrame(realDt) {
  if (G.state === 'title') {
    // attract mode: slow drift down the street
    titleT += realDt; D.x = Math.sin(titleT * 0.25) * 5; D.z = 6 - (titleT * 2.2) % (G.world.length * 0.6); D.y = ALT + Math.sin(titleT * 2) * 0.25; D.vx = Math.cos(titleT * 0.25) * 1.2; D.vz = -2.2;
    for (const t of G.targets) if (t.type === 'robot' && t.alive) stepRobot(t, realDt, D.x - t.x, D.z - t.z, 999, 0, false);
    for (const t of G.targets) if (t.type === 'house') stepHouse(t, realDt, D.x - t.x, D.z - t.z, 999, 0, false);
    fx.update(realDt);
  }
  updateVisuals(STEP, realDt);
  if (G.state !== 'title') updateHud();
  if (Q.bloom) composer.render(); else renderer.render(scene, camera);
}
function frame(now) {
  const realDt = Math.min(0.1, (now - last) / 1000); last = now;
  if (G.state === 'play' || G.state === 'won' || G.state === 'lost') {
    if (G.state === 'play') { acc += realDt; while (acc >= STEP) { step(STEP); acc -= STEP; } }
    else { fx.update(realDt); }
  }
  renderFrame(realDt);
  requestAnimationFrame(frame);
}

// boot: build sector 0 behind the title screen
resize(); syncLabels();
startSector(0); $('banner').classList.add('hidden'); bannerT = 0;
for (const t of G.targets) if (t.type === 'robot') { t.model.group.position.set(t.x, 0, t.z); }
setState('title');
$('loading').classList.add('hidden');
if (!location.search.includes('manual')) requestAnimationFrame((t) => { last = t; frame(t); });

// test/debug hooks
window.__DC = {
  G, D, fx, newGame, startSector, step: (n = 1) => { for (let i = 0; i < n; i++) { if (G.state === 'play') step(STEP); else fx.update(STEP); updateVisuals(STEP, STEP); } }, render: () => renderFrame(STEP),
  shockwave, cycleTarget, killAll: () => G.targets.forEach(t => t.alive && killTarget(t)), setQuality, enemyBolts, scene, camera, renderer,
};
