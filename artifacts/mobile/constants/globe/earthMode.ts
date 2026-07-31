/**
 * Earth Mode — the interactive globe.
 *
 * This is the original globe, moved onto the engine rather than rewritten. The
 * shaders, rotation maths, tilt limit, highlight rasteriser, marker pulse and
 * tap hit-testing are carried across character for character. Two things
 * changed, both mechanical:
 *   - the scene is owned by this module instead of being a file-level global;
 *   - camera distance is set through the CameraRig, configured with the same
 *     0.1-per-frame smoothing and the same 1.5..4.5 clamp, so the zoom feels
 *     identical.
 *
 * Known and deliberately preserved: auto-rotation, inertia decay and the
 * fly-to-country interpolation advance a fixed amount per rendered frame
 * rather than by elapsed time, so they run faster on a 120Hz display. That is
 * existing behaviour and is out of scope here.
 */
export const EARTH_MODE_JS = `
var EarthMode = (function(){
  var scene = new THREE.Scene();
  var renderer = null, camera = null, canvas = null;

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
    'const vec3 SUN = normalize(vec3(5.0,3.0,5.0));',
    'void main(){',
    '  vec3 N = normalize(vNorm);',
    '  float NdotL = dot(N, SUN);',
    '  float dayF = smoothstep(-0.12, 0.18, NdotL);',
    '  vec3 fallbackDay   = vec3(0.08,0.22,0.50);',
    '  vec3 fallbackNight = vec3(0.0,0.0,0.0);',
    '  vec3 day   = mix(fallbackDay,   texture2D(dayTex,   vUv).rgb, dayReady);',
    '  vec3 night = mix(fallbackNight, texture2D(nightTex, vUv).rgb, nightReady);',
    '  float diff = max(0.0, NdotL);',
    '  vec3 litDay = day * (0.05 + diff * 1.12);',
    '  vec3 cityLights = night * 3.2;',
    '  vec3 col = mix(cityLights, litDay, dayF);',
    '  float specStr = texture2D(specTex, vUv).r;',
    '  vec3 H = normalize(SUN + vec3(0.0,0.0,1.0));',
    '  float s = pow(max(0.0, dot(N, H)), 55.0) * specStr;',
    '  col += vec3(s * 0.55);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\\n');

  var earth = null, clouds = null, cloudMat = null, earthMat = null;

  // ─── Country Highlight canvas texture ──────────────────────────────────────
  var HL_W = 2048, HL_H = 1024;
  var hlCanvas = null, hlCtx = null, hlTexture = null, hlMat = null, hlMesh = null;
  var hlPulseActive = false, hlPulseT = 0.0;

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
  var markerMesh = null, glowMesh = null;

  // ─── Interaction state ─────────────────────────────────────────────────────
  // Max vertical tilt — wide enough to centre polar regions such as Antarctica.
  var MAX_TILT=1.45;
  var rotX=0.1, rotY=0, velX=0, velY=0;
  var targetRotX=0.1, targetRotY=0;
  var animToCountry=false, isDragging=false;
  var pinchZ0=2.5;
  var glowPulse=1, glowDir=1;

  // Preallocated so tap handling allocates nothing.
  var _mouse = null, _ray = null, _hitPoint = null;

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
  // Earth uses Euler order XYZ, so world = Rx(rotX) * Ry(rotY) * localPoint.
  // Solving for the (lat,lon) point landing on the camera axis (0,0,1) gives
  // rotY = PI/2 - theta and rotX = lat (in radians).
  function animateToLatLon(lat,lon){
    var theta=(lon+180)*Math.PI/180;
    var wantY=Math.PI/2-theta;
    // rotY accumulates without bound, so pick the equivalent angle nearest the
    // current rotation — otherwise the globe spins the long way (or many turns).
    var d=wantY-rotY;
    d=Math.atan2(Math.sin(d),Math.cos(d));
    targetRotY=rotY+d;
    targetRotX=Math.max(-MAX_TILT,Math.min(MAX_TILT,lat*Math.PI/180));
    animToCountry=true;
  }

  // ─── Commands ──────────────────────────────────────────────────────────────
  var hlTimer=null;
  function cancelHlRetry(){ if(hlTimer!==null){ clearTimeout(hlTimer); hlTimer=null; } }

  function selectCountry(lat,lon){
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
  }
  function clearSelection(){
    cancelHlRetry();
    markerMesh.visible=false; glowMesh.visible=false;
    hlCtx.clearRect(0,0,HL_W,HL_H); hlTexture.needsUpdate=true;
    hlMesh.visible=false; hlPulseActive=false;
  }
  function setAutoRotate(v){ autoRotate=!!v; }
  function setInteractive(v){
    interactive=!!v;
    if(!interactive){ isDragging=false; velX=velY=0; }
  }

  function doTap(cx,cy){
    var rect=canvas.getBoundingClientRect();
    _mouse.set(((cx-rect.left)/rect.width)*2-1, -((cy-rect.top)/rect.height)*2+1);
    _ray.setFromCamera(_mouse,camera);
    var hits=_ray.intersectObject(earth);
    if(hits.length>0){
      var lp=earth.worldToLocal(_hitPoint.copy(hits[0].point)).normalize();
      var lat=Math.asin(Math.max(-1,Math.min(1,lp.y)))*180/Math.PI;
      var lon=Math.atan2(lp.z,-lp.x)*180/Math.PI-180;
      if(lon<-180) lon+=360;
      drawHighlight(findFeatureAt(lat,lon));
      Bridge.post({type:'tap',lat:parseFloat(lat.toFixed(4)),lon:parseFloat(lon.toFixed(4))});
    }
  }

  // ─── Mode contract ─────────────────────────────────────────────────────────
  function init(ctx){
    renderer = ctx.renderer; camera = ctx.camera; canvas = ctx.canvas;

    _mouse = new THREE.Vector2();
    _ray = new THREE.Raycaster();
    _hitPoint = new THREE.Vector3();

    addStarLayer(5000, 0.06, 0.65); // background haze
    addStarLayer(1500, 0.12, 0.82); // mid layer
    addStarLayer(380,  0.21, 1.00); // foreground bright stars

    // Lights (for clouds, atmosphere — earth uses its own shader)
    scene.add(new THREE.AmbientLight(0x223355, 1.2));
    var sun = new THREE.DirectionalLight(0xfff8ee, 1.1);
    sun.position.set(5, 3, 5);
    scene.add(sun);

    earthMat = new THREE.ShaderMaterial({
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
    earth = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 36), earthMat);
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
      function(){ earthMat.uniforms.nightReady.value = 0.0; }
    );
    // Specular map for ocean reflections
    tl.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_specular_2048.jpg',
      function(t){ earthMat.uniforms.specTex.value = t; }
    );

    // Clouds
    cloudMat = new THREE.MeshPhongMaterial({ transparent:true, opacity:0.28, depthWrite:false });
    clouds = new THREE.Mesh(new THREE.SphereGeometry(1.007, 72, 36), cloudMat);
    scene.add(clouds);
    tl.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_1024.png',
      function(t){ cloudMat.map = t; cloudMat.needsUpdate = true; }
    );

    // Atmospheric glow (Fresnel)
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

    // Highlight overlay
    hlCanvas = document.createElement('canvas');
    hlCanvas.width = HL_W; hlCanvas.height = HL_H;
    hlCtx = hlCanvas.getContext('2d');
    hlTexture = new THREE.CanvasTexture(hlCanvas);
    hlTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    hlMat = new THREE.MeshBasicMaterial({
      map: hlTexture, transparent: true, opacity: 1.0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    hlMesh = new THREE.Mesh(new THREE.SphereGeometry(1.003, 72, 36), hlMat);
    hlMesh.visible = false;
    earth.add(hlMesh);

    // Marker + glow, parented to the earth so they rotate with it
    markerMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.020, 16, 16),
      new THREE.MeshBasicMaterial({ color:0x10B981 })
    );
    markerMesh.visible = false;
    earth.add(markerMesh);

    glowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 16, 16),
      new THREE.MeshBasicMaterial({ color:0x10B981, transparent:true, opacity:0.22 })
    );
    glowMesh.visible = false;
    earth.add(glowMesh);

    // Borders
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

    // Legacy globals kept so existing integrations keep working.
    window.setSelectedCountry   = selectCountry;
    window.clearSelectedCountry = clearSelection;
    window.setAutoRotate        = setAutoRotate;
    window.setInteractive       = setInteractive;
  }

  function update(dt, elapsed){
    // Globe rotation. Fixed per-frame steps: preserved original behaviour.
    if(autoRotate){ rotY+=0.0022; }
    else if(animToCountry){
      var dX=targetRotX-rotX, dY=targetRotY-rotY;
      rotX+=dX*0.065; rotY+=dY*0.065;
      if(Math.abs(dX)<0.0005&&Math.abs(dY)<0.0005) animToCountry=false;
    } else if(!isDragging){
      velX*=0.88; velY*=0.88;
      rotX=Math.max(-MAX_TILT,Math.min(MAX_TILT,rotX+velX)); rotY+=velY;
    }

    earth.rotation.x=rotX; earth.rotation.y=rotY;
    clouds.rotation.x=rotX; clouds.rotation.y=rotY+elapsed*0.016;

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
  }

  return {
    scene: scene,
    init: init,
    update: update,

    // Fixed-axis camera on +Z with the original 1.5..4.5 clamp and the
    // original 0.1-per-frame zoom smoothing.
    cameraProfile: {
      fov: 45, near: 0.1, far: 1000,
      yaw: 0, pitch: 0, distance: 2.5,
      limits: { minDistance: 1.5, maxDistance: 4.5, minPitch: 0, maxPitch: 0, lockOrbit: true },
      damping: { model: 'frame', distance: 0.1, orbit: 0.1, target: 0.1, inertia: false }
    },

    inputHandlers: {
      dragStart: function(){
        isDragging = interactive;
        velX = velY = 0;
        animToCountry = false;
        if (interactive) autoRotate = false;
      },
      drag: function(dx, dy){
        if (!isDragging || !interactive) return;
        velY = dx*0.006; velX = dy*0.006;
        rotY += velY;
        rotX = Math.max(-MAX_TILT, Math.min(MAX_TILT, rotX + velX));
      },
      dragEnd: function(){ isDragging = false; },
      pinchStart: function(){ pinchZ0 = CameraRig.getDistance(); },
      pinch: function(ratio){ CameraRig.setDistance(pinchZ0 * ratio); },
      tap: function(x, y){ doTap(x, y); }
    },

    commands: {
      selectCountry:  function(d){ selectCountry(d.lat, d.lon); },
      clearSelection: function(){ clearSelection(); },
      setAutoRotate:  function(d){ setAutoRotate(d.value); },
      setInteractive: function(d){ setInteractive(d.value); }
    },

    onRenderActiveChange: function(on){ if (!on) cancelHlRetry(); }
  };
})();
`;
