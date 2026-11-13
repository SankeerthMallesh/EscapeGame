// =====================================================================
//  GRAPHICS — renderer, camera effect (grain/vignette/static), textures,
//  materials, ground-mist fog patch, geometry builder, glow sprites
// =====================================================================
const POST_FS = `
uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform vec2 uRes; uniform float uTime, uGrain, uStatic, uVignette, uRed, uFade, uFlash, uAberr, uExposure, uWarm, uShake, uBloom, uSat, uLift;
uniform vec3 uShadowTint, uHighTint;
varying vec2 vUv;
float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x){ const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0); }
vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 uv = vUv;
  float t = uTime;
  float row = floor(uv.y * 90.0);
  float tearOn = step(1.0 - uStatic * 0.55, h1(vec2(row * 0.37, floor(t * 14.0))));
  uv.x += (h1(vec2(row, floor(t * 40.0))) - 0.5) * 0.045 * uStatic * tearOn;
  uv.y += sin(t * 31.0) * 0.002 * uShake;
  vec2 dir = uv - 0.5;
  float ab = (uAberr * 0.0022 + uStatic * 0.012) * (0.4 + length(dir));
  vec3 col;
  col.r = texture2D(tDiffuse, uv + dir * ab).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - dir * ab).b;
  col += texture2D(tBloom, uv).rgb * uBloom;
  col *= uExposure;
  col = aces(col);
  // film grade: gentle desaturation, cold shadows, warm highlights, lifted blacks
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSat);
  col *= mix(uShadowTint, uHighTint, smoothstep(0.02, 0.5, lum));
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);
  col = col * (1.0 - uLift) + uLift;
  col = mix(col, col * vec3(1.35, 0.6, 0.55) + vec3(0.05, 0.0, 0.0), uRed);
  col = mix(col, col * vec3(1.08, 0.98, 0.86), uWarm);
  col = toSRGB(col);
  float g = h1(uv * uRes + fract(t * 7.13) * 91.7);
  col += (g - 0.5) * uGrain * (1.2 - lum);
  float sn = h1(floor(uv * uRes / 2.0) + floor(t * 50.0) * 1.7);
  col = mix(col, vec3(sn), clamp(uStatic * 0.34, 0.0, 0.6));
  float band = smoothstep(0.0, 0.02, abs(fract(uv.y * 1.5 - t * 0.35) - 0.5));
  col *= mix(1.0, 0.82 + 0.18 * band, uStatic);
  col *= 1.0 - (uStatic * 0.14) * step(0.5, fract(gl_FragCoord.y * 0.5));
  float r = length(dir * vec2(uRes.x / uRes.y, 1.0));
  col *= mix(1.0, 1.0 - smoothstep(0.3, 1.05, r) * 0.95, uVignette);
  col = mix(col, vec3(1.0, 0.92, 0.88), uFlash);
  col *= 1.0 - uFade;
  gl_FragColor = vec4(col, 1.0);
}`;
const BLOOM_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BLOOM_DOWN = `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uPrefilter; uniform float uExposure; varying vec2 vUv;
void main(){ vec3 s = texture2D(tSrc, vUv).rgb * 4.0; s += texture2D(tSrc, vUv - uTexel).rgb; s += texture2D(tSrc, vUv + uTexel).rgb; s += texture2D(tSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb; s += texture2D(tSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb; s /= 8.0;
  if (uPrefilter > 0.5) { s *= uExposure; float br = max(s.r, max(s.g, s.b)); s *= smoothstep(uThreshold, uThreshold * 2.5, br); s = min(s, vec3(30.0)); }
  gl_FragColor = vec4(s, 1.0); }`;
