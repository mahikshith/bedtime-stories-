# Design notes

Longer-form rationale for decisions that are easy to undo by accident.

## Why the character walks itself

Every other platformer gives the player locomotion. This one does not, and it
is the single most important decision in Say & Jump.

A child of five has roughly one channel of deliberate motor attention. Asking
them to hold a direction pad, judge a gap, *and* produce a clear spoken word is
three. In testing terms: give a child a joystick and a microphone and they will
use the joystick, because it responds instantly and the microphone does not.
The voice mechanic dies.

So the game owns walking, and the child owns exactly one thing — the word.
Jump points are authored (the `W` markers in the level maps), not derived from
geometry, so a designer decides where a word is asked for and can pace the
level around it.

In Touch or Both mode a visible directional pad can guide walking between
those points, but releasing the pad returns to the authored auto-walk. The
word gate still stops the bird; a separate large JUMP action gives a quiet
room or a broken microphone a reliable way through.

## Why the arc preview exists

"Say it louder and you will jump further" is an abstract claim. A dotted arc
that visibly stretches past the gap as the child pushes their voice is a
demonstration. The difference is roughly one attempt versus ten.

The arc is also coloured by outcome — green when the current charge reaches
solid ground, red when it falls short — which converts a continuous quantity
(loudness) into a binary the child can act on (go / not yet). The meter's red
threshold lines do the same job from the other direction: "get the yellow past
the red line" is a concrete instruction in a way that "be louder" is not.

## Why levels are pillars over water

The first version laid a flat floor along the bottom three rows of a 13-row
level. On a portrait phone that framed nine rows of empty sky, pushed the
platforms to the bottom edge, and left the player unable to see the gap they
were about to jump. A game about judging distance has to show the distance.

Pillars rising out of water put the surfaces in the middle band of the screen
with obvious gaps between them, and the water gives the vertical space below
something to be. The composer enforces the resulting budgets:

- horizontal gap ≤ 7 tiles (448px) against a 520px maximum jump
- upward step ≤ 3 rows (192px) against a 260px maximum apex

## Why the apex is capped at four tiles

A six-tile jump arc looks impressive and is unplayable: at the top of it the
landing platform is off the bottom of a portrait screen, so the child loses
sight of their target at exactly the moment they need it. Distance was
increased to compensate, which keeps the gaps interesting without the arc
leaving the frame.

## Why word matching is forgiving

Speech recognition mis-transcribes children constantly — unfamiliar phonology,
missing teeth, background noise, a quiet voice. The failure mode of a strict
matcher is telling a child who said the word correctly that they got it wrong,
which teaches them that trying does not work.

So `matchWord` accepts close variants, scaled by word length, and rejects
minimal pairs where the distinction is the whole point ("bat" / "cat"). More
importantly, recognition is a *bonus* layer, never a gate: a child with no
recognition support (Firefox, most in-app browsers) plays the same game and
the loudness mechanic carries it.

## Why there is no timer anywhere

Nothing in these games is scored on speed. Time pressure on a fine-motor task
(Tilt Maze) produces flailing, and on a language task it produces guessing.
Word Mob generates urgency through flock size instead: losing birds is legible,
recoverable, and creates a reason to read the gate rather than react to it.

## Age bands

| Band | Ages | Vocabulary | Failure model |
|---|---|---|---|
| `tiny` | 2–5 | one syllable, concrete, nameable by pointing | none — nothing can be lost |
| `mid` | 5–7 | two syllables, blends, early sight words | hearts, generous respawn |
| `big` | 7–11 | three-plus syllables, spelling traps | hearts, tighter star thresholds |

The band is chosen once in the hub and threads through every game via the URL,
so a three-year-old gets `cat` on level 9 while their sibling gets `magnificent`
on level 1.

## Accessibility

- Every game is fully playable without a microphone (touch-and-hold charges),
  without a gyroscope (drag or arrow keys), and without speech recognition.
- Colour is never the only signal: the shut maze exit is *barred* and shows a
  count, the arc preview changes shape as well as colour, gate choices carry
  their own labels.
- `prefers-reduced-motion` collapses transitions.
- Text is drawn at sizes that survive a 2× browser zoom on a 360px screen.
