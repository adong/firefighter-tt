/* TT Firefighters: the rules, with no drawing (the checks run them in node). A mission is one street: one to three
   fire trucks drive along the road, raise their ladders and spray water. Every truck's basket sits ahead of its cab:
   left / right drives the truck, up / down raises the ladder, and the water goes straight from the basket into the
   building in front of it. A fire shrinks while it's sprayed and goes out; a kitten hops into the basket when it's
   close (if its window isn't on fire). When every fire is out and every kitten is safe, the street is done.
   🐣 EASY: no water tank, a wide spray, a basket that glides to the nearest fire or kitten, fires that stay small.
   🔥 NORMAL: a water tank you refill at the hydrant, an exact spray, fires that grow back when you stop.
   Physics steps are fixed (1/120 s) so the result doesn't depend on the frame rate.
   FIRE.rules.mission(levelId, { trucks: [{ id, lv, human, pilot }], seed }) → m; m.step(dt); m.events. */
(function () {
  'use strict';
  const FIRE = (window.FIRE = window.FIRE || {});
  const Lv = FIRE.levels;

  const STEP = 1 / 120;
  const PHYS = {
    BX: 1.5, // the basket's x ahead of the truck's middle
    NOZ: 1.0, // the nozzle above the basket floor
    KIT: 0.7, // a kitten hops in this far above the basket floor
    HMIN: 2.8, HMAX: 23, // the basket floor's lowest and highest
    acc: 14, // the truck speeds up and slows down (m/s²)
    vmax: { easy: 5.5, normal: 7.5 },
    hspeed: { easy: 4.6, normal: 6 }, // the ladder (m/s)
    aim: { easy: 1.55, normal: 1.1 }, // how close the spray has to be (bigger fires add more)
    reach: { easy: 1.9, normal: 1.35 }, // how close the basket has to be for a kitten to hop in
    dps: { easy: 1.45, normal: 1 }, // water per second
    hp: { easy: [1.2, 5], normal: [1.5, 7] }, // small fire, big fire
    regrow: 0.2, // NORMAL: a fire grows back this much a second after 2.5 s with no water
    drain: 0.065, // NORMAL: the tank empties in about 15 s of spraying
    fill: 0.6, // refilling at the hydrant
    hydrant: 2.3, // park this close to the hydrant (truck's middle) to refill
    assist: { x: 2.4, y: 2.8, speed: 2.6 }, // EASY: glide to a fire or kitten this close
    buddy: { dps: 3.2, time: 3, delay: 0.5 }, // the brother's big hose
    points: { fire: 100, big: 300, kitten: 200, five: 0 },
  };
  const SAB = {}; // set by the checks, to prove they can fail

  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function mission(levelId, o) {
    o = o || {};
    const L = typeof levelId === 'object' ? levelId : Lv.get(levelId);
    const xMin = L.roadL + 4, xMax = L.roadR - 4;
    const humans = (o.trucks || []).filter((t) => t.human);
    const hard = humans.length > 0 && humans.every((t) => t.lv === 'normal');
    const fires = L.fires.map((f) => {
      const max = PHYS.hp[hard ? 'normal' : 'easy'][f.big ? 1 : 0];
      return { i: f.i, x: f.x, y: f.y, big: !!f.big, prop: f.prop || null, hp: max, max, out: false, dry: 99, hitBy: -1, size: f.big ? 0.9 : 0.35 };
    });
    const kittens = L.kittens.map((k) => ({ i: k.i, x: k.x, y: k.y, hot: k.hot != null ? k.hot : -1, coat: k.coat, saved: false, by: -1 }));
    const start = o.startX != null ? o.startX : Math.min(...L.fires.map((f) => f.x), ...L.kittens.map((k) => k.x)) - 7;
    const trucks = (o.trucks || [{ id: 'teddy', lv: 'easy', human: true }]).map((t, i) => ({
      i, id: t.id, lv: t.lv || 'easy', human: !!t.human, lane: i,
      x: clamp(start - i * 2.5, xMin, xMax), v: 0, h: PHYS.HMIN, hv: 0,
      spraying: false, sprayHit: -1, tank: 1, filling: false,
      score: 0, fires: 0, bigs: 0, kittens: 0, water: 0,
      input: { dx: 0, dy: 0, spray: false }, pilotFn: t.pilot || null,
      hotCool: 0, emptyCool: 0, sprayT: 0,
    }));
    const m = {
      L, levelId: L.id, xMin, xMax, hard, trucks, fires, kittens, jets: [], events: [],
      time: o.time != null ? o.time : 0, acc: 0, done: false, doneAt: null, steps: 0, rand: rng(o.seed || 1), trace: o.trace ? [] : null,
      step(dt) {
        if (SAB.rawdt) { tick(m, dt); return; }
        m.acc += dt;
        while (m.acc >= STEP) { m.acc -= STEP; tick(m, STEP); }
      },
      left() { return { fires: fires.filter((f) => !f.out).length, kittens: kittens.filter((k) => !k.saved).length }; },
      basket(tr) { return { x: tr.x + PHYS.BX, y: tr.h }; },
      // the brother's big hose: aims at the big fire (or the biggest one still burning) and puts it out
      buddy(pl) {
        const tgt = biggest(m);
        const jet = { pl: pl || 0, fire: tgt ? tgt.i : -1, t: 0, x: tgt ? tgt.x : null, y: tgt ? tgt.y : null };
        m.jets.push(jet);
        return jet;
      },
      // a high five: both tanks full
      five() { for (const tr of trucks) if (tr.human) tr.tank = 1; },
      results() {
        const order = trucks.slice().sort((a, b) => b.score - a.score || a.i - b.i);
        let place = 0, last = null;
        return order.map((tr, n) => {
          if (tr.score !== last) place = n + 1;
          last = tr.score;
          return { id: tr.id, i: tr.i, human: tr.human, place, score: tr.score, fires: tr.fires, bigs: tr.bigs, kittens: tr.kittens };
        });
      },
    };
    return m;
  }

  function biggest(m) {
    let best = null;
    for (const f of m.fires) if (!f.out && (!best || (f.big && !best.big) || (f.big === best.big && f.hp > best.hp))) best = f;
    return best;
  }

  function aimOf(tr, f) { return PHYS.aim[tr.lv] + (f.big ? 0.5 : 0); }
  // the fire this truck's water is hitting, if any: the closest one within its aim
  function sprayTarget(m, tr) {
    const bx = tr.x + PHYS.BX, ny = tr.h + PHYS.NOZ;
    let best = null, bd = Infinity;
    for (const f of m.fires) {
      if (f.out) continue;
      const a = aimOf(tr, f), dx = Math.abs(bx - f.x), dy = Math.abs(ny - f.y);
      if (dx > a || dy > a) continue;
      const d = dx + dy;
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }
  function kittenNear(tr, k) {
    const r = PHYS.reach[tr.lv];
    return Math.abs(tr.x + PHYS.BX - k.x) <= r && Math.abs(tr.h + PHYS.KIT - k.y) <= r;
  }
  function blocked(m, k) {
    if (k.hot < 0) return false;
    const f = m.fires[k.hot];
    return !f || !f.out;
  }

  // the nearest job for the EASY glide and the pilots: a fire still burning or a kitten still waiting
  function jobs(m) {
    const out = [];
    for (const f of m.fires) if (!f.out) out.push({ kind: 'fire', ref: f, x: f.x, h: f.y - PHYS.NOZ });
    for (const k of m.kittens) if (!k.saved && !blocked(m, k)) out.push({ kind: 'kitten', ref: k, x: k.x, h: k.y - PHYS.KIT });
    return out;
  }

  function fireOut(m, f, pl, buddy) {
    f.out = true;
    f.hp = 0;
    f.hitBy = pl;
    const tr = m.trucks[pl];
    if (tr) {
      tr.score += f.big ? PHYS.points.big : PHYS.points.fire;
      tr.fires++;
      if (f.big) tr.bigs++;
    }
    m.events.push({ type: 'out', fire: f.i, big: f.big, pl, buddy: !!buddy, x: f.x, y: f.y });
  }

  function tick(m, dt) {
    m.time += dt;
    m.steps++;
    if (m.time < 0) return;
    const P = PHYS;
    for (const tr of m.trucks) {
      tr.hotCool = Math.max(0, tr.hotCool - dt);
      tr.emptyCool = Math.max(0, tr.emptyCool - dt);
      const inp = m.done ? { dx: 0, dy: 0, spray: false } : tr.pilotFn ? tr.pilotFn(m, tr) || tr.input : tr.input;
      const dx = clamp(+inp.dx || 0, -1, 1), dy = clamp(+inp.dy || 0, -1, 1);
      // drive
      const vT = dx * P.vmax[tr.lv];
      const dv = vT - tr.v, a = P.acc * dt * (Math.abs(vT) < Math.abs(tr.v) ? 1.4 : 1);
      tr.v += clamp(dv, -a, a);
      // ladder
      const hT = dy * P.hspeed[tr.lv];
      tr.hv += clamp(hT - tr.hv, -30 * dt, 30 * dt);
      // 🐣 EASY: let go and the basket glides to the nearest job
      if (tr.lv === 'easy' && !m.done && !SAB.noAssist) {
        let best = null, bd = Infinity;
        for (const j of jobs(m)) {
          const ex = Math.abs(j.x - (tr.x + P.BX)), ey = Math.abs(j.h - tr.h);
          if (ex > P.assist.x || ey > P.assist.y) continue;
          if (ex + ey < bd) { bd = ex + ey; best = j; }
        }
        if (best) {
          if (Math.abs(dx) < 0.1) {
            const want = clamp((best.x - (tr.x + P.BX)) * 3, -P.assist.speed, P.assist.speed);
            tr.v += (want - tr.v) * Math.min(1, dt * 8);
          }
          if (Math.abs(dy) < 0.1) {
            const want = clamp((best.h - tr.h) * 3, -P.assist.speed, P.assist.speed);
            tr.hv += (want - tr.hv) * Math.min(1, dt * 8);
          }
        }
      }
      tr.x += tr.v * dt;
      if (tr.x < m.xMin) { tr.x = m.xMin; tr.v = Math.max(0, tr.v); }
      if (tr.x > m.xMax) { tr.x = m.xMax; tr.v = Math.min(0, tr.v); }
      if (SAB.stickyLadder && tr.h > 15) tr.hv = Math.max(0, tr.hv); // a broken ladder that won't come back down
      tr.h += tr.hv * dt;
      if (tr.h < P.HMIN) { tr.h = P.HMIN; tr.hv = Math.max(0, tr.hv); }
      if (tr.h > P.HMAX) { tr.h = P.HMAX; tr.hv = Math.min(0, tr.hv); }
      // water
      const hasWater = tr.lv === 'easy' || tr.tank > 0;
      tr.spraying = !!inp.spray && !m.done && hasWater;
      tr.sprayHit = -1;
      if (inp.spray && !m.done && !hasWater && tr.emptyCool <= 0) {
        tr.emptyCool = 3;
        m.events.push({ type: 'empty', pl: tr.i });
      }
      if (tr.spraying) {
        tr.sprayT += dt;
        tr.water += dt;
        if (tr.lv === 'normal') tr.tank = Math.max(0, tr.tank - P.drain * dt);
        const f = sprayTarget(m, tr);
        if (f) {
          tr.sprayHit = f.i;
          f.hp -= P.dps[tr.lv] * dt;
          f.dry = 0;
          if (f.hp <= 0) fireOut(m, f, tr.i, false);
        }
      } else tr.sprayT = 0;
      // the hydrant
      const nearH = Math.abs(tr.x - m.L.hydrant) <= P.hydrant && Math.abs(tr.v) < 1.5;
      const filling = tr.lv === 'normal' && nearH && tr.tank < 1 && !SAB.noRefill;
      if (filling && !tr.filling) m.events.push({ type: 'refill', pl: tr.i });
      tr.filling = filling;
      if (filling) tr.tank = Math.min(1, tr.tank + P.fill * dt);
      // kittens hop in
      if (!m.done) {
        for (const k of m.kittens) {
          if (k.saved || !kittenNear(tr, k)) continue;
          if (blocked(m, k)) {
            if (tr.hotCool <= 0 && !tr.spraying) { tr.hotCool = 3; m.events.push({ type: 'hot', pl: tr.i, kitten: k.i }); }
            continue;
          }
          k.saved = true;
          k.by = tr.i;
          tr.kittens++;
          tr.score += P.points.kitten;
          m.events.push({ type: 'kitten', pl: tr.i, kitten: k.i, x: k.x, y: k.y });
        }
      }
    }
    // the brother's big hose
    for (const j of m.jets) {
      j.t += dt;
      if (j.t < P.buddy.delay || j.t > P.buddy.delay + P.buddy.time || j.fire < 0 || m.done) continue;
      const f = m.fires[j.fire];
      if (f.out) continue;
      f.hp -= (SAB.noBuddy ? 0 : P.buddy.dps) * dt;
      f.dry = 0;
      if (f.hp <= 0) fireOut(m, f, j.pl, true);
    }
    m.jets = m.jets.filter((j) => j.t <= P.buddy.delay + P.buddy.time + 0.5);
    // 🔥 NORMAL: a fire left alone grows back
    for (const f of m.fires) {
      if (f.out) continue;
      f.dry += dt;
      if (m.hard && f.dry > 2.5 && f.hp < f.max) f.hp = Math.min(f.max, f.hp + P.regrow * dt);
    }
    if (!m.done && m.fires.every((f) => f.out) && m.kittens.every((k) => k.saved)) {
      m.done = true;
      m.doneAt = m.time;
      m.events.push({ type: 'done', time: m.time });
    }
    if (m.trace && m.steps % 240 === 0) m.trace.push(m.trucks.map((t) => [t.x.toFixed(5), t.h.toFixed(5), t.tank.toFixed(5), t.score].join(',')).join('|'));
  }

  // ---------------------------------------------------------------- pretend players (the checks, the demo, Foxy and Froggy)
  // good: drives to the nearest job and does it, refills when the tank is low (🔥 NORMAL)
  function plan(m, tr, o) {
    const P = PHYS, bx = tr.x + P.BX;
    const lowTank = tr.lv === 'normal' && (tr.tank <= 0.02 || (tr.goFill && tr.tank < 0.98));
    tr.goFill = lowTank;
    if (lowTank) {
      const dxh = m.L.hydrant - tr.x;
      return { dx: Math.abs(dxh) > 0.6 ? clamp(dxh * 1.2, -1, 1) : clamp(-tr.v * 0.5, -1, 1), dy: 0, spray: false };
    }
    const js = jobs(m);
    if (!js.length) return { dx: 0, dy: 0, spray: false };
    // stick with the same job until it's done (fewer U-turns)
    let job = tr.job && js.find((j) => j.ref === tr.job.ref);
    if (!job) {
      let bd = Infinity;
      for (const j of js) {
        const d = Math.abs(j.x - bx) + 0.5 * Math.abs(j.h - tr.h) + (o && o.taken && o.taken(m, tr, j) ? 30 : 0);
        if (d < bd) { bd = d; job = j; }
      }
    }
    tr.job = job;
    const ex = job.x - bx, ey = job.h - tr.h;
    const tol = 0.3;
    const dx = Math.abs(ex) > tol ? clamp(ex * 1.4, -1, 1) : clamp(-tr.v * 0.3, -1, 1);
    const dy = Math.abs(ey) > tol ? clamp(ey * 1.4, -1, 1) : 0;
    const a = job.kind === 'fire' ? aimOf(tr, job.ref) * 0.85 : 0;
    const spray = job.kind === 'fire' && Math.abs(ex) < a && Math.abs(ey) < a;
    return { dx, dy, spray };
  }
  // two trucks don't both chase the same job
  function taken(m, tr, j) { return m.trucks.some((o) => o !== tr && o.job && o.job.ref === j.ref); }

  const PILOTS = {
    good(r) { return (m, tr) => plan(m, tr, { taken }); },
    // a 5-year-old: slow to react, overshoots, lets go of the water, stops to look at things
    kid(r) {
      let hold = null, next = -1e9;
      return (m, tr) => {
        if (hold && m.time < next) return hold;
        if (r() < 0.07) { hold = { dx: 0, dy: 0, spray: r() < 0.3 }; next = m.time + 0.8 + r() * 1.2; return hold; }
        next = m.time + 0.3 + r() * 0.6;
        const p = plan(m, tr, { taken });
        const wobble = r() < 0.15 ? -1 : 1;
        hold = { dx: p.dx * wobble * (0.6 + r() * 0.4), dy: p.dy * (r() < 0.12 ? -1 : 1), spray: p.spray ? r() < 0.75 : r() < 0.15 };
        if (Math.abs(p.dx) < 0.2 && Math.abs(p.dy) < 0.2) hold.dx = hold.dy = 0;
        return hold;
      };
    },
    // an 8-year-old: quicker and steadier than his brother, still not perfect
    teddy(r) {
      let hold = null, next = -1e9;
      return (m, tr) => {
        if (hold && m.time < next) return hold;
        if (r() < 0.03) { hold = { dx: 0, dy: 0, spray: false }; next = m.time + 0.5 + r() * 0.8; return hold; }
        next = m.time + 0.15 + r() * 0.25;
        const p = plan(m, tr, { taken });
        hold = { dx: p.dx * (r() < 0.06 ? -1 : 1), dy: p.dy, spray: p.spray ? r() < 0.9 : r() < 0.05 };
        return hold;
      };
    },
    // presses everything, at random
    masher(r) {
      let hold = { dx: 0, dy: 0, spray: false }, next = 0;
      return (m) => {
        if (m.time >= next) {
          next = m.time + 0.1 + r() * 0.5;
          hold = { dx: Math.round(r() * 2 - 1), dy: Math.round(r() * 2 - 1), spray: r() < 0.5 };
        }
        return hold;
      };
    },
    // holds ▲ the whole time, and drives about
    climber(r) {
      let dx = 0, next = 0;
      return (m) => {
        if (m.time >= next) { next = m.time + 0.5 + r(); dx = Math.round(r() * 2 - 1); }
        return { dx, dy: 1, spray: r() < 0.5 };
      };
    },
    // Foxy and Froggy's truck: a good firefighter, slower on 🐣 EASY so the kids can win
    cpu(r, lv) {
      const slow = lv === 'normal' ? 0.85 : 0.3;
      let restUntil = 0, nextRest = 2;
      return (m, tr) => {
        if (lv !== 'normal' && m.time > nextRest) { restUntil = m.time + 2.5 + r() * 2.5; nextRest = restUntil + 1.5 + r() * 2; }
        if (m.time < restUntil) return { dx: 0, dy: 0, spray: false }; // Froggy waves at the crowd
        const p = plan(m, tr, { taken });
        return { dx: p.dx * slow, dy: p.dy * slow, spray: p.spray };
      };
    },
  };

  FIRE.rules = { PHYS, STEP, SAB, mission, rng, jobs, sprayTarget, biggest, blocked, kittenNear, PILOTS, clamp };
})();
