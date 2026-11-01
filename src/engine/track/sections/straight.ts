import { Cursor } from '../cursor';
import { booleanParam, numberParam, type SectionDef } from './types';

export const straight: SectionDef = {
  type: 'straight',
  label: 'Straight',
  description: 'A straight run. Wrap it in a tunnel for a darker rush.',
  params: [
    {
      kind: 'number',
      key: 'length',
      label: 'Length',
      min: 4,
      max: 120,
      step: 1,
      default: 24,
      unit: 'm',
    },
    { kind: 'boolean', key: 'tunnel', label: 'Tunnel', default: false },
  ],
  frame: 'gravity',
  build: (entry, params) =>
    new Cursor(entry)
      .straight(numberParam(params, 'length', 24), {
        flags: booleanParam(params, 'tunnel', false) ? { tunnel: true } : {},
      })
      .finish(),
};
