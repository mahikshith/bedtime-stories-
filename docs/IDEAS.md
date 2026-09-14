# The idea book

Original concepts for Lumi, with the reasoning kept attached so a later session
can tell a good idea from a merely novel one.

**The constraint that shapes everything:** on-device, no data collection, no
per-call cost, no fail states for small children, and the day arc decides when
a thing is appropriate. That is not a limitation — it rules out most of what
the category does and forces genuinely different answers.

---

## The gap worth owning

Every calming app for children is **passive**: sleep stories, guided
meditations, white noise. Moshi has 1,000+ hours of it; Calm, Headspace and
Smiling Mind all work the same way. Meanwhile every *interactive* children's
game is **arousing** — points, timers, streaks, noise.

> **Nobody has built an interactive experience that actively calms.**

That is a whole genre with nothing in it, and it is exactly where this app's
day arc already points. Everything in §1 lives there.

---

## 1. Wind-down interactives — the new genre

### 1.1 Lantern Breath — **BUILT**
Blow out five lanterns, one per out-breath. The lantern swells while the child
breathes in, and the screen darkens each time one goes out, so the game ends
near darkness instead of handing back a bright phone.

The evidence is unusually good: blowing out candles is a standard calming
technique, and a randomised trial of bubble-blower breathing in children aged
7–10 found it significantly reduced anxiety and pain. The breath used to blow
out a flame *is* calm breathing — a long out-breath, longer than the in-breath.
So the game is the intervention, not a wrapper around one.

The detection is the interesting part. A breath is distinguished from a voice by
**steadiness, not loudness**: speech is syllabic and bumps several times a
second, a breath is a flat sustained hiss. `detectBreath()` looks for a run of
frames inside a gentle band with low coefficient of variation — which means
**shouting cannot win**, and the one calm thing in the app stays calm.

### 1.2 Slow Sort
Drag a handful of objects into gentle order — smallest to largest, darkest to
lightest. No timer, no score, no wrong answer that buzzes. Sorting is absorbing
and self-terminating: when it is sorted, it is over. The anti-infinite-scroll.

### 1.3 The Quiet Hunt
The app asks the child to find the *quietest* sound in the room and tap when
they hear it. The meter rewards being still enough to notice a fridge hum.
Turns the microphone into an instrument for attention rather than volume, and it
is the only game that gets better the quieter the room becomes.

### 1.4 Constellation Drawing
Join dots into a shape on a dark sky; the finished constellation stays as that
night's sky in the story player. Slow, quiet, and it feeds the story pillar.

---

## 2. Voice ideas the existing meter already supports

### 2.1 Echo — rhythm, not words
Lumi says a phrase; the child repeats it; the app compares the **rhythm** —
burst count and spacing — not the words. "BUT-ter-fly" versus "but-ter-FLY".

This is prosody imitation, a real early-language skill, and it needs no speech
recognition at all: `countBursts()` plus inter-burst timing is enough. It is the
single cheapest new game on this list because the engine exists.

### 2.2 Duets — conversation scaffolding
Lumi says a line of a two-person rhyme and **waits** for the child to answer,
detecting only that a vocal turn happened. It teaches turn-taking — the shape of
conversation — without ever needing to know what was said.

Directly answers the "conversation skills" ask, and is honest about its limits:
it cannot judge the content, only that the child took their turn.

### 2.3 Loud and Quiet
Lumi asks for a *whisper*, then an *outdoor voice*, then a whisper again. The
target band moves. Volume control is the actual skill — Voice Volume Catcher
exists for precisely this — and it is far more useful to a child than "louder is
better".

---

## 3. Off-screen by design

### 3.1 Lumi's Errands — **the strongest non-obvious idea**
The app gives a real-world task and then gets out of the way: *"Find something
soft. Bring it back and tell Lumi what it is."* The child leaves the screen,
does something physical, returns, taps once.

This is the logical end of "the app that knows when to stop", and it is
uncopyable for the same reason print-first colouring is: it looks like
self-sabotage to anyone optimising engagement. A parent who sees the app send
their child *away* trusts everything else it says.

### 3.2 Shadow Theatre
The app puts a shape on a bright screen and asks the child to make it with their
hands against a wall. Pure physical play with the device as a prop.

### 3.3 The Colour Walk
Prints a small checklist — something red, something round, something that
crinkles — for a walk. Extends the print-first colouring idea from art into the
whole day.

---

## 4. Content, not mechanics

### 4.1 Story Forge
The child assembles a story from cards — a who, a where, a problem, an ending —
and the existing generator narrates the result. Turns a library into a toy, and
moves the child from consuming stories to making them. Reuses the arc skeletons
and lexicons already shipped, so the marginal cost is a UI.

### 4.2 Companion memory
The companion accumulates small remembered details across worlds — the stone
Bramble carries, the question Mabel asked. Continuity is the one thing a pure
generator structurally cannot have, and it is what makes a child ask for *their*
story rather than *a* story.

### 4.3 Rhymes still to write
Counting-down rhymes (ten in the bed), cumulative rhymes that add a line per
verse, call-and-response rhymes for two children, and a "silly names" rhyme that
slots in the child's own name as the punchline.

### 4.4 Two-minute worlds
Six-line micro-stories for the night that has already gone wrong at 8:50pm.
Shares the engine; needs only a shorter arc.

---

## 5. Deliberately rejected

Kept here so they are not re-proposed.

| Idea | Why not |
|---|---|
| Streaks, XP, daily rewards | Arousal mechanics at bedtime. Contradicts the entire positioning. |
| Leaderboards or any child-to-child comparison | Needs accounts and a server; also unkind. |
| Open-ended chat with a character | Cloud, COPPA exposure, and unbounded output to a child. Rule 3. |
| Voice cloning a parent | Voiceprints are biometric data under amended COPPA. |
| Pronunciation *scoring* | Needs ASR. Cloud on Android, and scoring a four-year-old's speech is a bad idea even when accurate. |
| Video or animation library | Passive consumption, enormous content cost, and it is Moonbug's game, not ours. |

---

## 6. What to build next, ranked

1. **Echo** — cheapest new game; the engine already exists.
2. **Story Forge** — highest value per line of code; reuses the generator.
3. **Lumi's Errands** — most differentiated; almost no engineering.
4. **Loud and Quiet** — rounds out the voice set with the useful skill.
5. **Slow Sort** — second wind-down interactive, so the evening has a choice.

## Sources

- [Best Sleep Apps for Kids 2026 — Moshi, Calm, Headspace compared](https://getgoldminds.com/sleep-apps/)
- [Calm Kids](https://www.calm-kids.com/) · [8 meditation apps for kids — Understood](https://www.understood.org/en/articles/8-meditation-apps-for-kids)
- [Breathing exercise using bubble blower reduced anxiety and pain in children 7–10 (RCT) — PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8786543/)
- [Breathing Exercises for Kids: 10 Types — Choosing Therapy](https://www.choosingtherapy.com/breathing-exercises-for-kids/)
- [Gamified breathing exercise trial (ball, bubble, candle blowing)](https://clinicaltrials.gov/study/NCT07408037)
- [Voice Volume Catcher — Google Play](https://play.google.com/store/apps/details?id=jp.co.litalico.voicevolumecatcher&hl=en_US)
