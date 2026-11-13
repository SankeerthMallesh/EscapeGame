const L = require('./lib.cjs');
(async () => {
  const { browser, page, logs } = await L.open(960, 540);
  const until = (expr, ms = 300000) => page.waitForFunction((e) => EFJ.run(e), expr, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  const shot = (n) => page.screenshot({ path: L.SHOTS + n + '.png', timeout: 240000 });
  await page.waitForTimeout(5000); await shot('n_title');
  await page.click('#btnPlay'); await page.waitForTimeout(300); await page.click('#btnSkip'); await until("Game.state === 'play'");
  await page.evaluate(() => { EFJ.holdJoury(9999); EFJ.teleport(-20, 100, 0.2); EFJ.look(0.2, -0.35); });
  await until("document.querySelectorAll('#chatLines .cl').length >= 2"); await page.waitForTimeout(800); await shot('n_chat');
  // lightning reveal
  await page.evaluate(() => { EFJ.look(0.2, 0); EFJ.run("Joury.state = 'hunt'; Joury.c.root.visible = true; Joury.pos.set(-60, 0, 140); Joury.dist = 50; Joury.seen = false; DIFFS.normal.stareLimit = 1e9;"); EFJ.lightning(true); });
  await until('Weather.flash > 0.6', 60000); await shot('n_lightning');
  await page.waitForTimeout(2500); await shot('n_after');
  // pumpkins die when he's close (graveyard)
  await page.evaluate(() => { EFJ.teleport(-58, -6, 0.3); EFJ.look(0.3, -0.05); EFJ.run("Joury.pos.set(-55, World.groundAt(-55, 2), 2); Joury.revealT = 0; Joury.c.root.visible = false;"); });
  await page.waitForTimeout(4000); await shot('n_pumpkins');
  // diary page
  await page.evaluate(() => EFJ.run("(() => { const p = Scare.pages[0]; const x = p.pos.x + 1.0, z = p.pos.z + 1.0; Player.place(x, z, Math.atan2(-(p.pos.x - x), -(p.pos.z - z)), -0.25); Joury.pos.set(200, 0, 200); })()"));
  await until("Game.target && Game.target.kind === 'page'", 60000); await page.keyboard.press('KeyE'); await page.waitForTimeout(800); await shot('n_page'); await page.keyboard.press('KeyE');
  // fake crash on first catch
  await page.evaluate(() => { EFJ.run("DIFFS.normal.stareLimit = 4"); EFJ.catchNow(); });
  await until('Game.caughtT > 2.6'); await shot('n_crash1'); await until('Game.caughtT > 5.2'); await shot('n_crash2');
  await until("Game.state === 'cabin'"); 
  console.log('chat:', await page.evaluate(() => [...document.querySelectorAll('#chatLines .cl')].map((e) => e.textContent).join(' | ')));
  console.log(logs.filter((l) => !l.includes('willReadFrequently')).join('\n'));
  await browser.close();
})();
