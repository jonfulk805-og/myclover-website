// BAR BRAWL: Last Call - main game: renderer, player, combat, waves, HUD, menus.
import * as THREE from 'three';
import { clamp, lerp, rand, randi, pick, chance, angDiff, approach, circleBox } from './util.js';
import { World, VENUES, ROOM } from './world.js';
import { Fighter, TYPES, bark } from './fighter.js';
import { Prop, PD, propMesh } from './props.js';
import { FX } from './fx.js';
import { updateAI, makeHostile, startFlee, setState } from './ai.js';
import * as AU from './audio.js';

const MANUAL = location.search.includes('manual');
const $ = id => document.getElementById(id);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

// ---------------------------------------------------------------- save
const SAVE_KEY = 'bb_save_v1';
const save = Object.assign({ stars: {}, best: {}, endlessBest: 0, settings: { sens: 1, mus: 0.5, sfx: 0.9, inv: false, lowq: false, calm: false }, diff: 1 }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
save.settings = Object.assign({ sens: 1, mus: 0.5, sfx: 0.9, inv: false, lowq: false, calm: false }, save.settings);
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }

const DIFFS = [
  { name: 'Tipsy', dmg: 0.5, hp: 0.85, wind: 1.3, cd: 1.4, maxAtk: 1, gap: 1.0 },
  { name: 'Rowdy', dmg: 0.7, hp: 1.0, wind: 1.05, cd: 1.15, maxAtk: 2, gap: 0.6 },
  { name: 'Hammered', dmg: 1.3, hp: 1.25, wind: 0.85, cd: 0.85, maxAtk: 3, gap: 0.35 },
];

// ---------------------------------------------------------------- renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = !save.settings.lowq; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(76, 16 / 9, 0.05, 60); camera.rotation.order = 'YXZ';
const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(70, 16 / 9, 0.01, 10);
vmScene.add(new THREE.HemisphereLight(0xffe0c0, 0x201008, 1.4)); const vmKey = new THREE.DirectionalLight(0xffc890, 2.2); vmKey.position.set(0.5, 1, 0.6); vmScene.add(vmKey);
function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, save.settings.lowq ? 1 : 1.75);
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = vmCam.aspect = w / h; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
// cheap environment map for chrome/brass reflections
function makeEnv(color) {
  const es = new THREE.Scene(); es.background = new THREE.Color(0x0a0604);
  const bm = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.2), new THREE.MeshBasicMaterial({ color: i % 2 ? color : 0xffffff })); m.position.set(Math.cos(i) * 4, 2 + (i % 3), Math.sin(i) * 4); m.lookAt(0, 0, 0); es.add(m); }
  const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(es, 0.04).texture; pm.dispose(); return t;
}

// ---------------------------------------------------------------- game state
const G = window.G = {
  mode: 'loading', fighters: [], props: [], world: null, fx: new FX(scene), t: 0, venueIdx: 0, diff: save.diff ?? 1, diffCfg: DIFFS[1], endless: false,
  chaos: false, waveIdx: 0, waveDelay: 0, spawnQ: [], score: 0, tab: 0, kos: 0, combo: 0, comboT: 0, bestCombo: 0, styles: 0, timeT: 0, shakeA: 0, hitStop: 0, boss: null, provokeT: 25, ended: false, endT: 0,
  player: null, keys: {}, mouse: { L: false, R: false }, pressed: new Set(), look: { x: 0, y: 0 }, stats: {},
};
function newPlayer() {
  return { x: 0, z: 4.2, yaw: 0, pitch: -0.05, vx: 0, vz: 0, hp: 100, buzz: 10, stam: 100, jumpY: 0, jumpV: 0, block: false, blockT: 0, dead: false, deadT: 0, stunT: 0, bob: 0, hurtT: 0, kickT: -1, drinkT: -1, roll: 0,
    fist: { L: { st: 'idle', t: 0, ch: 0 }, R: { st: 'idle', t: 0, ch: 0 } }, swing: { st: 'idle', t: 0, ch: 0 }, throwCh: -1, held: null, grabbed: null, charging: false, focus: null, lastHand: null };
}

// ---------------------------------------------------------------- viewmodel
const VM = (() => {
  const g = new THREE.Group(); vmScene.add(g);
  const skin = new THREE.MeshStandardMaterial({ color: '#e6b48f', roughness: 0.55 });
  const sleeveTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#1c5a2e'; x.fillRect(0, 0, 64, 64); x.globalAlpha = .5; x.fillStyle = '#0c2a14'; for (let i = 0; i < 64; i += 16) { x.fillRect(i, 0, 6, 64); x.fillRect(0, i, 64, 6); } x.globalAlpha = .35; x.fillStyle = '#d4a63c'; for (let i = 8; i < 64; i += 16) { x.fillRect(i, 0, 2, 64); x.fillRect(0, i, 64, 2); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t; })();
  const sleeve = new THREE.MeshStandardMaterial({ map: sleeveTex, roughness: 0.85 });
  const tape = new THREE.MeshStandardMaterial({ color: '#efe8d8', roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcc55', metalness: 1, roughness: 0.25, emissive: '#3a2400' });
  const mkFist = (side) => {
    const f = new THREE.Group(), arm = new THREE.Group(); f.add(arm);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.42, 14), sleeve); fore.rotation.x = Math.PI / 2; fore.position.z = 0.25; arm.add(fore);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14), tape); cuff.rotation.x = Math.PI / 2; cuff.position.z = 0.06; arm.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 18, 14), skin); hand.scale.set(1, 0.85, 1.1); arm.add(hand);
    for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), skin); k.position.set(-0.042 + i * 0.028, 0.03, -0.055); arm.add(k); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.022, 10), tape); w.rotation.z = Math.PI / 2; w.position.set(-0.042 + i * 0.028, 0.012, -0.05); arm.add(w); }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.04, 4, 8), skin); thumb.position.set(side * -0.05, -0.015, -0.03); thumb.rotation.z = Math.PI / 2; arm.add(thumb);
    if (side > 0) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.006, 6, 14), gold); ring.position.set(-0.014, 0.024, -0.04); ring.rotation.y = Math.PI / 2; arm.add(ring); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.009), new THREE.MeshStandardMaterial({ color: '#3cff8a', emissive: '#1a8a3a', metalness: .5, roughness: .1 })); gem.position.set(-0.014, 0.046, -0.04); arm.add(gem); }
    g.add(f); return f;
  };
  const L = mkFist(-1), R = mkFist(1); L.scale.setScalar(0.82); R.scale.setScalar(0.82);
  const holder = new THREE.Group(); R.add(holder);
  let heldMesh = null, heldType = null;
  return {
    g, L, R, holder, skin,
    setHeld(type, opts) {
      if (heldType === type && heldMesh) return; if (heldMesh) holder.remove(heldMesh); heldMesh = null; heldType = type; if (!type) return;
      heldMesh = propMesh(type, opts); const D = PD[type];
      heldMesh.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
      holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); heldMesh.position.set(0, 0, 0); heldMesh.rotation.set(0, 0, 0); heldMesh.scale.setScalar(1);
      if (D.long) { const dir = new THREE.Vector3(-0.15, 0.55, -0.82).normalize(), len = { cue: 1.45, plank: 0.9, leg: 0.72, halfcue: 0.7 }[type] || 0.8; heldMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir); heldMesh.position.copy(dir).multiplyScalar(len * 0.35); }
      else if (type === 'stool' || type === 'chair') { heldMesh.scale.setScalar(0.8); heldMesh.rotation.set(-1.1, 0.4, 0); heldMesh.position.set(-0.18, -0.02, -0.35); }
      else if (type === 'guitar') { heldMesh.rotation.set(Math.PI * 0.8, 0.3, 0); heldMesh.position.set(-0.05, 0.15, -0.35); }
      else if (D.heavy) { heldMesh.scale.setScalar(0.65); heldMesh.position.set(-0.22, -0.12, -0.25); }
      else if (type === 'extinguisher') { heldMesh.scale.setScalar(0.8); heldMesh.rotation.set(-0.9, 0, 0); heldMesh.position.set(0, -0.02, -0.12); }
      else if (type === 'bottle' || type === 'broken') { heldMesh.rotation.set(Math.PI * 0.9, 0, 0); heldMesh.position.set(0, 0.06, -0.02); }
      else { heldMesh.position.set(0, 0.03, -0.03); }
      holder.add(heldMesh);
    },
    get heldType() { return heldType; },
  };
})();

// ---------------------------------------------------------------- spawning
function addProp(type, x, y, z, opts = {}) {
  const p = new Prop(type, x, y, z, opts); scene.add(p.mesh); G.props.push(p);
  // rest on whatever surface is below
  if (opts.rest && y > 0.1) for (const b of G.world?.boxes || []) if (!b.wall && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && Math.abs(b.y1 - y) < 0.05) p.support = b;
  return p;
}
function removeProp(p) { p.dead = true; scene.remove(p.mesh); const i = G.props.indexOf(p); if (i >= 0) G.props.splice(i, 1); if (G.player && G.player.held === p) { G.player.held = null; VM.setHeld(null); } if (p.owner && p.owner.held === p) p.owner.held = null; }
function addFighter(type, opts) {
  const f = new Fighter(type, { hpMul: G.diffCfg.hp * (opts.hpMul || 1), ...opts }); scene.add(f.group); G.fighters.push(f);
  f.mats.fist = f.mats.skin.clone(); for (const [i, r, m] of f.joints) if (i === 5 || i === 8) m.material = f.mats.fist;
  return f;
}
G.removeFighter = f => { f.gone = true; scene.remove(f.group); if (f.held) { f.held.owner = null; f.held.state = 'fly'; f.held = null; } };
G.sound = (n, v) => AU.sfx(n, v);
G.shake = a => { G.shakeA = Math.max(G.shakeA, a * (save.settings.calm ? 0.4 : 1)); };

const hooks = {
  spawnProp: (type, x, y, z, opts) => addProp(type, x, y, z, opts),
  tab: (v, label, pos) => addTab(v, label, pos),
  sound: (n, v) => AU.sfx(n, v),
  dropFrom: b => { for (const p of G.props) if (p.state === 'rest' && (p.support === b || (p.pos.x > b.x0 - .1 && p.pos.x < b.x1 + .1 && p.pos.z > b.z0 - .1 && p.pos.z < b.z1 + .1 && p.pos.y > b.y1 - .05 && p.pos.y < b.y1 + .6))) { p.state = 'fly'; p.vel.set(rand(-1, 1), 1, rand(-1, 1)); p.ang.set(rand(-5, 5), 0, rand(-5, 5)); } for (const f of G.fighters) if (f.seat && f.seat.table === b && f.sit) { makeHostile(G, f, G.player); } },
  jukeboxDead: () => { AU.stopMusic(); addStyle('MUSIC CRITIC', 150); setTimeout(() => { if (G.mode === 'play') AU.playMusic(G.world.V.music); }, 9000); },
};

