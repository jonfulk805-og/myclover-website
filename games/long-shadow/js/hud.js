// LONG SHADOW - 2D HUD: scope, binoculars, markers, detection, objectives, map
import * as THREE from 'three';
import { G, P, REF, STANCE, AMMO, ZOOMS } from './state.js';
import { BOXES, FENCE, HELI } from './compound.js';
import { RIDGE_Z } from './terrain.js';
import { angDiff } from './ai.js';

const _v = new THREE.Vector3();
const AMB = '#ffb648', GRN = '#7dff8a', RED = '#ff4a3a', INK = '#f4ecd2', GOLD = '#ffd36a';
let ctx, W, H, S;
function proj(x, y, z, cam) { _v.set(x, y, z).project(cam); if (_v.z > 1) return null; return [(_v.x * 0.5 + 0.5) * W, (-_v.y * 0.5 + 0.5) * H]; }
function panel(x, y, w, h, r = 12, a = 0.55) { ctx.fillStyle = `rgba(10,11,12,${a})`; rr(x, y, w, h, r); ctx.fill(); ctx.strokeStyle = 'rgba(255,230,200,0.10)'; ctx.lineWidth = 1 * S; ctx.stroke(); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function txt(s, x, y, size, col = INK, align = 'left', weight = 700, font = 'system-ui, -apple-system, Segoe UI, sans-serif') { ctx.font = `${weight} ${size * S}px ${font}`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function drawHUD(c, w, h, scale, cam) {
  ctx = c; W = w; H = h; S = scale; ctx.clearRect(0, 0, W, H);
  if (G.state !== 'play' && G.state !== 'paused') return;
  if (G.killcam) { drawKillcam(cam); return; }
  const scoped = P.scopeK > 0.92, bino = P.binoc;
  if (scoped) drawScope(cam); else if (bino) drawBinoc(cam); else drawCross();
  ctx.save(); if (scoped || bino) lensClip(scoped); drawMarkers(cam, scoped || bino); ctx.restore();
  drawIndicators();
  drawTopBar(); drawObjectives(); drawStatus(); drawAmmo(); drawStance();
  drawPopups(); drawBanner(); drawDamage();
  if (G.map) drawMap();
}

function lensClip(scoped) {
  const cx = W / 2, cy = H / 2; ctx.beginPath();
  if (scoped) ctx.arc(cx, cy, Math.min(W, H) * 0.47, 0, 7);
  else { const r = Math.min(W * 0.27, H * 0.46); ctx.arc(cx - r * 0.78, cy, r, 0, 7); ctx.moveTo(cx + r * 0.78 + r, cy); ctx.arc(cx + r * 0.78, cy, r, 0, 7); }
  ctx.clip();
}
function drawCross() {
  const cx = W / 2, cy = H / 2; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(cx, cy, 2 * S, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1 * S; ctx.beginPath(); ctx.arc(cx, cy, 9 * S, 0, 7); ctx.stroke();
}

// ---------- scope ----------
function drawScope(cam) {
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.47;
  // outside the tube
  ctx.save(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.moveTo(cx + R, cy); ctx.arc(cx, cy, R, 0, Math.PI * 2, true); ctx.closePath(); ctx.fill('evenodd');
  const g = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R + 1, 0, 7); ctx.fill();
  // lens tint + reflection
  const lg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); lg.addColorStop(0, 'rgba(120,170,255,0.05)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(255,160,90,0.04)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 10 * S; ctx.beginPath(); ctx.arc(cx, cy, R - 6 * S, 3.6, 4.4); ctx.stroke();
  // mil reticle
  const fovR = THREE.MathUtils.degToRad(cam.fov); const pxPerMil = 0.001 / (fovR / H);
  const night = G.nv; const rc = night ? 'rgba(160,255,160,0.9)' : 'rgba(8,8,8,0.92)'; const rcLite = night ? 'rgba(160,255,160,0.55)' : 'rgba(8,8,8,0.6)';
  ctx.strokeStyle = rc; ctx.fillStyle = rc;
  ctx.lineWidth = 3.2 * S; ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx - pxPerMil * 6, cy); ctx.moveTo(cx + pxPerMil * 6, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy + R); ctx.lineTo(cx, cy + pxPerMil * 6); ctx.stroke();
  ctx.lineWidth = 1.1 * S; ctx.beginPath(); ctx.moveTo(cx - pxPerMil * 6, cy); ctx.lineTo(cx + pxPerMil * 6, cy); ctx.moveTo(cx, cy - pxPerMil * 4); ctx.lineTo(cx, cy + pxPerMil * 6); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy - pxPerMil * 4.5); ctx.stroke();
  for (let k = 1; k <= 5; k++) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k]]) { const r = Math.max(1.2 * S, Math.min(3 * S, pxPerMil * 0.09)); ctx.beginPath(); ctx.arc(cx + dx * pxPerMil, cy + dy * pxPerMil, r, 0, 7); ctx.fill(); }
  // half-mil hash marks below center for holdover
  ctx.strokeStyle = rcLite; ctx.lineWidth = 1 * S;
  for (let k = 0.5; k <= 5; k += 1) { const y = cy + k * pxPerMil; ctx.beginPath(); ctx.moveTo(cx - 4 * S, y); ctx.lineTo(cx + 4 * S, y); ctx.stroke(); }
  // illuminated centre dot
  ctx.fillStyle = night ? '#bfffbf' : '#ff3a2a'; ctx.beginPath(); ctx.arc(cx, cy, 1.6 * S, 0, 7); ctx.fill();
  // predicted impact
  if (P.marker && P.markerOn) { const p = proj(P.marker.x, P.marker.y, P.marker.z, cam); if (p) { const [x, y] = p; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.strokeStyle = P.marker.kind === 'person' ? (P.marker.part === 'head' || P.marker.part === 'body' ? '#ff3a2a' : '#ffb648') : 'rgba(255,90,60,0.85)'; ctx.lineWidth = 2 * S; ctx.strokeRect(-5 * S, -5 * S, 10 * S, 10 * S); ctx.restore(); } }
  ctx.restore();
  // readouts
  const by = cy + R * 0.62; const rng = P.range ? `${Math.round(P.range)} m` : '---';
  txt(rng, cx, by, 15, night ? '#bfffbf' : '#e8f0e0', 'center', 800, 'ui-monospace, Menlo, Consolas, monospace');
  const zoom = ZOOMS[P.zoomI]; txt(`${zoom}x`, cx + R * 0.72, cy + R * 0.55, 14, 'rgba(232,240,224,0.8)', 'center', 800, 'ui-monospace, Menlo, monospace');
  const holdTxt = P.holding ? 'BREATH HELD' : P.breathLock > 0 ? 'OUT OF BREATH' : '';
  if (holdTxt) txt(holdTxt, cx, cy - R * 0.62, 12, P.breathLock > 0 ? RED : 'rgba(232,240,224,0.75)', 'center', 800);
  // breath bar
  const bw = 120 * S, bx = cx - bw / 2, byy = cy - R * 0.68; ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(bx, byy, bw, 4 * S, 2 * S); ctx.fill(); ctx.fillStyle = P.breathLock > 0 ? RED : '#cfe8ff'; rr(bx, byy, bw * P.breath, 4 * S, 2 * S); ctx.fill();
  // wind
  drawWind(cx - R * 0.72, cy + R * 0.55);
  if (P.glint) txt('SCOPE GLINT - you are facing the sun', cx, cy + R * 0.78, 12, AMB, 'center', 800);
  if (P.reloadT > 0) txt('RELOADING', cx, cy + R * 0.4, 13, AMB, 'center', 800); else if (P.boltT > 0) txt('cycling bolt', cx, cy + R * 0.4, 12, 'rgba(232,240,224,0.6)', 'center', 700);
  if (P.tagAim) tagRing(cx, cy);
}
function drawWind(x, y) {
  const w = G.wind || { x: 0, z: 0 }; const sp = Math.hypot(w.x, w.z) * G.D.wind;
  const rel = Math.atan2(w.x, w.z) - (P.yaw + Math.PI); // wind direction relative to view
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = 'rgba(232,240,224,0.35)'; ctx.lineWidth = 1 * S; ctx.beginPath(); ctx.arc(0, 0, 16 * S, 0, 7); ctx.stroke();
  ctx.rotate(-rel); ctx.fillStyle = '#cfe8ff'; ctx.beginPath(); ctx.moveTo(0, -13 * S); ctx.lineTo(5 * S, 4 * S); ctx.lineTo(0, 1 * S); ctx.lineTo(-5 * S, 4 * S); ctx.closePath(); ctx.fill(); ctx.restore();
  txt(`${sp.toFixed(1)} m/s`, x, y + 28 * S, 11, 'rgba(232,240,224,0.8)', 'center', 700);
}
function tagRing(cx, cy) {
  const a = P.tagAim; ctx.strokeStyle = a.isTarget ? GOLD : '#fff'; ctx.lineWidth = 2.5 * S; ctx.beginPath(); ctx.arc(cx, cy, 26 * S, -Math.PI / 2, -Math.PI / 2 + P.tagK * Math.PI * 2); ctx.stroke();
}
function drawBinoc(cam) {
  const cx = W / 2, cy = H / 2, r = Math.min(W * 0.27, H * 0.46);
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(cx - r * 0.78, cy, r, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(cx + r * 0.78, cy, r, 0, 7); ctx.fill(); ctx.restore();
  for (const sx of [-1, 1]) { const g = ctx.createRadialGradient(cx + sx * r * 0.78, cy, r * 0.75, cx + sx * r * 0.78, cy, r); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx + sx * r * 0.78, cy, r, 0, 7); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1 * S; ctx.beginPath(); ctx.moveTo(cx - 14 * S, cy); ctx.lineTo(cx - 4 * S, cy); ctx.moveTo(cx + 4 * S, cy); ctx.lineTo(cx + 14 * S, cy); ctx.moveTo(cx, cy - 10 * S); ctx.lineTo(cx, cy - 3 * S); ctx.stroke();
  for (let k = -4; k <= 4; k++) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx + k * 30 * S - 0.5 * S, cy + 40 * S, 1 * S, (k % 2 ? 4 : 8) * S); }
  txt(P.range ? `${Math.round(P.range)} m` : '---', cx, cy + 60 * S, 15, '#e8f0e0', 'center', 800, 'ui-monospace, Menlo, monospace');
  txt('BINOCULARS  -  hold your view on someone to tag them', cx, cy - r * 0.86, 12, 'rgba(232,240,224,0.7)', 'center', 700);
  if (P.tagAim) { tagRing(cx, cy); const a = P.tagAim; txt(a.tagged ? (a.isTarget ? `${a.name} - ${a.role}` : a.name) : 'Tagging...', cx, cy + 82 * S, 13, a.isTarget && a.tagged ? GOLD : INK, 'center', 800); }
  void cam;
}

