import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ThemeConfig } from './ThemeConfig';

const fog = new Color3(0.05, 0.06, 0.115);

/** The default look: a soft dark gradient, gentle fog, a faint floor grid and a glass tube. */
export const minimal: ThemeConfig = {
  id: 'minimal',
  name: 'Minimal',
  tagline: 'A glowing ball, a glass tube, and nothing in the way.',
  sky: {
    horizon: fog,
    band: new Color3(0.07, 0.09, 0.18),
    zenith: new Color3(0.008, 0.01, 0.026),
    starDensity: 0,
    bandStrength: 0,
    moons: [],
  },
  fog: { color: fog, density: 0.0019 },
  lighting: {
    key: {
      azimuthDeg: 210,
      elevationDeg: 48,
      color: new Color3(0.7, 0.78, 1.0),
      intensity: 1.6,
      shadows: false,
    },
    fill: {
      sky: new Color3(0.22, 0.26, 0.42),
      ground: new Color3(0.03, 0.03, 0.05),
      intensity: 0.9,
    },
    glow: 0.9,
    exposure: 1.15,
    contrast: 1.1,
    vignette: 1.6,
  },
  floor: {
    color: new Color3(0.035, 0.042, 0.08),
    grid: { color: new Color3(0.2, 0.28, 0.52), spacing: 6, strength: 0.5 },
  },
  tube: {
    tint: new Color3(0.16, 0.26, 0.6),
    edge: new Color3(0.42, 0.78, 1.0),
    streak: new Color3(0.75, 0.93, 1.0),
    intensity: 1,
    support: new Color3(0.2, 0.23, 0.32),
    tunnel: new Color3(0.035, 0.04, 0.07),
  },
  ball: { color: new Color3(1.0, 0.82, 0.48), light: 1.4 },
  ui: { accent: '#6fc3ff', accentSoft: 'rgba(111, 195, 255, 0.16)', accentText: '#cfeaff' },
  music: {
    root: 220,
    scale: [0, 3, 5, 7, 10],
    drone: {
      wave: 'sine',
      layers: [0.5, 1],
      detune: 4,
      cutoff: 900,
      lfoRate: 0.08,
      lfoDepth: 220,
      gain: 0.16,
    },
    melody: {
      wave: 'triangle',
      interval: [2.5, 5],
      octave: 2,
      attack: 0.6,
      release: 2.4,
      gain: 0.07,
      glide: 0,
      echo: 0.45,
    },
  },
};
