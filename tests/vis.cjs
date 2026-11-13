const L = require('./lib.cjs');
(async () => {
  const t0 = Date.now();
  const { browser, page, logs } = await L.open(+(process.env.W || 960), +(process.env.H || 540));
  console.log('load ms', Date.now() - t0);
  const until = (expr, ms = 60000) => page.waitForFunction((e) => EFJ.run(e), expr, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  if (process.env.TITLE) { await page.waitForTimeout(4000); await page.screenshot({ path: L.SHOTS + 'v_title.png' }); }
  await page.click('#btnPlay'); await page.waitForTimeout(300); await page.click('#btnSkip'); await until("Game.state === 'play'");
  await page.evaluate(() => EFJ.holdJoury(9999));
  for (const v of JSON.parse(process.argv[2] || '[]')) {
    await page.evaluate((v) => { if (v.kid !== undefined) EFJ.nearKid(v.kid); else if (v.x !== undefined) EFJ.teleport(v.x, v.z, v.yaw); if (v.pitch !== undefined) EFJ.look(v.yaw, v.pitch); if (v.js) EFJ.run(v.js); }, v);
    await page.waitForTimeout(v.wait || 3000);
    await page.screenshot({ path: L.SHOTS + v.name + '.png', timeout: 180000 });
    const i = await L.info(page); console.log(v.name, 'fps', await page.evaluate(() => EFJ.fps), 'draw', i.draw, 'tris', i.tris);
  }
  console.log(logs.join('\n'));
  await browser.close();
})();
