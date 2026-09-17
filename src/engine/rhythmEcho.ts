/**
 * Echo Cave's rhythm.
 *
 * A call-and-response game: the cave taps a pattern, the child claps or says it
 * back, and the cave answers. It is the only voice game that is about *timing*
 * rather than loudness or shape, which makes it the one that works for a child
 * who is shy about being heard — a tap on the screen echoes just as well as a
 * voice, and the cave cannot tell the difference.
 *
 * Nothing here ever touches a recognizer. The microphone supplies a single
 * number, an amplitude, and what this file does with it is find the moments it
 * went up. A rhythm is timing, and timing is all we take.
 */

/** Beat onsets in seconds, always starting at zero. */
export type Pattern = number[];

/**
 * Five patterns, built from one short beat and one exactly twice as long.
 *
 * The first draft used a long beat one and a half times the short one, and a
 * flat even clap scored inside tolerance against it — the shape was not there
 * to be heard. A 2:1 ratio is a quarter note against a half note, which is the
 * coarsest rhythmic distinction there is and the first one children reproduce.
 *
 * Level 1 is two taps a comfortable half-second apart, which is the rhythm of
 * saying a child's own name, and clearable by anyone who can clap twice.
 */
export const PATTERNS: Pattern[] = [
  [0, 0.6],
  [0, 0.5, 1.0],
  [0, 0.4, 0.8, 1.6],
  [0, 0.3, 0.6, 1.2, 1.5],
  [0, 0.3, 0.9, 1.2, 1.5, 2.1],
];

export function patternFor(level: number): Pattern {
  return PATTERNS[Math.max(0, Math.min(PATTERNS.length - 1, Math.round(level) - 1))];
}

/* ---------- finding the claps ---------- */

export interface OnsetState {
  on: boolean;
  frames: number;
  /** When the current burst started, so an onset is reported at its attack. */
  startedAt: number;
  lastOnset: number;
}

export const NO_ONSET: OnsetState = { on: false, frames: 0, startedAt: 0, lastOnset: -Infinity };

export interface OnsetOptions {
  onThreshold?: number;
  offThreshold?: number;
  /** Frames a burst must survive before it counts, so a click is not a clap. */
  minFrames?: number;
  /** Seconds before another onset can be reported. Two claps cannot be 30ms apart. */
  refractory?: number;
}

/**
 * Feeds one amplitude reading in, and gets an onset time out when one starts.
 *
 * Reported at the moment the burst *began*, not when it was confirmed. A
 * rhythm judged on when a sound was confirmed is a rhythm judged late by
 * however many frames the confirmation took, and every clap would drift the
 * same direction.
 */
export function feedLevel(
  state: OnsetState,
  level: number,
  t: number,
  options: OnsetOptions = {},
): { state: OnsetState; onset: number | null } {
  const on = options.onThreshold ?? 0.34;
  const off = options.offThreshold ?? 0.17;
  const minFrames = options.minFrames ?? 2;
  const refractory = options.refractory ?? 0.16;

  if (!state.on) {
    if (level >= on) return { state: { ...state, on: true, frames: 1, startedAt: t }, onset: null };
    return { state, onset: null };
  }

  if (level <= off) return { state: { ...state, on: false, frames: 0 }, onset: null };

  const frames = state.frames + 1;
  if (frames === minFrames && state.startedAt - state.lastOnset >= refractory) {
    return { state: { ...state, frames, lastOnset: state.startedAt }, onset: state.startedAt };
  }
  return { state: { ...state, frames }, onset: null };
}

/* ---------- judging the echo ---------- */

export interface EchoScore {
  taps: number;
  expected: number;
  /** 0..1 on how well the gaps matched. 1 when the pattern has only one gap to match. */
  accuracy: number;
  ok: boolean;
}

/**
 * Scores an echo on its **gaps**, never its absolute times.
 *
 * A child does not start clapping the instant the cave stops, and should not
 * be marked down for thinking first. What has to match is the shape: long-
 * short-short is long-short-short whether it takes two seconds or three. So
 * the gaps are normalised by the echo's own total length before comparison,
 * which also means clapping the whole pattern a bit fast still counts.
 */
export function scoreEcho(pattern: Pattern, taps: number[], tolerance = 0.3): EchoScore {
  const expected = pattern.length;
  if (taps.length !== expected) {
    return { taps: taps.length, expected, accuracy: 0, ok: false };
  }
  if (expected < 3) {
    // Two taps have one gap, and one gap normalised by itself is always 1.
    // There is no shape to get wrong, so getting the count right IS the echo.
    return { taps: taps.length, expected, accuracy: 1, ok: true };
  }

  const gaps = (times: number[]) => times.slice(1).map((t, i) => t - times[i]);
  const norm = (list: number[]) => {
    const total = list.reduce((a, b) => a + b, 0);
    return total > 0 ? list.map((g) => g / total) : list.map(() => 0);
  };

  const want = norm(gaps(pattern));
  const got = norm(gaps(taps));
  const worst = Math.max(...want.map((w, i) => Math.abs(w - got[i]) / Math.max(w, 1e-6)));

  return {
    taps: taps.length,
    expected,
    accuracy: Math.max(0, 1 - worst),
    ok: worst <= tolerance,
  };
}

/** How long the cave's own call takes, plus a beat of silence after it. */
export function callSeconds(pattern: Pattern): number {
  return pattern[pattern.length - 1] + 0.7;
}
