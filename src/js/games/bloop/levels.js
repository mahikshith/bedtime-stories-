/**
 * The hills.
 *
 * LocoRoco's levels are not obstacle courses, they are playground equipment.
 * The research phrase that stuck was "half-pipes where you build inertia by
 * tilting to slide up the walls" — the fun is not getting past a thing, it is
 * the swoop of going down one side and up the other, and the level exists to
 * give you excuses to do it.
 *
 * So each level here is built from a small vocabulary of gestures:
 *
 *   RUN     a gentle roll to get going and learn that tilting steers
 *   DIP     a bowl you fall into and climb out of, which teaches inertia
 *   SLIDE   a long steep drop, the pure hit of speed
 *   PIPE    a deep U you can rock inside, the thing children repeat for fun
 *   LIP     a rise that throws you off the end of a slide
 *   SQUEEZE a gap only single Bloops fit through, so splitting has a point
 *
 * Fruit is placed where it rewards commitment: along the high line of a pipe,
 * over the crest of a lip, inside the squeeze. A child who plays it safe still
 * finishes; a child who swoops gets the whole flock and the fuller song.
 *
 * Coordinates are world units. Levels run left to right, with the ground
 * around y = 700 and the world floor at y = 1500.
 */

import { ground, ribbon } from "./terrain.js";

const FLOOR = 1500;

/** A row of fruit along a curve, spaced evenly. */
function trail(points, n, spread = 1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const seg = t * (points.length - 1) * spread;
    const i0 = Math.min(points.length - 2, Math.floor(seg));
    const f = seg - i0;
    out.push({
      x: points[i0][0] + (points[i0 + 1][0] - points[i0][0]) * f,
      y: points[i0][1] + (points[i0 + 1][1] - points[i0][1]) * f,
    });
  }
  return out;
}

