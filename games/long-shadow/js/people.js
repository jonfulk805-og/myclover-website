// LONG SHADOW - people: guards and targets. Procedural rigs, poses, death, hit volumes.
import * as THREE from 'three';
import { canvas, rng, toTex } from './textures.js';

let GEO = null; const MATC = {};
function geos() {
  if (GEO) return GEO;
  GEO = {
    pelvis: new THREE.CapsuleGeometry(0.15, 0.1, 3, 8).scale(1.15, 1, 0.8),
    chest: new THREE.CapsuleGeometry(0.17, 0.3, 4, 10).scale(1.2, 1, 0.78).translate(0, 0.3, 0),
    vest: new THREE.BoxGeometry(0.44, 0.38, 0.32).translate(0, 0.32, 0),
    pouch: new THREE.BoxGeometry(0.09, 0.12, 0.06),
    neck: new THREE.CylinderGeometry(0.055, 0.065, 0.12, 8),
    head: new THREE.SphereGeometry(0.115, 14, 10).scale(0.92, 1.1, 1),
    upper: new THREE.CapsuleGeometry(0.058, 0.22, 3, 8).translate(0, -0.15, 0),
    lower: new THREE.CapsuleGeometry(0.048, 0.22, 3, 8).translate(0, -0.14, 0),
    hand: new THREE.BoxGeometry(0.07, 0.1, 0.045).translate(0, -0.05, 0),
    thigh: new THREE.CapsuleGeometry(0.085, 0.3, 3, 8).translate(0, -0.22, 0),
    shin: new THREE.CapsuleGeometry(0.068, 0.32, 3, 8).translate(0, -0.22, 0),
    foot: new THREE.BoxGeometry(0.1, 0.08, 0.26).translate(0, -0.04, 0.05),
    helmet: new THREE.SphereGeometry(0.135, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    cap: new THREE.CylinderGeometry(0.12, 0.125, 0.09, 14),
    brim: new THREE.BoxGeometry(0.2, 0.015, 0.12),
    beret: new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.45).scale(1.1, 0.55, 1),
    fedora: new THREE.CylinderGeometry(0.11, 0.12, 0.12, 14), fedBrim: new THREE.CylinderGeometry(0.21, 0.21, 0.015, 18),
    shades: new THREE.BoxGeometry(0.2, 0.04, 0.03),
    tie: new THREE.BoxGeometry(0.05, 0.3, 0.015),
    coatTail: new THREE.BoxGeometry(0.36, 0.3, 0.24),
    binoc: new THREE.BoxGeometry(0.14, 0.06, 0.12),
    phone: new THREE.BoxGeometry(0.04, 0.12, 0.015),
    cig: new THREE.CylinderGeometry(0.006, 0.006, 0.07, 4),
    radio: new THREE.BoxGeometry(0.06, 0.12, 0.04),
    // rifle parts
    rRecv: new THREE.BoxGeometry(0.06, 0.1, 0.42), rBarrel: new THREE.CylinderGeometry(0.014, 0.014, 0.42, 6).rotateX(Math.PI / 2),
    rStock: new THREE.BoxGeometry(0.05, 0.12, 0.26), rMag: new THREE.BoxGeometry(0.045, 0.16, 0.07), rGrip: new THREE.BoxGeometry(0.04, 0.1, 0.05),
  };
  return GEO;
}
function std(hex, r = 0.85, m = 0) { const k = hex + ':' + r + ':' + m; return MATC[k] || (MATC[k] = new THREE.MeshStandardMaterial({ color: hex, roughness: r, metalness: m })); }
function camoTex(base, seed) {
  const R = rng(seed), [c, x] = canvas(128, 128); x.fillStyle = base[0]; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) { x.fillStyle = base[1 + (i % (base.length - 1))]; x.beginPath(); x.ellipse(R() * 128, R() * 128, 5 + R() * 14, 3 + R() * 8, R() * 3, 0, 7); x.fill(); }
  return toTex(c, [2, 2]);
}
function faceTex(skin, seed) {
  const R = rng(seed), [c, x] = canvas(128, 128); x.fillStyle = skin; x.fillRect(0, 0, 128, 128);
  // SphereGeometry: +z (front) sits at u=0.25
  const fx = 32; x.fillStyle = 'rgba(30,20,15,0.85)'; x.fillRect(fx - 14, 54, 8, 4); x.fillRect(fx + 6, 54, 8, 4);
  x.fillStyle = 'rgba(80,40,35,0.6)'; x.fillRect(fx - 7, 78, 14, 3);
  x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(fx - 2, 58, 4, 14);
  if (R() < 0.5) { x.fillStyle = 'rgba(30,22,16,0.35)'; x.fillRect(fx - 16, 70, 32, 20); }
  x.fillStyle = 'rgba(25,18,12,0.9)'; x.fillRect(0, 0, 128, 34); x.fillRect(fx + 30, 30, 70, 46);
  return toTex(c);
}
const SKIN = ['#c99a7a', '#a87454', '#7b4f36', '#e0b494', '#5c3a26', '#b9876a'];
const mesh = (g, m, cast) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; return o; };

