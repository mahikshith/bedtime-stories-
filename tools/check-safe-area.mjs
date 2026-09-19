/**
 * Proves the game canvas stays out from under the Android system bars.
 *
 * This bug was reported from a real phone three times and "fixed" twice,
 * because it is invisible everywhere it can be tested cheaply: a desktop
 * browser has no status bar, so `env(safe-area-inset-top)` is 0 and the
 * layout looks perfect. On Android `env()` is worse than useless — it reports
 * the DISPLAY CUTOUT, so a phone without a notch also says 0 while the clock
 * sits on top of the HUD.
 *
 * The app therefore does not trust `env()` alone: core/native.js sets
 * `--sys-top`/`--sys-bottom` on Android, and tokens.css takes the `max()`.
 * This forces those variables to a phone-like value and asserts that every
 * page actually moves its canvas out of the way — which is the thing no
 * screenshot on this machine would ever have shown.
 */
import { chromium } from "playwright";
import { CHROMIUM } from "./browser.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, url === "/" ? "/index.html" : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("nf");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const TOP = 30, BOTTOM = 18;   // the floors core/native.js declares on Android

const PAGES = [
  ["hub", "/index.html"],
  ["say-jump", "/src/games/say-jump.html?level=0"],
  ["tilt-maze", "/src/games/tilt-maze.html?level=0"],
  ["word-mob", "/src/games/word-mob.html?level=0"],
  ["echo-pop", "/src/games/echo-pop.html"],
  ["shapes", "/src/games/shapes.html?level=0"],
  ["tangram", "/src/games/tangram.html?level=0"],
  ["slide", "/src/games/slide.html?level=0"],
  ["robot", "/src/games/robot.html?level=0"],
  ["balance", "/src/games/balance.html?level=0"],
  ["town", "/src/games/town.html"],
  ["result", "/src/result.html"],
];

const browser = await chromium.launch({ executablePath: CHROMIUM });
const fails = [];

for (const [name, url] of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  // Stand in for the Android shell: declare system bars before anything lays out.
  await page.addInitScript(([t, b]) => {
    addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.setProperty("--sys-top", `${t}px`);
      document.documentElement.style.setProperty("--sys-bottom", `${b}px`);
    });
  }, [TOP, BOTTOM]);

  await page.goto(`http://127.0.0.1:${port}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const box = await page.evaluate(() => {
    const el = document.querySelector(".stage") || document.querySelector("canvas");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(innerHeight - r.bottom), tag: el.className || el.tagName };
  });

  await ctx.close();

  if (!box) { console.log(`✗ ${name.padEnd(10)} no stage or canvas on the page`); fails.push(name); continue; }

  const topOk = box.top >= TOP;
  const botOk = box.bottom >= BOTTOM;
  const ok = topOk && botOk;
  console.log(`${ok ? "✓" : "✗"} ${name.padEnd(10)} top ${box.top}px (need ≥${TOP})   bottom ${box.bottom}px (need ≥${BOTTOM})`);
  if (!ok) fails.push(name);
}

await browser.close();
server.close();

console.log(fails.length
  ? `\n${fails.length} page(s) would sit under the system bars: ${fails.join(", ")}`
  : `\n${PAGES.length}/${PAGES.length} pages clear the system bars.`);
process.exit(fails.length ? 1 : 0);
