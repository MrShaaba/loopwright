import { autoBank, easedBank } from '../bank';
import { Cursor } from '../cursor';
import type { PieceDef } from '../types';
import { requireLevel } from './common';
import { directionParam, numberParam, stringParam } from './registry';

const HELIX_RADIUS = 13;
const HELIX_PITCH_DEG = 10;
const HELIX_ARC_RADIUS = 14;

export const helix: PieceDef = {
  id: 'helix',
  label: 'Helix',
  category: 'basic',
  description: 'A banked spiral that gains or loses height over one or more turns.',
  params: {
    direction: { label: 'Turn', options: ['left', 'right'], default: 'right' },
    turns: { label: 'Turns', options: [1, 1.5], default: 1, format: (v) => `${v}×` },
    slope: { label: 'Slope', options: ['down', 'level', 'up'], default: 'down' },
  },
  frame: 'gravity',
  check: requireLevel,
  build: (entry, params) => {
    const direction = directionParam(params);
    const turns = numberParam(params, 'turns', 1);
    const slope = stringParam(params, 'slope', 'down');
    const pitchDeg = slope === 'down' ? -HELIX_PITCH_DEG : slope === 'up' ? HELIX_PITCH_DEG : 0;
    const bank = easedBank(autoBank(HELIX_RADIUS, direction));
    return new Cursor(entry)
      .pitchArc(HELIX_ARC_RADIUS, pitchDeg)
      .turn(HELIX_RADIUS, 360 * turns, direction, { bank })
      .pitchArc(HELIX_ARC_RADIUS, -pitchDeg)
      .finish();
  },
};
