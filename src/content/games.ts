import type { AgeBand } from '../engine/types';

/**
 * The games catalogue.
 *
 * Games carry their own age range rather than reusing profile bands. A profile
 * is 3-5 / 6-8 / 9-11 because that is a sensible granularity for story length
 * and sentence complexity; a game needs finer steps, because the gap between a
 * three-year-old and a five-year-old on a syllable task is enormous. Keeping
 * the two separate means adding a game never churns the profile model.
 *
 * Every game states the skill it is actually practising. If we cannot name the
 * skill, it does not belong in the app.
 */

export type GameSkill =
  | 'vocabulary'
  | 'pronunciation'
  | 'syllables'
  | 'rhyme'
  | 'letters'
  | 'listening'
  | 'turn-taking'
  | 'confidence';

export type GameInput = 'voice' | 'touch';

export interface Game {
  id: string;
  title: string;
  /** One line a parent reads to decide. */
  blurb: string;
  emoji: string;
  /** Inclusive. Finer-grained than profile age bands on purpose. */
  minAge: number;
  maxAge: number;
  skills: GameSkill[];
  input: GameInput;
  /** Loud games must never be offered at bedtime. */
  loud: boolean;
  /**
   * True for the rare game that actively calms rather than merely failing to
   * excite. Only these are offered during wind-down.
   */
  calm?: boolean;
  /**
   * True when the game is designed to be played WITH a grown-up rather than
   * handed over. The AAP's 2026 guidance weighs co-viewing heavily, and the
   * youngest band is co-play or nothing.
   */
  together: boolean;
  /** Built, or catalogued for later. */
  status: 'playable' | 'planned';
}

export const GAMES: Game[] = [
  {
    id: 'lantern-breath',
    title: 'Lantern Breath',
    blurb: 'Blow out five lanterns, slowly. The room gets darker each time.',
    emoji: '🏮',
    minAge: 3,
    maxAge: 11,
    skills: ['confidence', 'listening'],
    input: 'voice',
    loud: false,
    calm: true,
    together: false,
    status: 'playable',
  },
  {
    id: 'wake-the-animal',
    title: 'Wake the Animal',
    blurb: 'Any sound at all makes a sleepy animal pop up. No way to lose.',
    emoji: '🦔',
    minAge: 2,
    maxAge: 4,
    skills: ['confidence', 'listening'],
    input: 'voice',
    loud: false,
    together: true,
    status: 'playable',
  },
  {
    id: 'lumis-leap',
    title: "Lumi's Leap",
    blurb: 'Say the word to make Lumi hop. Say it bigger to hop further.',
    emoji: '🐤',
    minAge: 3,
    maxAge: 7,
    skills: ['vocabulary', 'pronunciation', 'confidence'],
    input: 'voice',
    loud: true,
    together: false,
    status: 'playable',
  },
  {
    id: 'syllable-hop',
    title: 'Syllable Hop',
    blurb: 'One hop per beat. But-ter-fly is three.',
    emoji: '🦋',
    minAge: 4,
    maxAge: 8,
    skills: ['syllables', 'pronunciation', 'vocabulary'],
    input: 'voice',
    loud: true,
    together: false,
    status: 'playable',
  },
  {
    id: 'rhyme-race',
    title: 'Rhyme Race',
    blurb: 'Catch the word that rhymes before it floats away.',
    emoji: '🎈',
    minAge: 4,
    maxAge: 9,
    skills: ['rhyme', 'listening', 'vocabulary'],
    input: 'touch',
    loud: false,
    together: false,
    status: 'playable',
  },
  {
    id: 'word-builder',
    title: 'Word Builder',
    blurb: 'Drag the sounds together and read what you made.',
    emoji: '🔤',
    minAge: 5,
    maxAge: 8,
    skills: ['letters', 'vocabulary'],
    input: 'touch',
    loud: false,
    together: false,
    status: 'planned',
  },
  {
    id: 'tongue-twister',
    title: 'Tongue Twister Tower',
    blurb: 'Say it clearly, three times, without falling over.',
    emoji: '🗼',
    minAge: 6,
    maxAge: 10,
    skills: ['pronunciation', 'confidence'],
    input: 'voice',
    loud: true,
    together: false,
    status: 'planned',
  },
  {
    id: 'what-comes-next',
    title: 'What Comes Next?',
    blurb: 'Finish the sentence out loud. Any good answer wins.',
    emoji: '💬',
    minAge: 5,
    maxAge: 9,
    skills: ['turn-taking', 'vocabulary', 'confidence'],
    input: 'voice',
    loud: false,
    together: true,
    status: 'planned',
  },
];

