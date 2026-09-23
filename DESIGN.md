# Word Quest — visual system

This is the design source for the child-facing shelf and future screens. `docs/DESIGN.md` separately explains the gameplay decisions and must remain intact. Screens generated in Stitch should follow the descriptive rules here. Actual shipping UI uses the existing zero-bundler CSS and Canvas renderer.

## Atmosphere

A small illustrated bookcase in a bird's house, lit by warm lamplight. Cheerful without visual noise. Density 4/10, variance 5/10, motion 4/10. Keep the chosen game's art as the focus. The first screen should offer one obvious next action and no dashboard of currencies.

## Color and material

Use one warm neutral family for navigation: deep pine `#172A29` for the room; raised pine `#233C39` for surfaces; cream `#FFF5DD` for primary lettering; muted cream `#CFDFD5` for supporting lettering. The shelf's single action accent is apricot `#F3B86A`, with dark ochre `#8F5428` for its pressed edge. Game art may use its existing broad palette to distinguish worlds, but gameplay never relies on color alone. Avoid neon, glass panels, purple glows, and black text over busy artwork.

## Type

Keep the self-hosted Baloo 2 display face and Nunito UI face. Small action labels are at least 16 CSS px on a phone, explanations 16–18 px, game names 20–24 px, and headings 30–36 px. Use weight and spacing instead of uppercase microtype. Target body contrast of 4.5:1 and large text of 3:1 against its actual backing.

## Composition

- **Welcome:** bird illustration and a friendly title; a short parent prompt; three age choices with large age numerals, useful names, and descriptions. These choices are visible without hunting.
- **Shelf:** one featured *Continue* action when progress exists, then a two-column gallery of illustrated games. The artwork must read before the words. The saved bird is a personal anchor, not a shopping avatar.
- **Game detail:** one large play button and a compact path; distinguish completed, current, and locked stages by shape, label, and contrast.
- **In game:** keep the central action clear. Place control modes at the top where hands do not obscure them; large controller targets at the bottom only when selected. The word or puzzle prompt must remain readable above fingers.

## Components and motion

Cards are matte, softly inset paper on a pine shelf. Shadows have an offset and a soft edge. A button moves down under the finger, then settles. Transitions take 150–240 ms and respect reduced motion. Reward motion follows a successful action; never run perpetual attention-grabbing motion beside a word being learned. Focus rings, pressed states, loading, unavailable audio, and a return route are explicit.

## Touch and accessibility

Minimum 44×44 CSS px targets (aim for 56 px on child controls), visible focus, text labels on icon actions, safe-area padding from the native shell, no horizontal clipping at 360 px, and no essential microphone/gyroscope dependency. A controller gesture is owned by its pointer ID; cancellation releases it without triggering an action. Children can replay without losing prior achievements.

## Do not generate

No three equal marketing cards, emoji as the only way to identify a game, tiny uppercase status chips, overlapping headline artwork, fake urgency, endless animations, unexplained currency prompts, or a purchase button in a child-facing screen.
