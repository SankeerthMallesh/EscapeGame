// =====================================================================
//  WORLD — the island: terrain, lake, trees, landmarks, kids, dock, cabin
// =====================================================================
const ISLE = { size: 400, seg: 256, R: 138 };
const MOON_DIR = new THREE.Vector3(-0.35, 0.42, -0.84).normalize();
const RAVINE = { ax: -4, bx: 60, z: -80, w: 5.5, bridgeX: 28 };

function shoreR(a) { return ISLE.R + 9 * fbm(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5, 3, 11) + 4 * Math.sin(a * 3 + 1); }
function baseHeight(x, z) {
  const d = Math.hypot(x, z), a = Math.atan2(z, x), edge = shoreR(a);
  const land = smoothstep(-0.5, 0.6, (edge - d) / 22);
  const hills = 1.2 + 2.4 * (fbm(x * 0.011 + 3, z * 0.011 - 7, 4, 3) * 0.5 + 0.5) * 2.0 + 0.45 * fbm(x * 0.06, z * 0.06, 2, 9);
  return lerp(-3.6, hills, land);
}
function ravineProfile(x, z) {
  const s = (x - RAVINE.ax) / (RAVINE.bx - RAVINE.ax);
  if (s <= 0 || s >= 1) return 0;
  const w = RAVINE.w * Math.sqrt(Math.sin(Math.PI * s)), d = Math.abs(z - RAVINE.z + Math.sin(x * 0.15) * 1.2);
  return smoothstep(w + 2.2, w - 1.0, d);
}

