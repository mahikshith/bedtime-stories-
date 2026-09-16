# Decisions

Short records of choices that are settled. Don't reopen one unless the user
asks. Reasoning and sources are in `RESEARCH.md` / `RESEARCH-PLATFORM.md`.

---

### D1 — Library-first, generation metered
Hand-authored content composed on-device at $0 marginal cost; only Wish Sparks
call a paid API. A one-time price against a recurring per-night cost makes every
retained user a growing loss (nightly use = $1.41–12.30/child/month against
$4.24 net from a one-time $6.99). *`RESEARCH.md` §1.*

### D2 — Child PII never leaves the device
Content authored with `{child}`; substitution happens on-device at render time.
Even the Wish Spark prompt uses placeholders. Makes COPPA compliance a property
of the architecture rather than a policy document, and costs nothing.

### D3 — Constrained generation, never open-ended chat
Children pick from fixed vocabularies. Every story passes a deterministic safety
filter before render; failures are discarded, not patched. Play holds the
developer liable for model output to children. *`RESEARCH.md` §2.*

### D4 — The day arc is the spine
Wake / Play / Wind-down. Resolves "one app for everything, keep them engaged"
against "the only app that tries to end the session". Wind-down stops *offering*
lively pillars but never locks them — a locked app at 7pm starts an argument.
The tracked metric is **nights settled**, not DAU. *`RESEARCH-PLATFORM.md` §4.*

### D5 — No gamification at bedtime
No streaks, XP, leaderboards, timers, evening push notifications, or a "next
episode" button. These are arousal mechanics and arousal is the failure mode the
parent bought the app to avoid.

### D6 — Household pricing, never per-child
$12.99 once for up to 4 children; $6.99 for one. ABCmouse includes 3 profiles in
its base price; per-child billing is what parental-control apps do and parents
resent it. Multi-child is a feature of the purchase, not a multiplier on it.

### D7 — Rhymes: traditional + original, no licensing spend
Pre-1928 lyrics are public domain in the US; only the *words* are free, since
recordings and arrangements carry separate copyright. So: use traditional words,
generate all audio on-device, reproduce no existing arrangement, and write
originals as the ownable asset. A test asserts `traditional` entries predate 1928.

### D8 — Declared rhyme groups outrank the spelling heuristic
English orthography cannot resolve `head`/`red` or `goes`/`knows`. The corpus
declares groups by ear and `buildRhymeIndex()` is the authority; `rhymeKey()` is
the fallback for words the corpus has never seen.

### D9 — Colouring is print-first
The primary button sends the page to a printer. Crayon-on-paper builds the
pincer grasp that tapping a screen bypasses, and printed pages hold attention
far longer. A feature whose main button takes the child off the screen is the
most parent-trusted thing we can ship. *`RESEARCH-PLATFORM.md` §6.*

### D10 — Learning is a supporting pillar, never the headline
Khan Academy Kids is free, ad-free and Stanford-backed. We cannot win breadth of
curriculum and must not try. Letters exists so the app nourishes.
*`RESEARCH-PLATFORM.md` §2.*

### D11 — On-device TTS only *(user decision, session 1)*
No cloud TTS in the daily loop, ever. A story is ~4,600 chars; nightly use is
~138k chars/month/child = $0.55 (Google WaveNet) to $6.90 (ElevenLabs) per child
per month against a one-time price. Premium voices, if ever added, live inside
the Spark meter. Current implementation already satisfies this: platform
`speechSynthesis` is on-device and free. Bundling a neural voice is an open
question — see `TODO.md` §2.

### D12 — No live image APIs; bundle a curated folder *(user decision, session 1)*
Archive endpoints in `engine/backdrop.ts` are declared but never called, and
stay that way. Images are curated once, licence-checked, and shipped in the
bundle. Keeps the app offline-first and the runtime cost at zero. On-device
image *generation* is deferred, not rejected.

### D13 — Every content corpus ships a validator test
`validateRhyme`, phonics decodability, closed colouring paths. These have caught
real authoring errors (a hyphenated end-word, a near-rhyme claimed as true, a
mis-scanned line). Any new corpus gets one.

