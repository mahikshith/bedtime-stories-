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

    rows 0-7    sky      (headroom for a full-power jump's apex)
    rows 8-11   tops     (platform surfaces live here, at varying heights)
    rows 12+    water    (the thing you fall into)

The sky band is deliberately DEEPER than the apex needs. Every level here is
shorter than the viewport, so the camera pins vertically and the platforms
land at whatever fraction of the screen the sky puts them at — with four rows
of sky they sat 22% down, with the rest of the phone below them. Eight rows
puts them at 38%, which is where a player expects the ground to be.

Budgets, checked by assertions below:
    horizontal gap  <= 7 tiles (448px) against a 520px max jump
    upward step     <= 3 rows  (192px) against a 260px max apex
"""

# The water no longer has to run off the bottom of the world to fill the frame.
# It is drawn as one wide body in front of the pillars now, extending past the
# level's end, so six rows of it is plenty — and the pillars it hides are six
# rows of brick that used to be painted over the sea.
ROWS = 18

# Every level spec below names its platform tops in rows 4..7, and they are
# shifted down by SKY when the grid is built. Keeping the specs as they were
# written is not laziness: each one is a hand-paced difficulty curve, and
# renumbering forty rows by hand to change where the camera frames them is a
# large opportunity to introduce a gap nobody can jump.
SKY = 4
SPEC_TOP_MIN, SPEC_TOP_MAX = 4, 7
TOP_MIN, TOP_MAX = SPEC_TOP_MIN + SKY, SPEC_TOP_MAX + SKY
WATER_ROW = TOP_MAX + 1      # water fills from here down
TILE = 64
MAX_GAP = 7
MAX_RISE = 3

# A gap with a moving platform in it is allowed to be WIDER than any jump,
# because that is the only thing that makes the mover matter. Reported from
# the device: "since we have a moving platform, the user must and should land
# on the platform in order to cross it". At 10 tiles the gap is 640px against
# a 560px best jump, so there is no shout that crosses it — and each hop on
# and off the mover is a single tile, so the skill being asked for is timing,
# not power.
BRIDGED_GAP = 10
MOVER_SPAN = 3          # 192px of platform: the bird is 50px, a 64px slab was a tightrope

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

    def pillars(self, specs, bridged=()):
        """specs: list of (col, width, top_row). Pillars run down to the floor."""
        prev = None
        for i, (col, width, top) in enumerate(specs):
            assert TOP_MIN <= top <= TOP_MAX, f"top row {top} outside {TOP_MIN}..{TOP_MAX}"
            assert MIN_W <= width <= MAX_W, f"platform width {width} outside {MIN_W}..{MAX_W}"
            if prev is not None:
                gap = col - (prev[0] + prev[1])
                limit = BRIDGED_GAP if (i - 1) in bridged else MAX_GAP
                assert gap <= limit, f"gap {gap} tiles ({gap*TILE}px) > {limit}"
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

    def widen_for_bridges(specs, movers):
        """
        Open each bridged gap to BRIDGED_GAP tiles, sliding everything to its
        right along. Done here rather than by hand because widening one gap
        moves every pillar after it, and renumbering a level by hand is how a
        gap nobody can jump gets into the game.
        """
        out, shift = [], 0
        for i, (c, w, t) in enumerate(specs):
            out.append((c + shift, w, t))
            if i in movers and i + 1 < len(specs):
                gap = specs[i + 1][0] - (c + w)
                shift += max(0, BRIDGED_GAP - gap)
        return out, shift

    def shift_at(specs, movers, col):
        """
        How far a thing at absolute column `col` has to move right.

        `extras` are written in absolute columns, and widening a gap slides
        every pillar after it along — so without this, opening one gap leaves
        every spring, vent, cannon and one-way ledge downstream of it standing
        in open air next to the perch it used to belong to. That is the same
        mistake the sky offset made vertically, and it is silent in exactly
        the same way.
        """
        sh = 0
        for i in sorted(movers):
            if i + 1 >= len(specs):
                continue
            gap_start = specs[i][0] + specs[i][1]
            if gap_start < col:
                sh += max(0, BRIDGED_GAP - (specs[i + 1][0] - gap_start))
        return sh

    def level(cols, specs, *, spawn_i=0, goal_i=-1, stars=(), props=(), extras=(), movers=()):
        # Shift ONCE, here, before anything reads a row number. Doing it inside
        # `pillars()` moved the pillars and left every gate, star, spawn and
        # goal at its old height — four rows of clear air above a perch that
        # was no longer there.
        specs = [(col, width, top + SKY) for (col, width, top) in specs]
        movers = set(movers)
        unwidened = specs
        specs, grew = widen_for_bridges(specs, movers)
        L = Level(cols + grew)
        L.pillars(specs, bridged=movers)
        # Movers go in BEFORE the flood, so the water fills around them.
        for i in sorted(movers):
            c0, w0, t0 = specs[i]
            c1, _, t1 = specs[i + 1]
            gap = c1 - (c0 + w0)
            # Travel chosen so the mover's far edge finishes FLUSH with the
            # far lip. A tile of daylight there would mean a second jump to
            # get off — and this game gives one jump per word, so the bird
            # would ride to the end and then walk into the sea. One tile of
            # daylight at the NEAR end is deliberate: that hop is the jump the
            # word buys.
            travel = max(1, gap - MOVER_SPAN - 1)
            # Level with the DESTINATION lip, not the one you leave from.
            #
            # You board a mover with a jump, which copes with a step up or
            # down; you leave it by walking, which does not. Levelling it with
            # the near lip put the far lip a tile above the deck, so the bird
            # rode to the end, walked into the side of the pillar, and was
            # carried back — for ever, at three hearts intact, looking for all
            # the world like a level that simply could not be finished.
            L.put(t1, c0 + w0 + 1, "M" * MOVER_SPAN + "-" * travel)
        L.flood()
        for i in stars:
            c, w, t = specs[i]
            L.put(max(0, t - 3), c + w // 2, "o")
        # Extras carry ABSOLUTE rows, so they need the same shift the pillars
        # got. Without it the sky offset moved the ground out from under every
        # mover, spring, fire vent, cannon and power star in the game and left
        # them hanging four rows up — reachable by nothing, and invisible to
        # the level checker, which only ever verified gaps and word gates.
        for (row, col, txt) in extras:
            L.put(row + SKY, col + shift_at(unwidened, movers, col), txt)
        for (i, ch) in props:
            c, w, t = specs[i]
            L.put(t - 1, c, ch)
        # A word gate on the right lip of every perch except the last, placed
        # AFTER the decorations for the same reason spawn and goal are.
        #
        # They used to go first, and a crumbling ledge written over the top of
        # one simply deleted it: three perches in Crystal Caves had no gate, so
        # the bird walked past them looking for the next one and off the edge
        # into the water. It reads as the level being broken, which it was.
        for i, (c, w, t) in enumerate(specs[:-1]):
            L.put(t - 1, c + w - 1, "W")

        # Spawn and goal are written LAST so a decoration can never sit on top
        # of them — a level with its spawn eaten by a tree silently starts the
        # bird in the wrong place.
        sc, sw, st = specs[spawn_i]
        gc, gw, gt = specs[goal_i]
        L.put(st - 1, sc, "S")
        L.put(gt - 1, gc + gw - 1, "G")
        return L.render()

    # ---------------------------------------------------------- world 1 --
    # Sunny Meadow.
    #
    # These three were the whole first impression and they contained NOTHING
    # but blocks and water — the player's reasonable conclusion was that every
    # level in the game looks the same, and they were right about the only
    # levels they had seen. The pacing rule (one new idea at a time) is still
    # worth keeping; what was wrong was reading "one idea" as "nothing to look
    # at". So world 1 now has things that MOVE and things that are FUN, none
    # of which can hurt: a bouncy pad is a toy before it is a mechanic.
    # Decoration only. The bouncy pads that were briefly here landed in the
    # GAPS rather than on the perches, which in a level whose promise is
    # "nothing can hurt you" is a trap: a child jumping the gap gets thrown
    # somewhere they did not choose. Springs arrive in world 2, on ground.
    out["M1_1"] = level(54, [
        (0, 4, 7), (8, 3, 7), (15, 3, 7), (22, 3, 7), (29, 3, 7), (36, 3, 7), (43, 5, 7),
    ], stars=(1, 2, 3, 4, 5),
       props=((0, "T"), (1, "f"), (2, "b"), (3, "f"), (4, "r"), (5, "b")))

    # Steps up and down — and a lift that does some of the climbing for you.
    # A lift crossing each of two gaps: a bridge that arrives, not a hazard.
    out["M1_2"] = level(56, [
        (0, 4, 7), (8, 3, 6), (15, 3, 5), (22, 3, 6), (29, 3, 5), (36, 3, 6), (43, 5, 7),
    ], stars=(1, 2, 3, 4, 5), props=((0, "T"), (2, "f"), (4, "b")),
       movers=(1, 4))

    # Tiny perches, and the first star that makes you untouchable.
    out["M1_3"] = level(58, [
        (0, 4, 7), (8, 2, 6), (15, 2, 5), (22, 2, 6), (29, 2, 5), (36, 2, 6), (43, 2, 5), (50, 5, 7),
    ], stars=(1, 3, 5), props=((0, "b"), (3, "r"), (5, "f")),
       movers=(2,), extras=[(3, 30, "P")])

    # ---------------------------------------------------------- world 2 --
    # Crystal Caves: perches crumble under you — and the first fire vent.
    #
    # Fire used to wait until M2_4 and cannons until M3_4, which is correct
    # pacing on paper and came back from a real phone as "there is no fire,
    # there is no bullets": nobody had played that far. A hazard nobody meets
    # is not gentle difficulty, it is content that does not exist. World 1
    # still cannot hurt anyone — that promise is worth keeping — but world 2
    # now opens with the thing it is named for.
    out["M2_1"] = level(58, [
        (0, 4, 7), (8, 3, 6), (15, 3, 6), (22, 3, 6), (29, 3, 6), (36, 3, 6), (43, 5, 7),
    ], stars=(1, 2, 4), extras=[(5, 8, "%%%"), (5, 22, "%%%"), (5, 36, "%%%"),
                                (7, 12, "F"), (6, 12, "!")])

    # Springs throw you up to the high perches.
    out["M2_2"] = level(58, [
        (0, 4, 7), (8, 3, 5), (16, 3, 7), (24, 3, 4), (32, 3, 6), (40, 3, 5), (47, 5, 7),
    ], stars=(1, 3, 5), extras=[(6, 2, "B"), (6, 17, "B"), (5, 33, "B"), (3, 26, "Q"),
                                (5, 12, "C----"), (7, 21, "F"), (6, 21, "!")])

    # Moving perches over the deep.
    out["M2_3"] = level(60, [
        (0, 4, 7), (9, 3, 6), (17, 3, 6), (25, 3, 6), (33, 3, 6), (41, 3, 6), (48, 5, 7),
    ], stars=(2, 4), movers=(0, 2, 4), extras=[(3, 34, "H")])

    # ---------------------------------------------------------- world 3 --
    # Cloud Kingdom: soft cloud ledges you hop up through.
    out["M3_1"] = level(58, [
        (0, 4, 7), (8, 3, 6), (16, 3, 5), (24, 3, 6), (32, 3, 5), (40, 3, 6), (47, 5, 7),
    ], stars=(1, 2, 3, 4), extras=[(4, 12, "==="), (4, 28, "==="), (4, 44, "==="), (3, 30, "H")])

    # Lifts carry you to the high road.
    out["M3_2"] = level(60, [
        (0, 4, 7), (9, 3, 7), (17, 3, 6), (25, 3, 5), (33, 3, 6), (41, 3, 7), (48, 5, 7),
    ], stars=(2, 3, 4), extras=[(4, 6, "V"), (5, 6, "|"), (4, 30, "V"), (5, 30, "|"), (6, 14, "B"), (3, 18, "Q")])

    # Everything at once.
    out["M3_3"] = level(62, [
        (0, 4, 7), (8, 2, 6), (15, 2, 5), (22, 2, 6), (29, 2, 5), (36, 2, 6), (43, 2, 5), (50, 5, 7),
    ], stars=(1, 3, 5), movers=(1, 4), extras=[(4, 26, "==="), (6, 2, "B"), (3, 40, "H")])

    # ---------------------------------------------------------- world 4 --
    # Sugar Peaks: ice perches — you keep sliding after you land.
    out["M4_1"] = level(58, [
        (0, 4, 7), (8, 4, 6), (16, 4, 6), (24, 4, 6), (32, 4, 6), (40, 4, 6), (47, 5, 7),
    ], stars=(1, 3, 5), extras=[(6, 8, "IIII"), (6, 16, "IIII"), (6, 24, "IIII"),
                                (6, 32, "IIII"), (6, 40, "IIII"), (3, 28, "H")])

    # Fire in the cave mouths. It breathes, so it is a rhythm to read rather
    # than a wall to be told about.
    out["M2_4"] = level(60, [
        (0, 4, 7), (9, 3, 6), (17, 3, 6), (25, 3, 6), (33, 3, 6), (41, 3, 6), (48, 5, 7),
    ], stars=(1, 3, 5), extras=[(7, 13, "F"), (6, 13, "!"),
                                (7, 29, "F"), (6, 29, "!"),
                                (7, 45, "F"), (6, 45, "!"), (3, 20, "Q")])

    # Cannons across the gaps — the shot is slow, loud and announced.
    out["M3_4"] = level(62, [
        (0, 4, 7), (9, 3, 6), (18, 3, 5), (27, 3, 6), (36, 3, 5), (45, 3, 6), (52, 5, 7),
    ], stars=(2, 4), extras=[(5, 6, "C-----"), (4, 24, "C-----"), (5, 42, "C-----"),
                             (3, 33, "P"), (3, 22, "Q"), (3, 48, "H")])

    # Belts and saws.
    out["M4_2"] = level(60, [
        (0, 4, 7), (9, 4, 6), (18, 4, 6), (27, 4, 6), (36, 4, 6), (44, 3, 6), (51, 5, 7),
    ], stars=(2, 4), extras=[(6, 9, ">>>>"), (6, 18, "<<<<"), (6, 27, ">>>>"),
                             (4, 6, "X--"), (4, 24, "X--"), (4, 41, "X--"), (3, 34, "Q")])

    # The finale.
    out["M4_3"] = level(70, [
        (0, 4, 7), (8, 2, 6), (15, 2, 5), (22, 3, 6), (30, 2, 5), (37, 2, 6),
        (44, 3, 5), (52, 2, 6), (59, 5, 7),
    ], stars=(1, 3, 5, 7), movers=(1, 5), extras=[(4, 27, "==="),
                                   (4, 34, "V"), (5, 34, "|"),
                                   (5, 15, "%%"), (5, 30, "%%"),
                                   (6, 2, "B"), (6, 55, "B"), (3, 20, "H"), (3, 52, "Q")])

    # The gauntlet: everything the game has, arranged so each hazard has its
    # own beat rather than arriving all at once.
    out["M4_4"] = level(74, [
        (0, 4, 7), (8, 3, 6), (16, 3, 5), (24, 3, 6), (32, 2, 5), (39, 3, 6),
        (47, 2, 5), (54, 3, 6), (63, 5, 7),
    ], stars=(1, 3, 5, 7), movers=(3,), extras=[(7, 12, "F"), (6, 12, "!"),
                                   (5, 20, "C-----"),
                                   (7, 36, "F"), (6, 36, "!"),
                                   (4, 43, "X--"),
                                   (5, 51, "C-----"),
                                   (6, 5, "B"), (6, 59, "B"),
                                   (3, 24, "P"), (3, 47, "P"), (3, 38, "H")])

    return out


if __name__ == "__main__":
    for name, m in build().items():
        print(f"const {name} = `")
        print(m)
        print("`;\n")
