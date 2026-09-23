/**
 * Microphone input: loudness, utterance shape, and (where supported) what was
 * actually said.
 *
 * The design brief is "say the word louder / hold it longer and the character
 * jumps further", so we track three things per utterance:
 *
 *   level    instantaneous loudness, 0..1, noise-floor corrected
 *   peak     the loudest moment so far in this utterance  -> jump height
 *   charge   loudness integrated over time, 0..1          -> jump distance
 *
 * A short "dad" produces a small charge; a sustained "daaaad" fills it. That
 * mapping is the whole game feel, so it lives here rather than in any one game.
 *
 * Everything degrades: with no mic permission the games fall back to hold-to-
 * charge on touch, and word checking silently turns off where
 * SpeechRecognition is missing (Firefox, most in-app browsers).
 */

import { clamp, approach } from "./engine.js";
import { speakerBusy } from "./audio.js";

const FFT = 1024;

/**
 * Grace period after the speaker goes quiet during which a transcript is
 * still treated as the app's own voice.
 *
 * A recogniser reports what it heard some tens of milliseconds after it heard
 * it, so the result for the app's last syllable arrives after the gate has
 * already opened.
 */
const RECOG_GUARD_MS = 320;

/**
 * Noise floor bounds.
 *
 * FLOOR_MAX was 0.08, which is quiet-room loud. A genuinely noisy room sits
 * above it, so the floor was pinned below the noise and every frame read as
 * speech — the meter sat at the top and nothing the child did changed it.
 * Letting it go higher means the game can still be played in a kitchen.
 */
const FLOOR_GAIN = 1.8;
const FLOOR_MIN = 0.006;
const FLOOR_MAX = 0.2;

/**
 * Four seconds of room at 60Hz, and the percentile taken from it.
 *
 * Long enough that a held word — capped at `maxUtteranceMs`, 2.6s — can never
 * be more than a fraction of the window, so the quiet fifth of it is still
 * the room rather than the child.
 */
const ROOM_FRAMES = 240;
const ROOM_PERCENTILE = 0.2;

export class VoiceInput {
  constructor({
    onThreshold = 0.22,   // level that starts an utterance
    offThreshold = 0.11,  // level that ends one (hysteresis, avoids flutter)
    onSustainMs = 90,     // how long it must STAY there before we believe it
    releaseMs = 140,      // quiet time before an utterance is considered over
    chargeRate = 1.9,     // how fast sustained sound fills the meter
    sensitivity = 1,      // per-child gain, tuned in settings
    maxUtteranceMs = 2600,// hard stop so a held shout can't charge forever
  } = {}) {
    Object.assign(this, { onThreshold, offThreshold, onSustainMs, releaseMs,
                          chargeRate, sensitivity, maxUtteranceMs });

    this.ready = false;
    this.denied = false;
    this.error = null;

    /**
     * Whether the audio graph is actually running.
     *
     * Separate from `ready` on purpose, and the distinction is what was
     * broken: a browser starts an AudioContext SUSPENDED until the page has
     * been touched, and this one is created when the level loads — before the
     * child has tapped anything. Permission was granted, getUserMedia
     * resolved, `ready` went true, and the analyser then returned silence for
     * ever. Saying the word did nothing and there was no error anywhere.
     */
    this.live = false;
    this._resumeHooked = false;
    this._resumeRetry = null;

    this.level = 0;
    this.raw = 0;
    this.peak = 0;
    this.charge = 0;
    this.speaking = false;
    this.utteranceMs = 0;

    /** Rolling noise floor so a noisy room doesn't hold the meter open. */
    this.floor = 0.012;
    this._calibrating = true;
    this._calibSamples = [];
    /**
     * The last few seconds of room, sampled only while nobody is speaking.
     *
     * The floor used to be measured ONCE at startup and then allowed to drift
     * downward only. A room that got louder after that — a television, a
     * sibling, a car — left the floor stranded underneath the new noise, the
     * meter pinned open and an utterance firing on nothing. That is the
     * "it recognizes external noises" half of the report, and no threshold
     * would have fixed it: the threshold was being measured from the wrong
     * number.
     */
    this._room = [];
    this._roomAt = 0;

    /** How long the level has been above `onThreshold` without a break. */
    this._hotMs = 0;

    /**
     * True while the app's own voice is coming out of the speaker.
     *
     * The phone's microphone is two inches from its speaker, so anything the
     * app says is by far the loudest thing in the room. Everything downstream
     * of this flag — the meter, the noise floor, the utterance detector and
     * the transcript — has to disbelieve the microphone while it is set, or
     * the game ends up reacting to itself. See the gate in audio.js.
     */
    this.muted = false;
    this._unmutedAt = -1e9;

    this._quietMs = 0;
    this._stream = null;
    this._ctx = null;
    this._analyser = null;
    this._buf = null;

    // callbacks
    this.onStart = null;      // () => void      — utterance began
    this.onUtterance = null;  // ({peak,charge,durationMs,transcript}) => void
    this.onLevel = null;      // (level, charge) => void, every frame

    // speech recognition
    this.recognition = null;
    this.transcript = "";
    this.lastTranscript = "";
    this.recognitionOn = false;
  }

