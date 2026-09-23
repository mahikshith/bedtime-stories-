/**
 * The tutorial, and the menu that can replay it. One copy, every game.
 *
 * WHY THIS EXISTS. Tested on a phone, three separate games came back as
 * "I totally did not understand the whole concept of the game". Not "it is
 * too hard" — *unreadable*. A balance puzzle, a robot program and a tangram
 * all present a board with no verb on it: nothing on screen says what you are
 * supposed to DO. An adult solves this by poking at it. A five-year-old
 * closes the game.
 *
 * WHY A HAND AND NOT A PARAGRAPH. Most of the children this is for cannot
 * read, so an instruction panel is decoration. What they can do — extremely
 * well, from about eighteen months — is copy a demonstrated action. So the
 * tutorial demonstrates: a hand comes in, does the actual gesture on the
 * actual board, and the caption is there for whichever parent is squinting
 * over their shoulder. The caption is also spoken, because the child who
 * cannot read it can still listen to it.
 *
 * WHY IT LIVES IN core/. It is the same overlay for all ten games; only the
 * script differs, and a script is data. The back corner drifted to a
 * different size in one game out of ten purely from being copied, and that
 * was eight lines. This is four hundred.
 *
 * The scene underneath is frozen while this is up (`blocking`), so a child
 * reading how to play does not come back to a drowned bird.
 */

import { TOKENS, C, alpha } from "./palette.js";
import { circle, fillRound, text, outlinedText } from "./draw.js";
import { clamp, lerp } from "./engine.js";
import { speak, sfx } from "./audio.js";
import { save } from "./storage.js";
import { haptics } from "./native.js";

/* ------------------------------------------------------------ the hand */

/**
 * A pointing hand, drawn at `(x, y)` with the fingertip AT that point.
 *
 * The fingertip is the origin rather than the wrist because every script
 * position means "the place being touched", and a hand anchored at the wrist
 * would need every coordinate offset by however long the finger happens to
 * be — which is exactly the kind of arithmetic that goes wrong silently.
 *
 * `press` (0..1) curls it towards the screen, so a tap reads as a tap and not
 * as a hand teleporting.
 */
function drawHand(ctx, x, y, press = 0, scale = 1.55) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(0, press * 6);

  const skin = "#F7C89B";
  const skinDark = "#D9A171";
  const cuff = C.sea.base;

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.filter = "blur(1px)";
  circle(ctx, 4, 10, 30, "#000000");
  ctx.restore();

  // forearm + cuff, angled down-right so the hand never covers what it points at
  ctx.save();
  ctx.rotate(0.42);
  fillRound(ctx, -19, 54, 38, 66, 16, cuff);
  fillRound(ctx, -22, 44, 44, 22, 11, C.sea.light);
  // palm
  fillRound(ctx, -23, 6, 46, 52, 21, skin);
  // curled fingers, suggested rather than drawn — three soft ridges
  for (let i = 0; i < 3; i++) {
    fillRound(ctx, -20 + i * 14, 14 + (i === 1 ? -2 : 0), 12, 20, 6, skinDark);
  }
  // thumb
  fillRound(ctx, 12, 20, 16, 26, 8, skin);
  ctx.restore();

  // the index finger: straight up to the origin
  fillRound(ctx, -8, -2, 17, 40, 8.5, skin);
  circle(ctx, 0.5, 1, 8.5, skin);
  // nail
  ctx.globalAlpha = 0.55;
  fillRound(ctx, -4, -3, 9, 11, 4.5, "#FFFFFF");
  ctx.globalAlpha = 1;

  ctx.restore();
}

