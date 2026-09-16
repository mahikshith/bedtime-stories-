# Review of Gemini's roadmap

**Input:** the 2,309-line roadmap and research pack Gemini produced from
`PROJECT-BRIEF.md`. **Date:** September 2026.
**Verdict:** roughly a third is worth building, a third is generic but correct,
and a third would damage the product — including one recommendation that would
destroy its main competitive advantage.

Read §1 before anything else.

---

## 1. The three findings that matter

### 1.1 The VPC recommendation is wrong, and acting on it would be the single worst thing we could do

Gemini says:

> "To comply with COPPA, you must obtain Verifiable Parental Consent (VPC)
> before collecting any personal information. A simple checkbox is not enough.
> A credit card transaction is a common and accepted method."

It then spends several hundred lines specifying credit-card VPC, knowledge-based
challenge questions, and government-ID verification flows.

**VPC is triggered by collection. We do not collect.** The child's name is typed
on the device, stored in `localStorage`, substituted into text at render time,
and never transmitted — there is no server to transmit it to, and
`privacy.test.ts` fails the build if anyone adds one. Information that never
leaves the device is not collected from the child in the sense that triggers the
consent obligation.

So the recommendation inverts itself. To implement credit-card VPC we would need
to take a parent's card details, which means a payment processor, which means a
server, which means we would be collecting and transmitting personal information
— **creating the exact obligation the mechanism exists to discharge.** We would
take on a compliance burden, a vendor, a breach surface and a recurring cost, in
order to satisfy a rule that currently does not apply to us.

This is not a small error. "There is no server" is the strongest line we have
with the buyer (`PROJECT-BRIEF.md` §2.1) and the reason compliance is a property
of the architecture rather than a policy document. Gemini recommended trading it
away without noticing it existed.

**Decision: reject entirely.** Keep the existing parental gate (a multiplication
question) as an age screen, which is what it is for. Before submission, have a
lawyer confirm the no-collection position in writing — that review is worth
paying for, and it is a different thing from building a consent flow we do not
need.

### 1.2 It quietly changed what the product is

