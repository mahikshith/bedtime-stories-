# What this project has already learned

Decisions, the reasoning behind them, and the things that were tried and did
not work. `CLAUDE.md` says how to work here and `HANDOFF.md` says what is next;
this file exists so that neither a person nor a session re-derives what is
already known, or quietly re-breaks something that was fixed on purpose.

Nothing here is a rule. If a decision is wrong, change it — but change it
knowing what it cost the first time.

## Current polish decisions

The shell remains Canvas 2D + Capacitor and the build remains a copy. The new
`PRODUCT.md`, root `DESIGN.md`, and `docs/POLISH-ROADMAP.md` capture an
Android-first visual system and the order of the unfinished work.

Say & Jump keeps auto-walk as the default between authored word gates. A
directional pad temporarily overrides it only while held, so adding a touch
controller does not bypass the level's planned stops. A short tap on JUMP is
floored to a safe authored landing; touch progression earns a level result
without adding the word to `wordsLearned`. A cancelled pointer releases the
controller without jumping. Touch mode skips microphone startup entirely.
The mode is chosen before play and saved, as well as changeable in-game.
Microphone startup is serialised across fast mode switches; the VoiceInput
resume listener is removed on stop so a later Voice mode can wake a new audio
context on the next gesture.

Shape Sorter's `tiny` versions of later boards use explicit `tinyKeys` because
simply shortening a list would drop the newly introduced star and the final
board's heart/hexagon. Keep the same level indices and save keys when a
parent changes age band. Six-piece mid boards need two tray rows: one row
made tiles too small to target on a phone. `pointercancel` returns a shape
rather than silently placing it.

---

## The shape almost every bug in this project has had

**A cheap approximation standing in for the simulation.** It agrees with
itself, disagrees with the game, and nothing catches it because the thing
checking is the same approximation.

| Where | The approximation | What a child saw |
|---|---|---|
| Say & Jump | `solveJump` ignored air drag | Promised 560px, delivered ~440. Every authored gap was a fifth too wide |
| Say & Jump | `predictArc` counted any overlap as a landing | The green "you land here" marker pointed at drownings |
| Say & Jump | Reach capped by width while height was the constraint | Unwinnable levels |
| Safe area | CSS `env(safe-area-inset-top)` | Reports the *display cutout*. A notch-less phone says 0 while the status bar covers the HUD |
| Voice | Noise floor measured once, drifting down only | A room that got louder left the floor stranded and the meter pinned |
| Voice | Sustain measured on the *smoothed* level | Its slow release stretches a 2-frame knock into 140ms — long enough to pass the test built on it |
| TTS | "`speak()` resolved" taken as "it spoke" | Android accepts and stays silent. No error, no exception |

The fix in every case was to stop approximating: `landingBand()` sweeps the
real `predictArc` rather than solving; the insets come from the native shell
as `--sys-top`; the floor is a live percentile of the room; the sustain is
measured on the raw signal; TTS health is inferred from `onstart`.

**When a value can be obtained by running the real thing, run it.**

---

## Decisions that look wrong until you know why

**No bundler, and `npm run build` is a copy.** Plugins are reached through
`window.Capacitor` rather than imported precisely so no bundler is needed to
resolve bare specifiers. The payoff is that what ships is byte-for-byte what
was tested, and the whole verification suite drives the real game over plain
HTTP. *Anything that would require a build step to work is the wrong change.*

**No test framework, and there will not be one.** Every tool in `tools/` is a
standalone script that drives the real game in a real browser and prints
`✓`/`✗`. This is the same pattern the user's other project (`dottie`) arrived
at independently — 34 standalone `tsx` scripts, no framework.

**Springs were cut from Say & Jump, not fixed.** They blocked the bird
horizontally (a wall it stood against for a whole level at full health), and
once passed through, fired on walking contact and launched it off the perch.
Cut as a judgement call with the reinstatement path documented at the call
site. Do not re-add them without solving both.

**Tinker Town has no goal on purpose** (`docs/DESIGN.md`). The device
feedback asks for one. That is a product decision, not a bug — see
`HANDOFF.md`.

