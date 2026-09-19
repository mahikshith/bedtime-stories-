/**
 * Drives a level end to end with synthetic input and reports what happened.
 *
 * The microphone is not available to a headless browser, so this exercises
 * the touch fallback — which is the same code path past `launch()`. It is
 * here to prove the loop actually advances: walk -> prompt -> charge -> jump
 * -> land -> next word, and that a level can be finished at all.
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

const level = process.argv[2] ?? "0";
const shotDir = process.argv[3] ?? "/tmp/pt";
const holdMs = +(process.argv[4] ?? 700);
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(`http://127.0.0.1:${port}/src/games/say-jump.html?level=${level}`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await dismissCoach(page);

/** Expose the live scene so the harness can read game state. */
const peek = () => page.evaluate(() => {
  const s = window.__scene;
  if (!s) return null;
  return {
    state: s.state, stop: s.stopIndex, stops: s.stops.length,
    x: Math.round(s.body.x), y: Math.round(s.body.y),
    hearts: s.hearts, stars: s.starsGot, words: `${s.wordsRight}/${s.wordsAsked}`,
    word: s.word?.word ?? null, need: s.needCharge?.toFixed(2) ?? null,
    onGround: s.body.onGround,
  };
});

// tap to start
await page.mouse.click(210, 500);
await page.waitForTimeout(500);

const log = [];
for (let i = 0; i < 26; i++) {
  const st = await peek();
  if (!st) { log.push("no scene exposed"); break; }
  log.push(`${String(i).padStart(2)} ${st.state.padEnd(7)} stop ${st.stop}/${st.stops} x=${String(st.x).padStart(4)} ♥${st.hearts} ★${st.stars} w=${st.words} ${st.word ?? ""} need=${st.need ?? ""}`);
  if (st.state === "done") break;

  if (st.state === "prompt") {
    // Hold long enough to charge past what this gap needs.
    const need = parseFloat(st.need ?? "0.5");
    const ms = Math.max(250, Math.round((need + 0.16) / 0.85 * 1000));
    await page.mouse.move(210, 600);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(900);
    if (i < 4) await page.screenshot({ path: path.join(shotDir, `jump-${i}.png`) });
  } else {
    await page.waitForTimeout(450);
  }
}

const final = await peek();
console.log(log.join("\n"));
console.log("\nFINAL:", JSON.stringify(final));
if (errors.length) { console.log("\nERRORS:"); errors.slice(0, 8).forEach((e) => console.log("  " + e)); }
else console.log("no page errors");

await browser.close();
server.close();
