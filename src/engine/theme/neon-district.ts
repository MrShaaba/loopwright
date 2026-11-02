import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ThemeConfig } from './ThemeConfig';

const fog = new Color3(0.05, 0.03, 0.09);

/** A city at night: a lit skyline all around, wet asphalt, and neon rails beside the tube. */
export const neonDistrict: ThemeConfig = {
  id: 'neon-district',
  name: 'Neon District',
  tagline: 'Towers full of windows, and two neon rails to light the way.',
  sky: {
    horizon: fog,
    band: new Color3(0.2, 0.08, 0.3),
    zenith: new Color3(0.01, 0.01, 0.03),
    starDensity: 0.01,
    bandStrength: 0,
    moons: [],
  },
  fog: { color: fog, density: 0.0017 },
  lighting: {
    key: {
      azimuthDeg: 150,
      elevationDeg: 42,
      color: new Color3(0.72, 0.5, 1.0),
      intensity: 1.4,
      shadows: false,
    },
    fill: {
      sky: new Color3(0.3, 0.14, 0.42),
      ground: new Color3(0.06, 0.02, 0.08),
      intensity: 0.9,
    },
    glow: 1.1,
    exposure: 1.15,
    contrast: 1.18,
    vignette: 1.6,
  },
  floor: {
    color: new Color3(0.035, 0.03, 0.055),
    grid: { color: new Color3(0.5, 0.18, 0.6), spacing: 4, strength: 0.35 },
  },
  tube: {
    tint: new Color3(0.42, 0.12, 0.5),
    edge: new Color3(1.0, 0.38, 0.85),
    streak: new Color3(1.0, 0.8, 1.0),
    intensity: 1.05,
    support: new Color3(0.16, 0.12, 0.2),
    tunnel: new Color3(0.04, 0.02, 0.06),
  },
  ball: { color: new Color3(0.55, 0.95, 1.0), light: 1.6 },
  ui: { accent: '#ff5fc8', accentSoft: 'rgba(255, 95, 200, 0.16)', accentText: '#ffd3f1' },
  props: {
    rails: {
      left: new Color3(1.0, 0.2, 0.7),
      right: new Color3(0.2, 0.9, 1.0),
    },
    skyline: {
      count: 84,
      distance: [210, 330],
      height: [18, 120],
      width: [9, 24],
      body: new Color3(0.025, 0.02, 0.04),
      windows: [new Color3(1.0, 0.78, 0.5), new Color3(0.55, 0.8, 1.0)],
    },
  },
};
