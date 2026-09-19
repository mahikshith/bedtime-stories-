# Word Quest

Voice- and motion-controlled learning games for children aged 2–11.

A child says a word and a bird jumps the gap. They tilt the phone and roll a
marble through a maze, collecting letters in order. They steer a flock through
the gate with the correctly spelled word. The control scheme *is* the lesson:
to play, you have to say it, spell it, or find it.

One codebase ships three ways: as a native app to Google Play and the App
Store via Capacitor, and as an installable offline website. No account, no
ads, no analytics, no network calls at all — nothing leaves the device.

There is no bundler. The whole thing is plain ES modules with zero runtime
dependencies, so "building" is a copy, and the files the tests drive in a
browser are byte-for-byte the files in the store bundle. See
[docs/STACK.md](docs/STACK.md) for why, and for how to produce a store build.

## Run it

```sh
npm install
npm start                 # then open http://localhost:8000
```

A plain `file://` open mostly works, but **microphone and gyroscope require a
secure context**, so use `localhost` or HTTPS. On a phone, either serve over
HTTPS or use your laptop's local address with a tunnel.

## Ship it

```sh
npm run build             # assemble www/
npm run sync              # build, then copy into android/ and ios/
npm run android           # open Android Studio
npm run ios               # open Xcode (macOS only)
```

The native shell is not a wrapper for its own sake. It buys five things the
web build cannot have, all behind capability checks in `src/js/core/native.js`:
haptics (the difference between pressing a picture of a button and pressing a
button), a **durable save** — a WKWebView's localStorage can be evicted by iOS
under storage pressure, and a child should never open the app to find every
level locked again — the Android hardware back button, a portrait lock and
splash screen, and a microphone prompt with an honest reason attached.

The rule that keeps it honest: **the app must still run as a plain website**,
because that is what every verification tool drives. Every native call has a
web fallback and the fallback is the path CI runs.

## The games

| Game | Ages | Control | What it teaches |
|---|---|---|---|
| **Say & Jump** | 2–11 | 🎤 voice | Say the word to jump. Louder and longer = further. |
| **Tilt Maze** | 5–11 | 📱 gyroscope | Collect letters in order to spell the word. |
| **Word Mob** | 5–11 | 👆 drag | Steer a flock through the right answer gate. |
| **Echo Pop** | 2–7 | 🎤 voice / 👆 tap | Say or tap the thing you hear. |
| **Shape Sorter** | 2–7 | 👆 drag | Shape names, and matching a form to its hole. |
| **Tangram** 七巧板 | 4–11 | 👆 drag | Spatial reasoning, rotation, part-and-whole. |
| **Sliding Blocks** 华容道 | 5–11 | 👆 drag | Planning and sequencing. Pure look-ahead. |
| **Robot Path** | 5–11 | 👆 drag | Sequencing, debugging, procedures, recursion. |
| **Balance** | 5–11 | 👆 drag | Algebra — before any notation appears. |
| **Tinker Town** | 2–11 | 👆 drag | Nothing, on purpose. Object names, cause and effect. |

The games train deliberately different things. The first four are language.
The next three are spatial. Two are symbolic — programming and algebra. Shape
rotation is one of the few interventions with measured transfer to arithmetic,
which is why the geometry side is not an afterthought.

Tinker Town is the odd one out and is meant to be: it has no levels, no score
and no way to finish. Everything else here asks a child to be right. One place
should not.

### Say & Jump

The bird walks itself to each authored jump point and stops. A word card
appears, the bird reads it aloud, and the child says it back. Loudness sets
the jump's height, sustain sets its distance, and saying the *right* word adds
reach on top.

Two decisions carry the design:

- **The bird walks itself.** A five-year-old cannot manage a joystick and a
  microphone at once, so the game owns locomotion and the child owns the one
  thing being taught.
- **A dotted arc previews the landing while charging.** "Louder goes further"
  is abstract until a child watches the arc stretch past the gap as they push
  their voice. It turns the mechanic into something learnable in one attempt.

### Tilt Maze

The whole board is always on screen — a child tilting a device cannot also
track a scrolling viewport. Letters must be collected in order and the exit
stays shut until the word is complete, so route-planning and spelling become
the same problem. Falling in a hole costs a moment, not a life.

### Word Mob

An auto-running flock, steered left or right through answer gates. The correct
gate multiplies the flock; the wrong one shrinks it. The urgency comes from
flock *size*, never a timer or a life counter: a bad answer is recoverable, and
there is still a real reason to read the gate rather than guess. Answers are
committed by steering, so a pre-reader can play by following the picture.

