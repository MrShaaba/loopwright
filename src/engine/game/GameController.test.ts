import { describe, expect, it } from 'vitest';
import { crossed } from './GameController';

describe('crossed', () => {
  it('detects an item between the last and current positions, including across the start line', () => {
    expect(crossed(10, 14, 12, 100)).toBe(true);
    expect(crossed(10, 14, 14, 100)).toBe(true);
    expect(crossed(10, 14, 10, 100)).toBe(false);
    expect(crossed(10, 14, 15, 100)).toBe(false);
    expect(crossed(98, 3, 1, 100)).toBe(true);
    expect(crossed(98, 3, 99, 100)).toBe(true);
    expect(crossed(98, 3, 50, 100)).toBe(false);
  });

  it('ignores standing still and backwards jumps', () => {
    expect(crossed(5, 5, 5, 100)).toBe(false);
    expect(crossed(50, 10, 30, 100)).toBe(false);
    expect(crossed(0, 1, 0.5, 0)).toBe(false);
  });
});
