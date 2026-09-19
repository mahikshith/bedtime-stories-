/**
 * Assert the page-level contract that every game shares.
 *
 * These are the things no game test covers, because they live in the wrapper
 * rather than the game: does the bird the child picked actually reach the
 * scene, does the back corner go home, are the handles the tools drive
 * present. Every one of them used to be ten copies of a line, and two had
 * quietly drifted — Say & Jump read `cast` while the hub has always sent
 * `bird`, so the flagship game ignored the chosen bird entirely.
 *
 * One boot means one test can cover all ten pages.
 */
import { chromium } from "playwright";
import { CHROMIUM, dismissCoach } from "./browser.mjs";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd();
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".woff2":"font/woff2", ".svg":"image/svg+xml" };
const srv = http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split("?")[0]);
  const f=path.join(ROOT,u==="/"?"/index.html":u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
  r.writeHead(200,{"content-type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,r));
const port = srv.address().port;

const GAMES = ["say-jump","tilt-maze","word-mob","echo-pop","shapes",
               "tangram","slide","robot","balance","town"];

const b = await chromium.launch({ executablePath: CHROMIUM });
let failed = 0;

for (const game of GAMES) {
  const c = await b.newContext({ viewport:{ width:420, height:880 } });
  const p = await c.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));

  // "berry" so a game that ignores the parameter and defaults to "chick"
  // fails loudly instead of looking right by accident.
  await p.goto(`http://127.0.0.1:${port}/src/games/${game}.html?bird=berry&band=mid&level=0`,
    { waitUntil:"networkidle" });
  await p.waitForTimeout(500);
  await dismissCoach(p);

  const seen = await p.evaluate(() => ({
    scene: !!window.__scene,
    engine: !!window.__engine,
    bird: window.__scene?.birdId ?? window.__scene?.bird ?? null,
    canvas: !!window.__engine?.canvas,
  }));

  // The back corner must leave the game, in every game, at the same size.
  await p.mouse.click(18, 18);
  await p.waitForTimeout(600);
  const wentHome = /\/index\.html$/.test(p.url()) || p.url().endsWith("/");

  const problems = [];
  if (!seen.scene || !seen.engine || !seen.canvas) problems.push("no __scene/__engine handle");
  if (seen.bird !== "berry") problems.push(`bird=${seen.bird} (expected berry)`);
  if (!wentHome) problems.push(`back corner went to ${p.url().split("/").pop()}`);
  if (errs.length) problems.push("error: " + errs[0]);

  if (problems.length) failed++;
  console.log(`${problems.length ? "✗" : "✓"} ${game.padEnd(10)} ${problems.join("; ") || "bird reaches scene, back corner works"}`);
  await c.close();
}

console.log(`\n${GAMES.length - failed}/${GAMES.length} pages wired correctly.`);
await b.close(); srv.close();
process.exit(failed ? 1 : 0);
