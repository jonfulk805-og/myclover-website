// Grabbable / throwable / breakable props with light rigid-sphere physics.
import * as THREE from 'three';
import { rand, pick, clamp } from './util.js';
import { bottleGeo, ROOM } from './world.js';
import * as TX from './textures.js';

// hUp: centre height when upright, hSide: when lying. swing: melee dmg. hits: melee uses before it breaks.
export const PD = {
  mug: { name: 'beer mug', r: .07, hUp: .08, hSide: .06, mass: .6, swing: 9, reach: .2, hits: 1, brk: 'glass', value: 5, drink: 22 },
  glass: { name: 'cocktail', r: .05, hUp: .07, hSide: .04, mass: .3, swing: 6, reach: .2, hits: 1, brk: 'glass', value: 5, drink: 16 },
  pitcher: { name: 'pitcher', r: .1, hUp: .12, hSide: .09, mass: 1.2, swing: 12, reach: .25, hits: 1, brk: 'glass', value: 15, drink: 40 },
  bottle: { name: 'bottle', r: .045, hUp: .155, hSide: .036, mass: .7, swing: 12, reach: .45, hits: 1, brk: 'bottle', value: 8, drink: 14 },
  broken: { name: 'broken bottle', r: .04, hUp: .08, hSide: .035, mass: .4, swing: 15, reach: .4, hits: 2, brk: 'glass', value: 0 },
  stool: { name: 'bar stool', r: .22, hUp: .37, hSide: .17, mass: 4, swing: 21, reach: .75, hits: 3, brk: 'wood', value: 40, big: true },
  chair: { name: 'chair', r: .26, hUp: .45, hSide: .2, mass: 5, swing: 24, reach: .75, hits: 3, brk: 'wood', value: 60, big: true },
  cue: { name: 'pool cue', r: .035, hUp: .03, hSide: .03, mass: .6, swing: 13, reach: 1.1, hits: 2, brk: 'snap', value: 20, long: true },
  halfcue: { name: 'half a cue', r: .03, hUp: .03, hSide: .03, mass: .3, swing: 11, reach: .6, hits: 3, brk: 'wood', value: 0, long: true },
  ball: { name: 'pool ball', r: .04, hUp: .04, hSide: .04, mass: .5, swing: 8, reach: .2, hits: 99, brk: null, value: 0, round: true, throwMul: 1.8 },
  plank: { name: 'table plank', r: .06, hUp: .06, hSide: .03, mass: 1.5, swing: 14, reach: .75, hits: 3, brk: 'wood', value: 0, long: true },
  leg: { name: 'table leg', r: .05, hUp: .05, hSide: .04, mass: 1, swing: 12, reach: .55, hits: 4, brk: 'wood', value: 0, long: true },
  keg: { name: 'beer keg', r: .24, hUp: .3, hSide: .22, mass: 14, swing: 32, reach: .55, hits: 99, brk: null, value: 0, big: true, heavy: true },
  barrel: { name: 'whiskey barrel', r: .3, hUp: .42, hSide: .3, mass: 12, swing: 30, reach: .6, hits: 2, brk: 'wood', value: 80, big: true, heavy: true },
  drum: { name: 'oil drum', r: .3, hUp: .44, hSide: .3, mass: 11, swing: 28, reach: .6, hits: 99, brk: null, value: 0, big: true, heavy: true },
  extinguisher: { name: 'fire extinguisher', r: .09, hUp: .26, hSide: .09, mass: 5, swing: 19, reach: .45, hits: 99, brk: 'foam', value: 50 },
  guitar: { name: 'guitar', r: .14, hUp: .5, hSide: .07, mass: 3, swing: 27, reach: .85, hits: 1, brk: 'guitar', value: 300, big: true },
};

const std = o => new THREE.MeshStandardMaterial(o);
const M = {};
function mats() {
  if (M.wood) return M;
  M.wood = std({ map: TX.planks('propw', { base: [24, 45, 22], plankW: 128, rep: [1, 1], gaps: false }), roughness: .5 });
  M.dark = std({ color: '#2a160a', roughness: .5 }); M.iron = std({ color: '#222', metalness: .8, roughness: .35 });
  M.chrome = std({ color: '#e8e8e8', metalness: .75, roughness: .3 }); M.red = std({ color: '#c01818', roughness: .35, metalness: .2 });
  M.beer = std({ color: '#f0a020', roughness: .1, transparent: true, opacity: .85, emissive: '#3a1a00' }); M.foam = std({ color: '#fffaf0', roughness: .9 });
  M.glass = std({ color: '#cfe8ef', roughness: .05, metalness: .1, transparent: true, opacity: .35 });
  M.seat = std({ color: '#5a0f0f', roughness: .45 });
  return M;
}

