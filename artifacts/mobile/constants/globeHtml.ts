// Three.js interactive globe rendered in a WebView
// Communicates with React Native via postMessage / ReactNativeWebView

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
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(function(){
var cfg = window.GLOBE_CONFIG || {};
var autoRotate = cfg.autoRotate === true;
var interactive = cfg.interactive !== false;
var W = window.innerWidth, H = window.innerHeight;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);
camera.position.z = 2.5;

var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x050A14, 1);
document.body.appendChild(renderer.domElement);
var canvas = renderer.domElement;

// Stars
var starGeo = new THREE.BufferGeometry();
var SC = 7000;
var SP = new Float32Array(SC * 3);
for(var i = 0; i < SC; i++){
  var th = Math.random() * Math.PI * 2;
  var ph = Math.acos(Math.random() * 2 - 1);
  var r = 80 + Math.random() * 50;
  SP[i*3]   = r * Math.sin(ph) * Math.cos(th);
  SP[i*3+1] = r * Math.sin(ph) * Math.sin(th);
  SP[i*3+2] = r * Math.cos(ph);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(SP, 3));
var starMat = new THREE.PointsMaterial({ color:0xffffff, size:0.1, sizeAttenuation:true, transparent:true, opacity:0.85 });
scene.add(new THREE.Points(starGeo, starMat));

// Earth sphere
var earthGeo = new THREE.SphereGeometry(1, 64, 64);
var earthMat = new THREE.MeshPhongMaterial({
  color: 0x2244aa,
  specular: new THREE.Color(0x336688),
  shininess: 25
});
var earth = new THREE.Mesh(earthGeo, earthMat);
scene.add(earth);

var tl = new THREE.TextureLoader();
tl.crossOrigin = 'anonymous';
tl.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg', function(t){ earthMat.map=t; earthMat.needsUpdate=true; });
tl.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_normal_2048.jpg', function(t){ earthMat.normalMap=t; earthMat.needsUpdate=true; });
tl.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_specular_2048.jpg', function(t){ earthMat.specularMap=t; earthMat.needsUpdate=true; });

// Clouds
var cloudGeo = new THREE.SphereGeometry(1.006, 64, 64);
var cloudMat = new THREE.MeshPhongMaterial({ transparent:true, opacity:0.32, depthWrite:false });
var clouds = new THREE.Mesh(cloudGeo, cloudMat);
scene.add(clouds);
tl.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_1024.png', function(t){ cloudMat.map=t; cloudMat.needsUpdate=true; });

// Atmosphere glow
var atmMat = new THREE.ShaderMaterial({
  vertexShader:'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying vec3 vN;void main(){float i=pow(0.68-dot(vN,vec3(0.0,0.0,1.0)),2.5);gl_FragColor=vec4(0.08,0.45,1.0,1.0)*i;}',
  blending:THREE.AdditiveBlending, side:THREE.BackSide, transparent:true, depthWrite:false
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 64, 64), atmMat));

// Country marker — child of earth so it rotates with the globe
var markerMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.022, 16, 16),
  new THREE.MeshBasicMaterial({ color:0x10B981 })
);
markerMesh.visible = false;
earth.add(markerMesh);

var glowMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.048, 16, 16),
  new THREE.MeshBasicMaterial({ color:0x10B981, transparent:true, opacity:0.22 })
);
glowMesh.visible = false;
earth.add(glowMesh);

// Lighting
scene.add(new THREE.AmbientLight(0x223344, 1.6));
var sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(5, 3, 5);
scene.add(sun);
var fill = new THREE.DirectionalLight(0x445577, 0.25);
fill.position.set(-3, -1, -3);
scene.add(fill);

// Rotation state
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

// Convert lat/lon to local sphere coordinates (Three.js SphereGeometry convention)
function ll2local(lat, lon) {
  var phi = (90 - lat) * Math.PI / 180;
  var theta = (lon + 180) * Math.PI / 180;
  return {
    x: -Math.sin(phi) * Math.cos(theta),
    y:  Math.cos(phi),
    z:  Math.sin(phi) * Math.sin(theta)
  };
}

// Set marker at lat/lon
function setMarkerPos(lat, lon) {
  var p = ll2local(lat, lon);
  markerMesh.position.set(p.x * 1.022, p.y * 1.022, p.z * 1.022);
  glowMesh.position.copy(markerMesh.position);
  markerMesh.visible = true;
  glowMesh.visible = true;
}

// Animate globe to face lat/lon
function animateToLatLon(lat, lon) {
  var theta = (lon + 180) * Math.PI / 180;
  targetRotY = Math.PI / 2 - theta;
  targetRotX = -lat * Math.PI / 180 * 0.4;
  animToCountry = true;
}

// Exposed global functions for WebView injection
window.setSelectedCountry = function(lat, lon) {
  setMarkerPos(lat, lon);
  animateToLatLon(lat, lon);
  autoRotate = false;
};
window.clearSelectedCountry = function() {
  markerMesh.visible = false;
  glowMesh.visible = false;
};
window.setAutoRotate = function(v) { autoRotate = v; };

