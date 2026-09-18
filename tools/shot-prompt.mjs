/** Capture the word-prompt and mid-charge UI, which a static screenshot misses. */
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd();
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".woff2":"font/woff2" };
const srv = http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split("?")[0]);
  const f=path.join(ROOT,u==="/"?"/index.html":u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
  r.writeHead(200,{"content-type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const out = process.argv[3] ?? "/tmp/prompt";
fs.mkdirSync(out,{recursive:true});
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const c = await b.newContext({viewport:{width:420,height:880},deviceScaleFactor:2});
const p = await c.newPage();
await p.goto(`http://127.0.0.1:${port}/src/games/say-jump.html?level=${process.argv[2]??0}`,{waitUntil:"networkidle"});
await p.waitForTimeout(500);
await p.mouse.click(210,500);
// walk until the first word prompt appears
for (let i=0;i<40;i++){
  const st = await p.evaluate(()=>window.__scene?.state);
  if (st === "prompt") break;
  await p.waitForTimeout(120);
}
await p.waitForTimeout(450);
await p.screenshot({path:path.join(out,"prompt.png")});
// now hold to charge and catch the arc preview mid-flight
await p.mouse.move(210,600); await p.mouse.down();
await p.waitForTimeout(520);
await p.screenshot({path:path.join(out,"charging.png")});
await p.mouse.up();
console.log("wrote", out);
await b.close(); srv.close();