// ---------- markers over people ----------
function drawMarkers(cam, zoomed) {
  for (const a of G.agents) {
    if (a.gone || (a.hidden && !a.tagged)) continue;
    const showDet = !a.dead && a.meter > 0.04 && !a.isTarget;
    if (!a.tagged && !showDet && !(a.mode === 'combat' && !a.dead)) continue;
    const p = proj(a.x, a.y + (a.dead ? 0.6 : 2.15), a.z, cam); if (!p) continue;
    const [x, y] = p; if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    const s = zoomed ? 1.1 : 0.85;
    if (a.dead) { if (a.tagged) { ctx.strokeStyle = a.isTarget ? 'rgba(255,211,106,0.8)' : 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(x - 5 * S, y - 5 * S); ctx.lineTo(x + 5 * S, y + 5 * S); ctx.moveTo(x + 5 * S, y - 5 * S); ctx.lineTo(x - 5 * S, y + 5 * S); ctx.stroke(); } continue; }
    if (a.hidden) { ctx.globalAlpha = 0.45; }
    const col = a.isTarget ? GOLD : a.mode === 'combat' ? RED : a.meter > 0.42 ? AMB : '#ffffff';
    if (a.tagged) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + 7 * S * s); ctx.lineTo(x - 6 * S * s, y - 3 * S * s); ctx.lineTo(x + 6 * S * s, y - 3 * S * s); ctx.closePath(); ctx.fill();
      if (a.isTarget) { ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5 * S; ctx.beginPath(); ctx.arc(x, y - 14 * S * s, 6 * S * s, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 9 * S * s, y - 14 * S * s); ctx.lineTo(x + 9 * S * s, y - 14 * S * s); ctx.moveTo(x, y - 23 * S * s); ctx.lineTo(x, y - 5 * S * s); ctx.stroke(); if (zoomed) txt(a.name, x, y - 32 * S, 11, GOLD, 'center', 800); }
    }
    if (showDet || a.mode === 'combat') {
      const k = Math.min(1, a.meter); const yy = y - (a.isTarget ? 34 : 16) * S * s;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.arc(x, yy, 7 * S, 0, 7); ctx.stroke();
      ctx.strokeStyle = a.mode === 'combat' || k >= 1 ? RED : k > 0.42 ? AMB : '#fff'; ctx.beginPath(); ctx.arc(x, yy, 7 * S, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
      txt(a.mode === 'combat' ? '!' : '?', x, yy + 0.5 * S, 10, ctx.strokeStyle, 'center', 900);
    }
    ctx.globalAlpha = 1;
  }
}
function drawIndicators() {
  const zoomed = P.scopeK > 0.9 || P.binoc; const cx = W / 2, cy = H / 2, R = Math.min(W, H) * (zoomed ? 0.485 : 0.2);
  for (const a of G.agents) {
    if (a.dead || a.hidden || a.gone || a.isTarget || a.meter < 0.08) continue;
    const ang = angDiff(Math.atan2(a.x - P.x, a.z - P.z), P.yaw + Math.PI);
    const k = Math.min(1, a.meter); const col = a.mode === 'combat' || k >= 1 ? RED : k > 0.42 ? AMB : 'rgba(255,255,255,0.9)';
    const base = -Math.PI / 2 - ang, half = 0.2;
    ctx.lineCap = 'round'; ctx.lineWidth = 5 * S; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, R, base - half, base + half); ctx.stroke();
    ctx.lineWidth = 3.5 * S; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R, base - half * k, base + half * k); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx + Math.cos(base) * (R + 13 * S), cy + Math.sin(base) * (R + 13 * S)); ctx.lineTo(cx + Math.cos(base - 0.05) * (R + 6 * S), cy + Math.sin(base - 0.05) * (R + 6 * S)); ctx.lineTo(cx + Math.cos(base + 0.05) * (R + 6 * S), cy + Math.sin(base + 0.05) * (R + 6 * S)); ctx.closePath(); if (k > 0.42) ctx.fill();
  }
}

