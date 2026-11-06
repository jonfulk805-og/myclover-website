// DEAD ACRES: Night Harvest - round-based zombie survival. MyClover Arcade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as MP from './map.js';
import { buildWorld, buildSky, PERK_INFO } from './world.js';
import { GUNS, BOX_POOL, stats, buildGun, buildArms } from './guns.js';
import { makeZombie, poseZombie, hitVolumes, raySphere, rayCapsule, setEyes } from './zombie.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { bloodSplat, star4, powerIcon, tex } from './farmtex.js';
import { setAniso } from './textures.js';

const MANUAL = location.search.includes('manual');
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CS = MP.CS;

// ---------------- tuning ----------------
export const DIFFS = {
  easy: { label: 'Easy', php: 150, hp: 0.7, dmg: 38, spd: 0.9, alive: 18, pts: 1.25, tear: 1.3 },
  normal: { label: 'Normal', php: 150, hp: 1, dmg: 50, spd: 1, alive: 24, pts: 1, tear: 1 },
  hard: { label: 'Hard', php: 100, hp: 1.3, dmg: 55, spd: 1.1, alive: 28, pts: 1, tear: 0.8 },
};
const roundCount = (r) => (r <= 5 ? [6, 8, 13, 18, 24][r - 1] : Math.round(24 + (r - 5) * 4 + (r - 5) * (r - 5) * 0.3));
const roundHP = (r) => (r < 10 ? 150 + 100 * (r - 1) : 950 * Math.pow(1.1, r - 9));
const EYE = 1.62, PR = 0.36, WALK = 4.3, SPRINT = 6.6, ADSSPD = 2.6;
const QUALITY = {
  high: { shadows: true, bloom: true, pr: Math.min(window.devicePixelRatio || 1, 2), particles: 2600, label: 'High' },
  low: { shadows: false, bloom: false, pr: 1, particles: 1600, label: 'Low' },
};

// ---------------- renderer / scene ----------------
let qKey = localStorage.getItem('da_quality') || 'high'; if (!QUALITY[qKey]) qKey = 'high';
const Q = QUALITY[qKey];
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pr); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = Q.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b121c, 0.03);
const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.03, 600); camera.rotation.order = 'YXZ'; scene.add(camera);
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.5, 0.95); composer.addPass(bloom); composer.addPass(new OutputPass());
bloom.enabled = Q.bloom;

const hemi = new THREE.HemisphereLight(0x6a7eaa, 0x3a2c1e, 1.05); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9db4e8, 0.75); const moonDir = new THREE.Vector3(-0.5, 0.45, -0.75).normalize();
moon.position.copy(moonDir).multiplyScalar(80).add(new THREE.Vector3(31, 0, 35)); moon.target.position.set(31, 0, 35); scene.add(moon, moon.target);
moon.castShadow = Q.shadows; moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 220 }); moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.04;
const flash = new THREE.SpotLight(0xfff2d8, 13, 30, 0.5, 0.6, 1.2); camera.add(flash); flash.position.set(0.1, -0.1, -0.75); flash.target.position.set(0, -0.7, -8); camera.add(flash.target);
const muzzleLight = new THREE.PointLight(0xffb060, 0, 9, 1.6); scene.add(muzzleLight);
buildSky(scene);
const W = buildWorld(scene, Q);
const fx = new FX(scene, Q);
fx.decalMat.map = tex(bloodSplat(0)); fx.decalMat.opacity = 0.9; fx.decalMat.needsUpdate = true;
const audio = new Audio();

// ---------------- state ----------------
const G = { state: 'title', diff: localStorage.getItem('da_diff') || 'normal', round: 0, toSpawn: 0, spawnT: 0, breakT: 0, zs: [], points: 500, kills: 0, heads: 0, t: 0, flowT: 0,
  power: false, perks: [], insta: 0, dbl: 0, drops: [], dropsRound: 0, nades: [], proj: [], box: null, forge: null, popups: [], banner: null, repairPts: 0, over: false, overT: 0, stats: {}, hitT: 0, hitHead: false, sens: +(localStorage.getItem('da_sens') || 1) };
if (!DIFFS[G.diff]) G.diff = 'normal';
const P = { x: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, hp: 100, max: 100, regenT: 0, stam: 1, stamT: 0, sprint: false, ads: 0, guns: [], cur: 0, swapT: 0, reloadT: 0, reloadDur: 0, fireCD: 0, knifeT: 0, knifeHit: false, nadeN: 2, nadeCD: 0, down: false, downT: 0, bob: 0, kick: 0, recoil: 0, inv: 0, useT: 0, hurtT: 0, lastDmgDir: 0, god: false };
const inp = { mx: 0, mz: 0, lx: 0, ly: 0, fire: false, fireEdge: false, ads: false, reload: false, use: false, useEdge: false, knife: false, nade: false, swap: false, sprint: false, slot: -1 };
export { G, P, inp };

// ---------------- viewmodel ----------------
const VM = { grp: new THREE.Group(), gun: null, arms: null, knife: null, flash: null, id: null, pap: false };
camera.add(VM.grp);
VM.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(star4()), color: 0xffd0a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
VM.flash.scale.set(0.22, 0.22, 1); VM.flash.visible = false;
{ const k = buildGun('knife'); VM.knife = k.g; VM.knife.visible = false; VM.knife.position.set(0.12, -0.15, -0.3); camera.add(VM.knife); const hand = buildArms(null); hand.children.slice(2).forEach((c) => c.visible = false); VM.knife.add(hand); }
function setViewGun(id, pap) {
  if (VM.id === id && VM.pap === pap) return;
  if (VM.gun) { VM.grp.remove(VM.gun.g); VM.grp.remove(VM.arms); }
  VM.gun = buildGun(id, pap); VM.arms = buildArms(VM.gun.fore); VM.grp.add(VM.gun.g, VM.arms);
  VM.gun.g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } }); VM.arms.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  VM.gun.muzzle.add(VM.flash); VM.id = id; VM.pap = pap;
}
const gun = () => P.guns[P.cur];
const gs = () => stats(gun().id, gun().pap);

// ---------------- helpers ----------------
const dbl = () => (G.dbl > 0 ? 2 : 1);
function addPts(n, x) {
  n = Math.round(n * dbl() * DIFFS[G.diff].pts / 10) * 10; if (!n) return;
  G.points += n; G.stats.earned = (G.stats.earned || 0) + n;
  G.popups.push({ t: 0, n, off: rnd(-20, 20) });
}
function spend(n) { if (G.points < n) { audio.play('deny'); flashMsg('Not enough points'); return false; } G.points -= n; G.popups.push({ t: 0, n: -n, off: 0 }); audio.play('buy'); return true; }
let msgT = 0, msgText = '';
function flashMsg(s, t = 1.6) { msgText = s; msgT = t; }
function banner(top, main, sub, dur = 3) { G.banner = { top, main, sub, t: 0, dur }; }
function fwd3() { const cp = Math.cos(P.pitch); return [-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp]; }

function wallT(ox, oy, oz, dx, dy, dz, maxD = 80) {
  const h = Math.hypot(dx, dz); let t = maxD;
  if (h > 1e-4) t = MP.rayWall(ox, oz, dx / h, dz / h, maxD * h) / h;
  if (dy < -1e-4) t = Math.min(t, -oy / dy);
  return t;
}
const losZ = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz); if (d < 0.01) return true; return MP.rayWall(ax, az, dx / d, dz / d, d, (i) => MP.blockedZ(i)) >= d - 0.01; };

// ---------------- game flow ----------------
function newGame() {
  for (const z of G.zs) if (z.rig) scene.remove(z.rig.root);
  for (const n of G.nades) scene.remove(n.m); for (const p of G.proj) scene.remove(p.m); for (const d of G.drops) scene.remove(d.m);
  Object.assign(G, { round: 0, toSpawn: 0, spawnT: 0, breakT: 0, zs: [], points: 500, kills: 0, heads: 0, t: 0, power: false, perks: [], insta: 0, dbl: 0, drops: [], dropsRound: 0, nades: [], proj: [], popups: [], banner: null, over: false, overT: 0, stats: { earned: 0, knives: 0, doors: 0, boxes: 0, revives: 0 }, flowT: 0 });
  MP.resetMap();
  Object.assign(P, { x: MP.PLAYER_START.cx * CS, z: MP.PLAYER_START.cy * CS, yaw: Math.PI * 0.5, pitch: 0, vx: 0, vz: 0, hp: DIFFS[G.diff].php, max: DIFFS[G.diff].php, regenT: 0, stam: 1, sprint: false, ads: 0, guns: [{ id: 'm45', pap: false, mag: 8, res: 88 }], cur: 0, swapT: 0.5, reloadT: 0, fireCD: 0, knifeT: 0, nadeN: 2, nadeCD: 0, down: false, downT: 0, inv: 0, hurtT: 0 });
  setViewGun('m45', false);
  // reset world dynamics
  W.windows.forEach((w) => w.boards.forEach((b) => { b.state = 'on'; b.t = 0; b.m.visible = true; b.m.position.copy(b.home); b.m.rotation.copy(b.rot); }));
  W.doors.forEach((d) => { d.open = 0; d.opening = false; d.grp.visible = true; d.leafs.forEach((l, i) => { l.position.x = (i ? 1 : -1) * 0.5; }); });
  W.perks.forEach((p) => { p.front.emissiveIntensity = p.p.power ? 0.05 : 1.6; p.bulb.material.emissiveIntensity = p.p.power ? 0 : 3; });
  W.lamps.forEach((l) => { l.l.intensity = l.powered ? 0 : l.I; l.bulbM.emissiveIntensity = l.powered ? 0.05 : 2.4; });
  W.power.lever.rotation.x = -0.9; W.power.lamp.material.emissive.setHex(0xff2010);
  W.forge.mouth.material.emissiveIntensity = 0.15; W.forge.light.intensity = 0;
  G.box = { spot: 0, uses: 0, limit: 4 + ((Math.random() * 5) | 0), state: 'idle', t: 0, gun: null, model: null, moveT: 0 }; placeBox(0);
  G.forge = { state: 'idle', t: 0, slot: null, model: null };
  fx.clear(); MP.computeFlow(P.x, P.z);
  startRound(1);
}
function startRound(r) {
  G.round = r; G.toSpawn = roundCount(r); G.spawnT = 1.5; G.breakT = 0; G.dropsRound = 0; G.repairPts = 0;
  G.zhp = roundHP(r) * DIFFS[G.diff].hp;
  if (r > 1) P.nadeN = Math.min(4, P.nadeN + 2);
  G.bruteDue = r >= 5 && r % 5 === 0 ? 1 : 0; G.bruteAt = Math.floor(G.toSpawn * 0.5);
  audio.play('roundStart'); audio.setDrone(Math.min(0.5, 0.12 + r * 0.03));
  banner('', 'ROUND ' + r, r === 1 ? 'Hold the farmhouse. Board the windows. Survive the night.' : G.bruteDue ? 'The Harvester walks tonight' : '', 3.2);
}
function endRound() {
  G.breakT = r2break(); audio.play('roundEnd');
  if (G.round >= (bestOf().round || 0)) {/* saved on death */}
}
const r2break = () => 9;
function bestOf() { try { return JSON.parse(localStorage.getItem('da_best_' + G.diff) || '{}'); } catch { return {}; } }

