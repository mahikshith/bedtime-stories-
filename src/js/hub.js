/**
 * The hub: age band, bird, progress, and the route into every game.
 *
 * Built as DOM rather than canvas. Menus want crisp text at any size,
 * real scrolling, and screen-reader support — all of which the browser gives
 * for free and a canvas would have to re-implement badly.
 */

import { save } from "./core/storage.js";
import { fadeIn, navigate } from "./core/nav.js";
import { BANDS } from "./core/words.js";
import { drawBird, BIRDS, BIRD_IDS } from "./art/bird.js";
import { thumbCanvas } from "./art/thumbs.js";
import { install as installAudio, sfx, unlock } from "./core/audio.js";
import { boot as bootNative, onBack, haptics } from "./core/native.js";
import { C } from "./core/palette.js";

installAudio();

/* ------------------------------------------------------------- catalogue */

/**
 * Every game, with the age bands it suits.
 *
 * `levels` is async and imports its content on demand. It used to be a static
 * import at the top of this file, which meant opening the MENU parsed every
 * level table in the app — and, for Shape Sorter, a whole game implementation
 * and everything it draws with. A menu's cost should not grow with every game
 * added to it. Now the hub loads one game's content, when a child opens that
 * game's path, and none at all if they just tap a card and play.
 *
 * `levels` returns the per-level
 * list so the path can be drawn from the same source the game plays.
 */
