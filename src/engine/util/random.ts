export type Rng = () => number;

/** Deterministic 32-bit PRNG (mulberry32). The same seed gives the same park on every machine. */
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

export function rangeFrom(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}
