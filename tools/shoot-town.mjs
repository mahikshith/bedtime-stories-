/**
 * Capture every room in Tinker Town.
 *
 * The sandbox is four places a child moves between, so judging one room at a
 * time is exactly the mistake that let the kitchen ship without a stove drawn
 * on it. This walks the real travel handler and shoots each room, so the set
 * can be looked at together.
 *
 *   node tools/shoot-town.mjs <out-dir>
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
const out = process.argv[2] ?? "/tmp/town";
fs.mkdirSync(out, { recursive: true });

const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium",
  args:["--font-render-hinting=none"] });
const c = await b.newContext({ viewport:{width:420,height:880}, deviceScaleFactor:2 });
const p = await c.newPage();
const errs=[]; p.on("pageerror",e=>errs.push("PAGEERROR: "+e.message));
p.on("console", m => { if (m.type()==="error" && !/favicon|CERT/.test(m.text())) errs.push(m.text()); });

await p.goto(`http://127.0.0.1:${port}/src/games/town.html`, { waitUntil:"networkidle" });
await p.evaluate(() => localStorage.removeItem("wordquest.town.v1"));
await p.reload({ waitUntil:"networkidle" });
await p.waitForTimeout(500);

const list = await p.evaluate(async () => Object.keys((await import("/src/js/games/town/scenes.js")).SCENES));

for (const id of list) {
  await p.evaluate((id) => window.__scene.travel(id), id);
  await p.waitForTimeout(900);            // let the travel wipe finish
  await p.screenshot({ path: path.join(out, `${id}.png`) });
  console.log("wrote " + path.join(out, `${id}.png`));
}

// and one frame of the idle nudge, which only appears after a quiet spell
await p.evaluate(() => { window.__scene.travel("kitchen"); window.__scene.idle = 20; });
await p.waitForTimeout(1200);
await p.screenshot({ path: path.join(out, "idle-nudge.png") });
console.log("wrote " + path.join(out, "idle-nudge.png"));

if (errs.length) { console.log("CONSOLE ERRORS:"); errs.slice(0,12).forEach(e=>console.log("  "+e)); }
else console.log("no console errors");
await b.close(); srv.close();
