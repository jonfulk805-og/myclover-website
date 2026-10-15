// Neighbourhood builder: road, yards, houses, trees, props. Static scenery is merged per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { T, rng, roadLines } from './textures.js';

export const ROAD_HW = 8, CURB = 8.3, STRIP = 10.4, WALK = 12.2, LOT = 26, HOUSE_X = 25;

export const THEMES = [
  { name: 'Maple Row', time: 'Morning', sun: [0xfff1d6, 3.2], sunDir: [-0.55, 0.62, 0.35], sky: [0x6fa6dc, 0xd9e6ee], hemi: [0xcfe3ff, 0x5d6b3a, 1.05], fog: 0xc9d8e0, leafHues: [95, 105, 85], lawn: 0, density: 0.0062 },
  { name: 'Oakridge Avenue', time: 'Midday', sun: [0xffffff, 3.6], sunDir: [0.35, 0.86, 0.25], sky: [0x4d8fd6, 0xcfe0ec], hemi: [0xd8ecff, 0x637341, 1.15], fog: 0xbdd2e2, leafHues: [100, 115, 80], lawn: 1, density: 0.0055 },
  { name: 'Sunset Court', time: 'Golden hour', sun: [0xffb36b, 3.4], sunDir: [0.75, 0.32, -0.25], sky: [0x5a78b8, 0xf2c08d], hemi: [0xffd6b0, 0x4d4a32, 0.95], fog: 0xe0b994, leafHues: [32, 18, 95, 45], lawn: 2, density: 0.0068 },
];

const HOUSE_COLORS = ['#e3d6b8', '#9fb7c4', '#d2b483', '#94ab86', '#e0c39a', '#7f97b0', '#c99a7c', '#ece4d2', '#b59f7a', '#a7b99c', '#c46f5a', '#6f8a7a', '#d9c26e'];
const ROOF_COLORS = ['#4a4643', '#5b3f33', '#3c4450', '#6b5a48', '#45503f', '#2f3236'];
const DOOR_COLORS = ['#7a2e2a', '#24425e', '#2f4f3a', '#333', '#8a5a2b', '#5c2d4f'];
const CAR_COLORS = [0xb32222, 0x1f4f8a, 0xdedede, 0x2a2a2a, 0x7a8b8f, 0x335b3d, 0xc9a227];

