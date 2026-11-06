// DEAD ACRES - procedural farm/horror textures (canvas). No image files.
import * as THREE from 'three';
import { canvas, toTex, speckle, fbmFill, cached, rng } from './textures.js';

const C = (hex) => new THREE.Color(hex);
const rgb = (c, v = 1, a = 1) => `rgba(${(c.r * 255 * v) | 0},${(c.g * 255 * v) | 0},${(c.b * 255 * v) | 0},${a})`;

// weathered plank boards. vertical = boards run up/down
export function planks(hex, seed = 1, vertical = false, gaps = 0.5) {
  return cached('planks' + hex + seed + vertical, () => {
    const R = rng(200 + seed), W = 256, H = 256; const [c, x] = canvas(W, H);
    const col = C(hex); fbmFill(x, W, H, R, [col.r * 255, col.g * 255, col.b * 255], [46, 40, 34], [64, 16, 4]);
    const bw = 32;
    x.save(); if (vertical) { x.translate(W, 0); x.rotate(Math.PI / 2); }
    for (let y = 0; y < H; y += bw) {
      const v = 0.78 + R() * 0.34; x.fillStyle = rgb(col, v, 0.55); x.fillRect(0, y, W, bw);
      // grain
      for (let k = 0; k < 14; k++) { x.strokeStyle = `rgba(30,18,10,${0.08 + R() * 0.14})`; x.lineWidth = 0.6 + R(); const yy = y + R() * bw; x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(W * 0.3, yy + (R() - 0.5) * 6, W * 0.7, yy + (R() - 0.5) * 6, W, yy + (R() - 0.5) * 3); x.stroke(); }
      // knots
      if (R() < 0.6) { const kx = R() * W, ky = y + 6 + R() * (bw - 12); const g = x.createRadialGradient(kx, ky, 0, kx, ky, 7); g.addColorStop(0, 'rgba(25,14,8,0.8)'); g.addColorStop(1, 'rgba(25,14,8,0)'); x.fillStyle = g; x.fillRect(kx - 9, ky - 9, 18, 18); }
      // seam + end joints + nails
      x.fillStyle = `rgba(8,5,3,${gaps})`; x.fillRect(0, y + bw - 2, W, 2);
      const j = R() * W; x.fillRect(j, y, 2, bw);
      x.fillStyle = 'rgba(40,40,44,0.8)'; x.fillRect(j - 6, y + 6, 2, 2); x.fillRect(j + 6, y + bw - 9, 2, 2);
    }
    x.restore();
    speckle(x, W, H, 1600, R, ['rgba(0,0,0,0.12)', 'rgba(255,240,220,0.06)'], 0.5, 1.6);
    // grime at the bottom
    const g = x.createLinearGradient(0, H * 0.6, 0, H); g.addColorStop(0, 'rgba(20,14,8,0)'); g.addColorStop(1, 'rgba(20,14,8,0.25)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    return c;
  });
}

export function wallpaper() {
  return cached('wallpaper', () => {
    const R = rng(301), W = 256, H = 256; const [c, x] = canvas(W, H);
    fbmFill(x, W, H, R, [118, 112, 84], [30, 28, 22], [64, 20]);
    // faded damask stripes + tiny clovers
    for (let i = 0; i < W; i += 32) { x.fillStyle = 'rgba(70,60,40,0.18)'; x.fillRect(i, 0, 3, H); x.fillRect(i + 12, 0, 1, H); }
    x.fillStyle = 'rgba(60,80,48,0.35)';
    for (let yy = 8; yy < H; yy += 32) for (let xx = 22; xx < W; xx += 32) for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(xx + Math.cos(k * 1.57) * 3, yy + 16 + Math.sin(k * 1.57) * 3, 2.6, 0, 7); x.fill(); }
    // water stains, peeling
    for (let i = 0; i < 6; i++) { const px = R() * W, py = R() * H * 0.5; const g = x.createRadialGradient(px, py, 0, px, py, 30 + R() * 50); g.addColorStop(0, 'rgba(70,50,20,0.25)'); g.addColorStop(0.8, 'rgba(70,50,20,0.12)'); g.addColorStop(1, 'rgba(70,50,20,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(30,22,14,0.08)'; x.fillRect(R() * W, R() * H, 1 + R() * 2, 20 + R() * 60); }
    // wainscot band bottom third
    x.fillStyle = 'rgba(55,36,22,0.92)'; x.fillRect(0, H * 0.7, W, H * 0.3);
    x.fillStyle = 'rgba(20,12,6,0.6)'; for (let i = 0; i < W; i += 21) x.fillRect(i, H * 0.7, 2, H * 0.3);
    x.fillStyle = 'rgba(160,120,80,0.35)'; x.fillRect(0, H * 0.7, W, 3);
    return c;
  });
}

export function dirt(seed = 0) {
  return cached('dirt' + seed, () => {
    const R = rng(401 + seed), W = 512, H = 512; const [c, x] = canvas(W, H);
    fbmFill(x, W, H, R, [70, 58, 42], [52, 40, 30], [128, 48, 12]);
    // patchy dead grass
    for (let i = 0; i < 14000; i++) { const g = 60 + R() * 70; x.strokeStyle = `rgba(${(g * 0.9) | 0},${(g * 0.85) | 0},${(g * 0.45) | 0},0.4)`; const px = R() * W, py = R() * H; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 4, py - 2 - R() * 4); x.stroke(); }
    // tyre ruts/footprints
    speckle(x, W, H, 5000, R, ['#2c2219', '#5b4a37', '#8a7860', '#1d1712'], 0.6, 2.4);
    for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(25,20,15,0.18)'; x.beginPath(); x.ellipse(R() * W, R() * H, 20 + R() * 60, 8 + R() * 20, R() * 3, 0, 7); x.fill(); }
    return c;
  });
}

