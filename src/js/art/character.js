/**
 * The playable cast: a small skeletal rig drawn with vinyl-toy shading.
 *
 * Original designs — round-headed little adventurers, roughly 2.6 heads tall,
 * chunky enough to read at thumbnail size on a phone.
 *
 * The rig is deliberately simple: a root that can translate, rotate and
 * squash, a head that leads the motion, and four two-segment limbs driven by
 * forward kinematics. That is enough for free-swinging arms and legs, mid-air
 * flips and landing recoil, and it costs almost nothing per frame.
 *
 * Animation is a pure function of (state, clock), so nothing has to be
 * stepped or stored — a caller just draws a character in a state and the pose
 * falls out. Physics owns position; this file owns everything else.
 */

import { ball, ovoid, limb, contactShadow } from "./shading.js";
import { mix, TOKENS } from "../core/palette.js";
import { clamp, lerp } from "../core/engine.js";

/* ----------------------------------------------------------------- cast */

/**
 * Each character is a colourway plus a couple of silhouette choices. Keeping
 * the rig identical across the cast means one animation change improves
 * everyone.
 */
export const CAST = {
  pip: {
    name: "Pip",
    skin: "#FFC48A", hair: "#2A1C18", suit: "#F42B45", cuff: "#FFC61E",
    hairStyle: "tuft", accessory: null,
  },
  nova: {
    name: "Nova",
    skin: "#8A4E28", hair: "#14100E", suit: "#2A86DE", cuff: "#FFFFFF",
    hairStyle: "puffs", accessory: "goggles",
  },
  bolt: {
    name: "Bolt",
    skin: "#FFB877", hair: "#FFC61E", suit: "#5CC22B", cuff: "#14C48A",
    hairStyle: "spikes", accessory: null,
  },
  mim: {
    name: "Mim",
    skin: "#FFD9B0", hair: "#9B5CF6", suit: "#FF4FB4", cuff: "#FFFFFF",
    hairStyle: "bob", accessory: "bow",
  },
  tock: {
    name: "Tock",
    skin: "#CBD7DD", hair: "#6B818C", suit: "#FF5C2B", cuff: "#18242A",
    hairStyle: "antenna", accessory: "bolt",
  },
};

export const CAST_IDS = Object.keys(CAST);

/* ------------------------------------------------------------- the pose */

/**
 * Build a pose for a state. Angles are radians, measured from straight down
 * for legs and straight down for arms, positive = forward (screen right).
 *
 * @param {string} state idle|run|jump|fall|land|cheer|hurt|dizzy|charge|wave|sit
 * @param {number} t     seconds
 * @param {object} o     {power, speed, spin, lookX, lookY, blink}
 */
