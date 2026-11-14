// =====================================================================
//  STORY 2 — JOURY'S HOUSE ("The Phonk Incident")
//  Vivek blasted phonk until Joury snapped, and this time he took Gabe.
//  Sneak into the house, get the key from right beside Joury's PC,
//  unlock Gabe's room and get him out. Joury patrols, hears, chases,
//  checks closets, and throws you out on the lawn when he catches you.
// =====================================================================

// ---------------------------------------------------------------------
//  PHONK — an original cowbell-and-808 beat, made in code (not the real song)
// ---------------------------------------------------------------------
const Phonk = {
  out: null, next: 0, step: 0, vol: 0, bpm: 132, bar: 0,
  // cowbell riff (semitones over D5), one bar of 16th notes; null = rest
  riffA: [0, null, 3, null, 7, null, 3, 5, null, 3, null, 0, 10, null, 7, null],
  riffB: [0, null, 3, null, 7, null, 12, 10, null, 7, null, 5, 3, null, 5, null],
  kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  bass: [0, null, null, null, null, null, -5, null, null, null, -2, null, null, null, null, null],
  ensure() {
    if (!SFX.ctx) return false;
    if (!this.out) { this.out = SFX.ctx.createGain(); this.out.gain.value = 0; this.out.connect(SFX.music); this.next = SFX.ctx.currentTime + 0.05; }
    return true;
  },
  setVol(v) { if (!this.ensure()) return; this.vol = v; this.out.gain.setTargetAtTime(Math.max(0, v), SFX.ctx.currentTime, 0.12); },
  stop() { this.setVol(0); },
  cowbell(t, semi, v) {
    const f = 587.33 * Math.pow(2, semi / 12), ctx = SFX.ctx, bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.8; bp.Q.value = 2.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    [f, f * 1.4836].forEach((fr) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(bp); o.start(t); o.stop(t + 0.2); });
    bp.connect(g); g.connect(this.out);
  },
  tick() {
    if (!SFX.ctx || !this.out || this.vol < 0.002) { if (SFX.ctx) this.next = Math.max(this.next, SFX.ctx.currentTime + 0.05); return; }
    const ctx = SFX.ctx, sp = 60 / this.bpm / 4;
    if (this.next < ctx.currentTime - 0.2) this.next = ctx.currentTime + 0.02;
    while (this.next < ctx.currentTime + 0.15) {
      const t = this.next, s = this.step % 16, riff = (this.bar % 4 === 3) ? this.riffB : this.riffA;
      if (riff[s] !== null) this.cowbell(t, riff[s], 0.32);
      if (this.kick[s]) { SFX.osc('sine', 120, t, 0.22, 0.9, this.out, { slide: 42, slideT: 0.18 }); }
      if (this.bass[s] !== null) SFX.osc('sine', 73.4 * Math.pow(2, this.bass[s] / 12), t, sp * 5, 0.55, this.out, { attack: 0.01 });
      if (s % 2 === 0) SFX.burst(t, 0.04, s % 4 === 2 ? 0.12 : 0.06, 'highpass', 8000, 0.7, this.out);
      if (s === 4 || s === 12) SFX.burst(t, 0.18, 0.28, 'bandpass', 1900, 0.9, this.out);
      this.next += sp; this.step++; if (this.step % 16 === 0) this.bar++;
    }
  },
};

const HOUSE_SLIDES = [
  { label: '1 · THE PHONK', scene: 'room', phonk: true, text: 'A week after the rematch, Vivek hopped in the voice chat and turned his music all the way up.\nPhonk. Cowbells. Bass. For three hours. Joury lives right next door, and the walls are thin.', big: 'TURN. IT. DOWN.', bigRed: true, bigAt: 1.5 },
  { label: '2 · GABE', scene: 'street', mode: 'gone', text: "Joury couldn't get to Vivek. So he took the next best thing.\nThat night, Gabe never made it home. His bike was lying in Joury's front yard." },
  { label: "3 · JOURY'S HOUSE", scene: 'house', text: "The light in the back bedroom is on, and someone is knocking on the window from inside.\nThe front door is locked. Find another way in, get Gabe out, and don't let Joury see you.", big: 'SAVE GABE', bigAt: 4.5 },
];
const HOUSE_LINES = {
  spot: ['HEY! Get OUT of my house!', "Who's touching my stuff?!", 'I SEE YOU.', 'Are you the one playing that music?!', 'Nobody leaves until I say GG!'],
  lost: ["I know you're still in here…", 'Come out, come out…', "You can't hide forever.", 'I can hear you breathing.'],
  noise: ['What was that?', "…Gabe? Is that you?", 'Someone is in my house.'],
};

