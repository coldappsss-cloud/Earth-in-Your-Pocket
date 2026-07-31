// Three.js interactive globe — v3
// Improvements: day/night custom shader with city lights, 3-layer starfield,
// highlight pulse animation, improved atmospheric glow.
// All existing functionality preserved.

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
</style>
</head>
<body>
<div id="fallback">The globe needs an internet connection to load.<br>Search still works offline.</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
<script>
(function(){
'use strict';

// The renderer is loaded from a CDN — fail loudly instead of showing a blank screen.
if (typeof THREE === 'undefined') {
  document.getElementById('fallback').style.display = 'flex';
  try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',reason:'three-unavailable'})); } catch(e) {}
  window.setSelectedCountry = function(){};
  window.clearSelectedCountry = function(){};
  window.setAutoRotate = function(){};
  window.setInteractive = function(){};
  window.setRenderActive = function(){};
  window.__globeMsg = function(){};
  return;
}

var cfg = window.GLOBE_CONFIG || {};
var autoRotate = cfg.autoRotate === true;
var interactive = cfg.interactive !== false;
var W = window.innerWidth, H = window.innerHeight;

// ─── Renderer ──────────────────────────────────────────────────────────────
var scene  = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);
camera.position.z = 2.5;

var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x050A14, 1);
document.body.appendChild(renderer.domElement);
var canvas = renderer.domElement;

// ─── 3-Layer Starfield (varied sizes & brightness for depth) ───────────────
function addStarLayer(count, size, opacity) {
  var geo = new THREE.BufferGeometry();
  var pos = new Float32Array(count * 3);
  for (var i = 0; i < count; i++) {
    var th = Math.random() * Math.PI * 2;
    var ph = Math.acos(Math.random() * 2 - 1);
    var r  = 88 + Math.random() * 35;
    pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
    pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
    pos[i*3+2] = r * Math.cos(ph);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: size, sizeAttenuation: true,
    transparent: true, opacity: opacity,
  })));
}
addStarLayer(5000, 0.06, 0.65); // background haze
addStarLayer(1500, 0.12, 0.82); // mid layer
addStarLayer(380,  0.21, 1.00); // foreground bright stars

// ─── Lights (for clouds, atmosphere — earth uses its own shader) ────────────
scene.add(new THREE.AmbientLight(0x223355, 1.2));
var sun = new THREE.DirectionalLight(0xfff8ee, 1.1);
sun.position.set(5, 3, 5);
scene.add(sun);

// ─── Earth — custom day/night shader ───────────────────────────────────────
// SUN direction in world space = eye space (camera never rotates).
// normalMatrix rotates surface normals with earth's rotation → correct terminator.
var VERT = [
  'varying vec2 vUv;',
  'varying vec3 vNorm;',
  'void main(){',
  '  vUv  = uv;',
  '  vNorm= normalize(normalMatrix*normal);',
  '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
  '}'
].join('\\n');

