#!/usr/bin/env python3
"""
Compose the Tilt Maze boards, and prove each one is playable before emitting it.

WHY THESE ARE GENERATED AND NOT DRAWN BY HAND.

The hand-drawn boards were 11 wide and 9 tall — near enough square. The screen
they are played on is 720x1600. Measured, the board filled 90% of the width and
33% of the height: two thirds of a portrait phone was empty background, which is
exactly what came back from the device as "we have a lot of space around, make
it bigger, the player is quite small".

Fixing that by hand means re-drawing every board taller, and a taller board has
more corridors, more dead ends and more chances to wall a letter off where
nobody notices until a child is stuck. So the shape is computed instead: a
9x17 maze fills 90% x 77% of the same screen at a 22% larger tile, and every
board is audited here, at build time, for the properties that actually matter:

  - every letter reachable from the start, IN ORDER
  - the exit reachable after the last letter
  - decoys reachable too (a decoy nobody can touch is not a decoy)
  - no hole sitting ON the only route through

Run:  python3 tools/compose-mazes.py > src/js/games/tilt-maze/levels.js
"""

import random
from collections import deque

COLS, ROWS = 9, 17          # odd, so walls fall on even coordinates
WALL, FLOOR = "#", "."


def carve(cols, rows, rng):
    """Recursive backtracker over cells at odd coordinates."""
    g = [[WALL] * cols for _ in range(rows)]
    start = (1, 1)
    g[1][1] = FLOOR
    stack = [start]
    while stack:
        c, r = stack[-1]
        nbrs = []
        for dc, dr in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            nc, nr = c + dc, r + dr
            if 1 <= nc < cols - 1 and 1 <= nr < rows - 1 and g[nr][nc] == WALL:
                nbrs.append((nc, nr, dc, dr))
        if not nbrs:
            stack.pop()
            continue
        nc, nr, dc, dr = rng.choice(nbrs)
        g[r + dr // 2][c + dc // 2] = FLOOR
        g[nr][nc] = FLOOR
        stack.append((nc, nr))
    return g


def braid(g, rng, share):
    """
    Open a proportion of dead ends into loops.

    A perfect maze is all dead ends, and a dead end is where a rolling ball
    that cannot be stopped precisely goes to die. Loops give a child who
    overshoots a way round instead of a reversal they have to steer exactly.
    """
    rows, cols = len(g), len(g[0])
    ends = []
    for r in range(1, rows - 1):
        for c in range(1, cols - 1):
            if g[r][c] != FLOOR:
                continue
            if sum(g[r + dr][c + dc] == FLOOR
                   for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1))) == 1:
                ends.append((c, r))
    rng.shuffle(ends)
    for c, r in ends[: int(len(ends) * share)]:
        walls = [(c + dc, r + dr) for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1))
                 if 0 < c + dc < cols - 1 and 0 < r + dr < rows - 1
                 and g[r + dr][c + dc] == WALL]
        if walls:
            wc, wr = rng.choice(walls)
            g[wr][wc] = FLOOR
    return g


def bfs(g, src, blocked=()):
    """Distance from `src` over floor cells, avoiding `blocked`."""
    rows, cols = len(g), len(g[0])
    dist = {src: 0}
    q = deque([src])
    while q:
        c, r = q.popleft()
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c + dc, r + dr)
            if not (0 <= n[0] < cols and 0 <= n[1] < rows):
                continue
            if g[n[1]][n[0]] == WALL or n in blocked or n in dist:
                continue
            dist[n] = dist[(c, r)] + 1
            q.append(n)
    return dist


def path_between(g, a, b):
    """One shortest route from a to b, as a list of cells."""
    dist = bfs(g, a)
    if b not in dist:
        return None
    out, cur = [b], b
    while cur != a:
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (cur[0] + dc, cur[1] + dr)
            if dist.get(n, 1 << 30) == dist[cur] - 1:
                cur = n
                out.append(cur)
                break
    return out[::-1]


