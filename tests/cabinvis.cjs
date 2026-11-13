const L = require('./lib.cjs');
(async () => {
  const { browser, page, logs } = await L.open(960, 540);
  const until = (expr, ms = 90000) => page.waitForFunction((e) => EFJ.run(e), expr, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  await page.click('#btnPlay'); await page.waitForTimeout(300); await page.click('#btnSkip'); await until("Game.state === 'play'");
  await page.evaluate(() => { EFJ.holdJoury(9999); EFJ.catchNow(); });
  await until('Game.caughtT > 0.4'); await page.screenshot({ path: L.SHOTS + 'k_scare.png', timeout: 120000 });
  await until("Game.state === 'cabin'"); await page.evaluate(() => EFJ.skipWake()); await until('Cabin.wakeT <= 0 && !Player.frozen');
  const views = [['k_desk', 0.6, 0.3, 'monitor'], ['k_shelf', -1.0, 0.6, 'shelf'], ['k_bed', 1.2, -0.6, 'window'], ['k_door', 0.4, -0.4, 'door']];
  for (const [n, x, z, id] of views) { await page.evaluate(([x, z, id]) => { EFJ.walkCabin(x, z); EFJ.aimCabin(id); EFJ.run('HUD.toastT = 0.01'); }, [x, z, id]); await page.waitForTimeout(2200); await page.screenshot({ path: L.SHOTS + n + '.png', timeout: 120000 }); }
  console.log('fps', await page.evaluate(() => EFJ.fps), JSON.stringify((await L.info(page)).draw));
  console.log(logs.filter((l) => !l.includes('willReadFrequently')).join('\n'));
  await browser.close();
})();
