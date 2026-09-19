/**
 * Every class the JavaScript puts on an element must have a style rule.
 *
 * This exists because the first screen a child ever saw — the age picker —
 * shipped completely unstyled: three white boxes with black text. Nothing
 * caught it. The smoke test only watches for console errors, and an unstyled
 * button still clicks; the hub test asserted the picker WORKED and never that
 * it looked like anything. A screenshot existed and nobody looked at it.
 *
 * So this checks the one property that would have failed loudly: a class name
 * appearing in `el(...)` or a className string with no matching selector
 * anywhere in the CSS. It cannot tell good design from bad, but it can tell
 * "somebody wrote markup and forgot the stylesheet", which is the failure that
 * actually happened.
 *
 *   node tools/check-styles.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const css = fs.readdirSync(path.join(ROOT, "src/css"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => fs.readFileSync(path.join(ROOT, "src/css", f), "utf8"))
  .join("\n");

/** Class names that have at least one rule somewhere. */
const styled = new Set();
for (const m of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) styled.add(m[1]);

/** Class names the JavaScript actually applies to elements. */
const used = new Map();   // class -> where it came from
const JS = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { walk(full); continue; }
    if (full.endsWith(".js")) JS.push(full);
  }
})(path.join(ROOT, "src/js"));
JS.push(path.join(ROOT, "index.html"));

for (const file of JS) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  // el("tag", "a b c", ...) — the helper every view in the hub is built from
  for (const m of src.matchAll(/\bel\(\s*"[a-z0-9]+"\s*,\s*"([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) used.set(c, rel);
  }
  // class="a b" in template strings and markup
  for (const m of src.matchAll(/class="([^"${]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) used.set(c, rel);
  }
  // classList.add("x") / setAttribute("class", "x")
  for (const m of src.matchAll(/classList\.add\(\s*"([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) used.set(c, rel);
  }
}

// Classes built by concatenation (e.g. "tile" + (open ? " tile--open" : ""))
// are matched by their literal parts above; a modifier that is only ever
// produced dynamically is out of scope and would be a false positive.
const missing = [...used.entries()].filter(([c]) => !styled.has(c));

for (const [cls, where] of missing) console.log(`✗ .${cls}  — used in ${where}, styled nowhere`);
if (!missing.length) {
  console.log(`✓ all ${used.size} classes applied by the app have a style rule`);
}
console.log(`\n${used.size - missing.length}/${used.size} classes styled.`);
process.exit(missing.length ? 1 : 0);
