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
