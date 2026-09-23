/**
 * Proves the app cannot hear itself.
 *
 * A phone's microphone is two inches from its speaker, so when the game says
 * "cat" out loud it is by far the loudest thing in the room — louder than the
 * child. Three separate faults came out of nothing in the app knowing that,
 * and this checks all three, because they fail independently:
 *
 *   METER   the charge bar filled while the app spoke, so the bird jumped
 *           with the child silent
 *   FLOOR   the noise floor is calibrated from the first half-second of
 *           microphone samples, and if that landed during the prompt it was
 *           set to the volume of the app's own voice — after which a real
 *           child was permanently underneath it and the meter never moved
 *           again. Silent, sticky, and looks exactly like a dead microphone
 *   RECOGNISER  `askWord` spoke the word and opened the recogniser in the
 *           same breath, so the recogniser was handed the app's own
 *           pronunciation and reported a match. The game answered its own
 *           question and the child's attempt never mattered
 *
 * Headless Chromium has no microphone and no voices, so both ends are stood
 * in for: a fake analyser that emits a controllable amplitude, and a fake
 * speech engine that takes a controllable amount of time. The code under test
 * is the real VoiceInput, the real `speak`, and the real `beginListening`.
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
  if (url === "/__bare") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end("<!doctype html><meta charset=utf-8><title>gate</title>");
  }
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

const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(`http://127.0.0.1:${port}/src/games/say-jump.html?level=0`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await dismissCoach(page);
await page.mouse.click(210, 500);
await page.waitForTimeout(400);

/**
 * Stand in for a speech engine. Real headless Chromium has the API but no
 * voices, so `speak` would error out instantly and the gate would open before
 * there was anything to gate — which would pass the test for the wrong reason.
 */
const installOn = async (target) => target.evaluate(() => {
  window.__sayMs = 700;
  const fake = {
    cancel() { for (const u of fake._live) u.__cancelled = true; fake._live = []; },
    getVoices() { return []; },
    _live: [],
    speak(u) {
      fake._live.push(u);
      setTimeout(() => { if (!u.__cancelled) u.onstart?.(); }, 10);
      setTimeout(() => { if (!u.__cancelled) u.onend?.(); }, window.__sayMs);
    },
  };
  Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true, writable: true });
});
await installOn(page);

/* ------------------------------------------------------------------ METER */

const bare = await ctx.newPage();
bare.on("pageerror", (e) => errors.push(`bare: ${e.message}`));
await bare.goto(`http://127.0.0.1:${port}/__bare`, { waitUntil: "load" });
await installOn(bare);

const meter = await bare.evaluate(async () => {
  const { VoiceInput } = await import("/src/js/core/voice.js");
  const audio = await import("/src/js/core/audio.js");
  const wait = (t) => new Promise((r) => setTimeout(r, t));

  // A VoiceInput wired to a microphone we control. Everything except the
  // hardware is the shipping class.
  const v = new VoiceInput();
  v.ready = true; v.live = true;
  v._buf = new Float32Array(1024);
  let amp = 0;
  v._analyser = {
    fftSize: 1024,
    getFloatTimeDomainData(b) { for (let i = 0; i < b.length; i++) b[i] = Math.sin(i * 0.31) * amp; },
  };
  // Skip calibration for this part; the floor gets its own test below.
  v._calibrating = false;
  v.floor = 0.02;

  const pump = async (ms, level) => {
    amp = level;
    const t0 = performance.now();
    let peak = 0, started = 0, fired = 0;
    v.onStart = () => { started++; };
    v.onUtterance = () => { fired++; };
    while (performance.now() - t0 < ms) {
      v.update(1 / 60);
      peak = Math.max(peak, v.level);
      await wait(16);
    }
    // `final` as well as `peak`: the meter releases over about a tenth of a
    // second, so a pump that begins mid-shout carries the old reading down
    // with it and its peak says nothing about what the speaker did.
    return { peak: +peak.toFixed(3), final: +v.level.toFixed(3), started, fired };
  };

  // 1. Loud room, app silent: this MUST register, or the test below proves
  //    nothing — a meter that never moves would pass it trivially.
  const quiet = await pump(500, 0.5);

  // 2. Same loudness, but it is the app talking. Settle to silence first so
  //    the reading is a response to the speaker and not the tail of (1).
  v.cancel();
  await pump(300, 0);
  audio.speak("elephant");
  const talking = await pump(600, 0.5);

  // 2b. And the awkward case: the child is mid-shout when HEAR IT is pressed.
  //     The bar cannot stay where it is — it has to fall away, or the charge
  //     sitting there is credit for the loudspeaker.
  v.cancel();
  audio.unduckMic();
  await pump(300, 0.5);
  audio.speak("elephant");
  const interrupted = await pump(600, 0.5);

  // 3. And the moment it stops, the child is heard again.
  await wait(500);
  const after = await pump(500, 0.5);

  return { quiet, talking, interrupted, after };
});

