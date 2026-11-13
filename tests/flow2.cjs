const L = require('./lib.cjs');
const results = []; const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`);
(async () => {
  const { browser, page, logs } = await L.open();
  const until = (expr, ms = 60000) => page.waitForFunction((e) => EFJ.run(e), expr, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  const shot = (n) => page.screenshot({ path: L.SHOTS + n + '.png' });
  await page.click('#btnPlay'); await page.waitForTimeout(300); await page.click('#btnSkip'); await until("Game.state === 'play'");
  await page.evaluate(() => { EFJ.rescueAll(); EFJ.holdJoury(9999); EFJ.run('Game.stats.caught = 2'); });
  await until("Game.phase === 'boat'");
  for (let i = 0; i < 4; i++) {
    await page.evaluate((i) => EFJ.nearPart(i), i);
    const ok = await until(`Game.target && Game.target.kind === 'part' && Game.target.ref === World.parts[${i}]`, 20000);
    if (i === 1) await shot('g2_part');
    await page.keyboard.press('KeyE'); await until(`World.parts[${i}].taken`, 10000);
    check('pick up part ' + i, await page.evaluate((i) => EFJ.run(`World.parts[${i}].taken`), i), 'target ok=' + ok + ' ' + await page.evaluate(() => EFJ.run('JSON.stringify([Player.pos.x, Player.pos.z, Game.target && Game.target.kind])')));
  }
  await page.evaluate(() => EFJ.toDock()); await until("Game.target && Game.target.kind === 'boat'", 20000);
  await page.keyboard.press('KeyE'); await until('World.partsDelivered.size === 4', 10000); await page.waitForTimeout(800); await shot('g2_boat');
  check('all parts on the boat', (await L.info(page)).delivered.length === 4);
  await page.keyboard.press('KeyE'); check('launch → ending', await until("Game.state === 'ending'", 20000));
  await until('Game.endT > 3'); await shot('g2_end1'); await until('Game.endT > 6.5'); await shot('g2_end2'); await until('Game.endT > 10'); await shot('g2_end3');
  await until('Game.endT > 16', 120000); await page.waitForTimeout(6000); await shot('g2_epilogue');
  check('Play Again visible', await page.waitForSelector('#btnAgain.on', { timeout: 60000 }).then(() => true).catch(() => false));
  await shot('g2_stats');
  const stats = await page.textContent('#endStats'); check('stats', /Times caught\s*2/.test(stats) && /Normal/.test(stats), stats);
  await page.click('#btnAgain'); check('play again → title', await until("Game.state === 'title'", 20000));
  await page.waitForTimeout(2500); await shot('g2_title_again');
  await page.click('#btnPlay'); await page.waitForTimeout(300); await page.click('#btnSkip'); check('second game starts clean', await until("Game.state === 'play' && Game.savedCount() === 0 && World.parts.length === 0 && Game.phase === 'kids'"));
  console.log(results.join('\n')); console.log('--- console ---\n' + logs.join('\n'));
  await browser.close();
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e); process.exit(1); });
