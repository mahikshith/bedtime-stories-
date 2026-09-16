import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The tilt hook's two load-bearing properties cannot be observed in jsdom —
 * there is no DeviceOrientationEvent and no sensor — but both are the kind of
 * thing a refactor silently undoes, and both fail only on a real iPhone. So
 * they are asserted against the source, the way the mobile platform layer is.
 */
const SOURCE = readFileSync('src/hooks/useDeviceTilt.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('tilt permission', () => {
  it('never requests permission from an effect', () => {
    // iOS 13+ rejects requestPermission() outside a user gesture: the hook
    // would land in `denied` on every iPhone and work fine in Chrome.
    const effects = SOURCE.split('useEffect(');
    for (const body of effects.slice(1)) {
      expect(body.slice(0, body.indexOf('}, ['))).not.toContain('requestPermission');
    }
  });

  it('exposes request() so a button press can own the prompt', () => {
    expect(SOURCE).toMatch(/const request = useCallback\(async/);
  });

  it('does not attach a listener after unmount', () => {
    // The prompt outlives the component if a child leaves it open.
    expect(SOURCE).toContain('if (!mounted.current) return next;');
  });
});

describe('tilt readings', () => {
  it('lands in a ref, never in state', () => {
    // deviceorientation fires at 60Hz, 120Hz on ProMotion. setState per event
    // re-renders the tree every frame and no physics sim survives it.
    expect(SOURCE).toContain('tilt.current =');
    expect(SOURCE).not.toMatch(/setTilt\(/);
  });

  it('smooths on elapsed time, not per event', () => {
    // A fixed per-event factor smooths twice as fast on a 120Hz phone, so the
    // same game feels different on two devices sitting next to each other.
    expect(SOURCE).toMatch(/Math\.pow\(1 - damping, dt \/ 16\.67\)/);
  });
});

describe('degradation', () => {
  it('reports unsupported rather than pretending', () => {
    expect(SOURCE).toContain("'unsupported'");
    expect(SOURCE).toContain("'denied'");
  });
});
