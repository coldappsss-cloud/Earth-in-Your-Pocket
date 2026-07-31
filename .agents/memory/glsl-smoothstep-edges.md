---
name: GLSL smoothstep edge ordering
description: smoothstep(edge0, edge1, x) is undefined in GLSL when edge0 > edge1 — a common trap when writing "inverse mask" shader logic by hand.
---

`smoothstep(edge0, edge1, x)` requires `edge0 < edge1`; passing them in "reversed" order to get an inverted falloff (e.g. `smoothstep(0.6, -0.2, x)` to fade in as `x` decreases) is undefined behavior on some GPUs/drivers, not just "backwards" — it can render as a hard cutoff, an inverted mask, or silently vanish depending on the WebView's GL implementation.

**Why:** caught by an architect review after writing several masks this way (nebula backdrop blobs, night-side city lights, ring shadow band) in a Three.js Solar System scene — all compiled fine and looked plausible in isolation, so nothing short of a spec-aware GLSL review caught it.

**How to apply:** to invert a smoothstep falloff, always keep edges ascending and negate the result: use `1.0 - smoothstep(edge0, edge1, x)` (with `edge0 < edge1`), never swap the edge arguments. Grep new shader code for `smoothstep(` calls where the first literal is numerically larger than the second before shipping.
