const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
exports.SHOTS = path.join(__dirname, 'shots') + '/'; fs.mkdirSync(exports.SHOTS, { recursive: true });
exports.open = async (w = 960, h = 540) => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 500)); });
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').slice(0, 800)));
  await page.goto('file://' + path.resolve(__dirname, '..', 'escape-from-joury.html'));
  await page.waitForFunction(() => window.EFJ && window.EFJ.state === 'title', null, { timeout: 120000 });
  return { browser, page, logs };
};
exports.info = (page) => page.evaluate(() => window.EFJ.info());
