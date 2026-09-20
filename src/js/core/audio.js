/**
 * Sound: synthesised SFX plus speech.
 *
 * Everything is generated with WebAudio oscillators — no audio files to load,
 * which keeps the whole app installable from a single static folder and means
 * sound is instant on the first tap.
 *
 * Browsers hold the context suspended until a gesture, so `unlock()` is wired
 * to the first pointerdown/keydown by `install()`.
 */

import { haptics, tts, ttsVoices } from "./native.js";

let ctx = null;
let master = null;
let musicGain = null;
let enabled = true;
let musicTimer = 0;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
  }
  return ctx;
}

export function unlock() {
  const c = ac();
  if (c && c.state === "suspended") c.resume();
}

/** Attach the one-time gesture unlock. Safe to call more than once. */
export function install() {
  const go = () => unlock();
  window.addEventListener("pointerdown", go, { once: false, passive: true });
  window.addEventListener("keydown", go, { passive: true });
}

export function setEnabled(on) {
  enabled = on;
  if (master) master.gain.value = on ? 0.85 : 0;
}
export const isEnabled = () => enabled;

/**
 * One oscillator voice.
 * @param {object} o
 * @param {number} o.freq      start frequency
 * @param {number} [o.to]      glide target
 * @param {string} [o.type]    waveform
 * @param {number} [o.dur]     seconds
 * @param {number} [o.vol]     peak gain
 * @param {number} [o.delay]   start offset
 * @param {number} [o.attack]  seconds to peak
 */
function voice({ freq, to, type = "sine", dur = 0.18, vol = 0.3, delay = 0, attack = 0.008 }) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Filtered noise burst — lands, pops, whooshes. */
function noise({ dur = 0.2, vol = 0.25, delay = 0, freq = 900, q = 1, sweepTo = null }) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(freq, t0);
  bp.Q.value = q;
  if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t0);
}

/**
 * A sung note: a soft voice with vibrato, for a chorus rather than a beep.
 *
 * The kit above is percussive on purpose — short, bright, over quickly. A
 * chorus needs the opposite: a slow swell, a little wobble in the pitch so
 * twenty of them do not phase into one flat tone, and a long tail so voices
 * overlap into a chord instead of arriving as separate events.
 */
export function sing(freq, { vol = 0.12, dur = 0.55, delay = 0, detune = 0, vibrato = 4.6 } = {}) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  osc.detune.setValueAtTime(detune, t0);

  // A quiet second oscillator a fifth up gives the voice a body that a lone
  // sine has not got, without sounding like a synth lead.
  const harm = c.createOscillator();
  harm.type = "triangle";
  harm.frequency.setValueAtTime(freq * 1.5, t0);

  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.setValueAtTime(vibrato, t0);
  lfoGain.gain.setValueAtTime(freq * 0.007, t0);
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  const g = c.createGain();
  const hg = c.createGain();
  hg.gain.setValueAtTime(vol * 0.22, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.22);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g); harm.connect(hg); hg.connect(g);
  g.connect(master);
  osc.start(t0); harm.start(t0); lfo.start(t0);
  osc.stop(t0 + dur + 0.06); harm.stop(t0 + dur + 0.06); lfo.stop(t0 + dur + 0.06);
}

/* ------------------------------------------------------------- the kit */

/*
 * Every cue below fires a haptic as well as a sound.
 *
 * They live together because they are the same event: a thing landed, a thing
 * was right, a thing popped. Putting the buzz here rather than in each game
 * means all eleven get it without any of them importing the native layer, and
 * there is no game that can quietly forget to. It follows the mute switch,
 * because a parent silencing the app in a waiting room means all of it.
 */
const feel = (kind) => { if (enabled) haptics[kind](); };

const NOTE = { C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392.0, A4: 440.0, B4: 493.9,
               C5: 523.3, D5: 587.3, E5: 659.3, G5: 784.0, C6: 1046.5 };

