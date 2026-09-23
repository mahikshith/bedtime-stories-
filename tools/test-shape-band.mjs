/** The same level must fit toddler fingers without losing a valid solution. */
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { addEventListener() {} };
const { ShapesScene } = await import("../src/js/games/shapes/game.js");
const { LEVELS } = await import("../src/js/games/shapes/levels.js");

const view = { x: 0, y: 0, w: 720, h: 1280 };
for (let i = 0; i < LEVELS.length; i++) {
  for (const band of ["tiny", "mid"]) {
    const scene = new ShapesScene({ levelIndex: i, band });
    scene.resize(view);
    assert.equal(scene.holes.length, scene.tiles.length);
    assert.deepEqual(scene.holes.map((h) => h.key).sort(), scene.tiles.map((t) => t.key).sort());
    if (band === "tiny") assert.ok(scene.holes.length <= 3, "toddler board exceeds three shapes");
    assert.ok(scene.tileR >= 60, `board ${i + 1}/${band} tiles too small to grab`);
    for (const tile of scene.tiles) {
      assert.ok(tile.homeX - scene.tileR >= view.x && tile.homeX + scene.tileR <= view.x + view.w,
        `board ${i + 1}/${band} clipped a tile horizontally`);
      assert.ok(tile.homeY - scene.tileR >= scene.tray.y && tile.homeY + scene.tileR <= view.y + view.h,
        `board ${i + 1}/${band} clipped a tile vertically`);
      for (const other of scene.tiles) {
        if (other === tile) continue;
        assert.ok(Math.hypot(tile.homeX - other.homeX, tile.homeY - other.homeY) >= scene.tileR * 1.9,
          `board ${i + 1}/${band} overlaps shapes in the tray`);
      }
    }
  }
}
console.log(`✓ ${LEVELS.length} boards have distinct, reachable age-band layouts with finger-sized tiles`);

const scene = new ShapesScene({ levelIndex: 2, band: "tiny" });
scene.resize(view);
scene.state = "play";
const tile = scene.tiles[0];
const hole = scene.holes.find((h) => h.key === tile.key);
tile.sx = hole.x; tile.sy = hole.y;
scene.dragging = tile;
scene.up(null, { type: "pointercancel" });
assert.equal(scene.placed, 0);
assert.equal(tile.placed, false);
assert.ok(tile.returning);
console.log("✓ A cancelled drag returns its shape without completing a level");
