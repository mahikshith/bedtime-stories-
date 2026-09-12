# Lumi & the Sleepy Worlds

Offline-first, personalised bedtime stories for children under 11.

Eighteen hand-authored worlds, personalised with the child's name at render time,
read aloud by the device, and built to **end** the evening rather than extend it.

> **Read [`docs/RESEARCH.md`](docs/RESEARCH.md) first.** It contains the competitor
> teardown, the unit economics, and the reason the original business model
> (one-time price + per-night AI generation) would have lost money in proportion
> to how well the app worked.

---

## The one idea that makes this work

A bedtime app is used *nightly*. Generating a story, four illustrations and
narration costs roughly **$0.05–0.41 per story**, so nightly use costs
**$1.41–12.30 per child per month**, forever. Against a one-time $6.99 purchase,
every retained user becomes a permanent, growing loss.

So the product is split along the marginal-cost line:

| | Marginal cost | How it works |
|---|---|---|
| **The library** (216 stories) | **$0.00** | Hand-authored arcs + per-world lexicons, assembled on-device with a seeded RNG. The child's name is substituted at render time. |
| **Wish Sparks** (metered) | ~$0.115 | A genuine AI generation, for when the child wants something the library doesn't have. |

Render-time personalisation delivers most of the "it's about *me*" feeling at
none of the cost, with no latency, and **works with no network at all** — which
matters, because bedtime happens on planes, in cars and at grandma's house.

## Architecture

```
src/
  content/     worlds.ts (18 worlds) · arcs.ts (3 narrative skeletons) · companions.ts
  engine/      generator · personalize · safety · narration · providers · backdrop · rng
  state/       store.ts — on-device only, no server, no account
  components/  Onboarding · WorldMap · StoryPlayer · ParentZone · Mascot · MascotBuddy · Sky
```

**Story generation.** Three 7-stage arc skeletons (call → threshold → wonder →
wobble → helper → resolve → settle), each stage holding sentence slots with
variants. A world contributes a lexicon (places, guides, wonders, obstacles,
gentle things, sounds, treasures) plus signature paragraphs so no two worlds
read alike. A seeded RNG picks one variant per slot, so a given
(child, world, episode) always yields the same story and different episodes
yield genuinely different ones.

**The sleep gradient.** Every story de-escalates towards `calm = 1`: sentences
shorten, the palette warms, the screen dims to amber, narration slows by ~18%,
and Lumi's eyes close. Whatever pace you choose, a story always ends calmer
than it began.

**Reading aloud.** Voice personas (*like a parent*, *like a storyteller*,
*like another child*, *my device voice*) are a voice-selection heuristic plus a
pitch/rate treatment over whatever voices the device actually has — the only
approach that still works offline. Four pace settings, all shaped by the sleep
gradient.

## Safety and privacy, by construction

- **The child's name never leaves the device.** Stories are composed with a
  `{child}` placeholder and personalised on-device. Even the Wish Spark prompt
  is built with placeholders, so the model never receives a name.
- **Children never free-type into a story.** Every input comes from a fixed,
  parent-approved vocabulary. There is no open-ended chat with a model.
- **Every story passes a deterministic safety filter** before it renders.
  Failures are discarded and recomposed, never patched.
- **No accounts, no analytics, no ads, no tracking.** Nothing to breach,
  nothing to retain.
- **AI disclosure** is shown in the parent zone, as Google Play requires.
- A neutral arithmetic **parental gate** guards the purchase flow, and a PIN
  guards settings and Sparks — but never the stories themselves.

See `docs/RESEARCH.md` §2 for the COPPA and Play Families requirements these
map to.

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # 55 tests
npm run build     # typecheck + production build
```

### Browser walkthrough (optional)

`scripts/walkthrough.cjs` drives the whole flow and writes screenshots.

```bash
npm install --no-save playwright
npm run build && npx vite preview --port 4173 &
node scripts/walkthrough.cjs
```

## Packaging for Google Play

The app is a self-contained static PWA, so it wraps with Capacitor:

```bash
npm install -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init "Lumi" "com.example.lumi" --web-dir=dist
npm run build && npx cap add android && npx cap sync
npx cap open android     # then build a signed AAB in Android Studio
```

Play Console checklist before submitting:

- Opt into the **Families programme** and complete the content rating.
- Declare **AI-generated content** (Wish Sparks) in the app content section.
- Complete the **Data safety** form — this app collects nothing, which is the
  easy version of that form.
- Ship **no ad SDKs**. If that ever changes, only Play-certified ones, and
  non-personalised only.

### One recommendation against the original plan

List the app **free-to-install with a hard paywall on first run**, rather than
paid-upfront on the listing. The monetisation is identical — you still pay
before you get anything, there is still no free tier — but paid-upfront listings
are ~3% of Play installs while >95% of Play revenue comes from free-to-install
apps, because a price on the listing suppresses install velocity, ranking and
review volume all at once. Same paywall, roughly 5–10x the top of funnel.
Reasoning and numbers in `docs/RESEARCH.md` §1.

## Content licensing

Every "Real Window" fact is drawn from a public-domain archive (NASA, NOAA,
USGS, Smithsonian Open Access, Library of Congress) and credited in-app. NASA
imagery carries three conditions, encoded in `src/engine/backdrop.ts`: credit
NASA, never imply endorsement, and never use the insignia, logotype or seal.

Lumi is an original character. The mascot was designed from the principles that
make a mascot readable — one big silhouette, oversized eyes, a single strong
colour, one signature feature that survives a 24px icon — and not from any
existing character.

## Status

A working prototype of the full loop: onboarding → parental gate → paywall →
child setup → world map → story with narration and sleep gradient → Real Window
→ parent zone. Payments are stubbed; no card is requested and no payment is taken.