/**
 * Word lists for the voice games, graded by age.
 *
 * Short and concrete for the youngest; longer and more syllable-rich as the
 * child grows, because the syllable game is only interesting once words have
 * more than one beat.
 */
export interface WordCard {
  word: string;
  emoji: string;
  minAge: number;
}

export const WORD_CARDS: WordCard[] = [
  { word: 'cat', emoji: '🐈', minAge: 2 },
  { word: 'dog', emoji: '🐕', minAge: 2 },
  { word: 'sun', emoji: '☀️', minAge: 2 },
  { word: 'ball', emoji: '⚽', minAge: 2 },
  { word: 'moon', emoji: '🌙', minAge: 3 },
  { word: 'star', emoji: '⭐', minAge: 3 },
  { word: 'fish', emoji: '🐟', minAge: 3 },
  { word: 'duck', emoji: '🦆', minAge: 3 },
  { word: 'apple', emoji: '🍎', minAge: 3 },
  { word: 'rocket', emoji: '🚀', minAge: 4 },
  { word: 'rainbow', emoji: '🌈', minAge: 4 },
  { word: 'penguin', emoji: '🐧', minAge: 4 },
  { word: 'lantern', emoji: '🏮', minAge: 4 },
  { word: 'butterfly', emoji: '🦋', minAge: 5 },
  { word: 'elephant', emoji: '🐘', minAge: 5 },
  { word: 'umbrella', emoji: '☂️', minAge: 5 },
  { word: 'dinosaur', emoji: '🦕', minAge: 5 },
  { word: 'astronaut', emoji: '👩‍🚀', minAge: 6 },
  { word: 'helicopter', emoji: '🚁', minAge: 6 },
  { word: 'caterpillar', emoji: '🐛', minAge: 6 },
];

/** The youngest age a profile band could be, used to filter games. */
export function lowestAge(band: AgeBand): number {
  return Number(band.split('-')[0]);
}

export function highestAge(band: AgeBand): number {
  return Number(band.split('-')[1]);
}

/** Games that overlap the child's band at all, playable ones first. */
export function gamesForBand(band: AgeBand): Game[] {
  const low = lowestAge(band);
  const high = highestAge(band);
  return GAMES.filter((g) => g.minAge <= high && g.maxAge >= low).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'playable' ? -1 : 1;
    return a.minAge - b.minAge;
  });
}

export function wordsForAge(age: number, max = 12): WordCard[] {
  const fit = WORD_CARDS.filter((w) => w.minAge <= age);
  return (fit.length ? fit : WORD_CARDS.slice(0, 4)).slice(0, max);
}

/**
 * Wind-down offers only the calm games.
 *
 * The loud ones stay reachable — a locked app at 7pm starts an argument — but
 * a shouting game is the opposite of what the evening needs, and until Lantern
 * Breath existed there was nothing here worth suggesting at all.
 */
export function isGameEncouraged(winddown: boolean, game: Game): boolean {
  return winddown ? game.calm === true : true;
}

export function getGame(id: string): Game {
  const game = GAMES.find((g) => g.id === id);
  if (!game) throw new Error(`Unknown game: ${id}`);
  return game;
}
