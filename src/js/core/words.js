/**
 * Vocabulary banks, split by age band.
 *
 * Every entry carries an emoji because a pre-reader has to be able to play:
 * the picture says what the word is, the word teaches the spelling, and the
 * syllable split drives the "stretch the word out" mechanic in Say & Jump.
 *
 *   word      what the child says / reads
 *   emoji     the picture shown on the card
 *   syl       syllable split, used for the stretch prompt (da-ad, ap-ple)
 *   hint      spoken by the mascot when the child is stuck
 *   cat       category, used by the sorting gates in Word Mob
 */

export const BANDS = {
  tiny: { id: "tiny", label: "2–5", name: "Little Sprouts", min: 2, max: 5 },
  mid: { id: "mid", label: "5–7", name: "Word Explorers", min: 5, max: 7 },
  big: { id: "big", label: "7–11", name: "Word Champions", min: 7, max: 11 },
};

const W = (word, emoji, syl, cat, hint) => ({ word, emoji, syl, cat, hint });

/* ---------------------------------------------------------------- 2–5 */
/* One syllable, concrete, nameable by a two-year-old pointing at it. */
export const TINY = [
  W("cat", "🐱", ["cat"], "animal", "It says meow!"),
  W("dog", "🐶", ["dog"], "animal", "It says woof!"),
  W("cow", "🐮", ["cow"], "animal", "It says moo!"),
  W("pig", "🐷", ["pig"], "animal", "It says oink!"),
  W("duck", "🦆", ["duck"], "animal", "It says quack!"),
  W("bee", "🐝", ["bee"], "animal", "It buzzes and makes honey."),
  W("fish", "🐟", ["fish"], "animal", "It swims in the water."),
  W("bird", "🐦", ["bird"], "animal", "It flies with wings."),
  W("frog", "🐸", ["frog"], "animal", "It hops and says ribbit!"),
  W("bear", "🐻", ["bear"], "animal", "Big and furry."),
  W("sun", "☀️", ["sun"], "sky", "It shines in the day."),
  W("moon", "🌙", ["moon"], "sky", "It shines at night."),
  W("star", "⭐", ["star"], "sky", "It twinkles up high."),
  W("rain", "🌧️", ["rain"], "sky", "Water from the clouds."),
  W("tree", "🌳", ["tree"], "nature", "It is tall and green."),
  W("flower", "🌸", ["flow", "er"], "nature", "It smells lovely."),
  W("apple", "🍎", ["ap", "ple"], "food", "A red crunchy fruit."),
  W("banana", "🍌", ["ba", "na", "na"], "food", "A long yellow fruit."),
  W("cake", "🎂", ["cake"], "food", "Sweet, for birthdays!"),
  W("milk", "🥛", ["milk"], "food", "White and cold."),
  W("egg", "🥚", ["egg"], "food", "Round with a shell."),
  W("ball", "⚽", ["ball"], "toy", "You kick it and it rolls."),
  W("car", "🚗", ["car"], "vehicle", "It goes vroom!"),
  W("bus", "🚌", ["bus"], "vehicle", "A big yellow one takes you to school."),
  W("boat", "⛵", ["boat"], "vehicle", "It floats on water."),
  W("train", "🚂", ["train"], "vehicle", "Choo choo!"),
  W("hat", "🎩", ["hat"], "clothes", "You wear it on your head."),
  W("shoe", "👟", ["shoe"], "clothes", "It goes on your foot."),
  W("book", "📕", ["book"], "thing", "It is full of stories."),
  W("drum", "🥁", ["drum"], "toy", "Bang bang bang!"),
  W("house", "🏠", ["house"], "place", "Where you live."),
  W("heart", "❤️", ["heart"], "thing", "It means love."),
];