const BLOOM_UP = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main(){ vec2 t = uTexel; vec3 s = texture2D(tSrc, vUv + vec2(-t.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(t.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, t.y * 2.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, -t.y * 2.0)).rgb;
  s += 2.0 * (texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb + texture2D(tSrc, vUv + vec2(t.x, t.y)).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, -t.y)).rgb);
  gl_FragColor = vec4(s / 12.0, 1.0); }`;

const GFX = {
  renderer: null, rt: null, postMat: null, postScene: null, postCam: null, w: 1, h: 1, time: 0, cams: [], bloomRTs: [],
  fx: { grain: 0.06, static: 0, vignette: 1, red: 0, fade: 0, flash: 0, aberr: 0.5, exposure: 1.0, warm: 0, shake: 0, bloom: 0.9, sat: 0.92, lift: 0.006 },
  init() {
    const canvas = $('c');
    let r;
    try { r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }); }
    catch (e) { return false; }
    this.renderer = r;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uGrain: { value: 0 }, uStatic: { value: 0 }, uVignette: { value: 1 }, uRed: { value: 0 }, uFade: { value: 0 }, uFlash: { value: 0 }, uAberr: { value: 0 }, uExposure: { value: 1 }, uWarm: { value: 0 }, uShake: { value: 0 }, uBloom: { value: 0 }, uSat: { value: 0.85 }, uLift: { value: 0.01 }, uShadowTint: { value: new THREE.Vector3(0.95, 1.0, 1.04) }, uHighTint: { value: new THREE.Vector3(1.06, 1.0, 0.9) } },
      vertexShader: BLOOM_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
    });
    this.downMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.0 }, uPrefilter: { value: 0 }, uExposure: { value: 1 } }, vertexShader: BLOOM_VS, fragmentShader: BLOOM_DOWN, depthTest: false, depthWrite: false });
    this.upMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, vertexShader: BLOOM_VS, fragmentShader: BLOOM_UP, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    this.quad.frustumCulled = false; this.postScene.add(this.quad);
    this.resize();
    addEventListener('resize', () => this.resize());
    return true;
  },
  makeRT() {
    if (this.rt) this.rt.dispose();
    const q = Q();
    const W = Math.max(1, Math.floor(this.w * q.pr)), H = Math.max(1, Math.floor(this.h * q.pr));
    this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: q.msaa, depthBuffer: true });
    this.bloomRTs.forEach((t) => t.dispose()); this.bloomRTs = [];
    if (q.bloom) { let bw = W, bh = H; for (let i = 0; i < 5; i++) { bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); this.bloomRTs.push(new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, depthBuffer: false })); } }
  },
  resize() {
    this.w = innerWidth; this.h = innerHeight;
    const q = Q();
    this.renderer.setPixelRatio(q.pr);
    this.renderer.setSize(this.w, this.h);
    this.makeRT();
    this.postMat.uniforms.uRes.value.set(this.w * q.pr, this.h * q.pr);
    this.cams.forEach((c) => { c.aspect = this.w / this.h; c.updateProjectionMatrix(); });
    Glow.uScale.value = this.h * q.pr * 0.62;
  },
  camera(fov, near, far) { const c = new THREE.PerspectiveCamera(fov, this.w / this.h, near, far); this.cams.push(c); return c; },
  pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.postScene, this.postCam); },
  bloom() {
    const B = this.bloomRTs; if (!B.length) return null;
    const d = this.downMat.uniforms;
    d.tSrc.value = this.rt.texture; d.uTexel.value.set(1 / this.rt.width, 1 / this.rt.height); d.uPrefilter.value = 1; d.uExposure.value = this.fx.exposure; d.uThreshold.value = 0.9;
    this.pass(this.downMat, B[0]); d.uPrefilter.value = 0;
    for (let i = 1; i < B.length; i++) { d.tSrc.value = B[i - 1].texture; d.uTexel.value.set(1 / B[i - 1].width, 1 / B[i - 1].height); this.pass(this.downMat, B[i]); }
    const u = this.upMat.uniforms;
    for (let i = B.length - 1; i > 0; i--) { u.tSrc.value = B[i].texture; u.uTexel.value.set(1 / B[i].width, 1 / B[i].height); this.renderer.autoClear = false; this.pass(this.upMat, B[i - 1]); this.renderer.autoClear = true; }
    return B[0].texture;
  },
  render(scene, cam, dt) {
    this.time += dt;
    const r = this.renderer, u = this.postMat.uniforms, f = this.fx;
    r.info.autoReset = false; r.info.reset();
    r.setRenderTarget(this.rt); r.render(scene, cam);
    this.stats = { calls: r.info.render.calls, tris: r.info.render.triangles };
    const bloomTex = this.bloom();
    u.tDiffuse.value = this.rt.texture; u.tBloom.value = bloomTex || this.rt.texture; u.uBloom.value = bloomTex ? f.bloom * 0.12 : 0; u.uTime.value = this.time;
    u.uGrain.value = f.grain; u.uStatic.value = f.static; u.uVignette.value = f.vignette; u.uRed.value = f.red; u.uFade.value = f.fade;
    u.uFlash.value = f.flash; u.uAberr.value = f.aberr; u.uExposure.value = f.exposure; u.uWarm.value = f.warm; u.uShake.value = f.shake; u.uSat.value = f.sat; u.uLift.value = f.lift;
    this.pass(this.postMat, null);
  },
};

// ---------------------------------------------------------------------
//  Canvas textures
// ---------------------------------------------------------------------
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texFrom(canvas, o = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  if (o.wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (o.nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  t.anisotropy = o.aniso || 4;
  return t;
}
function pixelCanvas(size, fn) {
  const c = makeCanvas(size, size), g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = (y * size + x) * 4, v = fn(x / size, y / size, x, y);
    d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; d[o + 3] = v[3] === undefined ? 255 : v[3];
  }
  g.putImageData(img, 0, 0); return c;
}
const TEX = {};
function buildTextures() {
  // generic detail (used to break up flat vertex colors)
  TEX.detail = texFrom(pixelCanvas(128, (u, v) => { const n = 0.82 + 0.13 * tileFbm(u, v, 8, 4, 2) + 0.05 * (Math.random() - 0.5); const c = clamp(n, 0, 1) * 255; return [c, c, c]; }), { wrap: true });
  // ground: blades, dirt specks
  TEX.ground = texFrom((() => {
    const c = pixelCanvas(256, (u, v) => { const n = 0.74 + 0.2 * tileFbm(u, v, 6, 5, 9) + 0.08 * (Math.random() - 0.5); const c2 = clamp(n, 0, 1) * 255; return [c2, c2 * 0.98, c2 * 0.95]; });
    const g = c.getContext('2d');
    for (let i = 0; i < 900; i++) { const x = Math.random() * 256, y = Math.random() * 256, l = rand(3, 9); g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${rand(0.05, 0.16)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-2, 2), y - l); g.stroke(); }
    return c;
  })(), { wrap: true, aniso: 8 });
  // wood planks
  TEX.wood = texFrom((() => {
    const c = makeCanvas(256, 256), g = c.getContext('2d');
    for (let p = 0; p < 8; p++) {
      const base = 150 + Math.random() * 60; g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, p * 32, 256, 32);
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(0,0,0,${rand(0.05, 0.15)})`; g.lineWidth = rand(0.5, 1.6); g.beginPath(); const y0 = p * 32 + rand(2, 30); g.moveTo(0, y0); for (let x = 0; x <= 256; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.05 + k) * rand(0.5, 2)); g.stroke(); }
      if (Math.random() < 0.6) { g.fillStyle = 'rgba(40,25,10,.35)'; g.beginPath(); g.ellipse(rand(20, 236), p * 32 + 16, rand(3, 6), rand(2, 4), 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, p * 32, 256, 2);
      const seam = rand(30, 220); g.fillRect(seam, p * 32, 2, 32);
    }
    return c;
  })(), { wrap: true, aniso: 8 });
  // stone
  TEX.stone = texFrom(pixelCanvas(256, (u, v) => { const n = 0.62 + 0.3 * tileFbm(u, v, 4, 5, 33) + 0.1 * Math.abs(tileFbm(u, v, 16, 2, 7)) + 0.06 * (Math.random() - 0.5); const c = clamp(n, 0, 1) * 255; return [c, c, c * 0.97]; }), { wrap: true });
  // soft glow sprite
  TEX.glow = texFrom((() => { const c = makeCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; })());
  // mist puff
  TEX.mist = texFrom(pixelCanvas(128, (u, v) => { const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2; const n = 0.6 + 0.4 * tileFbm(u, v, 4, 4, 51); const a = clamp((1 - r) * n, 0, 1); return [255, 255, 255, a * a * 255]; }));
  // water normal map (tileable)
  TEX.waterN = (() => {
    const S = 256, hgt = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) hgt[y * S + x] = tileFbm(x / S, y / S, 6, 5, 77) + 0.35 * Math.sin((x / S) * TAU * 3 + (y / S) * TAU * 2);
    const c = pixelCanvas(S, (u, v, x, y) => {
      const hx = hgt[y * S + ((x + 1) % S)] - hgt[y * S + ((x - 1 + S) % S)], hy = hgt[((y + 1) % S) * S + x] - hgt[((y - 1 + S) % S) * S + x];
      const nx = -hx * 3, ny = -hy * 3, nz = 1, l = Math.hypot(nx, ny, nz);
      return [(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255];
    });
    return texFrom(c, { srgb: false, wrap: true });
  })();
  // grass tuft blades (alpha)
  TEX.blades = texFrom((() => {
    const c = makeCanvas(128, 128), g = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = rand(8, 120), h = rand(55, 124), lean = rand(-22, 22), w = rand(3, 6), s = rand(150, 255) | 0;
      g.fillStyle = `rgb(${s},${s},${s})`; g.beginPath(); g.moveTo(x - w / 2, 128); g.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.5, x + lean, 128 - h); g.quadraticCurveTo(x + lean * 0.3 + 1, 128 - h * 0.5, x + w / 2, 128); g.fill();
    }
    return c;
  })());
  // corn stalk (alpha)
  TEX.corn = texFrom((() => {
    const c = makeCanvas(64, 128), g = c.getContext('2d');
    g.fillStyle = '#bfae7a'; g.fillRect(29, 0, 6, 128);
    for (let i = 0; i < 9; i++) { const y = 20 + i * 11, dir = i % 2 ? 1 : -1; g.fillStyle = i % 3 ? '#a8955f' : '#8c7a48'; g.beginPath(); g.moveTo(32, y); g.quadraticCurveTo(32 + dir * 20, y - 14, 32 + dir * 31, y + rand(-2, 12)); g.quadraticCurveTo(32 + dir * 14, y - 4, 32, y + 5); g.fill(); }
    g.fillStyle = '#d9b75a'; g.fillRect(26, 40, 6, 18); g.fillStyle = '#8b6d2a'; g.fillRect(25, 37, 8, 4);
    return c;
  })());
  // flashlight cookie: hot center, soft ring, dark edge
  TEX.cookie = texFrom((() => {
    const c = makeCanvas(256, 256), g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.18, '#f4f0e6'); gr.addColorStop(0.32, '#b8b2a6'); gr.addColorStop(0.42, '#d6d0c4'); gr.addColorStop(0.55, '#7d786f'); gr.addColorStop(0.82, '#2c2a27'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.globalAlpha = 0.08; for (let i = 0; i < 40; i++) { g.fillStyle = Math.random() < 0.5 ? '#000' : '#fff'; g.beginPath(); g.arc(rand(40, 216), rand(40, 216), rand(4, 18), 0, TAU); g.fill(); }
    return c;
  })());
  // story blocks: crisp pixel noise with a darker rim
  TEX.block = texFrom(pixelCanvas(16, (u, v, x, y) => { const edge = x === 0 || y === 0 || x === 15 || y === 15; const n = (edge ? 0.72 : 0.9) + (hash2(x, y, 5) - 0.5) * 0.16; const c = clamp(n, 0, 1) * 255; return [c, c, c]; }), { nearest: true });
  TEX.beam = texFrom((() => { const c = makeCanvas(4, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return c; })());
}

