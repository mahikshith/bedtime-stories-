---
name: lumi-ui
description: The design system rules for Lumi — a kids' app on Android and iOS. Craft rules adapted from the UIUX-high-taste-skill collection, with the luxury-SaaS aesthetic deliberately overridden for a 3-11 audience. Load before changing any layout, component or visual token.
---

# Lumi UI — craft for small hands

Derived from [Payoss/UIUX-high-taste-skill](https://github.com/Payoss/UIUX-high-taste-skill)
(`taste-skill`, `soft-skill`), **adapted**. That collection engineers
"$150k agency" landing pages for adults. We are building a bedtime app for
three-to-eleven-year-olds on a phone. The engineering craft transfers almost
entirely; the aesthetic does not.

Read §1 for what we took, §2 for what we deliberately reject and why. §2 exists
because a future session reading the upstream skill will otherwise "fix" our
design in the wrong direction.

---

## 1. Rules we adopt

**Layout**
- **CSS Grid, never flexbox percentage maths.** No `calc(33% - 1rem)`. Use
  `grid-template-columns` with `gap`.
- **Never `100vh`. Always `100dvh`.** `vh` jumps catastrophically on iOS Safari
  when the address bar moves — and we ship inside a WebView on both platforms.
- **Two across at 390px, and check the arithmetic.** The page is ~358px wide
  inside its gutters, so with a 16px gap each column is ~171px. An
  `auto-fill minmax()` minimum any wider than that silently collapses to one
  column — that exact bug shipped once. `.tiles` uses 140px, `.tiles--roomy`
  158px. Only below 330px does it drop to a single column.
- **Long lists are shelves, not columns.** Eighteen worlds or twenty-two rhymes
  become a horizontal `.shelf` with scroll-snap, grouped into rows that mean
  something. The tile peeking past the gutter is the affordance that says there
  is more; that is why the shelf bleeds to the screen edge.
- **Nested enclosure ("double bezel").** A tile is a chunky outer shell with its
  own hairline and radius, containing an inner core with a smaller, concentric
  radius. It reads as a physical object — which is exactly right for children.
  Concentric radii: inner = outer − padding.

**Colour**
- **Palettes are data, not stylesheets.** `content/themes.ts` overrides the same
  token names `tokens.css` declares, applied inline on `:root`. Components never
  learn a theme exists.
- **Children prefer saturation and brightness.** Preference correlates
  positively with saturation across every hue family, warm hues slightly
  dominate, and *deep shades read as negative to them*. Bright beats tasteful.
- **Contrast is tested, not eyeballed.** `themes.test.ts` enforces 7:1 for body
  text and 3:1 for text on the accent. Two palettes failed on first write. When
  a bright accent fails, darken the *text*, not the accent — the brightness is
  the point.
- **The mascot does not follow the theme.** A character that changes colour is a
  shape. Lumi is turquoise everywhere.
- **The story player is its own room.** Worlds carry deep night gradients by
  design, so `.story` forces light text whatever palette is on — and it must
  actually *consume* the variable (`color: var(--text-hi)`), because redefining
  a custom property does not change an already-inherited `color`.

**Materiality**
- Glass needs three parts, not just blur: `backdrop-filter`, a 1px inner
  highlight (`inset 0 1px 0 rgba(255,255,255,.18)`), and a tinted shadow that
  shares the background hue. Blur alone looks like frosted plastic.
- **Never pure `#000`.** Our floor is `--ink-900: #070a16`.
- Shadows are tinted toward the background, never neutral grey.

**Motion**
- Animate **`transform` and `opacity` only**. Never `top`, `left`, `width`,
  `height`.
- Never `linear` or `ease-in-out`. Use `--ease-soft`.
- **Staggered entrance** via CSS custom property index:
  `animation-delay: calc(var(--i) * 45ms)`. No JS, no dependency.
- Tactile `:active` — `scale(.97)` — on everything tappable.
- Everything above must vanish under `prefers-reduced-motion`.

**States**
- Loading, empty and error states are not optional. Skeletons match the real
  layout; no generic spinners.

## 2. Rules we deliberately reject

| Upstream rule | Why it is wrong here |
|---|---|
| **"Emojis are BANNED"** | Our users cannot read. An emoji is the *affordance* for a four-year-old — it is how they tell Rhymes from Colouring. This is the single biggest inversion. |
| "Max 1 accent, saturation < 80%" | Desaturated luxury palettes are for adults. Children need bright, distinguishable hues; each world and pillar carries its own. |
| "No oversized H1s" | Big friendly type is correct for a child and for a tired parent in a dark room. |
| Ultra-light 1px icons (Phosphor Light) | Hairline icons are invisible to a child and untappable. Chunky, high-contrast, ≥44px targets. |
| "Macro-whitespace, `py-24`–`py-40`" | That is a desktop landing page. On a 390px phone it means one tile per screen and endless scrolling. |
| Tailwind / Framer Motion / Phosphor | Three runtime dependencies. We ship `react` + `react-dom` only, and `privacy.test.ts` enforces it — Apple's Kids Category bars third-party SDKs from receiving device or personal data, and the cheapest way to comply is to have none. Plain CSS does all of this. |
| "No 3-column card grids" | Valid for marketing pages. For a launcher grid of activities, predictable and symmetrical is *easier for a child*, not lazier. |
| Serif banned | We use serif deliberately for story and rhyme text: it is a reading surface, not a dashboard. |
| "Deepest OLED black `#050505`" | Too harsh. Warm near-black, and it warms further through the sleep gradient. |

## 3. Non-negotiables specific to this app

- **Night-first.** There is no light theme. The palette warms and dims through
  the evening via the sleep gradient; nothing may fight that.
- **Tap targets ≥ 44px**, and ≥ 56px for anything a three-year-old uses.
- **Works at 390px.** Always check there first, not at desktop width.
- **The mascot carries emotion.** Eyebrows and eye shape do the work — a face
  without brows reads as blank. Every screen state should pick a mood.
- **No streaks, XP, timers or leaderboards anywhere.** Not a visual rule but it
  constrains the visual language: no progress bars that imply falling behind.

## 4. Checklist before finishing any UI change

1. Does it collapse to one column under 480px?
2. Are all tap targets ≥ 44px?
3. Is every animated property `transform` or `opacity`?
4. Does `prefers-reduced-motion` disable it?
5. Does it still read in wind-down, when the screen is dimmed and warmed?
6. `npm run smoke` — does it still render without console errors at 390px?
