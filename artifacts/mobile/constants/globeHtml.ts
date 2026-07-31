// Three.js interactive globe rendered in a WebView.
// New in v2: realistic earth-day texture, TopoJSON country borders,
// emerald country-polygon highlight, point-in-polygon tap detection.
// Communicates with React Native via postMessage / ReactNativeWebView.

export const GLOBE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#050A14}
canvas{display:block}
</style>
</head>
<body>
<!-- Three.js r128 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<!-- TopoJSON client for country borders -->
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
<script>
(function(){
'use strict';

var cfg = window.GLOBE_CONFIG || {};
var autoRotate = cfg.autoRotate === true;
var interactive = cfg.interactive !== false;
var W = window.innerWidth, H = window.innerHeight;

// ─── Renderer ──────────────────────────────────────────────────────────────
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);
camera.position.z = 2.5;

var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x050A14, 1);
document.body.appendChild(renderer.domElement);
var canvas = renderer.domElement;

// ─── Stars ─────────────────────────────────────────────────────────────────
var starGeo = new THREE.BufferGeometry();
var SC = 7000;
var SP = new Float32Array(SC * 3);
for(var si = 0; si < SC; si++){
  var sth = Math.random() * Math.PI * 2;
  var sph = Math.acos(Math.random() * 2 - 1);
  var sr  = 80 + Math.random() * 50;
  SP[si*3]   = sr * Math.sin(sph) * Math.cos(sth);
  SP[si*3+1] = sr * Math.sin(sph) * Math.sin(sth);
  SP[si*3+2] = sr * Math.cos(sph);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(SP, 3));
scene.add(new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color:0xffffff, size:0.1, sizeAttenuation:true, transparent:true, opacity:0.85 })
));

// ─── Lighting ──────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x334466, 1.4));
var sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
sun.position.set(5, 3, 5);
scene.add(sun);
var fill = new THREE.DirectionalLight(0x334466, 0.2);
fill.position.set(-4, -2, -4);
scene.add(fill);

// ─── Earth ─────────────────────────────────────────────────────────────────
var earthGeo = new THREE.SphereGeometry(1, 72, 36);
// color:0xffffff so the texture shows its true colors (blue-tinting was the old bug)
var earthMat = new THREE.MeshPhongMaterial({
  color: 0xffffff,
  specular: new THREE.Color(0x226688),
  shininess: 20,
});
var earth = new THREE.Mesh(earthGeo, earthMat);
scene.add(earth);

var tl = new THREE.TextureLoader();
tl.crossOrigin = 'anonymous';

// Realistic Blue Marble day texture from three-globe CDN
// Shows natural ocean blue, green forests, tan deserts, white polar ice
tl.load(
  'https://unpkg.com/three-globe@2.30.0/example/img/earth-day.jpg',
  function(t){ earthMat.map = t; earthMat.needsUpdate = true; },
  undefined,
  function(){
    // Fallback to Three.js examples texture
    tl.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg',
      function(t){ earthMat.map = t; earthMat.needsUpdate = true; }
    );
  }
);
tl.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_normal_2048.jpg',
  function(t){ earthMat.normalMap = t; earthMat.needsUpdate = true; }
);
tl.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_specular_2048.jpg',
  function(t){ earthMat.specularMap = t; earthMat.needsUpdate = true; }
);

// ─── Clouds ────────────────────────────────────────────────────────────────
var cloudMat = new THREE.MeshPhongMaterial({ transparent:true, opacity:0.30, depthWrite:false });
var clouds = new THREE.Mesh(new THREE.SphereGeometry(1.006, 72, 36), cloudMat);
scene.add(clouds);
tl.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_1024.png',
  function(t){ cloudMat.map = t; cloudMat.needsUpdate = true; }
);

// ─── Atmosphere Fresnel glow ────────────────────────────────────────────────
var atmMat = new THREE.ShaderMaterial({
  vertexShader:   'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: 'varying vec3 vN;void main(){float i=pow(0.68-dot(vN,vec3(0.0,0.0,1.0)),2.5);gl_FragColor=vec4(0.08,0.45,1.0,1.0)*i;}',
  blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 64, 32), atmMat));