**Hit-stop survives reduced motion; shake and punch do not.** Hit-stop is the
*absence* of movement, and it is what carries the weight of an impact for a
child who has asked for less of everything else.

**Word matching is deliberately forgiving**, and recognition is a bonus signal
rather than a gate. A game that says "wrong" to a correct answer teaches a
child to stop trying. Short words get a stricter bar (`cat`/`bat` differ by
one letter) — 0.99 at ≤3 letters, 0.66 at ≤5, 0.6 above.

**A wrong word costs nothing in Say & Jump.** No heart, no fall, no restart.
After three misses the touch path takes over so the level is always
finishable.

---

## Things that were tried and did not work

**A boolean guard for "newest caller wins".** Two callers can be parked on the
same `await`; whichever wakes first clears the flag and strands the other
behind an already-open gate. That is how a recogniser stops opening at all.
Use a generation counter (`_listenGen`).

**A tap rule that only fired when it was certain.** Sliding Blocks originally
moved a block only when it had exactly ONE free direction, because anything
else is a guess. Level one is a single block on an open board — four free
directions — so the tutorial level did nothing at all when tapped. *A rule so
conservative it never fires is the same as no rule.* A tap is now read as an
aim: the side you tap is the way it goes.

**Sampling the room only between utterances.** The safe-looking version of
noise-floor tracking deadlocks: room noise loud enough to cross the threshold
starts an utterance that never ends, so no samples are taken, so the floor
never rises, so the meter stays pinned — which is the exact fault being fixed.
Sample *through* speech; a low percentile over a long window is what makes
that safe.