// look: {kind:'guard'|'target', outfit, hat, ...}
export function makePerson(look, shadows) {
  const G = geos(); const R = rng(look.seed || 1);
  const skin = look.skin || SKIN[(R() * SKIN.length) | 0];
  const top = look.top instanceof THREE.Material ? look.top : look.camo ? new THREE.MeshStandardMaterial({ map: camoTex(look.camo, look.seed || 3), roughness: 0.95 }) : std(look.top || 0x4b5233, 0.9);
  const bottom = look.bottom instanceof THREE.Material ? look.bottom : look.camo ? top : std(look.bottom || 0x3d4230, 0.9);
  const skinM = std(skin, 0.7), boot = std(0x1c1814, 0.7), faceM = new THREE.MeshStandardMaterial({ map: faceTex(skin, look.seed || 5), roughness: 0.7 });
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  hips.add(mesh(G.pelvis, bottom, shadows));
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(mesh(G.chest, top, shadows));
  if (look.vest) { torso.add(mesh(G.vest, std(look.vest, 0.9), shadows)); for (const px of [-0.12, 0, 0.12]) { const p = mesh(G.pouch, std(look.vest, 0.9), false); p.position.set(px, 0.22, 0.18); torso.add(p); } const rd = mesh(G.radio, std(0x1a1a1a, 0.6), false); rd.position.set(0.17, 0.46, 0.15); torso.add(rd); }
  if (look.tie) { const t = mesh(G.tie, std(look.tie, 0.6), false); t.position.set(0, 0.36, 0.135); t.rotation.x = -0.12; torso.add(t); }
  if (look.coat) { const c = mesh(G.coatTail, top, shadows); c.position.set(0, -0.12, 0); hips.add(c); }
  const neck = new THREE.Group(); neck.position.y = 0.6; torso.add(neck); neck.add(mesh(G.neck, skinM, false));
  const head = new THREE.Group(); head.position.y = 0.13; neck.add(head);
  const hd = mesh(G.head, faceM, shadows); hd.rotation.y = 0; head.add(hd);
  if (look.hat === 'helmet') { const h = mesh(G.helmet, std(look.hatColor || 0x3b4128, 0.8), shadows); h.position.y = 0.015; h.scale.set(1, 1, 1.08); head.add(h); }
  else if (look.hat === 'cap') { const h = mesh(G.cap, std(look.hatColor || 0x3b4128, 0.9), shadows); h.position.y = 0.09; head.add(h); const b = mesh(G.brim, std(look.hatColor || 0x3b4128, 0.9), false); b.position.set(0, 0.06, 0.12); head.add(b); }
  else if (look.hat === 'beret') { const h = mesh(G.beret, std(look.hatColor || 0x8a1010, 0.9), shadows); h.position.set(0.02, 0.07, 0); h.rotation.z = -0.25; head.add(h); }
  else if (look.hat === 'fedora') { const h = mesh(G.fedora, std(look.hatColor || 0xe8e4d8, 0.8), shadows); h.position.y = 0.12; head.add(h); const b = mesh(G.fedBrim, std(look.hatColor || 0xe8e4d8, 0.8), shadows); b.position.y = 0.075; head.add(b); }
  else { const hair = mesh(G.helmet, std(look.hair || 0x1c1410, 0.95), false); hair.scale.set(0.9, 0.75, 0.95); hair.position.set(0, 0.03, -0.01); head.add(hair); }
  if (look.shades) { const s = mesh(G.shades, std(0x050505, 0.1, 0.8), false); s.position.set(0, 0.02, 0.105); head.add(s); }
  // arms
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.215, 0.5, 0); torso.add(sh);
    sh.add(mesh(G.upper, top, shadows));
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el); el.add(mesh(G.lower, top, shadows));
    const hand = new THREE.Group(); hand.position.y = -0.28; el.add(hand); hand.add(mesh(G.hand, look.gloves ? std(0x1a1a18, 0.8) : skinM, false));
    return { sh, el, hand };
  };
  const L = arm(-1), Rr = arm(1);
  const leg = (side) => {
    const th = new THREE.Group(); th.position.set(side * 0.1, -0.02, 0); hips.add(th); th.add(mesh(G.thigh, bottom, shadows));
    const kn = new THREE.Group(); kn.position.y = -0.45; th.add(kn); kn.add(mesh(G.shin, bottom, shadows));
    const ft = new THREE.Group(); ft.position.y = -0.46; kn.add(ft); ft.add(mesh(G.foot, boot, shadows));
    return { th, kn, ft };
  };
  const LL = leg(-1), RL = leg(1);
  // props
  let rifle = null;
  if (look.rifle) {
    rifle = new THREE.Group(); const gm = std(0x1b1d1f, 0.5, 0.6), wm = std(0x3a3328, 0.8);
    const add = (g, m, x, y, z) => { const o = mesh(g, m, shadows); o.position.set(x, y, z); rifle.add(o); return o; };
    add(G.rRecv, gm, 0, 0, 0); add(G.rBarrel, gm, 0, 0.02, 0.4); add(G.rStock, wm, 0, -0.02, -0.32); add(G.rMag, gm, 0, -0.12, 0.08).rotation.x = 0.25; add(G.rGrip, gm, 0, -0.08, -0.1).rotation.x = -0.3;
    torso.add(rifle);
  }
  const extra = {};
  if (look.binoc) { const b = mesh(G.binoc, std(0x161616, 0.5, 0.4), false); b.position.set(0.035, -0.06, 0.05); L.hand.add(b); b.visible = false; extra.binoc = b; }
  if (look.phone) { const p = mesh(G.phone, std(0x0a0a0a, 0.3, 0.5), false); p.position.set(0, -0.07, 0.03); Rr.hand.add(p); p.visible = false; extra.phone = p; }
  if (look.cig) { const c = mesh(G.cig, std(0xf2eee0, 0.8), false); c.rotation.x = Math.PI / 2; c.position.set(0, -0.1, 0.05); Rr.hand.add(c); extra.cig = c; const ember = mesh(new THREE.SphereGeometry(0.008, 4, 3), new THREE.MeshBasicMaterial({ color: 0xff5010 }), false); ember.position.set(0, -0.04, 0); c.add(ember); }
  const rig = { root, hips, torso, neck, head, L, R: Rr, LL, RL, rifle, extra, look };
  return rig;
}