// ---------------------------------------------------------------- venue setup
function clearAll() {
  for (const f of G.fighters) scene.remove(f.group); for (const p of G.props) scene.remove(p.mesh);
  G.fighters = []; G.props = []; G.fx.clear(); if (G.world) G.world.dispose(); G.world = null; G.boss = null; stompRing.visible = false;
}
function loadVenue(vi) {
  clearAll(); G.venueIdx = vi; const V = VENUES[vi];
  G.world = new World(scene, V, hooks);
  scene.environment = makeEnv(V.light);
  vmKey.color.set(V.light); renderer.shadowMap.enabled = !save.settings.lowq; G.world.key.castShadow = !save.settings.lowq;
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
}
function placePatrons(types) {
  const W = G.world, seats = W.seats.slice().sort(() => Math.random() - 0.5), stands = W.stands.slice().sort(() => Math.random() - 0.5);
  for (const t of types) {
    const useSeat = seats.length && (chance(0.55) || !stands.length);
    if (useSeat) { const s = seats.pop(); const f = addFighter(t, { x: s.x, z: s.z, yaw: s.yaw, sit: true, seatH: s.h, state: 'sitidle' }); f.seat = s; f.pose(0); for (let i = 0; i < 15; i++) { f.last[i].copy(f.pts[i]); f.prev[i].copy(f.pts[i]); } }
    else if (stands.length) { const s = stands.pop(); const f = addFighter(t, { x: s.x, z: s.z, yaw: rand(0, 6.28), dance: !!s.dance, state: 'idle' }); }
  }
}
function startVenue(vi, diff, endless = false) {
  AU.initAudio();
  G.diff = diff; G.diffCfg = DIFFS[diff]; G.endless = endless; save.diff = diff; persist();
  loadVenue(vi); const V = VENUES[vi];
  G.player = newPlayer(); VM.setHeld(null);
  Object.assign(G, { chaos: false, waveIdx: 0, waveDelay: 0, spawnQ: [], score: 0, tab: 0, kos: 0, combo: 0, comboT: 0, bestCombo: 0, styles: 0, timeT: 0, ended: false, endT: 0, provokeT: endless ? 8 : 22, hpScale: 1, lastAtk: -9, win: false, tabLog: {}, dmgBy: {} });
  G.stats = { punches: 0, hits: 0, thrown: 0, drinks: 0, yeets: 0, broken: 0 };
  placePatrons(V.patrons.slice(0, endless ? 7 : V.patrons.length).concat(endless ? ['bouncer'] : []));
  G.mode = 'play'; showScreen(null); $('hud').classList.remove('hidden'); if (isTouch) $('touch').classList.remove('hidden');
  $('vname').textContent = V.name; setWave(endless ? 'Endless Last Call - survive as long as you can' : 'Grab a drink... or start something.');
  banner(V.name.toUpperCase(), endless ? 'ENDLESS LAST CALL' : `${V.sub.toUpperCase()}  -  ${DIFFS[diff].name.toUpperCase()}`, 2.6);
  AU.playMusic(V.music); AU.sfx('door');
  $('hint').innerHTML = isTouch ? '' : '<kbd>LMB</kbd>/<kbd>RMB</kbd> punch (hold = haymaker) &nbsp; <kbd>E</kbd> grab / drink &nbsp; <kbd>Q</kbd> block &nbsp; <kbd>F</kbd> kick &nbsp; <kbd>G</kbd> drop';
  $('hint').style.opacity = 1; setTimeout(() => $('hint').style.opacity = 0, 14000);
  $('boss').classList.add('hidden');
  if (!MANUAL && !isTouch) lockPointer();
}

// ---------------------------------------------------------------- scoring / feed
function feed(txt, cls = '') { const d = document.createElement('div'); d.className = cls; d.textContent = txt; const f = $('feed'); f.appendChild(d); while (f.children.length > 6) f.firstChild.remove(); setTimeout(() => d.remove(), 2700); }
function addTab(v, label, pos) { if (!v) return; G.tab += v; (G.tabLog = G.tabLog || {})[label] = (G.tabLog[label] || 0) + v; G.stats.broken++; feed(`+$${v}  ${label}`, 'money'); if (pos) G.fx.text(_v.copy(pos).setY(Math.max(pos.y, 0.8) + 0.4), `$${v}`, '#3cff8a', 0.7); markChaos(); }
function addStyle(name, pts) { G.styles++; const m = comboMul(); G.score += Math.round(pts * m); feed(`${name}  +${Math.round(pts * m)}`, 'style'); }
function comboMul() { return 1 + Math.min(G.combo, 20) * 0.1; }
function addCombo() { G.combo = G.comboT > 0 ? G.combo + 1 : 1; G.comboT = 1.8; G.bestCombo = Math.max(G.bestCombo, G.combo); if (G.combo >= 3 && G.combo % 5 === 0) AU.sfx('combo'); }
function markChaos() { if (!G.chaos) { G.chaos = true; G.provokeT = 99; setWave('BAR FIGHT!'); AU.sfx('ooh'); for (const f of G.fighters) if (!f.hostile && f.alive) f.react = rand(0.3, 3.2); } }
function setWave(t) { $('wave').textContent = t; }
let bannerT = 0;
function banner(a, b = '', dur = 2, boss = false) { const el = $('banner'); el.querySelector('.b1').textContent = a; el.querySelector('.b2').textContent = b; el.classList.add('on'); el.classList.toggle('boss', boss); bannerT = dur; }

// ---------------------------------------------------------------- combat
G.telegraph = (f, k) => { f.mats.fist.emissive.setRGB(k * 1.6, k * 0.15, 0); f.teleK = k; };
G.hitFighter = hitFighter;
function hitFighter(f, dmg, dir, part = 1, o = {}) {
  if (f.gone || f.state === 'grabbed' && !o.allowGrabbed) return false;
  const byPlayer = o.by === G.player;
  const head = part === 2; let d = dmg * (head ? 1.4 : 1);
  if (f.ko) { // beating on a KO'd body
    f.goRagdoll(_v2.copy(dir).multiplyScalar(2 + dmg * 0.15).add(_v3.set(0, 1.5, 0)), part); if (byPlayer) { G.score += 5; AU.sfx('smack', 0.5); } return true;
  }
  if (f.state === 'enter') { d *= 0.2; }
  // blocking?
  if (f.state === 'block' && !o.knock && !f.rag) { const ang = Math.abs(angDiff(f.yaw, Math.atan2(-dir.x, -dir.z))); if (ang < 1.2) { d *= 0.25; AU.sfx('block', 0.8); G.fx.text(f.pts[2].clone().setY(f.pts[2].y + 0.3), 'BLOCKED', '#9adfff', 0.6, 0.6); if (byPlayer && o.charge > 0.6) { setState(f, 'stagger'); f.stagT = 0.5; } } }
  f.hp -= d; f.lastHitBy = o.by || null; { const k = byPlayer ? (o.prop ? 'p_' + o.prop.type : o.power === 9 ? 'kick' : 'fist') : o.by ? 'npc' : 'other'; G.dmgBy[k] = (G.dmgBy[k] || 0) + Math.round(d); }
  if (o.by && o.by !== f) { if (byPlayer) { markChaos(); makeHostile(G, f, G.player, 'hit'); } else { makeHostile(G, f, o.by, 'hit'); } }
  if (byPlayer) { G.score += Math.round(d * 3 * comboMul()); }
  // witnesses get involved
  if (byPlayer) for (const w of G.fighters) if (!w.hostile && w.alive && !w.flee && w !== f && Math.hypot(w.x - f.x, w.z - f.z) < 4 && chance(0.5)) makeHostile(G, w, G.player);
  const pos = f.pts[part].clone();
  G.fx.splash(pos, head ? 8 : 4, '#f4f0e8');
  if (head && d > 14 && chance(0.35)) G.fx.tooth(pos, dir);
  const power = o.power || (3 + d * 0.22);
  if (f.hp <= 0) { koFighter(f, dir, power, o); return true; }
  const knock = o.knock || d >= f.T.poise * (f.dazed > 0 ? 0.5 : 1);
  if (knock) {
    f.goRagdoll(_v2.copy(dir).multiplyScalar(power * 1.2).add(_v3.set(0, 1.8 + power * 0.15, 0)), part); setState(f, 'down'); f.downT = rand(1.4, 2.4); f.setMood('dazed');
    if (f.held) { const h = f.held; f.held = null; h.owner = null; h.throwIt(new THREE.Vector3(rand(-1, 1), 2, rand(-1, 1)), null); }
    if (chance(0.4)) G.fx.bubble(f, bark('hit'), 1.2);
  } else if (!f.rag) {
    f.vx += dir.x * power * 0.9; f.vz += dir.z * power * 0.9;
    if (f.T.boss ? d >= 16 && f.state !== 'charge' : true) { setState(f, 'stagger'); f.stagT = head ? 0.45 : 0.3; f.punchR = f.punchL = 0; }
    f.lean = -0.4;
    if (head && d >= 11 && !f.T.boss) { f.dazed = 1.6; G.fx.dizzy(f, 1.6); f.setMood('dazed'); }
    else f.setMood('angry');
    if (chance(0.15)) G.fx.bubble(f, bark('hit'), 1.0);
  } else { f.impulse(_v2.copy(dir).multiplyScalar(power), part); }
  if (f.T.boss) updateBossBar();
  return true;
}
function koFighter(f, dir, power, o) {
  f.ko = true; f.alive = false; f.hp = 0; f.setMood('ko'); f.state = 'ko'; f.koAt = G.timeT;
  f.goRagdoll(_v2.copy(dir).multiplyScalar(power * 0.95 + 1.5).add(_v3.set(0, 2.2 + power * 0.15, 0)), 2);
  if (f.held) { const h = f.held; f.held = null; h.owner = null; h.throwIt(new THREE.Vector3(rand(-1, 1), 2, rand(-1, 1)), null); }
  G.fx.dizzy(f, 6); AU.sfx('ko', 0.8); AU.sfx('ooh', 0.6);
  if (chance(0.3)) G.fx.bubble(f, bark('ko'), 1.6);
  const byPlayer = o.by === G.player || o.creditPlayer;
  if (byPlayer || G.chaos) { G.kos++; G.score += Math.round((f.T.boss ? 2000 : 200) * comboMul()); }
  G.fx.text(f.pts[2].clone().setY(f.pts[2].y + 0.5), f.T.boss ? 'LAST CALL!' : 'KO!', '#ff5a3a', f.T.boss ? 1.5 : 1, 1.4);
  if (o.prop) { const t = o.prop.type; if (t === 'bottle' || t === 'broken') addStyle('BOTTLE SERVICE', 150); else if (t === 'cue' || t === 'guitar' || t === 'halfcue') addStyle(t === 'guitar' ? 'ROCK STAR' : 'HOME RUN', 200); else if (t === 'stool' || t === 'chair') addStyle('HAVE A SEAT', 150); else if (t === 'keg' || t === 'barrel' || t === 'drum') addStyle('HEAVY POUR', 200); else if (t === 'ball') addStyle('CORNER POCKET', 200); }
  if (o.onePunch && f.maxHp >= 40) addStyle('ONE PUNCH', 250);
  if (o.yeet) addStyle('HUMAN BOWLING', 250);
  if (o.parry) addStyle('COUNTER', 150);
  if (f.T.boss) { G.hitStop = 0.35; G.shake(0.6); AU.sfx('cheer', 1.2); $('boss').classList.add('hidden'); G.boss = null; }
  else G.hitStop = Math.max(G.hitStop, 0.08);
  // body count cap: remove the oldest KO'd bodies
  const kos = G.fighters.filter(x => x.ko && !x.gone); if (kos.length > 10) G.removeFighter(kos[0]);
}

