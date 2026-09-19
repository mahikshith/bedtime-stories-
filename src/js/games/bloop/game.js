/**
 * Bloop Hills — you do not move the Bloops, you tilt the hill.
 *
 * The idea is lifted, with enormous affection, from LocoRoco. That game was
 * pitched and rejected twice; it was greenlit only when its designer came back
 * with a demo of nothing but the tilting. Everything else in it — the splitting,
 * the fruit, the singing — is downstream of that one decision, and it is the
 * decision worth taking:
 *
 * 1. YOU CONTROL THE WORLD, NOT THE CHARACTER. There is no run button and no
 *    aiming. You lean the hill and gravity does the rest, which is why a
 *    three-year-old can play it in about four seconds and why it maps onto a
 *    phone so exactly. The *world* visibly rotates, not the camera — it has to
 *    be the hill that moves, or it is just a platformer with drifty controls.
 *
 * 2. THE FLOCK IS A CHORD. Every Bloop is a voice in the music. Collect one
 *    and the song gains a part; that is the entire reward structure, and it
 *    needs no explanation in any language. A child works out that more is
 *    better because more sounds better.
 *
 * 3. SPLITTING IS A KEY, NOT A CHORE. One big Bloop rolls better and is easier
 *    to steer. Six small ones fit through a gap it cannot. The level asks the
 *    question and the child answers with one button.
 *
 * 4. NOTHING IS LOST. There is no falling off, no enemy, no timer, no failure.
 *    The worst outcome is arriving with fewer friends and a thinner song,
 *    which a child hears and fixes by playing again.
 */

import { clamp, approach, lerp, easeOutBack, rand } from "../../core/engine.js";
import { C, alpha, mix } from "../../core/palette.js";
import { fillRound, roundRect, circle, ellipse, text } from "../../core/draw.js";
import { sfx, speak, stopSpeaking, stopMusic } from "../../core/audio.js";
import { save } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { TiltInput } from "../../core/tilt.js";
import { Terrain } from "./terrain.js";
import { Bloop, KINDS, KIND_IDS, radiusFor } from "./bloop.js";
import { loadLevel, LEVELS } from "./levels.js";
import { Song } from "./song.js";
import { TUNE } from "./tune.js";

const GAME_ID = "bloop";

export class BloopScene {
  constructor({ levelIndex = 0, bird = "chick", onComplete, onExit }) {
    this.levelIndex = clamp(levelIndex, 0, LEVELS.length - 1);
    this.onComplete = onComplete;
    this.onExit = onExit;

    const { def, shapes, fruit } = loadLevel(this.levelIndex);
    this.def = def;
    this.terrain = new Terrain(shapes);
    this.fruit = fruit.map((f, i) => ({
      ...f, taken: false, kind: KIND_IDS[i % KIND_IDS.length], bob: i * 1.3,
    }));
    this.goal = def.goal;

    this.tiltInput = new TiltInput({ range: 24 });
    this.tilt = 0;            // the angle the world is actually at
    this.wantTilt = 0;

    this.flock = [];
    this.merged = true;
    this.count = def.startCount;
    this.collected = 0;
    this.jumpT = 0;

    this.fx = new Fx();
    this.song = new Song();
    this.t = 0;
    this.state = "intro";
    this.stateT = 0;
    this.cam = { x: def.start.x, y: def.start.y, z: TUNE.zoom };
    this.flash = { text: "", t: 0 };

    this._spawn();
  }

  _spawn() {
    this.flock = [new Bloop({
      x: this.def.start.x, y: this.def.start.y,
      kind: this.def.kind, count: this.count, base: TUNE.baseRadius,
    })];
    this.merged = true;
  }

  /* --------------------------------------------------------- lifecycle */

  async enter(engine) {
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    this.tiltInput.attachKeys();
    this.tiltInput.attachPointer?.(engine.canvas);
    await this.tiltInput.requestGyro();
    this.tiltInput.calibrate();
    speak(this.def.teaches);
  }

