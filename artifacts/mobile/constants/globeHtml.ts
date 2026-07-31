/**
 * Public entry point for the WebView 3D scene.
 *
 * The document used to live here as a single string. It is now assembled from
 * the modules under ./globe (engine core, camera rig, input, bridge,
 * transition framework, and one module per scene mode). This re-export keeps
 * the import path stable for everything that consumes it.
 */
export { GLOBE_HTML } from './globe';
