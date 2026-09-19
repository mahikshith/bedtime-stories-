/**
 * Balance — the rules of the algebra game, kept separate so the build can
 * search them.
 *
 * The idea is borrowed from DragonBox: teach the *principle* of algebra long
 * before the notation. A child is never told they are solving an equation.
 * They are told to get the creature alone on its side of the scale, and the
 * only two things they can do are exactly the two laws that make algebra work:
 *
 *   ADD THE SAME THING TO BOTH SIDES   drag a card from the deck; it lands on
 *                                      both pans at once, so the scale stays
 *                                      balanced. This is the whole of "do the
 *                                      same to both sides".
 *   A THING AND ITS SHADOW CANCEL      drop a card onto its dark twin and both
 *                                      vanish. This is x + (-x) = 0, learned as
 *                                      a fact about pictures rather than signs.
 *
 * With those two moves, "box + a = b" is solved by adding shadow-a to both
 * sides and cancelling. That is a real derivation, performed by a five-year-old
 * who has never seen a letter used as a number.
 *
 * Terms are strings: "box" is the unknown, "a".."f" are creatures, and a
 * leading "-" marks the shadow. Later levels relabel the same creatures as
 * numerals and then as x, so the notation arrives on top of a skill the child
 * already has.
 */

export const BOX = "box";

export const shadowOf = (t) => (t.startsWith("-") ? t.slice(1) : `-${t}`);
export const isShadow = (t) => t.startsWith("-");
export const baseOf = (t) => (t.startsWith("-") ? t.slice(1) : t);

/** A state is two pans, each a list of terms. */
export const makeState = (left, right) => ({ left: [...left], right: [...right] });

export const cloneState = (s) => ({ left: [...s.left], right: [...s.right] });

/** Solved when one pan holds the box and nothing else. */
export function isSolved(s) {
  return (s.left.length === 1 && s.left[0] === BOX) ||
         (s.right.length === 1 && s.right[0] === BOX);
}

/** Indices of a term and its shadow on one pan, if any pair exists. */
export function findPair(pan) {
  for (let i = 0; i < pan.length; i++) {
    if (pan[i] === BOX) continue;
    const want = shadowOf(pan[i]);
    for (let j = 0; j < pan.length; j++) {
      if (i !== j && pan[j] === want) return [Math.min(i, j), Math.max(i, j)];
    }
  }
  return null;
}

/** Remove a cancelling pair from one pan. Returns a new state, or null. */
export function cancel(s, side, i, j) {
  const pan = s[side];
  if (i === j || !pan[i] || !pan[j]) return null;
  if (pan[i] === BOX || pan[j] === BOX) return null;
  if (pan[j] !== shadowOf(pan[i])) return null;
  const next = cloneState(s);
  const drop = new Set([i, j]);
  next[side] = pan.filter((_, k) => !drop.has(k));
  return next;
}

/** Add a term to BOTH pans — the move that keeps the scale balanced. */
export function addBoth(s, term) {
  const next = cloneState(s);
  next.left.push(term);
  next.right.push(term);
  return next;
}

const key = (s) =>
  [...s.left].sort().join(",") + "|" + [...s.right].sort().join(",");

/**
 * Breadth-first search for a solution, used by the build to prove every level
 * is solvable and to record how few moves it takes.
 *
 * @returns {{moves: Array, length: number} | null}
 */
export function solve(state, deck, maxDepth = 8) {
  if (isSolved(state)) return { moves: [], length: 0 };
  const seen = new Set([key(state)]);
  const q = [{ s: state, moves: [] }];
  while (q.length) {
    const cur = q.shift();
    if (cur.moves.length >= maxDepth) continue;

    const next = [];
    // cancels
    for (const side of ["left", "right"]) {
      const pan = cur.s[side];
      for (let i = 0; i < pan.length; i++) {
        for (let j = i + 1; j < pan.length; j++) {
          const ns = cancel(cur.s, side, i, j);
          if (ns) next.push({ s: ns, move: { op: "cancel", side, i, j } });
        }
      }
    }
    // add a deck card to both pans
    for (const term of deck) {
      next.push({ s: addBoth(cur.s, term), move: { op: "add", term } });
    }

    for (const n of next) {
      if (isSolved(n.s)) return { moves: [...cur.moves, n.move], length: cur.moves.length + 1 };
      const k = key(n.s);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ s: n.s, moves: [...cur.moves, n.move] });
    }
  }
  return null;
}
