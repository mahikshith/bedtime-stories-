import { beforeEach, describe, expect, it } from 'vitest';
import {
  INITIAL_STATE,
  STARLIGHT_SPARKS,
  __resetState,
  activeProfile,
  addProfile,
  addSparks,
  checkParentPin,
  completeOnboarding,
  getState,
  markHeard,
  nextEpisodeFor,
  purchaseStarlight,
  recordSettledNight,
  recordStory,
  setParentPin,
  spendSpark,
  updateSettings,
} from '../state/store';
import type { ChildProfile } from '../engine/types';

const PROFILE: ChildProfile = {
  id: 'c1',
  name: 'Ada',
  ageBand: '6-8',
  pronouns: 'she',
  companionId: 'fox',
  interests: ['space'],
  createdAt: 0,
};

beforeEach(() => __resetState({ ...INITIAL_STATE, progress: {}, history: [] }));

describe('onboarding', () => {
  it('is not complete until the parent PIN is set', () => {
    // Flipping `onboarded` when the profile is added unmounts the flow early and
    // leaves the parent zone ungated — which is exactly what happened once.
    addProfile(PROFILE);
    expect(getState().onboarded).toBe(false);
    expect(getState().parentPinHash).toBeNull();

    setParentPin('1234');
    completeOnboarding();
    expect(getState().onboarded).toBe(true);
    expect(getState().parentPinHash).not.toBeNull();
  });

  it('gates the parent zone on the right PIN', () => {
    setParentPin('4821');
    expect(checkParentPin('4821')).toBe(true);
    expect(checkParentPin('0000')).toBe(false);
  });

  it('never stores the PIN in the clear', () => {
    setParentPin('1234');
    expect(JSON.stringify(getState())).not.toContain('1234');
  });
});

describe('entitlement', () => {
  it('grants the library and the included Sparks on purchase', () => {
    expect(getState().entitlement).toBe('none');
    purchaseStarlight();
    expect(getState().entitlement).toBe('starlight');
    expect(getState().sparks).toBe(STARLIGHT_SPARKS);
  });

  it('spends Sparks and refuses to go negative', () => {
    addSparks(1);
    expect(spendSpark()).toBe(true);
    expect(getState().sparks).toBe(0);
    expect(spendSpark()).toBe(false);
    expect(getState().sparks).toBe(0);
  });
});

describe('progress', () => {
  it('serves the next unheard episode', () => {
    expect(nextEpisodeFor(getState(), 'starfall', 12)).toBe(0);
    markHeard('starfall', 0);
    markHeard('starfall', 1);
    expect(nextEpisodeFor(getState(), 'starfall', 12)).toBe(2);
  });

  it('fills gaps rather than marching past them', () => {
    markHeard('starfall', 0);
    markHeard('starfall', 2);
    expect(nextEpisodeFor(getState(), 'starfall', 12)).toBe(1);
  });

  it('wraps once every episode is heard', () => {
    for (let i = 0; i < 3; i++) markHeard('mossgrove', i);
    expect(nextEpisodeFor(getState(), 'mossgrove', 3)).toBe(0);
  });

  it('ignores a repeated episode', () => {
    markHeard('starfall', 0);
    markHeard('starfall', 0);
    expect(getState().progress.starfall).toEqual([0]);
  });

  it('counts settled nights, not sessions', () => {
    recordSettledNight();
    recordSettledNight();
    expect(getState().nightsSettled).toBe(2);
  });

  it('caps stored history', () => {
    for (let i = 0; i < 80; i++) {
      recordStory({ id: `s${i}`, title: `Story ${i}`, worldId: 'starfall' });
    }
    expect(getState().history.length).toBe(60);
    expect(getState().history[0].title).toBe('Story 79');
  });
});

describe('profiles and settings', () => {
  it('activates the profile it adds', () => {
    addProfile(PROFILE);
    expect(activeProfile(getState())?.name).toBe('Ada');
  });

  it('keeps voice settings alongside the other bedtime settings', () => {
    updateSettings({ voicePersona: 'kid', voicePace: 'lively' });
    expect(getState().settings.voicePersona).toBe('kid');
    expect(getState().settings.voicePace).toBe('lively');
    expect(getState().settings.narration).toBe(true);
  });
});
