// LONG SHADOW - rifle ballistics, hits, explosives, kill cam
import * as THREE from 'three';
import { G, P, REF, AMMO, GRAV } from './state.js';
import { segBoxes, EXPLOSIVES } from './compound.js';
import { groundH } from './terrain.js';
import { hitVolumes, segSphere, segCapsule } from './people.js';
import { killAgent, noticeImpact, raiseAlarm, startSearch, shotHeard, startFlee } from './ai.js';

const _o = new THREE.Vector3(), _d = new THREE.Vector3();
const rnd = (a, b) => a + Math.random() * (b - a);
export const ZERO = 100; // rifle zeroed at 100 m for each load
export function zeroAngle(type) { const v = AMMO[type].v, t = ZERO / v; return Math.atan2(0.5 * GRAV * t * t, ZERO); }
export function windVec() { return G.wind || { x: 0, z: 0 }; }
const WIND_K = 0.38; // fraction of wind speed the bullet picks up laterally (simple drift model)

let treesNear = null;
export function resetBallistics() { treesNear = REF.veg.trees.filter((t) => t.z > -175 && t.z < -40 && Math.abs(t.x) < 200); G.bullets = []; }

// trace a straight segment a->b; returns first hit {t, kind, agent, part, exp, n}
export function traceSeg(ax, ay, az, bx, by, bz, opts = {}) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz); if (L < 1e-6) return null;
  let best = { t: Infinity };
  // terrain: march + bisection
  const n = Math.max(1, Math.ceil(L / 1.2)); let prevAbove = ay >= groundH(ax, az) - 0.02;
  for (let k = 1; k <= n; k++) {
    const t = k / n; const x = ax + dx * t, y = ay + dy * t, z = az + dz * t; const above = y >= groundH(x, z);
    if (prevAbove && !above) { let lo = (k - 1) / n, hi = t; for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; if (ay + dy * m >= groundH(ax + dx * m, az + dz * m)) lo = m; else hi = m; } best = { t: hi, kind: 'ground' }; break; }
    prevAbove = above;
  }
  const tb = segBoxes(ax, ay, az, bx, by, bz); if (tb < best.t) best = { t: tb, kind: segBoxes.box.kind === 'vehicle' || segBoxes.box.kind === 'tank' || segBoxes.box.kind === 'heli' || segBoxes.box.kind === 'gen' ? 'metal' : segBoxes.box.kind === 'crate' ? 'wood' : 'wall' };
  _o.set(ax, ay, az); _d.set(dx / L, dy / L, dz / L);
  // trees (front slope only)
  if (treesNear && az < -30) {
    const Lh = Math.hypot(dx, dz);
    if (Lh > 1e-6) { const hx = dx / Lh, hz = dz / Lh;
      for (const tr of treesNear) {
        if (Math.abs(tr.x - P.x) < 3 && Math.abs(tr.z - P.z) < 3) continue;
        const ex = tr.x - ax, ez = tr.z - az; const proj = ex * hx + ez * hz; if (proj < 0 || proj > Lh) continue;
        const d2 = Math.abs(ex * hz - ez * hx); if (d2 > tr.can + 0.5) continue;
        const t = proj / Lh, py = ay + dy * t, ty = py - tr.base; if (ty < 0 || py > tr.top) continue;
        const rr = ty < 2.2 ? tr.r : tr.can * Math.max(0.1, 1 - (ty - 2) / (tr.top - tr.base)) * 0.8;
        if (d2 < rr && t < best.t) best = { t, kind: 'wood' };
      } }
  }
  // explosives
  for (const e of EXPLOSIVES) { if (!e.alive) continue; const t = segSphere(_o, _d, L, { x: e.x, y: e.y, z: e.z }, e.r * 0.75); if (t / L < best.t) best = { t: t / L, kind: 'explosive', exp: e }; }
  // people
  if (!opts.noPeople) for (const a of G.agents) {
    if (a.hidden || a.gone) continue;
    const cx = a.x - ax, cy = a.y + 0.9 - ay, cz = a.z - az; const pr = cx * _d.x + cy * _d.y + cz * _d.z; if (pr < -2 || pr > L + 2) continue;
    const qx = cx - _d.x * pr, qy = cy - _d.y * pr, qz = cz - _d.z * pr; if (qx * qx + qy * qy + qz * qz > 2.4 * 2.4) continue;
    const vols = hitVolumes(a.rig);
    for (const v of vols) { const t = v.type === 's' ? segSphere(_o, _d, L, v.c, v.r) : segCapsule(_o, _d, L, v.a, v.b, v.r); if (t / L < best.t) best = { t: t / L, kind: 'person', agent: a, part: v.part }; }
  }
  if (best.t === Infinity) return null;
  best.x = ax + dx * best.t; best.y = ay + dy * best.t; best.z = az + dz * best.t; return best;
}

