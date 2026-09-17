/**
 * The dial in Star Dial.
 *
 * The last of the motion verbs, and a genuinely different sensor from the rest:
 * tilt and water read `beta`/`gamma` (which way is the phone leaning), the air
 * game reads acceleration (how hard is it moving), and this reads `alpha` —
 * which way the phone is *pointing*. A child holds it flat and turns it like a
 * steering wheel, or like a key.
 *
 * Angles are in turns, not degrees or radians: 0..1 all the way round. It
 * removes every `% 360` from the call sites and makes "shortest way round" a
 * subtraction and a rounding.
 */

export interface Dial {
  /** 0..1 around the circle. */
  angle: number;
  /**
   * Turns per second — a *measurement*, not a momentum.
   *
   * The dial does not coast. On the sensor path there is no release to coast
   * from: the dial mirrors where the phone is pointing, and a dial that kept
   * turning after the phone stopped would simply be wrong. On the touch path
   * momentum made the game unplayable — a deliberate drag onto a star slid
   * forty-six degrees past it on release, every time.
   *
   * What the speed is for is the hold: sweeping through the right angle at
   * speed is not aiming at it, and this is how that is known.
   */
  spin: number;
  /** Which star is wanted under the marker, as an index into `stars`. */
  target: number;
  stars: { at: number; name: string; found: boolean }[];
  /** How close counts, in turns. */
  tolerance: number;
  /** Seconds it has been held close enough. */
  held: number;
  level: number;
}

/** Seconds a star has to sit under the marker. Long enough to be a decision. */
export const HOLD_SECONDS = 0.9;

/** How fast the speed estimate falls back to zero once the input stops. */
const SETTLE = 9;
/** Faster than this and it is being thrown rather than turned. */
const MAX_SPIN = 1.6;

const STAR_NAMES = [
  'the Lantern', 'the Otter', 'the Spoon', 'the Little Bear',
  'the Kite', 'the Sleeping Fox', 'the Bell', 'the Feather',
];

/** Shortest signed distance between two angles, in turns. Always -0.5..0.5. */
export function arc(from: number, to: number): number {
  const d = (to - from) % 1;
  return d > 0.5 ? d - 1 : d < -0.5 ? d + 1 : d;
}

/** Wraps into 0..1, including for negatives, which `%` alone does not. */
export function wrap(angle: number): number {
  return ((angle % 1) + 1) % 1;
}

export function buildDial(level: number): Dial {
  const n = Math.max(1, Math.min(5, Math.round(level)));
  const count = [3, 4, 5, 6, 8][n - 1];
  return {
    angle: 0,
    spin: 0,
    target: 1,
    stars: Array.from({ length: count }, (_, i) => ({
      at: i / count,
      name: STAR_NAMES[i % STAR_NAMES.length],
      found: false,
    })),
    // Level 1 accepts a fifth of the circle; level 5 wants a twentieth. Even
    // the tightest stays wider than the gap between two stars is at level 5,
    // so there is never an angle where nothing at all can be selected.
    tolerance: [0.1, 0.07, 0.055, 0.04, 0.028][n - 1],
    held: 0,
    level: n,
  };
}

export interface SpinInput {
  /** Turns to rotate this frame, from the sensor delta or a drag. */
  delta: number;
  dt: number;
}

export type SpinEvent =
  | { kind: 'enter'; index: number }
  | { kind: 'leave' }
  | { kind: 'found'; index: number };

export interface SpinResult {
  dial: Dial;
  events: SpinEvent[];
  /** Index under the marker right now, or -1. Drives the highlight. */
  under: number;
  /** 0..1 through the hold. Drives the ring filling up. */
  progress: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Advances one frame.
 *
 * The marker is fixed at the top and the dial turns under it, which is the way
 * every physical dial in the world works. Turning the marker instead would save
 * a subtraction and feel wrong in a way nobody could name.
 */
export function stepDial(dial: Dial, input: SpinInput): SpinResult {
  const dt = clamp(input.dt, 0, 1 / 20);
  const events: SpinEvent[] = [];

  /*
   * The speed is smoothed rather than taken straight from the frame. A single
   * delta over a single frame is a very noisy estimate — `alpha` readings jump,
   * and one 0.1-turn hiccup at 60fps reads as six turns a second — and since
   * holding still is what this game asks for, a spike in the estimate silently
   * cancels a hold the child is in the middle of earning.
   */
  const delta = clamp(input.delta, -0.25, 0.25);
  const measured = delta / Math.max(dt, 1e-4);
  const spin = clamp(
    delta !== 0
      ? dial.spin + (measured - dial.spin) * 0.3
      : dial.spin * Math.exp(-SETTLE * dt),
    -MAX_SPIN,
    MAX_SPIN,
  );
  const angle = wrap(dial.angle + delta);

  const wasUnder = underMarker(dial);
  const under = underMarker({ ...dial, angle });
  if (under !== wasUnder) {
    if (under >= 0) events.push({ kind: 'enter', index: under });
    else events.push({ kind: 'leave' });
  }

  const onTarget = under === dial.target && !dial.stars[dial.target].found;
  // Holding still is part of the ask: a dial swept past the mark has not been
  // aimed at it. Spinning fast through the right angle must not count.
  const steady = Math.abs(spin) < 0.22;
  const held = onTarget && steady ? dial.held + dt : 0;

  const stars = dial.stars.map((s) => ({ ...s }));
  let target = dial.target;
  if (held >= HOLD_SECONDS) {
    stars[dial.target].found = true;
    events.push({ kind: 'found', index: dial.target });
    target = nextTarget(stars, dial.target);
  }

  return {
    dial: { ...dial, angle, spin, held: held >= HOLD_SECONDS ? 0 : held, stars, target },
    events,
    under,
    progress: clamp(held / HOLD_SECONDS, 0, 1),
  };
}

/** The star under the fixed marker at the top, or -1 if the gap is. */
export function underMarker(dial: Dial): number {
  let best = -1;
  let bestGap = dial.tolerance;
  dial.stars.forEach((star, i) => {
    const gap = Math.abs(arc(wrap(star.at + dial.angle), 0));
    if (gap <= bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  return best;
}

/** The next star still to find, searching forward so the dial keeps its direction. */
function nextTarget(stars: { found: boolean }[], from: number): number {
  for (let i = 1; i <= stars.length; i += 1) {
    const candidate = (from + i) % stars.length;
    if (!stars[candidate].found) return candidate;
  }
  return from;
}

export function dialComplete(dial: Dial): boolean {
  return dial.stars.every((s) => s.found);
}
