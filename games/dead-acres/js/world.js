// DEAD ACRES - builds the farmstead scene from map.js
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as MP from './map.js';
import { planks, wallpaper, dirt, hayFloor, concreteDirty, cornStalk, perkFront, perkGlow, labelTex, moonTex, star4, tex } from './farmtex.js';
import { siding, roofShingle, rustMetal, brick, T } from './textures.js';
import { buildGun, GUNS } from './guns.js';

const { CS, K, W, H } = MP;
const rnd = (a, b) => a + Math.random() * (b - a);

export const PERK_INFO = {
  wind: { name: 'Second Wind', sub: 'Get back up once', col: '#3aa0ff', desc: 'When you go down, you get back up once. Works without power. Used up when it saves you.' },
  hide: { name: 'Iron Hide', sub: 'Take more hits', col: '#ff3a2e', desc: 'Max health +150. Takes about twice as many hits to put you down.' },
  draw: { name: 'Quick Draw', sub: 'Faster reloads', col: '#33e06a', desc: 'Reloads twice as fast. Weapon swaps are faster too.' },
  tap: { name: 'Double Tap', sub: 'Fire faster, hit harder', col: '#ffb020', desc: 'Fire rate x1.33 and every bullet hits twice.' },
  leaf: { name: 'Stamina Leaf', sub: 'Run longer', col: '#c8ff3a', desc: 'Sprint 15% faster, for twice as long.' },
};

// ---- materials ----
function stdMat(map, o = {}) { return new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0.02, ...o }); }
export function makeMats() {
  const m = {};
  m.houseOut = stdMat(tex(siding('#b9b39a'), [1, 1]), { color: 0xd8d2bc });
  m.houseIn = stdMat(tex(wallpaper(), [1, 1]));
  m.barnOut = stdMat(tex(planks('#7a2a1c', 3, true, 0.6), [1, 1]));
  m.barnIn = stdMat(tex(planks('#5a3a24', 4, true, 0.7), [1, 1]), { color: 0xb8a088 });
  m.shedOut = stdMat(tex(rustMetal('#6a6e64'), [1, 1]), { metalness: 0.4, roughness: 0.7 });
  m.shedIn = stdMat(tex(planks('#6b5a44', 5, true), [1, 1]));
  m.wallTop = new THREE.MeshStandardMaterial({ color: 0x241c16, roughness: 1 });
  m.floorHouse = stdMat(tex(planks('#5c4630', 6, false, 0.6), [1, 1]), { roughness: 0.75 });
  m.floorBarn = stdMat(tex(hayFloor(), [1, 1]));
  m.floorShed = stdMat(tex(concreteDirty(), [1, 1]));
  m.ground = stdMat(tex(dirt(0), [1, 1]));
  m.ceilHouse = stdMat(tex(planks('#3a2a1e', 7, false), [1, 1]), { color: 0x9a8a7a });
  m.ceilBarn = stdMat(tex(planks('#3a2a1e', 8, false), [1, 1]), { color: 0x6a5a4a });
  m.roof = stdMat(tex(roofShingle('#3b3e44'), [1, 1]));
  m.roofBarn = stdMat(tex(rustMetal('#6b3326'), [1, 1]), { metalness: 0.35, roughness: 0.75 });
  m.fence = stdMat(tex(planks('#7a7064', 11, true, 0.3), [1, 1]), { color: 0xb0a898 });
  m.board = stdMat(tex(planks('#8a6a46', 12, false, 0.2), [1, 1]));
  m.trim = new THREE.MeshStandardMaterial({ color: 0x8a8476, roughness: 0.85 });
  m.iron = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.6, metalness: 0.7 });
  m.rust = stdMat(tex(rustMetal('#7a5a40'), [1, 1]), { metalness: 0.5, roughness: 0.6 });
  m.stone = stdMat(tex(brick(), [1, 1]), { color: 0x9a948a });
  m.hay = stdMat(tex(hayFloor(), [1, 1]), { color: 0xe8d8a0 });
  m.cloth = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
  m.lamp = new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffb050, emissiveIntensity: 2.5 });
  m.window = new THREE.MeshStandardMaterial({ color: 0x0c1420, emissive: 0x0, roughness: 0.2, metalness: 0.4 });
  return m;
}

// geometry batcher with world-space (triplanar-ish) UVs
class Batch {
  constructor() { this.g = new Map(); }
  add(key, geo, tile = 2) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      let u, v;
      if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
      uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (!this.g.has(key)) this.g.set(key, []); this.g.get(key).push(geo);
  }
  box(key, x0, y0, z0, x1, y1, z1, tile) { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); this.add(key, g, tile); }
  quad(key, a, b, c, d, tile) { // 4 corners CCW seen from front
    const g = new THREE.BufferGeometry(); const pos = new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); this.add(key, g, tile);
  }
  flush(scene, mats, shadows) {
    const out = [];
    for (const [k, list] of this.g) {
      const merged = mergeGeometries(list.map((x) => { for (const a of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(a)) x.deleteAttribute(a); return x; }));
      const mesh = new THREE.Mesh(merged, mats[k]); mesh.receiveShadow = true; mesh.castShadow = shadows && k !== 'ground'; scene.add(mesh); out.push(mesh);
    }
    return out;
  }
}

