import { DEG } from '../../util/math';
import { Cursor } from '../cursor';
import type { PieceDef, Pose } from '../types';
import { LEVEL_TOLERANCE, MAX_PITCH } from './common';

const SLOPE_DEG = 25;
const SLOPE_RADIUS = 16;

function checkSteepness(entry: Pose, deltaDeg: number): string | null {
  const next = entry.pitch + deltaDeg * DEG;
  if (Math.abs(next) > MAX_PITCH + 1e-6) return 'Too steep: level out first';
  return null;
}

export const slopeUp: PieceDef = {
  id: 'slope-up',
  label: 'Slope up',
  category: 'hills',
  description: 'Pitches the track up by 25°. Stack it to climb steeper.',
  params: {},
  frame: 'gravity',
  check: (entry) => checkSteepness(entry, SLOPE_DEG),
  build: (entry) => new Cursor(entry).pitchArc(SLOPE_RADIUS, SLOPE_DEG).finish(),
};

export const slopeDown: PieceDef = {
  id: 'slope-down',
  label: 'Slope down',
  category: 'hills',
  description: 'Pitches the track down by 25°.',
  params: {},
  frame: 'gravity',
  check: (entry) => checkSteepness(entry, -SLOPE_DEG),
  build: (entry) => new Cursor(entry).pitchArc(SLOPE_RADIUS, -SLOPE_DEG).finish(),
};

export const levelOut: PieceDef = {
  id: 'level-out',
  label: 'Level out',
  category: 'hills',
  description: 'Returns a climbing or diving track to level.',
  params: {},
  frame: 'gravity',
  check: (entry) => (Math.abs(entry.pitch) <= LEVEL_TOLERANCE ? 'Track is already level' : null),
  build: (entry) => new Cursor(entry).pitchArc(SLOPE_RADIUS, -entry.pitch / DEG).finish(),
};
