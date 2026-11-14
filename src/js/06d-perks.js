// =====================================================================
//  PERKS — redeemable codes, referral codes, firecrackers, and VIP Joury
// =====================================================================
const CODES = {
  KEYBOARD: { id: 'vip', icon: '👑', title: 'VIP · Play as Joury', text: 'In an online game, choose "Play as Joury" in the lobby and hunt your friends.' },
  VIVEK: { id: 'legs', icon: '🏃', title: "Vivek's legs", text: 'You can sprint 40% longer.' },
  CANDY: { id: 'battery', icon: '🍬', title: 'Candy-powered battery', text: 'Your flashlight battery lasts 50% longer.' },
  BRIDGE: { id: 'crackers', icon: '🧨', title: 'Firework pack', text: 'Start every game with 2 extra firecrackers.' },
  ADMIN: { id: 'admin', icon: '🛠️', title: 'Admin panel', text: 'Press F8 during a game to open it: teleport, god mode, speed, control Joury, free kids, show the cabin code and more.' },
  REMATCH: { id: 'head', icon: '⏱️', title: 'Head start', text: 'Joury waits 10 seconds longer before he wakes up.' },
};
const REF_BONUS = { id: 'recruit', icon: '🤝', title: 'Recruited by a friend', text: 'Your flashlight battery lasts 20% longer. Play online with the friend who invited you for the Squad bonus.' };
const SQUAD_TEXT = 'Squad bonus: you are playing with a friend you invited (or who invited you). You both recover stamina 30% faster.';

const Perks = {
  load() {
    if (!Array.isArray(CFG.perks)) CFG.perks = [];
    if (!/^JRY-[A-HJ-NP-T]{5}$/.test(CFG.refCode || '')) { CFG.refCode = 'JRY-' + Array.from({ length: 5 }, () => NET_ALPHA[Math.floor(Math.random() * NET_ALPHA.length)]).join(''); saveSettings(); }
  },
  has(id) { return (CFG.perks || []).includes(id); },
  squad: false,
  stamK() { return this.has('legs') ? 1.4 : 1; },
  regenK() { return this.squad ? 1.3 : 1; },
  drainK() { return (this.has('battery') ? 1 / 1.5 : 1) * (this.has('recruit') ? 1 / 1.2 : 1); },
  crackers() { return 3 + (this.has('crackers') ? 2 : 0); },
  startDelayBonus() { return this.has('head') ? 10 : 0; },
  redeem(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!code) return { ok: false, msg: 'Type a code first.' };
    if (/^JRY-?[A-Z0-9]{5}$/.test(code)) {
      const ref = code.replace('-', '').replace(/^JRY/, 'JRY-');
      if (ref === CFG.refCode) return { ok: false, msg: "That's your own referral code. Give it to a friend instead." };
      if (CFG.refUsed) return { ok: false, msg: `You already used a referral code (${CFG.refUsed}).` };
      if (!/^JRY-[A-HJ-NP-T]{5}$/.test(ref)) return { ok: false, msg: "That referral code doesn't exist. Check the letters." };
      CFG.refUsed = ref; CFG.perks.push('recruit'); saveSettings();
      return { ok: true, msg: `Referral accepted! ${REF_BONUS.icon} ${REF_BONUS.title}.` };
    }
    const c = CODES[code];
    if (!c) return { ok: false, msg: "That code doesn't exist. Codes are one word, like a hidden word from the story." };
    if (this.has(c.id)) return { ok: false, msg: `You already have ${c.icon} ${c.title}.` };
    CFG.perks.push(c.id); saveSettings();
    return { ok: true, msg: `Unlocked ${c.icon} ${c.title}! ${c.text}` };
  },
  list() {
    const all = Object.values(CODES).concat([REF_BONUS]);
    return all.filter((c) => this.has(c.id));
  },
  // UI on the title screen
  init() {
    this.load();
    const go = () => { const r = this.redeem($('redeemInput').value); const st = $('redeemStatus'); st.textContent = r.msg; st.classList.toggle('bad', !r.ok); if (r.ok) { $('redeemInput').value = ''; SFX.chime(); } else SFX.buzz && SFX.buzz(); this.render(); };
    $('btnRedeem').addEventListener('click', go);
    $('redeemInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    $('btnCopyRef').addEventListener('click', () => {
      const done = () => { $('btnCopyRef').textContent = 'COPIED'; setTimeout(() => { $('btnCopyRef').textContent = 'COPY'; }, 1800); };
      try { navigator.clipboard.writeText(CFG.refCode).then(done, () => this.selectRef()); } catch (e) { this.selectRef(); }
    });
    this.render();
  },
  selectRef() { try { const r = document.createRange(); r.selectNodeContents($('myRef')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* nothing to select */ } },
  render() {
    $('myRef').textContent = CFG.refCode;
    const got = this.list();
    $('perkList').innerHTML = got.length ? got.map((c) => `<div class="perk"><span class="pi">${c.icon}</span><div><b>${esc(c.title)}</b><small>${esc(c.text)}</small></div></div>`).join('') : '<div class="perk none">No rewards yet. Try a code.</div>';
    $('refUsedNote').textContent = CFG.refUsed ? `You were invited with ${CFG.refUsed}.` : '';
    const n = got.length; $('codesSummary').textContent = n ? `${n} reward${n > 1 ? 's' : ''} unlocked` : 'bonuses & your referral code';
  },
  // Online: are you playing with someone you invited, or who invited you?
  checkSquad() {
    this.squad = false; if (!Net.on) return;
    const me = Net.me(); if (!me) return;
    this.squad = Net.others().some((p) => (me.used && me.used === p.ref) || (p.used && p.used === me.ref));
  },
};

