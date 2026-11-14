// =====================================================================
//  GAME — state machine, menus, ending, main loop
// =====================================================================
const Game = {
  state: 'loading', phase: 'kids', mode: 'island', prev: null, t: 0, stats: { time: 0, caught: 0 }, attempt: 0, caughtT: 0, target: null, mapOpen: false,
  ambT: 10, owlT: 25, expectUnlock: false, endT: 0, ending: null, saved: [],
  savedCount() { return World.kids.filter((k) => k.saved).length; },

  // ---------------- boot ----------------
  boot() {
    this.bootT = { start: performance.now() }; const mark = (k) => { this.bootT[k] = Math.round(performance.now() - this.bootT.start); };
    const step = (pct, text, fn) => new Promise((res) => { $('loadFill').style.width = pct + '%'; $('loadText').textContent = text; setTimeout(() => { fn(); mark(text); res(); }, 30); });
    if (!GFX.init()) { this.fatal('Your browser could not start WebGL (3D graphics). Try a recent Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is on.'); return; }
    const fontsReady = (document.fonts && document.fonts.load) ? Promise.race([Promise.all(['16px Inter', '600 16px Inter', '40px "IM Fell English SC"', '20px "Special Elite"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))]).catch(() => {}) : Promise.resolve();
    fontsReady
      .then(async () => { let k = 0; const tips = ['Weathering the planks…', 'Growing bark…', 'Scattering dead leaves…', 'Staining the wallpaper…', 'Rusting the water tower…', 'Knitting a hoodie…']; await buildPBR(() => new Promise((res) => { k++; $('loadFill').style.width = (2 + k * 1.3) + '%'; $('loadText').textContent = tips[k % tips.length]; setTimeout(res, 0); })); })
      .then(() => step(20, 'Carving pumpkins…', () => { buildTextures(); buildMaterials(); Input.init($('c')); HUD.init(); Story.init(); }))
      .then(() => step(30, 'Raising the island out of the lake…', () => { World.build(() => {}); }))
      .then(() => step(70, 'Waking up Joury (quietly)…', () => {
        Joury.init(World.scene); Scare.placePages();
        this.worldFlash = makeFlashlight(World.cam, 0xfff1d6, Q().spotShadow, true);
        Cabin.build();
        HUD.buildMapImage();
        World.reset(); Joury.reset();
        Player.attach(World.cam, World, this.worldFlash); Player.place(0, World.dock.start.z, 0);
        VM.build();
      }))
      .then(() => step(74, "Building Joury's house…", () => { House.build(); House.reset(); }))
      .then(() => step(76, 'Compiling shaders…', () => { ['bridge', 'room', 'street', 'lake'].forEach((n) => Story.scene(n)); this.ending = this.buildEnding(); }))
      .then(async () => {
        const r = GFX.renderer, jobs = [[World.scene, World.cam], [Cabin.scene, Cabin.cam], [House.scene, House.cam], [VM.scene, VM.cam]].concat(['bridge', 'room', 'street', 'lake'].map((n) => [Story.scene(n).scene, Story.cam]), [[this.ending.scene, this.ending.cam]]);
        for (let i = 0; i < jobs.length; i++) {
          try { if (r.compileAsync && r.extensions.has('KHR_parallel_shader_compile')) await r.compileAsync(jobs[i][0], jobs[i][1]); else r.compile(jobs[i][0], jobs[i][1]); } catch (e) { console.warn('precompile skipped', e); }
          $('loadFill').style.width = (76 + (i + 1) / jobs.length * 22) + '%';
        }
      })
      .then(() => step(100, 'Ready.', () => { this.wireMenus(); this.toTitle(); requestAnimationFrame((t) => this.loop(t)); }))
      .catch((e) => { console.error(e); this.fatal('Something went wrong while loading: ' + (e && e.message)); });
  },
  fatal(msg) { $('loading').classList.remove('on'); $('fatalText').textContent = msg; $('fatal').classList.add('on'); },
  screen(id, on) { $(id).classList.toggle('on', on); },
  wireMenus() {
    const seg = (id, key, after) => { const el = $(id); const sync = () => [...el.children].forEach((b) => b.classList.toggle('on', b.dataset.v === CFG[key])); el.addEventListener('click', (e) => { const v = e.target.dataset && e.target.dataset.v; if (!v) return; CFG[key] = v; saveSettings(); sync(); SFX.uiClick(); after && after(v); }); sync(); return sync; };
    this.syncDiff = seg('segDiff', 'difficulty', () => this.diffNote());
    const q1 = seg('segQual', 'quality', () => { this.applyQuality(); q2(); this.diffNote(); }), q2 = seg('segQual2', 'quality', () => { this.applyQuality(); q1(); this.diffNote(); });
    const vol = (id, other) => { const el = $(id); el.value = CFG.volume; el.addEventListener('input', () => { CFG.volume = Number(el.value); $(other).value = el.value; SFX.setVolume(CFG.volume); saveSettings(); }); };
    vol('optVol', 'optVol2'); vol('optVol2', 'optVol');
    const sens = (id, other) => { const el = $(id); el.value = CFG.sens; el.addEventListener('input', () => { CFG.sens = Number(el.value); $(other).value = el.value; saveSettings(); }); };
    sens('optSens', 'optSens2'); sens('optSens2', 'optSens');
    $('optName').value = CFG.name || ''; $('optName').addEventListener('change', (e) => { CFG.name = cleanName(e.target.value); e.target.value = CFG.name; saveSettings(); });
    $('optInvert').checked = CFG.invert; $('optInvert').addEventListener('change', (e) => { CFG.invert = e.target.checked; saveSettings(); });
    this.diffNote();
    const panels = { btnSettings: 'setPanel', btnHow: 'howPanel', btnCodes: 'codePanel' };
    Perks.init();
    Object.keys(panels).forEach((id) => $(id).addEventListener('click', () => {
      SFX.uiClick();
      Object.entries(panels).forEach(([b, p]) => { const open = b === id && $(p).hidden; $(p).hidden = !open; $(b).setAttribute('aria-expanded', open); });
    }));
    $('btnPlay').addEventListener('click', () => this.play());
    $('btnHouse').addEventListener('click', () => this.playHouse());
    $('btnSkip').addEventListener('click', (e) => { e.stopPropagation(); SFX.uiClick(); this.startGame(); });
    $('story').addEventListener('click', () => { if (this.state === 'story') Story.advance(); });
    $('btnResume').addEventListener('click', () => this.resume());
    $('btnQuit').addEventListener('click', () => { this.screen('pause', false); this.menuOpen = false; this.toTitle(); });
    $('btnRetry').addEventListener('click', () => { this.screen('timeout', false); this.enterCabin(false); });
    $('btnAgain').addEventListener('click', () => { this.screen('ending', false); if (this.mode === 'house' && !Net.on) { this.toTitle(); return; } if (Net.on) { this.toTitle(true); Lobby.open(); } else this.toTitle(); }); // online: back to the same room
    Lobby.init();
    $('title').addEventListener('pointerdown', () => { if (!SFX.ctx) { SFX.init(); SFX.startMusicBox(); } $('soundHint').style.visibility = 'hidden'; }); // hidden, not removed: removing it would shift the buttons mid-click
    document.addEventListener('visibilitychange', () => { if (document.hidden && (this.state === 'play' || this.state === 'cabin' || this.state === 'house')) this.pause(); });
    if (/[?&#]norender/.test(location.href)) GFX.noRender = true;
    $('adminClose').addEventListener('click', () => Admin.close()); // automated tests: run the game logic without drawing
  },
  diffNote() { $('diffNote').textContent = D().note; $('setSummary').textContent = `${D().name} · ${(Q() === QUALITY.low ? 'low' : Q() === QUALITY.high ? 'high' : 'medium')} graphics`; },
  applyQuality() {
    const q = Q();
    GFX.resize(); World.lights.setCount(q.pointLights); World.applyMoonShadow(); setShadowSize(this.worldFlash, q.spotShadow); setShadowSize(Cabin.flash, Math.min(1024, q.spotShadow));
    World.applyGrassDensity(); World.applyFireflies(); Cabin.bulb.castShadow = q.fireShadow;
  },

  // ---------------- title ----------------
  toTitle(keepRoom) {
    if (!keepRoom) Net.leave();
    Admin.close(); Phonk.setVol(0); this.houseEndShown = false; if ($('hideOverlay')) $('hideOverlay').classList.remove('on'); this.state = 'title'; Input.exitLock(); this.menuOpen = false; Chat.stopTyping(); Lobby.isOpen = false; document.body.classList.remove('mp');
    ['loading', 'hud', 'story', 'bigmap', 'inspect', 'keypad', 'pause', 'caught', 'timeout', 'ending', 'lobby'].forEach((s) => this.screen(s, false));
    $('crash').className = 'screen';
    $('story').classList.remove('bare');
    this.screen('title', true); this.syncDiff && this.syncDiff(); this.diffNote();
    $('soundHint').style.visibility = SFX.ctx ? 'hidden' : 'visible';
    World.scene.fog.density = D().fog; this.setRage(0);
    World.reset(); Joury.reset(); Player.attach(World.cam, World, this.worldFlash); Player.place(0, World.dock.start.z, 0); Player.lightOn = false;
    GFX.fx.fade = 1; GFX.fx.red = 0; GFX.fx.static = 0; GFX.fx.warm = 0;
    if (SFX.ctx) { SFX.resume(); SFX.allLoopsOff(); SFX.startMusicBox(); }
    this.t = 0;
  },
  play() {
    SFX.init(); SFX.stopMusic(); SFX.allLoopsOff(); SFX.uiClick();
    this.mode = 'island';
    this.screen('title', false); this.screen('story', true); $('story').classList.remove('bare');
    this.state = 'story'; Story.start();
  },
  playHouse() {
    SFX.init(); SFX.stopMusic(); SFX.allLoopsOff(); SFX.uiClick(); Net.leave();
    this.mode = 'house';
    this.screen('title', false); this.screen('story', true); $('story').classList.remove('bare');
    this.state = 'story'; Story.start(HOUSE_SLIDES);
  },
  // ---------------- story 2: Joury's house ----------------
  startHouse() {
    this.screen('story', false); $('storyBig').className = '';
    GFX.fx.red = 0; GFX.fx.shake = 0; GFX.fx.flash = 0; GFX.fx.fade = 1; this.fadeIn = 1;
    House.reset(); this.stats = { time: 0, caught: 0 }; this.menuOpen = false; this.mapOpen = false;
    Player.attach(House.cam, House, House.flash); Player.place(0, 22.4, 0, 0); Player.stamina = 1; Player.battery = 1; Player.lightOn = true; Player.exhausted = false; Player.frozen = false;
    HUD.show(true); HUD.parts(false); HUD.stun(0); HUD.cabinTimer(null); HUD.lightHint(null); $('hideOverlay').classList.remove('on');
    ['minimap', 'kidsBar', 'chat', 'roster', 'crackers', 'compass'].forEach((id) => { $(id).style.display = 'none'; }); $('objective').style.display = '';
    this.state = 'house';
    HUD.toast("<b>WASD</b> move · <b>Shift</b> sprint (loud) · <b>C</b> crouch (quiet) · <b>F</b> flashlight · <b>E</b> interact<br>Gabe is locked inside. Hear the music? That means Joury is at his PC.", 8);
    Input.requestLock();
  },
  updateHouse(dt) {
    const fx = GFX.fx;
    this.stats.time += dt; FogU.uMistAmt.value = 0;
    if ($('inspect').classList.contains('on') || this.menuOpen) Player.frozen = true; else if (!House.hidden && House.caughtT < 0) Player.frozen = false;
    Player.update(dt); Player.updateLight(dt, House.danger, 0);
    House.update(dt); if (this.state !== 'house') return;
    if (House.hidden) { const h = House.hides[House.hidden]; House.cam.position.set(h.x + Math.sin(h.yaw) * -0.25, 1.45, h.z + Math.cos(h.yaw) * -0.25); }
    const it = House.caughtT < 0 && !$('inspect').classList.contains('on') ? House.aimed() : null, lab = it ? House.label(it.id) : null;
    HUD.prompt(lab);
    HUD.objective(House.objective());
    const inv = House.inventory(), el = $('partsBar'); el.style.display = inv.length ? 'flex' : 'none'; const ih = inv.map((t) => `<div class="carry">${t}</div>`).join(''); if (el.innerHTML !== ih) el.innerHTML = ih;
    HUD.bars(Player.stamina, Player.battery, Player.exhausted, false);
    if (House.caughtT < 0) {
      const d = House.danger;
      fx.static = damp(fx.static, House.j.state === 'chase' ? 0.12 + d * 0.25 : 0.02, 4, dt); fx.red = damp(fx.red, House.j.state === 'chase' ? 0.12 : 0, 3, dt);
      fx.exposure = 1.45; fx.auto = 1; fx.key = 0.05; fx.vignette = 1.05 + d * 0.3; fx.grain = 0.07; fx.aberr = 0.5 + d; fx.warm = 0.08; fx.shake = House.j.state === 'chase' ? d * 0.25 : 0;
      if (this.fadeIn > 0) { this.fadeIn -= dt * 0.8; fx.fade = Math.max(0, this.fadeIn); } else fx.fade = 0;
    }
    if (SFX.ctx) { SFX.setLoop('wind', 0.06); SFX.setLoop('rain', 0); SFX.setLoop('water', 0); SFX.setLoop('drone', 0.03 + House.danger * 0.25); SFX.setLoop('static', fx.static * 0.15); SFX.update(dt, House.danger); }
    VM.update(dt, !House.hidden && House.caughtT < 0 && !$('inspect').classList.contains('on'), Player.lightOn ? 'on' : 'off', House.flash.intensity / Math.max(0.01, House.flash.userData.base * (1 + 0.7 * Player.aimK)));
    GFX.render(House.scene, House.cam, dt);
  },
  houseWin() {
    this.state = 'hend'; this.endT = 0; Input.exitLock(); HUD.show(false); HUD.prompt(null); Phonk.setVol(0); SFX.chime(); SFX.cheer();
    GFX.fx.fade = 0;
  },
  updateHouseEnd(dt) {
    this.endT += dt; const t = this.endT, cam = House.cam, k = smoothstep(0, 7, t), g = House.gabe, J = House.J;
    House.doors.front.open = true; House.doors.front.pivot.rotation.y = 1.45;
    // the camera waits down the street; Gabe walks out of the gate towards it
    cam.position.set(lerp(4.5, 5.5, k), 1.55, lerp(29.5, 31, k)); cam.lookAt(lerp(1.5, 0.5, k), 1.5, lerp(14, 9, k));
    const gk = smoothstep(0, 6, t), gx = lerp(0, 3.2, gk), gz = lerp(20.2, 26.5, gk);
    g.root.position.set(gx, 0, gz); g.root.rotation.y = Math.atan2(3.2, 6.3); animateKid(g, t, gk < 1 ? 'walk' : 'wave');
    // and Joury is standing in his open front door, under the porch light, watching
    J.root.visible = t > 2.5; J.root.position.set(0, 0.25, 7.7); J.root.rotation.y = 0; J.root.scale.setScalar(1.1); animateJoury(J, t, false, 0, null);
    GFX.fx.fade = t > 6 ? Math.min(0.55, (t - 6) * 0.3) : 0; GFX.fx.static = t > 2.5 && t < 2.8 ? 0.5 : 0.02; GFX.fx.red = 0; GFX.fx.exposure = 2.3; GFX.fx.auto = 0;
    Phonk.setVol(t > 4 ? 0.12 : 0); Phonk.tick(); // faintly, from inside, the music starts again
    if (t > 7 && !this.houseEndShown) this.showHouseEpilogue();
    if (SFX.ctx) SFX.update(dt, 0);
    GFX.render(House.scene, cam, dt);
  },
  showHouseEpilogue() {
    this.houseEndShown = true;
    const lines = [
      'Gabe made it home. His mom made him promise to never ride past that house again.',
      'Vivek said sorry. It lasted about four minutes.',
      'Then he turned the phonk back on.',
      '<span class="big">TIKI. TIKI.</span>',
      'Next door, a bedroom light flicked on.',
      '<span class="srv">[SERVER] Joury is online.</span>',
    ];
    $('endLines').innerHTML = lines.map((l) => `<span class="line">${l}</span>`).join('');
    $('endStats').innerHTML = `<span>Time</span><span>${fmtTime(this.stats.time)}</span><span>Times caught</span><span>${this.stats.caught}</span><span>Story</span><span>Joury's House</span>`;
    $('endStats').classList.remove('on'); $('btnAgain').classList.remove('on'); $('endBoard').classList.remove('on'); $('endBoard').innerHTML = ''; $('btnAgain').textContent = 'PLAY AGAIN';
    this.screen('ending', true);
    const els = [...$('endLines').children];
    els.forEach((el, i) => setTimeout(() => { el.classList.add('on'); if (el.querySelector('.srv')) SFX.chatPing('server'); }, 400 + i * 1300 + (i === els.length - 1 ? 1600 : 0)));
    setTimeout(() => { $('endStats').classList.add('on'); }, 2400 + els.length * 1300);
    setTimeout(() => { $('btnAgain').classList.add('on'); }, 2900 + els.length * 1300);
  },

  // ---------------- online ----------------
  // The host pressed Start (or we joined a game that is already running).
  startMp(m) {
    if (!Net.on) return;
    Net.seed = m.seed | 0; Net.started = true; Net.board = null;
    if (m.players) Net.syncRoster(m.players);
    if (DIFFS[m.diff] && m.diff !== CFG.difficulty) { Net.prevDiff = Net.prevDiff || CFG.difficulty; CFG.difficulty = m.diff; } // everyone plays on the host's difficulty
    ['title', 'lobby', 'ending', 'pause', 'timeout', 'caught', 'inspect', 'keypad', 'bigmap'].forEach((s) => this.screen(s, false)); $('crash').className = 'screen';
    Lobby.isOpen = false; this.menuOpen = false; this.state = 'title';
    SFX.init(); SFX.stopMusic(); SFX.allLoopsOff();
    this.startGame();
  },
  netLost(text) {
    Input.exitLock(); $('netlostText').textContent = text + ' Your game has ended.';
    ['pause', 'inspect', 'keypad', 'bigmap', 'lobby'].forEach((s) => this.screen(s, false)); this.menuOpen = false;
    if (this.state === 'title') { this.toTitle(); Lobby.status(text, true); return; }
    this.state = 'title'; this.screen('netlost', true); if (SFX.ctx) SFX.allLoopsOff(0.3);
  },
  onFieldEnter(el) { if (el.id === 'mpName') { Lobby.rename(); el.blur(); } else if (el.id === 'optName') el.blur(); },

  // ---------------- main game ----------------
  startGame() {
    if (this.state === 'play' || this.state === 'house') return;
    if (this.mode === 'house') { this.startHouse(); return; }
    $('chat').style.display = '';
    this.screen('story', false); $('storyBig').className = '';
    GFX.fx.red = 0; GFX.fx.shake = 0; GFX.fx.flash = 0; GFX.fx.fade = 1;
    World.scene.fog.density = D().fog; this.setRage(0);
    if (Net.on) withSeed(Net.seed, () => World.reset()); else World.reset(); // online: everyone gets the same batteries
    Joury.reset(); Joury.c.eyeGlow.setSize(0, 0.2); Joury.c.eyeGlow.setSize(1, 0.2); Scare.reset(); Weather.reset();
    this.phase = 'kids'; this.stats = { time: 0, caught: 0 }; this.attempt = 0; this.mapOpen = false; this.menuOpen = false;
    document.body.classList.toggle('mp', Net.on); HUD.roster();
    Player.attach(World.cam, World, this.worldFlash);
    Player.place(Net.on && Net.me() ? (Net.me().ci - 1.5) * 0.6 : 0, World.dock.start.z, 0); Player.stamina = 1; Player.battery = 1; Player.lightOn = true; Player.exhausted = false; Player.frozen = false;
    Crackers.reset(); Vip.reset(); Perks.checkSquad();
    if (Net.amJoury()) { const dr = World.cabin.door; Player.place(dr.x, dr.z + 1.2, Math.PI, 0); Player.lightOn = false; }
    HUD.drawKidIcons([]); HUD.show(true); HUD.parts(false); HUD.stun(0); HUD.cabinTimer(null); HUD.lightHint(null);
    $('minimap').style.display = ''; $('kidsBar').style.display = ''; $('objective').style.display = ''; $('compass').style.display = '';
    this.state = 'play';
    HUD.toast('<b>WASD</b> move · <b>Mouse</b> look · <b>Shift</b> sprint · <b>C</b> crouch · <b>F</b> flashlight · <b>E</b> interact · <b>M</b> map' + (Net.on ? ' · <b>T</b> chat' : '') + '<br>Free all 10 kids. Yellow dots on the map show where they are.' + (Net.on ? '<br>Split up to find them faster. Joury can only chase one of you at a time.' : ''), Net.on ? 9 : 7);
    setTimeout(() => { if (this.state === 'play') Scare.welcome(); }, 2500);
    if (Net.amJoury()) setTimeout(() => { if (this.state === 'play') HUD.toast('<b style="color:#ffd86a">👑 You are VIP Joury.</b> The others get a 20-second head start.<br>Touch them to catch them, or let them stare at you. <b>Q</b> blinks you behind the nearest one. You see in the dark.', 8); }, 600);
    else if (Perks.squad) setTimeout(() => { if (this.state === 'play') HUD.toast('🤝 ' + SQUAD_TEXT, 6); }, 9000);
    Input.requestLock();
  },
  wantsLook() { return (this.state === 'play' || this.state === 'cabin' || this.state === 'house') && !$('inspect').classList.contains('on') && !$('keypad').classList.contains('on') && !Admin.open; },
  onUnlock() {
    if (this.expectUnlock) { this.expectUnlock = false; return; }
    if (Chat.typing) { Chat.stopTyping(); HUD.lookHint(true); return; }
    if (Admin.open) return;
    if ($('inspect').classList.contains('on')) { this.closeInspect(); HUD.lookHint(true); return; }
    if ((this.state === 'play' || this.state === 'cabin' || this.state === 'house') && !$('keypad').classList.contains('on')) this.pause();
  },
  pause() {
    if (this.state !== 'play' && this.state !== 'cabin' && this.state !== 'house') return;
    if (this.state === 'house') Phonk.setVol(0);
    $('pauseTitle').textContent = Net.on ? 'MENU' : 'PAUSED'; $('pauseNote').textContent = Net.on ? 'An online game cannot pause. Joury is still out there.' : '';
    this.closeInspect(); this.screen('bigmap', false); this.mapOpen = false;
    this.screen('pause', true); this.expectUnlock = true; Input.exitLock(); if (!document.pointerLockElement) this.expectUnlock = false;
    if (Net.on) { this.menuOpen = true; Input.keys.clear(); return; } // the world keeps running behind the menu
    this.prev = this.state; this.state = 'paused';
    if (SFX.ctx) SFX.ctx.suspend();
  },
  resume() {
    if (this.menuOpen) { this.menuOpen = false; this.screen('pause', false); Input.requestLock(); return; }
    if (this.state !== 'paused') return;
    this.screen('pause', false); this.state = this.prev; if (SFX.ctx) SFX.ctx.resume(); Input.requestLock();
  },
  onKey(e) {
    const k = e.code, s = this.state;
    if (k === 'F8') { e.preventDefault(); Admin.toggle(); return; }
    if (Admin.open) { if (k === 'Escape') Admin.close(); return; }
    if (s === 'title' && (k === 'Enter') && !Lobby.isOpen && !$('netlost').classList.contains('on')) { this.play(); return; }
    if (this.menuOpen) { if (k === 'Escape') this.resume(); return; }
    if (s === 'story') { if (k === 'Space' || k === 'Enter') Story.advance(); if (k === 'Escape') this.startGame(); return; }
    if (s === 'house' && House.caughtT >= 0) return;
    if ($('keypad').classList.contains('on')) {
      if (k === 'Escape' || k === 'KeyE') { this.closeKeypad(false); return; }
      if (/^(Digit|Numpad)\d$/.test(k)) HUD.kpPress(k.slice(-1)); else if (k === 'Backspace') HUD.kpPress('⌫');
      return;
    }
    if ($('inspect').classList.contains('on')) { if (k === 'Escape' || k === 'KeyE' || k === 'Space' || k === 'Enter') this.closeInspect(); return; }
    if (k === 'Escape') { if (s === 'paused') this.resume(); else if (this.mapOpen) this.toggleMap(); else this.pause(); return; }
    if (Net.on && (s === 'play' || s === 'cabin') && (k === 'KeyT' || k === 'Enter')) { Chat.startTyping(); return; }
    if (s === 'play') {
      if (k === 'KeyF') Player.toggleLight();
      if (k === 'KeyM') this.toggleMap();
      if (k === 'KeyE') this.interact();
      if (k === 'KeyG') Crackers.throw();
      if (k === 'KeyQ') Vip.blink();
    } else if (s === 'house') {
      if (k === 'KeyF' && !House.hidden) Player.toggleLight();
      if (k === 'KeyE' && House.caughtT < 0) House.interact();
    } else if (s === 'cabin') {
      if (k === 'KeyF' && Cabin.wakeT <= 0) Cabin.cycleLight();
      if (k === 'KeyE' && Cabin.wakeT <= 0) this.cabinInteract();
    }
  },
  toggleMap() { this.mapOpen = !this.mapOpen; this.screen('bigmap', this.mapOpen); SFX.uiClick(); },
  closeInspect() { HUD.closeInspect(); },
  findTarget() {
    if (Net.amJoury()) return null;
    const cam = World.cam, fwd = Player.forward(new THREE.Vector3()); let best = null, bs = -1;
    for (const it of World.interact) {
      if (!it.enabled()) continue;
      const p = it.pos, dx = p.x - Player.pos.x, dz = p.z - Player.pos.z, d = Math.hypot(dx, dz); if (d > it.r) continue;
      const to = new THREE.Vector3(p.x - cam.position.x, (p.y || 0) + 0.8 - cam.position.y, p.z - cam.position.z).normalize();
      const dot = to.dot(fwd), score = dot - d * 0.05; if ((dot > 0.55 || d < 1.3) && score > bs) { bs = score; best = it; }
    }
    return best;
  },
  interact() {
    const it = this.target = this.findTarget(); if (!it) return;
    const online = Net.on;
    if (it.kind === 'kid') {
      const kid = it.ref, i = World.kids.indexOf(kid);
      if (online) { Net.act('rescue', { i }); return; } // the host frees the kid for everyone
      this.applyRescue(i, null, true); Scare.onRescue(kid); Joury.hear(25);
      if (this.savedCount() === 10) setTimeout(() => this.startBoatPhase(), 1500);
    } else if (it.kind === 'battery') {
      const b = it.ref; this.hideBattery(b); Joury.hear(10);
      if (online) Net.act('bat', { i: World.batteries.indexOf(b) });
      Player.battery = Math.min(1, Player.battery + 0.45); if (!Player.lightOn) { Player.lightOn = true; SFX.flashlight(true); }
      SFX.pickup(); HUD.toast('Battery! Flashlight recharged.', 2);
    } else if (it.kind === 'part') {
      const i = World.parts.indexOf(it.ref);
      if (online) { Net.act('part', { i }); return; }
      this.applyPart(i, null); Joury.hear(18);
    } else if (it.kind === 'boat') {
      const missing = PARTS.filter((p) => !World.partsDelivered.has(p.id));
      if (!missing.length) { if (online) Net.act('launch'); else this.launch(); return; }
      const carrying = PARTS.filter((p) => World.carried.has(p.id));
      if (carrying.length) { if (online) Net.act('deliver'); else this.applyDeliver(carrying.map((p) => p.id), null); }
      else HUD.toast(`The boat still needs: <b>${missing.map((p) => p.name).join(', ')}</b>. They're marked on your map.`, 3.5);
    } else if (it.kind === 'page') { Scare.readPage(it.ref);
    } else if (it.kind === 'cabindoor') {
      if (online && Net.others().some((p) => p.where === 'c')) { Net.act('knock'); return; } // a friend is locked inside: help them
      HUD.toast(Joury.state === 'dormant' ? 'Locked. Inside, a controller is clicking. Very angrily. Better not knock.' : "Locked. This is Joury's cabin. You do NOT want to end up in there.", 3);
    }
  },
  // --- things that change the island. Solo they happen right away; online they happen when the host says so. ---
  applyRescue(i, who, mine, quiet) {
    const kid = World.kids[i]; if (!kid || kid.saved) return;
    World.rescue(kid);
    const n = this.savedCount(); HUD.drawKidIcons(World.kids.filter((k) => k.saved).map((k) => k.idx)); HUD.popKid(kid.idx);
    if (quiet) return;
    SFX.chime(); if (mine) SFX.cheer();
    HUD.toast(`${mine ? 'You freed' : `<b>${esc(who ? who.name : 'Someone')}</b> freed`} the <b>${kid.c.def.name}</b> kid! They ran to the dock. <b>${n}/10</b>` + (n < 10 && n > 0 ? '<br><span style="color:#ff8a7a">Joury is getting faster…</span>' : ''), 3.5);
  },
  hideBattery(b) { b.taken = true; b.g.visible = false; World.glow.setSize(b.gi, 0); },
  applyPart(i, by, quiet) {
    const p = World.parts[i]; if (!p || p.taken) return;
    p.taken = true; p.by = by || null; p.g.visible = false; p.beam.visible = false;
    if (!Net.on || by === Net.id) { World.carried.add(p.id); SFX.pickup(); HUD.toast(`You got the <b>${p.def.name}</b>! Bring it to the dock.`, 3); }
    else if (!quiet) HUD.toast(`<b>${esc(Net.nameOf(by))}</b> found the <b>${p.def.name}</b>.`, 3);
    HUD.parts(this.state === 'play');
  },
  dropPart(i) { // its carrier left the game: it goes back to where it was found
    const p = World.parts[i]; if (!p || !p.taken) return;
    p.taken = false; p.by = null; p.g.visible = true; p.beam.visible = true; World.carried.delete(p.id); HUD.parts(this.state === 'play');
  },
  applyDeliver(ids, by, quiet) {
    const mine = !Net.on || by === Net.id;
    ids.forEach((id, i) => { World.partsDelivered.add(id); World.carried.delete(id); if (!quiet) setTimeout(() => SFX.knock(), i * 220); });
    World.updateBoat(); HUD.parts(this.state === 'play');
    if (quiet) return;
    const left = PARTS.filter((p) => !World.partsDelivered.has(p.id));
    HUD.toast(left.length ? `${mine ? 'Added to the boat!' : `<b>${esc(Net.nameOf(by))}</b> added to the boat!`} Still needed: <b>${left.map((p) => p.name).join(', ')}</b>` : `<b>The boat is ready!</b> ${mine ? 'Press <b>E</b> to launch and escape!' : 'Get to the dock and press <b>E</b> to launch!'}`, 4);
    if (!left.length) { SFX.chime(); }
  },
  startBoatPhase(quiet) {
    if (this.phase === 'boat') return;
    this.phase = 'boat';
    if (Net.on) withSeed(Net.seed + 7, () => World.spawnParts()); else World.spawnParts(); // online: the parts are in the same places for everyone
    if (!Net.isClient) Joury.enrage();
    HUD.parts(this.state === 'play'); if (quiet) return;
    SFX.sting();
    HUD.toast('All 10 kids are safe at the dock!<br><b style="color:#ff5a4a">Joury is FURIOUS.</b> Find the 4 boat parts (orange on your map) and bring them to the dock.', 7);
  },
  setRage(k) {
    if (!this.rc) { const C = (h) => new THREE.Color(h); this.rc = { fogA: C(0x0a0f17), fogB: C(0x1e0707), mistA: C(0x222b37), mistB: C(0x3c1212), hemiA: C(0x6e7a94), hemiB: C(0xa04848), skyA: C(0x0c1320), skyB: C(0x2c0a0a) }; }
    const r = this.rc;
    World.scene.fog.color.copy(r.fogA).lerp(r.fogB, k); FogU.uMistColor.value.copy(r.mistA).lerp(r.mistB, k);
    World.hemi.color.copy(r.hemiA).lerp(r.hemiB, k); World.sky.material.uniforms.uMid.value.copy(r.skyA).lerp(r.skyB, k);
  },

  // ---------------- caught → cabin ----------------
  caught() {
    if (this.state !== 'play') return;
    this.state = 'caught'; this.caughtT = 0; this.stats.caught++; this.crashShown = false; this.menuOpen = false; this.screen('pause', false); Chat.stopTyping(); Scare.onCaught(); Net.act('caught'); this.mapOpen = false; this.screen('bigmap', false); this.closeInspect(); $('toast').classList.remove('on'); HUD.toastT = 0; HUD.prompt(null);
    // put Joury right in your face
    const cam = World.cam, fwd = new THREE.Vector3(-Math.sin(Player.yaw), 0, -Math.cos(Player.yaw));
    Player.pitch = 0.05; Player.applyCam();
    const jp = cam.position.clone().addScaledVector(fwd, 1.05);
    Joury.c.root.visible = true; Joury.c.root.position.set(jp.x, cam.position.y - Joury.c.eyeY + 0.02, jp.z); Joury.c.root.rotation.y = Math.atan2(cam.position.x - jp.x, cam.position.z - jp.z); Joury.c.root.scale.setScalar(1.05);
    animateJoury(Joury.c, 0, false, 0, 'scare');
    SFX.jumpscare(); GFX.fx.fade = 0; this.fadeIn = 0; GFX.fx.auto = 0; GFX.fx.exposure = 1.7; GFX.fx.flash = 0.8; GFX.fx.static = 0.45; GFX.fx.red = 0.3; this.scareFrom = jp; this.scareCam = cam.position.clone(); this.scareFwd = fwd;
    HUD.prompt(null);
  },
  updateCaught(dt) {
    this.caughtT += dt; const t = this.caughtT;
    animateJoury(Joury.c, t, false, 0, 'scare');
    const lunge = lerp(2.0, 1.05, smoothstep(0, 0.22, t)), jp = this.scareCam.clone().addScaledVector(this.scareFwd, lunge);
    Joury.c.root.position.x = jp.x; Joury.c.root.position.z = jp.z;
    World.cam.position.copy(this.scareCam); World.cam.position.x += (Math.random() - 0.5) * 0.04; World.cam.position.y += (Math.random() - 0.5) * 0.04;
    GFX.fx.static = t < 0.9 ? 0.3 + Math.random() * 0.25 : Math.min(1, 0.4 + (t - 0.9)); GFX.fx.red = 0.3 + Math.random() * 0.1; GFX.fx.shake = 1;
    if (t > 1.3) GFX.fx.fade = clamp((t - 1.3) / 0.4, 0, 1);
    if (this.stats.caught === 1) { // the first time, the game pretends to crash… then refuses to let you quit
      if (t > 1.55 && !this.crashShown) { this.crashShown = true; GFX.fx.fade = 0; HUD.show(false); SFX.allLoopsOff(0.02); $('crash').className = 'screen on'; $('crashTitle').textContent = 'Escape from Joury is not responding'; $('crashBody').textContent = 'The program stopped working. Collecting crash data…'; $('crashFill').style.width = '0%'; SFX.beep(660); }
      if (this.crashShown) {
        $('crashFill').style.width = Math.min(100, (t - 1.55) / 2.2 * 100) + '%';
        if (t > 3.5 && !$('crash').classList.contains('evil')) { $('crash').classList.add('evil'); $('crashTitle').textContent = 'JOURY IS NOT RESPONDING'; $('crashBody').textContent = 'no.\nyou don\'t get to quit.'; SFX.voice(0, 0.7, true); SFX.sting(); }
        if (t > 4.9 && !this.crashLine2) { this.crashLine2 = true; $('crashBody').textContent += '\n\nREMATCH ACCEPTED.'; SFX.slam(0.5); }
        if (t > 6.4) { $('crash').className = 'screen'; this.crashLine2 = false; this.enterCabin(true); }
        return; // frozen frame behind the dialog
      }
    }
    if (t > 1.75 && !$('caught').classList.contains('on') && this.stats.caught > 1) {
      $('caughtText').textContent = 'CAUGHT'; $('caughtSub').textContent = this.stats.caught > 1 ? 'Back to the cabin. Again.' : 'Joury drags you back to his cabin…';
      this.screen('caught', true); HUD.show(false); SFX.allLoopsOff(0.2);
    }
    if (t > 4.2 && this.stats.caught > 1) { this.screen('caught', false); this.enterCabin(true); return; }
    GFX.render(World.scene, World.cam, dt);
  },
  enterCabin(newAttempt) {
    if (newAttempt) this.attempt++;
    Cabin.reset(this.attempt);
    this.state = 'cabin'; GFX.fx.static = 0.2; GFX.fx.red = 0; GFX.fx.fade = 1;
    HUD.show(true); $('minimap').style.display = 'none'; $('objective').style.display = 'none'; $('compass').style.display = 'none'; HUD.parts(false); HUD.stun(0);
    HUD.lightHint(null); Input.requestLock();
  },
  cabinInteract() {
    const it = Cabin.aimed(); if (!it) return;
    if (it.id === 'keypad') { this.openKeypad(); return; }
    const info = Cabin.use(it.id); if (info) HUD.inspect(info);
  },
  openKeypad() { HUD.openKeypad(); this.expectUnlock = !!document.pointerLockElement; Input.exitLock(); SFX.beep(1000); },
  closeKeypad(opened) { HUD.closeKeypad(); if (!opened && this.state === 'cabin') Input.requestLock(); },
  cabinTimeout() {
    this.state = 'timeout'; HUD.show(false); this.closeInspect(); HUD.closeKeypad(); Input.exitLock();
    SFX.slam(0.8); SFX.voice(0, 0.7, true); GFX.fx.red = 0.6; GFX.fx.fade = 0.6;
    this.screen('timeout', true);
  },
  escapeCabin() {
    this.state = 'play'; HUD.cabinTimer(null); HUD.lightHint(null);
    $('minimap').style.display = ''; $('compass').style.display = ''; $('objective').style.display = ''; HUD.parts(this.phase === 'boat');
    Player.attach(World.cam, World, this.worldFlash);
    const d = World.cabin.door; Player.place(d.x, d.z + 0.6, Math.PI, 0); Player.lightOn = Player.battery > 0; Player.frozen = false;
    if (Net.on) Net.act('escaped'); else Joury.stun(20); // online, the host's Joury is the one who gets stunned
    GFX.fx.fade = 1; this.fadeIn = 1;
    HUD.toast('<b>You escaped!</b> Joury is stunned for 20 seconds — <b>RUN!</b>', 4.5); SFX.chime();
    Input.requestLock();
  },

  // ---------------- ending ----------------
  launch() {
    // online this can arrive while you are anywhere: mid-menu, in the cabin, even on the caught screen
    ['inspect', 'keypad', 'pause', 'caught', 'timeout'].forEach((s) => this.screen(s, false)); $('crash').className = 'screen'; this.crashLine2 = false; this.menuOpen = false; this.mapOpen = false; Chat.stopTyping(); HUD.cabinTimer(null);
    this.state = 'ending'; this.endT = 0; this.endShown = false; Input.exitLock(); HUD.show(false); this.screen('bigmap', false);
    SFX.allLoopsOff(0.3); SFX.splash(); SFX.startEndingMusic();
    if (!this.ending) this.ending = this.buildEnding();
    this.ending.enter();
    GFX.fx.fade = 1; GFX.fx.red = 0; GFX.fx.static = 0;
  },
  buildEnding() {
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0xe0a088, 0.0055);
    const sunDir = new THREE.Vector3(0, 0.04, -1).normalize();
    const sky = makeSky({ top: 0x3a4a8a, mid: 0xffa070, bot: 0x6a4a6a, sunDir, sunCol: 0xffe0a0, sunSize: 0.9992, halo: 1.6, r: 600 }); scene.add(sky);
    const sun = new THREE.DirectionalLight(0xffc090, 2.8); sun.position.set(0, 12, -60); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 140 }); scene.add(sun); scene.add(sun.target);
    const hemi = new THREE.HemisphereLight(0xffc8a0, 0x2a2438, 1.0); scene.add(hemi);
    const envScene = new THREE.Scene(); envScene.add(makeSky({ top: 0x3a4a8a, mid: 0xffa070, bot: 0x6a4a6a, sunDir, sunCol: 0xffe0a0, sunSize: 0.999, halo: 1.6, r: 100 }));
    const pm = new THREE.PMREMGenerator(GFX.renderer), env = pm.fromScene(envScene, 0, 0.1, 500).texture; pm.dispose();
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), makeWater(0x0e1420, env, { repeat: 160, env: 1.3, rough: 0.12 })); water.rotation.x = -Math.PI / 2; scene.add(water);
    // the island behind, with Joury on the dock
    const isl = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), lam(0x1c2418)); isl.scale.set(110, 16, 50); isl.position.set(0, -5, 95); scene.add(isl);
    { const items = []; for (let i = 0; i < 130; i++) { const x = rand(-95, 95), z = 95 + rand(-25, 30); const y = -5 + 16 * Math.sqrt(Math.max(0, 1 - (x / 110) ** 2 - ((z - 95) / 50) ** 2)); if (y < 0.5) continue; items.push({ kind: i % 4 ? 'pine' : (i % 8 ? 'dead' : 'oak'), variant: i % 2, x, y: y - 0.4, z, s: rand(1.8, 2.8), ry: rand(0, TAU) }); } instancedTrees(scene, items, { cast: false }); }
    const db = new Builder(); for (let z = 38; z < 48; z += 0.35) db.box(3, 0.08, 0.3, 0, 0.9, z, 0x5a4026, 'wood'); scene.add(db.build());
    const J = makeJoury(); J.root.position.set(0, 0.95, 39); J.root.rotation.y = Math.PI; J.root.scale.setScalar(1.0); scene.add(J.root);
    const boat = makeBoat(); scene.add(boat);
    const kids = KID_TYPES.map((k, i) => { const c = makeKid(k.id); c.root.scale.setScalar(0.72); animateKid(c, 0, 'sit'); boat.add(c.root); const row = Math.floor(i / 2), side = i % 2 ? 1 : -1; c.root.position.set(side * 0.33, 0.06, 1.5 - row * 0.62); c.root.rotation.y = Math.PI + side * 0.3; return c; });
    const wake = []; for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.mist, color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false })); s.scale.set(2, 0.6, 1); scene.add(s); wake.push(s); }
    const cam = GFX.camera(55, 0.1, 1200);
    return {
      scene, cam,
      enter: () => { this.rematch = false; J.root.visible = true; boat.position.set(0, 0.1, 30); boat.rotation.y = Math.PI; Object.values(boat.userData).forEach((o) => { o.visible = true; }); $('story').classList.add('bare'); },
      update: (t, dt) => {
        const speed = Math.min(1, t / 3) * 5; boat.position.z -= speed * dt; boat.position.y = 0.1 + Math.sin(t * 1.6) * 0.06; boat.rotation.z = Math.sin(t * 1.1) * 0.03; boat.rotation.x = Math.sin(t * 1.4) * 0.02;
        kids.forEach((c, i) => { const w = Math.sin(t * 6 + i); c.armL.rotation.z = -2.4 + w * 0.4; c.armR.rotation.z = i % 3 === 0 ? 2.4 - w * 0.4 : 0; c.head.rotation.y = Math.sin(t * 0.7 + i) * 0.3; });
        wake.forEach((s, i) => { const k = ((t * 0.8 + i / wake.length) % 1); s.position.set(boat.position.x + Math.sin(i * 7) * k * 2.5, 0.12, boat.position.z + 2.6 + k * 14); s.material.opacity = 0.35 * (1 - k); s.scale.set(1.5 + k * 4, 0.4 + k * 0.6, 1); });
        // Joury on the dock: hopping mad
        J.root.position.y = 0.95 + Math.abs(Math.sin(t * 7)) * (t > 5 && t < 9 ? 0.4 : 0.05);
        J.armL.rotation.x = -2.6 + Math.sin(t * 14) * 0.5; J.armR.rotation.x = -2.2 + Math.cos(t * 14) * 0.5; J.head.rotation.z = Math.sin(t * 9) * 0.15;
        if (!this.rematch && t > 5.5) { this.rematch = true; this.screen('story', true); const big = $('storyBig'); big.innerHTML = 'REMATCH!'; big.className = 'on red'; SFX.voice(0, 0.4, true); setTimeout(() => SFX.gull(), 1500); }
        if (t > 9.2 && $('storyBig').classList.contains('on')) $('storyBig').className = '';
        // camera: alongside the boat looking back at the island, then swing round to the sunrise
        const k = smoothstep(2, 13, t);
        const side = new THREE.Vector3(lerp(6, 1.5, k), lerp(2.6, 3.4, k), boat.position.z + lerp(-5, 9, k));
        cam.position.copy(side);
        const look = new THREE.Vector3(lerp(0, 0, k), lerp(2.0, 2.5, k), lerp(boat.position.z + 18, boat.position.z - 40, k));
        cam.lookAt(look);
        hemi.intensity = 0.8 + k * 0.4; sun.position.set(0, 8 + t * 0.25, boat.position.z - 60); sun.target.position.copy(boat.position);
        SFX.setLoop('engine', t < 13 ? 0.12 : 0.05); SFX.setLoop('water', 0.12);
      },
    };
  },
  updateEnding(dt) {
    this.endT += dt; const t = this.endT, E = this.ending;
    GFX.fx.fade = Math.max(t > 14 ? 0.45 * smoothstep(14, 16, t) : 0, 1 - t * 0.7); GFX.fx.warm = 0.4; GFX.fx.exposure = 1.0; GFX.fx.auto = 0; GFX.fx.vignette = 0.7; GFX.fx.grain = 0.04;
    E.update(t, dt);
    if (t > 14.5 && !this.endShown) this.showEpilogue();
    GFX.render(E.scene, E.cam, dt);
  },
  showEpilogue() {
    this.endShown = true; this.screen('story', false);
    const lines = [
      'The sun came up over the black lake.',
      'All ten kids made it home — with every last piece of their candy.',
      'From the dock behind them, one final shout echoed across the water:',
      '<span class="big">“REMATCH!”</span>',
      'Vivek accepted the rematch…',
      '<span class="big">…and won 5–0.</span>',
      'And for the first time in 366 days, Joury typed two letters: “gg”.',
      'Then he logged off.',
      '<span class="srv">[SERVER] Joury is online.</span>',
    ];
    $('endLines').innerHTML = lines.map((l) => `<span class="line">${l}</span>`).join('');
    const s = this.stats;
    $('endStats').innerHTML = `<span>Time</span><span>${fmtTime(s.time)}</span><span>Times caught</span><span>${s.caught}</span><span>Kids saved</span><span>10 / 10</span><span>Diary pages</span><span>${Scare.pagesRead ? Scare.pagesRead.size : 0} / 8</span><span>Difficulty</span><span>${D().name}</span>`;
    $('endStats').classList.remove('on'); $('btnAgain').classList.remove('on');
    const board = $('endBoard'); board.classList.remove('on'); board.innerHTML = '';
    if (Net.on && Net.board && Net.board.length > 1) { // who did what
      board.innerHTML = '<span class="h">Player</span><span class="h">Kids freed</span><span class="h">Times caught</span>' + Net.board.map((p) => p.role === 'joury'
        ? `<span class="n"><i style="background:${css(NET_COLORS[(p.ci | 0) % NET_COLORS.length])}"></i>${esc(cleanName(p.name))}${p.id === Net.id ? ' (you)' : ''} <em class="vip-title">👑 VIP JOURY</em></span><span class="v">—</span><span class="v">caught ${p.kids | 0}</span>`
        : `<span class="n"><i style="background:${css(NET_COLORS[(p.ci | 0) % NET_COLORS.length])}"></i>${esc(cleanName(p.name))}${p.id === Net.id ? ' (you)' : ''}</span><span class="v">${p.kids | 0}</span><span class="v">${p.caught | 0}</span>`).join('');
      $('btnAgain').textContent = 'BACK TO THE LOBBY';
    } else $('btnAgain').textContent = 'PLAY AGAIN';
    this.screen('ending', true);
    const els = [...$('endLines').children];
    els.forEach((el, i) => setTimeout(() => { el.classList.add('on'); if (el.querySelector('.srv')) SFX.chatPing('server'); }, 400 + i * 1300 + (i === els.length - 1 ? 1600 : 0)));
    setTimeout(() => { $('endStats').classList.add('on'); if ($('endBoard').innerHTML) $('endBoard').classList.add('on'); }, 2400 + els.length * 1300);
    setTimeout(() => { $('btnAgain').classList.add('on'); }, 2900 + els.length * 1300);
  },

  // ---------------- per-frame ----------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, Math.max(0, (now - (this.last || now)) / 1000)); this.last = now;
    this.fps = this.fps ? this.fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05 : 60;
    FogU.uTime.value += dt;
    try { this.frame(dt); Net.tick(dt); Admin.update(dt); } catch (e) { console.error(e); this.errors = (this.errors || 0) + 1; }
    HUD.update(dt); Input.endFrame();
  },
  frame(dt) {
    const fx = GFX.fx; VM.visible = false;
    // motion blur from how fast you turned this frame (in screen units), and the aim blur
    { const dyaw = Player.yaw - (this.lastYaw === undefined ? Player.yaw : this.lastYaw), dp = Player.pitch - (this.lastPitch === undefined ? Player.pitch : this.lastPitch); this.lastYaw = Player.yaw; this.lastPitch = Player.pitch;
      const live = this.state === 'play' || this.state === 'house' || this.state === 'cabin', mb = live && CFG.motionBlur !== false ? 0.55 : 0, f = 1 / (2 * Math.tan((Player.fov || 70) * Math.PI / 360));
      fx.motionX = damp(fx.motionX || 0, clamp(-dyaw * f * mb, -0.05, 0.05), 25, dt); fx.motionY = damp(fx.motionY || 0, clamp(dp * f * mb * 1.6, -0.05, 0.05), 25, dt);
      fx.dof = live ? Player.aimK * 0.9 : 0; } // each state below decides whether your hands are on screen
    fx.flash = Math.max(0, fx.flash - dt * 2.5);
    switch (this.state) {
      case 'title': {
        this.t += dt; fx.fade = Math.max(0, fx.fade - dt * 0.6); fx.static = 0.02 + (Math.random() < 0.01 ? 0.4 : 0); fx.vignette = 1; fx.grain = 0.07; fx.red = 0; fx.warm = 0; fx.exposure = 2.8; fx.auto = 0;
        FogU.uMistAmt.value = 0.8;
        const sz = World.shoreZ, cam = World.cam, a = this.t * 0.05, dk = World.dock;
        cam.position.set(-6.5 + Math.sin(a) * 1.5, 2.1 + Math.sin(this.t * 0.4) * 0.1, dk.z1 + 7.5 + Math.cos(a) * 1.0); cam.lookAt(-11, 3.4, sz - 24);
        { const J = Joury.c; J.root.visible = true; J.eyeGlow.setSize(0, 0.6); J.eyeGlow.setSize(1, 0.6); J.root.position.set(-0.4, dk.y, dk.z1 - 2.2); J.root.rotation.y = Math.atan2(cam.position.x + 0.4, cam.position.z - dk.z1 + 2.2); animateJoury(J, this.t, false, 0, null); }
        Player.pos.set(cam.position.x, 0, cam.position.z);
        if (this.worldFlash) { this.worldFlash.intensity = 0; this.worldFlash.userData.fill.intensity = 0; }
        World.update(dt, cam.position); Weather.update(dt, cam, false);
        if (SFX.ctx) { SFX.setLoop('wind', 0.1); SFX.setLoop('water', 0.22); SFX.setLoop('rain', 0.14); SFX.update(dt, 0); }
        GFX.render(World.scene, cam, dt);
        break;
      }
      case 'story': {
        FogU.uMistAmt.value = 0; fx.grain = 0.06; fx.vignette = 0.9; fx.static = 0; fx.exposure = 1.0; fx.auto = 0;
        if (SFX.ctx) { const night = Story.idx >= 3; SFX.setLoop('wind', night ? 0.08 : 0); SFX.setLoop('water', Story.idx === 5 ? 0.2 : 0); SFX.update(dt, 0); }
        Story.update(dt);
        break;
      }
      case 'play': this.updatePlay(dt); break;
      case 'house': this.updateHouse(dt); break;
      case 'hend': this.updateHouseEnd(dt); break;
      case 'caught': this.updateCaught(dt); break;
      case 'cabin': this.updateCabin(dt); break;
      case 'paused': {
        const prev = this.prev;
        if (prev === 'cabin') GFX.render(Cabin.scene, Cabin.cam, 0); else if (prev === 'house') GFX.render(House.scene, House.cam, 0); else GFX.render(World.scene, World.cam, 0);
        if (this.mapOpen) HUD.bigmap(0);
        break;
      }
      case 'timeout': GFX.render(Cabin.scene, Cabin.cam, dt); SFX.update(dt, 0); break;
      case 'ending': this.updateEnding(dt); if (SFX.ctx) SFX.update(dt, 0); break;
    }
  },
  updatePlay(dt) {
    const fx = GFX.fx, d = D();
    this.stats.time += dt;
    if (!this.perfTipped && this.stats.time > 12 && this.stats.time < 13 && this.fps < 32 && CFG.quality !== 'low') { this.perfTipped = true; HUD.toast(`Running at about ${Math.round(this.fps)} FPS. For a smoother game, press <b>Esc</b> and set Graphics to <b>Low</b>.`, 6); }
    FogU.uMistAmt.value = CFG.difficulty === 'nightmare' ? 1.0 : 0.8;
    const vip = Net.amJoury();
    if (Net.on) Player.frozen = !!this.menuOpen || (vip && Joury.state !== 'hunt'); // VIP Joury waits out the head start
    Player.update(dt, vip ? { walk: 4.3, run: 7.2 } : {});
    if (vip) { Player.stamina = 1; Player.lightOn = false; }
    Player.updateLight(dt, Joury.danger, vip ? 0 : d.drain * Perks.drainK());
    Joury.update(dt);
    if (this.state !== 'play') return; // caught during Joury.update
    World.update(dt, World.cam.position); Weather.update(dt, World.cam, true); Scare.updatePumpkins(dt); Chat.update(dt, Joury.danger); Crackers.update(dt);
    // interaction target
    this.target = this.findTarget();
    HUD.prompt(this.target ? this.target.label() : null);
    // screen effects driven by Joury
    const danger = Joury.danger;
    const targetStatic = Math.max(0, danger * 0.48 + (Joury.seen ? 0.06 : 0) - 0.06);
    fx.static = damp(fx.static, targetStatic, fx.static > targetStatic ? 2.5 : 8, dt);
    fx.red = damp(fx.red, (this.phase === 'boat' ? 0.16 : 0) + (Joury.seen ? Joury.stare / d.stareLimit * 0.35 : 0), 4, dt);
    fx.exposure = 1.5; fx.auto = 1; fx.key = 0.03; fx.vignette = 1 + danger * 0.3; fx.grain = 0.07 + danger * 0.05; fx.aberr = 0.5 + danger * 1.5; fx.warm = 0; fx.shake = Joury.seen ? danger * 0.4 : 0;
    if (this.fadeIn > 0) { this.fadeIn -= dt * 0.8; fx.fade = Math.max(0, this.fadeIn); } else fx.fade = 0;
    this.setRage(this.phase === 'boat' ? 1 : 0);
    // sound
    if (SFX.ctx) {
      const shore = clamp((Math.hypot(Player.pos.x, Player.pos.z) - 100) / 30, 0, 1) + (World.onDock(Player.pos.x, Player.pos.z) ? 0.6 : 0);
      SFX.setLoop('wind', 0.16); SFX.setLoop('rumble', 0.08); SFX.setLoop('rain', 0.2); SFX.setLoop('water', 0.05 + shore * 0.25); SFX.setLoop('fire', 0);
      SFX.setLoop('drone', 0.035 + danger * 0.3 + (this.phase === 'boat' ? 0.05 : 0)); SFX.setLoop('static', fx.static * 0.22, 0.08);
      SFX.update(dt, Joury.state === 'hunt' ? danger : 0);
      this.owlT -= dt; if (this.owlT <= 0) { this.owlT = rand(22, 45); SFX.owl(); }
      this.ambT -= dt; if (this.ambT <= 0) { this.ambT = rand(9, 22); SFX.twig(rand(-1, 1), rand(0.05, 0.14)); }
    }
    // HUD
    const n = this.savedCount();
    HUD.objective(this.phase === 'kids' ? `Kids rescued: ${n}/10` : `Boat parts: ${World.partsDelivered.size}/4 on the boat` + (World.carried.size ? ` · carrying ${World.carried.size}` : ''));
    HUD.bars(Player.stamina, Player.battery, Player.exhausted, true);
    HUD.stun(Joury.state === 'stunned' ? Joury.stunT : 0); HUD.roster();
    Vip.update(dt); Vip.updateTag();
    { const L = this.worldFlash; VM.update(dt, !vip && this.fadeIn <= 0.5, Player.lightOn ? 'on' : 'off', L ? L.intensity / Math.max(0.01, L.userData.base * (1 + 0.7 * Player.aimK)) : 1); }
    { const mk = []; if (this.phase === 'kids') World.kids.forEach((k) => { if (!k.saved) mk.push({ x: k.home.x, z: k.home.z, c: '#ffd23a' }); }); else { World.parts.forEach((p) => { if (!p.taken) mk.push({ x: p.x, z: p.z, c: '#ff9c2b', d: 1 }); }); mk.push({ x: 0, z: World.dock.z1, c: '#5fc8ff', d: 1 }); } HUD.compass(mk); }
    const mg = clamp(danger * 1.1 - 0.25, 0, 0.85); HUD.minimap(mg);
    if (this.mapOpen) HUD.bigmap(mg);
    GFX.render(World.scene, World.cam, dt);
  },
  updateCabin(dt) {
    const fx = GFX.fx;
    FogU.uMistAmt.value = 0;
    if ($('inspect').classList.contains('on') || $('keypad').classList.contains('on') || this.menuOpen) { Player.frozen = true; } else if (Cabin.wakeT <= 0) Player.frozen = false;
    Cabin.update(dt);
    if (this.state !== 'cabin') return;
    const low = Cabin.timer < 30 && Cabin.wakeT <= 0;
    fx.static = damp(fx.static, low ? 0.12 : 0.03, 2, dt); fx.red = damp(fx.red, low ? 0.2 + Math.sin(GFX.time * 4) * 0.08 : 0, 3, dt); fx.vignette = 1.1; fx.grain = 0.08; fx.aberr = 0.5; fx.warm = 0.15; fx.shake = 0; fx.exposure = 1.3; fx.auto = 1; fx.key = 0.05;
    const it = Cabin.wakeT <= 0 && !$('inspect').classList.contains('on') ? Cabin.aimed() : null;
    HUD.prompt(it ? Cabin.label(it.id) : null);
    HUD.cabinTimer(Cabin.timer, Cabin.digitsLine());
    HUD.bars(Player.stamina, Player.battery, Player.exhausted, false);
    HUD.lightHint(Cabin.s.uvTaken ? `F: switch light (${Cabin.light === 'uv' ? 'UV' : Cabin.light === 'flash' ? 'flashlight' : 'off'})` : null); HUD.roster();
    Chat.update(dt, 0);
    if (SFX.ctx) { SFX.setLoop('wind', 0.04); SFX.setLoop('water', 0); SFX.setLoop('rain', 0.07); SFX.setLoop('drone', low ? 0.18 : 0.05); SFX.setLoop('static', fx.static * 0.15); SFX.update(dt, low ? 0.5 : 0); }
    VM.update(dt, Cabin.wakeT <= 0 && !$('inspect').classList.contains('on') && !$('keypad').classList.contains('on'), Cabin.light === 'uv' ? 'uv' : Cabin.light === 'flash' ? 'on' : 'off', 1);
    GFX.render(Cabin.scene, Cabin.cam, dt);
  },
};

