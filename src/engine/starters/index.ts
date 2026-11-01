import { createTrackDoc, type TrackDoc } from '../save/schema';
import { createSection } from '../track/Track';

export interface StarterTrack {
  id: string;
  name: string;
  tagline: string;
  doc: TrackDoc;
}

/** Gentle: a short climb, a soft drop, wide banked turns and low, long waves. */
const glide: StarterTrack = {
  id: 'glide',
  name: 'Glide',
  tagline: 'Gentle. Long climbs, wide turns, low waves.',
  doc: createTrackDoc('Glide', 'minimal', [
    createSection('hill', { height: 12, length: 40 }),
    createSection('hill', { height: 6, length: 30, dive: true }),
    createSection('turn', { direction: 'left', radius: 26, angle: 90, bank: 24 }),
    createSection('wave', { length: 70, waves: 2, amplitude: 2.5 }),
    createSection('turn', { direction: 'left', radius: 26, angle: 90, bank: 24 }),
    createSection('straight', { length: 30 }),
    createSection('hill', { height: 4, length: 30 }),
  ]),
};

/** Airtime: a tall lift into a run of camelbacks, then a second drop into smaller ones. */
const airtime: StarterTrack = {
  id: 'airtime',
  name: 'Airtime',
  tagline: 'Hills on hills. A big drop into a run of camelbacks.',
  doc: createTrackDoc('Airtime', 'minimal', [
    createSection('hill', { height: 22, length: 50 }),
    createSection('hill', { height: 14, length: 32, dive: true }),
    createSection('wave', { length: 110, waves: 4, amplitude: 4.5 }),
    createSection('turn', { direction: 'right', radius: 22, angle: 120, bank: 40 }),
    createSection('hill', { height: 8, length: 30 }),
    createSection('hill', { height: 15, length: 36, dive: true }),
    createSection('wave', { length: 72, waves: 3, amplitude: 3 }),
    createSection('turn', { direction: 'right', radius: 16, angle: 90, bank: 36 }),
  ]),
};

/** Inversions: a deep drop into a loop, two corkscrews and a second loop. */
const inversions: StarterTrack = {
  id: 'inversions',
  name: 'Inversions',
  tagline: 'Two loops, two corkscrews, and not much time to breathe.',
  doc: createTrackDoc('Inversions', 'minimal', [
    createSection('hill', { height: 22, length: 48 }),
    createSection('hill', { height: 18, length: 38, dive: true }),
    createSection('loop', { radius: 8 }),
    createSection('straight', { length: 16 }),
    createSection('corkscrew', { direction: 'right', radius: 4.5, length: 32 }),
    createSection('turn', { direction: 'left', radius: 22, angle: 90, bank: 45 }),
    createSection('loop', { radius: 7 }),
    createSection('corkscrew', { direction: 'right', radius: 4.5, length: 30 }),
    createSection('hill', { height: 4, length: 30, dive: true }),
  ]),
};

/** A long flowing tour: a climb, a dive, long airtime, a loop, a corkscrew and a coil home. */
const flow: StarterTrack = {
  id: 'flow',
  name: 'Flow',
  tagline: 'A long, flowing tour with one of everything.',
  doc: createTrackDoc('Flow', 'minimal', [
    createSection('hill', { height: 20, length: 50 }),
    createSection('hill', { height: 17, length: 38, dive: true }),
    createSection('wave', { length: 90, waves: 2, amplitude: 3 }),
    createSection('turn', { direction: 'right', radius: 22, angle: 110, bank: 42 }),
    createSection('loop', { radius: 6.5 }),
    createSection('straight', { length: 22, tunnel: true }),
    createSection('corkscrew', { direction: 'right', radius: 4.5, length: 34 }),
    createSection('helix', { direction: 'left', radius: 16, turns: 1, climb: -4 }),
    createSection('turn', { direction: 'right', radius: 18, angle: 90, bank: 36 }),
  ]),
};

/** Wild: the tallest climb, a big loop, a jump, a hairpin, a corkscrew, a fast wave run and a spiral. */
const wild: StarterTrack = {
  id: 'wild',
  name: 'Wild',
  tagline: 'The tall one. A jump, a hairpin, a spiral and a steep run home.',
  doc: createTrackDoc('Wild', 'minimal', [
    createSection('hill', { height: 30, length: 60 }),
    createSection('hill', { height: 24, length: 40, dive: true }),
    createSection('loop', { radius: 10 }),
    createSection('jump', { gap: 16, angle: 20 }),
    createSection('turn', { direction: 'right', radius: 14, angle: 180, bank: 60 }),
    createSection('corkscrew', { direction: 'left', radius: 5.5, length: 36 }),
    createSection('wave', { length: 100, waves: 3, amplitude: 5 }),
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
