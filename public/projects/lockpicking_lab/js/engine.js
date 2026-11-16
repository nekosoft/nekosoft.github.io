/*
 * LockLab physics engine
 * ----------------------
 * A small 2D rigid-body engine built on Extended Position-Based Dynamics
 * (XPBD; Müller et al., "Detailed Rigid Body Simulation with Extended
 * Position Based Dynamics", 2020).
 *
 *  - Bodies are compounds of convex polygons.
 *  - Each body can have its x, y or rotation locked (per-axis inverse mass),
 *    which is how a plug "turns" (slides along x in side view) while a pin
 *    rides in its bore.
 *  - Contacts: separating-axis test plus edge clipping (up to two points per
 *    polygon pair), solved as position constraints every substep.
 *  - Friction: Coulomb. Static friction is a positional constraint; dynamic
 *    friction is applied in the velocity pass, capped at mu * normal force.
 *
 * Coordinates are y-down (screen space). Units are arbitrary "world units".
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- helpers
  const EPS = 1e-9;
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;

  function polyArea(v) {
    let a = 0;
    for (let i = 0; i < v.length; i++) {
      const p = v[i], q = v[(i + 1) % v.length];
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  }

  /** Copy a polygon and make its winding positive (outward normals work). */
  function normalizePoly(verts) {
    const v = verts.map(p => ({ x: p.x !== undefined ? p.x : p[0], y: p.y !== undefined ? p.y : p[1] }));
    if (polyArea(v) < 0) v.reverse();
    return v;
  }

  /** Second moment of area of a polygon about the origin. */
  function polySecondMoment(v) {
    let num = 0;
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      const c = Math.abs(cross(a.x, a.y, b.x, b.y));
      num += c * (a.x * a.x + a.y * a.y + a.x * b.x + a.y * b.y + b.x * b.x + b.y * b.y);
    }
    return num / 12;
  }

  const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

  // ------------------------------------------------------------------- body
  let NEXT_ID = 1;

  class Body {
    /**
     * @param {object} o
     *  shapes: array of convex polygons (local coords)
     *  mass, inertia (optional, computed from shapes)
     *  static, kinematic, lockX, lockY, lockRot
     *  friction, linDamp, angDamp, gravityScale
     *  layer, mask: collision bitmasks
     */
    constructor(o = {}) {
      this.id = NEXT_ID++;
      this.name = o.name || 'body' + this.id;
      this.x = o.x || 0; this.y = o.y || 0; this.a = o.angle || 0;
      this.vx = 0; this.vy = 0; this.w = 0;
      this.px = this.x; this.py = this.y; this.pa = this.a;
      this.fx = 0; this.fy = 0; this.tq = 0;
      this.static = !!o.static;
      this.kinematic = !!o.kinematic;
      this.shapes = (o.shapes || []).map(normalizePoly);
      this.mass = o.mass || 1;
      let I = o.inertia;
      if (I === undefined) {
        let area = 0, mom = 0;
        for (const s of this.shapes) { area += Math.abs(polyArea(s)); mom += polySecondMoment(s); }
        I = area > EPS ? this.mass * mom / area : this.mass * 100;
      }
      this.inertia = I;
      const fixed = this.static || this.kinematic;
      this.imx = fixed || o.lockX ? 0 : 1 / this.mass;
      this.imy = fixed || o.lockY ? 0 : 1 / this.mass;
      this.ii = fixed || o.lockRot ? 0 : 1 / I;
      this.friction = o.friction !== undefined ? o.friction : 0.3;
      this.linDamp = o.linDamp || 0;
      this.angDamp = o.angDamp || 0;
      this.gravityScale = o.gravityScale !== undefined ? o.gravityScale : 1;
      this.layer = o.layer !== undefined ? o.layer : 1;
      this.mask = o.mask !== undefined ? o.mask : 0xffffffff;
      this.style = o.style || {};
      this.data = o.data || {};
      // kinematic target for this frame
      this.kTarget = null;
      this._kStep = null;
      // world-space cache
      this.ws = this.shapes.map(s => ({
        v: s.map(() => ({ x: 0, y: 0 })),
        n: s.map(() => ({ x: 0, y: 0 })),
        minX: 0, minY: 0, maxX: 0, maxY: 0,
      }));
      this.updateWorld();
    }

    get isDynamic() { return !this.static && !this.kinematic; }

    updateWorld() {
      const c = Math.cos(this.a), s = Math.sin(this.a);
      for (let k = 0; k < this.shapes.length; k++) {
        const src = this.shapes[k], dst = this.ws[k];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < src.length; i++) {
          const p = src[i], q = dst.v[i];
          q.x = this.x + c * p.x - s * p.y;
          q.y = this.y + s * p.x + c * p.y;
          if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x;
          if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y;
        }
        for (let i = 0; i < src.length; i++) {
          const a = dst.v[i], b = dst.v[(i + 1) % src.length];
          let nx = b.y - a.y, ny = -(b.x - a.x);
          const L = Math.hypot(nx, ny) || 1;
          dst.n[i].x = nx / L; dst.n[i].y = ny / L;
        }
        dst.minX = minX; dst.minY = minY; dst.maxX = maxX; dst.maxY = maxY;
      }
    }

    toWorld(lx, ly) {
      const c = Math.cos(this.a), s = Math.sin(this.a);
      return { x: this.x + c * lx - s * ly, y: this.y + s * lx + c * ly };
    }
    toLocal(wx, wy) {
      const c = Math.cos(this.a), s = Math.sin(this.a);
      const dx = wx - this.x, dy = wy - this.y;
      return { x: c * dx + s * dy, y: -s * dx + c * dy };
    }
    /** Velocity of a world point attached to this body. */
    pointVel(wx, wy) {
      return { x: this.vx - this.w * (wy - this.y), y: this.vy + this.w * (wx - this.x) };
    }
    applyForce(fx, fy, wx, wy) {
      this.fx += fx; this.fy += fy;
      if (wx !== undefined) this.tq += cross(wx - this.x, wy - this.y, fx, fy);
    }
    /** Lowest / highest world y over all shapes (y-down: max = "bottom"). */
    bottom() { let m = -Infinity; for (const s of this.ws) if (s.maxY > m) m = s.maxY; return m; }
    top() { let m = Infinity; for (const s of this.ws) if (s.minY < m) m = s.minY; return m; }

    /** Generalised inverse mass for a correction along n applied at offset r. */
    wAlong(rx, ry, nx, ny) {
      const cr = rx * ny - ry * nx;
      return this.imx * nx * nx + this.imy * ny * ny + this.ii * cr * cr;
    }
    /** Apply a positional impulse p at offset r. */
    applyPosImpulse(px, py, rx, ry) {
      this.x += this.imx * px; this.y += this.imy * py;
      this.a += this.ii * cross(rx, ry, px, py);
    }
    applyVelImpulse(px, py, rx, ry) {
      this.vx += this.imx * px; this.vy += this.imy * py;
      this.w += this.ii * cross(rx, ry, px, py);
    }
  }

  // ------------------------------------------------------- collision (SAT)
  function maxSeparation(A, B) {
    let best = -Infinity, idx = 0;
    const na = A.v.length, nb = B.v.length;
    for (let i = 0; i < na; i++) {
      const n = A.n[i], v = A.v[i];
      let mn = Infinity;
      for (let j = 0; j < nb; j++) {
        const d = n.x * (B.v[j].x - v.x) + n.y * (B.v[j].y - v.y);
        if (d < mn) mn = d;
      }
      if (mn > best) { best = mn; idx = i; }
    }
    return [best, idx];
  }

  function clipSegment(p, q, nx, ny, off) {
    // keep part where n.x*x + n.y*y <= off
    const dp = nx * p.x + ny * p.y - off, dq = nx * q.x + ny * q.y - off;
    const out = [];
    if (dp <= 0) out.push(p);
    if (dq <= 0) out.push(q);
    if (dp * dq < 0) {
      const t = dp / (dp - dq);
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
    return out;
  }

  /** Returns {nx, ny, pts:[{ax,ay,bx,by,depth}]} with n pointing from A to B, or null. */
  function collidePolys(A, B) {
    const [sa, ia] = maxSeparation(A, B);
    if (sa > 0) return null;
    const [sb, ib] = maxSeparation(B, A);
    if (sb > 0) return null;
    let ref, inc, ri, flip;
    if (sb > sa + 1e-4) { ref = B; inc = A; ri = ib; flip = true; }
    else { ref = A; inc = B; ri = ia; flip = false; }
    const n = ref.n[ri];
    let ii = 0, mn = Infinity;
    for (let i = 0; i < inc.n.length; i++) {
      const d = inc.n[i].x * n.x + inc.n[i].y * n.y;
      if (d < mn) { mn = d; ii = i; }
    }
    const v1 = inc.v[ii], v2 = inc.v[(ii + 1) % inc.v.length];
    const r1 = ref.v[ri], r2 = ref.v[(ri + 1) % ref.v.length];
    let tx = r2.x - r1.x, ty = r2.y - r1.y;
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    let pts = clipSegment(v1, v2, -tx, -ty, -(tx * r1.x + ty * r1.y));
    if (pts.length < 2) return null;
    pts = clipSegment(pts[0], pts[1], tx, ty, tx * r2.x + ty * r2.y);
    if (pts.length < 2) return null;
    const res = { nx: flip ? -n.x : n.x, ny: flip ? -n.y : n.y, pts: [] };
    for (const p of pts) {
      const sep = n.x * (p.x - r1.x) + n.y * (p.y - r1.y);
      if (sep <= 0) {
        const rx = p.x - n.x * sep, ry = p.y - n.y * sep; // projected onto ref face
        if (!flip) res.pts.push({ ax: rx, ay: ry, bx: p.x, by: p.y, depth: -sep });
        else res.pts.push({ ax: p.x, ay: p.y, bx: rx, by: ry, depth: -sep });
      }
    }
    return res.pts.length ? res : null;
  }

  // ------------------------------------------------------------------ world
  class World {
    constructor(o = {}) {
      this.gx = o.gx || 0; this.gy = o.gy !== undefined ? o.gy : 0;
      this.substeps = o.substeps || 20;
      this.iterations = o.iterations || 1;
      this.bodies = [];
      this.forceFns = [];      // (h, world) => apply forces, every substep
      this.postIntegrate = []; // (h, world) => drive kinematic axes
      this.constraints = [];   // objects with solve(h)
      this.noCollide = new Set();
      this.contacts = [];      // last substep's contacts (for rendering/inspection)
      this.time = 0;
      this.onContact = null;
    }
    add(b) { this.bodies.push(b); return b; }
    ignore(a, b) { this.noCollide.add(a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id); }
    canCollide(a, b) {
      if (!a.isDynamic && !b.isDynamic) return false;
      if (!(a.layer & b.mask) || !(b.layer & a.mask)) return false;
      if (this.noCollide.has(a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id)) return false;
      return true;
    }

    detect() {
      const out = [];
      const bs = this.bodies;
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const A = bs[i], B = bs[j];
          if (!this.canCollide(A, B)) continue;
          for (let si = 0; si < A.ws.length; si++) {
            const sa = A.ws[si];
            for (let sj = 0; sj < B.ws.length; sj++) {
              const sb = B.ws[sj];
              if (sa.maxX < sb.minX || sb.maxX < sa.minX || sa.maxY < sb.minY || sb.maxY < sa.minY) continue;
              const m = collidePolys(sa, sb);
              if (!m) continue;
              for (const p of m.pts) {
                out.push({
                  A, B, nx: m.nx, ny: m.ny,
                  la: A.toLocal(p.ax, p.ay), lb: B.toLocal(p.bx, p.by),
                  lambdaN: 0, force: 0, depth0: p.depth,
                  mu: Math.sqrt(A.friction * B.friction),
                });
              }
            }
          }
        }
      }
      return out;
    }

    step(dt) {
      const n = this.substeps, h = dt / n;
      for (const b of this.bodies) {
        if (b.kinematic && b.kTarget) {
          b._kStep = { x: (b.kTarget.x - b.x) / n, y: (b.kTarget.y - b.y) / n, a: ((b.kTarget.a ?? b.a) - b.a) / n };
        } else b._kStep = null;
      }
      let lastContacts = [];
      for (let s = 0; s < n; s++) {
        // forces
        for (const b of this.bodies) { b.fx = 0; b.fy = 0; b.tq = 0; }
        for (const f of this.forceFns) f(h, this);
        // integrate
        for (const b of this.bodies) {
          b.px = b.x; b.py = b.y; b.pa = b.a;
          if (b.static) continue;
          if (b.kinematic) {
            if (b._kStep) { b.x += b._kStep.x; b.y += b._kStep.y; b.a += b._kStep.a; }
            continue;
          }
          if (b.imx) b.vx += h * (b.fx * b.imx + this.gx * b.gravityScale);
          if (b.imy) b.vy += h * (b.fy * b.imy + this.gy * b.gravityScale);
          if (b.ii) b.w += h * b.tq * b.ii;
          if (b.linDamp) { const d = Math.max(0, 1 - b.linDamp * h); b.vx *= d; b.vy *= d; }
          if (b.angDamp) { b.w *= Math.max(0, 1 - b.angDamp * h); }
          if (!b.imx) b.vx = 0; if (!b.imy) b.vy = 0; if (!b.ii) b.w = 0;
          b.x += h * b.vx; b.y += h * b.vy; b.a += h * b.w;
        }
        for (const f of this.postIntegrate) f(h, this);
        for (const b of this.bodies) b.updateWorld();

        // positional solve
        const contacts = this.detect();
        for (let it = 0; it < this.iterations; it++) {
          for (const c of contacts) this.solveContact(c);
          for (const k of this.constraints) k.solve(h, this);
        }

        // velocities
        for (const b of this.bodies) {
          if (b.static) continue;
          b.vx = (b.x - b.px) / h; b.vy = (b.y - b.py) / h; b.w = (b.a - b.pa) / h;
        }
        // velocity solve: dynamic friction + restitution-free normal damping
        for (const c of contacts) {
          if (c.lambdaN <= 0) continue;
          c.force = c.lambdaN / (h * h);
          this.solveFrictionVel(c, h);
        }
        for (const k of this.constraints) if (k.solveVel) k.solveVel(h, this);
        for (const b of this.bodies) b.updateWorld();
        lastContacts = contacts;
      }
      this.contacts = lastContacts.filter(c => c.lambdaN > 0);
      this.time += dt;
    }

    solveContact(c) {
      const { A, B } = c;
      const pa = A.toWorld(c.la.x, c.la.y), pb = B.toWorld(c.lb.x, c.lb.y);
      const nx = c.nx, ny = c.ny;
      const d = (pa.x - pb.x) * nx + (pa.y - pb.y) * ny; // penetration
      if (d <= 0) return;
      const rax = pa.x - A.x, ray = pa.y - A.y, rbx = pb.x - B.x, rby = pb.y - B.y;
      const w = A.wAlong(rax, ray, nx, ny) + B.wAlong(rbx, rby, nx, ny);
      if (w < EPS) return;
      const dl = d / w;
      c.lambdaN += dl;
      A.applyPosImpulse(-dl * nx, -dl * ny, rax, ray);
      B.applyPosImpulse(dl * nx, dl * ny, rbx, rby);

      // static friction
      const pa2 = A.toWorld(c.la.x, c.la.y), pb2 = B.toWorld(c.lb.x, c.lb.y);
      const ca = Math.cos(A.pa), sa = Math.sin(A.pa), cb = Math.cos(B.pa), sb = Math.sin(B.pa);
      const paPrev = { x: A.px + ca * c.la.x - sa * c.la.y, y: A.py + sa * c.la.x + ca * c.la.y };
      const pbPrev = { x: B.px + cb * c.lb.x - sb * c.lb.y, y: B.py + sb * c.lb.x + cb * c.lb.y };
      let dx = (pa2.x - paPrev.x) - (pb2.x - pbPrev.x);
      let dy = (pa2.y - paPrev.y) - (pb2.y - pbPrev.y);
      const dn = dx * nx + dy * ny;
      dx -= dn * nx; dy -= dn * ny;
      const dt = Math.hypot(dx, dy);
      if (dt < EPS) return;
      const tx = dx / dt, ty = dy / dt;
      const r2ax = pa2.x - A.x, r2ay = pa2.y - A.y, r2bx = pb2.x - B.x, r2by = pb2.y - B.y;
      const wt = A.wAlong(r2ax, r2ay, tx, ty) + B.wAlong(r2bx, r2by, tx, ty);
      if (wt < EPS) return;
      const lt = dt / wt;
      if (lt < c.mu * c.lambdaN) {
        A.applyPosImpulse(-lt * tx, -lt * ty, r2ax, r2ay);
        B.applyPosImpulse(lt * tx, lt * ty, r2bx, r2by);
        c.stuck = true;
      }
    }

    solveFrictionVel(c, h) {
      const { A, B } = c;
      const pa = A.toWorld(c.la.x, c.la.y), pb = B.toWorld(c.lb.x, c.lb.y);
      const va = A.pointVel(pa.x, pa.y), vb = B.pointVel(pb.x, pb.y);
      let vx = va.x - vb.x, vy = va.y - vb.y;
      const vn = vx * c.nx + vy * c.ny;
      vx -= vn * c.nx; vy -= vn * c.ny;
      const vt = Math.hypot(vx, vy);
      if (vt < EPS) return;
      const tx = vx / vt, ty = vy / vt;
      const dv = Math.min(h * c.mu * c.force, vt);
      const rax = pa.x - A.x, ray = pa.y - A.y, rbx = pb.x - B.x, rby = pb.y - B.y;
      const w = A.wAlong(rax, ray, tx, ty) + B.wAlong(rbx, rby, tx, ty);
      if (w < EPS) return;
      const p = dv / w;
      A.applyVelImpulse(-p * tx, -p * ty, rax, ray);
      B.applyVelImpulse(p * tx, p * ty, rbx, rby);
    }

    /** Sum of contact normal forces between two bodies (last substep). */
    forceBetween(a, b) {
      let f = 0;
      for (const c of this.contacts) if ((c.A === a && c.B === b) || (c.A === b && c.B === a)) f += c.force;
      return f;
    }
    /** Sum of contact force vectors acting ON body `on` FROM body `from`. */
    forceVecOn(on, from) {
      let fx = 0, fy = 0;
      for (const c of this.contacts) {
        if (c.A === from && c.B === on) { fx += c.force * c.nx; fy += c.force * c.ny; }
        else if (c.A === on && c.B === from) { fx -= c.force * c.nx; fy -= c.force * c.ny; }
      }
      return { x: fx, y: fy };
    }
  }

  // ------------------------------------------------------------ constraints
  /** Clamp one coordinate of a body to [min, max]. */
  class AxisLimit {
    constructor(body, axis, min, max) { this.body = body; this.axis = axis; this.min = min; this.max = max; this.lambda = 0; }
    solve() {
      const b = this.body, k = this.axis;
      if (b[k] > this.max) b[k] = this.max;
      else if (b[k] < this.min) b[k] = this.min;
    }
  }

  /** Lost-motion coupling: (a.a - b.a) stays within [min, max]. Used for combination-lock drive pins. */
  class RelAngleLimit {
    constructor(a, b, min, max) { this.a = a; this.b = b; this.min = min; this.max = max; this.engaged = 0; }
    solve() {
      const d = this.a.a - this.b.a;
      let C = 0;
      if (d > this.max) C = d - this.max; else if (d < this.min) C = d - this.min;
      this.engaged = C === 0 ? 0 : Math.sign(C);
      if (!C) return;
      const w = this.a.ii + this.b.ii;
      if (w < EPS) return;
      this.a.a -= this.a.ii * C / w;
      this.b.a += this.b.ii * C / w;
    }
  }

  /** Linear spring between a body point and a world anchor (or another body). */
  class Spring {
    constructor(o) {
      Object.assign(this, { k: 10, damping: 0, rest: 50, local: { x: 0, y: 0 }, anchor: { x: 0, y: 0 }, bodyB: null, localB: null }, o);
      this.length = this.rest; this.tension = 0;
    }
    endpoints() {
      const p = this.body.toWorld(this.local.x, this.local.y);
      const q = this.bodyB ? this.bodyB.toWorld(this.localB.x, this.localB.y) : this.anchor;
      return [p, q];
    }
    apply() {
      const [p, q] = this.endpoints();
      let dx = q.x - p.x, dy = q.y - p.y;
      const L = Math.hypot(dx, dy) || 1e-6; dx /= L; dy /= L;
      const v = this.body.pointVel(p.x, p.y);
      let rel = -(v.x * dx + v.y * dy);
      if (this.bodyB) { const vb = this.bodyB.pointVel(q.x, q.y); rel += vb.x * dx + vb.y * dy; }
      // positive f = compressed spring pushes the ends apart
      const f = this.k * (this.rest - L) + this.damping * rel;
      this.length = L; this.tension = f;
      this.body.applyForce(-f * dx, -f * dy, p.x, p.y);
      if (this.bodyB) this.bodyB.applyForce(f * dx, f * dy, q.x, q.y);
    }
  }

  const Engine = { Body, World, AxisLimit, RelAngleLimit, Spring, collidePolys, normalizePoly, rect, polyArea };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
