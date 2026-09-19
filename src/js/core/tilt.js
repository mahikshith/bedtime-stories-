/**
 * Device tilt, with graceful fallbacks.
 *
 * WHY THERE ARE THREE SENSOR PATHS AND NOT ONE.
 *
 * Tilt Maze came back from a real Android phone as "the tilt is not working
 * at all", having fallen through to drag-to-steer. The cause is a hole in the
 * obvious implementation: it listened only for `deviceorientation`, and
 * discarded any event whose `beta`/`gamma` were null — which is precisely
 * what a phone with no GYROSCOPE delivers. Plenty of cheap Android handsets
 * have an accelerometer and no gyro. They fire the event dutifully, forever,
 * with nothing in it. The listener was attached, events arrived, every one
 * was thrown away, and the detection timeout concluded there was no sensor.
 *
 * So all three sources are now started together and the first one to deliver
 * a usable sample wins:
 *
 *   1. `deviceorientation`         — best, when there is a real gyro
 *   2. `deviceorientationabsolute` — some Androids only ever fire this one
 *   3. `devicemotion` gravity      — works on ANY device with an
 *                                    accelerometer, which is all of them
 *
 * and if none of them produces a sample, drag and the arrow keys still do.
 *
 * Output is always the same: `x` and `y` in -1..1, where +x is "tilt right"
 * and +y is "tilt away from you / forward".
 *
 * Tilt is captured relative to however the child is holding the phone when
 * the level starts, because kids play lying down, in a car seat, upside
 * down — an absolute reference would be unplayable.
 */

import { clamp, approach } from "./engine.js";

export class TiltInput {
  /**
   * @param {object} o
   * @param {number} [o.range]  degrees of tilt that map to full deflection
   * @param {number} [o.dead]   degrees ignored around centre
   */
  constructor({ range = 26, dead = 1.6, smoothing = 22 } = {}) {
    this.range = range;
    this.dead = dead;
    this.smoothing = smoothing;

    this.x = 0;
    this.y = 0;
    this._tx = 0;
    this._ty = 0;

    this.source = "none"; // 'gyro' | 'motion' | 'pointer' | 'keys' | 'none'
    this.granted = false;
    /** Which sensor API actually delivered, for the on-screen diagnostic. */
    this.sensor = null;
    this.available = typeof window !== "undefined" &&
      ("DeviceOrientationEvent" in window || "DeviceMotionEvent" in window);

    this._zero = null;     // calibration reference
    this._keys = new Set();
    this._dragging = false;
    this._dragOrigin = null;
    this._host = null;

    this._onOrient = (e) => this._handleOrientation(e, "deviceorientation");
    this._onOrientAbs = (e) => this._handleOrientation(e, "deviceorientationabsolute");
    this._onMotion = (e) => this._handleMotion(e);
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
  }

