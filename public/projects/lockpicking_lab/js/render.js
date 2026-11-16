/*
 * Canvas rendering for LockLab scenes, styled after the festival posters.
 * Colours come from CSS custom properties so light/dark themes both work.
 */
(function (root) {
  'use strict';

  let C = {};
  function readColors() {
    const s = getComputedStyle(document.documentElement);
    const g = n => s.getPropertyValue(n).trim();
    C = {
      card: g('--card'), ink: g('--ink'), muted: g('--muted'), teal: g('--teal'), tealSoft: g('--teal-soft'),
      housing: g('--housing'), mustard: g('--mustard'), rose: g('--rose'), line: g('--line'), key: g('--key'),
      steel: g('--steel'), bore: g('--bore'), keyway: g('--keyway'), dial: g('--dial'), pick: g('--pick'),
    };
    return C;
  }

  // ---------------------------------------------------------- view helpers
  /** Fit world rect into canvas. Returns view {s, ox, oy, dpr, w, h}. */
  function fitView(canvas, bounds, pad = 18) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const bw = bounds.x1 - bounds.x0, bh = bounds.y1 - bounds.y0;
    const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
    const ox = (w - bw * s) / 2 - bounds.x0 * s;
    const oy = (h - bh * s) / 2 - bounds.y0 * s;
    return { s, ox, oy, dpr, w, h };
  }
  const worldT = (ctx, v) => ctx.setTransform(v.dpr * v.s, 0, 0, v.dpr * v.s, v.dpr * v.ox, v.dpr * v.oy);
  const screenT = (ctx, v) => ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  const toS = (v, x, y) => ({ x: v.ox + x * v.s, y: v.oy + y * v.s });
  const toW = (v, sx, sy) => ({ x: (sx - v.ox) / v.s, y: (sy - v.oy) / v.s });

  function polyPath(ctx, verts) {
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
  }
  /** Draw a compound body so internal seams are hidden: thick stroke, then fill. */
  function drawBody(ctx, body, fill, stroke, lw) {
    if (stroke && lw) {
      ctx.beginPath();
      for (const s of body.ws) polyPath(ctx, s.v);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke; ctx.lineWidth = lw * 2; ctx.stroke();
    }
    ctx.beginPath();
    for (const s of body.ws) polyPath(ctx, s.v);
    ctx.fillStyle = fill; ctx.fill();
  }
  function fillShapes(ctx, shapes, fill) {
    ctx.beginPath();
    for (const s of shapes) polyPath(ctx, s.v);
    ctx.fillStyle = fill; ctx.fill();
  }
  function rectW(ctx, x0, y0, x1, y1, fill) { ctx.fillStyle = fill; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }

  function spring(ctx, ax, ay, bx, by, coils, amp, color, lw) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const lead = Math.min(4, L * 0.1);
    ctx.beginPath(); ctx.moveTo(ax, ay);
    ctx.lineTo(ax + ux * lead, ay + uy * lead);
    const n = coils * 2;
    for (let i = 1; i < n; i++) {
      const t = lead + (L - 2 * lead) * i / n, side = i % 2 ? 1 : -1;
      ctx.lineTo(ax + ux * t + nx * amp * side, ay + uy * t + ny * amp * side);
    }
    ctx.lineTo(bx - ux * lead, by - uy * lead); ctx.lineTo(bx, by);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.stroke();
  }

  function arrow(ctx, x0, y0, x1, y1, color, lw, head = 7) {
    const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 1) return;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const h = Math.min(head, L * 0.6);
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.45), y1 - h * Math.sin(a - 0.45));
    ctx.lineTo(x1 - h * Math.cos(a + 0.45), y1 - h * Math.sin(a + 0.45));
    ctx.closePath(); ctx.fill();
  }
  function label(ctx, text, x, y, o = {}) {
    ctx.font = `${o.weight || 700} ${o.size || 11}px ${o.font || 'var(--font)'}`.replace('var(--font)', getComputedStyle(document.body).fontFamily);
    ctx.fillStyle = o.color || C.ink; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    if (o.bg) {
      const m = ctx.measureText(text), p = 4, h = (o.size || 11) + 6;
      let bx = x - p; if (ctx.textAlign === 'center') bx = x - m.width / 2 - p; else if (ctx.textAlign === 'right') bx = x - m.width - p;
      ctx.fillStyle = o.bg; roundRect(ctx, bx, y - h + 4, m.width + 2 * p, h, 4); ctx.fill();
      ctx.fillStyle = o.color || C.ink;
    }
    ctx.fillText(text, x, y);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ------------------------------------------------------------ pin lock
  function pinBounds(lock) {
    const g = lock.geom;
    if (lock.cfg.mode === 'key') return { x0: g.xMin - 70, x1: g.xMax + 40, y0: g.yTop - 40, y1: g.Kf + 34 };
    if (lock.n === 1) return { x0: g.xMin - 150, x1: g.xMax + 150, y0: g.yTop - 30, y1: g.Kf + 26 };
    return { x0: g.xMin - 60, x1: g.xMax + 20, y0: g.yTop - 44, y1: g.Kf + 30 };
  }

  const STATE_LABEL = { set: 'SET', overset: 'OVERSET', caught: 'FALSE SET', blocking: '' };

  function drawPinLock(ctx, lock, v, o = {}) {
    const g = lock.geom, plug = lock.plug, W = g.W;
    worldT(ctx, v);
    const lw = 1.3 / v.s;
    // housing + bores
    rectW(ctx, g.xMin - 40, g.yTop - 26, g.xMax + 40, 0, C.bore);
    fillShapes(ctx, lock.housing.ws, C.housing);
    // plug body: the keyway (or key slot) sits inside the plug
    const px = plug.x;
    rectW(ctx, g.xMin + px, 0, g.xMax + px, g.Kf + 18, C.bore);
    rectW(ctx, g.xMin + px, g.Ky, g.xMax + px, g.Kf, C.keyway);
    fillShapes(ctx, plug.ws, C.tealSoft);
    rectW(ctx, g.xMin + px, g.Kf, g.xMax + px, g.Kf + 18, C.tealSoft);
    // plug outline edge (where it meets the housing)
    ctx.strokeStyle = C.line; ctx.lineWidth = lw; ctx.strokeRect(g.xMin + px, 0, g.xMax - g.xMin, g.Kf + 18);

    // offsets overlay (challenge)
    if (o.showOffsets) {
      for (const p of lock.pins) {
        const cx = p.x + p.offset + px;
        ctx.strokeStyle = C.rose; ctx.setLineDash([3 / v.s, 3 / v.s]); ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(p.x, g.yTop); ctx.lineTo(p.x, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, g.Pb); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // selected column highlight
    if (lock.pick && lock.n > 1) {
      const p = lock.pins[Math.round(lock.ctl.pickColTarget)];
      ctx.fillStyle = 'rgba(10,127,140,0.07)';
      ctx.fillRect(p.x - W / 2 - g.clr - 6, g.yTop - 22, W + 2 * g.clr + 12, g.Kf - g.yTop + 22);
    }

    // springs
    for (const p of lock.pins) {
      const [a, b] = p.spring.endpoints();
      if (!o.blind) spring(ctx, b.x, b.y, a.x, a.y, 9, W * 0.32, C.muted, 1.1 / v.s);
    }
    // key
    if (lock.key && lock.key.shapes.length) drawBody(ctx, lock.key, C.key, C.ink, lw);
    // pins
    for (const p of lock.pins) {
      const st = lock.pinState(p.i);
      if (o.blind) continue;
      const hl = st.binding ? C.rose : C.ink;
      drawBody(ctx, p.key, C.teal, C.ink, lw);
      drawBody(ctx, p.driver, C.mustard, hl, st.binding ? lw * 1.8 : lw);
    }
    if (o.blind) {
      // only the plug, housing and pick are visible: the pins are "inside"
      for (const p of lock.pins) {
        ctx.fillStyle = C.housing; ctx.fillRect(p.x - W / 2 - g.clr - 0.5, g.yTop, W + 2 * g.clr + 1, -g.yTop);
        ctx.fillStyle = C.tealSoft; ctx.fillRect(p.x + p.offset + px - W / 2 - g.clr - 0.5, 0, W + 2 * g.clr + 1, g.Pb);
      }
    }

    // pick
    if (lock.pick) drawPick(ctx, lock, v);
    // tension wrench (bottom-left of the keyway)
    if (lock.pick) drawWrench(ctx, lock, v, o.poster);

    // shear line
    ctx.strokeStyle = C.rose; ctx.lineWidth = 1.6 / v.s; ctx.setLineDash([6 / v.s, 4 / v.s]);
    ctx.beginPath(); ctx.moveTo(g.xMin - 30, 0); ctx.lineTo(g.xMax + 30, 0); ctx.stroke(); ctx.setLineDash([]);

    // force overlay
    if (o.overlay) drawForces(ctx, lock, v);

    // ------- screen-space labels
    screenT(ctx, v);
    if (o.poster) {
      label(ctx, 'SHEAR LINE', 6, toS(v, 0, 0).y - 5, { color: C.rose, size: 8.5 });
    } else {
      const sl = toS(v, g.xMin - 26, -4);
      label(ctx, 'SHEAR LINE', sl.x, sl.y, { color: C.rose, size: 10 });
      const hl = toS(v, g.xMin - 26, g.yTop - 8);
      label(ctx, 'HOUSING', hl.x, hl.y, { color: C.muted, size: 10 });
      const pl = toS(v, g.xMin + px + 4, g.Kf + 14);
      label(ctx, 'PLUG', pl.x, pl.y, { color: C.teal, size: 10 });
    }

    for (const p of lock.pins) {
      const top = toS(v, p.x, g.yTop - 30);
      const st = lock.pinState(p.i);
      if (lock.n > 1 || o.challenge) label(ctx, String(p.i + 1), top.x, top.y - 4, { align: 'center', color: C.muted, size: 11 });
      if (o.blind) continue;
      let t = STATE_LABEL[st.state];
      if (!t && st.binding) t = 'BINDING';
      if (t) {
        const col = st.state === 'set' ? C.teal : st.state === 'overset' ? C.rose : st.state === 'caught' ? C.mustard : C.rose;
        label(ctx, t, top.x, top.y + 12, { align: 'center', color: '#fff', bg: col, size: o.poster ? 8.5 : 9.5 });
      }
    }
    if (o.annotate) drawFalseSetCallouts(ctx, lock, v);
    if (lock.pick && lock.isOpen() && !o.poster) label(ctx, 'PLUG TURNS: OPEN', 16, 28, { color: '#fff', bg: C.teal, size: 13 });
  }

  function drawPick(ctx, lock, v) {
    const p = lock.pick, g = lock.geom;
    const tipW = lock.cfg.tipW + 2;
    const shaftY = g.Kf - 4;
    ctx.fillStyle = C.pick;
    // shaft along the bottom of the keyway, out of the lock to the left
    ctx.fillRect(g.xMin - 70, shaftY - 4, p.x - (g.xMin - 70) + tipW / 2, 4);
    // neck up to the tip
    ctx.beginPath();
    ctx.moveTo(p.x - tipW / 2, shaftY);
    ctx.lineTo(p.x - tipW / 2, p.y + 6);
    ctx.lineTo(p.x + tipW / 2, p.y + 6);
    ctx.lineTo(p.x + tipW / 2, shaftY);
    ctx.closePath(); ctx.fill();
    drawBody(ctx, p, C.pick, null, 0);
    // handle
    ctx.fillRect(g.xMin - 90, shaftY - 7, 30, 10);
  }

  function drawWrench(ctx, lock, v, quiet) {
    const g = lock.geom, t = lock.ctl.tension;
    const x = g.xMin + lock.plug.x + 4, y = g.Kf - 14;
    ctx.fillStyle = C.mustard;
    ctx.fillRect(x - 60, y, 64, 4);
    ctx.fillRect(x, y - 9, 4, 13);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1 / v.s;
    ctx.strokeRect(x - 60, y, 64, 4); ctx.strokeRect(x, y - 9, 4, 13);
    if (t > 0.01 && !quiet) {
      ctx.save(); screenT(ctx, v);
      const s = toS(v, g.xMin - 50, g.Kf - 30);
      arrow(ctx, s.x, s.y, s.x + 10 + 50 * t, s.y, C.teal, 2.5, 8);
      label(ctx, 'tension ' + Math.round(t * 100) + '%', s.x, s.y - 8, { color: C.teal, size: 10 });
      ctx.restore();
    }
  }

  function drawForces(ctx, lock, v) {
    const pins = new Set(); lock.pins.forEach(p => { pins.add(p.driver); pins.add(p.key); });
    const scale = 0.022;
    for (const c of lock.world.contacts) {
      if (!pins.has(c.A) && !pins.has(c.B)) continue;
      const f = Math.min(c.force, 2500);
      if (f < 20) continue;
      const on = pins.has(c.B) ? c.B : c.A;
      const sign = on === c.B ? 1 : -1;
      const pt = on === c.B ? c.B.toWorld(c.lb.x, c.lb.y) : c.A.toWorld(c.la.x, c.la.y);
      const other = on === c.B ? c.A : c.B;
      const col = other === lock.plug ? C.rose : other === lock.housing ? C.muted : other === lock.pick ? C.ink : C.teal;
      arrow(ctx, pt.x, pt.y, pt.x + sign * c.nx * f * scale, pt.y + sign * c.ny * f * scale, col, 1.2 / v.s, 4 / v.s);
    }
    for (const p of lock.pins) {
      const [a] = p.spring.endpoints();
      const f = p.spring.tension;
      arrow(ctx, a.x, a.y, a.x, a.y + f * scale, C.muted, 1.2 / v.s, 4 / v.s);
    }
  }

  function drawFalseSetCallouts(ctx, lock, v) {
    const p = lock.pins[0], st = lock.pinState(0), g = lock.geom;
    if (st.state !== 'caught') return;
    const P = toS(v, lock.plug.x + p.x + p.offset - g.W / 2 - g.clr, 0);
    ctx.strokeStyle = C.rose; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(P.x, P.y, 13, 0, Math.PI * 2); ctx.stroke();
    const t1 = toS(v, g.xMin - 140, g.Pb * 0.45);
    ctx.beginPath(); ctx.moveTo(P.x - 10, P.y + 8); ctx.lineTo(t1.x + 150, t1.y - 14); ctx.stroke();
    label(ctx, 'The wide end catches', t1.x, t1.y, { size: 12, weight: 500 });
    label(ctx, 'on the edge of the hole.', t1.x, t1.y + 15, { size: 12, weight: 500 });
    const waist = p.driver.toWorld(0, 0);
    const W1 = toS(v, waist.x + 4, waist.y), t2 = toS(v, g.xMax + 46, g.yTop * 0.55);
    ctx.strokeStyle = C.muted; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W1.x, W1.y); ctx.lineTo(t2.x - 4, t2.y - 4); ctx.stroke();
    label(ctx, 'The narrow waist', t2.x, t2.y, { size: 12, weight: 500 });
    label(ctx, 'gives the plug room.', t2.x, t2.y + 15, { size: 12, weight: 500 });
  }

  /** Front view of the plug (key lesson): shows whether it can turn. */
  function drawFrontInset(ctx, cx, cy, r, angle, blocked) {
    ctx.save();
    ctx.fillStyle = C.housing; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.fillStyle = C.tealSoft; ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.rose; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.ink; ctx.fillRect(-r * 0.07, -r * 0.1, r * 0.14, r * 0.55); // keyway
    ctx.fillStyle = blocked ? C.mustard : C.teal; ctx.fillRect(-r * 0.12, -r * 0.66 - 1, r * 0.24, r * 0.3); // pin hole
    ctx.restore();
    label(ctx, 'FRONT VIEW', cx, cy + r + 14, { align: 'center', color: C.muted, size: 9.5 });
  }

  // --------------------------------------------------------- pin icons
  function pinIcon(ctx, type, cx, cy, h) {
    const Locks = root.Locks;
    const shapes = Locks.PIN_TYPES[type].driver(30, 60);
    const s = h / 60;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    const verts = shapes.map(sh => sh.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p));
    ctx.beginPath(); for (const v of verts) polyPath(ctx, v);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4 / s * 0.9; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); for (const v of verts) polyPath(ctx, v);
    ctx.fillStyle = C.mustard; ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------- combination
  function comboBounds(lock) {
    const R = lock.cfg.R, top = lock.cy(0) - R, bot = lock.cy(2) + R;
    return { x0: -380, x1: R + 400, y0: Math.min(top, -200) - 14, y1: bot + 24 };
  }
  function drawCombo(ctx, lock, v, o = {}) {
    worldT(ctx, v);
    const R = lock.cfg.R, lw = 1.3 / v.s;
    // padlock with dial
    const dx = -260, dy = 0, dr = 78;
    const lift = o.shackleLift || 0;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = C.muted; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(dx - 46, dy - 40 - lift); ctx.lineTo(dx - 46, dy - 150 - lift);
    ctx.arc(dx, dy - 150 - lift, 46, Math.PI, 0); ctx.lineTo(dx + 46, dy - 40 - lift * (lift > 0 ? 1 : 0)); ctx.stroke();
    ctx.fillStyle = C.housing; ctx.beginPath(); ctx.arc(dx, dy, dr + 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.stroke();
    ctx.save(); ctx.translate(dx, dy); ctx.rotate(lock.dial.a);
    ctx.fillStyle = C.dial; ctx.beginPath(); ctx.arc(0, 0, dr, 0, Math.PI * 2); ctx.fill();
    const N = lock.cfg.numbers;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + i / N * Math.PI * 2;
      const r0 = i % 5 === 0 ? dr - 14 : dr - 9;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * (dr - 3), Math.sin(a) * (dr - 3)); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.font = `700 13px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < N; i += 5) {
      const a = -Math.PI / 2 + i / N * Math.PI * 2;
      ctx.save(); ctx.translate(Math.cos(a) * (dr - 27), Math.sin(a) * (dr - 27)); ctx.rotate(a + Math.PI / 2); ctx.fillText(String(i), 0, 0); ctx.restore();
    }
    ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // pointer
    ctx.fillStyle = C.rose; ctx.beginPath(); ctx.moveTo(dx - 9, dy - dr - 16); ctx.lineTo(dx + 9, dy - dr - 16); ctx.lineTo(dx, dy - dr - 2); ctx.closePath(); ctx.fill();

    if (o.dialOnly) {
      screenT(ctx, v);
      const nn = toS(v, dx, dy + dr + 40);
      label(ctx, String(lock.numAt(lock.dial.a)), nn.x, nn.y, { align: 'center', size: 16, color: C.ink });
      return;
    }
    // linkage hint
    ctx.strokeStyle = C.line; ctx.setLineDash([5, 5]); ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(dx + dr + 16, dy); ctx.lineTo(-R - 22, dy); ctx.stroke(); ctx.setLineDash([]);

    // wheels
    lock.wheels.forEach((w, i) => {
      const al = lock.wheelAligned(i);
      drawBody(ctx, w, C.mustard, al ? C.teal : C.ink, al ? lw * 1.8 : lw);
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(w.x, w.y, 5, 0, Math.PI * 2); ctx.fill();
      // drive pin marker
      const pp = w.toWorld(-R * 0.62 * Math.cos(lock.gateLocal[i]), -R * 0.62 * Math.sin(lock.gateLocal[i]));
      ctx.fillStyle = C.pick; ctx.beginPath(); ctx.arc(pp.x, pp.y, 3.2, 0, Math.PI * 2); ctx.fill();
    });
    // fence: teeth + bar
    const f = lock.fence;
    drawBody(ctx, f, C.teal, null, 0);
    ctx.fillStyle = C.teal;
    ctx.fillRect(f.x + 12, lock.cy(0) - R * 0.8, 9, lock.cy(2) - lock.cy(0) + R * 1.6);

    screenT(ctx, v);
    lock.wheels.forEach((w, i) => {
      const s = toS(v, -R - 8, w.y);
      label(ctx, 'wheel ' + (i + 1), s.x, s.y + 4, { align: 'right', color: lock.wheelAligned(i) ? C.teal : C.muted, size: 10.5 });
    });
    if (!o.poster && !o.dialOnly) {
      const c3 = toS(v, R + 250, 18);
      label(ctx, 'THE SAME PARTS, AS BUILT', c3.x, toS(v, 0, lock.cy(0) - R).y, { align: 'center', color: C.teal, size: 11 });
      drawCombo3D(ctx, lock, c3.x, c3.y, v.s * 1.4, { fontSize: 10.5 });
    }
    const fl = toS(v, f.x + 26, lock.cy(0) - R * 0.6);
    label(ctx, 'fence', fl.x, fl.y, { color: C.teal, size: 11 });
    if (lock.ctl.shackle > 0.02) {
      const a = toS(v, f.x + 90, 0);
      arrow(ctx, a.x, a.y, a.x - 16 - 40 * lock.ctl.shackle, a.y, C.teal, 2.5, 8);
      if (!o.poster) label(ctx, 'shackle pull', a.x, a.y + 18, { color: C.teal, size: 10, align: 'right' });
    }
    const num = toS(v, dx, dy + dr + 40);
    if (!o.poster) label(ctx, String(lock.numAt(lock.dial.a)), num.x, num.y, { align: 'center', size: 18, color: C.ink });
    if (lock.isOpen()) {
      const c = toS(v, dx, dy - 205);
      label(ctx, 'OPEN', c.x, c.y, { align: 'center', color: '#fff', bg: C.teal, size: 14 });
    }
  }


  // ------------------------------------------------- combination, 3D view
  /**
   * Angled view of the real arrangement: dial, wheels stacked on one axle,
   * and a single fence lying across all the rims. Every angle and the fence
   * depth come from the simulation, so this moves with the flat view.
   * Drawn in screen space around (cx, cy) at s pixels per world unit.
   */
  function drawCombo3D(ctx, lock, cx, cy, s, o = {}) {
    const R = lock.cfg.R, depth = lock.cfg.gateDepth, half = lock.cfg.gateHalf;
    const yaw = o.yaw ?? 0.82, pitch = o.pitch ?? 0.55;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const T = 12, pitchZ = 30;                      // wheel thickness and spacing on the axle
    // order along the axle from the dial: wheel 3, wheel 2, wheel 1
    const order = [2, 1, 0];
    const zOf = k => k * pitchZ;                     // k = position from the front
    const zBack = zOf(2) + T / 2 + 6, zFront = -T / 2 - 46;
    const P = (x, y, z) => {
      const x1 = x * cyw - z * syw, zr = x * syw + z * cyw;
      return { x: cx + s * x1, y: cy + s * (y * cp - zr * sp), d: -y * sp + zr * cp };
    };
    const shade = (hex, f) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return hex;
      const n = parseInt(m[1], 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * f));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    };
    const poly = (pts, fill, stroke, lw = 1) => {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
    };
    // wheel outline (with its gate) at the wheel's current angle
    function outline(i, a) {
      const g = lock.gateLocal[i] + a, pts = [], N = 90;
      for (let k = 0; k <= N; k++) {
        const t = g + half + (Math.PI * 2 - 2 * half) * k / N;
        pts.push([R * Math.cos(t), R * Math.sin(t)]);
      }
      const r2 = R - depth;
      pts.push([r2 * Math.cos(g - half), r2 * Math.sin(g - half)], [r2 * Math.cos(g + half), r2 * Math.sin(g + half)]);
      return pts;
    }
    function disc(pts2, z, face, side, edge) {
      const back = pts2.map(([x, y]) => P(x, y, z + T / 2)), front = pts2.map(([x, y]) => P(x, y, z - T / 2));
      poly(back, side, edge, 0.8);
      for (let k = 0; k < pts2.length; k++) {
        const k2 = (k + 1) % pts2.length;
        poly([front[k], front[k2], back[k2], back[k]], side, null);
      }
      poly(front, face, edge, 1.1);
      return front;
    }

    // axle
    const a0 = P(0, 0, zBack + 8), a1 = P(0, 0, zFront - 6);
    ctx.strokeStyle = C.pick; ctx.lineWidth = Math.max(3, 7 * s); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();

    // wheels, farthest first
    for (let k = 2; k >= 0; k--) {
      const i = order[k], w = lock.wheels[i], z = zOf(k);
      const al = lock.wheelAligned(i);
      disc(outline(i, w.a), z, C.mustard, shade(C.mustard, 0.72), al ? C.teal : C.ink);
      // drive pin on the front face, and the hub
      const pa = lock.gateLocal[i] + w.a + Math.PI;
      const pin = P(0.62 * R * Math.cos(pa), 0.62 * R * Math.sin(pa), z - T / 2);
      ctx.fillStyle = C.pick; ctx.beginPath(); ctx.arc(pin.x, pin.y, Math.max(2, 3.2 * s), 0, Math.PI * 2); ctx.fill();
      const hub = P(0, 0, z - T / 2);
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(hub.x, hub.y, Math.max(2, 4.5 * s), 0, Math.PI * 2); ctx.fill();
    }

    // fence: one bar lying across every rim, parallel to the axle
    const f = lock.fence, fx0 = f.x, fx1 = f.x + 9, fy0 = -6, fy1 = 6, fz0 = zOf(0) - T / 2 - 2, fz1 = zOf(2) + T / 2 + 2;
    const V = (x, y, z) => P(x, y, z);
    poly([V(fx0, fy0, fz0), V(fx1, fy0, fz0), V(fx1, fy0, fz1), V(fx0, fy0, fz1)], shade(C.teal, 1.15), C.ink, 0.8); // top
    poly([V(fx1, fy0, fz0), V(fx1, fy1, fz0), V(fx1, fy1, fz1), V(fx1, fy0, fz1)], shade(C.teal, 0.8), C.ink, 0.8);  // side
    poly([V(fx0, fy0, fz0), V(fx1, fy0, fz0), V(fx1, fy1, fz0), V(fx0, fy1, fz0)], C.teal, C.ink, 0.8);               // front
    // shackle pull on the fence
    if (lock.ctl.shackle > 0.02) {
      const q0 = P(fx1 + 46, 0, fz0 + 6), q1 = P(fx1 + 12, 0, fz0 + 6);
      arrow(ctx, q0.x, q0.y, q1.x, q1.y, C.teal, 2, 7);
    }

    // dial in front, with its ticks and the pointer
    const dR = R * 0.95, dz = zFront;
    const ring = [];
    for (let k = 0; k < 72; k++) { const t = k / 72 * Math.PI * 2; ring.push([dR * Math.cos(t), dR * Math.sin(t)]); }
    const back = ring.map(([x, y]) => P(x, y, dz + 5)), front = ring.map(([x, y]) => P(x, y, dz - 5));
    poly(back, shade(C.housing, 0.75), null);
    for (let k = 0; k < 72; k++) poly([front[k], front[(k + 1) % 72], back[(k + 1) % 72], back[k]], shade(C.housing, 0.8), null);
    poly(front, C.dial, C.ink, 1);
    const N = lock.cfg.numbers;
    ctx.strokeStyle = '#fff';
    for (let k = 0; k < N; k++) {
      const t = -Math.PI / 2 + k / N * Math.PI * 2 + lock.dial.a;
      const r0 = k % 5 === 0 ? dR * 0.74 : dR * 0.84;
      const p0 = P(r0 * Math.cos(t), r0 * Math.sin(t), dz - 5), p1 = P(dR * 0.95 * Math.cos(t), dR * 0.95 * Math.sin(t), dz - 5);
      ctx.lineWidth = k === 0 ? 2.4 : k % 5 === 0 ? 1.4 : 0.7;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    const knob = P(0, 0, dz - 5);
    ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(knob.x, knob.y, Math.max(3, 9 * s), 0, Math.PI * 2); ctx.fill();
    const pt = P(0, -dR - 4, dz - 5), pl = P(-6, -dR - 13, dz - 5), pr = P(6, -dR - 13, dz - 5);
    poly([pt, pl, pr], C.rose, null);

    // labels
    if (o.labels !== false) {
      const fs = o.fontSize || 11;
      const lf = P(fx1, fy0, fz1);
      label(ctx, 'fence', lf.x + 6, lf.y - 4, { color: C.teal, size: fs });
      const ld = P(0, dR, dz);
      label(ctx, 'dial', ld.x, ld.y + fs + 6, { color: C.muted, size: fs, align: 'center' });
      const lw = P(0, R, zOf(2) + T / 2);
      if (o.axleLabel !== false) label(ctx, 'wheels on one axle', lw.x + 10, lw.y + fs + 8, { color: C.muted, size: fs, align: 'right' });
    }
  }

  // ------------------------------------------------------------- shim
  function shimBounds(lock) {
    const g = lock.geom;
    return { x0: -90, x1: g.wallX + 30, y0: -160, y1: g.bodyBot + 12 };
  }
  function drawShim(ctx, lock, v, o = {}) {
    const g = lock.geom, lw = 1.3 / v.s;
    worldT(ctx, v);
    rectW(ctx, -80, g.bodyTop, g.wallX + 20, g.bodyBot, C.bore);
    fillShapes(ctx, lock.housing.ws, C.housing);
    // spring
    const [a, b] = lock.spring.endpoints();
    spring(ctx, a.x, a.y, b.x - 2, b.y, 10, 7, C.muted, 1.3 / v.s);
    ctx.fillStyle = C.muted; ctx.fillRect(b.x - 2, b.y - 10, 2.5, 20);
    drawBody(ctx, lock.latch, C.mustard, C.ink, lw);
    drawBody(ctx, lock.shackle, C.steel, C.ink, lw);
    if (lock.shield) drawBody(ctx, lock.shield, C.ink, null, 0);
    drawBody(ctx, lock.shim, C.rose, C.ink, lw * 0.7);
    if (lock.cfg.deadlocked) {
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(lock.latch.x + 76, g.latchY, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (o.overlay) {
      for (const c of lock.world.contacts) {
        if (c.force < 20) continue;
        const pt = c.B.toWorld(c.lb.x, c.lb.y), s = 0.03;
        arrow(ctx, pt.x, pt.y, pt.x + c.nx * c.force * s, pt.y + c.ny * c.force * s, C.ink, 1.2 / v.s, 4 / v.s);
      }
    }
    screenT(ctx, v);
    const L = (t, x, y, col, al) => { const s = toS(v, x, y); label(ctx, t, s.x, s.y, { color: col || C.ink, size: 11, align: al || 'left' }); };
    L('shackle', -10, -152 + lock.shackle.y, C.muted, 'right');
    L('latch', lock.latch.x + 30, g.latchY + g.latchH / 2 + 18, C.ink);
    L('spring', g.wallX - 40, g.latchY - 16, C.muted);
    L('shim', g.sw + 8, lock.shim.y - 120, C.rose);
    if (lock.shield) L('shield', g.gapR + 4, g.bodyTop + 14, C.ink);
    if (lock.cfg.deadlocked) L('blocked', lock.latch.x + 86, g.latchY + 4, C.ink);
    if (lock.isOpen()) { const c = toS(v, 30, -110); label(ctx, 'SHACKLE LIFTS', c.x, c.y, { color: '#fff', bg: C.teal, size: 13 }); }
  }

  root.Render = {
    readColors, fitView, worldT, screenT, toS, toW, label, arrow, roundRect,
    pinBounds, drawPinLock, drawFrontInset, pinIcon, comboBounds, drawCombo, drawCombo3D, shimBounds, drawShim,
  };
})(window);
