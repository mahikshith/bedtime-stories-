#!/usr/bin/env python3
"""
Level composer for Say & Jump.

LAYOUT RULE, and the reason for it:

A phone is tall and narrow. The first version of these levels put a flat floor
along the bottom three rows, which meant the camera framed nine rows of empty
sky and the player could not actually SEE the platforms or the gaps between
them. That is fatal for a game whose whole mechanic is judging how far to
jump.

So levels are built the way the reference art is built: PILLARS rising out of
WATER, with their tops in the middle band of the screen and obvious gaps
between them.

    rows 0-3    sky      (headroom for a full-power jump's apex)
    rows 4-7    tops     (platform surfaces live here, at varying heights)
    rows 8-10   water    (the thing you fall into)

Budgets, checked by assertions below:
    horizontal gap  <= 7 tiles (448px) against a 520px max jump
    upward step     <= 3 rows  (192px) against a 260px max apex
"""

# The water runs far deeper than the screen shows. A portrait viewport that is
# wide enough to frame two perches and the gap between them is also very tall,
# and a level that stops just below the waterline leaves a band of nothing at
# the bottom of every frame. Bottomless water fills it and reads as danger.
ROWS = 24
TOP_MIN, TOP_MAX = 4, 7      # legal rows for a platform surface
WATER_ROW = 8                # water fills from here down
TILE = 64
MAX_GAP = 7
MAX_RISE = 3

# Platforms are NARROW on purpose. In the reference art the bird is nearly as
# wide as the perch it stands on, which is what makes each landing feel like a
# landing. Wide platforms turn the same jump into stepping between two floors
# and, on a portrait screen, fill the frame so completely that the player can
# no longer see the gap they are aiming across.
MIN_W, MAX_W = 2, 5