// predict where a shot fired now would land (no agent motion); returns hit or null
export function predict(o, dir, type, maxT = 2.5) {
  const v = AMMO[type].v, w = windVec(), Dk = G.D.wind;
  const vel = { x: dir.x * v, y: dir.y * v, z: dir.z * v }; let x = o.x, y = o.y, z = o.z; const dt = 1 / 90;
  for (let t = 0; t < maxT; t += dt) {
    const nx = x + vel.x * dt + w.x * WIND_K * Dk * dt * Math.min(1, t * 6), ny = y + vel.y * dt, nz = z + vel.z * dt + w.z * WIND_K * Dk * dt * Math.min(1, t * 6);
    vel.y -= GRAV * dt;
    const h = traceSeg(x, y, z, nx, ny, nz); if (h) { h.tof = t; return h; }
    x = nx; y = ny; z = nz;
  }
  return null;
}

export function fireRifle(o, dir) {
  const type = P.magType, v = AMMO[type].v;
  const b = { x: o.x, y: o.y, z: o.z, vx: dir.x * v, vy: dir.y * v, vz: dir.z * v, t: 0, type, ox: o.x, oy: o.y, oz: o.z, trail: [[o.x, o.y, o.z]], whizzed: new Set() };
  G.bullets.push(b); G.stats.shots++;
  const masked = G.t < G.mask.until;
  REF.audio.shot(type === 'sub');
  if (type === 'super' && !masked) shotHeard(P.x, P.z);
  if (masked) G.stats.masked++;
  // kill cam?
  if (REF.settings.killcam && G.state === 'play') {
    const h = predict(o, dir, type);
    if (h && h.kind === 'person' && !h.agent.dead && (h.part === 'head' || h.part === 'body')) {
      const a = h.agent, dist = Math.hypot(h.x - o.x, h.z - o.z);
      const lastTarget = a.isTarget && G.agents.filter((q) => q.isTarget && !q.dead && !q.gone).length === 1;
      if (lastTarget || (a.isTarget && Math.random() < 0.7) || (h.part === 'head' && dist > 110 && Math.random() < 0.35) || dist > 230) {
        b.killcam = true; G.killcam = { b, phase: 'fly', t: 0, tof: h.tof, agent: a, dist, end: 0 };
        G.ts = Math.max(0.035, Math.min(0.25, h.tof / 2.0)); REF.audio.killcamWhoosh(2.0);
      }
    }
  }
  return b;
}

export function updateBullets(dt) {
  const w = windVec(), Dk = G.D.wind;
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i]; let rem = dt; let done = false;
    while (rem > 0 && !done) {
      const st = Math.min(rem, 1 / 120); rem -= st;
      const nx = b.x + b.vx * st + w.x * WIND_K * Dk * st * Math.min(1, b.t * 6), ny = b.y + b.vy * st, nz = b.z + b.vz * st + w.z * WIND_K * Dk * st * Math.min(1, b.t * 6);
      b.vy -= GRAV * st; b.t += st;
      const h = traceSeg(b.x, b.y, b.z, nx, ny, nz);
      // close passes alert people
      for (const a of G.agents) { if (a.dead || a.hidden || a.gone || b.whizzed.has(a)) continue; const dd = distPointSeg(a.x, a.y + 1.4, a.z, b.x, b.y, b.z, nx, ny, nz); if (dd < 2.5 && (!h || h.agent !== a)) { b.whizzed.add(a); if (!a.isTarget) noticeImpact(a.x, a.y, a.z, false); else if (!a.fleeing && Math.random() < 0.6) startFlee(a, true); } }
      if (h) { b.x = h.x; b.y = h.y; b.z = h.z; impact(b, h); done = true; }
      else { b.x = nx; b.y = ny; b.z = nz; }
      if (b.t > 3) done = true;
    }
    b.trail.push([b.x, b.y, b.z]); if (b.trail.length > 40) b.trail.shift();
    if (done) { b.dead = true; G.bullets.splice(i, 1); G.tracers.push({ a: [b.ox, b.oy, b.oz], b: [b.x, b.y, b.z], t: 0.0, trail: b.trail, life: 0.9, ghost: true }); if (G.killcam && G.killcam.b === b && G.killcam.phase === 'fly') { G.killcam.phase = 'after'; G.killcam.t = 0; G.killcam.hit = b.hitInfo; G.ts = 0.28; } }
  }
}
function distPointSeg(px, py, pz, ax, ay, az, bx, by, bz) { const dx = bx - ax, dy = by - ay, dz = bz - az; const L2 = dx * dx + dy * dy + dz * dz || 1e-9; let t = ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(ax + dx * t - px, ay + dy * t - py, az + dz * t - pz); }