export function hayFloor() {
  return cached('hay', () => {
    const R = rng(501), W = 512, H = 512; const [c, x] = canvas(W, H);
    fbmFill(x, W, H, R, [92, 70, 44], [34, 26, 20], [64, 20]);
    for (let i = 0; i < 9000; i++) { const g = 150 + R() * 90; x.strokeStyle = `rgba(${g | 0},${(g * 0.82) | 0},${(g * 0.42) | 0},${0.35 + R() * 0.4})`; x.lineWidth = 0.6 + R() * 0.8; const px = R() * W, py = R() * H, a = R() * 6.28, l = 4 + R() * 14; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    return c;
  });
}

export function concreteDirty() {
  return cached('concd', () => {
    const R = rng(551), W = 256, H = 256; const [c, x] = canvas(W, H);
    fbmFill(x, W, H, R, [104, 102, 96], [40, 38, 34]);
    speckle(x, W, H, 3000, R, ['#55534e', '#8c8a84', '#3c3a36'], 0.5, 1.6);
    for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(30,25,20,0.25)'; x.beginPath(); x.ellipse(R() * W, R() * H, 10 + R() * 40, 6 + R() * 20, R() * 3, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(30,30,30,0.5)'; x.lineWidth = 1.2; for (let k = 0; k < 5; k++) { let px = R() * W, py = R() * H; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 10; s++) { px += (R() - 0.5) * 24; py += (R() - 0.5) * 24; x.lineTo(px, py); } x.stroke(); }
    return c;
  });
}

// corn stalk sprite (alpha), tall
export function cornStalk(seed = 0) {
  return cached('corn' + seed, () => {
    const R = rng(601 + seed), W = 128, H = 256; const [c, x] = canvas(W, H);
    x.clearRect(0, 0, W, H);
    for (let s = 0; s < 3; s++) {
      const bx = 30 + s * 34 + (R() - 0.5) * 10, lean = (R() - 0.5) * 14;
      x.strokeStyle = `hsl(${55 + R() * 15},${30 + R() * 15}%,${26 + R() * 10}%)`; x.lineWidth = 4;
      x.beginPath(); x.moveTo(bx, H); x.quadraticCurveTo(bx + lean * 0.4, H * 0.5, bx + lean, 14 + R() * 20); x.stroke();
      // leaves
      for (let k = 0; k < 7; k++) {
        const t = 0.15 + k * 0.11, py = H - t * (H - 20), px = bx + lean * t, dir = k % 2 ? 1 : -1, len = 34 + R() * 26;
        x.fillStyle = `hsl(${48 + R() * 22},${28 + R() * 20}%,${22 + R() * 14}%)`;
        x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + dir * len * 0.6, py - 22, px + dir * len, py + 6 + R() * 16); x.quadraticCurveTo(px + dir * len * 0.5, py - 10, px, py + 4); x.fill();
      }
      // ear
      if (R() < 0.8) { const py = H * 0.5 + R() * 30; x.fillStyle = '#7d6a33'; x.beginPath(); x.ellipse(bx + lean * 0.5 + 6, py, 4, 13, 0.3, 0, 7); x.fill(); x.fillStyle = '#c9a65a'; x.fillRect(bx + lean * 0.5 + 6, py - 18, 1, 6); }
      // tassel
      x.strokeStyle = '#9c8a50'; x.lineWidth = 1; for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(bx + lean, 20); x.lineTo(bx + lean + (R() - 0.5) * 16, 2 + R() * 10); x.stroke(); }
    }
    return c;
  });
}

