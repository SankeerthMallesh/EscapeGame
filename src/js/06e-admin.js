// =====================================================================
//  ADMIN PANEL — unlocked with the code ADMIN, opened with F8 in a game.
//  Solo: everything. Online: your own player for everyone; the island and
//  Joury only for the host (the host's game is the one that runs them).
// =====================================================================
const Admin = {
  open: false, god: false, speed: 1, stamina: false, battery: false, ghost: false, tickT: 0,
  unlocked() { return Perks.has('admin'); },
  canWorld() { return !Net.on || Net.isHost; },
  toggle() {
    if (!this.unlocked()) return;
    if (Game.state !== 'play' && Game.state !== 'cabin' && Game.state !== 'house') return;
    this.open ? this.close() : this.show();
  },
  show() {
    this.open = true; this.build(); $('admin').classList.add('on');
    Game.expectUnlock = !!document.pointerLockElement; Input.exitLock(); Input.keys.clear(); SFX.uiClick();
  },
  close() { if (!this.open) return; this.open = false; $('admin').classList.remove('on'); Input.requestLock(); },
  say(msg, bad) { const el = $('adminMsg'); el.textContent = msg; el.classList.toggle('bad', !!bad); clearTimeout(this.msgT); this.msgT = setTimeout(() => { el.textContent = ''; }, 3500); },
  onIsland(fn) { return () => { if (Game.state !== 'play') { this.say(Game.state === 'house' ? "That's for the island story. Use the Joury's House buttons." : 'Do that on the island (you are in the cabin right now).', true); return; } fn(); }; },
  inHouse(fn) { return () => { if (Game.state !== 'house') { this.say("That's for Joury's House (story 2).", true); return; } fn(); }; },
  hostOnly(fn) { return () => { if (!this.canWorld()) { this.say('Online, only the host can change the island and Joury.', true); return; } fn(); }; },

  // ---------------- actions ----------------
  placeNear(x, z, face) {
    for (let k = 0; k < 24; k++) {
      const a = k * 0.9, r = 2 + (k % 4) * 1.5, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, q = { x: px, z: pz }; World.resolve(q, 0.36);
      if (World.walkable(px, pz) && Math.hypot(q.x - px, q.z - pz) < 0.01) { Player.place(px, pz, face === undefined ? Math.atan2(-(x - px), -(z - pz)) : face, 0); return true; }
    }
    Player.place(x, z + 2, 0, 0); return false;
  },
  places() {
    const L = World.landmarks.map((l) => ({ name: l.name, go: () => this.placeNear(l.x, l.z) }));
    return [
      { name: 'Dock & boat', go: () => EFJ.toDock() },
      { name: "Joury's cabin door", go: () => { const d = World.cabin.door; Player.place(d.x, d.z + 1.4, Math.PI, 0); } },
    ].concat(L);
  },
  freeOne() { const i = World.kids.findIndex((k) => !k.saved); if (i < 0) { this.say('All 10 kids are already free.'); return; } this.rescue(i); this.say(`Freed the ${World.kids[i].c.def.name} kid.`); },
  rescue(i) {
    if (Net.on) { Net.act('rescue', { i }); return; }
    Game.applyRescue(i, null, true, true); if (Game.savedCount() === 10) Game.startBoatPhase();
  },
  freeAll() { World.kids.forEach((k, i) => { if (!k.saved) this.rescue(i); }); HUD.drawKidIcons(World.kids.filter((k) => k.saved).map((k) => k.idx)); this.say('All 10 kids are free. The boat phase starts.'); },
  boatPhase() { if (Game.phase === 'boat') { this.say('The boat phase has already started.'); return; } if (Net.on) Net.emit({ e: 'boat' }); else Game.startBoatPhase(); this.say('Boat phase started: the 4 parts are on the map.'); },
  allParts() {
    if (Game.phase !== 'boat') this.boatPhase();
    const ids = PARTS.map((p) => p.id).filter((id) => !World.partsDelivered.has(id)); if (!ids.length) { this.say('The boat already has every part.'); return; }
    World.parts.forEach((p) => { if (!p.taken) { p.taken = true; p.g.visible = false; p.beam.visible = false; } });
    if (Net.on) Net.emit({ e: 'deliv', ids, by: Net.id }); else Game.applyDeliver(ids, null);
    this.say('All 4 parts are on the boat. Go to the dock and press E, or use Launch.');
  },
  launch() {
    if (World.partsDelivered.size < PARTS.length) this.allParts();
    this.close();
    if (Net.on) Net.act('launch'); else Game.launch();
  },
  jouryTo(mode) {
    if (mode === 'sleep') { EFJ.holdJoury(1e9); this.say('Joury is asleep until you wake him.'); }
    else if (mode === 'wake') { if (Joury.state === 'hunt') { this.say('He is already hunting.'); return; } Joury.state = 'dormant'; Joury.timer = 0; this.say('Joury is awake.'); }
    else if (mode === 'stun') { Joury.stun(20); this.say('Joury is stunned for 20 seconds.'); }
    else if (mode === 'far') { if (Joury.state !== 'hunt') { this.say('Wake him first.', true); return; } Joury.focus = null; Joury.teleport('far'); this.say('Sent Joury far away.'); }
    else if (mode === 'here') { if (Joury.state !== 'hunt') { this.say('Wake him first.', true); return; } const x = Player.pos.x - Math.sin(Player.yaw) * 8, z = Player.pos.z - Math.cos(Player.yaw) * 8; Joury.pos.set(x, World.groundAt(x, z), z); Joury.tpT = 30; this.say('Joury is 8 meters in front of you. Good luck.'); }
    else if (mode === 'rage') { Joury.enrage(); this.say('Joury is FURIOUS.'); }
  },

  // ---------------- every frame ----------------
  update(dt) {
    if (Game.state === 'play' || Game.state === 'cabin' || Game.state === 'house') {
      if (this.stamina) { Player.stamina = 1; Player.exhausted = false; }
      if (this.battery) Player.battery = 1;
    }
    if (!this.open) return;
    this.tickT -= dt; if (this.tickT > 0) return; this.tickT = 0.25;
    const P = Player.pos;
    if (Game.state === 'house') {
      const h = House, st = h.s, rows = [
        ['Where', `${P.x.toFixed(1)}, ${P.z.toFixed(1)} · ${h.roomOf(P.x, P.z)}`], ['FPS', Math.round(Game.fps || 0)],
        ['Joury', `${h.j.state} · ${Math.hypot(P.x - h.j.x, P.z - h.j.z).toFixed(0)} m away`],
        ['Items', [st.crowbar && 'crowbar', st.key && 'key'].filter(Boolean).join(', ') || 'none'],
        ['Gabe', st.gabeFree ? 'following you' : st.unlocked ? 'door unlocked' : 'locked in'], ['Times caught', Game.stats.caught],
      ];
      $('adminInfo').innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${esc(String(v))}</b>`).join(''); this.syncToggles(); return;
    }
    const J = Joury, rows = [
      ['Where', Game.state === 'cabin' ? 'in the cabin' : `${P.x.toFixed(1)}, ${P.z.toFixed(1)}`],
      ['FPS', Math.round(Game.fps || 0)],
      ['Joury', `${J.state}${J.state === 'hunt' ? ` · ${J.dist.toFixed(0)} m away` : J.state === 'stunned' ? ` · ${Math.ceil(J.stunT)} s` : ''}`],
      ['Kids', `${Game.savedCount()} / 10`],
      ['Boat parts', `${World.partsDelivered.size} / 4 on the boat`],
      ['Cabin code', Game.state === 'cabin' ? Cabin.digits.join(' ') : '—'],
      ['Online', Net.on ? `${Net.isHost ? 'host' : 'joined'} · ${Net.players.size} player${Net.players.size > 1 ? 's' : ''}` : 'solo'],
    ];
    $('adminInfo').innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${esc(String(v))}</b>`).join('');
    this.syncToggles();
  },
  syncToggles() {
    const t = (id, on) => { const el = $(id); if (el) { el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); } };
    t('admGod', this.god); t('admStam', this.stamina); t('admBat', this.battery);
    [1, 2, 3].forEach((s) => t('admSpd' + s, this.speed === s));
  },

  // ---------------- the panel ----------------
  build() {
    if (this.built) { this.syncToggles(); this.lockWorld(); return; } this.built = true;
    const sec = (title, note) => { const s = document.createElement('section'); s.className = 'adm-sec'; s.innerHTML = `<h3>${title}</h3>${note ? `<p>${note}</p>` : ''}<div class="adm-btns"></div>`; $('adminBody').appendChild(s); return s.querySelector('.adm-btns'); };
    const btn = (box, label, fn, opts = {}) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'adm-btn' + (opts.cls ? ' ' + opts.cls : ''); if (opts.id) b.id = opts.id; if (opts.world) b.dataset.world = '1'; b.textContent = label; b.addEventListener('click', () => { SFX.uiClick(); fn(); this.syncToggles(); }); box.appendChild(b); return b; };
    const me = sec('You');
    btn(me, 'God mode', () => { this.god = !this.god; this.say(this.god ? 'God mode on: Joury cannot catch you.' : 'God mode off.'); }, { id: 'admGod', cls: 'tog' });
    btn(me, 'Infinite stamina', () => { this.stamina = !this.stamina; this.say(this.stamina ? 'Sprint forever.' : 'Stamina back to normal.'); }, { id: 'admStam', cls: 'tog' });
    btn(me, 'Infinite battery', () => { this.battery = !this.battery; this.say(this.battery ? 'Your flashlight never runs out.' : 'Battery back to normal.'); }, { id: 'admBat', cls: 'tog' });
    btn(me, 'Speed ×1', () => { this.speed = 1; }, { id: 'admSpd1', cls: 'tog' });
    btn(me, 'Speed ×2', () => { this.speed = 2; this.say('Twice as fast.'); }, { id: 'admSpd2', cls: 'tog' });
    btn(me, 'Speed ×3', () => { this.speed = 3; this.say('Three times as fast.'); }, { id: 'admSpd3', cls: 'tog' });
    btn(me, '+5 firecrackers', () => { Crackers.n += 5; Crackers.hud(); this.say(`You have ${Crackers.n} firecrackers.`); });
    btn(me, 'Refill battery', () => { Player.battery = 1; Player.lightOn = true; this.say('Battery full.'); });
    const tp = sec('Teleport', 'Takes you straight there.');
    this.places().forEach((pl) => btn(tp, pl.name, this.onIsland(() => { pl.go(); this.say(`Teleported: ${pl.name}.`); })));
    btn(tp, 'Next kid', this.onIsland(() => { const i = World.kids.findIndex((k) => !k.saved); if (i < 0) { this.say('Every kid is free.'); return; } EFJ.nearKid(i); this.say(`Next to the ${World.kids[i].c.def.name} kid.`); }));
    btn(tp, 'Next boat part', this.onIsland(() => { const i = World.parts.findIndex((p) => !p.taken); if (i < 0) { this.say(Game.phase === 'boat' ? 'No parts left to pick up.' : 'The boat parts appear after all 10 kids are free.', true); return; } EFJ.nearPart(i); this.say(`Next to the ${World.parts[i].def.name}.`); }));
    const J = sec('Joury', 'Online, only the host controls him.');
    btn(J, 'Freeze (sleep)', this.hostOnly(() => this.jouryTo('sleep')), { world: 1 });
    btn(J, 'Wake up', this.hostOnly(() => this.jouryTo('wake')), { world: 1 });
    btn(J, 'Stun 20 s', this.hostOnly(() => this.jouryTo('stun')), { world: 1 });
    btn(J, 'Send far away', this.hostOnly(() => this.jouryTo('far')), { world: 1 });
    btn(J, 'Put him in front of me', this.hostOnly(this.onIsland(() => this.jouryTo('here'))), { world: 1 });
    btn(J, 'Make him furious', this.hostOnly(() => this.jouryTo('rage')), { world: 1 });
    const W = sec('Island', 'Online, only the host can change these.');
    btn(W, 'Free 1 kid', this.hostOnly(() => this.freeOne()), { world: 1 });
    btn(W, 'Free all kids', this.hostOnly(() => this.freeAll()), { world: 1 });
    btn(W, 'Start boat phase', this.hostOnly(() => this.boatPhase()), { world: 1 });
    btn(W, 'Put all parts on the boat', this.hostOnly(() => this.allParts()), { world: 1 });
    btn(W, 'Launch the boat (win)', this.hostOnly(() => this.launch()), { world: 1, cls: 'win' });
    btn(W, 'Lightning', this.onIsland(() => { Weather.strike(false); this.say('Crack.'); }));
    const H = sec("Joury's House", 'Story 2 only.');
    const hp = (x, z, yaw) => () => { Player.place(x, z, yaw, 0); };
    [['Sidewalk', 0, 22.4, 0], ['Shed', 9.5, -14.8, Math.PI], ['Back door', 0, -8.6, 0], ['Hallway', 0, 2, 0], ["Joury's room (key)", 9.25, 5.75, Math.PI / 2], ["Gabe's room", 5.6, -5.3, -Math.PI / 2]].forEach(([n, x, z, y]) => btn(H, n, this.inHouse(() => { hp(x, z, y)(); this.say(`Teleported: ${n}.`); })));
    btn(H, 'Joury: stay at his PC', this.inHouse(() => { Object.assign(House.j, { state: 'sit', x: 8.2, z: 3.1, sitT: 1e9, path: [] }); this.say('Joury will not leave his PC.'); }));
    btn(H, 'Joury: go patrol', this.inHouse(() => { House.standUp(); House.patrolRoute(); House.j.sitT = 30; this.say('Joury is walking around the house.'); }));
    btn(H, 'Get crowbar + key', this.inHouse(() => { House.s.crowbar = House.s.key = true; House.crowbar.visible = false; House.keyMesh.visible = false; House.glints.setSize(House.keyGlint, 0); this.say('You have the crowbar and the key.'); }));
    btn(H, 'Open every door', this.inHouse(() => { const s = House.s; s.boardsOff = s.unlocked = s.frontOpen = s.shedOpen = true; House.boards.visible = false; House.padlock.visible = false; Object.values(House.doors).forEach((d) => { d.open = true; }); this.say('Every door is open.'); }));
    btn(H, 'Free Gabe', this.inHouse(() => { const s = House.s; if (s.gabeFree) { this.say('Gabe is already with you.'); return; } s.unlocked = true; House.doors.bedroom.open = true; House.padlock.visible = false; s.gabeFree = true; Object.assign(House.gabeS, { follow: true, x: Player.pos.x, z: Player.pos.z + 1, trail: [{ x: Player.pos.x, z: Player.pos.z }], stuckT: 0 }); this.say('Gabe is free and following you.'); }));
    btn(H, 'Escape with Gabe (win)', this.inHouse(() => { this.close(); House.s.gabeFree = true; House.gabeS.follow = true; Game.houseWin(); }), { cls: 'win' });
    const C = sec('Cabin', 'Only works while you are locked in the cabin.');
    const inCabin = (fn) => () => { if (Game.state !== 'cabin') { this.say("You aren't in the cabin.", true); return; } fn(); };
    btn(C, 'Show the code', inCabin(() => this.say(`The door code is ${Cabin.digits.join(' ')}.`)));
    btn(C, 'Find all 4 digits', inCabin(() => { Cabin.found = [true, true, true, true]; this.say(`Found them all: ${Cabin.digits.join(' ')}.`); }));
    btn(C, '+60 seconds', inCabin(() => { Cabin.timer = Math.min(Cabin.timer + 60, 999); this.say(`${Math.ceil(Cabin.timer)} seconds on the clock.`); }));
    btn(C, 'Escape now', inCabin(() => { this.close(); Game.escapeCabin(); }));
    this.syncToggles(); this.lockWorld();
  },
  lockWorld() { const off = !this.canWorld(); document.querySelectorAll('#admin [data-world]').forEach((b) => { b.disabled = off; b.title = off ? 'Only the host can do this in an online game' : ''; }); },
};
