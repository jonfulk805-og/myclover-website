// Procedural canvas textures: everything is painted at load, no image files.
import * as THREE from 'three';
import { srng, clamp } from './util.js';

const cache = new Map();
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}
export function memo(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

// value noise ----------------------------------------------------------
function noiseGrid(n, r) { const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = r(); return g; }
function vnoise(g, n, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = g[((yi % n + n) % n) * n + ((xi % n + n) % n)], b = g[((yi % n + n) % n) * n + (((xi + 1) % n + n) % n)];
  const c = g[(((yi + 1) % n + n) % n) * n + ((xi % n + n) % n)], d = g[(((yi + 1) % n + n) % n) * n + (((xi + 1) % n + n) % n)];
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function grain(ctx, w, h, amt, seed, scale = 1) {
  const r = srng(seed), g = noiseGrid(64, r), img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (vnoise(g, 64, x / (8 * scale), y / (8 * scale)) * 0.6 + vnoise(g, 64, x / (2 * scale), y / (2 * scale)) * 0.4 - 0.5) * amt + (r() - 0.5) * amt * 0.35;
    const i = (y * w + x) * 4; d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
}
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

// wood planks (floors, bar tops, walls) ---------------------------------
export function planks(key, { base = [28, 45, 22], plankW = 64, len = 512, seed = 3, gaps = true, w = 512, h = 512, rep = [4, 4], worn = 0.3 } = {}) {
  return memo('pl' + key, () => {
    const [c, x] = mk(w, h), r = srng(seed);
    const rows = Math.ceil(w / plankW);
    for (let i = 0; i < rows; i++) {
      const off = r() * len;
      for (let s = -1; s < 2; s++) {
        const y0 = s * len + off;
        const l = base[2] + (r() - 0.5) * 9, hh = base[0] + (r() - 0.5) * 8;
        x.fillStyle = hsl(hh, base[1], l); x.fillRect(i * plankW, y0, plankW, len);
        // grain streaks
        for (let k = 0; k < 26; k++) {
          const gx = i * plankW + r() * plankW; x.strokeStyle = `rgba(${r() < .5 ? '0,0,0' : '255,220,170'},${0.04 + r() * 0.07})`;
          x.lineWidth = 0.6 + r() * 1.6; x.beginPath(); x.moveTo(gx, y0);
          for (let yy = 0; yy <= len; yy += 32) x.lineTo(gx + Math.sin(yy * 0.02 + k) * (2 + r() * 3), y0 + yy); x.stroke();
        }
        // knots
        if (r() < 0.6) { const kx = i * plankW + plankW * (0.2 + r() * 0.6), ky = y0 + r() * len; const gr = x.createRadialGradient(kx, ky, 1, kx, ky, 9); gr.addColorStop(0, 'rgba(20,8,0,.7)'); gr.addColorStop(1, 'rgba(20,8,0,0)'); x.fillStyle = gr; x.beginPath(); x.ellipse(kx, ky, 6, 12, 0, 0, 7); x.fill(); }
        if (gaps) { x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(i * plankW, y0, plankW, 3); }
      }
      if (gaps) { x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(i * plankW, 0, 3, h); x.fillStyle = 'rgba(255,230,190,.08)'; x.fillRect(i * plankW + 3, 0, 2, h); }
    }
    // wear / scuffs in the middle
    for (let k = 0; k < 60 * worn; k++) { x.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; x.beginPath(); x.ellipse(r() * w, r() * h, 10 + r() * 40, 4 + r() * 12, r() * 3, 0, 7); x.fill(); }
    grain(x, w, h, 16, seed + 1);
    return tex(c, rep);
  });
}

export function brick(key, { base = [12, 45, 30], rep = [3, 2], seed = 5, mortar = '#2a2622' } = {}) {
  return memo('br' + key, () => {
    const W = 512, H = 512, [c, x] = mk(W, H), r = srng(seed);
    x.fillStyle = mortar; x.fillRect(0, 0, W, H);
    const bw = 64, bh = 32;
    for (let row = 0; row < H / bh; row++) for (let col = -1; col < W / bw + 1; col++) {
      const ox = (row % 2) * bw / 2;
      x.fillStyle = hsl(base[0] + (r() - .5) * 8, base[1] + (r() - .5) * 10, base[2] + (r() - .5) * 10);
      x.fillRect(col * bw + ox + 3, row * bh + 3, bw - 6, bh - 6);
      x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(col * bw + ox + 3, row * bh + 3, bw - 6, 3);
    }
    grain(x, W, H, 26, seed);
    return tex(c, rep);
  });
}

export function wallpaper(key, { bg = '#123a22', fg = 'rgba(200,170,90,.22)', rep = [6, 2], seed = 7 } = {}) {
  return memo('wp' + key, () => {
    const W = 256, H = 256, [c, x] = mk(W, H);
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.strokeStyle = fg; x.fillStyle = fg; x.lineWidth = 3;
    const motif = (cx, cy, s) => { // four-leaf damask motif
      for (let i = 0; i < 4; i++) { x.save(); x.translate(cx, cy); x.rotate(i * Math.PI / 2); x.beginPath(); x.ellipse(0, -s * 0.55, s * 0.32, s * 0.5, 0, 0, 7); x.fill(); x.restore(); }
      x.beginPath(); x.arc(cx, cy, s * 0.12, 0, 7); x.stroke();
    };
    motif(64, 64, 40); motif(192, 192, 40); motif(192, 64, 18); motif(64, 192, 18);
    x.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < W; i += 32) x.fillRect(i, 0, 2, H);
    grain(x, W, H, 18, seed);
    return tex(c, rep);
  });
}

export function panel(key, { base = [25, 40, 18], rep = [8, 1] } = {}) {
  return memo('pn' + key, () => {
    const W = 256, H = 256, [c, x] = mk(W, H), r = srng(11);
    x.fillStyle = hsl(...base); x.fillRect(0, 0, W, H);
    x.fillStyle = hsl(base[0], base[1], base[2] - 6); x.fillRect(0, 0, W, 14); x.fillRect(0, H - 22, W, 22);
    x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 3; x.strokeRect(24, 36, W - 48, H - 80);
    x.strokeStyle = 'rgba(255,220,170,.08)'; x.strokeRect(28, 40, W - 56, H - 88);
    for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(0,0,0,${.05 + r() * .06})`; x.beginPath(); const yy = r() * H; x.moveTo(0, yy); x.bezierCurveTo(80, yy + 6, 160, yy - 6, W, yy + 3); x.stroke(); }
    grain(x, W, H, 14, 12);
    return tex(c, rep);
  });
}

export function metal(key, { tint = [200, 30, 40], rep = [4, 1], corrugated = true, rust = .4 } = {}) {
  return memo('mt' + key, () => {
    const W = 256, H = 256, [c, x] = mk(W, H), r = srng(17);
    for (let i = 0; i < W; i++) { const v = corrugated ? Math.sin(i / W * Math.PI * 16) : 0; x.fillStyle = hsl(tint[0], tint[1] * 0.3, tint[2] + v * 12); x.fillRect(i, 0, 1, H); }
    for (let k = 0; k < 90 * rust; k++) { x.fillStyle = `rgba(${120 + r() * 60},${50 + r() * 30},10,${.15 + r() * .25})`; x.beginPath(); x.ellipse(r() * W, r() * H, 3 + r() * 20, 2 + r() * 30, 0, 0, 7); x.fill(); }
    grain(x, W, H, 20, 18);
    return tex(c, rep);
  });
}

export function concrete(key, { l = 30, rep = [4, 4] } = {}) {
  return memo('cc' + key, () => {
    const W = 512, H = 512, [c, x] = mk(W, H), r = srng(21);
    x.fillStyle = hsl(30, 6, l); x.fillRect(0, 0, W, H);
    for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(0,0,0,${.03 + r() * .08})`; x.beginPath(); x.ellipse(r() * W, r() * H, 20 + r() * 80, 10 + r() * 50, r() * 3, 0, 7); x.fill(); }
    for (let k = 0; k < 6; k++) { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1; x.beginPath(); let px = r() * W, py = r() * H; x.moveTo(px, py); for (let s = 0; s < 8; s++) { px += (r() - .5) * 60; py += (r() - .5) * 60; x.lineTo(px, py); } x.stroke(); }
    grain(x, W, H, 30, 22);
    return tex(c, rep);
  });
}

