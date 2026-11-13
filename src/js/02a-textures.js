// =====================================================================
//  PBR TEXTURES — realistic surfaces generated in code (albedo, normal,
//  roughness). Everything tiles seamlessly. No image files are loaded.
// =====================================================================
function pvn2(x, y, Px, Py, seed) { // periodic value noise with separate x/y periods (integers)
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  let x0 = ix % Px; if (x0 < 0) x0 += Px; let y0 = iy % Py; if (y0 < 0) y0 += Py;
  const x1 = x0 + 1 === Px ? 0 : x0 + 1, y1 = y0 + 1 === Py ? 0 : y0 + 1;
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}
function tfb(u, v, fx, fy, oct, seed) { let s = 0, a = 0.5, n = 0, Px = fx, Py = fy; for (let i = 0; i < oct; i++) { s += a * pvn2(u * Px, v * Py, Px, Py, seed + i * 13); n += a; a *= 0.5; Px *= 2; Py *= 2; } return s / n; }
// tileable cellular noise: F1 and F2 distances (cell units) written into WO
const WO = [0, 0];
function worley(u, v, N, seed) {
  const x = u * N, y = v * N, ix = Math.floor(x), iy = Math.floor(y); let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j; let wx = cx % N; if (wx < 0) wx += N; let wy = cy % N; if (wy < 0) wy += N;
    const dx = cx + hash2(wx, wy, seed) - x, dy = cy + hash2(wx, wy, seed + 7) - y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  WO[0] = f1; WO[1] = f2; return WO;
}
const PBR = {};
function heightToNormal(H, S, strength) {
  const out = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const l = H[y * S + ((x - 1 + S) % S)], r = H[y * S + ((x + 1) % S)], t = H[((y - 1 + S) % S) * S + x], b = H[((y + 1) % S) * S + x];
    const nx = (l - r) * strength, ny = (b - t) * strength, nz = 1, len = Math.sqrt(nx * nx + ny * ny + nz * nz), o = (y * S + x) * 4;
    out[o] = (nx / len * 0.5 + 0.5) * 255; out[o + 1] = (ny / len * 0.5 + 0.5) * 255; out[o + 2] = (nz / len * 0.5 + 0.5) * 255; out[o + 3] = 255;
  }
  return out;
}
function dataCanvas(S, data) { const c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S); img.data.set(data); g.putImageData(img, 0, 0); return c; }
function texSet(name, S, gen, o = {}) {
  const H = new Float32Array(S * S), C = new Uint8ClampedArray(S * S * 4), R = new Uint8ClampedArray(S * S * 4), px = { h: 0, r: 0, g: 0, b: 0, rough: 0.9 };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    px.rough = o.rough === undefined ? 0.9 : o.rough; gen(x / S, y / S, px);
    const i = y * S + x, k = i * 4;
    H[i] = px.h; C[k] = Math.sqrt(clamp(px.r, 0, 1)) * 255; C[k + 1] = Math.sqrt(clamp(px.g, 0, 1)) * 255; C[k + 2] = Math.sqrt(clamp(px.b, 0, 1)) * 255; C[k + 3] = 255;
    R[k] = 0; R[k + 1] = clamp(px.rough, 0, 1) * 255; R[k + 2] = 0; R[k + 3] = 255;
  }
  return finishSet(name, S, dataCanvas(S, C), H, R, o);
}
function finishSet(name, S, albedoCanvas, H, R, o) {
  const aniso = Math.min(8, (GFX.renderer && GFX.renderer.capabilities.getMaxAnisotropy()) || 4);
  const mk = (canvas, srgb) => { const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const set = { map: mk(albedoCanvas, true), canvas: albedoCanvas };
  if (H) set.normalMap = mk(dataCanvas(S, heightToNormal(H, S, o.normal || 2.5)), false);
  if (R) set.roughnessMap = mk(dataCanvas(S, R), false);
  PBR[name] = set; return set;
}
// Draw-based sets (canvas shapes): albedo from the canvas, height from its luminance
function drawnSet(name, S, draw, o = {}) {
  const c = makeCanvas(S, S), g = c.getContext('2d'); draw(g, S);
  if (o.alpha) return finishSet(name, S, c, null, null, o);
  const d = g.getImageData(0, 0, S, S).data, H = new Float32Array(S * S), R = new Uint8ClampedArray(S * S * 4);
  for (let i = 0; i < S * S; i++) { const l = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255; H[i] = o.heightFn ? o.heightFn(l, i) : l; R[i * 4 + 1] = clamp((o.rough || 0.85) + (0.5 - l) * 0.15, 0, 1) * 255; R[i * 4 + 3] = 255; }
  return finishSet(name, S, c, H, R, o);
}
// wrap-around drawing helper so drawn textures tile
function wrapDraw(S, x, y, r, fn) { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const X = x + ox, Y = y + oy; if (X + r < 0 || Y + r < 0 || X - r > S || Y - r > S) continue; fn(X, Y); } }

