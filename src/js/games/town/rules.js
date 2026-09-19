/**
 * Tinker Town — what happens when things meet.
 *
 * This table IS the game. A sandbox with no rules is a wallpaper you can drag
 * stickers around on; a sandbox where a seed put in soil becomes a sprout, and
 * water makes the sprout a flower, is a place where a child forms a hypothesis
 * and tests it. That loop — "what if I put this there?" — is what produces the
 * long sessions, and it needs no goal, no score and no instructions.
 *
 * Every rule is written so the OUTCOME IS VISIBLE IMMEDIATELY. A reaction the
 * child cannot see is indistinguishable from a bug, and at this age a bug is
 * indistinguishable from "this game doesn't work".
 *
 * Rules are checked in order and the first match wins.
 */

import { THINGS, has } from "./things.js";

/**
 * Each rule:
 *   what   the thing being dropped
 *   onto   a thing id, a "tag:x" match, or a "fix:id" fixture
 *   when   optional (thing, target) guard, for rules that depend on state —
 *          a cup only waters a sprout once someone has filled it
 *   do     mutate the world; return a short phrase to speak, or null
 */
export const RULES = [
  /* ------------------------------------------------- growing things --- */
  {
    what: "tag:plantable", onto: "fix:soil",
    do: (world, thing) => {
      thing.thing = "sprout";
      thing.state = { planted: true, hue: Math.floor(Math.random() * 4) };
      world.burst(thing.x, thing.y, "#8A5A33");
      return "planted!";
    },
  },
  {
    // A mushroom put back in the soil makes another one. Nothing in the world
    // should be a dead end, and "I can make MORE" is the discovery that makes
    // a child put the same thing in the same place eleven times.
    what: "mushroom", onto: "fix:soil",
    do: (world, thing) => {
      world.spawn("mushroom", thing.x + 0.09, thing.y);
      world.burst(thing.x, thing.y, "#8A5A33");
      return "more mushrooms!";
    },
  },
  {
    what: "flower", onto: "fix:soil",
    do: (world, thing) => {
      thing.state = { ...thing.state, planted: true };
      world.sparkle(thing.x, thing.y);
      return "planted again!";
    },
  },
  {
    what: "can", onto: "sprout",
    do: (world, can, target) => {
      target.thing = "flower";
      target.state = { ...target.state, hue: Math.floor(Math.random() * 4) };
      world.sparkle(target.x, target.y);
      world.rain(target.x, target.y - 40);
      return "it grew a flower!";
    },
  },
  {
    // The same job done with a cup of water fetched from another room. Two
    // routes to one outcome is what makes the pocket feel like a tool rather
    // than a shelf: the child worked out that water is water.
    what: "tag:vessel", onto: "sprout", when: (t) => t.state?.full,
    do: (world, cup, target) => {
      target.thing = "flower";
      target.state = { ...target.state, hue: Math.floor(Math.random() * 4) };
      cup.state = { ...cup.state, full: false };
      world.sparkle(target.x, target.y);
      world.rain(target.x, target.y - 40);
      return "it grew a flower!";
    },
  },

  /* ------------------------------------------- carrying water about --- */
  {
    what: "tag:vessel", onto: "fix:sink",
    do: (world, vessel) => {
      vessel.state = { ...vessel.state, full: true };
      world.rain(vessel.x, vessel.y - 30);
      return "full of water!";
    },
  },
  {
    what: "tag:vessel", onto: "fix:tub",
    do: (world, vessel) => {
      vessel.state = { ...vessel.state, full: true };
      world.splash(vessel.x, vessel.y);
      return "full of water!";
    },
  },
  {
    // Fill a cup at the sink, pour it into the pot, put the pot on the stove.
    // Three steps, no instructions, and the last one says "boiling" instead of
    // "cooking" — which is the only evidence a child needs that the game was
    // paying attention to what they did two steps ago.
    what: "tag:vessel", onto: "tag:cookware", when: (t) => t.state?.full,
    do: (world, vessel, pot) => {
      vessel.state = { ...vessel.state, full: false };
      pot.state = { ...pot.state, full: true };
      world.rain(pot.x, pot.y - 30);
      return "water in the pot!";
    },
  },
  {
    what: "tag:vessel", onto: "tag:any", when: (t) => t.state?.full,
    do: (world, vessel, target) => {
      vessel.state = { ...vessel.state, full: false };
      target.state = { ...target.state, wet: true };
      world.rain(target.x, target.y - 40);
      return "all wet!";
    },
  },
  {
    // watering anything else still does something — curiosity must be rewarded
    what: "can", onto: "tag:any",
    do: (world, can, target) => {
      world.rain(target.x, target.y - 40);
      target.state = { ...target.state, wet: true };
      return null;
    },
  },
  {
    // The inverse, which is the half children enjoy most: undoing a thing you
    // just did is how you find out that you caused it.
    what: "towel", onto: "tag:any", when: (t, target) => target?.state?.wet,
    do: (world, towel, target) => {
      target.state = { ...target.state, wet: false };
      world.sparkle(target.x, target.y - 20);
      return "all dry!";
    },
  },
  {
    // Guarded on purpose: soap cleans something that is WET. Without the guard
    // a duck sitting in the bath would swallow every bar of soap dropped near
    // it and the tub would never bubble, because a thing is always tried as a
    // target before the place it is sitting in.
    what: "soap", onto: "tag:any", when: (t, target) => target?.state?.wet || target?.state?.sunk,
    do: (world, soap, target) => {
      target.state = { ...target.state, wet: false, clean: true };
      world.sparkle(target.x, target.y - 20);
      return "squeaky clean!";
    },
  },

  /* ------------------------------------------------------- cooking ---- */
  {
    what: "pot", onto: "fix:stove",
    do: (world, pot) => {
      pot.state = { ...pot.state, hot: true };
      world.fixtureActive.stove = true;
      return pot.state.full ? "the water is boiling!" : "it's cooking!";
    },
  },
  {
    what: "tag:food", onto: "pot",
    do: (world, food, pot) => {
      world.remove(food);
      pot.state = { ...pot.state, soup: true };
      world.burst(pot.x, pot.y - 20, "#FF7A45");
      return pot.state.hot ? "soup!" : "in the pot";
    },
  },
  {
    what: "egg", onto: "fix:stove",
    do: (world, egg) => {
      egg.state = { ...egg.state, cooked: true };
      world.burst(egg.x, egg.y, "#FFF3B0");
      return "a fried egg!";
    },
  },
  {
    what: "bread", onto: "fix:stove",
    do: (world, bread) => {
      bread.state = { ...bread.state, toasted: true };
      world.burst(bread.x, bread.y, "#B26714");
      return "toast!";
    },
  },

  /* --------------------------------------------------------- water ---- */
  {
    what: "soap", onto: "fix:tub",
    do: (world, soap) => {
      world.fixtureActive.tub = true;
      world.remove(soap);
      return "bubbles!";
    },
  },
  {
    // Floating and sinking, discovered rather than taught. It matters that
    // this comes before the generic splash: a stone that merely splashes
    // teaches nothing, and a stone that sinks teaches the whole idea.
    what: "tag:heavy", onto: "fix:tub",
    do: (world, thing) => {
      thing.state = { ...thing.state, sunk: true, floating: false, wet: true };
      world.splash(thing.x, thing.y);
      return "it sank!";
    },
  },
  {
    what: "tag:floats", onto: "fix:tub",
    do: (world, thing) => {
      thing.state = { ...thing.state, floating: true };
      world.splash(thing.x, thing.y);
      return "it floats!";
    },
  },
  {
    what: "tag:any", onto: "fix:tub",
    do: (world, thing) => {
      world.splash(thing.x, thing.y);
      thing.state = { ...thing.state, wet: true };
      return "splash!";
    },
  },
  {
    what: "tag:any", onto: "fix:sink",
    do: (world, thing) => {
      world.rain(thing.x, thing.y - 30);
      thing.state = { ...thing.state, wet: true };
      return "all clean!";
    },
  },

  /* ----------------------------------------------------------- noise -- */
  {
    // Two instruments together. A child who finds this plays it for minutes.
    what: "tag:instrument", onto: "tag:instrument",
    do: (world, a, b) => {
      world.playNote(THINGS[a.thing]?.note ?? 440);
      world.chord(THINGS[b.thing]?.note ?? 550);
      world.sparkle(b.x, b.y - 20);
      return "a band!";
    },
  },
  {
    // A pot is a drum. Every child works this out; the game should agree.
    what: "tag:instrument", onto: "tag:cookware",
    do: (world, inst, pot) => {
      world.playNote(220);
      world.burst(pot.x, pot.y - 20, "#FFE86B");
      return "bong!";
    },
  },
  {
    what: "ball", onto: "tag:any",
    do: (world, ball, target) => {
      ball.x = Math.min(0.94, Math.max(0.06, ball.x + (Math.random() < 0.5 ? -0.18 : 0.18)));
      world.burst(target.x, target.y - 20, "#FFE86B");
      return "boing!";
    },
  },

  /* --------------------------------------------------- birds react ---- */
  {
    what: "tag:food", onto: "bird",
    do: (world, food, bird) => {
      world.remove(food);
      bird.mood = "cheer";
      bird.moodT = 2;
      world.sparkle(bird.x, bird.y - 30);
      return "yum!";
    },
  },
  {
    what: "tag:pretty", onto: "bird",
    do: (world, flower, bird) => {
      bird.mood = "cheer";
      bird.moodT = 2.2;
      world.sparkle(bird.x, bird.y - 30);
      return "so pretty!";
    },
  },
  {
    what: "tag:instrument", onto: "bird",
    do: (world, inst, bird) => {
      bird.mood = "cheer";
      bird.moodT = 1.6;
      world.playNote(THINGS[inst.thing]?.note ?? 440);
      return null;
    },
  },
  {
    what: "tag:any", onto: "bird",
    do: (world, thing, bird) => {
      bird.mood = "cheer";
      bird.moodT = 1.2;
      return null;
    },
  },
];

