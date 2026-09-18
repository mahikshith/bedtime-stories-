/**
 * Canvas host + fixed-timestep game loop.
 *
 * Games get a logical coordinate space that is independent of the device: we
 * letterbox a design-size viewport into whatever the screen is, so a level
 * authored once looks the same on a phone and a laptop. `view` carries the
 * visible logical bounds, which are wider/taller than the design size on
 * roomier screens — draw backgrounds against `view`, place gameplay against
 * the design size.
 */

const STEP = 1 / 60; // physics tick; render interpolates between ticks
const MAX_FRAME = 0.25; // clamp after a tab-switch so nothing tunnels

export class Engine {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.host element the canvas is appended to
   * @param {number} [opts.width]  design width in logical px
   * @param {number} [opts.height] design height in logical px
   */
  constructor({ host, width = 420, height = 820 }) {
    this.host = host;
    this.design = { w: width, h: height };

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    host.appendChild(this.canvas);

    /** Visible logical bounds after letterboxing. */
    this.view = { x: 0, y: 0, w: width, h: height };
    this.scale = 1;
    this.dpr = 1;

    this.scene = null;
    this.running = false;
    this.time = 0; // seconds of simulated time
    this._acc = 0;
    this._last = 0;
    this._raf = 0;

    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    window.addEventListener("orientationchange", this._onResize);
    this.resize();
  }

  resize() {
    const rect = this.host.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    // Cap DPR: kids' devices are often mid-range and 3x costs more than it
    // buys on flat vector art.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";

    // Contain-fit the design box, then expand the view to fill the letterbox
    // so backgrounds can bleed to the edges.
    this.scale = Math.min(cssW / this.design.w, cssH / this.design.h);
    const visW = cssW / this.scale;
    const visH = cssH / this.scale;
    this.view = {
      x: (this.design.w - visW) / 2,
      y: (this.design.h - visH) / 2,
      w: visW,
      h: visH,
    };

    this.scene?.resize?.(this.view);
  }

  /** Convert a DOM pointer event to logical game coordinates. */
  toLocal(ev) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) / this.scale + this.view.x,
      y: (ev.clientY - r.top) / this.scale + this.view.y,
    };
  }

  /**
   * Swap the active scene. The outgoing scene's `destroy` always runs, so
   * scenes can own listeners and timers without leaking them.
   */
  setScene(scene) {
    this.scene?.destroy?.();
    this.scene = scene;
    scene?.enter?.(this);
    scene?.resize?.(this.view);
    return scene;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._acc = 0;
    const frame = (now) => {
      if (!this.running) return;
      this._raf = requestAnimationFrame(frame);
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > MAX_FRAME) dt = MAX_FRAME;
      this._acc += dt;

      while (this._acc >= STEP) {
        this.time += STEP;
        this.scene?.update?.(STEP, this);
        this._acc -= STEP;
      }
      this.render(this._acc / STEP);
    };
    this._raf = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  render(alpha) {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.view.x, -this.view.y);
    this.scene?.draw?.(ctx, this, alpha);
    ctx.restore();
  }

  destroy() {
    this.stop();
    this.scene?.destroy?.();
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("orientationchange", this._onResize);
    this.canvas.remove();
  }
}

/* ------------------------------------------------------------------ math */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Frame-rate independent exponential smoothing. */
export const approach = (current, target, rate, dt) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

/** Shuffle a copy (Fisher–Yates). */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Axis-aligned overlap test. */
export const hit = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* ---------------------------------------------------------------- easing */
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
