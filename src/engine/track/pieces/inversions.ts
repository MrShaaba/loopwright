import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TAU, smoothstep } from '../../util/math';
import { Cursor } from '../cursor';
import type { PieceDef } from '../types';
import { requireLevel } from './common';
import { directionParam, stringParam } from './registry';

/** Sideways drift through a loop so the exit clears the entry track. */
export const LOOP_DRIFT = 3.6;
/** Loops are a touch taller than wide, like a real teardrop. */
export const LOOP_STRETCH = 1.12;
const LOOP_RADII: Record<string, number> = { small: 8, large: 11 };

export const loop: PieceDef = {
  id: 'loop',
  label: 'Loop',
  category: 'inversions',
  description: 'A vertical loop. Riders go fully upside down at the top.',
  params: {
    size: { label: 'Size', options: ['small', 'large'], default: 'small' },
  },
  frame: 'transport',
  check: requireLevel,
  build: (entry, params) => {
    const radius = LOOP_RADII[stringParam(params, 'size', 'small')] ?? 8;
    return new Cursor(entry)
      .custom(
        48,
        (u) => {
          const theta = u * TAU;
          return {
            offset: new Vector3(
              radius * Math.sin(theta),
              LOOP_STRETCH * radius * (1 - Math.cos(theta)),
              LOOP_DRIFT * smoothstep(0, 1, u),
            ),
          };
        },
        { yaw: entry.yaw, pitch: 0 },
      )
      .finish();
  },
};

/** Forward advance per radian and the roll radius of the corkscrew path. */
export const CORKSCREW_ADVANCE = 3.2;
export const CORKSCREW_RADIUS = 3.8;

export const corkscrew: PieceDef = {
  id: 'corkscrew',
  label: 'Corkscrew',
  category: 'inversions',
  description: 'Rolls the train over once while the track sweeps to one side.',
  params: {
    direction: { label: 'Roll', options: ['left', 'right'], default: 'right' },
  },
  frame: 'gravity',
  check: requireLevel,
  build: (entry, params) => {
    const s = directionParam(params) === 'right' ? 1 : -1;
    return new Cursor(entry)
      .custom(
        56,
        (u) => {
          const theta = u * TAU;
          return {
            offset: new Vector3(
              CORKSCREW_ADVANCE * theta,
              CORKSCREW_RADIUS * (1 - Math.cos(theta)),
              s * CORKSCREW_RADIUS * (theta - Math.sin(theta)),
            ),
            bank: s * theta,
          };
        },
        { yaw: entry.yaw, pitch: 0 },
      )
      .finish();
  },
};
