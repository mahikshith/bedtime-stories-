import { useSyncExternalStore } from 'react';
import type { ChildProfile } from '../engine/types';
import { hashString } from '../engine/rng';
import { DEFAULT_VOICE, type Pace, type VoicePersona } from '../engine/narration';

/**
 * All state lives on the device. There is no account, no server and no network
 * call in the core loop, which is what makes the privacy posture structural
 * rather than a policy document: there is nothing to breach and nothing to retain.
 */

export type Screen = 'map' | 'story' | 'parent';

export interface Settings {
  narration: boolean;
  /** How the story is read aloud. */
  voicePersona: VoicePersona;
  voicePace: Pace;
  /** Dim the screen as the story winds down. */
  dimming: boolean;
  /** Default to two-minute stories. */
  twoMinute: boolean;
}

/** Per-child, because a family buys one app for several children. */
export interface ChildProgress {
  /** worldId -> episode indices already heard. */
  stories: Record<string, number[]>;
  /** rhyme ids recited. */
  rhymes: string[];
  /** Letters whose sound the child has met. */
  letters: string[];
  /** The only metric that matters, tracked per child. */
  nightsSettled: number;
}

export const EMPTY_PROGRESS: ChildProgress = {
  stories: {},
  rhymes: [],
  letters: [],
  nightsSettled: 0,
};

export type Entitlement = 'none' | 'solo' | 'family';

/**
 * Multi-child is a feature of the purchase, not a multiplier on it. The market
 * has settled on household-flat pricing and parents resent per-child billing.
 */
export const SEATS: Record<Entitlement, number> = { none: 0, solo: 1, family: 4 };

export interface AppState {
  onboarded: boolean;
  entitlement: Entitlement;
  profiles: ChildProfile[];
  activeProfileId: string | null;
  progress: Record<string, ChildProgress>;
  sparks: number;
  /** Local parental gate. Not security — it keeps a seven-year-old out, which is its job. */
  parentPinHash: number | null;
  settings: Settings;
  history: { id: string; title: string; worldId: string; profileId: string; at: number }[];
}

const STORAGE_KEY = 'lumi.state.v2';

export const INITIAL_STATE: AppState = {
  onboarded: false,
  entitlement: 'none',
  profiles: [],
  activeProfileId: null,
  progress: {},
  sparks: 0,
  parentPinHash: null,
  settings: {
    narration: true,
    voicePersona: DEFAULT_VOICE.persona,
    voicePace: DEFAULT_VOICE.pace,
    dimming: true,
    twoMinute: false,
  },
  history: [],
};

/** Sparks included with a one-time purchase. Pooled across the whole family. */
export const STARLIGHT_SPARKS = 30;
export const FAMILY_SPARKS = 60;
export const STARLIGHT_PRICE = '$6.99';
export const FAMILY_PRICE = '$12.99';

function load(): AppState {
  if (typeof localStorage === 'undefined') return INITIAL_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...INITIAL_STATE,
      ...parsed,
      settings: { ...INITIAL_STATE.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return INITIAL_STATE;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Storage full or blocked (private window). The app still works this session. */
  }
}

export function setState(update: (prev: AppState) => AppState): void {
  state = update(state);
  persist();
  emit();
}

export function getState(): AppState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, () => INITIAL_STATE);
}

/* ---------- actions ---------- */

export function purchase(tier: 'solo' | 'family'): void {
  setState((s) => ({
    ...s,
    entitlement: tier,
    sparks: s.sparks + (tier === 'family' ? FAMILY_SPARKS : STARLIGHT_SPARKS),
  }));
}

export function seatsLeft(s: AppState): number {
  return Math.max(0, SEATS[s.entitlement] - s.profiles.length);
}

/** Refuses to exceed the purchased seat count. */
export function addProfile(profile: ChildProfile): boolean {
  if (seatsLeft(state) <= 0) return false;
  setState((s) => ({
    ...s,
    profiles: [...s.profiles, profile],
    activeProfileId: profile.id,
    progress: { ...s.progress, [profile.id]: { ...EMPTY_PROGRESS } },
  }));
  return true;
}

