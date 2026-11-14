// =====================================================================
//  MODELS — blocky characters (kids, Joury, Vivek) and props
// =====================================================================
const matCache = new Map();
function lam(color, o) {
  if (!o) { const k = 'L' + new THREE.Color(color).getHexString(); if (!matCache.has(k)) matCache.set(k, fogify(new THREE.MeshLambertMaterial({ color }))); return matCache.get(k); }
  return fogify(new THREE.MeshLambertMaterial(Object.assign({ color }, o)));
}
function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; }
function boxMesh(w, h, d, mat, cast = true) { const m = mesh(unitBox(), mat, cast); m.scale.set(w, h, d); return m; }

// --- pixel faces (16x16 logical grid) ---
function faceCanvas(bg, draw) {
  const c = makeCanvas(64, 64), g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x * 4, y * 4, w * 4, h * 4); };
  draw(P, g); return c;
}
function eyes(P, y = 7, o = {}) {
  const w = o.white || '#f7f4ee', p = o.pupil || '#18161d', ls = o.lx || 3, rs = o.rx || 10;
  P(ls, y, 3, 3, w); P(rs, y, 3, 3, w);
  const dx = o.look === undefined ? 1 : o.look; P(ls + dx, y + 1, 1, 1, p); P(rs + dx, y + 1, 1, 1, p);
  if (o.big) { P(ls + dx, y + 1, 2, 2, p); P(rs + dx, y + 1, 2, 2, p); }
}
function kidFace(skin, hair, o = {}) {
  return faceCanvas(skin, (P) => {
    if (hair) { P(0, 0, 16, 3, hair); P(0, 3, 3, 1, hair); P(6, 3, 5, 1, hair); P(13, 3, 3, 1, hair); }
    const brow = o.brow || '#3a2418';
    if (o.angry) { P(3, 5, 1, 1, brow); P(4, 6, 2, 1, brow); P(12, 5, 1, 1, brow); P(10, 6, 2, 1, brow); }
    else if (o.happy) { P(3, 5, 3, 1, brow); P(10, 5, 3, 1, brow); }
    else { P(3, 6, 2, 1, brow); P(5, 5, 1, 1, brow); P(11, 6, 2, 1, brow); P(10, 5, 1, 1, brow); }
    eyes(P, 7, { look: o.look });
    if (o.paint) o.paint(P);
    P(1, 10, 2, 1, 'rgba(255,110,110,.45)'); P(13, 10, 2, 1, 'rgba(255,110,110,.45)');
    if (o.angry) { P(5, 12, 6, 1, '#4a1414'); P(4, 13, 1, 1, '#4a1414'); P(11, 13, 1, 1, '#4a1414'); }
    else if (o.happy) { P(5, 11, 1, 1, '#4a1a1a'); P(6, 12, 4, 1, '#4a1a1a'); P(10, 11, 1, 1, '#4a1a1a'); }
    else { P(7, 11, 2, 2, '#4a1a1a'); }
    if (o.fangs) { P(6, 13, 1, 1, '#fff'); P(9, 13, 1, 1, '#fff'); }
    if (o.mask) { P(1, 6, 14, 1, o.mask); P(1, 7, 2, 3, o.mask); P(6, 7, 4, 3, o.mask); P(13, 7, 2, 3, o.mask); P(1, 10, 14, 1, o.mask); }
  });
}

// --- generic blocky body ---
function makeBlocky(o) {
  const P = Object.assign({ legH: 0.44, legW: 0.17, bodyH: 0.5, bodyW: 0.44, bodyD: 0.26, head: 0.44, armW: 0.14, armH: 0.48 }, o.prop || {});
  const root = new THREE.Group();
  const skin = o.skin || 0xd9a27a, shirt = o.shirt || 0x777777, pants = o.pants || 0x333344, shoes = o.shoes || 0x1d1d22;
  const mSleeve = lam(o.sleeves || shirt), mHand = lam(o.hands || skin), mPants = lam(pants), mShoe = lam(shoes);
  const mBody = o.bodyMat || lam(shirt);
  const c = { root, P };
  // legs
  ['L', 'R'].forEach((s, i) => {
    const piv = new THREE.Group(); piv.position.set((i ? 1 : -1) * (P.legW / 2 + 0.008), P.legH, 0); root.add(piv);
    const leg = boxMesh(P.legW, P.legH - 0.08, P.legW * 1.15, mPants); leg.position.y = -(P.legH - 0.08) / 2; piv.add(leg);
    const shoe = boxMesh(P.legW * 1.05, 0.09, P.legW * 1.45, mShoe); shoe.position.set(0, -P.legH + 0.045, 0.025); piv.add(shoe);
    c['leg' + s] = piv;
  });
  const torso = new THREE.Group(); torso.position.y = P.legH; root.add(torso); c.torso = torso;
  const body = boxMesh(P.bodyW, P.bodyH, P.bodyD, mBody); body.position.y = P.bodyH / 2; torso.add(body); c.body = body;
  ['L', 'R'].forEach((s, i) => {
    const piv = new THREE.Group(); piv.position.set((i ? 1 : -1) * (P.bodyW / 2 + P.armW / 2 + 0.005), P.bodyH - 0.06, 0); torso.add(piv);
    const arm = boxMesh(P.armW, P.armH - 0.1, P.armW, mSleeve); arm.position.y = -(P.armH - 0.1) / 2 + 0.04; piv.add(arm);
    const hand = boxMesh(P.armW * 0.95, 0.1, P.armW * 0.95, mHand); hand.position.y = -P.armH + 0.1; piv.add(hand);
    const end = new THREE.Object3D(); end.position.y = -P.armH + 0.06; piv.add(end);
    c['arm' + s] = piv; c['hand' + s] = end;
  });
  const headPiv = new THREE.Group(); headPiv.position.y = P.bodyH; torso.add(headPiv); c.head = headPiv;
  const side = lam(o.headSide || skin), top = lam(o.headTop || o.hair || skin), back = lam(o.headBack || o.hair || skin);
  const front = o.faceMat || lam(0xffffff, { map: texFrom(o.face || kidFace(new THREE.Color(skin).getStyle(), null), { nearest: true }) });
  const hs = P.head, head = mesh(unitBox(), [side, side, top, side, front, back]); head.scale.set(hs, hs, hs); head.position.y = hs / 2; headPiv.add(head); c.headMesh = head;
  if (o.hair && o.hairSides !== false) { // hair cap overhang
    const cap = boxMesh(hs + 0.03, hs * 0.22, hs + 0.03, lam(o.hair)); cap.position.y = hs - hs * 0.08; headPiv.add(cap);
    const bk = boxMesh(hs + 0.03, hs * 0.55, 0.04, lam(o.hair)); bk.position.set(0, hs * 0.62, -hs / 2 - 0.005); headPiv.add(bk);
  }
  c.height = P.legH + P.bodyH + P.head;
  c.walkT = Math.random() * 10;
  return c;
}
function poseWalk(c, t, amt) {
  const s = Math.sin(t) * 0.75 * amt;
  c.armL.rotation.x = s; c.armR.rotation.x = -s; c.legL.rotation.x = -s; c.legR.rotation.x = s;
  if (c.kneeL) { c.kneeL.rotation.x = Math.max(0, Math.sin(t + 1.4)) * 0.9 * amt; c.kneeR.rotation.x = Math.max(0, Math.sin(t + 1.4 + Math.PI)) * 0.9 * amt; c.elbowL.rotation.x = -0.25 * amt - Math.max(0, s) * 0.4; c.elbowR.rotation.x = -0.25 * amt - Math.max(0, -s) * 0.4; }
  c.torso.position.y = c.P.legH + Math.abs(Math.cos(t)) * 0.03 * amt;
}
function poseReset(c) { ['armL', 'armR', 'legL', 'legR', 'head', 'torso', 'kneeL', 'kneeR', 'elbowL', 'elbowR'].forEach((k) => { if (c[k]) c[k].rotation.set(0, 0, 0); }); c.torso.position.y = c.P.legH; }

