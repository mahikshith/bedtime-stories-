/**
 * Shape Sorter — the geometry entry point for two- to five-year-olds.
 *
 * Drag a shape into the hole it fits. That is the whole game, and it is
 * deliberately the whole game: the documented puzzle progression for this age
 * runs single-shape inset boards at around one year, two or three shapes by
 * two, and only then anything resembling composition. Handing a three-year-old
 * a tangram skips four developmental steps.
 *
 * So the progression here is the number of shapes on the board, not the
 * subtlety of the fit, and the rules follow the same age rules as Echo Pop:
 *
 *  - no fail state, no timer, no score to lose
 *  - a wrong hole gives a soft bounce and the shape's name again, never a buzz
 *  - every shape is named aloud when picked up and when placed, because the
 *    vocabulary (circle, triangle, hexagon) is half of what is being taught
 *  - targets are enormous, and a shape released anywhere near its hole counts
 *
 * Later levels introduce discrimination that is genuinely harder for a small
 * child: square against rectangle, circle against oval — same family, different
 * proportion.
 */

import { clamp, approach, lerp, easeOutBack, shuffle, rand } from "../../core/engine.js";
import { C, alpha, mix } from "../../core/palette.js";
import { fillRound, circle, text, star as starShape } from "../../core/draw.js";
import { drawBird, birdBlink } from "../../art/bird.js";
import { toyRoom } from "../../art/backdrops.js";
import { sfx, speak, startMusic, stopMusic } from "../../core/audio.js";
import { save } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { LEVELS } from "./levels.js";

const GAME_ID = "shapes";

/**
 * Shape outlines, each defined on a unit circle of radius 1 so any shape can
 * be drawn at any size from one number.
 */
export const SHAPES = {
  circle:    { name: "circle",    sides: 0,  color: C.cherry },
  square:    { name: "square",    sides: 4,  rot: 45, color: C.sea },
  triangle:  { name: "triangle",  sides: 3,  rot: -90, color: C.sun },
  rectangle: { name: "rectangle", sides: 4,  rot: 45, sx: 1.45, sy: 0.72, color: C.grass },
  star:      { name: "star",      star: 5,   color: C.grape },
  heart:     { name: "heart",     heart: true, color: C.candy },
  hexagon:   { name: "hexagon",   sides: 6,  rot: 90, color: C.flame },
  oval:      { name: "oval",      sides: 0,  sx: 1.4, sy: 0.72, color: C.jade },
  diamond:   { name: "diamond",   sides: 4,  rot: 0, sy: 1.3, color: C.ice },
  cross:     { name: "cross",     cross: true, color: C.bark },
};

/**
 * Levels are a list of shape keys. Difficulty is the count, then the
 * introduction of same-family pairs that must be told apart.
 */

export class ShapesScene {
  constructor({ levelIndex = 0, bird = "chick", onComplete }) {
    this.levelIndex = clamp(levelIndex, 0, LEVELS.length - 1);
    this.def = LEVELS[this.levelIndex];
    this.birdId = bird;
    this.onComplete = onComplete;

    this.fx = new Fx();
    this.t = 0;
    this.stateT = 0;
    this.state = "intro";     // intro | play | won
    this.placed = 0;
    this.misses = 0;
    this.birdMood = "idle";

    this.holes = this.def.keys.map((key, i) => ({ key, i, filled: false, glow: 0 }));
    this.tiles = shuffle(this.def.keys.map((key, i) => ({
      key, i, placed: false, sx: 0, sy: 0, homeX: 0, homeY: 0,
      wobble: rand(0, 6.3), pop: 0, wrong: 0, returning: null, scale: 1,
    })));

    this.dragging = null;
    this.lastSpoken = -10;
  }

  async enter(engine) {

    this.juice = engine.juice;
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    startMusic();
  }

  destroy() {
    stopMusic();
  }

  /* ------------------------------------------------------------- layout */

  resize(view) {
    const n = this.holes.length;
    const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);

    const boardTop = view.y + 230;
    const trayH = 230;
    const boardH = view.h - 230 - trayH - 60;
    const boardW = view.w - 80;