export function poseFor(state, t, o = {}) {
  const power = o.power ?? 0;
  const speed = o.speed ?? 1;

  const p = {
    rootY: 0, rootRot: 0, squash: { x: 1, y: 1 },
    headRot: 0, headY: 0,
    // arms: [shoulderAngle, elbowBend]
    armL: [0.25, 0.2], armR: [-0.25, 0.2],
    legL: [0.1, 0], legR: [-0.1, 0],
    face: "happy",
    mouthOpen: 0,
    look: { x: o.lookX ?? 0, y: o.lookY ?? 0 },
  };

  switch (state) {
    case "idle": {
      const b = Math.sin(t * 2.3);
      p.rootY = b * 0.012;
      p.headRot = Math.sin(t * 1.7) * 0.06;
      p.squash = { x: 1 - b * 0.012, y: 1 + b * 0.016 };
      p.armL = [0.28 + Math.sin(t * 1.9) * 0.12, 0.22];
      p.armR = [-0.28 - Math.sin(t * 1.9 + 0.6) * 0.12, 0.22];
      break;
    }
    case "run": {
      const c = t * 11 * speed;
      p.rootY = Math.abs(Math.sin(c)) * -0.035;
      p.rootRot = 0.1;
      p.headRot = -0.06 + Math.sin(c * 2) * 0.04;
      // opposing arm/leg swing
      p.legL = [Math.sin(c) * 0.85, Math.max(0, Math.cos(c)) * 0.7];
      p.legR = [Math.sin(c + Math.PI) * 0.85, Math.max(0, Math.cos(c + Math.PI)) * 0.7];
      p.armL = [Math.sin(c + Math.PI) * 0.8, 0.5];
      p.armR = [Math.sin(c) * 0.8, 0.5];
      p.face = "determined";
      break;
    }
    case "jump": {
      p.squash = { x: 0.86, y: 1.18 };
      p.rootRot = -0.06;
      p.headRot = -0.12;
      p.armL = [2.35, 0.15];   // arms thrown up
      p.armR = [-2.35, 0.15];
      p.legL = [0.5, 0.75];    // knees tucked
      p.legR = [0.28, 0.95];
      p.face = "excited";
      p.mouthOpen = 0.55;
      break;
    }
    case "fall": {
      p.squash = { x: 1.05, y: 0.96 };
      p.armL = [1.9, 0.5];
      p.armR = [-1.9, 0.5];
      p.legL = [-0.35, 0.3];
      p.legR = [0.4, 0.25];
      p.headRot = 0.1;
      p.face = "worried";
      p.mouthOpen = 0.3;
      break;
    }
    case "land": {
      // `power` doubles as recoil amount 1 -> 0
      const k = clamp(power, 0, 1);
      p.squash = { x: 1 + k * 0.3, y: 1 - k * 0.26 };
      p.rootY = k * 0.06;
      p.armL = [1.1 + k * 0.6, 0.6];
      p.armR = [-1.1 - k * 0.6, 0.6];
      p.legL = [0.22, k * 1.1];
      p.legR = [-0.22, k * 1.1];
      p.face = "determined";
      break;
    }
    case "cheer": {
      const b = Math.sin(t * 8);
      p.rootY = -Math.abs(b) * 0.07;
      p.squash = { x: 1 - b * 0.03, y: 1 + b * 0.04 };
      p.armL = [2.6 + b * 0.25, 0.1];
      p.armR = [-2.6 - b * 0.25, 0.1];
      p.legL = [0.3, 0.2]; p.legR = [-0.3, 0.2];
      p.headRot = b * 0.1;
      p.face = "joy";
      p.mouthOpen = 0.7;
      break;
    }
    case "hurt": {
      p.rootRot = -0.3;
      p.squash = { x: 1.1, y: 0.92 };
      p.armL = [2.2, 0.3]; p.armR = [-1.4, 0.8];
      p.legL = [-0.6, 0.2]; p.legR = [0.7, 0.4];
      p.face = "hurt";
      p.mouthOpen = 0.6;
      break;
    }
    case "dizzy": {
      p.rootRot = Math.sin(t * 3) * 0.16;
      p.headRot = Math.sin(t * 3 + 1) * 0.22;
      p.armL = [0.9 + Math.sin(t * 4) * 0.3, 0.6];
      p.armR = [-0.9 + Math.sin(t * 4 + 1) * 0.3, 0.6];
      p.face = "dizzy";
      p.mouthOpen = 0.35;
      break;
    }
    case "charge": {
      // Winding up a shout: lean back, fill the lungs, arms cocked.
      const shake = power * 0.02;
      p.rootRot = -0.1 - power * 0.12;
      p.rootY = Math.sin(t * 40) * shake;
      p.squash = { x: 1 + power * 0.1, y: 1 + power * 0.06 };
      p.headRot = -0.18 - power * 0.2;
      p.armL = [0.9 + power * 0.7, 0.9];
      p.armR = [-0.9 - power * 0.7, 0.9];
      p.legL = [0.3, 0.3 + power * 0.3];
      p.legR = [-0.3, 0.3 + power * 0.3];
      p.face = "shout";
      p.mouthOpen = 0.35 + power * 0.65;
      break;
    }
    case "wave": {
      p.armR = [-2.5 + Math.sin(t * 7) * 0.35, 0.25];
      p.armL = [0.3, 0.25];
      p.headRot = Math.sin(t * 2) * 0.08;
      p.face = "joy";
      break;
    }
    case "sit": {
      p.rootY = 0.16;
      p.legL = [1.35, 1.2]; p.legR = [1.2, 1.3];
      p.armL = [0.6, 0.4]; p.armR = [-0.6, 0.4];
      p.face = "happy";
      break;
    }
    case "float": {
      p.rootY = Math.sin(t * 2) * 0.05;
      p.rootRot = Math.sin(t * 1.4) * 0.12;
      p.armL = [1.6 + Math.sin(t * 2.2) * 0.2, 0.3];
      p.armR = [-1.6 - Math.sin(t * 2.2) * 0.2, 0.3];
      p.legL = [0.35, 0.5]; p.legR = [-0.25, 0.4];
      p.face = "happy";
      break;
    }
  }
  if (o.face) p.face = o.face;
  return p;
}

