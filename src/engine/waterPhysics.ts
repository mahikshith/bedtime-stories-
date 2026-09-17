/**
 * The water in Moon Pool.
 *
 * A **height field**, not particles. The pool is a row of columns, each holding
 * a depth, with a flow rate across every boundary between them — the "pipe
 * model" that shallow-water toys have used for thirty years. It sloshes, it has
 * a real resonant period, and it costs a few hundred adds per frame.
 *
 * The SPH fluid the game documents asked for is a different proposition: a few
 * thousand particles with neighbour lookups, sixty times a second, on a phone
 * a parent already owned in 2021. That claim was never tested and is not one
 * to make on a child's device. A height field cannot splash sideways, and
 * that is the whole of what it gives up.
 *
 * Pure functions, no React, no canvas: the feel is tested rather than eyeballed
 * on hardware none of us can reach.
 */

export interface Water {
  /** Depth of each column, 0..~1 of the pool's height. */
  h: number[];
  /** Flow rate across the boundary to the RIGHT of column i. Length h.length-1. */
  flow: number[];
}

export interface Seed {
  /** 0..1 across the pool. */
  x: number;
  vx: number;
  /** True once it has been lifted onto the ledge. Never goes back to false. */
  home: boolean;
}

export interface Pool {
  water: Water;
  seeds: Seed[];
  /** Surface height the wave has to reach at the ledge, in depth units. */
  ledge: number;
  level: number;
}

export const COLUMNS = 28;
/** Still-water depth. Half-full: there is room above to build a wave. */
export const REST_DEPTH = 0.5;
export const SEED_R = 0.035;
/** Everything right of this is under the ledge. */
export const LEDGE_X = 0.86;

/*
 * The pipe model is explicit, so it is integrated at a fixed small step and a
 * long frame is split. Feeding it a 40ms browser frame directly makes the
 * surface ring and then diverge — the classic way these blow up.
 */
const SUB_DT = 1 / 240;
const MAX_SUBSTEPS = 8;

/**
 * How fast a head difference becomes flow.
 *
 * This is the whole feel of the game. The pool's fundamental sloshing period is
 * `2 * COLUMNS / sqrt(SPREAD)` seconds, and it has to land where a child can
 * actually rock a phone — around 1.2s, near a walking rhythm. Too fast and the
 * pool is a buzzing puddle nobody can drive; too slow and it never answers.
 */
const SPREAD = 2200;
/**
 * Flow added per unit tilt. Tuned against SPREAD so that *holding* the phone
 * over is enough for level 1 and never enough for level 5 — the later levels
 * can only be cleared by rocking at the pool's own rhythm, which is the thing
 * the game is actually about.
 */
const TILT_PUSH = 14;
/** Sloshing dies away over a couple of seconds, so putting the phone flat calms it. */
const DRAG = 0.45;
/**
 * Drag that grows with flow, which is the only thing stopping the pool.
 *
 * A linear height field has no wave breaking and no turbulence, so rocked at
 * its own rhythm it will accept energy indefinitely: thirty seconds of a good
 * resonance and one end of the pool is bare floor. Real water spends that
 * energy on froth. This is the cheap stand-in — quadratic drag, the same shape
 * turbulent loss actually takes — set so the pool tops out comfortably above
 * the highest ledge and never runs dry.
 */
const SWELL_DRAG = 0.08;
const MAX_FLOW = 60;
/**
 * Smooths neighbouring columns.
 *
 * An impulse into a height field excites every wavelength it has, and the
 * shortest one — a single column up, its neighbour down — rings at `2/sqrt(SPREAD)`
 * seconds, which at this SPREAD is 43ms. Uniform drag cannot help: it takes the
 * same proportion off every mode. This damps by curvature, so it costs the
 * grid-scale fizz about a sixth of a second and the slosh we actually want
 * roughly nothing.
 */
const VISCOSITY = 1.5;

/** Seeds take the water's speed, but lazily — they have mass. */
const COUPLE = 5;
/**
 * How much of the water's speed a seed actually takes.
 *
 * Held at 1, a good slosh flings the seed into the far wall and parks it there
 * — the game punishing the child for doing the one thing it asked. Turned down
 * this far the wave jostles the seed rather than carrying it, which is both
 * what a light floating thing does and what keeps the seed where the lift can
 * reach it.
 */
const ADVECT = 0.15;
/**
 * A steady drift toward the ledge.
 *
 * Rocking a basin gives a floating object almost no *net* horizontal travel —
 * it bobs in place — so a game built on advection alone would strand the seed
 * mid-pool however well the child played. The pool is pulled moonward instead,
 * which makes arrival a matter of time and the lift a matter of timing. The
 * skill on offer is the timing, and it is a real one.
 */
const CURRENT = 0.075;

/** A wall lap is only worth a sound once it has fallen back below this first. */
const LAP_ON = 0.09;
const LAP_OFF = 0.045;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * The pool's own rhythm, in seconds.
 *
 * Not a tuned number — it falls out of the wave equation the height field is,
 * `2L/c` with `c = sqrt(SPREAD)` in column widths per second. The game shows
 * this to the child as a moon swinging above the water, so a test pins the
 * formula against the sloshing the simulation actually does. If they ever drift
 * apart, the moon becomes a liar and the game becomes unlearnable.
 */
export const SLOSH_SECONDS = (2 * COLUMNS) / Math.sqrt(SPREAD);

export function buildPool(level: number): Pool {
  const n = clamp(Math.round(level), 1, 5);
  const seeds = n >= 5 ? 3 : n >= 3 ? 2 : 1;
  return {
    water: {
      h: new Array(COLUMNS).fill(REST_DEPTH),
      flow: new Array(COLUMNS - 1).fill(0),
    },
    seeds: Array.from({ length: seeds }, (_, i) => ({
      x: 0.3 - i * 0.11,
      vx: 0,
      home: false,
    })),
    // Level 1 sits barely above the still surface: a tip of the phone clears it.
    ledge: [0.555, 0.6, 0.65, 0.7, 0.74][n - 1],
    level: n,
  };
}

