// =====================================================================
//  NET — online co-op for 2–4 players.
//  One player hosts: their game runs Joury and owns the island's state
//  (kids, batteries, boat parts). Everyone else sends where they are and
//  what they do. Browsers talk to each other directly over WebRTC using
//  the PeerJS library; the free PeerJS service only introduces them.
// =====================================================================
const NET_VERSION = 1, NET_MAX = 4, NET_PREFIX = 'efj1-';
const NET_COLORS = [0xe0803a, 0x4aa8ff, 0x7ad66a, 0xd86ad0];          // name tags, map dots, chat
const NET_SHIRTS = [0x6e3a1c, 0x24405e, 0x3a4a2a, 0x4e2a4a];          // the same colors as worn, faded clothes
// A friend's flashlight seen from the side: a soft cone that fades at its edges instead of a solid wedge
function makeRemoteBeam(length, radius) {
  const geo = new THREE.ConeGeometry(radius, length, 20, 1, true); geo.translate(0, -length / 2, 0); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 0 }, uTime: FogU.uTime },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vAlong; void main(){ vAlong = clamp(-position.z / ' + length.toFixed(1) + ', 0.0, 1.0); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uStrength; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vAlong; void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.5); float a = edge * pow(1.0 - vAlong, 2.2) * smoothstep(0.0, 0.06, vAlong) * uStrength; gl_FragColor = vec4(vec3(1.0, 0.95, 0.84) * a, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 8; return m;
}
// Join codes are 5 items from the game, like a Minecraft join code. Each item stands for one letter of the room id.
const NET_ITEMS = [
  ['🎃', 'Pumpkin'], ['🏮', 'Lantern'], ['🔋', 'Battery'], ['🗝️', 'Key'], ['🕯️', 'Candle'], ['📜', 'Diary'],
  ['🎮', 'Controller'], ['🏆', 'Trophy'], ['🛶', 'Boat'], ['🔦', 'Flashlight'], ['🍬', 'Candy'], ['👻', 'Ghost'],
  ['💀', 'Skull'], ['🦇', 'Bat'], ['🕷️', 'Spider'], ['🌕', 'Moon'], ['🦴', 'Bone'], ['🧙', 'Witch'],
];
const NET_ALPHA = 'ABCDEFGHJKLMNPQRST', NET_CODE_LEN = 5;
const codeItems = (code) => [...code].map((ch) => NET_ITEMS[NET_ALPHA.indexOf(ch)]).filter(Boolean);
const codeWords = (code) => codeItems(code).map((it) => it[1]).join(', ');
const FAKE_CHAT = ['come to the cabin i found something', 'behind u', 'turn ur light off, trust me', 'im at the dock, where r u?', 'stand still. he cant see u if u dont move', 'help me pls im stuck', 'wait there im coming to u', 'its safe now hes gone', 'dont move. im right behind u'];
const r2 = (v) => Math.round(v * 100) / 100;

