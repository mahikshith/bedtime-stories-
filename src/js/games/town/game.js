/**
 * Tinker Town — a place, not a level.
 *
 * There is no goal, no score, no timer and no way to lose. You pick things up,
 * carry them between rooms, put them on other things, and see what happens.
 *
 * The four decisions that make this work, and why:
 *
 * 1. EVERY TOUCH SPEAKS THE THING'S NAME. This is the whole educational layer
 *    and it costs the play nothing. A child hears "watering can" forty times
 *    in a session because they picked it up forty times, not because a quiz
 *    asked them to. It is also the reason a sandbox belongs in this app at all.
 *
 * 2. ITEM PORTABILITY. Anything can be carried into any room via the pocket.
 *    Four rooms you can move things between is a far bigger space than eight
 *    rooms you cannot, and it is what turns "screens" into "a world".
 *
 * 3. REACTIONS, NOT INSTRUCTIONS. Seed into soil grows. Pot onto stove cooks.
 *    Soap into the bath makes bubbles. Nothing is explained; the child forms a
 *    hypothesis and tests it, which is the actual loop.
 *
 * 4. A GENTLE HINT, NEVER AN ARROW. While something is held, the fixtures it
 *    could react with breathe softly. It says WHERE without saying WHAT, so
 *    the discovery still belongs to the child.
 *
 * And a reason to come back: the present crate opens once a day.
 */

import { clamp, approach, lerp, easeOutBack, rand, pick } from "../../core/engine.js";
import { C, alpha, mix } from "../../core/palette.js";
import { fillRound, roundRect, circle, ellipse, text } from "../../core/draw.js";
import { drawBird, birdBlink, BIRD_IDS } from "../../art/bird.js";
import { sfx, speak, stopSpeaking, startMusic, stopMusic } from "../../core/audio.js";
import { save } from "../../core/storage.js";
import { Fx } from "../../core/fx.js";
import { THINGS, THING_IDS, drawThing, has } from "./things.js";
import { SCENES, SCENE_IDS } from "./scenes.js";
import { react, hintTargets } from "./rules.js";

const GAME_ID = "town";
const SAVE_KEY = "wordquest.town.v1";

/** Things the daily present can bring, in the order they unlock. */
const GIFTS = ["cake", "boat", "ball", "flower", "fish", "bell", "mushroom", "horn", "cup", "shaker"];

export class TownScene {
  constructor({ bird = "chick", onExit }) {
    this.birdId = bird;
    this.onExit = onExit;

    this.fx = new Fx();
    this.t = 0;
    this.sceneId = "kitchen";
    this.things = [];          // everything loose in every room
    this.pocket = [];          // carried between rooms — the key mechanic
    this.birds = [];
    this.fixtureActive = {};
    this.drag = null;
    this.say = { text: "", t: 0, x: 0, y: 0 };
    this.travelT = 0;
    this.giftReady = false;
    this.idle = 0;
    this.nudge = null;

    this.load();
  }

  /* --------------------------------------------------------- persistence */

