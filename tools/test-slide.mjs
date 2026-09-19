/**
 * Drive the sliding puzzle through a known solution and confirm it wins.
 * Uses the scene's own move API rather than synthetic drags, so this tests
 * the rules and the win check rather than the gesture handling.
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
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const c = await b.newContext({viewport:{width:420,height:880}});
const p = await c.newPage();
const errs=[]; p.on("pageerror",e=>errs.push(e.message));

for (const level of [0, 1, 2]) {
  await p.goto(`http://127.0.0.1:${srv.address().port}/src/games/slide.html?level=${level}`,
    { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.mouse.click(210, 500);           // dismiss intro
  await p.waitForTimeout(200);

  // Breadth-first search in the page, then replay the solution.
  const result = await p.evaluate(() => {
    const s = window.__scene;
    const W = 4, H = 5, EXIT = { x: 1, y: 3 };
    const key = (bs) => bs.map(b => `${b.x},${b.y}`).join("|");
    const snap = () => s.blocks.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, kind: b.kind }));
    const canMove = (bs, i, dx, dy) => {
      const b = bs[i];
      const nx = b.x + dx, ny = b.y + dy;
      if (nx < 0 || ny < 0 || nx + b.w > W || ny + b.h > H) return false;
      for (let j = 0; j < bs.length; j++) {
        if (j === i) continue;
        const o = bs[j];
        if (nx < o.x + o.w && nx + b.w > o.x && ny < o.y + o.h && ny + b.h > o.y) return false;
      }
      return true;
    };
    const start = snap();
    const bigI = start.findIndex(b => b.kind === "big");
    const seen = new Set([key(start)]);
    const q = [{ bs: start, path: [] }];
    while (q.length) {
      const cur = q.shift();
      if (cur.bs[bigI].x === EXIT.x && cur.bs[bigI].y === EXIT.y) return { path: cur.path };
      if (cur.path.length > 40) continue;
      for (let i = 0; i < cur.bs.length; i++) {
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          if (!canMove(cur.bs, i, dx, dy)) continue;
          const nb = cur.bs.map(b => ({ ...b }));
          nb[i].x += dx; nb[i].y += dy;
          const k = key(nb);
          if (seen.has(k)) continue;
          seen.add(k);
          q.push({ bs: nb, path: [...cur.path, [i, dx, dy]] });
        }
      }
    }
    return { path: null };
  });

  if (!result.path) { console.log(`level ${level}: no solution found in page`); continue; }

  const outcome = await p.evaluate((path) => {
    const s = window.__scene;
    for (const [i, dx, dy] of path) s.doMove(s.blocks[i], dx, dy);
    return { state: s.state, moves: s.moves, par: s.def.par, name: s.def.name };
  }, result.path);

  const ok = outcome.state === "won";
  console.log(`${ok ? "✓" : "✗"} level ${level} ${outcome.name.padEnd(14)} ` +
              `solved in ${outcome.moves} (par ${outcome.par}) state=${outcome.state}`);
}

console.log(errs.length ? "ERRORS: " + errs.slice(0,3).join(" | ") : "no page errors");
await b.close(); srv.close();
