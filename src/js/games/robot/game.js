/**
 * Robot Path — a first programming game.
 *
 * Drag instruction blocks into the program strip, press PLAY, and watch the
 * robot run exactly what you wrote. No typing, no reading required beyond the
 * icons.
 *
 * What it actually teaches, in the order the levels introduce it:
 *   sequencing        the order of the blocks is the order of events
 *   spatial planning  FWD or JUMP depends on the terrain ahead
 *   debugging         when it goes wrong, the failing block is highlighted
 *   abstraction       the slot limit forces the repeat into a procedure
 *   recursion         P1 can call itself, which is a loop
 *
 * The design decision that matters most: the program RUNS VISIBLY, one block
 * at a time, with the current block lit up. A child who wrote the wrong thing
 * has to be able to see the moment it went wrong — otherwise the game is
 * guess-and-check rather than debugging, and nothing is learned.
 */

import { clamp, approach, lerp, easeOutBack, easeOutCubic } from "../../core/engine.js";
import { C, alpha, mix } from "../../core/palette.js";
import { fillRound, roundRect, circle, text, star as starShape } from "../../core/draw.js";
import { drawBird, birdBlink } from "../../art/bird.js";
import { sfx, speak, startMusic, stopMusic } from "../../core/audio.js";
import { save } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { LEVELS, parseLevel } from "./levels.js";
import { RobotSim, DIRS } from "./sim.js";

const GAME_ID = "robot";

/** Icon and colour per instruction. Icons carry the meaning; labels are backup. */
const OP_STYLE = {
  FWD:   { icon: "⬆", label: "GO",    ramp: C.sea },
  JUMP:  { icon: "⤴", label: "JUMP",  ramp: C.grass },
  LEFT:  { icon: "↰", label: "LEFT",  ramp: C.sun },
  RIGHT: { icon: "↱", label: "RIGHT", ramp: C.sun },
  LIGHT: { icon: "💡", label: "LIGHT", ramp: C.candy },
  P1:    { icon: "P1", label: "P1",    ramp: C.grape },
  P2:    { icon: "P2", label: "P2",    ramp: C.flame },
};

const TILE = 92;     // isometric tile width in world units
const LIFT = 34;     // pixels per height step
const STEP_MS = 420; // how long one instruction takes to animate

export class RobotScene {
  constructor({ levelIndex = 0, bird = "chick", onComplete }) {
    this.levelIndex = clamp(levelIndex, 0, LEVELS.length - 1);
    this.def = LEVELS[this.levelIndex];
    this.level = parseLevel(this.def);
    this.birdId = bird;
    this.onComplete = onComplete;

    this.sim = new RobotSim(this.level);
    this.fx = new Fx();
    this.t = 0;
    this.stateT = 0;
    this.state = "intro";       // intro | edit | run | won | failed

    // The program the child is building.
    this.program = {
      main: new Array(this.def.slots.main).fill(null),
      p1: new Array(this.def.slots.p1 ?? 0).fill(null),
      p2: new Array(this.def.slots.p2 ?? 0).fill(null),
    };

    this.trace = [];
    this.traceIndex = -1;
    this.stepT = 0;
    this.runs = 0;

    // Visual pose, eased toward the simulated cell so movement reads as motion.
    this.pose = { x: this.level.start.x, y: this.level.start.y, z: 0, dir: this.level.start.dir ?? 0, hop: 0 };
    this.drag = null;
    this.slotRects = [];
    this.paletteRects = [];
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
    this.resetRobot();
  }

  destroy() {
    stopMusic();
    this.engine?.canvas.removeEventListener("pointerdown", this._pd);
    window.removeEventListener("pointermove", this._pm);
    window.removeEventListener("pointerup", this._pu);
    window.removeEventListener("pointercancel", this._pu);
  }

  resetRobot() {
    this.sim.reset();
    this.pose.x = this.sim.x;
    this.pose.y = this.sim.y;
    this.pose.z = this.sim.heightAt(this.sim.x, this.sim.y) ?? 0;
    this.pose.dir = this.sim.dir;
    this.traceIndex = -1;
    this.trace = [];
  }

  /* -------------------------------------------------------------- layout */

