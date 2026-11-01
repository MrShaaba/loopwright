import { DEG } from '../../util/math';
import { easedBank } from '../bank';
import { Cursor } from '../cursor';
import { directionParam, numberParam, type SectionDef } from './types';

export const turn: SectionDef = {
  type: 'turn',
  label: 'Banked turn',
  description: 'A horizontal arc that leans into the bend.',
  params: [
    {
      kind: 'choice',
      key: 'direction',
      label: 'Direction',
      options: ['left', 'right'],
      default: 'right',
    },
    {
      kind: 'number',
      key: 'radius',
      label: 'Radius',
      min: 6,
      max: 60,
      step: 0.5,
      default: 18,
      unit: 'm',
    },
    {
      kind: 'number',
      key: 'angle',
      label: 'Angle',
      min: 15,
      max: 270,
      step: 5,
      default: 90,
      unit: '°',
    },
    {
      kind: 'number',
      key: 'bank',
      label: 'Bank',
      min: 0,
      max: 80,
      step: 1,
      default: 35,
      unit: '°',
    },
  ],
  frame: 'gravity',
  build: (entry, params) => {
    const direction = directionParam(params);
    const sign = direction === 'right' ? 1 : -1;
    const bank = numberParam(params, 'bank', 35) * DEG * sign;
    return new Cursor(entry)
      .turn(numberParam(params, 'radius', 18), numberParam(params, 'angle', 90), direction, {
        bank: easedBank(bank),
      })
      .finish();
  },
};