// ---------- materials ----------
const MAT = {};
export function mat(key) {
  if (MAT[key]) return MAT[key];
  let m;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  if (key === 'asphalt') m = std({ map: T('asphalt', [3, 24]), roughness: 0.92, color: 0xbfbfbf });
  else if (key === 'concrete') m = std({ map: T('concrete', [1, 1]), roughness: 0.9 });
  else if (key === 'walk') m = std({ map: T('concrete', [1, 40]), roughness: 0.88 });
  else if (key === 'drive') m = std({ map: T('concrete', [2, 4]), roughness: 0.9, color: 0xdedad2 });
  else if (key === 'curb') m = std({ color: 0xbdb8ae, roughness: 0.8 });
  else if (key.startsWith('grass')) { const v = +key.slice(5); m = std({ map: T('grass', [40, 40], v), roughness: 1 }); }
  else if (key === 'deadgrass') m = std({ map: T('grass', [3, 3], 2), roughness: 1, color: 0xb59a6a });
  else if (key === 'soil') m = std({ map: T('soil', [2, 1]), roughness: 1 });
  else if (key === 'lines') m = new THREE.MeshStandardMaterial({ map: roadLines(), transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  else if (key === 'wood') m = std({ map: T('wood', [1, 1]), roughness: 0.8 });
  else if (key === 'bark') m = std({ map: T('bark', [1, 2]), roughness: 1 });
  else if (key === 'brick') m = std({ map: T('brick', [1, 1]), roughness: 0.95 });
  else if (key === 'pole') m = std({ color: 0x55595c, roughness: 0.5, metalness: 0.6 });
  else if (key === 'lamp') m = std({ color: 0xfff4d0, emissive: 0xffe6a8, emissiveIntensity: 0.6 });
  else if (key === 'glass') m = std({ map: T('windowTex', [1, 1], 'n'), roughness: 0.15, metalness: 0.3 });
  else if (key === 'hostileglass') m = std({ map: T('boardedWindow', [1, 1]), emissive: 0x39ff6a, emissiveMap: T('boardedWindow', [1, 1], true), emissiveIntensity: 0.9, roughness: 0.8 });
  else if (key === 'trim') m = std({ color: 0xd8d3c6, roughness: 0.85 });
  else if (key === 'dark') m = std({ color: 0x1d1f1f, roughness: 0.6 });
  else if (key === 'tire') m = std({ color: 0x151515, roughness: 0.9 });
  else if (key === 'carglass') m = std({ color: 0x1b2730, roughness: 0.08, metalness: 0.8 });
  else if (key === 'chrome') m = std({ color: 0xcfd3d6, roughness: 0.2, metalness: 1 });
  else if (key === 'rust') m = std({ map: T('rustMetal', [1, 1], '#5f6458'), roughness: 0.75, metalness: 0.45 });
  else if (key === 'burnt') m = std({ map: T('rustMetal', [1, 1], '#2e2a26'), roughness: 0.95, metalness: 0.2 });
  else if (key === 'greenlight') m = new THREE.MeshBasicMaterial({ color: 0x5dff7a });
  else if (key === 'redlight') m = new THREE.MeshBasicMaterial({ color: 0xff3b2f });
  else if (key === 'hydrant') m = std({ color: 0xc8261f, roughness: 0.5, metalness: 0.2 });
  else if (key === 'mailbox') m = std({ color: 0x2b2f33, roughness: 0.5, metalness: 0.5 });
  else if (key === 'bin') m = std({ color: 0x2d5a3a, roughness: 0.7 });
  else if (key === 'scorch') m = new THREE.MeshBasicMaterial({ map: T('scorch', [1, 1]), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  else if (key.startsWith('leaf')) { const h = +key.slice(4); m = std({ map: T('leaves', [2, 2], h), roughness: 0.95, color: 0xffffff }); }
  else if (key.startsWith('flower')) m = std({ color: key.slice(6), roughness: 0.8 });
  else if (key.startsWith('siding')) m = std({ map: T('siding', [2, 1], key.slice(6)), roughness: 0.85 });
  else if (key.startsWith('roof')) m = std({ map: T('roofShingle', [3, 2], key.slice(4)), roughness: 0.9 });
  else if (key.startsWith('paint')) m = std({ color: key.slice(5), roughness: 0.55 });
  else if (key.startsWith('car')) m = std({ color: +key.slice(3), roughness: 0.28, metalness: 0.55 });
  else m = std({ color: 0xff00ff });
  return (MAT[key] = m);
}

// ---------- batcher ----------
class Batcher {
  constructor() { this.parts = new Map(); }
  add(geom, key, matrix) {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
    g.applyMatrix4(matrix);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
  }
  build(group, shadows = true) {
    for (const [key, list] of this.parts) {
      const m = mergeGeometries(list, false);
      list.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(m, mat(key));
      const noShadow = key === 'lines' || key === 'scorch' || key.startsWith('grass') || key === 'asphalt' || key === 'walk' || key === 'drive';
      mesh.castShadow = shadows && !noShadow; mesh.receiveShadow = true; mesh.userData.own = true;
      group.add(mesh);
    }
  }
}

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
function mtx(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { return new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)); }

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  sph: new THREE.SphereGeometry(0.5, 8, 6),
  plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  wheel: new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14).rotateZ(Math.PI / 2),
};
function blob(seed, detail = 1) {
  const R = rng(seed); const g = new THREE.IcosahedronGeometry(1, detail); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { V.fromBufferAttribute(p, i); const k = 0.82 + R() * 0.3; p.setXYZ(i, V.x * k, V.y * k * 0.9, V.z * k); }
  g.computeVertexNormals(); return g;
}
const BLOBS = [1, 2, 3, 4, 5].map(s => blob(s * 31));

function gableRoof(w, d, h, over = 0.6) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 - over, 0); s.lineTo(0, h); s.lineTo(w / 2 + over, 0); s.lineTo(w / 2 + over, -0.25); s.lineTo(0, h - 0.3); s.lineTo(-w / 2 - over, -0.25); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d + over * 2, bevelEnabled: false });
  g.translate(0, 0, -(d + over * 2) / 2);
  // scale uvs to world-ish units
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.12, uv.getY(i) * 0.12);
  return g;
}
function gableEnd(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, h); s.lineTo(w / 2, 0); s.closePath(); return new THREE.ShapeGeometry(s); }