function impact(b, h) {
  const dist = Math.hypot(h.x - b.ox, h.z - b.oz); b.hitInfo = h;
  const fx = REF.fx, au = REF.audio;
  if (h.kind === 'person') {
    const a = h.agent; const dir = new THREE.Vector3(b.vx, b.vy, b.vz).normalize();
    for (let k = 0; k < 14; k++) fx.smoke.emit({ x: h.x, y: h.y, z: h.z, vx: dir.x * rnd(1, 4) + rnd(-1, 1), vy: rnd(-0.5, 1.5), vz: dir.z * rnd(1, 4) + rnd(-1, 1), life: rnd(0.4, 0.9), s0: 0.15, s1: 0.6, r: 0.35, g: 0.02, b: 0.02, a: 0.85, drag: 3, grav: 4 });
    au.impact('flesh', G.killcam ? 0 : dist);
    if (a.dead) return;
    if (h.part === 'head' || h.part === 'body') {
      killAgent(a, h.part, dir, dist);
      const lbl = a.isTarget ? `${a.name.toUpperCase()} ELIMINATED` : h.part === 'head' ? 'HEADSHOT' : 'KILL';
      REF.popup(lbl, `${Math.round(dist)} m${b.type === 'sub' ? ' / subsonic' : ''}`, a.isTarget ? '#ffd36a' : '#f4ecd2');
      if (a.isTarget) au.ui('target');
      REF.score(a.isTarget ? 1000 : 150, h.part === 'head' ? 150 : 0, dist);
    } else {
      // wounded: they scream for help
      a.hp = (a.hp ?? 100) - 50;
      REF.popup('WOUNDED', 'Limb hit. They are calling it in.', '#ff8a6a');
      if (a.isTarget) startFlee(a, true); else { a.mode = 'combat'; }
      raiseAlarm('A wounded man screamed for help');
      if (a.hp <= 0) killAgent(a, 'body', dir, dist);
    }
  } else if (h.kind === 'explosive') {
    detonate(h.exp, dist);
  } else {
    const col = h.kind === 'ground' ? 0.42 : 0.55;
    for (let k = 0; k < 6; k++) fx.smoke.emit({ x: h.x, y: h.y + 0.1, z: h.z, vx: rnd(-1, 1), vy: rnd(1, 3), vz: rnd(-1, 1), life: rnd(0.6, 1.4), s0: 0.3, s1: 1.4, r: col, g: col * 0.92, b: col * 0.8, a: 0.7, drag: 2, grav: 1 });
    if (h.kind === 'metal') fx.sparks(h.x, h.y, h.z, 8, [1, 0.8, 0.4], 6);
    au.impact(h.kind === 'metal' ? 'metal' : 'dirt', dist);
    if (h.z > -30) noticeImpact(h.x, h.y, h.z, h.kind === 'metal');
  }
}

export function detonate(e, dist) {
  if (!e.alive) return; e.alive = false;
  const s = e.big ? 2.2 : 1.2;
  REF.fx.explosion(e.x, e.y, e.z, s, ['#3a2a20', '#5a1a12', '#8a8070']);
  if (e.meshes) for (const m of e.meshes) m.visible = false;
  REF.audio.explosion(dist);
  REF.flashT = 0.4;
  const R = e.big ? 13 : 7.5; let kills = 0;
  for (const a of G.agents) {
    if (a.dead || a.hidden || a.gone) continue; const d = Math.hypot(a.x - e.x, a.z - e.z, (a.y + 1) - e.y);
    if (d < R) { killAgent(a, 'body', new THREE.Vector3(a.x - e.x, 0, a.z - e.z).normalize(), Math.hypot(a.x - P.x, a.z - P.z)); a.found = true; kills++; a.accident = true; }
    else if (d < R * 3 && !a.isTarget) { a.mode = 'inv'; a.invPos = [e.x + rnd(-4, 4), e.z + rnd(-4, 4)]; a.meter = Math.max(a.meter, 0.4); }
  }
  G.stats.accidents += kills;
  if (kills) REF.popup(kills > 1 ? `ACCIDENT x${kills}` : 'ACCIDENT', 'Explosions look like bad luck. Mostly.', '#ffb648');
  for (const o of EXPLOSIVES) if (o.alive && Math.hypot(o.x - e.x, o.z - e.z) < R * 0.9) setTimeout(() => detonate(o, dist), 220);
  // an explosion is loud but nobody blames the ridge for it
  startSearch(e.x, e.z, 'Something blew up in the yard');
  for (const t of G.agents) if (t.isTarget && !t.dead && !t.fleeing && Math.hypot(t.x - e.x, t.z - e.z) < 45) startFlee(t, true);
}
