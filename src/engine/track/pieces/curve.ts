import { autoBank, easedBank, flatBank } from '../bank';
import { Cursor } from '../cursor';
import type { PieceDef } from '../types';
import { degrees } from './common';
import { directionParam, numberParam, stringParam } from './registry';

export const curve: PieceDef = {
  id: 'curve',
  label: 'Curve',
  category: 'basic',
  description: 'A flat turn. Banks itself unless set to flat.',
  params: {
    direction: { label: 'Turn', options: ['left', 'right'], default: 'right' },
    radius: { label: 'Radius', options: [8, 14, 22], default: 14, format: (v) => `R${v}` },
    angle: { label: 'Angle', options: [45, 90], default: 90, format: degrees },
    bank: { label: 'Bank', options: ['auto', 'flat'], default: 'auto' },
  },
  frame: 'gravity',
  build: (entry, params) => {
    const direction = directionParam(params);
    const radius = numberParam(params, 'radius', 14);
    const angle = numberParam(params, 'angle', 90);
    const bank =
      stringParam(params, 'bank', 'auto') === 'flat'
        ? flatBank
        : easedBank(autoBank(radius, direction));
    return new Cursor(entry).turn(radius, angle, direction, { bank }).finish();
  },
};
