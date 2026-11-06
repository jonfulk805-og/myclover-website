// DEAD ACRES - zombie models, animation, analytic hit volumes
import * as THREE from 'three';
import { skin, face, cloth, tex } from './farmtex.js';

let G = null, MATS = null;
function init() {
  if (G) return;
  G = {
    torso: new THREE.CapsuleGeometry(0.22, 0.32, 4, 10).translate(0, 0.36, 0),
    belly: new THREE.CapsuleGeometry(0.17, 0.14, 4, 10).translate(0, 0.1, 0),
    head: new THREE.SphereGeometry(0.155, 16, 12).rotateY(Math.PI),
    jaw: new THREE.BoxGeometry(0.16, 0.06, 0.12).translate(0, -0.03, 0.05),
    upper: new THREE.CapsuleGeometry(0.07, 0.22, 3, 8).translate(0, -0.14, 0),
    lower: new THREE.CapsuleGeometry(0.05, 0.22, 3, 8).translate(0, -0.14, 0),
    hand: new THREE.CapsuleGeometry(0.035, 0.07, 3, 6).scale(1.3, 1, 0.7).translate(0, -0.07, 0),
    finger: new THREE.CapsuleGeometry(0.012, 0.06, 2, 4).translate(0, -0.04, 0),
    thigh: new THREE.CapsuleGeometry(0.1, 0.3, 3, 8).translate(0, -0.2, 0),
    shin: new THREE.CapsuleGeometry(0.085, 0.32, 3, 8).translate(0, -0.21, 0),
    foot: new THREE.BoxGeometry(0.11, 0.08, 0.24).translate(0, -0.04, 0.05),
    eye: new THREE.SphereGeometry(0.022, 8, 6),
    hat: new THREE.CylinderGeometry(0.17, 0.32, 0.12, 14),
    hatTop: new THREE.CylinderGeometry(0.14, 0.17, 0.12, 14),
    strap: new THREE.BoxGeometry(0.05, 0.45, 0.02),
    scythe: new THREE.CylinderGeometry(0.025, 0.025, 1.9, 6),
    blade: new THREE.BoxGeometry(0.9, 0.12, 0.02),
    stump: new THREE.CylinderGeometry(0.07, 0.09, 0.06, 8),
  };
  MATS = {
    skin: [0, 1, 2, 3].map((i) => new THREE.MeshStandardMaterial({ map: tex(skin(70 + i * 18, i)), roughness: 0.75 })),
    face: [0, 1, 2, 3].map((i) => new THREE.MeshStandardMaterial({ map: tex(face(i)), roughness: 0.7 })),
    shirt: [tex(cloth('plaid', 0)), tex(cloth('plaid', 1)), tex(cloth('plaid', 2)), tex(cloth('tee', 3)), tex(cloth('jacket', 4)), tex(cloth('plaid', 3))].map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 })),
    pants: [tex(cloth('denim', 5)), tex(cloth('denim', 6)), tex(cloth('jacket', 7))].map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 })),
    burlap: new THREE.MeshStandardMaterial({ map: tex(cloth('burlap', 9)), roughness: 1 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.8 }),
    straw: new THREE.MeshStandardMaterial({ color: 0xb89a52, roughness: 0.95 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffb020 }),
    eyeBoss: new THREE.MeshBasicMaterial({ color: 0xff4010 }),
    eyeInsta: new THREE.MeshBasicMaterial({ color: 0x7dff5a }),
    blood: new THREE.MeshStandardMaterial({ color: 0x4a0606, roughness: 0.4 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x55585e, metalness: 0.9, roughness: 0.35 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3e24, roughness: 0.8 }),
  };
}

const pick = (a) => a[(Math.random() * a.length) | 0];
function mesh(geo, mat, cast) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; return m; }

