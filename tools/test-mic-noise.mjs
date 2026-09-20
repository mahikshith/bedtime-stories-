/**
 * Proves the microphone listens to the child and not to the room.
 *
 * Reported from the device: "it recognizes external noises", "the speaker
 * indicator is going too high, and it is too sensitive". Two different faults
 * wear that one sentence, and only one of them is a threshold.
 *
 *   SPIKES. A door, a dropped toy, a chair on a hard floor and a hand
 *   brushing the phone all clear any threshold you care to set — for about
 *   two frames. Speech does not: even the shortest word a child says holds
 *   energy for a tenth of a second. So the level has to STAY up, not merely
 *   reach up. Raising the threshold alone would have rejected the quiet
 *   children along with the door.
 *
 *   A STRANDED FLOOR. The bigger one, and invisible. The noise floor was
 *   measured once at startup and afterwards allowed to drift DOWNWARD only.
 *   A room that got louder later — a television, a sibling, a car — left the
 *   floor stranded underneath the new noise, the meter pinned at the top and
 *   an utterance firing on nothing at all. No threshold fixes that, because
 *   the threshold was being measured from the wrong number.
 *
 * Headless Chromium has no microphone, so the room is stood in for: a fake
 * analyser at an amplitude this harness controls, around the real VoiceInput.
 * Every number below is what a child would have experienced.
 */
import { chromium } from "playwright";
import { CHROMIUM } from "./browser.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/__bare") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end("<!doctype html><meta charset=utf-8><title>mic</title>");
  }
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("nf");
  }
  res.writeHead(200, { "content-type": path.extname(file) === ".js" ? "text/javascript" : "text/plain" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/__bare`, { waitUntil: "load" });

const fails = [];
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "✓" : "✗"} ${msg}${detail ? `   ${detail}` : ""}`);
  if (!cond) fails.push(msg);
};

const result = await page.evaluate(async () => {
  const { VoiceInput } = await import("/src/js/core/voice.js");

  /**
   * A VoiceInput on a microphone this harness drives.
   *
   * `update` is called with a fixed dt rather than in real time, so a
   * two-second room history is two seconds of simulated audio and the test
   * runs instantly. Everything except the hardware is the shipping class.
   */
  const make = (opts) => {
    const v = new VoiceInput(opts);
    v.ready = true; v.live = true;
    v._buf = new Float32Array(1024);
    v.__amp = 0;
    v._analyser = {
      fftSize: 1024,
      getFloatTimeDomainData(b) { for (let i = 0; i < b.length; i++) b[i] = Math.sin(i * 0.31) * v.__amp; },
    };
    v.__started = 0; v.__fired = 0;
    v.onStart = () => { v.__started++; };
    v.onUtterance = () => { v.__fired++; };
    return v;
  };
  const DT = 1 / 60;
  const run = (v, ms, amp) => {
    v.__amp = amp;
    let peak = 0;
    for (let i = 0; i < Math.round(ms / 1000 / DT); i++) { v.update(DT); peak = Math.max(peak, v.level); }
    return +peak.toFixed(3);
  };
  /** Settle the room so the floor is calibrated before anything is measured. */
  const settle = (v, amp, ms = 3000) => { run(v, ms, amp); };

  const out = {};

  /* ---- 1. impulse noise vs a spoken word, at the same loudness ---- */
  {
    const v = make();
    settle(v, 0.01);
    // Five separate knocks: two frames of full loudness each.
    for (let i = 0; i < 5; i++) { run(v, 33, 0.6); run(v, 200, 0.01); }
    out.knocks = { started: v.__started, fired: v.__fired };

    // The same loudness, held as long as a short word.
    v.cancel(); v.__started = 0; v.__fired = 0;
    run(v, 260, 0.6);
    run(v, 700, 0.01);
    out.word = { started: v.__started, fired: v.__fired };
  }

  /* ---- 2. a short word is not made quieter by the wait ---- */
  {
    const v = make();
    settle(v, 0.01);
    let charge = 0;
    v.onUtterance = (r) => { charge = r.charge; };
    run(v, 220, 0.55);
    run(v, 700, 0.01);
    out.shortWordCharge = +charge.toFixed(3);
  }

  /* ---- 3. the room gets louder after calibration ---- */
  {
    const v = make();
    settle(v, 0.01);
    const floorQuiet = +v.floor.toFixed(4);
    // A television comes on. Not a word, just a louder room.
    run(v, 500, 0.06);
    const early = { started: v.__started, level: +v.level.toFixed(3) };
    run(v, 4000, 0.06);
    out.louder = {
      floorQuiet,
      floorAfter: +v.floor.toFixed(4),
      levelAfter: +v.level.toFixed(3),
      startedEarly: early.started,
      startedTotal: v.__started,
    };

    // And the child still gets through over the top of it.
    v.cancel(); v.__started = 0;
    run(v, 300, 0.5);
    out.overNoise = { started: v.__started, level: +v.level.toFixed(3) };
  }

  /* ---- 4. and back down again when the room quietens ---- */
  {
    const v = make();
    settle(v, 0.08, 4000);
    const loud = +v.floor.toFixed(4);
    run(v, 4000, 0.01);
    out.quieter = { loud, after: +v.floor.toFixed(4) };
    // A quiet child, in a room that is quiet again.
    v.cancel(); v.__started = 0;
    run(v, 300, 0.2);
    out.quietChild = { started: v.__started, level: +v.level.toFixed(3) };
  }

  return out;
});

console.log("— a spike is not a word —\n");
ok(result.knocks.started === 0,
   "five sharp knocks start nothing",
   `${result.knocks.started} utterance(s)`);
ok(result.word.started === 1,
   "the same loudness, held like a word, does start one",
   `${result.word.started} utterance(s)`);
ok(result.shortWordCharge > 0.25,
   "and a short word keeps the charge it earned while we waited",
   `charge ${result.shortWordCharge}`);

console.log("\n— a room that gets louder —\n");
ok(result.louder.floorAfter > result.louder.floorQuiet * 1.5,
   "the noise floor follows the room up",
   `${result.louder.floorQuiet} -> ${result.louder.floorAfter}`);
ok(result.louder.levelAfter < 0.15,
   "so the meter is not left pinned at the top by room noise",
   `level ${result.louder.levelAfter}`);
ok(result.louder.startedTotal <= 1,
   "four seconds of television is not four seconds of answers",
   `${result.louder.startedTotal} utterance(s)`);
ok(result.overNoise.started === 1,
   "and the child is still heard over the top of it",
   `level ${result.overNoise.level}`);

console.log("\n— and quieter again —\n");
ok(result.quieter.after < result.quieter.loud * 0.7,
   "the floor comes back down when the room does",
   `${result.quieter.loud} -> ${result.quieter.after}`);
ok(result.quietChild.started === 1,
   "a quiet child in a quiet room is heard",
   `level ${result.quietChild.level}`);

ok(!errors.length, "no page errors", errors.slice(0, 2).join(" | "));

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} failed.` : "\nit listens to the child, not the room.");
process.exit(fails.length ? 1 : 0);
