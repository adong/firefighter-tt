/* TT Firefighters: the six streets. Each street is a row of buildings (their fronts face the road at z = 0), maybe
   some trees, the silly fires, the kittens waiting to be rescued and the fire hydrant. Fires and kittens sit in a
   building's window (floor k, column c), on its roof, or in a tree. FIRE.levels.get(id) returns the street with every
   position worked out in metres: x along the road, y up. No drawing here, so the rules and the checks run in node. */
(function () {
  'use strict';
  const FIRE = (window.FIRE = window.FIRE || {});

  const GROUND = 3.6; // the shop floor at street level
  const FLOOR = 3.2; // each floor above it
  const WIN_UP = 1.7; // a window's middle above its floor
  const TREE = { trunk: 4.4, top: 8.4, w: 3.6 }; // a tree's trunk and leafy top

  // the safety tip card each street gives when it's done
  const CARDS = {
    maple: { emoji: '🛑', title: 'STOP, DROP AND ROLL!', text: 'If your clothes catch fire: stop, drop to the ground and roll.' },
    pizza: { emoji: '🔥', title: 'HOT THINGS ARE FOR GROWN-UPS', text: 'Matches, lighters and stoves are for grown-ups only.' },
    toy: { emoji: '🔔', title: 'BEEP BEEP? GET OUT!', text: 'When the smoke alarm beeps, go outside fast and stay out.' },
    park: { emoji: '🌳', title: 'PICK A MEETING SPOT', text: 'Choose a place outside, like a big tree, where your family meets.' },
    tower: { emoji: '🐾', title: 'GET LOW AND GO', text: 'Smoke goes up, so crawl low under it to the door.' },
    night: { emoji: '📞', title: 'GET OUT, THEN CALL 911', text: 'Go outside first. Then a grown-up calls 911.' },
  };

  // b: building, k: floor (1 = the first floor above the shop), c: window column; roof: on top of building b, dx metres in
  // from its left; tree: in tree t. prop: the silly thing that's on fire. hot: this kitten waits behind fire number hot.
  const LIST = [
    {
      id: 'maple', emoji: '🏠', name: 'MAPLE STREET', par: 60, hydrant: -3,
      buildings: [
        { x: 0, w: 10.4, floors: 2, color: '#ffb38a', gable: '#c2553a', door: true },
        { x: 13.4, w: 7.8, floors: 2, color: '#9be3c4', gable: '#3f7cac', door: true },
      ],
      trees: [{ x: 11.7 }],
      fires: [{ b: 0, k: 1, c: 1, prop: '🍞' }, { b: 0, k: 2, c: 2, big: true }, { b: 1, k: 1, c: 2, prop: '🧦' }],
      kittens: [{ roof: 1, dx: 3.9, coat: 'ginger' }],
    },
    {
      id: 'pizza', emoji: '🍕', name: 'PIZZA CORNER', par: 85, hydrant: 8.6,
      buildings: [
        { x: 0, w: 7.8, floors: 2, color: '#ffd166', sign: '🍕', awning: '#e63946' },
        { x: 9.4, w: 10.4, floors: 3, color: '#8ecae6', door: true },
        { x: 21.4, w: 7.8, floors: 2, color: '#f4a3c4', gable: '#8d5bd8', sign: '🥐', awning: '#ffffff' },
      ],
      trees: [],
      fires: [{ b: 0, k: 1, c: 0, prop: '🍕' }, { b: 1, k: 2, c: 1, big: true }, { b: 1, k: 3, c: 3 }, { b: 2, k: 1, c: 1, prop: '🍞' }],
      kittens: [{ b: 1, k: 3, c: 3, hot: 2, coat: 'grey' }, { roof: 0, dx: 2.2, coat: 'ginger' }],
    },
    {
      id: 'toy', emoji: '🧸', name: 'TOY SHOP', par: 105, hydrant: 23.4,
      buildings: [
        { x: 0, w: 7.8, floors: 2, color: '#cdb4db', gable: '#6d597a', door: true },
        { x: 9.6, w: 13, floors: 3, color: '#ff8fa3', sign: '🧸', awning: '#ffd400' },
        { x: 24.6, w: 7.8, floors: 3, color: '#a0c4ff', door: true },
      ],
      trees: [],
      fires: [{ b: 0, k: 2, c: 1, prop: '📚' }, { b: 1, k: 1, c: 0, prop: '🎁' }, { b: 1, k: 3, c: 2, big: true }, { b: 1, k: 2, c: 4 }, { b: 2, k: 2, c: 1, prop: '🍪' }],
      kittens: [{ b: 1, k: 2, c: 4, hot: 3, coat: 'black' }, { roof: 2, dx: 4, coat: 'grey' }],
    },
    {
      id: 'park', emoji: '🌳', name: 'SUNNY PARK', par: 110, hydrant: 9,
      buildings: [
        { x: 0, w: 7.8, floors: 2, color: '#ffe5a8', gable: '#e07a5f', sign: '🍦', awning: '#7ad1ff' },
        { x: 30, w: 10.4, floors: 2, color: '#b9fbc0', door: true },
      ],
      trees: [{ x: 12.4 }, { x: 18.8, house: true }, { x: 25.2 }],
      fires: [{ b: 0, k: 1, c: 1, prop: '🌭' }, { tree: 1, big: true }, { b: 1, k: 2, c: 0 }, { b: 1, k: 1, c: 3, prop: '🍖' }],
      kittens: [{ tree: 0, coat: 'ginger' }, { tree: 2, coat: 'black' }, { roof: 1, dx: 6.5, coat: 'grey' }],
    },
    {
      id: 'tower', emoji: '🏢', name: 'TALL TOWER', par: 140, hydrant: 21,
      buildings: [
        { x: 0, w: 7.8, floors: 3, color: '#ffc6a5', door: true },
        { x: 9.6, w: 10.4, floors: 6, color: '#90e0ef', door: true },
        { x: 22, w: 7.8, floors: 2, color: '#e9c46a', gable: '#9c6644', door: true },
      ],
      trees: [],
      fires: [{ b: 0, k: 3, c: 0 }, { b: 1, k: 2, c: 1, prop: '🍞' }, { b: 1, k: 4, c: 3 }, { b: 1, k: 6, c: 2, big: true }, { b: 1, k: 5, c: 0, prop: '🧦' }, { b: 2, k: 1, c: 1, prop: '🎂' }],
      kittens: [{ roof: 1, dx: 2, coat: 'ginger' }, { b: 1, k: 4, c: 3, hot: 2, coat: 'grey' }],
    },
    {
      id: 'night', emoji: '🌙', name: 'NIGHT TOWN', par: 160, hydrant: 20.8, night: true,
      buildings: [
        { x: 0, w: 10.4, floors: 4, color: '#8e7dbe', door: true },
        { x: 12.2, w: 7.8, floors: 3, color: '#b5838d', gable: '#6d4c5c', sign: '🍦', awning: '#ffd400' },
        { x: 21.8, w: 10.4, floors: 4, color: '#5fa8d3', door: true },
      ],
      trees: [{ x: 34.6 }],
      fires: [{ b: 0, k: 1, c: 0 }, { b: 0, k: 3, c: 2, prop: '🍕' }, { b: 0, k: 4, c: 3 }, { b: 1, k: 2, c: 1, big: true }, { b: 2, k: 1, c: 2, prop: '🎂' }, { b: 2, k: 3, c: 0 }, { b: 2, k: 4, c: 3, prop: '📚' }],
      kittens: [{ b: 0, k: 4, c: 3, hot: 2, coat: 'black' }, { roof: 1, dx: 3.9, coat: 'ginger' }, { tree: 0, coat: 'grey' }],
    },
  ];

  function cols(b) { return Math.max(1, Math.round(b.w / 2.6)); }
  function roofY(b) { return GROUND + b.floors * FLOOR; }
  function gableH(b) { return b.gable ? b.w * 0.26 : 0; }
  function winPos(b, k, c) { return { x: b.x + ((c + 0.5) * b.w) / cols(b), y: GROUND + (k - 1) * FLOOR + WIN_UP }; }
  // the roof's height dx metres in from the left (the ridge of a pointy roof is in the middle)
  function roofAt(b, dx) {
    const g = gableH(b);
    if (!g) return roofY(b);
    const half = b.w / 2 + 0.4;
    return roofY(b) + g * Math.max(0, 1 - Math.abs(dx - b.w / 2) / half);
  }
  function spot(L, s, what) {
    if (s.tree != null) {
      const t = L.trees[s.tree];
      return what === 'fire' ? { x: t.x, y: TREE.top - 1.2 } : { x: t.x + 0.4, y: TREE.trunk + 1.4 };
    }
    const b = L.buildings[s.b != null ? s.b : s.roof];
    if (s.roof != null) return { x: b.x + s.dx, y: roofAt(b, s.dx) + (what === 'fire' ? 0.8 : 0.25) };
    const w = winPos(b, s.k, s.c);
    return what === 'fire' ? w : { x: w.x, y: w.y - 0.75 };
  }

  // the street with every fire, kitten and the road ends worked out
  function resolve(src) {
    const L = JSON.parse(JSON.stringify(src));
    L.fires = L.fires.map((f, i) => Object.assign(f, spot(L, f, 'fire'), { i }));
    L.kittens = L.kittens.map((k, i) => Object.assign(k, spot(L, k, 'kitten'), { i }));
    let lo = Infinity, hi = -Infinity;
    for (const b of L.buildings) { lo = Math.min(lo, b.x); hi = Math.max(hi, b.x + b.w); }
    for (const t of L.trees) { lo = Math.min(lo, t.x - 2); hi = Math.max(hi, t.x + 2); }
    lo = Math.min(lo, L.hydrant - 2);
    L.roadL = lo - 10;
    L.roadR = hi + 10;
    L.card = CARDS[L.id];
    L.top = Math.max(...L.buildings.map((b) => roofY(b) + gableH(b)), L.trees.length ? TREE.top : 0);
    return L;
  }

  const cache = {};
  function get(id) {
    const src = LIST.find((l) => l.id === id) || LIST[0];
    return cache[src.id] || (cache[src.id] = resolve(src));
  }

  FIRE.levels = {
    list: LIST, get, resolve, cols, roofY, gableH, winPos, roofAt, CARDS,
    GROUND, FLOOR, WIN_UP, TREE,
    ids: LIST.map((l) => l.id),
  };
})();
