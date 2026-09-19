/**
 * Shape Sorter boards, in Montessori order: one shape, then two, then a
 * discrimination pair that looks alike (square/rectangle, circle/oval), then
 * everything at once.
 *
 * This lives apart from game.js so the hub can read level names without
 * importing the game — a menu should not have to load an implementation, and
 * while it did, the hub showed "Board 1" instead of the names written here.
 */
export const LEVELS = [
  { name: "One Shape",   teaches: "Put the shape in its hole", keys: ["circle"] },
  { name: "Two Shapes",  teaches: "Circle and square",         keys: ["circle", "square"] },
  { name: "Three Shapes", teaches: "Add a triangle",           keys: ["circle", "square", "triangle"] },
  { name: "Four Shapes", teaches: "A star joins in",           keys: ["circle", "square", "triangle", "star"] },
  { name: "Look Closely", teaches: "Square or rectangle?",     keys: ["square", "rectangle", "circle", "oval"] },
  { name: "All Together", teaches: "Every shape you know",     keys: ["circle", "square", "triangle", "star", "heart", "hexagon"] },
];
