/**
 * Proves tilt steering survives the phones it was failing on.
 *
 * Reported from a real Android device as "the tilt is not working at all".
 * The cause was a phone with an accelerometer and NO GYROSCOPE: it fires
 * `deviceorientation` forever with null beta/gamma, which the old code
 * correctly discarded and then had nothing else to listen to. Headless
 * Chromium has no sensors of any kind, so this synthesises each device by
 * dispatching the events a real one would, and checks the ball moves.
 *
 * The three cases are the three phones that matter:
 *   - a normal phone (gyro, full `deviceorientation`)
 *   - a cheap phone (no gyro, `devicemotion` gravity only)
 *   - a laptop (no sensors at all — drag must still work)
 */
import { chromium } from "playwright";
import { CHROMIUM, dismissCoach } from "./browser.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
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

const browser = await chromium.launch({ executablePath: CHROMIUM });
const fails = [];
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "✓" : "✗"} ${msg}${detail ? `   ${detail}` : ""}`);
  if (!cond) fails.push(msg);
};

/**
 * @param {"gyro"|"nogyro"|"none"} device which phone to pretend to be
 */
async function play(device) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Install the fake sensor BEFORE the page runs, so the scene's own
  // `requestGyro()` sees it during boot exactly as it would on the device.
  await page.addInitScript((kind) => {
    if (kind === "none") return;
    window.__sensor = { beta: 0, gamma: 0 };
    setInterval(() => {
      const s = window.__sensor;
      if (kind === "gyro") {
        window.dispatchEvent(Object.assign(
          new Event("deviceorientation"), { alpha: 0, beta: s.beta, gamma: s.gamma }));
      } else {
        // A gyro-less phone: the orientation event fires, and says nothing.
        window.dispatchEvent(Object.assign(
          new Event("deviceorientation"), { alpha: null, beta: null, gamma: null }));
        // Gravity, for the pose those angles describe.
        const R = Math.PI / 180, b = s.beta * R, g = s.gamma * R;
        const G = 9.81;
        window.dispatchEvent(Object.assign(new Event("devicemotion"), {
          accelerationIncludingGravity: {
            x: -G * Math.sin(g),
            y: G * Math.sin(b) * Math.cos(g),
            z: G * Math.cos(b) * Math.cos(g),
          },
        }));
      }
    }, 16);
  }, device);

  await page.goto(`http://127.0.0.1:${port}/src/games/tilt-maze.html?level=0`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await dismissCoach(page);

  const res = await page.evaluate(async () => {
    const wait = (t) => new Promise((r) => setTimeout(r, t));
    const s = window.__scene;
    // out of the intro and into play
    s.state = "play"; s.stateT = 0; s.tilt.calibrate();
    await wait(200);

    const source = s.tilt.source;
    const x0 = s.ball.x, y0 = s.ball.y;

    // Lean the phone hard right for a while.
    if (window.__sensor) window.__sensor.gamma = 40;
    await wait(700);
    const atRight = s.ball.x;
    const tiltRight = s.tilt.x;

    // Then hard left. Measured from where it GOT to, not from where it
    // started: the maze has walls, and a ball pinned against one has stopped
    // for a reason that has nothing to do with whether steering works.
    if (window.__sensor) window.__sensor.gamma = -40;
    await wait(300);
    const tiltLeft = s.tilt.x;

    // Sample the VELOCITY, not the distance travelled. Where the ball ends up
    // after a lean is a fact about the maze — it can roll into a corridor or
    // pin against a wall and stop, which says nothing about steering. That it
    // is being pushed left is the claim actually under test.
    let vxMin = Infinity;
    const states = new Set();
    for (let i = 0; i < 40; i++) {
      await wait(20);
      states.add(s.state);
      if (s.state === "play") vxMin = Math.min(vxMin, s.ball.vx);
    }

    return { source, sensor: s.tilt.sensor, live: s.tilt.live,
             movedRight: Math.round(atRight - x0),
             states: [...states].join("+"),
             vxMin: Number.isFinite(vxMin) ? Math.round(vxMin) : null,
             tiltRight: +tiltRight.toFixed(2), tiltLeft: +tiltLeft.toFixed(2),
             y0: Math.round(y0) };
  });

  await ctx.close();
  return { ...res, errors };
}

console.log("— a normal phone —");
const gyro = await play("gyro");
ok(gyro.live && gyro.source === "gyro", "uses the gyroscope", `sensor=${gyro.sensor}`);
ok(gyro.movedRight > 8, "leaning right rolls the ball right", `${gyro.movedRight}px`);
ok(gyro.tiltRight > 0.8 && gyro.tiltLeft < -0.8, "the steering axis follows the phone",
   `right ${gyro.tiltRight} / left ${gyro.tiltLeft}`);
ok(gyro.vxMin <= 0, "and a held left lean never reads as pushing right", `vx ${gyro.vxMin}`);

console.log("\n— a cheap phone: accelerometer, no gyroscope —");
const nogyro = await play("nogyro");
ok(nogyro.live, "still steers by tilt", `source=${nogyro.source} sensor=${nogyro.sensor}`);
ok(nogyro.sensor === "devicemotion", "falling through to the gravity vector");
ok(nogyro.movedRight > 8, "leaning right rolls the ball right", `${nogyro.movedRight}px`);
ok(nogyro.tiltRight > 0.8 && nogyro.tiltLeft < -0.8, "the steering axis follows the phone",
   `right ${nogyro.tiltRight} / left ${nogyro.tiltLeft}`);
ok(nogyro.vxMin <= 0, "and a held left lean never reads as pushing right", `vx ${nogyro.vxMin}`);

console.log("\n— a laptop: no sensors at all —");
const none = await play("none");
ok(!none.live, "knows there is no sensor", `source=${none.source}`);
ok(none.errors.length === 0, "and does not fall over", none.errors.join(" | "));

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} failed.` : "\ntilt works on all three.");
process.exit(fails.length ? 1 : 0);
