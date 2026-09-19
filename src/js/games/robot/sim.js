/**
 * Robot Path — the simulation, kept separate from the game so the build can
 * run it headlessly.
 *
 * Every level ships a reference solution; tools/check-robot.mjs runs each one
 * through this exact simulator and asserts the level is won. A level that
 * cannot be solved within its slot limits fails the build rather than a child.
 *
 * The world is a height grid. The robot occupies a cell, faces one of four
 * directions, and executes a program of instructions:
 *
 *   FWD    step forward if the next cell is the SAME height
 *   JUMP   step forward up exactly one, or down any distance
 *   LEFT   turn anticlockwise      RIGHT  turn clockwise
 *   LIGHT  switch on the tile underneath, if it is a target tile
 *   P1/P2  call a procedure
 *
 * The distinction between FWD and JUMP is what makes the height grid teach
 * something: the child has to read the terrain and pick the right instruction,
 * rather than mashing one button.
 */

export const OPS = ["FWD", "JUMP", "LEFT", "RIGHT", "LIGHT", "P1", "P2"];

/** Facing: 0 = +x (east), 1 = +y (south), 2 = -x, 3 = -y. Screen-isometric. */
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** Guards against a recursive procedure that never terminates. */
const MAX_STEPS = 600;
const MAX_DEPTH = 40;

export class RobotSim {
  /**
   * @param {object} level  {w, h, heights, targets, start:{x,y,dir}}
   */
  constructor(level) {
    this.level = level;
    this.reset();
  }

  reset() {
    const L = this.level;
    this.x = L.start.x;
    this.y = L.start.y;
    this.dir = L.start.dir ?? 0;
    this.lit = new Set();
    this.steps = 0;
    this.done = false;
    this.failed = null;   // 'fell' | 'blocked' | 'runaway'
  }

  heightAt(x, y) {
    const L = this.level;
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) return null;
    return L.heights[y * L.w + x];
  }

  isTarget(x, y) {
    return this.level.targets.some((t) => t.x === x && t.y === y);
  }

  get won() {
    return this.level.targets.every((t) => this.lit.has(`${t.x},${t.y}`));
  }

  /**
   * Flatten a program into a linear instruction list by expanding procedure
   * calls. Returning a flat trace lets the game animate one step at a time and
   * highlight exactly which slot is running.
   *
   * @param {object} program {main: string[], p1: string[], p2: string[]}
   * @returns {Array<{op: string, from: string, index: number}>}
   */
  flatten(program) {
    const out = [];
    const walk = (list, name, depth) => {
      if (depth > MAX_DEPTH || out.length > MAX_STEPS) return;
      list.forEach((op, i) => {
        if (out.length > MAX_STEPS) return;
        if (op === "P1") return walk(program.p1 ?? [], "p1", depth + 1);
        if (op === "P2") return walk(program.p2 ?? [], "p2", depth + 1);
        if (!op) return;
        out.push({ op, from: name, index: i });
      });
    };
    walk(program.main ?? [], "main", 0);
    return out;
  }

  /** Apply one instruction. Returns a description of what happened. */
  exec(op) {
    this.steps++;
    if (this.steps > MAX_STEPS) { this.failed = "runaway"; this.done = true; return { kind: "runaway" }; }

    switch (op) {
      case "LEFT":
        this.dir = (this.dir + 3) % 4;
        return { kind: "turn" };
      case "RIGHT":
        this.dir = (this.dir + 1) % 4;
        return { kind: "turn" };
      case "LIGHT": {
        if (this.isTarget(this.x, this.y)) {
          const k = `${this.x},${this.y}`;
          const already = this.lit.has(k);
          // Deliberately idempotent rather than a toggle. A toggle turns a
          // looping program into a trap where the last repetition switches off
          // what the previous one lit, which is a cruel thing to debug at six.
          this.lit.add(k);
          return { kind: already ? "relight" : "light" };
        }
        // Lighting a plain tile is a no-op, not a failure: experimenting is
        // how a child finds out what the instruction does.
        return { kind: "nolight" };
      }
      case "FWD":
      case "JUMP": {
        const [dx, dy] = DIRS[this.dir];
        const nx = this.x + dx, ny = this.y + dy;
        const here = this.heightAt(this.x, this.y);
        const there = this.heightAt(nx, ny);
        if (there === null) {
          // Walking off the edge is a soft stop, not a death.
          return { kind: "blocked" };
        }
        if (op === "FWD") {
          if (there !== here) return { kind: "blocked" };
        } else {
          const up = there - here;
          if (up > 1) return { kind: "blocked" };   // too high to climb
        }
        this.x = nx; this.y = ny;
        return { kind: "move", drop: here - there };
      }
      default:
        return { kind: "noop" };
    }
  }

  /**
   * Run a whole program headlessly.
   * @returns {{won: boolean, steps: number, lit: number, trace: Array}}
   */
  run(program) {
    this.reset();
    const trace = this.flatten(program);
    for (const step of trace) {
      this.exec(step.op);
      if (this.failed) break;
    }
    return { won: this.won, steps: this.steps, lit: this.lit.size, trace };
  }
}

/** Screen position of a grid cell in the isometric projection. */
export function isoPos(x, y, z, tile, lift) {
  return {
    x: (x - y) * tile * 0.5,
    y: (x + y) * tile * 0.25 - z * lift,
  };
}

export { DIRS };
