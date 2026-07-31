/**
 * Planets — celestial bodies for the Solar System, built inside Space Mode.
 *
 * View-only: no picking, no labels, no orbit motion. Positions are static
 * points on each planet's orbit; the orbit rings are drawn now so a future
 * "animate the orbit" feature has geometry to reuse without touching this
 * module's shape.
 *
 * Design decisions:
 *
 * 1. Visual, not physical, scale. True orbital distances would put Mercury a
 *    speck of a hundred thousand units from a Jupiter you could not see in
 *    the same frame. Sizes and distances here are chosen to be legible and
 *    pleasant to view together, not to scale.
 *
 * 2. One shared unit sphere (`UNIT_SPHERE`) is reused for the Sun's core,
 *    both glow shells, and all eight planets — only `mesh.scale` differs.
 *    Two shared canvas textures (a mottled "rocky" pattern and a banded "gas"
 *    pattern) are tinted per body via `material.color`, so eight distinct
 *    looking planets cost two small textures rather than eight.
 *
 * 3. Axial tilt and spin are kept on separate objects: a `pivot` holds the
 *    constant tilt, and the mesh inside it advances `rotation.y` every frame.
 *    Saturn's ring hangs off the same pivot, tilted with the planet but never
 *    spinning with it — rings do not rotate with the planet's day/night cycle.
 *
 * 4. The ring is drawn analytically (radial bands computed in the fragment
 *    shader) instead of with a texture, so there is nothing to load and no
 *    UV mapping to get right on a RingGeometry.
 */
