/**
 * Tilt Maze — roll a marble through a labyrinth by tilting the phone.
 *
 * The learning layer: letters are scattered through the maze and must be
 * collected IN ORDER to spell a word. The exit stays shut until the word is
 * complete, so route-planning and spelling are the same problem.
 *
 * Why it is built this way:
 *  - The entire board is on screen at all times. A child tilting a device
 *    cannot also track a scrolling viewport.
 *  - Walls are drawn with a lit top face and dark sides so the maze reads as
 *    a physical tray with depth, the way the wooden toy it is imitating does.
 *  - The static geometry is rendered once to an offscreen canvas. Only the
 *    ball, letters and effects are redrawn per frame, which keeps this smooth
 *    on the cheap tablets these games actually run on.
 *  - Falling in a hole costs a moment, not a life. Children experiment by
 *    driving straight into hazards; punishing that teaches them to stop
 *    experimenting.
 */

import { clamp, approach, easeOutBack, lerp } from "../../core/engine.js";
import { TiltInput } from "../../core/tilt.js";
import { C, TOKENS, alpha, mix } from "../../core/palette.js";
import { fillRound, roundRect, circle, ellipse, text, star as starShape } from "../../core/draw.js";
import { drawBird, birdBlink } from "../../art/bird.js";
import { workshop } from "../../art/backdrops.js";
import { sfx, speak, startMusic, stopMusic } from "../../core/audio.js";
import { save, starsFromAccuracy } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { BOARDS, parseBoard, T } from "./levels.js";

const GAME_ID = "tilt-maze";

/** Surface feel per theme. Friction is what makes stone and ice differ. */
const SURFACE = {
  // Floors are near-white and walls are dark and saturated. An earlier pass
  // used tan floors against brown walls and the maze read as noise — the
  // single most important thing a maze must communicate is where you can go.
  wood: { accel: 1500, friction: 3.4, bounce: 0.32,
          wall: { light: "#C87A3A", base: "#9A5220", dark: "#66330F", deep: "#3E1E07" },
          floor: "#FFF3DC", floorAlt: "#F6E3C2" },
  stone: { accel: 1450, friction: 3.0, bounce: 0.38,
           wall: { light: "#7C94A2", base: "#4A6273", dark: "#2C3E4B", deep: "#18262F" },
           floor: "#EDF3F7", floorAlt: "#DCE6EC" },
  ice: { accel: 1700, friction: 0.85, bounce: 0.5,
         wall: { light: "#7FD0F5", base: "#3C9CD4", dark: "#22689A", deep: "#134262" },
         floor: "#FFFFFF", floorAlt: "#E8F6FE" },
};

