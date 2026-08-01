---
name: Apparent size is a ratio, not an absolute
description: Why "make the planets bigger" cannot be solved by scaling the scene, and how to size bodies in a 3D visualizer.
---

When a user says objects in a 3D scene look too small, enlarging every radius
AND every orbit by the same factor accomplishes nothing. The camera pulls back
to frame the whole system, so every apparent size lands exactly where it was.

**Why:** apparent size depends on `radius / camera_distance`, and the camera
distance needed to frame the system is set by the outermost orbit. Scaling both
cancels. Only the radius-to-orbital-envelope ratio moves the needle.

**How to apply:** grow body radii substantially faster than the orbital
envelope, and pull satellite orbits in tight against their parent so moon
systems stop consuming the radial budget the planets need. Then sanity-check
the result numerically rather than by eye: convert to on-screen pixels with
`2 * radius * (screenHeight / (2 * tan(fov/2))) / cameraDistance`. Anything
under a couple of pixels is invisible even though it renders correctly — which
is exactly how a set of "missing" moons turned out to be fine code with bad
numbers. Verify afterwards that no orbit shell, ring, or satellite system
overlaps its neighbours, since widening bodies eats the gaps.

For an educational visualizer, readability beats physical accuracy: keep the
true size *ordering* between bodies, but not the true ratios.
