/**
 * Space Mode — the deep-space environment plus the Solar System.
 *
 * View-only: no picking, no fly-to, no labels, no panels. The Sun and eight
 * planets (built by the `Planets` module) sit inside the environment this
 * module owns — the starfield, the faint galactic backdrop, and the lighting.
 *
 * Design decisions worth knowing before extending it:
 *
 * 1. Scale. One world unit is treated as roughly 1000 km, but the Solar System
 *    itself is laid out for legibility, not accuracy — see `planets.ts`. The
 *    camera near/far planes are set wide enough for planetary distances
 *    without z-fighting at close range, which is why the near plane is 1
 *    rather than 0.1.
 *
 * 2. The starfield is a single THREE.Points with custom attributes, so several
 *    thousand stars cost one draw call. Colour temperature, size and twinkle
 *    phase are per-star attributes evaluated on the GPU; nothing about the
 *    starfield touches the CPU after construction beyond a single uniform.
 *
 * 3. Stars sit on a far shell and never move relative to the camera target, so
 *    they read as infinitely distant.
 *
 * 4. Lighting is a THREE.PointLight at the Sun's position (the world origin)
 *    plus a near-black ambient. A point light — not a directional one — is
 *    what makes each planet's day/night terminator point radially away from
 *    the Sun rather than all planets being lit from the same absolute
 *    direction regardless of where they sit in the system.
 *
 * 5. Anything numbering in the thousands — asteroids, satellites, debris —
 *    must use InstancedMesh or Points. Individual meshes will not scale.
 *
 * 6. All motion here is elapsed-time based, so behaviour is identical on 60Hz
 *    and 120Hz displays.
 */
