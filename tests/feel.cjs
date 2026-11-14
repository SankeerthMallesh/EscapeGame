// Shooter-style feel: hands on screen, jump, aim (right mouse), slide, compass strip.
const { chromium } = require('playwright'); const path = require('path');
const results = []; let fails = 0; const check = (n, ok, x = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const logs = [];
  p.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message + (e.stack || '').slice(0, 300))); p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'escape-from-joury.html') + (process.env.EFJ_NORENDER ? '?norender' : '')); await p.waitForFunction(() => window.EFJ && EFJ.state === 'title', null, { timeout: 180000 });
  const run = (c) => p.evaluate((x) => EFJ.run(x), c), until = (e, ms = 15000) => p.waitForFunction((x) => { try { return EFJ.run(x); } catch (er) { return false; } }, e, { timeout: ms, polling: 50 }).then(() => true).catch(() => false);
  await p.click('#btnPlay'); await p.waitForTimeout(300); await p.click('#btnSkip'); await until("Game.state === 'play'");
  await run('EFJ.holdJoury(1e9); Game.fadeIn = 0; EFJ.teleport(-20, 100, 0)');
  check('your hands are on screen', await until('VM.visible && VM.built'));
  await until('Game.stats.time > 1.5', 30000); // headless browsers run the first seconds very slowly
  await p.keyboard.down('Space'); check('Space jumps', await until('Player.jumpY > 0.2', 8000)); await p.keyboard.up('Space');
  check('…and you land', await until('Player.jumpY === 0 && Player.vy === 0', 5000));
  await p.mouse.move(640, 360); await p.mouse.down({ button: 'right' });
  check('right mouse aims', await until('Player.aiming && Player.aimK > 0.8 && World.cam.fov < 60', 5000), 'fov ' + await run('World.cam.fov.toFixed(0)'));
  check('aiming focuses the beam', await run('Game.worldFlash.angle < Game.worldFlash.userData.angle0 * 0.7'));
  await p.mouse.up({ button: 'right' }); check('let go to stop aiming', await until('!Player.aiming && Player.aimK < 0.2', 5000));
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await until('Player.sprinting', 3000);
  await p.keyboard.press('KeyC'); check('C while sprinting slides', await until('Player.slideT > 0', 2000));
  check('slide drops the camera', await until('Player.eye < 1.4', 2000));
  await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft');
  check('compass strip draws', await p.evaluate(() => { const c = document.getElementById('compass'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n > 500 && getComputedStyle(c).display !== 'none'; }));
  await run("Game.playHouse ? 0 : 0"); await run('Game.toTitle()'); await p.click('#btnHouse'); await p.waitForTimeout(300); await p.click('#btnSkip'); await until("Game.state === 'house'");
  check('no compass in the house', await p.evaluate(() => getComputedStyle(document.getElementById('compass')).display === 'none'));
  await run('Game.fadeIn = 0'); check('hands in the house too', await until('VM.visible'));
  console.log(results.join('\n')); console.log('--- errors ---\n' + logs.join('\n')); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e.message); process.exit(1); });
