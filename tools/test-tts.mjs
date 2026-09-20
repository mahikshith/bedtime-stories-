/**
 * Proves the app knows whether it is being heard.
 *
 * Android's WebView exposes the whole SpeechSynthesis API whether or not the
 * device has a text-to-speech engine behind it. `speak()` accepts the
 * utterance, resolves, and nothing comes out of the speaker. No error, no
 * exception, `getVoices()` empty. From inside the page it is indistinguishable
 * from success — which is why HEAR IT could be reported as doing nothing while
 * every test here passed: there was nothing in the web API being tested
 * against.
 *
 * The real fix is the native TextToSpeech plugin, which talks to Android's own
 * service and cannot be checked from a browser. What CAN be checked, and is
 * what this file is for, is the safety net underneath it: that a silent engine
 * is NOTICED rather than believed, so the game can show a child the syllables
 * instead of a button that does nothing.
 *
 * Three engines are simulated: one that works, one that accepts and stays
 * silent, and one that errors.
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
    return res.end("<!doctype html><meta charset=utf-8><title>tts</title>");
  }
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("nf");
  }
  res.writeHead(200, { "content-type": "text/javascript" });
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
 * One engine, one fresh page.
 *
 * A fresh context per case on purpose: the health flag is module state, and
 * carrying it between engines would let one case pass on the previous one's
 * evidence.
 */
async function withEngine(kind) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((k) => {
    const fake = {
      _live: [],
      cancel() { for (const u of fake._live) u.__x = true; fake._live = []; },
      getVoices() { return k === "works" ? [{ name: "Test", lang: "en-US" }] : []; },
      addEventListener() {},
      speak(u) {
        fake._live.push(u);
        if (k === "works") {
          setTimeout(() => { if (!u.__x) u.onstart?.(); }, 20);
          setTimeout(() => { if (!u.__x) u.onend?.(); }, 300);
        } else if (k === "errors") {
          setTimeout(() => { if (!u.__x) u.onerror?.({ error: "synthesis-unavailable" }); }, 30);
        }
        // "silent": accepted, and then nothing at all. This is the Android
        // case, and the one no API call can distinguish from working.
      },
    };
    Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true, writable: true });
  }, kind);
  await page.goto(`http://127.0.0.1:${port}/__bare`, { waitUntil: "load" });

  const out = await page.evaluate(async () => {
    const audio = await import("/src/js/core/audio.js");
    const before = audio.speechWorking();
    const said = await audio.speak("castle");
    // The gate always keeps a short tail after the audio stops — a speaker
    // cone takes a moment to settle — so "released" means it clears soon,
    // not instantly. What matters is that it is not held for the whole
    // estimated length of a phrase that was never said.
    const heldFor = audio.speakerBusyMs();
    await new Promise((r) => setTimeout(r, 400));
    return { before, said, after: audio.speechWorking(),
             heldFor: Math.round(heldFor), busy: audio.speakerBusy() };
  });
  await ctx.close();
  return { ...out, errors };
}

console.log("— an engine that works —\n");
const good = await withEngine("works");
ok(good.before === null, "health is unknown until something is tried", `${good.before}`);
ok(good.said === true, "speak reports that it spoke");
ok(good.after === true, "and the app knows speech is working");

console.log("\n— an engine that accepts and says nothing (the Android case) —\n");
const silent = await withEngine("silent");
ok(silent.said === false, "speak reports that nothing was said");
ok(silent.after === false, "the silence is noticed, not believed");
ok(!silent.busy && silent.heldFor <= 300,
   "and the microphone gate is released rather than left shut",
   `held ${silent.heldFor}ms more, then clear`);

console.log("\n— an engine that errors —\n");
const bad = await withEngine("errors");
ok(bad.said === false, "speak reports failure");
ok(bad.after === false, "health is marked broken");
ok(!bad.busy && bad.heldFor <= 300, "the gate is released",
   `held ${bad.heldFor}ms more, then clear`);

const errs = [...good.errors, ...silent.errors, ...bad.errors];
ok(!errs.length, "no page errors", errs.slice(0, 2).join(" | "));

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} failed.` : "\nsilence is detected, not mistaken for speech.");
process.exit(fails.length ? 1 : 0);
