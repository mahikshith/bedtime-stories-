/**
 * Load every page, drive a little input, and report any console or page
 * errors. Catches the class of bug a screenshot hides: a scene that throws on
 * frame 200, a missing export, a stale property name after a refactor.
 */
import { chromium } from "playwright";
import { CHROMIUM } from "./browser.mjs";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";

const ROOT = process.cwd();
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
            ".woff2":"font/woff2", ".png":"image/png", ".json":"application/json" };
const srv = http.createServer((q,r)=>{
  const u=decodeURIComponent(q.url.split("?")[0]);
  const f=path.join(ROOT,u==="/"?"/index.html":u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("nf");}
  r.writeHead(200,{"content-type":T[path.extname(f)]||"application/octet-stream"});
  fs.createReadStream(f).pipe(r);
});
await new Promise(r=>srv.listen(0,r));
const port = srv.address().port;

const PAGES = [
  { name: "hub",         url: "/index.html", setup: async (p) => {
      await p.evaluate(() => localStorage.clear());
      await p.reload({ waitUntil: "networkidle" });
      await p.click(".choice-grid .choice:nth-child(2)");
    } },
  { name: "say-jump L1", url: "/src/games/say-jump.html?level=0" },
  { name: "say-jump L6", url: "/src/games/say-jump.html?level=5" },
  { name: "say-jump L12",url: "/src/games/say-jump.html?level=11" },
  { name: "tilt-maze L1",url: "/src/games/tilt-maze.html?level=0" },
  { name: "tilt-maze L6",url: "/src/games/tilt-maze.html?level=5" },
  { name: "word-mob L1", url: "/src/games/word-mob.html?level=0" },
  { name: "word-mob L5", url: "/src/games/word-mob.html?level=4" },
  { name: "echo-pop",    url: "/src/games/echo-pop.html" },
  { name: "tangram T1",  url: "/src/games/tangram.html?level=0" },
  { name: "tangram T2",  url: "/src/games/tangram.html?level=5" },
  { name: "tangram T3",  url: "/src/games/tangram.html?level=9" },
  { name: "slide L1",    url: "/src/games/slide.html?level=0" },
  { name: "slide L6",    url: "/src/games/slide.html?level=5" },
  { name: "shapes L1",   url: "/src/games/shapes.html?level=0" },
  { name: "shapes L6",   url: "/src/games/shapes.html?level=5" },
  { name: "robot L1",    url: "/src/games/robot.html?level=0" },
  { name: "robot L7",    url: "/src/games/robot.html?level=6" },
  { name: "robot L10",   url: "/src/games/robot.html?level=9" },
  { name: "balance L1",  url: "/src/games/balance.html?level=0" },
  { name: "balance L7",  url: "/src/games/balance.html?level=6" },
  { name: "balance L11", url: "/src/games/balance.html?level=10" },
  // Tinker Town has no levels, so each room is loaded by travelling to it.
  { name: "town kitchen", url: "/src/games/town.html" },
  { name: "town garden",  url: "/src/games/town.html",
    setup: async (p) => { await p.evaluate(() => window.__scene.travel("garden")); } },
  { name: "town bath",    url: "/src/games/town.html",
    setup: async (p) => { await p.evaluate(() => window.__scene.travel("bath")); } },
  { name: "town music",   url: "/src/games/town.html",
    setup: async (p) => { await p.evaluate(() => window.__scene.travel("music")); } },
  { name: "result",      url: "/src/result.html?game=say-jump&level=0&stars=2&words=4&asked=5" },
];

const browser = await chromium.launch({ executablePath: CHROMIUM });
let failed = 0;

for (const page of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("throw: " + e.message));
  p.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // The sandbox proxy blocks nothing we ship; ignore transport noise only.
    if (/ERR_CERT_AUTHORITY_INVALID|favicon/.test(t)) return;
    errs.push("console: " + t);
  });

  await p.goto(`http://127.0.0.1:${port}${page.url}`, { waitUntil: "networkidle" });
  if (page.setup) await page.setup(p);
  await p.waitForTimeout(700);
  // poke it: start, then some drags, so update/draw run in a live state
  await p.mouse.click(210, 460);
  await p.waitForTimeout(500);
  await p.mouse.move(140, 600); await p.mouse.down();
  await p.mouse.move(280, 620, { steps: 6 });
  await p.waitForTimeout(600);
  await p.mouse.up();
  await p.waitForTimeout(1500);

  const status = errs.length ? "✗" : "✓";
  if (errs.length) failed++;
  console.log(`${status} ${page.name.padEnd(14)} ${errs.length ? errs.slice(0,3).join(" | ") : "clean"}`);
  await ctx.close();
}

console.log(`\n${PAGES.length - failed}/${PAGES.length} pages clean.`);
await browser.close();
srv.close();
process.exit(failed ? 1 : 0);
