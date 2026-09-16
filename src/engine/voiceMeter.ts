/**
 * Voice meter — loudness only, never a recording.
 *
 * THE RULE THAT MAKES THIS LEGAL AND FREE, in one line: we read the live
 * amplitude of the microphone stream and throw every frame away.
 *
 *  - No MediaRecorder, no buffer retained, no upload, no speech-to-text.
 *    Under COPPA a voice *recording* is personal information and needs
 *    verifiable parental consent. An amplitude reading that is computed and
 *    discarded 60 times a second is not a recording and is never stored.
 *  - Crucially this also means NO `SpeechRecognition`. On Android Chrome that
 *    API ships audio to Google's servers, which would break rule 1 (a paid /
 *    networked call in the daily loop) and put children's voices on someone
 *    else's machine. If word recognition is ever wanted it needs an on-device
 *    model, as a spike like the TTS one — not this API.
 *
 * The genre precedent does the same thing: Scream Go Hero uses signal
 * processing rather than speech recognition, ignoring linguistic content and
 * reading decibels, which is also why its input lag is milliseconds.
 */

import { unlockContext } from './audioUnlock';

/** Level is normalised 0..1 between the measured noise floor and a loud ceiling. */
export type Level = number;

export interface MeterCalibration {
  /** RMS of the room with nobody speaking. */
  floor: number;
  /** RMS treated as "as loud as we ever ask a child to be". */
  ceiling: number;
}

export const DEFAULT_CALIBRATION: MeterCalibration = { floor: 0.012, ceiling: 0.22 };

/** Root-mean-square of a frame of PCM samples in -1..1. */
export function rms(samples: Float32Array | number[]): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Converts a byte time-domain frame (0..255, 128 = silence) to -1..1. */
export function bytesToSamples(bytes: Uint8Array): Float32Array {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = (bytes[i] - 128) / 128;
  return out;
}

/**
 * Maps raw RMS onto 0..1.
 *
 * Deliberately not linear: loudness perception is roughly logarithmic, so a
 * linear map makes quiet children feel like they are doing nothing. The square
 * root lifts the bottom of the range where most of a child's voice lives.
 */
export function rmsToLevel(value: number, cal: MeterCalibration = DEFAULT_CALIBRATION): Level {
  const { floor, ceiling } = cal;
  if (ceiling <= floor) return 0;
  const clamped = Math.min(ceiling, Math.max(floor, value));
  const linear = (clamped - floor) / (ceiling - floor);
  return Number(Math.sqrt(linear).toFixed(4));
}

/** Exponential smoothing so the meter does not flicker on every frame. */
export function smooth(previous: Level, next: Level, factor = 0.35): Level {
  return Number((previous + (next - previous) * factor).toFixed(4));
}

/**
 * Calibrates from a sample of ambient RMS readings.
 *
 * A noisy kitchen and a quiet bedroom need different thresholds, and a child
 * who has to out-shout a television will simply lose. The ceiling is set from
 * the floor so the target is always reachable in the room the child is in.
 */
export function calibrateFrom(ambient: number[]): MeterCalibration {
  if (ambient.length === 0) return DEFAULT_CALIBRATION;
  const sorted = [...ambient].sort((a, b) => a - b);
  // Median, not mean: one door slam should not raise the floor for the session.
  const median = sorted[Math.floor(sorted.length / 2)];
  const floor = Math.max(0.004, median * 1.6);
  return { floor, ceiling: Math.max(floor * 4, floor + 0.08) };
}

/* ---------- syllable bursts ---------- */

export interface BurstOptions {
  /** Level that counts as "voice on". */
  onThreshold?: number;
  /** Level that counts as "voice off". Lower than on, to avoid chatter. */
  offThreshold?: number;
  /** Frames a burst must last to count, so a cough is not a syllable. */
  minFrames?: number;
}

/**
 * Counts vocal bursts in a stream of levels.
 *
 * This is what makes the game teach something. Rewarding volume alone lets a
 * child shout "aaah" and win without ever saying the word; requiring one burst
 * per syllable means "but-ter-fly" is genuinely three efforts. Syllable
 * segmentation is a real phonological-awareness skill and it sits directly
 * alongside the phonics pillar.
 *
 * Hysteresis (separate on/off thresholds) stops a wobbling voice registering as
 * several syllables.
 */