### D14 — Speech goes through a pluggable engine interface *(session 2)*
`engine/ttsEngine.ts` owns the back-end contract; `platformEngine` is the
default. This keeps the D11 spike cheap: a bundled Piper/Kokoro voice is a new
implementation plus a `registerEngine` call, with no caller changes.
`registerEngine` throws on any engine that is not `local`, so cloud TTS cannot
be added by accident rather than merely being discouraged in prose.

### D15 — CI is a gate, not a notification *(session 2)*
GitHub Actions runs typecheck, tests, build, and a browser smoke walk on every
push and PR. The smoke scripts set a non-zero exit code on any page or console
error — before this they printed errors and exited 0, which is worse than no
test because it looks like a pass. A separate workflow deploys the build to
GitHub Pages so the app can be opened, not just downloaded.

### D16 — Additive state fields do not bump the storage key *(session 2)*
`progressFor` and `patchProgress` merge over `EMPTY_PROGRESS`, so progress saved
before a field existed cannot hand back an undefined array. Bumping the key
wipes real user data; reserve it for genuinely incompatible shape changes.

### D17 — The microphone measures loudness, never words *(session 3)*
Amplitude is read per frame and discarded: no `MediaRecorder`, no retained
buffer, no upload, and never `SpeechRecognition`, which is cloud-backed on
Android. A voice recording is personal information under COPPA and needs
verifiable parental consent; a discarded amplitude reading is not a recording.
The genre precedent does the same for latency reasons. If word recognition is
ever wanted it needs an on-device model, as a spike. (`RESEARCH-GAMES.md` §1)

### D18 — Games grade by their own age range *(session 3)*
Profiles stay 3-5 / 6-8 / 9-11; each game carries `minAge`/`maxAge`. The right
granularity for sentence complexity is not the right granularity for a syllable
task, and separating them means adding a game never churns the profile model.
The youngest band starts at 2, not 1, and is co-play only.

### D19 — No fail state in the voice games *(session 3)*
A missed platform costs another go. A four-year-old practising a new word should
never be punished for trying, and a fail state turns a confidence exercise into
a test. Reward is for hitting a target band, not for maximum volume — better for
vocal health, and better for the child who is always told to be quiet.

### D20 — Media constraints are preferences, never requirements *(session 3)*
`getUserMedia` asks for echo cancellation, noise suppression and no auto-gain as
`ideal`, with a plain `audio: true` retry behind it. As hard constraints they
throw `OverconstrainedError` on hardware that cannot honour them — which killed
the microphone in testing for a reason that had nothing to do with permission.
A working microphone without the hints beats no microphone at all. A refusal
(`NotAllowedError`) is final and is reported differently from a broken or busy
device, because the wording a parent needs is different.

### D21 — The privacy policy is generated from one source and tested *(session 3)*
Text lives in `content/privacy.json`; the in-app screen and `dist/privacy.html`
both render it, so they cannot drift. `__tests__/privacy.test.ts` pins each
claim to the code — no network calls, no analytics dependency, no
`MediaRecorder`, no `SpeechRecognition`, one persistence layer. A Data safety
form or Nutrition Label that contradicts the app is a store removal rather than
a warning, so those assertions are load-bearing: if one fails, change the code.

### D22 — Free to install, seven free nights, then a hard paywall *(session 3)*
Supersedes the paid-upfront listing in D1's original framing; the economics
(library-first, Sparks metered) are unchanged. A price on the store listing
suppresses install velocity, ranking and review volume at once, and paid-upfront
is ~3% of Play installs.

Seven nights, not two or three. Trials of four days or fewer convert at 25.5%
against 42.5% for 17-32 day trials, and a bedtime app is used once a night — so
"a couple of sessions" is a two-day trial, the worst-converting shape available.
Seven crosses a weekend, survives one bad night, and is the shortest window in
which the thing being sold (a ritual) can appear at all.

A night is one calendar day, not one app open: a child who opens the app three
times in an evening has had one bedtime.

