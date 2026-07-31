/**
 * CameraRig — the single camera controller shared by every mode.
 *
 * The rig owns one PerspectiveCamera and drives it from an orbital state:
 * a look-at target plus yaw, pitch and distance. Each frame the live state is
 * damped toward a desired state, which is what makes every movement smooth
 * regardless of who set it (input, a fly-to, or object tracking).
 *
 * Two damping models are supported per mode:
 *   - 'frame'  : state += (desired - state) * factor, once per rendered frame.
 *   - 'time'   : critically damped, framerate independent.
 * Earth Mode uses 'frame' because that is exactly what it has always done, and
 * changing it would change how the globe feels. New modes use 'time'.
 *
 * Drag and zoom sensitivity are scaled by the current distance, so a swipe
 * moves the same number of screen pixels of content whether you are close to a
 * planet or far out in the Solar System.
 *
 * Prepared for future work: flyTo() and trackObject() are implemented and
 * wired into the update loop. Nothing calls them yet.
 */
export const CAMERA_RIG_JS = `
var CameraRig = (function(){
  var camera = null;

  // Live and desired orbital state. Kept as plain numbers plus one Vector3
  // each so the per-frame path performs no allocation.
  var state   = { yaw: 0, pitch: 0, distance: 2.5, target: null };
  var desired = { yaw: 0, pitch: 0, distance: 2.5, target: null };
  var vel     = { yaw: 0, pitch: 0 };

  var limits = {
    minDistance: 1.5, maxDistance: 4.5,
    minPitch: 0, maxPitch: 0,
    lockOrbit: true
  };

  var damping = {
    model: 'frame',   // 'frame' | 'time'
    distance: 0.1,    // frame model: lerp factor. time model: rate (1/s)
    orbit: 0.1,
    target: 0.1,
    friction: 0.88,   // inertia decay per frame at 60fps
    inertia: false
  };

  // Pixels of drag per radian at the reference distance. Scaled by distance.
  var sensitivity = { drag: 0.006, referenceDistance: 2.5, zoom: 1.0 };

  var dragging = false;
  var flight = null;   // { t, duration, from:{...}, to:{...} }
  var tracked = null;  // Object3D the target follows

  // Preallocated scratch — never allocate inside update().
  var _v = null;

  function init(cam){
    camera = cam;
    _v = new THREE.Vector3();
    state.target = new THREE.Vector3();
    desired.target = new THREE.Vector3();
  }

  /**
   * Apply a mode's camera profile. Called by the engine on activation.
   * Anything omitted keeps its current value.
   */
  function configure(p){
    if (!p) return;
    if (p.limits)     for (var a in p.limits)     limits[a]      = p.limits[a];
    if (p.damping)    for (var b in p.damping)    damping[b]     = p.damping[b];
    if (p.sensitivity) for (var c in p.sensitivity) sensitivity[c] = p.sensitivity[c];
    if (p.yaw      !== undefined) { state.yaw = desired.yaw = p.yaw; }
    if (p.pitch    !== undefined) { state.pitch = desired.pitch = p.pitch; }
    if (p.distance !== undefined) { state.distance = desired.distance = p.distance; }
    // A mode always gets a known look-at point. Without this reset a previous
    // mode's target (or a tracked object's last position) would leak across.
    if (p.target) { state.target.copy(p.target); desired.target.copy(p.target); }
    else          { state.target.set(0,0,0);     desired.target.set(0,0,0); }
    // Free-orbit modes rotate the camera via lookAt. A fixed-axis mode must
    // start from an identity orientation, or the leftover rotation silently
    // breaks eye-space lighting and raycasting.
    if (limits.lockOrbit) resetOrientation();
    if (p.fov !== undefined || p.near !== undefined || p.far !== undefined) {
      if (p.fov  !== undefined) camera.fov  = p.fov;
      if (p.near !== undefined) camera.near = p.near;
      if (p.far  !== undefined) camera.far  = p.far;
      camera.updateProjectionMatrix();
    }
    vel.yaw = vel.pitch = 0;
    flight = null;
    tracked = null;
  }

  function clamp(v, lo, hi){ return v < lo ? lo : (v > hi ? hi : v); }

  /** Return the camera to an unrotated, +Y-up orientation. */
  function resetOrientation(){
    camera.up.set(0, 1, 0);
    camera.rotation.set(0, 0, 0);
    camera.quaternion.set(0, 0, 0, 1);
  }

  /** Distance-relative scale so the drag feel is identical at every zoom. */
  function distanceScale(){
    return state.distance / (sensitivity.referenceDistance || 1);
  }

  // ── Input-facing API ──────────────────────────────────────────────────
  function beginDrag(){ dragging = true; vel.yaw = vel.pitch = 0; flight = null; }
  function endDrag(){ dragging = false; }

  function applyDrag(dx, dy){
    var k = sensitivity.drag * distanceScale();
    vel.yaw   = dx * k;
    vel.pitch = dy * k;
    desired.yaw   += vel.yaw;
    desired.pitch  = clamp(desired.pitch + vel.pitch, limits.minPitch, limits.maxPitch);
  }

  function setDistance(d){
    desired.distance = clamp(d, limits.minDistance, limits.maxDistance);
  }
  function getDistance(){ return state.distance; }
  function getDesiredDistance(){ return desired.distance; }

  /** Multiply the distance — used by pinch, which is inherently relative. */
  function zoomBy(ratio){ setDistance(desired.distance * ratio); }

  // ── Prepared for future features ──────────────────────────────────────
  /**
   * Smoothly move to an orbital pose over duration seconds.
   * Not used yet; the entry point exists so planet fly-to needs no rig change.
   */
  function flyTo(pose, duration){
    flight = {
      t: 0,
      duration: Math.max(0.001, duration === undefined ? 1.6 : duration),
      fromYaw: desired.yaw, fromPitch: desired.pitch, fromDistance: desired.distance,
      fromTarget: desired.target.clone(),
      toYaw: pose.yaw === undefined ? desired.yaw : pose.yaw,
      toPitch: pose.pitch === undefined ? desired.pitch : pose.pitch,
      toDistance: pose.distance === undefined ? desired.distance : pose.distance,
      toTarget: pose.target ? pose.target.clone() : desired.target.clone()
    };
    vel.yaw = vel.pitch = 0;
  }
  function isFlying(){ return flight !== null; }
  function cancelFlight(){ flight = null; }

  /**
   * Keep the look-at target locked to a moving object (a planet, a moon).
   * Not used yet.
   */
  function trackObject(obj){ tracked = obj || null; }
  function stopTracking(){ tracked = null; }

  function easeInOutCubic(p){
    return p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;
  }

  // ── Per-frame update ──────────────────────────────────────────────────
  function update(dt){
    if (flight) {
      flight.t += dt;
      var p = flight.t / flight.duration;
      if (p >= 1) { p = 1; }
      var e = easeInOutCubic(p);
      desired.yaw      = flight.fromYaw      + (flight.toYaw - flight.fromYaw) * e;
      desired.pitch    = flight.fromPitch    + (flight.toPitch - flight.fromPitch) * e;
      desired.distance = flight.fromDistance + (flight.toDistance - flight.fromDistance) * e;
      desired.target.copy(flight.fromTarget).lerp(flight.toTarget, e);
      if (p === 1) flight = null;
    }

    if (tracked) desired.target.copy(tracked.getWorldPosition(_v));

    if (damping.inertia && !dragging && !flight) {
      // Frame-rate normalised friction so inertia decays over the same
      // wall-clock time on 60Hz and 120Hz displays.
      var f = Math.pow(damping.friction, dt * 60);
      vel.yaw *= f; vel.pitch *= f;
      if (Math.abs(vel.yaw) < 1e-6) vel.yaw = 0;
      if (Math.abs(vel.pitch) < 1e-6) vel.pitch = 0;
      desired.yaw += vel.yaw;
      desired.pitch = clamp(desired.pitch + vel.pitch, limits.minPitch, limits.maxPitch);
    }

    desired.distance = clamp(desired.distance, limits.minDistance, limits.maxDistance);

    var kOrbit, kDist, kTarget;
    if (damping.model === 'time') {
      // Exponential approach: framerate independent.
      kOrbit  = 1 - Math.exp(-damping.orbit    * dt);
      kDist   = 1 - Math.exp(-damping.distance * dt);
      kTarget = 1 - Math.exp(-damping.target   * dt);
    } else {
      kOrbit = damping.orbit; kDist = damping.distance; kTarget = damping.target;
    }

    state.yaw      += (desired.yaw - state.yaw) * kOrbit;
    state.pitch    += (desired.pitch - state.pitch) * kOrbit;
    state.distance += (desired.distance - state.distance) * kDist;
    state.target.lerp(desired.target, kTarget);

    if (limits.lockOrbit) {
      // Fixed-axis mode: camera sits on +Z with no rotation at all. Earth Mode
      // relies on this — its shader treats world space and eye space as the
      // same basis for light directions.
      camera.position.set(state.target.x, state.target.y, state.target.z + state.distance);
      // Cheap and unconditional: nothing may leave a rotation on the camera
      // while a fixed-axis mode is active.
      camera.quaternion.set(0, 0, 0, 1);
    } else {
      var cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      var cy = Math.cos(state.yaw),   sy = Math.sin(state.yaw);
      camera.position.set(
        state.target.x + state.distance * cp * sy,
        state.target.y + state.distance * sp,
        state.target.z + state.distance * cp * cy
      );
      camera.lookAt(state.target);
    }
  }

  return {
    init: init, configure: configure, update: update,
    beginDrag: beginDrag, endDrag: endDrag, applyDrag: applyDrag,
    setDistance: setDistance, zoomBy: zoomBy,
    getDistance: getDistance, getDesiredDistance: getDesiredDistance,
    flyTo: flyTo, isFlying: isFlying, cancelFlight: cancelFlight,
    trackObject: trackObject, stopTracking: stopTracking
  };
})();
`;
