// Admin panel in Joury's House (story 2), and the player standing still while the panel is open.
const { chromium } = require('playwright'); const path = require('path');
const results = []; let fails = 0; const check = (n, ok, x = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] }); const p = await b.newPage({ viewport: { width: 1280, height: 760 } }); const logs = [];
  p.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'escape-from-joury.html') + '?norender'); await p.waitForFunction(() => window.EFJ && EFJ.state === 'title', null, { timeout: 180000 });
  const run = (c) => p.evaluate((x) => EFJ.run(x), c), until = (e, ms = 15000) => p.waitForFunction((x) => { try { return EFJ.run(x); } catch (er) { return false; } }, e, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  const click = (label) => p.click(`#adminBody .adm-btn:text-is("${label}")`);
  await run("Perks.redeem('ADMIN')"); await p.click('#btnHouse'); await p.waitForTimeout(300); await p.click('#btnSkip'); await until("Game.state === 'house'");
  await p.keyboard.press('F8'); check('F8 opens the panel in the house', await run('Admin.open'));
  await p.waitForTimeout(400); check('house info shows', (await p.textContent('#adminInfo')).includes('Gabe'));
  const z0 = await run('Player.pos.z'); await p.keyboard.down('KeyW'); await p.waitForTimeout(800); await p.keyboard.up('KeyW');
  check('you stand still while the panel is open', Math.abs((await run('Player.pos.z')) - z0) < 0.05);
  await click('Shed'); check('teleport to the shed', await until('Math.hypot(Player.pos.x - 9.5, Player.pos.z + 14.8) < 0.5'));
  await click('Get crowbar + key'); check('get crowbar and key', await run('House.s.crowbar && House.s.key'));
  await click('Open every door'); check('open every door', await run('House.s.boardsOff && House.s.unlocked && House.doors.front.open'));
  await click('Joury: go patrol'); check('Joury patrols', await until("House.j.state === 'patrol'"));
  await click('Joury: stay at his PC'); check('Joury goes back to his PC', await until("House.j.state === 'sit'"));
  await click('Free Gabe'); check('free Gabe', await run('House.gabeS.follow'));
  await click('Shed'); check('island buttons explain they are for the island', await (async () => { await click('Dock & boat'); return (await p.textContent('#adminMsg')).includes('island story'); })());
  await click('Escape with Gabe (win)'); check('escape with Gabe', await until("Game.state === 'hend'"));
  console.log(results.join('\n')); console.log('--- errors ---\n' + logs.join('\n')); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e.message); process.exit(1); });
