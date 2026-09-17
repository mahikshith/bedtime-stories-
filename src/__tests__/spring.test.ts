import { describe, expect, it } from 'vitest';
import {
  BOUNCY,
  LAGGY,
  SNAPPY,
  SOFT,
  atRest,
  spring,
  stepSpring,
  type SpringConfig,
} from '../components/mascot/spring';

const DT = 1 / 60;

/** Runs a spring at a target and reports what the eye would see. */
function drive(config: SpringConfig, target: number, seconds = 3, dt = DT) {
  let s = spring(0);
  const trace: number[] = [];
  for (let t = 0; t < seconds; t += dt) {
    s = stepSpring(s, target, config, dt);
    trace.push(s.value);
  }
  return { spring: s, trace, peak: Math.max(...trace), settle: s.value };
}

describe('the spring', () => {
  it('arrives at its target', () => {
    for (const config of [SNAPPY, SOFT, LAGGY, BOUNCY]) {
      expect(drive(config, 1).settle).toBeCloseTo(1, 2);
    }
  });

  /*
   * The whole reason for a spring rather than an ease. Something with mass
   * passes its mark and comes back; an eased keyframe never does, which is why
   * eased UI motion looks right and eased CHARACTER motion looks dead.
   */
  it('overshoots when it is underdamped', () => {
    expect(drive(BOUNCY, 1).peak).toBeGreaterThan(1.05);
    expect(drive(SNAPPY, 1).peak).toBeGreaterThan(1.0);
  });

  it('does not overshoot when it is critically damped', () => {
    expect(drive({ stiffness: 200, damping: 1 }, 1).peak).toBeLessThanOrEqual(1.001);
  });

  it('is stable at any frame rate a phone can produce', () => {
    for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 20, 1 / 12, 0.5]) {
      const { trace, settle } = drive(BOUNCY, 1, 4, dt);
      expect(Number.isFinite(settle)).toBe(true);
      expect(settle).toBeCloseTo(1, 1);
      // A stiff spring integrated explicitly at a long frame does not degrade,
      // it explodes. Substepping is what stops that.
      expect(Math.max(...trace.map(Math.abs))).toBeLessThan(3);
    }
  });

  it('lands in about the same place whatever the frame rate', () => {
    const fast = drive(SNAPPY, 1, 1, 1 / 120).settle;
    const slow = drive(SNAPPY, 1, 1, 1 / 30).settle;
    expect(Math.abs(fast - slow)).toBeLessThan(0.02);
  });

  /*
   * Follow-through, which is the single thing that separates a rig from a set
   * of things that all move at once. A loose spring chasing a stiff one lags
   * behind it — a crest trailing a turning head is nothing more than that.
   */
  it('lags when a loose spring chases a stiff one', () => {
    let lead = spring(0);
    let trail = spring(0);
    let maxGap = 0;
    for (let t = 0; t < 1; t += DT) {
      lead = stepSpring(lead, 1, SNAPPY, DT);
      trail = stepSpring(trail, lead.value, LAGGY, DT);
      maxGap = Math.max(maxGap, lead.value - trail.value);
    }
    expect(maxGap).toBeGreaterThan(0.25);
    // ...but it must catch up, or the part detaches and never comes back.
    expect(Math.abs(lead.value - trail.value)).toBeLessThan(0.12);
  });

  /*
   * Interruption. Retarget a spring mid-flight and it carries its velocity into
   * the new move; retarget a keyframe and it snaps. A child taps faster than any
   * animation finishes, so this is the common case, not the edge case.
   */
  it('retargets without snapping', () => {
    let s = spring(0);
    for (let i = 0; i < 12; i += 1) s = stepSpring(s, 1, SNAPPY, DT);
    expect(s.velocity).toBeGreaterThan(0.5);

    const before = s.value;
    const reversed = stepSpring(s, -1, SNAPPY, DT);

    /*
     * Position is continuous: reversing a two-unit journey moves it a few
     * hundredths in the first frame, not most of the way. That is the whole
     * difference from a keyframe, which would restart the interpolation from
     * wherever it happened to be and jump.
     *
     * The velocity itself does flip within a single frame at this stiffness —
     * 260 against a target two units away is an enormous restoring force — so
     * asserting the velocity stays positive would be asserting something that
     * is simply not true of a stiff spring.
     */
    expect(Math.abs(reversed.value - before)).toBeLessThan(0.1);
    expect(Math.abs(before - -1)).toBeGreaterThan(1);
  });

  it('knows when it has stopped', () => {
    let s = spring(0);
    expect(atRest(s, 1)).toBe(false);
    for (let t = 0; t < 4; t += DT) s = stepSpring(s, 1, SNAPPY, DT);
    expect(atRest(s, 1)).toBe(true);
  });

  it('holds still when it is already there', () => {
    const s = stepSpring(spring(0.5), 0.5, SNAPPY, DT);
    expect(s.value).toBeCloseTo(0.5, 6);
    expect(s.velocity).toBeCloseTo(0, 6);
  });

  it('keeps the feel when stiffness changes, because damping is a ratio', () => {
    // Damping expressed as a raw coefficient silently changes the bounce as
    // soon as stiffness moves; as a fraction of critical it does not.
    const soft = drive({ stiffness: 90, damping: 0.5 }, 1).peak;
    const stiff = drive({ stiffness: 360, damping: 0.5 }, 1).peak;
    expect(Math.abs(soft - stiff)).toBeLessThan(0.05);
  });
});
