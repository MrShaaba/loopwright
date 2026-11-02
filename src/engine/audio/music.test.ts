import { describe, expect, it } from 'vitest';
import { listThemes } from '../theme';
import { isPlayable, nextDegree, noteFrequency, stepSeconds } from './music';

describe('music helpers', () => {
  it('turns scale degrees into frequencies', () => {
    expect(noteFrequency(220, 1, 0)).toBe(220);
    expect(noteFrequency(220, 2, 0)).toBe(440);
    expect(noteFrequency(220, 1, 12)).toBeCloseTo(440, 6);
    expect(noteFrequency(440, 1, 7)).toBeCloseTo(659.255, 2);
    expect(stepSeconds(120)).toBeCloseTo(0.25, 6);
  });

  it('walks the scale by steps, leaps now and then, and never repeats a note', () => {
    const scale = [0, 2, 4, 7, 9];
    expect(nextDegree(scale, 2, () => 0.1)).toBe(3);
    expect(nextDegree(scale, 2, () => 0.5)).toBe(1);
    expect(nextDegree(scale, 0, () => 0.5)).toBe(1);
    expect(nextDegree(scale, 4, () => 0.1)).toBe(3);
    // A leap that lands on the current note moves on instead.
    const rolls = [0.9, 2 / 5 + 0.01];
    expect(nextDegree(scale, 2, () => rolls.shift() ?? 0)).toBe(3);
    expect(nextDegree([0], 0, () => 0.1)).toBe(0);
    let seed = 1;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let degree = 0;
    for (let i = 0; i < 200; i++) {
      const next = nextDegree(scale, degree, random);
      expect(next).not.toBe(degree);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(scale.length);
      degree = next;
    }
  });

  it('gives every theme a playable bed of its own', () => {
    const roots = new Set<string>();
    for (const theme of listThemes()) {
      expect(isPlayable(theme.music)).toBe(true);
      roots.add(`${theme.music.root}:${theme.music.scale.join(',')}:${theme.music.drone.wave}`);
    }
    expect(roots.size).toBe(listThemes().length);
    expect(isPlayable({ ...listThemes()[0]!.music, scale: [] })).toBe(false);
  });
});
