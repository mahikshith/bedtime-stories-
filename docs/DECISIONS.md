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

### D30 — The native shells are committed source, not build output *(session 6)*

`android/` and `ios/` were gitignored. That made the microphone permission and
the usage-description string un-committable: every `npx cap add` regenerated
them away, which is why `STORE-READINESS.md` carried "permissions not applied"
as a blocker for three sessions. Capacitor ships its own `.gitignore` inside
each platform excluding build output, Pods and copied web assets, so committing
the platforms adds no generated files. Only `android/app/src/main/assets/` and
`ios/App/App/public/` — the copied web build — stay ignored.

`src/__tests__/nativeShell.test.ts` pins `RECORD_AUDIO`, the optional-microphone
feature flag, the iOS purpose string, the absence of `UIBackgroundModes`, and
the total permission list. A dropped permission fails silently on a handset and
nowhere else, so it gets the `privacy.test.ts` treatment.

### D31 — Capacitor is on the runtime dependency allowlist; nothing else is *(session 6)*

`privacy.test.ts` asserted runtime dependencies were exactly `react` +
`react-dom`. It now asserts an explicit five-name allowlist including
`@capacitor/core`, `/android` and `/ios`. Capacitor is not the kind of
dependency the rule was written against: it is the shell hosting our own code
and the home of the native permissions, it has no analytics, and without it
there is nothing to submit. A second test bans the Capacitor plugins a kids' app
usually acquires a tracker through — push notifications, browser, device,
network, geolocation, http.

### D32 — Web Audio is unlocked on the first gesture, and re-armed after every suspension *(session 6)*

`engine/audioUnlock.ts`. A context built outside a user gesture starts
suspended, and a suspended context is not visibly broken: the analyser keeps
returning frames and every sample reads as silence, so the voice games show a
dead meter with the microphone permission granted. WKWebView also suspends on
background, so unlocking once is not enough — arming is re-set on `statechange`
and on `visibilitychange` rather than latched.

### D33 — Bedtime is one product inside an all-day app *(session 6, user correction)*

Earlier sessions reasoned as though the whole app were a bedtime app, and
rejected mechanics on that basis. Wrong: the day arc runs 05:00–18:00 as wake
and play, and those hours get **full-strength game design** — progression
ladders, collectibles, streaks, tilt and motion games, juice. Only wind-down
(18:00–05:00) is calm by design. `CLAUDE.md` now says so at the top, because
this misreading recurred across three sessions.

### D34 — Engagement mechanics are in; five specific pressure mechanics are out *(session 6, user decision)*

The user asked for sticky, engaging games and reaffirmed it after the trade-off
was put to them. Building: mastery ladders (`levels`, 1–5), a rolling star
count, a streak, the Nest collection (hats, props, ambient sounds), and juice.

`PlayState` deliberately withholds the pressure mechanics, and each is a design
decision rather than an omission: **stars never decrease**, **levels never
regress** after a bad run, a **broken streak restarts at 1 rather than 0**
because the day you come back is itself day one, and the Nest is **mementos,
not currency** — no shop, no spend, nothing ever taken away. Streaks are shown
as a warm fact, never as something at risk.

The reasoning that separates habit from hostage is commercial, not moral: we
sell a one-time purchase, so growth runs through parent word-of-mouth, and the
parent's verdict forms when they take the phone away.

### D35 — `Entitlement` leaves room for a subscription *(session 6, user instruction)*

`monthly` and `annual` are declared and seated at 4, with an
`entitlementExpires` field and `isLifetime()` / `isLapsed()` helpers. Neither is
sellable yet — the decision is deferred — but the cost of leaving room now is a
union member, and the cost of not doing so is a storage migration on every
installed device later. `isLapsed` **fails closed** on a recurring tier with no
expiry: a wiped receipt must not become a free subscription. Store-managed
subscriptions validate on-device via StoreKit and Play Billing, so this stays
backend-free.

### D36 — Game audio is synthesised, never bundled *(session 6)*

`engine/gameAudio.ts`. Oscillators and filtered noise only: zero audio bytes in
the bundle, and a chime can be retuned at runtime. Pitches come from a
pentatonic scale so **any two notes played together are consonant** — that is
what makes it safe to fire feedback on every single touch. Voices are capped at
12 (a child mashing a bubble field otherwise clips into distortion and strands
nodes on a cheap phone), and everything routes through `audioUnlock` because an
unresumed iOS context plays nothing at all, silently.

