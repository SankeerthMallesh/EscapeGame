const L = require('./lib.cjs');
(async () => {
  const { browser, page, logs } = await L.open(800, 450);
  const until = (expr, ms = 300000) => page.waitForFunction((e) => EFJ.run(e), expr, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  await page.click('#btnPlay'); await page.waitForTimeout(300); await page.click('#btnSkip'); await until("Game.state === 'play'");
  // pumpkins: put Joury on a path-side jack and let the dimming run
  const r = await page.evaluate(() => EFJ.run(`(() => { Joury.state = 'hunt'; const j = World.jacks.find((q) => q.gi !== undefined); Joury.pos.set(j.x + 3, 0, j.z); for (let i = 0; i < 120; i++) Scare.updatePumpkins(0.05); const near = World.jacks.filter((q) => q.gi !== undefined && Math.hypot(q.x - Joury.pos.x, q.z - Joury.pos.z) < 9), far = World.jacks.filter((q) => q.gi !== undefined && Math.hypot(q.x - Joury.pos.x, q.z - Joury.pos.z) > 25); return JSON.stringify({ near: near.map((q) => +q.lit.toFixed(2)), farMin: Math.min(...far.map((q) => q.lit)).toFixed(2), dim: j.src.dim.toFixed(2) }); })()`));
  console.log('pumpkins', r);
  await page.evaluate(() => { EFJ.run("Joury.state = 'dormant'; Joury.timer = 9999"); EFJ.catchNow(); });
  await until('Game.caughtT > 2.6'); await page.screenshot({ path: L.SHOTS + 'n_crash1.png', timeout: 240000 });
  await until('Game.caughtT > 5.2'); await page.screenshot({ path: L.SHOTS + 'n_crash2.png', timeout: 240000 });
  console.log('cabin', await until("Game.state === 'cabin'"));
  console.log(logs.filter((l) => !l.includes('willReadFrequently')).join('\n')); await browser.close();
})();