export const SPACE_MODE_JS = `
var SpaceMode = (function(){
  var scene = new THREE.Scene();
  var starMaterial = null;
  var STAR_COUNT = 6000;

  // Star colour temperatures, roughly following the observed distribution:
  // mostly cool and faint, a few hot blue-white giants.
  var STAR_PALETTE = [
    { c: [0.62, 0.72, 1.00], w: 0.04 },  // O/B  blue
    { c: [0.79, 0.86, 1.00], w: 0.09 },  // A    blue-white
    { c: [1.00, 1.00, 0.98], w: 0.22 },  // F    white
    { c: [1.00, 0.96, 0.84], w: 0.30 },  // G    yellow-white
    { c: [1.00, 0.86, 0.66], w: 0.23 },  // K    orange
    { c: [1.00, 0.72, 0.55], w: 0.12 }   // M    red
  ];

  function pickStarColor(r){
    var acc = 0;
    for (var i = 0; i < STAR_PALETTE.length; i++) {
      acc += STAR_PALETTE[i].w;
      if (r <= acc) return STAR_PALETTE[i].c;
    }
    return STAR_PALETTE[STAR_PALETTE.length - 1].c;
  }

  var STAR_VERT = [
    'attribute float aSize;',
    'attribute float aPhase;',
    'attribute float aTwinkleRate;',
    'attribute vec3  aColor;',
    'uniform float uTime;',
    'uniform float uPixelRatio;',
    'varying vec3  vColor;',
    'varying float vAlpha;',
    'void main(){',
    '  vColor = aColor;',
    // Twinkle is a slow sine per star. Amplitude is small on purpose: a
    // starfield that flickers hard reads as noise, not as depth.
    '  vAlpha = 0.72 + 0.28 * sin(uTime * aTwinkleRate + aPhase);',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_PointSize = aSize * uPixelRatio * (300.0 / max(1.0, -mv.z));',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\\n');

  var STAR_FRAG = [
    'varying vec3  vColor;',
    'varying float vAlpha;',
    'void main(){',
    '  vec2 d = gl_PointCoord - vec2(0.5);',
    '  float r = length(d);',
    '  if (r > 0.5) discard;',
    // Soft round falloff so points read as light rather than as squares.
    // Ordered edges: smoothstep with edge0 > edge1 is undefined in GLSL.
    '  float a = 1.0 - smoothstep(0.0, 0.5, r);',
    '  a = pow(a, 1.9);',
    '  gl_FragColor = vec4(vColor, a * vAlpha);',
    '}'
  ].join('\\n');

  var STAR_INNER_RADIUS = 12000;
  var STAR_OUTER_RADIUS = 16000;

  function buildStarfield(pixelRatio){
    var geo = new THREE.BufferGeometry();
    var pos     = new Float32Array(STAR_COUNT * 3);
    var col     = new Float32Array(STAR_COUNT * 3);
    var size    = new Float32Array(STAR_COUNT);
    var phase   = new Float32Array(STAR_COUNT);
    var rate    = new Float32Array(STAR_COUNT);

    for (var i = 0; i < STAR_COUNT; i++) {
      // Uniform on a sphere: acos of a uniform cosine avoids polar clustering.
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(Math.random() * 2 - 1);
      var r  = STAR_INNER_RADIUS + Math.random() * (STAR_OUTER_RADIUS - STAR_INNER_RADIUS);
      pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = r * Math.cos(ph);
      pos[i*3+2] = r * Math.sin(ph) * Math.sin(th);

      var c = pickStarColor(Math.random());
      col[i*3] = c[0]; col[i*3+1] = c[1]; col[i*3+2] = c[2];

      // Magnitude distribution: a cubic bias gives many faint stars and a
      // small number of bright ones, which is what makes a sky look real.
      //
      // Sizes are calibrated against the shell radius and the 300/z falloff in
      // the vertex shader, so the on-screen result is roughly 2 device pixels
      // for a typical star and 8 for the brightest. Fill rate is the limit on
      // mobile: a few thousand large additive points will halve the frame rate,
      // so keep the upper bound small if the star count grows.
      var m = Math.random();
      size[i] = 45 + Math.pow(m, 3.0) * 145;

      phase[i] = Math.random() * Math.PI * 2;
      rate[i]  = 0.25 + Math.random() * 0.9;
    }

    geo.setAttribute('position',     new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor',       new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize',        new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase',       new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aTwinkleRate', new THREE.BufferAttribute(rate, 1));
    // The shell radius is known, so skip the per-frame bounding sphere work.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,0,0), STAR_OUTER_RADIUS);

    starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uPixelRatio: { value: pixelRatio }
      },
      vertexShader:   STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent:  true,
      depthWrite:   false,
      depthTest:    false,
      blending:     THREE.AdditiveBlending
    });

    var points = new THREE.Points(geo, starMaterial);
    points.frustumCulled = false;   // always fully on screen; culling is wasted work
    points.renderOrder = -1;
    return points;
  }

  // A very faint band of light across the sky. Subtle by design — this is
  // atmosphere, not a galaxy effect.
  function buildBackdrop(){
    var mat = new THREE.ShaderMaterial({
      uniforms: { uAxis: { value: new THREE.Vector3(0.35, 0.90, 0.26).normalize() } },
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){',
        '  vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\\n'),
      fragmentShader: [
        'uniform vec3 uAxis;',
        'varying vec3 vDir;',
        'void main(){',
        '  float band = pow(1.0 - abs(dot(normalize(vDir), uAxis)), 20.0);',
        '  vec3 deep = vec3(0.004, 0.007, 0.018);',
        '  vec3 glow = vec3(0.045, 0.050, 0.085);',
        '  gl_FragColor = vec4(mix(deep, glow, band), 1.0);',
        '}'
      ].join('\\n'),
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false
    });
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(STAR_OUTER_RADIUS * 1.2, 32, 16), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -2;
    return mesh;
  }

  // Distance the pinch gesture started from.
  var pinchD0 = 6200;
  var solarSystem = null;

  function init(ctx){
    var pr = Math.min(window.devicePixelRatio, 2);
    scene.add(buildBackdrop());
    scene.add(buildStarfield(pr));

    solarSystem = Planets.build(scene);

    // Sun-like key light: a point light at the Sun's position (the world
    // origin), not a directional light. A directional light shines from one
    // absolute direction everywhere in the scene, which would light every
    // planet's near side identically regardless of where it sits around the
    // Sun. A point light at the origin makes each planet's lit hemisphere
    // point radially away from the Sun, which is what a real orbiting body
    // looks like. Falloff (decay 1, physically-correct-ish) is calibrated so
    // Neptune's orbit (radius ~1480) still reads as lit, not black.
    var sun = new THREE.PointLight(0xFFF4E2, 3.4, 0, 1);
    sun.position.set(0, 0, 0);
    scene.add(sun);

    // Near-black fill: space has almost no bounce light, but a pure zero
    // ambient makes unlit hemispheres read as holes rather than as shadow.
    scene.add(new THREE.AmbientLight(0x0B1220, 0.35));
  }

  function update(dt, elapsed){
    // One uniform write per frame drives every star's twinkle.
    starMaterial.uniforms.uTime.value = elapsed;
    Planets.update(dt, elapsed, solarSystem);
  }

  return {
    scene: scene,
    init: init,
    update: update,

    // Free orbit. Default framing sits back far enough to show the whole
    // system on a narrow (portrait) phone screen: with a 50 deg vertical FOV,
    // a portrait aspect ratio gives a horizontal half-angle of roughly 15 deg,
    // so the camera needs distance * tan(15 deg) >= outermost orbit radius
    // (1480) + Neptune's visual radius (27) to keep Neptune's orbit fully
    // in frame horizontally — hence a distance well past that minimum.
    // Distance/pitch limits still allow zooming in to a single planet.
    cameraProfile: {
      fov: 50, near: 1, far: 40000,
      yaw: 0.6, pitch: 0.30, distance: 6200,
      limits: {
        minDistance: 60, maxDistance: 12000,
        minPitch: -1.45, maxPitch: 1.45,
        lockOrbit: false
      },
      damping: { model: 'time', distance: 6.5, orbit: 8.0, target: 6.0, friction: 0.90, inertia: true },
      sensitivity: { drag: 0.0045, referenceDistance: 900 }
    },

    inputHandlers: {
      dragStart: function(){ CameraRig.beginDrag(); },
      drag: function(dx, dy){ if (interactive) CameraRig.applyDrag(-dx, dy); },
      dragEnd: function(){ CameraRig.endDrag(); },
      pinchStart: function(){ pinchD0 = CameraRig.getDesiredDistance(); },
      pinch: function(ratio){ CameraRig.setDistance(pinchD0 * ratio); },
      tap: function(){ /* object picking arrives with the first celestial body */ }
    },

    commands: {}
  };
})();
`;