/* -------------------------------------------------------------- the face */

const FACES = {
  happy:      { eye: "open", brow: 0, mouth: "smile" },
  joy:        { eye: "arc", brow: 0.2, mouth: "open" },
  excited:    { eye: "wide", brow: 0.25, mouth: "open" },
  determined: { eye: "narrow", brow: -0.35, mouth: "flat" },
  worried:    { eye: "wide", brow: 0.45, mouth: "small" },
  hurt:       { eye: "shut", brow: 0.5, mouth: "oh" },
  dizzy:      { eye: "spiral", brow: 0.1, mouth: "wobble" },
  shout:      { eye: "narrow", brow: -0.2, mouth: "shout" },
  sleepy:     { eye: "shut", brow: 0.1, mouth: "small" },
  surprised:  { eye: "wide", brow: 0.5, mouth: "oh" },
};

function drawFace(ctx, r, pose, o) {
  const f = FACES[pose.face] || FACES.happy;
  const blink = o.blink ?? 0;
  const look = pose.look;

  const eyeY = -r * 0.06;
  const gap = r * 0.36;
  const baseR = r * 0.2;

  for (const side of [-1, 1]) {
    const ex = side * gap;
    let rx = baseR, ry = baseR;
    if (f.eye === "wide") { rx = baseR * 1.15; ry = baseR * 1.3; }
    else if (f.eye === "narrow") { ry = baseR * 0.62; }
    else if (f.eye === "arc" || f.eye === "shut") { ry = 0; }
    ry *= 1 - blink;

    if (ry < baseR * 0.12) {
      // closed / arc eye — a happy upward curve
      ctx.save();
      ctx.lineWidth = r * 0.075;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#241c1a";
      ctx.beginPath();
      const up = f.eye === "arc" || f.eye === "shut";
      ctx.arc(ex, eyeY + (up ? baseR * 0.3 : 0), baseR * 0.95,
        up ? Math.PI * 1.12 : Math.PI * 0.88,
        up ? Math.PI * 1.88 : Math.PI * 0.12);
      ctx.stroke();
      ctx.restore();
    } else if (f.eye === "spiral") {
      ctx.save();
      ctx.lineWidth = r * 0.055;
      ctx.strokeStyle = "#241c1a";
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.25) {
        const rr = baseR * (a / (Math.PI * 4));
        const x = ex + Math.cos(a) * rr, y = eyeY + Math.sin(a) * rr;
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    } else {
      // white of the eye, then a glossy pupil that tracks `look`
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      const pr = Math.min(rx, ry) * 0.66;
      const px = ex + look.x * rx * 0.36;
      const py = eyeY + look.y * ry * 0.36;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, Math.min(pr, ry * 0.95), 0, 0, Math.PI * 2);
      ctx.fillStyle = "#241c1a";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px - pr * 0.3, py - pr * 0.34, pr * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }

    // brow — the single most expressive line on the face
    if (Math.abs(f.brow) > 0.02) {
      ctx.save();
      ctx.lineWidth = r * 0.075;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#241c1a";
      ctx.beginPath();
      const by = eyeY - baseR * 1.5;
      // positive brow = raised outer / sad-worried, negative = angled in
      ctx.moveTo(ex - side * baseR * 0.85, by + f.brow * baseR * (side === -1 ? -0.7 : -0.7));
      ctx.lineTo(ex + side * baseR * 0.85, by - f.brow * baseR * 0.7);
      ctx.stroke();
      ctx.restore();
    }
  }

  // mouth
  const my = r * 0.42;
  const mw = r * 0.34;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const open = Math.max(pose.mouthOpen ?? 0, f.mouth === "shout" ? 0.5 : 0);
  if (f.mouth === "open" || f.mouth === "oh" || f.mouth === "shout" || open > 0.1) {
    const h = mw * (0.5 + open * 1.25);
    ctx.beginPath();
    ctx.ellipse(0, my + h * 0.1, mw * (f.mouth === "oh" ? 0.55 : 0.8), h * 0.65, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#5c2b2b";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, my + h * 0.42, mw * 0.42, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ef7d8a";
    ctx.fill();
  } else if (f.mouth === "flat") {
    ctx.lineWidth = r * 0.07;
    ctx.strokeStyle = "#241c1a";
    ctx.beginPath();
    ctx.moveTo(-mw * 0.5, my);
    ctx.lineTo(mw * 0.5, my);
    ctx.stroke();
  } else if (f.mouth === "wobble") {
    ctx.lineWidth = r * 0.065;
    ctx.strokeStyle = "#241c1a";
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = -mw * 0.6 + (i / 8) * mw * 1.2;
      const y = my + (i % 2 ? -1 : 1) * mw * 0.13;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    ctx.lineWidth = r * 0.07;
    ctx.strokeStyle = "#241c1a";
    ctx.beginPath();
    ctx.arc(0, my - mw * 0.35, mw * (f.mouth === "small" ? 0.42 : 0.62), 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHair(ctx, r, c) {
  const hair = c.hair;
  const dark = mix(hair, "#000000", 0.25);
  switch (c.hairStyle) {
    case "tuft":
      ctx.save();
      ctx.translate(0, -r * 0.92);
      ctx.rotate(-0.35);
      ovoid(ctx, 0, 0, r * 0.16, r * 0.34, hair, 0, { specular: false });
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.005, Math.PI * 1.06, Math.PI * 1.94);
      ctx.fillStyle = hair; ctx.fill();
      break;
    case "puffs":
      ball(ctx, -r * 0.92, -r * 0.62, r * 0.42, hair, { specular: false });
      ball(ctx, r * 0.92, -r * 0.62, r * 0.42, hair, { specular: false });
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.005, Math.PI * 1.0, Math.PI * 2.0);
      ctx.fillStyle = hair; ctx.fill();
      break;
    case "spikes":
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(i * r * 0.36, -r * 0.82);
        ctx.rotate(i * 0.3);
        ctx.beginPath();
        ctx.moveTo(-r * 0.17, r * 0.2);
        ctx.lineTo(0, -r * 0.42);
        ctx.lineTo(r * 0.17, r * 0.2);
        ctx.closePath();
        ctx.fillStyle = i % 2 ? dark : hair;
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.005, Math.PI * 1.04, Math.PI * 1.96);
      ctx.fillStyle = hair; ctx.fill();
      break;
    case "bob":
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.08, r * 1.12, r * 1.08, 0, Math.PI * 0.98, Math.PI * 2.02);
      ctx.fillStyle = hair; ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-r * 0.98, r * 0.12, r * 0.22, r * 0.5, 0.1, 0, Math.PI * 2);
      ctx.fillStyle = hair; ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.98, r * 0.12, r * 0.22, r * 0.5, -0.1, 0, Math.PI * 2);
      ctx.fillStyle = hair; ctx.fill();
      break;
    case "antenna":
      ctx.save();
      ctx.lineWidth = r * 0.1;
      ctx.lineCap = "round";
      ctx.strokeStyle = dark;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(0, -r * 1.42);
      ctx.stroke();
      ctx.restore();
      ball(ctx, 0, -r * 1.5, r * 0.19, TOKENS.macaw);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.005, Math.PI * 1.08, Math.PI * 1.92);
      ctx.fillStyle = hair; ctx.fill();
      break;
  }
}