// ---------------- spawning ----------------
function activeSpawns() { return MP.SPAWNS.filter((s) => MP.zoneOpen(MP.WINDOWS[s.win].zone)); }
function spawnZombie(type) {
  const list = activeSpawns().map((s) => ({ s, d: MP.dist[s.cy * MP.W + s.cx] + rnd(0, 8) })).sort((a, b) => a.d - b.d);
  if (!list.length) return null;
  const pick = list[Math.min(list.length - 1, (Math.random() * Math.min(3, list.length)) | 0)].s;
  const r = G.round, D = DIFFS[G.diff];
  if (!type) {
    const runFrac = clamp((r - 4) * 0.15, 0, 0.92), jog = clamp((r - 2) * 0.18, 0, 1);
    type = Math.random() < runFrac ? 'runner' : 'walker';
    if (type === 'walker' && Math.random() < jog) type = 'jogger';
  }
  const rigType = type === 'jogger' ? 'walker' : type;
  const z = { type: rigType, mode: type, x: (pick.cx + 0.5) * CS + rnd(-0.5, 0.5), z: (pick.cy + 0.5) * CS + rnd(-0.5, 0.5), y: -1.8, vx: 0, vz: 0, yaw: 0, state: 'rise', riseT: 0, t: 0, ph: Math.random() * 6, seed: Math.random() * 10, tilt: rnd(-0.25, 0.25),
    hp: G.zhp, max: G.zhp, legDmg: 0, crawler: false, atk: 0, atkDur: 0.8, atkSide: 1, atkHit: false, atkCD: 0, tearT: 1.2, moving: 0, deadT: 0, groanT: rnd(0.5, 3), stuckT: 0, lastD: 1e9, charging: 0, chargeCD: 4, scale: 1, rig: null, flinch: 0, win: pick.win, oneArm: Math.random() < 0.25 };
  if (type === 'walker') z.spd = rnd(1.15, 1.55); else if (type === 'jogger') z.spd = rnd(2.2, 2.8); else if (type === 'runner') z.spd = rnd(3.7, 4.4);
  if (type === 'brute') { z.spd = 1.5; z.hp = z.max = Math.min(60000, G.zhp * 14 + 3000); z.atkDur = 1.1; }
  z.spd *= D.spd;
  if (!MANUAL || G.renderOn) { z.rig = makeZombie(rigType, Q.shadows); z.scale = z.rig.scale; scene.add(z.rig.root); if (G.insta > 0) setEyes(z.rig, true); }
  else z.scale = type === 'brute' ? 1.5 : 1;
  G.zs.push(z);
  if (type === 'brute') { audio.play('brute'); banner('', 'THE HARVESTER', 'Big, slow, and it charges. Aim for the head.', 3); }
  return z;
}
function ensureRig(z) { if (!z.rig) { z.rig = makeZombie(z.type, Q.shadows); z.scale = z.rig.scale; scene.add(z.rig.root); if (z.crawler) {} } }

// ---------------- damage ----------------
function hurtZombie(z, dmg, part, dir, src) {
  if (z.state === 'dead') return false;
  if (G.insta > 0 && z.type !== 'brute') dmg = z.hp + 1; else if (G.insta > 0) dmg *= 3;
  z.hp -= dmg; z.flinch = 0.12;
  if (part === 'legs') z.legDmg += dmg;
  if (z.hp <= 0) { killZombie(z, part, dir, src); return true; }
  addPts(10);
  if (part === 'legs' && !z.crawler && z.type !== 'brute' && z.legDmg > z.max * 0.4 && Math.random() < 0.45) {
    z.crawler = true; z.spd = 0.95; z.atkDur = 0.9; fx.spawnDebris(z.x, 0.5, z.z, 4, ['#4a0606', '#3a2a20'], 3, 0.12);
    gore(z.x, 0.5, z.z, 14);
  }
  return false;
}
function gore(x, y, z, n, big = false) {
  for (let i = 0; i < n; i++) fx.smoke.emit({ x, y, z, vx: rnd(-2, 2) * (big ? 2 : 1), vy: rnd(0.5, 4) * (big ? 1.5 : 1), vz: rnd(-2, 2) * (big ? 2 : 1), life: rnd(0.4, 0.9), s0: rnd(0.1, 0.25), s1: rnd(0.3, 0.6), r: 0.35, g: 0.01, b: 0.01, r2: 0.18, g2: 0, b2: 0, a: 0.95, drag: 1.2, grav: 9 });
}
function killZombie(z, part, dir, src) {
  z.state = 'dead'; z.deadT = 0; z.atk = 0; G.kills++;
  const head = part === 'head';
  if (head) G.heads++;
  if (src === 'knife') { addPts(130); G.stats.knives++; } else if (src === 'nuke') { } else addPts(head ? 100 : 60);
  z.fallDir = dir && (dir[0] * Math.sin(z.yaw) + dir[2] * Math.cos(z.yaw)) > 0 ? 1 : -1;
  if (z.rig) { if (head && z.type !== 'brute') { z.rig.head.visible = false; z.rig.stump.visible = true; } }
  const hv = hitVolumes(z);
  if (head) { gore(hv.head[0], hv.head[1], hv.head[2], 26, true); audio.play('head'); } else gore(hv.body[3], hv.body[4], hv.body[5], 12);
  if (Math.random() < 0.7 || head) fx.decal(z.x + rnd(-0.5, 0.5), z.z + rnd(-0.5, 0.5), rnd(1.2, 2.2));
  audio.play('splat');
  // power-up drop
  if (src !== 'nuke' && z.state === 'dead') {
    const ch = z.type === 'brute' ? 1 : 0.03;
    if (G.dropsRound < 4 && Math.random() < ch && z.y > -0.5) dropPower(z.x, z.z, z.type === 'brute' ? 'ammo' : null);
  }
  if (z.type === 'brute') { addPts(500); banner('', 'HARVESTER DOWN', '+500', 2.5); }
}
const DROP_KINDS = ['ammo', 'insta', 'double', 'nuke', 'carpenter'];
function dropPower(x, z, kind) {
  kind = kind || DROP_KINDS[(Math.random() * DROP_KINDS.length) | 0];
  // keep it inside walkable space
  const c = MP.cellAt(x, z); if (c < 0 || MP.blockedP(c)) { const w = MP.WINDOWS[0]; void w; if (MP.blockedP(c)) { x = P.x + rnd(-1, 1); z = P.z + rnd(-1, 1); } }
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(powerIcon(kind)), color: 0xffffff, transparent: true, depthWrite: false }));
  m.scale.set(0.8, 0.8, 1); m.position.set(x, 1, z); scene.add(m);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(star4()), color: 0x5dff4a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); glow.scale.set(1.6, 1.6, 1); m.add(glow);
  G.drops.push({ kind, x, z, t: 0, m }); G.dropsRound++; audio.play('drop');
}
function takePower(d) {
  audio.play('power-up'); scene.remove(d.m);
  const names = { ammo: 'MAX AMMO', insta: 'INSTA-KILL', double: 'DOUBLE POINTS', nuke: 'KABOOM', carpenter: 'CARPENTER' };
  banner('', names[d.kind], '', 2);
  if (d.kind === 'ammo') { for (const g of P.guns) g.res = stats(g.id, g.pap).res; P.nadeN = 4; }
  if (d.kind === 'insta') { G.insta = 30; for (const z of G.zs) if (z.rig) setEyes(z.rig, true); }
  if (d.kind === 'double') G.dbl = 30;
  if (d.kind === 'nuke') { audio.play('nuke'); fx.flash(P.x, 6, P.z, 0xffffff, 400, 0.6, 80); for (const z of G.zs) if (z.state !== 'dead' && z.type !== 'brute') { killZombie(z, 'body', null, 'nuke'); } G.points += 400 * dbl(); G.popups.push({ t: 0, n: 400 * dbl(), off: 0 }); }
  if (d.kind === 'carpenter') { MP.WINDOWS.forEach((w, i) => { while (MP.S.boards[i] < 6) repairBoard(i, true); }); addPts(200); }
}
function hurtPlayer(dmg, fromX, fromZ) {
  if (P.down || P.god || P.inv > 0) return;
  P.hp -= dmg; P.regenT = 2.6; P.hurtT = 0.5; audio.play('hurt'); fx.shake = Math.min(1, fx.shake + 0.4);
  P.lastDmgDir = Math.atan2(fromX - P.x, fromZ - P.z);
  if (P.hp <= 0) {
    if (G.perks.includes('wind')) {
      G.perks = G.perks.filter((p) => p !== 'wind'); P.hp = P.max; P.inv = 3; G.stats.revives++;
      banner('', 'SECOND WIND', 'Back on your feet. The perk is used up.', 2.5); audio.play('perk');
      for (const z of G.zs) if (z.state !== 'dead') { const d = Math.hypot(z.x - P.x, z.z - P.z); if (d < 5) { z.vx += (z.x - P.x) / d * 8; z.vz += (z.z - P.z) / d * 8; z.atk = 0; z.stun = 1.2; } }
      fx.ring(P.x, 0.3, P.z, 6, 0.6, 0x5ab0ff);
      return;
    }
    P.down = true; P.downT = 0; P.hp = 0; audio.play('down'); audio.setDrone(0);
  }
}

