/**
 * Robot Path — levels.
 *
 * Maps are drawn as a grid, one character per cell:
 *
 *   .         no tile (a hole the robot cannot enter)
 *   0 1 2 3   plain tile at that height
 *   a b c d   TARGET tile at height 0 1 2 3
 *
 * Each level names the instructions it offers and how many program slots it
 * has. The slot limits are the actual difficulty curve: level 6 cannot be
 * brute-forced because main is four slots long, so the child has to notice the
 * repeating pattern and put it in a procedure. That is the moment the game
 * stops being about walking and starts being about abstraction.
 *
 * Every level carries a reference `solution`. tools/check-robot.mjs runs each
 * one through the real simulator and asserts the level is won, so an
 * unsolvable level breaks the build.
 */

export const LEVELS = [
  {
    id: "r1", name: "Switch It On", teaches: "Tap a block to add it, then press PLAY",
    map: ["000a"], start: { x: 0, y: 0, dir: 0 },
    ops: ["FWD", "LIGHT"], slots: { main: 6 },
    solution: { main: ["FWD", "FWD", "FWD", "LIGHT"] },
  },
  {
    id: "r2", name: "Round the Corner", teaches: "Turn left and right",
    map: ["0000", "...0", "...a"], start: { x: 0, y: 0, dir: 0 },
    ops: ["FWD", "LEFT", "RIGHT", "LIGHT"], slots: { main: 8 },
    solution: { main: ["FWD", "FWD", "FWD", "RIGHT", "FWD", "FWD", "LIGHT"] },
  },
  {
    id: "r3", name: "Step Up", teaches: "JUMP climbs one step",
    map: ["001b"], start: { x: 0, y: 0, dir: 0 },
    ops: ["FWD", "JUMP", "LIGHT"], slots: { main: 8 },
    solution: { main: ["FWD", "JUMP", "FWD", "LIGHT"] },
  },
  {
    id: "r4", name: "Three Lamps", teaches: "Light every tile",
    map: ["a0a0a"], start: { x: 0, y: 0, dir: 0 },
    ops: ["FWD", "LIGHT"], slots: { main: 10 },
    solution: { main: ["LIGHT", "FWD", "FWD", "LIGHT", "FWD", "FWD", "LIGHT"] },
  },
  {
    id: "r5", name: "The Staircase", teaches: "Climb, then light the top",
    map: ["0123d"], start: { x: 0, y: 0, dir: 0 },
    ops: ["FWD", "JUMP", "LIGHT"], slots: { main: 8 },
    solution: { main: ["JUMP", "JUMP", "JUMP", "FWD", "LIGHT"] },
  },
  {
    id: "r6", name: "Not Enough Room", teaches: "Put the repeat in P1",
    map: ["a0a0a0a0"], start: { x: 0, y: 0, dir: 0 },
    ops: ["FWD", "LIGHT", "P1"], slots: { main: 4, p1: 3 },
    solution: { main: ["P1", "P1", "P1", "P1"], p1: ["LIGHT", "FWD", "FWD"] },
  },
  {
    id: "r7", name: "Forever Loop", teaches: "P1 can call itself",
    map: ["a0a0a0a0a0"], start: { x: 0, y: 0, dir: 0 },
    ops: ["FWD", "LIGHT", "P1"], slots: { main: 2, p1: 4 },
    solution: { main: ["P1"], p1: ["LIGHT", "FWD", "FWD", "P1"] },
  },
  {
    id: "r8", name: "Around the Block", teaches: "A loop that turns",
    map: ["aa0", "0.0", "0aa"], start: { x: 0, y: 0, dir: 0 },
    ops: ["FWD", "LEFT", "RIGHT", "LIGHT", "P1"], slots: { main: 8, p1: 2 },
    solution: {
      main: ["LIGHT", "P1", "FWD", "RIGHT", "FWD", "P1", "RIGHT", "P1"],
      p1: ["FWD", "LIGHT"],
    },
  },
  {
    id: "r9", name: "Up and Over", teaches: "Mix climbing with turning",
    map: ["0012", "...c", "...1", "...b"], start: { x: 0, y: 0, dir: 0 },
    ops: ["FWD", "JUMP", "LEFT", "RIGHT", "LIGHT"], slots: { main: 12 },
    solution: {
      main: ["FWD", "JUMP", "JUMP", "RIGHT", "FWD", "LIGHT", "JUMP", "FWD", "LIGHT"],
    },
  },
  {
    id: "r10", name: "Three Floors", teaches: "Climb once, then loop",
    map: ["01b", "..1", "..b", "..1", "..b"], start: { x: 0, y: 0, dir: 0 },
    ops: ["FWD", "JUMP", "LEFT", "RIGHT", "LIGHT", "P1"], slots: { main: 6, p1: 3 },
    solution: {
      main: ["JUMP", "FWD", "LIGHT", "RIGHT", "P1", "P1"],
      p1: ["FWD", "FWD", "LIGHT"],
    },
  },
];

const HEIGHT_OF = { a: 0, b: 1, c: 2, d: 3 };

/** Parse a level's map into the shape the simulator wants. */
export function parseLevel(def) {
  const rows = def.map;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const heights = new Array(w * h).fill(null);
  const targets = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? ".";
      if (ch === ".") continue;
      if (ch in HEIGHT_OF) {
        heights[y * w + x] = HEIGHT_OF[ch];
        targets.push({ x, y });
      } else {
        heights[y * w + x] = Number(ch);
      }
    }
  }
  return { ...def, w, h, heights, targets };
}

export const LEVEL_COUNT = LEVELS.length;
