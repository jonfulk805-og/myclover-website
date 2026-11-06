// LONG SHADOW - the valley compound: buildings, props, solid boxes for sight/bullets, nav grid.
import * as THREE from 'three';
import { T, canvas, rng, toTex, windowTex } from './textures.js';
import { mergeGeos } from './terrain.js';

// solid axis-aligned boxes: {x0,x1,y0,y1,z0,z1, kind}
export const BOXES = [];
// explosive barrel clusters / fuel tanks: {x,y,z,r,alive,mesh,kind}
export const EXPLOSIVES = [];
// generator (sound masking source)
export const GEN = { x: 22, z: 12 };
export const FENCE = { x0: -95, x1: 95, z0: -20, z1: 112 };
export const HELI = { x: -55, z: 86 };
export const GATE = { x: 95, z: 42 };

// ---------- helper: world-scaled UV boxes ----------
function boxGeo(w, h, d, s = 3) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / s, uv.getY(i) * dims[f][1] / s); }
  return g;
}
let SCENE = null, SH = false;
function add(geo, mat, x, y, z, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast && SH; m.receiveShadow = recv && SH; SCENE.add(m); return m; }
// solid box with bottom at y0
function solid(x, z, w, d, h, mat, y0 = 0, kind = 'wall', s = 3) {
  const m = add(boxGeo(w, h, d, s), mat, x, y0 + h / 2, z);
  BOXES.push({ x0: x - w / 2, x1: x + w / 2, y0, y1: y0 + h, z0: z - d / 2, z1: z + d / 2, kind });
  return m;
}

