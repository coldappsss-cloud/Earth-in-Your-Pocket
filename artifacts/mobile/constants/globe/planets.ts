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
 *
 * Readability pass (v3): sizes and shading were retuned for legibility on a
 * phone screen, and natural satellites plus a reworked Sun were added.
 *
 * 6. Inner-planet radii were increased well past their v2 values so Mercury,
 *    Venus, Earth and Mars are easy to pick out at a glance, while keeping
 *    Jupiter first and Saturn second in visual size (see DATA below) — this
 *    is a legibility pass, not an accuracy one.
 *
 * 7. Moons reuse the exact same building blocks as planets: the same unit
 *    sphere, the same per-family fragment shaders (rocky for most moons,
 *    clouds for hazy Titan), and the same buildPlanetMaterial/PLANET_HEADER
 *    pipeline, just at a smaller scale. A moon never gets a shader family of
 *    its own. Each moon's sun-direction and light-falloff uniforms are the
 *    same Vector3/number the parent planet already computed, so a moon
 *    orbiting a planet is lit consistently with it for free.
 *
 * 8. A moon's orbit is plain Object3D nesting, not per-frame trigonometry: an
 *    orbit pivot (child of the planet's tilt pivot, so it shares the tilt but
 *    never the planet's day/night spin) has its rotation.y advanced every
 *    frame, and the moon mesh just sits at a fixed local offset inside it.
 *    Orbit speeds are greatly accelerated versus real orbital periods so
 *    motion reads as alive within a few seconds of watching, per design.
 *
 * Final polish pass (v4): the Sun was rebuilt, and body sizes were retuned
 * once more after the v3 sizes still read as small on a phone.
 *
 * 9. The Sun no longer samples noise in UV space. UV noise pinches to nothing
 *    at the poles, swims as the camera orbits, and fundamentally looks like a
 *    texture wrapped on a ball — the "flat glowing sphere" problem. The Sun
 *    now has its own 3D value noise (SUN_NOISE_GLSL: fbm3 plus a ridged
 *    variant) and samples a volume field along the surface direction, so
 *    plasma cells hold their shape right out to the limb. On top of that sit
 *    domain warping (features shear and curl instead of pulsing in place),
 *    three stacked scales of convection, drifting sunspots with penumbrae,
 *    and physically-motivated limb darkening.
 *
 * 10. Prominences are a separate thin shell just above the photosphere whose
 *     opacity survives only near its own silhouette. Because that shell is
 *     slightly larger than the Sun, the surviving band lands just outside the
 *     Sun's edge — where prominences are actually seen. Ridged noise breaks it
 *     into individual tongues, which is what keeps it from reading as the
 *     radial "sunburst" the previous version produced.
 *
 * 11. Sizing is a RATIO problem, not an absolute one: scaling bodies and
 *     orbits by the same factor changes nothing once the camera pulls back to
 *     frame the system. So radii grew ~1.7-2x while the orbital envelope grew
 *     only ~1.5x, and moons were pulled in tight against their planets. That
 *     is also why the v3 moons were invisible rather than broken — at radius
 *     0.8-6 units seen from ~6000 away they were under a pixel across.
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

  // ── Family: rocky (Mercury, Mars, and every rocky/icy moon) — crater
  // noise, optional polar caps, and a small metallic specular term so
  // Mercury (high uMetallic) reads as bare, sun-scoured metal-and-stone
  // rather than flat matte rock, while Mars and most moons (near-zero
  // uMetallic) stay dull. Craters get a second, sharper noise pass that
  // darkens rims for actual pockmarking instead of soft blotches.
  function rockyFrag(poles){
    var body = [
      'uniform vec3 uColor;',
      'uniform float uMetallic;',
      'void main(){',
      '  float terrain = fbm(vUv*16.0)*0.6 + fbm(vUv*55.0)*0.4;',
      // Sampled once and reused for both crater edges below. The previous
      // version evaluated this same fbm twice in one expression.
      '  float cr = fbm(vUv*34.0 + 5.2);',
      '  float craterEdge = smoothstep(0.42, 0.50, cr) * (1.0 - smoothstep(0.50, 0.58, cr));',
      // Broad, low-frequency albedo patches: the large dark plains (maria,
      // basalt floors, dust seas) that make a rocky body recognisable from
      // far away, where the fine crater detail is too small to resolve.
      '  float maria = smoothstep(0.42, 0.62, fbm(vUv*3.4 + vec2(1.9,7.3)));',
      '  vec3 base = uColor * (0.55 + 0.7*terrain);',
      '  base = mix(base, base * vec3(0.62,0.60,0.63), maria*0.55);',
      '  base *= (1.0 - craterEdge*0.42);',
      // Bright ejecta rays streaking out of the youngest craters — a small
      // touch that reads as real impact history rather than uniform noise.
      '  float ejecta = smoothstep(0.70, 0.86, fbm(vUv*7.0 + vec2(4.4,0.8)));',
      '  base += uColor * ejecta * 0.35;'
    ];
    if (poles) {
      body.push(
        '  float poleMask = smoothstep(0.40, 0.47, abs(vUv.y - 0.5));',
        '  base = mix(base, vec3(0.96,0.96,0.99), poleMask*0.82);'
      );
    }
    body.push(
      '  vec3 n = normalize(vNormalW);',
      '  float diffuse = max(dot(n, uSunDir), 0.0);',
      // Blinn-Phong-ish specular, gated by uMetallic so airless rocky moons
      // stay dull while Mercury picks up small, sharp sunlit highlights —
      // "metallic highlights", not a shiny plastic sphere.
      '  vec3 halfV = normalize(uSunDir + normalize(vViewDir));',
      '  float spec = pow(max(dot(n, halfV), 0.0), 22.0) * uMetallic * diffuse;',
      '  vec3 lit = base * uLight * (0.05 + 0.95*diffuse) + vec3(1.0,0.98,0.92) * spec * 1.4;'
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
      // A second cloud deck drifting at a different speed and scale. Two
      // decks shearing past each other is what gives a thick atmosphere its
      // sense of depth instead of one flat swirling layer.
      '  float highDeck = fbm(uv*2.7 + vec2(uTime*0.045, warp*0.6));',
      '  float density = clamp(swirl*0.68 + highDeck*0.42, 0.0, 1.0);',
      '  vec3 base = mix(uColorA, uColorB, density);',
      // Brighter, hazier caps: circulation piles cloud up over the poles on
      // slow-rotating bodies like Venus and Titan.
      '  float capHaze = smoothstep(0.34, 0.50, abs(vUv.y - 0.5));',
      '  base = mix(base, mix(uColorA, vec3(1.0), 0.35), capHaze*0.45);',
      // Extra contrast between bands so the swirls actually read on a small
      // screen rather than blurring into an even wash of colour.
      '  base *= 0.82 + 0.36*smoothstep(0.30, 0.72, density);',
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
      // Sampled once; the continent field drives both the coastline mask and
      // the shelf/deep-ocean gradient below.
      '  float continents = fbm(vUv*5.0 + vec2(3.1,1.7));',
      '  float landMask = smoothstep(0.46, 0.54, continents);',
      // A second, higher-frequency noise field picks between two land tones
      // (green lowland vs. sunbaked brown highland) instead of one flat
      // green, and a sharper coastline threshold keeps the ocean/land edge
      // crisp rather than smeared.
      '  float terrainT = fbm(vUv*13.0 + vec2(9.4,2.2));',
      '  vec3 ocean = vec3(0.03,0.15,0.44);',
      '  vec3 oceanDeep = vec3(0.015,0.075,0.26);',
      '  vec3 lowland = vec3(0.10,0.34,0.12);',
      '  vec3 highland = vec3(0.36,0.28,0.14);',
      '  vec3 land = mix(lowland, highland, smoothstep(0.4, 0.75, terrainT));',
      // Arid belts: desert tones banded around the tropics, the single most
      // recognisable feature of Earth from orbit after the oceans.
      // Written as 1.0 - smoothstep so the edges stay in ascending order.
      // A reversed-edge smoothstep(hi, lo, x) is undefined in GLSL and has
      // silently broken shaders in this file before.
      '  float aridBelt = 1.0 - smoothstep(0.02, 0.10, abs(abs(vUv.y - 0.5) - 0.16));',
      '  land = mix(land, vec3(0.56,0.44,0.22), aridBelt*0.55);',
      // Ice caps, widening smoothly toward the poles.
      '  float ice = smoothstep(0.40, 0.48, abs(vUv.y - 0.5));',
      '  vec3 surface = mix(mix(oceanDeep, ocean, smoothstep(0.30,0.46,continents)), land, landMask);',
      '  surface = mix(surface, vec3(0.93,0.95,0.98), ice*0.85);',
      '  float diffuse = max(dot(normalize(vNormalW), uSunDir), 0.0);',
      // Sun glint off water only: a tight specular lobe masked to the ocean,
      // which is what makes the seas read as liquid rather than blue paint.
      '  vec3 nrm = normalize(vNormalW);',
      '  vec3 halfV = normalize(uSunDir + normalize(vViewDir));',
      '  float glint = pow(max(dot(nrm, halfV), 0.0), 60.0) * (1.0 - landMask) * diffuse;',
      // Two cloud layers drifting at different speeds, the upper one thinner.
      '  float clouds = smoothstep(0.52, 0.76, fbm(vUv*8.0 + vec2(uTime*0.025, uTime*0.01)));',
      '  float cirrus = smoothstep(0.58, 0.82, fbm(vUv*15.0 + vec2(uTime*0.040, -uTime*0.012)));',
      '  surface = mix(surface, vec3(0.96,0.97,0.99), clouds*0.72);',
      '  surface = mix(surface, vec3(0.98,0.99,1.00), cirrus*0.30);',
      '  float night = 1.0 - smoothstep(0.0, 0.16, diffuse);',
      // Cities thin out where cloud cover is heavy, so the night side does
      // not glow straight through an overcast.
      '  float cityNoise = step(0.965, hash(floor(vUv*230.0))) * landMask * (1.0 - clouds*0.8);',
      '  vec3 cityLights = vec3(1.0,0.86,0.52) * cityNoise * night;',
      // Warm scattering band along the terminator — sunset seen from orbit.
      '  float terminator = smoothstep(0.0, 0.22, diffuse) * (1.0 - smoothstep(0.16, 0.42, diffuse));',
      '  vec3 lit = surface * uLight * (0.05 + 0.95*diffuse) + cityLights;',
      '  lit += vec3(1.00,0.55,0.25) * terminator * 0.16;',
      '  lit += vec3(1.0,0.97,0.90) * glint * 0.55;'
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
      // Bands are latitude stripes warped by noise. Two warp fields at
      // different scales, rather than one, keep neighbouring bands from
      // wobbling in lockstep — real belts and zones shear against each other.
      '  float warpBroad = fbm(vec2(vUv.x*3.0 + uTime*0.012, vUv.y*10.0));',
      '  float warpFine  = fbm(vec2(vUv.x*7.0 - uTime*0.020, vUv.y*22.0));',
      '  float bandT = vUv.y*11.0 + warpBroad*1.5 + warpFine*0.55;',
      '  float b = sin(bandT);',
      '  vec3 col = mix(uColorA, uColorB, smoothstep(-1.0, 1.0, b));',
      '  col = mix(col, uColorC, smoothstep(0.55, 1.0, abs(b)));',
      // Turbulent eddies riding along the boundaries between bands, where
      // the wind shear on a real gas giant actually spins up storms.
      '  float shear = 1.0 - smoothstep(0.0, 0.35, abs(b));',
      '  float eddies = fbm(vec2(vUv.x*18.0 + uTime*0.05, vUv.y*26.0));',
      '  col = mix(col, col * (0.74 + 0.52*eddies), shear*0.60);',
      // Slight pole darkening: the bands compress and dim toward the caps.
      '  col *= 1.0 - smoothstep(0.30, 0.50, abs(vUv.y - 0.5)) * 0.30;'
    );
    if (hasSpot) {
      body.push(
        // The spot's own edge is warped by a touch of fbm noise (instead of
        // a perfect ellipse) so it reads as a swirling storm boundary, and
        // the swirl noise sampled at the spot centre gives it its own
        // internal turbulence rather than a flat fill.
        '  vec2 sd = (vUv - uSpot.yz) * vec2(2.3, 1.0);',
        '  float edgeWarp = fbm(vUv*9.0 + uTime*0.015) * 0.09;',
        '  float spot = (1.0 - smoothstep(uSpot.w*0.62 + edgeWarp, uSpot.w + edgeWarp, length(sd))) * uSpot.x;',
        '  float spotSwirl = fbm(sd*7.0 + uTime*0.05);',
        '  col = mix(col, mix(uSpotColor, uSpotColor*1.25, spotSwirl), spot);'
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
  //
  // Scale note: this is an educational visualizer, not a scale model. Bodies
  // are sized for legibility on a phone screen. The one rule kept from
  // reality is the ORDER of sizes (Jupiter largest, then Saturn, and so on
  // down to Mercury) so the comparison a viewer draws is still a true one.
  //
  // The reason previous passes still felt tiny is a ratio, not an absolute:
  // enlarging bodies AND their orbits by the same factor changes nothing
  // once the camera pulls back far enough to frame the system. So radii grow
  // by roughly 1.7-2.0x here while the orbital envelope grows only ~1.5x,
  // and moons are pulled in tight against their planets (a few planet radii,
  // nowhere near true distance) so satellite systems stop eating the radial
  // budget that the planets themselves need.
  var OUTER_ORBIT = 2220;   // Neptune's orbit; the light-falloff reference
  var DATA = [
    { name:'Mercury', family:'rocky',  color:0x9C9282, poles:false, metallic:0.55,
      atmoColor:0x000000, atmoStrength:0.0,
      radius:26, orbitRadius:350,  rotSpeed:0.050,  tilt:0.001, startAngle:0.4 },
    { name:'Venus',   family:'clouds', colorA:0xE8C9A0, colorB:0xB9884E,
      atmoColor:0xFFDFA0, atmoStrength:1.15,
      radius:37, orbitRadius:470,  rotSpeed:-0.035, tilt:0.05,  startAngle:2.1 },
    { name:'Earth',   family:'earth',
      atmoColor:0x4DA3FF, atmoStrength:1.35,
      radius:40, orbitRadius:620,  rotSpeed:0.220,  tilt:0.41,  startAngle:4.0,
      moons:[
        { name:'Moon', family:'rocky', color:0xB8B4AC, poles:false, metallic:0.05,
          radius:7.0, orbit:62, speed:0.90, spin:0.90 }
      ] },
    { name:'Mars',    family:'rocky',  color:0xC1440E, poles:true, metallic:0.05,
      atmoColor:0xE8A374, atmoStrength:0.35,
      radius:28, orbitRadius:780,  rotSpeed:0.210,  tilt:0.44,  startAngle:1.1,
      moons:[
        { name:'Phobos', family:'rocky', color:0x8A7A6A, poles:false, metallic:0.02,
          radius:3.5, orbit:42, speed:1.60, spin:1.60 },
        { name:'Deimos', family:'rocky', color:0x9A8A78, poles:false, metallic:0.02,
          radius:3.0, orbit:52, speed:1.10, spin:1.10 }
      ] },
    { name:'Jupiter', family:'gas', colorA:0xD9B98C, colorB:0xB57A46, colorC:0xEDD9B0,
      spot:true, spotColor:0xB33F27, spotUV:[0.62,0.56], spotRadius:0.20,
      atmoColor:0xE8C9A0, atmoStrength:0.4,
      radius:92, orbitRadius:1060, rotSpeed:0.400,  tilt:0.05,  startAngle:5.2,
      moons:[
        { name:'Io',       family:'rocky', color:0xE8D26A, poles:false, metallic:0.10,
          radius:11.0, orbit:118, speed:0.55, spin:0.55 },
        { name:'Europa',   family:'rocky', color:0xE6EDF2, poles:false, metallic:0.20,
          radius:10.0, orbit:138, speed:0.42, spin:0.42 },
        { name:'Ganymede', family:'rocky', color:0xA79582, poles:false, metallic:0.06,
          radius:13.0, orbit:160, speed:0.32, spin:0.32 },
        { name:'Callisto', family:'rocky', color:0x7C7368, poles:false, metallic:0.04,
          radius:12.0, orbit:182, speed:0.24, spin:0.24 }
      ] },
    // Saturn's ring runs out to radius*2.2 (171.6). Every moon orbit below
    // starts past that, so none of them ever pass through the rings.
    { name:'Saturn',  family:'gas', colorA:0xE9D8B0, colorB:0xC9A96A, colorC:0xF5EAC8,
      spot:false, ringShadow:true,
      atmoColor:0xF0DFB0, atmoStrength:0.35,
      radius:78, orbitRadius:1560, rotSpeed:0.360,  tilt:0.47,  startAngle:0.8, ring:true,
      moons:[
        { name:'Enceladus', family:'rocky', color:0xF2F5F7, poles:false, metallic:0.25,
          radius:6.0, orbit:186, speed:0.55, spin:0.55 },
        { name:'Dione',     family:'rocky', color:0xD3C9B8, poles:false, metallic:0.10,
          radius:7.0, orbit:205, speed:0.40, spin:0.40 },
        { name:'Rhea',      family:'rocky', color:0xC9C4BC, poles:false, metallic:0.10,
          radius:8.0, orbit:224, speed:0.32, spin:0.32 },
        { name:'Titan',     family:'clouds', colorA:0xE8B978, colorB:0xC1863F,
          radius:12.0, orbit:248, speed:0.22, spin:0.22 }
      ] },
    { name:'Uranus',  family:'gas', colorA:0x9FE0E0, colorB:0x6FBEC0, colorC:0xC8F0F0,
      spot:false,
      atmoColor:0xB6EAEA, atmoStrength:0.5,
      radius:52, orbitRadius:1960, rotSpeed:-0.150, tilt:1.71,  startAngle:3.3,
      moons:[
        { name:'Titania', family:'rocky', color:0xA79A8C, poles:false, metallic:0.06,
          radius:8.0, orbit:92,  speed:0.35, spin:0.35 },
        { name:'Oberon',  family:'rocky', color:0x8F8478, poles:false, metallic:0.06,
          radius:7.5, orbit:110, speed:0.28, spin:0.28 }
      ] },
    { name:'Neptune', family:'gas', colorA:0x3D5FCC, colorB:0x28408F, colorC:0x6C8BE0,
      spot:true, spotColor:0x18234D, spotUV:[0.35,0.44], spotRadius:0.09,
      atmoColor:0x5C7FE0, atmoStrength:0.55,
      radius:50, orbitRadius:2220, rotSpeed:0.155,  tilt:0.49,  startAngle:5.8,
      // Triton is a real retrograde moon (orbits opposite its planet's
      // rotation) — a negative speed reuses the exact same orbit-pivot
      // rotation.y advance, just the other way, for a nice authentic touch.
      moons:[
        { name:'Triton', family:'rocky', color:0xD8C7C2, poles:false, metallic:0.12,
          radius:9.5, orbit:98, speed:-0.40, spin:-0.40 }
      ] }
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
    if (d.family === 'rocky') {
      uniforms.uColor = { value: toVec3(d.color) };
      uniforms.uMetallic = { value: d.metallic || 0 };
    }
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
    var uLight = 1.0 - 0.38 * Math.min(1.0, d.orbitRadius / OUTER_ORBIT);

    var mat = buildPlanetMaterial(d, sunDir, uLight);
    var mesh = new THREE.Mesh(UNIT_SPHERE, mat);
    mesh.scale.setScalar(d.radius);

    // Tilt lives on the pivot, spin lives on the mesh, so a continuously
    // increasing spin angle never compounds with the (constant) tilt.
    var pivot = new THREE.Object3D();
    pivot.position.set(x, 0, z);
    pivot.rotation.z = d.tilt;
    pivot.add(mesh);

    var body = { name: d.name, mesh: mesh, pivot: pivot, rotSpeed: d.rotSpeed, material: mat, moons: [] };

    if (d.ring) {
      var ring = buildRing(d.radius * 1.28, d.radius * 2.2, 0xE3CFA0, sunDir);
      ring.rotation.x = Math.PI / 2;
      pivot.add(ring);
      body.ring = ring;
    }

    if (d.moons && d.moons.length) {
      // A moon group sits directly on the tilt pivot (a sibling of the
      // planet mesh) so moons share the planet's axial tilt but never its
      // day/night spin. Each moon then gets its own orbit pivot inside that
      // group: rotating that pivot's Y axis every frame is the entire orbit
      // — no per-frame trig, no extra allocation, just an Object3D nested
      // one level deeper than the planet's own tilt/spin split.
      var moonGroup = new THREE.Object3D();
      pivot.add(moonGroup);
      for (var mi = 0; mi < d.moons.length; mi++) {
        var md = d.moons[mi];
        // Reuses the sun direction and light falloff already computed for
        // the parent planet: a moon's distance from its planet is tiny next
        // to its distance from the Sun, so the same direction/falloff reads
        // as correct without a second computation.
        var moonMat = buildPlanetMaterial(md, sunDir, uLight);
        var moonMesh = new THREE.Mesh(UNIT_SPHERE, moonMat);
        moonMesh.scale.setScalar(md.radius);
        moonMesh.position.set(md.orbit, 0, 0);

        var orbitPivot = new THREE.Object3D();
        // Scatter each moon's starting angle so a freshly built system never
        // shows every moon lined up on the same side of its planet.
        orbitPivot.rotation.y = (mi * 2.399) % (Math.PI * 2);
        orbitPivot.add(moonMesh);
        moonGroup.add(orbitPivot);

        body.moons.push({
          name: md.name, orbitPivot: orbitPivot, mesh: moonMesh,
          material: moonMat, speed: md.speed, spin: (md.spin !== undefined ? md.spin : md.speed)
        });
      }
    }

    return body;
  }

  // ── Sun ────────────────────────────────────────────────────────────────
  // 3D value noise, used ONLY by the Sun (planets keep the cheaper 2D one).
  // The previous Sun sampled noise in UV space, which is the root cause of
  // the "flat glowing sphere with animated rays" look: UV noise pinches to
  // nothing at the poles, swims when the camera orbits, and reads as a flat
  // texture wrapped around a ball. Sampling in 3D direction space instead
  // makes the plasma a genuine volume field that the sphere's surface cuts
  // through — no seam, no pole pinch, and cells keep their shape all the way
  // to the limb, which is most of what sells the Sun as a massive body.
  var SUN_NOISE_GLSL = [
    'float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453123); }',
    'float vnoise3(vec3 p){',
    '  vec3 i = floor(p); vec3 f = fract(p);',
    '  vec3 u = f*f*(3.0-2.0*f);',
    '  float n000 = hash3(i);',
    '  float n100 = hash3(i + vec3(1.0,0.0,0.0));',
    '  float n010 = hash3(i + vec3(0.0,1.0,0.0));',
    '  float n110 = hash3(i + vec3(1.0,1.0,0.0));',
    '  float n001 = hash3(i + vec3(0.0,0.0,1.0));',
    '  float n101 = hash3(i + vec3(1.0,0.0,1.0));',
    '  float n011 = hash3(i + vec3(0.0,1.0,1.0));',
    '  float n111 = hash3(i + vec3(1.0,1.0,1.0));',
    '  float x00 = mix(n000,n100,u.x);',
    '  float x10 = mix(n010,n110,u.x);',
    '  float x01 = mix(n001,n101,u.x);',
    '  float x11 = mix(n011,n111,u.x);',
    '  return mix(mix(x00,x10,u.y), mix(x01,x11,u.y), u.z);',
    '}',
    'float fbm3(vec3 p){',
    '  float v = 0.0; float amp = 0.5;',
    '  for(int i=0;i<4;i++){ v += amp*vnoise3(p); p *= 2.07; amp *= 0.5; }',
    '  return v;',
    '}',
    // Ridged noise folds each octave around its midpoint, so instead of soft
    // blobs it produces thin, sharp filaments. That is exactly the shape of
    // the dark intergranular lanes that separate real convection cells, and
    // of the wispy strands inside a prominence.
    'float ridged3(vec3 p){',
    '  float v = 0.0; float amp = 0.5;',
    '  for(int i=0;i<3;i++){ v += amp*(1.0 - abs(vnoise3(p)*2.0 - 1.0)); p *= 2.13; amp *= 0.5; }',
    '  return v;',
    '}'
  ];

  // Passes the local (object-space) direction so the fragment shader can
  // sample the 3D plasma field, plus the normal/view pair for limb work.
  var SUN_VERT = [
    'varying vec3 vDir;',
    'varying vec3 vN;',
    'varying vec3 vViewDir;',
    'void main(){',
    '  vDir = normalize(position);',
    '  vN = normalize(normalMatrix * normal);',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vViewDir = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\\n');

  // The photosphere. Built from three stacked scales of motion —
  // supergranulation (huge slow cells), granulation (small fast cells with
  // dark lanes), and a fine shimmer — all pushed through a domain warp so
  // the plasma churns and stretches rather than just fading in and out.
  // Sunspots, limb darkening and a centre-bright falloff do the rest.
  var SUN_FRAG = [].concat(['precision mediump float;'], SUN_NOISE_GLSL, [
    'uniform float uTime;',
    'varying vec3 vDir;',
    'varying vec3 vN;',
    'varying vec3 vViewDir;',
    'void main(){',
    '  vec3 d = normalize(vDir);',
    '  float t = uTime * 0.06;',
    // Domain warping — sampling noise at a point that has itself been pushed
    // around by noise. This one step is what turns "simple noise animation"
    // into something that looks like it is boiling: features shear and curl
    // into each other instead of pulsing in place.
    '  vec3 warp = vec3(',
    '    fbm3(d*2.3 + vec3(0.0, t, 0.0)),',
    '    fbm3(d*2.3 + vec3(5.2, t*1.3, 1.3)),',
    '    fbm3(d*2.3 + vec3(9.1, t*0.8, 4.7)));',
    '  vec3 wd = d*4.0 + (warp - 0.5) * 1.7;',
    '  float superCell = fbm3(wd + vec3(0.0, t*0.6, 0.0));',
    '  float gran = ridged3(d*17.0 + (warp - 0.5)*2.2 + vec3(0.0, t*2.4, 0.0));',
    '  float fine = fbm3(d*38.0 + vec3(t*3.1, 0.0, -t*2.2));',
    '  float heat = clamp(superCell*0.54 + gran*0.36 + fine*0.16, 0.0, 1.0);',
    // Full white-yellow-orange-red ramp rather than a two-way tint, so the
    // hottest cell centres go near-white while the lanes between them stay
    // deep ember red. That spread is what gives the surface its depth.
    '  vec3 cDeep  = vec3(0.42, 0.07, 0.01);',
    '  vec3 cEmber = vec3(0.98, 0.29, 0.04);',
    '  vec3 cAmber = vec3(1.00, 0.58, 0.14);',
    '  vec3 cGold  = vec3(1.00, 0.85, 0.44);',
    '  vec3 cWhite = vec3(1.00, 0.98, 0.91);',
    '  vec3 col = mix(cDeep, cEmber, smoothstep(0.16, 0.40, heat));',
    '  col = mix(col, cAmber, smoothstep(0.36, 0.57, heat));',
    '  col = mix(col, cGold,  smoothstep(0.54, 0.73, heat));',
    '  col = mix(col, cWhite, smoothstep(0.70, 0.93, heat));',
    // Sunspots: very low frequency, high threshold, so only one or two exist
    // at a time and they drift slowly. Dark umbra inside a warmer penumbra.
    '  float spotField = fbm3(d*1.9 + vec3(3.7, t*0.35, 1.1));',
    '  float penumbra = smoothstep(0.555, 0.640, spotField);',
    '  float umbra    = smoothstep(0.615, 0.700, spotField);',
    '  col = mix(col, col * vec3(0.70,0.42,0.26), penumbra*0.60);',
    '  col = mix(col, vec3(0.13,0.04,0.02), umbra*0.88);',
    // Limb darkening. Toward the silhouette you are looking through more of
    // the cooler upper photosphere, so it dims and reddens. Without this a
    // sphere of noise reads as a flat disc no matter how good the noise is.
    '  float facing = clamp(dot(normalize(vN), normalize(vViewDir)), 0.0, 1.0);',
    '  col *= 0.34 + 0.66 * pow(facing, 0.55);',
    '  col = mix(col * vec3(0.96,0.52,0.24), col, smoothstep(0.0, 0.58, facing));',
    // A gentle centre-bright lift: the last cue that the disc is curved and
    // enormous. Kept modest so it never blows out to a white blob.
    '  col += vec3(0.30,0.19,0.05) * pow(facing, 3.0);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ]).join('\\n');

  // Prominences and magnetic loops. A thin shell floating just above the
  // photosphere whose opacity survives only near ITS OWN silhouette — and
  // because the shell is slightly larger than the Sun, that surviving band
  // lands just outside the Sun's visible edge, which is precisely where real
  // prominences are photographed arcing off the limb. Ridged noise breaks
  // the band into separate tongues, so it reads as individual loops instead
  // of an even ring or a radial sunburst.
  var PROM_FRAG = [].concat(['precision mediump float;'], SUN_NOISE_GLSL, [
    'uniform float uTime;',
    'uniform vec3 uColorHot;',
    'uniform vec3 uColorCool;',
    'varying vec3 vDir;',
    'varying vec3 vN;',
    'varying vec3 vViewDir;',
    'void main(){',
    '  vec3 d = normalize(vDir);',
    '  float t = uTime * 0.05;',
    '  float facing = clamp(dot(normalize(vN), normalize(vViewDir)), 0.0, 1.0);',
    '  float limbBand = pow(1.0 - facing, 3.5);',
    // Squashing the sampling space along Y stretches the noise into arcs
    // that lie along the surface, the shape a magnetic loop actually takes.
    '  vec3 q = vec3(d.x*3.4, d.y*1.5, d.z*3.4) + vec3(0.0, t*1.4, 0.0);',
    '  float loops = ridged3(q);',
    '  float detail = fbm3(d*9.0 + vec3(t*2.0, t*1.1, 0.0));',
    '  float mask = smoothstep(0.50, 0.86, loops*0.72 + detail*0.34);',
    // Each loop breathes on its own phase (seeded from the loop noise) so
    // prominences rise and fade independently instead of the whole rim
    // pulsing together, which would read as a cheap global animation.
    '  float breathe = 0.55 + 0.45 * sin(uTime*0.55 + loops*9.0);',
    '  float a = limbBand * mask * breathe;',
    '  gl_FragColor = vec4(mix(uColorCool, uColorHot, mask), clamp(a, 0.0, 1.0) * 0.9);',
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

  function buildProminenceShell(radius){
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorHot:  { value: toVec3(0xFFD9A0) },
        uColorCool: { value: toVec3(0xFF3B14) }
      },
      vertexShader: SUN_VERT,
      fragmentShader: PROM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
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

    var prominence = buildProminenceShell(SUN_RADIUS * 1.07);

    // There is no post-process bloom pass in this pipeline, so the corona is
    // built as concentric additive shells instead. Four narrow, dim layers
    // read as a graded atmosphere with real depth; one bright wide layer
    // would just be the overexposed white blob this pass had to avoid.
    // Each falls off faster than the last, so brightness ramps down smoothly
    // from the surface out to the faint outer halo.
    var chromo = buildGlowLayer(SUN_RADIUS * 1.11, 0xFF6A22, 3.4, 0.95, false);
    var glow   = buildGlowLayer(SUN_RADIUS * 1.40, 0xFFB765, 2.1, 0.62, false);
    var corona = buildGlowLayer(SUN_RADIUS * 1.95, 0xFF9038, 2.5, 0.38, true);
    var halo   = buildGlowLayer(SUN_RADIUS * 2.40, 0xE9601C, 2.9, 0.18, false);

    return {
      core: core, prominence: prominence, chromo: chromo,
      glow: glow, corona: corona, halo: halo, material: mat
    };
  }

  // ── Public: build the whole system into a scene, update it per frame ───
  function build(scene){
    ensureAssets();

    var sun = buildSun();
    scene.add(sun.core);
    scene.add(sun.prominence);
    scene.add(sun.chromo);
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
    system.sun.prominence.material.uniforms.uTime.value = elapsed;
    // Every glow shell declares uTime, so every glow shell gets it. Only the
    // turbulent one visibly uses it today, but a shell whose clock is never
    // advanced silently freezes the moment it is made turbulent later.
    system.sun.chromo.material.uniforms.uTime.value = elapsed;
    system.sun.glow.material.uniforms.uTime.value = elapsed;
    system.sun.corona.material.uniforms.uTime.value = elapsed;
    system.sun.halo.material.uniforms.uTime.value = elapsed;
    // A slow, tiny breathing scale sells "volumetric" without another draw call.
    var pulse = 1.0 + Math.sin(elapsed * 0.5) * 0.015;
    system.sun.glow.scale.setScalar(SUN_RADIUS * 1.40 * pulse);
    for (var i = 0; i < system.bodies.length; i++) {
      var body = system.bodies[i];
      body.mesh.rotation.y += dt * body.rotSpeed;
      body.material.uniforms.uTime.value = elapsed;
      // Orbit is a single rotation.y advance on each moon's own pivot (see
      // buildPlanet) — cheap enough that looping every moon of every planet
      // every frame is still just a handful of scalar adds.
      for (var mi = 0; mi < body.moons.length; mi++) {
        var moon = body.moons[mi];
        moon.orbitPivot.rotation.y += dt * moon.speed;
        moon.mesh.rotation.y += dt * moon.spin;
        moon.material.uniforms.uTime.value = elapsed;
      }
    }
  }

  return { DATA: DATA, SUN_RADIUS: SUN_RADIUS, build: build, update: update };
})();
`;
