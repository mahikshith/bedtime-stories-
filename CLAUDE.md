# Working in this repo

Ten educational games for children aged 2–11, shipped as one static web app
wrapped by Capacitor for Google Play and the App Store.

Read these first, in this order, and do not duplicate them here:

| File | What it holds |
|---|---|
| `README.md` | What each game is, the layout of `src/`, what every tool does |
| `docs/STACK.md` | Why there is no bundler, how to get a build onto a phone |
| `docs/DESIGN.md` | Why the character walks itself, why nothing is timed, the age bands |
| `HANDOFF.md` | Where the work stands right now, and what is next |
| `MEMORY.md` | What has already been decided, tried, and rejected — and why every tuned number is the number it is |

---

## The rules that are not negotiable

**Zero build.** There is no bundler and that is deliberate. `npm run build`
copies files into `www/`. Every module is a plain ES module loaded by the
browser, and native plugins are reached through the `window.Capacitor` global
rather than an import. If a change would require a build step to work, it is
the wrong change. `docs/STACK.md` has the reasoning.

**Generated files are generated.** Three level files carry a `GENERATED`
banner, and the composer that emits each one is what *proves* the level is
playable — BFS reachability in order, a real solver for Huarong Dao, assertion
budgets. Editing the emitted file by hand skips every one of those checks, and
the damage shows up on a phone rather than in a diff. Change the spec at the
top of the composer and re-run it:

| File | Composer | How it emits |
|---|---|---|
| `src/js/games/tilt-maze/levels.js` | `tools/compose-mazes.py` | stdout — redirect over the file |
| `src/js/games/slide/layouts.js` | `tools/compose-slide.py` | writes the file itself, only if every level solves |
| `src/js/games/tangram/puzzles.js` | `tools/compose-tangram.py` | see below |

Two things to know before relying on these. `tools/compose-levels.py` is a
Say & Jump *authoring aid*, not a generator: it prints map fragments to stdout
to be pasted into `levels.js`, which is hand-maintained and audited by
`tools/check.mjs` instead. And `compose-tangram.py`'s `__main__` calls only
`build()` — its `emit_js` is defined *after* the `__main__` block and is
therefore never reached, so the composer currently verifies the puzzles
without writing them. Fix that before trusting it to regenerate anything.

**One implementation in `core/`, never ten in `games/`.** Screen shake,
hit-stop, the tutorial overlay, page transitions, the noise floor, the safe
area and pointer routing all live in `src/js/core/` and are driven by the
engine, so a new game gets them by existing. When the same eight lines start
appearing in a second game, that is the signal to move them up. Twelve copies
of anything in this codebase has already drifted once.

**Comments explain why, not what.** The house style is prose, often naming the
bug that motivated the code, with ALL-CAPS markers for the load-bearing part.
A comment that restates the line below it is noise; a comment that records why
the obvious approach was wrong is the most valuable thing in the file. Match
the surrounding density.

---

## Verifying

```
npm test           # styles, smoke across 27 pages, wiring, hub, slide, robot, balance, town
npm run verify     # level audits: say-jump reachability, robot solutions, balance solvability
npm run test:touch # 10 games driven by a real finger on an Android profile (86 assertions)
npm run test:voice # the speaker gate, room noise, TTS health, and the voice jump
node tools/test-winnable.mjs    # plays all 15 Say & Jump levels to the end
node tools/test-tilt.mjs        # tilt on phones with no gyroscope
node tools/test-coach.mjs       # the tutorial works, not merely draws
```

Everything runs headless against the local Chromium at the path in
`tools/browser.mjs`. `smoke.mjs` and `test-winnable.mjs` take several minutes —
run them in the background rather than with a short timeout.

There is no test framework and none is wanted. Each tool is a standalone
script that drives the real game in a real browser and prints `✓`/`✗` lines.
Add one per bug class, and make it fail first.

---

## The traps

Every one of these cost a round trip to a physical phone. They share a shape.

**A cheap approximation standing in for the simulation.** Four of the six
reasons Say & Jump levels were unwinnable were this: a closed-form jump
formula that did not model air drag, an arc predictor that counted landing on
a wall, a reach cap computed from width while height was the constraint. The
approximation agreed with itself and disagreed with the game. If a value can
be obtained by running the real simulation, run it — `landingBand()` in
`say-jump/game.js` sweeps `predictArc` instead of solving.

