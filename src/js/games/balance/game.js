/**
 * Balance — algebra before notation.
 *
 * Get the box alone on its side of the scale. Two moves exist:
 *
 *   drag a card from the deck   it lands on BOTH pans, because the scale must
 *                               stay balanced ("do the same to both sides")
 *   drop a card on its shadow   both vanish ("a thing and its opposite make
 *                               nothing")
 *
 * That is the entire ruleset, and it is enough to solve linear equations. A
 * child who clears "box + a = b" by adding shadow-a to both sides and
 * cancelling has performed a derivation. They are told none of this.
 *
 * The scale NEVER tilts. A tilting scale would suggest the sides can differ,
 * which is the one idea the game exists to rule out — every legal move keeps
 * the two sides equal, and the level art should say so at all times.
 *
 * Later tiers relabel the same creatures as numerals and the box as x. The
 * notation lands on a skill the child already owns, which is the opposite of
 * how algebra is usually introduced.
 */

import { clamp, approach, lerp, easeOutBack } from "../../core/engine.js";
import { C, alpha, mix } from "../../core/palette.js";
import { fillRound, roundRect, circle, ellipse, text } from "../../core/draw.js";
import { drawBird, birdBlink } from "../../art/bird.js";
import { starLab } from "../../art/backdrops.js";
import { sfx, speak, startMusic, stopMusic } from "../../core/audio.js";
import { save } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { LEVELS, LABELS, BOX_LABEL } from "./levels.js";
import { BOX, makeState, isSolved, cancel, addBoth, shadowOf, baseOf, isShadow, solve }
  from "./rules.js";

const GAME_ID = "balance";

/** One colour per creature, so a child can say "the red one". */
const CARD_COLOR = {
  a: C.cherry, b: C.sea, c: C.sun, d: C.grass, e: C.grape, f: C.flame,
};

export class BalanceScene {
  constructor({ levelIndex = 0, bird = "chick", onComplete }) {
    this.levelIndex = clamp(levelIndex, 0, LEVELS.length - 1);
    this.def = LEVELS[this.levelIndex];
    this.birdId = bird;
    this.onComplete = onComplete;

    this.state = makeState(this.def.left, this.def.right);
    this.par = solve(makeState(this.def.left, this.def.right), this.def.deck, 9)?.length ?? 99;

    this.fx = new Fx();
    this.t = 0;
    this.phase = "intro";     // intro | play | won
    this.phaseT = 0;
    this.moves = 0;

    this.cards = [];          // laid out each frame from the state
    this.drag = null;
    this.hintT = 0;
  }

  async enter(engine) {
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    startMusic();
    const cv = engine.canvas;
    this._pd = (e) => this.down(engine.toLocal(e));
    this._pm = (e) => this.move(engine.toLocal(e));
    this._pu = (e) => this.up(engine.toLocal(e));
    cv.addEventListener("pointerdown", this._pd);
    window.addEventListener("pointermove", this._pm);
    window.addEventListener("pointerup", this._pu);
    window.addEventListener("pointercancel", this._pu);
  }

  destroy() {
    stopMusic();
    this.engine?.canvas.removeEventListener("pointerdown", this._pd);
    window.removeEventListener("pointermove", this._pm);
    window.removeEventListener("pointerup", this._pu);
    window.removeEventListener("pointercancel", this._pu);
  }

  resize(view) {
    this.beamY = view.y + 300;
    this.panTop = this.beamY + 64;
    this.panW = Math.min(276, view.w * 0.42);
    // Capped: a pan sized purely by what's left over becomes a tall empty box
    // with two cards floating in the middle of it.
    this.panH = clamp(view.h - (this.panTop - view.y) - 400, 260, 520);
    this.panX = { left: view.x + view.w * 0.26, right: view.x + view.w * 0.74 };
    this.deckY = view.y + view.h - 210;
    this.cardSize = Math.min(78, this.panW / 2.6);
  }

  /* ------------------------------------------------------------- layout */

  /** Position every card from the current state. Recomputed each frame so the
   *  layout is always a pure function of the equation. */
  layout() {
    const out = [];
    for (const side of ["left", "right"]) {
      const pan = this.state[side];
      const cols = Math.min(2, Math.max(1, Math.ceil(pan.length / 3)));
      const s = this.cardSize;
      const gap = 10;
      const rows = Math.ceil(pan.length / cols);
      const w = cols * s + (cols - 1) * gap;
      const h = rows * s + (rows - 1) * gap;
      const x0 = this.panX[side] - w / 2;
      const y0 = this.panTop + 26 + Math.max(0, (this.panH - 60 - h) / 2);
      pan.forEach((term, i) => {
        const cx = i % cols, cy = Math.floor(i / cols);
        out.push({
          term, side, index: i,
          x: x0 + cx * (s + gap), y: y0 + cy * (s + gap), s,
        });
      });
    }
    // deck
    const d = this.def.deck;
    const s = this.cardSize;
    const gap = 14;
    const w = d.length * s + (d.length - 1) * gap;
    const x0 = this.engine.view.x + this.engine.view.w / 2 - w / 2;
    d.forEach((term, i) => {
      out.push({ term, side: "deck", index: i, x: x0 + i * (s + gap), y: this.deckY, s });
    });
    this.cards = out;
    return out;
  }

