/**
 * Word Mob — a crowd runner where answering correctly grows your flock.
 *
 * The flock runs forward on its own; the child drags left and right to steer
 * it through one of two gates. Each gate pair asks a question — which spelling
 * is right, which word matches the picture, which one is an animal — and the
 * correct gate multiplies the flock while the wrong one takes birds away.
 * A bigger flock shoots faster, and enemies are waiting.
 *
 * Why the urgency works without being cruel: the pressure comes from the flock
 * SIZE, not from a timer or a life counter. A child who answers badly does not
 * lose; they just arrive at the next fight with fewer friends, which is
 * legible, recoverable, and creates a real reason to read the gate rather than
 * pick at random.
 *
 * The answer is committed by position, not by tapping a button. Steering into
 * a choice keeps hands on the same control the whole level and means a
 * pre-reader can play by following the picture.
 */

import { clamp, lerp, approach, rand, randInt, pick, shuffle, easeOutBack } from "../../core/engine.js";
import { C, TOKENS, alpha, mix } from "../../core/palette.js";
import { fillRound, roundRect, circle, ellipse, text, star as starShape } from "../../core/draw.js";
import { drawBird, birdBlink, BIRD_IDS } from "../../art/bird.js";
import { drawCloud } from "../../art/environment.js";
import { sfx, speak, startMusic, stopMusic } from "../../core/audio.js";
import { save } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { RUNS, buildRun } from "./levels.js";

const GAME_ID = "word-mob";

const ROAD_W = 560;          // world units across the runway
const SCROLL = 330;          // units per second the world moves toward us
const MAX_FLOCK = 120;       // hard cap; past this the screen is soup

export class WordMobScene {
  constructor({ levelIndex = 0, band = "mid", bird = "chick", onComplete }) {
    this.levelIndex = clamp(levelIndex, 0, RUNS.length - 1);
    this.band = band;
    this.birdId = bird;
    this.onComplete = onComplete;

    this.run = buildRun(this.levelIndex, band);
    this.fx = new Fx();
    this.t = 0;
    this.stateT = 0;
    this.state = "intro";       // intro | run | boss | done
    this.distance = 0;

    this.leadX = 0;             // -1..1 across the runway
    this.targetX = 0;
    this.dragging = false;

    this.flock = [];
    this.bullets = [];
    this.enemies = [];
    this.answered = 0;
    this.correct = 0;
    this.shootCooldown = 0;
    this.combo = 0;

    this.setFlock(this.run.startFlock);
  }

  setFlock(n) {
    n = clamp(Math.round(n), 0, MAX_FLOCK);
    while (this.flock.length < n) {
      // New birds spawn behind the leader and catch up, which makes a
      // multiply gate feel like a burst rather than a number changing.
      this.flock.push({
        x: this.leadX * ROAD_W / 2 + rand(-40, 40),
        y: rand(40, 150),
        tx: 0, ty: 0,
        seed: Math.random() * 10,
        kind: pick(BIRD_IDS),
        pop: 1,
      });
    }
    if (this.flock.length > n) this.flock.length = n;
  }

  get size() { return this.flock.length; }

  async enter(engine) {
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    startMusic();

    const cv = engine.canvas;
    this._pd = (e) => {
      if (this.state === "intro") { this.state = "run"; this.stateT = 0; return; }
      if (this.state === "done") { this.finish(); return; }
      this.dragging = true;
      this._grabX = engine.toLocal(e).x;
      this._grabLead = this.leadX;
    };
    this._pm = (e) => {
      if (!this.dragging) return;
      const p = engine.toLocal(e);
      this.targetX = clamp(this._grabLead + (p.x - this._grabX) / (ROAD_W * 0.42), -1, 1);
    };
    this._pu = () => { this.dragging = false; };
    cv.addEventListener("pointerdown", this._pd);
    window.addEventListener("pointermove", this._pm);
    window.addEventListener("pointerup", this._pu);
    window.addEventListener("pointercancel", this._pu);
    this._kd = (e) => {
      if (e.key === "ArrowLeft") this.targetX = clamp(this.targetX - 0.5, -1, 1);
      if (e.key === "ArrowRight") this.targetX = clamp(this.targetX + 0.5, -1, 1);
      if (e.code === "Space" && this.state === "intro") this.state = "run";
    };
    window.addEventListener("keydown", this._kd);
  }

