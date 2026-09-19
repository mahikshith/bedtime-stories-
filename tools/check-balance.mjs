/** Prove every Balance level is solvable, and report the shortest solution. */
import { LEVELS } from "../src/js/games/balance/levels.js";
import { makeState, solve, isSolved } from "../src/js/games/balance/rules.js";

let bad = 0;
for (const def of LEVELS) {
  const state = makeState(def.left, def.right);
  const issues = [];
  if (isSolved(state)) issues.push("starts already solved");
  const res = solve(state, def.deck, 9);
  if (!res) issues.push("no solution within 9 moves");

  if (issues.length) {
    bad++;
    console.log(`✗ ${def.id.padEnd(4)} ${def.name}`);
    issues.forEach((i) => console.log(`     ${i}`));
  } else {
    const eq = `${def.left.join("+")} = ${def.right.join("+")}`;
    console.log(`✓ ${def.id.padEnd(4)} ${def.name.padEnd(18)} ${def.tier.padEnd(9)} ` +
                `${res.length} moves   ${eq}`);
  }
}
console.log(`\n${LEVELS.length - bad}/${LEVELS.length} levels solvable.`);
process.exit(bad ? 1 : 0);
