// =====================================================================
//  CABIN — Joury's escape room: 4 hidden digits, keypad door, countdown
// =====================================================================
const Cabin = {
  scene: null, cam: null, flash: null, uv: null, boxes: [], inters: [], digits: [0, 0, 0, 0], found: [false, false, false, false],
  timer: 180, timeTotal: 180, attempt: 0, wakeT: 0, doorT: -1, s: {}, cv: {}, uvReveal: 0, shadowT: 0, crackT: 0, lineT: 0, light: 'flash',
  // env interface used by Player
  walkable(x, z) { return x > -3.15 && x < 3.15 && z > -2.65 && z < 2.65; },
  surfaceY() { return 0; },
  surfaceKind() { return 'wood'; },
  resolve(p, r) {
    for (const b of this.boxes) {
      const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; } else { p.z = b.z1 + r; } }
    }
    p.x = clamp(p.x, -3.14, 3.14); p.z = clamp(p.z, -2.64, 2.64);
  },
  solid(x0, x1, z0, z1) { this.boxes.push({ x0, x1, z0, z1 }); },
  hit(id, x0, y0, z0, x1, y1, z1, label) { const box = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)); const small = box.getSize(new THREE.Vector3()).length() < 1.2; this.inters.push({ id, box, aim: small ? box.clone().expandByScalar(0.09) : box, label }); },

  build() {
    const scene = this.scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.FogExp2(0x0a0705, 0.05);
    const cam = this.cam = GFX.camera(70, 0.05, 60); cam.rotation.order = 'YXZ'; scene.add(cam);
    this.flash = makeFlashlight(cam, 0xfff1d6, Math.min(1024, Q().spotShadow), true); this.flash.distance = 14; this.flash.userData.base = 4.5; this.flash.userData.beamK = 0.035;
    this.uv = new THREE.SpotLight(0x8a3cff, 0, 9, 0.36, 0.5, 1.4); this.uv.position.set(0.16, -0.16, 0.05); this.uv.target = this.flash.target; cam.add(this.uv);
    scene.add(new THREE.HemisphereLight(0xb0a0c0, 0x4a3020, 1.1));
    const b = new Builder(), wall = 0x5a3c26, wall2 = 0x4e3420, floor = 0x4a3220;
    // floor, ceiling, beams
    b.box(7.2, 0.1, 6.2, 0, -0.05, 0, floor, 'wood'); b.box(7.2, 0.1, 6.2, 0, 2.85, 0, 0x2e2016, 'wood');
    for (let x = -3; x <= 3; x += 1.5) b.box(0.18, 0.22, 6.0, x, 2.69, 0, 0x2a1c12, 'wood');
    // walls (north has a door hole, south has a window hole)
    b.box(0.1, 2.8, 6.2, -3.55, 1.4, 0, 0xc4b8a4, 'wallpaper'); b.box(0.1, 2.8, 6.2, 3.55, 1.4, 0, 0xc4b8a4, 'wallpaper');
    b.box(4.45, 2.8, 0.1, -1.325, 1.4, -3.05, 0xc4b8a4, 'wallpaper'); b.box(1.6, 2.8, 0.1, 2.75, 1.4, -3.05, 0xc4b8a4, 'wallpaper'); b.box(1.0, 0.7, 0.1, 1.45, 2.45, -3.05, 0xc4b8a4, 'wallpaper');
    b.box(2.85, 2.8, 0.1, -2.125, 1.4, 3.05, 0xc4b8a4, 'wallpaper'); b.box(2.85, 2.8, 0.1, 2.125, 1.4, 3.05, 0xc4b8a4, 'wallpaper'); b.box(1.4, 1.0, 0.1, 0, 0.5, 3.05, 0xc4b8a4, 'wallpaper'); b.box(1.4, 0.8, 0.1, 0, 2.4, 3.05, 0xc4b8a4, 'wallpaper');
    // dark wood wainscoting with a chair rail
    [[-3.485, 0, 0.03, 6.0], [3.485, 0, 0.03, 6.0]].forEach(([x, z, w, d]) => { b.box(w, 1.0, d, x, 0.5, z, 0x6a4a30, 'wood'); b.box(0.06, 0.05, d, x + Math.sign(-x) * 0.02, 1.02, z, 0x3a2416, 'wood'); });
    [[-1.3, -2.985, 4.4], [2.75, -2.985, 1.5], [0, 2.985, 7.0]].forEach(([x, z, d]) => { b.box(d, 1.0, 0.03, x, 0.5, z, 0x6a4a30, 'wood'); b.box(d, 0.05, 0.06, x, 1.02, z - Math.sign(z) * 0.02, 0x3a2416, 'wood'); });
    [[-3.47, 0, 0.03, 6.0], [3.47, 0, 0.03, 6.0]].forEach(([x, z, w, d]) => b.box(w + 0.02, 0.12, d, x, 0.06, z, 0x2a1a10, 'wood'));
    // log corner posts
    [[-3.45, -2.95], [3.45, -2.95], [-3.45, 2.95], [3.45, 2.95]].forEach(([x, z]) => b.cyl(0.14, 0.14, 2.8, x, 1.4, z, 0x3a2618, 'wood', 8));
    // door frame
    b.box(0.12, 2.15, 0.16, 0.89, 1.075, -3.0, 0x2a1a10, 'wood'); b.box(0.12, 2.15, 0.16, 2.01, 1.075, -3.0, 0x2a1a10, 'wood'); b.box(1.24, 0.12, 0.16, 1.45, 2.14, -3.0, 0x2a1a10, 'wood');
    // rug (red/blue, of course)
    for (let i = 0; i < 6; i++) b.box(2.8, 0.02, 0.32, 0.2, 0.01, -0.6 + i * 0.32, i % 2 ? 0x8a1f24 : 0x22407a, 'plain');
    // bed
    b.box(1.8, 0.35, 2.05, -2.5, 0.25, 2.0, 0x3a2618, 'wood'); b.box(1.7, 0.18, 1.95, -2.5, 0.5, 2.0, 0xd8d2c4, 'plain'); b.box(1.72, 0.08, 1.3, -2.5, 0.62, 1.65, 0x8a1f24, 'plain'); b.box(0.9, 0.16, 0.45, -2.5, 0.66, 2.65, 0xeee8da, 'plain'); b.box(1.8, 0.9, 0.12, -2.5, 0.6, 3.0, 0x3a2618, 'wood');
    this.solid(-3.5, -1.6, 0.95, 3.0); this.hit('bed', -3.4, 0, 1.0, -1.6, 0.9, 3.0);
    // desk + chair + keyboard
    b.box(0.85, 0.06, 2.0, -3.05, 0.76, -0.8, 0x3a2a1e, 'wood'); [[-3.4, -1.7], [-2.7, -1.7], [-3.4, 0.1], [-2.7, 0.1]].forEach(([x, z]) => b.box(0.06, 0.76, 0.06, x, 0.38, z, 0x222222, 'metal'));
    b.box(0.22, 0.03, 0.6, -2.9, 0.8, -0.8, 0x18181c, 'plain'); b.box(0.12, 0.03, 0.08, -2.88, 0.8, -0.25, 0x18181c, 'plain');
    b.box(0.08, 0.35, 0.08, -3.3, 0.95, -0.8, 0x18181c, 'metal'); b.box(0.25, 0.03, 0.25, -3.3, 0.79, -0.8, 0x18181c, 'metal');
    b.box(0.08, 0.6, 1.1, -3.3, 1.35, -0.8, 0x111114, 'metal');
    this.solid(-3.5, -2.6, -1.85, 0.25); this.hit('keyboard', -3.05, 0.76, -1.15, -2.75, 0.9, -0.45); this.hit('monitor', -3.35, 1.0, -1.4, -3.15, 1.7, -0.2);
    b.box(0.6, 0.08, 0.6, -2.2, 0.5, -0.8, 0x18181c, 'plain'); b.box(0.6, 0.8, 0.1, -1.92, 0.95, -0.8, 0x18181c, 'plain', 0, 0, -0.15); b.box(0.06, 0.5, 0.4, -1.88, 1.0, -0.8, 0xa01a22, 'plain'); b.cyl(0.04, 0.04, 0.45, -2.2, 0.25, -0.8, 0x333333, 'metal', 6);
    this.solid(-2.55, -1.85, -1.15, -0.45); this.hit('chair', -2.5, 0.3, -1.1, -1.85, 1.3, -0.5);
    // trophy (2nd place, silver)
    b.cyl(0.07, 0.04, 0.16, -3.25, 0.95, 0.0, 0xb8bcc4, 'metal', 10); b.box(0.16, 0.06, 0.16, -3.25, 0.82, 0.0, 0x2a2a2a, 'wood'); b.box(0.03, 0.06, 0.02, -3.17, 0.98, 0.0, 0xb8bcc4, 'metal'); b.box(0.03, 0.06, 0.02, -3.33, 0.98, 0.0, 0xb8bcc4, 'metal');
    this.hit('trophy', -3.4, 0.76, -0.15, -3.1, 1.1, 0.15);
    // bookshelf with red book and a hidden compartment at the bottom
    b.box(0.42, 2.2, 2.1, 3.28, 1.1, -0.6, 0x3a2618, 'wood');
    for (let k = 0; k < 4; k++) {
      const y = 0.75 + k * 0.45; b.box(0.4, 0.04, 2.0, 3.24, y, -0.6, 0x2a1a10, 'wood');
      let z = -1.55; while (z < 0.35) { const w = rand(0.05, 0.1), h = rand(0.25, 0.38); if (!(k === 1 && Math.abs(z + 0.6) < 0.12)) b.box(0.26, h, w, 3.2, y + 0.02 + h / 2, z + w / 2, pick([0x2a4a6a, 0x5a3a2a, 0x3a5a3a, 0x6a6a5a, 0x2a2a3a, 0x7a5a2a]), 'plain'); z += w + 0.01; }
    }
    b.box(0.02, 0.5, 2.0, 3.06, 0.3, -0.6, 0x2a1a10, 'wood');
    this.solid(3.05, 3.5, -1.7, 0.5); this.hit('shelf', 3.05, 0.6, -1.65, 3.5, 2.2, 0.45);
    const red = this.redBook = boxMesh(0.27, 0.36, 0.08, lam(0xc0151f)); red.position.set(3.2, 0.75 + 0.45 + 0.2, -0.6); scene.add(red);
    this.hit('redbook', 3.0, 1.2, -0.7, 3.4, 1.6, -0.5);
    const cd = this.compDoor = new THREE.Group(); cd.position.set(3.06, 0.05, -1.55); scene.add(cd);
    const cdm = boxMesh(0.03, 0.5, 1.9, lam(0x3e2a1a)); cdm.position.set(0, 0.25, 0.95); cd.add(cdm);
    const key = this.key = new THREE.Group(); key.position.set(3.25, 0.12, -0.5); scene.add(key);
    const kb = boxMesh(0.04, 0.02, 0.18, lam(0xd9a521, { emissive: 0x332200 })); key.add(kb); const kr = mesh(geoCache('keyring', () => new THREE.TorusGeometry(0.04, 0.012, 6, 12)), lam(0xd9a521, { emissive: 0x332200 })); kr.rotation.x = Math.PI / 2; kr.position.z = -0.1; key.add(kr);
    this.hit('compartment', 3.0, 0.0, -1.6, 3.5, 0.55, 0.4);
    // chest
    b.box(1.0, 0.5, 0.6, 2.6, 0.25, -2.35, 0x5a3a1e, 'wood'); b.box(1.04, 0.06, 0.64, 2.6, 0.08, -2.35, 0x2a2a2a, 'metal'); b.box(1.04, 0.06, 0.64, 2.6, 0.44, -2.35, 0x2a2a2a, 'metal');
    const lid = this.lid = new THREE.Group(); lid.position.set(2.6, 0.5, -2.65); scene.add(lid);
    const lm = boxMesh(1.02, 0.18, 0.62, lam(0x5e3e22)); lm.position.set(0, 0.09, 0.3); lid.add(lm);
    const lock = boxMesh(0.12, 0.14, 0.04, lam(0xb8a040, { emissive: 0x111100 })); lock.position.set(0, 0.0, 0.62); lid.add(lock);
    const uvt = this.uvTool = new THREE.Group(); uvt.position.set(2.45, 0.42, -2.35); scene.add(uvt);
    const ut = mesh(geoCache('uvtool', () => new THREE.CylinderGeometry(0.035, 0.03, 0.26, 10)), lam(0x2a2a30)); ut.rotation.z = Math.PI / 2; uvt.add(ut);
    const uh = mesh(geoCache('uvhead', () => new THREE.CylinderGeometry(0.05, 0.04, 0.05, 10)), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.6, 3.0) })); uh.rotation.z = Math.PI / 2; uh.position.x = 0.15; uvt.add(uh);
    this.solid(2.05, 3.15, -2.7, -2.0); this.hit('chest', 2.05, 0, -2.7, 3.15, 0.75, -2.0);
    // fireplace
    b.box(1.9, 1.3, 0.65, -1.6, 0.65, -2.7, 0x5c5a56, 'stone'); b.box(2.1, 0.12, 0.8, -1.6, 1.35, -2.65, 0x3a2a1e, 'wood'); b.box(1.2, 1.5, 0.6, -1.6, 2.1, -2.75, 0x55524e, 'stone');
    b.box(1.1, 0.8, 0.1, -1.6, 0.45, -2.38, 0x050302, 'plain');
    b.rod(0.06, [-2.0, 0.12, -2.45], [-1.2, 0.18, -2.5], 0x2a1a10, 'wood'); b.rod(0.06, [-1.9, 0.18, -2.55], [-1.3, 0.12, -2.4], 0x2a1a10, 'wood');
    this.solid(-2.6, -0.6, -3.0, -2.3); this.hit('fireplace', -2.55, 0, -3.0, -0.65, 1.4, -2.3);
    this.flames = [];
    const flameTex = texFrom((() => { const c = makeCanvas(64, 128), g = c.getContext('2d'), gr = g.createRadialGradient(32, 100, 2, 32, 80, 60); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.3, 'rgba(255,150,40,.9)'); gr.addColorStop(0.7, 'rgba(200,40,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(62, 70, 50, 120); g.lineTo(14, 120); g.quadraticCurveTo(2, 70, 32, 4); g.fill(); return c; })());
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshBasicMaterial({ map: flameTex, color: new THREE.Color(3, 2, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); f.position.set(-1.6 + (i - 1) * 0.22, 0.42, -2.5); f.rotation.y = (i - 1) * 0.5; scene.add(f); this.flames.push(f); }
    this.fire = new THREE.PointLight(0xff7a2a, 20, 12, 1.25); this.fire.position.set(-1.6, 0.7, -2.2); this.fire.castShadow = false;
    this.bulb = new THREE.PointLight(0xffc488, 7, 10, 1.2); this.bulb.position.set(0.3, 2.12, 0.1); this.bulb.castShadow = Q().fireShadow; this.bulb.shadow.mapSize.set(512, 512); this.bulb.shadow.bias = -0.004; this.bulb.shadow.camera.near = 0.15; scene.add(this.bulb);
    const cord = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 5), plainMat(0x111111, 0.6), false); cord.position.set(0.3, 2.53, 0.1); scene.add(cord);
    const sock = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.06, 10), plainMat(0x2a2620, 0.5, 0.5), false); sock.position.set(0.3, 2.24, 0.1); scene.add(sock);
    this.bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.8) }); const bulbM = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), this.bulbMat); bulbM.position.set(0.3, 2.18, 0.1); scene.add(bulbM);
    this.bulbT = 0; this.bulbK = 1;
    // cobwebs in the ceiling corners and on the shelf
    const webMat = fogify(new THREE.MeshStandardMaterial({ map: PBR.cobweb.map, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, opacity: 0.8 }));
    [[-3.45, -2.95, 0], [3.45, -2.95, 1], [3.45, 2.95, 2], [-3.45, 2.95, 3]].forEach(([x, z, k]) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), webMat); w.position.set(x - Math.sign(x) * 0.32, 2.48, z - Math.sign(z) * 0.32); w.rotation.set(0, Math.atan2(Math.sign(x), Math.sign(z)) + Math.PI / 4 * 0, 0); w.lookAt(0, 2.48, 0); w.rotateX(-0.35); w.rotateZ(Math.PI / 4 + k * Math.PI / 2); scene.add(w); });
    { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), webMat); w.position.set(3.06, 1.95, 0.42); w.rotation.y = -Math.PI / 2; scene.add(w); }
    // drifting dust in the air
    this.dust = new GlowSet(160, 12); scene.add(this.dust.points); this.dustP = [];
    for (let i = 0; i < 160; i++) { const p = new THREE.Vector3(rand(-3.3, 3.3), rand(0.2, 2.6), rand(-2.8, 2.8)); this.dustP.push({ p, v: new THREE.Vector3(rand(-0.03, 0.03), rand(-0.02, 0.01), rand(-0.03, 0.03)) }); this.dust.add(p.x, p.y, p.z, 0xd8ccb8, rand(0.006, 0.014), 0.3); this.dust.setColor(i, 0xd8ccb8, 0.5); }
    // NOT GG, scrawled in red paint above the shelf
    { const cv = makeCanvas(512, 128), g = cv.getContext('2d'); g.fillStyle = 'rgba(120,8,10,.85)'; g.font = 'bold 96px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.save(); g.translate(256, 92); g.rotate(-0.04); g.fillText('NOT GG', 0, 0); g.restore();
      for (let i = 0; i < 14; i++) { const x = rand(90, 420), y = rand(70, 100); g.fillRect(x, y, rand(2, 4), rand(10, 34)); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), fogify(new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, depthWrite: false }))); d.position.set(3.47, 2.42, -0.6); d.rotation.y = -Math.PI / 2; scene.add(d); } this.fire.shadow.mapSize.set(512, 512); this.fire.shadow.bias = -0.003; scene.add(this.fire);
    this.monLight = new THREE.PointLight(0x9ab8ff, 5, 5, 1.5); this.monLight.position.set(-2.9, 1.35, -0.8); scene.add(this.monLight);
    this.glow = new GlowSet(8, 30); scene.add(this.glow.points); this.glow.add(-1.6, 0.5, -2.4, 0xff7a1a, 1.6, 0.6);
    // candy pile
    for (let i = 0; i < 70; i++) { const a = rand(0, TAU), r = Math.sqrt(Math.random()) * 0.55, h = (0.55 - r) * 0.6 * Math.random(); b.box(0.07, 0.05, 0.1, 2.9 + Math.cos(a) * r, 0.03 + h, 2.35 + Math.sin(a) * r, pick([0xff4a8a, 0xffd23a, 0x4ad0ff, 0x7aff6a, 0xff7a1a, 0xffffff, 0x7a3a1a]), 'plain', rand(0, 3), rand(0, 1), rand(0, 1)); }
    this.solid(2.4, 3.5, 1.85, 3.0); this.hit('candy', 2.3, 0, 1.8, 3.5, 0.6, 3.0);
    // window: boards over a moonlit gap, and a shadow that walks past
    const night = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 0.09, 0.16) })); night.position.set(0, 1.5, 3.25); night.rotation.y = Math.PI; scene.add(night);
    const sil = this.silhouette = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, map: texFrom((() => { const c = makeCanvas(64, 128), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(18, 10, 28, 30); g.fillRect(12, 36, 40, 60); g.fillRect(6, 40, 8, 60); g.fillRect(50, 40, 8, 60); g.fillStyle = '#000'; g.fillRect(24, 20, 5, 3); g.fillRect(36, 20, 5, 3); return c; })()), alphaTest: 0.3 }));
    sil.position.set(-2, 1.6, 3.2); sil.rotation.y = Math.PI; sil.visible = false; scene.add(sil);
    this.silEyes = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.2, 0.1) })); this.silEyes.position.set(0, 0.42, -0.01); this.silEyes.rotation.y = Math.PI; sil.add(this.silEyes);
    for (let i = 0; i < 4; i++) b.box(1.6, 0.16, 0.05, 0, 1.12 + i * 0.26, 2.98, 0x6a4a2a, 'wood', 0, 0, rand(-0.12, 0.12));
    this.hit('window', -0.7, 1.0, 2.8, 0.7, 2.0, 3.05);
    // door + keypad
    const dp = this.doorPivot = new THREE.Group(); dp.position.set(0.95, 0, -3.0); scene.add(dp);
    const door = boxMesh(1.0, 2.08, 0.08, lam(0x3a2414)); door.position.set(0.5, 1.04, 0); dp.add(door);
    const knob = boxMesh(0.06, 0.06, 0.1, lam(0xb8a040)); knob.position.set(0.88, 1.0, 0.06); dp.add(knob);
    for (let i = 0; i < 3; i++) { const plank = boxMesh(1.02, 0.08, 0.1, lam(0x2a1a0e)); plank.position.set(0.5, 0.4 + i * 0.65, 0.02); dp.add(plank); }
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.65, 1.0) })); outside.position.set(1.45, 1.1, -3.2); scene.add(outside);
    this.hit('door', 0.9, 0, -3.1, 2.0, 2.1, -2.9);
    // canvases for clue surfaces
    this.cv.monitor = makeCanvas(512, 300); this.cv.note = makeCanvas(300, 380); this.cv.card2 = makeCanvas(200, 120); this.cv.card3 = makeCanvas(200, 120); this.cv.poster = makeCanvas(384, 512); this.cv.uv = makeCanvas(384, 512); this.cv.cal = makeCanvas(300, 380); this.cv.keypad = makeCanvas(128, 160);
    this.tex = {}; Object.keys(this.cv).forEach((k) => { this.tex[k] = texFrom(this.cv[k]); });
    const plane = (w, h, tex, x, y, z, ry, basic, extra = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial(Object.assign({ map: tex }, extra)) : lam(0xffffff, Object.assign({ map: tex }, extra))); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
    this.monitor = plane(1.0, 0.58, this.tex.monitor, -3.24, 1.35, -0.8, Math.PI / 2, true, { color: new THREE.Color(1.6, 1.6, 1.6) });
    plane(0.26, 0.32, this.tex.note, -2.95, 0.795, -1.5, Math.PI / 2, false).rotation.set(-Math.PI / 2, 0, 0.3);
    this.hit('note', -3.15, 0.76, -1.75, -2.75, 0.9, -1.25);
    this.card2 = plane(0.3, 0.18, this.tex.card2, 3.3, 0.28, -1.0, -Math.PI / 2, false);
    this.card3 = plane(0.3, 0.18, this.tex.card3, 2.8, 0.4, -2.36, 0, false); this.card3.rotation.set(-Math.PI / 2, 0, 0.2);
    this.poster = plane(1.0, 1.33, this.tex.poster, 2.3, 1.5, 2.99, Math.PI, false);
    this.uvOverlay = plane(1.0, 1.33, this.tex.uv, 2.3, 1.5, 2.985, Math.PI, true, { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) });
    for (let i = 0; i < 6; i++) { const d = new THREE.Group(); d.position.set(2.3 + rand(-0.4, 0.4), 1.5 + rand(-0.55, 0.55), 2.96); const sh = boxMesh(0.015, 0.015, 0.12, lam(0x222222)); sh.position.z = -0.06; d.add(sh); const fl = boxMesh(0.05, 0.05, 0.02, lam(i % 2 ? 0xc0262b : 0x2f62d6)); fl.position.z = -0.12; d.add(fl); d.rotation.set(rand(-0.2, 0.2), rand(-0.2, 0.2), 0); scene.add(d); }
    this.hit('poster', 1.75, 0.8, 2.85, 2.85, 2.2, 3.05);
    plane(0.6, 0.76, this.tex.cal, 0.1, 1.55, -2.99, 0, false); this.hit('calendar', -0.25, 1.15, -3.05, 0.45, 1.95, -2.85);
    plane(0.22, 0.28, this.tex.keypad, 2.3, 1.3, -2.99, 0, true, { color: new THREE.Color(1.3, 1.3, 1.3) }); this.hit('keypad', 2.1, 1.0, -3.05, 2.5, 1.6, -2.85);
    this.drawStatic();
    const m = b.build({ uvScale: 1.2 }); scene.add(m);
    m.children.forEach((c) => { c.castShadow = true; c.receiveShadow = true; });
  },
  drawStatic() {
    { // poster of Vivek, wanted for scoring
      const c = this.cv.poster, g = c.getContext('2d');
      g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 384, 512); g.fillStyle = '#c9b78f'; for (let i = 0; i < 400; i++) g.fillRect(rand(0, 384), rand(0, 512), 2, 2);
      g.fillStyle = '#2f62d6'; g.font = 'bold 54px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('WANTED', 192, 70);
      g.fillStyle = '#a8714a'; g.fillRect(102, 100, 180, 180); g.fillStyle = '#15120f'; g.fillRect(102, 100, 180, 40); g.fillRect(102, 140, 26, 20); g.fillRect(256, 140, 26, 20);
      g.fillStyle = '#fff'; g.fillRect(132, 170, 34, 30); g.fillRect(218, 170, 34, 30); g.fillStyle = '#111'; g.fillRect(148, 180, 14, 16); g.fillRect(234, 180, 14, 16);
      g.fillStyle = '#4a1a1a'; g.fillRect(150, 236, 84, 12); g.fillRect(140, 226, 12, 12); g.fillRect(232, 226, 12, 12);
      g.fillStyle = '#2f6fd6'; g.fillRect(92, 280, 200, 60);
      g.fillStyle = '#111'; g.font = 'bold 46px Impact, "Arial Black", sans-serif'; g.fillText('VIVEK', 192, 400); g.font = 'bold 24px "Courier New", monospace'; g.fillText('FOR SCORING ON ME', 192, 440); g.fillText('REWARD: 1 REMATCH', 192, 474);
      g.strokeStyle = '#c0151f'; g.lineWidth = 6; g.beginPath(); g.moveTo(80, 90); g.lineTo(304, 300); g.stroke();
      g.fillStyle = '#111'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(rand(60, 330), rand(90, 360), 2.5, 0, TAU); g.fill(); }
      this.tex.poster.needsUpdate = true;
    }
    { // calendar
      const c = this.cv.cal, g = c.getContext('2d');
      g.fillStyle = '#f2ece0'; g.fillRect(0, 0, 300, 380); g.fillStyle = '#c0262b'; g.fillRect(0, 0, 300, 60);
      g.fillStyle = '#fff'; g.font = 'bold 34px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('OCTOBER', 150, 44);
      g.fillStyle = '#333'; g.font = '16px "Courier New", monospace';
      for (let d = 1; d <= 31; d++) { const k = d + 2, x = 22 + (k % 7) * 40, y = 96 + Math.floor(k / 7) * 40; g.fillText(String(d), x + 6, y); }
      g.strokeStyle = '#d0151f'; g.lineWidth = 4; g.beginPath(); g.ellipse(28 + (33 % 7) * 40, 89 + Math.floor(33 / 7) * 40, 22, 17, 0, 0, TAU); g.stroke();
      g.fillStyle = '#d0151f'; g.font = 'bold 22px Impact, sans-serif'; g.fillText('OPERATION:', 150, 316); g.fillText('NO MORE TREATS', 150, 344);
      this.tex.cal.needsUpdate = true;
    }
    { // keypad
      const c = this.cv.keypad, g = c.getContext('2d');
      g.fillStyle = '#2a2f34'; g.fillRect(0, 0, 128, 160); g.fillStyle = '#0b2a14'; g.fillRect(12, 10, 104, 26); g.fillStyle = '#5bff83'; g.font = 'bold 16px monospace'; g.textAlign = 'center'; g.fillText('_ _ _ _', 64, 29);
      g.font = 'bold 18px monospace'; g.fillStyle = '#dde';
      for (let i = 0; i < 12; i++) { const x = 18 + (i % 3) * 36, y = 46 + Math.floor(i / 3) * 27; g.fillStyle = '#4a5058'; g.fillRect(x, y, 28, 22); g.fillStyle = '#dde'; g.fillText(['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'][i], x + 14, y + 17); }
      this.tex.keypad.needsUpdate = true;
    }
  },
  drawDigits() {
    const D4 = this.digits;
    { const c = this.cv.monitor, g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#0a1430'); gr.addColorStop(1, '#03060f'); g.fillStyle = gr; g.fillRect(0, 0, 512, 300);
      g.fillStyle = '#7fa8ff'; g.font = 'bold 28px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('THE BRIDGE', 256, 50);
      g.fillStyle = '#ff2b2b'; g.font = 'bold 92px Impact, "Arial Black", sans-serif'; g.fillText('DEFEAT', 256, 150);
      g.fillStyle = '#ddd'; g.font = 'bold 26px "Courier New", monospace'; g.fillText('VIVEK 5 – 4 JOURY', 256, 200);
      g.fillStyle = '#ffd35a'; g.font = 'bold 30px "Courier New", monospace'; g.textAlign = 'right'; g.fillText('#1 = ' + D4[0], 496, 286);
      g.fillStyle = 'rgba(255,255,255,.04)'; for (let y = 0; y < 300; y += 3) g.fillRect(0, y, 512, 1);
      this.tex.monitor.needsUpdate = true; }
    { const c = this.cv.note, g = c.getContext('2d');
      g.fillStyle = '#efe6cf'; g.fillRect(0, 0, 300, 380); g.strokeStyle = 'rgba(80,120,200,.3)'; for (let y = 60; y < 380; y += 28) { g.beginPath(); g.moveTo(10, y); g.lineTo(290, y); g.stroke(); }
      g.fillStyle = '#1a1a3a'; g.font = 'bold 22px "Comic Sans MS", "Segoe Print", cursive'; g.textAlign = 'left';
      ['DOOR CODE = 4 digits', 'hid them so VIVEK', "can't find them:", '#1 my screen of shame', '#2 behind the RED book', '#3 locked in the chest', '#4 only glows in', '     the dark light', '— J.'].forEach((l, i) => g.fillText(l, 20, 50 + i * 36));
      this.tex.note.needsUpdate = true; }
    [['card2', 1], ['card3', 2]].forEach(([k, i]) => { const c = this.cv[k], g = c.getContext('2d'); g.fillStyle = '#d9c9a0'; g.fillRect(0, 0, 200, 120); g.strokeStyle = '#6a5030'; g.lineWidth = 6; g.strokeRect(3, 3, 194, 114); g.fillStyle = '#2a1a0a'; g.font = 'bold 54px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('#' + (i + 1) + '=' + D4[i], 100, 80); this.tex[k].needsUpdate = true; });
    { const c = this.cv.uv, g = c.getContext('2d'); g.clearRect(0, 0, 384, 512); g.shadowColor = '#3aff1a'; g.shadowBlur = 14; g.fillStyle = '#7dff3a'; g.font = 'bold 130px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('#4=' + D4[3], 192, 250); g.shadowBlur = 0; g.fillStyle = '#d8ffb0'; g.fillText('#4=' + D4[3], 192, 250); g.font = 'bold 30px "Courier New", monospace'; g.fillText('(only I can see this)', 192, 310); this.tex.uv.needsUpdate = true; }
  },
  reset(attempt) {
    this.attempt = attempt; const d = D();
    this.timeTotal = Math.max(d.cabinMin, d.cabinFirst - (attempt - 1) * d.cabinStep); this.timer = this.timeTotal;
    this.digits = [0, 1, 2, 3].map(() => randInt(0, 9)); this.found = [false, false, false, false];
    this.s = { pulled: false, keyTaken: false, chestOpen: false, uvTaken: false, uvFound: false, escaped: false, noteRead: false };
    this.drawDigits();
    this.redBook.position.x = 3.2; this.redBook.rotation.z = 0; this.compDoor.rotation.y = 0; this.key.visible = true; this.lid.rotation.x = 0; this.uvTool.visible = true; this.card3.visible = true;
    this.doorPivot.rotation.y = 0; this.doorT = -1; this.uvReveal = 0; this.uvOverlay.material.opacity = 0; this.light = 'flash';
    this.wakeT = 3.2; this.shadowT = 6; this.lineT = 12; this.silhouette.visible = false;
    this.anim = []; Player.attach(this.cam, this, this.flash); Player.place(-2.0, 0.6, -1.25, 0); Player.lightOn = true; Player.frozen = true;
    this.bulb.castShadow = Q().fireShadow;
  },
  digitsLine() { return this.digits.map((d, i) => (this.found[i] ? d : '_')).join(' '); },
  aimed() {
    const ray = new THREE.Ray(this.cam.position.clone(), Player.forward(new THREE.Vector3()));
    let best = null, bd = 2.7; const p = new THREE.Vector3();
    for (const it of this.inters) { if (ray.intersectBox(it.aim, p)) { const d = p.distanceTo(ray.origin); if (d < bd) { bd = d; best = it; } } }
    // the red book and compartment sit inside the shelf's box — prefer them when aimed
    return best;
  },
  label(id) {
    const s = this.s;
    return { note: 'Read the note', monitor: 'Look at the monitor', keyboard: 'Inspect keyboard', chair: 'Inspect chair', trophy: 'Inspect trophy', shelf: 'Inspect bookshelf', redbook: s.pulled ? 'Inspect red book' : 'Pull the red book',
      compartment: s.pulled ? (s.keyTaken ? 'Inspect compartment' : 'Take the small key') : 'Inspect bookshelf', chest: s.chestOpen ? 'Inspect chest' : (s.keyTaken ? 'Unlock the chest' : 'Inspect chest'), fireplace: 'Inspect fireplace',
      candy: 'Inspect candy pile', window: 'Inspect window', door: 'Inspect door', keypad: 'Use keypad', calendar: 'Inspect calendar', poster: 'Inspect poster', bed: 'Inspect bed' }[id] || 'Inspect';
  },
  use(id) {
    const s = this.s, d = this.digits, dg = (i) => `<span class="digit">${d[i]}</span>`;
    switch (id) {
      case 'note': s.noteRead = true; return { title: 'A crumpled note', text: `In Joury's messy handwriting:\n“DOOR CODE = 4 digits. I hid them so Vivek can't find them.”\n\nDigits found so far: <b>${this.digitsLine()}</b>`, img: this.cv.note };
      case 'monitor': this.found[0] = true; return { title: 'Gaming monitor', text: `THE BRIDGE — DEFEAT.\nHe has watched this replay about four thousand times.\n\nScratched into the corner of the screen:\nDigit #1 = ${dg(0)}`, img: this.cv.monitor };
      case 'keyboard': return { title: 'Keyboard', text: 'The W, A, S and D keys are worn down to nothing.\nThe G key has been ripped out. Both of them.', emoji: '⌨️' };
      case 'chair': return { title: 'Gaming chair', text: 'Still warm. There is a dent shaped exactly like someone who rage-quits a lot.', emoji: '💺' };
      case 'trophy': return { title: '“2nd PLACE”', text: 'BRIDGE TOURNAMENT — RUNNER-UP.\nThe 2 was scratched out. Then scratched back in. Then cried on a little.', emoji: '🥈' };
      case 'shelf': return { title: 'Bookshelf', text: '“HOW TO WIN AT BRIDGE”, volumes 1 to 9. None of them opened.\nOne bright RED book sticks out from the second shelf.', emoji: '📚' };
      case 'redbook':
        if (!s.pulled) { s.pulled = true; SFX.click(); setTimeout(() => SFX.creak(), 250); this.anim.push({ t: 0, d: 0.6, f: (k) => { this.redBook.rotation.z = -0.5 * k; this.redBook.position.x = 3.2 - 0.12 * k; } }, { t: 0, d: 1.0, delay: 0.4, f: (k) => { this.compDoor.rotation.y = -1.6 * k; } });
          return { title: 'The red book', text: 'You pull the red book. It tilts out…\n\n<b>CLICK.</b> A hidden compartment swings open at the bottom of the bookshelf!', emoji: '📕' }; }
        return { title: '“HOW TO BE A GOOD SPORT”', text: 'The red book. Every page is blank.', emoji: '📕' };
      case 'compartment':
        if (!s.pulled) return this.use('shelf');
        if (!s.keyTaken) { s.keyTaken = true; this.found[1] = true; this.key.visible = false; SFX.pickup(); return { title: 'Secret compartment', text: `You found a <b>small brass key!</b>\n\nScratched inside the compartment:\nDigit #2 = ${dg(1)}`, img: this.cv.card2 }; }
        return { title: 'Secret compartment', text: `Empty now. Scratched inside: Digit #2 = ${dg(1)}`, img: this.cv.card2 };
      case 'chest':
        if (!s.keyTaken) return { title: 'Locked chest', text: 'Locked tight. There is a tiny keyhole.\nA small key must be hidden somewhere in this room.', emoji: '🧰' };
        if (!s.chestOpen) { s.chestOpen = true; s.uvTaken = true; this.found[2] = true; SFX.creak(); setTimeout(() => SFX.pickup(), 600); this.uvTool.visible = false;
          this.anim.push({ t: 0, d: 1.0, f: (k) => { this.lid.rotation.x = -1.7 * smoothstep(0, 1, k); } });
          return { title: 'The chest opens!', text: `Inside: a <b>UV blacklight</b> (you take it) and a card:\nDigit #3 = ${dg(2)}\n\nPress <b>F</b> to switch to the UV light. It shows things eyes can't see.`, img: this.cv.card3 }; }
        return { title: 'Open chest', text: `Empty, apart from the card: Digit #3 = ${dg(2)}`, img: this.cv.card3 };
      case 'poster':
        if (s.uvFound) return { title: 'WANTED: VIVEK', text: `Under the UV light, glowing letters appear:\nDigit #4 = ${dg(3)}`, img: this.posterWithUV() };
        if (s.uvTaken) return { title: 'WANTED: VIVEK', text: 'Covered in darts. Joury has terrible aim.\nShine the UV light on it (press <b>F</b> to switch lights, then look at the poster).', img: this.cv.poster };
        return { title: 'WANTED: VIVEK', text: '“FOR SCORING ON ME. REWARD: 1 REMATCH.”\nCovered in darts. Something about it feels… invisible.', img: this.cv.poster };
      case 'calendar': return { title: 'Calendar', text: 'October 31st is circled in red:\n<b>OPERATION: NO MORE TREATS</b>.\nNovember 1st just says: “rematch?? (no)”.', img: this.cv.cal };
      case 'candy': return { title: 'Stolen candy', text: 'Hundreds of pieces from all ten kids.\nHe ate every chocolate and left the candy corn. Truly a monster.', emoji: '🍬' };
      case 'bed': return { title: 'Unmade bed', text: "A pillow with Vivek's face doodled on it. It has been punched. A lot.", emoji: '🛏️' };
      case 'fireplace': return { title: 'Fireplace', text: 'Crackling. In the flames, a melted plastic sign still reads “G—G”.', emoji: '🔥' };
      case 'window': return { title: 'Boarded window', text: 'Nailed shut. Through the cracks: fog, trees…\nand sometimes something tall walking past.', emoji: '🪟' };
      case 'door': return { title: 'The door', text: 'Locked. The keypad next to it blinks: ENTER CODE.', emoji: '🚪' };
    }
    return null;
  },
  posterWithUV() { const c = makeCanvas(384, 512), g = c.getContext('2d'); g.drawImage(this.cv.poster, 0, 0); g.fillStyle = 'rgba(40,0,80,.55)'; g.fillRect(0, 0, 384, 512); g.drawImage(this.cv.uv, 0, 0); return c; },
  tryCode(code) {
    if (code === this.digits.join('')) { this.s.escaped = true; this.doorT = 0; SFX.unlock(); setTimeout(() => SFX.creak(), 400); return true; }
    this.timer = Math.max(1, this.timer - D().penalty); SFX.buzz(); GFX.fx.red = 0.6; return false;
  },
  cycleLight() {
    if (!this.s.uvTaken) { Player.toggleLight(); this.light = Player.lightOn ? 'flash' : 'off'; return; }
    this.light = this.light === 'flash' ? 'uv' : this.light === 'uv' ? 'off' : 'flash';
    Player.lightOn = this.light === 'flash'; SFX.flashlight(this.light !== 'off');
    if (this.light === 'uv') HUD.toast('UV light on. Look for hidden writing.', 2.5);
  },
  anim: [],
  update(dt) {
    const t = GFX.time;
    // wake-up: lying on the bed, then sitting up
    if (this.wakeT > 0) {
      this.wakeT -= dt; const k = 1 - clamp(this.wakeT / 3.2, 0, 1), e = smoothstep(0.35, 1, k);
      this.cam.position.set(lerp(-2.5, -2.0, e), lerp(0.85, 1.62, e), lerp(2.3, 0.6, e));
      this.cam.rotation.set(lerp(1.35, 0, e), lerp(-0.45, -1.25, e), lerp(0.3, 0, e));
      GFX.fx.fade = clamp(1 - k * 2.2, 0, 1) + (k < 0.3 ? Math.sin(k * 40) * 0.1 : 0);
      if (this.wakeT <= 0) { Player.frozen = false; Player.place(-2.0, 0.6, -1.25, 0); GFX.fx.fade = 0; HUD.toast("You wake up in <b>Joury's cabin</b>. The door is locked with a keypad.<br>Find the 4 digits before he comes back!", 5); }
    } else Player.update(dt, { walk: 2.6, run: 3.6 });
    // lights
    Player.updateLight(dt, this.timer < 30 ? 0.4 : 0, 0);
    this.uv.intensity = this.light === 'uv' ? 7 : 0;
    const f = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07 + Math.random() * 0.05;
    this.fire.intensity = 26 * f; this.flames.forEach((fl, i) => { fl.scale.set(1 + Math.sin(t * 9 + i) * 0.1, f + Math.sin(t * 11 + i * 2) * 0.12, 1); });
    this.monLight.intensity = 5 + Math.sin(t * 30) * 0.3;
    this.bulbT -= dt; if (this.bulbT <= 0) { this.bulbT = Math.random() < 0.15 ? rand(0.05, 0.25) : rand(1.5, 5); this.bulbTarget = Math.random() < 0.18 ? rand(0, 0.25) : rand(0.85, 1.05); if (this.bulbTarget < 0.3) SFX.burst && SFX.ok() && SFX.burst(SFX.now, 0.08, 0.04, 'highpass', 4000, 1); }
    this.bulbK = damp(this.bulbK, this.bulbTarget === undefined ? 1 : this.bulbTarget, 25, dt); const low = this.timer < 30 ? 0.7 : 1;
    this.bulb.intensity = 7 * this.bulbK * low; this.bulbMat.color.setRGB(4 * this.bulbK * low, 3 * this.bulbK * low, 1.8 * this.bulbK * low);
    this.dustP.forEach((d, i) => { d.p.addScaledVector(d.v, dt); d.v.x += rand(-0.01, 0.01) * dt; d.v.z += rand(-0.01, 0.01) * dt; if (d.p.y < 0.1 || Math.abs(d.p.x) > 3.4 || Math.abs(d.p.z) > 2.9) { d.p.set(rand(-3.3, 3.3), rand(1.5, 2.6), rand(-2.8, 2.8)); } this.dust.set(i, d.p.x, d.p.y, d.p.z); });
    // UV reveal on the poster
    const toP = new THREE.Vector3(2.3, 1.5, 2.99).sub(this.cam.position), dist = toP.length(); toP.normalize();
    const fwd = Player.forward(new THREE.Vector3()), aim = toP.dot(fwd);
    const want = this.light === 'uv' && dist < 5 ? smoothstep(0.88, 0.97, aim) : 0;
    this.uvReveal = damp(this.uvReveal, want, 5, dt); this.uvOverlay.material.opacity = this.uvReveal;
    if (this.uvReveal > 0.7 && !this.s.uvFound) { this.s.uvFound = true; this.found[3] = true; SFX.chime(); HUD.toast(`Glowing letters appear on the poster: <b>Digit #4 = ${this.digits[3]}</b>`, 4); }
    // animations
    this.anim = this.anim.filter((a) => { if (a.delay > 0) { a.delay -= dt; return true; } a.t += dt; a.f(clamp(a.t / a.d, 0, 1)); return a.t < a.d; });
    // countdown
    if (this.wakeT <= 0 && !this.s.escaped) {
      this.timer -= dt;
      if (this.timer <= 30) {
        this.shadowT -= dt;
        if (this.shadowT <= 0) { this.shadowT = rand(7, 11); this.silT = 0; this.silhouette.visible = true; SFX.jouryStep(0, 0.4); }
        this.lineT -= dt; if (this.lineT <= 0) { this.lineT = rand(10, 14); HUD.jourySay(pick(['Almost home…', 'Is someone in my room?', 'Don\'t touch my trophy.', 'I can hear you breathing.'])); SFX.voice(0, 0.35); }
      }
      if (this.timer <= 0) { Game.cabinTimeout(); return; }
    }
    if (this.silhouette.visible) { this.silT += dt; this.silhouette.position.x = lerp(-1.4, 1.4, this.silT / 3.2); if (this.silT > 1.2 && this.silT < 1.25) SFX.jouryStep(0, 0.5); if (this.silT > 3.2) this.silhouette.visible = false; }
    // door opening → escape
    if (this.doorT >= 0) { this.doorT += dt; this.doorPivot.rotation.y = -1.5 * smoothstep(0, 1.2, this.doorT); if (this.doorT > 1.0) GFX.fx.fade = clamp((this.doorT - 1.0) / 0.8, 0, 1); if (this.doorT > 1.9) { this.doorT = -1; Game.escapeCabin(); } }
    SFX.setLoop('fire', 0.12);
  },
};
