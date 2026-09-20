/**
 * Sliding Blocks — the classic sliding-block escape puzzle.
 *
 * Slide the blocks around to free the big one through the gap at the bottom.
 * The classic layout, Heng Dao Li Ma, takes 116 single-cell moves at minimum;
 * the warm-up layouts take two.
 *
 * Why it is in a children's app: this is a pure planning problem. There is no
 * reaction, no vocabulary, no dexterity — only "if I move this, what opens
 * up?". That kind of look-ahead is the thing the rest of the games do not
 * train, and it is the reason the puzzle has survived a few hundred years.
 *
 * Making it fair for a child:
 *  - UNDO, unlimited. Planning games are learned by trying a branch and
 *    backing out of it. Without undo a child hits a dead end and quits.
 *  - The move counter shows their count against the known minimum, computed by
 *    exhaustive search at build time, so "par 13" is a fact and beating it is
 *    genuinely impossible rather than merely hard.
 *  - Blocks are dragged in the direction they can go, and they only ever move
 *    one cell, so a mis-drag is one undo away.
 *  - The exit is drawn as an opening in the frame, not explained in words.
 */

import { clamp, approach, lerp, easeOutBack } from "../../core/engine.js";
import { C, alpha, mix } from "../../core/palette.js";
import { fillRound, roundRect, circle, text } from "../../core/draw.js";
import { drawBird, birdBlink } from "../../art/bird.js";
import { lacquerHall } from "../../art/backdrops.js";
import { sfx, speak, startMusic, stopMusic } from "../../core/audio.js";
import { save } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { LAYOUTS, BOARD_W, BOARD_H, EXIT } from "./layouts.js";

const GAME_ID = "slide";

/** The big block is the hero; everything else is scenery it has to get past. */
const KIND_COLOR = {
  big: C.cherry,
  tall: C.sea,
  wide: C.grape,
  small: C.sun,
};

const kindOf = (b) =>
  b.w === 2 && b.h === 2 ? "big" :
  b.h === 2 ? "tall" :
  b.w === 2 ? "wide" : "small";

export class SlideScene {
  constructor({ levelIndex = 0, bird = "chick", onComplete }) {
    this.levelIndex = clamp(levelIndex, 0, LAYOUTS.length - 1);
    this.birdId = bird;
    this.onComplete = onComplete;
    this.def = LAYOUTS[this.levelIndex];

    this.fx = new Fx();
    this.t = 0;
    this.stateT = 0;
    this.state = "intro";     // intro | play | won
    this.moves = 0;
    this.history = [];

    this.blocks = this.def.blocks.map((b) => ({
      ...b, kind: kindOf(b), sx: b.x, sy: b.y,   // sx/sy are the animated pose
    }));

    this.cell = 80;
    this.origin = { x: 0, y: 0 };
    this.drag = null;
  }

  async enter(engine) {

    this.juice = engine.juice;
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    startMusic();
    speak("Help the big block escape");
  }

  destroy() {
    stopMusic();
  }

  resize(view) {
    const padX = 40, padTop = 210, padBottom = 190;
    const availW = view.w - padX * 2;
    const availH = view.h - padTop - padBottom;
    this.cell = Math.floor(Math.min(availW / BOARD_W, availH / BOARD_H));
    const bw = this.cell * BOARD_W, bh = this.cell * BOARD_H;
    this.origin = {
      x: view.x + (view.w - bw) / 2,
      y: view.y + padTop + Math.max(0, (availH - bh) / 2),
    };
    this.boardSize = { w: bw, h: bh };
  }

  /* -------------------------------------------------------------- rules */

  /** Grid occupancy, excluding one block if given. */
  grid(skip = null) {
    const g = Array.from({ length: BOARD_H }, () => new Array(BOARD_W).fill(null));
    for (const b of this.blocks) {
      if (b === skip) continue;
      for (let dy = 0; dy < b.h; dy++)
        for (let dx = 0; dx < b.w; dx++) g[b.y + dy][b.x + dx] = b;
    }
    return g;
  }

  canMove(b, dx, dy) {
    const nx = b.x + dx, ny = b.y + dy;
    if (nx < 0 || ny < 0 || nx + b.w > BOARD_W || ny + b.h > BOARD_H) return false;
    const g = this.grid(b);
    for (let y = ny; y < ny + b.h; y++)
      for (let x = nx; x < nx + b.w; x++) if (g[y][x]) return false;
    return true;
  }

  doMove(b, dx, dy, record = true) {
    if (!this.canMove(b, dx, dy)) return false;
    if (record) this.history.push({ block: b, dx, dy });
    b.x += dx; b.y += dy;
    this.moves++;
    sfx.step();
    if (b.kind === "big") this.checkWin();
    return true;
  }

