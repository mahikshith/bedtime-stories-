/**
 * Plays every Say & Jump level to the end, and fails if one cannot be won.
 *
 * "There should always be a success ratio... users need to win at some point"
 * — and a level that cannot be finished is not difficulty, it is a bug. The
 * ways it happens are not ones a screenshot shows: a gap wider than a jump, a
 * moving platform that delivers you to a ledge a tile too high to walk onto,
 * a hazard sitting where the only route is.
 *
 * This drives the touch path rather than the microphone, which is the same
 * code past `launch()`, and it holds long enough to count as having said the
 * word — below that threshold the game treats the input as a stumble and none
 * of the guarantees a correct word carries apply.
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

const { LEVEL_COUNT } = await import(`${ROOT}/src/js/games/say-jump/levels.js`);
const browser = await chromium.launch({ executablePath: CHROMIUM });
const fails = [];

for (let level = 0; level < LEVEL_COUNT; level++) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/src/games/say-jump.html?level=${level}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await dismissCoach(page);
  await page.mouse.click(210, 500);
  await page.waitForTimeout(400);

  const peek = () => page.evaluate(() => {
    const s = window.__scene;
    return s && {
      state: s.state, stop: s.stopIndex, stops: s.stops.length,
      hearts: s.hearts, need: s.needCharge ?? 0.5, name: s.level.name,
    };
  });

  let st = await peek(), turns = 0;
  for (; turns < 140; turns++) {
    st = await peek();
    if (!st || st.state === "done") break;
    if (st.state === "prompt") {
      const ms = Math.max(500, Math.round((st.need + 0.16) / 0.85 * 1000));
      await page.mouse.move(210, 600);
      await page.mouse.down();
      await page.waitForTimeout(ms);
      await page.mouse.up();
      await page.waitForTimeout(850);
    } else {
      await page.waitForTimeout(400);
    }
  }

  const won = st?.state === "done" && st.stop >= st.stops;
  const ok = won && !errors.length;
  console.log(`${ok ? "✓" : "✗"} L${String(level).padStart(2)} ${(st?.name ?? "?").padEnd(18)} ` +
              `${st?.stop ?? "?"}/${st?.stops ?? "?"} stops  ♥${st?.hearts ?? "?"}  ${turns} turns` +
              (errors.length ? `  ERROR: ${errors[0]}` : won ? "" : "  NOT FINISHED"));
  if (!ok) fails.push(`L${level}`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails.length
  ? `\n${fails.length}/${LEVEL_COUNT} levels could not be won: ${fails.join(", ")}`
  : `\n${LEVEL_COUNT}/${LEVEL_COUNT} levels can be won.`);
process.exit(fails.length ? 1 : 0);
