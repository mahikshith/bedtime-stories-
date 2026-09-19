/**
 * The Bloops: soft, round, cheerful, and made of one circle each.
 *
 * A true soft body — a ring of particles held out by internal pressure — is
 * the honest way to do this and the wrong way to do it here. Twenty of them at
 * sixty frames a second on a five-year-old's hand-me-down phone is not a
 * budget that exists.
 *
 * But the jelly feeling does not actually come from the simulation. It comes
 * from three things you can see: the squash when something lands, the stretch
 * when it falls fast, and the wobble afterwards that takes a moment to settle.
 * All three are cheap if you SIMULATE A CIRCLE AND DRAW A JELLY — the body is
 * a point mass, and the deformation lives entirely in the draw call.
 *
 * The merged form is one big Bloop wearing everybody's faces, which is both
 * how the original looks and far cheaper than keeping twenty bodies in a hug.
 */

import { C, alpha, mix } from "../../core/palette.js";

/**
 * Six colours, each with its own voice.
 *
 * The note matters as much as the colour: the flock is a chord, and a child
 * picking up a new Bloop hears the harmony gain a part. The degrees are the
 * major pentatonic (0, 2, 4, 7, 9 and the octave), which is the trick that
 * makes it safe — every subset of those notes is consonant, so there is no
 * group of Bloops a child can collect that sounds wrong.
 */
export const KINDS = {
  sun:   { body: "#FFC61E", dark: "#D18B00", shine: "#FFE86B", degree: 0 },
  berry: { body: "#FF4FB4", dark: "#C21A7E", shine: "#FF9AD8", degree: 2 },
  sky:   { body: "#42B6F5", dark: "#1272B0", shine: "#9BDDFF", degree: 4 },
  leaf:  { body: "#5CC22B", dark: "#357A12", shine: "#A6EE6B", degree: 7 },
  plum:  { body: "#9B5CF6", dark: "#6428BE", shine: "#CBA6FF", degree: 9 },
  coral: { body: "#FF6A3D", dark: "#C23A12", shine: "#FFA87F", degree: 12 },
};
export const KIND_IDS = Object.keys(KINDS);

/** Radius of a flock of `n`, so area grows with the count rather than width. */
export const radiusFor = (n, base = 30) => base * Math.sqrt(n);

/**
 * Where the faces sit inside a merged body.
 *
 * Spread on a phyllotaxis spiral — the sunflower-seed arrangement — rather
 * than a ring. A ring is fine for three faces and hopeless for twenty: they
 * crowd shoulder to shoulder around the rim and leave the middle empty, and
 * some end up half over the edge. The spiral fills the disc evenly at every
 * count, which is exactly the problem sunflowers already solved.
 */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const faceLayout = (n) => Array.from({ length: n }, (_, i) => ({
  a: i * GOLDEN,
  // sqrt keeps the density even; 0.58 keeps the outermost face inside the skin
  d: n === 1 ? 0 : 0.58 * Math.sqrt((i + 0.5) / n),
  t: i * 1.7,
}));

export class Bloop {
  constructor({ x, y, kind = "sun", count = 1, base = 30 }) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.kind = kind;
    this.count = count;
    this.base = base;
    this.r = radiusFor(count, base);