// ---------- posing ----------
const lerp = (a, b, t) => a + (b - a) * t;
// pose: {walk:0..1 amp, phase, act:'idle'|'binoc'|'phone'|'smoke'|'talk'|'aim'|'crouch'|'run'|'panic'|'wave', headYaw, t}
export function poseRig(r, s) {
  const { hips, torso, neck, head, L, R, LL, RL, rifle } = r; const ph = s.phase || 0, w = s.walk || 0, t = s.t || 0;
  const run = s.act === 'run' || s.act === 'panic' ? 1 : 0;
  const amp = w * (run ? 1.35 : 1);
  // legs
  const sw = Math.sin(ph) * 0.55 * amp;
  LL.th.rotation.set(sw, 0, 0); RL.th.rotation.set(-sw, 0, 0);
  LL.kn.rotation.x = Math.max(0, Math.sin(ph - 1.2)) * 0.9 * amp + 0.03; RL.kn.rotation.x = Math.max(0, Math.sin(ph + Math.PI - 1.2)) * 0.9 * amp + 0.03;
  LL.ft.rotation.x = -LL.kn.rotation.x * 0.3; RL.ft.rotation.x = -RL.kn.rotation.x * 0.3;
  hips.position.y = 0.95 - Math.abs(Math.cos(ph)) * 0.035 * amp + Math.sin(t * 1.7) * 0.004;
  hips.rotation.set(0, Math.sin(ph) * 0.08 * amp, 0);
  torso.rotation.set(run * 0.25 + 0.02, -Math.sin(ph) * 0.1 * amp, 0);
  neck.rotation.set(-run * 0.2, 0, 0);
  head.rotation.set(s.headPitch || 0, s.headYaw || 0, 0);
  // crouch
  if (s.act === 'crouch') { hips.position.y = 0.62; LL.th.rotation.x = -1.3; LL.kn.rotation.x = 2.0; RL.th.rotation.x = -0.4; RL.kn.rotation.x = 1.9; RL.ft.rotation.x = 0.5; torso.rotation.x = 0.25; }
  // arms
  const armSw = Math.sin(ph) * 0.5 * amp;
  const setA = (a, sx, sz, ex, sy = 0) => { a.sh.rotation.set(sx, sy, sz); a.el.rotation.set(ex, 0, 0); };
  setA(L, -armSw, 0.08, -0.25 - Math.max(0, -armSw) * 0.3); setA(R, armSw, -0.08, -0.25 - Math.max(0, armSw) * 0.3);
  if (rifle) {
    if (s.act === 'aim' || s.act === 'crouch') {
      rifle.position.set(0.1, 0.48, 0.32); rifle.rotation.set(-(s.aimPitch || 0), 0, 0);
      setA(R, -1.45, -0.25, -0.9, 0.2); setA(L, -1.5, 0.5, -0.4, -0.5);
    } else {
      rifle.position.set(0.0, 0.28, 0.24); rifle.rotation.set(0.55, -0.9, 0.25);
      setA(R, -0.35 + armSw * 0.1, -0.3, -1.25); setA(L, -0.85 - armSw * 0.1, 0.45, -1.1, -0.2);
    }
  }
  const ex = r.extra;
  if (ex.binoc) ex.binoc.visible = false; if (ex.phone) ex.phone.visible = false;
  if (s.act === 'binoc') { setA(L, -2.6, 0.55, -0.4, 0.0); setA(R, -2.6, -0.55, -0.4, 0.0); if (ex.binoc) ex.binoc.visible = true; head.rotation.x = (s.headPitch || 0); }
  else if (s.act === 'phone') { setA(R, -0.55, -0.15, -2.45, 0.3); if (ex.phone) ex.phone.visible = true; }
  else if (s.act === 'smoke') { const k = (Math.sin(t * 0.9) > 0.55) ? 1 : 0.15; setA(R, lerp(-0.2, -0.85, k), -0.12, lerp(-0.6, -2.3, k), 0.35 * k); }
  else if (s.act === 'talk') { setA(R, -0.6 + Math.sin(t * 2.3) * 0.25, -0.2, -1.2 + Math.sin(t * 3.1) * 0.3); setA(L, -0.4 + Math.sin(t * 1.7 + 1) * 0.2, 0.15, -0.9); }
  else if (s.act === 'panic') { setA(L, -0.3 + Math.sin(ph) * 0.9, 0.2, -1.2); setA(R, -0.3 - Math.sin(ph) * 0.9, -0.2, -1.2); }
  else if (s.act === 'wave') { setA(R, -2.8, -0.3 + Math.sin(t * 7) * 0.25, -0.2); }
  else if (s.act === 'hands') { setA(L, -0.1, 0.06, 0, 0.6); setA(R, -0.1, -0.06, 0); torso.rotation.x = 0.04; }
}

