# Third-party skills

`animate/`, `animation-vocabulary/`, `apple-design/`, `emil-design-eng/`,
`find-animation-opportunities/`, `improve-animations/`, `mobile-native/`,
`pick-ui-library/`, `prototype/` and `review-animations/` are vendored
unmodified from **[emilkowalski/skills](https://github.com/emilkowalski/skills)**
at commit `85e8e23`, MIT licensed, © 2026 Emil Kowalski.

They are the authority on general UI craft in this repo. `lumi-ui/` is ours and
records only the places a kids' bedtime app must diverge from them.

Three skills from that repo were deliberately **not** installed:

| Skipped | Why |
|---|---|
| `animate-expo` | React Native / Reanimated. We are a web app in a Capacitor WebView, so `animate` is the correct one. |
| `write-swift` | Capacitor generates the iOS shell; we author no Swift. Revisit only if we ever write a native plugin. |
| `ask-sonner` | A toast library. We ship `react` + `react-dom` only and have no toasts. |

To update: re-clone the upstream repo and copy the directories over. Do not edit
them in place — local edits would be lost and would silently fork the craft bar.
