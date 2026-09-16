import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_PLAY,
  INITIAL_STATE,
  __resetState,
  clearLevel,
  countPlayDay,
  earnNestItem,
  gameLevel,
  getState,
  isLapsed,
  isLifetime,
  playState,
  wearHat,
  type AppState,
} from '../state/store';

beforeEach(() => __resetState({ ...INITIAL_STATE, progress: {}, history: [] }));

describe('entitlement', () => {
  it('knows which tiers never lapse', () => {
    expect(isLifetime('solo')).toBe(true);
    expect(isLifetime('family')).toBe(true);
    expect(isLifetime('monthly')).toBe(false);
    expect(isLifetime('annual')).toBe(false);
  });

  it('a lifetime purchase never lapses, whatever the clock says', () => {
    const s = { ...getState(), entitlement: 'family' as const } as AppState;
    expect(isLapsed(s, Date.now() + 10 ** 12)).toBe(false);
  });

  it('a recurring tier with no expiry fails closed', () => {
    // A missing receipt is not the same as a valid one. Failing open here would
    // make a free subscription out of a storage wipe.
    const s = { ...getState(), entitlement: 'monthly' as const } as AppState;
    expect(isLapsed(s)).toBe(true);
  });

  it('a recurring tier is live until its expiry passes', () => {
    const s = {
      ...getState(),
      entitlement: 'monthly' as const,
      entitlementExpires: 2_000,
    } as AppState;
    expect(isLapsed(s, 1_000)).toBe(false);
    expect(isLapsed(s, 2_001)).toBe(true);
  });
});

describe('play state', () => {
  it('reads as a full object on an install that predates it', () => {
    // Additive state must never require a storage-key bump.
    const legacy = { ...getState(), play: undefined } as unknown as AppState;
    expect(playState(legacy)).toEqual(EMPTY_PLAY);
  });

  it('fills in a nest added after the field shipped', () => {
    const partial = { ...getState(), play: { levels: {}, stars: 3 } } as unknown as AppState;
    expect(playState(partial).nest.hats).toEqual([]);
    expect(playState(partial).stars).toBe(3);
  });
});

describe('levels', () => {
  it('starts every game at one', () => {
    expect(gameLevel('bubble-pop')).toBe(1);
  });

  it('advances on a clear and banks stars', () => {
    clearLevel('bubble-pop', 1, 2);
    expect(gameLevel('bubble-pop')).toBe(2);
    expect(playState().stars).toBe(2);
  });

  it('never regresses after a bad run', () => {
    // A mastery ladder, not a punishment: a child who struggles tonight keeps
    // what they reached last week.
    clearLevel('bubble-pop', 3);
    clearLevel('bubble-pop', 1);
    expect(gameLevel('bubble-pop')).toBe(4);
  });

  it('caps at five', () => {
    clearLevel('bubble-pop', 9);
    expect(gameLevel('bubble-pop')).toBe(5);
  });

  it('never subtracts stars', () => {
    clearLevel('a', 1, 5);
    clearLevel('b', 1, -99);
    expect(playState().stars).toBe(5);
  });
});

describe('streak', () => {
  it('counts one per calendar day, not per play', () => {
    countPlayDay('2026-09-16');
    countPlayDay('2026-09-16');
    expect(playState().streak).toBe(1);
  });

  it('extends on consecutive days', () => {
    countPlayDay('2026-09-16');
    countPlayDay('2026-09-17');
    countPlayDay('2026-09-18');
    expect(playState().streak).toBe(3);
  });

  it('a gap restarts at one, not zero', () => {
    // The day you come back is itself day one. Zero would be a scolding.
    countPlayDay('2026-09-16');
    countPlayDay('2026-09-20');
    expect(playState().streak).toBe(1);
  });
});

describe('the nest', () => {
  it('keeps items and never duplicates them', () => {
    earnNestItem('hats', 'acorn-cap');
    earnNestItem('hats', 'acorn-cap');
    expect(playState().nest.hats).toEqual(['acorn-cap']);
  });

  it('wears and removes a hat', () => {
    earnNestItem('hats', 'nightcap');
    wearHat('nightcap');
    expect(playState().nest.wearing).toBe('nightcap');
    wearHat(null);
    expect(playState().nest.wearing).toBeNull();
  });
});
