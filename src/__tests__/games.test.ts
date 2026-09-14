import { describe, expect, it } from 'vitest';
import {
  GAMES,
  WORD_CARDS,
  gamesForBand,
  getGame,
  highestAge,
  lowestAge,
  wordsForAge,
} from '../content/games';
import {
  DEFAULT_CALIBRATION,
  bytesToSamples,
  calibrateFrom,
  countBursts,
  countSyllables,
  rms,
  rmsToLevel,
  scoreAttempt,
  smooth,
  targetForWord,
} from '../engine/voiceMeter';
import { MODES, PILLARS, isEncouraged } from '../engine/dayArc';

describe('voice meter maths', () => {
  it('reads silence as zero', () => {
    expect(rms(new Float32Array(64))).toBe(0);
    expect(rms([])).toBe(0);
  });

  it('computes RMS of a known signal', () => {
    expect(rms([1, -1, 1, -1])).toBeCloseTo(1, 5);
    expect(rms([0.5, -0.5])).toBeCloseTo(0.5, 5);
  });

  it('converts a byte frame, where 128 is silence', () => {
    const samples = bytesToSamples(new Uint8Array([128, 128, 128]));
    expect(Array.from(samples)).toEqual([0, 0, 0]);
    expect(bytesToSamples(new Uint8Array([255]))[0]).toBeCloseTo(0.992, 2);
    expect(bytesToSamples(new Uint8Array([0]))[0]).toBe(-1);
  });

  it('clamps level to 0..1 either side of the range', () => {
    expect(rmsToLevel(0)).toBe(0);
    expect(rmsToLevel(999)).toBe(1);
    expect(rmsToLevel(DEFAULT_CALIBRATION.floor)).toBe(0);
    expect(rmsToLevel(DEFAULT_CALIBRATION.ceiling)).toBe(1);
  });

  it('rises faster at the quiet end than a linear map', () => {
    // A quiet child must feel like they are doing something.
    const mid = (DEFAULT_CALIBRATION.floor + DEFAULT_CALIBRATION.ceiling) / 2;
    expect(rmsToLevel(mid)).toBeGreaterThan(0.5);
  });

  it('is monotonic', () => {
    let previous = -1;
    for (let v = 0; v <= 0.3; v += 0.01) {
      const level = rmsToLevel(v);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it('never divides by zero on a degenerate calibration', () => {
    expect(rmsToLevel(0.5, { floor: 0.2, ceiling: 0.2 })).toBe(0);
    expect(rmsToLevel(0.5, { floor: 0.5, ceiling: 0.1 })).toBe(0);
  });

  it('smooths towards the new value without overshooting', () => {
    expect(smooth(0, 1, 0.5)).toBe(0.5);
    expect(smooth(1, 1)).toBe(1);
    const stepped = smooth(0, 1, 0.35);
    expect(stepped).toBeGreaterThan(0);
    expect(stepped).toBeLessThan(1);
  });
});

describe('room calibration', () => {
  it('falls back when there is no sample', () => {
    expect(calibrateFrom([])).toEqual(DEFAULT_CALIBRATION);
  });

  it('raises the floor in a noisy room', () => {
    const quiet = calibrateFrom([0.01, 0.012, 0.011]);
    const noisy = calibrateFrom([0.09, 0.1, 0.095]);
    expect(noisy.floor).toBeGreaterThan(quiet.floor);
  });

  it('keeps the target reachable above the floor', () => {
    for (const ambient of [[0.005], [0.05], [0.2]]) {
      const cal = calibrateFrom(ambient);
      expect(cal.ceiling).toBeGreaterThan(cal.floor);
      expect(rmsToLevel(cal.ceiling, cal)).toBe(1);
    }
  });

  it('ignores a single door slam', () => {
    // Median, not mean: one spike must not lock a child out for the session.
    const withSpike = calibrateFrom([0.01, 0.011, 0.01, 0.9, 0.012]);
    const without = calibrateFrom([0.01, 0.011, 0.01, 0.012]);
    expect(withSpike.floor).toBeCloseTo(without.floor, 2);
  });
});

describe('syllable bursts', () => {
  const quiet = [0.05, 0.05];
  const loud = [0.6, 0.7, 0.6];

  it('counts nothing in silence', () => {
    expect(countBursts([0, 0, 0, 0])).toBe(0);
  });

  it('counts one sustained sound as one burst', () => {
    expect(countBursts([...quiet, ...loud, ...quiet])).toBe(1);
  });

  it('counts three separated bursts as three', () => {
    // "but-ter-fly"
    expect(countBursts([...quiet, ...loud, ...quiet, ...loud, ...quiet, ...loud, ...quiet])).toBe(3);
  });

  it('counts a burst still running at the end', () => {
    expect(countBursts([...quiet, ...loud])).toBe(1);
  });

  it('uses hysteresis so a wobbling voice is still one syllable', () => {
    // Dips below the ON threshold but stays above OFF — one continuous sound.
    expect(countBursts([0.05, 0.6, 0.25, 0.6, 0.25, 0.6, 0.05])).toBe(1);
  });

  it('ignores a cough too short to be a syllable', () => {
    expect(countBursts([0.05, 0.9, 0.05], { minFrames: 3 })).toBe(0);
  });

  it('a shout cannot fake a three-syllable word', () => {
    // The whole reason syllable mode exists: one long "aaah" is one burst.
    const shout = Array.from({ length: 40 }, () => 0.95);
    expect(countBursts([...quiet, ...shout, ...quiet])).toBe(1);
    expect(countBursts([...quiet, ...shout, ...quiet])).toBeLessThan(
      countSyllables('butterfly'),
    );
  });
});

describe('scoring an attempt', () => {
  const quiet = [0.05, 0.05];
  const loud = (n = 3) => Array.from({ length: n }, () => 0.7);

  it('lands a leap when the voice reaches the target', () => {
    const r = scoreAttempt({ levels: [...quiet, ...loud(), ...quiet], mode: 'leap', syllables: 1, target: 0.5 });
    expect(r.landed).toBe(true);
    expect(r.peak).toBeCloseTo(0.7, 5);
  });

  it('misses a leap when the voice falls short', () => {
    const r = scoreAttempt({ levels: [0.2, 0.25, 0.2], mode: 'leap', syllables: 1, target: 0.5 });
    expect(r.landed).toBe(false);
  });

  it('lands a syllable word only with enough beats', () => {
    const three = [...quiet, ...loud(), ...quiet, ...loud(), ...quiet, ...loud(), ...quiet];
    expect(scoreAttempt({ levels: three, mode: 'syllable', syllables: 3, target: 0.42 }).landed).toBe(true);
    expect(scoreAttempt({ levels: three, mode: 'syllable', syllables: 4, target: 0.42 }).landed).toBe(false);
  });

  it('will not let one long shout pass for a three-beat word', () => {
    // The whole reason syllable mode exists.
    const shout = Array.from({ length: 40 }, () => 0.95);
    const r = scoreAttempt({ levels: [...quiet, ...shout, ...quiet], mode: 'syllable', syllables: 3, target: 0.42 });
    expect(r.bursts).toBe(1);
    expect(r.landed).toBe(false);
  });

  it('ignores noise too quiet to be a burst', () => {
    // Three blips, all under the burst threshold: no beats, no landing.
    const blips = [0.05, 0.3, 0.3, 0.05, 0.3, 0.3, 0.05, 0.3, 0.3, 0.05];
    const r = scoreAttempt({ levels: blips, mode: 'syllable', syllables: 3, target: 0.42 });
    expect(r.bursts).toBe(0);
    expect(r.landed).toBe(false);
  });

  it('cannot be won in silence by a word that reports no syllables', () => {
    // Degenerate input: "enough beats" must not be satisfiable by saying nothing.
    const r = scoreAttempt({ levels: [0, 0, 0], mode: 'syllable', syllables: 0, target: 0.42 });
    expect(r.landed).toBe(false);
  });

  it('scores an empty attempt as a miss, not a crash', () => {
    const r = scoreAttempt({ levels: [], mode: 'leap', syllables: 1, target: 0.5 });
    expect(r).toEqual({ landed: false, peak: 0, bursts: 0 });
  });

  it('asks a little more voice of a longer word, but caps the shouting', () => {
    expect(targetForWord(3, 'leap')).toBeGreaterThan(targetForWord(1, 'leap'));
    expect(targetForWord(9, 'leap')).toBeLessThanOrEqual(0.75);
    // Syllable mode is about beats, not volume, so the bar does not move.
    expect(targetForWord(1, 'syllable')).toBe(targetForWord(5, 'syllable'));
  });
});

describe('game catalogue', () => {
  it('names a real skill for every game', () => {
    for (const game of GAMES) {
      expect(game.skills.length, game.id).toBeGreaterThan(0);
      expect(game.blurb.length, game.id).toBeGreaterThan(10);
    }
  });

  it('gives every game a sane age range', () => {
    for (const game of GAMES) {
      expect(game.minAge, game.id).toBeGreaterThanOrEqual(2);
      expect(game.maxAge, game.id).toBeGreaterThan(game.minAge);
    }
  });

  it('has unique ids', () => {
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
  });

  it('marks the youngest games as played with a grown-up', () => {
    // AAP 2026 weighs co-viewing heavily; a two-year-old is not handed a device.
    for (const game of GAMES.filter((g) => g.minAge <= 2)) {
      expect(game.together, game.id).toBe(true);
    }
  });

  it('matches games to a profile band by overlap', () => {
    const young = gamesForBand('3-5').map((g) => g.id);
    const older = gamesForBand('9-11').map((g) => g.id);
    expect(young).toContain('lumis-leap');
    expect(young).not.toContain('tongue-twister');
    expect(older).not.toContain('wake-the-animal');
  });

  it('lists playable games before planned ones', () => {
    const statuses = gamesForBand('6-8').map((g) => g.status);
    const firstPlanned = statuses.indexOf('planned');
    if (firstPlanned >= 0) {
      expect(statuses.slice(firstPlanned)).not.toContain('playable');
    }
  });

  it('parses profile band bounds', () => {
    expect(lowestAge('3-5')).toBe(3);
    expect(highestAge('9-11')).toBe(11);
  });

  it('grades word cards by age and never returns an empty list', () => {
    expect(wordsForAge(2).every((w) => w.minAge <= 2)).toBe(true);
    expect(wordsForAge(6).length).toBeGreaterThan(wordsForAge(2).length);
    expect(wordsForAge(0).length).toBeGreaterThan(0);
  });

  it('keeps the youngest words to one or two syllables', () => {
    for (const card of WORD_CARDS.filter((w) => w.minAge <= 3)) {
      expect(countSyllables(card.word), card.word).toBeLessThanOrEqual(2);
    }
  });

  it('offers multi-syllable words once the syllable game is in range', () => {
    const hop = getGame('syllable-hop');
    const words = wordsForAge(hop.minAge, 50);
    expect(words.some((w) => countSyllables(w.word) >= 2)).toBe(true);
  });

  it('throws on an unknown game rather than rendering nothing', () => {
    expect(() => getGame('nope')).toThrow(/Unknown game/);
  });
});

describe('games in the day arc', () => {
  it('is a pillar in every mode', () => {
    expect(PILLARS.games).toBeDefined();
    for (const mode of Object.values(MODES)) expect(mode.order).toContain('games');
  });

  it('is offered first in the daytime and last at bedtime', () => {
    expect(MODES.play.order[0]).toBe('games');
    expect(MODES.winddown.order[MODES.winddown.order.length - 1]).toBe('games');
  });

  it('is never encouraged at bedtime, but never locked either', () => {
    expect(isEncouraged('winddown', 'games')).toBe(false);
    expect(isEncouraged('wake', 'games')).toBe(true);
    expect(isEncouraged('play', 'games')).toBe(true);
  });
});
