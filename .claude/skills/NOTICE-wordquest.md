# Skills on this branch

Copied from `claude/bedtime-stories-app-6vk9be`, where they were first added.
They are design-engineering references (Emil Kowalski's philosophy, plus Apple
HIG and animation vocabulary), not project code.

## Applied so far

`mobile-native` was run as an audit against this app. Its symptom table found
two real defects that had shipped:

| Finding | Fix |
| --- | --- |
| `user-scalable=no` on all 11 pages | Removed. Hard Rule 4: never disable zoom — it is an accessibility failure, and iOS has ignored the directive since iOS 10 anyway. Gestures on the play surface are already ours via `touch-action: none` on the canvas, which is the capability-scoped version of the same intent. |
| `.path-toggle:hover` ungated | Wrapped in `@media (hover: hover) and (pointer: fine)`. Touch has no hover, so a browser fakes one and leaves it applied after the tap. |

Already correct before the audit: `-webkit-tap-highlight-color: transparent`,
`user-select: none` on chrome, `overscroll-behavior`, and no `100vh` (the app
is canvas-based, so the unit never appears).

## Still to apply

- `emil-design-eng` — the animation decision framework, in particular
  "should this animate at all?" against frequency of use, and the custom
  easing curves. The hub's transitions currently use plain `ease`.
- `animate` / `animation-vocabulary` — for the celebration and tutorial work.
