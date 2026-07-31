---
name: Globe WebView pattern
description: Three.js interactive globe rendered inside react-native-webview; key implementation decisions for Earth in Your Pocket.
---

# Globe WebView pattern

## The rule
The 3D globe is rendered via a WebView wrapping an HTML string with Three.js r128 from Cloudflare CDN. Country markers are added as child meshes of the earth mesh so they rotate with the globe automatically.

**Why:** Expo Go doesn't support native Three.js or GL libraries without a dev build. WebView + CDN Three.js works in Expo Go without any native code.

**How to apply:**
- Earth texture CDN: `https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/`
- Three.js CDN: `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
- Marker must be `earth.add(marker)` (child of earth mesh), NOT `scene.add(marker)`
- RN → WebView: use `webviewRef.current.injectJavaScript(js)`
- WebView → RN: use `window.ReactNativeWebView.postMessage(JSON.stringify(data))`
- Also listen on both `window` and `document` for messages (Android vs iOS difference)
- On web platform, `react-native-webview` is not supported; render a plain dark View placeholder
- Pin react-native-webview to `13.15.0` for Expo SDK 54 compatibility

## Injected commands must be queued until the page signals ready
`injectJavaScriptBeforeContentLoaded` is a one-shot bootstrap, not reactive state — later prop changes are silently ignored, and any `injectJavaScript` call fired before the page finishes booting is a no-op with no retry.

**Why:** a user who searched or tapped during globe startup got a preview card but no marker/highlight, and dismissing a selection never restored auto-rotation because the HTML mutated `autoRotate` internally while the RN prop was unchanged.

**How to apply:**
- Track a `ready` ref set from the WebView's `ready` postMessage; reset it in `onLoadStart` (reloads invalidate readiness).
- Queue commands issued before ready, collapsing to the latest command per kind, and replay on ready.
- Every piece of globe state the RN side owns needs a matching `window.set*` command and a `useEffect` that re-sends on prop change — one-way bootstrap always drifts.
- Expose a single `window.__globeMsg(jsonString)` entry point that forwards to the same handler as the `message` listeners, so injection and postMessage share one code path.
- Add `window.setRenderActive(bool)` to cancel the rAF loop and pending timers; drive it from `useFocusEffect` so the Three.js scene stops rendering while another screen covers it.

## Lat/Lon math (Three.js SphereGeometry convention)
- Local position: `x = -sin(phi)*cos(theta), y = cos(phi), z = sin(phi)*sin(theta)`
  where `phi = (90-lat)*PI/180`, `theta = (lon+180)*PI/180`
- Inverse (tap → lat/lon from local normalized point):
  `lat = asin(lp.y) * 180/PI`
  `lon = atan2(lp.z, -lp.x) * 180/PI - 180`
- To face a country (rotation): `targetRotY = PI/2 - theta`
