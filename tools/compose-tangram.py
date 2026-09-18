#!/usr/bin/env python3
"""
Tangram puzzle composer.

Authoring tangram figures by hand is where this kind of game usually goes
wrong: a single piece a quarter-unit out of place makes a puzzle that looks
right and cannot be solved. So figures are authored as TARGET POLYGONS on an
integer lattice, and this tool works out the placement (translation, rotation,
mirror) for each piece by matching it against the canonical shapes.

It then verifies, per puzzle:
  * every target polygon is genuinely one of the seven tangram pieces
  * the multiset of pieces used is a subset of the real tangram set
  * no two pieces overlap (checked by rasterising, not by trusting the maths)
  * the placed area equals the sum of the piece areas

Anything that fails is a build error, not a puzzle a child gets stuck on.

The canonical dissection, on a 4x4 square, puts every vertex on an integer
lattice point — which is what makes authoring figures tractable at all.
"""

import math
from collections import Counter

# ---------------------------------------------------------------- pieces --
# Local outlines, centred on each piece's centroid.

def centroid(poly):
    a = 0.0; cx = 0.0; cy = 0.0
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % n]
        cr = x0 * y1 - x1 * y0
        a += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr
    a *= 0.5
    return (cx / (6 * a), cy / (6 * a))

def area(poly):
    a = 0.0
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % n]
        a += x0 * y1 - x1 * y0
    return abs(a) * 0.5

def recentre(poly):
    cx, cy = centroid(poly)
    return [(x - cx, y - cy) for (x, y) in poly]

# The canonical 4x4 dissection.
#
# The two large triangles take the upper-left half of the square, split by the
# median from (0,4) to the centre. The remaining half holds the other five.
# (An earlier arrangement here left a unit-area hole beside the square piece;
# the overlap check in verify() is what caught it.)
CANON = {
    "LT1": [(0, 0), (2, 2), (0, 4)],          # large triangle
    "LT2": [(2, 2), (4, 4), (0, 4)],          # large triangle
    "ST1": [(0, 0), (2, 0), (1, 1)],          # small triangle
    "SQ":  [(1, 1), (2, 0), (3, 1), (2, 2)],  # square
    "MT":  [(2, 0), (4, 0), (4, 2)],          # medium triangle
    "ST2": [(2, 2), (3, 3), (3, 1)],          # small triangle
    "PA":  [(3, 3), (4, 4), (4, 2), (3, 1)],  # parallelogram
}

# Piece TYPES (what the player picks up), with how many of each exist.
PIECES = {
    "large": {"poly": recentre(CANON["LT1"]), "count": 2, "flip": False},
    "medium": {"poly": recentre(CANON["MT"]), "count": 1, "flip": False},
    "small": {"poly": recentre(CANON["ST1"]), "count": 2, "flip": False},
    "square": {"poly": recentre(CANON["SQ"]), "count": 1, "flip": False},
    # The parallelogram is chiral: it cannot be rotated onto its mirror, so it
    # is the one piece a player may need to flip over.
    "para": {"poly": recentre(CANON["PA"]), "count": 1, "flip": True},
}

TOTAL_AREA = sum(area(p["poly"]) * p["count"] for p in PIECES.values())
assert abs(TOTAL_AREA - 16) < 1e-6, TOTAL_AREA

ROTS = [i * 45 for i in range(8)]

def transform(poly, deg, mirror, dx, dy):
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    out = []
    for (x, y) in poly:
        if mirror: x = -x
        out.append((x * c - y * s + dx, x * s + y * c + dy))
    return out

def same_shape(a, b, eps=1e-6):
    """Vertex sets equal, ignoring order and starting point."""
    if len(a) != len(b): return False
    rem = list(b)
    for p in a:
        hit = None
        for i, q in enumerate(rem):
            if abs(p[0] - q[0]) < eps and abs(p[1] - q[1]) < eps:
                hit = i; break
        if hit is None: return False
        rem.pop(hit)
    return True

