// Soak test: play the game many times with random inputs, as fast as possible (no drawing),
// and report every error, broken value (NaN) and stuck state. RUNS=1000 node tests/soak.cjs
const { chromium } = require('playwright'); const path = require('path');
const RUNS = +process.env.RUNS || 1000, BATCH = 1; // one game per call, with a pause between, like real play
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } }); const pageErrors = [];
  p.on('pageerror', (e) => pageErrors.push(e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' ').trim()));
  await p.goto('file://' + path.resolve(__dirname, '..', 'escape-from-joury.html') + '?norender'); await p.waitForFunction(() => window.EFJ && EFJ.state === 'title', null, { timeout: 180000 });
  await p.evaluate(() => EFJ.run(`window.__soak = (runIndex) => {
    const R = Math.random, pick = (a) => a[Math.floor(R() * a.length)], dt = 0.05, out = { errors: [], flags: [], outcome: null };
    const fin = (v) => Number.isFinite(v);
    const press = (code) => { Input.hit.add(code); try { Game.onKey({ code, key: code, preventDefault() {}, target: document.body }); } catch (e) { out.errors.push('onKey ' + code + ': ' + e.message + ' @ ' + (e.stack || '').split('\\n')[1]); } };
    const step = () => { try { FogU.uTime.value += dt; Game.frame(dt); Net.tick(dt); Admin.update(dt); } catch (e) { out.errors.push((Game.state) + ': ' + e.message + ' @ ' + (e.stack || '').split('\\n')[1]); } HUD.update(dt); Input.endFrame(); };
    const look = (tx, ty, tz, cam) => { const c = cam.position, dx = tx - c.x, dy = ty - c.y, dz = tz - c.z; Player.yaw = Math.atan2(-dx, -dz); Player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); Player.applyCam(); };
    Game.toTitle(); Input.keys.clear(); Input.rmb = false;
    const mode = R() < 0.55 ? 'island' : 'house';
    if (mode === 'island') Game.play(); else Game.playHouse();
    if (R() < 0.15) { for (let i = 0; i < 60; i++) step(); press('Space'); for (let i = 0; i < 40; i++) step(); }
    Game.startGame(); Game.fadeIn = 0;
    if (mode === 'island' && R() < 0.15) EFJ.rescueAll(); // sometimes start at the boat phase
    if (R() < 0.3) { CFG.difficulty = pick(['easy', 'normal', 'nightmare']); }
    const frames = Math.floor((40 + R() * 50) / dt); let held = new Set(), caughtT = 0, storyT = 0, cabinT = 0, lastState = '';
    for (let f = 0; f < frames; f++) {
      const st = Game.state;
      if (f % 10 === 0) { // change what is held every half second
        held.forEach((k) => Input.keys.delete(k)); held.clear();
        if (R() < 0.7) held.add('KeyW'); if (R() < 0.25) held.add(pick(['KeyA', 'KeyD'])); if (R() < 0.08) held.add('KeyS');
        if (R() < 0.3) held.add('ShiftLeft'); if (R() < 0.1) held.add('KeyC'); held.forEach((k) => Input.keys.add(k));
        Input.rmb = R() < 0.15;
        if (R() < 0.15) press('Space'); if (R() < 0.45) press('KeyE'); if (R() < 0.05) press('KeyF'); if (R() < 0.04) press('KeyG'); if (R() < 0.03) press('KeyQ');
        if (R() < 0.02) press('KeyM'); if (R() < 0.04 && held.has('ShiftLeft')) press('KeyC');
        if (R() < 0.01 && (st === 'play' || st === 'house' || st === 'cabin')) { Game.pause(); for (let i = 0; i < 5; i++) step(); Game.resume(); }
      }
      Input.dx = (R() - 0.5) * 60; Input.dy = (R() - 0.5) * 20;
      // every few seconds, jump to something worth doing so runs reach the deep parts of the game
      if ((st === 'play' ? f % 50 === 25 && R() < 0.85 : f % 160 === 80 && R() < 0.6)) {
        if (st === 'play') {
          const kid = World.kids.findIndex((k) => !k.saved), part = World.parts.findIndex((p) => !p.taken);
          if (Game.phase === 'kids' && kid >= 0) { EFJ.nearKid(kid); press('KeyE'); }
          else if (part >= 0) { EFJ.nearPart(part); step(); press('KeyE'); }
          else if (Game.phase === 'boat') { EFJ.toDock(); step(); press('KeyE'); step(); press('KeyE'); }
          if (R() < 0.15) Joury.timer = 0;
          if (R() < 0.05) Weather.strike(true);
        } else if (st === 'house') {
          const s = House.s, spots = [];
          if (!s.shedOpen) spots.push([9.5, -14.8, 9.5, 1.1, -16.5]); else if (!s.crowbar) spots.push([9.5, -18.6, 9.5, 0.96, -19.9]);
          else if (!s.boardsOff) spots.push([0, -8.6, 0, 1.2, -7.1]); else if (!s.key) spots.push([9.25, 5.75, 9.8, 1.66, 5.3]);
          else if (!s.unlocked) spots.push([0.9, -2.8, 2, 1.05, -2.8]); else if (!s.gabeFree) spots.push([5.6, -5.3, 7.7, 0.9, -5.3]);
          else spots.push(R() < 0.5 ? [0, 5.6, 0, 1.2, 7] : [0, 16, 0, 1.2, 20]);
          if (R() < 0.15) spots.push([-8.6, 5.75, -9.3, 1.2, 5.75]);
          const sp = pick(spots); Player.place(sp[0], sp[1], 0, 0); look(sp[2], sp[3], sp[4], House.cam); step(); press('KeyE');
          if (s.gabeFree && R() < 0.5) Player.place(0, 21.6, Math.PI, 0);
        }
      }
      if (st === 'cabin') { cabinT += dt; if (cabinT > 12 && !$('keypad').classList.contains('on') && R() < 0.05) { if (typeof Cabin.wakeT === 'number') Cabin.wakeT = 0; Game.openKeypad(); (R() < 0.2 ? [1, 2, 3, 4] : Cabin.digits).forEach((d) => HUD.kpPress(String(d))); } } else cabinT = 0;
      if (st === 'timeout' && R() < 0.2) { Game.screen('timeout', false); Game.enterCabin(false); }
      if ($('inspect').classList.contains('on') && R() < 0.3) Game.closeInspect();
      if (st === 'caught') caughtT += dt; else caughtT = 0;
      if (st === 'story') storyT += dt; else storyT = 0;
      if (caughtT > 20) { out.flags.push('stuck on the caught screen'); break; }
      if (storyT > 60) { out.flags.push('stuck in the story'); break; }
      step();
      if (f % 20 === 0) {
        const bad = [];
        if (!fin(Player.pos.x) || !fin(Player.pos.z) || !fin(Player.yaw) || !fin(Player.pitch)) bad.push('player position');
        if (!fin(Joury.pos.x) || !fin(Joury.pos.z)) bad.push('Joury position');
        if (House.j && (!fin(House.j.x) || !fin(House.j.z))) bad.push('house Joury position');
        if (House.gabeS && (!fin(House.gabeS.x) || !fin(House.gabeS.z))) bad.push('Gabe position');
        const cam = Game.state === 'house' ? House.cam : Game.state === 'cabin' ? Cabin.cam : World.cam; if (!fin(cam.position.x) || !fin(cam.position.y) || !fin(cam.fov)) bad.push('camera');
        if (!fin(Player.stamina) || !fin(Player.battery)) bad.push('stamina/battery');
        if (Game.state === 'house' && (Math.abs(Player.pos.x) > 16 || Player.pos.z < -24 || Player.pos.z > 23.6)) bad.push('outside the house map');
        if (bad.length) { out.flags.push('broken value: ' + bad.join(', ') + ' (state ' + Game.state + ')'); break; }
      }
      if (Game.state !== lastState) lastState = Game.state;
      if (Game.state === 'ending' || Game.state === 'hend' || Game.state === 'title') { for (let i = 0; i < 20; i++) step(); break; }
    }
    held.forEach((k) => Input.keys.delete(k)); Input.rmb = false;
    out.outcome = { mode, end: Game.state, kids: Game.savedCount(), parts: World.partsDelivered.size, caught: Game.stats.caught, gabe: !!(House.s && House.s.gabeFree), won: Game.state === 'ending' || Game.state === 'hend' };
    return out;
  };`));
  const errors = new Map(), flags = new Map(), outcomes = []; let done = 0; const t0 = Date.now();
  for (let i = 0; i < RUNS; i += BATCH) {
    const n = Math.min(BATCH, RUNS - i);
    const res = await p.evaluate(([start, n]) => { const r = []; for (let k = 0; k < n; k++) r.push(window.__soak(start + k)); return r; }, [i, n]); await p.waitForTimeout(120);
    res.forEach((r, k) => { done++; outcomes.push(r.outcome); r.errors.forEach((e) => { const c = errors.get(e) || { n: 0, run: i + k }; c.n++; errors.set(e, c); }); r.flags.forEach((e) => { const c = flags.get(e) || { n: 0, run: i + k }; c.n++; flags.set(e, c); }); });
    if (done % 100 === 0 || done === RUNS) console.log(`${done} runs · ${((Date.now() - t0) / 1000).toFixed(0)} s · ${errors.size} distinct errors · ${flags.size} distinct problems`);
  }
  const by = (f) => outcomes.filter(f).length;
  console.log('\n=== outcomes ===');
  console.log(`island runs ${by((o) => o.mode === 'island')} · won ${by((o) => o.mode === 'island' && o.won)} · reached the cabin at least once ${by((o) => o.mode === 'island' && o.caught > 0)} · reached the boat phase ${by((o) => o.mode === 'island' && o.kids === 10)}`);
  console.log(`house runs ${by((o) => o.mode === 'house')} · won ${by((o) => o.mode === 'house' && o.won)} · freed Gabe ${by((o) => o.mode === 'house' && o.gabe)} · caught at least once ${by((o) => o.mode === 'house' && o.caught > 0)}`);
  console.log('\n=== errors ===\n' + ([...errors].map(([e, c]) => `${c.n}× (first in run ${c.run}) ${e}`).join('\n') || 'none'));
  console.log('\n=== problems ===\n' + ([...flags].map(([e, c]) => `${c.n}× (first in run ${c.run}) ${e}`).join('\n') || 'none'));
  console.log('\n=== uncaught page errors ===\n' + (pageErrors.slice(0, 20).join('\n') || 'none'));
  await b.close();
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
