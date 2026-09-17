import { describe, expect, it } from 'vitest';
import {
  FLYER_R,
  buildSky,
  driftRings,
  skyComplete,
  stepAir,
  type AirEvent,
  type Sky,
} from '../engine/airPhysics';

const DT = 1 / 60;

function fly(level: number, wave: (t: number) => { power: number; dir: number }, seconds: number) {
  let sky: Sky = buildSky(level);
  const events: AirEvent[] = [];
  let top = 1;
  for (let f = 0; f * DT < seconds; f += 1) {
    const r = stepAir(sky, { ...wave(f * DT), dt: DT });
    sky = driftRings(r.sky, DT);
    events.push(...r.events);
    top = Math.min(top, sky.flyer.y);
  }
  return { sky, events, top, cleared: skyComplete(sky) };
}

const still = () => ({ power: 0, dir: 0 });

describe('Firefly Air', () => {
  it('lets the seed rest on the ground when nobody waves', () => {
    const r = fly(1, still, 4);
    expect(r.sky.flyer.y).toBeCloseTo(1 - FLYER_R, 5);
    expect(r.events.filter((e) => e.kind === 'land')).toHaveLength(0);
    expect(r.cleared).toBe(false);
  });

  it('lifts the seed when the air moves', () => {
    const r = fly(1, () => ({ power: 1, dir: 0 }), 2);
    expect(r.top).toBeLessThan(0.5);
  });

  it('reports the lift off the ground exactly once', () => {
    const r = fly(1, (t) => (t < 1 ? { power: 1, dir: 0 } : still()), 1.4);
    expect(r.events.filter((e) => e.kind === 'lift')).toHaveLength(1);
  });

  it('fans the seed the way the wave goes', () => {
    const right = fly(1, () => ({ power: 0.8, dir: 1 }), 2).sky.flyer.x;
    const left = fly(1, () => ({ power: 0.8, dir: -1 }), 2).sky.flyer.x;
    expect(right).toBeGreaterThan(0.5);
    expect(left).toBeLessThan(0.5);
  });

  /*
   * The point of the indirection: the air keeps moving after the hand stops.
   * If the seed dropped the instant a child stopped waving, the game would be
   * a button-mash rather than something you anticipate.
   */
  it('keeps carrying the seed for a moment after the waving stops', () => {
    let sky = buildSky(1);
    for (let f = 0; f < 60; f += 1) sky = stepAir(sky, { power: 1, dir: 0, dt: DT }).sky;
    const atStop = sky.flyer.y;
    let rising = 0;
    for (let f = 0; f < 12; f += 1) {
      const next = stepAir(sky, { power: 0, dir: 0, dt: DT }).sky;
      if (next.flyer.y < sky.flyer.y) rising += 1;
      sky = next;
    }
    expect(rising).toBeGreaterThan(3);
    expect(sky.flyer.y).toBeLessThan(atStop + 0.05);
  });

  it('gives level 1 to steady waving', () => {
    expect(fly(1, () => ({ power: 1, dir: 0 }), 12).cleared).toBe(true);
  });

  it('will not give away level 5 to steady waving alone', () => {
    expect(fly(5, () => ({ power: 1, dir: 0 }), 20).cleared).toBe(false);
  });

  it('never lets the seed leave the sky', () => {
    let sky = buildSky(5);
    for (let f = 0; f < 60 * 20; f += 1) {
      sky = driftRings(
        stepAir(sky, { power: Math.abs(Math.sin(f * 0.23)), dir: Math.sin(f * 0.11), dt: DT }).sky,
        DT,
      );
      expect(sky.flyer.x).toBeGreaterThanOrEqual(FLYER_R - 1e-9);
      expect(sky.flyer.x).toBeLessThanOrEqual(1 - FLYER_R + 1e-9);
      expect(sky.flyer.y).toBeGreaterThanOrEqual(FLYER_R - 1e-9);
      expect(sky.flyer.y).toBeLessThanOrEqual(1 - FLYER_R + 1e-9);
    }
  });

  it('reports a ring once, however long the seed sits in it', () => {
    let sky = buildSky(1);
    let rings = 0;
    for (let f = 0; f < 60 * 15; f += 1) {
      const r = stepAir(sky, { power: 0.62, dir: 0, dt: DT });
      sky = r.sky;
      rings += r.events.filter((e) => e.kind === 'ring').length;
    }
    expect(rings).toBe(1);
  });

  it('does not thud every frame while the seed rests', () => {
    const r = fly(1, (t) => (t < 2 ? { power: 1, dir: 0 } : still()), 8);
    expect(r.events.filter((e) => e.kind === 'land').length).toBeLessThan(3);
  });

  it('clamps a dropped frame instead of teleporting the seed', () => {
    const sky = buildSky(3);
    const long = stepAir(sky, { power: 1, dir: 1, dt: 4 });
    const capped = stepAir(sky, { power: 1, dir: 1, dt: 1 / 20 });
    expect(long.sky.flyer).toEqual(capped.sky.flyer);
  });
});

describe('the Firefly Air ladder', () => {
  it('adds rings and shrinks them, never the other way', () => {
    const skies = [1, 2, 3, 4, 5].map(buildSky);
    for (let i = 1; i < skies.length; i += 1) {
      expect(skies[i].rings.length).toBeGreaterThanOrEqual(skies[i - 1].rings.length);
      const smallest = (s: Sky) => Math.min(...s.rings.map((r) => r.r));
      expect(smallest(skies[i])).toBeLessThanOrEqual(smallest(skies[i - 1]));
    }
  });

  it('starts level 1 still, and later levels moving', () => {
    expect(buildSky(1).rings.every((r) => r.drift === 0)).toBe(true);
    expect(buildSky(5).rings.some((r) => r.drift !== 0)).toBe(true);
  });

  it('bounces drifting rings off the edges instead of wrapping them', () => {
    let sky = buildSky(5);
    for (let f = 0; f < 60 * 30; f += 1) {
      const before = sky.rings.map((r) => r.x);
      sky = driftRings(sky, DT);
      sky.rings.forEach((r, i) => {
        expect(r.x).toBeGreaterThanOrEqual(r.r - 1e-9);
        expect(r.x).toBeLessThanOrEqual(1 - r.r + 1e-9);
        // No teleports: a ring may never jump more than a frame's worth.
        expect(Math.abs(r.x - before[i])).toBeLessThan(0.02);
      });
    }
  });

  it('stops a ring once it is passed, so the board settles as it is solved', () => {
    const sky = buildSky(5);
    const solved: Sky = { ...sky, rings: sky.rings.map((r) => ({ ...r, passed: true })) };
    expect(driftRings(solved, DT).rings.map((r) => r.x)).toEqual(sky.rings.map((r) => r.x));
  });

  it('clamps a level out of range', () => {
    expect(buildSky(0).rings.length).toBe(buildSky(1).rings.length);
    expect(buildSky(99).rings.length).toBe(buildSky(5).rings.length);
  });
});