export const LEVELS = [
  /* --------------------------------------------------------------- 1 --- */
  {
    name: "First Roll",
    teaches: "Tilt to roll",
    kind: "sun",
    start: { x: 220, y: 380 },
    goal: { x: 3050, y: 560 },
    startCount: 1,
    build() {
      const line = [
        [0, 620], [420, 700], [780, 760], [1150, 700],
        [1500, 560], [1850, 660], [2250, 740], [2650, 700], [3100, 640], [3400, 640],
      ];
      return {
        shapes: [
          { points: ground(line, FLOOR) },
          // walls, so a Bloop cannot roll out of the world
          { points: [[-120, -600], [0, -600], [0, FLOOR], [-120, FLOOR]] },
          { points: [[3400, -600], [3520, -600], [3520, FLOOR], [3400, FLOOR]] },
        ],
        fruit: [
          ...trail([[500, 640], [900, 700], [1250, 640]], 4),
          ...trail([[1600, 500], [1900, 600]], 3),
          ...trail([[2350, 680], [2750, 640]], 3),
        ],
      };
    },
  },

  /* --------------------------------------------------------------- 2 --- */
  {
    name: "The Dip",
    teaches: "Rock to climb out",
    kind: "berry",
    start: { x: 200, y: 340 },
    goal: { x: 3250, y: 470 },
    startCount: 2,
    build() {
      const line = [
        [0, 560], [380, 640], [700, 880], [1000, 1020], [1300, 1020],
        [1620, 880], [1900, 640], [2200, 560], [2500, 700], [2800, 620],
        [3100, 520], [3400, 540],
      ];
      return {
        shapes: [
          { points: ground(line, FLOOR) },
          { points: [[-120, -600], [0, -600], [0, FLOOR], [-120, FLOOR]] },
          { points: [[3400, -600], [3520, -600], [3520, FLOOR], [3400, FLOOR]] },
        ],
        // The high line of the bowl: you only reach these by building a rock.
        fruit: [
          ...trail([[760, 800], [1150, 940], [1560, 800]], 5),
          ...trail([[900, 640], [1150, 700], [1420, 640]], 3),
          ...trail([[2450, 620], [2850, 540]], 3),
        ],
      };
    },
  },

  /* --------------------------------------------------------------- 3 --- */
  {
    name: "Long Slide",
    teaches: "Speed carries you",
    kind: "sky",
    start: { x: 180, y: 220 },
    goal: { x: 3300, y: 720 },
    startCount: 3,
    build() {
      const line = [
        [0, 380], [300, 420], [620, 560], [980, 840], [1320, 1060],
        [1650, 1120], [1950, 1000], [2200, 820], [2400, 700],
        [2600, 760], [2850, 880], [3100, 820], [3400, 800],
      ];
      return {
        shapes: [
          { points: ground(line, FLOOR) },
          { points: [[-120, -600], [0, -600], [0, FLOOR], [-120, FLOOR]] },
          { points: [[3400, -600], [3520, -600], [3520, FLOOR], [3400, FLOOR]] },
          // A bar over the slide. Go under it fast and you fly the gap after.
          { points: ribbon([[1750, 700], [2100, 560], [2420, 500]], 60) },
        ],
        fruit: [
          ...trail([[420, 440], [760, 620], [1100, 880]], 6),
          ...trail([[1450, 1020], [1750, 1020]], 3),
          ...trail([[2150, 700], [2380, 600]], 3),
          ...trail([[2700, 700], [2950, 780]], 3),
        ],
      };
    },
  },

  /* --------------------------------------------------------------- 4 --- */
  {
    name: "Half Pipe",
    teaches: "Swing up the walls",
    kind: "leaf",
    start: { x: 200, y: 300 },
    goal: { x: 3280, y: 500 },
    startCount: 3,
    build() {
      const line = [
        [0, 520], [300, 600], [560, 820], [760, 1060], [900, 1160],
        [1150, 1180], [1400, 1160], [1580, 1020], [1760, 800], [1980, 640],
        [2200, 780], [2400, 980], [2650, 1040], [2900, 900], [3120, 660],
        [3400, 560],
      ];
      return {
        shapes: [
          { points: ground(line, FLOOR) },
          { points: [[-120, -600], [0, -600], [0, FLOOR], [-120, FLOOR]] },
          { points: [[3400, -600], [3520, -600], [3520, FLOOR], [3400, FLOOR]] },
        ],
        // Arcs up both walls of each pipe — the reward for rocking, not rolling.
        fruit: [
          ...trail([[620, 760], [820, 960], [1020, 1090]], 4),
          ...trail([[1280, 1090], [1500, 960], [1700, 760]], 4),
          ...trail([[2280, 820], [2480, 960]], 3),
          ...trail([[2700, 940], [2920, 800], [3120, 600]], 4),
        ],
      };
    },
  },

  /* --------------------------------------------------------------- 5 --- */
  {
    name: "Squeeze Through",
    teaches: "Split to fit",
    kind: "plum",
    start: { x: 200, y: 340 },
    goal: { x: 3260, y: 560 },
    startCount: 6,
    build() {
      const line = [
        [0, 560], [380, 680], [760, 780], [1100, 820], [1500, 820],
        [1900, 800], [2250, 740], [2600, 680], [2950, 640], [3400, 620],
      ];
      return {
        shapes: [
          { points: ground(line, FLOOR) },
          { points: [[-120, -600], [0, -600], [0, FLOOR], [-120, FLOOR]] },
          { points: [[3400, -600], [3520, -600], [3520, FLOOR], [3400, FLOOR]] },
          // The gate: a wall from above with a low gap under it. A merged
          // flock of six is too fat; six single Bloops slip through one at a
          // time, which is the whole lesson of the level.
          { points: [[1480, -600], [1620, -600], [1620, 690], [1480, 690]] },
          { points: [[2180, -600], [2320, -600], [2320, 620], [2180, 620]] },
        ],
        fruit: [
          ...trail([[500, 640], [900, 740]], 3),
          ...trail([[1700, 760], [2050, 720]], 3),
          ...trail([[2450, 680], [2800, 620]], 3),
        ],
      };
    },
  },

  /* --------------------------------------------------------------- 6 --- */
  {
    name: "Big Hills",
    teaches: "Everything at once",
    kind: "coral",
    start: { x: 180, y: 260 },
    goal: { x: 3300, y: 640 },
    startCount: 4,
    build() {
      const line = [
        [0, 420], [280, 520], [560, 800], [820, 1020], [1080, 1100],
        [1340, 1020], [1560, 800], [1760, 620], [1980, 560], [2200, 700],
        [2420, 920], [2640, 1020], [2880, 940], [3100, 760], [3400, 720],
      ];
      return {
        shapes: [
          { points: ground(line, FLOOR) },
          { points: [[-120, -600], [0, -600], [0, FLOOR], [-120, FLOOR]] },
          { points: [[3400, -600], [3520, -600], [3520, FLOOR], [3400, FLOOR]] },
          { points: ribbon([[1180, 700], [1500, 600], [1820, 420]], 56) },
          { points: [[2560, -600], [2700, -600], [2700, 860], [2560, 860]] },
        ],
        fruit: [
          ...trail([[420, 580], [700, 860], [960, 1040]], 5),
          ...trail([[1220, 1040], [1460, 860], [1680, 660]], 5),
          ...trail([[2100, 640], [2320, 840]], 3),
          ...trail([[2780, 900], [3020, 760]], 4),
        ],
      };
    },
  },
];

export const LEVEL_COUNT = LEVELS.length;

/** Build a level's geometry and pickups. */
export function loadLevel(i) {
  const def = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))];
  const built = def.build();
  return { def, ...built };
}