// ---------------- weapons ----------------
const _hits = [];
function fire() {
  const g = gun(), s = gs();
  if (g.mag <= 0) { audio.play('empty'); P.fireCD = 0.25; if (g.res > 0) startReload(); return; }
  g.mag--; const tap = G.perks.includes('tap'); G.stats.shots = (G.stats.shots || 0) + 1;
  P.fireCD = 60 / s.rpm / (tap ? 1.33 : 1);
  const [ox, oy, oz] = [P.x, EYE + (P.down ? -1 : 0), P.z];
  const f = fwd3(); const ry = P.yaw, rp = P.pitch;
  const rx = Math.cos(ry), rz = -Math.sin(ry); const ux = Math.sin(ry) * Math.sin(rp), uy = Math.cos(rp), uz = Math.cos(ry) * Math.sin(rp);
  const moving = Math.hypot(P.vx, P.vz) / WALK;
  let spr = s.spr * (1 - P.ads * (s.pel ? 0.45 : 0.85)) * (1 + moving * 0.6) * (P.sprint ? 2 : 1) + P.recoil * 0.25;
  if (s.scope && P.ads > 0.9) spr = 0.0005;
  const pel = s.pel || 1;
  audio.gun(g.id, g.pap);
  P.kick += s.kick; P.recoil = Math.min(0.08, P.recoil + s.kick * 0.25);
  P.pitch = clamp(P.pitch + s.kick * (P.ads > 0.5 ? 0.3 : 0.45), -1.45, 1.45); P.yaw += rnd(-1, 1) * s.kick * 0.15;
  muzzle(g.pap);
  if (s.proj) { // ray gun projectile
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(star4()), color: g.pap ? 0xaaff60 : 0x5dff4a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    m.scale.set(0.7, 0.7, 1); scene.add(m);
    const mp = new THREE.Vector3(); if (VM.gun) VM.gun.muzzle.getWorldPosition(mp); else mp.set(ox, oy, oz);
    G.proj.push({ x: ox + f[0] * 0.6, y: oy + f[1] * 0.6 - 0.08, z: oz + f[2] * 0.6, vx: f[0] * 42, vy: f[1] * 42, vz: f[2] * 42, t: 0, m, s });
    return;
  }
  let anyHit = false, anyHead = false;
  for (let p = 0; p < pel; p++) {
    let a = (Math.random() + Math.random() - 1) * spr, b = (Math.random() + Math.random() - 1) * spr;
    let dx = f[0] + rx * a + ux * b, dy = f[1] + uy * b, dz = f[2] + rz * a + uz * b; const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
    const wt = wallT(ox, oy, oz, dx, dy, dz, 90);
    _hits.length = 0;
    for (const z of G.zs) {
      if (z.state === 'dead' || z.y < -1.2) continue;
      const ddx = z.x - ox, ddz = z.z - oz; if (ddx * dx + ddz * dz < -1) continue;
      const v = hitVolumes(z);
      let best = 1e9, part = null;
      const th = raySphere(ox, oy, oz, dx, dy, dz, v.head); if (th > 0 && th < best) { best = th; part = 'head'; }
      const tb = rayCapsule(ox, oy, oz, dx, dy, dz, v.body); if (tb > 0 && tb < best) { best = tb; part = 'body'; }
      if (v.legs) { const tl = rayCapsule(ox, oy, oz, dx, dy, dz, v.legs); if (tl > 0 && tl < best) { best = tl; part = 'legs'; } }
      if (part && best < wt) _hits.push([best, z, part]);
    }
    _hits.sort((a, b) => a[0] - b[0]);
    let endT = wt; const n = Math.min(_hits.length, s.pierce);
    for (let i = 0; i < n; i++) {
      const [t, z, part] = _hits[i];
      let dmg = s.dmg * (part === 'head' ? s.head : part === 'legs' ? 0.8 : 1) * (tap ? 1.5 : 1);
      if (s.falloff) dmg *= clamp(1 - (t - 3) / s.falloff, 0.25, 1);
      if (z.type === 'brute' && part === 'head') dmg *= 1.5;
      hurtZombie(z, dmg, part, [dx, dy, dz]); anyHit = true; if (part === 'head') anyHead = true;
      const hx = ox + dx * t, hy = oy + dy * t, hz = oz + dz * t;
      gore(hx, hy, hz, part === 'head' ? 6 : 3);
      if (s.splash) splash(hx, hy, hz, s.splash, s.splashDmg, g.pap);
      if (i === n - 1) endT = t;
    }
    if (!n || n < s.pierce) {
      // impact on world
      if (wt < 85) { const ix = ox + dx * wt, iy = oy + dy * wt, iz = oz + dz * wt; fx.sparks(ix, iy, iz, 3, [0.9, 0.8, 0.6], 4); if (Math.random() < 0.5) fx.smoke.emit({ x: ix, y: iy, z: iz, vy: 0.4, life: 0.7, s0: 0.15, s1: 0.6, r: 0.4, g: 0.36, b: 0.3, a: 0.5 }); if (s.splash) splash(ix, iy, iz, s.splash, s.splashDmg, g.pap); }
    }
    if (p < 3) tracer(ox, oy, oz, dx, dy, dz, endT);
  }
  if (anyHit) { G.stats.hits = (G.stats.hits || 0) + 1; G.hitT = 0.18; G.hitHead = anyHead; audio.play(anyHead ? 'head' : 'hit'); }
  if (g.mag === 0 && g.res > 0) P.autoReload = 0.25;
}
function splash(x, y, z, r, dmg, pap) {
  fx.explosion(x, y, z, 0.35 * r, ['#2a3a1a', '#3a2a10']); fx.flash(x, y + 0.5, z, pap ? 0x9aff60 : 0x6dff5a, 90, 0.3, 10);
  for (const q of G.zs) { if (q.state === 'dead') continue; const d = Math.hypot(q.x - x, q.z - z); if (d < r) hurtZombie(q, dmg * (1 - d / r * 0.6), 'body', [q.x - x, 0, q.z - z], 'splash'); }
}
function tracer(ox, oy, oz, dx, dy, dz, t) {
  if (t < 2) return;
  const n = Math.min(10, Math.floor(t / 2));
  for (let i = 1; i <= n; i++) { const k = (i / n) * Math.min(t, 40); fx.add.emit({ x: ox + dx * k, y: oy + dy * k - 0.06, z: oz + dz * k, life: 0.06, s0: 0.12, s1: 0.04, r: 2, g: 1.6, b: 0.9, a: 0.55 }); }
}
function muzzle(pap) {
  VM.flash.visible = true; VM.flash.material.rotation = Math.random() * 6; VM.flash.material.color.setHex(pap ? 0x9aff7a : 0xffd0a0); G.flashT = 0.05;
  const mp = new THREE.Vector3(); if (VM.gun) VM.gun.muzzle.getWorldPosition(mp); else mp.set(P.x, EYE, P.z);
  const f3 = fwd3(); muzzleLight.position.set(mp.x + f3[0] * 1.2, mp.y + f3[1] * 1.2, mp.z + f3[2] * 1.2); muzzleLight.color.setHex(pap ? 0x9aff7a : 0xffb060); muzzleLight.intensity = 3;
}
function startReload() {
  const g = gun(), s = gs(); if (g.mag >= s.mag || g.res <= 0 || P.reloadT > 0) return;
  const dur = s.rel * (G.perks.includes('draw') ? 0.5 : 1); P.reloadT = P.reloadDur = dur; audio.play('reload', dur);
}
function finishReload() { const g = gun(), s = gs(); const need = s.mag - g.mag, take = Math.min(need, g.res); g.mag += take; g.res -= take; }
function swapTo(i) { if (i === P.cur || !P.guns[i] || P.swapT > 0) return; P.cur = i; P.reloadT = 0; P.swapT = G.perks.includes('draw') ? 0.35 : 0.6; P.swapMid = false; audio.play('click'); }
function giveGun(id, pap = false) {
  const s = stats(id, pap); const have = P.guns.findIndex((g) => g.id === id);
  if (have >= 0) { P.guns[have] = { id, pap, mag: s.mag, res: s.res }; P.cur = have; }
  else if (P.guns.length < 2) { P.guns.push({ id, pap, mag: s.mag, res: s.res }); P.cur = P.guns.length - 1; }
  else P.guns[P.cur] = { id, pap, mag: s.mag, res: s.res };
  P.swapT = 0.6; P.reloadT = 0;
}
function knife() {
  if (P.knifeT > 0) return; P.knifeT = 0.5; P.knifeHit = false; P.reloadT = 0; audio.play('knife');
  // lunge toward a close target
  let best = null, bd = 3.2; const f = fwd3();
  for (const z of G.zs) { if (z.state === 'dead') continue; const dx = z.x - P.x, dz = z.z - P.z, d = Math.hypot(dx, dz); if (d < bd && (dx * f[0] + dz * f[2]) / d > 0.65) { bd = d; best = z; } }
  if (best && bd > 1.4) { const k = (bd - 1.1) / bd; P.vx += (best.x - P.x) * k * 6; P.vz += (best.z - P.z) * k * 6; }
}
function knifeStrike() {
  const f = fwd3(); let best = null, bd = 2.0;
  for (const z of G.zs) { if (z.state === 'dead' || z.y < -1) continue; const dx = z.x - P.x, dz = z.z - P.z, d = Math.hypot(dx, dz); if (d < bd && (dx * f[0] + dz * f[2]) / Math.max(0.01, d) > 0.55) { bd = d; best = z; } }
  if (best) { hurtZombie(best, 150 * (G.perks.includes('tap') ? 1.5 : 1), 'body', f, 'knife'); audio.play('knifeHit'); const v = hitVolumes(best); gore(v.body[3], v.body[4], v.body[5], 10); G.hitT = 0.18; G.hitHead = false; best.vx += f[0] * 3; best.vz += f[2] * 3; }
}
function throwNade() {
  if (P.nadeN <= 0 || P.nadeCD > 0) return; P.nadeN--; P.nadeCD = 0.8; audio.play('pin');
  const f = fwd3(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3d4a2a, roughness: 0.6 }));
  scene.add(m); G.nades.push({ x: P.x + f[0] * 0.5, y: EYE - 0.1, z: P.z + f[2] * 0.5, vx: f[0] * 15 + P.vx * 0.5, vy: f[1] * 15 + 3.5, vz: f[2] * 15 + P.vz * 0.5, t: 2.3, m });
}
function nadeBoom(n) {
  scene.remove(n.m); audio.play('boom'); fx.explosion(n.x, Math.max(0.2, n.y), n.z, 1.1);
  const dmg = 300 + G.round * 110;
  for (const z of G.zs) { if (z.state === 'dead') continue; const d = Math.hypot(z.x - n.x, z.z - n.z); if (d < 5.5 && losZ(n.x, n.z, z.x, z.z)) hurtZombie(z, dmg * (1 - d / 6.5) * (z.type === 'brute' ? 0.5 : 1), d < 2 ? 'legs' : 'body', [z.x - n.x, 0, z.z - n.z], 'nade'); }
  const pd = Math.hypot(P.x - n.x, P.z - n.z); if (pd < 3.5 && !P.god) { P.hp -= 30 * (1 - pd / 3.5); P.regenT = 2.6; P.hurtT = 0.4; if (P.hp <= 0) P.hp = 1; }
}

