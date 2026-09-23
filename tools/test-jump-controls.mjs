/**
 * A controller regression that does not need a browser or microphone.
 * It sends the same pointer IDs and cancellation types the shared engine
 * forwards from Android, and observes the scene's actual jump transition.
 */
import assert from "node:assert/strict";

const stored = new Map();
globalThis.localStorage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { SayJumpScene } = await import("../src/js/games/say-jump/game.js");
const { save } = await import("../src/js/core/storage.js");

const scene = new SayJumpScene({ levelIndex: 0, band: "tiny" });
scene.engine = { view: { x: 0, y: 0, w: 720, h: 1280 } };
scene.setControlMode("touch");
assert.equal(save.state.settings.jumpControl, "touch");
assert.equal(JSON.parse(stored.get("wordquest.save.v1")).settings.jumpControl, "touch");

// The mode is honored on cold enter: it must never ask for a microphone.
scene.activateVoice = () => { throw new Error("Touch mode started the microphone"); };
await scene.enter({ view: scene.engine.view, juice: null, resize() {}, design: null });
assert.equal(scene.voiceReady, false);
console.log("✓ Touch mode survives a save and skips microphone startup");

let launches = 0;
scene.world.jump = () => { launches++; };
scene.setStateQuiet("prompt");
const { jump, pad } = scene.controlRects();

scene.down({ x: jump.cx, y: jump.cy }, { pointerId: 7 });
scene.up(null, { pointerId: 7, type: "pointercancel" });
assert.equal(launches, 0);
assert.equal(scene.state, "prompt");
console.log("✓ A cancelled finger does not jump");

scene.down({ x: pad.cx - pad.r / 2, y: pad.cy }, { pointerId: 8 });
assert.ok(scene.steer < -0.4);
scene.down({ x: jump.cx, y: jump.cy }, { pointerId: 9 });
scene.up(null, { pointerId: 8, type: "pointerup" });
assert.equal(scene.steer, 0);
assert.equal(scene.holding, true);
scene.up(null, { pointerId: 9, type: "pointerup" });
assert.equal(launches, 1);
assert.equal(scene.state, "air");
console.log("✓ Two fingers steer and jump independently");

scene.setStateQuiet("prompt");
scene.down({ x: jump.cx, y: jump.cy }, { pointerId: 10 });
scene.up(null, { pointerId: 11, type: "pointerup" });
assert.equal(launches, 1);
scene.up(null, { pointerId: 10, type: "pointerup" });
assert.equal(launches, 2);
assert.equal(scene.wordsRight, 2);
console.log("✓ Only the jump finger releases; short taps still clear a gate");

scene.destroy();

// A permission dialog can still be resolving when a child changes modes
// twice. One in-flight getUserMedia call must not create parallel streams.
const switching = new SayJumpScene({ levelIndex: 0, band: "mid" });
let completeFirst, starts = 0;
switching.voice.start = () => {
  starts++;
  return starts === 1 ? new Promise((resolve) => { completeFirst = resolve; }) : Promise.resolve(true);
};
switching.voice.stop = () => {};
switching.setControlMode("voice");
switching.setControlMode("touch");
switching.setControlMode("both");
assert.equal(starts, 1, "opened two mic requests at once");
completeFirst(true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(starts, 2, "did not rearm after a superseded mic request");
switching.destroy();
console.log("✓ Rapid mode changes serialise microphone startup");