  /** True when the platform will demand an explicit permission gesture. */
  get needsPermission() {
    return (typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function") ||
           (typeof DeviceMotionEvent !== "undefined" &&
            typeof DeviceMotionEvent.requestPermission === "function");
  }

  /**
   * Ask for the gyroscope. Must be called from a user gesture on iOS 13+.
   * @returns {Promise<boolean>} false means "use the fallback", not "broken"
   */
  async requestGyro() {
    if (!this.available) return false;
    try {
      // iOS 13+ gates both events behind a gesture-bound prompt, and the two
      // are granted separately. Ask for whichever exposes the prompt; a
      // refusal on one does not stop us trying the other.
      if (this.needsPermission) {
        const asks = [];
        if (typeof DeviceOrientationEvent?.requestPermission === "function") {
          asks.push(DeviceOrientationEvent.requestPermission().catch(() => "denied"));
        }
        if (typeof DeviceMotionEvent?.requestPermission === "function") {
          asks.push(DeviceMotionEvent.requestPermission().catch(() => "denied"));
        }
        const results = await Promise.all(asks);
        if (!results.includes("granted")) return false;
      }

      // Start every source at once rather than in sequence. Trying them one
      // at a time means waiting out a timeout per source, and the one that
      // fails is the one that fails SLOWLY — it keeps firing empty events, so
      // it never errors, it just never says anything useful.
      window.addEventListener("deviceorientation", this._onOrient, true);
      window.addEventListener("deviceorientationabsolute", this._onOrientAbs, true);
      window.addEventListener("devicemotion", this._onMotion, true);
      this.granted = true;

      // Long enough for a cold sensor to spin up — a couple of hundred
      // milliseconds is normal and 700ms was cutting it fine — but resolved
      // the instant a real sample lands, so a working phone waits for none of it.
      return await new Promise((resolve) => {
        const t = setTimeout(() => resolve(this.live), 1600);
        this._onFirst = () => { clearTimeout(t); resolve(true); };
      });
    } catch {
      return false;
    }
  }

  /** True once a sensor has actually delivered a usable reading. */
  get live() { return this.source === "gyro" || this.source === "motion"; }

  /** Enable pointer-drag steering on an element (fallback + desktop). */
  attachPointer(host) {
    this._host = host;
    host.addEventListener("pointerdown", this._pd = (e) => {
      this._dragging = true;
      this._dragOrigin = { x: e.clientX, y: e.clientY };
      host.setPointerCapture?.(e.pointerId);
      if (!this.live) this.source = "pointer";
    });
    host.addEventListener("pointermove", this._pm = (e) => {
      if (!this._dragging || !this._dragOrigin) return;
      // 110px of drag == full tilt; comfortable for a thumb.
      this._tx = clamp((e.clientX - this._dragOrigin.x) / 110, -1, 1);
      this._ty = clamp((e.clientY - this._dragOrigin.y) / 110, -1, 1);
    });
    const end = () => { this._dragging = false; this._dragOrigin = null; if (this.source === "pointer") { this._tx = 0; this._ty = 0; } };
    host.addEventListener("pointerup", this._pu = end);
    host.addEventListener("pointercancel", this._pc = end);
    host.addEventListener("pointerleave", this._pl = end);
  }

  attachKeys() {
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  }

  _key(e, down) {
    const k = e.key.toLowerCase();
    const map = {
      arrowleft: "l", a: "l", arrowright: "r", d: "r",
      arrowup: "u", w: "u", arrowdown: "dn", s: "dn",
    };
    const m = map[k];
    if (!m) return;
    down ? this._keys.add(m) : this._keys.delete(m);
    if (this._keys.size && !this.live) this.source = "keys";
    e.preventDefault();
  }

  _handleOrientation(e, which) {
    // A gyro-less phone fires this event forever with nothing in it. Ignoring
    // those is right — but it is why `devicemotion` has to be running too,
    // because otherwise this is the only thing listening and it never speaks.
    if (e.beta == null && e.gamma == null) return;
    // Don't let a second source fight the one already working.
    if (this.sensor && this.sensor !== which) return;
    this._accept(which, "gyro", e.beta ?? 0, e.gamma ?? 0);
  }

  /**
   * Tilt from the gravity vector, for devices with no gyroscope.
   *
   * `accelerationIncludingGravity` is (0, 0, +9.81) with the phone flat on a
   * table, screen up. Standing it upright puts gravity on +y, and dropping
   * the right-hand edge puts it on -x, which is where these two come from:
   *
   *   beta  = atan2(y, z)              flat 0°, upright +90°
   *   gamma = atan2(-x, hypot(y, z))   flat 0°, right edge down +90°
   *
   * Those are the same two numbers, in the same units and the same signs, as
   * `deviceorientation` reports — so everything downstream cannot tell which
   * sensor it is being fed by, which is the point.
   */
  _handleMotion(e) {
    if (this.sensor && this.sensor !== "devicemotion") return;
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null || g.z == null) return;
    // A device in free-fall, or a stub firing zeroes, carries no "down".
    if (Math.hypot(g.x, g.y, g.z) < 1.5) return;
    const R = 180 / Math.PI;
    const beta = Math.atan2(g.y, g.z) * R;
    const gamma = Math.atan2(-g.x, Math.hypot(g.y, g.z)) * R;
    this._accept("devicemotion", "motion", beta, gamma);
  }

  /** Shared tail of both sensor paths: orient, calibrate, deflect. */
  _accept(sensor, source, rawBeta, rawGamma) {
    this.sensor = sensor;
    this.source = source;
    this._onFirst?.();
    this._onFirst = null;

    let beta = rawBeta, gamma = rawGamma;

    // Landscape: the axes swap and one flips.
    const angle = (screen.orientation?.angle ?? window.orientation ?? 0);
    if (angle === 90) { const t = beta; beta = -gamma; gamma = t; }
    else if (angle === -90 || angle === 270) { const t = beta; beta = gamma; gamma = -t; }

    if (!this._zero) this._zero = { beta, gamma };

    const dB = this._applyDead(beta - this._zero.beta);
    const dG = this._applyDead(gamma - this._zero.gamma);
    this._tx = clamp(dG / this.range, -1, 1);
    this._ty = clamp(dB / this.range, -1, 1);
  }

  _applyDead(v) {
    if (Math.abs(v) <= this.dead) return 0;
    return v - Math.sign(v) * this.dead;
  }

  /** Re-zero to the current pose. Call when a level starts or on "recentre". */
  calibrate() { this._zero = null; this._tx = 0; this._ty = 0; this.x = 0; this.y = 0; }

  /** What the player is actually steering with, for the on-screen hint. */
  describe() {
    if (this.source === "gyro") return "gyro";
    if (this.source === "motion") return "gyro";   // a child cannot tell, and should not have to
    if (this.source === "keys") return "keys";
    return "drag";
  }

  update(dt) {
    if (this.source === "keys" || (this._keys.size && !this.live)) {
      this._tx = (this._keys.has("r") ? 1 : 0) - (this._keys.has("l") ? 1 : 0);
      this._ty = (this._keys.has("dn") ? 1 : 0) - (this._keys.has("u") ? 1 : 0);
    }
    // Smoothing keeps a shaky hand from turning into jitter.
    this.x = approach(this.x, this._tx, this.smoothing, dt);
    this.y = approach(this.y, this._ty, this.smoothing, dt);
  }

  destroy() {
    window.removeEventListener("deviceorientation", this._onOrient, true);
    window.removeEventListener("deviceorientationabsolute", this._onOrientAbs, true);
    window.removeEventListener("devicemotion", this._onMotion, true);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    const h = this._host;
    if (h) {
      h.removeEventListener("pointerdown", this._pd);
      h.removeEventListener("pointermove", this._pm);
      h.removeEventListener("pointerup", this._pu);
      h.removeEventListener("pointercancel", this._pc);
      h.removeEventListener("pointerleave", this._pl);
    }
  }
}
