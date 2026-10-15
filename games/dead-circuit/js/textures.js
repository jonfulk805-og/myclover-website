// Procedural canvas textures - no external image assets needed.
import * as THREE from 'three';

let ANISO = 4;
export function setAniso(a) { ANISO = a; }

// deterministic RNG
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

function toTex(c, repeat = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = ANISO;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// value-noise helper for organic variation
function noiseField(w, h, cell, R) {
  const gw = Math.ceil(w / cell) + 1, gh = Math.ceil(h / cell) + 1;
  const g = new Float32Array(gw * gh).map(() => R());
  // make tileable: wrap last row/col to first
  for (let y = 0; y < gh; y++) g[y * gw + gw - 1] = g[y * gw];
  for (let x = 0; x < gw; x++) g[(gh - 1) * gw + x] = g[x];
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function speckle(ctx, w, h, n, R, colors, rmin = 0.5, rmax = 1.6) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(R() * colors.length) | 0];
    const r = rmin + R() * (rmax - rmin);
    ctx.fillRect(R() * w, R() * h, r, r);
  }
}

function fbmFill(ctx, w, h, R, base, amp, cells = [64, 24, 8]) {
  const img = ctx.createImageData(w, h); const d = img.data;
  const fs = cells.map(c => noiseField(w, h, c, R));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0, a = 1, s = 0;
    for (const f of fs) { n += f(x, y) * a; s += a; a *= 0.55; }
    n = n / s - 0.5;
    const i = (y * w + x) * 4;
    d[i] = base[0] + n * amp[0]; d[i + 1] = base[1] + n * amp[1]; d[i + 2] = base[2] + n * amp[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

const cache = {};
function cached(key, fn) { return cache[key] || (cache[key] = fn()); }

export function asphalt() {
  return cached('asphalt', () => {
    const R = rng(11), W = 512, H = 512; const [c, x] = canvas(W, H);
    fbmFill(x, W, H, R, [62, 63, 66], [38, 38, 40]);
    speckle(x, W, H, 9000, R, ['#2a2b2e', '#77787c', '#4a4b4f', '#8c8a84'], 0.6, 1.8);
    // cracks
    x.strokeStyle = 'rgba(20,20,22,0.55)'; x.lineWidth = 1.2;
    for (let k = 0; k < 9; k++) {
      let px = R() * W, py = R() * H; x.beginPath(); x.moveTo(px, py);
      for (let s = 0; s < 14; s++) { px += (R() - 0.5) * 30; py += (R() - 0.3) * 22; x.lineTo(px, py); }
      x.stroke();
    }
    // tar patches
    x.fillStyle = 'rgba(25,25,28,0.35)';
    for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(R() * W, R() * H, 20 + R() * 40, 8 + R() * 18, R() * 3, 0, 7); x.fill(); }
    return c;
  });
}

export function concrete() {
  return cached('concrete', () => {
    const R = rng(23), W = 256, H = 256; const [c, x] = canvas(W, H);
    fbmFill(x, W, H, R, [178, 174, 166], [36, 34, 30]);
    speckle(x, W, H, 2500, R, ['#9a968e', '#c9c5bc', '#8a867e'], 0.5, 1.4);
    x.strokeStyle = 'rgba(70,66,60,0.6)'; x.lineWidth = 2;
    x.strokeRect(1, 1, W - 2, H - 2);
    x.beginPath(); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke();
    return c;
  });
}

export function grass(variant = 0) {
  return cached('grass' + variant, () => {
    const R = rng(37 + variant), W = 512, H = 512; const [c, x] = canvas(W, H);
    const bases = [[74, 128, 46], [86, 136, 44], [104, 128, 52]];
    fbmFill(x, W, H, R, bases[variant % 3], [50, 60, 34], [96, 32, 10]);
    for (let i = 0; i < 26000; i++) {
      const g = 90 + R() * 90; x.strokeStyle = `rgba(${(g * 0.45) | 0},${g | 0},${(g * 0.3) | 0},0.55)`;
      const px = R() * W, py = R() * H; x.lineWidth = 1;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 3, py - 2 - R() * 5); x.stroke();
    }
    // mow stripes
    for (let s = 0; s < W; s += 64) { x.fillStyle = 'rgba(255,255,200,0.035)'; x.fillRect(s, 0, 32, H); }
    // clover/flowers
    speckle(x, W, H, 260, R, ['#f3eecf', '#f1d34a', '#e8e3f5'], 1, 2.2);
    return c;
  });
}

export function soil() {
  return cached('soil', () => {
    const R = rng(41), W = 256, H = 256; const [c, x] = canvas(W, H);
    fbmFill(x, W, H, R, [86, 62, 42], [40, 30, 22]);
    speckle(x, W, H, 3000, R, ['#3e2b1c', '#6b5238', '#a08260'], 0.6, 2);
    return c;
  });
}

