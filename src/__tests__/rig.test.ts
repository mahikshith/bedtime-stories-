import { describe, expect, it } from 'vitest';
import {
  SPIN_SECONDS,
  advance,
  blinkAt,
  makeRig,
  poseOf,
  setGesture,
  stretchOf,
  type Gesture,
  type Pose,
  type Rig,
} from '../components/mascot/rig';

const DT = 1 / 60;

/** Runs a gesture and returns every frame of it. */
function play(gesture: Gesture, seconds: number, energy = 1): Pose[] {
  let rig: Rig = setGesture(makeRig(), gesture);
  const frames: Pose[] = [];
  for (let t = 0; t < seconds; t += DT) {
    rig = advance(rig, DT, { energy });
    frames.push(poseOf(rig));
  }
  return frames;
}

describe('the rig', () => {
  it('holds together for a long idle', () => {
    for (const pose of play('idle', 90)) {
      for (const [key, value] of Object.entries(pose)) {
        expect(Number.isFinite(value), key).toBe(true);
      }
      expect(Math.abs(pose.lift)).toBeLessThan(60);
      expect(Math.abs(pose.squash)).toBeLessThan(1);
      expect(pose.turn).toBeGreaterThanOrEqual(0);
      expect(pose.turn).toBeLessThan(1);
      expect(pose.lids).toBeGreaterThanOrEqual(0);
      expect(pose.lids).toBeLessThanOrEqual(1);
    }
  });

  it('moves on its own, without being asked to', () => {
    const frames = play('idle', 40);
    const spread = (get: (p: Pose) => number) =>
      Math.max(...frames.map(get)) - Math.min(...frames.map(get));
    expect(spread((p) => p.bodyRot)).toBeGreaterThan(1.5);
    expect(spread((p) => p.gazeX)).toBeGreaterThan(0.3);
  });

  /*
   * Anticipation. The crouch goes the WRONG way before the hop, and moving
   * opposite to a move before making it is what sells the move. Without it the
   * same hop reads as a jump cut, which is what the old CSS keyframe did.
   */
  it('crouches before it jumps', () => {
    const frames = play('hop', 1.2);
    const early = frames.slice(0, 9);
    expect(Math.max(...early.map((p) => p.lift))).toBeGreaterThan(1.5);
    // And then actually leaves the ground.
    expect(Math.min(...frames.map((p) => p.lift))).toBeLessThan(-18);
  });

  it('squashes on the landing, not in the air', () => {
    const frames = play('hop', 1.2);
    const airborne = frames.findIndex((p) => p.lift < -20);
    const landing = frames.slice(airborne).findIndex((p) => p.lift > -6) + airborne;
    expect(frames[airborne].squash).toBeLessThan(0.1);
    expect(Math.max(...frames.slice(landing, landing + 20).map((p) => p.squash)))
      .toBeGreaterThan(0.12);
  });

  it('comes back to rest after a hop, and stops asking for one', () => {
    const frames = play('hop', 2.5);
    const settled = frames.slice(-30);
    expect(Math.max(...settled.map((p) => Math.abs(p.lift)))).toBeLessThan(4);
    expect(Math.max(...settled.map((p) => Math.abs(p.squash)))).toBeLessThan(0.08);
  });

  it('lifts off the ground shadow as it rises', () => {
    const frames = play('hop', 1.2);
    const top = frames.reduce((a, b) => (a.lift < b.lift ? a : b));
    expect(top.grounded).toBeLessThan(0.5);
    expect(frames[frames.length - 1].grounded).toBeCloseTo(1, 1);
  });

  /*
   * Follow-through and overlapping action. Every part arrives late and in
   * order. Point them all at one target and everything moves together, which is
   * exactly what makes cheap character animation look cheap.
   */
  it('makes the crest arrive after the head, and the head after the body', () => {
    let rig = makeRig();
    let maxHeadLag = 0;
    let maxCrestLag = 0;
    for (let t = 0; t < 12; t += DT) {
      rig = advance(rig, DT);
      const p = poseOf(rig);
      maxHeadLag = Math.max(maxHeadLag, Math.abs(p.headRot - p.bodyRot * 1.5));
      maxCrestLag = Math.max(maxCrestLag, Math.abs(p.crestRot - p.headRot * 2.2));
    }
    expect(maxHeadLag).toBeGreaterThan(0.15);
    expect(maxCrestLag).toBeGreaterThan(0.3);
  });

  it('never mirrors the wings exactly', () => {
    const frames = play('cheer', 1.4);
    const lifted = frames.filter((p) => Math.abs(p.wingL) > 8);
    expect(lifted.length).toBeGreaterThan(10);
    expect(lifted.every((p) => Math.abs(p.wingL - p.wingR) > 0.5)).toBe(true);
  });

  /*
   * A spin has to take the long way round. Targeting an absolute, monotonic
   * turn is what stops the head unwinding back through where it came from,
   * which is what a wrapped 0..1 target does and it looks like a glitch.
   */
  it('goes all the way round rather than unwinding', () => {
    let rig = setGesture(makeRig(), 'spin');
    let previous = poseOf(rig).turn;
    let forward = 0;
    let backward = 0;
    for (let t = 0; t < 1.6; t += DT) {
      rig = advance(rig, DT);
      const turn = poseOf(rig).turn;
      let delta = turn - previous;
      if (delta > 0.5) delta -= 1;
      if (delta < -0.5) delta += 1;
      if (delta > 0) forward += delta; else backward -= delta;
      previous = turn;
    }
    expect(forward).toBeGreaterThan(0.85);
    expect(backward).toBeLessThan(forward * 0.2);
  });

  it('shows the back of the head partway through a spin', () => {
    const frames = play('spin', 1.6);
    expect(frames.some((p) => p.turn > 0.4 && p.turn < 0.6)).toBe(true);
  });

  /*
   * Paced, not merely sprung. Aimed straight at the finished angle the spring
   * arrived in about 160ms — a frame of blur and then a bird facing forward
   * again, which is not a revolve, it is a glitch.
   */
  it('takes long enough for a revolve to be seen', () => {
    const frames = play('spin', 2);
    const quarter = Math.round((SPIN_SECONDS * 0.25) / DT);
    expect(frames[quarter].turn).toBeLessThan(0.35);
    const back = frames.filter((p) => p.turn > 0.35 && p.turn < 0.65).length;
    // Roughly a quarter of the revolution is spent showing the back, and at
    // 60fps that has to be tens of frames, not one.
    expect(back).toBeGreaterThan(12);
  });

  it('settles a spin back to facing forward', () => {
    const frames = play('spin', 3.5);
    const turn = frames[frames.length - 1].turn;
    expect(Math.min(turn, 1 - turn)).toBeLessThan(0.08);
  });

  it('shuts its eyes and stays shut when asleep', () => {
    const frames = play('sleep', 3).slice(30);
    expect(Math.max(...frames.map((p) => p.lids))).toBeLessThan(0.2);
  });

  it('damps the idle when energy drops, without freezing', () => {
    const lively = play('idle', 40, 1);
    const calm = play('idle', 40, 0.2);
    const spread = (f: Pose[]) =>
      Math.max(...f.map((p) => p.bodyRot)) - Math.min(...f.map((p) => p.bodyRot));
    expect(spread(calm)).toBeLessThan(spread(lively) * 0.45);
    expect(spread(calm)).toBeGreaterThan(0);
  });

  it('survives any frame rate, including a terrible one', () => {
    for (const dt of [1 / 120, 1 / 30, 1 / 12, 0.4]) {
      let rig = setGesture(makeRig(), 'hop');
      for (let t = 0; t < 4; t += dt) rig = advance(rig, dt);
      const pose = poseOf(rig);
      expect(Number.isFinite(pose.lift)).toBe(true);
      expect(Math.abs(pose.lift)).toBeLessThan(60);
    }
  });

  it('can be retriggered mid-gesture without snapping', () => {
    let rig = setGesture(makeRig(), 'hop');
    for (let i = 0; i < 20; i += 1) rig = advance(rig, DT);
    const before = poseOf(rig).lift;
    rig = setGesture(rig, 'hop');
    const after = poseOf(advance(rig, DT)).lift;
    // The clock restarts; the body does not teleport.
    expect(Math.abs(after - before)).toBeLessThan(6);
  });
});

describe('squash and stretch', () => {
  it('preserves volume, so it deforms rather than scaling', () => {
    for (const squash of [-0.3, -0.1, 0, 0.2, 0.45]) {
      expect((1 + squash) * stretchOf(squash)).toBeCloseTo(1, 6);
    }
  });
});

describe('blinking', () => {
  it('blinks often enough to be alive and rarely enough not to twitch', () => {
    let blinks = 0;
    let shut = false;
    for (let t = 0; t < 60; t += 1 / 120) {
      const lids = blinkAt(t);
      if (!shut && lids < 0.4) { shut = true; blinks += 1; }
      if (shut && lids > 0.9) shut = false;
    }
    expect(blinks).toBeGreaterThan(10);
    expect(blinks).toBeLessThan(30);
  });

  it('never blinks on a fixed beat', () => {
    const at: number[] = [];
    let shut = false;
    for (let t = 0; t < 120; t += 1 / 120) {
      const lids = blinkAt(t);
      if (!shut && lids < 0.4) { shut = true; at.push(t); }
      if (shut && lids > 0.9) shut = false;
    }
    const gaps = at.slice(1).map((v, i) => v - at[i]);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.5);
  });
});
