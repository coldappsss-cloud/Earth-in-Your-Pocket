/**
 * Preamble — capability guard and shared configuration.
 *
 * Opens the single IIFE that wraps the whole scene engine. If Three.js or
 * WebGL is unavailable it installs no-op stubs for every public entry point
 * and returns early, so the rest of the engine never executes.
 */
export const PREAMBLE_JS = `
(function(){
'use strict';

function hasWebGL(){
  try {
    var c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

// Three.js comes from a CDN, and WebGL can be unavailable on some devices.
// Either way, say so instead of leaving a permanently blank screen.
var failure = typeof THREE === 'undefined' ? 'three-unavailable'
            : !hasWebGL()                  ? 'webgl-unavailable'
            : null;
if (failure) {
  var fb = document.getElementById('fallback');
  fb.innerHTML = failure === 'webgl-unavailable'
    ? 'This device can\\'t display the 3D globe.<br>Search still works.'
    : 'The globe needs an internet connection to load.<br>Search still works offline.';
  fb.style.display = 'flex';
  try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',reason:failure})); } catch(e) {}
  window.setSelectedCountry = function(){};
  window.clearSelectedCountry = function(){};
  window.setAutoRotate = function(){};
  window.setInteractive = function(){};
  window.setRenderActive = function(){};
  window.setSceneMode = function(){};
  window.__globeMsg = function(){};
  return;
}

var cfg = window.GLOBE_CONFIG || {};
var autoRotate = cfg.autoRotate === true;
var interactive = cfg.interactive !== false;
var initialMode = cfg.mode === 'space' ? 'space' : 'earth';
`;
