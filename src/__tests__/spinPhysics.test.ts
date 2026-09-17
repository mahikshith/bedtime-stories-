import { describe, expect, it } from 'vitest';
import {
  HOLD_SECONDS,
  arc,
  buildDial,
  dialComplete,
  stepDial,
  underMarker,
  wrap,
  type Dial,
} from '../engine/spinPhysics';

const DT = 1 / 60;

/** Turns the dial by `delta` turns per frame for `seconds`. */
function turn(dial: Dial, delta: number, seconds: number) {
  let d = dial;
  const events = [];
  for (let f = 0; f * DT < seconds; f += 1) {
    const r = stepDial(d, { delta, dt: DT });
    d = r.dial;
    events.push(...r.events);
  }
  return { dial: d, events };
}

/**
 * Turns the dial to `index` the way a child would, then holds it.
 *
 * Deliberately NOT one big jump to the right angle: a single large delta is a
 * huge implied speed, the dial then refuses to count a star it is hurtling
 * past — correctly — and every hold assertion fails for a reason that has
 * nothing to do with the code under test.
 */
function aim(dial: Dial, index: number) {
  let d = dial;
  const events = [];
  const want = wrap(-d.stars[index].at);
  for (let f = 0; f < 600; f += 1) {
    const togo = arc(d.angle, want);
    if (Math.abs(togo) < 0.002) break;
    const r = stepDial(d, { delta: Math.max(-0.008, Math.min(0.008, togo)), dt: DT });
    d = r.dial;
    events.push(...r.events);
  }
  for (let f = 0; f < 180; f += 1) {
    const r = stepDial(d, { delta: 0, dt: DT });
    d = r.dial;
    events.push(...r.events);
  }
  return { dial: d, events };
}


