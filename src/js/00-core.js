// =====================================================================
//  ESCAPE FROM JOURY — core utilities, settings, input
// =====================================================================
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function damp(cur, target, lambda, dt) { return lerp(cur, target, 1 - Math.exp(-lambda * dt)); }

// Seeded RNG so the island is the same every game.
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let srand = mulberry32(31337);
const srnd = (a = 0, b = 1) => a + srand() * (b - a);
// Run fn with Math.random replaced by a seeded generator, so every player in an online game rolls the same dice.
function withSeed(seed, fn) { const real = Math.random; Math.random = mulberry32(seed); try { return fn(); } finally { Math.random = real; } }
// Text that came from another player is never trusted as HTML.
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function cleanName(s) { return String(s || '').replace(/[^A-Za-z0-9 _.\-]/g, '').trim().slice(0, 14) || 'Player'; }

// Value noise
function hash2(ix, iy, seed) { let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul((seed | 0) + 1, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
function fbm(x, y, oct = 4, seed = 0) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; } return s / n; }
// Periodic (tileable) noise for textures
function pvnoise(x, y, P, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), m = (v) => ((v % P) + P) % P;
  const a = hash2(m(ix), m(iy), seed), b = hash2(m(ix + 1), m(iy), seed), c = hash2(m(ix), m(iy + 1), seed), d = hash2(m(ix + 1), m(iy + 1), seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
function tileFbm(u, v, base, oct, seed = 0) { let s = 0, a = 0.5, n = 0, P = base; for (let i = 0; i < oct; i++) { s += a * pvnoise(u * P, v * P, P, seed + i); n += a; a *= 0.5; P *= 2; } return s / n; }

// ---------------------------------------------------------------------
//  Settings
// ---------------------------------------------------------------------
const CFG = (() => {
  const d = { difficulty: 'normal', quality: 'medium', volume: 0.8, sens: 1.0, invert: false, name: '' };
  try { const s = JSON.parse(localStorage.getItem('efj-settings') || '{}'); return Object.assign(d, s); } catch (e) { return d; }
})();
function saveSettings() { try { localStorage.setItem('efj-settings', JSON.stringify(CFG)); } catch (e) { /* storage blocked */ } }

const DIFFS = {
  easy: { name: 'Easy', note: 'Joury is slower, waits longer, and you get more time in the cabin.', startDelay: 35, chaseBase: 2.1, chasePerKid: 0.17, creep: 0, stareLimit: 5.5, catchR: 1.35, tpMin: 17, tpMax: 28, tpDist: [16, 22], cabinFirst: 240, cabinStep: 30, cabinMin: 150, drain: 1 / 260, batteries: 16, penalty: 10, fog: 0.028, enrage: 0.9 },
  normal: { name: 'Normal', note: 'The way Joury wants it. He waits ~25 seconds, then he hunts.', startDelay: 25, chaseBase: 2.6, chasePerKid: 0.2, creep: 0, stareLimit: 4.0, catchR: 1.55, tpMin: 11, tpMax: 20, tpDist: [12, 18], cabinFirst: 180, cabinStep: 30, cabinMin: 105, drain: 1 / 180, batteries: 12, penalty: 15, fog: 0.034, enrage: 1.2 },
  nightmare: { name: 'Nightmare', note: 'Thick fog, few batteries, and Joury creeps even while you watch.', startDelay: 15, chaseBase: 3.15, chasePerKid: 0.22, creep: 0.55, stareLimit: 2.6, catchR: 1.75, tpMin: 7, tpMax: 13, tpDist: [9, 14], cabinFirst: 150, cabinStep: 25, cabinMin: 75, drain: 1 / 125, batteries: 9, penalty: 20, fog: 0.043, enrage: 1.5 },
};
const QUALITY = {
  low: { pr: 0.75, spotShadow: 512, moonShadow: 0, msaa: 0, bloom: false, pointLights: 1, grassFrac: 0.35, fireflyFrac: 0.4, viewDist: 58, fireShadow: false },
  medium: { pr: 1.0, spotShadow: 1024, moonShadow: 0, msaa: 0, bloom: true, pointLights: 3, grassFrac: 0.7, fireflyFrac: 0.75, viewDist: 70, fireShadow: true },
  high: { pr: Math.min(window.devicePixelRatio || 1, 1.5), spotShadow: 2048, moonShadow: 2048, msaa: 4, bloom: true, pointLights: 4, grassFrac: 1, fireflyFrac: 1, viewDist: 85, fireShadow: true },
};
const D = () => DIFFS[CFG.difficulty] || DIFFS.normal;
const Q = () => QUALITY[CFG.quality] || QUALITY.medium;

// ---------------------------------------------------------------------
//  Input: keyboard, pointer lock, click-and-drag fallback
// ---------------------------------------------------------------------
const Input = {
  keys: new Set(), hit: new Set(), dx: 0, dy: 0, skipMoves: 0, locked: false, dragging: false, lockFailed: false, canvas: null,
  init(canvas) {
    this.canvas = canvas;
    addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { if (e.code === 'Enter') Game.onFieldEnter(e.target); return; } // typing a name or room code
      if (Chat.typing) { e.preventDefault(); Chat.key(e); return; }                    // typing a chat message
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.hit.add(e.code);
      this.keys.add(e.code);
      Game.onKey(e);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.dragging = false; });
    document.addEventListener('mousemove', (e) => {
      if (!(this.locked || this.dragging)) return;
      const mx = e.movementX || 0, my = e.movementY || 0;
      // Browsers sometimes report one huge jump right after the pointer locks: ignore it.
      if (this.skipMoves > 0) { this.skipMoves--; return; }
      if (Math.abs(mx) > 220 || Math.abs(my) > 220) return;
      this.dx += mx; this.dy += my;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!Game.wantsLook()) return;
      this.dragging = true;
      this.requestLock();
      e.preventDefault();
    });
    addEventListener('mouseup', () => { this.dragging = false; });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) { this.lockFailed = false; this.skipMoves = 2; HUD.lookHint(false); }
      if (was && !this.locked) Game.onUnlock();
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; HUD.lookHint(true); });
  },
  requestLock() {
    if (this.locked || !this.canvas.requestPointerLock) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { this.lockFailed = true; HUD.lookHint(true); });
    } catch (e) { this.lockFailed = true; HUD.lookHint(true); }
  },
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); },
  down(code) { return this.keys.has(code); },
  endFrame() { this.hit.clear(); this.dx = 0; this.dy = 0; },
};
