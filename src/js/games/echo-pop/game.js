/**
 * Echo Pop — a first game for two- to five-year-olds.
 *
 * Bubbles drift up the screen, each carrying a thing. The bird asks for one
 * by name, out loud. The child says it — loudness pops the bubble — or taps
 * it if they are not talking yet.
 *
 * Design rules for this age, which are different from every other game here:
 *
 *  - There is NO fail state. A wrong bubble gives a gentle "try again" and
 *    the right one is re-spoken. A toddler who is told off stops playing.
 *  - There is no timer, no score to lose, no lives. The round ends when the
 *    child has found the things, however long that takes.
 *  - Touch targets are enormous — a quarter of the screen. Small children
 *    have poor fine motor control and will otherwise "miss" a correct answer.
 *  - The target is always spoken aloud and repeated on a gentle cadence,
 *    because a pre-reader cannot be given the instruction in writing.
 *  - Success is loud: the whole screen celebrates. That is the entire reward
 *    loop at this age.
 */

import { clamp, lerp, approach, rand, pick, shuffle, easeOutBack } from "../../core/engine.js";
import { C, TOKENS, alpha, mix } from "../../core/palette.js";
import { fillRound, circle, ellipse, text, star as starShape } from "../../core/draw.js";
import { drawBird, birdBlink } from "../../art/bird.js";
import { VoiceInput, matchWord } from "../../core/voice.js";
import { sfx, speak, stopSpeaking, startMusic, stopMusic } from "../../core/audio.js";
import { save } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { BANK } from "../../core/words.js";

const GAME_ID = "echo-pop";
const ROUNDS = 6;

export class EchoPopScene {
  constructor({ levelIndex = 0, band = "tiny", bird = "chick", onComplete }) {
    this.levelIndex = levelIndex;
    this.band = band === "big" ? "mid" : band;   // this game tops out at 'mid'
    this.birdId = bird;
    this.onComplete = onComplete;

    this.fx = new Fx();
    this.t = 0;
    this.stateT = 0;
    this.state = "intro";        // intro | ask | celebrate | done
    this.round = 0;
    this.found = 0;
    this.tries = 0;

    this.bubbles = [];
    this.target = null;
    this.voice = new VoiceInput({ sensitivity: save.state.settings.voiceSensitivity, onThreshold: 0.13 });
    this.voiceReady = false;
    this.lastPrompt = 0;
    this.birdMood = "idle";
  }

  async enter(engine) {
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    startMusic();

    this.voiceReady = await this.voice.start();
    if (this.voiceReady) {
      this.voice.onUtterance = (u) => this.heard(u);
      if (save.state.settings.speechCheck) this.voice.startRecognition();
    }

  }

