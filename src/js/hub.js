/**
 * The hub: age band, bird, progress, and the route into every game.
 *
 * Built as DOM rather than canvas. Menus want crisp text at any size,
 * real scrolling, and screen-reader support — all of which the browser gives
 * for free and a canvas would have to re-implement badly.
 */

import { save } from "./core/storage.js";
import { BANDS } from "./core/words.js";
import { drawBird, BIRDS, BIRD_IDS } from "./art/bird.js";
import { LEVELS } from "./games/say-jump/levels.js";
import { BOARDS } from "./games/tilt-maze/levels.js";
import { RUNS } from "./games/word-mob/levels.js";
import { PUZZLES } from "./games/tangram/puzzles.js";
import { LAYOUTS } from "./games/slide/layouts.js";
import { LEVEL_COUNT as SHAPE_LEVELS } from "./games/shapes/game.js";
import { LEVELS as ROBOT_LEVELS } from "./games/robot/levels.js";
import { LEVELS as BALANCE_LEVELS } from "./games/balance/levels.js";
import { install as installAudio, sfx, unlock } from "./core/audio.js";
import { C } from "./core/palette.js";

installAudio();

/* ------------------------------------------------------------- catalogue */

/**
 * Every game, with the age bands it suits. `levels` returns the per-level
 * list so the path can be drawn from the same source the game plays.
 */
const GAMES = [
  {
    id: "say-jump", title: "Say & Jump", icon: "🗣️",
    sub: "Say the word to make the bird jump between platforms.",
    control: "voice", bands: ["tiny", "mid", "big"],
    face: C.grass.base, edge: C.grass.dark,
    href: "src/games/say-jump.html",
    levels: () => LEVELS.map((l) => ({ name: l.name, teaches: l.teaches })),
  },
  {
    id: "tilt-maze", title: "Tilt Maze", icon: "🌀",
    sub: "Tilt to roll. Collect letters in order to spell the word.",
    control: "tilt", bands: ["mid", "big"],
    face: C.sea.base, edge: C.sea.dark,
    href: "src/games/tilt-maze.html",
    levels: () => BOARDS.map((b) => ({ name: b.name, teaches: b.teaches })),
  },
  {
    id: "word-mob", title: "Word Mob", icon: "🐥",
    sub: "Steer your flock through the right gate. Grow an army!",
    control: "tap", bands: ["mid", "big"],
    face: C.flame.base, edge: C.flame.dark,
    href: "src/games/word-mob.html",
    levels: () => RUNS.map((r) => ({ name: r.name, teaches: r.teaches })),
  },
  {
    id: "shapes", title: "Shape Sorter", icon: "🔶",
    sub: "Drop each shape into the hole it fits. Learn their names.",
    control: "tap", bands: ["tiny", "mid"],
    face: C.flame.base, edge: C.flame.dark,
    href: "src/games/shapes.html",
    levels: () => Array.from({ length: SHAPE_LEVELS }, (_, i) => ({
      name: `Board ${i + 1}`, teaches: "Match the shape to its hole",
    })),
  },
  {
    id: "balance", title: "Balance", icon: "⚖️",
    sub: "Get the box alone. Quietly, this is algebra.",
    control: "tap", bands: ["mid", "big"],
    face: C.grape.base, edge: C.grape.dark,
    href: "src/games/balance.html",
    levels: () => BALANCE_LEVELS.map((l) => ({ name: l.name, teaches: l.teaches })),
  },
  {
    id: "robot", title: "Robot Path", icon: "🤖",
    sub: "Write a program, press play, watch it run. Real coding.",
    control: "tap", bands: ["mid", "big"],
    face: C.jade.base, edge: C.jade.dark,
    href: "src/games/robot.html",
    levels: () => ROBOT_LEVELS.map((l) => ({ name: l.name, teaches: l.teaches })),
  },
  {
    id: "slide", title: "Sliding Blocks", icon: "🧩",
    sub: "华容道 — slide the blocks to free the big one.",
    control: "tap", bands: ["mid", "big"],
    face: C.cherry.base, edge: C.cherry.dark,
    href: "src/games/slide.html",
    levels: () => LAYOUTS.map((l) => ({ name: l.name, teaches: `Best: ${l.par} moves` })),
  },
  {
    id: "tangram", title: "Tangram", icon: "🔷",
    sub: "七巧板 — fit seven shapes together to build the picture.",
    control: "tap", bands: ["tiny", "mid", "big"],
    face: C.sun.base, edge: C.sun.dark,
    href: "src/games/tangram.html",
    levels: () => PUZZLES.map((p) => ({
      name: p.name,
      teaches: ["", "Match the pieces", "Fit them in", "No clues"][p.tier],
    })),
  },
  {
    id: "echo-pop", title: "Echo Pop", icon: "🫧",
    sub: "Say it or tap it. Pop the bubble with the right thing inside.",
    control: "voice", bands: ["tiny", "mid"],
    face: C.candy.base, edge: C.candy.dark,
    href: "src/games/echo-pop.html",
    levels: () => [{ name: "Bubble Time", teaches: "Find the thing you hear" }],
  },
];

