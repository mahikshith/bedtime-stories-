# Store readiness — App Store and Google Play

**Goal:** ship to both stores.
**Status:** not submittable yet. The app is feature-complete for a v1, but
neither native shell has ever been built and several store artefacts do not
exist. This is the honest gap list.

---

## 1. What blocks submission today

| Blocker | Store | Why |
|---|---|---|
| Neither shell has been built | both | No Android SDK and no macOS in this environment. `capacitor.config.json` and the scripts are scaffolded but unverified. |
| `@capacitor/*` not installed | both | Deliberate — the dependency tree stays honest about what has been tested. |
| `RECORD_AUDIO` / `NSMicrophoneUsageDescription` not applied | both | Shells are gitignored; see `PLATFORM-CONFIG.md`. Voice games fail silently without them. |
| No app icons or screenshots | both | Play needs 512×512 + feature graphic + phone screenshots; Apple needs 1024×1024 + per-device screenshots. |
| Privacy policy has a placeholder contact | both | `privacy@lumisleepyworlds.example` must become a real address. |
| No hosting for the privacy URL | both | `dist/privacy.html` is generated; the Pages workflow can host it once Pages is enabled. |
| IAP not wired | both | `purchase()` / `addSparks()` are stubs. |
| Apple Developer Program | Apple | $99/yr, and a Mac is required to build and upload. |
| Play Console | Google | $25 one-off. |

## 2. Where we are already strong

These are the parts most kids' apps fail on, and they were designed in rather
than bolted on:

- **No third-party SDKs at all.** Runtime dependencies are `react` and
  `react-dom`. Apple's Kids Category forbids third-party analytics and
  advertising and bars sending personally identifiable or device information to
  third parties; we have nothing to declare because there is nothing there.
- **No data collection.** No accounts, no analytics, no ads, no network calls in
  the daily loop. The Data safety form and the Privacy Nutrition Label are both
  the easy version: "no data collected".
- **Child PII never leaves the device**, by construction — names are substituted
  at render time (`DECISIONS.md` D2).
- **The microphone measures loudness and discards every frame.** No recording,
  no upload, never `SpeechRecognition` (D17). A voice *recording* is personal
  information under COPPA; this is not one.
- **A neutral parental gate** already guards the purchase flow, and a PIN guards
  settings — Apple requires a gate before purchases in Kids Category apps.
- **In-app privacy policy**, reachable from the parent zone, generated from the
  same source as the hosted page so they cannot drift.
- **AI disclosure** is already shown in the parent zone, which Play's
  AI-generated content policy requires.

## 3. Apple — App Store

**Kids Category.** Worth entering: it is where parents browse, and we already
meet the hard parts. It also brings the strictest review.

- Guideline 1.3 / 5.1.4: no third-party analytics or advertising; no PII or
  device info to third parties; parental gate before purchases and before any
  link out of the app. **We currently have no outbound links at all** — keep it
  that way, or gate them.
- Privacy policy link required in App Store Connect **and** reachable in-app in
  an easily accessible manner. Both exist.
- `NSMicrophoneUsageDescription` must say what is measured and what is not
  kept. Draft wording is in `PLATFORM-CONFIG.md`; a human reviewer reads it.
- Age rating questionnaire → expect **4+**. Nothing in the content triggers a
  higher band; the safety filter exists partly so this stays true.
- Screenshots: 6.7" and 6.5" iPhone required, iPad if the app supports it.
  Decide whether to ship iPad — it is a better colouring surface.
- Review notes: explain the microphone in one sentence. Volunteering "loudness
  only, no recording, never transmitted" pre-empts the obvious question.

**Not needed:** account deletion (no accounts), sign-in with Apple (no sign-in),
ATT prompt (no tracking).

## 4. Google — Play

- **Families programme** + content rating questionnaire (IARC).
- **Data safety form**: no data collected, no data shared. Must match the
  privacy policy exactly — a mismatch is a common rejection.
- **AI-generated content declaration** for Wish Sparks. Already disclosed
  in-app; declare it in the listing too.
- **Certified ad SDKs only** — we have none. If that ever changes,
  non-personalised only.
- Target API level: whatever Play currently requires; Capacitor's template
  usually tracks it, but check before each submission.
- Assets: 512×512 icon, 1024×500 feature graphic, at least two phone
  screenshots.

## 5. The pricing decision that is still open

`RESEARCH.md` §5 recommends **free-to-install with a hard paywall on first run**
rather than a paid-upfront listing. The monetisation is identical — you still
pay before getting anything — but paid-upfront listings are ~3% of Play installs
while >95% of Play revenue comes from free-to-install apps, because a price on
the listing suppresses install velocity, ranking and review volume at once.

This decision must be made **before** the first submission: changing a paid app
to free later is one-way on both stores, and you cannot charge existing free
users afterwards.

Apple note: the Kids Category permits IAP, but a hard paywall on first run with
no usable free content sometimes draws a reviewer's attention under "minimum
functionality". A short, genuinely playable preview for the **parent** — not
locked content for the child — is the safer framing.

## 6. Suggested order of work

1. Decide pricing (§5). Everything else is reversible; this is not.
2. Install `@capacitor/*`, generate both shells, apply `PLATFORM-CONFIG.md`.
3. **Test the voice games on a real handset** — the one path no test here can
   cover.
4. Real privacy contact address + host `privacy.html`.
5. Icons and screenshots from the existing mascot and design tokens.
6. Wire IAP behind the existing `purchase()` stub.
7. Internal testing track on Play; TestFlight on Apple.

## 7. Things that will get this rejected if forgotten

- A Data safety form or Nutrition Label that claims more or less than the
  privacy policy says.
- A vague microphone usage string.
- Any analytics SDK added "just for crash reports" — in the Kids Category that
  is a rejection, not a warning.
- Screenshots showing UI that no longer exists.
- Shipping the placeholder privacy email.
