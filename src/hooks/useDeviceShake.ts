import { useCallback, useEffect, useRef, useState } from 'react';
import type { TiltPermission } from './useDeviceTilt';

/**
 * Waving the phone through the air.
 *
 * A different sensor from `useDeviceTilt`, and a different permission: tilt is
 * `DeviceOrientationEvent` (which way is the phone pointing), this is
 * `DeviceMotionEvent` (how hard is it being moved). iOS gates them separately,
 * so granting one grants nothing about the other, and both have to be asked for
 * from inside a user gesture.
 *
 * What comes out is a **swing**, not a shake count: how hard the phone is
 * moving right now (0..1) and which way. A child waving a phone to fan
 * something along is making a continuous gesture, and reducing it to discrete
 * "shake!" events throws away everything that made it feel physical.
 *
 * Gravity is subtracted rather than trusted: `acceleration` is null on a great
 * many Android browsers, so the useful field is
 * `accelerationIncludingGravity`, and the 1g in it has to be removed with a
 * slow-following baseline or every reading reports a permanent 9.8.
 */

export interface Swing {
  /** Movement energy, 0..1. Zero when the phone is held still. */
  power: number;
  /** -1..1. Which way the phone is being swept, left or right. */
  dir: number;
}

interface IosMotionEvent {
  requestPermission?: () => Promise<PermissionState | 'granted' | 'denied'>;
}

/** m/s² of movement that reads as full power. A child's wave, not an adult's. */
const FULL_SWING = 9;
/** How fast the gravity baseline follows. Slow: it must not track the wave. */
const BASELINE = 0.6;
/** Power decays this fast once the phone stops, so it feels like air settling. */
const SETTLE = 3.2;

function supported(): boolean {
  return typeof window !== 'undefined' && typeof window.DeviceMotionEvent !== 'undefined';
}

function needsPrompt(): boolean {
  if (!supported()) return false;
  const ctor = window.DeviceMotionEvent as unknown as IosMotionEvent;
  return typeof ctor.requestPermission === 'function';
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function useDeviceShake() {
  const [permission, setPermission] = useState<TiltPermission>(() =>
    !supported() ? 'unsupported' : needsPrompt() ? 'prompt' : 'granted',
  );

  const swing = useRef<Swing>({ power: 0, dir: 0 });
  const baseline = useRef<{ x: number; y: number; z: number } | null>(null);
  const listening = useRef(false);
  const mounted = useRef(true);
  const lastEvent = useRef(0);

  const handle = useCallback((event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity ?? event.acceleration;
    if (!a) return;
    const x = a.x ?? 0;
    const y = a.y ?? 0;
    const z = a.z ?? 0;

    const now = performance.now();
    const dt = lastEvent.current ? Math.min(0.1, (now - lastEvent.current) / 1000) : 1 / 60;
    lastEvent.current = now;

    if (!baseline.current) baseline.current = { x, y, z };
    const b = baseline.current;
    const follow = 1 - Math.exp(-BASELINE * dt);
    b.x += (x - b.x) * follow;
    b.y += (y - b.y) * follow;
    b.z += (z - b.z) * follow;

    const dx = x - b.x;
    const power = clamp(Math.hypot(dx, y - b.y, z - b.z) / FULL_SWING, 0, 1);
    // Rise instantly, fall slowly: the puff of air a wave makes outlasts the wave.
    const decayed = swing.current.power * Math.exp(-SETTLE * dt);
    swing.current = {
      power: Math.max(power, decayed),
      dir: Math.abs(dx) > 0.4 ? clamp(dx / FULL_SWING, -1, 1) : swing.current.dir * 0.9,
    };
  }, []);

  const attach = useCallback(() => {
    if (listening.current || !supported()) return;
    listening.current = true;
    window.addEventListener('devicemotion', handle);
  }, [handle]);

  /** Call from a user gesture — a button press, never an effect. */
  const request = useCallback(async (): Promise<TiltPermission> => {
    if (!supported()) {
      setPermission('unsupported');
      return 'unsupported';
    }
    const ctor = window.DeviceMotionEvent as unknown as IosMotionEvent;
    if (typeof ctor.requestPermission !== 'function') {
      attach();
      if (mounted.current) setPermission('granted');
      return 'granted';
    }
    try {
      const result = await ctor.requestPermission();
      const next: TiltPermission = result === 'granted' ? 'granted' : 'denied';
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
    if (supported() && !needsPrompt()) attach();
    return () => {
      mounted.current = false;
      listening.current = false;
      window.removeEventListener('devicemotion', handle);
    };
  }, [attach, handle]);

  /**
   * Read inside your own rAF loop. Decays on read as well as on event, because
   * `devicemotion` simply stops firing on some devices when the phone is still
   * — leaving the last wave's power latched on forever.
   */
  const read = useCallback((dt = 1 / 60): Swing => {
    swing.current = { ...swing.current, power: swing.current.power * Math.exp(-SETTLE * dt) };
    return swing.current;
  }, []);

  return { read, request, permission, available: permission === 'granted' };
}