const CONTROL_CHIP = {
  voice: { cls: "chip--voice", label: "🎤 VOICE" },
  tilt: { cls: "chip--tilt", label: "📱 TILT" },
  tap: { cls: "chip--tap", label: "👆 TOUCH" },
};

/* ----------------------------------------------------------------- utils */

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/** Render a bird into a small square canvas for avatars and pickers. */
function birdThumb(id, size = 68) {
  const cv = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = size * dpr; cv.height = size * dpr;
  const x = cv.getContext("2d");
  x.scale(dpr, dpr);
  drawBird(x, size / 2, size * 0.86, size * 0.72, { bird: id, state: "idle", t: 0.4, shadow: false });
  return cv;
}

/* ------------------------------------------------------------------ view */

const app = $("#app");

function render() {
  const s = save.state;
  app.innerHTML = "";

  app.append(topBar(s));

  if (!s.band) { app.append(welcome()); return; }

  const band = BANDS[s.band];
  app.append(unitBanner(band));

  const games = GAMES.filter((g) => g.bands.includes(s.band));
  for (const g of games) app.append(gameSection(g));

  app.append(footer());
}

function topBar(s) {
  const bar = el("div", "hud");
  bar.append(
    el("div", "stat stat--streak", `<span class="stat__icon">🔥</span>${s.streak}`),
    el("div", "stat stat--gem", `<span class="stat__icon">💎</span>${s.gems}`),
    el("div", "stat stat--xp", `<span class="stat__icon">⚡</span>${s.xp}`),
    el("div", "hud__spacer"),
  );
  const av = el("button", "avatar-btn");
  av.title = "Choose your bird";
  av.append(birdThumb(s.bird || "chick", 46));
  av.onclick = () => openBirdPicker();
  bar.append(av);
  return bar;
}

function unitBanner(band) {
  const u = el("div", "unit");
  u.style.background = C.grape.base;
  u.style.boxShadow = `0 6px 0 ${C.grape.dark}`;
  u.append(el("div", "unit__text",
    `<div class="unit__kicker">${band.label} YEARS · ${save.state.wordsLearned.length} WORDS LEARNED</div>
     <div class="unit__title">${band.name}</div>`));
  const swap = el("button", "btn btn--sm btn--ghost", "CHANGE");
  swap.style.color = "#fff";
  swap.onclick = () => openBandPicker();
  u.append(swap);
  return u;
}

function gameSection(g) {
  const sec = el("section", "section");
  const head = el("div", "section__head");
  head.append(el("div", "section__rule"), el("div", "section__label", g.title.toUpperCase()), el("div", "section__rule"));
  sec.append(head);

  const card = el("button", "game-card");
  const chip = CONTROL_CHIP[g.control];
  const art = el("div", "game-card__art", g.icon);
  art.style.setProperty("--face", g.face);
  const stars = save.totalStars(g.id);
  card.append(art, el("div", "game-card__body",
    `<div class="game-card__title">${g.title}</div>
     <div class="game-card__sub">${g.sub}</div>
     <div class="game-card__meta">
       <span class="chip ${chip.cls}">${chip.label}</span>
       <span class="chip">⭐ ${stars}</span>
     </div>`));
  card.onclick = () => launch(g, save.unlockedLevel(g.id));
  sec.append(card);
  sec.append(levelPath(g));
  return sec;
}

/**
 * The winding node trail. Each node is offset horizontally along a sine so
 * the eye is pulled down the page instead of reading a flat column.
 */
function levelPath(g) {
  const path = el("div", "path");
  const levels = g.levels();
  const unlocked = save.unlockedLevel(g.id);

  levels.forEach((lv, i) => {
    const row = el("div", "path__row");
    // amplitude shrinks on narrow screens so nodes never clip
    const amp = Math.min(96, window.innerWidth * 0.22);
    row.style.transform = `translateX(${Math.sin(i * 0.9) * amp}px)`;

    const stars = save.starsFor(g.id, i);
    const locked = i > unlocked;
    const current = i === unlocked;

    const node = el("button", "node" + (locked ? " node--locked" : "") +
                              (stars ? " node--done" : "") + (current ? " node--current" : ""));
    node.title = `${lv.name} — ${lv.teaches}`;
    node.disabled = locked;
    const disc = el("div", "node__disc", locked ? "🔒" : stars >= 3 ? "👑" : i === levels.length - 1 ? "🏆" : "⭐");
    if (!locked) {
      disc.style.setProperty("--face", g.face);
      disc.style.setProperty("--edge", g.edge);
    }
    node.append(disc);
    if (stars) {
      node.append(el("div", "node__stars", "⭐".repeat(stars)));
    }
    node.onclick = () => launch(g, i);
    row.append(node);
    path.append(row);
  });
  return path;
}

