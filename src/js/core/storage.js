/**
 * Progress, settings and streaks.
 *
 * localStorage only — no account, no network, nothing leaves the device.
 * That is deliberate for a children's app: there is nothing here worth
 * collecting and nothing to breach.
 */

import { mirror } from "./native.js";

const KEY = "wordquest.save.v1";

const FRESH = {
  band: null,            // 'tiny' | 'mid' | 'big' — null until the child picks
  openGame: null,        // which game's level path is expanded in the hub
  name: "",
  xp: 0,
  gems: 20,
  streak: 0,
  lastPlayed: null,      // YYYY-MM-DD
  /** stars[gameId][levelIndex] = 0..3 */
  stars: {},
  /** best[gameId] = best score */
  best: {},
  wordsLearned: [],      // words cleared with a correct spoken match
  /** Games whose how-to-play has been shown once; see core/coach.js. */
  tutorialsSeen: [],
  settings: {
    sound: true,
    music: true,
    voiceSensitivity: 1,
    speechCheck: true,   // verify the spoken word where supported
    jumpControl: "both", // voice, touch, or both; touch can skip mic permission
    reducedMotion: false,
  },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(FRESH);
    const parsed = JSON.parse(raw);
    // Merge so a save from an older build still boots after a schema change.
    return {
      ...structuredClone(FRESH),
      ...parsed,
      settings: { ...FRESH.settings, ...(parsed.settings || {}) },
      stars: parsed.stars || {},
      best: parsed.best || {},
    };
  } catch {
    return structuredClone(FRESH);
  }
}

let state = load();
const listeners = new Set();

function persist() {
  const json = JSON.stringify(state);
  try { localStorage.setItem(KEY, json); } catch {}
  // Fire and forget: the native mirror exists so progress survives iOS
  // evicting WebView storage, and no caller should ever wait on it.
  mirror.save(KEY, json);
  listeners.forEach((fn) => fn(state));
}

/**
 * Rehydrate from the native mirror if local storage has come back empty.
 *
 * A WKWebView's localStorage is not durable — iOS can clear it when the device
 * is short of space — and a child opening the app to find every level locked
 * again would have no idea why, and no way to get it back. Await this before
 * the first render; on the web it resolves immediately and does nothing.
 */
async function restore() {
  if (state.band || state.wordsLearned?.length) return state;
  const raw = await mirror.load(KEY);
  if (!raw) return state;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return state;
    state = {
      ...structuredClone(FRESH),
      ...parsed,
      settings: { ...FRESH.settings, ...(parsed.settings || {}) },
      stars: parsed.stars || {},
      best: parsed.best || {},
    };
    try { localStorage.setItem(KEY, raw); } catch {}
    listeners.forEach((fn) => fn(state));
  } catch {}
  return state;
}

export const save = {
  get state() { return state; },
  restore,

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  set(patch) { state = { ...state, ...patch }; persist(); },

  setSetting(key, value) {
    state.settings = { ...state.settings, [key]: value };
    persist();
  },

  addXp(n) {
    state.xp += n;
    persist();
    return state.xp;
  },

  addGems(n) { state.gems = Math.max(0, state.gems + n); persist(); },

  /** Record a level result; stars only ever go up. */
  recordLevel(gameId, level, stars, score = 0) {
    const g = (state.stars[gameId] ||= {});
    const prev = g[level] ?? 0;
    const improved = stars > prev;
    if (improved) g[level] = stars;
    if (score > (state.best[gameId] ?? 0)) state.best[gameId] = score;
    persist();
    return { improved, prev, stars: g[level] };
  },

  starsFor(gameId, level) { return state.stars[gameId]?.[level] ?? 0; },

  totalStars(gameId) {
    return Object.values(state.stars[gameId] || {}).reduce((a, b) => a + b, 0);
  },

  /** Highest level index unlocked: clear one to open the next. */
  unlockedLevel(gameId) {
    const g = state.stars[gameId] || {};
    let n = 0;
    while ((g[n] ?? 0) > 0) n++;
    return n;
  },

  /**
   * Has this child been shown how to play `gameId` yet?
   *
   * Read before the first frame, so the tutorial can run itself exactly once
   * per game rather than every time the game is opened. `?? []` because a
   * save written before this field existed is still perfectly valid — it just
   * means nothing has been seen.
   */
  seenTutorial(gameId) { return (state.tutorialsSeen ?? []).includes(gameId); },

  markTutorial(gameId) {
    state.tutorialsSeen = state.tutorialsSeen ?? [];
    if (state.tutorialsSeen.includes(gameId)) return;
    state.tutorialsSeen.push(gameId);
    persist();
  },

  learnWord(word) {
    if (!state.wordsLearned.includes(word)) {
      state.wordsLearned.push(word);
      persist();
      return true;
    }
    return false;
  },

  /** Touch the streak. Same day is a no-op; a gap of >1 day resets it. */
  touchStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastPlayed === today) return state.streak;
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    state.streak = state.lastPlayed === yesterday ? state.streak + 1 : 1;
    state.lastPlayed = today;
    persist();
    return state.streak;
  },

  reset() { state = structuredClone(FRESH); persist(); },
};

/** Stars from an accuracy fraction — the same curve in every game. */
export function starsFromAccuracy(correct, total) {
  if (!total) return 0;
  const pct = correct / total;
  if (pct >= 0.95) return 3;
  if (pct >= 0.7) return 2;
  if (pct > 0) return 1;
  return 0;
}