  undo() {
    const last = this.history.pop();
    if (!last) return;
    last.block.x -= last.dx;
    last.block.y -= last.dy;
    this.moves++;   // an undo is still a move; par stays honest
    sfx.tick();
  }

  reset() {
    this.blocks.forEach((b, i) => {
      b.x = this.def.blocks[i].x;
      b.y = this.def.blocks[i].y;
    });
    this.history.length = 0;
    this.moves = 0;
    sfx.whoosh();
  }

  checkWin() {
    const big = this.blocks.find((b) => b.kind === "big");
    if (!big || big.x !== EXIT.x || big.y !== EXIT.y) return;
    this.state = "won";
    this.stateT = 0;
    sfx.fanfare();
    this.juice?.hit("medium", { freeze: false, punch: 0.9 });
    const cx = this.origin.x + (big.x + 1) * this.cell;
    const cy = this.origin.y + (big.y + 1) * this.cell;
    this.fx.burst(cx, cy, [C.sun.base, C.cherry.light, "#FFFFFF"], 40);
    speak("You did it!");
  }

  finish() {
    // Par is the true minimum, so matching it is a real achievement.
    const ratio = this.moves / Math.max(1, this.def.par);
    const stars = ratio <= 1.25 ? 3 : ratio <= 2 ? 2 : 1;
    save.recordLevel(GAME_ID, this.levelIndex, stars, this.moves);
    save.addXp(10 + stars * 4);
    save.touchStreak();
    this.onComplete?.({ stars, moves: this.moves, par: this.def.par, name: this.def.name });
  }

  /* -------------------------------------------------------------- input */

  blockAt(pt) {
    const gx = Math.floor((pt.x - this.origin.x) / this.cell);
    const gy = Math.floor((pt.y - this.origin.y) / this.cell);
    if (gx < 0 || gy < 0 || gx >= BOARD_W || gy >= BOARD_H) return null;
    return this.grid()[gy][gx];
  }

  down(pt) {
    if (this.state === "intro") { this.state = "play"; this.stateT = 0; return; }
    if (this.state === "won") { this.finish(); return; }
    if (this.undoRect && inRect(pt, this.undoRect)) { this.undo(); return; }
    if (this.resetRect && inRect(pt, this.resetRect)) { this.reset(); return; }
    const b = this.blockAt(pt);
    if (!b) return;
    this.drag = { block: b, from: { ...pt }, moved: false };
  }

  move(pt) {
    const d = this.drag;
    if (!d || d.moved) return;
    const dx = pt.x - d.from.x, dy = pt.y - d.from.y;
    const threshold = this.cell * 0.35;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
    // Commit to the dominant axis: a diagonal drag should not move twice.
    const [mx, my] = Math.abs(dx) > Math.abs(dy)
      ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    if (this.doMove(d.block, mx, my)) {
      d.moved = true;
    } else {
      d.block.nudge = { x: mx, y: my, t: 1 };
      sfx.tick();
      d.moved = true;
    }
  }

  up(pt) {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved || !pt) return;

