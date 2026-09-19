/**
 * Put the app's own icons into the Android project.
 *
 * `npx cap add android` lays down Capacitor's placeholder launcher icons, and
 * a build that ships those is confusing for whoever installs it — the app on
 * the home screen is not visibly this app. These are rendered from the same
 * SVG everything else uses, so there is one source of truth for the artwork
 * and no binaries anybody has to keep in step by hand.
 *
 * Android wants three things at five densities:
 *   ic_launcher            the square icon, for old launchers
 *   ic_launcher_round      the circular one, likewise
 *   ic_launcher_foreground the adaptive layer, which gets masked to whatever
 *                          shape the launcher likes and so must keep its art
 *                          well inside the middle — Android only guarantees
 *                          the centre 66% survives the crop
 *
 *   node tools/install-android-icons.mjs
 */
import { chromium } from "playwright";
import { CHROMIUM } from "./browser.mjs";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RES = path.join(ROOT, "android/app/src/main/res");
if (!fs.existsSync(RES)) {
  console.error("android/ is missing — run `npx cap add android` first."); process.exit(1);
}
const SVG = fs.readFileSync(path.join(ROOT, "src/assets/favicon.svg"), "utf8")
  .replace("<svg", "<svg width=\"100%\" height=\"100%\"");
const BG = "#2A86DE";

/** Launcher icon sizes, and the larger canvas the adaptive layer needs. */
const DENSITIES = [
  ["mdpi", 48, 108], ["hdpi", 72, 162], ["xhdpi", 96, 216],
  ["xxhdpi", 144, 324], ["xxxhdpi", 192, 432],
];

const browser = await chromium.launch({ executablePath: CHROMIUM });

async function shot(html, size, out, transparent = false) {
  const ctx = await browser.newContext({
    viewport: { width: size, height: size }, deviceScaleFactor: 1,
  });
  const p = await ctx.newPage();
  await p.setContent(html);
  await p.waitForTimeout(90);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await p.screenshot({ path: out, omitBackground: transparent });
  await ctx.close();
}

let written = 0;
for (const [density, size, adaptive] of DENSITIES) {
  const dir = path.join(RES, `mipmap-${density}`);

  await shot(`<!doctype html><body style="margin:0">
    <div style="width:${size}px;height:${size}px;border-radius:${size * 0.22}px;overflow:hidden">${SVG}</div>
    </body>`, size, path.join(dir, "ic_launcher.png"));

  await shot(`<!doctype html><body style="margin:0">
    <div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden">${SVG}</div>
    </body>`, size, path.join(dir, "ic_launcher_round.png"));

  // The adaptive foreground: transparent, with the bird inside the safe zone
  // so a circular or squircle mask does not lop off its beak.
  const pad = adaptive * 0.19;
  await shot(`<!doctype html><body style="margin:0;background:transparent">
    <div style="position:absolute;inset:${pad}px">${SVG.replace(
      /<rect width="64" height="64" rx="14" fill="#2A86DE"\/>/, "")}</div>
    </body>`, adaptive, path.join(dir, "ic_launcher_foreground.png"), true);

  written += 3;
}

await browser.close();

// The adaptive background is a flat colour behind the foreground layer.
const colours = path.join(RES, "values/ic_launcher_background.xml");
fs.writeFileSync(colours, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BG}</color>
</resources>
`);

// Capacitor's template ships a vector foreground for API 24 that would win
// over the PNG on some devices, leaving the placeholder art in place.
const v24 = path.join(RES, "drawable-v24/ic_launcher_foreground.xml");
if (fs.existsSync(v24)) {
  fs.rmSync(v24);
  console.log("removed the template's drawable-v24 vector foreground");
}

console.log(`wrote ${written} launcher PNGs across ${DENSITIES.length} densities`);
console.log(`set the adaptive background to ${BG}`);
