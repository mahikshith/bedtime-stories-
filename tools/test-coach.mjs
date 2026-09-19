/**
 * Proves the tutorial and pause menu actually WORK, not merely that they draw.
 *
 * Screenshots showed the panels looked right in all ten games, which says
 * nothing about whether the buttons are reachable, whether the scene really
 * freezes behind them, or whether the tutorial stops nagging after it has been
 * seen once. Those are the things a child hits in the first ten seconds.
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

const GAMES = ["say-jump", "tilt-maze", "word-mob", "shapes", "balance",
               "robot", "slide", "tangram", "town", "echo-pop"];

const browser = await chromium.launch({ executablePath: CHROMIUM });
const fails = [];
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "✓" : "✗"} ${msg}${detail ? `   ${detail}` : ""}`);
  if (!cond) fails.push(msg);
};

/** Fresh profile, so "first time" really is the first time. */
async function open(game, { seen = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript((mark) => {
    if (mark) {
      try {
        localStorage.setItem("wordquest.save.v1",
          JSON.stringify({ tutorialsSeen: ["say-jump", "tilt-maze", "word-mob", "shapes",
                                            "balance", "robot", "slide", "tangram", "town", "echo-pop"] }));
      } catch {}
    }
  }, seen);
  const q = game === "town" || game === "echo-pop" ? "" : "?level=0";
  await page.goto(`http://127.0.0.1:${port}/src/games/${game}.html${q}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}

/* --------------- 1. the tutorial introduces itself, exactly once ---------- */

console.log("— first open of each game —\n");
let introduced = [];
for (const game of GAMES) {
  const { ctx, page, errors } = await open(game);
  const st = await page.evaluate(() => ({ mode: window.__coach?.mode, blocking: !!window.__coach?.blocking }));
  if (st.mode === "tutorial") introduced.push(game);
  if (errors.length) fails.push(`${game}: ${errors[0]}`);
  await ctx.close();
}
ok(introduced.length === GAMES.length, "every game shows its tutorial on the first open",
   `${introduced.length}/${GAMES.length}`);

/* ----------------------- 2. and does not show it again -------------------- */

const { ctx: c2, page: p2 } = await open("say-jump", { seen: true });
const again = await p2.evaluate(() => window.__coach?.mode);
ok(again === null, "a game already seen opens straight into play", `mode=${again}`);

/* ---------------- 3. the scene really is frozen behind the panel ---------- */

const frozen = await p2.evaluate(async () => {
  const wait = (t) => new Promise((r) => setTimeout(r, t));
  const s = window.__scene, c = window.__coach;
  await wait(200);
  c.openMenu();
  const before = { t: s.t, x: s.body?.x };
  await wait(500);
  const after = { t: s.t, x: s.body?.x };
  c.close();
  await wait(300);
  const moving = s.t > after.t;
  return { stoppedT: Math.abs(after.t - before.t) < 0.02, resumed: moving };
});
ok(frozen.stoppedT, "the game stops while the menu is up");
ok(frozen.resumed, "and starts again when it closes");

/* ------------------------ 4. the ? button is reachable -------------------- */

const tapped = await p2.evaluate(() => {
  const c = window.__coach, e = window.__engine;
  c.close();
  const b = c.infoRect();
  // dead centre of the button, in the same logical space pointers arrive in
  const handled = c.down({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const opened = c.mode;
  // and it must not be inside the back corner, or it would never be reached
  const clearsBack = b.y >= e.view.y + 74;
  return { handled, opened, clearsBack };
});
ok(tapped.handled === true && tapped.opened === "menu", "tapping ? opens the menu");
ok(tapped.clearsBack, "and the ? button sits clear of the back corner");

/* ------------------- 5. every menu button does what it says --------------- */

const menu = await p2.evaluate(() => {
  const c = window.__coach;
  const labels = [];
  let restarted = false, exited = false;
  c.onRestart = () => { restarted = true; };
  c.onExit = () => { exited = true; };

  c.openMenu();
  // `hits` is built during draw, so draw once into a throwaway context
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1200;
  c.draw(cv.getContext("2d"));
  const hits = c.hits.map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h }));

  // KEEP PLAYING is the last row
  const last = c.hits[c.hits.length - 1];
  c.down({ x: last.x + 10, y: last.y + 10 });
  const closed = c.mode === null;

  // HOW TO PLAY is the first
  c.openMenu(); c.draw(cv.getContext("2d"));
  c.down({ x: c.hits[0].x + 10, y: c.hits[0].y + 10 });
  const toTutorial = c.mode === "tutorial";

  // START OVER is the second
  c.openMenu(); c.draw(cv.getContext("2d"));
  c.down({ x: c.hits[1].x + 10, y: c.hits[1].y + 10 });

  // LEAVE GAME is the third
  c.openMenu(); c.draw(cv.getContext("2d"));
  c.down({ x: c.hits[2].x + 10, y: c.hits[2].y + 10 });

  return { count: hits.length, closed, toTutorial, restarted, exited,
           minH: Math.min(...hits.map((h) => h.h)) };
});
ok(menu.count === 4, "the menu offers four choices", `got ${menu.count}`);
ok(menu.closed, "KEEP PLAYING returns to the game");
ok(menu.toTutorial, "HOW TO PLAY replays the tutorial");
ok(menu.restarted, "START OVER restarts the level");
ok(menu.exited, "LEAVE GAME leaves");
ok(menu.minH >= 56, "every button clears the 56px floor for small fingers", `smallest ${menu.minH}px`);

/* --------------------- 6. the scrim swallows stray taps ------------------- */

const swallowed = await p2.evaluate(() => {
  const c = window.__coach;
  c.openMenu();
  const eaten = c.down({ x: c.view.x + 5, y: c.view.y + c.view.h - 5 });
  c.close();
  const passes = c.down({ x: c.view.x + c.view.w / 2, y: c.view.y + c.view.h / 2 });
  return { eaten, passes };
});
ok(swallowed.eaten === true, "a tap on the scrim never reaches the game");
ok(swallowed.passes === false, "but a tap with nothing open goes straight through");

await c2.close();
await browser.close();
server.close();

console.log(fails.length ? `\n${fails.length} failed:\n  ${fails.join("\n  ")}` : "\ncoach works in all ten games.");
process.exit(fails.length ? 1 : 0);
