---
name: WebView scene engine architecture
description: Why the 3D WebView runs one multi-mode engine instead of one WebView per scene, and the rules that keep Earth Mode's feel unchanged.
---

## One WebGL context, many modes

The WebView 3D layer runs a single renderer, a single camera, a single
requestAnimationFrame loop and a single resize listener. Scenes ("modes") plug
into that loop; only the active one is updated and rendered.

**Why:** the alternative — a second WebView per scene — roughly doubles GPU
memory for the 3D layer on a phone and makes a continuous camera move between
scenes impossible, because two native views can only be cross-faded. Seamless
transition plus thousands of objects plus mobile performance can only be had
together in one context.

**How to apply:** never add a second WebView or a second WebGLRenderer for a new
scene. Add a mode module and register it with the engine.

## Earth Mode's feel is defined by frame-based smoothing

Earth's auto-rotation, drag inertia and fly-to-country interpolation advance a
fixed amount *per rendered frame*, not per elapsed second. They therefore run
faster on a 120Hz display. This is longstanding behaviour and users have
accepted how it feels.

**Why:** converting it to elapsed-time changes the perceived speed of every
globe interaction, which reads as a regression even though it is technically a
fix.

**How to apply:** the camera rig supports a frame-based and an elapsed-time
damping model per mode. Earth stays on the frame-based one with its original
constants; new modes use elapsed time. Do not "fix" Earth's timing as a side
effect of unrelated work — raise it as its own decision.

## The camera must not rotate in Earth Mode

Earth's day/night shader hardcodes the sun direction in eye space and relies on
world space and eye space sharing a basis. The rig has a `lockOrbit` flag that
places the camera on +Z with no rotation and skips `lookAt` entirely, rather
than relying on `lookAt` producing an identity quaternion.

**Why:** any camera rotation silently breaks the terminator and the specular
glint, and it fails visually rather than loudly.

## Verification without a screen

The globe cannot be seen from the workspace: WebView does not render on the web
preview and the headless screenshot browser has no WebGL. Wiring is therefore
verified by running the generated scene script in Node against stubbed Three.js
and DOM objects, which catches boot errors, command routing and transition
sequencing. Appearance and performance can only be judged on a device.

Always compile the modules to get the document string; never regex the template
literal out of the TypeScript source, which mishandles the escapes.
