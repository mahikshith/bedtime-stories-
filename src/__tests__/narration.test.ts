import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VOICE,
  PACES,
  PERSONAS,
  clampRate,
  pickVoice,
  pitchFor,
  rateFor,
  scoreVoice,
  speakableText,
  type VoiceSettings,
} from '../engine/narration';

function voice(over: Partial<SpeechSynthesisVoice>): SpeechSynthesisVoice {
  return {
    name: 'Test', lang: 'en-GB', localService: true, default: false, voiceURI: 'test',
    ...over,
  } as SpeechSynthesisVoice;
}

describe('voice personas', () => {
  it('offers a parent, storyteller, child and device voice', () => {
    expect(PERSONAS.map((p) => p.id)).toEqual(['parent', 'storyteller', 'kid', 'device']);
    PERSONAS.forEach((p) => {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.pitch).toBeGreaterThan(0);
      expect(p.pitch).toBeLessThanOrEqual(2);
    });
  });

  it('reads a child voice higher than a parent voice', () => {
    const kid = pitchFor({ persona: 'kid', pace: 'medium' });
    const parent = pitchFor({ persona: 'parent', pace: 'medium' });
    expect(kid).toBeGreaterThan(parent);
  });

  it('leaves the device voice untouched', () => {
    expect(pitchFor({ persona: 'device', pace: 'medium' })).toBe(1);
    expect(rateFor({ persona: 'device', pace: 'medium' }, 0)).toBe(
      PACES.find((p) => p.id === 'medium')!.rate,
    );
  });
});

describe('pace', () => {
  it('orders the four settings from slowest to fastest', () => {
    const rates = PACES.map((p) => p.rate);
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
  });

  it('applies the chosen pace', () => {
    const slow = rateFor({ persona: 'device', pace: 'slow' }, 0);
    const lively = rateFor({ persona: 'device', pace: 'lively' }, 0);
    expect(slow).toBeLessThan(lively);
  });

  it('still slows across the sleep gradient at every pace', () => {
    for (const pace of PACES) {
      for (const persona of PERSONAS) {
        const settings: VoiceSettings = { persona: persona.id, pace: pace.id };
        expect(rateFor(settings, 1)).toBeLessThan(rateFor(settings, 0));
      }
    }
  });

  it('a lively story still ends calmer than it began', () => {
    const lively: VoiceSettings = { persona: 'kid', pace: 'lively' };
    expect(rateFor(lively, 1) / rateFor(lively, 0)).toBeCloseTo(0.82, 2);
  });

  it('keeps every combination inside a speakable range', () => {
    for (const pace of PACES) {
      for (const persona of PERSONAS) {
        for (const calm of [0, 0.5, 1]) {
          const rate = rateFor({ persona: persona.id, pace: pace.id }, calm);
          expect(rate).toBeGreaterThanOrEqual(0.5);
          expect(rate).toBeLessThanOrEqual(1.6);
        }
      }
    }
  });

  it('clamps out-of-range rates', () => {
    expect(clampRate(9)).toBe(1.6);
    expect(clampRate(0.01)).toBe(0.5);
  });

  it('ignores calm values outside 0..1', () => {
    const s: VoiceSettings = { persona: 'parent', pace: 'medium' };
    expect(rateFor(s, -5)).toBe(rateFor(s, 0));
    expect(rateFor(s, 5)).toBe(rateFor(s, 1));
  });
});

describe('voice selection', () => {
  it('prefers an offline English voice', () => {
    const chosen = pickVoice(
      [
        voice({ name: 'Cloud Voice', lang: 'en-US', localService: false }),
        voice({ name: 'Local Voice', lang: 'en-GB', localService: true }),
      ],
      'device',
    );
    expect(chosen?.name).toBe('Local Voice');
  });

  it('matches persona hints', () => {
    const chosen = pickVoice(
      [voice({ name: 'Generic' }), voice({ name: 'Daniel Natural' })],
      'parent',
    );
    expect(chosen?.name).toBe('Daniel Natural');
  });

  it('pushes down low-quality compact voices', () => {
    const parent = PERSONAS[0];
    expect(scoreVoice(voice({ name: 'Karen Compact' }), parent)).toBeLessThan(
      scoreVoice(voice({ name: 'Karen Enhanced' }), parent),
    );
  });

  it('returns nothing when the device has no voices', () => {
    expect(pickVoice([], 'parent')).toBeUndefined();
  });
});

describe('speakable text', () => {
  it('strips emphasis markers so they are not read aloud', () => {
    expect(speakableText('it meant *come on, then*.')).toBe('it meant come on, then.');
  });

  it('collapses whitespace', () => {
    expect(speakableText('  a   b  ')).toBe('a b');
  });
});

describe('defaults', () => {
  it('defaults to a warm, slow parent voice', () => {
    expect(DEFAULT_VOICE).toEqual({ persona: 'parent', pace: 'gentle' });
  });
});