// ---------- house parts ----------
// Returns [{g, key, m}] in local space, facade facing +z. Footprint approx w x d.
export function housePlan(R, hostile) {
  const parts = [];
  const add = (g, key, m) => parts.push({ g, key, m });
  const w = 9 + R() * 3, d = 8 + R() * 2.5, h = 3.4 + R() * 0.6, two = R() < 0.4;
  const H = two ? h * 2 : h;
  const wall = 'siding' + HOUSE_COLORS[(R() * HOUSE_COLORS.length) | 0];
  const roofK = 'roof' + ROOF_COLORS[(R() * ROOF_COLORS.length) | 0];
  const glass = hostile ? 'hostileglass' : 'glass';
  add(G.box, 'concrete', mtx(0, 0.25, 0, 0, w + 0.4, 0.5, d + 0.4));
  add(G.box, R() < 0.25 ? 'brick' : wall, mtx(0, 0.5 + H / 2, 0, 0, w, H, d));
  const rh = 2.2 + R() * 1.2; const ridgeAlongZ = R() < 0.5;
  if (ridgeAlongZ) { add(gableRoof(d, w, rh), roofK, mtx(0, 0.5 + H, 0, Math.PI / 2)); add(gableEnd(d, rh), wall, mtx(w / 2 + 0.01, 0.5 + H, 0, Math.PI / 2)); add(gableEnd(d, rh), wall, mtx(-w / 2 - 0.01, 0.5 + H, 0, -Math.PI / 2)); }
  else { add(gableRoof(w, d, rh), roofK, mtx(0, 0.5 + H, 0)); add(gableEnd(w, rh), wall, mtx(0, 0.5 + H, d / 2 + 0.01)); add(gableEnd(w, rh), wall, mtx(0, 0.5 + H, -d / 2 - 0.01, Math.PI)); }
  // garage wing
  let gx = 0;
  if (R() < 0.6) {
    const gw = 5.5, gd = 6.5, side = R() < 0.5 ? -1 : 1; gx = side * (w / 2 + gw / 2);
    add(G.box, wall, mtx(gx, 0.5 + 1.6, d / 2 - gd / 2, 0, gw, 3.2, gd));
    add(gableRoof(gw, gd, 1.4, 0.4), roofK, mtx(gx, 3.7, d / 2 - gd / 2, Math.PI / 2 * 0));
    add(gableEnd(gw, 1.4), wall, mtx(gx, 3.7, d / 2 + 0.01));
    add(G.box, hostile ? 'rust' : 'paint#ece8de', mtx(gx, 1.75, d / 2 + 0.02, 0, 4.2, 2.5, 0.1));
    for (let i = 0; i < 4; i++) add(G.box, 'dark', mtx(gx, 0.85 + i * 0.62, d / 2 + 0.08, 0, 4.1, 0.04, 0.04));
  }
  // windows on facade
  const nWin = w > 10.5 ? 3 : 2;
  const doorX = (R() - 0.5) * 2;
  for (let fl = 0; fl < (two ? 2 : 1); fl++) {
    const y = 0.5 + fl * h + h * 0.55;
    for (let i = 0; i < nWin; i++) {
      const x = -w / 2 + (i + 0.5) * (w / nWin);
      if (fl === 0 && Math.abs(x - doorX) < 1.6) continue;
      add(G.box, glass, mtx(x, y, d / 2 + 0.03, 0, 1.4, 1.5, 0.06));
      add(G.box, 'trim', mtx(x, y - 0.82, d / 2 + 0.1, 0, 1.7, 0.14, 0.2));
      if (!hostile && R() < 0.6) { add(G.box, 'paint' + DOOR_COLORS[(R() * 6) | 0], mtx(x - 0.95, y, d / 2 + 0.06, 0, 0.35, 1.6, 0.05)); add(G.box, 'paint' + DOOR_COLORS[(R() * 6) | 0], mtx(x + 0.95, y, d / 2 + 0.06, 0, 0.35, 1.6, 0.05)); }
    }
  }
  // side windows
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) add(G.box, glass, mtx(sx * (w / 2 + 0.03), 0.5 + h * 0.55, -d / 4 + i * d / 2.2 - 0.3, Math.PI / 2, 1.3, 1.4, 0.06));
  // door + porch
  add(G.box, hostile ? 'rust' : 'paint' + DOOR_COLORS[(R() * DOOR_COLORS.length) | 0], mtx(doorX, 1.55, d / 2 + 0.04, 0, 1.1, 2.1, 0.08));
  add(G.box, 'trim', mtx(doorX, 1.55, d / 2 + 0.02, 0, 1.4, 2.4, 0.04));
  add(G.box, 'concrete', mtx(doorX, 0.3, d / 2 + 1.2, 0, 2.8, 0.6, 2.2));
  add(G.box, 'concrete', mtx(doorX, 0.12, d / 2 + 2.6, 0, 2.2, 0.24, 0.7));
  if (R() < 0.7) {
    add(G.box, 'trim', mtx(doorX, 3.1, d / 2 + 1.3, 0, 3.4, 0.18, 2.6));
    add(G.box, 'trim', mtx(doorX - 1.5, 1.8, d / 2 + 2.4, 0, 0.18, 2.6, 0.18));
    add(G.box, 'trim', mtx(doorX + 1.5, 1.8, d / 2 + 2.4, 0, 0.18, 2.6, 0.18));
  }
  // chimney
  if (R() < 0.6) add(G.box, 'brick', mtx(w * 0.28 * (R() < 0.5 ? -1 : 1), 0.5 + H + rh * 0.7, -d * 0.15, 0, 0.9, rh * 1.4 + 1, 0.9));
  // flower bed + bushes along facade (non hostile)
  if (!hostile) {
    add(G.box, 'soil', mtx(-w / 4 + doorX / 2 - 1, 0.18, d / 2 + 0.9, 0, w / 2 - 2, 0.3, 1.1));
    const cols = ['#e84a5f', '#f6c445', '#f2f0ea', '#b05fd1', '#ff8c42', '#ff5fa2'];
    for (let i = 0; i < 18; i++) { const c = cols[(R() * cols.length) | 0]; add(G.sph, 'flower' + c, mtx(-w / 2 + 0.7 + R() * (w / 2 - 1.5), 0.45 + R() * 0.15, d / 2 + 0.5 + R() * 0.8, 0, 0.28, 0.28, 0.28)); }
    for (let i = 0; i < 3; i++) add(BLOBS[(R() * 5) | 0], 'leaf' + (110 + ((R() * 20) | 0) - 10), mtx(w / 2 - 1 - i * 1.6, 0.7, d / 2 + 0.9, R() * 6, 0.85, 0.75, 0.85));
  } else {
    // machine infestation: antenna mast, dish, turret pod, cables, scrap
    const ry = 0.5 + H + rh;
    const ax = w * 0.3, ay = ry - rh * 0.6;
    add(G.cyl6, 'rust', mtx(ax, ay + 2.2, -d * 0.1, 0, 0.18, 4.6, 0.18));
    add(G.box, 'rust', mtx(ax, ay + 3.6, -d * 0.1, 0, 1.6, 0.08, 0.08));
    add(G.box, 'rust', mtx(ax, ay + 4.1, -d * 0.1, 0.5, 1.1, 0.08, 0.08));
    add(G.sph, 'greenlight', mtx(ax, ay + 4.55, -d * 0.1, 0, 0.25, 0.25, 0.25));
    add(new THREE.SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'rust', mtx(-w / 3, ry - 0.6, d / 4, 0, 1, 0.4, 1, Math.PI / 3.2));
    add(G.box, 'rust', mtx(w / 2 + 0.8, 1.3, d / 2 - 1, 0, 1.4, 2.6, 1));
    for (let i = 0; i < 5; i++) add(G.box, 'rust', mtx(-w / 2 + R() * w, 0.25, d / 2 + 2 + R() * 5, R() * 3, 0.5 + R() * 1.4, 0.3 + R() * 0.5, 0.4 + R()));
  }
  return { parts, w: w + (gx ? 5.5 : 0), d, H: H + rh + 0.5, gx, turretY: 0.5 + H + rh };
}