def solve(target):
    """Find (type, rot, mirror, x, y) whose transformed outline equals target."""
    tc = centroid(target)
    ta = area(target)
    for name, spec in PIECES.items():
        if abs(area(spec["poly"]) - ta) > 1e-6: continue
        mirrors = [False, True] if spec["flip"] else [False]
        for mirror in mirrors:
            for deg in ROTS:
                cand = transform(spec["poly"], deg, mirror, tc[0], tc[1])
                if same_shape(cand, target):
                    return {"type": name, "rot": deg, "flip": mirror,
                            "x": round(tc[0], 6), "y": round(tc[1], 6)}
    return None

# ------------------------------------------------------------- verifying --

def point_in(poly, px, py):
    inside = False
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % n]
        if (y0 > py) != (y1 > py):
            xi = (x1 - x0) * (py - y0) / (y1 - y0) + x0
            if px < xi: inside = not inside
    return inside

def verify(name, targets, placements):
    """Rasterise and confirm the pieces tile without overlapping."""
    issues = []
    used = Counter(p["type"] for p in placements)
    for t, n in used.items():
        if n > PIECES[t]["count"]:
            issues.append(f"uses {n}x {t}, only {PIECES[t]['count']} exist")

    xs = [x for poly in targets for (x, y) in poly]
    ys = [y for poly in targets for (x, y) in poly]
    want = sum(area(p) for p in targets)
    # Scale the grid to the figure so small figures aren't judged on a handful
    # of samples, and nudge it off the lattice: sample points landing exactly
    # on a shared diagonal edge get counted by both neighbours or by neither,
    # which reads as overlap in one figure and a hole in the next.
    step = min(0.08, max(0.02, (want ** 0.5) / 60))
    jitter = 0.013717
    covered = 0
    overlap = 0
    x = min(xs) + step / 2 + jitter
    while x < max(xs):
        y = min(ys) + step / 2 + jitter
        while y < max(ys):
            hits = sum(1 for poly in targets if point_in(poly, x, y))
            if hits: covered += 1
            if hits > 1: overlap += 1
            y += step
        x += step
    cell = step * step
    if overlap * cell > 0.02 * want:
        issues.append(f"pieces overlap (~{overlap * cell:.2f} of {want:.2f} sq units)")
    if abs(covered * cell - want) > 0.04 * want:
        issues.append(f"covered area {covered * cell:.2f} != piece area {want:.2f}")
    return issues

# ---------------------------------------------------------------- figures --
# Each figure is a list of target polygons on the integer lattice. On that
# lattice the pieces have fixed signatures, which is what keeps authoring
# honest:
#   small  legs sqrt2 (diagonal), hypotenuse 2 (axis-aligned)
#   medium legs 2 (axis-aligned), hypotenuse 2*sqrt2
#   large  legs 2*sqrt2 (diagonal), hypotenuse 4
#   square diamond with diagonal 2
#   para   sides sqrt2 and 2

FIGURES = [
    # ---- tier 1: two or three pieces, internal outlines shown -------------
    ("diamond", "Diamond", 1, [
        [(1, 0), (2, 1), (0, 1)],
        [(2, 1), (1, 2), (0, 1)],
    ]),
    ("triangle", "Triangle", 1, [
        [(0, 0), (2, 0), (1, 1)],
        [(0, 0), (1, 1), (0, 2)],
    ]),
    ("bigsquare", "Big Square", 1, [
        [(0, 0), (2, 0), (0, 2)],
        [(2, 0), (2, 2), (1, 1)],
        [(2, 2), (0, 2), (1, 1)],
    ]),

    # ---- tier 2: two to five pieces, outlines fade ------------------------
    ("bigtri", "Big Triangle", 2, [
        [(0, 0), (4, 0), (2, 2)],
        [(0, 0), (2, 2), (0, 4)],
    ]),
    ("bowtie", "Bow Tie", 2, [
        [(0, 0), (4, 0), (2, 2)],
        [(0, 4), (4, 4), (2, 2)],
    ]),
    ("rect", "Long Brick", 2, [
        [(0, 0), (4, 0), (2, 2)],
        [(0, 0), (2, 2), (0, 2)],
        [(4, 0), (4, 2), (3, 1)],
        [(4, 2), (2, 2), (3, 1)],
    ]),
    ("boat", "Sail Boat", 2, [
        [(0, 4), (2, 4), (0, 6)],
        [(0, 0), (4, 0), (2, 2)],
        [(0, 2), (2, 2), (1, 3)],
        [(2, 2), (2, 4), (1, 3)],
    ]),
    ("house", "Little House", 2, [
        [(0, 2), (4, 2), (2, 4)],
        [(0, 0), (4, 0), (2, 2)],
        [(0, 0), (2, 2), (0, 2)],
        [(4, 0), (4, 2), (3, 1)],
        [(4, 2), (2, 2), (3, 1)],
    ]),

    # ---- tier 3: the full seven, silhouette only --------------------------
    ("classic", "The Square", 3, [
        [(0, 0), (2, 2), (0, 4)],
        [(2, 2), (4, 4), (0, 4)],
        [(0, 0), (2, 0), (1, 1)],
        [(1, 1), (2, 0), (3, 1), (2, 2)],
        [(2, 0), (4, 0), (4, 2)],
        [(2, 2), (3, 3), (3, 1)],
        [(3, 3), (4, 4), (4, 2), (3, 1)],
    ]),
    ("greattri", "Great Triangle", 3, [
        [(0, 0), (4, 0), (2, 2)],
        [(4, 0), (8, 0), (6, 2)],
        [(2, 2), (4, 2), (4, 4)],
        [(4, 0), (5, 1), (4, 2), (3, 1)],
        [(2, 2), (3, 1), (4, 2)],
        [(5, 1), (6, 2), (5, 3)],
        [(4, 2), (5, 1), (5, 3), (4, 4)],
    ]),
]


