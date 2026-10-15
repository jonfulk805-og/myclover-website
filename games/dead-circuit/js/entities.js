// Drone, robot and turret models + lock reticle.
import * as THREE from 'three';
import { T } from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const glow = (r, g, b) => { const m = new THREE.MeshBasicMaterial({ toneMapped: false }); m.color.setRGB(r, g, b); return m; };

function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = shadow; return m;
}

// ---------------- drone ----------------
export function makeDrone() {
  const g = new THREE.Group();
  const tilt = new THREE.Group(); g.add(tilt);
  const hull = std({ map: T('droneHull', [1, 1]), roughness: 0.45, metalness: 0.7 });
  const dark = std({ color: 0x1a1d1f, roughness: 0.5, metalness: 0.6 });
  const amber = std({ color: 0xd99a4a, roughness: 0.35, metalness: 0.5, emissive: 0x3a2000 });
  // body
  const body = mesh(new THREE.CapsuleGeometry(0.75, 1.3, 6, 14).rotateX(Math.PI / 2), hull, 0, 0, 0); body.scale.set(1.15, 0.6, 1); tilt.add(body);
  tilt.add(mesh(new THREE.BoxGeometry(1.2, 0.35, 1.9), dark, 0, 0.32, 0.05));
  tilt.add(mesh(new THREE.BoxGeometry(0.5, 0.12, 1.2), amber, 0, 0.55, -0.1));
  // sensor eye
  tilt.add(mesh(new THREE.SphereGeometry(0.26, 16, 10), dark, 0, 0, -1.35));
  const eye = mesh(new THREE.SphereGeometry(0.14, 12, 8), glow(3, 1.8, 0.6), 0, 0, -1.5, false); tilt.add(eye);
  // arms + motors + rotors
  const rotors = [];
  const bladeMat = std({ color: 0x222, roughness: 0.4 });
  const discMat = new THREE.MeshBasicMaterial({ color: 0x9fb0b8, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  for (const [ax, az] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const len = 2.2, a = Math.atan2(az, ax);
    const arm = mesh(new THREE.BoxGeometry(len, 0.16, 0.26), hull, ax * 0.8, 0.12, az * 0.8); arm.rotation.y = -a; tilt.add(arm);
    const mx = ax * 1.6, mz = az * 1.6;
    tilt.add(mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.45, 14), dark, mx, 0.3, mz));
    tilt.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 14), amber, mx, 0.12, mz));
    const rot = new THREE.Group(); rot.position.set(mx, 0.6, mz);
    rot.add(mesh(new THREE.BoxGeometry(2.3, 0.03, 0.18), bladeMat, 0, 0, 0, false));
    rot.add(mesh(new THREE.BoxGeometry(0.18, 0.03, 2.3), bladeMat, 0, 0, 0, false));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32).rotateX(-Math.PI / 2), discMat); rot.add(disc);
    tilt.add(rot); rotors.push(rot);
    // guard ring
    const ring = mesh(new THREE.TorusGeometry(1.25, 0.05, 6, 32).rotateX(Math.PI / 2), dark, mx, 0.6, mz, false); tilt.add(ring);
  }
  // nav lights
  const navL = mesh(new THREE.SphereGeometry(0.1, 8, 6), glow(4, 0.3, 0.2), -2.85, 0.6, 1.6, false);
  const navR = mesh(new THREE.SphereGeometry(0.1, 8, 6), glow(0.3, 4, 0.5), 2.85, 0.6, 1.6, false);
  tilt.add(navL, navR);
  // skids
  for (const sx of [-0.6, 0.6]) {
    tilt.add(mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), dark, sx, -0.55, 0.5));
    tilt.add(mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), dark, sx, -0.55, -0.5));
    tilt.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6).rotateX(Math.PI / 2), dark, sx, -0.8, 0));
  }
  // turret
  const turret = new THREE.Group(); turret.position.set(0, -0.45, -0.3); tilt.add(turret);
  turret.add(mesh(new THREE.SphereGeometry(0.38, 16, 10), dark));
  const pitch = new THREE.Group(); turret.add(pitch);
  const muzzles = [];
  for (const sx of [-0.16, 0.16]) {
    pitch.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.2, 8).rotateX(Math.PI / 2), hull, sx, 0, -0.65));
    const mz = new THREE.Object3D(); mz.position.set(sx, 0, -1.3); pitch.add(mz); muzzles.push(mz);
  }
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), glow(4, 2.5, 0.8)); flash.visible = false; pitch.add(flash);
  // hull material for damage flash
  return { group: g, tilt, rotors, turret, pitch, muzzles, flash, hullMat: hull, eye, navL, navR, discMat };
}

