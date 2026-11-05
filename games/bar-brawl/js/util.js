// Small math + RNG helpers shared by every module.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const chance = p => Math.random() < p;
export const TAU = Math.PI * 2;
export function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
export function approach(v, t, s) { return v < t ? Math.min(v + s, t) : Math.max(v - s, t); }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

// seeded rng for textures so they look the same every load
export function srng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

// circle (xz) vs AABB push-out. box: {x0,x1,z0,z1}. returns true if moved.
export function circleBox(p, r, b) {
  const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
  let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return false;
  if (d2 < 1e-8) { // centre inside box: push out along shortest axis
    const l = p.x - b.x0, rr = b.x1 - p.x, n = p.z - b.z0, f = b.z1 - p.z;
    const m = Math.min(l, rr, n, f);
    if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === n) p.z = b.z0 - r; else p.z = b.z1 + r;
    return true;
  }
  const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; return true;
}
