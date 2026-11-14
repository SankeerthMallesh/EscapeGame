// =====================================================================
//  HUD — kid icons, minimap, big map, prompts, subtitles, panels
// =====================================================================
const HUD = {
  toastT: 0, subT: 0, mapImg: null, kidIcons: [], kp: '', kpLock: 0, lastSaved: -1,
  init() {
    // kid icons (8x8 pixel art, drawn per costume)
    const bar = $('kidsBar'); bar.innerHTML = '';
    this.kidIcons = KID_TYPES.map((k) => { const c = makeCanvas(64, 64); c.title = k.name; bar.appendChild(c); return c; });
    this.drawKidIcons([]);
    // keypad
    const grid = $('kpGrid'); grid.innerHTML = '';
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].forEach((k) => { const b = document.createElement('button'); b.textContent = k; b.addEventListener('click', (e) => { e.stopPropagation(); this.kpPress(k); }); grid.appendChild(b); });
    $('inspect').addEventListener('click', () => Game.closeInspect());
  },
  drawKidIcons(saved) {
    KID_TYPES.forEach((k, i) => {
      const c = this.kidIcons[i], on = saved.includes(i); if (c.width !== 64) { c.width = 64; c.height = 64; }
      const g = c.getContext('2d'); g.clearRect(0, 0, 64, 64); g.save(); g.translate(32, 32);
      drawKidIcon(g, k.id, on ? KID_ICON_COL[k.id] : 'rgba(233,226,212,.32)'); g.restore();
      c.classList.toggle('saved', on);
    });
  },
  popKid(i) { const c = this.kidIcons[i]; c.classList.add('pop'); setTimeout(() => c.classList.remove('pop'), 450); },
  show(on) { $('hud').classList.toggle('on', on); },
  lookHint(on) { $('lookHint').style.display = on && (Game.state === 'play' || Game.state === 'cabin') && !Input.locked ? 'block' : 'none'; },
  toast(html, sec = 3.5) { const t = $('toast'); t.innerHTML = html; t.classList.add('on'); this.toastT = sec; },
  jourySay(text) { const s = $('subtitle'); s.className = ''; void s.offsetWidth; s.textContent = 'JOURY: ' + text; s.classList.add('on'); this.subT = 3.2; },
  kidSay(text) { const s = $('subtitle'); s.className = 'kid on'; s.textContent = text; this.subT = 3.6; },
  prompt(text) { const p = $('prompt'); const h = text ? `<b>E</b>${text}` : ''; if (p.innerHTML !== h) p.innerHTML = h; $('crosshair').classList.toggle('active', !!text); },
  objective(text) { const o = $('objective'); if (o.textContent !== text) o.textContent = text; },
  bars(stamina, battery, exhausted, showBattery = true) {
    $('stamFill').style.width = (stamina * 100).toFixed(1) + '%'; $('stamFill').classList.toggle('tired', exhausted);
    $('batFill').style.width = (battery * 100).toFixed(1) + '%'; $('batFill').classList.toggle('low', battery < 0.2); $('batPct').textContent = Math.round(battery * 100) + '%';
    $('bars').children[1].style.visibility = showBattery ? 'visible' : 'hidden';
  },
  parts(show) {
    const el = $('partsBar'); el.style.display = show ? 'flex' : 'none'; if (!show) return;
    const html = PARTS.map((p) => {
      const done = World.partsDelivered.has(p.id), carry = World.carried.has(p.id), wp = World.parts.find((q) => q.id === p.id), pal = !done && !carry && wp && wp.taken && wp.by && Net.on ? Net.nameOf(wp.by) : null;
      return `<div class="${done ? 'done' : carry || pal ? 'carry' : ''}">${done ? '✔' : carry ? '✋' : pal ? '➜' : '○'} ${p.name}${done ? ' — on the boat' : carry ? ' — carrying' : pal ? ` — ${esc(pal)} has it` : ''}</div>`;
    }).join('');
    if (el.innerHTML !== html) el.innerHTML = html;
  },
  // Online: who is playing, and who is locked in the cabin
  roster() {
    const el = $('roster'); if (!el) return;
    const h = !Net.on ? '' : [...Net.players.values()].map((p) => `<div><i style="background:${css(p.color)}"></i>${esc(p.name)}${p.local ? ' (you)' : ''}${p.role === 'joury' ? ' <em class="vip-title">👑 VIP JOURY</em>' : p.where === 'c' ? ' <b>· in the cabin</b>' : ''}</div>`).join('');
    if (this.rosterHtml !== h) { this.rosterHtml = h; el.innerHTML = h; }
  },
  stun(sec) { const el = $('stun'); if (sec > 0) { el.style.display = 'block'; el.textContent = `JOURY IS STUNNED · ${Math.ceil(sec)}`; } else el.style.display = 'none'; },
  cabinTimer(sec, digits) {
    const el = $('cabinTimer'); if (sec === null) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.classList.toggle('low', sec < 30);
    const h = `${fmtTime(sec)}<small>JOURY RETURNS · CODE ${digits}</small>`; if (el.innerHTML !== h) el.innerHTML = h;
  },
  lightHint(text) { const el = $('lightHint'); el.style.display = text ? 'block' : 'none'; if (text) el.textContent = text; },
  update(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').classList.remove('on'); }
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) $('subtitle').classList.remove('on'); }
  },

  // ---------------- maps ----------------
  buildMapImage() {
    const S = 400, c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data, ext = 160;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const wx = (x / S) * ext * 2 - ext, wz = (y / S) * ext * 2 - ext, h = World.groundAt(wx, wz), o = (y * S + x) * 4;
      let r, gg, b;
      if (h < 0.15) { const deep = clamp(-h / 3, 0, 1); r = 10 - deep * 4; gg = 22 - deep * 8; b = 34 - deep * 10; }
      else { const k = clamp(h / 7, 0, 1); r = 24 + k * 22; gg = 40 + k * 26; b = 24 + k * 12; if (h < 1.0) { r += 18; gg += 12; b += 4; } }
      if (ravineProfile(wx, wz) > 0.25) { r = 14; gg = 12; b = 12; }
      const pd = World.pathDist(wx, wz); if (pd < 1.6 && h > 0.15) { r = 112; gg = 92; b = 62; }
      if (World.onBridge(wx, wz)) { r = wz < RAVINE.z ? 190 : 50; gg = 50; b = wz < RAVINE.z ? 50 : 190; }
      if (World.onDock(wx, wz)) { r = 120; gg = 90; b = 60; }
      const n = (hash2(x, y, 3) - 0.5) * 8; d[o] = r + n; d[o + 1] = gg + n; d[o + 2] = b + n; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.mapImg = c;
  },
  w2m(x, z, size) { return [((x + 160) / 320) * size, ((z + 160) / 320) * size]; },
  drawMap(cv, size, opts) {
    const g = cv.getContext('2d', { willReadFrequently: true }), t = performance.now() / 1000, glitch = opts.glitch || 0;
    g.save(); g.clearRect(0, 0, size, size);
    if (opts.round) { g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, TAU); g.clip(); }
    g.fillStyle = '#081018'; g.fillRect(0, 0, size, size);
    if (this.mapImg) g.drawImage(this.mapImg, 0, 0, size, size);
    const k = size / 200, dot = (x, z, r, col, glow) => { const [mx, my] = this.w2m(x, z, size); g.beginPath(); g.arc(mx, my, r * k, 0, TAU); g.fillStyle = col; if (glow) { g.shadowColor = col; g.shadowBlur = glow * k; } g.fill(); g.shadowBlur = 0; return [mx, my]; };
    // landmarks
    if (opts.labels) { g.font = `bold ${Math.round(5.2 * k)}px "Courier New", monospace`; g.textAlign = 'center'; g.fillStyle = 'rgba(235,225,205,.85)'; g.shadowColor = '#000'; g.shadowBlur = 4; World.landmarks.forEach((l) => { const [mx, my] = this.w2m(l.x, l.z, size); g.fillText(l.name, mx, my - 6.5 * k); }); g.shadowBlur = 0; }
    // cabin + dock
    { const [mx, my] = this.w2m(World.cabin.x, World.cabin.z, size); g.fillStyle = '#c87a3a'; g.fillRect(mx - 4 * k, my - 4 * k, 8 * k, 8 * k); g.fillStyle = '#ffcf6a'; g.fillRect(mx + 0.5 * k, my - 1 * k, 2.5 * k, 2.5 * k); if (opts.labels) { g.fillStyle = '#ffb07a'; g.fillText("JOURY'S CABIN", mx, my + 10 * k); } }
    { const dk = World.dock, [mx, my] = this.w2m(0, (dk.z0 + dk.z1) / 2, size); g.fillStyle = '#5fc8ff'; g.fillRect(mx - 2.5 * k, my - 7 * k, 5 * k, 14 * k); if (opts.labels) { g.fillStyle = '#8fdcff'; g.fillText('DOCK', mx + 14 * k, my + 2 * k); } }
    // kids
    World.kids.forEach((kid) => { dot(kid.home.x, kid.home.z, 3.2, kid.saved ? '#4cff7a' : '#ffd23a', kid.saved ? 0 : 6); });
    // boat parts
    World.parts.forEach((p) => { if (p.taken) return; const [mx, my] = this.w2m(p.x, p.z, size); const s = 4.5 * k * (1 + Math.sin(t * 5) * 0.15); g.save(); g.translate(mx, my); g.rotate(Math.PI / 4); g.fillStyle = '#ff9c2b'; g.shadowColor = '#ff9c2b'; g.shadowBlur = 8 * k; g.fillRect(-s / 2, -s / 2, s, s); g.restore(); if (opts.labels) { g.fillStyle = '#ffc07a'; g.fillText(p.def.name, mx, my + 9 * k); } });
    // Joury
    if (Joury.state !== 'dormant') { const pulse = 3.6 + Math.sin(t * 6) * 1.2; dot(Joury.pos.x, Joury.pos.z, pulse + 2.5, 'rgba(255,0,0,.25)'); dot(Joury.pos.x, Joury.pos.z, 3.4, Joury.state === 'stunned' ? '#7fd8ff' : '#ff1a1a', 10); }
    // friends (online): a dot in their color; locked-up friends show as a ring on the cabin
    if (Net.on) {
      let locked = 0;
      Net.players.forEach((p) => {
        if (p.local || p.role === 'joury') return; const col = css(p.color);
        if (p.where === 'i') { const [mx, my] = dot(p.x, p.z, 3.1, col, 5); g.lineWidth = 1 * k; g.strokeStyle = '#fff'; g.beginPath(); g.arc(mx, my, 3.1 * k, 0, TAU); g.stroke(); if (opts.labels) { g.fillStyle = col; g.fillText(p.name, mx, my - 6 * k); } }
        else if (p.where === 'c') { const [mx, my] = this.w2m(World.cabin.x, World.cabin.z, size); g.lineWidth = 1.6 * k; g.strokeStyle = col; g.beginPath(); g.arc(mx, my, (7.5 + locked * 2.6) * k, 0, TAU); g.stroke(); locked++; }
      });
    }
    // player arrow
    { const [mx, my] = this.w2m(Player.pos.x, Player.pos.z, size), fx = -Math.sin(Player.yaw), fz = -Math.cos(Player.yaw), a = Math.atan2(fz, fx);
      g.save(); g.translate(mx, my); g.rotate(a); g.beginPath(); g.moveTo(8 * k, 0); g.lineTo(-5 * k, 4.5 * k); g.lineTo(-2.5 * k, 0); g.lineTo(-5 * k, -4.5 * k); g.closePath(); g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 3; g.fill(); g.restore(); }
    // static glitch when Joury is near
    if (glitch > 0.02) {
      const img = g.getImageData(0, 0, size, size), dd = img.data, row = size * 4, tmp = new Uint8ClampedArray(row);
      // tear a few horizontal bands sideways (done on the pixels: drawing a canvas onto itself is unreliable)
      const n = Math.floor(glitch * 14);
      for (let i = 0; i < n; i++) {
        const y0 = Math.floor(Math.random() * size), h = Math.floor(rand(2, 14) * k), dx = Math.round(rand(-18, 18) * glitch * k);
        for (let y = y0; y < Math.min(size, y0 + h); y++) { const o = y * row; tmp.set(dd.subarray(o, o + row)); for (let x = 0; x < size; x++) { const sx = clamp(x - dx, 0, size - 1) * 4, t = o + x * 4; dd[t] = tmp[sx]; dd[t + 1] = tmp[sx + 1]; dd[t + 2] = tmp[sx + 2]; } }
      }
      for (let i = 0; i < dd.length; i += 4) if (dd[i + 3] > 0 && Math.random() < glitch * 0.4) { const v = Math.random() * 255; dd[i] = v; dd[i + 1] = v * 0.9; dd[i + 2] = v * 0.9; }
      g.putImageData(img, 0, 0);
      g.fillStyle = `rgba(255,0,0,${glitch * 0.25})`; g.fillRect(0, 0, size, size);
      if (Math.random() < glitch * 0.3) { g.fillStyle = '#ff3030'; g.font = `bold ${Math.round(14 * k)}px "Courier New", monospace`; g.textAlign = 'center'; g.fillText(pick(['NOT GG', 'SIGNAL LOST', 'REMATCH', '5-4']), size / 2, size / 2 + rand(-30, 30) * k); }
    }
    g.restore();
    if (opts.round) {
      g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, TAU); g.lineWidth = 3 * k; g.strokeStyle = glitch > 0.3 ? '#ff3030' : 'rgba(220,210,190,.6)'; g.stroke();
      g.fillStyle = 'rgba(240,230,210,.85)'; g.font = `bold ${Math.round(11 * k)}px "Courier New", monospace`; g.textAlign = 'center'; g.fillText('N', size / 2, 14 * k);
    }
  },
  minimap(glitch) {
    const cv = $('minimap'), dpr = Math.min(2, window.devicePixelRatio || 1), size = Math.round(200 * dpr);
    if (cv.width !== size) { cv.width = size; cv.height = size; }
    this.drawMap(cv, size, { round: true, glitch });
  },
  bigmap(glitch) { const cv = $('bigmapCanvas'); this.drawMap(cv, cv.width, { labels: true, glitch: glitch * 0.6 }); },

  // ---------------- inspect panel ----------------
  inspect(info) {
    $('inspectTitle').textContent = info.title; $('inspectText').innerHTML = info.text;
    const box = $('inspectImg'); box.innerHTML = '';
    if (info.img) { const c = makeCanvas(info.img.width, info.img.height); c.getContext('2d').drawImage(info.img, 0, 0); box.appendChild(c); }
    else if (info.emoji) { const e = document.createElement('div'); e.className = 'emoji'; e.textContent = info.emoji; box.appendChild(e); }
    $('inspect').classList.add('on');
  },
  closeInspect() { $('inspect').classList.remove('on'); },

  // ---------------- keypad ----------------
  openKeypad() { this.kp = ''; this.kpRender(); $('keypad').classList.add('on'); },
  closeKeypad() { $('keypad').classList.remove('on'); },
  kpRender(cls) { const d = $('kpDisplay'); d.textContent = (this.kp + '____').slice(0, 4).split('').join(' '); d.className = cls || ''; },
  kpPress(k) {
    if (this.kpLock > performance.now()) return;
    if (k === 'C') { this.kp = ''; SFX.beep(600); }
    else if (k === '⌫') { this.kp = this.kp.slice(0, -1); SFX.beep(700); }
    else if (/\d/.test(k) && this.kp.length < 4) { this.kp += k; SFX.beep(800 + Number(k) * 40); }
    this.kpRender();
    if (this.kp.length === 4) {
      const ok = Cabin.tryCode(this.kp);
      this.kpLock = performance.now() + 900;
      if (ok) { $('kpDisplay').textContent = 'OPEN'; $('kpDisplay').className = 'good'; setTimeout(() => Game.closeKeypad(true), 700); }
      else { $('kpDisplay').textContent = `-${D().penalty}s`; $('kpDisplay').className = 'bad'; setTimeout(() => { this.kp = ''; this.kpRender(); }, 900); }
    }
  },
};

