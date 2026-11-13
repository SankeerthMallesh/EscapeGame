const L = require('./lib.cjs');
(async () => {
  const { browser, page, logs } = await L.open(960, 540);
  const until = (expr, ms = 90000) => page.waitForFunction((e) => EFJ.run(e), expr, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  await page.waitForTimeout(4000); await page.screenshot({ path: L.SHOTS + 'u_title.png', timeout: 120000 });
  await page.click('#btnPlay'); await page.waitForTimeout(3500); await page.screenshot({ path: L.SHOTS + 'u_story1.png', timeout: 120000 });
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('Space'); await page.waitForTimeout(300); }
  await page.waitForTimeout(3000); await page.screenshot({ path: L.SHOTS + 'u_story5.png', timeout: 120000 });
  await page.click('#btnSkip'); await until("Game.state === 'play'");
  await page.evaluate(() => { EFJ.holdJoury(9999); EFJ.nearKid(4); }); await page.waitForTimeout(2500);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1500); await page.screenshot({ path: L.SHOTS + 'u_hud.png', timeout: 120000 });
  console.log(logs.filter((l) => !l.includes('willReadFrequently')).join('\n'));
  await browser.close();
})();
