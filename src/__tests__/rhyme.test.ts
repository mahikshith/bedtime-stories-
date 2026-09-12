import { describe, expect, it } from 'vitest';
import { RHYMES, getRhyme } from '../content/rhymes';
import {
  bareWord,
  buildRhymeIndex,
  buildRhymeQuestion,
  clozeFor,
  countSyllables,
  endWord,
  estimateTimings,
  personalizeRhyme,
  rhymeKey,
  tokenize,
  totalDuration,
  validateRhyme,
  wordsRhyme,
} from '../engine/rhyme';
import { checkStoryText } from '../engine/safety';
import type { SubstitutionContext } from '../engine/personalize';

const CTX: SubstitutionContext = {
  child: 'Ada', pronouns: 'she', companion: 'Sorrel', companionSpecies: 'fox',
  trait: 'who always knew the way back', world: 'Mossgrove', place: 'p', place2: 'p2',
  guide: 'g', wonder: 'w', wonder2: 'w2', obstacle: 'o', gentle: 'gt',
  sound: 's', sound2: 's2', treasure: 't', interest: 'space',
};

describe('the corpus', () => {
  it('ships original rhymes as well as traditional ones', () => {
    const original = RHYMES.filter((r) => r.kind === 'original');
    const traditional = RHYMES.filter((r) => r.kind === 'traditional');
    expect(original.length).toBeGreaterThanOrEqual(10);
    expect(traditional.length).toBeGreaterThanOrEqual(10);
  });

  it('records provenance for every rhyme', () => {
    for (const r of RHYMES) {
      expect(r.provenance.length, r.id).toBeGreaterThan(10);
      if (r.kind === 'traditional') {
        // Only pre-1928 lyrics are safe to use; anything later needs a licence.
        expect(r.provenance, r.id).toMatch(/public domain/i);
        const year = r.provenance.match(/\b(1[6-9]\d{2})\b/);
        if (year) expect(Number(year[1]), `${r.id} year`).toBeLessThan(1928);
      } else {
        expect(r.provenance, r.id).toMatch(/original/i);
      }
    }
  });

  it('gives every rhyme a unique id', () => {
    expect(new Set(RHYMES.map((r) => r.id)).size).toBe(RHYMES.length);
  });

  it('holds together: cloze words are final, and rhyming lines really rhyme', () => {
    const problems = RHYMES.flatMap(validateRhyme);
    expect(problems.map((p) => `${p.rhymeId}: ${p.problem}`)).toEqual([]);
  });

  it('uses the participation devices that make a rhyme recitable', () => {
    for (const r of RHYMES) {
      expect(r.devices.length, r.id).toBeGreaterThan(0);
      // Every rhyme needs at least one dropped word for the child to supply.
      expect(r.lines.some((l) => l.cloze), `${r.id} has no cloze line`).toBe(true);
    }
  });

  it('favours trochaic metre, which children grasp earliest', () => {
    const trochaic = RHYMES.filter((r) => r.meter === 'trochaic').length;
    expect(trochaic / RHYMES.length).toBeGreaterThan(0.6);
  });

  it('keeps rhymes short enough for the youngest band', () => {
    for (const r of RHYMES) {
      if (r.ageBands.includes('3-5')) {
        expect(r.lines.length, `${r.id} is too long for 3-5`).toBeLessThanOrEqual(8);
      }
    }
  });

  it('passes the same safety filter as stories', () => {
    for (const r of RHYMES) {
      const text = r.lines.map((l) => l.text).join(' ');
      const verdict = checkStoryText(text.replace(/\{\w+\}/g, 'Ada'));
      expect(verdict.violations, r.id).toEqual([]);
    }
  });

  it('declares rhyme groups big enough to build a game from', () => {
    for (const r of RHYMES) {
      expect(r.rhymeGroups.length, r.id).toBeGreaterThan(0);
      for (const g of r.rhymeGroups) expect(g.length, `${r.id}: ${g}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('only uses personalization slots the substituter knows', () => {
    const allowed = new Set(['child', 'companion']);
    for (const r of RHYMES) {
      for (const line of r.lines) {
        for (const [, token] of line.text.matchAll(/\{(\w+)\}/g)) {
          expect(allowed.has(token), `${r.id}: {${token}}`).toBe(true);
        }
      }
    }
  });
});

describe('syllables and tokens', () => {
  it('counts syllables well enough to pace a line', () => {
    expect(countSyllables('star')).toBe(1);
    expect(countSyllables('little')).toBe(2);
    expect(countSyllables('twinkle')).toBe(2);
    expect(countSyllables('diamond')).toBe(2);
    expect(countSyllables('make')).toBe(1);
    expect(countSyllables('everybody')).toBeGreaterThanOrEqual(4);
  });

  it('tokenizes with character offsets for boundary matching', () => {
    const tokens = tokenize('Twinkle, twinkle, little star,');
    expect(tokens).toHaveLength(4);
    expect(tokens[0].text).toBe('Twinkle,');
    expect(tokens[3].start).toBe('Twinkle, twinkle, little '.length);
  });

  it('strips punctuation to find the rhyming word', () => {
    expect(endWord('How I wonder what you are.')).toBe('are');
    expect(endWord('Then a jellyfish came too —')).toBe('too');
    expect(bareWord('king’s')).toBe('kings');
  });
});

describe('karaoke timing', () => {
  it('advances monotonically through the line', () => {
    const timings = estimateTimings('Twinkle, twinkle, little star,');
    expect(timings[0]).toBe(0);
    for (let i = 1; i < timings.length; i++) expect(timings[i]).toBeGreaterThan(timings[i - 1]);
  });

  it('gives longer words more time', () => {
    const [, second] = estimateTimings('a everybody');
    expect(second).toBeLessThan(estimateTimings('everybody a')[1]);
  });

  it('runs faster at a higher speech rate', () => {
    const line = 'Hickory dickory dock,';
    expect(totalDuration(line, 1.4)).toBeLessThan(totalDuration(line, 0.7));
  });

  it('handles an empty line without dividing by zero', () => {
    expect(totalDuration('')).toBe(0);
    expect(estimateTimings('')).toEqual([]);
  });
});

describe('rhyme detection', () => {
  it('uses the declared groups when the corpus knows both words', () => {
    const index = buildRhymeIndex(RHYMES);
    // Orthography says otherwise; the corpus says these rhyme, and it is right.
    expect(wordsRhyme('said', 'bed', index)).toBe(true);
    expect(wordsRhyme('goes', 'knows', index)).toBe(true);
    expect(wordsRhyme('six', 'candlesticks', index)).toBe(true);
    expect(wordsRhyme('soup', 'bed', index)).toBe(false);
  });

  it('falls back to spelling for words the corpus has not seen', () => {
    expect(wordsRhyme('star', 'are')).toBe(true);
    expect(wordsRhyme('snow', 'go')).toBe(true);
    expect(wordsRhyme('high', 'sky')).toBe(true);
    expect(wordsRhyme('bright', 'night')).toBe(true);
  });

  it('rejects words that do not', () => {
    expect(wordsRhyme('star', 'moon')).toBe(false);
    expect(wordsRhyme('soup', 'bed')).toBe(false);
  });

  it('is case and punctuation insensitive', () => {
    expect(rhymeKey('Star,')).toBe(rhymeKey('star'));
  });
});

describe('the cloze mechanic', () => {
  it('drops the final word and keeps the run-up', () => {
    const line = { text: 'How I wonder what you are.', cloze: 'are' };
    expect(clozeFor(line)).toEqual({ prefix: 'How I wonder what you', answer: 'are' });
  });

  it('returns nothing for a line with no dropped word', () => {
    expect(clozeFor({ text: 'Up above the world so high,' })).toBeNull();
  });
});

describe('the rhyme game', () => {
  // The declared groups are the authority on what rhymes, so assert against them.
  const index = buildRhymeIndex(RHYMES);

  it('builds a question with exactly one correct answer', () => {
    for (const rhyme of RHYMES) {
      const q = buildRhymeQuestion(rhyme, RHYMES, 99);
      expect(q, rhyme.id).not.toBeNull();
      if (!q) continue;
      expect(q.options).toHaveLength(3);
      expect(q.options).toContain(q.answer);
      expect(wordsRhyme(q.target, q.answer, index), `${rhyme.id}: ${q.target}/${q.answer}`).toBe(true);
      const rhyming = q.options.filter((o) => wordsRhyme(o, q.target, index));
      expect(rhyming, `${rhyme.id}: ${q.target} -> ${q.options.join(', ')}`).toEqual([q.answer]);
    }
  });

  it('is deterministic for a seed', () => {
    const a = buildRhymeQuestion(getRhyme('lumis-lanterns'), RHYMES, 7);
    const b = buildRhymeQuestion(getRhyme('lumis-lanterns'), RHYMES, 7);
    expect(a).toEqual(b);
  });

  it('varies across seeds', () => {
    const seen = new Set(
      Array.from({ length: 12 }, (_, i) =>
        JSON.stringify(buildRhymeQuestion(getRhyme('five-rockets'), RHYMES, i)),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('personalization', () => {
  it('puts the child and companion into the rhyme, on-device', () => {
    const rhyme = personalizeRhyme(getRhyme('goodnight-everyone'), CTX);
    const text = rhyme.lines.map((l) => l.text).join(' ');
    expect(text).toContain('Ada');
    expect(text).toContain('Sorrel');
    expect(text).not.toMatch(/\{|\}/);
  });

  it('leaves cloze answers intact so the game still works', () => {
    const rhyme = personalizeRhyme(getRhyme('companion-knows'), CTX);
    expect(validateRhyme(rhyme)).toEqual([]);
  });
});
