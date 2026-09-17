import type { Level } from './voiceMeter';

/**
 * The microphone-free way to play the voice games.
 *
 * Every voice game dead-ended when there was no microphone: a wall that said
 * "Lumi can't hear right now" and a button back to the menu. That is wrong
 * twice over. A child who is not allowed the microphone, or whose parent said
 * no, or who is playing inside an embedded page where `getUserMedia` is simply
 * blocked, still wants to play the game — and Echo Cave already proved the
 * games survive losing the microphone, because it only ever wanted the timing.
 *
 * Rather than fork every game, this turns a held press into the same stream of
 * levels the meter would have produced, so `detectBreath`, `countBursts` and
 * `scoreAttempt` — all of them already tested — score a press exactly as they
 * score a voice. The game logic does not learn that the microphone is missing.
 *
 * The shape is a real one: a fast attack, a plateau that sags slightly the way
 * a held breath does, and a quick release.
 */

/** Frames per second the live meter samples at; matched so thresholds carry over. */
const FPS = 60;
/**
 * Where a held press sits by default: comfortably over every ON threshold.
 *
 * There is no single height that serves every game, and that is not a flaw in
 * the stand-in — it is the games disagreeing about what they are listening for.
 * A leap wants a big voice and its target climbs to 0.75. A breath is defined
 * as *gentle*, and `detectBreath` rejects anything above 0.55 precisely so that
 * shouting cannot clear the one calm game in the app. A press pitched loud
 * enough to leap is, correctly, too loud to be a breath.
 */
const PLATEAU = 0.78;

/** Pitched inside the breath band, well clear of both its edges. */
export const BREATH_LEVEL = 0.36;
/** Seconds to reach the plateau, and to fall from it. */
const ATTACK = 0.12;
const RELEASE = 0.1;

/**
 * The level stream a press of `seconds` stands in for.
 *
 * A press shorter than the attack never reaches full height, which is what
 * makes a stab read as a stab: the same rule that stops a cough counting as a
 * breath also stops a tap counting as one, with no special case for either.
 */
export function pressSamples(seconds: number, level = PLATEAU, fps = FPS): Level[] {
  const plateau = level;
  const total = Math.max(0, seconds);
  const frames = Math.round(total * fps);
  const out: Level[] = [];
  for (let i = 0; i < frames; i += 1) {
    const t = i / fps;
    const left = total - t;
    let height = plateau;
    if (t < ATTACK) height = plateau * (t / ATTACK);
    if (left < RELEASE) height = Math.min(height, plateau * (left / RELEASE));
    // A held breath sags. Without it a press is a perfect rectangle, which is
    // the one shape a voice never makes.
    out.push(Math.max(0, height - Math.min(plateau * 0.12, t * 0.02)));
  }
  return out;
}

/**
 * The level stream for `count` separate taps, for the syllable games.
 *
 * Each tap is a short press with a gap after it, so `countBursts` finds exactly
 * as many bursts as there were taps.
 */
export function tapSamples(count: number, fps = FPS): Level[] {
  const out: Level[] = [];
  for (let i = 0; i < Math.max(0, Math.round(count)); i += 1) {
    out.push(...pressSamples(0.22, PLATEAU, fps));
    // Silence between, long enough for the hysteresis to close the burst.
    for (let s = 0; s < Math.round(0.12 * fps); s += 1) out.push(0);
  }
  return out;
}
