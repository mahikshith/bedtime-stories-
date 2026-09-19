/**
 * Say & Jump — a platformer where the only control is the child's voice.
 *
 * The loop:
 *   1. the character walks itself to the next marked jump point and stops
 *   2. a word card appears and the mascot reads the word aloud
 *   3. the child says the word; loudness and length fill a charge meter
 *   4. a dotted arc shows exactly where that charge would land them
 *   5. when they stop speaking, the jump fires with that power
 *
 * Two decisions carry the design:
 *
 * The character walks itself. A five-year-old cannot manage a joystick and a
 * microphone at once, so the game owns locomotion and the child owns the one
 * thing being taught. Jump points are authored (the `W` markers), not derived,
 * so a designer decides where a word is asked for.
 *
 * The arc preview is drawn while charging. "Louder goes further" is an
 * abstract claim until a child sees the dotted line stretch past the gap as
 * they push their voice — it turns the mechanic into something learnable in
 * one attempt instead of ten.
 */

import { Engine, clamp, lerp, approach, easeOutCubic, easeOutBack } from "../../core/engine.js";
import { Body, World, TILE, KIND, HAZARD, TUNE, solveJump } from "../../core/physics.js";
import { loadLevel, LEVELS, LEVEL_COUNT } from "./levels.js";
import { THEMES, drawBackdrop, drawPlatform, drawHazard, drawProp, Weather } from "../../art/environment.js";
import { drawBird, birdBlink, BIRDS } from "../../art/bird.js";
import { C, TOKENS, PAIRS, alpha, mix } from "../../core/palette.js";
import { roundRect, fillRound, circle, text, outlinedText, star as starShape } from "../../core/draw.js";
import { VoiceInput, matchWord } from "../../core/voice.js";
import { sfx, speak, stopSpeaking, startMusic, stopMusic } from "../../core/audio.js";
import { wordsForLevel, stretched } from "../../core/words.js";
import { save, starsFromAccuracy } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";

const GAME_ID = "say-jump";

/** A level names the band it was paced for; used when the player has none. */
const def_band = (lvl) => lvl.band ?? "mid";

/** Charge -> jump arc. Tuned against the authored gap widths. */
// Apex is capped at four tiles. A higher arc looks impressive but pushes the
// landing platform out of frame on a portrait screen, so the player loses
// sight of where they are going at exactly the wrong moment.
const JUMP = { minApex: 120, maxApex: 260, minDist: 150, maxDist: 560 };

const apexFor = (c) => lerp(JUMP.minApex, JUMP.maxApex, c);
const distFor = (c) => lerp(JUMP.minDist, JUMP.maxDist, c);

/** Inverse: the charge needed to travel `d` forward. */
const chargeForDist = (d) => clamp((d - JUMP.minDist) / (JUMP.maxDist - JUMP.minDist), 0, 1);

export class SayJumpScene {
  constructor({ levelIndex = 0, band = "mid", cast = "pip", onExit, onComplete }) {
    this.levelIndex = levelIndex;
    this.band = band;  // may be overridden by the level's own band in load()
    this.birdId = cast in BIRDS ? cast : "chick";
    this.onExit = onExit;
    this.onComplete = onComplete;

    this.state = "intro";       // intro|walk|prompt|charge|air|hurt|done
    this.t = 0;
    this.stateT = 0;

    this.fx = new Fx();
    this.hearts = 5;
    this.starsGot = 0;
    this.wordsRight = 0;
    this.wordsAsked = 0;

    this.voice = new VoiceInput({ sensitivity: save.state.settings.voiceSensitivity });
    this.voiceReady = false;
    this.holdCharge = 0;        // touch fallback
    this.holding = false;

    this.cam = { x: 0, y: 0, shake: 0 };
    // ~12 tiles across. Framing two perches AND the gap between them is the
    // minimum needed to judge a jump before committing to it; anything
    // tighter and the player is guessing.
    this.zoom = 0.9;

    this.load(levelIndex);
  }

  /* ------------------------------------------------------------- setup */

