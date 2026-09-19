/**
 * What does a page actually cost to open?
 *
 * Counts the JavaScript modules a page pulls in and their total size. The hub
 * is the one that matters: it is the first thing loaded, on the slowest device
 * in the house, and its cost should not grow with every game added.
 *
 *   node tools/weigh.mjs [page-path ...]
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

const pages = process.argv.slice(2);
const list = pages.length ? pages : ["/index.html"];
const b = await chromium.launch({ executablePath: CHROMIUM });

for (const page of list) {
  const c = await b.newContext({ viewport:{ width:420, height:880 } });
  const p = await c.newPage();
  const js = new Map();
  p.on("response", async (res) => {
    const u = new URL(res.url()).pathname;
    if (!u.endsWith(".js")) return;
    try { js.set(u, (await res.body()).length); } catch {}
  });
  await p.goto(`http://127.0.0.1:${port}${page}`, { waitUntil:"networkidle" });
  if (page === "/index.html") {
    // The hub gates on an age band, so measuring it means choosing one first —
    // otherwise all you weigh is the welcome screen.
    await p.evaluate(() => localStorage.setItem("wordquest.save.v1",
      JSON.stringify({ band: "mid", bird: "chick", xp: 0, gems: 0, streak: 0,
                       wordsLearned: [], progress: {}, settings: {} })));
    js.clear();
    await p.reload({ waitUntil:"networkidle" });
  }
  await p.waitForTimeout(500);
  const height = await p.evaluate(() => document.body.scrollHeight);
  const nodes = await p.evaluate(() => document.querySelectorAll("*").length);
  const bytes = [...js.values()].reduce((a, n) => a + n, 0);
  console.log(`${page}`);
  console.log(`  ${js.size} JS modules, ${(bytes / 1024).toFixed(1)} KB`);
  console.log(`  page ${height}px tall, ${nodes} DOM nodes`);
  const games = [...js.keys()].filter((u) => u.includes("/games/"));
  if (games.length) console.log(`  game modules pulled in: ${games.length}`);
  await c.close();
}
await b.close(); srv.close();