    // Holes are sized to fill the board generously: big targets matter more
    // at this age than a tidy grid.
    this.holeR = Math.min(
      (boardW / cols) * 0.36,
      (boardH / rows) * 0.36,
      110,
    );
    // Space the holes by their own size and centre the block, rather than
    // dividing the board evenly — an even split pushes two rows to the top and
    // bottom edges with a hole of dead board between them.
    const spanX = this.holeR * 2.7, spanY = this.holeR * 2.7;
    const gridW = cols * spanX, gridH = rows * spanY;
    const startX = view.x + view.w / 2 - gridW / 2 + spanX / 2;
    const startY = boardTop + (boardH - gridH) / 2 + spanY / 2;
    this.holes.forEach((h, i) => {
      const row = Math.floor(i / cols);
      // Boustrophedon: the second row runs right-to-left so the eye follows a
      // single path across the board instead of jumping back.
      const rawCol = i % cols;
      const col = row % 2 === 1 ? cols - 1 - rawCol : rawCol;
      h.x = startX + col * spanX;
      h.y = startY + row * spanY;
    });

    this.tray = { x: view.x, y: view.y + view.h - trayH, w: view.w, h: trayH };
    this.tileR = Math.min(this.holeR * 0.92, (view.w / (n + 0.5)) * 0.4);
    const loose = this.tiles.filter((t) => !t.placed);
    loose.forEach((t, i) => {
      const slot = view.w / (loose.length + 0.4);
      t.homeX = view.x + slot * (i + 0.7);
      t.homeY = this.tray.y + this.tray.h * 0.48;
      if (!t.dragged) { t.sx = t.homeX; t.sy = t.homeY; }
    });
  }

  /* -------------------------------------------------------------- input */

  tileAt(pt) {
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const t = this.tiles[i];
      if (t.placed) continue;
      if (Math.hypot(pt.x - t.sx, pt.y - t.sy) < this.tileR * 1.25) return t;
    }
    return null;
  }

  down(pt) {
    if (this.state === "intro") { this.state = "play"; this.stateT = 0; this.say(); return; }
    if (this.state === "won") { this.finish(); return; }
    const t = this.tileAt(pt);
    if (!t) return;
    this.dragging = t;
    t.dragged = true;
    t.grab = { dx: t.sx - pt.x, dy: t.sy - pt.y };
    this.tiles.splice(this.tiles.indexOf(t), 1);
    this.tiles.push(t);
    sfx.tick();
    this.speakShape(t.key);
  }

  move(pt) {
    const t = this.dragging;
    if (!t) return;
    t.sx = pt.x + t.grab.dx;
    t.sy = pt.y + t.grab.dy;
    // Light up the hole the child is hovering, so the match is obvious.
    for (const h of this.holes) {
      h.hover = !h.filled && Math.hypot(pt.x - h.x, pt.y - h.y) < this.holeR * 1.5;
    }
  }

  up() {
    const t = this.dragging;
    if (!t) return;
    this.dragging = null;
    for (const h of this.holes) h.hover = false;

    // Nearest unfilled hole within a generous radius.
    let best = null, bestD = Infinity;
    for (const h of this.holes) {
      if (h.filled) continue;
      const d = Math.hypot(t.sx - h.x, t.sy - h.y);
      if (d < bestD) { bestD = d; best = h; }
    }
    if (!best || bestD > this.holeR * 1.7) { this.sendHome(t); return; }

    if (best.key === t.key) {
      t.placed = true;
      t.holeRef = best;
      t.sx = best.x; t.sy = best.y;
      t.pop = 1;
      best.filled = true;
      best.glow = 1;
      this.placed++;
      this.birdMood = "cheer";
      sfx.pop();
      this.juice?.hit("light", { freeze: false, punch: 0.25 }); sfx.correct();
      this.fx.burst(best.x, best.y, [SHAPES[t.key].color.light, "#FFFFFF", C.sun.base], 22);
      this.fx.ring(best.x, best.y, "#FFFFFF", 0.55);
      save.addXp(2);
      save.learnWord(SHAPES[t.key].name);
      speak(`${SHAPES[t.key].name}! Well done!`).then(() => { this.birdMood = "idle"; });
      if (this.placed >= this.holes.length) {
        this.state = "won";
        this.stateT = 0;
        sfx.fanfare();
        this.juice?.hit("medium", { freeze: false, punch: 0.9 });
      }
      this.resize(this.engine.view);
    } else {
      // Not a failure — just not that hole.
      this.misses++;
      t.wrong = 1;
      best.wrongGlow = 1;
      sfx.tick();
      this.fx.say(t.sx, t.sy - this.tileR - 16, "try another!", C.sea.light, 22);
      speak(`That is the ${SHAPES[t.key].name}`);
      this.sendHome(t);
    }
  }

  sendHome(t) {
    t.returning = { fromX: t.sx, fromY: t.sy, k: 0 };
    t.dragged = false;
  }

  /** Re-ask now and then; a toddler's attention wanders off the task. */
  say() {
    const next = this.tiles.find((t) => !t.placed);
    if (!next) return;
    this.lastSpoken = this.t;
    this.birdMood = "charge";
    speak(`Find the hole for the ${SHAPES[next.key].name}`)
      .then(() => { this.birdMood = "idle"; });
  }

  speakShape(key) {
    if (this.t - this.lastSpoken < 0.8) return;
    this.lastSpoken = this.t;
    speak(SHAPES[key].name);
  }

  finish() {
    // Everyone gets three stars. This is not a test.
    save.recordLevel(GAME_ID, this.levelIndex, 3, this.holes.length);
    save.addXp(10);
    save.touchStreak();
    this.onComplete?.({ stars: 3, placed: this.placed, total: this.holes.length });
  }

  /* --------------------------------------------------------------- loop */

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.fx.update(dt);
    if (this.state === "intro" && this.stateT > 2.8) { this.state = "play"; this.say(); }
    if (this.state === "play" && this.t - this.lastSpoken > 9) this.say();

    for (const h of this.holes) {
      h.glow = Math.max(0, h.glow - dt * 1.6);
      h.wrongGlow = Math.max(0, (h.wrongGlow ?? 0) - dt * 2);
    }
    for (const t of this.tiles) {
      t.pop = Math.max(0, t.pop - dt * 2);
      t.wrong = Math.max(0, t.wrong - dt * 2.4);
      t.wobble += dt;
      if (t.returning) {
        t.returning.k = Math.min(1, t.returning.k + dt * 3.6);
        t.sx = lerp(t.returning.fromX, t.homeX, easeOutBack(t.returning.k));
        t.sy = lerp(t.returning.fromY, t.homeY, easeOutBack(t.returning.k));
        if (t.returning.k >= 1) t.returning = null;
      }
      const want = this.dragging === t ? 1.15 : 1;
      t.scale = approach(t.scale, want, 14, dt);
    }
  }

  /* --------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    toyRoom(ctx, view, this.t);

    this.drawBoard(ctx, view);
    for (const h of this.holes) this.drawHole(ctx, h);
    this.drawTray(ctx, view);
    for (const t of this.tiles) this.drawTile(ctx, t);
    this.fx.draw(ctx);
    this.drawBird(ctx, view);
    this.drawHud(ctx, view);
    if (this.state === "intro") this.drawIntro(ctx, view);
    if (this.state === "won") this.drawWon(ctx, view);
  }

  drawBoard(ctx, view) {
    const top = view.y + 190;
    const h = this.tray.y - top - 24;
    ctx.save();
    ctx.shadowColor = "rgba(70,32,8,0.55)";
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 14;
    // Inset enough that the room is visible down both sides — a board bleeding
    // edge to edge hides the very backdrop it is meant to sit in.
    fillRound(ctx, view.x + 52, top, view.w - 104, h, 30, "#6B3C1C");
    ctx.restore();
    // Deeper wood than the room behind it. On the previous, paler timber the
    // tray dissolved into the toyRoom backdrop and stopped reading as an
    // object a child could put something into.
    fillRound(ctx, view.x + 52, top, view.w - 104, h, 30, "#A05F2A");
    fillRound(ctx, view.x + 58, top + 6, view.w - 116, h - 12, 26, "#C47E3C");
    fillRound(ctx, view.x + 66, top + 14, view.w - 132, h - 28, 22, "#E0A257");
    // wood grain
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#6B3C1C";
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const y = top + 30 + i * (h / 7);
      ctx.beginPath();
      ctx.moveTo(view.x + 72, y);
      ctx.bezierCurveTo(view.x + view.w * 0.35, y - 7, view.x + view.w * 0.65, y + 7,
                        view.x + view.w - 72, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHole(ctx, h) {
    const r = this.holeR;
    ctx.save();
    // the recess
    ctx.save();
    ctx.globalAlpha = 0.85;
    shapePath(ctx, h.key, h.x, h.y + 5, r * 1.04);
    ctx.fillStyle = "#6B3C1C";
    ctx.fill();
    ctx.restore();
    shapePath(ctx, h.key, h.x, h.y, r);
    ctx.fillStyle = h.filled ? alpha(SHAPES[h.key].color.dark, 0.4) : "#3A1F07";
    ctx.fill();

    if (!h.filled) {
      // a dashed lip so the outline reads as a target
      ctx.setLineDash([9, 8]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = h.hover ? C.grass.light : alpha("#FFFFFF", 0.55);
      shapePath(ctx, h.key, h.x, h.y, r * 1.06);
      ctx.stroke();
      ctx.setLineDash([]);
      if (h.hover) {
        ctx.globalAlpha = 0.35;
        shapePath(ctx, h.key, h.x, h.y, r * 1.18);
        ctx.fillStyle = C.grass.light;
        ctx.fill();
      }
    }
    if (h.glow > 0) {
      ctx.globalAlpha = h.glow * 0.7;
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#FFFFFF";
      shapePath(ctx, h.key, h.x, h.y, r * (1 + (1 - h.glow) * 0.5));
      ctx.stroke();
    }
    if (h.wrongGlow > 0) {
      ctx.globalAlpha = h.wrongGlow * 0.5;
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.sea.light;
      shapePath(ctx, h.key, h.x, h.y, r * 1.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTile(ctx, t) {
    const S = SHAPES[t.key];
    const base = t.placed ? this.holeR : this.tileR;
    const r = base * t.scale * (1 + t.pop * 0.2);
    const shake = t.wrong ? Math.sin(this.t * 42) * 9 * t.wrong : 0;
    const bob = t.placed || this.dragging === t ? 0 : Math.sin(t.wobble * 2) * 4;

    ctx.save();
    ctx.translate(t.sx + shake, t.sy + bob);
    if (!t.placed) {
      ctx.shadowColor = "rgba(90,45,15,0.4)";
      ctx.shadowBlur = this.dragging === t ? 26 : 12;
      ctx.shadowOffsetY = this.dragging === t ? 14 : 6;
    }
    // under-edge then face, same chunky language as everything else
    shapePath(ctx, t.key, 0, 6, r);
    ctx.fillStyle = S.color.dark;
    ctx.fill();
    ctx.shadowBlur = 0;
    shapePath(ctx, t.key, 0, 0, r);
    ctx.fillStyle = S.color.base;
    ctx.fill();
    // gloss
    ctx.save();
    shapePath(ctx, t.key, 0, 0, r);
    ctx.clip();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.34, r * 0.4, r * 0.24, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  drawTray(ctx, view) {
    const t = this.tray;
    ctx.save();
    fillRound(ctx, view.x - 10, t.y, view.w + 20, t.h + 20, 30, alpha("#8A5320", 0.28));
    ctx.restore();
    const left = this.holes.length - this.placed;
    // Sits on the rug, so it needs its own plate to stay readable.
    const label = left ? `${left} TO GO` : "ALL DONE!";
    const lw = label.length * 11 + 28;
    fillRound(ctx, view.x + view.w / 2 - lw / 2, t.y + 12, lw, 28, 14,
      alpha("#4A2410", 0.55));
    text(ctx, label, view.x + view.w / 2, t.y + 27,
      { size: 16, color: left ? "#FFE8C4" : C.grass.light });
  }

  drawBird(ctx, view) {
    drawBird(ctx, view.x + 96, view.y + 182, 120, {
      bird: this.birdId,
      state: this.birdMood === "cheer" ? "cheer" : this.birdMood === "charge" ? "charge" : "idle",
      t: this.t, power: this.birdMood === "charge" ? 0.4 : 0,
      blink: birdBlink(this.t, 3),
    });
  }

  drawHud(ctx, view) {
    text(ctx, "✕", view.x + 38, view.y + 44, { size: 30, color: "#5A3214" });
    text(ctx, this.def.name.toUpperCase(), view.x + view.w / 2 + 40, view.y + 74,
      { size: 28, color: "#5E3411" });
    text(ctx, this.def.teaches, view.x + view.w / 2 + 40, view.y + 112,
      { size: 17, color: alpha("#5E3411", 0.7) });
    // progress pips
    const n = this.holes.length, size = 18, gap = 10;
    const total = n * size + (n - 1) * gap;
    const sx = view.x + view.w / 2 - total / 2;
    for (let i = 0; i < n; i++) {
      const cx = sx + i * (size + gap) + size / 2;
      if (i < this.placed) starShape(ctx, cx, view.y + 148, size * 0.6, size * 0.28, 5, C.sun.base);
      else circle(ctx, cx, view.y + 148, size * 0.26, alpha("#5E3411", 0.3));
    }
  }

  drawIntro(ctx, view) {
    const k = clamp(this.stateT * 2, 0, 1);
    const out = clamp((this.stateT - 2.2) * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.72;
    ctx.fillStyle = "#4A2A10";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = 1 - out;
    const cy = view.y + view.h * 0.4;
    text(ctx, "SHAPE SORTER", view.x + view.w / 2, cy - 60, { size: 20, color: C.sun.base });
    text(ctx, this.def.name, view.x + view.w / 2, cy,
      { size: 48 * easeOutBack(k), color: "#FFFFFF" });
    text(ctx, this.def.teaches, view.x + view.w / 2, cy + 56,
      { size: 22, color: alpha("#FFFFFF", 0.85) });
    ctx.restore();
  }

  drawWon(ctx, view) {
    const k = clamp(this.stateT * 1.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.8 * k;
    ctx.fillStyle = "#4A2A10";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = k;
    const cy = view.y + view.h * 0.36;
    text(ctx, "PERFECT!", view.x + view.w / 2, cy, { size: 56 * easeOutBack(k), color: C.sun.base });
    text(ctx, `You sorted ${this.holes.length} shapes!`, view.x + view.w / 2, cy + 62,
      { size: 26, color: "#FFFFFF" });
    drawBird(ctx, view.x + view.w / 2, cy + 300, 160,
      { bird: this.birdId, state: "cheer", t: this.t });
    text(ctx, "tap to continue", view.x + view.w / 2, cy + 358,
      { size: 18, color: alpha("#FFFFFF", 0.55) });
    ctx.restore();
  }
}

/* --------------------------------------------------------------- shapes */

