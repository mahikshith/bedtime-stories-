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

/* ---------- live meter ---------- */

export interface VoiceMeterHandle {
  /** Current smoothed level, 0..1. */
  level(): Level;
  /** Levels since the last call, for burst counting. Cleared on read. */
  drain(): Level[];
  stop(): void;
}

export type MicPermission = 'granted' | 'denied' | 'unsupported';

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
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      // Keep the child's own volume intact; AGC would flatten the thing we measure.
      autoGainControl: false,
    },
  });

  const Ctx =
    window.AudioContext ??
    (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Ctx();
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
