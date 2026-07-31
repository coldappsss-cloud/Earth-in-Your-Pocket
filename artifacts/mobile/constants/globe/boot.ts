/**
 * Boot — wires the pieces together and starts the loop.
 *
 * Registers the engine-level commands (the ones that are not owned by any one
 * mode), registers the modes, activates the initial mode and closes the IIFE
 * opened in the preamble.
 */
export const BOOT_JS = `
Engine.init();
Engine.register('earth', EarthMode);
Engine.register('space', SpaceMode);
Transition.init();

Bridge.registerAll({
  setRenderActive: function(d){ Engine.setRenderActive(d.value); },
  /**
   * setMode { mode, animated?, duration? }
   * Animated switches run through the transition framework; instant switches
   * bypass it. Space Mode has no UI entry point yet by design.
   */
  setMode: function(d){
    var name = d.mode === 'space' ? 'space' : 'earth';
    if (d.animated === false) {
      // Kill any in-flight transition first, or its pending swap would land
      // after this one and override the mode the caller asked for.
      Transition.cancel();
      Engine.setActive(name);
    } else {
      Transition.to(name, { duration: d.duration });
    }
  },
  cancelTransition: function(){ Transition.cancel(); }
});

window.setRenderActive = function(v){ Engine.setRenderActive(v); };
window.setSceneMode = function(m, animated){
  Bridge.dispatch({ type: 'setMode', mode: m, animated: animated !== false });
};

// Inspection handle. The engine lives inside a closure, so this is the only
// way to reach it from a debugger or a headless harness. Read-only in spirit —
// nothing in the app depends on it.
window.__scene = {
  Engine: Engine, CameraRig: CameraRig, Transition: Transition,
  Bridge: Bridge, Input: Input
};

Engine.setActive(initialMode);
Engine.start();

// Ready signal — the app replays any queued commands once it arrives.
setTimeout(function(){ Bridge.post({ type: 'ready' }); }, 400);

})();
`;