  cardAt(pt) {
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const c = this.cards[i];
      if (pt.x >= c.x && pt.x <= c.x + c.s && pt.y >= c.y && pt.y <= c.y + c.s) return c;
    }
    return null;
  }

  /* -------------------------------------------------------------- input */

  down(pt) {
    if (this.phase === "intro") { this.phase = "play"; this.phaseT = 0; return; }
    if (this.phase === "won") { this.finish(); return; }
    const c = this.cardAt(pt);
    if (!c || c.term === BOX) return;
    this.drag = { ...c, gx: pt.x - c.x, gy: pt.y - c.y, px: c.x, py: c.y };
    sfx.tick();
  }

  move(pt) {
    if (!this.drag) return;
    this.drag.px = pt.x - this.drag.gx;
    this.drag.py = pt.y - this.drag.gy;
    const over = this.cardAt({ x: pt.x, y: pt.y });
    this.drag.over = (over && over !== this.drag && this.isCancelTarget(this.drag, over)) ? over : null;
  }

  /** A drop cancels only within the same pan, and only onto the exact shadow. */
  isCancelTarget(from, to) {
    if (from.side === "deck" || to.side === "deck") return false;
    if (from.side !== to.side) return false;
    if (to.term === BOX || from.term === BOX) return false;
    return to.term === shadowOf(from.term);
  }

  up(pt) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;

    const over = this.cardAt({ x: pt.x, y: pt.y });
    if (over && this.isCancelTarget(d, over)) {
      const next = cancel(this.state, d.side, d.index, over.index);
      if (next) {
        this.state = next;
        this.moves++;
        sfx.pop(); sfx.correct();
        const cx = (d.px + over.x) / 2 + d.s / 2, cy = (d.py + over.y) / 2 + d.s / 2;
        this.fx.burst(cx, cy, [C.grass.light, "#FFFFFF"], 20);
        this.fx.say(cx, cy - 30, "gone!", C.grass.light, 24);
        this.check();
        return;
      }
    }

    if (d.side === "deck") {
      // Dropped on the board: the card lands on BOTH pans. This is the whole
      // lesson, so it is animated as two cards flying apart from the drop.
      const view = this.engine.view;
      const onBoard = pt.y < this.deckY - 20;
      if (onBoard) {
        this.state = addBoth(this.state, d.term);
        this.moves++;
        sfx.coin();
        for (const side of ["left", "right"]) {
          this.fx.ring(this.panX[side], this.panTop + this.panH / 2, C.sun.light, 0.5);
        }
        this.fx.say(view.x + view.w / 2, this.beamY - 40, "BOTH SIDES!", C.sun.light, 26);
        this.check();
        return;
      }
    }
    sfx.whoosh();
  }

  check() {
    if (!isSolved(this.state)) return;
    this.phase = "won";
    this.phaseT = 0;
    sfx.fanfare();
    const side = this.state.left.length === 1 ? "left" : "right";
    this.fx.burst(this.panX[side], this.panTop + this.panH / 2,
      [C.sun.base, C.grass.light, "#FFFFFF"], 40);
    speak("The box is all alone!");
  }

  finish() {
    const stars = this.moves <= this.par ? 3 : this.moves <= this.par + 2 ? 2 : 1;
    save.recordLevel(GAME_ID, this.levelIndex, stars, this.moves);
    save.addXp(10 + stars * 4);
    save.touchStreak();
    this.onComplete?.({ stars, moves: this.moves, par: this.par });
  }

  /* --------------------------------------------------------------- loop */

  update(dt) {
    this.t += dt;
    this.phaseT += dt;
    this.fx.update(dt);
    this.hintT += dt;
    if (this.phase === "intro" && this.phaseT > 3) this.phase = "play";
  }

  /* --------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    starLab(ctx, view, this.t);

    this.layout();
    this.drawScale(ctx, view);
    this.drawPans(ctx, view);
    this.drawDeck(ctx, view);

    for (const c of this.cards) {
      if (this.drag && c.side === this.drag.side && c.index === this.drag.index) continue;
      this.drawCard(ctx, c.term, c.x, c.y, c.s, c === this.drag?.over);
    }
    this.fx.draw(ctx);
    if (this.drag) this.drawCard(ctx, this.drag.term, this.drag.px, this.drag.py, this.drag.s, false, 1.12);

    this.drawHud(ctx, view);
    if (this.phase === "intro") this.drawIntro(ctx, view);
    if (this.phase === "won") this.drawWon(ctx, view);
  }

  /** The beam. Always level: every legal move preserves the equality. */
  drawScale(ctx, view) {
    const y = this.beamY;
    const x1 = this.panX.left, x2 = this.panX.right;
    // post
    fillRound(ctx, view.x + view.w / 2 - 12, y, 24, this.panTop - y + 30, 12, "#6B4E9E");
    fillRound(ctx, view.x + view.w / 2 - 8, y, 8, this.panTop - y + 30, 8, "#8D6BC4");
    // beam
    fillRound(ctx, x1 - 20, y - 10, x2 - x1 + 40, 20, 10, "#8D6BC4");
    fillRound(ctx, x1 - 20, y - 10, x2 - x1 + 40, 8, 6, "#B79BE4");
    // pivot
    circle(ctx, view.x + view.w / 2, y, 20, "#B79BE4");
    circle(ctx, view.x + view.w / 2, y, 11, "#5A3F86");
    // hangers
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#8D6BC4";
    for (const x of [x1, x2]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, this.panTop);
      ctx.stroke();
    }
    ctx.restore();
    // the equals sign, which is the point of the whole picture
    const cx = view.x + view.w / 2;
    for (const dy of [-9, 9]) {
      fillRound(ctx, cx - 22, this.panTop + this.panH / 2 + dy - 5, 44, 11, 6, alpha(C.sun.base, 0.9));
    }
  }

  drawPans(ctx, view) {
    for (const side of ["left", "right"]) {
      const x = this.panX[side] - this.panW / 2;
      const y = this.panTop;
      const solved = this.state[side].length === 1 && this.state[side][0] === BOX;
      ctx.save();
      // Opaque and darker than the night sky behind them, so the two sides of
      // the equation read as trays rather than as patches of sky.
      fillRound(ctx, x, y + 7, this.panW, this.panH, 24, "#150C2C");
      fillRound(ctx, x, y, this.panW, this.panH, 24, "#2A1B52");
      fillRound(ctx, x + 5, y + 5, this.panW - 10, this.panH - 10, 20, "#392468");
      if (solved) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = alpha(C.grass.light, 0.6 + Math.sin(this.t * 5) * 0.3);
        roundRect(ctx, x, y, this.panW, this.panH, 24);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawDeck(ctx, view) {
    if (!this.def.deck.length) return;
    const y = this.deckY;
    ctx.save();
    fillRound(ctx, view.x + 20, y - 40, view.w - 40, this.cardSize + 72, 24, alpha("#1A1030", 0.75));
    ctx.restore();
    text(ctx, "DRAG A CARD — IT GOES ON BOTH SIDES", view.x + view.w / 2, y - 18,
      { size: 14, color: alpha(C.sun.base, 0.9) });
  }

  /**
   * A card. Day cards are bright with open eyes; shadow cards are the same
   * creature at night, dark with a crescent moon. Matching a creature to its
   * own night form is a far more legible rule for a child than "+a and -a".
   */
  drawCard(ctx, term, x, y, s, highlight = false, scale = 1) {
    const size = s * scale;
    const ox = x - (size - s) / 2, oy = y - (size - s) / 2;
    const isBox = term === BOX;
    const night = isShadow(term);
    const base = baseOf(term);
    const ramp = isBox ? C.jade : (CARD_COLOR[base] ?? C.sea);
    const face = night ? mix(ramp.deep, "#000000", 0.35) : ramp.base;
    const edge = night ? "#0A0614" : ramp.dark;

    ctx.save();
    if (highlight) {
      ctx.shadowColor = C.grass.light;
      ctx.shadowBlur = 26;
    }
    fillRound(ctx, ox, oy + 6, size, size, 16, edge);
    fillRound(ctx, ox, oy, size, size, 16, face);
    if (!night) fillRound(ctx, ox + 5, oy + 5, size - 10, size * 0.26, 10, alpha(ramp.light, 0.6));
    ctx.restore();

    const cx = ox + size / 2, cy = oy + size / 2;
    const label = isBox ? BOX_LABEL[this.def.tier] : (LABELS[this.def.tier]?.[base] ?? "");

    if (isBox) {
      // The unknown is a crate with the bird peeking out — the thing being
      // rescued, which is a far better motivation than "solve for x".
      fillRound(ctx, ox + 7, oy + size * 0.42, size - 14, size * 0.5, 8, mix(C.bark.base, "#000000", 0.1));
      drawBird(ctx, cx, oy + size * 0.6, size * 0.52, {
        bird: this.birdId, state: this.phase === "won" ? "cheer" : "idle",
        t: this.t, shadow: false, blink: birdBlink(this.t, 1),
      });
      if (label) {
        text(ctx, label, cx, oy + size * 0.78, { size: size * 0.3, color: "#FFFFFF" });
      }
      return;
    }

    // creature face
    const er = size * 0.1;
    for (const sgn of [-1, 1]) {
      if (night) {
        // asleep
        ctx.save();
        ctx.lineWidth = er * 0.55;
        ctx.lineCap = "round";
        ctx.strokeStyle = alpha("#FFFFFF", 0.65);
        ctx.beginPath();
        ctx.arc(cx + sgn * er * 1.7, cy - er * 0.2, er * 0.9, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.restore();
      } else {
        circle(ctx, cx + sgn * er * 1.7, cy - er * 0.3, er, "#FFFFFF");
        circle(ctx, cx + sgn * er * 1.7, cy - er * 0.2, er * 0.55, "#1A1226");
      }
    }
    ctx.save();
    ctx.lineWidth = er * 0.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = night ? alpha("#FFFFFF", 0.6) : "#1A1226";
    ctx.beginPath();
    if (night) ctx.arc(cx, cy + er * 1.9, er * 0.9, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(cx, cy + er * 0.9, er * 1.1, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();

    if (night) {
      // crescent, so "shadow" is a visible property rather than a minus sign
      ctx.save();
      ctx.fillStyle = alpha("#FFE9A8", 0.9);
      ctx.beginPath();
      ctx.arc(ox + size * 0.8, oy + size * 0.2, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(ox + size * 0.75, oy + size * 0.17, size * 0.095, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (label) {
      text(ctx, (night ? "−" : "") + label, cx, oy + size * 0.84,
        { size: size * 0.26, color: night ? "#FFFFFF" : "#1A1226" });
    }
  }

  drawHud(ctx, view) {
    const pad = 24;
    text(ctx, "✕", view.x + pad + 14, view.y + pad + 18, { size: 30, color: "#FFFFFF" });
    text(ctx, this.def.name.toUpperCase(), view.x + view.w / 2, view.y + 62,
      { size: 28, color: "#FFFFFF" });
    text(ctx, this.def.teaches, view.x + view.w / 2, view.y + 100,
      { size: 17, color: C.sun.base });
    text(ctx, "GET THE BOX ALONE", view.x + view.w / 2, view.y + 148,
      { size: 15, color: alpha("#FFFFFF", 0.55) });
    text(ctx, `${this.moves} / ${this.par} best`, view.x + view.w - pad, view.y + pad + 16,
      { size: 18, color: alpha("#FFFFFF", 0.7), align: "right" });
  }

  drawIntro(ctx, view) {
    const k = clamp(this.phaseT * 2, 0, 1);
    const out = clamp((this.phaseT - 2.4) * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.78;
    ctx.fillStyle = "#140C26";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = 1 - out;
    const cy = view.y + view.h * 0.38;
    text(ctx, "BALANCE", view.x + view.w / 2, cy - 84, { size: 20, color: C.sun.base });
    text(ctx, this.def.name, view.x + view.w / 2, cy - 30,
      { size: 44 * easeOutBack(k), color: "#FFFFFF" });
    text(ctx, this.def.teaches, view.x + view.w / 2, cy + 28,
      { size: 21, color: alpha("#FFFFFF", 0.85) });
    text(ctx, "keep both sides the same", view.x + view.w / 2, cy + 78,
      { size: 17, color: alpha("#FFFFFF", 0.5) });
    ctx.restore();
  }

  drawWon(ctx, view) {
    const k = clamp(this.phaseT * 1.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.85 * k;
    ctx.fillStyle = "#140C26";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = k;
    const cy = view.y + view.h * 0.34;
    text(ctx, "SOLVED!", view.x + view.w / 2, cy, { size: 54 * easeOutBack(k), color: C.sun.base });
    text(ctx, `${this.moves} moves`, view.x + view.w / 2, cy + 58, { size: 30, color: "#FFFFFF" });
    if (this.def.tier === "algebra") {
      text(ctx, "That was algebra.", view.x + view.w / 2, cy + 104,
        { size: 21, color: C.grass.light });
    } else {
      text(ctx, this.moves <= this.par ? "The shortest way!" : `Shortest is ${this.par}`,
        view.x + view.w / 2, cy + 104, { size: 20, color: alpha("#FFFFFF", 0.75) });
    }
    drawBird(ctx, view.x + view.w / 2, cy + 320, 150,
      { bird: this.birdId, state: "cheer", t: this.t });
    text(ctx, "tap to continue", view.x + view.w / 2, cy + 378,
      { size: 18, color: alpha("#FFFFFF", 0.5) });
    ctx.restore();
  }
}
