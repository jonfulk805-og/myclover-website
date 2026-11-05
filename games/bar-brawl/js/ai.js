// Patron / brawler AI. Everything goes through the shared game object G.
import * as THREE from 'three';
import { clamp, lerp, rand, pick, chance, angDiff, approach, circleBox } from './util.js';
import { bark } from './fighter.js';
import { ROOM } from './world.js';

const _v = new THREE.Vector3();
const DOOR = { x: 0, z: 5.5 };

export function targetPos(G, t) {
  if (!t || t === G.player) return { x: G.player.x, z: G.player.z, y: 1.35 + G.player.jumpY, player: true };
  return { x: t.x, z: t.z, y: t.pts[1].y, player: false };
}
function validTarget(G, t) { return t === G.player ? !G.player.dead : (t && t.alive && !t.gone && !t.flee); }

export function setState(f, s) { f.state = s; f.st = 0; }

export function makeHostile(G, f, target, why = 'start') {
  if (!f.alive || f.flee || f.gone) return;
  const was = f.hostile;
  f.hostile = true; f.target = target || G.player;
  if (f.sit > 0.5) { f.blendFrom = f.pts.map(v => v.clone()); f.blend = 1; f.sit = 0; }
  f.dance = 0; f.setMood('angry');
  if (!was) { if (why === 'start' && chance(0.7)) G.fx.bubble(f, f.T.boss ? bark('boss') : bark('start')); if (!f.rag && ['idle', 'sitidle'].includes(f.state)) setState(f, 'approach'); }
}

export function startFlee(G, f) {
  if (f.T.boss || f.hostile) return;
  f.flee = true; f.setMood('dazed'); f.sit = 0; f.dance = 0; f.armsUp = 1; setState(f, 'flee'); G.fx.bubble(f, bark('flee'), 1.6);
}

function moveToward(G, f, tx, tz, speed, dt, face = true, strafe = 0) {
  const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz) || 1;
  let ux = dx / d, uz = dz / d;
  if (strafe) { const sx = -uz * strafe, sz = ux * strafe; ux = ux * (1 - Math.abs(strafe)) + sx; uz = uz * (1 - Math.abs(strafe)) + sz; }
  // separation from other fighters
  for (const o of G.fighters) { if (o === f || o.rag || o.gone) continue; const ox = f.x - o.x, oz = f.z - o.z, od = Math.hypot(ox, oz); if (od < 0.75 && od > 1e-3) { ux += ox / od * (0.75 - od) * 2.2; uz += oz / od * (0.75 - od) * 2.2; } }
  const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
  f.vx = lerp(f.vx, ux * speed, clamp(dt * 8, 0, 1)); f.vz = lerp(f.vz, uz * speed, clamp(dt * 8, 0, 1));
  if (face) f.yaw += clamp(angDiff(f.yaw, Math.atan2(dx, dz)), -7 * dt, 7 * dt);
  return d;
}

export function physicsMove(G, f, dt) {
  const ox = f.x, oz = f.z;
  f.x += f.vx * dt; f.z += f.vz * dt;
  const p = { x: f.x, z: f.z }, r = 0.28 * f.s * (f.T.boss ? 1.2 : 1);
  for (const b of G.world.boxes) { if (b.dead || b.solid === false || b.y1 < 0.3 || b.y0 > 1.2) continue; if (b.wall && (f.flee || f.entering) && Math.abs(p.x) < 0.8 && p.z > 5) continue; circleBox(p, r, b); }
  if (!f.flee) { p.x = clamp(p.x, ROOM.x0 + r, ROOM.x1 - r); p.z = clamp(p.z, ROOM.z0 + r, ROOM.z1 - r); }
  // player push
  const pl = G.player; const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz), mind = r + 0.3;
  if (d < mind && d > 1e-4 && !pl.dead) { p.x += dx / d * (mind - d) * 0.6; p.z += dz / d * (mind - d) * 0.6; pl.x -= dx / d * (mind - d) * 0.4; pl.z -= dz / d * (mind - d) * 0.4; }
  f.x = p.x; f.z = p.z;
  const moved = Math.hypot(f.x - ox, f.z - oz) / Math.max(dt, 1e-4);
  f.spd = lerp(f.spd, clamp(moved / 2.6, 0, 1.3), clamp(dt * 10, 0, 1));
  f.walk += dt * (4 + moved * 3.2);
  f.stuck = (Math.hypot(f.vx, f.vz) > 1 && moved < 0.3) ? (f.stuck || 0) + dt : 0;
  if (f.stuck > 0.6) { f.strafe *= -1; f.stuck = 0; f.unstick = 0.8; }
}

