# CLOVER LANES
Static ES-module 3D bowling game, served with any HTTP server. No build step.

Open `index.html` through an HTTP server. WebGL is required.

- Solo: ten-frame regulation scoring, including tenth-frame fill balls.
- Two players: pass-and-play, alternate whole frames.
- Practice: endless racks, reset after two throws or a cleared deck.
- Position, aim, power and hook controls, three oil patterns, optional bumpers.
- Physics: cannon-es rigid bodies at 120 Hz, compound pin colliders, ball/pin contacts.
- Hook is an arcade approximation of the oil transition, not a professional ball-motion simulator.
- DOM range inputs support touch and keyboard. Space/Enter bowl, Enter advances, P/Escape pauses.

Credits: three.js (MIT, mrdoob and contributors) and cannon-es (MIT, pmndrs and contributors).
Their unmodified libraries and licenses are vendored in js/.
All scene geometry, textures and audio are generated procedurally by MyClover.Tech.

Testing: `node tests.mjs` for scoring and physics. `?manual` disables animation;
`window.__BL` exposes deterministic stepping for UI tests.
