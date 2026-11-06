// LONG SHADOW - guards, targets, detection, alarms, the helicopter
import * as THREE from 'three';
import { G, P, REF, STANCE } from './state.js';
import { makePerson, poseRig, poseDeath } from './people.js';
import { findPath, segBoxes, HELI, BOXES } from './compound.js';
import { groundH, RIDGE_Z } from './terrain.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const WALK = 1.3, RUN = 4.3;

// ---------- line of sight (terrain + solid boxes) ----------
export function losClear(ax, ay, az, bx, by, bz, ignoreBox) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz); const n = Math.max(2, Math.ceil(L / 3));
  for (let k = 1; k < n; k++) { const t = k / n; const x = ax + dx * t, y = ay + dy * t, z = az + dz * t; if (y < groundH(x, z) - 0.05) return false; }
  const tb = segBoxes(ax, ay, az, bx, by, bz, ignoreBox); return !(tb < 0.995);
}

// ---------- spawn ----------
export function spawnAgents(C) {
  for (const a of G.agents) REF.scene.remove(a.rig.root);
  G.agents = []; let seed = 100;
  const mk = (def, isTarget) => {
    const look = { ...def.look, seed: def.look.seed || seed++ };
    if (isTarget) look.rifle = !!def.look.rifle;
    const rig = makePerson(look, REF.Q.shadows); REF.scene.add(rig.root);
    const route = def.route.map((s) => ({ ...s }));
    const st = route[0];
    const a = { def, rig, isTarget, kind: isTarget ? 'target' : def.kind, name: def.name || (def.kind === 'tower' ? 'Tower guard' : 'Guard'), role: def.role || '', id: def.id || 'g' + seed,
      x: st.p[0], z: st.p[1], y: st.y || 0, yaw: st.look ?? 0, route, ri: 0, leg: [], waitT: st.wait, phase: Math.random() * 6, speed: 0,
      mode: 'route', meter: 0, seeT: 0, lastSeeT: -99, hidden: !!st.hide, dead: false, deathT: 0, tagged: false, headYaw: 0, seed: Math.random() * 100, t: 0,
      susT: 0, susDir: 0, invPos: null, fireCD: rnd(1, 3), burst: 0, act: st.act || 'idle', los: false, losT: Math.random() * 0.25, sweep: def.sweep || 0, aboard: false, gone: false, noticed: new Set() };
    // stagger patrols so they don't all start in step
    if (def.phase) { for (let k = 0; k < def.phase; k++) advanceStep(a, true); }
    rig.root.visible = !a.hidden; placeRig(a);
    G.agents.push(a); return a;
  };
  for (const t of C.targets) mk(t, true);
  for (const g of C.guards) mk(g, false);
}
function placeRig(a) { a.rig.root.position.set(a.x, a.y, a.z); a.rig.root.rotation.y = a.yaw; }

function stepPos(s) { return { x: s.p[0], z: s.p[1], y: s.y || 0 }; }
function advanceStep(a, instant = false) {
  a.ri = (a.ri + 1) % a.route.length; const s = a.route[a.ri]; const p = stepPos(s);
  a.waitT = s.wait; a.act = 'idle';
  if (s.tp || instant) { a.x = p.x; a.z = p.z; a.y = p.y; a.leg = []; a.hidden = !!s.hide; a.arrived = true; a.act = s.act || 'idle'; if (s.look != null) a.yaw = s.look; return; }
  a.hidden = false; a.arrived = false;
  setLeg(a, p.x, p.z, p.y);
}
function setLeg(a, x, z, y = 0) {
  if (a.y > 0.5 || y > 0.5) a.leg = [[x, z]]; else a.leg = findPath(a.x, a.z, x, z);
  a.legY = y;
}

