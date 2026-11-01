import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TAU } from '../../util/math';
import { Cursor } from '../cursor';
import { directionParam, numberParam, type SectionDef } from './types';

export const corkscrew: SectionDef = {
  type: 'corkscrew',
  label: 'Corkscrew',
  description: 'Rolls the view over once while the tube sweeps to one side.',
  params: [
    {
      kind: 'choice',
      key: 'direction',
      label: 'Roll',
      options: ['left', 'right'],
      default: 'right',
    },
    {
      kind: 'number',
      key: 'radius',
      label: 'Radius',
      min: 2.5,
      max: 10,
      step: 0.25,
      default: 4,
      unit: 'm',
    },
    {
      kind: 'number',
      key: 'length',
      label: 'Length',
      min: 16,
      max: 80,
      step: 1,
      default: 30,
      unit: 'm',
    },
  ],
  frame: 'gravity',
  build: (entry, params) => {
    const s = directionParam(params) === 'right' ? 1 : -1;
    const radius = numberParam(params, 'radius', 4);
    const length = numberParam(params, 'length', 30);
    const steps = Math.max(48, Math.ceil(length * 1.5));
    return new Cursor(entry)
      .custom(
        steps,
        (u) => {
          const theta = u * TAU;
          return {
            offset: new Vector3(
              length * u,
              radius * (1 - Math.cos(theta)),
              s * radius * (theta - Math.sin(theta)),
            ),
            bank: s * theta,
          };
        },
        { yaw: entry.yaw, pitch: 0 },
      )
      .finish();
  },
};
