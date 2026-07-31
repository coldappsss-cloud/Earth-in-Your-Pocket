/**
 * Engine — owns everything that must exist exactly once.
 *
 * There is one WebGL context, one renderer, one camera, one requestAnimationFrame
 * loop and one resize listener for the entire app. Modes are scenes plugged into
 * that loop. Only the active mode is updated and rendered, so an inactive mode
 * costs nothing per frame beyond the memory its scene holds.
 *
 * Why one context: a second WebView (and therefore a second WebGL context)
 * would roughly double GPU memory for the 3D layer on a phone and would make a
 * continuous camera move between Earth and space impossible — you can only
 * cross-fade two separate native views.
 *
 * Mode contract (every field except `scene` and `init` is optional):
 *   scene                    THREE.Scene owned by the mode
 *   cameraProfile            passed to CameraRig.configure on activation
 *   inputHandlers            gesture handler map for the Input recogniser
 *   commands                 { name: fn } registered on the Bridge at init
 *   init(ctx)                one-time construction; ctx = { renderer, camera, engine }
 *   activate() / deactivate()
 *   update(dt, elapsed)      per-frame, only while active
 *   resize(w, h)
 *   onRenderActiveChange(on)
 *   onTransition(phase, p)   'out' | 'in', p in 0..1 — for future cinematics
 *   dispose()
 */
export const ENGINE_JS = `
var Engine = (function(){
  var renderer = null, camera = null, canvas = null;
  var W = 0, H = 0;

  var modes = {};
  var activeName = null;
  var overlayName = null;   // second scene drawn on top, used by transitions

  var rafId = null, renderActive = true, lastTime = 0, elapsed = 0;
  var frameHooks = [];      // engine-level per-frame callbacks (transition ctl)

  function init(){
    W = window.innerWidth; H = window.innerHeight;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x050A14, 1);
    document.body.appendChild(renderer.domElement);
    canvas = renderer.domElement;

    camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);
    camera.position.z = 2.5;

    CameraRig.init(camera);
    Input.init(canvas);

    window.addEventListener('resize', onResize);
  }

  function context(){
    return { renderer: renderer, camera: camera, canvas: canvas, engine: api };
  }

  function register(name, mode){
    mode.name = name;
    modes[name] = mode;
  }

  function ensureInit(mode){
    if (mode.__inited) return;
    mode.init(context());
    if (mode.commands) Bridge.registerAll(mode.commands);
    if (mode.resize) mode.resize(W, H);
    mode.__inited = true;
  }

  /** Immediate mode switch. Transitions go through the Transition controller. */
  function setActive(name){
    var next = modes[name];
    if (!next || activeName === name) return;
    var prev = modes[activeName];
    if (prev && prev.deactivate) prev.deactivate();
    ensureInit(next);
    activeName = name;
    CameraRig.configure(next.cameraProfile);
    Input.setHandlers(next.inputHandlers);
    if (next.activate) next.activate();
    Bridge.post({ type: 'modeChange', mode: name });
  }

  function getActiveName(){ return activeName; }
  function getMode(name){ return modes[name]; }
  function has(name){ return !!modes[name]; }
  function preload(name){ if (modes[name]) ensureInit(modes[name]); }

  /** Draw a second mode's scene over the active one without clearing. */
  function setOverlay(name){
    overlayName = name || null;
    if (overlayName) preload(overlayName);
  }

  function addFrameHook(fn){ frameHooks.push(fn); }

  function onResize(){
    W = window.innerWidth; H = window.innerHeight;
    camera.aspect = W/H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    for (var k in modes) if (modes[k].__inited && modes[k].resize) modes[k].resize(W, H);
  }

  function frame(now){
    rafId = requestAnimationFrame(frame);
    // Clamped at both ends: a paused/resumed WebView can hand back a timestamp
    // that is older than the last one, and a long stall must not teleport
    // anything that integrates dt.
    var dt = Math.max(0, Math.min((now - lastTime) / 1000, 0.05));
    lastTime = now;
    elapsed += dt;

    for (var i = 0; i < frameHooks.length; i++) frameHooks[i](dt, elapsed);

    var active = modes[activeName];
    if (active && active.update) active.update(dt, elapsed);

    CameraRig.update(dt);

    if (active) {
      renderer.autoClear = true;
      renderer.render(active.scene, camera);
    }
    if (overlayName && modes[overlayName] && overlayName !== activeName) {
      renderer.autoClear = false;
      renderer.render(modes[overlayName].scene, camera);
      renderer.autoClear = true;
    }
  }

  function start(){
    lastTime = performance.now();
    if (rafId === null) rafId = requestAnimationFrame(frame);
  }

  /** Pause the whole loop when the screen is not visible (battery, memory). */
  function setRenderActive(v){
    v = !!v;
    if (v === renderActive) return;
    renderActive = v;
    if (v) {
      lastTime = performance.now();
      if (rafId === null) rafId = requestAnimationFrame(frame);
    } else if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    for (var k in modes) {
      if (modes[k].__inited && modes[k].onRenderActiveChange) modes[k].onRenderActiveChange(v);
    }
  }

  var api = {
    init: init, register: register, setActive: setActive,
    getActiveName: getActiveName, getMode: getMode, has: has, preload: preload,
    setOverlay: setOverlay, addFrameHook: addFrameHook,
    start: start, setRenderActive: setRenderActive,
    getRenderer: function(){ return renderer; },
    getCamera: function(){ return camera; },
    getSize: function(){ return { width: W, height: H }; }
  };
  return api;
})();
`;
