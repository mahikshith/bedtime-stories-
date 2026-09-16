/**
 * Web Audio needs a user gesture before it will make or measure sound.
 *
 * A context constructed outside one starts `suspended`, and a suspended context
 * is not obviously broken: an AnalyserNode attached to it keeps returning
 * frames, every sample reads as silence, and the voice games sit there showing
 * a dead meter while the microphone permission looks granted. Desktop Chromium
 * is lenient enough that none of this reproduces in CI, so the failure is
 * invisible until it is on a handset.
 *
 * WKWebView also suspends contexts when the app goes to the background, so
 * unlocking once at startup is not enough — a child who leaves the app mid-game
 * and comes back needs the next touch to unlock it again. Hence `armed`, which
 * is re-set on every suspension rather than latched forever.
 */

type MaybeContext = AudioContext | undefined;

const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const;

let armed = false;
let shared: MaybeContext;

function contextClass(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/**
 * Plays one sample of silence.
 *
 * Older iOS will not consider the audio hardware unlocked until something has
 * actually been routed to the destination, so resuming alone is not enough.
 */
function nudge(context: AudioContext): void {
  try {
    const buffer = context.createBuffer(1, 1, 22050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
  } catch {
    // A context torn down between the check and the call. Nothing to recover.
  }
}

/** Resumes a context if it needs it. Safe to call on any state, any platform. */
export async function unlockContext(context: AudioContext): Promise<void> {
  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      // Still no gesture. The listeners below will try again on the next one.
    }
  }
  if (context.state === 'running') nudge(context);
}

/**
 * The shared context, created lazily so that merely importing this module does
 * not construct one — Safari caps how many a page may hold, and the voice meter
 * makes its own per session.
 */
export function sharedContext(): MaybeContext {
  const Ctx = contextClass();
  if (!Ctx) return undefined;
  if (!shared) shared = new Ctx();
  return shared;
}

function onGesture(): void {
  const context = sharedContext();
  if (!context) return;
  void unlockContext(context).then(() => {
    if (context.state === 'running') disarm();
  });
}

function disarm(): void {
  if (!armed) return;
  armed = false;
  for (const type of GESTURES) {
    window.removeEventListener(type, onGesture, true);
  }
}

/**
 * Arms the next user gesture to unlock audio. Idempotent.
 *
 * Capture phase, so a component that stops propagation on its own buttons — the
 * games all do — cannot swallow the one touch that would have unlocked sound.
 */
export function armAudioUnlock(): void {
  if (armed || typeof window === 'undefined') return;
  if (!contextClass()) return;
  armed = true;
  for (const type of GESTURES) {
    window.addEventListener(type, onGesture, true);
  }
}

/**
 * Call once at startup. Arms the first gesture, and re-arms whenever the
 * platform suspends the context behind our back.
 */
export function primeAudio(): void {
  if (typeof window === 'undefined') return;
  armAudioUnlock();

  const context = sharedContext();
  if (context) {
    // iOS suspends on background; the next touch has to count as a fresh unlock.
    context.addEventListener('statechange', () => {
      if (context.state === 'suspended') armAudioUnlock();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') armAudioUnlock();
  });
}

/** Test seam: forget everything this module is holding. */
export function resetAudioUnlock(): void {
  disarm();
  shared = undefined;
}
