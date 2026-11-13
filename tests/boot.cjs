const L = require('./lib.cjs');
(async () => { const { browser, page } = await L.open(800, 450); console.log(JSON.stringify(await page.evaluate(() => EFJ.run('Game.bootT')))); await browser.close(); })();