// ---------- textures ----------
function stuccoTex(hex) {
  const R = rng(311), [c, x] = canvas(256, 256); x.fillStyle = hex; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + R() * 0.05})`; x.fillRect(R() * 256, R() * 256, 1 + R() * 2, 1 + R() * 2); }
  for (let i = 0; i < 14; i++) { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(70,55,40,0)'); g.addColorStop(1, 'rgba(70,55,40,0.12)'); x.fillStyle = g; x.fillRect(R() * 256, 0, 3 + R() * 10, 256); }
  return toTex(c);
}
function roofTile() {
  const R = rng(312), [c, x] = canvas(256, 256); x.fillStyle = '#7a3622'; x.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) for (let xx = 0; xx < 256; xx += 20) { const v = 0.75 + R() * 0.4; const g = x.createLinearGradient(xx, 0, xx + 20, 0); g.addColorStop(0, `rgb(${120 * v | 0},${52 * v | 0},${34 * v | 0})`); g.addColorStop(0.5, `rgb(${168 * v | 0},${78 * v | 0},${50 * v | 0})`); g.addColorStop(1, `rgb(${96 * v | 0},${40 * v | 0},${26 * v | 0})`); x.fillStyle = g; x.fillRect(xx + ((y / 16) % 2) * 10, y, 19, 15); }
  return toTex(c);
}
function chainLink() {
  const [c, x] = canvas(64, 64); x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(190,195,200,0.85)'; x.lineWidth = 1.6;
  for (let i = -64; i < 128; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
  const t = toTex(c, [1, 1]); return t;
}
function helipadTex() {
  const [c, x] = canvas(512, 512); x.fillStyle = '#3a3d40'; x.fillRect(0, 0, 512, 512);
  const R = rng(5); for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(255,255,255,${R() * 0.05})`; x.fillRect(R() * 512, R() * 512, 2, 2); }
  x.strokeStyle = '#e8e2d0'; x.lineWidth = 14; x.beginPath(); x.arc(256, 256, 200, 0, 7); x.stroke();
  x.fillStyle = '#e8e2d0'; x.fillRect(176, 146, 40, 220); x.fillRect(296, 146, 40, 220); x.fillRect(176, 236, 160, 40);
  return toTex(c);
}
function signTex(txt, bg, fg) { const [c, x] = canvas(256, 64); x.fillStyle = bg; x.fillRect(0, 0, 256, 64); x.fillStyle = fg; x.font = 'bold 34px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 34); return toTex(c); }

// ---------- build ----------
export function buildCompound(scene, pal, Q) {
  SCENE = scene; SH = Q.shadows; BOXES.length = 0; EXPLOSIVES.length = 0;
  const night = !!pal.night;
  const M = {
    stucco: new THREE.MeshStandardMaterial({ map: stuccoTex('#c9b494'), roughness: 0.9 }),
    stucco2: new THREE.MeshStandardMaterial({ map: stuccoTex('#a99b86'), roughness: 0.9 }),
    tile: new THREE.MeshStandardMaterial({ map: roofTile(), roughness: 0.8 }),
    concrete: new THREE.MeshStandardMaterial({ map: T('concrete', [1, 1]), roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ map: T('rustMetal', [1, 1], '#6c7466'), roughness: 0.7, metalness: 0.35 }),
    metal2: new THREE.MeshStandardMaterial({ map: T('rustMetal', [1, 1], '#7d6a52'), roughness: 0.75, metalness: 0.3 }),
    siding: new THREE.MeshStandardMaterial({ map: T('siding', [1, 1], '#7f8a6a'), roughness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ map: T('wood', [1, 1]), roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.6, metalness: 0.5 }),
    olive: new THREE.MeshStandardMaterial({ color: 0x4b5233, roughness: 0.7, metalness: 0.2 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.15, metalness: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: 0x9a1c12, roughness: 0.55, metalness: 0.4 }),
    sand: new THREE.MeshStandardMaterial({ color: 0x9c8a62, roughness: 1 }),
    canvas: new THREE.MeshStandardMaterial({ color: 0x5d6342, roughness: 1 }),
    white: new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.5, metalness: 0.2 }),
  };
  const winLit = new THREE.MeshBasicMaterial({ map: toTex(windowTex('lit')), color: new THREE.Color(1.6, 1.2, 0.7) });
  const winDark = new THREE.MeshStandardMaterial({ map: toTex(windowTex(false)), roughness: 0.2, metalness: 0.4 });
  const winGeo = new THREE.PlaneGeometry(1.3, 1.5);
  const R = rng(999);
  function windows(x0, x1, y, z, nz, n) { // along x on a face whose outward normal is (0,0,nz)
    for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * (k + 0.5) / n; const m = new THREE.Mesh(winGeo, night && R() < 0.55 ? winLit : winDark); m.position.set(x, y, z + nz * 0.03); if (nz < 0) m.rotation.y = Math.PI; scene.add(m); }
  }
  function windowsX(z0, z1, y, x, nx, n) { for (let k = 0; k < n; k++) { const z = z0 + (z1 - z0) * (k + 0.5) / n; const m = new THREE.Mesh(winGeo, night && R() < 0.5 ? winLit : winDark); m.position.set(x + nx * 0.03, y, z); m.rotation.y = nx > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(m); } }
  function door(x, z, nz, w = 1.6, h = 2.4, mat = M.dark) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, h / 2, z + nz * 0.04); if (nz < 0) m.rotation.y = Math.PI; scene.add(m); }

  // ground pads / roads
  const asph = new THREE.MeshStandardMaterial({ map: T('asphalt', [1, 1]), roughness: 0.95, color: 0x9a968c });
  const road = (x, z, w, d) => { const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 8, uv.getY(i) * d / 8); const m = add(g, asph, x, 0.03, z, false, true); m.renderOrder = 1; return m; };
  road(20, 42, 150, 7); road(140, 42, 90, 7); road(0, 50, 7, 30); road(-55, 52, 7, 30); road(55, 52, 7, 22);
  const pad = add(new THREE.CircleGeometry(11, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: helipadTex(), roughness: 0.9 }), HELI.x, 0.05, HELI.z, false, true); pad.rotation.y = 0;

  // ---- villa ----
  solid(0, 74, 26, 14, 8.2, M.stucco);
  solid(0, 74, 26.6, 14.6, 0.6, M.concrete, 8.2, 'parapet');
  add(boxGeo(25.4, 0.05, 13.4), M.concrete, 0, 8.25, 74, false, true);
  // parapet ring (low walls on the roof)
  for (const [x, z, w, d] of [[0, 67.1, 26.6, 0.4], [0, 80.9, 26.6, 0.4], [-13.1, 74, 0.4, 14.2], [13.1, 74, 0.4, 14.2]]) solid(x, z, w, d, 1.0, M.stucco, 8.8, 'parapet');
  // balcony
  solid(0, 65.7, 16, 2.6, 0.35, M.concrete, 3.6, 'slab');
  for (let k = -7.6; k <= 7.6; k += 0.6) add(new THREE.BoxGeometry(0.06, 1.0, 0.06), M.white, k, 4.45, 64.5, true, false);
  add(new THREE.BoxGeometry(16, 0.08, 0.12), M.white, 0, 4.98, 64.5);
  for (const sx of [-7.6, 7.6]) add(new THREE.BoxGeometry(0.3, 3.6, 0.3), M.white, sx, 1.8, 64.6);
  windows(-12, -8, 1.6, 67, -1, 2); windows(8, 12, 1.6, 67, -1, 2); windows(-12, -8.5, 5.4, 67, -1, 2); windows(8.5, 12, 5.4, 67, -1, 2);
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.4), night ? winLit : M.glass); m.position.set(0, 4.95, 66.96); m.rotation.y = Math.PI; scene.add(m); }
  windows(-12, 12, 1.6, 81, 1, 6); windows(-12, 12, 5.4, 81, 1, 6); windowsX(68, 80, 1.6, -13, -1, 3); windowsX(68, 80, 1.6, 13, 1, 3); windowsX(68, 80, 5.4, 13, 1, 3); windowsX(68, 80, 5.4, -13, -1, 3);
  door(0, 67, -1, 2.2, 2.7, new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.6 }));
  // pool + planters in front
  add(boxGeo(10, 0.3, 5), new THREE.MeshStandardMaterial({ color: 0x2c8fa8, roughness: 0.05, metalness: 0.3, emissive: 0x0a2a33 }), -16, 0.12, 58, false, true);
  for (const x of [-4, 4]) { solid(x, 61.2, 1.2, 1.2, 0.8, M.concrete, 0, 'planter'); const t = add(new THREE.SphereGeometry(0.9, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.9 }), x, 1.5, 61.2); t.scale.y = 1.3; }

  // ---- warehouse ----
  solid(-55, 35, 30, 20, 9, M.metal, 0, 'wall', 4);
  { const g = new THREE.CylinderGeometry(10.4, 10.4, 30.4, 24, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2); g.scale(1, 0.22, 1); add(g, M.metal2, -55, 9, 35); }
  BOXES.push({ x0: -70, x1: -40, y0: 9, y1: 11.2, z0: 25.5, z1: 44.5, kind: 'roof' });
  door(-55, 25, -1, 7, 5.5, new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 1 }));
  add(new THREE.PlaneGeometry(7.6, 0.5).rotateY(Math.PI), M.dark, -55, 5.6, 24.9);
  { const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshStandardMaterial({ map: signTex('KESSLER FREIGHT', '#d7c38a', '#2a2216'), roughness: 0.6 })); s.position.set(-55, 7, 24.95); s.rotation.y = Math.PI; scene.add(s); }
  windowsX(28, 42, 6.5, -40, 1, 4); windowsX(28, 42, 6.5, -70, -1, 4);

  // ---- barracks ----
  solid(55, 31, 24, 10, 4.2, M.siding);
  { const g = new THREE.CylinderGeometry(0.1, 7.6, 2.2, 4, 1); g.rotateY(Math.PI / 4); g.scale(2.3, 1, 0.99); add(g, M.metal, 55, 5.3, 31); BOXES.push({ x0: 43, x1: 67, y0: 4.2, y1: 5.6, z0: 26.5, z1: 35.5, kind: 'roof' }); }
  windows(45, 65, 2.2, 26, -1, 5); door(55, 26, -1);
  windows(45, 65, 2.2, 36, 1, 5);

  // ---- garage / office ----
  solid(52, 84, 16, 12, 5, M.stucco2);
  add(boxGeo(16.4, 0.4, 12.4), M.concrete, 52, 5.2, 84);
  door(48, 78, -1, 5, 3.6, M.metal); windows(55, 59, 2.4, 78, -1, 2); windowsX(79, 89, 2.4, 44, -1, 3);

  // ---- comms shack + mast ----
  solid(-15, 15, 6, 5, 3, M.concrete); door(-15, 12.5, -1, 1.2, 2.2);
  { const mastM = new THREE.MeshStandardMaterial({ color: 0xa8aaa6, metalness: 0.7, roughness: 0.4 }); const legs = [];
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [0, 0.6]]) { const g = new THREE.CylinderGeometry(0.05, 0.08, 26, 5); g.translate(-9 + dx, 13, 15 + dz); legs.push(g); }
    for (let y = 1; y < 26; y += 1.6) { const g = new THREE.BoxGeometry(1.25, 0.04, 0.04); g.translate(-9, y, 14.4); legs.push(g); const g2 = new THREE.BoxGeometry(0.04, 0.04, 1.25); g2.translate(-9.3, y + 0.8, 15); legs.push(g2); }
    add(mergeGeos(legs), mastM, 0, 0, 0, true, false);
    const dish = add(new THREE.SphereGeometry(1.1, 16, 8, 0, 6.3, 0, 1.0), M.white, -8.6, 18, 13.8); dish.rotation.x = -1.2;
    const beacon = add(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }), -9, 26.2, 15, false, false); beacon.userData.beacon = true; scene.userData.beacon = beacon; }

  // ---- watch towers ----
  const towers = [[-90, -15], [90, -15], [-2, 104]];
  for (const [x, z] of towers) {
    for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) add(new THREE.BoxGeometry(0.22, 7, 0.22), M.wood, x + dx, 3.5, z + dz);
    for (const y of [2.3, 4.6]) { add(new THREE.BoxGeometry(3, 0.12, 0.12), M.wood, x, y, z - 1.4); add(new THREE.BoxGeometry(3, 0.12, 0.12), M.wood, x, y, z + 1.4); }
    solid(x, z, 3.6, 3.6, 0.3, M.wood, 7, 'slab');
    for (const [dx, dz, w, d] of [[0, -1.75, 3.6, 0.12], [0, 1.75, 3.6, 0.12], [-1.75, 0, 0.12, 3.6], [1.75, 0, 0.12, 3.6]]) solid(x + dx, z + dz, w, d, 1.05, M.wood, 7.3, 'parapet');
    for (const [dx, dz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) add(new THREE.BoxGeometry(0.12, 2.2, 0.12), M.wood, x + dx, 8.4, z + dz);
    const roof = add(new THREE.ConeGeometry(2.9, 1.2, 4).rotateY(Math.PI / 4), M.metal, x, 10.1, z); roof.scale.set(1, 1, 1);
  }

  // ---- fence ----
  { const posts = []; const linkM = new THREE.MeshStandardMaterial({ map: chainLink(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 });
    const run = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 4); for (let k = 0; k <= n; k++) { const g = new THREE.CylinderGeometry(0.05, 0.05, 2.8, 5); g.translate(x0 + (x1 - x0) * k / n, 1.4, z0 + (z1 - z0) * k / n); posts.push(g); }
      const pg = new THREE.PlaneGeometry(L, 2.5); const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L / 1.4, uv.getY(i) * 2.5 / 1.4);
      const m = new THREE.Mesh(pg, linkM); m.position.set((x0 + x1) / 2, 1.3, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); scene.add(m); };
    const F = FENCE; run(F.x0, F.z0, F.x1, F.z0); run(F.x0, F.z1, F.x1, F.z1); run(F.x0, F.z0, F.x0, F.z1); run(F.x1, F.z0, F.x1, GATE.z - 5); run(F.x1, GATE.z + 5, F.x1, F.z1);
    add(mergeGeos(posts), M.dark, 0, 0, 0, true, false);
    add(new THREE.BoxGeometry(0.5, 4.2, 0.5), M.concrete, F.x1, 2.1, GATE.z - 5.4); add(new THREE.BoxGeometry(0.5, 4.2, 0.5), M.concrete, F.x1, 2.1, GATE.z + 5.4);
    const bar = add(new THREE.BoxGeometry(0.15, 0.15, 10), M.red, F.x1 + 0.3, 1.2, GATE.z); void bar;
    solid(F.x1 + 6, GATE.z - 8.5, 3, 3, 2.8, M.concrete); }

  // ---- vehicles ----
  function truck(x, z, ry, color = M.olive) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const p = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = SH; m.receiveShadow = SH; g.add(m); return m; };
    p(boxGeo(2.4, 1.0, 7.2, 2), color, 0, 1.15, 0); p(boxGeo(2.3, 1.5, 2.1, 2), color, 0, 2.2, 2.4); p(new THREE.PlaneGeometry(2, 0.8), M.glass, 0, 2.5, 3.46);
    p(boxGeo(2.4, 1.2, 4.6, 2), M.canvas, 0, 2.2, -1.2);
    for (const [wx, wz] of [[-1.15, 2.4], [1.15, 2.4], [-1.15, -1.6], [1.15, -1.6], [-1.15, -2.9], [1.15, -2.9]]) { const w = p(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14), M.tire, wx, 0.55, wz); w.rotation.z = Math.PI / 2; }
    const c = Math.cos(ry), s = Math.sin(ry); const hw = Math.abs(c) * 1.2 + Math.abs(s) * 3.6, hd = Math.abs(s) * 1.2 + Math.abs(c) * 3.6;
    BOXES.push({ x0: x - hw, x1: x + hw, y0: 0.3, y1: 2.9, z0: z - hd, z1: z + hd, kind: 'vehicle' });
    return g;
  }
  function suv(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const body = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.25, metalness: 0.7 });
    const p = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = SH; g.add(m); return m; };
    p(new THREE.BoxGeometry(2, 0.9, 4.8), body, 0, 0.95, 0); p(new THREE.BoxGeometry(1.86, 0.75, 3), body, 0, 1.75, -0.3); p(new THREE.BoxGeometry(1.88, 0.55, 2.9), M.glass, 0, 1.78, -0.3);
    for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) { const w = p(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), M.tire, wx, 0.42, wz); w.rotation.z = Math.PI / 2; }
    const c = Math.cos(ry), s = Math.sin(ry); const hw = Math.abs(c) * 1 + Math.abs(s) * 2.4, hd = Math.abs(s) * 1 + Math.abs(c) * 2.4;
    BOXES.push({ x0: x - hw, x1: x + hw, y0: 0.3, y1: 2.1, z0: z - hd, z1: z + hd, kind: 'vehicle' });
    return g;
  }
  truck(14, 30, 0.1); truck(-25, 47, Math.PI / 2); suv(-38, 74, 0.4); suv(-8, 57, Math.PI / 2 + 0.1); truck(75, 42, Math.PI / 2 - 0.05);

  // ---- helicopter ----
  const heli = new THREE.Group(); heli.position.set(HELI.x, 0, HELI.z); heli.rotation.y = 0.5; scene.add(heli);
  { const hm = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.35, metalness: 0.6 }); const p = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = SH; heli.add(m); return m; };
    const body = p(new THREE.SphereGeometry(1.6, 18, 12), hm, 0, 1.9, 0.4); body.scale.set(1, 0.95, 2);
    p(new THREE.SphereGeometry(1.2, 16, 10, 0, 6.3, 0, 1.4), M.glass, 0, 2.0, 2.6).rotation.x = 1.2;
    const boom = p(new THREE.CylinderGeometry(0.22, 0.5, 6, 10), hm, 0, 2.3, -4); boom.rotation.x = Math.PI / 2;
    p(new THREE.BoxGeometry(0.1, 1.4, 0.9), hm, 0.15, 2.9, -6.8);
    for (const sx of [-1.1, 1.1]) { p(new THREE.BoxGeometry(0.1, 0.1, 4.2), M.dark, sx, 0.08, 0.4); }
    const mast = p(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), M.dark, 0, 3.6, 0.4); void mast;
    const rotor = new THREE.Group(); rotor.position.set(0, 3.9, 0.4); heli.add(rotor);
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 6.2).translate(0, 0, 3.1), M.dark); b.rotation.y = k * Math.PI / 2; b.castShadow = SH; rotor.add(b); }
    heli.userData.rotor = rotor; }
  BOXES.push({ x0: HELI.x - 2.2, x1: HELI.x + 2.2, y0: 0.2, y1: 3.4, z0: HELI.z - 2.6, z1: HELI.z + 2.6, kind: 'heli' });

  // ---- generator ----
  { solid(GEN.x, GEN.z, 3.2, 2, 2.1, new THREE.MeshStandardMaterial({ color: 0xb08a24, roughness: 0.6, metalness: 0.4 }), 0, 'gen'); add(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), M.dark, GEN.x + 1.1, 2.7, GEN.z - 0.5); add(boxGeo(3.6, 0.15, 2.4), M.metal, GEN.x, 2.2, GEN.z); }

  // ---- fuel tanks + barrels ----
  const tankM = new THREE.MeshStandardMaterial({ color: 0xc8c2b0, roughness: 0.45, metalness: 0.5 });
  for (const z of [56, 61]) { const t = add(new THREE.CylinderGeometry(1.8, 1.8, 9, 20), tankM, 76, 2.3, z); t.rotation.z = Math.PI / 2; BOXES.push({ x0: 71.5, x1: 80.5, y0: 0.5, y1: 4.1, z0: z - 1.8, z1: z + 1.8, kind: 'tank' }); }
  { const s = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), new THREE.MeshStandardMaterial({ map: signTex('FLAMMABLE', '#c0281c', '#ffe8c0') })); s.position.set(76, 2.4, 54.15); s.rotation.y = Math.PI; scene.add(s); }
  EXPLOSIVES.push({ x: 76, y: 2.3, z: 58.5, r: 3.6, alive: true, big: true, kind: 'tank' });
  const barrelG = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 14);
  const barrelM = new THREE.MeshStandardMaterial({ color: 0xa3261a, roughness: 0.5, metalness: 0.5 });
  for (const [cx, cz] of [[28, 2], [-32, 58], [64, 4], [-62, 21]]) {
    const ms = [];
    for (let k = 0; k < 5; k++) { const a = k * 1.3, rr = k ? 0.85 : 0; const m = add(barrelG, barrelM, cx + Math.cos(a) * rr, 0.6, cz + Math.sin(a) * rr); ms.push(m); }
    EXPLOSIVES.push({ x: cx, y: 0.6, z: cz, r: 1.4, alive: true, big: false, kind: 'barrels', meshes: ms });
  }

  // ---- crates and sandbags (cover) ----
  for (const [x, z, s, n] of [[-30, 22, 1.4, 3], [-36, 10, 1.2, 2], [30, 52, 1.3, 3], [-70, 60, 1.5, 4], [40, 62, 1.2, 2], [-8, 30, 1.2, 2], [82, 22, 1.4, 3], [-82, 40, 1.3, 2]]) {
    for (let k = 0; k < n; k++) { const ox = (k % 2) * s * 1.05, oy = k >= 2 ? s : 0, oz = 0; solid(x + ox, z + oz, s, s, s, M.wood, oy, 'crate', 1.4); }
  }
  for (const [x, z, w, d] of [[0, -8, 6, 1.1], [-40, 0, 1.1, 5], [40, 0, 1.1, 5], [-20, 64, 5, 1.1], [30, 74, 1.1, 5]]) solid(x, z, w, d, 1.1, M.sand, 0, 'sandbag', 1);

  // ---- lamp posts ----
  const lamps = [[-25, 40], [25, 40], [0, 20], [-55, 70], [60, 60], [-60, 5], [60, 5], [0, 92]];
  const bulbM = new THREE.MeshBasicMaterial({ color: night ? new THREE.Color(3, 2.4, 1.6) : 0x8a8a80 });
  for (const [x, z] of lamps) { add(new THREE.CylinderGeometry(0.08, 0.12, 7, 6), M.dark, x, 3.5, z); add(new THREE.BoxGeometry(0.9, 0.16, 0.4), M.dark, x + 0.35, 7, z); add(new THREE.BoxGeometry(0.6, 0.06, 0.3), bulbM, x + 0.45, 6.9, z, false, false); }
  const out = { M, heli, lamps, towers };
  if (night) {
    out.lampLights = [];
    for (const [x, z] of lamps.slice(0, Q.shadows ? 6 : 4)) { const l = new THREE.PointLight(0xffc98a, 60, 26, 1.7); l.position.set(x + 0.45, 6.6, z); scene.add(l); out.lampLights.push(l); }
    // light pools for visibility checks
    out.lightPools = lamps.map(([x, z]) => ({ x, z, r: 11 }));
  }
  buildNav();
  return out;
}