G.hurtPlayer = (dmg, by, o = {}) => {
  const p = G.player; if (p.dead || G.ended) return;
  if (o.melee && by && p.block) {
    const ang = Math.abs(angDiff(p.yaw, Math.atan2(by.x - p.x, by.z - p.z)));
    if (ang < 1.25) {
      if (G.timeT - p.blockT < 0.28 && !by.T.boss || (by.T.boss && G.timeT - p.blockT < 0.18)) { // parry
        AU.sfx('parry'); G.fx.text(by.pts[2].clone().setY(by.pts[2].y + 0.4), 'PARRY!', '#9adfff', 1, 1); addStyle('PARRY', 120);
        by.dazed = 1.8; G.fx.dizzy(by, 1.8); by.setMood('dazed'); setState(by, 'dazedidle'); by.vx -= Math.sin(by.yaw) * 4; by.vz -= Math.cos(by.yaw) * 4; by.parried = G.timeT; G.hitStop = 0.1; return;
      }
      dmg *= o.heavy ? 0.35 : 0.2; p.stam = Math.max(0, p.stam - 18); AU.sfx('block'); G.shake(0.1);
      if (p.stam <= 0) { feed('GUARD BROKEN'); dmg *= 2.5; }
    }
  }
  dmg *= 1 - p.buzz / 400;
  p.hp -= dmg; p.hurtT = Math.min(1, 0.35 + dmg / 25); G.shake(0.12 + dmg * 0.012); AU.sfx(o.melee ? 'punch' : 'smack', 0.8); AU.sfx('hurt', 0.6);
  if (by && by.x != null) { const dx = p.x - by.x, dz = p.z - by.z, d = Math.hypot(dx, dz) || 1, k = o.knock || 1.5; p.vx += dx / d * k; p.vz += dz / d * k; }
  G.combo = 0; G.comboT = 0;
  if (p.hp <= 0) playerDown();
};
function playerDown() {
  const p = G.player; p.hp = 0; p.dead = true; p.deadT = 0; if (p.held) dropHeld(); if (p.grabbed) releaseGrab(); AU.sfx('land', 1); AU.sfx('lose');
  banner("YOU GOT 86'D", 'thrown out of ' + G.world.V.name, 3);
}

// prop wear when it lands a melee hit (player or AI)
G.propUsed = (owner, prop) => {
  prop.hits--; if (prop.hits > 0) return;
  const pos = owner === G.player ? camera.position.clone().add(_v.set(0, -0.2, 0).add(fwd().multiplyScalar(0.8))) : owner.pts[8].clone();
  const D = prop.D;
  if (D.brk === 'bottle') { AU.sfx('glass', 1.1); G.fx.glass(pos, 14, '#2a6a30'); G.fx.splash(pos, 14); replaceHeld(owner, prop, 'broken'); return; }
  if (D.brk === 'snap') { AU.sfx('wood', 1.1); G.fx.splinters(pos, 8); replaceHeld(owner, prop, 'halfcue'); addProp('halfcue', pos.x, pos.y, pos.z, { vel: new THREE.Vector3(rand(-2, 2), 3, rand(-2, 2)) }); return; }
  if (D.brk === 'glass') { AU.sfx('glass', 1); G.fx.glass(pos, 12); if (prop.full) G.fx.splash(pos, 18); }
  if (D.brk === 'wood') { AU.sfx('crash', 0.9); G.fx.splinters(pos, 16); if (prop.type === 'stool' || prop.type === 'chair') { replaceHeld(owner, prop, 'leg'); feed('STILL GOT A LEG'); return; } if (prop.type === 'barrel') { addProp('plank', pos.x, pos.y, pos.z, { vel: new THREE.Vector3(1, 3, 0) }); } }
  if (D.brk === 'guitar') { AU.sfx('strum', 1.2); AU.sfx('wood', 1.2); G.fx.splinters(pos, 20); addStyle('SMELLS LIKE TEEN SPIRIT', 200); }
  if (D.value) addTab(D.value, D.name.toUpperCase());
  if (owner === G.player) { G.player.held = null; VM.setHeld(null); } else owner.held = null;
  removeProp(prop);
};
function replaceHeld(owner, prop, type) {
  removeProp(prop);
  const np = addProp(type, 0, -5, 0); np.state = 'held';
  if (owner === G.player) { G.player.held = np; np.mesh.visible = false; VM.setHeld(type); } else { owner.held = np; np.owner = owner; }
}
G.spawnPropInHand = (f, type) => { const p = addProp(type, f.pts[8].x, f.pts[8].y, f.pts[8].z); p.state = 'held'; p.owner = f; return p; };
G.aiThrow = (f, prop, target, err = 0.35) => {
  if (!prop) return; const tp = target === G.player || !target ? { x: G.player.x + G.player.vx * 0.3, y: 1.35, z: G.player.z + G.player.vz * 0.3 } : { x: target.x, y: 1.1, z: target.z };
  const from = f.pts[8].clone(); from.y = Math.max(from.y, 1.5 * f.s);
  const d = Math.hypot(tp.x - from.x, tp.z - from.z), spd = prop.D.heavy ? 8 : 12.5, T = Math.max(0.15, d / spd);
  const vel = new THREE.Vector3((tp.x - from.x) / T + rand(-err, err) * 2, (tp.y - from.y + 0.5 * 15 * T * T) / T + rand(-err, err), (tp.z - from.z) / T + rand(-err, err) * 2);
  prop.owner = null; prop.pos.copy(from); prop.throwIt(vel, f); AU.sfx('throw', 0.7);
};

// boss stomp
const stompRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
stompRing.rotation.x = -Math.PI / 2; stompRing.position.y = 0.03; stompRing.visible = false; scene.add(stompRing);
const STOMP_R = 3.4;
G.stompWarn = (f, k) => { stompRing.visible = true; stompRing.position.x = f.x; stompRing.position.z = f.z; stompRing.scale.setScalar(STOMP_R * clamp(k, 0.1, 1)); stompRing.material.opacity = 0.3 + 0.5 * Math.abs(Math.sin(k * 20)); };
G.stomp = f => {
  stompRing.visible = false; AU.sfx('stomp', 1.3); G.shake(0.5);
  G.fx.puff(new THREE.Vector3(f.x, 0.2, f.z), 14, '#c8b8a0', 1.0, 1.2, 3);
  const p = G.player, d = Math.hypot(p.x - f.x, p.z - f.z);
  if (d < STOMP_R && p.jumpY < 0.12) G.hurtPlayer(16 * G.diffCfg.dmg, f, { knock: 7 });
  else if (d < STOMP_R) { feed('DODGED'); addStyle('HOP SCOTCH', 100); }
  for (const o of G.fighters) if (o !== f && o.alive && !o.rag && Math.hypot(o.x - f.x, o.z - f.z) < STOMP_R) hitFighter(o, 8, new THREE.Vector3(o.x - f.x, 0.5, o.z - f.z).normalize(), 1, { by: f, knock: true, power: 5 });
  for (const pr of G.props) if (pr.state === 'rest' && Math.hypot(pr.pos.x - f.x, pr.pos.z - f.z) < STOMP_R) { pr.state = 'fly'; pr.vel.set(rand(-1, 1), rand(2, 4), rand(-1, 1)); pr.ang.set(rand(-6, 6), rand(-6, 6), rand(-6, 6)); }
};
function updateBossBar() { if (!G.boss) return; $('bossb').style.width = clamp(G.boss.hp / G.boss.maxHp, 0, 1) * 100 + '%'; }

// ---------------------------------------------------------------- player
function fwd() { return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); }
function eye() { return camera.position; }
const isTouch = matchMedia('(pointer: coarse)').matches;

function strikeCheck(reach, dmg, o) {
  // pick the nearest fighter body point near the aim ray
  const E = eye().clone(), F = fwd(); let best = null;
  for (const f of G.fighters) {
    if (f.gone || f.state === 'grabbed') continue;
    for (const [i, r, kind] of f.targets()) {
      const pt = f.pts[i]; _v.subVectors(pt, E); const t = _v.dot(F); if (t < 0.1 || t > reach + r) continue;
      const perp = _v.addScaledVector(F, -t).length(); if (perp > r + 0.16) continue;
      const score = t + perp * 0.5 - (f.ko ? -1 : 0);
      if (!best || score < best.score) best = { f, i, t, score };
    }
  }
  if (best) {
    const f = best.f, dir = F.clone(); dir.y = Math.max(dir.y, -0.1) + 0.12; dir.normalize();
    const wasFull = f.hp >= f.maxHp;
    hitFighter(f, dmg, dir, best.i === 2 ? 2 : 1, { by: G.player, prop: o.prop, charge: o.charge, onePunch: wasFull && !o.prop, power: o.power });
    return { f, pos: f.pts[best.i] };
  }
  // props in reach get swatted
  for (const p of G.props) { if (p.state === 'held' || p.dead) continue; _v.subVectors(p.pos, E); const t = _v.dot(F); if (t < 0.1 || t > reach + 0.2) continue; if (_v.addScaledVector(F, -t).length() > p.D.r + 0.15) continue; const k = 2 + dmg * 0.25 / Math.sqrt(p.D.mass); p.throwIt(F.clone().multiplyScalar(k).add(_v2.set(0, 1.5, 0)), G.player); AU.sfx('smack', 0.5); return { prop: p }; }
  // breakables in reach
  const tip = E.clone().addScaledVector(F, Math.min(reach, 1.2));
  for (const b of G.world.boxes) { if (!(b.brk || b.shelf) || b.dead) continue; if (tip.x > b.x0 - .15 && tip.x < b.x1 + .15 && tip.y > b.y0 - .15 && tip.y < b.y1 + .15 && tip.z > b.z0 - .15 && tip.z < b.z1 + .15) { const ok = G.world.hit(b, dmg * 0.45, tip, G.fx); if (ok) { AU.sfx('wood', 0.6); return { brk: b }; } } }
  return null;
}