const Net = {
  mode: 'off', peer: null, conns: new Map(), hostConn: null, id: null, code: '', started: false, joined: false, seed: 1,
  players: new Map(), sendT: 0, lastHost: 0, nextId: 1, fakeT: 90, board: null, prevDiff: null,
  get on() { return this.mode !== 'off'; },
  get isHost() { return this.mode === 'host'; },
  get isClient() { return this.mode === 'client'; },
  me() { return this.players.get(this.id); },
  nameOf(id) { const p = this.players.get(id); return p ? p.name : 'Someone'; },
  others() { return [...this.players.values()].filter((p) => !p.local); },
  jouryPlayer() { return [...this.players.values()].find((p) => p.role === 'joury') || null; },
  amJoury() { const m = this.on && this.started && this.me(); return !!m && m.role === 'joury'; },
  rename(name) {
    const me = this.me(); if (!me) return;
    if (me.name !== name) { me.name = name; Lobby.render(); }
    if (this.isHost) { this.broadcast({ t: 'roster', players: this.roster() }); HUD.roster && HUD.roster(); }
    else this.send(this.hostConn, { t: 'name', name });
  },
  setRole(joury) {
    if (this.isHost) { this.hostRole(this.me(), joury); return; }
    this.send(this.hostConn, { t: 'role', joury: !!joury });
  },
  hostRole(p, joury) {
    if (!p || this.started) return;
    if (joury && p.vip && !this.jouryPlayer()) p.role = 'joury'; else if (!joury && p.role === 'joury') p.role = 'survivor';
    this.broadcast({ t: 'roster', players: this.roster() }); Lobby.render();
  },

  // ---------------- connecting ----------------
  peerOpts() {
    // ?peer=host:port points the game at your own PeerJS server (also how the automated tests connect)
    const m = /[?&#]peer=([^&#]+)/.exec(location.href);
    if (m) { const [h, p] = decodeURIComponent(m[1]).split(':'); return { host: h, port: Number(p) || 9000, path: '/', secure: false, debug: 0 }; }
    return { debug: 0 };
  },
  errText(e) {
    const t = e && e.type;
    if (t === 'peer-unavailable') return 'noroom';
    if (t === 'browser-incompatible') return 'browser';
    return 'service';
  },
  addPlayer(id, name, ci) {
    const p = { id, name, ci, color: NET_COLORS[ci % NET_COLORS.length], x: 0, z: 0, yaw: 0, pitch: 0, lightOn: true, crouching: false, sprinting: false, mv: 0, noise: 0, where: 'l', sees: false,
      local: id === this.id, kids: 0, caught: 0, role: 'survivor', ref: '', used: '', vip: false, cx: 0, cz: 0, cyaw: 0, cpitch: 0, av: null, seen: performance.now(), chatAt: [], knockAt: -1e9 };
    this.players.set(id, p); return p;
  },
  roster() { return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, ci: p.ci, kids: p.kids, caught: p.caught, role: p.role, ref: p.ref, used: p.used, vip: p.vip })); },
  syncRoster(list) {
    const keep = new Set(list.map((q) => q.id));
    [...this.players.keys()].forEach((id) => { if (!keep.has(id)) this.removePlayer(id); });
    list.forEach((q) => { const p = this.players.get(q.id) || this.addPlayer(q.id, cleanName(q.name), q.ci | 0); if (!p.local && p.name !== cleanName(q.name)) { p.name = cleanName(q.name); this.disposeAvatar(p); } p.kids = q.kids | 0; p.caught = q.caught | 0; p.role = q.role === 'joury' ? 'joury' : 'survivor'; p.ref = String(q.ref || ''); p.used = String(q.used || ''); p.vip = !!q.vip; });
    Lobby.render();
  },
  removePlayer(id) { const p = this.players.get(id); if (!p) return; this.disposeAvatar(p); this.players.delete(id); },

  host(name, cb) {
    this.leave();
    if (typeof Peer === 'undefined') { cb('browser'); return; }
    this.mode = 'host'; this.id = 'h'; this.nextId = 1; this.started = false; this.joined = true;
    Object.assign(this.addPlayer('h', name, 0), { ref: CFG.refCode, used: CFG.refUsed || '', vip: Perks.has('vip') });
    const open = (tries) => {
      this.code = Array.from({ length: NET_CODE_LEN }, () => NET_ALPHA[Math.floor(Math.random() * NET_ALPHA.length)]).join('');
      let peer; try { peer = this.peer = new Peer(NET_PREFIX + this.code, this.peerOpts()); } catch (e) { cb('browser'); return; }
      peer.on('open', () => { if (this.peer === peer) cb(null, this.code); });
      peer.on('connection', (c) => { if (this.peer === peer) this.onIncoming(c); });
      peer.on('disconnected', () => { if (this.peer === peer && !peer.destroyed) { try { peer.reconnect(); } catch (e) { /* keep playing with whoever is connected */ } } });
      peer.on('error', (e) => {
        if (this.peer !== peer) return;
        if (e.type === 'unavailable-id' && tries < 5) { peer.destroy(); open(tries + 1); return; } // that code is taken: roll another
        if (!peer.open && !this.conns.size && !this.started) cb(this.errText(e));
      });
    };
    open(0);
  },
  onIncoming(c) {
    c.on('data', (m) => this.hostRecv(c, m));
    c.on('close', () => { if (c.pid) this.dropPlayer(c.pid); });
    c.on('error', () => { if (c.pid) this.dropPlayer(c.pid); });
  },
  join(code, name, cb) {
    this.leave();
    if (typeof Peer === 'undefined') { cb('browser'); return; }
    this.mode = 'client'; this.code = code; this.started = false; this.joined = false;
    let peer; try { peer = this.peer = new Peer(this.peerOpts()); } catch (e) { this.leave(); cb('browser'); return; }
    let done = false;
    const fail = (why) => { if (done) return; done = true; clearTimeout(timer); if (this.peer === peer) this.leave(); cb(why); };
    const timer = setTimeout(() => fail('timeout'), 20000);
    peer.on('error', (e) => fail(this.errText(e)));
    peer.on('open', () => {
      if (this.peer !== peer) return;
      const c = this.hostConn = peer.connect(NET_PREFIX + code, { reliable: true, serialization: 'json' });
      c.on('open', () => this.send(c, { t: 'hello', v: NET_VERSION, name, ref: CFG.refCode, used: CFG.refUsed || '', vip: Perks.has('vip') }));
      c.on('data', (m) => {
        if (this.peer !== peer || !m || typeof m !== 'object') return;
        if (m.t === 'welcome') {
          done = true; clearTimeout(timer); this.id = m.id; this.joined = true; this.lastHost = performance.now(); this.code = m.code;
          this.players.clear(); this.syncRoster(m.players); cb(null, m);
        } else if (m.t === 'deny') fail(m.why);
        else if (this.joined) this.clientRecv(m);
      });
      const gone = () => { if (this.peer !== peer) return; if (!done) fail('noroom'); else this.lost('The host left the game.'); };
      c.on('close', gone); c.on('error', gone);
    });
  },
  leave() {
    const peer = this.peer; this.peer = null;
    [...this.players.values()].forEach((p) => this.disposeAvatar(p));
    this.players.clear(); this.conns.clear(); this.hostConn = null; this.mode = 'off'; this.started = false; this.joined = false; this.id = null; this.board = null;
    if (this.prevDiff) { CFG.difficulty = this.prevDiff; this.prevDiff = null; }
    Chat.stopTyping();
    if (peer) { try { peer.destroy(); } catch (e) { /* already gone */ } }
  },
  lost(text) { if (!this.on) return; this.leave(); Game.netLost(text); },
  dropPlayer(id) {
    const p = this.players.get(id); if (!p || p.local) return;
    const c = this.conns.get(id); this.conns.delete(id); if (c) { try { c.close(); } catch (e) { /* closed */ } }
    if (Joury.focus === p) Joury.focus = null;
    // anything they were carrying goes back to where it was found
    World.parts.forEach((pt, i) => { if (pt.taken && pt.by === id && !World.partsDelivered.has(pt.id)) this.emit({ e: 'drop', i }); });
    this.removePlayer(id);
    this.broadcast({ t: 'roster', players: this.roster() }); Lobby.render();
    if (this.started) Chat.server(`${p.name} left the game.`);
  },

  // ---------------- messages ----------------
  send(c, m) { try { if (c && c.open) c.send(m); } catch (e) { /* connection is closing */ } },
  broadcast(m, except) { this.conns.forEach((c, id) => { if (id !== except) this.send(c, m); }); },
  // Host only: something happened that everyone (or one player) should see.
  emit(ev, to) {
    ev.t = 'ev';
    if (to === undefined) { this.broadcast(ev); this.onEvent(ev); }
    else if (to === this.id) this.onEvent(ev);
    else this.send(this.conns.get(to), ev);
  },
  // Any player: ask the host to do something for me.
  act(a, data) {
    if (!this.on) return;
    const m = Object.assign({ t: 'act', a }, data);
    if (this.isHost) this.hostAct(this.me(), m); else this.send(this.hostConn, m);
  },

  hostRecv(c, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      if (c.pid) return;
      const deny = (why) => { this.send(c, { t: 'deny', why }); setTimeout(() => { try { c.close(); } catch (e) { /* closed */ } }, 400); };
      if (m.v !== NET_VERSION) { deny('version'); return; }
      if (this.players.size >= NET_MAX) { deny('full'); return; }
      const used = new Set([...this.players.values()].map((p) => p.ci)); let ci = 0; while (used.has(ci)) ci++;
      const id = 'p' + this.nextId++; c.pid = id; this.conns.set(id, c);
      const p = this.addPlayer(id, cleanName(m.name), ci); p.ref = String(m.ref || '').slice(0, 12); p.used = String(m.used || '').slice(0, 12); p.vip = !!m.vip;
      this.send(c, { t: 'welcome', id, code: this.code, players: this.roster(), started: this.started, seed: this.seed, diff: CFG.difficulty });
      this.broadcast({ t: 'roster', players: this.roster() }, id); Lobby.render();
      if (this.started) { p.where = 'i'; Chat.server(`${p.name} joined the game.`, id); }
      return;
    }
    const p = c.pid && this.players.get(c.pid); if (!p) return;
    p.seen = performance.now();
    if (m.t === 'role') { this.hostRole(p, !!m.joury); return; }
    if (m.t === 'name') { const n = cleanName(m.name); if (n !== p.name) { const old = p.name; p.name = n; this.disposeAvatar(p); this.broadcast({ t: 'roster', players: this.roster() }); Lobby.render(); if (this.started) Chat.server(`${old} is now called ${n}.`); } return; }
    if (m.t === 'st') {
      p.where = m.w === 'i' ? 'i' : 'c';
      if (p.where === 'i') { p.x = +m.x || 0; p.z = +m.z || 0; p.yaw = +m.yaw || 0; p.pitch = clamp(+m.pitch || 0, -1.5, 1.5); }
      p.lightOn = !!m.l; p.crouching = !!m.c; p.mv = m.mv | 0; p.sprinting = p.mv === 2; p.noise = clamp(+m.n || 0, 0, 40); p.sees = !!m.s;
    } else if (m.t === 'act' && this.started) this.hostAct(p, m);
  },
  hostAct(p, m) {
    if (!p) return;
    if (p.role === 'joury' && !['chat', 'blink'].includes(m.a)) return; // VIP Joury hunts; he does not rescue kids or build boats
    switch (m.a) {
      case 'decoy': { const x = +m.x || 0, z = +m.z || 0; Joury.hearAt(x, z, 70); this.emit({ e: 'bang', x: r2(x), z: r2(z), by: p.id }); break; }
      case 'blink': break;
      case 'rescue': {
        const k = World.kids[m.i | 0]; if (!k || k.saved || !this.started) break;
        p.kids++; this.emit({ e: 'kid', i: m.i | 0, by: p.id }); Scare.onRescue(k); Joury.hear(25, p);
        if (Game.savedCount() === World.kids.length) setTimeout(() => { if (this.started && Game.phase !== 'boat') this.emit({ e: 'boat' }); }, 1500);
        break;
      }
      case 'bat': { const b = World.batteries[m.i | 0]; if (b) { this.emit({ e: 'bat', i: m.i | 0 }); Joury.hear(10, p); } break; }
      case 'part': { const pt = World.parts[m.i | 0]; if (pt && !pt.taken) { this.emit({ e: 'part', i: m.i | 0, by: p.id }); Joury.hear(18, p); } break; }
      case 'deliver': { const ids = World.parts.filter((pt) => pt.taken && pt.by === p.id && !World.partsDelivered.has(pt.id)).map((pt) => pt.id); if (ids.length) this.emit({ e: 'deliv', ids, by: p.id }); break; }
      case 'launch': if (this.started && World.partsDelivered.size === PARTS.length) { this.started = false; this.emit({ e: 'launch', board: this.roster() }); } break;
      case 'noise': Joury.hear(clamp(+m.r || 0, 0, 45), p); break;
      case 'caught': this.playerCaught(p); break;
      case 'escaped': if (p.where !== 'i' || p.local) { p.where = 'i'; Joury.stun(20); Chat.server(`${p.name} escaped the cabin.`, p.id); } break;
      case 'chat': this.relayChat(p, m.text); break;
      case 'knock': this.knock(p); break;
    }
  },
  playerCaught(p) {
    if (p.where === 'c' && !p.local) return;
    p.where = 'c'; p.caught++; p.sees = false;
    const jp = this.jouryPlayer(); if (jp) jp.kids++; // VIP Joury: his catches
    Chat.server(`${p.name} was eliminated by ${jp ? jp.name + ' (Joury)' : 'Joury'}.`, p.id);
    Joury.carryOff(p);
    // while they are locked in, "a friend" may text them the door code
    if (this.players.size > 1) setTimeout(() => {
      if (!this.started || p.where !== 'c' || !this.players.has(p.id) || Math.random() < 0.4) return;
      const pals = [...this.players.values()].filter((q) => q !== p); if (!pals.length) return;
      this.emit({ e: 'fake', as: pick(pals).id, text: 'the door code is ' + Array.from({ length: 4 }, () => randInt(0, 9)).join(' ') }, p.id);
    }, rand(22000, 40000));
  },
  relayChat(p, text) {
    text = String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80); if (!text) return;
    const now = performance.now(); p.chatAt = p.chatAt.filter((t) => now - t < 6000); if (p.chatAt.length >= 5) return; p.chatAt.push(now);
    this.emit({ e: 'chat', k: 'player', who: p.name + ':', text, ci: p.ci });
  },
  // A free player bangs on the cabin door: more time for whoever is locked inside, and Joury hears it.
  knock(p) {
    const inside = [...this.players.values()].filter((q) => q !== p && q.where === 'c'); if (!inside.length || p.where !== 'i') return;
    const now = performance.now();
    if (now - p.knockAt < 20000) { this.emit({ e: 'knocked', ok: 0 }, p.id); return; }
    p.knockAt = now;
    inside.forEach((q) => this.emit({ e: 'knock', by: p.id }, q.id));
    this.emit({ e: 'knocked', ok: 1, ids: inside.map((q) => q.id) }, p.id);
    Joury.hear(45, p);
  },

  clientRecv(m) {
    this.lastHost = performance.now();
    if (m.t === 'snap') this.onSnap(m);
    else if (m.t === 'ev') this.onEvent(m);
    else if (m.t === 'roster') this.syncRoster(m.players);
    else if (m.t === 'start') Game.startMp(m);
  },
  // Things that happen on every player's screen. On the host this runs right when the event is sent.
  onEvent(m) {
    const who = m.by ? this.players.get(m.by) : null, mine = !!who && who.local, live = Game.state !== 'title' && Game.state !== 'ending';
    switch (m.e) {
      case 'kid': if (live) Game.applyRescue(m.i, who, mine); break;
      case 'bat': { const b = World.batteries[m.i]; if (live && b && !b.taken) Game.hideBattery(b); break; }
      case 'part': if (live) Game.applyPart(m.i, m.by); break;
      case 'drop': if (live) Game.dropPart(m.i); break;
      case 'deliv': if (live) Game.applyDeliver(m.ids, m.by); break;
      case 'boat': if (live) Game.startBoatPhase(); break;
      case 'launch': this.board = m.board; this.started = false; if (live) Game.launch(); break;
      case 'jsay': if (Game.state === 'play' && (m.all || Joury.dist < 45)) Joury.sayLocal(m.text, m.angry); break;
      case 'bang': if (live && m.by !== this.id) Crackers.bang(m.x, m.z); break;
      case 'whoosh': if (Game.state === 'play') SFX.whoosh(m.x === undefined ? 0 : Joury.panFor(m.x, m.z)); break;
      case 'vanish': if (Game.state === 'play' && Joury.seen) { GFX.fx.static = Math.max(GFX.fx.static, 0.8); SFX.whoosh(0); } break;
      case 'wake': Joury.wakeFx(); break;
      case 'bolt': if (Game.state === 'play') Weather.strike(false); break;
      case 'chat': if (live) Chat.post(m.k, m.who, m.text, m.k === 'player' ? css(NET_COLORS[(m.ci | 0) % NET_COLORS.length]) : null); break;
      case 'jchat': if (live) Chat.joury(m.text, m.typing); break;
      case 'fake': { const f = this.players.get(m.as); if (live && f) Chat.fake(f.name, css(f.color), m.text); break; }
      case 'mimic': if (Game.state === 'play') Scare.mimicFx(m.as ? this.nameOf(m.as) : null); break;
      case 'knock': if (Game.state === 'cabin') Cabin.helped(who ? who.name : 'A friend'); break;
      case 'knocked':
        if (!live) break;
        if (!m.ok) { HUD.toast('Your knuckles hurt. Give it a few seconds.', 3); break; }
        HUD.toast(`You bang on the door. <b>+15 seconds</b> for ${(m.ids || []).map((id) => esc(this.nameOf(id))).join(' and ')}. <b style="color:#ff8a7a">Joury heard that.</b>`, 4.5);
        SFX.knock(); setTimeout(() => SFX.knock(), 260); setTimeout(() => SFX.knock(), 520);
        break;
    }
  },
  onSnap(m) {
    const j = m.j;
    Joury.net = { x: j[0], z: j[1], yaw: j[2], state: j[3], enraged: !!j[4], moving: !!j[5], speed: j[6], reveal: !!j[7], stunT: j[8] };
    m.p.forEach((a) => {
      const p = this.players.get(a[0]); if (!p) return;
      p.kids = a[9]; p.caught = a[10];
      if (p.local) return;
      p.x = a[1]; p.z = a[2]; p.yaw = a[3]; p.pitch = a[4]; p.lightOn = !!a[5]; p.crouching = !!a[6]; p.mv = a[7]; p.where = a[8];
    });
    this.applyWorld(m.w);
  },
  // The host's word on the island is final: catch up on anything this player missed (late join, a dropped message).
  applyWorld(w) {
    if (Game.state === 'title' || Game.state === 'ending' || !this.started) return;
    World.kids.forEach((kid, i) => { if ((w.k >> i & 1) && !kid.saved) Game.applyRescue(i, null, false, true); });
    if (w.ph && Game.phase !== 'boat') Game.startBoatPhase(true);
    World.batteries.forEach((b, i) => { if ((w.b >> i & 1) && !b.taken) Game.hideBattery(b); });
    w.pt.forEach((by, i) => {
      const pt = World.parts[i]; if (!pt) return;
      if (by && !pt.taken) Game.applyPart(i, by === 1 ? null : by, true);
      else if (!by && pt.taken && !World.partsDelivered.has(pt.id)) Game.dropPart(i);
    });
    PARTS.forEach((P, i) => { if ((w.dl >> i & 1) && !World.partsDelivered.has(P.id)) Game.applyDeliver([P.id], null, true); });
  },
  snapshot() {
    const J = Joury; let k = 0, b = 0, dl = 0;
    World.kids.forEach((kid, i) => { if (kid.saved) k |= 1 << i; });
    World.batteries.forEach((bt, i) => { if (bt.taken) b |= 1 << i; });
    PARTS.forEach((P, i) => { if (World.partsDelivered.has(P.id)) dl |= 1 << i; });
    return { t: 'snap',
      j: [r2(J.pos.x), r2(J.pos.z), r2(J.yaw), J.state, J.enraged ? 1 : 0, J.moving ? 1 : 0, r2(J.speed || 0), J.revealT > 0 ? 1 : 0, r2(Math.max(0, J.stunT))],
      p: [...this.players.values()].map((p) => [p.id, r2(p.x), r2(p.z), r2(p.yaw), r2(p.pitch), p.lightOn ? 1 : 0, p.crouching ? 1 : 0, p.mv, p.where, p.kids, p.caught]),
      w: { k, b, ph: Game.phase === 'boat' ? 1 : 0, pt: World.parts.map((pt) => (pt.taken ? pt.by || 1 : 0)), dl } };
  },
  // my own record, kept fresh from the local player
  refreshMe() {
    const p = this.me(); if (!p) return null;
    const P = Player, play = Game.state === 'play';
    p.where = !this.started ? 'l' : play ? 'i' : 'c';
    if (play) { p.x = P.pos.x; p.z = P.pos.z; p.yaw = P.yaw; p.pitch = P.pitch; }
    p.lightOn = P.lightOn; p.crouching = !!P.crouching; p.sprinting = !!P.sprinting; p.mv = !P.moving ? 0 : P.sprinting ? 2 : 1; p.noise = play ? P.noise || 0 : 0; p.sees = play && Joury.seen;
    return p;
  },
  // Host: everyone Joury can hunt right now (players out on the island)
  targets() { this.refreshMe(); return [...this.players.values()].filter((p) => p.where === 'i' && p.role !== 'joury'); },

  start() {
    if (!this.isHost || this.started) return;
    this.seed = (Math.random() * 0x7fffffff) | 0;
    this.players.forEach((p) => { p.kids = 0; p.caught = 0; p.where = 'i'; p.sees = false; p.noise = 0; });
    const m = { t: 'start', seed: this.seed, diff: CFG.difficulty, players: this.roster() };
    this.broadcast(m); Game.startMp(m);
  },

  // ---------------- every frame ----------------
  tick(dt) {
    if (!this.on) return;
    if (!this.started) this.players.forEach((p) => this.disposeAvatar(p)); // nobody stands around on the title screen
    if (this.started) {
      this.refreshMe();
      if (this.isHost) { if (Game.state !== 'play') Joury.thinkOnly(dt); this.fakeChat(dt); }
      this.updateAvatars(dt);
      this.sendT -= dt;
      if (this.sendT <= 0) { this.sendT = 0.08; if (this.isHost) this.broadcast(this.snapshot()); else this.send(this.hostConn, this.stateMsg()); }
    }
  },
  stateMsg() { const p = this.me() || {}; return { t: 'st', x: r2(p.x || 0), z: r2(p.z || 0), yaw: r2(p.yaw || 0), pitch: r2(p.pitch || 0), l: p.lightOn ? 1 : 0, c: p.crouching ? 1 : 0, mv: p.mv | 0, n: p.noise | 0, w: p.where === 'i' ? 'i' : 'c', s: p.sees ? 1 : 0 }; },
  // Once a second, even when the tab is in the background: keep the connection alive and notice dead ones.
  beat() {
    if (!this.on || !this.joined) return;
    const now = performance.now();
    if (this.isHost) {
      this.broadcast({ t: 'hb' });
      this.players.forEach((p) => { if (!p.local && now - p.seen > 15000) this.dropPlayer(p.id); });
      // a hidden tab stops drawing, so keep Joury thinking for everyone else
      if (document.hidden && this.started) { this.refreshMe(); for (let i = 0; i < 20; i++) Joury.thinkOnly(0.05); this.broadcast(this.snapshot()); }
    } else {
      this.send(this.hostConn, this.started ? this.stateMsg() : { t: 'hb' });
      if (now - this.lastHost > 15000) this.lost('Lost the connection to the host.');
    }
  },
  // Joury pretends to be one of your friends in the chat
  fakeChat(dt) {
    if (this.players.size < 2 || Joury.state !== 'hunt') return;
    this.fakeT -= dt; if (this.fakeT > 0) return;
    this.fakeT = rand(80, 150);
    const all = [...this.players.values()], on = all.filter((p) => p.where === 'i'); if (!on.length) return;
    const to = pick(on), pals = all.filter((p) => p !== to);
    this.emit({ e: 'fake', as: pick(pals).id, text: pick(FAKE_CHAT) }, to.id);
  },

  // ---------------- the other players, as you see them ----------------
  makeAvatar(p) {
    const skins = [0xd9a27a, 0xa8714a, 0xf0c9a0, 0x8a5a3c], hairs = [0x3b2618, 0x15120f, 0xb8862b, 0x1a1a1a];
    const c = makeHuman({ skin: skins[p.ci % 4], shirt: NET_SHIRTS[p.ci % 4], pants: 0x23262e, shoes: 0x1a1a1a, hair: hairs[p.ci % 4], face: {} });
    c.root.scale.setScalar(1.32);
    const torch = mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.12, 8), plainMat(0x1c1c1e, 0.4, 0.6)); torch.position.y = -0.03; c.handR.add(torch);
    const aim = new THREE.Group(); aim.rotation.order = 'YXZ';
    const beam = makeRemoteBeam(11, 2.6); aim.add(beam);
    const cv = makeCanvas(256, 64), g = cv.getContext('2d'); g.font = '600 30px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = Math.min(244, g.measureText(p.name).width + 30); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(128 - tw / 2, 10, tw, 44); g.fillStyle = css(p.color); g.fillText(p.name, 128, 33);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })); tag.scale.set(1.1, 0.275, 1); tag.renderOrder = 9;
    World.scene.add(c.root); World.scene.add(aim); World.scene.add(tag);
    const gi = World.glow.add(0, -50, 0, 0xfff1d6, 0, 0);
    const src = World.lights.add(0, -50, 0, 0xfff1d6, 4.5, 13, 0); src.on = false;
    return { c, aim, beam, tag, tex, gi, src, walkT: 0 };
  },
  disposeAvatar(p) {
    const a = p.av; if (!a) return; p.av = null;
    World.scene.remove(a.c.root); World.scene.remove(a.aim); World.scene.remove(a.tag);
    a.tex.dispose(); a.tag.material.dispose(); a.beam.material.dispose(); a.beam.geometry.dispose();
    if (a.gi >= 0) World.glow.setSize(a.gi, 0);
    a.src.on = false; const i = World.lights.sources.indexOf(a.src); if (i >= 0) World.lights.sources.splice(i, 1);
  },
  updateAvatars(dt) {
    const cam = World.cam.position;
    this.players.forEach((p) => {
      if (p.local) return;
      if (!p.av) { p.av = this.makeAvatar(p); p.cx = p.x; p.cz = p.z; p.cyaw = p.yaw; p.cpitch = p.pitch; }
      const a = p.av, show = p.where === 'i' && p.role !== 'joury'; // VIP Joury is drawn as Joury himself
      a.c.root.visible = a.aim.visible = a.tag.visible = show; a.src.on = show && p.lightOn;
      if (!show) { if (a.gi >= 0) World.glow.setSize(a.gi, 0); p.cx = p.x; p.cz = p.z; return; }
      const k = 1 - Math.exp(-12 * dt);
      if (Math.hypot(p.x - p.cx, p.z - p.cz) > 8) { p.cx = p.x; p.cz = p.z; } else { p.cx += (p.x - p.cx) * k; p.cz += (p.z - p.cz) * k; }
      p.cyaw += angDiff(p.cyaw, p.yaw) * k; p.cpitch += (p.pitch - p.cpitch) * k;
      const y = World.surfaceY(p.cx, p.cz), R = a.c.root, fx = -Math.sin(p.cyaw), fz = -Math.cos(p.cyaw), eye = p.crouching ? 1.0 : 1.5;
      a.walkT += dt * (p.mv === 2 ? 11 : p.mv === 1 ? (p.crouching ? 5 : 7.5) : 0);
      animatePlayer(a.c, a.walkT, World.time, p.mv, p.crouching, p.cpitch);
      R.position.set(p.cx, y - a.c.drop * 1.32, p.cz); R.rotation.y = p.cyaw + Math.PI;
      a.aim.position.set(p.cx + fx * 0.3, y + eye - 0.32, p.cz + fz * 0.3); a.aim.rotation.set(p.cpitch, p.cyaw, 0);
      a.beam.material.uniforms.uStrength.value = p.lightOn ? 0.16 : 0;
      if (a.gi >= 0) { World.glow.set(a.gi, p.cx + fx * 0.42, y + eye - 0.3, p.cz + fz * 0.42); World.glow.setSize(a.gi, p.lightOn ? 0.2 : 0); }
      a.src.pos.set(p.cx + fx * 4.5, y + 1.3, p.cz + fz * 4.5);
      a.tag.position.set(p.cx, y + (p.crouching ? 1.5 : 1.92), p.cz); a.tag.material.opacity = clamp((30 - Math.hypot(p.cx - cam.x, p.cz - cam.z)) / 8, 0, 1) * 0.9;
    });
  },
};
setInterval(() => Net.beat(), 1000);

