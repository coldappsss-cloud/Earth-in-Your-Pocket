/**
 * Input — one gesture recogniser for the whole engine.
 *
 * Raw touch events are translated once into normalised gestures. The active
 * mode subscribes to the gestures it cares about; a mode that ignores pinch
 * simply does not provide a handler.
 *
 * Gesture vocabulary:
 *   dragStart()            one finger down
 *   drag(dx, dy)           per-move delta in CSS pixels
 *   dragEnd()              finger lifted, or a second finger arrived
 *   pinchStart()           second finger down
 *   pinch(ratio)           startDistance / currentDistance (>1 means zoom out)
 *   pinchEnd()
 *   tap(clientX, clientY)  short press that never moved
 *
 * Thresholds match the original globe exactly: 5px of movement or 350ms of
 * hold cancels a tap.
 */
export const INPUT_JS = `
var Input = (function(){
  var canvas = null;
  var h = {};   // active handler set

  var prevX = 0, prevY = 0;
  var tapX = 0, tapY = 0, tapTime = 0, moved = false;
  var oneDown = false;
  var pinchStartDist = null;

  var TAP_SLOP_PX = 5;
  var TAP_MAX_MS  = 350;

  function setHandlers(handlers){ h = handlers || {}; }
  function clearHandlers(){ h = {}; }

  function call(name, a, b){ if (h[name]) h[name](a, b); }

  function pinchDistance(e){
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }

  function onStart(e){
    e.preventDefault();
    if (e.touches.length === 1) {
      oneDown = true;
      prevX = tapX = e.touches[0].clientX;
      prevY = tapY = e.touches[0].clientY;
      tapTime = Date.now();
      moved = false;
      call('dragStart');
    }
    if (e.touches.length === 2) {
      if (oneDown) { oneDown = false; call('dragEnd'); }
      pinchStartDist = pinchDistance(e);
      call('pinchStart');
    }
  }

  function onMove(e){
    e.preventDefault();
    if (e.touches.length === 2) {
      if (oneDown) { oneDown = false; call('dragEnd'); }
      if (pinchStartDist !== null) {
        var d = pinchDistance(e);
        if (d > 0) call('pinch', pinchStartDist / d);
      }
      return;
    }
    if (!oneDown) return;
    var x = e.touches[0].clientX, y = e.touches[0].clientY;
    var tdx = x - tapX, tdy = y - tapY;
    if (Math.sqrt(tdx*tdx + tdy*tdy) > TAP_SLOP_PX) moved = true;
    call('drag', x - prevX, y - prevY);
    prevX = x; prevY = y;
  }

  function onEnd(e){
    e.preventDefault();
    if (e.changedTouches.length === 1 && !moved && Date.now() - tapTime < TAP_MAX_MS) {
      call('tap', tapX, tapY);
    }
    if (e.touches.length === 0) {
      if (oneDown) { oneDown = false; call('dragEnd'); }
      if (pinchStartDist !== null) { pinchStartDist = null; call('pinchEnd'); }
    }
  }

  function init(domElement){
    canvas = domElement;
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove',  onMove,  { passive: false });
    canvas.addEventListener('touchend',   onEnd,   { passive: false });
  }

  return { init: init, setHandlers: setHandlers, clearHandlers: clearHandlers };
})();
`;