// ---------------- interactables ----------------
const boxModels = {};
function boxModel(id) {
  if (!boxModels[id]) {
    if (id === 'doll') { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0xb89a52, roughness: 1 }); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.3, 8), m); g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), m); h.position.y = 0.24; g.add(h); const e = new THREE.MeshBasicMaterial({ color: 0xff3010 }); for (const s of [-0.035, 0.035]) { const q = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), e); q.position.set(s, 0.26, 0.09); g.add(q); } const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.17, 0.08, 10), m); hat.position.y = 0.34; g.add(hat); boxModels[id] = g; }
    else { boxModels[id] = buildGun(id).g; boxModels[id].rotation.y = Math.PI / 2; }
  }
  return boxModels[id];
}
for (const b of MP.BOXES) { // pallets mark every possible box spot
  const pal = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 1.0), W.mats.board); pal.position.set((b.cx + 0.5) * CS, 0.07, (b.cy + 0.5) * CS); pal.rotation.y = Math.atan2(b.face[0], b.face[1]); scene.add(pal);
}
function placeBox(i) {
  const b = MP.BOXES[i]; G.box.spot = i; W.box.grp.position.set((b.cx + 0.5) * CS, 0.14, (b.cy + 0.5) * CS); W.box.grp.rotation.y = Math.atan2(b.face[0], b.face[1]); W.box.grp.visible = true;
  G.box.x = (b.cx + 0.5) * CS; G.box.z = (b.cy + 0.5) * CS; G.box.fx = G.box.x + b.face[0] * 1.4; G.box.fz = G.box.z + b.face[1] * 1.4;
}
function repairBoard(i, quiet) { if (MP.S.boards[i] >= 6) return; MP.S.boards[i]++; if (!quiet) { audio.play('hammer'); if (G.repairPts < 500) { addPts(10); G.repairPts += 10; } } }
const near = (x, z, r) => Math.hypot(P.x - x, P.z - z) < r;
const facing = (x, z, minDot = 0.35) => { const f = fwd3(), dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz) || 1; return (dx * f[0] + dz * f[2]) / (d * Math.hypot(f[0], f[2]) || 1) > minDot; };
function findUse() {
  const g = gun();
  // box first (offer)
  const B = G.box;
  if (B.state === 'offer' && near(B.fx, B.fz, 2.6)) return { text: 'Press E to take ' + GUNS[B.gun].name, act: () => { giveGun(B.gun); B.state = 'close'; B.t = 0; audio.play('buy'); } };
  if (G.forge.state === 'offer' && near(W.forge.fx, W.forge.fz, 2.6)) return { text: 'Press E to take the forged weapon', act: () => takeForged() };
  // windows
  for (const w of W.windows) {
    const i = w.i; if (MP.S.boards[i] >= 6) continue;
    if (Math.hypot(P.x - w.inside[0], P.z - w.inside[1]) < 1.9) return { text: 'Hold E to rebuild the barricade', hold: true, act: () => repairBoard(i) };
  }
  for (const d of W.doors) if (!MP.S.doorOpen[d.d.id] && near(d.grp.position.x, d.grp.position.z, 2.5)) return { text: `Press E to open ${d.d.label}`, cost: d.d.cost, act: () => { if (spend(d.d.cost)) openDoor(d.d.id); } };
  for (const w of W.wallbuys) if (near(w.fx, w.fz, 1.9) && facing(w.x, w.z, 0.2)) {
    const id = w.wb.gun;
    if (id === 'grenades') return { text: 'Press E to buy Frag Grenades', cost: 250, act: () => { if (P.nadeN >= 4) { flashMsg('Grenades full'); return; } if (spend(250)) P.nadeN = 4; } };
    const have = P.guns.find((q) => q.id === id);
    if (have) { const c = have.pap ? 2500 : w.wb.cost / 2; return { text: `Press E to buy ${have.pap ? GUNS[id].pap.name : GUNS[id].name} ammo`, cost: c, act: () => { const s = stats(id, have.pap); if (have.res >= s.res && have.mag >= s.mag) { flashMsg('Ammo full'); return; } if (spend(c)) { have.res = s.res; } } }; }
    return { text: `Press E to buy ${GUNS[id].name}`, cost: w.wb.cost, act: () => { if (spend(w.wb.cost)) giveGun(id); } };
  }
  for (const p of W.perks) if (near(p.fx, p.fz, 1.9) || near(p.x, p.z, 1.6)) {
    const id = p.p.id, info = PERK_INFO[id];
    if (G.perks.includes(id)) return { text: `${info.name}: you have it`, act: () => {} };
    if (p.p.power && !G.power) return { text: 'You need to turn on the power', act: () => audio.play('deny') };
    return { text: `Press E to drink ${info.name}. ${info.sub}`, cost: p.p.cost, act: () => { if (G.perks.length >= 4) { flashMsg('You can only carry 4 perks'); audio.play('deny'); return; } if (spend(p.p.cost)) { G.perks.push(id); audio.play('perk'); if (id === 'hide') { P.max = DIFFS[G.diff].php + 150; P.hp = P.max; } banner('', info.name.toUpperCase(), info.desc, 2.6); } } };
  }
  if (B.state === 'idle' && near(B.fx, B.fz, 2.2) || (B.state === 'idle' && near(B.x, B.z, 1.8))) return { text: 'Press E for a random weapon', cost: 950, act: () => { if (spend(950)) { B.state = 'roll'; B.t = 0; B.uses++; G.stats.boxes++; audio.play('boxSpin'); } } };
  if (near(W.forge.fx, W.forge.fz, 2.2) || near(W.forge.x, W.forge.z, 1.8)) {
    if (!G.power) return { text: 'The Clover Forge needs power', act: () => audio.play('deny') };
    if (G.forge.state !== 'idle') return null;
    if (g.pap) return { text: 'This weapon is already forged', act: () => {} };
    return { text: `Press E to forge ${GUNS[g.id].name}`, cost: 5000, act: () => { if (spend(5000)) { G.forge.state = 'work'; G.forge.t = 0; G.forge.slot = P.cur; G.forge.gun = g.id; P.forgeT = 3.6; audio.play('forge'); } } };
  }
  if (!G.power && near(W.power.x, W.power.z, 2.0)) return { text: 'Press E to turn on the power', act: () => powerOn() };
  return null;
}
function takeForged() {
  const F = G.forge; const i = P.guns.findIndex((q) => q.id === F.gun);
  if (i >= 0) { const s = stats(F.gun, true); P.guns[i] = { id: F.gun, pap: true, mag: s.mag, res: s.res }; P.cur = i; P.swapT = 0.6; }
  F.state = 'idle'; audio.play('boxDone'); banner('', GUNS[F.gun].pap.name.toUpperCase(), 'Forged in clover fire', 2.2);
}
function openDoor(id) {
  MP.S.doorOpen[id] = true; W.doors[id].opening = true; audio.play('door'); G.stats.doors++; MP.computeFlow(P.x, P.z);
  const d = MP.DOORS[id]; banner('', MP.ZONES[d.b].name.toUpperCase(), 'More windows, more of them', 2);
}
function powerOn() {
  G.power = true; audio.play('power'); banner('', 'POWER ON', 'Perks and the Clover Forge are live', 2.6);
  W.power.lever.rotation.x = 0.9; W.power.lamp.material.emissive.setHex(0x30ff40);
  W.perks.forEach((p) => { p.front.emissiveIntensity = 1.6; p.bulb.material.emissiveIntensity = 3; });
  W.lamps.forEach((l) => { if (l.powered) { l.l.intensity = l.I; l.bulbM.emissiveIntensity = 2.4; } });
  W.forge.mouth.material.emissiveIntensity = 3; W.forge.light.intensity = 8;
}

