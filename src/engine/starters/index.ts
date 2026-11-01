import { createTrackDoc, type TrackDoc } from '../save/schema';
import { createSection } from '../track/Track';

export interface StarterTrack {
  id: string;
  name: string;
  tagline: string;
  doc: TrackDoc;
}

/** Gentle: long climbs, wide banked turns and low waves. */
const glide: StarterTrack = {
  id: 'glide',
  name: 'Glide',
  tagline: 'Gentle. Long climbs, wide turns, low waves.',
  doc: createTrackDoc('Glide', 'minimal', [
    createSection('hill', { height: 10, length: 50 }),
    createSection('turn', { direction: 'left', radius: 26, angle: 90, bank: 24 }),
    createSection('wave', { length: 64, waves: 2, amplitude: 2.5 }),
    createSection('turn', { direction: 'left', radius: 26, angle: 90, bank: 24 }),
    createSection('straight', { length: 30 }),
    createSection('hill', { height: 6, length: 40, dive: true }),
  ]),
};

/** Airtime: a tall lift into a run of hills, then a second drop. */
const airtime: StarterTrack = {
  id: 'airtime',
  name: 'Airtime',
  tagline: 'Hills on hills. A big drop into a run of camelbacks.',
  doc: createTrackDoc('Airtime', 'minimal', [
    createSection('hill', { height: 24, length: 54 }),
    createSection('hill', { height: 14, length: 32, dive: true }),
    createSection('wave', { length: 96, waves: 4, amplitude: 5 }),
    createSection('turn', { direction: 'right', radius: 22, angle: 120, bank: 40 }),
    createSection('hill', { height: 8, length: 30 }),
    createSection('hill', { height: 16, length: 36, dive: true }),
    createSection('wave', { length: 60, waves: 3, amplitude: 3 }),
    createSection('turn', { direction: 'right', radius: 16, angle: 90, bank: 36 }),
  ]),
};

/** Inversions: two loops and two corkscrews. */
const inversions: StarterTrack = {
  id: 'inversions',
  name: 'Inversions',
  tagline: 'Two loops, two corkscrews, and not much time to breathe.',
  doc: createTrackDoc('Inversions', 'minimal', [
    createSection('hill', { height: 18, length: 44 }),
    createSection('hill', { height: 10, length: 28, dive: true }),
    createSection('loop', { radius: 10 }),
    createSection('straight', { length: 16 }),
    createSection('corkscrew', { direction: 'right', radius: 4, length: 30 }),
    createSection('turn', { direction: 'left', radius: 20, angle: 90, bank: 45 }),
    createSection('loop', { radius: 8 }),
    createSection('corkscrew', { direction: 'right', radius: 3.5, length: 26 }),
    createSection('hill', { height: 6, length: 30, dive: true }),
  ]),
};

/** A long flowing tour: a climb, a dive, airtime, a loop, a corkscrew and a coil home. */
const flow: StarterTrack = {
  id: 'flow',
  name: 'Flow',
  tagline: 'A long, flowing tour with one of everything.',
  doc: createTrackDoc('Flow', 'minimal', [
    createSection('hill', { height: 18, length: 50 }),
    createSection('hill', { height: 12, length: 34, dive: true }),
    createSection('wave', { length: 72, waves: 3, amplitude: 4 }),
    createSection('turn', { direction: 'right', radius: 22, angle: 110, bank: 42 }),
    createSection('loop', { radius: 9 }),
    createSection('straight', { length: 22, tunnel: true }),
    createSection('corkscrew', { direction: 'right', radius: 4, length: 32 }),
    createSection('helix', { direction: 'left', radius: 16, turns: 1, climb: -4 }),
    createSection('turn', { direction: 'right', radius: 18, angle: 90, bank: 36 }),
  ]),
};

/** Wild: the tallest climb, a jump, a hairpin, a spiral and a steep wave run. */
const wild: StarterTrack = {
  id: 'wild',
  name: 'Wild',
  tagline: 'The tall one. A jump, a hairpin, a spiral and a steep run home.',
  doc: createTrackDoc('Wild', 'minimal', [
    createSection('hill', { height: 30, length: 60 }),
    createSection('hill', { height: 24, length: 40, dive: true }),
    createSection('loop', { radius: 12 }),
    createSection('jump', { gap: 16, angle: 20 }),
    createSection('turn', { direction: 'right', radius: 14, angle: 180, bank: 60 }),
    createSection('corkscrew', { direction: 'left', radius: 5, length: 34 }),
    createSection('wave', { length: 80, waves: 5, amplitude: 6 }),
    createSection('turn', { direction: 'right', radius: 16, angle: 90, bank: 50 }),
    createSection('spiral', {
      direction: 'left',
      startRadius: 22,
      endRadius: 8,
      turns: 1.5,
      climb: 4,
    }),
    createSection('straight', { length: 30, tunnel: true }),
    createSection('hill', { height: 10, length: 36, dive: true }),
  ]),
};

export const STARTERS: readonly StarterTrack[] = [glide, airtime, inversions, flow, wild];

export function getStarter(id: string): StarterTrack | undefined {
  return STARTERS.find((starter) => starter.id === id);
}

export const DEFAULT_STARTER_ID = flow.id;