/** Surface height at any x, linearly interpolated between column centres. */
export function surfaceAt(water: Water, x: number): number {
  const n = water.h.length;
  const p = clamp(x * n - 0.5, 0, n - 1);
  const i = Math.floor(p);
  const j = Math.min(n - 1, i + 1);
  return water.h[i] + (water.h[j] - water.h[i]) * (p - i);
}

/**
 * Horizontal water speed at x, in field units per second.
 *
 * `flow` is depth moved between neighbours per second; the flux per unit width
 * is that over the column count, and dividing by depth gives a velocity. The
 * depth floor keeps a nearly dry column from producing an infinite one.
 */
export function velocityAt(water: Water, x: number): number {
  const n = water.h.length;
  const p = clamp(x * n - 1, 0, water.flow.length - 1);
  const i = Math.floor(p);
  const j = Math.min(water.flow.length - 1, i + 1);
  const f = water.flow[i] + (water.flow[j] - water.flow[i]) * (p - i);
  return f / (n * Math.max(0.08, surfaceAt(water, x)));
}

export interface WaterInput {
  /** -1..1, from the tilt hook or the touch fallback. */
  tiltX: number;
  dt: number;
}

export type WaterEvent =
  | { kind: 'lap'; side: 'left' | 'right'; strength: number }
  | { kind: 'home'; index: number };

export interface WaterResult {
  pool: Pool;
  events: WaterEvent[];
}

/** Per-side latch so a wave held against a wall does not chatter. */
export interface LapState {
  left: boolean;
  right: boolean;
}

export const NO_LAP: LapState = { left: false, right: false };

/**
 * Advances one frame.
 *
 * `lap` is carried by the caller rather than stored on the pool because it is
 * about *sound*, not about water: a reload of the same pool should not depend
 * on whether the last wave had been reported.
 */
export function stepWater(pool: Pool, input: WaterInput, lap: LapState = NO_LAP): WaterResult & { lap: LapState } {
  const total = clamp(input.dt, 0, 1 / 15);
  const steps = Math.max(1, Math.min(MAX_SUBSTEPS, Math.ceil(total / SUB_DT)));
  const dt = total / steps;

  const h = pool.water.h.slice();
  const flow = pool.water.flow.slice();
  const tilt = clamp(input.tiltX, -1, 1);
  const events: WaterEvent[] = [];

  const decay = Math.exp(-DRAG * dt);
  const smooth = VISCOSITY * dt;
  const before = new Array(h.length).fill(0);
  for (let s = 0; s < steps; s += 1) {
    /*
     * Staggered leapfrog: EVERY flow is computed from the heights as they
     * stand, and only then is any water moved. Updating a height in the same
     * sweep that reads it gives the loop a direction — water crossing
     * left-to-right sees heights a half-step newer than water crossing
     * right-to-left — and that asymmetry feeds the pool energy it was never
     * given. It does not look like a bug; it looks like a tsunami arriving
     * about a second after a child tips the phone.
     */
    for (let i = 0; i < flow.length; i += 1) {
      flow[i] = clamp(
        (flow[i] + (SPREAD * (h[i] - h[i + 1]) + TILT_PUSH * tilt) * dt) *
          decay * Math.exp(-SWELL_DRAG * Math.abs(flow[i]) * dt),
        -MAX_FLOW,
        MAX_FLOW,
      );
    }
    for (let i = 0; i < h.length; i += 1) before[i] = h[i];
    for (let i = 0; i < h.length; i += 1) {
      const out = i < flow.length ? flow[i] * dt : 0;
      const into = i > 0 ? flow[i - 1] * dt : 0;
      // A column can never give away more than it holds. Under CFL this never
      // fires; it is here so a pathological frame degrades instead of exploding.
      h[i] = Math.max(0, before[i] - out + into);
    }
    for (let i = 0; i < h.length; i += 1) before[i] = h[i];
    for (let i = 1; i < h.length - 1; i += 1) {
      h[i] += smooth * (before[i - 1] - 2 * before[i] + before[i + 1]);
    }
  }

  const water: Water = { h, flow };

  const nextLap: LapState = { ...lap };
  for (const side of ['left', 'right'] as const) {
    const rise = (side === 'left' ? h[0] : h[h.length - 1]) - REST_DEPTH;
    if (!nextLap[side] && rise > LAP_ON) {
      nextLap[side] = true;
      events.push({ kind: 'lap', side, strength: clamp(rise / 0.3, 0.2, 1) });
    } else if (nextLap[side] && rise < LAP_OFF) {
      nextLap[side] = false;
    }
  }

  const seeds = pool.seeds.map((seed, index) => {
    if (seed.home) return seed;
    const target = velocityAt(water, seed.x) * ADVECT + CURRENT;
    const vx = seed.vx + (target - seed.vx) * Math.min(1, COUPLE * total);
    const x = clamp(seed.x + vx * total, SEED_R, 1 - SEED_R);
    const home = x >= LEDGE_X && surfaceAt(water, x) >= pool.ledge;
    if (home) events.push({ kind: 'home', index });
    return { x, vx, home };
  });

  return { pool: { ...pool, water, seeds }, events, lap: nextLap };
}

export function isPoolComplete(pool: Pool): boolean {
  return pool.seeds.every((s) => s.home);
}

/** Total water. Nothing leaves the pool, so this is a conservation invariant. */
export function volume(water: Water): number {
  return water.h.reduce((a, b) => a + b, 0);
}
