/**
 * Drawing primitives for the flat-vector look.
 *
 * House rules, applied everywhere:
 *   - shapes are solid fills, never gradients on characters
 *   - depth comes from a darker slab under the shape, not from a shadow blur
 *   - outlines are avoided; contrast does the work
 *   - every grounded object gets a soft ellipse shadow so it sits in the world
 */

import { TOKENS } from "./palette.js";

/** Rounded rectangle path (per-corner radii allowed). */
export function roundRect(ctx, x, y, w, h, r = 8) {
  const rr = typeof r === "number" ? { tl: r, tr: r, br: r, bl: r } : r;
  const m = Math.min(w, h) / 2;
  const tl = Math.min(rr.tl ?? 0, m), tr = Math.min(rr.tr ?? 0, m);
  const br = Math.min(rr.br ?? 0, m), bl = Math.min(rr.bl ?? 0, m);
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

export function fillRound(ctx, x, y, w, h, r, color) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * The signature chunky slab: a face colour resting on a darker edge.
 * `press` (0..1) sinks the face down onto the edge until the edge vanishes,
 * which is what sells the button as a physical thing.
 */
export function slab(ctx, x, y, w, h, r, face, edge, lift = 6, press = 0) {
  fillRound(ctx, x, y + lift, w, h, r, edge);
  fillRound(ctx, x, y + lift * press, w, h, r, face);
}

/** Ellipse. */
export function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function circle(ctx, cx, cy, r, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Soft contact shadow under a grounded object. */
export function groundShadow(ctx, cx, cy, rx, alpha = 0.28) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ellipse(ctx, cx, cy, rx, rx * 0.34, "#000000");
  ctx.restore();
}

/** Capsule between two points — used for limbs. */
export function capsule(ctx, x1, y1, x2, y2, w, color) {
  ctx.beginPath();
  ctx.lineCap = "round";
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Organic blob — a closed spline through `points` radii around a centre.
 * Used for bodies and foliage so nothing reads as a plain circle.
 */
export function blob(ctx, cx, cy, radii, color, rot = 0) {
  const n = radii.length;
  const pts = radii.map((r, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i];
    const p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    if (i === 0) ctx.moveTo((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    // Catmull-Rom converted to cubic bezier
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Star (used for level nodes and rewards). */
export function star(ctx, cx, cy, outer, inner, points, color, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Centred text in the display face. */
export function text(ctx, str, x, y, {
  size = 20,
  color = TOKENS.snow,
  weight = 800,
  font = "var(--font-display)",
  align = "center",
  baseline = "middle",
  maxWidth,
} = {}) {
  ctx.save();
  const family = font.includes("var(") ? '"Baloo 2","Nunito",system-ui,sans-serif' : font;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  maxWidth ? ctx.fillText(str, x, y, maxWidth) : ctx.fillText(str, x, y);
  ctx.restore();
}

/** Text with a contrasting outline — readable over busy backgrounds. */
export function outlinedText(ctx, str, x, y, opts = {}) {
  const { stroke = "rgba(0,0,0,0.35)", strokeWidth = 6 } = opts;
  ctx.save();
  const family = '"Baloo 2","Nunito",system-ui,sans-serif';
  ctx.font = `${opts.weight ?? 800} ${opts.size ?? 20}px ${family}`;
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = opts.baseline ?? "middle";
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = stroke;
  ctx.lineJoin = "round";
  ctx.strokeText(str, x, y);
  ctx.fillStyle = opts.color ?? TOKENS.snow;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** Speech bubble with a tail on the left, matching the lesson dialogue box. */
export function speechBubble(ctx, x, y, w, h, { fill = TOKENS.inkRaised, line = TOKENS.inkLine, tail = "left" } = {}) {
  roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = line;
  ctx.stroke();

  ctx.beginPath();
  if (tail === "left") {
    ctx.moveTo(x, y + h * 0.55);
    ctx.lineTo(x - 14, y + h * 0.62);
    ctx.lineTo(x, y + h * 0.75);
  } else {
    ctx.moveTo(x + w, y + h * 0.55);
    ctx.lineTo(x + w + 14, y + h * 0.62);
    ctx.lineTo(x + w, y + h * 0.75);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.stroke();
  // hide the seam the tail draws across the bubble edge
  ctx.beginPath();
  const sx = tail === "left" ? x : x + w;
  ctx.moveTo(sx, y + h * 0.55 + 2);
  ctx.lineTo(sx, y + h * 0.75 - 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = fill;
  ctx.stroke();
}

/** Clip helper so callers never forget the restore. */
export function clipped(ctx, pathFn, drawFn) {
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  drawFn(ctx);
  ctx.restore();
}
