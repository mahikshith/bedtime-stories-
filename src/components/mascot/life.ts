/**
 * What Lumi does when nobody is asking anything of her.
 *
 * A mascot that only moves on command is a puppet. What separates a character
 * from an illustration is that it is *already* doing something when you arrive:
 * breathing, shifting its weight, glancing off to one side and back. All of
 * that is here, as pure functions of a clock, so the whole idle performance can
 * be tested rather than judged by staring at it.
 *
 * Returned as a pose, not as rendered output. The component writes it to CSS
 * custom properties inside its own animation frame; nothing here knows what a
 * DOM node is.
 */

export interface Pose {
  /**
   * -1 (turned to her left) .. 1 (her right). Drives a parallax 3/4 turn:
   * features nearer the viewer slide further than the ones behind them, which
   * is what sells a flat drawing as a solid object rotating.
   */
  turn: number;
  /** -1..1 weight shift, a lean from the feet up. */
  lean: number;
  /** 0..1 through a breath. Drives a small vertical squash, never a scale-up. */
  breath: number;
  /** 1 open, 0 shut. A blink is fast down and slower up, like a real one. */
  lids: number;
  /** -1..1 head nod, independent of the lean so the two can disagree. */
  nod: number;
}

export const REST: Pose = { turn: 0, lean: 0, breath: 0, lids: 1, nod: 0 };

/**
 * Two sines at incommensurable rates.
 *
 * A single sine is a metronome and the eye finds it in about four seconds. The
 * ratio here is irrational enough that the combined motion does not visibly
 * repeat inside a session, which is all "alive" needs to mean.
 */
function wander(t: number, rate: number, seed: number): number {
  return (
    Math.sin(t * rate + seed) * 0.62 +
    Math.sin(t * rate * 2.718 + seed * 1.7) * 0.38
  );
}

/** Seconds a blink takes, and how long the fast closing part of it is. */
const BLINK = 0.16;
const BLINK_CLOSE = 0.055;

/**
 * Whether a blink is happening, and how far through it.
 *
 * Blinks land on a repeating but uneven schedule rather than a fixed interval,
 * because a perfectly periodic blink is one of the few things that reads as
 * *more* uncanny than not blinking at all.
 */
export function blinkAt(t: number): number {
  /*
   * Time is warped, and the schedule on top of it is fixed.
   *
   * The obvious version — `t % (3.1 + sin(t) * 1.4)` — looks like it gives an
   * uneven blink and does not: the divisor moves as `t` does, so the remainder
   * jumps rather than sweeping, and it crossed zero seventy-three times a
   * minute instead of eighteen. Warping the clock keeps the sequence monotonic,
   * so every cycle is still exactly one blink; the gaps between them just
   * breathe between about two and a half seconds and five and a half.
   *
   * The warp has to stay monotonic: 1.1 * 0.37 < 1, so d(warped)/dt > 0 always.
   */
  const warped = t + 1.1 * Math.sin(t * 0.37);
  const phase = ((warped % 3.4) + 3.4) % 3.4;
  if (phase > BLINK) return 1;
  return phase < BLINK_CLOSE
    ? 1 - phase / BLINK_CLOSE
    : (phase - BLINK_CLOSE) / (BLINK - BLINK_CLOSE);
}

export interface LifeOptions {
  /** Scales every movement. Wind-down and `sleepy` both damp it down. */
  energy?: number;
  /** Held still, for a mood that should not be fidgeting. */
  frozen?: boolean;
}

/**
 * The idle pose at time `t` seconds.
 *
 * Amplitudes are small on purpose. A mascot that swings through a big arc while
 * a child is trying to read the screen behind it is a distraction; these are
 * roughly the movements of somebody standing still and paying attention.
 */
export function idlePose(t: number, options: LifeOptions = {}): Pose {
  const energy = options.energy ?? 1;
  if (options.frozen) return { ...REST, breath: (Math.sin(t * 0.9) + 1) / 2 };

  return {
    turn: wander(t, 0.23, 0) * 0.55 * energy,
    lean: wander(t, 0.31, 2.4) * 0.5 * energy,
    // Breathing never stops and is never scaled away: a mascot that holds its
    // breath during wind-down looks switched off rather than calm.
    breath: (Math.sin(t * 1.15) + 1) / 2,
    lids: blinkAt(t),
    nod: wander(t, 0.19, 5.1) * 0.45 * energy,
  };
}

/**
 * A deliberate turn to one side and back, for when something happens.
 *
 * `progress` runs 0..1. It overshoots slightly before settling, because
 * anything with mass does, and a head that arrives exactly on its mark reads as
 * a value being set rather than as a head being turned.
 */
export function glance(progress: number, towards: number): number {
  const p = Math.max(0, Math.min(1, progress));
  const swing = Math.sin(p * Math.PI);
  const overshoot = 1 + 0.22 * Math.sin(p * Math.PI * 2);
  return towards * swing * overshoot;
}

/** Clamps a pose into the range the drawing can actually take. */
export function clampPose(pose: Pose): Pose {
  const c = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
  return {
    turn: c(pose.turn),
    lean: c(pose.lean),
    breath: c(pose.breath, 0, 1),
    lids: c(pose.lids, 0, 1),
    nod: c(pose.nod),
  };
}
