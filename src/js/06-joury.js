// =====================================================================
//  JOURY — waits, wanders, stalks, teleports behind you, stares you down
//
//  Two halves:
//   • think()  — his brain: who he hunts, where he walks, when he teleports.
//                Runs in a solo game, and on the host of an online game.
//   • update() — what YOU see and feel: the stare meter, getting caught,
//                his footsteps, the fear level. Runs for every player.
//  In an online game the other players' copies just follow the host's Joury.
// =====================================================================
const JOURY_LINES = ['GG? NOT GG.', 'Rematch, Vivek!', 'Five to four. FIVE. TO. FOUR.', "You can't spawn-camp me.", 'Trick or treat… or DEFEAT.', 'Nobody leaves until I win.', 'My controller still works. Mostly.', 'Bridge is MY game.', 'I see you.', 'One more round…', 'It was LAG. It was LAG!', 'Who said you could leave the lobby?', 'Say GG. I dare you.'];
const JOURY_ANGRY = ["YOU LAUGHED TOO. DIDN'T YOU?", 'NO BOATS. NO REMATCHES.', "YOU'RE NOT LEAVING MY SERVER!", "I'M NOT MAD. I'M NOT MAD!", 'NOT. GG.', 'THAT BOAT IS RIGGED!'];
const _jv = new THREE.Vector3(), _jv2 = new THREE.Vector3(), _jv3 = new THREE.Vector3();

