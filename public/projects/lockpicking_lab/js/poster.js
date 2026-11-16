/*
 * A4 poster generator. Rebuilds every festival poster with panel images
 * rendered from the physics simulation: each panel is a fresh lock driven
 * through the poster's steps, then drawn. poster.html?p=<id> shows one
 * poster; with no parameter it lays out all of them, one per A4 page.
 *
 * Exaggeration is deliberate and kept from the originals: bore clearance,
 * pin tilt and the plug offset (rotation drawn sideways) are enlarged so the
 * mechanism is readable from across a room.
 */
(function () {
  'use strict';
  const { LESSONS, SAFETY, SAFETY2 } = window.Lessons;
  const R = window.Render, Locks = window.Locks;
  const byId = Object.fromEntries(LESSONS.map(l => [l.id, l]));
  Object.defineProperty(window, 'devicePixelRatio', { get: () => 3 }); // print resolution
  const MADE = 'Pictures made with a computer model of the lock.';

  // arrows the original posters print on each panel
  const ARROWS = {
    standard: ['lift', 'lift', 'plug'], serrated: ['lift', 'lift', 'plug'],
    spool: ['lift', 'back', 'plug'], mushroom: ['lift', 'back', 'plug'], hybrid: ['lift', 'back', 'plug'], falseset: ['lift', 'back', 'plug'],
  };

  // ------------------------------------------------------------- runner
  function makeLock(lesson) {
    const S = { tension: 0, lift: 0, insert: 0, shackle: 0, shim: 0, pull: 0, comboIdx: 0, turned: false };
    let lock;
    if (lesson.kind === 'pin') {
      lock = Locks.buildPinLock(lesson.scene); lock.settle(0.8);
      let minY = Infinity; lock.pins.forEach((_, i) => { minY = Math.min(minY, lock.pickYFor(i, -10)); });
      S.liftRange = [lock.ctl.pickRestY, minY];
    } else if (lesson.kind === 'key') {
      lock = Locks.buildPinLock(Object.assign({ mode: 'key' }, lesson.scene));
      lock.setKeyCuts(lesson.scene.pins.map(p => p.keyLen)); lock.setKeyInsertion(0);
      lock.key.x = lock.key.data.entrance; lock.key.updateWorld(); lock.settle(0.6);
    } else if (lesson.kind === 'combo') { lock = Locks.buildComboLock(lesson.scene); lock.settle(); }
    else if (lesson.kind === 'shim') { lock = Locks.buildShimLock({}); lock.settle(); }
    return { lock, S };
  }
  function apply(lesson, lock, S) {
    if (lesson.kind === 'pin') {
      lock.ctl.tension = S.tension;
      const [r0, r1] = S.liftRange; lock.ctl.pickYUser = r0 + (r1 - r0) * S.lift;
    } else if (lesson.kind === 'key') lock.setKeyInsertion(S.insert);
    else if (lesson.kind === 'combo') lock.ctl.shackle = S.shackle;
    else if (lesson.kind === 'shim') {
      const g = lock.geom; lock.ctl.shimY = -80 + (g.latchY + g.latchH / 2 + 6 + 80) * S.shim; lock.ctl.pull = S.pull;
    }
  }
  function liftFor(lock, S, db) {
    let y;
    if (db === 'rest') y = lock.ctl.pickRestY;
    else if (db === 'touch') y = lock.pins[0].key.bottom() - 1;
    else y = lock.pickYFor(0, db);
    const [r0, r1] = S.liftRange;
    return Math.max(0, Math.min(1, (r0 - y) / (r0 - r1)));
  }
  function runTo(lesson, k) {
    const { lock, S } = makeLock(lesson);
    const h = 1 / 60;
    for (let s = 0; s <= k; s++) {
      for (const a of lesson.steps[s].run) {
        const from = {}, to = {};
        if (a.tension !== undefined) { from.tension = S.tension; to.tension = a.tension; }
        if (a.db !== undefined) { from.lift = S.lift; to.lift = liftFor(lock, S, a.db); }
        for (const key of ['insert', 'shackle', 'shim', 'pull']) if (a[key] !== undefined) { from[key] = S[key]; to[key] = a[key]; }
        if (a.turn) S.turned = lock.pins.every((_, i) => lock.pinState(i).state === 'set');
        const dur = a.dur || a.wait || 0.3, n = Math.round(dur / h);
        let dial = null;
        if (a.dialSeq) {
          if (!S.path) S.path = lock.dialPath(lock.cfg.combo, lock.ctl.dialTarget);
          const targets = S.path.slice(S.comboIdx, a.dialSeq);
          let total = 0, prev = lock.ctl.dialTarget; for (const t of targets) { total += Math.abs(t - prev); prev = t; }
          dial = { targets, speed: total / dur, pause: 0 };
        }
        for (let i = 1; i <= n || (dial && (dial.targets.length || dial.pause > 0)); i++) {
          const f = Math.min(1, i / n), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
          for (const key in to) S[key] = from[key] + (to[key] - from[key]) * e;
          if (dial) {
            if (dial.pause > 0) dial.pause -= h;
            else if (dial.targets.length) {
              const t = dial.targets[0], d = t - lock.ctl.dialTarget, b = dial.speed * h;
              if (Math.abs(d) <= b) { lock.ctl.dialTarget = t; dial.targets.shift(); dial.pause = 0.45; S.comboIdx++; }
              else lock.ctl.dialTarget += Math.sign(d) * b;
            }
          }
          apply(lesson, lock, S); lock.step(h);
          if (i > 6000) break;
        }
      }
    }
    for (let i = 0; i < 20; i++) { apply(lesson, lock, S); lock.step(h); }
    return { lock, S };
  }

  // ------------------------------------------------------------ drawing
  function prep(canvas, bounds, pad = 10) {
    const ctx = canvas.getContext('2d');
    const v = R.fitView(canvas, bounds, pad);
    R.screenT(ctx, v); ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card'); ctx.fillRect(0, 0, v.w, v.h);
    return { ctx, v };
  }
  function drawPinPanel(canvas, lesson, k, lockState) {
    const { lock } = lockState, g = lock.geom;
    const { ctx, v } = prep(canvas, { x0: g.xMin - 30, x1: g.xMax + 40, y0: g.yTop - 30, y1: g.Kf + 4 });
    R.drawPinLock(ctx, lock, v, { poster: true });
    const C = R.readColors(); R.screenT(ctx, v);
    // ring the catch point when a security pin is caught
    const st = lock.pinState(0), p = lock.pins[0];
    if (st.state === 'caught') {
      const P = R.toS(v, lock.plug.x + p.x + p.offset - g.W / 2 - g.clr, 0);
      ctx.strokeStyle = C.rose; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(P.x, P.y, 12, 0, Math.PI * 2); ctx.stroke();
    }
    const kind = (ARROWS[lesson.id] || ['lift', 'lift', 'plug'])[k];
    const ax = R.toS(v, g.xMax + 20, 0).x;
    if (kind === 'lift') {
      const a = R.toS(v, 0, g.Pb * 0.55), b = R.toS(v, 0, g.Pb * 0.2);
      R.arrow(ctx, ax, a.y, ax, b.y, C.teal, 2, 7);
      R.label(ctx, 'lift', ax, a.y + 14, { align: 'center', color: C.teal, size: 9.5, weight: 600 });
    } else {
      const y = R.toS(v, 0, g.Kf - 20).y, dir = kind === 'plug' ? 1 : -1;
      R.arrow(ctx, ax - 18 * dir, y, ax + 18 * dir, y, C.teal, 2, 7);
      R.label(ctx, kind === 'plug' ? 'plug moves' : 'turns back', ax, y + 14, { align: 'center', color: C.teal, size: 9.5, weight: 600 });
    }
  }
  function drawKeyPanel(canvas, lesson, ls, tall) {
    const { lock, S } = ls, g = lock.geom;
    const { ctx, v } = prep(canvas, { x0: g.xMin - 70, x1: g.xMax + 26, y0: g.yTop - 40, y1: g.Kf + 6 }, 14);
    R.drawPinLock(ctx, lock, v, { poster: true });
    R.screenT(ctx, v);
    const r = tall ? 46 : 30;
    R.drawFrontInset(ctx, v.w - r - 14, r + 14, r, S.turned ? Math.PI / 2 : 0, !S.turned);
  }
  function drawComboPanel(canvas, ls) {
    const { lock } = ls, R0 = lock.cfg.R;
    const { ctx, v } = prep(canvas, { x0: -R0 - 62, x1: R0 + 96, y0: lock.cy(0) - R0 - 10, y1: lock.cy(2) + R0 + 10 });
    R.drawCombo(ctx, lock, v, { shackleLift: lock.isOpen() ? 34 : 0, poster: true });
  }
  function drawDial(canvas, ls) {
    const { lock } = ls;
    const ctx = canvas.getContext('2d');
    const v = R.fitView(canvas, { x0: -360, x1: -160, y0: -232, y1: 130 }, 4);
    R.drawCombo(ctx, lock, v, { dialOnly: true });
  }
  function draw3D(canvas, ls) {
    const ctx = canvas.getContext('2d'), d = window.devicePixelRatio, w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * d; canvas.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    R.readColors();
    const sc = Math.min(w, h) / 190;
    R.drawCombo3D(ctx, ls.lock, w * 0.56, h * 0.5, sc, { fontSize: 9, axleLabel: false });
  }
  function drawShimPanel(canvas, ls) {
    const { lock } = ls, g = lock.geom;
    const { ctx, v } = prep(canvas, { x0: -70, x1: g.wallX + 26, y0: -150, y1: g.bodyBot + 6 });
    R.drawShim(ctx, lock, v, {});
  }

  // ------------------------------------------------------------- layout
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function shell(o, body) {
    return `<section class="poster t-${o.type}"><div class="bar"></div><div class="in">
      <div class="krow"><span class="k">${esc(o.kicker)}</span><span class="n">${esc(o.num || '')}</span></div>
      <h1${o.title.length > 24 ? ' style="font-size:38px"' : ''}>${esc(o.title)}</h1><p class="sub">${esc(o.subtitle)}</p>${body}
      ${o.note ? `<p class="note">${esc(o.note)}</p>` : ''}</div>
      <div class="foot"><b>${SAFETY}</b><div class="s2">${SAFETY2}</div><div class="r">${esc(o.refs)}</div><div class="made">${MADE}</div></div></section>`;
  }
  const legendHtml = l => l ? `<div class="legend">${l.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}</div>` : '';
  const panelsHtml = (id, steps) => `<div class="panels">${steps.map((s, i) => `<div class="panel"><h4><span class="k">${i + 1}</span>${esc(s.title)}</h4><canvas id="${id}-${i}"></canvas><p>${esc(s.caption)}</p></div>`).join('')}</div>`;
  const textHtml = (o) => `
    ${o.feel ? `<div class="two"><div><h3>${o.feelLabel || 'WHAT YOU MAY FEEL'}</h3><p>${esc(o.feel)}</p></div><div><h3>${o.helpsLabel || 'WHAT HELPS'}</h3><p>${esc(o.helps)}</p></div></div>` : ''}
    ${o.remember ? `<div class="remember"><h3>REMEMBER</h3><p>${esc(o.remember)}</p></div>` : ''}`;

  // the 11 original posters
  const POSTERS = [
    { id: 'how', base: 'how', type: 'hero-key', note: 'Side cutaway with the pins drawn above the key, and the gaps drawn wider than real. The circle shows the plug from the front.' },
    { id: 'meet', base: 'meet', type: 'table' },
    {
      id: 'falseset-basics', base: 'falseset', type: 'hero-falseset', remember: null, feelLabel: 'WHAT YOU FEEL',
      note: 'Side view. The tilt and the offset between the holes are drawn bigger so you can see the catch.',
    },
    { id: 'standard', base: 'standard', type: 'panels' },
    { id: 'spool', base: 'spool', type: 'panels' },
    { id: 'serrated', base: 'serrated', type: 'panels' },
    { id: 'mushroom', base: 'mushroom', type: 'panels' },
    { id: 'hybrid', base: 'hybrid', type: 'panels' },
    {
      id: 'falseset', base: 'falseset', type: 'panels', kicker: 'MEET THE LOCK', num: '06 / 06',
      subtitle: 'The plug turns a bit, then stops dead. Something inside is caught.',
      feel: 'The plug goes further than it did, but won\'t turn all the way. Lifting a stuck spool can push the plug back.',
      helps: 'Lift slowly and let the plug turn back a little. Pins you already set might drop, so check them again.',
      note: 'Side view. The plug\'s turn is shown as a sideways shift, and the gaps and tilt are drawn bigger than they really are.',
      refs: 'References: MIT Guide to Lock Picking, chapters 4-5 and 9.9; Lockwiki, Security pin.',
    },
    { id: 'combo', base: 'combo', type: 'combo', note: 'A generic wheel-and-fence lock, not a particular model. Gaps are drawn wider than real.' },
    { id: 'shim', base: 'shim', type: 'shim', note: 'One latch design shown. Lots of padlocks are built differently.' },
  ];

  function build(P) {
    const L = byId[P.base];
    const o = Object.assign({}, L, P);
    const root = document.getElementById('root');
    const wrap = document.createElement('div');
    let body = '';
    if (P.type === 'panels') body = legendHtml(L.legend) + panelsHtml(P.id, L.steps) + textHtml(o);
    else if (P.type === 'hero-key') {
      body = `<div class="hero"><canvas id="${P.id}-hero"></canvas></div>
        <h3 style="margin-top:7mm">CORRECT KEY INSERTED</h3><p class="lead2">With the right key, every pin stack splits exactly at the shear line.</p>
        <div class="cards">${L.cards.map(c => `<div><h4><span class="k" style="color:${c.color}">${c.n}</span>${esc(c.title)}</h4><p>${esc(c.text)}</p></div>`).join('')}</div>`;
    } else if (P.type === 'hero-falseset') {
      body = `<div class="hero tall"><canvas id="${P.id}-hero"></canvas></div>` + textHtml(o);
    } else if (P.type === 'table') {
      body = `<p class="lead">${esc(L.intro)}</p><table class="meet"><tr><th></th><th>HOW IT WORKS</th><th>WHAT YOU MAY FEEL</th><th>WHAT HELPS</th></tr>
        ${L.rows.map(r => `<tr><td><div class="nm">${Locks.PIN_TYPES[r.type].label.toUpperCase()}</div><canvas data-icon="${r.type}"></canvas></td><td>${esc(r.how)}</td><td>${esc(r.feel)}</td><td>${esc(r.helps)}</td></tr>`).join('')}</table>
        <p class="note" style="font-size:14px">${esc(L.note)}</p>`;
      o.note = '';
    } else if (P.type === 'combo') {
      body = `<div class="comborow"><canvas id="${P.id}-dial"></canvas><canvas id="${P.id}-3d" class="c3d"></canvas><div><h3>ONE DIAL, SEVERAL WHEELS</h3>
        <p class="lead2">As you turn the dial it picks up the wheels one after another. Reversing direction lets you move one wheel without disturbing the last one.</p>
        <p class="lead2" style="color:var(--muted);font-size:12.5px">Underneath, the same wheels are drawn apart so you can see every gate.</p></div></div>`
        + panelsHtml(P.id, L.steps) + textHtml(o);
    } else if (P.type === 'shim') {
      body = `<h3 style="margin-top:10mm">WHAT THE METAL ACTUALLY MOVES</h3><p class="lead2" style="margin-bottom:8mm">${esc(L.intro)}</p>` + panelsHtml(P.id, L.steps) + textHtml(o);
    }
    wrap.innerHTML = shell(o, body);
    root.appendChild(wrap.firstElementChild);

    // render images from the simulation
    if (P.type === 'panels') L.steps.forEach((_, k) => {
      const cv = document.getElementById(`${P.id}-${k}`), ls = runTo(L, k);
      if (L.kind === 'pin') drawPinPanel(cv, { id: P.base }, k, ls);
    });
    if (P.type === 'hero-key') drawKeyPanel(document.getElementById(`${P.id}-hero`), L, runTo(L, 2), true);
    if (P.type === 'hero-falseset') {
      const ls = runTo(L, 1), cv = document.getElementById(`${P.id}-hero`);
      const { ctx, v } = prep(cv, R.pinBounds(ls.lock), 18);
      R.drawPinLock(ctx, ls.lock, v, { annotate: true });
      const C = R.readColors(); R.screenT(ctx, v);
      R.label(ctx, 'SPOOL DRIVER', 20, v.h - 16, { color: C.mustard, size: 14 });
      R.label(ctx, 'KEY PIN', 170, v.h - 16, { color: C.teal, size: 14 });
    }
    if (P.type === 'table') document.querySelectorAll('canvas[data-icon]').forEach(cv => {
      if (cv.dataset.done) return; cv.dataset.done = 1;
      const c2 = cv.getContext('2d'), d = 3, w = cv.clientWidth, h = cv.clientHeight;
      cv.width = w * d; cv.height = h * d; c2.setTransform(d, 0, 0, d, 0, 0); R.readColors();
      R.pinIcon(c2, cv.dataset.icon, w / 2, h / 2, h - 8);
    });
    if (P.type === 'combo') {
      L.steps.forEach((_, k) => drawComboPanel(document.getElementById(`${P.id}-${k}`), runTo(L, k)));
      drawDial(document.getElementById(`${P.id}-dial`), makeLock(L));
      draw3D(document.getElementById(`${P.id}-3d`), runTo(L, 1));
    }
    if (P.type === 'shim') L.steps.forEach((_, k) => drawShimPanel(document.getElementById(`${P.id}-${k}`), runTo(L, k)));
  }

  R.readColors();
  const want = new URLSearchParams(location.search).get('p');
  if (want) document.body.classList.add('single');
  for (const P of POSTERS) if (!want || want === P.id) build(P);
})();