### Echo Pop

For the youngest players. No fail state, no timer, no score to lose. A miss
re-asks the question and the right answer is always spoken. Touch targets are a
quarter of the screen because small children have poor fine motor control and
will otherwise "miss" a correct answer.

### Shape Sorter

The geometry entry point, and the one game aimed squarely at two- to
four-year-olds. Difficulty is the *number* of shapes, not the subtlety of the
fit — single-shape inset, then two or three, and only later same-family
discrimination (square against rectangle, circle against oval). Same age rules
as Echo Pop: nothing can be lost, and a wrong hole gives a soft bounce and the
shape's name again.

### Tangram (七巧板)

The classic seven-piece dissection. Compose a silhouette from the pieces:
drag to place, tap to rotate 45°, flip the parallelogram when it will not fit.

Difficulty is carried by *what is shown*. Tier 1 draws the seams between
pieces, so it is a matching task. Tier 3 shows only the outer silhouette, so
it is a real dissection problem. Pieces snap to their solved slots rather than
being validated geometrically, which keeps the challenge on "which piece goes
where" instead of on fingertip precision. Snapping respects each piece's own
rotational symmetry, so a square is never rejected for being square.

### Sliding Blocks (华容道)

Huarong Dao, the Chinese sliding-block classic. Free the big block through the
gap at the bottom. This is pure planning — no reaction, no vocabulary, no
dexterity, only "if I move this, what opens up?".

Undo is unlimited, because planning games are learned by trying a branch and
backing out of it. The par shown is the true minimum, found by exhaustive
search at build time, so matching it is a real achievement. The classic
layout, Heng Dao Li Ma, takes 116 moves.

### Robot Path

Drag instruction blocks into a program strip, press PLAY, and watch the robot
execute exactly what you wrote. No typing and no reading beyond the icons.

The difficulty curve is carried by the SLOT LIMITS, not by the mazes. Level 6
gives the main program four slots against a route that needs twelve, so the
child has to spot the repeating pattern and move it into a procedure. Level 7
lets that procedure call itself, which is a loop. Sequencing, then
abstraction, then recursion — that is the actual syllabus.

The program runs visibly, one block at a time, with the running block lit up.
A child who wrote the wrong thing has to be able to *see* the moment it went
wrong, or the game is guess-and-check and nothing is learned.

### Balance

Get the box alone on its side of the scale. There are exactly two moves, and
they are exactly the two laws that make algebra work:

- **drag a card from the deck** — it lands on *both* pans, because the scale
  must stay balanced. This is "do the same to both sides".
- **drop a card on its shadow** — both vanish. This is `x + (-x) = 0`, learned
  as a fact about pictures rather than about signs.

With those two moves, `box + a = b` is solved by adding shadow-a to both sides
and cancelling. That is a real derivation, performed by a child who has never
seen a letter used as a number. Later tiers relabel the same creatures as
numerals and then rename the box to `x`, so the notation arrives on top of a
skill they already have — the opposite of how algebra is usually introduced.

The scale never tilts. A tilting scale would suggest the two sides can differ,
which is the one idea the game exists to rule out.

### Tinker Town

Four rooms — kitchen, garden, bathroom, music room — a pocket that holds six
things, and twenty-five objects that can be carried anywhere and put on
anything. Twenty-eight rules say what happens when two things meet. None of
them is explained.

Four decisions carry the whole game:

- **Every touch says the thing's name.** This is the entire educational layer
  and it costs the play nothing. A child hears "watering can" forty times in a
  session because they picked it up forty times, not because a quiz asked.
- **Anything goes in the pocket.** Four rooms you can move things between is a
  far bigger space than eight rooms you cannot. The stone from the garden
  sinks in the bath; a cup filled at the kitchen sink waters a seedling. Those
  are not scripted set-pieces, they fall out of the rules meeting each other.
- **Reactions, not instructions.** Seed into soil sprouts, water grows a
  flower, soap in the bath makes bubbles, a pot on the stove cooks. The child
  forms a hypothesis and tests it, which is the actual loop.
- **A gentle hint, never an arrow.** While something is held, the fixtures it
  could act on breathe. After a quiet spell one object hops. Both say *where*
  without saying *what*, so the discovery still belongs to the child.

The deepest chain runs three steps across two rooms: fill a cup at the sink,
pour it into the pot, put the pot on the stove — and the game says "the water
is boiling" instead of "it's cooking", which is the only evidence a child
needs that it noticed what they did two steps ago.