function updateFist(side, dt) {
  const p = G.player, F = p.fist[side], O = p.fist[side === 'L' ? 'R' : 'L'];
  F.t += dt;
  if (F.queued && !(O.st === 'strike' || O.st === 'rec' && O.t < 0.08)) { F.queued = false; F.st = 'charge'; F.t = 0; F.ch = 0; if (F.relQ) { F.relQ = false; F.st = 'strike'; F.done = false; } }
  if (F.st === 'charge') { F.ch = clamp(F.t / 0.6, 0, 1); }
  else if (F.st === 'strike') {
    if (!F.done && F.t >= 0.06) {
      F.done = true; G.stats.punches++;
      const ch = F.ch, haymaker = ch > 0.2;
      const cost = 9 + ch * 16; const weak = p.stam < cost; p.stam = Math.max(0, p.stam - cost);
      let dmg = (side === 'L' ? 6 : 8) + (haymaker ? ch * 21 : 0); dmg *= (1 + p.buzz / 140) * (weak ? 0.6 : 1);
      const alt = p.lastHand && p.lastHand !== side && G.comboT > 0;
      if (alt) dmg *= 1.15;
      const r = strikeCheck(1.12, dmg, { charge: ch, power: haymaker ? 3 + ch * 7 : 2.5 });
      if (r && r.f) { addCombo(); G.stats.hits++; AU.sfx(haymaker ? 'heavy' : 'punch', haymaker ? 1 : 0.7); G.shake(haymaker ? 0.15 + ch * 0.15 : 0.05); if (haymaker && ch > 0.8) G.hitStop = 0.06; }
      else if (!r) AU.sfx('whiff', 0.5);
      p.lastHand = side;
    }
    if (F.t > 0.16) { F.st = 'rec'; F.t = 0; }
  } else if (F.st === 'rec') { if (F.t > 0.2) { F.st = 'idle'; F.t = 0; F.ch = 0; } }
}
function fistDown(side) {
  const p = G.player; if (p.dead || p.stunT > 0 || p.drinkT >= 0) return;
  if (p.grabbed) { throwFighter(); return; }
  if (p.held) { if (side === 'L') { if (p.swing.st === 'idle') { p.swing = { st: 'charge', t: 0, ch: 0 }; } } else { p.throwCh = 0; } return; }
  const F = p.fist[side], O = p.fist[side === 'L' ? 'R' : 'L']; if (O.st === 'strike' || O.st === 'rec' && O.t < 0.08) { F.queued = true; return; } if (F.st === 'idle' || (F.st === 'rec' && F.t > 0.12)) { F.st = 'charge'; F.t = 0; F.ch = 0; }
}
function fistUp(side) {
  const p = G.player;
  if (p.held) { if (side === 'L' && p.swing.st === 'charge') { p.swing.st = 'strike'; p.swing.t = 0; p.swing.done = false; AU.sfx('whiff', 0.8); } if (side === 'R' && p.throwCh >= 0) throwHeld(); return; }
  const F = p.fist[side]; if (F.queued) { F.relQ = true; return; } if (F.st === 'charge') { F.st = 'strike'; F.t = 0; F.done = false; if (F.ch > 0.2) AU.sfx('whiff', 0.7); }
}
function updateSwing(dt) {
  const p = G.player, S = p.swing; if (S.st === 'idle') return; S.t += dt;
  const D = p.held ? p.held.D : null; const slow = D && D.heavy ? 1.6 : D && D.big ? 1.25 : 1;
  if (S.st === 'charge') S.ch = clamp(S.t / (0.55 * slow), 0, 1);
  else if (S.st === 'strike') {
    if (!S.done && S.t > 0.09 * slow && p.held) {
      S.done = true; const prop = p.held; const cost = 8 + (D.big ? 10 : 0); p.stam = Math.max(0, p.stam - cost);
      const dmg = D.swing * (0.75 + S.ch * 0.6) * (1 + p.buzz / 140);
      const r = strikeCheck(0.9 + D.reach, dmg, { prop, charge: S.ch, power: 3 + D.mass * 0.6 + S.ch * 4 });
      if (r && r.f) { addCombo(); G.stats.hits++; AU.sfx(D.big ? 'crash' : D.brk === 'glass' || D.brk === 'bottle' ? 'smack' : 'heavy', 0.9); G.shake(0.15 + (D.heavy ? 0.2 : 0)); G.hitStop = D.big ? 0.07 : 0.03; G.propUsed(G.player, prop); }
      else if (r && r.brk) { G.propUsed(G.player, prop); }
    }
    if (S.t > 0.3 * slow) { S.st = 'rec'; S.t = 0; }
  } else if (S.st === 'rec' && S.t > 0.15) { S.st = 'idle'; S.t = 0; S.ch = 0; }
}
function throwHeld() {
  const p = G.player, prop = p.held; if (!prop) return; const ch = clamp(p.throwCh / 0.6, 0.15, 1); p.throwCh = -1;
  const F = fwd(); const spd = (prop.D.heavy ? 6 : 9) + ch * (prop.D.heavy ? 5 : 10);
  prop.pos.copy(eye()).addScaledVector(F, 0.5).add(_v.set(0, -0.15, 0)); prop.mesh.visible = true; p.held = null; VM.setHeld(null);
  prop.throwIt(F.clone().multiplyScalar(spd).add(_v.set(p.vx * 0.5, 1.2, p.vz * 0.5)), G.player); prop.sync();
  AU.sfx('throw', 0.9); G.stats.thrown++; p.stam = Math.max(0, p.stam - 10); fistRecoil = 0.3;
}
let fistRecoil = 0;
function dropHeld() { const p = G.player, prop = p.held; if (!prop) return; p.held = null; VM.setHeld(null); prop.mesh.visible = true; prop.pos.copy(eye()).addScaledVector(fwd(), 0.5); prop.pos.y = Math.max(prop.pos.y - 0.4, 0.4); prop.throwIt(fwd().multiplyScalar(1.5), null); prop.thrownBy = null; prop.sync(); }
function grabFighter(f) {
  const p = G.player; p.grabbed = f; if (!f.rag) f.goRagdoll(new THREE.Vector3(0, 1, 0)); f.state = 'grabbed'; f.pin = { i: 1, pos: new THREE.Vector3().copy(f.pts[1]) };
  if (f.held) { const h = f.held; f.held = null; h.owner = null; h.throwIt(new THREE.Vector3(0, 1, 0), null); }
  AU.sfx('grab'); G.fx.bubble(f, f.ko ? 'zzz...' : pick(['PUT ME DOWN!', 'Hey hey HEY!', 'Not like this!', 'Easy, pal!']), 1.4); p.grabT = 0; markChaos(); makeHostile(G, f, G.player, 'hit');
}
function releaseGrab() { const f = G.player.grabbed; if (!f) return; f.pin = null; G.player.grabbed = null; if (!f.ko) { setState(f, 'down'); f.downT = 1.2; } else f.state = 'ko'; }
function throwFighter() {
  const p = G.player, f = p.grabbed; if (!f) return; releaseGrab();
  const F = fwd(); const vel = F.clone().multiplyScalar(13 * (1 + p.buzz / 300)).add(_v.set(0, 3.5, 0));
  for (let i = 0; i < 15; i++) f.prev[i].copy(f.pts[i]).addScaledVector(vel, -1 / 120);
  f.yeetT = 1.6; f.yeetHits = 0; f.downT = 2.4; AU.sfx('throw', 1.2); G.stats.yeets++; G.score += 50; feed('YEET!', 'style'); fistRecoil = 0.4;
  if (!f.ko) { f.hp -= 6; }
}
function drink(prop) {
  const p = G.player; p.drinkT = 0; p.drinkProp = prop; AU.sfx('drink');
}
function finishDrink() {
  const p = G.player, prop = p.drinkProp; p.drinkT = -1; if (!prop) return;
  const D = prop.D; p.hp = Math.min(100, p.hp + D.drink * 0.75); p.buzz += D.drink * 0.9; prop.full = false; G.stats.drinks++;
  G.fx.text(eye().clone().addScaledVector(fwd(), 1.2), `+${Math.round(D.drink * 0.75)} GRIT`, '#ffb13c', 0.6);
  AU.sfx('burp', 0.8); feed(pick(['LIQUID COURAGE', 'ON THE HOUSE', 'SLAINTE!', 'CHUGGED']));
  if (prop.type === 'bottle') { /* keep the empty bottle as a weapon */ }
  else if (prop.type === 'pitcher' || prop.type === 'mug' || prop.type === 'glass') { /* empty glass stays in hand */ }
  if (p.buzz >= 100) blackout();
}
function blackout() { const p = G.player; p.buzz = 55; p.stunT = 2.2; p.hp = Math.max(1, p.hp - 20); banner('BLACKED OUT', 'too much liquid courage', 2); AU.sfx('land'); blackA = 1; if (p.held) dropHeld(); }
let blackA = 0;

function computeFocus() {
  const p = G.player, E = eye(), F = fwd(); let best = null, bs = 1e9;
  if (p.grabbed || p.dead) return null;
  for (const f of G.fighters) {
    if (f.gone || f.T.boss && !f.ko && f.dazed <= 0) continue;
    const grabbable = f.ko || f.rag || f.dazed > 0 || f.state === 'dazedidle' || (f.T.boss ? false : f.state === 'stagger' && f.hp < f.maxHp * 0.4);
    if (!grabbable) continue;
    _v.subVectors(f.pts[1], E); const d = _v.length(); if (d > 2.0) continue; const a = _v.normalize().dot(F); if (a < 0.86) continue;
    const s = d - a * 2; if (s < bs) { bs = s; best = { kind: 'fighter', f }; }
  }
  for (const pr of G.props) {
    if (pr.state === 'held' || pr.dead || pr.owner) continue;
    _v.subVectors(pr.pos, E); const d = _v.length(); if (d > 2.0) continue; const a = _v.normalize().dot(F); if (a < 0.9 - (pr.D.big ? 0.06 : 0)) continue;
    const s = d - a * 2 + (pr.state === 'fly' ? 1 : 0); if (s < bs) { bs = s; best = { kind: 'prop', p: pr }; }
  }
  // beer taps
  const W = G.world; if (!best) for (const t of W.taps) { _v.set(t.x, 1.2, t.z).sub(E); const d = _v.length(); if (d < 1.9 && _v.normalize().dot(F) > 0.8) { best = { kind: 'tap' }; break; } }
  return best;
}
function interact() {
  const p = G.player; if (p.dead || p.stunT > 0 || p.drinkT >= 0) return;
  if (p.grabbed) { releaseGrab(); return; }
  if (p.held && p.held.full) { drink(p.held); return; }
  const fo = p.focus; if (!fo) return;
  if (fo.kind === 'fighter') { if (p.held) dropHeld(); grabFighter(fo.f); }
  else if (fo.kind === 'prop') { if (p.held) dropHeld(); const pr = fo.p; pr.state = 'held'; pr.mesh.visible = false; p.held = pr; pr.support = null; VM.setHeld(pr.type, pr.opts); AU.sfx('grab'); for (const f of G.fighters) if (f.seat && !f.hostile && f.alive && Math.hypot(pr.pos.x - f.x, pr.pos.z - f.z) < 0.4 && pr.D.big) { makeHostile(G, f, G.player); f.sit = 0; markChaos(); G.fx.bubble(f, "THAT'S MY STOOL!"); } }
  else if (fo.kind === 'tap') { if (p.held) dropHeld(); const m = addProp('mug', 0, -5, 0); m.state = 'held'; m.mesh.visible = false; p.held = m; VM.setHeld('mug'); AU.sfx('pop'); feed('PULLED A PINT'); }
}
function kick() {
  const p = G.player; if (p.kickT >= 0 || p.dead || p.stunT > 0) return; p.kickT = 0; p.stam = Math.max(0, p.stam - 12); AU.sfx('whiff', 0.7);
}
function doKick() {
  const p = G.player, F = fwd(); F.y = 0; F.normalize(); let hit = false;
  for (const f of G.fighters) {
    if (f.gone || f.state === 'grabbed') continue; const dx = f.x - p.x, dz = f.z - p.z, d = Math.hypot(dx, dz); if (d > 1.45 || d < 0.01) continue;
    if ((dx * F.x + dz * F.z) / d < 0.6) continue;
    const dir = new THREE.Vector3(F.x, 0.35, F.z);
    hitFighter(f, 7 * (1 + p.buzz / 140), dir, 0, { by: G.player, knock: f.T.poise < 25 || f.dazed > 0 || f.state === 'block', power: 9 }); hit = true;
  }
  for (const pr of G.props) { if (pr.state === 'held' || pr.dead) continue; const dx = pr.pos.x - p.x, dz = pr.pos.z - p.z, d = Math.hypot(dx, dz); if (d > 1.3 || (dx * F.x + dz * F.z) / d < 0.5 || pr.pos.y > 1.0) continue; pr.throwIt(new THREE.Vector3(F.x * 7 / Math.sqrt(pr.D.mass + 0.5), 2.5, F.z * 7 / Math.sqrt(pr.D.mass + 0.5)), G.player); hit = true; }
  if (hit) { AU.sfx('heavy', 0.9); G.shake(0.15); addCombo(); }
}

