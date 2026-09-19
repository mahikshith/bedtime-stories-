#!/usr/bin/env python3
"""
Huarong Dao (华容道) layout composer and solver.

The sliding-block puzzle is ranked with the Rubik's Cube among the classic
mechanical puzzles, and it is unforgiving to author: a layout that looks
reasonable can be unsolvable, or can fall open in three moves. So every
layout here is run through a breadth-first search that

  * proves the big block can actually reach the exit, and
  * reports the exact minimum number of moves,

which is what the game shows the player as par. A layout that cannot be
solved is a build error.

Board is 4 wide by 5 tall. The big 2x2 block escapes through the gap in the
middle of the bottom edge.

Layouts are written as grids, one letter per block:

    A B B C        A, C, D, F  upright generals   (1x2)
    A B B C        B           the big block      (2x2)
    D E E F        E           the flat general   (2x1)
    D G H F        G, H, I, J  soldiers           (1x1)
    I . . J        .           empty
"""

from collections import deque

W, H = 4, 5
BIG = "B"
GOAL = (1, 3)   # top-left cell of the big block when it has escaped


def parse(grid):
    rows = [r.split() if " " in r else list(r)
            for r in grid.strip().split("\n")]
    cells = {}
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            cells.setdefault(ch, []).append((x, y))
    blocks = []
    for ch, pts in sorted(cells.items()):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        x0, y0 = min(xs), min(ys)
        w = max(xs) - x0 + 1
        h = max(ys) - y0 + 1
        if w * h != len(pts):
            raise ValueError(f"block {ch} is not a rectangle")
        blocks.append({"id": ch, "x": x0, "y": y0, "w": w, "h": h})
    return blocks


def occupancy(state, blocks):
    grid = [[None] * W for _ in range(H)]
    for (x, y), b in zip(state, blocks):
        for dy in range(b["h"]):
            for dx in range(b["w"]):
                grid[y + dy][x + dx] = b["id"]
    return grid


def moves(state, blocks):
    """Every single-cell slide available from this state."""
    grid = occupancy(state, blocks)
    out = []
    for i, ((x, y), b) in enumerate(zip(state, blocks)):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx + b["w"] > W or ny + b["h"] > H:
                continue
            ok = True
            for yy in range(ny, ny + b["h"]):
                for xx in range(nx, nx + b["w"]):
                    cell = grid[yy][xx]
                    if cell is not None and cell != b["id"]:
                        ok = False; break
                if not ok: break
            if ok:
                ns = list(state); ns[i] = (nx, ny)
                out.append(tuple(ns))
    return out


def canonical(state, blocks):
    """
    Two states are the same puzzle if interchangeable blocks are swapped.
    Collapsing them keeps the search small enough to run in a build step.
    """
    key = []
    for (pos, b) in zip(state, blocks):
        kind = "big" if b["id"] == BIG else f'{b["w"]}x{b["h"]}'
        key.append((kind, pos))
    return tuple(sorted(key))


def solve(blocks, cap=400000):
    start = tuple((b["x"], b["y"]) for b in blocks)
    big = next(i for i, b in enumerate(blocks) if b["id"] == BIG)
    if start[big] == GOAL:
        return 0
    seen = {canonical(start, blocks)}
    q = deque([(start, 0)])
    while q:
        state, d = q.popleft()
        for ns in moves(state, blocks):
            if ns[big] == GOAL:
                return d + 1
            k = canonical(ns, blocks)
            if k in seen:
                continue
            seen.add(k)
            if len(seen) > cap:
                return None
            q.append((ns, d + 1))
    return None


# Ordered so par rises with the level number — a level that is easier than
# the one before it reads as a bug to the child, not as variety.
LAYOUTS = [
    # --- warm-ups: the big block and a couple of obstacles ----------------
    ("s1", "First Slide", 1, """
....
.BB.
.BB.
....
....
"""),
    ("s2", "Two Guards", 1, """
G.BB
..BB
....
H...
....
"""),
    ("s3", "The Wall", 2, """
BB.G
BB.H
IJ.K
....
....
"""),
    # --- middle: uprights start to matter ---------------------------------
    ("s4", "Narrow Pass", 2, """
ABBC
ABBC
D..F
DGHF
I..J
"""),
    ("s5", "Four Generals", 3, """
ABBC
ABBC
DEEF
D..F
G..H
"""),
    # --- the classic: Heng Dao Li Ma --------------------------------------
    ("s6", "Heng Dao Li Ma", 3, """
ABBC
ABBC
DEEF
DGHF
I..J
"""),
]


def build():
    out = []
    bad = 0
    for (pid, name, tier, grid) in LAYOUTS:
        try:
            blocks = parse(grid)
        except ValueError as e:
            print(f"✗ {pid:<4} {name:<16} {e}")
            bad += 1
            continue
        par = solve(blocks)
        if par is None:
            print(f"✗ {pid:<4} {name:<16} UNSOLVABLE")
            bad += 1
            continue
        kinds = {}
        for b in blocks:
            k = "big" if b["id"] == BIG else f'{b["w"]}x{b["h"]}'
            kinds[k] = kinds.get(k, 0) + 1
        desc = " ".join(f"{n}x{k}" for k, n in sorted(kinds.items()))
        print(f"✓ {pid:<4} {name:<16} tier {tier}  par {par:>3} moves  {desc}")
        out.append({"id": pid, "name": name, "tier": tier, "par": par, "blocks": blocks})
    print(f"\n{len(LAYOUTS) - bad}/{len(LAYOUTS)} layouts solvable.")
    return out, bad


def emit_js(levels):
    lines = [
        "/**",
        " * Huarong Dao layouts — GENERATED by tools/compose-slide.py. Do not edit.",
        " *",
        " * `par` is the true minimum number of single-cell slides, found by",
        " * breadth-first search over the whole state space, so the target shown",
        " * to the player is a fact rather than a guess.",
        " *",
        " * Board is 4 wide by 5 tall; the big block escapes through the gap in",
        " * the middle of the bottom edge.",
        " */",
        "",
        "export const BOARD_W = 4;",
        "export const BOARD_H = 5;",
        "export const EXIT = { x: 1, y: 3 };",
        "",
        "export const LAYOUTS = [",
    ]
    for lv in levels:
        lines.append("  {")
        lines.append(f'    id: "{lv["id"]}", name: "{lv["name"]}", '
                     f'tier: {lv["tier"]}, par: {lv["par"]},')
        lines.append("    blocks: [")
        for b in lv["blocks"]:
            lines.append(f'      {{ id: "{b["id"]}", x: {b["x"]}, y: {b["y"]}, '
                         f'w: {b["w"]}, h: {b["h"]} }},')
        lines.append("    ],")
        lines.append("  },")
    lines += ["];", "", "export const LAYOUT_COUNT = LAYOUTS.length;", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    levels, bad = build()
    if not bad:
        import pathlib
        pathlib.Path("src/js/games/slide/layouts.js").write_text(emit_js(levels))
        print("\nwrote src/js/games/slide/layouts.js")
