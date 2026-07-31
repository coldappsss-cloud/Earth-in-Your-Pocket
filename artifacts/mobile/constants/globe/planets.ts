/**
 * Planets — celestial bodies for the Solar System, built inside Space Mode.
 *
 * View-only: no picking, no labels, no orbit motion. Positions are static
 * points on each planet's orbit; the orbit rings are drawn now so a future
 * "animate the orbit" feature has geometry to reuse without touching this
 * module's shape.
 *
 * Visual overhaul (v2): every body is fully procedural — there are no image
 * textures anywhere in this module, only GLSL noise. That keeps the whole
 * Solar System to a handful of small draw calls with zero texture uploads,
 * while giving each planet a distinct, non-"plastic" material:
 *
 * 1. One shared unit sphere (`UNIT_SPHERE`) is reused for the Sun's core, its
 *    glow/corona/halo shells, and all eight planets — only `mesh.scale`
 *    differs per body.
 *
 * 2. Every planet shares one vertex shader (`PLANET_VERT`) and one small
 *    value-noise/fbm GLSL snippet (`NOISE_GLSL`), so the marginal cost of a
 *    new planet "family" is a fragment shader, not a new pipeline.
 *
 * 3. Lighting is deliberately NOT delegated to Space Mode's scene lights.
 *    Each planet's fragment shader computes its own Lambert term against a
 *    per-body `uSunDir` (the Sun sits at the world origin; direction is
 *    precomputed once at build time from each body's static position — this
 *    must be recomputed per-frame once orbital motion is added later). A
 *    gentle inverse-falloff-inspired `uLight` scalar dims outer planets
 *    slightly without letting Neptune go unreadably dark ("physically
 *    inspired", not physically exact). This keeps every body visually
 *    consistent regardless of how the scene's PointLight is tuned, and it is
 *    the same technique the ring shader already used before this pass.
 *
 * 4. "Atmosphere" is a single Fresnel rim term folded into every planet's
 *    fragment shader (not a second mesh), driven by per-body `uAtmoColor` /
 *    `uAtmoStrength`. Only bodies that should visibly glow (Venus, Earth) get
 *    a strong value; airless Mercury gets zero. This avoids doubling the
 *    planet draw-call count just for a glow.
 *
 * 5. Axial tilt and spin are kept on separate objects: a `pivot` holds the
 *    constant tilt, and the mesh inside it advances `rotation.y` every frame.
 *    Saturn's ring hangs off the same pivot, tilted with the planet but never
 *    spinning with it — rings do not rotate with the planet's day/night cycle.
 */
