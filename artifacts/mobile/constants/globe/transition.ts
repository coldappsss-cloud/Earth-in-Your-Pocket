/**
 * Transition — the framework that moves the app between two modes.
 *
 * This is deliberately the framework, not the final cinematic animation. It
 * provides the timeline; a future prompt provides the choreography.
 *
 * A transition runs a single normalised progress value 0 -> 1, split into two
 * phases by a configurable midpoint:
 *   phase 'out' : progress 0 .. mid, the outgoing mode is still active
 *   (swap)      : Engine.setActive(to) happens exactly once at the midpoint
 *   phase 'in'  : progress mid .. 1, the incoming mode is active
 *
 * Each mode may implement onTransition(phase, p) where p is renormalised 0..1
 * within its own phase. Earth Mode implements nothing, so it is unaffected.
 *
 * The default visual strategy is a plain DOM veil cross-fade. It touches no
 * scene materials, which is what keeps Earth Mode's appearance frozen. A
 * cinematic strategy can be registered later with registerStrategy() without
 * changing any mode.
 *
 * Transitions can be cancelled or reversed mid-flight.
 */
export const TRANSITION_JS = `
var Transition = (function(){
  var veil = null;
  var run = null;   // { from, to, p, duration, mid, swapped, direction }
  var strategies = {};
  var current = 'veil';

  function easeInOutCubic(p){
    return p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;
  }

  // ── Default strategy: full-screen veil cross-fade ─────────────────────
  strategies.veil = {
    onProgress: function(p){
      // Opaque at the midpoint, clear at both ends.
      var a = 1 - Math.abs(p - 0.5) * 2;
      veil.style.opacity = String(easeInOutCubic(a));
    },
    onEnd: function(){ veil.style.opacity = '0'; }
  };

  function registerStrategy(name, impl){ strategies[name] = impl; }
  function useStrategy(name){ if (strategies[name]) current = name; }

  function init(){
    veil = document.getElementById('veil');
    Engine.addFrameHook(update);
  }

  function notify(mode, phase, p){
    if (mode && mode.onTransition) mode.onTransition(phase, p);
  }

  /**
   * Begin a transition to toName.
   * opts: { duration (s), mid (0..1), strategy }
   */
  function to(toName, opts){
    opts = opts || {};
    var fromName = Engine.getActiveName();
    if (!Engine.has(toName)) return false;

    if (run) {
      // Already heading there — let it finish. Heading the other way — reverse.
      if (run.to === toName) return true;
      if (run.from === toName) { reverse(); return true; }
      cancel();
      fromName = Engine.getActiveName();
    }
    if (fromName === toName) return true;

    // Build the incoming scene before the timeline starts so the swap frame
    // does not stall on geometry construction.
    Engine.preload(toName);

    run = {
      from: fromName,
      to: toName,
      p: 0,
      duration: Math.max(0.001, opts.duration === undefined ? 1.2 : opts.duration),
      mid: opts.mid === undefined ? 0.5 : opts.mid,
      swapped: false,
      direction: 1
    };
    if (opts.strategy) useStrategy(opts.strategy);
    Bridge.post({ type: 'transitionStart', from: fromName, to: toName });
    return true;
  }

  function reverse(){
    if (!run) return;
    var f = run.from; run.from = run.to; run.to = f;
    run.p = 1 - run.p;
    run.swapped = !run.swapped;
    Bridge.post({ type: 'transitionStart', from: run.from, to: run.to, reversed: true });
  }

  /** Stop immediately, leaving whichever mode is currently active. */
  function cancel(){
    if (!run) return;
    var s = strategies[current];
    if (s && s.onEnd) s.onEnd();
    Bridge.post({ type: 'transitionEnd', mode: Engine.getActiveName(), cancelled: true });
    run = null;
  }

  function isRunning(){ return run !== null; }
  function getProgress(){ return run ? run.p : 0; }

  function update(dt){
    if (!run) return;
    run.p += dt / run.duration;
    if (run.p > 1) run.p = 1;

    if (!run.swapped && run.p >= run.mid) {
      Engine.setActive(run.to);
      run.swapped = true;
    }

    if (run.p < run.mid) {
      notify(Engine.getMode(run.from), 'out', run.mid > 0 ? run.p / run.mid : 1);
    } else {
      var span = 1 - run.mid;
      notify(Engine.getMode(run.to), 'in', span > 0 ? (run.p - run.mid) / span : 1);
    }

    var s = strategies[current];
    if (s && s.onProgress) s.onProgress(run.p, run);

    if (run.p >= 1) {
      if (s && s.onEnd) s.onEnd();
      Bridge.post({ type: 'transitionEnd', mode: run.to });
      run = null;
    }
  }

  return {
    init: init, to: to, cancel: cancel, reverse: reverse,
    isRunning: isRunning, getProgress: getProgress,
    registerStrategy: registerStrategy, useStrategy: useStrategy
  };
})();
`;
