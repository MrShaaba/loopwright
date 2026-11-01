import { DEG } from '../../util/math';
import { Cursor } from '../cursor';
import type { PieceDef } from '../types';
import { metres, requireLevel } from './common';
import { numberParam } from './registry';

const LIFT_DEG = 30;
const LIFT_IN_RADIUS = 18;
const LIFT_OUT_RADIUS = 14;
const DROP_DEG = 55;
const DROP_IN_RADIUS = 8;
const DROP_OUT_RADIUS = 12;

function arcRise(radius: number, deg: number): number {
  return radius * (1 - Math.cos(deg * DEG));
}

export const liftHill: PieceDef = {
  id: 'lift-hill',
  label: 'Lift hill',
  category: 'hills',
  description: 'A chain lift that hauls the train up and levels out at the top.',
  params: {
    height: { label: 'Height', options: [8, 16, 24], default: 16, format: metres },
  },
  frame: 'gravity',
  check: requireLevel,
  build: (entry, params) => {
    const height = numberParam(params, 'height', 16);
    const straightRise =
      height - arcRise(LIFT_IN_RADIUS, LIFT_DEG) - arcRise(LIFT_OUT_RADIUS, LIFT_DEG);
    const run = Math.max(1, straightRise / Math.sin(LIFT_DEG * DEG));
    const flags = { chain: true };
    return new Cursor(entry)
      .pitchArc(LIFT_IN_RADIUS, LIFT_DEG, { flags })
      .straight(run, { flags })
      .pitchArc(LIFT_OUT_RADIUS, -LIFT_DEG, { flags })
      .finish();
  },
};

export const drop: PieceDef = {
  id: 'drop',
  label: 'Drop',
  category: 'hills',
  description: 'A steep 55° dive that pulls out level at the bottom.',
  params: {
    depth: { label: 'Depth', options: [12, 20, 30], default: 20, format: metres },
  },
  frame: 'gravity',
  check: requireLevel,
  build: (entry, params) => {
    const depth = numberParam(params, 'depth', 20);
    const straightDrop =
      depth - arcRise(DROP_IN_RADIUS, DROP_DEG) - arcRise(DROP_OUT_RADIUS, DROP_DEG);
    const run = Math.max(1, straightDrop / Math.sin(DROP_DEG * DEG));
    return new Cursor(entry)
      .pitchArc(DROP_IN_RADIUS, -DROP_DEG)
      .straight(run)
      .pitchArc(DROP_OUT_RADIUS, DROP_DEG)
      .finish();
  },
};
