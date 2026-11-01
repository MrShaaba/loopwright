import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TAU, smoothstep } from '../../util/math';
import { Cursor } from '../cursor';
import { numberParam, type SectionDef } from './types';

/** Sideways drift through a loop so the exit clears the entry tube. */
export const LOOP_DRIFT = 3.8;
/** Loops are a touch taller than wide, like a real teardrop. */
export const LOOP_STRETCH = 1.1;

export const loop: SectionDef = {
  type: 'loop',
  label: 'Loop',
  description: 'A vertical loop. The view goes fully upside down at the top.',
  params: [
    {
      kind: 'number',
      key: 'radius',
      label: 'Radius',
      min: 5,
      max: 20,
      step: 0.5,
      default: 9,
      unit: 'm',
    },
  ],
  frame: 'transport',
  build: (entry, params) => {
    const radius = numberParam(params, 'radius', 9);
    const steps = Math.max(40, Math.ceil(radius * 7));
    return new Cursor(entry)
      .custom(
        steps,
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