def build():
    out = []
    bad = 0
    for (pid, name, tier, targets) in FIGURES:
        placements = []
        errs = []
        for i, poly in enumerate(targets):
            got = solve(poly)
            if got is None:
                errs.append(f"polygon {i} {poly} is not a tangram piece "
                            f"(area {area(poly):.3f})")
            else:
                placements.append(got)
        if not errs:
            errs = verify(pid, targets, placements)
        if errs:
            bad += 1
            print(f"✗ {pid:<10} {name}")
            for e in errs: print(f"     {e}")
        else:
            used = Counter(p["type"] for p in placements)
            desc = " ".join(f"{n}x{t}" for t, n in sorted(used.items()))
            print(f"✓ {pid:<10} {name:<15} tier {tier}  {desc}")
            out.append({"id": pid, "name": name, "tier": tier, "solution": placements,
                        "targets": targets})
    print(f"\n{len(FIGURES) - bad}/{len(FIGURES)} figures valid.")
    return out, bad


if __name__ == "__main__":
    build()


def emit_js(puzzles):
    """Write the verified puzzles as a JS module."""
    lines = [
        "/**",
        " * Tangram puzzles — GENERATED by tools/compose-tangram.py. Do not edit.",
        " *",
        " * Each puzzle carries the solved placement of every piece. The target",
        " * silhouette is drawn by rendering these placements in shadow, so the",
        " * outline and the solution can never drift apart.",
        " *",
        " * Coordinates are in tangram units: the assembled classic square is 4x4.",
        " * `rot` is degrees clockwise, `flip` mirrors the piece (only the",
        " * parallelogram is chiral enough to need it).",
        " */",
        "",
        "export const PIECE_SHAPES = {",
    ]
    for name, spec in PIECES.items():
        pts = ", ".join(f"[{x:.4f}, {y:.4f}]" for (x, y) in spec["poly"])
        lines.append(f'  {name}: {{ count: {spec["count"]}, '
                     f'flippable: {"true" if spec["flip"] else "false"}, '
                     f'poly: [{pts}] }},')
    lines += ["};", "", "export const PUZZLES = ["]
    for p in puzzles:
        lines.append("  {")
        lines.append(f'    id: "{p["id"]}", name: "{p["name"]}", tier: {p["tier"]},')
        lines.append("    solution: [")
        for pl in p["solution"]:
            lines.append(f'      {{ type: "{pl["type"]}", x: {pl["x"]:.4f}, '
                         f'y: {pl["y"]:.4f}, rot: {pl["rot"]}, '
                         f'flip: {"true" if pl["flip"] else "false"} }},')
        lines.append("    ],")
        lines.append("  },")
    lines += ["];", "", "export const PUZZLE_COUNT = PUZZLES.length;", ""]
    return "\n".join(lines)
