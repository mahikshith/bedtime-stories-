/**
 * The spring every moving part of Lumi hangs off.
 *
 * Keyframes are why the old mascot looked like a sticker being slid around. A
 * keyframe says *where* a thing is at time t; a spring says what it is doing and
 * lets the arrival take care of itself. Everything that makes character
 * animation read as physical falls out of it for free:
 *
 *  - **Overshoot.** Something with mass passes its mark and comes back. A
 *    keyframed ease never does, which is exactly why eased UI motion looks
 *    correct and eased *character* motion looks dead.
 *  - **Interruption.** Retarget a spring mid-flight and it carries its velocity
 *    into the new move. Retarget a keyframe and it snaps.
 *  - **Follow-through.** Point a soft spring at a stiff one and the soft one
 *    lags behind — which is all a crest trailing a turning head actually is.
 *    No separate animation, no offset timeline, just a looser spring.
 *
 * Integrated semi-implicitly at a fixed substep. Explicit integration of a
 * stiff spring at a 40ms browser frame does not degrade, it explodes.
 */

export interface Spring {
  value: number;
  velocity: number;
}

export interface SpringConfig {
  /** How hard it pulls toward the target. Higher is snappier. */
  stiffness: number;
  /** Fraction of critical damping. Below 1 overshoots; 1 arrives dead. */
  damping: number;
}

/** Comfortable presets. Names describe the feel, not the numbers. */
export const SNAPPY: SpringConfig = { stiffness: 260, damping: 0.62 };
export const SOFT: SpringConfig = { stiffness: 120, damping: 0.72 };
/** For parts that trail: loose enough to visibly lag whatever they chase. */
export const LAGGY: SpringConfig = { stiffness: 58, damping: 0.55 };
/** Barely damped — for a bounce that keeps going a moment too long, on purpose. */
export const BOUNCY: SpringConfig = { stiffness: 300, damping: 0.34 };

export function spring(value = 0): Spring {
  return { value, velocity: 0 };
}

const SUB_DT = 1 / 240;
const MAX_SUBSTEPS = 8;

/**
 * Advances one spring toward `target`.
 *
 * Damping is expressed as a fraction of critical (`2 * sqrt(k)`) rather than as
 * a raw coefficient, so changing stiffness does not silently change the feel —
 * the single most common way a spring that felt right at one size stops feeling
 * right at another.
 */
export function stepSpring(s: Spring, target: number, config: SpringConfig, dt: number): Spring {
  const total = Math.max(0, Math.min(1 / 15, dt));
  const steps = Math.max(1, Math.min(MAX_SUBSTEPS, Math.ceil(total / SUB_DT)));
  const h = total / steps;
  const c = config.damping * 2 * Math.sqrt(config.stiffness);

  let { value, velocity } = s;
  for (let i = 0; i < steps; i += 1) {
    const accel = -config.stiffness * (value - target) - c * velocity;
    velocity += accel * h;
    value += velocity * h;
  }
  return { value, velocity };
}

/** True once a spring has effectively stopped, for ending a gesture. */
export function atRest(s: Spring, target: number, epsilon = 0.002): boolean {
  return Math.abs(s.value - target) < epsilon && Math.abs(s.velocity) < epsilon * 12;
}
