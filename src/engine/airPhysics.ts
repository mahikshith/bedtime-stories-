/**
 * The air in Firefly Air.
 *
 * Waving a phone does not move a thing on the screen — it moves the *air*, and
 * the air moves the thing. That indirection is the whole feel: a puff outlives
 * the wave that made it, so the seed keeps rising for a moment after a child
 * stops, and the game is about anticipating rather than steering.
 *
 * Coordinates: x and y both 0..1, y measured DOWNWARD from the top, so gravity
 * is positive. Pure functions, no React, no canvas.
 */

export interface Flyer {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Ring {
  x: number;
  y: number;
  r: number;
  passed: boolean;
  /** Field units per second; rings drift so the child has to chase one. */
  drift: number;
}

export interface Sky {
  flyer: Flyer;
  rings: Ring[];
  level: number;
}

export const FLYER_R = 0.045;

/** Gentle: a dandelion seed falls slowly, and so does this. */
const GRAVITY = 0.42;
/** Lift at full wave. Must beat gravity comfortably or the game is a grind. */
const LIFT = 1.35;
/** Sideways push from the direction of the wave. */
const FAN = 0.85;
/** Air resistance. High, because a seed has almost no momentum of its own. */
const AIR = 2.2;
const MAX_SPEED = 1.1;
/** Below this, touching the floor is resting rather than landing. */
const AUDIBLE_LAND = 0.12;

export interface AirInput {
  /** 0..1 wave energy, from the motion sensor or the touch fallback. */
  power: number;
  /** -1..1 which way the wave is going. */
  dir: number;
  dt: number;
}

export type AirEvent =
  | { kind: 'ring'; index: number; at: { x: number; y: number } }
  | { kind: 'land'; speed: number }
  | { kind: 'lift' };

export interface AirResult {
  sky: Sky;
  events: AirEvent[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function buildSky(level: number): Sky {
  const n = clamp(Math.round(level), 1, 5);
  const rings: Ring[] = [];
  // Level 1: one big ring, dead centre, not moving. A child who cannot clear
  // the first screen never sees the second.
  const plan: { x: number; y: number; r: number; drift: number }[][] = [
    [{ x: 0.5, y: 0.42, r: 0.17, drift: 0 }],
    [{ x: 0.3, y: 0.4, r: 0.15, drift: 0 }, { x: 0.72, y: 0.28, r: 0.15, drift: 0 }],
    [{ x: 0.28, y: 0.44, r: 0.13, drift: 0.05 }, { x: 0.7, y: 0.26, r: 0.13, drift: -0.05 }],
    [
      { x: 0.24, y: 0.5, r: 0.12, drift: 0.07 },
      { x: 0.5, y: 0.3, r: 0.12, drift: -0.07 },
      { x: 0.78, y: 0.16, r: 0.12, drift: 0.07 },
    ],
    [
      { x: 0.2, y: 0.54, r: 0.1, drift: 0.1 },
      { x: 0.46, y: 0.36, r: 0.1, drift: -0.1 },
      { x: 0.72, y: 0.22, r: 0.1, drift: 0.1 },
      { x: 0.5, y: 0.1, r: 0.11, drift: -0.06 },
    ],
  ];
  for (const ring of plan[n - 1]) rings.push({ ...ring, passed: false });

  return { flyer: { x: 0.5, y: 1 - FLYER_R, vx: 0, vy: 0 }, rings, level: n };
}

/** Advances one frame. */
export function stepAir(sky: Sky, input: AirInput, dtOverride?: number): AirResult {
  const dt = clamp(dtOverride ?? input.dt, 0, 1 / 20);
  const events: AirEvent[] = [];
  const f = { ...sky.flyer };
  const power = clamp(input.power, 0, 1);
  const dir = clamp(input.dir, -1, 1);

  const wasResting = f.y >= 1 - FLYER_R - 1e-6 && Math.abs(f.vy) < 1e-6;

  f.vy += (GRAVITY - LIFT * power) * dt;
  f.vx += FAN * dir * power * dt;

  const drag = Math.exp(-AIR * dt);
  f.vx *= drag;
  f.vy *= drag;

  const speed = Math.hypot(f.vx, f.vy);
  if (speed > MAX_SPEED) {
    f.vx = (f.vx / speed) * MAX_SPEED;
    f.vy = (f.vy / speed) * MAX_SPEED;
  }

  f.x += f.vx * dt;
  f.y += f.vy * dt;

  // Sides: the seed is nudged back in rather than bouncing. There is nothing
  // to win by pinning it to a wall, so there is nothing to lose by it either.
  if (f.x < FLYER_R) { f.x = FLYER_R; f.vx = Math.abs(f.vx) * 0.2; }
  if (f.x > 1 - FLYER_R) { f.x = 1 - FLYER_R; f.vx = -Math.abs(f.vx) * 0.2; }
  if (f.y < FLYER_R) { f.y = FLYER_R; f.vy = Math.abs(f.vy) * 0.25; }

  if (f.y > 1 - FLYER_R) {
    const impact = f.vy;
    f.y = 1 - FLYER_R;
    f.vy = 0;
    // Same gate as the tilt game's walls: a seed resting on the ground is
    // pushed into it every frame, and reporting each contact is a buzz.
    if (impact >= AUDIBLE_LAND) events.push({ kind: 'land', speed: impact });
  }

  if (wasResting && f.y < 1 - FLYER_R - 1e-6) events.push({ kind: 'lift' });

  const rings = sky.rings.map((ring, index) => {
    if (ring.passed || Math.hypot(f.x - ring.x, f.y - ring.y) >= ring.r) return ring;
    events.push({ kind: 'ring', index, at: { x: ring.x, y: ring.y } });
    return { ...ring, passed: true };
  });

  return { sky: { ...sky, flyer: f, rings }, events };
}

/**
 * Moves the drifting rings, bouncing them off the edges rather than wrapping.
 *
 * Wrapping would teleport a ring past the seed the instant a child lined it up,
 * which reads as the game cheating. A passed ring stops moving, so the board
 * settles as it is solved instead of staying busy.
 */
export function driftRings(sky: Sky, dt: number): Sky {
  const step = clamp(dt, 0, 1 / 20);
  return {
    ...sky,
    rings: sky.rings.map((ring) => {
      if (ring.drift === 0 || ring.passed) return ring;
      let x = ring.x + ring.drift * step;
      let drift = ring.drift;
      const lo = ring.r;
      const hi = 1 - ring.r;
      if (x < lo) { x = lo; drift = -drift; }
      if (x > hi) { x = hi; drift = -drift; }
      return { ...ring, x, drift };
    }),
  };
}

export function skyComplete(sky: Sky): boolean {
  return sky.rings.every((r) => r.passed);
}
