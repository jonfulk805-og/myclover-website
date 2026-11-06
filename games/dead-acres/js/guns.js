// DEAD ACRES - weapon table + procedural 3D gun models (viewmodel + wall-buy display).
import * as THREE from 'three';
import { planks } from './farmtex.js';
import { canvas, toTex, rng, cached } from './textures.js';

// dmg per bullet; rpm; mag; res = reserve; rel = reload s; spr = hip spread (rad); pel = pellets; pierce = targets per bullet
export const GUNS = {
  m45: { name: 'Clover .45', kind: 'Pistol', dmg: 48, rpm: 420, auto: false, mag: 8, res: 88, rel: 1.5, spr: 0.012, head: 3, pierce: 1, kick: 0.035, sightY: 0.083,
    pap: { name: 'Lucky Seven', dmg: 160, mag: 12, res: 120, splash: 1.6, splashDmg: 220 } },
  farmhand: { name: 'Farmhand 12g', kind: 'Double barrel', dmg: 80, pel: 8, rpm: 320, auto: false, mag: 2, res: 60, rel: 2.1, spr: 0.075, head: 1.6, pierce: 1, kick: 0.11, sightY: 0.07, falloff: 14,
    pap: { name: "Reaper's Due", dmg: 220, mag: 4, res: 90 } },
  rattler: { name: 'Rattler SMG', kind: 'Submachine gun', dmg: 80, rpm: 760, auto: true, mag: 32, res: 192, rel: 2.0, spr: 0.032, head: 2.5, pierce: 1, kick: 0.016, sightY: 0.075,
    pap: { name: 'Hornet Nest', dmg: 200, mag: 50, res: 300 } },
  carbine: { name: 'Prairie Carbine', kind: 'Assault rifle', dmg: 120, rpm: 560, auto: true, mag: 30, res: 180, rel: 2.3, spr: 0.02, head: 2.5, pierce: 2, kick: 0.022, sightY: 0.082,
    pap: { name: 'Gilded Carbine', dmg: 300, mag: 40, res: 280 } },
  harvester: { name: 'Harvester LMG', kind: 'Light machine gun', dmg: 140, rpm: 620, auto: true, mag: 100, res: 300, rel: 4.6, spr: 0.04, head: 2.4, pierce: 3, kick: 0.02, sightY: 0.1, box: true,
    pap: { name: 'Combine Harvester', dmg: 360, mag: 150, res: 600 } },
  longhorn: { name: 'Longhorn .50', kind: 'Sniper rifle', dmg: 900, rpm: 58, auto: false, mag: 5, res: 50, rel: 3.0, spr: 0.08, head: 4, pierce: 6, kick: 0.12, sightY: 0.105, scope: true, box: true,
    pap: { name: 'Longhorn Royale', dmg: 2600, mag: 8, res: 90 } },
  thresher: { name: 'Thresher', kind: 'Auto shotgun', dmg: 110, pel: 8, rpm: 260, auto: true, mag: 20, res: 120, rel: 3.2, spr: 0.07, head: 1.6, pierce: 1, kick: 0.07, sightY: 0.085, falloff: 16, box: true,
    pap: { name: 'Grim Thresher', dmg: 260, mag: 32, res: 200 } },
  ray: { name: 'Clover Ray', kind: 'Wonder weapon', dmg: 1200, rpm: 190, auto: false, mag: 20, res: 160, rel: 2.6, spr: 0.006, head: 1, pierce: 1, kick: 0.05, sightY: 0.09, proj: true, splash: 2.6, splashDmg: 1100, box: true,
    pap: { name: 'Clover Ray Mk II', dmg: 2600, mag: 40, res: 200, splash: 3.4, splashDmg: 2400 } },
};
export const BOX_POOL = ['harvester', 'longhorn', 'thresher', 'ray', 'ray', 'carbine', 'rattler', 'farmhand', 'thresher', 'harvester'];

// stats for a gun with/without pack-a-punch
export function stats(id, pap) {
  const g = GUNS[id]; if (!pap) return g;
  return { ...g, ...g.pap, pap: true };
}

