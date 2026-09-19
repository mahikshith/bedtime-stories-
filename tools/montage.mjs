/**
 * Stitch several screenshots into one contact sheet.
 *
 * Judging art one screenshot at a time is how a set of screens ends up
 * inconsistent. Seeing them together is the only way to catch a backdrop that
 * is louder than its neighbours or a game whose board has lost contrast.
 *
 *   node tools/montage.mjs <dir> <out.png> [name,name,...]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const out = process.argv[3] ?? path.join(dir, "sheet.png");
const names = (process.argv[4] ?? "").split(",").filter(Boolean);
const files = (names.length ? names.map((n) => `${n}.png`)
                            : fs.readdirSync(dir).filter((f) => f.endsWith(".png")))
  .filter((f) => fs.existsSync(path.join(dir, f)) && f !== path.basename(out));

const imgs = files.map((f) => ({
  label: path.basename(f, ".png"),
  b64: fs.readFileSync(path.join(dir, f)).toString("base64"),
}));

const cols = Math.min(3, imgs.length);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await b.newContext({ viewport: { width: 430 * cols, height: 900 } })).newPage();
await page.setContent(`<body style="margin:0;background:#101418;display:grid;
  grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px">
${imgs.map((i) => `<div style="position:relative">
  <img src="data:image/png;base64,${i.b64}" style="width:100%;display:block;border-radius:6px">
  <div style="position:absolute;top:5px;left:5px;background:rgba(0,0,0,.7);color:#fff;
       font:600 13px system-ui;padding:3px 9px;border-radius:5px">${i.label}</div>
</div>`).join("")}
</body>`);
await page.waitForTimeout(350);
await page.screenshot({ path: out, fullPage: true });
await b.close();
console.log(`wrote ${out} (${imgs.length} tiles)`);
