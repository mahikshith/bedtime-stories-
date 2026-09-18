/**
 * Word Mob — run definitions.
 *
 * A run is a sequence of gate pairs and enemy waves laid along a distance
 * axis. Gates are generated from the vocabulary bank for the child's age
 * band so the same run stays playable as they grow, but the SHAPE of each run
 * — where the gates fall, how hard the waves hit, when the boss arrives — is
 * authored, because that is what makes the pacing feel deliberate.
 *
 * Gate kinds, chosen per run so each one teaches something different:
 *   spell    which spelling is correct
 *   picture  which word matches the picture
 *   category which word belongs to the named group
 *   rhyme    which word rhymes with the prompt
 */

import { wordsForLevel, decoysFor, misspell, BANK } from "../../core/words.js";
import { shuffle, pick, randInt } from "../../core/engine.js";

export const RUNS = [
  { id: "r1", name: "First Flight", teaches: "Fly through the RIGHT gate to grow your flock",
    length: 5200, startFlock: 4, kinds: ["picture"], waves: 2, boss: false },
  { id: "r2", name: "Spelling Sprint", teaches: "Pick the correctly spelled word",
    length: 6000, startFlock: 5, kinds: ["spell", "picture"], waves: 3, boss: false },
  { id: "r3", name: "Sorting Rush", teaches: "Pick the word that fits the group",
    length: 6800, startFlock: 5, kinds: ["category", "picture"], waves: 4, boss: false },
  { id: "r4", name: "Rhyme Time", teaches: "Pick the word that rhymes",
    length: 7200, startFlock: 6, kinds: ["rhyme", "spell"], waves: 4, boss: false },
  { id: "r5", name: "The Big Flock", teaches: "Everything at once — and a boss at the end",
    length: 8600, startFlock: 6, kinds: ["spell", "picture", "category"], waves: 5, boss: true },
];

/** Simple rhyme families, enough for a pick-the-rhyme gate. */
const RHYMES = [
  ["cat", "hat", "bat", "mat"],
  ["dog", "frog", "log"],
  ["star", "car", "jar"],
  ["moon", "spoon", "balloon"],
  ["bee", "tree", "key"],
  ["cake", "lake", "snake"],
  ["sun", "run", "bun"],
  ["train", "rain", "chain"],
];

function rhymeGate(band) {
  const fam = pick(RHYMES);
  const [prompt, answer] = shuffle(fam).slice(0, 2);
  const other = pick(BANK[band] ?? BANK.mid).word;
  return {
    prompt: `RHYMES WITH "${prompt.toUpperCase()}"`,
    right: { label: answer.toUpperCase(), speak: answer },
    wrong: { label: other.toUpperCase() },
    word: answer,
  };
}

function spellGate(band, w) {
  return {
    prompt: "WHICH SPELLING IS RIGHT?",
    right: { label: w.word.toUpperCase(), speak: w.word },
    wrong: { label: misspell(w.word).toUpperCase() },
    word: w.word,
  };
}

function pictureGate(band, w) {
  const d = decoysFor(w, band, 1)[0];
  return {
    prompt: `${w.emoji}  WHICH WORD?`,
    right: { label: w.word.toUpperCase(), speak: w.word },
    wrong: { label: (d?.word ?? "thing").toUpperCase() },
    word: w.word,
  };
}

function categoryGate(band, w) {
  const bank = BANK[band] ?? BANK.mid;
  const other = pick(bank.filter((x) => x.cat !== w.cat)) ?? w;
  return {
    prompt: `WHICH IS A ${w.cat.toUpperCase()}?`,
    right: { label: w.word.toUpperCase(), speak: w.word },
    wrong: { label: other.word.toUpperCase() },
    word: w.word,
  };
}

const MAKERS = { spell: spellGate, picture: pictureGate, category: categoryGate, rhyme: rhymeGate };

/**
 * Build a playable run: gates spaced along the distance axis, enemy waves
 * between them, and a boss at the end if the run calls for one.
 */
export function buildRun(index, band = "mid") {
  const def = RUNS[Math.max(0, Math.min(RUNS.length - 1, index))];
  const words = wordsForLevel(band, index + 20, 10);

  // Gates start after a short runway so the child can find the controls, then
  // repeat on a fixed cadence. A predictable rhythm is what lets them read the
  // question instead of reacting to it.
  const gates = [];
  const first = 1100, spacing = 900;
  const count = Math.floor((def.length - first - 700) / spacing);
  for (let i = 0; i < count; i++) {
    const kind = def.kinds[i % def.kinds.length];
    const w = words[i % words.length];
    const g = (MAKERS[kind] ?? pictureGate)(band, w);
    // Reward and penalty escalate so late gates matter more.
    const grow = i < 2 ? { op: "add", value: 4 } : { op: "mul", value: 2 };
    const shrink = i < 2 ? { op: "add", value: -2 } : { op: "mul", value: 0.55 };
    const left = Math.random() < 0.5;
    const rightOpt = { ...g.right, correct: true, ...grow };
    const wrongOpt = { ...g.wrong, correct: false, ...shrink };
    gates.push({
      at: first + i * spacing,
      prompt: g.prompt,
      word: g.word,
      options: left ? [rightOpt, wrongOpt] : [wrongOpt, rightOpt],
      done: false,
    });
  }

  // Waves sit between gates so a child is never reading and dodging at once.
  const enemies = [];
  for (let i = 0; i < def.waves; i++) {
    const at = first + spacing * (i + 1) - 420;
    const n = 1 + Math.floor(i / 2);
    for (let k = 0; k < n; k++) {
      enemies.push({ at: at - k * 120, x: (k - (n - 1) / 2) * 0.5, hp: 3 + i * 2, spawned: false });
    }
  }
  if (def.boss) {
    enemies.push({ at: def.length - 500, x: 0, hp: 60, boss: true, spawned: false });
  }

  return { ...def, gates, enemies, index };
}
