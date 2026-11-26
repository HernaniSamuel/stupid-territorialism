/** Random number generator in [0, 1). The whole simulation uses one of these, never `Math.random`. */
export type Rng = () => number;

/** mulberry32: small, fast and deterministic for a given seed. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** New seed for a match. It is the only place that uses `Math.random`. */
export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}

/** Shuffles `arr` in place (Fisher-Yates). */
export function shuffle<T>(arr: T[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
