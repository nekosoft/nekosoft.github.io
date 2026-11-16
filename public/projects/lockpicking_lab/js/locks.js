/*
 * Lock models built on the LockLab engine.
 *
 *  - Pin profiles (standard, spool, serrated, mushroom, hybrid) as compound
 *    convex polygons.
 *  - Pin-tumbler lock: housing, plug, pin stacks, springs, pick or key.
 *    Plug rotation is drawn as a sideways offset (as on the posters).
 *    Manufacturing offsets between plug holes and housing holes make one pin
 *    bind at a time: the binding-pin model from the MIT Guide, chapter 4.
 *  - Round-dial combination lock: wheel pack with lost-motion drive pins and
 *    a fence pressed by shackle tension.
 *  - Padlock shim: spring latch, notched shackle and shim.
 */
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.Engine;
  const { Body, World, AxisLimit, RelAngleLimit, Spring, rect } = E;

  // ------------------------------------------------------------ pin shapes
  function chamferRect(x0, y0, x1, y1, ct = 0, cb = 0) {
    const v = [];
    if (ct > 0) { v.push([x0 + ct, y0], [x1 - ct, y0], [x1, y0 + ct]); } else { v.push([x0, y0], [x1, y0]); }
    if (cb > 0) { v.push([x1, y1 - cb], [x1 - cb, y1], [x0 + cb, y1], [x0, y1 - cb]); } else { v.push([x1, y1], [x0, y1]); }
    if (ct > 0) v.push([x0, y0 + ct]);
    return v;
  }
  const trap = (y0, w0, y1, w1) => [[-w0 / 2, y0], [w0 / 2, y0], [w1 / 2, y1], [-w1 / 2, y1]];

  /**
   * Teeth for a serrated section between local y0..y1. Returns convex shapes:
   * a narrow core plus full-width bevelled teeth. Flat outer ends where flush.
   */
  function serratedSection(W, y0, y1, nTeeth, depth, bevel, flatTop, flatBottom, endBevel = bevel) {
    const shapes = [rect(-W / 2 + depth, y0, W / 2 - depth, y1)];
    const seg = (y1 - y0) / (2 * nTeeth - 1);
    for (let i = 0; i < nTeeth; i++) {
      const a = y0 + 2 * i * seg, b = a + seg;
      const ct = i === 0 ? (flatTop ? 0 : endBevel) : bevel;
      const cb = i === nTeeth - 1 ? (flatBottom ? 0 : endBevel) : bevel;
      shapes.push(chamferRect(-W / 2, a, W / 2, b, ct, cb));
    }
    return shapes;
  }

  const PIN_TYPES = {
    standard: {
      label: 'Standard', security: false, maxTilt: 0.012,
      driver(W, H) { return [rect(-W / 2, -H / 2, W / 2, H / 2)]; },
    },
    spool: {
      label: 'Spool', security: true, maxTilt: 0.08,
      driver(W, H) {
        const fh = 0.2 * H, w = 0.4 * W, ch = 3.5;
        return [
          chamferRect(-W / 2, -H / 2, W / 2, -H / 2 + fh, 0, ch),
          rect(-w / 2, -H / 2 + fh - 1, w / 2, H / 2 - fh + 1),
          chamferRect(-W / 2, H / 2 - fh, W / 2, H / 2, ch, 0),
        ];
      },
    },
    serrated: {
      label: 'Serrated', security: true, maxTilt: 0.08,
      driver(W, H) { return serratedSection(W, -H / 2, H / 2, 6, 4.5, 1.6, true, true); },
    },
    mushroom: {
      label: 'Mushroom', security: true, maxTilt: 0.08,
      driver(W, H) {
        const w = 0.36 * W, r = 0.07 * H;
        const t0 = -H / 2, t1 = t0 + r, t2 = t0 + 0.2 * H;
        const b3 = H / 2, b2 = b3 - r, b1 = b2 - 0.24 * H;
        return [
          rect(-W / 2, t0, W / 2, t1),
          trap(t1, W, t2, w),
          rect(-w / 2, t2 - 1, w / 2, b1 + 1),
          trap(b1, w, b2, W),
          rect(-W / 2, b2, W / 2, b3),
        ];
      },
    },
    hybrid: {
      label: 'Hybrid', security: true, maxTilt: 0.08,
      driver(W, H) {
        const fh = 0.26 * H, w = 0.4 * W;
        return [
          ...serratedSection(W, -H / 2, -H / 2 + fh, 2, 4, 1.4, true, false, 3.5),
          rect(-w / 2, -H / 2 + fh - 1, w / 2, H / 2 - fh + 1),
          ...serratedSection(W, H / 2 - fh, H / 2, 2, 4, 1.4, false, true, 3.5),
        ];
      },
    },
  };

  function keyPinShape(W, bodyLen, chisel, tipW) {
    // local origin at top centre; y grows downward
    const c = 3; // chamfered top, as on real key pins
    return [[-W / 2 + c, 0], [W / 2 - c, 0], [W / 2, c], [W / 2, bodyLen], [tipW / 2, bodyLen + chisel], [-tipW / 2, bodyLen + chisel], [-W / 2, bodyLen], [-W / 2, c]];
  }

  /** Width of a compound shape at local height y (outer extent). */
  function profileWidthAt(shapes, y) {
    let lo = Infinity, hi = -Infinity;
    for (const s of shapes) {
      const v = s.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p);
      for (let i = 0; i < v.length; i++) {
        const a = v[i], b = v[(i + 1) % v.length];
        if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) {
          const x = a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y);
          lo = Math.min(lo, x); hi = Math.max(hi, x);
        } else if (a.y === y && b.y === y) { lo = Math.min(lo, a.x, b.x); hi = Math.max(hi, a.x, b.x); }
      }
    }
    return hi > lo ? hi - lo : 0;
  }

  // --------------------------------------------------------- layers
  const L = { HOUSING: 1, PLUG: 2, DRIVER: 4, KEYPIN: 8, PICK: 16, KEY: 32, MISC: 64 };

  // ------------------------------------------------------ pin-tumbler lock
  /**
   * @param {object} o
   *   pins: [{type, keyLen, offset}]   offset = plug-hole misalignment (MIT ch. 4)
   *   mode: 'pick' | 'key'
   */
  function buildPinLock(o) {
    const cfg = Object.assign({
      W: 30, H: 60, clr: 4, spacing: 64, springSpace: 44, plugDepth: 96,
      lipT: 5, opening: 18, keywayH: 44, chisel: 9, tipW: 8, keyPinW: 26,
      springK: 3.5, springPreload: 40, gravity: 120, springDamp: 0.3, pinDamp: 8, pinMass: 0.6, pickRise: 200,
      tensionMax: 2000, plugReturn: 15, maxTravel: 30, openAt: 23,
      pickMaxForce: 1500, pickKp: 1600, pickKd: 70,
      friction: 0.22, substeps: 24, mode: 'pick', maxTilt: 0.08,
    }, o);
    const { W, H, clr, spacing } = cfg;
    const n = cfg.pins.length;
    const xs = cfg.pins.map((_, i) => (i - (n - 1) / 2) * spacing);
    const yTop = -(H + cfg.springSpace);
    const Pb = cfg.plugDepth;
    const hasLips = true; // key pins rest on the edges of the keyway slot
    const Ky = hasLips ? Pb + cfg.lipT : Pb;        // keyway top
    const Kf = Ky + cfg.keywayH;                      // keyway floor
    const xMin = xs[0] - spacing / 2 - 18, xMax = xs[n - 1] + spacing / 2 + 18;

    const world = new World({ gy: cfg.gravity, substeps: cfg.substeps, iterations: 1 });

    // housing: blocks between the bores, plus a cap over the spring chambers
    const hShapes = [rect(xMin - 40, yTop - 26, xMax + 40, yTop)];
    let edge = xMin - 40;
    for (const x of xs) { hShapes.push(rect(edge, yTop - 1, x - W / 2 - clr, 0)); edge = x + W / 2 + clr; }
    hShapes.push(rect(edge, yTop - 1, xMax + 40, 0));
    const housing = world.add(new Body({ name: 'housing', static: true, shapes: hShapes, friction: cfg.friction, layer: L.HOUSING, mask: L.DRIVER | L.KEYPIN }));

    // plug: slides along x (= rotation in side view)
    const pShapes = [];
    edge = xMin;
    cfg.pins.forEach((p, i) => {
      const c = xs[i] + (p.offset || 0);
      pShapes.push(rect(edge, 0, c - W / 2 - clr, Ky));
      if (hasLips) {
        pShapes.push(rect(c - W / 2 - clr - 1, Pb, c - cfg.opening / 2, Ky));
        pShapes.push(rect(c + cfg.opening / 2, Pb, c + W / 2 + clr + 1, Ky));
      }
      edge = c + W / 2 + clr;
    });
    pShapes.push(rect(edge, 0, xMax, Ky));
    if (!hasLips) pShapes.push(rect(xMin, Kf, xMax, Kf + 16)); // keyway floor (key mode)
    const plug = world.add(new Body({
      name: 'plug', mass: 1.5, shapes: pShapes, lockY: true, lockRot: true, friction: cfg.friction,
      layer: L.PLUG, mask: L.DRIVER | L.KEYPIN, linDamp: 4,
      lockX: cfg.mode === 'key',
    }));
    world.ignore(plug, housing);
    world.constraints.push(new AxisLimit(plug, 'x', -1, cfg.maxTravel));

    // pin stacks
    const pins = cfg.pins.map((p, i) => {
      const type = PIN_TYPES[p.type || 'standard'];
      const dShapes = type.driver(W, H);
      const kLen = p.keyLen;
      // resting height: key pin chisel sits on the lips (pick mode) or floor (key mode)
      let kTop;
      if (hasLips) {
        const t = (cfg.keyPinW - cfg.opening) / (cfg.keyPinW - cfg.tipW);
        kTop = Pb - t * cfg.chisel - kLen;
      } else {
        kTop = Kf - cfg.chisel - kLen;
      }
      const cx = xs[i] + (p.offset || 0) / 2;
      const key = world.add(new Body({
        name: 'key' + i, mass: 0.6 * cfg.pinMass, gravityScale: 1 / cfg.pinMass, x: cx, y: kTop, shapes: [keyPinShape(cfg.keyPinW, kLen, cfg.chisel, cfg.tipW)],
        friction: cfg.friction, layer: L.KEYPIN, mask: L.HOUSING | L.PLUG | L.DRIVER | L.PICK | L.KEY, linDamp: cfg.pinDamp, angDamp: 6,
      }));
      const driver = world.add(new Body({
        name: 'driver' + i, mass: cfg.pinMass, gravityScale: 1 / cfg.pinMass, x: cx, y: kTop - H / 2 - 0.2, shapes: dShapes,
        friction: cfg.friction, layer: L.DRIVER, mask: L.HOUSING | L.PLUG | L.KEYPIN, linDamp: cfg.pinDamp, angDamp: 6,
      }));
      const spring = new Spring({
        body: driver, local: { x: 0, y: -H / 2 }, anchor: { x: xs[i], y: yTop },
        rest: Pb + cfg.springSpace + cfg.springPreload, k: cfg.springK, damping: cfg.springDamp,
      });
      world.forceFns.push(() => spring.apply());
      // real bores are tight: a pin can only rock a few degrees. The drawing
      // exaggerates clearance, so cap the tilt to keep the mechanics honest.
      const tilt = type.maxTilt !== undefined ? type.maxTilt : cfg.maxTilt;
      world.constraints.push(new AxisLimit(driver, 'a', -tilt, tilt));
      world.constraints.push(new AxisLimit(key, 'a', -0.012, 0.012));
      return {
        i, type: p.type || 'standard', typeDef: type, driver, key, spring, x: xs[i], offset: p.offset || 0,
        keyLen: kLen, dShapes, H,
      };
    });

    // pick (lifts a key pin) ------------------------------------------------
    let pick = null;
    const ctl = {
      tension: 0, pickCol: 0, pickColTarget: 0, pickY: Kf - 8, pickYUser: Kf - 8,
      pickSafeY: Ky + cfg.chisel + 6, pickRestY: Kf - 8,
    };
    if (cfg.mode === 'pick') {
      pick = world.add(new Body({
        name: 'pick', mass: 0.8, x: xs[0], y: ctl.pickRestY, shapes: [rect(-cfg.tipW / 2 - 1, 0, cfg.tipW / 2 + 1, 7)],
        lockX: true, lockRot: true, gravityScale: 0, friction: 0.15, layer: L.PICK, mask: L.KEYPIN, linDamp: 2,
      }));
      world.constraints.push(new AxisLimit(pick, 'y', -H, Kf - 8));
      world.forceFns.push(() => {
        const e = ctl.pickY - pick.y;
        let f = cfg.pickKp * e - cfg.pickKd * pick.vy;
        f = Math.max(-cfg.pickMaxForce, Math.min(cfg.pickMaxForce, f));
        pick.applyForce(0, f);
      });
      world.postIntegrate.push(() => {
        const c = ctl.pickCol, i0 = Math.max(0, Math.min(n - 1, Math.floor(c))), i1 = Math.min(n - 1, i0 + 1), t = c - i0;
        const x0 = xs[i0] + pins[i0].offset, x1 = xs[i1] + pins[i1].offset;
        pick.x = plug.x + x0 + (x1 - x0) * t;
      });
    }

    // tension on the plug
    world.forceFns.push(() => {
      plug.applyForce(ctl.tension * cfg.tensionMax - cfg.plugReturn * plug.x, 0);
    });

    // key (key mode) ----------------------------------------------------------
    let key = null;
    if (cfg.mode === 'key') key = makeKey();
    function makeKey() {
      const kb = world.add(new Body({ name: 'key', kinematic: true, x: xMin - 4, y: Kf - 4, shapes: [], layer: L.KEY, mask: L.KEYPIN, friction: 0.12 }));
      kb.data.tipFull = xs[n - 1] + spacing * 0.55;
      kb.data.entrance = xMin - 4;
      return kb;
    }
    /** Set the key's bitting: array of key-pin body lengths it is cut for. */
    function setKeyCuts(cuts) {
      if (!key) return;
      const u = xs.map(x => x - key.data.tipFull);       // key-local x of each pin
      const keyY = Kf - 4;
      const yc = cuts.map(c => (c + cfg.chisel) - keyY);   // key-local y of cut (negative = up)
      const cap = Math.min(...yc) - 3;
      const pts = [];
      const bowU = u[0] - spacing * 0.7;
      pts.push([bowU - 60, cap], [bowU, cap]);
      for (let i = 0; i < n; i++) {
        const prevU = i === 0 ? bowU : u[i - 1] + 6;
        const prevY = i === 0 ? cap : yc[i - 1];
        const nextU = u[i] - 6;
        // rise from previous valley, then fall into this one (45-degree flanks)
        const peakU = (prevU + nextU) / 2 + (yc[i] - prevY) / 2;
        const peakY = Math.max(cap, prevY - (peakU - prevU));
        if (i > 0) pts.push([prevU, prevY]);
        if (peakY > cap + 0.01) pts.push([peakU, peakY]);
        else { pts.push([prevU + (prevY - cap), cap], [nextU - (yc[i] - cap), cap]); }
        pts.push([nextU, yc[i]]);
      }
      pts.push([u[n - 1] + 6, yc[n - 1]]);
      // ramp down to tip
      const tipTop = (Ky + 8) - keyY;
      const rampStart = Math.max(u[n - 1] + 6, -(tipTop - yc[n - 1]) - 2);
      pts.push([rampStart, yc[n - 1]], [0, tipTop]);
      // de-duplicate and sort
      const clean = [];
      for (const p of pts) { if (!clean.length || p[0] > clean[clean.length - 1][0] + 0.01) clean.push(p); }
      const shapes = [];
      for (let i = 0; i + 1 < clean.length; i++) {
        const a = clean[i], b = clean[i + 1];
        shapes.push([[a[0], a[1]], [b[0], b[1]], [b[0], 0], [a[0], 0]]);
      }
      key.shapes = shapes.map(E.normalizePoly);
      key.ws = key.shapes.map(s => ({ v: s.map(() => ({ x: 0, y: 0 })), n: s.map(() => ({ x: 0, y: 0 })), minX: 0, minY: 0, maxX: 0, maxY: 0 }));
      key.data.cuts = cuts.slice();
      key.data.profile = clean;
      key.updateWorld();
    }
    function setKeyInsertion(t) {
      if (!key) return;
      const x = key.data.entrance + (key.data.tipFull - key.data.entrance) * Math.max(0, Math.min(1, t));
      key.kTarget = { x, y: Kf - 4, a: 0 };
    }

    // ------------------------------------------------------------- queries
    const EPS_LINE = 1.2;
    function pinState(i) {
      const p = pins[i];
      const dBottom = p.driver.bottom();
      const kTop = p.key.top();
      const bind = p.bindAvg || 0;
      const keyBind = p.keyBindAvg || 0;
      let state;
      if (kTop < -EPS_LINE) state = 'overset';
      else if (dBottom <= 0.35 + W * Math.abs(Math.sin(p.driver.a))) state = 'set';
      else {
        // The plug has turned past the point where this pin's full width
        // would stop it, yet the driver still crosses the line: a waist or
        // groove is letting the plug in (a false set / groove catch).
        state = plug.x > bindTravel(i) + 1.6 ? 'caught' : 'blocking';
      }
      const torqued = ctl.tension > 0.02;
      const binding = torqued && (((state === 'blocking' || state === 'caught') && bind > 60) || (state === 'overset' && keyBind > 60));
      return { state, binding, bind, keyBind, dBottom, kTop, tilt: p.driver.a };
    }
    /** Plug travel at which pin i's full-width section would first bind (MIT ch. 4). */
    function bindTravel(i) { return 2 * clr - pins[i].offset; }
    function isOpen() { return cfg.mode === 'pick' ? plug.x > cfg.openAt : pins.every((_, i) => pinState(i).state === 'set'); }
    /** pick tip y needed to put pin i's driver bottom at world y = db (if stack is vertical). */
    function pickYFor(i, db) { return db + pins[i].keyLen + cfg.chisel; }

    function step(dt) {
      // pick column travel: drop below pin tips before sliding sideways
      if (pick) {
        const dc = ctl.pickColTarget - ctl.pickCol;
        if (Math.abs(dc) > 1e-4) {
          ctl.pickY = ctl.pickRestY;
          if (pick.y > ctl.pickSafeY) {
            const v = 7 * dt;
            ctl.pickCol += Math.max(-v, Math.min(v, dc));
            if (Math.abs(ctl.pickColTarget - ctl.pickCol) < 1e-4) { ctl.pickCol = ctl.pickColTarget; ctl.pickYUser = ctl.pickRestY; }
          }
        } else if (cfg.pickRise > 0 && ctl.pickYUser < ctl.pickY) {
          // a hand presses up, it does not strike: cap how fast the tip rises
          ctl.pickY = Math.max(ctl.pickYUser, ctl.pickY - cfg.pickRise * dt);
        } else ctl.pickY = ctl.pickYUser;
      }
      world.step(dt);
      // smoothed contact forces (single substeps flicker as contacts switch)
      for (const p of pins) {
        const b = world.forceBetween(p.driver, plug) + world.forceBetween(p.driver, housing) * 0.5;
        const kb = world.forceBetween(p.key, housing);
        p.bindAvg = (p.bindAvg || 0) * 0.85 + b * 0.15;
        p.keyBindAvg = (p.keyBindAvg || 0) * 0.85 + kb * 0.15;
      }
    }

    const lock = {
      kind: 'pin', cfg, world, housing, plug, pins, pick, key, ctl, xs, n,
      geom: { yTop, Pb, Ky, Kf, xMin, xMax, W, H, clr },
      step, pinState, isOpen, pickYFor, bindTravel, setKeyCuts, setKeyInsertion, profileWidthAt,
      pickForce() { return pick ? pins.reduce((s, p) => s + world.forceBetween(pick, p.key), 0) : 0; },
      settle(t = 0.6) { for (let k = 0; k < t * 60; k++) step(1 / 60); },
    };
    return lock;
  }

  // ------------------------------------------------- combination lock
  /**
   * Wheel pack shown "exploded": three wheels stacked vertically and one fence
   * on the right. The dial drives wheel 3 through a drive pin; each wheel picks
   * up the next after almost a full turn (lost motion).
   */
  function buildComboLock(o = {}) {
    const cfg = Object.assign({
      R: 46, gap: 14, gateDepth: 13, gateHalf: 0.21, numbers: 40,
      combo: [30, 12, 26], fenceForceMax: 900, friction: 0.35, substeps: 20,
      pinSlack: 0.16, // radians of pin width eaten from each full turn
    }, o);
    const { R } = cfg;
    const world = new World({ gy: 0, substeps: cfg.substeps });
    const N = 3;
    const cy = i => (i - 1) * (2 * R + cfg.gap);
    const TWO_PI = Math.PI * 2;

    // dial angle -> number under the pointer (pointer at top; clockwise = numbers fall)
    const numAt = a => ((Math.round(-a / TWO_PI * cfg.numbers) % cfg.numbers) + cfg.numbers) % cfg.numbers;
    const angleOf = num => -num / cfg.numbers * TWO_PI;

    // lost-motion limits. The dial's drive cam picks up wheel 3 almost at once
    // (small "fly"); each wheel then picks up the next after nearly a full
    // turn, once its drive pin meets the neighbour's (+-(PI - slack)).
    const lim = Math.PI - cfg.pinSlack;
    const fly = 0.05;
    const limits = [null, fly, lim, lim];

    // ---- kinematic dry run to find where the gates must be cut
    function dialPath(combo, start = 0) {
      // returns list of [targetAngle] segments: right (cw, +) 3 turns to a,
      // left (ccw, -) one full turn past b to b, right to c.
      const [a, b, c] = combo;
      const path = [];
      let ang = start;
      const toNum = (num, dir, extraTurns) => {
        let t = angleOf(num);
        // nearest angle for this number in the direction of travel
        if (dir > 0) { while (t > ang + TWO_PI) t -= TWO_PI; while (t <= ang) t += TWO_PI; }
        else { while (t < ang - TWO_PI) t += TWO_PI; while (t >= ang) t -= TWO_PI; }
        t += dir * extraTurns * TWO_PI;
        path.push(t); ang = t;
      };
      toNum(a, +1, 2);
      toNum(b, -1, 1);
      toNum(c, +1, 0);
      return path;
    }
    function kinematicRun(path, start = [0, 0, 0, 0]) {
      // state: [dial, w3, w2, w1] -> chain dial->w3->w2->w1 (indices 0..3)
      const s = start.slice();
      for (const target of path) {
        const dir = Math.sign(target - s[0]);
        const stepA = 0.002 * dir;
        while ((target - s[0]) * dir > 1e-9) {
          s[0] += Math.abs(target - s[0]) < 0.002 ? target - s[0] : stepA;
          for (let k = 1; k < 4; k++) {
            const d = s[k - 1] - s[k], m = limits[k];
            if (d > m) s[k] = s[k - 1] - m; else if (d < -m) s[k] = s[k - 1] + m;
          }
        }
      }
      return s;
    }
    const final = kinematicRun(dialPath(cfg.combo));
    // wheel world index: 0 = top = wheel 1 (set by first number) ... chain order dial->w3->w2->w1
    const chainToWheel = [null, 2, 1, 0];
    const gateLocal = [0, 0, 0];
    for (let k = 1; k < 4; k++) gateLocal[chainToWheel[k]] = -final[k]; // gate faces +x when wheel at final angle

    function wheelShapes(gate) {
      const shapes = [];
      const segs = 48;
      const g0 = gate - cfg.gateHalf, g1 = gate + cfg.gateHalf;
      const angles = [];
      for (let i = 0; i < segs; i++) angles.push(gate + cfg.gateHalf + (TWO_PI - 2 * cfg.gateHalf) * i / segs);
      angles.push(g0 + TWO_PI);
      for (let i = 0; i + 1 < angles.length; i++) {
        const a = angles[i], b = angles[i + 1];
        shapes.push([[0, 0], [R * Math.cos(a), R * Math.sin(a)], [R * Math.cos(b), R * Math.sin(b)]]);
      }
      // gate floor
      const r2 = R - cfg.gateDepth;
      shapes.push([[0, 0], [r2 * Math.cos(g0), r2 * Math.sin(g0)], [r2 * Math.cos(g1), r2 * Math.sin(g1)]]);
      return shapes;
    }

    const wheels = [];
    for (let i = 0; i < N; i++) {
      wheels.push(world.add(new Body({
        name: 'wheel' + (i + 1), x: 0, y: cy(i), shapes: wheelShapes(gateLocal[i]), mass: 0.2,
        lockX: true, lockY: true, friction: cfg.friction, angDamp: 150, layer: L.MISC, mask: L.MISC,
      })));
    }
    const dial = world.add(new Body({ name: 'dial', x: -260, y: 0, shapes: [], mass: 2, inertia: 4000, lockX: true, lockY: true, angDamp: 8, layer: 0, mask: 0 }));
    // chain dial -> wheel3 -> wheel2 -> wheel1
    const chain = [dial, wheels[2], wheels[1], wheels[0]];
    const links = [];
    for (let k = 1; k < 4; k++) { const c = new RelAngleLimit(chain[k - 1], chain[k], -limits[k], limits[k]); links.push(c); world.constraints.push(c); }

    // fence with one tooth per wheel
    const toothH = 2 * (R - cfg.gateDepth) * Math.sin(cfg.gateHalf) * 0.86;
    const fShapes = [];
    for (let i = 0; i < N; i++) fShapes.push(rect(0, cy(i) - toothH / 2, 16, cy(i) + toothH / 2));
    const fenceRest = R + 6;
    const fence = world.add(new Body({
      name: 'fence', x: fenceRest, y: 0, shapes: fShapes, mass: 1.5, lockY: true, lockRot: true,
      friction: cfg.friction, linDamp: 12, layer: L.MISC, mask: L.MISC,
    }));
    world.constraints.push(new AxisLimit(fence, 'x', R - cfg.gateDepth - 2, fenceRest + 4));

    const ctl = { dialTarget: 0, shackle: 0, torque: 0 };
    world.forceFns.push(() => {
      // dial: torque-limited servo toward the user's target angle
      const e = ctl.dialTarget - dial.a;
      let t = 9e5 * e - 9e3 * dial.w;
      const tMax = 8e5;
      t = Math.max(-tMax, Math.min(tMax, t));
      ctl.torque = t;
      dial.tq += t;
      // fence: shackle tension pulls it toward the wheels, a weak spring returns it
      fence.applyForce(-ctl.shackle * cfg.fenceForceMax + 25 * (fenceRest - fence.x) + 60, 0);
    });

    function fenceDepth() { return R - fence.x; }
    /** Plug travel at which pin i's full-width section would first bind (MIT ch. 4). */
    function bindTravel(i) { return 2 * clr - pins[i].offset; }
    function isOpen() { return fence.x < R - cfg.gateDepth * 0.6; }
    function wheelAligned(i) {
      const a = ((wheels[i].a + gateLocal[i]) % TWO_PI + TWO_PI) % TWO_PI;
      const d = Math.min(a, TWO_PI - a);
      return d < cfg.gateHalf * 0.55;
    }
    function dialDrag() {
      // friction torque the fence puts on the pack
      let t = 0;
      for (const w of wheels) t += world.forceBetween(w, fence) * cfg.friction * R;
      return t;
    }
    return {
      kind: 'combo', cfg, world, wheels, dial, fence, links, ctl, gateLocal, cy, numAt, angleOf, dialPath, kinematicRun,
      fenceRest, isOpen, wheelAligned, fenceDepth, dialDrag,
      step(dt) { world.step(dt); },
      settle() { for (let k = 0; k < 20; k++) world.step(1 / 60); },
    };
  }

  // ------------------------------------------------------ padlock shim
  function buildShimLock(o = {}) {
    const cfg = Object.assign({
      shielded: false, deadlocked: false, substeps: 24, friction: 0.22,
      springK: 10, pullMax: 1100, shimForce: 900,
    }, o);
    const world = new World({ gy: 120, substeps: cfg.substeps });
    // geometry (y-down). Shackle leg is 20 wide, centred on x = 0.
    const sw = 10, notchY0 = 10, notchY1 = 32, notchDepth = 9, gapR = sw + 4.5;
    const bodyTop = -20, bodyBot = 110, wallX = 120;
    const latchH = 18, latchY = (notchY0 + notchY1) / 2;

    const housing = world.add(new Body({
      name: 'housing', static: true, friction: cfg.friction, layer: 1, mask: 0xff,
      shapes: [
        rect(-80, bodyTop, -sw - 1, bodyBot),
        rect(gapR, bodyTop, wallX + 20, latchY - latchH / 2 - 1),
        rect(gapR, latchY + latchH / 2 + 1, wallX + 20, bodyBot),
        rect(wallX, latchY - latchH / 2 - 2, wallX + 20, latchY + latchH / 2 + 2),
        rect(-sw - 1, 64, gapR, bodyBot), // floor under the shackle leg
      ],
    }));
    // shackle leg with a notch on the latch side
    const shackle = world.add(new Body({
      name: 'shackle', x: 0, y: 0, mass: 3, lockX: true, lockRot: true, friction: cfg.friction, linDamp: 5, layer: 2, mask: 0xff,
      shapes: [
        rect(-sw, -150, sw, notchY0),
        rect(-sw, notchY0 - 1, sw - notchDepth, notchY1 + 1),
        rect(-sw, notchY1, sw, 62),
      ],
    }));
    world.constraints.push(new AxisLimit(shackle, 'y', -70, 0));
    // latch: flat underside (pulling the shackle does not push it), sloped top
    const latchShape = [[0, 3], [11, -latchH / 2], [70, -latchH / 2], [70, latchH / 2], [0, latchH / 2]];
    const latchRestX = sw - notchDepth + 0.5;
    const latch = world.add(new Body({
      name: 'latch', x: latchRestX, y: latchY, mass: 1, lockY: true, lockRot: true, friction: cfg.friction, linDamp: 8,
      shapes: [latchShape], layer: 4, mask: 0xff, lockX: cfg.deadlocked,
    }));
    world.ignore(latch, housing);
    world.constraints.push(new AxisLimit(latch, 'x', latchRestX - 0.5, wallX - 72));
    const spring = new Spring({ body: latch, local: { x: 70, y: 0 }, anchor: { x: wallX, y: latchY }, rest: 80, k: cfg.springK, damping: 0.5 });
    world.forceFns.push(() => spring.apply());

    // shim: thin strip with a bevelled tip, slides down beside the shackle
    const sx0 = sw + 0.6, sx1 = gapR - 0.6;
    const shimLen = 160;
    const shim = world.add(new Body({
      name: 'shim', x: 0, y: -60, mass: 0.5, lockX: true, lockRot: true, gravityScale: 0, friction: cfg.friction, linDamp: 4,
      shapes: [[[sx0, -shimLen], [sx1, -shimLen], [sx1, -4], [sx0, 0]]], layer: 8, mask: 4 | 16,
    }));
    world.ignore(shim, shackle);
    world.constraints.push(new AxisLimit(shim, 'y', -80, latchY + latchH / 2 + 6));
    let shield = null;
    if (cfg.shielded) {
      shield = world.add(new Body({ name: 'shield', static: true, shapes: [rect(sw + 0.2, bodyTop, gapR, 2)], layer: 16, mask: 8 }));
    }

    const ctl = { shimY: -60, pull: 0, closing: false };
    world.forceFns.push(() => {
      let f = 600 * (ctl.shimY - shim.y) - 40 * shim.vy;
      f = Math.max(-cfg.shimForce, Math.min(cfg.shimForce, f));
      shim.applyForce(0, f);
      shackle.applyForce(0, -ctl.pull * cfg.pullMax + (ctl.closing ? 900 : 0));
    });
    return {
      kind: 'shim', cfg, world, housing, shackle, latch, shim, spring, shield, ctl,
      geom: { sw, notchY0, notchY1, notchDepth, gapR, bodyTop, bodyBot, wallX, latchY, latchH, latchRestX },
      latchEngaged() { return latch.x < sw - 0.5; },
      isOpen() { return shackle.y < -24; },
      step(dt) { world.step(dt); },
      settle() { for (let k = 0; k < 30; k++) world.step(1 / 60); },
    };
  }

  const Locks = { PIN_TYPES, buildPinLock, buildComboLock, buildShimLock, profileWidthAt, keyPinShape, L };
  if (typeof module !== 'undefined' && module.exports) module.exports = Locks;
  else root.Locks = Locks;
})(typeof window !== 'undefined' ? window : globalThis);
