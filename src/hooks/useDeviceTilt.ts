import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Device tilt for the motion games.
 *
 * Two things about this API bite hard and neither reproduces on a desktop:
 *
 * 1. **iOS 13+ requires `requestPermission()` to be called from inside a user
 *    gesture.** Called on mount it rejects, the hook lands in `denied`, and no
 *    listener is ever attached — dead on every iPhone, fine in Chrome. So this
 *    hook never asks on its own: a game calls `request()` from a button press.
 * 2. **`deviceorientation` fires at 60Hz, and 120Hz on ProMotion.** Calling
 *    setState per event re-renders the tree every frame, which no physics sim
 *    survives. Readings land in a ref; the game reads them inside its own
 *    animation frame, exactly like `useVoiceMeter` drains the audio meter.
 *
 * Motion is never required. Every game that uses this ships a touch fallback,
 * because permission can be refused, the sensor can be absent, and a parent may
 * simply not want the prompt.
 */

export type TiltPermission = 'unsupported' | 'prompt' | 'granted' | 'denied';

export interface Tilt {
  /** Left/right, -1..1. */
  x: number;
  /** Front/back, -1..1, calibrated for a phone held at a natural angle. */
  y: number;
  /**
   * Which way the phone is pointing, 0..1 around the circle.
   *
   * `alpha`, the third axis, and a different gesture from the other two: the
   * phone held flat and turned like a wheel rather than leaned. Absolute rather
   * than a delta, and it wraps — consumers must compare with a shortest-way
   * subtraction, never a plain one, or a dial jumps a whole turn every time it
   * crosses north.
   */
  spin: number;
}

interface IosOrientationEvent {
  requestPermission?: () => Promise<PermissionState | 'granted' | 'denied'>;
}

/** Degrees of tilt that map to full deflection. Gentle on purpose: a child. */
const RANGE_DEG = 38;
/** Children hold a phone tipped toward themselves; 20° reads as level. */
const RESTING_PITCH_DEG = 20;

function supported(): boolean {
  return typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined';
}

function needsPrompt(): boolean {
  if (!supported()) return false;
  const ctor = window.DeviceOrientationEvent as unknown as IosOrientationEvent;
  return typeof ctor.requestPermission === 'function';
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export function useDeviceTilt(options: { damping?: number } = {}) {
  const damping = options.damping ?? 0.16;
  const [permission, setPermission] = useState<TiltPermission>(() =>
    !supported() ? 'unsupported' : needsPrompt() ? 'prompt' : 'granted',
  );

  const tilt = useRef<Tilt>({ x: 0, y: 0, spin: 0 });
  const listening = useRef(false);
  const mounted = useRef(true);
  const lastEvent = useRef(0);

  const handle = useCallback(
    (event: DeviceOrientationEvent) => {
      const now = performance.now();
      const dt = lastEvent.current ? Math.min(100, now - lastEvent.current) : 16;
      lastEvent.current = now;

      const targetX = clamp((event.gamma ?? 0) / RANGE_DEG);
      const targetY = clamp(((event.beta ?? 0) - RESTING_PITCH_DEG) / RANGE_DEG);

      /*
       * Frame-rate independent smoothing. A fixed per-event factor smooths
       * twice as fast on a 120Hz phone as on a 60Hz one, so the same game
       * feels different on two devices in the same room.
       */
      const k = 1 - Math.pow(1 - damping, dt / 16.67);
      tilt.current = {
        x: tilt.current.x + (targetX - tilt.current.x) * k,
        y: tilt.current.y + (targetY - tilt.current.y) * k,
        // Not smoothed, and deliberately: smoothing a wrapping value averages
        // 0.99 and 0.01 to 0.5, which points the phone due south once per turn.
        spin: ((event.alpha ?? 0) / 360 + 1) % 1,
      };
    },
    [damping],
  );

  const attach = useCallback(() => {
    if (listening.current || !supported()) return;
    listening.current = true;
    window.addEventListener('deviceorientation', handle);
  }, [handle]);

  /** Call from a user gesture — a button press, never an effect. */
  const request = useCallback(async (): Promise<TiltPermission> => {
    if (!supported()) {
      setPermission('unsupported');
      return 'unsupported';
    }
    const ctor = window.DeviceOrientationEvent as unknown as IosOrientationEvent;
    if (typeof ctor.requestPermission !== 'function') {
      attach();
      if (mounted.current) setPermission('granted');
      return 'granted';
    }
    try {
      const result = await ctor.requestPermission();
      const next: TiltPermission = result === 'granted' ? 'granted' : 'denied';
      // The prompt outlives the component if a child leaves mid-dialog; a
      // listener attached after unmount would never be removed.
      if (!mounted.current) return next;
      if (next === 'granted') attach();
      setPermission(next);
      return next;
    } catch {
      if (mounted.current) setPermission('denied');
      return 'denied';
    }
  }, [attach]);

  useEffect(() => {
    mounted.current = true;
    // Android and desktop need no prompt, so start immediately.
    if (supported() && !needsPrompt()) attach();
    return () => {
      mounted.current = false;
      listening.current = false;
      window.removeEventListener('deviceorientation', handle);
    };
  }, [attach, handle]);

  /** Read inside your own rAF loop. Never triggers a render. */
  const read = useCallback((): Tilt => tilt.current, []);

  return { read, request, permission, available: permission === 'granted' };
}