export const sfx = {
  /** Jump — pitch scales with charge so a big shout sounds big. */
  jump(power = 0.5) {
    feel("tap");
    voice({ freq: 320 + power * 220, to: 640 + power * 420, type: "triangle", dur: 0.22, vol: 0.26 });
    noise({ dur: 0.1, vol: 0.08, freq: 1600, sweepTo: 3400 });
  },
  land() {
    feel("knock");
    voice({ freq: 180, to: 90, type: "sine", dur: 0.12, vol: 0.28 });
    noise({ dur: 0.09, vol: 0.14, freq: 420, q: 0.8 });
  },
  step() { noise({ dur: 0.045, vol: 0.05, freq: 700, q: 1.6 }); },
  coin() {
    feel("tap");
    voice({ freq: NOTE.E5, type: "square", dur: 0.07, vol: 0.14 });
    voice({ freq: NOTE.C6, type: "square", dur: 0.14, vol: 0.14, delay: 0.06 });
  },
  pop() {
    feel("tap");
    voice({ freq: 700, to: 1500, type: "sine", dur: 0.09, vol: 0.24 });
    noise({ dur: 0.07, vol: 0.14, freq: 2200, sweepTo: 800 });
  },
  whoosh() { noise({ dur: 0.3, vol: 0.12, freq: 300, sweepTo: 2200, q: 0.6 }); },
  /** Correct — the rising major triad the app uses to say "yes". */
  correct() {
    feel("knock");
    [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) =>
      voice({ freq: f, type: "triangle", dur: 0.26, vol: 0.2, delay: i * 0.065 }));
  },
  wrong() {
    feel("tap");
    voice({ freq: 200, to: 120, type: "sawtooth", dur: 0.3, vol: 0.16 });
    voice({ freq: 150, to: 92, type: "square", dur: 0.3, vol: 0.09, delay: 0.02 });
  },
  /** Level complete — a little fanfare worth replaying for. */
  fanfare() {
    feel("win");
    const line = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6];
    line.forEach((f, i) =>
      voice({ freq: f, type: "triangle", dur: 0.3, vol: 0.22, delay: i * 0.11 }));
    line.forEach((f, i) =>
      voice({ freq: f / 2, type: "sine", dur: 0.34, vol: 0.12, delay: i * 0.11 }));
  },
  star(index = 0) {
    voice({ freq: NOTE.G5 * (1 + index * 0.18), type: "triangle", dur: 0.3, vol: 0.22 });
    voice({ freq: NOTE.C6 * (1 + index * 0.18), type: "sine", dur: 0.36, vol: 0.14, delay: 0.05 });
  },
  clone() { voice({ freq: 520, to: 880, type: "square", dur: 0.08, vol: 0.09 }); },
  shoot() { voice({ freq: 900, to: 400, type: "square", dur: 0.05, vol: 0.06 }); },
  hurt() {
    voice({ freq: 320, to: 110, type: "sawtooth", dur: 0.26, vol: 0.2 });
    noise({ dur: 0.16, vol: 0.12, freq: 500, sweepTo: 180 });
  },
  tick() { voice({ freq: 1200, type: "square", dur: 0.03, vol: 0.06 }); },
  /** Charging hum while the mic is picking up a voice. */
  charge(power) {
    voice({ freq: 200 + power * 500, type: "sine", dur: 0.06, vol: 0.05 });
  },
};

/* --------------------------------------------------------------- music */

/**
 * A gentle two-bar loop under the hub. Deliberately sparse: kids play these
 * for a long time and a busy loop turns into nagging.
 */
const MELODY = [NOTE.C5, NOTE.E5, NOTE.G4, NOTE.E5, NOTE.F4, NOTE.A4, NOTE.G4, NOTE.C5];
let musicOn = false;
let musicIndex = 0;

function musicVoice(freq, dur, vol) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(musicGain);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

export function startMusic() {
  if (musicOn) return;
  musicOn = true;
  const beat = 460;
  const tick = () => {
    if (!musicOn) return;
    const n = MELODY[musicIndex % MELODY.length];
    musicVoice(n, 0.5, 0.18);
    if (musicIndex % 4 === 0) musicVoice(n / 2, 0.9, 0.12);
    musicIndex++;
    musicTimer = setTimeout(tick, beat);
  };
  tick();
}

export function stopMusic() {
  musicOn = false;
  clearTimeout(musicTimer);
}

/* -------------------------------------------------------------- speech */

