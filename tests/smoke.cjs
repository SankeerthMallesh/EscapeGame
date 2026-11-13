const L = require('./lib.cjs');
(async () => { const { browser, page, logs } = await L.open(800, 450); console.log('state', await page.evaluate(() => EFJ.state)); console.log(logs.join('\n') || 'no console errors'); await browser.close(); })();
