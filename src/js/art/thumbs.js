/**
 * Game thumbnails: a small painted scene for each game.
 *
 * These are drawn rather than imported for a reason. The hub deliberately
 * loads no game code — a menu whose cost grows with every game added is the
 * wrong shape — so a thumbnail cannot reach into a game's art module for the
 * real thing. Each scene is therefore a deliberate miniature, built from core
 * primitives only, aiming to be recognisable at 180px rather than accurate.
 *
 * They also have to survive being the only thing a child looks at. A
 * three-year-old cannot read "Sliding Blocks"; they can recognise a red block
 * in a wooden frame. The picture IS the label, so each one leads with the
 * single shape that game is about, in that game's colour, large.
 */

import { C, alpha, mix } from "../core/palette.js";
import { fillRound, roundRect, circle, ellipse, star } from "../core/draw.js";

/** Deterministic scatter so a thumbnail never shimmers between renders. */
const rnd = (i, salt = 0) => {
  const x = Math.sin(i * 73.3 + salt * 191.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Vertical wash used by most scenes. */
function sky(ctx, w, h, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/** A course of bricks, the motif that says "platform" in this app. */
function bricks(ctx, x, y, w, h, face, edge) {
  fillRound(ctx, x, y, w, h, 4, face);
  ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = edge; ctx.lineWidth = 1.5;
  const rows = Math.max(1, Math.round(h / 9));
  for (let j = 0; j < rows; j++) {
    const ry = y + (h / rows) * j;
    ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x + w, ry); ctx.stroke();
    const off = (j % 2) * (w / 6);
    for (let i = 0; i <= 3; i++) {
      const bx = x + off + i * (w / 3);
      if (bx <= x || bx >= x + w) continue;
      ctx.beginPath(); ctx.moveTo(bx, ry); ctx.lineTo(bx, ry + h / rows); ctx.stroke();
    }
  }
  ctx.restore();
}

/** The chick, small and front-on. Enough of it to be the same bird. */
function chick(ctx, cx, baseY, s, body = C.sun.base) {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ellipse(ctx, cx, baseY + 1, s * 0.42, s * 0.1, "#000000");
  ctx.restore();
  for (const dx of [-0.2, 0.2])                                    // feet
    fillRound(ctx, cx + dx * s - s * 0.07, baseY - s * 0.1, s * 0.14, s * 0.12, 2, C.clay.base);
  circle(ctx, cx, baseY - s * 0.45, s * 0.42, body);
  circle(ctx, cx - s * 0.16, baseY - s * 0.56, s * 0.13, alpha("#FFFFFF", 0.3));
  fillRound(ctx, cx - s * 0.08, baseY - s * 0.9, s * 0.16, s * 0.12, 3, C.cherry.base); // comb
  circle(ctx, cx + s * 0.14, baseY - s * 0.56, s * 0.08, "#16202A");                     // eye
  circle(ctx, cx + s * 0.17, baseY - s * 0.59, s * 0.03, "#FFFFFF");
  ctx.fillStyle = C.clay.base;                                                           // beak
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.3, baseY - s * 0.5); ctx.lineTo(cx + s * 0.56, baseY - s * 0.44);
  ctx.lineTo(cx + s * 0.3, baseY - s * 0.36); ctx.closePath(); ctx.fill();
}

/* ======================================================================
 * One scene per game.
 * =================================================================== */

const SCENES = {
  /** Voice platformer: a bird mid-jump between two brick pillars. */
  "say-jump"(ctx, w, h) {
    sky(ctx, w, h, "#63C6F7", "#C9EEFF");
    circle(ctx, w * 0.82, h * 0.2, h * 0.11, alpha("#FFF3A8", 0.55));
    circle(ctx, w * 0.82, h * 0.2, h * 0.075, "#FFF3A8");
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(w * 0.22, h * 0.22, h * 0.09, 0, 7);
    ctx.arc(w * 0.32, h * 0.25, h * 0.065, 0, 7); ctx.fill();
    // water below, so the pillars read as standing in something
    fillRound(ctx, 0, h * 0.78, w, h * 0.3, 0, C.sea.base);
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++)
      ellipse(ctx, w * (0.12 + i * 0.26), h * 0.83, w * 0.07, h * 0.02, "#FFFFFF");
    ctx.restore();
    bricks(ctx, w * 0.02, h * 0.62, w * 0.3, h * 0.22, C.clay.base, "#8A4E0D");
    fillRound(ctx, w * 0.0, h * 0.58, w * 0.34, h * 0.06, 4, C.grass.base);
    bricks(ctx, w * 0.66, h * 0.68, w * 0.32, h * 0.18, C.clay.base, "#8A4E0D");
    fillRound(ctx, w * 0.64, h * 0.64, w * 0.36, h * 0.06, 4, C.grass.base);
    // the arc of the jump, the thing the voice controls
    ctx.save();
    ctx.strokeStyle = alpha("#FFFFFF", 0.85); ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.55);
    ctx.quadraticCurveTo(w * 0.5, h * 0.18, w * 0.74, h * 0.6);
    ctx.stroke(); ctx.restore();
    chick(ctx, w * 0.46, h * 0.36, h * 0.3);
  },

  /** Tilt maze: a top-down board with a ball and letters to collect. */
  "tilt-maze"(ctx, w, h) {
    sky(ctx, w, h, "#2FA3E8", "#7FD3FB");
    fillRound(ctx, w * 0.06, h * 0.08, w * 0.88, h * 0.84, 10, "#1B7FC0");
    fillRound(ctx, w * 0.08, h * 0.11, w * 0.84, h * 0.78, 8, "#E4F7FF");
    ctx.fillStyle = C.sea.dark;
    for (const [x, y, bw, bh] of [
      [0.22, 0.11, 0.08, 0.36], [0.4, 0.32, 0.32, 0.08],
      [0.62, 0.52, 0.08, 0.37], [0.14, 0.62, 0.3, 0.08],
    ]) fillRound(ctx, w * (0.08 + x * 0.84), h * (0.11 + y * 0.78),
                 w * bw * 0.84, h * bh * 0.78, 3, C.sea.dark);
    ["A", "B"].forEach((ch, i) => {
      const lx = w * (0.62 + i * 0.16), ly = h * (0.24 + i * 0.44);
      fillRound(ctx, lx - w * 0.06, ly - h * 0.07, w * 0.12, h * 0.14, 4, C.sun.base);
      ctx.fillStyle = "#7A4E00";
      ctx.font = `700 ${Math.round(h * 0.11)}px system-ui`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(ch, lx, ly + 1);
    });
    circle(ctx, w * 0.24, h * 0.76, h * 0.1, C.cherry.dark);
    circle(ctx, w * 0.24, h * 0.74, h * 0.1, C.cherry.base);
    circle(ctx, w * 0.21, h * 0.71, h * 0.035, alpha("#FFFFFF", 0.7));
  },

  /** Word Mob: a flock running a narrowing road toward two gates. */
  "word-mob"(ctx, w, h) {
    sky(ctx, w, h, "#7FD3FB", "#CFEEDF");
    ctx.fillStyle = C.grass.base;
    ctx.fillRect(0, h * 0.34, w, h);
    ctx.fillStyle = "#C9A227";                       // road, in perspective
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.34); ctx.lineTo(w * 0.64, h * 0.34);
    ctx.lineTo(w * 1.02, h); ctx.lineTo(w * -0.02, h);
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#FFFFFF";
    for (let i = 0; i < 3; i++) {
      const t0 = 0.35 + i * 0.22, t1 = t0 + 0.12;
      const wide = (t) => w * (0.03 + t * 0.06);
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - wide(t0), h * (0.34 + t0 * 0.66));
      ctx.lineTo(w * 0.5 + wide(t0), h * (0.34 + t0 * 0.66));
      ctx.lineTo(w * 0.5 + wide(t1), h * (0.34 + t1 * 0.66));
      ctx.lineTo(w * 0.5 - wide(t1), h * (0.34 + t1 * 0.66));
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    for (const [gx, col] of [[0.3, C.jade], [0.7, C.cherry]]) {   // the two gates
      fillRound(ctx, w * gx - w * 0.13, h * 0.3, w * 0.26, h * 0.2, 5, alpha(col.base, 0.85));
      fillRound(ctx, w * gx - w * 0.13, h * 0.3, w * 0.26, h * 0.05, 4, col.light);
    }
    chick(ctx, w * 0.5, h * 0.93, h * 0.3);
    chick(ctx, w * 0.26, h * 0.99, h * 0.24);
    chick(ctx, w * 0.74, h * 0.99, h * 0.24);
  },

  /** Echo Pop: big bubbles with things inside, on candy pink. */
  "echo-pop"(ctx, w, h) {
    sky(ctx, w, h, "#FF4FB4", "#FF9AD8");
    const pods = [[0.27, 0.36, 0.2, C.sun], [0.7, 0.3, 0.16, C.jade], [0.5, 0.7, 0.22, C.sea]];
    for (const [x, y, r, col] of pods) {
      const cx = w * x, cy = h * y, rr = h * r;
      circle(ctx, cx, cy, rr, alpha("#FFFFFF", 0.32));
      circle(ctx, cx, cy, rr * 0.82, alpha("#FFFFFF", 0.22));
      circle(ctx, cx, cy, rr * 0.5, col.base);
      circle(ctx, cx - rr * 0.34, cy - rr * 0.38, rr * 0.16, alpha("#FFFFFF", 0.85));
      ctx.save();
      ctx.strokeStyle = alpha("#FFFFFF", 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.stroke(); ctx.restore();
    }
    for (let i = 0; i < 7; i++)
      circle(ctx, w * rnd(i, 4), h * rnd(i, 5), h * 0.02, alpha("#FFFFFF", 0.5));
  },

  /** Shape Sorter: a timber board with holes, one shape going in. */
  shapes(ctx, w, h) {
    sky(ctx, w, h, "#FFD9A8", "#F0B478");
    fillRound(ctx, w * 0.05, h * 0.3, w * 0.9, h * 0.6, 10, "#8A5028");
    fillRound(ctx, w * 0.08, h * 0.34, w * 0.84, h * 0.5, 8, "#C97F4A");
    // holes, drawn dark so they read as holes rather than shapes
    circle(ctx, w * 0.27, h * 0.58, h * 0.13, "#5C3418");
    fillRound(ctx, w * 0.45, h * 0.45, w * 0.18, h * 0.26, 4, "#5C3418");
    ctx.fillStyle = "#5C3418";
    ctx.beginPath();
    ctx.moveTo(w * 0.78, h * 0.44); ctx.lineTo(w * 0.9, h * 0.71);
    ctx.lineTo(w * 0.66, h * 0.71); ctx.closePath(); ctx.fill();
    // the piece in the child's hand
    circle(ctx, w * 0.27, h * 0.2, h * 0.14, C.cherry.dark);
    circle(ctx, w * 0.27, h * 0.17, h * 0.14, C.cherry.base);
    circle(ctx, w * 0.22, h * 0.12, h * 0.045, alpha("#FFFFFF", 0.6));
  },

  /** Tangram: the seven pieces, assembled. */
  tangram(ctx, w, h) {
    sky(ctx, w, h, "#FFE86B", "#FFC61E");
    fillRound(ctx, w * 0.08, h * 0.12, w * 0.84, h * 0.76, 8, alpha("#FFFFFF", 0.35));
    const tri = (pts, col) => {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(w * pts[0], h * pts[1]);
      ctx.lineTo(w * pts[2], h * pts[3]);
      ctx.lineTo(w * pts[4], h * pts[5]);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = alpha("#FFFFFF", 0.7); ctx.lineWidth = 1.5; ctx.stroke();
    };
    tri([0.2, 0.2, 0.5, 0.2, 0.35, 0.45], C.cherry.base);
    tri([0.5, 0.2, 0.8, 0.2, 0.65, 0.45], C.sea.base);
    tri([0.2, 0.2, 0.35, 0.45, 0.2, 0.7], C.grape.base);
    tri([0.8, 0.2, 0.8, 0.7, 0.65, 0.45], C.jade.base);
    tri([0.35, 0.45, 0.5, 0.7, 0.2, 0.7], C.flame.base);
    ctx.fillStyle = C.grass.base;                                  // the square
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.33); ctx.lineTo(w * 0.62, h * 0.48);
    ctx.lineTo(w * 0.5, h * 0.63); ctx.lineTo(w * 0.38, h * 0.48);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = alpha("#FFFFFF", 0.7); ctx.lineWidth = 1.5; ctx.stroke();
    tri([0.5, 0.7, 0.8, 0.7, 0.65, 0.45], C.candy.base);
  },

  /** Sliding blocks: the big red one, boxed in. */
  slide(ctx, w, h) {
    sky(ctx, w, h, "#F4D9B0", "#E0BA86");
    fillRound(ctx, w * 0.12, h * 0.06, w * 0.76, h * 0.88, 8, "#5C3418");
    fillRound(ctx, w * 0.15, h * 0.1, w * 0.7, h * 0.8, 6, "#F0DCC0");
    const cell = (cx, cy, cw, ch, col, edge) => {
      const x = w * (0.15 + cx * 0.175), y = h * (0.1 + cy * 0.2);
      fillRound(ctx, x + 2, y + 2, w * 0.175 * cw - 4, h * 0.2 * ch - 4, 4, edge);
      fillRound(ctx, x + 2, y + 2, w * 0.175 * cw - 4, h * 0.2 * ch - 7, 4, col);
    };
    cell(0, 0, 1, 2, C.jade.base, C.jade.dark);
    cell(1, 0, 2, 2, C.cherry.base, C.cherry.dark);       // the big block
    cell(3, 0, 1, 2, C.jade.base, C.jade.dark);
    cell(0, 2, 1, 1, C.sea.base, C.sea.dark);
    cell(1, 2, 2, 1, C.sun.base, C.sun.dark);
    cell(3, 2, 1, 1, C.sea.base, C.sea.dark);
    cell(0, 3, 1, 1, C.grape.base, C.grape.dark);
    cell(3, 3, 1, 1, C.grape.base, C.grape.dark);
    // the gap the big block has to get out through
    ctx.save(); ctx.globalAlpha = 0.5;
    fillRound(ctx, w * 0.325, h * 0.9, w * 0.35, h * 0.06, 3, C.cherry.light);
    ctx.restore();
  },

  /** Robot Path: a robot on a grid with one tile lit. */
  robot(ctx, w, h) {
    sky(ctx, w, h, "#14C48A", "#066848");
    // A proper isometric lattice: half a tile across per row, a quarter down,
    // drawn back to front so the nearer tiles overlap the farther ones.
    const tw = w * 0.15, th = h * 0.085;
    const ox = w * 0.5, oy = h * 0.42;
    const cells = [];
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++)
        cells.push({ i, j, x: ox + (i - j) * tw, y: oy + (i + j) * th });
    cells.sort((a, b) => (a.i + a.j) - (b.i + b.j));
    for (const cel of cells) {
      const lit = cel.i === 2 && cel.j === 0;
      const floor = (cel.i + cel.j) % 2 ? "#0A9166" : "#0EA778";
      ctx.fillStyle = lit ? C.sun.base : floor;
      ctx.beginPath();
      ctx.moveTo(cel.x, cel.y - th); ctx.lineTo(cel.x + tw, cel.y);
      ctx.lineTo(cel.x, cel.y + th); ctx.lineTo(cel.x - tw, cel.y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = alpha("#FFFFFF", 0.3); ctx.lineWidth = 1.5; ctx.stroke();
      if (lit) {
        ctx.save(); ctx.globalAlpha = 0.55;
        circle(ctx, cel.x, cel.y - th * 0.4, h * 0.1, C.sun.light); ctx.restore();
      }
    }
    const rx = ox - tw, ry = oy + th * 1.2;
    fillRound(ctx, rx - w * 0.1, ry - h * 0.3, w * 0.2, h * 0.2, 5, "#9FB4BF");
    fillRound(ctx, rx - w * 0.08, ry - h * 0.28, w * 0.16, h * 0.1, 3, "#16202A");
    circle(ctx, rx - w * 0.04, ry - h * 0.23, h * 0.025, C.sun.light);
    circle(ctx, rx + w * 0.04, ry - h * 0.23, h * 0.025, C.sun.light);
    fillRound(ctx, rx - w * 0.06, ry - h * 0.1, w * 0.12, h * 0.08, 3, "#6B818C");
    ctx.save(); ctx.strokeStyle = "#9FB4BF"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rx, ry - h * 0.3); ctx.lineTo(rx, ry - h * 0.37); ctx.stroke();
    ctx.restore();
    circle(ctx, rx, ry - h * 0.39, h * 0.03, C.cherry.base);
  },

  /** Balance: the scale, level, with a box on one side. */
  balance(ctx, w, h) {
    sky(ctx, w, h, "#9B5CF6", "#4B1F8E");
    ctx.save(); ctx.strokeStyle = "#E0CFFF"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.82); ctx.lineTo(w * 0.5, h * 0.34);
    ctx.moveTo(w * 0.16, h * 0.34); ctx.lineTo(w * 0.84, h * 0.34);
    ctx.stroke(); ctx.restore();
    fillRound(ctx, w * 0.34, h * 0.82, w * 0.32, h * 0.08, 4, "#E0CFFF");
    for (const px of [0.22, 0.78]) {                              // the two pans
      ctx.save(); ctx.strokeStyle = "#C89BFF"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w * px, h * 0.34); ctx.lineTo(w * px, h * 0.5); ctx.stroke();
      ctx.restore();
      fillRound(ctx, w * px - w * 0.16, h * 0.5, w * 0.32, h * 0.05, 3, "#E0CFFF");
    }
    fillRound(ctx, w * 0.12, h * 0.3, w * 0.2, h * 0.2, 5, C.sun.dark);   // the box
    fillRound(ctx, w * 0.12, h * 0.28, w * 0.2, h * 0.2, 5, C.sun.base);
    ctx.strokeStyle = "#7A4E00"; ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.16, h * 0.33, w * 0.12, h * 0.1);
    for (const [cx, col] of [[0.7, C.jade], [0.86, C.cherry]])           // cards
      fillRound(ctx, w * cx - w * 0.07, h * 0.32, w * 0.14, h * 0.18, 4, col.base);
  },

  /** Tinker Town: a corner of the kitchen, which is where it opens. */
  town(ctx, w, h) {
    sky(ctx, w, h, "#63C9AE", "#2E9E84");
    fillRound(ctx, w * 0.56, h * 0.08, w * 0.36, h * 0.3, 5, C.bark.base);
    fillRound(ctx, w * 0.59, h * 0.11, w * 0.3, h * 0.24, 3, C.sky.light);
    circle(ctx, w * 0.82, h * 0.18, h * 0.055, C.sun.light);
    fillRound(ctx, w * 0.06, h * 0.08, w * 0.4, h * 0.26, 5, C.bark.dark);
    fillRound(ctx, w * 0.09, h * 0.11, w * 0.16, h * 0.2, 3, C.bark.base);
    fillRound(ctx, w * 0.28, h * 0.11, w * 0.16, h * 0.2, 3, C.bark.base);
    // splashback, counter, hob, pot
    ctx.fillStyle = "#FFF3DE"; ctx.fillRect(0, h * 0.4, w, h * 0.22);
    fillRound(ctx, 0, h * 0.6, w, h * 0.07, 3, "#C98A4B");
    fillRound(ctx, 0, h * 0.66, w, h * 0.2, 0, C.bark.base);
    fillRound(ctx, w * 0.1, h * 0.55, w * 0.3, h * 0.06, 3, "#18242A");
    fillRound(ctx, w * 0.16, h * 0.44, w * 0.18, h * 0.12, 3, C.slate.base);
    fillRound(ctx, w * 0.14, h * 0.42, w * 0.22, h * 0.04, 2, C.slate.light);
    ctx.save(); ctx.globalAlpha = 0.6;
    for (let i = 0; i < 3; i++)
      circle(ctx, w * (0.2 + i * 0.05), h * (0.36 - i * 0.05), h * 0.03, "#FFFFFF");
    ctx.restore();
    ctx.fillStyle = "#E8B37E"; ctx.fillRect(0, h * 0.86, w, h * 0.14);
    ctx.fillStyle = "#A8663A";
    for (let i = 0; i < 4; i++) ctx.fillRect(w * (i * 0.25), h * 0.86, w * 0.125, h * 0.14);
    chick(ctx, w * 0.7, h * 0.97, h * 0.3, "#FFFFFF");
  },
};

/** Draw game `id`'s scene into a w×h box at the origin. */
export function drawThumb(ctx, id, w, h) {
  const scene = SCENES[id];
  ctx.save();
  if (scene) scene(ctx, w, h);
  else { sky(ctx, w, h, C.sea.base, C.sea.dark); }
  // a soft vignette so the tile's rounded corner reads against any background
  const g = ctx.createLinearGradient(0, h * 0.55, 0, h);
  g.addColorStop(0, alpha("#000000", 0));
  g.addColorStop(1, alpha("#000000", 0.28));
  ctx.fillStyle = g; ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.restore();
}

/** A ready-to-append canvas holding the scene, at device resolution. */
export function thumbCanvas(id, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = "100%";
  cv.style.height = "auto";
  cv.style.display = "block";
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  drawThumb(ctx, id, w, h);
  return cv;
}

export const THUMB_IDS = Object.keys(SCENES);
