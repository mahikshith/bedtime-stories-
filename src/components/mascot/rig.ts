import {
  BOUNCY,
  LAGGY,
  SNAPPY,
  SOFT,
  spring,
  stepSpring,
  type Spring,
} from './spring';

/**
 * Lumi's skeleton.
 *
 * Every channel below is a spring, and the parts are *chained*: the head chases
 * the body, the crest chases the head, the tail chases the body. Nothing is
 * keyframed and no part has an animation of its own. Give the body a shove and
 * the whole character answers in order, late, and overshoots — which is what
 * the trade calls follow-through and what every mascot people actually like
 * has, from Duo to the Clash barbarian.
 *
 * Squash is volume-preserving: a character that squashes without widening has
 * been scaled, not deformed, and the eye reads it as a bug rather than as
 * weight. `stretchOf` is the paired factor and must always be used with it.
 *
 * The gestures are the twelve principles applied literally. A hop is
 * anticipation (crouch *down* first — moving the opposite way before the move
 * is what sells the move), then the launch, then squash on landing, then
 * settle. Skip the anticipation and the same hop reads as a jump-cut.
 */

export type Gesture = 'idle' | 'hop' | 'spin' | 'cheer' | 'peek' | 'sleep';

export interface Pose {
  /** Vertical offset in viewBox units. Negative is up. */
  lift: number;
  /** 0 is round; positive squashes flat, negative stretches tall. */
  squash: number;
  /** 0..1 all the way round. 0.5 is the back of the head. */
  turn: number;
  /** Degrees. */
  bodyRot: number;
  headRot: number;
  crestRot: number;
  tailRot: number;
  /** Degrees; negative is lifted. */
  wingL: number;
  wingR: number;
  /** 1 open, 0 shut. */
  lids: number;
  /** -1..1, where the eyes are pointing inside their sockets. */
  gazeX: number;
  gazeY: number;
  /** 0..1 how far the beak is open. */
  beak: number;
  /** 0..1, scales the ground shadow with height. */
  grounded: number;
}

interface Channels {
  lift: Spring;
  squash: Spring;
  turn: Spring;
  bodyRot: Spring;
  headRot: Spring;
  crestRot: Spring;
  tailRot: Spring;
  wing: Spring;
  lids: Spring;
  gazeX: Spring;
  gazeY: Spring;
  beak: Spring;
}

export interface Rig {
  channels: Channels;
  gesture: Gesture;
  /** Seconds since the gesture began. */
  elapsed: number;
  /** Full turns banked, so a spin keeps going rather than snapping back to 0. */
  spins: number;
}

export function makeRig(): Rig {
  return {
    channels: {
      lift: spring(0),
      squash: spring(0),
      turn: spring(0),
      bodyRot: spring(0),
      headRot: spring(0),
      crestRot: spring(0),
      tailRot: spring(0),
      wing: spring(0),
      lids: spring(1),
      gazeX: spring(0),
      gazeY: spring(0),
      beak: spring(0.12),
    },
    gesture: 'idle',
    elapsed: 0,
    spins: 0,
  };
}

/** Restarts the clock, so a gesture retriggered mid-flight plays again. */
export function setGesture(rig: Rig, gesture: Gesture): Rig {
  const spins = gesture === 'spin' ? rig.spins + 1 : rig.spins;
  return { ...rig, gesture, elapsed: 0, spins };
}

/** How long a full revolution takes. Slow enough to read as a turn. */
export const SPIN_SECONDS = 0.95;

/** Two sines at an irrational ratio: visible movement that never finds a beat. */
function wander(t: number, rate: number, seed: number): number {
  return Math.sin(t * rate + seed) * 0.62 + Math.sin(t * rate * 2.718 + seed * 1.7) * 0.38;
}

/**
 * Blink schedule.
 *
 * The clock is warped and the schedule on top of it is fixed. Taking `t` modulo
 * a period that itself varies with `t` looks like an uneven blink and is not:
 * the divisor moves as `t` does, so the remainder jumps rather than sweeping,
 * and it fires about four times too often. The warp stays monotonic because
 * 1.1 * 0.37 < 1.
 */
export function blinkAt(t: number): number {
  const BLINK = 0.16;
  const CLOSE = 0.055;
  const warped = t + 1.1 * Math.sin(t * 0.37);
  const phase = ((warped % 3.4) + 3.4) % 3.4;
  if (phase > BLINK) return 1;
  return phase < CLOSE ? 1 - phase / CLOSE : (phase - CLOSE) / (BLINK - CLOSE);
}

