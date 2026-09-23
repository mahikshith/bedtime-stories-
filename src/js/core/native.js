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
      await sb.setBackgroundColor({ color: document.body.classList.contains("hub") ? "#172A29" : "#101A1F" });
      // Overlaid ON PURPOSE, and then inset again in CSS.
      //
      // Asking the plugin not to overlay was the obvious fix and it did not
      // hold: the HUD was still under the clock on a real phone, and because
      // the web view was no longer full-bleed, env(safe-area-inset-top)
      // reported zero — so CSS could not correct it either. Nothing could see
      // the problem.
      //
      // Full-bleed is the deterministic choice. The insets are always real,
      // `.stage` subtracts them, and the strip behind the system bar is
      // painted by the page instead of being a black letterbox.
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

/* ------------------------------------------------------------------ tts */

/**
 * Saying a word out loud, on a platform where the browser may not.
 *
 * WHY THIS IS NOT JUST `speechSynthesis`. Android's WebView exposes the
 * SpeechSynthesis API whether or not the device has a working TTS engine
 * behind it. `speak()` accepts the utterance, resolves, and nothing comes out
 * of the speaker — no error, no exception, no voices in `getVoices()`. From
 * inside the page it is indistinguishable from success, which is why HEAR IT
 * could be reported as doing nothing while every test passed: there is
 * nothing in the web API to test against.
 *
 * The native plugin talks to Android's TextToSpeech service directly, so when
 * it is present it is the one to use. When it is not — every browser, and the
 * CI that runs the whole verification suite over plain HTTP — the web path is
 * still there.
 *
 * `available()` is deliberately pessimistic on the web: no voices means no
 * engine, and the caller would rather know than mime.
 */
export const tts = {
  /** True when the native engine is here, so the web quirks do not apply. */
  get native() { return Boolean(plugin("TextToSpeech")?.speak); },

  /**
   * Is anything going to come out of the speaker?
   *
   * @returns {Promise<boolean>}
   */
  async available() {
    const t = plugin("TextToSpeech");
    if (t?.getSupportedLanguages) {
      try { return Boolean((await t.getSupportedLanguages())?.languages?.length); }
      catch { return Boolean(t.speak); }
    }
    if (t?.speak) return true;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    return (await voices()).length > 0;
  },

  /**
   * Speak, and report whether it actually happened.
   *
   * @returns {Promise<boolean>} false when nothing was said, so the caller can
   *                             show the child something instead of silence.
   */
  async speak(text, { rate = 0.85, pitch = 1.15, volume = 1, lang = "en-US" } = {}) {
    const t = plugin("TextToSpeech");
    if (t?.speak) {
      try {
        // The native plugin's rate is 1.0-centred like the web's, but its
        // range is narrower in practice; clamping keeps a slow syllable
        // read-out from being refused outright.
        await t.speak({ text, lang, rate: Math.max(0.5, Math.min(2, rate)), pitch, volume });
        return true;
      } catch { return false; }
    }
    return false;   // caller falls back to speechSynthesis
  },

  async stop() {
    const t = plugin("TextToSpeech");
    if (t?.stop) { try { await t.stop(); } catch {} }
  },
};

/**
 * The browser's voice list, which arrives late.
 *
 * `getVoices()` returns an empty array on the first call in Chrome and in
 * Android's WebView, and fills in asynchronously. Reading it once at startup
 * and caching the empty result is a real way to end up with no voice
 * selected for the life of the session.
 */
