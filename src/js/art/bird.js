/**
 * The playable bird.
 *
 * Built to read at a glance on a phone: a fat white body, one black dot of an
 * eye, a hard orange wedge of a beak and a red comb. Simple, high-contrast
 * shapes — the kind of silhouette a four-year-old recognises instantly and
 * can still find on screen while it is mid-flight over water.
 *
 * Deliberately NOT a soft shaded character. Flat fills with a dark under-edge
 * hold up against saturated backdrops; gradients turn to mush.
 *
 * Everything animates: the body squashes and stretches, the wings beat, the
 * legs cycle, the comb and tail lag behind the body, and the head leads every
 * movement. Nothing here is ever still.
 */

import { C, mix, alpha } from "../core/palette.js";
import { fillRound, roundRect, circle, ellipse } from "../core/draw.js";
import { clamp } from "../core/engine.js";

/** Colour variants the child can pick between. */
export const BIRDS = {
  chick: { name: "Chick", body: "#FFFFFF", shade: "#D9DEE3", beak: "#FFB020", comb: "#F42B45", leg: "#FFB020", eye: "#141A1D" },
  sunny: { name: "Sunny", body: "#FFD84D", shade: "#E0A81F", beak: "#FF7A1A", comb: "#F42B45", leg: "#FF7A1A", eye: "#141A1D" },
  berry: { name: "Berry", body: "#FF6FC1", shade: "#D63D96", beak: "#FFC61E", comb: "#8E1E5C", leg: "#FFC61E", eye: "#141A1D" },
  sky:   { name: "Sky",   body: "#5BC8FF", shade: "#2A8FD1", beak: "#FFC61E", comb: "#FF5C2B", leg: "#FFC61E", eye: "#141A1D" },
  mint:  { name: "Mint",  body: "#7BEBC0", shade: "#2FB98C", beak: "#FFB020", comb: "#FF5C2B", leg: "#FFB020", eye: "#141A1D" },
};

export const BIRD_IDS = Object.keys(BIRDS);

/**
 * @param {number} cx        centre x
 * @param {number} groundY   the y its feet stand on
 * @param {number} h         body height in world units
 * @param {object} o
 * @param {string} [o.bird]  key from BIRDS
 * @param {string} [o.state] idle|run|jump|fall|land|charge|cheer|hurt
 * @param {number} [o.t]     clock seconds
 * @param {number} [o.power] 0..1 — puffs the body while charging a shout
 * @param {number} [o.spin]  body rotation for flips
 */
