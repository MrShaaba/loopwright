import { Cursor } from '../cursor';
import type { PieceDef } from '../types';
import { numberParam } from './registry';
import { metres } from './common';

export const straight: PieceDef = {
  id: 'straight',
  label: 'Straight',
  category: 'basic',
  description: 'A straight run at the current slope.',
  params: {
    length: { label: 'Length', options: [4, 8, 16], default: 8, format: metres },
  },
  frame: 'gravity',
  build: (entry, params) => new Cursor(entry).straight(numberParam(params, 'length', 8)).finish(),
};

export const brakeRun: PieceDef = {
  id: 'brake-run',
  label: 'Brake run',
  category: 'special',
  description: 'Slows the train to a crawl before the station.',
  params: {},
  frame: 'gravity',
  build: (entry) => new Cursor(entry).straight(12, { flags: { brake: true } }).finish(),
};
