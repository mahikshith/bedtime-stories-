/**
 * The hub's contract.
 *
 * The hub is the first thing loaded, on the slowest device in the house, and
 * its cost must not grow with every game added to it. It used to: opening the
 * menu statically imported every level table in the app, plus one whole game
 * implementation and everything it draws with.
 *
 * So these assert the architecture, not the pixels — that a menu loads no
 * games, that opening one path loads exactly that one game's content, and that
 * playing is still a single tap.
 */
import { chromium } from "playwright";
import { CHROMIUM } from "./browser.mjs";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd();
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".woff2":"font/woff2", ".svg":"image/svg+xml" };
const srv = http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split("?")[0]);
  const f=path.join(ROOT,u==="/"?"/index.html":u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
  r.writeHead(200,{"content-type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,r));
const port = srv.address().port;

const b = await chromium.launch({ executablePath: CHROMIUM });
const c = await b.newContext({ viewport:{ width:420, height:880 } });
const p = await c.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/favicon|CERT/.test(m.text())) errs.push(m.text()); });

let loaded = [];
p.on("response", (r) => {
  const u = new URL(r.url()).pathname;
  if (u.endsWith(".js") && u.includes("/games/")) loaded.push(u);
});

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
};

const seed = (extra = {}) => p.evaluate((extra) => localStorage.setItem("wordquest.save.v1",
  JSON.stringify({ band: "mid", bird: "chick", ...extra })), extra);

await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:"networkidle" });
const welcomeBottom = await p.locator(".choice:last-child").evaluate((n) => n.getBoundingClientRect().bottom);
check("all age choices fit the first 420×880 view", welcomeBottom <= 880,
  `last choice bottom ${Math.round(welcomeBottom)}px`);
await p.setViewportSize({ width:360, height:640 });
const compactBottom = await p.locator(".choice:last-child").evaluate((n) => n.getBoundingClientRect().bottom);
check("all age choices fit a compact 360×640 view", compactBottom <= 640,
  `last choice bottom ${Math.round(compactBottom)}px`);
await p.setViewportSize({ width:420, height:880 });
await seed();
loaded = [];
await p.reload({ waitUntil:"networkidle" });
await p.waitForTimeout(400);

// 1. a menu loads no games
check("the menu loads no game code",
  loaded.length === 0, loaded.length ? loaded.join(",") : "0 game modules");

// 2. the grid is a wall of pictures and nothing else — no progress trail
//    unfolding under a tile and pushing its neighbours apart
const cards = await p.$$eval(".tile", (n) => n.length);
const paths = await p.$$eval(".path", (n) => n.length);
const thumbs = await p.$$eval(".tile__art canvas", (n) => n.length);
check("the grid shows every game as a picture, with no trail attached",
  cards >= 9 && paths === 0 && thumbs === cards,
  `${cards} tiles, ${thumbs} thumbnails, ${paths} trails`);

// 3. tiles sit two to a row rather than one long column
const rows = await p.$$eval(".tile", (n) =>
  new Set(n.map((x) => Math.round(x.getBoundingClientRect().top))).size);
check("tiles are laid out two to a row", rows <= Math.ceil(cards / 2),
  `${cards} tiles in ${rows} rows`);

// 4. opening a game fetches exactly that game's content
loaded = [];
await p.click(".tile:first-of-type");
await p.waitForTimeout(700);
const nodes = await p.$$eval(".node", (n) => n.length);
const names = await p.$$eval(".node", (n) => n.map((x) => x.title));
check("opening a game loads one game's content",
  loaded.length === 1 && nodes > 1,
  `${loaded.length} module(s) → ${nodes} levels`);

// 4. the names are the real ones, not placeholders invented by the menu
check("the path shows the real level names",
  names.length > 0 && names.every((t) => t.includes(" — ")) &&
  !names.some((t) => /^Board \d/.test(t)),
  names[0] ?? "none");
const collapsed = await p.locator(".path").evaluate((n) => n.hidden);
await p.click(".path-toggle");
const expanded = await p.locator(".path").evaluate((n) => !n.hidden);
check("the level map starts quiet and opens on request", collapsed && expanded);

// 5. the game's screen replaces the grid rather than growing inside it
const gridGone = await p.$$eval(".games-grid", (n) => n.length);
const hasPlay = await p.$$eval(".btn--play", (n) => n.length);
check("a game's screen takes over from the grid",
  gridGone === 0 && hasPlay === 1, `${gridGone} grids, ${hasPlay} play buttons`);

// 6. the device back button returns to the grid
await p.goBack();
await p.waitForTimeout(500);
const backToGrid = await p.$$eval(".games-grid", (n) => n.length);
check("the back button returns to the games", backToGrid === 1);

// 7. which game was open survives coming back from playing it
await p.click(".tile:first-of-type");
await p.waitForTimeout(600);
await p.reload({ waitUntil:"networkidle" });
await p.waitForTimeout(600);
const stillOpen = await p.$$eval(".btn--play", (n) => n.length);
check("the open game is remembered across a reload", stillOpen === 1);

// 8. from there, playing is a single press
await p.click(".btn--play");
await p.waitForTimeout(900);
check("the play button goes straight into the game",
  /\/src\/games\/.+\.html/.test(p.url()), p.url().split("/").pop());

if (errs.length) check("no console errors", false, errs.slice(0, 2).join(" | "));
else check("no console errors", true);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} hub checks pass.`);
await b.close(); srv.close();
process.exit(failed ? 1 : 0);
