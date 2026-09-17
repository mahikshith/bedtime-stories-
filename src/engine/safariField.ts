import { makeRng } from './rng';

/**
 * The dark meadow in Flashlight Safari.
 *
 * The second wind-down game, and the opposite of every other one here: no
 * microphone, no motion, no permission of any kind, and nothing that can be
 * failed or missed. The screen is nearly black and a finger is a small circle
 * of lantern light. Sleeping animals are somewhere in it.
 *
 * **Searching is the calm part.** Lantern Breath works by making a child
 * breathe out slowly; this one works by making them move slowly and look. A
 * sweep that races across the meadow finds nothing, because an animal is only
 * roused once the light has rested on it — which is a rule about patience
 * dressed up as a rule about lanterns.
 *
 * Deterministic from the level, so a child who comes back to a level finds the
 * same meadow. Pure functions, no React.
 */

export interface Sleeper {
  x: number;
  y: number;
  /** Fixed per animal so the meadow reads as a place, not a list. */
  emoji: string;
  name: string;
  found: boolean;
  /** Seconds the lantern has rested on it, 0..DWELL. */
  dwell: number;
}

export interface Meadow {
  sleepers: Sleeper[];
  /** Lantern radius in field units. Smaller at higher levels. */
  radius: number;
  level: number;
}

/** Seconds the light must stay on an animal before it stirs. */
export const DWELL = 0.7;
/** Moving faster than this, the lantern is sweeping rather than looking. */
const SWEEP_SPEED = 0.85;

const ANIMALS = [
  { emoji: '🦔', name: 'a hedgehog' },
  { emoji: '🐇', name: 'a rabbit' },
  { emoji: '🦉', name: 'an owl' },
  { emoji: '🦊', name: 'a fox' },
  { emoji: '🦌', name: 'a deer' },
  { emoji: '🐿️', name: 'a squirrel' },
  { emoji: '🦡', name: 'a badger' },
  { emoji: '🐸', name: 'a frog' },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Builds a level.
 *
 * Placement is rejection-sampled against a minimum separation, because two
 * animals under one lantern is not two finds — it is one find and one that
 * feels like a glitch. The attempt cap means a crowded level degrades to a
 * slightly tighter meadow rather than looping forever.
 */
export function buildMeadow(level: number): Meadow {
  const n = clamp(Math.round(level), 1, 5);
  const count = [2, 3, 4, 5, 6][n - 1];
  const radius = [0.22, 0.2, 0.18, 0.16, 0.15][n - 1];
  const rng = makeRng(4100 + n);

  const sleepers: Sleeper[] = [];
  const apart = radius * 2.1;
  for (let i = 0; i < count; i += 1) {
    let x = 0.5;
    let y = 0.5;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      x = 0.12 + rng() * 0.76;
      y = 0.12 + rng() * 0.76;
      if (sleepers.every((s) => Math.hypot(s.x - x, s.y - y) >= apart)) break;
    }
    const animal = ANIMALS[i % ANIMALS.length];
    sleepers.push({ x, y, emoji: animal.emoji, name: animal.name, found: false, dwell: 0 });
  }
  return { sleepers, radius, level: n };
}

export interface LookInput {
  /** Where the lantern is, 0..1. Null when no finger is down. */
  at: { x: number; y: number } | null;
  /** How fast it is moving, field units per second. */
  speed: number;
  dt: number;
}

export type SafariEvent =
  | { kind: 'stir'; index: number }
  | { kind: 'found'; index: number };

export interface LookResult {
  meadow: Meadow;
  events: SafariEvent[];
  /**
   * 0..1, how close the lantern is to the nearest sleeping animal.
   *
   * Drives a warmth in the light rather than a marker on the screen. A child
   * who cannot read still understands "warmer", and it means a level is never
   * a pixel hunt without ever being solved for them.
   */
  warmth: number;
}

export function look(meadow: Meadow, input: LookInput): LookResult {
  const dt = clamp(input.dt, 0, 1 / 15);
  const events: SafariEvent[] = [];
  const at = input.at;

  /*
   * A racing lantern finds nothing. Without this a child can scrub the screen
   * and clear the level in two seconds, which is the exact opposite of what a
   * wind-down game is for.
   */
  const looking = at !== null && input.speed <= SWEEP_SPEED;

  let warmth = 0;
  const sleepers = meadow.sleepers.map((sleeper, index) => {
    if (sleeper.found) return sleeper;

    const d = at ? Math.hypot(sleeper.x - at.x, sleeper.y - at.y) : Infinity;
    // Warmth reaches beyond the lantern itself, or there is nothing to follow.
    warmth = Math.max(warmth, d === Infinity ? 0 : clamp(1 - d / (meadow.radius * 2.6), 0, 1));

    if (!looking || d > meadow.radius) {
      // Dwell drains rather than resetting, so a wobbling finger is forgiven.
      return { ...sleeper, dwell: Math.max(0, sleeper.dwell - dt * 1.6) };
    }

    const dwell = sleeper.dwell + dt;
    if (sleeper.dwell === 0) events.push({ kind: 'stir', index });
    if (dwell >= DWELL) {
      events.push({ kind: 'found', index });
      return { ...sleeper, found: true, dwell: DWELL };
    }
    return { ...sleeper, dwell };
  });

  return { meadow: { ...meadow, sleepers }, events, warmth };
}

export function meadowComplete(meadow: Meadow): boolean {
  return meadow.sleepers.every((s) => s.found);
}

/** How many are still asleep. Shown as a count, never as a timer. */
export function stillAsleep(meadow: Meadow): number {
  return meadow.sleepers.filter((s) => !s.found).length;
}
