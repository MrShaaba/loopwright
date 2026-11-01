import { Color3 } from '@babylonjs/core/Maths/math.color';
import { createEmptyPark } from '../../save/schema';
import type { ThemeConfig } from '../ThemeConfig';

const fog = new Color3(0.055, 0.065, 0.125);

/**
 * Haunted Hollow: a moonlit graveyard valley. Props, scares and sounds arrive in Phase 4;
 * the atmosphere, terrain and lighting are complete here.
 */
export const hauntedHollow: ThemeConfig = {
  id: 'haunted-hollow',
  name: 'Haunted Hollow',
  tagline: 'A moonlit valley where the fog never quite lifts.',
  sky: {
    horizon: fog,
    band: new Color3(0.19, 0.14, 0.27),
    zenith: new Color3(0.012, 0.016, 0.045),
    starDensity: 0.035,
    moons: [
      {
        azimuthDeg: 38,
        elevationDeg: 23,
        angularSizeDeg: 4.6,
        tint: new Color3(0.98, 0.96, 0.88),
        glow: new Color3(0.42, 0.47, 0.62),
      },
    ],
  },
  fog: {
    color: fog,
    density: 0.0033,
    mist: { color: new Color3(0.5, 0.56, 0.74), alpha: 0.1, count: 320 },
  },
  lighting: {
    key: {
      azimuthDeg: 38,
      elevationDeg: 23,
      color: new Color3(0.66, 0.74, 1.0),
      intensity: 3.4,
      shadows: true,
    },
    fill: {
      sky: new Color3(0.2, 0.23, 0.4),
      ground: new Color3(0.04, 0.035, 0.055),
      intensity: 0.8,
    },
    glow: 0.65,
    exposure: 1.25,
    contrast: 1.15,
    vignette: 2.6,
  },
  terrain: {
    size: 320,
    seed: 1031,
    subdivisions: 160,
    hillHeight: 7,
    hillScale: 46,
    plateauRadius: 42,
    rimHeight: 14,
    palette: {
      low: new Color3(0.13, 0.19, 0.13),
      high: new Color3(0.21, 0.18, 0.13),
      steep: new Color3(0.3, 0.3, 0.34),
      path: new Color3(0.25, 0.21, 0.17),
    },
    boulders: { count: 160, color: new Color3(0.36, 0.37, 0.42) },
  },
  track: {
    rail: new Color3(0.62, 0.46, 0.3),
    spine: new Color3(0.16, 0.13, 0.12),
    support: new Color3(0.14, 0.12, 0.1),
    railGlow: 0.6,
  },
  train: {
    body: new Color3(0.17, 0.08, 0.2),
    trim: new Color3(0.95, 0.52, 0.14),
    seat: new Color3(0.1, 0.09, 0.11),
    lamp: new Color3(1, 0.82, 0.5),
  },
  props: [],
  scares: [],
  audio: {
    ambient: { kind: 'synth', patch: 'haunted-hollow-ambient' },
    music: { kind: 'synth', patch: 'haunted-hollow-music' },
    wind: { minPitch: 120, maxPitch: 900, gain: 0.5 },
    rumble: { minPitch: 30, maxPitch: 140, gain: 0.6 },
  },
  starterPark: createEmptyPark(
    'Haunted Hollow',
    'haunted-hollow',
    new Date('2026-10-31T00:00:00Z'),
  ),
};
