// Online co-op, end to end: two browsers, a local PeerJS server, no drawing (logic only, so it runs fast).
//   host a room → join with the code → start → same island for both → see each other → rescue → chat
//   → caught → friend bangs on the cabin door → escape → boat parts → launch → scoreboard → back to the lobby → leave
const { chromium } = require('playwright'); const path = require('path');
const { PeerServer } = require('peer');
const PORT = 9471, results = []; let fails = 0;
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
  const [A, B] = await Promise.all([open(), open()]);
  const run = (P, code) => P.page.evaluate((c) => EFJ.run(c), code);
  const until = (P, expr, ms = 30000) => P.page.waitForFunction((e) => { try { return EFJ.run(e); } catch (x) { return false; } }, expr, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);

  // ---- lobby ----
  await A.page.click('#btnTogether'); await A.page.fill('#mpName', 'Hosty'); await A.page.click('#btnHost');
  check('host opens a room', await until(A, 'Net.isHost && Net.peer && Net.peer.open'));
  const code = await run(A, 'Net.code'); check('join code is 5 items', /^[A-HJ-NP-T]{5}$/.test(code) && (await A.page.$$('#roomCode .code-item')).length === 5, code + ' ' + (await A.page.textContent('#roomCode')));
  await B.page.click('#btnTogether'); await B.page.fill('#mpName', 'Sam<b>!'); await B.page.evaluate(() => EFJ.run("Lobby.setCode('AAAAB')")); await B.page.click('#btnJoin');
  check('wrong code gives a clear error', await until(B, "document.getElementById('lobbyStatus').textContent.includes(\"Couldn't find that room\")", 30000), await B.page.textContent('#lobbyStatus'));
  await B.page.click('#btnClearCode'); for (const ch of code) await B.page.click('#itemGrid .item-tile:nth-child(' + ('ABCDEFGHJKLMNPQRST'.indexOf(ch) + 1) + ')'); await B.page.click('#btnJoin');
  check('second player joins with the code', await until(B, 'Net.isClient && Net.joined && Net.players.size === 2'));
  check('host sees both players', await until(A, 'Net.players.size === 2'), await A.page.textContent('#lobbyPlayers'));
  check('names are cleaned', (await run(B, 'Net.me().name')) === 'Samb', await run(B, 'Net.me().name'));

  // ---- start ----
  await A.page.click('#btnStartMp');
  check('both games start', (await until(A, "Game.state === 'play'")) && (await until(B, "Game.state === 'play'")));
  const bat = (P) => run(P, 'JSON.stringify(World.batteries.map((b) => [b.x.toFixed(2), b.z.toFixed(2)]))');
  check('same batteries on both islands', (await bat(A)) === (await bat(B)) && (await run(A, 'World.batteries.length')) > 5);
  await run(A, 'EFJ.holdJoury(9999)');

  // ---- seeing each other ----
  await run(B, 'EFJ.teleport(-20, 100, 0.4)');
  check('host sees the other player move', await until(A, "(() => { const p = Net.players.get('p1'); return p && p.where === 'i' && Math.hypot(p.x + 20, p.z - 100) < 0.5 && !!p.av; })()"));
  await run(A, 'EFJ.teleport(30, 60, 1)');
  check('client sees the host move', await until(B, "(() => { const p = Net.players.get('h'); return p && p.where === 'i' && Math.hypot(p.x - 30, p.z - 60) < 0.5 && !!p.av && p.av.c.root.visible; })()"));

  // ---- rescue, by the client ----
  await run(B, 'EFJ.nearKid(2)'); await until(B, "Game.target && Game.target.kind === 'kid'"); await B.page.keyboard.press('KeyE');
  check('rescue shows on both', (await until(A, 'World.kids[2].saved')) && (await until(B, 'World.kids[2].saved')));
  check('host is told who did it', (await A.page.textContent('#toast')).includes('Samb'), await A.page.textContent('#toast'));
  check('scoreboard counts it', await until(B, "Net.players.get('p1').kids === 1"));

  // ---- chat ----
  await B.page.keyboard.press('KeyT'); await B.page.keyboard.type('over here <i>'); await B.page.keyboard.press('Enter');
  check('chat reaches the host as plain text', await until(A, "[...document.querySelectorAll('#chatLines .cl.player')].some((e) => e.textContent.includes('Samb:') && e.textContent.includes('over here <i>') && !e.querySelector('i'))"));

  // ---- Joury is the host's ----
  await run(A, "Joury.timer = 0");
  check('Joury wakes for everyone', (await until(A, "Joury.state === 'hunt'")) && (await until(B, "Joury.state === 'hunt'")));
  await run(A, "Joury.pos.set(-30, 0, 90); Joury.tpT = 999; Joury.knowT = 0; Joury.heardT = 99;");
  check('client follows the host\'s Joury', await until(B, 'Math.hypot(Joury.pos.x - Joury.net.x, Joury.pos.z - Joury.net.z) < 1.5 && Math.hypot(Joury.net.x + 30, Joury.net.z - 90) < 25'));

  // ---- caught: the client goes to the cabin, the host's Joury moves on ----
  await run(B, 'EFJ.catchNow()');
  check('host knows who was caught', await until(A, "Net.players.get('p1').where === 'c' && Net.players.get('p1').caught === 1"));
  check('host chat announces it', await until(A, "[...document.querySelectorAll('#chatLines .cl')].some((e) => e.textContent.includes('Samb was eliminated'))"));
  check('caught player reaches the cabin', await until(B, "Game.state === 'cabin'", 40000));
  check('Joury leaves, then comes back for the host', (await until(A, "Joury.state === 'away' || Joury.state === 'hunt'")) && (await until(A, "Joury.state === 'hunt' && Joury.focus && Joury.focus.id === 'h'", 20000)));
  await run(A, 'EFJ.holdJoury(9999)');
  // friend bangs on the door
  await run(B, 'EFJ.skipWake()'); await until(B, 'Cabin.wakeT <= 0'); await run(B, 'EFJ.setCabinTimer(60)');
  await run(A, "(() => { const it = World.interact.find((q) => q.kind === 'cabindoor'); Player.place(it.pos.x, it.pos.z + 1.2, 0, 0); })()");
  check('door offers to help the friend', await until(A, "Game.target && Game.target.kind === 'cabindoor' && Game.target.label().includes('Samb')"), await run(A, "Game.target && Game.target.label()"));
  await A.page.keyboard.press('KeyE');
  check('banging on the door adds time', await until(B, 'Cabin.timer > 70'), 'timer=' + await run(B, 'Cabin.timer.toFixed(0)'));
  // escape with the code
  const digits = await run(B, "Cabin.digits.join('')");
  await run(B, 'EFJ.walkCabin(1.7, -1.5)'); await B.page.waitForTimeout(300); await run(B, "EFJ.aimCabin('keypad')"); await until(B, "(Cabin.aimed()||{}).id === 'keypad'");
  await B.page.keyboard.press('KeyE'); await until(B, "document.getElementById('keypad').classList.contains('on')");
  for (const d of digits) await B.page.keyboard.press('Digit' + d);
  check('escape puts the player back on the island', await until(B, "Game.state === 'play'", 30000));
  check('escape stuns the host\'s Joury for everyone', (await until(A, "Joury.state === 'stunned'")) && (await until(B, "Joury.state === 'stunned' && Joury.stunT > 5")));
  await run(A, 'EFJ.holdJoury(9999)');

  // ---- boat phase ----
  await run(A, "World.kids.forEach((k, i) => { if (!k.saved) Net.act('rescue', { i }); })");
  check('boat phase starts for both', (await until(A, "Game.phase === 'boat' && World.parts.length === 4")) && (await until(B, "Game.phase === 'boat' && World.parts.length === 4")));
  const parts = (P) => run(P, 'JSON.stringify(World.parts.map((p) => [p.id, p.x.toFixed(2), p.z.toFixed(2)]))');
  check('same boat parts on both islands', (await parts(A)) === (await parts(B)), await parts(A));
  await run(A, 'EFJ.holdJoury(9999)');
  const take = async (P, i) => { await run(P, `EFJ.nearPart(${i})`); await until(P, `Game.target && Game.target.ref === World.parts[${i}]`); await P.page.keyboard.press('KeyE'); return until(P, `World.parts[${i}].taken`); };
  check('host takes a part', await take(A, 0));
  check('client sees who has it', await until(B, "World.parts[0].taken && World.parts[0].by === 'h' && !World.carried.size && document.getElementById('partsBar').textContent.includes('Hosty has it')"), await B.page.textContent('#partsBar'));
  check('client takes the other three', (await take(B, 1)) && (await take(B, 2)) && (await take(B, 3)) && (await run(B, 'World.carried.size')) === 3);
  await run(B, 'EFJ.toDock()'); await until(B, "Game.target && Game.target.kind === 'boat'"); await B.page.keyboard.press('KeyE');
  check('client delivers three parts', (await until(A, 'World.partsDelivered.size === 3')) && (await until(B, 'World.partsDelivered.size === 3 && World.carried.size === 0')));
  await B.page.keyboard.press('KeyE'); await B.page.waitForTimeout(500);
  check('cannot launch without every part', (await run(B, 'Game.state')) === 'play');
  await run(A, 'EFJ.toDock()'); await until(A, "Game.target && Game.target.kind === 'boat'"); await A.page.keyboard.press('KeyE');
  check('host delivers the last part', (await until(A, 'World.partsDelivered.size === 4')) && (await until(B, 'World.partsDelivered.size === 4')));
  await B.page.keyboard.press('KeyE');
  check('launch ends the game for everyone', (await until(A, "Game.state === 'ending'")) && (await until(B, "Game.state === 'ending'")));
  check('scoreboard after the ending', await until(B, "document.getElementById('endBoard').classList.contains('on') && document.getElementById('endBoard').textContent.includes('Hosty')", 90000), await B.page.textContent('#endBoard'));

  // ---- back to the lobby, then leave ----
  await B.page.waitForSelector('#btnAgain.on', { timeout: 30000 }).catch(() => {}); await B.page.click('#btnAgain');
  check('ending returns to the same room', await until(B, "Game.state === 'title' && Lobby.isOpen && Net.joined && document.getElementById('lobby').classList.contains('room')"));
  await B.browser.close();
  check('host notices a player leaving', await until(A, 'Net.players.size === 1', 30000));

  console.log(results.join('\n'));
  console.log('--- errors ---\nA: ' + A.logs.join('\n') + '\nB: ' + B.logs.join('\n'));
  await A.browser.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e.message); process.exit(1); });
