/* TT Firefighters: the headless checks (no drawing). game.check() runs them in the page; node tools/check.js runs the
   same file in node. The brief's rule: every street can be won and the game never gets stuck.
     reach   every fire can be sprayed and every kitten reached from the road, at both levels; each street has one big
             fire, a kitten waiting behind a fire waits behind a real one, and the hydrant is on the road.
     win     every street, both levels, 1 player, 2 players, against Foxy and Froggy, and both brothers against them:
             a careful firefighter puts out every fire and saves every kitten. A wobbly 5-year-old wins every street too.
     stuck   from anywhere a button-masher can get to (ladder up, tank empty, half the fires out), a careful player can
             still finish; nothing goes off the road, no number breaks, nothing that's done comes undone.
     buddy   the brother's big hose puts out the big fire first, then the biggest one left, every time he's called.
     frames  30, 60, 144 and a jumpy frame rate give exactly the same game.
     easyRace on 🐣 EASY a wobbly 5-year-old beats Foxy and Froggy's truck on most streets.
   run({ prove: true }) also breaks the game on purpose, one way per check, and each check has to notice. */
(function () {
  'use strict';
  const FIRE = (window.FIRE = window.FIRE || {});
  const R = FIRE.rules, Lv = FIRE.levels, P = R.PHYS;

  let BROKEN = null; // the sabotage the prove phase is trying
  function level(id) {
    const L = Lv.get(id);
    if (BROKEN === 'farFire' && id === 'tower') {
      const C = JSON.parse(JSON.stringify(L));
      C.fires[3].y += 10; // the big fire floats up out of reach
      return C;
    }
    if (BROKEN === 'lostKitten' && id === 'park') {
      const C = JSON.parse(JSON.stringify(L));
      C.kittens[0].hot = 9; // waits behind a fire that isn't there
      return C;
    }
    return L;
  }

  function trucksFor(setup, lv, pilot, seed) {
    const r = (n) => R.rng(seed * 31 + n);
    const human = (id, n) => ({ id, lv, human: true, pilot: R.PILOTS[pilot](r(n)) });
    const cpu = () => ({ id: 'foxy', lv, human: false, pilot: R.PILOTS.cpu(r(9), lv) });
    if (setup === 'solo') return [human('teddy', 1)];
    if (setup === 'two') return [human('teddy', 1), human('tommy', 2)];
    if (setup === 'race') return [human('tommy', 1), cpu()];
    return [human('teddy', 1), human('tommy', 2), cpu()];
  }
  function play(id, trucks, limit, dt, each) {
    const m = R.mission(level(id), { trucks, seed: 5 });
    const step = dt || 1 / 60;
    while (!m.done && m.time < limit) {
      m.step(typeof step === 'function' ? step() : step);
      m.events.length = 0;
      if (each && each(m) === false) break;
    }
    return m;
  }

  function reach() {
    const problems = [];
    let n = 0;
    for (const id of Lv.ids) {
      const L = level(id);
      const xMin = L.roadL + 4, xMax = L.roadR - 4;
      if (L.fires.filter((f) => f.big).length !== 1) problems.push(`${id}: ${L.fires.filter((f) => f.big).length} big fires`);
      if (L.hydrant < xMin - P.hydrant || L.hydrant > xMax + P.hydrant) problems.push(`${id}: the hydrant is off the road`);
      for (const lv of ['easy', 'normal']) {
        for (const f of L.fires) {
          const a = P.aim[lv] + (f.big ? 0.5 : 0);
          n++;
          if (f.x - P.BX < xMin - a || f.x - P.BX > xMax + a || f.y - P.NOZ < P.HMIN - a || f.y - P.NOZ > P.HMAX + a) problems.push(`${id} ${lv}: fire ${f.i} at ${f.x.toFixed(1)}, ${f.y.toFixed(1)} can't be sprayed`);
        }
        for (const k of L.kittens) {
          const a = P.reach[lv];
          n++;
          if (k.x - P.BX < xMin - a || k.x - P.BX > xMax + a || k.y - P.KIT < P.HMIN - a || k.y - P.KIT > P.HMAX + a) problems.push(`${id} ${lv}: kitten ${k.i} can't be reached`);
          if (k.hot != null && k.hot >= 0) {
            const f = L.fires[k.hot];
            if (!f) problems.push(`${id}: kitten ${k.i} waits behind fire ${k.hot}, and there's no such fire`);
            else if (Math.abs(f.x - k.x) > 0.5) problems.push(`${id}: kitten ${k.i}'s fire is in another window`);
          }
        }
      }
    }
    return { problems, stat: `${n} fires and kittens on ${Lv.ids.length} streets` };
  }

  function win() {
    const problems = [];
    let worst = 0, runs = 0;
    const kidWorst = {};
    for (const id of Lv.ids) {
      for (const lv of ['easy', 'normal']) {
        for (const setup of ['solo', 'two', 'race', 'twoRace']) {
          const m = play(id, trucksFor(setup, lv, 'good', 1), 400);
          runs++;
          if (!m.done) problems.push(`${id} ${lv} ${setup}: not done after 400 s (${JSON.stringify(m.left())})`);
          else worst = Math.max(worst, m.doneAt);
        }
        // the brothers themselves (pretend ones): Tommy on both levels, Teddy on NORMAL
        for (const [who, seeds, limit] of [['kid', [1, 2, 3], lv === 'easy' ? 300 : 900], ['teddy', lv === 'normal' ? [1, 2, 3] : [], 400]]) {
          for (const seed of seeds) {
            const m = play(id, trucksFor('solo', lv, who, seed), limit);
            runs++;
            if (!m.done) problems.push(`${id} ${lv} ${who} ${seed}: not done after ${limit} s (${JSON.stringify(m.left())})`);
            else { const k = `${who} ${lv}`; kidWorst[k] = Math.max(kidWorst[k] || 0, m.doneAt); }
          }
        }
      }
    }
    const kw = Object.keys(kidWorst).map((k) => `${k} ${kidWorst[k].toFixed(0)} s`).join(', ');
    return { problems, stat: `${runs} games won; the slowest: careful player ${worst.toFixed(0)} s, ${kw}` };
  }

  function stuck() {
    const problems = [];
    let n = 0, worst = 0;
    for (const id of Lv.ids) {
      for (const lv of ['easy', 'normal']) {
        for (const seed of [1, 2, 3]) {
          for (const [mashFor, how] of [[12, 'masher'], [40, 'masher'], [20, 'climber']]) {
            const trucks = trucksFor(seed === 3 ? 'two' : 'solo', lv, how, seed);
            let outs = 0, saved = 0, bad = null;
            const m = play(id, trucks, mashFor, 1 / 60, (mm) => {
              for (const tr of mm.trucks) {
                for (const k of ['x', 'v', 'h', 'hv', 'tank', 'score']) if (!Number.isFinite(tr[k])) bad = bad || `${k} is ${tr[k]}`;
                if (tr.x < mm.xMin - 1e-9 || tr.x > mm.xMax + 1e-9) bad = bad || `off the road at x ${tr.x}`;
                if (tr.h < P.HMIN - 1e-9 || tr.h > P.HMAX + 1e-9) bad = bad || `ladder at ${tr.h}`;
                if (tr.tank < 0 || tr.tank > 1) bad = bad || `tank ${tr.tank}`;
              }
              for (const f of mm.fires) if (f.hp > f.max + 1e-9 || (f.out && f.hp !== 0) || (!f.out && f.hp <= 0)) bad = bad || `fire ${f.i} hp ${f.hp}`;
              const o = mm.fires.filter((f) => f.out).length, s = mm.kittens.filter((k) => k.saved).length;
              if (o < outs || s < saved) bad = bad || 'something came undone';
              outs = o;
              saved = s;
              return !bad;
            });
            n++;
            if (bad) { problems.push(`${id} ${lv} ${how} ${seed}: ${bad}`); continue; }
            // now a careful player takes over from wherever the masher left it
            const t0 = m.time;
            for (const tr of m.trucks) tr.pilotFn = R.PILOTS.good(R.rng(seed));
            while (!m.done && m.time < t0 + 400) { m.step(1 / 60); m.events.length = 0; }
            if (!m.done) problems.push(`${id} ${lv} after ${how} ${mashFor} s (seed ${seed}): stuck, ${JSON.stringify(m.left())} left, ladder ${m.trucks[0].h.toFixed(1)}, tank ${m.trucks[0].tank.toFixed(2)}`);
            else worst = Math.max(worst, m.doneAt - t0);
          }
        }
      }
    }
    return { problems, stat: `${n} mashed games, all finished afterwards (at most ${worst.toFixed(0)} s)` };
  }

  function buddy() {
    const problems = [];
    let calls = 0;
    for (const id of Lv.ids) {
      for (const lv of ['easy', 'normal']) {
        const m = R.mission(level(id), { trucks: [{ id: 'teddy', lv, human: true }] });
        const order = [];
        for (let c = 0; c < m.fires.length + 1; c++) {
          const before = m.fires.filter((f) => !f.out);
          const want = before.find((f) => f.big) || before.slice().sort((a, b) => b.hp - a.hp)[0];
          const jet = m.buddy(0);
          calls++;
          if (!want) { if (jet.fire !== -1) problems.push(`${id} ${lv}: aimed at fire ${jet.fire} with every fire out`); break; }
          if (jet.fire !== want.i) problems.push(`${id} ${lv}: call ${c + 1} aimed at fire ${jet.fire}, not ${want.i}`);
          for (let t = 0; t < P.buddy.delay + P.buddy.time + 0.1; t += 1 / 60) { m.step(1 / 60); m.events.length = 0; }
          if (!m.fires[jet.fire].out) problems.push(`${id} ${lv}: call ${c + 1} didn't put out fire ${jet.fire} (hp ${m.fires[jet.fire].hp.toFixed(2)})`);
          order.push(jet.fire);
        }
        if (m.fires.some((f) => !f.out)) problems.push(`${id} ${lv}: fires still burning after ${order.length} calls`);
      }
    }
    return { problems, stat: `${calls} calls, each one put out its fire (the big one first)` };
  }

  function frames() {
    const problems = [];
    // the mission writes down every truck every 2 s of game time (every 240 physics steps)
    const trace = (dt) => {
      const m = R.mission(level('night'), { trucks: trucksFor('twoRace', 'normal', 'kid', 4), seed: 3, trace: true });
      const step = typeof dt === 'function' ? dt : () => dt;
      while (m.trace.length < 40 && m.time < 200) { m.step(step()); m.events.length = 0; }
      return m.trace;
    };
    const base = trace(1 / 120);
    const jr = R.rng(77);
    for (const [name, dt] of [['30 fps', 1 / 30], ['60 fps', 1 / 60], ['144 fps', 1 / 144], ['jumpy', () => 1 / 200 + jr() * (1 / 20)]]) {
      const t = trace(dt);
      const n = Math.min(base.length, t.length);
      const diff = t.slice(0, n).findIndex((s, i) => s !== base[i]);
      if (n < 30) problems.push(`${name}: only ${n} snapshots`);
      if (diff >= 0) problems.push(`${name}: differs at ${(diff + 1) * 2} s`);
    }
    return { problems, stat: '30, 60, 144 fps and a jumpy frame rate all play the same' };
  }

  function easyRace() {
    const problems = [];
    let kidWins = 0, games = 0;
    for (const id of Lv.ids) {
      for (const seed of [1, 2]) {
        const m = play(id, trucksFor('race', 'easy', 'kid', seed), 900);
        games++;
        const kid = m.trucks[0], cpu = m.trucks[1];
        if (kid.score >= cpu.score) kidWins++;
      }
    }
    if (kidWins < games - 3) problems.push(`the wobbly kid beat Foxy and Froggy only ${kidWins} of ${games} times`);
    return { problems, stat: `the wobbly kid beat Foxy and Froggy ${kidWins} of ${games} times on EASY` };
  }

  const CHECKS = { reach, win, stuck, buddy, frames, easyRace };
  // each way of breaking the game, and the check that has to notice it
  const BREAKS = [
    { name: 'farFire', check: 'reach', why: 'the tower\'s big fire floats out of reach' },
    { name: 'farFire', check: 'win', why: 'the tower\'s big fire floats out of reach' },
    { name: 'lostKitten', check: 'reach', why: 'a kitten waits behind a fire that isn\'t there' },
    { name: 'lostKitten', check: 'win', why: 'a kitten waits behind a fire that isn\'t there' },
    { name: 'noRefill', check: 'win', why: 'the hydrant gives no water' },
    { name: 'stickyLadder', check: 'stuck', why: 'the ladder won\'t come back down from high up' },
    { name: 'noBuddy', check: 'buddy', why: 'the brother\'s hose sprays nothing' },
    { name: 'rawdt', check: 'frames', why: 'one physics step per frame' },
    { name: 'cpuStrong', check: 'easyRace', why: 'Foxy and Froggy go all out on EASY' },
  ];

  function runOne(name) {
    const t0 = Date.now();
    let r;
    try { r = CHECKS[name](); } catch (e) { r = { problems: ['crashed: ' + (e && e.stack || e)], stat: '' }; }
    return { name, ok: r.problems.length === 0, stat: r.stat, problems: r.problems, ms: Date.now() - t0 };
  }
  function sabotage(name, on) {
    BROKEN = on ? name : null;
    for (const k of Object.keys(R.SAB)) delete R.SAB[k];
    if (on && ['noRefill', 'stickyLadder', 'noBuddy', 'rawdt'].includes(name)) R.SAB[name] = true;
    if (name === 'cpuStrong') {
      if (on) { R.PILOTS._cpu = R.PILOTS.cpu; R.PILOTS.cpu = (r) => R.PILOTS._cpu(r, 'normal'); }
      else if (R.PILOTS._cpu) { R.PILOTS.cpu = R.PILOTS._cpu; delete R.PILOTS._cpu; }
    }
  }

  function run(o) {
    o = o || {};
    const t0 = Date.now();
    const names = o.only ? [o.only] : Object.keys(CHECKS);
    const results = names.map(runOne);
    const prove = [];
    if (o.prove) {
      for (const b of BREAKS) {
        if (!names.includes(b.check)) continue;
        sabotage(b.name, true);
        const r = runOne(b.check);
        sabotage(b.name, false);
        prove.push({ name: b.name, check: b.check, why: b.why, caught: !r.ok, first: r.problems[0] || '(nothing noticed)' });
      }
    }
    const ok = results.every((r) => r.ok) && prove.every((p) => p.caught);
    return { ok, results, prove, ms: Date.now() - t0 };
  }

  FIRE.checks = { run, CHECKS, BREAKS };
})();
