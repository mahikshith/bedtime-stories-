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
import { THEMES, drawBackdrop, drawPlatform, drawHazard, drawProp, waterBody, Weather } from "../../art/environment.js";
import { drawBird, birdBlink, BIRDS } from "../../art/bird.js";
import { C, TOKENS, PAIRS, alpha, mix } from "../../core/palette.js";
import { roundRect, fillRound, circle, text, outlinedText, star as starShape } from "../../core/draw.js";
import { VoiceInput, matchWord } from "../../core/voice.js";
import { sfx, speak, stopSpeaking, startMusic, stopMusic, speakerIdle, duckMic, speechWorking } from "../../core/audio.js";
import { speech, haptics } from "../../core/native.js";
import { wordsForLevel, stretched } from "../../core/words.js";
import { save, starsFromAccuracy } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { flightSquash } from "../../core/juice.js";

const GAME_ID = "say-jump";

/** A level names the band it was paced for; used when the player has none. */
const def_band = (lvl) => lvl.band ?? "mid";

/** Charge -> jump arc. Tuned against the authored gap widths. */
// Apex is capped at four tiles. A higher arc looks impressive but pushes the
// landing platform out of frame on a portrait screen, so the player loses
// sight of where they are going at exactly the wrong moment.
const JUMP = { minApex: 120, maxApex: 260, minDist: 150, maxDist: 560 };

/** Lives per level. See the note where it is spent. */
const MAX_HEARTS = 3;

const apexFor = (c) => lerp(JUMP.minApex, JUMP.maxApex, c);
const distFor = (c) => lerp(JUMP.minDist, JUMP.maxDist, c);

/** Inverse: the charge needed to travel `d` forward. */
const chargeForDist = (d) => clamp((d - JUMP.minDist) / (JUMP.maxDist - JUMP.minDist), 0, 1);

/** Inverse: the charge needed to rise `h`, with clearance to land on top. */
const chargeForRise = (h) =>
  clamp((h + 46 - JUMP.minApex) / (JUMP.maxApex - JUMP.minApex), 0, 1);

export class SayJumpScene {
  constructor({ levelIndex = 0, band = "mid", cast = "pip", onExit, onComplete }) {
    this.levelIndex = levelIndex;
    this.band = band;  // may be overridden by the level's own band in load()
    this.birdId = cast in BIRDS ? cast : "chick";
    this.onExit = onExit;
    this.onComplete = onComplete;

    this.state = "intro";       // intro|walk|prompt|charge|air|hurt|done
    this.t = 0;
    this.speakT = 0;        // glow on the pronunciation button
    this.sayButton = null;  // hit box, recorded when the card is drawn

    /**
     * Whether a real speech recogniser is driving the game.
     *
     * When it is, saying the RIGHT WORD is what makes the bird jump, which is
     * the point of the game. Without one the loudness meter takes over and
     * any loud noise counts — playable, but it is not the same game, so the
     * screen says which one you are in rather than leaving it a mystery.
     */
    this.listening = false;
    this.heardWrong = null;
    this.wrongT = 0;
    this.listenStart = 0;
    /**
     * Bumped whenever a listen is superseded — the word changed, or HEAR IT
     * was pressed. A listen whose generation is stale is discarded instead of
     * being scored, so abandoning one never costs the child a miss.
     */
    this._listenGen = 0;

    /**
     * How far the "say it" meter has filled while the recogniser listens.
     *
     * This exists because handing the microphone to a native recogniser takes
     * it away from the loudness meter: on Android the two cannot share it, so
     * `voice.speaking` never went true, `currentCharge()` returned zero, and
     * the bar on the left stopped moving and the landing arc stopped being
     * drawn. Worse, the jump was launched from a recomputed constant, so every
     * jump went exactly the same distance no matter what the child did.
     *
     * So while the recogniser has the microphone, LENGTH is the input. The
     * meter fills as the child keeps saying the word, the arc grows with it,
     * and the value the meter is showing at the moment the word is recognised
     * is the value the jump uses — what you see is what you get.
     */
    this.listenCharge = 0;
    this.misses = 0;        // consecutive failed attempts on this word

    /**
     * Seconds of invincibility left from a power star.
     *
     * A star does not make the child stronger, it makes the world stop
     * mattering for a moment — which at this age is the more exciting of the
     * two, and it is the only thing in the game that turns a hazard into a
     * joke instead of a threat.
     */
    this.shield = 0;
    /** Seconds of BIG left from a grow star. */
    this.grow = 0;
    this.stateT = 0;

    this.fx = new Fx();
    /**
     * Three hearts, not five.
     *
     * Asked for across every game: "they only have two to three hearts and
     * if they are exhausted, the game will end". Five was enough to fall in
     * the water on nearly every gap and still finish, which makes the water
     * scenery. Three makes the third mistake matter without making the first
     * one fatal — and a correct word is now guaranteed to clear the gap it
     * faces, so the hearts are spent on hazards and hesitation rather than on
     * saying a word quietly.
     */
    this.hearts = MAX_HEARTS;
    this.starsGot = 0;
    this.wordsRight = 0;
    this.wordsAsked = 0;

    this.voice = new VoiceInput({ sensitivity: save.state.settings.voiceSensitivity });
    this.voiceReady = false;
    this.controlMode = ["voice", "touch", "both"].includes(save.state.settings.jumpControl)
      ? save.state.settings.jumpControl : "both";
    this._voiceGeneration = 0;
    this._voiceStarting = false;
    this._voicePendingRefresh = false;
    this._destroyed = false;
    this.steer = 0;
    this.steerPointer = null;
    this.jumpPointer = null;
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
    // The waterline: the top of the shallowest water tile in the level. Read
    // from the level rather than hardcoded, because it is the composer's
    // WATER_ROW and this should not have to know that number.
    const wet = lvl.hazards.filter((h) => h.type === "water");
    this.waterY = wet.length ? Math.min(...wet.map((h) => h.y)) : null;

    this.world = new World({
      platforms: lvl.platforms,
      hazards: lvl.hazards,
      width: lvl.width,
      height: lvl.height,
    });
    this.world.onHazard = (h) => {
      // A fire that is out, and a cannon with nothing in the air, are
      // scenery. Without this a child would be burned by a cold jet.
      if (h.type === HAZARD.FIRE && !h.lit) return;
      if (h.type === HAZARD.BULLET && !h.flying) return;
      if (this.shield > 0) { this.shrugOff(h); return; }
      this.hit(h);
    };
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
    this.juice = engine.juice;
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    startMusic();

    // Touch mode is a real first-class controller: a phone with no working
    // mic must not ask for permission merely to make a visible toggle work.
    if (this.controlMode !== "touch") this.activateVoice();

    // Pointer input is routed by the engine; space bar mirrors it, because a
    // laptop with no touchscreen still has to be able to play.
    this._kd = (e) => { if (e.code === "Space" && !e.repeat) this.down(); };
    this._ku = (e) => { if (e.code === "Space") this.up(); };
    window.addEventListener("keydown", this._kd);
    window.addEventListener("keyup", this._ku);
  }

