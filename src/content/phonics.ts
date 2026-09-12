/**
 * Letters and sounds.
 *
 * Ordered by a science-of-reading scope and sequence, not alphabetically:
 * high-frequency sounds first, confusable letters kept apart, and each set
 * chosen so the child can immediately build real words from what they know.
 * Short vowels follow a, i, o, e, u so /i/ and /e/ never sit adjacent.
 *
 * Note the honest positioning: Khan Academy Kids gives away more curriculum
 * than this, free, with Stanford behind it. This pillar exists so the app
 * nourishes, not as the reason anyone buys it. See docs/RESEARCH-PLATFORM.md §2.
 */

export interface LetterSound {
  letter: string;
  /** The sound as shown on screen — never the letter name. */
  sound: string;
  /**
   * The text handed to the speech synthesiser.
   *
   * Continuants ("sss", "mmm") speak correctly as written. Plosives do not:
   * a synthesiser given "b" says the letter NAME, "bee", which is the one thing
   * this screen must not teach. Writing them "buh" gets the consonant right at
   * the cost of an added schwa, which phonics teaching discourages. A shipping
   * product should carry recorded phonemes; this is the honest fallback until
   * then, and it is why `sound` and `say` are separate fields.
   */
  say: string;
  /** A word that starts with it, for the picture cue. */
  cue: string;
  emoji: string;
}

export interface PhonicsSet {
  id: number;
  letters: LetterSound[];
  /**
   * Words decodable using ONLY the letters from this set and the sets before it.
   * The payoff: the child reads a real word on day one.
   */
  words: string[];
  /** A sentence built only from decodable words plus the listed tricky words. */
  sentence?: string;
}

export const PHONICS_SETS: PhonicsSet[] = [
  {
    id: 1,
    letters: [
      { letter: 's', sound: 'sss', say: 'sss', cue: 'sun', emoji: '☀️' },
      { letter: 'a', sound: 'aaa', say: 'aaa', cue: 'ant', emoji: '🐜' },
      { letter: 't', sound: 't', say: 'tuh', cue: 'tap', emoji: '🚰' },
      { letter: 'p', sound: 'p', say: 'puh', cue: 'pan', emoji: '🍳' },
    ],
    words: ['at', 'as', 'sat', 'pat', 'tap', 'sap', 'pats', 'taps'],
    sentence: 'Pat sat.',
  },
  {
    id: 2,
    letters: [
      { letter: 'i', sound: 'iii', say: 'ih', cue: 'ink', emoji: '🖋️' },
      { letter: 'n', sound: 'nnn', say: 'nnn', cue: 'net', emoji: '🥅' },
      { letter: 'm', sound: 'mmm', say: 'mmm', cue: 'moon', emoji: '🌙' },
      { letter: 'd', sound: 'd', say: 'duh', cue: 'dog', emoji: '🐕' },
    ],
    words: ['it', 'in', 'is', 'sit', 'pin', 'tin', 'man', 'map', 'dad', 'and', 'dip'],
    sentence: 'A man sat in a tin.',
  },
  {
    id: 3,
    letters: [
      { letter: 'g', sound: 'g', say: 'guh', cue: 'goat', emoji: '🐐' },
      { letter: 'o', sound: 'ooo', say: 'awe', cue: 'otter', emoji: '🦦' },
      { letter: 'c', sound: 'c', say: 'cuh', cue: 'cat', emoji: '🐈' },
      { letter: 'k', sound: 'k', say: 'kuh', cue: 'kite', emoji: '🪁' },
    ],
    words: ['got', 'dog', 'cat', 'can', 'cap', 'cod', 'kid', 'pot', 'top', 'pig'],
    sentence: 'A cat and a dog sat.',
  },
  {
    id: 4,
    letters: [
      { letter: 'e', sound: 'eee', say: 'eh', cue: 'egg', emoji: '🥚' },
      { letter: 'u', sound: 'uuu', say: 'uh', cue: 'umbrella', emoji: '☂️' },
      { letter: 'r', sound: 'rrr', say: 'rrr', cue: 'rocket', emoji: '🚀' },
      { letter: 'h', sound: 'h', say: 'huh', cue: 'hat', emoji: '🎩' },
    ],
    words: ['red', 'ten', 'up', 'run', 'sun', 'mud', 'hat', 'hop', 'hug', 'rat', 'net'],
    sentence: 'The sun is red. Run up!',
  },
  {
    id: 5,
    letters: [
      { letter: 'b', sound: 'b', say: 'buh', cue: 'boat', emoji: '⛵' },
      { letter: 'f', sound: 'fff', say: 'fff', cue: 'fox', emoji: '🦊' },
      { letter: 'l', sound: 'lll', say: 'lll', cue: 'lantern', emoji: '🏮' },
      { letter: 'j', sound: 'j', say: 'juh', cue: 'jug', emoji: '🫗' },
    ],
    words: ['bed', 'bug', 'bat', 'fun', 'fin', 'fit', 'lap', 'lid', 'log', 'jam', 'jet'],
    sentence: 'The fox had fun in the mud.',
  },
];

export const ALL_LETTERS = PHONICS_SETS.flatMap((s) => s.letters);

export function letterAt(index: number): LetterSound | undefined {
  return ALL_LETTERS[index];
}

/** Every word decodable once the child has met the sets up to and including `setId`. */
export function decodableThrough(setId: number): string[] {
  return PHONICS_SETS.filter((s) => s.id <= setId).flatMap((s) => s.words);
}

/** The letters a word needs, so a set can be checked for decodability. */
export function lettersNeeded(word: string): string[] {
  return [...new Set(word.toLowerCase().replace(/[^a-z]/g, '').split(''))];
}
