import { describe, expect, it } from 'vitest';
import { fbm2, hash2, valueNoise2 } from './noise';

describe('hash2', () => {
  it('is deterministic and stays in [0, 1)', () => {
    for (let i = -50; i < 50; i++) {
      const v = hash2(i, i * 3, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(hash2(i, i * 3, 7)).toBe(v);
    }
  });

  it('changes with the seed', () => {
    expect(hash2(3, 4, 1)).not.toBe(hash2(3, 4, 2));
  });
});

describe('valueNoise2', () => {
  it('interpolates lattice values smoothly', () => {
    let previous = valueNoise2(0, 0.5, 3);
    for (let x = 0.01; x <= 2; x += 0.01) {
      const v = valueNoise2(x, 0.5, 3);
      expect(Math.abs(v - previous)).toBeLessThan(0.05);
      previous = v;
    }
  });

  it('tiles when a period is given', () => {
    const period = 8;
    for (let i = 0; i < 20; i++) {
      const x = i * 0.37;
      const z = i * 0.91;
      expect(valueNoise2(x, z, 5, period)).toBeCloseTo(valueNoise2(x + period, z, 5, period), 12);
      expect(valueNoise2(x, z, 5, period)).toBeCloseTo(valueNoise2(x, z + period, 5, period), 12);
    }
  });
});

describe('fbm2', () => {
  it('stays within [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = fbm2(i * 0.173, i * 0.311, 11);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('tiles with a period across every octave', () => {
    expect(fbm2(1.3, 2.2, 9, 4, 2, 0.5, 16)).toBeCloseTo(fbm2(17.3, 2.2, 9, 4, 2, 0.5, 16), 12);
  });
});
