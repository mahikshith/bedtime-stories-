# The stack, and why

**Capacitor over a native WebView shell, wrapping the existing web codebase.**
One source tree ships to Google Play, the App Store and the open web.

## The decision

There were roughly 14,000 lines already here: ten finished games written as
plain ES modules against Canvas 2D, Web Audio, SpeechSynthesis,
DeviceOrientation and localStorage, with no runtime dependencies at all. Around
them sit a dozen verification tools that do something unusual and valuable —
they *prove* content is playable before it ships, by breadth-first searching a
sliding-block state space, simulating a robot's reference solution, rasterising
a tangram to confirm the pieces tile, walking a platformer level as a graph.

Any stack that requires a rewrite throws away both.

| Option | What it costs |
|---|---|
| **Capacitor** | Nothing is rewritten. Native shell, native plugins, both stores. |
| Godot | Rewrite every game. Voice input and speech synthesis get harder, not easier. |
| Flutter | Rewrite in Dart; Canvas work becomes CustomPainter. Largest cost of the four. |
| React Native | Canvas games need Skia; effectively a rewrite, plus a JS bridge in the render path. |
| PWA only | Free, but there is no App Store listing, which was the requirement. |

Canvas 2D is also the right fit for a WebView. These games draw flat vector
shapes — no 3D, no shaders, no physics engine — so the usual "but a WebView is
slow" objection does not bite. The heaviest frame in the app is twenty
soft-body blobs, and that one is parked.

## What being native actually buys

Not a wrapper for its own sake. Each of these is something the web build cannot
do, and each is wired up in `src/js/core/native.js`:

- **Haptics.** The single biggest difference in feel: the gap between pressing
  a picture of a button and pressing a button.
- **A durable save.** A WKWebView's localStorage is *not* guaranteed to
  survive — iOS may evict it under storage pressure, and a child would open
  the app to find every level locked again with no way to get it back. The
  save now mirrors to native Preferences (UserDefaults / SharedPreferences)
  after every write and restores from it on a cold start.
- **The Android hardware back button.** Without handling it, back closes the
  whole app from inside a level, which to a child is indistinguishable from a
  crash.
- **A portrait lock and a real splash screen**, so it never boots sideways or
  flashes white.
- **A microphone permission prompt with a reason attached**, which matters
  because the microphone is a *controller* here, not a recorder.

## The rule that keeps it honest

**The app must still run as a plain website.** Every verification tool drives
the real game in a real browser over plain HTTP. The moment booting requires a
native runtime, all of that stops working and the only way to test anything is
to build an APK. So every call in `native.js` is a capability check with a web
fallback, and the fallback path is the one CI runs.

That is also why plugins are reached through `window.Capacitor` rather than
imported from `@capacitor/core`: importing bare specifiers would drag in a
bundler, and the absence of a bundler is a feature — see below.

## Why there is still no bundler

"Building" is a copy (`tools/build-app.mjs`). The codebase is plain ES modules
with zero runtime dependencies, so a bundler would add a toolchain that can rot,
break on a Node upgrade, and silently change what ships versus what was tested.
The files the tools drive in a browser are byte-for-byte the files in the store
build.

What the build step *does* add:

- it **excludes parked work**, so "not shipped" is structural rather than a
  note in a readme somebody stops reading;
- it stamps a build id into the service worker so returning players get the
  new version rather than a cached old one;
- it **injects the service-worker registration** into the pages it emits, so
  the source tree never fetches a generated file that is not there — a browser
  logs that 404 whether or not the code catches it, and permanent background
  noise eventually hides a real error.

## Commands

```sh
npm run build        # assemble www/
npm run sync         # build, then copy into android/ and ios/
npm run android      # sync and open Android Studio
npm run ios          # sync and open Xcode   (macOS only)

npm test             # every game, driven in a real browser
npm run test:app     # the built bundle: offline, icons, parked work absent
npm run verify       # prove every authored level is solvable
npm run weigh        # what a page costs in modules, bytes and DOM nodes
```

`android/` and `ios/` are committed on purpose. The manifest and the
`Info.plist` are *source* — regenerating them would silently drop the
microphone permission, the portrait lock and the usage strings.

## Building a store artefact

Neither store build can be produced in this repo's CI container: there is no
Android SDK and no Xcode here. Everything else is done and committed; these are
the steps on a machine that has them.

**Android** — needs Android Studio (or the SDK plus JDK 21):

```sh
npm run sync
cd android && ./gradlew bundleRelease        # -> app/build/outputs/bundle/release/
```

Before the first upload: create an upload keystore, put its credentials in
`android/keystore.properties` (already gitignored via `local.properties`
conventions — do not commit a keystore), and set `versionCode` / `versionName`
in `android/app/build.gradle`.

**iOS** — needs macOS, Xcode and an Apple Developer account:

```sh
npm run sync
cd ios/App && pod install
open App.xcworkspace          # set the team, bump the build, Archive
```

## Store readiness: what is done and what is not

Done here:

- app id `com.wordquest.kids`, display name, portrait lock, splash and status
  bar colours
- icons at every size both stores ask for, plus a **maskable** variant,
  rendered from the app's own SVG by `tools/make-icons.mjs` rather than
  becoming binaries someone has to keep in step with the art
- microphone permission with an honest usage string on both platforms, marked
  *not required* so the app still installs and plays without one
- offline-first, verified by `npm run test:app`

Still needed, and needing a human:

- **`appId` is a placeholder.** `com.wordquest.kids` should become a domain you
  control before the first upload; changing it afterwards means a new listing.
- Developer accounts, signing keys and provisioning profiles.
- Store listing copy, screenshots, and an age rating questionnaire.
- A privacy policy URL. The content is simple and true — no accounts, no ads,
  no analytics, no network calls, nothing leaves the device — but both stores
  require it to be hosted somewhere.
- **Children's-category compliance**, which is the part worth reading properly
  rather than skimming: Google Play's Families policy and Apple's Kids Category
  both forbid third-party analytics and ads, and require a parental gate in
  front of anything that leaves the app. This app currently has no third-party
  code of any kind and nowhere to leave to, which is the easiest possible
  starting position — it is worth keeping.

## The risk worth naming

Apple's App Review guideline 4.2 rejects apps that are little more than a
repackaged website. The mitigation is not a trick, it is being genuinely more
than that: real haptics, a real offline app with no network permission use, a
durable native save, hardware-button handling, and a microphone-driven game
mechanic that does not exist on the web build. Games shipped this way pass
review routinely. It is still a review, and worth knowing about before the
first submission rather than after.