### D37 — Motion input is real, and scoped *(session 6, user instruction)*

`hooks/useDeviceTilt.ts`. Tilt, gyro and motion games are in. The hook **never
requests permission from an effect** — iOS 13+ rejects `requestPermission()`
outside a user gesture, which would leave it dead on every iPhone and working in
Chrome. A game calls `request()` from a button press. Readings land in a ref and
are drained inside the game's own animation frame, because `deviceorientation`
fires at 60Hz (120Hz on ProMotion) and setState-per-event survives no physics
sim. Smoothing is frame-rate independent, or the same game feels different on
two phones in the same room. Every motion game ships a touch fallback: the
sensor can be absent, the prompt refused, or the parent simply unwilling.

### D38 — The Nest shows its locks, and never hides them *(session 6)*

`content/nest.ts` + `components/NestStudio.tsx`. Ten items across hats, nest
furnishings and ambient sounds, each appearing at a star threshold. Stars are a
count of what has been done, so the shelf only ever grows — a test walks 0..60
and asserts the unlocked count never falls.

A locked item shows **what it is and what it costs**, rather than a silhouette
with a question mark. A goal is legitimate; a mystery box is a different
mechanic. There is no shop and nothing is ever spent, which is why the screen
can end with "Stars only ever go up" as a plain statement of fact.

The first threshold is 3 stars, reachable in one game. An empty shelf teaches a
child that the shelf is empty.

### D39 — A hat replaces the crest rather than fighting it *(session 6)*

Hats are drawn inside `.lumi__head`, so they inherit each mood's head tilt for
free. Hats that sit on top of the head (acorn cap, nightcap, star crown, petal
wreath) hide the crest; goggles ride the forehead and leave it visible. Two
drawing bugs found by looking rather than by testing: the star crown rendered
through the crest before the rule existed, and the nightcap's tail and pom were
drawn above `y=0`, outside the `-6 0 252 244` viewBox, so the cap looked bitten
off with nothing erroring.

### D40 — Moon Pool is a height field, not SPH *(session 7)*

`engine/waterPhysics.ts`. The source documents asked for a particle fluid. A few
thousand neighbour-searched particles at 60fps on a five-year-old Android was
never a claim to make on a child's device, and it was never tested. A shallow-
water height field — a row of columns with a flow rate across each boundary —
sloshes, has a real resonant period, and costs a few hundred additions a frame.
What it gives up is splashing sideways, and that is all.

Three failures, each found by measurement rather than by eye:

1. **The integrator was pumping energy in.** Updating heights in the same sweep
   that reads them gives the loop a direction: water crossing left-to-right sees
   heights a half-step newer than water crossing right-to-left. It does not look
   like a bug, it looks like a tsunami arriving a second after a child tips the
   phone. Fixed with a staggered leapfrog — every flow from the heights as they
   stand, and only then is any water moved.
2. **It rang at 3Hz.** The fundamental period is `2 * COLUMNS / sqrt(SPREAD)`,
   and the peak first measured was grid-scale ringing, not sloshing at all.
   SPREAD is now set so the period lands near 1.2s, a walking rhythm, and a
   viscosity term damps by curvature so the grid-scale fizz dies in a sixth of a
   second while the slosh loses nothing.
3. **Sustained resonance ran one end dry.** A linear height field has no wave
   breaking, so it accepts energy indefinitely. Quadratic drag — the shape
   turbulent loss actually takes — caps it above the highest ledge.

The moon swinging above the pool is driven by the same constant the water is, and
a test pins the advertised period against the simulation's measured one. If they
drift, the moon becomes a liar and the game becomes unlearnable.

### D41 — A steady current, because rocking a basin moves nothing *(session 7)*

Floating debris in a rocked basin bobs in place; net horizontal travel is
second-order and tiny. A game built on advection alone strands the seed mid-pool
however well the child plays. The pool is pulled moonward instead, which makes
*arrival* a matter of time and the *lift* a matter of timing. The skill on offer
is the timing, and it is a real one. Coupling is also turned well down: at full
strength a good slosh flings the seed into the far wall and parks it there — the
game punishing the child for doing the one thing it asked.