  load(index) {
    const lvl = loadLevel(index);
    this.level = lvl;
    this.theme = THEMES[lvl.theme] ?? THEMES.meadow;
    this.weather = new Weather(this.theme, 22);

    this.world = new World({
      platforms: lvl.platforms,
      hazards: lvl.hazards,
      width: lvl.width,
      height: lvl.height,
    });
    this.world.onHazard = (h) => this.hit(h);
    this.world.onBounce = (p) => {
      p.squish = 1;
      sfx.jump(0.9);
      this.fx.dust(p.x + p.w / 2, p.y, 1, TOKENS.snow);
    };
    this.world.onCrumble = () => sfx.tick();

    // The character is a little under two tiles tall.
    this.body = new Body(lvl.spawn.x + 8, lvl.spawn.y + TILE - 92, 50, 84);
    // Drawn larger than the collision box so the bird reads big on a phone
    // without making the hitbox unfair.
    this.charH = 118;
    this.safeSpot = { x: this.body.x, y: this.body.y };

    // Jump points, left to right, are the authored W markers; the goal is the
    // implicit final one.
    this.stops = lvl.wordGates
      .slice()
      .sort((a, b) => a.x - b.x)
      .map((g) => ({ x: g.x, done: false }));
    this.stopIndex = 0;

    // One word per stop, deterministic for the level so a retry is familiar.
    this.words = wordsForLevel(this.band ?? def_band(lvl), index + 1, Math.max(3, this.stops.length));
    this.word = null;
    this.heard = "";

    this.pickups = lvl.pickups;
    this.goalReached = false;
    this.setState("intro");
  }

  async enter(engine) {
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    startMusic();

    // Ask for the mic up front; the whole game depends on it, and a child
    // should meet the permission prompt on the title card, not mid-level.
    this.voiceReady = await this.voice.start();
    if (this.voiceReady) {
      this.voice.onUtterance = (u) => this.onUtterance(u);
      this.voice.onStart = () => { if (this.state === "prompt") this.setState("charge"); };
      if (save.state.settings.speechCheck) this.voice.startRecognition();
    }

    // Pointer input is routed by the engine; space bar mirrors it, because a
    // laptop with no touchscreen still has to be able to play.
    this._kd = (e) => { if (e.code === "Space" && !e.repeat) this.down(); };
    this._ku = (e) => { if (e.code === "Space") this.up(); };
    window.addEventListener("keydown", this._kd);
    window.addEventListener("keyup", this._ku);
  }

  destroy() {
    this.voice.stop();
    stopSpeaking();
    stopMusic();
    window.removeEventListener("keydown", this._kd);
    window.removeEventListener("keyup", this._ku);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    if (s === "prompt") this.askWord();
  }

  /* -------------------------------------------------------------- words */

  askWord() {
    const stop = this.stops[this.stopIndex];
    if (!stop) return;
    this.word = this.words[this.stopIndex % this.words.length];
    this.heard = "";
    this.voice.clearTranscript();
    this.wordsAsked++;
    // Read it aloud — the child has to hear the target to produce it.
    speak(this.word.word);
    // How far this specific jump needs to go, so the meter can show a target.
    this.needCharge = chargeForDist(this.gapAhead() + 70);
  }

  /** Distance from the character to the far side of the gap in front. */
  gapAhead() {
    const fromX = this.body.x + this.body.w;
    let best = Infinity;
    for (const p of this.world.platforms) {
      if (p.gone) continue;
      const px = p.kind === KIND.MOVING ? Math.min(p.x, p.ox) : p.x;
      if (px + 4 < fromX) continue;
      if (p.y < this.body.bottom - TILE * 4) continue; // ignore high ledges
      best = Math.min(best, px - fromX);
    }
    return Number.isFinite(best) ? Math.max(60, best) : 260;
  }