/**
 * The voice list arrives late, so ask for it once at startup and keep the
 * promise. `getVoices()` returns [] on the first call in Chrome and in
 * Android's WebView and fills in asynchronously; caching that empty result
 * is a real way to have no voice selected for the whole session.
 */
let voicesReady = null;
const getVoices = () => (voicesReady ??= ttsVoices());
if (typeof window !== "undefined") getVoices();

function pickVoice(list) {
  if (!list?.length) return null;
  const en = list.filter((v) => /^en/i.test(v.lang));
  // Prefer a female/child-ish voice where the platform exposes one; kids
  // respond to it and it matches the mascot.
  const nice = en.find((v) => /(samantha|karen|zira|female|google us english)/i.test(v.name));
  return nice || en[0] || list[0];
}

/**
 * Whether anything actually comes out of the speaker.
 *
 * null until something has been tried. Android's WebView accepts an
 * utterance, resolves, and stays silent when the device has no TTS engine —
 * there is no error and no exception, so the only way to know is to notice
 * that `onstart` never fired. Games use this to show a child something
 * instead of a button that does nothing.
 */
let ttsHealthy = null;
export const speechWorking = () => ttsHealthy;

/** How long to wait for `onstart` before concluding nothing was said. */
const SILENT_MS = 1100;

/* ------------------------------------------- the speaker/microphone gate */

/**
 * WHY THIS EXISTS.
 *
 * A phone has one speaker and one microphone, and they are two inches apart.
 * When the app says "cat" out loud, the microphone hears "cat" — loudly, far
 * louder than the child sitting across the room. Nothing in this app used to
 * know that, and three separate faults came out of it:
 *
 *   1. The loudness meter spiked while the app spoke, so the charge bar
 *      filled and the bird jumped with the child silent. Reported from the
 *      device as "it is easily recognizing noises from the speaker".
 *
 *   2. The noise floor is calibrated from the first half-second of samples.
 *      If that half-second landed while the app was talking, the floor was
 *      set to the volume of the app's own voice — after which a real child
 *      was permanently below the floor and the meter never moved again.
 *      This is the worse of the two, because it is silent and it persists.
 *
 *   3. The recogniser heard it too. `askWord` speaks the word and starts
 *      listening in the same breath, so the recogniser was handed the app's
 *      own pronunciation and returned a match. The game was answering its
 *      own question, and the child's attempt never mattered either way.
 *
 * So output declares itself here, and both input paths ask before trusting
 * what they hear. This is the only module that knows when a sound is playing,
 * which is why the gate lives here rather than in voice.js.
 *
 * TAIL. The gate stays shut a fraction after the audio stops. A speaker cone
 * takes a moment to settle, a room takes longer, and a recogniser started on
 * the same frame the utterance ends will still catch the last syllable.
 */

const TAIL_MS = 280;
let outputUntil = 0;
let speakGen = 0;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * How long a phrase will take to say, near enough.
 *
 * Deliberately an over-estimate: the cost of guessing long is a short pause
 * before the child may speak, and the cost of guessing short is the app
 * hearing itself — which is the entire bug this is here to prevent.
 */
function speechMs(str, rate = 1) {
  return (320 + String(str).length * 95) / Math.max(0.3, rate);
}

/** Hold the gate shut for `ms` from now. Never shortens an existing hold. */
export function duckMic(ms) {
  outputUntil = Math.max(outputUntil, now() + ms);
}

/** Open the gate immediately — for when output is known to have stopped. */
export function unduckMic() { outputUntil = 0; }

/**
 * Bring the gate forward to `ms` from now, but never push it back.
 *
 * The counterpart to `duckMic`. Estimates are over-generous on purpose, so
 * once the engine reports that it has actually finished, the hold should
 * shrink to the tail rather than keeping the child muted for the rest of a
 * guess that turned out to be long.
 */
export function releaseMic(ms = TAIL_MS) {
  outputUntil = Math.min(outputUntil, now() + ms);
}

/** True while the app's own sound is (or has just been) coming out. */
export function speakerBusy() { return now() < outputUntil; }

/** Milliseconds until the speaker is clear; 0 when it already is. */
export function speakerBusyMs() { return Math.max(0, outputUntil - now()); }