// ─── Country Highlight overlay (canvas texture, equirectangular) ───────────
// Updated once on country change, not per-frame.
var HL_W = 2048, HL_H = 1024;
var hlCanvas = document.createElement('canvas');
hlCanvas.width = HL_W; hlCanvas.height = HL_H;
var hlCtx = hlCanvas.getContext('2d');

var hlTexture = new THREE.CanvasTexture(hlCanvas);
hlTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

var hlMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.0025, 72, 36),
  new THREE.MeshBasicMaterial({
    map: hlTexture,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
hlMesh.visible = false;
earth.add(hlMesh); // child of earth → rotates with globe automatically

// ─── Country border lines (TopoJSON LineSegments) ──────────────────────────
// Borders live slightly above the surface and are children of earth mesh.
var borderLines = null;
var geoFeatures  = null; // for tap point-in-polygon tests

function ll2vec3(lon, lat, r) {
  var phi   = (90 - lat) * Math.PI / 180;
  var theta = (lon + 180) * Math.PI / 180;
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ];
}

fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  .then(function(r){ return r.json(); })
  .then(function(topo){
    // Store GeoJSON features for point-in-polygon tests
    geoFeatures = topojson.feature(topo, topo.objects.countries).features;

    // Build LineSegments from topojson border mesh (all borders, one draw call)
    var borders = topojson.mesh(topo, topo.objects.countries);
    var pos = [];

    function addLine(ring) {
      for (var i = 0; i < ring.length - 1; i++) {
        var a = ll2vec3(ring[i][0],   ring[i][1],   1.0015);
        var b = ll2vec3(ring[i+1][0], ring[i+1][1], 1.0015);
        pos.push(a[0],a[1],a[2], b[0],b[1],b[2]);
      }
    }

    if (borders.type === 'MultiLineString') {
      for (var k = 0; k < borders.coordinates.length; k++) addLine(borders.coordinates[k]);
    } else if (borders.type === 'LineString') {
      addLine(borders.coordinates);
    }

    var bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pos), 3));
    borderLines = new THREE.LineSegments(
      bGeo,
      new THREE.LineBasicMaterial({ color: 0xe8eef4, transparent: true, opacity: 0.50 })
    );
    earth.add(borderLines); // rotates with globe
  })
  .catch(function(){/* network error — no borders, that's OK */});

// ─── Point-in-polygon (ray-casting, handles both Polygon & MultiPolygon) ──
function pipRing(ring, lon, lat) {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i][0], yi = ring[i][1];
    var xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function findFeatureAt(lat, lon) {
  if (!geoFeatures) return null;
  for (var i = 0; i < geoFeatures.length; i++) {
    var f = geoFeatures[i];
    if (!f.geometry) continue;
    var g = f.geometry;
    if (g.type === 'Polygon') {
      if (pipRing(g.coordinates[0], lon, lat)) return f;
    } else if (g.type === 'MultiPolygon') {
      for (var j = 0; j < g.coordinates.length; j++) {
        if (pipRing(g.coordinates[j][0], lon, lat)) return f;
      }
    }
  }
  return null;
}

// ─── Highlight draw on canvas texture ─────────────────────────────────────
function lonlatToUV(lon, lat) {
  // equirectangular: u ∈ [0,1], v ∈ [0,1]
  return [
    (lon + 180) / 360 * HL_W,
    (90 - lat)  / 180 * HL_H,
  ];
}

function drawHighlight(feature) {
  hlCtx.clearRect(0, 0, HL_W, HL_H);

  if (!feature || !feature.geometry) {
    hlTexture.needsUpdate = true;
    hlMesh.visible = false;
    return;
  }

  function tracePoly(rings) {
    rings.forEach(function(ring) {
      var uv = lonlatToUV(ring[0][0], ring[0][1]);
      hlCtx.moveTo(uv[0], uv[1]);
      for (var i = 1; i < ring.length; i++) {
        uv = lonlatToUV(ring[i][0], ring[i][1]);
        hlCtx.lineTo(uv[0], uv[1]);
      }
      hlCtx.closePath();
    });
  }

  var g = feature.geometry;
  hlCtx.beginPath();
  if (g.type === 'Polygon') {
    tracePoly(g.coordinates);
  } else if (g.type === 'MultiPolygon') {
    g.coordinates.forEach(tracePoly);
  }

  // Soft fill: emerald tint
  hlCtx.fillStyle = 'rgba(16, 185, 129, 0.20)';
  hlCtx.fill();

  // Border glow — draw twice: wider soft outer glow, then crisp inner line
  hlCtx.shadowBlur = 8;
  hlCtx.shadowColor = 'rgba(16, 185, 129, 0.7)';
  hlCtx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
  hlCtx.lineWidth = 3;
  hlCtx.stroke();

  hlCtx.shadowBlur = 0;
  hlCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  hlCtx.lineWidth = 1.2;
  hlCtx.stroke();

  hlTexture.needsUpdate = true;
  hlMesh.visible = true;
}

