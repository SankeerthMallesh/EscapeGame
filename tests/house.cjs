// Story 2, Joury's House: the whole puzzle from the sidewalk to the front gate with Gabe.
const { chromium } = require('playwright'); const path = require('path');
const results = []; let fails = 0;
const check = (n, ok, x = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } }); const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').slice(0, 400)));
  await page.goto('file://' + path.resolve(__dirname, '..', 'escape-from-joury.html') + (process.env.EFJ_NORENDER ? '?norender' : '')); await page.waitForFunction(() => window.EFJ && EFJ.state === 'title', null, { timeout: 180000 });
  const run = (c) => page.evaluate((x) => EFJ.run(x), c);
  const until = (e, ms = 30000) => page.waitForFunction((x) => { try { return EFJ.run(x); } catch (er) { return false; } }, e, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  // stand at x,z and look at a point
  const look = (x, z, tx, ty, tz) => run(`(() => { Player.place(${x}, ${z}, 0, 0); const c = House.cam.position, dx = ${tx} - c.x, dy = ${ty} - c.y, dz = ${tz} - c.z; Player.yaw = Math.atan2(-dx, -dz); Player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); Player.applyCam(); })()`);
  const press = async (label) => { await page.keyboard.press('KeyE'); await page.waitForTimeout(250); };

  await page.click('#btnHouse');
  check('story 2 slides start', await until("Game.state === 'story' && Story.slides === HOUSE_SLIDES"), await page.textContent('#storyLabel'));
  check('slide 1 is about the phonk', (await page.textContent('#storyLabel')).includes('PHONK'));
  check('slide 1 text is the new story', await until("document.getElementById('storyText').textContent.startsWith('A week after the rematch')", 8000), await page.textContent('#storyText'));
  await page.click('#btnSkip');
  check("the house level starts", await until("Game.state === 'house'"));
  check('you start on the sidewalk', await run('Player.pos.z > 21'));
  check('Joury is sitting at his PC', (await run('House.j.state')) === 'sit');
  check('the objective points to the shed', await until("document.getElementById('objective').textContent.includes('shed')", 5000));
  await page.waitForTimeout(800);
  check('his music is playing', await run('Phonk.vol > 0'));
  // front door from outside
  await look(0, 8.6, 0, 1.2, 7); check('front door prompt', await until("House.aimed() && House.aimed().id === 'frontdoor'"));
  await press(); check('front door is locked from outside', (await page.textContent('#inspectText')).includes('not the way in')); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // shed + crowbar
  await look(9.5, -14.8, 9.5, 1.1, -16.5); await until("House.aimed() && House.aimed().id === 'sheddoor'"); await press();
  check('the shed opens', await until('House.s.shedOpen'));
  await look(9.5, -18.6, 9.5, 0.96, -19.9); check('crowbar prompt', await until("House.aimed() && House.aimed().id === 'crowbar'")); await press();
  check('you get the crowbar', await run('House.s.crowbar') && (await page.textContent('#partsBar')).includes('Crowbar'));
  // back door
  await look(0, -8.6, 0, 1.2, -7.1); await until("House.aimed() && House.aimed().id === 'backdoor'"); await press();
  check('prying the boards off opens the back door', await until('House.s.boardsOff && House.doors.back.open', 15000));
  check('the noise makes Joury get up', await until("House.j.state === 'investigate' || House.j.state === 'patrol' || House.j.state === 'chase'", 10000), await run('House.j.state'));
  check('he walks through the house', await until('Math.hypot(House.j.x - 8.2, House.j.z - 3.1) > 1.5', 15000), await run('JSON.stringify([House.j.x.toFixed(1), House.j.z.toFixed(1), House.j.state])'));
  // he goes back to his chair eventually: put him there for the next part
  await run("Object.assign(House.j, { state: 'sit', x: 8.2, z: 3.1, sitT: 999, path: [] })");
  // sneak in for the key, crouching, right behind his chair
  await page.keyboard.down('KeyC');
  await look(9.25, 5.75, 9.8, 1.66, 5.3); check('key prompt', await until("House.aimed() && House.aimed().id === 'key'")); await press();
  await page.keyboard.up('KeyC');
  check('you get the key without waking him', (await run('House.s.key')) && (await run('House.j.state')) === 'sit');
  // he catches you and throws you out
  await run("EFJ.run('0'); Player.place(5, 3, Math.PI / 2, 0); Object.assign(House.j, { state: 'chase', x: 5.6, z: 3, path: [] })");
  check('getting caught: jump scare', await until('House.caughtT >= 0', 5000));
  check('…then thrown out on the lawn', await until("House.caughtT < 0 && Player.pos.z > 17", 10000));
  check('you keep the key', await run('House.s.key && House.s.crowbar'));
  check('Joury is back at his PC', (await run('House.j.state')) === 'sit');
  // hiding works
  await look(-8.6, 5.75, -9.3, 1.2, 5.75); await until("House.aimed() && House.aimed().id === 'wardrobe'"); await press();
  check('you can hide in the wardrobe', await run("House.hidden === 'wardrobe' && document.getElementById('hideOverlay').classList.contains('on')"));
  await run("Object.assign(House.j, { state: 'chase', x: -6, z: 2.5, path: [], lastSeen: { x: -8, z: 5.7 }, sawHide: 0 })");
  await page.waitForTimeout(2500);
  check('hidden: he cannot see you', (await run('House.caughtT')) < 0 && !(await run('House.canSee()')));
  await press(); check('E brings you out', await run('House.hidden === null'));
  await run("Object.assign(House.j, { state: 'sit', x: 8.2, z: 3.1, sitT: 999, path: [] })");
  // unlock Gabe's room and free him
  await look(0.9, -2.8, 2, 1.05, -2.8); check('padlock prompt', await until("House.aimed() && House.aimed().id === 'beddoor'")); await press();
  check("Gabe's door unlocks", await until('House.s.unlocked && House.doors.bedroom.open'));
  await look(5.6, -5.3, 7.7, 0.9, -5.3); check('Gabe prompt', await until("House.aimed() && House.aimed().id === 'gabe'")); await press();
  check('Gabe is free and follows you', await run('House.s.gabeFree && House.gabeS.follow'));
  check('objective: get him out', (await page.textContent('#objective')).includes('front gate'));
  // out the front door (unlocked from inside) and through the gate
  await look(0, 5.6, 0, 1.2, 7); await until("House.aimed() && House.aimed().id === 'frontdoor'"); await press();
  check('front door opens from inside', await until('House.s.frontOpen'));
  await run('Player.place(0, 16, 0, 0)'); await page.waitForTimeout(800);
  check('Gabe keeps up', await run('Math.hypot(House.gabeS.x - Player.pos.x, House.gabeS.z - Player.pos.z) < 4'));
  await run('Player.place(0, 21.5, Math.PI, 0)');
  check('escaping with Gabe wins', await until("Game.state === 'hend'"));
  check('ending lines and stats', await until("document.getElementById('ending').classList.contains('on')", 20000) && (await page.textContent('#endLines')).includes('TIKI'));
  await page.waitForSelector('#btnAgain.on', { timeout: 40000 }); await page.click('#btnAgain');
  check('back to the title', await until("Game.state === 'title'"));
  check('the island story still works after', await (async () => { await page.click('#btnPlay'); await page.waitForTimeout(300); await page.click('#btnSkip'); return until("Game.state === 'play' && document.getElementById('minimap').style.display === ''"); })());
  console.log(results.join('\n')); console.log('--- errors ---\n' + logs.join('\n'));
  await browser.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e.message); process.exit(1); });
