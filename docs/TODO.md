# Backlog

Ordered by value. Items marked **[user]** were asked for explicitly.

---

## 1. Bundled image library **[user]**

Replace the never-called archive endpoints with a curated, licence-checked
folder shipped in the bundle. Keeps the app offline and runtime cost at zero.

- `public/img/<source>/<slug>.webp` — curate once, by hand, at build time.
- `src/content/imagery.ts` — manifest: `{ id, file, credit, source, worldIds,
  keywords }`, typed like the rest of the content layer.
- `docs/CREDITS.md` — every image, its archive, and its licence line.
- Sources, all public domain: NASA, NOAA, USGS, Smithsonian Open Access,
  Library of Congress.
- **NASA conditions are already encoded** in `engine/backdrop.ts` and must carry
  over: credit NASA, never imply endorsement, never use the insignia, logotype
  or seal. Also check for identifiable people (privacy/publicity rights).
- Keep the Real Window card as the place unretouched photography appears.
  Backdrops stay processed and low-opacity — photoreal astrophotography behind
  cartoon characters looks broken (`RESEARCH-PLATFORM.md` §3a).
- Budget the bundle: WebP, ~1280px max, target under ~8MB total.

Add a validator test: every manifest entry resolves to a real file, and every
entry has a non-empty credit.

## 2. On-device TTS spike **[user]**

**We are already on-device.** `window.speechSynthesis` in an Android WebView
routes to the platform engine (usually Google Speech Services), which runs
locally, costs nothing, and ships zero bytes. D11 is satisfied today.

The open question is only whether to *also* bundle a neural voice.

| | Platform TTS (now) | Bundled neural (Piper / Kokoro) |
|---|---|---|
| Cost | $0 | $0 |
| App size | 0 MB | ~20–80 MB per voice + ONNX/WASM runtime |
| Quality | varies by device | consistent, better |
| Brand | device voice | one recognisable "Lumi voice" |
| Low-end Android | instant | possibly seconds per sentence via WASM |
| Offline | yes | yes |

**Recommendation:** keep platform TTS as the default; offer a bundled voice as
an **optional download** after install, not in the base APK. That gets brand
consistency without a 60MB install or a slow first run on cheap hardware.

Candidates to evaluate (all permissively licensed, all actively maintained):
- **Piper** (`rhasspy/piper`) — small VITS voices, ONNX, built for edge devices.
  Most likely fit.
- **Kokoro-82M** — very good quality for its size; check licence and runtime.
- **Coqui TTS** — the company shut down; the repo lives on, check licence terms.
- **espeak-ng** — tiny, robotic; useful only as a last-resort fallback.

Note: **KITT.AI did not ship a TTS product.** It made Snowboy (hotword
detection), was acquired by Baidu, and Snowboy was discontinued in 2020. Don't
plan around it.

Spike deliverables: measure cold-start latency and per-sentence latency on a
low-end Android profile, measure APK delta, and A/B the result against platform
TTS for the bedtime register specifically (slow, warm, low).

## 3. On-device image generation **[user — deferred]**

Explicitly parked by the user. Revisit only after 1 and 2. Questions to answer
then: model size vs. APK budget, latency on mid-range Android, whether output
can be made safe and consistent for under-11s without a server, and whether it
beats a well-curated bundled folder at all (it may not).

## 4. Play Billing + Capacitor Android shell

- `@capacitor/cli @capacitor/core @capacitor/android`, then the README's steps.
- Wire the two one-time SKUs and the Spark consumable to the stubbed
  `purchase()` / `addSparks()` in `state/store.ts`.
- Play Console: Families programme, content rating, **AI-generated content
  declaration** (Wish Sparks), Data safety form (we collect nothing).
- No ad SDKs. If that ever changes: Play-certified only, non-personalised only.

## 5. Wish Sparks behind a real key

`WishSparkProvider` is written and unreachable (`useSpark: false` in `App.tsx`).
To enable: supply a `CompletionFn`, keep the placeholder-only prompt, keep the
safety filter, keep the meter. Costs are modelled in `SPARK_COST` and shown to
parents in the parent zone — keep that table honest if the numbers move.

## 6. Smaller things

- Onboarding cannot add a second child yet; only the parent zone should gain an
  "add a child" flow (seat limit is already enforced by `addProfile`).
- Rhyme progress is tracked but never surfaced on `Today`.
- `ColourStudio` has no undo — only "start again".
- Consider a "recently printed" list so parents can reprint last week's page.
- `docs/RESEARCH.md` §5 recommends listing **free-to-install with a hard paywall
  on first run** rather than paid-upfront. Still unresolved with the user.
