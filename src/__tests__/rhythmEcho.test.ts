import { describe, expect, it } from 'vitest';
import {
  NO_ONSET,
  PATTERNS,
  callSeconds,
  feedLevel,
  patternFor,
  scoreEcho,
  type OnsetState,
} from '../engine/rhythmEcho';

/** Plays a stream of amplitudes through the detector and collects onset times. */
function listen(frames: { level: number; t: number }[]): number[] {
  let state: OnsetState = NO_ONSET;
  const onsets: number[] = [];
  for (const f of frames) {
    const r = feedLevel(state, f.level, f.t);
    state = r.state;
    if (r.onset !== null) onsets.push(r.onset);
  }
  return onsets;
}

/** A clap: `frames` loud frames at 60fps starting at `at`. */
function clap(at: number, frames = 5, level = 0.8) {
  return Array.from({ length: frames }, (_, i) => ({ level, t: at + i / 60 }));
}

function quiet(from: number, frames = 12) {
  return Array.from({ length: frames }, (_, i) => ({ level: 0.02, t: from + i / 60 }));
}

describe('hearing the claps', () => {
  it('finds one onset per clap', () => {
    const onsets = listen([
      ...quiet(0), ...clap(0.2), ...quiet(0.3),
      ...clap(0.8), ...quiet(0.9),
      ...clap(1.4), ...quiet(1.5),
    ]);
    expect(onsets).toHaveLength(3);
  });

  it('times an onset from the attack, not from the confirmation', () => {
    const [first] = listen([...quiet(0), ...clap(0.5), ...quiet(0.6)]);
    expect(first).toBeCloseTo(0.5, 5);
  });

  it('does not hear a wobbling voice as several claps', () => {
    // One long sound that dips a little but never stops.
    const frames = Array.from({ length: 40 }, (_, i) => ({
      level: 0.5 + 0.2 * Math.sin(i),
      t: i / 60,
    }));
    expect(listen([...quiet(0), ...frames])).toHaveLength(1);
  });

  it('ignores a single-frame click', () => {
    expect(listen([...quiet(0), ...clap(0.3, 1), ...quiet(0.4)])).toHaveLength(0);
  });

  it('refuses two claps closer together than a person can make them', () => {
    const onsets = listen([
      ...quiet(0), ...clap(0.2, 3), ...quiet(0.25, 2), ...clap(0.28, 3), ...quiet(0.4),
    ]);
    expect(onsets).toHaveLength(1);
  });

  it('hears a quiet room as nothing at all', () => {
    expect(listen(quiet(0, 600))).toHaveLength(0);
  });
});

describe('judging the echo', () => {
  it('accepts a perfect echo', () => {
    const p = PATTERNS[2];
    expect(scoreEcho(p, [...p]).ok).toBe(true);
  });

  /*
   * The point of normalising: a child who thinks for a second first, or claps
   * the whole thing briskly, has still echoed the pattern.
   */
  it('accepts the same shape started late and clapped fast', () => {
    const p = PATTERNS[3];
    const shifted = p.map((t) => 4.2 + t * 0.78);
    expect(scoreEcho(p, shifted).ok).toBe(true);
  });

  it('rejects the right number of claps in the wrong shape', () => {
    const p = PATTERNS[2]; // short short short LONG
    const even = [0, 0.5, 1.0, 1.5];
    expect(scoreEcho(p, even).ok).toBe(false);
  });

  it('rejects the wrong number of claps outright', () => {
    const p = PATTERNS[2];
    expect(scoreEcho(p, p.slice(1)).ok).toBe(false);
    expect(scoreEcho(p, [...p, 2.0]).ok).toBe(false);
    expect(scoreEcho(p, []).ok).toBe(false);
  });

  it('calls two claps right whenever there are two of them', () => {
    // One gap normalised by itself is 1 for every possible pair of times, so
    // there is no shape to judge here and pretending otherwise would be noise.
    expect(scoreEcho(PATTERNS[0], [0, 0.6]).ok).toBe(true);
    expect(scoreEcho(PATTERNS[0], [3, 5.5]).ok).toBe(true);
    expect(scoreEcho(PATTERNS[0], [3]).ok).toBe(false);
  });

  it('scores a near miss above a wild one', () => {
    const p = PATTERNS[2];
    const near = p.map((t, i) => t + (i === 1 ? 0.06 : 0));
    const wild = [0, 1.2, 1.3, 1.4];
    expect(scoreEcho(p, near).accuracy).toBeGreaterThan(scoreEcho(p, wild).accuracy);
  });
});

describe('the Echo Cave ladder', () => {
  it('adds a clap at every level', () => {
    for (let i = 1; i < PATTERNS.length; i += 1) {
      expect(PATTERNS[i].length).toBeGreaterThan(PATTERNS[i - 1].length);
    }
  });

  it('starts every pattern at zero and moves forward', () => {
    for (const p of PATTERNS) {
      expect(p[0]).toBe(0);
      for (let i = 1; i < p.length; i += 1) expect(p[i]).toBeGreaterThan(p[i - 1]);
    }
  });

  it('keeps every gap inside what a child can actually clap', () => {
    for (const p of PATTERNS) {
      for (let i = 1; i < p.length; i += 1) {
        const gap = p[i] - p[i - 1];
        expect(gap).toBeGreaterThanOrEqual(0.25);
        expect(gap).toBeLessThanOrEqual(1.2);
      }
    }
  });

  it('clamps a level out of range', () => {
    expect(patternFor(0)).toEqual(PATTERNS[0]);
    expect(patternFor(99)).toEqual(PATTERNS[4]);
  });

  it('leaves a beat of silence after the call', () => {
    for (const p of PATTERNS) expect(callSeconds(p)).toBeGreaterThan(p[p.length - 1]);
  });
});
