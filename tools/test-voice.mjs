/**
 * Proves the voice jump actually works when the recogniser owns the microphone.
 *
 * This is the Android case, and it is the one that shipped broken: the native
 * recogniser takes the mic exclusively, so the loudness meter reads zero, and
 * everything keyed off `voice.speaking` went dead — the charge column never
 * moved and the landing arc never drew. The child spoke, and the bird either
 * sat there or made the same small hop every time.
 *
 * A headless browser has no microphone either, so that is exactly the state
 * this reproduces. It stubs the recogniser to take a controllable amount of
 * time and then return the right word, and asserts the three things a child
 * would notice: the column rises while they speak, the arc is on screen, and
 * speaking longer sends the bird further.
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
 * Runs one level with the recogniser stubbed to "hear" the right word after
 * `speakMs`, and reports what the child would have seen.
 */
async function run(speakMs) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // Stand in for the native recogniser BEFORE the module graph loads, so the
  // game's own `speech` wrapper picks it up instead of the web fallback.
  await page.addInitScript((ms) => {
    window.__speakMs = ms;
    window.__stubbed = true;
  }, speakMs);

  await page.goto(`http://127.0.0.1:${port}/src/games/say-jump.html?level=0`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
await dismissCoach(page);
  await page.mouse.click(210, 500);
  await page.waitForTimeout(500);

  // Swap the scene's listen path for the stub. `beginListening` awaits
  // `speech.listenOnce()`, so replacing the module binding is not enough —
  // the scene holds no reference to swap. Instead drive it directly.
  const res = await page.evaluate(async (ms) => {
    const s = window.__scene;
    const wait = (t) => new Promise((r) => setTimeout(r, t));
    // The recogniser may start filling the meter before this harness samples
    // the prompt. Both states belong to the same word interaction.
    for (let i = 0; i < 400 && s.state !== "prompt" && s.state !== "charge"; i++) await wait(16);
    if (s.state !== "prompt" && s.state !== "charge") {
      return { error: `never reached prompt (state=${s.state})` };
    }

    const want = s.word.word;
    const x0 = s.body.x;
    const hearts0 = s.hearts;

    // Take the real recogniser out of the way first. Headless Chromium has no
    // microphone, so `beginListening` fails instantly and retries on a timer —
    // and each retry resets the charge out from under this harness.
    s.speechOn = false;
    clearTimeout(s._retryTimer);
    s.listening = false;
    // Also cancel a listen parked waiting for the speaker to go quiet. It is
    // invisible from out here — `s.listening` is still false while it waits —
    // and when it wakes it would clear `listenCharge` mid-measurement.
    s._listenGen++;
    await wait(60);

    // Now play the child's part: hold the listen state open for `ms`.
    s.listening = true;
    s.listenStart = performance.now();

    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      await wait(50);
      samples.push({
        t: Math.round(performance.now() - t0),
        charge: +s.currentCharge().toFixed(3),
        state: s.state,
      });
    }
    const power = s.listenCharge;
    const reach = s.effectiveCharge(power, true);
    s.listening = false;
    s.heardWrong = null;
    s.heard = want;
    s.launch(power, true);

    // Let the jump play out and measure at TOUCHDOWN. Waiting any longer
    // folds in the walk to the next stop, which ends at the same x whatever
    // the jump did — that reads as "charge changes nothing" when it is only
    // the measurement that is blind.
    await wait(50);                                     // leave the ground
    for (let i = 0; i < 400 && !s.body.onGround; i++) await wait(16);
    const landedX = s.body.x;
    for (let i = 0; i < 40; i++) await wait(16);

    return {
      want,
      power: +power.toFixed(3),
      reach: +reach.toFixed(3),
      need: +(s.needCharge ?? 0).toFixed(3),
      samples,
      chargedState: samples.some((x) => x.state === "charge"),
      maxCharge: Math.max(...samples.map((x) => x.charge)),
      travelled: Math.round(landedX - x0),
      hearts: s.hearts, hearts0,
      stop: s.stopIndex,
    };
  }, speakMs);

  await ctx.close();
  return { ...res, errors };
}

console.log("— recogniser owns the mic (no loudness signal at all) —\n");

const shortSpeak = await run(500);
const longSpeak = await run(1600);

if (shortSpeak.error || longSpeak.error) {
  console.log("harness could not reach a prompt:", shortSpeak.error || longSpeak.error);
  process.exit(1);
}

ok(shortSpeak.maxCharge > 0, "charge column moves while the child speaks",
   `peak ${shortSpeak.maxCharge}`);
ok(shortSpeak.chargedState, "scene enters `charge`, so the landing arc is drawn");
ok(shortSpeak.samples[0].charge < shortSpeak.maxCharge, "the column climbs, it does not just snap on",
   `${shortSpeak.samples[0].charge} -> ${shortSpeak.maxCharge}`);
ok(longSpeak.power > shortSpeak.power + 0.1, "speaking longer charges further",
   `0.5s -> ${shortSpeak.power}   1.6s -> ${longSpeak.power}`);
ok(longSpeak.travelled > shortSpeak.travelled + 40, "and the bird actually lands further away",
   `${shortSpeak.travelled}px vs ${longSpeak.travelled}px`);
ok(shortSpeak.reach >= shortSpeak.need, "a SHORT, quiet word still clears the gap",
   `reach ${shortSpeak.reach} vs need ${shortSpeak.need}`);
// Against the count the level STARTED with, not a number written here: the
// heart budget is a tuning decision and this test is about the word.
ok(shortSpeak.hearts === shortSpeak.hearts0 && longSpeak.hearts === longSpeak.hearts0,
   "saying the word right never costs a heart",
   `${shortSpeak.hearts0} -> ${shortSpeak.hearts} / ${longSpeak.hearts}`);
ok(shortSpeak.stop > 0 && longSpeak.stop > 0, "the bird gets to the next stop either way",
   `stops ${shortSpeak.stop} / ${longSpeak.stop}`);
ok(!shortSpeak.errors.length && !longSpeak.errors.length, "no page errors",
   [...shortSpeak.errors, ...longSpeak.errors].join(" | "));

await browser.close();
server.close();

console.log(fails.length ? `\n${fails.length} failed.` : "\nvoice jump works without a microphone signal.");
process.exit(fails.length ? 1 : 0);