function buildingOf(cx, cy) {
  if (cx >= 4 && cx <= 15 && cy >= 14 && cy <= 25) return 'house';
  if (cx >= 16 && cx <= 27 && cy >= 3 && cy <= 11) return 'barn';
  if (cx >= 16 && cx <= 24 && cy >= 25 && cy <= 31) return 'shed';
  return 'house';
}
const BH = { house: 3.2, barn: 5.2, shed: 3.0 };
const IN = { house: 'houseIn', barn: 'barnIn', shed: 'shedIn' }, OUT = { house: 'houseOut', barn: 'barnOut', shed: 'shedOut' };
const g = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? K.X : MP.grid[y * W + x]);
const zoneAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : MP.zoneOf[y * W + x]);

export function buildWorld(scene, Q) {
  const mats = makeMats(); const B = new Batch(); const dyn = {}; const shadows = Q.shadows;
  // ground
  B.box('ground', -60, -0.2, -60, W * CS + 60, 0, H * CS + 60, 6);
  // floors (indoor)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = g(x, y), z = zoneAt(x, y);
    const isFloor = k === K.FLOOR || k === K.PROP || (k === K.DOOR);
    if (!isFloor) continue;
    let zz = z; if (k === K.DOOR) { const d = MP.DOORS[MP.doorAt[y * W + x]]; zz = d.b; }
    if (k === K.PROP) { zz = [0, 1, 2, 3].find((q) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => zoneAt(x + a, y + b) === q)) ?? 1; }
    const key = zz === 0 ? 'floorHouse' : zz === 2 ? 'floorBarn' : zz === 3 ? 'floorShed' : null;
    if (key) B.box(key, x * CS, 0, y * CS, (x + 1) * CS, 0.02, (y + 1) * CS, 3);
  }
  // walls: per-face quads, material by what the face looks at
  const faceMat = (bld, nx, ny) => { const z = zoneAt(nx, ny), k = g(nx, ny); if (k === K.FLOOR || k === K.PROP) { const zone = MP.ZONES[z]; if (zone && zone.indoor) return IN[bld]; } return OUT[bld]; };
  const wallBox = (cx, cy, bld, y0, y1, inset = [0, 0, 0, 0], faces = 'all') => {
    // inset: [west,east,north,south] metres shaved from that side
    const x0 = cx * CS + inset[0], x1 = (cx + 1) * CS - inset[1], z0 = cy * CS + inset[2], z1 = (cy + 1) * CS - inset[3];
    const sides = [[-1, 0, 'w'], [1, 0, 'e'], [0, -1, 'n'], [0, 1, 's']];
    for (const [dx, dy, s] of sides) {
      const nk = g(cx + dx, cy + dy);
      if (faces === 'all' && (nk === K.WALL) && !inset.some((v) => v)) continue;
      const mk = faceMat(bld, cx + dx, cy + dy);
      if (s === 'w') B.quad(mk, [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], 2);
      if (s === 'e') B.quad(mk, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], 2);
      if (s === 'n') B.quad(mk, [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], 2);
      if (s === 's') B.quad(mk, [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1], 2);
    }
    B.quad('wallTop', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 2);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g(x, y) === K.WALL) { const b = buildingOf(x, y); wallBox(x, y, b, 0, BH[b]); }

  // windows (house/barn/shed) and fence gaps
  dyn.windows = [];
  MP.WINDOWS.forEach((wd, i) => {
    const bld = buildingOf(wd.cx, wd.cy), h = wd.fence ? 1.6 : BH[bld];
    const along = wd.dx !== 0 ? 'z' : 'x'; // opening runs along this axis
    const x0 = wd.cx * CS, z0 = wd.cy * CS, jam = 0.4, sill = wd.fence ? 0 : 0.85, top = 2.15;
    if (!wd.fence) {
      // jambs + sill + header as thin boxes (wall thickness = 0.5 centred)
      const t0 = 0.75, t1 = 1.25; // wall slab thickness inside the cell
      const slab = (a0, a1, y0, y1) => along === 'z' ? B.box(OUT[bld], x0 + t0, y0, z0 + a0, x0 + t1, y1, z0 + a1, 2) : B.box(OUT[bld], x0 + a0, y0, z0 + t0, x0 + a1, y1, z0 + t1, 2);
      // full-thickness return walls so the cell edges line up with neighbouring walls
      if (along === 'z') { wallBox(wd.cx, wd.cy, bld, 0, h, [0, 0, 0, CS - jam], 'x'); wallBox(wd.cx, wd.cy, bld, 0, h, [0, 0, CS - jam, 0], 'x'); }
      else { wallBox(wd.cx, wd.cy, bld, 0, h, [0, CS - jam, 0, 0], 'x'); wallBox(wd.cx, wd.cy, bld, 0, h, [CS - jam, 0, 0, 0], 'x'); }
      slab(jam, CS - jam, 0, sill); slab(jam, CS - jam, top, h);
      // frame trim
      const tr = (a0, a1, y0, y1) => along === 'z' ? B.box('trim', x0 + t0 - 0.04, y0, z0 + a0, x0 + t1 + 0.04, y1, z0 + a1, 1) : B.box('trim', x0 + a0, y0, z0 + t0 - 0.04, x0 + a1, y1, z0 + t1 + 0.04, 1);
      tr(jam - 0.06, jam, sill, top); tr(CS - jam, CS - jam + 0.06, sill, top); tr(jam - 0.06, CS - jam + 0.06, sill - 0.06, sill); tr(jam - 0.06, CS - jam + 0.06, top, top + 0.06);
    } else {
      // fence posts either side
      const p = (a) => along === 'z' ? B.box('fence', x0 + 0.88, 0, z0 + a - 0.08, x0 + 1.12, 1.8, z0 + a + 0.08, 1) : B.box('fence', x0 + a - 0.08, 0, z0 + 0.88, x0 + a + 0.08, 1.8, z0 + 1.12, 1);
      p(0.1); p(CS - 0.1);
    }
    // boards: 6 meshes, nailed across the opening at jaunty angles
    const grp = new THREE.Group(); scene.add(grp); const boards = [];
    const cx = x0 + CS / 2, cz = z0 + CS / 2;
    for (let b = 0; b < 6; b++) {
      const len = CS - 2 * jam + 0.45, m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.17, 0.035), mats.board);
      const yy = (wd.fence ? 0.25 : sill + 0.12) + b * ((wd.fence ? 1.35 : top - sill - 0.24) / 5);
      const ang = (b % 2 ? 1 : -1) * rnd(0.05, 0.32);
      const outward = wd.fence ? 0 : -0.27 + (b % 3) * 0.025; // inside face of the wall
      m.castShadow = shadows;
      const home = new THREE.Vector3(), rot = new THREE.Euler();
      if (along === 'z') { home.set(cx + wd.dx * outward, yy, cz); rot.set(ang, Math.PI / 2, 0); } else { home.set(cx, yy, cz + wd.dy * outward); rot.set(0, 0, ang); }
      m.position.copy(home); m.rotation.copy(rot); grp.add(m);
      boards.push({ m, home, rot, t: 0, state: 'on' });
    }
    dyn.windows.push({ i, boards, cx, cz, out: [wd.dx, wd.dy], inside: [cx - wd.dx * 1.6, cz - wd.dy * 1.6] });
  });
  // fences
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g(x, y) === K.FENCE) {
    const x0 = x * CS, z0 = y * CS;
    const vert = g(x, y - 1) === K.FENCE || g(x, y + 1) === K.FENCE || g(x, y - 1) === K.WIN || g(x, y + 1) === K.WIN || g(x, y - 1) === K.WALL || g(x, y + 1) === K.WALL;
    if (vert) { B.box('fence', x0 + 0.9, 0, z0, x0 + 1.1, 1.8, z0 + 0.2, 1); for (const yy of [0.45, 1.0, 1.5]) B.box('fence', x0 + 0.95, yy, z0, x0 + 1.05, yy + 0.16, z0 + CS, 2); for (let k = 0; k < 5; k++) B.box('fence', x0 + 1.05, 0.15, z0 + 0.2 + k * 0.38, x0 + 1.1, 1.65 + (k % 2) * 0.1, z0 + 0.45 + k * 0.38, 1); }
    else { B.box('fence', x0, 0, z0 + 0.9, x0 + 0.2, 1.8, z0 + 1.1, 1); for (const yy of [0.45, 1.0, 1.5]) B.box('fence', x0, yy, z0 + 0.95, x0 + CS, yy + 0.16, z0 + 1.05, 2); for (let k = 0; k < 5; k++) B.box('fence', x0 + 0.2 + k * 0.38, 0.15, z0 + 1.05, x0 + 0.45 + k * 0.38, 1.65 + (k % 2) * 0.1, z0 + 1.1, 1); }
  }
  // ceilings
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = g(x, y); if (!(k === K.FLOOR || k === K.PROP || k === K.DOOR)) continue;
    const bld = (k === K.DOOR) ? null : (zoneAt(x, y) === 0 ? 'house' : zoneAt(x, y) === 2 ? 'barn' : zoneAt(x, y) === 3 ? 'shed' : null);
    let b2 = bld; if (k === K.PROP) b2 = (x >= 5 && x <= 14 && y >= 15 && y <= 24) ? 'house' : (x >= 17 && x <= 26 && y >= 4 && y <= 10) ? 'barn' : (x >= 17 && x <= 23 && y >= 26 && y <= 30) ? 'shed' : null;
    if (!b2) continue;
    const hh = BH[b2]; B.quad(b2 === 'barn' ? 'ceilBarn' : 'ceilHouse', [x * CS, hh, y * CS], [(x + 1) * CS, hh, y * CS], [(x + 1) * CS, hh, (y + 1) * CS], [x * CS, hh, (y + 1) * CS], 3);
  }
  // beams
  for (let x = 5; x <= 14; x += 3) B.box('ceilHouse', x * CS + 0.8, 2.95, 15 * CS, x * CS + 1.05, 3.2, 25 * CS, 1);
  for (let x = 17; x <= 26; x += 2) B.box('ceilBarn', x * CS + 0.85, 4.4, 4 * CS, x * CS + 1.15, 4.7, 11 * CS, 1);
  for (let z = 5; z <= 10; z += 3) B.box('ceilBarn', 17 * CS, 4.0, z * CS, 27 * CS, 4.25, z * CS + 0.3, 1);
  // roofs (gables)
  const gable = (x0, z0, x1, z1, y0, rise, keyRoof, keyEnd, along = 'x', oh = 0.7) => {
    const xa = x0 - oh, xb = x1 + oh, za = z0 - oh, zb = z1 + oh;
    if (along === 'x') {
      const zm = (z0 + z1) / 2, yr = y0 + rise;
      B.quad(keyRoof, [xa, y0, za], [xa, yr, zm], [xb, yr, zm], [xb, y0, za], 3); B.quad(keyRoof, [xb, y0, zb], [xb, yr, zm], [xa, yr, zm], [xa, y0, zb], 3);
      B.quad(keyRoof, [xa, y0 - 0.15, za], [xb, y0 - 0.15, za], [xb, yr - 0.15, zm], [xa, yr - 0.15, zm], 3);
      B.quad(keyRoof, [xb, y0 - 0.15, zb], [xa, y0 - 0.15, zb], [xa, yr - 0.15, zm], [xb, yr - 0.15, zm], 3);
      // gable triangles
      for (const xx of [x0, x1]) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xx === x0 ? [xx, y0, z0, xx, y0, z1, xx, yr, zm] : [xx, y0, z1, xx, y0, z0, xx, yr, zm]), 3)); gg.computeVertexNormals(); B.add(keyEnd, gg, 2); }
    }
  };
  gable(4 * CS, 14 * CS, 16 * CS, 26 * CS, 3.2, 3.4, 'roof', 'houseOut');
  gable(16 * CS, 3 * CS, 28 * CS, 12 * CS, 5.2, 4.2, 'roofBarn', 'barnOut');
  gable(16 * CS, 25 * CS, 25 * CS, 32 * CS, 3.0, 1.4, 'roofBarn', 'shedOut');
  // chimney
  B.box('stone', 13 * CS + 0.4, 3.2, 16 * CS + 0.3, 13 * CS + 1.4, 7.6, 16 * CS + 1.3, 1);

  // ---- props (blocking cells) ----
  const P = (key, x0, y0, z0, x1, y1, z1, t = 1) => B.box(key, x0, y0, z0, x1, y1, z1, t);
  dyn.smokeAt = [];
  for (const [cx, cy, type] of MP.PROPS) {
    const x = cx * CS, z = cy * CS, mx = x + 1, mz = z + 1;
    if (type === 'stove') { P('iron', x + 0.25, 0, z + 0.3, x + 1.75, 0.95, z + 1.5); P('iron', x + 0.2, 0.95, z + 0.25, x + 1.8, 1.02, z + 1.55); P('iron', mx - 0.12, 1.02, z + 0.4, mx + 0.12, 3.2, z + 0.64); dyn.stove = [mx, 0.6, z + 1.52]; }
    if (type === 'table') { P('board', x + 0.1, 0.78, z + 0.3, x + 1.9, 0.86, z + 1.7, 1); for (const [a, b] of [[0.2, 0.4], [1.75, 0.4], [0.2, 1.55], [1.75, 1.55]]) P('board', x + a, 0, z + b, x + a + 0.08, 0.78, z + b + 0.08); P('board', x - 0.3, 0, z + 0.7, x + 0.15, 0.48, z + 1.15); P('board', x - 0.3, 0.48, z + 0.7, x - 0.22, 1.05, z + 1.15); }
    if (type === 'couch') { P('cloth', x + 0.1, 0, z + 0.4, x + 1.9, 0.45, z + 1.5); P('cloth', x + 0.1, 0.45, z + 1.2, x + 1.9, 1.0, z + 1.55); P('cloth', x + 0.05, 0, z + 0.4, x + 0.3, 0.7, z + 1.55); P('cloth', x + 1.7, 0, z + 0.4, x + 1.95, 0.7, z + 1.55); }
    if (type === 'hay') { for (const [a, b, c] of [[0.1, 0.1, 0], [1.0, 0.2, 0], [0.4, 0.9, 0], [0.5, 0.5, 0.55]]) P('hay', x + a, c, z + b, x + a + 0.9, c + 0.55, z + b + 1.0, 1); }
    if (type === 'tractor') { P('rust', x + 0.1, 0.4, z + 0.3, x + 1.9, 1.3, z + 1.7, 2); P('rust', x + 0.4, 1.3, z + 0.5, x + 1.2, 2.2, z + 1.5); P('iron', x + 1.3, 1.3, z + 0.9, x + 1.42, 2.4, z + 1.02); for (const [a, b, r] of [[0.15, 0.1, 0.62], [0.15, 1.9, 0.62], [1.7, 0.2, 0.38], [1.7, 1.8, 0.38]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 16), mats.iron); wh.rotation.x = Math.PI / 2; wh.position.set(x + a + 0.1, r, z + b); scene.add(wh); } }
    if (type === 'well') { const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.9, 20, 1, true), mats.stone); ring.position.set(mx, 0.45, mz); ring.material.side = THREE.DoubleSide; scene.add(ring); const hole = new THREE.Mesh(new THREE.CircleGeometry(0.82, 20), new THREE.MeshBasicMaterial({ color: 0x020202 })); hole.rotation.x = -Math.PI / 2; hole.position.set(mx, 0.5, mz); scene.add(hole); P('board', mx - 0.9, 0.9, mz - 0.06, mx - 0.78, 2.4, mz + 0.06); P('board', mx + 0.78, 0.9, mz - 0.06, mx + 0.9, 2.4, mz + 0.06); P('roof', mx - 1.05, 2.4, mz - 0.7, mx + 1.05, 2.5, mz + 0.7); }
    if (type === 'truck') { P('rust', x - 0.6, 0.45, z + 0.25, x + 2.6, 1.05, z + 1.75, 2); P('rust', x + 1.2, 1.05, z + 0.3, x + 2.4, 1.85, z + 1.7, 2); P('window', x + 1.18, 1.25, z + 0.4, x + 1.21, 1.75, z + 1.6); for (const [a, b] of [[-0.2, 0.2], [-0.2, 1.8], [2.1, 0.2], [2.1, 1.8]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 16), mats.iron); wh.rotation.x = Math.PI / 2; wh.position.set(x + a, 0.42, z + b); scene.add(wh); } dyn.truckLight = [x + 2.62, 0.85, z + 0.5]; }
    if (type === 'bench') { P('board', x + 0.1, 0.9, z + 0.3, x + 1.9, 0.98, z + 1.6); P('board', x + 0.15, 0, z + 0.35, x + 0.25, 0.9, z + 1.55); P('board', x + 1.75, 0, z + 0.35, x + 1.85, 0.9, z + 1.55); P('rust', x + 0.4, 0.98, z + 0.5, x + 0.9, 1.25, z + 0.9); }
    if (type === 'crates') { P('board', x + 0.1, 0, z + 0.1, x + 1.0, 0.9, z + 1.0); P('board', x + 1.0, 0, z + 0.6, x + 1.9, 0.9, z + 1.9); P('board', x + 0.4, 0.9, z + 0.4, x + 1.2, 1.7, z + 1.2); }
  }
  // decorative clutter (non-blocking, low)
  P('board', 10 * CS, 0, 24 * CS + 1.3, 10 * CS + 1.6, 0.5, 24 * CS + 1.9); // low cabinet
  P('stone', 5 * CS + 0.1, 0, 21 * CS, 5 * CS + 0.7, 1.4, 22 * CS + 1.0); // fireplace
  P('iron', 5 * CS + 0.65, 0.1, 21 * CS + 0.4, 5 * CS + 0.72, 0.9, 22 * CS + 0.6);
  // doors
  dyn.doors = MP.DOORS.map((d) => {
    const x0 = d.cx * CS, z0 = d.cy * CS, bld = buildingOf(d.cx, d.cy), h = d.id === 0 ? 3.2 : d.id === 1 ? 5.2 : 3.0;
    const along = g(d.cx, d.cy - 1) === K.WALL || g(d.cx, d.cy + 1) === K.WALL || g(d.cx, d.cy - 1) === K.FENCE ? 'z' : 'x';
    const top = d.id === 1 ? 3.4 : 2.4;
    // header above the door
    if (along === 'z') B.box(OUT[bld], x0 + 0.75, top, z0, x0 + 1.25, h, z0 + CS, 2); else B.box(OUT[bld], x0, top, z0 + 0.75, x0 + CS, h, z0 + 1.25, 2);
    const grp = new THREE.Group(); grp.position.set(x0 + 1, 0, z0 + 1); if (along === 'z') grp.rotation.y = Math.PI / 2; scene.add(grp);
    const dm = d.id === 1 ? mats.barnOut : d.id === 2 ? mats.shedOut : mats.board;
    const leafs = [];
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.99, top - 0.02, 0.12), dm); leaf.position.set(s * 0.5, top / 2, 0); leaf.castShadow = shadows; grp.add(leaf); leafs.push(leaf);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.12, Math.hypot(0.9, top - 0.3), 0.05), mats.trim); brace.position.set(0, 0, 0.08); brace.rotation.z = s * Math.atan2(0.9, top - 0.3); leaf.add(brace);
      const brace2 = brace.clone(); brace2.position.z = -0.08; leaf.add(brace2);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: tex(labelTex([{ t: d.label.toUpperCase(), s: 26, c: '#f2ead0', y: 40 }, { t: d.cost + ' pts', s: 44, c: '#ffd36a', y: 92 }], { w: 256, h: 128, chalk: true }), [1, 1]), transparent: true, depthWrite: false }));
    sign.position.set(0, 1.55, 0.1); grp.add(sign); const sign2 = sign.clone(); sign2.position.z = -0.1; sign2.rotation.y = Math.PI; grp.add(sign2);
    return { d, grp, leafs, along, open: 0, opening: false };
  });

  // ---- machines ----
  dyn.perks = MP.PERKS.map((p) => {
    const info = PERK_INFO[p.id]; const x = (p.cx + 0.5) * CS, z = (p.cy + 0.5) * CS;
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(p.face[0], p.face[1]); scene.add(grp);
    const front = new THREE.MeshStandardMaterial({ map: tex(perkFront(info.name, info.sub, info.col)), emissiveMap: tex(perkGlow(info.name, info.sub, info.col)), emissive: 0xffffff, emissiveIntensity: p.power ? 0.05 : 1.6, roughness: 0.5, metalness: 0.3 });
    const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(info.col).multiplyScalar(0.35), roughness: 0.45, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.8), [side, side, side, side, front, side]); body.position.y = 1.05; body.castShadow = shadows; grp.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.9), mats.iron); cap.position.y = 2.18; grp.add(cap);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(info.col), emissiveIntensity: p.power ? 0 : 3 })); bulb.position.set(0, 2.32, 0.2); grp.add(bulb);
    return { p, info, grp, front, bulb, x, z, fx: x + p.face[0] * 1.5, fz: z + p.face[1] * 1.5 };
  });
  // mystery box: one mesh moved between spots
  const boxGrp = new THREE.Group(); scene.add(boxGrp);
  const crateMat = stdMat(tex(planks('#6e4a2a', 21, false, 0.6), [1, 1]));
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.8), crateMat); crate.position.y = 0.35; crate.castShadow = shadows; boxGrp.add(crate);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.7, -0.4); boxGrp.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.1, 0.82), crateMat); lid.position.set(0, 0.05, 0.41); lidPivot.add(lid);
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshBasicMaterial({ map: tex(labelTex([{ t: '?', s: 96, c: '#8dff6a', glow: '#3cff2a', y: 64 }], { w: 256, h: 128 })), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  mark.position.set(0, 0.36, 0.41); boxGrp.add(mark); const mark2 = mark.clone(); mark2.position.z = -0.41; mark2.rotation.y = Math.PI; boxGrp.add(mark2);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x66ff55, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 30, 16, 1, true), beamMat); beam.position.y = 18.6; boxGrp.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(star4()), color: 0x5dff4a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.35 })); halo.scale.set(2.2, 2.2, 1); halo.position.y = 1.1; boxGrp.add(halo);
  const boxLight = new THREE.PointLight(0x6dff5a, 3, 6, 1.8); boxLight.position.set(0, 1.2, 0); boxGrp.add(boxLight);
  const boxGun = new THREE.Group(); boxGun.position.set(0, 0.8, 0); boxGrp.add(boxGun);
  dyn.box = { grp: boxGrp, lidPivot, beam, gun: boxGun, light: boxLight };
  // forge (pack-a-punch)
  {
    const f = MP.FORGE, x = (f.cx + 0.5) * CS, z = (f.cy + 0.5) * CS; const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(f.face[0], f.face[1]); scene.add(grp);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.2, 1.3), mats.stone); base.position.y = 0.6; grp.add(base);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshStandardMaterial({ color: 0x110500, emissive: 0xff5a10, emissiveIntensity: 0.15 })); mouth.position.set(0, 0.55, 0.66); grp.add(mouth);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.8, 0.9, 4), mats.iron); hood.rotation.y = Math.PI / 4; hood.position.y = 1.65; grp.add(hood);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 10), mats.iron); pipe.position.y = 3.3; grp.add(pipe);
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.3), mats.iron); anvil.position.set(0, 1.35, 0.5); grp.add(anvil);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: tex(labelTex([{ t: 'CLOVER FORGE', s: 40, c: '#ffcf6a', glow: '#ff7a1a', y: 64 }], { w: 512, h: 128 })), transparent: true, depthWrite: false })); sign.position.set(0, 2.25, 0.35); grp.add(sign);
    const fl = new THREE.PointLight(0xff6a1a, 0, 6, 1.6); fl.position.set(0, 0.9, 1.0); grp.add(fl);
    dyn.forge = { grp, mouth, light: fl, x, z, fx: x + f.face[0] * 1.6, fz: z + f.face[1] * 1.6, gun: new THREE.Group() }; dyn.forge.gun.position.set(0, 1.6, 0.6); grp.add(dyn.forge.gun);
  }
  // power switch
  {
    const p = MP.POWER, wx = p.w[0], wy = p.w[1], fx = p.f[0], fy = p.f[1];
    const x = (fx + 0.5) * CS + (wx - fx) * 0.96, z = (fy + 0.5) * CS + (wy - fy) * 0.96;
    const grp = new THREE.Group(); grp.position.set(x, 1.4, z); grp.rotation.y = Math.atan2(fx - wx, fy - wy); scene.add(grp);
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.18), mats.rust));
    const lever = new THREE.Group(); lever.position.set(0, 0, 0.12); grp.add(lever); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), mats.iron); arm.position.y = 0.25; lever.add(arm); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0xaa1010, roughness: 0.4 })); knob.position.y = 0.5; lever.add(knob); lever.rotation.x = -0.9;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 2 })); lamp.position.set(0.25, 0.32, 0.1); grp.add(lamp);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: tex(labelTex([{ t: 'POWER', s: 60, c: '#f2ead0', y: 64 }], { w: 512, h: 128, chalk: true })), transparent: true })); sign.position.set(0, 0.6, 0.1); grp.add(sign);
    dyn.power = { grp, lever, lamp, x: (fx + 0.5) * CS, z: (fy + 0.5) * CS };
  }
  // wall-buys: gun hung on the wall + chalk tag
  dyn.wallbuys = MP.WALLBUYS.map((wb) => {
    const [wx, wy] = wb.w, [fx, fy] = wb.f; const nx = fx - wx, ny = fy - wy;
    const x = (fx + 0.5) * CS - nx * 0.98, z = (fy + 0.5) * CS - ny * 0.98;
    const grp = new THREE.Group(); grp.position.set(x, 1.45, z); grp.rotation.y = Math.atan2(nx, ny); scene.add(grp);
    const model = buildGun(wb.gun).g; model.rotation.y = Math.PI / 2; model.position.set(0.15, 0, 0.08); model.scale.setScalar(1.25); grp.add(model);
    const nm = wb.gun === 'grenades' ? 'FRAG GRENADES' : GUNS[wb.gun].name.toUpperCase();
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.33), new THREE.MeshBasicMaterial({ map: tex(labelTex([{ t: nm, s: 34, c: '#f4eeda', y: 40 }, { t: String(wb.cost), s: 40, c: '#ffd36a', y: 92 }], { w: 512, h: 128, chalk: true })), transparent: true, depthWrite: false }));
    tag.position.set(0, -0.32, 0.02); grp.add(tag);
    // chalk outline glow plate
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95), new THREE.MeshBasicMaterial({ color: 0xf4eeda, transparent: true, opacity: 0.06, depthWrite: false })); plate.position.set(0, -0.05, 0.01); grp.add(plate);
    return { wb, grp, fx: (fx + 0.5) * CS, fz: (fy + 0.5) * CS, x, z };
  });

  // ---- lights (fixed set; intensity animates) ----
  dyn.lamps = [];
  const lamp = (x, y, z, col, I, dist, powered, hang = true) => {
    const l = new THREE.PointLight(col, I, dist, 1.5); l.position.set(x, y, z); scene.add(l);
    const bulbM = new THREE.MeshStandardMaterial({ color: 0x221a10, emissive: col, emissiveIntensity: 2.4 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bulbM); bulb.position.set(x, y + 0.1, z); scene.add(bulb);
    if (hang) { const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4), mats.iron); cord.position.set(x, y + 0.45, z); scene.add(cord); const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 14, 1, true), mats.iron); shade.position.set(x, y + 0.2, z); shade.material.side = THREE.DoubleSide; scene.add(shade); }
    dyn.lamps.push({ l, bulbM, I, powered, ph: Math.random() * 10 });
  };
  lamp(10 * CS, 2.5, 17 * CS, 0xffb060, 14, 14, false);
  lamp(9 * CS, 2.5, 22 * CS, 0xffa050, 15, 16, false);
  lamp(21 * CS + 1, 4.4, 7 * CS + 1, 0xffc070, 14, 18, true);
  lamp(20 * CS + 1, 2.4, 28 * CS + 1, 0xfff0d0, 10, 12, true);
  // yard pole light
  B.box('board', 21 * CS + 0.9, 0, 18 * CS + 0.9, 21 * CS + 1.1, 5.3, 18 * CS + 1.1, 1);
  lamp(21 * CS + 1, 5.0, 18 * CS + 1, 0xffa040, 22, 24, true, false);

  const meshes = B.flush(scene, mats, shadows);
  dyn.mats = mats; dyn.static = meshes;
  // ---- corn field (instanced crossed quads, sways in the wind) ----
  dyn.corn = buildCorn(scene);
  dyn.scarecrows = [];
  for (const [x, z, r] of [[-6, 30, 0.4], [70, 12, -0.6], [40, 80, 2], [6, 74, 1], [64, 66, 2.5]]) dyn.scarecrows.push(scarecrow(scene, mats, x, z, r));
  return dyn;
}