export function bloodSplat(seed = 0) {
  return cached('blood' + seed, () => {
    const R = rng(701 + seed), W = 256, H = 256; const [c, x] = canvas(W, H);
    x.clearRect(0, 0, W, H);
    const blob = (px, py, r, a) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(70,0,0,${a})`); g.addColorStop(0.7, `rgba(95,4,4,${a * 0.9})`); g.addColorStop(1, 'rgba(90,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); };
    blob(128, 128, 56 + R() * 20, 0.95);
    for (let i = 0; i < 26; i++) { const a = R() * 6.28, d = 30 + R() * 90; blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 3 + R() * 12, 0.9); }
    for (let i = 0; i < 6; i++) { const a = R() * 6.28; x.strokeStyle = 'rgba(80,0,0,0.85)'; x.lineWidth = 3 + R() * 4; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(a) * (60 + R() * 60), 128 + Math.sin(a) * (60 + R() * 60)); x.stroke(); }
    return c;
  });
}

// cloth / skin for zombies
export function skin(hue, seed) {
  return cached('skin' + hue + seed, () => {
    const R = rng(801 + seed), W = 128, H = 128; const [c, x] = canvas(W, H);
    const base = new THREE.Color().setHSL(hue / 360, 0.14, 0.33);
    fbmFill(x, W, H, R, [base.r * 255, base.g * 255, base.b * 255], [50, 46, 40], [32, 12, 4]);
    for (let i = 0; i < 24; i++) { x.fillStyle = `rgba(${60 + R() * 60},${10 + R() * 20},${20 + R() * 30},${0.2 + R() * 0.3})`; x.beginPath(); x.ellipse(R() * W, R() * H, 2 + R() * 9, 2 + R() * 6, R() * 3, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(40,60,80,0.25)'; for (let i = 0; i < 12; i++) { let px = R() * W, py = R() * H; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 16; py += R() * 10; x.lineTo(px, py); } x.stroke(); }
    return c;
  });
}
export function face(seed) {
  return cached('face' + seed, () => {
    const R = rng(851 + seed), W = 256, H = 128; const [c, x] = canvas(W, H);
    // sphere UV: u around, v top->bottom. face centred at u=0.75 (+z after rotation)
    const base = new THREE.Color().setHSL((70 + R() * 40) / 360, 0.13, 0.33);
    fbmFill(x, W, H, R, [base.r * 255, base.g * 255, base.b * 255], [44, 40, 36], [32, 12, 4]);
    const fx = 192, fy = 64;
    // hair / scalp
    x.fillStyle = `rgba(${30 + R() * 40},${24 + R() * 20},${16},0.9)`; x.fillRect(0, 0, W, 26 + R() * 10);
    // sunken sockets
    for (const s of [-1, 1]) { const g = x.createRadialGradient(fx + s * 16, fy - 6, 0, fx + s * 16, fy - 6, 14); g.addColorStop(0, 'rgba(10,0,0,0.95)'); g.addColorStop(1, 'rgba(30,10,10,0)'); x.fillStyle = g; x.fillRect(fx + s * 16 - 16, fy - 22, 32, 32); }
    // mouth gash with teeth
    x.fillStyle = 'rgba(40,0,0,0.95)'; x.beginPath(); x.ellipse(fx, fy + 24, 15, 7, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(200,190,150,0.85)'; for (let i = -10; i <= 10; i += 5) { x.fillRect(fx + i, fy + 18, 3, 4 + R() * 3); }
    // nose cavity
    x.fillStyle = 'rgba(30,8,8,0.8)'; x.beginPath(); x.moveTo(fx - 4, fy + 10); x.lineTo(fx + 4, fy + 10); x.lineTo(fx, fy); x.fill();
    // wounds
    for (let i = 0; i < 4; i++) { x.fillStyle = `rgba(${90 + R() * 50},0,0,0.6)`; x.beginPath(); x.ellipse(R() * W, 30 + R() * 80, 3 + R() * 8, 2 + R() * 5, R() * 3, 0, 7); x.fill(); }
    return c;
  });
}
export function cloth(kind, seed = 0) {
  return cached('cloth' + kind + seed, () => {
    const R = rng(901 + seed), W = 128, H = 128; const [c, x] = canvas(W, H);
    if (kind === 'plaid') {
      const hues = [[120, 22, 20], [26, 50, 90], [40, 70, 38], [110, 80, 30]][seed % 4];
      x.fillStyle = `rgb(${hues})`; x.fillRect(0, 0, W, H);
      for (let i = 0; i < W; i += 32) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(i, 0, 12, H); x.fillRect(0, i, W, 12); x.fillStyle = 'rgba(255,240,200,0.12)'; x.fillRect(i + 20, 0, 3, H); x.fillRect(0, i + 20, W, 3); }
    } else if (kind === 'denim') {
      fbmFill(x, W, H, R, [52, 70, 98], [26, 30, 36], [32, 8, 2]);
      for (let i = 0; i < H; i += 2) { x.fillStyle = 'rgba(255,255,255,0.04)'; x.fillRect(0, i, W, 1); }
    } else if (kind === 'tee') {
      fbmFill(x, W, H, R, [118, 110, 92], [40, 40, 36], [32, 8]);
    } else if (kind === 'burlap') {
      fbmFill(x, W, H, R, [134, 108, 70], [30, 26, 20], [16, 4, 2]);
      for (let i = 0; i < W; i += 3) { x.fillStyle = 'rgba(40,28,16,0.35)'; x.fillRect(i, 0, 1, H); x.fillRect(0, i, W, 1); }
    } else { // work jacket
      fbmFill(x, W, H, R, [96, 82, 52], [30, 28, 20], [32, 8]);
    }
    // grime + blood
    for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(${20 + R() * 30},${10 + R() * 14},${6},${0.15 + R() * 0.25})`; x.beginPath(); x.ellipse(R() * W, R() * H, 3 + R() * 14, 2 + R() * 8, R() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(${70 + R() * 40},0,0,${0.5 + R() * 0.4})`; x.beginPath(); x.ellipse(R() * W, R() * H, 2 + R() * 10, 2 + R() * 6, R() * 3, 0, 7); x.fill(); }
    // rips
    x.fillStyle = 'rgba(15,8,6,0.8)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(R() * W, R() * H, 2 + R() * 5, 1 + R() * 2, R() * 3, 0, 7); x.fill(); }
    return c;
  });
}

// glowing sign / label with text (used for perk machines, wall-buy chalk tags)
export function labelTex(lines, opt = {}) {
  const key = 'lbl' + JSON.stringify([lines, opt]);
  return cached(key, () => {
    const W = opt.w || 256, H = opt.h || 128; const [c, x] = canvas(W, H);
    if (opt.bg) { x.fillStyle = opt.bg; x.fillRect(0, 0, W, H); } else x.clearRect(0, 0, W, H);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((l, i) => {
      x.font = `${l.w || 800} ${l.s || 36}px ${l.f || 'system-ui, Segoe UI, sans-serif'}`;
      if (l.glow) { x.shadowColor = l.glow; x.shadowBlur = 18; }
      x.fillStyle = l.c || '#fff'; x.fillText(l.t, W / 2, l.y ?? (H / (lines.length + 1)) * (i + 1));
      x.shadowBlur = 0;
    });
    if (opt.chalk) { // rough it up
      const R = rng(9); x.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(0,0,0,${R() * 0.6})`; x.fillRect(R() * W, R() * H, 1 + R() * 2, 1); }
      x.globalCompositeOperation = 'source-over';
    }
    return c;
  });
}