  destroy() {
    this.tiltInput.destroy();
    this.song.stop();
    stopSpeaking();
    stopMusic();
  }

  resize(view) {
    this.view = view;
    this.hud = {
      jump: { x: view.x + 30, y: view.y + view.h - 190, w: 190, h: 150 },
      split: { x: view.x + view.w - 220, y: view.y + view.h - 190, w: 190, h: 150 },
    };
  }

  /* ------------------------------------------------------------- input */

  down(pt) {
    if (this.state === "intro") { this.begin(); return; }
    if (this.state === "won") { this.finish(); return; }
    if (inRect(pt, this.hud.jump)) { this.doJump(); return; }
    if (inRect(pt, this.hud.split)) { this.toggleSplit(); return; }
  }

  begin() {
    this.state = "play";
    this.stateT = 0;
    this.song.start();
    this.tiltInput.calibrate();
  }

  doJump() {
    if (this.jumpT > 0) return;
    let jumped = false;
    for (const b of this.flock) {
      if (!b.grounded && b.groundT > 0.16) continue;
      const n = b.normal ?? { nx: 0, ny: -1 };
      b.vx += n.nx * TUNE.jump;
      b.vy += n.ny * TUNE.jump;
      b.squashV += 0.22;
      b.cheer(0.4);
      jumped = true;
    }
    if (jumped) { this.jumpT = TUNE.jumpCooldown; sfx.jump(0.5); }
  }

  /**
   * One button for both halves of the mechanic: it scatters a merged flock,
   * and gathers a scattered one. A child does not have to learn two controls
   * to learn one idea.
   */
  toggleSplit() {
    if (this.count < 2) { sfx.tick?.(); return; }
    if (this.merged) {
      const big = this.flock[0];
      this.flock = [];
      for (let i = 0; i < big.count; i++) {
        const a = (i / big.count) * Math.PI * 2;
        const b = new Bloop({
          x: big.x + Math.cos(a) * big.r * 0.5,
          y: big.y + Math.sin(a) * big.r * 0.5,
          kind: this.def.kind, count: 1, base: TUNE.baseRadius,
        });
        b.vx = big.vx + Math.cos(a) * TUNE.splitPush;
        b.vy = big.vy + Math.sin(a) * TUNE.splitPush;
        b.cheer(0.5);
        this.flock.push(b);
      }
      this.merged = false;
      sfx.pop();
    } else {
      this.gathering = true;
      sfx.whoosh();
    }
  }

  /* ------------------------------------------------------------ update */

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.fx.update(dt);
    this.flash.t = Math.max(0, this.flash.t - dt);
    this.jumpT = Math.max(0, this.jumpT - dt);
    this.tiltInput.update(dt);

    if (this.state === "intro") { this._camera(dt, true); return; }

    // The world leans toward the device, but lags behind it. The lag is the
    // weight: a hill that snapped to the exact angle of the phone would be
    // both unsteerable and faintly sickening.
    this.wantTilt = clamp(this.tiltInput.x, -1, 1) * TUNE.maxTilt;
    this.tilt = approach(this.tilt, this.wantTilt, TUNE.tiltFollow, dt);

    const g = {
      x: Math.sin(this.tilt) * TUNE.gravity,
      y: Math.cos(this.tilt) * TUNE.gravity,
    };

    for (const b of this.flock) {
      b.step(dt, g, this.terrain, { bounce: TUNE.bounce, friction: TUNE.friction });
    }
    if (!this.merged) this._separate(dt);
    if (this.gathering) this._gather(dt);

    this._fruit();
    this._goal();

    const speed = this.flock.reduce((m, b) => Math.max(m, Math.hypot(b.vx, b.vy)), 0);
    const beat = this.song.update(dt, this.voices(), clamp(speed / 1400, 0, 1));
    if (beat) for (const b of this.flock) b.cheer(0.34);

