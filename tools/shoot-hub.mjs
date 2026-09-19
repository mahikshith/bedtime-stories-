/** Screenshot the hub after choosing an age band, which the welcome gates. */
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd();
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".woff2":"font/woff2" };
const srv = http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split("?")[0]);
  const f=path.join(ROOT,u==="/"?"/index.html":u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
  r.writeHead(200,{"content-type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const out = process.argv[2] ?? "/tmp/hub";
fs.mkdirSync(out,{recursive:true});
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const c = await b.newContext({viewport:{width:420,height:880},deviceScaleFactor:2});
const p = await c.newPage();
const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:"networkidle"});
await p.waitForTimeout(400);
await p.screenshot({path:path.join(out,"welcome.png")});
// pick the middle age band
await p.click(".choice-grid .choice:nth-child(2)");
await p.waitForTimeout(500);
await p.screenshot({path:path.join(out,"hub.png"), fullPage:true});
// and one game's own screen, which is the other half of the hub
await p.click(".tile:first-of-type");
await p.waitForTimeout(700);
await p.screenshot({path:path.join(out,"game-screen.png"), fullPage:true});
console.log(errs.length ? "ERRORS: "+errs.slice(0,4).join(" | ") : "no page errors");
await b.close(); srv.close();