/** Where each channel is being pulled, for the current gesture at time t. */
function targets(rig: Rig, t: number, energy: number) {
  const idleTurn = wander(t, 0.23, 0) * 0.06 * energy;
  const base = {
    lift: 0,
    squash: 0,
    turn: rig.spins + idleTurn,
    bodyRot: wander(t, 0.31, 2.4) * 2.4 * energy,
    wing: 0,
    lids: blinkAt(t),
    gazeX: wander(t, 0.41, 5.1) * 0.5 * energy,
    gazeY: wander(t, 0.27, 1.3) * 0.3 * energy,
    beak: 0.12,
  };

  switch (rig.gesture) {
    case 'hop': {
      /*
       * Anticipation, launch, land, settle. The crouch comes FIRST and goes the
       * wrong way — moving opposite to a move before making it is what sells
       * the move, and without it the same hop reads as a jump cut.
       */
      if (t < 0.13) return { ...base, lift: 9, squash: 0.3, wing: 10 };
      if (t < 0.42) return { ...base, lift: -46, squash: -0.22, wing: -42, beak: 0.5 };
      if (t < 0.56) return { ...base, lift: 0, squash: 0.34, wing: -6, beak: 0.3 };
      return base;
    }
    case 'spin': {
      /*
       * The one place a target is *timed* rather than sprung.
       *
       * Pointed at the finished angle, the spring simply arrives — the first
       * version completed a whole revolution in about 160ms, which is a frame
       * of blur and then a bird facing forward again. A revolution is a
       * choreographed move, so it is paced explicitly and eased in and out, and
       * the spring is left to do what springs are for: the lag and the settle
       * at the end of it.
       *
       * The target is absolute and monotonic — start plus a progress that only
       * increases — so the head takes the long way round instead of unwinding
       * back through where it came from.
       */
      const p = Math.max(0, Math.min(1, t / SPIN_SECONDS));
      /*
       * Only partly eased. A full quadratic ease-in-out doubles the speed
       * through the middle of the move — which is exactly where the back of the
       * head is — so the one part worth seeing is the part it rushes. Blending
       * back toward linear keeps the ends soft and lets the middle be read.
       */
      const quad = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
      const eased = p * 0.6 + quad * 0.4;
      return {
        ...base,
        turn: rig.spins - 1 + eased,
        lift: -14,
        squash: -0.08,
        wing: -30,
        beak: 0.4,
      };
    }
    case 'cheer': {
      const beat = Math.sin(t * 9) * 0.5 + 0.5;
      return {
        ...base,
        lift: -10 - beat * 8,
        squash: -0.1 + beat * 0.12,
        wing: -52 - beat * 12,
        beak: 0.72,
        gazeY: -0.3,
      };
    }
    case 'peek':
      return { ...base, turn: rig.spins + 0.1, gazeX: 0.85, beak: 0.05 };
    case 'sleep':
      return { ...base, lift: 3, squash: 0.16, wing: 6, lids: 0.04, gazeY: 0.4, beak: 0 };
    default:
      return base;
  }
}

export interface AdvanceOptions {
  /** Scales the idle wander. Wind-down and sleep both damp it. */
  energy?: number;
}

/**
 * Advances the whole rig one frame.
 *
 * The chain is the point, and so is the order: each part is pulled toward where
 * the part *in front of it* is right now, using a looser spring, so it arrives
 * late. Point them all at the same target instead and every part moves
 * together, which is precisely what makes cheap character animation look cheap.
 */
export function advance(rig: Rig, dt: number, options: AdvanceOptions = {}): Rig {
  const energy = options.energy ?? 1;
  const elapsed = rig.elapsed + dt;
  const want = targets(rig, elapsed, energy);
  const c = rig.channels;

  const lift = stepSpring(c.lift, want.lift, BOUNCY, dt);
  const squash = stepSpring(c.squash, want.squash, SNAPPY, dt);
  // Stiff during a spin so it tracks the paced ramp; loose otherwise so an
  // idle glance trails the body the way a head does.
  const turn = stepSpring(c.turn, want.turn, rig.gesture === 'spin' ? SNAPPY : LAGGY, dt);
  const bodyRot = stepSpring(c.bodyRot, want.bodyRot, SOFT, dt);

  // The chain. Each of these chases the one before it, never the raw target.
  const headRot = stepSpring(c.headRot, bodyRot.value * 1.5, SOFT, dt);
  const crestRot = stepSpring(c.crestRot, headRot.value * 2.2, LAGGY, dt);
  const tailRot = stepSpring(c.tailRot, bodyRot.value * -1.8, LAGGY, dt);

  const wing = stepSpring(c.wing, want.wing, SNAPPY, dt);
  // Lids get no spring on the way shut: a blink is faster than any spring that
  // still looks settled when open, and a sprung blink reads as a slow wince.
  const lids = { value: want.lids, velocity: 0 };
  const gazeX = stepSpring(c.gazeX, want.gazeX, SNAPPY, dt);
  const gazeY = stepSpring(c.gazeY, want.gazeY, SNAPPY, dt);
  const beak = stepSpring(c.beak, want.beak, SNAPPY, dt);

  const gesture: Gesture =
    (rig.gesture === 'hop' && elapsed > 1.1) || (rig.gesture === 'cheer' && elapsed > 1.6)
      ? 'idle'
      : rig.gesture === 'spin' && elapsed > SPIN_SECONDS + 0.35
        ? 'idle'
        : rig.gesture;

  return {
    ...rig,
    elapsed,
    gesture,
    channels: { lift, squash, turn, bodyRot, headRot, crestRot, tailRot, wing, lids, gazeX, gazeY, beak },
  };
}

/** The paired widening for a squash. Volume-preserving, so it deforms. */
export function stretchOf(squash: number): number {
  return 1 / (1 + squash);
}

export function poseOf(rig: Rig): Pose {
  const c = rig.channels;
  const turn = ((c.turn.value % 1) + 1) % 1;
  return {
    lift: c.lift.value,
    squash: c.squash.value,
    turn,
    bodyRot: c.bodyRot.value,
    headRot: c.headRot.value,
    crestRot: c.crestRot.value,
    tailRot: c.tailRot.value,
    // One wing leads and the other trails. Perfectly mirrored wings are the
    // fastest way to make a character look like a paper cut-out.
    wingL: c.wing.value,
    wingR: c.wing.value * 0.82,
    lids: Math.max(0, Math.min(1, c.lids.value)),
    gazeX: c.gazeX.value,
    gazeY: c.gazeY.value,
    beak: Math.max(0, Math.min(1, c.beak.value)),
    grounded: Math.max(0, Math.min(1, 1 + c.lift.value / 46)),
  };
}
