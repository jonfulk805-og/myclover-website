// Venue builder: room shell, bar, furniture, lights, breakables, spawn spots.
import * as THREE from 'three';
import * as TX from './textures.js';
import { rand, pick, srng, chance } from './util.js';

export const VENUES = [
  { id: 'pub', name: 'The Lucky Clover', sub: 'Irish dive pub', music: 'pub', boss: 'mick', sign: ['The Lucky Clover', '#3cff8a', 'PINTS  -  DARTS  -  CRAIC'], light: 0xffb36b, fog: 0x1a0f08,
    floor: ['pubf', { base: [24, 40, 17], plankW: 56, rep: [5, 4] }], wall: 'wallpaper', wallArgs: { bg: '#123a22' }, wains: [22, 35, 14], ceil: 16,
    patrons: ['barfly', 'barfly', 'darts', 'barfly', 'brute', 'darts'], waves: [['barfly', 'darts', 'brute', 'barfly'], ['brute', 'barfly', 'darts', 'bouncer', 'darts']], goal: 1800, par: 240 },
  { id: 'saloon', name: 'The Dusty Spur', sub: 'Frontier saloon', music: 'saloon', boss: 'boone', sign: ['DUSTY SPUR', '#ffb13c', 'SALOON  &  CARD ROOM'], light: 0xffc27a, fog: 0x1d1206,
    floor: ['saloonf', { base: [30, 38, 26], plankW: 80, rep: [4, 4], worn: .6 }], wall: 'planks', wallArgs: { base: [28, 35, 22], plankW: 40, rep: [6, 1], gaps: true }, wains: [26, 30, 18], ceil: 20,
    patrons: ['cowboy', 'cowboy', 'barfly', 'cowboy', 'brute', 'darts'], waves: [['cowboy', 'cowboy', 'brute', 'darts'], ['cowboy', 'brute', 'biker', 'cowboy', 'bouncer']], goal: 2400, par: 260 },
  { id: 'club', name: 'Club Voltage', sub: 'Neon nightclub', music: 'disco', boss: 'bassdrop', sign: ['VOLTAGE', '#ff2fd0', 'BASS  NIGHT  -  NO  REFUNDS'], light: 0xb06bff, fog: 0x0a0618,
    floor: null, wall: 'brick', wallArgs: { base: [260, 20, 16], mortar: '#0c0a12' }, wains: [260, 25, 10], ceil: 8,
    patrons: ['clubber', 'clubber', 'clubber', 'bouncer', 'clubber', 'clubber', 'brute'], waves: [['clubber', 'clubber', 'bouncer', 'clubber'], ['bouncer', 'clubber', 'clubber', 'brute', 'bouncer']], goal: 2600, par: 260 },
  { id: 'road', name: 'The Rusty Piston', sub: 'Biker roadhouse', music: 'road', boss: 'tank', sign: ['RUSTY PISTON', '#ff6a1a', 'COLD BEER  -  HOT BIKES'], light: 0xffa050, fog: 0x140c06,
    floor: null, wall: 'metal', wallArgs: {}, wains: [20, 20, 12], ceil: 12,
    patrons: ['biker', 'biker', 'barfly', 'biker', 'brute', 'cowboy'], waves: [['biker', 'biker', 'brute', 'biker'], ['biker', 'brute', 'bouncer', 'biker', 'biker']], goal: 3200, par: 280 },
];
export const ROOM = { x0: -7.5, x1: 7.5, z0: -6, z1: 6, h: 3.6 };

const std = (o) => new THREE.MeshStandardMaterial(o);