/* ---------------------------------------------------------------- 5–7 */
/* Two syllables appear, blends and digraphs, early sight words. */
export const MID = [
  W("rocket", "🚀", ["rock", "et"], "vehicle", "It flies into space."),
  W("dragon", "🐉", ["dra", "gon"], "fantasy", "It breathes fire."),
  W("rabbit", "🐰", ["rab", "bit"], "animal", "It hops and loves carrots."),
  W("monkey", "🐵", ["mon", "key"], "animal", "It swings in trees."),
  W("tiger", "🐯", ["ti", "ger"], "animal", "Orange with black stripes."),
  W("penguin", "🐧", ["pen", "guin"], "animal", "It waddles on ice."),
  W("dolphin", "🐬", ["dol", "phin"], "animal", "A clever sea swimmer."),
  W("spider", "🕷️", ["spi", "der"], "animal", "Eight legs and a web."),
  W("castle", "🏰", ["cas", "tle"], "place", "Where a king lives."),
  W("garden", "🌻", ["gar", "den"], "place", "Where flowers grow."),
  W("bridge", "🌉", ["bridge"], "place", "It crosses over water."),
  W("mountain", "⛰️", ["moun", "tain"], "nature", "Very tall, made of rock."),
  W("river", "🏞️", ["riv", "er"], "nature", "Water that flows along."),
  W("thunder", "⛈️", ["thun", "der"], "weather", "The big boom after lightning."),
  W("rainbow", "🌈", ["rain", "bow"], "weather", "Seven colours in the sky."),
  W("snowman", "⛄", ["snow", "man"], "weather", "Built from snowballs."),
  W("pencil", "✏️", ["pen", "cil"], "school", "You write with it."),
  W("teacher", "🧑‍🏫", ["teach", "er"], "school", "They help you learn."),
  W("number", "🔢", ["num", "ber"], "school", "1, 2, 3 are these."),
  W("music", "🎵", ["mu", "sic"], "art", "You listen and dance."),
  W("guitar", "🎸", ["gui", "tar"], "art", "It has six strings."),
  W("pizza", "🍕", ["piz", "za"], "food", "Round, with cheese on top."),
  W("cookie", "🍪", ["cook", "ie"], "food", "Sweet and crunchy."),
  W("carrot", "🥕", ["car", "rot"], "food", "Orange, rabbits love it."),
  W("cheese", "🧀", ["cheese"], "food", "Yellow, mice love it."),
  W("window", "🪟", ["win", "dow"], "house", "You look outside through it."),
  W("candle", "🕯️", ["can", "dle"], "house", "It gives a small light."),
  W("bicycle", "🚲", ["bi", "cy", "cle"], "vehicle", "Two wheels and pedals."),
  W("helmet", "🪖", ["hel", "met"], "clothes", "It keeps your head safe."),
  W("treasure", "💎", ["treas", "ure"], "fantasy", "Gold and jewels in a chest."),
  W("planet", "🪐", ["plan", "et"], "space", "Earth is one of these."),
  W("robot", "🤖", ["ro", "bot"], "thing", "A machine that moves."),
];

