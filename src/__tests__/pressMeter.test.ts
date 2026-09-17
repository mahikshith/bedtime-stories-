import { describe, expect, it } from 'vitest';
import { BREATH_LEVEL, pressSamples, tapSamples } from '../engine/pressMeter';
import { countBursts, detectBreath, scoreAttempt, targetForWord } from '../engine/voiceMeter';

describe('a press standing in for a voice', () => {
  it('produces roughly as many samples as the meter would have', () => {
    expect(pressSamples(1).length).toBeCloseTo(60, -1);
    expect(pressSamples(0).length).toBe(0);
    expect(pressSamples(-3).length).toBe(0);
  });

  it('stays inside the range a real level can take', () => {
    for (const level of pressSamples(4)) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });

  /*
   * The whole point: the games' scoring is not told that the microphone is
   * missing. If a long press did not read as a breath, every voice game would
   * still need its own separate no-microphone logic, which is how the dead-end
   * screens got there in the first place.
   */
  it('reads as a breath when it is held at breath height', () => {
    expect(detectBreath(pressSamples(3.2, BREATH_LEVEL)).isBreath).toBe(true);
  });

  it('does not read as a breath when it is a stab', () => {
    expect(detectBreath(pressSamples(0.2, BREATH_LEVEL)).isBreath).toBe(false);
  });

  /*
   * A press loud enough to clear a leap is, correctly, too loud to be a breath.
   * `detectBreath` caps the band at 0.55 so that shouting can never clear the
   * one calm game in the app, and the stand-in must not smuggle a way round it.
   */
  it('cannot pass as a breath at leap height, however long it is held', () => {
    expect(detectBreath(pressSamples(4)).isBreath).toBe(false);
  });

  it('never reaches full height if it is shorter than the attack', () => {
    const peak = Math.max(...pressSamples(0.06), 0);
    expect(peak).toBeLessThan(0.78);
  });

  it('sags the way a held breath does rather than sitting flat', () => {
    const s = pressSamples(3);
    const early = s[Math.round(0.4 * 60)];
    const late = s[Math.round(2.4 * 60)];
    expect(late).toBeLessThan(early);
  });

  it('clears the bar a leap needs', () => {
    const result = scoreAttempt({
      levels: pressSamples(1.2),
      mode: 'leap',
      syllables: 3,
      target: targetForWord(3, 'leap'),
    });
    expect(result.landed).toBe(true);
  });

  it('counts as exactly one burst however long it is held', () => {
    expect(countBursts(pressSamples(4))).toBe(1);
  });
});

describe('taps standing in for syllables', () => {
  it('gives one burst per tap', () => {
    for (const n of [1, 2, 3, 5]) {
      expect(countBursts(tapSamples(n)), `${n} taps`).toBe(n);
    }
  });

  it('clears a syllable attempt when the taps match the word', () => {
    const result = scoreAttempt({
      levels: tapSamples(3),
      mode: 'syllable',
      syllables: 3,
      target: targetForWord(3, 'syllable'),
    });
    expect(result.landed).toBe(true);
  });

  it('fails a syllable attempt with too few taps', () => {
    const result = scoreAttempt({
      levels: tapSamples(1),
      mode: 'syllable',
      syllables: 3,
      target: targetForWord(3, 'syllable'),
    });
    expect(result.landed).toBe(false);
  });

  it('makes nothing out of no taps', () => {
    expect(tapSamples(0)).toEqual([]);
    expect(countBursts(tapSamples(0))).toBe(0);
  });
});