  destroy() {
    stopMusic();
    this.engine?.canvas.removeEventListener("pointerdown", this._pd);
    window.removeEventListener("pointermove", this._pm);
    window.removeEventListener("pointerup", this._pu);
    window.removeEventListener("pointercancel", this._pu);
    window.removeEventListener("keydown", this._kd);
  }

  /* --------------------------------------------------------------- loop */

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.fx.update(dt);

    if (this.state === "intro") { if (this.stateT > 3.2) this.state = "run"; return; }
    if (this.state === "done") return;

    this.distance += SCROLL * dt;
    this.leadX = approach(this.leadX, this.targetX, 9, dt);

    this.updateFlock(dt);
    this.updateGates(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);

    if (this.distance >= this.run.length && !this.enemies.length) {
      this.state = "done";
      this.stateT = 0;
      sfx.fanfare();
    }
  }

  /** Formation: a loose wedge behind the leader, with spring-follow. */
  updateFlock(dt) {
    const leadPx = this.leadX * (ROAD_W / 2 - 60);
    const n = this.size;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.4)));
    this.flock.forEach((b, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const spread = clamp(34 - n * 0.1, 14, 34);
      b.tx = leadPx + (col - (cols - 1) / 2) * spread;
      b.ty = 90 + row * spread * 0.82 + Math.sin(this.t * 4 + b.seed) * 4;
      b.x = approach(b.x, b.tx, 7 + (i % 3), dt);
      b.y = approach(b.y, b.ty, 6 + (i % 4), dt);
      b.pop = Math.max(0, b.pop - dt * 2.2);
    });
  }

  updateGates(dt) {
    for (const g of this.run.gates) {
      if (g.done) continue;
      g.screenY = g.at - this.distance;
      // The flock crosses the gate line
      if (g.screenY < 0 && g.screenY > -220) {
        const side = this.leadX < 0 ? 0 : 1;
        g.done = true;
        this.answered++;
        const chosen = g.options[side];
        if (chosen.correct) {
          this.correct++;
          this.combo++;
          const before = this.size;
          const after = chosen.op === "mul" ? before * chosen.value : before + chosen.value;
          this.setFlock(after);
          sfx.correct();
          this.fx.say(0, -240, `+${Math.round(this.size - before)}`, C.grass.light, 40);
          this.fx.burst(0, -230, [C.grass.light, "#FFFFFF", C.sun.base], 22);
          save.addXp(4);
          if (g.word) save.learnWord(g.word);
        } else {
          this.combo = 0;
          const before = this.size;
          const after = chosen.op === "mul" ? before * chosen.value : before + chosen.value;
          this.setFlock(Math.max(1, after));
          sfx.wrong();
          this.fx.say(0, -240, `${Math.round(this.size - before)}`, C.cherry.light, 36);
        }
        // Say the right answer out loud either way — a wrong guess is the
        // best moment to hear the correct word.
        const right = g.options.find((o) => o.correct);
        if (right?.speak) speak(right.speak);
      }
    }
  }

  updateEnemies(dt) {
    for (const e of this.run.enemies) {
      if (e.spawned || e.at - this.distance > 1400) continue;
      e.spawned = true;
      this.enemies.push({
        x: e.x * (ROAD_W / 2 - 80), y: -(e.at - this.distance) - 200,
        hp: e.hp, maxHp: e.hp, r: 34 + Math.min(40, e.hp * 0.6),
        boss: !!e.boss, seed: Math.random() * 10, hit: 0,
      });
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.y += (SCROLL * 0.55) * dt;
      e.x += Math.sin(this.t * 1.5 + e.seed) * 30 * dt;
      e.hit = Math.max(0, e.hit - dt * 5);
      if (e.hp <= 0) {
        sfx.pop();
        this.fx.burst(e.x, e.y, [C.grape.light, C.cherry.light, "#FFFFFF"], e.boss ? 40 : 16);
        this.enemies.splice(i, 1);
        save.addXp(2);
        continue;
      }
      // Reaching the flock costs birds.
      if (e.y > 60) {
        const bite = e.boss ? 25 : 6;
        this.setFlock(Math.max(1, this.size - bite));
        sfx.hurt();
        this.fx.burst(e.x, e.y, [C.cherry.base], 12);
        this.enemies.splice(i, 1);
      }
    }

    // auto-fire: rate scales with flock size, so growth is felt as power
    this.shootCooldown -= dt;
    if (this.enemies.length && this.shootCooldown <= 0) {
      const rate = clamp(0.34 - this.size * 0.0022, 0.05, 0.34);
      this.shootCooldown = rate;
      const from = this.leadX * (ROAD_W / 2 - 60);
      const spread = Math.min(3, 1 + Math.floor(this.size / 26));
      for (let i = 0; i < spread; i++) {
        this.bullets.push({
          x: from + (i - (spread - 1) / 2) * 26,
          y: 60, vy: -820, r: 9 + Math.min(8, this.size * 0.06),
        });
      }
      sfx.shoot();
    }
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;
      if (b.y < -900) { this.bullets.splice(i, 1); continue; }
      for (const e of this.enemies) {
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
          e.hp -= 1 + Math.floor(this.size / 30);
          e.hit = 1;
          this.bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  finish() {
    const acc = this.answered ? this.correct / this.answered : 0;
    const stars = acc >= 0.9 ? 3 : acc >= 0.6 ? 2 : 1;
    save.recordLevel(GAME_ID, this.levelIndex, stars, this.size);
    save.addXp(10 + stars * 5);
    save.touchStreak();
    this.onComplete?.({ stars, flock: this.size, correct: this.correct, asked: this.answered });
  }

  /* --------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    ctx.save();
    // Camera sits behind the flock looking forward; world origin is the
    // centre of the runway at the flock's line.
    ctx.translate(view.x + view.w / 2, view.y + view.h * 0.74);

    this.drawSky(ctx, view);
    this.drawRoad(ctx, view);
    this.drawGates(ctx);
    this.drawEnemies(ctx);
    this.drawBullets(ctx);
    this.drawFlock(ctx);
    this.fx.draw(ctx);
    ctx.restore();

    this.drawHud(ctx, view);
    if (this.state === "intro") this.drawIntro(ctx, view);
    if (this.state === "done") this.drawDone(ctx, view);
  }

  drawSky(ctx, view) {
    const top = -view.h * 0.74, h = view.h;
    const g = ctx.createLinearGradient(0, top, 0, top + h * 0.6);
    g.addColorStop(0, "#1B4C8A");
    g.addColorStop(0.5, "#3FA0E0");
    g.addColorStop(1, "#9FDCFF");
    ctx.fillStyle = g;
    ctx.fillRect(-view.w, top, view.w * 2, h);
    for (let i = 0; i < 5; i++) {
      const y = top + 80 + ((i * 260 + this.distance * 0.06) % (view.h * 0.5));
      drawCloud(ctx, -view.w * 0.4 + ((i * 337) % (view.w * 0.9)), y, 54 + (i % 3) * 22);
    }
  }

  /** The runway: a perspective strip with scrolling rungs. */
  drawRoad(ctx, view) {
    const nearW = ROAD_W, farW = ROAD_W * 0.32;
    const horizon = -view.h * 0.42;
    ctx.beginPath();
    ctx.moveTo(-nearW / 2, 260);
    ctx.lineTo(nearW / 2, 260);
    ctx.lineTo(farW / 2, horizon);
    ctx.lineTo(-farW / 2, horizon);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, horizon, 0, 260);
    g.addColorStop(0, "#2F7A34");
    g.addColorStop(1, "#5CC22B");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.clip();
    // rungs recede toward the horizon; spacing is squared so it reads as depth
    for (let i = 0; i < 26; i++) {
      const p = ((i * 90 - this.distance) % 2340) / 2340;
      const k = 1 - Math.pow(1 - ((p % 1) + 1) % 1, 2.2);
      const y = lerp(horizon, 260, k);
      const w = lerp(farW, nearW, k);
      ctx.globalAlpha = 0.16 * k;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(-w / 2, y, w, 6 + 10 * k);
    }
    ctx.restore();

    // edge rails
    ctx.save();
    ctx.lineWidth = 7;
    ctx.strokeStyle = C.bone.light;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * nearW / 2, 260);
      ctx.lineTo(s * farW / 2, horizon);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGates(ctx) {
    for (const g of this.run.gates) {
      if (g.done) continue;
      const d = g.at - this.distance;
      if (d > 1500 || d < -260) continue;
      // Map distance to screen with the same curve the road rungs use.
      const k = clamp(1 - d / 1500, 0, 1);
      const kk = Math.pow(k, 2.2);
      const y = lerp(-this.engine.view.h * 0.42, 220, kk);
      const scale = lerp(0.32, 1, kk);
      const halfW = (ROAD_W * scale) / 2;

      ctx.save();
      ctx.globalAlpha = clamp(k * 2.4, 0, 1);
      for (let i = 0; i < 2; i++) {
        const opt = g.options[i];
        const x = (i === 0 ? -halfW / 2 : halfW / 2);
        const w = halfW * 0.94, h = 128 * scale;
        const col = opt.op === "mul" || opt.value > 0
          ? { a: C.grass.base, b: C.grass.dark }
          : { a: C.cherry.base, b: C.cherry.dark };
        fillRound(ctx, x - w / 2, y - h, w, h, 14 * scale, alpha(col.b, 0.92));
        fillRound(ctx, x - w / 2, y - h, w, h * 0.5, 14 * scale, alpha(col.a, 0.92));
        // posts
        fillRound(ctx, x - w / 2 - 8 * scale, y - h - 8 * scale, 12 * scale, h + 16 * scale, 6 * scale, C.bone.light);
        fillRound(ctx, x + w / 2 - 4 * scale, y - h - 8 * scale, 12 * scale, h + 16 * scale, 6 * scale, C.bone.light);

        const label = opt.label;
        text(ctx, label, x, y - h * 0.58, { size: Math.max(9, 40 * scale), color: "#FFFFFF" });
        const op = opt.op === "mul" ? `×${opt.value}` : `${opt.value > 0 ? "+" : ""}${opt.value}`;
        text(ctx, op, x, y - h * 0.2, { size: Math.max(8, 30 * scale), color: alpha("#FFFFFF", 0.9) });
      }
      // the question, floating above the pair
      if (g.prompt && k > 0.25) {
        const qw = halfW * 1.7, qh = 56 * scale;
        fillRound(ctx, -qw / 2, y - 128 * scale - qh - 12 * scale, qw, qh, 12 * scale, alpha("#0B1113", 0.8));
        text(ctx, g.prompt, 0, y - 128 * scale - qh / 2 - 12 * scale,
          { size: Math.max(9, 26 * scale), color: C.sun.base });
      }
      ctx.restore();
    }
  }

  drawEnemies(ctx) {
    for (const e of this.enemies) {
      const wob = Math.sin(this.t * 3 + e.seed) * 4;
      ctx.save();
      ctx.translate(e.x, e.y + wob);
      if (e.hit) { ctx.save(); ctx.globalAlpha = e.hit * 0.8; }
      const body = e.boss ? C.grape : C.slate;
      circle(ctx, 0, 6, e.r, alpha("#000000", 0.25));
      circle(ctx, 0, 0, e.r, e.hit > 0.4 ? "#FFFFFF" : body.base);
      circle(ctx, -e.r * 0.25, -e.r * 0.3, e.r * 0.6, alpha(body.light, 0.7));
      if (e.hit) ctx.restore();
      // grumpy face
      for (const s of [-1, 1]) {
        ellipse(ctx, s * e.r * 0.34, -e.r * 0.1, e.r * 0.18, e.r * 0.22, "#FFFFFF");
        circle(ctx, s * e.r * 0.34, -e.r * 0.06, e.r * 0.1, "#141A1D");
        ctx.save();
        ctx.lineWidth = e.r * 0.11;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#141A1D";
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.12, -e.r * 0.46);
        ctx.lineTo(s * e.r * 0.56, -e.r * 0.3);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.lineWidth = e.r * 0.1;
      ctx.strokeStyle = "#141A1D";
      ctx.beginPath();
      ctx.arc(0, e.r * 0.5, e.r * 0.3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.restore();
      // hp bar
      const w = e.r * 1.9;
      fillRound(ctx, -w / 2, -e.r - 22, w, 10, 5, alpha("#000000", 0.5));
      fillRound(ctx, -w / 2, -e.r - 22, w * clamp(e.hp / e.maxHp, 0, 1), 10, 5,
                e.boss ? C.sun.base : C.cherry.base);
      ctx.restore();
    }
  }

  drawBullets(ctx) {
    for (const b of this.bullets) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      circle(ctx, b.x, b.y + 10, b.r * 0.9, alpha(C.sun.dark, 0.5));
      circle(ctx, b.x, b.y, b.r, C.sun.base);
      circle(ctx, b.x - b.r * 0.25, b.y - b.r * 0.3, b.r * 0.42, "#FFFFFF");
      ctx.restore();
    }
  }

  drawFlock(ctx) {
    // back rows first so the leader reads on top
    const sorted = this.flock.slice().sort((a, b) => a.y - b.y);
    for (const b of sorted) {
      const s = 62 * (1 + b.pop * 0.5);
      drawBird(ctx, b.x, b.y, s, {
        bird: b.kind, state: "run", t: this.t + b.seed,
        flip: 1, airborne: 0, blink: birdBlink(this.t, b.seed),
      });
    }
  }

  /* ---------------------------------------------------------------- HUD */

  drawHud(ctx, view) {
    const pad = 24;
    const top = view.y + pad;
    text(ctx, "✕", view.x + pad + 14, top + 18, { size: 30, color: "#FFFFFF" });

    // flock counter — the whole game in one number
    const cx = view.x + view.w / 2;
    const pop = this.flock.length;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 14;
    fillRound(ctx, cx - 92, top, 184, 62, 31, alpha("#0B1113", 0.72));
    ctx.restore();
    text(ctx, "🐤", cx - 54, top + 32, { size: 30, color: "#FFFFFF" });
    text(ctx, String(pop), cx + 16, top + 31, { size: 38, color: C.sun.base });

    // progress
    const prog = clamp(this.distance / this.run.length, 0, 1);
    const bx = view.x + pad, bw = view.w - pad * 2;
    fillRound(ctx, bx, top + 76, bw, 12, 6, alpha("#000000", 0.4));
    fillRound(ctx, bx, top + 76, bw * prog, 12, 6, C.grass.base);

    if (this.combo > 1) {
      text(ctx, `${this.combo} IN A ROW!`, cx, top + 112,
        { size: 22, color: C.sun.light });
    }

    text(ctx, "drag to steer", cx, view.y + view.h - 34,
      { size: 16, color: alpha("#FFFFFF", 0.45) });
  }

  drawIntro(ctx, view) {
    const k = clamp(this.stateT * 2, 0, 1);
    const out = clamp((this.stateT - 2.7) * 3.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.75;
    ctx.fillStyle = "#070E11";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = 1 - out;
    const cy = view.y + view.h * 0.42;
    text(ctx, `RUN ${this.levelIndex + 1}`, view.x + view.w / 2, cy - 80, { size: 18, color: C.sun.base });
    text(ctx, this.run.name, view.x + view.w / 2, cy - 24, { size: 46 * easeOutBack(k), color: "#FFFFFF" });
    text(ctx, this.run.teaches, view.x + view.w / 2, cy + 34, { size: 22, color: alpha("#FFFFFF", 0.82) });
    text(ctx, "drag left or right to pick a gate", view.x + view.w / 2, cy + 92,
      { size: 17, color: alpha("#FFFFFF", 0.5) });
    ctx.restore();
  }

  drawDone(ctx, view) {
    const k = clamp(this.stateT * 1.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.84 * k;
    ctx.fillStyle = "#070E11";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = k;
    const cy = view.y + view.h * 0.4;
    text(ctx, "RUN COMPLETE!", view.x + view.w / 2, cy, { size: 46 * easeOutBack(k), color: C.sun.base });
    text(ctx, `Flock of ${this.size}`, view.x + view.w / 2, cy + 62, { size: 34, color: "#FFFFFF" });
    text(ctx, `${this.correct} / ${this.answered} gates right`, view.x + view.w / 2, cy + 112,
      { size: 22, color: alpha("#FFFFFF", 0.8) });
    text(ctx, "tap to continue", view.x + view.w / 2, cy + 176, { size: 18, color: alpha("#FFFFFF", 0.5) });
    ctx.restore();
  }
}
