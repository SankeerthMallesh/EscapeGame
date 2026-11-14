// =====================================================================
//  STORY — six cinematic slides with typewriter text
// =====================================================================
const SLIDES = [
  { label: '1 · THE MATCH', scene: 'bridge', mode: 'match', text: 'Last summer, Joury and Vivek played Bridge in Minecraft.\nTwo islands. One bridge. First to five goals wins.' },
  { label: '2 · THE GOAL', scene: 'bridge', mode: 'goal', text: 'Four to four. Final point.\nVivek sprinted across the bridge… and jumped straight into Joury\'s goal.', big: '<span class="vb">VIVEK 5</span> – <span class="jr">4 JOURY</span>', bigAt: 3.3 },
  { label: '3 · THE CRASH OUT', scene: 'room', text: 'Joury did not take it well. He threw his controller across the room\nand swore he would never log off until he won.', big: 'NOT GG. NEVER GG.', bigRed: true, bigAt: 1.5 },
  { label: '4 · HALLOWEEN', scene: 'street', mode: 'kids', text: 'He never did log off. For 365 days, his status said ONLINE.\nThen, on Halloween night, every kid on Hollow Lane got the same message.', big: '<span class="note">joury: who wants a rematch?</span>', bigAt: 4.2 },
  { label: '5 · GONE', scene: 'street', mode: 'gone', text: 'By midnight, ten kids were gone. Every one of them had laughed when Joury lost.\nThey left their candy bags… and a trail leading into the woods.' },
  { label: '6 · YOUR MISSION', scene: 'lake', text: 'The trail ends at a black lake. Across it: an island Joury built for his rematch.\nVivek won\'t come. So you will play instead.\nFind the 10 kids. Find the boat parts. Don\'t let Joury catch you.' },
];

