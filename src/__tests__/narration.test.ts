import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  platformEngine,
  type VoiceSettings,
} from '../engine/narration';
import {
  __clearEngines,
  availableEngines,
  listEngines,
  registerEngine,
  resolveEngine,
  type TtsEngine,
} from '../engine/ttsEngine';

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

describe('pluggable speech back end', () => {
  beforeEach(() => __clearEngines());
  afterEach(() => {
    __clearEngines();
    registerEngine(platformEngine);
  });

  function engine(over: Partial<TtsEngine> & { id: string }): TtsEngine {
    return {
      label: over.id, local: true, bytes: 0, isAvailable: () => true,
      speak: () => {}, stop: () => {},
      ...over,
    } as TtsEngine;
  }

  it('refuses a back end that is not on-device', () => {
    // D11: cloud speech reintroduces a per-night recurring cost behind a
    // one-time price. The type says `local: true`; this stops it at runtime too.
    expect(() =>
      registerEngine(engine({ id: 'cloud', local: false as unknown as true })),
    ).toThrow(/not local/i);
    expect(listEngines()).toHaveLength(0);
  });

  it('registers and lists local engines', () => {
    registerEngine(engine({ id: 'a' }));
    registerEngine(engine({ id: 'b' }));
    expect(listEngines().map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('hides an engine whose voice has not downloaded yet', () => {
    registerEngine(engine({ id: 'ready' }));
    registerEngine(engine({ id: 'pending', isAvailable: () => false }));
    expect(availableEngines().map((e) => e.id)).toEqual(['ready']);
  });

  it('prefers the requested engine when it is ready', () => {
    registerEngine(engine({ id: 'platform' }));
    registerEngine(engine({ id: 'lumi' }));
    expect(resolveEngine('lumi')?.id).toBe('lumi');
  });

  it('falls back rather than leaving a child in silence', () => {
    registerEngine(engine({ id: 'platform' }));
    registerEngine(engine({ id: 'lumi', isAvailable: () => false }));
    expect(resolveEngine('lumi')?.id).toBe('platform');
    expect(resolveEngine('nonexistent')?.id).toBe('platform');
  });

  it('returns nothing when no engine can speak', () => {
    registerEngine(engine({ id: 'only', isAvailable: () => false }));
    expect(resolveEngine()).toBeUndefined();
  });

  it('ships the platform engine by default, at zero bytes', () => {
    registerEngine(platformEngine);
    expect(platformEngine.local).toBe(true);
    expect(platformEngine.bytes).toBe(0);
  });
});