Around line 95 the document stops describing a bedtime story app and starts
describing a **social-emotional learning app**. From there it is consistent
about it: emotional check-ins, a "Feeling Garden" visualising the child's
emotional landscape over time, conversation starters generated from what the
child felt during which activity, SEL-themed sticker books ("The Feelings
Forest"), and an SEL brand ecosystem.

Nobody asked for an SEL app. That reframing is where most of the 2,309 lines go,
and it is why so much of the specification cannot be used.

It also collides head-on with our architecture. An emotional check-in history is
**sensitive longitudinal data about a named child**. Storing it locally does not
make it harmless — it makes it a thing that exists, that a parent can be shown,
and that a future feature will be tempted to sync. The entire "Feeling Garden"
and "conversation starter" apparatus depends on recording how a child felt, day
by day, and attributing it to specific activities.

**Decision: reject the reframing and everything downstream of it.** We are a
bedtime ritual, not a therapeutic instrument. If we ever want the parent to have
better language for a bedtime conversation, the story itself is the hook — no
emotional telemetry required.

### 1.3 Its Phase 1 is not our Phase 1

The roadmap opens with "launch a high-quality MVP" in months 1–4, and defines
that MVP as the Today hub plus three games.

We passed that months ago. We have five pillars, 216 composed stories, 22
rhymes, eight games, six palettes, a paywall, a privacy policy generated from
source, and 217 tests. The roadmap was written from the brief but not *against*
it — it is a generic children's-app roadmap with our nouns substituted in.

More seriously, it never once mentions what actually blocks us:

- **Neither native shell has ever been built.** No Android SDK, no macOS here.
- **The voice path has never run on real hardware.** No audio stack in this
  sandbox; the live meter is unit-tested only.
- `RECORD_AUDIO` and `NSMicrophoneUsageDescription` are not applied.
- No icons, no store screenshots, a placeholder privacy contact, IAP stubbed.

A roadmap for this project starts with "make the Android build work", not with
"refine the friendly flat design". Everything in §1.3 of `STORE-READINESS.md`
outranks everything in Gemini's Phase 1.

---

## 2. What we are taking

| Taking | Why it survives | Status |
|---|---|---|
| **A gentle exit routine** | This is our own thesis, made literal, and we somehow never built it. The app that claims to end the session has no ending — the story finishes and you are back on a menu. A Lumi goodbye sequence is the highest-value item in the whole document. | **Next** |
| **Sound design as feedback** | The biggest missing sensory layer. We have narration and nothing else: no tap sound, no completion chime, no ambience. For a pre-reader, sound carries state that text cannot. Must be synthesised in Web Audio (no audio files, no dependency) and must respect wind-down and a parent mute. | **Next** |
| **Haptics** | One line via `navigator.vibrate`, upgraded to Capacitor Haptics in the shell. Subtle, and off in wind-down. | **Next** |
| **Micro-interaction feedback on every tap** | Correct, and generic — Emil's `animate` skill says the same thing with actual values. | **Done this session** |
| **Larger tap areas, 3–5 choices per screen** | Already our rule (≥44px, ≥56px for threes). Worth re-auditing on a real phone. | Already held |
| **High contrast for accessibility** | Already enforced in `themes.test.ts` at 7:1 body and 3:1 on accent. | Already held |
| **A sticker book** | Accepted **only** in a heavily cut form — see §3. | Modified |
| **Per-world ambient soundscapes** | Genuinely good for immersion, but it is the only item here that costs bundle size, and it lands after the shells build. | Deferred |
| **"On-device AI is too risky for child-facing output"** | Agrees with our existing deferral, for the same reason. | Already held |

## 3. The sticker book, cut down

Gemini's version is a behavioural-design toolkit aimed at four-year-olds:
variable reward schedules, surprise "shiny" stickers, the endowed progress
effect, completion-ism driven by visible empty slots, and an in-app currency
store. That is a slot machine with a nursery theme, and in an app whose entire
positioning is *ending* the session it would be self-sabotage as well as
manipulation. D5 already forbids it.

What survives is the part that is a toy rather than a mechanic:

- **Collect, never compete.** A sticker for finishing a thing. No sets to
  complete, no silhouettes of what you are missing, no streak, no currency.
- **Thematically earned.** Finish a Lantern Breath and the sticker is a lantern.
  The sticker is a *memento of the thing you did*, which is the Sago Mini
  postcard insight and the only genuinely good idea in that section.
- **Placeable.** The child arranges stickers on a scene. That makes it a
  creative surface, which is where its long-term value actually is.
- **Absent at wind-down.** The day arc already stops offering lively pillars
  after 18:00; a collection screen is a lively pillar.
- **No variable rewards, no endowed progress, no store.** Non-negotiable.

## 4. What we are rejecting, and why

| Rejected | Reason |
|---|---|
| Credit-card / KBA / ID-based VPC | §1.1. Creates the collection obligation it claims to satisfy, and requires a server. |
| The SEL reframing | §1.2. Not the product, and not asked for. |
| Emotional check-ins, the "Feeling Garden", conversation starters | Requires recording a named child's emotional state over time. Sensitive data we have chosen not to hold. |
| A subscription with a 7-day trial | Contradicts D22 and the user's decision. Structurally, a subscription bills for continuously delivered value; with no backend our value is delivered at install. The churn would be deserved. |
| Variable reward schedules, surprise shiny stickers | §3. A slot machine aimed at preschoolers. |
| The endowed progress effect | A manipulation technique, applied to children, to increase engagement in an app whose selling point is reducing it. |
| Sticker store with earned in-app currency | Same, plus it teaches a purchase loop. |
| Parent dashboard with per-activity analytics | We show nights settled. That is deliberately the only metric: it is the one a parent actually cares about, and it cannot be used to compare one child to another. |
| Phase 4: animated shorts, physical books, Roblox, licensing, "constellation distribution" | Fantasy for an unshipped app with no users. Moonbug built that on a free YouTube channel with 100+ licensing deals; we have neither. |
| Influencer and content-marketing programme | Not a UI/UX matter, it is the weakest possible answer to our real distribution problem, and marketing to parents through their children's media is a place to be careful, not enthusiastic. |
| "MVP = Today hub + 3 games, months 1–4" | §1.3. Describes a product we passed months ago. |

## 5. What it did not answer

Both of the questions we flagged in `PROJECT-BRIEF.md` §8.3 as the ones we most
needed help with came back with nothing usable:

- **Discovery.** The answer is "a blog and parent influencers". That is the
  default answer, it is not specific to a paid one-time kids' app, and it does
  not survive contact with a $6.99 price and no recurring revenue to fund
  acquisition.
- **The retention cliff past night 30.** Not mentioned at all. 216 stories at
  one a night is about seven months; what happens in month eight is still open,
  and is still probably the real business risk.

It is worth saying plainly: the parts of this document that are correct are the
parts that are generic. The craft advice ("friendly flat", micro-interactions,
sound, large tap targets, icon-based navigation) is right, and Emil Kowalski's
skills — now installed in `.claude/skills/` — say the same things with exact
curves, durations and failure modes attached. Where Gemini reasoned specifically
about *our* product, it changed the product into a different one and recommended
we build the server we exist to avoid.