  onUtterance(u) {
    if (this.state !== "charge" && this.state !== "prompt") return;
    const charge = Math.max(u.charge, u.peak * 0.55);
    let bonus = false;
    if (this.word && u.transcript && save.state.settings.speechCheck) {
      const m = matchWord(u.transcript, this.word.word);
      this.heard = m.heard;
      if (m.match) {
        bonus = true;
        save.learnWord(this.word.word);
      }
    } else if (this.word) {
      // No recognition available: loud enough counts as said.
      if (charge > 0.28) bonus = true;
    }
    this.launch(charge, bonus);
  }

  /* ------------------------------------------------------------- action */

  launch(charge, correct) {
    const c = clamp(charge, 0.06, 1);
    // Saying the right word adds real reach — the reward has to be mechanical,
    // not just a sticker, or children stop bothering to pronounce it.
    const eff = clamp(c * (correct ? 1.12 : 1), 0, 1);
    this.world.jump(this.body, apexFor(eff), distFor(eff), 1);
    this.body.speedMul = 1.6;
    sfx.jump(eff);
    this.fx.dust(this.body.cx, this.body.bottom, 0.8, alpha(this.theme.cap.light, 0.9));
    if (correct) {
      this.wordsRight++;
      this.fx.say(this.body.cx, this.body.y - 30, "PERFECT!", TOKENS.bee, 20);
      this.fx.burst(this.body.cx, this.body.cy, [TOKENS.bee, TOKENS.snow, this.theme.accent], 16);
      sfx.correct();
      save.addXp(5);
    }
    if (this.stops[this.stopIndex]) this.stops[this.stopIndex].done = true;
    this.stopIndex++;
    this.setState("air");
  }

  down() {
    if (this.state === "intro") { this.setState("walk"); return; }
    if (this.state === "done") { this.finish(); return; }
    // Touch ALWAYS works, even when the microphone is listening.
    //
    // It used to be switched off the moment the mic initialised, on the theory
    // that a working mic makes the button redundant. It does not: a quiet
    // child, a noisy room, a broken mic or — as happened — an audio graph that
    // silently never started all leave the child holding a game that ignores
    // them completely, with nothing on screen explaining why. Having both is
    // never worse, and the child gets to choose.
    if (this.state === "prompt" || this.state === "charge") {
      this.holding = true;
      this.holdCharge = 0;
      this.setState("charge");
    }
  }

  up() {
    if (!this.holding) return;
    this.holding = false;
    if (this.state === "charge") this.launch(this.holdCharge, this.holdCharge > 0.3);
  }

  hit(h) {
    if (this.state === "hurt" || this.state === "done") return;
    this.hearts--;
    this.cam.shake = 16;
    sfx.hurt();
    this.fx.burst(this.body.cx, this.body.cy, [TOKENS.cardinal, TOKENS.snow], 12);
    this.setState("hurt");
  }

  respawn() {
    this.body.x = this.safeSpot.x;
    this.body.y = this.safeSpot.y;
    this.body.vx = 0; this.body.vy = 0;
    this.body.spin = 0; this.body.spinVel = 0;
    // Step back to the stop we were heading for so the word is asked again.
    this.stopIndex = Math.max(0, this.stopIndex - 1);
    this.setState("walk");
  }

  finish() {
    const acc = this.wordsAsked ? this.wordsRight / this.wordsAsked : 0;
    let stars = starsFromAccuracy(this.wordsRight, Math.max(1, this.wordsAsked));
    if (this.hearts <= 1 && stars > 1) stars--;
    if (this.starsGot >= this.pickups.length && stars < 3 && acc > 0.6) stars = Math.min(3, stars + 1);
    save.recordLevel(GAME_ID, this.levelIndex, stars, this.starsGot);
    save.addXp(10 + this.starsGot * 3);
    save.touchStreak();
    this.onComplete?.({ stars, starsGot: this.starsGot, total: this.pickups.length,
                        words: this.wordsRight, asked: this.wordsAsked, hearts: this.hearts });
  }

