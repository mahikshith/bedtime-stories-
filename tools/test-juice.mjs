/**
 * Proves hit-stop, shake and the shared juice reach every game.
 *
 * The calls were added from each game's own `sfx` markers, which is a good
 * map but not a guarantee: a marker inside a plain `function` callback binds
 * `this` to something else, and `this.juice?.hit(...)` then does nothing at
 * all, silently, for ever. `?.` protects against a crash and hides the bug.
 *
 * So this drives the real pages and asserts the three things that matter: the
 * engine owns a Juice, the scene got a reference to it, and freezing actually
 * stops the world.
 */
import { chromium } from "playwright";
import { CHROMIUM, dismissCoach } from "./browser.mjs";
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

const GAMES = ["say-jump", "tilt-maze", "word-mob", "shapes", "balance",
               "robot", "slide", "tangram", "town", "echo-pop"];

const browser = await chromium.launch({ executablePath: CHROMIUM });
const fails = [];

for (const game of GAMES) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  const q = game === "town" || game === "echo-pop" ? "" : "?level=0";
  await page.goto(`http://127.0.0.1:${port}/src/games/${game}.html${q}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await dismissCoach(page);

  const res = await page.evaluate(async () => {
    const wait = (t) => new Promise((r) => setTimeout(r, t));
    const e = window.__engine, s = window.__scene;
    if (!e?.juice) return { error: "engine has no juice" };
    if (!s?.juice) return { error: "scene never took a reference to it" };
    if (s.juice !== e.juice) return { error: "scene holds a DIFFERENT juice than the engine drives" };

    e.juice.reset();
    await wait(120);
    // Freeze, and check the scene stops advancing its own clock.
    const t0 = s.t;
    e.juice.hit("heavy");
    const frozen = e.juice.frozen;
    const trauma = e.juice.trauma;
    await wait(60);                       // inside the freeze
    const during = s.t - t0;
    await wait(400);                      // well past it
    const after = s.t - t0;
    return { frozen, trauma: +trauma.toFixed(2), during: +during.toFixed(3), after: +after.toFixed(3) };
  });

  await ctx.close();

  if (res.error) {
    console.log(`✗ ${game.padEnd(10)} ${res.error}`);
    fails.push(game);
    continue;
  }
  const stopped = res.during < 0.05;      // a heavy hit freezes ~83ms
  const resumed = res.after > 0.2;
  const ok = res.frozen && res.trauma > 0.4 && stopped && resumed && !errors.length;
  console.log(`${ok ? "✓" : "✗"} ${game.padEnd(10)} trauma ${res.trauma}  ` +
              `scene clock +${res.during}s frozen, +${res.after}s after` +
              (errors.length ? `  ERROR: ${errors[0]}` : ""));
  if (!ok) fails.push(game);
}

await browser.close();
server.close();
console.log(fails.length
  ? `\n${fails.length} game(s) do not feel anything: ${fails.join(", ")}`
  : `\n${GAMES.length}/${GAMES.length} games react to impact.`);
process.exit(fails.length ? 1 : 0);
