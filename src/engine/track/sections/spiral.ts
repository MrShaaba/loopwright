import { Cursor } from '../cursor';
import { coilGeometry } from './helix';
import { directionParam, numberParam, type SectionDef } from './types';

export const spiral: SectionDef = {
  type: 'spiral',
  label: 'Narrowing spiral',
  description: 'Coils inward from a wide radius to a tight one.',
  params: [
    {
      kind: 'choice',
      key: 'direction',
      label: 'Direction',
      options: ['left', 'right'],
      default: 'left',
    },
    {
      kind: 'number',
      key: 'startRadius',
      label: 'Start radius',
      min: 8,
      max: 40,
      step: 0.5,
      default: 24,
      unit: 'm',
    },
    {
      kind: 'number',
      key: 'endRadius',
      label: 'End radius',
      min: 3,
      max: 20,
      step: 0.5,
      default: 8,
      unit: 'm',
    },
    { kind: 'number', key: 'turns', label: 'Turns', min: 0.5, max: 4, step: 0.25, default: 2 },
    {
      kind: 'number',
      key: 'climb',
      label: 'Climb per turn',
      min: -15,
      max: 15,
      step: 0.5,
      default: -4,
      unit: 'm',
    },
  ],
  frame: 'gravity',
  build: (entry, params) => {
    const direction = directionParam(params);
    const start = numberParam(params, 'startRadius', 24);
    const end = numberParam(params, 'endRadius', 8);
    const turns = numberParam(params, 'turns', 2);
    const climb = numberParam(params, 'climb', -4);
    const coil = coilGeometry(
      entry.yaw,
      direction,
      turns,
      (u) => start + (end - start) * u,
      climb * turns,
    );
    return new Cursor(entry)
      .custom(coil.steps, coil.shape, { yaw: coil.exitYaw, pitch: 0 })
      .finish();
  },
};
