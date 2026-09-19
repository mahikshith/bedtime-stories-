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
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd();
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".woff2":"font/woff2", ".svg":"image/svg+xml" };
const srv = http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split("?")[0]);
  const f=path.join(ROOT,u==="/"?"/index.html":u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
  r.writeHead(200,{"content-type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,r));
const port = srv.address().port;

const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
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
await seed();
loaded = [];
await p.reload({ waitUntil:"networkidle" });
await p.waitForTimeout(400);

// 1. a menu loads no games
check("the menu loads no game code",
  loaded.length === 0, loaded.length ? loaded.join(",") : "0 game modules");

// 2. every game in the band gets a card, and none of them has a path open
const cards = await p.$$eval(".game-card", (n) => n.length);
const paths = await p.$$eval(".path", (n) => n.length);
check("every card is collapsed to start", cards >= 9 && paths === 0,
  `${cards} cards, ${paths} paths open`);

// 3. opening one path fetches exactly that game's content
loaded = [];
await p.click(".section:first-of-type .path-toggle");
await p.waitForTimeout(700);
const nodes = await p.$$eval(".node", (n) => n.length);
const names = await p.$$eval(".node", (n) => n.map((x) => x.title));
check("opening a path loads one game's content",
  loaded.length === 1 && nodes > 1,
  `${loaded.length} module(s) → ${nodes} levels`);

// 4. the names are the real ones, not placeholders invented by the menu
check("the path shows the real level names",
  names.length > 0 && names.every((t) => t.includes(" — ")) &&
  !names.some((t) => /^Board \d/.test(t)),
  names[0] ?? "none");

// 5. only one path is open at a time
await p.click(".section:nth-of-type(2) .path-toggle");
await p.waitForTimeout(700);
const openNow = await p.$$eval(".path", (n) => n.length);
check("only one path is open at a time", openNow === 1, `${openNow} open`);

// 6. which one is open survives coming back from a game
await p.reload({ waitUntil:"networkidle" });
await p.waitForTimeout(600);
const stillOpen = await p.$$eval(".path", (n) => n.length);
check("the open path is remembered across a reload", stillOpen === 1, `${stillOpen} open`);

// 7. playing is still one tap
await p.click(".game-card");
await p.waitForTimeout(900);
check("tapping a card goes straight into a game",
  /\/src\/games\/.+\.html/.test(p.url()), p.url().split("/").pop());

if (errs.length) check("no console errors", false, errs.slice(0, 2).join(" | "));
else check("no console errors", true);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} hub checks pass.`);
await b.close(); srv.close();
process.exit(failed ? 1 : 0);
