/**
 * The marble in Stardust Tilt.
 *
 * Pure functions, no React and no canvas, so the feel can be tested rather than
 * eyeballed on a device none of us can reach. Everything is in field units
 * (0..1 on both axes) so the same numbers work at 390px and on a tablet.
 */

export interface Marble {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Obstacle {
  x: number;
  y: number;
  r: number;
  /** A bell chimes and opens a gate; a sleeper nudges you onward. */
  kind: 'sleeper' | 'bell';
  rung?: boolean;
}

export interface Field {
  marble: Marble;
  obstacles: Obstacle[];
  goal: { x: number; y: number; r: number };
}

export const MARBLE_R = 0.055;

/** Field units per second squared at full tilt. Tuned slow: this is a child. */
const GRAVITY = 0.85;
/** Rolling resistance. Without it the marble never settles and cannot be aimed. */
const FRICTION = 1.9;
/** Walls give back less than they take, so the marble calms down on its own. */
const BOUNCE = 0.45;
const MAX_SPEED = 1.2;
/*
 * Below this, a wall contact is a rest, not a knock.
 *
 * Under a held tilt the marble leans on the wall and is pushed back into it
 * every frame, so reporting each contact fires a thud 60 times a second — a
 * buzz rather than a bounce. The collision response still runs; only the
 * *event* is gated.
 */
const AUDIBLE_IMPACT = 0.09;

export interface StepInput {
  /** -1..1 from the tilt hook, or from the touch fallback. */
  tiltX: number;
  tiltY: number;
  /** Seconds. Clamped by the caller so a backgrounded tab cannot teleport. */
  dt: number;
}

export interface StepResult {
  field: Field;
  /** Events the caller turns into sound and particles. */
  hits: { kind: 'wall' | 'sleeper' | 'bell'; at: { x: number; y: number }; speed: number }[];
  landed: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Advances one frame.
 *
 * Deliberately not a general physics engine: one body, circular obstacles, a
 * rectangular field. A 60-line solver that is right beats a dependency.
 */
export function step(field: Field, input: StepInput): StepResult {
  const dt = clamp(input.dt, 0, 1 / 20);
  const hits: StepResult['hits'] = [];
  const m = { ...field.marble };

  m.vx += input.tiltX * GRAVITY * dt;
  m.vy += input.tiltY * GRAVITY * dt;

  // Exponential drag rather than a subtraction, so friction cannot reverse
  // the marble at low speed the way `v -= k * dt` does once v < k * dt.
  const drag = Math.exp(-FRICTION * dt);
  m.vx *= drag;
  m.vy *= drag;

  const speed = Math.hypot(m.vx, m.vy);
  if (speed > MAX_SPEED) {
    m.vx = (m.vx / speed) * MAX_SPEED;
    m.vy = (m.vy / speed) * MAX_SPEED;
  }

  m.x += m.vx * dt;
  m.y += m.vy * dt;

  // Walls.
  for (const axis of ['x', 'y'] as const) {
    const v = axis === 'x' ? 'vx' : 'vy';
    if (m[axis] < MARBLE_R) {
      m[axis] = MARBLE_R;
      if (m[v] < 0) {
        if (Math.abs(m[v]) >= AUDIBLE_IMPACT) {
          hits.push({ kind: 'wall', at: { x: m.x, y: m.y }, speed: Math.abs(m[v]) });
        }
        m[v] = -m[v] * BOUNCE;
      }
    } else if (m[axis] > 1 - MARBLE_R) {
      m[axis] = 1 - MARBLE_R;
      if (m[v] > 0) {
        if (Math.abs(m[v]) >= AUDIBLE_IMPACT) {
          hits.push({ kind: 'wall', at: { x: m.x, y: m.y }, speed: Math.abs(m[v]) });
        }
        m[v] = -m[v] * BOUNCE;
      }
    }
  }

  const obstacles = field.obstacles.map((o) => ({ ...o }));
  for (const o of obstacles) {
    const dx = m.x - o.x;
    const dy = m.y - o.y;
    const dist = Math.hypot(dx, dy);
    const touching = dist < o.r + MARBLE_R;
    if (!touching) continue;

    // Degenerate case: dead centre. Pick a direction rather than divide by zero.
    const nx = dist === 0 ? 1 : dx / dist;
    const ny = dist === 0 ? 0 : dy / dist;
    const impact = Math.hypot(m.vx, m.vy);

    // Push out first, so the marble can never settle inside an obstacle.
    m.x = o.x + nx * (o.r + MARBLE_R);
    m.y = o.y + ny * (o.r + MARBLE_R);

    if (o.kind === 'bell') {
      if (!o.rung) {
        o.rung = true;
        hits.push({ kind: 'bell', at: { x: o.x, y: o.y }, speed: impact });
      }
      const dot = m.vx * nx + m.vy * ny;
      m.vx -= 2 * dot * nx * BOUNCE;
      m.vy -= 2 * dot * ny * BOUNCE;
    } else {
      /*
       * A sleeper is not an obstacle to beat — there is no fail state here.
       * It yawns and nudges the marble ON toward the goal rather than away,
       * so hitting one is a small piece of luck instead of a punishment.
       */
      hits.push({ kind: 'sleeper', at: { x: o.x, y: o.y }, speed: impact });
      const gx = field.goal.x - m.x;
      const gy = field.goal.y - m.y;
      const gd = Math.hypot(gx, gy) || 1;
      m.vx = (gx / gd) * 0.34;
      m.vy = (gy / gd) * 0.34;
    }
  }

  const landed =
    Math.hypot(m.x - field.goal.x, m.y - field.goal.y) < field.goal.r &&
    // Has to arrive, not merely pass through at speed.
    Math.hypot(m.vx, m.vy) < 0.55;

  return { field: { ...field, marble: m, obstacles }, hits, landed };
}

/**
 * The five levels.
 *
 * Level 1 is an open field with the nest dead ahead and nothing in the way —
 * effortless on purpose, because a child who fails the first screen does not
 * reach the second.
 */
export function buildField(level: number): Field {
  const n = clamp(Math.round(level), 1, 5);
  const goal = { x: 0.5, y: 0.14, r: 0.11 };
  const marble: Marble = { x: 0.5, y: 0.86, vx: 0, vy: 0 };

  const obstacles: Obstacle[] = [];
  if (n >= 2) obstacles.push({ x: 0.5, y: 0.5, r: 0.08, kind: 'sleeper' });
  if (n >= 3) {
    obstacles.push({ x: 0.24, y: 0.62, r: 0.07, kind: 'bell' });
    obstacles.push({ x: 0.76, y: 0.62, r: 0.07, kind: 'bell' });
  }
  if (n >= 4) {
    obstacles.push({ x: 0.28, y: 0.32, r: 0.08, kind: 'sleeper' });
    obstacles.push({ x: 0.72, y: 0.32, r: 0.08, kind: 'sleeper' });
  }
  if (n >= 5) obstacles.push({ x: 0.5, y: 0.24, r: 0.07, kind: 'bell' });

  return { marble, obstacles, goal };
}

/** Level is cleared when the marble is home and every bell has rung. */
export function isComplete(field: Field, landed: boolean): boolean {
  return landed && field.obstacles.every((o) => o.kind !== 'bell' || o.rung);
}
