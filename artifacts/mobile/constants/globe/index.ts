/**
 * Assembles the WebView document from the engine source modules.
 *
 * The 3D system runs inside a WebView, so it must ultimately be delivered as
 * one HTML string. Rather than maintain that as a single monolith, each
 * subsystem lives in its own module and they are concatenated here, in
 * dependency order, at build time.
 *
 * Order matters: the preamble opens the wrapping IIFE and bails out early if
 * WebGL is unavailable, and boot closes it.
 */
import { PREAMBLE_JS } from './preamble';
import { BRIDGE_JS } from './bridge';
import { CAMERA_RIG_JS } from './cameraRig';
import { INPUT_JS } from './input';
import { ENGINE_JS } from './engine';
import { TRANSITION_JS } from './transition';
import { EARTH_MODE_JS } from './earthMode';
import { PLANETS_JS } from './planets';
import { SPACE_MODE_JS } from './spaceMode';
import { BOOT_JS } from './boot';

const ENGINE_SOURCE = [
  PREAMBLE_JS,
  BRIDGE_JS,
  CAMERA_RIG_JS,
  INPUT_JS,
  ENGINE_JS,
  TRANSITION_JS,
  EARTH_MODE_JS,
  PLANETS_JS,
  SPACE_MODE_JS,
  BOOT_JS,
].join('\n');

export const GLOBE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#050A14}
canvas{display:block}
#fallback{position:absolute;inset:0;display:none;align-items:center;justify-content:center;
  padding:32px;text-align:center;color:#94A3B8;font:400 15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
/* Cross-fade veil used by the default transition strategy. */
#veil{position:absolute;inset:0;background:#050A14;opacity:0;pointer-events:none;will-change:opacity}
</style>
</head>
<body>
<div id="fallback">The globe needs an internet connection to load.<br>Search still works offline.</div>
<div id="veil"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
<script>
${ENGINE_SOURCE}
</script>
</body>
</html>`;