const Joury = {
  c: null, pos: new THREE.Vector3(), yaw: 0, state: 'dormant', t: 0, timer: 0, stare: 0, seen: false, looking: false, seenT: 0, unseenT: 0,
  tpT: 12, lineT: 18, stepT: 0, stunT: 0, enraged: false, dist: 99, danger: 0, stuckT: 0, moving: false, speed: 0, lastLine: '',
  knowT: 0, heardT: 99, heardPos: new THREE.Vector3(), roam: new THREE.Vector3(), roamT: 0, mimicT: 70, revealT: 0, spotted: false,
  focus: null, fd: 99, anySeen: false, watchT: 0, awayT: 0, net: null, _me: { id: 'me', local: true },
  init(scene) { this.c = makeJoury(); this.c.root.visible = false; scene.add(this.c.root); },
  reset() {
    this.state = 'dormant'; this.timer = Net.on && Net.jouryPlayer() ? 20 : D().startDelay + (Net.isClient ? 0 : Perks.startDelayBonus()); this.stare = 0; this.seenT = this.unseenT = 0; this.enraged = false; this.danger = 0; this.seen = this.looking = false;
    this.tpT = rand(D().tpMin, D().tpMax); this.lineT = 22; this.stunT = 0; this.tipShown = false;
    this.knowT = 0; this.heardT = 99; this.roamT = 0; this.mimicT = rand(55, 80); this.revealT = 0; this.spotted = false;
    this.focus = null; this.fd = 99; this.anySeen = false; this.watchT = 0; this.awayT = 0; this.net = null; this.moving = false; this.speed = 0;
    const cb = World.cabin; this.pos.set(cb.x, cb.y, cb.z); this.c.root.visible = false; this.dist = 99;
  },

  // ---------------- who he can hunt ----------------
  // Alone, that is just you. Online, the host lists every player who is out on the island.
  targets() {
    if (Net.isHost) return Net.targets();
    const m = this._me, P = Player;
    m.x = P.pos.x; m.z = P.pos.z; m.yaw = P.yaw; m.lightOn = P.lightOn; m.crouching = !!P.crouching; m.sprinting = !!P.sprinting; m.noise = P.noise || 0; m.sees = this.seen;
    return Game.state === 'play' ? [m] : [];
  },
  // Pick who to go after: whoever he has left alone the longest (ties: the nearest).
  pickFocus(T = this.targets()) {
    let best = null, bs = -Infinity;
    for (const t of T) { const s = (this.t - (t.hauntAt === undefined ? -1e6 : t.hauntAt)) - Math.hypot(t.x - this.pos.x, t.z - this.pos.z) * 0.01; if (s > bs) { bs = s; best = t; } }
    if (best) best.hauntAt = this.t;
    this.focus = best; return best;
  },
  // Sounds that only the hunted player should hear
  cue(F, x, z) {
    if (!F || F.local) SFX.whoosh(x === undefined ? 0 : this.panFor(x, z));
    else if (Net.isHost) Net.emit(x === undefined ? { e: 'whoosh' } : { e: 'whoosh', x: r2(x), z: r2(z) }, F.id);
  },

  wake() {
    this.state = 'hunt'; const d = World.cabin.door; this.pos.set(d.x, World.groundAt(d.x, d.z), d.z); this.c.root.visible = true;
    this.tpT = 6;
    this.wakeFx(); if (Net.isHost) Net.broadcast({ t: 'ev', e: 'wake' });
    Scare.onWake();
    setTimeout(() => this.say('…Who is on MY island?', false, true), 1800);
  },
  wakeFx() {
    if (Game.state !== 'play') return;
    const d = World.cabin.door, far = Math.hypot(Player.pos.x - d.x, Player.pos.z - d.z);
    SFX.slam(clamp(1 - far / 200, 0.15, 0.6));
    HUD.toast('Somewhere in the woods, a cabin door slams.<br><b>Joury is awake.</b> He hunts by sound — sprinting is loud, crouching (C) is quiet.', 5.5);
  },
  speedFor() { const d = D(); return d.chaseBase + d.chasePerKid * Game.savedCount() + (this.enraged ? d.enrage : 0); },
  enrage() { this.enraged = true; this.say(pick(JOURY_ANGRY), true, true); if (this.state === 'hunt' && !(Net.on && Net.jouryPlayer())) this.teleport('far'); },
  stun(sec) {
    this.state = 'stunned'; this.stunT = sec; this.stare = 0;
    const d = World.cabin.door; const x = d.x + 3.2, z = d.z + 1.2; this.pos.set(x, World.groundAt(x, z), z); this.c.root.visible = true;
    this.yaw = Math.atan2(-1, 0.3);
  },
  // Online: he has caught someone. He drags them to the cabin, then comes back for the rest.
  carryOff(p) {
    if (this.focus === p) this.focus = null;
    if (this.state !== 'hunt') return;
    this.state = 'away'; this.awayT = 6; this.knowT = 0; this.heardT = 99; this.revealT = 0; this.watchT = 0; this.moving = false; this.speed = 0;
  },
  panFor(x, z) { const cam = World.cam; _jv.set(x - cam.position.x, 0, z - cam.position.z).normalize(); _jv2.set(1, 0, 0).applyQuaternion(cam.quaternion); return clamp(_jv.dot(_jv2), -1, 1); },
  line() { const pool = this.enraged ? JOURY_ANGRY : JOURY_LINES; let text; do { text = pick(pool); } while (text === this.lastLine && pool.length > 1); return text; },
  // He speaks. Online, the host decides the line and everyone near him hears it (all = everyone, wherever they are).
  say(text, angry, all) {
    if (Net.isClient) return;
    text = text || this.line(); this.lastLine = text;
    if (!Net.on) { this.sayLocal(text, angry); return; }
    Net.broadcast({ t: 'ev', e: 'jsay', text, angry: !!(angry || this.enraged), all: !!all });
    if (Game.state === 'play' && (all || this.dist < 45)) this.sayLocal(text, angry);
  },
  sayLocal(text, angry) {
    text = text || this.line(); this.lastLine = text; HUD.jourySay(text);
    SFX.voice(this.panFor(this.pos.x, this.pos.z), clamp(0.75 - this.dist / 80, 0.2, 0.7), angry || this.enraged);
  },
  teleport(mode) {
    const F = this.focus || this.pickFocus(); if (!F) return false;
    if (F === this._me) this.targets(); // make sure "you" is where you are right now
    const d = D();
    const prog = clamp(1 - Game.savedCount() * 0.035 - (this.enraged ? 0.15 : 0), 0.55, 1);
    for (let i = 0; i < 24; i++) {
      let a, dist;
      if (mode === 'behind') { a = F.yaw + Math.PI + rand(-1.0, 1.0); dist = rand(d.tpDist[0], d.tpDist[1]) * prog; }
      else if (mode === 'ahead') { a = F.yaw + rand(-0.45, 0.45); dist = rand(22, 30); }
      else if (mode === 'near') { a = rand(0, TAU); dist = rand(24, 36); }
      else if (mode === 'reveal') { a = F.yaw + rand(-0.35, 0.35); dist = rand(14, 20); }
      else { a = rand(0, TAU); dist = rand(55, 80); }
      const x = F.x - Math.sin(a) * dist, z = F.z - Math.cos(a) * dist;
      if (!World.walkable(x, z) || World.onBridge(x, z) || World.onDock(x, z)) continue;
      const p = { x, z }; World.resolve(p, 0.5); if (Math.hypot(p.x - x, p.z - z) > 0.2) continue;
      if (mode === 'behind' || mode === 'near') { const fx = -Math.sin(F.yaw), fz = -Math.cos(F.yaw); if (((x - F.x) * fx + (z - F.z) * fz) / dist > (mode === 'near' ? 0.4 : 0.1)) continue; }
      if ((mode === 'ahead' || mode === 'reveal') && World.blocked(F.x, F.z, x, z)) continue;
      this.pos.set(x, World.groundAt(x, z), z); this.stuckT = 0;
      if (mode !== 'far' && CFG.difficulty !== 'nightmare') this.cue(F, x, z);
      return true;
    }
    return false;
  },
  // A flash of lightning shows him standing out in the trees — then he's gone
  lightningReveal() {
    if (Net.on && Net.jouryPlayer()) return false;
    if (this.teleport('reveal') || this.teleport('ahead')) {
      const F = this.focus; this.revealT = 1.5; this.yaw = Math.atan2(F.x - this.pos.x, F.z - this.pos.z);
      if (F.local) this.stare = Math.max(0, this.stare - 1);
      return true;
    }
    return false;
  },
  // A loud noise (freeing a kid, grabbing a part, banging on the cabin door)
  // a firecracker went off: he goes to look
  hearAt(x, z, radius) {
    if (Net.isClient || this.state !== 'hunt' || (Net.on && Net.jouryPlayer())) return;
    if (Math.hypot(x - this.pos.x, z - this.pos.z) < radius) { this.heardT = 0; this.heardPos.set(x, 0, z); this.knowT = 0; }
  },
  hear(radius, who) {
    if (Net.isClient) { Net.act('noise', { r: radius }); return; }
    const T = who || this.targets()[0]; if (!T || this.state !== 'hunt') return;
    if (Math.hypot(T.x - this.pos.x, T.z - this.pos.z) < radius) { this.heardT = 0; this.heardPos.set(T.x, 0, T.z); if (this.knowT <= 0) this.focus = T; }
  },
  visibility() {
    const cam = World.cam; cam.getWorldDirection(_jv2);
    _jv.set(this.pos.x, this.pos.y + this.c.eyeY, this.pos.z).sub(cam.position);
    const d = _jv.length(); _jv.divideScalar(d);
    const cosA = _jv.dot(_jv2);
    const range = Math.min(Player.lightOn ? 36 : 24, 1.35 / D().fog);
    const inView = cosA > 0.72 && d < range;
    const visible = inView && !World.blocked(cam.position.x, cam.position.z, this.pos.x, this.pos.z);
    return { visible, looking: visible && cosA > 0.93, cosA, d };
  },

  // ---------------- his brain (solo game, or the host of an online game) ----------------
  think(dt) {
    const d = D();
    if (this.state === 'dormant') { this.timer -= dt; if (this.timer <= 0) this.wake(); return; }
    if (this.state === 'stunned') {
      this.stunT -= dt;
      if (this.stunT <= 0) { this.state = 'hunt'; this.focus = null; this.teleport('far'); this.tpT = 8; this.say('…Where did you GO?!', false, true); }
      return;
    }
    if (this.state === 'away') {
      this.awayT -= dt;
      if (this.awayT <= 0) { this.state = 'hunt'; this.focus = null; this.teleport('far'); this.tpT = rand(4, 8); }
      return;
    }
    if (this.state !== 'hunt') return;
    const T = this.targets();
    // VIP Joury: a player is steering him. Follow them; the rest of his brain is switched off.
    const jp = Net.isHost && Net.jouryPlayer();
    if (jp) {
      if (jp.local) Net.refreshMe();
      const was = this.pos.x;
      this.pos.x = jp.x; this.pos.z = jp.z; this.pos.y = World.surfaceY(jp.x, jp.z); this.yaw = jp.yaw + Math.PI;
      this.moving = jp.mv > 0; this.speed = jp.mv === 2 ? 6.5 : jp.mv === 1 ? 3.6 : 0;
      this.anySeen = T.some((t) => t.sees); this.revealT = 0; this.focus = null;
      this.fd = T.reduce((m, t) => Math.min(m, Math.hypot(t.x - jp.x, t.z - jp.z)), 99);
      return;
    }
    const seen = this.anySeen = T.some((t) => t.sees);
    this.watchT = seen ? this.watchT + dt : 0;
    if (!T.length) { this.focus = null; this.fd = 99; this.moving = false; this.speed = 0; return; } // everyone is locked in the cabin
    if (!this.focus || !T.includes(this.focus)) this.pickFocus(T);
    if (this.revealT > 0) { this.revealT -= dt; if (this.revealT <= 0) { const F0 = this.focus; this.teleport('far'); this.cue(F0); } }
    // senses: who does he see or hear?
    let spotted = null, sd = Infinity, heard = null;
    for (const t of T) {
      const ex = t.x - this.pos.x, ez = t.z - this.pos.z, td = Math.hypot(ex, ez);
      const spotR = (t.lightOn ? 30 : 12) * (t.crouching ? 0.65 : 1) * (this.enraged ? 1.25 : 1);
      if (td < spotR && this.revealT <= 0 && td < sd) {
        const facing = (ex * Math.sin(this.yaw) + ez * Math.cos(this.yaw)) / Math.max(td, 0.01);
        if ((facing > 0.2 || td < 6) && !World.blocked(this.pos.x, this.pos.z, t.x, t.z)) { spotted = t; sd = td; }
      }
      if (t.noise > 0 && td < t.noise) { this.heardT = 0; this.heardPos.set(t.x, 0, t.z); heard = t; }
    }
    if (spotted) { if (this.knowT <= 0) Scare.onSpotted(spotted); this.knowT = 4; this.focus = spotted; }
    else if (heard && this.knowT <= 0) this.focus = heard;
    let F = this.focus;
    let dx = F.x - this.pos.x, dz = F.z - this.pos.z, fd = this.fd = Math.hypot(dx, dz);
    this.knowT -= dt; this.heardT += dt;
    let tx, tz, speed;
    if (this.knowT > 0) { tx = F.x; tz = F.z; speed = this.speedFor(); }
    else if (this.heardT < 9) { tx = this.heardPos.x; tz = this.heardPos.z; speed = this.speedFor() * 0.92; }
    else {
      this.roamT -= dt;
      if (this.roamT <= 0 || Math.hypot(this.roam.x - this.pos.x, this.roam.z - this.pos.z) < 2) {
        this.roamT = rand(7, 13);
        for (let k = 0; k < 10; k++) { const a = rand(0, TAU), r = rand(10, 34), x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r; if (World.walkable(x, z)) { this.roam.set(x, 0, z); break; } }
      }
      tx = this.roam.x; tz = this.roam.z; speed = fd > 45 ? 4.4 : this.speedFor() * 0.7;
    }
    // he cannot move while anyone is watching him
    if (seen || this.revealT > 0) speed = this.revealT > 0 ? 0 : d.creep + (this.enraged ? 0.3 : 0);
    const gx = tx - this.pos.x, gz = tz - this.pos.z, gd = Math.hypot(gx, gz);
    this.moving = speed > 0.05 && gd > 0.6;
    if (this.moving) {
      const step = Math.min(speed * dt, gd), nx = this.pos.x + gx / gd * step, nz = this.pos.z + gz / gd * step;
      const p = { x: nx, z: nz }; World.resolve(p, 0.45);
      if (World.walkable(p.x, p.z)) { const moved = Math.hypot(p.x - this.pos.x, p.z - this.pos.z); this.stuckT = moved < step * 0.25 ? this.stuckT + dt : 0; this.pos.x = p.x; this.pos.z = p.z; }
      else this.stuckT += dt;
      this.pos.y = World.surfaceY(this.pos.x, this.pos.z);
      if (this.stuckT > 2.5 && !seen) this.teleport(fd > 30 ? 'near' : 'far');
    }
    const faceA = this.moving && !seen ? Math.atan2(gx, gz) : Math.atan2(dx, dz);
    this.yaw += angDiff(this.yaw, faceA) * Math.min(1, dt * (seen ? 2 : 6));
    // teleports & vanishing: he closes in faster when he has heard you
    if (!seen && this.revealT <= 0) {
      this.tpT -= dt * (this.enraged ? 1.6 : 1) * (this.heardT < 6 ? 1.5 : 1);
      if (this.tpT <= 0) {
        // with more players he gets around faster, and takes turns haunting each of them
        this.tpT = rand(d.tpMin, d.tpMax) * clamp(1 - Game.savedCount() * 0.04, 0.6, 1) / (1 + 0.35 * (T.length - 1));
        if (T.length > 1 && this.knowT <= 0 && this.heardT > 6) { F = this.pickFocus(T); fd = this.fd = Math.hypot(F.x - this.pos.x, F.z - this.pos.z); }
        if (fd > d.tpDist[1] + 3) this.teleport(this.heardT < 6 || this.knowT > 0 ? 'behind' : fd > 34 && Math.random() < 0.35 ? 'ahead' : 'near');
      }
      this.mimicT -= dt;
      if (this.mimicT <= 0 && fd > 22 && fd < 65) { this.mimicT = rand(55, 95); Scare.mimic(F); }
    } else if (seen && this.revealT <= 0 && this.watchT > 2.2 && fd > 14 && Math.random() < dt * 0.35) {
      this.teleport('far'); this.watchT = 0; this.seenT = 0;
      if (Net.isHost) Net.broadcast({ t: 'ev', e: 'vanish' });
      if (!Net.on || (this.seen && Game.state === 'play')) { GFX.fx.static = Math.max(GFX.fx.static, 0.8); SFX.whoosh(0); }
    }
    // talking
    this.lineT -= dt;
    if (this.lineT <= 0 && fd < 38) { this.lineT = rand(16, 30) * (this.enraged ? 0.6 : 1); this.say(); }
    this.speed = speed;
  },
  // Host, while their own screen is somewhere else (in the cabin, on the caught screen, in a background tab)
  thinkOnly(dt) { this.t += dt; this.seen = this.looking = false; this.think(dt); },
  // Other players: slide towards where the host says he is
  follow(dt) {
    const n = this.net; if (!n) return;
    if (n.state !== this.state || Math.hypot(n.x - this.pos.x, n.z - this.pos.z) > 5) { this.pos.x = n.x; this.pos.z = n.z; this.yaw = n.yaw; }
    else { const k = 1 - Math.exp(-14 * dt); this.pos.x += (n.x - this.pos.x) * k; this.pos.z += (n.z - this.pos.z) * k; this.yaw += angDiff(this.yaw, n.yaw) * k; }
    this.pos.y = n.state === 'stunned' ? World.groundAt(this.pos.x, this.pos.z) : World.surfaceY(this.pos.x, this.pos.z);
    this.state = n.state; this.enraged = n.enraged; this.moving = n.moving; this.speed = n.speed; this.revealT = n.reveal ? 1 : 0;
    this.stunT = n.stunT = Math.max(0, n.stunT - dt);
  },

  // ---------------- what you see, hear and feel ----------------
  update(dt) {
    this.t += dt; const P = Player.pos, d = D(), brain = !Net.isClient, R = this.c.root;
    if (Net.amJoury()) { // you ARE Joury: no model in your face, no stare meter, nobody to catch you
      if (brain) this.think(dt); else this.follow(dt);
      R.visible = false; this.seen = this.looking = false; this.stare = 0; this.danger = 0; this.dist = 99; return;
    }
    if (!brain) this.follow(dt);
    this.dist = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    if (this.state !== 'hunt') {
      this.seen = this.looking = false; this.danger = this.state === 'stunned' ? 0.1 : 0;
      if (brain) this.think(dt);
      if (this.state === 'stunned') { R.visible = true; animateJoury(this.c, this.t, false, 0, 'stunned'); R.position.copy(this.pos); R.rotation.y = this.yaw; }
      else if (this.state !== 'hunt') R.visible = false;
      return;
    }
    const vis = this.visibility();
    const wasSeen = this.seen;
    this.seen = vis.visible; this.looking = vis.looking;
    if (vis.visible) {
      this.seenT += dt;
      const close = clamp(1 - this.dist / 25, 0, 1);
      if (this.revealT <= 0) this.stare += dt * (vis.looking ? (0.4 + close * 1.8) * (Player.lightOn ? 1.15 : 1) : 0.22);
      if (!wasSeen && this.unseenT > 6 && Math.random() < 0.5) this.sayLocal();
      if (!wasSeen) SFX.sting();
      if (!this.tipShown && this.seenT > 0.4) { this.tipShown = true; HUD.toast("<b style='color:#ff5a4a'>That's Joury.</b> Don't stare at him — the static means he's coming for you.<br>Look away and <b>RUN</b> (Shift)!", 5); }
      this.unseenT = 0;
    } else {
      this.unseenT += dt; this.seenT = 0; this.stare = Math.max(0, this.stare - dt * 0.8);
    }
    if (this.stare >= d.stareLimit || this.dist < d.catchR + (this.enraged ? 0.2 : 0)) { Game.caught(); return; }
    if (brain) { this.think(dt); if (this.state !== 'hunt') { if (this.state !== 'stunned') R.visible = false; return; } }
    const speed = this.speed;
    // footsteps you can hear but not see
    if (this.moving && !vis.visible && this.dist < 24) {
      this.stepT -= dt * speed;
      if (this.stepT <= 0) { this.stepT = 1.5; SFX.jouryStep(this.panFor(this.pos.x, this.pos.z), clamp(1 - this.dist / 24, 0.08, 0.9)); if (Math.random() < 0.08) SFX.twig(this.panFor(this.pos.x, this.pos.z), 0.15); }
    }
    // model
    R.visible = true;
    animateJoury(this.c, this.t, this.moving, speed, null);
    R.position.copy(this.pos); R.rotation.y = this.yaw;
    if (vis.visible && this.dist < 18 && Math.random() < 0.06) { R.position.x += rand(-0.12, 0.12); R.position.z += rand(-0.12, 0.12); }
    const s = this.enraged ? 1.08 : 1; R.scale.setScalar(s);
    // fear level for the screen effects
    const near = clamp(1 - this.dist / 30, 0, 1);
    this.danger = Math.max(Math.pow(near, 1.4) * 0.8, vis.visible ? 0.35 + (this.stare / d.stareLimit) * 0.65 : 0);
  },
};
