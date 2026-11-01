import { DEG } from '../../util/math';
import type { Pose } from '../types';

export const LEVEL_TOLERANCE = 1 * DEG;
export const MAX_PITCH = 75 * DEG;

/** Pieces whose shape assumes a flat start, such as loops and drops. */
export function requireLevel(entry: Pose): string | null {
  return Math.abs(entry.pitch) > LEVEL_TOLERANCE
    ? 'Needs a level entry: add a Level out first'
    : null;
}

export const metres = (value: number | string): string => `${value} m`;
export const degrees = (value: number | string): string => `${value}°`;