// ─── Country marker (pulsing dot, child of earth) ──────────────────────────
var markerMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.018, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x10B981 })
);
markerMesh.visible = false;
earth.add(markerMesh);

var glowMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.042, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x10B981, transparent: true, opacity: 0.22 })
);
glowMesh.visible = false;
earth.add(glowMesh);

// ─── Rotation / interaction state ──────────────────────────────────────────
var rotX = 0.1, rotY = 0;
var velX = 0, velY = 0;
var targetCameraZ = 2.5, currentCameraZ = 2.5;
var targetRotX = 0.1, targetRotY = 0;
var animToCountry = false;
var isDragging = false;
var prevTX = 0, prevTY = 0;
var tapStartX = 0, tapStartY = 0, tapStartTime = 0, hasMoved = false;
var pinchDist0 = null, pinchZ0 = 2.5;
var cloudOffset = 0;
var glowPulse = 1, glowDir = 1;
var elapsed = 0;

// ─── Helpers ───────────────────────────────────────────────────────────────
function ll2local(lat, lon) {
  var phi   = (90 - lat) * Math.PI / 180;
  var theta = (lon + 180) * Math.PI / 180;
  return {
    x: -Math.sin(phi) * Math.cos(theta),
    y:  Math.cos(phi),
    z:  Math.sin(phi) * Math.sin(theta),
  };
}

function setMarkerPos(lat, lon) {
  var p = ll2local(lat, lon);
  markerMesh.position.set(p.x * 1.022, p.y * 1.022, p.z * 1.022);
  glowMesh.position.copy(markerMesh.position);
  markerMesh.visible = true;
  glowMesh.visible   = true;
}

function animateToLatLon(lat, lon) {
  var theta = (lon + 180) * Math.PI / 180;
  targetRotY = Math.PI / 2 - theta;
  targetRotX = -lat * Math.PI / 180 * 0.4;
  animToCountry = true;
}

// ─── RN ↔ WebView API ────────────────────────────────────────────────────────
window.setSelectedCountry = function(lat, lon) {
  setMarkerPos(lat, lon);
  animateToLatLon(lat, lon);
  autoRotate = false;
  // Highlight country polygon; retry briefly if TopoJSON not yet loaded
  var tries = 0;
  function tryHighlight() {
    var f = findFeatureAt(lat, lon);
    if (f) { drawHighlight(f); return; }
    if (tries++ < 20) setTimeout(tryHighlight, 150);
  }
  tryHighlight();
};

window.clearSelectedCountry = function() {
  markerMesh.visible = false;
  glowMesh.visible   = false;
  drawHighlight(null);
};

window.setAutoRotate = function(v) { autoRotate = !!v; };

// ─── Touch handlers ────────────────────────────────────────────────────────
function pinchDist(e) {
  var dx = e.touches[0].clientX - e.touches[1].clientX;
  var dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.sqrt(dx*dx + dy*dy);
}

canvas.addEventListener('touchstart', function(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    isDragging = interactive;
    prevTX = tapStartX = e.touches[0].clientX;
    prevTY = tapStartY = e.touches[0].clientY;
    tapStartTime = Date.now();
    hasMoved = false;
    velX = velY = 0;
    animToCountry = false;
    if (interactive) autoRotate = false;
  }
  if (e.touches.length === 2) { pinchDist0 = pinchDist(e); pinchZ0 = currentCameraZ; }
}, {passive:false});