// death animation: k 0..1 progress, dir = fall heading (radians, world yaw of fall direction relative to body)
export function poseDeath(r, k, fallSide) {
  const { hips, torso, head, L, R, LL, RL, root } = r;
  const a = Math.min(1, k * 2.2), b = Math.min(1, Math.max(0, (k - 0.15) / 0.85)); const e = b * b * (3 - 2 * b);
  LL.th.rotation.x = lerp(LL.th.rotation.x, -0.7, a); RL.th.rotation.x = lerp(RL.th.rotation.x, -0.2, a); LL.kn.rotation.x = lerp(LL.kn.rotation.x, 1.4, a); RL.kn.rotation.x = lerp(RL.kn.rotation.x, 0.6, a);
  hips.position.y = lerp(0.95, 0.3, e) - a * 0.25 * (1 - e);
  torso.rotation.x = lerp(torso.rotation.x, 0.3 * fallSide, a);
  head.rotation.x = lerp(0, -0.5 * fallSide, e); head.rotation.z = lerp(0, 0.4, e);
  L.sh.rotation.set(lerp(L.sh.rotation.x, -1.2 * fallSide, e), 0, lerp(0.1, 1.1, e)); R.sh.rotation.set(lerp(R.sh.rotation.x, -0.7, e), 0, lerp(-0.1, -0.9, e));
  L.el.rotation.x = lerp(L.el.rotation.x, -0.3, e); R.el.rotation.x = lerp(R.el.rotation.x, -0.6, e);
  root.rotation.x = -fallSide * e * 1.42;
}