// ---------------------------------------------------------------------
//  Ground-mist + fog: patched into every lit material so low areas
//  fill with drifting mist. Shared uniforms drive all materials at once.
// ---------------------------------------------------------------------
const FogU = { uTime: { value: 0 }, uMistColor: { value: new THREE.Color(0x2b3542) }, uMistAmt: { value: 0.75 } };
const MIST_GLSL = `
varying vec3 vFogWorld; uniform float uTime; uniform vec3 uMistColor; uniform float uMistAmt;
float mH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mH(i), mH(i+vec2(1,0)), f.x), mix(mH(i+vec2(0,1)), mH(i+vec2(1,1)), f.x), f.y); }`;
function fogify(mat, extra) {
  if (!mat || mat.userData.fogPatched) return mat;
  mat.userData.fogPatched = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    if (prev) prev.call(mat, s, r);
    s.uniforms.uTime = FogU.uTime; s.uniforms.uMistColor = FogU.uMistColor; s.uniforms.uMistAmt = FogU.uMistAmt;
    s.vertexShader = s.vertexShader
      .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying vec3 vFogWorld;\nuniform float uTime;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        { vec4 fwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fwp = instanceMatrix * fwp;
        #endif
          vFogWorld = (modelMatrix * fwp).xyz; }`);
    if (extra && extra.sway) {
      s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        #endif
          transformed.x += sin(uTime * 1.6 + ph) * ${extra.sway.toFixed(3)} * position.y;
          transformed.z += cos(uTime * 1.3 + ph) * ${(extra.sway * 0.6).toFixed(3)} * position.y; }`);
    }
    s.fragmentShader = s.fragmentShader
      .replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\n' + MIST_GLSL)
      .replace('#include <fog_fragment>', `#ifdef USE_FOG
        float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
        float mn = mN(vFogWorld.xz * 0.055 + vec2(uTime * 0.045, uTime * 0.018)) * 0.65 + mN(vFogWorld.xz * 0.16 - vec2(uTime * 0.06, 0.0)) * 0.35;
        float hm = (1.0 - smoothstep(0.4, 2.6 + mn * 1.8, vFogWorld.y)) * smoothstep(2.0, 16.0, vFogDepth) * uMistAmt * (0.45 + 0.55 * mn);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uMistColor, clamp(hm, 0.0, 0.9));
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif`);
  };
  mat.customProgramCacheKey = () => 'mist' + (extra && extra.sway ? 'sway' : '');
  return mat;
}

