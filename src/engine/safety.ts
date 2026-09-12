import { SENTENCE_SPLIT } from './personalize';

/**
 * Deterministic safety layer.
 *
 * Google Play holds the developer liable for anything a model emits to a child,
 * so nothing reaches the screen without passing this. A story that fails is
 * discarded and regenerated, never patched.
 */

/** Concepts that must never appear in a story for an under-11 audience. */
const BLOCKED_PATTERNS: RegExp[] = [
  /\b(kill(ed|ing|s)?|murder|stab|shoot|shot|gun|knife|blood(y|ied)?|corpse|dead body)\b/i,
  /\b(hate|stupid|idiot|dumb|ugly|fat|loser|shut up)\b/i,
  /\b(drown(ed|ing|s)?|suffocat\w*|strangl\w*|choke[ds]?)\b/i,
  /\b(die|dies|dying|death|funeral|grave)\b/i,
  /\b(scared to death|terrified|nightmare|monster under|screaming|panic)\b/i,
  /\b(drug|alcohol|beer|wine|cigarette|vape)\b/i,
  /\b(sexy|naked|nude)\b/i,
  /\b(password|credit card|address|phone number|email me|click here|subscribe)\b/i,
  /\b(war|weapon|battle|soldier|bomb|explos\w*)\b/i,
];

/** Names are parent-entered free text — the one free-text field in the app. */
const NAME_BLOCKLIST = /\b(admin|null|undefined|fuck|shit|bitch|damn|ass|dick|piss|cunt|nazi|hitler)\b/i;

export interface SafetyResult {
  ok: boolean;
  violations: string[];
}

export function checkStoryText(text: string): SafetyResult {
  const violations: string[] = [];
  for (const pattern of BLOCKED_PATTERNS) {
    const match = pattern.exec(text);
    if (match) violations.push(`blocked term: "${match[0]}"`);
  }
  // Unsubstituted tokens would render as literal braces to a child.
  const leftover = /\{[a-zA-Z]+\}/.exec(text);
  if (leftover) violations.push(`unsubstituted token: "${leftover[0]}"`);
  return { ok: violations.length === 0, violations };
}

/**
 * Sanitizes a parent-entered child name. Letters, spaces, hyphens and
 * apostrophes only; capped length; profanity rejected.
 */
export function sanitizeName(raw: string): { name: string; ok: boolean; reason?: string } {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return { name: '', ok: false, reason: 'Please enter a name.' };
  if (NAME_BLOCKLIST.test(trimmed)) {
    return { name: '', ok: false, reason: 'Please choose a different name.' };
  }
  const cleaned = trimmed.replace(/[^\p{L} '\-]/gu, '');
  if (cleaned.length === 0) return { name: '', ok: false, reason: 'Please use letters only.' };
  const capped = cleaned.slice(0, 20);
  const titled = capped
    .split(' ')
    .map((part) => (part ? part[0].toLocaleUpperCase() + part.slice(1) : part))
    .join(' ');
  return { name: titled, ok: true };
}

/**
 * Reading-level guard. Age 3-5 should not be handed 30-word sentences.
 * Returns the longest sentence length in words.
 */
export function longestSentenceWords(text: string): number {
  return text
    .split(SENTENCE_SPLIT)
    .reduce((max, s) => Math.max(max, s.trim().split(/\s+/).filter(Boolean).length), 0);
}