// ---------- ray / segment queries ----------
// returns t in [0,1] along segment of first box hit, or Infinity
export function segBoxes(ax, ay, az, bx, by, bz, ignore) {
  const dx = bx - ax, dy = by - ay, dz = bz - az; let best = Infinity, hitBox = null;
  for (const b of BOXES) {
    if (ignore && ignore(b)) continue;
    let t0 = 0, t1 = 1;
    const sl = (o, d, lo, hi) => { if (Math.abs(d) < 1e-9) return o >= lo && o <= hi; let u0 = (lo - o) / d, u1 = (hi - o) / d; if (u0 > u1) { const t = u0; u0 = u1; u1 = t; } if (u0 > t0) t0 = u0; if (u1 < t1) t1 = u1; return t0 <= t1; };
    if (!sl(ax, dx, b.x0, b.x1) || !sl(ay, dy, b.y0, b.y1) || !sl(az, dz, b.z0, b.z1)) continue;
    if (t0 < best) { best = t0; hitBox = b; }
  }
  segBoxes.box = hitBox; return best;
}
export function insideBox(x, y, z) { for (const b of BOXES) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1) return b; return null; }

// ---------- nav grid (1m) for off-route movement ----------
export const NAV = { x0: -100, z0: -25, w: 200, h: 140, block: null };
function buildNav() {
  const N = NAV; N.block = new Uint8Array(N.w * N.h);
  for (const b of BOXES) { if (b.y0 > 1.5) continue; for (let z = Math.floor(b.z0 - 0.7 - N.z0); z <= Math.ceil(b.z1 + 0.7 - N.z0); z++) for (let x = Math.floor(b.x0 - 0.7 - N.x0); x <= Math.ceil(b.x1 + 0.7 - N.x0); x++) if (x >= 0 && z >= 0 && x < N.w && z < N.h) N.block[z * N.w + x] = 1; }
  for (const e of EXPLOSIVES) if (!e.big) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) { const cx = Math.floor(e.x - N.x0) + x, cz = Math.floor(e.z - N.z0) + z; if (cx >= 0 && cz >= 0 && cx < N.w && cz < N.h) N.block[cz * N.w + cx] = 1; }
}
export function navFree(x, z) { const cx = Math.floor(x - NAV.x0), cz = Math.floor(z - NAV.z0); if (cx < 0 || cz < 0 || cx >= NAV.w || cz >= NAV.h) return false; return !NAV.block[cz * NAV.w + cx]; }
// A* on 8-connected grid -> array of [x,z] waypoints (smoothed)
export function findPath(sx, sz, tx, tz) {
  const N = NAV, W = N.w, H = N.h; const cl = (v, m) => Math.max(0, Math.min(m - 1, v));
  let s = cl(Math.floor(sx - N.x0), W) + cl(Math.floor(sz - N.z0), H) * W, t = cl(Math.floor(tx - N.x0), W) + cl(Math.floor(tz - N.z0), H) * W;
  const nearestFree = (c) => { if (!N.block[c]) return c; const cx = c % W, cz = (c / W) | 0; for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, z = cz + dz; if (x >= 0 && z >= 0 && x < W && z < H && !N.block[z * W + x]) return z * W + x; } return c; };
  s = nearestFree(s); t = nearestFree(t);
  const g = new Float32Array(W * H).fill(1e9), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const heap = []; const push = (c, f) => { heap.push([f, c]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
  const tx0 = t % W, tz0 = (t / W) | 0; const hfn = (c) => Math.hypot(c % W - tx0, ((c / W) | 0) - tz0);
  g[s] = 0; push(s, hfn(s)); let it = 0;
  while (heap.length && it++ < 40000) {
    const c = pop(); if (c === t) break; if (closed[c]) continue; closed[c] = 1;
    const cx = c % W, cz = (c / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= W || z >= H) continue; const n = z * W + x; if (N.block[n] || closed[n]) continue;
      if (dx && dz && (N.block[cz * W + x] || N.block[z * W + cx])) continue;
      const ng = g[c] + (dx && dz ? 1.414 : 1); if (ng < g[n]) { g[n] = ng; from[n] = c; push(n, ng + hfn(n)); }
    }
  }
  if (from[t] < 0 && t !== s) return [[tx, tz]];
  const cells = []; for (let c = t; c >= 0 && c !== s; c = from[c]) cells.push(c); cells.reverse();
  const pts = cells.map((c) => [N.x0 + (c % W) + 0.5, N.z0 + ((c / W) | 0) + 0.5]);
  // string-pull smoothing using grid line checks
  const out = []; let ax = sx, az = sz, i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !lineFree(ax, az, pts[j][0], pts[j][1])) j--; out.push(pts[j]); ax = pts[j][0]; az = pts[j][1]; i = j + 1; }
  if (out.length) out[out.length - 1] = navFree(tx, tz) ? [tx, tz] : out[out.length - 1];
  return out;
}
export function lineFree(ax, az, bx, bz) { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.5); for (let k = 1; k <= n; k++) { const t = k / n; if (!navFree(ax + (bx - ax) * t, az + (bz - az) * t)) return false; } return true; }