// ---------------- simulation step ----------------
const pressed = new Set();
const edge = (k) => pressed.has(k);
function step(dt) {
  if (G.state !== 'play') { pressed.clear(); return; }
  G.t += dt;
  G.insta = Math.max(0, G.insta - dt); if (G.insta === 0 && G.instaWas) { for (const z of G.zs) if (z.rig) setEyes(z.rig, false); } G.instaWas = G.insta > 0;
  G.dbl = Math.max(0, G.dbl - dt); msgT -= dt; G.hitT -= dt; P.inv -= dt; P.hurtT -= dt;
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  for (const p of G.popups) p.t += dt; G.popups = G.popups.filter((p) => p.t < 1.2);
  if (P.down) { P.downT += dt; stepZombies(dt); if (P.downT > 2.6) gameOver(); pressed.clear(); return; }
  stepPlayer(dt); stepWeapon(dt);
  // interaction
  G.use = findUse();
  if (G.use) { if (G.use.hold) { if (inp.use) { P.useT += dt; if (P.useT >= 0.5) { P.useT = 0; G.use.act(); } } else P.useT = 0.45; } else if (edge('use')) G.use.act(); } else P.useT = 0.45;
  // flow
  G.flowT -= dt; if (G.flowT <= 0) { G.flowT = 0.2; MP.computeFlow(P.x, P.z); }
  // rounds
  const alive = G.zs.filter((z) => z.state !== 'dead').length;
  if (G.breakT > 0) { G.breakT -= dt; if (G.breakT <= 0) startRound(G.round + 1); }
  else {
    G.spawnT -= dt;
    if (G.toSpawn > 0 && G.spawnT <= 0 && alive < Math.min(DIFFS[G.diff].alive, 5 + G.round * 3)) {
      const brute = G.bruteDue && G.toSpawn <= G.bruteAt; if (brute) G.bruteDue = 0;
      if (spawnZombie(brute ? 'brute' : null)) { G.toSpawn--; }
      G.spawnT = Math.max(0.4, 2.4 - G.round * 0.16) * rnd(0.6, 1.3);
    }
    if (G.toSpawn === 0 && alive === 0) endRound();
  }
  stepZombies(dt);
  stepEntities(dt);
  pressed.clear(); inp.slot = -1;
}
function stepPlayer(dt) {
  P.yaw -= inp.lx * dt * 2.8 * G.sens; P.pitch = clamp(P.pitch - inp.ly * dt * 2.1 * G.sens, -1.45, 1.45);
  const fx_ = -Math.sin(P.yaw), fz_ = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  let wx = fx_ * inp.mz + rx * inp.mx, wz = fz_ * inp.mz + rz * inp.mx; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  const leaf = G.perks.includes('leaf');
  const wantSprint = inp.sprint && inp.mz > 0.3 && P.stam > 0.02 && !inp.ads;
  P.sprint = wantSprint && !(inp.fire && P.fireCD <= 0);
  if (P.sprint) { P.stam -= dt / (leaf ? 8 : 4); P.stamT = 1.2; } else { P.stamT -= dt; if (P.stamT <= 0) P.stam = Math.min(1, P.stam + dt / 3); }
  const spd = P.sprint ? SPRINT * (leaf ? 1.15 : 1) : WALK + (ADSSPD - WALK) * P.ads;
  const k = Math.min(1, dt * 10); P.vx += (wx * spd - P.vx) * k; P.vz += (wz * spd - P.vz) * k;
  P.x += P.vx * dt; P.z += P.vz * dt;
  for (const z of G.zs) { if (z.state === 'dead' || z.y < -0.5) continue; const dx = P.x - z.x, dz = P.z - z.z, d = Math.hypot(dx, dz), m = PR + (z.type === 'brute' ? 0.55 : 0.3); if (d < m && d > 0.001) { P.x = z.x + dx / d * m; P.z = z.z + dz / d * m; } }
  MP.collide(P, PR, MP.blockedP);
  const sp = Math.hypot(P.vx, P.vz); P.bob += sp * dt * 1.9; if (sp > 1 && Math.sin(P.bob * 2) > 0.95) audio.play('step', P.sprint ? 1.5 : 1);
  // health regen
  P.regenT -= dt; if (P.regenT <= 0 && P.hp < P.max) P.hp = Math.min(P.max, P.hp + dt * 70);
  const s = gs(); const wantAds = inp.ads && !P.sprint && P.swapT <= 0 && P.knifeT <= 0 && !(P.forgeT > 0);
  P.ads = clamp(P.ads + (wantAds ? 1 : -1) * dt / (s.scope ? 0.26 : 0.16), 0, 1);
}
function stepWeapon(dt) {
  P.fireCD -= dt; P.kick *= Math.pow(0.0005, dt); P.recoil *= Math.pow(0.02, dt); P.nadeCD -= dt;
  if (P.forgeT > 0) { P.forgeT -= dt; if (P.forgeT <= 0) { G.forge.state = 'offer'; G.forge.t = 0; audio.play('boxDone'); } return; }
  if (P.swapT > 0) { P.swapT -= dt; return; }
  if (P.knifeT > 0) { P.knifeT -= dt; if (!P.knifeHit && P.knifeT < 0.36) { P.knifeHit = true; knifeStrike(); } }
  if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) finishReload(); }
  if (P.autoReload > 0) { P.autoReload -= dt; if (P.autoReload <= 0) startReload(); }
  if (edge('reload')) startReload();
  if (edge('knife')) knife();
  if (edge('nade')) throwNade();
  if (edge('swap') && P.guns.length > 1) swapTo((P.cur + 1) % P.guns.length);
  if (inp.slot >= 0) swapTo(inp.slot);
  const s = gs();
  if (inp.fire && (s.auto || edge('fire')) && P.fireCD <= 0 && P.reloadT <= 0 && P.knifeT <= 0) { P.sprint = false; fire(); }
}
function stepZombies(dt) {
  const D = DIFFS[G.diff];
  for (let i = G.zs.length - 1; i >= 0; i--) {
    const z = G.zs[i]; z.t += dt;
    if (z.state === 'dead') { z.deadT += dt; if (z.deadT > 4.5) { if (z.rig) scene.remove(z.rig.root); G.zs.splice(i, 1); } continue; }
    if (z.state === 'rise') {
      z.riseT += dt; z.y = -1.8 + Math.min(1, z.riseT / 1.2) * 1.8; z.moving = 0.3; z.ph += dt * 4;
      if (z.riseT > 0.1 && Math.random() < dt * 8) fx.smokePuff(z.x, 0.2, z.z, 0.8, 0.14, 1.2, 0.6);
      const dx = P.x - z.x, dz = P.z - z.z; z.yaw = Math.atan2(dx, dz);
      if (z.riseT >= 1.2) { z.state = 'move'; z.y = 0; }
      continue;
    }
    z.flinch -= dt; z.atkCD -= dt; z.chargeCD -= dt; if (z.stun > 0) { z.stun -= dt; }
    const dx = P.x - z.x, dz = P.z - z.z, d = Math.hypot(dx, dz);
    // groans
    z.groanT -= dt; if (z.groanT <= 0) { z.groanT = rnd(2, 6) / (z.mode === 'runner' ? 1.5 : 1); const bear = Math.atan2(dx, dz); const rel = Math.sin(P.yaw - bear + Math.PI); audio.groan(clamp(1 - d / 26, 0, 1), rel, z.type === 'brute' ? 2 : 0); }
    const c = MP.cellAt(z.x, z.z);
    let tx = P.x, tz = P.z, tearing = false;
    const direct = d < 8 && losZ(z.x, z.z, P.x, P.z);
    if (!direct && c >= 0) {
      const n = MP.nextCell(c);
      if (n !== c) {
        [tx, tz] = MP.cellCenter(n);
        if (MP.grid[n] === MP.K.WIN && MP.S.boards[MP.winAt[n]] > 0) {
          tearing = true; const wi = MP.winAt[n];
          // stand at the window face
          const w = MP.WINDOWS[wi]; tx = (w.cx + 0.5) * CS + w.dx * 1.45; tz = (w.cy + 0.5) * CS + w.dy * 1.45;
          if (Math.hypot(z.x - tx, z.z - tz) < 0.9) {
            z.tearT -= dt;
            if (z.tearT <= 0 && d > 2.2) { MP.S.boards[wi]--; z.tearT = rnd(1.1, 1.8) * D.tear * (z.mode === 'runner' ? 0.7 : 1); z.atk = 0.6; z.atkDur = 0.6; z.atkSide = Math.random() < 0.5 ? 1 : -1; z.atkHit = true; const bear = Math.atan2(tx - P.x, tz - P.z); audio.play('board', Math.sin(P.yaw - bear + Math.PI) * 0.8); if (MP.S.boards[wi] === 0) MP.computeFlow(P.x, P.z); }
          }
        }
      }
    }
    // stuck failsafe
    if (!tearing) { if (d < z.lastD - 0.5) { z.lastD = d; z.stuckT = 0; } else z.stuckT += dt; if (z.stuckT > 14) { respawnZombie(z); continue; } } else z.stuckT = 0;
    // brute charge
    if (z.type === 'brute' && direct && d < 13 && d > 3 && z.chargeCD <= 0) { z.charging = 1.3; z.chargeCD = rnd(6, 9); audio.play('brute'); }
    if (z.charging > 0) z.charging -= dt;
    z.tearing = tearing;
    let spd = z.spd * (z.charging > 0 ? 4.2 : 1) * (z.atk > 0 ? 0.35 : 1) * (z.flinch > 0 ? 0.4 : 1) * (z.stun > 0 ? 0 : 1);
    if (z.crawler) spd = Math.min(spd, 0.95);
    let mx = tx - z.x, mz = tz - z.z; const ml = Math.hypot(mx, mz);
    const reach = tearing ? 2.1 : z.type === 'brute' ? 1.7 : z.crawler ? 1.05 : 1.2;
    if (ml > 0.01) { mx /= ml; mz /= ml; } if (direct && d < reach * 0.8) { mx = 0; mz = 0; }
    if (tearing && ml < 0.25) { mx = 0; mz = 0; }
    // separation
    for (const o of G.zs) { if (o === z || o.state === 'dead') continue; const sx = z.x - o.x, sz = z.z - o.z, sd = sx * sx + sz * sz; const m = 0.62 * (z.type === 'brute' || o.type === 'brute' ? 1.6 : 1); if (sd < m * m && sd > 1e-6) { const q = Math.sqrt(sd); mx += sx / q * (m - q) * 2.2; mz += sz / q * (m - q) * 2.2; } }
    const acc = Math.min(1, dt * 8); z.vx += (mx * spd - z.vx) * acc; z.vz += (mz * spd - z.vz) * acc;
    z.x += z.vx * dt; z.z += z.vz * dt;
    MP.collide(z, 0.3, (q) => MP.blockedZ(q));
    // vault through open window
    const k2 = MP.cellAt(z.x, z.z); const ty = (k2 >= 0 && MP.grid[k2] === MP.K.WIN) ? 0.55 : 0; z.y += (ty - z.y) * Math.min(1, dt * 7);
    const vs = Math.hypot(z.vx, z.vz); z.moving = clamp(vs / Math.max(0.8, z.spd), 0, 1.3);
    z.ph += dt * (z.crawler ? 4 : z.mode === 'runner' || z.charging > 0 ? 9 : z.mode === 'jogger' ? 6.5 : 4.2) * Math.max(0.25, z.moving);
    const wantYaw = (direct || tearing || vs < 0.2) ? Math.atan2(tearing ? tx - z.x + (tx - z.x) : dx, tearing ? tz - z.z : dz) : Math.atan2(z.vx, z.vz);
    let dy = wantYaw - z.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; z.yaw += dy * Math.min(1, dt * 7);
    // attack
    if (z.atk > 0) {
      z.atk -= dt;
      if (!z.atkHit && z.atk < z.atkDur * 0.45) { z.atkHit = true; if (d < reach + 0.35 && (z.tearing || losZ(z.x, z.z, P.x, P.z))) hurtPlayer(z.type === 'brute' ? D.dmg * 1.6 : D.dmg, z.x, z.z); }
    } else if (d < reach && z.atkCD <= 0 && !P.down && !(z.stun > 0)) {
      z.atk = z.atkDur = (z.type === 'brute' ? 1.2 : z.crawler ? 1.1 : 1.0); z.atkHit = false; z.atkSide = Math.random() < 0.5 ? 1 : -1; z.atkCD = z.atkDur + 0.35; z.charging = 0;
    }
  }
}
function respawnZombie(z) {
  // walked into a dead end: quietly send it back to the corn
  const list = activeSpawns(); if (!list.length) return; const s = list[(Math.random() * list.length) | 0];
  z.x = (s.cx + 0.5) * CS; z.z = (s.cy + 0.5) * CS; z.state = 'rise'; z.riseT = 0; z.y = -1.8; z.stuckT = 0; z.lastD = 1e9;
}
function stepEntities(dt) {
  for (let i = G.nades.length - 1; i >= 0; i--) {
    const n = G.nades[i]; n.t -= dt; n.vy -= 18 * dt;
    const ox = n.x, oz = n.z; n.x += n.vx * dt; if (MP.blocksShot(MP.cellAt(n.x, n.z)) || MP.kindAt(MP.cellAt(n.x, n.z)) === MP.K.PROP) { n.x = ox; n.vx *= -0.45; }
    n.z += n.vz * dt; if (MP.blocksShot(MP.cellAt(n.x, n.z)) || MP.kindAt(MP.cellAt(n.x, n.z)) === MP.K.PROP) { n.z = oz; n.vz *= -0.45; }
    n.y += n.vy * dt; if (n.y < 0.07) { n.y = 0.07; n.vy *= -0.4; n.vx *= 0.6; n.vz *= 0.6; }
    if (n.t <= 0) { nadeBoom(n); G.nades.splice(i, 1); }
  }
  for (let i = G.proj.length - 1; i >= 0; i--) {
    const p = G.proj[i]; p.t += dt; let boom = false, hitZ = null;
    const steps = 3; for (let s = 0; s < steps && !boom; s++) {
      p.x += p.vx * dt / steps; p.y += p.vy * dt / steps; p.z += p.vz * dt / steps;
      if (p.y < 0.05 || MP.blocksShot(MP.cellAt(p.x, p.z))) boom = true;
      for (const z of G.zs) { if (z.state === 'dead' || z.y < -1) continue; const v = hitVolumes(z); const bx = (v.body[0] + v.body[3]) / 2, by = (v.body[1] + v.body[4]) / 2, bz = (v.body[2] + v.body[5]) / 2; if (Math.hypot(p.x - bx, p.y - by, p.z - bz) < 0.55 * z.scale || Math.hypot(p.x - v.head[0], p.y - v.head[1], p.z - v.head[2]) < 0.3) { boom = true; hitZ = z; break; } }
    }
    if (p.t > 2.5) boom = true;
    if (boom) {
      if (hitZ) hurtZombie(hitZ, p.s.dmg * (G.perks.includes('tap') ? 1.5 : 1), 'body', [p.vx, p.vy, p.vz], 'ray');
      splash(p.x, p.y, p.z, p.s.splash, p.s.splashDmg, p.s.pap); scene.remove(p.m); G.proj.splice(i, 1);
      if (hitZ) { G.hitT = 0.18; G.hitHead = false; audio.play('hit'); }
    }
  }
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i]; d.t += dt;
    if (Math.hypot(P.x - d.x, P.z - d.z) < 1.3) { takePower(d); G.drops.splice(i, 1); continue; }
    if (d.t > 27) { scene.remove(d.m); G.drops.splice(i, 1); }
  }
  // box state machine
  const B = G.box; B.t += dt;
  if (B.state === 'roll' && B.t > 4.2) {
    const doll = B.uses > B.limit && Math.random() < 0.5;
    if (doll) { B.state = 'leave'; B.t = 0; B.gun = 'doll'; audio.play('laugh'); G.points += 950; G.popups.push({ t: 0, n: 950, off: 0 }); flashMsg('The box moved. Look for the green light.', 3); }
    else { const pool = BOX_POOL.filter((id) => !P.guns.some((g) => g.id === id)); B.gun = pool[(Math.random() * pool.length) | 0] || 'ray'; B.state = 'offer'; B.t = 0; audio.play('boxDone'); }
  } else if (B.state === 'offer' && B.t > 10) { B.state = 'close'; B.t = 0; }
  else if (B.state === 'close' && B.t > 0.6) { B.state = 'idle'; B.t = 0; }
  else if (B.state === 'leave' && B.t > 6) {
    let ns = B.spot; while (ns === B.spot) ns = (Math.random() * MP.BOXES.length) | 0;
    placeBox(ns); B.state = 'idle'; B.uses = 0; B.limit = 4 + ((Math.random() * 5) | 0);
  }
  if (G.forge.state === 'offer') { G.forge.t += dt; if (G.forge.t > 12) takeForged(); }
}
function gameOver() {
  G.state = 'over'; audio.stopMusic(); audio.setDrone(0);
  const best = bestOf(); const rec = { round: G.round, points: G.stats.earned, kills: G.kills };
  const isBest = !best.round || G.round > best.round || (G.round === best.round && G.kills > (best.kills || 0));
  if (isBest) localStorage.setItem('da_best_' + G.diff, JSON.stringify(rec));
  if (document.pointerLockElement) document.exitPointerLock();
  $('ovRound').textContent = G.round; $('ovKills').textContent = G.kills; $('ovHeads').textContent = G.heads; $('ovPts').textContent = G.stats.earned;
  $('ovDoors').textContent = G.stats.doors; $('ovBest').textContent = isBest ? 'New personal best on ' + DIFFS[G.diff].label + '!' : `Best on ${DIFFS[G.diff].label}: round ${best.round}`;
  $('ovTitle').textContent = G.round === 1 ? 'Didn\u2019t see the sunrise' : `You survived ${G.round - 1} round${G.round - 1 === 1 ? '' : 's'}`;
  show('over');
}

