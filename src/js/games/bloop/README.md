# Bloop Hills — parked, not shipped

Unfinished and deliberately **not wired into the app**: it is absent from the
hub catalogue, from `tools/smoke.mjs` and from every navigation path. Nothing
reaches `src/games/bloop.html` except typing the URL. Parked here rather than
deleted because the parts that exist are the hard parts.

## What it is

A tilt game in the spirit of LocoRoco. The research that mattered: that game
was pitched and rejected twice, and greenlit only when its designer returned
with a demo of *nothing but the tilting*. So the one idea worth taking is
**you control the world, not the character** — you lean the hill and gravity
does the rest, which is why a three-year-old can play it immediately and why
it maps onto a phone's gyroscope exactly.

The second idea is that the flock is a chord: every creature is a voice in the
music, so collecting one makes the song fuller. That is the whole reward
structure and it needs no words in any language.

## What is done

- `terrain.js` — smoothed ribbon polygons, circle-vs-segment collision with
  spatial buckets. Swoopy curves, because the feeling is *swoop* and none of
  it survives being made of rectangles.
- `bloop.js` — the creature. Simulate a circle, draw a jelly: squash is an
  ellipse scaling (radial modulation grows a waist and turns it into a
  peanut), faces sit on a phyllotaxis spiral so twenty fit without crowding
  the rim.
- `song.js` — the adaptive chorus, pentatonic so no collectable combination
  can sound wrong.
- `levels.js` — six levels from a vocabulary of gestures: run, dip, slide,
  pipe, lip, squeeze.
- `game.js` — the scene: rotating gravity with a lagging world, split/merge,
  fruit, goal.

## What is left

- Scale is wrong: at `zoom 0.46` with `baseRadius 30` a Bloop renders about
  14px across. Needs roughly `baseRadius 44` at `zoom 0.8`, then every level's
  gaps re-checked against the new flock radii.
- Containment walls are drawn with the same grass cap as the ground, so they
  read as grassy pillars. They want a `kind` and their own style, or to not be
  drawn at all.
- No level verifier yet. Nothing here ships until a tool proves every level is
  completable, the way `check-robot` and `check-balance` do for theirs.
