/**
 * Drive every game with a FINGER, not a mouse.
 *
 * WHY THIS EXISTS. Robot Path and Sliding Blocks shipped accepting only a
 * drag. Every tool in this directory passed. The reason is that they all
 * drive `page.mouse`, and a mouse is a machine: it lands on the exact pixel
 * it aimed at, travels zero distance between down and up, never has its
 * gesture stolen by the browser, and never lands twice at once. A child's
 * finger does all four. Both of those games branch on `moved < 20`, and the
 * whole difference between "works" and "no matter how many controls I
 * touched, nothing moved" lived inside that threshold.
 *
 * So this dispatches real touch input through the DevTools protocol, on an
 * Android device profile, and checks the five things a phone does that a
 * mouse does not:
 *
 *   JITTER   a tap that drifts six pixels between down and up
 *   DRAG     a real swipe, in steps, the way a finger actually moves
 *   CANCEL   `pointercancel` — the browser deciding mid-gesture that this was
 *            a scroll after all. A mouse NEVER produces this, and the engine
 *            routes it to `up`, so anything a game does on release it also
 *            does on a gesture the child never completed
 *   MULTI    two fingers down at once, which a small child does constantly
 *   MASH     forty taps in two seconds, because they will
 *
 * Plus the layout checks that only mean anything at a real device size.
 *
 * A game that has no crisp state to read is not given a fake assertion — it
 * gets the invariants and says so. Silence dressed up as a tick is how the
 * drag-only bug survived a green suite in the first place.
 */
import { chromium, devices } from "playwright";
import { CHROMIUM, dismissCoach } from "./browser.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".woff2": "font/woff2", ".png": "image/png", ".json": "application/json",
};
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, url === "/" ? "/index.html" : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("nf");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const only = process.argv[2];
const browser = await chromium.launch({ executablePath: CHROMIUM });
const fails = [];
const ok = (cond, msg, detail = "") => {
  console.log(`   ${cond ? "✓" : "✗"} ${msg}${detail ? `   ${detail}` : ""}`);
  if (!cond) fails.push(msg);
};

/* ------------------------------------------------------------ the finger */

/**
 * Touch gestures through CDP.
 *
 * Playwright's `page.touchscreen` only offers `tap`, which is not enough: the
 * interesting cases are the ones with a middle — a drift, a cancel, a second
 * finger. `Input.dispatchTouchEvent` is the same path a real touchscreen
 * takes into the renderer, so Chromium synthesises the pointer events from it
 * exactly as it would on the phone.
 */
function finger(cdp) {
  const send = (type, points) => {
    for (const p of points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        throw new Error(`touch at a non-finite point: ${JSON.stringify(p)}`);
      }
    }
    return cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), id: i })),
    });
  };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  return {
    /** A tap that drifts, because a finger on glass always does. */
    async tap(x, y, drift = 6) {
      await send("touchStart", [{ x, y }]);
      for (let i = 1; i <= 3; i++) {
        await pause(16);
        await send("touchMove", [{ x: x + (drift * i) / 3, y: y + (drift * i) / 4 }]);
      }
      await pause(40);
      await send("touchEnd", []);
      await pause(60);
    },
    /** A swipe, in steps. One jump from A to B is a teleport, not a drag. */
    async drag(x0, y0, x1, y1, steps = 12) {
      await send("touchStart", [{ x: x0, y: y0 }]);
      for (let i = 1; i <= steps; i++) {
        await pause(16);
        await send("touchMove", [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }]);
      }
      await pause(30);
      await send("touchEnd", []);
      await pause(60);
    },
    /**
     * A gesture the browser takes away mid-flight.
     *
     * `touchCancel` is what arrives when Chromium decides the gesture was
     * really the start of a scroll. A mouse cannot produce it, so no existing
     * tool has ever sent one.
     */
    async cancel(x0, y0, x1, y1) {
      await send("touchStart", [{ x: x0, y: y0 }]);
      for (let i = 1; i <= 4; i++) {
        await pause(16);
        await send("touchMove", [{ x: x0 + ((x1 - x0) * i) / 4, y: y0 + ((y1 - y0) * i) / 4 }]);
      }
      await send("touchCancel", []);
      await pause(80);
    },
    /** Two fingers at once. Small children do this constantly. */
    async two(a, b) {
      await send("touchStart", [a, b]);
      await pause(30);
      await send("touchMove", [{ x: a.x + 8, y: a.y + 6 }, { x: b.x - 8, y: b.y - 6 }]);
      await pause(30);
      await send("touchEnd", []);
      await pause(60);
    },
    /** Forty taps in two seconds, all over the play area. */
    async mash(box, n = 40) {
      for (let i = 0; i < n; i++) {
        const x = box.x + Math.random() * box.w;
        const y = box.y + Math.random() * box.h;
        await send("touchStart", [{ x, y }]);
        await pause(12);
        await send("touchEnd", []);
        await pause(18);
      }
      await pause(200);
    },
  };
}