export function roofShingle(hex) {
  return cached('roof' + hex, () => {
    const R = rng(53 + parseInt(hex.slice(1), 16) % 997), W = 256, H = 256; const [c, x] = canvas(W, H);
    const col = new THREE.Color(hex);
    const rowH = 16;
    for (let y = 0; y < H; y += rowH) {
      const off = ((y / rowH) % 2) * 16;
      for (let xx = -32; xx < W + 32; xx += 32) {
        const v = 0.78 + R() * 0.32;
        x.fillStyle = `rgb(${(col.r * 255 * v) | 0},${(col.g * 255 * v) | 0},${(col.b * 255 * v) | 0})`;
        x.fillRect(xx + off, y, 31, rowH - 1);
      }
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, y + rowH - 2, W, 2);
    }
    speckle(x, W, H, 1800, R, ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.05)'], 0.5, 1.2);
    return c;
  });
}

export function siding(hex) {
  return cached('siding' + hex, () => {
    const R = rng(67 + parseInt(hex.slice(1), 16) % 991), W = 256, H = 256; const [c, x] = canvas(W, H);
    const col = new THREE.Color(hex);
    x.fillStyle = hex; x.fillRect(0, 0, W, H);
    const bh = 16;
    for (let y = 0; y < H; y += bh) {
      const g = x.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0, `rgba(255,255,255,0.10)`); g.addColorStop(0.85, 'rgba(0,0,0,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0.30)');
      x.fillStyle = g; x.fillRect(0, y, W, bh);
    }
    speckle(x, W, H, 1400, R, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.06)'], 0.5, 2);
    // weathering streaks
    for (let i = 0; i < 18; i++) { x.fillStyle = 'rgba(60,50,40,0.05)'; x.fillRect(R() * W, R() * H * 0.5, 1 + R() * 3, 30 + R() * 80); }
    void col;
    return c;
  });
}

export function brick() {
  return cached('brick', () => {
    const R = rng(71), W = 256, H = 256; const [c, x] = canvas(W, H);
    x.fillStyle = '#b8ada0'; x.fillRect(0, 0, W, H);
    const bw = 32, bh = 12;
    for (let y = 0; y < H; y += bh) {
      const off = ((y / bh) % 2) * 16;
      for (let xx = -32; xx < W + 32; xx += bw) {
        const v = 0.75 + R() * 0.35;
        x.fillStyle = `rgb(${(152 * v) | 0},${(70 * v) | 0},${(52 * v) | 0})`;
        x.fillRect(xx + off + 1, y + 1, bw - 2, bh - 2);
      }
    }
    speckle(x, W, H, 2000, R, ['rgba(0,0,0,0.2)', 'rgba(255,220,200,0.15)'], 0.5, 1.5);
    return c;
  });
}

export function rustMetal(hex = '#6f7468') {
  return cached('rust' + hex, () => {
    const R = rng(83 + parseInt(hex.slice(1), 16) % 983), W = 256, H = 256; const [c, x] = canvas(W, H);
    const col = new THREE.Color(hex);
    fbmFill(x, W, H, R, [col.r * 255, col.g * 255, col.b * 255], [40, 40, 40], [48, 16, 6]);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${130 + R() * 50},${60 + R() * 30},${25},${0.25 + R() * 0.35})`;
      x.beginPath(); x.ellipse(R() * W, R() * H, 4 + R() * 18, 3 + R() * 10, R() * 3, 0, 7); x.fill();
    }
    // panel seams + rivets
    x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 2;
    for (let i = 0; i <= W; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    x.fillStyle = 'rgba(220,220,210,0.35)';
    for (let i = 6; i < W; i += 64) for (let j = 6; j < H; j += 16) { x.fillRect(i, j, 2, 2); x.fillRect(i + 52, j, 2, 2); }
    // scratches
    x.strokeStyle = 'rgba(230,230,220,0.18)'; x.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const a = R() * W, b = R() * H; x.beginPath(); x.moveTo(a, b); x.lineTo(a + (R() - 0.5) * 40, b + (R() - 0.5) * 20); x.stroke(); }
    return c;
  });
}

export function droneHull() {
  return cached('dronehull', () => {
    const R = rng(97), W = 256, H = 256; const [c, x] = canvas(W, H);
    fbmFill(x, W, H, R, [54, 62, 66], [14, 14, 16], [64, 16]);
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { const a = R() * W, b = R() * H; x.strokeRect(a, b, 30 + R() * 60, 20 + R() * 40); }
    x.fillStyle = '#d8a35a'; x.fillRect(0, 118, W, 8);
    x.fillStyle = 'rgba(0,0,0,0.6)'; for (let i = 0; i < W; i += 16) { x.beginPath(); x.moveTo(i, 118); x.lineTo(i + 8, 118); x.lineTo(i, 126); x.fill(); }
    return c;
  });
}

export function wood() {
  return cached('wood', () => {
    const R = rng(101), W = 128, H = 256; const [c, x] = canvas(W, H);
    fbmFill(x, W, H, R, [236, 232, 222], [18, 18, 18], [32, 8]);
    for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(120,110,95,0.12)'; x.beginPath(); x.moveTo(R() * W, 0); x.lineTo(R() * W, H); x.stroke(); }
    return c;
  });
}

export function bark() {
  return cached('bark', () => {
    const R = rng(103), W = 128, H = 256; const [c, x] = canvas(W, H);
    fbmFill(x, W, H, R, [92, 72, 56], [40, 32, 26], [24, 8, 3]);
    for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(30,22,16,${0.3 + R() * 0.4})`; x.lineWidth = 1 + R() * 2; const a = R() * W; x.beginPath(); x.moveTo(a, 0); x.bezierCurveTo(a + 6, H * 0.3, a - 6, H * 0.6, a + (R() - 0.5) * 8, H); x.stroke(); }
    return c;
  });
}