**Tuning the floor's rise rate to stop a television firing twice.** Swept
0.5 → 2.0; the count never moved. The cause was the window, not the rate: a
20th percentile over four seconds cannot move until 80% of the window is new.
The window length is load-bearing (it is what stops a held "saaaay" raising
the floor into the child's own voice), so the gap is covered from the other
end — a full-length utterance is evidence about the room and moves the floor
directly.

**Fixing the safe area in CSS. Twice.** CSS cannot see the Android status bar.

**Shifting the sky inside `pillars()`.** It moved the pillars and left every
mover, spring, vent and power star four rows above them. Shift once in
`level()`. `auditMap` now checks pickups and movers are reachable — and that
check was verified by *reintroducing* the bug to watch it fail. The first
reintroduction returned exit 0, which meant the reintroduction had not
applied, not that the check worked.

---

## Numbers, and why they are those numbers

Change them if the device says so. Do not change them because they look
arbitrary — they were measured.

### Voice (`src/js/core/voice.js`)

| Constant | Value | Why |
|---|---|---|
| `onThreshold` | 0.22 | Was 0.16. Raised with the sustain gate, not instead of it |
| `offThreshold` | 0.11 | Hysteresis, stops the meter fluttering at the boundary |
| `onSustainMs` | 90 | Impulse noise lasts ~2 frames; the shortest child's word holds ~100ms. Measured on the RAW level, never the smoothed one |
| `releaseMs` | 140 | Quiet before an utterance is considered over |
| `maxUtteranceMs` | 2600 | Also the evidence threshold: 2.6s unbroken is a room, not a word |
| `FLOOR_GAIN` | 1.8 | Floor sits this far above the measured quiet |
| `FLOOR_MAX` | 0.2 | Was 0.08 — quiet-room loud, so a kitchen sat permanently above it |
| `ROOM_FRAMES` | 240 | Four seconds. Long enough that a capped 2.6s shout is a minority of the window |
| `ROOM_PERCENTILE` | 0.2 | The quiet between words *is* the room |
| `RECOG_GUARD_MS` | 320 | A recogniser reports what it heard tens of ms late |

Echo Pop overrides `onThreshold` 0.18 / `onSustainMs` 70 — it is for 2–5s,
whose words are quieter and shorter. It was 0.13, low enough that the room
answered the question.

### Audio gate (`src/js/core/audio.js`)

| Constant | Value | Why |
|---|---|---|
| `TAIL_MS` | 280 | A speaker cone settles, a room echoes, a recogniser opened on the last frame still catches the final syllable |
| `SILENT_MS` | 1100 | How long to wait for `onstart` before concluding nothing was said |

The gate's hold is **bounded by a length estimate on purpose**. A TTS engine
that never fires `onend` — the Android case — must not be able to wedge the
microphone shut forever.

### Physics (`src/js/core/physics.js`)

`gravity` 2400, `fallGravity` 3100 (heavier down reads as arcade rather than
floaty), `airDrag` 320 — which `solveJump` must compensate for (`½·drag·T²`)
or every gap budget is a fifth optimistic. `bounceTrigger` 260.

### Game feel (`src/js/core/juice.js`)

Hit-stop in frames at 60Hz: light 0, medium 3, heavy 5, huge 8. Beyond ~100ms
it stops reading as impact and starts reading as the game hanging. Trauma
0.22 / 0.4 / 0.62 / 0.85, and shake is trauma **squared** — that is the whole
trick, and it is what lets everything shake without the screen wobbling.

### Sliding Blocks (`src/js/games/slide/game.js`)

Drag commits at `cell * 0.35` on the dominant axis; a tap's aim has a dead
zone of `cell * 0.18` around the block's centre.

---

## Platform facts, established the hard way

- **Offline game URLs include query parameters.** The service worker precaches
  `/src/games/balance.html`, while play links request that page with `?level=0`
  and sometimes an age band. A cache lookup that includes the query misses,
  and an offline fallback to `/index.html` can make a game page try to import
  `/src/games/src/js/hub.js`. Match precached static files with `ignoreSearch`
  and run `npm run test:app` with the network cut before shipping.
- **Voice tests must own the recogniser they drive.** A scene can enter `charge`
  before a harness samples `prompt`, and its original microphone startup can
  finish after a fake recogniser is installed. Invalidate that startup, keep
  the fake listen pending until HEAR IT interrupts it, and measure charge only
  while the speaker gate reports busy. A fixed wall-clock wait is not that
  measurement on a loaded CI runner.
- **Android's speech recogniser takes the microphone exclusively.** While it
  listens there is no loudness signal at all, so anything keyed off
  `voice.speaking` is dead. Say & Jump drives reach from *how long the child
  spoke* in that mode. This is an OS behaviour — **Expo would not change it**.
- **`env(safe-area-inset-top)` is the display cutout, not the status bar.**
- **A gyro-less phone fires `deviceorientation` forever with null angles.**
  `core/tilt.js` races three event types and takes whichever answers with real
  numbers.
- **Android's WebView accepts speech and says nothing** when there is no TTS
  engine. `getVoices()` also returns `[]` on its first call and fills in
  asynchronously.
- **`u.voice = v` throws** if the value is not a live `SpeechSynthesisVoice`.
  It used to sit in the same `try` as the rest of the utterance, so a rejected
  voice *preference* took the whole utterance with it.
- **Playwright's `page.mouse` fires pointer events**, which the engine binds —
  so it is not wrong, it is too clean. No jitter, no `pointercancel`, never two
  at once.

---

## The stack question, and where it stands

The user believes this stack is not Android-compatible and asked about porting
to the Expo/React Native stack from their `dottie` repo. The analysis, given to
them and **not yet answered**:

Dottie is a data app. Its entire rendering surface is `react-native-svg` plus
gradients and blur — no canvas, no game loop, no per-frame physics. Ten
Canvas-2D games cannot run on retained-mode SVG; that needs
`@shopify/react-native-skia`, which is **not in Dottie's stack**. So adopting
it is a ground-up rewrite of all ten games in a technology Dottie does not
itself use, and none of the composers, the physics solver, the tilemap auditor
or the juice module survive it. The one genuine platform constraint — the
recogniser owning the microphone — is identical under Expo.

Recommendation given: take Dottie's **input model** and **testing discipline**,
not its runtime. Both have since been acted on (`tools/stress-touch.mjs`, and
`tools/` was already the pattern).

If the user reaffirms the rewrite, scope it honestly as a rebuild and do it.