### D42 — Firefly Air moves the air, not the thing *(session 7)*

Waving a phone does not move an object on screen; it moves air, and the air moves
the object. The puff outlives the wave that made it, so the game is anticipation
rather than mashing. `useDeviceShake` reads `DeviceMotionEvent`, a **separate**
iOS permission from `DeviceOrientationEvent` — granting one grants nothing about
the other. Gravity is subtracted with a slow-following baseline, because
`acceleration` is null on a great many Android browsers and the 1g in
`accelerationIncludingGravity` otherwise reads as a permanent 9.8. The reading
decays on *read* as well as on event: `devicemotion` simply stops firing on some
devices when the phone is still, latching the last wave on forever.

### D43 — Star Dial does not coast *(session 7)*

Momentum made it unplayable: a deliberate drag onto a star slid forty-six degrees
past it, every time. It is also wrong for the real control — there is no release
to coast from when the dial mirrors where a phone is pointing. The dial goes
exactly where it is put and stays. The speed it tracks is a *measurement*, kept
so that sweeping through the right angle at speed does not count as aiming at it.

Angles are in turns, not degrees or radians: it removes every `% 360` from the
call sites and makes shortest-way-round a subtraction. `alpha` is deliberately
**not** smoothed — smoothing a value that wraps averages 0.99 and 0.01 to 0.5 and
points the phone due south once per revolution.

### D44 — Echo Cave listens for when, never for what *(session 7)*

The voice game for a child who will not perform. The microphone supplies an
amplitude and the game finds the moments it went up; a rhythm is timing, and
timing is all that is taken. A tap on the glass echoes just as well as a clap,
and the cave cannot tell the difference — which is also the mic-less fallback.

Onsets are reported at the burst's *attack*, not at its confirmation, or every
clap drifts late by however many frames confirmation took. Echoes are scored on
gaps normalised by their own total, so thinking first and clapping briskly both
still count. The first patterns used a long beat one and a half times the short
one and a flat even clap scored inside tolerance against them: there was no shape
there to hear. They are 2:1 now — a quarter note against a half note, the
coarsest rhythmic distinction there is and the first children reproduce.

### D45 — Lumi is a rig, and reflected light is the whole trick *(session 7)*

A lit form goes highlight, midtone, **core shadow**, then a band of reflected
light at the very edge where the surface turns away and picks light back up off
its surroundings. Leave that last band out and the silhouette goes dead flat at
the rim, which is what separates a sticker from an illustration.

A stroked rim light is not a substitute: a stroke straddles its path, and on a
body this close to a circle it traces the whole outline, which the eye reads as a
glass bubble drawn around her. Clipping it to the silhouette did not help. The
reflected light belongs in the body gradient.

She turns by parallax — the beak furthest, then the eyes, the crest least, and
the receding eye narrows. And she is alive when nobody is asking: breathing,
weight shifts, glances and blinks, as pure functions of a clock in
`components/mascot/life.ts`, written to CSS custom properties inside an animation
frame. React never renders for it.

Two traps worth naming. `t % (3.1 + sin(t) * 1.4)` looks like an uneven blink and
is not — the divisor moves as `t` does, so the remainder jumps rather than
sweeping, and it fired 73 blinks a minute instead of 18; warp the clock under a
fixed schedule instead. And neutral defaults belong on `:root`, never on `.lumi`:
a custom property set on an element beats one inherited from an ancestor, so
every mascot pinned itself to neutral and ignored any pose set above it.

### D46 — A pressable control has a side *(session 7)*

`--sink` is both the travel of a pressed face and the depth of the lip it rests
on, deliberately the same number: set them independently and the face either
stops short of the shell or punches through it, and neither reads as a button
being pushed. The solid unblurred edge under a button is the *side* of the key —
blur it and it becomes a shadow and the control goes flat again. Elevation is
always a pair, a tight contact shadow plus a wide ambient one, both tinted with
the background hue, because a grey shadow on an indigo page reads as dirt.

Tiles sink rather than scale: scaling shrinks the shadow along with the tile,
which reads as moving *away* from the viewer rather than being pressed into the
page.
