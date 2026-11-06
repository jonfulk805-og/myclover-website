// LONG SHADOW - contracts: time of day, weather, guards, targets and their schedules.
// Coordinates: x east, z south. The ridge (player) is north at z ~ -128, the compound spans z -20..112.
// Route step: { p:[x,z], y, wait, act, look (yaw, PI = facing the ridge), hide (inside a building during wait), tp (teleport here) }
const N = Math.PI; // facing north / the ridge
const S = 0, E = Math.PI / 2, W = -Math.PI / 2;

const GUARD_LOOKS = [
  { camo: ['#4f5636', '#3a3f27', '#6b6a45', '#2a2c1d'], vest: 0x2d3020, hat: 'helmet', hatColor: 0x3b4128 },
  { camo: ['#7d7458', '#5f5841', '#968d6c', '#4a4434'], vest: 0x4a4434, hat: 'cap', hatColor: 0x5f5841 },
  { top: 0x26282b, bottom: 0x1d1e20, vest: 0x15161a, hat: 'cap', hatColor: 0x15161a, gloves: true },
  { camo: ['#4f5636', '#3a3f27', '#6b6a45', '#2a2c1d'], vest: 0x2d3020, hat: 'cap', hatColor: 0x2d3020 },
];
const g = (route, opt = {}) => ({ kind: 'guard', route, look: { ...GUARD_LOOKS[opt.lk ?? 0], rifle: true, binoc: !!opt.binoc }, ...opt });
const tower = (x, z, y, opt = {}) => ({ kind: 'tower', route: [{ p: [x, z], y, wait: 1e9, act: 'binoc', look: N }], look: { ...GUARD_LOOKS[opt.lk ?? 1], rifle: true, binoc: true }, sweep: opt.sweep ?? 0.9, ...opt });
const loop = (pts, wait = 3, act = 'idle', look) => pts.map((p, i) => ({ p, wait: Array.isArray(wait) ? wait[i] : wait, act: Array.isArray(act) ? act[i] : act, look: Array.isArray(look) ? look[i] : look }));

const R = {
  north: loop([[-70, -8], [-10, -8], [70, -8], [-10, -8]], [5, 2, 5, 2], 'idle', [N, undefined, N, undefined]),
  ware: loop([[-76, 14], [-34, 14], [-34, 50], [-76, 50]], [3, 4, 2, 3]),
  villa: loop([[-18, 61], [18, 61], [18, 87], [-18, 87]], [4, 2, 3, 2], 'idle', [N, undefined, undefined, undefined]),
  east: loop([[42, 16], [86, 16], [86, 68], [66, 68]], [3, 5, 2, 3], 'idle', [undefined, N, undefined, undefined]),
  center: loop([[-8, 24], [30, 24], [30, 46], [-8, 46]], [3, 2, 3, 2]),
  heli: loop([[-72, 72], [-38, 72], [-38, 100], [-72, 100]], [2, 3, 2, 4]),
  south: loop([[-70, 106], [70, 106]], [6, 6]),
  west: loop([[-88, 0], [-88, 95]], [6, 6], 'idle', [N, undefined]),
  roof: [{ p: [-11, 68.6], y: 8.2, wait: 6, look: N, act: 'idle' }, { p: [11, 68.6], y: 8.2, wait: 6, look: N, act: 'idle' }],
};
const post = (x, z, look, act = 'idle', y = 0) => [{ p: [x, z], y, wait: 1e9, act, look }];

