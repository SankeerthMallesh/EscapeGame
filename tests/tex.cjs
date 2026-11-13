const L = require('./lib.cjs'); const fs = require('fs');
(async () => {
  const { browser, page } = await L.open(640, 360);
  const urls = await page.evaluate(() => EFJ.run(`(() => { const out = {}; const names = ['grass','dirt','leaves','bark','planks','stone','rust','fabric','wallpaper','needles','leafclump','grasscard','cobweb']; const c = document.createElement('canvas'); c.width = 128 * 7; c.height = 128 * 2; const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); names.forEach((n, i) => { g.drawImage(PBR[n].canvas, (i % 7) * 128, Math.floor(i / 7) * 128, 128, 128); }); out.grid = c.toDataURL(); const c2 = document.createElement('canvas'); c2.width = 128 * 4; c2.height = 128; const g2 = c2.getContext('2d'); ['grass','dirt','bark','planks'].forEach((n, i) => { const img = PBR[n].normalMap.image; g2.drawImage(img, i * 128, 0, 128, 128); }); out.normals = c2.toDataURL(); return out; })()`));
  for (const [k, v] of Object.entries(urls)) fs.writeFileSync(L.SHOTS + 'tex_' + k + '.png', Buffer.from(v.split(',')[1], 'base64'));
  await browser.close();
})();