function drawAccessory(ctx, r, c) {
  if (c.accessory === "goggles") {
    ctx.save();
    ctx.translate(0, -r * 0.62);
    ctx.lineWidth = r * 0.13;
    ctx.strokeStyle = mix(c.suit, "#000000", 0.35);
    ctx.beginPath();
    ctx.moveTo(-r * 1.0, 0); ctx.lineTo(r * 1.0, 0);
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.42, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(160,230,255,0.75)";
      ctx.fill();
      ctx.lineWidth = r * 0.09;
      ctx.strokeStyle = mix(c.suit, "#000000", 0.45);
      ctx.stroke();
    }
    ctx.restore();
  } else if (c.accessory === "bow") {
    ctx.save();
    ctx.translate(r * 0.78, -r * 0.72);
    ctx.rotate(-0.3);
    for (const s of [-1, 1]) ovoid(ctx, s * r * 0.24, 0, r * 0.24, r * 0.17, c.cuff, s * 0.4);
    ball(ctx, 0, 0, r * 0.11, mix(c.cuff, "#000000", 0.2), { specular: false });
    ctx.restore();
  } else if (c.accessory === "bolt") {
    ctx.save();
    ctx.translate(0, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.3); ctx.lineTo(r * 0.06, -r * 0.05);
    ctx.lineTo(-r * 0.02, -r * 0.05); ctx.lineTo(r * 0.1, r * 0.3);
    ctx.lineTo(-r * 0.04, r * 0.02); ctx.lineTo(r * 0.03, r * 0.02);
    ctx.closePath();
    ctx.fillStyle = TOKENS.bee;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.restore();
  }
}