  down(p) {
    const view = this.engine.view;
    if (this.state === "intro") { this.nextRound(); return; }
    if (this.state === "done") { this.finish(); return; }
    if (this.state !== "ask") return;
    // Tapping the bird repeats the question.
    if (p.y > view.y + view.h - 260) { this.askAgain(); return; }
    for (const b of this.bubbles) {
      if (b.popped) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.15) { this.choose(b); return; }
    }
  }

  destroy() {
    this.voice.stop();
    stopSpeaking();
    stopMusic();
  }

  /* -------------------------------------------------------------- rounds */

  nextRound() {
    if (this.round >= ROUNDS) {
      this.state = "done";
      this.stateT = 0;
      sfx.fanfare();
      return;
    }
    this.round++;
    const bank = BANK[this.band] ?? BANK.tiny;
    // Three choices: enough to be a real decision, few enough that each one
    // can be huge on screen.
    const picks = shuffle(bank).slice(0, 3);
    this.target = picks[0];
    const view = this.engine?.view ?? { x: 0, y: 0, w: 720, h: 1280 };
    const order = shuffle(picks);
    this.bubbles = order.map((w, i) => ({
      word: w,
      x: view.x + view.w * (0.22 + i * 0.28),
      // Spread across the upper playfield so the bird and its question have
      // clear room beneath, and no bubble ever hides behind the speech card.
      y: view.y + view.h * (0.30 + (i % 3) * 0.13),
      r: 112,
      vy: -rand(14, 22),
      phase: Math.random() * 6.3,
      popped: false,
      wrong: 0,
      pop: 0,
    }));
    this.state = "ask";
    this.stateT = 0;
    this.birdMood = "idle";
    this.voice.clearTranscript();
    this.askAgain();
  }

  askAgain() {
    if (!this.target) return;
    this.lastPrompt = this.t;
    this.birdMood = "charge";
    speak(`Where is the ${this.target.word}?`).then(() => { this.birdMood = "idle"; });
  }

  heard(u) {
    if (this.state !== "ask" || !this.target) return;
    const transcript = u.transcript || this.voice.lastTranscript;
    if (transcript) {
      const m = matchWord(transcript, this.target.word);
      if (m.match) {
        const b = this.bubbles.find((x) => x.word.word === this.target.word);
        if (b) this.choose(b, true);
        return;
      }
      // Said one of the other bubbles' words? Treat it as choosing that one.
      for (const b of this.bubbles) {
        if (b.popped) continue;
        if (matchWord(transcript, b.word.word).match) { this.choose(b); return; }
      }
    }
    // No recognition (or nothing understood) but a good loud try: reward the
    // effort by popping the right bubble. At this age, attempting is the skill.
    if (!this.voice.recognitionOn && u.peak > 0.3) {
      const b = this.bubbles.find((x) => x.word.word === this.target.word);
      if (b) this.choose(b, true);
    }
  }

  choose(b, spoken = false) {
    if (b.popped || this.state !== "ask") return;
    this.tries++;
    if (b.word.word === this.target.word) {
      b.popped = true;
      b.pop = 1;
      this.found++;
      this.birdMood = "cheer";
      sfx.pop();
      sfx.correct();
      this.fx.burst(b.x, b.y, [C.sun.base, C.grass.light, "#FFFFFF", C.candy.base], 34);
      this.fx.ring(b.x, b.y, "#FFFFFF", 0.6);
      this.fx.say(b.x, b.y - 40, pick(["YES!", "GREAT!", "WOW!", "SUPER!"]), C.sun.light, 44);
      save.learnWord(b.word.word);
      save.addXp(spoken ? 6 : 3);
      this.state = "celebrate";
      this.stateT = 0;
      speak(pick([`Yes! ${b.word.word}!`, `${b.word.word}! Well done!`, `That's right! ${b.word.word}!`]));
    } else {
      // Gentle miss: the bubble wobbles, nothing is lost, the ask repeats.
      b.wrong = 1;
      sfx.tick();
      this.fx.say(b.x, b.y - 30, "try again!", C.macaw ?? C.sea.light, 26);
      setTimeout(() => this.askAgain(), 700);
    }
  }

  finish() {
    // Everyone gets three stars. This game is not a test.
    save.recordLevel(GAME_ID, this.levelIndex, 3, this.found);
    save.addXp(10);
    save.touchStreak();
    this.onComplete?.({ stars: 3, found: this.found, rounds: ROUNDS, tries: this.tries });
  }

  /* --------------------------------------------------------------- loop */

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.fx.update(dt);
    if (this.voiceReady) this.voice.update(dt);

    for (const b of this.bubbles) {
      b.phase += dt;
      if (!b.popped) {
        b.y += b.vy * dt;
        b.x += Math.sin(b.phase * 0.9) * 12 * dt;
        const view = this.engine?.view;
        // Drift up and wrap, so bubbles never leave the child stranded.
        if (view && b.y < view.y + view.h * 0.16) b.y = view.y + view.h * 0.60;
      }
      b.wrong = Math.max(0, b.wrong - dt * 2);
      b.pop = Math.max(0, b.pop - dt * 1.6);
    }

    if (this.state === "intro" && this.stateT > 3) this.nextRound();
    if (this.state === "celebrate" && this.stateT > 1.9) this.nextRound();
    // Re-ask every so often if nothing is happening; a toddler's attention
    // wanders and the prompt is the whole instruction.
    if (this.state === "ask" && this.t - this.lastPrompt > 7) this.askAgain();
  }

  /* --------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
    g.addColorStop(0, "#7BD0F5");
    g.addColorStop(0.55, "#B9E9FF");
    g.addColorStop(1, "#FFF0C9");
    ctx.fillStyle = g;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    this.drawMeadow(ctx, view);

    for (const b of this.bubbles) this.drawBubble(ctx, b);
    this.drawBird(ctx, view);
    this.fx.draw(ctx);
    this.drawHud(ctx, view);

    if (this.state === "intro") this.drawIntro(ctx, view);
    if (this.state === "done") this.drawDone(ctx, view);
  }

  drawMeadow(ctx, view) {
    const base = view.y + view.h;
    ctx.beginPath();
    ctx.moveTo(view.x, base);
    for (let x = view.x; x <= view.x + view.w; x += 24) {
      ctx.lineTo(x, base - 210 + Math.sin(x / 120) * 18);
    }
    ctx.lineTo(view.x + view.w, base);
    ctx.closePath();
    ctx.fillStyle = C.grass.dark;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(view.x, base);
    for (let x = view.x; x <= view.x + view.w; x += 24) {
      ctx.lineTo(x, base - 170 + Math.sin(x / 90 + 1.5) * 14);
    }
    ctx.lineTo(view.x + view.w, base);
    ctx.closePath();
    ctx.fillStyle = C.grass.base;
    ctx.fill();
    // flowers
    for (let i = 0; i < 9; i++) {
      const x = view.x + ((i * 97) % view.w);
      const y = base - 110 + (i % 3) * 30;
      const col = [C.cherry.base, C.sun.base, C.candy.base][i % 3];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        circle(ctx, x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5, col);
      }
      circle(ctx, x, y, 4, "#FFFFFF");
    }
  }

  drawBubble(ctx, b) {
    if (b.popped && b.pop <= 0) return;
    const wobble = Math.sin(b.phase * 2) * 0.03;
    const shake = b.wrong ? Math.sin(this.t * 40) * 10 * b.wrong : 0;
    const scale = b.popped ? 1 + (1 - b.pop) * 0.6 : 1 + wobble;
    const alphaK = b.popped ? b.pop : 1;

    ctx.save();
    ctx.globalAlpha = alphaK;
    ctx.translate(b.x + shake, b.y);
    ctx.scale(scale, scale * (b.popped ? 0.9 : 1 - wobble));

    // soap bubble
    const g = ctx.createRadialGradient(-b.r * 0.32, -b.r * 0.35, b.r * 0.1, 0, 0, b.r);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.45, "rgba(190,238,255,0.5)");
    g.addColorStop(0.85, "rgba(120,200,245,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0.8)");
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = b.wrong ? C.cherry.base : "rgba(255,255,255,0.9)";
    ctx.stroke();

    // the thing inside
    ctx.save();
    ctx.font = `${b.r * 1.05}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.word.emoji, 0, b.r * 0.04);
    ctx.restore();

    // highlight
    ctx.save();
    ctx.globalAlpha = 0.85 * alphaK;
    ellipse(ctx, -b.r * 0.38, -b.r * 0.42, b.r * 0.22, b.r * 0.13, -0.7, "#FFFFFF");
    ctx.restore();
    ctx.restore();
  }

  drawBird(ctx, view) {
    const bx = view.x + view.w * 0.5;
    const by = view.y + view.h - 92;
    drawBird_(ctx, bx, by, this);
    // speech bubble with the target's picture — a pre-reader's copy of the ask
    if (this.state === "ask" && this.target) {
      const w = 230, h = 108;
      const x = bx - w / 2, y = by - 268;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      fillRound(ctx, x, y, w, h, 26, "#FFFFFF");
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(bx - 18, y + h - 2);
      ctx.lineTo(bx, y + h + 30);
      ctx.lineTo(bx + 18, y + h - 2);
      ctx.closePath();
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      text(ctx, "WHERE IS", bx, y + 26, { size: 18, color: C.slate.base });
      text(ctx, this.target.word.toUpperCase(), bx, y + 62, { size: 34, color: C.slate.deep });
      text(ctx, "🔊 tap me to hear it", bx, y + 92, { size: 14, color: C.slate.light });
    }
  }

  drawHud(ctx, view) {
    text(ctx, "✕", view.x + 38, view.y + 44, { size: 30, color: "#FFFFFF" });
    // round pips — progress a toddler can read at a glance
    const n = ROUNDS;
    const size = 22, gap = 12;
    const total = n * size + (n - 1) * gap;
    const sx = view.x + view.w / 2 - total / 2;
    for (let i = 0; i < n; i++) {
      const done = i < this.found;
      const cx = sx + i * (size + gap) + size / 2;
      if (done) starShape(ctx, cx, view.y + 46, size * 0.6, size * 0.28, 5, C.sun.base);
      else circle(ctx, cx, view.y + 46, size * 0.3, alpha("#FFFFFF", 0.55));
    }
    if (this.voiceReady) {
      // A simple level ring around the mic: the only feedback this age needs.
      const mx = view.x + view.w - 54, my = view.y + 52;
      circle(ctx, mx, my, 22 + this.voice.level * 22, alpha(C.cherry.base, 0.25));
      circle(ctx, mx, my, 18, this.voice.speaking ? C.cherry.base : alpha("#FFFFFF", 0.8));
      fillRound(ctx, mx - 4, my - 8, 8, 12, 4, this.voice.speaking ? "#FFFFFF" : C.slate.base);
    }
  }

  drawIntro(ctx, view) {
    const k = clamp(this.stateT * 2, 0, 1);
    const out = clamp((this.stateT - 2.4) * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.6;
    ctx.fillStyle = "#0B2C3A";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = 1 - out;
    const cy = view.y + view.h * 0.38;
    text(ctx, "ECHO POP", view.x + view.w / 2, cy, { size: 56 * easeOutBack(k), color: "#FFFFFF" });
    text(ctx, "Say it or tap it!", view.x + view.w / 2, cy + 58, { size: 26, color: C.sun.light });
    ctx.restore();
  }

  drawDone(ctx, view) {
    const k = clamp(this.stateT * 1.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.8 * k;
    ctx.fillStyle = "#0B2C3A";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = k;
    const cy = view.y + view.h * 0.38;
    text(ctx, "AMAZING!", view.x + view.w / 2, cy, { size: 58 * easeOutBack(k), color: C.sun.base });
    text(ctx, `You found ${this.found} things!`, view.x + view.w / 2, cy + 64, { size: 28, color: "#FFFFFF" });
    text(ctx, "tap to continue", view.x + view.w / 2, cy + 140, { size: 18, color: alpha("#FFFFFF", 0.6) });
    ctx.restore();
  }
}

/** Local wrapper so the scene method name doesn't shadow the art import. */
function drawBird_(ctx, x, y, scene) {
  drawBird(ctx, x, y, 150, {
    bird: scene.birdId,
    state: scene.birdMood === "cheer" ? "cheer" : scene.birdMood === "charge" ? "charge" : "idle",
    t: scene.t,
    power: scene.birdMood === "charge" ? 0.5 : 0,
    blink: birdBlink(scene.t, 4),
  });
}
