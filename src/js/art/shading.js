/**
 * Pseudo-3D shading helpers.
 *
 * The cast is drawn as if it were a set of glossy vinyl toys lit from the
 * upper-left: every volume gets a light side, a shadow side, a soft rim
 * bounce on the lower-right and a small specular highlight. That reads as
 * three-dimensional without a 3D pipeline, and it stays cheap enough to draw
 * a crowd of them per frame.
 *
 * Gradients are cached by (colour, radius bucket) because creating them per
 * part per frame is the single biggest cost in a scene full of characters.
 */

import { mix } from "../core/palette.js";

const LIGHT = { x: -0.38, y: -0.42 }; // unit light direction, upper-left

const sphereCache = new Map();
const limbCache = new Map();

/** Radial "ball" gradient for a rounded volume. */
export function sphereFill(ctx, cx, cy, r, color) {
  const key = `${color}|${Math.round(r)}`;
  let stops = sphereCache.get(key);
  if (!stops) {
    stops = {
      hi: mix(color, "#ffffff", 0.42),
      mid: color,
      lo: mix(color, "#000000", 0.3),
      rim: mix(color, "#ffffff", 0.2),
    };
    sphereCache.set(key, stops);
  }
  const g = ctx.createRadialGradient(
    cx + LIGHT.x * r * 0.55, cy + LIGHT.y * r * 0.55, r * 0.06,
    cx, cy, r * 1.06,
  );
  g.addColorStop(0, stops.hi);
  g.addColorStop(0.45, stops.mid);
  g.addColorStop(1, stops.lo);
  return g;
}

/** Linear gradient across a limb's axis. */
export function limbFill(ctx, x1, y1, x2, y2, w, color) {
  const key = color;
  let stops = limbCache.get(key);
  if (!stops) {
    stops = { hi: mix(color, "#ffffff", 0.34), mid: color, lo: mix(color, "#000000", 0.26) };
    limbCache.set(key, stops);
  }
  // perpendicular to the limb
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const g = ctx.createLinearGradient(
    (x1 + x2) / 2 + px * w * 0.5, (y1 + y2) / 2 + py * w * 0.5,
    (x1 + x2) / 2 - px * w * 0.5, (y1 + y2) / 2 - py * w * 0.5,
  );
  // Orient so the light side is whichever end faces up-left.
  const facing = px * LIGHT.x + py * LIGHT.y > 0;
  g.addColorStop(0, facing ? stops.hi : stops.lo);
  g.addColorStop(0.5, stops.mid);
  g.addColorStop(1, facing ? stops.lo : stops.hi);
  return g;
}

/** A shaded ball. */
export function ball(ctx, cx, cy, r, color, { specular = true } = {}) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = sphereFill(ctx, cx, cy, r, color);
  ctx.fill();
  if (specular) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(cx + LIGHT.x * r * 0.9, cy + LIGHT.y * r * 0.95, r * 0.26, r * 0.17, -0.7, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  }
}

/** A shaded ellipsoid (bodies, torsos). */
export function ovoid(ctx, cx, cy, rx, ry, color, rot = 0, { specular = true } = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  const r = Math.max(rx, ry);
  ctx.fillStyle = sphereFill(ctx, 0, 0, r, color);
  ctx.fill();
  if (specular) {
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.ellipse(LIGHT.x * rx * 0.85, LIGHT.y * ry * 0.9, rx * 0.28, ry * 0.18, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  ctx.restore();
}

/** A shaded capsule limb with rounded caps. */
export function limb(ctx, x1, y1, x2, y2, w, color) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = w;
  ctx.strokeStyle = limbFill(ctx, x1, y1, x2, y2, w, color);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Contact shadow that softens and shrinks as a character leaves the ground. */
export function contactShadow(ctx, cx, groundY, r, height01 = 0) {
  const t = Math.max(0, Math.min(1, height01));
  ctx.save();
  ctx.globalAlpha = 0.3 * (1 - t * 0.72);
  const rr = r * (1 - t * 0.35);
  const g = ctx.createRadialGradient(cx, groundY, rr * 0.1, cx, groundY, rr);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, groundY, rr, rr * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