export function propMesh(type, opts = {}) {
  const m = mats(), g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; inner.add(o); return o; };
  const D = PD[type];
  switch (type) {
    case 'mug': add(new THREE.CylinderGeometry(.05, .045, .14, 14), m.glass, 0, .07); add(new THREE.CylinderGeometry(.045, .04, .11, 14), m.beer, 0, .06); add(new THREE.CylinderGeometry(.05, .05, .025, 14), m.foam, 0, .13); { const h = add(new THREE.TorusGeometry(.035, .01, 6, 12, Math.PI), m.glass, .05, .07); h.rotation.z = -Math.PI / 2; } break;
    case 'glass': add(new THREE.ConeGeometry(.05, .07, 14, 1, true), m.glass, 0, .1).rotation.x = Math.PI; add(new THREE.CylinderGeometry(.006, .006, .08, 6), m.glass, 0, .04); add(new THREE.CylinderGeometry(.03, .03, .006, 12), m.glass, 0, .003); add(new THREE.ConeGeometry(.04, .05, 12), std({ color: pick(['#ff3d7f', '#3cff8a', '#00e5ff', '#ffb13c']), emissive: '#301020', transparent: true, opacity: .8 }), 0, .095).rotation.x = Math.PI; break;
    case 'pitcher': add(new THREE.CylinderGeometry(.08, .07, .24, 16), m.glass, 0, .12); add(new THREE.CylinderGeometry(.072, .064, .2, 16), m.beer, 0, .1); add(new THREE.CylinderGeometry(.078, .078, .03, 16), m.foam, 0, .215); break;
    case 'bottle': { const col = opts.color || pick(['#1d6b2e', '#5a2a0a', '#7a5a10', '#2a4a1a']); const b = add(bottleGeo(), std({ color: col, roughness: .08, metalness: .2, transparent: true, opacity: .9 })); const lb = add(new THREE.CylinderGeometry(.0365, .0365, .07, 12, 1, true), std({ map: TX.label(pick(['#d4a63c', '#efe2c0', '#c01818']), pick(['CLOVER', 'ROTGUT', 'XXX', 'LAGER'])) }), 0, .1); break; }
    case 'broken': { const col = '#2a5a20'; add(new THREE.CylinderGeometry(.036, .034, .12, 12), std({ color: col, roughness: .1, transparent: true, opacity: .9 }), 0, .06); for (let i = 0; i < 5; i++) { const s = add(new THREE.ConeGeometry(.012, .07, 3), std({ color: col, roughness: .1, transparent: true, opacity: .85 }), Math.cos(i * 1.3) * .028, .14, Math.sin(i * 1.3) * .028); s.rotation.z = (Math.random() - .5) * .5; } break; }
    case 'stool': add(new THREE.CylinderGeometry(.19, .19, .07, 20), m.seat, 0, .72); add(new THREE.TorusGeometry(.19, .02, 6, 20), m.chrome, 0, .72).rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .78, l = add(new THREE.CylinderGeometry(.018, .022, .72, 6), m.chrome, Math.cos(a) * .13, .36, Math.sin(a) * .13); l.rotation.z = Math.cos(a) * .12; l.rotation.x = -Math.sin(a) * .12; }
      add(new THREE.TorusGeometry(.15, .012, 5, 16), m.chrome, 0, .25).rotation.x = Math.PI / 2; break;
    case 'chair': add(new THREE.BoxGeometry(.42, .05, .42), m.wood, 0, .46); for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(.04, .46, .04), m.wood, sx * .18, .23, sz * .18);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.04, .48, .04), m.wood, sx * .18, .72, -.19); add(new THREE.BoxGeometry(.4, .14, .03), m.wood, 0, .88, -.19); add(new THREE.BoxGeometry(.4, .05, .03), m.wood, 0, .66, -.19); break;
    case 'cue': { const c = add(new THREE.CylinderGeometry(.006, .014, 1.45, 8), m.wood); c.rotation.z = Math.PI / 2; const b = add(new THREE.CylinderGeometry(.0145, .015, .45, 8), m.dark, -.5, 0); b.rotation.z = Math.PI / 2; break; }
    case 'halfcue': { const c = add(new THREE.CylinderGeometry(.011, .015, .7, 8), m.dark); c.rotation.z = Math.PI / 2; break; }
    case 'ball': add(new THREE.SphereGeometry(.04, 14, 10), std({ color: opts.color || '#ffd400', roughness: .15, metalness: .1 })); break;
    case 'plank': add(new THREE.BoxGeometry(.9, .05, .14), m.wood); break;
    case 'leg': add(new THREE.CylinderGeometry(.04, .05, .72, 8), m.iron).rotation.z = Math.PI / 2; break;
    case 'keg': add(new THREE.CylinderGeometry(.21, .21, .58, 20), m.chrome, 0, .3); for (const y of [.05, .55]) add(new THREE.TorusGeometry(.21, .02, 6, 20), m.chrome, 0, y).rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(.04, .04, .06, 8), m.iron, 0, .62); break;
    case 'barrel': add(new THREE.CylinderGeometry(.27, .27, .8, 16), m.wood, 0, .42); add(new THREE.CylinderGeometry(.3, .3, .3, 16), m.wood, 0, .42); for (const y of [.12, .72]) add(new THREE.TorusGeometry(.285, .015, 5, 20), m.iron, 0, y).rotation.x = Math.PI / 2; break;
    case 'drum': add(new THREE.CylinderGeometry(.29, .29, .86, 18), std({ color: pick(['#1a4a8a', '#8a1a1a', '#2a5a2a']), metalness: .6, roughness: .45, map: TX.metal('drum', { tint: [20, 30, 50], rep: [3, 1], corrugated: false, rust: .7 }) }), 0, .44); for (const y of [.25, .6]) add(new THREE.TorusGeometry(.295, .015, 5, 20), m.iron, 0, y).rotation.x = Math.PI / 2; break;
    case 'extinguisher': add(new THREE.CylinderGeometry(.075, .075, .44, 14), m.red, 0, .22); add(new THREE.SphereGeometry(.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.red, 0, .44); add(new THREE.BoxGeometry(.04, .08, .12), m.iron, 0, .52, .02); add(new THREE.CylinderGeometry(.012, .012, .2, 6), m.iron, .06, .4).rotation.z = .5; break;
    case 'guitar': { const body = std({ color: '#b0341a', roughness: .25, metalness: .1 }); const s = new THREE.Shape(); s.absellipse(0, 0, .17, .15, 0, Math.PI * 2); const bg = new THREE.ExtrudeGeometry(s, { depth: .07, bevelEnabled: true, bevelSize: .01, bevelThickness: .01, bevelSegments: 2 }); add(bg, body, 0, .18, -.035); const s2 = new THREE.Shape(); s2.absellipse(0, 0, .13, .11, 0, Math.PI * 2); add(new THREE.ExtrudeGeometry(s2, { depth: .07, bevelEnabled: false }), body, 0, .42, -.035); add(new THREE.CircleGeometry(.045, 16), std({ color: '#111' }), 0, .33, .041); add(new THREE.BoxGeometry(.05, .5, .03), m.dark, 0, .75, 0); add(new THREE.BoxGeometry(.08, .12, .03), m.dark, 0, 1.04, 0); break; }
  }
  inner.position.y = -D.hUp; // origin at centre of mass-ish
  if (D.long) inner.position.y = 0;
  if (type === 'guitar') inner.position.y = -.5;
  return g;
}