const House = {
  scene: null, cam: null, flash: null, built: false, solids: [], walls: [], inters: [], doors: {}, hides: {}, s: {}, J: null, gabe: null,
  danger: 0, hidden: null, caughtT: -1, time: 0,
  // ---------------- env interface for Player ----------------
  walkable(x, z) { return x > -15.8 && x < 15.8 && z > -23.8 && z < 23.5; },
  surfaceY() { return 0; },
  surfaceKind(x, z) { return Math.abs(x) < 10 && Math.abs(z) < 7 ? 'wood' : 'grass'; },
  resolve(p, r) {
    if (this.hidden) return;
    const push = (b) => { const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz; if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; } else { const ex = Math.min(p.x - b.x0, b.x1 - p.x), ez = Math.min(p.z - b.z0, b.z1 - p.z); if (ex < ez) p.x = p.x - b.x0 < b.x1 - p.x ? b.x0 - r : b.x1 + r; else p.z = p.z - b.z0 < b.z1 - p.z ? b.z0 - r : b.z1 + r; } } };
    for (const b of this.solids) push(b);
    for (const k in this.doors) { const d = this.doors[k]; if (!d.open) push(d.box); }
    p.x = clamp(p.x, -15.75, 15.75); p.z = clamp(p.z, -23.75, 23.4);
  },
  solid(x0, x1, z0, z1, wall) { const b = { x0, x1, z0, z1 }; this.solids.push(b); if (wall) this.walls.push(b); return b; },
  // a wall run along x (at z) or along z (at x), with gaps for doorways
  wallX(z, x0, x1, gaps, b, col, key, h = 3) { let a = x0; (gaps || []).concat([[x1, x1]]).forEach(([g0, g1]) => { if (g0 > a) { b.box(g0 - a, h, 0.2, (a + g0) / 2, h / 2, z, col, key); this.solid(a, g0, z - 0.1, z + 0.1, true); } if (g1 > g0) b.box(g1 - g0, h - 2.25, 0.2, (g0 + g1) / 2, 2.25 + (h - 2.25) / 2, z, col, key); a = g1; }); },
  wallZ(x, z0, z1, gaps, b, col, key, h = 3) { let a = z0; (gaps || []).concat([[z1, z1]]).forEach(([g0, g1]) => { if (g0 > a) { b.box(0.2, h, g0 - a, x, h / 2, (a + g0) / 2, col, key); this.solid(x - 0.1, x + 0.1, a, g0, true); } if (g1 > g0) b.box(0.2, h - 2.25, g1 - g0, x, 2.25 + (h - 2.25) / 2, (g0 + g1) / 2, col, key); a = g1; }); },
  hit(id, x0, y0, z0, x1, y1, z1) { this.inters.push({ id, box: new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)) }); },
  door(id, pivotX, pivotZ, alongX, len, col, box) {
    const pivot = new THREE.Group(); pivot.position.set(pivotX, 0, pivotZ); this.scene.add(pivot);
    const panel = mesh(new THREE.BoxGeometry(alongX ? len : 0.08, 2.2, alongX ? 0.08 : len), plainMat(col, 0.6)); panel.position.set(alongX ? len / 2 : 0, 1.1, alongX ? 0 : len / 2); pivot.add(panel);
    const knob = mesh(new THREE.SphereGeometry(0.04, 10, 8), plainMat(0xc9a85a, 0.3, 0.8)); knob.position.set(alongX ? len - 0.12 : 0.07, 1.05, alongX ? 0.07 : len - 0.12); pivot.add(knob);
    const k2 = knob.clone(); k2.position.set(alongX ? len - 0.12 : -0.07, 1.05, alongX ? -0.07 : len - 0.12); pivot.add(k2);
    const d = this.doors[id] = { pivot, panel, open: false, box, alongX, t: 0, target: 0 }; return d;
  },

  build() {
    if (this.built) return; this.built = true;
    const scene = this.scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a12); scene.fog = new THREE.FogExp2(0x0b0f1a, 0.028);
    const cam = this.cam = GFX.camera(70, 0.05, 140); cam.rotation.order = 'YXZ'; scene.add(cam);
    this.flash = makeFlashlight(cam, 0xfff1d6, Math.min(1024, Q().spotShadow), true); this.flash.distance = 26; this.flash.userData.base = 7;
    scene.add(new THREE.HemisphereLight(0x6a7896, 0x2a2018, 0.55));
    const moon = new THREE.DirectionalLight(0x8aa0d0, 0.9); moon.position.set(-20, 30, 20); scene.add(moon);
    const b = new Builder(), siding = 0x4f6a86, trim = 0xe8e2d4, roof = 0x6a3430;
    const smooth = fogify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 }));
    // ---------- ground, street, sidewalk ----------
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), pbrMat('grass', { repeat: 18, roughness: 0.95 })); grass.rotation.x = -Math.PI / 2; grass.position.y = -0.012; grass.receiveShadow = true; scene.add(grass);
    b.box(60, 0.04, 2.6, 0, 0.0, 21.8, 0x8a8680, 'stone'); b.box(60, 0.02, 9, 0, -0.005, 27.6, 0x232326, 'stone');
    for (let x = -28; x < 30; x += 4) b.box(1.8, 0.012, 0.16, x, 0.012, 27.6, 0xd8c860, 'plain');
    b.box(1.6, 0.03, 13, 0, 0.0, 13.5, 0x8a8680, 'stone'); // front path
    // ---------- the house: floor, ceiling, outer walls ----------
    b.box(20.2, 0.1, 14.2, 0, -0.05, 0, 0x6a4a30, 'wood');
    { const cv = makeCanvas(256, 256), g = cv.getContext('2d'); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#1c1c1e' : '#d8d4cc'; g.fillRect(x * 32, y * 32, 32, 32); } g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke(); }
      const t = texFrom(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3.5, 3); const tiles = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 6.8), fogify(new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 }))); tiles.rotation.x = -Math.PI / 2; tiles.position.set(-6, 0.012, -3.5); tiles.receiveShadow = true; scene.add(tiles); }
    b.box(20.2, 0.1, 14.2, 0, 2.95, 0, 0xcfc6b4, 'smooth');
    this.wallX(7, -10, 10, [[-0.7, 0.7]], b, siding, 'wood'); this.wallX(-7, -10, 10, [[-0.7, 0.7]], b, siding, 'wood');
    this.wallZ(-10, -7, 7, [], b, siding, 'wood'); this.wallZ(10, -7, 7, [], b, siding, 'wood');
    // interior walls (wallpaper), with doorways
    this.wallZ(-2, -7, 7, [[-3.5, -2.1], [3.0, 4.4]], b, 0xb8a888, 'wallpaper'); this.wallZ(2, -7, 7, [[-3.5, -2.1], [3.0, 4.4]], b, 0xa89ab0, 'wallpaper');
    this.wallX(0, -10, -2, [[-7, -5.6]], b, 0xc8b898, 'wallpaper'); this.wallX(0, 2, 10, [], b, 0x9a8a9a, 'wallpaper');
    // inner faces of the outer walls get wallpaper too
    [[-9.88, 0, 0.04, 13.8, 0xc8b898], [9.88, 0, 0.04, 13.8, 0x8a7a9a]].forEach(([x, z, w, d, c]) => b.box(w, 2.9, d, x, 1.45, z, c, 'wallpaper'));
    [[-6, 6.88], [6, 6.88], [-6, -6.88], [6, -6.88]].forEach(([x, z]) => b.box(7.9, 2.9, 0.04, x, 1.45, z, x < 0 ? 0xc8b898 : 0x9a8a9a, 'wallpaper'));
    [6.88, -6.88].forEach((z) => { [-1.35, 1.35].forEach((x) => b.box(1.3, 2.9, 0.04, x, 1.45, z, 0xb8a888, 'wallpaper')); b.box(1.4, 0.65, 0.04, 0, 2.58, z, 0xb8a888, 'wallpaper'); });
    // trim: corner boards and skirting
    [[-10.1, 7.1], [10.1, 7.1], [-10.1, -7.1], [10.1, -7.1]].forEach(([x, z]) => b.box(0.24, 3.0, 0.24, x, 1.5, z, trim, 'wood'));
    b.box(20.6, 0.2, 0.3, 0, 3.05, 7.1, trim, 'wood'); b.box(20.6, 0.2, 0.3, 0, 3.05, -7.1, trim, 'wood');
    // gable roof
    const ang = Math.atan2(2.4, 7.6), slab = Math.hypot(7.6, 2.4);
    b.box(21.4, 0.22, slab, 0, 4.25, 3.8, roof, 'wood', 0, ang); b.box(21.4, 0.22, slab, 0, 4.25, -3.8, roof, 'wood', 0, -ang); b.box(21.6, 0.2, 0.4, 0, 5.45, 0, 0x4a2422, 'wood');
    b.box(0.9, 1.6, 0.9, 6, 5.2, -2.5, 0x6a5a52, 'stone'); // chimney
    for (let i = 0; i < 6; i++) { const h = 0.4, y = 3.1 + i * h, w = 14 * (1 - (i + 0.5) / 6); [-10, 10].forEach((x) => b.box(0.2, h, w, x, y + h / 2, 0, siding, 'wood')); }
    // porch, steps, posts, porch roof
    b.box(5, 0.25, 2.4, 0, 0.12, 8.3, 0x7a6a5a, 'wood'); b.box(2, 0.12, 0.6, 0, 0.06, 9.8, 0x7a6a5a, 'wood');
    [-2.3, 2.3].forEach((x) => b.box(0.16, 2.6, 0.16, x, 1.42, 9.3, trim, 'wood')); b.box(5.4, 0.16, 2.8, 0, 2.8, 8.5, roof, 'stone', 0, -0.12);
    // windows (glowing panes from outside, dark glass from inside)
    const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 0.72, 0.36) }), winRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.22, 0.42) }), winDark = new THREE.MeshBasicMaterial({ color: 0x0c1220 });
    const win = (x, z, rot, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), mat); m.position.set(x, 1.65, z); m.rotation.y = rot; scene.add(m);
      const fx = rot === 0 || rot === Math.PI; b.box(fx ? 0.06 : 0.1, 1.2, fx ? 0.1 : 0.06, x, 1.65, z, trim, 'wood'); b.box(fx ? 1.4 : 0.1, 0.06, fx ? 0.1 : 1.4, x, 1.65, z, trim, 'wood');
      [-1, 1].forEach((sd) => b.box(fx ? 0.12 : 0.1, 1.36, fx ? 0.1 : 0.12, x + (fx ? sd * 0.74 : 0), 1.65, z + (fx ? 0 : sd * 0.74), trim, 'wood')); b.box(rot === 0 || rot === Math.PI ? 1.6 : 0.14, 0.12, rot === 0 || rot === Math.PI ? 0.14 : 1.6, x, 1.0, z, trim, 'wood'); b.box(rot === 0 || rot === Math.PI ? 1.6 : 0.14, 0.12, rot === 0 || rot === Math.PI ? 0.14 : 1.6, x, 2.3, z, trim, 'wood'); };
    win(-6, 7.12, 0, winMat); win(6, 7.12, 0, winRed); win(-6, -7.12, Math.PI, winMat); win(6, -7.12, Math.PI, winMat); win(10.12, -3.5, Math.PI / 2, winMat); win(-10.12, 3.5, -Math.PI / 2, winMat);
    [[-6, 6.85, Math.PI], [6, 6.85, Math.PI], [-6, -6.85, 0], [6, -6.85, 0]].forEach(([x, z, r]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), winDark); m.position.set(x, 1.65, z); m.rotation.y = r; scene.add(m); });
    // boards nailed over Gabe's window, from the inside
    for (let i = 0; i < 3; i++) b.box(0.06, 0.16, 1.7, 9.83, 1.25 + i * 0.4, -3.5, 0x6a5038, 'wood', 0, 0, 0);
    // ---------- living room ----------
    b.box(0.9, 0.45, 2.6, -6.5, 0.23, 3.5, 0x6a3030, 'smooth'); b.box(0.25, 0.85, 2.6, -6.1, 0.43, 3.5, 0x6a3030, 'smooth'); [[-6.5, 2.1], [-6.5, 4.9]].forEach(([x, z]) => b.box(0.9, 0.6, 0.22, x, 0.3, z, 0x5a2626, 'smooth'));
    [2.75, 4.25].forEach((z) => b.box(0.7, 0.12, 1.2, -6.55, 0.5, z, 0x7a3838, 'smooth')); // cushions
    this.solid(-7.0, -5.95, 2.0, 5.0); this.hit('sofa', -7.0, 0, 2.0, -5.95, 0.9, 5.0);
    b.box(0.5, 0.5, 1.6, -9.5, 0.25, 3.5, 0x2a1e16, 'wood'); b.box(0.12, 0.85, 1.5, -9.5, 0.95, 3.5, 0x0c0c0e, 'plain');
    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.74), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.3, 0.5) })); tvScreen.position.set(-9.43, 0.95, 3.5); tvScreen.rotation.y = Math.PI / 2; scene.add(tvScreen); this.tvScreen = tvScreen;
    this.solid(-9.8, -9.2, 2.6, 4.4); this.hit('tv', -9.8, 0.4, 2.7, -9.3, 1.4, 4.3);
    for (let i = 0; i < 5; i++) b.box(3.4, 0.02, 0.5, -6.3, 0.012, 1.5 + i * 0.55, i % 2 ? 0x6a2a24 : 0x2a3a5a, 'plain');
    // wardrobe (hiding spot)
    b.box(0.8, 2.1, 1.4, -9.5, 1.05, 5.75, 0x3a2618, 'wood'); b.box(0.03, 1.9, 0.02, -9.09, 1.05, 5.75, 0x1a100a, 'wood');
    this.solid(-9.9, -9.1, 5.05, 6.45); this.hit('wardrobe', -9.9, 0, 5.05, -9.05, 2.1, 6.45);
    this.hides.wardrobe = { x: -9.5, z: 5.75, yaw: -Math.PI / 2, out: { x: -8.6, z: 5.75 } };
    // family photos in the hallway
    for (let i = 0; i < 4; i++) { b.box(0.04, 0.5, 0.4, -1.88, 1.6 + (i % 2) * 0.25, -4 + i * 2.2, 0x2a1a10, 'wood'); }
    this.hit('photos', -1.95, 1.2, -4.5, -1.8, 2.2, 3.0);
    for (let i = 0; i < 12; i++) b.box(1.2, 0.015, 1.0, 0, 0.012, -6 + i * 1.08, i % 2 ? 0x6a2a24 : 0x5a2420, 'plain'); // runner
    // ---------- kitchen ----------
    b.box(7.6, 0.9, 0.7, -6, 0.45, -6.5, 0xe2ddd2, 'smooth'); for (let i = 0; i < 7; i++) b.box(0.02, 0.7, 0.02, -9.3 + i * 1.05, 0.48, -6.14, 0x8a8478, 'metal'); b.box(7.7, 0.06, 0.75, -6, 0.93, -6.48, 0x3a3a3c, 'stone'); this.solid(-9.9, -5.0, -6.9, -6.1);
    b.box(0.95, 2.0, 0.85, -9.35, 1.0, -6.4, 0xeceae6, 'smooth'); b.box(0.04, 0.5, 0.04, -8.95, 1.3, -5.96, 0x8a8a8a, 'metal'); b.box(0.9, 0.015, 0.02, -9.35, 1.42, -5.97, 0x9a9a9a, 'metal'); this.hit('fridge', -9.8, 0, -6.85, -8.9, 2.0, -5.95);
    b.box(1.8, 0.08, 1.1, -6, 0.78, -3.4, 0x6a4a30, 'wood'); [[-6.8, -3.8], [-5.2, -3.8], [-6.8, -3.0], [-5.2, -3.0]].forEach(([x, z]) => b.box(0.08, 0.78, 0.08, x, 0.39, z, 0x4a3220, 'wood'));
    this.solid(-6.95, -5.05, -4.0, -2.8);
    // pantry (hiding spot)
    b.box(1.0, 2.1, 0.7, -4.0, 1.05, -6.5, 0x5a4026, 'wood'); b.box(0.02, 1.9, 0.02, -4.0, 1.05, -6.13, 0x1a100a, 'wood');
    this.solid(-4.5, -3.5, -6.9, -6.15); this.hit('pantry', -4.55, 0, -6.9, -3.45, 2.1, -6.1);
    this.hides.pantry = { x: -4.0, z: -6.5, yaw: Math.PI, out: { x: -4.0, z: -5.6 } };
    // ---------- Joury's gaming room ----------
    b.box(0.9, 0.08, 3.0, 9.35, 0.78, 3.1, 0x16161a, 'plain'); [[9.0, 1.7], [9.7, 1.7], [9.0, 4.5], [9.7, 4.5]].forEach(([x, z]) => b.box(0.06, 0.78, 0.06, x, 0.39, z, 0x222222, 'metal'));
    this.solid(8.9, 9.9, 1.6, 4.6);
    const screenMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.35, 0.9) });
    [[2.6, -0.25], [3.6, 0.25]].forEach(([z, ry]) => { b.box(0.06, 0.6, 0.95, 9.65, 1.25, z, 0x0c0c0e, 'plain', ry); const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.52), screenMat); s2.position.set(9.6, 1.25, z); s2.rotation.y = -Math.PI / 2 + ry; scene.add(s2); });
    this.hit('pc', 9.0, 0.8, 1.9, 9.9, 1.6, 4.3);
    [[9.6, 1.85], [9.6, 4.35]].forEach(([x, z]) => b.box(0.22, 0.4, 0.22, x, 1.02, z, 0x18181c, 'plain')); // speakers
    // gaming chair (he sits here, facing the screens)
    b.box(0.56, 0.1, 0.56, 8.2, 0.52, 3.1, 0x18181c, 'plain'); b.box(0.1, 0.86, 0.54, 7.88, 1.0, 3.1, 0x18181c, 'plain', 0, 0, 0.14); b.cyl(0.035, 0.035, 0.36, 8.2, 0.3, 3.1, 0x333333, 'metal', 8);
    // the key, on a hook right next to his PC
    b.box(0.04, 0.04, 0.12, 9.86, 1.75, 5.3, 0x8a8a8a, 'metal');
    this.keyMesh = new THREE.Group(); { const ring = mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 14), plainMat(0xc9a85a, 0.3, 0.9)); const shaft = mesh(new THREE.BoxGeometry(0.015, 0.11, 0.012), plainMat(0xc9a85a, 0.3, 0.9)); shaft.position.y = -0.08; this.keyMesh.add(ring, shaft); }
    this.keyMesh.position.set(9.8, 1.66, 5.3); this.keyMesh.rotation.y = Math.PI / 2; scene.add(this.keyMesh);
    this.glints = new GlowSet(4, 30); scene.add(this.glints.points); this.keyGlint = this.glints.add(9.78, 1.62, 5.3, 0xffd890, 0.07, 0.5); this.hit('key', 9.55, 1.4, 5.05, 9.95, 1.9, 5.55);
    // posters, LED strip, a mini fridge of energy drinks
    { const cv = makeCanvas(256, 360), g = cv.getContext('2d'); g.fillStyle = '#120818'; g.fillRect(0, 0, 256, 360); g.fillStyle = '#ff2b6a'; g.font = 'bold 120px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('5-4', 128, 170); g.fillStyle = '#e8e2d4'; g.font = 'bold 30px Impact, sans-serif'; g.fillText('IT WAS LAG', 128, 240); g.fillStyle = '#7a6aff'; g.font = '22px monospace'; g.fillText('NO PHONK ZONE', 128, 300);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), new THREE.MeshStandardMaterial({ map: texFrom(cv), roughness: 0.8 })); p.position.set(6, 1.7, 6.85); p.rotation.y = Math.PI; scene.add(p); this.hit('poster', 5.4, 1.0, 6.7, 6.6, 2.4, 6.95); }
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 6.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.3, 1.6) })); led.position.set(9.85, 2.85, 3.5); scene.add(led); this.led = led;
    b.box(0.6, 0.8, 0.6, 3.0, 0.4, 6.3, 0x22222a, 'metal'); this.solid(2.7, 3.3, 6.0, 6.6); this.hit('drinks', 2.7, 0, 6.0, 3.3, 0.85, 6.6);
    // ---------- Gabe's room (the prison) ----------
    b.box(2.1, 0.4, 2.6, 8.6, 0.2, -5.5, 0x3a2618, 'wood'); b.box(2.0, 0.18, 2.5, 8.6, 0.48, -5.5, 0xd8d2c4, 'smooth'); b.box(2.02, 0.08, 1.6, 8.6, 0.6, -5.0, 0x2f62d6, 'smooth'); b.box(0.9, 0.14, 0.4, 8.6, 0.64, -6.5, 0xeee8da, 'smooth');
    this.solid(7.55, 9.9, -6.9, -4.2);
    for (let i = 0; i < 30; i++) b.box(0.07, 0.05, 0.1, rand(3.5, 6.5), 0.03, rand(-6.5, -1), pick([0xff4a8a, 0xffd23a, 0x4ad0ff, 0x7aff6a]), 'plain', rand(0, 3)); // his candy, everywhere
    b.box(0.6, 0.6, 0.6, 3.0, 0.3, -6.3, 0x6a4a2a, 'wood'); this.solid(2.7, 3.3, -6.6, -6.0); // toy box
    // ---------- doors ----------
    this.door('front', -0.7, 7.0, true, 1.4, 0x6a1a1e, { x0: -0.7, x1: 0.7, z0: 6.9, z1: 7.1 });
    this.door('back', -0.7, -7.0, true, 1.4, 0x5a4a3a, { x0: -0.7, x1: 0.7, z0: -7.1, z1: -6.9 });
    this.door('bedroom', 2.0, -3.5, false, 1.4, 0x7a6a5a, { x0: 1.9, x1: 2.1, z0: -3.5, z1: -2.1 });
    this.hit('frontdoor', -0.75, 0, 6.75, 0.75, 2.25, 7.25); this.hit('backdoor', -0.75, 0, -7.25, 0.75, 2.25, -6.75); this.hit('beddoor', 1.75, 0, -3.55, 2.25, 2.25, -2.05);
    // boards on the back door (outside) and the padlock on Gabe's door (hallway side)
    this.boards = new THREE.Group(); scene.add(this.boards);
    [[0.6, 0.15], [1.2, -0.2], [1.75, 0.1]].forEach(([y, r]) => { const bd = mesh(new THREE.BoxGeometry(1.8, 0.18, 0.05), plainMat(0x7a5a3a, 0.9)); bd.position.set(0, y, -7.13); bd.rotation.z = r; this.boards.add(bd); });
    this.padlock = new THREE.Group(); { const body = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.1), plainMat(0xb8a040, 0.35, 0.8)); const shackle = mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), plainMat(0x9a9aa0, 0.3, 0.9)); shackle.position.y = 0.07; shackle.rotation.y = Math.PI / 2; this.padlock.add(body, shackle); }
    this.padlock.position.set(1.86, 1.05, -2.25); scene.add(this.padlock);
    // ---------- yard: fence, gate, shed, bike, mailbox, sign ----------
    const fence = 0xd8d0c0;
    const fenceRun = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 0.32), along = Math.abs(x1 - x0) > Math.abs(z1 - z0); for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t); b.box(0.09, 1.1, 0.09, x, 0.55, z, fence, 'wood'); } b.box(along ? len : 0.05, 0.08, along ? 0.05 : len, (x0 + x1) / 2, 0.85, (z0 + z1) / 2, fence, 'wood'); b.box(along ? len : 0.05, 0.08, along ? 0.05 : len, (x0 + x1) / 2, 0.35, (z0 + z1) / 2, fence, 'wood'); this.solid(Math.min(x0, x1) - 0.06, Math.max(x0, x1) + 0.06, Math.min(z0, z1) - 0.06, Math.max(z0, z1) + 0.06); };
    fenceRun(-16, 20, -1.3, 20); fenceRun(1.3, 20, 16, 20); fenceRun(-16, -24, 16, -24); fenceRun(-16, -24, -16, 20); fenceRun(16, -24, 16, 20);
    fenceRun(-16, 1, -10.2, 1); // the west side is fenced off: the way round is on the east side
    b.box(1.2, 1.1, 0.06, 2.0, 0.55, 20.6, fence, 'wood', 0.9); // front gate, swung open
    this.hit('gate', -1.3, 0, 19.6, 1.3, 1.6, 20.4);
    // shed in the back yard
    const shedCol = 0x5a4632;
    b.box(5, 2.6, 0.15, 9.5, 1.3, -20.5, shedCol, 'wood'); b.box(0.15, 2.6, 4, 7.0, 1.3, -18.5, shedCol, 'wood'); b.box(0.15, 2.6, 4, 12.0, 1.3, -18.5, shedCol, 'wood');
    b.box(1.8, 2.6, 0.15, 7.9, 1.3, -16.5, shedCol, 'wood'); b.box(1.8, 2.6, 0.15, 11.1, 1.3, -16.5, shedCol, 'wood'); b.box(1.4, 0.4, 0.15, 9.5, 2.4, -16.5, shedCol, 'wood');
    b.box(5.4, 0.15, 4.6, 9.5, 2.7, -18.5, roof, 'stone', 0, 0.1);
    this.solid(7.0, 12.0, -20.6, -20.4); this.solid(6.9, 7.1, -20.5, -16.5); this.solid(11.9, 12.1, -20.5, -16.5); this.solid(7.0, 8.8, -16.6, -16.4); this.solid(10.2, 12.0, -16.6, -16.4);
    this.door('shed', 8.8, -16.5, true, 1.4, 0x6a5038, { x0: 8.8, x1: 10.2, z0: -16.6, z1: -16.4 }); this.hit('sheddoor', 8.75, 0, -16.75, 10.25, 2.25, -16.25);
    b.box(2.4, 0.08, 0.7, 9.5, 0.9, -20.0, 0x6a5038, 'wood'); [[8.4, -20.2], [10.6, -20.2]].forEach(([x, z]) => b.box(0.08, 0.9, 0.08, x, 0.45, z, 0x4a3828, 'wood')); this.solid(8.25, 10.75, -20.4, -19.6);
    this.crowbar = new THREE.Group(); { const bar = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.75, 8), plainMat(0xa01a22, 0.45, 0.6)); bar.rotation.z = Math.PI / 2; const hook = mesh(new THREE.TorusGeometry(0.045, 0.016, 6, 10, Math.PI), plainMat(0xa01a22, 0.45, 0.6)); hook.position.x = -0.4; this.crowbar.add(bar, hook); }
    this.crowbar.position.set(9.5, 0.96, -19.9); scene.add(this.crowbar); this.hit('crowbar', 9.0, 0.85, -20.2, 10.0, 1.15, -19.6);
    const shedLight = new THREE.PointLight(0xffd8a0, 2.2, 6, 1.5); shedLight.position.set(9.5, 2.3, -18.5); scene.add(shedLight);
    // Gabe's bike, on its side in the yard
    { const bike = new THREE.Group(); [-0.5, 0.5].forEach((x) => { const w = mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 20), plainMat(0x111111, 0.7)); w.position.set(x, 0, 0); bike.add(w); }); const fr = mesh(new THREE.BoxGeometry(1.0, 0.04, 0.04), plainMat(0x2f8a3a, 0.4, 0.4)); fr.position.y = 0.2; bike.add(fr); bike.rotation.x = -Math.PI / 2; bike.rotation.z = 0.6; bike.position.set(-4.5, 0.04, 14); scene.add(bike); this.hit('bike', -5.3, 0, 13.3, -3.7, 0.5, 14.7); }
    b.box(0.12, 1.1, 0.12, 4.0, 0.55, 19.5, 0x3a3a3a, 'metal'); b.box(0.5, 0.35, 0.3, 4.0, 1.2, 19.5, 0x2a2a30, 'metal'); this.hit('mailbox', 3.7, 0.9, 19.3, 4.3, 1.45, 19.7);
    { const cv = makeCanvas(256, 160), g = cv.getContext('2d'); g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#a01a22'; g.font = 'bold 44px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('NO PHONK', 128, 64); g.fillStyle = '#222'; g.font = 'bold 26px Impact, sans-serif'; g.fillText('BEYOND THIS POINT', 128, 112);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62), new THREE.MeshStandardMaterial({ map: texFrom(cv), roughness: 0.8, side: THREE.DoubleSide })); sg.position.set(-3, 0.95, 18.5); scene.add(sg); b.box(0.06, 0.7, 0.06, -3, 0.35, 18.46, 0x6a5038, 'wood'); this.hit('sign', -3.55, 0.6, 18.3, -2.45, 1.3, 18.7); }
    // street light
    b.cyl(0.08, 0.1, 6, 7, 3, 23.4, 0x2a2a2e, 'metal', 8); b.box(1.2, 0.1, 0.1, 6.45, 5.95, 23.4, 0x2a2a2e, 'metal');
    const sl = new THREE.PointLight(0xffc070, 9, 16, 1.4); sl.position.set(5.9, 5.7, 23.4); scene.add(sl);
    const porch = new THREE.PointLight(0xffd090, 3.5, 7, 1.5); porch.position.set(0, 2.5, 8.6); scene.add(porch);
    // a few trees around the property
    instancedTrees(scene, [[-20, -10], [-21, 8], [20, -6], [21, 12], [-14, -30], [14, -30], [0, -32], [-24, 22], [24, 24]].map(([x, z], i) => ({ kind: i % 3 ? 'oak' : 'pine', variant: i % 2, x, y: 0, z, s: 2.2 + (i % 3) * 0.4, ry: i * 1.3 })), { cast: false });
    scene.add(b.build({ uvScale: 1.1, mats: { smooth } }));
    // ---------- interior lights ----------
    const L = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 1.5); l.position.set(x, y, z); scene.add(l); return l; };
    this.hallLight = L(0xffc890, 3.2, 9, 0, 2.6, 0); this.tvLight = L(0x7a9aff, 2.5, 6, -8.6, 1.2, 3.5); this.pcLight = L(0xff3a9a, 4.2, 7, 8.6, 1.6, 3.1);
    this.kitchenLight = L(0xfff0d8, 2.0, 7, -6, 2.6, -3.5); this.gabeLight = L(0xffb070, 1.6, 6, 6, 2.2, -3.5);
    // ---------- Joury and Gabe ----------
    this.J = makeJoury(); scene.add(this.J.root);
    this.gabe = makeHuman({ skin: 0xe0b08a, shirt: 0x3a7a3a, pants: 0x2c3446, shoes: 0xe8e8e8, hair: 0x6a4428, face: { wide: true, look: 1 } }); this.gabe.root.scale.setScalar(1.05); scene.add(this.gabe.root);
    this.hit('gabe', 7.0, 0, -6.2, 8.4, 1.5, -4.4);
    // nav graph for Joury
    const N = this.nodes = { HF: [0, 5.5], HM: [0, 0.5], HB: [0, -5.5], LD: [-2, 3.7], LC: [-5, 5.3], LK: [-6.3, 0], KD: [-2, -2.8], KC: [-4.2, -4.4], KW: [-8.3, -2], GD: [2, 3.7], GC: [5, 5.0], GP: [8.2, 3.1], BD: [2, -2.8], BC: [5, -3.0], BK: [0, -8.6], Y1: [0, -13], Y2: [6, -13.5], Y3: [-7, -14] };
    this.edges = [['HF', 'HM'], ['HM', 'HB'], ['HF', 'LD'], ['HM', 'LD'], ['LD', 'LC'], ['LC', 'LK'], ['LK', 'KC'], ['KC', 'KW'], ['KC', 'KD'], ['KD', 'HM'], ['KD', 'HB'], ['HF', 'GD'], ['HM', 'GD'], ['GD', 'GC'], ['GC', 'GP'], ['HM', 'BD', 'bedroom'], ['HB', 'BD', 'bedroom'], ['BD', 'BC', 'bedroom'], ['HB', 'BK', 'back'], ['BK', 'Y1', 'back'], ['Y1', 'Y2', 'back'], ['Y1', 'Y3', 'back']];
    Object.keys(N).forEach((k) => { N[k] = { x: N[k][0], z: N[k][1], id: k }; });
  },

  // ---------------- per-game state ----------------
  reset() {
    this.build();
    this.s = { crowbar: false, boardsOff: false, key: false, unlocked: false, gabeFree: false, frontOpen: false, shedOpen: false, inside: false, seenBack: false };
    Object.values(this.doors).forEach((d) => { d.open = false; d.target = 0; d.pivot.rotation.y = 0; });
    this.boards.visible = true; this.boards.children.forEach((bd, i) => { bd.position.set(0, [0.6, 1.2, 1.75][i], -7.13); bd.rotation.set(0, 0, [0.15, -0.2, 0.1][i]); });
    this.padlock.visible = true; this.keyMesh.visible = true; this.crowbar.visible = true; this.glints.setSize(this.keyGlint, 0.07);
    this.hidden = null; this.caughtT = -1; this.time = 0; this.caught = 0; this.danger = 0; this.pryT = -1;
    const j = this.j = { x: 8.2, z: 3.1, yaw: Math.PI / 2, state: 'sit', t: 0, sitT: rand(28, 40), path: [], goal: null, seenT: 0, lastSeen: null, lookT: 0, sawHide: 0, lineT: 0, speed: 0, moving: false, walkT: 0 };
    this.J.root.position.set(j.x, 0, j.z);
    this.gabeS = { follow: false, x: 7.7, z: -5.3, yaw: -Math.PI / 2, t: 0 };
  },
  playerInside() { const P = Player.pos; return Math.abs(P.x) < 10 && Math.abs(P.z) < 7; },
  roomOf(x, z) { if (Math.abs(x) >= 10 || Math.abs(z) >= 7) return 'out'; if (x < -2) return z > 0 ? 'living' : 'kitchen'; if (x > 2) return z > 0 ? 'gaming' : 'bedroom'; return 'hall'; },

  // ---------------- line of sight & navigation ----------------
  segHits(ax, az, bx, bz, b) {
    let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
    for (const [p, q, lo, hi] of [[ax, dx, b.x0, b.x1], [az, dz, b.z0, b.z1]]) {
      if (Math.abs(q) < 1e-9) { if (p < lo || p > hi) return false; } else { let u = (lo - p) / q, v = (hi - p) / q; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false; }
    }
    return true;
  },
  clear(ax, az, bx, bz) {
    for (const w of this.walls) if (this.segHits(ax, az, bx, bz, w)) return false;
    for (const k in this.doors) { const d = this.doors[k]; if (!d.open && this.segHits(ax, az, bx, bz, d.box)) return false; }
    return true;
  },
  edgeOpen(e) { return !e[2] || (e[2] === 'bedroom' ? this.s.unlocked : e[2] === 'back' ? this.s.boardsOff : true); },
  nearestNode(x, z, needClear) {
    let best = null, bd = Infinity;
    for (const k in this.nodes) { const n = this.nodes[k], d = Math.hypot(n.x - x, n.z - z); if (d < bd && (!needClear || this.clear(x, z, n.x, n.z))) { if (!this.reachable(k)) continue; bd = d; best = n; } }
    return best;
  },
  reachable(k) { if (['BD', 'BC'].includes(k) && !this.s.unlocked) return false; if (['BK', 'Y1', 'Y2', 'Y3'].includes(k) && !this.s.boardsOff) return false; return true; },
  route(from, to) {
    if (!from || !to) return [];
    const prev = { [from.id]: null }, q = [from.id];
    while (q.length) { const c = q.shift(); if (c === to.id) break; for (const e of this.edges) { if (!this.edgeOpen(e)) continue; const n = e[0] === c ? e[1] : e[1] === c ? e[0] : null; if (n && !(n in prev)) { prev[n] = c; q.push(n); } } }
    if (!(to.id in prev)) return [];
    const path = []; for (let c = to.id; c; c = prev[c]) path.unshift(this.nodes[c]); return path;
  },
  goTo(x, z) { const j = this.j; const a = this.nearestNode(j.x, j.z, true) || this.nearestNode(j.x, j.z), b = this.nearestNode(x, z, true) || this.nearestNode(x, z); j.path = this.route(a, b); j.goal = { x, z }; },

  // ---------------- what Joury notices ----------------
  canSee() {
    if (this.hidden) return false;
    const j = this.j, P = Player.pos, dx = P.x - j.x, dz = P.z - j.z, d = Math.hypot(dx, dz);
    if (j.state === 'sit') return d < 1.6; // facing his screens: only right behind his chair
    const range = (Player.lightOn ? 17 : 11) * (Player.crouching ? 0.62 : 1);
    if (d > range) return false;
    const facing = (dx * Math.sin(j.yaw) + dz * Math.cos(j.yaw)) / Math.max(d, 0.01);
    if (facing < 0.42 && d > 2.2) return false;
    return this.clear(j.x, j.z, P.x, P.z);
  },
  noise(radius, x, z) { // something loud happened at x,z
    const j = this.j; if (j.state === 'chase' || this.caughtT >= 0) return;
    if (Math.hypot(x - j.x, z - j.z) > radius) return;
    if (j.state === 'sit') this.standUp();
    j.state = 'investigate'; j.lookT = 4; this.goTo(x, z); this.say(pick(HOUSE_LINES.noise));
  },
  standUp() { const j = this.j; j.state = 'patrol'; SFX.creak && SFX.creak(); if (Game.state === 'house') HUD.toast('<b>The music stopped.</b> Joury got up.', 2.5); },
  say(text) { const now = this.time; if (now - (this.j.saidAt || -9) < 4) return; this.j.saidAt = now; HUD.jourySay(text); SFX.voice(0, clamp(0.8 - Math.hypot(Player.pos.x - this.j.x, Player.pos.z - this.j.z) / 30, 0.15, 0.7), this.j.state === 'chase'); },

  // ---------------- every frame ----------------
  update(dt) {
    this.time += dt; const j = this.j, P = Player.pos, J = this.J;
    if (this.playerInside()) this.s.inside = true;
    // doors swing
    Object.values(this.doors).forEach((d) => { d.t = damp(d.t, d.open ? 1 : 0, 5, dt); d.pivot.rotation.y = (d.alongX ? 1.45 : -1.45) * d.t; });
    // prying the boards off
    if (this.pryT >= 0) { this.pryT += dt; const k = this.pryT; this.boards.children.forEach((bd, i) => { if (k > 0.3 + i * 0.35) { bd.position.y -= dt * 2.5; bd.rotation.z += dt * (i - 1) * 3; bd.position.z -= dt * 0.6; } }); if (k > 1.7) { this.pryT = -1; this.boards.visible = false; this.s.boardsOff = true; this.doors.back.open = true; HUD.toast('The boards are off. <b>The back door is open.</b>', 3); } }
    // flicker
    this.tvLight.intensity = 2.2 + Math.sin(this.time * 17) * 0.6 + (Math.random() < 0.05 ? -1.5 : 0); this.tvScreen.material.color.setRGB(0.16 + Math.random() * 0.06, 0.24, 0.45);
    this.pcLight.color.setHSL(0.9 + Math.sin(this.time * 0.8) * 0.06, 1, 0.55);
    // caught: Joury in your face, then thrown out on the lawn
    if (this.caughtT >= 0) { this.updateCaught(dt); return; }
    this.think(dt);
    // the model
    J.root.position.set(j.x, 0, j.z); J.root.rotation.y = j.yaw; J.root.visible = true;
    if (j.state === 'sit') { animateJoury(J, this.time, false, 0, null); poseReset(J); J.legL.rotation.x = J.legR.rotation.x = -1.45; J.kneeL.rotation.x = J.kneeR.rotation.x = 1.45; J.root.position.y = 0.58 - J.P.legH * J.scaleK; J.armL.rotation.x = J.armR.rotation.x = -1.05; J.head.rotation.z = Math.sin(this.time * 9.5) * 0.06; J.torso.rotation.x = 0.1; }
    else animateJoury(J, this.time, j.moving, j.speed, null);
    // Gabe
    this.updateGabe(dt);
    // music: from his speakers while he is at the PC
    const dm = Math.hypot(P.x - 9.4, P.z - 3.1), inRoom = this.roomOf(P.x, P.z) === 'gaming';
    Phonk.setVol(j.state === 'sit' && Game.state === 'house' ? clamp(1 - dm / 26, 0.04, 1) * (inRoom ? 0.75 : 0.42) * (this.hidden ? 0.6 : 1) : 0); Phonk.tick();
    // fear level
    const dj = Math.hypot(P.x - j.x, P.z - j.z);
    this.danger = j.state === 'chase' ? clamp(1 - dj / 14, 0.35, 1) : j.state === 'investigate' || j.state === 'search' ? 0.25 : clamp(1 - dj / 10, 0, 0.3);
    // caught?
    if (!this.hidden && dj < 1.15 && j.state !== 'sit' && !Admin.god) this.catchPlayer();
  },
  think(dt) {
    const j = this.j, P = Player.pos, D = (x, z) => Math.hypot(x - j.x, z - j.z);
    j.t += dt;
    const sees = this.canSee();
    if (sees) { j.seenT += dt; j.lastSeen = { x: P.x, z: P.z }; } else j.seenT = 0;
    // noise from the player (sprinting, walking on his floor, prying)
    if (j.state !== 'chase') {
      const n = (Player.noise || 0) * (j.state === 'sit' ? 0.45 : 0.7);
      if (n > 0 && D(P.x, P.z) < n && !this.hidden) this.noise(99, P.x, P.z);
    }
    if (sees && j.state !== 'chase' && (j.state !== 'sit' || j.seenT > 0.1)) {
      if (j.state === 'sit') this.standUp();
      j.state = 'chase'; this.say(pick(HOUSE_LINES.spot)); SFX.sting();
    }
    let speed = 0, tx = null, tz = null;
    if (j.state === 'sit') {
      j.x = 8.2; j.z = 3.1; j.yaw = Math.PI / 2; j.moving = false;
      j.sitT -= dt; if (j.sitT <= 0) { this.standUp(); this.patrolRoute(); }
    } else if (j.state === 'chase') {
      speed = 4.4;
      if (sees) { tx = P.x; tz = P.z; j.path = []; }
      else if (this.hidden && j.sawHide > 0) { const h = this.hides[this.hidden]; tx = h.out.x; tz = h.out.z; if (D(tx, tz) < 1.0) { this.say('Found you.'); this.catchPlayer(); return; } }
      else { if (!j.path.length && j.lastSeen) { this.goTo(j.lastSeen.x, j.lastSeen.z); j.lostT = 0; } j.lostT = (j.lostT || 0) + dt; if (j.lostT > 7 || !j.lastSeen) { j.state = 'search'; j.lookT = 4; this.say(pick(HOUSE_LINES.lost)); } }
    } else if (j.state === 'investigate' || j.state === 'search') {
      speed = j.state === 'investigate' ? 2.9 : 2.2;
      if (!j.path.length && j.goal && D(j.goal.x, j.goal.z) > 0.6 && this.clear(j.x, j.z, j.goal.x, j.goal.z)) { tx = j.goal.x; tz = j.goal.z; }
      if (!j.path.length && (!j.goal || D(j.goal.x, j.goal.z) <= 0.6 || tx === null)) { speed = 0; j.lookT -= dt; j.yaw += dt * 1.6 * Math.sin(this.time * 0.9); if (j.lookT <= 0) { j.state = 'patrol'; this.patrolRoute(); } }
    } else if (j.state === 'patrol') {
      speed = 1.9;
      if (!j.path.length) { j.lookT -= dt; if (j.lookT <= 0) { if (j.route && j.route.length) { const n = j.route.shift(); this.goTo(n.x, n.z); j.lookT = rand(1.2, 2.6); } else { this.goTo(8.2, 3.1); j.returning = true; } } }
      if (j.returning && !j.path.length && D(8.2, 3.1) < 0.7) { j.returning = false; j.state = 'sit'; j.sitT = rand(26, 42); }
    }
    // follow the path
    if (tx === null && j.path.length) { const n = j.path[0]; if (D(n.x, n.z) < 0.45) { j.path.shift(); } if (j.path.length) { tx = j.path[0].x; tz = j.path[0].z; } else if (j.goal) { tx = j.goal.x; tz = j.goal.z; } }
    j.moving = false; j.speed = speed;
    if (tx !== null && speed > 0) {
      const gx = tx - j.x, gz = tz - j.z, gd = Math.hypot(gx, gz);
      if (gd > 0.05) {
        const st = Math.min(speed * dt, gd), p = { x: j.x + gx / gd * st, z: j.z + gz / gd * st };
        this.resolveJ(p); j.x = p.x; j.z = p.z; j.moving = true;
        j.yaw += angDiff(j.yaw, Math.atan2(gx, gz)) * Math.min(1, dt * 8);
        j.walkT += dt; if (j.walkT > (j.state === 'chase' ? 0.36 : 0.62)) { j.walkT = 0; const dP = Math.hypot(Player.pos.x - j.x, Player.pos.z - j.z); if (dP < 20) SFX.jouryStep(0, clamp(1 - dP / 20, 0.1, 0.9)); }
      }
    }
    if (j.sawHide > 0) j.sawHide -= dt;
  },
  resolveJ(p) { // Joury bumps into walls and furniture, but walks through his own doorways
    const r = 0.35;
    const push = (b) => { const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz; if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; } };
    for (const b of this.walls) push(b);
    for (const k in this.doors) { const d = this.doors[k]; if (!d.open) push(d.box); }
  },
  patrolRoute() {
    const pool = ['LC', 'KC', 'HB', 'HF', 'GC', 'KW', 'LK'].concat(this.s.unlocked ? ['BC'] : []).concat(this.s.boardsOff ? ['Y1', 'Y2'] : []);
    this.j.route = shuffle(pool.slice()).slice(0, 3).map((k) => this.nodes[k]); this.j.lookT = 0.3; this.j.returning = false;
  },
  updateGabe(dt) {
    const g = this.gabeS, c = this.gabe;
    g.t += dt;
    if (g.follow) {
      // Gabe walks your exact footsteps (a breadcrumb trail), so he goes round every corner and through every door you did
      const P = Player.pos, tr = g.trail || (g.trail = [{ x: P.x, z: P.z }]), last = tr[tr.length - 1];
      if (Math.hypot(P.x - last.x, P.z - last.z) > 0.25) { tr.push({ x: P.x, z: P.z }); if (tr.length > 400) tr.shift(); }
      // the point he wants: about 1.3 m back along your trail
      let need = 1.3, tx = P.x, tz = P.z;
      for (let i = tr.length - 1; i > 0; i--) { const a = tr[i], b2 = tr[i - 1], seg = Math.hypot(a.x - b2.x, a.z - b2.z); if (need <= seg) { const k = need / seg; tx = a.x + (b2.x - a.x) * k; tz = a.z + (b2.z - a.z) * k; need = 0; break; } need -= seg; }
      if (need > 0) { tx = tr[0].x; tz = tr[0].z; }
      // walk toward the oldest trail point he has not reached yet, so he never cuts a corner through a wall
      while (tr.length > 2 && Math.hypot(tr[0].x - g.x, tr[0].z - g.z) < 0.5) tr.shift();
      const nx = tr.length > 2 && Math.hypot(tx - g.x, tz - g.z) > 1.6 ? tr[0] : { x: tx, z: tz };
      const d = Math.hypot(nx.x - g.x, nx.z - g.z), far = Math.hypot(P.x - g.x, P.z - g.z);
      if (d > 0.08) { const sp = Math.min(Math.max(far - 1.0, 0) * 2.8 + 2.2, 7.5) * dt, k = Math.min(1, sp / d), q = { x: g.x + (nx.x - g.x) * k, z: g.z + (nx.z - g.z) * k }; g.x = q.x; g.z = q.z; g.yaw = Math.atan2(nx.x - g.x || 0.0001, nx.z - g.z); }
      // never let him get left behind: if he is far away or not getting closer, he catches up
      g.stuckT = far > 3.5 && (g.lastFar === undefined || far >= g.lastFar - 0.01) ? (g.stuckT || 0) + dt : 0; g.lastFar = far;
      if (far > 12 || g.stuckT > 1.5) { const back = tr.length > 6 ? tr[tr.length - 6] : { x: tx, z: tz }; g.x = back.x; g.z = back.z; g.trail = tr.slice(-6); g.stuckT = 0; }
      c.root.position.set(g.x, 0, g.z); c.root.rotation.y = g.yaw; animateKid(c, g.t, far > 1.6 ? 'walk' : 'idle');
    } else {
      g.trail = null;
      c.root.position.set(7.7, 0, -5.3); c.root.rotation.y = -Math.PI / 2;
      poseReset(c); c.legL.rotation.x = c.legR.rotation.x = -1.5; c.kneeL.rotation.x = c.kneeR.rotation.x = 1.5; c.root.position.y = 0.6 - c.P.legH * 1.05;
      c.armL.rotation.x = -0.6; c.armR.rotation.x = -0.6; c.head.rotation.y = Math.sin(g.t * 0.7) * 0.4; c.torso.rotation.z = Math.sin(g.t * 30) * 0.01;
    }
    // escaped! (Gabe has to be with you, not still inside)
    if (g.follow && Player.pos.z > 20.8 && Math.abs(Player.pos.x) < 4 && Math.hypot(Player.pos.x - g.x, Player.pos.z - g.z) < 8 && Game.state === 'house') Game.houseWin();
  },
  catchPlayer() {
    if (this.caughtT >= 0) return;
    this.caughtT = 0; this.caught++; Game.stats.caught++; Player.frozen = true; HUD.prompt(null); Game.closeInspect();
    if (this.hidden) { this.hidden = null; $('hideOverlay').classList.remove('on'); }
    SFX.jumpscare(); GFX.fx.flash = 0.7; GFX.fx.static = 0.5; GFX.fx.red = 0.35; this.scareCam = this.cam.position.clone();
    const fwd = new THREE.Vector3(-Math.sin(Player.yaw), 0, -Math.cos(Player.yaw)); this.scareFwd = fwd;
  },
  updateCaught(dt) {
    this.caughtT += dt; const t = this.caughtT, J = this.J;
    const jp = this.scareCam.clone().addScaledVector(this.scareFwd, lerp(1.6, 0.95, smoothstep(0, 0.2, t)));
    J.root.visible = true; J.root.position.set(jp.x, this.scareCam.y - J.eyeY + 0.02, jp.z); J.root.rotation.y = Math.atan2(this.scareCam.x - jp.x, this.scareCam.z - jp.z); animateJoury(J, t, false, 0, 'scare');
    Player.pitch = 0.04; Player.applyCam(); this.cam.position.copy(this.scareCam); this.cam.position.x += (Math.random() - 0.5) * 0.04;
    GFX.fx.static = 0.35 + Math.random() * 0.2; GFX.fx.shake = 1; Phonk.setVol(0);
    if (t > 1.1) GFX.fx.fade = clamp((t - 1.1) / 0.5, 0, 1);
    if (t > 1.9) {
      // thrown out on the lawn. You keep what you found; Gabe is dragged back to his room.
      this.caughtT = -1; GFX.fx.shake = 0; GFX.fx.static = 0.1; Game.fadeIn = 1;
      Player.place(rand(-3, 3), 18.2, 0, 0); Player.frozen = false;
      const j = this.j; j.x = 8.2; j.z = 3.1; j.state = 'sit'; j.sitT = rand(20, 32); j.path = []; j.lastSeen = null;
      if (this.gabeS.follow) { this.gabeS.follow = false; this.s.gabeFree = false; HUD.toast('Joury threw you out on the lawn… <b>and dragged Gabe back to his room.</b><br>You still have everything you found.', 5); }
      else HUD.toast(`Joury threw you out on the lawn. <b>${['Again.', 'He is getting better at that.', 'Try sneaking (C).'][Math.min(2, this.caught - 1)]}</b><br>You still have everything you found.`, 4.5);
    }
  },

  // ---------------- interacting ----------------
  aimed() {
    if (this.hidden) return { id: 'hide-' + this.hidden };
    const ray = new THREE.Ray(this.cam.position.clone(), Player.forward(new THREE.Vector3())); let best = null, bd = 2.8; const p = new THREE.Vector3();
    for (const it of this.inters) { if (it.id === 'key' && !this.keyMesh.visible) continue; if (it.id === 'crowbar' && !this.crowbar.visible) continue; if (ray.intersectBox(it.box, p)) { const d = p.distanceTo(ray.origin); if (d < bd) { bd = d; best = it; } } }
    return best;
  },
  label(id) {
    const s = this.s, inside = this.playerInside();
    if (!id) return null;
    if (id.startsWith('hide-')) return 'Come out';
    return { frontdoor: s.frontOpen ? null : inside ? 'Unlock the front door' : 'Try the front door', backdoor: s.boardsOff ? null : s.crowbar ? 'Pry the boards off (loud!)' : 'Inspect the boarded door', beddoor: s.unlocked ? null : s.key ? 'Unlock the padlock' : 'Inspect the padlock',
      sheddoor: s.shedOpen ? null : 'Open the shed', crowbar: 'Take the crowbar', key: 'Take the key (quietly…)', gabe: s.gabeFree ? null : 'Free Gabe', wardrobe: 'Hide in the wardrobe', pantry: 'Hide in the pantry',
      tv: 'Look at the TV', pc: "Look at Joury's PC", poster: 'Look at the poster', photos: 'Look at the photos', fridge: 'Open the fridge', drinks: 'Look in the mini fridge', sofa: 'Look at the sofa', bike: "Look at Gabe's bike", mailbox: 'Check the mailbox', sign: 'Read the sign', gate: s.gabeFree ? 'Leave with Gabe' : 'The front gate' }[id] || null;
  },
  interact() {
    const it = this.aimed(); if (!it) return; const s = this.s, id = it.id, info = (title, text, emoji) => HUD.inspect({ title, text, emoji });
    if (id.startsWith('hide-')) { this.unhide(); return; }
    switch (id) {
      case 'frontdoor':
        if (s.frontOpen) return;
        if (this.playerInside()) { s.frontOpen = true; this.doors.front.open = true; SFX.click(); setTimeout(() => SFX.creak(), 200); this.noise(9, 0, 6.5); HUD.toast('Three locks and a chain… <b>The front door is open.</b>', 3); }
        else info('The front door', 'Three locks, a chain, and a doorbell that plays the Minecraft death sound.\nThis is not the way in. Maybe round the back?', '🚪');
        return;
      case 'backdoor':
        s.seenBack = true;
        if (s.boardsOff) return;
        if (!s.crowbar) { info('The back door', 'Boards are nailed across it from the outside, like he is keeping something IN.\nYou need something to pry them off.', '🪵'); return; }
        if (this.pryT < 0) { this.pryT = 0; SFX.creak(); setTimeout(() => SFX.knock(), 300); setTimeout(() => SFX.knock(), 700); setTimeout(() => SFX.creak(), 1100); this.noise(26, 0, -7); }
        return;
      case 'sheddoor': if (!s.shedOpen) { s.shedOpen = true; this.doors.shed.open = true; SFX.creak(); } return;
      case 'crowbar': s.crowbar = true; this.crowbar.visible = false; SFX.pickup(); HUD.toast('You got the <b>crowbar</b>. Those boards on the back door won\'t last long.', 3.5); return;
      case 'key': s.key = true; this.keyMesh.visible = false; this.glints.setSize(this.keyGlint, 0); SFX.pickup(); this.noise(this.j.state === 'sit' ? 1.6 : 4, 9.8, 5.3); HUD.toast("You got the <b>key to Gabe's room</b>.", 3); return;
      case 'beddoor':
        if (s.unlocked) return;
        if (!s.key) { info('Padlocked door', "A big padlock on the outside. From inside, a voice whispers:\n“is someone there?? the key is on his wall… right next to his PC. he never leaves that chair. unless he hears you.”", '🔒'); return; }
        s.unlocked = true; this.padlock.visible = false; this.doors.bedroom.open = true; SFX.click(); setTimeout(() => SFX.creak(), 250); this.noise(7, 2, -2.8); return;
      case 'gabe':
        if (s.gabeFree) return;
        s.gabeFree = true; this.gabeS.follow = true; this.gabeS.x = 7.7; this.gabeS.z = -4.6; this.gabeS.trail = [{ x: 7.7, z: -4.6 }, { x: Player.pos.x, z: Player.pos.z }]; this.gabeS.stuckT = 0; SFX.chime(); this.noise(9, 7.7, -5.3);
        HUD.kidSay('Gabe: “FINALLY. Get me out of here… and never let Vivek play phonk again.”'); HUD.toast('<b>Gabe is free!</b> He follows you. Get out of the house and through the front gate.', 5); return;
      case 'wardrobe': case 'pantry': this.hide(id); return;
      case 'gate': if (!s.gabeFree) info('The front gate', "You could leave. But Gabe is still in there.", '🚧'); return;
      case 'tv': info('The TV', 'A replay of the Bridge match, paused on the exact frame Vivek scored. It has been paused for a week.', '📺'); return;
      case 'pc': info("Joury's PC", 'Two monitors. One shows Minecraft. The other shows Vivek\'s profile, with every phonk song he has ever played.\nThe volume is at 100.', '🖥️'); return;
      case 'poster': info('Poster', '“5-4. IT WAS LAG.”\nSigned by Joury. Also by Joury.', '🖼️'); return;
      case 'photos': info('Family photos', 'Joury at a birthday. Joury at the beach. Joury holding a 2nd-place trophy, not smiling.\nIn every photo, someone in the background has been scribbled out.', '🖼️'); return;
      case 'fridge': info('The fridge', 'Energy drinks, one sad slice of pizza, and a sticky note: “DO NOT EAT. EVIDENCE.”', '🧊'); return;
      case 'drinks': info('Mini fridge', 'Forty-one energy drinks, all the same flavor. He never sleeps.', '🥤'); return;
      case 'sofa': info('The sofa', 'There is a controller-shaped dent in the cushion, and another one in the wall.', '🛋️'); return;
      case 'bike': info("Gabe's bike", 'Front wheel still spinning, very slowly. He was taken from right here.', '🚲'); return;
      case 'mailbox': info('Mailbox', 'Name: JOURY. Inside: a noise complaint, addressed to Vivek, never sent.', '📬'); return;
      case 'sign': info('Lawn sign', 'NO PHONK BEYOND THIS POINT.\nHe made it himself. It is laminated.', '🪧'); return;
    }
  },
  hide(id) {
    const h = this.hides[id]; if (!h) return;
    const j = this.j; if (j.state === 'chase' && this.canSee()) j.sawHide = 3; // he saw you get in
    this.hidden = id; Player.frozen = true; Player.place(h.x, h.z, h.yaw, 0); SFX.creak(); $('hideOverlay').classList.add('on');
    HUD.toast('You are hiding. Stay still… <b>E</b> to come out.', 2.5);
  },
  unhide() { const h = this.hides[this.hidden]; this.hidden = null; $('hideOverlay').classList.remove('on'); Player.place(h.out.x, h.out.z, h.yaw, 0); Player.frozen = false; SFX.creak(); },
  objective() {
    const s = this.s;
    if (s.gabeFree) return 'Get Gabe out: through a door and out the front gate';
    if (s.unlocked) return 'Free Gabe';
    if (s.key) return "Unlock Gabe's room (the back-right room)";
    if (s.boardsOff || s.inside) return "Find the key to Gabe's room · listen: music means Joury is at his PC";
    if (s.crowbar) return 'Pry the boards off the back door';
    return "Find a way into Joury's house · the shed in the back yard might help";
  },
  inventory() { const s = this.s; return [s.crowbar ? '🔧 Crowbar' : null, s.key ? "🗝️ Key to Gabe's room" : null, s.gabeFree ? '🧒 Gabe (following you)' : null].filter(Boolean); },

  // ---------------- story slide 3: the camera creeps up to the house ----------------
  storyScene() {
    this.build(); if (!this.s.inside && this.j === undefined) this.reset();
    return {
      scene: this.scene,
      enter: () => { this.reset(); },
      update: (t, dt) => {
        const cam = Story.cam, k = smoothstep(0, 9, t);
        cam.position.set(lerp(-6, -2, k), lerp(1.7, 1.6, k), lerp(30, 21, k)); cam.lookAt(lerp(-2, 4, k), lerp(2.2, 1.8, k), 0);
        this.time += dt; this.J.root.position.set(8.2, 0.58 - this.J.P.legH * this.J.scaleK, 3.1); this.J.root.rotation.y = Math.PI / 2;
        this.gabe.root.position.set(7.7, 0, -5.3);
        this.tvLight.intensity = 2.2 + Math.sin(this.time * 17) * 0.6;
        GFX.fx.exposure = 3.2; GFX.fx.auto = 0; GFX.fx.grain = 0.07; GFX.fx.vignette = 1.1;
        if (Story.cur && Story.cur.scene) Phonk.setVol(0.08); Phonk.tick();
      },
    };
  },
};