// ---------- detection ----------
const _e = new THREE.Vector3();
function playerVisFactor() {
  const st = STANCE[P.stance];
  let v = st.vis * (1 + Math.min(1.6, P.speed / 2.6));
  if (P.inBush) v *= P.stance === 0 ? 0.6 : 0.3;
  return v;
}
function lightFactor() {
  const C = G.contract; let l = C.pal.night ? 0.42 : C.id === 'dawn' ? 0.85 : 1;
  if (P.inLight) l = 1.25; if (G.flash > 0.3) l = Math.max(l, 1);
  return l;
}
export function detectionTick(dt) {
  const D = G.D, alarmMul = G.alarm === 'alarm' ? 2.6 : G.alarm === 'search' ? 1.6 : G.alarm === 'caution' ? 1.25 : 1;
  const pv = playerVisFactor() * lightFactor() * (P.glint ? 1.7 : 1);
  P.vis = clamp(pv / 1.6, 0, 1);
  const py = P.y + P.eye * 0.75; let maxM = 0, anySee = false;
  for (const a of G.agents) {
    if (a.dead || a.hidden || a.gone || a.isTarget) { a.meter = Math.max(0, a.meter - dt); continue; }
    const ex = a.x, ey = a.y + 1.65, ez = a.z;
    const dx = P.x - ex, dz = P.z - ez, d = Math.hypot(dx, dz, py - ey);
    const binoc = a.act === 'binoc' || a.kind === 'tower';
    let range = 230 * (binoc ? 1.55 : 1) * (G.alarm !== 'none' ? 1.2 : 1);
    if (G.contract.pal.night && !P.inLight) range *= 0.7;
    let rate = 0;
    if (d < range) {
      const fwd = a.yaw + a.headYaw; const ang = Math.abs(angDiff(Math.atan2(dx, dz), fwd));
      const cone = binoc ? (ang < 0.35 ? 0.9 : ang < 0.9 ? 0.2 : 0) : (ang < 0.6 ? 1 : ang < 1.25 ? 0.35 : 0);
      if (cone > 0) {
        a.losT -= dt; if (a.losT <= 0) { a.losT = 0.25; a.los = losClear(ex, ey, ez, P.x, py, P.z); }
        if (a.los) rate = pv * cone * Math.pow(1 - d / range, 1.4) * 1.1 * D.detect * alarmMul;
      }
    }
    if (rate > 0.005) { a.meter = Math.min(1.05, a.meter + rate * dt); a.lastSeeT = G.t; }
    else if (G.t - a.lastSeeT > 1.5) a.meter = Math.max(0, a.meter - dt * (a.mode === 'combat' ? 0.05 : 0.16));
    if (a.meter >= 1 && rate > 0) { anySee = true; spotted(a); }
    else if (a.meter > 0.42 && a.mode === 'route') { a.mode = 'sus'; a.susT = 0; a.susDir = Math.atan2(dx, dz); REF.audio.ui('suspicious'); G.stats.sus++; }
    if (a.mode === 'sus' && rate > 0) a.susDir = Math.atan2(dx, dz);
    maxM = Math.max(maxM, a.meter);
  }
  G.maxMeter = maxM;
  if (anySee) { G.lastSeenT = G.t; G.lastKnown = { x: P.x, y: P.y, z: P.z }; }
}
function spotted(a) {
  if (G.alarm !== 'alarm') { raiseAlarm('You were spotted'); G.stats.spotted++; REF.audio.ui('spotted'); }
  a.mode = 'combat';
}
export function raiseAlarm(msg) {
  const first = G.alarm !== 'alarm';
  G.alarm = 'alarm'; G.alarmT = 0; G.lastSeenT = G.t; G.lastKnown = { x: P.x, y: P.y, z: P.z };
  if (first) { G.stats.alarms++; G.banner = { text: 'ALARM', sub: msg, t: 3.5, col: '#ff4a3a' }; }
  for (const a of G.agents) {
    if (a.dead || a.gone) continue;
    if (a.isTarget) { if (!a.fleeing) startFlee(a, true); continue; }
    if (a.mode !== 'combat') { a.mode = 'combat'; a.combatT = 0; a.fireCD = rnd(1.5, 4); if (!a.hidden) a.meter = Math.max(a.meter, 0.6); }
    a.hidden = false; a.rig.root.visible = true;
  }
}
export function startSearch(x, z, msg) {
  if (G.alarm === 'alarm') return;
  G.alarm = 'search'; G.alarmT = 0; G.banner = { text: 'SEARCHING', sub: msg, t: 3, col: '#ffb648' };
  // the three nearest guards come to look
  const near = G.agents.filter((a) => !a.dead && !a.isTarget && a.kind !== 'tower' && !a.gone).sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z)).slice(0, 3);
  for (const a of near) { a.mode = 'inv'; a.invPos = [x + rnd(-3, 3), z + rnd(-3, 3)]; a.hidden = false; a.rig.root.visible = true; setLeg(a, a.invPos[0], a.invPos[1]); a.invT = 0; a.running = true; }
}
// a supersonic shot that nobody could mistake for anything else
export function shotHeard(px, pz) {
  G.shotHeardT = G.shotHeardT.filter((t) => G.t - t < 60); G.shotHeardT.push(G.t);
  const n = G.shotHeardT.length;
  if (G.alarm === 'alarm') return;
  for (const a of G.agents) { if (a.dead || a.isTarget || a.hidden) continue; a.meter = Math.max(a.meter, 0.25); if (a.mode === 'route') { a.mode = 'sus'; a.susT = 0; a.susDir = Math.atan2(px - a.x, pz - a.z) + rnd(-0.4, 0.4); } }
  if (n >= 3 || (n >= 2 && G.D.detect > 1.2)) { raiseAlarm('They worked out where the shots came from'); }
  else { if (G.alarm === 'none') G.alarm = 'caution'; G.alarmT = 0; G.banner = { text: 'SHOT HEARD', sub: n === 1 ? 'Guards are on edge. Another unmasked shot gives you away.' : 'One more and they will find you.', t: 3, col: '#ffb648' }; }
}
// something hit near this agent (miss / impact / whiz)
export function noticeImpact(x, y, z, loud) {
  for (const a of G.agents) {
    if (a.dead || a.hidden || a.gone || a.isTarget) continue;
    const d = Math.hypot(a.x - x, a.z - z); if (d > (loud ? 16 : 7)) continue;
    a.meter = Math.max(a.meter, 0.5);
    if (a.mode === 'route' || a.mode === 'sus') { a.mode = 'inv'; a.invPos = [x, z]; setLeg(a, x, z); a.invT = 0; a.running = false; }
  }
}

