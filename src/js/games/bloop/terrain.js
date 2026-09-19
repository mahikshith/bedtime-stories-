/**
 * The ground the Bloops roll over.
 *
 * Everything else in this app stands on axis-aligned boxes, which is right for
 * a platformer and completely wrong here. The whole feeling being chased is
 * SWOOP: long curved slides, bowls you build speed in, lips that throw you,
 * tunnels that curl over your head. None of that survives being made of
 * rectangles.
 *
 * So terrain is closed polygons, built from one primitive: a RIBBON. Author a
 * centre-line as a handful of control points, and the ribbon smooths it into a
 * curve and gives it thickness. A hill, a half-pipe, a loop and the roof of a
 * cave are all the same thing with different control points, which keeps the
 * level format small enough to verify.
 *
 * Collision is circle-against-segment, because a Bloop is a circle. It is
 * resolved by pushing out along the segment normal and splitting the velocity
 * into normal (bounce) and tangential (roll) parts — the tangential part is
 * what makes a slope feel like a slide instead of a staircase.
 */

/** Catmull-Rom through the control points, sampled every `step` units. */
export function smooth(points, step = 26) {
  if (points.length < 3) return points.slice();
  const pts = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    const seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(seg / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
               (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
               (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
               (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
               (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/**
 * Turn a centre-line into a closed polygon of the given thickness.
 *
 * `thickness` is offset perpendicular to the curve, so a ribbon works as a
 * floor, a ceiling or a loop depending only on where its points go. A single
 * primitive for all of them is what stops the level format sprawling.
 */
export function ribbon(control, thickness = 90, { smoothStep = 26 } = {}) {
  const line = smooth(control, smoothStep);
  const left = [], right = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const h = thickness / 2;
    left.push([line[i][0] + nx * h, line[i][1] + ny * h]);
    right.push([line[i][0] - nx * h, line[i][1] - ny * h]);
  }
  return left.concat(right.reverse());
}

/**
 * A floor: a curve with solid ground filled in beneath it down to `floorY`.
 *
 * This is the common case and deserves its own helper, because expressing a
 * hillside as a ribbon means authoring its underside too, and nobody should
 * have to think about the underside of a hill.
 */
export function ground(control, floorY, { smoothStep = 26 } = {}) {
  const line = smooth(control, smoothStep);
  const last = line[line.length - 1], first = line[0];
  return line.concat([[last[0], floorY], [first[0], floorY]]);
}

/** A closed ring — the inside is open, the ring itself is solid. */
export function loop(cx, cy, radius, thickness = 80, gapAt = null, steps = 40) {
  const inner = [], outer = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    if (gapAt != null && Math.abs(((a - gapAt + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > Math.PI - 0.5) continue;
    inner.push([cx + Math.cos(a) * (radius - thickness / 2), cy + Math.sin(a) * (radius - thickness / 2)]);
    outer.push([cx + Math.cos(a) * (radius + thickness / 2), cy + Math.sin(a) * (radius + thickness / 2)]);
  }
  return outer.concat(inner.reverse());
}

const BUCKET = 320;

export class Terrain {
  /**
   * @param {Array<{points: number[][], kind?: string}>} shapes
   */
  constructor(shapes) {
    this.shapes = shapes;
    this.segments = [];
    for (const shape of shapes) {
      const p = shape.points;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        if (len < 0.01) continue;
        this.segments.push({
          ax: a[0], ay: a[1], bx: b[0], by: b[1],
          dx, dy, len, inv: 1 / (len * len),
          // Outward normal. Polygons are wound so that this points away from
          // the solid side; a segment whose normal points the wrong way would
          // suck a Bloop through the floor instead of holding it up.
          nx: dy / len, ny: -dx / len,
          kind: shape.kind ?? "solid",
          bounce: shape.bounce ?? 0,
        });
      }
    }
    this._index();
    this.bounds = this.segments.reduce((b, s) => ({
      minX: Math.min(b.minX, s.ax, s.bx), maxX: Math.max(b.maxX, s.ax, s.bx),
      minY: Math.min(b.minY, s.ay, s.by), maxY: Math.max(b.maxY, s.ay, s.by),
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  }

  /** Bucket segments by x so a Bloop only tests the ground it is near. */
  _index() {
    this.buckets = new Map();
    for (const s of this.segments) {
      const lo = Math.floor(Math.min(s.ax, s.bx) / BUCKET);
      const hi = Math.floor(Math.max(s.ax, s.bx) / BUCKET);
      for (let b = lo; b <= hi; b++) {
        if (!this.buckets.has(b)) this.buckets.set(b, []);
        this.buckets.get(b).push(s);
      }
    }
  }

  near(x) {
    const b = Math.floor(x / BUCKET);
    return [
      ...(this.buckets.get(b - 1) ?? []),
      ...(this.buckets.get(b) ?? []),
      ...(this.buckets.get(b + 1) ?? []),
    ];
  }

  /**
   * Resolve a circle against the ground, in place.
   *
   * Returns what happened, because the caller needs it for feel rather than
   * for physics: how hard the landing was drives the squash, and the surface
   * normal tells the Bloop which way "down the hill" is.
   *
   * @returns {{hit: boolean, nx: number, ny: number, impact: number}}
   */
  resolve(body, { bounce = 0.22, friction = 0.02 } = {}) {
    let hit = false, nx = 0, ny = 0, impact = 0;

    // Two passes: pushing out of one segment can push into its neighbour,
    // and a Bloop that ends a frame inside a hill jitters visibly.
    for (let pass = 0; pass < 2; pass++) {
      for (const s of this.near(body.x)) {
        // closest point on the segment
        let t = ((body.x - s.ax) * s.dx + (body.y - s.ay) * s.dy) * s.inv;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = s.ax + s.dx * t, cy = s.ay + s.dy * t;
        let ox = body.x - cx, oy = body.y - cy;
        let d = Math.hypot(ox, oy);
        if (d >= body.r) continue;

        if (d < 0.0001) { ox = s.nx; oy = s.ny; d = 0.0001; }
        const ux = ox / d, uy = oy / d;
        const push = body.r - d;
        body.x += ux * push;
        body.y += uy * push;

        const vn = body.vx * ux + body.vy * uy;
        if (vn < 0) {
          const b = Math.max(bounce, s.bounce);
          impact = Math.max(impact, -vn);
          body.vx -= ux * vn * (1 + b);
          body.vy -= uy * vn * (1 + b);
          // Shed a little speed along the surface, so a Bloop eventually
          // settles in a bowl instead of rocking for ever.
          body.vx -= (body.vx - ux * (body.vx * ux + body.vy * uy)) * friction;
          body.vy -= (body.vy - uy * (body.vx * ux + body.vy * uy)) * friction;
        }
        hit = true; nx += ux; ny += uy;
      }
    }
    const nl = Math.hypot(nx, ny) || 1;
    return { hit, nx: nx / nl, ny: ny / nl, impact };
  }

  /** Is this point inside solid ground? Used by the level verifier. */
  solidAt(x, y) {
    for (const shape of this.shapes) {
      const p = shape.points;
      let inside = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        if ((p[i][1] > y) !== (p[j][1] > y) &&
            x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) {
          inside = !inside;
        }
      }
      if (inside) return true;
    }
    return false;
  }
}
