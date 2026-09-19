/**
 * ASCII level maps.
 *
 * Levels are authored as text so the shape of a level is visible in the
 * source. A designer can see the gap they are asking a child to clear, count
 * the tiles, and tune it without running anything.
 *
 *   .  empty                    #  solid ground
 *   =  one-way platform         %  crumbling platform
 *   I  ice                      B  bouncy spring
 *   >  conveyor right           <  conveyor left
 *   M  horizontal mover         V  vertical mover
 *   -  mover path (right of M)  |  mover path (below V)
 *   ^  spikes                   ~  water
 *   X  saw (moves with its own path marks)
 *   o  star                     *  gem
 *   P  power star (invincible)   Q  grow star (bigger, jumps further)
 *   H  spare heart
 *   W  word gate                K  key      D  door
 *   S  spawn                    G  goal
 *   T  tree      f  flower      r  rock     b  bush
 *
 * Travel for a mover is written into the map itself: `M---` is a platform
 * that slides three tiles to the right, and a `V` with `|` beneath it drops
 * that far. The path is part of the picture, which is the whole point.
 */

import { KIND, HAZARD, TILE } from "./physics.js";

const SOLID_CHARS = "#";
const PROP_CHARS = "Tfrb";

/**
 * Parse a map string into a world description.
 *
 * @param {string} src    the map; leading/trailing blank lines are trimmed
 * @param {object} [opts] {tile}
 */
