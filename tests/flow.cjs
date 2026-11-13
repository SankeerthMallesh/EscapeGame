const L = require('./lib.cjs');
const S = L.SHOTS;
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
(async () => {
  const { browser, page, logs } = await L.open(); global.__logs = logs;
  const info = () => L.info(page);
  const shot = (n) => page.screenshot({ path: S + n + '.png' });
  const wait = (ms) => page.waitForTimeout(ms);
  const waitState = (st, ms = 30000) => page.waitForFunction((st) => EFJ.state === st, st, { timeout: Math.max(ms, 90000) }).then(() => true).catch(() => false);
  const until = (expr, ms = 45000) => page.waitForFunction((e) => EFJ.run(e), expr, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  await wait(1500); await shot('f00_title');
  check('title screen', (await info()).state === 'title');
  // ---- story ----
  await page.click('#btnPlay'); await wait(300);
  check('story starts', (await info()).state === 'story');
  for (let i = 0; i < 6; i++) {
    await wait(i === 1 ? 4200 : i === 2 ? 2600 : 3000);
    await shot('f0' + (i + 1) + '_story');
    const lbl = await page.textContent('#storyLabel');
    check('story slide ' + (i + 1), lbl.startsWith(String(i + 1)), lbl);
    await page.keyboard.press('Space'); await wait(150); await page.keyboard.press('Space'); await wait(200);
  }
  check('game starts after story', await waitState('play', 5000));
  await page.evaluate(() => EFJ.holdJoury(9999));
  await wait(1500); await shot('f10_game');
  // ---- movement ----
  const p0 = (await info()).player;
  await page.keyboard.down('KeyW'); await until('Math.hypot(Player.pos.x - 0, Player.pos.z - World.dock.start.z) > 1.5', 30000); await page.keyboard.up('KeyW');
  const p1 = (await info()).player;
  check('W moves player', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, JSON.stringify([p0, p1]));
  await page.keyboard.press('KeyF'); await wait(300); check('F toggles flashlight', await page.evaluate(() => EFJ.run('Player.lightOn')) === false); await page.keyboard.press('KeyF');
  // ---- map ----
  await page.keyboard.press('KeyM'); await wait(800); await shot('f11_bigmap'); check('big map opens', await page.evaluate(() => document.getElementById('bigmap').classList.contains('on'))); await page.keyboard.press('KeyM');
  // ---- rescue a kid ----
  await page.evaluate(() => EFJ.nearKid(3)); await wait(1500); await shot('f12_kid');
  const prompt = await page.textContent('#prompt'); check('kid prompt shows', /Free the/.test(prompt), prompt);
  await page.keyboard.press('KeyE'); await wait(600);
  check('kid rescued via E', (await info()).saved === 1);
  await wait(1200); await shot('f13_rescued');
  // ---- Joury in view ----
  await page.evaluate(() => EFJ.teleport(-20, 100, 0.5)); await wait(300);
  await page.evaluate(() => EFJ.jouryAhead(9)); await wait(900); await shot('f14_joury');
  const ji = (await info()).joury; check('Joury seen raises stare', ji.stare > 0, JSON.stringify(ji));
  // stare until caught
  check('staring gets you caught', await waitState('caught', 9000));
  await until('Game.caughtT > 0.35'); await shot('f15_jumpscare');
  await until('Game.caughtT > 2.3'); await shot('f16_caught');
  check('cabin after caught', await waitState('cabin', 8000));
  await wait(1500); await shot('f17_wake');
  await page.evaluate(() => EFJ.skipWake()); await until('Cabin.wakeT <= 0 && Player.frozen === false'); await wait(300);
  // ---- cabin puzzle chain (real interactions, aiming the camera) ----
  const use = async (id, name) => { await page.evaluate((id) => EFJ.aimCabin(id), id); await wait(250); const pr = await page.textContent('#prompt'); await page.keyboard.press('KeyE'); await wait(400); if (name) await shot(name); const open = await page.evaluate(() => document.getElementById('inspect').classList.contains('on')); if (open) { await page.keyboard.press('KeyE'); await wait(200); } return pr; };
  await page.evaluate(() => EFJ.walkCabin(-1.6, -1.2)); await use('note', 'f18_note');
  await use('monitor', 'f19_monitor');
  await page.evaluate(() => EFJ.walkCabin(2.2, -0.6)); console.log('redbook prompt:', await use('redbook', 'f20_redbook'));
  await until('Cabin.anim.length === 0'); await use('compartment', 'f21_key');
  await page.evaluate(() => EFJ.walkCabin(2.4, -1.4)); await use('chest', 'f22_chest');
  let ci = (await info()).cabin; check('key + chest + UV', ci.s.keyTaken && ci.s.chestOpen && ci.s.uvTaken, JSON.stringify(ci.s));
  await page.keyboard.press('KeyF'); await wait(200);
  await page.evaluate(() => EFJ.walkCabin(1.6, 0.8)); await page.evaluate(() => EFJ.aimCabin('poster')); await until('Cabin.s.uvFound', 20000); await wait(400); await shot('f23_uv');
  ci = (await info()).cabin; check('UV reveals digit 4', ci.s.uvFound, JSON.stringify(ci.found));
  check('all 4 digits found', ci.found.every(Boolean), JSON.stringify(ci.found));
  await page.keyboard.press('KeyF'); await page.keyboard.press('KeyF');
  await page.evaluate(() => EFJ.walkCabin(1.7, -1.5)); await wait(600); await page.evaluate(() => EFJ.aimCabin('keypad')); await until("(Cabin.aimed()||{}).id === 'keypad'", 10000); await page.keyboard.press('KeyE'); await until("document.getElementById('keypad').classList.contains('on')", 10000);
  check('keypad opens', await page.evaluate(() => document.getElementById('keypad').classList.contains('on')));
  const t0 = (await info()).cabin.timer; const wrong = ci.digits === '0000' ? '1111' : '0000';
  for (const d of wrong) await page.keyboard.press('Digit' + d);
  await until('Cabin.timer < ' + (t0 - 5), 10000); await shot('f24_wrong');
  const t1 = (await info()).cabin.timer; check('wrong code costs time', t0 - t1 >= 10, `${t0} -> ${t1}`);
  await until("document.getElementById('kpDisplay').textContent.includes('_')", 10000);
  for (const d of ci.digits) await page.keyboard.press('Digit' + d);
  await until('Cabin.doorT > 0.8', 20000); await shot('f25_open');
  check('correct code escapes', await waitState('play', 30000));
  await wait(1200); await shot('f26_escaped');
  ci = await info(); check('Joury stunned after escape', ci.joury.state === 'stunned', JSON.stringify(ci.joury));
  // ---- timeout path ----
  await page.evaluate(() => EFJ.catchNow()); check('caught again', await waitState('cabin', 9000));
  await page.evaluate(() => { EFJ.skipWake(); }); await until('Cabin.wakeT <= 0'); await page.evaluate(() => EFJ.setCabinTimer(25)); await wait(2500); await shot('f27_lowtime');
  await page.evaluate(() => EFJ.setCabinTimer(1)); check('timer runs out', await waitState('timeout', 6000)); await wait(300); await shot('f28_timeout');
  await page.click('#btnRetry'); check('retry returns to cabin', await waitState('cabin', 3000));
  await page.evaluate(() => EFJ.skipWake()); await until('Cabin.wakeT <= 0 && Player.frozen === false');
  const dg = (await info()).cabin.digits; await page.evaluate(() => EFJ.walkCabin(1.7, -1.5)); await wait(600); await page.evaluate(() => EFJ.aimCabin('keypad')); await until("(Cabin.aimed()||{}).id === 'keypad'", 10000); await page.keyboard.press('KeyE'); await until("document.getElementById('keypad').classList.contains('on')", 10000);
  for (const d of dg) await page.keyboard.press('Digit' + d);
  check('escape again', await waitState('play', 30000));
  // ---- boat phase ----
  await page.evaluate(() => { EFJ.rescueAll(); EFJ.holdJoury(9999); }); await wait(2500); await shot('f29_boatphase');
  ci = await info(); check('boat phase with 4 parts', ci.phase === 'boat' && ci.parts.length === 4, JSON.stringify(ci.parts));
  for (let i = 0; i < 4; i++) { await page.evaluate((i) => EFJ.nearPart(i), i); await wait(700); if (i === 0) await shot('f30_part'); await page.keyboard.press('KeyE'); await wait(300); }
  ci = await info(); check('all parts picked up', ci.parts.every((p) => p.taken));
  await page.evaluate(() => EFJ.toDock()); await wait(800); await page.keyboard.press('KeyE'); await wait(800); await shot('f31_boat');
  ci = await info(); check('parts delivered', ci.delivered.length === 4, JSON.stringify(ci.delivered));
  await page.keyboard.press('KeyE'); check('launch → ending', await waitState('ending', 3000));
  await until('Game.endT > 3'); await shot('f32_ending'); await until('Game.endT > 6.5'); await shot('f33_rematch');
  await until('Game.endT > 17'); await wait(3000); await shot('f34_epilogue'); await wait(9000); await shot('f35_stats');
  const stats = await page.textContent('#endStats'); check('stats shown', /Times caught\s*2/.test(stats), stats);
  await page.click('#btnAgain'); check('play again → title', await waitState('title', 3000));
  console.log('fps', await page.evaluate(() => EFJ.fps), 'errors', await page.evaluate(() => EFJ.errors));
  console.log(results.join('\n'));
  console.log('--- console ---\n' + logs.join('\n'));
  await browser.close();
})().catch((e) => { console.log(results.join('\n')); console.error('FLOW CRASH', e); console.log('--- console ---\n' + (global.__logs || []).join('\n')); process.exit(1); });
