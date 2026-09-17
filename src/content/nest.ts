/**
 * Lumi's Nest — what a child keeps.
 *
 * These are mementos, not currency. Stars accumulate and never fall, items
 * unlock at a threshold and are never taken back, and there is no shop to spend
 * anything in. A hat is a record of a thing you did.
 *
 * Thresholds rise gently and the first is deliberately low: something should be
 * waiting after the very first game, or the shelf reads as empty and the child
 * never learns it fills.
 */
export type NestKind = 'hats' | 'props' | 'sounds';

export interface NestItem {
  id: string;
  name: string;
  kind: NestKind;
  /** Total stars at which this appears. Never spent, only passed. */
  stars: number;
  /** Shown on the locked silhouette and in the shelf. */
  emoji: string;
}

export const NEST_ITEMS: NestItem[] = [
  { id: 'acorn-cap', name: 'Acorn cap', kind: 'hats', stars: 3, emoji: '\u{1F330}' },
  { id: 'nightcap', name: 'Nightcap', kind: 'hats', stars: 8, emoji: '\u{1F319}' },
  { id: 'star-crown', name: 'Star crown', kind: 'hats', stars: 16, emoji: '\u{2B50}' },
  { id: 'goggles', name: 'Flying goggles', kind: 'hats', stars: 26, emoji: '\u{1F97D}' },
  { id: 'petal-wreath', name: 'Petal wreath', kind: 'hats', stars: 38, emoji: '\u{1F338}' },

  { id: 'moss-bed', name: 'Moss bed', kind: 'props', stars: 12, emoji: '\u{1F33F}' },
  { id: 'crystal-lamp', name: 'Crystal lamp', kind: 'props', stars: 22, emoji: '\u{1F52E}' },
  { id: 'music-box', name: 'Music box', kind: 'props', stars: 32, emoji: '\u{1F3B5}' },

  { id: 'crickets', name: 'Crickets', kind: 'sounds', stars: 18, emoji: '\u{1F997}' },
  { id: 'gentle-rain', name: 'Gentle rain', kind: 'sounds', stars: 30, emoji: '\u{1F327}' },
];

export const HATS = NEST_ITEMS.filter((i) => i.kind === 'hats');

export function nestItem(id: string): NestItem | undefined {
  return NEST_ITEMS.find((i) => i.id === id);
}

/** Everything the child has reached. Monotonic in `stars` by construction. */
export function unlockedFor(stars: number): NestItem[] {
  return NEST_ITEMS.filter((i) => i.stars <= stars);
}

/** The next thing to look forward to, or undefined once everything is out. */
export function nextUnlock(stars: number): NestItem | undefined {
  return NEST_ITEMS.filter((i) => i.stars > stars).sort((a, b) => a.stars - b.stars)[0];
}