describe('angles on a circle', () => {
  it('wraps negatives the way % does not', () => {
    expect(wrap(-0.25)).toBeCloseTo(0.75, 6);
    expect(wrap(1.25)).toBeCloseTo(0.25, 6);
    expect(wrap(0)).toBe(0);
  });

  it('always takes the short way round', () => {
    expect(arc(0.1, 0.2)).toBeCloseTo(0.1, 6);
    expect(arc(0.9, 0.1)).toBeCloseTo(0.2, 6);
    expect(arc(0.1, 0.9)).toBeCloseTo(-0.2, 6);
    for (let a = 0; a < 1; a += 0.017) {
      for (let b = 0; b < 1; b += 0.017) {
        expect(Math.abs(arc(a, b))).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    }
  });
});

describe('the dial', () => {
  it('starts with a star under the marker and another one wanted', () => {
    const dial = buildDial(1);
    expect(underMarker(dial)).toBe(0);
    expect(dial.target).toBe(1);
    expect(dialComplete(dial)).toBe(false);
  });

  it('finds a star that is aimed at and held', () => {
    const { dial, events } = aim(buildDial(1), 1);
    expect(dial.stars[1].found).toBe(true);
    expect(events.filter((e) => e.kind === 'found')).toHaveLength(1);
  });

  /*
   * The hold is the whole ask. Without it the game is "sweep the dial until
   * something lights up", which a child can win by flailing — and flailing is
   * exactly what a phone-rotation game must not reward.
   */
  it('will not count a star swept past at speed', () => {
    const { events } = turn(buildDial(5), 0.02, 4);
    expect(events.filter((e) => e.kind === 'found')).toHaveLength(0);
  });

  it('needs the star held for the time it says', () => {
    let dial = buildDial(1);
    // Turn to it, stopping just short of the hold.
    const want = wrap(-dial.stars[1].at);
    for (let f = 0; f < 600; f += 1) {
      const togo = arc(dial.angle, want);
      if (Math.abs(togo) < 0.002) break;
      dial = stepDial(dial, { delta: Math.max(-0.008, Math.min(0.008, togo)), dt: DT }).dial;
    }
    let waited = 0;
    while (waited < HOLD_SECONDS * 0.6) {
      dial = stepDial(dial, { delta: 0, dt: DT }).dial;
      waited += DT;
    }
    expect(dial.stars[1].found).toBe(false);
    while (waited < HOLD_SECONDS * 2) {
      dial = stepDial(dial, { delta: 0, dt: DT }).dial;
      waited += DT;
    }
    expect(dial.stars[1].found).toBe(true);
  });

  it('reports progress through the hold so the ring can fill', () => {
    let dial = buildDial(1);
    const want = wrap(-dial.stars[1].at);
    for (let f = 0; f < 600; f += 1) {
      const togo = arc(dial.angle, want);
      if (Math.abs(togo) < 0.002) break;
      dial = stepDial(dial, { delta: Math.max(-0.008, Math.min(0.008, togo)), dt: DT }).dial;
    }
    const seen: number[] = [];
    for (let f = 0; f < 30; f += 1) {
      const r = stepDial(dial, { delta: 0, dt: DT });
      dial = r.dial;
      seen.push(r.progress);
    }
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(seen[seen.length - 1]).toBeGreaterThan(0);
  });

  it('resets the hold if the dial is nudged off', () => {
    let dial = buildDial(1);
    const want = wrap(-dial.stars[1].at);
    for (let f = 0; f < 600; f += 1) {
      const togo = arc(dial.angle, want);
      if (Math.abs(togo) < 0.002) break;
      dial = stepDial(dial, { delta: Math.max(-0.008, Math.min(0.008, togo)), dt: DT }).dial;
    }
    for (let f = 0; f < 20; f += 1) dial = stepDial(dial, { delta: 0, dt: DT }).dial;
    expect(dial.held).toBeGreaterThan(0);
    dial = stepDial(dial, { delta: 0.3, dt: DT }).dial;
    expect(dial.held).toBe(0);
  });

  it('moves on to a star still missing, and finishes', () => {
    let dial = buildDial(1);
    for (let i = 0; i < dial.stars.length + 1 && !dialComplete(dial); i += 1) {
      dial = aim(dial, dial.target).dial;
    }
    expect(dialComplete(dial)).toBe(true);
    expect(dial.stars.every((s) => s.found)).toBe(true);
  });

  /*
   * The dial goes exactly where it is put and stays there.
   *
   * It coasted at first, and that made the game unplayable: a deliberate drag
   * onto a star slid forty-six degrees past it on release, every time. It is
   * also simply wrong for the sensor, which is the real control — there is no
   * release to coast from when the dial is mirroring where a phone points.
   */
  it('goes exactly where it is put, however gappy the input', () => {
    let dial = buildDial(3);
    const start = dial.angle;
    let swept = 0;
    for (let f = 0; f < 60; f += 1) {
      // Every third frame carries a move; the rest are gaps, as they are in life.
      const delta = f % 3 === 0 ? -0.01 : 0;
      swept += delta;
      dial = stepDial(dial, { delta, dt: DT }).dial;
    }
    expect(dial.angle).toBeCloseTo(wrap(start + swept), 6);
  });

  it('stops the moment the input does', () => {
    let dial = buildDial(3);
    for (let f = 0; f < 10; f += 1) dial = stepDial(dial, { delta: 0.01, dt: DT }).dial;
    const parked = dial.angle;
    for (let f = 0; f < 120; f += 1) dial = stepDial(dial, { delta: 0, dt: DT }).dial;
    expect(dial.angle).toBeCloseTo(parked, 9);
    // The speed estimate still has to fall, or the hold can never start.
    expect(Math.abs(dial.spin)).toBeLessThan(0.01);
  });

  it('announces entering and leaving a star, once each', () => {
    const dial = buildDial(1);
    const { events } = turn(dial, 0.004, 3);
    const enters = events.filter((e) => e.kind === 'enter').length;
    const leaves = events.filter((e) => e.kind === 'leave').length;
    expect(enters).toBeGreaterThan(0);
    expect(enters).toBeLessThan(12);
    expect(Math.abs(enters - leaves)).toBeLessThanOrEqual(1);
  });

  it('stays on the circle whatever it is fed', () => {
    let dial = buildDial(5);
    for (let f = 0; f < 6000; f += 1) {
      dial = stepDial(dial, { delta: Math.sin(f * 0.7) * 3, dt: f % 11 === 0 ? 2 : DT }).dial;
      expect(dial.angle).toBeGreaterThanOrEqual(0);
      expect(dial.angle).toBeLessThan(1);
      expect(Number.isFinite(dial.spin)).toBe(true);
    }
  });
});

describe('the Star Dial ladder', () => {
  it('adds stars and tightens the aim every level', () => {
    const dials = [1, 2, 3, 4, 5].map(buildDial);
    for (let i = 1; i < dials.length; i += 1) {
      expect(dials[i].stars.length).toBeGreaterThan(dials[i - 1].stars.length);
      expect(dials[i].tolerance).toBeLessThan(dials[i - 1].tolerance);
    }
  });

  /*
   * If tolerance ever grew past half the gap between neighbours, two stars
   * would be selectable at once and the nearer-wins rule would decide it
   * invisibly. Level 5 is where this is tightest, so it is checked everywhere.
   */
  it('never lets two stars claim the marker at once', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const dial = buildDial(level);
      const gap = 1 / dial.stars.length;
      expect(dial.tolerance).toBeLessThan(gap / 2);
    }
  });

  it('always leaves something selectable somewhere on the circle', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const dial = buildDial(level);
      let reachable = 0;
      for (let a = 0; a < 1; a += 0.001) {
        if (underMarker({ ...dial, angle: a }) >= 0) reachable += 1;
      }
      expect(reachable).toBeGreaterThan(0);
    }
  });

  it('clamps a level out of range', () => {
    expect(buildDial(0).stars.length).toBe(buildDial(1).stars.length);
    expect(buildDial(99).stars.length).toBe(buildDial(5).stars.length);
  });
});
