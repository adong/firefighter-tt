/* TT Firefighters: the fire trucks and the firefighters. A truck faces +x (the way it drives) with its side to the
   camera; its ladder swings up from the turntable at the back to the basket, which sits FIRE.rules.PHYS.BX ahead of
   the truck's middle at the height the rules say. The firefighter rides in the basket: Teddy, Tommy, or Foxy (with
   Froggy hanging on at the back of their truck). Everyone wears a red helmet.
   FIRE.truck.make(id, o) → t; place(t, tr, dt) puts it where the rules say; act(p, mode, dt) poses a firefighter. */
(function () {
  'use strict';
  const FIRE = (window.FIRE = window.FIRE || {});
  const T = THREE;
  const G = Kit.gfx;
  const P = FIRE.rules.PHYS;

  const RIDER = 0.62; // a firefighter's size in the basket (Kit.people are 2 m tall)
  const PIVOT = new T.Vector2(-2.4, 2.8); // the ladder's turntable, in the truck's own space
  const LOOKS = {
    foxy: { head: 'human', skin: '#ff8a3c', top: '#2f6bff', bottom: '#1d2a55', shoes: '#ff8a3c', shirt: 'tee', print: 'star', hair: null },
    froggy: { head: 'human', skin: '#69c94e', top: '#ffd400', bottom: '#2f7d4f', shoes: '#69c94e', shirt: 'tee', print: 'bolt', hair: null },
  };
  // body colour, stripe, helmet
  const PAINT = {
    teddy: ['#e8382f', '#ffffff', '#e8382f'],
    tommy: ['#e8382f', '#ffd400', '#ffb02e'],
    foxy: ['#c6e83a', '#2f6bff', '#ffd400'],
  };
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY', foxy: 'FOXY', froggy: 'FROGGY' };
  const TAGS = { teddy: '#8cc2ff', tommy: '#ffb02e', foxy: '#ffb27a', froggy: '#a6f08a' };

  // a fox's or a frog's head in place of the boy's (same size, facing -z like the body). From TT Surf.
  function animalHead(kind, head) {
    head.children.forEach((c) => { c.visible = false; });
    const fur = G.std(kind === 'foxy' ? '#ff8a3c' : '#69c94e'), dark = G.std('#1b1a22'), white = G.std('#ffffff');
    const box = (w, h, d, m, x, y, z) => G.mesh(new T.BoxGeometry(w, h, d), m, x, y, z, head, false);
    box(0.54, 0.48, 0.48, fur, 0, 0, 0);
    for (const s of [-1, 1]) {
      box(0.08, 0.1, 0.03, dark, s * 0.12, 0.06, -0.25);
      box(0.03, 0.03, 0.02, white, s * 0.1, 0.09, -0.27);
      if (kind === 'foxy') {
        const ear = box(0.17, 0.17, 0.07, fur, s * 0.19, 0.27, 0);
        ear.rotation.z = Math.PI / 4;
        box(0.09, 0.09, 0.02, dark, s * 0.19, 0.27, -0.04).rotation.z = Math.PI / 4;
      } else {
        box(0.17, 0.13, 0.17, fur, s * 0.15, 0.27, -0.06);
        box(0.08, 0.08, 0.03, dark, s * 0.15, 0.29, -0.15);
        box(0.035, 0.035, 0.02, white, s * 0.14, 0.31, -0.17);
      }
    }
    if (kind === 'foxy') {
      box(0.24, 0.16, 0.14, G.std('#fff1e0'), 0, -0.1, -0.29);
      box(0.08, 0.06, 0.04, dark, 0, -0.05, -0.37);
      box(0.56, 0.12, 0.5, G.std('#fff1e0'), 0, -0.2, 0);
    } else {
      box(0.36, 0.04, 0.02, G.std('#2a6a1f'), 0, -0.12, -0.245);
      box(0.56, 0.14, 0.5, G.std('#d8f5b0'), 0, -0.19, 0);
    }
  }
  // a firefighter's helmet: a dome, a long brim at the back, a gold badge at the front
  function helmet(head, color, animal) {
    if (!animal) for (const c of head.children) if (c.position.y >= 0.25) c.visible = false; // the crown and spikes tuck in
    const m = G.std(color, { roughness: 0.35 }), gold = G.std('#ffd400', { metalness: 0.4, roughness: 0.3 });
    const y = animal ? 0.34 : 0.33;
    G.mesh(new T.BoxGeometry(0.6, 0.22, 0.58), m, 0, y, 0, head, false);
    G.mesh(new T.BoxGeometry(0.46, 0.08, 0.46), m, 0, y + 0.14, 0, head, false);
    G.mesh(new T.BoxGeometry(0.7, 0.05, 0.84), m, 0, y - 0.1, 0.07, head, false);
    G.mesh(new T.BoxGeometry(0.18, 0.18, 0.04), gold, 0, y + 0.02, -0.31, head, false);
  }

  function person(id, color) {
    const entry = Kit.roster.get(id);
    const look = LOOKS[id] || (entry && entry.look) || LOOKS.foxy;
    const p = Kit.people.build(Object.assign({}, look, { peace: true }));
    if (LOOKS[id]) animalHead(id, p.head);
    helmet(p.head, color, !!LOOKS[id]);
    return p;
  }

  // the "TT" badge on the doors (names stay as they are in 中文)
  let badgeTex = null;
  function badge() {
    if (badgeTex) return badgeTex;
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#ffd400';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 40 : 62;
      g.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r);
    }
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#7a4a00';
    g.stroke();
    g.fillStyle = '#c0141c';
    g.font = `44px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('TT', 64, 70);
    badgeTex = G.toTexture(c);
    return badgeTex;
  }

  function make(id, o) {
    o = o || {};
    const [paint, stripe, hat] = PAINT[id] || PAINT.teddy;
    const outer = new T.Group();
    const red = G.std(paint, { roughness: 0.45 }), white = G.std(stripe, { roughness: 0.5 });
    const steel = G.std('#d7dde4', { metalness: 0.6, roughness: 0.3 }), dark = G.std('#24242c'), glass = G.std('#7fc8ff', { roughness: 0.1, metalness: 0.3 });
    const box = (w, h, d, m, x, y, z, parent) => G.mesh(new T.BoxGeometry(w, h, d), m, x, y, z, parent || outer, false);
    // body and cab
    box(7.6, 0.4, 2.2, dark, 0, 0.75, 0);
    box(4.9, 1.7, 2.4, red, -1.35, 1.55, 0);
    box(2.7, 1.95, 2.4, red, 2.45, 1.675, 0);
    box(0.08, 0.8, 2.0, glass, 3.82, 2.15, 0);
    for (const s of [-1, 1]) {
      box(1.3, 0.72, 0.04, glass, 2.65, 2.15, s * 1.21);
      box(7.5, 0.18, 0.04, white, -0.1, 1.2, s * 1.215);
      for (const x of [-3.1, -1.75, -0.4]) box(1.2, 0.95, 0.04, steel, x, 1.75, s * 1.215);
    }
    const plate = new T.Mesh(new T.PlaneGeometry(0.75, 0.75), new T.MeshStandardMaterial({ map: badge(), transparent: true, roughness: 0.5 }));
    plate.position.set(1.85, 1.75, 1.24);
    outer.add(plate);
    box(0.3, 0.35, 2.5, steel, 3.95, 0.75, 0);
    box(0.15, 0.2, 0.5, G.std('#fff7c0', { emissive: '#fff2a0', emissiveIntensity: 0.6 }), 3.86, 1.1, 0.85);
    box(0.15, 0.2, 0.5, G.std('#fff7c0', { emissive: '#fff2a0', emissiveIntensity: 0.6 }), 3.86, 1.1, -0.85);
    // the flashing lights on the cab roof
    const lightR = G.std('#ff2a2a', { emissive: '#ff0000', emissiveIntensity: 0.2 });
    const lightB = G.std('#2a7bff', { emissive: '#0050ff', emissiveIntensity: 0.2 });
    box(0.4, 0.22, 0.9, lightR, 2.5, 2.76, -0.5);
    box(0.4, 0.22, 0.9, lightB, 2.5, 2.76, 0.5);
    // wheels
    const wheels = [];
    const wg = new T.CylinderGeometry(0.55, 0.55, 0.4, 18);
    wg.rotateX(Math.PI / 2);
    const hubG = new T.CylinderGeometry(0.26, 0.26, 0.42, 10);
    hubG.rotateX(Math.PI / 2);
    for (const x of [-2.6, -1.45, 2.4]) {
      for (const s of [-1, 1]) {
        const w = G.mesh(wg, dark, x, 0.55, s * 1.1, outer, false);
        G.mesh(hubG, steel, 0, 0, 0, w, false);
        G.mesh(new T.BoxGeometry(0.08, 0.36, 0.43), G.std('#9aa3ad'), 0, 0, 0, w, false);
        wheels.push(w);
      }
    }
    // turntable, ladder (two rails that stretch, rungs that show up to its length), basket
    G.mesh(new T.CylinderGeometry(0.7, 0.8, 0.35, 16), steel, PIVOT.x, 2.55, 0, outer, false);
    const ladder = new T.Group();
    ladder.position.set(PIVOT.x, PIVOT.y, 0);
    outer.add(ladder);
    const railG = new T.BoxGeometry(1, 0.14, 0.12).translate(0.5, 0, 0);
    const rails = [-0.5, 0.5].map((z) => G.mesh(railG, steel, 0, 0, z, ladder, false));
    const rails2 = [-0.42, 0.42].map((z) => G.mesh(railG, white, 0, 0.13, z, ladder, false));
    const rungs = [];
    const rungG = new T.BoxGeometry(0.06, 0.06, 1.0);
    for (let i = 0; i < 48; i++) rungs.push(G.mesh(rungG, steel, 0.3 + i * 0.45, 0, 0, ladder, false));
    const basket = new T.Group();
    outer.add(basket);
    const yellow = G.std('#ffd400', { roughness: 0.4 });
    box(1.5, 0.12, 1.6, steel, 0, 0.06, 0, basket);
    for (const s of [-1, 1]) {
      box(1.5, 0.08, 0.08, yellow, 0, 0.95, s * 0.8, basket);
      box(0.08, 0.08, 1.6, yellow, s * 0.75, 0.95, 0, basket);
      box(1.5, 0.32, 0.05, red, 0, 0.3, s * 0.8, basket);
      box(0.05, 0.32, 1.6, red, s * 0.75, 0.3, 0, basket);
      for (const t of [-1, 1]) box(0.07, 0.9, 0.07, yellow, s * 0.75, 0.5, t * 0.8, basket);
    }
    // the nozzle, on the rail that faces the buildings
    const noz = G.mesh(new T.CylinderGeometry(0.09, 0.14, 0.7, 10), steel, 0, P.NOZ, -0.95, basket, false);
    noz.rotation.x = Math.PI / 2;
    // the firefighter
    const p = person(id === 'foxy' ? 'foxy' : id, hat);
    const rider = new T.Group();
    rider.add(p.root);
    rider.scale.setScalar(RIDER);
    rider.position.set(0, 0.1, 0.15);
    basket.add(rider);
    p.root.rotation.y = Math.PI;
    // Froggy rides on the back step of Foxy's truck
    let pal = null;
    if (id === 'foxy') {
      const fp = person('froggy', '#ffd400');
      pal = new T.Group();
      pal.add(fp.root);
      pal.scale.setScalar(RIDER);
      pal.position.set(-4.0, 0.6, 0.6);
      fp.root.rotation.y = Math.PI * 0.65;
      outer.add(pal);
      box(0.5, 0.1, 1.6, steel, -4.0, 0.6, 0.2);
      pal.p = fp;
    }
    let tag = null;
    if (o.tag) {
      tag = G.nameTag(NAMES[id] || id.toUpperCase(), TAGS[id] || '#ffffff');
      tag.material.depthTest = false;
      tag.renderOrder = 5;
      tag.scale.multiplyScalar(1.5);
      basket.add(tag);
      tag.position.set(0, 2.6, 0);
    }
    return {
      id, outer, ladder, rails, rails2, rungs, basket, rider, p, pal, wheels, lightR, lightB, tag,
      ph: Math.random() * 6, face: Math.PI, spin: 0, flash: 0, kittens: [], mode: null, modeT: 0,
    };
  }

  const v2 = new T.Vector2();
  // put the truck where the rules say: x, the ladder, the basket; wheels roll, lights flash
  function place(t, tr, dt, laneZ) {
    t.outer.position.set(tr.x, 0, laneZ);
    t.basket.position.set(P.BX, tr.h, 0);
    // the ladder runs from the turntable to the back of the basket
    v2.set(P.BX - 0.7 - PIVOT.x, tr.h + 0.35 - PIVOT.y);
    const len = Math.max(0.5, v2.length());
    t.ladder.rotation.z = Math.atan2(v2.y, v2.x);
    for (const r of t.rails) r.scale.x = len;
    // the top section slides out of the bottom one
    const fly = Math.max(0, len - 4.5);
    for (const r of t.rails2) { r.scale.x = Math.min(len, 4.5 + fly * 0.98); }
    for (let i = 0; i < t.rungs.length; i++) t.rungs[i].visible = 0.3 + i * 0.45 < len - 0.1;
    // wheels
    t.spin += (tr.v * dt) / 0.55;
    for (const w of t.wheels) w.rotation.z = -t.spin;
    // lights: flashing while there's work to do
    t.flash += dt;
    const on = Math.floor(t.flash * 4) % 2 === 0;
    t.lightR.emissiveIntensity = on ? 1.6 : 0.15;
    t.lightB.emissiveIntensity = on ? 0.15 : 1.6;
    t.ph += dt * 5;
  }

  // a firefighter's pose. mode: idle (facing you), spray (facing the building, both hands on the nozzle),
  // or any Kit.people pose: wave, peace, boxing, jumpshot, give, jump
  function act(t, mode, dt, faceAngle) {
    const p = t.p;
    const k = 1 - Math.exp(-14 * dt);
    if (mode !== t.mode) { t.mode = mode; t.modeT = 0; }
    t.modeT += dt;
    let face = Math.PI - 0.25;
    let pose = mode;
    if (mode === 'spray') { face = faceAngle != null ? faceAngle : -0.35; pose = 'grab'; }
    else if (mode === 'idle') pose = 'stand';
    t.face += (face - t.face) * Math.min(1, dt * 8);
    p.root.rotation.y = t.face;
    Kit.people.pose(p, t.ph, pose, k);
    if (mode === 'spray') { p.armL.rotation.x = -1.35; p.armR.rotation.x = -1.35; }
    for (const f of p.fingers) f.visible = mode === 'peace';
    if (t.pal) {
      Kit.people.pose(t.pal.p, t.ph, 'wave', k);
      t.pal.p.armL.rotation.z = -0.5;
    }
  }

  // the firefighter's hand, in the world (for throwing the 🏀, catching treats)
  const hv = new T.Vector3();
  function hand(t, side) {
    t.outer.updateMatrixWorld(true);
    return Kit.people.handWorld(t.p, side || 1, hv).clone();
  }
  function basketWorld(t, out) {
    t.outer.updateMatrixWorld(true);
    return (out || new T.Vector3()).setFromMatrixPosition(t.basket.matrixWorld);
  }
  // where the nozzle's water comes out
  function nozzleWorld(t, out) {
    basketWorld(t, out);
    out.y += P.NOZ;
    out.z -= 1.3;
    return out;
  }
  // where a rescued kitten sits on the truck: on top, along the back
  function kittenSlot(t, n, out) {
    t.outer.updateMatrixWorld(true);
    return (out || new T.Vector3()).set(-3.4 + n * 0.85 + (n > 0 ? 0.9 : 0), 2.4, 0.75).applyMatrix4(t.outer.matrixWorld);
  }
  function ladderPoint(t, f, out) {
    t.outer.updateMatrixWorld(true);
    const len = t.rails[0].scale.x;
    return (out || new T.Vector3()).set(f * len, 0.35, 0).applyMatrix4(t.ladder.matrixWorld);
  }

  // a firefighter on foot, for the brother's visit: same body, helmet on
  function walker(id, scale) {
    const p = person(id, '#e8382f');
    const g = new T.Group();
    g.add(p.root);
    g.scale.setScalar(scale);
    // his own hose nozzle, in his hands
    const noz = G.mesh(new T.CylinderGeometry(0.06, 0.1, 0.55, 10), G.std('#d7dde4', { metalness: 0.6, roughness: 0.3 }), 0, 1.25, -0.55, p.root, false);
    noz.rotation.x = Math.PI / 2;
    noz.visible = false;
    return { id, outer: g, p, noz, ph: 0, face: Math.PI, mode: null, modeT: 0, scale };
  }

  FIRE.truck = { make, place, act, hand, basketWorld, nozzleWorld, kittenSlot, ladderPoint, walker, person, RIDER, NAMES, TAGS };
})();