export function parseMap(src, opts = {}) {
  const tile = opts.tile ?? TILE;
  const rows = src.replace(/^\n+|\n+$/g, "").split("\n");
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => r.padEnd(w, "."));
  const at = (c, r) => (grid[r] && grid[r][c]) || ".";

  const platforms = [];
  const hazards = [];
  const pickups = [];
  const props = [];
  const wordGates = [];
  let spawn = { x: tile, y: tile };
  let goal = null;

  const used = Array.from({ length: h }, () => new Array(w).fill(false));

  /** Greedy horizontal run of the same char, so a floor is one body. */
  const runLength = (c, r, ch) => {
    let n = 0;
    while (c + n < w && at(c + n, r) === ch && !used[r][c + n]) n++;
    return n;
  };

  const box = (c, r, n, kind, extra = {}) => ({
    x: c * tile, y: r * tile, w: n * tile, h: tile, kind, ...extra,
  });

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (used[r][c]) continue;
      const ch = at(c, r);
      if (ch === "." || ch === "-" || ch === "|") continue;

      switch (ch) {
        case "#": {
          const n = runLength(c, r, "#");
          // Merge vertically too: scan down for equally-wide runs.
          let rows2 = 1;
          while (r + rows2 < h && runLength(c, r + rows2, "#") >= n &&
                 !used[r + rows2][c]) {
            let full = true;
            for (let k = 0; k < n; k++) if (at(c + k, r + rows2) !== "#") { full = false; break; }
            if (!full) break;
            rows2++;
          }
          for (let rr = 0; rr < rows2; rr++) for (let k = 0; k < n; k++) used[r + rr][c + k] = true;
          platforms.push({ x: c * tile, y: r * tile, w: n * tile, h: rows2 * tile, kind: KIND.SOLID });
          break;
        }
        case "=": {
          const n = runLength(c, r, "=");
          for (let k = 0; k < n; k++) used[r][c + k] = true;
          // One-ways are thin: a child should be able to jump up through them.
          platforms.push({ x: c * tile, y: r * tile, w: n * tile, h: tile * 0.34, kind: KIND.ONEWAY });
          break;
        }
        case "%": {
          const n = runLength(c, r, "%");
          for (let k = 0; k < n; k++) used[r][c + k] = true;
          platforms.push({ ...box(c, r, n, KIND.CRUMBLE), h: tile * 0.5, crumbling: false, crumbleT: 0 });
          break;
        }
        case "I": {
          const n = runLength(c, r, "I");
          for (let k = 0; k < n; k++) used[r][c + k] = true;
          platforms.push(box(c, r, n, KIND.ICE));
          break;
        }
        case ">": case "<": {
          const n = runLength(c, r, ch);
          for (let k = 0; k < n; k++) used[r][c + k] = true;
          platforms.push(box(c, r, n, KIND.CONVEYOR, { dir: ch === ">" ? 1 : -1 }));
          break;
        }
        case "B": {
          used[r][c] = true;
          platforms.push({ x: c * tile, y: r * tile + tile * 0.55, w: tile, h: tile * 0.45, kind: KIND.BOUNCY });
          break;
        }
        case "M": {
          // width: the M plus any immediately-following M's; travel: the run of '-'
          let span = 1;
          while (at(c + span, r) === "M" && !used[r][c + span]) span++;
          let travel = 0;
          while (at(c + span + travel, r) === "-") travel++;
          for (let k = 0; k < span + travel; k++) if (used[r][c + k] !== undefined) used[r][c + k] = true;
          platforms.push({
            x: c * tile, y: r * tile, w: span * tile, h: tile * 0.5,
            kind: KIND.MOVING,
            ox: c * tile, oy: r * tile,
            tx: travel * tile, ty: 0,
            speed: 0.9, phase: 0, dx: 0, dy: 0,
          });
          break;
        }
        case "V": {
          let span = 1;
          while (at(c + span, r) === "V" && !used[r][c + span]) span++;
          let travel = 0;
          while (at(c, r + 1 + travel) === "|") travel++;
          for (let k = 0; k < span; k++) used[r][c + k] = true;
          for (let k = 0; k < travel; k++) used[r + 1 + k][c] = true;
          platforms.push({
            x: c * tile, y: r * tile, w: span * tile, h: tile * 0.5,
            kind: KIND.MOVING,
            ox: c * tile, oy: r * tile,
            tx: 0, ty: travel * tile,
            speed: 0.8, phase: 0, dx: 0, dy: 0,
          });
          break;
        }
        case "^": {
          const n = runLength(c, r, "^");
          for (let k = 0; k < n; k++) used[r][c + k] = true;
          hazards.push({ type: HAZARD.SPIKE, x: c * tile, y: r * tile + tile * 0.45, w: n * tile, h: tile * 0.55, pad: 10 });
          break;
        }
        case "~": {
          const n = runLength(c, r, "~");
          let rows2 = 1;
          while (r + rows2 < h && at(c, r + rows2) === "~") rows2++;
          for (let rr = 0; rr < rows2; rr++) for (let k = 0; k < n; k++) if (at(c + k, r + rr) === "~") used[r + rr][c + k] = true;
          hazards.push({ type: HAZARD.WATER, x: c * tile, y: r * tile + tile * 0.3, w: n * tile, h: rows2 * tile, pad: 6 });
          break;
        }
        case "X": {
          used[r][c] = true;
          let travel = 0;
          while (at(c + 1 + travel, r) === "-") travel++;
          hazards.push({
            type: HAZARD.SAW, x: c * tile, y: r * tile, w: tile, h: tile, pad: 12,
            ox: c * tile, tx: travel * tile, speed: 1.1, spin: 0,
          });
          break;
        }
        case "F": {
          // A vertical jet. The run of "!" above it sets how tall it reaches,
          // so a level can have a lick of flame or a column of it.
          used[r][c] = true;
          let tall = 1;
          while (r - tall >= 0 && at(c, r - tall) === "!") { used[r - tall][c] = true; tall++; }
          hazards.push({
            type: HAZARD.FIRE,
            // Wider and taller than the glyph suggests. At 0.64 of a tile a
            // vent was a 40px smudge at the waterline of a gap the bird flies
            // over, and it came back from the device as "there is no fire" —
            // which is the correct reading of a hazard nobody can see.
            x: c * tile + tile * 0.05, y: (r - tall + 1) * tile - tile * 0.5,
            w: tile * 0.9, h: (tall + 0.5) * tile, pad: 8,
            onMs: 1500, offMs: 1700, warnMs: 550,
            // Staggered by column so a row of jets ripples instead of
            // flashing in unison, which is both prettier and more readable.
            phase: (c * 370) % 3200,
            lit: false, heat: 0,
          });
          break;
        }
        case "C": {
          // A cannon. Fires along the row it sits in; "-" to its right marks
          // how far the shot travels before it is recycled.
          used[r][c] = true;
          let reach = 0;
          while (at(c + 1 + reach, r) === "-") { used[r][c + 1 + reach] = true; reach++; }
          hazards.push({
            type: HAZARD.BULLET,
            x: c * tile, y: r * tile + tile * 0.18,
            w: tile * 0.64, h: tile * 0.64, pad: 6,
            muzzleX: c * tile, reach: Math.max(4, reach) * tile,
            everyMs: 2600, phase: (c * 611) % 2600,
            flying: false, bx: 0, flash: 0,
          });
          break;
        }
        // The three powerups. They share a shape here because they differ only
        // in what they grant; the game draws and applies them apart.
        case "P": case "Q": case "H": {
          used[r][c] = true;
          pickups.push({
            kind: ch === "P" ? "power" : ch === "Q" ? "grow" : "heart",
            x: c * tile + tile / 2, y: r * tile + tile / 2,
            taken: false, bob: Math.random() * 6,
          });
          break;
        }
        case "o": case "*": {
          used[r][c] = true;
          pickups.push({ kind: ch === "o" ? "star" : "gem", x: c * tile + tile / 2, y: r * tile + tile / 2, taken: false, bob: Math.random() * 6 });
          break;
        }
        case "W": {
          used[r][c] = true;
          wordGates.push({ x: c * tile + tile / 2, y: r * tile + tile / 2, index: wordGates.length, cleared: false });
          break;
        }
        case "S": { used[r][c] = true; spawn = { x: c * tile, y: r * tile }; break; }
        case "G": { used[r][c] = true; goal = { x: c * tile, y: r * tile }; break; }
        default:
          if (PROP_CHARS.includes(ch)) {
            used[r][c] = true;
            props.push({ kind: ch, x: c * tile + tile / 2, y: (r + 1) * tile, seed: (c * 31 + r * 17) % 100 });
          } else {
            used[r][c] = true;
          }
      }
    }
  }

  return {
    platforms, hazards, pickups, props, wordGates, spawn, goal,
    width: w * tile, height: h * tile, cols: w, rows: h, tile,
  };
}

