---
name: Headless harness for the globe WebView scene
description: How to run the Three.js WebView scene under Node with stubs, and the exact stub gaps that block boot.
---

The globe/solar-system scene is JS-in-a-template-literal injected into a WebView,
so nothing about it can be verified by `tsc` alone. The way to actually check it
is to compile `constants/globe/*.ts` to CommonJS, pull the script body out of
`GLOBE_HTML`, and run it under Node's `vm` with stubbed `THREE` + DOM.

**Why:** there is no GPU in this environment and screenshots of the app never
show WebGL content — only app boot and RN layout. Scene-graph structure,
per-frame update logic, and "does it throw" are otherwise unverifiable.

**How to apply:** build the harness in `/tmp` (it is scratch, and `/tmp` is wiped
between sessions, so expect to rewrite it). Stub gaps that have each cost a
debug round-trip, in the order boot hits them:

- `window.WebGLRenderingContext` must exist — the preamble's `hasWebGL()` guard
  checks it and otherwise posts `{type:'error',reason:'webgl-unavailable'}` and
  installs no-op stubs, so the whole engine silently never runs.
- `renderer.domElement` needs `addEventListener` / `getBoundingClientRect`;
  input binds touch handlers to it, not to the canvas from `document`.
- `renderer.capabilities.getMaxAnisotropy()` is called during Earth Mode init.
- `camera.up` must be a real Vector3 and `camera.quaternion` a Quaternion with
  `.set()` — the camera rig resets both on every mode configure.
- Vector3 needs `length()`; also stub `Vector4`, `LineSegments`, `Points`.

The engine lives inside one IIFE, so module objects like `Planets` are not
reachable from the sandbox. For structural assertions, evaluate the individual
module's exported JS string (e.g. `PLANETS_JS`) in its own context and grab the
symbol off it; use `window.__globeMsg` for driving the full assembled scene.

Useful assertion beyond "it didn't throw": convert world radii to apparent
on-screen pixels (`2*r*(screenH/(2*tan(fov/2)))/cameraDistance`). That is what
proved the "moons don't render" bug was really sub-pixel sizing, not broken
scene-graph wiring.
