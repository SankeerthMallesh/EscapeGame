// =====================================================================
//  JOURY — waits, wanders, stalks, teleports behind you, stares you down
// =====================================================================
const JOURY_LINES = ['GG? NOT GG.', 'Rematch, Vivek!', 'Five to four. FIVE. TO. FOUR.', "You can't spawn-camp me.", 'Trick or treat… or DEFEAT.', 'Nobody leaves until I win.', 'My controller still works. Mostly.', 'Bridge is MY game.', 'I see you.', 'One more round…', 'It was LAG. It was LAG!', 'Who said you could leave the lobby?', 'Say GG. I dare you.'];
const JOURY_ANGRY = ['GIVE BACK MY CANDY!', 'NO BOATS. NO REMATCHES.', "YOU'RE NOT LEAVING MY SERVER!", "I'M NOT MAD. I'M NOT MAD!", 'NOT. GG.', 'THAT BOAT IS RIGGED!'];
const _jv = new THREE.Vector3(), _jv2 = new THREE.Vector3(), _jv3 = new THREE.Vector3();

const Joury = {
  c: null, pos: new THREE.Vector3(), yaw: 0, state: 'dormant', t: 0, timer: 0, stare: 0, seen: false, looking: false, seenT: 0, unseenT: 0,
  tpT: 12, lineT: 18, stepT: 0, stunT: 0, enraged: false, dist: 99, danger: 0, stuckT: 0, moving: false, speed: 0, lastLine: '',
  init(scene) { this.c = makeJoury(); this.c.root.visible = false; scene.add(this.c.root); },
  reset() {
    this.state = 'dormant'; this.timer = D().startDelay; this.stare = 0; this.seenT = this.unseenT = 0; this.enraged = false; this.danger = 0; this.seen = this.looking = false;
    this.tpT = rand(D().tpMin, D().tpMax); this.lineT = 22; this.stunT = 0; this.tipShown = false;
    const cb = World.cabin; this.pos.set(cb.x, cb.y, cb.z); this.c.root.visible = false; this.dist = 99;
  },
  wake() {
    this.state = 'hunt'; const d = World.cabin.door; this.pos.set(d.x, World.groundAt(d.x, d.z), d.z); this.c.root.visible = true;
    this.tpT = 6;
    const far = Math.hypot(Player.pos.x - d.x, Player.pos.z - d.z);
    SFX.slam(clamp(1 - far / 200, 0.15, 0.6));
    HUD.toast('Somewhere in the woods, a cabin door slams.<br><b>Joury is awake.</b>', 4.5);
    setTimeout(() => this.say('…Who is on MY island?'), 1800);
  },
  speedFor() { const d = D(); return d.chaseBase + d.chasePerKid * Game.savedCount() + (this.enraged ? d.enrage : 0); },
  enrage() { this.enraged = true; this.say(pick(JOURY_ANGRY), true); if (this.state === 'hunt') this.teleport('far'); },
  stun(sec) {
    this.state = 'stunned'; this.stunT = sec; this.stare = 0;
    const d = World.cabin.door; const x = d.x + 3.2, z = d.z + 1.2; this.pos.set(x, World.groundAt(x, z), z); this.c.root.visible = true;
    this.yaw = Math.atan2(-1, 0.3);
  },
  panFor(x, z) { const cam = World.cam; _jv.set(x - cam.position.x, 0, z - cam.position.z).normalize(); _jv2.set(1, 0, 0).applyQuaternion(cam.quaternion); return clamp(_jv.dot(_jv2), -1, 1); },
  say(text, angry) {
    if (!text) { const pool = this.enraged ? JOURY_ANGRY : JOURY_LINES; do { text = pick(pool); } while (text === this.lastLine && pool.length > 1); }
    this.lastLine = text; HUD.jourySay(text);
    SFX.voice(this.panFor(this.pos.x, this.pos.z), clamp(0.75 - this.dist / 80, 0.2, 0.7), angry || this.enraged);
  },
  teleport(mode) {
    const P = Player.pos, d = D();
    const prog = clamp(1 - Game.savedCount() * 0.035 - (this.enraged ? 0.15 : 0), 0.55, 1);
    for (let i = 0; i < 24; i++) {
      let a, dist;
      if (mode === 'behind') { a = Player.yaw + Math.PI + rand(-1.0, 1.0); dist = rand(d.tpDist[0], d.tpDist[1]) * prog; }
      else if (mode === 'ahead') { a = Player.yaw + rand(-0.45, 0.45); dist = rand(22, 30); }
      else { a = rand(0, TAU); dist = rand(55, 80); }
      const x = P.x - Math.sin(a) * dist, z = P.z - Math.cos(a) * dist;
      if (!World.walkable(x, z) || World.onBridge(x, z) || World.onDock(x, z)) continue;
      const p = { x, z }; World.resolve(p, 0.5); if (Math.hypot(p.x - x, p.z - z) > 0.2) continue;
      if (mode === 'behind') { const fx = -Math.sin(Player.yaw), fz = -Math.cos(Player.yaw); if (((x - P.x) * fx + (z - P.z) * fz) / dist > 0.1) continue; }
      this.pos.set(x, World.groundAt(x, z), z); this.stuckT = 0;
      if (mode !== 'far' && CFG.difficulty !== 'nightmare') SFX.whoosh(this.panFor(x, z));
      return true;
    }
    return false;
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
  update(dt) {
    this.t += dt; const P = Player.pos, d = D();
    const dx = P.x - this.pos.x, dz = P.z - this.pos.z; this.dist = Math.hypot(dx, dz);
    if (this.state === 'dormant') {
      this.timer -= dt; this.danger = 0; this.seen = false;
      if (this.timer <= 0) this.wake();
      return;
    }
    if (this.state === 'stunned') {
      this.stunT -= dt; this.seen = false; this.danger = 0.1;
      animateJoury(this.c, this.t, false, 0, 'stunned');
      this.c.root.position.copy(this.pos); this.c.root.rotation.y = this.yaw;
      if (this.stunT <= 0) { this.state = 'hunt'; this.teleport('far'); this.tpT = 8; this.say('…Where did you GO?!'); }
      return;
    }
    if (this.state !== 'hunt') return;
    const vis = this.visibility();
    const wasSeen = this.seen;
    this.seen = vis.visible; this.looking = vis.looking;
    if (vis.visible) {
      this.seenT += dt;
      const close = clamp(1 - this.dist / 25, 0, 1);
      this.stare += dt * (vis.looking ? (0.4 + close * 1.8) * (Player.lightOn ? 1.15 : 1) : 0.22);
      if (!wasSeen && this.unseenT > 6 && Math.random() < 0.5) this.say();
      if (!wasSeen) SFX.sting();
      if (!this.tipShown && this.seenT > 0.4) { this.tipShown = true; HUD.toast("<b style='color:#ff5a4a'>That's Joury.</b> Don't stare at him — the static means he's coming for you.<br>Look away and <b>RUN</b> (Shift)!", 5); }
      this.unseenT = 0;
    } else {
      this.unseenT += dt; this.seenT = 0; this.stare = Math.max(0, this.stare - dt * 0.8);
    }
    if (this.stare >= d.stareLimit || this.dist < d.catchR + (this.enraged ? 0.2 : 0)) { Game.caught(); return; }
    // movement
    let speed = 0;
    if (!vis.visible) speed = this.dist > 40 ? Math.max(this.speedFor(), 4.4) : this.speedFor();
    else speed = d.creep + (this.enraged ? 0.3 : 0);
    this.moving = speed > 0.05 && this.dist > 0.5;
    if (this.moving) {
      const step = Math.min(speed * dt, this.dist), nx = this.pos.x + dx / this.dist * step, nz = this.pos.z + dz / this.dist * step;
      const p = { x: nx, z: nz }; World.resolve(p, 0.45);
      if (World.walkable(p.x, p.z)) { const moved = Math.hypot(p.x - this.pos.x, p.z - this.pos.z); this.stuckT = moved < step * 0.25 ? this.stuckT + dt : 0; this.pos.x = p.x; this.pos.z = p.z; }
      else this.stuckT += dt;
      this.pos.y = World.surfaceY(this.pos.x, this.pos.z);
      if (this.stuckT > 2.5 && !vis.visible) this.teleport(this.dist > 30 ? 'behind' : 'far');
    }
    this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * (vis.visible ? 2 : 6));
    // teleports & vanishing
    if (!vis.visible) {
      this.tpT -= dt * (this.enraged ? 1.6 : 1);
      if (this.tpT <= 0) {
        this.tpT = rand(d.tpMin, d.tpMax) * clamp(1 - Game.savedCount() * 0.04, 0.6, 1);
        if (this.dist > d.tpDist[1] + 3) this.teleport(this.dist > 34 && Math.random() < 0.35 ? 'ahead' : 'behind');
      }
    } else if (this.seenT > 2.2 && this.dist > 14 && Math.random() < dt * 0.35) {
      this.teleport('far'); this.seenT = 0; GFX.fx.static = Math.max(GFX.fx.static, 0.8); SFX.whoosh(0);
    }
    // footsteps you can hear but not see
    if (this.moving && !vis.visible && this.dist < 24) {
      this.stepT -= dt * speed;
      if (this.stepT <= 0) { this.stepT = 1.5; SFX.jouryStep(this.panFor(this.pos.x, this.pos.z), clamp(1 - this.dist / 24, 0.08, 0.9)); if (Math.random() < 0.08) SFX.twig(this.panFor(this.pos.x, this.pos.z), 0.15); }
    }
    // talking
    this.lineT -= dt;
    if (this.lineT <= 0 && this.dist < 38) { this.lineT = rand(16, 30) * (this.enraged ? 0.6 : 1); this.say(); }
    // model
    animateJoury(this.c, this.t, this.moving, speed, null);
    this.c.root.position.copy(this.pos); this.c.root.rotation.y = this.yaw;
    if (vis.visible && this.dist < 18 && Math.random() < 0.06) { this.c.root.position.x += rand(-0.12, 0.12); this.c.root.position.z += rand(-0.12, 0.12); }
    const s = this.enraged ? 1.08 : 1; this.c.root.scale.setScalar(s);
    // fear level for the screen effects
    const near = clamp(1 - this.dist / 30, 0, 1);
    this.danger = Math.max(Math.pow(near, 1.4) * 0.8, vis.visible ? 0.35 + (this.stare / d.stareLimit) * 0.65 : 0);
  },
};