// ---------------- robots ----------------
const RG = {
  box: new THREE.BoxGeometry(1, 1, 1),
  barrel: new THREE.CylinderGeometry(0.12, 0.16, 1, 8).rotateX(Math.PI / 2),
  eye: new THREE.SphereGeometry(0.09, 8, 6),
  core: new THREE.SphereGeometry(0.22, 12, 8),
  tip: new THREE.SphereGeometry(0.16, 10, 8),
  ant: new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4),
};

function limb(mat, w, h, d) { const pivot = new THREE.Group(); const m = mesh(RG.box, mat, 0, -h / 2, 0); m.scale.set(w, h, d); pivot.add(m); pivot.userData.len = h; return pivot; }

export function makeRobot(kind) {
  const brute = kind === 'brute';
  const s = brute ? 1.95 : 1.45;
  const g = new THREE.Group();
  const body = std({ map: T('rustMetal', [1, 1], brute ? '#4f5547' : '#6f7468'), roughness: 0.7, metalness: 0.55, emissive: 0x000000 });
  const dark = std({ color: 0x24282a, roughness: 0.6, metalness: 0.6, emissive: 0x000000 });
  const eyeMat = glow(0.6, 3.2, 0.9), coreMat = glow(0.5, 2.6, 0.8), tipMat = glow(0.4, 1.6, 0.5);
  const root = new THREE.Group(); root.scale.setScalar(s); g.add(root);
  const hips = new THREE.Group(); hips.position.y = 1.5; root.add(hips);
  const pelvis = mesh(RG.box, dark, 0, 0, 0); pelvis.scale.set(0.9, 0.3, 0.5); hips.add(pelvis);
  // legs
  const legs = [];
  for (const sx of [-0.32, 0.32]) {
    const thigh = limb(body, 0.32, 0.8, 0.36); thigh.position.set(sx, -0.1, 0); hips.add(thigh);
    const shin = limb(dark, 0.26, 0.75, 0.3); shin.position.y = -0.8; thigh.add(shin);
    const foot = mesh(RG.box, dark, 0, -0.75, -0.1); foot.scale.set(0.34, 0.14, 0.6); shin.add(foot);
    legs.push({ thigh, shin });
  }
  // torso (hunched)
  const torso = new THREE.Group(); torso.position.y = 0.15; torso.rotation.x = brute ? 0.12 : 0.32; hips.add(torso);
  const chest = mesh(RG.box, body, 0, 0.55, 0); chest.scale.set(brute ? 1.35 : 1.05, 1.0, 0.7); torso.add(chest);
  const plate = mesh(RG.box, dark, 0, 0.6, -0.36); plate.scale.set(0.6, 0.55, 0.06); torso.add(plate);
  const core = mesh(RG.core, coreMat, 0, 0.62, -0.4, false); torso.add(core);
  // exposed wiring / ribs
  for (let i = 0; i < 3; i++) { const r = mesh(RG.box, dark, 0, 0.15 + i * 0.12, -0.33); r.scale.set(0.8, 0.05, 0.05); torso.add(r); }
  // head
  const head = new THREE.Group(); head.position.set(0, 1.25, -0.08); head.rotation.z = brute ? 0 : 0.18; torso.add(head);
  const skull = mesh(RG.box, body, 0, 0.15, 0); skull.scale.set(0.55, 0.42, 0.5); head.add(skull);
  const jaw = mesh(RG.box, dark, 0, -0.08, -0.05); jaw.scale.set(0.45, 0.12, 0.42); head.add(jaw);
  const eyes = [];
  for (const sx of [-0.13, 0.13]) { const e = mesh(RG.eye, eyeMat, sx, 0.18, -0.26, false); head.add(e); eyes.push(e); }
  const ant = mesh(RG.ant, dark, 0.15, 0.6, 0.05, false); ant.rotation.z = -0.5; head.add(ant);
  // arms: right = cannon, left = dangling claw
  const armR = limb(body, 0.28, 0.7, 0.3); armR.position.set(brute ? 0.85 : 0.68, 0.95, 0); torso.add(armR);
  const fore = new THREE.Group(); fore.position.y = -0.7; armR.add(fore);
  const gun = mesh(RG.barrel, dark, 0, 0, -0.35); gun.scale.set(1.3, 1.3, 1); fore.add(gun);
  const tip = mesh(RG.tip, tipMat, 0, 0, -0.9, false); fore.add(tip);
  armR.rotation.x = -1.2;
  const armL = limb(body, 0.26, 0.75, 0.28); armL.position.set(brute ? -0.85 : -0.66, 0.95, 0); armL.rotation.z = 0.15; torso.add(armL);
  const fore2 = limb(dark, 0.2, 0.7, 0.22); fore2.position.y = -0.75; fore2.rotation.x = -0.4; armL.add(fore2);
  for (const sx of [-0.08, 0.08]) { const c = mesh(RG.box, dark, sx, -0.78, -0.05); c.scale.set(0.05, 0.3, 0.08); fore2.add(c); }
  let gun2 = null, tip2 = null;
  if (brute) {
    // shoulder mortar pod
    const pod = mesh(RG.box, dark, -0.45, 1.35, 0.1); pod.scale.set(0.5, 0.4, 0.7); torso.add(pod);
    gun2 = mesh(RG.barrel, dark, -0.45, 1.4, -0.4); gun2.scale.set(1.4, 1.4, 0.6); torso.add(gun2);
    tip2 = mesh(RG.tip, tipMat, -0.45, 1.4, -0.75, false); torso.add(tip2);
    // armour plates
    for (const sx of [-0.75, 0.75]) { const p = mesh(RG.box, dark, sx, 1.1, 0); p.scale.set(0.5, 0.25, 0.6); p.rotation.z = -sx * 0.4; torso.add(p); }
  }
  return { group: g, root, hips, torso, head, legs, armR, armL, tip, tip2, eyes, core, mats: [body, dark], eyeMat, tipMat, coreMat, scale: s, muzzle: tip, height: 3.1 * s };
}

