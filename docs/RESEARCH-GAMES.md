# Games — research and design notes

**Date:** September 2026
**Verdict:** The voice-jump concept is sound, the genre is proven, and the
competition is positioned somewhere we are not. Two things in the naive version
would have hurt: shouting teaches the wrong skill, and a microphone in a
children's app is a COPPA tripwire unless the architecture is right.

---

## 1. The mechanic is proven, and the implementation detail is the important bit

The reference is the *Scream Go / Yasuhati* genre. The load-bearing fact:

> It uses **signal processing, not speech recognition** — ignoring linguistic
> content and reading the decibel level, which is why input lag is milliseconds.

Soft voice walks, loud voice jumps; louder or longer means higher and further;
sensitivity is adjustable. That is exactly what `engine/voiceMeter.ts` does.

**This is also the thing that keeps the feature legal and free.** Three
consequences follow, and all three are enforced in code:

1. **Amplitude only, discarded every frame.** No `MediaRecorder`, no retained
   buffer, no upload. Under COPPA a voice *recording* is personal information
   needing verifiable parental consent; a number computed and thrown away 60
   times a second is not a recording.
2. **Never `SpeechRecognition`.** On Android Chrome that API ships audio to
   Google's servers. It would break rule 1 (a networked call in the daily loop)
   and put children's voices on someone else's machine. Word recognition, if
   ever wanted, needs an on-device model — a spike like the TTS one.
3. **The mic is held only while a game is on screen.** Unmounting stops the
   stream, which clears the browser's recording indicator. A parent should never
   see that dot lingering.

Enforcement context: the FTC has issued specific guidance on recording
children's voices, the amended COPPA rule took full effect 22 April 2026, and
Google settled a Play children's-privacy case for **$8.25M**. This is not a
theoretical risk.

## 2. Who else is doing it, and the gap

| App | What it does | Positioning |
|---|---|---|
| **Speech Blubs** | Voice-controlled speech therapy, sounds and words | Clinical / therapy |
| **Sensory Speak Up / Speak Up Too** | Louder voice makes the shape or animal bigger | Sensory / SEN |
| **Voice Volume Catcher** (LITALICO) | Monitor and hold a target voice volume | SEN / self-regulation |
| **Voice Meter Pro** | Volume monitoring for autistic children | Clinical |
| **Voice Games** | Pitch-controlled arcade games (maze, brick breaker) | Voice training |
| **VoxTraining – Balloons** | Hold phonation inside a volume band | Therapy |
| **Splingo** | SLT-designed language games with progress tracking | Clinical |

Two things stand out.

**The gap:** almost everything here is *therapy* positioned — bought because a
child has a diagnosed need, often on a clinician's recommendation. Nobody is
putting a voice game inside a **general** children's app next to stories,
rhymes and phonics, for a typically-developing child who just likes shouting at
a chicken. That is the space.

**The borrowed idea:** Voice Volume Catcher and VoxTraining both reward
*hitting a target band* rather than maximum volume. That is better for vocal
health and far better for the child who is constantly told to be quiet. Our
meter draws a target line rather than a "louder is always better" bar.

## 3. Why shouting alone teaches the wrong thing

A child can shout "aaaaah" and clear every platform without ever saying the
word. Volume is a proxy that measures the wrong variable: for vocabulary and
pronunciation, *clarity and effort* matter, loudness does not.

The fix that needs no speech recognition: **one vocal burst per syllable.**
"but-ter-fly" becomes three real efforts, and a single long shout registers as
one burst — there is a test asserting exactly that. Syllable segmentation is a
genuine phonological-awareness milestone and it sits directly alongside the
phonics pillar, so the game is practising something the rest of the app teaches.

`countBursts()` uses hysteresis (separate on/off thresholds) so a wobbling voice
counts as one syllable rather than several, and a minimum burst length so a
cough is not a beat.

## 4. Room calibration is not optional

A child should not have to out-shout a television. The meter samples ~900ms of
the empty room first and sets the floor from the **median** — one door slam must
not lock a child out for the session — then places the ceiling relative to that
floor so the target is always reachable in the room the child is actually in.

The level curve is square-root rather than linear, because loudness perception
is roughly logarithmic and a linear map makes a quiet child feel like they are
doing nothing.

