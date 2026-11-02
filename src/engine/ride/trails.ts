import type { Rgb } from './skins';

export type TrailSprite = 'disc' | 'spark' | 'ring';

/** How a trail emits. Plain data: the Trail class turns it into a particle system. */
export interface TrailParticles {
  sprite: TrailSprite;
  /** `theme` takes the ball's colour; a tuple is a fixed colour. */
  color: 'theme' | Rgb;
  /** A second colour particles are picked between, or the first again. */
  color2?: Rgb;
  /** Particles per second at full speed. */
  rate: number;
  /** Seconds a particle lives, min and max. */
  life: [number, number];
  /** Metres across at birth, min and max. */
  size: [number, number];
  /** Size at death as a fraction of birth size. */
  endSize: number;
  /** Metres per second a particle leaves the ball with, min and max. */
  power: [number, number];
  /** How far from the ball's centre particles are born, metres. */
  spread: number;
  /** Vertical pull in metres per second squared; negative falls, positive rises. */
  gravity: number;
  /** Birth alpha. */
  alpha: number;
  /** Which way particles leave: straight behind the ball, upward, or any direction. */
  drift: 'behind' | 'up' | 'random';
}

export interface TrailStyle {
  id: string;
  name: string;
  description: string;
  /** Gems collected across all tracks needed to unlock it. */
  cost: number;
  /** Null for no trail at all. */
  particles: TrailParticles | null;
}

export const TRAILS: readonly TrailStyle[] = [
  {
    id: 'none',
    name: 'No trail',
    description: 'Just the ball and its glow.',
    cost: 0,
    particles: null,
  },
  {
    id: 'comet',
    name: 'Comet',
    description: 'A soft tail in the ball’s own colour that stretches with speed.',
    cost: 2,
    particles: {
      sprite: 'disc',
      color: 'theme',
      rate: 90,
      life: [0.35, 0.6],
      size: [0.5, 0.8],
      endSize: 0.1,
      power: [0.2, 0.8],
      spread: 0.1,
      gravity: 0,
      alpha: 0.55,
      drift: 'behind',
    },
  },
  {
    id: 'sparks',
    name: 'Sparks',
    description: 'Hot specks thrown off the wheel that fall away behind you.',
    cost: 5,
    particles: {
      sprite: 'spark',
      color: [1.0, 0.86, 0.5],
      color2: [1.0, 0.55, 0.25],
      rate: 120,
      life: [0.3, 0.7],
      size: [0.08, 0.18],
      endSize: 0.3,
      power: [2, 6],
      spread: 0.3,
      gravity: -9,
      alpha: 1,
      drift: 'random',
    },
  },
  {
    id: 'stardust',
    name: 'Stardust',
    description: 'Tiny pale motes that hang in the air long after you pass.',
    cost: 8,
    particles: {
      sprite: 'spark',
      color: [0.85, 0.9, 1.0],
      color2: [0.7, 0.8, 1.0],
      rate: 60,
      life: [1.2, 2.2],
      size: [0.06, 0.14],
      endSize: 0,
      power: [0.1, 0.5],
      spread: 0.5,
      gravity: 0.2,
      alpha: 0.9,
      drift: 'random',
    },
  },
  {
    id: 'embers',
    name: 'Embers',
    description: 'Orange cinders that rise and fade.',
    cost: 12,
    particles: {
      sprite: 'disc',
      color: [1.0, 0.45, 0.12],
      color2: [1.0, 0.2, 0.05],
      rate: 70,
      life: [0.8, 1.5],
      size: [0.12, 0.26],
      endSize: 0.2,
      power: [0.3, 1.2],
      spread: 0.3,
      gravity: 1.6,
      alpha: 0.85,
      drift: 'up',
    },
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    description: 'Pale rings that drift upward and pop.',
    cost: 18,
    particles: {
      sprite: 'ring',
      color: [0.75, 0.9, 1.0],
      color2: [0.9, 1.0, 1.0],
      rate: 40,
      life: [1.0, 1.8],
      size: [0.12, 0.3],
      endSize: 1.6,
      power: [0.2, 0.6],
      spread: 0.35,
      gravity: 1.2,
      alpha: 0.6,
      drift: 'up',
    },
  },
  {
    id: 'afterimage',
    name: 'Afterimage',
    description: 'Ghost copies of the ball left hanging where it was.',
    cost: 25,
    particles: {
      sprite: 'disc',
      color: 'theme',
      rate: 18,
      life: [0.5, 0.7],
      size: [0.85, 0.85],
      endSize: 0.3,
      power: [0, 0],
      spread: 0,
      gravity: 0,
      alpha: 0.4,
      drift: 'random',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Green and violet light that lifts off the ball in slow curtains.',
    cost: 35,
    particles: {
      sprite: 'disc',
      color: [0.3, 1.0, 0.6],
      color2: [0.6, 0.35, 1.0],
      rate: 80,
      life: [0.9, 1.6],
      size: [0.3, 0.6],
      endSize: 1.3,
      power: [0.4, 1.0],
      spread: 0.4,
      gravity: 0.9,
      alpha: 0.35,
      drift: 'up',
    },
  },
];

export const DEFAULT_TRAIL_ID = 'none';

export function getTrail(id: string): TrailStyle {
  return TRAILS.find((trail) => trail.id === id) ?? TRAILS[0]!;
}
