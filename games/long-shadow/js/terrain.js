// LONG SHADOW - analytic terrain, vegetation and sky. Everything procedural.
import * as THREE from 'three';
import { canvas, rng, toTex, fbmFill, leaves, bark } from './textures.js';

// ---------- noise ----------
const PERM = new Uint8Array(512);
{ const R = rng(7331); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function grad(h, x, y) { const u = (h & 1) ? x : -x, v = (h & 2) ? y : -y; return (h & 4) ? u + v * 0.5 : u * 0.5 + v; }
export function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y), a = PERM[X] + Y, b = PERM[X + 1] + Y;
  const l = (p, q, t) => p + (q - p) * t;
  return l(l(grad(PERM[a], x, y), grad(PERM[b], x - 1, y), u), l(grad(PERM[a + 1], x, y - 1), grad(PERM[b + 1], x - 1, y - 1), u), v);
}
export function fbm(x, y, oct = 4) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- layout constants ----------
export const RIDGE_Z = (x) => -128 + 9 * Math.sin(x * 0.013) + 5 * Math.sin(x * 0.034 + 1.3);
export const PLAY = { x0: -150, x1: 150, z0: -168, z1: -98 }; // player walkable box (plus slope limit)
export const FLAT = { x0: -125, x1: 125, z0: -30, z1: 125 }; // flat valley floor (compound)

// analytic height, metres
export function heightFn(x, z) {
  const rz = RIDGE_Z(x), d = z - rz;
  let h;
  if (d >= 0) {
    // front face: crest ~38m falling to the valley over ~95m with a couple of shelves
    const t = d / 95;
    h = 38 * (1 - ss(0, 1, t)) + 3.5 * Math.sin(t * 9.4) * (1 - t) * (t < 1 ? 1 : 0);
    h = Math.max(h, 0);
  } else {
    // back side: dips then climbs to the far northern range
    const b = -d;
    h = 38 - 14 * ss(0, 60, b) + 120 * ss(70, 360, b);
  }
  // crest bumps and ledges
  const ridgeMask = Math.exp(-((d - 5) * (d - 5)) / (2 * 40 * 40));
  h += ridgeMask * (fbm(x * 0.018, z * 0.018, 4) * 9 + 3);
  // southern mountains (backdrop beyond the compound)
  h += 175 * ss(150, 420, z) * (0.75 + 0.45 * fbm(x * 0.006 + 3, z * 0.006, 4));
  // east/west hills
  const ax = Math.abs(x);
  h += 95 * ss(150, 430, ax) * (0.7 + 0.5 * fbm(x * 0.007, z * 0.007 + 8, 4)) * ss(-60, 40, z + 40);
  // general roughness, killed inside the flat valley
  const fx = ss(FLAT.x0 - 30, FLAT.x0, x) * (1 - ss(FLAT.x1, FLAT.x1 + 30, x));
  const fz = ss(FLAT.z0 - 25, FLAT.z0, z) * (1 - ss(FLAT.z1, FLAT.z1 + 30, z));
  const flat = fx * fz;
  h += (1 - flat) * (fbm(x * 0.035 + 11, z * 0.035, 3) * 2.2 + fbm(x * 0.004, z * 0.004, 3) * 14 * ss(-60, -200, z));
  h = h * (1 - flat) + flat * (fbm(x * 0.02, z * 0.02, 2) * 0.12);
  return h;
}

// ---------- grid ----------
function axis(segs) { const out = []; for (const [a, b, s] of segs) { for (let v = a; v < b - 1e-6; v += s) out.push(v); } out.push(segs[segs.length - 1][1]); return out; }
const XS = axis([[-600, -180, 10], [-180, 180, 1.5], [180, 600, 10]]);
const ZS = axis([[-560, -200, 10], [-200, -82, 1.5], [-82, 140, 3], [140, 560, 10]]);
const NX = XS.length, NZ = ZS.length;
const HG = new Float32Array(NX * NZ);
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) HG[j * NX + i] = heightFn(XS[i], ZS[j]);
function find(arr, v) { let lo = 0, hi = arr.length - 2; if (v <= arr[0]) return 0; if (v >= arr[hi + 1]) return hi; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; }