/* ------------------------------------------------------------- the games */

/**
 * Each game declares where its primary control is (in DESIGN space, read off
 * the live scene) and one number that must change when it is touched.
 *
 * `probe` returns something JSON-comparable. `stuck` reports whether the
 * scene is still holding something the child let go of.
 */
const GAMES = [
  {
    name: "robot", url: "/src/games/robot.html?level=0",
    ready: (s) => { s.state = "edit"; },
    target: (s) => s.paletteRects?.[0] && { x: s.paletteRects[0].x + s.paletteRects[0].w / 2,
                                            y: s.paletteRects[0].y + s.paletteRects[0].h / 2 },
    probe: (s) => s.program.main.filter(Boolean).length,
    stuck: (s) => !!s.drag,
    what: "a tap on the palette adds a block",
  },
  {
    name: "slide", url: "/src/games/slide.html?level=0",
    ready: (s) => { s.state = "play"; },
    target: (s) => (s.blocks ?? []).flatMap((b) => {
      const cx = s.origin.x + (b.x + b.w / 2) * s.cell;
      const cy = s.origin.y + (b.y + b.h / 2) * s.cell;
      const ox = (b.w * s.cell) / 2 - s.cell * 0.25;
      const oy = (b.h * s.cell) / 2 - s.cell * 0.25;
      // A child taps the side of the block they want it to go to, which is
      // what the game now reads. Dead centre is the ambiguous case and is
      // deliberately not what a player does.
      return [{ x: cx + ox, y: cy }, { x: cx - ox, y: cy },
              { x: cx, y: cy + oy }, { x: cx, y: cy - oy }];
    }),
    probe: (s) => s.moves,
    stuck: (s) => !!s.drag,
    what: "a tap on some block slides it",
  },
  {
    name: "shapes", url: "/src/games/shapes.html?level=0",
    ready: (s) => { s.state = "play"; },
    target: (s) => s.tiles?.[0] && { x: s.tiles[0].sx, y: s.tiles[0].sy },
    drop: (s) => s.holes?.find((h) => !h.filled) && { x: s.holes.find((h) => !h.filled).x,
                                                      y: s.holes.find((h) => !h.filled).y },
    probe: (s) => s.tiles.map((t) => `${Math.round(t.sx)},${Math.round(t.sy)}`).join("|"),
    stuck: (s) => !!s.dragging,
    what: "a shape can be dragged",
  },
  {
    name: "tangram", url: "/src/games/tangram.html?level=0",
    ready: (s) => { s.state = "play"; },
    target: (s) => s.pieces?.[0] && { x: s.pieces[0].sx, y: s.pieces[0].sy },
    drop: (s) => s.pieces?.[0] && { x: s.pieces[0].sx, y: s.pieces[0].sy - 140 },
    probe: (s) => s.pieces.map((p) => `${Math.round(p.sx)},${Math.round(p.sy)},${p.rot}`).join("|"),
    stuck: (s) => !!s.dragging,
    what: "a piece can be dragged",
  },
  {
    name: "balance", url: "/src/games/balance.html?level=0",
    ready: (s) => { s.phase = "play"; },
    target: (s) => { const c = s.cards?.find((x) => x.side !== "deck" && !x.term.startsWith("-")
                                              && x.term !== "box");
                     return c && { x: c.x + c.s / 2, y: c.y + c.s / 2 }; },
    drop: (s) => { const src = s.cards?.find((x) => x.side !== "deck" && !x.term.startsWith("-")
                                              && x.term !== "box");
                   const c = src && s.cards.find((x) => x.side === src.side && x.term === `-${src.term}`);
                   return c && { x: c.x + c.s / 2, y: c.y + c.s / 2 }; },
    probe: (s) => `${s.moves}|${s.state?.left?.length ?? 0}|${s.state?.right?.length ?? 0}`,
    stuck: (s) => !!s.drag,
    what: "a card dropped on its shadow cancels it",
  },
  {
    name: "say-jump", url: "/src/games/say-jump.html?level=0",
    ready: (s) => { if (s.state === "intro") s.setState("walk"); },
    target: (s) => ({ x: s.engine.view.x + s.engine.view.w / 2,
                      y: s.engine.view.y + s.engine.view.h * 0.55 }),
    probe: (s) => `${s.state}|${s.stopIndex}`,
    stuck: (s) => !!s.holding,
    what: "tap-to-charge reaches the bird",
    soft: true,   // only charges while the game is at a word
  },
  {
    name: "word-mob", url: "/src/games/word-mob.html?level=0",
    ready: (s) => { if (s.state === "intro") { s.state = "run"; s.stateT = 0; } },
    target: (s) => ({ x: s.engine.view.x + s.engine.view.w / 2,
                      y: s.engine.view.y + s.engine.view.h * 0.7 }),
    probe: (s) => `${s.state}`,
    stuck: (s) => !!s.dragging,
    what: "the crowd can be steered",
    soft: true,
  },
  {
    name: "echo-pop", url: "/src/games/echo-pop.html",
    ready: (s) => { if (s.state === "intro") s.nextRound(); },
    target: (s) => { const b = s.bubbles?.find((x) => !x.popped); return b && { x: b.x, y: b.y }; },
    probe: (s) => `${s.state}|${s.tries}|${s.bubbles?.filter((b) => b.popped).length ?? 0}`,
    stuck: () => false,
    what: "a bubble can be tapped",
  },
  {
    name: "tilt-maze", url: "/src/games/tilt-maze.html?level=0",
    ready: () => {},
    probe: (s) => `${s.state ?? "?"}`,
    stuck: () => false,
    what: null,   // steered by tilt; touch has nothing to assert
  },
  {
    name: "town", url: "/src/games/town.html",
    ready: () => {},
    target: (s) => ({ x: s.engine.view.x + s.engine.view.w / 2,
                      y: s.engine.view.y + s.engine.view.h * 0.5 }),
    probe: (s) => `${s.things?.length ?? 0}`,
    stuck: (s) => !!s.drag,
    what: "the room responds to a tap",
    soft: true,
  },
];