  get supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Request the mic. Resolves true when listening, false when unavailable or
   * refused — callers switch to the touch fallback on false.
   */
  async start() {
    if (this.ready) return true;
    if (!this.supported) { this.error = "unsupported"; return false; }
    try {
      // Turn the processing chain off: AGC in particular flattens exactly the
      // loud/quiet difference the game is measuring.
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (err) {
      this.denied = err?.name === "NotAllowedError";
      this.error = err?.name || "failed";
      return false;
    }

    const AC = window.AudioContext || window.webkitAudioContext;
    this._ctx = new AC();
    await this._wake();
    const src = this._ctx.createMediaStreamSource(this._stream);

    // High-pass at 85 Hz kills desk rumble and handling noise without
    // touching speech.
    const hp = this._ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 85;

    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = FFT;
    this._analyser.smoothingTimeConstant = 0.15;
    src.connect(hp);
    hp.connect(this._analyser);
    this._buf = new Float32Array(this._analyser.fftSize);

    this.ready = true;
    return true;
  }

  /**
   * Get the audio graph running, and keep trying on every touch until it is.
   *
   * One attempt is not enough: at the moment the level loads there has usually
   * been no gesture on this page yet, so resume() is refused. The listeners
   * below mean the very next thing the child touches — the tap that starts the
   * level — switches the microphone on, and they never learn it was off.
   */
  async _wake() {
    if (!this._ctx) return false;
    if (this._ctx.state === "running") { this.live = true; return true; }
    try { await this._ctx.resume(); } catch {}
    this.live = this._ctx.state === "running";

    if (!this.live && !this._resumeHooked) {
      this._resumeHooked = true;
      const retry = () => {
        this._ctx?.resume().then(() => {
          this.live = this._ctx.state === "running";
          if (this.live) {
            for (const ev of ["pointerdown", "touchend", "keydown"]) {
              window.removeEventListener(ev, retry, true);
            }
            this._resumeHooked = false;
            this._resumeRetry = null;
            // The room's noise floor has to be measured with the microphone
            // actually on, not from the silence of a suspended graph.
            this._calibrating = true;
            this._calibSamples = [];
          }
        }).catch(() => {});
      };
      for (const ev of ["pointerdown", "touchend", "keydown"]) {
        window.addEventListener(ev, retry, true);
      }
      this._resumeRetry = retry;
    }
    return this.live;
  }

  /** Optional layer: check whether the child said the right word. */
  startRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || this.recognition) return false;
    try {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = "en-US";
      r.maxAlternatives = 3;
      r.onresult = (e) => {
        let txt = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          for (let a = 0; a < e.results[i].length; a++) txt += e.results[i][a].transcript + " ";
        }
        this.transcript = txt.trim().toLowerCase();
        if (this.transcript) this.lastTranscript = this.transcript;
      };
      // Recognition drops out constantly on mobile; just bring it back.
      r.onend = () => { if (this.recognitionOn) { try { r.start(); } catch {} } };
      r.onerror = (e) => { if (e.error === "not-allowed") this.recognitionOn = false; };
      r.start();
      this.recognition = r;
      this.recognitionOn = true;
      return true;
    } catch { return false; }
  }

  stopRecognition() {
    this.recognitionOn = false;
    try { this.recognition?.stop(); } catch {}
    this.recognition = null;
  }

  clearTranscript() { this.transcript = ""; this.lastTranscript = ""; }

  /** Call once per frame. */
  update(dt) {
    if (!this.ready || !this._analyser) return;

    // A suspended graph reads as perfect silence, which is indistinguishable
    // from a child who is not speaking — so check rather than assume.
    if (!this.live) {
      if (this._ctx?.state === "running") this.live = true;
      else { this._wake(); return; }
    }

    // What the app itself is putting through the speaker. Checked every frame
    // rather than pushed from audio.js, because the gate is extended from
    // several places and a subscription taken at the start of an utterance
    // would miss the extensions.
    const wasMuted = this.muted;
    this.muted = speakerBusy();
    if (wasMuted && !this.muted) this._unmutedAt = performance.now();

    if (this.muted && this.speaking) {
      // Mid-utterance when the app started talking — the child pressed HEAR IT
      // while speaking. Abandon it silently rather than firing `onUtterance`
      // with a charge that is part child and part loudspeaker.
      this.cancel();
    }

    this._analyser.getFloatTimeDomainData(this._buf);
    let sum = 0;
    for (let i = 0; i < this._buf.length; i++) sum += this._buf[i] * this._buf[i];
    const rms = Math.sqrt(sum / this._buf.length);
    this.raw = rms;

    // First half-second with no speech establishes the room's noise floor.
    //
    // NOT while the app is talking. This calibration runs when the level
    // loads, which is exactly when the game reads the target word aloud, so
    // the floor was being set to the volume of the app's own voice — after
    // which a real child sat permanently underneath it and the meter never
    // moved again. Silent, sticky, and indistinguishable from a broken
    // microphone.
    if (this._calibrating) {
      if (!this.muted) {
        this._calibSamples.push(rms);
        if (this._calibSamples.length > 30) {
          const sorted = this._calibSamples.slice().sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          this.floor = clamp(median * FLOOR_GAIN, FLOOR_MIN, FLOOR_MAX);
          this._calibrating = false;
        }
      }
    } else if (!this.muted) {
      /**
       * Keep a rolling picture of the room — INCLUDING while we think someone
       * is speaking.
       *
       * The obvious version of this only samples between utterances, so that
       * a child holding a long "aaah" cannot raise the floor into their own
       * voice. It deadlocks. Room noise loud enough to cross the threshold
       * starts an utterance that never ends, no samples are taken, the floor
       * never rises, and the meter sits pinned at the top for as long as the
       * television is on — which is exactly the fault being fixed.
       *
       * A low percentile over a long window is what makes sampling through
       * speech safe: speech has gaps and a room does not, and an utterance is
       * capped at `maxUtteranceMs` anyway, so a held shout can never be more
       * than a fraction of the window.
       */
      this._room.push(rms);
      if (this._room.length > ROOM_FRAMES) this._room.shift();
      this._roomAt += dt;
      if (this._roomAt >= 0.25 && this._room.length >= 30) {
        const elapsed = this._roomAt;
        this._roomAt = 0;
        const sorted = this._room.slice().sort((a, b) => a - b);
        const quiet = sorted[Math.floor(sorted.length * ROOM_PERCENTILE)];
        const want = clamp(quiet * FLOOR_GAIN, FLOOR_MIN, FLOOR_MAX);
        // `elapsed`, not `dt`: this runs four times a second, so passing one
        // frame's worth of time would move the floor a fifteenth as fast as
        // these rates say and the room would never be caught up with.
        //
        // Rises slowly and falls quickly. Being slow to trust a louder room
        // costs a few false starts; being slow to trust a quieter one costs
        // a child who has gone unheard since the television was switched off.
        this.floor = approach(this.floor, want, want > this.floor ? 0.9 : 1.6, elapsed);
      }
    }

    // Perceptual curve: raw RMS is bunched near zero, so a square root opens
    // up the quiet end where most children actually sit.
    const above = Math.max(0, rms - this.floor);
    // Drive the meter to zero while the app is talking instead of holding it
    // where it was, so the bar falls away during the prompt and is already at
    // the bottom by the time the child's turn starts. Freezing it would leave
    // a full bar sitting there looking like credit the child has not earned.
    const target = this.muted
      ? 0
      : clamp(Math.sqrt(above * 9.5) * this.sensitivity, 0, 1);
    // Fast attack, slower release, so the meter feels responsive but steady.
    const rate = target > this.level ? 34 : 13;
    this.level = approach(this.level, target, rate, dt);

    // Anything the recogniser picked up while the speaker was live is the
    // app's own pronunciation, not an answer. The grace period after the gate
    // opens covers the result that arrives a frame or two late.
    if (this.muted || performance.now() - this._unmutedAt < RECOG_GUARD_MS) {
      this.transcript = "";
      this.lastTranscript = "";
    }

    if (this.muted) {
      // No utterance may begin. Report the (falling) level so the UI still
      // animates, then stop: every branch below this point exists to decide
      // what the child said, and right now the only voice is ours.
      this.onLevel?.(this.level, this.charge);
      return;
    }

    if (!this.speaking) {
      /**
       * A SPIKE IS NOT A WORD.
       *
       * A door, a dropped toy, a chair on a hard floor and a hand brushing
       * the phone all clear any threshold you care to set — for about two
       * frames. Speech does not: even the shortest word a child says holds
       * energy for a tenth of a second. Waiting for the level to STAY up
       * rejects the whole class of impulse noise without making the game any
       * harder to trigger deliberately, which raising the threshold alone
       * would have done.
       */
      // Measured on the RAW level, not the smoothed one. `this.level` has a
      // deliberately slow release so the bar falls gracefully, and that alone
      // stretches a two-frame knock into something that stays above the
      // threshold for a seventh of a second — long enough to pass a sustain
      // test built on it. The smoothing is for the eye; the decision is made
      // on what the microphone actually heard this frame.
      if (target >= this.onThreshold) this._hotMs += dt * 1000;
      else this._hotMs = 0;

      if (this._hotMs >= this.onSustainMs) {
        this.speaking = true;
        this.peak = this.level;
        // Credit the sustain window rather than throwing it away: the child
        // was already speaking through it, and starting from zero would make
        // every short word quieter than it really was.
        this.utteranceMs = this._hotMs;
        this.charge = clamp(this.level * this.chargeRate * (this._hotMs / 1000), 0, 1);
        this._hotMs = 0;
        this._quietMs = 0;
        this.onStart?.();
      }
    } else {
      this.utteranceMs += dt * 1000;
      this.peak = Math.max(this.peak, this.level);
      // Charge grows with loudness AND time — the two levers the child has.
      this.charge = clamp(this.charge + this.level * this.chargeRate * dt, 0, 1);

      if (this.level < this.offThreshold) {
        this._quietMs += dt * 1000;
        if (this._quietMs >= this.releaseMs) this._end();
      } else {
        this._quietMs = 0;
      }
      if (this.utteranceMs >= this.maxUtteranceMs) {
        /**
         * An utterance that runs the full length is evidence about the room.
         *
         * The rolling window takes a few seconds to accept that a room has
         * got louder, and it has to: a percentile short enough to react
         * instantly is short enough for a child holding "saaaay" to raise the
         * floor into their own voice and cut themselves off. During those
         * seconds a television fires one utterance, hits this cap, and fires
         * another — which is the bird jumping twice at nothing.
         *
         * So take the hint. Two and a half seconds of unbroken sound is a
         * room, not a word, and the floor can be moved straight up to meet
         * it. The window is emptied with it so the old quiet samples cannot
         * immediately drag the floor back down; it refills from whatever the
         * room is actually doing now, and falls again when the room does.
         *
         * The utterance is still DELIVERED. "Say it for longer to go
         * further" is the mechanic, and a child who genuinely held a sound
         * for the full duration has earned the jump — they simply get a
         * higher floor on the next one, which costs them nothing if they
         * were the loud thing in the room.
         */
        this.floor = clamp(Math.max(this.floor, rms * FLOOR_GAIN), FLOOR_MIN, FLOOR_MAX);
        this._room.length = 0;
        this._roomAt = 0;
        this._end();
      }
    }

    this.onLevel?.(this.level, this.charge);
  }

  _end() {
    const result = {
      peak: this.peak,
      charge: this.charge,
      durationMs: this.utteranceMs,
      transcript: this.transcript || this.lastTranscript || "",
    };
    this.speaking = false;
    this._quietMs = 0;
    this._hotMs = 0;
    this.onUtterance?.(result);
    // Let the meter fall back visibly rather than snapping to zero.
    this.charge = 0;
    this.peak = 0;
  }

  /** Abandon the current utterance without firing (used on scene change). */
  cancel() {
    this.speaking = false;
    this.charge = 0;
    this.peak = 0;
    this._quietMs = 0;
    this._hotMs = 0;
  }

  stop() {
    if (this._resumeRetry) {
      for (const ev of ["pointerdown", "touchend", "keydown"]) {
        window.removeEventListener(ev, this._resumeRetry, true);
      }
      this._resumeRetry = null;
      this._resumeHooked = false;
    }
    this.stopRecognition();
    this._stream?.getTracks().forEach((t) => t.stop());
    this._ctx?.close().catch(() => {});
    this._stream = null; this._ctx = null; this._analyser = null;
    this.ready = false;
    this.live = false;
  }
}

