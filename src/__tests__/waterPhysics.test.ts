import { describe, expect, it } from 'vitest';
import {
  COLUMNS,
  LEDGE_X,
  NO_LAP,
  REST_DEPTH,
  SLOSH_SECONDS,
  buildPool,
  isPoolComplete,
  stepWater,
  surfaceAt,
  velocityAt,
  volume,
  type LapState,
  type Pool,
} from '../engine/waterPhysics';

const DT = 1 / 60;

/** Drives a pool for `seconds`, reporting what a player would notice. */
function drive(level: number, tilt: (t: number) => number, seconds: number) {
  let pool: Pool = buildPool(level);
  let lap: LapState = NO_LAP;
  let rise = 0;
  let laps = 0;
  let homes = 0;
  let minDepth = Infinity;
  let cleared: number | null = null;

  for (let f = 0; f * DT < seconds; f += 1) {
    const r = stepWater(pool, { tiltX: tilt(f * DT), dt: DT }, lap);
    pool = r.pool;
    lap = r.lap;
    laps += r.events.filter((e) => e.kind === 'lap').length;
    homes += r.events.filter((e) => e.kind === 'home').length;
    rise = Math.max(rise, pool.water.h[COLUMNS - 1] - REST_DEPTH);
    minDepth = Math.min(minDepth, ...pool.water.h);
    if (cleared === null && isPoolComplete(pool)) cleared = f * DT;
  }
  return { pool, rise, laps, homes, minDepth, cleared };
}

/** A sine, because resonance is the whole mechanic. */
const rock = (hz: number, amp = 1) => (t: number) => Math.sin(t * 2 * Math.PI * hz) * amp;

