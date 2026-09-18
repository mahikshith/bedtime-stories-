/**
 * Particles and floating text.
 *
 * One pooled array, drawn in a single pass. Kept deliberately small: the
 * feedback a child needs is "something happened right there", and a hundred
 * particles says that no better than fifteen while costing a lot more on a
 * cheap phone.
 */

import { rand, pick } from "./engine.js";
import { circle, fillRound, star as starShape, text } from "./draw.js";
import { TOKENS } from "./palette.js";

export class Fx {
  constructor(limit = 260) {
    this.bits = [];
    this.limit = limit;
  }

  _add(b) {
    if (this.bits.length >= this.limit) this.bits.shift();
    this.bits.push(b);
  }

  /** Dust puff on landing; `power` scales the spread. */
  dust(x, y, power = 1, color = "#ffffff") {
    const n = Math.round(4 + power * 7);
    for (let i = 0; i < n; i++) {
      this._add({
        kind: "dust", x, y,
        vx: rand(-90, 90) * power, vy: rand(-140, -30) * power,
        r: rand(4, 11) * power, life: 0, max: rand(0.3, 0.6), color,
      });
    }
  }

  /** Burst of stars/sparks — success moments. */
  burst(x, y, colors = [TOKENS.bee, TOKENS.snow, TOKENS.macaw], n = 14) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const sp = rand(140, 340);
      this._add({
        kind: "spark", x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        r: rand(4, 9), rot: rand(0, 6.3), spin: rand(-8, 8),
        life: 0, max: rand(0.45, 0.85), color: pick(colors),
      });
    }
  }

  /** Musical notes rising from the character while they speak. */
  note(x, y, color = TOKENS.macaw) {
    this._add({
      kind: "note", x, y,
      vx: rand(-40, 40), vy: rand(-150, -90),
      r: rand(9, 15), rot: rand(-0.4, 0.4), spin: rand(-2, 2),
      life: 0, max: 0.9, color,
    });
  }

  /** Floating score/praise text. */
  say(x, y, str, color = TOKENS.snow, size = 26) {
    this._add({ kind: "text", x, y, vx: 0, vy: -90, str, color, size, life: 0, max: 1.1 });
  }

  ring(x, y, color = TOKENS.snow, max = 0.45) {
    this._add({ kind: "ring", x, y, r: 8, life: 0, max, color });
  }

  update(dt) {
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.life += dt;
      if (b.life >= b.max) { this.bits.splice(i, 1); continue; }
      b.x += (b.vx ?? 0) * dt;
      b.y += (b.vy ?? 0) * dt;
      if (b.kind === "dust") { b.vy += 420 * dt; b.vx *= 0.94; }
      else if (b.kind === "spark") { b.vy += 620 * dt; b.vx *= 0.97; }
      else if (b.kind === "note") { b.vy += 30 * dt; b.vx *= 0.99; }
      else if (b.kind === "text") { b.vy *= 0.94; }
      if (b.spin) b.rot += b.spin * dt;
      if (b.kind === "ring") b.r += 220 * dt;
    }
  }

  draw(ctx) {
    for (const b of this.bits) {
      const k = 1 - b.life / b.max;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      if (b.kind === "dust") {
        circle(ctx, b.x, b.y, b.r * k, b.color);
      } else if (b.kind === "spark") {
        ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        starShape(ctx, 0, 0, b.r * k, b.r * 0.42 * k, 4, b.color);
      } else if (b.kind === "note") {
        ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        circle(ctx, -b.r * 0.2, b.r * 0.35, b.r * 0.32, b.color);
        fillRound(ctx, b.r * 0.05, -b.r * 0.6, b.r * 0.14, b.r * 1.0, b.r * 0.07, b.color);
      } else if (b.kind === "ring") {
        ctx.lineWidth = 5 * k;
        ctx.strokeStyle = b.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      } else if (b.kind === "text") {
        text(ctx, b.str, b.x, b.y, { size: b.size, color: b.color, weight: 800 });
      }
      ctx.restore();
    }
  }

  clear() { this.bits.length = 0; }
}
