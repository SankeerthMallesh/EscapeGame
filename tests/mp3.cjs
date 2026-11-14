// Codes, referral bonus, firecrackers and VIP Joury (the KEYBOARD code), with two browsers.
const { chromium } = require('playwright'); const path = require('path');
const { PeerServer } = require('peer');
const PORT = 9476, results = []; let fails = 0;
const check = (n, ok, x = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
(async () => {
  PeerServer({ port: PORT, path: '/', host: '127.0.0.1' }); await new Promise((r) => setTimeout(r, 400));
  const args = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
  const url = 'file://' + path.resolve(__dirname, '..', 'escape-from-joury.html') + '?norender&peer=127.0.0.1:' + PORT;
  const open = async () => { const browser = await chromium.launch({ args }); const page = await browser.newPage({ viewport: { width: 1100, height: 700 } }); const logs = []; page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').slice(0, 400))); await page.goto(url); await page.waitForFunction(() => window.EFJ && EFJ.state === 'title', null, { timeout: 180000 }); return { browser, page, logs }; };
  const [A, B] = await Promise.all([open(), open()]);
  const run = (P, code) => P.page.evaluate((c) => EFJ.run(c), code);
  const until = (P, expr, ms = 30000) => P.page.waitForFunction((e) => { try { return EFJ.run(e); } catch (x) { return false; } }, expr, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  const redeem = async (P, code) => { await P.page.fill('#redeemInput', code); await P.page.click('#btnRedeem'); return P.page.textContent('#redeemStatus'); };

  // ---- codes ----
  await B.page.click('#btnCodes');
  check('codes panel opens', await B.page.isVisible('#redeemInput'));
  check('wrong code is refused', (await redeem(B, 'banana')).includes("doesn't exist"));
  check('KEYBOARD unlocks VIP Joury', (await redeem(B, 'keyboard')).includes('VIP') && (await run(B, "Perks.has('vip')")));
  check('a code only works once', (await redeem(B, 'KEYBOARD')).includes('already'));
  check('VIVEK gives longer sprint', (await redeem(B, 'VIVEK')).includes('Unlocked') && (await run(B, 'Perks.stamK()')) > 1.3);
  check('rewards are listed', (await B.page.textContent('#perkList')).includes("Vivek's legs"));
  const refA = await run(A, 'CFG.refCode');
  check('everyone gets a referral code', /^JRY-[A-HJ-NP-T]{5}$/.test(refA), refA);
  check("can't use your own referral code", (await redeem(B, await run(B, 'CFG.refCode'))).includes('own'));
  check("a friend's referral code works", (await redeem(B, refA)).includes('Referral accepted') && (await run(B, "Perks.has('recruit') && CFG.refUsed === '" + refA + "'")));
  check('bonuses survive a reload', (await B.page.reload().then(() => B.page.waitForFunction(() => window.EFJ && EFJ.state === 'title', null, { timeout: 180000 })).then(() => run(B, "Perks.has('vip') && Perks.has('legs') && Perks.has('recruit')"))));

  // ---- online with VIP Joury ----
  await A.page.click('#btnTogether'); await A.page.fill('#mpName', 'Hosty'); await A.page.click('#btnHost'); await until(A, 'Net.peer && Net.peer.open'); const code = await run(A, 'Net.code');
  check('host has no VIP button without the code', await A.page.isHidden('#btnVip'));
  await B.page.click('#btnTogether'); await B.page.fill('#mpName', 'Kai'); await B.page.evaluate((c) => EFJ.run("Lobby.setCode('" + c + "')"), code); await B.page.click('#btnJoin');
  await until(B, 'Net.joined && Net.players.size === 2');
  check('VIP player sees "Play as Joury"', await B.page.isVisible('#btnVip'));
  await B.page.click('#btnVip');
  check('everyone sees the VIP Joury title in the lobby', (await until(A, "Net.players.get('p1').role === 'joury'")) && (await A.page.textContent('#lobbyPlayers')).includes('VIP · JOURY'));
  await A.page.click('#btnStartMp'); await until(A, "Game.state === 'play'"); await until(B, "Game.state === 'play'");
  check('VIP player is Joury', await run(B, 'Net.amJoury() && !Net.isHost'));
  check('squad bonus with the friend who invited you', (await run(A, 'Perks.squad')) && (await run(B, 'Perks.squad')));
  const dumpB = () => run(B, "JSON.stringify({ st: Game.state, am: Net.amJoury(), cr: Crackers.n, jst: Joury.state, frozen: Player.frozen, pos: [Player.pos.x | 0, Player.pos.z | 0], err: Game.errors || 0 })");
  check('VIP Joury has no firecrackers', (await run(B, 'Crackers.n')) === 0, await dumpB());
  check('VIP Joury cannot free kids', await run(B, '(() => { const x = Player.pos.x, z = Player.pos.z; EFJ.nearKid(1); const ok = Game.findTarget() === null; Player.place(x, z, Player.yaw, 0); return ok; })()'));
  check('VIP Joury waits out the head start', (await run(B, "Joury.state")) === 'dormant' && (await run(B, 'Player.frozen')));
  await run(A, 'Joury.timer = 0');
  check('then he can move', await until(B, "Joury.state === 'hunt' && !Player.frozen"), await dumpB());
  await run(A, 'EFJ.teleport(-20, 100, 0)');
  await run(B, 'EFJ.teleport(-20, 115, 0)');
  check("the host's Joury follows the VIP player", await until(A, 'Math.hypot(Joury.pos.x + 20, Joury.pos.z - 115) < 1'));
  check('survivors see the gold VIP tag over him', await until(A, 'Vip.tag && Vip.tag.visible'));
  // a firecracker from the survivor does not move a player-controlled Joury
  await run(A, 'EFJ.look(0, 0)'); await A.page.keyboard.press('KeyG');
  check('firecracker count goes down', (await run(A, 'Crackers.n')) === 2);
  check('VIP Joury hears the bang too', await until(B, 'Crackers.bangs > 0', 15000));
  // blink behind the survivor, then touch them
  await run(B, 'Vip.blinkT = 0'); await B.page.keyboard.press('KeyQ');
  check('Q blinks VIP Joury behind the survivor', await until(B, 'Vip.blinkT > 30 && Math.hypot(Player.pos.x + 20, Player.pos.z - 100) < 16'));
  await run(B, 'EFJ.teleport(-20, 101.2, 0)');
  check('touching a survivor catches them', await until(A, "Game.state === 'caught' || Game.state === 'cabin'"));
  check('chat names the VIP as the catcher', (await until(A, "[...document.querySelectorAll('#chatLines .cl')].some((e) => e.textContent.includes('eliminated by Kai (VIP Joury)'))", 8000)) && (await until(B, "[...document.querySelectorAll('#chatLines .cl')].some((e) => e.textContent.includes('Hosty was eliminated by Kai (Joury)'))", 8000)));
  check("VIP Joury's catch is counted", await until(B, "Net.players.get('p1').kids === 1"));
  check('VIP Joury is sent back to his cabin after a catch', await until(B, "Joury.state === 'away' || Math.hypot(Player.pos.x - World.cabin.door.x, Player.pos.z - World.cabin.door.z) < 3"));

  // ---- firecracker draws the AI Joury (solo-style, on the host with no VIP) ----
  await B.browser.close();
  check('host notices the VIP leaving', await until(A, 'Net.players.size === 1 && !Net.jouryPlayer()', 30000));
  console.log(results.join('\n')); console.log('--- errors ---\nA: ' + A.logs.join('\n') + '\nB: ' + B.logs.join('\n'));
  await A.browser.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e.message); process.exit(1); });