// ---------------- materials ----------------
const M = {};
function mats() {
  if (M.metal) return M;
  M.metal = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.85, roughness: 0.38 });
  M.dark = new THREE.MeshStandardMaterial({ color: 0x141518, metalness: 0.6, roughness: 0.55 });
  M.steel = new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.95, roughness: 0.25 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xb08a3c, metalness: 0.9, roughness: 0.3 });
  const wt = toTex(planks('#6a3f22', 9, false, 0.15), [0.6, 0.6]);
  M.wood = new THREE.MeshStandardMaterial({ map: wt, color: 0xc89a70, roughness: 0.55, metalness: 0.05 });
  M.glove = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.85 });
  M.sleeve = new THREE.MeshStandardMaterial({ map: toTex(sleeveTex(), [1, 1]), roughness: 0.9 });
  M.skin = new THREE.MeshStandardMaterial({ color: 0xb08468, roughness: 0.7 });
  M.ray = new THREE.MeshStandardMaterial({ color: 0x1d2a22, metalness: 0.7, roughness: 0.3 });
  M.rayGlow = new THREE.MeshStandardMaterial({ color: 0x103a10, emissive: 0x4dff6a, emissiveIntensity: 1.2 });
  M.pap = new THREE.MeshStandardMaterial({ map: toTex(papTex(), [1, 1]), emissiveMap: toTex(papTex(true), [1, 1]), emissive: 0x6dff5a, emissiveIntensity: 0.35, metalness: 0.8, roughness: 0.3 });
  M.scope = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 0.5, roughness: 0.2 });
  M.lens = new THREE.MeshStandardMaterial({ color: 0x113344, emissive: 0x0a3550, emissiveIntensity: 0.6, metalness: 1, roughness: 0.05 });
  return M;
}
function sleeveTex() {
  const [c, x] = canvas(64, 64); x.fillStyle = '#5a1f17'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 16) { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(i, 0, 6, 64); x.fillRect(0, i, 64, 6); x.fillStyle = 'rgba(255,230,180,0.15)'; x.fillRect(i + 10, 0, 2, 64); x.fillRect(0, i + 10, 64, 2); }
  return c;
}
function papTex(glow) {
  return cached('pap' + !!glow, () => {
    const R = rng(1313), [c, x] = canvas(128, 128);
    x.fillStyle = glow ? '#000' : '#1a2418'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 26; i++) {
      const px = R() * 128, py = R() * 128, s = 4 + R() * 7;
      x.fillStyle = glow ? `rgba(120,255,110,${0.5 + R() * 0.5})` : `rgba(${40 + R() * 40},${120 + R() * 80},${50},1)`;
      for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(px + Math.cos(k * 1.57) * s * 0.7, py + Math.sin(k * 1.57) * s * 0.7, s * 0.6, 0, 7); x.fill(); }
    }
    if (!glow) { x.strokeStyle = 'rgba(220,180,60,0.6)'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(R() * 128, R() * 128); x.lineTo(R() * 128, R() * 128); x.stroke(); } }
    return c;
  });
}

const box = (w, h, d, m, x = 0, y = 0, z = 0, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; return o; };
const cyl = (r, l, m, x = 0, y = 0, z = 0, seg = 14, r2 = r) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, l, seg), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); return o; };

