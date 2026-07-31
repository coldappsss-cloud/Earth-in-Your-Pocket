/**
 * Space Mode — the deep-space environment plus the Solar System.
 *
 * View-only: no picking, no fly-to, no labels, no panels. The Sun and eight
 * planets (built by the \`Planets\` module) sit inside the environment this
 * module owns — the layered starfield, the nebula/Milky Way backdrop, and
 * the lighting.
 *
 * Design decisions worth knowing before extending it:
 *
 * 1. Scale. One world unit is treated as roughly 1000 km, but the Solar System
 *    itself is laid out for legibility, not accuracy — see \`planets.ts\`. The
 *    camera near/far planes are set wide enough for planetary distances
 *    without z-fighting at close range, which is why the near plane is 1
 *    rather than 0.1.
 *
 * 2. Depth comes from two star layers, not one: a dense, small, distant shell
 *    and a sparser, larger, nearer shell. Both are a single THREE.Points draw
 *    call each — the GPU cost of "thousands of stars" is two draw calls, not
 *    thousands of objects. Colour temperature, size and twinkle phase are
 *    per-star attributes evaluated on the GPU; nothing about either layer
 *    touches the CPU after construction beyond one time uniform per layer.
 *
 * 3. Both star layers and the nebula backdrop sit on far shells and never
 *    move relative to the camera target, so they read as infinitely distant.
 *
 * 4. The nebula/Milky Way backdrop is one extra sphere (BackSide, depth-test
 *    off) whose fragment shader layers a few octaves of noise for dust and
 *    two soft colour blobs for nebula gradients — still a single draw call.
 *
 * 5. Lighting is a THREE.PointLight at the Sun's position (the world origin)
 *    plus a near-black ambient. In this version every celestial body (Sun,
 *    planets, ring) computes its own lighting in its own shader rather than
 *    reading these scene lights — see \`planets.ts\` for why — so these two
 *    lights are currently inert. They are kept in place, cheaply, in case a
 *    future addition (e.g. a moon using a standard material) needs them.
 *
 * 6. Anything numbering in the thousands — asteroids, satellites, debris —
 *    must use InstancedMesh or Points. Individual meshes will not scale.
 *
 * 7. All motion here is elapsed-time based, so behaviour is identical on 60Hz
 *    and 120Hz displays.
 */
