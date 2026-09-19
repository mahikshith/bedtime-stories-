/**
 * Exercise Tinker Town's real interactions in a browser.
 *
 * A sandbox has no win state to assert, so the things worth testing are the
 * promises it makes to a child: that a seed put in soil grows, that a pot on
 * the stove cooks, that something dropped in your pocket is still there in the
 * next room. Each of those is a discovery a child will make and then repeat —
 * if any of them silently fails, the game is broken in the way that matters.
 */
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd();
const T = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".woff2":"font/woff2", ".svg":"image/svg+xml" };
const srv = http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split("?")[0]);
  const f=path.join(ROOT,u==="/"?"/index.html":u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
  r.writeHead(200,{"content-type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
await new Promise(r=>srv.listen(0,r));
const port = srv.address().port;

const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const c = await b.newContext({ viewport:{width:420,height:880} });
const p = await c.newPage();
const errs=[]; p.on("pageerror",e=>errs.push(e.message));
p.on("console", m => { if (m.type()==="error" && !/favicon|CERT/.test(m.text())) errs.push(m.text()); });

await p.goto(`http://127.0.0.1:${port}/src/games/town.html`, { waitUntil:"networkidle" });
// start from a clean world every run
await p.evaluate(() => localStorage.removeItem("wordquest.town.v1"));
await p.reload({ waitUntil:"networkidle" });
await p.waitForTimeout(400);

/** Drag the first thing of `kind` onto a screen point, using the real handlers. */
const dragThingTo = (kind, toX, toY) => p.evaluate(({ kind, toX, toY }) => {
  const s = window.__scene;
  const t = s.here.find(o => o.thing === kind);
  if (!t) return { ok:false, why:`no ${kind} in ${s.sceneId}` };
  const from = s.pos(t);
  s.down({ x: from.x, y: from.y - s.thingSize * 0.2 });
  if (!s.drag) return { ok:false, why:`could not pick up ${kind}` };
  // Pressing grabs whatever is on TOP at that point, which may not be the
  // thing we asked for if something is sitting over it. Saying so is the
  // difference between a failing test and a meaningless passing one.
  if (s.drag.thing.thing !== kind) {
    const got = s.drag.thing.thing;
    s.drag = null;
    return { ok:false, why:`grabbed ${got} instead of ${kind}` };
  }
  s.move({ x: toX, y: toY });
  s.up({ x: toX, y: toY });
  return { ok:true };
}, { kind, toX, toY });

/** Screen centre of a named fixture in the current room. */
const fixturePoint = (id) => p.evaluate((id) => {
  const s = window.__scene;
  const f = s.scene.fixtures.find(f => f.id === id);
  if (!f) return null;
  return { x: s.room.x + f.x * s.room.w, y: s.room.y + f.y * s.room.h };
}, id);


/** Drop a thing into the pocket, the way a child does: drag it down to the bar. */
const pocketThing = (kind) => p.evaluate((kind) => {
  const s = window.__scene;
  const t = s.here.find(o => o.thing === kind);
  if (!t) return false;
  const from = s.pos(t);
  s.down({ x: from.x, y: from.y - s.thingSize * 0.2 });
  s.move({ x: from.x, y: s.bar.y + 60 });
  s.up({ x: from.x, y: s.bar.y + 60 });
  return s.pocket.some(o => o.thing === kind);
}, kind);

/** Pull a pocketed thing back out onto a point in the current room. */
const unpocketTo = (kind, toX, toY) => p.evaluate(({ kind, toX, toY }) => {
  const s = window.__scene;
  const i = s.pocket.findIndex(o => o.thing === kind);
  if (i < 0) return false;
  const slot = s.pocketRects[i];
  s.down({ x: slot.x + slot.w / 2, y: slot.y + slot.h / 2 });
  s.move({ x: toX, y: toY });
  s.up({ x: toX, y: toY });
  return true;
}, { kind, toX, toY });

/**
 * Screen point of a loose thing of `kind` in this room, optionally the one
 * carrying a given state flag — there can be several of the same thing, and
 * "the mushroom" is not specific enough once the soil has made a second one.
 */
const thingPoint = (kind, flag = null) => p.evaluate(({ kind, flag }) => {
  const s = window.__scene;
  const t = s.here.find(o => o.thing === kind && (!flag || o.state?.[flag]));
  return t ? s.pos(t) : null;
}, { kind, flag });

const peek = () => p.evaluate(() => {
  const s = window.__scene;
  return {
    scene: s.sceneId,
    here: s.here.map(t => {
      const f = ["hot","planted","full","toasted","sunk","floating","wet"]
        .filter(k => t.state?.[k]).join("+");
      return t.thing + (f ? ":" + f : "");
    }),
    pocket: s.pocket.map(t => t.thing),
    fixtures: { ...s.fixtureActive },
    said: s.say.text,
  };
});

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
};

// 1. pot onto stove -> it cooks
let f = await fixturePoint("stove");
await dragThingTo("pot", f.x, f.y);
let st = await peek();
check("pot on stove starts cooking",
  st.fixtures.stove === true && st.here.some(h => h.startsWith("pot:hot")), st.said);

// 2. food into the pot -> soup
await dragThingTo("apple", f.x, f.y - 10);
st = await peek();
check("food into the pot makes soup",
  !st.here.some(h => h.startsWith("apple")), st.said);

// 3. carry something between rooms via the pocket
await p.evaluate(() => {
  const s = window.__scene;
  const t = s.here.find(o => o.thing === "egg");
  const from = s.pos(t);
  s.down({ x: from.x, y: from.y - s.thingSize * 0.2 });
  s.move({ x: from.x, y: s.bar.y + 60 });
  s.up({ x: from.x, y: s.bar.y + 60 });
});
st = await peek();
const pocketed = st.pocket.includes("egg");
await p.evaluate(() => window.__scene.travel("garden"));
await p.waitForTimeout(150);
await p.evaluate(() => {
  const s = window.__scene;
  const slot = s.pocketRects[0];
  s.down({ x: slot.x + slot.w / 2, y: slot.y + slot.h / 2 });
  s.up({ x: s.room.x + s.room.w * 0.5, y: s.room.y + s.room.h * 0.5 });
});
st = await peek();
check("an item carried in the pocket arrives in the next room",
  pocketed && st.scene === "garden" && st.here.some(h => h.startsWith("egg")),
  `pocket=${pocketed} here=${st.here.join(",")}`);

// 4. seed into soil -> sprout
f = await fixturePoint("soil");
await dragThingTo("seed", f.x, f.y);
st = await peek();
check("a seed in the soil becomes a sprout",
  st.here.some(h => h.startsWith("sprout")), st.said);

// 5. watering can onto the sprout -> flower
const sproutPoint = await p.evaluate(() => {
  const s = window.__scene;
  const t = s.here.find(o => o.thing === "sprout");
  return t ? s.pos(t) : null;
});
if (sproutPoint) await dragThingTo("can", sproutPoint.x, sproutPoint.y - 20);
st = await peek();
check("watering a sprout grows a flower",
  st.here.some(h => h.startsWith("flower")), st.said);

// 6. soap into the bath -> bubbles
await p.evaluate(() => window.__scene.travel("bath"));
await p.waitForTimeout(150);
f = await fixturePoint("tub");
await dragThingTo("soap", f.x, f.y);
st = await peek();
check("soap in the bath makes bubbles", st.fixtures.tub === true, st.said);

// 7. a stone carried from the garden sinks — floating and sinking are the
//    only physics in this world, and they are worth proving.
await p.evaluate(() => window.__scene.travel("garden"));
await p.waitForTimeout(150);
const gotStone = await pocketThing("stone");
await p.evaluate(() => window.__scene.travel("bath"));
await p.waitForTimeout(150);
f = await fixturePoint("tub");
await unpocketTo("stone", f.x, f.y);
st = await peek();
check("a stone carried to the bath sinks",
  gotStone && st.here.some(h => h.startsWith("stone:") && h.includes("sunk")), st.said);

// 8. the duck already in the tub floats rather than blocking it
await dragThingTo("duck", f.x, f.y);
st = await peek();
check("the duck floats in the tub",
  st.here.some(h => h.startsWith("duck:") && h.includes("floating")), st.said);

// 9. the three-step chain: fill a cup, pour it into the pot, boil it.
//    This is the deepest thing in the game and it spans two rooms.
await p.evaluate(() => window.__scene.travel("kitchen"));
await p.waitForTimeout(150);
f = await fixturePoint("sink");
await dragThingTo("cup", f.x, f.y);
st = await peek();
const filled = st.here.some(h => h.startsWith("cup:") && h.includes("full"));
const potPt = await thingPoint("pot");
if (potPt) await dragThingTo("cup", potPt.x, potPt.y - 10);
st = await peek();
check("a cup filled at the sink pours into the pot",
  filled && st.here.some(h => h.startsWith("pot:") && h.includes("full")),
  `filled=${filled} said=${st.said}`);

// 10. bread on a clear part of the stove becomes toast. It has to be a clear
//     part: the pot is standing on the hob by now, and bread dropped into a
//     pot is soup, which is the right answer to a different question.
// Clear the hob first: the pot is standing on it by now, and bread dropped
// into a pot is soup — the right answer to a different question.
const potNow = await thingPoint("pot");
await dragThingTo("pot", potNow.x, potNow.y + 220);
f = await fixturePoint("stove");
const toasted = await dragThingTo("bread", f.x, f.y);
st = await peek();
check("bread on the stove becomes toast",
  st.here.some(h => h.startsWith("bread:") && h.includes("toasted")),
  toasted.ok ? st.said : toasted.why);

// 11. a mushroom put back in the soil makes another one
await p.evaluate(() => window.__scene.travel("garden"));
await p.waitForTimeout(150);
const before = (await peek()).here.filter(h => h.startsWith("mushroom")).length;
f = await fixturePoint("soil");
await dragThingTo("mushroom", f.x - 50, f.y);
st = await peek();
check("a mushroom in the soil makes more mushrooms",
  st.here.filter(h => h.startsWith("mushroom")).length > before,
  `${before} -> ${st.here.filter(h => h.startsWith("mushroom")).length}`);

// 12. a towel undoes water — the inverse a child looks for straight away.
//     Both halves are asserted: a test that only checks "nothing is wet" passes
//     just as happily when the watering can did nothing at all. The flower is
//     the subject because there is exactly one of it, and the soil has been
//     busy making duplicate mushrooms.
await p.evaluate(() => window.__scene.travel("bath"));
await p.waitForTimeout(150);
const gotTowel = await pocketThing("towel");
await p.evaluate(() => window.__scene.travel("garden"));
await p.waitForTimeout(150);
let target = await thingPoint("flower");
const watered = target ? await dragThingTo("can", target.x, target.y) : { ok: false, why: "no flower" };
const wetted = (await peek()).here.some(h => h.startsWith("flower:") && h.includes("wet"));
target = await thingPoint("flower", "wet");
if (target) await unpocketTo("towel", target.x, target.y);
st = await peek();
check("a towel dries something the can made wet",
  gotTowel && wetted && !st.here.some(h => h.includes("wet")),
  watered.ok ? `wetted=${wetted} wet left: ${st.here.filter(h => h.includes("wet")).join(",") || "none"}`
             : watered.why);

// 13. nothing is hidden under anything else.
//     By this point the rooms have been rummaged through for a dozen steps and
//     the soil has made spare mushrooms. To a three-year-old a covered toy has
//     not been covered — it has been eaten by the game — so "no two things on a
//     surface overlap" has to hold after real play, not just on a fresh world.
const overlaps = await p.evaluate(() => {
  const s = window.__scene;
  const bad = [];
  for (const room of ["kitchen", "garden", "bath", "music"]) {
    const row = s.things.filter(t => t.scene === room && !t.state?.floating);
    for (let i = 0; i < row.length; i++)
      for (let j = i + 1; j < row.length; j++) {
        const a = row[i], b = row[j];
        if (Math.abs(a.y - b.y) > 0.02) continue;
        if (Math.abs(a.x - b.x) < s.halfWidth(a) + s.halfWidth(b) - 0.002)
          bad.push(`${room}:${a.thing}/${b.thing}`);
      }
  }
  return bad;
});
check("nothing is left hidden underneath anything else",
  overlaps.length === 0, overlaps.join(",") || "no overlaps in any room");

// 14. the world survives a reload
await p.evaluate(() => window.__scene.persist());
await p.reload({ waitUntil:"networkidle" });
await p.waitForTimeout(350);
const after = await p.evaluate(() => {
  const s = window.__scene;
  return { tub: s.fixtureActive.tub === true,
           flower: s.things.some(t => t.thing === "flower") };
});
check("the world is still there after a reload",
  after.tub && after.flower, `tub=${after.tub} flower=${after.flower}`);

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} interactions work.`);
if (errs.length) console.log("ERRORS: " + errs.slice(0,4).join(" | "));
await b.close(); srv.close();
process.exit(failed ? 1 : 0);