export function felt(color = '#0e6a3a') {
  return memo('felt' + color, () => { const [c, x] = mk(256, 256); x.fillStyle = color; x.fillRect(0, 0, 256, 256); grain(x, 256, 256, 22, 31, 0.5); return tex(c, [1, 1]); });
}

export function tinCeiling(dark = 18) {
  return memo('tin' + dark, () => {
    const W = 256, [c, x] = mk(W, W);
    x.fillStyle = hsl(30, 15, dark); x.fillRect(0, 0, W, W);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const cx = i * 128 + 64, cy = j * 128 + 64;
      x.strokeStyle = 'rgba(255,220,160,.12)'; x.lineWidth = 3; x.strokeRect(cx - 56, cy - 56, 112, 112);
      x.strokeStyle = 'rgba(0,0,0,.4)'; x.strokeRect(cx - 50, cy - 50, 100, 100);
      x.beginPath(); x.arc(cx, cy, 24, 0, 7); x.stroke(); x.strokeStyle = 'rgba(255,220,160,.1)'; x.beginPath(); x.arc(cx, cy, 30, 0, 7); x.stroke();
    }
    grain(x, W, W, 12, 33);
    return tex(c, [8, 6]);
  });
}

// Signs, posters -------------------------------------------------------
export function neonSign(text, color = '#3cff8a', { w = 512, h = 160, font = '900 92px Georgia, serif', sub = null, subFont = '700 30px system-ui' } = {}) {
  return memo('neon' + text + color + (sub || ''), () => {
    const [c, x] = mk(w, h);
    x.clearRect(0, 0, w, h);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const draw = (t, f, y) => {
      x.font = f;
      for (const [blur, alpha, lw] of [[40, .55, 10], [18, .8, 6], [6, 1, 3]]) { x.shadowColor = color; x.shadowBlur = blur; x.strokeStyle = color; x.globalAlpha = alpha; x.lineWidth = lw; x.strokeText(t, w / 2, y); }
      x.globalAlpha = 1; x.shadowBlur = 0; x.lineWidth = 2; x.strokeStyle = '#fff'; x.strokeText(t, w / 2, y);
    };
    draw(text, font, sub ? h * 0.42 : h / 2);
    if (sub) draw(sub, subFont, h * 0.82);
    const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

export function poster(kind) {
  return memo('poster' + kind, () => {
    const W = 256, H = 360, [c, x] = mk(W, H), r = srng(kind.length * 7 + 3);
    if (kind === 'wanted') {
      x.fillStyle = '#d9c08a'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#3a2410'; x.textAlign = 'center'; x.font = '900 52px Georgia'; x.fillText('WANTED', W / 2, 60);
      x.fillStyle = '#7a5a30'; x.fillRect(48, 82, 160, 150);
      x.fillStyle = '#2a1608'; x.beginPath(); x.arc(128, 150, 40, 0, 7); x.fill(); x.fillRect(84, 186, 88, 46);
      x.fillStyle = '#3a2410'; x.font = '700 22px Georgia'; x.fillText('DEAD OR ALIVE', W / 2, 262); x.font = '900 40px Georgia'; x.fillText('$' + (500 + Math.floor(r() * 9) * 100), W / 2, 312);
    } else if (kind === 'band') {
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b0a3d'); g.addColorStop(1, '#ff3d7f'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#ffe14d'; x.textAlign = 'center'; x.font = '900 40px Impact, sans-serif'; x.fillText('THE', W / 2, 60); x.font = '900 56px Impact, sans-serif'; x.fillText('SHAMROCKS', W / 2, 116);
      x.fillStyle = 'rgba(0,0,0,.5)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(50 + i * 52, 230, 22, 0, 7); x.fill(); x.fillRect(32 + i * 52, 250, 36, 70); }
      x.fillStyle = '#fff'; x.font = '700 22px system-ui'; x.fillText('LIVE  FRI + SAT', W / 2, 345);
    } else if (kind === 'beer') {
      x.fillStyle = '#0b2a18'; x.fillRect(0, 0, W, H); x.strokeStyle = '#d4a63c'; x.lineWidth = 8; x.strokeRect(12, 12, W - 24, H - 24);
      x.fillStyle = '#d4a63c'; x.textAlign = 'center'; x.font = '900 34px Georgia'; x.fillText('CLOVER', W / 2, 70); x.fillText('STOUT', W / 2, 108);
      x.fillStyle = '#1a0c04'; x.beginPath(); x.moveTo(88, 140); x.lineTo(168, 140); x.lineTo(158, 300); x.lineTo(98, 300); x.fill(); x.fillStyle = '#efe2c0'; x.fillRect(86, 134, 84, 24);
      x.fillStyle = '#d4a63c'; x.font = '700 18px Georgia'; x.fillText('Good for what ails ye', W / 2, 334);
    } else if (kind === 'moto') {
      x.fillStyle = '#111'; x.fillRect(0, 0, W, H); x.fillStyle = '#ff6a1a'; x.textAlign = 'center'; x.font = '900 46px Impact'; x.fillText('RIDE', W / 2, 70); x.fillText('OR DIE', W / 2, 120);
      x.strokeStyle = '#ddd'; x.lineWidth = 8; x.beginPath(); x.arc(70, 260, 40, 0, 7); x.stroke(); x.beginPath(); x.arc(186, 260, 40, 0, 7); x.stroke(); x.beginPath(); x.moveTo(70, 260); x.lineTo(120, 200); x.lineTo(186, 260); x.moveTo(120, 200); x.lineTo(160, 190); x.stroke();
    } else if (kind === 'disco') {
      const g = x.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 220); g.addColorStop(0, '#00e5ff'); g.addColorStop(1, '#3b0066'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '900 48px Impact'; x.fillText('BASS', W / 2, 80); x.fillText('NIGHT', W / 2, 136);
      x.fillStyle = '#ff2fd0'; x.font = '700 26px system-ui'; x.fillText('DJ BASSDROP', W / 2, 320);
    }
    grain(x, W, H, 22, kind.length);
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, W, 6);
    return tex(c);
  });
}

export function dartboard() {
  return memo('dart', () => {
    const W = 256, [c, x] = mk(W, W), cx = 128;
    x.fillStyle = '#111'; x.beginPath(); x.arc(cx, cx, 126, 0, 7); x.fill();
    for (let ring = 0; ring < 5; ring++) {
      const R = [110, 100, 66, 58, 0][ring];
      for (let i = 0; i < 20; i++) {
        const a0 = (i - .5) / 20 * Math.PI * 2, a1 = (i + .5) / 20 * Math.PI * 2;
        x.fillStyle = ring % 2 === 0 ? (i % 2 ? '#e8dcc0' : '#151515') : (i % 2 ? '#1c8a3a' : '#c0242c');
        x.beginPath(); x.moveTo(cx, cx); x.arc(cx, cx, R, a0, a1); x.fill();
      }
      if (ring === 3) break;
    }
    x.fillStyle = '#1c8a3a'; x.beginPath(); x.arc(cx, cx, 12, 0, 7); x.fill(); x.fillStyle = '#c0242c'; x.beginPath(); x.arc(cx, cx, 6, 0, 7); x.fill();
    const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

export function label(color, text) {
  return memo('lab' + color + text, () => {
    const [c, x] = mk(128, 64);
    x.fillStyle = color; x.fillRect(0, 0, 128, 64);
    x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(0, 18, 128, 28);
    x.fillStyle = '#222'; x.font = '900 18px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 32);
    return tex(c);
  });
}

// fabric for fighters -------------------------------------------------
export function fabric(kind, c1, c2) {
  return memo('fab' + kind + c1 + c2, () => {
    const W = 128, [c, x] = mk(W, W), r = srng(41);
    x.fillStyle = c1; x.fillRect(0, 0, W, W);
    if (kind === 'plaid') {
      x.globalAlpha = .45; x.fillStyle = c2; for (let i = 0; i < W; i += 32) { x.fillRect(i, 0, 12, W); x.fillRect(0, i, W, 12); }
      x.globalAlpha = .3; x.fillStyle = '#000'; for (let i = 16; i < W; i += 32) { x.fillRect(i, 0, 3, W); x.fillRect(0, i, W, 3); } x.globalAlpha = 1;
    } else if (kind === 'stripes') { x.fillStyle = c2; for (let i = 0; i < W; i += 24) x.fillRect(0, i, W, 9); }
    else if (kind === 'hawaii') { for (let k = 0; k < 12; k++) { x.fillStyle = k % 2 ? c2 : '#fff6'; const px = r() * W, py = r() * W; for (let p = 0; p < 5; p++) { x.beginPath(); x.ellipse(px + Math.cos(p * 1.26) * 7, py + Math.sin(p * 1.26) * 7, 6, 4, p * 1.26, 0, 7); x.fill(); } } }
    else if (kind === 'leather') { for (let k = 0; k < 50; k++) { x.strokeStyle = `rgba(255,255,255,${.03 + r() * .05})`; x.beginPath(); const yy = r() * W; x.moveTo(0, yy); x.lineTo(W, yy + (r() - .5) * 20); x.stroke(); } }
    else if (kind === 'denim') { for (let i = 0; i < W; i += 2) { x.fillStyle = `rgba(255,255,255,${.04 + (i % 4 ? .03 : 0)})`; x.fillRect(i, 0, 1, W); } }
    else if (kind === 'sequin') { for (let k = 0; k < 300; k++) { x.fillStyle = r() < .5 ? c2 : '#ffffff55'; x.fillRect(r() * W, r() * W, 3, 3); } }
    grain(x, W, W, 18, 43, 0.5);
    const t = tex(c, [2, 2]); return t;
  });
}

// face painted on a sphere (equirect). mood: calm | angry | dazed | ko
export function face(skin, mood, { beard = null, stache = null, glasses = false, brows = '#2a1a10', paint = null } = {}) {
  return memo(['face', skin, mood, beard, stache, glasses, brows, paint].join('|'), () => {
    const W = 256, H = 128, [c, x] = mk(W, H);
    x.fillStyle = skin; x.fillRect(0, 0, W, H);
    // the face is centred at u=0.75 (three's sphere uv: +z faces u=.75)
    const cx = W * 0.75, ey = H * 0.44;
    const eye = (ox) => {
      if (mood === 'ko') { x.strokeStyle = '#111'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx + ox - 7, ey - 6); x.lineTo(cx + ox + 7, ey + 6); x.moveTo(cx + ox + 7, ey - 6); x.lineTo(cx + ox - 7, ey + 6); x.stroke(); return; }
      if (mood === 'dazed') { x.strokeStyle = '#111'; x.lineWidth = 3; x.beginPath(); for (let a = 0; a < 12; a += .3) x.lineTo(cx + ox + Math.cos(a) * a * .7, ey + Math.sin(a) * a * .7); x.stroke(); return; }
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(cx + ox, ey, 8, 7, 0, 0, 7); x.fill();
      x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(cx + ox + (ox > 0 ? -1 : 1), ey + 1, 4, 0, 7); x.fill();
    };
    eye(-15); eye(15);
    x.strokeStyle = brows; x.lineWidth = 5; x.lineCap = 'round';
    const by = ey - 13, tilt = mood === 'angry' ? 6 : mood === 'dazed' ? -4 : 0;
    x.beginPath(); x.moveTo(cx - 25, by - tilt); x.lineTo(cx - 7, by + tilt); x.moveTo(cx + 25, by - tilt); x.lineTo(cx + 7, by + tilt); x.stroke();
    // nose
    x.fillStyle = 'rgba(120,40,30,.35)'; x.beginPath(); x.ellipse(cx, ey + 14, 6, 8, 0, 0, 7); x.fill();
    // mouth
    x.strokeStyle = '#4a1010'; x.lineWidth = 4;
    if (mood === 'angry') { x.fillStyle = '#3a0808'; x.beginPath(); x.ellipse(cx, ey + 34, 11, 6, 0, 0, 7); x.fill(); x.fillStyle = '#eee'; x.fillRect(cx - 9, ey + 29, 18, 4); }
    else if (mood === 'ko') { x.fillStyle = '#3a0808'; x.beginPath(); x.ellipse(cx, ey + 34, 8, 9, 0, 0, 7); x.fill(); x.fillStyle = '#e66'; x.beginPath(); x.ellipse(cx + 3, ey + 40, 5, 4, 0, 0, 7); x.fill(); }
    else if (mood === 'dazed') { x.beginPath(); for (let i = -12; i <= 12; i += 4) x.lineTo(cx + i, ey + 33 + (i / 4 % 2 ? 3 : -3)); x.stroke(); }
    else { x.beginPath(); x.arc(cx, ey + 24, 12, 0.2, Math.PI - 0.2); x.stroke(); }
    if (stache) { x.fillStyle = stache; x.beginPath(); x.ellipse(cx - 10, ey + 26, 12, 5, -.2, 0, 7); x.ellipse(cx + 10, ey + 26, 12, 5, .2, 0, 7); x.fill(); }
    if (beard) { x.fillStyle = beard; x.beginPath(); x.moveTo(cx - 36, ey + 2); x.quadraticCurveTo(cx - 30, ey + 66, cx, ey + 70); x.quadraticCurveTo(cx + 30, ey + 66, cx + 36, ey + 2); x.lineTo(cx + 26, ey + 22); x.quadraticCurveTo(cx, ey + 40, cx - 26, ey + 22); x.fill(); x.fillStyle = '#3a0808'; x.beginPath(); x.ellipse(cx, ey + 32, 9, 4, 0, 0, 7); x.fill(); }
    if (glasses) { x.fillStyle = '#0a0a0a'; x.beginPath(); x.roundRect(cx - 30, ey - 9, 26, 17, 5); x.roundRect(cx + 4, ey - 9, 26, 17, 5); x.fill(); x.fillRect(cx - 6, ey - 4, 12, 3); x.fillStyle = 'rgba(120,220,255,.35)'; x.fillRect(cx - 26, ey - 6, 8, 4); x.fillRect(cx + 8, ey - 6, 8, 4); }
    if (paint) { x.fillStyle = paint; x.fillRect(cx - 34, ey - 4, 68, 6); }
    // bruise blush cheeks
    x.fillStyle = 'rgba(255,90,90,.18)'; x.beginPath(); x.arc(cx - 24, ey + 16, 8, 0, 7); x.arc(cx + 24, ey + 16, 8, 0, 7); x.fill();
    // hair at back
    return tex(c, [1, 1]);
  });
}

export function glowSprite(color = '#ffcc88') {
  return memo('glow' + color, () => {
    const [c, x] = mk(128, 128), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color); g.addColorStop(.25, color + 'aa'); g.addColorStop(1, color + '00');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}
export function starSprite() {
  return memo('star', () => {
    const [c, x] = mk(64, 64); x.fillStyle = '#ffe14d'; x.strokeStyle = '#7a4a00'; x.lineWidth = 3; x.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = i / 10 * Math.PI * 2 - Math.PI / 2; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    x.closePath(); x.fill(); x.stroke(); const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}
export function smokeSprite() {
  return memo('smoke', () => {
    const [c, x] = mk(128, 128), r = srng(5);
    for (let k = 0; k < 14; k++) { const px = 40 + r() * 48, py = 40 + r() * 48, rr = 18 + r() * 26; const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}
export function floorLED() {
  return memo('led', () => { const [c, x] = mk(64, 64); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 3); x.fillRect(0, 0, 3, 64); const g = x.createRadialGradient(32, 32, 4, 32, 32, 44); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = g; x.fillRect(3, 3, 61, 61); return tex(c); });
}