var FRAG = [
  'uniform sampler2D dayTex;',
  'uniform sampler2D nightTex;',
  'uniform sampler2D specTex;',
  'uniform float dayReady;',
  'uniform float nightReady;',
  'varying vec2 vUv;',
  'varying vec3 vNorm;',
  // Sun direction in eye-space (camera at Z, no rotation → world ≈ eye for dirs)
  'const vec3 SUN = normalize(vec3(5.0,3.0,5.0));',
  'void main(){',
  '  vec3 N = normalize(vNorm);',
  '  float NdotL = dot(N, SUN);',
  // Smooth terminator: twilight band between -0.12 and 0.18
  '  float dayF = smoothstep(-0.12, 0.18, NdotL);',
  // Fallback while textures load
  '  vec3 fallbackDay   = vec3(0.08,0.22,0.50);',
  '  vec3 fallbackNight = vec3(0.0,0.0,0.0);',
  '  vec3 day   = mix(fallbackDay,   texture2D(dayTex,   vUv).rgb, dayReady);',
  '  vec3 night = mix(fallbackNight, texture2D(nightTex, vUv).rgb, nightReady);',
  // Day side: diffuse lit with gentle ambient
  '  float diff = max(0.0, NdotL);',
  '  vec3 litDay = day * (0.05 + diff * 1.12);',
  // Night side: city lights boosted so they glow warmly
  '  vec3 cityLights = night * 3.2;',
  // Blend
  '  vec3 col = mix(cityLights, litDay, dayF);',
  // Ocean specular glint (Blinn-Phong approximation, V ≈ +Z in eye space)
  '  float specStr = texture2D(specTex, vUv).r;',
  '  vec3 H = normalize(SUN + vec3(0.0,0.0,1.0));',
  '  float s = pow(max(0.0, dot(N, H)), 55.0) * specStr;',
  '  col += vec3(s * 0.55);',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\\n');

var earthGeo = new THREE.SphereGeometry(1, 72, 36);
var earthMat = new THREE.ShaderMaterial({
  uniforms: {
    dayTex:     { value: null },
    nightTex:   { value: null },
    specTex:    { value: null },
    dayReady:   { value: 0.0 },
    nightReady: { value: 0.0 },
  },
  vertexShader:   VERT,
  fragmentShader: FRAG,
});
var earth = new THREE.Mesh(earthGeo, earthMat);
scene.add(earth);

var tl = new THREE.TextureLoader();
tl.crossOrigin = 'anonymous';

// Realistic Blue Marble day texture
tl.load(
  'https://unpkg.com/three-globe@2.30.0/example/img/earth-day.jpg',
  function(t){ earthMat.uniforms.dayTex.value = t; earthMat.uniforms.dayReady.value = 1.0; },
  undefined,
  function(){
    tl.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg',
      function(t){ earthMat.uniforms.dayTex.value = t; earthMat.uniforms.dayReady.value = 1.0; }
    );
  }
);
// Night city lights
tl.load(
  'https://unpkg.com/three-globe@2.30.0/example/img/earth-night.jpg',
  function(t){ earthMat.uniforms.nightTex.value = t; earthMat.uniforms.nightReady.value = 1.0; },
  undefined,
  function(){
    // fallback: dark texture (night side stays dark)
    earthMat.uniforms.nightReady.value = 0.0;
  }
);
// Specular map for ocean reflections
tl.load(
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_specular_2048.jpg',
  function(t){ earthMat.uniforms.specTex.value = t; }
);

// ─── Clouds ────────────────────────────────────────────────────────────────
var cloudMat = new THREE.MeshPhongMaterial({ transparent:true, opacity:0.28, depthWrite:false });
var clouds = new THREE.Mesh(new THREE.SphereGeometry(1.007, 72, 36), cloudMat);
scene.add(clouds);
tl.load(
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_1024.png',
  function(t){ cloudMat.map = t; cloudMat.needsUpdate = true; }
);

// ─── Atmospheric glow (improved Fresnel) ───────────────────────────────────
var atmMat = new THREE.ShaderMaterial({
  vertexShader: [
    'varying vec3 vN;',
    'void main(){vN=normalize(normalMatrix*normal);',
    'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'
  ].join(''),
  fragmentShader: [
    'varying vec3 vN;',
    'void main(){',
    '  float i=pow(max(0.0,0.70-dot(vN,vec3(0.0,0.0,1.0))),2.2);',
    '  vec3 atmColor=mix(vec3(0.05,0.30,0.95),vec3(0.02,0.55,1.0),i);',
    '  gl_FragColor=vec4(atmColor,i*0.85);',
    '}'
  ].join(''),
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide,
  transparent: true,
  depthWrite: false,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.18, 64, 32), atmMat));

// ─── Country Highlight canvas texture ──────────────────────────────────────
var HL_W = 2048, HL_H = 1024;
var hlCanvas = document.createElement('canvas');
hlCanvas.width = HL_W; hlCanvas.height = HL_H;
var hlCtx = hlCanvas.getContext('2d');
var hlTexture = new THREE.CanvasTexture(hlCanvas);
hlTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