// ---------------- rendering ----------------
const hud = $('hud'), hx = hud.getContext('2d');
let HW = 1, HH = 1, HDPR = 1;
const _v = new THREE.Vector3();
let lastFov = 0;
function render(dt) {
  const s = gun() ? gs() : GUNS.m45;
  // camera
  const sp = Math.hypot(P.vx, P.vz);
  const bobY = Math.sin(P.bob * 2) * 0.035 * Math.min(1, sp / WALK) * (1 - P.ads * 0.8);
  let eye = EYE + bobY, roll = 0;
  if (P.down) { const k = Math.min(1, P.downT / 0.8); eye = EYE - k * 1.25; roll = k * 0.5; }
  camera.position.set(P.x, eye, P.z);
  const sh = fx.shake * 0.03; camera.rotation.set(P.pitch + P.kick * 0.25 + rnd(-sh, sh), P.yaw + rnd(-sh, sh), roll);
  const scoped = s.scope && P.ads > 0.92;
  const fov = scoped ? 18 : 72 - P.ads * (s.scope ? 30 : 17) + (P.sprint ? 4 : 0);
  if (Math.abs(fov - lastFov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); lastFov = fov; }
  // viewmodel
  const g = gun(); if (g) setViewGun(g.id, g.pap);
  const hip = [0.17, -0.2, -0.36], ads = [0, -s.sightY, -0.27];
  let vx = hip[0] + (ads[0] - hip[0]) * P.ads, vy = hip[1] + (ads[1] - hip[1]) * P.ads, vz = hip[2] + (ads[2] - hip[2]) * P.ads;
  const bw = (1 - P.ads * 0.9) * Math.min(1, sp / WALK);
  vx += Math.cos(P.bob) * 0.012 * bw; vy += Math.abs(Math.sin(P.bob)) * 0.012 * bw;
  vz += P.kick * 0.6; let rx = P.kick * 1.4, ry = 0, rz = 0;
  if (P.sprint) { const k = 1; vx += 0.02 * k; vy -= 0.05 * k; rx -= 0.25; ry += 0.75; rz += 0.2; }
  if (P.reloadT > 0) { const k = 1 - P.reloadT / P.reloadDur, e = Math.sin(k * Math.PI); rx -= 0.55 * e; rz += 0.35 * e; vy -= 0.06 * e; if (VM.gun.mag) VM.gun.mag.position.y = -Math.sin(Math.min(1, k * 2.2) * Math.PI) * 0.18; } else if (VM.gun && VM.gun.mag) VM.gun.mag.position.y = 0;
  if (P.swapT > 0) { const k = P.swapT / 0.6; vy -= Math.sin(Math.min(1, k) * Math.PI) * 0.35; }
  if (P.forgeT > 0) vy -= 0.6;
  if (P.knifeT > 0) vy -= 0.25;
  if (P.down) vy -= 0.5;
  if (VM.gun && VM.gun.slide) VM.gun.slide.position.z = -0.06 + Math.min(0.03, P.kick * 0.9);
  VM.grp.position.set(vx, vy, vz); VM.grp.rotation.set(rx, ry, rz); VM.grp.visible = !scoped && G.state !== 'title';
  VM.knife.visible = P.knifeT > 0; if (P.knifeT > 0) { const k = 1 - P.knifeT / 0.5, e = Math.sin(Math.min(1, k * 1.6) * Math.PI); VM.knife.position.set(0.2 - e * 0.25, -0.18 + e * 0.05, -0.32 - e * 0.18); VM.knife.rotation.set(-0.3, 0.4 + e * 0.9, -0.6 + e * 0.6); }
  G.flashT -= dt; if (G.flashT <= 0) { VM.flash.visible = false; muzzleLight.intensity = 0; }
  // world animation
  const t = G.t;
  for (const z of G.zs) { ensureRig(z); poseZombie(z, dt); }
  W.windows.forEach((w) => {
    const nOn = MP.S.boards[w.i];
    w.boards.forEach((b, k) => {
      const on = k < nOn;
      if (on && (b.state === 'off' || b.state === 'gone')) { b.state = 'in'; b.t = 0; b.m.visible = true; }
      if (!on && (b.state === 'on' || b.state === 'in')) { b.state = 'off'; b.t = 0; }
      if (b.state === 'in') { b.t += dt; const e = Math.min(1, b.t / 0.25); b.m.position.set(b.home.x - w.out[0] * (1 - e) * 1.2, b.home.y + (1 - e) * 0.4, b.home.z - w.out[1] * (1 - e) * 1.2); b.m.rotation.copy(b.rot); if (e >= 1) { b.state = 'on'; b.m.position.copy(b.home); } }
      if (b.state === 'off') { b.t += dt; const tt = b.t; b.m.position.set(b.home.x + w.out[0] * tt * 2.6, b.home.y + tt * 1.5 - tt * tt * 6, b.home.z + w.out[1] * tt * 2.6); b.m.rotation.set(b.rot.x + tt * 5, b.rot.y + tt * 2, b.rot.z + tt * 3); if (tt > 0.8) { b.state = 'gone'; b.m.visible = false; } }
    });
  });
  for (const d of W.doors) if (d.opening && d.open < 1) { d.open = Math.min(1, d.open + dt * 0.8); const e = 1 - (1 - d.open) * (1 - d.open); d.leafs[0].position.x = -0.5 - e * 1.0; d.leafs[1].position.x = 0.5 + e * 1.0; if (d.open >= 1) d.grp.visible = false; }
  for (const l of W.lamps) { if (l.l.intensity > 0) { const f = 0.88 + Math.sin(t * 13 + l.ph) * 0.05 + (Math.random() < 0.01 ? -0.5 : 0); l.l.intensity = l.I * f; } }
  // box
  const B = G.box, bx = W.box;
  bx.beam.visible = B.state !== 'leave' || B.t < 1.5; bx.beam.material.opacity = 0.12 + Math.sin(t * 2) * 0.04;
  const lidOpen = B.state === 'roll' || B.state === 'offer' || (B.state === 'leave' && B.t < 2);
  bx.lidPivot.rotation.x += ((lidOpen ? -1.9 : 0) - bx.lidPivot.rotation.x) * Math.min(1, dt * 8);
  bx.gun.clear();
  if (B.state === 'roll') { const ids = BOX_POOL.concat(['m45', 'farmhand']); const id = ids[Math.floor(B.t / (0.08 + B.t * 0.03)) % ids.length]; const m = boxModel(id); bx.gun.add(m); bx.gun.position.y = 0.6 + Math.min(1, B.t / 2) * 0.6; }
  else if (B.state === 'offer' || (B.state === 'leave' && B.t < 2.5)) { bx.gun.add(boxModel(B.gun)); bx.gun.position.y = 1.2 - (B.state === 'offer' ? Math.max(0, B.t - 2) / 8 * 0.6 : 0); }
  if (B.state === 'leave') { bx.grp.position.y = 0.14 + Math.max(0, B.t - 2.5) * 3; bx.grp.rotation.y += dt * (B.t > 2.5 ? 6 : 0); if (B.t > 4) bx.grp.visible = false; }
  bx.gun.rotation.y = B.state === 'roll' ? t * 3 : Math.sin(t) * 0.2;
  bx.light.intensity = 6 + Math.sin(t * 3) * 1.5;
  // forge
  const F = G.forge; W.forge.gun.clear();
  if (F.state === 'work' || F.state === 'offer') { W.forge.gun.add(boxModel(F.gun)); W.forge.gun.rotation.y = t * 1.5; if (F.state === 'work' && Math.random() < 0.4) { _v.set(0, 1.6, 0.6); W.forge.grp.localToWorld(_v); fx.sparks(_v.x, _v.y, _v.z, 2, [1, 0.7, 0.2], 4); } }
  if (G.power) { W.forge.light.intensity = 7 + Math.sin(t * 11) * 1.5 + Math.random(); W.forge.mouth.material.emissiveIntensity = 2.6 + Math.random() * 0.6; }
  for (const p of W.perks) if (G.perks.includes(p.p.id)) p.bulb.material.emissiveIntensity = 1;
  for (const d of G.drops) { d.m.position.y = 1 + Math.sin(t * 3 + d.x) * 0.15; d.m.material.opacity = d.t > 21 ? (Math.sin(d.t * 18) > 0 ? 1 : 0.15) : 1; d.m.material.rotation = Math.sin(t * 2) * 0.2; }
  for (const n of G.nades) n.m.position.set(n.x, n.y, n.z);
  for (const p of G.proj) { p.m.position.set(p.x, p.y, p.z); fx.add.emit({ x: p.x, y: p.y, z: p.z, life: 0.25, s0: 0.4, s1: 0.05, r: 0.5, g: 2, b: 0.5, a: 0.8 }); }
  if (W.corn.uni) for (const u of W.corn.uni) u.value = t;
  fx.update(dt);
  if (Q.bloom) composer.render(); else renderer.render(scene, camera);
  drawHud(dt, s, scoped);
}

