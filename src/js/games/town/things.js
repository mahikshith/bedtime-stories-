/**
 * Tinker Town — the things you can pick up.
 *
 * Every object here is (a) drawable at any size, (b) nameable out loud, and
 * (c) carryable into any scene. That last property is the important one: it
 * turns four rooms into four rooms' worth of combinations, and it is what
 * makes a sandbox feel like a world rather than a set of screens.
 *
 * Each entry carries `name` because the game SPEAKS whatever a child touches.
 * That is the whole educational layer — no quiz, no score, just the word for
 * the thing you are holding, every single time. A sandbox that names its own
 * contents teaches vocabulary without introducing a goal.
 *
 * `tags` drive the reaction rules in rules.js, so a rule can say "any food"
 * rather than listing every edible thing.
 */

import { C, alpha, mix } from "../../core/palette.js";
import { fillRound, roundRect, circle, ellipse, text } from "../../core/draw.js";

/* Drawing helpers shared by the atlas; every thing is drawn centred on (0,0)
   in a box of `s` units, so one number scales anything. */
const cap = (ctx, x1, y1, x2, y2, w, col) => {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = w;
  ctx.strokeStyle = col;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
};
/** A solid shape with a darker underside — the app's standard chunky look. */
const solid = (ctx, draw, face, edge) => {
  ctx.save();
  ctx.translate(0, 3);
  ctx.fillStyle = edge; draw(ctx); ctx.fill();
  ctx.restore();
  ctx.fillStyle = face; draw(ctx); ctx.fill();
};
const gloss = (ctx, x, y, rx, ry, a = 0.45) => {
  ctx.save();
  ctx.globalAlpha = a;
  ellipse(ctx, x, y, rx, ry, "#FFFFFF");
  ctx.restore();
};

