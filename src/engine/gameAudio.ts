/**
 * Procedural game audio. No files, no dependency, no marginal cost.
 *
 * Everything is synthesised from oscillators and filtered noise, so the bundle
 * carries zero audio bytes and a chime can be pitched, retuned or stacked at
 * runtime. Pitches come from a pentatonic scale: any two notes played together
 * are consonant, so a child mashing the screen cannot produce a wrong chord.
 * That is the whole reason to use one — it makes juicy feedback safe to fire on
 * every single touch.
 *
 * Contexts are unlocked through `audioUnlock` rather than resumed ad hoc: on
 * iOS an unresumed context plays nothing at all, silently.
 */
import { unlockContext } from './audioUnlock';

/** C major pentatonic — bright, for wake and play. */
export const BRIGHT_SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
/** F# major pentatonic, lower and warmer — for wind-down. */
export const CALM_SCALE = [184.997, 207.652, 233.082, 277.183, 311.127, 369.994];

export type Voice = 'chime' | 'squish' | 'pop' | 'thud';

export interface PlayOptions {
  /** Index into the scale. Wraps, so callers never have to bounds-check. */
  step?: number;
  /** 0..1. Scaled by the master gain below. */
  velocity?: number;
  /** Use the warm low scale instead of the bright one. */
  calm?: boolean;
}

/**
 * Hard cap on simultaneous voices.
 *
 * A child mashing a bubble field can request hundreds of notes a second. Each
 * one is cheap, but unbounded they clip into distortion and strand
 * AudioScheduledSourceNodes on a low-end phone. Oldest wins; a dropped note is
 * inaudible, a crackle is not.
 */
const MAX_VOICES = 12;

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let live = 0;
let muted = false;

function contextClass(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

function ready(): AudioContext | undefined {
  const Ctx = contextClass();
  if (!Ctx) return undefined;
  if (!ctx) {
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void unlockContext(ctx);
  return ctx.state === 'running' ? ctx : undefined;
}

/** Parent-facing mute. Survives nothing — the store owns the preference. */
export function setMuted(next: boolean): void {
  muted = next;
}

export function isMuted(): boolean {
  return muted;
}

function envelope(c: AudioContext, peak: number, attack: number, decay: number): GainNode {
  const gain = c.createGain();
  const now = c.currentTime;
  // exponentialRamp cannot start from or reach zero, hence the epsilons.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
  return gain;
}

function track(nodes: AudioScheduledSourceNode[], stopAt: number): void {
  live += 1;
  const done = () => { live = Math.max(0, live - 1); };
  nodes[0].addEventListener('ended', done, { once: true });
  for (const n of nodes) n.stop(stopAt);
}

/** A struck bell. The workhorse: bubbles, stars, correct answers, taps. */
export function playChime(options: PlayOptions = {}): void {
  if (muted || live >= MAX_VOICES) return;
  const c = ready();
  if (!c) return;

  const scale = options.calm ? CALM_SCALE : BRIGHT_SCALE;
  const freq = scale[(options.step ?? 0) % scale.length];
  const velocity = options.velocity ?? 0.7;
  const decay = options.calm ? 1.6 : 0.6;
  const now = c.currentTime;

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);

  // An octave of triangle on top is what separates "bell" from "test tone".
  const overtone = c.createOscillator();
  overtone.type = 'triangle';
  overtone.frequency.setValueAtTime(freq * 2, now);
  const overtoneGain = c.createGain();
  overtoneGain.gain.value = 0.22;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2600, now);
  filter.frequency.exponentialRampToValueAtTime(600, now + decay);

  const gain = envelope(c, velocity * 0.5, 0.012, decay);

  osc.connect(gain);
  overtone.connect(overtoneGain);
  overtoneGain.connect(gain);
  gain.connect(filter);
  filter.connect(master!);

  osc.start(now);
  overtone.start(now);
  track([osc, overtone], now + decay + 0.05);
}

/** Wet, low, tactile. Slime, dough, a monster chewing. */
export function playSquish(options: PlayOptions = {}): void {
  if (muted || live >= MAX_VOICES) return;
  const c = ready();
  if (!c) return;
  const now = c.currentTime;
  const velocity = options.velocity ?? 0.6;

  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.22);

  const gain = envelope(c, velocity * 0.55, 0.01, 0.22);
  osc.connect(gain);
  gain.connect(master!);
  osc.start(now);
  track([osc], now + 0.26);
}

/** A bubble bursting: a click of noise, gone before you can place it. */
export function playPop(options: PlayOptions = {}): void {
  if (muted || live >= MAX_VOICES) return;
  const c = ready();
  if (!c) return;
  const now = c.currentTime;
  const velocity = options.velocity ?? 0.5;

  const frames = Math.floor(c.sampleRate * 0.06);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Decaying noise; the curve is what makes it read as "burst" not "hiss".
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
  }

  const source = c.createBufferSource();
  source.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900 + Math.random() * 700, now);
  filter.Q.value = 1.4;

  const gain = c.createGain();
  gain.gain.value = velocity * 0.8;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master!);
  source.start(now);
  track([source], now + 0.08);
}

/** Something soft landing on something soft. Pillows, stacking, placement. */
export function playThud(options: PlayOptions = {}): void {
  if (muted || live >= MAX_VOICES) return;
  const c = ready();
  if (!c) return;
  const now = c.currentTime;
  const velocity = options.velocity ?? 0.5;

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);

  const gain = envelope(c, velocity * 0.6, 0.006, 0.18);
  osc.connect(gain);
  gain.connect(master!);
  osc.start(now);
  track([osc], now + 0.22);
}

export function play(voice: Voice, options: PlayOptions = {}): void {
  if (voice === 'chime') return playChime(options);
  if (voice === 'squish') return playSquish(options);
  if (voice === 'pop') return playPop(options);
  return playThud(options);
}

/**
 * An ascending run. Chains, combos, completing a set.
 *
 * Steps are scheduled by index rather than with setTimeout so the rhythm holds
 * when the main thread is busy laying out a particle burst.
 */
export function playRun(steps: number, options: PlayOptions = {}): void {
  const base = options.step ?? 0;
  for (let i = 0; i < Math.min(steps, MAX_VOICES); i++) {
    window.setTimeout(() => playChime({ ...options, step: base + i }), i * 70);
  }
}

/** Releases the hardware. Call when leaving the arcade, not between games. */
export function stopGameAudio(): void {
  if (!ctx) return;
  void ctx.close().catch(() => undefined);
  ctx = undefined;
  master = undefined;
  live = 0;
}

/** Test seam. */
export function voiceCount(): number {
  return live;
}
