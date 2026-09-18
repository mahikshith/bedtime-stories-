# Word Quest

Voice- and motion-controlled learning games for children aged 2–11.

A child says a word and a bird jumps the gap. They tilt the phone and roll a
marble through a maze, collecting letters in order. They steer a flock through
the gate with the correctly spelled word. The control scheme *is* the lesson:
to play, you have to say it, spell it, or find it.

Everything runs as a static site — no build step, no server, no install, no
account, no network. Open `index.html` and play.

## Run it

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

A plain `file://` open mostly works, but **microphone and gyroscope require a
secure context**, so use `localhost` or HTTPS. On a phone, either serve over
HTTPS or use your laptop's local address with a tunnel.

## The games

| Game | Ages | Control | What it teaches |
|---|---|---|---|
| **Say & Jump** | 2–11 | 🎤 voice | Say the word to jump. Louder and longer = further. |
| **Tilt Maze** | 5–11 | 📱 gyroscope | Collect letters in order to spell the word. |
| **Word Mob** | 5–11 | 👆 drag | Steer a flock through the right answer gate. |
| **Echo Pop** | 2–7 | 🎤 voice / 👆 tap | Say or tap the thing you hear. |

### Say & Jump

The bird walks itself to each authored jump point and stops. A word card
appears, the bird reads it aloud, and the child says it back. Loudness sets
the jump's height, sustain sets its distance, and saying the *right* word adds
reach on top.

Two decisions carry the design:

- **The bird walks itself.** A five-year-old cannot manage a joystick and a
  microphone at once, so the game owns locomotion and the child owns the one
  thing being taught.
- **A dotted arc previews the landing while charging.** "Louder goes further"
  is abstract until a child watches the arc stretch past the gap as they push
  their voice. It turns the mechanic into something learnable in one attempt.

### Tilt Maze

The whole board is always on screen — a child tilting a device cannot also
track a scrolling viewport. Letters must be collected in order and the exit
stays shut until the word is complete, so route-planning and spelling become
the same problem. Falling in a hole costs a moment, not a life.

### Word Mob

An auto-running flock, steered left or right through answer gates. The correct
gate multiplies the flock; the wrong one shrinks it. The urgency comes from
flock *size*, never a timer or a life counter: a bad answer is recoverable, and
there is still a real reason to read the gate rather than guess. Answers are
committed by steering, so a pre-reader can play by following the picture.

### Echo Pop

For the youngest players. No fail state, no timer, no score to lose. A miss
re-asks the question and the right answer is always spoken. Touch targets are a
quarter of the screen because small children have poor fine motor control and
will otherwise "miss" a correct answer.

## Layout

```
index.html              hub: age band, bird, progress, level paths
src/
  games/*.html          one page per game
  result.html           post-level results
  css/                  tokens (palette, type, geometry), shared chrome, hub
  assets/               vendored fonts, favicon
  js/
    core/
      engine.js         fixed-timestep loop, DPR canvas, letterboxed viewport
      physics.js        AABB platformer world, jump solver, arc prediction
      tilemap.js        ASCII level parser + reachability audit
      voice.js          mic loudness, utterance shaping, word matching
      tilt.js           DeviceOrientation with pointer/keyboard fallbacks
      audio.js          synthesised SFX and speech
      words.js          age-banded vocabulary banks
      storage.js        progress, streak, settings (localStorage only)
      draw.js fx.js palette.js
    art/
      bird.js           the playable bird, eight animated states
      environment.js    themes, parallax, pillars, water, hazards
      character.js shading.js
    games/<id>/         game.js + levels.js per game
tools/                  level composer, audits, screenshots, playtests
```

## Design notes

**Palette.** Saturated poster graphics: flat high-chroma fills with hard value
separation between neighbouring shapes. Pastels and low-contrast gradients are
banned on gameplay elements — at arm's length on a phone in daylight a washed
out palette turns to grey mush and a child cannot tell the platform from the
sky. Every colour is a `light / base / dark / deep` ramp so flat shapes can be
lit consistently (`src/js/core/palette.js`).

**Level layout.** Say & Jump levels are *pillars over water*, not a floor along
the bottom. On a portrait phone a bottom-aligned floor pushes every platform
off the bottom of the frame, and a game about judging distance becomes
unplayable because you cannot see what you are jumping to.

**Jump tuning.** Jumps are authored as an apex and a forward distance; the
launch velocities are solved from them (`solveJump`). That means a level can
promise a gap is clearable and actually be right, instead of hand-tuning
impulses until it feels about right.

**Forgiveness.** Children's speech is mis-transcribed constantly, so word
matching accepts close variants ("elefant" passes for "elephant") while still
rejecting minimal pairs ("bat" is not "cat"). A game that tells a child they
are wrong when they are right teaches them to stop trying.

## Tools

```sh
node tools/check.mjs              # audit every level for spawn→goal reachability
node tools/smoke.mjs              # load every page, drive input, fail on any error
node tools/playtest.mjs 0         # drive a Say & Jump level end to end
python3 tools/compose-levels.py   # regenerate level maps from their specs
node tools/fetch-fonts.mjs        # re-vendor the fonts
node tools/shoot.mjs <page> <out.png>
```

Levels are generated by `tools/compose-levels.py`, which does the column
arithmetic and asserts every gap and rise stays inside the jump budget. Edit
the spec there and re-run rather than nudging tiles by hand. `check.mjs` then
walks each level as a graph and fails the build if the goal is unreachable — an
impossible level should break CI, not a child.

## Privacy

No account, no network calls, no analytics. Audio is analysed in the browser
and never recorded or transmitted. Where the platform offers speech
recognition the browser may process audio per its own policy; it can be turned
off in settings, and every game stays fully playable without it. All progress
lives in `localStorage` on the device.

## Browser support

Chrome, Edge and Safari have everything. Firefox has no `SpeechRecognition`, so
word *checking* is off there — loudness still drives the games, which remain
fully playable. Gyroscope falls back to drag on desktop and to arrow keys.

## Licence

Code: MIT. Fonts: Nunito and Baloo 2, SIL Open Font License 1.1
(`src/assets/fonts/OFL.txt`).