    // Deformation state, all of it purely visual.
    this.squash = 0;        // how flat, 0..~0.45
    this.squashV = 0;       // its spring velocity, which is what makes it wobble
    this.squashA = 0;       // the angle it is flattened along
    this.spin = 0;          // rolling angle, for the face to lean into
    this.grounded = false;
    this.groundT = 0;
    this.happy = 0;         // eyes squeeze shut for a moment when something good happens
    this.seed = Math.random() * 10;
    this.faces = faceLayout(count);
  }

  setCount(n) {
    this.count = Math.max(1, n);
    this.r = radiusFor(this.count, this.base);
    this.faces = faceLayout(this.count);
  }

  /**
   * One physics step.
   *
   * @param {number} dt
   * @param {{x:number,y:number}} g  gravity, already rotated by the world tilt
   * @param {import("./terrain.js").Terrain} terrain
   */
  step(dt, g, terrain, opts = {}) {
    this.vx += g.x * dt;
    this.vy += g.y * dt;

    // Air drag, mostly so a long drop does not end at an unrecoverable speed.
    const drag = 1 - 0.22 * dt;
    this.vx *= drag; this.vy *= drag;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const hit = terrain.resolve(this, opts);
    this.grounded = hit.hit;
    this.groundT = hit.hit ? 0 : this.groundT + dt;
    if (hit.hit) {
      this.normal = hit;
      if (hit.impact > 90) {
        // Land hard, squash hard — this single line is most of the "soft".
        this.squashV -= Math.min(0.5, hit.impact / 2200);
        this.squashA = Math.atan2(hit.ny, hit.nx);
      }
      // Rolling: spin follows the speed along the surface.
      const tx = -hit.ny, ty = hit.nx;
      this.spin += ((this.vx * tx + this.vy * ty) / Math.max(12, this.r)) * dt;
    } else if (Math.hypot(this.vx, this.vy) > 400) {
      // Falling fast stretches along the direction of travel.
      this.squashA = Math.atan2(this.vy, this.vx) + Math.PI / 2;
      this.squashV += 0.8 * dt;
    }

    // A critically-ish damped spring back to round. Underdamped on purpose:
    // the overshoot is the wobble, and the wobble is the whole personality.
    this.squashV += -this.squash * 46 * dt;
    this.squashV *= 1 - 5.5 * dt;
    this.squash += this.squashV * dt;
    this.squash = Math.max(-0.4, Math.min(0.4, this.squash));

    this.happy = Math.max(0, this.happy - dt);
    return hit;
  }

  cheer(amount = 0.7) {
    this.happy = Math.max(this.happy, amount);
    this.squashV -= 0.3;
  }

  /**
   * A point on the skin, at angle `a`.
   *
   * Squash is applied by SCALING the circle along two axes, not by modulating
   * its radius. Radial modulation is the obvious way and it is wrong: a
   * cos(2θ) term large enough to read as a hard landing also grows a waist,
   * and the Bloop turns into a peanut at exactly the moment it should look
   * most like jelly. Scaling gives an ellipse, which cannot pinch however far
   * it is pushed. Only the small idle wobble is radial, where it belongs.
   */
  _pointAt(a, t) {
    const idle = 1 + 0.022 * Math.sin(a * 3 + t * 2.2 + this.seed) +
                     0.016 * Math.sin(a * 5 - t * 1.6 + this.seed * 2);
    const ux = Math.cos(a) * idle, uy = Math.sin(a) * idle;
    return this._deform(ux, uy);
  }

  /** Apply the squash transform to a unit-circle offset, scaled to radius. */
  _deform(ux, uy) {
    const ca = Math.cos(this.squashA), sa = Math.sin(this.squashA);
    // into the squash frame, scale, and back out again
    const px = ux * ca + uy * sa;
    const py = -ux * sa + uy * ca;
    const along = 1 - this.squash;          // flattened along the impact normal
    const across = 1 + this.squash * 0.62;  // and bulging the other way
    const qx = px * along, qy = py * across;
    return [
      this.x + (qx * ca - qy * sa) * this.r,
      this.y + (qx * sa + qy * ca) * this.r,
    ];
  }

  draw(ctx, t) {
    const kind = KINDS[this.kind] ?? KINDS.sun;
    const STEPS = 30;

    // The body: a closed curve through deformed sample points. Quadratics
    // through the midpoints keep it soft — a polygon of thirty straight edges
    // reads as a cog at this size.
    const pts = [];
    for (let i = 0; i < STEPS; i++) pts.push(this._pointAt((i / STEPS) * Math.PI * 2, t));
    const trace = () => {
      ctx.beginPath();
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      let m = mid(pts[STEPS - 1], pts[0]);
      ctx.moveTo(m[0], m[1]);
      for (let i = 0; i < STEPS; i++) {
        const next = mid(pts[i], pts[(i + 1) % STEPS]);
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], next[0], next[1]);
      }
      ctx.closePath();
    };

    ctx.save();
    trace();
    ctx.fillStyle = kind.dark; ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(0, -this.r * 0.06);
    trace();
    ctx.fillStyle = kind.body; ctx.fill();
    ctx.restore();

    // A single soft highlight, up and to the left, which is what makes a flat
    // disc read as something with a surface.
    ctx.save();
    trace(); ctx.clip();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(this.x - this.r * 0.32, this.y - this.r * 0.42,
      this.r * 0.34, this.r * 0.22, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = kind.shine; ctx.fill();
    ctx.restore();

    for (const f of this.faces) this._face(ctx, f, t, kind);
  }

  /** One face, sitting inside the body and leaning with the roll. */
  _face(ctx, f, t, kind) {
    // Faces ride the same deformation as the skin, so a squashed Bloop's
    // faces spread sideways with it instead of floating in a circle inside an
    // ellipse.
    const wob = Math.sin(t * 1.8 + f.t) * 0.06;
    const a = f.a + this.spin * 0.25 + wob;
    const [fx, fy0] = this._deform(Math.cos(a) * f.d, Math.sin(a) * f.d);
    const fy = fy0 - this.r * 0.04;
    // Faces shrink as the crowd grows. The body's area scales with the count,
    // so a fixed face size fits four and jams twenty.
    const s = Math.min(this.r * 0.46, this.base * 0.66) / (1 + this.count * 0.055);

    const singing = this.happy > 0;
    const lid = singing ? 0.18 : 1;

    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(Math.sin(t * 1.4 + f.t) * 0.08);
    for (const ex of [-s * 0.34, s * 0.34]) {
      ctx.save();
      ctx.translate(ex, -s * 0.12);
      ctx.scale(1, lid);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.16, s * 0.21, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#231B2E"; ctx.fill();
      ctx.restore();
      if (!singing) {
        ctx.beginPath();
        ctx.arc(ex + s * 0.06, -s * 0.2, s * 0.055, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF"; ctx.fill();
      }
    }
    // Mouth: a wide O when singing, a small smile the rest of the time.
    ctx.beginPath();
    if (singing) {
      ctx.ellipse(0, s * 0.3, s * 0.2, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#231B2E"; ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, s * 0.4, s * 0.1, s * 0.11, 0, 0, Math.PI * 2);
      ctx.fillStyle = mix(kind.dark, "#FF6B7A", 0.6); ctx.fill();
    } else {
      ctx.arc(0, s * 0.12, s * 0.24, 0.25 * Math.PI, 0.75 * Math.PI);
      ctx.strokeStyle = "#231B2E"; ctx.lineWidth = Math.max(2, s * 0.1);
      ctx.lineCap = "round"; ctx.stroke();
    }
    ctx.restore();
  }
}