// builds a rig. type: walker|runner|brute
export function makeZombie(type, shadows) {
  init();
  const boss = type === 'brute';
  const sk = boss ? MATS.burlap : pick(MATS.skin), fc = boss ? MATS.burlap : pick(MATS.face), sh = boss ? MATS.burlap : pick(MATS.shirt), pa = pick(MATS.pants);
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(mesh(G.torso, sh, shadows)); const belly = mesh(G.belly, pa, shadows); torso.add(belly);
  if (!boss && Math.random() < 0.4) { for (const s of [-1, 1]) { const st = mesh(G.strap, pa, false); st.position.set(s * 0.1, 0.38, 0.19); st.rotation.x = -0.12; torso.add(st); } }
  const neck = new THREE.Group(); neck.position.y = 0.74; torso.add(neck);
  const head = new THREE.Group(); head.position.y = 0.12; neck.add(head);
  const skull = mesh(G.head, fc, shadows); skull.scale.set(1, 1.12, 1.05); head.add(skull);
  const jaw = mesh(G.jaw, sk, false); jaw.position.set(0, -0.1, 0.03); head.add(jaw);
  const eyes = [];
  for (const s of [-1, 1]) { const e = mesh(G.eye, boss ? MATS.eyeBoss : MATS.eye, false); e.position.set(s * 0.055, 0.02, 0.145); head.add(e); eyes.push(e); }
  if (boss || Math.random() < 0.3) { const hat = mesh(G.hat, MATS.straw, false); hat.position.y = 0.13; head.add(hat); const ht = mesh(G.hatTop, MATS.straw, false); ht.position.y = 0.2; head.add(ht); }
  const stump = mesh(G.stump, MATS.blood, false); stump.position.y = 0.76; stump.visible = false; torso.add(stump);
  const arm = (s) => {
    const sh0 = new THREE.Group(); sh0.position.set(s * 0.27, 0.62, 0); torso.add(sh0);
    sh0.add(mesh(G.upper, sh, shadows));
    const el = new THREE.Group(); el.position.y = -0.3; sh0.add(el); el.add(mesh(G.lower, sk, shadows));
    const hd = mesh(G.hand, sk, false); hd.position.y = -0.3; el.add(hd);
    for (let f = 0; f < 3; f++) { const fg = mesh(G.finger, sk, false); fg.position.set((f - 1) * 0.025, -0.13, 0.01); fg.rotation.x = -0.3 - f * 0.2; hd.add(fg); }
    return { sh: sh0, el, hd };
  };
  const leg = (s) => {
    const hp = new THREE.Group(); hp.position.set(s * 0.11, 0, 0); hips.add(hp);
    hp.add(mesh(G.thigh, pa, shadows));
    const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn); kn.add(mesh(G.shin, pa, shadows));
    const ft = mesh(G.foot, MATS.boot, false); ft.position.y = -0.46; kn.add(ft);
    return { hp, kn };
  };
  const aL = arm(-1), aR = arm(1), lL = leg(-1), lR = leg(1);
  let weapon = null;
  if (boss) { weapon = new THREE.Group(); const pole = mesh(G.scythe, MATS.wood, shadows); weapon.add(pole); const bl = mesh(G.blade, MATS.iron, shadows); bl.position.set(0.4, 0.9, 0); bl.rotation.z = -0.25; weapon.add(bl); weapon.position.set(0, -0.32, 0.05); weapon.rotation.x = Math.PI / 2; aR.el.add(weapon); }
  const s = boss ? 1.5 : 0.92 + Math.random() * 0.16; root.scale.setScalar(s);
  return { root, hips, torso, neck, head, jaw, eyes, stump, aL, aR, lL, lR, scale: s, weapon };
}

export function setEyes(r, insta) { init(); for (const e of r.eyes) e.material = insta ? MATS.eyeInsta : (r.weapon ? MATS.eyeBoss : MATS.eye); }

// lean forward angle (rad) by type
export const LEAN = { walker: 0.22, runner: 0.42, brute: 0.12 };