export function countBursts(levels: Level[], options: BurstOptions = {}): number {
  const on = options.onThreshold ?? 0.35;
  const off = options.offThreshold ?? 0.18;
  const minFrames = options.minFrames ?? 2;

  let count = 0;
  let inBurst = false;
  let frames = 0;

  for (const level of levels) {
    if (!inBurst && level >= on) {
      inBurst = true;
      frames = 1;
    } else if (inBurst) {
      if (level > off) {
        frames++;
      } else {
        if (frames >= minFrames) count++;
        inBurst = false;
        frames = 0;
      }
    }
  }
  if (inBurst && frames >= minFrames) count++;
  return count;
}

/** Syllables in a word, reused from the rhyme engine's estimator. */
export { countSyllables } from './rhyme';

/* ---------- breath ---------- */

export interface BreathOptions {
  /** Below this is room noise, not a breath. */
  minLevel?: number;
  /** Above this is a shout. A breath is gentle by definition. */
  maxLevel?: number;
  /** Frames it must be sustained for. */
  minFrames?: number;
  /** Coefficient of variation above which the sound is too bumpy to be a breath. */
  maxVariation?: number;
}

export interface BreathResult {
  isBreath: boolean;
  /** Longest run of frames that stayed in the breath band. */
  frames: number;
  /** Spread of that run, relative to its own mean. Lower is smoother. */
  variation: number;
}

/**
 * Tells an out-breath from a voice.
 *
 * The distinguishing feature is not loudness, it is *steadiness*. Speech is
 * syllabic — it bumps up and down several times a second — while a breath is a
 * flat sustained hiss. So the test is a run of frames inside a gentle band with
 * a low coefficient of variation.
 *
 * This matters for the wind-down game specifically: if shouting worked, the one
 * calm thing in the app would become another loud thing, and a child who
 * shrieks at the screen at bedtime is the opposite of the point.
 */
export function detectBreath(levels: Level[], options: BreathOptions = {}): BreathResult {
  const minLevel = options.minLevel ?? 0.08;
  const maxLevel = options.maxLevel ?? 0.55;
  const minFrames = options.minFrames ?? 12;
  const maxVariation = options.maxVariation ?? 0.38;

  let best: Level[] = [];
  let run: Level[] = [];
  for (const level of levels) {
    if (level >= minLevel && level <= maxLevel) {
      run.push(level);
      if (run.length > best.length) best = run;
    } else {
      run = [];
    }
  }

  if (best.length === 0) return { isBreath: false, frames: 0, variation: 1 };

  const mean = best.reduce((a, b) => a + b, 0) / best.length;
  const variance = best.reduce((a, b) => a + (b - mean) ** 2, 0) / best.length;
  const variation = mean > 0 ? Math.sqrt(variance) / mean : 1;

  return {
    isBreath: best.length >= minFrames && variation <= maxVariation,
    frames: best.length,
    variation: Number(variation.toFixed(4)),
  };
}

/* ---------- scoring an attempt ---------- */

export interface Attempt {
  /** Every level captured while the child was speaking. */
  levels: Level[];
  /** 'leap' rewards one big voice; 'syllable' wants one burst per beat. */
  mode: 'leap' | 'syllable';
  /** Beats the word needs, in syllable mode. */
  syllables: number;
  /** Level the voice has to reach, in leap mode. */
  target: number;
}

export interface AttemptResult {
  landed: boolean;
  peak: Level;
  bursts: number;
}

/** A burst already needs this much voice, so anything quieter counts for nothing. */
const AUDIBLE = 0.3;

/**
 * Scores one turn.
 *
 * Extracted from the component so the rule that decides whether a child
 * succeeded can be tested without a microphone — which matters, because no CI
 * runner has one, and neither does a headless browser.
 *
 * The audible floor in syllable mode is mostly belt-and-braces: `countBursts`
 * will not register anything below its own ON threshold, which is already
 * higher. It earns its place by covering the degenerate case of a word that
 * reports zero syllables, where "enough beats" would otherwise be satisfied by
 * silence.
 */
