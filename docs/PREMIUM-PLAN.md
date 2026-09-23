# Word Quest: Android-first product plan

This is a working checklist, not a promise that every idea belongs in the app. Keep the game 2D, retain the zero-bundler Canvas/Capacitor stack, and finish one vertical slice before starting the next. A slice is done only after its interaction, accessibility, browser simulation, and physical Android checks are recorded. Browser checks catch layout and logic regressions; a phone remains necessary for microphone, tilt, haptics, system bars, and performance.

**Session state (2026-09-24):** Slice 1's hub and game-entry UI is implemented and browser-checked, but remains open until its Android phone verdict. The long touch suite was intentionally interrupted for handoff. See `HANDOFF.md` for exact checks and branch state.

## Product direction

**Audience:** Children roughly 2–11, with a parent choosing an age band and managing settings. Design the first ten seconds for an adult handing over a phone, then make the next playable action obvious to a child. Short repeatable activities, tactile feedback, original characters and settings, and a predictable return route matter more than currencies or streak pressure.

**Visual brief:** A warm illustrated activity book. Matte paper, deep pine ink, apricot action color, and distinct colorful game scenes. Baloo 2 gives headings personality; Nunito keeps instructions readable. Keep pictures and one primary action dominant. Use small, purposeful rewards after success and quiet states while a child is reading or listening.

**Research input, not templates:** [BabyBus](https://play.google.com/store/apps/details?id=com.sinyee.babybus.kids) and its [Chinese-language world listing](https://play.google.com/store/apps/details?hl=zh&id=com.sinyee.babybus.world) demonstrate a large set of short themed activities and recurring character identity. [iHuman Chinese](https://play.google.com/store/apps/details?hl=zh&id=com.hongen.app.word) shows progressive literacy interactions and story content. Borrow the principles of variety, recognizable characters, and gradual mastery; create our own mechanics, illustrations, copy, and level content. Do not copy branded assets or level layouts.

**Commercial guardrail:** Earn a parent's trust through working, replayable content before adding payment. A future parent-facing unlock for additional worlds is preferable to child-facing purchase prompts, streak loss, or artificial waits. Review [Google Play Families policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en) and [Apple's Kids guidance](https://developer.apple.com/kids/) before implementing commerce or external links. Put purchases and settings behind a parent gate; keep core play free of ads and dark patterns.

## Sequential slices

- [x] **0. Baseline and architecture.** Read README, CLAUDE, HANDOFF, MEMORY, stack/design notes; identify runtime and existing tests. The project is a 2D Canvas web app in Capacitor, not Unity. Record screenshots and Android limitations.
- [ ] **1. First choice and game entry.** Make age choices visible on first phone viewport; replace the long initial level wall with a concise current-stage invitation and an optional level map. Give the hub one coherent storybook surface and original code-drawn art. Check 360×640 and 420×880, keyboard focus, reduced motion, `npm test`, `npm run verify`, and Android packaging.
- [ ] **2. On-device reality check.** Install a debug APK on a physical Android phone. Record first launch, touch, back navigation, safe areas, microphone permission and speech fallback, TTS output, tilt fallback, haptics, and frame pacing. Fix failures before expanding content. iOS verification follows on a real iPhone or Xcode simulator.
- [ ] **3. One excellent learning loop.** Pick a representative game (likely Say & Jump), define a 30–90-second loop with clear anticipation, action, feedback, and replay. Re-author its opening levels for a gentle challenge ramp; use the real simulation/level audit. Test with children and a parent before propagating patterns.
- [ ] **4. Shared feel and asset kit.** Normalize illustrated thumbnails, character poses, sound levels, touch responses, success/failure feedback, and safe-area HUD rules in shared modules. Use original code-native 2D assets or properly licensed external assets with receipts. Do not add 3D production simply because a 3D plugin is available.
- [ ] **5. Remaining games, one at a time.** Audit and repair each game for winability, device input, early delight, readable instruction, replay, and age fit. Change generated levels only through their composers; record solver and playtest evidence for each game. Retire or redesign a weak game rather than adding a shallow one to reach a count.
- [ ] **6. New activities and retention.** Prototype original mechanics grounded in words, shapes, and causal play, then validate comprehension and replay with families. Add a parent-facing progress view based on actual mastery. Measure voluntary replays and session satisfaction, not coercive engagement.
- [ ] **7. Parent value and release.** Decide what remains free, price any additional content transparently in a gated parent area, review store policy/privacy, and run release builds on Android and iOS. Do not ship payment before the core loop and content demonstrate value.

## Decision log

- Android first, iOS compatibility kept in the same source tree.
- Native hardware tests are the release gate; Chromium screenshots are a fast visual regression tool for this web-rendered game, not proof that Android speech or touch works.
- Taste, ShapeUI, StitchDesign and UI UX Designer guide visual/interaction decisions. Game Studio guides 2D browser playtest; Game Development Studio's CLI is unavailable in this environment. Unity Essentials does not apply to this non-Unity repository. Meshy and to3D are deferred because the shipping art is 2D.