// route around the bar counter (the only big obstacle you can end up behind)
export function navTarget(G, f, tx, tz) {
  const B = G.world.barTop; if (!B) return [tx, tz];
  const behind = z => z < B.z0 - 0.05, inX = x => x > B.x0 - 0.5 && x < B.x1 + 0.5;
  if (behind(f.z) !== behind(tz) && (inX(f.x) || inX(tx))) {
    const useRight = Math.abs(f.x - (B.x1 + 0.7)) + Math.abs(tx - (B.x1 + 0.7)) < Math.abs(f.x - (B.x0 - 0.55)) + Math.abs(tx - (B.x0 - 0.55));
    const ex = useRight ? B.x1 + 0.7 : B.x0 - 0.55;
    if (Math.abs(f.x - ex) > 0.35) return [ex, behind(f.z) ? (B.z0 + B.z1) / 2 - 0.9 : B.z1 + 0.6];
    return [ex, behind(f.z) ? B.z1 + 0.8 : B.z0 - 0.7];
  }
  // steer around any other obstacle on the straight line (tables, pool table, bikes...)
  let hit = null, ht = 2;
  const dx = tx - f.x, dz = tz - f.z;
  for (const b of G.world.boxes) {
    if (b.dead || b.wall || b.solid === false || b.y1 < 0.3 || b.bar) continue;
    const e = 0.35, x0 = b.x0 - e, x1 = b.x1 + e, z0 = b.z0 - e, z1 = b.z1 + e;
    let t0 = 0, t1 = 1;
    for (const [o, d, lo, hi] of [[f.x, dx, x0, x1], [f.z, dz, z0, z1]]) {
      if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) { t0 = 2; break; } continue; }
      let a = (lo - o) / d, c = (hi - o) / d; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) break;
    }
    if (t0 <= t1 && t0 < ht && t1 > 0.02) { ht = t0; hit = b; }
  }
  if (hit) {
    const e = 0.6; let best = null, bc = 1e9;
    for (const cx of [hit.x0 - e, hit.x1 + e]) for (const cz of [hit.z0 - e, hit.z1 + e]) {
      const c = Math.hypot(cx - f.x, cz - f.z) + Math.hypot(tx - cx, tz - cz);
      if (Math.hypot(cx - f.x, cz - f.z) < 0.25) continue;
      if (c < bc) { bc = c; best = [cx, cz]; }
    }
    if (best) return best;
  }
  return [tx, tz];
}
function attackersOn(G, t) { let n = 0; for (const f of G.fighters) if (f.target === t && (f.state === 'windup' || f.state === 'strike' || f.state === 'throwwind' || f.state === 'charge')) n++; return n; }

