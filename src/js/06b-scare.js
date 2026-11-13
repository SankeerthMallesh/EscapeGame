// =====================================================================
//  SCARES — the game itself turns against you: a live chat Joury types
//  into, fake system messages, mimicked kid voices, pumpkins that die
//  when he is near, lightning that shows where he stands, his diary,
//  and a crash screen that won't let you quit.
// =====================================================================
const KID_NAMES = { ghost: 'lil_ghost', pumpkin: 'pumpkinpaul', witch: 'wanda.exe', vampire: 'count_vlad', skeleton: 'bones4', cat: 'midnight_cat', astronaut: 'astro_ava', dino: 'dinomite', bee: 'beeatrice', hero: 'captain_max' };
const KID_CHAT = ['is someone there??', 'he took my candy', 'dont look at him. DONT look at him', 'i can see his eyes from here', 'please hurry', 'the pumpkins go dark when hes close', 'he talks to his controller', 'if you hear me calling for help… its not me', 'my lantern is almost out', 'is it morning yet', 'he keeps saying 5-4 5-4 5-4', 'crouch (C) if hes close. he listens'];
const JOURY_CHAT = ['gg?', 'ur not vivek', 'i can hear u', 'found u', 'turn around', 'u cant spawn camp me', 'rematch. now.', 'my island. my rules.', 'theyre all watching u', 'stop running', '5-4. say it.', 'afk? :)', 'one more round', 'im not mad'];
const DIARY = [
  { day: 1, text: '5–4. He jumped right into my goal and everyone saw it.\nEveryone laughed.\n\nI am not logging off until I win.' },
  { day: 40, text: 'Mom says I have to come down for dinner.\nI can eat at my desk. The bridge is always there.\nThe bridge is ALWAYS there.' },
  { day: 97, text: 'I found a way to make the map real.\nIf I build it, they have to play on MY island.\nMy rules. My spawn. My goal.' },
  { day: 180, text: 'I don\'t sleep anymore. I don\'t need to.\nThe controller is warm all the time now,\neven when the console is off.' },
  { day: 266, text: 'My reflection didn\'t move when I did today.\nIt\'s fine.\nIt\'s just lag.' },
  { day: 330, text: 'I made a list of everyone who laughed.\nTen names.\nThey get front-row seats.' },
  { day: 364, text: 'Tomorrow is Halloween. Tomorrow is the rematch.\nVivek won\'t come. He never answers anymore.\nSo someone else will have to play.' },
  { day: 365, text: 'If you are reading this, you are on my server.\n\nRule 1: Nobody leaves until I win.\nRule 2: I never lose.\n\n— J' },
];
const Chat = {
  lines: [], queue: [], typingT: 0, nextKid: 30, nextJoury: 60, vivekDone: false,
  reset() { $('chatLines').innerHTML = ''; $('chatTyping').textContent = ''; this.lines = []; this.queue = []; this.typingT = 0; this.nextKid = rand(25, 40); this.nextJoury = rand(55, 80); this.vivekDone = false; },
  post(kind, who, text) {
    const el = document.createElement('div'); el.className = 'cl ' + kind;
    const b = document.createElement('b'); b.textContent = who; const sp = document.createElement('span'); sp.textContent = text;
    if (who) el.appendChild(b); el.appendChild(sp); $('chatLines').appendChild(el);
    this.lines.push({ el, sp, t: 0, text }); while (this.lines.length > 7) this.lines.shift().el.remove();
    SFX.chatPing(kind);
  },
  server(text) { this.post('server', '', '[SERVER] ' + text); },
  kid(id, text) { this.post('kid', KID_NAMES[id] + ':', text); },
  joury(text, typing = 2.4) { this.queue.push({ text, typing }); },
  update(dt, danger) {
    this.lines.forEach((l) => { l.t += dt; l.el.style.opacity = l.t > 14 ? Math.max(0, 1 - (l.t - 14) / 2) : 1; if (danger > 0.55 && Math.random() < danger * 0.04) l.sp.textContent = l.text.replace(/[a-z]/gi, (c) => (Math.random() < 0.35 ? pick(['#', '%', '▓', '█', '?', 'j']) : c)); else if (Math.random() < 0.1) l.sp.textContent = l.text; });
    if (this.queue.length) {
      const q = this.queue[0]; if (this.typingT <= 0) { this.typingT = q.typing; SFX.typing(); }
      this.typingT -= dt; $('chatTyping').textContent = 'Joury is typing…';
      if (this.typingT <= 0) { this.queue.shift(); $('chatTyping').textContent = ''; this.post('joury', 'Joury:', q.text); }
    }
    if (Game.state !== 'play') return;
    this.nextKid -= dt;
    if (this.nextKid <= 0) { this.nextKid = rand(35, 65); const left = World.kids.filter((k) => !k.saved); if (left.length) this.kid(pick(left).c.def.id, pick(KID_CHAT)); }
    if (Joury.state === 'hunt') {
      this.nextJoury -= dt;
      if (this.nextJoury <= 0) {
        this.nextJoury = rand(45, 85) * (Joury.enraged ? 0.6 : 1);
        let line = pick(JOURY_CHAT);
        if (Player.sprinting) line = 'i can hear u running'; else if (Player.crouching) line = 'hiding? cute'; else if (Player.lightOn && Joury.dist < 30) line = 'i see ur light';
        this.joury(line);
      }
    }
    if (!this.vivekDone && Game.savedCount() >= 3) { this.vivekDone = true; this.server('Vivek joined the game.'); setTimeout(() => { this.server('Vivek left the game.'); this.joury('coward', 1.6); }, 1300); }
  },
};

