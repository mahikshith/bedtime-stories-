/**
 * Platformer physics.
 *
 * A small, deterministic AABB world. Axis-separated resolution (X then Y) is
 * used rather than a true swept solve: it is far easier to reason about, it
 * never wedges a body in a seam between two adjacent tiles, and at 60 Hz with
 * our speeds nothing tunnels.
 *
 * The jump model is the part that matters most here. A voice-driven jump has
 * to be *predictable* — a child who shouts a bit louder must get a visibly
 * bigger arc, and an arc the level designer promised is clearable must
 * actually clear. So jumps are authored in world units (apex height, forward
 * distance) and the velocities are solved from them, instead of hand-tuning
 * impulses until it feels right. `solveJump` and `predictArc` are what let
 * the game draw the dotted landing preview.
 */

import { clamp } from "./engine.js";

export const TILE = 64;

/** Platform behaviours. */
export const KIND = {
  SOLID: "solid",
  ONEWAY: "oneway",     // pass through from below and from the sides
  CRUMBLE: "crumble",   // gives way a moment after being stood on
  MOVING: "moving",     // follows a path and carries riders
  BOUNCY: "bouncy",     // launches on contact
  ICE: "ice",           // almost no friction
  CONVEYOR: "conveyor", // pushes riders along
};

export const HAZARD = {
  SPIKE: "spike",
  WATER: "water",
  SAW: "saw",
  VOID: "void",         // below the level
};

/* ------------------------------------------------------------ tuning */

/**
 * One place for every number that decides how the game feels. These are
 * expressed in world units per second so they stay meaningful when levels are
 * authored on a 64px grid.
 */
export const TUNE = {
  gravity: 2400,
  fallGravity: 3100,      // heavier on the way down — less floaty, more arcade
  maxFall: 1500,
  runSpeed: 250,
  airControl: 0.55,       // fraction of ground accel available in the air
  groundAccel: 2600,
  groundFriction: 2200,
  iceFriction: 190,
  airDrag: 320,
  coyoteMs: 110,          // grace after walking off an edge
  bufferMs: 140,          // a jump pressed just before landing still fires
  crumbleMs: 420,
  bounceSpeed: 1150,
  conveyorSpeed: 170,
  terminalSpin: 12,
};

/**
 * Solve the launch velocities that produce a given arc.
 *
 * @param {number} apex     how high the jump peaks, world units
 * @param {number} distance how far forward it travels before returning to
 *                          the launch height
 * @returns {{vy:number, vx:number, airtime:number}}
 */
export function solveJump(apex, distance, gUp = TUNE.gravity, gDown = TUNE.fallGravity) {
  const vy = -Math.sqrt(2 * gUp * apex);
  const tUp = Math.sqrt(2 * apex / gUp);
  const tDown = Math.sqrt(2 * apex / gDown);
  const airtime = tUp + tDown;
  return { vy, vx: distance / airtime, airtime };
}

/* -------------------------------------------------------------- body */

export class Body {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.ground = null;      // the platform being stood on
    this.wasOnGround = false;
    this.coyote = 0;         // ms of remaining coyote time
    this.buffer = 0;         // ms of remaining buffered jump
    this.spin = 0;           // visual body rotation (radians)
    this.spinVel = 0;
    this.facing = 1;
    this.alive = true;
    this.landImpact = 0;     // 0..1, decays — drives the landing recoil pose
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }
  get right() { return this.x + this.w; }

  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

/* -------------------------------------------------------- the world */

export class World {
  /**
   * @param {object} o
   * @param {Array}  o.platforms
   * @param {Array}  [o.hazards]
   * @param {number} o.width
   * @param {number} o.height
   */
  constructor({ platforms = [], hazards = [], width = 4000, height = 1200, gravityScale = 1 } = {}) {
    this.platforms = platforms;
    this.hazards = hazards;
    this.width = width;
    this.height = height;
    this.gravityScale = gravityScale;
    this.time = 0;
    /** Set by the game each frame; called as onHazard(hazard, body). */
    this.onHazard = null;
    this.onBounce = null;
    this.onCrumble = null;
  }