export class World {
  constructor(scene, venue, hooks) {
    this.scene = scene; this.V = venue; this.hooks = hooks; // hooks.spawnProp(type, x,y,z, opts), hooks.tab(value, label, pos)
    this.root = new THREE.Group(); scene.add(this.root);
    this.boxes = []; this.breakables = []; this.seats = []; this.stands = []; this.anim = []; this.lights = []; this.glassShelves = []; this.taps = [];
    this.door = { x: 0, z: 5.4, open: 0 };
    this.t = 0;
    this.build();
  }
  mesh(geo, mat, x, y, z, { cast = true, recv = true, parent = this.root } = {}) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m; }
  box(w, h, d, mat, x, y, z, o) { return this.mesh(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, o); }
  collider(x0, x1, y0, y1, z0, z1, extra = {}) { const b = { x0, x1, y0, y1, z0, z1, ...extra }; this.boxes.push(b); return b; }

  build() {
    const V = this.V, R = ROOM, id = V.id;
    this.scene.fog = new THREE.FogExp2(V.fog, 0.035);
    this.scene.background = new THREE.Color(V.fog);
    // ---- floor
    let floorMat;
    if (id === 'club') floorMat = std({ color: '#15121c', roughness: 0.25, metalness: 0.3, map: TX.concrete('club', { l: 14, rep: [4, 3] }) });
    else if (id === 'road') floorMat = std({ color: '#888', roughness: 0.75, map: TX.concrete('road', { l: 34, rep: [3, 3] }) });
    else floorMat = std({ map: TX.planks(...V.floor), roughness: 0.55, metalness: 0.05 });
    const fl = this.mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), floorMat, 0, 0, 0, { cast: false }); fl.rotation.x = -Math.PI / 2;
    // ---- ceiling
    const ce = this.mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), std({ map: TX.tinCeiling(V.ceil), roughness: 0.6, metalness: 0.3 }), 0, R.h, 0, { cast: false }); ce.rotation.x = Math.PI / 2;
    const beamM = std({ map: TX.planks('beam', { base: [24, 35, 12], plankW: 512, rep: [1, 1], gaps: false }), roughness: 0.8 });
    for (let x = -6; x <= 6; x += 3) this.box(0.28, 0.3, R.z1 - R.z0, beamM, x, R.h - 0.3, 0, { cast: false });
    // ---- walls
    let wallTex;
    if (V.wall === 'wallpaper') wallTex = TX.wallpaper(id, V.wallArgs);
    else if (V.wall === 'planks') wallTex = TX.planks('w' + id, V.wallArgs);
    else if (V.wall === 'brick') wallTex = TX.brick(id, V.wallArgs);
    else wallTex = TX.metal('road', { tint: [25, 25, 32], rep: [6, 1] });
    const wallMat = std({ map: wallTex, roughness: 0.85, color: id === 'club' ? '#5a4a7a' : '#fff' });
    const wainMat = std({ map: TX.panel(id, { base: V.wains }), roughness: 0.6 });
    const trimMat = std({ color: id === 'club' ? '#222' : '#2a160a', roughness: 0.4 });
    const W = R.x1 - R.x0, D = R.z1 - R.z0, wh = 1.15;
    const wall = (w, x, z, ry) => {
      const up = this.mesh(new THREE.PlaneGeometry(w, R.h - wh), wallMat, x, wh + (R.h - wh) / 2, z, { cast: false }); up.rotation.y = ry;
      const lo = this.mesh(new THREE.PlaneGeometry(w, wh), wainMat, x, wh / 2, z, { cast: false }); lo.rotation.y = ry;
      const rail = this.mesh(new THREE.BoxGeometry(w, 0.07, 0.06), trimMat, x, wh, z, { cast: false }); rail.rotation.y = ry;
    };
    wall(W, 0, R.z0, 0); wall(D, R.x0, 0, Math.PI / 2); wall(D, R.x1, 0, -Math.PI / 2);
    // front wall with door gap
    wall(6.7, -4.15, R.z1, Math.PI); wall(6.7, 4.15, R.z1, Math.PI);
    const lintel = this.mesh(new THREE.PlaneGeometry(1.6, R.h - 2.4), wallMat, 0, 2.4 + (R.h - 2.4) / 2, R.z1, { cast: false }); lintel.rotation.y = Math.PI;
    // wall colliders
    const T = 1;
    this.collider(R.x0 - T, R.x1 + T, 0, R.h, R.z0 - T, R.z0, { wall: true });
    this.collider(R.x0 - T, R.x0, 0, R.h, R.z0, R.z1, { wall: true }); this.collider(R.x1, R.x1 + T, 0, R.h, R.z0, R.z1, { wall: true });
    this.collider(R.x0, -0.8, 0, R.h, R.z1, R.z1 + T, { wall: true }); this.collider(0.8, R.x1, 0, R.h, R.z1, R.z1 + T, { wall: true });
    this.doorBox = this.collider(-0.8, 0.8, 0, R.h, R.z1 + 0.05, R.z1 + T, { wall: true });
    this.collider(-0.8, 0.8, 2.4, R.h, R.z1, R.z1 + T, { wall: true });
    // door (swinging / opening)
    const doorMat = std({ map: TX.planks('door' + id, { base: [22, 40, 20], plankW: 64, rep: [1, 1] }), roughness: 0.6 });
    this.doorPivot = new THREE.Group(); this.doorPivot.position.set(-0.8, 0, R.z1); this.root.add(this.doorPivot);
    if (id === 'saloon') { // batwing doors
      for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * 0.8, 0, R.z1); this.root.add(p); const m = this.mesh(new THREE.BoxGeometry(0.78, 1.0, 0.05), doorMat, -s * 0.39, 1.35, 0, { parent: p }); this.anim.push(t => { p.rotation.y = s * Math.sin(this.door.open * 3) * this.door.open * 1.2; }); }
      this.mesh(new THREE.PlaneGeometry(1.6, 2.4), std({ color: '#05070c' }), 0, 1.2, R.z1 + 0.6, { cast: false }).rotation.y = Math.PI;
    } else {
      this.mesh(new THREE.BoxGeometry(1.6, 2.4, 0.07), doorMat, 0.8, 1.2, 0, { parent: this.doorPivot });
      const knob = this.mesh(new THREE.SphereGeometry(0.04, 8, 6), std({ color: '#d4a63c', metalness: 1, roughness: .3 }), 1.4, 1.05, -0.06, { parent: this.doorPivot });
      this.anim.push(() => { this.doorPivot.rotation.y = -this.door.open * 1.6; });
      this.mesh(new THREE.PlaneGeometry(1.6, 2.4), std({ color: '#06080e', emissive: '#0a1430', emissiveIntensity: 1 }), 0, 1.2, R.z1 + 0.9, { cast: false }).rotation.y = Math.PI;
    }
    // exit sign
    const ex = TX.neonSign('EXIT', '#ff3030', { w: 256, h: 96, font: '900 64px system-ui' });
    this.mesh(new THREE.PlaneGeometry(0.6, 0.22), new THREE.MeshBasicMaterial({ map: ex, transparent: true, depthWrite: false }), 0, 2.65, R.z1 - 0.02, { cast: false }).rotation.y = Math.PI;
    // windows on front wall (glowing night street)
    for (const wx of [-4.5, 4.5]) this.window(wx, R.z1 - 0.01, Math.PI);
    if (id !== 'club') this.window(R.x1 - 0.01, 3.2, -Math.PI / 2);

    this.buildBar();
    this.lighting();
    if (id === 'pub') this.pub(); else if (id === 'saloon') this.saloon(); else if (id === 'club') this.club(); else this.road();
  }

  window(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 1.7, z); g.rotation.y = ry; this.root.add(g);
    const frame = std({ color: '#1a0f08', roughness: .5 });
    this.mesh(new THREE.PlaneGeometry(1.6, 1.2), std({ color: '#0a1a33', emissive: '#16305c', emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.4 }), 0, 0, 0.01, { parent: g, cast: false });
    // street light blobs outside
    for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowSprite(pick(['#ffc070', '#ff6060', '#60c0ff'])), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .7 })); sp.position.set(rand(-.6, .6), rand(-.4, .4), 0.02); sp.scale.setScalar(rand(.15, .35)); g.add(sp); }
    for (const [w, h, px, py] of [[1.7, .08, 0, .62], [1.7, .08, 0, -.62], [.08, 1.3, -.82, 0], [.08, 1.3, .82, 0], [.05, 1.2, 0, 0], [1.6, .05, 0, 0]]) this.mesh(new THREE.BoxGeometry(w, h, .06), frame, px, py, .03, { parent: g });
    const pane = { kind: 'window', value: 250, label: 'WINDOW', hp: 1, mesh: g };
    // breakable plane (thin box just inside)
    const b = this.collider(0, 0, 0, 0, 0, 0, { brk: pane, solid: false });
    if (ry === Math.PI) { b.x0 = x - .8; b.x1 = x + .8; b.y0 = 1.1; b.y1 = 2.3; b.z0 = z - .12; b.z1 = z; }
    else { b.x0 = x - .12; b.x1 = x; b.y0 = 1.1; b.y1 = 2.3; b.z0 = z - .8; b.z1 = z + .8; }
    this.breakables.push(b);
  }

  buildBar() {
    const V = this.V, id = V.id, R = ROOM;
    const x0 = id === 'club' ? -6.2 : -6.4, x1 = id === 'club' ? 0.6 : 2.6, z0 = -4.05, z1 = -3.35, h = 1.08;
    const topMat = std({ map: TX.planks('bartop' + id, { base: id === 'club' ? [270, 10, 8] : [18, 55, 16], plankW: 512, rep: [4, 1], gaps: false }), roughness: 0.18, metalness: 0.15 });
    const frontMat = std({ map: TX.panel('barf' + id, { base: id === 'club' ? [280, 30, 12] : [20, 45, 14], rep: [6, 1] }), roughness: 0.55 });
    this.box(x1 - x0, h - 0.06, z1 - z0 - 0.1, frontMat, (x0 + x1) / 2, 0, (z0 + z1) / 2 + 0.05);
    this.box(x1 - x0 + 0.1, 0.06, z1 - z0 + 0.1, topMat, (x0 + x1) / 2, h - 0.06, (z0 + z1) / 2);
    // brass foot rail
    const brass = std({ color: '#c99a3a', metalness: 1, roughness: 0.28 });
    const rail = this.mesh(new THREE.CylinderGeometry(0.025, 0.025, x1 - x0, 8), brass, (x0 + x1) / 2, 0.18, z1 + 0.12); rail.rotation.z = Math.PI / 2;
    if (id === 'club') { const strip = this.mesh(new THREE.BoxGeometry(x1 - x0, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: '#ff2fd0' }), (x0 + x1) / 2, 0.06, z1 + 0.02, { cast: false }); }
    this.collider(x0, x1, 0, h, z0, z1, { bar: true });
    this.barTop = { x0, x1, z0, z1, y: h };
    // taps
    for (let i = 0; i < 4; i++) { const tx = x0 + 1.2 + i * 0.35; const tap = this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 8), brass, tx, h + 0.16, z0 + 0.18); const hd = this.mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), std({ color: pick(['#1c8a3a', '#d4a63c', '#111', '#a02020']) }), tx, h + 0.36, z0 + 0.2); this.taps.push({ x: tx, z: z0 + 0.2 }); }
    // back bar: cabinet, shelves, bottles, mirror
    const bz = R.z0 + 0.32;
    this.box(x1 - x0 + 0.4, 0.95, 0.55, frontMat, (x0 + x1) / 2, 0, bz);
    this.collider(x0 - 0.2, x1 + 0.2, 0, 0.95, R.z0, bz + 0.28, {});
    const mirror = this.mesh(new THREE.PlaneGeometry(x1 - x0 - 0.6, 1.0), std({ color: '#7d8ea0', metalness: 1, roughness: 0.08, envMapIntensity: 1 }), (x0 + x1) / 2, 1.6, R.z0 + 0.03, { cast: false });
    const mb = this.collider((x0 + x1) / 2 - (x1 - x0 - 0.6) / 2, (x0 + x1) / 2 + (x1 - x0 - 0.6) / 2, 1.1, 2.1, R.z0, R.z0 + 0.18, { brk: { kind: 'mirror', value: 400, label: 'BAR MIRROR', hp: 1, mesh: mirror }, solid: false });
    this.breakables.push(mb);
    const shelfMat = std({ color: '#2a160a', roughness: 0.5 });
    const glassCols = ['#1d6b2e', '#5a2a0a', '#7a5a10', '#a8c8d0', '#3a0a0a', '#2a3a1a', '#d4a63c'];
    for (const sy of [1.15, 1.62, 2.1]) {
      this.box(x1 - x0 + 0.2, 0.04, 0.3, shelfMat, (x0 + x1) / 2, sy - 0.04, R.z0 + 0.2, { cast: false });
      // bottles as instanced mesh
      const n = Math.floor((x1 - x0) / 0.16);
      const geo = bottleGeo(); const mat = std({ color: '#fff', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85, vertexColors: false });
      const inst = new THREE.InstancedMesh(geo, mat, n); inst.castShadow = false; const m4 = new THREE.Matrix4(), col = new THREE.Color();
      const items = [];
      for (let i = 0; i < n; i++) { const bx = x0 + 0.1 + i * 0.16 + rand(-0.02, 0.02), s = rand(0.85, 1.15); m4.compose(new THREE.Vector3(bx, sy, R.z0 + 0.2), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); inst.setMatrixAt(i, m4); inst.setColorAt(i, col.set(pick(glassCols))); items.push({ x: bx, y: sy, alive: true }); }
      this.root.add(inst);
      const sh = { inst, items, y: sy };
      this.glassShelves.push(sh);
      const b = this.collider(x0, x1, sy, sy + 0.34, R.z0, R.z0 + 0.4, { shelf: sh, solid: false }); this.breakables.push(b);
    }
    // neon sign above back bar
    const [txt, col, sub] = V.sign;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.3), new THREE.MeshBasicMaterial({ map: TX.neonSign(txt, col, { w: 1024, h: 320, font: `900 ${txt.length > 12 ? 120 : 150}px ${id === 'saloon' ? 'Georgia, serif' : id === 'club' ? 'Impact, system-ui' : 'Georgia, serif'}`, sub, subFont: '700 48px system-ui' }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sign.position.set((x0 + x1) / 2, 2.85, R.z0 + 0.05); this.root.add(sign); this.neon = sign;
    const nl = new THREE.PointLight(col, 6, 7, 1.6); nl.position.set((x0 + x1) / 2, 2.6, R.z0 + 0.8); this.root.add(nl); this.neonLight = nl;
    this.anim.push(t => { const f = (Math.sin(t * 37) > 0.97 && Math.sin(t * 0.7) > 0.6) ? 0.35 : 1; sign.material.opacity = f; nl.intensity = 6 * f; });
    // bar stools (props) and mugs (drinkable props)
    for (let i = 0; i < 6; i++) {
      const sx = x0 + 0.7 + i * ((x1 - x0 - 1.2) / 5), sz = z1 + 0.55;
      this.hooks.spawnProp('stool', sx, 0, sz, { rest: true });
      this.seats.push({ x: sx, z: sz, yaw: Math.PI, h: 0.74, stool: true, bar: true });
      if (chance(0.7)) this.hooks.spawnProp(chance(0.6) ? 'mug' : 'bottle', sx + rand(-0.15, 0.15), h, z0 + 0.42 + rand(0, 0.15), { rest: true });
    }
    this.hooks.spawnProp('pitcher', x0 + 0.5, h, z0 + 0.35, { rest: true });
  }

  pendant(x, z, color, cone = true, y = ROOM.h - 0.9) {
    const shade = std({ color: this.V.id === 'club' ? '#111' : '#1a3a20', metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide });
    this.mesh(new THREE.CylinderGeometry(0.01, 0.01, ROOM.h - y, 4), shade, x, y + (ROOM.h - y) / 2, z, { cast: false });
    this.mesh(new THREE.ConeGeometry(0.28, 0.22, 16, 1, true), shade, x, y, z, { cast: false });
    const bulb = this.mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0d0 }), x, y - 0.08, z, { cast: false });
    const gs = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowSprite('#ffd9a0'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); gs.position.set(x, y - 0.1, z); gs.scale.setScalar(0.9); this.root.add(gs);
    if (cone) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.1, y - 0.1, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); c.position.set(x, (y - 0.1) / 2, z); this.root.add(c); }
    const l = new THREE.PointLight(color, 9, 7.5, 1.7); l.position.set(x, y - 0.15, z); this.root.add(l); this.lights.push(l);
    return l;
  }
  lighting() {
    const V = this.V;
    this.scene.add(this.hemi = new THREE.HemisphereLight(V.id === 'club' ? 0x6040a0 : 0x705040, 0x100804, V.id === 'club' ? 0.55 : 0.5));
    this.root.add(this.hemi);
    const sp = new THREE.SpotLight(V.light, 60, 16, 0.95, 0.6, 1.4); sp.position.set(0.5, ROOM.h - 0.05, 0.8); sp.target.position.set(0.5, 0, 0.5);
    sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0005; sp.shadow.camera.near = 0.5; sp.shadow.camera.far = 8; this.root.add(sp); this.root.add(sp.target); this.key = sp;
    // over the bar
    for (const x of [-4.5, -1.8]) this.pendant(x, -3.2, V.light, false);
  }

  table(x, z, { round = true, chairs = 2, items = 2, w = 1.0 } = {}) {
    const g = new THREE.Group(); g.position.set(x, 0, z); this.root.add(g);
    const wood = std({ map: TX.planks('tab' + this.V.id, { base: [22, 42, 20], plankW: 128, rep: [1, 1], gaps: false }), roughness: 0.35 });
    const iron = std({ color: '#1a1a1a', metalness: .7, roughness: .4 });
    if (round) { this.mesh(new THREE.CylinderGeometry(w * 0.55, w * 0.55, 0.05, 24), wood, 0, 0.76, 0, { parent: g }); this.mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.74, 8), iron, 0, 0.37, 0, { parent: g }); this.mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.04, 16), iron, 0, 0.02, 0, { parent: g }); }
    else { this.mesh(new THREE.BoxGeometry(w * 1.3, 0.06, w * 0.9), wood, 0, 0.76, 0, { parent: g }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.mesh(new THREE.BoxGeometry(0.07, 0.74, 0.07), wood, sx * w * 0.58, 0.37, sz * w * 0.38, { parent: g }); }
    const hw = round ? w * 0.5 : w * 0.65, hd = round ? w * 0.5 : w * 0.45;
    const b = this.collider(x - hw, x + hw, 0, 0.79, z - hd, z + hd, { brk: { kind: 'table', value: 120, label: 'TABLE', hp: 2, mesh: g }, top: 0.79 });
    this.breakables.push(b);
    const ang0 = rand(0, 6);
    for (let i = 0; i < chairs; i++) {
      const a = ang0 + i / chairs * Math.PI * 2, cx = x + Math.sin(a) * (hw + 0.42), cz = z + Math.cos(a) * (hd + 0.42);
      this.hooks.spawnProp(this.V.id === 'club' ? 'stool' : 'chair', cx, 0, cz, { rest: true, yaw: a + Math.PI });
      this.seats.push({ x: cx, z: cz, yaw: a + Math.PI, h: 0.5, table: b });
    }
    for (let i = 0; i < items; i++) this.hooks.spawnProp(pick(['mug', 'mug', 'bottle', 'bottle', 'glass']), x + rand(-hw * .6, hw * .6), 0.79, z + rand(-hd * .6, hd * .6), { rest: true });
    return b;
  }

  poolTable(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); this.root.add(g);
    const wood = std({ color: '#3a1a0a', roughness: .35 }), feltM = std({ map: TX.felt(this.V.id === 'road' ? '#7a1010' : '#0e6a3a'), roughness: .95 });
    this.mesh(new THREE.BoxGeometry(2.5, 0.12, 1.4), wood, 0, 0.74, 0, { parent: g }); this.mesh(new THREE.BoxGeometry(2.24, 0.02, 1.14), feltM, 0, 0.81, 0, { parent: g, cast: false });
    for (const [w, d, px, pz] of [[2.5, 0.13, 0, .635], [2.5, 0.13, 0, -.635], [.13, 1.4, 1.185, 0], [.13, 1.4, -1.185, 0]]) this.mesh(new THREE.BoxGeometry(w, 0.08, d), wood, px, 0.85, pz, { parent: g });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), wood, sx * 1.05, 0.35, sz * .55, { parent: g });
    this.collider(x - 1.25, x + 1.25, 0, 0.89, z - 0.7, z + 0.7, { top: 0.82 });
    for (let i = 0; i < 7; i++) this.hooks.spawnProp('ball', x + rand(-0.9, 0.9), 0.82, z + rand(-0.4, 0.4), { rest: true, color: ['#ffffff', '#ffd400', '#1f4fd8', '#d81f1f', '#6a1fd8', '#ff7a00', '#111'][i] });
    this.hooks.spawnProp('cue', x - 0.3, 0.86, z + 0.2, { rest: true, yaw: 0.3 });
    this.hooks.spawnProp('cue', x + 0.4, 0, z + 1.05, { rest: true, yaw: 1.5 });
    this.stands.push({ x: x - 1.6, z: z + 0.3 }, { x: x + 1.6, z: z - 0.2 }, { x: x + 0.3, z: z + 1.2 });
    const l = this.pendant(x - 0.6, z, this.V.light, true, ROOM.h - 1.2); this.pendant(x + 0.6, z, this.V.light, true, ROOM.h - 1.2);
  }

  jukebox(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; this.root.add(g);
    const body = std({ color: '#5a1a0a', roughness: .3, metalness: .3 });
    this.mesh(new THREE.BoxGeometry(0.9, 1.2, 0.55), body, 0, 0.6, 0, { parent: g });
    const top = this.mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.55, 20, 1, false, 0, Math.PI), body, 0, 1.2, 0, { parent: g }); top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2;
    const glowM = new THREE.MeshBasicMaterial({ color: '#ffb13c' });
    const arch = this.mesh(new THREE.TorusGeometry(0.38, 0.03, 8, 24, Math.PI), glowM, 0, 1.2, 0.28, { parent: g, cast: false });
    const win = this.mesh(new THREE.PlaneGeometry(0.6, 0.35), new THREE.MeshBasicMaterial({ color: '#ff5ab0' }), 0, 0.9, 0.281, { parent: g, cast: false });
    const l = new THREE.PointLight('#ff7a3c', 3, 3.5); l.position.set(0, 1.0, 0.6); g.add(l);
    this.anim.push(t => { glowM.color.setHSL((t * 0.15) % 1, 0.9, 0.6); win.material.color.setHSL((t * 0.15 + 0.5) % 1, 0.9, 0.55); });
    const c = Math.abs(Math.sin(ry)) > 0.5 ? [0.3, 0.45] : [0.45, 0.3];
    const b = this.collider(x - c[0], x + c[0], 0, 1.5, z - c[1], z + c[1], { brk: { kind: 'jukebox', value: 600, label: 'JUKEBOX', hp: 3, mesh: g, light: l } });
    this.breakables.push(b);
  }

  wallDecor(tex, x, y, z, ry, w = 0.7, h = 1.0) { const m = this.mesh(new THREE.PlaneGeometry(w, h), std({ map: tex, roughness: .7 }), x, y, z, { cast: false }); m.rotation.y = ry; return m; }

  pub() {
    this.table(-4.2, 1.2); this.table(-1.5, 3.2); this.table(-4.6, 4.0, { chairs: 3 }); this.table(5.6, 4.2, { round: false, chairs: 2, items: 3 });
    this.poolTable(3.3, 0.3);
    this.jukebox(7.0, -2.6, -Math.PI / 2);
    // dartboard on left wall
    const db = this.mesh(new THREE.CircleGeometry(0.28, 32), std({ map: TX.dartboard(), roughness: .8 }), ROOM.x0 + 0.03, 1.73, -1.2, { cast: false }); db.rotation.y = Math.PI / 2;
    this.mesh(new THREE.BoxGeometry(0.04, 0.85, 0.85), std({ color: '#1a0f08' }), ROOM.x0 + 0.02, 1.73, -1.2, { cast: false });
    this.stands.push({ x: -5.0, z: -1.2 }, { x: -4.6, z: -0.4 });
    this.wallDecor(TX.poster('beer'), ROOM.x0 + 0.02, 1.9, 2.8, Math.PI / 2, 0.6, 0.85);
    this.wallDecor(TX.poster('band'), ROOM.x1 - 0.02, 1.9, 0.8, -Math.PI / 2, 0.6, 0.85);
    this.hooks.spawnProp('keg', 6.6, 0, -4.9, { rest: true }); this.hooks.spawnProp('keg', 6.0, 0, -5.2, { rest: true });
    this.hooks.spawnProp('extinguisher', -7.1, 0, 5.4, { rest: true });
    this.pendant(-4.2, 1.2, this.V.light); this.pendant(-1.5, 3.2, this.V.light); this.pendant(5.0, 4.0, this.V.light);
    this.stands.push({ x: 0.5, z: -1.5 }, { x: -2.5, z: -1.6 }, { x: 1.2, z: 2.0 });
  }
  saloon() {
    this.table(-4.0, 1.0, { chairs: 3 }); this.table(-1.0, 3.5); this.table(5.4, 4.0, { round: false, chairs: 3, items: 3 });
    this.table(2.4, 1.2, { round: false, chairs: 4, items: 2, w: 1.2 }); // poker table
    // piano on right wall
    const g = new THREE.Group(); g.position.set(6.95, 0, -1.6); g.rotation.y = -Math.PI / 2; this.root.add(g);
    const pw = std({ color: '#1a0c06', roughness: .25, metalness: .1 });
    this.mesh(new THREE.BoxGeometry(1.6, 1.3, 0.55), pw, 0, 0.65, 0, { parent: g }); this.mesh(new THREE.BoxGeometry(1.5, 0.08, 0.3), std({ color: '#eee' }), 0, 0.8, 0.4, { parent: g });
    for (let i = 0; i < 20; i++) this.mesh(new THREE.BoxGeometry(0.035, 0.03, 0.18), std({ color: '#111' }), -0.7 + i * 0.075, 0.845, 0.36, { parent: g, cast: false });
    const pb = this.collider(6.5, 7.5, 0, 1.3, -2.4, -0.8, { brk: { kind: 'piano', value: 900, label: 'PIANO', hp: 3, mesh: g } }); this.breakables.push(pb);
    this.stands.push({ x: 5.8, z: -1.6 });
    // wagon wheel chandelier
    const wh = new THREE.Group(); wh.position.set(0, ROOM.h - 0.9, 0.5); this.root.add(wh);
    const wood = std({ color: '#3a220e', roughness: .6 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 6, 32), wood); rim.rotation.x = Math.PI / 2; wh.add(rim);
    for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(2, 0.04, 0.04), wood); sp.rotation.y = i / 6 * Math.PI; wh.add(sp); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), std({ color: '#efe2c0' })); c.position.set(Math.cos(a), 0.08, Math.sin(a)); wh.add(c); const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowSprite('#ffb040'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); fl.scale.setScalar(0.25); fl.position.set(Math.cos(a), 0.2, Math.sin(a)); wh.add(fl); }
    const wl = new THREE.PointLight('#ffa040', 10, 8, 1.5); wl.position.set(0, ROOM.h - 1.1, 0.5); this.root.add(wl);
    this.anim.push(t => { wl.intensity = 9 + Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3) * 0.5; wh.rotation.y = Math.sin(t * 0.4) * 0.05; });
    for (const [px, pz] of [[-7.48, -0.5], [-7.48, 2.2], [-7.48, 4.4]]) this.wallDecor(TX.poster('wanted'), px, 1.85, pz, Math.PI / 2, 0.55, 0.78);
    for (const [bx, bz] of [[6.7, 5.3], [6.1, 5.4], [-6.8, -2.6]]) this.hooks.spawnProp('barrel', bx, 0, bz, { rest: true });
    this.hooks.spawnProp('guitar', 6.4, 0, -0.3, { rest: true });
    this.hooks.spawnProp('extinguisher', -7.1, 0, 5.4, { rest: true });
    this.pendant(-4.0, 1.0, this.V.light); this.pendant(5.0, 4.0, this.V.light);
    this.stands.push({ x: 0.5, z: -1.5 }, { x: -2.5, z: -1.6 }, { x: 3.8, z: 2.6 }, { x: 1.0, z: 0 });
  }
  club() {
    // LED dance floor
    const cols = 6, rows = 4, sz = 0.9, fx = 2.6, fz = 0.6;
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(sz * 0.98, 0.04, sz * 0.98), new THREE.MeshBasicMaterial({ map: TX.floorLED() }), cols * rows); const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { m4.makeTranslation(fx + (i - cols / 2 + 0.5) * sz, 0.02, fz + (j - rows / 2 + 0.5) * sz); inst.setMatrixAt(i * rows + j, m4); inst.setColorAt(i * rows + j, col.set('#333')); }
    this.root.add(inst);
    const pal = ['#ff2fd0', '#00e5ff', '#ffe14d', '#3cff8a', '#7a3cff', '#ff6a1a'];
    this.anim.push(t => { const beat = Math.floor(t * 122 / 60); for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const k = (i + j + beat) % 3 === 0 || ((i * 7 + j * 3 + beat) % 5 === 0); inst.setColorAt(i * rows + j, col.set(k ? pal[(i + j * 2 + beat) % pal.length] : '#222')); } inst.instanceColor.needsUpdate = true; });
    const dl = new THREE.PointLight('#ff2fd0', 8, 6, 1.5); dl.position.set(fx, 0.6, fz); this.root.add(dl);
    this.anim.push(t => { dl.color.setHSL((t * 0.25) % 1, 1, 0.55); });
    for (let i = 0; i < cols; i += 2) for (let j = 0; j < rows; j += 2) this.stands.push({ x: fx + (i - cols / 2 + 0.5) * sz, z: fz + (j - rows / 2 + 0.5) * sz, dance: true });
    // disco ball + roaming spots
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), std({ color: '#ddd', metalness: 1, roughness: 0.15, flatShading: true })); ball.position.set(fx, ROOM.h - 0.6, fz); this.root.add(ball);
    const spots = [];
    for (let i = 0; i < 3; i++) { const s = new THREE.SpotLight(pal[i], 30, 10, 0.25, 0.4, 1); s.position.copy(ball.position); this.root.add(s); this.root.add(s.target); spots.push(s); }
    this.anim.push(t => { ball.rotation.y = t * 0.8; spots.forEach((s, i) => { const a = t * (0.6 + i * 0.2) + i * 2; s.target.position.set(fx + Math.cos(a) * 4, 0, fz + Math.sin(a * 1.3) * 3.5); }); });
    // DJ booth on a riser at back-right
    const dj = new THREE.Group(); dj.position.set(5.6, 0, -4.3); this.root.add(dj);
    const black = std({ color: '#0d0d12', roughness: .4, metalness: .4 });
    this.mesh(new THREE.BoxGeometry(2.4, 1.05, 0.8), black, 0, 0.52, 0, { parent: dj });
    const front = this.mesh(new THREE.PlaneGeometry(2.3, 0.9), new THREE.MeshBasicMaterial({ map: TX.neonSign('DJ', '#00e5ff', { w: 512, h: 200, font: '900 150px Impact' }), transparent: true }), 0, 0.55, 0.405, { parent: dj, cast: false });
    for (const sx of [-0.6, 0.6]) { const pl = this.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), std({ color: '#111', metalness: .5, roughness: .3 }), sx, 1.07, 0, { parent: dj }); this.anim.push(t => { pl.rotation.y = t * 3; }); }
    const djb = this.collider(4.4, 6.8, 0, 1.08, -4.7, -3.9, { brk: { kind: 'decks', value: 800, label: 'DJ DECKS', hp: 3, mesh: dj } }); this.breakables.push(djb);
    // speakers
    for (const sx of [3.8, 7.1]) { this.box(0.6, 1.6, 0.6, black, sx, 0, -5.3); const cone = this.mesh(new THREE.CircleGeometry(0.22, 20), std({ color: '#222', metalness: .6 }), sx, 1.1, -4.99, { cast: false }); this.anim.push(t => { cone.scale.setScalar(1 + Math.max(0, Math.sin(t * 122 / 60 * Math.PI * 2)) * 0.08); }); this.collider(sx - 0.3, sx + 0.3, 0, 1.6, -5.6, -5.0, {}); }
    // neon tubes along walls
    for (const [x, z, ry, c] of [[ROOM.x0 + 0.03, 0, Math.PI / 2, '#00e5ff'], [ROOM.x1 - 0.03, 1.5, -Math.PI / 2, '#ff2fd0']]) { const tube = this.mesh(new THREE.BoxGeometry(10, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: c }), x, 2.9, z, { cast: false }); tube.rotation.y = ry; const l = new THREE.PointLight(c, 3, 5); l.position.set(x + (ry > 0 ? 0.5 : -0.5), 2.6, z); this.root.add(l); }
    this.wallDecor(TX.poster('disco'), ROOM.x0 + 0.02, 1.8, 3.6, Math.PI / 2, 0.6, 0.85);
    this.table(-4.6, 2.4, { chairs: 3, w: 0.8 }); this.table(-2.0, 4.3, { chairs: 2, w: 0.8 }); this.table(-5.2, -0.6, { chairs: 2, w: 0.8 });
    this.hooks.spawnProp('extinguisher', -7.1, 0, 5.4, { rest: true });
    this.pendant(-4.6, 2.4, '#b06bff'); this.pendant(-2.0, 4.3, '#ff6bd0', false);
    this.stands.push({ x: -1.5, z: -1.6 }, { x: 0.2, z: -2.3 });
  }
  road() {
    this.table(-4.4, 1.6, { round: false, chairs: 3 }); this.table(-1.6, 3.6); this.table(-5.0, 4.4, { chairs: 2 });
    this.poolTable(2.9, -0.6);
    // motorcycles parked inside (expensive breakables)
    for (const [mx, mz, ry] of [[5.6, 3.6, 0.4], [6.3, 1.4, -0.3]]) {
      const g = new THREE.Group(); g.position.set(mx, 0, mz); g.rotation.y = ry; this.root.add(g);
      const chrome = std({ color: '#ccc', metalness: 1, roughness: .2 }), paint = std({ color: pick(['#a01010', '#1a1a1a', '#d4a63c']), metalness: .5, roughness: .25 }), tire = std({ color: '#111', roughness: .9 });
      for (const wz of [-0.7, 0.7]) { const w = this.mesh(new THREE.TorusGeometry(0.3, 0.09, 10, 24), tire, 0, 0.36, wz, { parent: g }); w.rotation.y = Math.PI / 2; const hub = this.mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), chrome, 0, 0.36, wz, { parent: g }); hub.rotation.z = Math.PI / 2; }
      this.mesh(new THREE.BoxGeometry(0.28, 0.3, 0.7), paint, 0, 0.75, 0.1, { parent: g }); this.mesh(new THREE.BoxGeometry(0.24, 0.12, 0.6), std({ color: '#140c08' }), 0, 0.88, -0.35, { parent: g });
      this.mesh(new THREE.BoxGeometry(0.3, 0.3, 0.4), chrome, 0, 0.5, 0, { parent: g }); const hb = this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), chrome, 0, 1.05, 0.6, { parent: g }); hb.rotation.z = Math.PI / 2;
      const b = this.collider(mx - 0.5, mx + 0.5, 0, 1.0, mz - 0.95, mz + 0.95, { brk: { kind: 'bike', value: 1500, label: 'SOMEBODY\'S HOG', hp: 3, mesh: g } }); this.breakables.push(b);
    }
    // stage with guitar + amp
    const stage = std({ map: TX.planks('stage', { base: [25, 30, 18], rep: [2, 1] }), roughness: .6 });
    this.hooks.spawnProp('guitar', -6.3, 0, -1.4, { rest: true });
    this.box(0.7, 0.8, 0.45, std({ color: '#151515', roughness: .6 }), -6.9, 0, -0.4); this.collider(-7.25, -6.55, 0, 0.8, -0.65, -0.15, {});
    for (const [bx, bz] of [[6.9, -5.3], [6.3, -5.4], [-6.9, 5.3]]) this.hooks.spawnProp('drum', bx, 0, bz, { rest: true });
    this.hooks.spawnProp('extinguisher', -7.1, 0, 3.2, { rest: true });
    this.hooks.spawnProp('keg', 6.9, 0, -3.0, { rest: true });
    this.wallDecor(TX.poster('moto'), ROOM.x0 + 0.02, 1.85, 2.6, Math.PI / 2, 0.6, 0.85);
    // license plates
    for (let i = 0; i < 6; i++) { const m = this.mesh(new THREE.PlaneGeometry(0.34, 0.17), std({ color: pick(['#e8e0c0', '#c0d8f0', '#f0e080']), metalness: .5, roughness: .4 }), ROOM.x1 - 0.02, 1.6 + (i % 2) * 0.25, -4.6 + Math.floor(i / 2) * 0.4, { cast: false }); m.rotation.y = -Math.PI / 2; m.rotation.x = rand(-.1, .1); }
    this.pendant(-4.4, 1.6, this.V.light); this.pendant(-1.6, 3.6, this.V.light, false); this.pendant(5.6, 2.6, this.V.light);
    this.stands.push({ x: 0.5, z: -2.0 }, { x: -2.5, z: -1.6 }, { x: 4.6, z: 2.4 }, { x: -5.8, z: -1.0 });
  }

  // ---- breakage ---------------------------------------------------------
  // called with a collider that has .brk or .shelf; strength ~ impact speed
  hit(b, strength, pos, fx) {
    if (b.dead) return false;
    if (b.shelf) {
      const sh = b.shelf; let n = 0; const m4 = new THREE.Matrix4();
      for (let i = 0; i < sh.items.length; i++) { const it = sh.items[i]; if (!it.alive) continue; if (Math.abs(it.x - pos.x) < 0.16 + Math.min(strength, 16) * 0.012) { it.alive = false; n++; m4.makeScale(0, 0, 0); sh.inst.setMatrixAt(i, m4); fx.glass(new THREE.Vector3(it.x, it.y + 0.15, ROOM.z0 + 0.25), 10); } }
      if (n) { sh.inst.instanceMatrix.needsUpdate = true; this.hooks.tab(n * 25, n > 2 ? `TOP SHELF x${n}` : 'TOP SHELF', pos); this.hooks.sound('glass', 1.2); }
      return n > 0;
    }
    const k = b.brk; if (!k) return false;
    if (strength < 5 && k.kind !== 'window' && k.kind !== 'mirror') return false;
    k.hp -= strength > 11 ? 2 : 1;
    if (k.kind === 'piano') this.hooks.sound('strum', 1);
    if (k.hp > 0) { this.hooks.sound(k.kind === 'bike' || k.kind === 'jukebox' || k.kind === 'decks' ? 'metal' : 'wood', 0.8); if (k.mesh) { k.mesh.rotation.z = (Math.random() - .5) * 0.06; } return true; }
    b.dead = true;
    const c = new THREE.Vector3((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    if (k.kind === 'table') {
      this.root.remove(k.mesh); this.hooks.sound('crash', 1.2); fx.splinters(c, 18);
      for (let i = 0; i < 2; i++) this.hooks.spawnProp('plank', c.x + rand(-.3, .3), 0.3, c.z + rand(-.3, .3), { vel: new THREE.Vector3(rand(-2, 2), rand(2, 4), rand(-2, 2)) });
      this.hooks.spawnProp('leg', c.x, 0.3, c.z, { vel: new THREE.Vector3(rand(-2, 2), 3, rand(-2, 2)) });
      this.hooks.dropFrom(b); // props sitting on top fall
    } else if (k.kind === 'window' || k.kind === 'mirror') {
      this.hooks.sound('glass', 1.5); fx.glass(c, 40);
      k.mesh.traverse(o => { if (o.material && o.material.emissive) { o.material = o.material.clone(); o.material.color.set('#05070c'); o.material.emissive.set('#000'); } if (o.isMesh && k.kind === 'mirror') { o.material = o.material.clone(); o.material.roughness = 0.6; o.material.color.set('#3a4048'); } });
      if (k.kind === 'mirror') { // crack lines
        const cr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0), new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, depthWrite: false })); cr.position.set(pos.x, 1.6, ROOM.z0 + 0.04); this.root.add(cr);
      }
    } else if (k.kind === 'jukebox') { this.hooks.sound('metal', 1.4); fx.sparks(c, 40); if (k.light) k.light.intensity = 0; this.hooks.jukeboxDead(); k.mesh.rotation.z = 0.25; }
    else if (k.kind === 'piano') { this.hooks.sound('crash', 1.5); fx.splinters(c, 30); k.mesh.rotation.x = 0.1; k.mesh.position.y -= 0.15; }
    else if (k.kind === 'bike') { this.hooks.sound('metal', 1.5); fx.sparks(c, 50); k.mesh.rotation.z = 1.3; k.mesh.position.y = 0.3; b.y1 = 0.6; b.dead = false; b.brk = null; }
    else if (k.kind === 'decks') { this.hooks.sound('metal', 1.4); fx.sparks(c, 50); this.hooks.jukeboxDead(); }
    this.hooks.tab(k.value, k.label, c);
    return true;
  }
  update(dt) { this.t += dt; for (const f of this.anim) f(this.t); this.door.open = Math.max(0, this.door.open - dt * 0.35); }
  dispose() { this.scene.remove(this.root); this.scene.remove(this.hemi); }
}

function crackTex() { return TX.memo('crack', () => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.strokeStyle = 'rgba(230,240,255,.9)'; x.lineWidth = 1.5; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(128, 128); let px = 128, py = 128; const a = i / 14 * 6.28; for (let s = 0; s < 6; s++) { px += Math.cos(a + (Math.random() - .5)) * 22; py += Math.sin(a + (Math.random() - .5)) * 22; x.lineTo(px, py); } x.stroke(); } for (let r = 20; r < 100; r += 30) { x.beginPath(); x.arc(128, 128, r, 0, 7); x.stroke(); } const t = new THREE.CanvasTexture(c); return t; }); }

let _bg = null;
export function bottleGeo() {
  if (_bg) return _bg;
  const pts = [[0, 0], [0.034, 0], [0.036, 0.01], [0.036, 0.17], [0.03, 0.2], [0.014, 0.24], [0.012, 0.3], [0.015, 0.31], [0, 0.31]].map(([x, y]) => new THREE.Vector2(x, y));
  _bg = new THREE.LatheGeometry(pts, 12); return _bg;
}
