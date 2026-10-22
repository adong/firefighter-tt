/* TT Firefighters: the 3D street. The sky, the road and the sidewalk, the buildings (their fronts drawn on canvases:
   windows with curtains, shop windows, awnings and emoji signs), trees, the fire hydrant, the silly fires (flames with
   googly eyes, the thing that's on fire sitting on the sill), the kittens, and the water, smoke, steam and hearts.
   Buildings stand behind z = 0 with their fronts to the road; the camera stands out on the road side (+z). */
(function () {
  'use strict';
  const FIRE = (window.FIRE = window.FIRE || {});
  const T = THREE;
  const G = Kit.gfx;
  const Lv = FIRE.levels;
  const PX = 40; // canvas pixels per metre on a building's front

  let renderer, scene, hemi, sun, street = null, level = null, night = false;
  let skyDay, skyNight, stars, moon, sunGlow;
  let fireViews = [], kittenViews = [];
  let water, splash, puffs = [], icons = [];
  let clock = 0;

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setScissorTest(true);
    scene = new T.Scene();
    hemi = new T.HemisphereLight('#f4fbff', '#6a7a5a', 0.85);
    scene.add(hemi);
    sun = new T.DirectionalLight('#fff4dd', 0.8);
    sun.position.set(-30, 60, 80);
    scene.add(sun);
    skyDay = skyTexture(['#5ec8ff', '#a8e4ff', '#e6f8ff']);
    skyNight = skyTexture(['#0b1440', '#1d2a6b', '#3b3f86']);
    buildSkyBits();
    buildParticles();
    Kit.lang.onChange(relang);
  }

  function skyTexture(stops) {
    const [c, g] = G.makeCanvas(4, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
    return G.toTexture(c);
  }
  // the moon and stars (night), the sun (day): far away, they follow the camera in render()
  let far;
  function buildSkyBits() {
    far = new T.Group();
    scene.add(far);
    sunGlow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: '#fff3c0', depthWrite: false, fog: false, transparent: true }));
    sunGlow.scale.setScalar(70);
    sunGlow.position.set(-60, 70, -200);
    far.add(sunGlow);
    moon = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture('🌙'), depthWrite: false, fog: false, transparent: true }));
    moon.scale.setScalar(26);
    moon.position.set(50, 70, -200);
    far.add(moon);
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 700;
      pos[i * 3 + 1] = 20 + Math.random() * 200;
      pos[i * 3 + 2] = -220 - Math.random() * 40;
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.BufferAttribute(pos, 3));
    stars = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 1.6, map: G.dotTexture(), transparent: true, depthWrite: false, fog: false }));
    far.add(stars);
  }

  // ---------------------------------------------------------------- textures
  function facade(b, nightOn) {
    const W = Math.round(b.w * PX), roof = Lv.roofY(b), H = Math.round(roof * PX);
    const [c, g] = G.makeCanvas(W, H);
    const [ec, eg] = G.makeCanvas(W, H);
    eg.fillStyle = '#000';
    eg.fillRect(0, 0, W, H);
    const Y = (y) => H - y * PX; // metres up → canvas y
    g.fillStyle = b.color;
    g.fillRect(0, 0, W, H);
    // bricks
    g.fillStyle = G.shade(b.color, -0.06);
    for (let y = 0; y < roof; y += 0.36) {
      const off = Math.round(y / 0.36) % 2 ? 0 : 0.4;
      for (let x = -off; x < b.w; x += 0.8) g.fillRect(x * PX, Y(y) - 1, 0.74 * PX, 2);
    }
    // ledges between floors
    g.fillStyle = G.shade(b.color, -0.22);
    for (let k = 0; k <= b.floors; k++) g.fillRect(0, Y(Lv.GROUND + k * Lv.FLOOR) - 4, W, 8);
    // the ground floor: a shop (window, awning, sign) or a front door
    const shop = !!(b.sign || b.awning);
    const rnd = G.rand;
    if (shop) {
      g.fillStyle = '#2d3142';
      g.fillRect(0.4 * PX, Y(2.7), (b.w - 0.8) * PX, 2.6 * PX);
      g.fillStyle = '#bfe8ff';
      g.fillRect(0.55 * PX, Y(2.55), (b.w * 0.62) * PX, 2.3 * PX);
      g.fillStyle = 'rgba(255,255,255,.45)';
      g.beginPath();
      g.moveTo(0.9 * PX, Y(0.4)); g.lineTo(1.6 * PX, Y(0.4)); g.lineTo(2.6 * PX, Y(2.5)); g.lineTo(1.9 * PX, Y(2.5));
      g.fill();
      if (nightOn) { eg.fillStyle = '#ffd98a'; eg.fillRect(0.55 * PX, Y(2.55), (b.w * 0.62) * PX, 2.3 * PX); }
      g.fillStyle = '#8a5a32';
      g.fillRect((b.w - 1.9) * PX, Y(2.4), 1.2 * PX, 2.4 * PX);
      g.fillStyle = '#ffd400';
      g.fillRect((b.w - 1.0) * PX, Y(1.2), 6, 6);
    } else if (b.door) {
      const dx = b.w / 2 - 0.65;
      g.fillStyle = G.shade(b.color, -0.35);
      g.fillRect((dx - 0.15) * PX, Y(2.75), 1.6 * PX, 2.75 * PX);
      g.fillStyle = '#9b5d33';
      g.fillRect(dx * PX, Y(2.55), 1.3 * PX, 2.55 * PX);
      g.fillStyle = '#ffd400';
      g.fillRect((dx + 1.05) * PX, Y(1.3), 6, 6);
      // little windows either side
      for (const x of [0.6, b.w - 1.7]) {
        if (x < dx - 1.2 || x > dx + 1.4) win(g, eg, x * PX, Y(2.6), 1.1 * PX, 1.2 * PX, nightOn && rnd(0, 1) < 0.6, b);
      }
    }
    // windows on every floor
    const n = Lv.cols(b);
    for (let k = 1; k <= b.floors; k++) {
      for (let cI = 0; cI < n; cI++) {
        const p = Lv.winPos(b, k, cI);
        win(g, eg, (p.x - b.x - 0.65) * PX, Y(p.y + 0.8), 1.3 * PX, 1.6 * PX, nightOn && rnd(0, 1) < 0.55, b, true);
      }
    }
    // the sign above the shop
    if (b.sign) {
      const cx = (b.w * 0.34) * PX, cy = Y(3.15);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx, cy, 0.42 * PX, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#14121f';
      g.stroke();
      g.font = `${Math.round(0.6 * PX)}px ${G.EMOJI_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(b.sign, cx, cy + 2);
    }
    const map = G.toTexture(c);
    const em = G.toTexture(ec);
    return { map, em };
  }
  function win(g, eg, x, y, w, h, lit, b, sill) {
    g.fillStyle = '#ffffff';
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    const glass = g.createLinearGradient(x, y, x + w, y + h);
    glass.addColorStop(0, lit ? '#ffe9a8' : '#a9dcff');
    glass.addColorStop(1, lit ? '#ffc65c' : '#5d9fd6');
    g.fillStyle = glass;
    g.fillRect(x, y, w, h);
    // curtains
    const cc = G.pick(['#ff8fab', '#ffd166', '#8ecae6', '#cdb4db', '#b9fbc0', '#ffffff']);
    g.fillStyle = cc;
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x + w * 0.28, y); g.quadraticCurveTo(x + w * 0.12, y + h * 0.5, x + w * 0.2, y + h); g.lineTo(x, y + h);
    g.fill();
    g.beginPath();
    g.moveTo(x + w, y); g.lineTo(x + w * 0.72, y); g.quadraticCurveTo(x + w * 0.88, y + h * 0.5, x + w * 0.8, y + h); g.lineTo(x + w, y + h);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(x + w / 2 - 2, y, 4, h);
    g.fillRect(x, y + h * 0.45, w, 4);
    if (lit) { eg.fillStyle = '#ffcf6a'; eg.fillRect(x, y, w, h); }
    if (sill && G.rand(0, 1) < 0.35) {
      // a flower box
      g.fillStyle = '#8a5a32';
      g.fillRect(x - 2, y + h + 4, w + 4, 10);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = G.pick(['#ff3d7f', '#ffd400', '#ffffff', '#ff8a1f']);
        g.beginPath();
        g.arc(x + w * (0.15 + i * 0.23), y + h + 2, 5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  function stripes(a, b2) {
    const [c, g] = G.makeCanvas(64, 8);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b2 : a; g.fillRect(i * 8, 0, 8, 8); }
    return G.toTexture(c);
  }
  // a silly flame with a face. face: 'grin' (cheeky), 'oops' (being sprayed), 'big' (the big fire), 'bigOops'
  const flameTex = {};
  function flame(face) {
    if (flameTex[face]) return flameTex[face];
    const [c, g] = G.makeCanvas(128, 160);
    const path = (s, dy) => {
      g.save();
      g.translate(64, 156 + dy);
      g.scale(s, s);
      g.translate(-64, -156);
      g.beginPath();
      g.moveTo(64, 156);
      g.bezierCurveTo(14, 154, 6, 110, 24, 80);
      g.bezierCurveTo(30, 96, 38, 96, 42, 90);
      g.bezierCurveTo(32, 58, 44, 28, 62, 4);
      g.bezierCurveTo(70, 32, 84, 44, 86, 62);
      g.bezierCurveTo(94, 54, 98, 42, 100, 30);
      g.bezierCurveTo(126, 66, 126, 130, 64, 156);
      g.closePath();
      g.restore();
    };
    path(1, 0);
    const gr = g.createRadialGradient(64, 124, 4, 64, 110, 100);
    gr.addColorStop(0, '#fff6b0');
    gr.addColorStop(0.35, '#ffd23a');
    gr.addColorStop(0.7, '#ff8a1f');
    gr.addColorStop(1, '#f2402a');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#b3201a';
    g.stroke();
    path(0.55, -8);
    g.fillStyle = 'rgba(255, 250, 200, 0.55)';
    g.fill();
    // the face
    const oops = face === 'oops' || face === 'bigOops', big = face === 'big' || face === 'bigOops';
    const eye = (x, y) => {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(x, y, oops ? 13 : 11, oops ? 15 : 12, 0, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#14121f';
      g.stroke();
      g.fillStyle = '#14121f';
      g.beginPath();
      g.arc(x + (oops ? 0 : 3), y + (oops ? -2 : 2), oops ? 5 : 6, 0, Math.PI * 2);
      g.fill();
    };
    eye(48, 106);
    eye(80, 106);
    g.strokeStyle = '#14121f';
    g.lineWidth = 4;
    if (big) {
      // cheeky eyebrows
      g.beginPath(); g.moveTo(34, oops ? 84 : 90); g.lineTo(58, oops ? 88 : 94); g.stroke();
      g.beginPath(); g.moveTo(94, oops ? 84 : 90); g.lineTo(70, oops ? 88 : 94); g.stroke();
    }
    if (oops) {
      g.fillStyle = '#7a1410';
      g.beginPath();
      g.ellipse(64, 134, 9, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#7fd3ff';
      g.beginPath();
      g.moveTo(102, 92); g.quadraticCurveTo(110, 106, 102, 110); g.quadraticCurveTo(94, 106, 102, 92);
      g.fill();
    } else {
      g.fillStyle = '#7a1410';
      g.beginPath();
      g.moveTo(44, 126);
      g.quadraticCurveTo(64, 150, 84, 126);
      g.closePath();
      g.fill();
      if (big) { g.fillStyle = '#ffffff'; g.fillRect(52, 126, 9, 7); g.fillRect(67, 126, 9, 7); }
      g.fillStyle = '#ff7a8a';
      g.beginPath(); g.arc(70, 136, 5, 0, Math.PI); g.fill();
    }
    flameTex[face] = G.toTexture(c);
    return flameTex[face];
  }
  function softTex() { return G.radialTexture(64, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]); }

  // ---------------------------------------------------------------- the street
  function setLevel(L) {
    if (street) { scene.remove(street); disposeTree(street); }
    level = L;
    night = !!L.night;
    street = new T.Group();
    scene.add(street);
    scene.background = night ? skyNight : skyDay;
    scene.fog = new T.Fog(night ? '#1d2a6b' : '#d8f1ff', 90, 260);
    hemi.intensity = night ? 0.45 : 0.85;
    hemi.color.set(night ? '#9fb0ff' : '#f4fbff');
    sun.intensity = night ? 0.25 : 0.8;
    sun.color.set(night ? '#b8c4ff' : '#fff4dd');
    stars.visible = moon.visible = night;
    sunGlow.visible = !night;
    const box = (w, h, d, m, x, y, z, parent) => G.mesh(new T.BoxGeometry(w, h, d), m, x, y, z, parent || street, false);
    const x0 = L.roadL - 60, x1 = L.roadR + 60, cx = (x0 + x1) / 2, len = x1 - x0;
    // road, lane lines, sidewalks, curbs, grass
    const [rc, rg] = G.makeCanvas(256, 256);
    rg.fillStyle = night ? '#3a3d4a' : '#555a66';
    rg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) { rg.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; rg.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
    rg.fillStyle = '#ffd400';
    rg.fillRect(0, 124, 150, 10);
    const rt = G.toTexture(rc, true);
    rt.repeat.set(len / 8, 1);
    const road = new T.Mesh(new T.PlaneGeometry(len, 16), G.std('#ffffff', { map: rt, roughness: 0.95 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0, 10.4);
    street.add(road);
    const [sc, sg] = G.makeCanvas(64, 64);
    sg.fillStyle = night ? '#9a9caa' : '#d9d6cf';
    sg.fillRect(0, 0, 64, 64);
    sg.fillStyle = night ? '#85879a' : '#c2beb5';
    sg.fillRect(0, 0, 64, 3);
    sg.fillRect(0, 0, 3, 64);
    const st = G.toTexture(sc, true);
    st.repeat.set(len / 1.6, 1.5);
    for (const [z, d] of [[1.2, 2.4], [19.6, 2.4]]) {
      const side = new T.Mesh(new T.PlaneGeometry(len, d), G.std('#ffffff', { map: st, roughness: 0.9 }));
      side.rotation.x = -Math.PI / 2;
      side.position.set(cx, 0.12, z);
      street.add(side);
    }
    const curb = G.std(night ? '#b8bac6' : '#eeebe4');
    box(len, 0.16, 0.25, curb, cx, 0.08, 2.4);
    box(len, 0.16, 0.25, curb, cx, 0.08, 18.4);
    const grass = new T.Mesh(new T.PlaneGeometry(len, 120), G.std(night ? '#2c5a3a' : '#7cc95a', { roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(cx, -0.02, -60);
    street.add(grass);
    const front = new T.Mesh(new T.PlaneGeometry(len, 60), G.std(night ? '#2c5a3a' : '#7cc95a', { roughness: 1 }));
    front.rotation.x = -Math.PI / 2;
    front.position.set(cx, -0.02, 50.8);
    street.add(front);
    // far hills and a far town
    const hillM = G.std(night ? '#24405a' : '#9fd88a', { roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const hl = G.mesh(new T.SphereGeometry(30 + (i % 3) * 8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hillM, x0 + i * (len / 8), -2, -110 - (i % 2) * 20, street, false);
      hl.scale.y = 0.45;
    }
    const farM = [G.std(night ? '#33386b' : '#bcd3e8'), G.std(night ? '#2b2f5c' : '#a9c2db')];
    for (let x = x0; x < x1; x += 7 + Math.random() * 5) {
      const h = 8 + Math.random() * 18;
      box(5 + Math.random() * 3, h, 4, farM[Math.random() < 0.5 ? 0 : 1], x, h / 2, -45 - Math.random() * 10);
    }
    // buildings
    for (const b of L.buildings) buildBuilding(b, box);
    // trees
    for (const t of L.trees) buildTree(t, box);
    // hedges between buildings, a fence in the park
    const hedge = G.std(night ? '#2f6b42' : '#4caf50');
    let last = L.roadL;
    const blocks = L.buildings.slice().sort((a, b) => a.x - b.x);
    for (const b of blocks) {
      if (b.x - last > 1.2) box(b.x - last - 0.4, 0.9, 0.9, hedge, (last + b.x) / 2, 0.45, -0.6);
      last = b.x + b.w;
    }
    if (L.roadR - last > 1.2) box(L.roadR - last, 0.9, 0.9, hedge, (last + L.roadR) / 2, 0.45, -0.6);
    // the fire hydrant
    const hyd = new T.Group();
    hyd.position.set(L.hydrant, 0.1, 1.5);
    street.add(hyd);
    const hm = G.std('#e8382f', { roughness: 0.35 }), hs = G.std('#ffd400', { roughness: 0.4 });
    G.mesh(new T.CylinderGeometry(0.3, 0.36, 0.9, 14), hm, 0, 0.45, 0, hyd, false);
    G.mesh(new T.CylinderGeometry(0.34, 0.34, 0.12, 14), hs, 0, 0.92, 0, hyd, false);
    G.mesh(new T.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm, 0, 0.98, 0, hyd, false);
    for (const s of [-1, 1]) {
      const n = G.mesh(new T.CylinderGeometry(0.12, 0.12, 0.3, 10), hs, s * 0.36, 0.55, 0, hyd, false);
      n.rotation.z = Math.PI / 2;
    }
    const nz = G.mesh(new T.CylinderGeometry(0.15, 0.15, 0.3, 10), hs, 0, 0.55, 0.34, hyd, false);
    nz.rotation.x = Math.PI / 2;
    hydrantGroup = hyd;
    // street lamps (lit at night)
    lamps = [];
    for (let x = L.roadL + 3; x < L.roadR; x += 12) {
      const pole = G.std('#3a3f52');
      box(0.18, 5.2, 0.18, pole, x, 2.6, 2.1);
      box(1.1, 0.14, 0.18, pole, x + 0.45, 5.2, 2.1);
      const bulb = box(0.5, 0.22, 0.4, G.std('#fff7d0', { emissive: '#ffe9a0', emissiveIntensity: night ? 1.4 : 0.1 }), x + 0.85, 5.05, 2.1);
      if (night) {
        const gl = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: '#ffe39a', transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.6 }));
        gl.scale.setScalar(4);
        gl.position.set(x + 0.85, 5, 2.2);
        street.add(gl);
      }
      lamps.push(bulb);
    }
  }
  let hydrantGroup = null, lamps = [];

  function buildBuilding(b, box) {
    const roof = Lv.roofY(b), D = 9;
    const tex = facade(b, night);
    const wall = G.std(G.shade(b.color, -0.12), { roughness: 0.9 });
    const front = new T.MeshStandardMaterial({ map: tex.map, roughness: 0.85, emissive: night ? '#ffffff' : '#000000', emissiveMap: tex.em, emissiveIntensity: night ? 0.9 : 0 });
    const g = new T.Mesh(new T.BoxGeometry(b.w, roof, D), [wall, wall, wall, wall, front, wall]);
    g.position.set(b.x + b.w / 2, roof / 2, -D / 2);
    street.add(g);
    const trim = G.std(G.shade(b.color, -0.3), { roughness: 0.8 });
    // window sills
    const n = Lv.cols(b);
    for (let k = 1; k <= b.floors; k++) {
      for (let c = 0; c < n; c++) {
        const p = Lv.winPos(b, k, c);
        box(1.55, 0.12, 0.34, G.std('#ffffff'), p.x, p.y - 0.86, 0.12);
      }
    }
    // the roof: a pointy one, or a flat one with a ledge
    if (b.gable) {
      const gh = Lv.gableH(b), half = b.w / 2 + 0.4;
      const s = new T.Shape();
      s.moveTo(-half, 0); s.lineTo(half, 0); s.lineTo(0, gh); s.closePath();
      const geo = new T.ExtrudeGeometry(s, { depth: D + 0.6, bevelEnabled: false });
      const rm = G.mesh(geo, G.std(b.gable, { roughness: 0.7 }), b.x + b.w / 2, roof, -D - 0.3, street, false);
      rm.position.z = -D;
      box(0.7, 1.6, 0.7, G.std('#9b5d33'), b.x + b.w * 0.75, roof + gh * 0.55, -3);
    } else {
      box(b.w + 0.3, 0.45, 0.35, trim, b.x + b.w / 2, roof + 0.22, 0.1);
      box(b.w + 0.3, 0.45, D, trim, b.x + b.w / 2, roof + 0.05, -D / 2);
      box(1.2, 0.9, 1.2, G.std('#c7ccd6'), b.x + b.w * 0.7, roof + 0.7, -4);
    }
    if (b.awning) {
      const aw = new T.Mesh(new T.BoxGeometry(b.w * 0.7, 0.12, 1.3), G.std('#ffffff', { map: stripes(b.awning, '#ffffff'), roughness: 0.7 }));
      aw.position.set(b.x + b.w * 0.34, 2.85, 0.6);
      aw.rotation.x = 0.35;
      street.add(aw);
    }
  }

  function buildTree(t, box) {
    const TR = Lv.TREE, z = -0.4;
    const trunk = G.std('#8a5a32', { roughness: 0.9 });
    const leaf = [G.std(night ? '#2f7a45' : '#4caf50'), G.std(night ? '#286b3c' : '#43a047'), G.std(night ? '#3a8c52' : '#66bb6a')];
    box(0.6, TR.trunk + 1, 0.6, trunk, t.x, (TR.trunk + 1) / 2, z);
    box(TR.w, 2.2, 3, leaf[0], t.x, TR.trunk + 1.4, z);
    box(TR.w - 0.8, 1.6, 2.6, leaf[1], t.x - 0.3, TR.trunk + 3.1, z);
    box(TR.w - 1.6, 1.0, 2.0, leaf[2], t.x + 0.2, TR.top - 0.3, z);
    // the branch the kitten sits on
    const br = box(1.6, 0.25, 0.25, trunk, t.x + 0.6, TR.trunk + 1.0, z + 1.2);
    br.rotation.y = -0.6;
    if (t.house) {
      // a treehouse, out in front of the leaves
      const hz = z + 1.8;
      box(2.2, 1.6, 1.4, G.std('#c98b52'), t.x, TR.top - 1.6, hz);
      box(0.7, 1.0, 0.05, G.std('#5c3a1e'), t.x - 0.5, TR.top - 1.8, hz + 0.72);
      const s = new T.Shape();
      s.moveTo(-1.4, 0); s.lineTo(1.4, 0); s.lineTo(0, 0.9); s.closePath();
      G.mesh(new T.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: false }), G.std('#e07a5f'), t.x, TR.top - 0.8, hz - 0.85, street, false);
    }
  }
  function disposeTree(o) {
    o.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      const mats = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
      for (const m of mats) {
        if (m.map && !Object.values(flameTex).includes(m.map) && !m.map.keep) m.map.dispose();
        if (m.emissiveMap) m.emissiveMap.dispose();
        m.dispose();
      }
    });
  }
  function zOf(what, f) {
    // fires and kittens in trees sit out in front of the leaves; the rest in a window or on a roof
    if (f.tree != null) return what === 'fire' ? 1.75 : 1.0;
    if (f.roof != null) return what === 'fire' ? -0.6 : -0.3;
    return what === 'fire' ? 0.18 : 0.42;
  }

  // ---------------------------------------------------------------- fires and kittens for a mission
  let flameSoft = null;
  function setMission(m) {
    for (const v of fireViews) street && street.remove(v.g);
    for (const v of kittenViews) scene.remove(v.g);
    fireViews = [];
    kittenViews = [];
    flameSoft = flameSoft || softTex();
    for (const f of m.fires) {
      const src = level.fires[f.i];
      const g = new T.Group();
      g.position.set(f.x, f.y, zOf('fire', src));
      street.add(g);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: '#ff9a3c', transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.8 }));
      g.add(glow);
      const fl = new T.Sprite(new T.SpriteMaterial({ map: flame(f.big ? 'big' : 'grin'), transparent: true, depthWrite: false }));
      fl.center.set(0.5, 0.04);
      g.add(fl);
      let pane = null;
      if (src.b != null) {
        pane = new T.Mesh(new T.PlaneGeometry(1.3, 1.6), new T.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.85, depthWrite: false }));
        pane.position.set(0, 0, -0.1);
        g.add(pane);
      }
      let prop = null;
      if (f.prop) {
        prop = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(f.prop), transparent: true, depthWrite: false }));
        prop.scale.setScalar(0.85);
        prop.position.set(0, -0.48, 0.2);
        prop.renderOrder = 2;
        g.add(prop);
      }
      fireViews.push({ f, g, glow, fl, pane, prop, ph: Math.random() * 6, smokeT: 0, outT: -1, hitT: 9 });
    }
    for (const k of m.kittens) {
      const src = level.kittens[k.i];
      const v = kitten(k.coat);
      v.g.position.set(k.x, k.y, zOf('kitten', src));
      v.home = v.g.position.clone();
      v.k = k;
      v.state = 'wait';
      scene.add(v.g);
      kittenViews.push(v);
    }
  }

  // a blocky kitten sitting up, facing the camera
  const COATS = { ginger: ['#f39c4a', '#d9772b', '#ffe0c0'], grey: ['#9aa3ad', '#7d8691', '#e8ecf0'], black: ['#34343e', '#22222a', '#f4f4f4'] };
  let meowTex = null;
  function meowTexture() {
    if (meowTex) return meowTex;
    const [c, g] = G.makeCanvas(256, 128);
    meowTex = G.toTexture(c);
    meowTex.keep = true;
    meowTex.canvas = [c, g];
    drawMeow();
    return meowTex;
  }
  function drawMeow() {
    const [c, g] = meowTex.canvas;
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = '#ffffff';
    G.roundRect(g, 8, 8, 240, 86, 40);
    g.fill();
    g.beginPath(); g.moveTo(100, 90); g.lineTo(128, 124); g.lineTo(140, 90); g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#14121f';
    G.roundRect(g, 8, 8, 240, 86, 40);
    g.stroke();
    g.fillStyle = '#ff3d7f';
    g.font = `46px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(Kit.lang.t('HELP! MEOW!'), 128, 54, 220);
    meowTex.needsUpdate = true;
  }
  function relang() { if (meowTex) drawMeow(); }
  function kitten(coat) {
    const [fur, dark, light] = COATS[coat] || COATS.ginger;
    const g = new T.Group(), body = new T.Group();
    g.add(body);
    const fm = G.std(fur, { roughness: 0.8 }), dm = G.std(dark), lm = G.std(light), black = G.std('#14121f'), white = G.std('#ffffff'), pink = G.std('#ff8fab');
    const box = (w, h, d, m, x, y, z, p) => G.mesh(new T.BoxGeometry(w, h, d), m, x, y, z, p || body, false);
    box(0.38, 0.4, 0.32, fm, 0, 0.2, 0);
    box(0.22, 0.26, 0.04, lm, 0, 0.2, 0.17);
    for (const s of [-1, 1]) box(0.1, 0.1, 0.14, lm, s * 0.1, 0.05, 0.18);
    if (coat === 'ginger') for (const y of [0.12, 0.26]) box(0.4, 0.04, 0.3, dm, 0, y, -0.01);
    const head = new T.Group();
    head.position.set(0, 0.55, 0.02);
    body.add(head);
    box(0.4, 0.32, 0.32, fm, 0, 0, 0, head);
    for (const s of [-1, 1]) {
      const ear = box(0.13, 0.13, 0.08, fm, s * 0.13, 0.17, 0, head);
      ear.rotation.z = Math.PI / 4;
      box(0.07, 0.07, 0.02, pink, s * 0.13, 0.17, 0.045, head).rotation.z = Math.PI / 4;
      box(0.08, 0.1, 0.02, coat === 'black' ? G.std('#c8f560') : black, s * 0.09, 0.03, 0.165, head);
      box(0.03, 0.03, 0.02, white, s * 0.08, 0.06, 0.175, head);
      box(0.14, 0.015, 0.01, white, s * 0.2, -0.06, 0.17, head);
    }
    box(0.18, 0.1, 0.04, lm, 0, -0.08, 0.16, head);
    box(0.06, 0.04, 0.02, pink, 0, -0.04, 0.18, head);
    const tail = new T.Group();
    tail.position.set(0.16, 0.08, -0.12);
    body.add(tail);
    box(0.06, 0.4, 0.06, fm, 0, 0.2, 0, tail);
    box(0.06, 0.08, 0.06, coat === 'black' ? dm : dark, 0, 0.42, 0, tail);
    const bubble = new T.Sprite(new T.SpriteMaterial({ map: meowTexture(), transparent: true, depthWrite: false, depthTest: false }));
    bubble.scale.set(1.3, 0.65, 1);
    bubble.position.set(0, 1.25, 0);
    bubble.renderOrder = 6;
    bubble.visible = false;
    g.add(bubble);
    g.scale.setScalar(1.35);
    return { g, body, head, tail, bubble, ph: Math.random() * 6, meowT: 1 + Math.random() * 3, t: 0 };
  }

  // ---------------------------------------------------------------- particles: water, splashes, smoke, steam, icons
  const NW = 900, NS = 500;
  function pointsPool(n, color, size) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ color, size, map: G.dotTexture(), transparent: true, depthWrite: false, sizeAttenuation: true }));
    pts.frustumCulled = false;
    scene.add(pts);
    return { pts, n, pos: geo.attributes.position, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), next: 0 };
  }
  function buildParticles() {
    water = pointsPool(NW, '#2f9bff', 0.62);
    water.pts.material.opacity = 0.95;
    splash = pointsPool(NS, '#ffffff', 0.26);
    const soft = softTex();
    for (let i = 0; i < 90; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: soft, transparent: true, depthWrite: false, opacity: 0 }));
      sp.visible = false;
      scene.add(sp);
      puffs.push({ sp, life: 0, max: 1, vel: new T.Vector3(), grow: 1 });
    }
    for (let i = 0; i < 40; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture('💖'), transparent: true, depthWrite: false, depthTest: false }));
      sp.visible = false;
      sp.renderOrder = 7;
      scene.add(sp);
      icons.push({ sp, life: 0, max: 1, vel: new T.Vector3(), emoji: '💖' });
    }
  }
  const GRAV = 9;
  function shoot(pool, from, to, tf, jitter) {
    const i = pool.next;
    pool.next = (pool.next + 1) % pool.n;
    pool.pos.setXYZ(i, from.x, from.y, from.z);
    const tx = to.x + (Math.random() - 0.5) * jitter, ty = to.y + (Math.random() - 0.5) * jitter, tz = to.z;
    pool.vel[i * 3] = (tx - from.x) / tf;
    pool.vel[i * 3 + 1] = (ty - from.y) / tf + 0.5 * GRAV * tf;
    pool.vel[i * 3 + 2] = (tz - from.z) / tf;
    pool.life[i] = tf;
    pool.max[i] = tf;
  }
  // water from a nozzle to a point on a building's front (rate: drops a second)
  const acc = new Map();
  function spray(key, from, to, dt, big) {
    const rate = big ? 260 : 170;
    let a = (acc.get(key) || 0) + rate * dt;
    const tf = big ? 0.75 : 0.38;
    while (a >= 1) { a -= 1; shoot(water, from, to, tf * (0.9 + Math.random() * 0.2), big ? 0.9 : 0.45); }
    acc.set(key, a);
  }
  function splashAt(p, n, spread) {
    for (let j = 0; j < n; j++) {
      const i = splash.next;
      splash.next = (splash.next + 1) % splash.n;
      splash.pos.setXYZ(i, p.x, p.y, p.z);
      splash.vel[i * 3] = (Math.random() - 0.5) * spread;
      splash.vel[i * 3 + 1] = Math.random() * spread * 0.8;
      splash.vel[i * 3 + 2] = Math.random() * spread * 0.6;
      splash.life[i] = splash.max[i] = 0.35 + Math.random() * 0.25;
    }
  }
  function puff(p, kind, size) {
    const q = puffs.find((x) => x.life <= 0) || puffs[Math.floor(Math.random() * puffs.length)];
    q.sp.position.copy(p);
    q.sp.visible = true;
    q.kind = kind;
    q.max = q.life = kind === 'smoke' ? 2.2 : 0.9;
    q.size = size || 1;
    q.vel.set((Math.random() - 0.5) * 0.6, kind === 'smoke' ? 1.4 : 1.8, kind === 'smoke' ? 0.15 : 0.6);
    q.sp.material.color.set(kind === 'smoke' ? (night ? '#6f7088' : '#8a8a92') : '#ffffff');
    q.sp.material.opacity = 0;
  }
  function icon(p, emoji, n, speed) {
    for (let j = 0; j < (n || 1); j++) {
      const q = icons.find((x) => x.life <= 0) || icons[0];
      if (q.emoji !== emoji) { q.sp.material.map = G.emojiTexture(emoji); q.emoji = emoji; }
      q.sp.position.copy(p);
      q.sp.visible = true;
      q.max = q.life = 1.1 + Math.random() * 0.4;
      const s = speed || 2.5;
      q.vel.set((Math.random() - 0.5) * s, s * (0.6 + Math.random() * 0.6), (Math.random() - 0.2) * s * 0.4);
    }
  }
  function steam(p, n) { for (let i = 0; i < n; i++) puff(p.clone().add(new T.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.6, 0.3)), 'steam', 1 + Math.random()); }

  function tickPool(pool, dt, grav, onDie) {
    const pos = pool.pos.array;
    for (let i = 0; i < pool.n; i++) {
      if (pool.life[i] <= 0) continue;
      pool.life[i] -= dt;
      pool.vel[i * 3 + 1] -= grav * dt;
      pos[i * 3] += pool.vel[i * 3] * dt;
      pos[i * 3 + 1] += pool.vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += pool.vel[i * 3 + 2] * dt;
      if (pool.life[i] <= 0) {
        if (onDie) onDie(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        pos[i * 3 + 1] = -999;
      }
    }
    pool.pos.needsUpdate = true;
  }

  // ---------------------------------------------------------------- every frame
  const tmp = new T.Vector3();
  function update(dt, m) {
    clock += dt;
    tickPool(water, dt, GRAV, (x, y, z) => { if (Math.random() < 0.45) splashAt(tmp.set(x, y, z), 2, 3); });
    tickPool(splash, dt, GRAV * 1.2);
    for (const q of puffs) {
      if (q.life <= 0) continue;
      q.life -= dt;
      q.sp.position.addScaledVector(q.vel, dt);
      const a = 1 - q.life / q.max;
      const s = q.size * (q.kind === 'smoke' ? 0.9 + a * 2.2 : 0.6 + a * 1.4);
      q.sp.scale.setScalar(s);
      q.sp.material.opacity = (q.kind === 'smoke' ? 0.55 : 0.8) * Math.min(1, a * 5) * (1 - a);
      if (q.life <= 0) q.sp.visible = false;
    }
    for (const q of icons) {
      if (q.life <= 0) continue;
      q.life -= dt;
      q.vel.y -= 3 * dt;
      q.sp.position.addScaledVector(q.vel, dt);
      const a = 1 - q.life / q.max;
      q.sp.scale.setScalar(0.7 * Math.min(1, a * 6) * (a > 0.75 ? (1 - a) * 4 : 1));
      if (q.life <= 0) q.sp.visible = false;
    }
    if (!m) return;
    // fires: their size follows how much fire is left; they flicker, smoke and puff steam when hit
    for (const v of fireViews) {
      const f = v.f;
      v.ph += dt;
      v.hitT += dt;
      if (f.out) {
        if (v.outT < 0) v.outT = 0;
        v.outT += dt;
        const k = Math.max(0, 1 - v.outT * 3);
        v.fl.visible = k > 0.01;
        v.fl.scale.set(1.6 * k, 2.1 * k, 1);
        v.glow.material.opacity = 0.8 * k;
        if (v.pane) v.pane.material.opacity = 0.85 * k;
        if (v.prop) v.prop.position.y = -0.48 + Math.sin(clock * 3 + v.ph) * 0.02;
        continue;
      }
      const big = f.big ? 1.9 : 1;
      const s = big * (0.35 + 0.65 * Math.max(0, f.hp) / f.max);
      const fl = 1 + Math.sin(v.ph * 9) * 0.05 + Math.sin(v.ph * 13.3) * 0.04;
      v.fl.scale.set(1.6 * s * (Math.sin(v.ph * 2.1) > 0.92 ? -1 : 1), 2.1 * s * fl, 1);
      v.fl.position.y = -0.75;
      v.fl.material.rotation = Math.sin(v.ph * 2.7) * 0.06;
      const hit = m.trucks.some((tr) => tr.sprayHit === f.i) || m.jets.some((j) => j.fire === f.i && j.t > 0.5);
      if (hit) v.hitT = 0;
      const want = v.hitT < 0.25 ? (f.big ? 'bigOops' : 'oops') : f.big ? 'big' : 'grin';
      if (v.fl.material.map !== flame(want)) v.fl.material.map = flame(want);
      v.glow.scale.setScalar(3.2 * s * fl);
      v.glow.position.y = -0.1 + 0.4 * s;
      v.glow.material.opacity = 0.75;
      if (v.pane) v.pane.material.opacity = 0.35 + 0.5 * (f.hp / f.max) + Math.sin(v.ph * 11) * 0.06;
      v.smokeT -= dt;
      if (v.smokeT <= 0) {
        v.smokeT = hit ? 0.09 : 0.32 - (f.big ? 0.1 : 0);
        tmp.copy(v.g.position);
        tmp.y += 1.2 * s;
        tmp.z += 0.3;
        puff(tmp, hit ? 'steam' : 'smoke', (f.big ? 1.6 : 0.9) * (hit ? 0.8 : 1));
      }
    }
    // kittens: tail swish, head tilt, now and then HELP! MEOW!
    for (const v of kittenViews) {
      v.ph += dt;
      v.tail.rotation.z = Math.sin(v.ph * 3) * 0.5;
      v.head.rotation.z = Math.sin(v.ph * 1.3) * 0.12;
      if (v.state === 'wait') {
        v.meowT -= dt;
        if (v.meowT <= 0) { v.bubble.visible = !v.bubble.visible; v.meowT = v.bubble.visible ? 1.6 : 2.5 + Math.random() * 3; }
        v.body.position.y = Math.abs(Math.sin(v.ph * 2)) * (v.bubble.visible ? 0.06 : 0.01);
      } else v.bubble.visible = false;
    }
  }

  // a kitten's ride: hops into the basket, slides down the ladder, sits on top of the truck
  function kittenRide(i, t, slot, dt) {
    const v = kittenViews[i];
    if (!v) return;
    v.t += dt;
    const F = FIRE.truck;
    if (v.state === 'wait') { v.state = 'hop'; v.t = 0; v.from = v.g.position.clone(); icon(v.g.position.clone().add(tmp.set(0, 1, 0.4)), '💖', 6); }
    if (v.state === 'hop') {
      const to = F.basketWorld(t, new T.Vector3());
      to.y += 0.15;
      const e = Math.min(1, v.t / 0.55);
      v.g.position.lerpVectors(v.from, to, e);
      v.g.position.y += Math.sin(e * Math.PI) * 1.2;
      if (e >= 1) { v.state = 'ride'; v.t = 0; }
    } else if (v.state === 'ride') {
      F.basketWorld(t, v.g.position);
      v.g.position.y += 0.15;
      if (v.t > 0.5) { v.state = 'slide'; v.t = 0; }
    } else if (v.state === 'slide') {
      // wheee down the ladder
      const e = Math.min(1, v.t / 1.1);
      F.ladderPoint(t, 1 - e * e, v.g.position);
      v.g.position.z += 0.2;
      v.body.rotation.z = -0.5;
      if (e >= 1) { v.state = 'hopDown'; v.t = 0; v.from = v.g.position.clone(); v.body.rotation.z = 0; }
    } else if (v.state === 'hopDown') {
      const to = F.kittenSlot(t, slot, new T.Vector3());
      const e = Math.min(1, v.t / 0.4);
      v.g.position.lerpVectors(v.from, to, e);
      v.g.position.y += Math.sin(e * Math.PI) * 0.6;
      if (e >= 1) { v.state = 'sit'; v.t = 0; }
    } else if (v.state === 'sit') {
      F.kittenSlot(t, slot, v.g.position);
    }
  }
  function kittenState(i) { return kittenViews[i] ? kittenViews[i].state : null; }
  function kittenPos(i) { return kittenViews[i] ? kittenViews[i].g.position : null; }
  function fireView(i) { return fireViews[i]; }

  function render(views) {
    const W = renderer.domElement.clientWidth, Hh = renderer.domElement.clientHeight;
    renderer.setSize(W, Hh, false);
    for (const v of views) {
      const x = Math.round(v.x * W), y = Math.round(v.y * Hh), w = Math.round(v.w * W), h = Math.round(v.h * Hh);
      renderer.setViewport(x, Hh - y - h, w, h);
      renderer.setScissor(x, Hh - y - h, w, h);
      if (!(v.cam.view && v.cam.view.enabled)) { v.cam.aspect = w / Math.max(1, h); v.cam.updateProjectionMatrix(); }
      far.position.set(v.cam.position.x, 0, v.cam.position.z);
      renderer.render(scene, v.cam);
    }
  }

  FIRE.world = {
    init, setLevel, setMission, update, render, spray, splashAt, steam, puff, icon, kittenRide, kittenState, kittenPos, fireView,
    scene: () => scene, renderer: () => renderer, level: () => level, hydrant: () => hydrantGroup,
  };
})();