const GAMES = [
  {
    id: "say-jump", title: "Say & Jump", icon: "🗣️",
    sub: "Say the word to make the bird jump between platforms.",
    control: "voice", bands: ["tiny", "mid", "big"],
    face: C.grass.base, edge: C.grass.dark,
    href: "src/games/say-jump.html",
    levels: async () => (await import("./games/say-jump/levels.js"))
      .LEVELS.map((l) => ({ name: l.name, teaches: l.teaches })),
  },
  {
    id: "tilt-maze", title: "Tilt Maze", icon: "🌀",
    sub: "Tilt to roll. Collect letters in order to spell the word.",
    control: "tilt", bands: ["mid", "big"],
    face: C.sea.base, edge: C.sea.dark,
    href: "src/games/tilt-maze.html",
    levels: async () => (await import("./games/tilt-maze/levels.js"))
      .BOARDS.map((b) => ({ name: b.name, teaches: b.teaches })),
  },
  {
    id: "word-mob", title: "Word Mob", icon: "🐥",
    sub: "Steer your flock through the right gate. Grow an army!",
    control: "tap", bands: ["mid", "big"],
    face: C.flame.base, edge: C.flame.dark,
    href: "src/games/word-mob.html",
    levels: async () => (await import("./games/word-mob/levels.js"))
      .RUNS.map((r) => ({ name: r.name, teaches: r.teaches })),
  },
  {
    id: "shapes", title: "Shape Sorter", icon: "🔶",
    sub: "Drop each shape into the hole it fits. Learn their names.",
    control: "tap", bands: ["tiny", "mid"],
    face: C.flame.base, edge: C.flame.dark,
    href: "src/games/shapes.html",
    levels: async () => (await import("./games/shapes/levels.js"))
      .LEVELS.map((l) => ({ name: l.name, teaches: l.teaches })),
  },
  {
    id: "balance", title: "Balance", icon: "⚖️",
    sub: "Get the box alone. Quietly, this is algebra.",
    control: "tap", bands: ["mid", "big"],
    face: C.grape.base, edge: C.grape.dark,
    href: "src/games/balance.html",
    levels: async () => (await import("./games/balance/levels.js"))
      .LEVELS.map((l) => ({ name: l.name, teaches: l.teaches })),
  },
  {
    id: "robot", title: "Robot Path", icon: "🤖",
    sub: "Write a program, press play, watch it run. Real coding.",
    control: "tap", bands: ["mid", "big"],
    face: C.jade.base, edge: C.jade.dark,
    href: "src/games/robot.html",
    levels: async () => (await import("./games/robot/levels.js"))
      .LEVELS.map((l) => ({ name: l.name, teaches: l.teaches })),
  },
  {
    id: "slide", title: "Sliding Blocks", icon: "🧩",
    sub: "Slide the blocks out of the way to free the big red one.",
    control: "tap", bands: ["mid", "big"],
    face: C.cherry.base, edge: C.cherry.dark,
    href: "src/games/slide.html",
    levels: async () => (await import("./games/slide/layouts.js"))
      .LAYOUTS.map((l) => ({ name: l.name, teaches: `Best: ${l.par} moves` })),
  },
  {
    id: "tangram", title: "Tangram", icon: "🔷",
    sub: "Fit seven shapes together to build the picture.",
    control: "tap", bands: ["tiny", "mid", "big"],
    face: C.sun.base, edge: C.sun.dark,
    href: "src/games/tangram.html",
    levels: async () => (await import("./games/tangram/puzzles.js"))
      .PUZZLES.map((p) => ({
        name: p.name,
        teaches: ["", "Match the pieces", "Fit them in", "No clues"][p.tier],
      })),
  },
  {
    // No levels, no stars, no way to finish — so it gets one node on the path
    // and the whole town behind it. It is the only game here a child can open
    // and still be inside twenty minutes later.
    id: "town", title: "Tinker Town", icon: "🏠",
    sub: "Four rooms, a pocket, and no rules. Carry things about and find out what happens.",
    control: "tap", bands: ["tiny", "mid", "big"],
    face: C.clay.base, edge: C.clay.dark,
    href: "src/games/town.html",
    levels: async () => [{ name: "Tinker Town", teaches: "Play with anything, any way" }],
  },
  {
    id: "echo-pop", title: "Echo Pop", icon: "🫧",
    sub: "Say it or tap it. Pop the bubble with the right thing inside.",
    control: "voice", bands: ["tiny", "mid"],
    face: C.candy.base, edge: C.candy.dark,
    href: "src/games/echo-pop.html",
    levels: async () => [{ name: "Bubble Time", teaches: "Find the thing you hear" }],
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

  const games = GAMES.filter((g) => g.bands.includes(s.band));

  // A game that has been opened takes over the whole screen. Progress used to
  // unfold underneath its tile, which pushed the grid apart and put a column
  // of padlocks between a child and the next game — the picker needs a room of
  // its own, not a drawer in the middle of the shelf.
  const opened = games.find((g) => g.id === s.openGame);
  if (opened) { app.append(gameScreen(opened)); return; }

  app.append(unitBanner(BANDS[s.band]));

  // Two to a row. A single column of full-width cards turned ten games into a
  // scroll with no end in sight, and the games added most recently were the
  // ones nobody ever reached.
  const grid = el("div", "games-grid");
  for (const g of games) grid.append(gameTile(g));
  app.append(grid);

  app.append(footer());
}

/** Open a game's own screen, and make the device back button close it. */
function openGame(g) {
  sfx.whoosh();
  haptics.tap();
  save.set({ openGame: g.id });
  history.pushState({ game: g.id }, "", location.pathname);
  render();
  scrollTo(0, 0);
}

function closeGame() {
  save.set({ openGame: null });
  render();
  scrollTo(0, 0);
}

window.addEventListener("popstate", () => {
  if (save.state.openGame) closeGame();
});

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

function gameTile(g) {
  // The picture is the label. A three-year-old cannot read "Sliding Blocks",
  // but they can recognise a red block in a wooden frame, so the thumbnail is
  // the whole top of the tile and the words sit under it.
  //
  // Nothing else goes on a tile. A progress bar or a level drawer under each
  // one turns a wall of pictures into a wall of admin, and the picture is the
  // only part a child reads.
  const tile = el("button", "tile");
  tile.title = `${g.title} — ${g.sub}`;
  tile.setAttribute("aria-label", g.title);

  const art = el("div", "tile__art");
  art.append(thumbCanvas(g.id, 190, 132));
  art.style.setProperty("--face", g.face);
  art.style.setProperty("--edge", g.edge);

  const stars = save.totalStars(g.id);
  tile.append(art, el("div", "tile__body",
    `<div class="tile__title">${g.title}</div>
     <div class="tile__meta">
       <span class="chip ${CONTROL_CHIP[g.control].cls}">${CONTROL_CHIP[g.control].label}</span>
       ${stars ? `<span class="chip">⭐ ${stars}</span>` : ""}
     </div>`));
  tile.onclick = () => openGame(g);
  return tile;
}

/**
 * One game's own screen: what it is, a button that plays it, and the trail of
 * its levels. Reached by tapping a tile, left by the arrow or the device back
 * button.
 */
function gameScreen(g) {
  const wrap = el("div", "screen");

  const banner = el("div", "screen__banner");
  banner.style.setProperty("--face", g.face);
  banner.style.setProperty("--edge", g.edge);
  banner.append(thumbCanvas(g.id, 420, 210));

  const back = el("button", "screen__back", "‹");
  back.title = "Back to the games";
  back.setAttribute("aria-label", "Back to the games");
  back.onclick = () => { sfx.tick?.(); history.back(); };
  banner.append(back);
  wrap.append(banner);

  const stars = save.totalStars(g.id);
  wrap.append(el("div", "screen__head",
    `<div class="screen__title">${g.title}</div>
     <div class="screen__sub">${g.sub}</div>
     <div class="screen__meta">
       <span class="chip ${CONTROL_CHIP[g.control].cls}">${CONTROL_CHIP[g.control].label}</span>
       <span class="chip">⭐ ${stars}</span>
     </div>`));

  // The one big button. Whatever else is on this screen, the fast path stays a
  // single press: play the level you are up to.
  const play = el("button", "btn btn--play", "PLAY");
  play.style.setProperty("--face", g.face);
  play.style.setProperty("--edge", g.edge);
  play.onclick = () => launch(g, save.unlockedLevel(g.id));
  wrap.append(play);

  wrap.append(levelPath(g));
  return wrap;
}

/**
 * The winding node trail. Each node is offset horizontally along a sine so
 * the eye is pulled down the page instead of reading a flat column.
 *
 * Only ever built for the one open game, and its content is fetched when it
 * opens. Rendering ten of these at once made the hub eight thousand pixels
 * tall, most of it locked nodes a child had to scroll past to reach the games
 * added most recently.
 */
function levelPath(g) {
  const path = el("div", "path");
  path.append(el("div", "path__loading", "…"));

  // The load is async, so the fill has to check it is still wanted: a child
  // can collapse this or open another game before a slow disk answers.
  g.levels().then((levels) => {
    if (save.state.openGame !== g.id || !path.isConnected) return;
    path.innerHTML = "";
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
  navigate(`${game.href}?${q}`);
}

// Paint immediately so the app is never a blank screen, then restore any
// progress the native mirror is holding and repaint if it brought something
// back. Waiting on storage before the first frame would mean a cold start
// shows nothing at all while a disk read happens.
render();
// After the first paint, so the fade reveals the hub rather than a blank page.
fadeIn();
bootNative().then(() => save.restore()).then((s) => {
  if (s.band || s.wordsLearned?.length) render();
});

// Android's hardware back closes a game's screen rather than the app.
onBack(() => {
  if (save.state.openGame) { closeGame(); return true; }
  return false;
});

window.addEventListener("resize", () => {
  // the path amplitude is width-dependent, so re-lay it out
  document.querySelectorAll(".path__row").forEach((row, i) => {
    const amp = Math.min(96, window.innerWidth * 0.22);
    row.style.transform = `translateX(${Math.sin(i * 0.9) * amp}px)`;
  });
});