export const CONTRACTS = [
  {
    id: 'dawn', name: 'First Light', sub: 'Contract 01', time: '05:52', weather: 'Valley mist',
    blurb: 'Kessler Freight runs guns out of this valley. Two of his people check the stock at dawn, before the trucks roll. They never see the sun come up.',
    exfil: 420, masking: { gen: [30, 44] }, wind: [1.2, 2.6],
    pal: { skyTop: '#41618f', skyHor: '#f0b69a', sunColor: '#ffb27c', sunDir: [0.75, 0.22, -0.55], sunI: 2.6, hemiSky: '#b4c2e0', hemiGround: '#6a5a4a', hemiI: 1.25, fog: '#c7b3a7', fogD: 0.0021, exposure: 1.2, cloud: 0.45, scene: 'day',
      grass: '#5f6a3a', grass2: '#7a7444', rock: '#6f6a62', dirt: '#857560', snow: '#e9e6ea', pine: '#6f8a62', bush: '#8aa070', bushHue: 95, grassCard: '#c8c49a', rockTint: '#b8b0a8' },
    targets: [
      { id: 'qm', name: 'Dmitri Vasko', role: 'The Quartermaster', tell: 'Red beret, olive uniform, clipboard swagger. Counts crates at the warehouse and the trucks.',
        look: { top: 0x55603a, bottom: 0x3f4730, hat: 'beret', hatColor: 0x9a1410, seed: 21 },
        route: [{ p: [-55, 22], wait: 8, act: 'talk', look: N }, { p: [11, 24], wait: 22, act: 'talk', look: E }, { p: [-25, 43], wait: 18, act: 'idle', look: S }, { p: [-55, 23], wait: 30, hide: true }, { p: [-55, 22], wait: 6, act: 'smoke', look: N }, { p: [55, 23.5], wait: 26, hide: true }, { p: [55, 22.5], wait: 10, act: 'phone', look: N }] },
      { id: 'acc', name: 'Lena Morrow', role: 'The Accountant', tell: 'Charcoal suit, silver hair. Moves the money. Likes a cigarette by the pool.',
        look: { top: 0x3a3c40, bottom: 0x2e3034, tie: 0x222222, hair: 0xb8b8b0, seed: 33, cig: true, phone: true },
        route: [{ p: [0, 64.5], wait: 4, act: 'idle', look: N }, { p: [-15, 54], wait: 30, act: 'smoke', look: N }, { p: [48, 76], wait: 32, hide: true }, { p: [-3, 60], wait: 20, act: 'phone', look: N }, { p: [0, 66], wait: 18, hide: true }, { p: [2, 65.6], y: 3.95, tp: true, wait: 34, act: 'smoke', look: N }, { p: [0, 66], tp: true, wait: 12, hide: true }] },
    ],
    guards: [
      g(R.north, { lk: 0 }), g(R.ware, { lk: 3, phase: 2 }), g(R.villa, { lk: 1 }), g(R.east, { lk: 0, phase: 1 }), g(R.center, { lk: 3, phase: 2 }), g(R.heli, { lk: 1 }),
      g(post(-50, 22.5, N, 'idle'), { lk: 3 }), g(post(-15, 9.5, N, 'smoke'), { lk: 1 }), g(post(90, 36, E), { lk: 0 }), g(post(4.5, 15, W, 'talk'), { lk: 0 }), g(post(2.6, 15.4, E, 'talk'), { lk: 1 }),
      tower(-90, -15, 7.3, { sweep: 0.8 }), tower(90, -15, 7.3, { sweep: 0.8 }),
    ],
  },
  {
    id: 'dusk', name: 'Golden Hour', sub: 'Contract 02', time: '19:41', weather: 'Clear, low sun',
    blurb: 'A buyer, a chemist and a broker meet on Kessler\'s balcony to price a shipment that should not exist. The sun sits right behind them. Use it, or let it blind you.',
    exfil: 480, masking: { gen: [32, 48], plane: [70, 95] }, wind: [2.2, 4.2],
    pal: { skyTop: '#3b4f86', skyHor: '#ffaa62', sunColor: '#ff9a4a', sunDir: [-0.55, 0.11, 0.83], sunI: 2.6, hemiSky: '#c8a890', hemiGround: '#5a4636', hemiI: 1.15, fog: '#d79a72', fogD: 0.0022, exposure: 1.1, cloud: 0.6, scene: 'dusk',
      grass: '#6a6a34', grass2: '#86753e', rock: '#7a6a5c', dirt: '#8c7258', snow: '#f4dccc', pine: '#6e7c50', bush: '#8f9a5c', bushHue: 80, grassCard: '#d8c48a', rockTint: '#c0a890' },
    targets: [
      { id: 'ruiz', name: 'Col. Ernesto Ruiz', role: 'The Buyer', tell: 'Green beret, dress uniform with a gold sash. Arrived with two bodyguards in black.',
        look: { top: 0x3d4a2a, bottom: 0x2f3a22, hat: 'beret', hatColor: 0x1f5a2a, tie: 0xd8a830, seed: 41 },
        route: [{ p: [-30, 74], wait: 10, act: 'talk', look: E }, { p: [-5, 63], wait: 6, act: 'idle', look: N }, { p: [0, 66], wait: 10, hide: true }, { p: [-3, 65.6], y: 3.95, tp: true, wait: 50, act: 'talk', look: E }, { p: [0, 66], tp: true, wait: 14, hide: true }, { p: [-48, 70], wait: 25, act: 'phone', look: N }, { p: [-55, 23], wait: 25, hide: true }, { p: [-55, 22], wait: 12, act: 'talk', look: N }] },
      { id: 'voss', name: 'Mara Voss', role: 'The Chemist', tell: 'White lab coat, black hair tied back. Never far from the warehouse.',
        look: { top: 0xe8e8e2, bottom: 0x2a2a2e, coat: true, hair: 0x0e0c0a, seed: 51, cig: true },
        route: [{ p: [-55, 23], wait: 30, hide: true }, { p: [-62, 18], wait: 26, act: 'smoke', look: N }, { p: [-15, 10], wait: 14, act: 'idle', look: N }, { p: [0, 66], wait: 8, hide: true }, { p: [3, 65.6], y: 3.95, tp: true, wait: 50, act: 'talk', look: W }, { p: [0, 66], tp: true, wait: 10, hide: true }, { p: [-34, 46], wait: 18, act: 'idle', look: N }] },
      { id: 'grant', name: 'Silas Grant', role: 'The Broker', tell: 'Cream suit and a cream fedora. Talks with his hands. Paces when he is on the phone.',
        look: { top: 0xe6dcc0, bottom: 0xdcd2b8, hat: 'fedora', hatColor: 0xe6dcc0, tie: 0x7a1414, seed: 61, phone: true },
        route: [{ p: [0, 66], wait: 20, hide: true }, { p: [1, 65.6], y: 3.95, tp: true, wait: 60, act: 'talk', look: N }, { p: [0, 66], tp: true, wait: 8, hide: true }, { p: [12, 58], wait: 8, act: 'phone', look: N }, { p: [26, 58], wait: 8, act: 'phone', look: N }, { p: [12, 58], wait: 8, act: 'phone', look: N }, { p: [48, 76], wait: 26, hide: true }, { p: [40, 70], wait: 14, act: 'talk', look: W }] },
    ],
    guards: [
      g(R.north, { lk: 1 }), g(R.ware, { lk: 0 }), g(R.villa, { lk: 2, phase: 2 }), g(R.east, { lk: 1 }), g(R.center, { lk: 0, phase: 1 }), g(R.heli, { lk: 3, phase: 2 }), g(R.west, { lk: 0 }), g(R.south, { lk: 3, phase: 1 }),
      g(R.roof, { lk: 2, binoc: true }),
      g(post(-6, 63.5, N), { lk: 2 }), g(post(6, 63.5, N), { lk: 2 }), g(post(-50, 22.5, N, 'smoke'), { lk: 0 }), g(post(90, 36, E), { lk: 1 }), g(post(22, 9.2, N, 'hands'), { lk: 3 }),
      tower(-90, -15, 7.3), tower(90, -15, 7.3), tower(-2, 104, 7.3, { sweep: 0.6 }),
    ],
  },
  {
    id: 'night', name: 'Blackout', sub: 'Contract 03', time: '02:17', weather: 'Thunderstorm',
    blurb: 'Kessler himself is in the valley tonight, with his security chief and a courier carrying the ledger. The storm will cover your shots, if you count the seconds between the flash and the thunder.',
    exfil: 480, masking: { thunder: [24, 40], gen: [36, 52] }, wind: [3.2, 5.5], night: true, rain: true, searchlight: { x: 90, z: -15, y: 10 },
    pal: { skyTop: '#05080f', skyHor: '#1a2230', sunColor: '#8aa0c8', sunDir: [0.3, 0.5, 0.6], sunI: 0.35, hemiSky: '#46587a', hemiGround: '#14161a', hemiI: 0.55, fog: '#121820', fogD: 0.0042, exposure: 1.35, cloud: 0.9, stars: false, night: true, scene: 'night',
      grass: '#3a4a34', grass2: '#4a5040', rock: '#4f5258', dirt: '#5a5650', snow: '#9aa4b4', pine: '#4a6050', bush: '#5a7060', bushHue: 120, grassCard: '#7a8a70', rockTint: '#8a8e96' },
    targets: [
      { id: 'kessler', name: 'Anton Kessler', role: 'The Kingpin', tell: 'Black suit, red tie, silver hair. Spends the night between the villa roof and his study.',
        look: { top: 0x15161a, bottom: 0x15161a, tie: 0xb01818, hair: 0xc8c8c0, seed: 71, cig: true },
        route: [{ p: [0, 66], wait: 25, hide: true }, { p: [0, 74], y: 8.2, tp: true, wait: 4, act: 'idle', look: N }, { p: [-6, 68.6], y: 8.2, wait: 34, act: 'smoke', look: N }, { p: [6, 68.6], y: 8.2, wait: 20, act: 'idle', look: N }, { p: [0, 74], y: 8.2, wait: 2 }, { p: [0, 66], tp: true, wait: 30, hide: true }, { p: [-2, 65.6], y: 3.95, tp: true, wait: 40, act: 'phone', look: N }, { p: [0, 66], tp: true, wait: 10, hide: true }] },
      { id: 'warden', name: 'Gregor Hale', role: 'Security Chief', tell: 'Black fatigues, red beret, carries a rifle. Walks the perimeter and checks on every post.',
        look: { top: 0x1c1d20, bottom: 0x1c1d20, vest: 0x101012, hat: 'beret', hatColor: 0xa01010, seed: 81, rifle: true, gloves: true },
        route: [{ p: [-50, 21], wait: 8, act: 'talk', look: N }, { p: [-15, 8], wait: 8, act: 'talk', look: N }, { p: [0, -6], wait: 10, act: 'idle', look: N }, { p: [60, 20], wait: 8, act: 'talk', look: N }, { p: [88, 36], wait: 10, act: 'talk', look: E }, { p: [55, 70], wait: 6, act: 'idle', look: N }, { p: [-55, 80], wait: 12, act: 'phone', look: N }] },
      { id: 'courier', name: 'Ilya Brandt', role: 'The Courier', tell: 'Tan trench coat, grey cap. Carries the ledger and waits by the helicopter.',
        look: { top: 0x8a7350, bottom: 0x3a342a, coat: true, hat: 'cap', hatColor: 0x5a5a5a, seed: 91, phone: true },
        route: [{ p: [-46, 84], wait: 40, act: 'phone', look: N }, { p: [-38, 66], wait: 16, act: 'smoke', look: N }, { p: [48, 76], wait: 30, hide: true }, { p: [36, 62], wait: 12, act: 'idle', look: N }, { p: [-46, 82], wait: 24, act: 'idle', look: W }] },
    ],
    guards: [
      g(R.north, { lk: 2 }), g(R.ware, { lk: 2, phase: 1 }), g(R.villa, { lk: 2 }), g(R.east, { lk: 2, phase: 2 }), g(R.center, { lk: 2 }), g(R.heli, { lk: 2, phase: 1 }), g(R.west, { lk: 2, phase: 1 }), g(R.south, { lk: 2 }),
      g(R.roof, { lk: 2, binoc: true, phase: 1 }),
      g(post(-6, 63.5, N), { lk: 2 }), g(post(6, 63.5, N), { lk: 2 }), g(post(-50, 22.5, N), { lk: 2 }), g(post(90, 36, E), { lk: 2 }), g(post(-57, 79, W, 'smoke'), { lk: 2 }),
      tower(-90, -15, 7.3), tower(90, -15, 7.3, { light: true }), tower(-2, 104, 7.3, { sweep: 0.6 }),
    ],
  },
];

export const DIFFS = {
  easy: { label: 'Recruit', detect: 0.6, acc: 0.5, php: 150, marker: 'always', wind: 0.5, exfil: 1.3, gHear: 0.75 },
  normal: { label: 'Marksman', detect: 1, acc: 1, php: 100, marker: 'breath', wind: 1, exfil: 1, gHear: 1 },
  hard: { label: 'Ghost', detect: 1.45, acc: 1.4, php: 70, marker: 'never', wind: 1.3, exfil: 0.85, gHear: 1.25 },
};
