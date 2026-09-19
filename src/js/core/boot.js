/**
 * One boot sequence for every game page.
 *
 * Each page used to carry its own copy of the same forty lines: install audio,
 * parse the query, build the engine, expose it for the tools, start the loop,
 * and hit-test the top-left corner for "go back". Ten copies of a thing is ten
 * chances for it to drift, and it had already drifted three ways:
 *
 *   - the back corner was 74px in nine pages and 70px in the tenth, so the one
 *     control a child is actually told about was a different size per game;
 *   - three games read `params.get("bird")` without falling back to the saved
 *     bird, so opening them any way other than from the hub lost the child's
 *     choice;
 *   - Say & Jump read `cast` while the hub has always sent `bird`, so the
 *     flagship game quietly ignored the bird the child picked.
 *
 * None of those are hard bugs. They are what copy-paste costs, paid slowly.
 *
 * A page now says only what is genuinely its own: which game it is, and how to
 * build its scene.
 */

import { Engine } from "./engine.js";
import { install as installAudio } from "./audio.js";
import { save } from "./storage.js";
import { boot as bootNative, onBack, haptics } from "./native.js";

/**
 * The top-left corner that always goes home, in logical px.
 *
 * It is deliberately large: it is the only control a child is ever told about,
 * and it has to work for a finger that cannot aim.
 */
export const BACK_HIT = 74;

/**
 * @param {object} opts
 * @param {string} opts.game      id used for progress and the results screen
 * @param {(ctx: {level: number, band: string, bird: string,
 *                params: URLSearchParams, done: Function, exit: Function})
 *          => object} opts.scene builds the scene for this page
 * @param {string} [opts.band]    band to fall back to when nothing is chosen;
 *                                a toddler game wants a different default
 */
export async function boot({
  game,
  scene,
  band: bandFallback = "mid",
  width = 720,
  height = 1280,
  home = "../../index.html",
  results = "../result.html",
}) {
  installAudio();
  // The shell first: lock to portrait, dress the status bar, drop the splash.
  // On the web every one of these is a no-op that resolves immediately.
  await bootNative();
  // And restore progress from the native mirror before anything reads it,
  // because a game page can be opened cold straight from a notification.
  await save.restore();

  const params = new URLSearchParams(location.search);
  const level = Math.max(0, parseInt(params.get("level") ?? "0", 10) || 0);
  const band = params.get("band") || save.state.band || bandFallback;
  const bird = params.get("bird") || save.state.bird || "chick";

  const engine = new Engine({
    host: document.getElementById("stage"), width, height,
  });

  const exit = () => { location.href = home; };

  // Android's hardware back leaves the level, rather than closing the app.
  // Without this, pressing back inside a game quits to the home screen, which
  // to a child is indistinguishable from the game crashing.
  onBack(() => { exit(); return true; });

  /**
   * Finish the level. Whatever the game reports is carried to the results
   * screen as-is, so a game can report what it happens to measure — moves,
   * falls, the word — without a page wrapper having to know the shape of it.
   */
  const done = (result = {}) => {
    const q = new URLSearchParams({ game, level: String(level) });
    for (const [k, v] of Object.entries(result)) {
      if (v != null) q.set(k, String(v));
    }
    location.href = `${results}?${q}`;
  };

  // Registered before the scene so the corner is reliably "back" and nothing
  // else: this listener runs first and stops the scene from also seeing the
  // tap it is about to navigate away from.
  engine.canvas.addEventListener("pointerdown", (e) => {
    const p = engine.toLocal(e);
    if (p.x < engine.view.x + BACK_HIT && p.y < engine.view.y + BACK_HIT) {
      e.stopImmediatePropagation();
      haptics.tap();
      exit();
    }
  });

  const active = scene({ level, band, bird, params, done, exit });

  // The verification tools drive the real handlers through these.
  window.__scene = active;
  window.__engine = engine;

  engine.setScene(active);
  engine.start();
  return { engine, scene: active };
}