function voices(timeoutMs = 1200) {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve([]);
    const now = speechSynthesis.getVoices();
    if (now.length) return resolve(now);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(speechSynthesis.getVoices() || []);
    };
    speechSynthesis.addEventListener?.("voiceschanged", finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

export { voices as ttsVoices };

/* --------------------------------------------------------------- speech */

/**
 * Recognising the word a child actually said.
 *
 * This has to be native. `SpeechRecognition` is a Chrome feature and simply
 * does not exist inside an Android WebView, so the browser API the game was
 * written against was never going to fire once the app was packaged — the
 * microphone measured loudness and the word itself was never checked. A game
 * whose whole premise is saying the word cannot leave that to a loudness
 * meter: shouting "aaaah" would work exactly as well as saying "frog".
 *
 * So: the native recogniser on a device, the browser one where it exists
 * (desktop Chrome, which is what the tests drive), and neither on a device
 * that has no recogniser — where the game must still be playable by touch.
 */
export const speech = {
  /** Does this platform have any recogniser at all? */
  async available() {
    const sr = plugin("SpeechRecognition");
    if (sr?.available) {
      try { return Boolean((await sr.available()).available); } catch { return false; }
    }
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  /** Ask for permission up front, so it is not asked mid-jump. */
  async request() {
    const sr = plugin("SpeechRecognition");
    if (!sr?.requestPermissions) return true;
    try {
      const r = await sr.requestPermissions();
      return r?.speechRecognition === "granted" || r?.speechRecognition === "prompt-with-rationale";
    } catch { return false; }
  },

  /**
   * Listen for one utterance and hand back what was heard, lower-cased.
   *
   * Returns an array because every recogniser offers alternatives, and for a
   * small child the best guess is often not the first one — accepting any of
   * the top few is the difference between "it never hears me" and "it works".
   */
  async listenOnce({ language = "en-US", max = 5 } = {}) {
    const sr = plugin("SpeechRecognition");
    if (sr?.start) {
      try {
        const r = await sr.start({
          language, maxResults: max, partialResults: false, popup: false,
        });
        return (r?.matches ?? []).map((m) => String(m).toLowerCase());
      } catch { return []; }
    }
    return webListenOnce(language, max);
  },

  async stop() {
    const sr = plugin("SpeechRecognition");
    if (sr?.stop) { try { await sr.stop(); } catch {} }
  },
};

/** Browser fallback, used on desktop and by the test suite. */
function webListenOnce(language, max) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return Promise.resolve([]);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const r = new SR();
      r.lang = language;
      r.maxAlternatives = max;
      r.interimResults = false;
      r.continuous = false;
      r.onresult = (e) => {
        const out = [];
        for (const res of e.results) {
          for (let i = 0; i < res.length; i++) out.push(res[i].transcript.toLowerCase().trim());
        }
        finish(out);
      };
      r.onerror = () => finish([]);
      r.onend = () => finish([]);
      r.start();
      // Never leave a child waiting on a recogniser that has stopped replying.
      setTimeout(() => { try { r.stop(); } catch {} finish([]); }, 6000);
    } catch { finish([]); }
  });
}

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
/**
 * Tell CSS how tall the system bars are, because CSS cannot find out.
 *
 * On Android `env(safe-area-inset-top)` is the DISPLAY CUTOUT inset, not the
 * status bar inset. A phone without a notch reports 0 while the clock and the
 * battery sit squarely on top of the game — which is why the HUD-under-the-
 * status-bar bug survived being "fixed" twice: every fix was written in CSS,
 * and CSS could not see the bar.
 *
 * These are floors, not measurements. Android's status bar is 24dp by the
 * platform default and CSS pixels are dp in the web view, so 30px clears it
 * with room to spare; the gesture pill wants about 16dp, so 18px clears that.
 * A device whose cutout is genuinely bigger reports it through `env()`, and
 * the `max()` in tokens.css takes whichever is larger. Deliberately NOT
 * measured by toggling the overlay and diffing `innerHeight`: that delta
 * silently includes the navigation bar on three-button devices, so it would
 * push the HUD a nav-bar's height down the screen on exactly the phones the
 * floor already handles correctly.
 *
 * iOS is left alone. There `env()` reports the real safe area, status bar
 * included, so a floor could only ever be wrong.
 */
function declareSystemBars() {
  if (platform() !== "android") return;
  const r = document.documentElement.style;
  r.setProperty("--sys-top", "30px");
  r.setProperty("--sys-bottom", "18px");
}

export async function boot({ portrait = true } = {}) {
  if (!isNative()) return;
  declareSystemBars();
  if (portrait) await lockPortrait();
  await ready();
}