// animation. z: zombie state, t: anim clock
export function poseZombie(z, dt) {
  const r = z.rig; if (!r) return;
  r.root.position.set(z.x, z.y || 0, z.z); r.root.rotation.y = z.yaw;
  if (z.state === 'dead') {
    const k = Math.min(1, z.deadT / 0.55), e = k * k;
    const dir = z.fallDir || -1;
    r.root.rotation.x = dir * 1.45 * e; r.root.position.y = (z.y || 0) - Math.max(0, z.deadT - 3) * 0.35;
    r.hips.position.y = 0.95 - e * 0.75 + (dir > 0 ? 0 : 0);
    r.aL.sh.rotation.x = -1.2 * (1 - e) - 0.4; r.aR.sh.rotation.x = -1.0 * (1 - e) + 0.3; r.aL.sh.rotation.z = -0.6 * e; r.aR.sh.rotation.z = 0.6 * e;
    r.lL.hp.rotation.x = 0.3 * e; r.lR.hp.rotation.x = -0.2 * e; r.lL.kn.rotation.x = 0.4 * e;
    return;
  }
  const ph = z.ph, sp = z.moving;
  const L = (z.crawler ? 1.45 : LEAN[z.type]) + Math.sin(z.ph * 0.5 + z.seed) * 0.04;
  if (z.crawler) {
    r.hips.position.y = 0.22; r.torso.rotation.x = L; r.torso.rotation.z = Math.sin(ph) * 0.12;
    r.neck.rotation.x = -1.1; r.head.rotation.z = Math.sin(ph * 0.5) * 0.2;
    r.aL.sh.rotation.x = -2.4 + Math.sin(ph) * 0.7 * sp; r.aR.sh.rotation.x = -2.4 - Math.sin(ph) * 0.7 * sp;
    r.aL.el.rotation.x = -0.6 - Math.max(0, Math.cos(ph)) * 0.8; r.aR.el.rotation.x = -0.6 - Math.max(0, -Math.cos(ph)) * 0.8;
    r.lL.hp.visible = false; r.lR.hp.visible = false; return;
  }
  r.lL.hp.visible = true; r.lR.hp.visible = true;
  const run = z.type === 'runner' || z.charging;
  const amp = (run ? 0.85 : 0.45) * sp;
  r.hips.position.y = 0.95 - Math.abs(Math.sin(ph)) * (run ? 0.07 : 0.03) * sp;
  r.hips.rotation.y = Math.sin(ph) * 0.12 * sp; r.hips.rotation.z = Math.sin(ph) * (z.type === 'walker' ? 0.08 : 0.03);
  r.torso.rotation.x = L; r.torso.rotation.y = -Math.sin(ph) * 0.18 * sp; r.torso.rotation.z = z.limp ? 0.18 : 0;
  r.neck.rotation.x = -L * 0.7 + Math.sin(ph * 0.7 + z.seed) * 0.08; r.neck.rotation.z = z.tilt + Math.sin(ph * 0.31) * 0.08;
  r.jaw.rotation.x = 0.15 + Math.max(0, Math.sin(z.t * 7 + z.seed)) * 0.35;
  r.lL.hp.rotation.x = Math.sin(ph) * amp; r.lR.hp.rotation.x = -Math.sin(ph) * amp;
  r.lL.kn.rotation.x = Math.max(0, -Math.cos(ph)) * amp * 1.4 + 0.1; r.lR.kn.rotation.x = Math.max(0, Math.cos(ph)) * amp * 1.4 + 0.1;
  // arms: reach forward (walker), pump (runner), swipe (attack)
  if (z.atk > 0) {
    const k = 1 - z.atk / z.atkDur, sw = Math.sin(Math.min(1, k * 1.4) * Math.PI);
    const side = z.atkSide;
    (side > 0 ? r.aR : r.aL).sh.rotation.x = -2.6 + sw * 2.2; (side > 0 ? r.aR : r.aL).sh.rotation.z = side * (0.4 - sw * 0.9);
    (side > 0 ? r.aL : r.aR).sh.rotation.x = -1.2; (side > 0 ? r.aL : r.aR).sh.rotation.z = 0;
    r.aL.el.rotation.x = -0.3; r.aR.el.rotation.x = -0.3;
  } else if (run && !r.weapon) {
    r.aL.sh.rotation.x = -0.4 - Math.sin(ph) * 0.9 * sp; r.aR.sh.rotation.x = -0.4 + Math.sin(ph) * 0.9 * sp; r.aL.el.rotation.x = -1.3; r.aR.el.rotation.x = -1.3; r.aL.sh.rotation.z = -0.15; r.aR.sh.rotation.z = 0.15;
  } else {
    const reach = r.weapon ? -0.9 : -1.45 - L * 0.6;
    r.aL.sh.rotation.x = reach + Math.sin(ph + 1) * 0.15; r.aR.sh.rotation.x = (r.weapon ? -0.5 : reach) + Math.sin(ph) * 0.15;
    r.aL.sh.rotation.z = 0.28 + Math.sin(ph * 0.5) * 0.05; r.aR.sh.rotation.z = r.weapon ? 0.12 : -0.22;
    if (z.oneArm) { r.aR.sh.rotation.x = 0.1 + Math.sin(ph) * 0.2; r.aR.sh.rotation.z = 0.08; }
    r.aL.el.rotation.x = -0.25 + Math.sin(ph * 1.3 + z.seed) * 0.15; r.aR.el.rotation.x = -0.35;
  }
  if (z.armGone) { r.aR.el.visible = false; }
}