console.log("— the meter —\n");
ok(meter.quiet.peak > 0.5 && meter.quiet.started > 0,
   "a loud voice in a quiet room does register (control)",
   `peak ${meter.quiet.peak}, ${meter.quiet.started} utterance(s)`);
ok(meter.talking.peak < 0.05,
   "the same loudness from the app's OWN speaker does not move the bar",
   `peak ${meter.talking.peak}`);
ok(meter.interrupted.final < 0.05,
   "a bar already up when the app starts talking falls away instead of holding",
   `${meter.interrupted.peak} -> ${meter.interrupted.final}`);
ok(meter.interrupted.fired === 0,
   "and the interrupted utterance is dropped, not scored",
   `${meter.interrupted.fired} fired`);
ok(meter.talking.started === 0 && meter.talking.fired === 0,
   "and never starts an utterance, so the bird cannot jump on its own",
   `${meter.talking.started} started, ${meter.talking.fired} fired`);
ok(meter.after.peak > 0.5 && meter.after.started > 0,
   "once the app stops talking the child is heard again",
   `peak ${meter.after.peak}`);

/* ------------------------------------------------------------------ FLOOR */

const floor = await bare.evaluate(async () => {
  const { VoiceInput } = await import("/src/js/core/voice.js");
  const audio = await import("/src/js/core/audio.js");
  const wait = (t) => new Promise((r) => setTimeout(r, t));

  const make = () => {
    const v = new VoiceInput();
    v.ready = true; v.live = true;
    v._buf = new Float32Array(1024);
    v.__amp = 0;
    v._analyser = {
      fftSize: 1024,
      getFloatTimeDomainData(b) { for (let i = 0; i < b.length; i++) b[i] = Math.sin(i * 0.31) * v.__amp; },
    };
    return v;
  };
  const pump = async (v, frames, amp) => {
    v.__amp = amp;
    for (let i = 0; i < frames; i++) { v.update(1 / 60); await wait(8); }
  };

  // The real sequence: the level loads, the game reads the word aloud, and
  // calibration is running through all of it.
  const v = make();
  audio.speak("elephant");
  await pump(v, 50, 0.5);                       // 50 frames of the app talking
  const duringTalk = { floor: +v.floor.toFixed(4), calibrating: v._calibrating };

  // Then the room goes quiet and calibration gets honest samples.
  await wait(600);
  await pump(v, 50, 0.01);
  const settled = +v.floor.toFixed(4);

  // Can a normal child now be heard over that floor?
  v.__amp = 0.25;
  for (let i = 0; i < 20; i++) v.update(1 / 60);
  const childLevel = +v.level.toFixed(3);

  return { duringTalk, settled, childLevel, calibrated: !v._calibrating };
});

console.log("\n— the noise floor —\n");
ok(floor.duringTalk.calibrating,
   "calibration refuses to sample while the app is talking",
   `still calibrating after 50 loud frames`);
ok(floor.calibrated && floor.settled < 0.09,
   "it calibrates from the quiet that follows, at room level not speaker level",
   `floor ${floor.settled}, calibrated=${floor.calibrated}`);
ok(floor.childLevel > 0.3,
   "so a child at normal volume clears it comfortably",
   `level ${floor.childLevel}`);

/* ------------------------------------------------------------ RECOGNISER */