export function perkFront(name, sub, hex) {
  return cached('perk' + name, () => {
    const W = 256, H = 512; const [c, x] = canvas(W, H); const R = rng(name.length * 77);
    const col = C(hex);
    // body
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, rgb(col, 0.25)); g.addColorStop(0.5, rgb(col, 0.55)); g.addColorStop(1, rgb(col, 0.22)); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // logo panel
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(22, 40, W - 44, 220);
    x.strokeStyle = rgb(col, 1.4); x.lineWidth = 6; x.strokeRect(22, 40, W - 44, 220);
    // clover mark
    x.save(); x.translate(W / 2, 124); x.fillStyle = rgb(col, 1.6);
    for (let k = 0; k < 4; k++) { x.save(); x.rotate(k * Math.PI / 2 + Math.PI / 4); x.beginPath(); x.arc(0, -20, 19, 0, 7); x.arc(0, -20, 19, 0, 7); x.fill(); x.restore(); }
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.arc(0, 0, 8, 0, 7); x.fill(); x.restore();
    x.textAlign = 'center'; x.fillStyle = '#fff'; x.shadowColor = rgb(col, 1.6); x.shadowBlur = 16;
    x.font = '900 34px system-ui, Segoe UI, sans-serif'; x.fillText(name.toUpperCase(), W / 2, 214);
    x.shadowBlur = 0; x.font = '600 17px system-ui, Segoe UI, sans-serif'; x.fillStyle = 'rgba(255,255,255,0.8)'; x.fillText(sub, W / 2, 244);
    // vending slot + grille
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(40, 300, W - 80, 60);
    for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(40, 380 + i * 12, W - 80, 4); }
    x.fillStyle = rgb(col, 1.3); x.fillRect(W - 70, 310, 16, 40);
    // rust + scratches
    for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(${110 + R() * 40},${50 + R() * 20},20,${0.15 + R() * 0.3})`; x.beginPath(); x.ellipse(R() * W, R() * H, 2 + R() * 14, 2 + R() * 8, R() * 3, 0, 7); x.fill(); }
    return c;
  });
}
// emissive mask for the perk front: logo + text + slot light
export function perkGlow(name, sub, hex) {
  return cached('perkg' + name, () => {
    const W = 256, H = 512; const [c, x] = canvas(W, H); const col = C(hex);
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    x.strokeStyle = rgb(col, 1.6); x.lineWidth = 6; x.strokeRect(22, 40, W - 44, 220);
    x.save(); x.translate(W / 2, 124); x.fillStyle = rgb(col, 1.8);
    for (let k = 0; k < 4; k++) { x.save(); x.rotate(k * Math.PI / 2 + Math.PI / 4); x.beginPath(); x.arc(0, -20, 19, 0, 7); x.fill(); x.restore(); }
    x.restore();
    x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = '900 34px system-ui, Segoe UI, sans-serif'; x.fillText(name.toUpperCase(), W / 2, 214);
    x.fillStyle = rgb(col, 1.5); x.fillRect(W - 70, 310, 16, 40);
    return c;
  });
}

export function moonTex() {
  return cached('moon', () => {
    const R = rng(77), W = 256; const [c, x] = canvas(W, W);
    const g = x.createRadialGradient(128, 128, 30, 128, 128, 128); g.addColorStop(0, 'rgba(255,250,230,0.9)'); g.addColorStop(0.35, 'rgba(220,230,255,0.35)'); g.addColorStop(1, 'rgba(160,180,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, W);
    x.fillStyle = '#f4f0dc'; x.beginPath(); x.arc(128, 128, 40, 0, 7); x.fill();
    for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(150,145,130,${0.2 + R() * 0.3})`; const a = R() * 7, d = R() * 32; x.beginPath(); x.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 3 + R() * 9, 0, 7); x.fill(); }
    return c;
  });
}