  /** Advance platform motion. Must run before bodies move so riders follow. */
  stepPlatforms(dt) {
    this.time += dt;
    for (const p of this.platforms) {
      p.dx = 0; p.dy = 0;
      if (p.kind === KIND.MOVING) {
        const prevX = p.x, prevY = p.y;
        const phase = (this.time * p.speed + (p.phase ?? 0));
        // Ping-pong along the authored axis with an eased turnaround, so a
        // rider is never yanked off at the end of the travel.
        const s = (Math.sin(phase) + 1) / 2;
        p.x = p.ox + (p.tx ?? 0) * s;
        p.y = p.oy + (p.ty ?? 0) * s;
        p.dx = p.x - prevX;
        p.dy = p.y - prevY;
      }
      if (p.kind === KIND.CRUMBLE && p.crumbling) {
        p.crumbleT += dt * 1000;
        if (p.crumbleT >= TUNE.crumbleMs) {
          p.gone = true;
          p.respawnT = 2600;
        }
      }
      if (p.gone) {
        p.respawnT -= dt * 1000;
        if (p.respawnT <= 0) { p.gone = false; p.crumbling = false; p.crumbleT = 0; }
      }
    }
  }

  solid(p) { return !p.gone; }

  /** All platforms whose AABB overlaps a rect (brute force; levels are small). */
  overlapping(r) {
    const out = [];
    for (const p of this.platforms) {
      if (p.gone) continue;
      if (r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y) out.push(p);
    }
    return out;
  }

  /**
   * Move a body for one tick, resolving collisions.
   * @param {Body} b
   * @param {number} dt
   * @param {number} moveInput -1..1 horizontal intent
   */
  step(b, dt, moveInput = 0) {
    const g = (b.vy > 0 ? TUNE.fallGravity : TUNE.gravity) * this.gravityScale;
    b.vy = Math.min(b.vy + g * dt, TUNE.maxFall);

    // --- horizontal intent -------------------------------------------------
    const onIce = b.ground?.kind === KIND.ICE;
    const accel = TUNE.groundAccel * (b.onGround ? 1 : TUNE.airControl);
    if (moveInput !== 0) {
      b.vx += moveInput * accel * dt;
      b.facing = moveInput > 0 ? 1 : -1;
    } else {
      // friction only applies on the ground; in the air a light drag keeps
      // jump arcs honest without killing momentum
      const f = b.onGround ? (onIce ? TUNE.iceFriction : TUNE.groundFriction) : TUNE.airDrag;
      const drop = f * dt;
      b.vx = Math.abs(b.vx) <= drop ? 0 : b.vx - Math.sign(b.vx) * drop;
    }
    if (b.ground?.kind === KIND.CONVEYOR) {
      b.vx += (b.ground.dir ?? 1) * TUNE.conveyorSpeed * dt * 4;
    }
    const cap = TUNE.runSpeed * (b.speedMul ?? 1);
    if (Math.abs(b.vx) > cap && b.onGround && !onIce) {
      b.vx -= Math.sign(b.vx) * Math.min(Math.abs(b.vx) - cap, TUNE.groundFriction * dt);
    }

    // --- carry by a moving platform ---------------------------------------
    if (b.onGround && b.ground && (b.ground.dx || b.ground.dy)) {
      b.x += b.ground.dx;
      b.y += b.ground.dy;
    }

    b.wasOnGround = b.onGround;
    b.onGround = false;
    b.ground = null;

    // --- X axis ------------------------------------------------------------
    b.x += b.vx * dt;
    for (const p of this.overlapping(b.rect)) {
      if (p.kind === KIND.ONEWAY) continue;
      if (b.vx > 0) { b.x = p.x - b.w; b.vx = 0; }
      else if (b.vx < 0) { b.x = p.x + p.w; b.vx = 0; }
    }

    // --- Y axis ------------------------------------------------------------
    const prevBottom = b.bottom;
    b.y += b.vy * dt;
    for (const p of this.overlapping(b.rect)) {
      if (b.vy > 0) {
        // One-way tiles only catch a body that was above them last tick.
        if (p.kind === KIND.ONEWAY && prevBottom > p.y + 1) continue;
        b.y = p.y - b.h;
        if (p.kind === KIND.BOUNCY) {
          b.vy = -TUNE.bounceSpeed;
          this.onBounce?.(p, b);
          continue;
        }
        b.landImpact = clamp(b.vy / 1100, 0, 1);
        b.vy = 0;
        b.onGround = true;
        b.ground = p;
        if (p.kind === KIND.CRUMBLE && !p.crumbling) {
          p.crumbling = true; p.crumbleT = 0;
          this.onCrumble?.(p);
        }
      } else if (b.vy < 0) {
        if (p.kind === KIND.ONEWAY) continue;
        b.y = p.y + p.h;
        b.vy = 0;
      }
    }

    // --- timers ------------------------------------------------------------
    if (b.onGround) {
      b.coyote = TUNE.coyoteMs;
      if (!b.wasOnGround) b.spinVel = 0;
      // Snap a leftover flip upright fast — a character lying sideways on the
      // floor for half a second reads as a bug, not as follow-through.
      b.spin *= Math.max(0, 1 - dt * 26);
      if (Math.abs(b.spin) < 0.01) b.spin = 0;
    } else {
      b.coyote = Math.max(0, b.coyote - dt * 1000);
      b.spin += b.spinVel * dt;
    }
    b.buffer = Math.max(0, b.buffer - dt * 1000);
    b.landImpact = Math.max(0, b.landImpact - dt * 3.2);

    // --- hazards -----------------------------------------------------------
    if (b.y > this.height + 200) {
      this.onHazard?.({ type: HAZARD.VOID }, b);
    } else {
      for (const h of this.hazards) {
        if (h.dead) continue;
        // Hazards use a forgiving inset box: a child who clips the corner of a
        // spike should get away with it.
        const pad = h.pad ?? 8;
        if (b.x < h.x + h.w - pad && b.right > h.x + pad &&
            b.y < h.y + h.h - pad && b.bottom > h.y + pad) {
          this.onHazard?.(h, b);
          break;
        }
      }
    }
  }

