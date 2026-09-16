# Lumi & the Sleepy Worlds — working notes

One offline-first **all-day** app for a household of children under 11:
**rhymes, games, create, learn, stories**. Vite + React 18 + TypeScript PWA,
Capacitor-wrapped for both stores. No backend, no accounts, no analytics.

**Bedtime is ONE product inside the app, not the app.** The day arc runs
05:00–18:00 as wake and play; those hours get full-strength game design —
progression ladders, collectibles, streaks, tilt and motion games, juice. Only
wind-down (18:00–05:00) is calm by design. Do not apply bedtime constraints to
the daytime app; that mistake was made repeatedly in earlier sessions.

**Branch:** `claude/bedtime-stories-app-6vk9be` · **Tests:** `npm test` (233)
**End goal:** ship to the **App Store and Google Play**. See `docs/STORE-READINESS.md`.

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
| Touching games, the microphone, or voice input | `docs/RESEARCH-GAMES.md` |
| Preparing a store submission, or asked what blocks launch | `docs/STORE-READINESS.md` |
| Asked for a new game, rhyme or feature idea | `docs/IDEAS.md` ← ranked, with reasoning |
| Touching the native shells, permissions or Info.plist | `docs/PLATFORM-CONFIG.md` |
| Changing layout, colour, components or the mascot | `.claude/skills/lumi-ui/SKILL.md` |
| Building or reviewing motion, touch, gestures, polish | the installed skills: `animate`, `mobile-native`, `apple-design`, `emil-design-eng` |
| Asked about Gemini's roadmap, or why we rejected part of it | `docs/ROADMAP-REVIEW.md` |
| Briefing an outside reviewer, or asked who the customer is | `docs/PROJECT-BRIEF.md` |
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
4. **The microphone measures loudness and nothing else.** No `MediaRecorder`, no
   retained buffer, no upload, and never `SpeechRecognition` — on Android it
   ships audio to Google. A voice *recording* is personal information under
   COPPA; an amplitude reading discarded every frame is not.
   (`RESEARCH-GAMES.md` §1)

## Architecture in one screen

```
src/
  content/   worlds.ts (18×12 stories) · arcs.ts (3 skeletons) · rhymes.ts (22)
             phonics.ts (5 sets) · colouring.ts (4 scenes) · games.ts · companions.ts
  engine/    generator · personalize · safety · rhyme · narration · dayArc
             voiceMeter · ttsEngine · providers · backdrop · rng · types.ts
  hooks/     useVoiceMeter.ts — owns the mic only while a game is mounted
  state/     store.ts  — localStorage only, per-child progress, seat limits
  components/ Today · RhymeList · RhymePlayer · WorldMap · StoryPlayer
              ColourStudio · LettersLab · GameArcade · ParentZone
              games/ LumisLeap · RhymeRace · WakeTheAnimal
              Mascot · MascotBuddy · Sky
```

- **Stories** compose from arc skeletons + per-world lexicons via a seeded RNG
  (`makeRng`), so `(child, world, episode)` is deterministic.
- **Day arc** (`engine/dayArc.ts`) is the spine: wake 5–11, play 11–18,
  wind-down 18–5. Wind-down stops *offering* lively pillars; it never locks them.
  Five pillars: rhymes, games, create, learn, stories.
- **Monetisation**: free to install, `TRIAL_SESSIONS` nights free, then a hard
  paywall. A night is one calendar day, not one app open. **A subscription tier
  is a live possibility the user will decide on later** — keep `Entitlement`
  extensible and never hardcode "one payment, forever" into logic or copy.
- **Games** grade by their own `minAge`/`maxAge`, not profile bands. Voice games
  reward hitting a target level, not maximum volume, and syllable mode requires
  one vocal burst per beat so a shout cannot fake a long word.
- **Sleep gradient**: `calm` 0→1 across a story drives palette, dimming,
  narration rate, and the mascot's eyes.
- **Rhymes**: declared `rhymeGroups` are the authority on what rhymes;
  `rhymeKey()` is only a fallback for unseen words. English spelling cannot
  resolve `head`/`red` or `goes`/`knows`.

## Commands

```bash
npm install && npm run dev      # localhost:5173
npm run typecheck               # tsc --noEmit
npm test                        # 217 tests, must stay green
npm run build                   # tsc -b && vite build
npm run smoke                   # browser walk + screenshots; needs a preview
                                # server: (setsid npx vite preview --port 4173 &)
```

CI runs typecheck, test, build and the browser smoke on every push and PR
(`.github/workflows/ci.yml`). The smoke scripts exit non-zero on any page or
console error, so a green CI run means the app actually loaded and worked.

## Conventions

- Comments explain **why**, never what. Match surrounding density.
- Every content corpus has a **validator test** (`validateRhyme`, phonics
  decodability, closed colouring paths). Add one for any new corpus — they have
  already caught several authoring errors.
- Design tokens live in `src/styles/tokens.css` (the Midnight defaults);
  `content/themes.ts` swaps palettes by overriding the same names on `:root`.
  Six palettes, dark and light. Must work at 390px.
- Long lists are horizontal `.shelf` rows; short sets are `.tiles` grids, two
  across at phone width. Check the `minmax()` arithmetic before changing it.
- No new runtime dependencies without a reason. Currently only `react` +
  `react-dom`.
- Speech goes through `engine/ttsEngine.ts`. Any engine must be `local: true` —
  `registerEngine` throws otherwise, because cloud TTS breaks rule 1.
- **`src/__tests__/privacy.test.ts` pins the privacy policy to the code.** It
  fails if anything adds a network call, an analytics dependency, a
  `MediaRecorder`, `SpeechRecognition`, or a second place that persists data.
  A policy that contradicts the app is a store *removal*, not a warning — if one
  of those tests fails, change the code, not the test.