/** Trace a shape by key, centred on (cx, cy) with circumradius r. */
export function shapePath(ctx, key, cx, cy, r) {
  const S = SHAPES[key];
  const sx = (S.sx ?? 1) * r, sy = (S.sy ?? 1) * r;
  ctx.beginPath();

  if (S.heart) {
    ctx.moveTo(cx, cy + sy * 0.85);
    ctx.bezierCurveTo(cx - sx * 1.5, cy - sy * 0.2, cx - sx * 0.55, cy - sy * 1.25, cx, cy - sy * 0.35);
    ctx.bezierCurveTo(cx + sx * 0.55, cy - sy * 1.25, cx + sx * 1.5, cy - sy * 0.2, cx, cy + sy * 0.85);
    ctx.closePath();
    return;
  }
  if (S.cross) {
    const a = sx * 0.36, b = sx;
    const pts = [[-a,-b],[a,-b],[a,-a],[b,-a],[b,a],[a,a],[a,b],[-a,b],[-a,a],[-b,a],[-b,-a],[-a,-a]];
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x, cy + y) : ctx.moveTo(cx + x, cy + y)));
    ctx.closePath();
    return;
  }
  if (S.star) {
    const rot = -Math.PI / 2;
    for (let i = 0; i < S.star * 2; i++) {
      const rr = i % 2 === 0 ? 1 : 0.45;
      const a = rot + (i / (S.star * 2)) * Math.PI * 2;
      const x = cx + Math.cos(a) * sx * rr, y = cy + Math.sin(a) * sy * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    return;
  }
  if (!S.sides) {
    ctx.ellipse(cx, cy, sx, sy, 0, 0, Math.PI * 2);
    return;
  }
  const rot = ((S.rot ?? 0) * Math.PI) / 180;
  for (let i = 0; i < S.sides; i++) {
    const a = rot + (i / S.sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * sx, y = cy + Math.sin(a) * sy;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