  resize(view) {
    const L = this.level;
    // Room for the strips, palette and buttons, sized from what is actually
    // on this level rather than a fixed guess.
    const strips = 1 + (this.def.slots.p1 ? 1 : 0) + (this.def.slots.p2 ? 1 : 0);
    this.programTop = view.y + view.h - (170 + strips * 86);

    const headroom = view.y + 130;
    const availW = view.w - 60;
    const availH = this.programTop - headroom - 40;

    const maxH = Math.max(0, ...L.heights.filter((v) => v !== null));
    // Isometric extents in tile widths: the diamond is (w+h)/2 across and
    // (w+h)/4 tall, plus the depth of the tallest column.
    const spanW = (L.w + L.h) * 0.5;
    const spanH = (L.w + L.h) * 0.25 + (maxH + 1) * 0.37 + 0.5;
    this.tile = Math.min(TILE * 1.8, availW / spanW, availH / spanH);
    this.lift = this.tile * 0.37;

    // Centre the board by measuring its actual drawn bounds rather than
    // deriving an offset by hand — the hand-derived version double-counted the
    // projection factors and pushed the board off to one side.
    this.boardCentre = { x: 0, y: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let y = 0; y < L.h; y++) {
      for (let x = 0; x < L.w; x++) {
        const hgt = L.heights[y * L.w + x];
        if (hgt === null) continue;
        const p = this.iso(x, y, hgt);
        const side = this.lift * hgt + this.tile * 0.22;
        minX = Math.min(minX, p.x - this.tile * 0.5);
        maxX = Math.max(maxX, p.x + this.tile * 0.5);
        minY = Math.min(minY, p.y - this.tile * 0.25);
        maxY = Math.max(maxY, p.y + this.tile * 0.25 + side);
      }
    }
    this.boardCentre = {
      x: view.x + view.w / 2 - (minX + maxX) / 2,
      y: headroom + availH / 2 - (minY + maxY) / 2,
    };
  }

  iso(x, y, z) {
    return {
      x: this.boardCentre.x + (x - y) * this.tile * 0.5,
      y: this.boardCentre.y + (x + y) * this.tile * 0.25 - z * this.lift,
    };
  }

  /* --------------------------------------------------------------- input */

  down(pt) {
    if (this.state === "intro") { this.state = "edit"; this.stateT = 0; return; }
    if (this.state === "won") { this.finish(); return; }

    if (this.playRect && inRect(pt, this.playRect)) {
      this.state === "run" ? this.stop() : this.play();
      return;
    }
    if (this.clearRect && inRect(pt, this.clearRect)) { this.clearProgram(); return; }
    if (this.state === "run") return;

    // Pull an instruction out of a filled slot (to move or delete it).
    for (const r of this.slotRects) {
      if (!inRect(pt, r)) continue;
      const op = this.program[r.list][r.index];
      if (!op) return;
      this.program[r.list][r.index] = null;
      this.drag = { op, x: pt.x, y: pt.y, from: r };
      sfx.tick();
      return;
    }
    // Or take a fresh one from the palette.
    for (const r of this.paletteRects) {
      if (!inRect(pt, r)) continue;
      this.drag = { op: r.op, x: pt.x, y: pt.y, from: null };
      sfx.tick();
      return;
    }
  }

  move(pt) {
    if (!this.drag) return;
    this.drag.x = pt.x;
    this.drag.y = pt.y;
    this.drag.over = this.slotRects.find((r) => inRect(pt, r)) ?? null;
  }