  /* -------------------------------------------------------------- update */

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.fx.update(dt);
    this.weather.update(dt);
    this.world.stepPlatforms(dt);
    if (this.voiceReady) this.voice.update(dt);
    for (const p of this.world.platforms) if (p.squish) p.squish = Math.max(0, p.squish - dt * 3);
    for (const h of this.world.hazards) if (h.type === HAZARD.SAW) {
      h.spin = (h.spin ?? 0) + dt * 7;
      if (h.tx) h.x = h.ox + (Math.sin(this.t * h.speed) + 1) / 2 * h.tx;
    }

    let move = 0;

    switch (this.state) {
      case "intro":
        if (this.stateT > 2.6) this.setState("walk");
        break;

      case "walk": {
        const stop = this.stops[this.stopIndex];
        const targetX = stop ? stop.x : this.level.goal.x + TILE / 2;
        const dx = targetX - this.body.cx;
        if (dx > 14) move = 1;
        else {
          this.body.vx *= 0.6;
          if (stop) {
            if (this.body.onGround) this.setState("prompt");
          } else if (!this.goalReached && Math.abs(dx) < 40 && this.body.onGround) {
            this.goalReached = true;
            this.setState("done");
            sfx.fanfare();
            this.fx.burst(this.body.cx, this.body.cy, [TOKENS.bee, TOKENS.snow, this.theme.accent], 26);
          }
        }
        if (this.body.onGround) this.markSafe();
        break;
      }

      case "prompt":
        this.body.vx *= 0.7;
        if (this.body.onGround) this.markSafe();
        break;

      case "charge":
        this.body.vx *= 0.7;
        if (this.holding) {
          // Touch fallback charges at roughly the rate a sustained word does.
          this.holdCharge = clamp(this.holdCharge + dt * 0.85, 0, 1);
          if (Math.random() < dt * 22) this.fx.note(this.body.cx + 20, this.body.y + 22, this.theme.accent);
        } else if (this.voice.speaking) {
          if (Math.random() < dt * 30 * this.voice.level) {
            this.fx.note(this.body.cx + 20, this.body.y + 22, this.theme.accent);
          }
        } else if (this.stateT > 0.35 && !this.voice.speaking && this.voiceReady) {
          // Voice stopped without an utterance firing (too quiet) — go back.
          if (this.voice.level < 0.05) this.setState("prompt");
        }
        break;

      case "air":
        if (this.body.onGround && this.stateT > 0.12) {
          sfx.land();
          this.fx.dust(this.body.cx, this.body.bottom, 0.9, alpha(this.theme.cap.light, 0.9));
          this.body.speedMul = 1;
          this.markSafe();
          this.setState("walk");
        }
        break;

      case "hurt":
        if (this.stateT > 0.85) {
          if (this.hearts <= 0) { this.setState("done"); }
          else this.respawn();
        }
        break;

      case "done":
        this.body.vx *= 0.8;
        break;
    }

    if (this.state !== "hurt") this.world.step(this.body, dt, move);

    // pickups
    for (const p of this.pickups) {
      if (p.taken) continue;
      if (Math.abs(p.x - this.body.cx) < 44 && Math.abs(p.y - this.body.cy) < 54) {
        p.taken = true;
        this.starsGot++;
        sfx.coin();
        this.fx.burst(p.x, p.y, [TOKENS.bee, TOKENS.snow], 10);
        this.fx.say(p.x, p.y - 18, "+1", TOKENS.bee, 16);
        save.addGems(1);
      }
    }

