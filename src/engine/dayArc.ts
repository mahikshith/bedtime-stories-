/**
 * The day arc — the spine the whole app hangs off.
 *
 * One app that knows what time it is. Engagement is appropriate in the morning
 * and actively harmful at bedtime, so the app changes what it offers and how it
 * behaves across the day rather than presenting one undifferentiated feed.
 *
 * This is also the answer to the AAP's 2026 question — not "how many minutes?"
 * but "what is this displacing?". See docs/RESEARCH-PLATFORM.md §4.
 */

export type DayMode = 'wake' | 'play' | 'winddown';

export interface ModeSpec {
  id: DayMode;
  label: string;
  greeting: string;
  /** What the app is for, right now, in one line for the parent. */
  intent: string;
  /** Pillars in the order they should be offered in this mode. */
  order: Pillar[];
  /** 0 = fully bright and active, 1 = deepest wind-down. Drives the whole UI. */
  calm: number;
}

export type Pillar = 'rhymes' | 'games' | 'create' | 'learn' | 'stories';

export const MODES: Record<DayMode, ModeSpec> = {
  wake: {
    id: 'wake',
    label: 'Morning',
    greeting: 'Good morning',
    intent: 'Loud, silly and awake. Rhymes to move to.',
    order: ['rhymes', 'games', 'learn', 'create', 'stories'],
    calm: 0,
  },
  play: {
    id: 'play',
    label: 'Daytime',
    greeting: 'Hello',
    intent: 'Making things and learning letters. Best done together.',
    order: ['games', 'create', 'learn', 'rhymes', 'stories'],
    calm: 0.15,
  },
  winddown: {
    id: 'winddown',
    label: 'Wind-down',
    greeting: 'Good evening',
    intent: 'Quiet now. One story, then the app gets out of the way.',
    order: ['stories', 'rhymes', 'create', 'learn', 'games'],
    calm: 0.55,
  },
};

/** Wake 5am–11am, Play 11am–6pm, Wind-down 6pm–5am. */
export function modeForHour(hour: number): DayMode {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 11) return 'wake';
  if (h >= 11 && h < 18) return 'play';
  return 'winddown';
}

export function currentMode(now = new Date()): DayMode {
  return modeForHour(now.getHours());
}

export interface PillarSpec {
  id: Pillar;
  label: string;
  blurb: string;
  emoji: string;
}

export const PILLARS: Record<Pillar, PillarSpec> = {
  rhymes: {
    id: 'rhymes',
    label: 'Rhymes',
    blurb: 'Say them, clap them, fill in the last word.',
    emoji: '🎵',
  },
  create: {
    id: 'create',
    label: 'Colour',
    blurb: 'A page from last night’s story. Best printed.',
    emoji: '🖍️',
  },
  learn: {
    id: 'learn',
    label: 'Letters',
    blurb: 'Sounds first, then words you can really read.',
    emoji: '🔤',
  },
  stories: {
    id: 'stories',
    label: 'Stories',
    blurb: 'Eighteen worlds, and a sleep gradient.',
    emoji: '🌙',
  },
  games: {
    id: 'games',
    label: 'Games',
    blurb: 'Say the word out loud and make Lumi hop.',
    emoji: '🎤',
  },
};

/**
 * Wind-down is the only mode that suppresses anything. The lively pillars stay
 * reachable — a locked app at bedtime starts an argument — but they are not
 * offered, and the app says why.
 */
export function isEncouraged(mode: DayMode, pillar: Pillar): boolean {
  if (mode !== 'winddown') return true;
  // Games are the loudest thing in the app. Still reachable, never suggested.
  return pillar === 'stories' || pillar === 'rhymes';
}