/**
 * Reachability audit.
 *
 * The naive version of this — compare each surface with the next one along
 * the x axis — flags every decorative high ledge as an impossible jump. What
 * actually matters is whether a child can get from the spawn to the goal at
 * all, so this walks the level as a graph: surfaces are nodes, and an edge
 * exists when one surface can be reached from another with a single
 * full-power jump (or by simply falling onto it).
 *
 * Springs are modelled explicitly, because several levels rely on them to
 * reach a ledge that is otherwise too high.
 *
 * Run over every authored level by tools/check.mjs, so a level that cannot be
 * finished fails the build instead of a five-year-old.
 */
export function auditMap(map, {
  maxJumpDistance = 520,
  maxJumpApex = 250,
  springApex = 520,
} = {}) {
  const issues = [];
  if (!map.goal) issues.push("no goal (G) in map");
  if (!map.spawn) issues.push("no spawn (S) in map");
  if (!map.goal || !map.spawn) return issues;

  // Every standable top surface.
  const surfaces = map.platforms
    .filter((p) => p.kind !== KIND.BOUNCY)
    .map((p, i) => ({
      i, x1: p.x, x2: p.x + p.w, y: p.y, kind: p.kind,
      // A mover's reachable span covers its whole travel.
      rx1: p.kind === KIND.MOVING ? Math.min(p.x, p.ox) : p.x,
      rx2: p.kind === KIND.MOVING ? Math.max(p.x + p.w, (p.ox ?? p.x) + (p.tx ?? 0) + p.w) : p.x + p.w,
      ry1: p.kind === KIND.MOVING ? Math.min(p.y, p.oy) : p.y,
      ry2: p.kind === KIND.MOVING ? Math.max(p.y, (p.oy ?? p.y) + (p.ty ?? 0)) : p.y,
    }));

  if (!surfaces.length) { issues.push("no standable platforms"); return issues; }

  const springs = map.platforms.filter((p) => p.kind === KIND.BOUNCY);
  /** A surface has a spring if one sits within a tile above its span. */
  const hasSpring = (s) => springs.some(
    (b) => b.x + b.w > s.rx1 - map.tile && b.x < s.rx2 + map.tile &&
           Math.abs(b.y - s.ry1) < map.tile * 1.6,
  );

  const reach = (a, b) => {
    const apex = (hasSpring(a) ? springApex : maxJumpApex);
    // b must not sit higher above a than a jump can carry.
    if (a.ry1 - b.ry2 > apex) return false;
    // horizontal: you may launch from anywhere along a
    const lo = a.rx1 - maxJumpDistance, hi = a.rx2 + maxJumpDistance;
    return b.rx2 >= lo && b.rx1 <= hi;
  };

  const under = (pt) => {
    // the surface the marker stands on: nearest top edge at or below it
    let best = null;
    for (const s of surfaces) {
      if (pt.x + 1 >= s.rx1 && pt.x - 1 <= s.rx2 && s.ry1 >= pt.y - map.tile) {
        if (!best || s.ry1 < best.ry1) best = s;
      }
    }
    return best ?? surfaces.reduce((m, s) => (Math.abs(s.rx1 - pt.x) < Math.abs(m.rx1 - pt.x) ? s : m), surfaces[0]);
  };

  const startS = under(map.spawn);
  const goalS = under(map.goal);

  const seen = new Set([startS.i]);
  const queue = [startS];
  while (queue.length) {
    const a = queue.shift();
    for (const b of surfaces) {
      if (seen.has(b.i)) continue;
      if (reach(a, b)) { seen.add(b.i); queue.push(b); }
    }
  }

  if (!seen.has(goalS.i)) {
    issues.push(`goal is unreachable from spawn (reached ${seen.size}/${surfaces.length} surfaces)`);
    // Point at the widest gap on the ground line, which is nearly always the cause.
    const ground = surfaces.slice().sort((a, b) => a.rx1 - b.rx1);
    for (let i = 0; i < ground.length - 1; i++) {
      const gap = ground[i + 1].rx1 - ground[i].rx2;
      if (gap > maxJumpDistance) {
        issues.push(`  widest blocker: ${Math.round(gap)}px gap at x=${Math.round(ground[i].rx2)} (max ${maxJumpDistance})`);
      }
    }
  }

  /**
   * Every perch but the last carries a word gate.
   *
   * A gate is what stops the bird and asks for a word; a perch without one is
   * a perch the bird walks straight over on its way to the next gate — which,
   * with a gap in between, means walking into the water. Three perches in
   * Crystal Caves had lost theirs to a crumbling ledge written over the top
   * of them, and nothing here noticed: the gaps were fine, the goal was
   * reachable, and the level was unplayable.
   */
  // Only the PILLARS count. A crumbling ledge, an ice patch or a conveyor is
  // something on the route, not a place the bird is asked to stop and speak.
  const perches = surfaces.filter((s) => s.kind === KIND.SOLID);
  if (map.wordGates.length < perches.length - 1) {
    issues.push(`only ${map.wordGates.length} word gates for ${perches.length} perches ` +
                `— a perch with no gate is one the bird walks off`);
  }

  // Word gates must have something to stand on, or the prompt never fires.
  for (const g of map.wordGates) {
    const s = under({ x: g.x, y: g.y });
    if (!s || s.ry1 - g.y > map.tile * 3) {
      issues.push(`word gate at x=${Math.round(g.x)} has no platform beneath it`);
    }
  }

  /**
   * Pickups have to be catchable, and movers have to be standable.
   *
   * These went unchecked, and a change to where the camera frames the level
   * shifted the pillars four rows down while leaving every mover, spring,
   * fire vent, cannon and power star at its old height. The result passed
   * every check here — the gaps were fine and the goal was reachable — and
   * the entire furniture of the game was hanging in mid-air above it.
   *
   * A star may sit up to a full jump's apex above the surface below it,
   * because reaching one is allowed to be the point. Anything higher is not
   * a challenge, it is an oversight.
   */
  for (const p of map.pickups ?? []) {
    const s = under({ x: p.x, y: p.y });
    const above = s ? s.ry1 - p.y : Infinity;
    if (above > maxJumpApex + map.tile) {
      issues.push(`${p.kind} at x=${Math.round(p.x)} floats ${Math.round(above)}px above anything (max ${maxJumpApex + map.tile})`);
    }
  }
  // A mover the player cannot board is decoration that looks like a route.
  for (const m of surfaces.filter((s) => s.kind === KIND.MOVING)) {
    const boardable = surfaces.some((s) => s !== m && s.kind !== KIND.MOVING && reach(s, m));
    if (!boardable) {
      issues.push(`moving platform at x=${Math.round(m.rx1)} cannot be reached from any ground`);
    }
  }
  return issues;
}