  /** The world persists. A sandbox you have to rebuild every session is a toy
   *  box someone empties overnight. */
  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch {}
    if (data?.things?.length) {
      this.things = data.things;
      this.pocket = data.pocket ?? [];
      this.fixtureActive = data.fixtureActive ?? {};
      this.lastGift = data.lastGift ?? null;
      this.giftsGiven = data.giftsGiven ?? 0;
    } else {
      this.things = [];
      for (const id of SCENE_IDS) {
        for (const s of SCENES[id].start) {
          this.things.push({
            id: `${id}-${s.thing}-${this.things.length}`,
            thing: s.thing, scene: id, x: s.x, y: s.y, state: {},
          });
        }
      }
      this.pocket = [];
      this.lastGift = null;
      this.giftsGiven = 0;
    }
    // Birds live in the world too, one per room, wandering.
    this.birds = SCENE_IDS.map((id, i) => ({
      id: `bird-${i}`, isBird: true, scene: id,
      x: 0.5 + (i % 2 ? 0.15 : -0.15), y: id === "bath" ? 0.92 : 0.9,
      kind: BIRD_IDS[i % BIRD_IDS.length],
      target: 0.5, mood: "idle", moodT: 0, seed: i * 1.7,
    }));
    const today = new Date().toISOString().slice(0, 10);
    this.giftReady = this.lastGift !== today;
  }

  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        things: this.things, pocket: this.pocket,
        fixtureActive: this.fixtureActive,
        lastGift: this.lastGift, giftsGiven: this.giftsGiven,
      }));
    } catch {}
  }

  /* ---------------------------------------------------------------- setup */

  async enter(engine) {
    this.engine = engine;
    engine.design = { w: 720, h: 1280 };
    engine.resize();
    startMusic();
  }

  destroy() {
    this.persist();
    stopSpeaking();
    stopMusic();
  }

  resize(view) {
    // The room occupies everything above the pocket bar and below the header.
    const headerH = 96, barH = 150;
    this.room = {
      x: view.x, y: view.y + headerH,
      w: view.w, h: view.h - headerH - barH,
    };
    this.bar = { x: view.x, y: view.y + view.h - barH, w: view.w, h: barH };
    // Sized for a three-year-old's finger, not for a mouse pointer. The whole
    // interaction is picking things up, so a toy that needs aiming at is a toy
    // that does not get played with.
    this.thingSize = Math.min(178, view.w * 0.245);
    // Settling needs the room box, so it waits for the first layout pass.
    if (!this.settled) { this.settled = true; this.settleAll(); }
  }

  get scene() { return SCENES[this.sceneId]; }
  get here() { return this.things.filter((t) => t.scene === this.sceneId); }
  get birdHere() { return this.birds.find((b) => b.scene === this.sceneId); }

  /* ------------------------------------------------------------ geometry */

  /**
   * Nudge a just-landed thing sideways until it is not sitting exactly on top
   * of something else.
   *
   * Two objects at the same spot means the lower one is invisible, and to a
   * three-year-old an invisible toy has not been covered up — it has been
   * eaten by the game. They will not dig for it; they will stop trusting that
   * putting things down is safe.
   */
  /** How wide a thing is, as a fraction of the room. */
  halfWidth(o) {
    return (this.thingSize * (THINGS[o.thing]?.w ?? 0.6) * 0.55) / this.room.w;
  }

  /**
   * Spread everything resting on one surface so that nothing covers anything
   * else, anchored on `keep` (the thing the child just put down, which should
   * stay where they put it).
   *
   * Nudging only the newest item is not enough, because a rule can drop a
   * second thing into the room before the first one has settled. Sweeping the
   * whole row is both simpler to reason about and the only version that ends
   * with a guarantee: no two things on a surface overlap, ever.
   */
  settleRow(yFrac, keep = null, sceneId = this.sceneId) {
    const row = this.things
      .filter((o) => o.scene === sceneId && !o.state?.floating &&
                     Math.abs(o.y - yFrac) < 0.02)
      .sort((a, b) => a.x - b.x);
    if (row.length < 2) return;

    // Walk right from the anchor, then left from it, pushing only as far as
    // each pair actually needs.
    const anchor = Math.max(0, row.indexOf(keep));
    for (let i = anchor + 1; i < row.length; i++) {
      const need = this.halfWidth(row[i]) + this.halfWidth(row[i - 1]);
      row[i].x = Math.max(row[i].x, row[i - 1].x + need);
    }
    for (let i = anchor - 1; i >= 0; i--) {
      const need = this.halfWidth(row[i]) + this.halfWidth(row[i + 1]);
      row[i].x = Math.min(row[i].x, row[i + 1].x - need);
    }
    // Anything pushed past an edge comes back in, and the row is walked once
    // more so the fix does not create a new overlap.
    for (const o of row) o.x = clamp(o.x, 0.06, 0.94);
    for (let i = 1; i < row.length; i++) {
      const need = this.halfWidth(row[i]) + this.halfWidth(row[i - 1]);
      if (row[i].x - row[i - 1].x < need) row[i].x = Math.min(0.94, row[i - 1].x + need);
    }
    for (let i = row.length - 2; i >= 0; i--) {
      const need = this.halfWidth(row[i]) + this.halfWidth(row[i + 1]);
      if (row[i + 1].x - row[i].x < need) row[i].x = Math.max(0.06, row[i + 1].x - need);
    }
  }

  /**
   * Settle every surface in every room.
   *
   * Run once on entry, because the starting layouts are hand-written fractions
   * and an author's idea of "far enough apart" is not the same as the one the
   * item widths actually imply — which is how the kitchen shipped with the egg
   * tucked behind the apple.
   */
  settleAll() {
    for (const id of SCENE_IDS)
      for (const surface of SCENES[id].surfaces)
        this.settleRow(surface.y, null, id);
  }

  /** Screen position of a thing stored in room fractions. */
  pos(t) {
    return { x: this.room.x + t.x * this.room.w, y: this.room.y + t.y * this.room.h };
  }

  /** The surface a dropped thing should rest on: nearest one below it. */
  restY(xFrac, yFrac) {
    let best = null;
    for (const s of this.scene.surfaces) {
      if (xFrac < s.x1 || xFrac > s.x2) continue;
      if (s.y < yFrac - 0.04) continue;
      if (!best || s.y < best.y) best = s;
    }
    return best ? best.y : (this.scene.surfaces[this.scene.surfaces.length - 1]?.y ?? 0.9);
  }

  /** Fixture under a screen point, if any. */
  fixtureAt(pt) {
    for (const f of this.scene.fixtures) {
      const cx = this.room.x + f.x * this.room.w;
      const cy = this.room.y + f.y * this.room.h;
      const hw = f.w * this.room.w / 2, hh = f.h * this.room.h / 2;
      if (Math.abs(pt.x - cx) < hw && Math.abs(pt.y - cy) < hh + 30) {
        return { fixture: f.id, x: cx, y: cy, def: f };
      }
    }
    return null;
  }

  thingAt(pt, skip = null) {
    const r = this.thingSize * 0.4;
    for (let i = this.here.length - 1; i >= 0; i--) {
      const t = this.here[i];
      if (t === skip) continue;
      const p = this.pos(t);
      const size = this.thingSize * (THINGS[t.thing]?.w ?? 0.6);
      if (Math.abs(pt.x - p.x) < size * 0.55 && Math.abs(pt.y - p.y + size * 0.3) < size * 0.6) return t;
    }
    return null;
  }

  birdAt(pt) {
    const b = this.birdHere;
    if (!b) return null;
    const p = this.pos(b);
    return (Math.abs(pt.x - p.x) < 60 && Math.abs(pt.y - p.y + 50) < 70) ? b : null;
  }

  /* --------------------------------------------------------------- input */

  down(pt) {
    this.idle = 0;
    this.nudge = null;

    // room tabs
    for (const tab of this.tabRects ?? []) {
      if (inRect(pt, tab)) { this.travel(tab.id); return; }
    }
    // present crate
    if (this.giftRect && this.giftReady && inRect(pt, this.giftRect)) { this.openGift(); return; }

    // pocket slots — pull a carried thing back into the room
    for (const slot of this.pocketRects ?? []) {
      if (!inRect(pt, slot)) continue;
      const item = this.pocket[slot.index];
      if (!item) return;
      this.pocket.splice(slot.index, 1);
      item.scene = this.sceneId;
      this.things.push(item);
      this.drag = { thing: item, from: "pocket", ox: 0, oy: 0, px: pt.x, py: pt.y };
      this.nameIt(item);
      sfx.pop();
      return;
    }

    // Things before the bird. The bird is the biggest target on the screen and
    // it wanders over the floor where the toys are; if it were checked first,
    // a child reaching for the watering can standing next to it would get
    // "hello!" instead, and would have no way to tell why.
    const t = this.thingAt(pt);
    if (t) {
      const p = this.pos(t);
      this.drag = { thing: t, from: "room", ox: p.x - pt.x, oy: p.y - pt.y, px: pt.x, py: pt.y };
      // bring to front
      this.things.splice(this.things.indexOf(t), 1);
      this.things.push(t);
      this.nameIt(t);
      sfx.tick();
      return;
    }

    // a bird: tapping it makes it react
    const bird = this.birdAt(pt);
    if (bird) {
      bird.mood = "cheer"; bird.moodT = 1.4;
      sfx.coin();
      speak("hello!");
      return;
    }

    // tapping a fixture names it too — everything in the world has a name
    const f = this.fixtureAt(pt);
    if (f) { this.speakPhrase(f.def.id); sfx.tick(); }
  }

  move(pt) {
    if (!this.drag) return;
    this.drag.px = pt.x; this.drag.py = pt.y;
    const t = this.drag.thing;
    t.x = clamp((pt.x + this.drag.ox - this.room.x) / this.room.w, 0.03, 0.97);
    t.y = clamp((pt.y + this.drag.oy - this.room.y) / this.room.h, 0.05, 1.05);
    this.drag.overPocket = pt.y > this.bar.y + 10;
  }

  up(pt) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const t = d.thing;

    // dropped into the pocket: it travels with you
    if (pt.y > this.bar.y + 10) {
      if (this.pocket.length < 6) {
        this.things.splice(this.things.indexOf(t), 1);
        this.pocket.push(t);
        sfx.whoosh();
        this.flash(`${THINGS[t.thing].name} in your pocket`);
      } else {
        this.flash("pocket is full!");
        t.y = this.restY(t.x, t.y);
      }
      this.persist();
      return;
    }

    // What did it land on? Try the most specific target first and fall back to
    // the place itself. Without the fallback, a bath that already had a duck
    // in it would swallow the soap and do nothing — the thing sitting in a
    // place must never block a reaction with the place.
    const candidates = [this.birdAt(pt), this.thingAt(pt, t), this.fixtureAt(pt)];
    let result = { fired: false, phrase: null };
    for (const target of candidates) {
      if (!target) continue;
      result = react(this, t, target);
      if (result.fired) break;
    }

    if (result.phrase) {
      this.flash(result.phrase);
      speak(result.phrase);
      sfx.correct();
    } else if (result.fired) {
      sfx.pop();
    }
    // settle onto a surface unless the reaction parked it somewhere
    if (this.things.includes(t) && !t.state?.floating) {
      t.y = this.restY(t.x, t.y);
      this.settleRow(t.y, t);
    }
    sfx.land();
    this.persist();
  }

  /* -------------------------------------------------------------- speech */

  nameIt(t) {
    const name = THINGS[t.thing]?.name;
    if (!name) return;
    this.flash(name);
    speak(name);
    if (THINGS[t.thing].note) this.playNote(THINGS[t.thing].note);
    save.learnWord(name);
  }

  speakPhrase(word) {
    this.flash(word);
    speak(word);
  }

  flash(str) {
    this.say = { text: str, t: 1 };
  }

  /* -------------------------------------------------- world effects API */
  /* The rules call these; keeping them here means a rule never has to know
     how anything is drawn. */

  remove(thing) {
    const i = this.things.indexOf(thing);
    if (i >= 0) this.things.splice(i, 1);
  }
  burst(xf, yf, color) {
    const p = this.pos({ x: xf, y: yf });
    this.fx.burst(p.x, p.y, [color, "#FFFFFF"], 14);
  }
  sparkle(xf, yf) {
    const p = this.pos({ x: xf, y: yf });
    this.fx.burst(p.x, p.y, [C.sun.light, "#FFFFFF", C.grass.light], 20);
    this.fx.ring(p.x, p.y, "#FFFFFF", 0.5);
  }
  rain(xf, yf) {
    const p = this.pos({ x: xf, y: yf });
    for (let i = 0; i < 10; i++) {
      this.fx.burst(p.x + rand(-26, 26), p.y + rand(-10, 10), [C.sea.light], 2);
    }
  }
  splash(xf, yf) {
    const p = this.pos({ x: xf, y: yf });
    this.fx.burst(p.x, p.y, [C.sea.light, "#FFFFFF"], 18);
    this.fx.ring(p.x, p.y, C.sea.light, 0.45);
    sfx.pop();
  }
  playNote(freq) { sfx.jump(clamp((freq - 180) / 800, 0, 1)); }

  /** A second note a beat after the first, so two instruments sound like two. */
  chord(freq) { setTimeout(() => this.playNote(freq), 130); }

  /** Put a brand new thing into the current room. */
  spawn(thingId, xf, yf) {
    const item = {
      id: `${thingId}-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      thing: thingId, scene: this.sceneId,
      x: clamp(xf, 0.06, 0.94), y: yf, state: {},
    };
    item.y = this.restY(item.x, item.y);
    this.things.push(item);
    this.settleRow(item.y, item);    // a new thing must not land on an old one
    this.fx.burst(this.pos(item).x, this.pos(item).y, [C.sun.light, "#FFFFFF"], 12);
    return item;
  }

  /* ------------------------------------------------------------- travel */

  travel(id) {
    if (id === this.sceneId) return;
    this.idle = 0;
    this.nudge = null;
    this.sceneId = id;
    this.travelT = 1;
    this.drag = null;
    sfx.whoosh();
    this.flash(SCENES[id].name);
    speak(SCENES[id].name);
    this.persist();
  }

  openGift() {
    const thingId = GIFTS[this.giftsGiven % GIFTS.length];
    this.giftsGiven++;
    this.lastGift = new Date().toISOString().slice(0, 10);
    this.giftReady = false;
    const item = {
      id: `gift-${Date.now()}`, thing: thingId, scene: this.sceneId,
      x: 0.5, y: this.restY(0.5, 0.4), state: {},
    };
    this.things.push(item);
    const p = this.pos(item);
    this.fx.burst(p.x, p.y, [C.sun.base, C.candy.base, "#FFFFFF", C.jade.light], 44);
    sfx.fanfare();
    this.flash(`a ${THINGS[thingId].name}!`);
    speak(`A present! A ${THINGS[thingId].name}!`);
    save.learnWord(THINGS[thingId].name);
    this.persist();
  }

  /* --------------------------------------------------------------- loop */

  update(dt) {
    this.t += dt;
    this.fx.update(dt);
    this.say.t = Math.max(0, this.say.t - dt * 0.55);
    this.travelT = Math.max(0, this.travelT - dt * 2.6);

    // birds wander, so the rooms are never still
    for (const b of this.birds) {
      b.moodT = Math.max(0, b.moodT - dt);
      if (b.moodT <= 0) b.mood = "idle";
      if (Math.abs(b.x - b.target) < 0.02) {
        if (Math.random() < dt * 0.45) b.target = 0.12 + Math.random() * 0.76;
      } else {
        const dir = Math.sign(b.target - b.x);
        b.x += dir * dt * 0.08;
        b.facing = dir;
      }
    }

    // The idle nudge. A game with no goal still has to answer the question a
    // child asks in the first ten seconds, which is not "what do I do?" but
    // "does anything happen?". After a quiet spell one thing in the room
    // breathes — never an arrow, never a voice telling them what to pick.
    this.idle += dt;
    if (this.drag) { this.idle = 0; this.nudge = null; }
    if (this.idle > 7) {
      if (!this.nudge || !this.here.includes(this.nudge) || this.idle > 14) {
        const pool = this.here.filter((o) => hintTargets(this.sceneId, o.thing).length);
        this.nudge = pick(pool.length ? pool : this.here) ?? null;
        this.idle = 7.01;
      }
    } else {
      this.nudge = null;
    }
  }

  /* --------------------------------------------------------------- draw */

  draw(ctx, engine) {
    const view = engine.view;
    ctx.fillStyle = "#1A1410";
    ctx.fillRect(view.x, view.y, view.w, view.h);

    // the room
    ctx.save();
    roundRect(ctx, this.room.x, this.room.y, this.room.w, this.room.h, 0);
    ctx.clip();
    this.scene.paint(ctx, this.room, this.t);
    this.drawNudge(ctx);
    this.drawHints(ctx);
    this.drawContents(ctx);
    this.scene.overlay?.(ctx, this.room, this.t, this);
    this.fx.draw(ctx);
    // travel wipe
    if (this.travelT > 0) {
      ctx.globalAlpha = this.travelT * 0.8;
      ctx.fillStyle = "#12100E";
      ctx.fillRect(this.room.x, this.room.y, this.room.w, this.room.h);
    }
    ctx.restore();

    this.drawHeader(ctx, view);
    this.drawBar(ctx, view);
    if (this.drag) this.drawDragged(ctx);
    this.drawSay(ctx, view);
  }

  /** The gentle nudge: fixtures this held thing could act on, breathing. */
  drawHints(ctx) {
    if (!this.drag) return;
    const targets = hintTargets(this.sceneId, this.drag.thing.thing);
    if (!targets.length) return;
    const pulse = 0.35 + Math.sin(this.t * 4) * 0.22;
    for (const f of this.scene.fixtures) {
      if (!targets.includes(f.id)) continue;
      const cx = this.room.x + f.x * this.room.w;
      const cy = this.room.y + f.y * this.room.h;
      const rw = f.w * this.room.w, rh = f.h * this.room.h;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 6;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -this.t * 30;
      ctx.strokeStyle = C.sun.light;
      roundRect(ctx, cx - rw / 2, cy - rh / 2 - 8, rw, rh + 16, 16);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** The soft breath under a thing the room is inviting you to try. */
  drawNudge(ctx) {
    if (!this.nudge || this.drag) return;
    const p = this.pos(this.nudge);
    const beat = (Math.sin(this.t * 2.6) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.3 + beat * 0.34;
    const r = this.thingSize * (0.5 + beat * 0.18);
    const g = ctx.createRadialGradient(p.x, p.y - this.thingSize * 0.2, 2,
                                       p.x, p.y - this.thingSize * 0.2, r);
    g.addColorStop(0, alpha(C.sun.light, 0.95));
    g.addColorStop(1, alpha(C.sun.light, 0));
    ctx.fillStyle = g;
    ctx.fillRect(p.x - r, p.y - this.thingSize * 0.2 - r, r * 2, r * 2);
    ctx.restore();
  }

  drawContents(ctx) {
    // sort by y so nearer things overlap farther ones
    const items = this.here
      .filter((t) => t !== this.drag?.thing)
      .slice()
      .sort((a, b) => a.y - b.y);

    const bird = this.birdHere;
    const bp = bird ? this.pos(bird) : null;
    let birdDrawn = false;

    for (const t of items) {
      if (bird && !birdDrawn && t.y > bird.y) { this.drawBird(ctx, bird, bp); birdDrawn = true; }
      this.drawThingAt(ctx, t);
    }
    if (bird && !birdDrawn) this.drawBird(ctx, bird, bp);
  }

  drawThingAt(ctx, t) {
    const p = this.pos(t);
    const size = this.thingSize;
    let bob = t.state?.floating ? Math.sin(this.t * 2 + t.x * 9) * 5 : 0;
    // The nudged thing hops. A glow alone is easy for a two-year-old to look
    // straight past; something that MOVES is not.
    if (t === this.nudge && !this.drag)
      bob -= Math.abs(Math.sin(this.t * 2.6)) * size * 0.1;
    // contact shadow
    ctx.save();
    ctx.globalAlpha = 0.24;
    ellipse(ctx, p.x, p.y + 4, size * (THINGS[t.thing]?.w ?? 0.5) * 0.4, size * 0.05, "#000000");
    ctx.restore();
    drawThing(ctx, t.thing, p.x, p.y - size * 0.22 + bob, size, { ...(t.state ?? {}), t: this.t });
    if (t.state?.wet) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      circle(ctx, p.x + size * 0.16, p.y - size * 0.4, 4, C.sea.light);
      ctx.restore();
    }
  }

  drawBird(ctx, b, p) {
    drawBird(ctx, p.x, p.y, 150, {
      bird: b.kind, state: b.mood === "cheer" ? "cheer" : "idle",
      t: this.t + b.seed, flip: b.facing ?? 1, blink: birdBlink(this.t, b.seed),
    });
  }

  drawDragged(ctx) {
    const t = this.drag.thing;
    const size = this.thingSize * 1.12;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ellipse(ctx, this.drag.px, this.bar.y - 8, size * 0.3, size * 0.06, "#000000");
    ctx.restore();
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    drawThing(ctx, t.thing, this.drag.px + this.drag.ox, this.drag.py + this.drag.oy - size * 0.2,
      size, { ...(t.state ?? {}), t: this.t });
    ctx.restore();
  }

  /* ------------------------------------------------------------- chrome */

  drawHeader(ctx, view) {
    const h = 96;
    const tint = this.scene.tint ?? C.sun;
    ctx.save();
    const g = ctx.createLinearGradient(0, view.y, 0, view.y + h);
    g.addColorStop(0, mix(tint.deep, "#000000", 0.45));
    g.addColorStop(1, mix(tint.deep, "#000000", 0.2));
    ctx.fillStyle = g;
    ctx.fillRect(view.x, view.y, view.w, h);
    ctx.restore();
    fillRound(ctx, view.x, view.y + h - 5, view.w, 5, 0, alpha(tint.light, 0.45));

    // back arrow, drawn rather than typed so it is the same weight everywhere
    ctx.save();
    ctx.strokeStyle = alpha("#FFFFFF", 0.8);
    ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(view.x + 42, view.y + 32); ctx.lineTo(view.x + 26, view.y + 48);
    ctx.lineTo(view.x + 42, view.y + 64);
    ctx.stroke();
    ctx.restore();

    // room tabs — the whole navigation model, four big targets.
    // The icons are drawn, not emoji: a system emoji font is a different
    // artist on every device, and half of them have no glyph for a bathtub.
    this.tabRects = [];
    const n = SCENE_IDS.length;
    const tw = 82, gap = 9;
    const total = n * tw + (n - 1) * gap;
    const x0 = view.x + view.w / 2 - total / 2 + 16;
    SCENE_IDS.forEach((id, i) => {
      const r = { x: x0 + i * (tw + gap), y: view.y + 14, w: tw, h: 68, id };
      this.tabRects.push(r);
      const on = id === this.sceneId;
      const col = SCENES[id].tint ?? C.sun;
      fillRound(ctx, r.x, r.y + 5, r.w, r.h, 18, on ? col.deep : "#1A1524");
      fillRound(ctx, r.x, r.y, r.w, r.h, 18, on ? col.base : "#2A2336");
      if (on) fillRound(ctx, r.x + 4, r.y + 4, r.w - 8, r.h * 0.32, 12, alpha("#FFFFFF", 0.22));
      ctx.save();
      if (!on) ctx.globalAlpha = 0.62;
      SCENES[id].icon(ctx, r.x + r.w / 2, r.y + 27, 40);
      ctx.restore();
      text(ctx, SCENES[id].name.split(" ")[0].toUpperCase(), r.x + r.w / 2, r.y + 55,
        { size: 11, color: on ? mix(col.deep, "#000000", 0.35) : alpha("#FFFFFF", 0.62) });
    });

    // the present crate, if today's is unopened
    const gr = { x: view.x + view.w - 76, y: view.y + 18, w: 58, h: 60 };
    this.giftRect = gr;
    if (this.giftReady) {
      const bounce = Math.sin(this.t * 3) * 4;
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(this.t * 4) * 0.3;
      circle(ctx, gr.x + gr.w / 2, gr.y + 30, 34, alpha(C.sun.light, 0.5));
      ctx.restore();
      drawThing(ctx, "gift", gr.x + gr.w / 2, gr.y + 40 + bounce, 92);
    }
  }

  /** The pocket. Six slots, always visible, always reachable. */
  drawBar(ctx, view) {
    const b = this.bar;
    // A satchel, not a dashed grid. The pocket is the mechanic that makes the
    // four rooms one world, so it has to look like something you own rather
    // than like an inventory widget bolted to the bottom of the screen.
    ctx.save();
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, "#8E5628"); g.addColorStop(1, "#5C3418");
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 14; i++) {                       // stitched leather grain
      ctx.fillStyle = i % 2 ? "#3A2110" : "#B5793F";
      ctx.fillRect(b.x + i * (b.w / 14), b.y, b.w / 28, b.h);
    }
    ctx.restore();
    fillRound(ctx, b.x, b.y, b.w, 7, 0, "#C98A4B");
    ctx.save();                                           // saddle stitching
    ctx.strokeStyle = alpha("#F6D79A", 0.55);
    ctx.lineWidth = 3; ctx.setLineDash([9, 8]);
    ctx.beginPath();
    ctx.moveTo(b.x + 14, b.y + 17); ctx.lineTo(b.x + b.w - 14, b.y + 17);
    ctx.stroke();
    ctx.restore();

    text(ctx, "MY POCKET", b.x + b.w / 2, b.y + 32,
      { size: 14, color: alpha("#FFE9C4", 0.85) });

    this.pocketRects = [];
    const slots = 6, sw = 78, gap = 9;
    const total = slots * sw + (slots - 1) * gap;
    const x0 = b.x + b.w / 2 - total / 2;
    for (let i = 0; i < slots; i++) {
      const r = { x: x0 + i * (sw + gap), y: b.y + 46, w: sw, h: sw, index: i };
      this.pocketRects.push(r);
      const item = this.pocket[i];
      const hot = this.drag?.overPocket && i === this.pocket.length;
      // each slot is a sewn-in pouch: dark inside, lit lip along the top
      fillRound(ctx, r.x, r.y, r.w, r.h, 16, "#3A2110");
      fillRound(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 13,
        item ? "#5A3A1E" : "#48290F");
      fillRound(ctx, r.x + 3, r.y + 3, r.w - 6, 9, 5, alpha("#C98A4B", item ? 0.8 : 0.45));
      if (hot) {
        ctx.save();
        ctx.strokeStyle = C.sun.light;
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.6 + Math.sin(this.t * 8) * 0.35;
        roundRect(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 18);
        ctx.stroke();
        ctx.restore();
      }
      if (item) {
        drawThing(ctx, item.thing, r.x + r.w / 2, r.y + r.h * 0.66, r.w * 0.92,
          { ...(item.state ?? {}), t: this.t });
      }
    }
  }

  /** The spoken word, also shown — a child who can read gets the spelling. */
  drawSay(ctx, view) {
    if (this.say.t <= 0 || !this.say.text) return;
    const k = Math.min(1, this.say.t * 3);
    const y = this.room.y + 26;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.say.t * 2.2);
    const label = this.say.text.toUpperCase();
    const w = label.length * 13 + 44;
    const x = view.x + view.w / 2 - w / 2;
    ctx.translate(0, (1 - easeOutBack(k)) * -16);
    fillRound(ctx, x, y, w, 46, 23, alpha("#12100E", 0.82));
    fillRound(ctx, x, y, w, 46, 23, alpha(C.sun.base, 0.12));
    text(ctx, label, view.x + view.w / 2, y + 24, { size: 20, color: C.sun.light });
    ctx.restore();
  }
}

const inRect = (pt, r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