const MAT = {};
function buildMaterials() {
  const L = (o) => fogify(new THREE.MeshLambertMaterial(o));
  const S = (o) => fogify(new THREE.MeshStandardMaterial(o));
  MAT.plain = pbrMat('stoneN', { vertexColors: true, repeat: 0.6, normalScale: 0.35 });
  MAT.wood = pbrMat('planksN', { vertexColors: true, repeat: 0.9 });
  MAT.stone = pbrMat('stoneN', { vertexColors: true, repeat: 0.5 });
  MAT.metal = pbrMat('rustN', { vertexColors: true, repeat: 1, metalness: 0.35 });
  MAT.rust = pbrMat('rust', { repeat: 1, metalness: 0.5 });
  MAT.glass = S({ vertexColors: true, roughness: 0.08, metalness: 0.4 });
  MAT.tree = pbrMat('barkN', { vertexColors: true, repeat: 1 });
  MAT.bark = pbrMat('bark', { repeat: 1, normalScale: 1.4 });
  MAT.rock = pbrMat('stoneN', { vertexColors: true, repeat: 0.8, normalScale: 1.3 });
  const foliage = (set, o = {}) => { const m = fogify(new THREE.MeshStandardMaterial({ map: PBR[set].map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: o.color || 0xffffff }), o.sway ? { sway: o.sway } : undefined); m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: PBR[set].map, alphaTest: 0.45 }); return m; };
  MAT.needles = foliage('needles', { color: 0xc8d6b8, sway: 0.012 });
  MAT.leaves = foliage('leafclump', { color: 0xd8ccb8, sway: 0.015 });
  MAT.bush = foliage('leafclump', { color: 0x9aa880, sway: 0.03 });
  MAT.grass = foliage('grasscard', { color: 0xb0b890, sway: 0.09 });
  MAT.corn = fogify(new THREE.MeshStandardMaterial({ map: TEX.corn, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), { sway: 0.05 });
  MAT.pumpkin = S({ vertexColors: true, map: PBR.skinN.map, normalMap: PBR.skin.normalMap, roughness: 0.55, emissive: 0x160600 });
  MAT.jackFace = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 2.4, 0.5), transparent: true, depthWrite: false, fog: false });
  MAT.lanternGlass = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 2.6, 1.0) });
  MAT.windowLit = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.9, 0.75) });
  MAT.dark = L({ color: 0x0d0d10 });
}
function applyFoliageDepth(mesh) { if (mesh.material && mesh.material.userData && mesh.material.userData.depth) mesh.customDepthMaterial = mesh.material.userData.depth; return mesh; }