// exact height of the rendered mesh (same triangle split as the index buffer)
export function groundH(x, z) {
  const i = find(XS, x), j = find(ZS, z);
  const x0 = XS[i], x1 = XS[i + 1], z0 = ZS[j], z1 = ZS[j + 1];
  const u = Math.max(0, Math.min(1, (x - x0) / (x1 - x0))), v = Math.max(0, Math.min(1, (z - z0) / (z1 - z0)));
  const a = HG[j * NX + i], b = HG[j * NX + i + 1], c = HG[(j + 1) * NX + i], d = HG[(j + 1) * NX + i + 1];
  // triangles: (a,c,b) when u+v<=1, else (b,c,d)
  if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
  return d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
export function groundN(x, z, out) { const e = 0.6; const hx = groundH(x + e, z) - groundH(x - e, z), hz = groundH(x, z + e) - groundH(x, z - e); return out.set(-hx, 2 * e, -hz).normalize(); }

// ---------- textures ----------
function detailTex() {
  const R = rng(55), [c, x] = canvas(512, 512);
  fbmFill(x, 512, 512, R, [128, 128, 128], [60, 60, 60], [96, 32, 10]);
  const d = x.getImageData(0, 0, 512, 512); const p = d.data;
  for (let k = 0; k < p.length; k += 4) { const n = (R() - 0.5) * 34; p[k] = p[k + 1] = p[k + 2] = Math.max(0, Math.min(255, (p[k] + p[k + 1] + p[k + 2]) / 3 + n)); }
  x.putImageData(d, 0, 0);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},0.06)`; x.fillRect(R() * 512, R() * 512, 1 + R() * 3, 1 + R() * 3); }
  // re-greyscale
  const d2 = x.getImageData(0, 0, 512, 512), q = d2.data; for (let k = 0; k < q.length; k += 4) { const g = (q[k] + q[k + 1] + q[k + 2]) / 3 * 0.55 + 115; q[k] = q[k + 1] = q[k + 2] = g; } x.putImageData(d2, 0, 0);
  return toTex(c, [1, 1], false);
}
function grassCard() {
  const R = rng(91), [c, x] = canvas(128, 128);
  x.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 46; i++) {
    const bx = 8 + R() * 112, h = 50 + R() * 74, lean = (R() - 0.5) * 34, w = 2 + R() * 3.5;
    const g = x.createLinearGradient(0, 128, 0, 128 - h);
    const l = 0.75 + R() * 0.5; g.addColorStop(0, `rgb(${70 * l | 0},${78 * l | 0},${38 * l | 0})`); g.addColorStop(1, `rgb(${178 * l | 0},${168 * l | 0},${98 * l | 0})`);
    x.fillStyle = g; x.beginPath(); x.moveTo(bx - w, 128); x.quadraticCurveTo(bx + lean * 0.3, 128 - h * 0.6, bx + lean, 128 - h); x.quadraticCurveTo(bx + lean * 0.3 + 1, 128 - h * 0.6, bx + w, 128); x.fill();
  }
  const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
function needleTex() {
  const R = rng(17), [c, x] = canvas(256, 256);
  x.fillStyle = '#1d2b1a'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) { const px = R() * 256, py = R() * 256, a = (R() - 0.5) * 0.9 + Math.PI / 2, l = 5 + R() * 9; const k = 0.6 + R() * 0.9; x.strokeStyle = `rgba(${40 * k | 0},${70 * k | 0},${40 * k | 0},0.8)`; x.lineWidth = 1 + R(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  return toTex(c, [2, 2]);
}
function rockTex() {
  const R = rng(23), [c, x] = canvas(256, 256);
  fbmFill(x, 256, 256, R, [112, 108, 100], [46, 46, 46], [48, 16, 5]);
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(20,18,16,${0.15 + R() * 0.25})`; x.lineWidth = 1 + R() * 1.5; x.beginPath(); let px = R() * 256, py = R() * 256; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 40; py += (R() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); }
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${120 + R() * 50},${130 + R() * 40},${70},0.25)`; x.beginPath(); x.ellipse(R() * 256, R() * 256, 4 + R() * 12, 3 + R() * 8, R() * 3, 0, 7); x.fill(); }
  return toTex(c, [1, 1]);
}

// ---------- terrain mesh ----------
export function buildTerrain(scene, pal, Q) {
  const pos = new Float32Array(NX * NZ * 3), col = new Float32Array(NX * NZ * 3), uv = new Float32Array(NX * NZ * 2);
  const nrm = new THREE.Vector3(), cG = new THREE.Color(pal.grass), cG2 = new THREE.Color(pal.grass2), cR = new THREE.Color(pal.rock), cD = new THREE.Color(pal.dirt), cS = new THREE.Color(pal.snow), c = new THREE.Color();
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, x = XS[i], z = ZS[j], y = HG[k];
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / 7; uv[k * 2 + 1] = z / 7;
    groundN(x, z, nrm);
    const n1 = fbm(x * 0.03, z * 0.03, 3) * 0.5 + 0.5, n2 = fbm(x * 0.11 + 5, z * 0.11, 2);
    c.copy(cG).lerp(cG2, Math.max(0, Math.min(1, n1 * 1.3 - 0.1)));
    const steep = ss(0.9, 0.7, nrm.y); c.lerp(cR, steep);
    const inFlat = x > FLAT.x0 - 8 && x < FLAT.x1 + 8 && z > FLAT.z0 - 6 && z < FLAT.z1 + 8;
    if (inFlat) c.lerp(cD, 0.75 + n2 * 0.2);
    if (y > 110) c.lerp(cS, ss(110, 170, y + n2 * 25) * ss(0.55, 0.85, nrm.y));
    const v = 0.88 + n2 * 0.16; col[k * 3] = c.r * v; col[k * 3 + 1] = c.g * v; col[k * 3 + 2] = c.b * v;
  }
  const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6); let p = 0;
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = j * NX + i, b = a + 1, cc = a + NX, d = cc + 1;
    idx[p++] = a; idx[p++] = cc; idx[p++] = b; idx[p++] = b; idx[p++] = cc; idx[p++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTex(), roughness: 0.96, metalness: 0 });
  mat.map.colorSpace = THREE.NoColorSpace;
  const m = new THREE.Mesh(g, mat); m.receiveShadow = Q.shadows; scene.add(m);
  return m;
}

// ---------- vegetation ----------
const scatterR = rng(4242);
function inPlayerBand(x, z) { const d = z - RIDGE_Z(x); return d > -34 && d < 34; }
export function buildVegetation(scene, pal, Q) {
  const out = { bushes: [], trees: [], rocks: [], grass: null, windU: { value: 0 }, clearU: { value: new THREE.Vector3(0, 0.001, 0) }, laneU: { value: new THREE.Vector4(0, 1, 0, 1) } };
  const R = rng(4242);
  const dummy = new THREE.Object3D(); const nrm = new THREE.Vector3();
  // ---- pines ----
  const trunkG = new THREE.CylinderGeometry(0.12, 0.28, 1, 7).translate(0, 0.5, 0);
  const coneGs = [];
  for (let k = 0; k < 4; k++) { const r = 2.3 - k * 0.48, h = 3.2 - k * 0.3; const cg = new THREE.ConeGeometry(r, h, 9, 2).translate(0, 2.2 + k * 1.75 + h / 2, 0); coneGs.push(cg); }
  const foliageG = mergeGeos(coneGs);
  jitterGeo(foliageG, 0.22, R);
  const trunkM = new THREE.MeshStandardMaterial({ map: toTex(bark(), [1, 3]), roughness: 0.95, color: 0x8a7a68 });
  const folM = new THREE.MeshStandardMaterial({ map: needleTex(), roughness: 0.9, color: new THREE.Color(pal.pine), flatShading: true });
  const treeSpots = [];
  // ridge band: sparse on the front slope, denser behind the crest; plus far hillsides
  for (let n = 0; n < 2600 && treeSpots.length < 900; n++) {
    const x = -420 + R() * 840, z = -420 + R() * 380 + (R() < 0.35 ? 0 : 0);
    const d = z - RIDGE_Z(x);
    if (x > FLAT.x0 - 20 && x < FLAT.x1 + 20 && z > FLAT.z0 - 30 && z < FLAT.z1 + 20) continue;
    let keep = 0.5;
    if (d > 0 && d < 80) keep = 0.06 + 0.05 * (fbm(x * 0.02, z * 0.02) > 0.15 ? 1 : 0);
    else if (d <= 0 && d > -40) keep = 0.6;
    if (R() > keep) continue;
    const y = groundH(x, z); groundN(x, z, nrm); if (nrm.y < 0.72) continue;
    treeSpots.push([x, y, z, 0.75 + R() * 0.75, R() * 6.28]);
  }
  // southern / eastern / western forest belts for the backdrop
  for (let n = 0; n < 1800; n++) {
    const x = -450 + R() * 900, z = 135 + R() * 190;
    const y = groundH(x, z); if (y > 120) continue; groundN(x, z, nrm); if (nrm.y < 0.75 || R() < 0.35) continue;
    treeSpots.push([x, y, z, 0.9 + R() * 0.9, R() * 6.28]);
  }
  for (let n = 0; n < 900; n++) {
    const s = R() < 0.5 ? -1 : 1, x = s * (140 + R() * 220), z = -70 + R() * 220;
    const y = groundH(x, z); groundN(x, z, nrm); if (nrm.y < 0.75 || R() < 0.3) continue;
    treeSpots.push([x, y, z, 0.9 + R() * 0.8, R() * 6.28]);
  }
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, treeSpots.length), fol = new THREE.InstancedMesh(foliageG, folM, treeSpots.length);
  const tc = new THREE.Color();
  treeSpots.forEach(([x, y, z, s, r], i) => {
    dummy.position.set(x, y - 0.2, z); dummy.rotation.set(0, r, 0); dummy.scale.set(s, s * 3.2, s); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    dummy.scale.set(s, s * (0.9 + R() * 0.35), s); dummy.updateMatrix(); fol.setMatrixAt(i, dummy.matrix);
    tc.setHSL(0.27 + R() * 0.06, 0.25 + R() * 0.2, 0.55 + R() * 0.35); fol.setColorAt(i, tc);
    out.trees.push({ x, z, r: 0.35 * s, top: y + 9.5 * s, base: y, can: 2.2 * s });
  });
  trunks.castShadow = fol.castShadow = Q.shadows; fol.receiveShadow = Q.shadows;
  scene.add(trunks, fol);
  // ---- bushes (concealment) ----
  const bushG = mergeGeos([0, 1, 2, 3, 4].map((k) => { const g = new THREE.IcosahedronGeometry(0.7 + (k % 3) * 0.18, 1); g.translate(Math.cos(k * 1.3) * 0.7, 0.5 + (k % 2) * 0.35, Math.sin(k * 1.3) * 0.7); return g; }));
  jitterGeo(bushG, 0.16, R);
  const bushM = new THREE.MeshStandardMaterial({ map: toTex(leaves(pal.bushHue), [2, 2]), roughness: 0.9, flatShading: true, color: new THREE.Color(pal.bush) });
  const bspots = [];
  for (let n = 0; n < 1600 && bspots.length < 300; n++) {
    const x = -150 + R() * 300, d = -26 + R() * 50; const z = RIDGE_Z(x) + d;
    if (z > PLAY.z1 + 4) continue;
    const y = groundH(x, z); groundN(x, z, nrm); if (nrm.y < 0.7) continue;
    if (d > 2 && R() < 0.15) continue;
    bspots.push([x, y, z, 0.8 + R() * 0.6]);
  }
  bushM.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vWPb;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWPb = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWPb;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      float cdist = length(vWPb - cameraPosition);
      if (cdist < 3.2) { vec2 q = floor(gl_FragCoord.xy); float dth = fract(sin(dot(q, vec2(12.9898,78.233))) * 43758.5453); if (dth > (cdist - 1.7) / 1.5) discard; }`);
  };
  const bushes = new THREE.InstancedMesh(bushG, bushM, bspots.length);
  bspots.forEach(([x, y, z, s], i) => { dummy.position.set(x, y - 0.15, z); dummy.rotation.set(0, R() * 6, 0); dummy.scale.set(s * 1.2, s, s * 1.2); dummy.updateMatrix(); bushes.setMatrixAt(i, dummy.matrix); tc.setHSL(0.2 + R() * 0.08, 0.3, 0.6 + R() * 0.35); bushes.setColorAt(i, tc); out.bushes.push({ x, z, y, r: 1.75 * s }); });
  bushes.castShadow = Q.shadows; scene.add(bushes);
  // ---- rocks ----
  const rockG = new THREE.DodecahedronGeometry(1, 1); jitterGeo(rockG, 0.22, R);
  const rockM = new THREE.MeshStandardMaterial({ map: rockTex(), roughness: 0.92, color: new THREE.Color(pal.rockTint) });
  const rspots = [];
  for (let n = 0; n < 900 && rspots.length < 220; n++) {
    const x = -160 + R() * 320, z = RIDGE_Z(x) - 30 + R() * 90; if (z > -60) continue;
    const y = groundH(x, z); rspots.push([x, y, z, 0.4 + Math.pow(R(), 3) * 2.6]);
  }
  const rocks = new THREE.InstancedMesh(rockG, rockM, rspots.length);
  rspots.forEach(([x, y, z, s], i) => { dummy.position.set(x, y + s * 0.15, z); dummy.rotation.set(R() * 6, R() * 6, R() * 6); dummy.scale.set(s * (1 + R() * 0.6), s * (0.6 + R() * 0.4), s * (1 + R() * 0.5)); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix); out.rocks.push({ x, z, y, r: s * 1.1, top: y + s * 0.8 }); });
  rocks.castShadow = rocks.receiveShadow = Q.shadows; scene.add(rocks);
  // ---- grass cards near the player band ----
  const gN = Q.grass;
  const cardG = new THREE.PlaneGeometry(1.1, 0.75).translate(0, 0.37, 0); const cg2 = cardG.clone().rotateY(Math.PI / 2); const cg3 = cardG.clone().rotateY(Math.PI / 4);
  const grassG = mergeGeos([cardG, cg2, cg3]);
  const grassM = new THREE.MeshStandardMaterial({ map: grassCard(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: new THREE.Color(pal.grassCard) });
  const windU = out.windU, clearU = out.clearU, laneU = out.laneU;
  grassM.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windU; sh.uniforms.uClear = clearU; sh.uniforms.uLane = laneU;
    sh.vertexShader = 'uniform float uWind; uniform vec3 uClear; uniform vec4 uLane;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
      float cd = length(wp.xz - uClear.xz); transformed *= smoothstep(uClear.y * 0.55, uClear.y, cd);
      vec2 rel = wp.xz - uClear.xz; float along = dot(rel, uLane.xy); float perp = abs(rel.x * uLane.y - rel.y * uLane.x);
      if (along > 0.0 && along < uLane.z) transformed *= smoothstep(0.4, 1.0, perp / max(0.01, uLane.w * (0.4 + along * 0.06)));
      float sway = sin(uWind*1.7 + wp.x*0.35 + wp.z*0.22) * 0.12 + sin(uWind*3.1 + wp.x*0.9) * 0.04;
      transformed.x += sway * position.y * 1.4; transformed.z += sway * position.y * 0.6;`);
    // light the cards from above so they read like the ground they sit on
    sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0,1.0,0.0);');
  };
  const grass = new THREE.InstancedMesh(grassG, grassM, gN); let gi = 0;
  for (let n = 0; n < gN * 4 && gi < gN; n++) {
    const x = -155 + R() * 310, z = RIDGE_Z(x) - 34 + R() * 64; if (!inPlayerBand(x, z) || z > PLAY.z1 + 10) continue;
    groundN(x, z, nrm); if (nrm.y < 0.74) continue;
    const y = groundH(x, z); const s = 0.6 + R() * 0.9;
    dummy.position.set(x, y - 0.04, z); dummy.rotation.set(0, R() * 6.28, 0); dummy.scale.set(s, s * (0.8 + R() * 0.7), s); dummy.updateMatrix(); grass.setMatrixAt(gi, dummy.matrix);
    tc.setHSL(0.13 + R() * 0.07, 0.35, 0.65 + R() * 0.4); grass.setColorAt(gi, tc); gi++;
  }
  grass.count = gi; grass.receiveShadow = false; scene.add(grass); out.grass = grass;
  return out;
}

export function mergeGeos(geos) {
  let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of geos) {
    const c = g.attributes.position.count; pos.set(g.attributes.position.array, ov * 3); nrm.set(g.attributes.normal.array, ov * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, ov * 2);
    if (g.index) { for (let k = 0; k < g.index.count; k++) idx[oi++] = g.index.array[k] + ov; } else { for (let k = 0; k < c; k++) idx[oi++] = ov + k; }
    ov += c;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
function jitterGeo(g, amt, R) {
  const p = g.attributes.position; const key = (i) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`; const off = {};
  for (let i = 0; i < p.count; i++) { const k = key(i); if (!off[k]) off[k] = [(R() - 0.5) * amt, (R() - 0.5) * amt, (R() - 0.5) * amt]; const o = off[k]; p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]); }
  g.computeVertexNormals();
}

