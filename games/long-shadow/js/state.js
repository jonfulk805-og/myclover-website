// LONG SHADOW - shared mutable state
export const G = {
  state: 'boot', contract: null, cIdx: 0, diff: 'normal', D: null, t: 0, clock: 0, ts: 1,
  agents: [], bullets: [], tracers: [], popups: [], banner: null,
  alarm: 'none', alarmT: 0, lastSeenT: 0, lastKnown: null, shotsHeard: 0, shotHeardT: [],
  mask: { until: 0, kind: '', warnAt: 0, warnKind: '' }, nextMask: {},
  stats: null, over: false, overT: 0, result: null, killcam: null, nv: false, map: false,
  hitT: 0, hitKind: '', dmgT: 0, dmgDir: 0, heliState: 'idle', heliT: 0, aboard: [], flash: 0,
};
export const P = {
  x: 0, y: 0, z: 0, yaw: Math.PI, pitch: 0, stance: 0, eye: 1.62, eyeT: 1.62, vx: 0, vz: 0, speed: 0, hp: 100, max: 100, regenT: 0,
  scoped: false, scopeK: 0, binoc: false, zoomI: 2, sway: 0, swayX: 0, swayY: 0, breath: 1, holding: false, breathLock: 0, heart: 70,
  mag: 5, magType: 'super', ammo: { super: 20, sub: 10 }, fireCD: 0, reloadT: 0, reloadDur: 0, boltT: 0, pendingType: null, recoil: 0,
  vis: 0, inBush: false, inLight: false, glint: false, dead: false, tagAim: null, tagK: 0, bob: 0, range: 0,
};
export const inp = { mx: 0, mz: 0, fire: false, fireEdge: false, scope: false, breath: false, sprint: false, lx: 0, ly: 0 };
export const REF = {};
export const ZOOMS = [4, 6, 9, 13, 18];
export const STANCE = [{ name: 'Standing', eye: 1.62, spd: 3.1, vis: 1, sway: 1 }, { name: 'Crouched', eye: 1.02, spd: 1.6, vis: 0.55, sway: 0.6 }, { name: 'Prone', eye: 0.34, spd: 0.65, vis: 0.18, sway: 0.28 }];
export const AMMO = { super: { label: 'Supersonic', v: 860, short: 'SUPER' }, sub: { label: 'Subsonic', v: 315, short: 'SUB' } };
export const GRAV = 9.81;
