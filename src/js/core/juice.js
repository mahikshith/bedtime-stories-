/**
 * Game feel: hit-stop, screen shake, and the zoom punch.
 *
 * WHAT THIS IS FOR. The difference between a game that feels good and one
 * that feels flat is almost never the rules — it is whether the game reacts
 * to what you did. A coin that vanishes silently and a coin that stops time
 * for three frames, kicks the camera and pops are the same coin.
 *
 * WHY IT LIVES IN core/. Say & Jump had a hand-rolled `cam.shake` and the
 * other nine games had nothing, so the flagship twitched and everything else
 * sat still. The same reasoning as the tutorial overlay: one implementation
 * the engine drives, so a new game gets it by existing.
 *
 * THE THREE EFFECTS, and why each is shaped the way it is:
 *
 *   HIT-STOP freezes the simulation for a handful of frames on impact. It is
 *   the single cheapest way to make a collision feel like it had weight,
 *   because the brain reads the missing frames as the world flinching. It
 *   must be SHORT — beyond about 100ms it stops reading as impact and starts
 *   reading as the game hanging.
 *
 *   SHAKE uses the trauma model rather than a linear amplitude: store trauma
 *   0..1, shake by trauma SQUARED, decay trauma linearly. Squaring is the
 *   whole trick — it means a small knock barely moves the camera while a big
 *   one is unmissable, so you can afford to shake on everything without the
 *   screen constantly wobbling.
 *
 *   PUNCH is a brief zoom toward the action. Used sparingly: it is the most
 *   noticeable of the three and the first to feel cheap.
 *
 * REDUCED MOTION. Gentler, not deleted — a child who needs less movement
 * still needs to know the game heard them. Hit-stop is kept in full (it is
 * the absence of motion), shake is quartered and punch is switched off.
 */

import { save } from "./storage.js";

/** Frames, at 60Hz, that each weight of impact freezes for. */
const STOP = { light: 0, medium: 3, heavy: 5, huge: 8 };

/** Trauma added per impact weight. Squared on the way out, so these are big. */
const TRAUMA = { light: 0.22, medium: 0.4, heavy: 0.62, huge: 0.85 };

export class Juice {
  constructor() {
    /** Seconds of simulation still frozen. */
    this.stop = 0;
    /** 0..1; shake amplitude is this squared. */
    this.trauma = 0;
    /** 0..1; how far the punch zoom is currently pushed. */
    this.punchT = 0;
    this.punchAmt = 0;
    this.t = 0;
    /** Pixels of shake at full trauma. Tuned against a 720px design width. */
    this.maxOffset = 26;
    this.maxRoll = 0.035;          // radians
    this._x = 0; this._y = 0; this._roll = 0;
  }

  get reduced() {
    try { return !!save.state?.settings?.reducedMotion; } catch { return false; }
  }

  /**
   * Register an impact.
   *
   * @param {"light"|"medium"|"heavy"|"huge"} weight
   * @param {object} [o]
   * @param {boolean} [o.freeze]  false to shake without stopping time
   * @param {number}  [o.punch]   0..1 zoom punch, ignored under reduced motion
   */
  hit(weight = "medium", { freeze = true, punch = 0 } = {}) {
    const scale = this.reduced ? 0.25 : 1;
    this.trauma = Math.min(1, this.trauma + (TRAUMA[weight] ?? TRAUMA.medium) * scale);
    // Hit-stop survives reduced motion: it is the absence of movement, and it
    // is what carries the weight of the impact for a player who has asked for
    // less of everything else.
    if (freeze) this.stop = Math.max(this.stop, (STOP[weight] ?? 3) / 60);
    if (punch > 0 && !this.reduced) {
      this.punchAmt = Math.max(this.punchAmt, punch);
      this.punchT = 1;
    }
  }

