---
name: lumi-ui
description: Lumi's house rules — the kid-specific overrides that sit ON TOP of the installed craft skills (animate, mobile-native, apple-design, emil-design-eng). Load before changing any layout, component, motion or visual token. It does not restate general craft; it records only where a bedtime app for 3-11 year olds must differ, and why.
---

# Lumi UI — house rules

**This file is deliberately short, because most of the craft is not ours.**

General craft lives in the installed skills, which are the authority:

| For | Load |
|---|---|
| Building or changing any motion | `animate` (and `RECIPES.md` for a known component) |
| Anything touch, viewport, safe-area or WebView | `mobile-native` |
| Gestures, springs, materials, depth, typography | `apple-design` |
| General polish, review format, component detail | `emil-design-eng` |
| "What could animate here?" | `find-animation-opportunities` |
| Auditing motion across the app | `improve-animations` |
| Checking motion in a diff | `review-animations` |

Those skills encode Emil Kowalski's craft bar (MIT, see `.claude/skills/NOTICE.md`).
**Follow them by default.** This file exists only to record the places where a
bedtime app for three-to-eleven-year-olds must diverge — and to stop a future
session "fixing" those divergences back.

---

## 1. Where we diverge, and why

| Installed rule | Our override | Why |
|---|---|---|
| Hover/press motion is near-imperceptible on frequent elements | **Press feedback is generous and unmissable** — `scale(0.96)`, not `0.99` | A four-year-old's model of "did it hear me" is cruder than an adult's. This is the *feedback* purpose, on an occasional-tier element, so the budget is there. |
| Delight is reserved for the rare/first-time tier | **Delight is also allowed on the first success of each session** | A child's session is 10–20 minutes. What an adult sees "occasionally" a child sees once per night. Still never on repeated taps within a session. |
| Reduced motion means *fewer and gentler*, not zero | Same — **but wind-down has its own budget too** | After 18:00 the sleep gradient is already reducing motion for a different reason. Both must compose; neither may re-enable the other. |
| Icons over text for clarity | **Emoji, at size, as the primary label** | Our users cannot read. For a four-year-old the emoji *is* the affordance — it is how they tell Rhymes from Colouring. Non-negotiable, and the single biggest inversion from any adult-facing guidance. |
| Restraint in colour; one accent | **Bright, saturated, many hues** | Measured: children's colour preference correlates positively with saturation across every hue family, warm hues slightly dominate, and deep shades read as *negative* to them. Tasteful desaturation is an adult preference. |
| Typography: optical sizing, tight tracking, modest headings | **Big friendly type** | Correct for a child, and for a tired parent squinting in a dark room. |

## 2. Non-negotiables

- **Tap targets ≥ 44px; ≥ 56px for anything a three-year-old uses.** Measured on
  the hit area, not the glyph.
- **Works at 390px.** Check there first, never at desktop width.
- **Two across at 390px, and check the arithmetic.** The page is ~358px inside
  its gutters, so with a 16px gap each column is ~171px. An `auto-fill minmax()`
  minimum wider than that silently collapses to one column — that exact bug
  shipped once. `.tiles` uses 140px, `.tiles--roomy` 158px.
- **Long lists are shelves, not columns.** Eighteen worlds or twenty-two rhymes
  become a horizontal `.shelf` with scroll-snap, grouped into rows that *mean*
  something. The tile peeking past the gutter is the affordance; that is why the
  shelf bleeds to the screen edge.
- **The mascot does not follow the palette.** A character that changes colour is
  a shape. Lumi is turquoise in every theme.
- **The mascot carries emotion through eyebrows.** A face without brows reads as
  blank. Every screen state picks a mood.
- **The story player is its own room.** It stays dark under every palette,
  including the three light ones — and it must actually *consume* the variable
  (`color: var(--text-hi)`), because redefining a custom property does not
  change an already-inherited `color`.
- **No streaks, XP, timers or leaderboards.** Not a visual rule, but it
  constrains the visual language: nothing that implies falling behind, and no
  progress bar a child can lose.
- **No new runtime dependencies.** `react` + `react-dom` only, enforced by
  `privacy.test.ts`. Apple's Kids Category bars third-party SDKs from receiving
  device or personal data; the cheapest way to comply is to have none. This is
  why `pick-ui-library` will usually answer "hand-roll it" here — that is a real
  constraint, not laziness, and it means any component we hand-roll owes the
  focus management the library would have given us.

## 3. Materials and palettes

- **Palettes are data.** `content/themes.ts` overrides the same token names
  `tokens.css` declares, applied inline on `:root`. Components never learn a
  theme exists. Six palettes: three night, three day.
- **Contrast is tested, not eyeballed.** `themes.test.ts` enforces 7:1 for body
  text and 3:1 for text on the accent. Two palettes failed on first write. When
  a bright accent fails, **darken the text, not the accent** — the brightness is
  the point for the user; the ratio is for the buyer.
- **Glass needs three parts**, not just blur: `backdrop-filter`, a 1px inner
  highlight (`inset 0 1px 0 rgba(255,255,255,.18)`), and a tinted shadow sharing
  the background hue. Blur alone looks like frosted plastic.
- **Never pure `#000`.** Our floor is `--ink-900: #070a16`, and it warms further
  through the sleep gradient.
- **Nested enclosure ("double bezel").** A chunky outer shell with its own
  hairline and radius, containing an inner core at a concentric radius
  (inner = outer − padding). It reads as a physical object, which is right for
  children.

## 4. The motion tokens

Defined in `tokens.css`, taken from the `animate` skill's table — **do not
hand-roll a curve**:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* entering, exiting, press */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* moving on screen */
--ease-soft: <legacy alias of --ease-out>        /* being retired */
--dur-press: 140ms;  --dur-fast: 180ms;
--dur-mid: 240ms;    --dur-slow: 700ms;          /* slow is for the sleep gradient only */
```

`--dur-slow` is the one place we exceed the skill's 300ms UI ceiling. That is
deliberate and scoped: it drives the sleep gradient, which is *content* pacing,
not UI feedback. Never use it on a control.

## 5. Checklist before finishing any UI change

1. Two columns at 390px, not one?
2. Every tap target ≥ 44px?
3. Every animated property `transform` or `opacity`?
4. `prefers-reduced-motion` handled — gentler, not deleted?
5. Every `:hover` inside `@media (hover: hover) and (pointer: fine)`?
6. Still readable in wind-down, dimmed and warmed?
7. `npm test` green and `npm run smoke` clean at 390px?
8. What did you *not* verify without a phone? Say so.
