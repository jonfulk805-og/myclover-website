# Dead Circuit: Warzone

A single-player arcade combat game that runs in the browser. You pilot a combat drone through a suburb overrun by zombie machines. Destroy all 24 robots and all 16 machine strongholds across three sectors.

A MyClover.Tech arcade game. Play it at https://myclover.tech/games/dead-circuit/

## Run it locally

The game uses ES modules, so browsers won't run it from `file://`. Serve the folder with any static web server:

```bash
# Python 3, from inside this folder
python -m http.server 8000
# then open http://localhost:8000/
```

Node works too: `npx serve .`

## Host it

Upload the whole folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, Hostinger, nginx). The game has no build step, no server code and no external requests. Everything loads from relative paths.

## Files

| Path | What it is |
|---|---|
| `index.html` | Page shell, HUD and menus |
| `css/style.css` | Military sci-fi interface styling |
| `js/game.js` | Game loop, combat, AI, HUD, input, saves |
| `js/world.js` | Procedural neighbourhood: road, houses, yards, trees, props |
| `js/entities.js` | Drone, robot, turret and lock-reticle models |
| `js/fx.js` | Particles, debris, explosions, flash lights, decals |
| `js/textures.js` | Procedural canvas textures (asphalt, grass, siding, rust and others) |
| `js/audio.js` | Procedural WebAudio sound effects and music |
| `js/three.module.min.js`, `js/addons/` | three.js r170 (MIT), vendored |
| `assets/clover.png` | MyClover logo |

Every texture, model and sound is generated in code. There are no image or audio asset files to manage.

## Controls

| Input | Action |
|---|---|
| WASD / arrow keys | Move the drone |
| Hold Space (or left mouse) | Fire at the locked target |
| Q | Cycle targets (manual lock) |
| E | Shockwave (7 s recharge) |
| Shift | Boost |
| P / Esc | Pause |
| M | Sound on/off |

## Tuning

The constants at the top of `js/game.js` control the game:
- `SECTORS` sets the lots, robots, strongholds and brutes per sector (totals must stay at 24 robots and 16 strongholds).
- `DIFFS` sets damage, fire rate, bolt speed and score multiplier for Recruit, Veteran and Elite.
- `FIRE_CD`, `SHOCK_R`, `SHOCK_CD`, `SPEED` and `BOOST_*` set the player weapons and movement.

Personal bests are saved in `localStorage` per difficulty (`dcw_best_<difficulty>`). The graphics setting (High/Low) is in the title and pause menus. Low turns off shadows and bloom for older machines.

Add `?manual` to the URL to stop the render loop for automated testing. `window.__DC` exposes `step(n)`, `render()` and the game state.

## Credits

- [three.js](https://threejs.org) by Ricardo Cabello (mrdoob) and contributors, MIT license (see `js/THREE_LICENSE.txt`).
- Game brief from Jon Fulkerson / MyClover.Tech. Built by Viktor.
