import type { PronounSet } from './types';

/**
 * Render-time personalization.
 *
 * This is the economic centre of the product: substituting a name into
 * hand-authored text costs $0.00, runs offline, and completes in under a
 * millisecond. It is also the privacy centre — the child's name is inserted
 * here, on-device, and therefore never needs to reach a model or a server.
 */

interface Pronouns {
  subj: string;
  obj: string;
  poss: string;
  possPron: string;
  refl: string;
}

const PRONOUNS: Record<PronounSet, Pronouns> = {
  she: { subj: 'she', obj: 'her', poss: 'her', possPron: 'hers', refl: 'herself' },
  he: { subj: 'he', obj: 'him', poss: 'his', possPron: 'his', refl: 'himself' },
  they: { subj: 'they', obj: 'them', poss: 'their', possPron: 'theirs', refl: 'themselves' },
};

export interface SubstitutionContext {
  child: string;
  pronouns: PronounSet;
  companion: string;
  companionSpecies: string;
  trait: string;
  world: string;
  place: string;
  place2: string;
  guide: string;
  wonder: string;
  wonder2: string;
  obstacle: string;
  gentle: string;
  sound: string;
  sound2: string;
  treasure: string;
  interest: string;
}

/** Capitalizes the first letter of the string and of every sentence within it. */
export function fixCapitalization(text: string): string {
  return text
    .replace(/^(\s*[“"']?)([a-z])/u, (_m, lead: string, ch: string) => lead + ch.toUpperCase())
    .replace(
      /([.!?]\s+[“"']?)([a-z])/gu,
      (_m, lead: string, ch: string) => lead + ch.toUpperCase(),
    );
}

export function substitute(template: string, ctx: SubstitutionContext): string {
  const p = PRONOUNS[ctx.pronouns];
  const table: Record<string, string> = {
    child: ctx.child,
    they: p.subj,
    them: p.obj,
    their: p.poss,
    theirs: p.possPron,
    themselves: p.refl,
    companion: ctx.companion,
    companionSpecies: ctx.companionSpecies,
    trait: ctx.trait,
    world: ctx.world,
    place: ctx.place,
    place2: ctx.place2,
    guide: ctx.guide,
    wonder: ctx.wonder,
    wonder2: ctx.wonder2,
    obstacle: ctx.obstacle,
    gentle: ctx.gentle,
    sound: ctx.sound,
    sound2: ctx.sound2,
    treasure: ctx.treasure,
    interest: ctx.interest,
  };

  const rendered = template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, rawKey: string) => {
    const lower = rawKey.charAt(0).toLowerCase() + rawKey.slice(1);
    const value = table[lower];
    if (value === undefined) return match;
    // {They} / {Their} request an explicitly capitalized form.
    const wantsCapital = rawKey[0] === rawKey[0].toUpperCase() && lower !== rawKey;
    return wantsCapital ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  });

  return fixCapitalization(rendered);
}

/** "a slow river of stars" -> "slow river of stars" */
export function stripArticle(phrase: string): string {
  return phrase.replace(/^(a|an|the)\s+/i, '');
}

const SMALL_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'and', 'to', 'at', 'by', 'for', 'with', 'from',
]);

/**
 * @param capitalizeLeading false when the phrase sits mid-title, so a leading
 * article stays lowercase: "Ada and Sorrel at the Greenhouse Module", not "at The".
 */
export function titleCase(phrase: string, capitalizeLeading = true): string {
  const words = phrase.split(/\s+/).filter(Boolean);
  return words
    .map((word, i) => {
      const lower = word.toLocaleLowerCase();
      if (SMALL_WORDS.has(lower) && (i > 0 || !capitalizeLeading)) return lower;
      return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Sentence boundary. Must tolerate a closing quote after the stop, i.e.
 * `said, "For remembering." Behind them...` is two sentences, not one.
 */
export const SENTENCE_SPLIT = /(?<=[.!?][\u201d\u2019"']?)\s+/;

/**
 * Reading-level pass for the youngest band. Long compound sentences are split
 * at natural joints, repeatedly, until each reads aloud in a single breath.
 * Splitting beats truncating: the prose stays whole.
 */
const JOINTS =
  /,\s+(and|but|which|because|so|the way|like|as though|until|while|once|when|if|though|before|after)\s+/i;

const YOUNGEST_MAX_WORDS = 13;

function wordCount(sentence: string): number {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}

function endWithStop(text: string): string {
  return /[.!?][\u201d\u2019"']?$/.test(text) ? text : `${text}.`;
}

/** Last resort: break at the comma nearest the middle, keeping both halves substantial. */
function splitAtComma(sentence: string): string[] | null {
  const words = sentence.split(/\s+/);
  const mid = words.length / 2;
  let best = -1;
  words.forEach((word, i) => {
    if (!word.endsWith(',')) return;
    const head = i + 1;
    const tail = words.length - head;
    if (head < 4 || tail < 4) return;
    if (best === -1 || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
  });
  if (best === -1) return null;
  const head = words.slice(0, best + 1).join(' ').replace(/,$/, '');
  const tail = words.slice(best + 1).join(' ');
  return [endWithStop(head), tail];
}

function splitLongSentence(sentence: string, depth = 0): string[] {
  const trimmed = sentence.trim();
  if (depth > 4 || wordCount(trimmed) <= YOUNGEST_MAX_WORDS) return [trimmed];

  const match = JOINTS.exec(trimmed);
  if (match && match.index !== undefined) {
    const head = trimmed.slice(0, match.index).trim();
    const conj = match[1];
    const tail = trimmed.slice(match.index + match[0].length).trim();
    if (head && tail) {
      return [
        ...splitLongSentence(endWithStop(head), depth + 1),
        ...splitLongSentence(`${conj.charAt(0).toUpperCase()}${conj.slice(1)} ${tail}`, depth + 1),
      ];
    }
  }

  const commaSplit = splitAtComma(trimmed);
  if (commaSplit) {
    return commaSplit.flatMap((part) => splitLongSentence(part, depth + 1));
  }
  return [trimmed];
}

export function simplifyForYoungest(text: string): string {
  const sentences = text.split(SENTENCE_SPLIT).flatMap((s) => splitLongSentence(s));
  return fixCapitalization(sentences.join(' ').replace(/\s{2,}/g, ' ').trim());
}