// --- analytic hit volumes ---
// returns {head:[x,y,z,r], body:[ax,ay,az,bx,by,bz,r], legs:[...]} in world space
export function hitVolumes(z) {
  const v = hitVolumes0(z), y = z.y || 0; if (y) { v.head[1] += y; v.body[1] += y; v.body[4] += y; if (v.legs) { v.legs[1] += y; v.legs[4] += y; } } return v;
}
function hitVolumes0(z) {
  const s = z.scale, fx = Math.sin(z.yaw), fz = Math.cos(z.yaw);
  if (z.crawler) {
    const hx = z.x, hz = z.z, y = 0.25 * s;
    return { head: [hx + fx * 0.85 * s, 0.32 * s, hz + fz * 0.85 * s, 0.17 * s], body: [hx - fx * 0.1 * s, y, hz - fz * 0.1 * s, hx + fx * 0.62 * s, y, hz + fz * 0.62 * s, 0.22 * s], legs: null };
  }
  const L = LEAN[z.type], hy = 0.95 * s, len = 0.86 * s;
  const head = [z.x + fx * Math.sin(L) * len, hy + Math.cos(L) * len, z.z + fz * Math.sin(L) * len, 0.18 * s];
  const cl = 0.62 * s;
  const body = [z.x, hy - 0.05 * s, z.z, z.x + fx * Math.sin(L) * cl, hy + Math.cos(L) * cl, z.z + fz * Math.sin(L) * cl, 0.25 * s];
  const legs = [z.x, 0.1, z.z, z.x, hy - 0.08 * s, z.z, 0.19 * s];
  return { head, body, legs };
}

// ray (o, unit d) vs sphere -> t or -1
export function raySphere(ox, oy, oz, dx, dy, dz, s) {
  const lx = s[0] - ox, ly = s[1] - oy, lz = s[2] - oz; const tc = lx * dx + ly * dy + lz * dz; if (tc < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tc * tc, r2 = s[3] * s[3]; if (d2 > r2) return -1; return tc - Math.sqrt(r2 - d2);
}
// ray vs capsule (segment a-b, radius r): approximate t of closest approach if within r
export function rayCapsule(ox, oy, oz, dx, dy, dz, c) {
  const ax = c[0], ay = c[1], az = c[2], ux = c[3] - ax, uy = c[4] - ay, uz = c[5] - az, r = c[6];
  const wx = ox - ax, wy = oy - ay, wz = oz - az;
  const a = 1, b = dx * ux + dy * uy + dz * uz, cc = ux * ux + uy * uy + uz * uz, d = dx * wx + dy * wy + dz * wz, e = ux * wx + uy * wy + uz * wz;
  const den = a * cc - b * b; let sc, tc;
  if (den < 1e-8) { sc = 0; tc = cc > 0 ? e / cc : 0; } else { sc = (b * e - cc * d) / den; tc = (a * e - b * d) / den; }
  tc = Math.max(0, Math.min(1, tc));
  // recompute sc for clamped tc
  sc = (tc * b - d); if (sc < 0) return -1;
  const px = ox + dx * sc - (ax + ux * tc), py = oy + dy * sc - (ay + uy * tc), pz = oz + dz * sc - (az + uz * tc);
  const dist2 = px * px + py * py + pz * pz; if (dist2 > r * r) return -1;
  return sc - Math.sqrt(r * r - dist2);
}
