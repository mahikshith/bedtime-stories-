/**
 * Environments — bold poster graphics.
 *
 * Art direction, and the reason for each rule:
 *
 *  - Platforms are thick PILLARS with a grass cap, not thin slabs. A pillar
 *    that runs off the bottom of the screen tells a child "there is no floor
 *    down there" without a word of explanation.
 *  - Every grass cap has a scalloped underside and overhangs its pillar. The
 *    wobble is what stops a rectangle from looking like a UI element.
 *  - Water is flat saturated blue topped with big white scallop waves that
 *    slide. Gradients read as fog on a phone in daylight; flat chroma does not.
 *  - Everything gets a hard dark under-edge. Value contrast, not blur, is what
 *    makes these shapes feel carved.
 *  - Nothing on screen is allowed to be still. Grass sways, waves slide,
 *    clouds drift, crystals pulse.
 */

import { C, TOKENS, mix, alpha, vivid } from "../core/palette.js";
import { roundRect, fillRound, circle, ellipse, star } from "../core/draw.js";
import { KIND } from "../core/physics.js";

/* --------------------------------------------------------------- themes */

const theme = (id, name, o) => ({ id, name, ...o });

export const THEMES = {
  meadow: theme("meadow", "Sunny Meadow", {
    sky: ["#3FB6F0", "#7FD6FA", "#C4EEFF"],
    sunColor: "#FFF3A8",
    rays: true,
    hills: [C.grass.deep, C.grass.dark, C.grass.base],
    pillar: C.clay,
    cap: C.grass,
    accent: C.sun.base,
    water: C.sea,
    prop: { leaf: C.grass, trunk: C.bark, petals: [C.cherry.base, C.sun.base, C.grape.base] },
    particle: { kind: "leaf", colors: [C.grass.light, C.sun.light, C.grass.base] },
  }),
  cave: theme("cave", "Crystal Caves", {
    sky: ["#170F33", "#2A1A5C", "#43268C"],
    sunColor: null,
    rays: false,
    hills: ["#160E2E", "#231544", "#32205F"],
    pillar: C.grape,
    cap: C.jade,
    accent: "#4BE3FF",
    water: { light: "#B07CFF", base: "#7B3FE4", dark: "#4A1FA8", deep: "#2E1370" },
    prop: { leaf: C.jade, trunk: C.grape, petals: ["#4BE3FF", C.candy.base, C.grape.light] },
    particle: { kind: "spark", colors: ["#4BE3FF", C.candy.light, "#FFFFFF"] },
  }),
  sky: theme("sky", "Cloud Kingdom", {
    sky: ["#FF7B4A", "#FFAE6B", "#FFDCA8"],
    sunColor: "#FFF0C0",
    rays: true,
    hills: ["#C2567E", "#E0729A", "#F58FB0"],
    pillar: C.bone,
    cap: C.candy,
    accent: C.cherry.base,
    water: C.sky,
    prop: { leaf: C.candy, trunk: C.bone, petals: ["#FFFFFF", C.sun.base, C.flame.light] },
    particle: { kind: "feather", colors: ["#FFFFFF", "#FFE9C4", C.flame.light] },
  }),
  candy: theme("candy", "Sugar Peaks", {
    // Sky is deliberately a different family from the water below it. An
    // earlier pass had both in mid-pink and the waterline disappeared, which
    // hides the one thing the player must not misjudge.
    sky: ["#8E6BFF", "#C79BFF", "#FFE2F4"],
    sunColor: "#FFF6D0",
    rays: true,
    hills: ["#B81A75", "#E02E95", "#FF56B4"],
    pillar: C.bone,
    cap: C.candy,
    accent: "#4BE3FF",
    water: { light: "#FF7ACB", base: "#E01A8E", dark: "#A50F66", deep: "#6B0842" },
    prop: { leaf: C.candy, trunk: C.bone, petals: ["#FFFFFF", "#4BE3FF", C.sun.base] },
    particle: { kind: "sprinkle", colors: ["#FFFFFF", "#4BE3FF", C.sun.base, C.cherry.base] },
  }),
};