// Clean vector icons for the kid tracker (drawn around 0,0 in a 64px box)
const KID_ICON_COL = { ghost: '#e8eaf0', pumpkin: '#ff8a1c', witch: '#a678e0', vampire: '#e04048', skeleton: '#efe8d8', cat: '#c9c2b4', astronaut: '#bfe6ff', dino: '#6fd36f', bee: '#ffcf3a', hero: '#5a8cff' };
function drawKidIcon(g, id, col) {
  g.fillStyle = col; g.strokeStyle = col; g.lineJoin = 'round';
  const cut = (fn) => { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; fn(); g.restore(); };
  const P = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  switch (id) {
    case 'ghost': g.beginPath(); g.moveTo(-17, 20); g.lineTo(-17, -4); g.arc(0, -4, 17, Math.PI, 0); g.lineTo(17, 20); for (let i = 0; i < 4; i++) { const x = 17 - i * 8.5; g.quadraticCurveTo(x - 4.25, 13, x - 8.5, 20); } g.fill(); cut(() => { g.beginPath(); g.ellipse(-6, -4, 3.5, 5, 0, 0, TAU); g.ellipse(6, -4, 3.5, 5, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(0, 8, 3, 4, 0, 0, TAU); g.fill(); }); break;
    case 'pumpkin': g.beginPath(); g.ellipse(0, 4, 21, 17, 0, 0, TAU); g.fill(); g.fillRect(-2.5, -20, 5, 9); cut(() => { P([[-12, -2], [-6, -2], [-9, -8]]); P([[12, -2], [6, -2], [9, -8]]); g.beginPath(); g.moveTo(-13, 7); g.quadraticCurveTo(0, 20, 13, 7); g.lineTo(8, 10); g.lineTo(4, 7); g.lineTo(0, 11); g.lineTo(-4, 7); g.lineTo(-8, 10); g.closePath(); g.fill(); }); break;
    case 'witch': P([[0, -24], [-12, 10], [12, 10]]); g.beginPath(); g.ellipse(0, 12, 24, 5, 0, 0, TAU); g.fill(); cut(() => g.fillRect(-11, 3, 22, 3)); break;
    case 'vampire': g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(-8, -14, -14, -10); g.quadraticCurveTo(-20, -18, -26, -8); g.quadraticCurveTo(-22, 0, -24, 8); g.quadraticCurveTo(-16, 2, -12, 10); g.quadraticCurveTo(-6, 4, 0, 12); g.quadraticCurveTo(6, 4, 12, 10); g.quadraticCurveTo(16, 2, 24, 8); g.quadraticCurveTo(22, 0, 26, -8); g.quadraticCurveTo(20, -18, 14, -10); g.quadraticCurveTo(8, -14, 0, -6); g.fill(); P([[-4, -6], [-6, -13], [-2, -8]]); P([[4, -6], [6, -13], [2, -8]]); break;
    case 'skeleton': g.beginPath(); g.arc(0, -4, 17, 0, TAU); g.fill(); g.fillRect(-9, 8, 18, 12); cut(() => { g.beginPath(); g.ellipse(-7, -4, 5, 6, 0, 0, TAU); g.ellipse(7, -4, 5, 6, 0, 0, TAU); g.fill(); P([[0, 2], [-3, 8], [3, 8]]); for (let x = -6; x <= 6; x += 4) g.fillRect(x - 0.8, 12, 1.6, 8); }); break;
    case 'cat': g.beginPath(); g.arc(0, 4, 17, 0, TAU); g.fill(); P([[-16, -2], [-15, -22], [-4, -12]]); P([[16, -2], [15, -22], [4, -12]]); cut(() => { g.beginPath(); g.ellipse(-7, 2, 3, 5, 0, 0, TAU); g.ellipse(7, 2, 3, 5, 0, 0, TAU); g.fill(); P([[-2.5, 9], [2.5, 9], [0, 12]]); }); break;
    case 'astronaut': g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill(); cut(() => { g.beginPath(); g.moveTo(-14, -6); g.quadraticCurveTo(0, -14, 14, -6); g.quadraticCurveTo(15, 8, 0, 9); g.quadraticCurveTo(-15, 8, -14, -6); g.fill(); }); g.globalAlpha = 0.5; g.beginPath(); g.arc(-6, -4, 2.5, 0, TAU); g.fill(); g.globalAlpha = 1; g.fillRect(-12, 17, 24, 5); break;
    case 'dino': g.beginPath(); g.moveTo(-18, 18); g.lineTo(-18, -2); g.quadraticCurveTo(-16, -16, 0, -16); g.quadraticCurveTo(18, -16, 22, -2); g.quadraticCurveTo(24, 8, 10, 8); g.lineTo(-6, 8); g.lineTo(-6, 18); g.closePath(); g.fill(); P([[-12, -12], [-8, -22], [-4, -15]]); P([[-2, -16], [2, -25], [6, -16]]); P([[8, -15], [13, -22], [14, -12]]); cut(() => { g.beginPath(); g.arc(6, -6, 3, 0, TAU); g.fill(); for (let x = -2; x < 18; x += 5) P([[x, 8], [x + 2.5, 4], [x + 5, 8]]); }); break;
    case 'bee': g.globalAlpha = 0.55; g.beginPath(); g.ellipse(-8, -14, 8, 11, -0.5, 0, TAU); g.ellipse(8, -14, 8, 11, 0.5, 0, TAU); g.fill(); g.globalAlpha = 1; g.beginPath(); g.ellipse(0, 6, 15, 17, 0, 0, TAU); g.fill(); cut(() => { g.fillRect(-16, 0, 32, 4); g.fillRect(-16, 9, 32, 4); }); g.lineWidth = 2; g.beginPath(); g.moveTo(-4, -10); g.lineTo(-9, -22); g.moveTo(4, -10); g.lineTo(9, -22); g.stroke(); break;
    case 'hero': g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 22, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r + 2); } g.closePath(); g.fill(); break;
  }
}
