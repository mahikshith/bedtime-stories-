import { describe, expect, it } from 'vitest';
import { MODES, PILLARS, currentMode, isEncouraged, modeForHour } from '../engine/dayArc';

describe('the day arc', () => {
  it('wakes in the morning, plays in the day, winds down at night', () => {
    expect(modeForHour(6)).toBe('wake');
    expect(modeForHour(10)).toBe('wake');
    expect(modeForHour(11)).toBe('play');
    expect(modeForHour(15)).toBe('play');
    expect(modeForHour(18)).toBe('winddown');
    expect(modeForHour(21)).toBe('winddown');
    expect(modeForHour(2)).toBe('winddown');
  });

  it('covers every hour of the clock', () => {
    for (let h = 0; h < 24; h++) expect(MODES[modeForHour(h)]).toBeDefined();
  });

  it('handles out-of-range and fractional hours', () => {
    expect(modeForHour(24)).toBe(modeForHour(0));
    expect(modeForHour(-1)).toBe(modeForHour(23));
    expect(modeForHour(6.9)).toBe('wake');
  });

  it('reads the mode off a date', () => {
    const evening = new Date();
    evening.setHours(20, 0, 0, 0);
    expect(currentMode(evening)).toBe('winddown');
  });

  it('gets calmer as the day goes on', () => {
    expect(MODES.wake.calm).toBeLessThan(MODES.play.calm);
    expect(MODES.play.calm).toBeLessThan(MODES.winddown.calm);
  });

  it('offers every pillar in every mode, in a different order', () => {
    const all = Object.keys(PILLARS).sort();
    for (const mode of Object.values(MODES)) {
      expect([...mode.order].sort()).toEqual(all);
    }
    expect(MODES.wake.order[0]).toBe('rhymes');
    expect(MODES.winddown.order[0]).toBe('stories');
    expect(MODES.wake.order).not.toEqual(MODES.winddown.order);
  });

  it('suppresses only the lively pillars at bedtime, and locks nothing', () => {
    // A locked app at 7pm starts an argument, so wind-down stops *offering*
    // rather than stops allowing.
    expect(isEncouraged('winddown', 'stories')).toBe(true);
    expect(isEncouraged('winddown', 'rhymes')).toBe(true);
    expect(isEncouraged('winddown', 'create')).toBe(false);
    expect(isEncouraged('winddown', 'learn')).toBe(false);

    for (const pillar of Object.keys(PILLARS) as (keyof typeof PILLARS)[]) {
      expect(isEncouraged('wake', pillar)).toBe(true);
      expect(isEncouraged('play', pillar)).toBe(true);
    }
  });
});