// --- costume kids ---
const KID_TYPES = [
  { id: 'ghost', name: 'Ghost', line: "I'm not even a real ghost! Get me out of here!", icon: ['..WWWW..', '.WWWWWW.', 'WWKWWKWW', 'WWKWWKWW', 'WWWWWWWW', 'WWWKKWWW', 'WWWWWWWW', 'W.WW.WW.'] },
  { id: 'pumpkin', name: 'Pumpkin Head', line: 'My candy is getting cold… please help!', icon: ['...GG...', '.OOOOOO.', 'OOYOOYOO', 'OYYOOYYO', 'OOOOOOOO', 'OYOYYOYO', 'OOYYYYOO', '.OOOOOO.'] },
  { id: 'witch', name: 'Witch', line: 'My spells don\'t work on HIM!', icon: ['....KK..', '...KKK..', '..KKKK..', 'KKKKKKKK', '.LLLLLL.', '.LKLLKL.', '.LLLLLL.', '..LRRL..'] },
  { id: 'vampire', name: 'Vampire', line: 'I want my mom. And my candy. Mostly my mom.', icon: ['.KKKKKK.', 'KKKPPKKK', 'KPPPPPPK', 'KPKPPKPK', 'KPPPPPPK', 'RPPWWPPR', 'RRPPPPRR', 'RR....RR'] },
  { id: 'skeleton', name: 'Skeleton', line: "I'm shaking so hard my bones are rattling!", icon: ['.WWWWWW.', 'WWWWWWWW', 'WKKWWKKW', 'WKKWWKKW', 'WWWKKWWW', '.WWWWWW.', '.WKWKWK.', '..WWWW..'] },
  { id: 'cat', name: 'Black Cat', line: 'Meow? I mean — HELP!', icon: ['K......K', 'KK....KK', 'KKKKKKKK', 'KYKKKKYK', 'KKKKKKKK', 'KWKPPKWK', 'KKKKKKKK', '.KKKKKK.'] },
  { id: 'astronaut', name: 'Astronaut', line: 'Houston, we have a Joury problem.', icon: ['.WWWWWW.', 'WWWWWWWW', 'WBBBBBBW', 'WBCBBBBW', 'WBBBBBBW', 'WWWWWWWW', '.WWOOWW.', '.WWWWWW.'] },
  { id: 'dino', name: 'Dino', line: 'RAWR! …that was a scared rawr.', icon: ['..GGGG..', '.GWGGWG.', 'GGGGGGGG', 'GWGWGWGW', 'GSSSSSSG', 'GSKSSKSG', 'GSSSSSSG', 'GSSRRSSG'] },
  { id: 'bee', name: 'Bee', line: 'Bzzz… please bee quick!', icon: ['.K....K.', '..K..K..', '.YYYYYY.', 'YKKKKKKY', 'YYYYYYYY', 'KKKKKKKK', 'YYYYYYYY', '.KKKKKK.'] },
  { id: 'hero', name: 'Superhero', line: "Even heroes need saving sometimes, okay?!", icon: ['.BBBBBB.', 'BBBBBBBB', 'BSSSSSSB', 'KKKKKKKK', 'KWSKKSWK', 'SSSSSSSS', 'SSRRRRSS', '.SSSSSS.'] },
];
const ICON_PAL = { W: '#f2f2ee', K: '#17171c', O: '#ff8a1c', Y: '#ffd23a', G: '#3fa34d', L: '#8fd14f', S: '#e9b38c', P: '#d2cad8', R: '#d22b2b', B: '#2f62d6', C: '#9fe8ff', D: '#1f6b2a' };

function candyPail() {
  const g = new THREE.Group();
  const pail = mesh(geoCache('pail', () => new THREE.CylinderGeometry(0.1, 0.085, 0.14, 10)), lam(0xff7a10, { emissive: 0x220a00 }));
  pail.position.y = -0.1; g.add(pail);
  const face = new THREE.Mesh(geoCache('pailface', () => new THREE.PlaneGeometry(0.12, 0.08)), lam(0xffffff, { map: texFrom(faceCanvas('#ff7a10', (P) => { P(3, 4, 3, 3, '#201000'); P(10, 4, 3, 3, '#201000'); P(3, 10, 10, 2, '#201000'); P(5, 9, 2, 1, '#201000'); P(9, 9, 2, 1, '#201000'); }), { nearest: true }) }));
  face.position.set(0, -0.1, 0.1); g.add(face);
  const handle = mesh(geoCache('handle', () => new THREE.TorusGeometry(0.09, 0.008, 4, 10, Math.PI)), lam(0x222222)); handle.position.y = -0.04; g.add(handle);
  const candy = boxMesh(0.12, 0.04, 0.12, lam(0xe83a7a)); candy.position.y = -0.03; g.add(candy);
  return g;
}

