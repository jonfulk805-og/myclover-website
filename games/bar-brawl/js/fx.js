// Particles, floating text, speech bubbles, dizzy stars.
import * as THREE from 'three';
import { rand, pick } from './util.js';
import * as TX from './textures.js';

class Pool {
  constructor(scene, geo, mat, max, opts = {}) {
    this.m = new THREE.InstancedMesh(geo, mat, max); this.m.frustumCulled = false; this.m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.m);
    this.max = max; this.ps = []; this.g = opts.g ?? 15; this.bounce = opts.bounce ?? 0.3; this.colors = !!opts.colors;
    if (this.colors) { this.m.setColorAt(0, new THREE.Color()); }
    this.m.count = 0;
  }
  add(pos, vel, life, size, color) { if (this.ps.length >= this.max) this.ps.shift(); this.ps.push({ p: pos.clone(), v: vel, life, l0: life, s: size, r: new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)), w: new THREE.Vector3(rand(-15, 15), rand(-15, 15), rand(-15, 15)), c: color ? new THREE.Color(color) : null }); }
  update(dt) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    let n = 0;
    for (let i = this.ps.length - 1; i >= 0; i--) { const p = this.ps[i]; p.life -= dt; if (p.life <= 0) { this.ps.splice(i, 1); continue; } }
    for (const p of this.ps) {
      p.v.y -= this.g * dt; p.p.addScaledVector(p.v, dt);
      if (p.p.y < 0.01) { p.p.y = 0.01; p.v.y *= -this.bounce; p.v.x *= 0.6; p.v.z *= 0.6; p.w.multiplyScalar(0.5); }
      p.r.x += p.w.x * dt; p.r.y += p.w.y * dt; p.r.z += p.w.z * dt;
      const k = Math.min(1, p.life / Math.min(0.4, p.l0)); q.setFromEuler(p.r); sc.setScalar(p.s * k);
      m4.compose(p.p, q, sc); this.m.setMatrixAt(n, m4); if (this.colors && p.c) this.m.setColorAt(n, p.c); n++;
    }
    this.m.count = n; this.m.instanceMatrix.needsUpdate = true; if (this.colors && this.m.instanceColor) this.m.instanceColor.needsUpdate = true;
  }
  clear() { this.ps.length = 0; this.m.count = 0; }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.shards = new Pool(scene, new THREE.TetrahedronGeometry(1), new THREE.MeshStandardMaterial({ color: '#cfe8ef', roughness: .05, metalness: .3, transparent: true, opacity: .8 }), 260, { colors: true, bounce: .35 });
    this.chips = new Pool(scene, new THREE.BoxGeometry(1, .25, .3), new THREE.MeshStandardMaterial({ color: '#7a4a24', roughness: .7 }), 200, { bounce: .3 });
    this.sparkPool = new Pool(scene, new THREE.BoxGeometry(.2, .2, 1), new THREE.MeshBasicMaterial({ color: '#ffd070', blending: THREE.AdditiveBlending, transparent: true }), 200, { g: 9, bounce: .5 });
    this.drops = new Pool(scene, new THREE.SphereGeometry(1, 6, 5), new THREE.MeshStandardMaterial({ color: '#ffb22a', roughness: .1, transparent: true, opacity: .8, emissive: '#3a1a00' }), 260, { colors: true, bounce: 0.05 });
    this.teeth = new Pool(scene, new THREE.BoxGeometry(1, 1.2, .8), new THREE.MeshStandardMaterial({ color: '#fffef0', roughness: .3 }), 40, { bounce: .5 });
    this.puffs = []; this.texts = []; this.bubbles = []; this.stars = [];
    this.smokeTex = TX.smokeSprite(); this.starTex = TX.starSprite();
  }
  glass(pos, n = 16, color = '#cfe8ef') { for (let i = 0; i < n; i++) this.shards.add(pos, new THREE.Vector3(rand(-3, 3), rand(0.5, 4), rand(-3, 3)), rand(0.8, 1.6), rand(0.012, 0.03), Math.random() < .3 ? '#2a6a30' : color); }
  splinters(pos, n = 14) { for (let i = 0; i < n; i++) this.chips.add(pos, new THREE.Vector3(rand(-3.5, 3.5), rand(1, 5), rand(-3.5, 3.5)), rand(1, 2), rand(0.03, 0.09)); }
  sparks(pos, n = 20) { for (let i = 0; i < n; i++) this.sparkPool.add(pos, new THREE.Vector3(rand(-4, 4), rand(0, 5), rand(-4, 4)), rand(0.3, 0.8), rand(0.02, 0.04)); }
  splash(pos, n = 18, color = '#ffb22a') { for (let i = 0; i < n; i++) this.drops.add(pos, new THREE.Vector3(rand(-2, 2), rand(0.5, 3), rand(-2, 2)), rand(0.4, 0.9), rand(0.012, 0.03), color); }
  blood(pos, n = 6) { this.splash(pos, n, '#ff3a3a'); }
  tooth(pos, dir) { this.teeth.add(pos, new THREE.Vector3(dir.x * 3 + rand(-1, 1), rand(2, 4), dir.z * 3 + rand(-1, 1)), 3, 0.012); }
  puff(pos, n = 6, color = '#ffffff', size = 0.6, life = 1.2, vel = 1) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color, transparent: true, depthWrite: false, opacity: 0.8 }));
      s.position.copy(pos).add(new THREE.Vector3(rand(-.2, .2), rand(-.1, .2), rand(-.2, .2))); s.scale.setScalar(size * rand(.6, 1.2)); this.scene.add(s);
      this.puffs.push({ s, v: new THREE.Vector3(rand(-vel, vel), rand(0.2, 1) * vel, rand(-vel, vel)), life, l0: life, grow: size * 1.5 });
    }
  }
  // floating 3D label: text sprite that rises and fades
  text(pos, str, color = '#ffe14d', size = 1, life = 1.3) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    x.font = '900 64px Impact, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 10; x.strokeStyle = 'rgba(0,0,0,.85)'; x.strokeText(str, 256, 64);
    const g = x.createLinearGradient(0, 30, 0, 100); g.addColorStop(0, '#fff'); g.addColorStop(0.45, color); g.addColorStop(1, color); x.fillStyle = g; x.fillText(str, 256, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.renderOrder = 20;
    s.position.copy(pos); s.scale.set(1.0 * size, 0.25 * size, 1); this.scene.add(s);
    this.texts.push({ s, life, l0: life });
  }
  bubble(fighter, str, life = 2.2) {
    for (const b of this.bubbles) if (b.f === fighter) { b.life = 0; }
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
    x.font = '800 44px system-ui, sans-serif'; const w = Math.min(500, x.measureText(str).width + 50);
    x.fillStyle = 'rgba(255,255,255,.95)'; x.strokeStyle = '#111'; x.lineWidth = 5; x.beginPath(); x.roundRect(256 - w / 2, 8, w, 96, 30); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(236, 100); x.lineTo(256, 140); x.lineTo(270, 100); x.fill(); x.stroke(); x.fillRect(238, 96, 30, 8);
    x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(str, 256, 57);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.renderOrder = 19; s.scale.set(1.1, 0.34, 1); this.scene.add(s);
    this.bubbles.push({ s, f: fighter, life, l0: life });
  }
  dizzy(fighter, dur) {
    for (const st of this.stars) if (st.f === fighter) { st.life = Math.max(st.life, dur); return; }
    const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex, transparent: true, depthWrite: false })); s.scale.setScalar(0.12); g.add(s); }
    this.scene.add(g); this.stars.push({ g, f: fighter, life: dur });
  }
  update(dt, cam) {
    this.shards.update(dt); this.chips.update(dt); this.sparkPool.update(dt); this.drops.update(dt); this.teeth.update(dt);
    for (let i = this.puffs.length - 1; i >= 0; i--) { const p = this.puffs[i]; p.life -= dt; if (p.life <= 0) { this.scene.remove(p.s); p.s.material.dispose(); this.puffs.splice(i, 1); continue; } p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 1.5); p.s.scale.addScalar(p.grow * dt); p.s.material.opacity = 0.8 * p.life / p.l0; }
    for (let i = this.texts.length - 1; i >= 0; i--) { const p = this.texts[i]; p.life -= dt; if (p.life <= 0) { this.scene.remove(p.s); p.s.material.map.dispose(); p.s.material.dispose(); this.texts.splice(i, 1); continue; } p.s.position.y += dt * 0.6; p.s.material.opacity = Math.min(1, p.life / 0.4); const k = 1 + Math.max(0, (p.l0 - p.life) < 0.12 ? (0.12 - (p.l0 - p.life)) * 4 : 0); p.s.scale.set(p.s.scale.x / (p.k || 1) * k, p.s.scale.y / (p.k || 1) * k, 1); p.k = k; }
    for (let i = this.bubbles.length - 1; i >= 0; i--) { const b = this.bubbles[i]; b.life -= dt; if (b.life <= 0 || b.f.gone) { this.scene.remove(b.s); b.s.material.map.dispose(); b.s.material.dispose(); this.bubbles.splice(i, 1); continue; } b.s.position.copy(b.f.pts[2]); b.s.position.y += 0.55 * b.f.s; b.s.material.opacity = Math.min(1, b.life / 0.3); }
    for (let i = this.stars.length - 1; i >= 0; i--) { const s = this.stars[i]; s.life -= dt; if (s.life <= 0 || s.f.gone) { this.scene.remove(s.g); this.stars.splice(i, 1); continue; } s.g.position.copy(s.f.pts[2]); s.g.position.y += 0.2 * s.f.s; const t = performance.now() / 1000; s.g.children.forEach((c, k) => { const a = t * 5 + k * Math.PI / 2; c.position.set(Math.cos(a) * 0.22, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.22); }); }
  }
  clear() { for (const p of [this.shards, this.chips, this.sparkPool, this.drops, this.teeth]) p.clear(); for (const a of [this.puffs, this.texts, this.bubbles]) { for (const p of a) this.scene.remove(p.s); a.length = 0; } for (const s of this.stars) this.scene.remove(s.g); this.stars.length = 0; }
}