// Build model. Origin = hand grip; forward = -z. Returns {g, muzzle, mag, slide, foregrip:[x,y,z]}
export function buildGun(id, pap = false) {
  mats();
  const g = new THREE.Group(); const m = pap ? M.pap : M.metal, w = pap ? M.pap : M.wood;
  const muzzle = new THREE.Object3D(); let mag = new THREE.Group(), slide = null, fore = null;
  const add = (...o) => o.forEach((p) => g.add(p));
  if (id === 'm45') {
    slide = box(0.034, 0.038, 0.2, m, 0, 0.07, -0.06); add(slide);
    add(box(0.03, 0.026, 0.17, M.dark, 0, 0.04, -0.05));
    add(box(0.03, 0.11, 0.045, pap ? M.pap : M.wood, 0, -0.01, 0.02, -0.25));
    add(box(0.006, 0.03, 0.04, M.dark, 0, 0.015, -0.03)); // trigger guard
    add(cyl(0.008, 0.02, M.steel, 0, 0.07, -0.165, 10));
    add(box(0.006, 0.01, 0.01, M.steel, 0, 0.094, -0.145), box(0.02, 0.01, 0.01, M.steel, 0, 0.094, 0.025));
    mag.add(box(0.024, 0.04, 0.035, M.dark, 0, -0.07, 0.03, -0.25)); add(mag);
    muzzle.position.set(0, 0.07, -0.18);
  } else if (id === 'farmhand') {
    add(cyl(0.015, 0.62, m, -0.016, 0.06, -0.38), cyl(0.015, 0.62, m, 0.016, 0.06, -0.38));
    add(box(0.05, 0.02, 0.6, M.dark, 0, 0.078, -0.37));
    add(box(0.055, 0.045, 0.26, w, 0, 0.03, -0.28)); // forend
    add(box(0.05, 0.06, 0.12, m, 0, 0.05, -0.05)); // receiver
    const st = box(0.045, 0.07, 0.3, w, 0, 0.0, 0.17, 0.18); add(st);
    add(box(0.008, 0.008, 0.01, M.brass, 0, 0.095, -0.66));
    mag.add(box(0.02, 0.02, 0.06, M.brass, 0, 0.06, -0.08)); mag.visible = false; add(mag);
    muzzle.position.set(0, 0.06, -0.7); fore = [0, 0.0, -0.3];
  } else if (id === 'rattler') {
    add(box(0.05, 0.06, 0.3, m, 0, 0.06, -0.12));
    add(cyl(0.022, 0.2, M.dark, 0, 0.065, -0.36)); for (let i = 0; i < 6; i++) add(cyl(0.026, 0.008, m, 0, 0.065, -0.29 - i * 0.025));
    add(cyl(0.01, 0.08, M.steel, 0, 0.065, -0.49, 10));
    add(box(0.03, 0.09, 0.04, w, 0, -0.01, 0.0, -0.3)); // grip
    add(box(0.035, 0.07, 0.04, w, 0, 0.0, -0.22, 0.15)); // fore grip
    add(box(0.04, 0.06, 0.2, w, 0, 0.04, 0.14, 0.05)); // stock
    mag.add(box(0.025, 0.16, 0.035, M.dark, 0, -0.04, -0.1, 0.1)); add(mag);
    add(box(0.006, 0.02, 0.006, M.steel, 0, 0.1, -0.25), box(0.02, 0.012, 0.01, M.steel, 0, 0.096, 0.0));
    muzzle.position.set(0, 0.065, -0.54); fore = [0, -0.02, -0.22];
  } else if (id === 'carbine') {
    add(box(0.05, 0.05, 0.62, w, 0, 0.04, -0.12)); // stock body
    add(box(0.042, 0.04, 0.24, m, 0, 0.075, -0.1)); // receiver
    add(cyl(0.011, 0.34, m, 0, 0.075, -0.56)); add(box(0.02, 0.03, 0.02, M.dark, 0, 0.1, -0.68));
    add(box(0.008, 0.02, 0.008, M.steel, 0, 0.104, -0.66), box(0.024, 0.014, 0.012, M.steel, 0, 0.102, -0.0));
    const butt = box(0.048, 0.1, 0.22, w, 0, 0.0, 0.25, 0.12); add(butt);
    mag.add(box(0.028, 0.13, 0.05, M.dark, 0, -0.03, -0.12, 0.15)); add(mag);
    muzzle.position.set(0, 0.075, -0.74); fore = [0, 0.0, -0.36];
  } else if (id === 'harvester') {
    add(box(0.075, 0.09, 0.4, m, 0, 0.07, -0.1));
    add(cyl(0.035, 0.42, M.dark, 0, 0.07, -0.5)); for (let i = 0; i < 10; i++) add(box(0.074, 0.004, 0.012, M.dark, 0, 0.07, -0.34 - i * 0.034));
    add(cyl(0.012, 0.12, M.steel, 0, 0.07, -0.76, 10));
    add(box(0.02, 0.05, 0.16, M.dark, 0, 0.14, -0.12)); // carry handle
    add(box(0.035, 0.1, 0.04, M.dark, 0, -0.02, 0.0, -0.3));
    add(box(0.05, 0.08, 0.24, w, 0, 0.03, 0.22));
    mag.add(box(0.1, 0.11, 0.1, pap ? M.pap : M.metal, 0.05, -0.02, -0.14)); add(mag);
    add(box(0.008, 0.008, 0.18, M.steel, -0.02, 0.0, -0.58, 0.4), box(0.008, 0.008, 0.18, M.steel, 0.02, 0.0, -0.58, 0.4));
    muzzle.position.set(0, 0.07, -0.83); fore = [0, 0.0, -0.36];
  } else if (id === 'longhorn') {
    add(box(0.05, 0.055, 0.7, w, 0, 0.035, -0.12));
    add(box(0.044, 0.045, 0.2, m, 0, 0.07, -0.05));
    add(cyl(0.013, 0.5, m, 0, 0.07, -0.6)); add(cyl(0.02, 0.07, M.dark, 0, 0.07, -0.86));
    add(cyl(0.022, 0.3, M.scope, 0, 0.125, -0.07), cyl(0.028, 0.05, M.scope, 0, 0.125, -0.24), cyl(0.026, 0.05, M.scope, 0, 0.125, 0.09));
    add(cyl(0.024, 0.004, M.lens, 0, 0.125, -0.268)); add(box(0.008, 0.03, 0.02, M.dark, 0, 0.1, -0.1), box(0.008, 0.03, 0.02, M.dark, 0, 0.1, 0.0));
    add(box(0.05, 0.11, 0.24, w, 0, -0.0, 0.3, 0.1));
    add(box(0.01, 0.01, 0.04, M.steel, 0.03, 0.07, 0.02)); // bolt
    mag.add(box(0.03, 0.05, 0.07, M.dark, 0, 0.0, -0.08)); add(mag);
    muzzle.position.set(0, 0.07, -0.9); fore = [0, 0.0, -0.36];
  } else if (id === 'thresher') {
    add(box(0.07, 0.09, 0.38, m, 0, 0.06, -0.12));
    add(cyl(0.02, 0.36, M.dark, 0, 0.08, -0.48)); add(box(0.05, 0.04, 0.32, M.dark, 0, 0.11, -0.46));
    for (let i = 0; i < 6; i++) add(box(0.052, 0.006, 0.02, M.steel, 0, 0.132, -0.34 - i * 0.05));
    add(box(0.035, 0.1, 0.04, M.dark, 0, -0.02, 0.0, -0.3)); add(box(0.05, 0.08, 0.22, M.dark, 0, 0.04, 0.2));
    const drum = cyl(0.075, 0.07, pap ? M.pap : M.metal, 0, -0.04, -0.12, 20); drum.rotation.set(0, 0, Math.PI / 2); mag.add(drum); add(mag);
    muzzle.position.set(0, 0.08, -0.67); fore = [0, 0.0, -0.36];
  } else if (id === 'ray') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 6, 14), pap ? M.pap : M.ray); body.rotation.x = Math.PI / 2; body.position.set(0, 0.07, -0.14); add(body);
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.008, 8, 20), M.rayGlow); t.position.set(0, 0.07, -0.08 - i * 0.06); add(t); }
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 0.04, 20, 1, true), pap ? M.pap : M.ray); dish.rotation.x = -Math.PI / 2; dish.position.set(0, 0.07, -0.33); dish.material.side = THREE.DoubleSide; add(dish);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), M.rayGlow); core.position.set(0, 0.07, -0.32); add(core);
    add(box(0.03, 0.1, 0.045, M.ray, 0, -0.01, 0.0, -0.3), box(0.012, 0.05, 0.12, M.rayGlow, 0, 0.125, -0.12));
    mag.add(box(0.026, 0.05, 0.03, M.rayGlow, 0, -0.06, 0.03, -0.3)); add(mag);
    muzzle.position.set(0, 0.07, -0.36);
  } else if (id === 'grenades') {
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshStandardMaterial({ color: 0x3d4a2a, roughness: 0.7, metalness: 0.2 })); s.position.set((i - 1) * 0.11, 0, 0); s.scale.y = 1.25; add(s); add(cyl(0.012, 0.03, M.steel, (i - 1) * 0.11, 0.06, 0, 8)); }
  } else if (id === 'knife') {
    add(box(0.008, 0.035, 0.22, M.steel, 0, 0.02, -0.15), box(0.03, 0.03, 0.11, M.wood, 0, 0, 0.0), box(0.06, 0.012, 0.012, M.brass, 0, 0.0, -0.05));
  }
  g.add(muzzle);
  return { g, muzzle, mag, slide, fore };
}

// arms for the viewmodel: right hand at grip, left hand at foregrip (or supporting the pistol)
export function buildArms(fore) {
  mats();
  const g = new THREE.Group();
  const hand = (x, y, z) => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.09), M.glove); h.position.set(x, y, z); return h; };
  const arm = (from, to) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a); const l = d.length();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, l, 10), M.sleeve); c.position.copy(a).add(b).multiplyScalar(0.5);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return c;
  };
  g.add(hand(0.005, 0.0, 0.02), arm([0.01, -0.02, 0.06], [0.09, -0.16, 0.42]));
  const f = fore || [-0.02, -0.04, 0.0];
  const lh = hand(f[0] - 0.01, f[1], f[2]); lh.rotation.z = 0.5; g.add(lh, arm([f[0] - 0.03, f[1] - 0.02, f[2] + 0.04], [-0.2, -0.2, 0.36]));
  return g;
}