export function drawBird(ctx, cx, groundY, h, o = {}) {
  const B = typeof o.bird === "object" ? o.bird : (BIRDS[o.bird] ?? BIRDS.chick);
  const t = o.t ?? 0;
  const state = o.state ?? "idle";
  const flip = o.flip ?? 1;
  const power = clamp(o.power ?? 0, 0, 1);
  const spin = o.spin ?? 0;

  // --- pose ---------------------------------------------------------------
  let sx = 1, sy = 1, lean = 0, headLift = 0, wing = 0, legCycle = 0, beakOpen = 0, eyeMode = "open";
  let bob = 0;

  switch (state) {
    case "idle":
      bob = Math.sin(t * 3) * h * 0.022;
      sy = 1 + Math.sin(t * 3) * 0.03;
      sx = 1 - Math.sin(t * 3) * 0.03;
      wing = Math.sin(t * 2.2) * 0.12;
      break;
    case "run":
      bob = Math.abs(Math.sin(t * 14)) * -h * 0.05;
      lean = 0.16;
      legCycle = t * 14;
      wing = Math.sin(t * 16) * 0.5;
      sy = 1 + Math.sin(t * 28) * 0.04;
      break;
    case "jump":
      sx = 0.84; sy = 1.2;
      lean = -0.12; headLift = -h * 0.03;
      wing = -1.15 + Math.sin(t * 26) * 0.35;   // frantic flapping
      beakOpen = 0.5;
      eyeMode = "wide";
      break;
    case "fall":
      sx = 1.08; sy = 0.93;
      lean = 0.2;
      wing = -0.5 + Math.sin(t * 20) * 0.5;
      beakOpen = 0.35;
      eyeMode = "wide";
      break;
    case "land":
      sx = 1 + power * 0.34; sy = 1 - power * 0.3;
      wing = 0.6 * power;
      break;
    case "charge": {
      // Puff up and lean back, shaking harder the more charge is stored.
      const shake = power * h * 0.012;
      sx = 1 + power * 0.22; sy = 1 + power * 0.14;
      lean = -0.1 - power * 0.18;
      bob = Math.sin(t * 46) * shake;
      wing = -0.3 - power * 0.7;
      beakOpen = 0.25 + power * 0.75;
      eyeMode = power > 0.6 ? "squint" : "open";
      break;
    }
    case "cheer":
      bob = -Math.abs(Math.sin(t * 9)) * h * 0.12;
      wing = -1.5 - Math.sin(t * 18) * 0.4;
      beakOpen = 0.6;
      eyeMode = "happy";
      sy = 1 + Math.sin(t * 18) * 0.05;
      break;
    case "hurt":
      lean = -0.5;
      sx = 1.12; sy = 0.9;
      wing = 0.9;
      beakOpen = 0.7;
      eyeMode = "x";
      break;
  }

  const bw = h * 0.92;              // body width
  const bh = h * 0.8;               // body height
  const cy = groundY - h * 0.5 + bob;
  const airborne = clamp(o.airborne ?? 0, 0, 1);

  // --- contact shadow -----------------------------------------------------
  if (o.shadow !== false) {
    ctx.save();
    ctx.globalAlpha = 0.3 * (1 - airborne * 0.65);
    ellipse(ctx, cx, groundY + 2, bw * 0.46 * (1 - airborne * 0.3), bw * 0.15, "#000000");
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, cy);
  if (spin) ctx.rotate(spin);
  ctx.rotate(lean * flip);
  ctx.scale(flip * sx, sy);

  // --- legs (behind the body) --------------------------------------------
  const legY = bh * 0.42;
  for (const side of [-1, 1]) {
    const swing = state === "run" ? Math.sin(legCycle + (side > 0 ? 0 : Math.PI)) * h * 0.14 : 0;
    const tuck = (state === "jump" || state === "fall") ? h * 0.06 : 0;
    const lx = side * bw * 0.16 + swing;
    ctx.save();
    ctx.lineWidth = h * 0.055;
    ctx.lineCap = "round";
    ctx.strokeStyle = mix(B.leg, "#000000", 0.25);
    ctx.beginPath();
    ctx.moveTo(side * bw * 0.14, legY);
    ctx.lineTo(lx, legY + h * 0.2 - tuck);
    ctx.stroke();
    // three-toed foot
    ctx.lineWidth = h * 0.042;
    ctx.strokeStyle = B.leg;
    for (const toe of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(lx, legY + h * 0.2 - tuck);
      ctx.lineTo(lx + toe * h * 0.075, legY + h * 0.255 - tuck);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- tail (lags behind the body) ---------------------------------------
  const tailLag = Math.sin(t * 6) * 0.12 + (state === "run" ? 0.25 : 0);
  ctx.save();
  // Overlaps the body by design — a tail that starts outside the silhouette
  // reads as a separate floating shape.
  ctx.translate(-bw * 0.34, -bh * 0.02);
  ctx.rotate(-0.3 + tailLag);
  ctx.beginPath();
  ctx.moveTo(bw * 0.06, -bh * 0.18);
  ctx.quadraticCurveTo(-bw * 0.2, -bh * 0.3, -bw * 0.22, -bh * 0.06);
  ctx.quadraticCurveTo(-bw * 0.2, bh * 0.14, bw * 0.06, bh * 0.1);
  ctx.closePath();
  ctx.fillStyle = mix(B.shade, "#000000", 0.12);
  ctx.fill();
  ctx.restore();

  // --- body: a fat rounded rectangle, wider at the bottom ----------------
  const bodyPath = () => {
    roundRect(ctx, -bw / 2, -bh / 2, bw, bh, {
      tl: bw * 0.46, tr: bw * 0.46, br: bw * 0.36, bl: bw * 0.36,
    });
  };
  // dark under-edge for separation
  ctx.save();
  ctx.translate(0, h * 0.035);
  bodyPath();
  ctx.fillStyle = mix(B.shade, "#000000", 0.35);
  ctx.fill();
  ctx.restore();

  bodyPath();
  ctx.fillStyle = B.body;
  ctx.fill();

  // belly shading on the lower-right
  ctx.save();
  bodyPath();
  ctx.clip();
  ctx.fillStyle = B.shade;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(bw * 0.3, bh * 0.36, bw * 0.55, bh * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- comb (three bumps, lagging) ---------------------------------------
  const combLag = Math.sin(t * 7) * 0.1;
  ctx.save();
  ctx.translate(bw * 0.06, -bh * 0.5);
  ctx.rotate(combLag);
  ctx.fillStyle = B.comb;
  for (let i = 0; i < 3; i++) {
    circle(ctx, (i - 1) * bw * 0.12, -bw * 0.04 - (i === 1 ? bw * 0.05 : 0), bw * 0.088, B.comb);
  }
  ctx.restore();

  // --- wing (beats) -------------------------------------------------------
  ctx.save();
  ctx.translate(bw * 0.04, -bh * 0.02);
  ctx.rotate(wing);
  ctx.beginPath();
  ctx.ellipse(0, bh * 0.08, bw * 0.26, bh * 0.2, -0.25, 0, Math.PI * 2);
  ctx.fillStyle = B.shade;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-bw * 0.03, bh * 0.04, bw * 0.19, bh * 0.14, -0.25, 0, Math.PI * 2);
  ctx.fillStyle = mix(B.body, B.shade, 0.35);
  ctx.fill();
  ctx.restore();

  // --- beak ---------------------------------------------------------------
  const beakX = bw * 0.44, beakY = -bh * 0.1 + headLift;
  const bl = bw * 0.3, bhh = bh * 0.13;
  ctx.fillStyle = B.beak;
  ctx.beginPath();
  ctx.moveTo(beakX - bw * 0.06, beakY - bhh);
  ctx.lineTo(beakX + bl, beakY - bhh * beakOpen * 1.6);
  ctx.lineTo(beakX - bw * 0.06, beakY + bhh * 0.15);
  ctx.closePath();
  ctx.fill();
  if (beakOpen > 0.04) {
    ctx.fillStyle = mix(B.beak, "#000000", 0.32);
    ctx.beginPath();
    ctx.moveTo(beakX - bw * 0.06, beakY + bhh * 0.15);
    ctx.lineTo(beakX + bl * 0.92, beakY + bhh * beakOpen * 1.5);
    ctx.lineTo(beakX - bw * 0.06, beakY + bhh);
    ctx.closePath();
    ctx.fill();
  }

  // --- eye ----------------------------------------------------------------
  const ex = bw * 0.24, ey = -bh * 0.2 + headLift;
  const er = bw * 0.085;
  if (eyeMode === "x") {
    ctx.save();
    ctx.lineWidth = er * 0.7;
    ctx.lineCap = "round";
    ctx.strokeStyle = B.eye;
    ctx.beginPath();
    ctx.moveTo(ex - er, ey - er); ctx.lineTo(ex + er, ey + er);
    ctx.moveTo(ex + er, ey - er); ctx.lineTo(ex - er, ey + er);
    ctx.stroke();
    ctx.restore();
  } else if (eyeMode === "happy") {
    ctx.save();
    ctx.lineWidth = er * 0.62;
    ctx.lineCap = "round";
    ctx.strokeStyle = B.eye;
    ctx.beginPath();
    ctx.arc(ex, ey + er * 0.4, er * 1.05, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();
  } else {
    const rx = eyeMode === "wide" ? er * 1.25 : er;
    const ry = eyeMode === "squint" ? er * 0.5 : (eyeMode === "wide" ? er * 1.3 : er);
    const blink = o.blink ?? 0;
    if (blink > 0.55) {
      ctx.save();
      ctx.lineWidth = er * 0.55;
      ctx.lineCap = "round";
      ctx.strokeStyle = B.eye;
      ctx.beginPath();
      ctx.moveTo(ex - er, ey); ctx.lineTo(ex + er, ey);
      ctx.stroke();
      ctx.restore();
    } else {
      if (eyeMode === "wide") ellipse(ctx, ex, ey, rx * 1.35, ry * 1.35, "#FFFFFF");
      ellipse(ctx, ex, ey, rx, ry, B.eye);
      circle(ctx, ex + rx * 0.3, ey - ry * 0.34, rx * 0.34, "#FFFFFF");
    }
  }

  // --- cheek puff while charging -----------------------------------------
  if (power > 0.08 && state === "charge") {
    ctx.save();
    ctx.globalAlpha = 0.45 * power;
    ellipse(ctx, bw * 0.16, ey + bh * 0.16, bw * 0.13 * (1 + power), bh * 0.1 * (1 + power), "#FF6B7A");
    ctx.restore();
  }

  ctx.restore();
}

/** Natural, offset blinking. */
export function birdBlink(t, seed = 0) {
  const period = 3.1 + (seed % 5) * 0.4;
  const phase = (t + seed * 1.3) % period;
  return phase < 0.14 ? 1 : 0;
}