// ---------- kill ----------
export function killAgent(a, part, dir, dist) {
  a.dead = true; a.deathT = 0; a.meter = 0; a.mode = 'dead'; a.hidden = false; a.rig.root.visible = true;
  const facing = new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw));
  a.fallSide = facing.dot(dir) < 0 ? 1 : -1; a.deadAt = G.t; a.found = false;
  G.stats.kills++; if (part === 'head') G.stats.heads++; if (dist > G.stats.longest) G.stats.longest = dist;
  if (a.isTarget) { G.stats.targets++; } else G.stats.guards++;
  // witnesses
  for (const w of G.agents) {
    if (w === a || w.dead || w.hidden || w.gone || w.isTarget) continue;
    const d = Math.hypot(w.x - a.x, w.z - a.z); if (d > 45) continue;
    const ang = Math.abs(angDiff(Math.atan2(a.x - w.x, a.z - w.z), w.yaw + w.headYaw));
    if ((ang < 1.3 || d < 8) && losClear(w.x, w.y + 1.6, w.z, a.x, a.y + 1, a.z)) { a.found = true; G.stats.bodies++; startSearch(a.x, a.z, w.isTarget ? 'A target saw it happen' : 'A guard saw someone drop'); break; }
  }
  // targets near a witnessed kill bolt for the helicopter
  if (a.found) for (const t of G.agents) if (t.isTarget && !t.dead && !t.fleeing && Math.hypot(t.x - a.x, t.z - a.z) < 30) startFlee(t, true);
}

// ---------- targets leaving ----------
export function startFlee(a, panic) {
  if (a.dead || a.fleeing) return; a.fleeing = true; a.panic = panic; a.hidden = false; a.rig.root.visible = true; a.mode = 'flee';
  if (a.y > 0.5) { a.y = 0; a.x = 0; a.z = 64; } // came down the stairs
  setLeg(a, HELI.x + rnd(-2, 2) + 3.5, HELI.z - 3 + rnd(-1, 1));
  if (G.heliState === 'idle') { G.heliState = 'spool'; G.heliT = 0; }
}

