/**
 * The flock sings.
 *
 * This is the part of LocoRoco people remember without being able to name it.
 * The soundtrack is not a backing track that happens to be playing: every
 * creature on screen is a voice in it, so picking one up makes the music
 * fuller, and losing one thins it out. You hear your own progress.
 *
 * That is the whole design here, and it is worth stating plainly because it
 * inverts the usual relationship — the music is not a reward laid over the
 * game, it is a readout of the game state that happens to be beautiful. A
 * child who has never been told what the goal is will still work out that
 * more is better, because more sounds better.
 *
 * Everything is pentatonic, which is the trick that makes it safe: any subset
 * of these notes played together is consonant, so there is no combination of
 * Bloops a child can collect that sounds wrong.
 */

import { sing } from "../../core/audio.js";

/** Major pentatonic, in semitones from the root. */
const ROOT = 196.0;  // G3 — low enough that twenty voices do not shriek
const semi = (n) => ROOT * Math.pow(2, n / 12);

/**
 * The phrase, as scale degrees. Deliberately short and a little lopsided —
 * seven beats, so it never lines up the same way twice against a child's
 * rolling, and the loop is harder to get tired of than an even eight.
 */
const PHRASE = [0, 4, 7, 4, 9, 7, 2];

export class Song {
  constructor({ beat = 0.42 } = {}) {
    this.beat = beat;
    this.t = 0;
    this.step = 0;
    this.playing = false;
  }

  start() { this.playing = true; this.t = this.beat; }
  stop() { this.playing = false; }

  /**
   * @param {number} dt
   * @param {Array<{degree:number}>} voices one entry per Bloop in the flock
   * @param {number} energy 0..1 — how fast things are moving, brightens it
   * @returns {boolean} true on the frames a beat lands, so the Bloops can
   *                    open their mouths in time with what you hear
   */
  update(dt, voices, energy = 0) {
    if (!this.playing) return false;
    this.t += dt;
    if (this.t < this.beat) return false;
    this.t -= this.beat;

    const note = PHRASE[this.step % PHRASE.length];
    this.step++;

    // The lead line, always present, so a lone Bloop still has a tune.
    sing(semi(note + 12), { vol: 0.09 + energy * 0.03, dur: this.beat * 1.5 });

    // Then one voice per Bloop. Beyond eight they stop being separable, so
    // the extras thicken the ones already singing instead of adding mush:
    // the chord keeps growing to the ear without the mix falling apart.
    const singers = voices.slice(0, 8);
    const crowd = Math.max(0, voices.length - singers.length);
    singers.forEach((v, i) => {
      const dur = this.beat * (1.6 + (i % 3) * 0.2);
      sing(semi(note + v.degree), {
        vol: 0.055 + energy * 0.02,
        dur,
        // A human choir does not start together. A few milliseconds of spread
        // is the difference between a chord and one thick oscillator.
        delay: i * 0.016 + Math.random() * 0.012,
        detune: (i % 2 ? 6 : -6) + (Math.random() - 0.5) * 7,
      });
    });
    if (crowd > 0) {
      sing(semi(note + 12), {
        vol: Math.min(0.08, 0.012 * crowd),
        dur: this.beat * 2.2,
        delay: 0.03,
        detune: 9,
      });
    }
    return true;
  }
}
