// Online co-op, the awkward cases: three players, joining a game that is already running, Joury faking a friend's
// chat message, the host being locked in the cabin while Joury hunts the others, a carrier leaving, the host leaving.
const { chromium } = require('playwright'); const path = require('path');
const { PeerServer } = require('peer');
const PORT = 9472, results = []; let fails = 0;
const check = (n, ok, x = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
(async () => {
  PeerServer({ port: PORT, path: '/', host: '127.0.0.1' });
  await new Promise((r) => setTimeout(r, 400));
  const args = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
  const url = 'file://' + path.resolve(__dirname, '..', 'escape-from-joury.html') + '?norender&peer=127.0.0.1:' + PORT;
  const open = async () => {
    const browser = await chromium.launch({ args }); const page = await browser.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
    page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').slice(0, 400)));
    await page.goto(url); await page.waitForFunction(() => window.EFJ && EFJ.state === 'title', null, { timeout: 180000 });
    return { browser, page, logs };
  };
  const [A, B, C] = await Promise.all([open(), open(), open()]);
  const run = (P, code) => P.page.evaluate((c) => EFJ.run(c), code);
  const until = (P, expr, ms = 30000) => P.page.waitForFunction((e) => { try { return EFJ.run(e); } catch (x) { return false; } }, expr, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  const join = async (P, name, code) => { await P.page.click('#btnTogether'); await P.page.fill('#mpName', name); await P.page.evaluate((c) => EFJ.run("Lobby.setCode('" + c + "')"), code); await P.page.click('#btnJoin'); };

  await A.page.click('#btnTogether'); await A.page.fill('#mpName', 'Hosty'); await A.page.click('#btnHost');
  await until(A, 'Net.isHost && Net.peer && Net.peer.open'); const code = await run(A, 'Net.code');
  await join(B, 'Sam', code);
  check('picking 5 items and Confirm joins', await until(B, 'Net.joined && Net.players.size === 2'));
  await A.page.click('#btnStartMp');
  check('two players start', (await until(A, "Game.state === 'play'")) && (await until(B, "Game.state === 'play'")));
  check('players spawn side by side, not inside each other', Math.abs((await run(A, 'Player.pos.x')) - (await run(B, 'Player.pos.x'))) > 0.4);
  await run(A, 'EFJ.holdJoury(9999)');

  // ---- Joury pretends to be a friend ----
  await run(A, "Net.emit({ e: 'fake', as: 'h', text: 'behind u' }, 'p1')");
  check('fake message looks like it came from the friend', await until(B, "[...document.querySelectorAll('#chatLines .cl.player')].some((e) => e.textContent.includes('Hosty:') && e.textContent.includes('behind u'))", 5000));
  check('the real friend never sees it', !(await run(A, "[...document.querySelectorAll('#chatLines .cl')].some((e) => e.textContent.includes('behind u'))")));
  check('…then the name changes to Joury', await until(B, "[...document.querySelectorAll('#chatLines .cl.joury')].some((e) => e.textContent.includes('Joury:') && e.textContent.includes('behind u'))", 12000));

  // ---- he calls the hunted player out by name ----
  await run(B, 'EFJ.teleport(-20, 100, 0)'); await B.page.keyboard.down('ShiftLeft'); await B.page.keyboard.down('KeyW');
  await until(A, "Net.players.get('p1').sprinting");
  await run(A, "Joury.state = 'hunt'; Joury.pos.set(60, 0, -60); Joury.tpT = 999; Joury.mimicT = 999; Joury.focus = Net.players.get('p1'); Chat.nextJoury = 0;");
  check('Joury calls out the running player by name, for everyone', (await until(A, "[...document.querySelectorAll('#chatLines .cl.joury')].some((e) => e.textContent.includes('@Sam i can hear u running'))", 15000)) && (await until(B, "[...document.querySelectorAll('#chatLines .cl.joury')].some((e) => e.textContent.includes('@Sam i can hear u running'))", 15000)));
  await B.page.keyboard.up('KeyW'); await B.page.keyboard.up('ShiftLeft');
  await run(A, 'EFJ.holdJoury(9999)');

  // ---- the host is caught: their Joury keeps hunting the others ----
  await run(B, 'EFJ.nearKid(4)'); await until(B, "Game.target && Game.target.kind === 'kid'"); await B.page.keyboard.press('KeyE'); await until(A, 'World.kids[4].saved');
  await run(B, 'EFJ.teleport(-20, 100, 0); EFJ.look(0, 0)');
  await run(A, 'EFJ.catchNow()');
  check('host goes to the cabin', await until(A, "Game.state === 'cabin'", 40000));
  check('clients see the host is locked up', await until(B, "Net.players.get('h').where === 'c' && document.getElementById('roster').textContent.includes('in the cabin')"));
  check('host Joury comes back for the free player', await until(A, "Joury.state === 'hunt' && Joury.focus && Joury.focus.id === 'p1'", 20000));
  // put him behind the free player, having heard them: he should walk up to them while the host sits in the cabin
  await run(A, "Joury.pos.set(-20, 0, 118); Joury.tpT = 999; Joury.mimicT = 999; Joury.heardT = 0; Joury.heardPos.set(-20, 0, 100);");
  check('he closes in on the free player', await until(B, "Joury.state === 'hunt' && Joury.dist < 9", 20000), 'dist=' + await run(B, 'Joury.dist.toFixed(1)'));
  check('…and catches them', await until(B, "Game.state === 'caught' || Game.state === 'cabin'", 30000));
  check('with everyone locked up he just waits', (await until(A, "Net.targets().length === 0")) && (await until(A, "Joury.state === 'hunt' && !Joury.moving", 15000)));

  // ---- joining a game that is already running ----
  await run(A, "Joury.pos.set(120, 0, -20); Joury.tpT = 999; Joury.mimicT = 999; Joury.knowT = 0; Joury.heardT = 99;"); // far away: the newcomer is not caught mid-test
  await join(C, 'Cee', code);
  check('late joiner lands in the game', await until(C, "Game.state === 'play' && Net.started && Net.players.size === 3", 40000));
  check('late joiner gets the island as it is now', await until(C, 'World.kids[4].saved && Game.savedCount() === 1'));
  check('late joiner sees who is locked up', await until(C, "Net.players.get('h').where === 'c' && Net.players.get('p1').where === 'c'"));
  check('others are told someone joined', await until(B, "[...document.querySelectorAll('#chatLines .cl')].some((e) => e.textContent.includes('Cee joined the game'))"));
  check('Joury turns to the newcomer', await until(A, "Joury.focus && Joury.focus.id === 'p2'", 20000));
  await run(A, 'EFJ.holdJoury(9999)');

  // ---- a carrier leaves: their part goes back ----
  await run(A, "World.kids.forEach((k, i) => { if (!k.saved) Net.act('rescue', { i }); })");
  check('boat phase reaches all three, wherever they are', (await until(A, "Game.phase === 'boat'")) && (await until(B, "Game.phase === 'boat'")) && (await until(C, "Game.phase === 'boat' && World.parts.length === 4")));
  await run(A, 'EFJ.holdJoury(9999)');
  await run(C, 'EFJ.nearPart(1)'); await until(C, 'Game.target && Game.target.ref === World.parts[1]'); await C.page.keyboard.press('KeyE');
  check('newcomer picks up a part', (await until(C, 'World.carried.size === 1')) && (await until(A, "World.parts[1].taken && World.parts[1].by === 'p2'")));
  await C.browser.close();
  check('their part goes back when they leave', (await until(A, '!World.parts[1].taken && World.parts[1].g.visible && Net.players.size === 2', 30000)) && (await until(B, '!World.parts[1].taken', 30000)));
  check('chat says they left', await until(B, "[...document.querySelectorAll('#chatLines .cl')].some((e) => e.textContent.includes('Cee left the game'))"));

  // ---- launch while a player is still in the cabin ----
  await run(A, "PARTS.forEach((P) => World.partsDelivered.add(P.id)); Net.act('launch')");
  check('launch pulls locked-up players into the ending too', (await until(A, "Game.state === 'ending'")) && (await until(B, "Game.state === 'ending' && !document.getElementById('keypad').classList.contains('on') && !document.getElementById('crash').classList.contains('on')")), JSON.stringify([await run(A, 'Game.state'), await run(B, 'Game.state')]));

  // ---- the host leaves ----
  await A.browser.close();
  check('players are told when the host leaves', await until(B, "Net.mode === 'off' && document.getElementById('netlost').classList.contains('on')", 30000), await B.page.textContent('#netlostText'));
  await B.page.click('#btnNetlost');
  check('…and can go back to the title', await until(B, "Game.state === 'title' && document.getElementById('title').classList.contains('on')"));

  console.log(results.join('\n'));
  console.log('--- errors ---\nA: ' + A.logs.join('\n') + '\nB: ' + B.logs.join('\n') + '\nC: ' + C.logs.join('\n'));
  await B.browser.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e.message); process.exit(1); });
