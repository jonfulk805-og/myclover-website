// Fighters: a 15-point skeleton that is either posed procedurally (alive) or
// simulated as a verlet ragdoll (knocked down / KO / grabbed). The mesh is
// always rebuilt from the 15 points, so both modes share one renderer.
import * as THREE from 'three';
import { clamp, lerp, rand, pick, chance } from './util.js';
import { fabric, face } from './textures.js';

export const P = { pelvis: 0, chest: 1, head: 2, lSh: 3, lEl: 4, lHa: 5, rSh: 6, rEl: 7, rHa: 8, lHip: 9, lKn: 10, lFt: 11, rHip: 12, rKn: 13, rFt: 14 };
const STICKS = [[0, 1], [1, 2], [1, 3], [1, 6], [3, 6], [3, 4], [4, 5], [6, 7], [7, 8], [0, 9], [0, 12], [9, 12], [9, 10], [10, 11], [12, 13], [13, 14],
  [3, 0], [6, 0], [9, 1], [12, 1], [2, 3], [2, 6], [3, 9], [6, 12]];
const SOFT = [[3, 5, 0.45], [6, 8, 0.45], [9, 11, 0.5], [12, 14, 0.5], [2, 0, 0.9]]; // min-distance (anti fold)
const PR = [0.12, 0.14, 0.13, 0.08, 0.06, 0.06, 0.08, 0.06, 0.06, 0.08, 0.07, 0.07, 0.08, 0.07, 0.07];

export const SKINS = ['#f1c9a5', '#e0ac85', '#c68863', '#9a6040', '#6e4128', '#ffd9bd'];
export const TYPES = {
  barfly: { name: 'Barfly', hp: 40, s: 0.97, g: 1.18, spd: 2.1, dmg: 7, reach: 0.95, wind: 0.5, cd: [1.1, 2.0], poise: 12, throwP: 0.15, block: 0.05, shirt: ['plaid', '#7a4a2a', '#c9a060'], pants: '#3b3b4a', hat: 'cap', hatC: '#2e5a2e', stache: 0.6, sway: 1 },
  darts: { name: 'Dart Shark', hp: 45, s: 1.0, g: 1.0, spd: 2.4, dmg: 7, reach: 0.95, wind: 0.45, cd: [1.0, 1.8], poise: 12, throwP: 0.65, block: 0.1, shirt: ['stripes', '#1d3d6b', '#d8d8d8'], pants: '#2a2a2a', hat: null, stache: 0.3 },
  brute: { name: 'Dock Brute', hp: 85, s: 1.1, g: 1.38, spd: 1.9, dmg: 13, reach: 1.05, wind: 0.65, cd: [1.4, 2.4], poise: 26, throwP: 0.25, block: 0.1, shirt: ['denim', '#3a5578', '#fff'], pants: '#4a3a28', hat: 'beanie', hatC: '#7a1a1a', beard: 0.6 },
  cowboy: { name: 'Cowpoke', hp: 55, s: 1.02, g: 1.05, spd: 2.4, dmg: 9, reach: 1.0, wind: 0.5, cd: [1.0, 1.9], poise: 15, throwP: 0.45, block: 0.12, shirt: ['plaid', '#8a2a1a', '#e8d0a0'], pants: '#3d4f6a', hat: 'cowboy', hatC: '#6b4a2a', stache: 0.8 },
  biker: { name: 'Biker', hp: 75, s: 1.06, g: 1.25, spd: 2.3, dmg: 11, reach: 1.0, wind: 0.55, cd: [1.1, 2.0], poise: 20, throwP: 0.3, block: 0.18, shirt: ['leather', '#1a1a1a', '#000'], pants: '#22304a', hat: 'bandana', hatC: '#9a1010', beard: 0.85 },
  clubber: { name: 'Club Kid', hp: 45, s: 0.98, g: 0.95, spd: 3.0, dmg: 6, reach: 0.9, wind: 0.35, cd: [0.6, 1.2], poise: 10, throwP: 0.2, block: 0.08, shirt: ['hawaii', '#e0207a', '#ffe14d'], pants: '#111', hat: null, glasses: 0.7 },
  bouncer: { name: 'Bouncer', hp: 110, s: 1.12, g: 1.42, spd: 2.2, dmg: 12, reach: 1.05, wind: 0.55, cd: [1.2, 2.0], poise: 30, throwP: 0.05, block: 0.4, shirt: ['plain', '#0c0c0c', '#000'], pants: '#111', hat: null, glasses: 0.8, tee: 'SECURITY' },
  // bosses
  mick: { name: 'BIG MICK', boss: true, hp: 320, s: 1.32, g: 1.6, spd: 2.2, dmg: 13, reach: 1.15, wind: 0.6, cd: [1.0, 1.8], poise: 60, throwP: 0.15, block: 0.25, shirt: ['plaid', '#145a2a', '#d4a63c'], pants: '#2a2a2a', hat: 'flatcap', hatC: '#4a4a3a', beard: 1, beardC: '#b04a1a', special: ['charge'] },
  boone: { name: '"TWO-BOTTLE" BOONE', boss: true, hp: 280, s: 1.15, g: 1.15, spd: 2.7, dmg: 12, reach: 1.05, wind: 0.5, cd: [0.9, 1.6], poise: 45, throwP: 0.5, block: 0.25, shirt: ['plain', '#2a1a10', '#000'], pants: '#3a2a1a', hat: 'cowboy', hatC: '#111', stache: 1, special: ['barrage'] },
  bassdrop: { name: 'DJ BASSDROP', boss: true, hp: 300, s: 1.2, g: 1.3, spd: 2.6, dmg: 12, reach: 1.05, wind: 0.45, cd: [0.8, 1.5], poise: 45, throwP: 0.2, block: 0.2, shirt: ['sequin', '#5b16a0', '#00e5ff'], pants: '#eee', hat: 'phones', hatC: '#00e5ff', glasses: 1, special: ['stomp'] },
  tank: { name: 'TANK', boss: true, hp: 400, s: 1.36, g: 1.7, spd: 2.1, dmg: 14, reach: 1.15, wind: 0.65, cd: [1.1, 1.9], poise: 70, throwP: 0.15, block: 0.3, shirt: ['leather', '#141414', '#000'], pants: '#1a2438', hat: 'helmet', hatC: '#222', beard: 1, beardC: '#777', special: ['charge', 'stomp'] },
};

