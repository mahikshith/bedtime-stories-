/**
 * Themed scene backdrops.
 *
 * Every puzzle game used to sit on a two-stop gradient, which is the visual
 * equivalent of a beige room: nothing is wrong with it and no child wants to
 * be in it. Each game now gets a place — a garden, a palace hall, a night sky
 * — with depth, motion and its own light.
 *
 * THE RULE THAT MATTERS: a backdrop must never compete with the game sitting
 * on top of it. All the detail lives at the edges and the horizon; the middle
 * band, where the board and the pieces go, is deliberately quiet and slightly
 * darkened by `focusVeil`. A busy centre makes a puzzle harder to read, which
 * punishes exactly the children who most need it to be legible.
 *
 * Everything is procedural, animated, and cheap enough to run behind a game
 * on a mid-range tablet.
 */

import { C, alpha, mix } from "../core/palette.js";
import { fillRound, circle, ellipse, text, star as starShape } from "../core/draw.js";

/* ------------------------------------------------------------- helpers */

function sky(ctx, view, stops) {
  const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
  stops.forEach(([at, col]) => g.addColorStop(at, col));
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
}

/**
 * Darken the middle of the screen so whatever the game draws there has
 * something calm to sit on, and lift the corners so the scene still reads.
 */
export function focusVeil(ctx, view, strength = 0.3, centreY = 0.5) {
  const g = ctx.createRadialGradient(
    view.x + view.w / 2, view.y + view.h * centreY, view.w * 0.12,
    view.x + view.w / 2, view.y + view.h * centreY, view.w * 1.15,
  );
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.45, `rgba(0,0,0,${strength * 0.55})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
}

/** Deterministic pseudo-random, so scenery is stable between frames. */
const rnd = (i, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A soft glow disc — used for every light source in every scene. */
function glow(ctx, x, y, r, color, strength = 0.5) {
  const g = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
  g.addColorStop(0, alpha(color, strength));
  g.addColorStop(0.4, alpha(color, strength * 0.35));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Drifting motes: the cheapest thing that makes a still scene feel alive. */
function motes(ctx, view, t, { count = 26, color = "#FFFFFF", size = 2.4, speed = 14, salt = 0 } = {}) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = view.x + rnd(i, salt) * view.w + Math.sin(t * 0.5 + i) * 18;
    const y = view.y + ((rnd(i, salt + 7) * view.h + t * speed * (0.4 + rnd(i, salt + 3))) % view.h);
    ctx.globalAlpha = 0.18 + rnd(i, salt + 5) * 0.4 + Math.sin(t * 2 + i) * 0.12;
    circle(ctx, x, y, size * (0.5 + rnd(i, salt + 9)), color);
  }
  ctx.restore();
}

/* ----------------------------------------------------- 1. silk garden */

/** Tangram: an East Asian garden at dusk — lanterns, bamboo, ink mountains. */
export function silkGarden(ctx, view, t) {
  sky(ctx, view, [[0, "#2A1B4E"], [0.42, "#6B3A6E"], [0.72, "#C46A5E"], [1, "#F2A15C"]]);

  // moon
  const mx = view.x + view.w * 0.76, my = view.y + view.h * 0.13;
  glow(ctx, mx, my, view.w * 0.42, "#FFE6C0", 0.4);
  circle(ctx, mx, my, view.w * 0.075, "#FFF3DC");
  ctx.save();
  ctx.globalAlpha = 0.12;
  circle(ctx, mx - view.w * 0.022, my - view.w * 0.015, view.w * 0.018, "#C9A87E");
  circle(ctx, mx + view.w * 0.024, my + view.w * 0.02, view.w * 0.013, "#C9A87E");
  ctx.restore();

  // ink-wash mountain ranges, palest first
  const ranges = [
    { y: 0.44, amp: 0.045, col: alpha("#3E2A5E", 0.55), wave: 0.9 },
    { y: 0.52, amp: 0.055, col: alpha("#2E1F48", 0.75), wave: 1.4 },
    { y: 0.60, amp: 0.04, col: alpha("#1E1433", 0.9), wave: 2.1 },
  ];
  for (const r of ranges) {
    ctx.beginPath();
    ctx.moveTo(view.x, view.y + view.h);
    for (let x = view.x; x <= view.x + view.w; x += 14) {
      const n = (x / view.w) * 6 * r.wave;
      const yy = view.y + view.h * r.y
        - Math.abs(Math.sin(n)) * view.h * r.amp
        - Math.abs(Math.sin(n * 2.3 + 1)) * view.h * r.amp * 0.5;
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(view.x + view.w, view.y + view.h);
    ctx.closePath();
    ctx.fillStyle = r.col;
    ctx.fill();
  }

  // bamboo at both edges
  for (const side of [0, 1]) {
    for (let i = 0; i < 4; i++) {
      const base = side ? view.x + view.w - 12 : view.x + 12;
      const x = base + (side ? -1 : 1) * (i * 26 + rnd(i, side) * 14);
      // Kept near-vertical: an earlier lean carried the stalks across the
      // middle of the screen, straight through where the puzzle sits.
      const sway = Math.sin(t * 0.7 + i + side * 2) * 3;
      ctx.save();
      ctx.globalAlpha = 0.85 - i * 0.14;
      ctx.strokeStyle = mix("#2F5D3A", "#000000", i * 0.12);
      ctx.lineWidth = 9 - i;
      ctx.beginPath();
      ctx.moveTo(x, view.y + view.h);
      ctx.quadraticCurveTo(x + sway, view.y + view.h * 0.5, x + sway * 1.4, view.y - 20);
      ctx.stroke();
      // leaves
      ctx.fillStyle = mix("#3F7A48", "#000000", i * 0.1);
      for (let k = 1; k < 5; k++) {
        const ly = view.y + view.h * (0.15 * k);
        const lx = x + sway * (1 - ly / (view.y + view.h)) * 1.2;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate((side ? -1 : 1) * (0.6 + Math.sin(t + k) * 0.12));
        ellipse(ctx, 14, 0, 16, 4.5, ctx.fillStyle);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // hanging paper lanterns
  for (let i = 0; i < 3; i++) {
    const x = view.x + view.w * (0.18 + i * 0.32);
    const swing = Math.sin(t * 0.8 + i * 1.3) * 0.055;
    const topY = view.y - 10;
    // Short drops keep the lanterns clear of the header text every game draws
    // across the top of the screen.
    const len = view.h * (0.045 + i * 0.03);
    ctx.save();
    ctx.translate(x, topY);
    ctx.rotate(swing);
    ctx.strokeStyle = alpha("#3A2A1E", 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len); ctx.stroke();
    const r = 24 + i * 5;
    glow(ctx, 0, len + r, r * 4, "#FF9A5C", 0.32);
    ellipse(ctx, 0, len + r, r * 0.78, r, "#E8502F");
    ellipse(ctx, 0, len + r, r * 0.55, r * 0.9, "#FF7A45");
    ctx.save();
    ctx.globalAlpha = 0.45;
    ellipse(ctx, -r * 0.2, len + r * 0.75, r * 0.2, r * 0.36, "#FFD9A8");
    ctx.restore();
    fillRound(ctx, -r * 0.3, len - 4, r * 0.6, 8, 3, "#3A2A1E");
    fillRound(ctx, -r * 0.22, len + r * 2 - 6, r * 0.44, 8, 3, "#3A2A1E");
    // tassel
    ctx.strokeStyle = "#F2C14E";
    ctx.lineWidth = 2.5;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 3, len + r * 2);
      ctx.lineTo(k * 5, len + r * 2 + 18);
      ctx.stroke();
    }
    ctx.restore();
  }

  // petals
  ctx.save();
  for (let i = 0; i < 22; i++) {
    const x = view.x + ((rnd(i, 4) * view.w + t * (8 + rnd(i, 9) * 14)) % (view.w + 40)) - 20;
    const y = view.y + ((rnd(i, 6) * view.h + t * (16 + rnd(i, 2) * 20)) % (view.h + 40)) - 20;
    ctx.globalAlpha = 0.5 + rnd(i, 8) * 0.4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (0.6 + rnd(i, 1)) + i);
    ellipse(ctx, 0, 0, 5 + rnd(i, 3) * 3, 3, i % 3 ? "#FFC7D9" : "#FFE3EC");
    ctx.restore();
  }
  ctx.restore();

  focusVeil(ctx, view, 0.34, 0.52);
}

/* ---------------------------------------------------- 2. lacquer hall */

/** Huarong Dao: a red-and-gold palace hall. */
export function lacquerHall(ctx, view, t) {
  sky(ctx, view, [[0, "#4A0F14"], [0.5, "#6B1A1C"], [1, "#2A0709"]]);

  // carved lattice pattern on the back wall
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "#F2C14E";
  ctx.lineWidth = 2;
  const step = 52;
  for (let x = view.x - step; x < view.x + view.w + step; x += step) {
    for (let y = view.y; y < view.y + view.h; y += step) {
      ctx.strokeRect(x + 6, y + 6, step - 12, step - 12);
      ctx.beginPath();
      ctx.moveTo(x + step / 2, y + 6); ctx.lineTo(x + step - 6, y + step / 2);
      ctx.lineTo(x + step / 2, y + step - 6); ctx.lineTo(x + 6, y + step / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();

  // gold cloud band across the upper wall
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#C9962F";
  const bandY = view.y + view.h * 0.2;
  ctx.fillRect(view.x, bandY, view.w, 5);
  for (let i = 0; i < 9; i++) {
    const cx = view.x + (i + 0.5) * (view.w / 9);
    ctx.beginPath();
    ctx.arc(cx, bandY - 12, 15, Math.PI, 0);
    ctx.arc(cx + 15, bandY - 6, 9, Math.PI, 0);
    ctx.arc(cx - 15, bandY - 6, 9, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();

  // lacquered pillars at the sides
  for (const side of [0, 1]) {
    const w = view.w * 0.1;
    const x = side ? view.x + view.w - w : view.x;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, side ? "#7A1A1E" : "#A82A2A");
    g.addColorStop(0.45, "#C13A34");
    g.addColorStop(1, side ? "#A82A2A" : "#7A1A1E");
    ctx.fillStyle = g;
    ctx.fillRect(x, view.y, w, view.h);
    ctx.fillStyle = "#C9962F";
    ctx.fillRect(x, view.y + view.h * 0.16, w, 8);
    ctx.fillRect(x, view.y + view.h * 0.82, w, 8);
  }

  // hanging lanterns with tassels
  for (let i = 0; i < 2; i++) {
    const x = view.x + view.w * (0.24 + i * 0.52);
    const swing = Math.sin(t * 0.9 + i * 2) * 0.07;
    ctx.save();
    ctx.translate(x, view.y - 6);
    ctx.rotate(swing);
    const len = view.h * 0.09;
    ctx.strokeStyle = "#3A1010";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len); ctx.stroke();
    const r = 30;
    glow(ctx, 0, len + r, r * 4.2, "#FFC15C", 0.42);
    ellipse(ctx, 0, len + r, r * 0.8, r, "#D8342B");
    ellipse(ctx, 0, len + r, r * 0.5, r * 0.92, "#F2582F");
    ctx.globalAlpha = 0.5;
    ellipse(ctx, -r * 0.2, len + r * 0.7, r * 0.18, r * 0.34, "#FFE3B0");
    ctx.globalAlpha = 1;
    fillRound(ctx, -r * 0.32, len - 5, r * 0.64, 10, 4, "#C9962F");
    fillRound(ctx, -r * 0.24, len + r * 2 - 6, r * 0.48, 10, 4, "#C9962F");
    ctx.strokeStyle = "#F2C14E";
    ctx.lineWidth = 3;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 4, len + r * 2 + 3);
      ctx.quadraticCurveTo(k * 7, len + r * 2 + 16, k * 5, len + r * 2 + 26);
      ctx.stroke();
    }
    ctx.restore();
  }

  // drifting embers
  motes(ctx, view, t, { count: 30, color: "#FFC15C", size: 2.6, speed: -18, salt: 11 });
  focusVeil(ctx, view, 0.38, 0.55);
}

/* ------------------------------------------------------ 3. neon grid */

/** Robot Path: a retro-futuristic horizon. */
export function neonGrid(ctx, view, t) {
  sky(ctx, view, [[0, "#0B0A2E"], [0.42, "#2A1152"], [0.62, "#5B1C63"], [0.75, "#B8336A"], [1, "#1A0B2E"]]);

  const horizon = view.y + view.h * 0.62;

  // stars above the horizon
  ctx.save();
  for (let i = 0; i < 60; i++) {
    const x = view.x + rnd(i, 1) * view.w;
    const y = view.y + rnd(i, 2) * (horizon - view.y);
    ctx.globalAlpha = 0.3 + Math.sin(t * 2 + i) * 0.3;
    circle(ctx, x, y, 0.8 + rnd(i, 3) * 1.6, "#DCE8FF");
  }
  ctx.restore();

  // big ringed planet
  const px = view.x + view.w * 0.24, py = view.y + view.h * 0.17;
  const pr = view.w * 0.13;
  glow(ctx, px, py, pr * 3.4, "#FF7AC8", 0.26);
  circle(ctx, px, py, pr, "#C74FA8");
  ctx.save();
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
  circle(ctx, px - pr * 0.3, py - pr * 0.35, pr * 0.7, "#E874C0");
  ctx.globalAlpha = 0.35;
  circle(ctx, px + pr * 0.4, py + pr * 0.3, pr * 0.5, "#8E2E7A");
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = alpha("#FFD36B", 0.75);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(px, py, pr * 1.75, pr * 0.42, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // the glowing horizon line
  ctx.save();
  glow(ctx, view.x + view.w / 2, horizon, view.w * 0.9, "#FF4FA8", 0.35);
  ctx.fillStyle = "#FF9AD8";
  ctx.fillRect(view.x, horizon - 2, view.w, 4);
  ctx.restore();

  // perspective floor grid
  ctx.save();
  ctx.strokeStyle = alpha("#4FE8FF", 0.5);
  ctx.lineWidth = 2;
  const cx = view.x + view.w / 2;
  for (let i = -9; i <= 9; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * view.w * 0.055, horizon);
    ctx.lineTo(cx + i * view.w * 0.5, view.y + view.h + 40);
    ctx.stroke();
  }
  // receding rungs, squared so they bunch toward the horizon
  for (let i = 0; i < 16; i++) {
    const p = ((i / 16) + (t * 0.09) % (1 / 16)) % 1;
    const k = Math.pow(p, 2.4);
    const y = horizon + k * (view.h - (horizon - view.y));
    ctx.globalAlpha = 0.14 + k * 0.5;
    ctx.beginPath();
    ctx.moveTo(view.x, y); ctx.lineTo(view.x + view.w, y);
    ctx.stroke();
  }
  ctx.restore();

  // floating platforms near the horizon
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const x = view.x + view.w * (0.1 + rnd(i, 21) * 0.8);
    const y = horizon - 40 - rnd(i, 22) * view.h * 0.18 + Math.sin(t * 0.6 + i) * 6;
    const w = 34 + rnd(i, 23) * 40;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w * 0.3, y + 14); ctx.lineTo(x - w * 0.3, y + 14);
    ctx.closePath();
    ctx.fillStyle = "#2E1A5E"; ctx.fill();
    ctx.fillStyle = alpha("#4FE8FF", 0.7);
    ctx.fillRect(x - w / 2, y - 3, w, 3);
  }
  ctx.restore();

  // data streams falling
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const x = view.x + rnd(i, 31) * view.w;
    const len = 30 + rnd(i, 32) * 60;
    const y = view.y + ((rnd(i, 33) * view.h + t * (90 + rnd(i, 34) * 120)) % (view.h + len)) - len;
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, alpha("#4FE8FF", 0));
    g.addColorStop(1, alpha("#4FE8FF", 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 2, len);
  }
  ctx.restore();

  focusVeil(ctx, view, 0.3, 0.42);
}

/* ------------------------------------------------------- 4. star lab */

/** Balance: a night sky observatory, with constellations that draw themselves. */
export function starLab(ctx, view, t) {
  sky(ctx, view, [[0, "#0D1033"], [0.45, "#1E1B52"], [0.8, "#3A2168"], [1, "#150E30"]]);

  // aurora ribbons
  ctx.save();
  for (let band = 0; band < 3; band++) {
    ctx.globalAlpha = 0.14 - band * 0.03;
    ctx.beginPath();
    const baseY = view.y + view.h * (0.12 + band * 0.07);
    ctx.moveTo(view.x, baseY);
    for (let x = view.x; x <= view.x + view.w; x += 16) {
      const n = (x / view.w) * 5 + t * 0.35 + band;
      ctx.lineTo(x, baseY + Math.sin(n) * 26 + Math.sin(n * 2.1) * 12);
    }
    ctx.lineTo(view.x + view.w, baseY + 90);
    for (let x = view.x + view.w; x >= view.x; x -= 16) {
      const n = (x / view.w) * 5 + t * 0.35 + band;
      ctx.lineTo(x, baseY + 90 + Math.sin(n) * 26);
    }
    ctx.closePath();
    ctx.fillStyle = ["#4FE8B0", "#6BB8FF", "#C46BFF"][band];
    ctx.fill();
  }
  ctx.restore();

  // stars
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const x = view.x + rnd(i, 41) * view.w;
    const y = view.y + rnd(i, 42) * view.h;
    const tw = 0.3 + Math.sin(t * (1.4 + rnd(i, 43) * 2) + i) * 0.45;
    ctx.globalAlpha = Math.max(0.08, tw);
    circle(ctx, x, y, 0.9 + rnd(i, 44) * 1.7, "#E8F0FF");
  }
  ctx.restore();

  // constellations, drawn at the top corners where nothing is played
  const consts = [
    { at: [0.16, 0.14], pts: [[0, 0], [30, -18], [62, -6], [86, -32], [110, -12]] },
    { at: [0.8, 0.2], pts: [[0, 0], [-26, -24], [-50, -4], [-30, 26], [4, 30]] },
  ];
  ctx.save();
  for (let ci = 0; ci < consts.length; ci++) {
    const c = consts[ci];
    const ox = view.x + view.w * c.at[0], oy = view.y + view.h * c.at[1];
    const pulse = 0.4 + Math.sin(t * 0.9 + ci * 2) * 0.3;
    ctx.strokeStyle = alpha("#9FD8FF", pulse * 0.55);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    c.pts.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x, oy + y) : ctx.moveTo(ox + x, oy + y)));
    ctx.stroke();
    for (const [x, y] of c.pts) {
      glow(ctx, ox + x, oy + y, 16, "#CFE8FF", pulse * 0.7);
      circle(ctx, ox + x, oy + y, 2.6, "#FFFFFF");
    }
  }
  ctx.restore();

  // big moon, low on the right
  const mx = view.x + view.w * 0.84, my = view.y + view.h * 0.78;
  glow(ctx, mx, my, view.w * 0.5, "#B8CCFF", 0.22);
  circle(ctx, mx, my, view.w * 0.16, "#DCE4FF");
  ctx.save();
  ctx.globalAlpha = 0.16;
  circle(ctx, mx - view.w * 0.05, my - view.w * 0.03, view.w * 0.035, "#8895C9");
  circle(ctx, mx + view.w * 0.04, my + view.w * 0.05, view.w * 0.026, "#8895C9");
  circle(ctx, mx + view.w * 0.01, my - view.w * 0.07, view.w * 0.018, "#8895C9");
  ctx.restore();

  // a shooting star every few seconds
  const phase = (t * 0.22) % 1;
  if (phase < 0.16) {
    const k = phase / 0.16;
    const sx = view.x + view.w * (0.15 + k * 0.6);
    const sy = view.y + view.h * (0.08 + k * 0.22);
    ctx.save();
    ctx.globalAlpha = Math.sin(k * Math.PI);
    const g = ctx.createLinearGradient(sx - 70, sy - 26, sx, sy);
    g.addColorStop(0, alpha("#FFFFFF", 0));
    g.addColorStop(1, "#FFFFFF");
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx - 70, sy - 26); ctx.lineTo(sx, sy); ctx.stroke();
    circle(ctx, sx, sy, 2.6, "#FFFFFF");
    ctx.restore();
  }

  motes(ctx, view, t, { count: 18, color: "#CFE8FF", size: 1.8, speed: -10, salt: 51 });
  focusVeil(ctx, view, 0.34, 0.5);
}

/* -------------------------------------------------------- 5. toy room */

/** Shape Sorter: a sunlit playroom. Warm, domestic, safe. */
export function toyRoom(ctx, view, t) {
  sky(ctx, view, [[0, "#FFE8C4"], [0.55, "#FFD7B0"], [1, "#F7BFA0"]]);

  // wallpaper stripes
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#E8895C";
  for (let x = view.x; x < view.x + view.w; x += 68) ctx.fillRect(x, view.y, 30, view.h * 0.78);
  ctx.restore();

  // polka dots between the stripes
  ctx.save();
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 44; i++) {
    const x = view.x + rnd(i, 61) * view.w;
    const y = view.y + rnd(i, 62) * view.h * 0.74;
    circle(ctx, x, y, 4 + rnd(i, 63) * 4, "#C7643A");
  }
  ctx.restore();

  // window with a sunbeam
  // This room is seen around the edges of a board that fills the middle of
  // the screen, with a guide character top-left and a title across the top.
  // The window therefore lives in the top-RIGHT corner and stays small.
  const wx = view.x + view.w * 0.7, wy = view.y + view.h * 0.012;
  const ww = view.w * 0.26, wh = view.h * 0.105;
  fillRound(ctx, wx - 8, wy - 8, ww + 16, wh + 16, 14, "#B5764A");
  fillRound(ctx, wx, wy, ww, wh, 8, "#BFE8FF");
  ctx.save();
  ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  circle(ctx, wx + ww * 0.7, wy + wh * 0.3, wh * 0.28, "#FFF3B0");
  ctx.fillStyle = "#FFFFFF";
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 3; i++) {
    const cx = wx + ww * (0.2 + i * 0.28), cy = wy + wh * (0.55 + (i % 2) * 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, wh * 0.13, 0, Math.PI * 2);
    ctx.arc(cx + wh * 0.12, cy + wh * 0.03, wh * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "#B5764A";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.stroke();
  ctx.restore();

  // the beam of light falling into the room
  ctx.save();
  ctx.globalAlpha = 0.2;
  const g = ctx.createLinearGradient(wx + ww, wy, wx - view.w * 0.3, view.y + view.h);
  g.addColorStop(0, "#FFF6D0");
  g.addColorStop(1, alpha("#FFF6D0", 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(wx, wy + wh);
  ctx.lineTo(wx + ww, wy + wh);
  ctx.lineTo(wx + ww - view.w * 0.12, view.y + view.h);
  ctx.lineTo(wx - view.w * 0.55, view.y + view.h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // rug along the bottom
  ctx.save();
  const ry = view.y + view.h * 0.78;
  ctx.fillStyle = "#D96A5A";
  ctx.beginPath();
  ctx.ellipse(view.x + view.w / 2, ry + view.h * 0.2, view.w * 0.62, view.h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alpha("#FFE8C4", 0.5);
  ctx.lineWidth = 8;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(view.x + view.w / 2, ry + view.h * 0.2,
      view.w * 0.62 * (1 - i * 0.2), view.h * 0.16 * (1 - i * 0.2), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // dust in the sunbeam
  motes(ctx, view, t, { count: 22, color: "#FFF8E0", size: 2.2, speed: 9, salt: 71 });
  focusVeil(ctx, view, 0.16, 0.56);
}

/* ------------------------------------------------------- 6. workshop */

/** Tilt Maze: a warm wooden toy workshop. */
export function workshop(ctx, view, t) {
  sky(ctx, view, [[0, "#3A2617"], [0.5, "#4E3320"], [1, "#2A1B10"]]);

  // plank wall
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const y = view.y + (i / 9) * view.h;
    ctx.fillStyle = i % 2 ? "#563722" : "#4A2F1D";
    ctx.fillRect(view.x, y, view.w, view.h / 9);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#2A1B10";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(view.x, y); ctx.lineTo(view.x + view.w, y); ctx.stroke();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#8A5A33";
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const gy = y + (view.h / 9) * (0.3 + k * 0.22);
      ctx.beginPath();
      ctx.moveTo(view.x, gy);
      ctx.bezierCurveTo(view.x + view.w * 0.3, gy - 5, view.x + view.w * 0.7, gy + 5, view.x + view.w, gy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // hanging lamp with a cone of light
  const lx = view.x + view.w * 0.5, ly = view.y + view.h * 0.06;
  ctx.save();
  ctx.strokeStyle = "#2A1B10";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(lx, view.y); ctx.lineTo(lx, ly); ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(lx - 44, ly + 30); ctx.lineTo(lx + 44, ly + 30);
  ctx.lineTo(lx + 16, ly); ctx.lineTo(lx - 16, ly);
  ctx.closePath();
  ctx.fillStyle = "#2E7A5E"; ctx.fill();
  ctx.fillStyle = "#3F9C78";
  ctx.fillRect(lx - 40, ly + 24, 80, 6);
  glow(ctx, lx, ly + 40, view.w * 0.75, "#FFD98A", 0.3);
  circle(ctx, lx, ly + 34, 11, "#FFF3C4");
  ctx.save();
  ctx.globalAlpha = 0.12;
  const cone = ctx.createLinearGradient(0, ly + 30, 0, view.y + view.h);
  cone.addColorStop(0, "#FFE9A8");
  cone.addColorStop(1, alpha("#FFE9A8", 0));
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(lx - 44, ly + 30); ctx.lineTo(lx + 44, ly + 30);
  ctx.lineTo(lx + view.w * 0.55, view.y + view.h);
  ctx.lineTo(lx - view.w * 0.55, view.y + view.h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // pegboard tools in the top corners
  const tools = [
    (x, y) => { // saw
      ctx.fillStyle = "#B8BEC4";
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + 54, y + 10); ctx.lineTo(x + 54, y + 22); ctx.lineTo(x, y + 14);
      ctx.closePath(); ctx.fill();
      fillRound(ctx, x - 16, y - 2, 18, 14, 4, "#8A5A33");
    },
    (x, y) => { // hammer
      fillRound(ctx, x, y, 10, 48, 4, "#8A5A33");
      fillRound(ctx, x - 12, y - 6, 34, 16, 4, "#9AA3AA");
    },
    (x, y) => { // wrench
      ctx.strokeStyle = "#9AA3AA"; ctx.lineWidth = 8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y + 42); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 9, Math.PI * 0.2, Math.PI * 1.6); ctx.stroke();
    },
  ];
  ctx.save();
  ctx.globalAlpha = 0.75;
  tools[0](view.x + 24, view.y + view.h * 0.08);
  tools[1](view.x + view.w - 54, view.y + view.h * 0.07);
  tools[2](view.x + view.w - 110, view.y + view.h * 0.08);
  ctx.restore();

  // sawdust in the lamp light
  motes(ctx, view, t, { count: 26, color: "#FFE9B8", size: 2, speed: 12, salt: 81 });
  focusVeil(ctx, view, 0.3, 0.55);
}

export const BACKDROPS = { silkGarden, lacquerHall, neonGrid, starLab, toyRoom, workshop };
