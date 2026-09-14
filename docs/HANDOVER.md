# Handover — read this first

**Last updated:** session 3 (2026-09-14)
**Branch:** `claude/bedtime-stories-app-6vk9be`
**State:** green — 172 tests pass, `npm run build` clean.
**End goal:** ship to the **App Store and Google Play** — `STORE-READINESS.md`
is the gap list.

> **Sessions 2 and 3 are committed but NOT pushed.** The user asked to hold the
> push until they say so. Do not push without being asked.

> **Voice input is unverified on a device.** This sandbox has no audio stack, so
> Chromium cannot synthesise even a fake microphone
> (`NotFoundError: Requested device not found`). The smoke test therefore
> exercises the *no-microphone fallback*, which works. The live meter is covered
> by unit tests only until someone runs it on a handset.

---

## Where we are

A working prototype of the whole day. Onboarding → parental gate → paywall →
child setup → **Today** (day arc) → any of four pillars → parent zone.

| Pillar | State |
|---|---|
| **Rhymes** | Done. 22 rhymes (10 traditional pre-1928, 12 originals). Word-by-word karaoke, dropped-word cloze, two-voice call-and-response, actions, rhyme-matching game. |
| **Stories** | Done. 18 worlds × 12 episodes, seeded and deterministic, sleep gradient, Real Window fact card. |
| **Colour** | Done. Print-first, 4 scenes, scene chosen from last story's world, child's name as outline text, on-screen fallback with crayons. |
| **Letters** | Done. 5 phonics sets on a science-of-reading sequence, separate display/spoken forms per letter. |
| **Family** | Done. Up to 4 children on one household price, per-child progress, profile switcher. |
| **Parent zone** | Done. PIN gate, nights-settled metric, published Spark cost table, voice settings, safety/AI disclosure, **household management** (add/remove/switch child, seat counter). |
| **Games** | Arcade + 4 playable (Wake the Animal, Lumi's Leap, Syllable Hop, Rhyme Race); 3 catalogued as planned. Rendering and the no-mic fallback verified in a browser; the live meter is not. |
| **Privacy** | In-app policy screen + `dist/privacy.html` generated from one JSON source. Tests pin the policy's claims to the code. |
| **CI/CD** | Done. GitHub Actions: quality gate + browser smoke, plus a Pages deploy workflow. |

**Stubbed on purpose:** payments (no card requested, no payment taken) and Wish
Spark generation (provider abstraction and cost model are real; no API key is
wired, the library serves every story).

**Not built:** crafts beyond colouring, music, cartoons. See `TODO.md`.

## What the user decided (do not re-litigate)

- Day-arc spine, four pillars, household pricing at $12.99 once for up to four
  children. $6.99 for one. Wish Sparks $2.99/20, pooled.
- **On-device TTS only.** No cloud TTS in the daily loop, ever.
- **No live image APIs.** Bundle a curated folder of images instead.
- On-device image generation: interesting, explicitly **deferred** — research
  later, not now.

Full reasoning in `DECISIONS.md`.

## Done in session 2

- **CI/CD.** `.github/workflows/ci.yml` (typecheck → test → build → upload the
  built app; then a browser smoke job that walks onboarding → rhyme → cloze →
  rhyme game → colour → letters → household, and uploads screenshots).
  `.github/workflows/pages.yml` deploys the build to GitHub Pages.
  **Pages needs enabling once**: Settings → Pages → Source: "GitHub Actions".
- **Smoke scripts made portable.** They hard-coded this sandbox's Chromium path
  and always exited 0. Now `scripts/lib/browser.cjs` resolves a browser and both
  scripts set a non-zero exit code on any page or console error, so CI can fail.
- **TODO §6 cleared**: household management in the parent zone, per-pillar
  progress on Today, undo in ColourStudio, reprint list.
- **TTS made pluggable** (`engine/ttsEngine.ts`) so the §2 spike does not have
  to touch callers. `registerEngine` throws on a non-local engine, so cloud TTS
  cannot be added by accident.
- **Capacitor config scaffolded** (`capacitor.config.json`, `android:sync` /
  `android:open` scripts). **Unverified** — there is no Android SDK in this
  environment, and the `@capacitor/*` packages are deliberately not installed.

## Done in session 3

- **Games, a fifth pillar.** `engine/voiceMeter.ts` reads microphone amplitude
  and discards every frame: no recording, no upload, and never
  `SpeechRecognition` (it is cloud on Android). `content/games.ts` grades games
  by their own age range. `GameArcade` plus `games/LumisLeap`, `games/RhymeRace`,
  `games/WakeTheAnimal`.
- **Syllable mode**, because volume alone lets a child shout "aaah" and win
  without saying the word. One burst per syllable; a test asserts a long shout
  counts as one.
- **Room calibration** from the median of ~900ms of ambient noise, so a child
  never has to out-shout a television.
- `docs/RESEARCH-GAMES.md` — competitor scan, the COPPA architecture, and why
  the youngest band starts at 2 and is co-play only.

## Also done in session 3

- **Ran the games smoke and found two real bugs.** Hard media constraints
  (`autoGainControl: false`) threw `OverconstrainedError` on devices that cannot
  honour them, killing the mic for a reason unrelated to permission — now asked
  as `ideal` with a plain `audio: true` retry. And a refusal is now told apart
  from a broken or busy microphone, because the wording a parent needs differs.
- **Extracted `scoreAttempt()`** so the rule deciding whether a child succeeded
  is testable without a microphone. Writing those tests showed the syllable
  mode's audible floor was almost dead code; it now only guards the degenerate
  zero-syllable case, and says so.
- **Store work**: in-app privacy policy, `dist/privacy.html` from the same JSON,
  iOS added to the Capacitor config, `PLATFORM-CONFIG.md` for the permission
  entries the gitignored shells need, and `STORE-READINESS.md`.
- **`privacy.test.ts` pins the policy to the code** — it fails if anything adds
  a network call, analytics dependency, recorder, speech recognition, or a
  second persistence layer.

## What to do next

Ordered. Full detail in `TODO.md`.

0. **Decide pricing before the first submission** (`RESEARCH.md` §5,
   `STORE-READINESS.md` §5). Paid-upfront → free is one-way on both stores.
1. **Images — PAUSED by the user.** Do not start this without being asked.
2. **On-device TTS spike** — the interface is ready; what remains is measuring a
   real Piper/Kokoro voice on a low-end Android profile. `TODO.md` §2.
3. **Build both native shells and test the voice games on a handset.** That is
   the one path no test here can cover. `PLATFORM-CONFIG.md` has the manifest
   and Info.plist entries needed first.
4. Icons, screenshots, a real privacy contact address, and hosting for
   `privacy.html`.
5. IAP behind the existing `purchase()` / `addSparks()` stubs.
6. Wish Spark provider behind a real key, still metered.

## Gotchas that already bit us

Each of these cost real time. They are all now covered by tests.

- **`addProfile` must not set `onboarded: true`.** Doing so unmounts the
  onboarding flow before the PIN step and leaves the parent zone **ungated**.
- **Token regex must allow digits** — `{wonder2}`, `{sound2}`, `{place2}` were
  silently rendering as literal braces to the child.
- **Sentence splitting must tolerate a closing quote after the stop**
  (`said, "For remembering." Behind them…` is two sentences).
- **Traits are appositives.** `"{companion} was {trait}"` produces "Sorrel was
  who always knew the way back". Use `"{companion}, {trait}, …"`.
- **Title articles**: strip the article only where the pattern supplies its own
  ("and the …"); keep it otherwise, and lowercase a leading article mid-title.
- **SVG `transform` attribute + CSS `transform-origin`** displaces the element.
  Position with geometry, animate with CSS only.
- **A synthesiser handed a bare consonant says the letter name** ("bee", not
  /b/). Hence separate `sound` (display) and `say` (TTS) fields in `phonics.ts`.
- **Playwright hangs on infinitely-animating elements** (the pulsing cloze
  blank). Use `click({ force: true })` in `scripts/walkthrough.cjs`.
- **Storage key is versioned** (`lumi.state.v2`). Bump it whenever the persisted
  shape changes, or old state deserialises into the new type and breaks.
  Additive fields no longer need a bump: `progressFor` and `patchProgress` merge
  over `EMPTY_PROGRESS`, so older saved progress cannot return an undefined array.
- **Two controls must never share an accessible name.** The profile editor and
  the add-a-child form both rendered "Ages 3-5", which is ambiguous to a screen
  reader and a strict-mode violation in Playwright. Both now carry a name saying
  which child they affect.
- **Don't hardcode a price in copy.** The Spark card quoted "$6.99" to Family
  buyers who paid $12.99. Use `pricePaid(state)`.
- **`pkill -f "vite preview"` kills this shell's own process group** (exit 144).
  Start the preview with `setsid` and leave it running instead.

## How to verify quickly

```bash
npm run typecheck && npm test && npm run build   # all three must be clean
```

For a visual check:
```bash
(setsid npx vite preview --port 4173 --strictPort &) ; sleep 5
SHOT_DIR=/tmp/shots npm run smoke     # both scripts; exits non-zero on any error
```
`playwright` is a devDependency now, so `npm install` is enough. Screenshots go
to `$SHOT_DIR`, defaulting to the scratchpad path in `scripts/lib/browser.cjs`.