var hlMat = new THREE.MeshBasicMaterial({
  map: hlTexture,
  transparent: true,
  opacity: 1.0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
var hlMesh = new THREE.Mesh(new THREE.SphereGeometry(1.003, 72, 36), hlMat);
hlMesh.visible = false;
earth.add(hlMesh);

// Highlight pulse state
var hlPulseActive = false;
var hlPulseT = 0.0;

function startHighlightPulse() {
  hlPulseActive = true;
  hlPulseT = 0.0;
  hlMat.opacity = 1.0;
}

// ─── Country borders (TopoJSON LineSegments) ───────────────────────────────
var geoFeatures = null;

function ll2vec(lon, lat, r) {
  var phi   = (90 - lat) * Math.PI / 180;
  var theta = (lon + 180) * Math.PI / 180;
  return [ -r*Math.sin(phi)*Math.cos(theta), r*Math.cos(phi), r*Math.sin(phi)*Math.sin(theta) ];
}

if (typeof topojson !== 'undefined') fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  .then(function(r){ return r.json(); })
  .then(function(topo){
    geoFeatures = topojson.feature(topo, topo.objects.countries).features;
    var borders  = topojson.mesh(topo, topo.objects.countries);
    var pos = [];
    function addLine(ring) {
      for (var i = 0; i < ring.length - 1; i++) {
        var a = ll2vec(ring[i][0],   ring[i][1],   1.0018);
        var b = ll2vec(ring[i+1][0], ring[i+1][1], 1.0018);
        pos.push(a[0],a[1],a[2], b[0],b[1],b[2]);
      }
    }
    if (borders.type === 'MultiLineString') borders.coordinates.forEach(addLine);
    else if (borders.type === 'LineString')  addLine(borders.coordinates);
    var bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pos), 3));
    earth.add(new THREE.LineSegments(bGeo,
      new THREE.LineBasicMaterial({ color: 0xdde8f0, transparent: true, opacity: 0.45 })
    ));
  })
  .catch(function(){});

