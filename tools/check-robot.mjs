/**
 * Run every Robot Path level's reference solution through the real simulator.
 * A level that cannot be solved, or whose solution overflows its own slot
 * limits, fails the build.
 */
import { LEVELS, parseLevel } from "../src/js/games/robot/levels.js";
import { RobotSim } from "../src/js/games/robot/sim.js";

let bad = 0;
for (const def of LEVELS) {
  const lvl = parseLevel(def);
  const sim = new RobotSim(lvl);
  const issues = [];

  // The reference solution has to fit the slots the player is given.
  for (const [key, list] of Object.entries(def.solution)) {
    const cap = def.slots[key] ?? 0;
    if (list.length > cap) issues.push(`${key} uses ${list.length} slots, only ${cap} available`);
    for (const op of list) {
      if (!def.ops.includes(op)) issues.push(`${key} uses ${op}, which this level does not offer`);
    }
  }

  const res = sim.run(def.solution);
  if (!res.won) {
    issues.push(`solution lights ${res.lit}/${lvl.targets.length} targets`);
  }
  if (sim.failed) issues.push(`simulation ended: ${sim.failed}`);

  const slots = Object.entries(def.slots).map(([k, v]) => `${k}:${v}`).join(" ");
  if (issues.length) {
    bad++;
    console.log(`✗ ${def.id.padEnd(4)} ${def.name}`);
    issues.forEach((i) => console.log(`     ${i}`));
  } else {
    console.log(`✓ ${def.id.padEnd(4)} ${def.name.padEnd(20)} ${lvl.w}x${lvl.h} ` +
                `${lvl.targets.length} lamps  ${slots}  ${res.steps} steps`);
  }
}
console.log(`\n${LEVELS.length - bad}/${LEVELS.length} levels solvable.`);
process.exit(bad ? 1 : 0);
