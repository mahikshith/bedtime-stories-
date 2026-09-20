# Handoff

State of the work as of the end of the session that landed `85fab1d`.
Read `CLAUDE.md` first — it has the conventions and the traps. This file is
only *where things stand*.

---

## Branches

| Branch | Head | What is on it |
|---|---|---|
| `claude/game-feel-studio-polish` | `85fab1d` | **The live branch.** Game feel, page transitions, tap support, the microphone gate |
| `claude/kids-games-voice-control-bx4pku` | `c8dc421` | The parent. Say & Jump winnability. Merged into the branch above by history |
| `main` | `fdc6c8b` | Eight days behind. Nothing has been merged back yet |

Work continues on `claude/game-feel-studio-polish` unless told otherwise. It
was opened at the user's request for the "big studio polish" round, and they
chose *finish and land it first* over starting anything new. No pull request
has been opened, and none should be without being asked.

CI (`.github/workflows/android.yml`) builds a debug APK on every push to any
branch. The user installs that APK and plays it on a physical Android phone —
that is where the feedback in this file comes from, and it is the only test
that has ever found these bugs first.

---

## What landed this session

| Commit | What |
|---|---|
| `85fab1d` | The microphone gate: the app can no longer hear its own voice |
| `fd74736` | Robot Path and Sliding Blocks accept a tap, not only a drag |
| `43c479a` | Shared game feel — hit-stop, shake, squash — plus no more white flashes between screens |
| `c8dc421` | All 15 Say & Jump levels finishable; the jump band comes from simulated arcs |
| `c5e1e58` | Air drag modelled in the jump budget; arcs land only on tops |

Green at the point of handoff: mic gate 20/20, voice jump 9/9, 15/15 Say &
Jump levels winnable, 27/27 pages smoke clean.

(The `85fab1d` commit message says "mic gate 14/14". That count was written
before the last two assertions were added; the test has 20 and all pass.)

### The microphone gate, in one paragraph

Worth knowing before touching anything audio. The phone's microphone is two
inches from its speaker, so anything the app says is the loudest thing in the
room. Three faults came out of nothing in the app knowing that: the loudness
meter spiked while the app spoke and jumped the bird with the child silent;
the noise floor — calibrated from the first half-second, which is exactly when
the level reads the word aloud — got set to the app's own volume, putting a
real child permanently underneath it; and the recogniser was handed the app's
own pronunciation by `askWord` and reported a match, so the game answered its
own question. `audio.js` now owns a gate (`duckMic` / `speakerBusy` /
`speakerIdle`) and both input paths consult it. `tools/test-mic-gate.mjs`
plays the app's voice into its own microphone to prove it.

The floor bug is the one to remember: it is silent, it persists for the whole
session, and it is indistinguishable from a dead microphone. No amount of
threshold tuning would have found it.

---

## Next, in order

These were agreed with the user as one-at-a-time goals. Goal 1 is done.

**Android touch stress test** — started, not written. The engine binds
`pointerdown`/`move`/`up`, which `page.mouse` does fire, so the existing tools
were not wrong so much as *too clean*. A real finger jitters 3–10px between
down and up, fires `pointercancel` when the browser steals the gesture for a
scroll, and can land twice at once. Robot Path and Sliding Blocks both branch
on `moved < 20`. Build it against a real Android device profile
(`hasTouch: true`, `isMobile: true`, `page.touchscreen`) covering: a jittery
tap, a drag, a cancelled drag, two simultaneous touches, and a 40-tap mash —
across all ten games, asserting no page errors and that the control responded.
This is the most likely home of the remaining unexplained device reports.

**Goal 2 — make the mic less trigger-happy.** *"It recognizes external
noises… too sensitive."* Current values in `core/voice.js`: `onThreshold`
0.16, `offThreshold` 0.09, floor `clamp(median * 1.7, 0.006, 0.08)`. Raise the
on-threshold, require a level *sustained* over several frames rather than a
single spike, and recalibrate harder in a loud room. Do not start this without
re-reading the floor bug above — the gate changed what the floor sees.

**Goal 3 — make HEAR IT actually speak on Android.** Unknown whether
`speechSynthesis` has any voices in the Capacitor WebView. Diagnose first; add
a native TTS path if it is silent. Note the gate is bounded by a length
estimate precisely so a TTS engine that never fires `onend` cannot wedge the
microphone shut.

**Goal 4 — voice/controller mode toggle.** A joystick and a jump button, so
Say & Jump is playable in a noisy room or by a child who does not want to
speak. The user asked for this explicitly.

