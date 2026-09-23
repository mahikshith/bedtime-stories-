# Android-first polish roadmap

Small completed steps are recorded here so future sessions resume from evidence instead of restarting a redesign.

## 0. Read and baseline — complete

- Read `README.md`, `docs/STACK.md`, `docs/DESIGN.md`, `CLAUDE.md`, `HANDOFF.md`, `MEMORY.md`; map the ten scenes, shared engine, art, save, native bridge, and browser tools.
- Create `codex/wordquest-android-polish` from `claude/game-feel-studio-polish` at `7ea4499`.
- Confirm all authored platformer, robot, and balance levels pass `npm run verify`.

## 1. One reliable, legible Android play slice — implemented; phone check pending

- Make Say & Jump's Voice / Touch / Both choice visible and saved, with a large jump action and optional directional pad that do not collide with the word prompt.
- Skip microphone startup in Touch mode and guard against stale recognizer responses after switching modes.
- Rework the welcome/shelf hierarchy and type for a 360–420 px Android phone while preserving the existing original thumbnails.
- Check first-run, touch cancellation, repeat play, browser voice fallback, and the built offline bundle. Get a physical APK verdict before treating native speech or safe areas as proven.

Checks in the Windows clone: `npm test`, `npm run test:touch`, `npm run test:voice`, `npm run test:app`, `npm run verify`, and `npx cap sync android` pass with Playwright Chromium. The offline game check exposed a service worker cache miss on game URLs with query parameters; it is fixed. Android speech and status-bar checks still need the APK on a phone.

## 2. Make the age choice real in every game — Shape Sorter done, six remaining

Define a difficulty contract per scene. For tiny: fewer choices, larger targets, no loss; mid: teaching hints then fewer; big: deeper planning or distractors. Audit the seven games named in `HANDOFF.md` that currently ignore `band`. Change one scene, prove its level path, and only then move to the next. Never silently make existing saved levels impossible.

Shape Sorter now uses three distinct shapes at most for `tiny`, while `mid` retains the original boards. A six-piece tray uses two rows; cancellation returns the tile instead of placing it. `test:shape-band` checks the age-specific layout and touch target size.

## 3. Game feel and content, one game at a time

For each scene: reproduce device complaints; identify its first 30 seconds and action feedback; author/verify new levels with its existing solver; refresh one coherent set of original Canvas art and sounds; test real touch on Android; record a device verdict. Prioritize Balance and Tinker Town's comprehension, Shape Sorter's multi-object play, then Tangram/Slide/Robot, Tilt Maze, Word Mob and Echo Pop. Keep Tinker Town open-ended.

Balance first interaction: the old coach taught a move the rules do not allow. The first board now teaches the real same-tray day/night match; tapping either card and then its glowing twin cancels them. A deck tap adds a card to both trays. A cancelled or second finger cannot complete another finger's move. `npm run test:balance-input` covers those paths; physical Android comprehension and browser playtest are still pending.

## 4. New original games

Prototype Feather Kitchen, Moonlight Post, and River Builders separately. Add only a prototype that can teach its core action in five seconds, run offline, and produce delight without timers or purchases. A new game joins the shared boot, art, audio, input, save, coach and verification contracts.

## 5. Parent-facing business model and release

Start with a genuinely generous free core. Evaluate a one-time family expansion pack through native store billing behind a parent gate, with transparent pricing, restoration and offline entitlements. Do not implement purchases until product content, Google Play Families/Apple Kids rules, billing integration, and a parent's consent flow have been validated. No ads, pay-to-revive, or streak penalties. Produce a release-signed Android bundle and privacy/store materials only when the app ID and signing owner are chosen; then validate iOS on a physical device.
