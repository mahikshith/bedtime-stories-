/**
 * Colour system.
 *
 * Direction: saturated poster graphics. Flat, high-chroma fills with hard
 * value separation between neighbouring shapes — the way a silkscreen print
 * or a Crossy Road frame reads. Pastels and low-contrast gradients are
 * banned on gameplay elements: at arm's length on a phone in daylight, a
 * washed-out palette turns into grey mush and a child cannot tell the
 * platform from the sky.
 *
 * Every colour comes in a triple: LIGHT (the lit top face), BASE (the body)
 * and DARK (the shadow side / under-edge). Drawing all three is what makes
 * flat shapes feel carved rather than pasted.
 */

const ramp = (light, base, dark, deep) => ({ light, base, dark, deep: deep ?? dark });

export const C = {
  // --- greens: grass, go, correct ---------------------------------------
  grass: ramp("#8FE04A", "#5CC22B", "#3E9418", "#2C6B10"),
  jade: ramp("#4BE3B0", "#14C48A", "#0A9166", "#066848"),

  // --- earth: pillars, ground -------------------------------------------
  clay: ramp("#F2A94B", "#DE8A22", "#B26714", "#8A4E0D"),
  bark: ramp("#B5793F", "#8E5628", "#653A18", "#47280F"),

  // --- water / sky -------------------------------------------------------
  sea: ramp("#5BB8F5", "#2A86DE", "#1A5FA8", "#114275"),
  sky: ramp("#A5E4FF", "#63C6F7", "#2FA3E8", "#1B7FC0"),

  // --- accents -----------------------------------------------------------
  sun: ramp("#FFE86B", "#FFC61E", "#E39A00", "#B57800"),
  flame: ramp("#FF8A5C", "#FF5C2B", "#D83A11", "#A02808"),
  cherry: ramp("#FF6B7A", "#F42B45", "#C4102A", "#8E0A1E"),
  grape: ramp("#C89BFF", "#9B5CF6", "#6E33C4", "#4B1F8E"),
  candy: ramp("#FF9AD8", "#FF4FB4", "#D01F86", "#95125F"),
  ice: ramp("#E4F7FF", "#B3E7FF", "#78C9EE", "#4A9BC4"),

  // --- neutrals ----------------------------------------------------------
  bone: ramp("#FFFFFF", "#F4F0E6", "#D6CFBE", "#B0A896"),
  slate: ramp("#5E7480", "#3B4E59", "#26343C", "#162026"),
  coal: ramp("#2A3840", "#18242A", "#0E1619", "#070C0E"),
};

/** Flat aliases for UI chrome. */
export const TOKENS = {
  // surfaces
  ink: "#101A1F",
  inkRaised: "#1B2930",
  inkLine: "#32454F",
  inkDeep: "#070E11",
  text: "#FFFFFF",
  textDim: "#9FB4BF",

  // brand accents
  snow: "#FFFFFF",
  polar: "#F4F0E6",
  swan: "#D6CFBE",
  hare: "#9FB4BF",
  wolf: "#6B818C",
  eel: "#26343C",

  featherGreen: C.grass.base,
  maskGreen: C.grass.light,
  treeFrog: C.grass.dark,
  seaSponge: C.jade.base,
  seaSpongeEdge: C.jade.dark,
  macaw: C.sea.base,
  whale: C.sea.dark,
  iguana: C.ice.light,
  cardinal: C.cherry.base,
  fireAnt: C.cherry.dark,
  bee: C.sun.base,
  camel: C.sun.dark,
  fox: C.flame.base,
  lion: C.flame.dark,
  beetle: C.grape.base,
  humpback: C.grape.dark,
};

export const PAIRS = {
  green: { face: C.grass.base, edge: C.grass.dark },
  teal: { face: C.jade.base, edge: C.jade.dark },
  blue: { face: C.sea.base, edge: C.sea.dark },
  red: { face: C.cherry.base, edge: C.cherry.dark },
  gold: { face: C.sun.base, edge: C.sun.dark },
  orange: { face: C.flame.base, edge: C.flame.dark },
  purple: { face: C.grape.base, edge: C.grape.dark },
  slate: { face: C.slate.base, edge: C.slate.deep },
  bone: { face: C.bone.light, edge: C.bone.dark },
};

/* ------------------------------------------------------------- helpers */

export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = pa >> 16, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = pb >> 16, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

export function alpha(hex, a) {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${p >> 16},${(p >> 8) & 255},${p & 255},${a})`;
}

export function shade(hex, amount) {
  return mix(hex, amount < 0 ? "#000000" : "#ffffff", Math.abs(amount));
}

/** Push a colour toward full chroma — used to keep distant layers from going grey. */
export function vivid(hex, amount = 0.15) {
  const p = parseInt(hex.slice(1), 16);
  let r = p >> 16, g = (p >> 8) & 255, b = p & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const mid = (max + min) / 2;
  r = Math.round(r + (r - mid) * amount);
  g = Math.round(g + (g - mid) * amount);
  b = Math.round(b + (b - mid) * amount);
  const cl = (v) => Math.max(0, Math.min(255, v));
  return `#${((cl(r) << 16) | (cl(g) << 8) | cl(b)).toString(16).padStart(6, "0")}`;
}