/* --------------------------------------------------------------- 7–11 */
/* Longer words, trickier spellings, words worth actually learning. */
export const BIG = [
  W("elephant", "🐘", ["el", "e", "phant"], "animal", "The biggest land animal."),
  W("butterfly", "🦋", ["but", "ter", "fly"], "animal", "It was once a caterpillar."),
  W("crocodile", "🐊", ["croc", "o", "dile"], "animal", "Big jaws, lives in rivers."),
  W("kangaroo", "🦘", ["kan", "ga", "roo"], "animal", "It hops and has a pouch."),
  W("octopus", "🐙", ["oc", "to", "pus"], "animal", "Eight arms, very clever."),
  W("dinosaur", "🦕", ["di", "no", "saur"], "animal", "It lived long, long ago."),
  W("volcano", "🌋", ["vol", "ca", "no"], "nature", "A mountain that erupts."),
  W("waterfall", "💦", ["wa", "ter", "fall"], "nature", "A river falling off a cliff."),
  W("telescope", "🔭", ["tel", "e", "scope"], "science", "It makes far things look close."),
  W("microscope", "🔬", ["mi", "cro", "scope"], "science", "It makes tiny things look big."),
  W("astronaut", "👩‍🚀", ["as", "tro", "naut"], "space", "A person who travels in space."),
  W("galaxy", "🌌", ["gal", "ax", "y"], "space", "Billions of stars together."),
  W("satellite", "🛰️", ["sat", "el", "lite"], "space", "It orbits around a planet."),
  W("adventure", "🗺️", ["ad", "ven", "ture"], "idea", "An exciting journey."),
  W("courage", "🦁", ["cour", "age"], "idea", "Being brave when it is hard."),
  W("curious", "🧐", ["cu", "ri", "ous"], "idea", "Wanting to find things out."),
  W("generous", "🎁", ["gen", "er", "ous"], "idea", "Happy to share what you have."),
  W("enormous", "🐋", ["e", "nor", "mous"], "idea", "Very, very big."),
  W("delicious", "😋", ["de", "li", "cious"], "idea", "Tasting really good."),
  W("magnificent", "🏔️", ["mag", "nif", "i", "cent"], "idea", "Grand and impressive."),
  W("library", "📚", ["li", "brar", "y"], "place", "Where books are kept."),
  W("hospital", "🏥", ["hos", "pi", "tal"], "place", "Where doctors help people."),
  W("orchestra", "🎻", ["or", "ches", "tra"], "art", "Many musicians playing together."),
  W("triangle", "🔺", ["tri", "an", "gle"], "maths", "A shape with three sides."),
  W("pyramid", "🔻", ["pyr", "a", "mid"], "maths", "Ancient Egypt built these."),
  W("chocolate", "🍫", ["choc", "o", "late"], "food", "Sweet and brown."),
  W("pineapple", "🍍", ["pine", "ap", "ple"], "food", "Spiky outside, sweet inside."),
  W("umbrella", "☂️", ["um", "brel", "la"], "thing", "It keeps the rain off."),
  W("computer", "💻", ["com", "pu", "ter"], "thing", "A machine that runs programs."),
  W("lighthouse", "🗼", ["light", "house"], "place", "It warns ships at night."),
  W("compass", "🧭", ["com", "pass"], "thing", "It always points north."),
  W("skeleton", "💀", ["skel", "e", "ton"], "science", "All the bones in a body."),
];

export const BANK = { tiny: TINY, mid: MID, big: BIG };

/** All the categories present in a band, for the sorting gates. */
export function categoriesFor(bandId) {
  return [...new Set(BANK[bandId].map((w) => w.cat))];
}

/** A word list for a level: deterministic per (band, level) so a level replays the same. */
export function wordsForLevel(bandId, level, count = 6) {
  const bank = BANK[bandId] ?? MID;
  const out = [];
  // Simple LCG seeded by level so progression feels designed, not random.
  let seed = (level * 2654435761) >>> 0;
  const next = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const pool = bank.slice();
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
  }
  return out;
}

/** The stretched form shown as the prompt: "daaaad", "ap-ple". */
export function stretched(word) {
  // Stretch the first vowel run — that is what a child naturally holds.
  return word.replace(/([aeiou])/i, (m) => m + m + m);
}

/** A set of wrong answers that look plausible next to `word`. */
export function decoysFor(word, bandId, n = 1) {
  const bank = BANK[bandId] ?? MID;
  const same = bank.filter((w) => w.cat === word.cat && w.word !== word.word);
  const other = bank.filter((w) => w.cat !== word.cat);
  const pool = (same.length >= n ? same : same.concat(other));
  const out = [];
  const used = new Set();
  while (out.length < n && used.size < pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(pool[i]);
  }
  return out;
}

/** Misspell a word plausibly — used by the spelling gates in Word Mob. */
export function misspell(word) {
  const swaps = [
    [/ph/, "f"], [/ck/, "k"], [/ee/, "ea"], [/ea/, "ee"], [/oo/, "u"],
    [/tion/, "shun"], [/le$/, "el"], [/ai/, "ay"], [/ou/, "o"], [/y$/, "ie"],
  ];
  for (const [re, to] of swaps) if (re.test(word)) return word.replace(re, to);
  // Fall back to doubling or dropping a consonant.
  const i = Math.max(1, Math.floor(word.length / 2));
  return word.slice(0, i) + word[i] + word.slice(i);
}