function updatePlayer(dt) {
  const p = G.player, K = G.keys;
  if (p.dead) { p.deadT += dt; return; }
  p.stunT = Math.max(0, p.stunT - dt); p.hurtT = Math.max(0, p.hurtT - dt * 1.5);
  p.buzz = Math.max(0, p.buzz - dt * 0.9); p.stam = Math.min(100, p.stam + dt * (p.block ? 8 : 20));
  // look
  const sens = 0.0022 * save.settings.sens; p.yaw -= G.look.x * sens; p.pitch -= G.look.y * sens * (save.settings.inv ? -1 : 1); G.look.x = G.look.y = 0;
  p.pitch = clamp(p.pitch, -1.35, 1.35);
  // move
  let mx = 0, mz = 0;
  if (p.stunT <= 0) { if (K.KeyW || K.ArrowUp) mz -= 1; if (K.KeyS || K.ArrowDown) mz += 1; if (K.KeyA || K.ArrowLeft) mx -= 1; if (K.KeyD || K.ArrowRight) mx += 1; mx += touchMove.x; mz += touchMove.y; }
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  let speed = (K.ShiftLeft || K.ShiftRight ? 5.4 : 3.6) * (p.block ? 0.55 : 1) * (p.held && p.held.D.heavy ? 0.75 : 1);
  // drunk wobble
  const wob = p.buzz / 100; const wa = Math.sin(G.t * 1.3) * wob * 0.5;
  const cy = Math.cos(p.yaw + wa), sy = Math.sin(p.yaw + wa);
  const wx = (mx * cy + mz * sy) * speed, wz = (-mx * sy + mz * cy) * speed;
  p.vx = lerp(p.vx, wx, clamp(dt * 10, 0, 1)); p.vz = lerp(p.vz, wz, clamp(dt * 10, 0, 1));
  if (wob > 0.4) { p.vx += Math.sin(G.t * 0.9) * (wob - 0.4) * 1.2 * dt * 10; p.vz += Math.cos(G.t * 0.7) * (wob - 0.4) * 1.2 * dt * 10; }
  const pos = { x: p.x + p.vx * dt, z: p.z + p.vz * dt };
  for (const b of G.world.boxes) { if (b.dead || b.solid === false || b.y1 < 0.35 + p.jumpY || b.y0 > 1.5) continue; circleBox(pos, 0.3, b); }
  pos.x = clamp(pos.x, ROOM.x0 + 0.3, ROOM.x1 - 0.3); pos.z = clamp(pos.z, ROOM.z0 + 0.3, ROOM.z1 - 0.3);
  p.x = pos.x; p.z = pos.z;
  p.bob += Math.hypot(p.vx, p.vz) * dt * 2.4;
  // nudge floor props
  for (const pr of G.props) { if (pr.state !== 'rest' || pr.pos.y > 0.5 || pr.D.heavy) continue; const dx = pr.pos.x - p.x, dz = pr.pos.z - p.z, d = Math.hypot(dx, dz); if (d < 0.3 + pr.D.r && d > 0.01 && Math.hypot(p.vx, p.vz) > 1) { pr.throwIt(new THREE.Vector3(dx / d * 2, 0.6, dz / d * 2), null); } }
  // jump
  if (G.pressed.has('Space') && p.jumpY <= 0 && p.stunT <= 0) { p.jumpV = 4.3; AU.sfx('whiff', 0.3); }
  if (p.jumpV !== 0 || p.jumpY > 0) { p.jumpY += p.jumpV * dt; p.jumpV -= 14 * dt; if (p.jumpY <= 0) { p.jumpY = 0; p.jumpV = 0; AU.sfx('thud', 0.4); } }
  // block
  const wasBlock = p.block; p.block = !!(K.KeyQ || touchBtn.Q) && !p.held && p.stunT <= 0; if (p.block && !wasBlock) p.blockT = G.timeT;
  // actions
  if (G.pressed.has('KeyE')) interact();
  if (G.pressed.has('KeyF')) kick();
  if (G.pressed.has('KeyG')) { if (p.grabbed) releaseGrab(); else dropHeld(); }
  if (G.pressed.has('L')) fistDown('L'); if (G.pressed.has('R')) fistDown('R');
  if (G.pressed.has('Lup')) fistUp('L'); if (G.pressed.has('Rup')) fistUp('R');
  if (!p.held) { updateFist('L', dt); updateFist('R', dt); } else { p.fist.L.st = p.fist.R.st = 'idle'; }
  updateSwing(dt);
  if (p.throwCh >= 0) p.throwCh += dt;
  if (p.kickT >= 0) { p.kickT += dt; if (p.kickT > 0.12 && !p.kicked) { p.kicked = true; doKick(); } if (p.kickT > 0.45) { p.kickT = -1; p.kicked = false; } }
  if (p.drinkT >= 0) { p.drinkT += dt; if (p.drinkT > 0.9) finishDrink(); }
  p.charging = p.fist.L.st === 'charge' && p.fist.L.ch > 0.2 || p.fist.R.st === 'charge' && p.fist.R.ch > 0.2 || p.swing.st === 'charge';
  // grabbed fighter dangles in front
  if (p.grabbed) {
    const f = p.grabbed; p.grabT = (p.grabT || 0) + dt; f.pin.pos.copy(eye()).addScaledVector(fwd(), 0.85).add(_v.set(0, -0.15, 0)); f.pin.pos.x = clamp(f.pin.pos.x, ROOM.x0 + 0.3, ROOM.x1 - 0.3); f.pin.pos.z = clamp(f.pin.pos.z, ROOM.z0 + 0.3, ROOM.z1 - 0.3); f.pin.pos.y = Math.max(f.pin.pos.y, 0.5);
    if (!f.ko && p.grabT > 3.5) { G.fx.bubble(f, 'LET GO!', 1); releaseGrab(); }
  }
  p.focus = computeFocus();
}

// ---------------------------------------------------------------- physics interactions
function ragSlam(f) {
  const sp = f.impact, th = f.yeetT > 0 ? 6 : 10; if (sp < 7.5 || f.state === 'grabbed' || (f.lastSlam && G.timeT - f.lastSlam < 0.3)) return;
  f.lastSlam = G.timeT; AU.sfx('land', clamp(sp / 12, 0.3, 1)); G.fx.puff(f.pts[0].clone(), 2, '#b8a890', 0.4, 0.7, 0.6);
  if (!f.ko && sp > th) { const sd = (sp - th) * 2.2; f.hp -= sd; G.dmgBy.slam = (G.dmgBy.slam || 0) + Math.round(sd); if (f.hp <= 0) koFighter(f, new THREE.Vector3(0, 1, 0), 1, { creditPlayer: f.yeetT > 0, yeet: f.yeetT > 0 && f.yeetHits > 0 }); else if (f.T.boss) updateBossBar(); }
}
function onRagImpact(f, b, sp, q) {
  if (b.brk || b.shelf) { const key = '_hb' + G.world.boxes.indexOf(b); if (!f[key] || G.timeT - f[key] > 0.35) { f[key] = G.timeT; const broke = G.world.hit(b, sp + (f.yeetT > 0 ? 4 : 0), q, G.fx); if (broke && b.dead && b.brk && b.brk.kind === 'table') addStyle('TABLE FOR ONE', 200); } }
}
function onPropStatic(pr, b, sp) {
  const D = pr.D;
  if (b && (b.brk || b.shelf) && sp > 4) { const broke = G.world.hit(b, sp * Math.sqrt(D.mass) * 0.9, pr.pos, G.fx); }
  if ((D.brk === 'glass' || D.brk === 'bottle') && sp > 4.5) shatter(pr);
  else if (D.brk === 'foam' && sp > 6) foamBurst(pr);
  else if (sp > 4) AU.sfx(D.heavy || D.brk === null && D.mass > 3 ? 'metal' : D.brk === 'wood' ? 'wood' : 'thud', clamp(sp / 14, 0.2, 0.8));
}
function shatter(pr) { AU.sfx('glass', 0.9); G.fx.glass(pr.pos, 14, pr.type === 'bottle' ? '#2a6a30' : '#cfe8ef'); if (pr.full) G.fx.splash(pr.pos, 16); if (pr.thrownBy === G.player) G.score += 10; removeProp(pr); }
function foamBurst(pr) {
  AU.sfx('foam', 1.3); G.fx.puff(pr.pos.clone(), 26, '#ffffff', 1.2, 2.4, 2.8); G.shake(0.3);
  let n = 0; for (const f of G.fighters) if (f.alive && !f.gone && Math.hypot(f.x - pr.pos.x, f.z - pr.pos.z) < 2.6) { hitFighter(f, 10, new THREE.Vector3(f.x - pr.pos.x, 0.6, f.z - pr.pos.z).normalize(), 1, { by: pr.thrownBy || G.player, knock: true, power: 6 }); n++; }
  if (n >= 1) addStyle('FOAM PARTY', 150 + n * 50); addTab(50, 'FIRE EXTINGUISHER', pr.pos); removeProp(pr);
}
function projectileHits() {
  for (const pr of [...G.props]) {
    if (pr.state !== 'fly' || pr.dead) continue; const sp = pr.vel.length(); if (sp < 3.5) continue;
    // vs fighters
    let hitSomething = false;
    for (const f of G.fighters) {
      if (f.gone || f === pr.thrownBy && pr.tFly < 0.4 || f.state === 'grabbed') continue;
      for (const [i, r] of f.targets()) {
        if (pr.pos.distanceTo(f.pts[i]) > r + pr.D.r) continue;
        const dmg = clamp(Math.sqrt(pr.D.mass) * sp * 1.25 * (pr.D.throwMul || 1), 4, 48);
        const by = pr.thrownBy || null;
        hitFighter(f, dmg, pr.vel.clone().normalize(), i === 2 ? 2 : 1, { by, prop: pr, knock: pr.D.heavy || pr.D.big && sp > 7, power: Math.min(10, pr.D.mass * sp * 0.25 + 2) });
        if (by === G.player) { addCombo(); G.stats.hits++; if (i === 2 && f.alive) G.fx.text(f.pts[2].clone().setY(f.pts[2].y + 0.4), 'HEADSHOT', '#ffe14d', 0.8, 0.8); }
        AU.sfx(pr.D.big ? 'crash' : 'smack', 0.9);
        hitSomething = true; break;
      }
      if (hitSomething) break;
    }
    if (hitSomething) {
      if (pr.D.brk === 'glass' || pr.D.brk === 'bottle') shatter(pr);
      else if (pr.D.brk === 'foam') foamBurst(pr);
      else if (pr.D.brk === 'guitar') { AU.sfx('strum', 1.2); G.fx.splinters(pr.pos, 20); addTab(pr.D.value, 'GUITAR', pr.pos); removeProp(pr); }
      else { pr.vel.multiplyScalar(-0.25); pr.vel.y = 1.5; pr.thrownBy = null; if (pr.D.brk === 'wood' && --pr.hits <= 0) { G.fx.splinters(pr.pos, 14); AU.sfx('crash'); if (pr.D.value) addTab(pr.D.value, pr.D.name.toUpperCase(), pr.pos); removeProp(pr); } }
      continue;
    }
    // vs player
    const p = G.player;
    if (pr.thrownBy && pr.thrownBy !== G.player && !p.dead) {
      const dy = pr.pos.y - p.jumpY; if (dy > 0 && dy < 1.85 && Math.hypot(pr.pos.x - p.x, pr.pos.z - p.z) < 0.35 + pr.D.r) {
        const ang = Math.abs(angDiff(p.yaw + Math.PI, Math.atan2(-pr.vel.x, -pr.vel.z)));
        let dmg = clamp(Math.sqrt(pr.D.mass) * sp * 1.0, 4, 30) * G.diffCfg.dmg;
        if (p.block && Math.abs(angDiff(p.yaw, Math.atan2(pr.pos.x - p.x, pr.pos.z - p.z) + Math.PI)) < 1.3) { dmg *= 0.25; AU.sfx('block'); }
        G.hurtPlayer(dmg, pr.thrownBy, {});
        if (pr.D.brk === 'glass' || pr.D.brk === 'bottle') { shatter(pr); G.fx.splash(eye().clone().addScaledVector(fwd(), 0.3), 10); beerFace = 1; }
        else { pr.vel.multiplyScalar(-0.2); pr.thrownBy = null; }
      }
    }
  }
  // thrown ragdolls bowling into people
  for (const f of G.fighters) {
    if (!f.rag || f.gone || f.state === 'grabbed') continue;
    if (f.yeetT > 0) f.yeetT -= 1 / 60;
    const sp = f.ragSpeed(); if (sp < 5) continue;
    for (const o of G.fighters) {
      if (o === f || o.gone || o.rag || !o.alive) continue;
      if (f.pts[1].distanceTo(o.pts[1]) < 0.55 || f.pts[0].distanceTo(o.pts[0]) < 0.5) {
        const dir = new THREE.Vector3().subVectors(f.pts[1], f.prev[1]).normalize();
        hitFighter(o, sp * 2.2, dir, 1, { by: f.yeetT > 0 ? G.player : f, knock: true, power: sp * 0.5 });
        if (f.yeetT > 0) { f.yeetHits = (f.yeetHits || 0) + 1; if (f.yeetHits === 2) addStyle('STRIKE!', 300); else addStyle('HUMAN BOWLING', 150); }
        AU.sfx('heavy', 1);
      }
    }
  }
}
let beerFace = 0;

