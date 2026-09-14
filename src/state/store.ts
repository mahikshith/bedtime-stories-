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
  /** Colouring pages sent to a printer, so a parent can reprint one. */
  printed: { sceneId: string; at: number }[];
  /** Game ids played at least once. */
  games: string[];
}

export const EMPTY_PROGRESS: ChildProgress = {
  stories: {},
  rhymes: [],
  letters: [],
  nightsSettled: 0,
  printed: [],
  games: [],
};

export type Entitlement = 'none' | 'trial' | 'solo' | 'family';

/**
 * Nights in the free trial.
 *
 * Seven, not two or three, and the reason is in the data: trials of four days
 * or fewer convert at 25.5% while 17-32 day trials convert at 42.5%. A bedtime
 * app is used once a night, so "a couple of sessions" is a two-day trial — the
 * worst-converting shape there is.
 *
 * Seven nights is also the shortest window in which the thing being sold can
 * actually appear. What a parent buys is a ritual, and a ritual is not visible
 * on night two. A week crosses a weekend and survives one bad night.
 */
export const TRIAL_SESSIONS = 7;

/**
 * Multi-child is a feature of the purchase, not a multiplier on it. The market
 * has settled on household-flat pricing and parents resent per-child billing.
 */
export const SEATS: Record<Entitlement, number> = {
  none: 0,
  // The trial is the whole app for one child, not a crippled version of it.
  trial: 1,
  solo: 1,
  family: 4,
};

export interface AppState {
  onboarded: boolean;
  entitlement: Entitlement;
  profiles: ChildProfile[];
  activeProfileId: string | null;
  progress: Record<string, ChildProgress>;
  sparks: number;
  /** Local parental gate. Not security — it keeps a seven-year-old out, which is its job. */
  parentPinHash: number | null;
  /** Trial sessions consumed. One per calendar day, not per app open. */
  trialSessions: number;
  /** ISO date of the last counted session, so one evening counts once. */
  lastSessionDay: string | null;
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
  trialSessions: 0,
  lastSessionDay: null,
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

/** Starts the free trial. Free to install, so nothing is charged yet. */
export function startTrial(): void {
  setState((s) => (s.entitlement === 'none' ? { ...s, entitlement: 'trial' } : s));
}

/**
 * Counts one trial night.
 *
 * Deliberately per calendar day: a child who opens the app three times in one
 * evening has had one bedtime, and burning three of seven nights for that would
 * be a cheat the parent would rightly resent.
 */
export function countSession(today = new Date()): void {
  const day = today.toISOString().slice(0, 10);
  setState((s) => {
    if (s.entitlement !== 'trial' || s.lastSessionDay === day) return s;
    return { ...s, trialSessions: s.trialSessions + 1, lastSessionDay: day };
  });
}

export function trialNightsLeft(s: AppState): number {
  if (s.entitlement !== 'trial') return 0;
  return Math.max(0, TRIAL_SESSIONS - s.trialSessions);
}

/** True once the trial is spent and nothing has been bought. */
export function needsPurchase(s: AppState): boolean {
  return s.entitlement === 'trial' && trialNightsLeft(s) <= 0;
}

/** Everything is open during the trial; only exhaustion closes it. */
export function hasAccess(s: AppState): boolean {
  if (s.entitlement === 'solo' || s.entitlement === 'family') return true;
  return s.entitlement === 'trial' && !needsPurchase(s);
}

export function purchase(tier: 'solo' | 'family'): void {
  setState((s) => ({
    ...s,
    entitlement: tier,
    sparks: s.sparks + (tier === 'family' ? FAMILY_SPARKS : STARLIGHT_SPARKS),
  }));
}

/** What this household actually paid, for copy that should not hardcode a tier. */
export function pricePaid(s: AppState): string {
  if (s.entitlement === 'family') return FAMILY_PRICE;
  if (s.entitlement === 'solo') return STARLIGHT_PRICE;
  return STARLIGHT_PRICE;
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
  const stored = s.progress[profileId];
  if (!stored) return EMPTY_PROGRESS;
  // Older saved state predates fields added since; merge so callers never get
  // an undefined array back.
  return { ...EMPTY_PROGRESS, ...stored };
}

function patchProgress(profileId: string, patch: (p: ChildProgress) => ChildProgress): void {
  setState((s) => ({
    ...s,
    progress: {
      ...s.progress,
      [profileId]: patch({ ...EMPTY_PROGRESS, ...s.progress[profileId] }),
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

/** Keeps the most recent prints so a parent can run one off again. */
export function markPrinted(profileId: string, sceneId: string): void {
  patchProgress(profileId, (p) => ({
    ...p,
    printed: [{ sceneId, at: Date.now() }, ...p.printed.filter((x) => x.sceneId !== sceneId)]
      .slice(0, 12),
  }));
}

export function markGamePlayed(profileId: string, gameId: string): void {
  patchProgress(profileId, (p) =>
    p.games.includes(gameId) ? p : { ...p, games: [...p.games, gameId] },
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