export function leaves(hue) {
  return cached('leaves' + hue, () => {
    const R = rng(107 + hue), W = 256, H = 256; const [c, x] = canvas(W, H);
    x.fillStyle = `hsl(${hue},45%,22%)`; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      const l = 18 + R() * 34, s = 35 + R() * 30;
      x.fillStyle = `hsl(${hue + (R() - 0.5) * 18},${s}%,${l}%)`;
      x.beginPath(); x.ellipse(R() * W, R() * H, 2 + R() * 4, 1.2 + R() * 2.2, R() * 3, 0, 7); x.fill();
    }
    return c;
  });
}

export function scorch() {
  return cached('scorch', () => {
    const R = rng(109), W = 256, H = 256; const [c, x] = canvas(W, H);
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(8,6,5,0.95)'); g.addColorStop(0.45, 'rgba(15,12,10,0.75)'); g.addColorStop(1, 'rgba(20,18,16,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { const a = R() * 7, r = 40 + R() * 80; x.fillStyle = 'rgba(10,8,6,0.35)'; x.beginPath(); x.ellipse(128 + Math.cos(a) * r * 0.6, 128 + Math.sin(a) * r * 0.6, 4 + R() * 14, 2 + R() * 6, a, 0, 7); x.fill(); }
    return c;
  });
}

export function softDot() {
  return cached('softdot', () => {
    const [c, x] = canvas(64, 64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c;
  });
}

export function smokePuff() {
  return cached('smoke', () => {
    const R = rng(113), [c, x] = canvas(128, 128);
    for (let i = 0; i < 22; i++) {
      const a = R() * 7, r = R() * 30, px = 64 + Math.cos(a) * r, py = 64 + Math.sin(a) * r, s = 16 + R() * 26;
      const g = x.createRadialGradient(px, py, 0, px, py, s);
      g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    return c;
  });
}

export function windowTex(lit) {
  return cached('win' + lit, () => {
    const [c, x] = canvas(64, 64);
    const g = x.createLinearGradient(0, 0, 64, 64);
    if (lit === 'hostile') { g.addColorStop(0, '#0e2a12'); g.addColorStop(1, '#174d1c'); }
    else { g.addColorStop(0, '#9fc3d8'); g.addColorStop(0.5, '#3d5868'); g.addColorStop(1, '#22323c'); }
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.beginPath(); x.moveTo(6, 6); x.lineTo(26, 6); x.lineTo(6, 30); x.fill();
    x.fillStyle = '#f2efe6'; x.fillRect(30, 0, 4, 64); x.fillRect(0, 30, 64, 4);
    x.strokeStyle = '#f2efe6'; x.lineWidth = 6; x.strokeRect(0, 0, 64, 64);
    return c;
  });
}

export function boardedWindow(glow = false) {
  return cached('boarded' + glow, () => {
    const R = rng(127), [c, x] = canvas(64, 64);
    x.fillStyle = glow ? '#ffffff' : '#1d5a24'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 3; i++) {
      x.save(); x.translate(32, 12 + i * 20); x.rotate((R() - 0.5) * 0.5);
      x.fillStyle = glow ? '#000' : `rgb(${120 + R() * 30},${92 + R() * 20},${60})`; x.fillRect(-36, -6, 72, 12);
      x.fillStyle = glow ? '#000' : '#333'; x.fillRect(-30, -2, 3, 3); x.fillRect(27, -2, 3, 3); x.restore();
    }
    return c;
  });
}

export function T(name, repeat, ...args) {
  const fn = { asphalt, concrete, grass, soil, roofShingle, siding, brick, rustMetal, droneHull, wood, bark, leaves, scorch, softDot, smokePuff, windowTex, boardedWindow }[name];
  const key = name + JSON.stringify(args) + JSON.stringify(repeat || [1, 1]);
  return cached('T' + key, () => toTex(fn(...args), repeat || [1, 1]));
}

// road marking strip texture (dashed centre + edge lines), 1 x N tile
export function roadLines() {
  return cached('Troadlines', () => {
    const [c, x] = canvas(128, 512);
    x.clearRect(0, 0, 128, 512);
    x.fillStyle = 'rgba(240,196,64,0.92)'; x.fillRect(58, 0, 4, 512); x.fillRect(66, 0, 4, 512); // double yellow
    x.fillStyle = 'rgba(245,245,240,0.9)'; x.fillRect(4, 0, 4, 512); x.fillRect(120, 0, 4, 512);
    const t = toTex(c, [1, 1]); return t;
  });
}
