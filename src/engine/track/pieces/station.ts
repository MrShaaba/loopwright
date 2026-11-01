import { Cursor } from '../cursor';
import type { PieceDef } from '../types';

export const STATION_LENGTH = 12;

export const station: PieceDef = {
  id: 'station',
  label: 'Station',
  category: 'special',
  description: 'Where the train loads. Every circuit starts here and must return here.',
  params: {},
  frame: 'gravity',
  hidden: true,
  build: (entry) =>
    new Cursor(entry).straight(STATION_LENGTH, { flags: { station: true } }).finish(),
};