export function star4() { // muzzle flash / power-up glint
  return cached('star4', () => {
    const [c, x] = canvas(128, 128);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,230,180,0.8)'); g.addColorStop(1, 'rgba(255,160,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(255,240,200,0.9)';
    for (let k = 0; k < 6; k++) { x.save(); x.translate(64, 64); x.rotate(k * Math.PI / 3 + 0.2); x.beginPath(); x.moveTo(-5, 0); x.lineTo(0, -62); x.lineTo(5, 0); x.fill(); x.restore(); }
    return c;
  });
}

export function powerIcon(kind) {
  return cached('pw' + kind, () => {
    const [c, x] = canvas(128, 128);
    x.clearRect(0, 0, 128, 128);
    x.translate(64, 64); x.fillStyle = '#9dff7a'; x.strokeStyle = '#eaffdf'; x.lineWidth = 5; x.shadowColor = '#5cff3a'; x.shadowBlur = 16;
    if (kind === 'ammo') { for (const dx of [-22, 0, 22]) { x.fillRect(dx - 7, -18, 14, 40); x.beginPath(); x.moveTo(dx - 7, -18); x.lineTo(dx, -36); x.lineTo(dx + 7, -18); x.fill(); } }
    else if (kind === 'insta') { x.beginPath(); x.arc(0, -8, 30, 0, 7); x.fill(); x.fillRect(-18, 10, 36, 24); x.fillStyle = '#0a1a06'; x.beginPath(); x.arc(-12, -8, 9, 0, 7); x.arc(12, -8, 9, 0, 7); x.fill(); x.fillRect(-12, 22, 6, 12); x.fillRect(0, 22, 6, 12); }
    else if (kind === 'double') { x.font = '900 64px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('x2', 0, 4); }
    else if (kind === 'nuke') { x.beginPath(); x.arc(0, 0, 12, 0, 7); x.fill(); for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 44, k * 2.094 - 0.5, k * 2.094 + 0.5); x.fill(); } }
    else if (kind === 'carpenter') { x.fillRect(-6, -10, 12, 50); x.fillRect(-30, -36, 60, 22); x.fillRect(16, -36, 14, 34); }
    return c;
  });
}

export const tex = (canvasEl, repeat = [1, 1], srgb = true) => toTex(canvasEl, repeat, srgb);