// How another player's body moves: walking, crouching, and aiming their flashlight where they look.
function animatePlayer(c, walkT, t, mv, crouch, pitch) {
  poseReset(c);
  if (mv) poseWalk(c, walkT, mv === 2 ? 1.15 : 0.8); else { c.torso.position.y = c.P.legH + Math.sin(t * 2 + c.walkT) * 0.006; c.armL.rotation.z = -0.08; c.head.rotation.y = Math.sin(t * 0.5 + c.walkT) * 0.15; }
  c.armR.rotation.x = -1.25 - pitch * 0.8; c.armR.rotation.z = 0.1; c.elbowR.rotation.x = -0.25;
  c.head.rotation.x = -pitch * 0.6;
  if (crouch) { const s = mv ? Math.sin(walkT) * 0.22 : 0; c.legL.rotation.x = -1.0 + s; c.legR.rotation.x = -1.0 - s; c.kneeL.rotation.x = c.kneeR.rotation.x = 2.0; c.torso.rotation.x = 0.32; c.drop = 0.276; } else c.drop = 0;
}

// ---------------------------------------------------------------------
//  LOBBY — name, host or join, room code, who is in
// ---------------------------------------------------------------------
const Lobby = {
  isOpen: false, code: '',
  setCode(c) {
    this.code = String(c || '').toUpperCase().split('').filter((ch) => NET_ALPHA.includes(ch)).join('').slice(0, NET_CODE_LEN); $('mpCode').value = this.code;
    const items = codeItems(this.code);
    $('codeSlots').innerHTML = Array.from({ length: NET_CODE_LEN }, (_, i) => { const it = items[i]; return `<div class="slot${it ? ' full' : ''}${i === items.length ? ' next' : ''}">${it ? `<span class="ico">${it[0]}</span>` : ''}</div>`; }).join('');
    $('btnJoin').disabled = this.code.length !== NET_CODE_LEN;
  },
  MSG: {
    noroom: "Couldn't find that room. Check the items and their order, and make sure the host still has their lobby open.",
    full: 'That room is full (4 players).',
    version: 'You and the host have different versions of the game. Use the same file.',
    service: "Couldn't reach the connection service. Check your internet and try again.",
    timeout: "Couldn't connect in time. Check the code and your internet, then try again.",
    browser: "This browser can't make the connection. Try a recent Chrome, Edge or Firefox.",
  },
  init() {
    $('btnTogether').addEventListener('click', () => this.open());
    $('btnLobbyBack').addEventListener('click', () => { SFX.uiClick(); this.close(true); });
    $('btnHost').addEventListener('click', () => this.host());
    $('btnJoin').addEventListener('click', () => this.join());
    $('btnStartMp').addEventListener('click', () => { SFX.uiClick(); Net.start(); });
    $('mpName').addEventListener('change', () => this.rename());
    $('mpName').addEventListener('input', () => { $('nameHint').textContent = 'Press Enter to save'; });
    $('btnVip').addEventListener('click', () => { SFX.uiClick(); const m = Net.me(); Net.setRole(!(m && m.role === 'joury')); });
    $('btnNetlost').addEventListener('click', () => { Game.screen('netlost', false); Game.toTitle(); });
    // the item picker
    const grid = $('itemGrid'); grid.innerHTML = '';
    NET_ITEMS.forEach(([icon, name], i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'item-tile'; b.title = name; b.setAttribute('aria-label', name);
      b.innerHTML = `<span class="ico">${icon}</span><span class="nm">${name}</span>`;
      b.addEventListener('click', () => { if (this.code.length < NET_CODE_LEN) { SFX.uiClick(); this.setCode(this.code + NET_ALPHA[i]); } });
      grid.appendChild(b);
    });
    $('btnClearCode').addEventListener('click', () => { SFX.uiClick(); this.setCode(''); });
    addEventListener('keydown', (e) => { if (!this.isOpen || Net.on || e.target.tagName === 'INPUT') return; if (e.code === 'Backspace') this.setCode(this.code.slice(0, -1)); if (e.code === 'Enter' && this.code.length === NET_CODE_LEN) this.join(); });
    this.setCode('');
  },
  open() {
    if (!SFX.ctx) { SFX.init(); SFX.startMusicBox(); } SFX.uiClick();
    this.isOpen = true; Game.screen('title', false); Game.screen('lobby', true);
    $('mpName').value = CFG.name || ''; this.status(''); this.render();
  },
  close(leave) { if (leave) Net.leave(); this.isOpen = false; Game.screen('lobby', false); if (Game.state === 'title') Game.screen('title', true); this.busy(false); },
  name() { const n = cleanName($('mpName').value); $('mpName').value = n; CFG.name = n; saveSettings(); if ($('optName')) $('optName').value = n; return n; },
  rename() {
    const n = this.name(); $('nameHint').textContent = 'Saved'; setTimeout(() => { $('nameHint').textContent = 'You can change it any time'; }, 1600);
    if (Net.on && Net.joined) Net.rename(n);
  },
  status(text, bad) { const el = $('lobbyStatus'); el.textContent = text; el.classList.toggle('bad', !!bad); },
  busy(on) { ['btnHost', 'btnJoin'].forEach((id) => { $(id).disabled = on; }); },
  host() {
    SFX.uiClick(); this.busy(true); this.status('Opening a room…');
    Net.host(this.name(), (err) => { this.busy(false); if (err) { Net.leave(); this.status(this.MSG[err] || this.MSG.service, true); this.render(); return; } this.status(''); this.render(); });
  },
  join() {
    SFX.uiClick();
    this.setCode($('mpCode').value || this.code); const code = this.code;
    if (code.length !== NET_CODE_LEN) { this.status('Pick the 5 items your host is showing, in the same order.', true); return; }
    this.busy(true); this.status('Connecting…');
    Net.join(code, this.name(), (err, m) => {
      this.busy(false);
      if (err) { this.status(this.MSG[err] || this.MSG.service, true); this.render(); return; }
      this.status(''); this.render();
      if (m.started) Game.startMp(m); // the game is already running: jump in
    });
  },
  render() {
    if (!$('lobby')) return;
    const room = Net.on && Net.joined && (Net.isClient || !!Net.code && Net.peer && Net.peer.open);
    $('lobby').classList.toggle('room', !!room);
    if (!room) return;
    const rc = codeItems(Net.code).map(([icon, name]) => `<div class="code-item"><span class="ico">${icon}</span><span class="nm">${name}</span></div>`).join('');
    if ($('roomCode').dataset.code !== Net.code) { $('roomCode').dataset.code = Net.code; $('roomCode').innerHTML = rc; $('roomCode').setAttribute('aria-label', 'Join code: ' + codeWords(Net.code)); }
    const list = [...Net.players.values()], host = list.find((p) => p.id === 'h');
    $('roomHelp').textContent = Net.isHost ? `Tell your friends: ${codeWords(Net.code)}. They choose Play Together, tap the same items in order and press Confirm.` : `Waiting for ${host ? host.name : 'the host'} to start the game…`;
    let h = list.map((p) => `<div class="${p.role === 'joury' ? 'is-joury' : ''}"><i style="background:${css(p.color)}"></i>${esc(p.name)}${p.role === 'joury' ? ' <em class="vip-title">👑 VIP · JOURY</em>' : ''}<span>${p.id === 'h' ? 'host' : ''}${p.local ? (p.id === 'h' ? ' · you' : 'you') : ''}</span></div>`).join('');
    const me = Net.me(), jp = Net.jouryPlayer();
    $('btnVip').hidden = !Perks.has('vip');
    $('btnVip').disabled = !!jp && jp !== me;
    $('btnVip').textContent = me && me.role === 'joury' ? '👑 PLAY AS A SURVIVOR INSTEAD' : jp ? `👑 ${jp.name.toUpperCase()} IS JOURY` : '👑 PLAY AS JOURY (VIP)';
    for (let i = list.length; i < NET_MAX; i++) h += '<div class="empty">open seat</div>';
    $('lobbyPlayers').innerHTML = h;
    $('btnStartMp').style.display = Net.isHost ? '' : 'none';
    $('btnStartMp').textContent = list.length > 1 ? `START · ${list.length} PLAYERS` : 'START';
  },
};
