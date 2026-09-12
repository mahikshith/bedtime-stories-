/** Deterministic PRNG so a given (child, world, episode) always yields the same story. */

export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough for content selection. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() called with an empty list');
  return items[Math.floor(rng() * items.length) % items.length];
}

/** Picks `count` distinct items, falling back to repeats only if the pool is too small. */
export function pickDistinct<T>(rng: () => number, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    if (pool.length === 0) {
      out.push(pick(rng, items));
      continue;
    }
    const idx = Math.floor(rng() * pool.length) % pool.length;
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}