// Touch helpers
function pinchDistance(e) {
  var dx = e.touches[0].clientX - e.touches[1].clientX;
  var dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.sqrt(dx*dx + dy*dy);
}

canvas.addEventListener('touchstart', function(e) {
  e.preventDefault();
  if(e.touches.length === 1) {
    isDragging = interactive;
    prevTX = tapStartX = e.touches[0].clientX;
    prevTY = tapStartY = e.touches[0].clientY;
    tapStartTime = Date.now();
    hasMoved = false;
    velX = velY = 0;
    animToCountry = false;
    if(interactive) autoRotate = false;
  }
  if(e.touches.length === 2) { pinchDist0 = pinchDistance(e); pinchZ0 = currentCameraZ; }
}, {passive:false});

canvas.addEventListener('touchmove', function(e) {
  e.preventDefault();
  if(e.touches.length === 2) {
    isDragging = false;
    if(pinchDist0 !== null) {
      var scale = pinchDist0 / pinchDistance(e);
      targetCameraZ = Math.max(1.5, Math.min(4.5, pinchZ0 * scale));
    }
    return;
  }
  if(!isDragging || !interactive) return;
  var dx = e.touches[0].clientX - prevTX;
  var dy = e.touches[0].clientY - prevTY;
  var totalDX = e.touches[0].clientX - tapStartX;
  var totalDY = e.touches[0].clientY - tapStartY;
  if(Math.sqrt(totalDX*totalDX + totalDY*totalDY) > 5) hasMoved = true;
  velY = dx * 0.006;
  velX = dy * 0.006;
  rotY += velY;
  rotX = Math.max(-1.1, Math.min(1.1, rotX + velX));
  prevTX = e.touches[0].clientX;
  prevTY = e.touches[0].clientY;
}, {passive:false});

canvas.addEventListener('touchend', function(e) {
  e.preventDefault();
  if(e.changedTouches.length===1 && !hasMoved && Date.now()-tapStartTime < 350) {
    doTap(tapStartX, tapStartY);
  }
  if(e.touches.length === 0) { isDragging = false; }
  pinchDist0 = null;
}, {passive:false});

function doTap(cx, cy) {
  var rect = canvas.getBoundingClientRect();
  var mouse = new THREE.Vector2(
    ((cx - rect.left) / rect.width) * 2 - 1,
    -((cy - rect.top) / rect.height) * 2 + 1
  );
  var ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, camera);
  var hits = ray.intersectObject(earth);
  if(hits.length > 0) {
    var lp = earth.worldToLocal(hits[0].point.clone()).normalize();
    var lat = Math.asin(Math.max(-1, Math.min(1, lp.y))) * 180 / Math.PI;
    var lon = Math.atan2(lp.z, -lp.x) * 180 / Math.PI - 180;
    if(lon < -180) lon += 360;
    var msg = JSON.stringify({type:'tap', lat:parseFloat(lat.toFixed(4)), lon:parseFloat(lon.toFixed(4))});
    try { window.ReactNativeWebView.postMessage(msg); } catch(err) {}
  }
}

// RN → WebView messages
function onRNMessage(e) {
  try {
    var d = JSON.parse(e.data);
    if(d.type === 'selectCountry') window.setSelectedCountry(d.lat, d.lon);
    else if(d.type === 'clearSelection') window.clearSelectedCountry();
    else if(d.type === 'setAutoRotate') window.setAutoRotate(d.value);
  } catch(err) {}
}
window.addEventListener('message', onRNMessage);
document.addEventListener('message', onRNMessage);

// Animation loop
var lastTime = 0;
function animate(now) {
  requestAnimationFrame(animate);
  var dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  elapsed += dt;

  if(autoRotate) {
    rotY += 0.003;
  } else if(animToCountry) {
    var dX = targetRotX - rotX;
    var dY = targetRotY - rotY;
    rotX += dX * 0.065;
    rotY += dY * 0.065;
    if(Math.abs(dX) < 0.0005 && Math.abs(dY) < 0.0005) animToCountry = false;
  } else if(!isDragging) {
    velX *= 0.88;
    velY *= 0.88;
    rotX = Math.max(-1.1, Math.min(1.1, rotX + velX));
    rotY += velY;
  }

  earth.rotation.x = rotX;
  earth.rotation.y = rotY;
  clouds.rotation.x = rotX;
  clouds.rotation.y = rotY + elapsed * 0.018;

  currentCameraZ += (targetCameraZ - currentCameraZ) * 0.1;
  camera.position.z = currentCameraZ;

  // Pulse the glow marker
  if(glowMesh.visible) {
    glowPulse += glowDir * dt * 0.9;
    if(glowPulse > 1.5) { glowPulse = 1.5; glowDir = -1; }
    if(glowPulse < 0.6) { glowPulse = 0.6; glowDir = 1; }
    glowMesh.scale.setScalar(glowPulse);
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// Notify ready
setTimeout(function() {
  try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'})); } catch(e) {}
}, 400);

window.addEventListener('resize', function() {
  W = window.innerWidth; H = window.innerHeight;
  camera.aspect = W/H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
});
})();
</script>
</body>
</html>`;