const BARKS = {
  start: ['HEY!', 'You spilled my beer!', 'Outside. NOW.', 'You lookin\' at me?', 'Oh, it\'s ON!', 'That\'s my stool!', 'Wanna dance, pal?'],
  hit: ['OOF!', 'MY NOSE!', 'Ow ow ow!', 'Lucky shot!', 'GAH!', 'Not the face!'],
  ko: ['zzz...', 'Mommy...', 'I\'m good...', 'tell my mum...'],
  flee: ['I\'m outta here!', 'Not worth it!', 'CALL A CAB!', 'Nope!'],
  taunt: ['C\'mere!', 'Hold my drink!', 'That all ya got?', 'Get him!', 'Last call, buddy!'],
  boss: ['NOBODY wrecks MY bar!', 'You\'re cut off!', 'Time to settle your tab!'],
};
export function bark(kind) { return pick(BARKS[kind]); }

const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
const sphGeo = new THREE.SphereGeometry(1, 16, 12);
const headGeo = new THREE.SphereGeometry(1, 24, 16); headGeo.rotateY(Math.PI);
const footGeo = new THREE.BoxGeometry(1, 1, 1); footGeo.translate(0, 0, 0.3);
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();

function hatMesh(kind, color) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  if (kind === 'cap') { const c = new THREE.Mesh(new THREE.SphereGeometry(1.03, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); g.add(c); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 16, 1, false, -Math.PI / 2, Math.PI), m); b.position.set(0, 0.05, 0.7); g.add(b); }
  else if (kind === 'beanie') { const c = new THREE.Mesh(new THREE.SphereGeometry(1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.8), m); c.scale.y = 1.15; g.add(c); }
  else if (kind === 'cowboy') { const br = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.08, 20), m); br.position.y = 0.45; br.scale.z = 1.15; g.add(br); const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 0.9, 16), m); cr.position.y = 0.88; g.add(cr); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.96, 0.15, 16), new THREE.MeshStandardMaterial({ color: '#d4a63c', metalness: .6, roughness: .3 })); band.position.y = 0.55; g.add(band); }
  else if (kind === 'flatcap') { const c = new THREE.Mesh(new THREE.SphereGeometry(1.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), m); c.scale.set(1, 0.7, 1.15); c.position.set(0, 0.3, 0.1); g.add(c); }
  else if (kind === 'bandana') { const c = new THREE.Mesh(new THREE.SphereGeometry(1.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), m); g.add(c); const k = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 6), m); k.position.set(0, 0.2, -1.0); k.rotation.x = -1.2; g.add(k); }
  else if (kind === 'phones') { const band = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 6, 20, Math.PI), m); g.add(band); for (const s of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 16), new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: 0.6 })); cup.rotation.z = Math.PI / 2; cup.position.x = s * 1.05; g.add(cup); } }
  else if (kind === 'helmet') { const c = new THREE.Mesh(new THREE.SphereGeometry(1.12, 18, 10, 0, Math.PI * 2, 0, Math.PI / 1.9), new THREE.MeshStandardMaterial({ color, metalness: .7, roughness: .25 })); g.add(c); for (const s of [-1, 1]) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#ccc', metalness: .9, roughness: .2 })); sp.position.set(s * 0.6, 0.85, 0); sp.rotation.z = -s * 0.5; g.add(sp); } }
  return g;
}