/** Does `spec` describe this thing? */
function matches(spec, thing, world) {
  if (!spec) return false;
  if (spec === "tag:any") return true;
  if (spec.startsWith("tag:")) return has(thing.thing, spec.slice(4));
  if (spec === "bird") return thing.isBird;
  return thing.thing === spec;
}

/**
 * Find and apply the first rule that fits dropping `thing` onto `target`
 * (a thing, a bird, or a fixture id prefixed "fix:").
 *
 * Returns whether a rule fired SEPARATELY from what to say, because several
 * rules do something visible without having a phrase worth speaking — and the
 * caller needs to know a rule fired so it can stop looking for another target.
 *
 * @returns {{fired: boolean, phrase: string|null}}
 */
export function react(world, thing, target) {
  for (const rule of RULES) {
    if (!matches(rule.what, thing, world)) continue;

    let ok = false;
    if (rule.onto.startsWith("fix:")) {
      ok = target?.fixture === rule.onto.slice(4);
    } else if (target && !target.fixture) {
      ok = matches(rule.onto, target, world);
    }
    if (!ok) continue;
    if (rule.when && !rule.when(thing, target)) continue;

    return { fired: true, phrase: rule.do(world, thing, target) ?? null };
  }
  return { fired: false, phrase: null };
}

/**
 * Things that react with something in this scene, used to draw the gentle
 * hint glow. Open-ended play still needs a nudge toward what is possible —
 * the trick is hinting WHERE without saying WHAT, so the discovery is still
 * the child's.
 */
export function hintTargets(sceneId, thingId) {
  if (!thingId) return [];
  const out = [];
  for (const rule of RULES) {
    if (!rule.onto.startsWith("fix:")) continue;
    if (rule.what === "tag:any") continue;          // too broad to be a hint
    const isMatch = rule.what.startsWith("tag:")
      ? has(thingId, rule.what.slice(4))
      : rule.what === thingId;
    if (isMatch) out.push(rule.onto.slice(4));
  }
  return out;
}