## 5. Age bands

The request was 1-2 / 3-4 / 5-6 / 7-8. Two adjustments:

**Games carry their own `minAge`/`maxAge`, separate from profile bands.** A
profile is 3-5 / 6-8 / 9-11 because that is the right granularity for sentence
complexity. Games need finer steps — the gap between three and five on a
syllable task is enormous. Keeping them separate means adding a game never
churns the profile model.

**The youngest band starts at 2, not 1, and is co-play only.** The AAP advises
no screens before 18 months, and our own positioning is the app that knows when
to stop. A one-year-old cannot play a game; a two-year-old can discover that
their voice makes something happen, on a grown-up's lap. `Wake the Animal` has
no score and no way to lose, and the catalogue marks it `together: true` — the
AAP's 2026 statement weighs co-viewing heavily.

| Ages | Game | Skill |
|---|---|---|
| 2–4 | Wake the Animal | cause and effect, confidence |
| 3–7 | Lumi's Leap | vocabulary, pronunciation, confidence |
| 4–8 | Syllable Hop | syllable segmentation |
| 4–9 | Rhyme Race | rhyme, listening |
| 5–8 | Word Builder *(planned)* | letters, blending |
| 6–10 | Tongue Twister Tower *(planned)* | articulation |
| 5–9 | What Comes Next? *(planned)* | turn-taking, conversation |

## 6. Games and the day arc

Games are the loudest, most engagement-shaped thing in the app, so the day arc
governs them: **first in Play mode, last in Wind-down, never *encouraged* after
6pm.** Still reachable — a locked app at 7pm starts an argument — but the arcade
says plainly that shouting games wake everybody up and a story might land better.

There is no "game over" in the voice games either. A missed platform costs
another go, nothing more. A four-year-old practising a new word should never be
punished for trying, and a fail state would turn a confidence exercise into a
test.

## 7. Open risks

- **Untested on a real device.** Android WebView needs `RECORD_AUDIO` in the
  manifest plus a native runtime permission prompt, and `AudioContext` often
  needs resuming after a gesture. Desktop Chromium proves the logic and the
  layout, not the Android audio path.
- **Vocal strain.** Target-band rewards mitigate it; a session cap may be worth
  adding if anyone plays for twenty minutes.
- **Noise.** Shouting games are unwelcome in a car, a waiting room or a shared
  bedroom. Rhyme Race is deliberately the quiet, touch-only alternative.

## Sources

- [Scream Go Hero: Eighth Note Yasuhati Guide — Gamezebo](https://www.gamezebo.com/walkthroughs/scream-go-hero-eighth-note-yasuhati-guide-tips-cheats-and-strategies/)
- [Scream to Jump: The Viral Voice-Controlled Platformer](https://toolkitgen.com/tool/voice_controlled_platformer)
- [Speech Blubs: Language Therapy — Google Play](https://play.google.com/store/apps/details?id=org.blubblub.app.speechblubs&hl=en_US)
- [Sensory Speak Up](https://www.sensoryapphouse.com/speak-up/) · [Speak Up Too](https://www.sensoryapphouse.com/speak-up-too/)
- [Voice Volume Catcher — Google Play (LITALICO)](https://play.google.com/store/apps/details?id=jp.co.litalico.voicevolumecatcher&hl=en_US)
- [Voice Games — App Store](https://apps.apple.com/us/app/voice-games/id6499132824)
- [8 Best Speech Therapy Apps — EducationalAppStore](https://www.educationalappstore.com/best-apps/best-speech-therapy-apps)
- [FTC's COPPA Guidance on Recording Children's Voices — Fenwick](https://www.fenwick.com/insights/publications/ftcs-new-coppa-guidance-on-recording-childrens-voices-five-tips-for-app-developers-and-toymakers-to-comply)
- [Complying with COPPA: FAQ — FTC](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [Google Play COPPA Settlement: $8.25M](https://www.recordinglaw.com/us-laws/data-breach-settlements/google-play-children-s-privacy-coppa-settlement/)
- [Digital Ecosystems, Children, and Adolescents — AAP](https://publications.aap.org/pediatrics/article/157/2/e2025075320/206129/Digital-Ecosystems-Children-and-Adolescents-Policy)
