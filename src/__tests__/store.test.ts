import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_PROGRESS,
  FAMILY_SPARKS,
  INITIAL_STATE,
  SEATS,
  STARLIGHT_SPARKS,
  __resetState,
  activeProfile,
  addProfile,
  addSparks,
  checkParentPin,
  completeOnboarding,
  getState,
  markHeard,
  markLetterMet,
  markRhymeRecited,
  nextEpisodeFor,
  progressFor,
  purchase,
  recordSettledNight,
  recordStory,
  removeProfile,
  seatsLeft,
  setParentPin,
  spendSpark,
  totalNightsSettled,
  updateSettings,
} from '../state/store';
import type { ChildProfile } from '../engine/types';

function child(id: string, name: string): ChildProfile {
  return {
    id, name, ageBand: '6-8', pronouns: 'they',
    companionId: 'fox', interests: ['space'], createdAt: 0,
  };
}

const ADA = child('c1', 'Ada');
const KWAME = child('c2', 'Kwame');

beforeEach(() => __resetState({ ...INITIAL_STATE, progress: {}, history: [] }));

describe('onboarding', () => {
  it('is not complete until the parent PIN is set', () => {
    // Flipping `onboarded` when the profile is added unmounts the flow early and
    // leaves the parent zone ungated — which is exactly what happened once.
    purchase('solo');
    addProfile(ADA);
    expect(getState().onboarded).toBe(false);

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

describe('entitlement and seats', () => {
  it('sells a household price, not a per-child one', () => {
    expect(SEATS.solo).toBe(1);
    expect(SEATS.family).toBe(4);
  });

  it('grants the pooled Sparks for the tier bought', () => {
    purchase('solo');
    expect(getState().sparks).toBe(STARLIGHT_SPARKS);
    __resetState({ ...INITIAL_STATE, progress: {}, history: [] });
    purchase('family');
    expect(getState().sparks).toBe(FAMILY_SPARKS);
  });

  it('refuses a profile beyond the purchased seats', () => {
    purchase('solo');
    expect(addProfile(ADA)).toBe(true);
    expect(addProfile(KWAME)).toBe(false);
    expect(getState().profiles).toHaveLength(1);
  });

  it('seats four children on the family tier', () => {
    purchase('family');
    expect(seatsLeft(getState())).toBe(4);
    for (let i = 0; i < 4; i++) expect(addProfile(child(`k${i}`, `Kid ${i}`))).toBe(true);
    expect(seatsLeft(getState())).toBe(0);
    expect(addProfile(child('k5', 'Fifth'))).toBe(false);
  });

  it('adds no profiles at all before a purchase', () => {
    expect(addProfile(ADA)).toBe(false);
  });

  it('spends Sparks from the shared family pool and refuses to go negative', () => {
    addSparks(1);
    expect(spendSpark()).toBe(true);
    expect(spendSpark()).toBe(false);
    expect(getState().sparks).toBe(0);
  });
});

describe('per-child progress', () => {
  beforeEach(() => {
    purchase('family');
    addProfile(ADA);
    addProfile(KWAME);
  });

  it('keeps each child’s progress separate', () => {
    markHeard(ADA.id, 'starfall', 0);
    markHeard(ADA.id, 'starfall', 1);
    markHeard(KWAME.id, 'starfall', 0);

    expect(progressFor(getState(), ADA.id).stories.starfall).toEqual([0, 1]);
    expect(progressFor(getState(), KWAME.id).stories.starfall).toEqual([0]);
  });

  it('serves each child their own next episode', () => {
    markHeard(ADA.id, 'starfall', 0);
    expect(nextEpisodeFor(getState(), ADA.id, 'starfall', 12)).toBe(1);
    expect(nextEpisodeFor(getState(), KWAME.id, 'starfall', 12)).toBe(0);
  });

  it('fills gaps rather than marching past them', () => {
    markHeard(ADA.id, 'starfall', 0);
    markHeard(ADA.id, 'starfall', 2);
    expect(nextEpisodeFor(getState(), ADA.id, 'starfall', 12)).toBe(1);
  });

  it('wraps once every episode is heard', () => {
    for (let i = 0; i < 3; i++) markHeard(ADA.id, 'mossgrove', i);
    expect(nextEpisodeFor(getState(), ADA.id, 'mossgrove', 3)).toBe(0);
  });

  it('ignores a repeated episode', () => {
    markHeard(ADA.id, 'starfall', 0);
    markHeard(ADA.id, 'starfall', 0);
    expect(progressFor(getState(), ADA.id).stories.starfall).toEqual([0]);
  });

  it('tracks rhymes and letters per child', () => {
    markRhymeRecited(ADA.id, 'lumis-lanterns');
    markRhymeRecited(ADA.id, 'lumis-lanterns');
    markLetterMet(ADA.id, 's');
    expect(progressFor(getState(), ADA.id).rhymes).toEqual(['lumis-lanterns']);
    expect(progressFor(getState(), ADA.id).letters).toEqual(['s']);
    expect(progressFor(getState(), KWAME.id).rhymes).toEqual([]);
  });

  it('counts settled nights per child and in total', () => {
    recordSettledNight(ADA.id);
    recordSettledNight(ADA.id);
    recordSettledNight(KWAME.id);
    expect(progressFor(getState(), ADA.id).nightsSettled).toBe(2);
    expect(totalNightsSettled(getState())).toBe(3);
  });

  it('returns empty progress for an unknown child', () => {
    expect(progressFor(getState(), 'nobody')).toEqual(EMPTY_PROGRESS);
    expect(progressFor(getState(), null)).toEqual(EMPTY_PROGRESS);
  });

  it('removes a child and their progress, and reassigns the active profile', () => {
    markHeard(ADA.id, 'starfall', 0);
    removeProfile(ADA.id);
    expect(getState().profiles.map((p) => p.id)).toEqual([KWAME.id]);
    expect(getState().progress[ADA.id]).toBeUndefined();
    expect(getState().activeProfileId).toBe(KWAME.id);
  });

  it('caps stored history across the household', () => {
    for (let i = 0; i < 80; i++) {
      recordStory({ id: `s${i}`, title: `Story ${i}`, worldId: 'starfall', profileId: ADA.id });
    }
    expect(getState().history).toHaveLength(60);
    expect(getState().history[0].title).toBe('Story 79');
  });
});

describe('profiles and settings', () => {
  it('activates the profile it adds', () => {
    purchase('family');
    addProfile(ADA);
    expect(activeProfile(getState())?.name).toBe('Ada');
  });

  it('keeps voice settings alongside the other bedtime settings', () => {
    updateSettings({ voicePersona: 'kid', voicePace: 'lively' });
    expect(getState().settings.voicePersona).toBe('kid');
    expect(getState().settings.voicePace).toBe('lively');
    expect(getState().settings.narration).toBe(true);
  });
});
