/** Balance's first lesson must work with taps, and a cancelled finger must not change the board. */
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { addEventListener() {} };
const { BalanceScene } = await import("../src/js/games/balance/game.js");

const view = { x: 0, y: 0, w: 720, h: 1280 };
function board(levelIndex) {
  const scene = new BalanceScene({ levelIndex });
  scene.engine = { view };
  scene.juice = { hit() {} };
  scene.phase = "play";
  scene.resize(view);
  scene.layout();
  return scene;
}
function center(card) { return { x: card.x + card.s / 2, y: card.y + card.s / 2 }; }
function tap(scene, card, pointerId = 1, type = "pointerup") {
  const point = center(card);
  scene.down(point, { pointerId });
  scene.up(point, { pointerId, type });
}

const first = board(0);
const day = first.cards.find((c) => c.term === "a");
const night = first.cards.find((c) => c.term === "-a");
tap(first, day);
assert.equal(first.selected?.term, "a", "first tap should select a matching card");
tap(first, night);
assert.equal(first.phase, "won", "two taps should clear the opening level");
assert.equal(first.moves, 1);
console.log("✓ The first lesson can be solved by tapping a day card and its shadow");

const third = board(2);
const deck = third.cards.find((c) => c.side === "deck");
tap(third, deck);
assert.equal(third.moves, 1, "tapping a deck card should put it on both trays");
assert.equal(third.state.left.at(-1), "-a");
assert.equal(third.state.right.at(-1), "-a");
console.log("✓ A deck tap adds the same card to both trays");

const cancelled = board(0);
const source = cancelled.cards.find((c) => c.term === "a");
const target = cancelled.cards.find((c) => c.term === "-a");
const start = center(source);
const end = center(target);
cancelled.down(start, { pointerId: 7 });
cancelled.move(end, { pointerId: 7 });
cancelled.up(end, { pointerId: 7, type: "pointercancel" });
assert.equal(cancelled.moves, 0);
assert.equal(cancelled.drag, null);
console.log("✓ Cancelling a drag never scores a move");

const two = board(0);
const a = two.cards.find((c) => c.term === "a");
const b = two.cards.find((c) => c.term === "-a");
two.down(center(a), { pointerId: 7 });
two.move(center(b), { pointerId: 8 });
two.up(center(b), { pointerId: 8, type: "pointerup" });
assert.equal(two.moves, 0, "another finger must not finish the first finger's drag");
two.up(center(b), { pointerId: 7, type: "pointerup" });
assert.equal(two.moves, 1);
console.log("✓ A second finger cannot complete someone else's drag");