  async activateVoice() {
    // A permission prompt may outlive a mode switch. Serialising startup
    // prevents two getUserMedia calls from racing to own the same mic.
    if (this._voiceStarting) { this._voicePendingRefresh = true; return; }
    this._voiceStarting = true;
    const gen = ++this._voiceGeneration;
    try {
      this.voiceReady = await this.voice.start();
      if (gen !== this._voiceGeneration || this.controlMode === "touch" || this._destroyed) {
        if (this.controlMode === "touch" || this._destroyed) {
          this.voice.stop(); this.voiceReady = false;
        }
        return;
      }
      if (this.voiceReady) {
        this.voice.onUtterance = (u) => this.onUtterance(u);
        this.voice.onStart = () => {
          if (this.controlMode !== "touch" && this.state === "prompt") this.setStateQuiet("charge");
        };
        if (save.state.settings.speechCheck) this.voice.startRecognition();
      }

      // Android's recogniser owns the mic exclusively. Only request it for
      // a mode that can use speech, and discard superseded permission replies.
      const available = await speech.available();
      if (gen !== this._voiceGeneration || this.controlMode === "touch" || this._destroyed) return;
      const granted = available && await speech.request();
      if (gen !== this._voiceGeneration || this.controlMode === "touch" || this._destroyed) return;
      this.speechOn = granted;
      if (granted) {
        this.voice.stopRecognition?.();
        if (this.state === "prompt") this.beginListening();
      }
    } catch {
      this.voiceReady = false;
    } finally {
      this._voiceStarting = false;
      if (this._voicePendingRefresh && this.controlMode !== "touch" && !this._destroyed) {
        this._voicePendingRefresh = false;
        this.activateVoice();
      }
    }
  }

  setControlMode(mode) {
    if (!["voice", "touch", "both"].includes(mode) || mode === this.controlMode) return;
    this.controlMode = mode;
    save.setSetting("jumpControl", mode);
    this.holding = false;
    this.jumpPointer = this.steerPointer = null;
    this.steer = 0;
    this._listenGen++;
    clearTimeout(this._retryTimer);
    speech.stop();
    this.listening = false;
    this.listenCharge = 0;
    if (this.state === "charge") this.setStateQuiet("prompt");
    if (mode === "touch") {
      this._voiceGeneration++;
      this._voicePendingRefresh = false;
      this.voice.stop();
      this.voiceReady = this.speechOn = false;
    } else if (!this.voiceReady && !this.speechOn) {
      this.activateVoice();
    } else if (this.state === "prompt") {
      this.beginListening();
    }
    haptics.tap();
  }

  destroy() {
    this._destroyed = true;
    this._voiceGeneration++;
    this._listenGen++;
    this.voice.stop();
    speech.stop();
    clearTimeout(this._sylTimer);
    clearTimeout(this._retryTimer);
    stopSpeaking();
    stopMusic();
    window.removeEventListener("keydown", this._kd);
    window.removeEventListener("keyup", this._ku);
  }

  /** Change state without the side effects `setState` carries. */
  setStateQuiet(s) {
    this.state = s;
    this.stateT = 0;
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    if (s === "prompt") {
      this.askWord();
      this.heardWrong = null;
      this.misses = 0;       // a new word deserves a fresh set of tries
      this.beginListening();
    }
    if (s === "air" || s === "done") {
      this._listenGen++;
      this.listening = false;
      speech.stop();
    }
  }

  /* -------------------------------------------------------------- words */

  askWord() {
    const stop = this.stops[this.stopIndex];
    if (!stop) return;
    this.word = this.words[this.stopIndex % this.words.length];
    this.heard = "";
    this.voice.clearTranscript();
    // Drop anything still listening for the PREVIOUS word. Leaving it running
    // would both hold the re-entrancy guard shut — so the new word is never
    // listened for — and let a late answer to the old word score the new one.
    this._listenGen++;
    if (this.listening) { this.listening = false; speech.stop(); }
    clearTimeout(this._retryTimer);
    this.wordsAsked++;
    // Read it aloud — the child has to hear the target to produce it.
    speak(this.word.word);
    // How far this specific jump needs to go, so the meter can show a target.
    this.needCharge = this.chargeNeeded();
  }

