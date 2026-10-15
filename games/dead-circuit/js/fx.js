// Particles, debris, flash lights, decals, shockwave rings.
import * as THREE from 'three';
import { T, softDot, smokePuff } from './textures.js';

const VS = `
attribute float size; attribute vec4 col; attribute float rot;
varying vec4 vCol; varying float vRot;
uniform float scale;
void main(){
  vCol = col; vRot = rot;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
uniform sampler2D map; varying vec4 vCol; varying float vRot;
void main(){
  vec2 p = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot);
  p = vec2(c*p.x - s*p.y, s*p.x + c*p.y) + 0.5;
  vec4 t = texture2D(map, p);
  gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a);
  if (gl_FragColor.a < 0.004) discard;
}`;

class ParticleSystem {
  constructor(scene, max, tex, additive) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 4); this.size = new Float32Array(max); this.rot = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max); this.spin = new Float32Array(max);
    this.base = new Float32Array(max * 3); this.fade = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aR = new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('col', this.aC); g.setAttribute('size', this.aS); g.setAttribute('rot', this.aR);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 600 } }, vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 5 : 4;
    scene.add(this.pts); this.geo = g;
  }
  // o: {x,y,z,vx,vy,vz,life,s0,s1,r,g,b,a,r2,g2,b2,drag,grav,spin}
  emit(o) {
    if (this.n >= this.max) return;
    const i = this.n++, i3 = i * 3, i4 = i * 4;
    this.p[i3] = o.x; this.p[i3 + 1] = o.y; this.p[i3 + 2] = o.z;
    this.v[i3] = o.vx || 0; this.v[i3 + 1] = o.vy || 0; this.v[i3 + 2] = o.vz || 0;
    this.life[i] = this.maxLife[i] = o.life || 1;
    this.s0[i] = o.s0 ?? 1; this.s1[i] = o.s1 ?? this.s0[i];
    this.base[i3] = o.r ?? 1; this.base[i3 + 1] = o.g ?? 1; this.base[i3 + 2] = o.b ?? 1;
    this.fade[i3] = o.r2 ?? this.base[i3]; this.fade[i3 + 1] = o.g2 ?? this.base[i3 + 1]; this.fade[i3 + 2] = o.b2 ?? this.base[i3 + 2];
    this.a0[i] = o.a ?? 1; this.drag[i] = o.drag ?? 0; this.grav[i] = o.grav ?? 0; this.spin[i] = o.spin ?? 0;
    this.rot[i] = Math.random() * 6.28; this.c[i4 + 3] = 0; this.size[i] = this.s0[i];
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const i3 = i * 3, i4 = i * 4, t = 1 - this.life[i] / this.maxLife[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i3] *= d; this.v[i3 + 1] = this.v[i3 + 1] * d - this.grav[i] * dt; this.v[i3 + 2] *= d;
      this.p[i3] += this.v[i3] * dt; this.p[i3 + 1] += this.v[i3 + 1] * dt; this.p[i3 + 2] += this.v[i3 + 2] * dt;
      if (this.p[i3 + 1] < 0.05 && this.grav[i] > 0) { this.p[i3 + 1] = 0.05; this.v[i3 + 1] *= -0.3; this.v[i3] *= 0.6; this.v[i3 + 2] *= 0.6; }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.rot[i] += this.spin[i] * dt;
      for (let k = 0; k < 3; k++) this.c[i4 + k] = this.base[i3 + k] + (this.fade[i3 + k] - this.base[i3 + k]) * t;
      const fin = Math.min(1, t * 8);
      this.c[i4 + 3] = this.a0[i] * fin * (1 - t) * (1 - t * 0.2);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.aP.needsUpdate = this.aC.needsUpdate = this.aS.needsUpdate = this.aR.needsUpdate = true;
  }
  kill(i) {
    const j = --this.n; if (i === j) return;
    const cp3 = (a) => { a[i * 3] = a[j * 3]; a[i * 3 + 1] = a[j * 3 + 1]; a[i * 3 + 2] = a[j * 3 + 2]; };
    cp3(this.p); cp3(this.v); cp3(this.base); cp3(this.fade);
    for (let k = 0; k < 4; k++) this.c[i * 4 + k] = this.c[j * 4 + k];
    for (const a of [this.size, this.rot, this.life, this.maxLife, this.s0, this.s1, this.a0, this.drag, this.grav, this.spin]) a[i] = a[j];
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

const rnd = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(scene, quality) {
    this.scene = scene; this.q = quality;
    const dotTex = new THREE.CanvasTexture(softDot());
    const smokeTex = new THREE.CanvasTexture(smokePuff());
    this.add = new ParticleSystem(scene, quality.particles, dotTex, true);
    this.smoke = new ParticleSystem(scene, Math.floor(quality.particles * 0.8), smokeTex, false);
    // debris (instanced boxes)
    this.maxDebris = 260;
    const dg = new THREE.BoxGeometry(1, 1, 1);
    this.debrisMesh = new THREE.InstancedMesh(dg, new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.3 }), this.maxDebris);
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.debrisMesh.castShadow = true; this.debrisMesh.count = 0;
    this.debrisMesh.frustumCulled = false;
    scene.add(this.debrisMesh); this.debris = [];
    // flash lights
    this.lights = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa040, 0, 30, 1.6); scene.add(l); this.lights.push({ l, t: 0, max: 0, i0: 0 }); }
    // decals
    this.decals = []; this.decalMat = new THREE.MeshBasicMaterial({ map: T('scorch', [1, 1]), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 });
    this.decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // rings
    this.rings = []; this.ringGeo = new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2);
    this.shake = 0; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  flash(x, y, z, color, intensity, dur, range = 30) {
    let s = this.lights.find(o => o.t <= 0) || this.lights.reduce((a, b) => (a.t < b.t ? a : b));
    s.l.position.set(x, y, z); s.l.color.setHex(color); s.l.distance = range; s.t = s.max = dur; s.i0 = intensity; s.l.intensity = intensity;
  }
  decal(x, z, size) {
    let d;
    if (this.decals.length > 40) { d = this.decals.shift(); } else { d = new THREE.Mesh(this.decalGeo, this.decalMat); d.renderOrder = 1; this.scene.add(d); }
    d.position.set(x, 0.06 + this.decals.length * 0.0004, z); d.rotation.y = Math.random() * 6; d.scale.set(size, 1, size); this.decals.push(d);
  }
  ring(x, y, z, r1, dur, color = 0xffc070) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y, z); this.scene.add(m); this.rings.push({ m, t: 0, dur, r1 });
  }
  spawnDebris(x, y, z, n, colors, speed = 10, size = 0.35) {
    for (let k = 0; k < n; k++) {
      if (this.debris.length >= this.maxDebris) this.debris.shift();
      const s = size * rnd(0.5, 1.5);
      this.debris.push({ x, y, z, vx: rnd(-1, 1) * speed, vy: rnd(0.4, 1.3) * speed, vz: rnd(-1, 1) * speed, rx: rnd(0, 6), ry: rnd(0, 6), vr: rnd(-12, 12), sx: s * rnd(0.6, 1.8), sy: s * rnd(0.4, 1.2), sz: s * rnd(0.6, 1.6), life: rnd(2.5, 4.5), col: new THREE.Color(colors[(Math.random() * colors.length) | 0]), rest: false });
    }
  }
  sparks(x, y, z, n, color = [1, 0.75, 0.3], speed = 14) {
    for (let k = 0; k < n; k++) this.add.emit({ x, y, z, vx: rnd(-1, 1) * speed, vy: rnd(-0.2, 1.2) * speed, vz: rnd(-1, 1) * speed, life: rnd(0.25, 0.6), s0: rnd(0.25, 0.5), s1: 0.05, r: color[0] * 2, g: color[1] * 2, b: color[2] * 2, r2: 1, g2: 0.3, b2: 0.05, drag: 2, grav: 22 });
  }
  smokePuff(x, y, z, s = 2, dark = 0.25, life = 2.5, vy = 2) {
    this.smoke.emit({ x: x + rnd(-0.4, 0.4), y, z: z + rnd(-0.4, 0.4), vx: rnd(-0.6, 0.6) + 0.6, vy: vy * rnd(0.7, 1.3), vz: rnd(-0.6, 0.6), life: life * rnd(0.7, 1.3), s0: s * 0.5, s1: s * 2.2, r: dark, g: dark, b: dark * 0.95, r2: dark * 1.6, g2: dark * 1.6, b2: dark * 1.6, a: 0.75, drag: 0.6, spin: rnd(-0.6, 0.6) });
  }
  fire(x, y, z, s = 1) {
    this.add.emit({ x: x + rnd(-0.5, 0.5) * s, y, z: z + rnd(-0.5, 0.5) * s, vx: rnd(-0.4, 0.4), vy: rnd(2, 4) * s, vz: rnd(-0.4, 0.4), life: rnd(0.4, 0.8), s0: 1.6 * s, s1: 0.3, r: 2.2, g: 1.2, b: 0.35, r2: 1.2, g2: 0.25, b2: 0.05, a: 0.85, drag: 1 });
  }
  explosion(x, y, z, scale = 1, colors = ['#444', '#666', '#8a6a4a']) {
    const s = scale;
    this.flash(x, y + 2, z, 0xffa040, 260 * s, 0.45, 26 * s);
    this.add.emit({ x, y: y + 0.5, z, life: 0.18, s0: 14 * s, s1: 20 * s, r: 3, g: 2.4, b: 1.6, a: 1 });
    for (let k = 0; k < 26 * s; k++) {
      const a = Math.random() * 6.28, u = rnd(-0.2, 1), sp = rnd(3, 11) * s;
      this.add.emit({ x, y: y + 0.5, z, vx: Math.cos(a) * sp * (1 - u * 0.5), vy: u * sp + 2, vz: Math.sin(a) * sp * (1 - u * 0.5), life: rnd(0.35, 0.9), s0: rnd(2.5, 4.5) * s, s1: rnd(0.5, 1.5) * s, r: 2.6, g: 1.5, b: 0.5, r2: 1.4, g2: 0.3, b2: 0.05, a: 0.95, drag: 3.5, grav: -1 });
    }
    for (let k = 0; k < 18 * s; k++) {
      const a = Math.random() * 6.28, sp = rnd(1, 5) * s;
      this.smoke.emit({ x: x + rnd(-1, 1) * s, y: y + rnd(0, 2) * s, z: z + rnd(-1, 1) * s, vx: Math.cos(a) * sp, vy: rnd(1.5, 5) * s, vz: Math.sin(a) * sp, life: rnd(2, 4), s0: rnd(2, 4) * s, s1: rnd(7, 12) * s, r: 0.12, g: 0.11, b: 0.1, r2: 0.42, g2: 0.4, b2: 0.38, a: 0.8, drag: 1.2, spin: rnd(-0.5, 0.5) });
    }
    this.sparks(x, y + 1, z, 30 * s, [1, 0.7, 0.25], 16 * s);
    this.spawnDebris(x, y + 1, z, Math.round(12 * s), colors, 9 * Math.sqrt(s), 0.3 * Math.sqrt(s));
    this.decal(x, z, 5 * s);
    this.ring(x, 0.3, z, 9 * s, 0.5, 0xffb060);
    this.shake = Math.min(1.4, this.shake + 0.35 * s);
  }
  update(dt) {
    this.add.update(dt); this.smoke.update(dt);
    for (const s of this.lights) if (s.t > 0) { s.t -= dt; const k = Math.max(0, s.t / s.max); s.l.intensity = s.i0 * k * k; if (s.t <= 0) s.l.intensity = 0; }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = r.t / r.dur;
      if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); continue; }
      const e = 1 - (1 - k) * (1 - k); r.m.scale.setScalar(0.5 + e * r.r1); r.m.material.opacity = (1 - k) * 0.9;
    }
    const M = this.debrisMesh; let n = 0;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]; d.life -= dt;
      if (d.life <= 0) { this.debris.splice(i, 1); continue; }
      if (!d.rest) {
        d.vy -= 26 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.vr * dt; d.ry += d.vr * 0.7 * dt;
        if (d.y < d.sy / 2) { d.y = d.sy / 2; d.vy *= -0.35; d.vx *= 0.55; d.vz *= 0.55; d.vr *= 0.5; if (Math.abs(d.vy) < 1.2) { d.rest = true; d.rx = Math.round(d.rx / 1.57) * 1.57; } }
        if (Math.random() < 0.25 && d.life > 2) this.smoke.emit({ x: d.x, y: d.y, z: d.z, vy: 0.5, life: 0.6, s0: 0.4, s1: 1.2, r: 0.2, g: 0.2, b: 0.2, a: 0.4 });
      }
      const fade = Math.min(1, d.life / 0.6);
      this._m.compose(this._v.set(d.x, d.y, d.z), this._q.setFromEuler(this._e.set(d.rx, d.ry, 0)), this._s.set(d.sx * fade, d.sy * fade, d.sz * fade));
      M.setMatrixAt(n, this._m); M.setColorAt(n, d.col); n++;
    }
    M.count = n; M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true;
    this.shake = Math.max(0, this.shake - dt * 2.2);
  }
  clear() {
    this.add.clear(); this.smoke.clear(); this.debris.length = 0; this.debrisMesh.count = 0;
    for (const d of this.decals) this.scene.remove(d); this.decals.length = 0;
    for (const r of this.rings) { this.scene.remove(r.m); r.m.material.dispose(); } this.rings.length = 0;
    for (const s of this.lights) { s.t = 0; s.l.intensity = 0; }
  }
}
