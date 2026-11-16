/*
 * LockLab app: lesson pages, controls, autopilot for poster steps, graphs.
 */
(function () {
  'use strict';
  const { LESSONS, NAV } = window.Lessons;
  const R = window.Render, Locks = window.Locks;
  const byId = new Map(LESSONS.map(l => [l.id, l]));
  const $ = id => document.getElementById(id);
  const canvas = $('sim'), ctx = canvas.getContext('2d');
  const gCanvas = $('graph'), gctx = gCanvas.getContext('2d');
  const sCanvas = $('strip'), sctx = sCanvas.getContext('2d');

  const opts = { overlay: false, slow: false, sound: true };
  let lesson = null, lock = null, view = null;
  let S = {};             // per-lesson control state
  let auto = null;        // autopilot
  let hist = [], strip = [];
  let frame = 0;

  const ls = {
    get(k, d) { try { const v = localStorage.getItem('locklab.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('locklab.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  // ---------------------------------------------------------------- sound
  let actx = null;
  let userActed = false;
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { userActed = true; }, { once: true, capture: true }));
  function click(strength = 1, freq = 2600) {
    if (!opts.sound || !userActed) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime, len = 0.03;
      const buf = actx.createBuffer(1, Math.ceil(actx.sampleRate * len), actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.12));
      const src = actx.createBufferSource(); src.buffer = buf;
      const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3;
      const g = actx.createGain(); g.gain.value = 0.5 * strength;
      src.connect(f); f.connect(g); g.connect(actx.destination); src.start(t);
    } catch (e) { /* audio unavailable */ }
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------------ nav
  function buildNav() {
    const el = $('navlist'); el.innerHTML = '';
    for (const g of NAV) {
      const h = document.createElement('div'); h.className = 'nav-group'; h.textContent = g.group; el.appendChild(h);
      for (const it of g.items) {
        const [id, text] = Array.isArray(it) ? it : [it, null];
        const l = byId.get(id);
        const b = document.createElement('button'); b.className = 'nav-item'; b.dataset.id = id;
        const num = text ? text.split(' ')[0] : (l.num.split(' / ')[0]);
        b.innerHTML = `<span class="n">${num}</span>${text ? text.slice(num.length + 1) : l.title}`;
        b.onclick = () => { location.hash = id; if (lesson && lesson.id === id) load(id); };
        el.appendChild(b);
      }
    }
  }

  // ------------------------------------------------------------- lessons
  function load(id) {
    lesson = byId.get(id) || LESSONS[0];
    document.querySelectorAll('.nav-item').forEach(b => b.setAttribute('aria-current', b.dataset.id === lesson.id ? 'true' : 'false'));
    $('kicker').textContent = lesson.kicker; $('pnum').textContent = lesson.num;
    $('title').textContent = lesson.title; $('subtitle').textContent = lesson.subtitle;
    $('intro').hidden = !lesson.intro; $('intro').textContent = lesson.intro || '';
    $('legend').innerHTML = (lesson.legend || []).map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('');
    $('feel').textContent = lesson.feel || ''; $('helps').textContent = lesson.helps || '';
    $('helpsLabel').textContent = lesson.helpsLabel || 'WHAT HELPS';
    $('twocol').hidden = !lesson.feel;
    $('rememberBox').hidden = !lesson.remember; $('remember').textContent = lesson.remember || '';
    $('physics').hidden = !lesson.physics; $('physicsBody').innerHTML = lesson.physics || '';
    $('note').textContent = lesson.note || ''; $('refs').textContent = lesson.refs || '';
    $('cards').hidden = !lesson.cards;
    if (lesson.cards) $('cards').innerHTML = lesson.cards.map(c => `<div><h4><span class="k" style="color:${c.color}">${c.n}</span>${c.title}</h4><p>${c.text}</p></div>`).join('');
    const gallery = lesson.kind === 'gallery';
    $('gallery').hidden = !gallery; $('stage').hidden = gallery;
    if (gallery) { buildGallery(); lock = null; }
    else { S = {}; buildScene(); buildControls(); }
    buildSteps();
    document.title = lesson.title + ' · LockLab';
    window.scrollTo({ top: 0 });
  }

  function makeChallengeScene() {
    const mode = S.difficulty || ls.get('difficulty', 'standard');
    S.difficulty = mode;
    const offs = [-2.6, -1.3, 0, 1.3, 2.6].map(o => o + (Math.random() - 0.5) * 0.5).sort(() => Math.random() - 0.5);
    const types = ['standard', 'spool', 'serrated', 'mushroom', 'hybrid'];
    const pins = offs.map(o => ({
      type: mode === 'standard' ? 'standard' : mode === 'security' ? types[Math.floor(Math.random() * types.length)] : (Math.random() < 0.4 ? types[1 + Math.floor(Math.random() * 4)] : 'standard'),
      keyLen: 44 + Math.round(Math.random() * 34), offset: +o.toFixed(2),
    }));
    return { pins };
  }

  function buildScene() {
    hist = []; strip = []; auto = null;
    const k = lesson.kind;
    if (k === 'pin') {
      const scene = lesson.challenge ? (S.challengeScene = makeChallengeScene()) : lesson.scene;
      lock = Locks.buildPinLock(scene); lock.settle(0.8);
      S.tension = 0; S.lift = 0; S.col = 0;
      const restY = lock.ctl.pickRestY;
      let minY = Infinity;
      lock.pins.forEach((_, i) => { minY = Math.min(minY, lock.pickYFor(i, -10)); });
      S.liftRange = [restY, minY];
      S.prevPlugX = lock.plug.x; S.lastClick = 0;
      lock.pins.forEach(p => { p.key.data.rest0 = p.key.bottom(); });
      canvas.classList.remove('dial');
      $('hint').textContent = lock.n > 1
        ? 'Drag up/down on the lock to lift · click a column or press 1-5 to move the pick · [ and ] set tension'
        : 'Drag up/down on the lock (or ↑ ↓) to lift · [ and ] or the slider set tension';
    } else if (k === 'key') {
      lock = Locks.buildPinLock(Object.assign({ mode: 'key' }, lesson.scene));
      S.correct = lesson.scene.pins.map(p => p.keyLen);
      S.keyChoice = 'correct'; S.insert = 0; S.turn = 0; S.turnTarget = 0; S.blocked = [];
      lock.setKeyCuts(S.correct); lock.setKeyInsertion(0);
      lock.key.x = lock.key.data.entrance; lock.key.updateWorld();
      lock.settle(0.6);
      canvas.classList.remove('dial');
      $('hint').textContent = 'Drag left/right on the lock to slide the key · Turn tries the plug';
    } else if (k === 'combo') {
      lock = Locks.buildComboLock(lesson.scene); lock.settle();
      S.shackle = 0; S.shackleLift = 0; S.comboIdx = 0; S.path = null; S.lastNum = 0;
      S.seqLog = [];
      canvas.classList.add('dial');
      $('hint').textContent = 'Drag around the dial to turn it · ← → step one number (Shift: five) · hold P to pull the shackle';
    } else if (k === 'shim') {
      S.shielded = S.shielded || false; S.deadlocked = S.deadlocked || false;
      lock = Locks.buildShimLock({ shielded: S.shielded, deadlocked: S.deadlocked }); lock.settle();
      S.shim = 0; S.pull = 0;
      canvas.classList.remove('dial');
      $('hint').textContent = 'Drag up/down on the lock to move the shim · slider pulls the shackle';
    }
  }

  // ------------------------------------------------------------ controls
  function slider(id, labelText, value, min, max, fmt, oninput) {
    const w = document.createElement('div'); w.className = 'ctl';
    w.innerHTML = `<label for="${id}">${labelText}<output id="${id}Out"></output></label><input type="range" id="${id}" min="${min}" max="${max}" value="${value}">`;
    const inp = w.querySelector('input'), out = w.querySelector('output');
    const upd = () => { out.textContent = fmt(+inp.value); };
    inp.addEventListener('input', () => { cancelAuto(); oninput(+inp.value); upd(); });
    upd();
    w.set = v => { inp.value = v; upd(); };
    return w;
  }
  function button(text, cls, fn) { const b = document.createElement('button'); b.className = 'b ' + (cls || ''); b.textContent = text; b.onclick = fn; return b; }
  function btnRow(...els) { const d = document.createElement('div'); d.className = 'btns'; els.forEach(e => d.appendChild(e)); return d; }

  const UI = {};
  function buildControls() {
    const c = $('controls'); c.innerHTML = '';
    const k = lesson.kind;
    if (k === 'pin') {
      UI.tension = slider('tension', 'TURNING PRESSURE', 0, 0, 100, v => v + '%', v => { S.tension = v / 100; });
      UI.lift = slider('lift', 'LIFT', 0, 0, 1000, v => Math.round(v / 10) + '%', v => { S.lift = v / 1000; });
      c.append(UI.tension, UI.lift);
      if (lock.n > 1) {
        const pinBtns = lock.pins.map((p, i) => button(String(i + 1), 'pin', () => { cancelAuto(); selectPin(i); }));
        UI.pinBtns = pinBtns;
        const w = document.createElement('div'); w.className = 'ctl'; w.style.flex = '0 1 auto';
        w.innerHTML = '<label>PICK UNDER PIN</label>'; w.appendChild(btnRow(...pinBtns)); c.appendChild(w);
      }
      const row = btnRow(button('Release & reset', '', () => { cancelAuto(); resetPin(); }));
      if (lesson.challenge) {
        const sel = document.createElement('select'); sel.className = 'b';
        sel.innerHTML = '<option value="standard">Standard pins</option><option value="mixed">Some security pins</option><option value="security">All security pins</option>';
        sel.value = S.difficulty || ls.get('difficulty', 'standard');
        sel.onchange = () => { S.difficulty = sel.value; ls.set('difficulty', sel.value); newChallenge(); };
        row.appendChild(button('New lock', 'primary', newChallenge));
        row.appendChild(sel);
        UI.blind = button('Blind mode', '', () => { S.blind = !S.blind; UI.blind.classList.toggle('on', S.blind); });
        UI.offs = button('Show offsets', '', () => { S.showOffsets = !S.showOffsets; UI.offs.classList.toggle('on', S.showOffsets); });
        row.append(UI.blind, UI.offs);
        S.startTime = performance.now(); S.solvedAt = null;
      }
      c.appendChild(row);
      if (UI.pinBtns) selectPin(0);
    } else if (k === 'key') {
      UI.insert = slider('insert', 'INSERT KEY', 0, 0, 1000, v => Math.round(v / 10) + '%', v => { S.insert = v / 1000; S.turnTarget = 0; });
      c.appendChild(UI.insert);
      const sel = document.createElement('select'); sel.className = 'b';
      sel.innerHTML = '<option value="correct">Correct key</option><option value="wrong">Wrong key</option><option value="blank">Uncut blank</option>';
      sel.onchange = () => { cancelAuto(); setKey(sel.value); };
      UI.keySel = sel;
      c.appendChild(btnRow(sel, button('Turn the key', 'primary', () => { cancelAuto(); tryTurn(); }), button('Reset', '', () => { cancelAuto(); buildScene(); UI.insert.set(0); sel.value = 'correct'; })));
    } else if (k === 'combo') {
      UI.shackle = slider('shackle', 'PULL SHACKLE', 0, 0, 100, v => v + '%', v => { S.shackle = v / 100; });
      c.appendChild(UI.shackle);
      c.appendChild(btnRow(
        button('◀ Left 1', '', () => { cancelAuto(); nudgeDial(-1); }),
        button('Right 1 ▶', '', () => { cancelAuto(); nudgeDial(1); }),
        button('Reset', '', () => { cancelAuto(); buildScene(); UI.shackle.set(0); renderComboGuide(); }),
      ));
      const g = document.createElement('div'); g.className = 'combo-guide'; g.id = 'comboGuide'; c.appendChild(g);
      renderComboGuide();
    } else if (k === 'shim') {
      UI.shim = slider('shim', 'SHIM DEPTH', 0, 0, 1000, v => Math.round(v / 10) + '%', v => { S.shim = v / 1000; });
      UI.pull = slider('pull', 'PULL SHACKLE', 0, 0, 100, v => v + '%', v => { S.pull = v / 100; });
      c.append(UI.shim, UI.pull);
      const t1 = button('Shielded latch', S.shielded ? 'on' : '', () => { S.shielded = !S.shielded; cancelAuto(); buildScene(); buildControls(); });
      const t2 = button('Deadlocked latch', S.deadlocked ? 'on' : '', () => { S.deadlocked = !S.deadlocked; cancelAuto(); buildScene(); buildControls(); });
      c.appendChild(btnRow(t1, t2, button('Reset', '', () => { cancelAuto(); buildScene(); UI.shim.set(0); UI.pull.set(0); })));
    }
  }

  function selectPin(i) {
    if (!lock.pick) return;
    S.col = i; lock.ctl.pickColTarget = i; S.lift = 0; if (UI.lift) UI.lift.set(0);
    hist = [];
    if (UI.pinBtns) UI.pinBtns.forEach((b, j) => b.classList.toggle('on', j === i));
  }
  function resetPin() {
    S.tension = 0; S.lift = 0; UI.tension.set(0); UI.lift.set(0);
    if (lesson.challenge) { lock = Locks.buildPinLock(S.challengeScene); lock.settle(0.8); selectPin(S.col || 0); S.startTime = performance.now(); S.solvedAt = null; }
    else buildScene();
    hist = []; strip = [];
  }
  function newChallenge() { cancelAuto(); buildScene(); buildControls(); }

  function setKey(choice) {
    S.keyChoice = choice; S.turnTarget = 0;
    let cuts = S.correct.slice();
    if (choice === 'wrong') cuts = cuts.map((c, i) => { const w = S.correct[(i + 2) % cuts.length]; return w !== c ? w : c - 8; });
    if (choice === 'blank') cuts = cuts.map(() => Math.max(...S.correct) + 8);
    lock.setKeyCuts(cuts);
  }
  function canTurn() { return lock.pins.every((_, i) => lock.pinState(i).state === 'set'); }
  function tryTurn() {
    const ok = canTurn();
    S.blocked = lock.pins.map((_, i) => lock.pinState(i).state !== 'set');
    S.turnTarget = ok ? Math.PI / 2 : 0.06;
    S.turnBounce = ok ? 0 : 0.5;
    if (ok) click(1, 1800);
  }

  // ------------------------------------------------------------ combo help
  function renderComboGuide() {
    const el = $('comboGuide'); if (!el) return;
    const [a, b, c] = lock.cfg.combo;
    const done = S.comboIdx || 0;
    const li = (i, html) => `<li class="${done > i ? 'done' : ''}">${html}</li>`;
    el.innerHTML = `Practice combination <b>${a} – ${b} – ${c}</b>. This model dials like a common padlock:<ol>
      ${li(0, `Turn <b>right</b> (clockwise) at least two full turns, stopping at <b>${a}</b>.`)}
      ${li(1, `Turn <b>left</b> one full turn past <b>${b}</b>, then stop at <b>${b}</b>.`)}
      ${li(2, `Turn <b>right</b> to <b>${c}</b>.`)}
      ${li(3, 'Pull the shackle.')}</ol>`;
  }
  function nudgeDial(steps) {
    // "right" = clockwise = positive angle
    lock.ctl.dialTarget += steps * (Math.PI * 2 / lock.cfg.numbers);
  }

  // ---------------------------------------------------------------- steps
  function buildSteps() {
    const el = $('steps'); el.innerHTML = '';
    el.hidden = !lesson.steps || !lesson.steps.length;
    (lesson.steps || []).forEach((s, i) => {
      const b = document.createElement('button'); b.className = 'step';
      b.innerHTML = `<h4><span class="k">${i + 1}</span>${s.title}</h4><p>${s.caption}</p><div class="play">▶ PLAY IN THE SIMULATOR</div>`;
      b.onclick = () => runStep(i);
      el.appendChild(b);
    });
  }
  function markStep(i) { document.querySelectorAll('.step').forEach((b, j) => b.classList.toggle('active', j === i)); }

  function runStep(i) {
    // reset, then play steps 1..i in order (earlier ones at double speed)
    const keepShim = lesson.kind === 'shim';
    if (lesson.challenge) return;
    if (!keepShim) { S = {}; }
    buildScene(); buildControls();
    const queue = [];
    for (let k = 0; k <= i; k++) for (const a of lesson.steps[k].run) queue.push(Object.assign({ fast: k < i }, a));
    auto = { queue, cur: null, t: 0, step: i };
    markStep(i);
    document.querySelector('.sim-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function cancelAuto() { if (auto) { auto = null; markStep(-1); } }

  function liftForDb(db) {
    const col = S.col || 0;
    let y;
    if (db === 'rest') y = lock.ctl.pickRestY;
    else if (db === 'touch') y = lock.pins[col].key.bottom() - 1;
    else y = lock.pickYFor(col, db);
    const [r0, r1] = S.liftRange;
    return Math.max(0, Math.min(1, (r0 - y) / (r0 - r1)));
  }

  function stepAuto(dt) {
    if (!auto) return;
    if (!auto.cur) {
      const a = auto.queue.shift();
      if (!a) { auto = null; return; }
      const from = {}, to = {};
      if (a.tension !== undefined) { from.tension = S.tension; to.tension = a.tension; }
      if (a.db !== undefined) { from.lift = S.lift; to.lift = liftForDb(a.db); }
      if (a.insert !== undefined) { from.insert = S.insert; to.insert = a.insert; }
      if (a.shackle !== undefined) { from.shackle = S.shackle; to.shackle = a.shackle; }
      if (a.shim !== undefined) { from.shim = S.shim; to.shim = a.shim; }
      if (a.pull !== undefined) { from.pull = S.pull; to.pull = a.pull; }
      if (a.turn) tryTurn();
      if (a.dialSeq) {
        if (!S.path) S.path = lock.dialPath(lock.cfg.combo, lock.ctl.dialTarget);
        const targets = S.path.slice(S.comboIdx || 0, a.dialSeq);
        let total = 0, prev = lock.ctl.dialTarget;
        for (const t of targets) { total += Math.abs(t - prev); prev = t; }
        auto.dial = { targets, speed: total / ((a.dur || 1) * (a.fast ? 0.5 : 1)) };
      } else auto.dial = null;
      auto.cur = { a, from, to, dur: (a.dur || a.wait || 0.3) * (a.fast ? 0.5 : 1) };
      auto.t = 0;
    }
    const { from, to, dur, a } = auto.cur;
    auto.t += dt;
    const f = Math.min(1, auto.t / dur);
    const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    for (const k in to) S[k] = from[k] + (to[k] - from[k]) * e;
    if (auto.dial) {
      const d = auto.dial;
      let budget = d.speed * dt;
      // pause briefly on each number so the dial really arrives before reversing
      if (d.pause > 0) { d.pause -= dt; budget = 0; }
      while (budget > 0 && d.targets.length) {
        const t = d.targets[0], diff = t - lock.ctl.dialTarget;
        if (Math.abs(diff) <= budget) { lock.ctl.dialTarget = t; budget = 0; d.targets.shift(); d.pause = 0.45; S.comboIdx = (S.comboIdx || 0) + 1; }
        else { lock.ctl.dialTarget += Math.sign(diff) * budget; budget = 0; }
      }
      if (!d.targets.length && d.pause > 0) { auto.t = Math.min(auto.t, dur - 1e-3); }
      if (d.targets.length) { auto.t = Math.min(auto.t, dur - 1e-3); }
    }
    syncSliders();
    if (f >= 1 && (!auto.dial || !auto.dial.targets.length)) auto.cur = null;
    void a;
  }
  function syncSliders() {
    if (UI.tension && S.tension !== undefined && lesson.kind === 'pin') UI.tension.set(Math.round(S.tension * 100));
    if (UI.lift && lesson.kind === 'pin') UI.lift.set(Math.round(S.lift * 1000));
    if (UI.insert && lesson.kind === 'key') UI.insert.set(Math.round(S.insert * 1000));
    if (UI.shackle && lesson.kind === 'combo') UI.shackle.set(Math.round(S.shackle * 100));
    if (lesson.kind === 'shim') { UI.shim.set(Math.round(S.shim * 1000)); UI.pull.set(Math.round(S.pull * 100)); }
  }

  // ------------------------------------------------------------- pointer
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (!lock || !view) return;
    canvas.setPointerCapture(e.pointerId);
    const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const w = R.toW(view, sx, sy);
    drag = { sx, sy, lift: S.lift, insert: S.insert, shim: S.shim, moved: false, w };
    if (lesson.kind === 'combo') drag.ang = Math.atan2(w.y - 0, w.x - (-260));
    cancelAuto();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const dy = sy - drag.sy, dx = sx - drag.sx;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (lesson.kind === 'pin') {
      const unitsPerPx = 1 / view.s, range = S.liftRange[0] - S.liftRange[1];
      S.lift = Math.max(0, Math.min(1, drag.lift - dy * unitsPerPx * 0.6 / range));
      syncSliders();
    } else if (lesson.kind === 'key') {
      S.insert = Math.max(0, Math.min(1, drag.insert + dx / (canvas.clientWidth * 0.7))); S.turnTarget = 0; syncSliders();
    } else if (lesson.kind === 'shim') {
      S.shim = Math.max(0, Math.min(1, drag.shim + dy / (canvas.clientHeight * 0.6))); syncSliders();
    } else if (lesson.kind === 'combo') {
      const w = R.toW(view, sx, sy);
      const a = Math.atan2(w.y, w.x + 260);
      let d = a - drag.ang; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      lock.ctl.dialTarget += d; drag.ang = a;
    }
  });
  const endDrag = e => {
    if (drag && !drag.moved && lesson.kind === 'pin' && lock.n > 1) {
      // click: choose the nearest column
      let best = 0, bd = Infinity;
      lock.pins.forEach((p, i) => { const d = Math.abs(p.x - drag.w.x); if (d < bd) { bd = d; best = i; } });
      selectPin(best);
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', e => {
    if (lesson.kind !== 'pin') return;
    e.preventDefault(); cancelAuto();
    S.lift = Math.max(0, Math.min(1, S.lift - e.deltaY * 0.0004)); syncSliders();
  }, { passive: false });

  // ------------------------------------------------------------ keyboard
  const keys = new Set();
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (!lock) return;
    const k = e.key;
    if (lesson.kind === 'pin') {
      if (k === 'Shift') keys.add(k);
      if (k === 'ArrowUp' || k === 'ArrowDown') { keys.add(k); e.preventDefault(); cancelAuto(); }
      else if (k === '[' || k === ']') { S.tension = Math.max(0, Math.min(1, S.tension + (k === ']' ? 0.05 : -0.05))); cancelAuto(); syncSliders(); }
      else if (/^[1-9]$/.test(k) && lock.n > 1 && +k <= lock.n) { cancelAuto(); selectPin(+k - 1); }
      else if ((k === 'ArrowLeft' || k === 'ArrowRight') && lock.n > 1) { e.preventDefault(); cancelAuto(); selectPin(Math.max(0, Math.min(lock.n - 1, S.col + (k === 'ArrowRight' ? 1 : -1)))); }
    } else if (lesson.kind === 'combo') {
      if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); cancelAuto(); nudgeDial((k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1)); }
      else if (k === 'p' || k === 'P') { S.shackle = 1; syncSliders(); }
    } else if (lesson.kind === 'key') {
      if (k === 't' || k === 'T') tryTurn();
    }
  });
  window.addEventListener('keyup', e => {
    keys.delete(e.key);
    if (lesson && lesson.kind === 'combo' && (e.key === 'p' || e.key === 'P')) { S.shackle = 0; syncSliders(); }
  });
  function applyKeys(dt) {
    if (lesson.kind !== 'pin') return;
    const rate = keys.has('Shift') ? 0.05 : 0.18;
    if (keys.has('ArrowUp')) S.lift = Math.min(1, S.lift + rate * dt);
    if (keys.has('ArrowDown')) S.lift = Math.max(0, S.lift - rate * 1.5 * dt);
    if (keys.size) syncSliders();
  }

  // ---------------------------------------------------------------- sim
  function applyControls() {
    const k = lesson.kind;
    if (k === 'pin') {
      lock.ctl.tension = S.tension;
      const [r0, r1] = S.liftRange;
      if (Math.abs(lock.ctl.pickColTarget - lock.ctl.pickCol) < 1e-4) lock.ctl.pickYUser = r0 + (r1 - r0) * S.lift;
    } else if (k === 'key') {
      lock.setKeyInsertion(S.insert);
    } else if (k === 'combo') {
      lock.ctl.shackle = S.shackle;
    } else if (k === 'shim') {
      const g = lock.geom;
      lock.ctl.shimY = -80 + (g.latchY + g.latchH / 2 + 6 + 80) * S.shim;
      lock.ctl.pull = S.pull;
    }
  }

  function afterStep(dt) {
    const k = lesson.kind;
    if (k === 'pin') {
      // a click when the plug jumps forward (a pin setting or a groove catching)
      const dx = lock.plug.x - S.prevPlugX;
      S.lastClick += dt;
      if (dx > 0.22 && S.lastClick > 0.12) { click(Math.min(1, dx / 1.5) * 0.9 + 0.1); S.lastClick = 0; }
      S.prevPlugX = lock.plug.x;
      if (lesson.challenge && lock.isOpen() && !S.solvedAt) { S.solvedAt = performance.now(); click(1, 1500); }
    } else if (k === 'key') {
      // turning animation for the front-view inset
      S.turn = S.turn || 0;
      if (S.turnBounce > 0) { S.turnBounce -= dt; if (S.turnBounce <= 0) S.turnTarget = 0; }
      S.turn += (S.turnTarget - S.turn) * Math.min(1, dt * 6);
      if (S.turnTarget > 1 && !canTurn()) S.turnTarget = 0;
    } else if (k === 'combo') {
      const n = lock.numAt(lock.dial.a);
      if (n !== S.lastNum) { click(0.18, 4200); S.lastNum = n; }
      S.shackleLift += ((lock.isOpen() ? 34 : 0) - S.shackleLift) * Math.min(1, dt * 8);
      // progress through the practice sequence
      trackCombo();
    }
  }

  function trackCombo() {
    // follow the user's dialling: wheels aligned in order tells us where they are
    const al = lock.wheels.map((_, i) => lock.wheelAligned(i));
    let idx = 0;
    if (al[0]) idx = 1;
    if (al[0] && al[1]) idx = 2;
    if (al[0] && al[1] && al[2]) idx = 3;
    if (lock.isOpen()) idx = 4;
    if (!auto && idx !== S.comboIdx) { S.comboIdx = idx; renderComboGuide(); }
    else if (auto && idx === 4 && S.comboIdx !== 4) { S.comboIdx = 4; renderComboGuide(); }
    else if (auto) renderComboGuideThrottled();
  }
  let lastGuide = 0;
  function renderComboGuideThrottled() { const t = performance.now(); if (t - lastGuide > 300) { lastGuide = t; renderComboGuide(); } }

  // ------------------------------------------------------------- graphs
  function record() {
    const k = lesson.kind;
    if (k === 'pin') {
      const p = lock.pins[S.col || 0];
      const st = lock.pinState(p.i);
      const rest = lock.ctl.pickRestY;
      const lift = p.key.data.rest0 - p.key.bottom();
      if (Math.abs(lock.ctl.pickColTarget - lock.ctl.pickCol) < 1e-4 && lock.pick.y < rest - 2) {
        hist.push({ x: lift, y: lock.pickForce(), s: st.state, b: st.binding });
        if (hist.length > 900) hist.shift();
      }
      strip.push([lock.plug.x, S.tension]);
    } else if (k === 'combo') {
      strip.push([lock.dialDrag(), Math.max(0, lock.cfg.R - lock.fence.x + 6)]);
    } else if (k === 'shim') {
      strip.push([lock.latch.x - lock.geom.latchRestX, -lock.shackle.y]);
    } else if (k === 'key') {
      strip.push([S.insert, 0]);
    }
    if (strip.length > 480) strip.shift();
  }

  function sizeCanvas(cv, c2) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }
  function axes(c2, w, h, xl, yl, C) {
    c2.clearRect(0, 0, w, h);
    c2.strokeStyle = C.line; c2.lineWidth = 1;
    c2.beginPath(); c2.moveTo(30, 6); c2.lineTo(30, h - 18); c2.lineTo(w - 4, h - 18); c2.stroke();
    R.label(c2, xl, w - 4, h - 4, { align: 'right', color: C.muted, size: 10, weight: 500 });
    c2.save(); c2.translate(11, 8); c2.rotate(-Math.PI / 2);
    R.label(c2, yl, 0, 0, { align: 'right', color: C.muted, size: 10, weight: 500, base: 'top' }); c2.restore();
  }

  function drawGraphs(C) {
    const k = lesson.kind;
    const { w, h } = sizeCanvas(gCanvas, gctx);
    const st = sizeCanvas(sCanvas, sctx);
    if (k === 'pin') {
      $('graphTitle').textContent = 'What you feel: pin ' + ((S.col || 0) + 1);
      $('graphLegend').innerHTML = '<span><i style="background:var(--muted)"></i>loose</span><span><i style="background:var(--rose)"></i>binding</span><span><i style="background:var(--mustard)"></i>false set</span><span><i style="background:var(--teal)"></i>set</span><span><i style="background:var(--ink)"></i>overset</span>';
      axes(gctx, w, h, 'lift →', 'force on the pick →', C);
      const xmax = 75, ymax = 1600;
      const X = x => 30 + (w - 36) * Math.max(0, x) / xmax, Y = y => (h - 18) - (h - 26) * Math.min(y, ymax) / ymax;
      // saturation line: the most force a fingertip on the pick can give
      gctx.strokeStyle = C.line; gctx.setLineDash([3, 3]); gctx.beginPath(); gctx.moveTo(30, Y(1500)); gctx.lineTo(w - 4, Y(1500)); gctx.stroke(); gctx.setLineDash([]);
      R.label(gctx, 'max push', w - 6, Y(1500) - 3, { align: 'right', color: C.muted, size: 9, weight: 500 });
      const n = hist.length;
      hist.forEach((p, i) => {
        const col = p.s === 'set' ? C.teal : p.s === 'overset' ? C.ink : p.s === 'caught' ? C.mustard : p.b ? C.rose : C.muted;
        gctx.globalAlpha = 0.25 + 0.75 * (i / n);
        gctx.fillStyle = col; gctx.fillRect(X(p.x) - 1.3, Y(p.y) - 1.3, 2.6, 2.6);
      });
      gctx.globalAlpha = 1;
      if (n) { const p = hist[n - 1]; gctx.strokeStyle = C.ink; gctx.lineWidth = 1.5; gctx.beginPath(); gctx.arc(X(p.x), Y(p.y), 4.5, 0, Math.PI * 2); gctx.stroke(); }
      stripChart(sctx, st.w, st.h, C, [{ i: 0, max: lock.cfg.maxTravel, color: C.teal, name: 'plug rotation' }, { i: 1, max: 1, color: C.rose, name: 'turning pressure', dash: true }]);
    } else if (k === 'key') {
      $('graphTitle').textContent = 'Where each split sits';
      $('graphLegend').innerHTML = '<span><i style="background:var(--teal)"></i>at the shear line</span><span><i style="background:var(--mustard)"></i>driver crosses</span><span><i style="background:var(--rose)"></i>key pin crosses</span>';
      gctx.clearRect(0, 0, w, h);
      const mid = h / 2, sc = (h / 2 - 16) / 40;
      gctx.strokeStyle = C.rose; gctx.setLineDash([5, 4]); gctx.beginPath(); gctx.moveTo(4, mid); gctx.lineTo(w - 4, mid); gctx.stroke(); gctx.setLineDash([]);
      R.label(gctx, 'shear line', w - 4, mid - 4, { align: 'right', color: C.rose, size: 9.5 });
      const bw = (w - 30) / lock.n;
      lock.pins.forEach((p, i) => {
        const split = p.key.top();
        const stt = lock.pinState(i).state;
        const col = stt === 'set' ? C.teal : stt === 'overset' ? C.rose : C.mustard;
        const x = 18 + i * bw + bw * 0.2, y = mid + split * sc;
        gctx.fillStyle = col; gctx.fillRect(x, Math.min(mid, y), bw * 0.6, Math.max(2, Math.abs(y - mid)));
        R.label(gctx, String(i + 1), x + bw * 0.3, h - 3, { align: 'center', color: C.muted, size: 10 });
      });
      sctx.clearRect(0, 0, st.w, st.h);
      R.drawFrontInset(sctx, st.w / 2, st.h / 2 - 6, st.h / 2 - 14, S.turn || 0, S.turnTarget > 0 && S.turnTarget < 1);
    } else if (k === 'combo') {
      $('graphTitle').textContent = 'Dial drag';
      $('graphLegend').innerHTML = '<span><i style="background:var(--rose)"></i>friction torque from the fence</span><span><i style="background:var(--teal)"></i>fence depth</span>';
      gctx.clearRect(0, 0, w, h);
      stripChart(gctx, w, h, C, [{ i: 0, max: 60000, color: C.rose, name: 'drag' }, { i: 1, max: lock.cfg.gateDepth + 8, color: C.teal, name: 'fence' }]);
      sctx.clearRect(0, 0, st.w, st.h);
      lock.wheels.forEach((_, i) => {
        const al = lock.wheelAligned(i), y = 22 + i * 26;
        R.label(sctx, 'Wheel ' + (i + 1), 8, y, { color: C.muted, size: 11, weight: 500 });
        R.label(sctx, al ? 'gate under the fence' : 'solid edge at the fence', st.w - 8, y, { align: 'right', color: al ? C.teal : C.ink, size: 11 });
      });
    } else if (k === 'shim') {
      $('graphTitle').textContent = 'Latch and shackle';
      $('graphLegend').innerHTML = '<span><i style="background:var(--mustard)"></i>latch pushed back</span><span><i style="background:var(--teal)"></i>shackle lift</span>';
      gctx.clearRect(0, 0, w, h);
      stripChart(gctx, w, h, C, [{ i: 0, max: 16, color: C.mustard, name: 'latch' }, { i: 1, max: 70, color: C.teal, name: 'shackle' }], [{ v: lock.geom.notchDepth / 16, label: 'clear of notch' }]);
      sctx.clearRect(0, 0, st.w, st.h);
      const f = lock.spring.tension;
      R.label(sctx, 'Spring force', 6, 22, { color: C.muted, size: 10, weight: 500 });
      sctx.fillStyle = C.chip || C.line; sctx.fillRect(6, 32, st.w - 12, 12);
      sctx.fillStyle = C.mustard; sctx.fillRect(6, 32, (st.w - 12) * Math.min(1, f / 600), 12);
      R.label(sctx, Math.round(f) + ' units (F = k·x)', 6, 64, { size: 11 });
    }
  }

  function stripChart(c2, w, h, C, series, refs = []) {
    c2.clearRect(0, 0, w, h);
    c2.strokeStyle = C.line; c2.lineWidth = 1; c2.strokeRect(0.5, 0.5, w - 1, h - 1);
    for (const r of refs) {
      const y = h - 4 - (h - 8) * r.v; c2.setLineDash([3, 3]); c2.beginPath(); c2.moveTo(2, y); c2.lineTo(w - 2, y); c2.stroke(); c2.setLineDash([]);
      R.label(c2, r.label, w - 4, y - 3, { align: 'right', color: C.muted, size: 9, weight: 500 });
    }
    const n = strip.length; if (n < 2) return;
    for (const s of series) {
      c2.strokeStyle = s.color; c2.lineWidth = 1.6; if (s.dash) c2.setLineDash([4, 3]);
      c2.beginPath();
      strip.forEach((p, i) => {
        const x = 2 + (w - 4) * i / 479, y = h - 4 - (h - 8) * Math.max(0, Math.min(1, p[s.i] / s.max));
        if (i) c2.lineTo(x, y); else c2.moveTo(x, y);
      });
      c2.stroke(); c2.setLineDash([]);
    }
    R.label(c2, series.map(s => s.name).join(' · ') + ' (last 8 s)', 6, 13, { color: C.muted, size: 9.5, weight: 500 });
  }

  function metrics() {
    const k = lesson.kind, rows = [];
    if (k === 'pin') {
      rows.push(['Turning pressure', Math.round(S.tension * 100) + '%']);
      rows.push(['Plug rotation', (lock.plug.x * 0.25).toFixed(1) + '°']);
      rows.push(['Push on the pick', Math.round(lock.pickForce())]);
      const chips = lock.pins.map((p, i) => {
        const st = lock.pinState(i);
        if (S.blind) return `<span class="chip">${i + 1}</span>`;
        const cls = st.state === 'set' ? 'set' : st.state === 'overset' ? 'over' : st.state === 'caught' ? 'caught' : st.binding ? 'bind' : '';
        return `<span class="chip ${cls}" title="${st.state}">${i + 1}</span>`;
      }).join('');
      rows.push(['Pins', `<span class="chips">${chips}</span>`]);
      if (lesson.challenge) {
        const t = ((S.solvedAt || performance.now()) - S.startTime) / 1000;
        rows.push([S.solvedAt ? 'Opened in' : 'Time', t.toFixed(1) + ' s']);
      }
      rows.push(['State', lock.isOpen() ? '<span class="chip set">OPEN</span>' : 'locked']);
    } else if (k === 'key') {
      const nset = lock.pins.filter((_, i) => lock.pinState(i).state === 'set').length;
      rows.push(['Key inserted', Math.round(S.insert * 100) + '%']);
      rows.push(['Splits at the shear line', nset + ' / ' + lock.n]);
      rows.push(['Plug', S.turn > 1.2 ? '<span class="chip set">TURNED</span>' : canTurn() ? 'free to turn' : 'blocked']);
    } else if (k === 'combo') {
      rows.push(['Dial', String(lock.numAt(lock.dial.a))]);
      rows.push(['Gates under fence', lock.wheels.filter((_, i) => lock.wheelAligned(i)).length + ' / 3']);
      rows.push(['Shackle pull', Math.round(S.shackle * 100) + '%']);
      rows.push(['State', lock.isOpen() ? '<span class="chip set">OPEN</span>' : 'locked']);
    } else if (k === 'shim') {
      rows.push(['Latch pushed back', (lock.latch.x - lock.geom.latchRestX).toFixed(1) + ' / ' + lock.geom.notchDepth]);
      rows.push(['Latch in notch', lock.latchEngaged() ? 'yes' : 'no']);
      rows.push(['Shackle', lock.isOpen() ? '<span class="chip set">LIFTED</span>' : 'held']);
    }
    $('metrics').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  }

  // --------------------------------------------------------------- loop
  function simStep(simDt, realDt) {
    stepAuto(simDt);
    applyKeys(realDt);
    applyControls();
    lock.step(simDt);
    afterStep(simDt);
    record();
  }
  let last = performance.now(), acc = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    if (!lock || document.hidden) { last = now; return; }
    const C = R.readColors();
    let elapsed = Math.min(0.1, (now - last) / 1000); last = now;
    acc += elapsed;
    const h = 1 / 60;
    let steps = 0;
    while (acc >= h && steps < 2) {
      acc -= h; steps++;
      simStep(opts.slow ? h * 0.25 : h, h);
    }
    if (acc > h) acc = 0;
    // draw
    const k = lesson.kind;
    const bounds = k === 'pin' || k === 'key' ? R.pinBounds(lock) : k === 'combo' ? R.comboBounds(lock) : R.shimBounds(lock);
    view = R.fitView(canvas, bounds);
    R.screenT(ctx, view);
    ctx.fillStyle = C.card; ctx.fillRect(0, 0, view.w, view.h);
    if (k === 'pin' || k === 'key') R.drawPinLock(ctx, lock, view, { overlay: opts.overlay, annotate: lesson.annotate, blind: S.blind, showOffsets: S.showOffsets, challenge: lesson.challenge });
    else if (k === 'combo') R.drawCombo(ctx, lock, view, { shackleLift: S.shackleLift });
    else if (k === 'shim') R.drawShim(ctx, lock, view, { overlay: opts.overlay });
    if (k === 'key' && (S.turn || 0) > 1.2) {
      R.screenT(ctx, view);
      R.label(ctx, 'THE PLUG TURNS', view.w - 16, view.h - 16, { align: 'right', color: '#fff', bg: C.teal, size: 13 });
    }
    tourTick(elapsed);
    if (++frame % 3 === 0) { drawGraphs(C); }
    if (frame % 8 === 0) metrics();
  }

  // ------------------------------------------------------------- gallery
  function buildGallery() {
    const el = $('gallery');
    el.innerHTML = '<div class="gal-head"><span></span><span>HOW IT WORKS</span><span>WHAT YOU MAY FEEL</span><span>WHAT HELPS</span><span></span></div>' +
      lesson.rows.map(r => `<div class="gal-row"><div><div class="name">${Locks.PIN_TYPES[r.type].label.toUpperCase()}</div><canvas data-type="${r.type}"></canvas></div><p>${r.how}</p><p>${r.feel}</p><p>${r.helps}</p><button class="b primary" data-go="${r.lesson}">Try it ▶</button></div>`).join('');
    el.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => { location.hash = b.dataset.go; }; });
    requestAnimationFrame(() => {
      R.readColors();
      el.querySelectorAll('canvas[data-type]').forEach(cv => {
        const c2 = cv.getContext('2d'); const { w, h } = sizeCanvas(cv, c2);
        c2.clearRect(0, 0, w, h); R.pinIcon(c2, cv.dataset.type, w / 2, h / 2, h - 8);
      });
    });
  }

  // --------------------------------------------------------------- boot
  $('optOverlay').onchange = e => { opts.overlay = e.target.checked; ls.set('overlay', opts.overlay); };
  $('optSlow').onchange = e => { opts.slow = e.target.checked; };
  $('optSound').onchange = e => { opts.sound = e.target.checked; ls.set('sound', opts.sound); };
  opts.overlay = $('optOverlay').checked = ls.get('overlay', false);
  opts.sound = $('optSound').checked = ls.get('sound', true);
  const theme = new URLSearchParams(location.search).get('theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  buildNav();
  // #lesson or #lesson/step (1-based) for kiosks and deep links
  const route = () => {
    const [id, step] = (location.hash || '#how').slice(1).split('/');
    if (!lesson || lesson.id !== id) load(id);
    if (step && lesson.steps && lesson.steps[+step - 1]) runStep(+step - 1);
    // ?ff=seconds fast-forwards the simulation (kiosk snapshots, testing)
    const ff = Math.min(60, +(new URLSearchParams(location.search).get('ff')) || 0);
    if (ff > 0 && lock) for (let i = 0; i < ff * 60; i++) simStep(1 / 60, 1 / 60);
  };
  window.addEventListener('hashchange', route);
  route();
  // ?tour=1 plays every poster's steps in turn (attract loop for a kiosk).
  // Any click or key press hands control back to the visitor.
  const tour = new URLSearchParams(location.search).get('tour') ? { i: -1, wait: 1.5 } : null;
  const tourList = [];
  LESSONS.forEach(l => (l.steps || []).forEach((_, k) => tourList.push([l.id, k + 1])));
  function tourTick(dt) {
    if (!tour || tour.off) return;
    if (auto) return;
    tour.wait -= dt;
    if (tour.wait > 0) return;
    tour.i = (tour.i + 1) % tourList.length;
    const [id, k] = tourList[tour.i];
    tour.wait = k === 3 ? 3.5 : 2;
    location.hash = id + '/' + k;
  }
  if (tour) {
    const stop = () => { tour.off = true; };
    canvas.addEventListener('pointerdown', stop);
    window.addEventListener('keydown', stop);
    $('controls').addEventListener('pointerdown', stop);
  }
  requestAnimationFrame(tick);
})();
