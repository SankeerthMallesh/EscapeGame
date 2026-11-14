// =====================================================================
//  VIEWMODEL — your arm and flashlight on screen, like a shooter's weapon view.
//  It sways when you turn, bobs when you walk, drops when you sprint,
//  comes up and steadies when you aim (right mouse), and kicks when you land.
// =====================================================================
const VM = {
  scene: null, cam: null, root: null, visible: false, built: false,
  sway: new THREE.Vector2(), swayV: new THREE.Vector2(), pose: { sprint: 0, aim: 0, crouch: 0, land: 0, slide: 0 }, t: 0,
  build() {
    if (this.built) return; this.built = true;
    const scene = this.scene = new THREE.Scene();
    this.cam = GFX.camera(58, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0x9aa8c8, 0x2a2420, 0.35); scene.add(this.hemi);
    this.key = new THREE.PointLight(0xffe2b8, 0, 1.6, 1.6); this.key.position.set(0.12, -0.02, -0.55); scene.add(this.key); // light spilling back off the beam
    const rim = new THREE.DirectionalLight(0x8090b0, 0.25); rim.position.set(-1, 1, 1); scene.add(rim);
    const root = this.root = new THREE.Group(); scene.add(root);
    const jacket = clothMat(0x2a2e36, 0.95), cuff = clothMat(0x1c1f24, 0.95), skin = skinMat(0xd9a27a);
    const metal = plainMat(0x2a2b2e, 0.35, 0.75), grip = plainMat(0x141414, 0.8), chrome = plainMat(0xc8c8cc, 0.2, 1.0);
    // forearm in a jacket sleeve, coming in from the bottom right
    const arm = new THREE.Group(); arm.position.set(0.25, -0.25, -0.4); arm.rotation.set(0.22, 0.26, 0.08); arm.scale.setScalar(0.78); root.add(arm);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.46, 14), jacket); sleeve.rotation.x = Math.PI / 2; sleeve.position.z = 0.16; arm.add(sleeve);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.054, 0.05, 14), cuff); c.rotation.x = Math.PI / 2; c.position.z = -0.08; arm.add(c);
    // hand wrapped around the flashlight
    const hand = new THREE.Group(); hand.position.set(0, 0.005, -0.15); arm.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), skin); palm.scale.set(0.9, 0.75, 1.3); palm.position.set(0.012, -0.004, -0.045); hand.add(palm);
    // four fingers curled round the handle (part-rings around the flashlight's axis), knuckles on the left
    for (let f = 0; f < 4; f++) { const fg = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0118 - f * 0.0007, 8, 12, Math.PI * 1.15), skin); fg.position.set(-0.005, 0.03, -0.095 + f * 0.0235); fg.rotation.set(0, 0, Math.PI * 0.62); hand.add(fg); }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, 0.05, 4, 8), skin); thumb.position.set(0.014, 0.058, -0.09); thumb.rotation.set(Math.PI / 2 - 0.15, 0, -0.25); hand.add(thumb);
    // the flashlight: rubber grip, metal head, glass lens
    const fl = this.fl = new THREE.Group(); fl.position.set(-0.005, 0.03, -0.06); hand.add(fl);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 16), grip); body.rotation.x = Math.PI / 2; fl.add(body);
    for (let r = 0; r < 5; r++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0225, 0.003, 6, 16), metal); ring.position.z = 0.05 - r * 0.022; fl.add(ring); }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.023, 0.05, 16), metal); neck.rotation.x = Math.PI / 2; neck.position.z = -0.125; fl.add(neck);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.035, 18), metal); head.rotation.x = Math.PI / 2; head.position.z = -0.165; fl.add(head);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.004, 6, 20), chrome); bezel.position.z = -0.183; fl.add(bezel);
    this.lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.1) });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.031, 20), this.lensMat); lens.position.z = -0.1835; lens.rotation.y = Math.PI; fl.add(lens);
    const button = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.02), plainMat(0x7a1418, 0.5)); button.position.set(0, 0.023, -0.02); fl.add(button);
    root.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
    GFX.overlay = this;
  },
  // what the flashlight is doing: 'on', 'off', 'uv'
  update(dt, show, light, k) {
    if (!this.built) this.build();
    this.visible = !!show; if (!show) return;
    this.t += dt; const P = Player, p = this.pose;
    // sway: the arm lags behind where you turn
    const tx = clamp(-Input.dx * 0.0016, -0.06, 0.06), ty = clamp(Input.dy * 0.0016, -0.06, 0.06);
    this.swayV.x += (tx - this.sway.x) * 60 * dt; this.swayV.y += (ty - this.sway.y) * 60 * dt;
    this.swayV.multiplyScalar(Math.exp(-14 * dt)); this.sway.x += this.swayV.x * dt * 8; this.sway.y += this.swayV.y * dt * 8;
    this.sway.multiplyScalar(Math.exp(-6 * dt));
    p.sprint = damp(p.sprint, P.sprinting && !P.aiming ? 1 : 0, 9, dt); p.aim = damp(p.aim, P.aiming ? 1 : 0, 12, dt);
    p.crouch = damp(p.crouch, P.crouching ? 1 : 0, 8, dt); p.slide = damp(p.slide, P.slideT > 0 ? 1 : 0, 10, dt); p.land = damp(p.land, 0, 9, dt);
    const sp = Math.min(1, Math.hypot(P.vel.x, P.vel.y) / 3.7), bob = P.bobT * 2, still = 1 - p.aim * 0.75;
    const R = this.root;
    R.position.set(
      this.sway.x + Math.sin(bob * 0.5) * 0.012 * sp * still - p.aim * 0.07 + p.sprint * 0.05,
      -this.sway.y + Math.abs(Math.cos(bob * 0.5)) * -0.01 * sp * still + p.aim * 0.035 - p.sprint * 0.07 - p.land * 0.05 + Math.sin(this.t * 1.6) * 0.002 * (1 - sp),
      p.aim * 0.03 + p.slide * 0.04);
    R.rotation.set(-p.sprint * 0.55 + p.land * 0.12 + this.sway.y * 1.5, p.sprint * 0.55 - p.aim * 0.12 + this.sway.x * 2, -p.sprint * 0.35 + p.slide * 0.25 + Math.sin(bob * 0.5) * 0.02 * sp * still);
    // lens and the light it throws back on your hand
    const on = light === 'on', uv = light === 'uv', kk = k === undefined ? 1 : k;
    this.lensMat.color.setRGB(on ? 3.2 * kk : uv ? 1.2 * kk : 0.06, on ? 3.0 * kk : uv ? 0.4 * kk : 0.06, on ? 2.4 * kk : uv ? 3.0 * kk : 0.07);
    this.key.color.setHex(uv ? 0x9a5cff : 0xffe2b8); this.key.intensity = (on || uv) ? 0.9 * kk : 0;
  },
  // landing from a jump
  kick() { this.pose.land = 1; },
};