    this._camera(dt);
  }

  /** One voice per Bloop, which is what the song reads to build its chord. */
  voices() {
    const kind = KINDS[this.def.kind] ?? KINDS.sun;
    return Array.from({ length: this.count }, (_, i) => ({
      degree: (kind.degree + [0, 4, 7, 2, 9, 12][i % 6]) % 12,
    }));
  }

  /** Keep scattered Bloops from sitting inside each other. */
  _separate(dt) {
    for (let i = 0; i < this.flock.length; i++) {
      for (let j = i + 1; j < this.flock.length; j++) {
        const a = this.flock[i], b = this.flock[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const need = a.r + b.r;
        if (d >= need) continue;
        const push = (need - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
    }
  }

  /** Pull the scattered flock back together, merging what touches. */
  _gather(dt) {
    const lead = this.flock[0];
    if (!lead) { this.gathering = false; return; }
    for (let i = this.flock.length - 1; i >= 1; i--) {
      const b = this.flock[i];
      const dx = lead.x - b.x, dy = lead.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < lead.r + TUNE.gatherSnap) {
        lead.setCount(lead.count + b.count);
        lead.cheer(0.5);
        this.flock.splice(i, 1);
        continue;
      }
      b.vx += (dx / d) * TUNE.gatherPull * dt;
      b.vy += (dy / d) * TUNE.gatherPull * dt;
    }
    if (this.flock.length === 1) {
      this.gathering = false;
      this.merged = true;
      this.fx.burst(lead.x, lead.y, [KINDS[this.def.kind].shine, "#FFFFFF"], 16);
    }
  }

  _fruit() {
    for (const f of this.fruit) {
      if (f.taken) continue;
      for (const b of this.flock) {
        if (Math.hypot(b.x - f.x, b.y - f.y) > b.r + TUNE.fruitReach) continue;
        f.taken = true;
        this.collected++;
        if (this.count < TUNE.maxFlock) {
          this.count++;
          if (this.merged) b.setCount(b.count + 1);
          else this._addLoose(b);
        }
        b.cheer(0.8);
        this.fx.burst(f.x, f.y, [KINDS[f.kind].body, KINDS[f.kind].shine, "#FFFFFF"], 18);
        sfx.coin();
        break;
      }
    }
  }

  _addLoose(near) {
    const b = new Bloop({
      x: near.x + rand(-30, 30), y: near.y - near.r - 20,
      kind: this.def.kind, count: 1, base: TUNE.baseRadius,
    });
    b.vx = near.vx; b.vy = near.vy - 120;
    this.flock.push(b);
  }

  _goal() {
    if (this.state !== "play") return;
    const home = this.flock.some((b) =>
      Math.hypot(b.x - this.goal.x, b.y - this.goal.y) < b.r + TUNE.goalReach);
    if (!home) return;
    this.state = "won";
    this.stateT = 0;
    for (const b of this.flock) b.cheer(2.5);
    this.fx.burst(this.goal.x, this.goal.y,
      [C.sun.base, C.candy.base, C.jade.light, "#FFFFFF"], 46);
    sfx.fanfare();
    save.recordStars?.(GAME_ID, this.levelIndex, this.stars());
  }

  stars() {
    const got = this.collected / Math.max(1, this.fruit.length);
    return got >= 0.9 ? 3 : got >= 0.55 ? 2 : 1;
  }

  finish() {
    this.onComplete?.({
      stars: this.stars(),
      friends: this.count,
      fruit: this.collected,
      total: this.fruit.length,
      name: this.def.name,
    });
  }

  _camera(dt, snap = false) {
    let cx = 0, cy = 0;
    for (const b of this.flock) { cx += b.x; cy += b.y; }
    cx /= Math.max(1, this.flock.length);
    cy /= Math.max(1, this.flock.length);
    if (snap) { this.cam.x = cx; this.cam.y = cy; return; }
    this.cam.x = approach(this.cam.x, cx, TUNE.camFollow, dt);
    this.cam.y = approach(this.cam.y, cy, TUNE.camFollow, dt);
  }

  /* -------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    const sky = SKIES[this.levelIndex % SKIES.length];

    // The sky does NOT rotate. Everything else does. A fully rotating frame is
    // how you make a child feel sick in ninety seconds; keeping one stable
    // horizontal reference at the back lets the hills swing as hard as they
    // like without the screen losing its up.
    const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
    g.addColorStop(0, sky[0]); g.addColorStop(0.62, sky[1]); g.addColorStop(1, sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    this._sun(ctx, view);
    this._clouds(ctx, view);

    const cx = view.x + view.w / 2;
    const cy = view.y + view.h * 0.52;

    // Distant hills lean a quarter as far as the ground does. The parallax is
    // what makes the tilt read as the WORLD turning rather than the camera.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.tilt * 0.25);
    ctx.translate(-cx, -cy);
    this._farHills(ctx, view, sky[3]);
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.tilt);
    ctx.scale(this.cam.z, this.cam.z);
    ctx.translate(-this.cam.x, -this.cam.y);

    this._terrain(ctx, sky);
    this._goalArt(ctx);
    this._fruitArt(ctx);
    for (const b of this.flock) b.draw(ctx, this.t);
    this.fx.draw(ctx);

    ctx.restore();

    this._hud(ctx, view);
    if (this.state === "intro") this._intro(ctx, view);
    if (this.state === "won") this._won(ctx, view);
  }

  _sun(ctx, view) {
    const x = view.x + view.w * 0.78, y = view.y + view.h * 0.12;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(this.t * 0.06);
    ctx.fillStyle = alpha("#FFF6C0", 0.3);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(-10, -70); ctx.lineTo(10, -70); ctx.lineTo(0, -120);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    circle(ctx, x, y, 74, alpha("#FFF6C0", 0.45));
    circle(ctx, x, y, 54, "#FFF6C0");
    circle(ctx, x, y, 42, "#FFFDF0");
  }

  _clouds(ctx, view) {
    for (let i = 0; i < 5; i++) {
      const w = view.w * (0.2 + (i % 3) * 0.06);
      const x = view.x + ((i * 0.27 + this.t * 0.004) % 1.3 - 0.15) * view.w;
      const y = view.y + view.h * (0.07 + i * 0.062) - this.tilt * 40;
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(x, y, w * 0.3, 0, 7);
      ctx.arc(x + w * 0.3, y + w * 0.06, w * 0.22, 0, 7);
      ctx.arc(x - w * 0.3, y + w * 0.08, w * 0.2, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }

  _farHills(ctx, view, colour) {
    const base = view.y + view.h * 0.74;
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer ? colour : mix(colour, "#FFFFFF", 0.35);
      ctx.beginPath();
      ctx.moveTo(view.x - 200, view.y + view.h + 400);
      for (let px = -200; px <= view.w + 200; px += 28) {
        const u = px / view.w;
        ctx.lineTo(view.x + px,
          base + layer * 90 - Math.sin(u * 2.6 + layer * 1.9) * 90 -
          Math.sin(u * 6.1 + layer) * 30);
      }
      ctx.lineTo(view.x + view.w + 200, view.y + view.h + 400);
      ctx.closePath(); ctx.fill();
    }
  }

  /**
   * The ground: solid body, then a thick bright cap all the way round.
   *
   * The cap is stroked rather than drawn as a separate grass strip because the
   * hills curl — a level with an overhang or a bar has no single "top edge" to
   * lay a strip along, and an outline follows whatever shape the ribbon took.
   */
  _terrain(ctx, sky) {
    for (const shape of this.terrain.shapes) {
      const p = shape.points;
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.closePath();
      ctx.fillStyle = sky[5];
      ctx.fill();
      ctx.save();
      ctx.lineJoin = "round";
      ctx.strokeStyle = sky[4];
      ctx.lineWidth = 34;
      ctx.stroke();
      ctx.restore();
      // A lighter lip just inside the cap, which is what makes it read as a
      // sunlit edge instead of a border.
      ctx.save();
      ctx.clip();
      ctx.lineWidth = 12;
      ctx.strokeStyle = mix(sky[4], "#FFFFFF", 0.4);
      ctx.stroke();
      ctx.restore();
    }
  }

  _fruitArt(ctx) {
    for (const f of this.fruit) {
      if (f.taken) continue;
      const k = KINDS[f.kind];
      const bob = Math.sin(this.t * 2.4 + f.bob) * 7;
      ctx.save();
      ctx.globalAlpha = 0.5;
      circle(ctx, f.x, f.y + bob, 34, alpha(k.shine, 0.55));
      ctx.restore();
      circle(ctx, f.x, f.y + bob + 3, 22, k.dark);
      circle(ctx, f.x, f.y + bob, 22, k.body);
      circle(ctx, f.x - 7, f.y + bob - 8, 7, alpha("#FFFFFF", 0.85));
      ctx.save();
      ctx.strokeStyle = "#3E9418"; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(f.x, f.y + bob - 20); ctx.lineTo(f.x + 6, f.y + bob - 34);
      ctx.stroke(); ctx.restore();
      ellipse(ctx, f.x + 16, f.y + bob - 32, 13, 7, "#5CC22B");
    }
  }

  /** Home: a big flower that opens when the flock arrives. */
  _goalArt(ctx) {
    const { x, y } = this.goal;
    const open = this.state === "won" ? 1 : 0.72 + Math.sin(this.t * 2) * 0.05;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.t * 0.25);
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      const col = [C.candy, C.sun, C.sky, C.jade][i % 4];
      ellipse(ctx, 0, -58 * open, 26 * open, 44 * open, col.base);
      ellipse(ctx, 0, -66 * open, 14 * open, 22 * open, col.light);
    }
    ctx.restore();
    circle(ctx, x, y + 4, 34, "#D18B00");
    circle(ctx, x, y, 34, "#FFC61E");
    circle(ctx, x - 10, y - 10, 11, alpha("#FFFFFF", 0.8));
    if (this.state !== "won") {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(this.t * 3) * 0.12;
      circle(ctx, x, y, 96, alpha("#FFFFFF", 0.7));
      ctx.restore();
    }
  }

  /* -------------------------------------------------------------- hud */

  _hud(ctx, view) {
    // How many friends you have, which is also how full the song is.
    const kind = KINDS[this.def.kind];
    fillRound(ctx, view.x + 96, view.y + 22, 208, 66, 33, alpha("#0B2030", 0.42));
    circle(ctx, view.x + 138, view.y + 55, 25, kind.dark);
    circle(ctx, view.x + 138, view.y + 52, 25, kind.body);
    circle(ctx, view.x + 131, view.y + 45, 8, alpha("#FFFFFF", 0.8));
    text(ctx, `${this.count}`, view.x + 190, view.y + 55, { size: 34, color: "#FFFFFF", align: "left" });
    text(ctx, `${this.collected}/${this.fruit.length}`, view.x + 268, view.y + 57,
      { size: 20, color: alpha("#FFFFFF", 0.8) });

    if (this.state !== "play") return;

    this._button(ctx, this.hud.jump, "JUMP", C.jade, this.jumpT > 0);
    this._button(ctx, this.hud.split,
      this.merged ? "SPLIT" : "JOIN", C.grape, this.count < 2);

    if (this.flash.t > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.flash.t * 2);
      text(ctx, this.flash.text, view.x + view.w / 2, view.y + view.h * 0.2,
        { size: 30, color: "#FFFFFF" });
      ctx.restore();
    }
  }

  _button(ctx, r, label, col, dim) {
    ctx.save();
    if (dim) ctx.globalAlpha = 0.4;
    fillRound(ctx, r.x, r.y + 8, r.w, r.h, 34, col.deep);
    fillRound(ctx, r.x, r.y, r.w, r.h, 34, col.base);
    fillRound(ctx, r.x + 12, r.y + 10, r.w - 24, r.h * 0.34, 24, alpha("#FFFFFF", 0.22));
    text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: 30, color: "#0E2016" });
    ctx.restore();
  }

  _intro(ctx, view) {
    ctx.save();
    ctx.fillStyle = alpha("#0B2030", 0.55);
    ctx.fillRect(view.x, view.y, view.w, view.h);
    const k = easeOutBack(Math.min(1, this.stateT * 2));
    ctx.translate(view.x + view.w / 2, view.y + view.h * 0.42);
    ctx.scale(k, k);
    fillRound(ctx, -300, -130, 600, 260, 40, "#FFFFFF");
    text(ctx, this.def.name, 0, -66, { size: 44, color: "#14303F" });
    text(ctx, this.def.teaches, 0, -8, { size: 26, color: "#4B6B7B" });
    text(ctx, "Tilt your phone to roll", 0, 42, { size: 22, color: "#4B6B7B" });
    fillRound(ctx, -130, 70, 260, 66, 33, C.jade.base);
    text(ctx, "GO", 0, 103, { size: 32, color: "#0E2016" });
    ctx.restore();
  }

  _won(ctx, view) {
    ctx.save();
    ctx.fillStyle = alpha("#0B2030", 0.55);
    ctx.fillRect(view.x, view.y, view.w, view.h);
    const k = easeOutBack(Math.min(1, this.stateT * 1.6));
    ctx.translate(view.x + view.w / 2, view.y + view.h * 0.42);
    ctx.scale(k, k);
    fillRound(ctx, -310, -160, 620, 320, 44, "#FFFFFF");
    text(ctx, "HOME!", 0, -92, { size: 50, color: "#14303F" });
    const stars = this.stars();
    for (let i = 0; i < 3; i++) {
      const on = i < stars;
      circle(ctx, (i - 1) * 84, -18, 34, on ? C.sun.base : "#D8E2E8");
      text(ctx, "★", (i - 1) * 84, -6, { size: 38, color: on ? "#FFFFFF" : "#B6C6CE" });
    }
    text(ctx, `${this.count} friends · ${this.collected}/${this.fruit.length} fruit`,
      0, 52, { size: 24, color: "#4B6B7B" });
    fillRound(ctx, -140, 84, 280, 62, 31, C.jade.base);
    text(ctx, "NEXT", 0, 115, { size: 30, color: "#0E2016" });
    ctx.restore();
  }
}

/**
 * Per-level palettes: [sky top, sky middle, sky low, far hills, grass, soil].
 *
 * Saturated and high-key throughout. The original's art direction was settled
 * only after trying claymation, papercraft and textures, and what it landed on
 * was flat and bright — the cheerfulness is the point, not a side effect.
 */
const SKIES = [
  ["#3FB9F0", "#9BE3FF", "#DFF6E4", "#7FCB92", "#5CC22B", "#2C6B10"],
  ["#FF8FC8", "#FFC3E2", "#FFF0D8", "#E39BB8", "#FF5BA8", "#9E1258"],
  ["#4A8BF0", "#8FC4FF", "#E4F2FF", "#7FA8DB", "#3FA9E0", "#12547E"],
  ["#37C9A8", "#93E8D4", "#EAFBE8", "#6FC7A8", "#4ECB4E", "#1C6B34"],
  ["#9B6BF0", "#C6A6FF", "#F0E6FF", "#A98FD0", "#8A5BE0", "#4B1F8E"],
  ["#FF9A4A", "#FFC98F", "#FFF0DC", "#DBA075", "#FF7A3D", "#8E3410"],
];

const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
