/**
 * Balance — levels.
 *
 * Three tiers, and the tier is what the cards LOOK like, not what the maths
 * is. The same manipulation runs all the way through; only the notation
 * changes underneath the child.
 *
 *   creature  friendly monsters, day and night. No numbers anywhere.
 *   number    the monsters are relabelled 1, 2, 3. Same moves.
 *   algebra   the box becomes x. The child has been doing algebra for an hour.
 *
 * Terms: "box" is the unknown, "a".."f" are cards, "-" marks the shadow.
 */

export const LEVELS = [
  {
    id: "b1", name: "Say Hello", tier: "creature",
    teaches: "Tap a friend, then its moon twin",
    left: ["box", "a", "-a"], right: ["b"], deck: [],
  },
  {
    id: "b2", name: "Two Shadows", tier: "creature",
    teaches: "Match each friend with its moon twin",
    left: ["box", "a", "-a", "b", "-b"], right: ["c"], deck: [],
  },
  {
    id: "b3", name: "Make a Shadow", tier: "creature",
    teaches: "Tap the moon card to add it to BOTH sides",
    left: ["box", "a"], right: ["b"], deck: ["-a"],
  },
  {
    id: "b4", name: "Pick the Right One", tier: "creature",
    teaches: "Only one card helps",
    left: ["box", "b"], right: ["a", "c"], deck: ["-a", "-b", "-c"],
  },
  {
    id: "b5", name: "Twice Over", tier: "creature",
    teaches: "Two cards to clear",
    left: ["box", "a", "b"], right: ["c"], deck: ["-a", "-b", "-c"],
  },
  {
    id: "b6", name: "The Other Side", tier: "creature",
    teaches: "The box can be on the right",
    left: ["a", "b"], right: ["box", "a"], deck: ["-a", "-b"],
  },

  // The cards become numerals. Nothing else changes.
  {
    id: "b7", name: "Numbers Now", tier: "number",
    teaches: "Same game — the cards are numbers",
    left: ["box", "a", "-a"], right: ["b", "c"], deck: [],
  },
  {
    id: "b8", name: "Balance It", tier: "number",
    teaches: "Add the same number to both sides",
    left: ["box", "b"], right: ["c", "c"], deck: ["-a", "-b", "-c"],
  },
  {
    id: "b9", name: "Both Ends", tier: "number",
    teaches: "Clear both sides if you need to",
    left: ["box", "a", "c"], right: ["b", "b", "c"], deck: ["-a", "-b", "-c"],
  },

  // And the box becomes x.
  {
    id: "b10", name: "Meet X", tier: "algebra",
    teaches: "The box has a name now: x",
    left: ["box", "a"], right: ["b", "c"], deck: ["-a", "-b", "-c"],
  },
  {
    id: "b11", name: "Real Algebra", tier: "algebra",
    teaches: "You have been doing algebra all along",
    left: ["box", "b", "c"], right: ["a", "a"], deck: ["-a", "-b", "-c"],
  },
];

export const LEVEL_COUNT = LEVELS.length;

/** The face shown on a card, per tier. */
export const LABELS = {
  creature: { a: "", b: "", c: "", d: "", e: "", f: "" },
  number: { a: "1", b: "2", c: "3", d: "4", e: "5", f: "6" },
  algebra: { a: "1", b: "2", c: "3", d: "4", e: "5", f: "6" },
};

export const BOX_LABEL = { creature: "", number: "?", algebra: "x" };