export const THINGS = {
  /* ------------------------------------------------------------ kitchen */
  pot: {
    name: "pot", tags: ["vessel", "cookware"], w: 0.9,
    draw(ctx, s, st = {}) {
      const r = s * 0.34;
      solid(ctx, (c) => { c.beginPath(); roundRect(c, -r, -r * 0.55, r * 2, r * 1.5, 8); },
        C.slate.base, C.slate.deep);
      fillRound(ctx, -r * 1.15, -r * 0.7, r * 2.3, r * 0.34, 6, C.slate.light);
      cap(ctx, -r * 1.3, -r * 0.35, -r * 1.05, -r * 0.35, 7, C.slate.dark);
      cap(ctx, r * 1.05, -r * 0.35, r * 1.3, -r * 0.35, 7, C.slate.dark);
      if (st.full && !st.hot) ellipse(ctx, 0, -r * 0.5, r * 0.85, r * 0.26, C.sea.light);
      if (st.hot) {
        // soup surface + steam, so "it is cooking" is visible at a glance
        ellipse(ctx, 0, -r * 0.5, r * 0.85, r * 0.26, st.soup ? C.flame.base : C.sea.light);
        ctx.save();
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 3; i++) {
          const yy = -r * 0.9 - ((st.t * 30 + i * 22) % 44);
          circle(ctx, (i - 1) * r * 0.4, yy, r * 0.2, "#FFFFFF");
        }
        ctx.restore();
      }
    },
  },
  cup: {
    name: "cup", tags: ["vessel"], w: 0.55,
    draw(ctx, s, st = {}) {
      const r = s * 0.2;
      solid(ctx, (c) => { c.beginPath(); roundRect(c, -r, -r, r * 2, r * 2.1, { tl: 4, tr: 4, br: 10, bl: 10 }); },
        C.sea.base, C.sea.deep);
      ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = C.sea.dark;
      ctx.beginPath(); ctx.arc(r * 1.1, r * 0.2, r * 0.6, -1, 1.6); ctx.stroke(); ctx.restore();
      ellipse(ctx, 0, -r * 0.85, r * 0.85, r * 0.3, st.full ? C.sky.light : C.bone.light);
      if (st.full) {
        // A cup that is carrying water has to LOOK like it is, or crossing two
        // rooms to fetch some reads as nothing having happened.
        ellipse(ctx, 0, -r * 0.88, r * 0.66, r * 0.22, C.sea.light);
        ctx.save(); ctx.globalAlpha = 0.7;
        ellipse(ctx, -r * 0.22, -r * 0.95, r * 0.2, r * 0.07, "#FFFFFF");
        ctx.restore();
      }
      gloss(ctx, -r * 0.4, 0, r * 0.2, r * 0.6, 0.3);
    },
  },
  apple: {
    name: "apple", tags: ["food", "fruit"], w: 0.5,
    draw(ctx, s) {
      const r = s * 0.2;
      solid(ctx, (c) => {
        c.beginPath();
        c.arc(-r * 0.35, 0, r * 0.8, 0, Math.PI * 2);
        c.arc(r * 0.35, 0, r * 0.8, 0, Math.PI * 2);
      }, C.cherry.base, C.cherry.deep);
      cap(ctx, 0, -r * 0.7, r * 0.15, -r * 1.5, 5, C.bark.dark);
      ellipse(ctx, r * 0.55, -r * 1.4, r * 0.4, r * 0.22, C.grass.base);
      gloss(ctx, -r * 0.5, -r * 0.4, r * 0.24, r * 0.34);
    },
  },
  bread: {
    name: "bread", tags: ["food"], w: 0.6,
    draw(ctx, s, st = {}) {
      const r = s * 0.24;
      solid(ctx, (c) => { c.beginPath(); roundRect(c, -r * 1.2, -r * 0.8, r * 2.4, r * 1.6, { tl: 22, tr: 22, br: 7, bl: 7 }); },
        st.toasted ? C.clay.dark : C.clay.base, st.toasted ? "#5E330A" : C.clay.deep);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = C.clay.light; ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * r * 0.6, -r * 0.55); ctx.lineTo(i * r * 0.6 + r * 0.2, -r * 0.1); ctx.stroke();
      }
      ctx.restore();
    },
  },
  egg: {
    name: "egg", tags: ["food"], w: 0.42,
    draw(ctx, s, st = {}) {
      const r = s * 0.17;
      if (st.cooked) {
        ellipse(ctx, 0, 0, r * 1.5, r * 1.1, C.bone.light);
        ellipse(ctx, 0, 0, r * 0.55, r * 0.55, C.sun.base);
        return;
      }
      solid(ctx, (c) => { c.beginPath(); c.ellipse(0, 0, r * 0.82, r * 1.05, 0, 0, Math.PI * 2); },
        C.bone.light, C.bone.dark);
      gloss(ctx, -r * 0.25, -r * 0.35, r * 0.2, r * 0.3, 0.6);
    },
  },
  carrot: {
    name: "carrot", tags: ["food", "vegetable", "plantable"], w: 0.5,
    draw(ctx, s) {
      const r = s * 0.2;
      solid(ctx, (c) => {
        c.beginPath(); c.moveTo(-r * 0.5, -r * 0.7); c.lineTo(r * 0.5, -r * 0.7);
        c.lineTo(0, r * 1.5); c.closePath();
      }, C.flame.base, C.flame.deep);
      for (let i = -1; i <= 1; i++) ellipse(ctx, i * r * 0.4, -r * 1.05, r * 0.26, r * 0.5, C.grass.base);
    },
  },
  fish: {
    name: "fish", tags: ["food", "animal"], w: 0.6,
    draw(ctx, s) {
      const r = s * 0.22;
      solid(ctx, (c) => {
        c.beginPath(); c.ellipse(0, 0, r * 1.1, r * 0.66, 0, 0, Math.PI * 2);
      }, C.sea.base, C.sea.deep);
      ctx.beginPath();
      ctx.moveTo(-r * 1.0, 0); ctx.lineTo(-r * 1.6, -r * 0.5); ctx.lineTo(-r * 1.6, r * 0.5);
      ctx.closePath(); ctx.fillStyle = C.sea.dark; ctx.fill();
      circle(ctx, r * 0.5, -r * 0.15, r * 0.16, "#FFFFFF");
      circle(ctx, r * 0.53, -r * 0.13, r * 0.08, "#16202A");
    },
  },
  cake: {
    name: "cake", tags: ["food", "treat"], w: 0.66,
    draw(ctx, s) {
      const r = s * 0.24;
      solid(ctx, (c) => { c.beginPath(); roundRect(c, -r, -r * 0.2, r * 2, r * 1.2, 6); },
        C.clay.base, C.clay.deep);
      fillRound(ctx, -r * 1.05, -r * 0.6, r * 2.1, r * 0.5, 8, C.candy.base);
      for (let i = -1; i <= 1; i++) circle(ctx, i * r * 0.55, -r * 0.35, r * 0.12, C.sun.base);
      cap(ctx, 0, -r * 0.65, 0, -r * 1.25, 5, C.sun.light);
      circle(ctx, 0, -r * 1.35, r * 0.16, C.flame.base);
    },
  },

  /* ------------------------------------------------------------- garden */
  seed: {
    name: "seed", tags: ["plantable", "tiny"], w: 0.3,
    draw(ctx, s) {
      const r = s * 0.1;
      solid(ctx, (c) => { c.beginPath(); c.ellipse(0, 0, r, r * 1.35, 0.4, 0, Math.PI * 2); },
        C.bark.base, C.bark.deep);
      gloss(ctx, -r * 0.3, -r * 0.4, r * 0.25, r * 0.4, 0.4);
    },
  },
  sprout: {
    name: "sprout", tags: ["plant"], w: 0.45,
    draw(ctx, s) {
      const r = s * 0.18;
      cap(ctx, 0, r * 1.1, 0, -r * 0.4, 6, C.grass.dark);
      ellipse(ctx, -r * 0.55, -r * 0.55, r * 0.55, r * 0.3, C.grass.base);
      ellipse(ctx, r * 0.55, -r * 0.7, r * 0.5, r * 0.28, C.grass.light);
    },
  },
  flower: {
    name: "flower", tags: ["plant", "pretty"], w: 0.55,
    draw(ctx, s, st = {}) {
      const r = s * 0.2;
      const col = [C.cherry, C.candy, C.grape, C.sun][(st.hue ?? 0) % 4];
      cap(ctx, 0, r * 1.6, 0, -r * 0.2, 6, C.grass.dark);
      ellipse(ctx, -r * 0.6, r * 0.5, r * 0.5, r * 0.26, C.grass.base);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ellipse(ctx, Math.cos(a) * r * 0.62, -r * 0.3 + Math.sin(a) * r * 0.62, r * 0.42, r * 0.34, col.base);
      }
      circle(ctx, 0, -r * 0.3, r * 0.34, C.sun.base);
    },
  },
  can: {
    name: "watering can", tags: ["tool", "waters"], w: 0.75,
    draw(ctx, s) {
      const r = s * 0.24;
      solid(ctx, (c) => { c.beginPath(); roundRect(c, -r, -r * 0.6, r * 1.9, r * 1.5, 8); },
        C.jade.base, C.jade.deep);
      cap(ctx, r * 0.9, -r * 0.3, r * 1.7, -r * 0.95, 8, C.jade.dark);
      ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = C.jade.dark;
      ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.75, r * 0.55, Math.PI, Math.PI * 2); ctx.stroke(); ctx.restore();
      circle(ctx, r * 1.75, -r * 1.0, r * 0.22, C.jade.light);
    },
  },
  mushroom: {
    name: "mushroom", tags: ["plant"], w: 0.5,
    draw(ctx, s) {
      const r = s * 0.2;
      solid(ctx, (c) => { c.beginPath(); roundRect(c, -r * 0.34, -r * 0.1, r * 0.68, r * 1.2, 6); },
        C.bone.light, C.bone.dark);
      solid(ctx, (c) => { c.beginPath(); c.arc(0, 0, r, Math.PI, 0); c.closePath(); },
        C.cherry.base, C.cherry.deep);
      for (let i = -1; i <= 1; i++) circle(ctx, i * r * 0.46, -r * 0.3, r * 0.17, "#FFFFFF");
    },
  },
  stone: {
    name: "stone", tags: ["heavy"], w: 0.5,
    draw(ctx, s) {
      const r = s * 0.2;
      solid(ctx, (c) => {
        c.beginPath(); c.moveTo(-r, r * 0.5); c.lineTo(-r * 0.6, -r * 0.6);
        c.lineTo(r * 0.4, -r * 0.8); c.lineTo(r, r * 0.4); c.closePath();
      }, "#8B96A0", "#4A555F");
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#B8C2CA";
      ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.6); ctx.lineTo(r * 0.4, -r * 0.8);
      ctx.lineTo(r * 0.1, -r * 0.1); ctx.closePath(); ctx.fill();
      ctx.restore();
      gloss(ctx, -r * 0.25, -r * 0.45, r * 0.26, r * 0.14, 0.4);
    },
  },

  /* --------------------------------------------------------------- bath */
  soap: {
    name: "soap", tags: ["bubbly"], w: 0.45,
    draw(ctx, s) {
      const r = s * 0.17;
      solid(ctx, (c) => { c.beginPath(); roundRect(c, -r * 1.1, -r * 0.6, r * 2.2, r * 1.2, 10); },
        C.candy.base, C.candy.deep);
      gloss(ctx, -r * 0.35, -r * 0.2, r * 0.45, r * 0.2, 0.55);
    },
  },
  duck: {
    name: "duck", tags: ["toy", "floats"], w: 0.5,
    draw(ctx, s) {
      const r = s * 0.19;
      solid(ctx, (c) => { c.beginPath(); c.ellipse(-r * 0.15, r * 0.3, r * 0.95, r * 0.66, 0, 0, Math.PI * 2); },
        C.sun.base, C.sun.deep);
      circle(ctx, r * 0.55, -r * 0.45, r * 0.5, C.sun.base);
      ctx.beginPath();
      ctx.moveTo(r * 0.95, -r * 0.45); ctx.lineTo(r * 1.6, -r * 0.3); ctx.lineTo(r * 0.95, -r * 0.15);
      ctx.closePath(); ctx.fillStyle = C.flame.base; ctx.fill();
      circle(ctx, r * 0.6, -r * 0.6, r * 0.12, "#16202A");
    },
  },
  towel: {
    name: "towel", tags: ["cloth"], w: 0.55,
    draw(ctx, s) {
      const r = s * 0.2;
      solid(ctx, (c) => { c.beginPath(); roundRect(c, -r, -r * 0.9, r * 2, r * 1.8, 8); },
        C.sea.light, C.sea.dark);
      ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = C.bone.light;
      ctx.fillRect(-r, -r * 0.2, r * 2, r * 0.26);
      ctx.fillRect(-r, r * 0.2, r * 2, r * 0.26);
      ctx.restore();
    },
  },
  boat: {
    name: "boat", tags: ["toy", "floats"], w: 0.66,
    draw(ctx, s) {
      const r = s * 0.24;
      solid(ctx, (c) => {
        c.beginPath(); c.moveTo(-r * 1.1, 0); c.lineTo(r * 1.1, 0);
        c.lineTo(r * 0.7, r * 0.7); c.lineTo(-r * 0.7, r * 0.7); c.closePath();
      }, C.cherry.base, C.cherry.deep);
      cap(ctx, 0, 0, 0, -r * 1.4, 5, C.bark.base);
      ctx.beginPath();
      ctx.moveTo(r * 0.08, -r * 1.35); ctx.lineTo(r * 0.95, -r * 0.5); ctx.lineTo(r * 0.08, -r * 0.5);
      ctx.closePath(); ctx.fillStyle = C.bone.light; ctx.fill();
    },
  },

  /* -------------------------------------------------------------- music */
  drum: {
    name: "drum", tags: ["instrument"], w: 0.66, note: 196,
    draw(ctx, s, st = {}) {
      const r = s * 0.24;
      const squash = 1 - (st.hit ?? 0) * 0.14;
      ctx.save(); ctx.scale(1, squash);
      solid(ctx, (c) => { c.beginPath(); roundRect(c, -r, -r * 0.5, r * 2, r * 1.3, 6); },
        C.cherry.base, C.cherry.deep);
      ellipse(ctx, 0, -r * 0.5, r, r * 0.34, C.bone.light);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = C.sun.base; ctx.lineWidth = 4;
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.moveTo(i * r * 0.7, -r * 0.3); ctx.lineTo(i * r * 0.5, r * 0.7); ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    },
  },
  bell: {
    name: "bell", tags: ["instrument"], w: 0.5, note: 523,
    draw(ctx, s, st = {}) {
      const r = s * 0.2;
      ctx.save();
      ctx.rotate(Math.sin((st.t ?? 0) * 18) * (st.hit ?? 0) * 0.3);
      solid(ctx, (c) => {
        c.beginPath(); c.moveTo(-r * 0.9, r * 0.6); c.quadraticCurveTo(-r * 0.8, -r, 0, -r);
        c.quadraticCurveTo(r * 0.8, -r, r * 0.9, r * 0.6); c.closePath();
      }, C.sun.base, C.sun.deep);
      fillRound(ctx, -r, r * 0.5, r * 2, r * 0.3, 4, C.sun.dark);
      circle(ctx, 0, r * 0.85, r * 0.2, C.sun.dark);
      ctx.restore();
    },
  },
  horn: {
    name: "horn", tags: ["instrument"], w: 0.6, note: 330,
    draw(ctx, s) {
      const r = s * 0.22;
      solid(ctx, (c) => {
        c.beginPath(); c.moveTo(-r * 1.1, -r * 0.25); c.lineTo(r * 0.3, -r * 0.6);
        c.lineTo(r * 0.3, r * 0.6); c.lineTo(-r * 1.1, r * 0.25); c.closePath();
      }, C.grape.base, C.grape.deep);
      solid(ctx, (c) => { c.beginPath(); c.ellipse(r * 0.4, 0, r * 0.28, r * 0.7, 0, 0, Math.PI * 2); },
        C.grape.light, C.grape.dark);
    },
  },
  shaker: {
    name: "shaker", tags: ["instrument"], w: 0.45, note: 880,
    draw(ctx, s, st = {}) {
      const r = s * 0.17;
      ctx.save();
      ctx.rotate(Math.sin((st.t ?? 0) * 22) * (st.hit ?? 0) * 0.4);
      // Striped handle and visible beads: the plain green bulb on a brown stick
      // read as a tree, which is a bad failure in a game that names what you
      // are holding.
      fillRound(ctx, -r * 0.22, r * 0.35, r * 0.44, r * 1.25, 5, C.bark.base);
      for (let i = 0; i < 3; i++) {
        fillRound(ctx, -r * 0.22, r * (0.5 + i * 0.35), r * 0.44, r * 0.16, 3, C.bone.light);
      }
      solid(ctx, (c) => { c.beginPath(); c.ellipse(0, -r * 0.35, r * 0.8, r, 0, 0, Math.PI * 2); },
        C.flame.base, C.flame.deep);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, -r * 0.35, r * 0.8, r, 0, 0, Math.PI * 2); ctx.clip();
      ctx.globalAlpha = 0.75;
      for (const [dx, dy] of [[-0.3, -0.5], [0.28, -0.25], [-0.1, 0.15], [0.32, 0.35], [-0.35, 0.4]]) {
        circle(ctx, dx * r, (dy - 0.35) * r, r * 0.16, C.sun.light);
      }
      ctx.restore();
      gloss(ctx, -r * 0.3, -r * 0.8, r * 0.22, r * 0.3, 0.4);
      ctx.restore();
    },
  },
  ball: {
    name: "ball", tags: ["toy", "rolls"], w: 0.5,
    draw(ctx, s) {
      const r = s * 0.19;
      solid(ctx, (c) => { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); }, C.flame.base, C.flame.deep);
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = C.bone.light;
      ctx.fillRect(-r, -r * 0.22, r * 2, r * 0.44);
      ctx.restore();
      gloss(ctx, -r * 0.35, -r * 0.4, r * 0.24, r * 0.16);
    },
  },
  lamp: {
    name: "lamp", tags: ["light"], w: 0.6,
    draw(ctx, s, st = {}) {
      const r = s * 0.22;
      const on = st.on !== false;
      if (on) {
        const g = ctx.createRadialGradient(0, r * 0.2, 2, 0, r * 0.2, r * 3);
        g.addColorStop(0, alpha(C.sun.light, 0.5));
        g.addColorStop(1, alpha(C.sun.light, 0));
        ctx.fillStyle = g; ctx.fillRect(-r * 3, -r * 3, r * 6, r * 6);
      }
      solid(ctx, (c) => {
        c.beginPath(); c.moveTo(-r, r * 0.2); c.lineTo(r, r * 0.2);
        c.lineTo(r * 0.5, -r * 0.8); c.lineTo(-r * 0.5, -r * 0.8); c.closePath();
      }, on ? C.sun.base : C.slate.base, on ? C.sun.deep : C.slate.deep);
      fillRound(ctx, -r * 0.12, r * 0.2, r * 0.24, r * 1.1, 4, C.slate.dark);
      fillRound(ctx, -r * 0.5, r * 1.2, r, r * 0.22, 5, C.slate.base);
    },
  },
  gift: {
    name: "present", tags: ["treat"], w: 0.55,
    draw(ctx, s) {
      const r = s * 0.2;
      solid(ctx, (c) => { c.beginPath(); roundRect(c, -r, -r * 0.7, r * 2, r * 1.6, 6); },
        C.grape.base, C.grape.deep);
      ctx.fillStyle = C.sun.base;
      ctx.fillRect(-r * 0.16, -r * 0.7, r * 0.32, r * 1.6);
      ctx.fillRect(-r, -r * 0.16, r * 2, r * 0.32);
      circle(ctx, -r * 0.25, -r * 0.8, r * 0.3, C.sun.base);
      circle(ctx, r * 0.25, -r * 0.8, r * 0.3, C.sun.base);
    },
  },
};

export const THING_IDS = Object.keys(THINGS);

/** Does this thing carry the given tag? */
export const has = (id, tag) => (THINGS[id]?.tags ?? []).includes(tag);

/**
 * Draw a thing at (x, y), sized to `s`. `st` is the object's live state —
 * cooking, watered, struck — so one drawing can show several conditions.
 */
export function drawThing(ctx, id, x, y, s, st = {}) {
  const T = THINGS[id];
  if (!T) return;
  ctx.save();
  ctx.translate(x, y);
  if (st.tilt) ctx.rotate(st.tilt);
  if (st.scale) ctx.scale(st.scale, st.scale);
  T.draw(ctx, s, st);
  ctx.restore();
}
