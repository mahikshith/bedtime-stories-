/**
 * Going from one screen to another without a hole in the middle.
 *
 * Every navigation in the app was a bare `location.href`, which means the
 * browser tears down the page, shows whatever the backdrop happens to be —
 * usually a flash of white — and paints the next one. It is the single most
 * noticeable difference between this and a shipped game, and it happens at
 * the two moments a child is most invested: finishing a level, and choosing
 * the next one.
 *
 * Fading to the app's own ink first removes the flash and makes the two pages
 * feel like parts of one thing. It costs a fifth of a second, which is less
 * than the page load it is hiding.
 *
 * The overlay is created here rather than sitting in twelve HTML files,
 * because twelve copies of anything in this codebase has already drifted
 * once. The class it uses is styled in app.css, which every page loads.
 */

const DUR = 200;

function sheet() {
  let w = document.querySelector(".wipe");
  if (!w) {
    w = document.createElement("div");
    w.className = "wipe";
    document.body.appendChild(w);
  }
  return w;
}

/**
 * Fade the incoming page up from ink.
 *
 * Safe to call when the page is already visible: it starts opaque and comes
 * down, so the worst case is a very short dark frame rather than a flash.
 */
export function fadeIn() {
  const w = sheet();
  w.classList.add("is-on");
  // Two frames: one for the browser to accept the opaque state as the
  // starting point, one for the transition to have something to animate FROM.
  // A single frame sometimes lands before style resolution and the fade is
  // simply skipped.
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove("is-on")));
}

/**
 * Fade down to ink, then navigate.
 *
 * Falls through to a plain assignment if anything about the overlay fails,
 * because a transition that cannot run must never become a screen the child
 * cannot leave.
 */
export function navigate(url) {
  try {
    const w = sheet();
    w.classList.add("is-on");
    setTimeout(() => { location.href = url; }, DUR);
  } catch {
    location.href = url;
  }
}
