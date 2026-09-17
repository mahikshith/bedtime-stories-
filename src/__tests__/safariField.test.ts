import { describe, expect, it } from 'vitest';
import {
  DWELL,
  buildMeadow,
  look,
  meadowComplete,
  stillAsleep,
  type Meadow,
} from '../engine/safariField';

const DT = 1 / 60;

/** Rests the lantern on a sleeper for `seconds`, without moving. */
function rest(meadow: Meadow, index: number, seconds: number) {
  let m = meadow;
  const events = [];
  const target = meadow.sleepers[index];
  for (let f = 0; f * DT < seconds; f += 1) {
    const r = look(m, { at: { x: target.x, y: target.y }, speed: 0, dt: DT });
    m = r.meadow;
    events.push(...r.events);
  }
  return { meadow: m, events };
}

describe('the dark meadow', () => {
  it('starts with everyone asleep', () => {
    const m = buildMeadow(1);
    expect(m.sleepers.every((s) => !s.found)).toBe(true);
    expect(meadowComplete(m)).toBe(false);
    expect(stillAsleep(m)).toBe(m.sleepers.length);
  });

  it('is the same meadow every time you come back to a level', () => {
    const a = buildMeadow(3);
    const b = buildMeadow(3);
    expect(a.sleepers.map((s) => [s.x, s.y])).toEqual(b.sleepers.map((s) => [s.x, s.y]));
  });

  it('never hides two animals under one lantern', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const m = buildMeadow(level);
      for (let i = 0; i < m.sleepers.length; i += 1) {
        for (let j = i + 1; j < m.sleepers.length; j += 1) {
          const d = Math.hypot(m.sleepers[i].x - m.sleepers[j].x, m.sleepers[i].y - m.sleepers[j].y);
          expect(d, `level ${level}, ${i} and ${j}`).toBeGreaterThan(m.radius);
        }
      }
    }
  });

  it('keeps every animal on screen', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      for (const s of buildMeadow(level).sleepers) {
        expect(s.x).toBeGreaterThan(0.05);
        expect(s.x).toBeLessThan(0.95);
        expect(s.y).toBeGreaterThan(0.05);
        expect(s.y).toBeLessThan(0.95);
      }
    }
  });

  it('rouses an animal the lantern rests on', () => {
    const { meadow, events } = rest(buildMeadow(1), 0, DWELL + 0.2);
    expect(meadow.sleepers[0].found).toBe(true);
    expect(events.filter((e) => e.kind === 'found')).toHaveLength(1);
    expect(events.filter((e) => e.kind === 'stir')).toHaveLength(1);
  });

  it('will not rouse one the lantern only passes over', () => {
    const { meadow } = rest(buildMeadow(1), 0, DWELL * 0.5);
    expect(meadow.sleepers[0].found).toBe(false);
  });

  /*
   * The rule that makes this a wind-down game rather than a scrubbing game.
   * Without it a child clears a level in two seconds by rubbing the screen,
   * which is the exact opposite of what the evening needs.
   */
  it('finds nothing at all for a lantern that races', () => {
    let m = buildMeadow(1);
    const target = m.sleepers[0];
    for (let f = 0; f < 600; f += 1) {
      m = look(m, { at: { x: target.x, y: target.y }, speed: 3, dt: DT }).meadow;
    }
    expect(m.sleepers[0].found).toBe(false);
  });

  it('forgives a wobbling finger rather than resetting it', () => {
    let m = buildMeadow(1);
    const t = m.sleepers[0];
    // On for a while, off for one frame, back on: this must still land.
    for (let f = 0; f < 30; f += 1) {
      m = look(m, { at: { x: t.x, y: t.y }, speed: 0.1, dt: DT }).meadow;
    }
    const before = m.sleepers[0].dwell;
    m = look(m, { at: { x: t.x + 0.9, y: t.y }, speed: 0.1, dt: DT }).meadow;
    expect(m.sleepers[0].dwell).toBeGreaterThan(before - DWELL * 0.5);
    expect(m.sleepers[0].dwell).toBeLessThan(before);
  });

  it('warms as the lantern nears something asleep', () => {
    const m = buildMeadow(1);
    const t = m.sleepers[0];
    const near = look(m, { at: { x: t.x, y: t.y }, speed: 0, dt: DT }).warmth;
    const far = look(m, { at: { x: 0.02, y: 0.98 }, speed: 0, dt: DT }).warmth;
    expect(near).toBeGreaterThan(0.9);
    expect(far).toBeLessThan(near);
  });

  it('goes cold once everyone is awake, so it cannot point at nothing', () => {
    const m = buildMeadow(1);
    const woken: Meadow = { ...m, sleepers: m.sleepers.map((s) => ({ ...s, found: true })) };
    const t = m.sleepers[0];
    expect(look(woken, { at: { x: t.x, y: t.y }, speed: 0, dt: DT }).warmth).toBe(0);
  });

  it('does nothing at all with no finger down', () => {
    let m = buildMeadow(2);
    for (let f = 0; f < 300; f += 1) {
      const r = look(m, { at: null, speed: 0, dt: DT });
      m = r.meadow;
      expect(r.events).toHaveLength(0);
      expect(r.warmth).toBe(0);
    }
    expect(stillAsleep(m)).toBe(buildMeadow(2).sleepers.length);
  });

  it('leaves a found animal found, and silent', () => {
    const { meadow } = rest(buildMeadow(1), 0, DWELL + 0.3);
    const again = rest(meadow, 0, 1);
    expect(again.meadow.sleepers[0].found).toBe(true);
    expect(again.events).toHaveLength(0);
  });

  it('can be finished', () => {
    let m = buildMeadow(2);
    for (let i = 0; i < m.sleepers.length; i += 1) m = rest(m, i, DWELL + 0.2).meadow;
    expect(meadowComplete(m)).toBe(true);
    expect(stillAsleep(m)).toBe(0);
  });

  it('clamps a dropped frame instead of waking the whole meadow at once', () => {
    const m = buildMeadow(1);
    const t = m.sleepers[0];
    const long = look(m, { at: { x: t.x, y: t.y }, speed: 0, dt: 9 });
    expect(long.meadow.sleepers[0].found).toBe(false);
  });
});

describe('the Flashlight Safari ladder', () => {
  it('adds animals and shrinks the lantern every level', () => {
    const meadows = [1, 2, 3, 4, 5].map(buildMeadow);
    for (let i = 1; i < meadows.length; i += 1) {
      expect(meadows[i].sleepers.length).toBeGreaterThan(meadows[i - 1].sleepers.length);
      expect(meadows[i].radius).toBeLessThan(meadows[i - 1].radius);
    }
  });

  it('clamps a level out of range', () => {
    expect(buildMeadow(0).sleepers.length).toBe(buildMeadow(1).sleepers.length);
    expect(buildMeadow(99).sleepers.length).toBe(buildMeadow(5).sleepers.length);
  });
});
