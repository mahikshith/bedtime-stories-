/**
 * Screenshot helper. Serves the repo statically and captures pages so the art
 * and layout can actually be looked at rather than assumed.
 *
 *   node tools/shoot.mjs <page-path> <out.png> [ms] [width] [height]
 */
import { chromium } from "playwright";
import { CHROMIUM } from "./browser.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
                ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
                ".woff2": "font/woff2" };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(ROOT, url === "/" ? "/index.html" : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("not found");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const [pagePath, out, ms = "900", w = "420", h = "860"] = process.argv.slice(2);

await new Promise((r) => server.listen(0, r));
const port = server.address().port;

// The image ships a Chromium build that may not match the npm package's
// pinned revision, so point at it explicitly rather than downloading one.
const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ["--autoplay-policy=no-user-gesture-required", "--font-render-hinting=none"],
});
const ctx = await browser.newContext({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: 2,
  permissions: [],
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: "networkidle" });
await page.waitForTimeout(+ms);
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });

if (errors.length) { console.log("CONSOLE ERRORS:"); errors.slice(0, 12).forEach((e) => console.log("  " + e)); }
else console.log("no console errors");
console.log("wrote " + out);

await browser.close();
server.close();