// analytic hit volumes from current rig transforms (world space)
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
export function hitVolumes(r) {
  r.root.updateMatrixWorld(true);
  const p = (o, y = 0) => { _v.set(0, y, 0); return o.localToWorld(_v.clone()); };
  const head = p(r.head, 0.02), neckB = p(r.neck, -0.02), chestT = p(r.torso, 0.5), chestB = p(r.torso, 0.05), pel = p(r.hips, 0);
  const kL = p(r.LL.kn), kR = p(r.RL.kn), fL = p(r.LL.ft), fR = p(r.RL.ft);
  const eL = p(r.L.el), eR = p(r.R.el), hL = p(r.L.hand), hR = p(r.R.hand), sL = p(r.L.sh), sR = p(r.R.sh);
  void _w; void neckB;
  return [
    { part: 'head', type: 's', c: head, r: 0.135 },
    { part: 'body', type: 'c', a: chestB, b: chestT, r: 0.2 },
    { part: 'body', type: 'c', a: pel, b: chestB, r: 0.17 },
    { part: 'leg', type: 'c', a: pel, b: kL, r: 0.09 }, { part: 'leg', type: 'c', a: pel, b: kR, r: 0.09 },
    { part: 'leg', type: 'c', a: kL, b: fL, r: 0.075 }, { part: 'leg', type: 'c', a: kR, b: fR, r: 0.075 },
    { part: 'arm', type: 'c', a: sL, b: eL, r: 0.065 }, { part: 'arm', type: 'c', a: sR, b: eR, r: 0.065 },
    { part: 'arm', type: 'c', a: eL, b: hL, r: 0.055 }, { part: 'arm', type: 'c', a: eR, b: hR, r: 0.055 },
  ];
}
// segment (o + d*t, t in [0,len]) vs sphere / capsule -> t or Infinity
export function segSphere(o, d, len, c, r) { const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z; const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r; const h = b * b - cc; if (h < 0) return Infinity; const t = -b - Math.sqrt(h); return t >= 0 && t <= len ? t : (cc < 0 ? 0 : Infinity); }
export function segCapsule(o, d, len, a, b, r) {
  // sample-based closest approach (cheap + robust for thin limbs)
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z; const L2 = abx * abx + aby * aby + abz * abz || 1e-6;
  let best = Infinity; const n = 6;
  for (let i = 0; i <= n; i++) { const u = i / n; const c = { x: a.x + abx * u, y: a.y + aby * u, z: a.z + abz * u }; const t = segSphere(o, d, len, c, r); if (t < best) best = t; }
  void L2; return best;
}