// ---------------------------------------------------------------- waves / director
const WAVE_TXT = {
  pub: ['The darts league heard about this.', 'The dockworkers just clocked off.'],
  saloon: ['The Murphy gang rides into town.', 'The cattle drive just got paid.'],
  club: ['The VIP section wants a word.', 'Security called for backup.'],
  road: ['The Iron Clovers MC pulls up.', 'Engines outside. Lots of them.'],
};
function activeCount() { return G.fighters.filter(f => f.alive && !f.gone && !f.flee).length; }
function director(dt) {
  const V = G.world.V;
  if (!G.chaos) { G.provokeT -= dt; if (G.provokeT <= 0) { // someone picks a fight
    let best = null, bd = 99; for (const f of G.fighters) { if (!f.alive) continue; const d = Math.hypot(f.x - G.player.x, f.z - G.player.z); if (d < bd) { bd = d; best = f; } }
    if (best) { makeHostile(G, best, G.player); G.fx.bubble(best, pick(["YOU SPILLED MY BEER!", "That's MY seat, pal!", "You lookin' at me?!"]), 2.4); G.provokeT = 99; setTimeout(markChaos, 1200); }
  } }
  // spawn queue
  if (G.spawnQ.length) { G.spawnQT = (G.spawnQT || 0) - dt; if (G.spawnQT <= 0) { const s = G.spawnQ.shift(); spawnAtDoor(s.type, s.boss); G.spawnQT = 0.7; } }
  if (!G.chaos || G.ended) return;
  if (activeCount() === 0 && !G.spawnQ.length) {
    G.waveDelay += dt; if (G.waveDelay < 2.4) return; G.waveDelay = 0;
    G.waveIdx++; if (G.player && !G.player.dead) { G.player.hp = Math.min(100, G.player.hp + 15); feed('SECOND WIND  +15 GRIT'); }
    if (G.endless) {
      const n = G.waveIdx; G.hpScale = 1 + n * 0.05;
      if (n % 5 === 0) { const b = pick(['mick', 'boone', 'bassdrop', 'tank']); G.spawnQ.push({ type: b, boss: true }); for (let i = 0; i < 2; i++) G.spawnQ.push({ type: pick(['bouncer', 'biker', 'brute']) }); banner('BOSS ROUND ' + n, TYPES[b].name, 2.4, true); }
      else { const cnt = Math.min(8, 2 + Math.floor(n * 0.7)); for (let i = 0; i < cnt; i++) G.spawnQ.push({ type: pick(['barfly', 'darts', 'brute', 'cowboy', 'biker', 'clubber', 'bouncer'].slice(0, Math.min(7, 3 + n))) }); banner('ROUND ' + (n + 1), pick(['More of them.', 'Somebody called their cousins.', 'Last call? Not yet.', 'The door swings open...']), 2); }
      setWave(`Round ${n + 1}`); AU.sfx('bell'); return;
    }
    const W = V.waves;
    if (G.waveIdx <= W.length) { for (const t of W[G.waveIdx - 1]) G.spawnQ.push({ type: t }); banner('ROUND ' + (G.waveIdx + 1), WAVE_TXT[V.id][G.waveIdx - 1] || '', 2.4); setWave(`Round ${G.waveIdx + 1} of ${W.length + 2}`); AU.sfx('bell'); }
    else if (G.waveIdx === W.length + 1) { G.spawnQ.push({ type: V.boss, boss: true }); G.spawnQ.push({ type: V.waves[0][0] }); if (G.diff > 0) G.spawnQ.push({ type: V.waves[1][1] }); banner(TYPES[V.boss].name, 'FINAL ROUND - THE OWNER IS HERE', 3, true); setWave(`Final round: ${TYPES[V.boss].name}`); AU.sfx('bell'); }
    else victory();
  }
}
function spawnAtDoor(type, boss) {
  const f = addFighter(type, { x: rand(-0.4, 0.4), z: 6.5, yaw: Math.PI, state: 'enter', hpMul: G.hpScale || 1 }); f.entering = true; G.world.door.open = 1; AU.sfx('door', 0.8);
  if (boss) { G.boss = f; $('boss').classList.remove('hidden'); $('bossname').textContent = TYPES[type].name; updateBossBar(); setTimeout(() => G.fx.bubble(f, bark('boss'), 2.5), 900); }
}
function updateEnter(f, dt) {
  // walk in through the door, then join the brawl
  f.t += dt; const dz = 4.2 - f.z; f.vz = Math.sign(dz) * f.T.spd; f.vx = (0 - f.x) * 2; f.yaw = Math.PI; f.x += f.vx * dt; f.z += f.vz * dt; f.walk += dt * 9; f.spd = 1; f.guard = approach(f.guard, 1, dt * 2);
  if (f.z < 4.4) { f.entering = false; makeHostile(G, f, G.player); setState(f, 'approach'); }
}
function victory() {
  if (G.ended) return; G.ended = true; G.endT = 0; G.win = true; banner('LAST CALL!', 'the bar is yours', 3); AU.sfx('win'); AU.sfx('cheer', 1.2);
}

// ---------------------------------------------------------------- results
function showResults() {
  const V = G.world.V, win = !!G.win, time = G.timeT;
  if (document.pointerLockElement) document.exitPointerLock();
  G.mode = 'result'; $('banner').classList.remove('on'); bannerT = 0; $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); AU.playMusic('title');
  const st = [win, win && G.tab >= V.goal, win && time <= V.par];
  let tot = G.score + G.tab;
  if (G.endless) { $('rtitle').textContent = 'CLOSING TIME'; $('rsub').textContent = `${V.name}  -  survived ${G.waveIdx} rounds`; $('rstars').innerHTML = ''; if (tot > (save.endlessBest || 0)) { save.endlessBest = tot; } }
  else {
    $('rtitle').textContent = win ? 'LAST CALL!' : "86'D"; $('rsub').textContent = `${V.name}  -  ${DIFFS[G.diff].name}`;
    $('rstars').innerHTML = st.map(s => `<span class="${s ? '' : 'off'}">&#9733;</span>`).join('');
    if (win) { const prev = save.stars[V.id] || [0, 0, 0]; save.stars[V.id] = prev.map((v, i) => v || (st[i] ? 1 : 0)); save.best[V.id] = Math.max(save.best[V.id] || 0, tot); }
  }
  persist();
  const mm = Math.floor(time / 60), ss = String(Math.floor(time % 60)).padStart(2, '0');
  const rows = [['Knockouts', G.kos], ['Bar tab', `$${G.tab}` + (G.endless ? '' : `  (goal $${V.goal})`)], ['Time', `${mm}:${ss}` + (G.endless ? '' : `  (par ${Math.floor(V.par / 60)}:${String(V.par % 60).padStart(2, '0')})`)], ['Best combo', 'x' + G.bestCombo], ['Style moves', G.styles], ['People thrown', G.stats.yeets], ['Drinks', G.stats.drinks], ['Score + tab', tot.toLocaleString()]];
  if (G.endless) rows.push(['Best ever', (save.endlessBest || 0).toLocaleString()]);
  $('rstats').innerHTML = rows.map(([a, b], i) => `<span>${a}</span><span class="${i === rows.length - 1 ? 'hl' : ''}">${b}</span>`).join('');
  const btns = [];
  if (win && !G.endless && G.venueIdx < VENUES.length - 1) btns.push(`<button class="btn primary" data-act="next">Next Bar</button>`);
  btns.push(`<button class="btn ${win ? '' : 'primary'}" data-act="retry">${win ? 'Replay' : 'Try Again'}</button>`, `<button class="btn" data-act="venues">Bars</button>`, `<button class="btn" data-act="quit">Menu</button>`);
  $('rbtns').innerHTML = btns.join(''); showScreen('result');
}

