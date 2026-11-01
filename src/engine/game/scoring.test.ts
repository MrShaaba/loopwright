import { describe, expect, it } from 'vitest';
import {
  comboMultiplier,
  createRunStats,
  gemPoints,
  hazardValueFactor,
  ringPoints,
  SCORING,
} from './scoring';

describe('scoring', () => {
  it('pays more per ring the faster you go', () => {
    expect(ringPoints(0, 0)).toBe(SCORING.ringBase);
    expect(ringPoints(50, 0)).toBe(30);
    expect(ringPoints(100, 0)).toBe(50);
    expect(ringPoints(100, 0)).toBeGreaterThan(ringPoints(50, 0));
  });

  it('grows with the combo and caps at twenty in a row', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(10)).toBeCloseTo(1.5, 9);
    expect(comboMultiplier(20)).toBeCloseTo(2, 9);
    expect(comboMultiplier(99)).toBeCloseTo(2, 9);
    expect(ringPoints(60, 20)).toBe(68);
    expect(ringPoints(60, 5)).toBe(43);
  });

  it('drops a ring to a quarter after a hazard and recovers with speed', () => {
    expect(hazardValueFactor(10, 40)).toBe(SCORING.hazardFloor);
    expect(hazardValueFactor(20, 40)).toBe(0.5);
    expect(hazardValueFactor(40, 40)).toBe(1);
    expect(hazardValueFactor(50, 40)).toBe(1);
    expect(hazardValueFactor(30, 0)).toBe(1);
    expect(ringPoints(60, 0, 0.25)).toBe(9);
    expect(ringPoints(60, 0, 0)).toBe(9);
    expect(ringPoints(60, 0, 2)).toBe(34);
  });

  it('always pays at least one whole point', () => {
    expect(ringPoints(-100, 0, 0)).toBe(3);
    expect(Number.isInteger(ringPoints(33.3, 7, 0.37))).toBe(true);
    expect(gemPoints()).toBe(500);
    expect(createRunStats()).toEqual({
      score: 0,
      combo: 0,
      bestCombo: 0,
      rings: 0,
      gems: 0,
      topSpeedKmh: 0,
      hazards: 0,
      boosts: 0,
    });
  });
});