// ---------- sky ----------
export function buildSky(scene, pal) {
  const u = { top: { value: new THREE.Color(pal.skyTop) }, hor: { value: new THREE.Color(pal.skyHor) }, sunC: { value: new THREE.Color(pal.sunColor) }, sunDir: { value: new THREE.Vector3(...pal.sunDir).normalize() }, sunSize: { value: pal.sunSize ?? 1 }, cloud: { value: pal.cloud ?? 0.5 }, stars: { value: pal.stars ? 1 : 0 }, t: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, hor, sunC, sunDir; uniform float sunSize, cloud, stars, t; varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fb(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
      void main(){ vec3 d = normalize(vD); float y = max(d.y, -0.1);
        vec3 c = mix(hor, top, pow(clamp(y,0.0,1.0), 0.55));
        float sd = max(dot(d, sunDir), 0.0);
        c += sunC * (pow(sd, 8.0) * 0.35 + pow(sd, 60.0) * 0.6) ;
        c += sunC * smoothstep(0.9993 - 0.0006*sunSize, 0.9997, sd) * 6.0;
        if (d.y > 0.0) { vec2 cp = d.xz / (d.y + 0.15) * 1.6 + vec2(t*0.004, 0.0);
          float cl = smoothstep(0.45, 0.85, fb(cp)) * cloud * smoothstep(0.0, 0.25, d.y);
          vec3 cc = mix(hor * 1.05, sunC * 1.2 + hor * 0.4, pow(sd, 4.0));
          c = mix(c, cc, cl * 0.8);
          if (stars > 0.5) { vec2 sp = d.xz / (d.y + 0.05) * 140.0; float s = step(0.9965, h(floor(sp))) * smoothstep(0.1, 0.4, d.y) * (1.0 - cl); c += vec3(s) * 0.9; }
        }
        c = mix(c, hor * 0.8, smoothstep(0.0, -0.1, d.y));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), m); s.renderOrder = -10; s.frustumCulled = false; scene.add(s);
  return u;
}