// roof turret on a stronghold
export function makeTurret() {
  const g = new THREE.Group();
  const rust = std({ map: T('rustMetal', [1, 1], '#555a4e'), roughness: 0.7, metalness: 0.5 });
  const dark = std({ color: 0x202426, roughness: 0.6, metalness: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 10), dark, 0, 0.25, 0));
  const yaw = new THREE.Group(); yaw.position.y = 0.7; g.add(yaw);
  yaw.add(mesh(new THREE.SphereGeometry(0.75, 14, 10), rust));
  const barrel = mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.8, 8).rotateX(Math.PI / 2), dark, 0, 0.05, -1.0); yaw.add(barrel);
  const tipMat = glow(0.4, 1.4, 0.5);
  const tip = mesh(new THREE.SphereGeometry(0.22, 10, 8), tipMat, 0, 0.05, -1.95, false); yaw.add(tip);
  const eye = mesh(new THREE.SphereGeometry(0.16, 8, 6), glow(0.6, 3, 0.9), 0, 0.35, -0.6, false); yaw.add(eye);
  return { group: g, yaw, tip, tipMat };
}

// ---------------- lock reticle ----------------
export function makeReticle() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false, side: THREE.DoubleSide });
  mat.color.setRGB(2.2, 1.2, 0.35);
  const ring = new THREE.Group(); g.add(ring);
  for (let i = 0; i < 4; i++) { const seg = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 24, 1, i * Math.PI / 2 + 0.2, Math.PI / 2 - 0.4).rotateX(-Math.PI / 2), mat); seg.renderOrder = 10; ring.add(seg); }
  const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 3).rotateX(Math.PI), mat); chevron.renderOrder = 10; g.add(chevron);
  return { group: g, ring, chevron, mat };
}