/* ------------------------------------------------------- word matching */

const NUM_WORDS = {
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};

function normalise(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Did the child say the target word?
 *
 * Deliberately forgiving. Children's speech is mis-transcribed constantly and
 * a game that says "wrong" to a correct answer teaches a child to stop
 * trying, so we accept close matches and treat recognition as a bonus signal
 * rather than a gate.
 *
 * @returns {{match: boolean, score: number, heard: string}}
 */
export function matchWord(transcript, target) {
  const heard = normalise(transcript);
  const want = normalise(target);
  if (!heard || !want) return { match: false, score: 0, heard };

  const words = heard.split(" ").map((w) => NUM_WORDS[w] || w);
  let best = 0;
  for (const w of words) {
    if (w === want) return { match: true, score: 1, heard };
    const d = levenshtein(w, want);
    const score = 1 - d / Math.max(w.length, want.length);
    if (score > best) best = score;
  }
  // Also try the whole phrase for multi-word targets ("ice cream").
  if (want.includes(" ")) {
    const d = levenshtein(heard, want);
    best = Math.max(best, 1 - d / Math.max(heard.length, want.length));
  }
  // Short words need a stricter bar: "cat"/"bat" differ by one letter.
  const bar = want.length <= 3 ? 0.99 : want.length <= 5 ? 0.66 : 0.6;
  return { match: best >= bar, score: best, heard };
}