// ---------------------------------------------------------------------
//  Test hooks (used by the automated browser test; harmless to players)
// ---------------------------------------------------------------------
window.EFJ = {
  get state() { return Game.state; }, get phase() { return Game.phase; }, get fps() { return Math.round(Game.fps); }, get errors() { return Game.errors || 0; },
  info() { return { state: Game.state, phase: Game.phase, saved: Game.savedCount(), joury: { state: Joury.state, dist: +Joury.dist.toFixed(1), stare: +Joury.stare.toFixed(2) }, player: { x: +Player.pos.x.toFixed(1), z: +Player.pos.z.toFixed(1), battery: +Player.battery.toFixed(2) }, cabin: { timer: Math.round(Cabin.timer), digits: Cabin.digits.join(''), found: Cabin.found.slice(), s: Object.assign({}, Cabin.s) }, parts: World.parts.map((p) => ({ id: p.id, x: p.x, z: p.z, taken: p.taken })), delivered: [...World.partsDelivered], trees: World.treeCount, jacks: World.jackCount, draw: GFX.stats && GFX.stats.calls, tris: GFX.stats && GFX.stats.tris, programs: GFX.renderer.info.programs.length }; },
  teleport(x, z, yaw) { Player.place(x, z, yaw === undefined ? Player.yaw : yaw, 0); },
  nearKid(i) { const k = World.kids[i]; const a = k.home.yaw; Player.place(k.home.x + Math.sin(a) * 1.6, k.home.z + Math.cos(a) * 1.6, a, -0.2); },
  nearPart(i) {
    const p = World.parts[i];
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, x = p.x + Math.cos(a) * 1.5, z = p.z + Math.sin(a) * 1.5, q = { x, z }; World.resolve(q, 0.36); if (!World.walkable(x, z) || Math.hypot(q.x - x, q.z - z) > 0.01) continue; Player.place(x, z, Math.atan2(-(p.x - x), -(p.z - z)), -0.45); return true; }
    Player.place(p.x, p.z + 1.5, 0, -0.45); return false;
  },
  toDock() { const d = World.dock; Player.place(1.2, d.z1 - 4.5, -Math.PI / 2, -0.3); },
  rescueAll() { World.kids.forEach((k) => { if (!k.saved) World.rescue(k); }); HUD.drawKidIcons(World.kids.map((k) => k.idx)); Game.startBoatPhase(); },
  holdJoury(sec) { Joury.state = 'dormant'; Joury.timer = sec; Joury.c.root.visible = false; },
  catchNow() { Joury.state = 'hunt'; Game.caught(); },
  aimCabin(id) { const it = Cabin.inters.find((q) => q.id === id); const c = it.box.getCenter(new THREE.Vector3()); const p = Cabin.cam.position; const dx = c.x - p.x, dy = c.y - p.y, dz = c.z - p.z; Player.yaw = Math.atan2(-dx, -dz); Player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); Player.applyCam(); },
  walkCabin(x, z) { Player.place(x, z, Player.yaw, Player.pitch); },
  setCabinTimer(s) { Cabin.timer = s; },
  skipWake() { Cabin.wakeT = 0.01; },
  quality(q) { CFG.quality = q; Game.applyQuality(); },
  jouryAhead(dist) { Joury.state = 'hunt'; Joury.c.root.visible = true; const x = Player.pos.x - Math.sin(Player.yaw) * dist, z = Player.pos.z - Math.cos(Player.yaw) * dist; Joury.pos.set(x, World.groundAt(x, z), z); Joury.tpT = 99; },
  run(code) { return eval(code); },
  lightning(reveal) { Weather.strike(reveal !== false); },
  look(yaw, pitch) { Player.yaw = yaw; Player.pitch = pitch || 0; Player.applyCam(); },
  get net() { return { mode: Net.mode, id: Net.id, code: Net.code, started: Net.started, joined: Net.joined, open: !!(Net.peer && Net.peer.open), players: [...Net.players.values()].map((p) => ({ id: p.id, name: p.name, where: p.where, x: +p.x.toFixed(1), z: +p.z.toFixed(1), kids: p.kids, caught: p.caught, av: !!p.av })) }; },
};

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => Game.boot()) : Game.boot();
