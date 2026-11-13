const L = require('./lib.cjs');
(async () => {
  const { browser, page } = await L.open(640, 360);
  console.log(await page.evaluate(() => EFJ.run(`(() => { const bad = []; const scan = (root, label) => root.traverse((o) => { const g = o.geometry; if (!g || !g.attributes || !g.attributes.position) return; const a = g.attributes.position.array; for (let i = 0; i < a.length; i++) if (!isFinite(a[i])) { bad.push(label + ':' + (o.name || o.type) + ':' + (o.parent && o.parent.type) + ' n=' + a.length + ' mat=' + (o.material && o.material.type) + ' color=' + (o.material && o.material.color && o.material.color.getHexString())); return; } }); scan(World.scene, 'world'); scan(Cabin.scene, 'cabin'); Object.entries(Story.scenes).forEach(([k, v]) => scan(v.scene, k)); if (Game.ending) scan(Game.ending.scene, 'ending'); return JSON.stringify(bad.slice(0, 10)); })()`)));
  await browser.close();
})();
