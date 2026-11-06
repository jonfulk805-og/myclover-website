// DEAD ACRES - map layout, grid queries, flow field. Pure JS (no three) so node tests can import it.
export const CS = 2; // metres per cell
export const W = 31, H = 35;

// cell kinds
export const K = { X: 0, WALL: 1, FENCE: 2, FLOOR: 3, WIN: 4, DOOR: 5, POCKET: 6, SPAWN: 7, PROP: 8 };

// zones: 0 farmhouse, 1 yard, 2 barn, 3 shed
export const ZONES = [
  { name: 'Farmhouse', indoor: true, h: 3.2, floor: 'plank', wall: 'house' },
  { name: 'Yard', indoor: false, h: 0, floor: 'dirt', wall: 'fence' },
  { name: 'Barn', indoor: true, h: 5.2, floor: 'hay', wall: 'barn' },
  { name: 'Tool Shed', indoor: true, h: 3.0, floor: 'concrete', wall: 'shed' },
];

export const DOORS = [
  { id: 0, cx: 15, cy: 17, cost: 750, a: 0, b: 1, label: 'Back door' },
  { id: 1, cx: 21, cy: 11, cost: 1000, a: 1, b: 2, label: 'Barn doors' },
  { id: 2, cx: 20, cy: 25, cost: 1250, a: 1, b: 3, label: 'Shed door' },
];

// windows: cell on the wall line, (dx,dy) = outward direction; zone = which zone it opens into
export const WINDOWS = [
  { cx: 4, cy: 17, dx: -1, dy: 0, zone: 0 },
  { cx: 4, cy: 22, dx: -1, dy: 0, zone: 0 },
  { cx: 8, cy: 14, dx: 0, dy: -1, zone: 0 },
  { cx: 11, cy: 25, dx: 0, dy: 1, zone: 0 },
  { cx: 27, cy: 15, dx: 1, dy: 0, zone: 1, fence: true },
  { cx: 27, cy: 21, dx: 1, dy: 0, zone: 1, fence: true },
  { cx: 21, cy: 3, dx: 0, dy: -1, zone: 2 },
  { cx: 27, cy: 7, dx: 1, dy: 0, zone: 2 },
  { cx: 16, cy: 6, dx: -1, dy: 0, zone: 2 },
  { cx: 20, cy: 31, dx: 0, dy: 1, zone: 3 },
  { cx: 24, cy: 28, dx: 1, dy: 0, zone: 3 },
];

// interactables. wall-buys hang on a wall cell (w) facing floor cell (f).
export const WALLBUYS = [
  { gun: 'farmhand', cost: 500, w: [7, 19], f: [7, 18] },
  { gun: 'rattler', cost: 1000, w: [12, 14], f: [12, 15] },
  { gun: 'carbine', cost: 1200, w: [15, 22], f: [16, 22] },
  { gun: 'grenades', cost: 250, w: [26, 11], f: [26, 10] },
];
// machines occupy a floor cell (blocking) and face toward (fx,fy)
export const PERKS = [
  { id: 'wind', cx: 14, cy: 24, face: [-1, 0], cost: 500, power: false },
  { id: 'hide', cx: 26, cy: 12, face: [0, 1], cost: 2500, power: true },
  { id: 'draw', cx: 17, cy: 4, face: [0, 1], cost: 3000, power: true },
  { id: 'tap', cx: 17, cy: 30, face: [1, 0], cost: 2000, power: true },
  { id: 'leaf', cx: 16, cy: 24, face: [1, 0], cost: 2000, power: true },
];
export const BOXES = [
  { cx: 6, cy: 15, face: [0, 1] },
  { cx: 25, cy: 4, face: [0, 1] },
  { cx: 23, cy: 30, face: [-1, 0] },
  { cx: 22, cy: 24, face: [0, -1] },
];
export const POWER = { w: [23, 25], f: [23, 26] };
export const FORGE = { cx: 25, cy: 9, face: [-1, 0] };
export const PLAYER_START = { cx: 9.5, cy: 22 };
// solid furniture (blocks movement): [cx,cy,type]
export const PROPS = [
  [13, 16, 'stove'], [9, 16, 'table'], [5, 24, 'couch'], [19, 7, 'hay'], [20, 9, 'hay'], [24, 6, 'tractor'], [19, 15, 'well'], [23, 19, 'truck'],
  [17, 26, 'bench'], [21, 28, 'crates'],
];

export const grid = new Uint8Array(W * H);
export const zoneOf = new Int8Array(W * H).fill(-1);
export const winAt = new Int16Array(W * H).fill(-1);
export const doorAt = new Int16Array(W * H).fill(-1);
export const pocketWin = new Int16Array(W * H).fill(-1); // pocket/spawn cell -> window index
export const SPAWNS = []; // {cx,cy,win}

