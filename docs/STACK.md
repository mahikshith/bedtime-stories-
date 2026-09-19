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

Both suites also run in CI (`.github/workflows/verify.yml`), so a broken level
fails the push rather than a child. The browser tools resolve Chromium through
`tools/browser.mjs` — `CHROMIUM_BIN`, then this container's bundled build,
then Playwright's own — because hardcoding the container's path meant the
whole suite worked in exactly one place.

`android/` and `ios/` are committed on purpose. The manifest and the
`Info.plist` are *source* — regenerating them would silently drop the
microphone permission, the portrait lock and the usage strings.

## Getting a build onto a phone

**An APK comes out of CI on every push.** `.github/workflows/android.yml`
builds a debug APK and attaches it to the run; download it from the
**Artifacts** section at the bottom of the run page, allow "install unknown
apps" on the phone, and tap the file.

That is the answer to a question worth writing down, because it was got wrong
once: the development container this repo is worked on in has a JDK and Gradle
but *no Android SDK*, and `dl.google.com` is blocked by its egress proxy, so
one cannot be fetched. None of that is true of GitHub's ubuntu runners, which
ship the SDK preinstalled. "I cannot build it here" was accurate and useless —
CI is where it gets built.

`versionCode` is stamped from the run number, since it has to increase on
every upload and that is the only monotonic counter available without keeping
state somewhere.

### Release builds

The CI artifact is a **debug** build signed with the standard debug keystore.
It is fine for trying on real hardware and cannot go to the Play Store. A
release build needs an upload keystore, which is a secret and does not belong
in a repository. When that exists, put it in GitHub Actions secrets and add a
signing config — the workflow is otherwise unchanged.

Locally, on a machine that has the SDK:

```sh
npm run sync
cd android && ./gradlew assembleDebug       # or bundleRelease, once signed
```

**iOS** needs macOS, Xcode and an Apple Developer account, so it cannot be
built in CI on a Linux runner either:

```sh
npm run sync
cd ios/App && pod install
open App.xcworkspace          # set the team, bump the build, Archive
```

## Store readiness: what is done and what is not

Done here:

- app id `com.wordquest.kids`, display name, portrait lock, splash and status
  bar colours
- launcher icons at all five Android densities plus the adaptive foreground
  layer, which keeps its art inside the middle because Android only guarantees
  the centre 66% survives whatever shape a launcher masks it to
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