const Scare = {
  revealPending: false,
  reset() { Chat.reset(); this.pagesRead = new Set(); },
  welcome() {
    Chat.server('Welcome to JOURY_ISLAND.'); setTimeout(() => Chat.server('10 spectators are watching.'), 900);
    setTimeout(() => Chat.server('Joury is offline… for now.'), 2200);
  },
  onWake() { Chat.server('Joury joined the game.'); Chat.joury('ready?', 3); },
  onRescue(kid) { Chat.server(`${KID_NAMES[kid.c.def.id]} left the game.`); setTimeout(() => Chat.kid(kid.c.def.id, pick(['thank u!!! RUN', 'ty ty ty', 'GO. hes coming', 'i owe u my candy'])), 1500); },
  onCaught() { Chat.server('You were eliminated by Joury.'); },
  onSpotted() { if (Math.random() < 0.6) Chat.joury(pick(['found u', 'there u are', 'i see u']), 1.2); },
  // He imitates the kids from wherever he is standing
  mimic() {
    const pan = Joury.panFor(Joury.pos.x, Joury.pos.z), vol = clamp(0.9 - Joury.dist / 70, 0.15, 0.6);
    SFX.kidCall(pan, vol); HUD.kidSay(pick(['???: “help… please… over here…”', '???: “i\'m over here! come quick!”', '???: “it\'s safe… come this way…”']));
    setTimeout(() => SFX.kidCall(pan, vol * 0.7, true), 2600);
  },
  // Joury's diary pages, pinned around the island
  placePages() {
    const at = ['camp', 'swing', 'grave', 'tower', 'fire', 'scare', 'bus', 'patch'];
    this.pages = [];
    const paper = (n) => { const c = makeCanvas(300, 380), g = c.getContext('2d'); g.fillStyle = '#d9cfb4'; g.fillRect(0, 0, 300, 380); for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(80,60,30,${rand(0.02, 0.07)})`; g.fillRect(rand(0, 300), rand(0, 380), rand(1, 4), rand(1, 4)); }
      g.strokeStyle = 'rgba(90,110,160,.25)'; for (let y = 70; y < 380; y += 26) { g.beginPath(); g.moveTo(14, y); g.lineTo(286, y); g.stroke(); }
      g.fillStyle = 'rgba(120,20,20,.85)'; g.font = '26px "Special Elite", monospace'; g.fillText('DAY ' + DIARY[n].day, 20, 46);
      g.fillStyle = '#2a2220'; g.font = '17px "Special Elite", monospace'; let y = 92; DIARY[n].text.split('\n').forEach((ln) => { const words = ln.split(' '); let cur = ''; words.forEach((w) => { if (g.measureText(cur + w).width > 255) { g.fillText(cur, 20, y); y += 26; cur = ''; } cur += w + ' '; }); g.fillText(cur, 20, y); y += 26; });
      const grd = g.createRadialGradient(150, 190, 80, 150, 190, 260); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(60,40,10,.35)'); g.fillStyle = grd; g.fillRect(0, 0, 300, 380); return c; };
    at.forEach((id, n) => {
      const l = World.landmarks.find((q) => q.id === id); if (!l) return;
      let x = l.x, z = l.z; for (let k = 0; k < 24; k++) { const a = n * 1.7 + k * 0.6, r = (l.clear || 8) * 0.75 + (k % 4); const tx = l.x + Math.cos(a) * r, tz = l.z + Math.sin(a) * r, q = { x: tx, z: tz }; World.resolve(q, 0.5); if (World.walkable(tx, tz) && Math.hypot(q.x - tx, q.z - tz) < 0.01) { x = tx; z = tz; break; } }
      const y = World.groundAt(x, z), canvas = paper(n), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.atan2(l.x - x, l.z - z) + Math.PI;
      const post = mesh(new THREE.BoxGeometry(0.09, 1.3, 0.09), MAT.wood); post.position.y = 0.65; g.add(post);
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
      const sheet = mesh(new THREE.PlaneGeometry(0.26, 0.33), fogify(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide })), false); sheet.position.set(0, 1.12, 0.055); sheet.rotation.z = rand(-0.08, 0.08); g.add(sheet);
      const pin = mesh(new THREE.SphereGeometry(0.012, 6, 5), plainMat(0xb01e24, 0.4), false); pin.position.set(0, 1.26, 0.06); g.add(pin);
      World.scene.add(g); World.addCircle(x, z, 0.12);
      const page = { n, canvas, pos: new THREE.Vector3(x, y + 0.5, z) }; this.pages.push(page);
      World.interact.push({ kind: 'page', ref: page, pos: page.pos, r: 2.2, enabled: () => true, label: () => (this.pagesRead.has(n) ? 'Read diary page again' : 'Read the diary page') });
    });
  },
  readPage(page) {
    const first = !this.pagesRead.has(page.n); this.pagesRead.add(page.n);
    HUD.inspect({ title: `Joury's diary — Day ${DIARY[page.n].day}`, text: DIARY[page.n].text + `\n\n<span style="color:#8f877a">Diary pages found: ${this.pagesRead.size} / ${DIARY.length}</span>`, img: page.canvas });
    if (first) { SFX.pageTurn(); if (page.n === 7 || this.pagesRead.size === DIARY.length) Chat.joury('stop reading my stuff', 2); }
  },
  // Pumpkins die when he is near you
  updatePumpkins(dt) {
    const J = Joury, active = J.state === 'hunt' || J.state === 'stunned';
    World.jacks.forEach((j) => {
      if (j.gi === undefined) return;
      const d = active ? Math.hypot(j.x - J.pos.x, j.z - J.pos.z) : 99, want = smoothstep(9, 20, d);
      j.lit = j.lit === undefined ? 1 : damp(j.lit, want, want < j.lit ? 5 : 1.2, dt);
      const fl = j.lit < 0.98 && j.lit > 0.05 && Math.random() < 0.3 ? rand(0.2, 1) : 1, k = j.lit * fl;
      World.glow.setColor(j.gi, 0xff8a1a, k); if (j.src) j.src.dim = k;
      if (j.lit < 0.15 && !j.wasOut && d < 12) { j.wasOut = true; if (Math.hypot(Player.pos.x - j.x, Player.pos.z - j.z) < 18) SFX.snuff(); } else if (j.lit > 0.6) j.wasOut = false;
    });
  },
};

// ---------------------------------------------------------------------
//  WEATHER — rain, lightning and thunder (and lightning reveals)
// ---------------------------------------------------------------------
const Weather = {
  bolt: 0, boltT: 0, nextBolt: 30, thunderAt: -1, rain: null,
  init(scene) {
    const N = 3200, pos = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2), end = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { const x = rand(-16, 16), y = rand(0, 14), z = rand(-16, 16), s = Math.random(); for (let k = 0; k < 2; k++) { pos.set([x, y, z], (i * 2 + k) * 3); seed[i * 2 + k] = s; end[i * 2 + k] = k; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.rainU = { uTime: FogU.uTime, uCam: { value: new THREE.Vector3() }, uFlash: { value: 0 }, uAmount: { value: 1 } };
    const m = new THREE.ShaderMaterial({ uniforms: this.rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSeed; attribute float aEnd; uniform float uTime; uniform vec3 uCam; varying float vA;
        void main(){ vec3 p = position; float fall = mod(p.y - uTime * (10.0 + aSeed * 4.0), 14.0);
          vec3 w = vec3(uCam.x + mod(p.x - uCam.x + 16.0, 32.0) - 16.0, uCam.y - 5.0 + fall, uCam.z + mod(p.z - uCam.z + 16.0, 32.0) - 16.0);
          w += vec3(0.08, 0.42, 0.03) * aEnd;
          vec4 mv = modelViewMatrix * vec4(w, 1.0); vA = smoothstep(17.0, 1.5, -mv.z) * (0.5 + aSeed * 0.5); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform float uFlash; uniform float uAmount; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.42, 0.46, 0.55) * vA * (0.22 + uFlash * 2.0) * uAmount, 1.0); }' });
    this.rain = new THREE.LineSegments(g, m); this.rain.frustumCulled = false; this.rain.renderOrder = 6; scene.add(this.rain);
  },
  reset() { this.bolt = 0; this.nextBolt = rand(35, 55); this.thunderAt = -1; this.flash = 0; },
  strike(reveal) {
    this.boltT = 0; this.bolt = 1; this.pulses = [0, rand(0.08, 0.14), rand(0.22, 0.35)]; this.thunderAt = rand(0.5, 2.2); this.thunderVol = rand(0.5, 0.9);
    if (reveal && Joury.state === 'hunt' && !Joury.seen && Joury.dist > 14) Joury.lightningReveal();
  },
  update(dt, cam, active) {
    this.rainU.uCam.value.copy(cam.position);
    this.flash = 0;
    if (active) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.nextBolt = rand(28, 55) * (Joury.enraged ? 0.6 : 1); this.strike(Math.random() < 0.45); }
    }
    if (this.bolt) {
      this.boltT += dt;
      this.pulses.forEach((p) => { const k = this.boltT - p; if (k > 0 && k < 0.12) this.flash = Math.max(this.flash, Math.sin(k / 0.12 * Math.PI)); });
      if (this.boltT > 0.6) this.bolt = 0;
    }
    if (this.thunderAt >= 0) { this.thunderAt -= dt; if (this.thunderAt < 0) SFX.thunder(this.thunderVol); }
    this.rainU.uFlash.value = this.flash;
    World.sky.material.uniforms.uFlash.value = this.flash;
    World.lightningK = this.flash;
  },
};
