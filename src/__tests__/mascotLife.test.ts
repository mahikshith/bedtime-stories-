import { describe, expect, it } from 'vitest';
import { REST, blinkAt, clampPose, glance, idlePose } from '../components/mascot/life';

/** Samples the idle pose across a long stretch of time. */
function sample(seconds: number, step = 1 / 30, options = {}) {
  const poses = [];
  for (let t = 0; t < seconds; t += step) poses.push(idlePose(t, options));
  return poses;
}

describe('Lumi idling', () => {
  it('stays inside the range the drawing can take', () => {
    for (const pose of sample(400, 1 / 20)) {
      expect(pose.turn).toBeGreaterThanOrEqual(-1);
      expect(pose.turn).toBeLessThanOrEqual(1);
      expect(pose.lean).toBeGreaterThanOrEqual(-1);
      expect(pose.lean).toBeLessThanOrEqual(1);
      expect(pose.breath).toBeGreaterThanOrEqual(0);
      expect(pose.breath).toBeLessThanOrEqual(1);
      expect(pose.lids).toBeGreaterThanOrEqual(0);
      expect(pose.lids).toBeLessThanOrEqual(1);
    }
  });

  it('actually moves', () => {
    const turns = sample(30).map((p) => p.turn);
    expect(Math.max(...turns) - Math.min(...turns)).toBeGreaterThan(0.4);
  });

  it('moves smoothly enough not to jitter', () => {
    const poses = sample(60, 1 / 60);
    for (let i = 1; i < poses.length; i += 1) {
      // A frame may never jump more than a small fraction of the full range,
      // or the head snaps instead of turning.
      expect(Math.abs(poses[i].turn - poses[i - 1].turn)).toBeLessThan(0.02);
      expect(Math.abs(poses[i].lean - poses[i - 1].lean)).toBeLessThan(0.02);
    }
  });

  /*
   * A single sine is a metronome, and the eye finds a metronome in seconds.
   * This checks the combined motion does not simply repeat on the base period.
   */
  it('does not visibly loop', () => {
    const period = (2 * Math.PI) / 0.23;
    const offsets = [0, period, period * 2].map((o) => idlePose(11 + o).turn);
    expect(Math.abs(offsets[0] - offsets[1])).toBeGreaterThan(0.05);
    expect(Math.abs(offsets[1] - offsets[2])).toBeGreaterThan(0.05);
  });

  it('turns the head and the weight independently', () => {
    const poses = sample(120, 1 / 10);
    // If lean simply followed turn the mascot would be a rocking plank.
    const sameSign = poses.filter((p) => Math.sign(p.turn) === Math.sign(p.lean)).length;
    expect(sameSign / poses.length).toBeGreaterThan(0.25);
    expect(sameSign / poses.length).toBeLessThan(0.75);
  });

  it('damps everything except the breath when energy drops', () => {
    const lively = sample(120, 1 / 10);
    const calm = sample(120, 1 / 10, { energy: 0.25 });
    const span = (list: { turn: number }[]) =>
      Math.max(...list.map((p) => p.turn)) - Math.min(...list.map((p) => p.turn));
    expect(span(calm)).toBeLessThan(span(lively) * 0.5);

    const breathSpan = (list: { breath: number }[]) =>
      Math.max(...list.map((p) => p.breath)) - Math.min(...list.map((p) => p.breath));
    // Breathing is not an idle flourish. A mascot that stops breathing during
    // wind-down reads as switched off rather than as settling down.
    expect(breathSpan(calm)).toBeCloseTo(breathSpan(lively), 1);
  });

  it('holds still when frozen, but keeps breathing', () => {
    const poses = sample(30, 1 / 20, { frozen: true });
    expect(poses.every((p) => p.turn === 0 && p.lean === 0 && p.nod === 0)).toBe(true);
    expect(Math.max(...poses.map((p) => p.breath))).toBeGreaterThan(0.9);
  });
});

describe('blinking', () => {
  it('blinks often enough to be alive and rarely enough not to twitch', () => {
    let blinks = 0;
    let shut = false;
    for (let t = 0; t < 60; t += 1 / 120) {
      const lids = blinkAt(t);
      if (!shut && lids < 0.4) { shut = true; blinks += 1; }
      if (shut && lids > 0.9) shut = false;
    }
    expect(blinks).toBeGreaterThan(10);
    expect(blinks).toBeLessThan(30);
  });

  it('shuts faster than it opens', () => {
    // Find a blink, then compare how long each half takes.
    let start = -1;
    for (let t = 0; t < 10; t += 1 / 480) {
      if (blinkAt(t) < 0.999) { start = t; break; }
    }
    expect(start).toBeGreaterThanOrEqual(0);
    let bottom = start;
    let low = 1;
    for (let t = start; t < start + 0.2; t += 1 / 480) {
      const v = blinkAt(t);
      if (v < low) { low = v; bottom = t; }
    }
    let end = bottom;
    for (let t = bottom; t < start + 0.4; t += 1 / 480) {
      if (blinkAt(t) >= 0.999) { end = t; break; }
    }
    expect(low).toBeLessThan(0.1);
    expect(bottom - start).toBeLessThan(end - bottom);
  });

  it('never blinks on a fixed beat', () => {
    const shutAt: number[] = [];
    let shut = false;
    for (let t = 0; t < 120; t += 1 / 120) {
      const lids = blinkAt(t);
      if (!shut && lids < 0.4) { shut = true; shutAt.push(t); }
      if (shut && lids > 0.9) shut = false;
    }
    const gaps = shutAt.slice(1).map((v, i) => v - shutAt[i]);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.5);
  });
});

describe('a deliberate glance', () => {
  it('starts and ends where it began', () => {
    expect(glance(0, 1)).toBeCloseTo(0, 6);
    expect(glance(1, 1)).toBeCloseTo(0, 6);
  });

  it('goes the way it was told', () => {
    expect(glance(0.5, 1)).toBeGreaterThan(0.5);
    expect(glance(0.5, -1)).toBeLessThan(-0.5);
  });

  it('overshoots before it settles, like something with mass', () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => glance(i / 100, 1)));
    expect(peak).toBeGreaterThan(1);
  });

  it('clamps progress rather than flying off', () => {
    expect(glance(-5, 1)).toBeCloseTo(0, 6);
    expect(glance(9, 1)).toBeCloseTo(0, 6);
  });
});

describe('clampPose', () => {
  it('pulls a wild pose back into range', () => {
    const wild = clampPose({ turn: 9, lean: -9, breath: 4, lids: -2, nod: 3 });
    expect(wild).toEqual({ turn: 1, lean: -1, breath: 1, lids: 0, nod: 1 });
  });

  it('leaves rest alone', () => {
    expect(clampPose(REST)).toEqual(REST);
  });
});
