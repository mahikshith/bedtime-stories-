/**
 * Load each Robot Path level in a browser, fill the program strip with the
 * level's reference solution, press PLAY, and assert the scene reaches "won".
 *
 * check-robot.mjs already proves the solutions work against the simulator;
 * this proves the GAME wires the simulator up correctly — the trace, the
 * stepping, the win detection and the slot layout.
 */
import { chromium } from "playwright";
import { CHROMIUM } from "./browser.mjs";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd();
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".woff2":"font/woff2" };
const srv = http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split("?")[0]);
  const f=path.join(ROOT,u==="/"?"/index.html":u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
  r.writeHead(200,{"content-type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,r));
const port = srv.address().port;

const { LEVELS } = await import("../src/js/games/robot/levels.js");
const b = await chromium.launch({ executablePath: CHROMIUM });
const c = await b.newContext({viewport:{width:420,height:880}});
const p = await c.newPage();
const errs=[]; p.on("pageerror",e=>errs.push(e.message));
let bad = 0;

for (let i = 0; i < LEVELS.length; i++) {
  await p.goto(`http://127.0.0.1:${port}/src/games/robot.html?level=${i}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(250);
  const out = await p.evaluate((sol) => {
    const s = window.__scene;
    s.state = "edit";
    for (const [list, ops] of Object.entries(sol)) {
      ops.forEach((op, k) => { s.program[list][k] = op; });
    }
    s.play();
    // Run the trace to completion without waiting on the animation clock.
    let guard = 0;
    while (s.state === "run" && guard++ < 2000) s.stepProgram();
    return { state: s.state, lit: s.sim.lit.size, targets: s.level.targets.length, name: s.def.name };
  }, LEVELS[i].solution);

  const ok = out.state === "won";
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${LEVELS[i].id.padEnd(4)} ${out.name.padEnd(20)} ` +
              `${out.lit}/${out.targets} lamps  state=${out.state}`);
}

console.log(`\n${LEVELS.length - bad}/${LEVELS.length} levels win in-game.`);
if (errs.length) console.log("ERRORS: " + errs.slice(0,3).join(" | "));
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