const UP = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
let PID = 1;
export class Prop {
  constructor(type, x, y, z, opts = {}) {
    this.id = PID++; this.type = type; this.D = PD[type]; this.opts = opts;
    this.mesh = propMesh(type, opts); this.pos = new THREE.Vector3(x, y, z); this.vel = opts.vel ? opts.vel.clone() : new THREE.Vector3(); this.quat = new THREE.Quaternion(); this.ang = new THREE.Vector3();
    this.hits = this.D.hits; this.state = opts.vel ? 'fly' : 'rest'; this.owner = null; this.thrownBy = null; this.tFly = 0; this.dead = false; this.full = !!this.D.drink; this.restUp = true;
    const yaw = opts.yaw != null ? opts.yaw : rand(0, 6.28);
    if (this.D.long) { this.restUp = false; this.quat.setFromEuler(_e.set(0, yaw, 0)); this.pos.y = y + this.D.hSide; }
    else { this.quat.setFromAxisAngle(UP, yaw); this.pos.y = y + this.D.hUp; }
    if (opts.vel) { this.ang.set(rand(-8, 8), rand(-8, 8), rand(-8, 8)); }
    this.sync();
  }
  sync() { this.mesh.position.copy(this.pos); this.mesh.quaternion.copy(this.quat); }
  throwIt(vel, by) { this.state = 'fly'; this.vel.copy(vel); this.thrownBy = by; this.tFly = 0; this.owner = null; const s = this.D.big ? 4 : 10; this.ang.set(rand(-s, s), rand(-s, s), rand(-s, s)); if (this.D.long) this.ang.set(0, rand(-12, 12), rand(-4, 4)); }
  update(dt, world, onHitStatic) {
    if (this.state !== 'fly') return;
    this.tFly += dt;
    const D = this.D, r = D.r;
    this.vel.y -= 15 * dt; this.vel.multiplyScalar(1 - 0.15 * dt);
    this.pos.addScaledVector(this.vel, dt);
    // spin
    const w = this.ang.length(); if (w > 0.01) { _q.setFromAxisAngle(_v.copy(this.ang).divideScalar(w), w * dt); this.quat.premultiply(_q); }
    let grounded = false, supportY = 0;
    // floor
    const restH = this.restHeight();
    if (this.pos.y < restH) { const sp = -this.vel.y; this.pos.y = restH; grounded = true; supportY = 0; if (sp > 3 && onHitStatic) onHitStatic(this, null, this.vel.length()); this.vel.y = sp > 1.5 ? sp * (D.round ? 0.55 : 0.25) : 0; this.vel.x *= D.round ? 0.97 : 0.75; this.vel.z *= D.round ? 0.97 : 0.75; this.ang.multiplyScalar(0.7); }
    // statics
    for (const b of world.boxes) {
      if (b.dead) continue;
      const cx = clamp(this.pos.x, b.x0, b.x1), cy = clamp(this.pos.y, b.y0, b.y1), cz = clamp(this.pos.z, b.z0, b.z1);
      const dx = this.pos.x - cx, dy = this.pos.y - cy, dz = this.pos.z - cz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r * r) continue;
      const sp = this.vel.length();
      if (b.solid === false) { if (sp > 3 && onHitStatic) onHitStatic(this, b, sp); continue; }
      const d = Math.sqrt(d2) || 1e-4;
      let nx = dx / d, ny = dy / d, nz = dz / d; if (d2 < 1e-8) { nx = 0; ny = 1; nz = 0; }
      // on top of a surface: stand on it
      if (ny > 0.7) { this.pos.y = b.y1 + Math.max(restH, r); grounded = true; supportY = b.y1; if (-this.vel.y > 3 && onHitStatic) onHitStatic(this, b, sp); this.vel.y = Math.max(0, -this.vel.y * 0.2); this.vel.x *= 0.8; this.vel.z *= 0.8; this.support = b; continue; }
      this.pos.x = cx + nx * r; this.pos.z = cz + nz * r; if (Math.abs(ny) > 0.3) this.pos.y = cy + ny * r;
      const vn = this.vel.x * nx + this.vel.y * ny + this.vel.z * nz;
      if (vn < 0) { this.vel.x -= 1.4 * vn * nx; this.vel.y -= 1.4 * vn * ny; this.vel.z -= 1.4 * vn * nz; this.vel.multiplyScalar(0.6); }
      if (sp > 3 && onHitStatic) onHitStatic(this, b, sp);
    }
    // room bounds safety
    this.pos.x = clamp(this.pos.x, ROOM.x0 + r, ROOM.x1 - r); this.pos.z = clamp(this.pos.z, ROOM.z0 + r, ROOM.z1 - r); if (this.pos.y > ROOM.h - r) { this.pos.y = ROOM.h - r; this.vel.y = -Math.abs(this.vel.y) * 0.3; }
    if (grounded && this.vel.lengthSq() < 0.15 && !this.dead) this.settle(supportY);
    this.sync();
  }
  restHeight() { _v.set(0, 1, 0).applyQuaternion(this.quat); return Math.abs(_v.y) > 0.6 ? this.D.hUp : this.D.hSide; }
  settle(surfY) {
    // snap to a stable orientation: upright or lying on its side, keep yaw
    _v.set(0, 1, 0).applyQuaternion(this.quat); const up = this.D.long ? false : (_v.y > 0.55);
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat); const yaw = Math.atan2(f.x, f.z);
    if (up) this.quat.setFromAxisAngle(UP, yaw); else if (this.D.long) this.quat.setFromEuler(_e.set(0, yaw, 0)); else this.quat.setFromEuler(_e.set(Math.PI / 2, yaw, 0, 'YXZ'));
    this.restUp = up; this.pos.y = surfY + (up ? this.D.hUp : this.D.hSide); this.state = 'rest'; this.vel.set(0, 0, 0); this.ang.set(0, 0, 0); this.thrownBy = null; this.sync();
  }
}
