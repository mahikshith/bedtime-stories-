import { useCallback, useEffect, useRef } from 'react';
import { advance, makeRig, poseOf, setGesture, stretchOf, type Gesture, type Rig } from './rig';

/**
 * Runs the rig and paints it, without React rendering a single frame.
 *
 * Fourteen channels change sixty times a second and React needs to know about
 * none of them, so they are written straight onto the SVG element as custom
 * properties and the stylesheet does the rest.
 *
 * Anything the CSS would otherwise have to compute is computed here instead.
 * A `calc()` that fails does so silently and takes its whole transform with it,
 * and a mascot with one limb stuck at the origin is a bug nobody can see the
 * cause of.
 */
export function useMascotRig(options: { energy?: number; gesture?: Gesture } = {}) {
  const node = useRef<SVGSVGElement>(null);
  const rig = useRef<Rig>(makeRig());
  const energy = options.energy ?? 1;
  const resting = options.gesture ?? 'idle';

  /** Fire a one-shot gesture. Safe to call mid-gesture; it restarts cleanly. */
  const trigger = useCallback((gesture: Gesture) => {
    rig.current = setGesture(rig.current, gesture);
  }, []);

  useEffect(() => {
    rig.current = setGesture(rig.current, resting);
  }, [resting]);

  useEffect(() => {
    const el = node.current;
    if (!el) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(1 / 15, (now - last) / 1000);
      last = now;
      rig.current = advance(rig.current, dt, { energy });
      const p = poseOf(rig.current);

      const set = (name: string, value: number, digits = 3) =>
        el.style.setProperty(name, value.toFixed(digits));

      set('--lift', p.lift, 2);
      set('--squash', 1 + p.squash);
      set('--stretch', stretchOf(p.squash));
      set('--body-rot', p.bodyRot, 2);
      set('--head-rot', p.headRot, 2);
      set('--crest-rot', p.crestRot, 2);
      set('--tail-rot', p.tailRot, 2);
      set('--wing-l', p.wingL, 2);
      set('--wing-r', p.wingR, 2);
      set('--lids', p.lids);
      set('--beak', p.beak);
      set('--grounded', p.grounded);

      /*
       * The revolve, resolved here rather than in CSS.
       *
       * `turn` is a full 0..1 revolution. The features do not merely slide —
       * they swing round a cylinder, so their horizontal offset is a sine and
       * their foreshortening is a cosine. Past a quarter turn the face is
       * pointing away and the back of the head takes over; crossfading them is
       * what makes it read as one head turning rather than two pictures.
       */
      const a = p.turn * Math.PI * 2;
      const facing = Math.cos(a);
      set('--feat-x', Math.sin(a) * 26, 2);
      set('--feat-squeeze', Math.max(0.12, Math.abs(facing)));
      // Fade over a narrow band around the profile, so the swap is hidden by
      // the moment the face is edge-on and almost nothing of it is visible.
      set('--face-op', clamp01((facing + 0.18) / 0.36));
      set('--back-op', clamp01((-facing + 0.18) / 0.36));
      // The near wing and the tail trade places as she comes round.
      set('--depth', facing, 3);
      set('--gaze-x', p.gazeX * 7 * Math.max(0, facing), 2);
      set('--gaze-y', p.gazeY * 5, 2);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [energy]);

  return { ref: node, trigger };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
