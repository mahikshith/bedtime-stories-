import type { Story, StoryProvider, StoryRequest } from './types';
import { composeLibraryStory } from './generator';
import { checkStoryText } from './safety';
import { substitute } from './personalize';

/**
 * The library provider. Hand-authored content, composed on-device.
 * Zero marginal cost, works offline, sub-millisecond, deterministic.
 *
 * This is the default path and the reason a one-time price is survivable.
 */
export class LibraryProvider implements StoryProvider {
  readonly id = 'library';
  readonly costPerStoryUsd = 0;

  async generate(request: StoryRequest): Promise<Story> {
    return composeLibraryStory(request);
  }
}

export interface CompletionFn {
  (prompt: string, signal?: AbortSignal): Promise<string>;
}

/** Per-story cost model, in USD. Kept here so the parent zone can show real numbers. */
export const SPARK_COST = {
  text: 0.012,
  images: 0.08,
  narration: 0.018,
  infra: 0.005,
} as const;

export const SPARK_COST_TOTAL =
  SPARK_COST.text + SPARK_COST.images + SPARK_COST.narration + SPARK_COST.infra;

/**
 * Wish Sparks — the metered, genuinely-generated path.
 *
 * Two design rules are enforced here rather than documented and hoped for:
 *
 *  1. The child's name NEVER enters the prompt. The model is asked to write
 *     with the literal placeholder {child}, and the real name is substituted
 *     on-device afterwards. That keeps the app outside COPPA's collection
 *     surface by construction rather than by policy.
 *  2. Output is slot-filling inside the same hand-authored arc, not open-ended
 *     completion, and it passes the same safety filter as library content.
 *     Anything that fails is discarded, never patched.
 */
export class WishSparkProvider implements StoryProvider {
  readonly id = 'wish-spark';
  readonly costPerStoryUsd = SPARK_COST_TOTAL;

  constructor(private readonly complete: CompletionFn | null) {}

  /** Builds a prompt that contains no personally identifying information. */
  buildPrompt(request: StoryRequest): string {
    const { world, profile, companion } = request;
    return [
      'You are writing one page of a gentle bedtime story for a child.',
      `Reading age: ${profile.ageBand}.`,
      `World: ${world.name} — ${world.blurb}`,
      `Companion: ${companion.name}, a ${companion.species}, ${companion.trait}.`,
      '',
      'HARD RULES:',
      '- Refer to the child ONLY as the literal token {child}. Never invent a name.',
      '- Use ONLY these pronoun tokens: {they} {them} {their}.',
      '- Nothing frightening, sad, competitive or exciting. No peril, no villains.',
      '- The last third must wind down: shorter sentences, lower stakes, everyone safe.',
      '- End with everyone settled and asleep.',
      '- 90 to 140 words. Plain prose. No headings, no lists, no emoji.',
    ].join('\n');
  }

  async generate(request: StoryRequest): Promise<Story> {
    if (!this.complete) {
      throw new SparkUnavailableError(
        'Wish Sparks need a story service. Tonight’s story will come from the library instead.',
      );
    }
    const base = composeLibraryStory(request);
    const raw = await this.complete(this.buildPrompt(request));

    // The model wrote with placeholders; the real name is applied here, on-device.
    const personalized = substitute(raw.trim(), {
      child: request.profile.name,
      pronouns: request.profile.pronouns,
      companion: request.companion.name,
      companionSpecies: request.companion.species,
      trait: request.companion.trait,
      world: request.world.name,
      place: request.world.lexicon.places[0],
      place2: request.world.lexicon.places[1] ?? request.world.lexicon.places[0],
      guide: request.world.lexicon.guides[0],
      wonder: request.world.lexicon.wonders[0],
      wonder2: request.world.lexicon.wonders[1] ?? request.world.lexicon.wonders[0],
      obstacle: request.world.lexicon.obstacles[0],
      gentle: request.world.lexicon.gentleThings[0],
      sound: request.world.lexicon.sounds[0],
      sound2: request.world.lexicon.sounds[1] ?? request.world.lexicon.sounds[0],
      treasure: request.world.lexicon.treasures[0],
      interest: 'the stars',
    });

    const verdict = checkStoryText(personalized);
    if (!verdict.ok) {
      // Discard, do not repair. Fall back to content we already trust.
      return { ...base, origin: 'library' };
    }

    const paragraphs = personalized.split(/\n{2,}/).filter(Boolean);
    const pages = paragraphs.map((text, i) => ({
      stage: base.pages[Math.min(i, base.pages.length - 1)].stage,
      text,
      calm: paragraphs.length === 1 ? 1 : Number((i / (paragraphs.length - 1)).toFixed(3)),
    }));

    return {
      ...base,
      origin: 'spark',
      pages: pages.length ? pages : base.pages,
      wordCount: personalized.split(/\s+/).filter(Boolean).length,
    };
  }
}

export class SparkUnavailableError extends Error {}

/**
 * Chooses the provider for tonight. Sparks are metered; the library is not.
 * If a Spark cannot be served for any reason, the child still gets a story.
 */
export async function tellStory(
  request: StoryRequest,
  opts: { useSpark: boolean; spark?: StoryProvider },
): Promise<{ story: Story; usedSpark: boolean; note?: string }> {
  const library = new LibraryProvider();
  if (opts.useSpark && opts.spark) {
    try {
      const story = await opts.spark.generate(request);
      return { story, usedSpark: story.origin === 'spark' };
    } catch (err) {
      return {
        story: await library.generate(request),
        usedSpark: false,
        note: err instanceof SparkUnavailableError ? err.message : 'Story service unavailable.',
      };
    }
  }
  return { story: await library.generate(request), usedSpark: false };
}
