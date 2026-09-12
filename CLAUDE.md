# Lumi & the Sleepy Worlds — working notes

One offline-first app for a household of children under 11: **rhymes, stories,
colouring, letters**. Vite + React 18 + TypeScript PWA, Capacitor-wrappable for
Play Store. No backend, no accounts, no analytics.

**Branch:** `claude/bedtime-stories-app-6vk9be` · **Tests:** `npm test` (110)

---

## Read this first, then stop

This file is loaded automatically every session. **The other docs are not** —
open one only when the table below says you need it. Reading all of them costs
tokens and usually tells you nothing you need.

| If you are… | Read |
|---|---|
| Picking up where the last session left off | `docs/HANDOVER.md` ← **start here** |
| About to change an architectural decision | `docs/DECISIONS.md` |
| Choosing what to build next | `docs/TODO.md` |
| Asked about business model, pricing, competitors, COPPA/Play policy | `docs/RESEARCH.md` |
| Asked about the four-pillar platform, day arc, rhyme theory, CoComelon | `docs/RESEARCH-PLATFORM.md` |
| Onboarding a human | `README.md` |

Don't re-derive research already in those files, and don't re-litigate a
decision in `DECISIONS.md` unless the user asks.

## Three rules that must never be broken

1. **Zero marginal cost in the daily loop.** Nothing in rhymes, stories,
   colouring or letters may make a paid API call. A one-time price against a
   recurring per-night cost makes every retained user a growing loss. Anything
   with a per-call price goes behind the **Wish Spark** meter. (`RESEARCH.md` §1)
2. **The child's name never leaves the device.** Content is authored with a
   `{child}` placeholder and substituted on-device at render time. Even the Wish
   Spark prompt is built with placeholders, so no model ever receives a name.
3. **The child never free-types into a model.** All inputs come from fixed,
   parent-approved vocabularies. Every generated story passes `checkStoryText()`
   before render; failures are discarded and recomposed, never patched.

## Architecture in one screen

```
src/
  content/   worlds.ts (18×12 stories) · arcs.ts (3 skeletons) · rhymes.ts (22)
             phonics.ts (5 sets) · colouring.ts (4 scenes) · companions.ts
  engine/    generator · personalize · safety · rhyme · narration · dayArc
             providers · backdrop · rng · types.ts
  state/     store.ts  — localStorage only, per-child progress, seat limits
  components/ Today · RhymeList · RhymePlayer · WorldMap · StoryPlayer
              ColourStudio · LettersLab · ParentZone · Mascot · MascotBuddy · Sky
```

- **Stories** compose from arc skeletons + per-world lexicons via a seeded RNG
  (`makeRng`), so `(child, world, episode)` is deterministic.
- **Day arc** (`engine/dayArc.ts`) is the spine: wake 5–11, play 11–18,
  wind-down 18–5. Wind-down stops *offering* lively pillars; it never locks them.
- **Sleep gradient**: `calm` 0→1 across a story drives palette, dimming,
  narration rate, and the mascot's eyes.
- **Rhymes**: declared `rhymeGroups` are the authority on what rhymes;
  `rhymeKey()` is only a fallback for unseen words. English spelling cannot
  resolve `head`/`red` or `goes`/`knows`.

## Commands

```bash
npm install && npm run dev      # localhost:5173
npm test                        # 110 tests, must stay green
npm run build                   # tsc -b && vite build
node scripts/walkthrough.cjs    # browser walkthrough + screenshots
                                # needs: npm i --no-save playwright, and
                                # npx vite preview --port 4173 running
```

## Conventions

- Comments explain **why**, never what. Match surrounding density.
- Every content corpus has a **validator test** (`validateRhyme`, phonics
  decodability, closed colouring paths). Add one for any new corpus — they have
  already caught several authoring errors.
- Design tokens live in `src/styles/tokens.css`. Night-first; there is no light
  theme by design. Must work at 390px.
- No new runtime dependencies without a reason. Currently only `react` +
  `react-dom`.