function buildCorn(scene) {
  const mats = [0, 1].map((s) => new THREE.MeshStandardMaterial({ map: tex(cornStalk(s), [1, 1]), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: 0x9a9a8a }));
  const geo = new THREE.PlaneGeometry(1.4, 2.9); geo.translate(0, 1.45, 0);
  const g2 = geo.clone(); g2.rotateY(Math.PI / 2); const cross = mergeGeometries([geo, g2]);
  const spots = [[], []];
  const free = (cx, cy) => { if (cx < 0 || cy < 0 || cx >= W || cy >= H) return true; return MP.grid[cy * W + cx] === K.X; };
  const nearWalk = (cx, cy) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const x = cx + a, y = cy + b; if (x < 0 || y < 0 || x >= W || y >= H) continue; const k = MP.grid[y * W + x]; if (k === K.WALL || k === K.WIN) return true; } return false; };
  for (let cy = -14; cy < H + 14; cy++) for (let cx = -14; cx < W + 14; cx++) {
    if (!free(cx, cy)) continue;
    const near = nearWalk(cx, cy);
    for (let k = 0; k < (near ? 1 : 3); k++) {
      const x = (cx + Math.random()) * CS, z = (cy + Math.random()) * CS;
      // keep clear of building footprints / roofs overhang
      if (near && Math.random() < 0.5) continue;
      spots[Math.random() < 0.5 ? 0 : 1].push([x, z, rnd(0.8, 1.25), Math.random() * 6]);
    }
  }
  const out = [];
  const shaderHook = (sh) => {
    sh.uniforms.uTime = { value: 0 }; out.uni = out.uni || []; out.uni.push(sh.uniforms.uTime);
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
      float sway = sin(uTime*1.3 + wp.x*0.21 + wp.z*0.17) * 0.18 + sin(uTime*2.9 + wp.x*0.5) * 0.05;
      transformed.x += sway * (position.y / 2.9) * (position.y / 2.9);`);
  };
  spots.forEach((list, i) => {
    mats[i].onBeforeCompile = shaderHook;
    const im = new THREE.InstancedMesh(cross, mats[i], list.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    list.forEach(([x, z, s, r], j) => { m.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(e.set(0, r, (Math.random() - 0.5) * 0.12)), new THREE.Vector3(s, s * rnd(0.85, 1.15), s)); im.setMatrixAt(j, m); });
    im.receiveShadow = true; scene.add(im); out.push(im);
  });
  return out;
}

function scarecrow(scene, mats, x, z, r) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r; scene.add(g);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.14), mats.board); post.position.y = 1.7; g.add(post);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), mats.board); bar.position.y = 2.6; g.add(bar);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.9, 8), mats.cloth); body.position.y = 2.3; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), mats.hay); head.position.y = 3.0; g.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 0.25, 12), mats.hay); hat.position.y = 3.25; g.add(hat);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xff8a20 }); for (const s of [-0.08, 0.08]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), eyeM); e.position.set(s, 3.03, 0.23); g.add(e); }
  return g;
}

// sky dome, stars, moon
export function buildSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x03060e) }, hor: { value: new THREE.Color(0x1a2a3a) }, glow: { value: new THREE.Color(0x3a5a6a) }, moonDir: { value: new THREE.Vector3(-0.5, 0.45, -0.75).normalize() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, hor, glow, moonDir; varying vec3 vP;
      void main(){ float h = clamp(vP.y, -0.2, 1.0); vec3 c = mix(hor, top, pow(max(h,0.0), 0.45));
        float m = max(dot(normalize(vP), moonDir), 0.0); c += glow * pow(m, 8.0) * 0.6;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat); sky.renderOrder = -2; scene.add(sky);
  const n = 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, y = 0.08 + Math.random() * 0.92, r = Math.sqrt(1 - y * y); pos[i * 3] = Math.cos(a) * r * 480; pos[i * 3 + 1] = y * 480; pos[i * 3 + 2] = Math.sin(a) * r * 480; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfd0ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })); stars.renderOrder = -1; scene.add(stars);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(moonTex()), fog: false, depthWrite: false, transparent: true, color: 0xffffff }));
  moon.scale.set(110, 110, 1); moon.position.copy(skyMat.uniforms.moonDir.value).multiplyScalar(450); moon.renderOrder = -1; scene.add(moon);
  return { sky, stars, moon };
}
