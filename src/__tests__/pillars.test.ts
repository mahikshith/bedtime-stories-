import { describe, expect, it } from 'vitest';
import {
  ALL_LETTERS,
  PHONICS_SETS,
  decodableThrough,
  lettersNeeded,
} from '../content/phonics';
import { CRAYONS, SCENES, sceneForWorld } from '../content/colouring';
import { WORLDS } from '../content/worlds';

describe('phonics sequence', () => {
  it('teaches sounds, never letter names', () => {
    const LETTER_NAMES: Record<string, string> = {
      a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'ef', g: 'gee', h: 'aitch',
      i: 'eye', j: 'jay', k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee',
      r: 'ar', s: 'ess', t: 'tee', u: 'you',
    };
    for (const l of ALL_LETTERS) {
      expect(l.sound.toLowerCase(), l.letter).not.toBe(LETTER_NAMES[l.letter]);
      expect(l.say.toLowerCase(), `${l.letter} spoken`).not.toBe(LETTER_NAMES[l.letter]);
      // A synthesiser handed a bare consonant says the letter name, so plosives
      // must carry a distinct spoken form.
      if (!'aeiou'.includes(l.letter) && l.sound.length === 1) {
        expect(l.say.length, `${l.letter} needs a sayable form`).toBeGreaterThan(1);
      }
      expect(l.cue[0].toLowerCase(), `${l.letter} cue`).toBe(l.letter.toLowerCase());
    }
  });

  it('starts with s, a, t, p so a word can be built immediately', () => {
    expect(PHONICS_SETS[0].letters.map((l) => l.letter)).toEqual(['s', 'a', 't', 'p']);
    expect(PHONICS_SETS[0].words).toContain('sat');
  });

  it('orders short vowels a, i, o, e, u to keep /i/ and /e/ apart', () => {
    const vowelOrder = ALL_LETTERS
      .map((l) => l.letter)
      .filter((l) => 'aeiou'.includes(l));
    expect(vowelOrder).toEqual(['a', 'i', 'o', 'e', 'u']);
  });

  it('never introduces the same letter twice', () => {
    const letters = ALL_LETTERS.map((l) => l.letter);
    expect(new Set(letters).size).toBe(letters.length);
  });

  it('only offers words the child can actually decode by that set', () => {
    // The payoff of a systematic sequence is that every word shown is readable
    // with the letters already met. A word needing an unmet letter breaks that.
    for (const set of PHONICS_SETS) {
      const known = new Set(
        PHONICS_SETS.filter((s) => s.id <= set.id).flatMap((s) => s.letters.map((l) => l.letter)),
      );
      for (const word of set.words) {
        for (const letter of lettersNeeded(word)) {
          expect(known.has(letter), `set ${set.id}: "${word}" needs "${letter}"`).toBe(true);
        }
      }
    }
  });

  it('accumulates decodable words as sets are met', () => {
    expect(decodableThrough(1).length).toBeLessThan(decodableThrough(3).length);
    expect(decodableThrough(1)).toContain('sat');
    expect(decodableThrough(5)).toContain('jet');
  });

  it('extracts the letters a word needs', () => {
    expect(lettersNeeded('Pat sat.').sort()).toEqual(['a', 'p', 's', 't']);
  });
});

describe('colouring scenes', () => {
  it('gives every world a scene', () => {
    for (const world of WORLDS) {
      const scene = sceneForWorld(world.id);
      expect(scene, world.id).toBeDefined();
      expect(scene.regions.length).toBeGreaterThan(4);
    }
  });

  it('falls back cleanly for an unknown world', () => {
    expect(sceneForWorld(undefined)).toBe(SCENES[0]);
    expect(sceneForWorld('nowhere')).toBe(SCENES[0]);
  });

  it('uses closed paths so an on-screen fill cannot leak', () => {
    for (const scene of SCENES) {
      for (const region of scene.regions) {
        expect(region.d.trim(), `${scene.id}/${region.id}`).toMatch(/[Zz]$/);
      }
    }
  });

  it('gives every region a unique id within its scene', () => {
    for (const scene of SCENES) {
      const ids = scene.regions.map((r) => r.id);
      expect(new Set(ids).size, scene.id).toBe(ids.length);
    }
  });

  it('offers a full crayon box with valid colours', () => {
    expect(CRAYONS.length).toBeGreaterThanOrEqual(8);
    CRAYONS.forEach((c) => expect(c.value).toMatch(/^#[0-9a-f]{6}$/i));
  });
});