    /**
     * A TAP slides the block: one free direction picks itself, and otherwise
     * WHERE on the block you tapped chooses.
     *
     * The puzzle was drag-only, and a drag has to clear a third of a cell on
     * the dominant axis before anything happens — so a tap, or a short
     * imprecise one from a small hand, did nothing at all. That is what
     * "sometimes it responds, sometimes it is not" is: it responded exactly
     * when the finger happened to travel far enough.
     *
     * The first version of this fix only moved a block with exactly ONE free
     * direction, on the reasoning that anything else is a guess. Driving the
     * game with a real finger showed what that costs: level one is a single
     * 2x2 block on an open board, so it has FOUR free directions and the tap
     * did nothing at all. The tutorial level, the first thing a child ever
     * touches in this game, sat there.
     *
     * So the tap is read as an aim. Tapping the right-hand side of a block
     * means right — the same thing dragging it means, without having to
     * travel far enough to prove it. Only a tap in the dead centre of a block
     * that genuinely has a choice is still ambiguous, and that one nudges.
     */
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([x, y]) => this.canMove(d.block, x, y));
    const slide = (mx, my) => {
      this.doMove(d.block, mx, my);
      this.juice?.hit("light", { freeze: false });
    };

    if (dirs.length === 1) { slide(dirs[0][0], dirs[0][1]); return; }

    if (dirs.length > 1) {
      const cx = this.origin.x + (d.block.x + d.block.w / 2) * this.cell;
      const cy = this.origin.y + (d.block.y + d.block.h / 2) * this.cell;
      const dx = pt.x - cx, dy = pt.y - cy;
      // A dead zone in the middle, or a tap that lands centrally on a big
      // block would pick a direction out of rounding noise.
      if (Math.hypot(dx, dy) > this.cell * 0.18) {
        const [mx, my] = Math.abs(dx) > Math.abs(dy)
          ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
        if (dirs.some(([a, b]) => a === mx && b === my)) { slide(mx, my); return; }
      }
    }

    // Stuck, or aimed at a wall: wiggle so the tap is visibly received.
    d.block.nudge = { x: dirs[0]?.[0] ?? 0, y: dirs[0]?.[1] ?? 0, t: 1 };
    sfx.tick();
  }

  /* --------------------------------------------------------------- loop */

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.fx.update(dt);
    if (this.state === "intro" && this.stateT > 2.8) this.state = "play";
    for (const b of this.blocks) {
      // Blocks ease to their grid slot so a move reads as a slide.
      b.sx = approach(b.sx, b.x, 22, dt);
      b.sy = approach(b.sy, b.y, 22, dt);
      if (b.nudge) {
        b.nudge.t -= dt * 5;
        if (b.nudge.t <= 0) b.nudge = null;
      }
    }
  }

  /* --------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    lacquerHall(ctx, view, this.t);

    this.drawBoard(ctx);
    for (const b of this.blocks) this.drawBlock(ctx, b);
    this.fx.draw(ctx);
    this.drawHud(ctx, view);
    if (this.state === "intro") this.drawIntro(ctx, view);
    if (this.state === "won") this.drawWon(ctx, view);
  }

  drawBoard(ctx) {
    const { x, y } = this.origin;
    const { w, h } = this.boardSize;
    const c = this.cell;
    const frame = 22;

    // lacquered tray
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    fillRound(ctx, x - frame, y - frame, w + frame * 2, h + frame * 2, 20, "#4A2418");
    ctx.restore();
    fillRound(ctx, x - frame, y - frame, w + frame * 2, h + frame * 2, 20, "#7A3F22");
    fillRound(ctx, x - frame + 5, y - frame + 5, w + frame * 2 - 10, h + frame * 2 - 10, 16, "#5B2D18");
    fillRound(ctx, x - 6, y - 6, w + 12, h + 12, 10, "#2B1610");

    // the escape gap, cut out of the bottom rail
    const gx = x + EXIT.x * c;
    ctx.save();
    ctx.fillStyle = "#120A0E";
    ctx.fillRect(gx, y + h - 2, c * 2, frame + 8);
    ctx.restore();
    // arrows pointing out of it
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(this.t * 3) * 0.25;
    ctx.fillStyle = C.sun.base;
    for (let i = 0; i < 2; i++) {
      const ax = gx + c * (0.5 + i);
      const ay = y + h + 12 + Math.sin(this.t * 3 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(ax - 12, ay); ctx.lineTo(ax + 12, ay); ctx.lineTo(ax, ay + 14);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // cell grid, faint
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#E7C9A0";
    ctx.lineWidth = 1;
    for (let i = 1; i < BOARD_W; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * c, y); ctx.lineTo(x + i * c, y + h); ctx.stroke();
    }
    for (let i = 1; i < BOARD_H; i++) {
      ctx.beginPath(); ctx.moveTo(x, y + i * c); ctx.lineTo(x + w, y + i * c); ctx.stroke();
    }
    ctx.restore();
  }

  drawBlock(ctx, b) {
    const c = this.cell;
    const pad = 4;
    const nudge = b.nudge ? { x: b.nudge.x * 5 * b.nudge.t, y: b.nudge.y * 5 * b.nudge.t } : { x: 0, y: 0 };
    const x = this.origin.x + b.sx * c + pad + nudge.x;
    const y = this.origin.y + b.sy * c + pad + nudge.y;
    const w = b.w * c - pad * 2, h = b.h * c - pad * 2;
    const ramp = KIND_COLOR[b.kind];
    const r = Math.min(14, c * 0.18);

    fillRound(ctx, x, y + 6, w, h, r, ramp.deep);
    fillRound(ctx, x, y, w, h, r, ramp.base);
    // lit top face
    fillRound(ctx, x + 4, y + 4, w - 8, h * 0.3, r * 0.7, alpha(ramp.light, 0.55));
    // grain
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = ramp.deep;
    ctx.lineWidth = 2;
    for (let i = 0; i < w / 14; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 14, y); ctx.lineTo(x + i * 14 + h * 0.3, y + h); ctx.stroke();
    }
    ctx.restore();
    // border
    roundRect(ctx, x, y, w, h, r);
    ctx.lineWidth = 3;
    ctx.strokeStyle = alpha(ramp.deep, 0.8);
    ctx.stroke();

    if (b.kind === "big") {
      // the hero block carries the bird, so it is obvious who must escape
      drawBird(ctx, x + w / 2, y + h * 0.82, Math.min(w, h) * 0.72, {
        bird: this.birdId,
        state: this.state === "won" ? "cheer" : "idle",
        t: this.t, shadow: false, blink: birdBlink(this.t, 1),
      });
    } else {
      // a simple face so the blocks read as characters, not furniture
      const cx = x + w / 2, cy = y + h / 2;
      const er = Math.min(w, h) * 0.1;
      for (const s of [-1, 1]) {
        circle(ctx, cx + s * er * 1.6, cy - er * 0.2, er, "#FFFFFF");
        circle(ctx, cx + s * er * 1.6, cy - er * 0.2, er * 0.55, "#241C1A");
      }
      ctx.save();
      ctx.lineWidth = er * 0.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#241C1A";
      ctx.beginPath();
      ctx.arc(cx, cy + er * 0.7, er * 1.1, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawHud(ctx, view) {
    const pad = 24;
    text(ctx, "✕", view.x + pad + 14, view.y + pad + 18, { size: 30, color: "#FFFFFF" });
    text(ctx, "SLIDING BLOCKS", view.x + view.w / 2, view.y + 46, { size: 22, color: C.sun.base });
    text(ctx, this.def.name.toUpperCase(), view.x + view.w / 2, view.y + 82,
      { size: 22, color: "#FFFFFF" });

    // move counter against the proven minimum
    const good = this.moves <= this.def.par;
    text(ctx, `${this.moves}`, view.x + view.w / 2 - 28, view.y + 130,
      { size: 34, color: good ? C.grass.light : C.sun.base, align: "right" });
    text(ctx, `/ ${this.def.par} best`, view.x + view.w / 2 - 18, view.y + 132,
      { size: 18, color: alpha("#FFFFFF", 0.5), align: "left" });

    const by = (this.origin?.y ?? 0) + (this.boardSize?.h ?? 0) + 62;
    const bw = 150, bh = 54;
    this.undoRect = { x: view.x + view.w / 2 - bw - 10, y: by, w: bw, h: bh };
    this.resetRect = { x: view.x + view.w / 2 + 10, y: by, w: bw, h: bh };
    for (const [r, label, ramp] of [
      [this.undoRect, "↶ UNDO", C.sea],
      [this.resetRect, "↺ AGAIN", C.slate],
    ]) {
      fillRound(ctx, r.x, r.y + 5, r.w, r.h, 27, ramp.dark);
      fillRound(ctx, r.x, r.y, r.w, r.h, 27, ramp.base);
      text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: 19, color: "#FFFFFF" });
    }
  }

  drawIntro(ctx, view) {
    const k = clamp(this.stateT * 2, 0, 1);
    const out = clamp((this.stateT - 2.2) * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.76;
    ctx.fillStyle = "#0B0508";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = 1 - out;
    const cy = view.y + view.h * 0.4;
    text(ctx, "SLIDING BLOCKS", view.x + view.w / 2, cy - 96, { size: 28, color: C.sun.base });
    text(ctx, "SLIDING BLOCKS", view.x + view.w / 2, cy - 54,
      { size: 16, color: alpha("#FFFFFF", 0.55) });
    text(ctx, this.def.name, view.x + view.w / 2, cy,
      { size: 42 * easeOutBack(k), color: "#FFFFFF" });
    text(ctx, "Slide the big block out of the gap", view.x + view.w / 2, cy + 54,
      { size: 20, color: alpha("#FFFFFF", 0.82) });
    text(ctx, `Best possible: ${this.def.par} moves`, view.x + view.w / 2, cy + 92,
      { size: 17, color: C.sun.base });
    ctx.restore();
  }

  drawWon(ctx, view) {
    const k = clamp(this.stateT * 1.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.85 * k;
    ctx.fillStyle = "#0B0508";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = k;
    const cy = view.y + view.h * 0.36;
    text(ctx, "ESCAPED!", view.x + view.w / 2, cy, { size: 54 * easeOutBack(k), color: C.sun.base });
    text(ctx, `${this.moves} moves`, view.x + view.w / 2, cy + 60, { size: 32, color: "#FFFFFF" });
    text(ctx, this.moves <= this.def.par ? "That is the perfect solution!"
                                         : `Best possible is ${this.def.par}`,
      view.x + view.w / 2, cy + 106, { size: 19, color: alpha("#FFFFFF", 0.75) });
    drawBird(ctx, view.x + view.w / 2, cy + 320, 150,
      { bird: this.birdId, state: "cheer", t: this.t });
    text(ctx, "tap to continue", view.x + view.w / 2, cy + 380,
      { size: 18, color: alpha("#FFFFFF", 0.5) });
    ctx.restore();
  }
}

const inRect = (pt, r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
