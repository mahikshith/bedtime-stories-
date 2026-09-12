import type { Rhyme, RhymeLine } from './types';
import { makeRng, pick } from './rng';
import { substitute, type SubstitutionContext } from './personalize';

/**
 * Rhyme mechanics.
 *
 * The three things that make a rhyme recitable rather than merely played:
 * word-by-word highlighting so a pre-reader can follow, the dropped final word
 * the child supplies, and a rhyme-matching game that turns the corpus into
 * phonological-awareness practice. See docs/RESEARCH-PLATFORM.md §5.
 */

/** Strips punctuation and casing for comparison. */
export function bareWord(word: string): string {
  return word.replace(/[^\p{L}\p{N}'-]/gu, '').toLocaleLowerCase();
}

export function endWord(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const bare = bareWord(words[i]);
    // Skip trailing dashes and other non-words.
    if (bare) return bare;
  }
  return '';
}

const VOWELS = 'aeiouy';

/**
 * Syllable estimate. Not linguistically exact, but it only needs to be
 * proportional — it distributes highlight time across a line.
 */
export function countSyllables(word: string): number {
  const w = bareWord(word).replace(/'/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;

  let count = 0;
  let prevVowel = false;
  for (let i = 0; i < w.length; i++) {
    const isVowel = VOWELS.includes(w[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  // Silent terminal 'e', as in "little" vs "make".
  if (w.endsWith('e') && !w.endsWith('le') && count > 1) count--;
  return Math.max(1, count);
}

export interface WordToken {
  /** As displayed, punctuation included. */
  text: string;
  /** Character offset in the line, for matching speech boundary events. */
  start: number;
  syllables: number;
}

export function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      start: match.index,
      syllables: countSyllables(match[0]),
    });
  }
  return tokens;
}

/**
 * Word-by-word karaoke timings.
 *
 * Speech boundary events are the accurate source but are unreliable across
 * Android browsers, so this provides a syllable-weighted fallback that keeps
 * the highlight moving even when no boundary events arrive.
 */
export function estimateTimings(text: string, rate = 1): number[] {
  const tokens = tokenize(text);
  const msPerSyllable = 260 / Math.max(0.1, rate);
  let elapsed = 0;
  return tokens.map((token) => {
    const at = elapsed;
    elapsed += token.syllables * msPerSyllable;
    // A beat of air after phrase-final punctuation.
    if (/[,.;:!?—]$/.test(token.text)) elapsed += 180 / Math.max(0.1, rate);
    return at;
  });
}

export function totalDuration(text: string, rate = 1): number {
  const timings = estimateTimings(text, rate);
  const tokens = tokenize(text);
  if (tokens.length === 0) return 0;
  const last = tokens[tokens.length - 1];
  return timings[timings.length - 1] + last.syllables * (260 / Math.max(0.1, rate));
}

/**
 * Orthographic rhyme key: everything from the last vowel group onward, with the
 * commonest English spellings of the same ending folded together. Good enough to
 * generate game distractors; the corpus declares its real rhyme groups.
 */
export function rhymeKey(word: string): string {
  let w = bareWord(word);
  if (!w) return '';

  // Silent terminal 'e': "are" rhymes with "star", not with "me".
  if (
    w.length > 2 &&
    w.endsWith('e') &&
    !VOWELS.includes(w[w.length - 2]) &&
    [...w.slice(0, -2)].some((c) => VOWELS.includes(c))
  ) {
    w = w.slice(0, -1);
  }

  // Terminal 'y' is /aI/ in one syllable ("sky") but /i/ in more ("sleepy").
  if (w.endsWith('y')) {
    w = w.slice(0, -1) + (countSyllables(w) <= 1 ? 'I' : 'E');
  }

  const FOLD: [RegExp, string][] = [
    [/ight$/, 'IT'], [/igh$/, 'I'],
    [/ie$/, 'E'], [/ee$/, 'E'], [/ea$/, 'E'],
    [/ough$/, 'O'], [/ow$/, 'O'], [/oe$/, 'O'], [/o$/, 'O'],
    [/ue$/, 'U'], [/ew$/, 'U'], [/oo$/, 'U'], [/ou$/, 'U'],
  ];
  for (const [pattern, replacement] of FOLD) {
    if (pattern.test(w)) {
      w = w.replace(pattern, replacement);
      break;
    }
  }

  const lastVowel = Math.max(
    ...['a', 'e', 'i', 'o', 'u', 'I', 'E', 'O', 'U'].map((v) => w.lastIndexOf(v)),
  );
  // Fold markers are uppercase only to survive the vowel scan above.
  return (lastVowel < 0 ? w : w.slice(lastVowel)).toLowerCase();
}

/**
 * Word -> the rhyme groups it belongs to.
 *
 * English spelling cannot be resolved orthographically — "head"/"red" rhyme and
 * "goes"/"knows" rhyme, but neither pair looks alike. The corpus declares its
 * groups by ear, so the index is the authority and rhymeKey() is only the
 * fallback for words the corpus has never seen.
 */
export type RhymeIndex = Map<string, Set<number>>;

export function buildRhymeIndex(corpus: Rhyme[]): RhymeIndex {
  const index: RhymeIndex = new Map();
  let groupId = 0;
  for (const rhyme of corpus) {
    for (const group of rhyme.rhymeGroups) {
      const id = groupId++;
      for (const word of group) {
        const key = bareWord(word);
        const set = index.get(key) ?? new Set<number>();
        set.add(id);
        index.set(key, set);
      }
    }
  }
  return index;
}

export function wordsRhyme(a: string, b: string, index?: RhymeIndex): boolean {
  const ka = bareWord(a);
  const kb = bareWord(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;

  if (index) {
    const ga = index.get(ka);
    const gb = index.get(kb);
    // Both known to the corpus: the declared groups settle it either way.
    if (ga && gb) return [...ga].some((id) => gb.has(id));
  }

  const na = rhymeKey(a);
  const nb = rhymeKey(b);
  return na.length > 0 && na === nb;
}

/** The dropped-word mechanic: the line without its final word, plus the answer. */
export interface Cloze {
  prefix: string;
  answer: string;
}

export function clozeFor(line: RhymeLine): Cloze | null {
  if (!line.cloze) return null;
  const idx = line.text.toLocaleLowerCase().lastIndexOf(line.cloze.toLocaleLowerCase());
  if (idx < 0) return null;
  return { prefix: line.text.slice(0, idx).trimEnd(), answer: line.cloze };
}

export interface RhymeQuestion {
  /** "Which one rhymes with SNOW?" */
  target: string;
  options: string[];
  answer: string;
}

/**
 * Builds a rhyme-matching question. Distractors are drawn from other groups and
 * verified not to rhyme with the target, so there is exactly one right answer.
 */
export function buildRhymeQuestion(
  rhyme: Rhyme,
  corpus: Rhyme[],
  seed: number,
): RhymeQuestion | null {
  const rng = makeRng(seed);
  const index = buildRhymeIndex(corpus);
  const usable = rhyme.rhymeGroups.filter((g) => g.length >= 2);
  if (usable.length === 0) return null;

  const group = pick(rng, usable);
  const target = pick(rng, group);
  const answer = pick(
    rng,
    group.filter((w) => w.toLocaleLowerCase() !== target.toLocaleLowerCase()),
  );

  const pool = corpus
    .flatMap((r) => r.rhymeGroups)
    .flat()
    .filter((w) => !wordsRhyme(w, target, index));

  const distractors: string[] = [];
  const seen = new Set([target.toLocaleLowerCase(), answer.toLocaleLowerCase()]);
  for (let i = 0; i < 60 && distractors.length < 2; i++) {
    if (pool.length === 0) break;
    const candidate = pick(rng, pool);
    const key = candidate.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(candidate);
  }
  if (distractors.length < 2) return null;

  const options = [answer, ...distractors];
  // Deterministic shuffle so a given seed always produces the same layout.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { target, options, answer };
}

/** Applies the child's name and companion on-device, exactly as stories do. */
export function personalizeRhyme(rhyme: Rhyme, ctx: SubstitutionContext): Rhyme {
  return {
    ...rhyme,
    lines: rhyme.lines.map((line) => ({
      ...line,
      text: substitute(line.text, ctx),
    })),
  };
}

/* ---------- corpus validation, used by tests ---------- */

export interface RhymeProblem {
  rhymeId: string;
  problem: string;
}

/**
 * Checks the corpus holds together: cloze words really are the last word, and
 * lines that claim to rhyme actually share a declared rhyme group.
 */
export function validateRhyme(rhyme: Rhyme): RhymeProblem[] {
  const problems: RhymeProblem[] = [];
  const add = (problem: string) => problems.push({ rhymeId: rhyme.id, problem });

  for (const line of rhyme.lines) {
    if (line.cloze && endWord(line.text) !== bareWord(line.cloze)) {
      add(`cloze "${line.cloze}" is not the last word of "${line.text}"`);
    }
  }

  const groups = rhyme.rhymeGroups.map((g) => new Set(g.map((w) => w.toLocaleLowerCase())));
  const byLetter = new Map<string, string[]>();
  for (const line of rhyme.lines) {
    if (!line.rhyme) continue;
    const list = byLetter.get(line.rhyme) ?? [];
    list.push(endWord(line.text));
    byLetter.set(line.rhyme, list);
  }

  for (const [letter, words] of byLetter) {
    const distinct = [...new Set(words)];
    if (distinct.length < 2) continue;
    const covering = groups.find((g) => distinct.every((w) => g.has(w)));
    if (!covering) {
      add(`scheme letter ${letter} (${distinct.join(', ')}) is not covered by a rhymeGroup`);
    }
  }

  return problems;
}
