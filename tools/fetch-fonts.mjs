/**
 * Vendor the two display faces locally.
 *
 * Self-hosting rather than linking the CDN means the games load and look
 * right with no network at all — which matters for a children's app played
 * in cars, on planes and on school tablets behind a filter.
 *
 * Google serves both families as variable fonts, so every requested weight
 * resolves to the same file; we store it once and declare a weight range.
 * Both are SIL Open Font License 1.1 — see src/assets/fonts/OFL.txt.
 */
import fs from "node:fs/promises";
import path from "node:path";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const OUT = "src/assets/fonts";
const FAMILIES = [
  { css: "Nunito:wght@700;800;900", name: "Nunito", slug: "nunito" },
  { css: "Baloo+2:wght@700;800", name: "Baloo 2", slug: "baloo2" },
];

await fs.mkdir(OUT, { recursive: true });
let sheet = "/* Vendored by tools/fetch-fonts.mjs — SIL Open Font License 1.1.\n" +
            "   See fonts/OFL.txt. Latin subset only. */\n\n";

for (const fam of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${fam.css}&display=swap`;
  const css = await (await fetch(url, { headers: { "user-agent": UA } })).text();

  // Latin subset only — the other subsets are dead weight for this app.
  const blocks = css.split("/*").filter((b) => b.trim().startsWith("latin */"));
  const weights = [];
  let range = null;
  let saved = null;

  for (const b of blocks) {
    const weight = b.match(/font-weight:\s*(\d+)/)?.[1];
    const src = b.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!weight || !src) continue;
    weights.push(Number(weight));
    range ??= b.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (saved) continue;
    const file = `${fam.slug}.woff2`;
    const buf = Buffer.from(await (await fetch(src, { headers: { "user-agent": UA } })).arrayBuffer());
    await fs.writeFile(path.join(OUT, file), buf);
    saved = file;
    console.log(`${file}  ${(buf.length / 1024).toFixed(1)}kb`);
  }

  if (!saved) { console.warn(`no latin subset found for ${fam.name}`); continue; }
  const lo = Math.min(...weights), hi = Math.max(...weights);
  sheet += `@font-face {\n  font-family: '${fam.name}';\n  font-style: normal;\n` +
           `  font-weight: ${lo} ${hi};\n  font-display: swap;\n` +
           `  src: url('./fonts/${saved}') format('woff2');\n` +
           (range ? `  unicode-range: ${range};\n` : "") + "}\n\n";
}

await fs.writeFile("src/assets/fonts.css", sheet);
console.log("wrote src/assets/fonts.css");