function nearestProp(G, f, maxD) {
  let best = null, bd = maxD;
  for (const p of G.props) {
    if (p.state !== 'rest' || p.dead || p.owner || (p.D.heavy && !(f.T.boss || f.type === 'brute'))) continue;
    if (p.pos.y > 1.3) continue;
    const d = Math.hypot(p.pos.x - f.x, p.pos.z - f.z); if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function updateAI(G, f, dt) {
  f.t += dt; f.st += dt; f.cool -= dt; f.unstick = Math.max(0, (f.unstick || 0) - dt);
  if (f.gone) return;
  const DF = G.diffCfg;
  // ---- ragdoll states
  if (f.rag) {
    if (f.state === 'grabbed') return;
    if (f.ko) { f.koT += dt; return; }
    f.downT -= dt;
    if (f.downT <= 0 && f.ragSpeed() < 1.5) { f.yaw = Math.atan2(f.pts[1].x - f.pts[0].x, f.pts[1].z - f.pts[0].z); f.standUp(); setState(f, 'getup'); f.guard = 0; f.punchL = f.punchR = 0; }
    return;
  }
  // relax limb params toward neutral each frame
  f.punchL = approach(f.punchL, 0, dt * 4); f.armsUp = approach(f.armsUp, f.flee ? 1 : 0, dt * 3); f.holdR = approach(f.holdR, f.held && (f.state === 'throwwind') ? 1 : 0, dt * 5);
  f.sway = f.type === 'barfly' ? 1 : (f.hostile ? 0.2 : 0.5);
  if (f.dazed > 0) { f.dazed -= dt; if (f.dazed <= 0 && f.alive) f.setMood(f.hostile ? 'angry' : 'calm'); }
  f.vx *= 1 - clamp(dt * 6, 0, 1); f.vz *= 1 - clamp(dt * 6, 0, 1);
  // held prop follows the right hand
  if (f.held) { const h = f.held; h.pos.copy(f.pts[8]); h.quat.setFromAxisAngle(_v.set(0, 1, 0), f.yaw); if (h.D.long) h.quat.multiply(new THREE.Quaternion().setFromAxisAngle(_v.set(0, 1, 0), Math.PI / 2)); h.sync(); }

  switch (f.state) {
    case 'idle': case 'sitidle': {
      f.guard = approach(f.guard, 0, dt * 3); f.spd = approach(f.spd, 0, dt * 3);
      // sip drinks
      if (f.sit > 0.5) { f.punchR = Math.max(0, Math.sin(f.t * 0.7 + f.id) - 0.7) * 1.2; }
      if (G.chaos && f.react == null) f.react = rand(0.4, 3.5);
      if (f.react != null) { f.react -= dt; if (f.react <= 0) { f.react = null; if (chance(G.endless ? 0.9 : 0.62)) { makeHostile(G, f, chance(0.8) ? G.player : pickOther(G, f)); } else startFlee(G, f); } }
      break;
    }
    case 'getup': { f.guard = approach(f.guard, 1, dt * 2); if (f.st > 0.7) { f.setMood(f.dazed > 0 ? 'dazed' : 'angry'); setState(f, f.hostile ? 'approach' : 'idle'); if (!f.hostile) makeHostile(G, f, f.lastHitBy || G.player, 'hit'); } break; }
    case 'stagger': { f.guard = approach(f.guard, 0.3, dt * 3); f.punchR = approach(f.punchR, 0, dt * 6); if (f.st > (f.stagT || 0.35)) setState(f, f.dazed > 0 ? 'dazedidle' : 'approach'); break; }
    case 'dazedidle': { f.guard = 0; f.sway = 2; f.spd = approach(f.spd, 0, dt * 2); if (f.dazed <= 0) setState(f, 'approach'); break; }
    case 'flee': {
      const [fx, fz] = navTarget(G, f, DOOR.x, f.z < 4.6 ? 4.9 : 7.5); moveToward(G, f, f.z > 4.4 ? DOOR.x : fx, f.z > 4.4 ? 7.5 : fz, f.T.spd * 1.25, dt, true);
      if (f.z > 4.4) { G.world.door.open = 1; }
      if (f.z > 6.6) { f.gone = true; G.removeFighter(f); }
      physicsMove(G, f, dt); break;
    }
    case 'block': { f.guard = 1; f.crouch = approach(f.crouch, 0.25, dt * 3); faceTarget(G, f, dt); if (f.st > 0.7) { f.crouch = 0; setState(f, 'approach'); } break; }
    case 'windup': {
      faceTarget(G, f, dt); f.guard = 1; const wt = f.T.wind * DF.wind * (f.heavyHit ? 1.35 : 1);
      if (f.useLeft) f.punchL = -clamp(f.st / wt, 0, 1) * 0.4; else f.punchR = -clamp(f.st / wt, 0, 1) * 0.4;
      f.lean = approach(f.lean, -0.2, dt * 2);
      G.telegraph(f, clamp(f.st / wt, 0, 1));
      if (f.st >= wt) { setState(f, 'strike'); f.didHit = false; G.sound(f.held ? 'whiff' : 'whiff', 0.5); }
      break;
    }
    case 'strike': {
      const k = clamp(f.st / 0.13, 0, 1); if (f.useLeft) f.punchL = k; else f.punchR = k; f.lean = approach(f.lean, 0.35, dt * 8);
      const tp = targetPos(G, f.target), d = Math.hypot(tp.x - f.x, tp.z - f.z);
      if (f.st < 0.12) { f.vx += Math.sin(f.yaw) * 6 * dt; f.vz += Math.cos(f.yaw) * 6 * dt; }
      if (!f.didHit && f.st >= 0.09) {
        f.didHit = true; const reach = (f.T.reach + (f.held ? f.held.D.reach * 0.6 : 0)) * f.s + 0.25;
        const ang = Math.abs(angDiff(f.yaw, Math.atan2(tp.x - f.x, tp.z - f.z)));
        if (d < reach && ang < 0.9 && validTarget(G, f.target)) {
          let dmg = f.T.dmg * (f.heavyHit ? 1.6 : 1) * (f.held ? Math.max(1, f.held.D.swing / 10) : 1);
          if (f.target === G.player) G.hurtPlayer(dmg * DF.dmg, f, { melee: true, heavy: f.heavyHit });
          else G.hitFighter(f.target, dmg, _v.set(Math.sin(f.yaw), 0.15, Math.cos(f.yaw)), 2, { by: f, prop: f.held });
          if (f.held) G.propUsed(f, f.held);
        }
      }
      if (f.st > 0.16) { setState(f, 'recover'); }
      break;
    }
    case 'recover': { f.lean = approach(f.lean, 0, dt * 3); if (f.st > 0.3) { f.cool = rand(...f.T.cd) * DF.cd; setState(f, 'approach'); f.heavyHit = false; } break; }
    case 'fetch': {
      const p = f.fetchP; if (!p || p.state !== 'rest' || p.dead || p.owner) { setState(f, 'approach'); break; }
      const [nx, nz] = navTarget(G, f, p.pos.x, p.pos.z); moveToward(G, f, nx, nz, f.T.spd * 1.1, dt); const d = Math.hypot(p.pos.x - f.x, p.pos.z - f.z);
      physicsMove(G, f, dt);
      if (d < 0.7) { f.held = p; p.owner = f; p.state = 'held'; f.crouch = 0.5; G.sound('grab', 0.5); setState(f, 'approach'); f.cool = Math.min(f.cool, 0.4); }
      if (f.st > 4) setState(f, 'approach');
      f.crouch = approach(f.crouch, d < 1.2 ? 0.5 : 0, dt * 3);
      break;
    }
    case 'throwwind': {
      faceTarget(G, f, dt); f.holdR = clamp(f.st / 0.45, 0, 1);
      G.telegraph(f, clamp(f.st / 0.55, 0, 1));
      if (f.st > 0.55 * DF.wind) { G.aiThrow(f, f.held, f.target); f.held = null; f.holdR = 0; f.cool = rand(...f.T.cd) * DF.cd; setState(f, 'approach'); }
      break;
    }
    case 'charge': { // boss bull rush
      if (f.st < 0.7) { faceTarget(G, f, dt, 3); f.crouch = approach(f.crouch, 0.4, dt * 3); f.armsUp = 0; G.telegraph(f, f.st / 0.7); f.vx = f.vz = 0; break; }
      f.crouch = 0.25; f.lean = 0.6; f.guard = 1;
      const sp = f.T.spd * 3.4; f.vx = Math.sin(f.yaw) * sp; f.vz = Math.cos(f.yaw) * sp;
      const ox = f.x, oz = f.z; physicsMove(G, f, dt);
      const pl = G.player, d = Math.hypot(pl.x - f.x, pl.z - f.z);
      if (d < 0.9 * f.s && !f.chargeHit) { f.chargeHit = true; G.hurtPlayer(f.T.dmg * 1.5 * DF.dmg, f, { melee: true, heavy: true, knock: 6 }); }
      for (const o of G.fighters) if (o !== f && !o.rag && o.alive && Math.hypot(o.x - f.x, o.z - f.z) < 0.8 * f.s) G.hitFighter(o, 12, _v.set(Math.sin(f.yaw), 0.5, Math.cos(f.yaw)), 1, { by: f, knock: true, power: 8 });
      if (f.st > 2.0 || (f.st > 0.85 && Math.hypot(f.x - ox, f.z - oz) < sp * dt * 0.3)) { // hit a wall: stunned!
        if (f.st <= 2.0) { G.sound('crash', 1); G.shake(0.3); f.dazed = 2.2; G.fx.dizzy(f, 2.2); f.setMood('dazed'); G.fx.text(f.pts[2].clone().setY(f.pts[2].y + 0.5), 'STUNNED!', '#00e5ff', 0.9); setState(f, 'dazedidle'); }
        else setState(f, 'recover');
        f.lean = 0; f.crouch = 0; f.chargeHit = false; f.special = rand(6, 9);
      }
      return;
    }
    case 'stomp': {
      if (f.st < 0.9) { f.crouch = approach(f.crouch, f.st < 0.5 ? 0 : 0.5, dt * 4); f.armsUp = clamp(f.st * 2, 0, 1); G.stompWarn(f, f.st / 0.9); break; }
      if (!f.stomped) { f.stomped = true; G.stomp(f); f.crouch = 0.6; }
      if (f.st > 1.4) { f.stomped = false; f.crouch = 0; f.armsUp = 0; f.special = rand(6, 9); setState(f, 'recover'); }
      break;
    }
    case 'barrage': { // throw a bottle every 0.45s, 3 bottles
      faceTarget(G, f, dt); const n = Math.floor(f.st / 0.45);
      f.holdR = (f.st % 0.45) / 0.45;
      if (n > (f.barN || 0) && n <= 3) { f.barN = n; G.aiThrow(f, G.spawnPropInHand(f, 'bottle'), f.target, 0.6); }
      if (f.st > 1.6) { f.barN = 0; f.holdR = 0; f.special = rand(5, 8); setState(f, 'approach'); }
      break;
    }
    case 'approach': default: {
      if (f.state !== 'approach') setState(f, 'approach');
      if (!f.hostile) { setState(f, 'idle'); break; }
      if (!validTarget(G, f.target)) { f.target = G.player; if (G.player.dead) { f.guard = 0; f.armsUp = 1; f.spd = 0; break; } }
      const tp = targetPos(G, f.target), d = Math.hypot(tp.x - f.x, tp.z - f.z);
      f.guard = approach(f.guard, 1, dt * 3); f.lean = approach(f.lean, 0.05, dt * 2); f.crouch = approach(f.crouch, 0, dt * 2);
      const reach = f.T.reach * f.s + (f.held ? f.held.D.reach * 0.6 : 0);
      // boss specials
      if (f.T.special) { f.special = (f.special ?? rand(4, 6)) - dt; if (f.special <= 0 && f.target === G.player && d > 1.5 && d < 9) { const sp = pick(f.T.special); f.special = 99; setState(f, sp); f.barN = 0; f.stomped = false; f.chargeHit = false; if (sp !== 'barrage') G.fx.bubble(f, sp === 'charge' ? 'RRRAAAH!' : 'DROP THE BASS!', 1.2); break; } }
      // throwing
      if (f.held && (f.held.D.big ? d > 2.4 : d > 2.0) && d < 9 && f.cool <= 0 && chance(0.6 + f.T.throwP * 0.4)) { setState(f, 'throwwind'); break; }
      if (!f.held && f.cool <= 0 && d > 2.5 && chance(f.T.throwP * dt * 2.2)) { const p = nearestProp(G, f, 3.8); if (p) { f.fetchP = p; setState(f, 'fetch'); break; } }
      const want = reach * 0.8; let speed = f.T.spd * (G.player.buzz > 70 ? 1.05 : 1);
      const busy = f.target === G.player && attackersOn(G, G.player) >= DF.maxAtk;
      // failsafe: if we make no progress for a long time, come back in through the door
      if (d < (f.bestD ?? 99) - 0.3) { f.bestD = d; f.noProg = 0; } else { f.noProg = (f.noProg || 0) + dt; if (f.noProg > 2) f.bestD = d + 0.5; }
      if (f.noProg > 7 && d > 1.4 && !f.T.boss) { f.noProg = 0; f.bestD = 99; f.x = rand(-0.4, 0.4); f.z = 6.5; f.yaw = Math.PI; f.entering = true; setState(f, 'enter'); G.world.door.open = 1; break; }
      if (d > want + 0.15) {
        const circling = busy && d < 2.6;
        const [nx, nz] = navTarget(G, f, tp.x, tp.z);
        if (nx !== tp.x || nz !== tp.z) { moveToward(G, f, nx, nz, speed, dt, true); physicsMove(G, f, dt); break; }
        moveToward(G, f, tp.x, tp.z, circling ? speed * 0.55 : speed, dt, true, circling ? 0.85 * f.strafe : (f.unstick ? 0.8 * f.strafe : 0));
        if (circling && chance(dt * 0.25)) G.fx.bubble(f, bark('taunt'), 1.4);
      } else {
        faceTarget(G, f, dt);
        f.vx += -Math.sin(f.yaw) * dt * 2; f.vz += -Math.cos(f.yaw) * dt * 2; // keep a little space
        if (d < want - 0.3) { f.vx -= Math.sin(f.yaw) * dt * 8; f.vz -= Math.cos(f.yaw) * dt * 8; }
        if (chance(dt * 0.6)) { f.vx += Math.cos(f.yaw) * f.strafe * 1.5; f.vz -= Math.sin(f.yaw) * f.strafe * 1.5; }
        // block player wind-ups
        if (f.target === G.player && G.player.charging && f.cool > 0.15 && chance(f.T.block * dt * 5)) { setState(f, 'block'); break; }
        if (f.cool <= 0 && !busy && (f.target !== G.player || G.timeT - (G.lastAtk || 0) > DF.gap)) { if (f.target === G.player) G.lastAtk = G.timeT; setState(f, 'windup'); f.useLeft = !f.held && chance(0.4); f.heavyHit = chance(f.T.boss ? 0.35 : 0.2); }
      }
      physicsMove(G, f, dt);
      break;
    }
  }
  if (['windup', 'block', 'stagger', 'recover', 'dazedidle', 'getup', 'throwwind', 'barrage', 'stomp', 'idle', 'sitidle'].includes(f.state) && f.state !== 'idle' && f.state !== 'sitidle') physicsMove(G, f, dt);
  if (f.state !== 'windup' && f.state !== 'strike') { f.punchR = f.sit > 0.5 ? f.punchR : approach(f.punchR, 0, dt * 4); }
}

function faceTarget(G, f, dt, turn = 8) { const tp = targetPos(G, f.target); f.yaw += clamp(angDiff(f.yaw, Math.atan2(tp.x - f.x, tp.z - f.z)), -turn * dt, turn * dt); }
function pickOther(G, f) { const o = G.fighters.filter(o => o !== f && o.alive && !o.gone && !o.flee); return o.length ? pick(o) : G.player; }