describe('Moon Pool water', () => {
  it('leaves still water still', () => {
    const r = drive(1, () => 0, 4);
    expect(r.rise).toBe(0);
    expect(r.laps).toBe(0);
    expect(r.pool.water.h.every((h) => h === REST_DEPTH)).toBe(true);
  });

  it('conserves every drop, even under a violent drive', () => {
    let pool = buildPool(5);
    let lap = NO_LAP;
    const start = volume(pool.water);
    for (let f = 0; f < 60 * 20; f += 1) {
      // Deliberately horrible: full-scale, aperiodic, with long frames mixed in.
      const tilt = Math.sin(f * 0.31) * Math.cos(f * 0.07);
      const r = stepWater(pool, { tiltX: tilt, dt: f % 7 === 0 ? 1 / 12 : DT }, lap);
      pool = r.pool;
      lap = r.lap;
    }
    expect(volume(pool.water)).toBeCloseTo(start, 6);
  });

  it('never goes dry or NaN under that same drive', () => {
    let pool = buildPool(5);
    let lap = NO_LAP;
    for (let f = 0; f < 60 * 20; f += 1) {
      const r = stepWater(pool, { tiltX: Math.sin(f * 0.31) * Math.cos(f * 0.07), dt: DT }, lap);
      pool = r.pool;
      lap = r.lap;
    }
    for (const h of pool.water.h) {
      expect(Number.isFinite(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      // The pool is 1.0 tall. Anything near that under an ordinary drive means
      // the integrator is pumping in energy, which is how the first one failed.
      expect(h).toBeLessThan(1.4);
    }
  });

  it('tips the surface toward the held side', () => {
    const r = drive(1, () => 1, 3);
    const h = r.pool.water.h;
    expect(h[COLUMNS - 1]).toBeGreaterThan(REST_DEPTH);
    expect(h[0]).toBeLessThan(REST_DEPTH);
  });

  /*
   * The claim the whole game rests on. If rocking at the pool's own rhythm did
   * not beat rocking at twice it, the levels would just be a strength contest
   * and there would be no skill to learn.
   */
  it('answers the right rhythm far more than the wrong one', () => {
    const onBeat = drive(5, rock(0.8), 20).rise;
    const tooFast = drive(5, rock(1.6), 20).rise;
    const tooSlow = drive(5, rock(0.3), 20).rise;
    const tipped = drive(5, () => 1, 20).rise;

    // Above resonance the pool stops listening: the drive reverses before the
    // water has finished answering the last one.
    expect(onBeat).toBeGreaterThan(tooFast * 3);

    /*
     * Below it, though, the pool simply follows the phone. Rocking slowly is
     * tipping slowly, so the response bottoms out at the held-tilt tilt rather
     * than at nothing — there is no "too slow to do anything". What has to be
     * true is that neither slow rocking nor tipping gets anywhere near what
     * the right rhythm gets, because that gap IS the levels.
     */
    expect(tooSlow).toBeLessThan(onBeat * 0.6);
    expect(tipped).toBeLessThan(onBeat * 0.6);
  });

  /*
   * The moon the game swings above the pool is driven by SLOSH_SECONDS, and a
   * child is asked to rock along with it. That only teaches anything if the
   * formula matches the water, so this is the one place the two are tied.
   */
  it('slosh at the period it advertises to the child', () => {
    let best = { hz: 0, rise: 0 };
    for (let hz = 0.4; hz <= 1.6; hz += 0.02) {
      const rise = drive(1, rock(hz), 16).rise;
      if (rise > best.rise) best = { hz, rise };
    }
    expect(best.hz).toBeCloseTo(1 / SLOSH_SECONDS, 1);
  });

  it('sloshes at a rhythm a child can actually rock a phone at', () => {
    let best = { hz: 0, rise: 0 };
    for (let hz = 0.3; hz <= 2.0; hz += 0.05) {
      const rise = drive(1, rock(hz), 16).rise;
      if (rise > best.rise) best = { hz, rise };
    }
    // Roughly a walking rhythm. Faster than ~2Hz is a wrist spasm, slower than
    // ~0.6Hz feels like the pool is ignoring you.
    expect(best.hz).toBeGreaterThan(0.6);
    expect(best.hz).toBeLessThan(1.3);
  });

  it('gives level 1 away to a child who only tips the phone', () => {
    expect(drive(1, () => 1, 20).cleared).not.toBeNull();
  });

  it('will not give away any later level for a tip alone', () => {
    for (const level of [2, 3, 4, 5]) {
      expect(drive(level, () => 1, 25).cleared).toBeNull();
    }
  });

  it('opens every level to a child who finds the rhythm', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const r = drive(level, rock(0.8), 30);
      expect(r.cleared).not.toBeNull();
      expect(r.homes).toBe(buildPool(level).seeds.length);
    }
  });

  /*
   * A real child is not a signal generator: the rate wanders and the amplitude
   * sags. If only a clean sine cleared the game, the game would be unplayable
   * and the tests above would never say so.
   */
  it('forgives a wobbly, human rhythm', () => {
    let phase = 0;
    let last = 0;
    const wobbly = (t: number) => {
      phase += 2 * Math.PI * (0.8 * (1 + 0.25 * Math.sin(t * 1.7))) * (t - last);
      last = t;
      return Math.sin(phase) * (0.75 + 0.25 * Math.sin(t * 0.9));
    };
    expect(drive(5, wobbly, 30).cleared).not.toBeNull();
  });

  /*
   * The same mistake the tilt game made: a wave held against a wall re-reports
   * contact every frame, and 60 water sounds a second is a hiss, not a pool.
   */
  it('reports laps as events, not as a per-frame state', () => {
    const r = drive(1, rock(0.8), 10);
    expect(r.laps).toBeGreaterThan(4);
    expect(r.laps).toBeLessThan(40);
  });

  it('holds a seed still once it is home', () => {
    const r = drive(1, rock(0.8), 30);
    expect(r.pool.seeds[0].home).toBe(true);
    const after = stepWater(r.pool, { tiltX: -1, dt: DT }, NO_LAP);
    expect(after.pool.seeds[0]).toEqual(r.pool.seeds[0]);
    expect(after.events.some((e) => e.kind === 'home')).toBe(false);
  });

  it('drifts a seed to the ledge even if nobody does anything', () => {
    const r = drive(1, () => 0, 20);
    expect(r.pool.seeds[0].x).toBeGreaterThan(LEDGE_X);
    // Drifting there is not clearing it: the lift is still the child's job.
    expect(r.cleared).toBeNull();
  });

  it('never flings a seed backwards out of reach', () => {
    for (const hz of [0.6, 0.8, 1.0]) {
      const r = drive(5, rock(hz), 25);
      // The third seed starts at 0.08; nothing may end up behind its start.
      expect(r.minDepth).toBeGreaterThan(0);
      expect(Math.min(...r.pool.seeds.map((s) => s.x))).toBeGreaterThan(0.07);
    }
  });

  it('clamps a dropped frame instead of teleporting the pool', () => {
    const pool = buildPool(3);
    const long = stepWater(pool, { tiltX: 1, dt: 5 }, NO_LAP);
    const capped = stepWater(pool, { tiltX: 1, dt: 1 / 15 }, NO_LAP);
    expect(long.pool.water.h).toEqual(capped.pool.water.h);
  });

  it('samples the surface and the flow at both edges without blowing up', () => {
    const pool = buildPool(2);
    for (const x of [0, 0.0001, 0.5, 0.9999, 1]) {
      expect(surfaceAt(pool.water, x)).toBeCloseTo(REST_DEPTH, 6);
      expect(Number.isFinite(velocityAt(pool.water, x))).toBe(true);
    }
  });
});

describe('the Moon Pool ladder', () => {
  it('raises the ledge every level and never takes a seed away', () => {
    const pools = [1, 2, 3, 4, 5].map(buildPool);
    for (let i = 1; i < pools.length; i += 1) {
      expect(pools[i].ledge).toBeGreaterThan(pools[i - 1].ledge);
      expect(pools[i].seeds.length).toBeGreaterThanOrEqual(pools[i - 1].seeds.length);
    }
  });

  it('starts every seed in the water and short of the ledge', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      for (const seed of buildPool(level).seeds) {
        expect(seed.x).toBeGreaterThan(0);
        expect(seed.x).toBeLessThan(LEDGE_X);
        expect(seed.home).toBe(false);
      }
    }
  });

  it('clamps a level out of range instead of building a broken pool', () => {
    expect(buildPool(0).ledge).toBe(buildPool(1).ledge);
    expect(buildPool(99).ledge).toBe(buildPool(5).ledge);
    expect(buildPool(2.4).seeds.length).toBe(buildPool(2).seeds.length);
  });
});