/**
 * Resolve once the speaker is quiet.
 *
 * Polls rather than using a callback list, because the gate is extended from
 * several places (a word, then its syllables a beat later) and a promise
 * captured at the start would resolve in the gap between them.
 */
export function speakerIdle() {
  return new Promise((resolve) => {
    const tick = () => {
      const left = speakerBusyMs();
      if (left <= 0) resolve();
      else setTimeout(tick, Math.min(left + 10, 120));
    };
    tick();
  });
}

/**
 * Say a word out loud. This is the whole point of a vocabulary game: the child
 * must hear the target before they try to produce it.
 * @returns {Promise<void>} resolves when speaking ends (or immediately if TTS
 *                          is unavailable, so callers never stall)
 */
export function speak(str, { rate = 0.85, pitch = 1.15, volume = 1 } = {}) {
  if (!enabled || typeof window === "undefined") return Promise.resolve(false);
  // Shut the gate BEFORE the first phoneme, not on `onstart`: some engines
  // fire onstart late enough that the first syllable is already out. Bumping
  // the generation first matters too — cancelling the previous utterance
  // must not let ITS `onend` open the gate we just shut for this one.
  const gen = ++speakGen;
  duckMic(speechMs(str, rate) + TAIL_MS);
  return say(str, { rate, pitch, volume }, gen);
}

async function say(str, opts, gen) {
  // The native engine first where there is one. Android's WebView will accept
  // an utterance and stay silent; the platform's own TextToSpeech service
  // will not, and it is the difference between HEAR IT working on a phone and
  // only appearing to.
  if (tts.native) {
    try { await tts.stop(); } catch {}
    const said = await tts.speak(str, opts);
    if (gen === speakGen) releaseMic();
    if (said) { ttsHealthy = true; return true; }
    ttsHealthy = false;
    // Fall through: a plugin that refused is still worth a web attempt.
  }
  return webSpeak(str, opts, gen);
}

/**
 * The browser path, which has to be watched rather than trusted.
 *
 * Nothing in the SpeechSynthesis API reports "accepted and said nothing",
 * which is precisely what a device with no TTS engine does. The only signal
 * is that `onstart` never arrives, so that is what is timed.
 */
async function webSpeak(str, { rate, pitch, volume }, gen) {
  if (!("speechSynthesis" in window)) { ttsHealthy = false; return false; }
  const list = await getVoices();
  return new Promise((resolve) => {
    let started = false, done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      if (gen === speakGen) releaseMic();
      resolve(ok);
    };
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(str);
      const v = pickVoice(list);
      // Assigning the voice is the one line here that can throw: the setter
      // rejects anything that is not a live SpeechSynthesisVoice, and a list
      // can go stale when the engine reloads underneath us. Losing a voice
      // preference is nothing; losing the whole utterance to the catch below
      // — which is what happened — means the app goes silent and blames the
      // device for it.
      try { if (v) u.voice = v; } catch {}
      u.rate = rate; u.pitch = pitch; u.volume = volume; u.lang = v?.lang || "en-US";
      // The estimate is a floor, not a promise. A long word at rate 0.5
      // outlasts it, so keep pushing the gate forward while we know we are
      // still talking, and release it a tail after the engine says we are not.
      u.onstart = () => {
        started = true;
        ttsHealthy = true;
        if (gen === speakGen) duckMic(speechMs(str, rate) + TAIL_MS);
      };
      u.onend = () => finish(started);
      u.onerror = () => { ttsHealthy = false; finish(false); };
      speechSynthesis.speak(u);
      // Nothing started: there is no engine behind the API.
      setTimeout(() => { if (!started) { ttsHealthy = false; finish(false); } }, SILENT_MS);
      // Safety net: some engines never fire onend.
      setTimeout(() => finish(started), 400 + str.length * 120);
    } catch { ttsHealthy = false; unduckMic(); finish(false); }
  });
}

export function stopSpeaking() {
  speakGen++;
  if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
  tts.stop();
  // `cancel()` does not reliably fire `onend`, so without this the gate would
  // stay shut for the whole estimated length of a phrase nobody is saying.
  releaseMic();
}