export function removeProfile(id: string): void {
  setState((s) => {
    const progress = { ...s.progress };
    delete progress[id];
    const profiles = s.profiles.filter((p) => p.id !== id);
    return {
      ...s,
      profiles,
      progress,
      activeProfileId: s.activeProfileId === id ? (profiles[0]?.id ?? null) : s.activeProfileId,
    };
  });
}

export function progressFor(s: AppState, profileId: string | null): ChildProgress {
  if (!profileId) return EMPTY_PROGRESS;
  return s.progress[profileId] ?? EMPTY_PROGRESS;
}

function patchProgress(profileId: string, patch: (p: ChildProgress) => ChildProgress): void {
  setState((s) => ({
    ...s,
    progress: {
      ...s.progress,
      [profileId]: patch(s.progress[profileId] ?? { ...EMPTY_PROGRESS }),
    },
  }));
}

/**
 * Onboarding is only complete once the parent PIN is set. Flipping `onboarded`
 * any earlier unmounts the flow mid-way and leaves the parent zone ungated.
 */
export function completeOnboarding(): void {
  setState((s) => ({ ...s, onboarded: true }));
}

export function updateProfile(id: string, patch: Partial<ChildProfile>): void {
  setState((s) => ({
    ...s,
    profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  }));
}

export function setActiveProfile(id: string): void {
  setState((s) => ({ ...s, activeProfileId: id }));
}

export function activeProfile(s: AppState): ChildProfile | null {
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0] ?? null;
}

export function markHeard(profileId: string, worldId: string, episode: number): void {
  patchProgress(profileId, (p) => {
    const heard = p.stories[worldId] ?? [];
    if (heard.includes(episode)) return p;
    return { ...p, stories: { ...p.stories, [worldId]: [...heard, episode] } };
  });
}

export function markRhymeRecited(profileId: string, rhymeId: string): void {
  patchProgress(profileId, (p) =>
    p.rhymes.includes(rhymeId) ? p : { ...p, rhymes: [...p.rhymes, rhymeId] },
  );
}

export function markLetterMet(profileId: string, letter: string): void {
  patchProgress(profileId, (p) =>
    p.letters.includes(letter) ? p : { ...p, letters: [...p.letters, letter] },
  );
}

export function recordStory(entry: {
  id: string;
  title: string;
  worldId: string;
  profileId: string;
}): void {
  setState((s) => ({
    ...s,
    history: [{ ...entry, at: Date.now() }, ...s.history].slice(0, 60),
  }));
}

/** The only metric that matters: the child settled and the session ended. */
export function recordSettledNight(profileId: string): void {
  patchProgress(profileId, (p) => ({ ...p, nightsSettled: p.nightsSettled + 1 }));
}

export function totalNightsSettled(s: AppState): number {
  return Object.values(s.progress).reduce((n, p) => n + p.nightsSettled, 0);
}

export function spendSpark(): boolean {
  if (state.sparks <= 0) return false;
  setState((s) => ({ ...s, sparks: s.sparks - 1 }));
  return true;
}

export function addSparks(n: number): void {
  setState((s) => ({ ...s, sparks: s.sparks + n }));
}

export function updateSettings(patch: Partial<Settings>): void {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function setParentPin(pin: string): void {
  setState((s) => ({ ...s, parentPinHash: hashString(`lumi:${pin}`) }));
}

export function checkParentPin(pin: string): boolean {
  return state.parentPinHash === hashString(`lumi:${pin}`);
}

export function nextEpisodeFor(
  s: AppState,
  profileId: string | null,
  worldId: string,
  episodeCount: number,
): number {
  const heard = progressFor(s, profileId).stories[worldId] ?? [];
  for (let i = 0; i < episodeCount; i++) if (!heard.includes(i)) return i;
  return 0;
}

/** Test hook. */
export function __resetState(next: AppState = INITIAL_STATE): void {
  state = next;
  persist();
  emit();
}
