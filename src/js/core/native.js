/**
 * The native layer, and the one rule that keeps it honest:
 * THE APP MUST STILL RUN AS A PLAIN WEBSITE.
 *
 * Every verification tool in `tools/` drives the real game in a real browser
 * over plain HTTP. The moment the app needs a native runtime to boot, all of
 * that stops working and the only way to test anything is to build an APK. So
 * every call here is a capability check with a web fallback, and the fallback
 * path is the one that runs in CI.
 *
 * WHY PLUGINS ARE REACHED THROUGH `window.Capacitor` RATHER THAN IMPORTED.
 * The codebase has no bundler on purpose — it is plain ES modules loaded
 * straight off disk, which is why "building" is a copy and why what ships is
 * byte-for-byte what was tested. Importing `@capacitor/core` would drag in a
 * bundler to resolve bare specifiers and take that property away. The native
 * runtime injects `window.Capacitor` and registers installed plugins on it, so
 * reaching for them there needs no build step and is simply absent on the web,
 * which is exactly the shape the fallbacks already want.
 */

const cap = () => (typeof window !== "undefined" ? window.Capacitor : undefined);

/** Running inside the real app shell, rather than a browser tab. */
export const isNative = () => Boolean(cap()?.isNativePlatform?.());

/** 'ios' | 'android' | 'web' */
export const platform = () => cap()?.getPlatform?.() ?? "web";

const plugin = (name) => cap()?.Plugins?.[name];

/* ----------------------------------------------------------------- feel */

/**
 * Haptics. A short tap when something is picked up, a firmer one when it
 * lands, a pattern when a level is won.
 *
 * This is the single biggest thing a native shell buys a game like this: it
 * is the difference between pressing a picture of a button and pressing a
 * button. `navigator.vibrate` covers Android browsers; iOS Safari has no
 * equivalent, so on the web iPhone simply gets nothing rather than a hack.
 */
/*
 * Browsers refuse `navigator.vibrate` until the page has been touched, and
 * log an error every time it is called early — which the results screen did on
 * load, before anyone had tapped anything. The native Haptics plugin has no
 * such rule, so only the web fallback waits for a gesture.
 */
let gestured = false;
if (typeof window !== "undefined") {
  const mark = () => { gestured = true; };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(ev, mark, { once: true, passive: true, capture: true });
  }
}

const buzz = (pattern) => { if (gestured) navigator.vibrate?.(pattern); };

export const haptics = {
  tap() { this._impact("Light", 12); },
  knock() { this._impact("Medium", 22); },
  thud() { this._impact("Heavy", 34); },
  win() {
    const h = plugin("Haptics");
    if (h?.notification) { h.notification({ type: "SUCCESS" }); return; }
    buzz([24, 60, 24, 60, 48]);
  },
  _impact(style, ms) {
    const h = plugin("Haptics");
    if (h?.impact) { h.impact({ style }); return; }
    buzz(ms);
  },
};

/* ------------------------------------------------------------ the shell */

/** Lock to portrait. Every screen here is authored 720×1280. */
export async function lockPortrait() {
  const so = plugin("ScreenOrientation");
  if (so?.lock) { try { await so.lock({ orientation: "portrait" }); } catch {} return; }
  try { await screen.orientation?.lock?.("portrait"); } catch {}
}

/** Dismiss the launch screen once the first frame is genuinely ready. */
export async function ready() {
  const sb = plugin("StatusBar");
  if (sb) {
    try {
      await sb.setStyle({ style: "DARK" });
      await sb.setBackgroundColor({ color: "#101A1F" });
      await sb.setOverlaysWebView({ overlay: true });
    } catch {}
  }
  const sp = plugin("SplashScreen");
  if (sp?.hide) { try { await sp.hide({ fadeOutDuration: 240 }); } catch {} }
}

/**
 * The Android hardware back button.
 *
 * Without this, back closes the whole app from anywhere — including from
 * inside a level, which to a child looks like the game crashed. `handler`
 * returns true when it dealt with the press.
 */
export function onBack(handler) {
  const app = plugin("App");
  if (!app?.addListener) return () => {};
  const sub = app.addListener("backButton", ({ canGoBack }) => {
    if (handler({ canGoBack })) return;
    if (canGoBack) history.back();
    else app.exitApp?.();
  });
  return () => { sub?.then?.((s) => s.remove?.()); };
}

/* --------------------------------------------------------------- saving */

/**
 * A durable mirror of the save.
 *
 * localStorage inside a WKWebView is not guaranteed to survive: iOS may evict
 * it when the device is short of space, and the child loses every level they
 * have ever finished. Native Preferences is backed by UserDefaults and
 * SharedPreferences, which are not evicted.
 *
 * So localStorage stays the source of truth — it is synchronous, and the whole
 * save layer is built on that — and this mirrors it after every write, then
 * restores from the mirror on a cold start if localStorage has come back
 * empty. Progress is the one thing in this app that must not be losable.
 */
export const mirror = {
  async save(key, value) {
    const p = plugin("Preferences");
    if (!p?.set) return;
    try { await p.set({ key, value }); } catch {}
  },
  async load(key) {
    const p = plugin("Preferences");
    if (!p?.get) return null;
    try { return (await p.get({ key }))?.value ?? null; } catch { return null; }
  },
};

/* ------------------------------------------------------------ bootstrap */

/*
 * There is no service-worker registration here on purpose.
 *
 * `sw.js` is produced by the build, so it exists in a web or store build and
 * genuinely does not in the source tree the tests drive. Registering from
 * source meant every development page load fetched a file that was never
 * supposed to be there, and a browser logs that 404 whether or not the code
 * catches it — permanent background noise that would eventually hide a real
 * error. Offline caching is a property of the built artifact, so the build
 * injects the registration into the pages it emits. See tools/build-app.mjs.
 */

/** Call once, as early as a page can. */
export async function boot({ portrait = true } = {}) {
  if (!isNative()) return;
  if (portrait) await lockPortrait();
  await ready();
}
