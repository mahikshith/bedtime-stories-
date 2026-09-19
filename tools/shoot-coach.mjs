/**
 * Screenshots the tutorial and the pause menu on every game.
 *
 * The coach is one overlay shared by ten games it knows nothing about, so the
 * thing that can go wrong is collision: the info button landing on top of a
 * charge meter, the caption card covering the board it is explaining, a
 * gesture pointing at empty sky. None of that shows up in a unit test. It
 * shows up here, or on a child's phone.
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

const OUT = process.argv[2] ?? "/tmp/coach";
const MODE = process.argv[3] ?? "tutorial";   // tutorial | menu | idle
fs.mkdirSync(OUT, { recursive: true });

const GAMES = [
  ["say-jump", "/src/games/say-jump.html?level=0"],
  ["tilt-maze", "/src/games/tilt-maze.html?level=0"],
  ["word-mob", "/src/games/word-mob.html?level=0"],
  ["shapes", "/src/games/shapes.html?level=0"],
  ["balance", "/src/games/balance.html?level=0"],
  ["robot", "/src/games/robot.html?level=0"],
  ["slide", "/src/games/slide.html?level=0"],
  ["tangram", "/src/games/tangram.html?level=0"],
  ["town", "/src/games/town.html"],
  ["echo-pop", "/src/games/echo-pop.html"],
];

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];

for (const [name, url] of GAMES) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`); });
  await page.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.setProperty("--sys-top", "30px");
      document.documentElement.style.setProperty("--sys-bottom", "18px");
    });
  });

  await page.goto(`http://127.0.0.1:${port}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  const state = await page.evaluate((mode) => {
    const c = window.__coach;
    if (!c) return { error: "no coach on the page" };
    if (mode === "idle") c.close();
    else if (mode === "menu") { c.close(); c.openMenu(); }
    else c.openTutorial();
    return { mode: c.mode, script: !!c.script, blocking: c.blocking };
  }, MODE);

  // let the fade finish and the hand get into the middle of its gesture
  await page.waitForTimeout(MODE === "tutorial" ? 900 : 500);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await ctx.close();
  console.log(`${state.error ? "✗" : "✓"} ${name.padEnd(10)} ${JSON.stringify(state)}`);
}

await browser.close();
server.close();
if (errors.length) { console.log("\npage errors:"); errors.forEach((e) => console.log("  " + e)); }
console.log(`\nwrote ${GAMES.length} shots to ${OUT}`);
process.exit(errors.length ? 1 : 0);
