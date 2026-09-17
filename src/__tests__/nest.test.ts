import { describe, expect, it } from 'vitest';
import { HATS, NEST_ITEMS, nestItem, nextUnlock, unlockedFor } from '../content/nest';

describe('the nest catalogue', () => {
  it('has unique ids', () => {
    expect(new Set(NEST_ITEMS.map((i) => i.id)).size).toBe(NEST_ITEMS.length);
  });

  it('puts something within reach of the first game', () => {
    // An empty shelf teaches a child that the shelf is empty.
    expect(Math.min(...NEST_ITEMS.map((i) => i.stars))).toBeLessThanOrEqual(3);
  });

  it('never asks for a threshold a child cannot cross in a few sessions', () => {
    expect(Math.max(...NEST_ITEMS.map((i) => i.stars))).toBeLessThanOrEqual(50);
  });

  it('offers a hat, a prop and a sound before the halfway mark', () => {
    // Three kinds of reward keep the shelf from feeling like one long list.
    const early = unlockedFor(25).map((i) => i.kind);
    expect(new Set(early)).toEqual(new Set(['hats', 'props', 'sounds']));
  });
});

describe('unlocking', () => {
  it('gives nothing away at zero', () => {
    expect(unlockedFor(0)).toEqual([]);
  });

  it('only ever grows as stars accumulate', () => {
    // Stars never decrease, so neither can this. A child cannot lose a hat.
    let previous = 0;
    for (let stars = 0; stars <= 60; stars++) {
      const count = unlockedFor(stars).length;
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });

  it('releases everything eventually', () => {
    expect(unlockedFor(999).length).toBe(NEST_ITEMS.length);
  });
});

describe('what comes next', () => {
  it('names the nearest thing still out of reach', () => {
    expect(nextUnlock(0)?.id).toBe('acorn-cap');
    expect(nextUnlock(3)?.id).toBe('nightcap');
  });

  it('is undefined once the shelf is full, rather than inventing a goal', () => {
    expect(nextUnlock(999)).toBeUndefined();
  });
});

describe('hats', () => {
  it('every hat resolves and has a drawing to go with it', () => {
    for (const hat of HATS) {
      expect(nestItem(hat.id)).toBeDefined();
      expect(hat.emoji.length).toBeGreaterThan(0);
    }
  });
});
