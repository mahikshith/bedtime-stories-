/**
 * Tangram — the classic seven-piece dissection puzzle.
 *
 * Why this game is here: shape-rotation practice is one of the few
 * interventions with measured transfer to arithmetic, and the tangram is the
 * oldest and best-tuned version of it. Composing a silhouette forces a child
 * to hold a shape in mind, rotate it mentally, and check it against a target —
 * which is the whole of early spatial reasoning in one gesture.
 *
 * How it is made playable for children:
 *
 *  - Pieces SNAP. Free-form placement validation (does this outline match that
 *    silhouette?) is a maths problem the child is made to solve with their
 *    fingertips. Instead each puzzle carries its solved placements, and a
 *    piece dropped near a matching empty slot clicks in. Generous, and it
 *    keeps the challenge on "which piece goes where", which is the lesson.
 *  - Rotation is a TAP, not a twist gesture. Two-finger rotation is beyond
 *    most under-sevens; tapping steps 45 degrees.
 *  - Difficulty is carried by what is shown, not by what is possible. Tier 1
 *    draws the seams between pieces, so it is a matching task. Tier 3 shows
 *    only the outer silhouette, so it is a real dissection problem.
 *  - Nothing can be lost. There is no timer and no fail state; the score is
 *    how few hints were used.
 */

import { clamp, approach, lerp, easeOutBack, shuffle } from "../../core/engine.js";
import { C, alpha, mix } from "../../core/palette.js";
import { fillRound, circle, text, star as starShape } from "../../core/draw.js";
import { drawBird, birdBlink } from "../../art/bird.js";
import { silkGarden } from "../../art/backdrops.js";
import { sfx, speak, startMusic, stopMusic } from "../../core/audio.js";
import { save } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { PUZZLES, PIECE_SHAPES } from "./puzzles.js";

const GAME_ID = "tangram";

/** One colour per piece type, so a child can talk about "the red one". */
const PIECE_COLOR = {
  large: C.cherry,
  medium: C.sea,
  small: C.sun,
  square: C.grass,
  para: C.grape,
};

/** Spoken names — the geometry vocabulary the game is quietly teaching. */
const PIECE_NAME = {
  large: "big triangle",
  medium: "middle triangle",
  small: "little triangle",
  square: "square",
  para: "slanted block",
};

const SNAP_DIST = 0.85;   // tangram units
const SNAP_ROT = 24;      // degrees

export class TangramScene {
  constructor({ levelIndex = 0, bird = "chick", onComplete }) {
    this.levelIndex = clamp(levelIndex, 0, PUZZLES.length - 1);
    this.birdId = bird;
    this.onComplete = onComplete;

    this.puzzle = PUZZLES[this.levelIndex];
    this.fx = new Fx();
    this.t = 0;
    this.stateT = 0;
    this.state = "intro";     // intro | play | won
    this.hints = 0;
    this.placedCount = 0;

    // Working pieces: one per solution slot, each starting in the tray.
    this.pieces = this.puzzle.solution.map((slot, i) => ({
      slot: i,
      type: slot.type,
      x: 0, y: 0, rot: 0, flip: false,   // set in resize()
      placed: false,
      drag: null,
      pop: 0,
      wrong: 0,
    }));
    // Shuffle which tray position each piece takes so the layout isn't a
    // left-to-right copy of the answer.
    this.trayOrder = shuffle(this.pieces.map((_, i) => i));

    this.unit = 60;           // px per tangram unit, set on resize
    this.board = { x: 0, y: 0, w: 0, h: 0 };
    this.tray = { y: 0, h: 0 };
    this.dragging = null;
    this.tapStart = null;
  }

  get showSeams() { return this.puzzle.tier <= 1; }
  get showGhosts() { return this.puzzle.tier <= 2; }

  async enter(engine) {

    this.juice = engine.juice;
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    startMusic();

    speak(`Make the ${this.puzzle.name}`);
  }

  destroy() {
    stopMusic();
  }