export const PLANETS_JS = `
var Planets = (function(){
  var SUN_RADIUS = 130;

  // ── Shared GLSL: cheap 3-octave value noise, reused by every family ─────
  var NOISE_GLSL = [
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  float a = hash(i);',
    '  float b = hash(i + vec2(1.0,0.0));',
    '  float c = hash(i + vec2(0.0,1.0));',
    '  float d = hash(i + vec2(1.0,1.0));',
    '  vec2 u = f*f*(3.0-2.0*f);',
    '  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0; float amp = 0.5;',
    '  for(int i=0;i<3;i++){ v += amp*vnoise(p); p *= 2.03; amp *= 0.5; }',
    '  return v;',
    '}'
  ];

  // Shared vertex shader for every planet family: world normal for lighting,
  // sphere UV for surface detail, view direction for the Fresnel rim.
  var PLANET_VERT = [
    'varying vec2 vUv;',
    'varying vec3 vNormalW;',
    'varying vec3 vViewDir;',
    'void main(){',
    '  vUv = uv;',
    '  vNormalW = normalize(mat3(modelMatrix) * normal);',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vViewDir = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\\n');

  // Uniforms + varyings every planet fragment shader needs, regardless of
  // family. Concatenated in front of the family-specific body.
  var PLANET_HEADER = [
    'uniform vec3 uSunDir;',
    'uniform float uTime;',
    'uniform float uLight;',
    'uniform vec3 uAtmoColor;',
    'uniform float uAtmoStrength;',
    'varying vec2 vUv;',
    'varying vec3 vNormalW;',
    'varying vec3 vViewDir;'
  ];

  // Appended after every family's "lit" variable is computed: the shared
  // Fresnel atmosphere rim and final output.
  var PLANET_FOOTER = [
    '  float rim = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0), 3.0);',
    '  float sunFacing = max(dot(normalize(vNormalW), uSunDir), 0.12);',
    '  lit += uAtmoColor * rim * uAtmoStrength * sunFacing;',
    '  gl_FragColor = vec4(lit, 1.0);',
    '}'
  ];

  function toVec3(hex){
    return new THREE.Vector3(((hex>>16)&255)/255, ((hex>>8)&255)/255, (hex&255)/255);
  }

  // ── Family: rocky (Mercury, Mars) — crater noise, optional polar caps ──
  function rockyFrag(poles){
    var body = [
      'uniform vec3 uColor;',
      'void main(){',
      '  float terrain = fbm(vUv*16.0)*0.6 + fbm(vUv*55.0)*0.4;',
      '  vec3 base = uColor * (0.55 + 0.7*terrain);'
    ];
    if (poles) {
      body.push(
        '  float poleMask = smoothstep(0.40, 0.47, abs(vUv.y - 0.5));',
        '  base = mix(base, vec3(0.96,0.96,0.99), poleMask*0.82);'
      );
    }
    body.push(
      '  float diffuse = max(dot(normalize(vNormalW), uSunDir), 0.0);',
      '  vec3 lit = base * uLight * (0.05 + 0.95*diffuse);'
    );
    return [].concat(['precision mediump float;'], NOISE_GLSL, PLANET_HEADER, body, PLANET_FOOTER).join('\\n');
  }

  // ── Family: thick clouds (Venus) — warped, drifting cloud bands ────────
  function cloudsFrag(){
    var body = [
      'uniform vec3 uColorA;',
      'uniform vec3 uColorB;',
      'void main(){',
      '  vec2 uv = vUv*vec2(6.0,3.0) + vec2(uTime*0.02, 0.0);',
      '  float warp = fbm(uv*1.6 + uTime*0.01);',
      '  float swirl = fbm(uv + warp*0.9);',
      '  vec3 base = mix(uColorA, uColorB, swirl);',
      '  float diffuse = max(dot(normalize(vNormalW), uSunDir), 0.0);',
      '  vec3 lit = base * uLight * (0.18 + 0.82*diffuse);'
    ];
    return [].concat(['precision mediump float;'], NOISE_GLSL, PLANET_HEADER, body, PLANET_FOOTER).join('\\n');
  }

  // ── Family: Earth-like — ocean/continent mask, drifting clouds, night ──
  // side city lights. Approximate and procedural (no texture load) but the
  // same ingredients as a real day/night Earth shader.
  function earthFrag(){
    var body = [
      'void main(){',
      '  float landMask = smoothstep(0.45, 0.55, fbm(vUv*5.0 + vec2(3.1,1.7)));',
      '  vec3 ocean = vec3(0.035,0.16,0.42);',
      '  vec3 land  = vec3(0.14,0.32,0.13);',
      '  vec3 surface = mix(ocean, land, landMask);',
      '  float clouds = smoothstep(0.55, 0.78, fbm(vUv*8.0 + vec2(uTime*0.025, uTime*0.01)));',
      '  surface = mix(surface, vec3(0.92,0.94,0.97), clouds*0.6);',
      '  float diffuse = max(dot(normalize(vNormalW), uSunDir), 0.0);',
      '  float night = 1.0 - smoothstep(0.0, 0.16, diffuse);',
      '  float cityNoise = step(0.965, hash(floor(vUv*230.0))) * landMask;',
      '  vec3 cityLights = vec3(1.0,0.86,0.52) * cityNoise * night;',
      '  vec3 lit = surface * uLight * (0.05 + 0.95*diffuse) + cityLights;'
    ];
    return [].concat(['precision mediump float;'], NOISE_GLSL, PLANET_HEADER, body, PLANET_FOOTER).join('\\n');
  }

  // ── Family: gas giant (Jupiter, Saturn, Uranus, Neptune) — latitude bands
  // warped by fbm, an optional storm spot, and (Saturn only) a faint shadow
  // band cast by its own ring.
  function gasFrag(hasSpot, hasRingShadow){
    var body = [
      'uniform vec3 uColorA;',
      'uniform vec3 uColorB;',
      'uniform vec3 uColorC;'
    ];
    if (hasSpot) body.push('uniform vec3 uSpotColor;', 'uniform vec4 uSpot;'); // x=enable, yz=uv center, w=radius
    if (hasRingShadow) body.push('uniform float uRingShadow;');
    body.push(
      'void main(){',
      '  float bandT = vUv.y*11.0 + fbm(vec2(vUv.x*3.0 + uTime*0.012, vUv.y*10.0))*1.5;',
      '  float b = sin(bandT);',
      '  vec3 col = mix(uColorA, uColorB, smoothstep(-1.0, 1.0, b));',
      '  col = mix(col, uColorC, smoothstep(0.55, 1.0, abs(b)));'
    );
    if (hasSpot) {
      body.push(
        '  vec2 sd = (vUv - uSpot.yz) * vec2(2.3, 1.0);',
        '  float spot = (1.0 - smoothstep(uSpot.w*0.65, uSpot.w, length(sd))) * uSpot.x;',
        '  col = mix(col, uSpotColor, spot);'
      );
    }
    body.push(
      '  float diffuse = max(dot(normalize(vNormalW), uSunDir), 0.0);',
      '  vec3 lit = col * uLight * (0.10 + 0.90*diffuse);'
    );
    if (hasRingShadow) {
      body.push(
        '  float shadowBand = uRingShadow * (1.0 - smoothstep(0.0, 0.05, abs(vUv.y - 0.5)));',
        '  lit *= (1.0 - shadowBand*0.45);'
      );
    }
    return [].concat(['precision mediump float;'], NOISE_GLSL, PLANET_HEADER, body, PLANET_FOOTER).join('\\n');
  }

  // name, family, orbit/spin/tilt as before, plus per-family palette and
  // atmosphere tuning. Starting angles stay scattered on purpose.
  var DATA = [
    { name:'Mercury', family:'rocky',  color:0x9C9282, poles:false,
      atmoColor:0x000000, atmoStrength:0.0,
      radius:5,  orbitRadius:260,  rotSpeed:0.050,  tilt:0.001, startAngle:0.4 },
    { name:'Venus',   family:'clouds', colorA:0xE8C9A0, colorB:0xB9884E,
      atmoColor:0xFFDFA0, atmoStrength:1.15,
      radius:9,  orbitRadius:330,  rotSpeed:-0.035, tilt:0.05,  startAngle:2.1 },
    { name:'Earth',   family:'earth',
      atmoColor:0x4DA3FF, atmoStrength:1.35,
      radius:10, orbitRadius:410,  rotSpeed:0.220,  tilt:0.41,  startAngle:4.0 },
    { name:'Mars',    family:'rocky',  color:0xC1440E, poles:true,
      atmoColor:0xE8A374, atmoStrength:0.35,
      radius:6,  orbitRadius:480,  rotSpeed:0.210,  tilt:0.44,  startAngle:1.1 },
    { name:'Jupiter', family:'gas', colorA:0xD9B98C, colorB:0xB57A46, colorC:0xEDD9B0,
      spot:true, spotColor:0xB33F27, spotUV:[0.62,0.56], spotRadius:0.16,
      atmoColor:0xE8C9A0, atmoStrength:0.4,
      radius:55, orbitRadius:760,  rotSpeed:0.400,  tilt:0.05,  startAngle:5.2 },
    { name:'Saturn',  family:'gas', colorA:0xE9D8B0, colorB:0xC9A96A, colorC:0xF5EAC8,
      spot:false, ringShadow:true,
      atmoColor:0xF0DFB0, atmoStrength:0.35,
      radius:46, orbitRadius:1040, rotSpeed:0.360,  tilt:0.47,  startAngle:0.8, ring:true },
    { name:'Uranus',  family:'gas', colorA:0x9FE0E0, colorB:0x6FBEC0, colorC:0xC8F0F0,
      spot:false,
      atmoColor:0xB6EAEA, atmoStrength:0.5,
      radius:28, orbitRadius:1280, rotSpeed:-0.150, tilt:1.71,  startAngle:3.3 },
    { name:'Neptune', family:'gas', colorA:0x3D5FCC, colorB:0x28408F, colorC:0x6C8BE0,
      spot:true, spotColor:0x18234D, spotUV:[0.35,0.44], spotRadius:0.09,
      atmoColor:0x5C7FE0, atmoStrength:0.55,
      radius:27, orbitRadius:1480, rotSpeed:0.155,  tilt:0.49,  startAngle:5.8 }
  ];

  var UNIT_SPHERE = null;
  function ensureAssets(){
    if (!UNIT_SPHERE) UNIT_SPHERE = new THREE.SphereGeometry(1, 48, 24);
  }

  function buildOrbitLine(orbitRadius){
    var SEGMENTS = 96;
    var pos = [];
    for (var i = 0; i < SEGMENTS; i++) {
      var a0 = (i / SEGMENTS) * Math.PI * 2;
      var a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
      pos.push(
        Math.cos(a0) * orbitRadius, 0, Math.sin(a0) * orbitRadius,
        Math.cos(a1) * orbitRadius, 0, Math.sin(a1) * orbitRadius
      );
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pos), 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0x445266, transparent: true, opacity: 0.28
    }));
  }

  // ── Ring (Saturn) — analytic bands, lit by the true direction to the Sun ──
  var RING_VERT = [
    'varying vec3 vLocalPos;',
    'varying vec3 vNormalW;',
    'void main(){',
    '  vLocalPos = position;',
    '  vNormalW = normalize(mat3(modelMatrix) * normal);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\\n');

  var RING_FRAG = [
    'uniform vec3 uColor;',
    'uniform vec3 uColorDark;',
    'uniform vec3 uSunDir;',
    'uniform float uInner;',
    'uniform float uOuter;',
    'varying vec3 vLocalPos;',
    'varying vec3 vNormalW;',
    'void main(){',
    '  float r = length(vLocalPos.xy);',
    '  float t = (r - uInner) / max(0.0001, (uOuter - uInner));',
    '  float bands = 0.55 + 0.30 * sin(t * 24.0) + 0.15 * sin(t * 61.0 + 1.7);',
    '  float division = smoothstep(0.34, 0.36, t) * (1.0 - smoothstep(0.40, 0.42, t));',
    '  vec3 ringColor = mix(uColorDark, uColor, clamp(bands, 0.0, 1.0));',
    '  ringColor = mix(ringColor, uColorDark * 0.4, division * 0.8);',
    '  float edgeFade = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.94, 1.0, t));',
    // abs(), not max(): a ring's vertex normal is not flipped per back face,
    // so both faces of this thin disc should read as lit by the same
    // magnitude of sunlight rather than one face going fully dark whenever
    // the camera orbits under the ring plane.
    '  float diffuse = abs(dot(normalize(vNormalW), uSunDir));',
    '  float lightF = 0.30 + 0.70 * diffuse;',
    '  float alpha = clamp(bands, 0.0, 1.0) * edgeFade * 0.88;',
    '  gl_FragColor = vec4(ringColor * lightF, alpha);',
    '}'
  ].join('\\n');

  function buildRing(innerR, outerR, color, sunDir){
    var geo = new THREE.RingGeometry(innerR, outerR, 128, 1);
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: toVec3(color) },
        uColorDark: { value: toVec3(0x6B5A3D) },
        uSunDir: { value: sunDir },
        uInner: { value: innerR },
        uOuter: { value: outerR }
      },
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    return new THREE.Mesh(geo, mat);
  }

  // ── Planets ────────────────────────────────────────────────────────────
  function buildPlanetMaterial(d, sunDir, uLight){
    var frag;
    if (d.family === 'rocky') frag = rockyFrag(!!d.poles);
    else if (d.family === 'clouds') frag = cloudsFrag();
    else if (d.family === 'earth') frag = earthFrag();
    else frag = gasFrag(!!d.spot, !!d.ringShadow);

    var uniforms = {
      uSunDir: { value: sunDir },
      uTime: { value: 0 },
      uLight: { value: uLight },
      uAtmoColor: { value: toVec3(d.atmoColor || 0x000000) },
      uAtmoStrength: { value: d.atmoStrength || 0 }
    };
    if (d.family === 'rocky') uniforms.uColor = { value: toVec3(d.color) };
    if (d.family === 'clouds') { uniforms.uColorA = { value: toVec3(d.colorA) }; uniforms.uColorB = { value: toVec3(d.colorB) }; }
    if (d.family === 'gas') {
      uniforms.uColorA = { value: toVec3(d.colorA) };
      uniforms.uColorB = { value: toVec3(d.colorB) };
      uniforms.uColorC = { value: toVec3(d.colorC) };
      if (d.spot) {
        uniforms.uSpotColor = { value: toVec3(d.spotColor) };
        uniforms.uSpot = { value: new THREE.Vector4(1.0, d.spotUV[0], d.spotUV[1], d.spotRadius) };
      }
      if (d.ringShadow) uniforms.uRingShadow = { value: 1.0 };
    }

    return new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: PLANET_VERT,
      fragmentShader: frag
    });
  }

  function buildPlanet(d){
    // The Sun sits at the world origin and nothing orbits yet, so the
    // direction toward it from this static position is constant. Recompute
    // it per frame from the pivot's live position once orbits animate.
    var x = Math.cos(d.startAngle) * d.orbitRadius;
    var z = Math.sin(d.startAngle) * d.orbitRadius;
    var sunDir = new THREE.Vector3(-x, 0, -z).normalize();

    // Gentle, not physical, falloff: keeps Neptune legible instead of black.
    var uLight = 1.0 - 0.38 * Math.min(1.0, d.orbitRadius / 1480);

    var mat = buildPlanetMaterial(d, sunDir, uLight);
    var mesh = new THREE.Mesh(UNIT_SPHERE, mat);
    mesh.scale.setScalar(d.radius);

    // Tilt lives on the pivot, spin lives on the mesh, so a continuously
    // increasing spin angle never compounds with the (constant) tilt.
    var pivot = new THREE.Object3D();
    pivot.position.set(x, 0, z);
    pivot.rotation.z = d.tilt;
    pivot.add(mesh);

    var body = { name: d.name, mesh: mesh, pivot: pivot, rotSpeed: d.rotSpeed, material: mat };

    if (d.ring) {
      var ring = buildRing(d.radius * 1.35, d.radius * 2.4, 0xE3CFA0, sunDir);
      ring.rotation.x = Math.PI / 2;
      pivot.add(ring);
      body.ring = ring;
    }

    return body;
  }

  // ── Sun ────────────────────────────────────────────────────────────────
  var SUN_VERT = [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\\n');

  // Turbulent plasma + a handful of static flare bursts that pulse with time.
  var SUN_FRAG = [].concat(['precision mediump float;'], NOISE_GLSL, [
    'uniform float uTime;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec2 p = vUv * vec2(5.0, 3.0);',
    '  float n1 = fbm(p + vec2(uTime*0.10, -uTime*0.06));',
    '  float n2 = fbm(p*2.3 + vec2(-uTime*0.16, uTime*0.09));',
    '  float plasma = n1*0.65 + n2*0.35;',
    '  vec3 core = vec3(1.0, 0.95, 0.72);',
    '  vec3 mid  = vec3(1.0, 0.72, 0.28);',
    '  vec3 hot  = vec3(1.0, 0.42, 0.08);',
    '  vec3 col = mix(hot, mid, smoothstep(0.25, 0.6, plasma));',
    '  col = mix(col, core, smoothstep(0.6, 0.95, plasma));',
    // Static flare positions with time-based pulsing brightness — cheap
    // per-fragment distance checks rather than any extra geometry.
    '  vec2 flares[5];',
    '  flares[0]=vec2(0.15,0.42); flares[1]=vec2(0.62,0.30); flares[2]=vec2(0.83,0.58);',
    '  flares[3]=vec2(0.35,0.78); flares[4]=vec2(0.55,0.68);',
    '  float flareGlow = 0.0;',
    '  for(int i=0;i<5;i++){',
    '    float fi = float(i);',
    '    float pulse = 0.5 + 0.5*sin(uTime*0.8 + fi*2.1);',
    '    float d = distance(vUv, flares[i]);',
    '    flareGlow += (1.0 - smoothstep(0.0, 0.09, d)) * pulse * 0.6;',
    '  }',
    '  col += vec3(1.0,0.65,0.25) * flareGlow;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ]).join('\\n');

  // Fresnel glow shell, view-dependent (not tied to any fixed camera axis) so
  // it looks correct while the Space Mode camera freely orbits. The corona
  // additionally modulates its alpha with turbulence so it reads as wispy
  // and alive rather than a flat halo.
  var GLOW_VERT = [
    'varying vec3 vN;',
    'varying vec3 vViewDir;',
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  vN = normalize(normalMatrix * normal);',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vViewDir = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\\n');

  var GLOW_FRAG = [].concat(['precision mediump float;'], NOISE_GLSL, [
    'uniform vec3 uColor;',
    'uniform float uPower;',
    'uniform float uIntensity;',
    'uniform float uTurbulent;',
    'uniform float uTime;',
    'varying vec3 vN;',
    'varying vec3 vViewDir;',
    'varying vec2 vUv;',
    'void main(){',
    '  float facing = max(0.0, dot(normalize(vN), normalize(vViewDir)));',
    '  float f = pow(1.0 - facing, uPower);',
    '  float wisp = mix(1.0, 0.55 + 0.75*fbm(vUv*4.0 + uTime*0.05), uTurbulent);',
    '  gl_FragColor = vec4(uColor, f * uIntensity * wisp);',
    '}'
  ]).join('\\n');

  function buildGlowLayer(radius, color, power, intensity, turbulent){
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: toVec3(color) },
        uPower: { value: power },
        uIntensity: { value: intensity },
        uTurbulent: { value: turbulent ? 1.0 : 0.0 },
        uTime: { value: 0 }
      },
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    var mesh = new THREE.Mesh(UNIT_SPHERE, mat);
    mesh.scale.setScalar(radius);
    return mesh;
  }

  function buildSun(){
    var mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: SUN_VERT,
      fragmentShader: SUN_FRAG
    });
    var core = new THREE.Mesh(UNIT_SPHERE, mat);
    core.scale.setScalar(SUN_RADIUS);

    // Bloom is faked with three concentric additive shells (no post-process
    // pass exists in this pipeline): a tight hot glow, a turbulent corona,
    // and a very soft wide halo standing in for a bloom bleed.
    var glow   = buildGlowLayer(SUN_RADIUS * 1.30, 0xFFCB80, 1.5, 1.0, false);
    var corona = buildGlowLayer(SUN_RADIUS * 1.85, 0xFF9A3C, 2.2, 0.65, true);
    var halo   = buildGlowLayer(SUN_RADIUS * 2.8,  0xFF7A2E, 2.6, 0.30, false);

    return { core: core, glow: glow, corona: corona, halo: halo, material: mat };
  }

  // ── Public: build the whole system into a scene, update it per frame ───
  function build(scene){
    ensureAssets();

    var sun = buildSun();
    scene.add(sun.core);
    scene.add(sun.glow);
    scene.add(sun.corona);
    scene.add(sun.halo);

    var bodies = [];
    for (var i = 0; i < DATA.length; i++) {
      var body = buildPlanet(DATA[i]);
      scene.add(body.pivot);
      scene.add(buildOrbitLine(DATA[i].orbitRadius));
      bodies.push(body);
    }

    return { sun: sun, bodies: bodies };
  }

  function update(dt, elapsed, system){
    system.sun.material.uniforms.uTime.value = elapsed;
    system.sun.corona.material.uniforms.uTime.value = elapsed;
    // A slow, tiny breathing scale sells "volumetric" without another draw call.
    var pulse = 1.0 + Math.sin(elapsed * 0.5) * 0.015;
    system.sun.glow.scale.setScalar(SUN_RADIUS * 1.30 * pulse);
    for (var i = 0; i < system.bodies.length; i++) {
      var body = system.bodies[i];
      body.mesh.rotation.y += dt * body.rotSpeed;
      body.material.uniforms.uTime.value = elapsed;
    }
  }

  return { DATA: DATA, SUN_RADIUS: SUN_RADIUS, build: build, update: update };
})();
`;
