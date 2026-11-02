import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ThemeConfig } from './ThemeConfig';

const fog = new Color3(0.045, 0.05, 0.1);

/** A moonlit night: cold blue light, a big full moon, stars, and a pumpkin-orange ball. */
export const hauntedHollow: ThemeConfig = {
  id: 'haunted-hollow',
  name: 'Haunted Hollow',
  tagline: 'A moonlit valley where the fog never quite lifts.',
  sky: {
    horizon: fog,
    band: new Color3(0.16, 0.12, 0.24),
    zenith: new Color3(0.01, 0.012, 0.035),
    starDensity: 0.035,
    bandStrength: 1,
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
  fog: { color: fog, density: 0.0028 },
  lighting: {
    key: {
      azimuthDeg: 38,
      elevationDeg: 23,
      color: new Color3(0.66, 0.74, 1.0),
      intensity: 2.2,
      shadows: false,
    },
    fill: {
      sky: new Color3(0.18, 0.2, 0.36),
      ground: new Color3(0.04, 0.035, 0.055),
      intensity: 0.8,
    },
    glow: 0.85,
    exposure: 1.2,
    contrast: 1.15,
    vignette: 2.4,
  },
  floor: {
    color: new Color3(0.06, 0.08, 0.06),
    grid: { color: new Color3(0.2, 0.3, 0.22), spacing: 8, strength: 0.3 },
  },
  tube: {
    tint: new Color3(0.22, 0.16, 0.42),
    edge: new Color3(0.62, 0.5, 1.0),
    streak: new Color3(0.85, 0.75, 1.0),
    intensity: 1,
    support: new Color3(0.14, 0.12, 0.1),
    tunnel: new Color3(0.03, 0.025, 0.04),
  },
  ball: { color: new Color3(1.0, 0.56, 0.16), light: 1.6 },
  ui: { accent: '#ffa63e', accentSoft: 'rgba(255, 166, 62, 0.16)', accentText: '#ffd9a8' },
  music: {
    root: 146.83,
    scale: [0, 2, 3, 6, 7, 8, 11],
    drone: {
      wave: 'sawtooth',
      layers: [0.5, 1],
      detune: 7,
      cutoff: 420,
      lfoRate: 0.05,
      lfoDepth: 180,
      gain: 0.12,
    },
    melody: {
      wave: 'sine',
      interval: [3, 7],
      octave: 2,
      attack: 0.9,
      release: 3,
      gain: 0.06,
      glide: 0,
      echo: 0.6,
    },
  },
};