  /* ------------------------------------------------------------- layout */

  resize(view) {
    const sol = this.puzzle.solution;
    // Bounds of the solved figure, in tangram units.
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const s of sol) {
      for (const [px, py] of this.outline(s.type, s.rot, s.flip)) {
        minX = Math.min(minX, s.x + px); maxX = Math.max(maxX, s.x + px);
        minY = Math.min(minY, s.y + py); maxY = Math.max(maxY, s.y + py);
      }
    }
    const figW = maxX - minX, figH = maxY - minY;

    // The tray is deliberately tall and the pieces ride high inside it. At
    // 210 the piece line sat about a hundred pixels off the bottom of the
    // screen, which on a phone means underneath the gesture bar and under the
    // hand holding it — the one thing a child has to grab was the hardest
    // thing on screen to reach.
    const trayH = 272;
    const padTop = 150, padBottom = trayH + 40, padX = 46;
    const availW = view.w - padX * 2;
    const availH = view.h - padTop - padBottom;
    this.unit = Math.min(availW / Math.max(figW, 1), availH / Math.max(figH, 1));

    this.origin = {
      x: view.x + view.w / 2 - (minX + figW / 2) * this.unit,
      y: view.y + padTop + availH / 2 - (minY + figH / 2) * this.unit,
    };
    this.figBounds = { minX, minY, maxX, maxY };
    this.tray = { y: view.y + view.h - trayH, h: trayH, x: view.x, w: view.w };

    // The tray scale has to hold every remaining piece side by side. A large
    // triangle spans four units, which at board scale is most of the screen.
    const n = Math.max(1, this.pieces.filter((p) => !p.placed).length);
    this.trayUnit = Math.min(
      this.unit * 0.5,
      (this.tray.h * 0.62) / 4,
      (view.w / (n + 0.6)) / 2.3,
    );

