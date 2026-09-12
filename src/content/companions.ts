import type { Companion } from '../engine/types';

/**
 * Companions persist across every world. They are the continuity mechanic:
 * a pure generator has no canon, so it cannot have this.
 */
export const COMPANIONS: Companion[] = [
  { id: 'moth', name: 'Pip', species: 'moth', emoji: '🦋', trait: 'who navigated by the nearest kind light' },
  { id: 'otter', name: 'Bramble', species: 'otter', emoji: '🦦', trait: 'who carried one favourite stone everywhere' },
  { id: 'fox', name: 'Sorrel', species: 'fox', emoji: '🦊', trait: 'who always knew the way back' },
  { id: 'owl', name: 'Mabel', species: 'owl', emoji: '🦉', trait: 'who asked exactly one good question a day' },
  { id: 'turtle', name: 'Barnaby', species: 'tortoise', emoji: '🐢', trait: 'who was never, ever late, only differently timed' },
  { id: 'bear', name: 'Nook', species: 'bear cub', emoji: '🐻', trait: 'who gave the best and most complete hugs' },
  { id: 'crab', name: 'Scuttle', species: 'hermit crab', emoji: '🦀', trait: 'who tested every new home very thoroughly' },
  { id: 'robot', name: 'Tock', species: 'pocket robot', emoji: '🤖', trait: 'whose small blue light meant everything was fine' },
  { id: 'dragon', name: 'Ember', species: 'very small dragon', emoji: '🐲', trait: 'who was exactly as warm as a mug of cocoa' },
  { id: 'cat', name: 'Juniper', species: 'cat', emoji: '🐈', trait: 'who found the warmest spot in any room within seconds' },
];

export const COMPANION_BY_ID = new Map(COMPANIONS.map((c) => [c.id, c]));

export function getCompanion(id: string): Companion {
  return COMPANION_BY_ID.get(id) ?? COMPANIONS[0];
}

/** Fixed, parent-approved interest vocabulary. The child never free-types. */
export const INTERESTS = [
  { id: 'space', label: 'Space', emoji: '🪐' },
  { id: 'animals', label: 'Animals', emoji: '🐾' },
  { id: 'building', label: 'Building things', emoji: '🔧' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'dinosaurs', label: 'Dinosaurs', emoji: '🦕' },
  { id: 'baking', label: 'Baking', emoji: '🧁' },
  { id: 'painting', label: 'Painting', emoji: '🎨' },
  { id: 'swimming', label: 'Swimming', emoji: '🏊' },
  { id: 'plants', label: 'Growing plants', emoji: '🌱' },
  { id: 'maps', label: 'Maps', emoji: '🗺️' },
  { id: 'weather', label: 'Weather', emoji: '🌦️' },
  { id: 'trains', label: 'Trains', emoji: '🚆' },
] as const;
