// =====================================================================
//  PLAYER — first-person movement, stamina, flashlight & battery
// =====================================================================
function makeFlashlight(cam, color = 0xfff1d6, shadowSize = 1024, cookie = true) {
  const L = new THREE.SpotLight(color, 11, 48, 0.4, 0.45, 0.5);
  L.position.set(0.12, -0.12, 1.4); // a little behind the eyes: long throw without glare on close faces
  L.castShadow = shadowSize > 0;
  L.shadow.mapSize.set(shadowSize || 512, shadowSize || 512); L.shadow.camera.near = 1.3; L.shadow.camera.far = 50; L.shadow.bias = -0.0004; L.shadow.normalBias = 0.03;
  if (cookie && L.castShadow) L.map = TEX.cookie;
  const tgt = new THREE.Object3D(); tgt.position.set(0.05, -0.12, -6); cam.add(tgt); L.target = tgt;
  cam.add(L);
  // a faint fill so the player's immediate surroundings never go fully black
  const fill = new THREE.PointLight(color, 0.6, 6, 2); fill.position.set(0, 0, 0.5); cam.add(fill);
  L.userData.fill = fill; L.userData.base = 11;
  const beam = makeBeam(color); beam.position.set(0.16, -0.16, 0.05); beam.rotation.x = -0.02; cam.add(beam); L.userData.beam = beam; L.userData.beamK = 0.07;
  return L;
}
function setShadowSize(L, size) { if (!L) return; L.shadow.mapSize.set(size, size); if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; } }