class Level:
    def __init__(self, cols):
        self.cols = cols
        self.g = [["." for _ in range(cols)] for _ in range(ROWS)]
        self.tops = []

    def put(self, row, col, s):
        for i, ch in enumerate(s):
            if 0 <= col + i < self.cols and 0 <= row < ROWS:
                self.g[row][col + i] = ch

    def pillars(self, specs):
        """specs: list of (col, width, top_row). Pillars run down to the floor."""
        prev = None
        for (col, width, top) in specs:
            assert TOP_MIN <= top <= TOP_MAX, f"top row {top} outside {TOP_MIN}..{TOP_MAX}"
            assert MIN_W <= width <= MAX_W, f"platform width {width} outside {MIN_W}..{MAX_W}"
            if prev is not None:
                gap = col - (prev[0] + prev[1])
                assert gap <= MAX_GAP, f"gap {gap} tiles ({gap*TILE}px) > {MAX_GAP}"
                rise = prev[2] - top
                assert rise <= MAX_RISE, f"step up of {rise} rows > {MAX_RISE}"
            for r in range(top, ROWS):
                self.put(r, col, "#" * width)
            prev = (col, width, top)
        self.tops = specs

    def flood(self):
        """Water in every empty cell from WATER_ROW down."""
        for r in range(WATER_ROW, ROWS):
            for c in range(self.cols):
                if self.g[r][c] == ".":
                    self.g[r][c] = "~"

    def on(self, index, ch, dx=0, dy=-1):
        """Place a marker relative to pillar `index`'s top-left surface."""
        col, width, top = self.tops[index]
        self.put(top + dy, col + dx, ch)

    def mid(self, index, ch, dy=-1):
        col, width, top = self.tops[index]
        self.put(top + dy, col + width // 2, ch)

    def render(self):
        return "\n".join("".join(r).rstrip() or "." for r in self.g)


def build():
    out = {}

    def level(cols, specs, *, spawn_i=0, goal_i=-1, stars=(), props=(), extras=()):
        L = Level(cols)
        L.pillars(specs)
        L.flood()
        # a word gate on the right lip of every perch except the last
        for i, (c, w, t) in enumerate(specs[:-1]):
            L.put(t - 1, c + w - 1, "W")
        for i in stars:
            c, w, t = specs[i]
            L.put(max(0, t - 3), c + w // 2, "o")
        for (row, col, txt) in extras:
            L.put(row, col, txt)
        for (i, ch) in props:
            c, w, t = specs[i]
            L.put(t - 1, c, ch)
        # Spawn and goal are written LAST so a decoration can never sit on top
        # of them — a level with its spawn eaten by a tree silently starts the
        # bird in the wrong place.
        sc, sw, st = specs[spawn_i]
        gc, gw, gt = specs[goal_i]
        L.put(st - 1, sc, "S")
        L.put(gt - 1, gc + gw - 1, "G")
        return L.render()

    # ---------------------------------------------------------- world 1 --
    # Sunny Meadow: level perches, short hops, nothing hidden.
    out["M1_1"] = level(54, [
        (0, 4, 7), (8, 3, 7), (15, 3, 7), (22, 3, 7), (29, 3, 7), (36, 3, 7), (43, 5, 7),
    ], stars=(1, 2, 3, 4, 5), props=((0, "T"), (3, "f")))

    # Steps up and down.
    out["M1_2"] = level(56, [
        (0, 4, 7), (8, 3, 6), (15, 3, 5), (22, 3, 6), (29, 3, 5), (36, 3, 6), (43, 5, 7),
    ], stars=(1, 2, 3, 4, 5), props=((0, "T"),))

    # Tiny perches: precision over power.
    out["M1_3"] = level(58, [
        (0, 4, 7), (8, 2, 6), (15, 2, 5), (22, 2, 6), (29, 2, 5), (36, 2, 6), (43, 2, 5), (50, 5, 7),
    ], stars=(1, 3, 5), props=((0, "b"),))

    # ---------------------------------------------------------- world 2 --
    # Crystal Caves: perches crumble under you.
    out["M2_1"] = level(58, [
        (0, 4, 7), (8, 3, 6), (15, 3, 6), (22, 3, 6), (29, 3, 6), (36, 3, 6), (43, 5, 7),
    ], stars=(1, 2, 4), extras=[(5, 8, "%%%"), (5, 22, "%%%"), (5, 36, "%%%")])

    # Springs throw you up to the high perches.
    out["M2_2"] = level(58, [
        (0, 4, 7), (8, 3, 5), (16, 3, 7), (24, 3, 4), (32, 3, 6), (40, 3, 5), (47, 5, 7),
    ], stars=(1, 3, 5), extras=[(6, 2, "B"), (6, 17, "B"), (5, 33, "B")])

    # Moving perches over the deep.
    out["M2_3"] = level(60, [
        (0, 4, 7), (9, 3, 6), (17, 3, 6), (25, 3, 6), (33, 3, 6), (41, 3, 6), (48, 5, 7),
    ], stars=(2, 4), extras=[(4, 6, "M--"), (4, 22, "M--"), (4, 38, "M--")])

    # ---------------------------------------------------------- world 3 --
    # Cloud Kingdom: soft cloud ledges you hop up through.
    out["M3_1"] = level(58, [
        (0, 4, 7), (8, 3, 6), (16, 3, 5), (24, 3, 6), (32, 3, 5), (40, 3, 6), (47, 5, 7),
    ], stars=(1, 2, 3, 4), extras=[(4, 12, "==="), (4, 28, "==="), (4, 44, "===")])

    # Lifts carry you to the high road.
    out["M3_2"] = level(60, [
        (0, 4, 7), (9, 3, 7), (17, 3, 6), (25, 3, 5), (33, 3, 6), (41, 3, 7), (48, 5, 7),
    ], stars=(2, 3, 4), extras=[(4, 6, "V"), (5, 6, "|"), (4, 30, "V"), (5, 30, "|"), (6, 14, "B")])

    # Everything at once.
    out["M3_3"] = level(62, [
        (0, 4, 7), (8, 2, 6), (15, 2, 5), (22, 2, 6), (29, 2, 5), (36, 2, 6), (43, 2, 5), (50, 5, 7),
    ], stars=(1, 3, 5), extras=[(4, 12, "M--"), (4, 33, "M--"), (4, 26, "==="), (6, 2, "B")])

    # ---------------------------------------------------------- world 4 --
    # Sugar Peaks: ice perches — you keep sliding after you land.
    out["M4_1"] = level(58, [
        (0, 4, 7), (8, 4, 6), (16, 4, 6), (24, 4, 6), (32, 4, 6), (40, 4, 6), (47, 5, 7),
    ], stars=(1, 3, 5), extras=[(6, 8, "IIII"), (6, 16, "IIII"), (6, 24, "IIII"),
                                (6, 32, "IIII"), (6, 40, "IIII")])

    # Belts and saws.
    out["M4_2"] = level(60, [
        (0, 4, 7), (9, 4, 6), (18, 4, 6), (27, 4, 6), (36, 4, 6), (44, 3, 6), (51, 5, 7),
    ], stars=(2, 4), extras=[(6, 9, ">>>>"), (6, 18, "<<<<"), (6, 27, ">>>>"),
                             (4, 6, "X--"), (4, 24, "X--"), (4, 41, "X--")])

    # The finale.
    out["M4_3"] = level(70, [
        (0, 4, 7), (8, 2, 6), (15, 2, 5), (22, 3, 6), (30, 2, 5), (37, 2, 6),
        (44, 3, 5), (52, 2, 6), (59, 5, 7),
    ], stars=(1, 3, 5, 7), extras=[(4, 12, "M--"), (4, 41, "M--"), (4, 27, "==="),
                                   (4, 34, "V"), (5, 34, "|"),
                                   (5, 15, "%%"), (5, 30, "%%"),
                                   (6, 2, "B"), (6, 55, "B")])

    return out


if __name__ == "__main__":
    for name, m in build().items():
        print(f"const {name} = `")
        print(m)
        print("`;\n")