  /** The nearest landable surface in front of the bird, mover or not. */
  nextSurface() {
    const fromX = this.body.x + this.body.w;
    let best = null, bestD = Infinity;
    for (const p of this.world.platforms) {
      if (p.gone || p === this.body.ground) continue;
      if (p.x + p.w < fromX) continue;
      if (p.y < this.body.bottom - TILE * 4) continue;
      const d = p.x - fromX;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /**
   * True while the only way on is a mover that has not come back yet.
   *
   * The bird waits at the lip instead, which is what a person does at a bus
   * stop and reads as patience rather than as the game being stuck.
   */
  waitingForRide() {
    const next = this.nextSurface();
    return next?.kind === KIND.MOVING && this.gapAhead() > TILE * 2.2;
  }

  /**
   * Is something lit, flying or otherwise dangerous immediately in front?
   *
   * Deliberately generous about the distance — a tile and a half — because
   * stopping ON the edge of a flame is not stopping, and a child watching the
   * bird halt a body-length short of a jet reads it as caution rather than as
   * the game freezing.
   */
  hazardAhead() {
    const fromX = this.body.x + this.body.w;
    const reach = TILE * 1.5;
    for (const h of this.world.hazards) {
      if (h.type === HAZARD.FIRE) { if (!h.lit && !h.warn) continue; }
      else if (h.type === HAZARD.BULLET) { if (!h.flying) continue; }
      else continue;                                   // spikes and water never stop the walk
      const hx = h.type === HAZARD.BULLET ? h.bx : h.x;
      const hw = h.type === HAZARD.BULLET ? TILE * 0.7 : h.w;
      if (hx + hw < fromX || hx > fromX + reach) continue;
      if (h.y > this.body.bottom + TILE || h.y + h.h < this.body.y - TILE) continue;
      return true;
    }
    return false;
  }

  /** The nearest surface ahead that does not move. */
  nextSolid() {
    const fromX = this.body.x + this.body.w;
    let best = null, bestD = Infinity;
    for (const p of this.world.platforms) {
      if (p.gone || p.kind === KIND.MOVING || p === this.body.ground) continue;
      if (p.x + p.w < fromX) continue;
      if (p.y < this.body.bottom - TILE * 4) continue;   // ignore high ledges
      const d = p.x - fromX;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /**
   * Has the platform being ridden reached the far side?
   *
   * Measured between the MOVER'S far edge and the lip it delivers to, not
   * from the bird. Measuring from the bird meant a bird standing in the
   * middle of a three-tile platform read as "still a tile short" at the exact
   * moment the platform was flush against the ledge — so it rode back and
   * forth for ever, correctly, and never got off.
   */
  rideArrived() {
    const m = this.body.ground;
    const land = this.nextSolid();
    if (!m || !land) return true;         // nothing to wait for
    // A VERTICAL lift is a step, not transport: it carries you up, never
    // along, so waiting for it to arrive somewhere waits for ever. The Long
    // Drop's lift travels one tile down and the bird rode it at full health
    // for the entire level, patiently, because the far ledge was never going
    // to get closer.
    if (!m.tx) return true;
    return land.x - (m.x + m.w) <= 8;
  }

  /**
   * The BAND of charges whose arc actually reaches solid ground — simulated.
   *
   * Both ends matter and they are the same question, so they come from one
   * scan. The low end is what the meter's red line asks for and what a
   * correct word is floored to; the high end is what it is capped at, so a
   * child who shouts cannot sail over the perch that was supposed to catch
   * them.
   *
   * Everything closed-form here was wrong, in three escalating ways:
   *
   *   `chargeForDist` answers "how far before coming back down to the height
   *   it left from", which is the wrong question wherever the next surface is
   *   higher — a crumbling ledge one row up, a lift three rows up. In The
   *   Long Drop it asked for 0.14, buying 145px of apex against 192px of
   *   rise, and the bird fell short three hearts in a row.
   *
   *   Adding a separate rise term and taking the larger is still wrong: the
   *   two constraints are not independent. You need the charge that satisfies
   *   both at once, which is a question about a trajectory, not a sum.
   *
   *   And a cap derived from the target's width ignores its height entirely,
   *   so an under-powered jump was "capped" to pass clean underneath a cloud
   *   ledge it was aimed at.
   *
   * So it asks the physics. `predictArc` simulates the real arc against the
   * real platforms — it is what draws the landing preview — and the band of
   * charges whose arcs report a landing IS the answer, for moving platforms,
   * one-way ledges and everything else a formula could not see.
   *
   * Scanned rather than bisected, and stopped at the first gap, because
   * "lands on something" is not monotonic: a bigger jump can sail over the
   * perch into the water beyond it, and the band we want is the contiguous
   * one starting at the first success.
   */
  landingBand() {
    const now = this.t;
    if (this._bandAt != null && now - this._bandAt < 0.08 && this._band) return this._band;
    this._bandAt = now;

    /**
     * The perch under the bird's feet, found by POSITION rather than by
     * `body.ground`.
     *
     * `ground` is null for the odd frame — the moment gravity has pulled the
     * feet a pixel clear before the next collision pass puts them back — and
     * on those frames "landing somewhere that is not the ground" was true of
     * the perch the bird was standing on. The scan then reported that a 0.06
     * charge lands safely, the meter asked for almost nothing, and the bird
     * hopped off the lip into open water. Position does not flicker.
     */
    const here = this.world.platforms.find((p) =>
      !p.gone && this.body.right > p.x + 2 && this.body.x < p.x + p.w - 2 &&
      Math.abs(this.body.bottom - p.y) < 8);
    const ground = this.body.ground;
    let lo = null, hi = null;
    for (let c = 0.06; c <= 1.0001; c += 0.07) {
      const { landing } = this.world.predictArc(
        // Long enough to follow a bounce through to wherever it ends.
        this.body, apexFor(c), distFor(c), 1, { steps: 130 });
      // Coming straight back down onto the perch you left is not a landing.
      const ok = landing && landing !== ground && landing !== here;
      if (ok) { if (lo == null) lo = c; hi = c; }
      else if (lo != null) break;          // the band has ended
    }
    // Nothing reaches: ask for everything and cap at nothing, which leaves
    // the jump entirely in the child's hands rather than aiming it at a hole.
    this._band = { lo: lo ?? 1, hi: hi ?? 1 };
    return this._band;
  }

  /** The charge the meter asks for: the low end of the band. */
  chargeNeeded() { return this.landingBand().lo; }

  /** Distance from the character to the far side of the gap in front. */
  gapAhead() {
    const fromX = this.body.x + this.body.w;
    let best = Infinity;
    for (const p of this.world.platforms) {
      if (p.gone) continue;
      // A mover's CURRENT position, not the leftmost point of its travel.
      //
      // Being conservative was right when a mover was a bonus perch beside a
      // gap you could already jump. Now a mover IS the route across a gap
      // wider than any jump, and answering "how far is the next surface" with
      // where that surface will be at the far end of its travel told the
      // meter to ask for almost no power at all — so the bird hopped off the
      // lip into open water while the platform was still coming.
      const px = p.x;
      if (px + 4 < fromX) continue;
      if (p.y < this.body.bottom - TILE * 4) continue; // ignore high ledges
      best = Math.min(best, px - fromX);
    }
    return Number.isFinite(best) ? Math.max(60, best) : 260;
  }

  onUtterance(u) {
    if (this.controlMode === "touch" || this.holding) return;
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

  /**
   * The reach a jump actually gets.
   *
   * Saying the word right is the whole skill this game teaches, so it is also
   * the thing that guarantees the landing: a child who pronounces "castle"
   * clearly does not drown for having said it quietly. Before this, a short
   * or soft "castle" charged to 0.34 against a gap that needed 0.46, so doing
   * the hard part correctly still ended in the water — which taught exactly
   * the wrong lesson.
   *
   * Charge is not thereby pointless: it buys distance BEYOND the gap, which
   * is what carries the bird onto the high ledges and the stars. Speaking up
   * still earns something, it just no longer decides whether you survive.
   */
  effectiveCharge(charge, correct) {
    if (charge <= 0) return 0;   // silence is silence; the meter must read empty
    // A big bird is a STRONG bird. The size is what a child notices, but the
    // reach is what makes the powerup worth crossing the level for, and both
    // have to be the same fact or the reward is decoration.
    const big = this.grow > 0 ? 1.22 : 1;
    const c = clamp(charge * big, 0.06, 1);
    if (!correct) return c;
    const floor = clamp((this.needCharge ?? 0.4) + 0.06, 0, 1);
    let eff = Math.max(c * 1.12, floor);

    /**
     * A correct word is CAPPED as well as floored: it lands you ON something.
     *
     * The floor alone made a quiet child safe and left an enthusiastic one
     * drowning — a full shout carries nine tiles and a perch is three, so
     * saying the word beautifully and loudly sailed clean over the thing that
     * was supposed to catch you. "Even if they say the word, we are killing
     * the bird" was exactly this, and a game that punishes enthusiasm for a
     * word it just asked a five-year-old to shout has its incentives
     * backwards.
     *
     * Inside the band every charge lands somewhere, so volume still decides
     * WHERE — a loud word lands further along than a quiet one and can still
     * reach the stars at the far end of a perch — it just cannot land in the
     * water.
     */
    const band = this.landingBand();
    eff = Math.min(eff, band.hi);
    eff = Math.max(eff, Math.min(band.lo, floor));
    return clamp(eff, 0, 1);
  }

  launch(charge, correct, { touch = false } = {}) {
    const eff = this.effectiveCharge(charge, correct);
    this.world.jump(this.body, apexFor(eff), distFor(eff), 1);
    this.body.speedMul = 1.6;
    sfx.jump(eff);
    this.fx.dust(this.body.cx, this.body.bottom, 0.8, alpha(this.theme.cap.light, 0.9));
    if (correct) {
      this.wordsRight++;
      this.juice?.hit("light", { freeze: false, punch: 0.4 });
      this.fx.say(this.body.cx, this.body.y - 30, touch ? "GREAT JUMP!" : "PERFECT!", TOKENS.bee, 20);
      this.fx.burst(this.body.cx, this.body.cy, [TOKENS.bee, TOKENS.snow, this.theme.accent], 16);
      sfx.correct();
      save.addXp(5);
    }
    if (this.stops[this.stopIndex]) this.stops[this.stopIndex].done = true;
    this.stopIndex++;
    this.setState("air");
  }

  controlRects(view = this.engine?.view ?? { x: 0, y: 0, w: 720, h: 1280 }) {
    const width = Math.min(520, view.w - 180);
    const modeY = view.y + 90;
    return {
      modes: ["voice", "touch", "both"].map((mode, i) => ({
        mode, x: view.x + (view.w - width) / 2 + i * width / 3,
        y: modeY, w: width / 3, h: 76,
      })),
      pad: { cx: view.x + 116, cy: view.y + view.h - 118, r: 90 },
      jump: { cx: view.x + view.w - 118, cy: view.y + view.h - 118, r: 92 },
    };
  }

  down(pt, event) {
    const id = event?.pointerId ?? "keyboard";
    // Space remains a complete fallback on laptops regardless of the last
    // phone setting; otherwise a saved Touch mode made a keyboard inert.
    if (!pt && (this.state === "prompt" || this.state === "charge")) {
      this.jumpPointer = id;
      this.holding = true;
      this.holdCharge = 0.12;
      this.setStateQuiet("charge");
      return;
    }
    if (pt) {
      const controls = this.controlRects();
      const selected = controls.modes.find((b) =>
        pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h);
      if (selected) { this.setControlMode(selected.mode); return; }
      if (this.controlMode !== "voice") {
        if (Math.hypot(pt.x - controls.pad.cx, pt.y - controls.pad.cy) <= controls.pad.r + 12) {
          this.steerPointer = id;
          this.move(pt, event);
          return;
        }
        if (Math.hypot(pt.x - controls.jump.cx, pt.y - controls.jump.cy) <= controls.jump.r + 12) {
          if (this.state === "intro") this.setState("walk");
          if (this.state === "prompt" || this.state === "charge") {
            this.jumpPointer = id;
            // The finger now owns this attempt. A native result from the
            // preceding listen must not launch a second jump after release.
            this._listenGen++;
            this.listening = false;
            speech.stop();
            this.holding = true;
            this.holdCharge = 0.12;
            this.setStateQuiet("charge");
            haptics.tap();
          }
          return;
        }
      }
    }
    if (this.state === "intro") { this.setState("walk"); return; }
    if (this.state === "done") { this.finish(); return; }
    // The pronunciation button comes first: a child pressing it wants to hear
    // the word, not to start a jump with it.
    if (this.sayButton && (this.state === "prompt" || this.state === "charge")) {
      const b = this.sayButton;
      // A generous radius — this is aimed at a three-year-old's finger.
      if (pt && Math.hypot(pt.x - b.cx, pt.y - b.cy) < b.r + 18) {
        this.sayWordAloud();
        return;
      }
    }

    // Touch ALWAYS works, even when the microphone is listening.
    //
    // It used to be switched off the moment the mic initialised, on the theory
    // that a working mic makes the button redundant. It does not: a quiet
    // child, a noisy room, a broken mic or — as happened — an audio graph that
    // silently never started all leave the child holding a game that ignores
    // them completely, with nothing on screen explaining why. Having both is
    // never worse, and the child gets to choose.
    if (this.controlMode === "voice" && (this.state === "prompt" || this.state === "charge")) {
      this.holding = true;
      this.jumpPointer = id;
      this.holdCharge = 0;
      this.setStateQuiet("charge");
    }
  }

  move(pt, event) {
    if (this.steerPointer == null || (event?.pointerId ?? "keyboard") !== this.steerPointer) return;
    const pad = this.controlRects().pad;
    const dx = clamp((pt.x - pad.cx) / (pad.r * 0.72), -1, 1);
    this.steer = Math.abs(dx) < 0.2 ? 0 : dx;
  }

  up(_pt, event) {
    const id = event?.pointerId ?? "keyboard";
    if (id === this.steerPointer) { this.steerPointer = null; this.steer = 0; }
    if (id !== this.jumpPointer) return;
    this.jumpPointer = null;
    if (!this.holding) return;
    this.holding = false;
    // A cancelled Android gesture is not a deliberate jump. The previous
    // shared pointer route treated pointercancel as a normal finger release.
    if (event?.type === "pointercancel") {
      if (this.state === "charge") {
        this.setStateQuiet("prompt");
        this.beginListening();
      }
      return;
    }
    if (this.state === "charge") this.launch(this.holdCharge,
      this.controlMode !== "voice" || this.holdCharge > 0.3,
      { touch: this.controlMode !== "voice" });
  }

  /**
   * Listen for the word, and jump only if it is the word.
   *
   * The native recogniser wants the microphone to itself on Android, so this
   * runs INSTEAD of the loudness meter rather than alongside it, and reach
   * comes from how long the child spoke instead of how loud they were — which
   * keeps "saaaay it looong to go further" working without two things
   * fighting over one microphone.
   */
  async beginListening() {
    if (this.controlMode === "touch" || !this.speechOn || this.listening) return;
    if (this.state !== "prompt" && this.state !== "charge") return;

    // WAIT FOR THE PHONE TO STOP TALKING.
    //
    // `askWord` reads the target aloud and then calls this in the same breath.
    // Without the wait, the recogniser is opened while "cat" is still coming
    // out of the speaker two inches away, hears it, and reports a match — so
    // the game answered its own question and the bird jumped before the child
    // had opened their mouth. That is the "it is recognizing noises from the
    // speaker" reported from the device.
    //
    // The generation counter is the only guard over the wait, deliberately.
    // Two callers may both be parked here and the newest should always win,
    // which a boolean cannot express: whichever one woke first would clear
    // the flag and leave the other parked behind an already-open gate — and
    // that is how "the recogniser simply never opens again" happens.
    const gen = ++this._listenGen;
    await speakerIdle();
    if (gen !== this._listenGen) return;                    // superseded
    // Everything checked before the await has to be checked again after it.
    // A second is a long time in this game: the child can have given up and
    // tapped instead, the three misses can have used themselves up, or the
    // level can have moved on entirely.
    if (this.controlMode === "touch" || !this.speechOn || this.listening) return;
    if (this.state !== "prompt" && this.state !== "charge") return;

    // Only now does the clock start: `listenCharge` is how long the CHILD
    // spoke for, and it must not include the time the app spent speaking.
    this.listening = true;
    this.listenStart = performance.now();
    const want = this.word?.word;

    const heard = await speech.listenOnce();
    this.listening = false;
    if (gen !== this._listenGen || this.controlMode === "touch") return; // abandoned
    if (!want || this.word?.word !== want) return;          // moved on since
    if (this.state !== "prompt" && this.state !== "charge") return;

    const best = heard.map((h) => matchWord(h, want)).sort((a, b) => b.score - a.score)[0];
    // Whatever the meter was showing is what the jump gets. No floor here —
    // `launch` guarantees the gap for a correct word, so a floor added on top
    // would only make every jump overshoot by the same amount.
    const power = clamp(this.listenCharge, 0, 1);

    if (best?.match) {
      this.heardWrong = null;
      this.heard = best.heard;
      save.learnWord(want);
      this.launch(power, true);
      return;
    }

    // Wrong word, or nothing heard. Nothing bad happens: no heart, no fall,
    // no restart. The bird waits, the card says what it thought it heard, and
    // the HEAR IT button pulses to offer another listen. Punishing a small
    // child for mispronouncing a word in a game that exists to teach them
    // that word would be exactly backwards.
    this.heardWrong = heard[0] ?? "";
    this.wrongT = 2.2;
    this.speakT = Math.max(this.speakT, 0.9);
    sfx.tick?.();

    // Bounded, and not a tight loop. A recogniser that fails instantly —
    // no microphone, an unsupported device, a browser that exposes the API
    // and then refuses — would otherwise be retried for ever, and the child
    // would watch a bird that never moves while the phone got warm.
    //
    // After three misses the game stops insisting: the touch path takes over
    // so the level is always finishable, and the prompt says so.
    this.misses++;
    if (this.misses >= 3) {
      this.speechOn = false;
      this.wrongT = 0;
      return;
    }
    clearTimeout(this._retryTimer);
    this._retryTimer = setTimeout(() => this.beginListening(), 700);
  }

  /**
   * Say the word out loud so the child can copy it.
   *
   * Slower and a little lower than the app's usual voice: this is a model to
   * imitate, not a line of dialogue. The syllables follow after a beat,
   * because "cas · tle" is the part a child who is stuck actually needs.
   */
  sayWordAloud() {
    if (!this.word) return;

    // Abandon any listen in flight. The recogniser is about to be handed the
    // app's own pronunciation, and scoring that as the child's attempt would
    // either hand them a free jump or — worse — spend one of their three
    // tries on a word they never said.
    this._listenGen++;
    if (this.listening) { this.listening = false; speech.stop(); }
    clearTimeout(this._retryTimer);

    stopSpeaking();
    this.speakT = 1.1;
    sfx.pop();
    // Always acknowledge the press in the hand, not only in the ear: on a
    // phone with no speech engine this and the button's own beat are the
    // only confirmation the child gets that they hit it.
    haptics.tap();
    speak(this.word.word, { rate: 0.62, pitch: 1.05 });
    if (this.word.syl?.length > 1) {
      clearTimeout(this._sylTimer);
      // Hold the gate across the pause between the word and its syllables.
      // Without this the gap reads as "speaker idle", the microphone opens,
      // and it is promptly fed "cas, tle".
      duckMic(900);
      this._sylTimer = setTimeout(() => {
        speak(this.word.syl.join(", "), { rate: 0.5, pitch: 1.1 });
      }, 900);
    }
    // Re-arm once the phone is quiet: `beginListening` does the waiting.
    this.beginListening();
  }

  /** A hazard bounced off the star's shield: noise and sparkle, no damage. */
  shrugOff(h) {
    this.juice?.hit("light", { freeze: false });
    this.fx.burst(this.body.cx, this.body.cy, [TOKENS.bee, C.flame.light, TOKENS.snow], 14);
    sfx.coin();
  }

  hit(h) {
    if (this.state === "hurt" || this.state === "done") return;
    this.hearts--;
    // The biggest impact in the game gets the longest freeze: losing a heart
    // is the moment that most needs to land, and three frames of stopped time
    // say "that mattered" more loudly than any amount of shake.
    this.juice?.hit("heavy", { punch: 0.6 });
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
    this.speakT = Math.max(0, this.speakT - dt);
    this.wrongT = Math.max(0, this.wrongT - dt);

    // The meter fills while the recogniser is listening. Roughly 1.7s to the
    // top, which is about as long as a five-year-old will hold a word.
    if (this.listening && this.controlMode !== "touch") {
      this.listenCharge = clamp(this.listenCharge + dt * 0.58, 0, 1);
      if (this.state === "prompt" && this.listenCharge > 0.04) this.setStateQuiet("charge");
    } else {
      this.listenCharge = 0;
    }
    if (this.grow > 0) {
      this.grow -= dt;
      if (this.grow <= 0) { this.grow = 0; speak("back to normal"); }
    }
    if (this.shield > 0) {
      this.shield -= dt;
      if (this.shield <= 0) { this.shield = 0; speak("all gone"); }
      else if (Math.random() < dt * 22) {
        this.fx.burst(this.body.cx, this.body.cy,
          [TOKENS.bee, C.candy.light, TOKENS.snow], 3);
      }
    }
    this.stateT += dt;
    this.fx.update(dt);
    this.weather.update(dt);
    this.world.stepPlatforms(dt);
    if (this.voiceReady && this.controlMode !== "touch") this.voice.update(dt);
    for (const p of this.world.platforms) if (p.squish) p.squish = Math.max(0, p.squish - dt * 3);
    for (const h of this.world.hazards) if (h.type === HAZARD.SAW) {
      h.spin = (h.spin ?? 0) + dt * 7;
      if (h.tx) h.x = h.ox + (Math.sin(this.t * h.speed) + 1) / 2 * h.tx;
    }

    // Fire and cannons run on their own clocks so a level reads as a rhythm
    // a child can learn rather than a field of things that hurt at random.
    const ms = this.t * 1000;
    for (const h of this.world.hazards) {
      if (h.type === HAZARD.FIRE) {
        const cycle = h.onMs + h.offMs;
        const at = (ms + h.phase) % cycle;
        h.lit = at < h.onMs;
        // The tell: it glows before it lights, so a jump can be planned.
        h.warn = !h.lit && at > cycle - h.warnMs;
        h.heat = h.lit
          ? Math.min(1, h.heat + dt * 6)
          : Math.max(0, h.heat - dt * 4);
      } else if (h.type === HAZARD.BULLET) {
        const at = (ms + h.phase) % h.everyMs;
        h.flash = Math.max(0, h.flash - dt);
        if (!h.flying && at < 60) { h.flying = true; h.bx = 0; h.flash = 0.22; sfx.pop(); }
        if (h.flying) {
          h.bx += dt * 470;
          if (h.bx > h.reach) h.flying = false;
          h.x = h.muzzleX + h.bx;
        }
      }
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

        /**
         * Standing on a mover means RIDING it, not walking off it.
         *
         * The bird walks itself to the next word gate between jumps, which is
         * right everywhere except on a moving platform: there, walking
         * forward is walking into the sea. A gap that needs a mover is wider
         * than any jump, so there is no recovering from it either.
         *
         * So it waits, and the mover does the work — which is also what makes
         * the platform feel like transport rather than scenery.
         */
        if (dx > 14 && this.body.ground?.kind === KIND.MOVING && !this.rideArrived()) {
          this.body.vx *= 0.7;
          this.markSafe();
          break;
        }

        /**
         * Wait for a flame to die down rather than walking into it.
         *
         * The bird walks itself between word gates, so a fire vent or a
         * cannon ball on that path is damage the player has no way to avoid —
         * they are not steering. Three hearts and two vents is a level that
         * cannot be finished, however well the child reads.
         *
         * Only things that CYCLE are waited for. Spikes never go out, and a
         * bird that waits for one waits for ever; those belong in gaps and are
         * cleared by jumping, which the child does control.
         */
        if (dx > 14 && this.hazardAhead()) {
          this.body.vx *= 0.7;
          this.markSafe();
          break;
        }

        if (dx > 14) move = this.steerPointer == null ? 1 : this.steer;
        else {
          this.body.vx *= 0.6;
          if (stop) {
            // Do not ask for the word until the jump it buys can be made.
            // Where a mover is the only route, prompting while it is at the
            // far end of its travel asks a five-year-old for a maximum shout
            // AND perfect timing, and then drowns them for getting one of the
            // two slightly wrong.
            if (this.body.onGround && !this.waitingForRide()) this.setState("prompt");
          } else if (!this.goalReached && Math.abs(dx) < 40 && this.body.onGround) {
            this.goalReached = true;
            this.setState("done");
            sfx.fanfare();
            this.juice?.hit("medium", { punch: 0.9 });
            this.fx.burst(this.body.cx, this.body.cy, [TOKENS.bee, TOKENS.snow, this.theme.accent], 26);
          }
        }
        if (this.body.onGround) this.markSafe();
        break;
      }

      case "prompt":
        this.body.vx *= 0.7;
        // Recomputed every frame, not once when the word was asked: the
        // target can be a platform that is still travelling, and a meter
        // whose red line was measured to where it USED to be is a lie in the
        // one place the child is reading for the truth.
        this.needCharge = this.chargeNeeded();
        if (this.body.onGround) this.markSafe();
        break;

      case "charge":
        this.body.vx *= 0.7;
        // Same reason as `prompt`: the arc and the guaranteed reach are both
        // measured against this, and the target may still be moving.
        this.needCharge = this.chargeNeeded();
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
          // Scaled by how hard the landing actually was, so a gentle hop onto
          // the next perch does not get the same kick as dropping three rows.
          // Squaring the trauma in Juice is what makes that affordable: the
          // small ones barely move the camera.
          this.juice?.hit(this.body.landImpact > 0.45 ? "medium" : "light", { freeze: false });
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
        if (p.kind === "power") {
          // Eight seconds is long enough to get somewhere with it and short
          // enough that losing it is a reason to look for the next one.
          this.shield = 8;
          this.fx.burst(p.x, p.y, [TOKENS.bee, C.flame.light, C.candy.light, TOKENS.snow], 30);
          this.fx.say(p.x, p.y - 22, "SUPER!", TOKENS.bee, 26);
          sfx.fanfare();
          haptics.win();
          this.juice?.hit("medium", { punch: 0.8 });
          speak("super star");
          continue;
        }
        if (p.kind === "grow") {
          // Being BIG is the one powerup a child can see working without
          // being told, which is why it is here: the bird is visibly twice
          // the bird, and it jumps further, so the reward and the effect are
          // the same fact. "There is no meaning for powerups" was the note
          // this answers.
          this.grow = 9;
          this.fx.burst(p.x, p.y, [C.grass.light, TOKENS.snow, C.jade.light], 30);
          this.fx.say(p.x, p.y - 22, "BIG BIRD!", C.grass.light, 26);
          sfx.fanfare();
          haptics.win();
          this.juice?.hit("medium", { punch: 0.8 });
          speak("big bird");
          continue;
        }
        if (p.kind === "heart") {
          // Refuses to overfill. A heart that vanishes into a full bar is a
          // reward a child watched not happen.
          const room = this.hearts < MAX_HEARTS;
          if (room) this.hearts++;
          this.fx.burst(p.x, p.y, [C.cherry.light, TOKENS.snow], 22);
          this.fx.say(p.x, p.y - 22, room ? "+1 LIFE!" : "ALL FULL!", C.cherry.light, 26);
          room ? sfx.correct() : sfx.coin();
          haptics.knock();
          if (room) speak("extra life");
          continue;
        }
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
  }

  /* ---------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    const vw = view.w / this.zoom, vh = view.h / this.zoom;

    drawBackdrop(ctx, view, this.cam, this.theme, this.t);

    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    const cull = { x: this.cam.x - 120, w: vw + 240 };
    const vis = (x, w = 0) => x + w > cull.x && x < cull.x + cull.w;

    for (const p of this.level.props) if (vis(p.x, 60)) drawProp(ctx, p, this.theme, this.t);
    // Spikes sit ON platforms, so they go behind them and read as attached.
    for (const h of this.world.hazards) {
      if (h.type !== "spike" || !vis(h.x, h.w)) continue;
      drawHazard(ctx, h, this.theme, this.t);
    }
    for (const p of this.world.platforms) {
      if (p.gone || !vis(p.x, p.w)) continue;
      drawPlatform(ctx, p, this.theme, this.t);
    }
    /**
     * The sea, as ONE body in front of everything, rather than a tile per gap.
     *
     * A ground pillar is drawn from its cap all the way down so it plunges
     * into the water rather than floating above it. The water was painted
     * first and only in the gaps — the cells a pillar occupies have no water
     * tile — so every pillar showed as brick to the bottom of the frame. Two
     * thirds of a portrait screen was wall, which came back from the device
     * as "the walls, they are too high".
     *
     * Painting one wide body over the lot puts the waterline where it belongs
     * and hides what is under it, which is what water does. The per-gap
     * hazards still drive the collision; this is only what you see.
     */
    if (this.waterY != null) {
      waterBody(ctx, cull.x, this.waterY, cull.w,
        this.level.height - this.waterY + 400, this.theme.water, this.t);
    }

    // Fire and cannons go IN FRONT of the water. They stand in the gaps,
    // which is exactly where the waterline is, so painting the sea over them
    // left a vent showing as a brown lump at the surface and a cannon as a
    // grey smudge — reported, fairly, as "there is no fire, there is no
    // bullets". A hazard the player cannot see is not a hazard, it is a trap.
    for (const h of this.world.hazards) {
      if (h.type === "water" || h.type === "spike" || !vis(h.x, h.w)) continue;
      drawHazard(ctx, h, this.theme, this.t);
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

  /**
   * A grow star and a spare heart: a fat upward arrow and a heart, each on
   * its own glowing disc so it reads as a pickup rather than as scenery.
   */
  drawPowerup(ctx, p, bob) {
    const heart = p.kind === "heart";
    const col = heart ? C.cherry.base : C.grass.base;
    const lit = heart ? C.cherry.light : C.grass.light;
    const pulse = 1 + Math.sin(this.t * 4 + p.bob) * 0.07;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.scale(pulse, pulse);

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
    glow.addColorStop(0, alpha(lit, 0.5));
    glow.addColorStop(1, alpha(lit, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(-46, -46, 92, 92);

    circle(ctx, 0, 3, 24, alpha("#0B1113", 0.35));
    circle(ctx, 0, 0, 24, col);
    circle(ctx, 0, -2, 20, lit);

    ctx.fillStyle = "#FFFFFF";
    if (heart) {
      this.drawHeartPath(ctx, 0, 1, 26);
    } else {
      // a chunky up-arrow: grow
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(12, 0);
      ctx.lineTo(5, 0);
      ctx.lineTo(5, 13);
      ctx.lineTo(-5, 13);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * What powerup is running, and how much of it is left.
   *
   * Without this, a powerup is eight seconds during which the game quietly
   * behaves differently and then quietly stops. A child needs to know it is
   * ON — that is most of the reward — and needs a moment's warning before it
   * goes, which is what the draining bar is for.
   */
  drawPowerBadge(ctx, view, top) {
    const on = this.shield > 0
      ? { label: "INVINCIBLE!", left: this.shield, full: 8, col: C.sun.base, lit: C.sun.light }
      : this.grow > 0
      ? { label: "BIG BIRD!", left: this.grow, full: 9, col: C.grass.base, lit: C.grass.light }
      : null;
    if (!on) return;

    const w = 244, h = 54;
    const x = view.x + view.w / 2 - w / 2, y = top + 4;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 12;
    fillRound(ctx, x, y + 4, w, h, 27, alpha("#0B1113", 0.85));
    ctx.restore();
    fillRound(ctx, x + 4, y + 8, w - 8, h - 8, 23, alpha(on.col, 0.28));

    outlinedText(ctx, on.label, x + w / 2, y + h / 2 + 4,
      { size: 26, color: "#FFFFFF", weight: 900, stroke: alpha("#000000", 0.55), strokeWidth: 5 });

    const bw = w - 28;
    const f = clamp(on.left / on.full, 0, 1);
    fillRound(ctx, x + 14, y + h - 4, bw, 6, 3, alpha("#000000", 0.5));
    ctx.save();
    if (on.left < 2) ctx.globalAlpha = 0.45 + Math.sin(this.t * 18) * 0.4;
    fillRound(ctx, x + 14, y + h - 4, bw * f, 6, 3, on.lit);
    ctx.restore();
  }

  /** The heart outline, shared by the pickup and the HUD. */
  drawHeartPath(ctx, cx, cy, s) {
    const r = s / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.72);
    ctx.bezierCurveTo(cx - r * 1.3, cy - r * 0.2, cx - r * 0.52, cy - r * 1.16, cx, cy - r * 0.4);
    ctx.bezierCurveTo(cx + r * 0.52, cy - r * 1.16, cx + r * 1.3, cy - r * 0.2, cx, cy + r * 0.72);
    ctx.closePath();
    ctx.fill();
  }

  drawPickups(ctx) {
    for (const p of this.pickups) {
      if (p.taken) continue;
      const bob = Math.sin(this.t * 3 + p.bob) * 7;

      // The two powerups that are not stars get their own shapes. A child
      // choosing between three rewards has to be able to tell which is which
      // from across the level, and three differently-coloured stars is not
      // telling them apart, it is asking them to remember a colour code.
      if (p.kind === "grow" || p.kind === "heart") {
        this.drawPowerup(ctx, p, bob);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.rotate(Math.sin(this.t * 2 + p.bob) * 0.2);
      // The power star is bigger, rainbow-cycling and haloed, because it has
      // to be obviously a different KIND of thing from the coins around it —
      // a child should want it before knowing what it does.
      const power = p.kind === "power";
      const hue = power ? (this.t * 120 + p.bob * 40) % 360 : 0;
      const core = power ? `hsl(${hue}, 95%, 62%)` : TOKENS.bee;
      const r = power ? 30 : 19;

      if (power) {
        ctx.rotate(this.t * 1.6);
        ctx.save();
        ctx.globalAlpha = 0.45 + Math.sin(this.t * 5) * 0.2;
        for (let i = 0; i < 8; i++) {
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = `hsl(${(hue + i * 24) % 360}, 95%, 66%)`;
          ctx.beginPath();
          ctx.moveTo(-5, -r - 6); ctx.lineTo(5, -r - 6); ctx.lineTo(0, -r - 24);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }

      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, power ? 52 : 34);
      glow.addColorStop(0, alpha(core, 0.55));
      glow.addColorStop(1, alpha(core, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(-52, -52, 104, 104);
      starShape(ctx, 0, 0, r, r * 0.47, 5, core);
      starShape(ctx, -3, -3, r * 0.47, r * 0.21, 5, mix(core, "#ffffff", 0.6));
      if (power) {
        // Two dots and a smile: the star is a character, not an item.
        ctx.fillStyle = "#3A2208";
        ctx.beginPath(); ctx.arc(-6, -2, 2.6, 0, 7); ctx.arc(6, -2, 2.6, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 2, 6, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.strokeStyle = "#3A2208"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.stroke();
      }
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
    // Preview the jump the child is ACTUALLY about to make, floor and all.
    // Showing a raw-charge arc that falls short of a jump the game then
    // guarantees would be a lie in the one place a child is looking for the
    // truth. While they are speaking we assume they will get the word right,
    // because that is what the arc is reassuring them about.
    const correct = this.holding
      ? this.controlMode !== "voice" || this.holdCharge > 0.3 : true;
    const c = this.effectiveCharge(this.currentCharge(), correct);
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
    // Loudness wins when the meter really has the microphone — it is the
    // better signal, and on desktop both can run at once.
    if (this.voiceReady && this.voice.live && this.voice.speaking) {
      return clamp(Math.max(this.voice.charge, this.voice.peak * 0.55), 0, 1);
    }
    if (this.listening) return this.listenCharge;
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

    // BIG. Eased in and out over half a second at each end, because a bird
    // that snaps to twice its size reads as a glitch rather than a reward.
    const g = clamp(Math.min(this.grow, 0.5) * 2, 0, 1) *
              clamp((9 - this.grow) * 2, 0, 1);
    const scale = 1 + g * 0.55;

    // Invincibility, made visible. It was only ever legible as hazards
    // failing to hurt — which a child experiences as the game being broken,
    // not as being protected.
    if (this.shield > 0) {
      const fade = this.shield < 2 ? 0.4 + Math.sin(this.t * 20) * 0.35 : 0.85;
      ctx.save();
      ctx.globalAlpha = fade;
      const r = this.charH * scale * 0.62;
      const hue = (this.t * 220) % 360;
      const ring = ctx.createRadialGradient(b.cx, b.cy, r * 0.5, b.cx, b.cy, r);
      ring.addColorStop(0, `hsla(${hue}, 95%, 70%, 0)`);
      ring.addColorStop(0.72, `hsla(${hue}, 95%, 72%, 0.5)`);
      ring.addColorStop(1, `hsla(${(hue + 60) % 360}, 95%, 65%, 0)`);
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /**
     * Squash and stretch, anchored at the feet.
     *
     * Anchoring matters: scaled about its centre the bird sinks into the
     * platform as it squashes and floats off it as it stretches. About the
     * feet, which is where it is actually touching the world, it reads as a
     * body absorbing a landing.
     *
     * The deformation conserves area — a bird squashed to 0.8 tall becomes
     * 1.25 wide — because that is what happens to a thing made of stuff, and
     * it is the difference between squash and simply resizing the sprite.
     */
    const sq = flightSquash(b.vy, b.landImpact);
    ctx.save();
    ctx.translate(b.cx, b.bottom);
    ctx.scale(sq.sx, sq.sy);
    ctx.translate(-b.cx, -b.bottom);

    drawBird(ctx, b.cx, b.bottom, this.charH * scale, {
      bird: this.birdId,
      state,
      t: this.t,
      flip: b.facing,
      power: this.state === "charge" ? this.currentCharge() : b.landImpact,
      spin: b.spin,
      airborne,
      blink: birdBlink(this.t, 2),
    });
    ctx.restore();
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

    // Hearts. Bigger than they were, and spaced to match — at 10px across
    // they were a row of dots a child could not count at arm's length.
    for (let i = 0; i < MAX_HEARTS; i++) {
      const hx = view.x + view.w - pad - 26 - i * 42;
      this.drawHeart(ctx, hx, top + 20, 16, i < this.hearts);
    }

    // stars collected
    text(ctx, `★ ${this.starsGot}/${this.pickups.length}`, view.x + view.w - pad - 4, top + 56,
      { size: 22, color: TOKENS.bee, align: "right" });

    this.drawPowerBadge(ctx, view, top);

    this.drawVoiceMeter(ctx, view);

    if (this.state === "prompt" || this.state === "charge") this.drawWordCard(ctx, view);
    if (this.state === "intro") this.drawIntro(ctx, view);
    if (this.state === "done") this.drawDone(ctx, view);
    if (this.state === "prompt" || this.state === "charge") this.drawListenState(ctx, view);
    this.drawControls(ctx, view);
  }

  drawControls(ctx, view) {
    const { modes, pad, jump } = this.controlRects(view);
    ctx.save();
    fillRound(ctx, modes[0].x - 5, modes[0].y - 5,
      modes[2].x + modes[2].w - modes[0].x + 10, 86, 24, alpha(TOKENS.inkDeep, 0.88));
    for (const b of modes) {
      const selected = this.controlMode === b.mode;
      if (selected) fillRound(ctx, b.x + 3, b.y + 3, b.w - 6, b.h - 6, 19, C.sun.base);
      text(ctx, b.mode.toUpperCase(), b.x + b.w / 2, b.y + 40, {
        size: 25, color: selected ? C.coal.base : TOKENS.snow,
      });
    }
    if (this.controlMode !== "voice") {
      // These are drawn in the same logical space that pointer routing uses.
      // A child can switch modes and immediately press the visible target.
      circle(ctx, pad.cx, pad.cy + 7, pad.r, alpha(TOKENS.inkDeep, 0.62));
      circle(ctx, pad.cx, pad.cy, pad.r, alpha(TOKENS.inkRaised, 0.94));
      circle(ctx, pad.cx + this.steer * 31, pad.cy, 39, C.ice.light);
      text(ctx, "‹", pad.cx - 50, pad.cy + 3, { size: 49, color: TOKENS.snow });
      text(ctx, "›", pad.cx + 50, pad.cy + 3, { size: 49, color: TOKENS.snow });
      circle(ctx, jump.cx, jump.cy + 8, jump.r, C.sun.dark);
      circle(ctx, jump.cx, jump.cy + (this.holding ? 6 : 0), jump.r - 5, C.sun.base);
      text(ctx, this.holding ? "HOLD" : "JUMP", jump.cx, jump.cy + 5, {
        size: 31, color: C.coal.base,
      });
    }
    ctx.restore();
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

    // amber column — the REAL jump power, matching the arc on screen, so the
    // column clearing the red line means the same thing the green arc does.
    const c = this.effectiveCharge(this.currentCharge(), this.holding
      ? this.controlMode !== "voice" || this.holdCharge > 0.3 : true);
    const live = this.voiceReady && this.controlMode !== "touch"
      ? Math.max(c, this.voice.level * 0.5) : c;
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
    const speaking = this.controlMode !== "touch" && this.voiceReady && this.voice.speaking;
    if (speaking) {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(this.t * 12) * 0.12;
      circle(ctx, x + w / 2, micY - 4, 30 + Math.sin(this.t * 12) * 4, C.cherry.base);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.42;
    const micCol = this.controlMode === "touch" ? C.sun.light :
      !this.voiceReady ? C.slate.light : speaking ? C.cherry.base : "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;
    if (this.controlMode === "touch") {
      text(ctx, "↑", x + w / 2, micY, { size: 46, color: micCol });
      ctx.restore();
      return;
    }
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
  /**
   * What the game is waiting for, in words a child can act on.
   *
   * This replaces a fifteen-pixel line reading "No microphone — hold the
   * screen to charge", pinned to the very bottom of the screen. It was too
   * small to read, in the place least likely to be looked at, and it used the
   * word "charge" — which means nothing to a four-year-old.
   */
  drawListenState(ctx, view) {
    const cy = this.controlMode === "voice"
      ? view.y + view.h * 0.70 + 200 : view.y + view.h * 0.72;
    let label, colour, icon;

    if (this.wrongT > 0) {
      label = this.heardWrong ? `I heard "${this.heardWrong}" — try again!` : "I did not catch that — try again!";
      colour = TOKENS.bee;
      icon = "👂";
    } else if (this.controlMode === "touch") {
      label = "Hold JUMP, then let go";
      colour = TOKENS.snow;
      icon = "👆";
    } else if (this.listening) {
      label = "Listening… say it!";
      colour = C.jade.light;
      icon = "🎤";
    } else if (this.speechOn) {
      label = this.controlMode === "both" ? "Say it or press JUMP" : "Say the word to jump";
      colour = alpha(TOKENS.snow, 0.7);
      icon = "🎤";
    } else {
      label = this.controlMode === "both" ? "Hold JUMP, then let go" : "Hold the screen to jump";
      colour = alpha(TOKENS.snow, 0.7);
      icon = "👆";
    }

    const w = label.length * 11 + 76;
    const x = view.x + view.w / 2 - w / 2;
    ctx.save();
    // A soft pulse while listening, so a child can see the game is waiting
    // for them rather than ignoring them.
    if (this.listening) ctx.globalAlpha = 0.72 + Math.sin(this.t * 5) * 0.28;
    fillRound(ctx, x, cy - 24, w, 48, 24, alpha("#0B1418", 0.75));
    ctx.font = "24px system-ui, 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(icon, x + 20, cy);
    text(ctx, label, x + 58, cy, { size: 19, color: colour, align: "left" });
    ctx.restore();
  }

  drawWordCard(ctx, view) {
    const w = Math.min(430, view.w - 150);
    const h = 168;
    const x = view.x + view.w / 2 - w / 2 + 36;
    const pop = easeOutBack(clamp(this.stateT * 3.2, 0, 1));
    // Lifted well clear of the bottom edge. Sitting 30px from the bottom put
    // the word — the single most important thing on the screen — in the strip
    // a hand covers while holding the phone, and on a device with gesture
    // navigation the hint underneath it was cut off entirely.
    const y = view.y + view.h * (this.controlMode === "voice" ? 0.70 : 0.53) - (1 - pop) * 40;

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

      text(ctx, this.controlMode === "touch" ? "LOOK & JUMP" :
        this.controlMode === "both" ? "SAY OR JUMP" : "SAY IT LOUD!", x + 124, y + 34,
        { size: 14, color: this.theme.accent, align: "left" });
      text(ctx, W.word.toUpperCase(), x + 124, y + 74,
        { size: 42, color: TOKENS.snow, align: "left" });
      // the stretched form teaches "hold the vowel to jump further"
      text(ctx, this.controlMode === "touch" ? "HOLD, THEN LET GO →" : stretched(W.word).toUpperCase() + " →", x + 124, y + 116,
        { size: 22, color: alpha(TOKENS.snow, 0.55), align: "left" });
      /**
       * The syllables, promoted when they are the only way in.
       *
       * On a device with no working text-to-speech engine, HEAR IT cannot
       * help and "cas · tle" is all a child who cannot read the word has
       * left. Small and dim is fine as a hint beside a working button; it is
       * not fine as the primary route, so it grows and brightens when the
       * button cannot do its job.
       */
      const mute = speechWorking() === false;
      text(ctx, W.syl.join(" · "), x + 124, y + 144,
        { size: mute ? 22 : 16, color: mute ? TOKENS.snow : TOKENS.textDim, align: "left" });

      // The "say it for me" button.
      //
      // It was drawn here before but was never wired to anything — a picture
      // of a speaker that did nothing when pressed. A child who cannot read
      // the word, or is not sure how it sounds, has no other way in: hearing
      // it is the whole point of a game about saying it. So it is now a real
      // target, deliberately large, and it breathes so it reads as pressable
      // rather than as a label.
      const sb = this.sayButton = {
        cx: x + w - 52, cy: y + h / 2, r: 40,
      };
      const beat = this.speakT > 0
        ? 1 + Math.sin(this.speakT * 22) * 0.06
        : 1 + Math.sin(this.t * 2.6) * 0.045;
      ctx.save();
      ctx.translate(sb.cx, sb.cy);
      ctx.scale(beat, beat);
      circle(ctx, 0, 4, sb.r, alpha("#000000", 0.35));
      circle(ctx, 0, 0, sb.r, this.speakT > 0 ? this.theme.accent : alpha(this.theme.accent, 0.9));
      circle(ctx, 0, -sb.r * 0.28, sb.r * 0.72, alpha("#FFFFFF", 0.18));
      text(ctx, mute ? "🔇" : "🔊", 0, 2, { size: 34, color: "#17120A" });
      ctx.restore();
      // Say which it is. A button that looks identical whether or not it
      // works is how "I pressed it and nothing happened" becomes a mystery
      // instead of a fact about the phone.
      text(ctx, mute ? "NO VOICE" : "HEAR IT", sb.cx, sb.cy + sb.r + 18,
        { size: 13, color: alpha(TOKENS.snow, mute ? 0.55 : 0.75) });
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