// A faint cone of light in the fog, attached to a camera (flashlight beam)
function makeBeam(color = 0xfff1d6, length = 16, radius = 6.5) {
  const geo = new THREE.ConeGeometry(radius, length, 24, 1, true); geo.translate(0, -length / 2, 0); geo.rotateX(-Math.PI / 2);
  const c = new THREE.Color(color);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Vector3(c.r, c.g, c.b) }, uStrength: { value: 0.0 }, uTime: FogU.uTime },
    vertexShader: 'varying vec3 vView; varying vec3 vLocal; void main(){ vLocal = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 uColor; uniform float uStrength; uniform float uTime; varying vec3 vView; varying vec3 vLocal;
      float hh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){ float d = length(vView); float along = clamp(-vLocal.z / ${length.toFixed(1)}, 0.0, 1.0);
        float dust = 0.75 + 0.25 * sin(vLocal.x * 3.1 + uTime * 0.7) * sin(vLocal.y * 2.7 - uTime * 0.5);
        float a = (1.0 - exp(-d * 0.16)) * pow(1.0 - along, 1.6) * dust;
        gl_FragColor = vec4(uColor * a * uStrength, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 8; return m;
}

// ---------------------------------------------------------------------
//  Builder: merges many primitive parts (each with its own color) into
//  one mesh per material — keeps draw calls low for landmarks.
// ---------------------------------------------------------------------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _sv = new THREE.Vector3(), _pv = new THREE.Vector3(), _col = new THREE.Color();
const GEO = {};
function geoCache(key, make) { return GEO[key] || (GEO[key] = make()); }
function unitBox() { return geoCache('box', () => new THREE.BoxGeometry(1, 1, 1)); }
function mergeGeos(list) {
  let n = 0; list.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  list.forEach((g) => { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += c; });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
// Planar UVs chosen by each vertex's dominant normal axis: textures keep a steady scale.
function boxUV(geo, scale = 1) {
  const p = geo.attributes.position.array, nr = geo.attributes.normal.array, n = p.length / 3, uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const ax = Math.abs(nr[i * 3]), ay = Math.abs(nr[i * 3 + 1]), az = Math.abs(nr[i * 3 + 2]);
    let u, v; if (ay >= ax && ay >= az) { u = p[i * 3]; v = p[i * 3 + 2]; } else if (ax >= az) { u = p[i * 3 + 2]; v = p[i * 3 + 1]; } else { u = p[i * 3]; v = p[i * 3 + 1]; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
class Builder {
  constructor() { this.parts = new Map(); }
  add(geo, key, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, flat = false) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _pv.set(x, y, z); _sv.set(sx, sy, sz); _m4.compose(_pv, _q, _sv); g.applyMatrix4(_m4);
    if (flat) g.computeVertexNormals();
    _col.set(color); const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = _col.r; c[i * 3 + 1] = _col.g; c[i * 3 + 2] = _col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g); return this;
  }
  box(w, h, d, x, y, z, color, key = 'plain', ry = 0, rx = 0, rz = 0) { return this.add(unitBox(), key, color, x, y, z, rx, ry, rz, w, h, d); }
  cyl(rTop, rBot, h, x, y, z, color, key = 'plain', seg = 8, rx = 0, ry = 0, rz = 0) {
    const g = geoCache(`cyl${rTop}_${rBot}_${h}_${seg}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg));
    return this.add(g, key, color, x, y, z, rx, ry, rz);
  }
  // cylinder between two points
  rod(r, a, b, color, key = 'plain', seg = 6) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    const g = new THREE.CylinderGeometry(r, r, len, seg); g.translate(0, len / 2, 0);
    const dir = new THREE.Vector3(dx, dy, dz).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyQuaternion(q); g.translate(a[0], a[1], a[2]);
    this.add(g, key, color); g.dispose(); return this;
  }
  build(o = {}) {
    const group = new THREE.Group();
    for (const [key, list] of this.parts) {
      const geo = mergeGeos(list); boxUV(geo, o.uvScale || 1); geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, o.mats && o.mats[key] ? o.mats[key] : MAT[key]);
      mesh.castShadow = o.cast !== false; mesh.receiveShadow = true; group.add(mesh);
      list.forEach((g) => g.dispose());
    }
    this.parts.clear();
    return group;
  }
}

// ---------------------------------------------------------------------
//  Glow sprites: one additive point cloud per set (lanterns, eyes, etc.)
// ---------------------------------------------------------------------
const Glow = { uScale: { value: 600 } };
const GLOW_VS = `
attribute vec3 aColor; attribute float aSize; attribute float aPhase; attribute float aFlick;
uniform float uTime; uniform float uScale; uniform float uFar;
varying vec3 vColor; varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float fl = 1.0 - aFlick * (0.22 * sin(uTime * 9.0 + aPhase) + 0.14 * sin(uTime * 23.0 + aPhase * 3.1) + 0.08 * sin(uTime * 41.0 + aPhase * 1.7));
  vA = fl * smoothstep(uFar, uFar * 0.35, -mv.z);
  vColor = aColor;
  gl_PointSize = clamp(aSize * uScale / max(-mv.z, 2.2), 0.0, 600.0);
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FS = `varying vec3 vColor; varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.4); gl_FragColor = vec4(vColor * a * vA, 1.0); }`;
class GlowSet {
  constructor(max, far = 70, depthTest = true) {
    this.max = max; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.phase = new Float32Array(max); this.flick = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aPhase', new THREE.BufferAttribute(this.phase, 1)); g.setAttribute('aFlick', new THREE.BufferAttribute(this.flick, 1));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uTime: FogU.uTime, uScale: Glow.uScale, uFar: { value: far } }, vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, depthTest, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5; this.geo = g;
  }
  add(x, y, z, color, size, flick = 0, phase = Math.random() * 100) {
    if (this.n >= this.max) return -1; const i = this.n++;
    this.set(i, x, y, z); this.setColor(i, color); this.size[i] = size; this.flick[i] = flick; this.phase[i] = phase;
    this.geo.setDrawRange(0, this.n); this.dirty(); return i;
  }
  set(i, x, y, z) { this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.geo.attributes.position.needsUpdate = true; }
  setColor(i, c, mult = 1) { _col.set(c); this.col[i * 3] = _col.r * mult; this.col[i * 3 + 1] = _col.g * mult; this.col[i * 3 + 2] = _col.b * mult; this.geo.attributes.aColor.needsUpdate = true; }
  setSize(i, s) { this.size[i] = s; this.geo.attributes.aSize.needsUpdate = true; }
  dirty() { const a = this.geo.attributes; a.position.needsUpdate = a.aColor.needsUpdate = a.aSize.needsUpdate = a.aPhase.needsUpdate = a.aFlick.needsUpdate = true; }
}

// Fireflies: drifting, blinking points
function makeFireflies(points, color = 0xd8ff6a) {
  const n = points.length, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), ph = new Float32Array(n);
  points.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; ph[i] = Math.random() * 100; });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const c = new THREE.Color(color);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: FogU.uTime, uScale: Glow.uScale, uColor: { value: new THREE.Vector3(c.r * 3, c.g * 3, c.b * 3) } },
    vertexShader: `attribute float aPhase; uniform float uTime; uniform float uScale; varying float vA;
      void main(){ vec3 p = position; float t = uTime * 0.35 + aPhase;
        p += vec3(sin(t * 1.3) * 1.6 + sin(t * 0.37) * 2.5, sin(t * 0.9) * 0.7, cos(t * 1.1) * 1.6 + cos(t * 0.29) * 2.5);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float blink = pow(max(0.0, sin(uTime * (0.8 + fract(aPhase) * 0.9) + aPhase * 7.0)), 3.0);
        vA = blink * smoothstep(55.0, 18.0, -mv.z);
        gl_PointSize = clamp(0.16 * uScale / max(-mv.z, 0.1), 0.0, 60.0);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.0); gl_FragColor = vec4(uColor * a * vA, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; return pts;
}

// ---------------------------------------------------------------------
//  Light pool: a fixed number of real point lights follow the nearest
//  lanterns/jack-o'-lanterns, so the light count (and shaders) never change.
// ---------------------------------------------------------------------
class LightPool {
  constructor(scene, max = 4) {
    this.slots = []; this.sources = []; this.timer = 0;
    for (let i = 0; i < max; i++) { const L = new THREE.PointLight(0xffa64d, 0, 12, 2); L.position.set(0, -50, 0); scene.add(L); this.slots.push({ L, src: null, k: 0, next: null }); }
    this.setCount(Q().pointLights);
  }
  setCount(n) { this.slots.forEach((s, i) => { s.L.visible = i < n; }); this.active = n; }
  add(x, y, z, color, intensity, dist = 12, flicker = 0.25) { const s = { pos: new THREE.Vector3(x, y, z), color: new THREE.Color(color), intensity, dist, flicker, phase: Math.random() * 100, on: true }; this.sources.push(s); return s; }
  update(dt, camPos, time) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.3;
      const want = this.sources.filter((s) => s.on).map((s) => ({ s, d: s.pos.distanceToSquared(camPos) })).sort((a, b) => a.d - b.d).slice(0, this.active).map((o) => o.s);
      const used = new Set(this.slots.filter((sl) => want.includes(sl.src)).map((sl) => sl.src));
      for (let i = 0; i < this.active; i++) { const sl = this.slots[i]; if (!want.includes(sl.src)) { const free = want.find((w) => !used.has(w)); sl.next = free || null; if (free) used.add(free); } }
    }
    for (let i = 0; i < this.slots.length; i++) {
      const sl = this.slots[i];
      if (sl.next !== null && sl.next !== sl.src) { sl.k = Math.max(0, sl.k - dt * 6); if (sl.k <= 0) { sl.src = sl.next; sl.next = null; } }
      else { sl.next = null; sl.k = Math.min(1, sl.k + dt * 3); }
      const s = sl.src;
      if (!s || !s.on) { sl.L.intensity = 0; continue; }
      const f = 1 - s.flicker * (0.5 + 0.5 * Math.sin(time * 11 + s.phase) * Math.sin(time * 7.3 + s.phase * 2));
      sl.L.position.copy(s.pos); sl.L.color.copy(s.color); sl.L.distance = s.dist; sl.L.intensity = s.intensity * sl.k * f;
    }
  }
}

// Sky dome with gradient and moon halo
function makeSky(o) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(o.top) }, uMid: { value: new THREE.Color(o.mid) }, uBot: { value: new THREE.Color(o.bot) }, uSunDir: { value: o.sunDir.clone().normalize() }, uSunCol: { value: new THREE.Color(o.sunCol) }, uSunSize: { value: o.sunSize || 0.9995 }, uHalo: { value: o.halo || 0.4 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uTop, uMid, uBot, uSunDir, uSunCol; uniform float uSunSize, uHalo; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = h > 0.0 ? mix(uMid, uTop, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(uMid, uBot, clamp(-h * 4.0, 0.0, 1.0));
        float s = max(dot(d, uSunDir), 0.0);
        c += uSunCol * (pow(s, 12.0) * 0.25 + pow(s, 120.0) * 0.6) * uHalo;
        c += uSunCol * smoothstep(uSunSize, uSunSize + 0.0004, s) * 2.5;
        gl_FragColor = vec4(c, 1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(o.r || 400, 32, 16), mat); m.renderOrder = -10; m.frustumCulled = false; return m;
}
function makeStars(n, r) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = Math.random(), v = rand(0.06, 1); const th = u * TAU, y = v, rr = Math.sqrt(1 - y * y); pos[i * 3] = Math.cos(th) * rr * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = Math.sin(th) * rr * r; ph[i] = Math.random() * 100; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: FogU.uTime, uAlpha: { value: 1 } },
    vertexShader: 'attribute float aPhase; uniform float uTime; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = (0.55 + 0.45 * sin(uTime * (1.0 + fract(aPhase)) + aPhase)) * smoothstep(0.0, 0.35, normalize(position).y); gl_PointSize = 1.0 + fract(aPhase * 3.7) * 1.8; gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w * 0.9999; }',
    fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * vA * uAlpha * 1.4, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; p.renderOrder = -9; return p;
}
function makeMoon(dir, dist, size) {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(56, 56, 4, 64, 64, 60); gr.addColorStop(0, '#fffdf2'); gr.addColorStop(1, '#d9d6c8');
  g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill();
  g.fillStyle = 'rgba(120,118,105,.35)'; [[44, 50, 12], [78, 40, 8], [70, 78, 15], [40, 86, 7], [90, 66, 6]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
  const mat = new THREE.SpriteMaterial({ map: texFrom(c), color: new THREE.Color(2.2, 2.2, 2.0), fog: false, depthWrite: false });
  const s = new THREE.Sprite(mat); s.position.copy(dir.clone().normalize().multiplyScalar(dist)); s.scale.set(size, size, 1); s.renderOrder = -8;
  return s;
}

// Water material: two scrolling ripple layers + sky reflections
function makeWater(color, envMap, opts = {}) {
  const tex = TEX.waterN.clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(opts.repeat || 60, opts.repeat || 60);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.rough || 0.06, metalness: 0.0, normalMap: tex, normalScale: new THREE.Vector2(0.45, 0.45), envMap: envMap || null, envMapIntensity: opts.env || 1.0 });
  mat.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <normalmap_pars_fragment>', '#include <normalmap_pars_fragment>\nvec4 waterN(vec2 uv){ vec3 a = texture2D(normalMap, uv + vec2(uTime * 0.012, uTime * 0.007)).xyz * 2.0 - 1.0; vec3 b = texture2D(normalMap, uv * 1.73 + vec2(-uTime * 0.009, uTime * 0.013)).xyz * 2.0 - 1.0; return vec4(normalize(vec3(a.xy + b.xy, a.z * b.z)) * 0.5 + 0.5, 1.0); }')
      .replace('texture2D( normalMap, vNormalMapUv )', 'waterN( vNormalMapUv )');
  };
  return fogify(mat);
}
