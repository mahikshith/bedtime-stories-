import { describe, expect, it } from 'vitest';
import { MARBLE_R, buildField, isComplete, step, type Field } from '../engine/tiltPhysics';

function run(field: Field, tiltX: number, tiltY: number, frames: number) {
  let f = field;
  const hits: ReturnType<typeof step>['hits'] = [];
  let landed = false;
  for (let i = 0; i < frames; i++) {
    const r = step(f, { tiltX, tiltY, dt: 1 / 60 });
    f = r.field;
    hits.push(...r.hits);
    landed = landed || r.landed;
  }
  return { field: f, hits, landed };
}

const speed = (f: Field) => Math.hypot(f.marble.vx, f.marble.vy);

describe('rolling', () => {
  it('goes the way the phone is tilted', () => {
    const { field } = run(buildField(1), 1, 0, 30);
    expect(field.marble.x).toBeGreaterThan(0.5);
  });

  it('settles when the phone is held level', () => {
    // Exponential drag, not a subtraction: `v -= k * dt` flips the sign once
    // v drops below k * dt, and the marble jitters instead of stopping.
    const moving = { ...buildField(1), marble: { x: 0.5, y: 0.5, vx: 0.6, vy: 0 } };
    expect(speed(run(moving, 0, 0, 240).field)).toBeLessThan(0.01);
  });

  it('never reverses while drag is the only force', () => {
    const moving = { ...buildField(1), marble: { x: 0.5, y: 0.5, vx: 0.4, vy: 0 } };
    let f = moving;
    for (let i = 0; i < 300; i++) {
      f = step(f, { tiltX: 0, tiltY: 0, dt: 1 / 60 }).field;
      expect(f.marble.vx).toBeGreaterThanOrEqual(0);
    }
  });

  it('caps speed so a hard tilt cannot make the marble unfollowable', () => {
    const { field } = run(buildField(1), 1, 1, 600);
    expect(speed(field)).toBeLessThanOrEqual(1.21);
  });
});

describe('the field edges', () => {
  it('keeps the marble inside, whatever the tilt', () => {
    const { field } = run(buildField(1), 1, 1, 600);
    expect(field.marble.x).toBeLessThanOrEqual(1 - MARBLE_R + 1e-9);
    expect(field.marble.y).toBeLessThanOrEqual(1 - MARBLE_R + 1e-9);
    expect(field.marble.x).toBeGreaterThanOrEqual(MARBLE_R - 1e-9);
  });

  it('reports a wall hit once per contact, not once per frame', () => {
    // The marble rests against the wall under continuous tilt; a naive check
    // fires a thud every frame and the sound turns into a buzz.
    const { hits } = run(buildField(1), 1, 0, 300);
    expect(hits.filter((h) => h.kind === 'wall').length).toBeLessThan(12);
  });

  it('loses energy on a bounce', () => {
    const fast = { ...buildField(1), marble: { x: 0.9, y: 0.5, vx: 1.0, vy: 0 } };
    const { field } = run(fast, 0, 0, 20);
    expect(Math.abs(field.marble.vx)).toBeLessThan(1.0);
  });
});

describe('a backgrounded tab', () => {
  it('cannot teleport the marble through a wall', () => {
    // A phone that sleeps mid-game hands back a huge dt on the next frame.
    const f = buildField(1);
    const r = step(f, { tiltX: 1, tiltY: 1, dt: 30 });
    expect(r.field.marble.x).toBeLessThanOrEqual(1 - MARBLE_R + 1e-9);
    expect(Number.isFinite(r.field.marble.x)).toBe(true);
  });
});

describe('obstacles', () => {
  it('a sleeper nudges the marble toward the nest, never away', () => {
    // There is no fail state: hitting one is a small piece of luck.
    const field = buildField(2);
    const sleeper = field.obstacles[0];
    const before = Math.hypot(field.marble.x - field.goal.x, field.marble.y - field.goal.y);
    const at = { ...field, marble: { x: sleeper.x, y: sleeper.y + 0.1, vx: 0, vy: -0.5 } };
    const { field: after, hits } = run(at, 0, 0, 40);
    expect(hits.some((h) => h.kind === 'sleeper')).toBe(true);
    const now = Math.hypot(after.marble.x - field.goal.x, after.marble.y - field.goal.y);
    expect(now).toBeLessThan(before);
  });

  it('a bell rings once and stays rung', () => {
    const field = buildField(3);
    const bell = field.obstacles.find((o) => o.kind === 'bell')!;
    const at = { ...field, marble: { x: bell.x, y: bell.y + 0.16, vx: 0, vy: -0.6 } };
    const { field: after, hits } = run(at, 0, 0, 90);
    expect(hits.filter((h) => h.kind === 'bell').length).toBe(1);
    expect(after.obstacles.find((o) => o.kind === 'bell')!.rung).toBe(true);
  });

  it('never leaves the marble stuck inside an obstacle', () => {
    const field = buildField(4);
    let f = { ...field, marble: { x: field.obstacles[0].x, y: field.obstacles[0].y, vx: 0, vy: 0 } };
    f = step(f, { tiltX: 0, tiltY: 0, dt: 1 / 60 }).field;
    for (const o of f.obstacles) {
      expect(Math.hypot(f.marble.x - o.x, f.marble.y - o.y)).toBeGreaterThanOrEqual(o.r + MARBLE_R - 1e-9);
    }
  });
});

describe('levels', () => {
  it('opens with an empty field, because a child who fails screen one never sees screen two', () => {
    expect(buildField(1).obstacles).toEqual([]);
  });

  it('adds obstacles as it climbs and clamps at five', () => {
    const counts = [1, 2, 3, 4, 5].map((n) => buildField(n).obstacles.length);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(buildField(99).obstacles.length).toBe(buildField(5).obstacles.length);
  });

  it('needs every bell rung, not just the nest reached', () => {
    const field = buildField(3);
    expect(isComplete(field, true)).toBe(false);
    const rung = { ...field, obstacles: field.obstacles.map((o) => ({ ...o, rung: true })) };
    expect(isComplete(rung, true)).toBe(true);
  });

  it('is not complete until the marble actually arrives', () => {
    expect(isComplete(buildField(1), false)).toBe(false);
  });
});

describe('landing', () => {
  it('requires arriving, not passing through at speed', () => {
    const field = buildField(1);
    const fast = { ...field, marble: { x: field.goal.x, y: field.goal.y, vx: 1.0, vy: 0 } };
    expect(step(fast, { tiltX: 0, tiltY: 0, dt: 1 / 60 }).landed).toBe(false);
    const gentle = { ...field, marble: { x: field.goal.x, y: field.goal.y, vx: 0.05, vy: 0 } };
    expect(step(gentle, { tiltX: 0, tiltY: 0, dt: 1 / 60 }).landed).toBe(true);
  });
});
