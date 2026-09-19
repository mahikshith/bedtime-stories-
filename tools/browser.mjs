/**
 * Where to find Chromium.
 *
 * The development container ships its own build at a fixed path and tells
 * Playwright not to download one, so every tool here used to hardcode it.
 * That works exactly nowhere else — on a GitHub runner the path does not
 * exist and every browser-driven test fails on the first line, which is a
 * silly way to discover that the verification suite is not portable.
 *
 * Resolution order:
 *   1. CHROMIUM_BIN, for anyone who wants to point at a specific build
 *   2. the container's bundled Chromium, if it is really there
 *   3. nothing — and Playwright uses the browser it manages itself, which is
 *      the normal case on CI and on a laptop
 */
import fs from "node:fs";

const CONTAINER = "/opt/pw-browsers/chromium";

export const CHROMIUM =
  process.env.CHROMIUM_BIN ||
  (fs.existsSync(CONTAINER) ? CONTAINER : undefined);

/**
 * Get the how-to-play overlay out of the way, the way a child does.
 *
 * Every game now opens with a tutorial the first time it is played, and that
 * tutorial deliberately freezes the scene and swallows taps — otherwise a
 * five-year-old reading it would come back to a drowned bird. Which means
 * every harness that drives a game has to dismiss it first, exactly as a real
 * player would, or it sits watching an intro screen and reports the game is
 * broken.
 *
 * Call it after the page settles and before driving any input.
 */
export async function dismissCoach(page) {
  await page.evaluate(() => window.__coach?.close?.());
  await page.waitForTimeout(120);   // let the scrim finish fading out
}
