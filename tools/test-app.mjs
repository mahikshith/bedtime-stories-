/**
 * Verify the thing that actually ships.
 *
 * Every other tool drives the source tree. This one serves `www/` — the
 * output of `npm run build`, which is what goes into the store bundle and onto
 * the web — and checks the properties that only exist once it is assembled:
 *
 *   - the app runs with no network at all, which for this app is not a
 *     degraded mode but the normal one: on a plane, in a car, on a tablet
 *     that has never had a SIM
 *   - parked work is genuinely absent, not merely unlinked
 *   - the manifest and every icon it promises are really there, because a
 *     missing icon is a store rejection rather than a bug report
 *
 *   node tools/test-app.mjs     (run `npm run build` first, or use test:app)
 */
import { chromium } from "playwright";
import { CHROMIUM, dismissCoach } from "./browser.mjs";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";

const ROOT = path.join(process.cwd(), "www");
if (!fs.existsSync(ROOT)) {
  console.error("www/ is missing — run `npm run build` first."); process.exit(1);
}
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".woff2":"font/woff2",
            ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json" };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  const f = path.join(ROOT, u === "/" ? "/index.html" : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    r.writeHead(404); return r.end("not found");
  }
  r.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(r);
});
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
};

/* ---------------------------------------------------- static assertions */

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
const missingIcons = manifest.icons
  .map((i) => i.src.replace(/^\//, ""))
  .filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
check("every icon the manifest promises exists",
  missingIcons.length === 0, missingIcons.join(", ") || `${manifest.icons.length} icons`);
check("the manifest is installable",
  manifest.name && manifest.start_url && manifest.display === "standalone" &&
  manifest.icons.some((i) => i.purpose === "maskable"),
  `${manifest.name}, ${manifest.display}, maskable present`);

check("parked work is absent from the build",
  !fs.existsSync(path.join(ROOT, "src/games/bloop.html")) &&
  !fs.existsSync(path.join(ROOT, "src/js/games/bloop")),
  "no bloop.html, no bloop/");

/* ----------------------------------------------------- runtime assertions */

const b = await chromium.launch({ executablePath: CHROMIUM });
const c = await b.newContext({ viewport: { width: 420, height: 880 } });
const p = await c.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errs.push(m.text()); });
p.on("response", (r) => {
  if (r.request().resourceType() === "script" &&
      r.headers()["content-type"]?.includes("text/html")) {
    errs.push(`module served as HTML: ${r.url()}`);
  }
});

await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
await dismissCoach(p);
await p.evaluate(() => localStorage.setItem("wordquest.save.v1",
  JSON.stringify({ band: "mid", bird: "chick" })));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(600);

const tiles = await p.$$eval(".tile", (n) => n.length);
check("the built app boots and shows its games", tiles >= 9, `${tiles} tiles`);

const sw = await p.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(reg && (reg.active || reg.installing || reg.waiting));
});
check("the offline shell registers", sw);

// Give the worker a moment to finish precaching before pulling the plug.
await p.evaluate(() => navigator.serviceWorker.ready);
await p.waitForTimeout(900);

/* ------------------------------------------------------------- offline */

await c.setOffline(true);
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(900);
const offlineTiles = await p.$$eval(".tile", (n) => n.length).catch(() => 0);
check("it still works with the network cut", offlineTiles >= 9, `${offlineTiles} tiles offline`);

// And a whole game, not just the menu — the hub being cached is not the same
// as a child being able to actually play on a plane.
await p.goto(`http://127.0.0.1:${port}/src/games/balance.html?level=0`,
  { waitUntil: "domcontentloaded" }).catch(() => {});
await p.waitForTimeout(900);
await dismissCoach(p);
const playable = await p.evaluate(() => Boolean(window.__scene && window.__engine)).catch(() => false);
check("a game is playable offline", playable);
await c.setOffline(false);

check("no console errors", errs.length === 0, errs.slice(0, 2).join(" | "));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} app checks pass.`);
await b.close(); srv.close();
process.exit(failed ? 1 : 0);
