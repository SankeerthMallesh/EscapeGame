// =====================================================================
//  HUMANS — realistic-shaped characters: jointed limbs, shaped torso,
//  faces painted on a sphere, fabric and skin materials.
// =====================================================================
const hmats = new Map();
function clothMat(color, rough = 0.95, opts) {
  const k = 'c' + color + rough + (opts ? JSON.stringify(Object.keys(opts)) : '');
  if (!opts && hmats.has(k)) return hmats.get(k);
  const m = fogify(new THREE.MeshStandardMaterial(Object.assign({ color, map: PBR.fabricN.map, normalMap: PBR.fabric.normalMap, roughness: rough }, opts || {})));
  m.normalScale.set(0.6, 0.6); if (!opts) hmats.set(k, m); return m;
}
function skinMat(color) { const k = 's' + color; if (!hmats.has(k)) hmats.set(k, fogify(new THREE.MeshStandardMaterial({ color, map: PBR.skinN.map, normalMap: PBR.skin.normalMap, roughness: 0.6 }))); return hmats.get(k); }
function plainMat(color, rough = 0.6, metal = 0) { const k = 'p' + color + rough + metal; if (!hmats.has(k)) hmats.set(k, fogify(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }))); return hmats.get(k); }
function capsule(r, len, mat, cast = true) { // hangs down from its pivot (y = 0 .. -len)
  const g = geoCache('cap' + r.toFixed(3) + len.toFixed(3), () => { const c = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 5, 10); c.translate(0, -len / 2, 0); return c; });
  return mesh(g, mat, cast);
}
function css(c) { return '#' + new THREE.Color(c).getHexString(); }
// Face painted on an equirectangular sphere texture: the front (+z) sits at x = W/4.
function faceTexture(o) {
  const W = 512, H = 256, c = makeCanvas(W, H), g = c.getContext('2d'), cx = W / 4, cy = H / 2;
  g.fillStyle = css(new THREE.Color(o.skin).multiplyScalar(0.82)); g.fillRect(0, 0, W, H);
  const shade = g.createRadialGradient(cx, cy + 6, 10, cx, cy, W * 0.42); shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = shade; g.fillRect(0, 0, W, H);
  if (o.paint) o.paint(g, cx, cy);
  if (o.blush !== false) { g.fillStyle = 'rgba(200,60,60,.14)'; [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(cx + s * 30, cy + 16, 13, 8, 0, 0, TAU); g.fill(); }); }
  if (!o.noEyes) {
    [-1, 1].forEach((s) => {
      const ex = cx + s * 22, ey = cy - 4;
      g.fillStyle = 'rgba(40,20,20,.25)'; g.beginPath(); g.ellipse(ex, ey + 1, 13, 9, 0, 0, TAU); g.fill(); // socket shadow
      g.fillStyle = o.sclera || '#eee8e2'; g.beginPath(); g.ellipse(ex, ey, o.wide ? 10 : 9, o.wide ? 7 : 5.5, 0, 0, TAU); g.fill();
      g.fillStyle = o.iris || '#4a2e1a'; g.beginPath(); g.arc(ex + (o.look || 0), ey, 4.5, 0, TAU); g.fill();
      g.fillStyle = '#0a0806'; g.beginPath(); g.arc(ex + (o.look || 0), ey, 2.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(ex + (o.look || 0) - 1.5, ey - 1.5, 1.1, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,15,10,.7)'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(ex, ey, o.wide ? 10 : 9, o.wide ? 7 : 5.5, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.strokeStyle = css(o.brow || 0x2a1a10); g.lineWidth = 3; g.beginPath();
      if (o.angry) { g.moveTo(ex - s * 10, ey - 14); g.lineTo(ex + s * 9, ey - 8); } else if (o.happy) { g.moveTo(ex - 10, ey - 12); g.quadraticCurveTo(ex, ey - 16, ex + 10, ey - 12); } else { g.moveTo(ex - s * 10, ey - 10); g.lineTo(ex + s * 9, ey - 15); }
      g.stroke();
    });
  }
  g.fillStyle = 'rgba(60,30,20,.35)'; [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(cx + s * 4, cy + 12, 2.2, 1.4, 0, 0, TAU); g.fill(); }); // nostrils
  if (o.mouth !== false) {
    g.fillStyle = o.lip || 'rgba(120,40,40,.9)';
    if (o.angry) { g.strokeStyle = 'rgba(80,20,20,.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - 11, cy + 26); g.quadraticCurveTo(cx, cy + 20, cx + 11, cy + 26); g.stroke(); }
    else if (o.happy) { g.strokeStyle = 'rgba(100,30,30,.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - 11, cy + 21); g.quadraticCurveTo(cx, cy + 29, cx + 11, cy + 21); g.stroke(); }
    else { g.fillStyle = '#3a1212'; g.beginPath(); g.ellipse(cx, cy + 24, 5, 4, 0, 0, TAU); g.fill(); }
  }
  if (o.after) o.after(g, cx, cy);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// Profile helper for lathe shapes (points listed bottom → top); front of a lathe ends up facing +z
function lathe(points, segs = 22, depth = 1) {
  const g = new THREE.LatheGeometry(points.map((p) => new THREE.Vector2(p[0], p[1])), segs); g.rotateY(Math.PI); g.scale(1, 1, depth); return g;
}
function makeHuman(o) {
  const P = Object.assign({ legH: 0.6, thigh: 0.3, shin: 0.3, hipW: 0.065, legR: 0.055, torsoH: 0.38, chestW: 0.15, waistW: 0.12, depth: 0.7, neck: 0.04, headR: 0.12, upper: 0.21, fore: 0.2, armR: 0.038 }, o.prop || {});
  const root = new THREE.Group(), c = { root, P };
  const shirt = o.shirtMat || clothMat(o.shirt || 0x666666), pants = o.pantsMat || clothMat(o.pants || 0x30343c), skin = skinMat(o.skin || 0xd9a27a), shoes = plainMat(o.shoes || 0x1d1b1a, 0.55);
  const sleeves = o.sleeveMat || shirt;
  // legs: hip → knee → ankle → foot
  ['L', 'R'].forEach((side, i) => {
    const sx = i ? 1 : -1, hip = new THREE.Group(); hip.position.set(sx * P.hipW, P.legH, 0); root.add(hip);
    hip.add(capsule(P.legR * 1.15, P.thigh + P.legR, pants));
    const knee = new THREE.Group(); knee.position.y = -P.thigh; hip.add(knee);
    knee.add(capsule(P.legR, P.shin, o.shinMat || pants));
    const foot = mesh(geoCache('foot' + P.legR, () => { const b = new THREE.CapsuleGeometry(P.legR * 0.95, P.legR * 2.2, 4, 8); b.rotateX(Math.PI / 2); b.scale(1.05, 0.75, 1); return b; }), shoes);
    foot.position.set(0, -P.shin + P.legR * 0.55, P.legR * 0.9); knee.add(foot);
    c['leg' + side] = hip; c['knee' + side] = knee;
  });
  const torso = new THREE.Group(); torso.position.y = P.legH; root.add(torso); c.torso = torso;
  const T = P.torsoH, cw = P.chestW, ww = P.waistW;
  const body = mesh(geoCache('torso' + T + cw + ww + P.depth, () => lathe([[0.001, -0.02], [ww * 0.85, -0.02], [ww * 1.02, T * 0.12], [ww, T * 0.35], [cw * 0.95, T * 0.62], [cw, T * 0.82], [cw * 0.86, T * 0.95], [P.headR * 0.42, T * 1.0], [0.001, T * 1.01]], 24, P.depth)), o.torsoMat || shirt);
  torso.add(body); c.body = body;
  ['L', 'R'].forEach((side, i) => {
    const sx = i ? 1 : -1, sh = new THREE.Group(); sh.position.set(sx * (cw * 0.98), T * 0.86, 0); torso.add(sh);
    const shoulderBall = mesh(geoCache('shb' + P.armR, () => new THREE.SphereGeometry(P.armR * 1.25, 10, 8)), sleeves); sh.add(shoulderBall);
    sh.add(capsule(P.armR * 1.08, P.upper + P.armR, sleeves));
    const elbow = new THREE.Group(); elbow.position.y = -P.upper; sh.add(elbow);
    elbow.add(capsule(P.armR, P.fore, o.foreMat || sleeves));
    const hand = mesh(geoCache('hand' + P.armR, () => { const b = new THREE.SphereGeometry(P.armR * 1.15, 10, 8); b.scale(0.8, 1.25, 0.6); return b; }), o.handMat || skin);
    hand.position.y = -P.fore - P.armR * 0.6; elbow.add(hand);
    const end = new THREE.Object3D(); end.position.y = -P.fore - P.armR * 1.2; elbow.add(end);
    c['arm' + side] = sh; c['elbow' + side] = elbow; c['hand' + side] = end;
  });
  const neck = mesh(geoCache('neck' + P.headR, () => new THREE.CylinderGeometry(P.headR * 0.36, P.headR * 0.42, P.neck + 0.04, 10)), skin); neck.position.y = T + P.neck / 2; torso.add(neck);
  const head = new THREE.Group(); head.position.y = T + P.neck; torso.add(head); c.head = head;
  const hr = P.headR;
  const faceMat = o.faceMat || fogify(new THREE.MeshStandardMaterial({ map: faceTexture(Object.assign({ skin: o.skin || 0xd9a27a }, o.face || {})), normalMap: PBR.skin.normalMap, roughness: 0.6 }));
  const skull = mesh(geoCache('head' + hr, () => { const g = new THREE.SphereGeometry(hr, 32, 20); g.scale(0.92, 1.08, 1); return g; }), faceMat); skull.position.y = hr * 1.05; head.add(skull); c.headMesh = skull;
  if (!o.noNose) { const nose = mesh(geoCache('nose' + hr, () => { const g = new THREE.SphereGeometry(hr * 0.16, 8, 6); g.scale(0.8, 1, 1); return g; }), skin); nose.position.set(0, hr * 0.95, hr * 0.96); head.add(nose); }
  if (!o.noEars) [-1, 1].forEach((s) => { const ear = mesh(geoCache('ear' + hr, () => { const g = new THREE.SphereGeometry(hr * 0.2, 8, 6); g.scale(0.45, 1, 0.7); return g; }), skin); ear.position.set(s * hr * 0.9, hr * 1.05, -hr * 0.05); head.add(ear); });
  if (o.hair) {
    const hm = clothMat(o.hair, 0.75);
    const top = mesh(geoCache('hairTop' + hr + (o.hairLong ? 'L' : ''), () => { const g = new THREE.SphereGeometry(hr * 1.07, 28, 14, 0, TAU, 0, 1.05); g.scale(0.94, 1.1, 1.04); return g; }), hm); top.position.y = hr * 1.05; head.add(top);
    const back = mesh(geoCache('hairBack' + hr + (o.hairLong ? 'L' : ''), () => { const g = new THREE.SphereGeometry(hr * 1.06, 24, 14, Math.PI * 1.5 - 1.55, 3.1, 0, o.hairLong ? 2.6 : 1.95); g.scale(0.95, 1.1, 1.03); return g; }), hm); back.position.y = hr * 1.05; head.add(back);
    c.hairMeshes = [top, back];
  }
  c.headTop = hr * 2.15; c.eyeY = P.legH + T + P.neck + hr * 1.05; c.height = c.eyeY + hr;
  c.walkT = Math.random() * 10; c.human = true;
  root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return c;
}
function attach(parent, m, x, y, z, rx = 0, ry = 0, rz = 0) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; }

// ---------------- costumed kids ----------------
function realPail() {
  const g = new THREE.Group();
  const body = mesh(pumpkinGeo(false), MAT.pumpkin); body.scale.set(0.11, 0.1, 0.11); body.position.y = -0.1; g.add(body);
  const face = new THREE.Mesh(geoCache('pailFace', () => new THREE.PlaneGeometry(0.15, 0.12)), fogify(new THREE.MeshStandardMaterial({ map: jackFaceTex(), transparent: true, color: 0x111111, roughness: 0.8 }))); face.position.set(0, -0.1, 0.105); g.add(face);
  const handle = mesh(geoCache('pailHandle', () => new THREE.TorusGeometry(0.085, 0.006, 5, 14, Math.PI)), plainMat(0x1a1a1a, 0.5)); handle.position.y = -0.04; g.add(handle);
  [0xe83a7a, 0xffd23a, 0x4ad0ff].forEach((cl, i) => { const cnd = mesh(geoCache('candy', () => new THREE.BoxGeometry(0.035, 0.02, 0.05)), plainMat(cl, 0.3)); cnd.position.set(-0.03 + i * 0.03, -0.035, (i - 1) * 0.02); cnd.rotation.y = i; g.add(cnd); });
  return g;
}
const SKINS = [0xe2b08a, 0xb57d55, 0xf0c9a5, 0x8a5a3a, 0xd49b70, 0xc68e64, 0xe8bc98, 0x9c6a48, 0xdcae88, 0xa8714a];
function makeKid(type) {
  const T = KID_TYPES.find((k) => k.id === type), idx = KID_TYPES.indexOf(T), skin = SKINS[idx];
  let c;
  switch (type) {
    case 'ghost': {
      c = makeHuman({ skin, shirt: 0xb8bbc4, pants: 0xb8bbc4, shoes: 0x2a2a2a, face: { wide: true } });
      [c.torso, c.armL, c.armR].forEach((p) => { p.visible = false; });
      const tex = (() => { const cv = makeCanvas(256, 256), g = cv.getContext('2d'); g.fillStyle = '#d8dade'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${rand(0.02, 0.06)})`; g.fillRect(rand(0, 256), 0, rand(2, 8), 256); }
        g.fillStyle = '#0c0c0e'; [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(128 + s * 13, 30, 7, 10, 0, 0, TAU); g.fill(); }); g.beginPath(); g.ellipse(128, 52, 6, 8, 0, 0, TAU); g.fill(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      const sheet = mesh(geoCache('ghostSheet', () => { const g = lathe([[0.3, 0.1], [0.27, 0.35], [0.24, 0.7], [0.2, 0.95], [0.17, 1.08], [0.15, 1.18], [0.135, 1.27], [0.09, 1.35], [0.001, 1.38]], 28, 0.85); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) < 0.2) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) + Math.sin(a * 7) * 0.05 - 0.05); } } g.computeVertexNormals(); return g; }), fogify(new THREE.MeshStandardMaterial({ map: tex, normalMap: PBR.fabric.normalMap, roughness: 0.95, side: THREE.DoubleSide })));
      c.root.add(sheet); c.sheet = sheet; c.eyeY = 1.2;
      break;
    }
    case 'pumpkin': {
      c = makeHuman({ skin, shirt: 0x2d5a2a, pants: 0x3a2a1a, hair: 0x2a1a10 });
      c.headMesh.visible = false; c.hairMeshes.forEach((m) => { m.visible = false; }); c.head.children.forEach((m) => { if (m !== c.headMesh) m.visible = false; });
      const pk = mesh(pumpkinGeo(true), MAT.pumpkin); pk.scale.setScalar(0.17); pk.position.y = 0.13; c.head.add(pk);
      const face = new THREE.Mesh(geoCache('pkFace', () => new THREE.PlaneGeometry(0.22, 0.2)), MAT.jackFace); face.position.set(0, 0.13, 0.155); c.head.add(face);
      break;
    }
    case 'witch': {
      c = makeHuman({ skin: 0x86b866, shirt: 0x3e2457, pants: 0x3e2457, shoes: 0x111111, hair: 0xc06a28, hairLong: true, face: { lip: '#3a5a2a', iris: '#3a7a3a' } });
      const robe = mesh(geoCache('robe', () => lathe([[0.25, 0.02], [0.2, 0.3], [0.15, 0.6], [0.13, 0.62]], 22, 0.8)), clothMat(0x341c4a)); c.root.add(robe);
      const hat = new THREE.Group(); c.head.add(hat); hat.position.y = 0.22;
      hat.add(mesh(geoCache('brim', () => new THREE.CylinderGeometry(0.26, 0.27, 0.012, 24)), clothMat(0x141218)));
      const cone = mesh(geoCache('witchHat', () => { const g = new THREE.ConeGeometry(0.15, 0.4, 20, 4); g.translate(0, 0.2, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) - (y * y) * 0.6); } g.computeVertexNormals(); return g; }), clothMat(0x141218)); hat.add(cone);
      const band = mesh(geoCache('hatBand', () => new THREE.CylinderGeometry(0.152, 0.155, 0.035, 20)), clothMat(0x6a2a9a)); band.position.y = 0.025; hat.add(band);
      break;
    }
    case 'vampire': {
      c = makeHuman({ skin: 0xd8cfd8, shirt: 0x141218, pants: 0x141218, hair: 0x0a080c, face: { iris: '#6a1010', after: (g, cx, cy) => { g.fillStyle = '#fff'; [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(cx + s * 4, cy + 26); g.lineTo(cx + s * 6, cy + 34); g.lineTo(cx + s * 8, cy + 26); g.fill(); }); } } });
      const front = mesh(geoCache('vampShirt', () => new THREE.PlaneGeometry(0.12, 0.2)), clothMat(0xe8e4e0)); front.position.set(0, c.P.torsoH * 0.72, c.P.chestW * c.P.depth + 0.004); c.torso.add(front);
      const bow = mesh(geoCache('bow', () => new THREE.BoxGeometry(0.06, 0.025, 0.02)), clothMat(0x8a0f1a)); bow.position.set(0, c.P.torsoH * 0.88, c.P.chestW * c.P.depth + 0.01); c.torso.add(bow);
      const capeG = geoCache('cape', () => { const g = new THREE.CylinderGeometry(0.17, 0.32, 0.85, 20, 6, true, Math.PI * 0.55, Math.PI * 0.9); g.translate(0, -0.42, 0); return g; });
      const capeO = mesh(capeG, clothMat(0x0c0a0e, 0.9, { side: THREE.FrontSide })), capeI = mesh(capeG, clothMat(0x7a0a14, 0.9, { side: THREE.BackSide }));
      const cape = new THREE.Group(); cape.add(capeO, capeI); cape.position.set(0, c.P.torsoH * 0.98, -0.02); c.torso.add(cape); c.cape = cape;
      [-1, 1].forEach((s) => { const col = mesh(geoCache('collar', () => new THREE.PlaneGeometry(0.16, 0.2)), clothMat(0x7a0a14, 0.9, { side: THREE.DoubleSide })); col.position.set(s * 0.1, c.P.torsoH + 0.08, -0.06); col.rotation.set(-0.3, s * 0.5, s * 0.25); c.torso.add(col); });
      break;
    }
    case 'skeleton': {
      const bones = (() => { const cv = makeCanvas(256, 256), g = cv.getContext('2d'); g.fillStyle = '#121214'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#d8d4c8'; g.fillRect(124, 40, 8, 180); for (let i = 0; i < 6; i++) { const y = 70 + i * 22; g.beginPath(); g.ellipse(100, y, 22, 5, -0.15, 0, TAU); g.fill(); g.beginPath(); g.ellipse(156, y, 22, 5, 0.15, 0, TAU); g.fill(); } g.beginPath(); g.ellipse(128, 225, 34, 14, 0, 0, TAU); g.fill(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      const skullFace = { noEyes: true, mouth: false, blush: false, after: (g, cx, cy) => { g.fillStyle = '#0a0a0c'; [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(cx + s * 21, cy - 3, 11, 12, 0, 0, TAU); g.fill(); }); g.beginPath(); g.moveTo(cx, cy + 6); g.lineTo(cx - 5, cy + 16); g.lineTo(cx + 5, cy + 16); g.fill(); g.fillRect(cx - 14, cy + 24, 28, 3); for (let x = -12; x <= 12; x += 6) g.fillRect(cx + x, cy + 20, 2, 11); } };
      c = makeHuman({ skin: 0xcfcabc, shirt: 0x121214, pants: 0x121214, shoes: 0x0a0a0a, torsoMat: fogify(new THREE.MeshStandardMaterial({ map: bones, normalMap: PBR.fabric.normalMap, roughness: 0.9 })), handMat: skinMat(0xcfcabc), face: skullFace, noNose: true, noEars: true });
      [['legL', -0.15], ['legR', -0.15], ['kneeL', -0.15], ['kneeR', -0.15], ['armL', -0.11], ['armR', -0.11], ['elbowL', -0.1], ['elbowR', -0.1]].forEach(([k, y]) => { const b = mesh(geoCache('boneStripe', () => new THREE.BoxGeometry(0.025, 0.2, 0.01)), plainMat(0xd8d4c8, 0.7)); b.position.set(0, y, 0.055); c[k].add(b); });
      break;
    }
    case 'cat': {
      c = makeHuman({ skin: 0x1b1b20, shirt: 0x16161a, pants: 0x16161a, shoes: 0x0b0b0e, handMat: clothMat(0x202026), hair: 0x16161a, face: { sclera: '#e8d040', iris: '#c8a020', lip: '#e88aa0', blush: false, after: (g, cx, cy) => { g.fillStyle = '#e88aa0'; g.beginPath(); g.moveTo(cx - 4, cy + 10); g.lineTo(cx + 4, cy + 10); g.lineTo(cx, cy + 15); g.fill(); g.strokeStyle = 'rgba(230,230,230,.8)'; g.lineWidth = 1.2; [-1, 1].forEach((s) => { for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(cx + s * 8, cy + 16 + k * 3); g.lineTo(cx + s * 30, cy + 13 + k * 6); g.stroke(); } }); } } });
      [-1, 1].forEach((s) => { const ear = mesh(geoCache('catEar', () => new THREE.ConeGeometry(0.045, 0.09, 4)), clothMat(0x16161a)); ear.position.set(s * 0.07, 0.25, 0); ear.rotation.z = -s * 0.25; c.head.add(ear); });
      const tail = mesh(geoCache('catTail', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.1, -0.2), new THREE.Vector3(0, 0.1, -0.4), new THREE.Vector3(0.05, 0.35, -0.45)]), 16, 0.022, 6)), clothMat(0x16161a)); tail.position.set(0, c.P.legH - 0.02, -0.08); c.root.add(tail); c.tail = tail;
      break;
    }
    case 'astronaut': {
      c = makeHuman({ skin, shirt: 0xd8dce2, pants: 0xd8dce2, shoes: 0x6a7078, handMat: clothMat(0xb8bec6), hair: 0x3a2412 });
      const helmet = mesh(geoCache('helmet', () => new THREE.SphereGeometry(0.19, 28, 20)), fogify(new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false }))); helmet.position.y = 0.13; c.head.add(helmet); helmet.castShadow = false;
      const ring = mesh(geoCache('helmRing', () => new THREE.TorusGeometry(0.15, 0.025, 8, 24)), plainMat(0xcfd4da, 0.4, 0.3)); ring.rotation.x = Math.PI / 2; ring.position.y = -0.02; c.head.add(ring);
      const pack = mesh(geoCache('pack', () => new THREE.CapsuleGeometry(0.1, 0.16, 4, 10)), clothMat(0xc0c6ce)); pack.scale.set(1.2, 1, 0.6); pack.position.set(0, c.P.torsoH * 0.55, -0.13); c.torso.add(pack);
      const patch = mesh(geoCache('patch', () => new THREE.PlaneGeometry(0.06, 0.04)), plainMat(0xff6a1a, 0.6)); patch.position.set(0.07, c.P.torsoH * 0.78, c.P.chestW * c.P.depth + 0.004); c.torso.add(patch);
      break;
    }
    case 'dino': {
      c = makeHuman({ skin, shirt: 0x3a8a44, pants: 0x3a8a44, shoes: 0x245a2a, handMat: clothMat(0x3a8a44) });
      const hood = mesh(geoCache('dinoHood', () => { const g = new THREE.SphereGeometry(0.15, 24, 16, Math.PI * 0.85, Math.PI * 1.3, 0, 2.1); g.scale(1.05, 1.1, 1.15); return g; }), clothMat(0x3a8a44, 0.9, { side: THREE.DoubleSide })); hood.position.set(0, 0.13, -0.01); c.head.add(hood);
      for (let i = 0; i < 6; i++) { const tooth = mesh(geoCache('tooth', () => new THREE.ConeGeometry(0.012, 0.03, 5)), plainMat(0xf2f0e8, 0.5)); const a = -0.6 + i * 0.24; tooth.position.set(Math.sin(a) * 0.15, 0.25 - Math.abs(a) * 0.04, Math.cos(a) * 0.13); tooth.rotation.x = Math.PI; c.head.add(tooth); }
      [-1, 1].forEach((s) => { const e = mesh(geoCache('dinoEye', () => new THREE.SphereGeometry(0.03, 10, 8)), plainMat(0xf2f0e8, 0.4)); e.position.set(s * 0.07, 0.29, 0.07); c.head.add(e); const pu = mesh(geoCache('dinoPupil', () => new THREE.SphereGeometry(0.014, 8, 6)), plainMat(0x111111, 0.3)); pu.position.set(s * 0.07, 0.295, 0.097); c.head.add(pu); });
      for (let i = 0; i < 5; i++) { const sp = mesh(geoCache('spike', () => new THREE.ConeGeometry(0.035, 0.08, 4)), clothMat(0xd8b02a)); sp.position.set(0, c.P.torsoH * (0.95 - i * 0.18), -0.12); sp.rotation.x = -0.5; c.torso.add(sp); }
      const tail = mesh(geoCache('dinoTail', () => { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.15, -0.25), new THREE.Vector3(0, -0.4, -0.5)]); const g = new THREE.TubeGeometry(curve, 12, 0.07, 8); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const z = -p.getZ(i), k = 1 - clamp(z / 0.55, 0, 0.85); p.setX(i, p.getX(i) * k); p.setY(i, (p.getY(i) + 0.15 * clamp(z / 0.25, 0, 1) - (z > 0.25 ? 0 : 0)) ); } g.computeVertexNormals(); return g; }), clothMat(0x3a8a44)); tail.position.set(0, c.P.legH + 0.05, -0.08); c.root.add(tail); c.tail = tail;
      break;
    }
    case 'bee': {
      const stripes = (() => { const cv = makeCanvas(64, 256), g = cv.getContext('2d'); g.fillStyle = '#e8b81a'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#15151a'; for (let y = 30; y < 256; y += 56) g.fillRect(0, y, 64, 24); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      c = makeHuman({ skin, shirt: 0xe8b81a, pants: 0x15151a, sleeveMat: clothMat(0x15151a), hair: 0x8a5a2a, torsoMat: fogify(new THREE.MeshStandardMaterial({ map: stripes, normalMap: PBR.fabric.normalMap, roughness: 0.9 })) });
      const cap = mesh(geoCache('beeCap', () => new THREE.SphereGeometry(0.135, 20, 10, 0, TAU, 0, 1.2)), clothMat(0x15151a)); cap.position.y = 0.13; c.head.add(cap);
      [-1, 1].forEach((s) => { const a = mesh(geoCache('ant', () => { const g = new THREE.CylinderGeometry(0.005, 0.005, 0.16, 5); g.translate(0, 0.08, 0); return g; }), plainMat(0x15151a, 0.5)); a.position.set(s * 0.05, 0.25, 0.02); a.rotation.z = -s * 0.35; c.head.add(a); const ball = mesh(geoCache('antBall', () => new THREE.SphereGeometry(0.02, 8, 6)), plainMat(0x15151a, 0.4)); ball.position.set(s * 0.105, 0.395, 0.02); c.head.add(ball); });
      const wm = fogify(new THREE.MeshStandardMaterial({ color: 0xdfefff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, roughness: 0.2 }));
      [-1, 1].forEach((s) => { const w = new THREE.Mesh(geoCache('beeWing', () => { const g = new THREE.CircleGeometry(0.16, 16); g.scale(0.6, 1, 1); return g; }), wm); w.position.set(s * 0.12, c.P.torsoH * 0.75, -0.11); w.rotation.set(0, s * 0.6, s * 0.4); c.torso.add(w); c['wing' + s] = w; });
      break;
    }
    case 'hero': {
      const suit = (() => { const cv = makeCanvas(256, 256), g = cv.getContext('2d'); g.fillStyle = '#2a58c8'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#ffd23a'; g.save(); g.translate(128, 120); g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); g.restore(); g.fillStyle = '#c0262b'; g.fillRect(0, 226, 256, 18); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      c = makeHuman({ skin, shirt: 0x2a58c8, pants: 0x2a58c8, shoes: 0xc0262b, hair: 0x2a1a10, torsoMat: fogify(new THREE.MeshStandardMaterial({ map: suit, normalMap: PBR.fabric.normalMap, roughness: 0.8 })), shinMat: clothMat(0xc0262b), face: { paint: (g, cx, cy) => { g.fillStyle = '#121218'; g.beginPath(); g.moveTo(cx - 40, cy - 12); g.quadraticCurveTo(cx, cy - 20, cx + 40, cy - 12); g.lineTo(cx + 38, cy + 5); g.quadraticCurveTo(cx, cy + 2, cx - 38, cy + 5); g.fill(); } } });
      const capeG = geoCache('heroCape', () => { const g = new THREE.PlaneGeometry(0.34, 0.8, 4, 8); g.translate(0, -0.4, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -Math.pow(Math.max(0, -p.getY(i)), 1.5) * 0.12 - Math.abs(p.getX(i)) * 0.15); g.computeVertexNormals(); return g; });
      const cape = mesh(capeG, clothMat(0xb01e24, 0.9, { side: THREE.DoubleSide })); cape.position.set(0, c.P.torsoH * 0.96, -0.1); c.torso.add(cape); c.cape = cape;
      break;
    }
  }
  c.type = type; c.def = T;
  const pail = realPail(); c.handR.add(pail); c.pail = pail;
  c.root.traverse((m) => { if (m.isMesh && m.material && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });
  return c;
}
function animateKid(c, t, mode) {
  const k = c.walkT + t;
  poseReset(c);
  if (mode === 'walk') { poseWalk(c, k * 7, 1); c.armR.rotation.x = -0.35; c.elbowR.rotation.x = -0.5; c.head.rotation.y = Math.sin(k) * 0.1; }
  else if (mode === 'wave') { c.armL.rotation.z = -2.5 + Math.sin(k * 10) * 0.25; c.elbowL.rotation.z = -0.4 + Math.sin(k * 10) * 0.3; c.armR.rotation.x = -0.35; c.elbowR.rotation.x = -0.6; c.head.rotation.x = -0.12; c.torso.position.y = c.P.legH + Math.abs(Math.sin(k * 5)) * 0.02; }
  else if (mode === 'cheer') { const j = Math.abs(Math.sin(k * 6)); c.root.position.y = (c.baseY || 0) + j * 0.25; c.armL.rotation.z = -2.8; c.armR.rotation.z = 2.5; c.armR.rotation.x = -0.3; c.kneeL.rotation.x = c.kneeR.rotation.x = (1 - j) * 0.5; }
  else if (mode === 'scared') {
    const tr = Math.sin(k * 40) * 0.012;
    c.torso.rotation.z = tr; c.torso.rotation.x = 0.12; c.head.rotation.y = Math.sin(k * 0.7) * 0.6 + Math.sin(k * 3.1) * 0.08; c.head.rotation.x = 0.1;
    c.armL.rotation.x = -0.8; c.armL.rotation.z = 0.35; c.elbowL.rotation.x = -1.6; c.armR.rotation.x = -0.35; c.elbowR.rotation.x = -0.6;
    c.legL.rotation.x = -0.25; c.legR.rotation.x = -0.25; c.kneeL.rotation.x = 0.5; c.kneeR.rotation.x = 0.5; c.torso.position.y = c.P.legH - 0.03;
  } else if (mode === 'sit') { c.legL.rotation.x = c.legR.rotation.x = -1.45; c.kneeL.rotation.x = c.kneeR.rotation.x = 1.45; }
  else { c.head.rotation.y = Math.sin(k * 0.5) * 0.3; c.torso.position.y = c.P.legH + Math.sin(k * 2) * 0.006; c.armL.rotation.z = -0.08; c.armR.rotation.z = 0.08; c.elbowR.rotation.x = -0.3; }
  if (c.tail) c.tail.rotation.y = Math.sin(k * 3) * 0.4;
  if (c['wing-1']) { c['wing-1'].rotation.y = -0.6 + Math.sin(k * 40) * 0.4; c.wing1.rotation.y = 0.6 - Math.sin(k * 40) * 0.4; }
  if (c.cape) c.cape.rotation.x = 0.1 + Math.sin(k * 2) * 0.05;
  if (c.sheet) { c.sheet.rotation.y = Math.sin(k * 1.3) * 0.08; c.sheet.position.y = mode === 'cheer' ? 0 : Math.sin(k * 2) * 0.01; }
}

// ---------------- Joury: tall, thin, hooded ----------------
function makeJoury() {
  const P = { legH: 1.06, thigh: 0.52, shin: 0.52, hipW: 0.085, legR: 0.068, torsoH: 0.74, chestW: 0.2, waistW: 0.16, depth: 0.62, neck: 0.1, headR: 0.125, upper: 0.44, fore: 0.44, armR: 0.045 };
  const hoodie = clothMat(0x26252b, 1.0), jeans = clothMat(0x1b2230, 0.95), skin = skinMat(0x8b8c8f);
  const grin = (g, cx, cy) => { g.strokeStyle = 'rgba(150,10,10,.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - 34, cy + 18); g.quadraticCurveTo(cx, cy + 40, cx + 34, cy + 18); g.stroke(); g.fillStyle = '#d8d0c0'; for (let x = -26; x <= 26; x += 6.5) { g.beginPath(); g.moveTo(cx + x - 2.5, cy + 22 + Math.abs(x) * -0.18 + 6); g.lineTo(cx + x + 2.5, cy + 22 + Math.abs(x) * -0.18 + 6); g.lineTo(cx + x, cy + 30 - Math.abs(x) * 0.25); g.fill(); } };
  const faceTex = faceTexture({ skin: 0x5a5b5f, noEyes: true, mouth: false, blush: false, after: (g, cx, cy) => {
    const R = mulberry32(666), rr = (a, b) => a + R() * (b - a);
    // mottled, bloodless skin
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '30,34,30' : '120,110,100'},${rr(0.03, 0.09)})`; g.beginPath(); g.ellipse(cx + rr(-120, 120), cy + rr(-110, 110), rr(2, 14), rr(2, 10), rr(0, 3), 0, TAU); g.fill(); }
    // veins: thin dark branches that spread out from the eyes and temples
    const vein = (x, y, a, len, w) => { for (let k = 0; k < len; k++) { const nx = x + Math.cos(a) * 3, ny = y + Math.sin(a) * 3; g.strokeStyle = `rgba(40,20,40,${0.55 * (1 - k / len)})`; g.lineWidth = w * (1 - k / len) + 0.4; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); x = nx; y = ny; a += rr(-0.5, 0.5); if (R() < 0.08 && w > 0.8) vein(x, y, a + rr(-1.2, 1.2), (len - k) * 0.6, w * 0.6); } };
    [-1, 1].forEach((sd) => { for (let i = 0; i < 4; i++) vein(cx + sd * 34, cy - 8 + rr(-6, 6), sd > 0 ? rr(-1.2, 0.6) : Math.PI + rr(-0.6, 1.2), rr(10, 20), 1.6); });
    for (let i = 0; i < 3; i++) vein(cx + rr(-30, 30), cy - 50, -Math.PI / 2 + rr(-0.8, 0.8), rr(8, 16), 1.4);
    // cracks in the skin
    g.strokeStyle = 'rgba(15,10,10,.55)'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { let x = cx + rr(-60, 60), y = cy + rr(-60, 50); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rr(-7, 7); y += rr(-7, 7); g.lineTo(x, y); } g.stroke(); }
    // deep, sunken sockets with raw red rims
    [-1, 1].forEach((sd) => {
      const ex = cx + sd * 22, ey = cy - 4;
      const rim = g.createRadialGradient(ex, ey, 6, ex, ey, 24); rim.addColorStop(0, 'rgba(0,0,0,1)'); rim.addColorStop(0.55, 'rgba(10,0,0,.95)'); rim.addColorStop(0.75, 'rgba(110,20,25,.55)'); rim.addColorStop(1, 'rgba(60,30,40,0)');
      g.fillStyle = rim; g.beginPath(); g.ellipse(ex, ey, 24, 21, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(0,0,0,.95)'; g.beginPath(); g.ellipse(ex, ey, 14, 12, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,10,10,.45)'; g.beginPath(); g.ellipse(ex, ey + 18, 16, 6, 0, 0, TAU); g.fill(); // dark bags under them
    });
    grin(g, cx, cy);
    // stains running down from the grin
    for (let i = 0; i < 5; i++) { const x = cx + rr(-26, 26), y0 = cy + 30, len = rr(10, 34); const gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, 'rgba(70,5,8,.75)'); gr.addColorStop(1, 'rgba(70,5,8,0)'); g.fillStyle = gr; g.fillRect(x - 1.2, y0, 2.4, len); }
  } });
  const emTex = (() => { const cv = makeCanvas(512, 256), g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256); grin(g, 128, 128); g.fillStyle = '#000'; for (let x = -26; x <= 26; x += 6.5) g.fillRect(128 + x - 3, 128 + 20, 6, 12); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const faceMat = fogify(new THREE.MeshStandardMaterial({ map: faceTex, normalMap: PBR.skin.normalMap, roughness: 0.55, emissive: 0xffffff, emissiveMap: emTex, emissiveIntensity: 2.2 }));
  const c = makeHuman({ prop: P, shirtMat: hoodie, pantsMat: jeans, skin: 0x8b8c8f, shoes: 0x0c0c0c, handMat: skin, faceMat, noEars: true });
  const hr = P.headR;
  // hood: a shell around the head, open at the front, with a drape down the back
  const hood = mesh(geoCache('hood', () => { const g = new THREE.SphereGeometry(hr * 1.5, 28, 18, Math.PI * 0.5 + 0.75, TAU - 1.5, 0, 2.35); g.scale(1, 1.15, 1.08); return g; }), clothMat(0x26252b, 1.0, { side: THREE.DoubleSide })); hood.position.set(0, hr * 1.05, -0.015); c.head.add(hood);
  // the same messy brown fringe he had before, now hanging out of the hood
  const fr = mesh(geoCache('jFringeM', () => { const g = new THREE.SphereGeometry(hr * 1.1, 20, 8, Math.PI * 0.2, Math.PI * 0.62, 0.5, 0.5); g.scale(0.96, 1.08, 1.05); return g; }), clothMat(0x3a2416, 0.8)); fr.position.set(0, hr * 1.05, 0); fr.rotation.y = 0.1; c.head.add(fr);
  const rim = mesh(geoCache('hoodRim', () => new THREE.TorusGeometry(hr * 1.32, 0.025, 6, 20, Math.PI * 1.3)), hoodie); rim.position.set(0, hr * 1.1, hr * 0.85); rim.rotation.set(0.15, 0, -Math.PI * 0.15 - Math.PI * 0.5 + Math.PI * 0.35); c.head.add(rim);
  const drape = mesh(geoCache('hoodDrape', () => { const g = lathe([[0.17, 0], [0.19, 0.08], [0.15, 0.16]], 18, 0.8); return g; }), hoodie); drape.position.y = P.torsoH - 0.06; c.torso.add(drape);
  const pocket = mesh(geoCache('pocket', () => { const g = new THREE.CylinderGeometry(0.17, 0.165, 0.2, 16, 1, true, -0.9, 1.8); return g; }), clothMat(0x1f1e24, 1.0, { side: THREE.DoubleSide })); pocket.scale.z = 0.66; pocket.position.y = P.torsoH * 0.28; c.torso.add(pocket);
  [-1, 1].forEach((s) => { const str = mesh(geoCache('string', () => { const g = new THREE.CylinderGeometry(0.006, 0.006, 0.26, 5); g.translate(0, -0.13, 0); return g; }), plainMat(0x8a1a1f, 0.7)); str.position.set(s * 0.05, P.torsoH * 0.97, P.chestW * P.depth * 0.7); str.rotation.x = -0.12; c.torso.add(str); });
  // long fingers
  ['L', 'R'].forEach((side) => { const el = c['elbow' + side]; for (let f = 0; f < 4; f++) { const fg = capsule(0.008, 0.11, skin); fg.position.set((f - 1.5) * 0.013, -P.fore - P.armR * 1.1, 0.008); fg.rotation.x = 0.15 + f * 0.05; el.add(fg); } });
  // glowing eyes, set deep in the hood
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.12, 0.06) });
  c.eyes = [];
  [-1, 1].forEach((s) => { const e = new THREE.Mesh(geoCache('jeye', () => { const g = new THREE.SphereGeometry(0.016, 10, 8); g.scale(1.3, 0.8, 0.6); return g; }), eyeMat); e.position.set(s * 0.042, hr * 1.12, hr * 0.86); c.head.add(e); c.eyes.push(e); });
  c.eyeGlow = new GlowSet(2, 90, true);
  c.eyeGlow.add(-0.042, hr * 1.12, hr * 0.95, 0xff2010, 0.2, 0.15); c.eyeGlow.add(0.042, hr * 1.12, hr * 0.95, 0xff2010, 0.2, 0.15);
  c.eyeGlow.setColor(0, 0xff2a14, 1.6); c.eyeGlow.setColor(1, 0xff2a14, 1.6); c.head.add(c.eyeGlow.points);
  c.eyeMat = eyeMat;
  const ctrl = makeController(true); ctrl.position.set(0, -0.06, 0.05); ctrl.rotation.x = -0.4; ctrl.scale.setScalar(1.15); c.handR.add(ctrl);
  c.root.scale.setScalar(1.1); c.scaleK = 1.1;
  c.eyeY = (P.legH + P.torsoH + P.neck + hr * 1.12) * 1.1;
  c.root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return c;
}
function animateJoury(c, t, moving, speed, mode) {
  poseReset(c);
  c.eyeGlow.points.visible = mode !== 'scare';
  if (mode === 'stunned') {
    c.torso.rotation.x = 0.5; c.head.rotation.x = 0.6; c.head.rotation.z = Math.sin(t * 2) * 0.2; c.armL.rotation.x = 0.15; c.armR.rotation.x = 0.25; c.kneeL.rotation.x = 0.35; c.kneeR.rotation.x = 0.2; c.legL.rotation.x = -0.2; c.legR.rotation.x = -0.1;
    const f = Math.random() < 0.2 ? 0.2 : 1; c.eyeMat.color.setRGB(3.2 * f, 0.12 * f, 0.06 * f); return;
  }
  c.eyeMat.color.setRGB(3.2, 0.12, 0.06);
  if (mode === 'scare') { c.eyeMat.color.setRGB(2.4, 0.05, 0.02); c.armL.rotation.set(-2.0, 0, -0.35); c.armR.rotation.set(-2.0, 0, 0.35); c.elbowL.rotation.x = -0.5; c.elbowR.rotation.x = -0.5; c.head.rotation.x = -0.12; c.head.rotation.z = Math.sin(t * 50) * 0.08; c.torso.rotation.x = 0.12; return; }
  if (moving) {
    c.walkT += speed * 0.016 * 2.6;
    const s = Math.sin(c.walkT) * 0.5;
    c.legL.rotation.x = -s; c.legR.rotation.x = s; c.kneeL.rotation.x = Math.max(0, Math.sin(c.walkT + 1.4)) * 0.7; c.kneeR.rotation.x = Math.max(0, Math.sin(c.walkT + 1.4 + Math.PI)) * 0.7;
    c.armL.rotation.x = s * 0.35 - 0.15; c.armR.rotation.x = -s * 0.3 - 0.35; c.elbowL.rotation.x = -0.2; c.elbowR.rotation.x = -0.7;
    c.torso.rotation.x = 0.2; c.torso.position.y = c.P.legH + Math.abs(Math.cos(c.walkT)) * 0.04;
    c.head.rotation.z = Math.sin(c.walkT * 0.5) * 0.12 + (Math.random() < 0.03 ? rand(-0.3, 0.3) : 0); c.head.rotation.x = 0.15;
  } else {
    c.armL.rotation.x = -0.08; c.armR.rotation.x = -0.3; c.elbowR.rotation.x = -0.6; c.armL.rotation.z = -0.05; c.kneeL.rotation.x = 0.06; c.kneeR.rotation.x = 0.06;
    c.torso.rotation.x = 0.16; c.torso.position.y = c.P.legH + Math.sin(t * 1.3) * 0.008;
    c.head.rotation.z = Math.sin(t * 0.9) * 0.18 + (Math.random() < 0.02 ? rand(-0.35, 0.35) : 0); c.head.rotation.x = 0.12 + Math.sin(t * 0.6) * 0.05;
  }
}
// Realistic versions of Joury and Vivek as regular kids (story slide 3)
function makeGamerHuman(who, mood) {
  if (who === 'joury') {
    // before he "crashed out": wavy brown hair with a fringe, a big grin, white tee with an orange stripe
    const c = makeHuman({ skin: 0xd6a07a, shirt: 0xeceae6, pants: 0x2b2b33, shoes: 0x111111, hair: 0x4a2e1c, face: { angry: mood === 'angry', happy: mood !== 'angry', look: 1.5, brow: 0x3a2414,
      after: mood === 'angry' ? null : (g, cx, cy) => { g.fillStyle = '#f4efe6'; g.beginPath(); g.moveTo(cx - 12, cy + 21); g.quadraticCurveTo(cx, cy + 31, cx + 12, cy + 21); g.quadraticCurveTo(cx, cy + 25, cx - 12, cy + 21); g.fill(); } } });
    const hr = c.P.headR, hm = clothMat(0x4a2e1c, 0.75);
    // fringe swept to one side, and wavy tufts over the ears
    const fringe = mesh(geoCache('jFringe', () => { const g = new THREE.SphereGeometry(hr * 1.09, 24, 10, Math.PI * 0.18, Math.PI * 0.75, 0.55, 0.62); g.scale(0.96, 1.08, 1.06); return g; }), hm);
    fringe.position.set(0, hr * 1.05, 0); fringe.rotation.y = 0.12; c.head.add(fringe);
    [-1, 1].forEach((sd) => { const tuft = mesh(geoCache('jTuft', () => { const g = new THREE.SphereGeometry(hr * 0.42, 10, 8); g.scale(0.55, 1, 0.9); return g; }), hm); tuft.position.set(sd * hr * 0.86, hr * 0.98, -hr * 0.1); c.head.add(tuft); });
    const stripe = mesh(geoCache('jStripe', () => new THREE.BoxGeometry(0.06, 0.012, 0.01)), plainMat(0xff6a1a, 0.6)); stripe.position.set(0.05, c.P.torsoH * 0.78, c.P.chestW * c.P.depth * 0.98); stripe.rotation.z = 0.25; c.torso.add(stripe);
    return c;
  }
  return makeHuman({ skin: 0xa8714a, shirt: 0x2f6fd6, pants: 0x2c3446, shoes: 0xe8e8e8, hair: 0x15120f, face: { happy: true, look: -1.5 } });
}