// ---------------------------------------------------------------------
//  Firecrackers: throw one (G), it lands, fizzes, and BANGS. Joury goes to look.
// ---------------------------------------------------------------------
const Crackers = {
  n: 3, live: [], mesh: null,
  reset() { this.n = Net.amJoury() ? 0 : Perks.crackers(); this.live.forEach((c) => this.remove(c)); this.live = []; this.hud(); },
  hud() { const el = $('crackers'); if (!el) return; el.style.display = Net.amJoury() ? 'none' : ''; el.innerHTML = `🧨 <b>${this.n}</b> <span>G to throw</span>`; el.classList.toggle('empty', this.n <= 0); },
  throw() {
    if (Game.state !== 'play' || Net.amJoury()) return;
    if (this.n <= 0) { HUD.toast('No firecrackers left.', 2); return; }
    this.n--; this.hud();
    const P = Player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    let dist = 16 + Math.max(0, P.pitch) * 8, tx = P.pos.x + fx * dist, tz = P.pos.z + fz * dist;
    for (let k = 0; k < 8 && !World.walkable(tx, tz); k++) { dist *= 0.75; tx = P.pos.x + fx * dist; tz = P.pos.z + fz * dist; }
    const from = new THREE.Vector3(P.pos.x + fx * 0.5, P.y + P.eye - 0.2, P.pos.z + fz * 0.5), to = new THREE.Vector3(tx, World.surfaceY(tx, tz) + 0.05, tz);
    this.spawn(from, to, true); SFX.burst(SFX.now, 0.15, 0.05, 'highpass', 3000, 0.7);
    HUD.toast('Firecracker thrown. It will go off in a moment and draw Joury to it.', 2.5);
  },
  spawn(from, to, mine) {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), plainMat(0xb31818, 0.6)); stick.rotation.z = Math.PI / 2; g.add(stick);
    const gi = World.glow.add(from.x, from.y, from.z, 0xffb040, 0.18, 0.6);
    g.position.copy(from); World.scene.add(g);
    const c = { g, gi, from, to, t: 0, fly: 0.9, fuse: 1.6, mine, banged: false }; this.live.push(c); return c;
  },
  remove(c) { World.scene.remove(c.g); if (c.gi >= 0) World.glow.setSize(c.gi, 0); },
  update(dt) {
    this.live = this.live.filter((c) => {
      c.t += dt;
      if (c.t < c.fly) { const k = c.t / c.fly; c.g.position.lerpVectors(c.from, c.to, k); c.g.position.y += Math.sin(k * Math.PI) * 3.2; c.g.rotation.x += dt * 12; }
      else c.g.position.copy(c.to);
      const p = c.g.position;
      if (c.gi >= 0) { World.glow.set(c.gi, p.x, p.y + 0.1, p.z); World.glow.setSize(c.gi, 0.12 + Math.random() * 0.12); }
      if (!c.banged && c.t > c.fly + c.fuse) {
        c.banged = true; this.bang(p.x, p.z);
        if (c.mine) { if (Net.on) Net.act('decoy', { x: r2(p.x), z: r2(p.z) }); else Joury.hearAt(p.x, p.z, 70); }
        this.remove(c); return false;
      }
      return true;
    });
  },
  // the flash and the noise: everyone nearby sees and hears it
  bangs: 0,
  bang(x, z) {
    this.bangs++;
    const d = Math.hypot(Player.pos.x - x, Player.pos.z - z), v = clamp(1 - d / 90, 0.08, 1);
    if (SFX.ctx) { const t = SFX.now; SFX.burst(t, 0.18, 0.5 * v, 'lowpass', 2600, 0.6, null, 1, 0.002); SFX.burst(t + 0.02, 1.4, 0.35 * v, 'lowpass', 220, 0.8, null, 0.6, 0.01); SFX.burst(t + 0.15, 0.5, 0.12 * v, 'highpass', 3500, 0.5); }
    const y = World.surfaceY(x, z);
    for (let i = 0; i < 14; i++) World.sparkle(new THREE.Vector3(x, y, z), i);
    if (d < 40) GFX.fx.flash = Math.max(GFX.fx.flash, 0.12 * (1 - d / 40));
  },
};