    // Park unplaced pieces along the tray.
    const loose = this.pieces.filter((p) => !p.placed);
    loose.forEach((p, i) => {
      if (p.drag) return;
      const n = loose.length;
      const slotW = view.w / (n + 0.4);
      p.px = view.x + slotW * (i + 0.7);
      p.py = this.tray.y + this.tray.h * 0.40;
      p.homeX = p.px; p.homeY = p.py;
      if (!p.dragged) { p.sx = p.px; p.sy = p.py; }
      if (p.scale == null) p.scale = this.trayUnit;
    });
  }

  /** Local outline of a piece after rotation/flip, in tangram units. */
  outline(type, rot, flip) {
    const base = PIECE_SHAPES[type].poly;
    const r = (rot * Math.PI) / 180;
    const c = Math.cos(r), s = Math.sin(r);
    return base.map(([x, y]) => {
      const fx = flip ? -x : x;
      return [fx * c - y * s, fx * s + y * c];
    });
  }

  /** Screen-space polygon for a piece in its current state. */
  screenPoly(p) {
    const pts = this.outline(p.type, p.rot, p.flip);
    if (p.placed) {
      const sol = this.puzzle.solution[p.slot];
      return pts.map(([x, y]) => [
        this.origin.x + (sol.x + x) * this.unit,
        this.origin.y + (sol.y + y) * this.unit,
      ]);
    }
    // A loose piece is drawn at whatever scale it has animated to: small in
    // the tray so seven of them fit, full size once lifted, so the piece in
    // hand is the size it will be on the board.
    const k = p.scale ?? this.trayUnit;
    return pts.map(([x, y]) => [p.sx + x * k, p.sy + y * k]);
  }

  hitTest(pt) {
    // topmost first: later pieces in the tray draw over earlier ones
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      if (p.placed) continue;
      if (pointInPoly(pt, this.screenPoly(p))) return p;
    }
    return null;
  }

  /* -------------------------------------------------------------- input */

  down(pt) {
    if (this.state === "intro") { this.state = "play"; this.stateT = 0; return; }
    if (this.state === "won") { this.finish(); return; }

    // hint button
    if (this.hintRect && inRect(pt, this.hintRect)) { this.useHint(); return; }
    // flip button (only shown while dragging a flippable piece)
    if (this.flipRect && this.dragging && inRect(pt, this.flipRect)) {
      this.dragging.flip = !this.dragging.flip;
      sfx.tick();
      return;
    }

    const p = this.hitTest(pt);
    if (!p) return;
    this.dragging = p;
    p.drag = { dx: p.sx - pt.x, dy: p.sy - pt.y };
    p.dragged = true;
    this.tapStart = { x: pt.x, y: pt.y, t: this.t };
    // bring to front
    this.pieces.splice(this.pieces.indexOf(p), 1);
    this.pieces.push(p);
    sfx.tick();
  }

  move(pt) {
    const p = this.dragging;
    if (!p) return;
    p.sx = pt.x + p.drag.dx;
    p.sy = pt.y + p.drag.dy;
  }

  up(pt) {
    const p = this.dragging;
    if (!p) return;
    this.dragging = null;
    p.drag = null;

    // A short press that barely moved is a tap: rotate by 45 degrees.
    const moved = this.tapStart
      ? Math.hypot(pt.x - this.tapStart.x, pt.y - this.tapStart.y) : 99;
    if (moved < 12 && this.t - (this.tapStart?.t ?? 0) < 0.45) {
      p.rot = (p.rot + 45) % 360;
      sfx.tick();
      this.tapStart = null;
      return;
    }
    this.tapStart = null;
    this.trySnap(p);
  }

  /**
   * Snap to any unfilled slot that wants this piece type, if the piece is
   * close enough in both position and angle.
   */
  trySnap(p) {
    const ux = (p.sx - this.origin.x) / this.unit;
    const uy = (p.sy - this.origin.y) / this.unit;

    let best = null, bestD = Infinity;
    this.puzzle.solution.forEach((sol, i) => {
      if (sol.type !== p.type) return;
      if (this.pieces.some((q) => q.placed && q.slot === i)) return;
      const d = Math.hypot(sol.x - ux, sol.y - uy);
      if (d < bestD) { bestD = d; best = { sol, i }; }
    });

    if (!best || bestD > SNAP_DIST) { this.bounceHome(p); return; }

    // Angle must match too, allowing for the piece's own symmetry: a square
    // looks the same every 90 degrees, so demanding an exact angle would be
    // an arbitrary obstacle.
    const period = symmetryPeriod(p.type);
    const dRot = angleDelta(p.rot, best.sol.rot, period);
    const flipOk = PIECE_SHAPES[p.type].flippable ? p.flip === best.sol.flip : true;
    if (Math.abs(dRot) > SNAP_ROT || !flipOk) {
      p.wrong = 1;
      sfx.wrong();
      this.juice?.hit("medium");
      this.fx.say(p.sx, p.sy - 40, Math.abs(dRot) > SNAP_ROT ? "turn it!" : "flip it!",
        C.cherry.light, 22);
      this.bounceHome(p);
      return;
    }

    p.placed = true;
    p.slot = best.i;
    p.rot = best.sol.rot;
    p.flip = best.sol.flip;
    p.pop = 1;
    this.placedCount++;
    sfx.pop();
    this.juice?.hit("light", { freeze: false, punch: 0.25 });
    sfx.coin();
    this.juice?.hit("light", { freeze: false });
    const cx = this.origin.x + best.sol.x * this.unit;
    const cy = this.origin.y + best.sol.y * this.unit;
    this.fx.burst(cx, cy, [PIECE_COLOR[p.type].light, "#FFFFFF"], 14);
    this.fx.ring(cx, cy, PIECE_COLOR[p.type].light, 0.5);
    save.addXp(2);

    if (this.placedCount >= this.pieces.length) {
      this.state = "won";
      this.stateT = 0;
      sfx.fanfare();
      this.juice?.hit("medium", { freeze: false, punch: 0.9 });
      speak(`You made the ${this.puzzle.name}!`);
      const bx = this.origin.x + ((this.figBounds.minX + this.figBounds.maxX) / 2) * this.unit;
      const by = this.origin.y + ((this.figBounds.minY + this.figBounds.maxY) / 2) * this.unit;
      this.fx.burst(bx, by, [C.sun.base, C.grass.light, C.sea.light, "#FFFFFF"], 46);
    }
    this.resize(this.engine.view);
  }

  bounceHome(p) {
    p.returning = { fromX: p.sx, fromY: p.sy, t: 0 };
    p.dragged = false;
  }

  /** A hint places the next piece for you, and costs a star. */
  useHint() {
    const next = this.pieces.find((p) => !p.placed);
    if (!next || this.state !== "play") return;
    this.hints++;
    const sol = this.puzzle.solution[
      this.puzzle.solution.findIndex((s, i) =>
        s.type === next.type && !this.pieces.some((q) => q.placed && q.slot === i))
    ];
    next.rot = sol.rot; next.flip = sol.flip;
    next.sx = this.origin.x + sol.x * this.unit;
    next.sy = this.origin.y + sol.y * this.unit;
    speak(`The ${PIECE_NAME[next.type]} goes here`);
    this.trySnap(next);
  }

  finish() {
    // Stars come from independence, not speed.
    const stars = this.hints === 0 ? 3 : this.hints <= 2 ? 2 : 1;
    save.recordLevel(GAME_ID, this.levelIndex, stars, this.pieces.length);
    save.addXp(8 + stars * 4);
    save.touchStreak();
    this.onComplete?.({ stars, hints: this.hints, name: this.puzzle.name });
  }

  /* --------------------------------------------------------------- loop */

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.fx.update(dt);
    if (this.state === "intro" && this.stateT > 2.8) this.state = "play";

    for (const p of this.pieces) {
      p.pop = Math.max(0, p.pop - dt * 2.2);
      p.wrong = Math.max(0, p.wrong - dt * 2.6);
      if (!p.placed) {
        const want = (this.dragging === p) ? this.unit : this.trayUnit;
        p.scale = approach(p.scale ?? this.trayUnit, want, 16, dt);
      }
      if (p.returning) {
        p.returning.t += dt * 3.4;
        const k = Math.min(1, p.returning.t);
        p.sx = lerp(p.returning.fromX, p.homeX, easeOutBack(k));
        p.sy = lerp(p.returning.fromY, p.homeY, easeOutBack(k));
        if (k >= 1) p.returning = null;
      }
    }
  }

  /* --------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    silkGarden(ctx, view, this.t);

    this.drawTarget(ctx);
    // The tray is a backdrop, so it goes down before the pieces that sit in it.
    this.drawTray(ctx, view);
    for (const p of this.pieces) if (p.placed) this.drawPiece(ctx, p);
    for (const p of this.pieces) if (!p.placed) this.drawPiece(ctx, p);
    this.fx.draw(ctx);
    this.drawHud(ctx, view);
    if (this.state === "intro") this.drawIntro(ctx, view);
    if (this.state === "won") this.drawWon(ctx, view);
  }


  /**
   * The silhouette, drawn from the solution so outline and answer can never
   * disagree.
   *
   * Stroking each solution piece would draw every internal seam, which hands
   * the player the answer. Instead the union is built by filling AND stroking
   * every piece in the outline colour — the thick stroke grows each piece into
   * its neighbours — then filling them all again in shadow on top. What
   * survives is the outer edge only. Tier 1 adds the seams back deliberately,
   * because at that level the puzzle is meant to be a matching task.
   */
  drawTarget(ctx) {
    const polys = this.puzzle.solution.map((sol) =>
      this.outline(sol.type, sol.rot, sol.flip).map(([x, y]) => [
        this.origin.x + (sol.x + x) * this.unit,
        this.origin.y + (sol.y + y) * this.unit,
      ]));

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 9;
    ctx.shadowColor = alpha(C.sun.base, 0.5);
    ctx.shadowBlur = 24;
    ctx.strokeStyle = C.sun.base;
    ctx.fillStyle = C.sun.base;
    for (const pts of polys) { path(ctx, pts); ctx.fill(); ctx.stroke(); }
    ctx.restore();

    ctx.save();
    // Stroked as well as filled: adjacent polygons leave a hairline of
    // antialiasing between them, and those hairlines spell out the solution.
    ctx.fillStyle = "#0A1A22";
    ctx.strokeStyle = "#0A1A22";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    for (const pts of polys) { path(ctx, pts); ctx.fill(); ctx.stroke(); }
    ctx.restore();

    if (this.showSeams) {
      ctx.save();
      ctx.setLineDash([8, 7]);
      ctx.lineWidth = 3;
      this.puzzle.solution.forEach((sol, i) => {
        if (this.pieces.some((q) => q.placed && q.slot === i)) return;
        ctx.strokeStyle = alpha(PIECE_COLOR[sol.type].base, 0.7);
        path(ctx, polys[i]);
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  drawPiece(ctx, p) {
    const pts = this.screenPoly(p);
    const ramp = PIECE_COLOR[p.type];
    const lift = p.placed ? 3 : 7;
    const shake = p.wrong ? Math.sin(this.t * 48) * 7 * p.wrong : 0;

    ctx.save();
    if (shake) ctx.translate(shake, 0);
    if (p.pop > 0) {
      // pop the piece on landing
      const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length;
      const cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
      const k = 1 + p.pop * 0.16;
      ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
    }

    // under-edge
    path(ctx, pts.map(([x, y]) => [x, y + lift]));
    ctx.fillStyle = ramp.dark;
    ctx.fill();
    // face
    path(ctx, pts);
    ctx.fillStyle = p.wrong ? mix(ramp.base, "#FFFFFF", 0.4) : ramp.base;
    ctx.fill();
    // lit bevel along the top-left edges
    ctx.save();
    path(ctx, pts);
    ctx.clip();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 6;
    ctx.strokeStyle = ramp.light;
    path(ctx, pts);
    ctx.stroke();
    ctx.restore();
    // outline
    path(ctx, pts);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = alpha(ramp.deep, 0.85);
    ctx.stroke();
    ctx.restore();
  }

  drawTray(ctx, view) {
    const t = this.tray;
    ctx.save();
    fillRound(ctx, view.x - 10, t.y, view.w + 20, t.h + 20, 26, "#0C1A21");
    ctx.globalAlpha = 0.5;
    fillRound(ctx, view.x - 10, t.y, view.w + 20, 5, 3, alpha(C.sun.base, 0.5));
    ctx.restore();
    const left = this.pieces.filter((p) => !p.placed).length;
    text(ctx, left ? `${left} PIECE${left > 1 ? "S" : ""} LEFT` : "ALL PLACED!",
      view.x + view.w / 2, t.y + 26,
      { size: 15, color: left ? alpha("#FFFFFF", 0.55) : C.grass.light });
  }

  drawHud(ctx, view) {
    const pad = 24;
    text(ctx, "✕", view.x + pad + 14, view.y + pad + 18, { size: 30, color: "#FFFFFF" });
    text(ctx, this.puzzle.name.toUpperCase(), view.x + view.w / 2, view.y + 52,
      { size: 30, color: "#FFFFFF" });
    text(ctx, ["", "MATCH THE PIECES", "FIT THEM IN", "NO CLUES — YOU CAN DO IT"][this.puzzle.tier],
      view.x + view.w / 2, view.y + 88, { size: 15, color: C.sun.base });

    // tap-to-turn reminder while a piece is in hand
    if (this.dragging) {
      text(ctx, "tap a piece to turn it", view.x + view.w / 2, view.y + 120,
        { size: 15, color: alpha("#FFFFFF", 0.5) });
    }

    // hint button
    const hw = 132, hh = 48;
    this.hintRect = { x: view.x + view.w - pad - hw, y: view.y + pad + 44, w: hw, h: hh };
    const r = this.hintRect;
    fillRound(ctx, r.x, r.y + 4, r.w, r.h, 24, C.sea.dark);
    fillRound(ctx, r.x, r.y, r.w, r.h, 24, C.sea.base);
    text(ctx, "💡 HINT", r.x + r.w / 2, r.y + r.h / 2, { size: 18, color: "#FFFFFF" });

    // flip button, only while holding the one chiral piece
    if (this.dragging && PIECE_SHAPES[this.dragging.type].flippable) {
      const fw = 120, fh = 48;
      this.flipRect = { x: view.x + pad, y: view.y + pad + 44, w: fw, h: fh };
      const f = this.flipRect;
      fillRound(ctx, f.x, f.y + 4, f.w, f.h, 24, C.grape.dark);
      fillRound(ctx, f.x, f.y, f.w, f.h, 24, C.grape.base);
      text(ctx, "⇄ FLIP", f.x + f.w / 2, f.y + f.h / 2, { size: 18, color: "#FFFFFF" });
    } else {
      this.flipRect = null;
    }

    if (this.hints) {
      text(ctx, `hints used: ${this.hints}`, view.x + view.w - pad, view.y + pad + 118,
        { size: 14, color: alpha("#FFFFFF", 0.45), align: "right" });
    }
  }

  drawIntro(ctx, view) {
    const k = clamp(this.stateT * 2, 0, 1);
    const out = clamp((this.stateT - 2.2) * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.75;
    ctx.fillStyle = "#050E12";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = 1 - out;
    const cy = view.y + view.h * 0.4;
    text(ctx, "TANGRAM", view.x + view.w / 2, cy - 96, { size: 30, color: C.sun.base });
    text(ctx, "TANGRAM", view.x + view.w / 2, cy - 56, { size: 16, color: alpha("#FFFFFF", 0.55) });
    text(ctx, `Make the ${this.puzzle.name}`, view.x + view.w / 2, cy,
      { size: 42 * easeOutBack(k), color: "#FFFFFF" });
    text(ctx, "drag a piece · tap it to turn", view.x + view.w / 2, cy + 56,
      { size: 20, color: alpha("#FFFFFF", 0.8) });
    drawBird(ctx, view.x + view.w / 2, cy + 210, 130,
      { bird: this.birdId, state: "idle", t: this.t, blink: birdBlink(this.t, 2) });
    ctx.restore();
  }

  drawWon(ctx, view) {
    const k = clamp(this.stateT * 1.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.84 * k;
    ctx.fillStyle = "#050E12";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = k;
    const cy = view.y + view.h * 0.36;
    text(ctx, "SOLVED!", view.x + view.w / 2, cy, { size: 54 * easeOutBack(k), color: C.sun.base });
    text(ctx, this.puzzle.name, view.x + view.w / 2, cy + 58, { size: 32, color: "#FFFFFF" });
    text(ctx, this.hints ? `${this.hints} hint${this.hints > 1 ? "s" : ""} used` : "No hints — brilliant!",
      view.x + view.w / 2, cy + 106, { size: 20, color: alpha("#FFFFFF", 0.75) });
    drawBird(ctx, view.x + view.w / 2, cy + 320, 150,
      { bird: this.birdId, state: "cheer", t: this.t });
    text(ctx, "tap to continue", view.x + view.w / 2, cy + 380,
      { size: 18, color: alpha("#FFFFFF", 0.5) });
    ctx.restore();
  }
}

/* --------------------------------------------------------------- helpers */

function path(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt.y) !== (yj > pt.y) &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const inRect = (pt, r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;

/** Rotational symmetry of each piece, in degrees. */
function symmetryPeriod(type) {
  return type === "square" ? 90 : type === "para" ? 180 : 360;
}

/** Smallest signed angle between a and b, modulo the piece's symmetry. */
function angleDelta(a, b, period) {
  let d = (((a - b) % period) + period) % period;
  if (d > period / 2) d -= period;
  return d;
}
