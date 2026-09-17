import { useEffect, useRef } from 'react';
import { clampPose, idlePose, type LifeOptions, type Pose } from './life';

/**
 * Drives the idle performance without re-rendering anything.
 *
 * The pose changes sixty times a second and React needs to know about none of
 * it, so it is written straight onto the SVG element as custom properties and
 * the stylesheet does the rest. Same discipline as the games: state is for what
 * is discrete, refs and the animation frame are for what is continuous.
 *
 * The properties are plain numbers. Signed values are split into ready-made
 * per-side factors here rather than reconstructed in CSS `calc()`, because a
 * `calc()` that fails does so silently and takes the whole transform with it.
 */
export function useMascotLife(enabled: boolean, options: LifeOptions = {}) {
  const node = useRef<SVGSVGElement>(null);
  const energy = options.energy ?? 1;
  const frozen = options.frozen ?? false;

  useEffect(() => {
    const el = node.current;
    if (!el) return;

    const write = (pose: Pose) => {
      const p = clampPose(pose);
      el.style.setProperty('--turn', p.turn.toFixed(4));
      el.style.setProperty('--lean', p.lean.toFixed(4));
      el.style.setProperty('--nod', p.nod.toFixed(4));
      el.style.setProperty('--breath', p.breath.toFixed(4));
      el.style.setProperty('--lid', p.lids.toFixed(4));
      // Turning right hides the right eye, which narrows; the left one widens
      // very slightly because it is coming toward the viewer.
      el.style.setProperty('--eye-l', (1 - Math.max(0, -p.turn) * 0.34).toFixed(4));
      el.style.setProperty('--eye-r', (1 - Math.max(0, p.turn) * 0.34).toFixed(4));
    };

    if (!enabled) {
      /*
       * Stop driving; do not force a neutral pose. Writing zeros here would
       * override any pose set on an ancestor, which is exactly how a caller
       * poses a still frame — and it made the turn sheet render the same bird
       * five times over.
       */
      for (const name of ['--turn', '--lean', '--nod', '--breath', '--lid', '--eye-l', '--eye-r']) {
        el.style.removeProperty(name);
      }
      return;
    }

    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      write(idlePose((now - started) / 1000, { energy, frozen }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, energy, frozen]);

  return node;
}
