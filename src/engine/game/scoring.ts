/** Points for rings, gems and combos. Pure functions so the formula is testable and stable. */

export const SCORING = {
  /** Points for a ring at a standstill. */
  ringBase: 10,
  /** Extra points per km/h of effective speed at the moment of collection. */
  ringPerKmh: 0.4,
  /** Combo bonus per ring in the chain, applied up to `comboCap` rings. */
  comboStep: 0.05,
  comboCap: 20,
  gem: 500,
  /** Ring value right after a hazard hit, climbing back to 1 as speed rebuilds. */
  hazardFloor: 0.25,
} as const;

/** Multiplier from the current combo: 1 at no combo, up to 2 at twenty rings in a row. */
export function comboMultiplier(combo: number): number {
  const chain = Math.max(0, Math.min(SCORING.comboCap, Math.floor(combo)));
  return 1 + chain * SCORING.comboStep;
}

/**
 * Points for one ring: a base plus a share per km/h, times the combo multiplier, times the
 * hazard recovery factor (1 when the ball is at full worth). Always a whole number of at least 1.
 */
export function ringPoints(speedKmh: number, combo: number, valueFactor = 1): number {
  const speed = Math.max(0, speedKmh);
  const factor = Math.max(SCORING.hazardFloor, Math.min(1, valueFactor));
  const raw = (SCORING.ringBase + SCORING.ringPerKmh * speed) * comboMultiplier(combo) * factor;
  return Math.max(1, Math.round(raw));
}

export function gemPoints(): number {
  return SCORING.gem;
}

/**
 * How much rings are worth after a hazard, from the speed now against the speed at the hit:
 * the floor straight after, back to 1 once the ball has rebuilt its speed.
 */
export function hazardValueFactor(speedNow: number, speedAtHit: number): number {
  if (speedAtHit <= 0) return 1;
  const ratio = speedNow / speedAtHit;
  return Math.max(SCORING.hazardFloor, Math.min(1, ratio));
}

export interface RunStats {
  score: number;
  combo: number;
  bestCombo: number;
  rings: number;
  gems: number;
  topSpeedKmh: number;
  hazards: number;
  boosts: number;
}

export function createRunStats(): RunStats {
  return {
    score: 0,
    combo: 0,
    bestCombo: 0,
    rings: 0,
    gems: 0,
    topSpeedKmh: 0,
    hazards: 0,
    boosts: 0,
  };
}