// ─── Point-in-polygon ──────────────────────────────────────────────────────
function pipRing(ring, lon, lat) {
  var inside = false;
  for (var i = 0, j = ring.length-1; i < ring.length; j = i++) {
    var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
    if (((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}
function findFeatureAt(lat, lon) {
  if (!geoFeatures) return null;
  for (var i=0;i<geoFeatures.length;i++) {
    var f=geoFeatures[i]; if(!f.geometry) continue;
    var g=f.geometry;
    if (g.type==='Polygon')      { if(pipRing(g.coordinates[0],lon,lat)) return f; }
    else if(g.type==='MultiPolygon') {
      for(var j=0;j<g.coordinates.length;j++) if(pipRing(g.coordinates[j][0],lon,lat)) return f;
    }
  }
  return null;
}

// ─── Highlight draw ────────────────────────────────────────────────────────
function lonlatToUV(lon, lat) {
  return [ (lon+180)/360*HL_W, (90-lat)/180*HL_H ];
}
function drawHighlight(feature) {
  hlCtx.clearRect(0, 0, HL_W, HL_H);
  if (!feature || !feature.geometry) {
    hlTexture.needsUpdate = true; hlMesh.visible = false; return;
  }
  function tracePoly(rings) {
    rings.forEach(function(ring){
      var uv=lonlatToUV(ring[0][0],ring[0][1]);
      hlCtx.moveTo(uv[0],uv[1]);
      for(var i=1;i<ring.length;i++){ uv=lonlatToUV(ring[i][0],ring[i][1]); hlCtx.lineTo(uv[0],uv[1]); }
      hlCtx.closePath();
    });
  }
  var g=feature.geometry;
  hlCtx.beginPath();
  if      (g.type==='Polygon')      tracePoly(g.coordinates);
  else if (g.type==='MultiPolygon') g.coordinates.forEach(tracePoly);
  hlCtx.fillStyle='rgba(16,185,129,0.18)'; hlCtx.fill();
  hlCtx.shadowBlur=10; hlCtx.shadowColor='rgba(16,185,129,0.75)';
  hlCtx.strokeStyle='rgba(16,185,129,0.92)'; hlCtx.lineWidth=3; hlCtx.stroke();
  hlCtx.shadowBlur=0;
  hlCtx.strokeStyle='rgba(255,255,255,0.50)'; hlCtx.lineWidth=1.2; hlCtx.stroke();
  hlTexture.needsUpdate=true;
  hlMesh.visible=true;
  hlMat.opacity=1.0;
  startHighlightPulse();
}

// ─── Country marker ────────────────────────────────────────────────────────
var markerMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.020, 16, 16),
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

// ─── Interaction state ─────────────────────────────────────────────────────
var rotX=0.1, rotY=0, velX=0, velY=0;
var targetCameraZ=2.5, currentCameraZ=2.5;
var targetRotX=0.1, targetRotY=0;
var animToCountry=false, isDragging=false;
var prevTX=0, prevTY=0, tapStartX=0, tapStartY=0, tapStartTime=0, hasMoved=false;
var pinchDist0=null, pinchZ0=2.5;
var glowPulse=1, glowDir=1, elapsed=0;

function ll2local(lat,lon){
  var phi=(90-lat)*Math.PI/180, theta=(lon+180)*Math.PI/180;
  return { x:-Math.sin(phi)*Math.cos(theta), y:Math.cos(phi), z:Math.sin(phi)*Math.sin(theta) };
}
function setMarkerPos(lat,lon){
  var p=ll2local(lat,lon);
  markerMesh.position.set(p.x*1.022,p.y*1.022,p.z*1.022);
  glowMesh.position.copy(markerMesh.position);
  markerMesh.visible=true; glowMesh.visible=true;
}
function animateToLatLon(lat,lon){
  var theta=(lon+180)*Math.PI/180;
  targetRotY=Math.PI/2-theta;
  targetRotX=-lat*Math.PI/180*0.4;
  animToCountry=true;
}

// ─── RN ↔ WebView API ─────────────────────────────────────────────────────
var hlTimer=null;
function cancelHlRetry(){ if(hlTimer!==null){ clearTimeout(hlTimer); hlTimer=null; } }

window.setSelectedCountry = function(lat,lon){
  cancelHlRetry();
  setMarkerPos(lat,lon);
  animateToLatLon(lat,lon);
  autoRotate=false;
  var tries=0;
  function tryHL(){
    hlTimer=null;
    var f=findFeatureAt(lat,lon);
    if(f){ drawHighlight(f); return; }
    if(tries++<20) hlTimer=setTimeout(tryHL,150);
  }
  tryHL();
};
window.clearSelectedCountry = function(){
  cancelHlRetry();
  markerMesh.visible=false; glowMesh.visible=false;
  hlCtx.clearRect(0,0,HL_W,HL_H); hlTexture.needsUpdate=true;
  hlMesh.visible=false; hlPulseActive=false;
};
window.setAutoRotate  = function(v){ autoRotate=!!v; };
window.setInteractive = function(v){
  interactive=!!v;
  if(!interactive){ isDragging=false; velX=velY=0; }
};

// ─── Touch handlers ────────────────────────────────────────────────────────
function pinchD(e){ var dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY; return Math.sqrt(dx*dx+dy*dy); }

canvas.addEventListener('touchstart',function(e){
  e.preventDefault();
  if(e.touches.length===1){
    isDragging=interactive; prevTX=tapStartX=e.touches[0].clientX; prevTY=tapStartY=e.touches[0].clientY;
    tapStartTime=Date.now(); hasMoved=false; velX=velY=0; animToCountry=false;
    if(interactive) autoRotate=false;
  }
  if(e.touches.length===2){ pinchDist0=pinchD(e); pinchZ0=currentCameraZ; }
},{passive:false});

canvas.addEventListener('touchmove',function(e){
  e.preventDefault();
  if(e.touches.length===2){
    isDragging=false;
    if(pinchDist0!==null){ var sc=pinchDist0/pinchD(e); targetCameraZ=Math.max(1.5,Math.min(4.5,pinchZ0*sc)); }
    return;
  }
  if(!isDragging||!interactive) return;
  var dx=e.touches[0].clientX-prevTX, dy=e.touches[0].clientY-prevTY;
  var tdx=e.touches[0].clientX-tapStartX, tdy=e.touches[0].clientY-tapStartY;
  if(Math.sqrt(tdx*tdx+tdy*tdy)>5) hasMoved=true;
  velY=dx*0.006; velX=dy*0.006;
  rotY+=velY; rotX=Math.max(-1.1,Math.min(1.1,rotX+velX));
  prevTX=e.touches[0].clientX; prevTY=e.touches[0].clientY;
},{passive:false});

canvas.addEventListener('touchend',function(e){
  e.preventDefault();
  if(e.changedTouches.length===1&&!hasMoved&&Date.now()-tapStartTime<350) doTap(tapStartX,tapStartY);
  if(e.touches.length===0) isDragging=false;
  pinchDist0=null;
},{passive:false});

function doTap(cx,cy){
  var rect=canvas.getBoundingClientRect();
  var mouse=new THREE.Vector2(((cx-rect.left)/rect.width)*2-1,-((cy-rect.top)/rect.height)*2+1);
  var ray=new THREE.Raycaster(); ray.setFromCamera(mouse,camera);
  var hits=ray.intersectObject(earth);
  if(hits.length>0){
    var lp=earth.worldToLocal(hits[0].point.clone()).normalize();
    var lat=Math.asin(Math.max(-1,Math.min(1,lp.y)))*180/Math.PI;
    var lon=Math.atan2(lp.z,-lp.x)*180/Math.PI-180;
    if(lon<-180) lon+=360;
    drawHighlight(findFeatureAt(lat,lon));
    try{ window.ReactNativeWebView.postMessage(JSON.stringify({type:'tap',lat:parseFloat(lat.toFixed(4)),lon:parseFloat(lon.toFixed(4))})); }catch(e){}
  }
}

function onRNMsg(e){
  try{
    var d=JSON.parse(e.data);
    if(d.type==='selectCountry')  window.setSelectedCountry(d.lat,d.lon);
    else if(d.type==='clearSelection') window.clearSelectedCountry();
    else if(d.type==='setAutoRotate')  window.setAutoRotate(d.value);
    else if(d.type==='setInteractive') window.setInteractive(d.value);
    else if(d.type==='setRenderActive') window.setRenderActive(d.value);
  }catch(err){}
}
window.addEventListener('message',onRNMsg);
document.addEventListener('message',onRNMsg);
// Direct entry point used by injectJavaScript from React Native.
window.__globeMsg = function(s){ onRNMsg({data:s}); };

// ─── Animation loop ────────────────────────────────────────────────────────
var lastTime=0, rafId=null, renderActive=true;
function animate(now){
  rafId=requestAnimationFrame(animate);
  var dt=Math.min((now-lastTime)/1000,0.05); lastTime=now; elapsed+=dt;

  // Globe rotation
  if(autoRotate){ rotY+=0.0022; }
  else if(animToCountry){
    var dX=targetRotX-rotX, dY=targetRotY-rotY;
    rotX+=dX*0.065; rotY+=dY*0.065;
    if(Math.abs(dX)<0.0005&&Math.abs(dY)<0.0005) animToCountry=false;
  } else if(!isDragging){
    velX*=0.88; velY*=0.88;
    rotX=Math.max(-1.1,Math.min(1.1,rotX+velX)); rotY+=velY;
  }

  earth.rotation.x=rotX; earth.rotation.y=rotY;
  clouds.rotation.x=rotX; clouds.rotation.y=rotY+elapsed*0.016;

  // Smooth camera zoom
  currentCameraZ+=(targetCameraZ-currentCameraZ)*0.1;
  camera.position.z=currentCameraZ;

  // Pulse glow marker
  if(glowMesh.visible){
    glowPulse+=glowDir*dt*0.85;
    if(glowPulse>1.5){ glowPulse=1.5; glowDir=-1; }
    if(glowPulse<0.6){ glowPulse=0.6; glowDir=1; }
    glowMesh.scale.setScalar(glowPulse);
  }

  // Highlight pulse (single sine pulse after selection)
  if(hlPulseActive){
    hlPulseT+=dt;
    var DUR=1.5;
    if(hlPulseT<DUR){
      hlMat.opacity=1.0-0.60*Math.sin((hlPulseT/DUR)*Math.PI);
    } else {
      hlMat.opacity=1.0; hlPulseActive=false;
    }
  }

  renderer.render(scene,camera);
}
rafId=requestAnimationFrame(animate);

window.setRenderActive = function(v){
  v=!!v;
  if(v===renderActive) return;
  renderActive=v;
  if(v){
    lastTime=performance.now();
    if(rafId===null) rafId=requestAnimationFrame(animate);
  } else if(rafId!==null){
    cancelAnimationFrame(rafId); rafId=null;
    cancelHlRetry();
  }
};

// Ready signal
setTimeout(function(){ try{ window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'})); }catch(e){} },400);

window.addEventListener('resize',function(){
  W=window.innerWidth; H=window.innerHeight;
  camera.aspect=W/H; camera.updateProjectionMatrix(); renderer.setSize(W,H);
});
})();
</script>
</body>
</html>`;