/* ------------------------------------------------------------ the draw */

/**
 * Draw a character standing with its feet at (cx, groundY).
 *
 * @param {object} o
 * @param {string}  [o.cast]     id from CAST
 * @param {string}  [o.state]    animation state
 * @param {number}  [o.t]        clock seconds
 * @param {number}  [o.flip]     1 or -1, facing
 * @param {number}  [o.power]    0..1, state-specific intensity
 * @param {number}  [o.spin]     extra body rotation in radians (flips)
 * @param {number}  [o.airborne] 0..1, fades the contact shadow
 */
export function drawCharacter(ctx, cx, groundY, h, o = {}) {
  let c = typeof o.cast === "object" ? o.cast : (CAST[o.cast] ?? CAST.pip);
  if (o.silhouette) {
    const K = "#05090B";
    c = { ...c, skin: K, hair: K, suit: K, cuff: K, accessory: null };
  }
  const t = o.t ?? 0;
  const flip = o.flip ?? 1;
  const pose = o.pose ?? poseFor(o.state ?? "idle", t, o);

  // Proportions, in units of total height.
  const headR = h * 0.225;
  const hipY = -h * 0.35;
  const shoulderY = -h * 0.585;
  const torsoTop = -h * 0.625;
  const headC = -h * 0.775;
  const legLen = h * 0.17;     // per segment
  const armLen = h * 0.165;    // per segment
  const torsoW = h * 0.195;

  if (o.shadow !== false) contactShadow(ctx, cx, groundY, h * 0.34, o.airborne ?? 0);

  // Separation pass: the same rig drawn slightly larger in near-black, behind
  // everything. On saturated backdrops a mid-tone character otherwise sinks
  // into the scene; this is cheaper and cleaner than outlining every part.
  if (o.rim !== false && !o._isRim) {
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.translate(cx, groundY);
    ctx.scale(1.075, 1.075);
    ctx.translate(-cx, -groundY);
    ctx.filter = "none";
    drawCharacter(ctx, cx, groundY, h, { ...o, _isRim: true, shadow: false, rim: false, silhouette: true });
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, groundY + pose.rootY * h);
  ctx.scale(flip, 1);
  // A mid-air flip turns about the body's centre of mass. Rotating about the
  // feet instead sends the head through the floor on anything past 90 degrees.
  const spin = o.spin ?? 0;
  if (spin) {
    const pivot = -h * 0.45;
    ctx.translate(0, pivot);
    ctx.rotate(spin);
    ctx.translate(0, -pivot);
  }
  // The lean and the squash both belong at the feet, where the weight is.
  ctx.rotate(pose.rootRot);
  ctx.scale(pose.squash.x, pose.squash.y);

  const limbW = h * 0.092;

  /** Two-segment limb; returns the end point. */
  const chain = (ox, oy, angle, bend, len, w, color, footColor, footR) => {
    const kx = ox + Math.sin(angle) * len;
    const ky = oy + Math.cos(angle) * len;
    const a2 = angle - bend;
    const ex = kx + Math.sin(a2) * len;
    const ey = ky + Math.cos(a2) * len;
    limb(ctx, ox, oy, kx, ky, w, color);
    limb(ctx, kx, ky, ex, ey, w * 0.92, color);
    if (footColor) ball(ctx, ex, ey, footR, footColor);
    return { x: ex, y: ey };
  };

  // back limbs first so the torso overlaps them
  chain(-torsoW * 0.5, hipY, pose.legR[0], pose.legR[1], legLen, limbW,
    mix(c.suit, "#000000", 0.28), mix(c.cuff, "#000000", 0.2), limbW * 0.72);
  chain(-torsoW * 0.9, shoulderY, pose.armR[0], pose.armR[1], armLen, limbW * 0.86,
    mix(c.skin, "#000000", 0.2), mix(c.skin, "#000000", 0.18), limbW * 0.62);

  // torso — an ovoid that tapers up into the shoulders
  ovoid(ctx, 0, (hipY + torsoTop) / 2, torsoW * 1.15, (hipY - torsoTop) / 2 + h * 0.03, c.suit);
  // chest badge, gives the suit some read at small sizes
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, (hipY + torsoTop) / 2 - h * 0.02, torsoW * 0.44, torsoW * 0.44, 0, 0, Math.PI * 2);
  ctx.fillStyle = c.cuff;
  ctx.globalAlpha = 0.95;
  ctx.fill();
  ctx.restore();

  // front limbs
  chain(torsoW * 0.5, hipY, pose.legL[0], pose.legL[1], legLen, limbW, c.suit, c.cuff, limbW * 0.75);
  chain(torsoW * 0.9, shoulderY, pose.armL[0], pose.armL[1], armLen, limbW * 0.86, c.skin, c.skin, limbW * 0.65);

  // head
  ctx.save();
  ctx.translate(0, headC + pose.headY * h);
  ctx.rotate(pose.headRot);
  ball(ctx, 0, 0, headR, c.skin);
  // ears
  ball(ctx, -headR * 0.98, headR * 0.1, headR * 0.2, mix(c.skin, "#000000", 0.08), { specular: false });
  ball(ctx, headR * 0.98, headR * 0.1, headR * 0.2, mix(c.skin, "#000000", 0.08), { specular: false });
  drawHair(ctx, headR, c);
  // cheeks — a warm blush that lifts every expression
  if (!o.silhouette) {
    ctx.save();
    ctx.globalAlpha = 0.34;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * headR * 0.6, headR * 0.26, headR * 0.19, headR * 0.13, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#FF6B7A";
      ctx.fill();
    }
    ctx.restore();
  }
  if (!o.silhouette) { drawFace(ctx, headR, pose, o); drawAccessory(ctx, headR, c); }
  ctx.restore();

  ctx.restore();
}

/** Blink scheduling: call with a per-character seed for natural, offset blinks. */
export function blinkAt(t, seed = 0) {
  const period = 3.4 + (seed % 7) * 0.31;
  const phase = (t + seed * 1.7) % period;
  return phase < 0.13 ? Math.sin((phase / 0.13) * Math.PI) : 0;
}