Nothing is ever a dead end: a mushroom put back in the soil makes another one,
a towel undoes water, soap undoes mud. Undoing a thing you just did is how you
find out you caused it. The world persists to `localStorage`, because a sandbox
you have to rebuild every session is a toy box somebody empties overnight. A
present crate opens once a day and adds one new object.

## Layout

```
index.html              hub: age band, bird, progress, level paths
src/
  games/*.html          one page per game
  result.html           post-level results
  css/                  tokens (palette, type, geometry), shared chrome, hub
  assets/               vendored fonts, favicon
  js/
    core/
      engine.js         fixed-timestep loop, DPR canvas, letterboxed viewport,
                        pointer routing to the active scene
      boot.js           one boot for every game page
      physics.js        AABB platformer world, jump solver, arc prediction
      tilemap.js        ASCII level parser + reachability audit
      voice.js          mic loudness, utterance shaping, word matching
      tilt.js           DeviceOrientation with pointer/keyboard fallbacks
      audio.js          synthesised SFX and speech
      words.js          age-banded vocabulary banks
      storage.js        progress, streak, settings (localStorage only)
      draw.js fx.js palette.js
    art/
      bird.js           the playable bird, eight animated states
      thumbs.js         a painted scene per game, for the hub tiles
      environment.js    themes, parallax, pillars, water, hazards
      backdrops.js      six themed scenes behind the puzzle games
      character.js shading.js
    games/<id>/         game.js + levels.js per game
      town/             things.js (25 objects), scenes.js (4 rooms),
                        rules.js (28 reactions), game.js
tools/                  level composer, audits, screenshots, playtests
```

Two things live in `core` specifically because ten copies of them had already
drifted apart:

- **`engine.js` routes pointer input.** A scene defines any of `down`,
  `move` and `up`, taking logical coordinates; the engine binds them on
  `setScene` and unbinds on the way out. It is the only place that can
  guarantee the unbind, because it owns the canvas, the coordinate transform
  and the scene lifecycle. `move` and `up` bind to the window on purpose: a
  finger sliding off the edge mid-drag must still finish the drag.
- **`boot.js` starts a game page.** A page states only which game it is and
  how to build its scene; results are serialised from whatever the game
  reports, so a game can measure moves or falls or the word without a page
  wrapper knowing the shape of it.

The hub is a wall of pictures, two to a row, and nothing else: no progress bar
under a tile, no trail unfolding between one game and the next. Each thumbnail
is a small painted scene drawn from core primitives in `art/thumbs.js` —
drawn rather than imported, because the hub deliberately loads no game code.
The picture is the label: a three-year-old cannot read "Sliding Blocks" but
can recognise a red block in a wooden frame.

Everything about one game — what it is, a PLAY button, the trail of its levels
— lives on that game's own screen, opened by tapping its tile and closed by
the device back button. `levels` in the catalogue is async and imports a
game's content only when that screen opens, so the cost of the menu does not
grow as games are added to it. Opening the menu used to parse every level
table in the app plus one whole game implementation:

    20 modules, 180.2 KB, 8148px, 376 DOM nodes
     9 modules,  85.7 KB, 1356px, 103 DOM nodes

## Design notes

**Palette.** Saturated poster graphics: flat high-chroma fills with hard value
separation between neighbouring shapes. Pastels and low-contrast gradients are
banned on gameplay elements — at arm's length on a phone in daylight a washed
out palette turns to grey mush and a child cannot tell the platform from the
sky. Every colour is a `light / base / dark / deep` ramp so flat shapes can be
lit consistently (`src/js/core/palette.js`).

**Level layout.** Say & Jump levels are *pillars over water*, not a floor along
the bottom. On a portrait phone a bottom-aligned floor pushes every platform
off the bottom of the frame, and a game about judging distance becomes
unplayable because you cannot see what you are jumping to.

**Jump tuning.** Jumps are authored as an apex and a forward distance; the
launch velocities are solved from them (`solveJump`). That means a level can
promise a gap is clearable and actually be right, instead of hand-tuning
impulses until it feels about right.

**Forgiveness.** Children's speech is mis-transcribed constantly, so word
matching accepts close variants ("elefant" passes for "elephant") while still
rejecting minimal pairs ("bat" is not "cat"). A game that tells a child they
are wrong when they are right teaches them to stop trying.

## Tools