export class TiltMazeScene {
  constructor({ levelIndex = 0, bird = "chick", onComplete, onExit }) {
    this.levelIndex = clamp(levelIndex, 0, BOARDS.length - 1);
    this.birdId = bird;
    this.onComplete = onComplete;
    this.onExit = onExit;

    this.board = parseBoard(BOARDS[this.levelIndex]);
    this.surface = SURFACE[this.board.theme] ?? SURFACE.wood;

    this.tilt = new TiltInput({ range: 24 });
    this.fx = new Fx();
    this.t = 0;
    this.stateT = 0;
    this.state = "intro";          // intro | play | fell | won
    this.nextLetter = 0;
    this.falls = 0;
    this.elapsed = 0;
    this.usingGyro = false;

    this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: 0, spin: 0 };
    this.tile = 64;
    this.origin = { x: 0, y: 0 };
    this.maze = null;              // offscreen canvas of the static board
  }

  async enter(engine) {
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    startMusic();

    // Gyro needs a gesture on iOS; the pointer/keyboard fallbacks are wired
    // unconditionally so the game is playable on a laptop too.
    this.tilt.attachPointer(engine.canvas);
    this.tilt.attachKeys();
    this.usingGyro = await this.tilt.requestGyro();
    this.tilt.calibrate();

    this._tap = () => {
      if (this.state === "intro") { this.state = "play"; this.stateT = 0; this.tilt.calibrate(); }
      else if (this.state === "won") this.finish();
    };
    engine.canvas.addEventListener("pointerdown", this._tap);
    speak(`Find the word ${this.board.word}`);
  }

  destroy() {
    this.tilt.destroy();
    stopMusic();
    this.engine?.canvas.removeEventListener("pointerdown", this._tap);
  }

  /** Board metrics depend on the viewport, so they are recomputed on resize. */
  resize(view) {
    const b = this.board;
    const padX = 34;
    // Reserve room for the word tray above and the hint below, then centre
    // what is left. Sizing against the whole viewport made the board float in
    // a sea of empty background.
    const headroom = 210, footroom = 150;
    const availW = view.w - padX * 2;
    const availH = view.h - headroom - footroom;
    this.tile = Math.floor(Math.min(availW / b.cols, availH / b.rows));
    const boardW = this.tile * b.cols, boardH = this.tile * b.rows;
    this.origin = {
      x: view.x + (view.w - boardW) / 2,
      y: view.y + headroom + (availH - boardH) / 2,
    };
    this.boardSize = { w: boardW, h: boardH };
    this.ball.r = this.tile * 0.3;
    if (!this._placed) { this.resetBall(); this._placed = true; }
    this.maze = null; // force a re-render of the static layer
  }

  resetBall() {
    const { start } = this.board;
    this.ball.x = (start.c + 0.5) * this.tile;
    this.ball.y = (start.r + 0.5) * this.tile;
    this.ball.vx = this.ball.vy = 0;
  }

  /* ---------------------------------------------------------------- loop */

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.fx.update(dt);
    this.tilt.update(dt);

    if (this.state === "intro") {
      if (this.stateT > 3) { this.state = "play"; this.stateT = 0; this.tilt.calibrate(); }
      return;
    }
    if (this.state === "won") return;
    if (this.state === "fell") {
      if (this.stateT > 0.65) { this.state = "play"; this.stateT = 0; this.resetBall(); }
      return;
    }

    this.elapsed += dt;
    this.stepBall(dt);
  }

  stepBall(dt) {
    const b = this.ball, S = this.surface;
    const tile = this.tile;
    const cellAt = (x, y) => {
      const c = Math.floor(x / tile), r = Math.floor(y / tile);
      if (c < 0 || r < 0 || c >= this.board.cols || r >= this.board.rows) return T.WALL;
      return this.board.grid[r][c];
    };

    const onMud = cellAt(b.x, b.y) === T.MUD;
    const friction = onMud ? S.friction * 4 : S.friction;

    b.vx += this.tilt.x * S.accel * dt;
    b.vy += this.tilt.y * S.accel * dt;
    // Exponential drag rather than a subtraction keeps the feel identical at
    // any frame rate.
    const k = Math.exp(-friction * dt);
    b.vx *= k; b.vy *= k;

    const speed = Math.hypot(b.vx, b.vy);
    const maxSpeed = tile * 13;
    if (speed > maxSpeed) { b.vx *= maxSpeed / speed; b.vy *= maxSpeed / speed; }

    // Axis-separated resolution against wall cells, with a small bounce.
    b.x += b.vx * dt;
    this.resolveAxis("x");
    b.y += b.vy * dt;
    this.resolveAxis("y");

    b.spin += speed * dt * 0.02;

    // rolling sound + dust
    if (speed > tile * 3 && Math.random() < dt * 8) sfx.step();

    this.checkPickups();
  }

  resolveAxis(axis) {
    const b = this.ball, tile = this.tile, S = this.surface;
    const r = b.r;
    const minC = Math.floor((b.x - r) / tile), maxC = Math.floor((b.x + r) / tile);
    const minR = Math.floor((b.y - r) / tile), maxR = Math.floor((b.y + r) / tile);
    for (let rr = minR; rr <= maxR; rr++) {
      for (let cc = minC; cc <= maxC; cc++) {
        const cell = (cc < 0 || rr < 0 || cc >= this.board.cols || rr >= this.board.rows)
          ? T.WALL : this.board.grid[rr][cc];
        if (cell !== T.WALL) continue;
        const wx = cc * tile, wy = rr * tile;
        // closest point on the wall tile to the ball centre
        const nx = clamp(b.x, wx, wx + tile), ny = clamp(b.y, wy, wy + tile);
        const dx = b.x - nx, dy = b.y - ny;
        if (dx * dx + dy * dy >= r * r) continue;
        if (axis === "x") {
          b.x = b.vx > 0 ? wx - r : wx + tile + r;
          if (Math.abs(b.vx) > tile * 3) sfx.tick();
          b.vx = -b.vx * S.bounce;
        } else {
          b.y = b.vy > 0 ? wy - r : wy + tile + r;
          if (Math.abs(b.vy) > tile * 3) sfx.tick();
          b.vy = -b.vy * S.bounce;
        }
      }
    }
  }

  checkPickups() {
    const b = this.ball, tile = this.tile;
    const cx = Math.floor(b.x / tile), cy = Math.floor(b.y / tile);
    const cell = this.board.grid[cy]?.[cx];

    // hole — only if the ball's centre is well inside it
    if (cell === T.HOLE) {
      const hx = (cx + 0.5) * tile, hy = (cy + 0.5) * tile;
      if (Math.hypot(b.x - hx, b.y - hy) < tile * 0.3) {
        this.falls++;
        sfx.hurt();
        this.fx.burst(this.origin.x + hx, this.origin.y + hy, [C.slate.base, C.coal.base], 10);
        this.state = "fell";
        this.stateT = 0;
        return;
      }
    }

    // letters, strictly in order
    const want = this.board.letters[this.nextLetter];
    if (want && !want.taken) {
      const lx = (want.c + 0.5) * tile, ly = (want.r + 0.5) * tile;
      if (Math.hypot(b.x - lx, b.y - ly) < tile * 0.5) {
        want.taken = true;
        this.nextLetter++;
        sfx.coin();
        this.fx.burst(this.origin.x + lx, this.origin.y + ly, [C.sun.base, "#FFFFFF"], 14);
        this.fx.say(this.origin.x + lx, this.origin.y + ly - 18, want.ch, C.sun.light, 30);
        save.addXp(3);
        if (this.nextLetter >= this.board.letters.length) {
          sfx.correct();
          speak(this.board.word);
        }
      }
    }
    // Touching a later letter early just nudges the child back on track.
    for (let i = this.nextLetter + 1; i < this.board.letters.length; i++) {
      const l = this.board.letters[i];
      if (l.taken) continue;
      const lx = (l.c + 0.5) * tile, ly = (l.r + 0.5) * tile;
      if (Math.hypot(b.x - lx, b.y - ly) < tile * 0.45 && Math.random() < 0.04) {
        this.fx.say(this.origin.x + lx, this.origin.y + ly - 20, "not yet!", C.cherry.light, 16);
      }
    }

    // exit
    if (cell === T.EXIT && this.nextLetter >= this.board.letters.length) {
      const ex = (this.board.exit.c + 0.5) * tile, ey = (this.board.exit.r + 0.5) * tile;
      if (Math.hypot(b.x - ex, b.y - ey) < tile * 0.45) {
        this.state = "won";
        this.stateT = 0;
        sfx.fanfare();
        this.fx.burst(this.origin.x + ex, this.origin.y + ey, [C.sun.base, C.grass.light, "#FFFFFF"], 30);
        save.learnWord(this.board.word.toLowerCase());
      }
    }
  }

  finish() {
    // Three stars for a clean run; a fall costs one. Time is not scored —
    // rushing a fine-motor task is the opposite of what this game trains.
    const stars = this.falls === 0 ? 3 : this.falls <= 2 ? 2 : 1;
    save.recordLevel(GAME_ID, this.levelIndex, stars, Math.round(this.elapsed));
    save.addXp(12 + stars * 4);
    save.touchStreak();
    this.onComplete?.({ stars, falls: this.falls, seconds: Math.round(this.elapsed), word: this.board.word });
  }

  /* ---------------------------------------------------------------- draw */

  /** Render the static board (floor, walls, holes, mud) once. */
  buildMaze() {
    const b = this.board, tile = this.tile, S = this.surface;
    const w = b.cols * tile, h = b.rows * tile;
    const cv = document.createElement("canvas");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr; cv.height = h * dpr;
    const x = cv.getContext("2d");
    x.scale(dpr, dpr);

    // floor: a soft checker so motion is readable against it
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        const cell = b.grid[r][c];
        if (cell === T.WALL) continue;
        x.fillStyle = (r + c) % 2 ? S.floorAlt : S.floor;
        x.fillRect(c * tile, r * tile, tile, tile);
      }
    }

    // mud
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        if (b.grid[r][c] !== T.MUD) continue;
        x.fillStyle = "#7A5B3A";
        x.fillRect(c * tile, r * tile, tile, tile);
        x.fillStyle = alpha("#3E2C1B", 0.5);
        for (let i = 0; i < 4; i++) {
          circle(x, c * tile + (i % 2 ? 0.3 : 0.7) * tile, r * tile + (i < 2 ? 0.3 : 0.7) * tile, tile * 0.13, "#5E4328");
        }
      }
    }

    // holes — a dark well with an inner rim
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        if (b.grid[r][c] !== T.HOLE) continue;
        const cx = (c + 0.5) * tile, cy = (r + 0.5) * tile;
        circle(x, cx, cy + 3, tile * 0.36, alpha("#000000", 0.25));
        const g = x.createRadialGradient(cx, cy - tile * 0.1, tile * 0.05, cx, cy, tile * 0.36);
        g.addColorStop(0, "#000000");
        g.addColorStop(0.7, "#0B1113");
        g.addColorStop(1, "#243038");
        x.fillStyle = g;
        x.beginPath(); x.arc(cx, cy, tile * 0.34, 0, Math.PI * 2); x.fill();
      }
    }

    // walls: a raised block with a lit top face and dark sides
    const wallTop = S.wall.light, wallFace = S.wall.base, wallDark = S.wall.dark;
    const lip = Math.max(7, tile * 0.22);
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        if (b.grid[r][c] !== T.WALL) continue;
        const px = c * tile, py = r * tile;
        const openBelow = b.grid[r + 1]?.[c] !== undefined && b.grid[r + 1][c] !== T.WALL;
        x.fillStyle = wallDark;
        x.fillRect(px, py, tile, tile + (openBelow ? lip : 0));
        x.fillStyle = wallFace;
        x.fillRect(px, py, tile, tile);
        x.fillStyle = wallTop;
        x.fillRect(px, py, tile, tile * 0.26);
        // a thin dark keyline around each wall block; without it adjacent
        // blocks merge into one shapeless mass
        x.strokeStyle = S.wall.deep;
        x.lineWidth = 2;
        x.strokeRect(px + 1, py + 1, tile - 2, tile - 2);
        // seams
        x.fillStyle = alpha("#000000", 0.12);
        x.fillRect(px, py + tile - 2, tile, 2);
        x.fillRect(px + tile - 2, py, 2, tile);
      }
    }

    this.maze = cv;
    this.mazeSize = { w, h };
  }

  draw(ctx, engine) {
    const view = engine.view;
    if (!this.maze) this.buildMaze();
    const b = this.board, tile = this.tile;

    workshop(ctx, view, this.t);

    // board tray, tilted very slightly with the device for physicality
    const tx = this.tilt.x * 5, ty = this.tilt.y * 5;
    ctx.save();
    ctx.translate(this.origin.x + tx, this.origin.y + ty);

    const bw = b.cols * tile, bh = b.rows * tile;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    fillRound(ctx, -14, -14, bw + 28, bh + 28, 22, C.bark.dark);
    ctx.restore();
    fillRound(ctx, -14, -14, bw + 28, bh + 28, 22, C.bark.base);
    fillRound(ctx, -10, -10, bw + 20, bh + 12, 18, C.bark.light);
    fillRound(ctx, -8, -8, bw + 16, bh + 16, 16, C.bark.dark);

    ctx.drawImage(this.maze, 0, 0, bw, bh);

    this.drawExit(ctx);
    this.drawLetters(ctx);
    this.drawBall(ctx);
    ctx.restore();

    this.fx.draw(ctx);
    this.drawHud(ctx, view);
    if (this.state === "intro") this.drawIntro(ctx, view);
    if (this.state === "won") this.drawWon(ctx, view);
  }


  drawExit(ctx) {
    const tile = this.tile;
    const ex = (this.board.exit.c + 0.5) * tile, ey = (this.board.exit.r + 0.5) * tile;
    const open = this.nextLetter >= this.board.letters.length;
    const pulse = 0.6 + Math.sin(this.t * 4) * 0.3;
    ctx.save();
    if (open) {
      const g = ctx.createRadialGradient(ex, ey, 2, ex, ey, tile * 0.9);
      g.addColorStop(0, alpha(C.grass.light, 0.85 * pulse));
      g.addColorStop(1, alpha(C.grass.light, 0));
      ctx.fillStyle = g;
      ctx.fillRect(ex - tile, ey - tile, tile * 2, tile * 2);
      circle(ctx, ex, ey, tile * 0.36, C.grass.base);
      circle(ctx, ex, ey, tile * 0.26, C.grass.light);
      starShape(ctx, ex, ey, tile * 0.2, tile * 0.09, 5, "#FFFFFF");
    } else {
      // shut: a barred gate, so "not yet" is obvious without words
      fillRound(ctx, ex - tile * 0.4, ey - tile * 0.4, tile * 0.8, tile * 0.8, 8, C.slate.dark);
      ctx.strokeStyle = C.slate.light;
      ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        const bx = ex - tile * 0.24 + i * tile * 0.24;
        ctx.beginPath(); ctx.moveTo(bx, ey - tile * 0.34); ctx.lineTo(bx, ey + tile * 0.34); ctx.stroke();
      }
      const left = this.board.letters.length - this.nextLetter;
      text(ctx, String(left), ex, ey + tile * 0.62, { size: tile * 0.28, color: C.sun.base });
    }
    ctx.restore();
  }

  drawLetters(ctx) {
    const tile = this.tile;
    this.board.letters.forEach((l, i) => {
      if (l.taken) return;
      const lx = (l.c + 0.5) * tile, ly = (l.r + 0.5) * tile;
      const isNext = i === this.nextLetter;
      const bob = Math.sin(this.t * 3 + i) * tile * 0.05;
      ctx.save();
      ctx.translate(lx, ly + bob);
      if (isNext) {
        const pulse = 0.55 + Math.sin(this.t * 5) * 0.3;
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, tile * 0.8);
        g.addColorStop(0, alpha(C.sun.light, 0.7 * pulse));
        g.addColorStop(1, alpha(C.sun.light, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-tile, -tile, tile * 2, tile * 2);
        ctx.rotate(Math.sin(this.t * 3) * 0.08);
      } else {
        ctx.globalAlpha = 0.45;
      }
      const s = tile * 0.34;
      fillRound(ctx, -s, -s + 4, s * 2, s * 2, 9, isNext ? C.sun.dark : C.slate.dark);
      fillRound(ctx, -s, -s, s * 2, s * 2, 9, isNext ? C.sun.base : C.slate.base);
      fillRound(ctx, -s + 4, -s + 4, s * 2 - 8, s * 0.5, 4, alpha("#FFFFFF", 0.35));
      text(ctx, l.ch, 0, 2, { size: tile * 0.42, color: isNext ? "#3A2600" : "#0B1113" });
      // order pip
      circle(ctx, s * 0.78, -s * 0.78, tile * 0.12, isNext ? C.cherry.base : C.slate.dark);
      text(ctx, String(l.order), s * 0.78, -s * 0.76, { size: tile * 0.16, color: "#FFFFFF" });
      ctx.restore();
    });
  }

  drawBall(ctx) {
    const b = this.ball, r = b.r;
    const falling = this.state === "fell";
    const k = falling ? clamp(1 - this.stateT / 0.55, 0, 1) : 1;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(k, k);
    // shadow
    ctx.save();
    ctx.globalAlpha = 0.3 * k;
    ellipse(ctx, 3, r * 0.5, r * 0.95, r * 0.45, "#000000");
    ctx.restore();
    // glass bubble with the bird inside — the mascot rides along
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.15);
    g.addColorStop(0, alpha("#FFFFFF", 0.95));
    g.addColorStop(0.45, alpha("#BFE9FF", 0.55));
    g.addColorStop(1, alpha("#4FA8DA", 0.6));
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.save();
    ctx.clip();
    drawBird(ctx, 0, r * 0.72, r * 1.25, {
      bird: this.birdId, state: falling ? "hurt" : "idle", t: this.t,
      flip: b.vx >= 0 ? 1 : -1, shadow: false, blink: birdBlink(this.t, 1),
    });
    ctx.restore();
    // rim + specular
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.strokeStyle = alpha("#FFFFFF", 0.8);
    ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.85;
    ellipse(ctx, -r * 0.34, -r * 0.4, r * 0.26, r * 0.16, -0.7, "#FFFFFF");
    ctx.restore();
    ctx.restore();
  }

  /* ----------------------------------------------------------------- HUD */

  drawHud(ctx, view) {
    const pad = 24;
    const top = view.y + pad;
    text(ctx, "✕", view.x + pad + 14, top + 18, { size: 30, color: "#FFFFFF" });

    // The word being spelled, with collected letters filled in.
    const word = this.board.word;
    const n = word.length;
    const cell = Math.min(64, (view.w - pad * 2 - 40) / n);
    const startX = view.x + view.w / 2 - (n * cell) / 2;
    const y = (this.origin?.y ?? view.y + 210) - cell - 46;
    text(ctx, "SPELL THE WORD", view.x + view.w / 2, y - 30, { size: 16, color: C.sun.base });
    for (let i = 0; i < n; i++) {
      const got = i < this.nextLetter;
      const x = startX + i * cell;
      fillRound(ctx, x + 3, y + 5, cell - 6, cell - 6, 10, got ? C.grass.dark : "#0D1518");
      fillRound(ctx, x + 3, y, cell - 6, cell - 6, 10, got ? C.grass.base : "#1B2930");
      if (got) text(ctx, word[i], x + cell / 2, y + cell / 2 - 3, { size: cell * 0.52, color: "#FFFFFF" });
      else text(ctx, "_", x + cell / 2, y + cell / 2 + 4, { size: cell * 0.4, color: "#3A4C55" });
    }

    // falls
    const belowY = (this.origin?.y ?? 0) + (this.boardSize?.h ?? 0) + 52;
    text(ctx, `${this.board.name}`, view.x + view.w / 2, belowY,
      { size: 20, color: alpha("#FFFFFF", 0.75) });
    if (!this.usingGyro) {
      text(ctx, this.tilt.source === "keys" ? "Arrow keys to steer" : "Drag the screen to steer",
        view.x + view.w / 2, belowY + 34, { size: 16, color: alpha("#FFFFFF", 0.5) });
    } else {
      text(ctx, "Tilt your phone to roll", view.x + view.w / 2, belowY + 34,
        { size: 16, color: alpha("#FFFFFF", 0.5) });
    }
    if (this.falls) {
      text(ctx, `Falls: ${this.falls}`, view.x + view.w - pad, belowY,
        { size: 16, color: alpha(C.cherry.light, 0.8), align: "right" });
    }
  }

  drawIntro(ctx, view) {
    const k = clamp(this.stateT * 2, 0, 1);
    const out = clamp((this.stateT - 2.5) * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.72;
    ctx.fillStyle = "#070E11";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = 1 - out;
    const cy = view.y + view.h * 0.44;
    text(ctx, `MAZE ${this.levelIndex + 1}`, view.x + view.w / 2, cy - 80, { size: 18, color: C.sun.base });
    text(ctx, this.board.name, view.x + view.w / 2, cy - 26, { size: 48 * easeOutBack(k), color: "#FFFFFF" });
    text(ctx, this.board.teaches, view.x + view.w / 2, cy + 30, { size: 22, color: alpha("#FFFFFF", 0.8) });
    text(ctx, "tap to start", view.x + view.w / 2, cy + 110,
      { size: 18, color: alpha("#FFFFFF", 0.4 + Math.sin(this.t * 4) * 0.2) });
    ctx.restore();
  }

  drawWon(ctx, view) {
    const k = clamp(this.stateT * 1.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.82 * k;
    ctx.fillStyle = "#070E11";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = k;
    const cy = view.y + view.h * 0.4;
    text(ctx, "SOLVED!", view.x + view.w / 2, cy, { size: 52 * easeOutBack(k), color: C.sun.base });
    text(ctx, this.board.word.toUpperCase(), view.x + view.w / 2, cy + 64, { size: 36, color: "#FFFFFF" });
    text(ctx, this.falls ? `${this.falls} fall${this.falls > 1 ? "s" : ""}` : "No falls — perfect!",
      view.x + view.w / 2, cy + 112, { size: 22, color: alpha("#FFFFFF", 0.8) });
    text(ctx, "tap to continue", view.x + view.w / 2, cy + 176, { size: 18, color: alpha("#FFFFFF", 0.5) });
    ctx.restore();
  }
}