const idx = (x, y) => y * W + x;
function rect(x0, y0, x1, y1, k, z = -1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { grid[idx(x, y)] = k; if (z >= 0) zoneOf[idx(x, y)] = z; } }
function ring(x0, y0, x1, y1, k) { for (let x = x0; x <= x1; x++) { grid[idx(x, y0)] = k; grid[idx(x, y1)] = k; } for (let y = y0; y <= y1; y++) { grid[idx(x0, y)] = k; grid[idx(x1, y)] = k; } }

function build() {
  grid.fill(K.X);
  // yard first (outdoor), fences
  rect(16, 12, 26, 24, K.FLOOR, 1);
  for (let y = 11; y <= 25; y++) grid[idx(27, y)] = K.FENCE;
  grid[idx(15, 12)] = K.FENCE; grid[idx(15, 13)] = K.FENCE; grid[idx(15, 11)] = K.FENCE;
  for (let x = 25; x <= 27; x++) grid[idx(x, 25)] = K.FENCE;
  // farmhouse
  ring(4, 14, 15, 25, K.WALL); rect(5, 15, 14, 24, K.FLOOR, 0);
  for (let x = 5; x <= 14; x++) if (x !== 9 && x !== 13) grid[idx(x, 19)] = K.WALL;
  // barn
  ring(16, 3, 27, 11, K.WALL); rect(17, 4, 26, 10, K.FLOOR, 2);
  // shed
  ring(16, 25, 24, 31, K.WALL); rect(17, 26, 23, 30, K.FLOOR, 3);
  // doors
  for (const d of DOORS) { grid[idx(d.cx, d.cy)] = K.DOOR; doorAt[idx(d.cx, d.cy)] = d.id; }
  // windows + pockets (3 cells deep; last = spawn)
  WINDOWS.forEach((w, i) => {
    grid[idx(w.cx, w.cy)] = K.WIN; winAt[idx(w.cx, w.cy)] = i; zoneOf[idx(w.cx, w.cy)] = w.zone;
    for (let k = 1; k <= 3; k++) {
      const x = w.cx + w.dx * k, y = w.cy + w.dy * k; grid[idx(x, y)] = k === 3 ? K.SPAWN : K.POCKET; pocketWin[idx(x, y)] = i;
    }
    // pocket width: side cells beside the spawn so groups can queue
    const sx = w.cx + w.dx * 3, sy = w.cy + w.dy * 3;
    for (const s of [-1, 1]) {
      const x = sx + (w.dy !== 0 ? s : 0), y = sy + (w.dx !== 0 ? s : 0);
      if (x >= 0 && y >= 0 && x < W && y < H && grid[idx(x, y)] === K.X) { grid[idx(x, y)] = K.POCKET; pocketWin[idx(x, y)] = i; }
    }
    SPAWNS.push({ cx: sx, cy: sy, win: i });
  });
  for (const p of PERKS) grid[idx(p.cx, p.cy)] = K.PROP;
  for (const b of BOXES) grid[idx(b.cx, b.cy)] = K.PROP;
  grid[idx(FORGE.cx, FORGE.cy)] = K.PROP;
  for (const [x, y] of PROPS) grid[idx(x, y)] = K.PROP;
}
build();

// ---------- runtime state hooks ----------
export const S = { doorOpen: [false, false, false], boards: WINDOWS.map(() => 6) };
export function resetMap() { S.doorOpen.fill(false); S.boards = WINDOWS.map(() => 6); }

export const cellAt = (x, z) => { const cx = Math.floor(x / CS), cy = Math.floor(z / CS); return (cx < 0 || cy < 0 || cx >= W || cy >= H) ? -1 : idx(cx, cy); };
export const kindAt = (i) => (i < 0 ? K.X : grid[i]);

// passability. who: 'p' player, 'z' zombie (window passable when boards==0 handled by caller)
export function blockedP(i) {
  if (i < 0) return true; const k = grid[i];
  if (k === K.FLOOR) return false;
  if (k === K.DOOR) return !S.doorOpen[doorAt[i]];
  return true;
}
export function blockedZ(i, ignoreBoards = false) {
  if (i < 0) return true; const k = grid[i];
  if (k === K.FLOOR || k === K.POCKET || k === K.SPAWN) return false;
  if (k === K.DOOR) return !S.doorOpen[doorAt[i]];
  if (k === K.WIN) return ignoreBoards ? false : S.boards[winAt[i]] > 0;
  return true;
}
// bullets stop at walls / closed doors / props are ignored (low) except machines, fences let shots through
export function blocksShot(i) {
  if (i < 0) return true; const k = grid[i];
  if (k === K.WALL) return true;
  if (k === K.DOOR) return !S.doorOpen[doorAt[i]];
  return false;
}
export function zoneOpen(z) {
  if (z === 0) return true;
  return DOORS.some((d) => S.doorOpen[d.id] && (d.a === z || d.b === z));
}