const World = {
  scene: null, built: false, heights: null, flat: [], paths: [], dist: null, circles: [], boxes: [], grid: new Map(),
  landmarks: [], kids: [], jacks: [], pumpkins: [], interact: [], batteries: [], parts: [], partSpots: [], battSpots: [],
  chunks: [], swings: [], smokes: [], mist: [], signs: [], corn: [], kidLines: new Set(), lights: null, glow: null, time: 0,
  dock: null, cabin: null, bridge: null, shoreZ: 120, partsDelivered: new Set(), carried: new Set(), boat: null,

  // ---------------- terrain ----------------
  heightFn(x, z) {
    let h = baseHeight(x, z);
    for (const f of this.flat) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r + f.blend) h = lerp(h, f.h, smoothstep(f.r + f.blend, f.r, d)); }
    const pd = this.pathDistRaw ? this.pathDistRaw(x, z) : 99;
    if (pd < 3) h -= 0.12 * smoothstep(3, 0.5, pd);
    const rv = ravineProfile(x, z);
    if (rv > 0) h = lerp(h, -2.4, rv);
    return h;
  },
  groundAt(x, z) {
    const S = ISLE.size, n = ISLE.seg, c = S / n;
    const fx = (x + S / 2) / c, fz = (z + S / 2) / c;
    if (fx < 0 || fz < 0 || fx >= n || fz >= n) return -3.6;
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, H = this.heights, w = n + 1;
    const a = H[iz * w + ix], b = H[iz * w + ix + 1], cc = H[(iz + 1) * w + ix], d = H[(iz + 1) * w + ix + 1];
    return lerp(lerp(a, b, tx), lerp(cc, d, tx), tz);
  },
  onDock(x, z) { const k = this.dock; return k && x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1; },
  onBridge(x, z) { const b = this.bridge; return b && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1; },
  surfaceY(x, z) { if (this.onDock(x, z)) return this.dock.y; if (this.onBridge(x, z)) return this.bridge.y; return this.groundAt(x, z); },
  surfaceKind(x, z) { return this.onDock(x, z) || this.onBridge(x, z) ? 'wood' : 'grass'; },
  walkable(x, z) {
    if (this.onDock(x, z) || this.onBridge(x, z)) return true;
    if (Math.hypot(x, z) > 175) return false;
    if (ravineProfile(x, z) > 0.12) return false;
    return this.groundAt(x, z) > 0.28;
  },
  pathDist(x, z) {
    const i = Math.floor(x + 200), j = Math.floor(z + 200);
    if (i < 0 || j < 0 || i >= 400 || j >= 400) return 99;
    return this.dist[j * 400 + i];
  },

  // ---------------- colliders ----------------
  addCircle(x, z, r, occ = 0) {
    const c = { x, z, r, occ }; this.circles.push(c);
    const k0 = Math.floor((x - r - 2) / 8), k1 = Math.floor((x + r + 2) / 8), m0 = Math.floor((z - r - 2) / 8), m1 = Math.floor((z + r + 2) / 8);
    for (let i = k0; i <= k1; i++) for (let j = m0; j <= m1; j++) { const key = i * 1000 + j; if (!this.grid.has(key)) this.grid.set(key, []); this.grid.get(key).push(c); }
    return c;
  },
  addBox(x, z, hw, hd, rot = 0, occ = true) { const b = { x, z, hw, hd, rot, c: Math.cos(rot), s: Math.sin(rot), occ, r: Math.hypot(hw, hd) }; this.boxes.push(b); return b; },
  near(x, z) { return this.grid.get(Math.floor(x / 8) * 1000 + Math.floor(z / 8)) || []; },
  resolve(p, r) {
    for (let it = 0; it < 2; it++) {
      for (const c of this.near(p.x, p.z)) {
        const dx = p.x - c.x, dz = p.z - c.z, d2 = dx * dx + dz * dz, rr = r + c.r;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d; p.x += dx * k; p.z += dz * k; }
      }
      for (const b of this.boxes) {
        const dx = p.x - b.x, dz = p.z - b.z; if (dx * dx + dz * dz > (b.r + r + 1) ** 2) continue;
        const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c; // into box space (rot about Y)
        const cx = clamp(lx, -b.hw, b.hw), cz = clamp(lz, -b.hd, b.hd), ox = lx - cx, oz = lz - cz, d2 = ox * ox + oz * oz;
        if (d2 < r * r) {
          let nx, nz, push;
          if (d2 > 1e-6) { const d = Math.sqrt(d2); nx = ox / d; nz = oz / d; push = r - d; }
          else { const px = b.hw - Math.abs(lx), pz = b.hd - Math.abs(lz); if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; push = px + r; } else { nx = 0; nz = Math.sign(lz) || 1; push = pz + r; } }
          const wx = nx * b.c + nz * b.s, wz = -nx * b.s + nz * b.c; p.x += wx * push; p.z += wz * push;
        }
      }
    }
  },
  // Does anything solid stand between a and b? (trees, buildings) — used for Joury line of sight
  blocked(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz); if (len < 0.5) return false;
    const steps = Math.ceil(len / 4), seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, x = ax + dx * t, z = az + dz * t;
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const list = this.grid.get((Math.floor(x / 8) + ox) * 1000 + Math.floor(z / 8) + oz); if (!list) continue;
        for (const c of list) {
          if (!c.occ || seen.has(c)) continue; seen.add(c);
          const u = clamp(((c.x - ax) * dx + (c.z - az) * dz) / (len * len), 0, 1); if (u * len < 1.2 || (1 - u) * len < 1.2) continue;
          const px = ax + dx * u - c.x, pz = az + dz * u - c.z; if (px * px + pz * pz < c.occ * c.occ) return true;
        }
      }
    }
    for (const b of this.boxes) {
      if (!b.occ) continue;
      const u = clamp(((b.x - ax) * dx + (b.z - az) * dz) / (len * len), 0, 1), px = ax + dx * u - b.x, pz = az + dz * u - b.z;
      if (px * px + pz * pz < b.hw * b.hw * 0.6 + b.hd * b.hd * 0.6 && u * len > 1 && (1 - u) * len > 1) return true;
    }
    return false;
  },

  // ---------------- build ----------------
  build(progress) {
    srand = mulberry32(31337);
    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f17, D().fog);
    scene.background = new THREE.Color(0x05070b);
    this.cam = GFX.camera(70, 0.05, 460);
    this.cam.rotation.order = 'YXZ';
    scene.add(this.cam);
    this.layout();
    progress(0.15, 'Raising the island…');
    this.buildTerrain();
    progress(0.3, 'Filling the lake…');
    this.buildSkyWater();
    this.lights = new LightPool(scene, 4);
    this.glow = new GlowSet(400, 85); scene.add(this.glow.points);
    progress(0.4, 'Building landmarks…');
    this.buildLandmarks();
    this.buildCabin(); this.buildDock();
    progress(0.6, 'Growing hundreds of trees…');
    this.buildTrees();
    progress(0.75, 'Carving jack-o\'-lanterns…');
    this.buildJacks(); this.buildGrass(); this.buildAtmosphere();
    this.findSpots();
    progress(0.85, 'Hiding the kids…');
    this.built = true;
  },
  layout() {
    // shoreline under the dock
    let sz = 100; while (sz < 170 && baseHeight(0, sz) > 0.35) sz += 0.5; this.shoreZ = sz;
    const L = (id, name, x, z, rot, clear, flat, kid, build) => ({ id, name, x, z, rot, clear, flat, kid, build });
    this.landmarks = [
      L('swing', 'Rusty Swing Set', -86, 40, 0.5, 10, 8, 'bee', 'buildSwing'),
      L('grave', 'Graveyard', -58, -22, -0.3, 14, 12, 'skeleton', 'buildGrave'),
      L('scare', 'Scarecrow Field', 98, -50, 0.2, 15, 14, 'cat', 'buildScare'),
      L('camp', 'Abandoned Campsite', -38, 84, 0.9, 11, 9, 'hero', 'buildCamp'),
      L('tower', 'Water Tower', -88, -72, 0.6, 10, 8, 'astronaut', 'buildTower'),
      L('bus', 'Old School Bus', 88, 24, -0.4, 11, 9, 'ghost', 'buildBus'),
      L('well', 'Stone Well', 44, -14, 0.1, 8, 6, 'witch', 'buildWell'),
      L('patch', 'Pumpkin Patch', 46, 76, -0.2, 14, 12, 'pumpkin', 'buildPatch'),
      L('bridge', 'Ravine Bridge', RAVINE.bridgeX, RAVINE.z, 0, 0, 0, 'dino', 'buildBridge'),
      L('fire', 'Dead Bonfire Ring', -22, -114, 0, 10, 8, 'vampire', 'buildFire'),
    ];
    this.cabinPos = { x: 0, z: -30 };
    this.flat = [];
    this.landmarks.forEach((l) => { if (l.flat) this.flat.push({ x: l.x, z: l.z, r: l.flat, blend: 7, h: Math.max(1.3, baseHeight(l.x, l.z)) }); });
    this.flat.push({ x: 0, z: -30, r: 11, blend: 8, h: Math.max(2.0, baseHeight(0, -30)) });
    this.flat.push({ x: 0, z: sz - 9, r: 7, blend: 5, h: 1.0 });
    // bridge end platforms share one height
    const bx = RAVINE.bridgeX, hb = Math.max(2.2, (baseHeight(bx, -91) + baseHeight(bx, -69)) / 2);
    this.flat.push({ x: bx, z: -91, r: 4.2, blend: 5, h: hb }, { x: bx, z: -69, r: 4.2, blend: 5, h: hb });
    this.bridge = { x0: bx - 1.05, x1: bx + 1.05, z0: -88.5, z1: -71.5, y: hb };
    // path graph
    const dockN = { x: 0, z: sz - 9 }, P = (id) => { const l = this.landmarks.find((q) => q.id === id); return { x: l.x, z: l.z }; };
    const N = { D: dockN, CS: P('camp'), PP: P('patch'), SW: P('swing'), BUS: P('bus'), GY: P('grave'), WL: P('well'), CB: { x: 0, z: -22 }, SC: P('scare'), WT: P('tower'), BF: P('fire'), RN: { x: bx, z: -92 }, RS: { x: bx, z: -68 }, E: { x: 70, z: -97 } };
    const E = [['D', 'CS'], ['D', 'PP'], ['CS', 'SW'], ['CS', 'CB'], ['PP', 'BUS'], ['PP', 'WL'], ['WL', 'CB'], ['WL', 'BUS'], ['BUS', 'SC'], ['SC', 'RS'], ['SC', 'E'], ['E', 'RN'], ['SW', 'GY'], ['GY', 'WT'], ['GY', 'CB'], ['WT', 'BF'], ['BF', 'RN'], ['RS', 'CB'], ['RN', 'RS']];
    this.paths = E.map(([a, b]) => {
      const A = N[a], B = N[b], pts = [], len = Math.hypot(B.x - A.x, B.z - A.z), n = Math.max(2, Math.ceil(len / 5));
      const px = -(B.z - A.z) / len, pz = (B.x - A.x) / len, amp = a + b === 'RNRS' ? 0 : Math.min(7, len * 0.08), ph = srnd(0, 10);
      for (let i = 0; i <= n; i++) { const t = i / n, w = Math.sin(Math.PI * t) * (Math.sin(t * 5 + ph) * amp + vnoise(t * 3, ph, 5) * amp * 0.5); pts.push({ x: lerp(A.x, B.x, t) + px * w, z: lerp(A.z, B.z, t) + pz * w }); }
      return pts;
    });
    // distance-to-path field (1 m cells)
    const dist = this.dist = new Float32Array(400 * 400).fill(99);
    this.paths.forEach((pts) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], x0 = Math.floor(Math.min(a.x, b.x) - 5), x1 = Math.ceil(Math.max(a.x, b.x) + 5), z0 = Math.floor(Math.min(a.z, b.z) - 5), z1 = Math.ceil(Math.max(a.z, b.z) + 5);
        const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
          const ix = x + 200, iz = z + 200; if (ix < 0 || iz < 0 || ix >= 400 || iz >= 400) continue;
          const cx = x + 0.5, cz = z + 0.5, t = clamp(((cx - a.x) * dx + (cz - a.z) * dz) / L2, 0, 1), ex = a.x + dx * t - cx, ez = a.z + dz * t - cz, d = Math.sqrt(ex * ex + ez * ez);
          if (d < dist[iz * 400 + ix]) dist[iz * 400 + ix] = d;
        }
      }
    });
    this.pathDistRaw = (x, z) => this.pathDist(x, z);
  },
  buildTerrain() {
    const S = ISLE.size, n = ISLE.seg, w = n + 1, c = S / n;
    const H = this.heights = new Float32Array(w * w);
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) H[j * w + i] = this.heightFn(-S / 2 + i * c, -S / 2 + j * c);
    const geo = new THREE.PlaneGeometry(S, S, n, n); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, spl = new Float32Array(pos.count * 4);
    const dirtSpots = { patch: 0.9, camp: 0.8, fire: 0.9, swing: 0.6, bus: 0.5, well: 0.6, tower: 0.5, grave: 0.15, scare: 0.35 };
    const hAt = (i, j) => H[clamp(j, 0, n) * w + clamp(i, 0, n)];
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k), i = Math.round((x + S / 2) / c), j = Math.round((z + S / 2) / c), h = H[j * w + i];
      pos.setY(k, h);
      const slope = Math.hypot(hAt(i + 1, j) - hAt(i - 1, j), hAt(i, j + 1) - hAt(i, j - 1)) / (2 * c);
      const forest = smoothstep(-0.4, 0.1, fbm(x * 0.018 + 40, z * 0.018, 3, 13)), n1 = fbm(x * 0.07, z * 0.07, 3, 21), n2 = fbm(x * 0.21, z * 0.21, 2, 4);
      let dirt = 0, leaves = clamp(forest * (0.45 + n1 * 0.5) + smoothstep(0.2, 0.6, n2) * 0.3, 0, 1), stone = 0, ao = 1 - forest * 0.22 - Math.max(0, -n1) * 0.12;
      for (const l of this.landmarks) { const dv = dirtSpots[l.id]; if (!dv) continue; const d = Math.hypot(x - l.x, z - l.z); if (d < l.clear + 3) { const k2 = smoothstep(l.clear + 3, l.clear - 4, d); dirt = Math.max(dirt, k2 * dv * (0.75 + n2 * 0.4)); if (l.id === 'grave' || l.id === 'scare') leaves = Math.max(leaves, k2 * 0.75); } }
      const dc = Math.hypot(x - this.cabinPos.x, z - this.cabinPos.z); if (dc < 13) dirt = Math.max(dirt, smoothstep(13, 6, dc) * 0.85);
      const pd = this.pathDist(x, z); if (pd < 3.0) { dirt = Math.max(dirt, smoothstep(3.0, 0.9, pd + n2 * 0.6)); leaves *= smoothstep(0.6, 2.6, pd) * 0.7 + 0.3; }
      if (h < 1.3) { dirt = Math.max(dirt, smoothstep(1.3, 0.5, h)); ao -= smoothstep(1.0, 0.2, h) * 0.2; }
      if (h < 0.2) { stone = Math.max(stone, smoothstep(0.2, -1.0, h) * 0.8); ao -= 0.25; }
      stone = Math.max(stone, smoothstep(0.55, 0.95, slope));
      const rv = ravineProfile(x, z); if (rv > 0.03) { stone = Math.max(stone, smoothstep(0.03, 0.4, rv)); ao -= rv * 0.35; }
      spl[k * 4] = clamp(dirt, 0, 1); spl[k * 4 + 1] = clamp(leaves, 0, 1); spl[k * 4 + 2] = clamp(stone, 0, 1); spl[k * 4 + 3] = clamp(ao, 0.25, 1);
    }
    geo.setAttribute('splat', new THREE.BufferAttribute(spl, 4)); geo.computeVertexNormals();
    const uv = geo.attributes.uv, rep = S / 3.6; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * rep, uv.getY(k) * rep);
    const mat = new THREE.MeshStandardMaterial({ map: PBR.grass.map, normalMap: PBR.grass.normalMap, roughness: 1, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { tDirt: { value: PBR.dirt.map }, tLeaves: { value: PBR.leaves.map }, tStone: { value: PBR.stone.map }, tDirtN: { value: PBR.dirt.normalMap }, tLeavesN: { value: PBR.leaves.normalMap }, tStoneN: { value: PBR.stone.normalMap } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat;\nvarying vec4 vSplat;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D tDirt, tLeaves, tStone, tDirtN, tLeavesN, tStoneN;\nvarying vec4 vSplat;')
        .replace('#include <normalmap_pars_fragment>', `#include <normalmap_pars_fragment>
          vec4 splatNormal(vec2 uv){ vec3 n = texture2D(normalMap, uv).xyz; n = mix(n, texture2D(tLeavesN, uv * 1.1).xyz, vSplat.g); n = mix(n, texture2D(tDirtN, uv * 0.8).xyz, vSplat.r); n = mix(n, texture2D(tStoneN, uv * 0.45).xyz, vSplat.b); return vec4(n, 1.0); }`)
        .replace('#include <map_fragment>', `
          vec3 cg = mix(texture2D(map, vMapUv).rgb, texture2D(map, vMapUv * 0.27 + 0.31).rgb, 0.4);
          vec3 cl = texture2D(tLeaves, vMapUv * 1.1).rgb, cd = mix(texture2D(tDirt, vMapUv * 0.8).rgb, texture2D(tDirt, vMapUv * 0.21).rgb, 0.35), cs = texture2D(tStone, vMapUv * 0.45).rgb;
          vec3 cc = mix(cg, cl, vSplat.g); cc = mix(cc, cd, vSplat.r); cc = mix(cc, cs, vSplat.b);
          diffuseColor.rgb *= cc * vSplat.a;`)
        .replace(/texture2D\( normalMap, vNormalMapUv \)/g, 'splatNormal( vNormalMapUv )')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * (0.96 - vSplat.r * 0.1 - vSplat.b * 0.05);');
    };
    fogify(mat);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m); this.terrain = m;
  },
  buildSkyWater() {
    const sky = makeSky({ top: 0x020309, mid: 0x0c1320, bot: 0x05070b, sunDir: MOON_DIR, sunCol: 0x9fb4e0, sunSize: 0.99999, halo: 0.55, r: 400 });
    this.scene.add(sky); this.sky = sky;
    this.stars = makeStars(1400, 370); this.scene.add(this.stars);
    this.moon = makeMoon(MOON_DIR, 330, 28); this.scene.add(this.moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(0.35, 0.4, 0.55), fog: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
    halo.position.copy(this.moon.position); halo.scale.set(150, 150, 1); halo.renderOrder = -8; this.scene.add(halo);
    // reflection probe of the night sky for the lake
    const envScene = new THREE.Scene(); envScene.add(makeSky({ top: 0x05070d, mid: 0x182436, bot: 0x0a0e15, sunDir: MOON_DIR, sunCol: 0xc8d4f0, sunSize: 0.9996, halo: 1.2, r: 100 }));
    const pm = new THREE.PMREMGenerator(GFX.renderer); this.env = pm.fromScene(envScene, 0, 0.1, 500).texture; pm.dispose();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.3;
    this.waterMat = makeWater(0x02060a, this.env, { repeat: 90, rough: 0.07, env: 1.4 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.waterMat); water.rotation.x = -Math.PI / 2; water.receiveShadow = true; this.scene.add(water); this.water = water;
    this.hemi = new THREE.HemisphereLight(0x6e7a94, 0x2a2418, 0.45); this.scene.add(this.hemi);
    const moonL = this.moonLight = new THREE.DirectionalLight(0xaab8e0, 0.75);
    moonL.position.copy(MOON_DIR).multiplyScalar(60); this.scene.add(moonL); this.scene.add(moonL.target);
    moonL.shadow.camera.left = moonL.shadow.camera.bottom = -45; moonL.shadow.camera.right = moonL.shadow.camera.top = 45; moonL.shadow.camera.near = 1; moonL.shadow.camera.far = 140; moonL.shadow.bias = -0.0008; moonL.shadow.normalBias = 0.04;
    this.applyMoonShadow();
  },
  applyMoonShadow() {
    const q = Q(), L = this.moonLight; if (!L) return;
    L.castShadow = q.moonShadow > 0;
    if (L.castShadow) { L.shadow.mapSize.set(q.moonShadow, q.moonShadow); if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; } }
  },

  // ---------------- helpers for landmark builders ----------------
  ctx(l) {
    const g = new THREE.Group(), y = this.groundAt(l.x, l.z); g.position.set(l.x, y, l.z); g.rotation.y = l.rot; this.scene.add(g);
    const c = Math.cos(l.rot), s = Math.sin(l.rot);
    const W = (lx, lz) => ({ x: l.x + lx * c + lz * s, z: l.z - lx * s + lz * c });
    const self = this;
    return {
      g, y, W, b: new Builder(),
      circle(lx, lz, r, occ = 0) { const p = W(lx, lz); self.addCircle(p.x, p.z, r, occ); },
      box(lx, lz, hw, hd, rot = 0, occ = true) { const p = W(lx, lz); self.addBox(p.x, p.z, hw, hd, l.rot + rot, occ); },
      jack(lx, lz, yaw = 0, s = 0.32) { const p = W(lx, lz); self.jacks.push({ x: p.x, z: p.z, yaw: l.rot + yaw, s }); },
      pumpkin(lx, lz, s = 0.3) { const p = W(lx, lz); self.pumpkins.push({ x: p.x, z: p.z, yaw: Math.random() * TAU, s }); },
      light(lx, ly, lz, color, size, inten, dist = 10, flick = 0.3) { const p = W(lx, lz); const wy = self.groundAt(p.x, p.z) + ly; self.glow.add(p.x, wy, p.z, color, size, flick); if (inten) self.lights.add(p.x, wy, p.z, color, inten, dist, flick * 0.6); },
      kid(lx, lz, yaw) { const p = W(lx, lz); l.kidPos = { x: p.x, z: p.z, yaw: l.rot + yaw, lx, lz }; },
      finish() { const m = this.b.build(); g.add(m); return m; },
    };
  },
  buildLandmarks() {
    for (const l of this.landmarks) { const C = this.ctx(l); this[l.build](C, l); C.finish(); }
    // kids + their lanterns
    this.kids = [];
    this.landmarks.forEach((l) => {
      const kp = l.kidPos, c = makeKid(l.kid);
      const y = this.surfaceY(kp.x, kp.z) + (l.id === 'bridge' ? 0 : 0);
      c.root.position.set(kp.x, y, kp.z); c.root.rotation.y = kp.yaw; c.baseY = y; this.scene.add(c.root);
      const lan = makeLantern(); const lx = kp.x + Math.cos(kp.yaw) * 0.7, lz = kp.z - Math.sin(kp.yaw) * 0.7;
      lan.position.set(lx, this.surfaceY(lx, lz), lz); this.scene.add(lan);
      this.glow.add(lx, lan.position.y + 0.2, lz, 0xffb050, 0.9, 0.3);
      const src = this.lights.add(lx, lan.position.y + 0.45, lz, 0xffa94d, 3.5, 10, 0.25);
      const kid = { c, l, home: { x: kp.x, y, z: kp.z, yaw: kp.yaw }, saved: false, lantern: lan, src, anim: 'scared', poof: 0, idx: KID_TYPES.findIndex((t) => t.id === l.kid) };
      this.kids.push(kid);
      this.addCircle(kp.x, kp.z, 0.3);
      this.interact.push({ kind: 'kid', ref: kid, get pos() { return kid.c.root.position; }, r: 2.6, enabled: () => !kid.saved, label: () => `Free the ${kid.c.def.name} kid` });
    });
    this.kids.sort((a, b) => a.idx - b.idx);
  },

  buildSwing(C) {
    const b = C.b, rust = 0x6e3d24, rust2 = 0x5a3020;
    [-2.1, 2.1].forEach((x) => { b.rod(0.06, [x, 0, -1.1], [x, 2.6, 0], rust, 'metal'); b.rod(0.06, [x, 0, 1.1], [x, 2.6, 0], rust, 'metal'); C.circle(x, -1.0, 0.15); C.circle(x, 1.0, 0.15); });
    b.rod(0.07, [-2.2, 2.6, 0], [2.2, 2.6, 0], rust2, 'metal');
    [-0.9, 0.9].forEach((x, i) => {
      const sw = new THREE.Group(); sw.position.set(x, 2.58, 0); C.g.add(sw);
      const sb = new Builder(); sb.box(0.02, 2.0, 0.02, -0.24, -1.0, 0, 0x555555, 'metal'); sb.box(0.02, 2.0, 0.02, 0.24, -1.0, 0, 0x555555, 'metal'); sb.box(0.56, 0.05, 0.24, 0, -2.0, 0, 0x3a2a22, 'wood');
      sw.add(sb.build()); this.swings.push({ g: sw, ph: i * 1.7, amp: i ? 0.35 : 0.12 });
    });
    // slide
    b.box(0.9, 0.06, 0.9, 3.8, 1.6, 2.6, rust, 'metal'); [[3.4, 2.2], [4.2, 2.2], [3.4, 3.0], [4.2, 3.0]].forEach(([x, z]) => b.rod(0.04, [x, 0, z], [x, 1.6, z], rust2, 'metal'));
    b.add(unitBox(), 'metal', 0x8a5a2a, 3.8, 0.85, 4.15, -0.78, 0, 0, 0.7, 0.05, 2.4);
    for (let i = 0; i < 6; i++) b.box(0.8, 0.04, 0.04, 3.8, 0.25 + i * 0.25, 2.12, rust2, 'metal');
    C.box(3.8, 3.2, 0.6, 1.4);
    // sandbox
    b.box(2.8, 0.25, 0.15, -3.2, 0.12, 3.2, 0x4a3524, 'wood'); b.box(2.8, 0.25, 0.15, -3.2, 0.12, 5.8, 0x4a3524, 'wood'); b.box(0.15, 0.25, 2.6, -4.6, 0.12, 4.5, 0x4a3524, 'wood'); b.box(0.15, 0.25, 2.6, -1.8, 0.12, 4.5, 0x4a3524, 'wood');
    b.box(2.6, 0.1, 2.5, -3.2, 0.05, 4.5, 0x6a5a40, 'plain');
    b.box(0.3, 0.3, 0.3, -3.6, 0.2, 4.2, 0xc0262b, 'plain'); // abandoned bucket
    C.kid(0.4, 1.9, 0.2);
    C.jack(-2.6, 1.6, 0.3); C.jack(2.8, -1.5, -0.4, 0.28);
  },
  buildGrave(C) {
    const b = C.b, st = 0x5d5f5c, st2 = 0x4a4c4a, W = 8, Dp = 7;
    const wall = (x, z, len, rot) => { b.box(len, 0.8, 0.45, x, 0.4, z, st2, 'stone', rot); b.box(len, 0.1, 0.55, x, 0.85, z, st, 'stone', rot); C.box(x, z, rot ? 0.25 : len / 2, rot ? len / 2 : 0.25, 0, false); };
    wall(0, -Dp, W * 2, 0); wall(-W, 0, 0, 0); b.box(0.45, 0.8, Dp * 2, -W, 0.4, 0, st2, 'stone'); b.box(0.45, 0.8, Dp * 2, W, 0.4, 0, st2, 'stone');
    C.box(-W, 0, 0.25, Dp, 0, false); C.box(W, 0, 0.25, Dp, 0, false);
    b.box(W - 1.5, 0.8, 0.45, -W / 2 - 0.75, 0.4, Dp, st2, 'stone'); b.box(W - 1.5, 0.8, 0.45, W / 2 + 0.75, 0.4, Dp, st2, 'stone');
    C.box(-W / 2 - 0.75, Dp, (W - 1.5) / 2, 0.25, 0, false); C.box(W / 2 + 0.75, Dp, (W - 1.5) / 2, 0.25, 0, false);
    // gate posts and iron gate (left open)
    [-2.3, 2.3].forEach((x) => { b.box(0.5, 1.6, 0.5, x, 0.8, Dp, st, 'stone'); b.box(0.6, 0.15, 0.6, x, 1.65, Dp, st2, 'stone'); });
    for (let i = 0; i < 7; i++) b.box(0.04, 1.4, 0.04, -2.0 + i * 0.12, 0.7, Dp + 0.3 + i * 0.12, 0x1a1a1a, 'metal');
    // headstones
    for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) {
      const x = -5.5 + k * 2.7 + srnd(-0.4, 0.4), z = -4.5 + r * 3.2 + srnd(-0.3, 0.3); if (Math.abs(x) < 1.2 && r === 2) continue;
      const tilt = srnd(-0.15, 0.15), tp = srand();
      if (tp < 0.55) { b.box(0.8, 1.0, 0.18, x, 0.5, z, st, 'stone', 0, tilt); b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.18, 12, 1, false, 0, Math.PI), 'stone', st, x, 1.0, z, Math.PI / 2, 0, tilt + Math.PI / 2); }
      else if (tp < 0.8) { b.box(0.15, 1.3, 0.15, x, 0.65, z, st2, 'stone', 0, tilt); b.box(0.7, 0.15, 0.15, x, 0.95, z, st2, 'stone', 0, tilt); }
      else { b.box(0.9, 0.5, 0.5, x, 0.25, z, st2, 'stone'); b.box(0.7, 0.3, 0.3, x, 0.65, z, st, 'stone'); }
      b.box(0.9, 0.05, 1.6, x, 0.03, z + 1.0, 0x2a2620, 'plain');
      C.circle(x, z, 0.45);
    }
    // crypt at the back
    b.box(3.4, 2.6, 3.0, 4.5, 1.3, -4.6, st2, 'stone'); b.box(3.8, 0.3, 3.4, 4.5, 2.7, -4.6, st, 'stone');
    b.add(new THREE.CylinderGeometry(1.9, 1.9, 3.4, 3), 'stone', st, 4.5, 3.35, -4.6, 0, 0, Math.PI / 2, 1, 0.45, 1);
    b.box(1.2, 1.9, 0.1, 4.5, 0.95, -3.07, 0x0a0a0a, 'plain'); C.box(4.5, -4.6, 1.8, 1.6);
    instancedTrees(C.g, [{ kind: 'dead', variant: 1, x: -5.2, y: 0, z: -5.5, s: 0.9, ry: 0.4 }]); C.circle(-5.2, -5.5, 0.4, 0.4);
    C.kid(1.2, 1.4, 0.4);
    C.jack(-2.9, Dp + 0.8, 0, 0.3); C.jack(2.9, Dp + 0.8, 0, 0.3); C.jack(-0.5, -3.4, 0.2, 0.26);
    C.light(4.5, 1.2, -2.9, 0x8aff9a, 0.5, 0, 0, 0.6); // eerie candle at the crypt door
  },
  buildScare(C) {
    const b = C.b;
    // scarecrow
    b.box(0.16, 2.8, 0.16, 0, 1.4, 0, 0x4a3524, 'wood'); b.box(2.2, 0.14, 0.14, 0, 2.0, 0, 0x4a3524, 'wood');
    b.box(0.62, 0.8, 0.34, 0, 1.75, 0, 0x7a2f2a, 'plain'); b.box(0.64, 0.12, 0.36, 0, 1.4, 0, 0x3a2a1a, 'plain');
    [-1, 1].forEach((s) => { b.box(0.7, 0.2, 0.2, s * 0.62, 2.0, 0, 0x6a2a26, 'plain'); b.box(0.18, 0.25, 0.1, s * 1.05, 1.88, 0, 0xc9a85a, 'plain', 0, 0, s * 0.4); });
    b.box(0.2, 0.7, 0.2, -0.16, 1.0, 0, 0x2c3a5a, 'plain'); b.box(0.2, 0.7, 0.2, 0.16, 1.0, 0, 0x2c3a5a, 'plain');
    C.circle(0, 0, 0.35, 0.3);
    const sack = faceCanvas('#b89a64', (P) => { P(3, 5, 3, 3, '#1a120a'); P(10, 5, 3, 3, '#1a120a'); for (let x = 3; x < 13; x += 2) { P(x, 11, 1, 2, '#1a120a'); } P(3, 11, 10, 1, '#1a120a'); P(7, 8, 2, 1, '#5a3a1a'); });
    const head = new THREE.Mesh(unitBox(), [lam(0xb89a64), lam(0xb89a64), lam(0xb89a64), lam(0xb89a64), lam(0xffffff, { map: texFrom(sack, { nearest: true }) }), lam(0xb89a64)]);
    head.scale.set(0.5, 0.5, 0.5); head.position.set(0, 2.45, 0); head.rotation.z = 0.15; head.castShadow = true; C.g.add(head);
    const hb = new Builder(); hb.cyl(0.5, 0.5, 0.04, 0, 2.72, 0, 0x5a4422, 'plain', 14, 0, 0, 0.15); hb.cyl(0.22, 0.26, 0.35, 0.03, 2.9, 0, 0x5a4422, 'plain', 10, 0, 0, 0.15); C.g.add(hb.build());
    // crows
    [[-1.0, 2.12], [1.0, 2.12]].forEach(([x, y], i) => { b.box(0.14, 0.14, 0.26, x, y, 0, 0x0c0c0e, 'plain', i * 0.8); b.box(0.08, 0.08, 0.1, x, y + 0.1, 0.12, 0x0c0c0e, 'plain'); b.box(0.04, 0.03, 0.08, x, y + 0.09, 0.2, 0xd9a521, 'plain'); });
    // split-rail fence around the field
    for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU; if (Math.abs(angDiff(a, Math.PI / 2)) < 0.35 || Math.abs(angDiff(a, -Math.PI / 2)) < 0.3) continue; const r = 14.5, x = Math.cos(a) * r, z = Math.sin(a) * r; b.box(0.15, 1.2, 0.15, x, 0.6, z, 0x4a3524, 'wood'); const a2 = ((i + 1) / 22) * TAU, x2 = Math.cos(a2) * r, z2 = Math.sin(a2) * r; b.rod(0.05, [x, 0.9, z], [x2, 0.9, z2], 0x5a4430, 'wood', 4); b.rod(0.05, [x, 0.5, z], [x2, 0.5, z2], 0x5a4430, 'wood', 4); }
    // corn rows (instanced later)
    this.corn = this.corn || [];
    for (let x = -13; x <= 13; x += 1.3) for (let z = -13; z <= 13; z += 1.1) {
      const r = Math.hypot(x, z); if (r > 13.2 || r < 4.8 || Math.abs(x) < 1.6) continue;
      const p = C.W(x + srnd(-0.3, 0.3), z + srnd(-0.3, 0.3)); if (this.pathDist(p.x, p.z) < 1.8) continue; this.corn.push({ x: p.x, z: p.z, s: srnd(0.85, 1.25), r: srnd(0, TAU) });
    }
    C.kid(1.5, 1.6, 0.3);
    C.jack(1.2, -1.2, 0.5, 0.3); C.jack(-1.4, 2.2, -0.4, 0.3);
  },
  buildCamp(C) {
    const b = C.b;
    const tent = (x, z, ry, col, sag) => {
      [-1, 1].forEach((s) => b.box(0.05, 2.0, 2.6, x + s * 0.65 * Math.cos(ry), 0.85 - sag * 0.3, z - s * 0.65 * Math.sin(ry), col, 'plain', ry, 0, s * (0.62 + sag)));
      b.box(0.08, 0.08, 2.7, x, 1.62 - sag, z, 0x3a3a3a, 'metal', ry); C.box(x, z, 1.1, 1.4, ry);
    };
    tent(-2.5, -1.5, 0.3, 0x8a4a1f, 0); tent(2.8, -2.4, -0.4, 0x3d5a32, 0.5);
    b.box(1.0, 0.04, 1.2, -2.8, 0.03, 0.8, 0x2e4a6a, 'plain', 0.3); // sleeping bag sticking out
    // fire ring
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; b.add(rockGeo(i % 2), 'stone', 0x55524c, Math.cos(a) * 1.0, 0.1, 2.5 + Math.sin(a) * 1.0, 0, a, 0, 0.28, 0.32, 0.28, false); }
    b.rod(0.09, [-0.6, 0.1, 2.3], [0.6, 0.15, 2.7], 0x1a1614, 'wood'); b.rod(0.09, [0.5, 0.1, 2.0], [-0.4, 0.2, 2.9], 0x1a1614, 'wood');
    C.circle(0, 2.5, 1.0);
    // log benches
    [[0, 5.0, 0], [-3.2, 3.0, 1.2], [3.3, 3.2, -1.1]].forEach(([x, z, ry]) => { b.cyl(0.25, 0.25, 2.0, x, 0.25, z, 0x4a3524, 'wood', 8, 0, ry, Math.PI / 2); C.box(x, z, 1.0, 0.3, ry, false); });
    // cooler, backpack, sign
    b.box(0.7, 0.45, 0.45, 2.2, 0.23, 0.6, 0x2b6cb0, 'plain', 0.4); b.box(0.72, 0.08, 0.47, 2.2, 0.48, 0.6, 0xeeeeee, 'plain', 0.4); C.circle(2.2, 0.6, 0.4);
    b.box(0.4, 0.5, 0.25, -1.2, 0.25, 4.1, 0x7a2a2a, 'plain', 0.8);
    b.box(0.12, 2.2, 0.12, 4.5, 1.1, 4.5, 0x4a3524, 'wood'); b.box(1.6, 0.6, 0.06, 4.5, 1.9, 4.5, 0x6a5038, 'wood');
    this.signs.push({ g: C.g, x: 4.5, y: 1.9, z: 4.54, w: 1.5, h: 0.55, text: ['CAMP', 'LAST CHANCE'], color: '#e8d8b0', bg: '#4a3626' });
    C.circle(4.5, 4.5, 0.15);
    b.box(0.08, 2.4, 0.08, -4.2, 1.2, -0.2, 0x3a3a3a, 'metal'); // dead lantern pole
    C.kid(-0.6, -2.4, 0.2);
    C.jack(1.6, 4.2, -0.3); C.jack(-4.0, 2.2, 1.0, 0.28);
  },
  buildTower(C) {
    const b = C.b, rust = 0x5a4232, tankC = 0x3d5a5a;
    const legs = [[-1.9, -1.9], [1.9, -1.9], [1.9, 1.9], [-1.9, 1.9]];
    legs.forEach(([x, z]) => { b.rod(0.14, [x, 0, z], [x * 0.75, 9.2, z * 0.75], rust, 'metal'); C.circle(x, z, 0.25, 0.2); });
    for (let i = 0; i < 4; i++) { const a = legs[i], c2 = legs[(i + 1) % 4]; [[0.6, 4.4], [4.4, 8.6]].forEach(([y0, y1]) => { const k0 = 1 - y0 / 9.2 * 0.25, k1 = 1 - y1 / 9.2 * 0.25; b.rod(0.05, [a[0] * k0, y0, a[1] * k0], [c2[0] * k1, y1, c2[1] * k1], rust, 'metal', 4); b.rod(0.05, [c2[0] * k0, y0, c2[1] * k0], [a[0] * k1, y1, a[1] * k1], rust, 'metal', 4); }); }
    b.cyl(2.6, 2.6, 3.4, 0, 11.0, 0, tankC, 'metal', 16); b.add(new THREE.ConeGeometry(2.75, 1.4, 16), 'metal', 0x2f4444, 0, 13.4, 0);
    b.cyl(3.0, 3.0, 0.1, 0, 9.3, 0, rust, 'metal', 16);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; b.box(0.04, 0.9, 0.04, Math.cos(a) * 2.95, 9.75, Math.sin(a) * 2.95, rust, 'metal'); }
    b.rod(0.04, [1.6, 0, 2.3], [1.4, 9.3, 2.3], 0x3a3a3a, 'metal', 4); b.rod(0.04, [2.1, 0, 2.3], [1.9, 9.3, 2.3], 0x3a3a3a, 'metal', 4);
    for (let y = 0.4; y < 9.2; y += 0.45) b.box(0.55, 0.035, 0.035, 1.75, y, 2.3, 0x3a3a3a, 'metal');
    this.signs.push({ g: C.g, x: 0, y: 11.0, z: 2.62, w: 3.2, h: 1.0, text: ['JOURY', 'ISLAND'], color: '#c0262b', bg: null, font: 'bold' });
    C.light(0, 14.2, 0, 0xff2a20, 1.4, 0, 0, 0.9);
    this.towerLight = this.glow.n - 1;
    b.box(0.6, 0.5, 0.6, -0.6, 0.25, 2.6, 0x3a3a3a, 'metal'); // toolbox
    C.kid(0.2, 2.4, 0.1);
    C.jack(-1.5, 3.0, 0.4); C.jack(2.6, -2.8, -0.2, 0.28);
  },
  buildBus(C) {
    const b = C.b, yel = 0xc99a1e, blk = 0x161616, glassC = 0x0c1418;
    const g = new THREE.Group(); g.rotation.z = 0.05; g.position.y = -0.1; C.g.add(g);
    const bb = new Builder();
    bb.box(8.6, 2.2, 2.4, 0, 1.55, 0, yel, 'metal'); bb.box(8.4, 0.25, 2.3, 0, 2.75, 0, 0xb88d1c, 'metal');
    bb.box(1.6, 1.2, 2.3, 4.9, 1.0, 0, yel, 'metal'); bb.box(0.1, 0.4, 1.6, 5.7, 0.9, 0, 0x2a2a2a, 'metal');
    [-1, 1].forEach((s) => { bb.box(8.62, 0.12, 0.02, 0, 1.15, s * 1.205, blk, 'metal'); bb.box(8.62, 0.12, 0.02, 0, 1.45, s * 1.205, blk, 'metal');
      for (let i = 0; i < 7; i++) { if (s > 0 && i === 6) continue; bb.box(0.9, 0.7, 0.04, -3.6 + i * 1.08, 2.2, s * 1.2, glassC, 'glass'); } });
    bb.box(0.04, 0.8, 2.0, 4.31, 2.15, 0, glassC, 'glass'); bb.box(0.04, 0.9, 2.0, -4.31, 2.0, 0, glassC, 'glass');
    bb.box(0.7, 1.9, 0.06, 3.15, 1.4, 1.22, 0x050505, 'plain'); // open door
    bb.box(0.06, 1.8, 0.7, 3.5, 1.4, 1.55, yel, 'metal', 0.9);
    [[-2.9, 1], [-2.9, -1], [3.4, 1], [3.4, -1]].forEach(([x, s]) => bb.cyl(0.5, 0.5, 0.35, x, 0.42, s * 1.15, 0x111111, 'plain', 10, Math.PI / 2));
    bb.box(1.2, 0.7, 0.06, -1.5, 2.3, 1.24, 0x6a3a1a, 'metal'); bb.box(0.8, 0.5, 0.06, 1.8, 1.6, -1.24, 0x6a3a1a, 'metal'); bb.box(0.9, 0.12, 0.06, 0.4, 0.75, 1.23, 0x5a3218, 'metal');
    bb.box(0.06, 0.45, 0.45, -2.2, 1.8, 1.45, 0xb81d1d, 'metal');
    g.add(bb.build());
    this.signs.push({ g, x: 0, y: 2.62, z: 1.225, w: 3.6, h: 0.32, text: ['SCHOOL BUS'], color: '#111', bg: null });
    C.box(0.3, 0, 4.6, 1.3, 0);
    C.light(-4.3, 1.0, 0.8, 0x9ad0ff, 0.25, 0, 0, 0.8);
    C.kid(3.2, 2.3, 0.1);
    C.jack(-3.5, 2.2, 0.2); C.jack(5.8, 1.8, -0.6, 0.27);
  },
  buildWell(C) {
    const b = C.b;
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 12; i++) { const a = (i / 12 + ring * 0.04) * TAU; b.box(0.62, 0.32, 0.36, Math.cos(a) * 1.1, 0.16 + ring * 0.32, Math.sin(a) * 1.1, ring % 2 ? 0x5a5c58 : 0x4c4e4a, 'stone', -a + Math.PI / 2); }
    b.cyl(0.95, 0.95, 0.05, 0, 0.6, 0, 0x020304, 'plain', 16);
    [-1.2, 1.2].forEach((x) => b.box(0.16, 2.4, 0.16, x, 1.2, 0, 0x3e2c1e, 'wood'));
    b.box(2.6, 0.12, 0.12, 0, 2.35, 0, 0x3e2c1e, 'wood');
    [-1, 1].forEach((s) => b.box(2.9, 0.06, 1.0, 0, 2.6, s * 0.38, 0x3a2418, 'wood', 0, s * 0.62));
    b.cyl(0.1, 0.1, 2.0, 0, 1.8, 0, 0x4a3524, 'wood', 6, 0, 0, Math.PI / 2); b.box(0.04, 0.9, 0.04, 0, 1.3, 0, 0x8a7a5a, 'plain');
    b.cyl(0.16, 0.13, 0.25, 0, 0.75, 0, 0x55493a, 'wood', 8);
    C.circle(0, 0, 1.45, 0.6);
    b.box(0.4, 0.35, 0.4, 2.2, 0.17, -1.2, 0x2a2a2a, 'metal'); // cauldron-ish bucket
    C.kid(1.8, 1.0, 0.6);
    C.jack(-1.8, 1.4, 0.5); C.jack(1.6, -1.8, -0.5, 0.28);
  },
  buildPatch(C) {
    const b = C.b;
    for (let i = 0; i < 46; i++) { const a = srnd(0, TAU), r = Math.sqrt(srand()) * 11; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x, z - 1.5) < 2.2) continue; const p = C.W(x, z); if (this.pathDist(p.x, p.z) < 1.6) continue; if (i % 7 === 0) C.jack(x, z, srnd(-1, 1), srnd(0.28, 0.36)); else C.pumpkin(x, z, srnd(0.2, 0.42)); }
    for (let i = 0; i < 26; i++) { const a = srnd(0, TAU), r = srnd(1.5, 11); b.box(srnd(0.8, 2), 0.04, 0.06, Math.cos(a) * r, 0.03, Math.sin(a) * r, 0x2f5a22, 'plain', srnd(0, TAU)); }
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; if (Math.abs(angDiff(a, Math.PI / 2)) < 0.3 || Math.abs(angDiff(a, -Math.PI / 2)) < 0.3) continue; const r = 12.5, x = Math.cos(a) * r, z = Math.sin(a) * r, a2 = ((i + 1) / 18) * TAU; b.box(0.14, 1.1, 0.14, x, 0.55, z, 0x5a4430, 'wood'); b.rod(0.05, [x, 0.8, z], [Math.cos(a2) * r, 0.8, Math.sin(a2) * r], 0x6a5038, 'wood', 4); }
    [[-3.5, -5.5], [4.5, -4.5], [-6, 2]].forEach(([x, z], i) => { b.box(1.1, 0.55, 0.6, x, 0.28, z, 0xb89a4a, 'plain', i); C.box(x, z, 0.6, 0.35, i, false); });
    b.box(0.12, 1.6, 0.12, -2.2, 0.8, 9.6, 0x4a3524, 'wood'); b.box(1.8, 0.7, 0.06, -2.2, 1.4, 9.6, 0x6a5038, 'wood'); C.circle(-2.2, 9.6, 0.15);
    this.signs.push({ g: C.g, x: -2.2, y: 1.4, z: 9.64, w: 1.7, h: 0.6, text: ['PUMPKIN PATCH', 'pick your own'], color: '#ff9c3a', bg: '#3a2a1c' });
    b.box(0.9, 0.35, 0.6, 3.5, 0.45, 3.5, 0x3a5a6a, 'metal', 0.5); b.cyl(0.25, 0.25, 0.08, 3.9, 0.25, 3.0, 0x111111, 'plain', 10, Math.PI / 2, 0.5); C.circle(3.5, 3.5, 0.6);
    C.kid(0, 1.5, 0);
  },
  buildBridge(C) {
    // built in world space: the ravine runs east-west, the block bridge spans it north-south
    C.g.position.set(0, 0, 0); C.g.rotation.y = 0;
    const br = this.bridge, bx = RAVINE.bridgeX, y = br.y;
    const blockMat = fogify(new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.block }));
    const bb = new Builder(), red = 0xb3262b, blue = 0x2c5bd0;
    for (let z = Math.floor(br.z0); z < br.z1; z++) for (let x = 0; x < 2; x++) { const col = z < RAVINE.z ? red : blue, tint = new THREE.Color(col).multiplyScalar(0.85 + hash2(x, z, 3) * 0.3); bb.box(1, 1, 1, bx - 0.5 + x, y - 0.5, z + 0.5, tint, 'block'); }
    [[-91, red], [-69, blue]].forEach(([zc, col]) => { for (let x = -2; x < 2; x++) for (let z = -2; z < 2; z++) { const tint = new THREE.Color(col).multiplyScalar(0.8 + hash2(x, z, 9) * 0.3); bb.box(1, 1, 1, bx + x + 0.5, y - 0.5, zc + z + 0.5, tint, 'block'); bb.box(1, 1, 1, bx + x + 0.5, y - 1.5, zc + z + 0.5, tint.multiplyScalar(0.7), 'block'); } });
    // goal posts of the shrine: a little banner and broken controllers on poles
    bb.box(0.12, 2.6, 0.12, bx - 1.8, y + 1.3, -92.6, 0x2a2a2a, 'block'); bb.box(0.12, 2.6, 0.12, bx + 1.8, y + 1.3, -92.6, 0x2a2a2a, 'block');
    const m = bb.build({ mats: { block: blockMat } }); this.scene.add(m);
    this.signs.push({ g: this.scene, x: bx, y: y + 2.2, z: -92.55, w: 3.4, h: 0.8, text: ['NOT GG'], color: '#ffefe0', bg: '#9a1a1f', font: 'bold' });
    this.signs.push({ g: this.scene, x: bx, y: y + 1.0, z: -67.2, w: 1.6, h: 0.9, text: ['VIVEK 5', 'JOURY 4', '(RIGGED)'], color: '#e8e8e8', bg: '#202a44', rotY: Math.PI });
    const post = new Builder(); post.box(0.1, 1.6, 0.1, bx, y + 0.8, -67.2, 0x4a3524, 'wood'); this.scene.add(post.build());
    [[bx - 1.6, -89.4], [bx + 1.6, -89.4], [bx - 1.6, -70.6], [bx + 1.6, -70.6]].forEach(([x, z], i) => {
      const p = new Builder(); p.box(0.08, 1.3, 0.08, x, y + 0.65, z, 0x333333, 'metal'); this.scene.add(p.build());
      const ct = makeController(true); ct.position.set(x, y + 1.36, z); ct.rotation.set(0.3, i, 0.2); ct.scale.setScalar(1.6); this.scene.add(ct);
      this.addCircle(x, z, 0.12);
    });
    // rocks along the ravine rim
    for (let i = 0; i < 26; i++) { const s = srnd(0, 1), x = lerp(RAVINE.ax + 4, RAVINE.bx - 4, s), side = i % 2 ? 1 : -1, w = RAVINE.w * Math.sqrt(Math.sin(Math.PI * (x - RAVINE.ax) / (RAVINE.bx - RAVINE.ax))); if (Math.abs(x - bx) < 3) continue; this.rimRocks = this.rimRocks || []; this.rimRocks.push({ x, z: RAVINE.z + side * (w + srnd(0.5, 2.0)), s: srnd(0.6, 1.4) }); }
    this.glow.add(bx - 1.8, y + 2.7, -92.6, 0xff3030, 0.5, 0.5); this.glow.add(bx + 1.8, y + 2.7, -92.6, 0x3a70ff, 0.5, 0.5);
    this.lights.add(bx, y + 2, -91, 0xff5040, 5, 9, 0.4);
    C.kid(0.7, -11.5, 0); // relative to world group (identity): on the red platform
    const l = this.landmarks.find((q) => q.id === 'bridge'); l.kidPos = { x: bx + 0.7, z: -91.5, yaw: 0 };
  },
  buildFire(C) {
    const b = C.b;
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; b.add(rockGeo(i % 2), 'stone', 0x4c4a46, Math.cos(a) * 4.4, 0.3, Math.sin(a) * 4.4, srnd(0, 1), a, 0, 0.7, srnd(0.6, 1.0), 0.6, false); C.circle(Math.cos(a) * 4.4, Math.sin(a) * 4.4, 0.55, 0.3); }
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; b.rod(0.13, [Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6], [Math.cos(a) * 0.15, 3.2, Math.sin(a) * 0.15], i % 3 ? 0x141210 : 0x221c18, 'wood', 5); }
    b.cyl(2.2, 2.4, 0.08, 0, 0.04, 0, 0x2a2826, 'plain', 16);
    C.circle(0, 0, 1.7, 1.0);
    [[0, -6.4, 0], [5.6, 2.6, 1.1], [-5.6, 2.6, -1.1]].forEach(([x, z, r]) => { b.cyl(0.28, 0.28, 2.2, x, 0.28, z, 0x3a2a1e, 'wood', 8, 0, r, Math.PI / 2); C.box(x, z, 1.1, 0.3, r, false); });
    this.smokes.push(...[0, 1, 2].map((i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.mist, color: 0x555a60, transparent: true, opacity: 0.18, depthWrite: false })); const p = C.W(0, 0); s.position.set(p.x, C.y + 2 + i * 2, p.z); s.scale.set(3, 3, 1); this.scene.add(s); return { s, base: s.position.clone(), ph: i / 3 }; }));
    C.kid(1.5, 6.0, Math.PI);
    C.jack(-2.0, 6.2, Math.PI); C.jack(6.0, -1.2, -1.4, 0.28);
    C.light(0, 0.3, 0, 0xff4010, 0.9, 3, 6, 0.6); // last embers
  },

  buildCabin() {
    const cp = this.cabinPos, y = this.groundAt(cp.x, cp.z), g = new THREE.Group(); g.position.set(cp.x, y, cp.z); this.scene.add(g);
    const b = new Builder(), log = 0x4a3220, log2 = 0x3e2a1b, W = 4.6, Dp = 3.6, Hh = 3.2;
    for (let i = 0; i < 8; i++) {
      const yy = 0.2 + i * 0.4, c = i % 2 ? log : log2;
      b.cyl(0.21, 0.21, Dp * 2 + 0.5, -W, yy, 0, c, 'wood', 8, Math.PI / 2); b.cyl(0.21, 0.21, Dp * 2 + 0.5, W, yy, 0, c, 'wood', 8, Math.PI / 2);
      b.cyl(0.21, 0.21, W * 2 + 0.5, 0, yy, -Dp, c, 'wood', 8, 0, 0, Math.PI / 2);
      if (yy > 2.25) b.cyl(0.21, 0.21, W * 2 + 0.5, 0, yy, Dp, c, 'wood', 8, 0, 0, Math.PI / 2);
      else { b.cyl(0.21, 0.21, W - 0.7, -(W + 0.7) / 2, yy, Dp, c, 'wood', 8, 0, 0, Math.PI / 2); b.cyl(0.21, 0.21, W - 0.7, (W + 0.7) / 2, yy, Dp, c, 'wood', 8, 0, 0, Math.PI / 2); }
    }
    b.box(W * 2 - 0.2, 3.1, Dp * 2 - 0.2, 0, 1.55, 0, 0x1a120c, 'wood'); // inner fill (the cabin is solid from outside)
    b.box(1.3, 2.3, 0.12, 0, 1.15, Dp + 0.05, 0x2e1e12, 'wood'); b.box(0.12, 0.12, 0.1, 0.45, 1.15, Dp + 0.14, 0x999999, 'metal');
    [-1, 1].forEach((s) => b.add(unitBox(), 'wood', 0x2a1a10, s * (W + 0.6) / 2, Hh + 1.05, 0, 0, 0, s * -0.52, (W + 0.6) * 1.17, 0.18, Dp * 2 + 1.4));
    b.add(new THREE.CylinderGeometry(1, 1, 1, 3), 'wood', log2, 0, Hh + 0.62, Dp - 0.05, Math.PI / 2, 0, 0, W * 1.05, 0.2, 1.25);
    b.add(new THREE.CylinderGeometry(1, 1, 1, 3), 'wood', log2, 0, Hh + 0.62, -Dp + 0.05, Math.PI / 2, 0, 0, W * 1.05, 0.2, 1.25);
    b.box(1.0, 3.2, 1.0, -W + 1.2, Hh + 0.9, -1.2, 0x55524c, 'stone');
    // porch
    b.box(W * 2, 0.15, 2.2, 0, 0.12, Dp + 1.2, 0x5a4026, 'wood'); [-W + 0.3, W - 0.3].forEach((x) => b.box(0.18, 2.6, 0.18, x, 1.3, Dp + 2.15, log2, 'wood'));
    b.add(unitBox(), 'wood', 0x2a1a10, 0, 2.75, Dp + 1.3, 0.22, 0, 0, W * 2 + 0.3, 0.12, 2.4);
    // windows: one lit, one dark
    b.box(1.3, 1.1, 0.12, 2.6, 1.6, Dp + 0.08, 0x2a1a10, 'wood'); b.box(1.3, 1.1, 0.12, -W - 0.08, 1.6, 1.4, 0x2a1a10, 'wood', Math.PI / 2);
    const lit = new THREE.Mesh(unitBox(), MAT.windowLit); lit.scale.set(1.05, 0.85, 0.05); lit.position.set(2.6, 1.6, Dp + 0.15); g.add(lit);
    b.box(0.08, 0.9, 0.08, 2.6, 1.6, Dp + 0.2, 0x1a1008, 'wood'); b.box(1.1, 0.08, 0.08, 2.6, 1.6, Dp + 0.2, 0x1a1008, 'wood');
    const m = b.build(); g.add(m);
    this.signs.push({ g, x: -2.6, y: 1.7, z: Dp + 0.2, w: 1.5, h: 0.7, text: ['KEEP OUT', 'esp. VIVEK'], color: '#ff4a3a', bg: '#2a1a10' });
    const wy = y + 1.6;
    this.glow.add(cp.x + 2.6, wy, cp.z + Dp + 0.4, 0xffa040, 2.2, 0.15);
    this.lights.add(cp.x + 2.6, wy, cp.z + Dp + 1.2, 0xff9a40, 14, 14, 0.15);
    this.addBox(cp.x, cp.z, W + 0.2, Dp + 0.2, 0, true);
    [-W + 0.3, W - 0.3].forEach((x) => this.addCircle(cp.x + x, cp.z + Dp + 2.15, 0.15));
    this.cabin = { x: cp.x, z: cp.z, y, door: { x: cp.x, z: cp.z + Dp + 2.6 }, exitYaw: Math.PI };
    this.jacks.push({ x: cp.x - 1.4, z: cp.z + Dp + 1.5, yaw: 0, s: 0.3 }, { x: cp.x + 1.4, z: cp.z + Dp + 1.5, yaw: 0, s: 0.26 });
    this.chimney = new THREE.Vector3(cp.x - W + 1.2, y + Hh + 2.6, cp.z - 1.2);
    for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.mist, color: 0x6a6e74, transparent: true, opacity: 0.16, depthWrite: false })); s.scale.set(2.5, 2.5, 1); this.scene.add(s); this.smokes.push({ s, base: this.chimney.clone(), ph: i / 3 }); }
    this.interact.push({ kind: 'cabindoor', pos: new THREE.Vector3(cp.x, y + 1.2, cp.z + Dp + 0.4), r: 2.6, enabled: () => true, label: () => 'Joury\'s door' });
  },
  buildDock() {
    const sz = this.shoreZ, z0 = sz - 6, z1 = sz + 15, y = 0.88, g = new THREE.Group(); this.scene.add(g);
    const b = new Builder();
    for (let z = z0; z < z1; z += 0.32) b.box(3.2, 0.08, 0.28, 0, y - 0.04, z + 0.14, (Math.round(z * 3) % 3) ? 0x5a4026 : 0x4d3720, 'wood', srnd(-0.015, 0.015));
    for (let z = z0 + 1; z < z1; z += 3) [-1.5, 1.5].forEach((x) => b.cyl(0.13, 0.13, 3.4, x, y - 1.6, z, 0x3a2a1c, 'wood', 8));
    b.box(0.12, 2.4, 0.12, 1.75, y + 1.2, z0 + 1.2, 0x2a2a2a, 'metal'); b.box(0.7, 0.08, 0.08, 1.45, y + 2.35, z0 + 1.2, 0x2a2a2a, 'metal');
    b.box(0.1, 1.4, 0.1, -1.7, y + 0.7, z1 - 1.0, 0x4a3524, 'wood'); b.box(1.5, 0.7, 0.06, -1.7, y + 1.3, z1 - 1.0, 0x6a5038, 'wood', Math.PI / 2);
    g.add(b.build());
    this.signs.push({ g, x: -1.66, y: y + 1.3, z: z1 - 1.0, w: 1.4, h: 0.6, text: ['BOAT GOES HERE', 'hull · oars · engine · fuel'], color: '#e8d8b0', bg: '#3a2a1c', rotY: Math.PI / 2 });
    const lan = makeLantern(); lan.position.set(1.15, y + 1.85, z0 + 1.2); this.scene.add(lan);
    this.glow.add(1.15, y + 2.05, z0 + 1.2, 0xffc070, 1.0, 0.2);
    this.lights.add(1.15, y + 2.0, z0 + 1.2, 0xffb060, 10, 14, 0.2);
    this.dock = { x0: -1.6, x1: 1.6, z0: z0 - 0.5, z1, y, start: new THREE.Vector3(0, y, z1 - 3), boatSpot: new THREE.Vector3(2.9, 0.12, z1 - 4.5) };
    this.addCircle(1.75, z0 + 1.2, 0.12);
    // boat (parts appear as they are delivered)
    const boat = this.boat = makeBoat(); boat.position.copy(this.dock.boatSpot); this.scene.add(boat);
    this.updateBoat();
    this.interact.push({ kind: 'boat', pos: new THREE.Vector3(1.2, y + 0.6, z1 - 4.5), r: 3.2, enabled: () => Game.phase === 'boat', label: () => this.boatLabel() });
    this.kidSpots = [];
    for (let i = 0; i < 10; i++) { const a = -0.9 + (i / 9) * 1.8; this.kidSpots.push({ x: Math.sin(a) * 7.5, z: sz - 11 - Math.cos(a) * 2.5 + (i % 2) * 0.8, yaw: Math.PI + a * 0.6 }); }
    this.jacks.push({ x: -2.4, z: z0 - 0.5, yaw: 0, s: 0.3 }, { x: 2.4, z: z0 - 0.8, yaw: 0, s: 0.28 });
  },
  boatLabel() {
    const missing = PARTS.filter((p) => !this.partsDelivered.has(p.id));
    if (!missing.length) return 'Launch the boat and escape!';
    const have = PARTS.filter((p) => this.carried.has(p.id));
    if (have.length) return `Add ${have.map((p) => p.name).join(', ')} to the boat`;
    return 'Boat needs: ' + missing.map((p) => p.name).join(', ');
  },
  updateBoat() { const u = this.boat.userData, has = (k) => this.partsDelivered.has(k); u.frame.visible = true; u.hull.visible = has('hull'); u.oars.visible = has('oars'); u.engine.visible = has('engine'); u.fuel.visible = has('fuel'); },

  // ---------------- vegetation ----------------
  chunked(list, geoOf, mat, opts = {}) {
    // list items: {x,y,z,ry,s,sy?,col?, key}
    const groups = new Map();
    list.forEach((it) => { const k = (opts.keyOf ? opts.keyOf(it) : 'g') + '|' + Math.floor((it.x + 200) / 50) + ',' + Math.floor((it.z + 200) / 50); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
    const out = [];
    for (const [k, items] of groups) {
      const im = new THREE.InstancedMesh(geoOf(items[0]), mat, items.length);
      items.forEach((it, i) => { _pv.set(it.x, it.y, it.z); _e.set(0, it.ry, 0); _q.setFromEuler(_e); _sv.set(it.s, it.sy || it.s, it.s); _m4.compose(_pv, _q, _sv); im.setMatrixAt(i, _m4); if (it.col) im.setColorAt(i, it.col); });
      im.castShadow = opts.cast !== false; im.receiveShadow = true; im.computeBoundingSphere(); im.userData.full = items.length;
      let cx = 0, cz = 0; items.forEach((it) => { cx += it.x; cz += it.z; }); cx /= items.length; cz /= items.length; im.userData.center = new THREE.Vector3(cx, 0, cz); im.userData.radius = Math.max(...items.map((it) => Math.hypot(it.x - cx, it.z - cz))) + 6;
      this.scene.add(im); this.chunks.push(im); out.push(im);
    }
    return out;
  },
  buildTrees() {
    const trees = [], cell = new Map(), key = (x, z) => Math.floor(x / 3) * 10000 + Math.floor(z / 3);
    const tooClose = (x, z) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = cell.get(key(x + i * 3, z + j * 3)); if (l) for (const t of l) if ((t.x - x) ** 2 + (t.z - z) ** 2 < 9) return true; } return false; };
    const clearOf = (x, z) => {
      for (const l of this.landmarks) if (l.clear && Math.hypot(x - l.x, z - l.z) < l.clear) return false;
      if (Math.hypot(x - this.cabinPos.x, z - this.cabinPos.z) < 13) return false;
      if (Math.abs(x) < 9 && z > this.shoreZ - 22) return false;
      if (Math.hypot(x - RAVINE.bridgeX, z + 91) < 6 || Math.hypot(x - RAVINE.bridgeX, z + 69) < 6) return false;
      return true;
    };
    for (let i = 0; i < 5200 && trees.length < 950; i++) {
      const a = srnd(0, TAU), r = Math.sqrt(srand()) * 140, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = this.groundAt(x, z); if (h < 0.9) continue;
      if (this.pathDist(x, z) < 2.7) continue; if (ravineProfile(x, z) > 0.01) continue; if (!clearOf(x, z)) continue;
      if (fbm(x * 0.018 + 40, z * 0.018, 3, 13) < -0.32) continue;
      if (tooClose(x, z)) continue;
      const nz = fbm(x * 0.01 - 9, z * 0.01 + 2, 2, 8), u = srand();
      const kind = nz > 0.15 ? (u < 0.75 ? 'pine' : 'dead') : nz < -0.2 ? (u < 0.5 ? 'dead' : 'oak') : (u < 0.5 ? 'pine' : u < 0.75 ? 'oak' : 'dead');
      const variant = srand() < 0.5 ? 0 : 1, s = srnd(0.8, 1.45);
      const t = { x, z, y: h - 0.1, ry: srnd(0, TAU), s, kind: kind === 'oak' ? 'oak' : kind, variant: kind === 'oak' ? 0 : variant, col: new THREE.Color().setHSL(0, 0, srnd(0.8, 1.15)) };
      trees.push(t); const k = key(x, z); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(t);
      const trunkR = kind === 'pine' ? 0.32 : kind === 'dead' ? 0.34 : 0.38;
      this.addCircle(x, z, trunkR * s, kind === 'pine' ? 1.25 * s : kind === 'oak' ? 1.0 * s : 0.45 * s);
    }
    this.treeCount = trees.length;
    trees.forEach((t) => { t.col = new THREE.Color().setHSL(0.08, 0.15, srnd(0.55, 0.8)); });
    instancedTrees(this.scene, trees, { chunk: 50 }).forEach((m) => this.chunks.push(m));
    // forest floor clutter: bushes, stumps, fallen logs
    const clutter = [];
    const free = (x, z, pad) => this.groundAt(x, z) > 1.0 && this.pathDist(x, z) > pad && ravineProfile(x, z) < 0.01 && clearOf(x, z) && !tooClose(x, z);
    for (let i = 0; i < 6000 && clutter.length < 420; i++) {
      const a = srnd(0, TAU), r = Math.sqrt(srand()) * 138, x = Math.cos(a) * r, z = Math.sin(a) * r, u = srand();
      if (fbm(x * 0.018 + 40, z * 0.018, 3, 13) < -0.45) continue;
      if (u < 0.78) { if (!free(x, z, 1.8)) continue; clutter.push({ kind: 'bush', variant: 0, x, z, y: this.groundAt(x, z) - 0.05, ry: srnd(0, TAU), s: srnd(0.7, 1.5), col: new THREE.Color().setHSL(srnd(0.12, 0.25), 0.25, srnd(0.45, 0.8)) }); }
      else if (u < 0.9) { if (!free(x, z, 3)) continue; const s = srnd(0.8, 1.3); clutter.push({ kind: 'stump', variant: 0, x, z, y: this.groundAt(x, z), ry: srnd(0, TAU), s, col: new THREE.Color().setHSL(0.08, 0.15, srnd(0.5, 0.75)) }); this.addCircle(x, z, 0.4 * s, 0.3); }
      else { if (!free(x, z, 4)) continue; const v = srand() < 0.5 ? 0 : 1, ry = srnd(0, TAU), s = srnd(0.8, 1.2), L = (v ? 4.6 : 3.2) * s; clutter.push({ kind: 'log', variant: v, x, z, y: this.groundAt(x, z) - 0.08, ry, s, col: new THREE.Color().setHSL(0.08, 0.12, srnd(0.45, 0.7)) }); this.addBox(x, z, L / 2, 0.32 * s, ry, false); }
    }
    instancedTrees(this.scene, clutter, { chunk: 50 }).forEach((m) => this.chunks.push(m));
    // rocks
    const rocks = [];
    for (let i = 0; i < 700 && rocks.length < 170; i++) {
      const a = srnd(0, TAU), r = Math.sqrt(srand()) * 145, x = Math.cos(a) * r, z = Math.sin(a) * r, h = this.groundAt(x, z);
      if (h < -0.6 || this.pathDist(x, z) < 2.2 || ravineProfile(x, z) > 0.3 || !clearOf(x, z) || tooClose(x, z)) continue;
      const s = srnd(0.3, 1.3); rocks.push({ x, z, y: h - 0.15 * s, ry: srnd(0, TAU), s, sy: s * srnd(0.7, 1.3), v: srand() < 0.5 ? 0 : 1, col: new THREE.Color().setHSL(0.2, srnd(0, 0.12), srnd(0.5, 0.75)) });
      if (s > 0.7) this.addCircle(x, z, s * 0.85, s * 0.5);
    }
    (this.rimRocks || []).forEach((q) => rocks.push({ x: q.x, z: q.z, y: this.groundAt(q.x, q.z) - 0.2, ry: srnd(0, TAU), s: q.s, v: 1, col: new THREE.Color().setHSL(0.1, 0.05, 0.55) }));
    this.chunked(rocks, (it) => rockGeo(it.v), MAT.rock, { keyOf: (it) => 'r' + it.v });
    // corn
    if (this.corn && this.corn.length) {
      const cg = crossedQuads(1.1, 2.3, 2);
      const items = this.corn.map((c) => ({ x: c.x, z: c.z, y: this.groundAt(c.x, c.z) - 0.05, ry: c.r, s: c.s, col: new THREE.Color().setHSL(0.12, 0.3, srnd(0.6, 0.95)) }));
      this.chunked(items, () => cg, MAT.corn, { cast: true });
    }
  },
  buildGrass() {
    const tuft = crossedQuads(1.0, 0.62, 3), items = [];
    for (let i = 0; i < 22000 && items.length < 7000; i++) {
      const a = srnd(0, TAU), r = Math.sqrt(srand()) * 140, x = Math.cos(a) * r, z = Math.sin(a) * r, h = this.groundAt(x, z);
      if (h < 0.7 || this.pathDist(x, z) < 1.3 || ravineProfile(x, z) > 0.05) continue;
      if (fbm(x * 0.04, z * 0.04, 2, 77) < -0.25) continue;
      items.push({ x, z, y: h - 0.05, ry: srnd(0, TAU), s: srnd(0.6, 1.3), col: new THREE.Color().setHSL(srnd(0.13, 0.24), srnd(0.2, 0.4), srnd(0.4, 0.75)) });
    }
    this.grass = this.chunked(items, () => tuft, MAT.grass, { cast: false });
    this.applyGrassDensity();
  },
  applyGrassDensity() { const f = Q().grassFrac; (this.grass || []).forEach((m) => { m.count = Math.max(1, Math.floor(m.userData.full * f)); }); },
  buildJacks() {
    // along the paths
    this.paths.forEach((pts, pi) => {
      let acc = srnd(0, 15);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z); acc += len;
        if (acc > 24) {
          acc = srnd(-6, 0); if (srand() < 0.35) continue;
          const side = srand() < 0.5 ? -1 : 1, nx = -(b.z - a.z) / len * side, nz = (b.x - a.x) / len * side, x = a.x + nx * 2.3, z = a.z + nz * 2.3;
          if (this.groundAt(x, z) < 0.6 || ravineProfile(x, z) > 0.05 || this.onBridge(x, z)) continue;
          this.jacks.push({ x, z, yaw: Math.atan2(-nx, -nz), s: srnd(0.26, 0.34) });
        }
      }
    });
    const all = this.jacks.map((j) => ({ ...j, carved: true })).concat(this.pumpkins.map((p) => ({ ...p, carved: false })));
    const pg = pumpkinGeo(true), body = new THREE.InstancedMesh(pg, MAT.pumpkin, all.length);
    const faceGeo = new THREE.PlaneGeometry(1.25, 1.25), faceMat = MAT.jackFace; faceMat.map = jackFaceTex(); faceMat.needsUpdate = true;
    const faces = new THREE.InstancedMesh(faceGeo, faceMat, this.jacks.length);
    let fi = 0;
    all.forEach((j, i) => {
      j.y = this.surfaceY(j.x, j.z) + j.s * 0.62;
      _pv.set(j.x, j.y, j.z); _e.set(0, j.yaw, 0); _q.setFromEuler(_e); _sv.set(j.s, j.s, j.s); _m4.compose(_pv, _q, _sv); body.setMatrixAt(i, _m4);
      body.setColorAt(i, new THREE.Color().setHSL(0, 0, j.carved ? 1.0 : srnd(0.75, 1.05)));
      if (j.carved) {
        const fx = j.x + Math.sin(j.yaw) * j.s * 0.95, fz = j.z + Math.cos(j.yaw) * j.s * 0.95;
        _pv.set(fx, j.y + j.s * 0.05, fz); _sv.set(j.s, j.s * 0.85, j.s); _m4.compose(_pv, _q, _sv); faces.setMatrixAt(fi++, _m4);
        this.glow.add(fx + Math.sin(j.yaw) * 0.1, j.y, fz + Math.cos(j.yaw) * 0.1, 0xff8a1a, j.s * 3.2, 0.55);
        this.lights.add(fx + Math.sin(j.yaw) * 0.35, j.y + 0.2, fz + Math.cos(j.yaw) * 0.35, 0xff7a20, 4.5, 8, 0.45);
      }
    });
    body.castShadow = true; body.receiveShadow = true; body.computeBoundingSphere(); this.scene.add(body);
    faces.computeBoundingSphere(); faces.renderOrder = 2; this.scene.add(faces);
    this.jackCount = this.jacks.length;
  },
  buildAtmosphere() {
    // fireflies around meadows, paths and landmarks
    const pts = [];
    for (let i = 0; i < 3000 && pts.length < 420; i++) {
      const a = srnd(0, TAU), r = Math.sqrt(srand()) * 135, x = Math.cos(a) * r, z = Math.sin(a) * r, h = this.groundAt(x, z);
      if (h < 0.8 || this.pathDist(x, z) > 14) continue; pts.push(new THREE.Vector3(x, h + srnd(0.6, 2.8), z));
    }
    this.fireflyAll = pts;
    this.fireflies = makeFireflies(pts); this.scene.add(this.fireflies); this.applyFireflies();
    // drifting mist puffs that follow the player around
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.mist, color: 0x7d8896, transparent: true, opacity: srnd(0.05, 0.11), depthWrite: false }));
      const k = srnd(7, 14); s.scale.set(k * 1.8, k * 0.55, 1); s.position.set(srnd(-30, 30), 0, srnd(-30, 30)); s.userData.v = new THREE.Vector2(srnd(-0.4, 0.4), srnd(-0.4, 0.4)); this.scene.add(s); this.mist.push(s);
    }
    // painted signs
    this.makeSigns();
  },
  applyFireflies() { if (this.fireflies) this.fireflies.geometry.setDrawRange(0, Math.floor(this.fireflyAll.length * Q().fireflyFrac)); },
  makeSigns() {
    (this.signs || []).forEach((s) => {
      const cw = 256, ch = Math.max(64, Math.round(256 * s.h / s.w)), c = makeCanvas(cw, ch), g = c.getContext('2d');
      if (s.bg) { g.fillStyle = s.bg; g.fillRect(0, 0, cw, ch); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 4; g.strokeRect(2, 2, cw - 4, ch - 4); }
      g.fillStyle = s.color; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lines = s.text, fs = Math.min(ch / (lines.length + 0.4), cw / (Math.max(...lines.map((l) => l.length)) * 0.62));
      lines.forEach((l, i) => { g.font = `${i && !s.font ? 'italic ' : ''}${s.font === 'bold' || i === 0 ? 'bold ' : ''}${Math.floor(fs * (i ? 0.78 : 1))}px Impact, "Arial Black", sans-serif`; g.fillText(l, cw / 2 + rand(-2, 2), ch / 2 + (i - (lines.length - 1) / 2) * fs * 1.0); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), lam(0xffffff, { map: texFrom(c), transparent: !s.bg, alphaTest: s.bg ? 0 : 0.3 }));
      m.position.set(s.x, s.y, s.z); if (s.rotY) m.rotation.y = s.rotY; s.g.add(m);
    });
  },
  findSpots() {
    // candidate spots for batteries and boat parts: near paths, on open ground
    const spots = [];
    for (let i = 0; i < 6000 && spots.length < 160; i++) {
      const a = srnd(0, TAU), r = Math.sqrt(srand()) * 128, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const pd = this.pathDist(x, z); if (pd > 9 || pd < 1.6) continue; if (!this.walkable(x, z) || this.groundAt(x, z) < 1.0) continue;
      const p = { x, z }; this.resolve(p, 0.6); if (Math.hypot(p.x - x, p.z - z) > 0.01) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 12)) continue;
      spots.push({ x, z });
    }
    this.spots = spots;
  },

  // ---------------- per-game state ----------------
  reset() {
    this.partsDelivered.clear(); this.carried.clear(); this.updateBoat(); this.kidLines.clear();
    this.kids.forEach((k) => { k.saved = false; k.poof = 0; k.anim = 'scared'; k.c.root.visible = true; k.c.root.position.set(k.home.x, k.home.y, k.home.z); k.c.root.rotation.y = k.home.yaw; k.c.baseY = k.home.y; k.lantern.visible = true; k.src.on = true; });
    // batteries
    this.batteries.forEach((b) => { this.scene.remove(b.g); }); this.batteries = []; (this.battGlow || []).forEach((gi) => this.glow.setSize(gi, 0));
    this.interact = this.interact.filter((i) => i.kind !== 'battery' && i.kind !== 'part');
    const spots = shuffle(this.spots.slice()).filter((s) => Math.hypot(s.x, s.z - this.shoreZ) > 25);
    for (let i = 0; i < D().batteries && i < spots.length; i++) {
      const s = spots[i], g = makeBattery(), y = this.groundAt(s.x, s.z) + 0.35; g.position.set(s.x, y, s.z); this.scene.add(g);
      if (!this.battGlow) this.battGlow = []; if (this.battGlow[i] === undefined) this.battGlow[i] = this.glow.add(s.x, y, s.z, 0x7affc8, 0.35, 0.3);
      const gi = this.battGlow[i]; this.glow.set(gi, s.x, y, s.z); this.glow.setSize(gi, 0.35);
      const bt = { g, x: s.x, z: s.z, y, gi, taken: false }; this.batteries.push(bt);
      this.interact.push({ kind: 'battery', ref: bt, pos: g.position, r: 2.0, enabled: () => !bt.taken, label: () => 'Take battery' });
    }
    this.parts.forEach((p) => { this.scene.remove(p.g); this.scene.remove(p.beam); }); this.parts = [];
  },
  spawnParts() {
    const pool = shuffle(this.spots.slice()).filter((s) => Math.hypot(s.x, s.z - this.shoreZ) > 45 && Math.hypot(s.x - this.cabinPos.x, s.z - this.cabinPos.z) > 14);
    const chosen = [];
    for (const s of pool) { if (chosen.every((c) => Math.hypot(c.x - s.x, c.z - s.z) > 38)) chosen.push(s); if (chosen.length === PARTS.length) break; }
    while (chosen.length < PARTS.length) chosen.push(pool[chosen.length]);
    PARTS.forEach((P, i) => {
      const s = chosen[i], g = makePartPickup(P.id), y = this.groundAt(s.x, s.z); g.position.set(s.x, y + 0.05, s.z); g.rotation.y = rand(0, TAU); this.scene.add(g);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 26, 10, 1, true), new THREE.MeshBasicMaterial({ map: TEX.beam, color: new THREE.Color(1.2, 0.55, 0.12), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.set(s.x, y + 13, s.z); this.scene.add(beam);
      const part = { id: P.id, def: P, g, beam, x: s.x, z: s.z, taken: false }; this.parts.push(part);
      this.interact.push({ kind: 'part', ref: part, pos: new THREE.Vector3(s.x, y + 0.4, s.z), r: 2.4, enabled: () => !part.taken, label: () => `Take ${P.name}` });
    });
  },
  rescue(kid) {
    kid.saved = true; kid.poof = 1.6; kid.anim = 'cheer';
    for (let i = 0; i < 12; i++) this.sparkle(kid.c.root.position, i);
  },
  sparkle(pos, i) {
    if (!this.sparkles) { this.sparkles = new GlowSet(200, 60); this.scene.add(this.sparkles.points); this.spk = []; }
    const cols = [0xff6ab0, 0xffd23a, 0x6affc8, 0x7aa8ff, 0xff8a1a];
    const idx = this.sparkles.add(pos.x, pos.y + 1, pos.z, cols[i % cols.length], 0.25, 0);
    if (idx < 0) { this.sparkles.n = 0; return; }
    this.spk.push({ idx, p: new THREE.Vector3(pos.x, pos.y + 1, pos.z), v: new THREE.Vector3(rand(-2, 2), rand(1.5, 4), rand(-2, 2)), life: 1.2 });
  },

  // ---------------- per-frame ----------------
  update(dt, camPos) {
    this.time += dt; const t = this.time;
    this.lights.update(dt, camPos, t);
    const vd = Q().viewDist;
    this.chunks.forEach((m) => { const c = m.userData.center, r = vd + m.userData.radius; m.visible = (c.x - camPos.x) ** 2 + (c.z - camPos.z) ** 2 < r * r; });
    this.swings.forEach((s) => { s.g.rotation.x = Math.sin(t * 1.4 + s.ph) * s.amp; });
    this.smokes.forEach((s) => { const k = (t * 0.12 + s.ph) % 1; s.s.position.set(s.base.x + Math.sin(t * 0.3 + s.ph * 5) * k * 1.5, s.base.y + k * 6, s.base.z); s.s.material.opacity = 0.18 * Math.sin(k * Math.PI); s.s.scale.setScalar(2 + k * 4); });
    if (this.towerLight !== undefined) this.glow.setColor(this.towerLight, 0xff2a20, (Math.sin(t * 2.2) > 0.6) ? 2.0 : 0.15);
    this.batteries.forEach((b) => { if (b.taken) return; b.g.rotation.y += dt * 1.4; b.g.position.y = b.y + Math.sin(t * 2 + b.x) * 0.06; });
    this.parts.forEach((p) => { if (p.taken) return; const d = Math.hypot(camPos.x - p.x, camPos.z - p.z); p.beam.material.opacity = (0.4 + Math.sin(t * 2.5 + p.x) * 0.15) * smoothstep(2.5, 14, d); p.g.rotation.y += dt * 0.3; });
    // kids
    const P = Player.pos;
    this.kids.forEach((k) => {
      const c = k.c;
      if (k.poof > 0) {
        k.poof -= dt; animateKid(c, t, 'cheer');
        if (k.poof <= 0) {
          const spot = this.kidSpots[k.idx]; const y = this.groundAt(spot.x, spot.z);
          c.root.position.set(spot.x, y, spot.z); c.root.rotation.y = spot.yaw; c.baseY = y; k.anim = 'idle'; k.lantern.visible = false; k.src.on = false;
          for (let i = 0; i < 6; i++) this.sparkle(c.root.position, i);
        }
        return;
      }
      const d = Math.hypot(P.x - c.root.position.x, P.z - c.root.position.z), dc = Math.hypot(camPos.x - c.root.position.x, camPos.z - c.root.position.z);
      c.root.visible = dc < vd + 8; k.lantern.visible = !k.saved && dc < vd + 8;
      if (d > 45) return;
      if (!k.saved) {
        if (d < 7) { const want = Math.atan2(P.x - c.root.position.x, P.z - c.root.position.z); c.root.rotation.y += angDiff(c.root.rotation.y, want) * Math.min(1, dt * 4); animateKid(c, t, 'wave');
          if (!this.kidLines.has(k.idx) && d < 6) { this.kidLines.add(k.idx); HUD.kidSay(`${c.def.name}: “${c.def.line}”`); } }
        else animateKid(c, t, 'scared');
      } else { animateKid(c, t, d < 8 ? 'wave' : 'idle'); }
    });
    if (this.spk) {
      this.spk = this.spk.filter((s) => { s.life -= dt; s.v.y -= 5 * dt; s.p.addScaledVector(s.v, dt); this.sparkles.set(s.idx, s.p.x, s.p.y, s.p.z); this.sparkles.setSize(s.idx, Math.max(0, s.life) * 0.25); return s.life > 0; });
      if (!this.spk.length) { this.sparkles.n = 0; this.sparkles.geo.setDrawRange(0, 0); }
    }
    // mist puffs wrap around the player
    this.mist.forEach((s) => {
      s.position.x += s.userData.v.x * dt; s.position.z += s.userData.v.y * dt;
      const dx = s.position.x - camPos.x, dz = s.position.z - camPos.z;
      if (dx * dx + dz * dz > 38 * 38) { const a = rand(0, TAU), r = rand(18, 34); s.position.x = camPos.x + Math.cos(a) * r; s.position.z = camPos.z + Math.sin(a) * r; }
      s.position.y = Math.max(0.3, this.groundAt(s.position.x, s.position.z)) + 0.9;
    });
    this.moonLight.target.position.set(camPos.x, 0, camPos.z); this.moonLight.position.copy(MOON_DIR).multiplyScalar(70).add(this.moonLight.target.position);
  },
};
const PARTS = [
  { id: 'hull', name: 'Hull planks', icon: '🪵' },
  { id: 'oars', name: 'Oars', icon: '🛶' },
  { id: 'engine', name: 'Engine', icon: '⚙️' },
  { id: 'fuel', name: 'Fuel can', icon: '⛽' },
];
