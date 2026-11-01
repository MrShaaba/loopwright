import { DEG, smoothstep } from '../util/math';

const GRAVITY = 9.81;
/** Speed the auto-bank is designed for, in m/s. */
const DESIGN_SPEED = 12;
const MAX_BANK = 60 * DEG;

/** Bank angle in radians that balances lateral g at the design speed, capped at 60 degrees. */
export function autoBank(radius: number, direction: 'left' | 'right'): number {
  const angle = Math.min(Math.atan((DESIGN_SPEED * DESIGN_SPEED) / (GRAVITY * radius)), MAX_BANK);
  return direction === 'right' ? angle : -angle;
}

/** Bank profile that eases in over the first third of a piece and out over the last third. */
export function easedBank(peak: number): (t: number) => number {
  return (t) => peak * smoothstep(0, 0.32, t) * (1 - smoothstep(0.68, 1, t));
}

export const flatBank = (): number => 0;