/* ------------------------------------------------------------------- run */

const PIXEL = { ...devices["Pixel 7"], hasTouch: true, isMobile: true };

for (const g of GAMES) {
  if (only && g.name !== only) continue;
  console.log(`\n${g.name}`);

  const ctx = await browser.newContext({ ...PIXEL });
  // One game blowing up must not abort the other nine: a suite that stops at
  // the first failure tells you about one bug per run.
  try {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  const cdp = await ctx.newCDPSession(page);
  const f = finger(cdp);

  const prepare = async () => {
    await page.goto(`http://127.0.0.1:${port}${g.url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await dismissCoach(page);
    await page.waitForTimeout(300);
    // Design space -> CSS pixels, the inverse of `engine.toLocal`.
    await page.evaluate(() => {
      window.__toScreen = (p) => {
        const e = window.__engine;
        const r = e.canvas.getBoundingClientRect();
        return { x: (p.x - e.view.x) * e.scale + r.left, y: (p.y - e.view.y) * e.scale + r.top };
      };
    });
    await page.evaluate((src) => {
      // eslint-disable-next-line no-new-func
      new Function("s", `(${src})(s)`)(window.__scene);
    }, g.ready.toString());
    await page.waitForTimeout(250);
  };
  await prepare();

  /**
   * Read something off the live scene, in screen coordinates where it is a
   * point.
   *
   * Returns the sentinel `GONE` when the page has navigated. Winning a level
   * or losing the last heart sends the child to the result page, and a mash of
   * forty taps can genuinely do either — that is the game working, not the
   * harness crashing, and it has to be reported as such rather than as
   * `Cannot read properties of undefined`.
   */
  const GONE = Symbol.for("scene-gone");
  const read = async (fn, arg) => {
    const v = await page.evaluate(
      ([src, a]) => {
        if (!window.__scene || !window.__engine) return { __gone: true };
        // eslint-disable-next-line no-new-func
        const r = new Function("s", "a", `return (${src})(s, a)`)(window.__scene, a);
        const pt = (o) => (o && typeof o === "object" && "x" in o ? window.__toScreen(o) : o);
        // A LIST of candidate points has to be converted too. Missing this
        // sent every tap to a raw design coordinate read as a CSS pixel, and
        // the suite reported a working control as dead.
        if (Array.isArray(r)) return { v: r.map(pt) };
        return r && typeof r === "object" && "x" in r ? window.__toScreen(r) : { v: r };
      },
      [fn.toString(), arg ?? null],
    ).catch(() => ({ __gone: true }));
    if (v && v.__gone) return GONE;
    return v && "v" in v ? v.v : v;
  };
  const gone = async () => (await read(() => 1)) === GONE;

  /* -------- 1. a jittery tap reaches the control -------- */
  if (g.what && g.target) {
    const got = await read(g.target);
    // A list of candidates means "any one of these should work": a sliding
    // block boxed in on all four sides legitimately does nothing, so the bug
    // is only a bug if it is true of every block on the board.
    const points = got === GONE ? [] : (Array.isArray(got) ? got : [got]).filter(Boolean);
    if (!points.length) {
      ok(false, g.what, got === GONE ? "the page navigated away" : "no target found on the scene");
    } else {
      const before = await read(g.probe);
      let after = before, tried = 0;
      for (const pt of points) {
        tried++;
        if (g.drop) {
          const to = await read(g.drop);
          await f.drag(pt.x, pt.y, to !== GONE && to ? to.x : pt.x + 60, to !== GONE && to ? to.y : pt.y - 60);
        } else {
          await f.tap(pt.x, pt.y);
        }
        await page.waitForTimeout(250);
        after = await read(g.probe);
        if (after === GONE || JSON.stringify(before) !== JSON.stringify(after)) break;
      }
      const note = points.length > 1 ? `  (${tried}/${points.length} tried)` : "";
      if (after === GONE) {
        console.log(`   · ${g.what} — the level ended, which is a response${note}`);
      } else {
        const changed = JSON.stringify(before) !== JSON.stringify(after);
        if (g.soft && !changed) {
          console.log(`   · ${g.what} — no change (${JSON.stringify(before)}); legitimate here, not asserted`);
        } else {
          ok(changed, g.what, `${JSON.stringify(before)} -> ${JSON.stringify(after)}${note}`);
        }
      }
    }
  } else if (g.what === null) {
    console.log("   · steered by tilt — no touch control to assert");
  }

  // The checks below all need a live scene.
  if (await gone()) await prepare();

  /* -------- 2. a cancelled gesture leaves nothing stuck -------- */
  const box = await page.evaluate(() => {
    const r = window.__engine.canvas.getBoundingClientRect();
    return { x: r.left + r.width * 0.2, y: r.top + r.height * 0.3,
             w: r.width * 0.6, h: r.height * 0.4 };
  });
  /**
   * Assert nothing is left stuck to the finger.
   *
   * A level that the gesture happened to finish navigates to the result page,
   * and a missing scene is not a scene holding something — reading `GONE` as
   * "stuck" reported two correctly solved levels as input bugs. Bring the
   * level back and ask again.
   */
  const notStuck = async (label) => {
    let v = await read(g.stuck);
    if (v === GONE) { await prepare(); v = await read(g.stuck); }
    ok(v !== GONE && !v, label);
  };

  await f.cancel(box.x + box.w / 2, box.y + box.h / 2, box.x + box.w / 2 + 80, box.y + box.h / 2);
  await page.waitForTimeout(200);
  await notStuck("a cancelled gesture leaves nothing held");

  /* -------- 3. two fingers at once -------- */
  await f.two({ x: box.x + 30, y: box.y + 30 }, { x: box.x + box.w - 30, y: box.y + box.h - 30 });
  await page.waitForTimeout(200);
  await notStuck("two fingers at once leaves nothing held");

  /* -------- 4. forty taps in two seconds -------- */
  const errsBefore = errors.length;
  await f.mash(box, 40);
  await page.waitForTimeout(300);
  const ended = await gone();
  if (ended) {
    // Forty taps on a platformer is forty jumps, and the level ends. That is
    // the game responding, not falling over — but it has to be said out loud,
    // because "the scene is missing" and "the scene crashed" look identical
    // from here.
    console.log("   · forty rapid taps finished the level and moved on");
    await prepare();
  } else {
    const alive = await page.evaluate(() => !!window.__engine?.running && !!window.__scene);
    ok(alive, "still running after forty rapid taps");
  }
  ok(errors.length === errsBefore, "the mash threw nothing",
     errors.slice(errsBefore, errsBefore + 2).join(" | "));

  /* -------- 5. layout at a real device size -------- */
  const layout = await page.evaluate(() => {
    const r = window.__engine.canvas.getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      vw: window.innerWidth, vh: window.innerHeight,
      scrollX: document.documentElement.scrollWidth - window.innerWidth,
      safeTop: px("--sys-top"),
      touchAction: getComputedStyle(window.__engine.canvas).touchAction,
    };
  });
  ok(layout.scrollX <= 0, "no horizontal scroll", `overflow ${layout.scrollX}px`);
  ok(layout.w >= layout.vw - 1 && layout.h >= layout.vh - 1,
     "the canvas fills the device viewport", `${layout.w}x${layout.h} in ${layout.vw}x${layout.vh}`);
  ok(layout.touchAction === "none" || layout.touchAction === "manipulation",
     "the canvas opts out of browser gestures", `touch-action: ${layout.touchAction}`);

  ok(!errors.length, "no page errors overall", errors.slice(0, 2).join(" | "));
  } catch (e) {
    ok(false, "the harness got through this game", e.message);
  } finally {
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} failed.` : "\nevery game answers a finger.");
process.exit(fails.length ? 1 : 0);