function addTree(B, x, z, R, hues, scale = 1) {
  const h = (3.2 + R() * 2.2) * scale, tr = (0.22 + R() * 0.12) * scale;
  B.add(G.cyl, 'bark', mtx(x, h / 2, z, R() * 6, tr * 2, h, tr * 2));
  const hue = hues[(R() * hues.length) | 0];
  const n = 3 + ((R() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = R() * 7, r = (i === 0 ? 0 : 1.1 + R() * 0.8) * scale, s = (1.7 + R() * 1.1) * scale;
    B.add(BLOBS[(R() * 5) | 0], 'leaf' + (hue + ((R() * 3) | 0) * 4), mtx(x + Math.cos(a) * r, h + (0.6 + R() * 1.6) * scale, z + Math.sin(a) * r, R() * 6, s, s * 0.85, s));
  }
}

function addCar(B, x, z, ry, R, burnt) {
  const col = burnt ? 'burnt' : 'car' + CAR_COLORS[(R() * CAR_COLORS.length) | 0];
  const M = mtx(x, 0, z, ry);
  const P = (g, k, m) => B.add(g, k, M.clone().multiply(m));
  P(G.box, col, mtx(0, 0.75, 0, 0, 1.9, 0.75, 4.4));
  P(G.box, col, mtx(0, 1.38, -0.2, 0, 1.7, 0.6, 2.3));
  P(G.box, burnt ? 'dark' : 'carglass', mtx(0, 1.38, -0.2, 0, 1.72, 0.48, 2.1));
  for (const [wx, wz] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]]) P(G.wheel, 'tire', mtx(wx, 0.42, wz));
  if (!burnt) { P(G.box, 'chrome', mtx(0, 0.6, 2.22, 0, 1.7, 0.18, 0.06)); P(G.box, 'redlight', mtx(0.7, 0.9, -2.21, 0, 0.3, 0.14, 0.04)); P(G.box, 'redlight', mtx(-0.7, 0.9, -2.21, 0, 0.3, 0.14, 0.04)); }
}