function makeKidBlocky(type) {
  const T = KID_TYPES.find((k) => k.id === type);
  let c;
  const skins = [0xe0ac84, 0xb57d55, 0xf0c9a5, 0x8a5a3a, 0xd49b70];
  const skin = skins[KID_TYPES.indexOf(T) % skins.length];
  const skinS = new THREE.Color(skin).getStyle();
  switch (type) {
    case 'ghost': {
      const face = faceCanvas('#c9ccd6', (P) => { P(3, 6, 3, 4, '#111'); P(10, 6, 3, 4, '#111'); P(6, 11, 4, 3, '#111'); });
      c = makeBlocky({ skin: 0xc9ccd6, shirt: 0xc9ccd6, pants: 0xc9ccd6, shoes: 0xb4b7c2, hands: 0xc9ccd6, face, prop: { head: 0.48 } });
      const hem = boxMesh(0.62, 0.52, 0.42, lam(0xc9ccd6)); hem.position.set(0, 0.3, 0); c.root.add(hem);
      for (let i = 0; i < 6; i++) { const t = boxMesh(0.1, 0.1, 0.42, lam(0xb8bbc6)); t.position.set(-0.26 + i * 0.104, 0.03 + (i % 2) * 0.03, 0); c.root.add(t); }
      const puff = boxMesh(0.4, 0.08, 0.4, lam(0xc9ccd6)); puff.position.y = 0.5; c.head.add(puff);
      break;
    }
    case 'pumpkin': {
      const fc = faceCanvas('#e8730f', (P) => { for (let x = 1; x < 16; x += 4) P(x, 0, 1, 16, '#c95d08'); P(3, 5, 3, 3, '#ffd23a'); P(4, 4, 1, 1, '#ffd23a'); P(10, 5, 3, 3, '#ffd23a'); P(11, 4, 1, 1, '#ffd23a'); P(3, 10, 10, 2, '#ffd23a'); P(4, 12, 2, 1, '#ffd23a'); P(8, 12, 2, 1, '#ffd23a'); P(6, 9, 1, 1, '#ffd23a'); P(10, 9, 1, 1, '#ffd23a'); });
      const em = faceCanvas('#000', (P) => { P(3, 5, 3, 3, '#ffb21a'); P(4, 4, 1, 1, '#ffb21a'); P(10, 5, 3, 3, '#ffb21a'); P(11, 4, 1, 1, '#ffb21a'); P(3, 10, 10, 2, '#ffb21a'); P(4, 12, 2, 1, '#ffb21a'); P(8, 12, 2, 1, '#ffb21a'); });
      const faceMat = fogify(new THREE.MeshLambertMaterial({ map: texFrom(fc, { nearest: true }), emissive: 0xffffff, emissiveMap: texFrom(em, { nearest: true }), emissiveIntensity: 2.2 }));
      c = makeBlocky({ skin, shirt: 0x2f6b2f, pants: 0x3a2a1a, headSide: 0xe8730f, headTop: 0xe8730f, headBack: 0xe8730f, faceMat, prop: { head: 0.5 } });
      const stem = boxMesh(0.07, 0.12, 0.07, lam(0x4a6b22)); stem.position.y = 0.55; c.head.add(stem);
      const leaf = boxMesh(0.16, 0.02, 0.08, lam(0x3f8a2a)); leaf.position.set(0.08, 0.52, 0); leaf.rotation.z = -0.3; c.head.add(leaf);
      break;
    }
    case 'witch': {
      c = makeBlocky({ skin: 0x8fc96b, shirt: 0x4b2a6b, pants: 0x4b2a6b, sleeves: 0x4b2a6b, shoes: 0x111111, hair: 0xd9772b, face: kidFace('#8fc96b', '#d9772b', { paint: (P) => P(12, 11, 1, 1, '#4d7a35') }) });
      const skirt = boxMesh(0.56, 0.4, 0.38, lam(0x3d2158)); skirt.position.y = 0.24; c.root.add(skirt);
      const brim = mesh(geoCache('brim', () => new THREE.CylinderGeometry(0.42, 0.42, 0.03, 16)), lam(0x15121a)); brim.position.y = 0.46; c.head.add(brim);
      const cone = mesh(geoCache('witchcone', () => new THREE.ConeGeometry(0.22, 0.55, 12)), lam(0x15121a)); cone.position.set(0, 0.74, -0.03); cone.rotation.x = -0.18; c.head.add(cone);
      const band = mesh(geoCache('witchband', () => new THREE.CylinderGeometry(0.215, 0.225, 0.05, 12)), lam(0x7a3fb0)); band.position.y = 0.5; c.head.add(band);
      break;
    }
    case 'vampire': {
      c = makeBlocky({ skin: 0xd2cad8, shirt: 0x18141a, pants: 0x18141a, hair: 0x0e0b10, face: kidFace('#d2cad8', '#0e0b10', { fangs: true, paint: (P) => { P(7, 3, 2, 1, '#0e0b10'); } }) });
      const vest = boxMesh(0.2, 0.3, 0.02, lam(0xf2eee8)); vest.position.set(0, 0.32, 0.135); c.torso.add(vest);
      const tie = boxMesh(0.08, 0.06, 0.02, lam(0xa0101a)); tie.position.set(0, 0.44, 0.15); c.torso.add(tie);
      const cape = boxMesh(0.66, 0.92, 0.04, lam(0x14080c)); cape.position.set(0, 0.06, -0.16); cape.rotation.x = 0.08; c.torso.add(cape);
      const capeIn = boxMesh(0.6, 0.86, 0.02, lam(0x8a0f1a)); capeIn.position.set(0, 0.07, -0.135); capeIn.rotation.x = 0.08; c.torso.add(capeIn);
      [-1, 1].forEach((s) => { const col = boxMesh(0.26, 0.3, 0.03, lam(0x8a0f1a)); col.position.set(s * 0.2, 0.58, -0.12); col.rotation.set(-0.3, 0, s * 0.35); c.torso.add(col); });
      break;
    }
    case 'skeleton': {
      const ribs = faceCanvas('#141418', (P) => { P(7, 1, 2, 14, '#e9e6dc'); for (let y = 3; y < 12; y += 2) { P(3, y, 4, 1, '#e9e6dc'); P(9, y, 4, 1, '#e9e6dc'); } P(4, 13, 8, 2, '#e9e6dc'); });
      const bodyMat = [lam(0x141418), lam(0x141418), lam(0x141418), lam(0x141418), lam(0xffffff, { map: texFrom(ribs, { nearest: true }) }), lam(0x141418)];
      const skull = faceCanvas('#d2cec2', (P) => { P(2, 5, 4, 4, '#0d0d10'); P(10, 5, 4, 4, '#0d0d10'); P(7, 9, 2, 2, '#0d0d10'); for (let x = 4; x < 12; x += 2) P(x, 12, 1, 2, '#0d0d10'); P(4, 12, 8, 1, '#0d0d10'); });
      c = makeBlocky({ skin: 0xd2cec2, shirt: 0x141418, pants: 0x141418, sleeves: 0x141418, hands: 0xd2cec2, face: skull, bodyMat, headSide: 0xd2cec2, headTop: 0xd2cec2, headBack: 0xd2cec2 });
      ['legL', 'legR', 'armL', 'armR'].forEach((k) => { const b = boxMesh(0.04, 0.3, 0.02, lam(0xe9e6dc), false); b.position.set(0, -0.22, 0.08); c[k].add(b); });
      break;
    }
    case 'cat': {
      const face = faceCanvas('#1a1a1f', (P) => { P(3, 7, 3, 3, '#ffd23a'); P(10, 7, 3, 3, '#ffd23a'); P(4, 7, 1, 3, '#111'); P(11, 7, 1, 3, '#111'); P(7, 10, 2, 1, '#ff8fb0'); P(7, 11, 2, 1, '#333'); P(0, 10, 4, 1, '#ddd'); P(12, 10, 4, 1, '#ddd'); P(0, 12, 4, 1, '#ddd'); P(12, 12, 4, 1, '#ddd'); });
      c = makeBlocky({ skin: 0x1a1a1f, shirt: 0x1a1a1f, pants: 0x1a1a1f, shoes: 0x0b0b0e, hands: 0x2a2a30, face });
      [-1, 1].forEach((s) => { const ear = boxMesh(0.12, 0.12, 0.06, lam(0x1a1a1f)); ear.position.set(s * 0.14, 0.47, 0); ear.rotation.z = Math.PI / 4; c.head.add(ear); const inner = boxMesh(0.06, 0.06, 0.02, lam(0xff8fb0)); inner.position.set(s * 0.14, 0.47, 0.035); inner.rotation.z = Math.PI / 4; c.head.add(inner); });
      const tail = new THREE.Group(); tail.position.set(0, 0.42, -0.14); c.root.add(tail); c.tail = tail;
      let parent = tail; for (let i = 0; i < 4; i++) { const seg = boxMesh(0.06, 0.06, 0.18, lam(0x1a1a1f)); seg.position.z = -0.09; const j = new THREE.Group(); j.position.z = i ? -0.18 : 0; j.rotation.x = -0.35; parent.add(j); j.add(seg); parent = j; }
      break;
    }
    case 'astronaut': {
      const visor = faceCanvas('#0b1a33', (P, g) => { const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, 'rgba(160,200,255,.55)'); gr.addColorStop(0.35, 'rgba(60,90,160,.15)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(4, 8, 56, 44); P(1, 1, 14, 1, '#d5dbe3'); P(1, 14, 14, 1, '#d5dbe3'); P(1, 1, 1, 14, '#d5dbe3'); P(14, 1, 1, 14, '#d5dbe3'); P(4, 6, 2, 2, 'rgba(255,255,255,.4)'); P(10, 6, 2, 2, 'rgba(255,255,255,.4)'); });
      const vm = fogify(new THREE.MeshStandardMaterial({ map: texFrom(visor), roughness: 0.15, metalness: 0.4 }));
      c = makeBlocky({ skin, shirt: 0xcdd2d8, pants: 0xcdd2d8, shoes: 0x7a8088, hands: 0xbfc6cf, headSide: 0xcdd2d8, headTop: 0xcdd2d8, headBack: 0xcdd2d8, faceMat: vm, prop: { head: 0.52 } });
      const pack = boxMesh(0.36, 0.42, 0.14, lam(0xcfd5dc)); pack.position.set(0, 0.26, -0.2); c.torso.add(pack);
      const patch = boxMesh(0.12, 0.08, 0.01, lam(0xff7a1a)); patch.position.set(0.11, 0.38, 0.135); c.torso.add(patch);
      const ant = boxMesh(0.02, 0.18, 0.02, lam(0x888888)); ant.position.set(0.18, 0.6, 0); c.head.add(ant);
      break;
    }
    case 'dino': {
      const face = kidFace(skinS, null, { paint: (P) => { P(0, 0, 16, 4, '#3fa34d'); for (let x = 1; x < 16; x += 3) P(x, 4, 2, 1, '#f5f5f0'); } });
      c = makeBlocky({ skin, shirt: 0x3fa34d, pants: 0x3fa34d, sleeves: 0x3fa34d, shoes: 0x2b7a36, headSide: 0x3fa34d, headTop: 0x3fa34d, headBack: 0x3fa34d, face });
      const belly = boxMesh(0.3, 0.38, 0.02, lam(0xc9e07a)); belly.position.set(0, 0.25, 0.135); c.torso.add(belly);
      [-1, 1].forEach((s) => { const e = boxMesh(0.1, 0.08, 0.08, lam(0xf5f5f0)); e.position.set(s * 0.12, 0.47, 0.16); c.head.add(e); const p = boxMesh(0.05, 0.05, 0.02, lam(0x111111)); p.position.set(s * 0.12, 0.47, 0.205); c.head.add(p); });
      for (let i = 0; i < 4; i++) { const sp = boxMesh(0.1, 0.1, 0.1, lam(0xf2c23a)); sp.rotation.x = Math.PI / 4; sp.position.set(0, 0.48 - i * 0.13, -0.15); c.torso.add(sp); }
      const sp2 = boxMesh(0.1, 0.1, 0.1, lam(0xf2c23a)); sp2.rotation.x = Math.PI / 4; sp2.position.set(0, 0.47, -0.18); c.head.add(sp2);
      const tail = new THREE.Group(); tail.position.set(0, 0.38, -0.14); c.root.add(tail); c.tail = tail;
      let parent = tail; for (let i = 0; i < 3; i++) { const s = 0.2 - i * 0.05; const seg = boxMesh(s, s, 0.24, lam(0x3fa34d)); seg.position.z = -0.12; const j = new THREE.Group(); j.position.z = i ? -0.22 : 0; j.rotation.x = 0.15; parent.add(j); j.add(seg); parent = j; }
      break;
    }
    case 'bee': {
      const stripes = faceCanvas('#ffd23a', (P) => { P(0, 3, 16, 3, '#17171c'); P(0, 9, 16, 3, '#17171c'); });
      const sm = lam(0xffffff, { map: texFrom(stripes, { nearest: true }) });
      c = makeBlocky({ skin, shirt: 0xffd23a, pants: 0x17171c, sleeves: 0x17171c, hair: 0xffd23a, bodyMat: [sm, sm, lam(0xffd23a), lam(0x17171c), sm, sm], face: kidFace(skinS, '#ffd23a', {}) });
      const wm = fogify(new THREE.MeshLambertMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      [-1, 1].forEach((s) => { const w = new THREE.Mesh(geoCache('wing', () => new THREE.PlaneGeometry(0.32, 0.42)), wm); w.position.set(s * 0.18, 0.36, -0.16); w.rotation.set(0, s * 0.6, s * 0.2); c.torso.add(w); c['wing' + s] = w;
        const a = boxMesh(0.025, 0.2, 0.025, lam(0x17171c)); a.position.set(s * 0.1, 0.52, 0.05); a.rotation.z = -s * 0.3; c.head.add(a); const b = boxMesh(0.06, 0.06, 0.06, lam(0x17171c)); b.position.set(s * 0.14, 0.62, 0.05); c.head.add(b); });
      break;
    }
    case 'hero': {
      const emb = faceCanvas('#2f62d6', (P) => { P(6, 4, 4, 1, '#ffd23a'); P(5, 5, 6, 1, '#ffd23a'); P(4, 6, 8, 2, '#ffd23a'); P(5, 8, 6, 1, '#ffd23a'); P(6, 9, 4, 1, '#ffd23a'); P(7, 10, 2, 1, '#ffd23a'); P(7, 6, 2, 2, '#d22b2b'); P(0, 13, 16, 2, '#d22b2b'); });
      const em = lam(0xffffff, { map: texFrom(emb, { nearest: true }) });
      c = makeBlocky({ skin, shirt: 0x2f62d6, pants: 0x2f62d6, shoes: 0xd22b2b, hair: 0x2a1a10, bodyMat: [lam(0x2f62d6), lam(0x2f62d6), lam(0x2f62d6), lam(0x2f62d6), em, lam(0x2f62d6)], face: kidFace(skinS, '#2a1a10', { mask: '#16161c' }) });
      const cape = boxMesh(0.56, 0.95, 0.03, lam(0xd22b2b)); cape.position.set(0, 0.0, -0.155); cape.rotation.x = 0.12; c.torso.add(cape); c.cape = cape;
      break;
    }
  }
  c.type = type; c.def = T;
  // the candy pail in the right hand, arm slightly forward
  const pail = candyPail(); c.handR.add(pail); c.pail = pail;
  return c;
}
function animateKidBlocky(c, t, mode) {
  // mode: 'scared' | 'wave' | 'cheer' | 'idle' | 'walk'
  const k = c.walkT + t;
  if (mode === 'walk') { poseWalk(c, k * 7, 1); c.armR.rotation.x = -0.35; c.head.rotation.y = Math.sin(k) * 0.1; }
  else if (mode === 'wave') { poseReset(c); c.armL.rotation.z = -2.6 + Math.sin(k * 10) * 0.35; c.armR.rotation.x = -0.4; c.head.rotation.x = -0.12; c.torso.position.y = c.P.legH + Math.abs(Math.sin(k * 5)) * 0.03; }
  else if (mode === 'cheer') { poseReset(c); const j = Math.abs(Math.sin(k * 6)); c.root.position.y = (c.baseY || 0) + j * 0.25; c.armL.rotation.z = -2.7; c.armR.rotation.z = 2.4; c.armR.rotation.x = -0.3; }
  else if (mode === 'scared') {
    poseReset(c);
    const tr = Math.sin(k * 40) * 0.015;
    c.torso.rotation.z = tr; c.head.rotation.y = Math.sin(k * 0.7) * 0.6 + Math.sin(k * 3.1) * 0.08; c.head.rotation.x = 0.08;
    c.armL.rotation.x = -0.9; c.armL.rotation.z = 0.5; c.armR.rotation.x = -0.4; c.torso.rotation.x = 0.06;
    c.legL.rotation.z = 0.04; c.legR.rotation.z = -0.04;
  } else { poseReset(c); c.head.rotation.y = Math.sin(k * 0.5) * 0.3; c.torso.position.y = c.P.legH + Math.sin(k * 2) * 0.008; }
  if (c.tail) c.tail.rotation.y = Math.sin(k * 3) * 0.4;
  if (c['wing-1']) { c['wing-1'].rotation.y = -0.6 + Math.sin(k * 40) * 0.4; c.wing1.rotation.y = 0.6 - Math.sin(k * 40) * 0.4; }
  if (c.cape) c.cape.rotation.x = 0.12 + Math.sin(k * 2) * 0.05;
}

// --- Story versions of Joury & Vivek (kid-sized gamers) ---
function makeGamer(who, mood) {
  if (who === 'joury') {
    const face = kidFace('#c98f62', '#3b2618', { angry: mood === 'angry', happy: mood === 'happy', look: 1 });
    const c = makeBlocky({ skin: 0xc98f62, shirt: 0xc0262b, pants: 0x2b2b33, shoes: 0x111111, hair: 0x3b2618, face });
    const hood = boxMesh(0.4, 0.12, 0.08, lam(0x9c1d22)); hood.position.set(0, 0.5, -0.16); c.torso.add(hood);
    const str = boxMesh(0.02, 0.14, 0.02, lam(0xffffff)); str.position.set(-0.06, 0.4, 0.14); c.torso.add(str); const s2 = str.clone(); s2.position.x = 0.06; c.torso.add(s2);
    return c;
  }
  const face = kidFace('#a8714a', '#15120f', { happy: mood !== 'neutral', look: -1 });
  const c = makeBlocky({ skin: 0xa8714a, shirt: 0x2f6fd6, pants: 0x2c3446, shoes: 0xeeeeee, hair: 0x15120f, face });
  const stripe = boxMesh(0.45, 0.06, 0.27, lam(0xffffff)); stripe.position.set(0, 0.3, 0); c.torso.add(stripe);
  return c;
}

function makeController(broken) {
  const g = new THREE.Group(), body = lam(0x26262c), btn = [0xd22b2b, 0x2f62d6, 0x3fa34d, 0xffd23a];
  if (!broken) {
    const b = boxMesh(0.22, 0.04, 0.1, body); g.add(b);
    [-1, 1].forEach((s) => { const grip = boxMesh(0.07, 0.04, 0.09, body); grip.position.set(s * 0.09, -0.005, 0.05); grip.rotation.y = s * 0.3; g.add(grip); });
    btn.forEach((cc, i) => { const bb = boxMesh(0.018, 0.012, 0.018, lam(cc)); bb.position.set(0.06 + (i % 2) * 0.02, 0.025, -0.01 + ((i / 2) | 0) * 0.02); g.add(bb); });
    return g;
  }
  const L = boxMesh(0.11, 0.04, 0.1, body); L.position.set(-0.07, 0, 0); L.rotation.set(0.2, 0.3, 0.3); g.add(L);
  const R = boxMesh(0.1, 0.04, 0.1, body); R.position.set(0.08, -0.03, 0.02); R.rotation.set(-0.3, -0.5, -0.4); g.add(R);
  btn.forEach((cc, i) => { const bb = boxMesh(0.018, 0.012, 0.018, lam(cc)); bb.position.set(0.08 + (i % 2) * 0.02, -0.005, 0.0 + ((i / 2) | 0) * 0.02); bb.rotation.z = -0.4; g.add(bb); });
  const wire = mesh(geoCache('wire', () => new THREE.TorusGeometry(0.06, 0.006, 4, 12, Math.PI * 1.2)), lam(0xc0262b), false); wire.position.set(0, -0.04, 0.02); wire.rotation.x = Math.PI / 2; g.add(wire);
  return g;
}

// --- Joury: tall figure in a dark hoodie with glowing red eyes ---
function makeJouryBlocky() {
  const P = { legH: 1.0, legW: 0.22, bodyH: 0.95, bodyW: 0.6, bodyD: 0.34, head: 0.5, armW: 0.17, armH: 1.08 };
  const grin = (P2) => { P2(3, 11, 1, 1, '#c01010'); P2(12, 11, 1, 1, '#c01010'); P2(4, 12, 8, 1, '#c01010'); for (let x = 4; x < 12; x += 2) P2(x, 13, 1, 1, '#801010'); };
  const blackFace = faceCanvas('#050506', grin), grinEm = faceCanvas('#000000', grin);
  const faceMat = fogify(new THREE.MeshLambertMaterial({ map: texFrom(blackFace, { nearest: true }), emissive: 0xffffff, emissiveMap: texFrom(grinEm, { nearest: true }), emissiveIntensity: 0.9 }));
  const c = makeBlocky({ skin: 0x5d6066, shirt: 0x27252e, pants: 0x0d0d11, shoes: 0x050505, hands: 0x5d6066, faceMat, headSide: 0x0a0a0c, headTop: 0x0a0a0c, headBack: 0x0a0a0c, prop: P });
  const hm = lam(0x2c2a33);
  const hs = P.head;
  // hood shell around the head, deeper than the face so it sits in shadow
  const hTop = boxMesh(hs + 0.12, 0.07, hs + 0.16, hm); hTop.position.set(0, hs + 0.04, 0.03); c.head.add(hTop);
  [-1, 1].forEach((s) => { const side = boxMesh(0.06, hs + 0.08, hs + 0.16, hm); side.position.set(s * (hs / 2 + 0.03), hs / 2, 0.03); c.head.add(side); });
  const hBack = boxMesh(hs + 0.12, hs + 0.1, 0.07, hm); hBack.position.set(0, hs / 2, -hs / 2 - 0.03); c.head.add(hBack);
  const drape = boxMesh(P.bodyW * 0.8, 0.22, 0.1, hm); drape.position.set(0, P.bodyH - 0.05, -0.17); c.torso.add(drape);
  const pocket = boxMesh(0.36, 0.18, 0.02, lam(0x111016)); pocket.position.set(0, 0.25, P.bodyD / 2 + 0.008); c.torso.add(pocket);
  [-1, 1].forEach((s) => { const str = boxMesh(0.025, 0.24, 0.025, lam(0x9c1d22)); str.position.set(s * 0.08, P.bodyH - 0.16, P.bodyD / 2 + 0.02); c.torso.add(str); });
  // glowing eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.12, 0.06) });
  c.eyes = [];
  [-1, 1].forEach((s) => { const e = new THREE.Mesh(unitBox(), eyeMat); e.scale.set(0.075, 0.04, 0.02); e.position.set(s * 0.11, hs * 0.58, hs / 2 + 0.012); c.head.add(e); c.eyes.push(e); });
  c.eyeGlow = new GlowSet(2, 90, true);
  c.eyeGlow.add(-0.11, hs * 0.58, hs / 2 + 0.05, 0xff2010, 0.55, 0.15); c.eyeGlow.add(0.11, hs * 0.58, hs / 2 + 0.05, 0xff2010, 0.55, 0.15);
  c.eyeGlow.setColor(0, 0xff2a14, 2.2); c.eyeGlow.setColor(1, 0xff2a14, 2.2);
  c.head.add(c.eyeGlow.points);
  c.eyeMat = eyeMat;
  const ctrl = makeController(true); ctrl.position.set(0, -0.02, 0.06); ctrl.rotation.x = -0.4; ctrl.scale.setScalar(1.3); c.handR.add(ctrl);
  c.torso.rotation.x = 0.12; c.head.rotation.x = 0.1;
  return c;
}
function animateJouryBlocky(c, t, moving, speed, mode) {
  if (mode === 'stunned') {
    poseReset(c); c.torso.rotation.x = 0.45; c.head.rotation.x = 0.6; c.head.rotation.z = Math.sin(t * 2) * 0.2;
    c.armL.rotation.x = 0.2; c.armR.rotation.x = 0.3; c.legL.rotation.x = 0.1; c.legR.rotation.x = -0.1;
    const f = Math.random() < 0.2 ? 0.2 : 1; c.eyeMat.color.setRGB(3.2 * f, 0.12 * f, 0.06 * f);
    return;
  }
  c.eyeMat.color.setRGB(3.2, 0.12, 0.06);
  c.eyeGlow.points.visible = mode !== 'scare';
  if (mode === 'scare') { c.eyeMat.color.setRGB(2.2, 0.05, 0.02); poseReset(c); c.armL.rotation.set(-2.2, 0, -0.3); c.armR.rotation.set(-2.2, 0, 0.3); c.head.rotation.x = -0.05; c.head.rotation.z = Math.sin(t * 50) * 0.08; c.torso.rotation.x = 0.25; return; }
  if (moving) {
    c.walkT += speed * 0.016 * 3.2;
    const s = Math.sin(c.walkT) * 0.55;
    c.legL.rotation.x = -s; c.legR.rotation.x = s; c.armL.rotation.x = s * 0.4 - 0.25; c.armR.rotation.x = -s * 0.3 - 0.45;
    c.torso.rotation.x = 0.18; c.torso.position.y = c.P.legH + Math.abs(Math.cos(c.walkT)) * 0.05;
    c.head.rotation.z = Math.sin(c.walkT * 0.5) * 0.12 + (Math.random() < 0.03 ? rand(-0.3, 0.3) : 0);
  } else {
    c.legL.rotation.x = c.legR.rotation.x = 0; c.armL.rotation.x = -0.15; c.armR.rotation.x = -0.4;
    c.torso.rotation.x = 0.12; c.torso.position.y = c.P.legH + Math.sin(t * 1.3) * 0.01;
    c.head.rotation.z = Math.sin(t * 0.9) * 0.18 + (Math.random() < 0.02 ? rand(-0.35, 0.35) : 0);
    c.head.rotation.x = 0.1 + Math.sin(t * 0.6) * 0.05;
  }
}

// --- props ---
function pumpkinGeo(withStem = true) {
  return geoCache('pumpkin' + withStem, () => {
    const s = new THREE.SphereGeometry(1, 16, 10), p = s.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const rib = 0.9 + 0.1 * Math.pow(Math.abs(Math.cos(a * 4)), 0.5);
      p.setXYZ(i, x * rib, y * 0.74 + (Math.abs(y) > 0.9 ? -Math.sign(y) * 0.08 : 0), z * rib);
    }
    s.computeVertexNormals();
    const b = new Builder(); b.add(s, 'p', 0xe0701a);
    if (withStem) { b.cyl(0.07, 0.11, 0.35, 0.02, 0.82, 0, 0x4a5a22, 'p', 6, 0, 0, 0.2); }
    const list = b.parts.get('p'), g = mergeGeos(list); boxUV(g, 1.5); list.forEach((x) => x.dispose()); b.parts.clear();
    g.computeBoundingSphere(); return g;
  });
}
function jackFaceTex() {
  return TEX.jack || (TEX.jack = texFrom((() => {
    const c = makeCanvas(128, 128), g = c.getContext('2d'); g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(22, 52); g.lineTo(38, 26); g.lineTo(54, 52); g.fill();
    g.beginPath(); g.moveTo(74, 52); g.lineTo(90, 26); g.lineTo(106, 52); g.fill();
    g.beginPath(); g.moveTo(58, 66); g.lineTo(64, 56); g.lineTo(70, 66); g.fill();
    g.beginPath(); g.moveTo(14, 76); g.quadraticCurveTo(64, 128, 114, 76); g.lineTo(100, 82); g.lineTo(94, 74); g.lineTo(84, 88); g.lineTo(74, 78); g.lineTo(64, 92); g.lineTo(54, 78); g.lineTo(44, 88); g.lineTo(34, 74); g.lineTo(28, 82); g.closePath(); g.fill();
    return c;
  })()));
}
function makeLantern() {
  const b = new Builder();
  b.box(0.22, 0.03, 0.22, 0, 0.015, 0, 0x2a2622, 'metal'); b.box(0.24, 0.03, 0.24, 0, 0.33, 0, 0x2a2622, 'metal');
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => b.box(0.025, 0.3, 0.025, x * 0.1, 0.17, z * 0.1, 0x2a2622, 'metal'));
  b.cyl(0.02, 0.12, 0.1, 0, 0.39, 0, 0x2a2622, 'metal', 6);
  const g = b.build();
  const glass = new THREE.Mesh(unitBox(), MAT.lanternGlass); glass.scale.set(0.17, 0.26, 0.17); glass.position.y = 0.17; g.add(glass);
  const handle = mesh(geoCache('lhandle', () => new THREE.TorusGeometry(0.08, 0.01, 4, 10, Math.PI)), lam(0x2a2622)); handle.position.y = 0.44; g.add(handle);
  return g;
}
function makeBattery() {
  const g = new THREE.Group();
  const body = mesh(geoCache('batt', () => new THREE.CylinderGeometry(0.06, 0.06, 0.24, 12)), lam(0x1f8a4a, { emissive: 0x062a12 })); body.rotation.z = Math.PI / 2; g.add(body);
  const top = mesh(geoCache('battTop', () => new THREE.CylinderGeometry(0.061, 0.061, 0.07, 12)), lam(0xc28a3a)); top.rotation.z = Math.PI / 2; top.position.x = 0.09; g.add(top);
  const nub = mesh(geoCache('battNub', () => new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8)), lam(0xc8c8c8)); nub.rotation.z = Math.PI / 2; nub.position.x = 0.135; g.add(nub);
  return g;
}

