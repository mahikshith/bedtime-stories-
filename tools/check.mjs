/** Audit every authored level for reachability and required markers. */
import { LEVELS, loadLevel } from "../src/js/games/say-jump/levels.js";
import { auditMap } from "../src/js/core/tilemap.js";
import { solveJump } from "../src/js/core/physics.js";

// The strongest jump a full-charge shout produces, minus a safety margin so
// a level never depends on a perfect performance.
const MAX = solveJump(260, 560);
let bad = 0;

for (let i = 0; i < LEVELS.length; i++) {
  const lvl = loadLevel(i);
  const issues = auditMap(lvl, { maxJumpDistance: 520, maxJumpApex: 250 });
  const stats = `${lvl.platforms.length}p ${lvl.hazards.length}h ${lvl.pickups.length}★ ${lvl.cols}x${lvl.rows}`;
  if (issues.length) {
    bad++;
    console.log(`✗ ${lvl.id.padEnd(3)} ${lvl.name.padEnd(18)} ${stats}`);
    issues.forEach((s) => console.log(`     ${s}`));
  } else {
    console.log(`✓ ${lvl.id.padEnd(3)} ${lvl.name.padEnd(18)} ${stats}`);
  }
}
// The REAL reach: `vx` is now drag-compensated, so vx*airtime overstates it
// by exactly the drag loss the flight gives back.
const reach = MAX.vx * MAX.airtime - 0.5 * 320 * MAX.airtime * MAX.airtime;
console.log(`\n${LEVELS.length - bad}/${LEVELS.length} levels pass. Max jump: ${Math.round(reach)}px forward.`);
process.exit(bad ? 1 : 0);
