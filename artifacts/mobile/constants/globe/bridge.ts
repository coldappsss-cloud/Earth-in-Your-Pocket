/**
 * Bridge — the React Native <-> scene command registry.
 *
 * Every inbound message is a plain object with a `type`. Instead of a growing
 * if/else chain, each mode registers the commands it owns when it initialises.
 * A new mode can therefore add commands without touching any other mode.
 *
 * Outbound events go through Bridge.post so the postMessage guard lives in
 * exactly one place.
 */
export const BRIDGE_JS = `
var Bridge = (function(){
  var commands = {};

  /** Register a single command handler. Later registrations win. */
  function register(name, fn){ commands[name] = fn; }

  /** Register a map of { commandName: handler }. */
  function registerAll(map){
    for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) commands[k] = map[k];
  }

  function unregister(name){ delete commands[name]; }

  function dispatch(msg){
    if (!msg || !msg.type) return;
    var fn = commands[msg.type];
    if (fn) fn(msg);
  }

  function post(obj){
    try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {}
  }

  function onRNMsg(e){
    try { dispatch(JSON.parse(e.data)); } catch(err) {}
  }

  window.addEventListener('message', onRNMsg);
  document.addEventListener('message', onRNMsg);
  // Direct entry point used by injectJavaScript from React Native.
  window.__globeMsg = function(s){ onRNMsg({ data: s }); };

  return { register: register, registerAll: registerAll, unregister: unregister,
           dispatch: dispatch, post: post };
})();
`;
