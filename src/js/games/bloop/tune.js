/**
 * Every number that decides how a Bloop feels.
 *
 * In one file because the level checker has to simulate exactly what the game
 * simulates. A verifier running its own slightly different gravity proves
 * nothing at all — it proves that some other game is completable.
 */
export const TUNE = {
  /** Straight down, before the world is tilted. */
  gravity: 2000,

  /** How far the world leans at full tilt. About 34°, matching the original's
   *  generous lean: a timid tilt makes a child feel like nothing is happening. */
  maxTilt: 0.60,

  /** How quickly the world follows the device. Slower than the input on
   *  purpose — instant rotation is nauseating and makes fine steering
   *  impossible, and the lag is where the sense of weight comes from. */
  tiltFollow: 7.5,

  /** Bounce and grip against the ground. */
  bounce: 0.24,
  friction: 0.035,

  /** A jump is an impulse away from whatever you are standing on. */
  jump: 780,
  jumpCooldown: 0.22,

  /** Split Bloops drift apart this fast, and are pulled back this hard. */
  splitPush: 190,
  gatherPull: 1500,
  gatherSnap: 46,

  /** Radius of a single Bloop; a flock's radius grows with the square root. */
  baseRadius: 30,
  maxFlock: 20,

  /** How close counts as touching a fruit or reaching home. */
  fruitReach: 62,
  goalReach: 96,

  /** Camera. */
  zoom: 0.46,
  camFollow: 6.5,
};
