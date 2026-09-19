/**
 * Tinker Town — the places.
 *
 * Four rooms, each with a painted backdrop, a set of SURFACES that dropped
 * objects come to rest on, and FIXTURES that things can react with (a stove, a
 * soil bed, a bathtub).
 *
 * The rooms are deliberately few and deliberately different. A sandbox gets
 * its depth from what you can carry BETWEEN rooms, not from how many rooms
 * there are: four rooms plus a pocket is a much bigger space than eight rooms
 * you cannot move things between. Carrying the watering can into the kitchen,
 * or the pot into the bathroom, has to be possible and has to do something.
 *
 * WHERE THE DETAIL GOES. A room has to feel lived in, but it must never
 * compete with the toys sitting on top of it. So each room is built in two
 * halves: everything above the first surface is dense — cupboards, a window,
 * bunting, a tree, drapes — and the band a child actually drops things into
 * stays calm, with flat colour and strong value contrast behind the props.
 * That is also why the upper half is worth filling at all: it is the only
 * region where richness is free.
 */

import { C, alpha, mix } from "../../core/palette.js";
import { fillRound, roundRect, circle, ellipse, text } from "../../core/draw.js";

/** Deterministic scatter, so scenery never jitters between frames. */
const rnd = (i, salt = 0) => {
  const x = Math.sin(i * 91.7 + salt * 271.3) * 43758.5453;
  return x - Math.floor(x);
};

/* ========================================================================
 * Shared props.
 *
 * Rooms share a vocabulary rather than each inventing its own, so a shelf in
 * the bathroom reads as the same kind of object as a shelf in the music room
 * and the four places feel like one world.
 * ===================================================================== */

/** Vertical wall wash. Every room starts from one so nothing is flat. */
function wall(ctx, R, top, bottom) {
  const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(R.x, R.y, R.w, R.h);
}

/** A band of brick-bonded tiles — splashbacks, bathroom walls. */
function tileBand(ctx, x, y, w, h, cols, rows, a, b, grout) {
  const tw = w / cols, th = h / rows;
  ctx.save();
  ctx.fillStyle = grout; ctx.fillRect(x, y, w, h);
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * tw * 0.5;
    for (let i = -1; i <= cols; i++) {
      ctx.fillStyle = (i + j) % 3 === 0 ? b : a;
      const tx = x + i * tw + off;
      const l = Math.max(x, tx), r = Math.min(x + w, tx + tw - 3);
      if (r > l) ctx.fillRect(l, y + j * th + 2, r - l, th - 4);
    }
  }
  ctx.restore();
}

/** Planked panel — floors, stage boards, cupboard doors. */
function planks(ctx, x, y, w, h, n, face, edge, vertical = false) {
  ctx.fillStyle = face; ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = edge; ctx.lineWidth = 3;
  for (let i = 1; i < n; i++) {
    ctx.beginPath();
    if (vertical) { ctx.moveTo(x + (w / n) * i, y); ctx.lineTo(x + (w / n) * i, y + h); }
    else { ctx.moveTo(x, y + (h / n) * i); ctx.lineTo(x + w, y + (h / n) * i); }
    ctx.stroke();
  }
  ctx.restore();
}

