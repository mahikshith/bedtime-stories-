/** Core domain types for the story engine. */

export type AgeBand = '3-5' | '6-8' | '9-11';

/** Grammatical set used for render-time personalization. */
export type PronounSet = 'she' | 'he' | 'they';

export interface ChildProfile {
  id: string;
  /** Stays on-device. Never sent to any model or server. */
  name: string;
  ageBand: AgeBand;
  pronouns: PronounSet;
  companionId: string;
  /** Interest ids drawn from a fixed, parent-approved vocabulary. */
  interests: string[];
  createdAt: number;
}

export interface Companion {
  id: string;
  name: string;
  species: string;
  emoji: string;
  /** A short trait woven into stories for continuity. */
  trait: string;
}

/** The vocabulary a world contributes to the shared narrative skeleton. */
export interface WorldLexicon {
  places: string[];
  guides: string[];
  wonders: string[];
  obstacles: string[];
  gentleThings: string[];
  sounds: string[];
  treasures: string[];
}

/** One real, public-domain fact shown after the story. Fantasy first, then one true thing. */
export interface RealWindow {
  title: string;
  fact: string;
  credit: string;
  /** Public-domain archive the imagery/fact is drawn from. */
  source: 'NASA' | 'NOAA' | 'USGS' | 'Smithsonian Open Access' | 'Library of Congress';
}

export interface World {
  id: string;
  name: string;
  emoji: string;
  /** Short parent-facing description. */
  blurb: string;
  /** [deep, mid, glow] — drives the glass gradient for this world. */
  palette: [string, string, string];
  lexicon: WorldLexicon;
  /** World-specific paragraphs injected so worlds never feel interchangeable. */
  signatures: { wonder: string[]; settle: string[] };
  realWindow: RealWindow;
  /** Episodes available on the map. */
  episodeCount: number;
}

export type ArcStage =
  | 'call'
  | 'threshold'
  | 'wonder'
  | 'wobble'
  | 'helper'
  | 'resolve'
  | 'settle';

/** Variants for one sentence position. The generator picks one per slot. */
export type SentenceSlot = string[];

export interface ArcSkeleton {
  id: string;
  name: string;
  stages: Record<ArcStage, SentenceSlot[]>;
}

export interface StoryPage {
  stage: ArcStage;
  text: string;
  /** 0 = fully alert, 1 = deepest wind-down. Drives dimming and narration rate. */
  calm: number;
}

export interface Story {
  id: string;
  title: string;
  worldId: string;
  episode: number;
  childName: string;
  ageBand: AgeBand;
  pages: StoryPage[];
  realWindow: RealWindow;
  /** 'library' = zero marginal cost. 'spark' = a metered AI generation. */
  origin: 'library' | 'spark';
  seed: number;
  wordCount: number;
  createdAt: number;
}

export interface StoryRequest {
  world: World;
  episode: number;
  profile: ChildProfile;
  companion: Companion;
  /** Optional seed for deterministic regeneration. */
  seed?: number;
  /** Two-minute mode: a shortened arc for exhausted parents. */
  short?: boolean;
}

/**
 * Pluggable generation backend. The offline provider is the default and has
 * zero marginal cost; an LLM provider can be swapped in for Wish Sparks.
 */
export interface StoryProvider {
  readonly id: string;
  readonly costPerStoryUsd: number;
  generate(request: StoryRequest): Promise<Story>;
}

/* ---------- Rhymes ---------- */

export type RhymeKind = 'traditional' | 'original';

/**
 * The devices that make a rhyme recitable. Each is evidence-backed — see
 * docs/RESEARCH-PLATFORM.md §5.
 */
export type RhymeDevice =
  | 'refrain'
  | 'cloze'
  | 'actions'
  | 'counting'
  | 'cumulative'
  | 'call-response'
  | 'nonsense';

export interface RhymeLine {
  /** Full line, including the cloze word. May carry {child} / {companion} slots. */
  text: string;
  /**
   * The final word, dropped so the child supplies it. The strongest
   * participation mechanic available, so most stanzas end on one.
   */
  cloze?: string;
  /** Two-voice reading: the grown-up calls, the companion answers. */
  voice?: 'grownup' | 'companion' | 'both';
  /** A motion to do on this line. Tapping the beat aids memorisation. */
  action?: string;
  /** Part of the repeating refrain the child can join before learning the rest. */
  refrain?: boolean;
  /** Scheme letter, e.g. 'A'. Lines sharing a letter must rhyme. */
  rhyme?: string;
}

export interface Rhyme {
  id: string;
  title: string;
  kind: RhymeKind;
  /** Provenance: public-domain date, or original authorship. */
  provenance: string;
  /** Ties the rhyme to a story world, where one applies. */
  worldId?: string;
  emoji: string;
  ageBands: AgeBand[];
  devices: RhymeDevice[];
  /** Trochaic reads most naturally to young children. */
  meter: 'trochaic' | 'iambic' | 'mixed';
  lines: RhymeLine[];
  /** Words that rhyme, grouped. Powers the rhyme-matching game. */
  rhymeGroups: string[][];
}