// Boat: hull + optional parts (built progressively at the dock)
// A wooden rowboat with a curved, planked hull. Stern (with the motor) at -z, pointed bow at +z.
// userData: frame (keel, ribs, rails: always there), hull, oars, engine, fuel (added as you deliver them)
function makeBoat() {
  const g = new THREE.Group(), L0 = -1.75, L1 = 2.45, YB = -0.14;
  const wAt = (z) => { const t = clamp((z - L0) / (L1 - L0), 0, 1); const f = t < 0.3 ? 0.84 + 0.16 * smoothstep(0, 0.3, t) : 1 - Math.pow((t - 0.3) / 0.7, 2.1); return 0.82 * Math.max(f, 0); };
  const dAt = (z) => { const t = clamp((z - L0) / (L1 - L0), 0, 1); return 0.6 + 0.24 * Math.pow(t, 3); };
  const at = (z, th, inset = 0) => { const w = wAt(z) * (1 - inset), d = dAt(z); return new THREE.Vector3(w * Math.sin(th), YB + d * (1 - Math.pow(Math.cos(th), 0.55)) + inset * 0.08, z); };
  const wood = (c, rep = 2) => pbrMat('planks', { repeat: rep, roughness: 0.75, color: c });
  const hullMat = wood(0x9a6a42, 2.2), darkMat = wood(0x5a3a22, 1.5), seatMat = wood(0x8a5e3a, 1.2);
  hullMat.side = THREE.DoubleSide;
  const add = (parent, m) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const tube = (pts, r, mat, seg = 40) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 6), mat);
  // ---- frame: keel with a rising bow stem, ribs, gunwale rails, transom frame ----
  const frame = new THREE.Group(); g.add(frame); g.userData.frame = frame;
  { const pts = []; for (let i = 0; i <= 12; i++) { const z = lerp(L0, L1, i / 12); pts.push(new THREE.Vector3(0, YB - 0.03, z)); } pts.push(new THREE.Vector3(0, YB + dAt(L1) * 0.6, L1 + 0.06), new THREE.Vector3(0, YB + dAt(L1) + 0.12, L1 + 0.04)); add(frame, tube(pts, 0.045, darkMat, 60)); }
  [-1, 1].forEach((sd) => { const pts = []; for (let i = 0; i <= 20; i++) { const z = lerp(L0, L1 - 0.02, i / 20); pts.push(at(z, sd * Math.PI / 2)); } add(frame, tube(pts, 0.042, darkMat, 60)); });
  for (let k = 0; k < 6; k++) { const z = lerp(L0 + 0.25, L1 - 0.7, k / 5), pts = []; for (let j = 0; j <= 12; j++) pts.push(at(z, lerp(-Math.PI / 2, Math.PI / 2, j / 12), 0.04)); add(frame, tube(pts, 0.026, darkMat, 24)); }
  { const w = wAt(L0), d = dAt(L0); const tb = add(frame, new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.06, 0.08, 0.08), darkMat)); tb.position.set(0, YB + d, L0); }
  // ---- hull: planked skin, transom, floorboards, bench seats ----
  const hull = new THREE.Group(); g.add(hull); g.userData.hull = hull;
  { const N = 36, M = 18, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) { const z = lerp(L0, L1, i / N); for (let j = 0; j <= M; j++) { const v = at(z, lerp(-Math.PI / 2, Math.PI / 2, j / M)); pos.push(v.x, v.y, v.z); uv.push(j / M * 1.6, i / N * 3.5); } }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b2 = a + M + 1; idx.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    add(hull, new THREE.Mesh(geo, hullMat));
    // transom: fill the stern ring
    const ring = []; for (let j = 0; j <= M; j++) ring.push(at(L0, lerp(-Math.PI / 2, Math.PI / 2, j / M)));
    const tp = [0, YB + dAt(L0) * 0.55, L0], tpos = [...tp], tuv = [0.5, 0.5], tidx = [];
    ring.forEach((v, j) => { tpos.push(v.x, v.y, v.z); tuv.push(0.5 + v.x, (v.y - YB) * 1.2); if (j) tidx.push(0, j, j + 1); });
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tpos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2)); tg.setIndex(tidx); tg.computeVertexNormals();
    add(hull, new THREE.Mesh(tg, hullMat));
  }
  { const fb = add(hull, new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 3.2), seatMat)); fb.position.set(0, YB + 0.07, 0.15); }
  [[-1.15, 0.22], [0.15, 0.2], [1.35, 0.2]].forEach(([z, dz]) => { const w = wAt(z) * 2 - 0.08, y = YB + dAt(z) * 0.66; const seat = add(hull, new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, dz * 1.5), seatMat)); seat.position.set(0, y, z); });
  // ---- oars resting across the seats, in brass oarlocks ----
  const oars = new THREE.Group(); g.add(oars); g.userData.oars = oars;
  const oarMat = wood(0xb07a48, 1), brass = plainMat(0xb08a3a, 0.35, 0.85);
  [-1, 1].forEach((sd) => {
    const o = new THREE.Group(); o.position.set(sd * 0.36, YB + dAt(0.15) * 0.66 + 0.05, 0.25); o.rotation.y = sd * 0.06; oars.add(o);
    const shaft = add(o, new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 2.3, 8), oarMat)); shaft.rotation.x = Math.PI / 2;
    const blade = add(o, new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.02, 0.55), oarMat)); blade.position.z = 1.35;
    const grip = add(o, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), darkMat)); grip.rotation.x = Math.PI / 2; grip.position.z = -1.2;
    const lock = add(oars, new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), brass)); const lp = at(0.25, sd * Math.PI / 2); lock.position.set(lp.x, lp.y + 0.06, 0.25); lock.rotation.y = Math.PI / 2;
  });
  // ---- outboard motor clamped to the transom ----
  const engine = new THREE.Group(); g.add(engine); g.userData.engine = engine;
  { const top = YB + dAt(L0), body = plainMat(0x22252b, 0.4, 0.5), red = plainMat(0xb3141c, 0.35, 0.3), steel = plainMat(0x8a8d93, 0.35, 0.9);
    const cowl = add(engine, new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.18, 6, 12), body)); cowl.scale.set(1, 1, 1.25); cowl.position.set(0, top + 0.3, L0 - 0.16);
    const cap = add(engine, new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), red)); cap.scale.set(1, 0.6, 1.25); cap.position.set(0, top + 0.47, L0 - 0.16);
    const shaft = add(engine, new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.85, 10), body)); shaft.position.set(0, top - 0.25, L0 - 0.2);
    const foot = add(engine, new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), body)); foot.rotation.x = Math.PI / 2; foot.position.set(0, top - 0.68, L0 - 0.24);
    for (let k = 0; k < 3; k++) { const bl = add(engine, new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.05), steel)); bl.position.set(0, top - 0.68, L0 - 0.4); bl.rotation.z = k * 2.09; }
    const clamp2 = add(engine, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.1), steel)); clamp2.position.set(0, top - 0.02, L0 - 0.02);
    const tiller = add(engine, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.6, 8), body)); tiller.rotation.x = Math.PI / 2 - 0.15; tiller.position.set(0, top + 0.28, L0 + 0.22); }
  // ---- red fuel can on the floorboards ----
  const fuel = new THREE.Group(); g.add(fuel); g.userData.fuel = fuel;
  { const red = plainMat(0xb3141c, 0.4, 0.3); const can = add(fuel, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.3), red)); can.position.set(0.28, YB + 0.25, -1.3);
    const h = add(fuel, new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 12, Math.PI), red)); h.position.set(0.28, YB + 0.41, -1.32); h.rotation.y = Math.PI / 2;
    const sp = add(fuel, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.1, 8), plainMat(0xffd23a, 0.4))); sp.position.set(0.28, YB + 0.44, -1.2); sp.rotation.x = 0.6; }
  return g;
}
// Stand-alone pickups for each boat part (same pieces, loose)
function makePartPickup(id) {
  const g = new THREE.Group();
  if (id === 'hull') { const b = new Builder(); for (let i = 0; i < 5; i++) b.box(0.32, 0.06, 2.2, rand(-0.05, 0.05), 0.04 + i * 0.065, 0, i % 2 ? 0x7a5232 : 0x8b6040, 'wood', rand(-0.1, 0.1)); b.box(0.4, 0.04, 0.04, 0, 0.36, 0.6, 0x222222, 'metal'); g.add(b.build()); }
  else if (id === 'oars') { const b = new Builder(); [-1, 1].forEach((s) => { b.box(0.05, 0.05, 2.0, s * 0.12, 0.05, 0, 0x9a6b3e, 'wood', s * 0.25); b.box(0.2, 0.03, 0.5, s * 0.12 + s * 0.24, 0.05, -1.0, 0x9a6b3e, 'wood', s * 0.25); }); g.add(b.build()); }
  else if (id === 'engine') { const b = new Builder(); b.box(0.45, 0.45, 0.5, 0, 0.23, 0, 0x2a2d33, 'metal'); b.box(0.36, 0.12, 0.42, 0, 0.5, 0, 0xc0262b, 'metal'); b.box(0.12, 0.8, 0.12, 0, 0.1, -0.35, 0x3a3d43, 'metal', 0, 1.3); b.box(0.04, 0.32, 0.32, 0, 0.1, -0.8, 0x777777, 'metal'); g.add(b.build()); }
  else { const b = new Builder(); b.box(0.36, 0.46, 0.2, 0, 0.23, 0, 0xc0262b, 'metal'); b.box(0.12, 0.07, 0.06, 0.08, 0.5, 0, 0x111111, 'metal'); b.box(0.07, 0.07, 0.07, -0.1, 0.5, 0, 0xffd23a, 'metal'); g.add(b.build()); }
  return g;
}