// ---------------------------------------------------------------- HUD
let hudT = 0;
function updateHUD(dt) {
  const p = G.player; if (!p) return;
  $('hpb').style.width = clamp(p.hp, 0, 100) + '%'; $('hpg').style.width = clamp(p.hp, 0, 100) + '%';
  $('bzb').style.width = clamp(p.buzz, 0, 100) + '%'; $('bzt').textContent = p.buzz > 85 ? 'WOOZY' : p.buzz > 60 ? 'TIPSY' : '';
  $('stb').style.width = p.stam + '%';
  $('score').textContent = G.score.toLocaleString(); $('tab').textContent = '$' + G.tab.toLocaleString();
  const act = G.fighters.filter(f => f.alive && !f.gone && f.hostile && !f.flee).length; $('kos').textContent = G.chaos ? `${G.kos} KO  -  ${act} still swinging` : '';
  const c = $('combo'); if (G.combo >= 2 && G.comboT > 0) { c.style.opacity = 1; c.innerHTML = `x${G.combo}<small>COMBO</small>`; } else c.style.opacity = 0;
  const cross = $('cross'); cross.classList.toggle('charge', p.charging); cross.classList.toggle('target', !!p.focus);
  // prompt
  let pr = '';
  if (p.grabbed) pr = `<kbd>LMB</kbd> THROW ${p.grabbed.ko ? 'the body' : 'them'} &nbsp; <kbd>E</kbd> let go`;
  else if (p.held && p.held.full) pr = `<kbd>E</kbd> chug ${p.held.D.name} &nbsp; <kbd>LMB</kbd> swing &nbsp; <kbd>RMB</kbd> throw`;
  else if (p.focus) { const f = p.focus; pr = f.kind === 'fighter' ? `<kbd>E</kbd> grab ${f.f.ko ? 'the body' : f.f.T.name}` : f.kind === 'tap' ? `<kbd>E</kbd> pull a pint` : `<kbd>E</kbd> grab ${f.p.D.name}${f.p.full ? ' (full)' : ''}`; }
  else if (p.held) pr = `<kbd>LMB</kbd> swing &nbsp; <kbd>RMB</kbd> throw &nbsp; <kbd>G</kbd> drop`;
  const el = $('prompt'); if (isTouch) pr = pr.replace(/<kbd>LMB<\/kbd>/g, '<kbd>L</kbd>').replace(/<kbd>RMB<\/kbd>/g, '<kbd>R</kbd>').replace(/<kbd>E<\/kbd>/g, '<kbd>GRAB</kbd>');
  if (el._h !== pr) { el.innerHTML = pr; el._h = pr; } el.classList.toggle('on', !!pr);
  // overlays
  $('hurt').style.opacity = clamp(p.hurtT + (p.hp < 25 ? 0.25 + Math.sin(G.t * 6) * 0.1 : 0), 0, 1);
  blackA = Math.max(0, blackA - dt * 0.5); beerFace = Math.max(0, beerFace - dt * 0.7);
  $('black').style.opacity = p.dead ? clamp(p.deadT / 2.5, 0, 0.85) : blackA;
  const bz = p.buzz / 100, calm = save.settings.calm ? 0.4 : 1;
  canvas.style.filter = (bz > 0.35 || beerFace > 0) ? `blur(${((Math.max(0, bz - 0.35) * 2.2 + beerFace * 3) * calm).toFixed(2)}px) saturate(${1 + bz * 0.5}) sepia(${(beerFace * 0.6).toFixed(2)})` : '';
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('on'); }
}

// ---------------------------------------------------------------- camera + viewmodel animation
function updateCamera(dt) {
  const p = G.player; const calm = save.settings.calm ? 0.35 : 1;
  const bz = p.buzz / 100;
  let y = 1.63 + p.jumpY + Math.sin(p.bob * 2) * 0.035 * calm, roll = Math.sin(G.t * 0.8) * bz * 0.1 * calm + Math.sin(p.bob) * 0.01 * calm;
  let yaw = p.yaw + Math.sin(G.t * 0.55) * bz * 0.05 * calm, pitch = p.pitch + Math.sin(G.t * 0.73) * bz * 0.03 * calm;
  if (p.dead) { const k = clamp(p.deadT / 0.9, 0, 1); y = lerp(y, 0.25, k * k); roll = lerp(0, 1.2, k); pitch = lerp(pitch, 0.6, k); }
  if (p.stunT > 0) { roll += Math.sin(G.t * 3) * 0.15; }
  const sh = G.shakeA; G.shakeA = Math.max(0, G.shakeA - dt * 1.8);
  camera.position.set(p.x + rand(-sh, sh) * 0.12, y + rand(-sh, sh) * 0.12, p.z + rand(-sh, sh) * 0.12);
  camera.rotation.set(pitch + rand(-sh, sh) * 0.05, yaw + rand(-sh, sh) * 0.05, roll);
  // viewmodel
  const t = G.t, L = VM.L, R = VM.R;
  const bob = Math.sin(p.bob * 2) * 0.012, sway = Math.cos(p.bob) * 0.012;
  const pose = (F, side) => {
    const s = side === 'L' ? -1 : 1; let px = s * 0.25, py = -0.29 + bob, pz = -0.56, rx = 0.1, ry = s * -0.15, rz = 0;
    if (p.block) { px = s * 0.11; py = -0.1; pz = -0.36; rx = 0.5; ry = s * -0.5; rz = s * 0.3; }
    if (F.st === 'charge') { const k = F.ch; px = s * (0.27 + k * 0.08); py = -0.25 - k * 0.04; pz = -0.36 + k * 0.1; rz = s * -k * 0.4; }
    if (F.st === 'strike') { const k = Math.sin(clamp(F.t / 0.12, 0, 1) * Math.PI / 2); px = lerp(px, s * 0.04, k); py = lerp(py, -0.1, k); pz = lerp(pz, -0.85 - F.ch * 0.1, k); rz = s * -0.6 * k * (F.ch > 0.2 ? 1.6 : 1); ry = s * 0.1 * k; }
    if (F.st === 'rec') { const k = 1 - F.t / 0.12; pz = lerp(pz, -0.75, k); px = lerp(px, s * 0.08, k); }
    return [px + sway, py, pz, rx, ry, rz];
  };
  let lp = pose(p.fist.L, 'L'), rp = pose(p.fist.R, 'R');
  if (p.held) {
    const S = p.swing, D = p.held.D;
    rp = [0.25, -0.25 + bob, -0.45, 0.15, 0, 0];
    if (D.big) { rp = [0.12, -0.32 + bob, -0.55, 0.2, 0, 0]; lp = [-0.12, -0.32 + bob, -0.55, 0.2, 0, 0]; }
    if (S.st === 'charge') { const k = S.ch; rp = [0.3 + k * 0.1, -0.1 + k * 0.15, -0.35 + k * 0.1, -0.7 * k, 0.3 * k, -0.4 * k]; if (D.big) lp = [0.05, -0.1 + k * 0.1, -0.4, -0.6 * k, 0, 0]; }
    if (S.st === 'strike') { const k = clamp(S.t / 0.18, 0, 1); rp = [lerp(0.35, -0.25, k), lerp(0.05, -0.35, k), lerp(-0.3, -0.7, Math.sin(k * Math.PI)), lerp(-0.7, 1.1, k), lerp(0.3, -0.6, k), lerp(-0.4, 0.5, k)]; if (D.big) lp = [rp[0] - 0.2, rp[1], rp[2], rp[3], rp[4], rp[5]]; }
    if (p.throwCh >= 0) { const k = clamp(p.throwCh / 0.6, 0, 1); rp = [0.3, -0.05 + k * 0.2, -0.3 + k * 0.15, -0.9 * k, 0, 0]; }
    if (p.drinkT >= 0) { const k = Math.sin(clamp(p.drinkT / 0.9, 0, 1) * Math.PI); rp = [lerp(0.25, 0.03, k), lerp(-0.25, -0.1, k), lerp(-0.45, -0.22, k), lerp(0.15, -1.2, k), 0, lerp(0, 0.4, k)]; }
  }
  if (p.grabbed) { lp = [-0.15, -0.05, -0.55, 0.6, 0, 0.3]; rp = [0.15, -0.05, -0.55, 0.6, 0, -0.3]; }
  if (p.kickT >= 0) { const k = Math.sin(clamp(p.kickT / 0.45, 0, 1) * Math.PI); lp[1] -= k * 0.1; rp[1] -= k * 0.1; }
  if (fistRecoil > 0) { fistRecoil -= dt; rp[2] -= fistRecoil * 0.6; }
  for (const [M, P] of [[L, lp], [R, rp]]) { M.position.lerp(_v.set(P[0], P[1], P[2]), clamp(dt * 22, 0, 1)); M.rotation.x = lerp(M.rotation.x, P[3], clamp(dt * 20, 0, 1)); M.rotation.y = lerp(M.rotation.y, P[4], clamp(dt * 20, 0, 1)); M.rotation.z = lerp(M.rotation.z, P[5], clamp(dt * 20, 0, 1)); }
  VM.g.visible = !p.dead;
  vmCam.rotation.z = roll * 0.3;
}