const Story = {
  cam: null, scenes: {}, idx: 0, t: 0, typed: 0, done: false, holdT: 0, cur: null, fw: null, fwParts: [],
  init() { this.cam = GFX.camera(55, 0.1, 900); },
  start(slides) {
    this.slides = slides || SLIDES; this.idx = -1; $('storyDots').innerHTML = this.slides.map(() => '<i></i>').join('');
    this.next();
  },
  next() {
    this.idx++;
    if (this.idx >= this.slides.length) { Game.startGame(); return; }
    const S = this.slides[this.idx]; this.t = 0; this.typed = 0; this.done = false; this.holdT = 0; this.bigShown = false;
    this.cur = this.scene(S.scene); this.cur.enter && this.cur.enter(S.mode);
    $('storyLabel').textContent = S.label; $('storyText').textContent = ''; $('storyNext').classList.remove('on');
    const big = $('storyBig'); big.className = ''; big.innerHTML = '';
    [...$('storyDots').children].forEach((d, i) => d.classList.toggle('on', i <= this.idx));
    GFX.fx.fade = 1; GFX.fx.red = 0; GFX.fx.shake = 0; GFX.fx.flash = 0;
    if (S.phonk) Phonk.setVol(0.55); else if (S.scene !== 'house') Phonk.setVol(0);
  },
  advance() { // click / space
    const S = this.slides[this.idx]; if (!S) return;
    if (!this.done) { this.typed = S.text.length; this.done = true; $('storyText').textContent = S.text; $('storyNext').classList.add('on'); return; }
    SFX.uiClick(); this.next();
  },
  build_house() { return House.storyScene(); },
  scene(name) {
    if (!this.scenes[name]) this.scenes[name] = this['build_' + name]();
    return this.scenes[name];
  },
  update(dt) {
    const S = this.slides[this.idx]; if (!S) return;
    this.t += dt;
    GFX.fx.fade = Math.max(0, 1 - this.t * 1.6);
    // typewriter
    if (!this.done) {
      const before = Math.floor(this.typed); this.typed = Math.min(S.text.length, this.typed + dt * 34);
      const now = Math.floor(this.typed);
      if (now > before && S.text[now - 1] !== ' ' && S.text[now - 1] !== '\n' && (now % 2 === 0)) SFX.type();
      $('storyText').textContent = S.text.slice(0, now);
      if (now >= S.text.length) { this.done = true; $('storyNext').classList.add('on'); }
    } else { this.holdT += dt; if (this.holdT > 4.5 + (S.big ? 1 : 0)) this.next(); }
    if (S.big && !this.bigShown && this.t > S.bigAt) { this.bigShown = true; const big = $('storyBig'); big.innerHTML = S.big; big.className = 'on' + (S.bigRed ? ' red' : ''); }
    this.cur.update(this.t, dt, S.mode); Phonk.tick();
    this.updateFireworks(dt);
    GFX.render(this.cur.scene, this.cam, dt);
  },

  // ---------- fireworks ----------
  burst(scene, x, y, z, color) {
    if (!this.fw || this.fw.scene !== scene) { if (this.fw) this.fw.scene.remove(this.fw.set.points); const set = new GlowSet(700, 400, true); scene.add(set.points); this.fw = { set, scene }; this.fwParts = []; for (let i = 0; i < 700; i++) set.add(0, -999, 0, 0xffffff, 0, 0); }
    SFX.firework();
    for (let i = 0; i < 46; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(5, 9));
      const idx = (this.fwHead = ((this.fwHead || 0) + 1) % 700);
      this.fwParts[idx] = { p: new THREE.Vector3(x, y, z), v, life: rand(1.2, 1.9), c: color };
      this.fw.set.setColor(idx, color, 1.7);
    }
  },
  updateFireworks(dt) {
    if (!this.fw) return; const set = this.fw.set;
    this.fwParts.forEach((f, i) => { if (!f) return; f.life -= dt; f.v.y -= 4 * dt; f.v.multiplyScalar(1 - dt * 1.2); f.p.addScaledVector(f.v, dt); set.set(i, f.p.x, f.life > 0 ? f.p.y : -999, f.p.z); set.setSize(i, Math.max(0, f.life) * 0.9); if (f.life <= 0) this.fwParts[i] = null; });
  },

  // ---------- slide 1 & 2: the Bridge duel ----------
  build_bridge() {
    const scene = new THREE.Scene();
    const sky = makeSky({ top: 0x2f6fd0, mid: 0xa8d4ff, bot: 0x9cc4ec, sunDir: new THREE.Vector3(0.5, 0.55, 0.4), sunCol: 0xfff0c0, sunSize: 0.9994, halo: 0.8, r: 500 });
    scene.add(sky); scene.fog = new THREE.FogExp2(0xbcd8f5, 0.006);
    const hemi = new THREE.HemisphereLight(0xdfefff, 0x6a7a5a, 1.4); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.6); sun.position.set(20, 30, 18); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 20, bottom: -20, near: 1, far: 90 }); scene.add(sun);
    const blocks = [], add = (x, y, z, c) => blocks.push({ x, y, z, c });
    const island = (cx, team, teamC) => {
      for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
        const goal = (team === 'red' ? x <= -1 && x >= -2 : x >= 1 && x <= 2) && (z === 0 || z === -1);
        if (!goal) add(cx + x, 0, z, (x + z) % 3 === 0 ? 0xe8e4dc : teamC);
        else add(cx + x, -1.2, z, 0x15102a);
      }
      for (let L = 1; L <= 3; L++) { const r = 3 - L; for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) add(cx + x, -L, z, L === 1 ? 0x7a5a3a : 0x6e6e72); }
    };
    island(-14, 'red', 0xc0262b); island(14, 'blue', 0x2f62d6);
    for (let x = -10; x <= 10; x++) add(x, 0, 0, x < 0 ? 0xb3262b : x > 0 ? 0x2c5bd0 : 0xe8e4dc);
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: TEX.block }), blocks.length);
    blocks.forEach((b, i) => { _m4.makeTranslation(b.x, b.y, b.z); im.setMatrixAt(i, _m4); im.setColorAt(i, new THREE.Color(b.c).multiplyScalar(0.88 + hash2(b.x, b.z, b.y + 9) * 0.22)); });
    im.castShadow = im.receiveShadow = true; scene.add(im);
    const goalGlow = new GlowSet(40, 300, true); scene.add(goalGlow.points);
    [[-15.5, -0.5], [15.5, -0.5]].forEach(([x, z]) => { for (let i = 0; i < 14; i++) goalGlow.add(x + rand(-0.9, 0.9), -0.6 + rand(-0.1, 0.3), z + rand(-0.9, 0.9), i % 2 ? 0x8a6aff : 0x40e0ff, rand(0.15, 0.3), 0.8); });
    // clouds
    const clouds = new THREE.Group(); scene.add(clouds);
    for (let i = 0; i < 14; i++) { const cg = new THREE.Group(); const n = randInt(3, 6); for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(rand(3, 6), rand(1, 2), rand(2, 4)), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })); m.position.set(rand(-3, 3), rand(-0.5, 0.5), rand(-2, 2)); cg.add(m); } const ca = rand(0, TAU), cr = rand(30, 70); cg.position.set(Math.cos(ca) * cr, pick([rand(-16, -7), rand(9, 16)]), Math.sin(ca) * cr - 10); clouds.add(cg); }
    const J = makeGamer('joury', 'neutral'), V = makeGamer('vivek', 'happy');
    scene.add(J.root, V.root);
    const board = (() => { const c = makeCanvas(512, 200), g = c.getContext('2d'); g.fillStyle = 'rgba(10,10,20,.85)'; g.fillRect(0, 0, 512, 200); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 188);
      g.font = 'bold 84px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#4da3ff'; g.fillText('VIVEK 5', 150, 130); g.fillStyle = '#fff'; g.fillText('–', 256, 125); g.fillStyle = '#ff4040'; g.fillText('4 JOURY', 370, 130);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.7), new THREE.MeshBasicMaterial({ map: texFrom(c), transparent: true, fog: false })); m.position.set(0, 9.5, -6); return m; })();
    scene.add(board);
    return {
      scene, J, V,
      enter: (mode) => {
        board.visible = false; V.root.visible = true; poseReset(J); poseReset(V);
        J.root.position.set(-4, 0.5, 0); J.root.rotation.y = Math.PI / 2; V.root.position.set(3.5, 0.5, 0); V.root.rotation.y = -Math.PI / 2;
        const sunset = mode === 'goal';
        sky.material.uniforms.uTop.value.set(sunset ? 0x2a2a6a : 0x2f6fd0); sky.material.uniforms.uMid.value.set(sunset ? 0xff9a5a : 0xa8d4ff); sky.material.uniforms.uBot.value.set(sunset ? 0x6a3a5a : 0x9cc4ec);
        sky.material.uniforms.uSunDir.value.set(sunset ? -0.9 : 0.5, sunset ? 0.12 : 0.55, sunset ? -0.4 : 0.4).normalize(); sky.material.uniforms.uSunCol.value.set(sunset ? 0xffb070 : 0xfff0c0);
        scene.fog.color.set(sunset ? 0xd89a7a : 0xbcd8f5); hemi.intensity = sunset ? 0.9 : 1.4; sun.color.set(sunset ? 0xffa060 : 0xfff0d0); sun.position.set(sunset ? -30 : 20, sunset ? 10 : 30, sunset ? -10 : 18);
        this.fwT = 0;
      },
      update: (t, dt, mode) => {
        clouds.children.forEach((c, i) => { c.position.x += dt * (0.6 + (i % 3) * 0.3); if (c.position.x > 70) c.position.x = -70; });
        const cam = this.cam;
        if (mode === 'match') {
          const a = 0.35 + t * 0.06; cam.position.set(Math.sin(a) * 18, 5 + Math.sin(t * 0.3), Math.cos(a) * 18); cam.lookAt(0, 0.5, 0);
          // duel: strafing, swinging
          J.root.position.z = Math.sin(t * 2.1) * 0.25; V.root.position.z = Math.sin(t * 1.7 + 1) * 0.25;
          J.root.position.x = -4 + Math.sin(t * 1.3) * 0.6; V.root.position.x = 3.5 + Math.sin(t * 1.1 + 2) * 0.6;
          poseWalk(J, t * 8, 0.6); poseWalk(V, t * 8 + 1, 0.6);
          J.armR.rotation.x = -1.2 - Math.abs(Math.sin(t * 6)) * 0.8; V.armR.rotation.x = -1.2 - Math.abs(Math.sin(t * 6 + 1)) * 0.8;
          const jump = Math.max(0, Math.sin(t * 2.4)); J.root.position.y = 0.5 + jump * jump * 0.5;
        } else {
          // Vivek runs, vaults over Joury, dives into the red goal
          const run = clamp((t - 0.5) / 2.2, 0, 1);
          let vx = lerp(3.5, -15.5, run), vy = 0.5;
          if (vx < -2 && vx > -6.5) vy += Math.sin(((vx + 2) / -4.5) * Math.PI) * 1.8;
          if (run >= 1) { const k = clamp((t - 2.7) / 0.4, 0, 1); vy = lerp(0.5, -1.6, k); V.root.position.z = -0.5; if (k >= 1) V.root.visible = false; }
          V.root.position.x = vx; V.root.position.y = vy; V.root.rotation.y = -Math.PI / 2;
          if (run < 1) poseWalk(V, t * 14, 1.2); else { V.armL.rotation.x = V.armR.rotation.x = -2.8; }
          J.root.rotation.y = vx < -4 ? -Math.PI / 2 : Math.PI / 2;
          if (vx < -4) { J.armL.rotation.x = -2.5 + Math.sin(t * 20) * 0.4; J.armR.rotation.x = -2.5 + Math.cos(t * 20) * 0.4; J.head.rotation.z = Math.sin(t * 12) * 0.2; } else poseWalk(J, t * 6, 0.3);
          const ck = clamp((t - 0.4) / 2.6, 0, 1);
          const up = smoothstep(3.0, 4.4, t); cam.position.set(lerp(lerp(10, -9, ck), -3, up), lerp(lerp(3.5, 5, ck), 7, up), lerp(lerp(10, 11, ck), 16, up)); cam.lookAt(lerp(V.root.position.x, 0, up), lerp(1, 8, up), lerp(0, -6, up));
          if (t > 3.1) { this.fwT -= dt; if (this.fwT <= 0) { this.fwT = rand(0.35, 0.7); this.burst(scene, rand(-18, 18), rand(9, 16), rand(-16, -4), pick([0x4da3ff, 0xffd35a, 0xffffff, 0x7affc8])); } }
        }
      },
    };
  },

  // ---------- slide 3: the crash out ----------
  build_room() {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05060a); scene.fog = new THREE.FogExp2(0x05060a, 0.02);
    const b = new Builder();
    b.box(8, 0.1, 7, 0, -0.05, 0, 0x8a7a6a, 'wood'); b.box(8, 3, 0.1, 0, 1.5, -3, 0x7a8aa0, 'wallpaper'); b.box(0.1, 3, 7, -4, 1.5, 0, 0x7a8aa0, 'wallpaper'); b.box(0.1, 3, 7, 4, 1.5, 0, 0x7a8aa0, 'wallpaper');
    b.box(2.4, 0.08, 1.0, 0, 0.8, -2.4, 0x2a2018, 'wood'); [[-1.1, -2.8], [1.1, -2.8], [-1.1, -2.0], [1.1, -2.0]].forEach(([x, z]) => b.box(0.06, 0.8, 0.06, x, 0.4, z, 0x222222, 'metal'));
    b.box(1.6, 0.05, 0.5, 0, 0.86, -2.25, 0x18181c, 'plain'); b.box(0.1, 0.45, 0.1, 0, 1.08, -2.75, 0x18181c, 'metal');
    b.box(1.8, 0.4, 2.2, 3.0, 0.25, 1.5, 0x4a2a2a, 'plain'); b.box(1.7, 0.15, 2.1, 3.0, 0.5, 1.5, 0x2f62d6, 'plain'); // bed (team blue sheets… he hates that)
    b.box(1.0, 1.4, 0.05, -2.5, 1.9, -2.95, 0xc0262b, 'plain'); b.box(0.8, 1.0, 0.05, 2.3, 2.0, -2.95, 0x3fa34d, 'plain');
    scene.add(b.build());
    const mon = (() => { const c = makeCanvas(512, 288), g = c.getContext('2d'); g.fillStyle = '#100308'; g.fillRect(0, 0, 512, 288); g.fillStyle = '#ff2b2b'; g.font = 'bold 110px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('DEFEAT', 256, 150); g.fillStyle = '#ddd'; g.font = 'bold 30px "Courier New", monospace'; g.fillText('VIVEK 5 – 4 JOURY', 256, 210); g.fillStyle = '#888'; g.font = '20px "Courier New", monospace'; g.fillText('[ PLAY AGAIN ]   [ SAY GG ]', 256, 260); return c; })();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.84), new THREE.MeshBasicMaterial({ map: texFrom(mon), color: new THREE.Color(1.8, 1.8, 1.8) })); screen.position.set(0, 1.55, -2.72); scene.add(screen);
    const frame = boxMesh(1.6, 0.94, 0.05, lam(0x0c0c0e)); frame.position.set(0, 1.55, -2.76); scene.add(frame);
    const glowL = new THREE.PointLight(0xff3020, 14, 9, 1.4); glowL.position.set(0, 1.5, -2.2); scene.add(glowL);
    const lamp = new THREE.PointLight(0xffb070, 16, 10, 1.4); lamp.position.set(-2.8, 2.3, 1.5); lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); scene.add(lamp);
    scene.add(new THREE.HemisphereLight(0x8a9ac0, 0x302020, 1.3));
    const chair = new Builder(); chair.box(0.6, 0.08, 0.6, 0, 0.5, 0, 0x16161a, 'plain'); chair.box(0.6, 0.9, 0.08, 0, 1.0, 0.3, 0x16161a, 'plain'); chair.box(0.12, 0.6, 0.1, 0, 1.0, 0.34, 0xc0262b, 'plain'); chair.cyl(0.04, 0.04, 0.5, 0, 0.25, 0, 0x333333, 'metal', 6);
    const chairG = chair.build(); scene.add(chairG);
    const Jn = makeGamerHuman('joury', 'neutral'), Ja = makeGamerHuman('joury', 'angry'); scene.add(Jn.root, Ja.root);
    const ctrl = makeController(false); const broken = makeController(true); scene.add(ctrl, broken);
    return {
      scene,
      enter: () => { this.crashed = false; chairG.position.set(0, 0, -1.4); chairG.rotation.set(0, 0, 0); },
      update: (t, dt) => {
        const cam = this.cam, rage = t > 1.4;
        Jn.root.visible = !rage; Ja.root.visible = rage;
        const J = rage ? Ja : Jn;
        J.root.position.set(0, rage ? 0 : 0.06, -1.25); J.root.rotation.y = Math.PI;
        if (!rage) { // sitting, staring at DEFEAT
          poseReset(J); J.legL.rotation.x = J.legR.rotation.x = -1.5; J.kneeL.rotation.x = J.kneeR.rotation.x = 1.5; J.root.position.y = 0.58 - J.P.legH;
          J.armL.rotation.x = J.armR.rotation.x = -1.1; J.head.rotation.z = Math.sin(t * 9) * 0.03;
          ctrl.visible = true; broken.visible = false; ctrl.position.set(0, 0.95, -1.62); ctrl.rotation.set(0.3, 0, 0);
        } else {
          poseReset(J); J.root.position.y = 0;
          const k = clamp((t - 1.4) / 0.35, 0, 1);
          J.armR.rotation.x = lerp(-2.9, 0.6, smoothstep(0, 1, clamp((t - 1.6) / 0.25, 0, 1))); J.armL.rotation.x = -2.4 + Math.sin(t * 18) * 0.3; J.head.rotation.z = Math.sin(t * 15) * 0.12;
          chairG.rotation.x = lerp(0, 1.4, k); chairG.position.z = lerp(-1.4, -0.6, k); chairG.position.y = lerp(0, 0.2, k);
          // the throw
          const ft = clamp((t - 1.75) / 0.45, 0, 1);
          if (ft < 1) { ctrl.visible = true; broken.visible = false; ctrl.position.set(lerp(0.25, 3.8, ft), lerp(1.9, 1.7, ft) + Math.sin(ft * Math.PI) * 0.5, lerp(-1.3, -0.4, ft)); ctrl.rotation.set(t * 14, t * 9, 0); }
          else { if (!this.crashed) { this.crashed = true; SFX.crash(); GFX.fx.flash = 0.25; } ctrl.visible = false; broken.visible = true; const fall = clamp((t - 2.2) / 0.4, 0, 1); broken.position.set(3.75, lerp(1.7, 0.05, fall * fall), -0.4); broken.rotation.set(0.2, 0.6, 0); }
        }
        const shake = rage ? Math.max(0, 1 - (t - 1.4) / 3) : 0;
        GFX.fx.red = rage ? 0.12 + 0.3 * Math.abs(Math.sin(t * 9)) * shake : 0; GFX.fx.shake = shake;
        cam.position.set(lerp(2.6, 2.0, Math.min(1, t / 6)) + (Math.random() - 0.5) * 0.12 * shake, 1.7 + (Math.random() - 0.5) * 0.1 * shake, lerp(1.6, 1.1, Math.min(1, t / 6)));
        cam.lookAt(0.4, 1.4, -1.6);
        if (!this.yelled && t > 1.5) { this.yelled = true; SFX.voice(0, 0.6, true); }
        if (t < 0.1) this.yelled = false;
      },
    };
  },

  // ---------- slides 4 & 5: Hollow Lane ----------
  build_street() {
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x0c1220, 0.03);
    scene.add(makeSky({ top: 0x03050c, mid: 0x18233a, bot: 0x0c1220, sunDir: new THREE.Vector3(-0.3, 0.5, -0.8), sunCol: 0x9fb4e0, sunSize: 0.99999, halo: 0.5 }));
    scene.add(makeStars(800, 380)); const moon = makeMoon(new THREE.Vector3(-0.3, 0.5, -0.8), 330, 26); scene.add(moon);
    const hemi = new THREE.HemisphereLight(0x3a4a70, 0x0c0a0a, 0.6); scene.add(hemi);
    const ml = new THREE.DirectionalLight(0x9fb4ff, 0.5); ml.position.set(-10, 20, -20); scene.add(ml);
    const b = new Builder();
    b.box(90, 0.1, 7, 0, -0.05, 0, 0x1e1f22, 'plain'); for (let x = -44; x < 46; x += 4) b.box(1.6, 0.02, 0.15, x, 0.01, 0, 0xb8a040, 'plain');
    [-1, 1].forEach((s) => { b.box(90, 0.25, 2.4, 0, 0.12, s * 4.7, 0x55555a, 'stone'); b.box(90, 0.1, 14, 0, -0.05, s * 13, 0x1d2a1a, 'plain'); });
    const glow = new GlowSet(120, 120); scene.add(glow.points);
    const jacks = [], houseCols = [0x6a4a5a, 0x4a5a6a, 0x5a6a4a, 0x7a5a3a, 0x4a4a6a];
    for (let i = 0; i < 5; i++) [-1, 1].forEach((s) => {
      const x = -32 + i * 15 + (s > 0 ? 6 : 0), z = s * 12, col = houseCols[(i + (s > 0 ? 2 : 0)) % 5];
      b.box(8, 4.5, 6, x, 2.25, z, col, 'wood'); b.add(new THREE.CylinderGeometry(1, 1, 1, 3), 'wood', 0x2a1e1a, x, 5.3, z, 0, 0, Math.PI / 2, 4.9, 8.4, 2.0);
      b.box(1.2, 2.1, 0.1, x, 1.05, z - s * 3.02, 0x2a1a12, 'wood'); b.box(3, 0.2, 1.4, x, 0.1, z - s * 3.6, 0x4a3a2a, 'wood');
      [-2.4, 2.4].forEach((wx) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), MAT.windowLit); w.position.set(x + wx, 2.6, z - s * 3.03); w.rotation.y = s > 0 ? Math.PI : 0; scene.add(w); glow.add(x + wx, 2.6, z - s * 3.3, 0xffa040, 1.4, 0.1); });
      jacks.push([x - 1.1, z - s * 3.9], [x + 1.2, z - s * 3.8]);
      for (let k = -3; k < 4; k++) b.box(0.1, 0.8, 0.1, x + k * 1.2, 0.4, z - s * 5.6, 0xd8d8d0, 'wood'); b.box(8, 0.08, 0.06, x, 0.6, z - s * 5.6, 0xd8d8d0, 'wood');
    });
    // street lamps
    const lamps = [];
    for (let i = 0; i < 5; i++) { const x = -36 + i * 18, s = i % 2 ? 1 : -1; b.box(0.15, 4.5, 0.15, x, 2.25, s * 5.6, 0x222222, 'metal'); b.box(1.2, 0.1, 0.1, x, 4.5, s * 5.1, 0x222222, 'metal');
      const L = new THREE.PointLight(0xffd090, 14, 16, 1.7); L.position.set(x, 4.3, s * 4.6); scene.add(L); const gi = glow.add(x, 4.35, s * 4.6, 0xffd090, 1.8, 0.05); lamps.push({ L, gi, flick: i === 3 }); }
    // the woods at the end of the lane
    instancedTrees(scene, Array.from({ length: 46 }, (_, i) => ({ kind: i % 3 ? 'pine' : 'dead', variant: i % 2, x: rand(44, 72), y: 0, z: rand(-15, 15), s: rand(0.9, 1.5), ry: rand(0, TAU) })));
    scene.add(b.build());
    const jm = new THREE.InstancedMesh(pumpkinGeo(true), MAT.pumpkin, jacks.length);
    jacks.forEach(([x, z], i) => { _m4.compose(_pv.set(x, 0.32, z), _q.identity(), _sv.set(0.3, 0.3, 0.3)); jm.setMatrixAt(i, _m4); jm.setColorAt(i, new THREE.Color(1, 1, 1)); glow.add(x, 0.35, z + (z > 0 ? -0.35 : 0.35), 0xff8a1a, 1.0, 0.5); }); scene.add(jm);
    const kids = KID_TYPES.map((k, i) => { const c = makeKid(k.id); scene.add(c.root); return c; });
    const pails = KID_TYPES.map(() => { const p = candyPail(); scene.add(p); return p; });
    const candy = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.06, 0.18), new THREE.MeshLambertMaterial(), 70); scene.add(candy);
    for (let i = 0; i < 70; i++) { const x = lerp(-4, 52, i / 69) + rand(-0.4, 0.4), z = lerp(4.2, 0, clamp((x - 10) / 30, 0, 1)) + Math.sin(i) * 0.6; _m4.compose(_pv.set(x, 0.05, z), _q.setFromEuler(_e.set(0, rand(0, 3), 0)), _sv.set(1, 1, 1)); candy.setMatrixAt(i, _m4); candy.setColorAt(i, new THREE.Color(pick([0xff4a8a, 0xffd23a, 0x4ad0ff, 0x7aff6a, 0xff7a1a]))); }
    const eyes = new GlowSet(2, 200, true); scene.add(eyes.points); eyes.add(50, 2.5, -0.35, 0xff2010, 0.7, 0.2); eyes.add(50, 2.5, 0.25, 0xff2010, 0.7, 0.2);
    return {
      scene,
      enter: (mode) => {
        const gone = mode === 'gone';
        kids.forEach((c, i) => { c.root.visible = !gone; });
        pails.forEach((p, i) => { p.visible = gone; p.position.set(-6 + (i % 5) * 1.6 + rand(-0.4, 0.4), 0.13, 4.0 + (i < 5 ? 0 : -1.2) + rand(-0.3, 0.3)); p.rotation.set(rand(-1.4, 1.4), rand(0, 3), Math.PI / 2 * (i % 2)); });
        candy.visible = gone; eyes.points.visible = gone; scene.fog.density = gone ? 0.045 : 0.03; hemi.intensity = gone ? 0.35 : 0.6;
      },
      update: (t, dt, mode) => {
        const cam = this.cam;
        if (mode === 'kids') {
          kids.forEach((c, i) => { const row = i % 5, col = i < 5 ? 0 : 1; c.root.position.set(-14 + t * 1.6 + row * 1.5 - col * 0.7, 0.25, 3.7 - col * 1.1); c.root.rotation.y = Math.PI / 2; animateKid(c, t + i, 'walk'); });
          cam.position.set(-5.5 + t * 1.6, 1.8, -1.6); cam.lookAt(-11 + t * 1.6, 0.9, 3.4);
        } else {
          cam.position.set(lerp(-14, 26, smoothstep(0, 13, t)), 2.5 + Math.sin(t * 0.8) * 0.05, -2.2); cam.lookAt(cam.position.x + 9, 0.3 + smoothstep(4, 11, t) * 1.5, 1.6);
          eyes.setColor(0, 0xff2010, Math.sin(t * 0.9) > -0.6 ? 2.2 : 0); eyes.setColor(1, 0xff2010, Math.sin(t * 0.9) > -0.6 ? 2.2 : 0);
        }
        lamps.forEach((l) => { const off = mode === 'gone' && l.flick ? (Math.sin(t * 23) > 0.2 || Math.random() < 0.1 ? 0 : 1) : 1; l.L.intensity = 14 * off; glow.setSize(l.gi, 1.8 * off); });
      },
    };
  },

  // ---------- slide 6: across the black lake ----------
  build_lake() {
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x0a0f17, 0.012);
    const mdir = new THREE.Vector3(0.25, 0.32, -0.9).normalize();
    scene.add(makeSky({ top: 0x02030a, mid: 0x111a2c, bot: 0x0a0f17, sunDir: mdir, sunCol: 0xa8b8e0, sunSize: 0.99999, halo: 0.8 }));
    scene.add(makeStars(1200, 380)); scene.add(makeMoon(mdir, 330, 30));
    scene.add(new THREE.HemisphereLight(0x2a3a5c, 0x080a0c, 0.6)); const ml = new THREE.DirectionalLight(0x9fb4ff, 0.5); ml.position.copy(mdir).multiplyScalar(50); scene.add(ml);
    const envScene = new THREE.Scene(); envScene.add(makeSky({ top: 0x05070d, mid: 0x182436, bot: 0x0a0e15, sunDir: mdir, sunCol: 0xc8d4f0, sunSize: 0.9996, halo: 1.4, r: 100 }));
    const pm = new THREE.PMREMGenerator(GFX.renderer), env = pm.fromScene(envScene, 0, 0.1, 500).texture; pm.dispose();
    const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), makeWater(0x02060a, env, { repeat: 120, env: 1.6 })); water.rotation.x = -Math.PI / 2; scene.add(water);
    // shore + pier where the trail ends
    const b = new Builder(); b.box(80, 2, 20, 0, -0.6, 14, 0x1a2216, 'plain'); for (let z = 3; z > -6; z -= 0.35) b.box(2.2, 0.08, 0.3, 0, 0.55, z, 0x4a3420, 'wood'); [-1, 1].forEach((s) => { for (let z = 2; z > -6; z -= 2.5) b.cyl(0.1, 0.1, 2, s * 1.0, -0.3, z, 0x3a2a1c, 'wood', 6); });
    // island silhouette across the water
    const isl = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), lam(0x0c120c)); isl.scale.set(150, 18, 60); isl.position.set(0, -6, -230); scene.add(isl);
    { const items = []; for (let i = 0; i < 170; i++) { const x = rand(-130, 130), z = -230 + rand(-30, 40); const y = -6 + 18 * Math.sqrt(Math.max(0, 1 - (x / 150) ** 2 - ((z + 230) / 60) ** 2)); if (y < 0) continue; items.push({ kind: i % 4 ? 'pine' : 'dead', variant: i % 2, x, y: y - 0.5, z, s: rand(2.2, 3.4), ry: rand(0, TAU) }); } instancedTrees(scene, items, { cast: false }); }
    const cab = new Builder(); cab.box(14, 6, 10, 6, 14.5, -207, 0x2a1c12, 'wood'); cab.add(new THREE.CylinderGeometry(1, 1, 1, 3), 'wood', 0x1a120c, 6, 18.6, -207, 0, 0, Math.PI / 2, 7.5, 14.6, 3.4); scene.add(cab.build());
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.1), MAT.windowLit); win.position.set(8.5, 14.6, -201.9); scene.add(win);
    const glow = new GlowSet(10, 600); scene.add(glow.points); glow.add(8.5, 14.6, -201.5, 0xffa040, 16, 0.12); glow.add(8.5, 0.3, -150, 0xff8a30, 10, 0.4); glow.add(8.5, 0.3, -110, 0xff8a30, 6, 0.5); // window + its reflection
    scene.add(b.build());
    const pail = candyPail(); pail.position.set(0.4, 0.75, -5.6); pail.rotation.z = 1.3; scene.add(pail);
    const mist = []; for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.mist, color: 0x7d8896, transparent: true, opacity: 0.12, depthWrite: false })); s.position.set(rand(-60, 60), 1.5, rand(-150, -10)); s.scale.set(rand(25, 45), rand(5, 9), 1); scene.add(s); mist.push(s); }
    return {
      scene,
      enter: () => {},
      update: (t) => {
        const cam = this.cam; cam.position.set(0, 2.0 + Math.sin(t * 0.5) * 0.05, lerp(1, -5, smoothstep(0, 14, t))); cam.lookAt(5, 9, -200);
        mist.forEach((s, i) => { s.position.x += Math.sin(i) * 0.02; });
      },
    };
  },
};
