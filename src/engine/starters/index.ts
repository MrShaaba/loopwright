import { createTrackDoc, type TrackDoc } from '../save/schema';
import { createSection } from '../track/Track';

export interface StarterTrack {
  id: string;
  name: string;
  tagline: string;
  doc: TrackDoc;
}

/** A long flowing tour: a climb, a dive, airtime, a loop, a corkscrew and a coil home. */
const flow: StarterTrack = {
  id: 'flow',
  name: 'Flow',
  tagline: 'A long, flowing tour with one of everything.',
  doc: createTrackDoc('Flow', 'minimal', [
    createSection('hill', { height: 16, length: 48 }),
    createSection('hill', { height: 14, length: 36, dive: true }),
    createSection('wave', { length: 72, waves: 3, amplitude: 4 }),
    createSection('turn', { direction: 'right', radius: 22, angle: 110, bank: 42 }),
    createSection('loop', { radius: 9 }),
    createSection('straight', { length: 22, tunnel: true }),
    createSection('corkscrew', { direction: 'right', radius: 4, length: 32 }),
    createSection('helix', { direction: 'left', radius: 16, turns: 1, climb: -2 }),
    createSection('turn', { direction: 'right', radius: 18, angle: 90, bank: 36 }),
  ]),
};

export const STARTERS: readonly StarterTrack[] = [flow];

export function getStarter(id: string): StarterTrack | undefined {
  return STARTERS.find((starter) => starter.id === id);
}

export const DEFAULT_STARTER_ID = flow.id;