export const SPACE_MODE_JS = `
var SpaceMode = (function(){
  var scene = new THREE.Scene();
  var starLayers = [];   // [{ material, ... }] — one entry per depth layer

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

  // Two depth layers: a dense shell of small distant stars, and a sparser
  // shell of larger, closer stars. Same shader and attribute layout for
  // both — only the generation parameters differ — so this is still just
  // two draw calls, not "twice the system".
  function buildStarLayer(pixelRatio, opts){
    var count = opts.count;
    var geo = new THREE.BufferGeometry();
    var pos     = new Float32Array(count * 3);
    var col     = new Float32Array(count * 3);
    var size    = new Float32Array(count);
    var phase   = new Float32Array(count);
    var rate    = new Float32Array(count);

    for (var i = 0; i < count; i++) {
      // Uniform on a sphere: acos of a uniform cosine avoids polar clustering.
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(Math.random() * 2 - 1);
      var r  = opts.innerR + Math.random() * (opts.outerR - opts.innerR);
      pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = r * Math.cos(ph);
      pos[i*3+2] = r * Math.sin(ph) * Math.sin(th);

      var c = pickStarColor(Math.random());
      col[i*3] = c[0]; col[i*3+1] = c[1]; col[i*3+2] = c[2];

      // Magnitude distribution: a cubic bias gives many faint stars and a
      // small number of bright ones, which is what makes a sky look real.
      //
      // Sizes are calibrated against the shell radius and the 300/z falloff in
      // the vertex shader. Fill rate is the limit on mobile: a few thousand
      // large additive points will halve the frame rate, so keep the upper
      // bound small if either layer's count grows.
      var m = Math.random();
      size[i] = opts.sizeMin + Math.pow(m, 3.0) * opts.sizeRange;

      phase[i] = Math.random() * Math.PI * 2;
      rate[i]  = 0.25 + Math.random() * 0.9;
    }

    geo.setAttribute('position',     new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor',       new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize',        new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase',       new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aTwinkleRate', new THREE.BufferAttribute(rate, 1));
    // The shell radius is known, so skip the per-frame bounding sphere work.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,0,0), opts.outerR);

    var material = new THREE.ShaderMaterial({
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

    var points = new THREE.Points(geo, material);
    points.frustumCulled = false;   // always fully on screen; culling is wasted work
    points.renderOrder = -1;
    return { points: points, material: material };
  }

  function buildStarfield(pixelRatio){
    // Far layer: many small, dense stars for the "enormous" backdrop.
    var far = buildStarLayer(pixelRatio, {
      count: 7000, innerR: STAR_INNER_RADIUS, outerR: STAR_OUTER_RADIUS,
      sizeMin: 35, sizeRange: 105
    });
    // Near layer: fewer, larger, brighter stars, closer in — the parallax
    // and size contrast between the two layers is what reads as depth.
    var near = buildStarLayer(pixelRatio, {
      count: 1400, innerR: STAR_INNER_RADIUS * 0.55, outerR: STAR_INNER_RADIUS * 0.85,
      sizeMin: 70, sizeRange: 190
    });
    starLayers.push(far.material, near.material);
    var group = new THREE.Object3D();
    group.add(far.points);
    group.add(near.points);
    return group;
  }

  // Nebula + Milky Way backdrop: a soft dust band plus two large, gentle
  // colour blobs. All noise-driven, all on one BackSide sphere — one draw
  // call for the entire "enormous, not empty" backdrop.
  var NEBULA_NOISE = [
    'float nhash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }',
    'float nvnoise(vec2 p){',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  float a = nhash(i); float b = nhash(i + vec2(1.0,0.0));',
    '  float c = nhash(i + vec2(0.0,1.0)); float d = nhash(i + vec2(1.0,1.0));',
    '  vec2 u = f*f*(3.0-2.0*f);',
    '  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;',
    '}',
    'float nfbm(vec2 p){',
    '  float v=0.0; float amp=0.5;',
    '  for(int i=0;i<4;i++){ v += amp*nvnoise(p); p *= 2.05; amp *= 0.5; }',
    '  return v;',
    '}'
  ];

  function buildBackdrop(){
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uAxis: { value: new THREE.Vector3(0.35, 0.90, 0.26).normalize() },
        uNebulaA: { value: new THREE.Vector2(2.3, 1.1) },
        uNebulaB: { value: new THREE.Vector2(-1.6, 2.4) }
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){',
        '  vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\\n'),
      fragmentShader: [].concat(['precision mediump float;'], NEBULA_NOISE, [
        'uniform vec3 uAxis;',
        'uniform vec2 uNebulaA;',
        'uniform vec2 uNebulaB;',
        'varying vec3 vDir;',
        'void main(){',
        '  vec3 dir = normalize(vDir);',
        // Faint Milky Way-style dust band along a fixed galactic axis.
        '  float band = pow(1.0 - abs(dot(dir, uAxis)), 20.0);',
        '  float dust = nfbm(dir.xy*3.0 + dir.z*2.0) * band;',
        '  vec3 deep = vec3(0.004, 0.007, 0.018);',
        '  vec3 dustGlow = vec3(0.05, 0.055, 0.09);',
        '  vec3 col = mix(deep, dustGlow, band*0.7 + dust*0.5);',
        // Two very soft, large colour blobs standing in for distant nebulae —
        // subtle by design; this is atmosphere, not a poster.
        '  float nebA = nfbm(dir.xy*1.4 + uNebulaA);',
        '  float maskA = smoothstep(0.55, 0.95, nebA) * (1.0 - smoothstep(-0.2, 0.6, dot(dir, vec3(0.2,0.4,0.89))));',
        '  col += vec3(0.05, 0.02, 0.07) * maskA;',
        '  float nebB = nfbm(dir.yz*1.1 + uNebulaB);',
        '  float maskB = smoothstep(0.6, 0.95, nebB) * (1.0 - smoothstep(-0.3, 0.5, dot(dir, vec3(-0.6,-0.1,0.79))));',
        '  col += vec3(0.015, 0.035, 0.06) * maskB;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ]).join('\\n'),
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
    var sun = new THREE.PointLight(0xFFF4E2, 3.8, 0, 1);
    sun.position.set(0, 0, 0);
    scene.add(sun);

    // Near-black, faintly cool fill: space has almost no bounce light, but a
    // pure zero ambient makes unlit hemispheres read as holes rather than as
    // shadow. Kept low so lit/unlit contrast on each planet stays cinematic
    // rather than flat.
    scene.add(new THREE.AmbientLight(0x0B1220, 0.22));
  }

  function update(dt, elapsed){
    // One uniform write per layer per frame drives every star's twinkle.
    for (var i = 0; i < starLayers.length; i++) {
      starLayers[i].uniforms.uTime.value = elapsed;
    }
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
    // Pitch is steeper than a flat top-down view so the orbit plane reads as
    // a plane (depth perception) rather than a flat ring of dots, and yaw is
    // chosen so the Sun's lit hemisphere and a few planets' lit crescents
    // face the camera on load instead of showing their dark sides.
    // Distance/pitch limits still allow zooming in to a single planet.
    cameraProfile: {
      fov: 50, near: 1, far: 40000,
      yaw: 0.5, pitch: 0.38, distance: 6000,
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