// ---------------------------------------------------------------------
//  VIP JOURY — the KEYBOARD code: in an online game, one player IS Joury
// ---------------------------------------------------------------------
const Vip = {
  blinkT: 0, lastState: null, tag: null,
  reset() { this.blinkT = 12; this.lastState = null; },
  // the Joury player's own screen
  update(dt) {
    if (!Net.amJoury()) return;
    this.blinkT = Math.max(0, this.blinkT - dt);
    const s = Joury.state;
    // he is dragged back to his cabin after a catch, and after someone escapes it
    if (s !== this.lastState) {
      if (s === 'stunned' || s === 'away' || (s === 'dormant' && this.lastState === null)) { const dr = World.cabin.door; Player.place(dr.x, dr.z + 1.2, Math.PI, 0); }
      if (s === 'hunt' && this.lastState && this.lastState !== 'hunt') HUD.toast('<b style="color:#ff5a4a">Hunt.</b> Get close to touch them, or make them stare at you.', 3);
      if (s === 'stunned') HUD.toast('Someone escaped your cabin. You are stunned for 20 seconds.', 4);
      if (s === 'away') HUD.toast('Caught one. Dragging them home… You are back in a few seconds.', 3);
      this.lastState = s;
    }
    Player.frozen = s !== 'hunt' || !!Game.menuOpen;
    const fx = GFX.fx; fx.red = 0.22; fx.exposure = 3.4; fx.auto = 0; fx.static = 0.04; fx.vignette = 1.35; fx.aberr = 1.2;
    HUD.objective(s === 'dormant' ? (Net.isHost ? `You wake up in ${Math.max(1, Math.ceil(Joury.timer))} seconds…` : 'You wake up soon… they have a head start.') : `👑 VIP JOURY · catch them before they escape · Q blink ${this.blinkT > 0 ? '(' + Math.ceil(this.blinkT) + 's)' : 'ready'}`);
  },
  // Q: vanish and reappear behind whoever you are closest to
  blink() {
    if (!Net.amJoury() || Joury.state !== 'hunt' || Game.state !== 'play') return;
    if (this.blinkT > 0) { HUD.toast(`Blink is ready in ${Math.ceil(this.blinkT)} seconds.`, 1.6); return; }
    const prey = Net.others().filter((p) => p.where === 'i' && p.role !== 'joury'); if (!prey.length) { HUD.toast('Nobody is out on the island right now.', 2); return; }
    prey.sort((a, b) => Math.hypot(a.x - Player.pos.x, a.z - Player.pos.z) - Math.hypot(b.x - Player.pos.x, b.z - Player.pos.z));
    const T = prey[0];
    for (let i = 0; i < 24; i++) {
      const a = T.yaw + Math.PI + rand(-0.9, 0.9), dist = rand(9, 14), x = T.x - Math.sin(a) * dist, z = T.z - Math.cos(a) * dist;
      if (!World.walkable(x, z) || World.onDock(x, z) || World.onBridge(x, z)) continue;
      const q = { x, z }; World.resolve(q, 0.5); if (Math.hypot(q.x - x, q.z - z) > 0.2) continue;
      Player.place(x, z, Math.atan2(-(T.x - x), -(T.z - z)), 0); this.blinkT = 35; SFX.whoosh(0); GFX.fx.static = 0.6;
      Net.act('blink', { id: T.id }); return;
    }
    HUD.toast("Couldn't find a spot behind them. Try again in a moment.", 2);
  },
  // everyone else: a gold title floating over him
  updateTag() {
    const jp = Net.on ? Net.jouryPlayer() : null, show = !!jp && !jp.local && Joury.c.root.visible && Game.state === 'play';
    if (!show) { if (this.tag) this.tag.visible = false; return; }
    if (!this.tag || this.tag.userData.name !== jp.name) {
      if (this.tag) { World.scene.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose(); }
      const cv = makeCanvas(512, 96), g = cv.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(56, 14, 400, 68);
      g.strokeStyle = '#e8c46a'; g.lineWidth = 3; g.strokeRect(56, 14, 400, 68);
      g.font = '600 26px Inter, system-ui, sans-serif'; g.fillStyle = '#ffd86a'; g.fillText('👑 VIP · JOURY', 256, 38);
      g.font = '22px Inter, system-ui, sans-serif'; g.fillStyle = '#f2e6cc'; g.fillText(jp.name, 256, 66);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })); this.tag.scale.set(1.9, 0.36, 1); this.tag.renderOrder = 9; this.tag.userData.name = jp.name; World.scene.add(this.tag);
    }
    this.tag.visible = true; this.tag.position.set(Joury.pos.x, Joury.pos.y + 2.75, Joury.pos.z);
  },
};
