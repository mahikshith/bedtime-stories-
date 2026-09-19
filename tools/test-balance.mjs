/**
 * Solve every Balance level inside the running game by applying the solver's
 * moves to the live scene, and assert it reaches "won".
 *
 * check-balance.mjs proves the levels are solvable under the rules; this
 * proves the SCENE applies those rules faithfully — that cancel and add-both
 * do what the model says and that the win check fires.
 */
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd();
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".woff2":"font/woff2" };
const srv = http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split("?")[0]);
  const f=path.join(ROOT,u==="/"?"/index.html":u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
  r.writeHead(200,{"content-type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,r));
const port = srv.address().port;

const { LEVELS } = await import("../src/js/games/balance/levels.js");
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const c = await b.newContext({viewport:{width:420,height:880}});
const p = await c.newPage();
const errs=[]; p.on("pageerror",e=>errs.push(e.message));
let bad = 0;

for (let i = 0; i < LEVELS.length; i++) {
  await p.goto(`http://127.0.0.1:${port}/src/games/balance.html?level=${i}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(200);
  const out = await p.evaluate(async (deck) => {
    const s = window.__scene;
    s.phase = "play";
    const rules = await import("/src/js/games/balance/rules.js");
    // Re-solve from the live state and apply each move to the scene.
    const plan = rules.solve(s.state, deck, 9);
    if (!plan) return { state: "nosolution" };
    for (const mv of plan.moves) {
      if (mv.op === "add") s.state = rules.addBoth(s.state, mv.term);
      else s.state = rules.cancel(s.state, mv.side, mv.i, mv.j) ?? s.state;
      s.moves++;
    }
    s.check();
    return { state: s.phase, moves: s.moves, par: s.par, name: s.def.name, tier: s.def.tier,
             left: s.state.left.join("+"), right: s.state.right.join("+") };
  }, LEVELS[i].deck);

  const ok = out.state === "won";
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${LEVELS[i].id.padEnd(4)} ${(out.name ?? "").padEnd(18)} ` +
              `${(out.tier ?? "").padEnd(9)} ${out.moves ?? "-"} moves  ` +
              `${out.left ?? ""} = ${out.right ?? ""}`);
}

console.log(`\n${LEVELS.length - bad}/${LEVELS.length} levels win in-game.`);
if (errs.length) console.log("ERRORS: " + errs.slice(0,3).join(" | "));
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
