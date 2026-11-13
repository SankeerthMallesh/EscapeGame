// Second catch → cabin timeout → Retry → escape (with long waits for slow software rendering)
const L = require('./lib.cjs');
const results = []; const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`);
(async () => {
  const { browser, page, logs } = await L.open(800, 450);
  const until = (expr, ms = 400000) => page.waitForFunction((e) => EFJ.run(e), expr, { timeout: ms, polling: 200 }).then(() => true).catch(() => false);
  await page.click('#btnPlay'); await page.waitForTimeout(300); await page.click('#btnSkip'); await until("Game.state === 'play'");
  await page.evaluate(() => { EFJ.holdJoury(9999); EFJ.catchNow(); });
  check('caught → cabin', await until("Game.state === 'cabin'"));
  await page.evaluate(() => EFJ.skipWake()); await until('Cabin.wakeT <= 0');
  await page.evaluate(() => EFJ.setCabinTimer(1));
  check('timer runs out', await until("Game.state === 'timeout'"));
  await page.screenshot({ path: L.SHOTS + 'h_timeout.png', timeout: 240000 });
  await page.click('#btnRetry', { timeout: 120000 }); check('retry returns to cabin', await until("Game.state === 'cabin'"));
  await page.evaluate(() => EFJ.skipWake()); await until('Cabin.wakeT <= 0 && !Player.frozen');
  await page.evaluate(() => { EFJ.walkCabin(1.7, -1.5); EFJ.aimCabin('keypad'); }); await until("(Cabin.aimed()||{}).id === 'keypad'", 60000);
  await page.keyboard.press('KeyE'); check('keypad opens', await until("document.getElementById('keypad').classList.contains('on')", 60000));
  const dg = await page.evaluate(() => EFJ.run('Cabin.digits.join("")')); for (const d of dg) await page.keyboard.press('Digit' + d);
  check('escape after retry', await until("Game.state === 'play'"));
  check('caught count is 1', (await page.evaluate(() => EFJ.run('Game.stats.caught'))) === 1);
  console.log(results.join('\n')); console.log(logs.filter((l) => !l.includes('willReadFrequently')).join('\n'));
  await browser.close();
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e.message); process.exit(1); });