```sh
node tools/check.mjs              # audit every platformer level for reachability
node tools/smoke.mjs              # load every page, drive input, fail on any error
node tools/playtest.mjs 0         # drive a Say & Jump level end to end
node tools/test-slide.mjs         # solve sliding layouts in-page, assert the win
node tools/check-robot.mjs        # run every robot level's reference solution
node tools/test-robot.mjs         # play every robot level in a browser
node tools/check-balance.mjs      # prove every equation is solvable, report par
node tools/test-balance.mjs       # solve every equation inside the running game
node tools/test-town.mjs          # play Tinker Town's discovery chains in a browser
node tools/check-wiring.mjs       # the page contract: bird reaches scene, back works
node tools/test-hub.mjs           # the hub loads no game code; tiles, screens, back
node tools/weigh.mjs [page]       # modules, bytes and DOM nodes a page costs
node tools/build-app.mjs          # assemble www/ (parked work left out)
node tools/make-icons.mjs         # render store icons from the app's own SVG
node tools/test-app.mjs           # the BUILT bundle: offline, icons, exclusions
node tools/shoot-town.mjs <dir>   # capture every room, plus the idle nudge
python3 tools/compose-levels.py   # regenerate platformer maps from their specs
python3 tools/compose-tangram.py  # solve + verify tangram figures, emit puzzles.js
python3 tools/compose-slide.py    # BFS-solve sliding layouts, emit layouts.js
node tools/fetch-fonts.mjs        # re-vendor the fonts
node tools/shoot.mjs <page> <out.png>
```

Every game with authored content has a generator that proves the content is
playable before it ships:

- **Platformer levels** are composed with asserted gap and rise budgets, then
  walked as a graph to confirm the goal is reachable from the spawn.
- **Tangram figures** are authored as target polygons; the tool solves each
  piece's placement by shape matching and rasterises the result to confirm the
  pieces genuinely tile without overlapping. This caught a unit-area hole in
  the canonical dissection that looking at it would never have found.
- **Sliding layouts** are solved by breadth-first search over the whole state
  space, which both proves solvability and yields the exact par.
- **Robot levels** ship a reference solution that is simulated headlessly, and
  checked to fit the slot limits the player is actually given. This caught
  three broken levels on its first run.
- **Balance equations** are solved by search over the two legal moves, which
  proves each level is reachable and records the shortest solution.
- **Tinker Town** has no levels to verify, so the tests assert its promises
  instead: that a seed grows, that a stone carried from the garden sinks in the
  bath, that a cup filled at the sink pours into the pot — and that nothing
  ever ends up hidden underneath anything else, since to a three-year-old a
  covered toy has not been covered, it has been eaten by the game.

Several games are verified twice: once against the model (does the content
work under the rules?) and once in a real browser (does the game apply those
rules faithfully?). The second layer is what catches wiring bugs a screenshot
hides.

An impossible puzzle should break the build, not a child.

Two of the tools guard the architecture rather than the content. `check-wiring`
asserts the contract every game page shares — the chosen bird reaches the
scene, the top-left corner goes home, the handles the tools drive exist. It
asks for a *berry* bird specifically, so a page that ignores the parameter and
falls back to the default fails loudly instead of looking right by accident;
that is how Say & Jump was found to have been reading `cast` while the hub
had always sent `bird`. `test-hub` asserts that the menu loads no game
code, that the grid is pictures two to a row with no trail attached, and that
opening a game fetches exactly that one game's content.

`test-app` is the only tool that drives the *built* bundle rather than the
source tree, and it checks the things that exist only once it is assembled:
that the app runs with the network cut — for this app not a degraded mode but
the normal one, on a plane or a tablet that has never had a SIM — that a whole
game and not merely the menu is playable offline, that every icon the manifest
promises is really there, and that parked work is genuinely absent rather than
just unlinked.

Levels are generated by `tools/compose-levels.py`, which does the column
arithmetic and asserts every gap and rise stays inside the jump budget. Edit
the spec there and re-run rather than nudging tiles by hand. `check.mjs` then
walks each level as a graph and fails the build if the goal is unreachable — an
impossible level should break CI, not a child.

## Privacy

No account, no network calls, no analytics. Audio is analysed in the browser
and never recorded or transmitted. Where the platform offers speech
recognition the browser may process audio per its own policy; it can be turned
off in settings, and every game stays fully playable without it. All progress
lives in `localStorage` on the device.

## Browser support

Chrome, Edge and Safari have everything. Firefox has no `SpeechRecognition`, so
word *checking* is off there — loudness still drives the games, which remain
fully playable. Gyroscope falls back to drag on desktop and to arrow keys.

## Licence

Code: MIT. Fonts: Nunito and Baloo 2, SIL Open Font License 1.1
(`src/assets/fonts/OFL.txt`).