canvas.addEventListener('touchmove', function(e) {
  e.preventDefault();
  if (e.touches.length === 2) {
    isDragging = false;
    if (pinchDist0 !== null) {
      var scale = pinchDist0 / pinchDist(e);
      targetCameraZ = Math.max(1.5, Math.min(4.5, pinchZ0 * scale));
    }
    return;
  }
  if (!isDragging || !interactive) return;
  var dx = e.touches[0].clientX - prevTX;
  var dy = e.touches[0].clientY - prevTY;
  var tdx = e.touches[0].clientX - tapStartX;
  var tdy = e.touches[0].clientY - tapStartY;
  if (Math.sqrt(tdx*tdx + tdy*tdy) > 5) hasMoved = true;
  velY = dx * 0.006;
  velX = dy * 0.006;
  rotY += velY;
  rotX = Math.max(-1.1, Math.min(1.1, rotX + velX));
  prevTX = e.touches[0].clientX;
  prevTY = e.touches[0].clientY;
}, {passive:false});

canvas.addEventListener('touchend', function(e) {
  e.preventDefault();
  if (e.changedTouches.length === 1 && !hasMoved && Date.now() - tapStartTime < 350) {
    doTap(tapStartX, tapStartY);
  }
  if (e.touches.length === 0) isDragging = false;
  pinchDist0 = null;
}, {passive:false});

function doTap(cx, cy) {
  var rect = canvas.getBoundingClientRect();
  var mouse = new THREE.Vector2(
    ((cx - rect.left) / rect.width)  * 2 - 1,
    -((cy - rect.top)  / rect.height) * 2 + 1
  );
  var ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, camera);
  var hits = ray.intersectObject(earth);
  if (hits.length > 0) {
    var lp  = earth.worldToLocal(hits[0].point.clone()).normalize();
    var lat = Math.asin(Math.max(-1, Math.min(1, lp.y))) * 180 / Math.PI;
    var lon = Math.atan2(lp.z, -lp.x) * 180 / Math.PI - 180;
    if (lon < -180) lon += 360;

    // Immediate highlight (if TopoJSON already loaded)
    drawHighlight(findFeatureAt(lat, lon));

    var msg = JSON.stringify({ type:'tap', lat: parseFloat(lat.toFixed(4)), lon: parseFloat(lon.toFixed(4)) });
    try { window.ReactNativeWebView.postMessage(msg); } catch(err) {}
  }
}

// ─── RN → WebView message bridge ──────────────────────────────────────────
function onRNMsg(e) {
  try {
    var d = JSON.parse(e.data);
    if      (d.type === 'selectCountry') window.setSelectedCountry(d.lat, d.lon);
    else if (d.type === 'clearSelection') window.clearSelectedCountry();
    else if (d.type === 'setAutoRotate')  window.setAutoRotate(d.value);
  } catch(err) {}
}
window.addEventListener('message',   onRNMsg);
document.addEventListener('message', onRNMsg);

// ─── Animation loop (60 FPS) ───────────────────────────────────────────────
var lastTime = 0;
function animate(now) {
  requestAnimationFrame(animate);
  var dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  elapsed += dt;

  // Globe rotation
  if (autoRotate) {
    rotY += 0.003;
  } else if (animToCountry) {
    var dX = targetRotX - rotX;
    var dY = targetRotY - rotY;
    rotX += dX * 0.065;
    rotY += dY * 0.065;
    if (Math.abs(dX) < 0.0005 && Math.abs(dY) < 0.0005) animToCountry = false;
  } else if (!isDragging) {
    velX *= 0.88;
    velY *= 0.88;
    rotX = Math.max(-1.1, Math.min(1.1, rotX + velX));
    rotY += velY;
  }

  earth.rotation.x  = rotX;
  earth.rotation.y  = rotY;
  clouds.rotation.x = rotX;
  clouds.rotation.y = rotY + elapsed * 0.018;

  // Camera zoom
  currentCameraZ += (targetCameraZ - currentCameraZ) * 0.1;
  camera.position.z = currentCameraZ;

  // Pulse marker glow
  if (glowMesh.visible) {
    glowPulse += glowDir * dt * 0.9;
    if (glowPulse > 1.5) { glowPulse = 1.5; glowDir = -1; }
    if (glowPulse < 0.6) { glowPulse = 0.6; glowDir =  1; }
    glowMesh.scale.setScalar(glowPulse);
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// ─── Ready signal ─────────────────────────────────────────────────────────
setTimeout(function() {
  try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'})); } catch(e) {}
}, 400);

// ─── Resize ───────────────────────────────────────────────────────────────
window.addEventListener('resize', function() {
  W = window.innerWidth; H = window.innerHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
});

})();
</script>
</body>
</html>`;