async function buildPBR(step) {
  const sstep = (a, b, x) => smoothstep(a, b, x);
  const out = (px, r, g, b, k) => { px.r = r * k; px.g = g * k; px.b = b * k; };
  // ---- forest floor: grass ----
  texSet('grass', 512, (u, v, px) => {
    const n1 = tfb(u, v, 4, 4, 3, 1), n2 = tfb(u, v, 32, 32, 3, 2), blade = pvn2(u * 256, v * 48, 256, 48, 3) * 0.55 + pvn2(u * 128, v * 30, 128, 30, 4) * 0.45;
    const t1 = clamp(0.5 + n1, 0, 1), t2 = sstep(0.25, 0.7, n2 * 0.5 + n1 * 0.6);
    let r = lerp(lerp(0.032, 0.07, t1), 0.12, t2), g = lerp(lerp(0.055, 0.085, t1), 0.1, t2), b = lerp(lerp(0.018, 0.028, t1), 0.045, t2);
    if (hash2(Math.floor(u * 512), Math.floor(v * 512), 9) > 0.985) { r = 0.09; g = 0.07; b = 0.045; }
    out(px, r, g, b, 0.78 + blade * 0.38); px.h = 0.5 + blade * 0.35 + n2 * 0.2; px.rough = 0.92;
  }, { normal: 3 });
  if (step) await step();
  // ---- packed dirt with pebbles and cracks ----
  texSet('dirt', 512, (u, v, px) => {
    const n1 = tfb(u, v, 4, 4, 4, 11), n2 = tfb(u, v, 24, 24, 3, 12), w1 = worley(u, v, 22, 13), f1 = w1[0], cellv = hash2(Math.floor(u * 22), Math.floor(v * 22), 3);
    const w2 = worley(u, v, 7, 14), crack = sstep(0.05, 0.0, w2[1] - w2[0]) * sstep(-0.1, 0.3, n1);
    const t = clamp(0.5 + n1 * 0.8, 0, 1); let r = lerp(0.07, 0.135, t), g = lerp(0.048, 0.095, t), b = lerp(0.03, 0.062, t);
    const peb = sstep(0.36, 0.2, f1) * (cellv > 0.35 ? 1 : 0), pr = lerp(0.1, 0.2, cellv);
    r = lerp(r, pr, peb * 0.85); g = lerp(g, pr * 0.92, peb * 0.85); b = lerp(b, pr * 0.8, peb * 0.85);
    r = lerp(r, 0.025, crack * 0.8); g = lerp(g, 0.018, crack * 0.8); b = lerp(b, 0.012, crack * 0.8);
    const wet = sstep(0.2, 0.5, tfb(u, v, 3, 3, 2, 15)) * 0.6; r = lerp(r, r * 0.45, wet); g = lerp(g, g * 0.45, wet); b = lerp(b, b * 0.5, wet);
    out(px, r, g, b, 0.85 + n2 * 0.25); px.h = 0.45 + n2 * 0.15 + peb * 0.35 * (1 - f1) - crack * 0.3; px.rough = 0.95 - wet * 0.5;
  }, { normal: 4 });
  if (step) await step();
  // ---- dead leaves over dark soil ----
  drawnSet('leaves', 512, (g, S) => {
    g.fillStyle = '#1f160e'; g.fillRect(0, 0, S, S);
    const cols = [[90, 46, 18], [110, 58, 20], [122, 84, 24], [74, 42, 20], [58, 32, 16], [106, 32, 16], [138, 106, 36], [46, 36, 16]];
    const rnd = mulberry32(77);
    for (let i = 0; i < 1600; i++) {
      const x = rnd() * S, y = rnd() * S, len = 7 + rnd() * 13, w = len * (0.35 + rnd() * 0.2), a = rnd() * TAU, c = cols[(rnd() * cols.length) | 0], k = 0.55 + rnd() * 0.6;
      const fill = `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
      wrapDraw(S, x, y, len, (X, Y) => {
        g.save(); g.translate(X, Y); g.rotate(a); g.fillStyle = fill;
        g.beginPath(); g.moveTo(-len, 0); g.quadraticCurveTo(0, -w, len, 0); g.quadraticCurveTo(0, w, -len, 0); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-len, 0); g.lineTo(len * 1.15, 0); g.stroke(); g.restore();
      });
    }
    for (let i = 0; i < 500; i++) { const x = rnd() * S, y = rnd() * S, a = rnd() * TAU, l = 6 + rnd() * 10; g.strokeStyle = `rgba(${(60 + rnd() * 40) | 0},${(40 + rnd() * 20) | 0},20,.8)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }, { normal: 3, rough: 0.9 });
  if (step) await step();
  // ---- tree bark: deep vertical fissures, plates, lichen ----
  texSet('bark', 512, (u, v, px) => {
    const w = tfb(u, v, 4, 2, 3, 21) * 0.06;
    const r1 = 1 - Math.abs(pvn2((u + w) * 16, v * 4, 16, 4, 22)), r2 = 1 - Math.abs(pvn2((u + w * 1.5) * 40, v * 9, 40, 9, 23)), r3 = 1 - Math.abs(pvn2(u * 90, v * 20, 90, 20, 26));
    const plates = Math.pow(clamp(r1 * 0.55 + r2 * 0.3 + r3 * 0.15, 0, 1), 2.2), n = tfb(u, v, 24, 12, 3, 24);
    let r = lerp(0.02, 0.13, plates), g = lerp(0.015, 0.1, plates), b = lerp(0.011, 0.08, plates);
    const grey = sstep(0.3, 0.8, n) * plates * 0.5; r = lerp(r, 0.17, grey); g = lerp(g, 0.16, grey); b = lerp(b, 0.14, grey);
    const lichen = sstep(0.45, 0.6, tfb(u, v, 6, 6, 3, 25)) * plates * 0.7; r = lerp(r, 0.12, lichen); g = lerp(g, 0.15, lichen); b = lerp(b, 0.07, lichen);
    out(px, r, g, b, 0.85 + n * 0.25); px.h = plates * 0.85 + n * 0.08; px.rough = 0.95;
  }, { normal: 7 });
  if (step) await step();
  // ---- weathered planks ----
  texSet('planks', 512, (u, v, px) => {
    const nb = 6, bi = Math.floor(v * nb), lv = v * nb - bi, seam = hash2(bi, 0, 31), su = (u + seam) % 1, bj = su < 0.5 ? 0 : 1;
    const tint = hash2(bi, bj, 32), warp = tfb(u, v, 2, 6, 3, 33) * 0.6;
    const grain = Math.sin((lv * 3 + warp + u * 0.6) * 38 + tfb(u, v, 8, 24, 2, 34) * 4) * 0.5 + 0.5;
    const kdx = (su - hash2(bi, bj, 35)) * 6, kdy = (lv - 0.5) * 1.5, knot = sstep(0.35, 0.0, Math.sqrt(kdx * kdx + kdy * kdy)) * (hash2(bi, bj, 36) > 0.6 ? 1 : 0);
    const gap = clamp(sstep(0.035, 0.0, Math.min(lv, 1 - lv)) + sstep(0.006, 0.0, Math.min(Math.abs(su - 0.5), su, 1 - su)), 0, 1);
    const wear = tfb(u, v, 6, 6, 4, 37), tg = tint * 0.6 + grain * 0.4, gr = sstep(0.1, 0.6, wear) * 0.55;
    let r = lerp(lerp(0.11, 0.22, tg), 0.15, gr), g = lerp(lerp(0.07, 0.15, tg), 0.14, gr), b = lerp(lerp(0.04, 0.09, tg), 0.13, gr);
    r = lerp(lerp(r, 0.05, knot * 0.8), 0.012, gap); g = lerp(lerp(g, 0.03, knot * 0.8), 0.009, gap); b = lerp(lerp(b, 0.02, knot * 0.8), 0.007, gap);
    out(px, r, g, b, 0.85 + (grain - 0.5) * 0.2); px.h = 0.6 + grain * 0.12 - knot * 0.15 - gap * 0.6 + wear * 0.05; px.rough = 0.78 + wear * 0.12;
  }, { normal: 3.5 });
  if (step) await step();
  // ---- stone / old concrete: soft weathering, few cracks, lichen and moss ----
  texSet('stone', 512, (u, v, px) => {
    const n1 = tfb(u, v, 4, 4, 5, 41), n2 = tfb(u, v, 32, 32, 3, 42), w = worley(u, v, 4, 43);
    const t = clamp(0.5 + n1, 0, 1); let r = lerp(0.09, 0.21, t), g = lerp(0.09, 0.205, t), b = lerp(0.085, 0.195, t);
    const crack = sstep(0.035, 0.0, w[1] - w[0]) * sstep(0.15, 0.4, n1 + 0.3) * 0.8; r = lerp(r, 0.025, crack); g = lerp(g, 0.025, crack); b = lerp(b, 0.025, crack);
    const lichen = sstep(0.5, 0.62, tfb(u, v, 8, 8, 3, 44)) * 0.6; r = lerp(r, 0.16, lichen); g = lerp(g, 0.17, lichen); b = lerp(b, 0.09, lichen);
    const moss = sstep(0.55, 0.75, tfb(u, v, 3, 3, 3, 45)) * 0.7; r = lerp(r, 0.05, moss); g = lerp(g, 0.08, moss); b = lerp(b, 0.025, moss);
    out(px, r, g, b, 0.85 + n2 * 0.25); px.h = 0.5 + n1 * 0.3 + n2 * 0.15 - crack * 0.5; px.rough = 0.92 - moss * 0.15;
  }, { normal: 4 });
  if (step) await step();
  // ---- rusty metal ----
  texSet('rust', 256, (u, v, px) => {
    const n = tfb(u, v, 6, 6, 5, 51), n2 = tfb(u, v, 32, 32, 2, 52), m = sstep(-0.1, 0.25, n), dk = sstep(0.3, 0.6, n) * 0.7;
    let r = lerp(lerp(0.4, 0.22, m), 0.1, dk), g = lerp(lerp(0.4, 0.08, m), 0.04, dk), b = lerp(lerp(0.38, 0.025, m), 0.015, dk);
    const streak = sstep(0.3, 0.8, pvn2(u * 24, v * 2, 24, 2, 53)) * 0.4 * (1 - m); r = lerp(r, 0.15, streak); g = lerp(g, 0.06, streak); b = lerp(b, 0.02, streak);
    out(px, r, g, b, 0.85 + n2 * 0.2); px.h = 0.5 + m * 0.2 + n2 * 0.25 * m; px.rough = 0.45 + m * 0.5;
  }, { normal: 3 });
  if (step) await step();
  // ---- knit fabric ----
  texSet('fabric', 256, (u, v, px) => {
    const x = u * 64, y = v * 128, cell = Math.abs((x % 1) - 0.5) * 2, row = y % 1, knit = Math.sin((row + cell * 0.5) * Math.PI) * 0.5 + 0.5;
    const n = tfb(u, v, 8, 8, 3, 61), fuzz = (hash2(Math.floor(u * 256), Math.floor(v * 256), 62) - 0.5) * 0.12, k = (0.78 + knit * 0.22 + n * 0.1 + fuzz) * 0.7;
    px.r = px.g = px.b = k; px.h = knit * 0.6 + n * 0.2; px.rough = 0.98;
  }, { normal: 2.2 });
  // ---- skin ----
  texSet('skin', 256, (u, v, px) => {
    const n = tfb(u, v, 6, 6, 4, 71), pore = hash2(Math.floor(u * 256), Math.floor(v * 256), 72) > 0.93 ? 1 : 0, k = 0.9 + n * 0.08 - pore * 0.04;
    px.r = k * 0.8; px.g = k * 0.78; px.b = k * 0.76; px.h = 0.5 + n * 0.15 - pore * 0.25; px.rough = 0.62 + n * 0.08;
  }, { normal: 1.2 });
  if (step) await step();
  // ---- old wallpaper: faded damask, water stains, peeling ----
  drawnSet('wallpaper', 512, (g, S) => {
    g.fillStyle = '#6f6a4c'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 64) { g.fillStyle = 'rgba(40,36,20,.18)'; g.fillRect(x, 0, 6, S); g.fillStyle = 'rgba(255,240,200,.07)'; g.fillRect(x + 30, 0, 3, S); }
    const motif = (cx, cy) => { g.save(); g.translate(cx, cy); g.fillStyle = 'rgba(50,45,25,.42)';
      for (let sg = -1; sg <= 1; sg += 2) { g.beginPath(); g.moveTo(0, -38); g.bezierCurveTo(sg * 26, -30, sg * 30, -6, sg * 6, 4); g.bezierCurveTo(sg * 22, 10, sg * 18, 32, 0, 40); g.bezierCurveTo(sg * 8, 22, sg * 4, 14, 0, 10); g.fill(); }
      g.beginPath(); g.arc(0, -4, 6, 0, TAU); g.fillStyle = 'rgba(120,100,50,.35)'; g.fill(); g.restore(); };
    for (let y = 0; y <= S; y += 128) for (let x = 0; x <= S; x += 128) { motif(x + 32, y + 64); motif(x + 96, y); }
    const rnd = mulberry32(81);
    for (let i = 0; i < 9; i++) { const x = rnd() * S, y = rnd() * S, r = 40 + rnd() * 110; wrapDraw(S, x, y, r, (X, Y) => { const gr = g.createRadialGradient(X, Y, r * 0.2, X, Y, r); gr.addColorStop(0, 'rgba(70,50,20,.0)'); gr.addColorStop(0.75, 'rgba(70,50,20,.28)'); gr.addColorStop(0.82, 'rgba(50,34,14,.45)'); gr.addColorStop(1, 'rgba(70,50,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(X, Y, r, 0, TAU); g.fill(); }); }
    for (let i = 0; i < 5; i++) { const x = rnd() * S, y = rnd() * S; g.fillStyle = 'rgba(150,140,120,.65)'; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) g.lineTo(x + (rnd() - 0.3) * 60, y + (rnd() - 0.3) * 50); g.fill(); }
    const img = g.getImageData(0, 0, S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = (y * S + x) * 4, n = tfb(x / S, y / S, 8, 8, 3, 82) * 26 + (hash2(x, y, 83) - 0.5) * 10; d[k] += n; d[k + 1] += n; d[k + 2] += n * 0.8; }
    g.putImageData(img, 0, 0);
  }, { normal: 1.5, rough: 0.9 });
  if (step) await step();
  // ---- foliage cards (alpha) ----
  drawnSet('needles', 512, (g, S) => {
    const rnd = mulberry32(91);
    const needle = (px, py, a, l) => { const gg = (55 + rnd() * 55) | 0, rr = (22 + rnd() * 26) | 0; g.strokeStyle = `rgb(${rr},${gg},${(16 + rnd() * 22) | 0})`; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke(); };
    const twig = (x0, y0, len, ang, w, depth) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      g.strokeStyle = '#2a1e14'; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.lineWidth = 1.4; const n = Math.floor(len / 1.3);
      for (let i = 0; i < n; i++) { const t = i / n, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t, l = (11 + rnd() * 10) * (1 - t * 0.3);
        needle(px, py, ang - 0.9 - rnd() * 0.5, l); needle(px, py, ang + 0.9 + rnd() * 0.5, l); if (rnd() < 0.5) needle(px, py, ang + (rnd() - 0.5) * 0.6, l * 0.8); }
      if (depth < 2) { const k = depth ? 4 : 9; for (let i = 1; i <= k; i++) { const t = i / (k + 1) + (rnd() - 0.5) * 0.04; twig(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, len * (0.5 - t * 0.28) * (depth ? 0.8 : 1), ang + (i % 2 ? 0.75 : -0.75) + (rnd() - 0.5) * 0.35, w * 0.55, depth + 1); } }
    };
    twig(4, S / 2, S - 20, (rnd() - 0.5) * 0.05, 6, 0);
  }, { alpha: true });
  if (step) await step();
  drawnSet('leafclump', 512, (g, S) => {
    const rnd = mulberry32(101), cols = [[60, 58, 26], [74, 58, 22], [90, 46, 18], [46, 52, 22], [106, 74, 24], [58, 36, 18], [36, 48, 26]];
    g.strokeStyle = '#2a1e14'; g.lineWidth = 4; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(S / 2, S); g.quadraticCurveTo(S / 2 + (rnd() - 0.5) * 100, S * 0.6, S / 2 + (rnd() - 0.5) * 360, S * (0.15 + rnd() * 0.4)); g.stroke(); }
    for (let i = 0; i < 620; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * S * 0.45, x = S / 2 + Math.cos(a) * r, y = S * 0.48 + Math.sin(a) * r * 0.9, len = 10 + rnd() * 10, w = len * 0.55, c = cols[(rnd() * cols.length) | 0], k = 0.6 + rnd() * 0.7;
      g.save(); g.translate(x, y); g.rotate(rnd() * TAU); g.fillStyle = `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
      g.beginPath(); g.moveTo(-len, 0); g.quadraticCurveTo(0, -w, len, 0); g.quadraticCurveTo(0, w, -len, 0); g.fill(); g.restore();
    }
  }, { alpha: true });
  drawnSet('grasscard', 256, (g, S) => {
    const rnd = mulberry32(111);
    for (let i = 0; i < 70; i++) {
      const x = 10 + rnd() * (S - 20), h = S * (0.35 + rnd() * 0.62), lean = (rnd() - 0.5) * 60, w = 2 + rnd() * 3, gr = (60 + rnd() * 70) | 0, rr = (40 + rnd() * 70) | 0;
      g.fillStyle = `rgb(${rr},${gr},${(25 + rnd() * 25) | 0})`; g.beginPath(); g.moveTo(x - w, S); g.quadraticCurveTo(x + lean * 0.3, S - h * 0.6, x + lean, S - h); g.quadraticCurveTo(x + lean * 0.3 + 1, S - h * 0.6, x + w, S); g.fill();
    }
  }, { alpha: true });
  drawnSet('cobweb', 256, (g, S) => {
    const rnd = mulberry32(121); g.strokeStyle = 'rgba(230,230,225,.55)'; g.lineWidth = 0.8;
    const spokes = 9; for (let i = 0; i < spokes; i++) { const a = (i / spokes) * Math.PI * 0.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * S * 1.1, Math.sin(a) * S * 1.1); g.stroke(); }
    for (let r = 18; r < S * 1.1; r += 14 + rnd() * 8) { g.beginPath(); for (let i = 0; i <= spokes; i++) { const a = (i / spokes) * Math.PI * 0.5, rr = r + (rnd() - 0.5) * 6; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? g.quadraticCurveTo(Math.cos(a - 0.08) * rr * 0.93, Math.sin(a - 0.08) * rr * 0.93, x, y) : g.moveTo(x, y); } g.stroke(); }
  }, { alpha: true });
  ['stone', 'planks', 'rust', 'bark', 'skin', 'fabric'].forEach(neutralSet);
  if (step) await step();
}
// Grey version of a set (same bumps) so vertex/instance colors can tint it
function neutralSet(name) {
  const src = PBR[name], c = src.canvas, S = c.width, g = c.getContext('2d'), d = g.getImageData(0, 0, S, S).data, out = new Uint8ClampedArray(d.length);
  let mean = 0; for (let i = 0; i < d.length; i += 4) mean += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; mean /= d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / mean * 205; out[i] = out[i + 1] = out[i + 2] = clamp(l, 0, 255); out[i + 3] = 255; }
  const t = new THREE.CanvasTexture(dataCanvas(S, out)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = src.map.anisotropy;
  PBR[name + 'N'] = { map: t, normalMap: src.normalMap, roughnessMap: src.roughnessMap, canvas: c };
}
// A material helper that applies a PBR set with a world-scale repeat
function pbrMat(setName, o = {}) {
  const s = PBR[setName], rep = o.repeat || 1;
  const cl = (t) => { if (!t) return null; const c = t.clone(); c.repeat.set(rep, rep * (o.repeatY || 1)); c.needsUpdate = true; return c; };
  const m = new THREE.MeshStandardMaterial({ map: cl(s.map), normalMap: cl(s.normalMap), roughnessMap: cl(s.roughnessMap), roughness: o.roughness === undefined ? 1 : o.roughness, metalness: o.metalness || 0, color: o.color === undefined ? 0xffffff : o.color, vertexColors: !!o.vertexColors, side: o.side || THREE.FrontSide });
  if (o.normalScale) m.normalScale.set(o.normalScale, o.normalScale);
  if (o.envMapIntensity !== undefined) m.envMapIntensity = o.envMapIntensity;
  return fogify(m);
}