function footer() {
  const f = el("div", "col");
  f.style.padding = "8px 18px calc(40px + var(--safe-bottom))";
  const learned = save.state.wordsLearned;
  if (learned.length) {
    f.append(el("div", "card",
      `<div class="section__label" style="margin-bottom:8px">WORDS YOU LEARNED</div>
       <div style="display:flex;flex-wrap:wrap;gap:6px">
         ${learned.slice(-24).map((w) => `<span class="chip">${w}</span>`).join("")}
       </div>`));
  }
  const reset = el("button", "btn btn--sm btn--ghost btn--wide", "START OVER");
  reset.style.marginTop = "14px";
  reset.onclick = () => {
    if (confirm("Clear all progress and start again?")) { save.reset(); render(); }
  };
  f.append(reset);
  return f;
}

/* -------------------------------------------------------------- welcome */

function welcome() {
  const w = el("div", "col");
  w.style.padding = "10px 18px 40px";
  const hero = el("div", "card");
  hero.style.textAlign = "center";
  hero.style.padding = "26px 20px";
  const cv = birdThumb("chick", 150);
  cv.style.width = "150px"; cv.style.height = "150px";
  hero.append(cv);
  hero.append(el("h1", "", "Word Quest"), el("p", "muted",
    "Voice and motion games that teach words. Pick an age to begin."));
  w.append(hero);

  const grid = el("div", "choice-grid");
  grid.style.marginTop = "16px";
  const colors = { tiny: C.candy, mid: C.sea, big: C.flame };
  for (const key of ["tiny", "mid", "big"]) {
    const b = BANDS[key];
    const btn = el("button", "choice");
    const age = el("div", "choice__age", b.label);
    age.style.background = colors[key].base;
    btn.append(age, el("div", "",
      `<div class="choice__name">${b.name}</div>
       <div class="choice__desc">${bandBlurb(key)}</div>`));
    btn.onclick = () => { unlock(); sfx.correct(); save.set({ band: key, bird: save.state.bird || "chick" }); render(); };
    grid.append(btn);
  }
  w.append(grid);
  return w;
}

const bandBlurb = (k) => ({
  tiny: "Short words, big pictures, no way to lose.",
  mid: "First spellings, syllables and simple puzzles.",
  big: "Longer words, spelling traps and tougher mazes.",
}[k]);

/* --------------------------------------------------------------- modals */

function modal(title, sub, body) {
  const m = el("div", "modal");
  const panel = el("div", "modal__panel");
  panel.append(el("h2", "modal__title", title), el("div", "modal__sub", sub), body);
  const close = el("button", "btn btn--wide btn--blue", "DONE");
  close.style.marginTop = "18px";
  close.onclick = () => { m.remove(); render(); };
  panel.append(close);
  m.append(panel);
  m.onclick = (e) => { if (e.target === m) { m.remove(); render(); } };
  document.body.append(m);
  requestAnimationFrame(() => m.setAttribute("data-open", ""));
  return m;
}

function openBandPicker() {
  const grid = el("div", "choice-grid");
  const colors = { tiny: C.candy, mid: C.sea, big: C.flame };
  for (const key of ["tiny", "mid", "big"]) {
    const b = BANDS[key];
    const btn = el("button", "choice");
    btn.setAttribute("aria-pressed", String(save.state.band === key));
    const age = el("div", "choice__age", b.label);
    age.style.background = colors[key].base;
    btn.append(age, el("div", "",
      `<div class="choice__name">${b.name}</div><div class="choice__desc">${bandBlurb(key)}</div>`));
    btn.onclick = () => {
      save.set({ band: key });
      grid.querySelectorAll(".choice").forEach((c) => c.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      sfx.coin();
    };
    grid.append(btn);
  }
  modal("Who's playing?", "Words and puzzles match the age you pick.", grid);
}

function openBirdPicker() {
  const row = el("div", "bird-row");
  for (const id of BIRD_IDS) {
    const btn = el("button", "bird-pick");
    btn.title = BIRDS[id].name;
    btn.setAttribute("aria-pressed", String((save.state.bird || "chick") === id));
    btn.append(birdThumb(id, 68));
    btn.onclick = () => {
      save.set({ bird: id });
      row.querySelectorAll(".bird-pick").forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      sfx.pop();
    };
    row.append(btn);
  }
  modal("Pick your bird", "Your bird shows up in every game.", row);
}

/* --------------------------------------------------------------- launch */

function launch(game, level) {
  unlock();
  sfx.whoosh();
  const q = new URLSearchParams({
    level: String(level),
    band: save.state.band || "mid",
    bird: save.state.bird || "chick",
  });
  location.href = `${game.href}?${q}`;
}

render();
window.addEventListener("resize", () => {
  // the path amplitude is width-dependent, so re-lay it out
  document.querySelectorAll(".path__row").forEach((row, i) => {
    const amp = Math.min(96, window.innerWidth * 0.22);
    row.style.transform = `translateX(${Math.sin(i * 0.9) * amp}px)`;
  });
});