function addFence(B, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), n = Math.floor(len / 0.32);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  B.add(G.box, 'wood', mtx(cx, 0.45, cz, ry, 0.06, 0.08, len));
  B.add(G.box, 'wood', mtx(cx, 0.95, cz, ry, 0.06, 0.08, len));
  for (let i = 0; i <= n; i++) { const t = i / n; B.add(G.box, 'wood', mtx(x0 + (x1 - x0) * t, 0.6, z0 + (z1 - z0) * t, ry, 0.08, 1.2, 0.14)); }
}

// ---------- sector ----------
// Returns { group, length, strongholdLots:[{x,z,side,plan}], robotSpots:[{x,z}], sun, theme }
export function buildSector(scene, idx, cfg, quality) {
  const theme = THEMES[idx % THEMES.length];
  const R = rng(1000 + idx * 7919);
  const group = new THREE.Group(); scene.add(group);
  const B = new Batcher();
  const lots = cfg.lots, L = lots * LOT;
  const z0 = 18, z1 = -L - 6; // drivable/visible span
  const span = z0 - z1 + 120, zc = (z0 + z1) / 2;

  // ground
  const grassKey = 'grass' + theme.lawn;
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(260, span + 200).rotateX(-Math.PI / 2), mat(grassKey));
  mat(grassKey).map.repeat.set(30, (span + 200) / 9); gr.position.set(0, 0, zc); gr.receiveShadow = true; group.add(gr);
  // road
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HW * 2, span).rotateX(-Math.PI / 2), mat('asphalt'));
  mat('asphalt').map.repeat.set(2, span / 9); road.position.set(0, 0.02, zc); road.receiveShadow = true; group.add(road);
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HW * 2 - 0.6, span).rotateX(-Math.PI / 2), mat('lines'));
  lines.position.set(0, 0.035, zc); group.add(lines);
  // centre dashes (white lane dashes for 4-lane feel on wide part)
  for (const s of [-1, 1]) {
    B.add(G.box, 'curb', mtx(s * (ROAD_HW + 0.15), 0.1, zc, 0, 0.3, 0.2, span));
    B.add(G.plane, 'walk', mtx(s * (STRIP + (WALK - STRIP) / 2), 0.06, zc, 0, WALK - STRIP, 1, span));
  }
  mat('walk').map.repeat.set(1, span / 1.8);

  const hues = theme.leafHues;
  const strongholds = [];
  // which lots are strongholds
  const slots = [];
  for (let i = 0; i < lots; i++) for (const s of [-1, 1]) slots.push({ i, s });
  // spread strongholds evenly
  const picks = new Set();
  const step = slots.length / cfg.houses;
  for (let k = 0; k < cfg.houses; k++) picks.add(Math.min(slots.length - 1, Math.floor(k * step + R() * step * 0.8)));

  slots.forEach((sl, si) => {
    const hostile = picks.has(si);
    const lz = -sl.i * LOT - LOT / 2 + 4;
    const s = sl.s;
    const plan = housePlan(R, hostile);
    const hx = s * HOUSE_X;
    const ry = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    const hz = lz + (R() - 0.5) * 3;
    // lot features: driveway, fence, trees, mailbox
    const driveZ = hz + (plan.gx ? -plan.gx * 1 : (R() < 0.5 ? -1 : 1) * 6.5) * 1;
    const dz = Math.max(lz - LOT / 2 + 3, Math.min(lz + LOT / 2 - 3, driveZ));
    const dlen = HOUSE_X - 4 - ROAD_HW;
    B.add(G.plane, 'drive', mtx(s * (ROAD_HW + dlen / 2 + 0.3), 0.07, dz, 0, dlen, 1, 4.2));
    // walkway to door
    B.add(G.plane, 'walk', mtx(s * (WALK + (HOUSE_X - plan.d / 2 - WALK) / 2), 0.065, hz, 0, HOUSE_X - plan.d / 2 - WALK, 1, 1.3));
    B.add(G.box, 'pole', mtx(s * (STRIP + 0.3), 0.6, dz + 2.8, 0, 0.1, 1.2, 0.1));
    B.add(G.box, 'mailbox', mtx(s * (STRIP + 0.3), 1.25, dz + 2.8, 0, 0.5, 0.4, 0.3));
    if (!hostile && R() < 0.45) addCar(B, s * (HOUSE_X - 9), dz, s > 0 ? Math.PI / 2 : -Math.PI / 2, R, false);
    // fences between lots and at back
    if (sl.i % 1 === 0) addFence(B, s * (WALK + 1.5), lz - LOT / 2, s * (HOUSE_X + 9), lz - LOT / 2);
    addFence(B, s * (HOUSE_X + 9), lz - LOT / 2, s * (HOUSE_X + 9), lz + LOT / 2);
    // yard trees
    if (R() < 0.85) addTree(B, s * (HOUSE_X - 7 - R() * 2), lz + (R() < 0.5 ? -1 : 1) * (8 + R() * 2), R, hues, 1);
    addTree(B, s * (HOUSE_X + 11 + R() * 6), lz + (R() - 0.5) * 16, R, hues, 1.3);
    if (R() < 0.6) addTree(B, s * (HOUSE_X + 16 + R() * 10), lz + (R() - 0.5) * 20, R, hues, 1.5);
    // street trees in planting strip
    if (R() < 0.7) addTree(B, s * ((CURB + STRIP) / 2), lz + 7 + R() * 4, R, hues, 0.9);
    if (hostile) {
      // dead lawn patch + scorch
      B.add(G.plane, 'scorch', mtx(s * (HOUSE_X - 6), 0.08, hz + (R() - 0.5) * 8, R() * 6, 9, 1, 9));
      const grp = new THREE.Group();
      for (const p of plan.parts) {
        const mesh = new THREE.Mesh(p.g, mat(p.key)); p.m.decompose(mesh.position, mesh.quaternion, mesh.scale);
        mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
      }
      grp.position.set(hx, 0, hz); grp.rotation.y = ry; group.add(grp);
      strongholds.push({ x: hx, z: hz, side: s, plan, group: grp });
    } else {
      const base = mtx(hx, 0, hz, ry);
      for (const p of plan.parts) B.add(p.g, p.key, base.clone().multiply(p.m));
    }
  });

  // streetlights alternate sides
  for (let z = 6; z > -L; z -= LOT) {
    for (const s of [-1, 1]) {
      const zz = z - (s > 0 ? LOT / 2 : 0);
      const x = s * (CURB + 0.6);
      B.add(G.cyl, 'pole', mtx(x, 3.5, zz, 0, 0.22, 7, 0.22));
      B.add(G.box, 'pole', mtx(x - s * 1.1, 6.95, zz, 0, 2.3, 0.14, 0.14));
      B.add(G.box, 'pole', mtx(x - s * 2.2, 6.85, zz, 0, 0.9, 0.22, 0.45));
      B.add(G.box, 'lamp', mtx(x - s * 2.2, 6.72, zz, 0, 0.7, 0.06, 0.32));
    }
    // hydrant
    if (R() < 0.5) { const s = R() < 0.5 ? -1 : 1; B.add(G.cyl, 'hydrant', mtx(s * (CURB + 1.2), 0.45, z - 10, 0, 0.36, 0.9, 0.36)); B.add(G.sph, 'hydrant', mtx(s * (CURB + 1.2), 0.92, z - 10, 0, 0.36, 0.3, 0.36)); }
  }
  // wrecked cars + scorch marks + debris on road (the machines came through)
  for (let k = 0; k < cfg.wrecks; k++) {
    const z = -20 - R() * (L - 40), x = (R() < 0.5 ? -1 : 1) * (2.5 + R() * 3.5);
    addCar(B, x, z, (R() - 0.5) * 1.4, R, true);
    B.add(G.plane, 'scorch', mtx(x, 0.05, z, R() * 6, 7, 1, 7));
  }
  for (let k = 0; k < cfg.lots * 1.6; k++) B.add(G.plane, 'scorch', mtx((R() - 0.5) * 13, 0.045, -R() * L, R() * 6, 3 + R() * 3, 1, 3 + R() * 3));
  // background: back-row houses and dense tree line
  for (let z = 20; z > -L - 60; z -= 22) for (const s of [-1, 1]) {
    const plan = housePlan(R, false); const base = mtx(s * (64 + R() * 6), 0, z + R() * 6, s < 0 ? Math.PI / 2 : -Math.PI / 2);
    for (const p of plan.parts) if (p.key !== 'glass' || R() < 0.6) B.add(p.g, p.key, base.clone().multiply(p.m));
    addTree(B, s * (48 + R() * 8), z + R() * 10, R, hues, 1.6);
    addTree(B, s * (78 + R() * 14), z + R() * 10, R, hues, 1.9);
  }
  // start/end of street: trees blocking horizon
  for (let k = 0; k < 14; k++) addTree(B, (R() - 0.5) * 90, z1 - 30 - R() * 30, R, hues, 1.8);
  for (let k = 0; k < 14; k++) addTree(B, (R() - 0.5) * 90, z0 + 40 + R() * 30, R, hues, 1.8);

  B.build(group, quality.shadows);

  // robot spawn spots spread along the street & yards
  const robotSpots = [];
  for (let k = 0; k < cfg.robots; k++) {
    const z = -24 - (k + R() * 0.8) * ((L - 36) / cfg.robots);
    const onRoad = R() < 0.65;
    const x = onRoad ? (R() - 0.5) * 12 : (R() < 0.5 ? -1 : 1) * (13 + R() * 6);
    robotSpots.push({ x, z });
  }
  return { group, length: L, strongholds, robotSpots, theme };
}