// ---------- update ----------
export function updateAgents(dt) {
  const D = G.D;
  for (const a of G.agents) {
    a.t += dt;
    if (a.gone) continue;
    if (a.dead) { a.deathT += dt; const k = Math.min(1, a.deathT / 0.9); poseDeath(a.rig, k, a.fallSide); continue; }
    let moving = false, speed = WALK, act = a.act, wantYaw = null;
    if (a.mode === 'route') {
      if (a.leg.length) { moving = true; }
      else {
        const s = a.route[a.ri];
        if (!a.arrived) { a.arrived = true; a.waitT = s.wait; if (s.hide) { a.hidden = true; a.rig.root.visible = false; } if (s.y != null) a.y = s.y; }
        act = s.act || 'idle'; if (s.look != null) wantYaw = s.look + (a.kind === 'tower' ? Math.sin(a.t * 0.22 + a.seed) * a.sweep : 0);
        a.waitT -= dt; if (a.waitT <= 0) { advanceStep(a); if (a.hidden) a.rig.root.visible = false; else a.rig.root.visible = true; }
      }
      a.headYaw = a.kind === 'tower' ? Math.sin(a.t * 0.5 + a.seed) * 0.15 : moving ? Math.sin(a.t * 0.35 + a.seed) * 0.35 : Math.sin(a.t * 0.27 + a.seed) * 0.7;
    } else if (a.mode === 'sus') {
      a.susT += dt; wantYaw = a.susDir; act = a.def.look.binoc || a.kind === 'tower' ? 'binoc' : 'idle'; a.headYaw = Math.sin(a.t * 0.8) * 0.12;
      if (a.susT > 5 && a.meter <= 0.02) { a.mode = 'route'; resumeRoute(a); }
    } else if (a.mode === 'inv') {
      a.invT += dt; speed = a.running ? 3.2 : WALK; act = 'aim';
      if (a.leg.length) moving = true; else { a.headYaw = Math.sin(a.t * 0.9) * 0.9; act = 'crouch'; if (a.invT > 14) { a.mode = G.alarm === 'alarm' ? 'combat' : 'route'; if (a.mode === 'route') resumeRoute(a); } }
    } else if (a.mode === 'combat') {
      a.combatT = (a.combatT || 0) + dt; act = 'crouch'; a.headYaw = 0;
      const lk = G.lastKnown || P; wantYaw = Math.atan2(lk.x - a.x, lk.z - a.z);
      if (a.kind !== 'tower' && a.y < 0.5 && !a.coverSet) { a.coverSet = true; const c = findCover(a, lk); if (c) setLeg(a, c[0], c[1]); }
      if (a.leg.length) { moving = true; speed = RUN; act = 'aim'; }
      else if (a.kind === 'tower' || a.y > 0.5) act = 'aim';
      if (!moving) guardShoot(a, dt);
      if (G.alarm !== 'alarm' && a.combatT > 3) { a.mode = 'route'; a.coverSet = false; resumeRoute(a); }
    } else if (a.mode === 'flee') {
      speed = a.panic ? RUN : WALK * 1.15; act = a.panic ? 'panic' : 'idle';
      if (a.leg.length) moving = true; else { a.aboard = true; a.gone = true; a.rig.root.visible = false; G.aboard.push(a); }
    }
    if (moving) {
      const [tx, tz] = a.leg[0]; const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
      const st = speed * dt;
      if (d <= st) { a.x = tx; a.z = tz; a.leg.shift(); if (!a.leg.length && a.legY != null) a.y = a.legY; }
      else { a.x += dx / d * st; a.z += dz / d * st; }
      wantYaw = Math.atan2(dx, dz); a.speed = speed;
      if (speed >= RUN - 0.1 && act !== 'aim') act = a.isTarget ? 'panic' : 'run';
      if (a.y < 0.5) a.y = groundH(a.x, a.z) * 0 + 0;
    } else a.speed = 0;
    if (wantYaw != null) { const dd = angDiff(wantYaw, a.yaw); a.yaw += clamp(dd, -dt * 3.2, dt * 3.2); }
    a.phase += dt * a.speed * 3.3;
    a.act = act;
    if (!a.hidden) {
      const aimPitch = a.mode === 'combat' && G.lastKnown ? Math.atan2(G.lastKnown.y + 1 - (a.y + 1.5), Math.hypot(G.lastKnown.x - a.x, G.lastKnown.z - a.z)) : 0;
      poseRig(a.rig, { walk: moving ? Math.min(1.2, a.speed / WALK) : 0, phase: a.phase, act: moving && act === 'crouch' ? 'aim' : act, headYaw: a.headYaw, t: a.t, aimPitch });
    }
    placeRig(a);
  }
  // body discovery (cheap, 4 Hz)
  G.bodyT = (G.bodyT || 0) - dt;
  if (G.bodyT <= 0) {
    G.bodyT = 0.25; const night = G.contract.pal.night;
    for (const b of G.agents) {
      if (!b.dead || b.found || G.t - b.deadAt < 1.2) continue;
      for (const w of G.agents) {
        if (w.dead || w.hidden || w.gone || w.isTarget) continue;
        const d = Math.hypot(w.x - b.x, w.z - b.z); if (d > (night ? 20 : 34)) continue;
        if (Math.abs(b.y - w.y) > 3 && d > 8) continue;
        const ang = Math.abs(angDiff(Math.atan2(b.x - w.x, b.z - w.z), w.yaw + w.headYaw)); if (ang > 1.1 && d > 5) continue;
        if (!losClear(w.x, w.y + 1.6, w.z, b.x, b.y + 0.4, b.z)) continue;
        b.found = true; G.stats.bodies++; startSearch(b.x, b.z, 'A body was found');
        for (const t of G.agents) if (t.isTarget && !t.dead && !t.fleeing && Math.hypot(t.x - b.x, t.z - b.z) < 40) startFlee(t, true);
        break;
      }
    }
  }
  updateAlarm(dt); updateHeli(dt);
  void D;
}
function resumeRoute(a) { const s = a.route[a.ri]; const p = stepPos(s); a.arrived = false; if (Math.hypot(p.x - a.x, p.z - a.z) > 0.6) setLeg(a, p.x, p.z, p.y); else a.leg = []; }
function findCover(a, lk) {
  // nearest box side that puts the box between the guard and the threat
  let best = null, bd = 28;
  for (const b of BOXES) {
    if (b.y0 > 0.5 || b.y1 < 1) continue;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; const dx = cx - lk.x, dz = cz - lk.z, L = Math.hypot(dx, dz) || 1;
    const hw = (b.x1 - b.x0) / 2, hd = (b.z1 - b.z0) / 2; const off = Math.min(hw * Math.abs(dx / L) + hd * Math.abs(dz / L), Math.max(hw, hd)) + 0.9;
    const px = cx + dx / L * off, pz = cz + dz / L * off; const d = Math.hypot(px - a.x, pz - a.z);
    if (d < bd) { bd = d; best = [px, pz]; }
  }
  return best;
}
function guardShoot(a, dt) {
  a.fireCD -= dt; if (a.fireCD > 0) return;
  const py = P.y + P.eye * 0.7; const d = Math.hypot(P.x - a.x, P.z - a.z, py - a.y - 1.5);
  const sees = a.meter > 0.75 && G.t - a.lastSeeT < 1.5 && a.los;
  if (!sees) { a.fireCD = rnd(1, 2); if (G.lastKnown && Math.random() < 0.3) spray(a, G.lastKnown.x + rnd(-6, 6), G.lastKnown.y + 1, G.lastKnown.z + rnd(-6, 6), d, false); return; }
  if (a.burst <= 0) a.burst = 3;
  a.burst--; a.fireCD = a.burst > 0 ? 0.13 : rnd(1.6, 3.2);
  let p = 0.22 * G.D.acc * clamp(1 - d / 380, 0.15, 1) * [1, 0.7, 0.42][P.stance] * (P.inBush ? 0.6 : 1) * (a.kind === 'tower' ? 1.2 : 1);
  const hit = Math.random() < p;
  spray(a, P.x + (hit ? 0 : rnd(-3, 3)), py + (hit ? 0 : rnd(-1, 1.5)), P.z + (hit ? 0 : rnd(-2, 3)), d, hit);
}
function spray(a, tx, ty, tz, d, hit) {
  const mx = a.x + Math.sin(a.yaw) * 0.7, my = a.y + 1.45, mz = a.z + Math.cos(a.yaw) * 0.7;
  G.tracers.push({ a: [mx, my, mz], b: [tx, ty, tz], t: 0.09 });
  REF.fx.add.emit({ x: mx, y: my, z: mz, life: 0.06, s0: 1.4, s1: 0.4, r: 3, g: 2, b: 1, a: 1 });
  const pan = Math.sin(angDiff(Math.atan2(a.x - P.x, a.z - P.z), P.yaw + Math.PI)) * -1;
  REF.audio.enemyShot(d, pan);
  if (hit) { REF.onPlayerHit(rnd(16, 26) * (G.diff === 'hard' ? 1.25 : 1), Math.atan2(a.x - P.x, a.z - P.z)); }
  else if (Math.hypot(tx - P.x, tz - P.z) < 5) { setTimeout(() => REF.audio.whiz(pan), Math.min(800, d / 0.9)); REF.fx.smokePuff(tx, groundH(tx, tz) + 0.2, tz, 0.5, 0.45, 0.8, 1.5); }
}
function updateAlarm(dt) {
  G.alarmT += dt;
  if (G.alarm === 'alarm') {
    REF.audio.loop('alarm', true, { vol: 0.08 });
    if (G.t - G.lastSeenT > 40) { G.alarm = 'search'; G.alarmT = 0; G.banner = { text: 'SEARCHING', sub: 'They lost you. Stay low.', t: 3, col: '#ffb648' }; }
  } else REF.audio.loop('alarm', false);
  if (G.alarm === 'search' && G.alarmT > 35) { G.alarm = 'caution'; G.alarmT = 0; G.banner = { text: 'CAUTION', sub: 'The search is winding down. They stay twitchy.', t: 2.5, col: '#e8d080' }; for (const a of G.agents) if (a.mode === 'inv' || a.mode === 'combat') { a.mode = 'route'; a.coverSet = false; resumeRoute(a); } }
  if (REF.search) { const s = REF.search; if (G.alarm === 'alarm' || G.alarm === 'search') { const k = G.lastKnown || P; s.aimX = k.x; s.aimZ = k.z; s.focus = true; } else s.focus = false; }
}
function updateHeli(dt) {
  const h = REF.heli; if (!h) return;
  if (G.heliState === 'spool') { G.heliT += dt; REF.heliSpin = Math.min(30, G.heliT * 4); const living = G.agents.filter((a) => a.isTarget && !a.dead && !a.gone && a.fleeing); const left = G.agents.filter((a) => a.isTarget && !a.dead && !a.gone && !a.fleeing);
    if (G.aboard.length && (living.length === 0 || G.heliT > 40)) { G.heliState = 'lift'; G.heliT = 0; }
    if (!G.aboard.length && !living.length && !left.length) { G.heliState = 'idle'; REF.heliSpin = 0; }
  } else if (G.heliState === 'lift') {
    G.heliT += dt; REF.heliSpin = 32; const k = G.heliT;
    h.position.y = Math.max(0, (k - 1.5) * (k - 1.5) * 0.9); h.position.z = REF.heliHome.z + Math.max(0, k - 4) * Math.max(0, k - 4) * 1.6; h.rotation.x = Math.min(0.25, Math.max(0, k - 3) * 0.08);
    if (k > 3.5 && !G.escaped) { G.escaped = true; }
  }
}
export function heliDust() { if (REF.heliSpin > 8 && REF.heli.position.y < 25 && Math.random() < 0.5) REF.fx.smokePuff(REF.heli.position.x + rnd(-6, 6), 0.3, REF.heli.position.z + rnd(-6, 6), 2, 0.5, 1.6, 0.6); }
export { angDiff };
void RIDGE_Z;