/** A shelf with brackets and a front lip, so it reads as carpentry. */
function shelf(ctx, x, y, w, face, edge, thick = 16) {
  fillRound(ctx, x, y, w, thick, thick * 0.4, face);
  fillRound(ctx, x, y + thick * 0.62, w, thick * 0.38, thick * 0.2, edge);
  for (const bx of [x + w * 0.12, x + w * 0.88]) {
    ctx.save(); ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.moveTo(bx - 7, y + thick); ctx.lineTo(bx + 7, y + thick);
    ctx.lineTo(bx + 7, y + thick + 26); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/** Triangular pennants on a sagging string. Instant "somewhere cheerful". */
function bunting(ctx, x, y, w, n, sag, cols) {
  ctx.save();
  ctx.strokeStyle = alpha("#000000", 0.28); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w / 2, y + sag * 2, x + w, y); ctx.stroke();
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const fx = x + u * w;
    const fy = y + sag * 2 * u * (1 - u) * 2;
    const fw = w / n * 0.62, fh = fw * 1.25;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.moveTo(fx - fw / 2, fy); ctx.lineTo(fx + fw / 2, fy); ctx.lineTo(fx, fy + fh);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = alpha("#000000", 0.13);
    ctx.beginPath();
    ctx.moveTo(fx, fy); ctx.lineTo(fx + fw / 2, fy); ctx.lineTo(fx, fy + fh);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** A lidded storage jar. Four of these turn a shelf into a kitchen. */
function jar(ctx, cx, baseY, w, h, fill) {
  fillRound(ctx, cx - w / 2, baseY - h, w, h, w * 0.26, alpha("#FFFFFF", 0.82));
  fillRound(ctx, cx - w / 2 + 3, baseY - h * 0.62, w - 6, h * 0.58, w * 0.2, fill);
  fillRound(ctx, cx - w * 0.58, baseY - h - 9, w * 1.16, 13, 5, C.bark.dark);
  ctx.save(); ctx.globalAlpha = 0.5;
  fillRound(ctx, cx - w * 0.32, baseY - h * 0.9, w * 0.14, h * 0.6, w * 0.07, "#FFFFFF");
  ctx.restore();
}

/** A framed picture. `inner` paints whatever hangs inside it. */
function frame(ctx, x, y, w, h, matte, edge, inner) {
  fillRound(ctx, x, y, w, h, 10, edge);
  fillRound(ctx, x + 8, y + 8, w - 16, h - 16, 5, matte);
  ctx.save();
  roundRect(ctx, x + 8, y + 8, w - 16, h - 16, 5); ctx.clip();
  inner?.(ctx, { x: x + 8, y: y + 8, w: w - 16, h: h - 16 });
  ctx.restore();
}

/** A potted plant. The cheapest way to make any room look inhabited. */
function plant(ctx, cx, baseY, s, leaf = C.grass.base) {
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.34;
    const len = s * (0.9 + rnd(i, 44) * 0.5);
    ctx.save();
    ctx.translate(cx, baseY - s * 0.45);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = i % 2 ? leaf : mix(leaf, "#000000", 0.18);
    ctx.beginPath();
    ctx.ellipse(0, -len * 0.5, s * 0.17, len * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, baseY - s * 0.55);
  ctx.lineTo(cx + s * 0.42, baseY - s * 0.55);
  ctx.lineTo(cx + s * 0.3, baseY); ctx.lineTo(cx - s * 0.3, baseY);
  ctx.closePath(); ctx.fillStyle = C.clay.base; ctx.fill();
  fillRound(ctx, cx - s * 0.46, baseY - s * 0.64, s * 0.92, s * 0.16, 5, C.clay.dark);
}

/** Rolling hills for anything with a horizon. */
function hills(ctx, x, y, w, h, colors) {
  colors.forEach((col, k) => {
    const amp = h * (0.5 - k * 0.12), base = y + h * (0.25 + k * 0.3);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, y + h * 2);
    for (let px = 0; px <= w; px += 14) {
      const u = px / w;
      ctx.lineTo(x + px, base - Math.sin(u * 3.1 + k * 2.2) * amp - Math.sin(u * 7.7 + k) * amp * 0.3);
    }
    ctx.lineTo(x + w, y + h * 2); ctx.closePath(); ctx.fill();
  });
}

/* ========================================================================
 * The rooms.
 * ===================================================================== */

export const SCENES = {
  /* ------------------------------------------------------------ kitchen */
  kitchen: {
    id: "kitchen", name: "Kitchen",
    tint: C.jade,
    icon(ctx, cx, cy, s) {                       // a pot, drawn not typed
      fillRound(ctx, cx - s * 0.36, cy - s * 0.12, s * 0.72, s * 0.46, s * 0.12, C.slate.base);
      fillRound(ctx, cx - s * 0.44, cy - s * 0.2, s * 0.88, s * 0.14, s * 0.07, C.slate.light);
      circle(ctx, cx, cy - s * 0.34, s * 0.1, C.slate.light);
      ctx.save(); ctx.globalAlpha = 0.85;
      for (let i = -1; i <= 1; i++)
        ellipse(ctx, cx + i * s * 0.2, cy - s * 0.46, s * 0.09, s * 0.13, alpha("#FFFFFF", 0.7));
      ctx.restore();
    },
    // Surfaces are fractions of the play area: {y, x1, x2}.
    surfaces: [{ y: 0.60, x1: 0.03, x2: 0.97 }, { y: 0.95, x1: 0, x2: 1 }],
    fixtures: [
      { id: "stove", x: 0.26, y: 0.60, w: 0.26, h: 0.09, tag: "heats" },
      { id: "sink", x: 0.80, y: 0.585, w: 0.26, h: 0.09, tag: "wets" },
    ],
    start: [
      { thing: "pot", x: 0.26, y: 0.60 }, { thing: "apple", x: 0.52, y: 0.60 },
      { thing: "egg", x: 0.60, y: 0.60 }, { thing: "bread", x: 0.2, y: 0.95 },
      { thing: "cup", x: 0.72, y: 0.95 },
    ],
    paint(ctx, R, t) {
      const { x, y, w, h } = R;
      wall(ctx, R, "#63C9AE", "#2E9E84");

      // --- splashback: cream tiles, only behind the counter ---------------
      tileBand(ctx, x, y + h * 0.38, w, h * 0.22, 9, 4, "#FFF3DE", "#FFE3B8", "#D8C3A0");

      // --- wall cupboards, upper left -------------------------------------
      const cuX = x + w * 0.02, cuW = w * 0.42, cuY = y + h * 0.07, cuH = h * 0.25;
      fillRound(ctx, cuX, cuY + 6, cuW, cuH, 12, "#5C3418");
      fillRound(ctx, cuX, cuY, cuW, cuH, 12, C.bark.dark);
      for (let i = 0; i < 2; i++) {
        const dX = cuX + 9 + i * (cuW - 18) / 2, dW = (cuW - 18) / 2 - 5;
        fillRound(ctx, dX, cuY + 9, dW, cuH - 18, 8, C.bark.base);
        fillRound(ctx, dX + 9, cuY + 18, dW - 18, cuH - 36, 5, mix(C.bark.base, "#000000", 0.13));
        fillRound(ctx, dX + dW * (i ? 0.14 : 0.72), cuY + cuH * 0.42, dW * 0.14, 34, 7, "#F6D79A");
      }
      // a rail of hanging utensils under the cupboards
      fillRound(ctx, cuX + 10, cuY + cuH + 12, cuW - 20, 7, 3, C.slate.light);
      for (let i = 0; i < 3; i++) {
        const ux = cuX + cuW * (0.24 + i * 0.26);
        ctx.save(); ctx.strokeStyle = C.slate.light; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(ux, cuY + cuH + 16); ctx.lineTo(ux, cuY + cuH + 44); ctx.stroke();
        ctx.restore();
        if (i === 0) {                                                           // ladle
          circle(ctx, ux, cuY + cuH + 62, 20, C.slate.base);
          circle(ctx, ux, cuY + cuH + 58, 14, C.slate.dark);
        } else if (i === 1) {                                                      // pan
          fillRound(ctx, ux - 22, cuY + cuH + 42, 44, 36, 8, C.clay.base);
          fillRound(ctx, ux - 22, cuY + cuH + 42, 44, 11, 6, C.clay.light);
        } else {                                                                   // whisk
          ctx.save(); ctx.fillStyle = C.bone.base;
          for (let k = -2; k <= 2; k++) {
            ctx.beginPath();
            ctx.ellipse(ux + k * 6, cuY + cuH + 62, 4.5, 21, k * 0.2, 0, 7); ctx.fill();
          }
          ctx.restore();
        }
      }

      // --- window, upper right --------------------------------------------
      const wx = x + w * 0.52, wy = y + h * 0.08, ww = w * 0.42, wh = h * 0.24;
      fillRound(ctx, wx - 11, wy - 11, ww + 22, wh + 22, 14, "#5C3418");
      fillRound(ctx, wx - 8, wy - 8, ww + 16, wh + 16, 12, C.bark.base);
      ctx.save();
      roundRect(ctx, wx, wy, ww, wh, 6); ctx.clip();
      const sg = ctx.createLinearGradient(0, wy, 0, wy + wh);
      sg.addColorStop(0, C.sky.base); sg.addColorStop(1, C.sky.light);
      ctx.fillStyle = sg; ctx.fillRect(wx, wy, ww, wh);
      circle(ctx, wx + ww * 0.74, wy + wh * 0.26, wh * 0.17, C.sun.light);
      hills(ctx, wx, wy + wh * 0.45, ww, wh * 0.55, [C.grass.dark, C.grass.base]);
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(wx + ww * 0.26, wy + wh * 0.3, wh * 0.1, 0, 7);
      ctx.arc(wx + ww * 0.36, wy + wh * 0.33, wh * 0.075, 0, 7);
      ctx.arc(wx + ww * 0.17, wy + wh * 0.34, wh * 0.065, 0, 7);
      ctx.fill();
      ctx.restore();
      ctx.save(); ctx.strokeStyle = C.bark.base; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
      ctx.restore();
      // a scalloped valance, because a bare window is a hole in a wall
      ctx.fillStyle = C.cherry.base;
      ctx.beginPath(); ctx.moveTo(wx - 14, wy - 16);
      ctx.lineTo(wx + ww + 14, wy - 16); ctx.lineTo(wx + ww + 14, wy + 6);
      for (let i = 6; i >= 0; i--)
        ctx.arc(wx - 14 + (ww + 28) * (i + 0.5) / 7, wy + 6, (ww + 28) / 14, 0, Math.PI, true);
      ctx.closePath(); ctx.fill();
      fillRound(ctx, wx - 16, wy - 20, ww + 32, 10, 5, C.cherry.dark);

      // --- open shelf with jars, between window and counter ---------------
      const shY = y + h * 0.415, shX = x + w * 0.54, shW = w * 0.42;
      shelf(ctx, shX, shY, shW, C.bark.base, C.bark.dark, 14);
      [C.cherry, C.sun, C.grass, C.grape].forEach((col, i) =>
        jar(ctx, shX + shW * (0.15 + i * 0.235), shY - 2, w * 0.062, h * 0.058, col.base));

      // --- a clock, top-left gap ------------------------------------------
      const ckx = x + w * 0.465, cky = y + h * 0.375, ckr = w * 0.052;
      circle(ctx, ckx, cky + 4, ckr + 4, alpha("#000000", 0.18));
      circle(ctx, ckx, cky, ckr + 4, C.bark.dark);
      circle(ctx, ckx, cky, ckr, C.bone.base);
      ctx.save(); ctx.strokeStyle = C.slate.dark; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ckx, cky); ctx.lineTo(ckx, cky - ckr * 0.6);
      ctx.moveTo(ckx, cky); ctx.lineTo(ckx + ckr * 0.45, cky + ckr * 0.2); ctx.stroke();
      ctx.restore();

      bunting(ctx, x - w * 0.04, y + 14, w * 1.08, 9, 16,
        [C.cherry.base, C.sun.base, C.sky.base, C.candy.base]);

      // --- counter, running the full width ---------------------------------
      const cy = y + h * 0.60;
      planks(ctx, x, cy + h * 0.035, w, h * 0.22, 4, C.bark.base, "#4A2A12", true);
      // handles, so the cabinet reads as cupboards rather than a brown wall
      for (let i = 0; i < 4; i++)
        fillRound(ctx, x + (w / 4) * i + w * 0.09, cy + h * 0.085, w * 0.07, 9, 5, "#F6D79A");
      fillRound(ctx, x, cy, w, h * 0.04, 6, "#C98A4B");
      fillRound(ctx, x, cy, w, h * 0.016, 4, "#EFC085");

      // --- the STOVE. It has to be visible: "put the pot on the stove" is
      // a discovery a child can only make if there is a stove to see. ------
      const stx = x + w * 0.26, sw2 = w * 0.26;
      fillRound(ctx, stx - sw2 / 2, cy - h * 0.016, sw2, h * 0.055, 8, C.coal.base);
      fillRound(ctx, stx - sw2 / 2, cy - h * 0.016, sw2, h * 0.018, 6, C.slate.dark);
      for (let i = -1; i <= 1; i += 2) {
        const bx = stx + i * sw2 * 0.24;
        ctx.save();
        ctx.strokeStyle = C.slate.light; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(bx, cy + h * 0.008, sw2 * 0.16, h * 0.012, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // knobs on the cabinet front below the hob
      for (let i = -1; i <= 1; i += 2) {
        circle(ctx, stx + i * sw2 * 0.28, cy + h * 0.065, 10, C.bone.base);
        circle(ctx, stx + i * sw2 * 0.28, cy + h * 0.065, 6, C.cherry.base);
      }

      // --- the sink, kept inside the room --------------------------------
      const skx = x + w * 0.80, skw = w * 0.3;
      fillRound(ctx, skx - skw / 2, cy - h * 0.02, skw, h * 0.06, 9, C.bone.dark);
      fillRound(ctx, skx - skw / 2 + 8, cy - h * 0.012, skw - 16, h * 0.042, 7, C.slate.base);
      ctx.save(); ctx.strokeStyle = C.slate.light; ctx.lineWidth = 8; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(skx + skw * 0.3, cy - h * 0.02);
      ctx.lineTo(skx + skw * 0.3, cy - h * 0.085);
      ctx.lineTo(skx, cy - h * 0.085);
      ctx.stroke(); ctx.restore();
      for (const s of [-1, 1]) circle(ctx, skx + skw * (0.3 + s * 0.13), cy - h * 0.028, 8, C.sky.light);

      // --- floor: a proper chequer, not stripes ---------------------------
      const fy = y + h * 0.82;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, fy, w, y + h - fy); ctx.clip();
      ctx.fillStyle = "#E8B37E"; ctx.fillRect(x, fy, w, y + h - fy);
      const cols = 7, rows = 4, tw = w / cols, th = (y + h - fy) / rows;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          if ((i + j) % 2) continue;
          ctx.fillStyle = "#A8663A";
          ctx.fillRect(x + i * tw, fy + j * th, tw, th);
        }
      ctx.globalAlpha = 0.22; ctx.fillStyle = "#4A2A12";
      ctx.fillRect(x, fy, w, 6);
      ctx.restore();
      // skirting board
      fillRound(ctx, x - 4, fy - 12, w + 8, 16, 4, "#5C3418");
    },
    overlay(ctx, R, t, world) {
      const f = this.fixtures[0];
      if (!world.fixtureActive?.stove) return;
      const cx = R.x + R.w * f.x, cy = R.y + R.h * f.y;
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(t * 6) * 0.18;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, R.w * 0.14);
      g.addColorStop(0, alpha(C.flame.light, 0.95));
      g.addColorStop(1, alpha(C.flame.light, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - R.w * 0.14, cy - R.w * 0.14, R.w * 0.28, R.w * 0.28);
      ctx.restore();
    },
  },

  /* ------------------------------------------------------------- garden */
  garden: {
    id: "garden", name: "Garden",
    tint: C.grass,
    icon(ctx, cx, cy, s) {                        // a sunflower
      ctx.save(); ctx.strokeStyle = C.grass.dark; ctx.lineWidth = s * 0.09; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.05); ctx.lineTo(cx, cy + s * 0.5); ctx.stroke();
      ctx.restore();
      ellipse(ctx, cx - s * 0.22, cy + s * 0.3, s * 0.18, s * 0.1, C.grass.base);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ellipse(ctx, cx + Math.cos(a) * s * 0.29, cy + Math.sin(a) * s * 0.29 - s * 0.05,
          s * 0.15, s * 0.11, C.sun.base);
      }
      circle(ctx, cx, cy - s * 0.05, s * 0.2, C.bark.base);
    },
    surfaces: [{ y: 0.86, x1: 0, x2: 1 }],
    fixtures: [
      { id: "soil", x: 0.32, y: 0.86, w: 0.5, h: 0.1, tag: "grows" },
    ],
    start: [
      { thing: "seed", x: 0.12, y: 0.86 }, { thing: "seed", x: 0.2, y: 0.86 },
      { thing: "can", x: 0.82, y: 0.86 }, { thing: "stone", x: 0.92, y: 0.86 },
      { thing: "mushroom", x: 0.05, y: 0.86 },
    ],
    paint(ctx, R, t) {
      const { x, y, w, h } = R;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, "#2FA3E8"); g.addColorStop(0.42, "#7FD3FB"); g.addColorStop(0.62, "#CFEEDF");
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);

      // --- sun with slow rays ---------------------------------------------
      const sx = x + w * 0.82, sy = y + h * 0.11, sr = w * 0.085;
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(t * 0.08);
      ctx.fillStyle = alpha("#FFF3A8", 0.35);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath();
        ctx.moveTo(-sr * 0.16, -sr * 1.15); ctx.lineTo(sr * 0.16, -sr * 1.15);
        ctx.lineTo(0, -sr * 1.95); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      circle(ctx, sx, sy, sr * 1.3, alpha("#FFF3A8", 0.4));
      circle(ctx, sx, sy, sr, "#FFF3A8");
      circle(ctx, sx, sy, sr * 0.78, "#FFFBD6");

      // --- clouds ----------------------------------------------------------
      for (let i = 0; i < 4; i++) {
        const cx = x + ((i * 0.31 + t * 0.006) % 1.3 - 0.15) * w;
        const cy = y + h * (0.08 + i * 0.075);
        const s = 1 - i * 0.12;
        ctx.save(); ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(cx, cy, w * 0.055 * s, 0, 7); ctx.arc(cx + w * 0.052 * s, cy + w * 0.012 * s, w * 0.04 * s, 0, 7);
        ctx.arc(cx - w * 0.052 * s, cy + w * 0.014 * s, w * 0.036 * s, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 0.35; ctx.fillStyle = C.sky.light;
        ctx.beginPath(); ctx.ellipse(cx, cy + w * 0.03 * s, w * 0.085 * s, w * 0.016 * s, 0, 0, 7); ctx.fill();
        ctx.restore();
      }

      // --- far hills, then a tree behind the fence -------------------------
      hills(ctx, x, y + h * 0.44, w, h * 0.2, ["#8FD3A8", "#5FB877"]);

      const tx = x + w * 0.86, tby = y + h * 0.70;
      ctx.fillStyle = C.bark.dark;
      ctx.beginPath();
      ctx.moveTo(tx - w * 0.035, tby); ctx.lineTo(tx - w * 0.02, y + h * 0.40);
      ctx.lineTo(tx + w * 0.02, y + h * 0.40); ctx.lineTo(tx + w * 0.035, tby);
      ctx.closePath(); ctx.fill();
      const sway = Math.sin(t * 0.6) * w * 0.006;
      [[0, -0.075, 0.115], [-0.085, -0.03, 0.09], [0.08, -0.035, 0.085], [-0.03, -0.12, 0.075]]
        .forEach(([ox, oy, r], i) =>
          circle(ctx, tx + w * ox + sway * (1 + i * 0.3), y + h * 0.40 + h * oy * 1.6, w * r,
            i % 2 ? "#3E9418" : "#4FAE22"));
      for (let i = 0; i < 5; i++)                       // apples in the canopy
        circle(ctx, tx + w * (rnd(i, 61) - 0.5) * 0.22 + sway,
          y + h * 0.33 + h * rnd(i, 62) * 0.1, w * 0.018, C.cherry.base);

      // --- shed, left ------------------------------------------------------
      const hx = x + w * 0.02, hw = w * 0.30, hby = y + h * 0.685, hh = h * 0.2;
      planks(ctx, hx, hby - hh, hw, hh, 5, "#C97F4A", "#8A5028");
      ctx.fillStyle = C.cherry.dark;                     // roof
      ctx.beginPath();
      ctx.moveTo(hx - w * 0.03, hby - hh + 6); ctx.lineTo(hx + hw * 0.5, hby - hh - h * 0.06);
      ctx.lineTo(hx + hw + w * 0.03, hby - hh + 6); ctx.closePath(); ctx.fill();
      fillRound(ctx, hx + hw * 0.52, hby - hh * 0.78, hw * 0.34, hh * 0.78, 4, "#7A4320");
      fillRound(ctx, hx + hw * 0.1, hby - hh * 0.7, hw * 0.3, hh * 0.32, 4, C.sky.light);
      ctx.save(); ctx.strokeStyle = "#8A5028"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx + hw * 0.25, hby - hh * 0.7); ctx.lineTo(hx + hw * 0.25, hby - hh * 0.38);
      ctx.stroke(); ctx.restore();
      circle(ctx, hx + hw * 0.6, hby - hh * 0.38, 5, C.sun.base);

      // --- picket fence ----------------------------------------------------
      const fy = y + h * 0.60, fh = h * 0.12;
      for (let i = 0; i < 26; i++) {
        const px = x + i * (w / 25);
        ctx.fillStyle = i % 2 ? "#F4F0E6" : "#E4DFD0";
        ctx.beginPath();
        ctx.moveTo(px - w * 0.013, fy + 10); ctx.lineTo(px - w * 0.013, fy + fh);
        ctx.lineTo(px + w * 0.013, fy + fh); ctx.lineTo(px + w * 0.013, fy + 10);
        ctx.lineTo(px, fy); ctx.closePath(); ctx.fill();
      }
      for (const ry of [fy + fh * 0.32, fy + fh * 0.72])
        ctx.fillStyle = "#D6CFBE", ctx.fillRect(x, ry, w, 8);

      // --- hedge in front of the fence -------------------------------------
      const hy = y + h * 0.68;
      ctx.fillStyle = "#2C6B10";
      for (let i = 0; i <= 16; i++) circle(ctx, x + i * (w / 15), hy, w * 0.062, "#2C6B10");
      ctx.fillRect(x, hy, w, h * 0.09);
      ctx.save(); ctx.globalAlpha = 0.45;
      for (let i = 0; i <= 16; i++) circle(ctx, x + i * (w / 15) - 6, hy - 6, w * 0.042, "#4FAE22");
      ctx.restore();

      // --- grass, flowers, stepping stones ---------------------------------
      const gy = y + h * 0.755;
      ctx.fillStyle = "#5CC22B"; ctx.fillRect(x, gy, w, h - (gy - y));
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = "#3E9418";
      ctx.beginPath(); ctx.moveTo(x, gy);
      for (let px = 0; px <= w; px += 16)
        ctx.lineTo(x + px, gy + 14 + Math.sin(px / 60) * 6);
      ctx.lineTo(x + w, gy); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#8FE04A";
      for (let i = 0; i < 46; i++) {
        const bx = x + rnd(i, 3) * w;
        const by = gy + 4 + rnd(i, 9) * h * 0.06;
        const bh = 9 + rnd(i, 4) * 13;
        const s2 = Math.sin(t * 1.4 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(bx - 3.5, by); ctx.quadraticCurveTo(bx + s2, by - bh, bx + 3.5, by);
        ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 9; i++) {                 // flowers along the hedge
        const fx = x + (0.04 + rnd(i, 31) * 0.92) * w;
        const fby = gy + 2 + rnd(i, 32) * h * 0.03;
        const col = [C.cherry, C.candy, C.sun, C.grape][i % 4];
        ctx.save(); ctx.strokeStyle = "#3E9418"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(fx, fby); ctx.lineTo(fx, fby - 22); ctx.stroke(); ctx.restore();
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + t * 0.2;
          circle(ctx, fx + Math.cos(a) * 8, fby - 22 + Math.sin(a) * 8, 6.5, col.base);
        }
        circle(ctx, fx, fby - 22, 5, C.sun.light);
      }
      ctx.save(); ctx.globalAlpha = 0.85;
      for (let i = 0; i < 4; i++)
        ellipse(ctx, x + w * (0.66 + i * 0.09), y + h * (0.80 + i * 0.022),
          w * 0.045, h * 0.014, "#B7AE9A");
      ctx.restore();

      // --- soil bed ---------------------------------------------------------
      const sbx = x + w * 0.07, sbw = w * 0.5, sby = y + h * 0.855;
      fillRound(ctx, sbx - 8, sby - 12, sbw + 16, h * 0.115, 10, "#8A5028");  // timber edge
      fillRound(ctx, sbx, sby, sbw, h * 0.1, 8, "#6B4423");
      fillRound(ctx, sbx, sby, sbw, h * 0.03, 6, "#8A5A33");
      ctx.save(); ctx.globalAlpha = 0.3;
      for (let i = 0; i < 20; i++)
        circle(ctx, sbx + rnd(i, 7) * sbw, sby + h * 0.02 + rnd(i, 8) * h * 0.06, 3.5, "#4A2E14");
      ctx.restore();

      // --- two butterflies, because something should always be moving -------
      for (const [sp, ph, col, yy] of [[0.5, 0, C.candy, 0.46], [0.36, 2.1, C.sun, 0.53]]) {
        const bxp = x + w * (0.5 + Math.sin(t * sp + ph) * 0.32);
        const byp = y + h * (yy + Math.sin(t * 0.9 + ph) * 0.05);
        ctx.save();
        ctx.translate(bxp, byp);
        ctx.rotate(Math.cos(t * sp + ph) * 0.3);
        const flap = 0.4 + Math.sin(t * 11 + ph) * 0.6;
        for (const sgn of [-1, 1]) {
          ctx.save(); ctx.scale(sgn, 1); ctx.rotate(flap);
          ellipse(ctx, 10, -3, 11, 8, col.base);
          ellipse(ctx, 8, 7, 8, 6, col.light);
          ctx.restore();
        }
        fillRound(ctx, -2.5, -8, 5, 18, 2.5, C.coal.base);
        ctx.restore();
      }
    },
  },

  /* --------------------------------------------------------------- bath */
  bath: {
    id: "bath", name: "Bathroom",
    tint: C.sea,
    icon(ctx, cx, cy, s) {                        // a bubble-topped tub
      circle(ctx, cx - s * 0.16, cy - s * 0.3, s * 0.11, alpha("#FFFFFF", 0.9));
      circle(ctx, cx + s * 0.1, cy - s * 0.38, s * 0.08, alpha("#FFFFFF", 0.75));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.4, cy - s * 0.12); ctx.lineTo(cx + s * 0.4, cy - s * 0.12);
      ctx.lineTo(cx + s * 0.3, cy + s * 0.34); ctx.lineTo(cx - s * 0.3, cy + s * 0.34);
      ctx.closePath(); ctx.fillStyle = C.bone.light; ctx.fill();
      ctx.restore();
      fillRound(ctx, cx - s * 0.44, cy - s * 0.18, s * 0.88, s * 0.12, s * 0.06, C.bone.base);
      for (const i of [-1, 1]) fillRound(ctx, cx + i * s * 0.22, cy + s * 0.34, s * 0.1, s * 0.12, 3, C.bone.base);
    },
    // The vanity top on the right, then the floor.
    surfaces: [{ y: 0.55, x1: 0.60, x2: 0.97 }, { y: 0.92, x1: 0, x2: 1 }],
    fixtures: [
      { id: "tub", x: 0.34, y: 0.74, w: 0.52, h: 0.22, tag: "water" },
    ],
    start: [
      { thing: "duck", x: 0.34, y: 0.74 }, { thing: "soap", x: 0.70, y: 0.55 },
      { thing: "towel", x: 0.86, y: 0.55 }, { thing: "boat", x: 0.12, y: 0.92 },
    ],
    paint(ctx, R, t) {
      const { x, y, w, h } = R;
      wall(ctx, R, "#1F8FB8", "#57BEDC");

      // --- white tiling, only on the lower wall ----------------------------
      tileBand(ctx, x, y + h * 0.34, w, h * 0.56, 8, 7, "#F2FAFF", "#DCF0FB", "#A9CBDD");
      fillRound(ctx, x - 4, y + h * 0.335, w + 8, 12, 4, "#DCEFF8");   // capping rail

      // --- porthole window, upper left --------------------------------------
      const px = x + w * 0.2, py = y + h * 0.16, pr = w * 0.115;
      circle(ctx, px, py + 5, pr + 12, alpha("#0A4E68", 0.25));
      circle(ctx, px, py, pr + 12, "#E8F4FA");
      circle(ctx, px, py, pr + 5, "#9FB4BF");
      ctx.save();
      ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.clip();
      const wg = ctx.createLinearGradient(0, py - pr, 0, py + pr);
      wg.addColorStop(0, C.sky.base); wg.addColorStop(1, "#BFEAD2");
      ctx.fillStyle = wg; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      circle(ctx, px + pr * 0.4, py - pr * 0.35, pr * 0.28, C.sun.light);
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.arc(px - pr * 0.3, py + pr * 0.1, pr * 0.24, 0, 7);
      ctx.arc(px - pr * 0.02, py + pr * 0.16, pr * 0.18, 0, 7); ctx.fill();
      ctx.restore();
      for (let i = 0; i < 6; i++)                            // porthole rivets
        circle(ctx, px + Math.cos(i / 6 * 7) * (pr + 8), py + Math.sin(i / 6 * 7) * (pr + 8), 4, "#6B818C");

      // --- towel rail above the tub -----------------------------------------
      const rx = x + w * 0.36, rw = w * 0.26, ry = y + h * 0.27;
      ctx.save(); ctx.strokeStyle = "#9FB4BF"; ctx.lineWidth = 8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + rw, ry); ctx.stroke(); ctx.restore();
      [C.candy, C.sun].forEach((col, i) => {
        const hx2 = rx + rw * (0.18 + i * 0.44), hw2 = rw * 0.34, hh2 = h * 0.13;
        fillRound(ctx, hx2, ry, hw2, hh2, 6, col.base);
        fillRound(ctx, hx2, ry, hw2, hh2 * 0.18, 5, col.light);
        ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = col.dark;
        for (let k = 1; k < 4; k++) ctx.fillRect(hx2, ry + hh2 * k * 0.24, hw2, 4);
        ctx.restore();
      });

      // --- a row of fish stickers on the tiles -------------------------------
      ctx.save(); ctx.globalAlpha = 0.55;
      for (let i = 0; i < 5; i++) {
        const fx = x + w * (0.06 + i * 0.12), fy2 = y + h * (0.44 + (i % 2) * 0.035);
        const col = [C.sea, C.jade, C.grape][i % 3].base;
        ellipse(ctx, fx, fy2, 16, 11, col);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(fx - 14, fy2); ctx.lineTo(fx - 26, fy2 - 9); ctx.lineTo(fx - 26, fy2 + 9);
        ctx.closePath(); ctx.fill();
        circle(ctx, fx + 6, fy2 - 3, 3, "#FFFFFF");
      }
      ctx.restore();

      // --- floor, laid before the fixtures that stand on it -------------------
      const fly = y + h * 0.88;
      ctx.fillStyle = "#9FC4D6"; ctx.fillRect(x, fly, w, y + h - fly);
      ctx.save(); ctx.globalAlpha = 0.5;
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < 9; i++) {
          if ((i + j) % 2) continue;
          ctx.fillStyle = "#BFDCEA";
          ctx.fillRect(x + i * (w / 9), fly + j * ((y + h - fly) / 3), w / 9, (y + h - fly) / 3);
        }
      ctx.restore();
      fillRound(ctx, x - 4, fly - 10, w + 8, 14, 4, "#DCEFF8");

      // --- vanity unit, right: a counter you can put things on ---------------
      const vx = x + w * 0.575, vw = w * 0.415, vty = y + h * 0.565;
      fillRound(ctx, vx, vty + 10, vw, h * 0.33, 10, "#1F6B4E");
      fillRound(ctx, vx, vty + 6, vw, h * 0.32, 10, C.jade.dark);
      for (let i = 0; i < 2; i++) {
        const dx = vx + 10 + i * (vw - 20) / 2, dw = (vw - 20) / 2 - 6;
        fillRound(ctx, dx, vty + 22, dw, h * 0.24, 7, mix(C.jade.dark, "#FFFFFF", 0.12));
        fillRound(ctx, dx + dw * 0.3, vty + 22 + h * 0.1, dw * 0.4, 9, 5, "#F6D79A");
      }
      fillRound(ctx, vx - 8, vty - 6, vw + 16, h * 0.035, 8, "#F4F0E6");    // counter top
      fillRound(ctx, vx - 8, vty - 6, vw + 16, h * 0.014, 6, "#FFFFFF");
      // the basin sunk into the left end of the counter
      ellipse(ctx, vx + vw * 0.26, vty + h * 0.006, vw * 0.2, h * 0.016, "#BBD4E0");
      ellipse(ctx, vx + vw * 0.26, vty + h * 0.003, vw * 0.175, h * 0.012, "#7FA8BC");
      ctx.save(); ctx.strokeStyle = "#9FB4BF"; ctx.lineWidth = 7; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(vx + vw * 0.26, vty - h * 0.008);
      ctx.lineTo(vx + vw * 0.26, vty - h * 0.05);
      ctx.lineTo(vx + vw * 0.16, vty - h * 0.05);
      ctx.stroke(); ctx.restore();

      // --- round mirror over the vanity ---------------------------------------
      const mx = vx + vw * 0.5, my = y + h * 0.40, mr = w * 0.13;
      circle(ctx, mx, my + 5, mr + 11, alpha("#0A4E68", 0.2));
      circle(ctx, mx, my, mr + 11, C.sun.dark);
      circle(ctx, mx, my, mr + 6, C.sun.base);
      circle(ctx, mx, my, mr, "#CBE8F4");
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(mx - mr * 0.7, my + mr * 0.5); ctx.lineTo(mx + mr * 0.1, my - mr * 0.85);
      ctx.lineTo(mx + mr * 0.5, my - mr * 0.85); ctx.lineTo(mx - mr * 0.35, my + mr * 0.5);
      ctx.closePath(); ctx.fill(); ctx.restore();

      // --- the bathtub ------------------------------------------------------
      // Drawn as a tapered body with a rolled rim and brass feet, and outlined,
      // because a white rounded rectangle full of blue standing on white tiles
      // is an aquarium. The silhouette has to say "bath" before the water does.
      const bx = x + w * 0.06, bw = w * 0.54, by = y + h * 0.645, bh = h * 0.235;
      const taper = bw * 0.055;
      const tubPath = () => {
        ctx.beginPath();
        ctx.moveTo(bx, by + 14);
        ctx.lineTo(bx + bw, by + 14);
        ctx.quadraticCurveTo(bx + bw - taper * 0.4, by + bh, bx + bw - taper, by + bh);
        ctx.lineTo(bx + taper, by + bh);
        ctx.quadraticCurveTo(bx + taper * 0.4, by + bh, bx, by + 14);
        ctx.closePath();
      };
      for (const f of [0.17, 0.83])                                   // brass feet
        fillRound(ctx, bx + bw * f - 14, by + bh - 8, 28, 30, 9, "#C9A227");
      for (const f of [0.17, 0.83])
        fillRound(ctx, bx + bw * f - 18, by + bh + 16, 36, 12, 6, "#8E6F14");
      ctx.save();
      ctx.shadowColor = "rgba(10,60,85,0.35)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#F4F0E6"; tubPath(); ctx.fill();
      ctx.restore();
      ctx.save();                                                     // shaded belly
      tubPath(); ctx.clip();
      ctx.fillStyle = "#D7CFBC";
      ctx.fillRect(bx, by + bh * 0.62, bw, bh);
      ctx.fillStyle = alpha("#FFFFFF", 0.7);
      ctx.fillRect(bx + bw * 0.06, by + 20, bw * 0.07, bh);
      ctx.restore();
      ctx.save();                                                     // outline
      ctx.strokeStyle = "#5B87A0"; ctx.lineWidth = 4; ctx.lineJoin = "round";
      tubPath(); ctx.stroke();
      ctx.restore();
      fillRound(ctx, bx - 9, by - 2, bw + 18, 26, 13, "#FFFFFF");     // rolled rim
      fillRound(ctx, bx - 9, by + 16, bw + 18, 8, 4, "#C3D6E0");
      fillRound(ctx, bx + 14, by + 22, bw - 28, bh * 0.58, 16, C.sea.base);
      // water surface with a moving highlight
      ctx.save();
      roundRect(ctx, bx + 14, by + 22, bw - 28, bh * 0.58, 16); ctx.clip();
      ctx.fillStyle = C.sea.light;
      ctx.fillRect(bx, by + 30, bw, bh);
      ctx.fillStyle = alpha("#FFFFFF", 0.5);
      ctx.beginPath();
      ctx.moveTo(bx, by + 32);
      for (let qx = bx; qx <= bx + bw; qx += 10)
        ctx.lineTo(qx, by + 32 + Math.sin(qx / 22 + t * 2.2) * 5);
      ctx.lineTo(bx + bw, by + 52); ctx.lineTo(bx, by + 52);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 6; i++)                                   // sparkles
        circle(ctx, bx + 24 + rnd(i, 71) * (bw - 48),
          by + 44 + rnd(i, 72) * (bh * 0.4), 3, "#FFFFFF");
      ctx.restore();
      // taps, at the wall end where a tap actually lives
      ctx.save(); ctx.strokeStyle = "#9FB4BF"; ctx.lineWidth = 9; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx + 4, by - 4); ctx.lineTo(bx + 4, by - h * 0.055);
      ctx.lineTo(bx + bw * 0.17, by - h * 0.055);
      ctx.stroke(); ctx.restore();
      circle(ctx, bx + bw * 0.17, by - h * 0.055, 9, C.cherry.base);

      // --- bath mat and a plant, so the floor is not bare ---------------------
      ctx.save(); ctx.globalAlpha = 0.9;
      fillRound(ctx, x + w * 0.10, y + h * 0.925, w * 0.36, h * 0.045, 12, C.jade.base);
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 7; i++)
        ctx.fillRect(x + w * (0.11 + i * 0.05), y + h * 0.93, 6, h * 0.035);
      ctx.restore();
      plant(ctx, x + w * 0.93, y + h * 0.94, w * 0.085, C.jade.base);
    },
    overlay(ctx, R, t, world) {
      if (!world.fixtureActive?.tub) return;
      // bubbles rising out of a soapy tub
      const f = this.fixtures[0];
      ctx.save();
      for (let i = 0; i < 16; i++) {
        const p = ((t * 0.35 + rnd(i, 11)) % 1);
        const bx = R.x + R.w * (f.x - f.w / 2 + rnd(i, 12) * f.w);
        const by = R.y + R.h * f.y - p * R.h * 0.35;
        ctx.globalAlpha = (1 - p) * 0.75;
        circle(ctx, bx, by, 5 + rnd(i, 13) * 9, alpha("#FFFFFF", 0.8));
        ctx.globalAlpha = (1 - p) * 0.5;
        circle(ctx, bx - 3, by - 3, 2.4, "#FFFFFF");
      }
      ctx.restore();
    },
  },

  /* -------------------------------------------------------------- music */
  music: {
    id: "music", name: "Music Room",
    tint: C.grape,
    icon(ctx, cx, cy, s) {                        // a drum
      fillRound(ctx, cx - s * 0.34, cy - s * 0.22, s * 0.68, s * 0.46, s * 0.08, C.cherry.base);
      ellipse(ctx, cx, cy - s * 0.22, s * 0.34, s * 0.12, C.bone.light);
      ellipse(ctx, cx, cy - s * 0.22, s * 0.26, s * 0.085, C.bone.base);
      ctx.save(); ctx.strokeStyle = C.sun.base; ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * s * 0.2, cy - s * 0.16); ctx.lineTo(cx + (i + 0.5) * s * 0.2, cy + s * 0.2);
        ctx.stroke();
      }
      ctx.restore();
    },
    surfaces: [{ y: 0.58, x1: 0.05, x2: 0.95 }, { y: 0.9, x1: 0, x2: 1 }],
    fixtures: [],
    start: [
      { thing: "drum", x: 0.22, y: 0.9 }, { thing: "bell", x: 0.42, y: 0.58 },
      { thing: "horn", x: 0.62, y: 0.58 }, { thing: "shaker", x: 0.8, y: 0.58 },
      { thing: "lamp", x: 0.9, y: 0.9 },
    ],
    paint(ctx, R, t) {
      const { x, y, w, h } = R;
      wall(ctx, R, "#2A1A54", "#4B267E");

      // --- the back wall IS a curtain. Velvet folds fill the whole height,
      // which is texture rather than shapes, so nothing competes with the
      // instruments standing in front of it. ---------------------------------
      const folds = 13;
      for (let i = 0; i < folds; i++) {
        const fx = x + (i / folds) * w, fw = w / folds;
        const k = 0.5 + Math.sin(i * 1.7) * 0.5;
        ctx.fillStyle = mix("#5A1B49", "#8E2C6E", k);
        ctx.fillRect(fx, y, fw + 1, h);
        ctx.save(); ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#2C0C24";
        ctx.fillRect(fx, y, fw * 0.3, h);
        ctx.restore();
      }
      ctx.save();
      const vg = ctx.createLinearGradient(0, y, 0, y + h);
      vg.addColorStop(0, alpha("#1A0A2E", 0.6));
      vg.addColorStop(0.45, alpha("#1A0A2E", 0));
      vg.addColorStop(1, alpha("#1A0A2E", 0.55));
      ctx.fillStyle = vg; ctx.fillRect(x, y, w, h);
      ctx.restore();

      // --- swagged side drapes and a valance ----------------------------------
      ctx.fillStyle = "#B4185C";
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.06);
      for (let i = 5; i >= 0; i--)
        ctx.quadraticCurveTo(x + w * (i + 0.5) / 6, y + h * 0.135, x + w * i / 6, y + h * 0.06);
      ctx.closePath(); ctx.fill();
      fillRound(ctx, x - 4, y - 6, w + 8, h * 0.035, 6, "#8E0F46");
      for (const [sx2, dir] of [[x, 1], [x + w, -1]]) {
        ctx.fillStyle = "#96124C";
        ctx.beginPath();
        ctx.moveTo(sx2, y + h * 0.04);
        ctx.quadraticCurveTo(sx2 + dir * w * 0.2, y + h * 0.3, sx2 + dir * w * 0.1, y + h * 0.62);
        ctx.lineTo(sx2 + dir * w * 0.02, y + h * 0.62);
        ctx.lineTo(sx2, y + h * 0.04);
        ctx.closePath(); ctx.fill();
        ctx.save(); ctx.strokeStyle = C.sun.base; ctx.lineWidth = 9; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sx2 + dir * w * 0.005, y + h * 0.36);
        ctx.lineTo(sx2 + dir * w * 0.105, y + h * 0.33);
        ctx.stroke(); ctx.restore();
        circle(ctx, sx2 + dir * w * 0.11, y + h * 0.345, 9, C.sun.light);
      }

      // --- stage lights, sweeping ---------------------------------------------
      for (let i = 0; i < 3; i++) {
        const lx = x + w * (0.22 + i * 0.28);
        const col = [C.cherry, C.sun, C.jade][i];
        const sweep = Math.sin(t * 0.7 + i * 2) * w * 0.08;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.20;
        const bg = ctx.createLinearGradient(0, y, 0, y + h * 0.9);
        bg.addColorStop(0, col.light); bg.addColorStop(1, alpha(col.light, 0));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(lx - 14, y + h * 0.05); ctx.lineTo(lx + 14, y + h * 0.05);
        ctx.lineTo(lx + sweep + w * 0.19, y + h * 0.9);
        ctx.lineTo(lx + sweep - w * 0.19, y + h * 0.9);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        fillRound(ctx, lx - 17, y + h * 0.03, 34, 20, 7, "#150C2C");
        circle(ctx, lx, y + h * 0.05 + 6, 8, col.light);
      }

      // --- a mirror ball, hung centre -------------------------------------------
      const bx = x + w * 0.5, by = y + h * 0.235, br = w * 0.075;
      ctx.save(); ctx.strokeStyle = "#150C2C"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(bx, y + h * 0.06); ctx.lineTo(bx, by - br); ctx.stroke(); ctx.restore();
      circle(ctx, bx, by, br, "#7E93A8");
      ctx.save();
      ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.clip();
      for (let j = -3; j <= 3; j++)
        for (let i = -3; i <= 3; i++) {
          const k = (i + j + Math.floor(t * 2)) % 3;
          ctx.fillStyle = [alpha("#FFFFFF", 0.85), alpha("#C89BFF", 0.7), alpha("#5BB8F5", 0.6)][(k + 3) % 3];
          ctx.fillRect(bx + i * br * 0.3 - br * 0.14, by + j * br * 0.3 - br * 0.14, br * 0.26, br * 0.26);
        }
      ctx.restore();
      circle(ctx, bx - br * 0.35, by - br * 0.4, br * 0.2, alpha("#FFFFFF", 0.8));

      bunting(ctx, x - w * 0.02, y + h * 0.145, w * 1.04, 8, 18,
        [C.sun.base, C.jade.base, C.cherry.light, C.sky.base]);

      // --- floating notes --------------------------------------------------------
      ctx.save();
      for (let i = 0; i < 12; i++) {
        const p = (t * 0.12 + rnd(i, 21)) % 1;
        const nx = x + rnd(i, 22) * w + Math.sin(t + i) * 14;
        const ny = y + h * 0.88 - p * h * 0.72;
        ctx.globalAlpha = (1 - p) * 0.7;
        const col = [C.sun.light, C.jade.light, C.candy.light, C.sky.light][i % 4];
        circle(ctx, nx, ny, 8, col);
        ctx.fillStyle = col;
        ctx.fillRect(nx + 5.5, ny - 26, 4, 26);
        ctx.fillRect(nx + 5.5, ny - 26, 13, 6);
      }
      ctx.restore();

      // --- instrument shelf --------------------------------------------------------
      shelf(ctx, x + w * 0.04, y + h * 0.58, w * 0.92, C.bark.base, "#4A2A12", 18);

      // --- speaker stacks, half off-frame so the stage feels wider than it is -----
      for (const [sxp, dir] of [[x + w * 0.015, 1], [x + w * 0.985, -1]]) {
        const spw = w * 0.13, sph = h * 0.26, spx = sxp - (dir > 0 ? 0 : spw);
        fillRound(ctx, spx, y + h * 0.9 - sph, spw, sph, 8, "#1B1136");
        fillRound(ctx, spx + 5, y + h * 0.9 - sph + 5, spw - 10, sph - 10, 6, "#2B1C52");
        circle(ctx, spx + spw / 2, y + h * 0.9 - sph * 0.66, spw * 0.28, "#120B26");
        circle(ctx, spx + spw / 2, y + h * 0.9 - sph * 0.66, spw * 0.13, "#3E2A6E");
        circle(ctx, spx + spw / 2, y + h * 0.9 - sph * 0.26, spw * 0.17, "#120B26");
      }

      // --- an upright piano and a mic stand against the back wall -------------------
      // The band between the shelf and the stage floor was the one dead region
      // left in this room. Filling it with instruments rather than pattern means
      // the emptiness reads as "a stage set up to play on" instead of as a gap.
      const pw = w * 0.42, pxp = x + w * 0.05, pby = y + h * 0.895, ph2 = h * 0.24;
      fillRound(ctx, pxp - 6, pby - ph2 - 12, pw + 12, 20, 6, "#3A2110");     // lid
      planks(ctx, pxp, pby - ph2, pw, ph2, 4, "#6B3A16", "#3A2110", true);
      fillRound(ctx, pxp + 10, pby - ph2 + 16, pw - 20, ph2 * 0.3, 5, "#4A2A12"); // music desk
      const kY = pby - ph2 * 0.52, kH = ph2 * 0.17;
      fillRound(ctx, pxp + 4, kY, pw - 8, kH, 4, "#F4F0E6");                   // keys
      ctx.fillStyle = "#18242A";
      for (let i = 0; i < 14; i++) {
        if (i % 7 === 2 || i % 7 === 6) continue;
        ctx.fillRect(pxp + 10 + i * (pw - 20) / 14, kY, (pw - 20) / 26, kH * 0.62);
      }
      fillRound(ctx, pxp, kY + kH, pw, 7, 3, "#3A2110");
      for (const lf of [0.06, 0.94])                                          // legs
        ctx.fillStyle = "#3A2110", ctx.fillRect(pxp + pw * lf - 9, kY + kH + 7, 18, pby - kY - kH - 7);

      const mx2 = x + w * 0.74;
      ctx.save(); ctx.strokeStyle = "#20182E"; ctx.lineWidth = 7; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(mx2, pby); ctx.lineTo(mx2, y + h * 0.655); ctx.stroke();
      ctx.beginPath();                                                        // tripod
      ctx.moveTo(mx2 - w * 0.06, pby); ctx.lineTo(mx2, pby - h * 0.03);
      ctx.lineTo(mx2 + w * 0.06, pby); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(mx2, y + h * 0.655); ctx.rotate(-0.3);
      fillRound(ctx, -7, -6, 14, 26, 6, "#20182E");
      circle(ctx, 0, -8, 13, "#9FB4BF");
      circle(ctx, 0, -8, 9, "#4A5F6B");
      ctx.restore();

      // --- the stage: boards, a front lip, and footlights ---------------------------
      const sy = y + h * 0.9;
      planks(ctx, x, sy, w, y + h - sy, 9, "#7A4A22", "#4A2A12", true);
      fillRound(ctx, x - 4, sy - 8, w + 8, 16, 5, "#A5682F");
      ellipse(ctx, x + w / 2, sy + h * 0.065, w * 0.44, h * 0.055, C.grape.dark);
      ellipse(ctx, x + w / 2, sy + h * 0.065, w * 0.39, h * 0.045, C.grape.base);
      ctx.save(); ctx.globalAlpha = 0.5;
      ellipse(ctx, x + w / 2, sy + h * 0.065, w * 0.26, h * 0.03, C.grape.light);
      ctx.restore();
      for (let i = 0; i < 7; i++) {                             // footlights
        const lx = x + w * (0.08 + i * 0.14);
        circle(ctx, lx, sy + 4, 9, alpha(C.sun.light, 0.35 + Math.sin(t * 3 + i) * 0.2));
        circle(ctx, lx, sy + 4, 5, C.sun.light);
      }
    },
  },
};

export const SCENE_IDS = Object.keys(SCENES);