export const THEME_IDS = Object.keys(THEMES);

/* ------------------------------------------------------- shape language */

/**
 * A grass cap: flat top, rounded shoulders, scalloped underside, overhanging
 * the pillar it sits on. This one shape carries most of the game's character.
 */
export function grassCap(ctx, x, y, w, h, ramp, t = 0, phase = 0) {
  const over = Math.min(10, w * 0.06);
  const gx = x - over, gw = w + over * 2;
  const bumps = Math.max(3, Math.round(gw / 26));
  const bw = gw / bumps;
  const r = Math.min(h * 0.55, 14);

  const path = (yOff) => {
    ctx.beginPath();
    ctx.moveTo(gx, y + r + yOff);
    ctx.quadraticCurveTo(gx, y + yOff, gx + r, y + yOff);
    ctx.lineTo(gx + gw - r, y + yOff);
    ctx.quadraticCurveTo(gx + gw, y + yOff, gx + gw, y + r + yOff);
    ctx.lineTo(gx + gw, y + h + yOff);
    // scalloped underside, sliding very slightly so the edge feels alive
    for (let i = bumps - 1; i >= 0; i--) {
      const bx = gx + i * bw;
      const wob = Math.sin(t * 1.6 + i * 0.9 + phase) * 1.6;
      ctx.quadraticCurveTo(bx + bw * 0.5, y + h + bw * 0.42 + yOff + wob, bx, y + h + yOff);
    }
    ctx.closePath();
  };

  // dark under-body first, then the lit cap on top of it
  path(4);
  ctx.fillStyle = ramp.dark;
  ctx.fill();
  path(0);
  ctx.fillStyle = ramp.base;
  ctx.fill();

  // top highlight band
  ctx.save();
  path(0);
  ctx.clip();
  ctx.fillStyle = ramp.light;
  ctx.fillRect(gx, y, gw, h * 0.42);
  ctx.restore();

  // blades along the lip
  ctx.fillStyle = ramp.light;
  for (let i = 0; i < gw / 17; i++) {
    const bx = gx + 7 + i * 17;
    if (bx > gx + gw - 6) break;
    const hh = 7 + ((i * 13) % 7);
    const sway = Math.sin(t * 2.1 + i * 0.7 + phase) * 2.6;
    ctx.beginPath();
    ctx.moveTo(bx - 3.5, y + 2);
    ctx.quadraticCurveTo(bx + sway, y - hh, bx + 3.5, y + 2);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * A chunky pillar body laid in brick courses.
 *
 * Bricks rather than a plain slab for two reasons: they give the eye a sense
 * of scale (a child can count courses to judge how tall a drop is), and they
 * are the visual shorthand every platformer since Mario has used for "solid,
 * standable, permanent" — which is exactly the promise a platform makes.
 */
export function pillar(ctx, x, y, w, h, ramp, { brick = true } = {}) {
  const r = Math.min(12, w * 0.16);
  fillRound(ctx, x, y, w, h, { tl: r, tr: r, br: r * 0.4, bl: r * 0.4 }, ramp.base);

  ctx.save();
  roundRect(ctx, x, y, w, h, { tl: r, tr: r, br: r * 0.4, bl: r * 0.4 });
  ctx.clip();

  if (brick) {
    const bh = 26, bw = 56, mortar = 4;
    const mortarCol = ramp.deep;
    ctx.fillStyle = mortarCol;
    ctx.fillRect(x, y, w, h);
    for (let row = 0, ry = y; ry < y + h; row++, ry += bh) {
      // every other course is offset by half a brick
      const shift = row % 2 ? -bw / 2 : 0;
      for (let bx = x + shift - bw; bx < x + w + bw; bx += bw) {
        const px = Math.max(bx, x - bw);
        fillRound(ctx, px + mortar / 2, ry + mortar / 2,
                  bw - mortar, bh - mortar, 4, ramp.base);
        // a highlight on the top-left of each brick reads as relief
        fillRound(ctx, px + mortar / 2 + 2, ry + mortar / 2 + 2,
                  bw - mortar - 4, 5, 2, ramp.light);
      }
    }
  }

  // lit left edge / shaded right edge over the whole column
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, alpha("#FFFFFF", 0.22));
  grad.addColorStop(0.22, alpha("#FFFFFF", 0));
  grad.addColorStop(0.72, alpha("#000000", 0));
  grad.addColorStop(1, alpha("#000000", 0.3));
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // the pillar darkens as it descends, so depth reads without a gradient mesh
  const depth = ctx.createLinearGradient(0, y, 0, y + h);
  depth.addColorStop(0, alpha("#000000", 0));
  depth.addColorStop(1, alpha("#000000", 0.42));
  ctx.fillStyle = depth;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/**
 * Water: flat saturated blue, a band of big white scallops riding the
 * surface, and a second offset row behind for depth.
 */
export function waterBody(ctx, x, y, w, h, ramp, t) {
  // The surface is a real moving waterline, not a straight edge with a
  // pattern sliding behind it. Two sine waves of different speed and length
  // keep it from looking like a metronome, and because the whole body is
  // clipped to the wave the depth bands and glints rise and fall with it.
  //
  // The previous version scrolled a row of scallops sideways and nothing
  // else, which at a glance read as a flat blue rectangle — reported, fairly,
  // as "the water is not flowing".
  const surf = (px) =>
    y + 14 +
    Math.sin(px * 0.018 + t * 2.1) * 7 +
    Math.sin(px * 0.041 - t * 3.4) * 3.5;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let px = x; px <= x + w; px += 6) ctx.lineTo(px, surf(px));
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = ramp.base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ramp.dark;
  ctx.fillRect(x, y + h * 0.45, w, h);
  ctx.fillStyle = ramp.deep;
  ctx.fillRect(x, y + h * 0.75, w, h);

  // Caustic streaks drifting down and across, which is what sells depth.
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = ramp.light;
  for (let i = 0; i < 5; i++) {
    const cx = x + ((i * 0.27 + t * 0.06) % 1.2 - 0.1) * w;
    const cy = y + h * (0.2 + i * 0.16) + Math.sin(t * 1.3 + i) * 10;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.22, h * 0.03, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  scallops(ctx, x, y + 18, w, 18, alpha(ramp.light, 0.5), t * 42, 54);
  ctx.restore();

  // The foam line rides on top of the clip so the crest stays crisp.
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(x, surf(x));
  for (let px = x; px <= x + w; px += 6) ctx.lineTo(px, surf(px));
  for (let px = x + w; px >= x; px -= 6) ctx.lineTo(px, surf(px) - 9);
  ctx.closePath();
  ctx.fill();

  // Glints that wink along the crest.
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 6; i++) {
    const gx = x + ((i * 0.19 + t * 0.09) % 1.1) * w;
    const tw = 0.5 + Math.sin(t * 5 + i * 2.1) * 0.5;
    if (tw < 0.45) continue;
    ctx.beginPath();
    ctx.ellipse(gx, surf(gx) - 16, 7 * tw, 3 * tw, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A row of overlapping whitehalf-circles — the signature wave shape. */
function scallops(ctx, x, y, w, r, color, offset, spacing) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const start = x - spacing - ((offset % spacing) + spacing) % spacing;
  for (let px = start; px < x + w + spacing; px += spacing) {
    ctx.moveTo(px, y + r);
    ctx.arc(px + spacing / 2, y + r, spacing * 0.52, Math.PI, 0);
  }
  ctx.fill();
  ctx.fillRect(x, y + r - 1, w, r * 0.5);
}

/** Volumetric cloud: stacked lobes with a lit crown and a shaded belly. */
export function drawCloud(ctx, x, y, r, tint = "#FFFFFF") {
  const lobes = [
    [0, 0, 0.62], [r * 0.56, r * 0.12, 0.46], [-r * 0.58, r * 0.14, 0.42],
    [r * 0.2, -r * 0.3, 0.44], [-r * 0.22, -r * 0.24, 0.38],
    [r * 0.92, r * 0.26, 0.3], [-r * 0.94, r * 0.28, 0.28],
  ];
  ctx.save();
  ctx.fillStyle = mix(tint, "#8FB8D8", 0.3);
  ctx.beginPath();
  for (const [dx, dy, s] of lobes) ctx.arc(x + dx, y + dy + r * 0.14, r * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tint;
  ctx.beginPath();
  for (const [dx, dy, s] of lobes) ctx.arc(x + dx, y + dy, r * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(tint, "#FFFFFF", 1);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  for (const [dx, dy, s] of lobes.slice(0, 5)) ctx.arc(x + dx, y + dy - r * 0.12, r * s * 0.82, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------- backdrop */

export function drawBackdrop(ctx, view, cam, T, t) {
  const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
  g.addColorStop(0, T.sky[0]);
  g.addColorStop(0.5, T.sky[1]);
  g.addColorStop(1, T.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);

  if (T.sunColor) drawSun(ctx, view, cam, T, t);
  if (T.id === "cave") caveLayers(ctx, view, cam, T, t);
  else if (T.id === "sky") skyLayers(ctx, view, cam, T, t);
  else openLayers(ctx, view, cam, T, t);

  vignette(ctx, view);
}

function drawSun(ctx, view, cam, T, t) {
  const sx = view.x + view.w * 0.74 - cam.x * 0.015;
  const sy = view.y + view.h * 0.14;
  const R = view.w * 0.09;

  if (T.rays) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(t * 0.06);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = T.sunColor;
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(view.w * 1.1, -R * 0.42);
      ctx.lineTo(view.w * 1.1, R * 0.42);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  const glow = ctx.createRadialGradient(sx, sy, R * 0.5, sx, sy, R * 4);
  glow.addColorStop(0, alpha(T.sunColor, 0.6));
  glow.addColorStop(1, alpha(T.sunColor, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  circle(ctx, sx, sy, R, T.sunColor);
  circle(ctx, sx, sy, R * 0.82, "#FFFFFF");
}

/** Rolling hills, each one capped in its own grass so depth stays readable. */
function hillBand(ctx, view, cam, color, depth, baseY, amp, wave, phase, capColor) {
  const off = -cam.x * depth;
  const pts = [];
  const step = 20;
  for (let x = view.x - step; x <= view.x + view.w + step; x += step) {
    const wx = x + off;
    pts.push({
      x,
      y: baseY + Math.sin(wx / wave + phase) * amp + Math.sin(wx / (wave * 0.41) + phase * 1.6) * amp * 0.3,
    });
  }
  ctx.beginPath();
  ctx.moveTo(view.x - step, view.y + view.h);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(view.x + view.w + step, view.y + view.h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (capColor) {
    ctx.save();
    ctx.lineWidth = 9;
    ctx.lineJoin = "round";
    ctx.strokeStyle = capColor;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  }
}

function openLayers(ctx, view, cam, T, t) {
  const bottom = view.y + view.h;
  for (let i = 0; i < 6; i++) {
    const x = view.x + (((i * 317 - cam.x * 0.05) % (view.w + 700)) + view.w + 700) % (view.w + 700) - 200;
    drawCloud(ctx, x, view.y + view.h * (0.08 + (i % 3) * 0.07), 42 + (i % 4) * 20);
  }
  hillBand(ctx, view, cam, T.hills[0], 0.10, bottom - view.h * 0.34, 30, 210, 0.4, mix(T.hills[1], "#FFFFFF", 0.1));
  hillBand(ctx, view, cam, T.hills[1], 0.20, bottom - view.h * 0.24, 25, 160, 1.9, T.hills[2]);

  // a treeline on the near band
  ctx.save();
  ctx.globalAlpha = 0.75;
  const off = -cam.x * 0.3;
  for (let i = 0; i < 30; i++) {
    const x = view.x + ((((i * 88 + off) % (view.w + 260)) + view.w + 260) % (view.w + 260)) - 130;
    drawTree(ctx, x, bottom - view.h * 0.16, 52, T, t, i, true);
  }
  ctx.restore();
  hillBand(ctx, view, cam, T.hills[2], 0.3, bottom - view.h * 0.12, 18, 120, 3.1, mix(T.hills[2], "#FFFFFF", 0.22));
}

function caveLayers(ctx, view, cam, T, t) {
  const bottom = view.y + view.h;
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const x = view.x + ((((i * 191 - cam.x * 0.12) % (view.w + 520)) + view.w + 520) % (view.w + 520)) - 200;
    const y = view.y + view.h * 0.2 + ((i * 97) % Math.max(1, view.h * 0.45));
    const s = 20 + (i % 4) * 14;
    const pulse = 0.55 + Math.sin(t * 1.5 + i) * 0.25;
    const glow = ctx.createRadialGradient(x, y, 2, x, y, s * 3.4);
    glow.addColorStop(0, alpha(T.accent, 0.34 * pulse));
    glow.addColorStop(1, alpha(T.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - s * 3.4, y - s * 3.4, s * 6.8, s * 6.8);
    drawCrystal(ctx, x, y, s, T.accent, pulse);
  }
  ctx.restore();

  // stalactites
  const off = -cam.x * 0.28;
  for (let i = 0; i < 34; i++) {
    const x = view.x + ((((i * 76 + off) % (view.w + 240)) + view.w + 240) % (view.w + 240)) - 120;
    const hgt = 46 + ((i * 41) % 110);
    ctx.beginPath();
    ctx.moveTo(x - 20, view.y - 2);
    ctx.lineTo(x + 20, view.y - 2);
    ctx.lineTo(x, view.y + hgt);
    ctx.closePath();
    ctx.fillStyle = T.hills[1];
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, view.y - 2);
    ctx.lineTo(x + 20, view.y - 2);
    ctx.lineTo(x, view.y + hgt);
    ctx.closePath();
    ctx.fillStyle = T.hills[0];
    ctx.fill();
  }
  hillBand(ctx, view, cam, T.hills[2], 0.34, bottom - view.h * 0.1, 16, 130, 2.2, T.accent);
}

function skyLayers(ctx, view, cam, T, t) {
  for (const [depth, yF, size, a] of [[0.05, 0.2, 70, 0.55], [0.12, 0.4, 104, 0.75], [0.24, 0.62, 150, 0.95]]) {
    ctx.save();
    ctx.globalAlpha = a;
    for (let i = 0; i < 7; i++) {
      const x = view.x + ((((i * 261 - cam.x * depth) % (view.w + 680)) + view.w + 680) % (view.w + 680)) - 280;
      drawCloud(ctx, x, view.y + view.h * yF + ((i % 3) - 1) * 24, size, i % 2 ? "#FFFFFF" : "#FFE6F0");
    }
    ctx.restore();
  }
}

function vignette(ctx, view) {
  const g = ctx.createRadialGradient(
    view.x + view.w / 2, view.y + view.h * 0.45, view.w * 0.3,
    view.x + view.w / 2, view.y + view.h * 0.5, view.w * 0.95,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
}

/* ---------------------------------------------------------------- props */

function drawCrystal(ctx, x, y, s, color, bright = 0.6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * 0.52, -s * 0.2);
  ctx.lineTo(s * 0.34, s); ctx.lineTo(-s * 0.34, s);
  ctx.lineTo(-s * 0.52, -s * 0.2); ctx.closePath();
  ctx.fillStyle = mix(color, "#FFFFFF", 0.3 * bright);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * 0.52, -s * 0.2);
  ctx.lineTo(s * 0.34, s); ctx.lineTo(0, s * 0.5); ctx.closePath();
  ctx.fillStyle = mix(color, "#000000", 0.32);
  ctx.fill();
  ctx.restore();
}

function drawTree(ctx, x, groundY, h, T, t, seed = 0, far = false) {
  const sway = Math.sin(t * 1.1 + seed) * 0.045;
  const leaf = T.prop.leaf, trunk = T.prop.trunk;
  ctx.save();
  ctx.translate(x, groundY);
  ctx.rotate(sway);
  fillRound(ctx, -h * 0.07, -h * 0.55, h * 0.14, h * 0.56, h * 0.05, trunk.base);
  fillRound(ctx, -h * 0.07, -h * 0.55, h * 0.05, h * 0.56, h * 0.03, trunk.light);
  if (T.id === "cave") { drawCrystal(ctx, 0, -h * 0.72, h * 0.24, T.accent, 0.8); ctx.restore(); return; }
  const lobes = [[0, -h * 0.78, 0.34], [-h * 0.26, -h * 0.6, 0.26], [h * 0.26, -h * 0.62, 0.25], [0, -h * 0.55, 0.28]];
  ctx.fillStyle = leaf.dark;
  ctx.beginPath();
  for (const [dx, dy, s] of lobes) ctx.arc(dx, dy + h * 0.05, h * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = leaf.base;
  ctx.beginPath();
  for (const [dx, dy, s] of lobes) ctx.arc(dx, dy, h * s, 0, Math.PI * 2);
  ctx.fill();
  if (!far) {
    ctx.fillStyle = leaf.light;
    ctx.beginPath();
    for (const [dx, dy, s] of lobes.slice(0, 2)) ctx.arc(dx - h * 0.06, dy - h * 0.08, h * s * 0.66, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawProp(ctx, prop, T, t) {
  const { x, y, kind, seed } = prop;
  switch (kind) {
    case "T": drawTree(ctx, x, y, 132 + (seed % 5) * 16, T, t, seed); break;
    case "b": {
      const r = 30 + (seed % 4) * 6;
      const leaf = T.prop.leaf;
      ctx.fillStyle = leaf.dark;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.42, r, 0, Math.PI * 2);
      ctx.arc(x - r * 0.75, y - r * 0.2, r * 0.7, 0, Math.PI * 2);
      ctx.arc(x + r * 0.75, y - r * 0.22, r * 0.66, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = leaf.base;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.55, r * 0.9, 0, Math.PI * 2);
      ctx.arc(x - r * 0.72, y - r * 0.32, r * 0.62, 0, Math.PI * 2);
      ctx.arc(x + r * 0.72, y - r * 0.34, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "r": {
      const r = 24 + (seed % 3) * 8;
      const s = T.pillar;
      ctx.beginPath();
      ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.62, y - r * 0.95);
      ctx.lineTo(x + r * 0.28, y - r * 1.05); ctx.lineTo(x + r, y);
      ctx.closePath();
      ctx.fillStyle = s.dark; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.62, y - r * 0.95);
      ctx.lineTo(x + r * 0.28, y - r * 1.05); ctx.lineTo(x - r * 0.1, y);
      ctx.closePath();
      ctx.fillStyle = s.base; ctx.fill();
      break;
    }
    case "f": {
      const col = T.prop.petals[seed % T.prop.petals.length];
      const sway = Math.sin(t * 1.8 + seed) * 0.16;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sway);
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.strokeStyle = C.grass.dark;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        circle(ctx, Math.cos(a) * 9, -30 + Math.sin(a) * 9, 7, col);
      }
      circle(ctx, 0, -30, 5.5, C.sun.base);
      ctx.restore();
      break;
    }
  }
}

/* ------------------------------------------------------------ platforms */

/**
 * Platforms.
 *
 * A solid block is drawn as a pillar sunk into the world with a grass cap on
 * top; the cap overhangs and scallops, which is the single detail that makes
 * the whole scene read as hand-made rather than tiled.
 */
export function drawPlatform(ctx, p, T, t) {
  const capH = 26;

  if (p.kind === KIND.ONEWAY) {
    // a floating cloud-ledge: soft, obviously pass-through
    ctx.save();
    ctx.globalAlpha = 0.96;
    drawCloud(ctx, p.x + p.w / 2, p.y + p.h * 0.4, Math.max(26, p.w * 0.3), "#FFFFFF");
    ctx.restore();
    return;
  }

  if (p.kind === KIND.CRUMBLE) {
    const k = p.crumbling ? Math.min(1, p.crumbleT / 420) : 0;
    ctx.save();
    ctx.translate(Math.sin(t * 54) * k * 5, Math.sin(t * 63) * k * 3);
    const ramp = { ...T.pillar };
    pillar(ctx, p.x, p.y + 6, p.w, p.h + 10, k > 0.4 ? C.flame : ramp);
    grassCap(ctx, p.x, p.y - capH * 0.4, p.w, capH * 0.8, k > 0.4 ? C.flame : T.cap, t, p.x);
    ctx.strokeStyle = alpha("#000000", 0.4 + k * 0.4);
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const cx = p.x + p.w * (0.26 + i * 0.24);
      ctx.beginPath();
      ctx.moveTo(cx, p.y + 4);
      ctx.lineTo(cx + (i % 2 ? 7 : -7), p.y + p.h + 8);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (p.kind === KIND.BOUNCY) {
    const squish = p.squish ?? 0;
    const h = p.h * (1 - squish * 0.6);
    const y = p.y + (p.h - h);
    ctx.save();
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.strokeStyle = C.slate.base;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) ctx.lineTo(p.x + p.w * (0.22 + 0.56 * (i % 2)), y + h * (i / 10));
    ctx.stroke();
    ctx.restore();
    fillRound(ctx, p.x - 4, y - 16, p.w + 8, 20, 10, C.cherry.dark);
    fillRound(ctx, p.x - 4, y - 18, p.w + 8, 18, 9, C.cherry.base);
    fillRound(ctx, p.x + 2, y - 15, p.w - 4, 7, 4, C.cherry.light);
    return;
  }

  if (p.kind === KIND.ICE) {
    pillar(ctx, p.x, p.y, p.w, p.h + 6, C.ice);
    ctx.save();
    ctx.globalAlpha = 0.9;
    fillRound(ctx, p.x - 6, p.y - 12, p.w + 12, 22, 10, C.ice.light);
    fillRound(ctx, p.x - 6, p.y - 14, p.w + 12, 16, 8, "#FFFFFF");
    // icicles hanging off the lip
    ctx.fillStyle = C.ice.light;
    for (let i = 0; i < p.w / 30; i++) {
      const ix = p.x + 12 + i * 30;
      const ih = 10 + ((i * 17) % 14);
      ctx.beginPath();
      ctx.moveTo(ix - 6, p.y + 8); ctx.lineTo(ix + 6, p.y + 8); ctx.lineTo(ix, p.y + 8 + ih);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    return;
  }

  // SOLID / MOVING / CONVEYOR — the pillar-and-cap look
  const ramp = p.kind === KIND.MOVING ? C.bark : T.pillar;
  // A mover is a short slab; a ground pillar is drawn all the way down so it
  // visibly plunges into the water rather than floating above it.
  const drop = p.kind === KIND.MOVING ? p.h + 10 : p.h + 30;
  pillar(ctx, p.x, p.y + capH * 0.5, p.w, drop, ramp, { brick: p.kind !== KIND.MOVING });
  grassCap(ctx, p.x, p.y - capH * 0.5, p.w, capH, T.cap, t, p.x * 0.01);

  if (p.kind === KIND.CONVEYOR) {
    const dir = p.dir ?? 1;
    const scroll = (t * 120 * dir) % 40;
    ctx.save();
    ctx.fillStyle = C.sun.base;
    for (let x = p.x - 40; x < p.x + p.w + 40; x += 40) {
      const ax = x + scroll;
      if (ax < p.x + 2 || ax > p.x + p.w - 20) continue;
      ctx.beginPath();
      ctx.moveTo(ax, p.y + 2); ctx.lineTo(ax + 16 * dir, p.y + 9); ctx.lineTo(ax, p.y + 16);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  if (p.kind === KIND.MOVING) {
    ctx.save();
    for (const bx of [p.x + 12, p.x + p.w - 12]) {
      circle(ctx, bx, p.y + 16, 5.5, C.sun.dark);
      circle(ctx, bx - 1, p.y + 15, 3.5, C.sun.base);
    }
    ctx.restore();
  }
}

/* -------------------------------------------------------------- hazards */

export function drawHazard(ctx, hz, T, t) {
  if (hz.type === "spike") {
    const n = Math.max(1, Math.round(hz.w / 30));
    const w = hz.w / n;
    for (let i = 0; i < n; i++) {
      const x = hz.x + i * w;
      ctx.beginPath();
      ctx.moveTo(x, hz.y + hz.h); ctx.lineTo(x + w / 2, hz.y - 14); ctx.lineTo(x + w, hz.y + hz.h);
      ctx.closePath();
      ctx.fillStyle = C.slate.base; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w / 2, hz.y - 14); ctx.lineTo(x + w, hz.y + hz.h); ctx.lineTo(x + w / 2, hz.y + hz.h);
      ctx.closePath();
      ctx.fillStyle = C.slate.deep; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, hz.y - 14); ctx.lineTo(x + w * 0.22, hz.y + hz.h);
      ctx.lineTo(x + w * 0.42, hz.y + hz.h); ctx.closePath();
      ctx.fillStyle = "#FFFFFF"; ctx.globalAlpha = 0.65; ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else if (hz.type === "water") {
    waterBody(ctx, hz.x, hz.y, hz.w, hz.h, T.water, t);
  } else if (hz.type === "saw") {
    const cx = hz.x + hz.w / 2, cy = hz.y + hz.h / 2, r = hz.w * 0.56;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(hz.spin ?? 0);
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = i % 2 ? r : r * 0.7;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = C.slate.light; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      const rr = i % 2 ? r * 0.92 : r * 0.64;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = C.slate.base; ctx.fill();
    circle(ctx, 0, 0, r * 0.3, C.cherry.base);
    circle(ctx, -r * 0.06, -r * 0.06, r * 0.18, C.cherry.light);
    ctx.restore();
  }
}

/* ------------------------------------------------------------ particles */

export class Weather {
  constructor(theme, count = 30) {
    this.theme = theme;
    this.bits = Array.from({ length: count }, () => this._spawn(true));
  }
  _spawn(anywhere = false) {
    const c = this.theme.particle.colors;
    return {
      x: Math.random(), y: anywhere ? Math.random() : -0.06,
      vx: (Math.random() - 0.5) * 0.03, vy: 0.014 + Math.random() * 0.035,
      r: 4 + Math.random() * 6, rot: Math.random() * 6.28,
      spin: (Math.random() - 0.5) * 3,
      color: c[Math.floor(Math.random() * c.length)],
      phase: Math.random() * 6.28,
    };
  }
  update(dt) {
    for (const b of this.bits) {
      b.y += b.vy * dt;
      b.x += (b.vx + Math.sin(b.phase + b.y * 9) * 0.014) * dt;
      b.rot += b.spin * dt;
      if (b.y > 1.12) Object.assign(b, this._spawn());
    }
  }
  draw(ctx, view) {
    const kind = this.theme.particle.kind;
    ctx.save();
    for (const b of this.bits) {
      ctx.save();
      ctx.translate(view.x + b.x * view.w, view.y + b.y * view.h);
      ctx.rotate(b.rot);
      ctx.globalAlpha = 0.85;
      if (kind === "leaf") {
        ellipse(ctx, 0, 0, b.r, b.r * 0.5, b.color);
        ctx.strokeStyle = alpha("#000000", 0.2); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-b.r, 0); ctx.lineTo(b.r, 0); ctx.stroke();
      } else if (kind === "spark") {
        star(ctx, 0, 0, b.r, b.r * 0.38, 4, b.color);
      } else if (kind === "feather") {
        ellipse(ctx, 0, 0, b.r * 0.45, b.r, b.color);
      } else {
        fillRound(ctx, -b.r * 0.28, -b.r, b.r * 0.56, b.r * 2, b.r * 0.28, b.color);
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
