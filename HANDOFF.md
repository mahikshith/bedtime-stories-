# Handoff

State of the original handoff as of `d647b0f`, with the current branch update below. Read `CLAUDE.md` for how to work here and
`MEMORY.md` for what has already been decided and tried. This file is only
*where things stand and what is next*.

## Current branch update — Android-first polish

The user explicitly requested a new branch from `claude/game-feel-studio-polish`.
`codex/wordquest-android-polish` starts at `7ea4499`; see its latest commit
for the work below. The earlier instruction to continue on the old branch
is superseded for this round.

- Say & Jump now offers a persistent Voice / Touch / Both choice on its game
  screen and in-game. Touch mode skips mic startup and has a large jump button,
  a walking pad, independent pointer IDs, and a safe cancellation path.
- The welcome and game shelf use a warmer, more legible hierarchy and make
  the chosen bird and the next game prominent without putting currencies in
  the child's first view. The existing Canvas thumbnails remain original.
- Shape Sorter is the first age-band pass: a `tiny` board has up to three
  distinct, larger shapes; `mid` keeps all original keys. Six-piece trays use
  two rows, and cancelled drags return to the tray.
- Balance's opening lesson now demonstrates its actual same-tray cancellation
  move. Children can tap a card and its highlighted shadow or drag; a deck tap
  adds to both trays. Cancelled gestures and stray second fingers cannot score.
- `PRODUCT.md`, root `DESIGN.md`, and `docs/POLISH-ROADMAP.md` record the new
  product and visual direction, staged game work, and a parent-facing purchase
  concept. No store billing or purchase UI has been added.

`npm run test:controls`, `npm run test:shape-band`, `npm run test:balance-input`, `npm run verify`,
`npm run build`, and `npx cap sync android` pass locally. CI now gates
Android-profile touch and voice checks. The browser suites and screenshot review are
blocked here: Chromium is absent and the Playwright download was an invalid
archive. Check CI after push and try the resulting APK on a physical Android
phone before claiming native touch, TTS, or safe-area success.

Next: run the browser and finger suites in CI, fix anything they find, then
take one remaining age-band game at a time. Keep the original detailed
handoff below for known gameplay issues and device history.

---

## Branches

| Branch | Head | What is on it |
|---|---|---|
| `claude/game-feel-studio-polish` | `d647b0f` | **The live branch.** Game feel, page transitions, touch, the whole voice stack |
| `claude/kids-games-voice-control-bx4pku` | `c8dc421` | The parent. Say & Jump winnability. Already contained in the branch above |
| `main` | `fdc6c8b` | Well behind. Nothing merged back yet |

Continue on `claude/game-feel-studio-polish` unless told otherwise — it was
opened at the user's request for the "big studio polish" round, and they chose
*finish and land it first* over starting anything new. **No pull request has
been opened, and none should be without being asked.**

CI (`.github/workflows/android.yml`) builds a debug APK on every push to any
branch, and runs `npx cap sync android` — so a newly added Capacitor plugin
reaches the APK with no workflow change. The user installs that APK and plays
it on a physical Android phone. That is where every bug in this project has
been found first, and it is the only test that has ever found them first.

---

## What landed, most recent first

| Commit | What |
|---|---|
| `d647b0f` | Native TTS on Android, and the app knows when it has no voice |
| `d9e3ac2` | The microphone listens to the child instead of the room |
| `ce7dd73` | Every game driven by a real finger; the tap bug that found |
| `57f40e5` | `CLAUDE.md` and `HANDOFF.md` |
| `85fab1d` | The app can no longer hear its own voice |
| `ce7dd73`/`fd74736` | Robot Path and Sliding Blocks accept a tap |
| `43c479a` | Shared game feel; no more white flashes between screens |
| `c8dc421` | All 15 Say & Jump levels finishable |

**Green at handoff:** `npm test` (27 pages + hub, slide, robot, balance, town),
`npm run test:voice` (mic gate 20, noise 10, tts 10, voice jump 9),
`npm run test:touch` (10 games, 86 assertions), `test-winnable` 15/15.

### The voice stack, in one place

Goals 1–3 were all one underlying fault — **nothing in the app knew what the
hardware was doing** — and they are now three cooperating pieces:

