/**
 * Tilt Maze — authored boards.
 *
 * Top-down mazes, sized so the WHOLE board is on screen at once. No camera
 * scrolling: a child tilting a phone cannot also track a moving viewport, and
 * a maze you can only see part of is a memory test rather than a motor-skill
 * one.
 *
 * Legend
 *   #  wall          .  floor
 *   S  start         E  exit (opens once every letter is collected, in order)
 *   O  hole          ~  sticky mud (slows the ball)
 *   *  gem (optional bonus)
 *   1..9  letter slots — collected IN ORDER to spell the level's word
 *
 * Boards are 11 columns wide so they fill a portrait screen at a readable
 * tile size. Height varies; taller boards are harder to steer across.
 */

export const BOARDS = [
  {
    id: "t1", name: "First Steps", word: "cat", theme: "wood",
    teaches: "Tilt your phone to roll the ball",
    map: `
###########
#S...#....#
#.##.#.##.#
#.#1.....##
#.#.###.#.#
#....#2...#
#.##.#.##.#
#..3....#E#
###########`,
  },
  {
    id: "t2", name: "Mind the Holes", word: "sun", theme: "wood",
    teaches: "Holes swallow the ball — go around",
    map: `
###########
#S..O.....#
#.###.###.#
#.1.....O.#
#.#.###.#.#
#O..2#....#
#.##.#.##.#
#....#.3#E#
###########`,
  },
  {
    id: "t3", name: "The Long Way", word: "frog", theme: "stone",
    teaches: "Collect the letters in order",
    map: `
###########
#S...#...1#
#.##.#.##.#
#.#..O..#.#
#.#.###.#.#
#2..O#..O.#
#.##.#.##.#
#..#...3#.#
#.##.###..#
#4.....#E.#
###########`,
  },
  {
    id: "t4", name: "Sticky Business", word: "star", theme: "stone",
    teaches: "Mud slows you down",
    map: `
###########
#S..~~....#
#.##~~##1.#
#....O....#
#.#.###.#.#
#2~~.#..O.#
#.##~~##.##
#..3..~~4E#
###########`,
  },
  {
    id: "t5", name: "Spiral In", word: "ocean", theme: "ice",
    teaches: "Ice is slippery — tilt gently",
    map: `
###########
#S........#
#.#######1#
#.#2....#.#
#.#.###.#.#
#.#.#E#.#.#
#.#.#3#.#.#
#.#...#.#.#
#.#####4#.#
#........5#
###########`,
  },
  {
    id: "t6", name: "The Gauntlet", word: "planet", theme: "ice",
    teaches: "Everything at once. Steady hands!",
    map: `
###########
#S.O..~~.1#
#.##.###..#
#..2.#.O#.#
#O#.###.#.#
#..~~#3...#
#.##.#.##O#
#4.....#5.#
#.###.##..#
#..O.#..6E#
###########`,
  },
];

export const BOARD_COUNT = BOARDS.length;

/** Tile kinds after parsing. */
export const T = { FLOOR: 0, WALL: 1, HOLE: 2, MUD: 3, EXIT: 4 };

/**
 * Parse a board into a grid plus the objects on it.
 * Letters are returned in collection order, each carrying the letter of the
 * level's word it stands for.
 */
export function parseBoard(def) {
  const rows = def.map.replace(/^\n+|\n+$/g, "").split("\n");
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const grid = Array.from({ length: h }, () => new Array(w).fill(T.WALL));
  const letters = [];
  const gems = [];
  let start = { c: 1, r: 1 };
  let exit = { c: w - 2, r: h - 2 };

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c] ?? "#";
      if (ch === "#") { grid[r][c] = T.WALL; continue; }
      grid[r][c] = T.FLOOR;
      if (ch === "O") grid[r][c] = T.HOLE;
      else if (ch === "~") grid[r][c] = T.MUD;
      else if (ch === "S") start = { c, r };
      else if (ch === "E") { exit = { c, r }; grid[r][c] = T.EXIT; }
      else if (ch === "*") gems.push({ c, r, taken: false });
      else if (ch >= "1" && ch <= "9") letters.push({ order: +ch, c, r, taken: false });
    }
  }
  letters.sort((a, b) => a.order - b.order);
  // Map each slot to a letter of the word; extra slots wrap.
  const word = def.word.toUpperCase();
  letters.forEach((l, i) => { l.ch = word[i % word.length]; });

  return { ...def, grid, cols: w, rows: h, letters, gems, start, exit, word };
}

/**
 * Check a board is solvable: every letter, and the exit, reachable from the
 * start without crossing a wall. Holes are passable for this test because the
 * ball can be steered around them within a tile.
 */
export function auditBoard(b) {
  const issues = [];
  const seen = new Set();
  const key = (c, r) => r * b.cols + c;
  const q = [[b.start.c, b.start.r]];
  seen.add(key(b.start.c, b.start.r));
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= b.cols || nr >= b.rows) continue;
      if (b.grid[nr][nc] === T.WALL) continue;
      if (seen.has(key(nc, nr))) continue;
      seen.add(key(nc, nr));
      q.push([nc, nr]);
    }
  }
  for (const l of b.letters) {
    if (!seen.has(key(l.c, l.r))) issues.push(`letter ${l.order} at ${l.c},${l.r} is walled off`);
  }
  if (!seen.has(key(b.exit.c, b.exit.r))) issues.push("exit is walled off");
  if (b.letters.length < 2) issues.push("needs at least two letters");
  return issues;
}