// ---------------------------------------------------------------- main step
const DT = 1 / 60;
function step(dt) {
  G.t += dt;
  if (G.mode === 'play' || G.mode === 'title') {
    let sdt = dt; if (G.hitStop > 0) { G.hitStop -= dt; sdt = dt * 0.08; }
    if (G.mode === 'play') { G.timeT += sdt; if (!G.ended && !G.player.dead) updatePlayer(sdt); if (G.player.dead) G.player.deadT += dt; }
    for (const f of G.fighters) { f.mats.fist.emissive.setRGB(0, 0, 0); }
    for (const f of G.fighters) {
      if (f.gone) continue;
      if (f.state === 'enter') updateEnter(f, sdt); else if (G.mode === 'play' || !f.hostile) updateAI(G, f, sdt);
      if (f.rag) { if (sdt >= dt * 0.5) { f.impact = 0; for (let s = 0; s < 2; s++) f.stepRagdoll(dt / 2, G.world, onRagImpact); ragSlam(f); } }
      else f.pose(sdt);
    }
    G.fighters = G.fighters.filter(f => !f.gone);
    for (const pr of [...G.props]) if (pr.state === 'fly') pr.update(sdt, G.world, onPropStatic);
    if (G.mode === 'play') { projectileHits(); director(sdt); }
    G.world.update(sdt); G.fx.update(sdt, camera);
    G.comboT = Math.max(0, G.comboT - sdt); if (G.comboT <= 0) G.combo = 0;
    if (G.mode === 'play') {
      if (G.ended) { G.endT += dt; if (G.endT > 3.2) showResults(); }
      else if (G.player.dead && G.player.deadT > 3.2) { G.ended = true; G.win = false; showResults(); }
      const inten = G.chaos ? clamp(G.fighters.filter(f => f.hostile && f.alive).length / 5, 0, 1) : 0; AU.tickMusic(inten);
    } else AU.tickMusic(0);
  } else AU.tickMusic(0);
  G.pressed.clear();
}
function render() {
  for (const f of G.fighters) f.updateMesh(camera);
  if (G.mode === 'play' || G.mode === 'pause' || G.mode === 'result' && G.player) updateCamera(G.mode === 'play' ? DT : 0);
  else { // title orbit
    const a = G.t * 0.07; camera.position.set(Math.sin(a) * 4.5 + 0.5, 1.9 + Math.sin(G.t * 0.3) * 0.2, Math.cos(a) * 3.2 + 1); camera.lookAt(0, 1.0, -1.5);
  }
  renderer.clear(); renderer.render(scene, camera);
  if (G.mode === 'play' || G.mode === 'pause') { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
let acc = 0, last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (G.mode === 'pause') { render(); return; }
  acc += dt; let n = 0; while (acc >= DT && n < 5) { step(DT); acc -= DT; n++; } if (n === 5) acc = 0;
  if (G.mode === 'play' || G.mode === 'title' || G.mode === 'result') updateHUD(dt);
  render();
}

// ---------------------------------------------------------------- input
function lockPointer() { if (isTouch || G.noLock) return; const fail = () => { G.noLock = true; $('clicktip').classList.add('hidden'); }; try { const r = canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { const r2 = canvas.requestPointerLock(); if (r2 && r2.catch) r2.catch(fail); } catch (e) { fail(); } }); } catch (e) { fail(); } }
addEventListener('keydown', e => {
  if (e.repeat) return; AU.initAudio();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.mode === 'play') pause(); else if (G.mode === 'pause' && e.code === 'KeyP') resume(); return; }
  G.keys[e.code] = true; G.pressed.add(e.code);
  if (G.mode === 'play' && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (G.mode !== 'play') menuKey(e);
});
addEventListener('keyup', e => { G.keys[e.code] = false; });
addEventListener('mousedown', e => {
  if (G.mode !== 'play') return; AU.initAudio();
  if (!document.pointerLockElement && !isTouch && !MANUAL && !G.noLock) { lockPointer(); return; }
  const k = e.button === 0 ? 'L' : e.button === 2 ? 'R' : null; if (k) { G.mouse[k] = true; G.pressed.add(k); }
  if (e.button === 1) G.pressed.add('KeyE');
});
addEventListener('mouseup', e => { const k = e.button === 0 ? 'L' : e.button === 2 ? 'R' : null; if (k && G.mouse[k]) { G.mouse[k] = false; G.pressed.add(k + 'up'); } });
addEventListener('mousemove', e => { if ((document.pointerLockElement === canvas || G.noLock) && G.mode === 'play') { G.look.x += clamp(e.movementX, -300, 300); G.look.y += clamp(e.movementY, -300, 300); } });
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => { const locked = document.pointerLockElement === canvas; $('clicktip').classList.toggle('hidden', locked || G.mode !== 'play'); if (!locked && G.mode === 'play' && !MANUAL && !G.noLock) pause(); });
addEventListener('blur', () => { G.keys = {}; if (G.mode === 'play' && !MANUAL) pause(); });
// touch
const touchMove = { x: 0, y: 0 }, touchBtn = {};
if (isTouch) {
  const stick = $('stick'), knob = $('knob'); let sid = null, sc = null;
  stick.addEventListener('touchstart', e => { const t = e.changedTouches[0]; sid = t.identifier; const r = stick.getBoundingClientRect(); sc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (t.identifier === sid) { const dx = clamp((t.clientX - sc.x) / 55, -1, 1), dy = clamp((t.clientY - sc.y) / 55, -1, 1); touchMove.x = dx; touchMove.y = dy; knob.style.transform = `translate(${dx * 45}px,${dy * 45}px)`; } else if (t.identifier === lookId) { G.look.x += (t.clientX - lookLast.x) * 2.2; G.look.y += (t.clientY - lookLast.y) * 2.2; lookLast = { x: t.clientX, y: t.clientY }; } } }, { passive: false });
  addEventListener('touchend', e => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; touchMove.x = touchMove.y = 0; knob.style.transform = ''; } if (t.identifier === lookId) lookId = null; } });
  let lookId = null, lookLast = null;
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (lookId == null) { lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY }; } AU.initAudio(); }, { passive: true });
  document.querySelectorAll('.tbtns button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('touchstart', e => { e.preventDefault(); AU.initAudio(); if (k === 'Escape') { pause(); return; } if (k === 'L' || k === 'R') { G.pressed.add(k); G.mouse[k] = true; } else if (k === 'E') G.pressed.add('KeyE'); else if (k === 'F') G.pressed.add('KeyF'); else if (k === 'G') G.pressed.add('KeyG'); else if (k === 'Space') G.pressed.add('Space'); else touchBtn[k] = true; }, { passive: false });
    b.addEventListener('touchend', e => { e.preventDefault(); if (k === 'L' || k === 'R') { G.pressed.add(k + 'up'); G.mouse[k] = false; } touchBtn[k] = false; }, { passive: false });
  });
}

// ---------------------------------------------------------------- menus
let screenStack = [];
function showScreen(id) {
  for (const s of ['menu', 'venues', 'how', 'settings', 'pause', 'result']) $(s).classList.toggle('hidden', s !== id);
  $('clicktip').classList.add('hidden');
  if (id === 'venues') buildVenues(); if (id === 'settings') loadSettings();
  focusIdx = 0; updateFocus();
}
function go(id) { screenStack.push(currentScreen()); showScreen(id); }
function currentScreen() { for (const s of ['menu', 'venues', 'how', 'settings', 'pause', 'result']) if (!$(s).classList.contains('hidden')) return s; return null; }
function back() { const prev = screenStack.pop() || (G.mode === 'pause' ? 'pause' : 'menu'); showScreen(prev); }
function pause() { if (G.mode !== 'play') return; G.mode = 'pause'; G.keys = {}; G.mouse = { L: false, R: false }; showScreen('pause'); screenStack = []; if (document.pointerLockElement) document.exitPointerLock(); }
function resume() { G.mode = 'play'; showScreen(null); last = performance.now(); if (!isTouch) lockPointer(); }
function toTitle() {
  if (document.pointerLockElement) document.exitPointerLock();
  G.mode = 'title'; G.player = null; $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); canvas.style.filter = '';
  loadVenue(0); placePatrons(['barfly', 'darts', 'barfly', 'brute', 'darts', 'barfly', 'cowboy']); G.chaos = false;
  showScreen('menu'); screenStack = []; AU.playMusic('title');
}
let selDiff = save.diff ?? 1;
function unlocked(i) { return i === 0 || !!save.stars[VENUES[i - 1].id]; }
function buildVenues() {
  $('diffs').innerHTML = DIFFS.map((d, i) => `<button class="${i === selDiff ? 'on' : ''}" data-diff="${i}">${d.name}</button>`).join('');
  const col = { pub: '#3cff8a', saloon: '#ffb13c', club: '#ff2fd0', road: '#ff6a1a' };
  $('cards').innerHTML = VENUES.map((V, i) => {
    const st = save.stars[V.id] || [0, 0, 0], lock = !unlocked(i);
    return `<div class="card ${lock ? 'locked' : ''}" data-venue="${i}"><div class="sw" style="color:${col[V.id]};background:radial-gradient(ellipse at center,${col[V.id]}22,#000 80%)">${V.sign[0]}</div><h3>${V.name}</h3><div class="sub">${V.sub}</div>
      <div class="stars">${st.map(s => `<span class="${s ? '' : 'off'}">&#9733;</span>`).join('')}</div>
      <div class="goals">&#9733; clear the bar<br>&#9733; run up a $${V.goal.toLocaleString()} tab<br>&#9733; finish under ${Math.floor(V.par / 60)}:${String(V.par % 60).padStart(2, '0')}</div>
      <div class="boss">${lock ? 'LOCKED - clear the previous bar' : 'Boss: ' + TYPES[V.boss].name}</div>${save.best[V.id] ? `<div class="goals">Best: ${save.best[V.id].toLocaleString()}</div>` : ''}</div>`;
  }).join('');
}
let endlessPick = false;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act],[data-venue],[data-diff]'); if (!b) return; AU.initAudio(); AU.sfx('ui');
  if (b.dataset.diff) { selDiff = +b.dataset.diff; buildVenues(); return; }
  if (b.dataset.venue != null) { const i = +b.dataset.venue; if (!unlocked(i)) return; startVenue(i, selDiff, endlessPick); return; }
  act(b.dataset.act);
});
function act(a) {
  switch (a) {
    case 'venues': endlessPick = false; go('venues'); break;
    case 'endless': endlessPick = true; go('venues'); banner('ENDLESS', 'pick a bar - unlocked bars only', 1.6); break;
    case 'how': go('how'); break; case 'settings': go('settings'); break; case 'back': back(); break;
    case 'resume': resume(); break; case 'restart': startVenue(G.venueIdx, G.diff, G.endless); break; case 'quit': toTitle(); break;
    case 'retry': startVenue(G.venueIdx, G.diff, G.endless); break; case 'next': startVenue(G.venueIdx + 1, G.diff, false); break;
  }
}
// keyboard / gamepad-style focus navigation for menus
let focusIdx = 0;
function focusables() { const s = currentScreen(); if (!s) return []; return [...$(s).querySelectorAll('.btn,.card:not(.locked)')]; }
function updateFocus() { const f = focusables(); f.forEach((el, i) => el.classList.toggle('focus', i === focusIdx)); }
function menuKey(e) {
  const f = focusables(); if (!f.length) return;
  if (['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD', 'Tab'].includes(e.code)) { focusIdx = (focusIdx + 1) % f.length; updateFocus(); e.preventDefault(); AU.sfx('ui', 0.5); }
  if (['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(e.code)) { focusIdx = (focusIdx - 1 + f.length) % f.length; updateFocus(); e.preventDefault(); AU.sfx('ui', 0.5); }
  if (e.code === 'Enter' || e.code === 'Space') { f[focusIdx]?.click(); e.preventDefault(); }
  if (e.code === 'Backspace') back();
}
function loadSettings() {
  const S = save.settings; $('sens').value = S.sens; $('mus').value = S.mus; $('sfxv').value = S.sfx; $('inv').checked = S.inv; $('lowq').checked = S.lowq; $('calm').checked = S.calm;
}
for (const id of ['sens', 'mus', 'sfxv', 'inv', 'lowq', 'calm']) $(id).addEventListener('input', () => {
  const S = save.settings; S.sens = +$('sens').value; S.mus = +$('mus').value; S.sfx = +$('sfxv').value; S.inv = $('inv').checked; S.calm = $('calm').checked;
  if (S.lowq !== $('lowq').checked) { S.lowq = $('lowq').checked; renderer.shadowMap.enabled = !S.lowq; if (G.world) G.world.key.castShadow = !S.lowq; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); resize(); }
  AU.A.musicVol = S.mus; AU.A.sfxVol = S.sfx; AU.applyVol(); persist();
});
AU.A.musicVol = save.settings.mus; AU.A.sfxVol = save.settings.sfx;

// ---------------------------------------------------------------- boot
toTitle(); $('loading').remove();
if (!MANUAL) requestAnimationFrame(loop);
// test hooks
window.__BB = { VM,
  G, VENUES, TYPES, DIFFS, camera, renderer, scene, startVenue, toTitle, showResults, hitFighter, interact, act,
  step(n = 1) { for (let i = 0; i < n; i++) step(DT); updateHUD(DT); },
  render() { updateHUD(0); render(); },
  press(code) { G.pressed.add(code); }, key(code, v) { G.keys[code] = v; },
  look(dx, dy) { G.look.x += dx; G.look.y += dy; },
  aimAt(x, y, z) { const p = G.player; const dx = x - p.x, dz = z - p.z, dy = y - (1.63 + p.jumpY); p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); camera.rotation.set(p.pitch, p.yaw, 0); camera.position.set(p.x, 1.63 + p.jumpY, p.z); camera.updateMatrixWorld(); },
  markChaos, victory, addProp, fwd, save,
};