  /** Shake only, no freeze — for things that are continuous rather than sharp. */
  rumble(amount = 0.2) {
    this.trauma = Math.min(1, this.trauma + amount * (this.reduced ? 0.25 : 1));
  }

  /**
   * Advance, and report how much simulated time the scene should get.
   *
   * Returns 0 while frozen, which is what makes hit-stop a one-line change at
   * the call site: the scene simply is not stepped.
   */
  update(dt) {
    this.t += dt;
    if (this.stop > 0) {
      this.stop = Math.max(0, this.stop - dt);
      // The effects themselves keep running during the freeze, or the screen
      // would be perfectly still at the exact moment it should feel violent.
      this.advanceEffects(dt);
      return 0;
    }
    this.advanceEffects(dt);
    return dt;
  }

  advanceEffects(dt) {
    // Linear decay, not exponential: trauma should reach zero and stay there,
    // and an exponential tail leaves the camera drifting imperceptibly for
    // seconds, which reads as a loose camera rather than as an impact.
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    this.punchT = Math.max(0, this.punchT - dt * 4.5);

    const s = this.trauma * this.trauma;
    if (s <= 0.0001) { this._x = this._y = this._roll = 0; return; }
    // Three offset sine waves rather than Math.random(): random per frame is
    // noise and looks like a rendering fault, while a fixed frequency reads
    // as a physical knock.
    const f = 42;
    this._x = Math.sin(this.t * f) * this.maxOffset * s;
    this._y = Math.sin(this.t * f * 1.37 + 1.7) * this.maxOffset * s * 0.8;
    this._roll = Math.sin(this.t * f * 0.83 + 3.1) * this.maxRoll * s;
  }

  /** True while the simulation is frozen. */
  get frozen() { return this.stop > 0; }

  /** Current zoom multiplier from the punch, 1 when idle. */
  get zoom() {
    if (this.punchT <= 0) return 1;
    // Ease out, so it snaps in and settles back rather than pulsing.
    const e = this.punchT * this.punchT;
    return 1 + this.punchAmt * 0.06 * e;
  }

  /**
   * Apply the shake to a context, around the centre of `view`.
   *
   * Rolls as well as translates. A pure translation reads as the picture
   * sliding; a degree or two of rotation is what makes it read as the camera
   * being knocked.
   */
  apply(ctx, view) {
    const z = this.zoom;
    if (this._x === 0 && this._y === 0 && this._roll === 0 && z === 1) return;
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    ctx.translate(cx + this._x, cy + this._y);
    if (this._roll) ctx.rotate(this._roll);
    if (z !== 1) ctx.scale(z, z);
    ctx.translate(-cx, -cy);
  }

  reset() {
    this.stop = 0; this.trauma = 0; this.punchT = 0; this.punchAmt = 0;
    this._x = this._y = this._roll = 0;
  }
}

/* --------------------------------------------------------- squash & stretch */

/**
 * The classic deformation, as a pair of scale factors that conserve area.
 *
 * Conserving area is what stops it looking like the sprite is being resized:
 * something squashed flat has to get wider by the same factor, because that
 * is what happens to a thing made of stuff. `amount` is signed — positive
 * squashes (landing), negative stretches (launching).
 *
 *   const { sx, sy } = squash(body.landImpact);
 *   ctx.scale(sx, sy);
 */
export function squash(amount) {
  const a = Math.max(-0.6, Math.min(0.6, amount));
  const sy = 1 - a;
  return { sx: 1 / sy, sy };
}

/**
 * Squash driven by vertical speed, for a body in flight.
 *
 * Stretches on the way up and on the way down, squashes on contact. Scaled so
 * a full-power jump reads clearly without the character becoming a noodle.
 */
export function flightSquash(vy, landImpact = 0, max = 0.34) {
  if (landImpact > 0.02) return squash(Math.min(max, landImpact * max * 2.2));
  const stretch = Math.max(-max, Math.min(max, -vy / 2600));
  return squash(-Math.abs(stretch));
}