/** The expanding ring under a tap. `t` is 0..1 through the ripple. */
function drawRipple(ctx, x, y, t) {
  if (t <= 0 || t >= 1) return;
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.8;
  ctx.lineWidth = 5 - t * 2.5;
  ctx.strokeStyle = TOKENS.bee;
  ctx.beginPath();
  ctx.arc(x, y, 18 + t * 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A dashed trail showing where the finger is travelling. */
function drawTrail(ctx, from, to, t) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([9, 11]);
  ctx.lineDashOffset = -t * 40;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.strokeStyle = TOKENS.bee;
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
  ctx.restore();
}

/** Sound waves leaving a mouth — the "say it" gesture. */
function drawVoice(ctx, x, y, t) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const p = (t * 1.5 + i * 0.33) % 1;
    ctx.globalAlpha = (1 - p) * 0.85;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.strokeStyle = TOKENS.bee;
    ctx.beginPath();
    ctx.arc(x, y, 34 + p * 70, -0.85, 0.85);
    ctx.stroke();
  }
  ctx.restore();
  // a little microphone so the gesture is unmistakably "speak"
  ctx.save();
  ctx.globalAlpha = 0.95;
  fillRound(ctx, x - 17, y - 34, 34, 50, 17, "#FFFFFF");
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y + 8, 25, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + 33);
  ctx.lineTo(x, y + 47);
  ctx.stroke();
  ctx.restore();
}