def build(word, decoys, holes, mud, gems, seed, braid_share=0.35):
    """
    One board: a maze, the word's letters strung along the route in order, and
    the hazards placed where they cannot block it.
    """
    rng = random.Random(seed)
    for attempt in range(400):
        g = braid(carve(COLS, ROWS, rng), rng, braid_share)
        start = (1, 1)
        exit_ = (COLS - 2, ROWS - 2)
        if g[exit_[1]][exit_[0]] == WALL:
            continue

        route = path_between(g, start, exit_)
        if not route or len(route) < len(word) * 3:
            continue

        # Letters spread evenly along the route, in the order they are met, so
        # "collect them in order" is a journey rather than a scavenger hunt.
        n = len(word)
        picks = [route[int(len(route) * (i + 1) / (n + 1))] for i in range(n)]
        if len(set(picks)) != n or start in picks or exit_ in picks:
            continue

        used = set(picks) | {start, exit_}
        floor = [(c, r) for r in range(ROWS) for c in range(COLS)
                 if g[r][c] == FLOOR and (c, r) not in used]
        off_route = [p for p in floor if p not in set(route)]
        rng.shuffle(off_route)
        rng.shuffle(floor)

        # Decoys go OFF the route: they should tempt a child into a detour,
        # not stand between them and the next real letter.
        if len(off_route) < decoys + holes + mud + gems:
            continue
        dec = off_route[:decoys]
        rest = off_route[decoys:]
        hole = rest[:holes]
        mudc = rest[holes:holes + mud]
        gem = rest[holes + mud:holes + mud + gems]

        # A hole on the only way through is not a hazard, it is a dead stop.
        blocked = set(hole)
        d = bfs(g, start, blocked)
        if exit_ not in d or any(p not in d for p in picks + dec):
            continue

        # And each letter must be reachable from the one before it, in order,
        # which is what the game actually demands of the player.
        seq = [start] + picks + [exit_]
        if any(seq[i + 1] not in bfs(g, seq[i], blocked) for i in range(len(seq) - 1)):
            continue

        out = [row[:] for row in g]
        out[start[1]][start[0]] = "S"
        out[exit_[1]][exit_[0]] = "E"
        for i, (c, r) in enumerate(picks):
            out[r][c] = str(i + 1)
        for c, r in dec:
            out[r][c] = "x"
        for c, r in hole:
            out[r][c] = "O"
        for c, r in mudc:
            out[r][c] = "~"
        for c, r in gem:
            out[r][c] = "*"
        return "\n".join("".join(row) for row in out)

    raise SystemExit(f"could not compose a board for {word!r} in 400 attempts")


LEVELS = [
    dict(id="t1", name="First Steps", word="cat", theme="wood",
         teaches="Tilt your phone to roll the ball",
         decoys=2, holes=0, mud=0, gems=1, seed=11, braid_share=0.55),
    dict(id="t2", name="Mind the Holes", word="sun", theme="wood",
         teaches="Holes swallow the ball — go around",
         decoys=3, holes=3, mud=0, gems=1, seed=22, braid_share=0.5),
    dict(id="t3", name="The Long Way", word="frog", theme="stone",
         teaches="Collect the letters in order",
         decoys=4, holes=3, mud=0, gems=2, seed=33, braid_share=0.4),
    dict(id="t4", name="Sticky Business", word="star", theme="stone",
         teaches="Mud slows you down",
         decoys=4, holes=2, mud=5, gems=2, seed=44, braid_share=0.4),
    dict(id="t5", name="Spiral In", word="ocean", theme="ice",
         teaches="Ice is slippery — tilt gently",
         decoys=5, holes=3, mud=0, gems=2, seed=55, braid_share=0.35),
    dict(id="t6", name="The Gauntlet", word="planet", theme="ice",
         teaches="Everything at once. Steady hands!",
         decoys=6, holes=4, mud=4, gems=3, seed=66, braid_share=0.3),
]

HEADER = '''/**
 * Tilt Maze — authored boards.
 *
 * GENERATED by tools/compose-mazes.py. Edit the spec there and re-run it
 * rather than nudging tiles here: that script is what proves every letter is
 * reachable in order, that the exit is reachable after the last of them, and
 * that no hole is sitting on the only route through.
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
 *   x  decoy letter — a letter that is NOT in the word, and costs a heart
 *   1..9  letter slots — collected IN ORDER to spell the level's word
 *
 * Boards are 9 columns by 17 rows: a PORTRAIT shape, because the screen is
 * portrait. The previous near-square boards filled 90% of the width and 33%
 * of the height, leaving two thirds of the phone empty, and the tile had to
 * shrink to fit the width anyway.
 */

import { parseBoard as _p } from "./parse.js";

export const BOARDS = ['''


def emit():
    print(HEADER)
    for spec in LEVELS:
        m = build(spec["word"], spec["decoys"], spec["holes"], spec["mud"],
                  spec["gems"], spec["seed"], spec.get("braid_share", 0.35))
        print("  {")
        print(f'    id: "{spec["id"]}", name: "{spec["name"]}", '
              f'word: "{spec["word"]}", theme: "{spec["theme"]}",')
        print(f'    teaches: "{spec["teaches"]}",')
        print("    map: `")
        print(m)
        print("`,")
        print("  },")
    print("];")


if __name__ == "__main__":
    emit()