// --- trees, rocks, grass: merged vertex-colored geometry for instancing ---
// --- realistic trees: bark trunks + alpha-card foliage (two geometries per kind) ---
function mergeUV(list) {
  let n = 0; list.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  list.forEach((g) => { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += c; });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere(); return out;
}
const _yUp = new THREE.Vector3(0, 1, 0);
function limb(r0, r1, a, b, seg = 6, vScale = 1.4) { // a tapered bark cylinder from point a to point b
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, Math.max(1, Math.round(len / 1.2)), true).toNonIndexed();
  g.translate(0, len / 2, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(r0 * 9)), uv.getY(i) * len / vScale);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_yUp, dir.normalize())); g.translate(a.x, a.y, a.z);
  return g;
}
function foliageCard(w, h, xf) { const g = new THREE.PlaneGeometry(w, h).toNonIndexed(); xf(g); return g; }
function softNormals(g, cy, k = 0.55) { // light foliage like a soft volume, not paper
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.set(p.getX(i), (p.getY(i) - cy) * 0.7, p.getZ(i)).normalize(); v.multiplyScalar(k).add(new THREE.Vector3(0, 1 - k, 0)).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
}
function treeParts(kind, variant) {
  return geoCache('trees' + kind + variant, () => {
    const rnd = mulberry32(300 + variant * 17 + kind.length * 5), R = (a, b) => a + rnd() * (b - a), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const trunk = [], leaves = [];
    if (kind === 'pine') {
      const H = variant ? 8.4 : 6.9, lean = V(R(-0.15, 0.15), 0, R(-0.15, 0.15));
      const pts = []; for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push(V(lean.x * t * t + Math.sin(t * 5 + variant) * 0.05, H * t, lean.z * t * t)); }
      for (let i = 0; i < 4; i++) trunk.push(limb(lerp(0.27, 0.05, i / 4), lerp(0.27, 0.05, (i + 1) / 4), pts[i], pts[i + 1], 9));
      for (let k = 0; k < 6; k++) { const y = R(0.7, 2.0), a = R(0, TAU); trunk.push(limb(0.035, 0.008, V(0, y, 0), V(Math.cos(a) * R(0.4, 0.9), y - R(0, 0.25), Math.sin(a) * R(0.4, 0.9)), 4)); }
      for (let y = 1.6; y < H - 0.5; y += R(0.38, 0.5)) {
        const t = (y - 1.6) / (H - 2.1), n = 5 + Math.floor(rnd() * 3), off = rnd() * TAU, cx = lean.x * (y / H) ** 2, cz = lean.z * (y / H) ** 2;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * TAU + R(-0.3, 0.3), L = lerp(2.5, 0.5, t) * R(0.75, 1.2) * (variant ? 0.85 : 1), W = L * 0.55 + 0.3, droop = R(0.22, 0.5) + t * 0.1;
          for (const roll of [R(-0.15, 0.15), R(0.9, 1.3)]) leaves.push(foliageCard(L, W, (g) => { g.rotateX(-Math.PI / 2); g.translate(L / 2, 0, 0); g.rotateX(roll); g.rotateZ(-droop); g.rotateY(-a); g.translate(cx, y, cz); }));
        }
      }
      for (let k = 0; k < 2; k++) leaves.push(foliageCard(0.9, 1.5, (g) => { g.rotateZ(Math.PI / 2); g.translate(0, H - 0.2, 0); g.rotateY(k * Math.PI / 2); g.translate(lean.x, 0, lean.z); }));
      leaves.forEach((g) => softNormals(g, H * 0.45));
    } else if (kind === 'dead') {
      const H = variant ? 6.4 : 5.2, top = V(R(-0.4, 0.4), H, R(-0.4, 0.4)), mid = V(top.x * 0.3 + R(-0.2, 0.2), H * 0.5, top.z * 0.3 + R(-0.2, 0.2));
      trunk.push(limb(0.32, 0.17, V(0, -0.3, 0), mid, 9), limb(0.17, 0.05, mid, top, 8));
      const grow = (a, dir, len, r, depth) => {
        const b = a.clone().addScaledVector(dir, len); trunk.push(limb(r, r * 0.55, a, b, depth ? 4 : 6));
        if (depth >= 2) return;
        const kids = depth ? 2 : 3;
        for (let i = 0; i < kids; i++) { const t = R(0.45, 0.95), p = a.clone().lerp(b, t), d = dir.clone().add(V(R(-0.9, 0.9), R(-0.1, 0.6), R(-0.9, 0.9))).normalize(); grow(p, d, len * R(0.4, 0.6), r * 0.5, depth + 1); }
      };
      const nb = variant ? 7 : 5;
      for (let i = 0; i < nb; i++) { const y = R(H * 0.35, H * 0.9), ang = R(0, TAU), up = R(0.25, 0.9), d = V(Math.cos(ang), up, Math.sin(ang)).normalize(), base = V(0, y, 0).lerp(top, (y - H * 0.35) / H); grow(base, d, R(1.3, 2.4), 0.085, 0); }
    } else if (kind === 'oak') {
      const H = 3.0;
      trunk.push(limb(0.42, 0.22, V(0, -0.3, 0), V(0.1, H, 0), 10));
      const tips = [];
      for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU + R(-0.3, 0.3), a = V(0.1, R(2.2, H), 0), d = V(Math.cos(ang), R(0.5, 1.0), Math.sin(ang)).normalize(), len = R(1.8, 2.8), b = a.clone().addScaledVector(d, len);
        trunk.push(limb(0.16, 0.06, a, b, 6)); tips.push(b);
        const d2 = d.clone().add(V(R(-0.6, 0.6), 0.3, R(-0.6, 0.6))).normalize(), c = a.clone().lerp(b, 0.6); const e = c.clone().addScaledVector(d2, len * 0.6); trunk.push(limb(0.06, 0.025, c, e, 4)); tips.push(e); }
      tips.push(V(0.1, H + 2.2, 0));
      tips.forEach((tp) => { for (let k = 0; k < 3; k++) { const sz = R(1.9, 2.8), ry = R(0, TAU); leaves.push(foliageCard(sz, sz, (g) => { g.rotateX(R(-0.5, 0.5)); g.rotateY(ry + k * Math.PI / 3); g.translate(tp.x + R(-0.4, 0.4), tp.y + R(-0.2, 0.4), tp.z + R(-0.4, 0.4)); })); } });
      leaves.forEach((g) => softNormals(g, H + 1.2, 0.65));
    } else if (kind === 'bush') {
      for (let k = 0; k < 7; k++) { const sz = R(1.0, 1.6), ry = R(0, TAU); leaves.push(foliageCard(sz, sz * 0.85, (g) => { g.rotateX(R(-0.3, 0.3)); g.rotateY(ry); g.translate(R(-0.35, 0.35), sz * 0.38, R(-0.35, 0.35)); })); }
      leaves.forEach((g) => softNormals(g, 0.3, 0.6));
    } else if (kind === 'stump') {
      trunk.push(limb(0.38, 0.32, V(0, -0.2, 0), V(0, 0.55, 0), 10));
      const cap = new THREE.CircleGeometry(0.32, 10).toNonIndexed(); cap.rotateX(-Math.PI / 2); cap.translate(0, 0.55, 0); trunk.push(cap);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; trunk.push(limb(0.12, 0.03, V(0, 0.1, 0), V(Math.cos(a) * 0.75, -0.1, Math.sin(a) * 0.75), 5)); }
    } else if (kind === 'log') {
      const L = variant ? 4.6 : 3.2; trunk.push(limb(0.3, 0.26, V(-L / 2, 0.25, 0), V(L / 2, 0.22, 0), 10));
      for (let i = 0; i < 3; i++) { const x = R(-L / 2.5, L / 2.5), a = R(0, Math.PI); trunk.push(limb(0.06, 0.02, V(x, 0.3, 0), V(x + R(-0.3, 0.3), 0.3 + Math.sin(a) * 0.6, Math.cos(a) * 0.6), 4)); }
    }
    return { trunk: trunk.length ? mergeUV(trunk) : null, leaves: leaves.length ? mergeUV(leaves) : null };
  });
}
const FOLIAGE_MAT = { pine: 'needles', oak: 'leaves', bush: 'bush' };
// Instanced trees for any scene: items {kind, variant, x, y, z, s, ry, col?}
function instancedTrees(scene, items, opts = {}) {
  const groups = new Map(), out = [];
  items.forEach((it) => { const k = it.kind + '|' + it.variant + '|' + (opts.chunk ? Math.floor((it.x + 200) / opts.chunk) + ',' + Math.floor((it.z + 200) / opts.chunk) : ''); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
  for (const list of groups.values()) {
    const parts = treeParts(list[0].kind, list[0].variant);
    let cx = 0, cz = 0; list.forEach((it) => { cx += it.x; cz += it.z; }); cx /= list.length; cz /= list.length;
    const radius = Math.max(...list.map((it) => Math.hypot(it.x - cx, it.z - cz))) + 8;
    for (const [geo, mat] of [[parts.trunk, MAT.bark], [parts.leaves, MAT[FOLIAGE_MAT[list[0].kind]]]]) {
      if (!geo) continue;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => { _pv.set(it.x, it.y, it.z); _e.set(0, it.ry, 0); _q.setFromEuler(_e); _sv.set(it.s, it.sy || it.s, it.s); _m4.compose(_pv, _q, _sv); im.setMatrixAt(i, _m4); im.setColorAt(i, it.col || _col.setRGB(1, 1, 1)); });
      im.castShadow = opts.cast !== false; im.receiveShadow = true; applyFoliageDepth(im); im.computeBoundingSphere();
      im.userData.center = new THREE.Vector3(cx, 0, cz); im.userData.radius = radius; im.userData.full = list.length;
      scene.add(im); out.push(im);
    }
  }
  return out;
}
function rockGeo(variant) {
  return geoCache('rock' + variant, () => {
    const s = new THREE.IcosahedronGeometry(1, 1), p = s.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.28 * vnoise(x * 1.7 + variant * 9, z * 1.7 + y * 1.3, 4); p.setXYZ(i, x * n, y * n * 0.62, z * n); }
    const b = new Builder(); b.add(s, 'r', 0x8a8c90, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
    const list = b.parts.get('r'), g = mergeGeos(list); boxUV(g, 0.8); list.forEach((x) => x.dispose()); s.dispose(); g.computeBoundingSphere(); return g;
  });
}
function crossedQuads(w, h, n) {
  const pos = [], nor = [], uv = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI, cx = Math.cos(a) * w / 2, cz = Math.sin(a) * w / 2;
    const v = [[-cx, 0, -cz, 0, 0], [cx, 0, cz, 1, 0], [cx, h, cz, 1, 1], [-cx, 0, -cz, 0, 0], [cx, h, cz, 1, 1], [-cx, h, -cz, 0, 1]];
    v.forEach((q) => { pos.push(q[0], q[1], q[2]); nor.push(0, 1, 0); uv.push(q[3], q[4]); });
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
