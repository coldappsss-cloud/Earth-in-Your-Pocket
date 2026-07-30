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

## Lat/Lon math (Three.js SphereGeometry convention)
- Local position: `x = -sin(phi)*cos(theta), y = cos(phi), z = sin(phi)*sin(theta)`
  where `phi = (90-lat)*PI/180`, `theta = (lon+180)*PI/180`
- Inverse (tap → lat/lon from local normalized point):
  `lat = asin(lp.y) * 180/PI`
  `lon = atan2(lp.z, -lp.x) * 180/PI - 180`
- To face a country (rotation): `targetRotY = PI/2 - theta`
