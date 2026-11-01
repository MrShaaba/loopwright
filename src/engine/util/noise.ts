import { lerp } from './math';

/** Integer lattice hash in [0, 1). Pure integer mixing, so it is identical in every runtime. */
export function hash2(ix: number, iz: number, seed: number): number {
  let h =
    Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function wrap(i: number, period: number): number {
  return period > 0 ? ((i % period) + period) % period : i;
}

/**
 * 2D value noise in [0, 1). With a `period` (in lattice cells) the field tiles seamlessly,
 * which is what the repeating ground textures need.
 */
export function valueNoise2(x: number, z: number, seed: number, period = 0): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const x0 = wrap(ix, period);
  const x1 = wrap(ix + 1, period);
  const z0 = wrap(iz, period);
  const z1 = wrap(iz + 1, period);
  const a = hash2(x0, z0, seed);
  const b = hash2(x1, z0, seed);
  const c = hash2(x0, z1, seed);
  const d = hash2(x1, z1, seed);
  const ux = fade(fx);
  const uz = fade(fz);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

/** Fractal sum of value noise, normalised back into [0, 1). */
export function fbm2(
  x: number,
  z: number,
  seed: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
  period = 0,
): number {
  let sum = 0;
  let amplitude = 1;
  let norm = 0;
  let frequency = 1;
  let p = period;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * valueNoise2(x * frequency, z * frequency, seed + o * 101, p);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
    p = period > 0 ? p * lacunarity : 0;
  }
  return sum / norm;
}