- `audio.js` owns a **speaker gate** (`duckMic` / `speakerBusy` /
  `speakerIdle`). It is the only module that knows when a sound is playing.
- `voice.js` **disbelieves the microphone** while the gate is shut, and tracks
  the room as a live percentile rather than a startup measurement.
- `native.js` provides a **real TTS engine**, and `speechWorking()` reports
  whether anything actually came out.

If you touch any of them, read the "Numbers" section of `MEMORY.md` first.
Several of those constants are load-bearing in non-obvious ways.

---

## Next, in order

The user asked for goals one at a time rather than a broad sweep. Goals 1–3
are done.

### Goal 4 — voice/controller mode toggle  ← start here

The user asked for this explicitly: a joystick and a jump button, so Say &
Jump is playable in a noisy room, on a phone with a broken microphone, or by a
child who does not want to speak.

Most of the groundwork exists. Touch already always works (`down`/`up` in
`say-jump/game.js` hold-to-charge), and `this.speechOn` already falls back
after three misses. What is missing is that it is **invisible and automatic**
— the child cannot choose. Build:

1. A persistent setting (`save.state.settings`) for voice / touch / both.
2. An on-screen toggle inside the game, not buried in a menu.
3. A real controller when touch mode is on: a thumb-stick for walking and a
   jump button, rather than hold-anywhere-to-charge.

Check it with `npm run test:touch`, which already drives a real finger.

### Goal 5 — make the age bands change difficulty

Measured, not guessed: only **three of ten** games read the band —
`say-jump` (31 references), `word-mob` (15), `echo-pop` (5). **Zero** in
`tilt-maze`, `shapes`, `balance`, `robot`, `slide`, `tangram`, `town`. A
two-year-old and an eleven-year-old get an identical game in seven of them.
This is the largest single gap between what the app claims and what it does.

### Then: fonts

"Fonts too small and inconsistent across every game" was reported for every
screen and has not been addressed. It is the most-repeated item in the device
feedback and it touches every game, so it is worth doing as one deliberate
pass with a type scale rather than game by game.

---

## Still open from the device feedback

Roughly forty items came back from playing the APK. These are the ones not yet
addressed, grouped as the user reported them.

**Everywhere** — fonts too small and inconsistent. Power-up and power-down
animations. Auto-advance between levels. Telegraph every hazard before it can
hurt (task #34). Audit every action for feedback and sound (task #33).

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
birds. Needs a rebuild, not a patch. (Note: `test-balance` and the touch suite
both pass, so reproduce on the device before rewriting — the reported fault
may be the back button alone.)

**Sliding Blocks** — blocks should slide *under* at the destination. One
single expression. Highlight the destination, and it should not always be at
the bottom.

**Robot Path** — wasted UI space, monotone background.

**Tangram** — touch reported broken (the touch suite now passes, so reproduce
first). Shapes too small at the bottom. Not always triangles. Pronunciation on
completion.

**Tinker Town** — no aim, no points, no tutorial, no ending.

---

## Two decisions that need the user

Do not implement either without asking.

**Tangram photo upload.** Uploading a photo from the gallery to trace as a
tangram changes the permissions the app requests at install, in an app for
children. That is a product and store-listing decision, not a code one.

**Tinker Town's goal.** It was built deliberately as an open sandbox with no
goals (`docs/DESIGN.md` records why). Giving it a goal makes it a different
game. Worth asking whether they want a goal added, or the sandbox made more
legible *as* a sandbox.

---

## One open question the user has not answered

Whether to rewrite on Dottie's Expo/React Native stack. The full analysis and
the recommendation are in `MEMORY.md` under "The stack question". The short
version: Dottie has no canvas equivalent, so it is a ground-up rebuild of ten
games rather than a port, and the one genuine platform constraint is identical
under Expo. The parts worth taking — the input model and the testing
discipline — have already been taken.

---

## One thing that cannot be verified from here

Whether the native TTS plugin actually speaks on the user's phone. That needs
the next CI APK. **If HEAR IT is still silent after installing it, the button
will now read `NO VOICE`** — which turns a mystery into a fact about the
device, and is the signal to look at the plugin rather than the web path.
