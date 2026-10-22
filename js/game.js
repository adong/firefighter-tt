/* TT Firefighters: the game. Home screen, the count-in, firefighting (1 or 2 trucks, maybe Foxy and Froggy's too),
   the brother's visit with his big hose, the end of the street, the winner's celebration, the results and the
   safety cards. The rules live in js/rules.js, the 3D in js/world.js and js/truck.js. For tests, window.game:
     game.start({ level, mode, who, lv }) / game.step(seconds, quick) / game.hold(on) / game.info() / game.check()
     game.buddy() / game.five() / game.pause(bool) / game.home() / game.next() / game.autopilot('good' | 'kid' | null)
     game.book(open) */
(function () {
  'use strict';
  const T = THREE;
  const FIRE = window.FIRE, R = FIRE.rules, W = FIRE.world, K = FIRE.truck, Lv = FIRE.levels, P = R.PHYS;
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const STORE = 'firefighterTT.v1';
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const HUMANS = ['teddy', 'tommy'];
  const LANES = [5.2, 8.6, 12];
  const TILES = { maple: '#ffb38a', pizza: '#ffd166', toy: '#ff8fa3', park: '#9be37a', tower: '#90e0ef', night: '#8e7dbe' };
  const PAR = { maple: 50, pizza: 70, toy: 90, park: 90, tower: 110, night: 130 }; // seconds: finish sooner for a time bonus
  const KEYS = {
    one: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], spray: ['Space', 'Enter', 'NumpadEnter', 'KeyF'] },
    two: [
      { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], spray: ['Space', 'KeyF'] },
      { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], spray: ['Enter', 'NumpadEnter', 'ShiftRight'] },
    ],
  };

  let save = { level: 'maple', mode: 'solo', who: 'teddy', lv: { teddy: 'easy', tommy: 'easy' }, best: {}, cards: {}, wins: { teddy: 0, tommy: 0 } };
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s) save = Object.assign(save, s, { lv: Object.assign(save.lv, s.lv), best: s.best || {}, cards: s.cards || {}, wins: Object.assign(save.wins, s.wins) });
  } catch (e) { /* storage blocked */ }
  if (!Lv.ids.includes(save.level)) save.level = 'maple';
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }

  let state = 'loading', paused = false, held = false, bookOpen = false;
  let L = Lv.get(save.level);
  let m = null, players = [], views = [], portraits = {};
  let cam = null, camViews = [];
  let seq = null, buddy = null, treat = null, ball = null;
  let fiveT = 0, fiveCool = 0, finishT = 0, celebrate = null, results = null, demoWait = 0, lastCount = null;
  let rides = [], waveT = [0, 0, 0], sprayAcc = 0, jetAcc = 0, lastNow = 0, hudKey = '';
  const camS = { x: 0, y: 6, D: 30, snap: true };
  const keys = new Set();
  const padHeld = [{}, {}];
  let pads = [];

  // ---------------------------------------------------------------- start up
  function init() {
    W.init($('game'));
    portraits = Kit.portraits(HUMANS.map((id) => Kit.roster.get(id)), { size: 128 });
    cam = new T.PerspectiveCamera(46, 1, 0.1, 1500);
    const words = window.FIRE_TITLE.split(' ');
    $('logo').querySelector('small').textContent = words.slice(0, -1).join(' ');
    $('logo').querySelector('big').textContent = words[words.length - 1];
    homeUI();
    hudUI();
    goHome();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', (e) => keys.delete(e.code));
    window.addEventListener('blur', () => keys.clear());
    window.addEventListener('resize', layout);
    window.addEventListener('pointerdown', () => Kit.sound.init(), { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.autoPause && isPlaying()) setPause(true);
    });
    Kit.sound.onMute(muteIcon);
    muteIcon(Kit.sound.isMuted());
    Kit.lang.onChange(() => { hudKey = ''; refreshHome(); });
    setTimeout(() => $('loading').classList.add('hidden'), 150);
    requestAnimationFrame((t) => { lastNow = t; requestAnimationFrame(loop); });
  }
  function isPlaying() { return state === 'count' || state === 'play' || state === 'finish'; }
  function muteIcon(mu) { $('muteBtn').textContent = mu ? '🔇' : '🔊'; }

  // ---------------------------------------------------------------- home
  function homeUI() {
    const box = $('levels');
    for (const l of Lv.list) {
      const b = document.createElement('button');
      b.className = 'card';
      b.dataset.level = l.id;
      b.style.setProperty('--tile', TILES[l.id]);
      b.setAttribute('role', 'radio');
      b.innerHTML = `<span class="emo">${l.emoji}</span><span class="nm">${l.name}</span><span class="best"></span><span class="got"></span>`;
      b.addEventListener('click', () => pickLevel(l.id));
      box.appendChild(b);
    }
    for (const b of $('modes').children) b.addEventListener('click', () => pickMode(b.dataset.mode));
    for (const b of $('who').children) {
      b.addEventListener('click', () => pickWho(b.dataset.who));
      b.querySelectorAll('img').forEach((img, n) => { img.src = portraits[b.dataset.who === 'both' ? HUMANS[n] : b.dataset.who]; });
    }
    $('playBtn').addEventListener('click', () => startMission());
    $('bookBtn').addEventListener('click', () => openBook(true));
    $('bookClose').addEventListener('click', () => openBook(false));
    $('book').addEventListener('click', (e) => { if (e.target === $('book')) openBook(false); });
  }
  function pickLevel(id) {
    if (typeof id === 'number') { const i = Lv.ids.indexOf(save.level); id = Lv.ids[(i + id + Lv.ids.length) % Lv.ids.length]; }
    save.level = id;
    persist();
    Kit.sound.click();
    refreshHome();
    newDemo();
  }
  function pickMode(md) {
    save.mode = md === 'toggle' ? (save.mode === 'race' ? 'solo' : 'race') : md;
    persist();
    Kit.sound.click();
    refreshHome();
    newDemo();
  }
  function pickWho(w) {
    save.who = w;
    persist();
    Kit.sound.click();
    refreshHome();
    newDemo();
  }
  function setLevelOf(id, lv) {
    save.lv[id] = lv === 'toggle' ? (save.lv[id] === 'easy' ? 'normal' : 'easy') : lv;
    persist();
    Kit.sound.click();
    refreshHome();
  }
  function humans() { return save.who === 'both' ? HUMANS.slice() : [save.who]; }
  function lvKey() { return humans().map((id) => save.lv[id]).join('+'); }
  function bestKey(lid) { return `${lid}/${save.who}/${save.mode}/${lvKey()}`; }
  function refreshHome() {
    for (const b of $('levels').children) {
      const on = b.dataset.level === save.level;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
      const best = save.best[bestKey(b.dataset.level)];
      b.querySelector('.best').textContent = best ? `⭐ ${best.score}` : '';
      b.querySelector('.got').textContent = save.cards[b.dataset.level] ? '🃏' : '';
    }
    for (const b of $('modes').children) b.classList.toggle('on', b.dataset.mode === save.mode);
    for (const b of $('who').children) {
      b.classList.toggle('on', b.dataset.who === save.who);
      const cups = b.querySelector('.cups');
      if (cups) cups.textContent = save.wins[b.dataset.who] ? `🏆${save.wins[b.dataset.who]}` : '';
    }
    const lv = $('lvls');
    lv.innerHTML = '';
    for (const id of humans()) {
      const row = document.createElement('div');
      row.className = 'lvl';
      row.innerHTML = `<img alt="" src="${portraits[id]}"><button data-lv="easy" aria-label="Easy"><span>🐣</span>EASY</button><button data-lv="normal" aria-label="Normal"><span>🔥</span>NORMAL</button>`;
      for (const b of row.querySelectorAll('button')) {
        b.classList.toggle('on', save.lv[id] === b.dataset.lv);
        b.addEventListener('click', () => setLevelOf(id, b.dataset.lv));
      }
      lv.appendChild(row);
    }
    $('bookCount').textContent = `${Lv.ids.filter((id) => save.cards[id]).length}/${Lv.ids.length}`;
    if (bookOpen) fillBook();
  }
  function goHome() {
    state = 'home';
    paused = false;
    clearBuddy();
    for (const id of ['hud', 'pads', 'buddyBtn', 'fiveBtn', 'pause', 'results']) $(id).classList.add('hidden');
    $('home').classList.remove('hidden');
    refreshHome();
    newDemo();
    Kit.sound.music('title');
  }
  // behind the menu, the chosen firefighter does the chosen street, again and again
  function newDemo() {
    if (state !== 'home') return;
    L = Lv.get(save.level);
    buildMission(true);
  }

  // ---------------------------------------------------------------- the card book
  function cardHTML(card, l, label) {
    return `<span class="te">${card.emoji}</span><span><span class="tl">${label}</span><div class="tt">${card.title}</div><div class="tx">${card.text}</div></span>`;
  }
  function fillBook() {
    const g = $('bookGrid');
    g.innerHTML = '';
    for (const l of Lv.list) {
      const card = Lv.CARDS[l.id], got = !!save.cards[l.id];
      const d = document.createElement('div');
      d.className = 'tip' + (got ? '' : ' locked');
      if (got) d.innerHTML = cardHTML(card, l, `${l.emoji} ${l.name}`);
      else d.innerHTML = `<span class="te">❓</span><span><span class="tl">${l.emoji} ${l.name}</span><div class="tx">Finish ${l.name} to get this card.</div></span>`;
      g.appendChild(d);
    }
  }
  function openBook(on) {
    bookOpen = !!on;
    if (bookOpen) fillBook();
    $('book').classList.toggle('hidden', !bookOpen);
    Kit.sound.click();
  }

  // ---------------------------------------------------------------- a mission (one street)
  function clearViews() {
    for (const v of views) W.scene().remove(v.outer);
    views = [];
    rides = [];
  }
  function buildMission(demo, o) {
    o = o || {};
    clearBuddy();
    clearViews();
    W.setLevel(L);
    const hs = humans();
    const raceLv = hs.some((id) => save.lv[id] === 'easy') ? 'easy' : 'normal';
    const trucks = hs.map((id, i) => ({ id, lv: demo ? 'easy' : save.lv[id], human: true, pilot: demo ? R.PILOTS.cpu(R.rng(11 + i), 'normal') : null }));
    if (save.mode === 'race') trucks.push({ id: 'foxy', lv: demo ? 'easy' : raceLv, human: false, pilot: R.PILOTS.cpu(R.rng(Date.now() % 1000), demo ? 'normal' : raceLv) });
    m = R.mission(L, { trucks, seed: 1 + (Date.now() % 997), time: demo ? 0 : -3 });
    players = hs;
    W.setMission(m);
    views = m.trucks.map((tr) => {
      const v = K.make(tr.id, { tag: m.trucks.length > 1 });
      W.scene().add(v.outer);
      K.place(v, tr, 0, LANES[tr.lane]);
      v.kittens = [];
      return v;
    });
    waveT = [0, 0, 0];
    celebrate = null;
    results = null;
    demoWait = 0;
    camS.snap = true;
    hudKey = '';
  }
  function startMission(o) {
    o = o || {};
    if (o.level && Lv.ids.includes(o.level)) save.level = o.level;
    if (o.mode) save.mode = o.mode;
    if (o.who) save.who = o.who;
    if (o.lv) Object.assign(save.lv, o.lv);
    persist();
    L = Lv.get(save.level);
    buildMission(false);
    state = 'count';
    paused = false;
    lastCount = null;
    keys.clear();
    for (const id of ['home', 'pause', 'results']) $(id).classList.add('hidden');
    openBook(false);
    $('hud').classList.remove('hidden');
    $('pads').classList.remove('hidden');
    const two = players.length > 1;
    $('buddyBtn').classList.toggle('hidden', two);
    $('fiveBtn').classList.toggle('hidden', !two);
    if (!two) $('buddyFace').src = portraits[Kit.roster.buddyFor(players[0])];
    buildBoard();
    buildPads();
    layout();
    Kit.sound.music('play');
    siren(2);
  }
  function nextLevel() {
    const i = Lv.ids.indexOf(save.level);
    startMission({ level: Lv.ids[(i + 1) % Lv.ids.length] });
  }
  function setPause(p) {
    if (!isPlaying()) return;
    paused = !!p;
    $('pause').classList.toggle('hidden', !paused);
    Kit.sound.music(paused ? 'pause' : 'play');
    keys.clear();
  }

  // ---------------------------------------------------------------- input
  function heldKey(codes) { return codes.some((c) => keys.has(c)); }
  function keySet(pl) { return players.length > 1 ? KEYS.two[pl] : KEYS.one; }
  function readInput() {
    players.forEach((id, pl) => {
      const tr = m.trucks[pl];
      if (!tr || tr.pilotFn) return;
      const ks = keySet(pl), ph = padHeld[pl];
      let dx = 0, dy = 0;
      if (heldKey(ks.left) || ph.left) dx -= 1;
      if (heldKey(ks.right) || ph.right) dx += 1;
      if (heldKey(ks.up) || ph.up) dy += 1;
      if (heldKey(ks.down) || ph.down) dy -= 1;
      tr.input = { dx, dy, spray: heldKey(ks.spray) || !!ph.spray };
    });
  }
  function onKey(e) {
    const k = e.code;
    if (k === 'KeyM') { Kit.sound.init(); Kit.sound.toggleMute(); e.preventDefault(); return; }
    if (state !== 'loading') Kit.sound.init();
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
    if (bookOpen) { if (['Escape', 'Enter', 'Space', 'KeyC', 'NumpadEnter'].includes(k)) openBook(false); return; }
    if (state === 'home') {
      if (e.repeat) return;
      if (k === 'ArrowLeft' || k === 'KeyA') pickLevel(-1);
      else if (k === 'ArrowRight' || k === 'KeyD') pickLevel(1);
      else if (k === 'ArrowUp' || k === 'ArrowDown') setLevelOf(save.who === 'both' ? 'tommy' : save.who, k === 'ArrowUp' ? 'easy' : 'normal');
      else if (k === 'KeyW' || k === 'KeyS') setLevelOf(save.who === 'both' ? 'teddy' : save.who, k === 'KeyW' ? 'easy' : 'normal');
      else if (k === 'Digit1') pickWho('teddy');
      else if (k === 'Digit2') pickWho('tommy');
      else if (k === 'Digit3') pickWho('both');
      else if (k === 'KeyR') pickMode('toggle');
      else if (k === 'KeyC') openBook(true);
      else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') startMission();
      return;
    }
    if (state === 'results') {
      if (e.repeat) return;
      if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') startMission();
      else if (k === 'KeyN') nextLevel();
      else if (k === 'Escape' || k === 'KeyH') goHome();
      return;
    }
    if (isPlaying()) {
      if (k === 'KeyP' || k === 'Escape') { if (!e.repeat) setPause(!paused); return; }
      if (paused) { if (!e.repeat && (k === 'Enter' || k === 'Space')) setPause(false); return; }
      if (k === 'KeyT' && !e.repeat) { callBuddy(); return; }
      keys.add(k);
    }
  }

  // ---------------------------------------------------------------- the brother's visit
  function callBuddy() {
    if (!m || paused || state !== 'play') return;
    if (players.length > 1) return highFive();
    const id = Kit.roster.buddyFor(players[0]);
    const entry = Kit.roster.get(id);
    if (!buddy || buddy.id !== id) {
      if (buddy) W.scene().remove(buddy.outer);
      buddy = K.walker(id, K.RIDER * entry.buddyScale * 1.25);
      buddy.out = true;
    }
    if (buddy.out) {
      W.scene().add(buddy.outer);
      buddy.out = false;
      buddy.pop = 0;
      buddyPos(buddy.outer.position);
      W.steam(buddy.outer.position.clone(), 8);
    }
    buddy.leaving = false; // called again while he was waving goodbye: he stays
    buddy.leave = 0;
    const [emoji, name] = TREATS[Math.floor(Math.random() * TREATS.length)];
    seq = { t: 0, entry, emoji, name, tossed: false, helped: false, ball: false, jet: null };
    $('buddyBtn').classList.add('here');
    Kit.sound.tone({ f: 520, to: 980, type: 'triangle', dur: 0.18, vol: 0.25 });
  }
  // he hops up on top of your truck, at the side nearest you
  function buddyPos(out) {
    const v = views[0];
    v.outer.updateMatrixWorld(true);
    return out.set(0.15, 2.45, 0.95).applyMatrix4(v.outer.matrixWorld);
  }
  function clearBuddy() {
    if (buddy && !buddy.out) { W.scene().remove(buddy.outer); buddy.out = true; }
    seq = null;
    if (treat) { W.scene().remove(treat.sp); treat = null; }
    if (ball) { W.scene().remove(ball.sp); ball = null; }
    $('buddyBtn').classList.remove('here');
  }
  function highFive() {
    if (fiveCool > 0) return;
    fiveCool = 1.2;
    fiveT = 1.1;
    toast('✋ HIGH FIVE!', 'good', 0);
    toast('✋ HIGH FIVE!', 'good', 1);
    toast('💧 TANKS FULL!', 'water', 0);
    Kit.sound.tone({ f: 660, to: 1320, type: 'square', dur: 0.12, vol: 0.2 });
    Kit.sound.coin(3);
    m.five();
    for (const v of views.slice(0, players.length)) W.icon(K.basketWorld(v, new T.Vector3()).add(tv.set(0, 1.6, 0.5)), '✨', 5);
  }

  const tv = new T.Vector3(), tv2 = new T.Vector3();
  function updateBuddy(dt) {
    if (!buddy || buddy.out || !m) return;
    buddy.pop = Math.min(1, (buddy.pop || 0) + dt * 4);
    const sc = buddy.scale * (buddy.leaving ? Math.max(0.01, 1 - buddy.leave * 3) : 1 - Math.pow(1 - buddy.pop, 3));
    buddy.outer.scale.setScalar(Math.max(0.01, sc));
    buddyPos(buddy.outer.position);
    buddy.ph += dt * 5;
    buddy.noz.visible = false;
    if (!seq) {
      // waving goodbye, then gone in a puff
      buddy.leave = (buddy.leave || 0) + dt;
      K.act(buddy, 'wave', dt);
      if (buddy.leave > 0.35) { W.steam(buddy.outer.position.clone(), 8); W.scene().remove(buddy.outer); buddy.out = true; buddy.leaving = false; buddy.leave = 0; }
      return;
    }
    seq.t += dt;
    const t = seq.t, me = seq.entry.id;
    if (t < 1.9) {
      // his own move, facing you: Teddy boxes then shoots a 🏀, Tommy does his Y
      const mode = me === 'teddy' ? (t < 1.2 ? 'boxing' : 'jumpshot') : 'peace';
      K.act(buddy, mode, dt);
      if (me === 'teddy' && t > 1.2) buddy.outer.position.y += Math.sin(Math.min(1, (t - 1.2) / 0.6) * Math.PI) * 0.4;
      if (me === 'teddy' && !seq.ball && t > 1.45) { seq.ball = true; shootBall(buddy.outer.position.clone().add(tv.set(0, 1.4, 0))); }
    }
    if (!seq.tossed && t > 0.9) {
      seq.tossed = true;
      const s = seq;
      throwTreat(s.emoji, buddy.outer.position.clone().add(tv.set(0, 1, 0)), () => {
        toast(`${s.emoji} ${s.name} FROM ${s.entry.name}!`, 'treat', 0);
        Kit.sound.coin(2);
        waveT[0] = 0.9;
      });
    }
    if (!seq.helped && t > 1.9) {
      seq.helped = true;
      seq.jet = m.buddy(0);
      toast(seq.jet.fire >= 0 ? `${seq.entry.name} SAYS: I'LL GET THE BIG FIRE!` : `${seq.entry.name} SAYS: WATER RAINBOW!`, 'buddy', 0);
      Kit.sound.powerup();
    }
    if (seq.helped) {
      const j = seq.jet, f = j.fire >= 0 ? m.fires[j.fire] : null;
      const on = j.t >= P.buddy.delay && j.t <= P.buddy.delay + P.buddy.time && (!f || !f.out);
      // he turns to the fire and sprays it with his own big hose
      const to = f ? W.fireView(f.i).g.getWorldPosition(tv2) : tv2.set(buddy.outer.position.x + 4, 11, 3);
      const dx = to.x - buddy.outer.position.x, dz = to.z - buddy.outer.position.z;
      K.act(buddy, 'spray', dt, Math.atan2(-dx, -dz));
      buddy.noz.visible = true;
      if (on && !paused) {
        buddy.outer.updateMatrixWorld(true);
        const from = buddy.noz.getWorldPosition(new T.Vector3());
        W.spray('buddy', from, to, dt, true);
        jetAcc += dt;
        if (jetAcc > 0.2) { jetAcc = 0; Kit.sound.hiss({ f: 1800, to: 1200, filter: 'bandpass', q: 0.6, dur: 0.26, vol: 0.06 }); }
        if (!f && Math.random() < dt * 4) W.icon(to.clone(), '🌈', 1, 1.5);
      }
      const end = P.buddy.delay + P.buddy.time;
      if (j.t > end || (f && f.out && j.t > P.buddy.delay + 0.8)) {
        seq = null;
        buddy.leaving = true;
        buddy.leave = 0;
        $('buddyBtn').classList.remove('here');
      }
    }
  }
  function sprite(emoji, size) {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture(emoji), transparent: true, depthWrite: false }));
    sp.scale.setScalar(size);
    sp.renderOrder = 6;
    W.scene().add(sp);
    return sp;
  }
  function throwTreat(emoji, from, done) {
    if (treat) W.scene().remove(treat.sp);
    treat = { sp: sprite(emoji, 0.9), from: from.clone(), t: 0, done };
  }
  function shootBall(from) {
    if (ball) W.scene().remove(ball.sp);
    ball = { sp: sprite('🏀', 0.7), from: from.clone(), t: 0 };
  }
  function updateProps(dt) {
    if (treat) {
      treat.t += dt / 0.75;
      const to = K.basketWorld(views[0], tv).add(tv2.set(0, 1.3, 0.3));
      const e = Math.min(1, treat.t);
      treat.sp.position.lerpVectors(treat.from, to, e);
      treat.sp.position.y += Math.sin(e * Math.PI) * 2;
      if (treat.t >= 1) {
        W.icon(to.clone(), '✨', 4);
        treat.done();
        W.scene().remove(treat.sp);
        treat = null;
      }
    }
    if (ball) {
      ball.t += dt;
      ball.sp.position.copy(ball.from);
      ball.sp.position.y += ball.t * 7 - ball.t * ball.t * 5;
      ball.sp.position.x += ball.t * 1.6;
      if (ball.t > 1.6) { W.scene().remove(ball.sp); ball = null; }
    }
  }

  // ---------------------------------------------------------------- the loop
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    if (held) return;
    frame(dt);
  }

  function frame(dt, noDraw) {
    if (state === 'loading' || !m) return;
    const d = paused ? 0 : dt;
    if (!paused) {
      if (state === 'home') tickDemo(dt);
      else if (isPlaying()) tickPlay(dt);
      else if (state === 'results') tickResults(dt);
      fiveT = Math.max(0, fiveT - dt);
      fiveCool = Math.max(0, fiveCool - dt);
      for (let i = 0; i < waveT.length; i++) waveT[i] = Math.max(0, waveT[i] - dt);
    }
    placeAll(d);
    W.update(d, m);
    aimCam(d);
    if (noDraw) return;
    W.render(camViews);
    drawFx(d);
  }

  function placeAll(dt) {
    m.trucks.forEach((tr, i) => {
      const v = views[i];
      K.place(v, tr, dt, LANES[tr.lane]);
      let mode = 'idle';
      if (celebrate && celebrate.ids.includes(tr.id)) mode = celebrate.mode(tr.id);
      else if (tr.spraying) mode = 'spray';
      else if (fiveT > 0 && tr.human) mode = 'give';
      else if (waveT[i] > 0) mode = 'wave';
      K.act(v, mode, dt);
      // water from the nozzle: into the fire it's hitting, or onto the wall in front of it
      if (tr.spraying && dt > 0) {
        const from = K.nozzleWorld(v, tv);
        const to = tr.sprayHit >= 0 ? W.fireView(tr.sprayHit).g.getWorldPosition(tv2) : tv2.set(tr.x + P.BX, tr.h + P.NOZ - 0.4, 0.25);
        W.spray(i, from, to, dt, false);
      }
    });
    for (const r of rides) W.kittenRide(r.k, views[r.pl], r.slot, dt);
    updateBuddy(dt);
    updateProps(dt);
  }

  function tickDemo(dt) {
    m.step(dt);
    processEvents(true);
    if (m.done) { demoWait += dt; if (demoWait > 2.5) buildMission(true); }
  }

  function tickPlay(dt) {
    readInput();
    m.step(dt);
    if (state === 'count') countIn();
    processEvents(false);
    // the hiss of the hoses
    if (m.trucks.some((tr) => tr.human && tr.spraying)) {
      sprayAcc += dt;
      if (sprayAcc > 0.16) { sprayAcc = 0; Kit.sound.hiss({ f: 2600, to: 1900, filter: 'bandpass', q: 0.7, dur: 0.22, vol: 0.045 }); }
    }
    if (state === 'finish') {
      finishT += dt;
      if (finishT > 3.4) showResults();
    }
    updateHUD();
  }
  function tickResults() { /* the winner keeps celebrating, the confetti keeps falling */ }

  function countIn() {
    const c = m.time < 0 ? Math.ceil(-m.time) : 0;
    if (c === lastCount) return;
    lastCount = c;
    if (c > 0) {
      bigCount(String(c));
      Kit.sound.tone({ f: 520, type: 'square', dur: 0.15, vol: 0.2 });
    } else {
      bigCount('GO!', true);
      Kit.sound.horn(0.35);
      state = 'play';
    }
  }
  function bigCount(text, go) {
    const el = $('bigCount');
    el.textContent = text;
    el.classList.toggle('go', !!go);
    el.classList.remove('anim');
    void el.offsetWidth;
    el.classList.add('anim');
  }
  function siren(n) {
    for (let i = 0; i < n; i++) {
      Kit.sound.tone({ f: 960, type: 'triangle', dur: 0.32, vol: 0.12, at: i * 0.7 });
      Kit.sound.tone({ f: 720, type: 'triangle', dur: 0.32, vol: 0.12, at: i * 0.7 + 0.35 });
    }
  }

  function processEvents(quiet) {
    for (const ev of m.events) {
      const pl = ev.pl != null ? ev.pl : 0;
      const human = m.trucks[pl] && m.trucks[pl].human;
      const tp = players.length > 1 ? pl : 0;
      switch (ev.type) {
        case 'out': {
          const v = W.fireView(ev.fire);
          W.steam(v.g.getWorldPosition(new T.Vector3()), ev.big ? 18 : 10);
          if (quiet) break;
          if (ev.buddy) toast(`BIG FIRE OUT! +${P.points.big}`, 'good', 0);
          else if (human) toast(ev.big ? `BIG FIRE OUT! +${P.points.big}` : `PSSSH! +${P.points.fire}`, ev.big ? 'good' : 'water', tp);
          else toast(`FOXY GOT ONE!`, 'small', 0);
          Kit.sound.hiss({ f: 3000, to: 300, filter: 'lowpass', dur: 0.8, vol: 0.13 });
          if (ev.big) Kit.sound.powerup(); else Kit.sound.coin(2);
          break;
        }
        case 'kitten': {
          const v = views[pl];
          rides.push({ k: ev.kitten, pl, slot: v.kittens.length });
          v.kittens.push(ev.kitten);
          waveT[pl] = 1.4;
          if (quiet) break;
          toast(human ? `🐱 KITTEN SAVED! +${P.points.kitten}` : '🐱 FOXY SAVED A KITTEN!', human ? 'kitty' : 'small', tp);
          Kit.sound.tone({ f: 620, to: 1050, type: 'triangle', dur: 0.14, vol: 0.18 });
          Kit.sound.tone({ f: 1050, to: 600, type: 'triangle', dur: 0.3, vol: 0.18, at: 0.14 });
          Kit.sound.coin(3);
          break;
        }
        case 'hot':
          if (quiet || !human) break;
          toast('TOO HOT! SPRAY THE FIRE FIRST!', 'oops', tp);
          Kit.sound.bump();
          break;
        case 'empty':
          if (quiet || !human) break;
          toast('NO WATER! DRIVE TO THE HYDRANT!', 'oops', tp);
          Kit.sound.tone({ f: 300, to: 180, type: 'square', dur: 0.25, vol: 0.12 });
          break;
        case 'refill':
          if (quiet || !human) break;
          toast('💧 FILLING UP!', 'water', tp);
          Kit.sound.tone({ f: 400, to: 900, type: 'sine', dur: 0.5, vol: 0.15 });
          W.splashAt(W.hydrant().position.clone().add(tv.set(0, 1, 0.4)), 14, 3);
          break;
        case 'done':
          if (quiet) break;
          finish();
          break;
      }
    }
    m.events.length = 0;
  }

  // ---------------------------------------------------------------- the end of the street: celebration, results
  function finish() {
    state = 'finish';
    finishT = 0;
    clearBuddy();
    const order = m.results();
    const humansDone = order.filter((r) => r.human);
    let ids;
    if (save.mode === 'race') ids = [order[0].id];
    else ids = humansDone.map((r) => r.id);
    // the winner's own move: Teddy's boxing combo then his 🏀 jump shot, Tommy's Y; Foxy waves
    celebrate = {
      ids, t: 0,
      mode(id) {
        if (id === 'teddy') return finishT < 1.4 || (state === 'results' && Math.floor(performance.now() / 1600) % 2 === 0) ? 'boxing' : 'jumpshot';
        if (id === 'tommy') return 'peace';
        return 'wave';
      },
    };
    const hasTeddy = ids.includes('teddy');
    if (hasTeddy) setTimeout(() => { if (state === 'finish' || state === 'results') { const v = views[m.trucks.findIndex((t) => t.id === 'teddy')]; if (v) shootBall(K.basketWorld(v, new T.Vector3()).add(tv.set(0, 2.2, 0.3))); } }, 1500);
    toast('ALL SAFE!', 'good', 0);
    if (players.length > 1) toast('ALL SAFE!', 'good', 1);
    confetti(180);
    [523, 659, 784, 1047].forEach((f, k) => Kit.sound.tone({ f, type: 'triangle', dur: 0.22, vol: 0.22, at: k * 0.13 }));
    siren(1);
  }
  function fmtTime(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  function showResults() {
    state = 'results';
    const order = m.results();
    const time = m.doneAt || m.time;
    const bonus = Math.max(0, Math.round((PAR[L.id] - time) * 5));
    const team = order.filter((r) => r.human).reduce((a, r) => a + r.score, 0) + bonus;
    const key = bestKey(L.id);
    const prev = save.best[key];
    const isNew = !prev || team > prev.score;
    if (isNew) save.best[key] = { score: team, time: Math.round(time) };
    const newCard = !save.cards[L.id];
    save.cards[L.id] = true;
    const win = order[0];
    if (save.mode === 'race' && win.human) save.wins[win.id] = (save.wins[win.id] || 0) + 1;
    persist();
    let head;
    if (save.mode === 'race') head = win.human ? `🏆 ${K.NAMES[win.id]} WINS!` : '🦊🐸 FOXY AND FROGGY WIN!';
    else head = players.length > 1 ? '🎉 GREAT TEAMWORK!' : '🎉 ALL SAFE!';
    $('rHead').textContent = head;
    const rows = $('rRows');
    rows.innerHTML = '';
    for (const r of order) {
      const d = document.createElement('div');
      d.className = 'rrow' + (r.human ? ' me' : '');
      const medal = save.mode === 'race' ? ['🥇', '🥈', '🥉'][r.place - 1] || '' : '🚒';
      const face = r.human ? `<img alt="" src="${portraits[r.id]}">` : '🦊';
      d.innerHTML = `<span class="medal">${medal}</span><span class="face">${face}</span><span class="nm">${K.NAMES[r.id]}</span><span class="stats">🔥 ${r.fires} · 🐱 ${r.kittens}</span><span class="tm">${r.score}</span>`;
      rows.appendChild(d);
    }
    $('rBest').innerHTML = `<span>⏱️ ${fmtTime(time)}</span><span>⚡ +${bonus}</span><span>⭐ ${team}</span>${isNew ? '<span class="rnew">NEW BEST!</span>' : `<span>🏅 ${prev.score}</span>`}`;
    $('rTip').innerHTML = cardHTML(L.card, L, newCard ? '🃏 NEW SAFETY CARD!' : '🃏 SAFETY CARD');
    $('results').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('pads').classList.add('hidden');
    $('buddyBtn').classList.add('hidden');
    $('fiveBtn').classList.add('hidden');
    results = { order, time, bonus, team, isNew, newCard };
    Kit.sound.music('over');
  }

  // ---------------------------------------------------------------- the camera: out on the road, looking at the buildings
  // region: the part of the screen the picture should fill (menus and results cover the rest)
  function homeRegion() { return window.innerWidth / window.innerHeight > 1.1 ? [0, 0, 0.4, 1] : [0, 0.03, 1, 0.33]; }
  function playRegion() {
    const w = window.innerWidth, h = window.innerHeight;
    return w / h > 1.1 ? [0, 0.06, 1, 0.72] : [0, 0.08, 1, 0.66];
  }
  const look = new T.Vector3(), dir = new T.Vector3(-0.2, 0.17, 1).normalize();
  function aimCam(dt) {
    const region = state === 'home' ? homeRegion() : state === 'results' ? (window.innerWidth / window.innerHeight > 1.1 ? [0, 0.05, 0.42, 0.9] : [0, 0.02, 1, 0.3]) : playRegion();
    const w = window.innerWidth, h = window.innerHeight;
    const rw = Math.max(1, region[2] * w), rh = Math.max(1, region[3] * h);
    let watch = m.trucks.filter((tr) => tr.human);
    if (!watch.length) watch = m.trucks.slice(0, 1);
    const xs = watch.map((tr) => tr.x + P.BX);
    const lo = Math.min(...xs) - 6, hi = Math.max(...xs) + 3.5;
    const top = Math.max(11, ...watch.map((tr) => tr.h + 3.6));
    const tall = rw / rh < 1;
    const needW = Math.max(tall ? 13 : 22, hi - lo + 3);
    const needH = top + 1.5;
    const tanH = Math.tan((cam.fov * Math.PI) / 360);
    const D = Math.min(95, Math.max(needH / (2 * tanH), needW / (2 * tanH * (rw / rh))));
    const tx = (lo + hi) / 2, ty = top / 2 - 0.2;
    const k = camS.snap ? 1 : 1 - Math.exp(-3 * dt);
    camS.x += (tx - camS.x) * k;
    camS.y += (ty - camS.y) * k;
    camS.D += (D - camS.D) * (camS.snap ? 1 : 1 - Math.exp(-2 * dt));
    camS.snap = false;
    look.set(camS.x, camS.y, 3.5);
    cam.position.copy(look).addScaledVector(dir, camS.D);
    cam.lookAt(look);
    cam.setViewOffset(rw, rh, -region[0] * w, -region[1] * h, w, h);
    camViews = [{ cam, x: 0, y: 0, w: 1, h: 1 }];
  }

  // ---------------------------------------------------------------- HUD
  function buildBoard() {
    const box = $('board');
    box.innerHTML = '';
    m.trucks.forEach((tr) => {
      const d = document.createElement('div');
      d.className = 'srow' + (tr.human ? ' me' : ' cpu');
      d.innerHTML = `<span class="face">${tr.human ? `<img alt="" src="${portraits[tr.id]}">` : '🦊'}</span><span class="pts">0</span><span class="chip"></span>${tr.human && tr.lv === 'normal' ? '<span class="tank"><b></b><i>💧</i></span>' : ''}`;
      box.appendChild(d);
    });
  }
  function updateHUD() {
    const left = m.left();
    const t = Math.max(0, m.time);
    const key = [left.fires, left.kittens, Math.floor(t), ...m.trucks.map((tr) => `${tr.score},${tr.fires},${tr.kittens},${Math.round(tr.tank * 50)}`)].join('|');
    if (key === hudKey) return;
    hudKey = key;
    $('fireLeft').textContent = `🔥 ${left.fires}`;
    $('kitLeft').textContent = `🐱 ${left.kittens}`;
    $('timeNow').textContent = fmtTime(t);
    const rows = $('board').children;
    m.trucks.forEach((tr, i) => {
      const r = rows[i];
      if (!r) return;
      r.querySelector('.pts').textContent = tr.score;
      r.querySelector('.chip').textContent = `🔥${tr.fires} 🐱${tr.kittens}`;
      const tank = r.querySelector('.tank');
      if (tank) {
        tank.querySelector('b').style.transform = `scaleX(${tr.tank.toFixed(3)})`;
        tank.classList.toggle('low', tr.tank < 0.2);
      }
    });
  }

  function buildPads() {
    const box = $('pads');
    box.innerHTML = '';
    pads = players.map((id, pl) => {
      const two = players.length > 1;
      const kb = two ? (pl ? ['←', '→', '↑', '↓', 'Enter'] : ['A', 'D', 'W', 'S', 'Space']) : ['←', '→', '↑', '↓', 'Space'];
      const mk = (cls, label, key, what, hint) => {
        const b = document.createElement('button');
        b.className = 'pad ' + cls;
        b.innerHTML = `${label}${hint ? `<small>${hint}</small>` : ''}<kbd>${key}</kbd>`;
        b.setAttribute('aria-label', { left: 'Drive left', right: 'Drive right', up: 'Ladder up', down: 'Ladder down', spray: 'Spray water' }[what]);
        const down = (e) => {
          e.preventDefault();
          Kit.sound.init();
          try { b.setPointerCapture(e.pointerId); } catch (err) { /* old browser */ }
          b.classList.add('down');
          padHeld[pl][what] = true;
        };
        const up = () => { b.classList.remove('down'); padHeld[pl][what] = false; };
        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('lostpointercapture', up);
        box.appendChild(b);
        return b;
      };
      padHeld[pl] = {};
      return { left: mk('dir', '◀', kb[0], 'left'), right: mk('dir', '▶', kb[1], 'right'), up: mk('dir', '▲', kb[2], 'up', 'LADDER'), down: mk('dir', '▼', kb[3], 'down'), spray: mk('spray', '💧', kb[4], 'spray', 'WATER') };
    });
  }
  function hudUI() {
    $('pauseBtn').addEventListener('click', () => setPause(true));
    $('muteBtn').addEventListener('click', () => { Kit.sound.init(); Kit.sound.toggleMute(); });
    $('pResume').addEventListener('click', () => setPause(false));
    $('pRestart').addEventListener('click', () => startMission());
    $('pHome').addEventListener('click', goHome);
    $('rAgain').addEventListener('click', () => startMission());
    $('rNext').addEventListener('click', nextLevel);
    $('rHome').addEventListener('click', goHome);
    $('buddyBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); Kit.sound.init(); callBuddy(); });
    $('fiveBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); Kit.sound.init(); if (m && state === 'play' && !paused) highFive(); });
  }

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    const two = players.length > 1;
    const s = Math.round(Math.max(48, Math.min(78, Math.min(w, h) * 0.105)));
    const gap = 6, edge = 12, safeB = 14;
    const big = Math.round(s * 1.45);
    const set = (b, x, y, sz) => Object.assign(b.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, width: `${sz || s}px`, height: `${sz || s}px` });
    const cross = 3 * s + 2 * gap;
    const narrow = two && w < 2 * (cross + big + 2 * edge + 12) + 70;
    const spans = [];
    pads.forEach((p, pl) => {
      const right = two && pl === 1;
      const cx = right ? w - edge - cross / 2 : edge + cross / 2;
      const cy = h - safeB - cross / 2;
      set(p.up, cx - s / 2, cy - s / 2 - s - gap);
      set(p.down, cx - s / 2, cy + s / 2 + gap);
      set(p.left, cx - s / 2 - s - gap, cy - s / 2);
      set(p.right, cx + s / 2 + gap, cy - s / 2);
      let sx, sy;
      if (!two) { sx = w - edge - big; sy = h - safeB - big - s * 0.25; }
      else if (narrow) { sx = cx - big / 2; sy = cy - cross / 2 - big - 22; }
      else { sx = right ? cx - cross / 2 - 12 - big : cx + cross / 2 + 12; sy = h - safeB - big; }
      set(p.spray, sx, sy, big);
      spans.push(two ? [Math.min(cx - cross / 2, sx), Math.max(cx + cross / 2, sx + big)] : [cx - cross / 2, cx + cross / 2]);
    });
    const bs = Math.round(Math.max(58, Math.min(84, Math.min(w, h) * 0.11)));
    for (const id of ['buddyBtn', 'fiveBtn']) {
      const b = $(id);
      let x = w / 2 - bs / 2, y = h - safeB - bs;
      if (!two && spans[0]) x = (spans[0][1] + (w - edge - big)) / 2 - bs / 2;
      if (two && narrow) y = h - safeB - bs - s * 1.2;
      if (!two && spans[0]) x = Math.max(spans[0][1] + 8, Math.min(x, w - edge - big - bs - 8));
      Object.assign(b.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, width: `${bs}px`, height: `${bs}px` });
    }
    for (let pl = 0; pl < 2; pl++) {
      const el = $(`toasts${pl}`);
      const x = two ? (pl ? w * 0.72 : w * 0.28) : w / 2;
      Object.assign(el.style, { left: `${x}px`, top: `${h * (w > h ? 0.2 : 0.18)}px`, width: `${two ? w * 0.48 : w * 0.94}px` });
    }
  }

  // ---------------------------------------------------------------- toasts and confetti (2D, on top)
  function toast(text, kind, pl) {
    const box = $(`toasts${players.length > 1 ? pl || 0 : 0}`);
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2000);
    while (box.children.length > 3) box.firstChild.remove();
  }
  const fx = $('fx').getContext('2d');
  const bits = [];
  function confetti(n) {
    const Wd = window.innerWidth;
    for (let i = 0; i < n; i++) {
      bits.push({ x: rand(0, Wd), y: rand(-200, -10), vx: rand(-60, 60), vy: rand(80, 220), r: rand(0, 6), vr: rand(-6, 6), w: rand(7, 13), h: rand(4, 8), c: Kit.gfx.pick(['#ffd400', '#e8382f', '#5ec8ff', '#7ed957', '#ff3d7f', '#ffffff']), life: rand(3, 5) });
    }
  }
  function drawFx(dt) {
    const c = $('fx');
    const Wd = window.innerWidth, Hd = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(Wd * dpr) || c.height !== Math.round(Hd * dpr)) { c.width = Math.round(Wd * dpr); c.height = Math.round(Hd * dpr); }
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.clearRect(0, 0, Wd, Hd);
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.r += b.vr * dt;
      if (b.life <= 0 || b.y > Hd + 20) { bits.splice(i, 1); continue; }
      fx.save();
      fx.translate(b.x, b.y);
      fx.rotate(b.r);
      fx.fillStyle = b.c;
      fx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      fx.restore();
    }
  }

  // ---------------------------------------------------------------- window.game, for tests
  const game = {
    autoPause: true,
    start(o) { startMission(o || {}); return game.info(); },
    // quick: only draw the last frame (for long fast-forwards in tests)
    step(seconds, quick) {
      const n = Math.max(1, Math.round((seconds || 0) * 60));
      for (let i = 0; i < n; i++) frame(1 / 60, quick && i < n - 1);
      return game.info();
    },
    hold(on) { held = !!on; },
    buddy() { callBuddy(); return game.info().buddy; },
    five() { if (m && state === 'play') highFive(); },
    pause(p) { setPause(p); },
    home() { goHome(); },
    next() { nextLevel(); },
    book(on) { openBook(on); },
    autopilot(kind) {
      if (!m) return;
      m.trucks.forEach((tr, i) => { if (tr.human) tr.pilotFn = kind ? R.PILOTS[kind](R.rng(7 + i)) : null; });
    },
    check(o) { return FIRE.checks.run(Object.assign({ prove: true }, o || {})); },
    info() {
      return {
        state, paused, held, level: L.id, mode: save.mode, who: save.who, lv: Object.assign({}, save.lv),
        time: m ? +m.time.toFixed(2) : null, done: m ? m.done : null, left: m ? m.left() : null,
        trucks: m ? m.trucks.map((tr) => ({ id: tr.id, x: +tr.x.toFixed(2), h: +tr.h.toFixed(2), tank: +tr.tank.toFixed(2), score: tr.score, fires: tr.fires, kittens: tr.kittens, spraying: tr.spraying })) : [],
        buddy: seq ? { who: seq.entry.id, t: +seq.t.toFixed(2), tossed: seq.tossed, helped: seq.helped, fire: seq.jet ? seq.jet.fire : null } : null,
        results: results ? { team: results.team, time: Math.round(results.time), order: results.order.map((r) => [r.id, r.score]) } : null,
      };
    },
    get mission() { return m; },
    get save() { return save; },
    get cam() { return cam; },
  };
  window.game = game;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
