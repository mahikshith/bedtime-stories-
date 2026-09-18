/**
 * Device tilt, with graceful fallbacks.
 *
 * Source order:
 *   1. DeviceOrientation (real gyro/accelerometer) — the intended input
 *   2. Pointer drag        — desktop and any device that refuses permission
 *   3. Arrow keys / WASD   — keyboard players and automated tests
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

    this.source = "none"; // 'gyro' | 'pointer' | 'keys' | 'none'
    this.granted = false;
    this.available = typeof window !== "undefined" && "DeviceOrientationEvent" in window;

    this._zero = null;     // calibration reference
    this._keys = new Set();
    this._dragging = false;
    this._dragOrigin = null;
    this._host = null;

    this._onOrient = (e) => this._handleOrientation(e);
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
  }

  /** True when the platform will demand an explicit permission gesture. */
  get needsPermission() {
    return typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function";
  }

  /**
   * Ask for the gyroscope. Must be called from a user gesture on iOS 13+.
   * @returns {Promise<boolean>} false means "use the fallback", not "broken"
   */
  async requestGyro() {
    if (!this.available) return false;
    try {
      if (this.needsPermission) {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return false;
      }
      window.addEventListener("deviceorientation", this._onOrient, true);
      this.granted = true;
      // Confirm we actually get non-null readings: some desktops fire the
      // event with empty values forever.
      return await new Promise((resolve) => {
        const t = setTimeout(() => resolve(this.source === "gyro"), 700);
        this._onFirst = () => { clearTimeout(t); resolve(true); };
      });
    } catch {
      return false;
    }
  }

  /** Enable pointer-drag steering on an element (fallback + desktop). */
  attachPointer(host) {
    this._host = host;
    host.addEventListener("pointerdown", this._pd = (e) => {
      this._dragging = true;
      this._dragOrigin = { x: e.clientX, y: e.clientY };
      host.setPointerCapture?.(e.pointerId);
      if (this.source !== "gyro") this.source = "pointer";
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
    if (this._keys.size && this.source !== "gyro") this.source = "keys";
    e.preventDefault();
  }

  _handleOrientation(e) {
    if (e.beta == null && e.gamma == null) return;
    this.source = "gyro";
    this._onFirst?.();
    this._onFirst = null;

    // beta: front-back (-180..180), gamma: left-right (-90..90)
    let beta = e.beta ?? 0;
    let gamma = e.gamma ?? 0;

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

  update(dt) {
    if (this.source === "keys" || (this._keys.size && this.source !== "gyro")) {
      this._tx = (this._keys.has("r") ? 1 : 0) - (this._keys.has("l") ? 1 : 0);
      this._ty = (this._keys.has("dn") ? 1 : 0) - (this._keys.has("u") ? 1 : 0);
    }
    // Smoothing keeps a shaky hand from turning into jitter.
    this.x = approach(this.x, this._tx, this.smoothing, dt);
    this.y = approach(this.y, this._ty, this.smoothing, dt);
  }

  destroy() {
    window.removeEventListener("deviceorientation", this._onOrient, true);
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