/** A phone rocking left and right — the "tilt it" gesture. */
function drawTilt(ctx, x, y, t) {
  const a = Math.sin(t * Math.PI * 2) * 0.42;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  fillRound(ctx, -46, -76, 92, 152, 16, "#16232A");
  fillRound(ctx, -38, -66, 76, 122, 9, C.sea.dark);
  circle(ctx, 0, -1 + Math.sin(a) * 34, 15, TOKENS.bee);
  fillRound(ctx, -13, 62, 26, 6, 3, "#3E545F");
  ctx.restore();

  // arrows either side, leaning the way the phone is going
  ctx.save();
  ctx.globalAlpha = 0.55 + Math.sin(t * Math.PI * 4) * 0.25;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = TOKENS.bee;
    const ax = x + dir * 86;
    ctx.moveTo(ax - dir * 14, y - 16);
    ctx.lineTo(ax + dir * 12, y);
    ctx.lineTo(ax - dir * 14, y + 16);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------------------------------------------- the scripts */

/**
 * What each game is, and the gesture that plays it.
 *
 * `say` is read aloud and printed. It is one sentence, in the imperative,
 * naming the goal — not the controls. "Tilt the phone" tells a child which
 * muscle to use; "roll the ball onto the letters to spell the word" tells
 * them what they are FOR, and that is the part that was missing.
 *
 * Positions are FRACTIONS of the visible view, so a gesture lands on the
 * board on a short phone and a tall one alike. See `drawGesture`.
 */
export const TUTORIALS = {
  "say-jump": {
    title: "Say & Jump",
    say: "Say the word out loud to make your bird jump. Say it longer and the bird flies further!",
    steps: [
      { kind: "voice", x: 0.19, y: 0.58, secs: 2.2 },
      { kind: "arc", from: [0.19, 0.60], to: [0.74, 0.60], secs: 1.5 },
    ],
  },
  "tilt-maze": {
    title: "Tilt Maze",
    say: "Tilt your phone to roll the ball. Touch the letters in order to spell the word!",
    steps: [{ kind: "tilt", x: 0.5, y: 0.56, secs: 3.0 }],
  },
  "word-mob": {
    title: "Word Mob",
    say: "Slide left and right to run through the gate with the right word in it.",
    steps: [
      { kind: "drag", from: [0.70, 0.84], to: [0.30, 0.84], secs: 1.3 },
      { kind: "drag", from: [0.30, 0.84], to: [0.70, 0.84], secs: 1.3 },
    ],
  },
  shapes: {
    title: "Shape Sorter",
    say: "Drag each shape into the hole that matches it.",
    steps: [{ kind: "drag", from: [0.50, 0.88], to: [0.50, 0.50], secs: 1.8 }],
  },
  balance: {
    title: "Balance",
    say: "Tap a bright friend, then tap its sleepy moon twin in the same tray. They disappear together. Get the bird's box alone!",
    steps: [
      { kind: "tap", x: 0.26, y: 0.48, secs: 1.1 },
      { kind: "tap", x: 0.26, y: 0.55, secs: 1.1 },
    ],
  },
  robot: {
    title: "Robot Path",
    say: "Tap the arrows to write a plan, then press play and watch your robot run it.",
    steps: [
      { kind: "tap", x: 0.40, y: 0.93, secs: 0.9 },
      { kind: "tap", x: 0.52, y: 0.93, secs: 0.9 },
      { kind: "tap", x: 0.72, y: 0.93, secs: 1.1 },
    ],
  },
  slide: {
    title: "Sliding Blocks",
    say: "Slide the blocks out of the way to get the big red one to the door.",
    steps: [{ kind: "drag", from: [0.50, 0.45], to: [0.50, 0.68], secs: 1.6 }],
  },
  tangram: {
    title: "Tangram",
    say: "Drag the shapes together to build the picture.",
    steps: [{ kind: "drag", from: [0.30, 0.88], to: [0.50, 0.52], secs: 1.8 }],
  },
  town: {
    title: "Tinker Town",
    say: "There are no rules here. Pick anything up, carry it anywhere, and see what happens.",
    steps: [{ kind: "drag", from: [0.35, 0.72], to: [0.68, 0.82], secs: 1.8 }],
  },
  "echo-pop": {
    title: "Echo Pop",
    say: "Listen for the word, then pop the bubble with that thing inside it.",
    steps: [
      { kind: "voice", x: 0.5, y: 0.34, secs: 1.8 },
      { kind: "tap", x: 0.42, y: 0.62, secs: 1.3 },
    ],
  },
};

/* ------------------------------------------------------------- geometry */

/** Big enough for a four-year-old's aim; lumi-ui's floor is 56px. */
const BTN_H = 92;
const ICON = 60;

/* ---------------------------------------------------------------- Coach */

/**
 * The overlay. Two modes share it because they share all the chrome:
 *
 *   "tutorial" — scrim, caption, looping hand, one big GOT IT
 *   "menu"     — scrim, three big buttons: how to play / start over / exit
 *
 * `blocking` is true in both, which is what stops the scene updating.
 */
export class Coach {
  /**
   * @param {object} o
   * @param {string} o.game      game id, used for the script and the seen-flag
   * @param {Function} o.onRestart  replay this level from the top
   * @param {Function} o.onExit     leave to the hub
   */
  constructor({ game, onRestart, onExit }) {
    this.game = game;
    this.script = TUTORIALS[game] ?? null;
    this.onRestart = onRestart;
    this.onExit = onExit;

    this.mode = null;           // null | "tutorial" | "menu"
    this.t = 0;                 // seconds inside the current mode
    this.step = 0;
    this.stepT = 0;
    this.fade = 0;              // 0..1 scrim/panel reveal
    this.view = { x: 0, y: 0, w: 720, h: 1280 };
    this.hits = [];             // rebuilt every draw, read on tap
    this._spoke = false;
  }

  get blocking() { return this.mode !== null; }

  resize(view) { this.view = view; }

  /* ------------------------------------------------------------ opening */

  /** Show the tutorial. Marks the game as seen so it does not nag. */
  openTutorial() {
    if (!this.script) return;
    this.mode = "tutorial";
    this.t = this.step = this.stepT = 0;
    this._spoke = false;
    save.markTutorial(this.game);
  }

  openMenu() {
    this.mode = "menu";
    this.t = 0;
    haptics.tap();
  }

  close() {
    this.mode = null;
    this.hits = [];
  }

  /** Run the tutorial the first time this child opens this game, and only then. */
  maybeIntroduce() {
    if (!save.seenTutorial(this.game)) this.openTutorial();
  }

  /* ------------------------------------------------------------- update */

  update(dt) {
    this.fade = clamp(this.fade + (this.mode ? dt * 5 : -dt * 7), 0, 1);
    if (!this.mode) return;
    this.t += dt;

    if (this.mode === "tutorial") {
      // Speak once, and only after the panel is actually up — a caption that
      // is read out before it appears sounds like it belongs to the last
      // screen.
      if (!this._spoke && this.t > 0.35) {
        this._spoke = true;
        speak(this.script.say, { rate: 0.82 });
      }
      const steps = this.script.steps;
      this.stepT += dt;
      const dur = (steps[this.step]?.secs ?? 1.2) + 0.45;   // a beat between beats
      if (this.stepT >= dur) {
        this.stepT = 0;
        this.step = (this.step + 1) % steps.length;
      }
    }
  }

  /* -------------------------------------------------------------- input */

  /** @returns {boolean} true when the tap was ours and the scene must not see it. */
  down(p) {
    if (!this.mode) {
      // Closed: the only thing we own is the info button.
      const b = this.infoRect();
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        this.openMenu();
        return true;
      }
      return false;
    }
    for (const h of this.hits) {
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
        haptics.tap();
        sfx.tick?.();
        h.act();
        return true;
      }
    }
    return true;   // the scrim eats everything else
  }

  // The scene must not receive a drag that started on the overlay either.
  move() { return this.blocking; }
  up() { return this.blocking; }

  /* --------------------------------------------------------------- draw */

  /**
   * The info button, under the back corner rather than beside it.
   *
   * Top-right is taken by hearts or a score in most of these games and the
   * top strip by a progress bar, but the left edge below the back corner is
   * clear everywhere — checked against a screenshot of all ten, not assumed.
   */
  infoRect() {
    const { x, y } = this.view;
    return { x: x + 14, y: y + 88, w: ICON, h: ICON };
  }

  draw(ctx) {
    if (this.fade <= 0.001 && !this.mode) { this.drawInfoButton(ctx); return; }
    const v = this.view;

    ctx.save();
    ctx.globalAlpha = this.fade;
    // Light enough to still SEE the board underneath. A tutorial that dims the
    // game to near-black is a hand waving at a dark rectangle; the whole point
    // is that the gesture happens on the real thing.
    ctx.fillStyle = alpha("#050B0E", 0.46);
    ctx.fillRect(v.x, v.y, v.w, v.h);

    this.hits = [];
    if (this.mode === "tutorial") this.drawTutorial(ctx);
    else if (this.mode === "menu") this.drawMenu(ctx);
    ctx.restore();

    if (!this.mode) this.drawInfoButton(ctx);
  }

  drawInfoButton(ctx) {
    const b = this.infoRect();
    ctx.save();
    ctx.globalAlpha = 0.92 * (1 - this.fade);
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    circle(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w / 2, alpha("#0B1417", 0.78));
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = alpha("#FFFFFF", 0.8);
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, "?", b.x + b.w / 2, b.y + b.h / 2 + 2, { size: 36, color: "#FFFFFF" });
    ctx.restore();
  }

  /* ----------------------------------------------------------- tutorial */

  drawTutorial(ctx) {
    const v = this.view;
    const cx = v.x + v.w / 2;

    this.drawGesture(ctx);

    // Caption card high on the screen, with the dismiss button INSIDE it.
    //
    // The button used to sit at the bottom of the screen where a dismiss
    // button belongs, and in two games it landed squarely on top of the thing
    // being demonstrated: Word Mob steers from the bottom and Robot Path
    // builds its program there, so the hand doing the gesture was hidden
    // behind "LET'S PLAY". Bundling the button into the card keeps the whole
    // board below it free, which is the half of the screen the tutorial is
    // actually about.
    const cw = Math.min(600, v.w - 48);
    const lines = wrap(ctx, this.script.say, cw - 56, 30);
    const ch = 150 + lines.length * 40 + BTN_H;
    const cyTop = v.y + 96;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    fillRound(ctx, cx - cw / 2, cyTop, cw, ch, 32, "#16242B");
    ctx.restore();
    fillRound(ctx, cx - cw / 2 + 4, cyTop + 4, cw - 8, ch - 8, 28, "#1E2F37");

    text(ctx, "HOW TO PLAY", cx, cyTop + 40, { size: 22, color: TOKENS.bee, weight: 900 });
    text(ctx, this.script.title, cx, cyTop + 80, { size: 38, color: "#FFFFFF", weight: 900 });
    lines.forEach((ln, i) => {
      text(ctx, ln, cx, cyTop + 130 + i * 40, { size: 28, color: "#D6E3EA", weight: 700 });
    });

    const bw = Math.min(330, cw - 72);
    this.button(ctx, cx - bw / 2, cyTop + ch - BTN_H - 26, bw, BTN_H,
      "LET'S PLAY!", C.grass.base, C.grass.dark, () => this.close());
  }

  /** Whichever beat of the script is current, drawn where the script says. */
  drawGesture(ctx) {
    const s = this.script.steps[this.step];
    if (!s) return;
    const v = this.view;
    // Script positions are FRACTIONS of the visible view, not design pixels.
    //
    // Design-space coordinates were the obvious choice and they were wrong:
    // the engine letterboxes 720×1280 into whatever the screen is and then
    // expands the view to fill the bars, so the visible height is anywhere
    // from 1280 to about 1700. A gesture pinned to design y=980 lands on the
    // board on one phone and in the sky on the next. A fraction lands in the
    // same place on both, which is what "point at the pieces" has to mean.
    const px = (f) => v.x + f * v.w;
    const py = (f) => v.y + f * v.h;
    const dur = s.secs ?? 1.2;
    const t = clamp(this.stepT / dur, 0, 1);

    if (s.kind === "tap") {
      const x = px(s.x), y = py(s.y);
      const press = t < 0.3 ? t / 0.3 : t < 0.55 ? 1 : 0;
      drawRipple(ctx, x, y, clamp((t - 0.3) / 0.6, 0, 1));
      drawHand(ctx, x, y, press);
      return;
    }
    if (s.kind === "drag" || s.kind === "arc") {
      const [x1, y1] = [px(s.from[0]), py(s.from[1])];
      const [x2, y2] = [px(s.to[0]), py(s.to[1])];
      drawTrail(ctx, [x1, y1], [x2, y2], this.t);
      // ease so it reads as a deliberate movement, not a linear slide
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      let x = lerp(x1, x2, e);
      let y = lerp(y1, y2, e);
      // an "arc" is the same gesture lobbed, for games where the thing flies
      if (s.kind === "arc") y -= Math.sin(e * Math.PI) * v.h * 0.11;
      drawRipple(ctx, x1, y1, clamp(t * 2.2, 0, 1));
      drawHand(ctx, x, y, 1);
      return;
    }
    if (s.kind === "voice") {
      drawVoice(ctx, px(s.x), py(s.y), this.stepT);
      return;
    }
    if (s.kind === "tilt") {
      drawTilt(ctx, px(s.x), py(s.y), this.stepT);
    }
  }

  /* --------------------------------------------------------------- menu */

  drawMenu(ctx) {
    const v = this.view;
    const cx = v.x + v.w / 2;
    const w = Math.min(460, v.w - 64);
    const gap = 22;
    const rows = [
      ["HOW TO PLAY", C.sea.base, C.sea.dark, () => this.openTutorial()],
      ["START OVER", C.sun.base, C.sun.dark, () => { this.close(); this.onRestart?.(); }],
      ["LEAVE GAME", C.cherry.base, C.cherry.dark, () => this.onExit?.()],
      ["KEEP PLAYING", C.grass.base, C.grass.dark, () => this.close()],
    ].filter(([label]) => label !== "HOW TO PLAY" || this.script);

    const total = rows.length * BTN_H + (rows.length - 1) * gap;
    let y = v.y + (v.h - total) / 2 + 30;

    text(ctx, "PAUSED", cx, y - 78, { size: 44, color: "#FFFFFF", weight: 900 });

    for (const [label, face, edge, act] of rows) {
      this.button(ctx, cx - w / 2, y, w, BTN_H, label, face, edge, act);
      y += BTN_H + gap;
    }
  }

  /** A chunky button that also registers itself as a hit target. */
  button(ctx, x, y, w, h, label, face, edge, act) {
    fillRound(ctx, x, y + 6, w, h, 26, edge);
    fillRound(ctx, x, y, w, h, 26, face);
    fillRound(ctx, x + 10, y + 8, w - 20, h * 0.34, 16, alpha("#FFFFFF", 0.22));
    outlinedText(ctx, label, x + w / 2, y + h / 2 + 2,
      { size: 30, color: "#FFFFFF", weight: 900, stroke: alpha(edge, 0.85), strokeWidth: 5 });
    this.hits.push({ x, y, w, h, act });
  }
}

/** Greedy word wrap against the real measured font. */
function wrap(ctx, str, maxW, size) {
  ctx.save();
  ctx.font = `700 ${size}px "Baloo 2","Nunito",system-ui,sans-serif`;
  const out = [];
  let line = "";
  for (const word of str.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; }
    else line = next;
  }
  if (line) out.push(line);
  ctx.restore();
  return out;
}
