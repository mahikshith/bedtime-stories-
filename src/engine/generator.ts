import { ARCS } from '../content/arcs';
import { INTERESTS } from '../content/companions';
import type { ArcStage, Story, StoryPage, StoryRequest } from './types';
import { hashString, makeRng, pick, pickDistinct } from './rng';
import {
  simplifyForYoungest,
  stripArticle,
  substitute,
  titleCase,
  type SubstitutionContext,
} from './personalize';
import { checkStoryText } from './safety';

const FULL_ARC: ArcStage[] = [
  'call', 'threshold', 'wonder', 'wobble', 'helper', 'resolve', 'settle',
];

/** Two-minute mode: the parent is exhausted and it is already 8:50pm. */
const SHORT_ARC: ArcStage[] = ['call', 'wonder', 'resolve', 'settle'];

/**
 * The sleep gradient. Every story de-escalates towards 1.0, which drives
 * narration rate, screen dimming and palette warmth in the player.
 */
const CALM_BY_STAGE: Record<ArcStage, number> = {
  call: 0.05,
  threshold: 0.16,
  wonder: 0.3,
  wobble: 0.36,
  helper: 0.52,
  resolve: 0.8,
  settle: 1,
};

const INTEREST_LABEL = new Map<string, string>(
  INTERESTS.map((i) => [i.id, i.label.toLocaleLowerCase()]),
);

export function seedFor(req: StoryRequest): number {
  return hashString(`${req.world.id}:${req.episode}:${req.profile.id}:${req.short ? 's' : 'f'}`);
}

function buildContext(req: StoryRequest, rng: () => number): SubstitutionContext {
  const lx = req.world.lexicon;
  const [place, place2] = pickDistinct(rng, lx.places, 2);
  const [wonder, wonder2] = pickDistinct(rng, lx.wonders, 2);
  const [sound, sound2] = pickDistinct(rng, lx.sounds, 2);
  const interestId = req.profile.interests.length
    ? pick(rng, req.profile.interests)
    : 'maps';
  return {
    child: req.profile.name,
    pronouns: req.profile.pronouns,
    companion: req.companion.name,
    companionSpecies: req.companion.species,
    trait: req.companion.trait,
    world: req.world.name,
    place,
    place2,
    guide: pick(rng, lx.guides),
    wonder,
    wonder2,
    obstacle: pick(rng, lx.obstacles),
    gentle: pick(rng, lx.gentleThings),
    sound,
    sound2,
    treasure: pick(rng, lx.treasures),
    interest: INTEREST_LABEL.get(interestId) ?? 'maps',
  };
}

function buildTitle(ctx: SubstitutionContext, rng: () => number): string {
  // Some patterns supply their own article ("and the ..."), so the lexicon's
  // article must be stripped. Others read the phrase bare and need it kept —
  // "The Night Ada Found Folded Star Chart" is not a sentence.
  const patterns = [
    () => `${ctx.child} and the ${titleCase(stripArticle(ctx.wonder))}`,
    () => `The Night ${ctx.child} Found ${titleCase(ctx.treasure, false)}`,
    () => `${ctx.child} and ${ctx.companion} at ${titleCase(ctx.place, false)}`,
    () => titleCase(ctx.place),
    () => `${ctx.child} and the ${titleCase(stripArticle(ctx.obstacle))}`,
  ];
  const title = pick(rng, patterns)();
  // Keep titles short enough to sit on one line on a phone.
  return title.length > 46 ? `${ctx.child} and the ${titleCase(stripArticle(ctx.treasure))}` : title;
}

function composeStage(
  stage: ArcStage,
  req: StoryRequest,
  ctx: SubstitutionContext,
  rng: () => number,
): string {
  const arc = ARCS[req.episode % ARCS.length];
  const slots = arc.stages[stage];
  // The youngest band gets fewer, shorter sentences per page.
  const slotCount = req.profile.ageBand === '3-5' ? Math.min(2, slots.length) : slots.length;
  const sentences = slots.slice(0, slotCount).map((variants) => pick(rng, variants));

  // Inject the world's signature line so no two worlds read alike.
  if (stage === 'wonder') sentences.splice(1, 0, pick(rng, req.world.signatures.wonder));
  if (stage === 'settle') sentences.splice(sentences.length - 1, 0, pick(rng, req.world.signatures.settle));

  let text = substitute(sentences.join(' '), ctx);
  if (req.profile.ageBand === '3-5') text = simplifyForYoungest(text);
  return text;
}

function compose(req: StoryRequest, seed: number): Story {
  const rng = makeRng(seed);
  const ctx = buildContext(req, rng);
  const stages = req.short ? SHORT_ARC : FULL_ARC;

  const pages: StoryPage[] = stages.map((stage) => ({
    stage,
    text: composeStage(stage, req, ctx, rng),
    calm: CALM_BY_STAGE[stage],
  }));

  // Short mode skips the middle stages, so re-spread calm evenly across what remains.
  if (req.short) {
    pages.forEach((page, i) => {
      page.calm = Number((i / (pages.length - 1)).toFixed(3));
    });
  }

  const wordCount = pages.reduce(
    (n, p) => n + p.text.split(/\s+/).filter(Boolean).length,
    0,
  );

  return {
    id: `${req.world.id}-${req.episode}-${seed.toString(36)}`,
    title: buildTitle(ctx, rng),
    worldId: req.world.id,
    episode: req.episode,
    childName: req.profile.name,
    ageBand: req.profile.ageBand,
    pages,
    realWindow: req.world.realWindow,
    origin: 'library',
    seed,
    wordCount,
    createdAt: Date.now(),
  };
}

/**
 * Composes a story from the hand-authored library. Zero marginal cost, works
 * offline, deterministic for a given request.
 *
 * A story that fails the safety check is discarded and recomposed from a new
 * seed — never patched.
 */
export function composeLibraryStory(req: StoryRequest): Story {
  let seed = req.seed ?? seedFor(req);
  for (let attempt = 0; attempt < 4; attempt++) {
    const story = compose(req, seed);
    const verdict = checkStoryText(story.pages.map((p) => p.text).join('\n'));
    if (verdict.ok) return story;
    seed = (seed + 0x9e3779b9) >>> 0;
  }
  throw new Error('Unable to compose a story that passes the safety check.');
}