let FID = 1;
export class Fighter {
  constructor(type, opts = {}) {
    const T = TYPES[type]; this.T = T; this.type = type; this.id = FID++;
    this.s = T.s * rand(0.97, 1.03); this.g = T.g * rand(0.95, 1.05);
    this.maxHp = T.hp * (opts.hpMul || 1); this.hp = this.maxHp; this.poise = T.poise;
    this.x = opts.x || 0; this.z = opts.z || 0; this.yaw = opts.yaw || 0; this.vx = 0; this.vz = 0;
    this.state = opts.state || 'idle'; this.t = 0; this.st = 0; // st = time in state
    this.walk = rand(0, 6); this.spd = 0; this.guard = 0; this.punchL = 0; this.punchR = 0; this.crouch = 0; this.lean = 0; this.sit = opts.sit ? 1 : 0; this.seatH = opts.seatH || 0.72; this.sway = 0; this.armsUp = 0; this.holdR = 0; this.dance = opts.dance ? 1 : 0;
    this.pts = Array.from({ length: 15 }, () => new THREE.Vector3()); this.prev = Array.from({ length: 15 }, () => new THREE.Vector3()); this.last = Array.from({ length: 15 }, () => new THREE.Vector3());
    this.rest = []; this.rag = false; this.pin = null; this.blend = 0; this.blendFrom = null;
    this.hostile = false; this.target = null; this.mood = 'calm'; this.held = null; this.cool = rand(0.5, 1.5); this.alive = true; this.ko = false; this.dazed = 0; this.flee = false; this.gone = false;
    this.strafe = chance(0.5) ? 1 : -1; this.koT = 0; this.downT = 0; this.impact = 0; this.lastHitBy = null; this.wave = opts.wave || 0;
    this.skin = opts.skin || pick(SKINS); this.faceOpts = { beard: T.beard && chance(T.beard) ? (T.beardC || pick(['#2a1a10', '#5a3a1a', '#8a5a2a', '#222'])) : null, stache: T.stache && chance(T.stache) ? pick(['#2a1a10', '#5a3a1a', '#c08040']) : null, glasses: T.glasses ? chance(T.glasses) : false };
    if (T.beardC) this.faceOpts.beard = T.beardC;
    this.build();
    this.pose(0); for (let i = 0; i < 15; i++) { this.prev[i].copy(this.pts[i]); this.last[i].copy(this.pts[i]); }
  }
  build() {
    const T = this.T, s = this.s, g = this.g;
    const shirtTex = T.shirt[0] === 'plain' ? null : fabric(T.shirt[0], T.shirt[1], T.shirt[2]);
    const shirt = new THREE.MeshStandardMaterial({ color: shirtTex ? '#fff' : T.shirt[1], map: shirtTex, roughness: T.shirt[0] === 'leather' ? 0.45 : 0.85, metalness: T.shirt[0] === 'sequin' ? 0.5 : 0 });
    const pants = new THREE.MeshStandardMaterial({ color: T.pants, map: fabric('denim', '#ffffff', '#fff'), roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: this.skin, roughness: 0.6 });
    const shoe = new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.5 });
    this.faceMat = new THREE.MeshStandardMaterial({ map: face(this.skin, 'calm', this.faceOpts), roughness: 0.6 });
    this.mats = { shirt, pants, skin, shoe };
    const G = this.group = new THREE.Group(); const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; G.add(m); return m; };
    this.torso = add(sphGeo, shirt); this.hips = add(sphGeo, pants); this.headM = add(headGeo, this.faceMat); this.neck = add(cylGeo, skin);
    const sleeves = T.shirt[0] === 'leather' || this.type === 'cowboy' || this.type === 'brute';
    this.limbs = [
      [3, 4, 0.06, add(cylGeo, shirt)], [4, 5, 0.048, add(cylGeo, sleeves ? shirt : skin)], [6, 7, 0.06, add(cylGeo, shirt)], [7, 8, 0.048, add(cylGeo, sleeves ? shirt : skin)],
      [9, 10, 0.08, add(cylGeo, pants)], [10, 11, 0.065, add(cylGeo, pants)], [12, 13, 0.08, add(cylGeo, pants)], [13, 14, 0.065, add(cylGeo, pants)],
    ];
    this.joints = [[3, 0.075, add(sphGeo, shirt)], [6, 0.075, add(sphGeo, shirt)], [4, 0.055, add(sphGeo, sleeves ? shirt : skin)], [7, 0.055, add(sphGeo, sleeves ? shirt : skin)], [10, 0.075, add(sphGeo, pants)], [13, 0.075, add(sphGeo, pants)], [5, 0.062, add(sphGeo, skin)], [8, 0.062, add(sphGeo, skin)]];
    this.feet = [add(footGeo, shoe), add(footGeo, shoe)];
    if (T.hat) { this.hat = hatMesh(T.hat, T.hatC); this.hat.traverse(o => { if (o.isMesh) o.castShadow = true; }); G.add(this.hat); }
    if (T.tee) { // SECURITY print on back
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ffe14d'; x.font = '900 44px Impact, sans-serif'; x.textAlign = 'center'; x.fillText(T.tee, 128, 48);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      this.tee = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.09), new THREE.MeshBasicMaterial({ map: t, transparent: true })); G.add(this.tee);
    }
    // blob shadow
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1; G.add(this.blob);
    // health pip ring above head (only when hurt/hostile)
    this.bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, depthTest: false, transparent: true })); this.bar.renderOrder = 10; this.bar.visible = false; G.add(this.bar);
    this.barCanvas = document.createElement('canvas'); this.barCanvas.width = 128; this.barCanvas.height = 20; this.barTex = new THREE.CanvasTexture(this.barCanvas); this.barTex.colorSpace = THREE.SRGBColorSpace; this.bar.material.map = this.barTex; this.bar.scale.set(0.45, 0.07, 1); this.lastBarHp = -1;
  }
  setMood(m) { if (m === this.mood) return; this.mood = m; this.faceMat.map = face(this.skin, m, this.faceOpts); this.faceMat.needsUpdate = true; }

  // --- procedural pose -------------------------------------------------
  pose(dt) {
    const s = this.s, g = this.g, p = this.pts;
    for (let i = 0; i < 15; i++) this.last[i].copy(p[i]);
    const sw = Math.sin(this.t * 1.7) * this.sway * 0.12, dz = this.dance * Math.sin(this.t * 6.4) * 0.06;
    const cr = this.crouch + this.dance * (0.5 + 0.5 * Math.sin(this.t * 12.8)) * 0.15;
    const L = [];
    const set = (i, x, y, z) => { L[i] = [x, y, z]; };
    if (this.sit > 0.5) {
      const h = this.seatH;
      set(0, 0, h + 0.1, -0.02); set(1, sw * .5, h + 0.52, 0.03 + this.lean * .1); set(2, sw, h + 0.79, 0.05 + this.lean * .1);
      set(9, 0.11 * g, h + 0.06, 0); set(12, -0.11 * g, h + 0.06, 0);
      set(10, 0.13 * g, h + 0.08, 0.42); set(13, -0.13 * g, h + 0.08, 0.42); set(11, 0.13 * g, 0.06, 0.46); set(14, -0.13 * g, 0.06, 0.46);
    } else {
      const py = 0.95 - cr * 0.28;
      set(0, sw * 0.4, py, dz); set(1, sw, py + 0.42, 0.04 + this.lean * 0.17 + dz); set(2, sw * 1.4, py + 0.70, 0.07 + this.lean * 0.24 + dz);
      set(9, 0.11 * g, py - 0.04, 0); set(12, -0.11 * g, py - 0.04, 0);
      for (const [hi, ki, fi, side] of [[9, 10, 11, 1], [12, 13, 14, -1]]) {
        const ph = this.walk + (side > 0 ? 0 : Math.PI), sp = this.spd;
        const stance = this.guard * 0.13 * side;
        const fz = Math.sin(ph) * 0.3 * sp + stance, lift = Math.max(0, Math.cos(ph)) * 0.13 * sp;
        const fx = side * (0.13 * g + this.guard * 0.04);
        set(fi, fx, 0.06 + lift, fz);
        set(ki, side * 0.12 * g, (py - 0.04 + 0.06 + lift) / 2 + 0.02, fz * 0.5 + 0.07 + cr * 0.22);
      }
    }
    const c = L[1];
    set(3, c[0] + 0.2 * g, c[1] + 0.03, c[2]); set(6, c[0] - 0.2 * g, c[1] + 0.03, c[2]);
    // arms
    for (const [si, ei, hi, side, ext] of [[3, 4, 5, 1, this.punchL], [6, 7, 8, -1, this.punchR]]) {
      const sh = L[si], gd = this.guard;
      // relaxed
      let e = [sh[0] + side * 0.04, sh[1] - 0.27, sh[2] + 0.0], h = [sh[0] + side * 0.05, sh[1] - 0.54, sh[2] + 0.05];
      if (this.sit > 0.5 && side < 0) { e = [sh[0] - 0.06, sh[1] - 0.25, sh[2] + 0.12]; h = [sh[0] + 0.02, sh[1] - 0.22, sh[2] + 0.35]; }
      // guard
      const ge = [sh[0] + side * 0.07, sh[1] - 0.22, sh[2] + 0.12], gh = [sh[0] - side * 0.05, sh[1] - 0.02, sh[2] + 0.27];
      e = e.map((v, k) => lerp(v, ge[k], gd)); h = h.map((v, k) => lerp(v, gh[k], gd));
      if (ext > 0) { const pe = [sh[0] + side * 0.02, sh[1] - 0.02, sh[2] + 0.31], ph = [sh[0] - side * 0.14, sh[1] + 0.02, sh[2] + 0.6]; e = e.map((v, k) => lerp(v, pe[k], ext)); h = h.map((v, k) => lerp(v, ph[k], ext)); }
      else if (ext < 0) { const k2 = Math.min(1, -ext / 0.4), we = [sh[0] + side * 0.18, sh[1] - 0.12, sh[2] - 0.12], wh = [sh[0] + side * 0.12, sh[1] + 0.08, sh[2] - 0.04]; e = e.map((v, k) => lerp(v, we[k], k2)); h = h.map((v, k) => lerp(v, wh[k], k2)); }
      if (this.armsUp > 0) { const ue = [sh[0] + side * 0.2, sh[1] + 0.1, sh[2] + 0.05], uh = [sh[0] + side * 0.12, sh[1] + 0.38, sh[2] + 0.08]; e = e.map((v, k) => lerp(v, ue[k], this.armsUp)); h = h.map((v, k) => lerp(v, uh[k], this.armsUp)); }
      if (side < 0 && this.holdR > 0) { const ue = [sh[0] - 0.1, sh[1] + 0.12, sh[2] - 0.12], uh = [sh[0] - 0.05, sh[1] + 0.36, sh[2] - 0.2]; e = e.map((v, k) => lerp(v, ue[k], this.holdR)); h = h.map((v, k) => lerp(v, uh[k], this.holdR)); }
      if (this.dance > 0 && !this.hostile) { const k = Math.sin(this.t * 6.4 + side) * 0.5 + 0.5; h = [h[0] + side * 0.1, h[1] + 0.35 * k, h[2] + 0.1]; e = [e[0] + side * 0.1, e[1] + 0.15 * k, e[2]]; }
      set(ei, ...e); set(hi, ...h);
    }
    // to world
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    for (let i = 0; i < 15; i++) { const [x, y, z] = L[i]; p[i].set(this.x + (x * cy + z * sy) * s, y * s, this.z + (-x * sy + z * cy) * s); }
    if (this.blend > 0 && this.blendFrom) { const k = this.blend; for (let i = 0; i < 15; i++) p[i].lerp(this.blendFrom[i], k); this.blend = Math.max(0, this.blend - dt * 1.8); }
  }

  // --- ragdoll ---------------------------------------------------------
  goRagdoll(imp, at = null) {
    if (!this.rag) {
      this.rag = true;
      for (let i = 0; i < 15; i++) { this.prev[i].lerpVectors(this.pts[i], this.last[i], 0.5); }
      this.rest = STICKS.map(([a, b]) => this.pts[a].distanceTo(this.pts[b]));
    }
    if (imp) this.impulse(imp, at);
  }
  impulse(imp, at = null, dt = 1 / 120) {
    for (let i = 0; i < 15; i++) {
      let w = 1; if (at !== null) { const d = this.pts[i].distanceTo(this.pts[at]); w = clamp(1.3 - d * 1.2, 0.35, 1.3); }
      this.prev[i].addScaledVector(imp, -w * dt);
    }
  }
  stepRagdoll(dt, world, onImpact) {
    const g = 15, damp = 0.996, p = this.pts, pv = this.prev;
    for (let i = 0; i < 15; i++) {
      const vx = (p[i].x - pv[i].x) * damp, vy = (p[i].y - pv[i].y) * damp, vz = (p[i].z - pv[i].z) * damp;
      pv[i].copy(p[i]); p[i].x += vx; p[i].y += vy - g * dt * dt; p[i].z += vz;
    }
    for (let it = 0; it < 8; it++) {
      for (let k = 0; k < STICKS.length; k++) {
        const [a, b] = STICKS[k], A = p[a], B = p[b], r = this.rest[k];
        _v.subVectors(B, A); const d = _v.length() || 1e-6, diff = (d - r) / d * 0.5;
        const wa = this.pin && this.pin.i === a ? 0 : 1, wb = this.pin && this.pin.i === b ? 0 : 1, tw = (wa + wb) || 1;
        A.addScaledVector(_v, diff * 2 * wa / tw); B.addScaledVector(_v, -diff * 2 * wb / tw);
      }
      for (const [a, b, m] of SOFT) { _v.subVectors(p[b], p[a]); const d = _v.length(), min = m * this.s; if (d < min && d > 1e-6) { const diff = (d - min) / d * 0.5; p[a].addScaledVector(_v, diff); p[b].addScaledVector(_v, -diff); } }
      if (this.pin) p[this.pin.i].copy(this.pin.pos);
    }
    // collisions
    for (let i = 0; i < 15; i++) {
      const q = p[i], r = PR[i] * this.s;
      if (q.y < r) {
        const vy = (q.y - pv[i].y) / dt; q.y = r;
        const fr = 0.82; pv[i].x = lerp(pv[i].x, q.x, 1 - fr); pv[i].z = lerp(pv[i].z, q.z, 1 - fr);
        pv[i].y = q.y + (vy < -2 ? vy * dt * 0.25 : 0);
        if (-vy > this.impact) this.impact = -vy;
      }
      for (const b of world.boxes) {
        if (b.dead || q.x < b.x0 - r || q.x > b.x1 + r || q.z < b.z0 - r || q.z > b.z1 + r || q.y < b.y0 - r || q.y > b.y1 + r) continue;
        const sp = _v.subVectors(q, pv[i]).length() / dt;
        const pen = [q.x - (b.x0 - r), (b.x1 + r) - q.x, q.y - (b.y0 - r), (b.y1 + r) - q.y, q.z - (b.z0 - r), (b.z1 + r) - q.z];
        let mi = 0; for (let k = 1; k < 6; k++) if (pen[k] < pen[mi]) mi = k;
        const ax = mi >> 1, sg = mi % 2 ? 1 : -1, key = ax === 0 ? 'x' : ax === 1 ? 'y' : 'z';
        q[key] += sg * pen[mi];
        // reflect a bit: kill normal velocity, friction tangential
        pv[i][key] = q[key] + (q[key] - pv[i][key]) * 0.0 + sg * 0;
        if (ax === 1 && sg > 0) { pv[i].x = lerp(pv[i].x, q.x, 0.25); pv[i].z = lerp(pv[i].z, q.z, 0.25); }
        if (sp > this.impact) this.impact = sp;
        if (sp > 4 && onImpact) onImpact(this, b, sp, q);
      }
      if (this.pin) p[this.pin.i].copy(this.pin.pos);
      // hard room bounds (walls are thin planes visually; never let a body leave the bar)
      if (q.x < -7.5 + r) q.x = -7.5 + r; if (q.x > 7.5 - r) q.x = 7.5 - r; if (q.z < -6 + r) q.z = -6 + r; if (q.z > 6 - r) q.z = 6 - r; if (q.y > 3.6 - r) q.y = 3.6 - r;
    }
    const pel = p[0]; this.x = pel.x; this.z = pel.z;
  }
  ragSpeed() { let m = 0; for (let i = 0; i < 15; i++) m = Math.max(m, this.pts[i].distanceToSquared(this.prev[i])); return Math.sqrt(m) * 120; }
  // leave ragdoll and blend back to the standing pose
  standUp() {
    this.rag = false; this.pin = null;
    this.blendFrom = this.pts.map(v => v.clone()); this.blend = 1;
    // face the direction the body lies
    const h = this.pts[2], pl = this.pts[0]; this.x = pl.x; this.z = pl.z;
  }

  // --- render ---------------------------------------------------------
  updateMesh(cam) {
    const p = this.pts, s = this.s, g = this.g;
    // torso frame
    const up = _v.subVectors(p[1], p[0]).normalize();
    const side = _v2.subVectors(p[3], p[6]); side.addScaledVector(up, -side.dot(up)).normalize();
    const fwd = _v3.crossVectors(side, up).normalize();
    _m.makeBasis(side, up, fwd); _q.setFromRotationMatrix(_m);
    this.torso.position.lerpVectors(p[0], p[1], 0.55); this.torso.quaternion.copy(_q); this.torso.scale.set(0.2 * g * s, 0.3 * s, 0.15 * g * s * (this.T.boss ? 1.15 : 1));
    this.hips.position.copy(p[0]).addScaledVector(up, 0.02 * s); this.hips.quaternion.copy(_q); this.hips.scale.set(0.18 * g * s, 0.12 * s, 0.13 * g * s);
    if (this.tee) { this.tee.position.copy(p[1]).addScaledVector(fwd, -0.155 * g * s).addScaledVector(up, -0.08 * s); this.tee.quaternion.copy(_q); this.tee.rotateY(Math.PI); }
    // head: use neck direction as up
    const hu = new THREE.Vector3().subVectors(p[2], p[1]).normalize(); const hs = side.clone().addScaledVector(hu, -side.dot(hu)).normalize(); const hf = new THREE.Vector3().crossVectors(hs, hu);
    _m.makeBasis(hs, hu, hf); this.headM.quaternion.setFromRotationMatrix(_m); this.headM.position.copy(p[2]); const hr = 0.13 * s * (this.T.boss ? 1.08 : 1); this.headM.scale.set(hr, hr * 1.08, hr);
    if (this.hat) { this.hat.position.copy(p[2]).addScaledVector(hu, hr * 0.25); this.hat.quaternion.copy(this.headM.quaternion); this.hat.scale.setScalar(hr); }
    this.seg(this.neck, p[1], p[2], 0.05 * s * g, 0.6);
    for (const [a, b, r, m] of this.limbs) this.seg(m, p[a], p[b], r * s * (a >= 9 ? g * 0.9 : g * 0.85));
    for (const [i, r, m] of this.joints) { m.position.copy(p[i]); m.scale.setScalar(r * s * (i === 5 || i === 8 ? 1 : g * 0.85)); }
    // feet
    const ff = fwd.clone(); ff.y = 0; if (ff.lengthSq() < 1e-4) ff.set(0, 0, 1); ff.normalize();
    for (const [k, i] of [[0, 11], [1, 14]]) { const m = this.feet[k]; m.position.copy(p[i]); m.position.y -= 0.03 * s; _m.lookAt(new THREE.Vector3(), ff, UP); m.quaternion.setFromRotationMatrix(_m); m.rotateY(Math.PI); m.scale.set(0.11 * s, 0.08 * s, 0.26 * s); }
    this.blob.position.set(p[0].x, 0.012, p[0].z); this.blob.scale.setScalar(this.rag ? 1.4 : 1); this.blob.material.opacity = clamp(0.38 - p[0].y * 0.12, 0.08, 0.38);
    // health bar
    const show = (this.hostile || this.hp < this.maxHp) && !this.ko && this.alive && (!cam || cam.position.distanceTo(this.pts[2]) > 1.7);
    this.bar.visible = show;
    if (show) {
      this.bar.position.copy(p[2]); this.bar.position.y += 0.32 * s + (this.hat ? 0.08 : 0);
      if (Math.round(this.hp) !== this.lastBarHp) {
        this.lastBarHp = Math.round(this.hp); const x = this.barCanvas.getContext('2d'), f = clamp(this.hp / this.maxHp, 0, 1);
        x.clearRect(0, 0, 128, 20); x.fillStyle = 'rgba(0,0,0,.65)'; x.beginPath(); x.roundRect(0, 2, 128, 16, 8); x.fill();
        const gr = x.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, f < .35 ? '#ff3b3b' : '#ffd23f'); gr.addColorStop(1, f < .35 ? '#ff8a3b' : '#3cff8a');
        x.fillStyle = gr; x.beginPath(); x.roundRect(3, 5, 122 * f, 10, 5); x.fill(); this.barTex.needsUpdate = true;
      }
    }
  }
  seg(m, a, b, r, lenMul = 1) {
    _v.subVectors(b, a); const len = _v.length() * lenMul;
    m.position.lerpVectors(a, b, lenMul === 1 ? 0.5 : 0.5); if (len < 1e-5) return;
    _q.setFromUnitVectors(UP, _v.normalize()); m.quaternion.copy(_q); m.scale.set(r, len, r);
  }
  // world-space hit targets for strikes
  targets() { return [[2, 0.17 * this.s * 1.1, 'head'], [1, 0.24 * this.s * this.g, 'body'], [0, 0.22 * this.s * this.g, 'body']]; }
  dispose(scene) { scene.remove(this.group); }
}