    this.updateCamera(dt);
  }

  markSafe() {
    // Remember the last grounded spot that wasn't a crumbling tile, so a
    // respawn never drops the child onto something already falling away.
    const g = this.body.ground;
    if (!g || g.kind === KIND.CRUMBLE || g.kind === KIND.MOVING) return;
    this.safeSpot = { x: this.body.x, y: this.body.y - 4 };
  }

  updateCamera(dt) {
    const view = this.engine?.view ?? { w: 720, h: 1280 };
    const vw = view.w / this.zoom, vh = view.h / this.zoom;
    // Lead the camera slightly ahead so the child sees where they're going.
    const targetX = this.body.cx - vw * 0.38;
    const targetY = this.body.cy - vh * 0.34;
    // Vertical bounds are derived from the level, not guessed: a level shorter
    // than the viewport should sit still rather than drift into empty sky.
    const minY = -90;
    const maxY = Math.max(minY, this.level.height - vh - 120);
    // Let the camera drift left of the level's origin. Clamping at 0 parked
    // the bird against the left edge at every level start, directly behind the
    // voice meter.
    const minX = -vw * 0.2;
    this.cam.x = approach(this.cam.x, clamp(targetX, minX, Math.max(minX, this.level.width - vw)), 6, dt);
    this.cam.y = approach(this.cam.y, clamp(targetY, minY, maxY), 5, dt);
    this.cam.shake = Math.max(0, this.cam.shake - dt * 60);
  }

  /* ---------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    const vw = view.w / this.zoom, vh = view.h / this.zoom;
    const shake = this.cam.shake;
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;

    drawBackdrop(ctx, view, this.cam, this.theme, this.t);

    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cam.x + sx, -this.cam.y + sy);

    const cull = { x: this.cam.x - 120, w: vw + 240 };
    const vis = (x, w = 0) => x + w > cull.x && x < cull.x + cull.w;

    for (const p of this.level.props) if (vis(p.x, 60)) drawProp(ctx, p, this.theme, this.t);
    for (const h of this.world.hazards) if (vis(h.x, h.w)) drawHazard(ctx, h, this.theme, this.t);
    for (const p of this.world.platforms) {
      if (p.gone || !vis(p.x, p.w)) continue;
      drawPlatform(ctx, p, this.theme, this.t);
    }

    this.drawGoal(ctx);
    this.drawPickups(ctx);
    this.drawStopMarkers(ctx);
    if (this.state === "charge") this.drawArc(ctx);
    this.drawPlayer(ctx);
    this.fx.draw(ctx);

    ctx.restore();

    this.weather.draw(ctx, view);
    this.drawHud(ctx, view);
  }

  drawGoal(ctx) {
    const g = this.level.goal;
    if (!g) return;
    const x = g.x + TILE / 2, y = g.y + TILE;
    const wave = Math.sin(this.t * 3) * 6;
    ctx.save();
    ctx.lineWidth = 7;
    ctx.strokeStyle = TOKENS.snow;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 150); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 150);
    ctx.quadraticCurveTo(x + 40 + wave, y - 132, x + 78, y - 148);
    ctx.lineTo(x + 78, y - 100);
    ctx.quadraticCurveTo(x + 40 + wave, y - 84, x, y - 102);
    ctx.closePath();
    ctx.fillStyle = this.goalReached ? TOKENS.featherGreen : TOKENS.cardinal;
    ctx.fill();
    starShape(ctx, x + 40, y - 124, 15, 7, 5, TOKENS.snow);
    ctx.restore();
  }

  drawPickups(ctx) {
    for (const p of this.pickups) {
      if (p.taken) continue;
      const bob = Math.sin(this.t * 3 + p.bob) * 7;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.rotate(Math.sin(this.t * 2 + p.bob) * 0.2);
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
      glow.addColorStop(0, alpha(TOKENS.bee, 0.5));
      glow.addColorStop(1, alpha(TOKENS.bee, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(-34, -34, 68, 68);
      starShape(ctx, 0, 0, 19, 9, 5, TOKENS.bee);
      starShape(ctx, -3, -3, 9, 4, 5, mix(TOKENS.bee, "#ffffff", 0.6));
      ctx.restore();
    }
  }

  /** A soft glow on the ground where the next word will be asked. */
  drawStopMarkers(ctx) {
    const stop = this.stops[this.stopIndex];
    if (!stop || this.state === "done") return;
    const y = this.body.bottom;
    const pulse = 0.5 + Math.sin(this.t * 4) * 0.25;
    ctx.save();
    ctx.globalAlpha = 0.5 * pulse;
    ctx.fillStyle = this.theme.accent;
    ctx.beginPath();
    ctx.ellipse(stop.x, y - 4, 34, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * The dotted landing arc. Drawn only while charging, and coloured by
   * whether the current charge actually reaches solid ground — green means
   * "let go now", red means "keep going".
   */
  drawArc(ctx) {
    const c = this.currentCharge();
    const { points, landing } = this.world.predictArc(this.body, apexFor(c), distFor(c), 1, { steps: 90 });
    const good = !!landing;
    const col = good ? TOKENS.featherGreen : TOKENS.cardinal;
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (let i = 2; i < points.length; i += 3) {
      const p = points[i];
      const k = 1 - i / points.length;
      circle(ctx, p.x, p.y, 3 + k * 3, col);
    }
    if (landing) {
      const last = points[points.length - 1];
      ctx.globalAlpha = 0.5 + Math.sin(this.t * 9) * 0.25;
      ctx.lineWidth = 4;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.ellipse(last.x, landing.y + 3, 30, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  currentCharge() {
    if (this.holding) return this.holdCharge;
    if (this.voiceReady && this.voice.speaking) {
      return clamp(Math.max(this.voice.charge, this.voice.peak * 0.55), 0, 1);
    }
    return 0;
  }

  drawPlayer(ctx) {
    const b = this.body;
    const state =
      this.state === "done" ? "cheer" :
      this.state === "hurt" ? "hurt" :
      this.state === "charge" ? "charge" :
      !b.onGround ? (b.vy < -40 ? "jump" : "fall") :
      b.landImpact > 0.12 ? "land" :
      Math.abs(b.vx) > 22 ? "run" : "idle";

    const airborne = b.onGround ? 0 : clamp(-b.vy / 700 + 0.4, 0, 1);

    drawBird(ctx, b.cx, b.bottom, this.charH, {
      bird: this.birdId,
      state,
      t: this.t,
      flip: b.facing,
      power: this.state === "charge" ? this.currentCharge() : b.landImpact,
      spin: b.spin,
      airborne,
      blink: birdBlink(this.t, 2),
    });
  }

  /* ----------------------------------------------------------------- HUD */

  drawHud(ctx, view) {
    const pad = 20;
    const top = view.y + pad;

    // progress along the level
    const prog = clamp(this.body.cx / Math.max(1, this.level.width - TILE * 4), 0, 1);
    const barX = view.x + 86, barW = view.w - 86 - pad - 120;
    fillRound(ctx, barX, top + 8, barW, 20, 10, alpha("#000000", 0.35));
    fillRound(ctx, barX, top + 8, barW * prog, 20, 10, TOKENS.bee);
    if (prog > 0.04) {
      fillRound(ctx, barX + 5, top + 12, Math.max(0, barW * prog - 10), 6, 3, alpha("#ffffff", 0.35));
    }

    // close button
    ctx.save();
    ctx.globalAlpha = 0.85;
    text(ctx, "✕", view.x + pad + 16, top + 18, { size: 30, color: TOKENS.snow });
    ctx.restore();

    // hearts
    for (let i = 0; i < 5; i++) {
      const hx = view.x + view.w - pad - 24 - i * 26;
      this.drawHeart(ctx, hx, top + 18, 10, i < this.hearts);
    }

    // stars collected
    text(ctx, `★ ${this.starsGot}/${this.pickups.length}`, view.x + view.w - pad - 4, top + 52,
      { size: 20, color: TOKENS.bee, align: "right" });

    this.drawVoiceMeter(ctx, view);

    if (this.state === "prompt" || this.state === "charge") this.drawWordCard(ctx, view);
    if (this.state === "intro") this.drawIntro(ctx, view);
    if (this.state === "done") this.drawDone(ctx, view);
    if (!this.voiceReady && this.state !== "intro") {
      text(ctx, "No microphone — hold the screen to charge",
        view.x + view.w / 2, view.y + view.h - 12,
        { size: 15, color: alpha(TOKENS.snow, 0.6) });
    }
  }

  drawHeart(ctx, x, y, r, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.75);
    ctx.bezierCurveTo(-r * 1.5, -r * 0.4, -r * 0.5, -r * 1.3, 0, -r * 0.5);
    ctx.bezierCurveTo(r * 0.5, -r * 1.3, r * 1.5, -r * 0.4, 0, r * 0.75);
    ctx.closePath();
    ctx.fillStyle = filled ? TOKENS.cardinal : alpha("#000000", 0.35);
    ctx.fill();
    ctx.restore();
  }

  /**
   * The charge meter — modelled directly on the reference: a black capsule,
   * an amber column that rises with the voice, and hard red threshold lines
   * marking the jump the gap in front actually needs.
   *
   * The red lines are the teaching device. A child learns "get the yellow
   * past the red line" in one attempt, which is a far more concrete
   * instruction than "say it louder".
   */
  drawVoiceMeter(ctx, view) {
    const w = 46;
    const x = view.x + 26;
    const h = Math.min(430, view.h * 0.42);
    const y = view.y + view.h * 0.40 - h / 2;
    const r = w / 2;
    const active = this.state === "prompt" || this.state === "charge";
    const need = this.needCharge ?? 0.4;

    // body
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;
    fillRound(ctx, x, y, w, h, r, "#0B1113");
    ctx.restore();
    fillRound(ctx, x + 3, y + 3, w - 6, h - 6, r - 3, "#161F23");

    // amber column
    const c = this.currentCharge();
    const live = this.voiceReady ? Math.max(c, this.voice.level * 0.5) : c;
    const fh = (h - 12) * clamp(live, 0, 1);
    if (fh > 5) {
      const fy = y + h - 6 - fh;
      const reached = c >= need;
      const top = reached ? C.grass.light : C.sun.light;
      const bot = reached ? C.grass.base : C.sun.base;
      const grad = ctx.createLinearGradient(0, fy, 0, y + h);
      grad.addColorStop(0, top);
      grad.addColorStop(1, bot);
      roundRect(ctx, x + 6, fy, w - 12, fh, (w - 12) / 2);
      ctx.fillStyle = grad;
      ctx.fill();
      // inner gloss
      fillRound(ctx, x + 11, fy + 6, (w - 12) * 0.32, Math.max(0, fh - 16), 5, alpha("#FFFFFF", 0.45));
      // the column glows once it clears the line
      if (reached) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(this.t * 10) * 0.2;
        ctx.shadowColor = C.grass.light;
        ctx.shadowBlur = 22;
        roundRect(ctx, x + 6, fy, w - 12, fh, (w - 12) / 2);
        ctx.fillStyle = C.grass.light;
        ctx.fill();
        ctx.restore();
      }
    }

    // red threshold lines
    if (active) {
      const marks = [
        { at: need, label: true },
        { at: Math.min(0.97, need + 0.3), label: false },
      ];
      for (const m of marks) {
        const my = y + 6 + (h - 12) * (1 - m.at);
        ctx.save();
        ctx.strokeStyle = C.cherry.base;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x + 2, my);
        ctx.lineTo(x + w - 2, my);
        ctx.stroke();
        ctx.restore();
        if (m.label) {
          ctx.save();
          ctx.globalAlpha = 0.55 + Math.sin(this.t * 4) * 0.25;
          text(ctx, "▸", x + w + 12, my, { size: 20, color: C.cherry.base, align: "left" });
          ctx.restore();
        }
      }
    }

    // microphone
    const micY = y + h + 40;
    const speaking = this.voiceReady && this.voice.speaking;
    if (speaking) {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(this.t * 12) * 0.12;
      circle(ctx, x + w / 2, micY - 4, 30 + Math.sin(this.t * 12) * 4, C.cherry.base);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.42;
    const micCol = !this.voiceReady ? C.slate.light : speaking ? C.cherry.base : "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;
    fillRound(ctx, x + w / 2 - 9, micY - 22, 18, 26, 9, micCol);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = micCol;
    ctx.beginPath();
    ctx.arc(x + w / 2, micY - 6, 14, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w / 2, micY + 8);
    ctx.lineTo(x + w / 2, micY + 16);
    ctx.stroke();
    ctx.restore();
  }

  /** The word the child has to say, with a picture and a stretched spelling. */
  drawWordCard(ctx, view) {
    const w = Math.min(430, view.w - 150);
    const h = 168;
    const x = view.x + view.w / 2 - w / 2 + 36;
    const pop = easeOutBack(clamp(this.stateT * 3.2, 0, 1));
    const y = view.y + view.h - h - 30 - (1 - pop) * 40;

    ctx.save();
    ctx.globalAlpha = pop;
    fillRound(ctx, x, y + 6, w, h, 22, alpha("#000000", 0.45));
    fillRound(ctx, x, y, w, h, 22, TOKENS.inkRaised);
    fillRound(ctx, x, y, w, 6, 3, alpha(this.theme.accent, 0.8));

    const W = this.word;
    if (W) {
      ctx.save();
      ctx.font = "56px system-ui, 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(W.emoji, x + 62, y + h / 2 - 6);
      ctx.restore();

      text(ctx, "SAY IT LOUD!", x + 124, y + 34,
        { size: 14, color: this.theme.accent, align: "left" });
      text(ctx, W.word.toUpperCase(), x + 124, y + 74,
        { size: 42, color: TOKENS.snow, align: "left" });
      // the stretched form teaches "hold the vowel to jump further"
      text(ctx, stretched(W.word).toUpperCase() + " →", x + 124, y + 116,
        { size: 22, color: alpha(TOKENS.snow, 0.55), align: "left" });
      text(ctx, W.syl.join(" · "), x + 124, y + 144,
        { size: 16, color: TOKENS.textDim, align: "left" });

      // replay button
      circle(ctx, x + w - 42, y + h / 2, 24, alpha(this.theme.accent, 0.25));
      text(ctx, "🔊", x + w - 42, y + h / 2, { size: 24, color: TOKENS.snow });
    }
    ctx.restore();

    if (this.heard) {
      text(ctx, `heard: "${this.heard}"`, view.x + view.w / 2, y - 14,
        { size: 15, color: alpha(TOKENS.snow, 0.5) });
    }
  }

  drawIntro(ctx, view) {
    const k = clamp(this.stateT * 2.2, 0, 1);
    const out = clamp((this.stateT - 2.1) * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.58;
    ctx.fillStyle = TOKENS.inkDeep;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = (1 - out);
    const cy = view.y + view.h * 0.42;
    const lvl = LEVELS[this.levelIndex];
    text(ctx, `LEVEL ${this.levelIndex + 1} — ${this.theme.name.toUpperCase()}`,
      view.x + view.w / 2, cy - 90, { size: 18, color: this.theme.accent });
    text(ctx, lvl.name, view.x + view.w / 2, cy - 34,
      { size: 52 * easeOutBack(k), color: TOKENS.snow });
    text(ctx, lvl.teaches, view.x + view.w / 2, cy + 26, { size: 24, color: alpha(TOKENS.snow, 0.8) });
    text(ctx, "tap to start", view.x + view.w / 2, cy + 110,
      { size: 18, color: alpha(TOKENS.snow, 0.45 + Math.sin(this.t * 4) * 0.2) });
    ctx.restore();
  }

  drawDone(ctx, view) {
    const k = clamp(this.stateT * 1.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.85 * k;
    ctx.fillStyle = TOKENS.inkDeep;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = k;
    const cy = view.y + view.h * 0.4;
    const won = this.hearts > 0;
    text(ctx, won ? "LEVEL COMPLETE!" : "OUT OF HEARTS",
      view.x + view.w / 2, cy, { size: 46 * easeOutBack(k), color: won ? TOKENS.bee : TOKENS.cardinal });
    text(ctx, `${this.wordsRight} / ${this.wordsAsked} words · ★ ${this.starsGot}/${this.pickups.length}`,
      view.x + view.w / 2, cy + 56, { size: 24, color: TOKENS.snow });
    text(ctx, "tap to continue", view.x + view.w / 2, cy + 130,
      { size: 18, color: alpha(TOKENS.snow, 0.5) });
    ctx.restore();
  }
}