**The harness does something the phone does not.** Playwright's `page.mouse`
fires pointer events with zero jitter, never fires `pointercancel`, and never
lands two fingers at once. A real tap moves 3–10px between down and up. Robot
Path and Sliding Blocks both branch on `moved < 20`, and both shipped
drag-only while every tool passed. Ten green tools and a broken game are not a
contradiction. `tools/stress-touch.mjs` is the answer: real touch through
`Input.dispatchTouchEvent` on an Android device profile. Anything
input-shaped belongs there, not behind `page.mouse`.

**A rule so conservative it never fires is the same as no rule.** The first
tap fix for Sliding Blocks only moved a block with exactly ONE free
direction, because anything else is a guess. Level one is a single block on
an open board — four free directions — so the tutorial level still did
nothing. Check a new rule against the levels a child actually meets first.

**CSS cannot see the Android status bar.** `env(safe-area-inset-top)` reports
the *display cutout*, so a phone without a notch reports 0 while the status
bar still covers the HUD. The insets are declared as `--sys-top` / `--sys-bottom`
from the native shell. `tools/check-safe-area.mjs` guards it. This was reported
three times and "fixed" twice in CSS before that was understood.

**Android's recogniser takes the microphone exclusively.** While
`@capacitor-community/speech-recognition` is listening there is no loudness
signal at all, so anything keyed off `voice.speaking` is dead. Say & Jump
drives reach from *how long the child spoke* in that mode instead. This is an
OS behaviour, not a web one — Expo would not change it.

**The voice stack is three cooperating modules, not three features.**
`audio.js` owns the speaker gate and is the only module that knows when a
sound is playing; `voice.js` disbelieves the microphone while that gate is
shut and tracks the room as a live percentile; `native.js` provides the real
TTS engine and reports whether anything came out. Changing one without the
others is how the microphone ends up hearing the app again. The constants
involved are load-bearing in non-obvious ways — read the "Numbers" section of
`MEMORY.md` before touching any of them.

**The speaker is two inches from the microphone.** Anything the app says is
the loudest thing in the room. `audio.js` owns the gate (`duckMic`,
`speakerBusy`, `speakerIdle`) and both input paths must consult it before
believing the mic. Note the hold is bounded by a length estimate on purpose:
a TTS engine that never fires `onend` must not be able to wedge the mic shut
forever.

**Android's WebView will accept speech and say nothing.** The whole
SpeechSynthesis API is present whether or not the device has a TTS engine
behind it: `speak()` is accepted, resolves, `getVoices()` is empty, no error
is raised. From inside the page it is indistinguishable from success, which is
why HEAR IT could be reported as dead while every test passed. The native
`@capacitor-community/text-to-speech` plugin is the fix; the safety net is
that `onstart` never arriving marks `speechWorking()` false, and the UI says
so rather than offering a button that does nothing. Also note `getVoices()`
returns `[]` on its first call and fills in asynchronously — caching that
empty result is a real way to have no voice for the whole session.

**A gyro-less phone fires `deviceorientation` forever with null angles.**
`core/tilt.js` races `deviceorientation`, `deviceorientationabsolute` and
`devicemotion` and takes whichever answers with real numbers.

**Re-check after every `await`.** A second is a long time in a children's
game: the child can have given up and tapped, the word can have changed, the
level can have ended. Where two callers can be parked on the same wait, use a
generation counter, not a boolean — a boolean cannot express "newest caller
wins", and the first to wake clears it and strands the other.

---

## Git

Develop on the branch named in the task description. Never push to another
branch without being asked, and never open a pull request unless explicitly
asked.

```
git push -u origin <branch>
```

Retry a failed push up to four times with exponential backoff (2s, 4s, 8s,
16s) for network errors only.

When a session ends, leave `HANDOFF.md` current and add anything durable to
`MEMORY.md` — a decision and its reasoning, an approach that failed, a number
and why it is that number. A fact learned from the device and not written down
gets paid for twice.

Commit messages are prose: what was wrong, why it was wrong, and what the fix
turns on — the same standard as the comments. End every commit with the
Claude Code attribution footer. Never put a model identifier in a commit
message, a code comment, a PR body, or anything else that lands in the repo.

CI builds a debug APK on every push to any branch (`.github/workflows/`).