// ---------- panels ----------
function drawTopBar() {
  // compass
  const cw = Math.min(520 * S, W * 0.5), cx = W / 2, y = 22 * S; const fovH = Math.PI * 0.9;
  const head = P.yaw + Math.PI; // 0 = facing +z (south)
  ctx.save(); ctx.beginPath(); ctx.rect(cx - cw / 2, y - 14 * S, cw, 36 * S); ctx.clip();
  const g = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.15, 'rgba(0,0,0,0.35)'); g.addColorStop(0.85, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(cx - cw / 2, y - 12 * S, cw, 26 * S);
  const lbl = { 0: 'S', 90: 'E', 180: 'N', 270: 'W', 45: 'SE', 135: 'NE', 225: 'NW', 315: 'SW' };
  for (let d = 0; d < 360; d += 15) {
    const a = angDiff(d * Math.PI / 180, head); const x = cx - a / fovH * cw; if (Math.abs(a) > fovH / 2) continue;
    const L = lbl[d]; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x - 0.5 * S, y + 4 * S, 1 * S, L ? 7 * S : 4 * S);
    if (L) txt(L, x, y - 3 * S, L.length > 1 ? 10 : 12, L === 'S' ? AMB : 'rgba(255,255,255,0.85)', 'center', 800);
  }
  for (const a of G.agents) { if (!a.tagged || a.gone) continue; const b = Math.atan2(a.x - P.x, a.z - P.z); const ang = angDiff(b, head); const x = cx - ang / fovH * cw; if (Math.abs(ang) > fovH / 2) continue; ctx.fillStyle = a.dead ? 'rgba(255,255,255,0.25)' : a.isTarget ? GOLD : a.mode === 'combat' ? RED : 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(x, y + 18 * S); ctx.lineTo(x - 4 * S, y + 12 * S); ctx.lineTo(x + 4 * S, y + 12 * S); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = AMB; ctx.fillRect(cx - 1 * S, y + 2 * S, 2 * S, 12 * S);
}
function drawObjectives() {
  const x = 18 * S, y = 16 * S, w = 270 * S; const T = G.agents.filter((a) => a.isTarget);
  const h = (44 + T.length * 34) * S; panel(x, y, w, h, 12 * S);
  txt(G.contract.sub.toUpperCase() + '  /  ' + G.contract.name.toUpperCase(), x + 14 * S, y + 16 * S, 10.5, AMB, 'left', 800);
  const left = G.clock; txt(left > 0 ? `Targets leave in ${fmt(left)}` : 'Targets are leaving!', x + 14 * S, y + 32 * S, 12, left > 0 ? 'rgba(244,236,210,0.75)' : RED, 'left', 700);
  T.forEach((a, i) => {
    const yy = y + (56 + i * 34) * S; const done = a.dead, gone = a.gone && !a.dead;
    ctx.strokeStyle = done ? GRN : gone ? RED : GOLD; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.arc(x + 22 * S, yy, 8 * S, 0, 7); ctx.stroke();
    if (done) { ctx.beginPath(); ctx.moveTo(x + 18 * S, yy); ctx.lineTo(x + 21 * S, yy + 3 * S); ctx.lineTo(x + 27 * S, yy - 4 * S); ctx.stroke(); }
    txt(a.tagged || done ? a.name : 'Unidentified target', x + 38 * S, yy - 6 * S, 12.5, done ? 'rgba(244,236,210,0.5)' : INK, 'left', 800);
    txt(done ? 'Eliminated' : gone ? 'Escaped' : a.fleeing ? 'Running for the helicopter!' : a.hidden ? `${a.role} - indoors` : a.role, x + 38 * S, yy + 8 * S, 11, done ? GRN : gone || a.fleeing ? RED : 'rgba(244,236,210,0.6)', 'left', 600);
  });
}
function drawStatus() {
  const x = W - (REF.touch ? 150 : 18) * S, y = 16 * S;
  const st = G.alarm === 'alarm' ? ['ALARM', RED] : G.alarm === 'search' ? ['SEARCHING', AMB] : G.alarm === 'caution' ? ['CAUTION', '#e8d080'] : G.maxMeter > 0.42 ? ['SUSPICIOUS', AMB] : ['HIDDEN', GRN];
  const pulse = G.alarm === 'alarm' ? 0.6 + 0.4 * Math.sin(G.t * 10) : 1;
  ctx.font = `800 ${12 * S}px system-ui, sans-serif`; const w = ctx.measureText(st[0]).width + 34 * S;
  panel(x - w, y, w, 28 * S, 14 * S); ctx.globalAlpha = pulse; ctx.fillStyle = st[1]; ctx.beginPath(); ctx.arc(x - w + 14 * S, y + 14 * S, 4 * S, 0, 7); ctx.fill(); txt(st[0], x - w + 24 * S, y + 14.5 * S, 12, st[1], 'left', 800); ctx.globalAlpha = 1;
  let yy = y + 36 * S;
  const masked = G.t < G.mask.until;
  if (masked) { const k = (G.mask.until - G.t) / G.mask.len; const w2 = 196 * S; panel(x - w2, yy, w2, 34 * S, 10 * S); txt('SOUND MASKED', x - w2 + 12 * S, yy + 12 * S, 11.5, GRN, 'left', 800); txt(G.mask.kind, x - 12 * S, yy + 12 * S, 10.5, 'rgba(244,236,210,0.6)', 'right', 700); ctx.fillStyle = 'rgba(125,255,138,0.2)'; rr(x - w2 + 12 * S, yy + 22 * S, w2 - 24 * S, 4 * S, 2 * S); ctx.fill(); ctx.fillStyle = GRN; rr(x - w2 + 12 * S, yy + 22 * S, (w2 - 24 * S) * k, 4 * S, 2 * S); ctx.fill(); yy += 40 * S; }
  else if (G.mask.warnAt && G.t > G.mask.warnAt - 3.5 && G.t < G.mask.warnAt) { const w2 = 196 * S; panel(x - w2, yy, w2, 26 * S, 10 * S); txt(G.mask.warnKind, x - w2 + 12 * S, yy + 13 * S, 11, '#cfe8ff', 'left', 700); yy += 32 * S; }
  if (G.shotHeardT.length && G.alarm !== 'alarm') { const n = G.shotHeardT.filter((t) => G.t - t < 60).length; if (n) { const w2 = 196 * S; panel(x - w2, yy, w2, 26 * S, 10 * S); txt(`Unmasked shots heard: ${n}/3`, x - w2 + 12 * S, yy + 13 * S, 11, AMB, 'left', 700); yy += 32 * S; } }
  if (G.heliState !== 'idle') { const w2 = 196 * S; panel(x - w2, yy, w2, 26 * S, 10 * S); txt(G.heliState === 'lift' ? 'Helicopter lifting off!' : 'Helicopter spooling up', x - w2 + 12 * S, yy + 13 * S, 11, RED, 'left', 800); }
}
function drawAmmo() {
  const w = 210 * S, h = 74 * S, x = W - (REF.touch ? 130 : 18) * S, y = REF.touch ? 64 * S + h + (G.t < G.mask.until || G.heliState !== 'idle' ? 34 * S : 0) : H - 18 * S; panel(x - w, y - h, w, h, 12 * S);
  const A = AMMO[P.magType]; txt(A.label.toUpperCase(), x - w + 14 * S, y - h + 18 * S, 11, P.magType === 'sub' ? '#9fd6ff' : AMB, 'left', 800);
  txt(P.magType === 'sub' ? 'quiet / heavy drop' : 'fast / loud', x - 14 * S, y - h + 18 * S, 10.5, 'rgba(244,236,210,0.55)', 'right', 700);
  for (let i = 0; i < 5; i++) { const bx = x - w + 14 * S + i * 15 * S, by = y - h + 32 * S; ctx.fillStyle = i < P.mag ? (P.magType === 'sub' ? '#9fd6ff' : '#e8c070') : 'rgba(255,255,255,0.12)'; rr(bx, by, 9 * S, 24 * S, 3 * S); ctx.fill(); }
  txt(`${P.ammo[P.magType]}`, x - 60 * S, y - h + 46 * S, 22, INK, 'right', 800); txt('reserve', x - 14 * S, y - h + 48 * S, 10, 'rgba(244,236,210,0.5)', 'right', 700);
  const other = P.magType === 'super' ? 'sub' : 'super'; txt(`[B] ${AMMO[other].short}: ${P.ammo[other]}`, x - w + 14 * S, y - 10 * S, 10, 'rgba(244,236,210,0.5)', 'left', 700);
  txt(`${ZOOMS[P.zoomI]}x`, x - 14 * S, y - 10 * S, 10, 'rgba(244,236,210,0.5)', 'right', 700);
}
function drawStance() {
  const w = 200 * S, h = 74 * S, x = 18 * S, y = REF.touch ? (16 + 44 + G.agents.filter((a) => a.isTarget).length * 34 + 10) * S + h : H - 18 * S; panel(x, y - h, w, h, 12 * S);
  // silhouette
  ctx.save(); ctx.translate(x + 34 * S, y - 22 * S); ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 4 * S; ctx.lineCap = 'round';
  if (P.stance === 0) { ctx.beginPath(); ctx.arc(0, -36 * S, 4.5 * S, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -30 * S); ctx.lineTo(0, -14 * S); ctx.lineTo(-4 * S, 0); ctx.moveTo(0, -14 * S); ctx.lineTo(4 * S, 0); ctx.moveTo(0, -26 * S); ctx.lineTo(9 * S, -22 * S); ctx.stroke(); }
  else if (P.stance === 1) { ctx.beginPath(); ctx.arc(2 * S, -26 * S, 4.5 * S, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -20 * S); ctx.lineTo(-3 * S, -8 * S); ctx.lineTo(6 * S, -6 * S); ctx.lineTo(4 * S, 0); ctx.moveTo(-3 * S, -8 * S); ctx.lineTo(-8 * S, 0); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(14 * S, -6 * S, 4.5 * S, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(8 * S, -4 * S); ctx.lineTo(-16 * S, -2 * S); ctx.stroke(); }
  ctx.restore();
  txt(STANCE[P.stance].name.toUpperCase(), x + 64 * S, y - h + 18 * S, 11, INK, 'left', 800);
  txt(P.inLight ? 'In the light!' : P.inBush ? 'In cover' : 'In the open', x + w - 12 * S, y - h + 18 * S, 10, P.inLight ? RED : P.inBush ? GRN : 'rgba(244,236,210,0.55)', 'right', 700);
  // visibility meter
  const mx = x + 64 * S, my = y - h + 36 * S, mw = w - 78 * S; txt('VISIBILITY', mx, my, 9.5, 'rgba(244,236,210,0.5)', 'left', 800);
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(mx, my + 8 * S, mw, 6 * S, 3 * S); ctx.fill();
  const v = P.vis; ctx.fillStyle = v > 0.55 ? RED : v > 0.25 ? AMB : GRN; rr(mx, my + 8 * S, Math.max(4 * S, mw * v), 6 * S, 3 * S); ctx.fill();
  // health
  const hk = P.hp / P.max; ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(mx, my + 22 * S, mw, 4 * S, 2 * S); ctx.fill(); ctx.fillStyle = hk < 0.35 ? RED : '#e8e0c8'; rr(mx, my + 22 * S, mw * hk, 4 * S, 2 * S); ctx.fill();
}
function drawPopups() {
  let y = H * 0.68;
  for (const p of G.popups) { const a = Math.min(1, p.t * 2, (2.4 - p.age) * 2); if (a <= 0) continue; ctx.globalAlpha = Math.max(0, a); txt(p.text, W / 2, y, 20, p.col, 'center', 900); if (p.sub) txt(p.sub, W / 2, y + 20 * S, 12, 'rgba(244,236,210,0.8)', 'center', 700); ctx.globalAlpha = 1; y += 46 * S; }
}
function drawBanner() {
  const b = G.banner; if (!b || b.t <= 0) return; const a = Math.min(1, b.t);
  ctx.globalAlpha = a; const y = H * 0.24; const g = ctx.createLinearGradient(W / 2 - 300 * S, 0, W / 2 + 300 * S, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(W / 2 - 300 * S, y - 30 * S, 600 * S, 62 * S);
  txt(b.text, W / 2, y - 6 * S, 24, b.col, 'center', 900); if (b.sub) txt(b.sub, W / 2, y + 18 * S, 12.5, 'rgba(244,236,210,0.85)', 'center', 700); ctx.globalAlpha = 1;
}
function drawDamage() {
  if (G.dmgT > 0) { const k = Math.min(1, G.dmgT); const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(150,0,0,${0.55 * k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const ang = angDiff(G.dmgDir, P.yaw + Math.PI); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-ang); ctx.strokeStyle = `rgba(255,60,40,${k})`; ctx.lineWidth = 6 * S; ctx.beginPath(); ctx.arc(0, 0, Math.min(W, H) * 0.24, -Math.PI / 2 - 0.3, -Math.PI / 2 + 0.3); ctx.stroke(); ctx.restore(); }
  if (P.hp < P.max * 0.4) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(90,0,0,${0.35 * (1 - P.hp / (P.max * 0.4))})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
}

// ---------- kill cam overlay ----------
function drawKillcam() {
  const k = G.killcam; const bar = H * 0.1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
  txt(`${Math.round(k.dist)} m`, W - 30 * S, H - bar / 2, 18, AMB, 'right', 900, 'ui-monospace, Menlo, monospace');
  txt(k.agent.isTarget ? k.agent.name.toUpperCase() : 'KILL CAM', 30 * S, H - bar / 2, 14, k.agent.isTarget ? GOLD : INK, 'left', 900);
  txt('click to skip', W / 2, H - bar / 2, 11, 'rgba(244,236,210,0.4)', 'center', 700);
}

// ---------- tactical map ----------
function drawMap() {
  ctx.fillStyle = 'rgba(4,6,8,0.82)'; ctx.fillRect(0, 0, W, H);
  const x0 = -150, x1 = 150, z0 = -175, z1 = 125; const sc = Math.min((W * 0.9) / (x1 - x0), (H * 0.84) / (z1 - z0)); const ox = W / 2 - (x0 + x1) / 2 * sc, oz = H * 0.53 - (z0 + z1) / 2 * sc;
  // map is drawn with north (the ridge) at the BOTTOM so it matches the player's view south
  const mx = (x) => W - (ox + x * sc), mz = (z) => H - (oz + z * sc);
  // ridge band
  ctx.strokeStyle = 'rgba(125,255,138,0.25)'; ctx.lineWidth = 2 * S; ctx.beginPath(); for (let x = x0; x <= x1; x += 5) { const z = RIDGE_Z(x); x === x0 ? ctx.moveTo(mx(x), mz(z)) : ctx.lineTo(mx(x), mz(z)); } ctx.stroke();
  txt('YOUR RIDGE', mx(0), mz(RIDGE_Z(0)) + 16 * S, 10, 'rgba(125,255,138,0.6)', 'center', 800);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([4 * S, 4 * S]); ctx.strokeRect(mx(FENCE.x1), mz(FENCE.z1), (FENCE.x1 - FENCE.x0) * sc, (FENCE.z1 - FENCE.z0) * sc); ctx.setLineDash([]);
  for (const b of BOXES) { if (b.kind === 'parapet' || b.kind === 'roof') continue; ctx.fillStyle = b.kind === 'crate' || b.kind === 'sandbag' ? 'rgba(160,140,100,0.5)' : 'rgba(200,190,170,0.35)'; ctx.fillRect(mx(b.x1), mz(b.z1), (b.x1 - b.x0) * sc, (b.z1 - b.z0) * sc); }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(mx(HELI.x), mz(HELI.z), 11 * sc, 0, 7); ctx.stroke(); txt('H', mx(HELI.x), mz(HELI.z), 12, 'rgba(255,255,255,0.6)', 'center', 900);
  for (const a of G.agents) {
    if (!a.tagged || a.gone) continue; const x = mx(a.x), y = mz(a.z);
    if (a.dead) { txt('x', x, y, 12, a.isTarget ? GOLD : 'rgba(255,255,255,0.4)', 'center', 900); continue; }
    const col = a.isTarget ? GOLD : a.mode === 'combat' ? RED : a.meter > 0.42 ? AMB : '#fff';
    if (!a.isTarget && !a.hidden) { const f = a.yaw + a.headYaw; ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(x, y); const r = 26 * sc * (a.kind === 'tower' ? 2 : 1); for (let k = -0.6; k <= 0.61; k += 0.2) ctx.lineTo(x - Math.sin(f + k) * r, y - Math.cos(f + k) * r); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = a.hidden ? 0.4 : 1; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, (a.isTarget ? 4.5 : 3.2) * S, 0, 7); ctx.fill(); if (a.isTarget) txt(a.name, x, y - 11 * S, 10.5, GOLD, 'center', 800); ctx.globalAlpha = 1;
  }
  // player
  const px = mx(P.x), py = mz(P.z); ctx.fillStyle = GRN; ctx.save(); ctx.translate(px, py); ctx.rotate(-P.yaw); ctx.beginPath(); ctx.moveTo(0, 8 * S); ctx.lineTo(5 * S, -5 * S); ctx.lineTo(-5 * S, -5 * S); ctx.closePath(); ctx.fill(); ctx.restore();
  txt('TACTICAL MAP', W / 2, 30 * S, 14, AMB, 'center', 900); txt('Only tagged people show up here. Tag with the binoculars [F].', W / 2, 50 * S, 11.5, 'rgba(244,236,210,0.6)', 'center', 700);
}
