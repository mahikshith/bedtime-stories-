/**
 * Plays every Tilt Maze board and checks it is still a game.
 *
 * The boards are generated now (tools/compose-mazes.py) and carry decoys,
 * hearts and a clock, so "does it look right" is not enough: a generated
 * board can be solvable on paper and miserable in the hand, and a penalty
 * system can quietly make a level unwinnable. This drives the real scene.
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

const browser = await chromium.launch({ executablePath: CHROMIUM });
const fails = [];
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "✓" : "✗"} ${msg}${detail ? `   ${detail}` : ""}`);
  if (!cond) fails.push(msg);
};

async function board(level) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/src/games/tilt-maze.html?level=${level}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await dismissCoach(page);

  const res = await page.evaluate(async () => {
    const wait = (t) => new Promise((r) => setTimeout(r, t));
    const s = window.__scene, v = window.__engine.view;
    s.state = "play"; s.stateT = 0;
    const tile = s.tile;

    // Teleport the ball along the intended route: this is a check that the
    // RULES work, not that a bot can steer. Steering is tested in test-tilt.
    const hop = async (c, r) => {
      s.ball.x = (c + 0.5) * tile; s.ball.y = (r + 0.5) * tile;
      s.ball.vx = s.ball.vy = 0;
      await wait(60);
    };

    // 1. walk the letters in order, and the exit
    for (const l of s.board.letters) await hop(l.c, l.r);
    const collected = s.nextLetter;
    await hop(s.board.exit.c, s.board.exit.r);
    const won = s.state === "won";

    // 2. a decoy costs a heart
    s.retry();
    await wait(60);
    const before = s.hearts;
    const d = s.board.decoys?.[0];
    if (d) await hop(d.c, d.r);
    const afterDecoy = s.hearts;

    // 3. and running out of hearts ends the run.
    //
    // Driven through `loseHeart` rather than by touching more decoys: the
    // first board only HAS two, which is deliberate for a first level, and a
    // test that needs three would be asserting a level-design choice instead
    // of the rule it is meant to cover.
    while (s.hearts > 0) s.loseHeart("test", 0, 0);
    await wait(60);
    const over = s.state === "over";

    // 4. which a tap recovers from, with the board put back
    s.stateT = 1; s.down();
    await wait(60);
    const recovered = s.state === "play" && s.hearts === 3 && s.nextLetter === 0 &&
                      (s.board.decoys ?? []).every((x) => !x.taken);

    return {
      cols: s.board.cols, rows: s.board.rows, tile,
      fillH: +(s.boardSize.h / v.h).toFixed(2),
      letters: s.board.letters.length, decoys: (s.board.decoys ?? []).length,
      collected, won, before, afterDecoy, over, recovered,
      limit: s.timeLimit,
    };
  });

  await ctx.close();
  return { ...res, errors };
}

for (let i = 0; i < 6; i++) {
  const b = await board(i);
  const good = b.won && b.collected === b.letters && b.afterDecoy === b.before - 1 &&
               b.over && b.recovered && b.fillH > 0.7 && !b.errors.length;
  console.log(`${good ? "✓" : "✗"} level ${i}  ${b.cols}x${b.rows} tile ${b.tile}  ` +
              `fills ${Math.round(b.fillH * 100)}% high  ${b.letters} letters  ` +
              `${b.decoys} decoys  ${b.limit}s` +
              (b.errors.length ? `  ERRORS: ${b.errors[0]}` : ""));
  if (!good) {
    fails.push(`level ${i}`);
    console.log(`    won=${b.won} collected=${b.collected}/${b.letters} ` +
                `hearts ${b.before}->${b.afterDecoy} over=${b.over} recovered=${b.recovered}`);
  }
}

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} board(s) failed.` : "\n6/6 boards play correctly.");
process.exit(fails.length ? 1 : 0);
