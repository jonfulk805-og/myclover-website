// LONG SHADOW - assemble the scene for a contract
import * as THREE from 'three';
import { buildTerrain, buildVegetation, buildSky, groundH, RIDGE_Z } from './terrain.js';
import { buildCompound } from './compound.js';
import { REF } from './state.js';

export function clearScene(scene) {
  const keep = new Set([REF.camera]);
  for (const o of [...scene.children]) {
    if (keep.has(o)) continue; scene.remove(o);
    o.traverse?.((m) => { if (m.geometry) m.geometry.dispose(); });
  }
}

export function buildScene(scene, C, Q) {
  clearScene(scene);
  const pal = C.pal;
  scene.fog = new THREE.FogExp2(new THREE.Color(pal.fog), pal.fogD);
  scene.background = new THREE.Color(pal.skyHor);
  REF.skyU = buildSky(scene, pal);
  const sunDir = new THREE.Vector3(...pal.sunDir).normalize();
  const hemi = new THREE.HemisphereLight(new THREE.Color(pal.hemiSky), new THREE.Color(pal.hemiGround), pal.hemiI); scene.add(hemi);
  const sun = new THREE.DirectionalLight(new THREE.Color(pal.sunColor), pal.sunI);
  const focus = new THREE.Vector3(0, 0, 45);
  sun.position.copy(sunDir).multiplyScalar(260).add(focus); sun.target.position.copy(focus); scene.add(sun, sun.target);
  sun.castShadow = Q.shadows; sun.shadow.mapSize.set(Q.shadowRes, Q.shadowRes);
  const sc = sun.shadow.camera; sc.left = -125; sc.right = 125; sc.top = 125; sc.bottom = -125; sc.near = 20; sc.far = 600; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  REF.sun = sun; REF.hemi = hemi; REF.hemiBase = pal.hemiI; REF.sunDir = sunDir;
  REF.terrain = buildTerrain(scene, pal, Q);
  REF.veg = buildVegetation(scene, pal, Q);
  REF.comp = buildCompound(scene, pal, Q);
  REF.heli = REF.comp.heli; REF.heliHome = REF.heli.position.clone();
  // rain
  REF.rain = null;
  if (C.rain) {
    const n = Q.shadows ? 2600 : 1400, pos = new Float32Array(n * 6), seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { seed[i * 3] = Math.random() * 60 - 30; seed[i * 3 + 1] = Math.random() * 30; seed[i * 3 + 2] = Math.random() * 60 - 30; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb0c8, transparent: true, opacity: 0.35, depthWrite: false }));
    m.frustumCulled = false; scene.add(m); REF.rain = { m, pos, seed, n };
  }
  // searchlight
  REF.search = null;
  if (C.searchlight) {
    const s = C.searchlight; const L = new THREE.SpotLight(0xe8f0ff, 260, 420, 0.07, 0.4, 1.0); L.position.set(s.x, s.y, s.z); scene.add(L, L.target);
    const beamM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { k: { value: 1 } },
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float k; varying float vY; void main(){ float a = smoothstep(-1.0, 0.0, -vY) ; gl_FragColor = vec4(0.75,0.82,0.95, 0.05 * k * (1.0 - smoothstep(0.0, 1.0, -vY))); }' });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 14, 1, 24, 1, true).translate(0, -0.5, 0), beamM); scene.add(cone);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4) })); lamp.position.copy(L.position); scene.add(lamp);
    REF.search = { L, cone, aimX: 0, aimZ: RIDGE_Z(0), angle: 0.07 };
  }
  REF.groundH = groundH;
  return REF;
}

// per-frame world animation (rain, searchlight, heli rotor, beacon)
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
export function animateWorld(dt, t, cam, focus) {
  if (REF.veg) REF.veg.windU.value = t;
  if (REF.skyU) REF.skyU.t.value = t;
  const R = REF.rain;
  if (R) {
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    for (let i = 0; i < R.n; i++) {
      const s = R.seed; s[i * 3 + 1] -= dt * 22; if (s[i * 3 + 1] < -8) s[i * 3 + 1] += 34;
      const x = cx + s[i * 3], y = cy + s[i * 3 + 1], z = cz + s[i * 3 + 2];
      R.pos.set([x, y, z, x + 0.12, y + 0.9, z + 0.05], i * 6);
    }
    R.m.geometry.attributes.position.needsUpdate = true;
  }
  const S = REF.search;
  if (S) {
    let tx = S.aimX, tz = S.aimZ; if (!focus) { tx = -10 + Math.sin(t * 0.11) * 95 + Math.sin(t * 0.31) * 20; tz = RIDGE_Z(tx) + 6 + Math.sin(t * 0.23) * 10; }
    S.curX = S.curX == null ? tx : S.curX + (tx - S.curX) * Math.min(1, dt * (focus ? 1.2 : 2));
    S.curZ = S.curZ == null ? tz : S.curZ + (tz - S.curZ) * Math.min(1, dt * (focus ? 1.2 : 2));
    const ty = groundH(S.curX, S.curZ);
    S.L.target.position.set(S.curX, ty, S.curZ); S.L.target.updateMatrixWorld();
    const d = _v.set(S.curX, ty, S.curZ).sub(S.L.position); const len = d.length();
    S.cone.position.copy(S.L.position); _q.setFromUnitVectors(_up, d.clone().normalize().negate()); S.cone.quaternion.copy(_q);
    S.cone.scale.set(len * Math.tan(S.angle) / 14 * 1.0, len, len * Math.tan(S.angle) / 14);
    S.dir = d.normalize();
  }
  if (REF.heli?.userData.rotor) REF.heli.userData.rotor.rotation.y += dt * (REF.heliSpin || 0);
}