export const PLANETS_JS = `
var Planets = (function(){
  var SUN_RADIUS = 130;

  // name, tint color, visual radius, orbit radius, spin rate (rad/s, negative
  // = retrograde like Venus), axial tilt (rad), texture style, starting angle
  // around the orbit (rad) so bodies read as scattered rather than lined up.
  var DATA = [
    { name:'Mercury', color:0x9C9282, radius:5,  orbitRadius:260,  rotSpeed:0.050,  tilt:0.001, style:'rocky', startAngle:0.4 },
    { name:'Venus',   color:0xE8C9A0, radius:9,  orbitRadius:330,  rotSpeed:-0.035, tilt:0.05,  style:'rocky', startAngle:2.1 },
    { name:'Earth',   color:0x3F76D6, radius:10, orbitRadius:410,  rotSpeed:0.220,  tilt:0.41,  style:'rocky', startAngle:4.0 },
    { name:'Mars',    color:0xC1440E, radius:6,  orbitRadius:480,  rotSpeed:0.210,  tilt:0.44,  style:'rocky', startAngle:1.1 },
    { name:'Jupiter', color:0xD9A468, radius:55, orbitRadius:760,  rotSpeed:0.400,  tilt:0.05,  style:'gas',   startAngle:5.2 },
    { name:'Saturn',  color:0xE3C99D, radius:46, orbitRadius:1040, rotSpeed:0.360,  tilt:0.47,  style:'gas',   startAngle:0.8, ring:true },
    { name:'Uranus',  color:0x9FE0E0, radius:28, orbitRadius:1280, rotSpeed:-0.150, tilt:1.71,  style:'gas',   startAngle:3.3 },
    { name:'Neptune', color:0x3D5FCC, radius:27, orbitRadius:1480, rotSpeed:0.155,  tilt:0.49,  style:'gas',   startAngle:5.8 }
  ];

  var UNIT_SPHERE = null;
  var rockyTex = null, bandTex = null;

  function buildRockyTexture(){
    var c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    var ctx = c.getContext('2d');
    // Mid-grey base so multiplying by the per-planet tint stays close to the
    // intended color rather than darkening it.
    ctx.fillStyle = 'rgb(190,190,190)';
    ctx.fillRect(0, 0, 128, 64);
    // A scatter of soft blotches reads as terrain/craters at planet scale
    // without a real heightmap.
    for (var i = 0; i < 140; i++) {
      var x = Math.random() * 128, y = Math.random() * 64, r = 2 + Math.random() * 7;
      var v = 150 + Math.random() * 90;
      ctx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.5)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  function buildBandTexture(){
    var c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    var ctx = c.getContext('2d');
    for (var y = 0; y < 64; y++) {
      // A few overlaid sine waves give irregular band widths instead of a
      // mechanical stripe pattern.
      var t = y / 64;
      var v = 150
        + 40 * Math.sin(t * 18)
        + 20 * Math.sin(t * 47 + 1.3)
        + 12 * (Math.random() - 0.5);
      v = Math.max(90, Math.min(235, v));
      ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      ctx.fillRect(0, y, 128, 1);
    }
    return new THREE.CanvasTexture(c);
  }

  function ensureAssets(){
    if (!UNIT_SPHERE) UNIT_SPHERE = new THREE.SphereGeometry(1, 40, 20);
    if (!rockyTex) rockyTex = buildRockyTexture();
    if (!bandTex)  bandTex  = buildBandTexture();
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
    // World-space normal (uniform scale only, so the plain model matrix is
    // enough — no need for an inverse-transpose here).
    '  vNormalW = normalize(mat3(modelMatrix) * normal);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\\n');

  var RING_FRAG = [
    'uniform vec3 uColor;',
    'uniform vec3 uSunDir;',
    'uniform float uInner;',
    'uniform float uOuter;',
    'varying vec3 vLocalPos;',
    'varying vec3 vNormalW;',
    'void main(){',
    '  float r = length(vLocalPos.xy);',
    '  float t = (r - uInner) / max(0.0001, (uOuter - uInner));',
    // Overlapping bands read as the gap-and-band structure of a real ring
    // system without needing a texture.
    '  float bands = 0.55 + 0.30 * sin(t * 24.0) + 0.15 * sin(t * 61.0 + 1.7);',
    '  float edgeFade = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.94, 1.0, t));',
    // abs(), not max(), because the vertex normal is not flipped per back face:
    // a ring is a thin disc viewed from either side, and both faces should
    // read as lit by the same magnitude of sunlight rather than one face
    // going fully dark whenever the camera orbits under the ring plane.
    '  float diffuse = abs(dot(normalize(vNormalW), uSunDir));',
    '  float lightF = 0.25 + 0.75 * diffuse;',
    '  float alpha = clamp(bands, 0.0, 1.0) * edgeFade * 0.85;',
    '  gl_FragColor = vec4(uColor * lightF, alpha);',
    '}'
  ].join('\\n');

  function toVec3(hex){
    return new THREE.Vector3(((hex>>16)&255)/255, ((hex>>8)&255)/255, (hex&255)/255);
  }

  function buildRing(innerR, outerR, color, sunDir){
    var geo = new THREE.RingGeometry(innerR, outerR, 96, 1);
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: toVec3(color) },
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
  function buildPlanet(d){
    var tex = d.style === 'gas' ? bandTex : rockyTex;
    var mat = new THREE.MeshPhongMaterial({
      map: tex, color: d.color,
      shininess: d.style === 'gas' ? 2 : 8,
      specular: 0x111111
    });

    var mesh = new THREE.Mesh(UNIT_SPHERE, mat);
    mesh.scale.setScalar(d.radius);

    // Tilt lives on the pivot, spin lives on the mesh, so a continuously
    // increasing spin angle never compounds with the (constant) tilt.
    var x = Math.cos(d.startAngle) * d.orbitRadius;
    var z = Math.sin(d.startAngle) * d.orbitRadius;
    var pivot = new THREE.Object3D();
    pivot.position.set(x, 0, z);
    pivot.rotation.z = d.tilt;
    pivot.add(mesh);

    var body = { name: d.name, mesh: mesh, pivot: pivot, rotSpeed: d.rotSpeed };

    if (d.ring) {
      // The Sun sits at the world origin and nothing orbits yet, so the
      // direction toward it from this static position is constant. Recompute
      // it per frame from the pivot's live position once orbits animate.
      var sunDir = new THREE.Vector3(-x, 0, -z).normalize();
      var ring = buildRing(d.radius * 1.4, d.radius * 2.3, 0xC9B48A, sunDir);
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

  var SUN_FRAG = [
    'uniform float uTime;',
    'varying vec2 vUv;',
    // Two cheap overlapping sine fields stand in for convection cells —
    // enough surface motion to read as "alive" without a noise texture.
    'void main(){',
    '  float n = sin(vUv.x*24.0 + uTime*0.6) * sin(vUv.y*18.0 - uTime*0.4);',
    '  n += 0.5 * sin(vUv.x*53.0 - uTime*0.9 + vUv.y*11.0);',
    '  float t = 0.5 + 0.5*n;',
    '  vec3 core = vec3(1.0, 0.93, 0.70);',
    '  vec3 hot  = vec3(1.0, 0.55, 0.12);',
    '  gl_FragColor = vec4(mix(hot, core, t), 1.0);',
    '}'
  ].join('\\n');

  // Fresnel glow shell, view-dependent (not tied to any fixed camera axis) so
  // it looks correct while the Space Mode camera freely orbits.
  var GLOW_VERT = [
    'varying vec3 vN;',
    'varying vec3 vViewDir;',
    'void main(){',
    '  vN = normalize(normalMatrix * normal);',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vViewDir = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\\n');

  var GLOW_FRAG = [
    'uniform vec3 uColor;',
    'uniform float uPower;',
    'uniform float uIntensity;',
    'varying vec3 vN;',
    'varying vec3 vViewDir;',
    'void main(){',
    '  float facing = max(0.0, dot(normalize(vN), normalize(vViewDir)));',
    '  float f = pow(1.0 - facing, uPower);',
    '  gl_FragColor = vec4(uColor, f * uIntensity);',
    '}'
  ].join('\\n');

  function buildGlowLayer(radius, color, power, intensity){
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: toVec3(color) },
        uPower: { value: power },
        uIntensity: { value: intensity }
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

    var glow   = buildGlowLayer(SUN_RADIUS * 1.35, 0xFFC773, 1.6, 0.9);
    var corona = buildGlowLayer(SUN_RADIUS * 2.1,  0xFF9A3C, 2.6, 0.5);

    return { core: core, glow: glow, corona: corona, material: mat };
  }

  // ── Public: build the whole system into a scene, update it per frame ───
  function build(scene){
    ensureAssets();

    var sun = buildSun();
    scene.add(sun.core);
    scene.add(sun.glow);
    scene.add(sun.corona);

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
    // A slow, tiny breathing scale sells "volumetric" without another draw call.
    var pulse = 1.0 + Math.sin(elapsed * 0.5) * 0.015;
    system.sun.glow.scale.setScalar(SUN_RADIUS * 1.35 * pulse);
    for (var i = 0; i < system.bodies.length; i++) {
      system.bodies[i].mesh.rotation.y += dt * system.bodies[i].rotSpeed;
    }
  }

  return { DATA: DATA, SUN_RADIUS: SUN_RADIUS, build: build, update: update };
})();
`;