### D23 — Wind-down gets its own genre, not a quieter version of a loud one *(session 3)*
Calming apps for children are passive; interactive ones are arousing. Lantern
Breath is interactive and calming, which is a category with nothing else in it.
`isGameEncouraged` offers only `calm` games during wind-down, and `detectBreath`
keys on steadiness rather than loudness specifically so that shouting cannot win
— otherwise the one calm thing in the app becomes another loud thing.

### D24 — Six palettes, chosen by the parent *(session 3)*
Supersedes "night-first, no light theme". `content/themes.ts` overrides the same
token names `tokens.css` declares, so no component knows a theme exists. The
picker lives in the parent zone: a four-year-old handed a colour switcher will
use it instead of the app.

Whichever palette is on, the sleep gradient still warms and dims on top, and the
story player forces its own dark room because worlds carry night gradients by
design. Contrast is enforced by test — 7:1 body, 3:1 on accent — and when a
bright accent fails, the text darkens rather than the accent, because children's
colour preference correlates with saturation and brightness and deep shades read
as negative to them.

### D25 — Lumi is a turquoise bird, and does not follow the theme *(session 3)*
The amber blob had no silhouette and no face. A bird gives a readable outline at
icon size; eyebrows give it emotion, which is what actually carries a mascot —
a face without them reads blank however big the eyes are. Nine moods, driven by
brow angle, eye openness, pupil direction, beak gape, wing lift and head tilt.

Colour is fixed across all palettes because a character that changes colour is a
shape, not a character. Vivid turquoise body with a sunny lantern belly and
coral beak and feet: complementary teal-against-coral is the highest-chroma
pairing available, which is why it stays legible on every palette.

Body motion is separate from facial mood: `action` covers idle, walk, fly and
spin, with legs pivoting at the hip and wings beating. The buddy layer picks the
gait from the distance travelled — a short move waddles, a long one flies — and
faces the direction of travel.

### D26 — Side-by-side, not stacked *(session 3)*
Activity lists were vertical rows a tired parent scrolled past. Short sets are
now two-across `.tiles` grids; long ones are horizontal `.shelf` rows grouped by
something meaningful (Lumi originals vs the old favourites, just-right vs other
ages). A tile peeking past the gutter is the affordance for "there is more".

### D27 — UI craft comes from the installed skills, not from this repo *(session 5)*

`.claude/skills/` vendors ten skills from
[emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT, commit
`85e8e23`): `animate`, `mobile-native`, `apple-design`, `emil-design-eng`,
`animation-vocabulary`, `find-animation-opportunities`, `improve-animations`,
`review-animations`, `prototype`, `pick-ui-library`. They are the authority on
general craft. `lumi-ui` was rewritten to hold **only** the kid-specific
overrides — emoji as the primary label, generous press feedback, saturated
colour, big type — each with the reason it diverges, so a later session does not
"correct" them back.

Three upstream skills were skipped: `animate-expo` (React Native, not our
runtime), `write-swift` (Capacitor generates the iOS shell; we author no Swift),
`ask-sonner` (a dependency we will never add).

This replaces the earlier Payoss-derived rules, at the user's instruction.

### D28 — The mobile platform layer is pinned by tests *(session 5)*

`src/__tests__/mobile.test.ts` pins the fixes that do not reproduce in a desktop
browser and are invisible in a screenshot: `viewport-fit=cover`,
`interactive-widget=resizes-content`, no `user-scalable=no`, a `theme-color` per
colour scheme, the killed tap highlight, `touch-action: manipulation`, 16px
inputs, `overscroll-behavior`, `100dvh`, safe-area padding, and the motion
tokens. Precedent is `privacy.test.ts`: a correctness property nobody can see is
a property that gets silently reverted.

### D29 — Verifiable Parental Consent is not required, because we do not collect *(session 5)*

Gemini's roadmap recommended credit-card VPC. Rejected: VPC is triggered by
*collection*, and building card-based consent would require a payment processor
and a server, creating the obligation it claims to discharge. The parental gate
stays an age screen. Reasoning in full in `docs/ROADMAP-REVIEW.md` §1.1. A
lawyer should confirm the no-collection position in writing before submission —
that is a review, not a build.
