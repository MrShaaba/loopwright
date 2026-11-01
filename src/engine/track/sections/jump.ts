import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DEG } from '../../util/math';
import { Cursor } from '../cursor';
import { numberParam, type SectionDef } from './types';

/** Radius of the vertical arcs that pitch the tube up for take-off and level it on landing. */
const LIP_RADIUS = 10;

export const jump: SectionDef = {
  type: 'jump',
  label: 'Jump gap',
  description: 'The tube opens and the ball flies across a gap.',
  params: [
    {
      kind: 'number',
      key: 'gap',
      label: 'Gap',
      min: 4,
      max: 40,
      step: 0.5,
      default: 14,
      unit: 'm',
    },
    {
      kind: 'number',
      key: 'angle',
      label: 'Launch angle',
      min: 5,
      max: 35,
      step: 1,
      default: 18,
      unit: '°',
    },
  ],
  frame: 'gravity',
  build: (entry, params) => {
    const gap = numberParam(params, 'gap', 14);
    const angleDeg = numberParam(params, 'angle', 18);
    const slope = Math.tan(angleDeg * DEG);
    const steps = Math.max(8, Math.ceil(gap));
    return new Cursor(entry)
      .pitchArc(LIP_RADIUS, angleDeg)
      .custom(
        steps,
        (u) => {
          const x = gap * u;
          return { offset: new Vector3(x, x * slope - (x * x * slope) / gap, 0) };
        },
        { yaw: entry.yaw, pitch: -angleDeg * DEG },
        { flags: { gap: true } },
      )
      .pitchArc(LIP_RADIUS, angleDeg)
      .finish();
  },
};