  up(pt) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const target = this.slotRects.find((r) => inRect(pt, r));
    if (target) {
      // Dropping onto a filled slot swaps rather than overwrites, so a child
      // reordering a program never silently loses a block.
      const existing = this.program[target.list][target.index];
      this.program[target.list][target.index] = d.op;
      if (existing && d.from) this.program[d.from.list][d.from.index] = existing;
      sfx.pop();
    } else if (d.from) {
      sfx.whoosh();   // dragged out of the strip: deleted
    }
  }

  clearProgram() {
    for (const k of ["main", "p1", "p2"]) this.program[k].fill(null);
    this.stop();
    sfx.whoosh();
  }

  /* ------------------------------------------------------------ running */

  play() {
    this.resetRobot();
    this.trace = this.sim.flatten(this.program);
    if (!this.trace.length) {
      this.fx.say(this.engine.view.x + this.engine.view.w / 2, this.programTop - 30,
        "add some blocks!", C.sun.light, 24);
      sfx.wrong();
      return;
    }
    this.runs++;
    this.state = "run";
    this.traceIndex = -1;
    this.stepT = STEP_MS;   // fire the first step immediately
    sfx.whoosh();
  }

  stop() {
    this.state = "edit";
    this.resetRobot();
  }

  /** Advance one instruction and mirror the result into the visual pose. */
  stepProgram() {
    this.traceIndex++;
    if (this.traceIndex >= this.trace.length) {
      // Program finished. Did it work?
      if (this.sim.won) this.win();
      else {
        this.state = "failed";
        this.stateT = 0;
        sfx.wrong();
      }
      return;
    }
    const step = this.trace[this.traceIndex];
    const before = { x: this.sim.x, y: this.sim.y };
    const res = this.sim.exec(step.op);
    this.pose.dir = this.sim.dir;

    if (res.kind === "move") {
      this.pose.hop = step.op === "JUMP" ? 1 : 0.35;
      sfx.step();
    } else if (res.kind === "light") {
      const p = this.iso(this.sim.x, this.sim.y, this.sim.heightAt(this.sim.x, this.sim.y));
      this.fx.burst(p.x, p.y - 20, [C.sun.light, "#FFFFFF"], 16);
      this.fx.ring(p.x, p.y - 10, C.sun.light, 0.5);
      sfx.coin();
    } else if (res.kind === "blocked") {
      const p = this.iso(before.x, before.y, this.sim.heightAt(before.x, before.y));
      this.fx.say(p.x, p.y - 60, "bump!", C.cherry.light, 22);
      sfx.hurt();
    }
    if (this.sim.won && this.state === "run") this.win();
  }

  win() {
    this.state = "won";
    this.stateT = 0;
    sfx.fanfare();
    const p = this.iso(this.sim.x, this.sim.y, this.sim.heightAt(this.sim.x, this.sim.y));
    this.fx.burst(p.x, p.y - 30, [C.sun.base, C.grass.light, "#FFFFFF"], 40);
    speak("You programmed it!");
  }

  finish() {
    // Stars reward a short program and few attempts — that is what "getting
    // better at this" actually looks like.
    const used = this.program.main.filter(Boolean).length +
                 this.program.p1.filter(Boolean).length +
                 this.program.p2.filter(Boolean).length;
    const ref = Object.values(this.def.solution).reduce((n, l) => n + l.length, 0);
    let stars = 1;
    if (used <= ref + 1) stars = 3;
    else if (used <= ref + 3) stars = 2;
    if (this.runs > 6 && stars === 3) stars = 2;
    save.recordLevel(GAME_ID, this.levelIndex, stars, used);
    save.addXp(10 + stars * 4);
    save.touchStreak();
    this.onComplete?.({ stars, blocks: used, best: ref, runs: this.runs });
  }

  /* --------------------------------------------------------------- loop */

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.fx.update(dt);
    if (this.state === "intro" && this.stateT > 2.8) this.state = "edit";
    if (this.state === "failed" && this.stateT > 1.1) { this.state = "edit"; this.resetRobot(); }

    if (this.state === "run") {
      this.stepT += dt * 1000;
      if (this.stepT >= STEP_MS) { this.stepT = 0; this.stepProgram(); }
    }

    // ease the drawn robot toward the simulated cell
    const z = this.sim.heightAt(this.sim.x, this.sim.y) ?? 0;
    this.pose.x = approach(this.pose.x, this.sim.x, 14, dt);
    this.pose.y = approach(this.pose.y, this.sim.y, 14, dt);
    this.pose.z = approach(this.pose.z, z, 12, dt);
    this.pose.hop = Math.max(0, this.pose.hop - dt * 3.4);
  }

  /* --------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
    g.addColorStop(0, "#1B2C52");
    g.addColorStop(0.6, "#2A3F6E");
    g.addColorStop(1, "#151F3A");
    ctx.fillStyle = g;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    this.drawStars(ctx, view);

    this.drawBoard(ctx);
    this.drawProgram(ctx, view);
    this.drawHud(ctx, view);
    this.fx.draw(ctx);
    if (this.drag) this.drawBlock(ctx, this.drag.op, this.drag.x - 34, this.drag.y - 34, 68, 1.12);
    if (this.state === "intro") this.drawIntro(ctx, view);
    if (this.state === "won") this.drawWon(ctx, view);
    if (this.state === "failed") this.drawFailed(ctx, view);
  }

  drawStars(ctx, view) {
    ctx.save();
    for (let i = 0; i < 28; i++) {
      const x = view.x + ((i * 191) % view.w);
      const y = view.y + ((i * 97) % (view.h * 0.5));
      ctx.globalAlpha = 0.25 + Math.sin(this.t * 2 + i) * 0.18;
      circle(ctx, x, y, 1.6 + (i % 3) * 0.7, "#CFE6FF");
    }
    ctx.restore();
  }

  /** Isometric board: tiles are drawn back to front so they stack correctly. */
  drawBoard(ctx) {
    const L = this.level;
    const order = [];
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        const hgt = L.heights[y * L.w + x];
        if (hgt === null) continue;
        order.push({ x, y, h: hgt });
      }
    order.sort((a, b) => (a.x + a.y) - (b.x + b.y));

    for (const cell of order) {
      const target = L.targets.some((t) => t.x === cell.x && t.y === cell.y);
      const lit = this.sim.lit.has(`${cell.x},${cell.y}`);
      this.drawTile(ctx, cell.x, cell.y, cell.h, target, lit);
      // draw the robot as soon as we pass its cell in depth order
      if (Math.round(this.pose.x) === cell.x && Math.round(this.pose.y) === cell.y) {
        this.drawRobot(ctx);
      }
    }
    // safety: if rounding hid it, draw on top
    const rx = Math.round(this.pose.x), ry = Math.round(this.pose.y);
    if (rx < 0 || ry < 0 || rx >= L.w || ry >= L.h) this.drawRobot(ctx);
  }

  drawTile(ctx, x, y, h, isTarget, lit) {
    const t = this.tile, side = this.lift * h + this.tile * 0.22;
    const p = this.iso(x, y, h);
    const hw = t * 0.5, hh = t * 0.25;

    // An unlit lamp must still read as a tile you can stand on. Drawn too
    // dark it looks like a hole, and children route around it.
    const top = isTarget
      ? (lit ? C.sun : C.bone)
      : (h === 0 ? C.sea : h === 1 ? C.jade : h === 2 ? C.grape : C.flame);

    // the column sides
    ctx.beginPath();
    ctx.moveTo(p.x - hw, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(p.x, p.y + hh + side);
    ctx.lineTo(p.x - hw, p.y + side);
    ctx.closePath();
    ctx.fillStyle = top.deep;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x + hw, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(p.x, p.y + hh + side);
    ctx.lineTo(p.x + hw, p.y + side);
    ctx.closePath();
    ctx.fillStyle = top.dark;
    ctx.fill();

    // the top face
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hh);
    ctx.lineTo(p.x + hw, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(p.x - hw, p.y);
    ctx.closePath();
    ctx.fillStyle = isTarget && lit ? C.sun.light : top.base;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha(top.deep, 0.6);
    ctx.stroke();

    if (isTarget) {
      // a lamp ring, glowing once lit
      ctx.save();
      if (lit) {
        ctx.shadowColor = C.sun.light;
        ctx.shadowBlur = 26;
      }
      ctx.lineWidth = 4;
      ctx.strokeStyle = lit ? "#FFFFFF" : alpha(C.slate.deep, 0.55);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, hw * 0.46, hh * 0.46, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (lit) {
        ctx.globalAlpha = 0.5 + Math.sin(this.t * 6) * 0.25;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, hw * 0.3, hh * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawRobot(ctx) {
    const p = this.iso(this.pose.x, this.pose.y, this.pose.z);
    const hop = Math.sin(this.pose.hop * Math.PI) * this.tile * 0.3;
    const size = this.tile * 0.72;
    ctx.save();
    // shadow on the tile
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, this.tile * 0.22, this.tile * 0.11, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.restore();

    // The bird rides the robot, so the mascot is present without needing a
    // second character.
    drawBird(ctx, p.x, p.y - hop, size, {
      bird: this.birdId,
      state: this.state === "won" ? "cheer" : this.pose.hop > 0.1 ? "jump" : "idle",
      t: this.t,
      flip: this.pose.dir === 2 || this.pose.dir === 3 ? -1 : 1,
      shadow: false,
      blink: birdBlink(this.t, 2),
    });

    // facing arrow, so the child can read which way it will go
    const [dx, dy] = DIRS[this.pose.dir];
    const tip = this.iso(this.pose.x + dx * 0.44, this.pose.y + dy * 0.44, this.pose.z);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = C.sun.base;
    ctx.beginPath();
    const ang = Math.atan2(tip.y - p.y, tip.x - p.x);
    ctx.translate(tip.x, tip.y);
    ctx.rotate(ang);
    ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------ program */

  drawProgram(ctx, view) {
    this.slotRects = [];
    this.paletteRects = [];
    const pad = 22;
    let y = this.programTop;

    ctx.save();
    fillRound(ctx, view.x - 10, y - 14, view.w + 20, view.h, 26, alpha("#0B1220", 0.85));
    ctx.restore();

    const strips = [["main", "PROGRAM"], ["p1", "P1"], ["p2", "P2"]];
    for (const [key, label] of strips) {
      const slots = this.program[key];
      if (!slots.length) continue;
      text(ctx, label, view.x + pad, y + 14, { size: 13, color: alpha("#FFFFFF", 0.55), align: "left" });
      const size = Math.min(58, (view.w - pad * 2 - 54) / Math.max(slots.length, 1) - 6);
      const x0 = view.x + pad + 50;
      for (let i = 0; i < slots.length; i++) {
        const r = { x: x0 + i * (size + 6), y: y - size * 0.1, w: size, h: size, list: key, index: i };
        this.slotRects.push(r);
        const running = this.state === "run" &&
          this.trace[this.traceIndex]?.from === key &&
          this.trace[this.traceIndex]?.index === i;
        // empty slot
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.drag?.over === r ? C.sun.base : alpha("#FFFFFF", 0.28);
        roundRect(ctx, r.x, r.y, r.w, r.h, 12);
        ctx.stroke();
        ctx.restore();
        if (slots[i]) this.drawBlock(ctx, slots[i], r.x, r.y, r.w, running ? 1.1 : 1, running);
      }
      y += size + 30;
    }

    // palette
    text(ctx, "BLOCKS", view.x + pad, y + 10, { size: 13, color: alpha("#FFFFFF", 0.55), align: "left" });
    const ops = this.def.ops;
    const psize = Math.min(64, (view.w - pad * 2) / ops.length - 8);
    const px0 = view.x + (view.w - (ops.length * (psize + 8) - 8)) / 2;
    for (let i = 0; i < ops.length; i++) {
      const r = { x: px0 + i * (psize + 8), y: y + 22, w: psize, h: psize, op: ops[i] };
      this.paletteRects.push(r);
      this.drawBlock(ctx, ops[i], r.x, r.y, r.w, 1);
    }

    // buttons
    const by = y + 22 + psize + 18;
    const bw = 150, bh = 52;
    this.playRect = { x: view.x + view.w / 2 - bw - 8, y: by, w: bw, h: bh };
    this.clearRect = { x: view.x + view.w / 2 + 8, y: by, w: bw, h: bh };
    const playing = this.state === "run";
    for (const [r, label, ramp] of [
      [this.playRect, playing ? "■ STOP" : "▶ PLAY", playing ? C.cherry : C.grass],
      [this.clearRect, "✕ CLEAR", C.slate],
    ]) {
      fillRound(ctx, r.x, r.y + 5, r.w, r.h, 26, ramp.dark);
      fillRound(ctx, r.x, r.y, r.w, r.h, 26, ramp.base);
      text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: 20, color: "#FFFFFF" });
    }
  }

  drawBlock(ctx, op, x, y, size, scale = 1, glow = false) {
    const S = OP_STYLE[op] ?? OP_STYLE.FWD;
    const s = size * scale;
    const ox = x - (s - size) / 2, oy = y - (s - size) / 2;
    ctx.save();
    if (glow) {
      ctx.shadowColor = S.ramp.light;
      ctx.shadowBlur = 20;
    }
    fillRound(ctx, ox, oy + 5, s, s, 13, S.ramp.dark);
    fillRound(ctx, ox, oy, s, s, 13, S.ramp.base);
    fillRound(ctx, ox + 4, oy + 4, s - 8, s * 0.3, 8, alpha(S.ramp.light, 0.6));
    ctx.restore();
    text(ctx, S.icon, ox + s / 2, oy + s * 0.46, { size: s * 0.46, color: "#FFFFFF" });
    text(ctx, S.label, ox + s / 2, oy + s * 0.82, { size: s * 0.17, color: alpha("#FFFFFF", 0.85) });
  }

  /* ---------------------------------------------------------------- HUD */

  drawHud(ctx, view) {
    const pad = 24;
    text(ctx, "✕", view.x + pad + 14, view.y + pad + 18, { size: 30, color: "#FFFFFF" });
    text(ctx, this.def.name.toUpperCase(), view.x + view.w / 2, view.y + 54,
      { size: 26, color: "#FFFFFF" });
    text(ctx, this.def.teaches, view.x + view.w / 2, view.y + 88,
      { size: 16, color: C.sun.base });

    const total = this.level.targets.length;
    const lit = this.sim.lit.size;
    text(ctx, `💡 ${lit}/${total}`, view.x + view.w - pad, view.y + pad + 16,
      { size: 22, color: lit === total ? C.grass.light : alpha("#FFFFFF", 0.8), align: "right" });
  }

  drawIntro(ctx, view) {
    const k = clamp(this.stateT * 2, 0, 1);
    const out = clamp((this.stateT - 2.2) * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.76;
    ctx.fillStyle = "#070D1A";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = 1 - out;
    const cy = view.y + view.h * 0.4;
    text(ctx, "ROBOT PATH", view.x + view.w / 2, cy - 84, { size: 20, color: C.sun.base });
    text(ctx, this.def.name, view.x + view.w / 2, cy - 30,
      { size: 44 * easeOutBack(k), color: "#FFFFFF" });
    text(ctx, this.def.teaches, view.x + view.w / 2, cy + 28,
      { size: 22, color: alpha("#FFFFFF", 0.85) });
    text(ctx, "build the program, then press PLAY", view.x + view.w / 2, cy + 82,
      { size: 17, color: alpha("#FFFFFF", 0.5) });
    ctx.restore();
  }

  drawFailed(ctx, view) {
    ctx.save();
    ctx.globalAlpha = clamp(1 - this.stateT, 0, 1) * 0.9;
    const cy = view.y + view.h * 0.3;
    text(ctx, "not quite — try changing a block", view.x + view.w / 2, cy,
      { size: 24, color: C.sun.light });
    ctx.restore();
  }

  drawWon(ctx, view) {
    const k = clamp(this.stateT * 1.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.84 * k;
    ctx.fillStyle = "#070D1A";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = k;
    const used = this.program.main.filter(Boolean).length +
                 this.program.p1.filter(Boolean).length +
                 this.program.p2.filter(Boolean).length;
    const ref = Object.values(this.def.solution).reduce((n, l) => n + l.length, 0);
    const cy = view.y + view.h * 0.34;
    text(ctx, "IT WORKS!", view.x + view.w / 2, cy, { size: 52 * easeOutBack(k), color: C.sun.base });
    text(ctx, `${used} blocks`, view.x + view.w / 2, cy + 58, { size: 30, color: "#FFFFFF" });
    text(ctx, used <= ref ? "As short as it can be!" : `Shortest known: ${ref}`,
      view.x + view.w / 2, cy + 104, { size: 19, color: alpha("#FFFFFF", 0.75) });
    drawBird(ctx, view.x + view.w / 2, cy + 320, 150,
      { bird: this.birdId, state: "cheer", t: this.t });
    text(ctx, "tap to continue", view.x + view.w / 2, cy + 378,
      { size: 18, color: alpha("#FFFFFF", 0.5) });
    ctx.restore();
  }
}

const inRect = (pt, r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
