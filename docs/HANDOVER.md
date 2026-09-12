# Handover — read this first

**Last updated:** end of session 1 (2026-09-12)
**Branch:** `claude/bedtime-stories-app-6vk9be` (2 commits, pushed, no PR opened)
**State:** green — 110 tests pass, `npm run build` clean, no console errors in
the browser walkthrough.

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
| **Parent zone** | Done. PIN gate, nights-settled metric, published Spark cost table, voice settings, safety/AI disclosure. |

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

## What to do next

Ordered. Full detail in `TODO.md`.

1. **Bundled image library** (user asked for this) — curate public-domain
   images into `public/img/`, with a manifest and a credits file. Replaces the
   never-called archive endpoints in `engine/backdrop.ts`.
2. **On-device TTS research spike** — decide between platform `speechSynthesis`
   (what we ship now: on-device, free, 0 bytes) and bundling a neural voice
   (Piper/Kokoro via ONNX + WASM: better and brand-consistent, but tens of MB
   and slow on low-end Android). Recommendation is in `TODO.md` §2.
3. Wire Play Billing + the Capacitor Android shell.
4. Wish Spark provider behind a real key, still metered.

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

## How to verify quickly

```bash
npm test && npm run build     # must both be clean
```

For a visual check:
```bash
npm i --no-save playwright
npx vite preview --port 4173 &
node scripts/walkthrough.cjs          # onboarding → rhyme → game
node scripts/pillars-shot.cjs         # colour + letters
```
Screenshots land in the scratchpad directory named at the top of each script.
