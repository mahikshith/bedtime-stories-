/**
 * Render the app icons.
 *
 * The repo ships no image assets — every pixel in every game is drawn at
 * runtime — and the stores need PNGs. So the icons are rendered from the same
 * SVG the favicon uses, at build time, rather than becoming a set of binaries
 * somebody has to remember to keep in step with the art.
 *
 * Two shapes are produced, because they are genuinely different jobs:
 *   - the plain icon, rounded, for iOS and the web manifest
 *   - a MASKABLE icon, where the art sits inside the middle 80% on a full
 *     bleed background, because Android crops icons to whatever shape the
 *     launcher feels like and anything near the edge gets sliced off
 *
 *   node tools/make-icons.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SVG = fs.readFileSync(path.join(ROOT, "src/assets/favicon.svg"), "utf8");
const OUT = path.join(ROOT, "src/assets");
const BG = "#2A86DE";

const page = async (browser, size, maskable) => {
  const ctx = await browser.newContext({
    viewport: { width: size, height: size }, deviceScaleFactor: 1,
  });
  const p = await ctx.newPage();
  // A maskable icon keeps the art inside the safe circle; a plain one fills
  // the tile and rounds its own corners.
  const inset = maskable ? size * 0.1 : 0;
  await p.setContent(`<!doctype html><body style="margin:0;background:${maskable ? BG : "transparent"}">
    <div style="position:absolute;inset:${inset}px;${maskable ? "" : `border-radius:${size * 0.22}px;overflow:hidden;`}">
      ${SVG.replace("<svg", `<svg width="100%" height="100%"`)}
    </div></body>`);
  await p.waitForTimeout(120);
  return { ctx, p };
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

for (const size of [48, 72, 96, 144, 192, 256, 384, 512, 1024]) {
  const { ctx, p } = await page(browser, size, false);
  await p.screenshot({ path: path.join(OUT, `icon-${size}.png`), omitBackground: true });
  await ctx.close();
}
for (const size of [192, 512]) {
  const { ctx, p } = await page(browser, size, true);
  await p.screenshot({ path: path.join(OUT, `icon-maskable-${size}.png`) });
  await ctx.close();
}

// The splash art: the icon centred on the app's background colour, at a size
// that survives being letterboxed onto any phone.
const { ctx, p } = await page(browser, 1200, false);
await p.setContent(`<!doctype html><body style="margin:0;width:1200px;height:1200px;background:#101A1F;
  display:grid;place-items:center">
  <div style="width:460px;height:460px;border-radius:104px;overflow:hidden">
    ${SVG.replace("<svg", `<svg width="100%" height="100%"`)}
  </div></body>`);
await p.waitForTimeout(120);
await p.screenshot({ path: path.join(OUT, "splash-1200.png") });
await ctx.close();

await browser.close();
const made = fs.readdirSync(OUT).filter((f) => f.endsWith(".png"));
console.log(`wrote ${made.length} PNGs into src/assets/`);
console.log(made.map((f) => "  " + f).join("\n"));
