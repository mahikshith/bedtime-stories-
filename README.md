# Lumi & the Sleepy Worlds

One offline-first app for a household of children under 11: **rhymes, stories,
colouring and letters**, personalised per child and read aloud by the device.

> **Read the research first.**
> - [`docs/RESEARCH.md`](docs/RESEARCH.md) — competitor teardown and the unit
>   economics that killed the original business model (one-time price against
>   per-night AI generation loses money in proportion to how well the app works).
> - [`docs/RESEARCH-PLATFORM.md`](docs/RESEARCH-PLATFORM.md) — why "CoComelon in
>   the app space" copies the wrong half of that model, why Khan Academy Kids
>   makes "learning" a supporting pillar rather than the headline, and how the
>   day arc resolves the contradiction between "keep them engaged" and "the app
>   that ends the session".

## The spine: one app that knows what time it is

| Mode | When | What it offers | Engagement posture |
|---|---|---|---|
| **Wake** | 5am–11am | Rhymes, movement, counting | Loud and active. Engagement is *good* here. |
| **Play** | 11am–6pm | Colouring, letters, rhyme games | Interactive and co-played, never passive. |
| **Wind-down** | 6pm–5am | The bedtime story, the sleep gradient | Engagement is the **enemy**. The app dims and ends. |

Nothing is ever locked — a locked app at 7pm starts an argument — but wind-down
stops *offering* the lively pillars and says why. The tracked metric is **nights
settled**, not DAU.

## The four pillars

- **Rhymes** — 22 rhymes: 10 traditional (pre-1928 lyrics, public domain) and 12
  originals written for Lumi. Word-by-word karaoke highlighting, a dropped final
  word for the child to supply, two-voice call-and-response, and actions to tap
  the beat. Ends in a rhyme-matching game. Nursery-rhyme knowledge is one of the
  strongest predictors of later reading, so this is the best-evidenced pillar in
  the app.
- **Stories** — 18 worlds × 12 episodes, composed on-device, with the sleep gradient.
- **Colour** — **print-first**. The page is generated from the world of last
  night's story and carries the child's name; the primary button sends it to a
  printer, because crayon-on-paper builds the pincer grasp that tapping a screen
  does not. On-screen colouring stays for the car.
- **Letters** — a science-of-reading scope and sequence (s, a, t, p first; short
  vowels a, i, o, e, u so /i/ and /e/ never sit adjacent), so the child reads a
  real word in the first set.

---

## Pricing: one household, one price

| | Price | Children |
|---|---|---|
| **Starlight Family** | $12.99 once | up to 4, each with their own name, companion, age and progress |
| Starlight | $6.99 once | 1 |
| Wish Sparks | $2.99 / 20 | pooled across the family |

Multi-child is a **feature of the purchase, not a multiplier on it**. ABCmouse
includes three profiles in its base subscription; per-child billing is what
parental-control apps do, and parents resent it.

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
  content/     worlds.ts (18) · arcs.ts (3 skeletons) · rhymes.ts (22) ·
               phonics.ts (5 sets) · colouring.ts (4 scenes) · companions.ts
  engine/      generator · personalize · safety · narration · rhyme · dayArc ·
               providers · backdrop · rng
  state/       store.ts — on-device only, no server, no account, per-child progress
  components/  Today · RhymeList · RhymePlayer · WorldMap · StoryPlayer ·
               ColourStudio · LettersLab · ParentZone · Mascot · MascotBuddy · Sky
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
npm test          # 110 tests
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

**Rhymes.** Traditional lyrics published before 1928 are public domain in the US
and every one in the corpus records its date and source. Only the *words* are
free — specific recordings and arrangements carry their own copyright — so no
existing arrangement is reproduced and all audio is generated on-device. A test
asserts that anything marked `traditional` predates 1928. The 12 originals are
the ownable asset: they carry `{child}` and `{companion}` slots and tie to the
eighteen worlds.

Lumi is an original character. The mascot was designed from the principles that
make a mascot readable — one big silhouette, oversized eyes, a single strong
colour, one signature feature that survives a 24px icon — and not from any
existing character.

## Status

A working prototype of the whole day: onboarding → parental gate → paywall →
child setup → **Today** (day arc) → any of the four pillars → parent zone.

Working end to end: rhymes with karaoke, cloze and the rhyme game; stories with
narration and the sleep gradient; print-first colouring with on-screen fallback;
letters with the phonics sequence; multi-child family profiles with per-child
progress.

Stubbed: payments (no card is requested and no payment is taken) and Wish Spark
generation (the provider abstraction and cost model are real; there is no API
key wired up, and the library serves every story).

Not built yet: crafts beyond colouring, music and cartoons. Those are v3 — see
`docs/RESEARCH-PLATFORM.md` §8 on why the bottleneck moves from code to content,
and why four pillars done well beats six done thinly.