const recog = await page.evaluate(async () => {
  const audio = await import("/src/js/core/audio.js");
  const nat = await import("/src/js/core/native.js");
  const wait = (t) => new Promise((r) => setTimeout(r, t));
  const s = window.__scene;

  // A live recogniser can advance from prompt to charge between samples.
  for (let i = 0; i < 400 && s.state !== "prompt" && s.state !== "charge"; i++) await wait(16);
  if (s.state !== "prompt" && s.state !== "charge") {
    return { error: `never reached prompt (state=${s.state})` };
  }

  const opens = [];
  const pending = [];
  let listeningWhileTalking = false;
  nat.speech.listenOnce = () => new Promise((resolve) => {
    opens.push({ busy: audio.speakerBusy(), at: Math.round(performance.now()) });
    pending.push(resolve);
  });
  nat.speech.stop = async () => {
    for (const resolve of pending.splice(0)) resolve([]);
  };

  // The page may still be finishing its real microphone startup. Take sole
  // ownership of this scene's listen before the controlled prompt begins.
  s._voiceGeneration++;
  s._voicePendingRefresh = false;
  s._listenGen++;
  s.listening = false;
  s.listenCharge = 0;
  s.speechOn = true;
  s.misses = 0;
  clearTimeout(s._retryTimer);

  // Ask a word the way the game does: read it aloud, then listen.
  window.__sayMs = 700;
  const t0 = performance.now();
  s.setState("prompt");

  // While the phone is still talking, the recogniser must be shut and the
  // child's "how long did you speak for" clock must not be running.
  let chargeDuringTalk = 0;
  for (let i = 0; i < 25; i++) {
    await wait(20);
    if (audio.speakerBusy()) {
      if (s.listening) listeningWhileTalking = true;
      chargeDuringTalk = Math.max(chargeDuringTalk, s.listenCharge);
    }
  }

  // Keep this listen pending: HEAR IT is pressed while the recogniser owns the
  // microphone, so the old result must be abandoned before the next opens.
  for (let i = 0; i < 120 && !opens.length; i++) await wait(20);

  // Pressing HEAR IT mid-listen must not be scored as the child's attempt.
  const missesBefore = s.misses;
  const stateAtPress = s.state;
  const opensBefore = opens.length;
  s.sayWordAloud();
  await wait(2400);

  return {
    opens, listeningWhileTalking,
    chargeDuringTalk: +chargeDuringTalk.toFixed(3),
    firstOpenDelay: opens.length ? opens[0].at - Math.round(t0) : -1,
    missesBefore, missesAfter: s.misses,
    stateAtPress, stateAfter: s.state,
    listening: s.listening, gen: s._listenGen,
    reArmed: opens.length > opensBefore,
  };
});

console.log("\n— the recogniser —\n");
if (recog.error) {
  ok(false, "harness reached a prompt", recog.error);
} else {
  ok(recog.opens.length > 0, "the recogniser does get opened", `${recog.opens.length} time(s)`);
  ok(recog.opens.every((o) => !o.busy),
     "but never while the app's own voice is on the speaker",
     recog.opens.map((o) => (o.busy ? "BUSY" : "clear")).join(", "));
  ok(recog.firstOpenDelay >= 650,
     "it waits out the spoken prompt before opening",
     `opened ${recog.firstOpenDelay}ms after the word was asked (spoken length 700ms)`);
  ok(!recog.listeningWhileTalking,
     "the child's speak-length clock does not run while the app talks");
  ok(recog.chargeDuringTalk === 0,
     "so no charge is banked before the child's turn starts",
     `charge ${recog.chargeDuringTalk}`);
  ok(recog.missesAfter === recog.missesBefore,
     "pressing HEAR IT mid-listen does not burn one of the three tries",
     `${recog.missesBefore} -> ${recog.missesAfter}`);
  ok(recog.reArmed, "and listening resumes once it has finished speaking",
     `state ${recog.stateAtPress} -> ${recog.stateAfter}, listening=${recog.listening}, gen=${recog.gen}`);
}

ok(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));

await ctx.close();
await browser.close();
server.close();

console.log(fails.length ? `\n${fails.length} failed.` : "\nthe app cannot hear itself.");
process.exit(fails.length ? 1 : 0);