export function scoreAttempt(attempt: Attempt): AttemptResult {
  const { levels, mode, syllables, target } = attempt;
  const peak = levels.reduce((m, l) => Math.max(m, l), 0);
  const bursts = countBursts(levels);
  const landed =
    mode === 'syllable'
      ? bursts >= Math.max(1, syllables) && peak >= AUDIBLE
      : peak >= target;
  return { landed, peak, bursts };
}

/**
 * How loud this word needs to be.
 *
 * A longer word asks for a little more voice, but the ceiling is capped so a
 * five-syllable word never becomes a shouting match.
 */
export function targetForWord(syllables: number, mode: 'leap' | 'syllable'): number {
  if (mode === 'syllable') return 0.42;
  return Math.min(0.75, 0.4 + syllables * 0.08);
}

/* ---------- live meter ---------- */

export interface VoiceMeterHandle {
  /** Current smoothed level, 0..1. */
  level(): Level;
  /** Levels since the last call, for burst counting. Cleared on read. */
  drain(): Level[];
  stop(): void;
}

export type MicPermission = 'granted' | 'denied' | 'unsupported';

/** Raised when the microphone exists but could not be opened. */
export class MicUnavailableError extends Error {}

/**
 * Opens the microphone, degrading rather than failing.
 *
 * The processing hints are expressed as `ideal`, never as hard constraints: a
 * device that cannot honour them (plenty of Android hardware, and Chromium's
 * fake capture device) rejects the whole request with OverconstrainedError, and
 * the game dies for a reason that has nothing to do with permission. Asked as
 * preferences they are simply ignored.
 *
 * `autoGainControl` matters most — AGC normalises volume, which would flatten
 * the exact signal the game measures — but a working mic without it beats no
 * mic at all, so there is a plain `audio: true` retry behind it.
 */
async function openMicrophone(): Promise<MediaStream> {
  const preferred: MediaStreamConstraints = {
    audio: {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: false },
    },
  };
  try {
    return await navigator.mediaDevices.getUserMedia(preferred);
  } catch (err) {
    // A refusal is final; anything else is worth one plain retry.
    if (err instanceof DOMException && err.name === 'NotAllowedError') throw err;
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (retryErr) {
      if (retryErr instanceof DOMException && retryErr.name === 'NotAllowedError') throw retryErr;
      throw new MicUnavailableError('The microphone could not be opened.');
    }
  }
}

export function isMicSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof (window.AudioContext ?? (window as never as { webkitAudioContext?: unknown }).webkitAudioContext) !==
      'undefined'
  );
}

/**
 * Opens the microphone and starts reading amplitude.
 *
 * The returned handle owns the stream; call stop() to release the mic and the
 * recording indicator. Nothing here retains audio: each frame is read into a
 * reusable array, reduced to one number, and overwritten on the next frame.
 */
export async function startVoiceMeter(
  cal: MeterCalibration = DEFAULT_CALIBRATION,
): Promise<VoiceMeterHandle> {
  const stream = await openMicrophone();

  const Ctx =
    window.AudioContext ??
    (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Ctx();
  // On iOS a context built outside a user gesture starts suspended, and the
  // analyser below then reports perfect silence instead of failing — a dead
  // meter with the permission granted. Desktop never reproduces it.
  await unlockContext(context);
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  const frame = new Uint8Array(analyser.fftSize);
  let current: Level = 0;
  let history: Level[] = [];
  let raf = 0;
  let running = true;

  const tick = () => {
    if (!running) return;
    analyser.getByteTimeDomainData(frame);
    const next = rmsToLevel(rms(bytesToSamples(frame)), cal);
    current = smooth(current, next);
    // Bounded: a long session must not grow an unbounded array.
    history.push(current);
    if (history.length > 600) history = history.slice(-600);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    level: () => current,
    drain: () => {
      const out = history;
      history = [];
      return out;
    },
    stop: () => {
      running = false;
      cancelAnimationFrame(raf);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void context.close();
    },
  };
}