  /** Can this body jump right now (grounded, or inside coyote time)? */
  canJump(b) { return b.onGround || b.coyote > 0; }

  /**
   * Launch a jump.
   * @param {Body} b
   * @param {number} apex     world units
   * @param {number} distance world units travelled before returning to launch height
   * @param {number} dir      facing, -1 or 1
   */
  jump(b, apex, distance, dir = 1) {
    const { vy, vx } = solveJump(apex, distance, TUNE.gravity * this.gravityScale, TUNE.fallGravity * this.gravityScale);
    b.vy = vy;
    b.vx = vx * dir;
    b.onGround = false;
    b.ground = null;
    b.coyote = 0;
    b.buffer = 0;
    // A bigger jump gets a proportionally showier flip.
    const power = clamp(apex / 420, 0, 1);
    b.spinVel = power > 0.62 ? dir * (4 + power * TUNE.terminalSpin) : 0;
    return { vy, vx };
  }

  /**
   * Trace where a jump would land. Used to draw the dotted arc preview while
   * the child is charging their voice — the single most important teaching
   * aid in the game, because it makes "louder = further" visible before they
   * commit.
   *
   * @returns {{points: Array<{x,y}>, landing: object|null}}
   */
  predictArc(b, apex, distance, dir = 1, { steps = 70, dt = 1 / 60 } = {}) {
    const { vy, vx } = solveJump(apex, distance, TUNE.gravity * this.gravityScale, TUNE.fallGravity * this.gravityScale);
    let x = b.cx, y = b.y, svy = vy, svx = vx * dir;
    const points = [{ x, y: y + b.h }];
    let landing = null;
    for (let i = 0; i < steps; i++) {
      const g = (svy > 0 ? TUNE.fallGravity : TUNE.gravity) * this.gravityScale;
      svy = Math.min(svy + g * dt, TUNE.maxFall);
      x += svx * dt;
      y += svy * dt;
      const probe = { x: x - b.w / 2, y, w: b.w, h: b.h };
      if (svy > 0) {
        for (const p of this.overlapping(probe)) {
          if (p.kind === KIND.ONEWAY && points[points.length - 1].y > p.y + 2) continue;
          landing = p;
          break;
        }
      }
      points.push({ x, y: y + b.h });
      if (landing) break;
      if (y > this.height + 100) break;
    }
    return { points, landing };
  }
}