// ---------------- HUD (2D canvas) ----------------
const pwIcons = {}; ['ammo', 'insta', 'double', 'nuke', 'carpenter'].forEach((k) => { pwIcons[k] = powerIcon(k); });
const perkCol = (id) => PERK_INFO[id].col;
function tally(x, y, n, h) {
  hx.save(); hx.strokeStyle = '#a3120e'; hx.lineCap = 'round'; hx.shadowColor = 'rgba(255,30,10,0.55)'; hx.shadowBlur = 14 * HDPR;
  if (n <= 5) {
    hx.lineWidth = h * 0.11;
    for (let i = 0; i < Math.min(4, n); i++) { const xx = x + i * h * 0.27; hx.beginPath(); hx.moveTo(xx + Math.sin(i * 7) * 3, y); hx.lineTo(xx - Math.sin(i * 3) * 3, y - h); hx.stroke(); }
    if (n === 5) { hx.beginPath(); hx.moveTo(x - h * 0.15, y - h * 0.15); hx.lineTo(x + h * 0.95, y - h * 0.82); hx.stroke(); }
  } else {
    hx.fillStyle = '#a3120e'; hx.font = `900 ${h * 1.25}px Georgia, 'Times New Roman', serif`; hx.textBaseline = 'alphabetic'; hx.fillText(String(n), x, y + h * 0.12);
  }
  hx.restore();
}
function drawHud(dt, s, scoped) {
  const w = HW, h = HH, d = HDPR; hx.clearRect(0, 0, w, h);
  if (G.state !== 'play') return;
  const u = Math.min(w, h * 1.6) / 1000; // ui unit
  // scope overlay
  if (scoped) {
    const r = h * 0.46; hx.save(); hx.fillStyle = '#000'; hx.beginPath(); hx.rect(0, 0, w, h); hx.arc(w / 2, h / 2, r, 0, 7, true); hx.fill('evenodd');
    hx.strokeStyle = 'rgba(0,0,0,0.9)'; hx.lineWidth = 2 * d; hx.beginPath(); hx.moveTo(w / 2 - r, h / 2); hx.lineTo(w / 2 + r, h / 2); hx.moveTo(w / 2, h / 2 - r); hx.lineTo(w / 2, h / 2 + r); hx.stroke();
    hx.fillStyle = '#ff3a2a'; hx.beginPath(); hx.arc(w / 2, h / 2, 2.5 * d, 0, 7); hx.fill(); hx.restore();
  }
  // damage vignette
  const hurt = clamp(1 - P.hp / P.max, 0, 1) * 0.9 + Math.max(0, P.hurtT) * 0.6;
  if (hurt > 0.02) { const gr = hx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85); gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(110,0,0,${Math.min(0.85, hurt)})`); hx.fillStyle = gr; hx.fillRect(0, 0, w, h); }
  if (P.hurtT > 0) { // direction arc
    const rel = P.lastDmgDir - P.yaw + Math.PI; hx.save(); hx.translate(w / 2, h / 2); hx.rotate(-rel); hx.strokeStyle = `rgba(220,30,20,${P.hurtT * 1.6})`; hx.lineWidth = 10 * d; hx.beginPath(); hx.arc(0, 0, h * 0.2, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35); hx.stroke(); hx.restore();
  }
  // crosshair
  if (!scoped && !P.down) {
    const moving = Math.hypot(P.vx, P.vz) / WALK; const gap = (6 + (s.spr * (1 + moving * 0.6) * (P.sprint ? 2 : 1) + P.recoil * 0.25) * 900) * (1 - P.ads * 0.85) * d * u * 1.2 + 3 * d;
    const a = (1 - P.ads) * (P.sprint ? 0.25 : 0.9);
    if (a > 0.05) { hx.strokeStyle = `rgba(240,240,230,${a})`; hx.lineWidth = 2 * d; hx.beginPath(); const L = 9 * d; hx.moveTo(w / 2 - gap - L, h / 2); hx.lineTo(w / 2 - gap, h / 2); hx.moveTo(w / 2 + gap, h / 2); hx.lineTo(w / 2 + gap + L, h / 2); hx.moveTo(w / 2, h / 2 - gap - L); hx.lineTo(w / 2, h / 2 - gap); hx.moveTo(w / 2, h / 2 + gap); hx.lineTo(w / 2, h / 2 + gap + L); hx.stroke(); }
    hx.fillStyle = 'rgba(240,240,230,0.8)'; hx.fillRect(w / 2 - d, h / 2 - d, 2 * d, 2 * d);
  }
  if (G.hitT > 0) { hx.strokeStyle = G.hitHead ? `rgba(255,70,50,${G.hitT * 5})` : `rgba(255,255,255,${G.hitT * 5})`; hx.lineWidth = 2.5 * d; const a = 6 * d, b = 14 * d; hx.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { hx.moveTo(w / 2 + sx * a, h / 2 + sy * a); hx.lineTo(w / 2 + sx * b, h / 2 + sy * b); } hx.stroke(); }
  hx.textBaseline = 'alphabetic';
  // round tally bottom-left
  const pulse = G.breakT > 0 ? (Math.sin(G.t * 6) > 0 ? 1 : 0.35) : 1;
  hx.globalAlpha = pulse; tally(34 * u * 1.4, h - 38 * u * 1.4, G.round, 74 * u * 1.4); hx.globalAlpha = 1;
  // perks row
  G.perks.forEach((id, i) => { const x = 36 * u * 1.4 + i * 44 * u * 1.4, y = h - 150 * u * 1.4, r = 17 * u * 1.4; hx.fillStyle = 'rgba(0,0,0,0.55)'; hx.beginPath(); hx.arc(x, y, r + 3 * d, 0, 7); hx.fill(); hx.fillStyle = perkCol(id); hx.shadowColor = perkCol(id); hx.shadowBlur = 12 * d; hx.beginPath(); hx.arc(x, y, r, 0, 7); hx.fill(); hx.shadowBlur = 0; hx.fillStyle = 'rgba(0,0,0,0.65)'; hx.font = `900 ${r * 1.0}px system-ui, sans-serif`; hx.textAlign = 'center'; hx.fillText(PERK_INFO[id].name.split(' ').map((q) => q[0]).join(''), x, y + r * 0.36); hx.textAlign = 'left'; });
  // points + weapon bottom-right
  const TB = isTouch ? 250 * u * 1.4 : h; const R = w - (isTouch ? 90 * d : 30 * u * 1.4), fs = (k) => `${k * u * 1.4}px`;
  hx.textAlign = 'right';
  hx.font = `800 ${fs(40)} system-ui, Segoe UI, sans-serif`; hx.fillStyle = '#f4e9c8'; hx.shadowColor = 'rgba(0,0,0,0.8)'; hx.shadowBlur = 8 * d;
  const ptsY = TB - 160 * u * 1.4; hx.fillText(G.points.toLocaleString(), R, ptsY);
  for (const p of G.popups) { hx.globalAlpha = 1 - p.t / 1.2; hx.font = `700 ${fs(22)} system-ui, sans-serif`; hx.fillStyle = p.n > 0 ? (G.dbl > 0 ? '#ffd24a' : '#e8dca0') : '#ff6a5a'; hx.fillText((p.n > 0 ? '+' : '') + p.n, R - 150 * u - p.off * u, ptsY - 30 * u * 1.4 - p.t * 60 * u * 1.4); }
  hx.globalAlpha = 1;
  const g = gun();
  if (g) {
    const name = g.pap ? GUNS[g.id].pap.name : GUNS[g.id].name;
    hx.font = `700 ${fs(18)} system-ui, sans-serif`; hx.fillStyle = g.pap ? '#9dff7a' : 'rgba(244,233,200,0.85)'; hx.fillText(name.toUpperCase(), R, TB - 98 * u * 1.4);
    hx.font = `800 ${fs(46)} system-ui, sans-serif`; const low = g.mag <= Math.ceil(s.mag * 0.25); hx.fillStyle = low ? '#ff5a4a' : '#f4e9c8';
    const resStr = ' / ' + g.res; hx.font = `600 ${fs(26)} system-ui, sans-serif`; const rw = hx.measureText(resStr).width; hx.fillStyle = 'rgba(244,233,200,0.6)'; hx.fillText(resStr, R, TB - 46 * u * 1.4);
    hx.font = `800 ${fs(46)} system-ui, sans-serif`; hx.fillStyle = low ? '#ff5a4a' : '#f4e9c8'; hx.fillText(String(g.mag), R - rw, TB - 46 * u * 1.4);
    // grenades
    for (let i = 0; i < 4; i++) { hx.fillStyle = i < P.nadeN ? '#9aa86a' : 'rgba(154,168,106,0.18)'; hx.beginPath(); hx.ellipse(R - i * 20 * u * 1.4 - 8 * u, TB - 128 * u * 1.4, 7 * u * 1.4, 9 * u * 1.4, 0, 0, 7); hx.fill(); }
    if (g.mag === 0 && g.res === 0 && P.guns.every((q) => q.mag + q.res === 0)) center('NO AMMO', '#ff5a4a', h * 0.62, 22);
    else if (g.mag === 0 && P.reloadT <= 0) center('RELOAD', '#ff5a4a', h * 0.6, 24);
    else if (g.mag <= Math.ceil(s.mag * 0.25) && P.reloadT <= 0 && g.res > 0) center('LOW AMMO', '#ffb04a', h * 0.6, 18);
  }
  hx.shadowBlur = 0;
  // power-up timers
  const act = []; if (G.insta > 0) act.push(['insta', G.insta]); if (G.dbl > 0) act.push(['double', G.dbl]);
  act.forEach(([k, tl], i) => { const sz = 54 * u * 1.4, x = w / 2 - (act.length * sz) / 2 + i * sz * 1.1; if (tl > 5 || Math.sin(G.t * 16) > 0) hx.drawImage(pwIcons[k], x, h - sz - 26 * u, sz, sz); });
  // use prompt
  if (G.use && !P.down) {
    hx.textAlign = 'center'; hx.font = `600 ${fs(19)} system-ui, sans-serif`;
    const txt = G.use.text + (G.use.cost ? `  [${G.use.cost}]` : ''); const tw = hx.measureText(txt).width;
    hx.fillStyle = 'rgba(8,10,12,0.6)'; roundRect(w / 2 - tw / 2 - 16 * d, h * 0.66 - 26 * u * 1.4, tw + 32 * d, 38 * u * 1.4, 8 * d); hx.fill();
    hx.fillStyle = G.use.cost && G.points < G.use.cost ? '#ff8a7a' : '#f4ecd2'; hx.fillText(txt, w / 2, h * 0.66);
    if (G.use.hold && inp.use) { hx.fillStyle = '#ffd36a'; hx.fillRect(w / 2 - 60 * d, h * 0.66 + 14 * u * 1.4, 120 * d * Math.min(1, P.useT / 0.5), 4 * d); }
  }
  if (msgT > 0) { hx.globalAlpha = Math.min(1, msgT * 2); center(msgText, '#f4ecd2', h * 0.73, 17); hx.globalAlpha = 1; }
  // banner
  if (G.banner) {
    const b = G.banner, a = Math.min(1, b.t * 3, (b.dur - b.t) * 2); hx.globalAlpha = Math.max(0, a); hx.textAlign = 'center';
    hx.font = `900 ${fs(56)} Georgia, 'Times New Roman', serif`; hx.fillStyle = '#d8241a'; hx.shadowColor = 'rgba(255,40,20,0.6)'; hx.shadowBlur = 20 * d; hx.fillText(b.main, w / 2, h * 0.27); hx.shadowBlur = 0;
    if (b.sub) { hx.font = `500 ${fs(19)} system-ui, sans-serif`; hx.fillStyle = '#f4ecd2'; hx.fillText(b.sub, w / 2, h * 0.27 + 38 * u * 1.4); }
    hx.globalAlpha = 1;
  }
  // stamina
  if (P.stam < 0.99) { hx.fillStyle = 'rgba(0,0,0,0.4)'; hx.fillRect(w / 2 - 60 * d, h - 16 * d, 120 * d, 4 * d); hx.fillStyle = P.stam < 0.2 ? '#ff7a5a' : '#c8ff3a'; hx.fillRect(w / 2 - 60 * d, h - 16 * d, 120 * d * P.stam, 4 * d); }
  if (P.down) { hx.fillStyle = `rgba(30,0,0,${Math.min(0.7, P.downT * 0.4)})`; hx.fillRect(0, 0, w, h); center('YOU\u2019RE DOWN', '#ff3a2a', h * 0.45, 46); }
  // zombies-left hint during round break
  if (G.breakT > 0 && !G.banner) center(`Round ${G.round + 1} in ${Math.ceil(G.breakT)}`, 'rgba(244,236,210,0.75)', h * 0.18, 18);
  hx.textAlign = 'left';
}
function center(t, col, y, size) { hx.textAlign = 'center'; hx.font = `800 ${size * Math.min(HW, HH * 1.6) / 1000 * 1.4}px system-ui, sans-serif`; hx.fillStyle = col; hx.shadowColor = 'rgba(0,0,0,0.8)'; hx.shadowBlur = 8 * HDPR; hx.fillText(t, HW / 2, y); hx.shadowBlur = 0; }
function roundRect(x, y, w, h, r) { hx.beginPath(); hx.moveTo(x + r, y); hx.arcTo(x + w, y, x + w, y + h, r); hx.arcTo(x + w, y + h, x, y + h, r); hx.arcTo(x, y + h, x, y, r); hx.arcTo(x, y, x + w, y, r); hx.closePath(); }

// ---------------- input ----------------
const keys = {};
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function setKeyInputs() {
  if (G.botOn) return;
  inp.mz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + (touch.mz || 0) + (pad.mz || 0);
  inp.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + (touch.mx || 0) + (pad.mx || 0);
  inp.mz = clamp(inp.mz, -1, 1); inp.mx = clamp(inp.mx, -1, 1);
  inp.sprint = !!(keys.ShiftLeft || keys.ShiftRight || touch.sprint || pad.sprint || (touch.mz > 0.92));
  inp.use = !!(keys.KeyE || touch.use || pad.use);
  inp.fire = !!(mouse.l || touch.fire || pad.fire); inp.ads = !!(mouse.r || touch.ads || pad.ads);
  inp.lx = pad.lx || 0; inp.ly = pad.ly || 0;
}
const mouse = { l: false, r: false };
const KEYMAP = { KeyR: 'reload', KeyE: 'use', KeyV: 'knife', KeyF: 'knife', KeyG: 'nade', KeyQ: 'swap' };
addEventListener('keydown', (e) => {
  if (e.repeat) { if (e.code in KEYMAP || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); return; }
  keys[e.code] = true; if (KEYMAP[e.code]) pressed.add(KEYMAP[e.code]);
  if (e.code === 'Digit1') inp.slot = 0; if (e.code === 'Digit2') inp.slot = 1;
  if (e.code === 'KeyM') toggleSound();
  if ((e.code === 'KeyP' || e.code === 'Escape') && G.state === 'play') pauseGame();
  else if (e.code === 'KeyP' && G.state === 'pause') resume();
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousedown', (e) => {
  if (G.state !== 'play') return;
  if (!document.pointerLockElement && !isTouch) { lockPointer(); return; }
  if (e.button === 0) { mouse.l = true; pressed.add('fire'); } if (e.button === 2) mouse.r = true; if (e.button === 1) { pressed.add('knife'); e.preventDefault(); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (G.state !== 'play' || !document.pointerLockElement) return;
  const k = 0.0022 * G.sens * (P.ads > 0.5 ? (gs().scope ? 0.35 : 0.7) : 1);
  P.yaw -= e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k, -1.45, 1.45);
});
addEventListener('wheel', (e) => { if (G.state === 'play' && P.guns.length > 1) pressed.add('swap'); }, { passive: true });
function lockPointer() { if (isTouch) return; try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => canvas.requestPointerLock()); } catch { canvas.requestPointerLock(); } }
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.state === 'play' && !isTouch && !G.botOn) pauseGame(); });

// gamepad
const pad = {}; let padPrev = [];
function pollPad() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((q) => q && q.connected) : null;
  for (const k of Object.keys(pad)) delete pad[k];
  if (!gp) return;
  const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
  pad.mx = dz(gp.axes[0]); pad.mz = -dz(gp.axes[1]); pad.lx = dz(gp.axes[2]) * 1.0; pad.ly = dz(gp.axes[3]);
  const b = (i) => gp.buttons[i] && gp.buttons[i].pressed, was = (i) => padPrev[i];
  pad.fire = b(7); pad.ads = b(6); pad.sprint = b(10); pad.use = b(2);
  if (pad.ads) { pad.lx *= 0.55; pad.ly *= 0.55; }
  if (b(7) && !was(7)) pressed.add('fire'); if (b(2) && !was(2)) { pressed.add('use'); pressed.add('reload'); }
  if (b(3) && !was(3)) pressed.add('swap'); if (b(5) && !was(5)) pressed.add('nade'); if (b(11) && !was(11) || b(1) && !was(1)) pressed.add('knife');
  if (b(9) && !was(9)) { if (G.state === 'play') pauseGame(); else if (G.state === 'pause') resume(); else if (G.state === 'title' || G.state === 'over') startGame(); }
  padPrev = gp.buttons.map((q) => q.pressed);
}

// touch
const touch = {};
function setupTouch() {
  if (!isTouch) return; document.body.classList.add('touch');
  const stick = $('tStick'), knob = $('tKnob'); let sid = null, sx = 0, sy = 0; let lid = null, lx = 0, ly = 0;
  stick.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sid = t.identifier; sx = t.clientX; sy = t.clientY; e.preventDefault(); }, { passive: false });
  const look = $('tLook');
  look.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; lid = t.identifier; lx = t.clientX; ly = t.clientY; e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === sid) { const dx = t.clientX - sx, dy = t.clientY - sy, r = 50, l = Math.hypot(dx, dy), k = l > r ? r / l : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; touch.mx = clamp(dx / r, -1, 1); touch.mz = clamp(-dy / r, -1, 1); }
      if (t.identifier === lid) { const k = 0.006 * G.sens * (P.ads > 0.5 ? 0.6 : 1); P.yaw -= (t.clientX - lx) * k; P.pitch = clamp(P.pitch - (t.clientY - ly) * k, -1.45, 1.45); lx = t.clientX; ly = t.clientY; }
    }
  }, { passive: false });
  addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; touch.mx = touch.mz = 0; knob.style.transform = ''; } if (t.identifier === lid) lid = null; } });
  const btn = (id, on, off) => { const el = $(id); el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); on(); el.classList.add('on'); }, { passive: false }); el.addEventListener('touchend', (e) => { e.preventDefault(); off && off(); el.classList.remove('on'); }, { passive: false }); };
  btn('tFire', () => { touch.fire = true; pressed.add('fire'); }, () => { touch.fire = false; });
  btn('tAds', () => { touch.ads = !touch.ads; });
  btn('tReload', () => pressed.add('reload'));
  btn('tUse', () => { touch.use = true; pressed.add('use'); }, () => { touch.use = false; });
  btn('tKnife', () => pressed.add('knife'));
  btn('tNade', () => pressed.add('nade'));
  btn('tSwap', () => pressed.add('swap'));
  btn('tPause', () => pauseGame());
}

// ---------------- screens ----------------
function show(id) { for (const s of ['title', 'pause', 'over', 'how']) $(s).classList.toggle('hidden', s !== id); $('touchUI').classList.toggle('hidden', !(isTouch && G.state === 'play')); }
function startGame() {
  audio.init(); audio.startMusic(); newGame(); G.state = 'play'; show(null); lockPointer();
}
function pauseGame() { if (G.state !== 'play') return; G.state = 'pause'; show('pause'); mouse.l = mouse.r = false; if (document.pointerLockElement) document.exitPointerLock(); }
function resume() { G.state = 'play'; show(null); lockPointer(); }
function toTitle() { G.state = 'title'; show('title'); syncLabels(); }
function toggleSound() { audio.init(); audio.setEnabled(!audio.enabled); syncLabels(); }
function syncLabels() {
  document.querySelectorAll('.sndLbl').forEach((e) => (e.textContent = audio.enabled ? 'On' : 'Off'));
  document.querySelectorAll('.musLbl').forEach((e) => (e.textContent = audio.music ? 'On' : 'Off'));
  document.querySelectorAll('.qualLbl').forEach((e) => (e.textContent = QUALITY[qKey].label));
  document.querySelectorAll('#diffSel button').forEach((b) => b.classList.toggle('sel', b.dataset.d === G.diff));
  const b = bestOf(); $('bestTitle').textContent = b.round ? `Best on ${DIFFS[G.diff].label}: round ${b.round} \u00b7 ${b.kills} kills` : `No ${DIFFS[G.diff].label} record yet`;
  $('sens').value = G.sens; $('sensVal').textContent = G.sens.toFixed(2);
}
document.querySelectorAll('#diffSel button').forEach((b) => b.addEventListener('click', () => { G.diff = b.dataset.d; localStorage.setItem('da_diff', G.diff); audio.init(); audio.play('click'); syncLabels(); }));
$('btnStart').addEventListener('click', startGame);
$('btnResume').addEventListener('click', resume);
$('btnRestart').addEventListener('click', startGame);
$('btnQuit').addEventListener('click', () => { audio.stopMusic(); toTitle(); });
$('btnAgain').addEventListener('click', startGame);
$('btnMenu').addEventListener('click', toTitle);
let howFrom = 'title';
for (const id of ['btnHow', 'btnHowP']) $(id).addEventListener('click', () => { howFrom = G.state === 'pause' ? 'pause' : 'title'; show('how'); });
$('btnHowClose').addEventListener('click', () => show(howFrom));
document.querySelectorAll('.btnSnd').forEach((b) => b.addEventListener('click', toggleSound));
document.querySelectorAll('.btnMus').forEach((b) => b.addEventListener('click', () => { audio.init(); audio.setMusic(!audio.music); syncLabels(); }));
document.querySelectorAll('.btnQual').forEach((b) => b.addEventListener('click', () => { localStorage.setItem('da_quality', qKey === 'high' ? 'low' : 'high'); location.reload(); }));
$('sens').addEventListener('input', (e) => { G.sens = +e.target.value; localStorage.setItem('da_sens', G.sens); $('sensVal').textContent = G.sens.toFixed(2); });

// ---------------- loop ----------------
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  HDPR = Math.min(2, devicePixelRatio || 1); HW = hud.width = Math.round(w * HDPR); HH = hud.height = Math.round(h * HDPR); hud.style.width = w + 'px'; hud.style.height = h + 'px';
}
addEventListener('resize', resize); resize();
const STEP = 1 / 60; let acc = 0, last = performance.now();
function frame(now) {
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  pollPad(); setKeyInputs();
  if (G.state === 'play') { acc += real; let n = 0; while (acc >= STEP && n < 6) { step(STEP); acc -= STEP; n++; } if (n === 6) acc = 0; }
  else { attract(real); }
  render(real);
  requestAnimationFrame(frame);
}
// title-screen camera: slow orbit of the farmstead at night
let attractT = 0;
function attract(dt) {
  if (G.state !== 'title') return; attractT += dt * 0.05;
  P.x = 50 + Math.cos(attractT) * 1.5; P.z = 46 + Math.sin(attractT) * 1.5; P.yaw = 0.9 + Math.sin(attractT * 0.7) * 0.35; P.pitch = 0.12;
}
// initial world state for the title screen
G.box = { spot: 0, uses: 0, limit: 6, state: 'idle', t: 0 }; placeBox(0); G.forge = { state: 'idle' };
P.guns = [{ id: 'm45', pap: false, mag: 8, res: 72 }]; setViewGun('m45', false);
P.x = 51.5; P.z = 46; P.yaw = 0.9; P.pitch = 0.12;
syncLabels(); setupTouch(); show('title');
if (!MANUAL) requestAnimationFrame(frame);

// ---------------- test hooks ----------------
window.__ZS = {
  G, P, inp, MP, pressed, DIFFS,
  start(diff) { if (diff) G.diff = diff; newGame(); G.state = 'play'; show(null); },
  step(n = 1) { for (let i = 0; i < n; i++) { step(STEP); } },
  render(dt = 1 / 60) { G.renderOn = true; render(dt); },
  give(id, pap) { giveGun(id, pap); P.swapT = 0; },
  setRound(r) { startRound(r); },
  spawn(type) { return spawnZombie(type); },
  poll() { pollPad(); setKeyInputs(); }, power: () => powerOn(), openDoor, takePower, dropPower, findUse, gameOver, fire, roundHP, roundCount, hurtZombie,
};