// ---------- flow field toward player (Dijkstra, 8-neighbour) ----------
export const dist = new Float64Array(W * H);
const heap = [];
export function computeFlow(px, pz) {
  dist.fill(1e9);
  const s = cellAt(px, pz); if (s < 0) return;
  dist[s] = 0; heap.length = 0; heap.push([0, s]);
  while (heap.length) {
    // small grid -> simple binary heap
    let bi = 0; // pop min
    const top = heap[0]; const last = heap.pop();
    if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } }
    void bi;
    const [d, c] = top; if (d > dist[c]) continue;
    const cx = c % W, cy = (c / W) | 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue; const nx = cx + ox, ny = cy + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = idx(nx, ny); if (blockedZ(n, true)) continue;
      if (ox && oy && (blockedZ(idx(cx + ox, cy), true) || blockedZ(idx(cx, cy + oy), true))) continue;
      // windows cost extra (climbing) and boarded windows cost a lot more
      let w = ox && oy ? 1.414 : 1; if (grid[n] === K.WIN) w += 1 + S.boards[winAt[n]] * 0.6;
      const nd = d + w; if (nd < dist[n]) { dist[n] = nd; heap.push([nd, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } }
    }
  }
}
// best neighbour cell for a zombie standing in cell c
export function nextCell(c) {
  const cx = c % W, cy = (c / W) | 0; let best = c, bd = dist[c];
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    if (!ox && !oy) continue; const nx = cx + ox, ny = cy + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const n = idx(nx, ny); if (blockedZ(n, true)) continue;
    if (ox && oy && (blockedZ(idx(cx + ox, cy), true) || blockedZ(idx(cx, cy + oy), true))) continue;
    if (dist[n] < bd) { bd = dist[n]; best = n; }
  }
  return best;
}
export const cellCenter = (c) => [((c % W) + 0.5) * CS, (((c / W) | 0) + 0.5) * CS];

// grid DDA: distance along ray (2D, xz) to first shot-blocking cell, up to maxD
export function rayWall(x, z, dx, dz, maxD, test = blocksShot) {
  let cx = Math.floor(x / CS), cy = Math.floor(z / CS);
  const sx = dx > 0 ? 1 : -1, sy = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(CS / dx) : 1e9, tdz = dz !== 0 ? Math.abs(CS / dz) : 1e9;
  let tx = dx !== 0 ? ((dx > 0 ? (cx + 1) * CS - x : x - cx * CS) / Math.abs(dx)) : 1e9;
  let tz = dz !== 0 ? ((dz > 0 ? (cy + 1) * CS - z : z - cy * CS) / Math.abs(dz)) : 1e9;
  let t = 0;
  for (let n = 0; n < 200; n++) {
    if (tx < tz) { t = tx; tx += tdx; cx += sx; } else { t = tz; tz += tdz; cy += sy; }
    if (t > maxD) return maxD;
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return t;
    if (test(idx(cx, cy))) return t;
  }
  return maxD;
}

// circle vs blocked cells push-out
export function collide(o, r, blocked) {
  const cx0 = Math.floor((o.x - r) / CS), cx1 = Math.floor((o.x + r) / CS), cy0 = Math.floor((o.z - r) / CS), cy1 = Math.floor((o.z + r) / CS);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const i = (cx < 0 || cy < 0 || cx >= W || cy >= H) ? -1 : idx(cx, cy);
    if (!blocked(i)) continue;
    const nx = Math.max(cx * CS, Math.min(o.x, (cx + 1) * CS)), nz = Math.max(cy * CS, Math.min(o.z, (cy + 1) * CS));
    let dx = o.x - nx, dz = o.z - nz; const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 < 1e-8) { // centre inside cell: push out along smallest axis
      const l = o.x - cx * CS, rr = (cx + 1) * CS - o.x, t = o.z - cy * CS, b = (cy + 1) * CS - o.z; const m = Math.min(l, rr, t, b);
      if (m === l) o.x = cx * CS - r; else if (m === rr) o.x = (cx + 1) * CS + r; else if (m === t) o.z = cy * CS - r; else o.z = (cy + 1) * CS + r;
      continue;
    }
    const d = Math.sqrt(d2); dx /= d; dz /= d; o.x = nx + dx * r; o.z = nz + dz * r;
  }
}

export function ascii() {
  const ch = { [K.X]: ' ', [K.WALL]: '#', [K.FENCE]: 'f', [K.FLOOR]: '.', [K.WIN]: 'W', [K.DOOR]: 'D', [K.POCKET]: 'o', [K.SPAWN]: 's', [K.PROP]: 'P' };
  let out = '';
  for (let y = 0; y < H; y++) { let r = ''; for (let x = 0; x < W; x++) { const k = grid[idx(x, y)]; r += k === K.FLOOR ? String(zoneOf[idx(x, y)]) : ch[k]; } out += r + '\n'; }
  return out;
}
