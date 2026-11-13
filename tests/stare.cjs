// Stare at Joury until caught → jump scare → fake crash → cabin. Slow in headless browsers.
const L = require('./lib.cjs');
const results = []; const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`);
(async () => {
  const { browser, page, logs } = await L.open(960, 540);
  const until = (expr, ms = 600000) => page.waitForFunction((e) => EFJ.run(e), expr, { timeout: ms, polling: 200 }).then(() => true).catch(() => false);
  const shot = (n) => page.screenshot({ path: L.SHOTS + n + '.png', timeout: 240000 });
  await page.click('#btnPlay'); await page.waitForTimeout(300); await page.click('#btnSkip'); await until("Game.state === 'play'");
  await page.evaluate(() => { EFJ.holdJoury(9999); EFJ.teleport(-20, 100, 0.5); });
  await page.evaluate(() => EFJ.jouryAhead(9)); await until('Joury.stare > 0.3');
  check('stare builds', true);
  check('staring gets you caught', await until("Game.state === 'caught'"));
  await until('Game.caughtT > 0.35'); await shot('s_jumpscare');
  await until('Game.caughtT > 2.6'); await shot('s_crash');
  check('cabin after caught', await until("Game.state === 'cabin'"));
  await page.waitForTimeout(2000); await shot('s_cabin');
  console.log(results.join('\n')); console.log('--- console ---\n' + logs.filter((l) => !l.includes('willReadFrequently')).join('\n'));
  await browser.close();
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e.message); process.exit(1); });