const Player = {
  pos: new THREE.Vector3(), yaw: 0, pitch: 0, vel: new THREE.Vector2(), stamina: 1, exhausted: false, battery: 1, lightOn: true,
  bobT: 0, stepAcc: 0, eye: 1.62, aiming: false, aimK: 0, vy: 0, jumpY: 0, slideT: 0, slideDir: new THREE.Vector2(), landT: 0, cam: null, flash: null, env: null, frozen: false, breathT: 0, flick: 1, fov: 70, moving: false, sprinting: false, y: 0,
  attach(cam, env, flash) { this.cam = cam; this.env = env; this.flash = flash; },
  place(x, z, yaw, pitch = 0) { this.vy = 0; this.jumpY = 0; this.slideT = 0; this.pos.set(x, 0, z); this.yaw = yaw; this.pitch = pitch; this.vel.set(0, 0); this.y = this.env.surfaceY(x, z); this.applyCam(0); },
  look() {
    const s = 0.0022 * CFG.sens;
    this.yaw -= Input.dx * s; this.pitch -= Input.dy * s * (CFG.invert ? -1 : 1);
    if (Input.down('ArrowLeft')) this.yaw += 0.03; if (Input.down('ArrowRight')) this.yaw -= 0.03;
    this.pitch = clamp(this.pitch, -1.45, 1.45);
  },
  update(dt, opts = {}) {
    const held = this.frozen || Admin.open; // the admin panel is open: stand still behind it
    if (!held) this.look();
    const env = this.env;
    let f = 0, s = 0;
    if (!held) {
      if (Input.down('KeyW') || Input.down('ArrowUp')) f += 1; if (Input.down('KeyS') || Input.down('ArrowDown')) f -= 1;
      if (Input.down('KeyA')) s -= 1; if (Input.down('KeyD')) s += 1;
    }
    const moving = f !== 0 || s !== 0, len = Math.hypot(f, s) || 1; f /= len; s /= len;
    // slide: crouch while sprinting
    if (!held && this.sprinting && this.slideT <= 0 && this.jumpY <= 0 && (Input.hit.has('KeyC') || Input.hit.has('ControlLeft'))) {
      const vl = Math.hypot(this.vel.x, this.vel.y) || 1; this.slideDir.set(this.vel.x / vl, this.vel.y / vl); this.slideT = 0.7;
      if (SFX.ok()) SFX.burst(SFX.now, 0.6, 0.12, 'bandpass', 700, 0.6, SFX.sfx, 0.8, 0.02);
    }
    if (this.slideT > 0) this.slideT = Math.max(0, this.slideT - dt);
    this.crouching = !held && (Input.down('KeyC') || Input.down('ControlLeft') || this.slideT > 0);
    // aim: right mouse focuses the flashlight into a long beam
    this.aiming = !held && Input.rmb && this.slideT <= 0;
    this.aimK = damp(this.aimK, this.aiming ? 1 : 0, 10, dt);
    // jump
    if (!held && Input.hit.has('Space') && this.jumpY <= 0 && this.vy <= 0 && !this.crouching && this.stamina > 0.08) { this.vy = 4.4; this.stamina = Math.max(0, this.stamina - 0.06); }
    if (this.vy !== 0 || this.jumpY > 0) {
      this.jumpY += this.vy * dt; this.vy -= 13 * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.vy = 0; this.landT = 0.25; VM.kick(); SFX.step(this.env.surfaceKind(this.pos.x, this.pos.z), 1.3); }
    }
    if (this.landT > 0) this.landT -= dt;
    const wantRun = (Input.down('ShiftLeft') || Input.down('ShiftRight')) && moving && f >= 0 && !this.exhausted && this.stamina > 0 && !this.crouching && !this.aiming;
    const boost = Admin.speed || 1, walk = (this.crouching ? 1.8 : (opts.walk || 3.7)) * boost, run = (opts.run || 6.4) * boost;
    let speed = moving ? (wantRun ? run : walk) * (f < 0 ? 0.7 : 1) * (this.aiming ? 0.62 : 1) : 0;
    this.sprinting = wantRun;
    if (wantRun) { this.stamina = Math.max(0, this.stamina - dt / (5.5 * Perks.stamK())); if (this.stamina <= 0) { this.exhausted = true; this.breathT = 0; } }
    else { this.stamina = Math.min(1, this.stamina + dt * (moving ? 0.11 : 0.18) * Perks.regenK()); if (this.exhausted && this.stamina > 0.35) this.exhausted = false; }
    if (this.exhausted) { this.breathT -= dt; if (this.breathT <= 0 && SFX.ok()) { this.breathT = 1.05; SFX.burst(SFX.now, 0.55, 0.07, 'bandpass', 900, 1.2, SFX.sfx, 1, 0.15); } }
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let tvx = (fx * f + rx * s) * speed, tvz = (fz * f + rz * s) * speed;
    if (this.slideT > 0) { const ss = lerp(3.2, 7.8, this.slideT / 0.7) * (Admin.speed || 1); tvx = this.slideDir.x * ss; tvz = this.slideDir.y * ss; }
    this.vel.x = damp(this.vel.x, tvx, 12, dt); this.vel.y = damp(this.vel.y, tvz, 12, dt);
    const ox = this.pos.x, oz = this.pos.z;
    let nx = ox + this.vel.x * dt, nz = oz + this.vel.y * dt;
    if (!env.walkable(nx, nz)) { if (env.walkable(nx, oz)) nz = oz; else if (env.walkable(ox, nz)) nx = ox; else { nx = ox; nz = oz; } }
    const p = { x: nx, z: nz }; env.resolve(p, 0.36);
    if (!env.walkable(p.x, p.z)) { p.x = ox; p.z = oz; }
    this.pos.x = p.x; this.pos.z = p.z;
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.moving = moved > 0.001;
    const gy = env.surfaceY(this.pos.x, this.pos.z);
    this.y = Math.abs(gy - this.y) > 1.2 ? gy : damp(this.y, gy, 14, dt);
    // footsteps + head bob
    if (moved > 0.001) {
      this.bobT += moved * (this.sprinting ? 2.3 : 2.6);
      this.stepAcc += moved;
      const stride = this.sprinting ? 1.05 : 0.78;
      if (this.stepAcc > stride) { this.stepAcc = 0; SFX.step(env.surfaceKind(this.pos.x, this.pos.z), this.sprinting ? 1.2 : this.crouching ? 0.3 : 0.8); }
    }
    this.fov = damp(this.fov, (this.sprinting ? 76 : 70) - this.aimK * 14 + (this.slideT > 0 ? 6 : 0), this.aiming ? 9 : 4, dt);
    this.eye = damp(this.eye, this.crouching ? 1.05 : 1.62, 10, dt);
    // how far away Joury can hear you
    this.noise = this.landT > 0 ? 14 : this.slideT > 0 ? 16 : !this.moving ? 0 : this.sprinting ? 32 : this.crouching ? 3 : (env.surfaceKind(this.pos.x, this.pos.z) === 'wood' ? 15 : 10);
    this.applyCam(dt);
  },
  applyCam() {
    const c = this.cam; if (!c) return;
    const sp = Math.min(1, Math.hypot(this.vel.x, this.vel.y) / 3.7);
    const bob = Math.sin(this.bobT * 2) * 0.04 * sp, roll = Math.sin(this.bobT) * 0.008 * sp;
    c.position.set(this.pos.x, this.y + this.eye + bob * (1 - this.aimK * 0.7) + this.jumpY, this.pos.z);
    c.rotation.set(this.pitch, this.yaw, roll * (1 - this.aimK) + (this.slideT > 0 ? 0.045 * Math.min(1, this.slideT * 4) : 0));
    if (Math.abs(c.fov - this.fov) > 0.01) { c.fov = this.fov; c.updateProjectionMatrix(); }
  },
  // flashlight battery & flicker (world only)
  updateLight(dt, danger, drain) {
    const L = this.flash; if (!L) return;
    if (this.lightOn && drain) {
      this.battery = Math.max(0, this.battery - dt * drain);
      if (this.battery <= 0) { this.lightOn = false; SFX.flashlight(false); HUD.toast('Your flashlight died. Find batteries — they glow green.'); }
    }
    let k = 1;
    if (this.lightOn) {
      if (this.battery < 0.15 && Math.random() < 0.08) this.flick = rand(0.05, 0.6);
      if (danger > 0.35 && Math.random() < danger * 0.07) this.flick = rand(0, 0.5);
      this.flick = Math.min(1, this.flick + dt * 6);
      k = this.flick * (0.55 + 0.45 * Math.min(1, this.battery / 0.25));
    } else k = 0;
    // aiming focuses the beam: narrower, brighter, longer
    const a = this.aimK; if (L.userData.dist0 === undefined) { L.userData.dist0 = L.distance; L.userData.angle0 = L.angle; }
    L.angle = L.userData.angle0 * (1 - 0.42 * a); L.distance = L.userData.dist0 * (1 + 0.4 * a);
    L.intensity = L.userData.base * k * (1 + 0.7 * a); L.userData.fill.intensity = 0.6 * k + 0.05;
    if (L.userData.beam) { L.userData.beam.material.uniforms.uStrength.value = L.userData.beamK * k * (1 + 0.4 * a); L.userData.beam.scale.set(1 - 0.4 * a, 1 - 0.4 * a, 1 + 0.3 * a); }
  },
  toggleLight() {
    if (!this.lightOn && this.battery <= 0) { HUD.toast('No battery left. Look for glowing batteries.'); SFX.flashlight(false); return; }
    this.lightOn = !this.lightOn; SFX.flashlight(this.lightOn);
  },
  forward(v) { return v.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); },
};