**Goal 5 — make the age bands change difficulty.** Measured, not guessed:
only **three of ten** games read the band at all — `say-jump` (31 references),
`word-mob` (15), `echo-pop` (5). Zero in `tilt-maze`, `shapes`, `balance`,
`robot`, `slide`, `tangram`, `town`. A two-year-old and an eleven-year-old get
an identical game in seven of them. This is the largest single gap between
what the app claims and what it does.

---

## Still open from the device feedback

Roughly forty items came back from playing the APK. These are the ones not yet
addressed, grouped as the user reported them.

**Everywhere** — fonts too small and inconsistent across every game. Power-up
and power-down animations. Auto-advance between levels. Telegraph every hazard
before it can hurt (task #34). Audit every action for feedback and sound
(task #33).

**Say & Jump** — separate the speaker button from the word card. Predators at
the bottom (crocodile, fish) and flying ones (raptors). Mario-style pipes and
sky platforms. Bird bullets; enemy bullets that currently neither cross nor
hit. Fire reads as feeble. A nest-with-family ending instead of a flag. Bird
colour not applying. Only two expressions. A black dot follows the bird's
jump. Screen flash / shrink / red blink on taking a hazard.

**Word Mob** (task #30) — four columns instead of three. Drop the red/green
coding. Varied villains, including dynamite with a visible fuse. Villains
should fall off-screen rather than vanish. An urgency meter. Weather should
affect the predators too.

**Shape Sorter** (task #31) — multiple shapes at once, off the bottom edge, a
penalty for mistakes.

**Tilt Maze** — the yellow ball should be the blue mascot.

**Balance** — reported completely broken, back button dead. Blobs should be
birds. Needs a rebuild, not a patch.

**Sliding Blocks** — blocks should slide *under* at the destination. One
single expression. Highlight the destination, and it should not always be at
the bottom.

**Robot Path** — wasted UI space, monotone background.

**Tangram** — touch reported broken. Shapes too small at the bottom. Not
always triangles. Pronunciation on completion.

**Tinker Town** — no aim, no points, no tutorial, no ending.

---

## Two decisions that need the user

Do not implement either of these without asking.

**Tangram photo upload.** The user asked to upload a photo from the gallery to
trace as a tangram, with a privacy notice. Adding camera or gallery access
changes the permissions the app requests at install, and this is an app for
children — that is a product and a store-listing decision, not a code one.

**Tinker Town's goal.** The user said it has no aim, no points and no ending.
Tinker Town was built deliberately as an open sandbox with no goals
(`docs/DESIGN.md` records why). Giving it a goal makes it a different game.
Worth asking whether they want a goal added or the sandbox made more legible
as a sandbox.

---

## One thing the user believes that the evidence does not support

The user's view, stated directly: *"the tech stack used in this project I
believe is not at all compatible with Android"*, and a request to port to the
Expo/React Native stack used in their `mahikshith/dottie` repo.

That repo could not be read — GitHub access in that session was scoped to this
repository only — but the user pasted the full stack. The analysis, delivered
to them and not yet answered:

- Dottie is a **data app**. Its entire rendering surface is `react-native-svg`
  plus gradients and blur. There is no canvas, no game loop, no sprite path
  and no per-frame physics. Ten Canvas-2D games cannot run on retained-mode
  SVG; that would need `@shopify/react-native-skia`, which is **not** in
  Dottie's stack. So "use Dottie's stack" is a ground-up rewrite of all ten
  games in a technology Dottie itself does not use, and none of the composers,
  the physics solver, the tilemap auditor or the juice module survive it.
- The one genuine platform constraint — Android's recogniser taking the
  microphone exclusively — is **identical under Expo**, because
  `expo-speech-recognition` wraps the same OS `SpeechRecognizer`.
- The CI APK has been installed and played on the phone through more than a
  dozen builds. Every defect reported from it traced to a code bug: drag-only input, seven games never reading the age band, a phone
  with no gyroscope, `env(safe-area-inset-top)` reporting the display cutout
  rather than the status bar.

Recommendation given: steal Dottie's *input model*
(`react-native-gesture-handler`'s tap/drag disambiguation) and its *testing
discipline* (34 standalone scripts driving real state, no framework — already
the pattern in `tools/`), not its runtime. The user has not responded to this
yet. If they reaffirm the rewrite, scope it honestly as a rebuild rather than
a migration, and do it.
