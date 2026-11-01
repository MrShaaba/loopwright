import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ThemeConfig } from './ThemeConfig';

const fog = new Color3(0.08, 0.03, 0.14);

/** An alien reach under twin moons: violet haze, a dense starfield and a cyan tube. */
export const xenoReach: ThemeConfig = {
  id: 'xeno-reach',
  name: 'Xeno Reach',
  tagline: 'Twin moons over a world nobody has named.',
  sky: {
    horizon: fog,
    band: new Color3(0.26, 0.08, 0.36),
    zenith: new Color3(0.01, 0.005, 0.03),
    starDensity: 0.07,
    bandStrength: 1,
    moons: [
      {
        azimuthDeg: 70,
        elevationDeg: 30,
        angularSizeDeg: 7,
        tint: new Color3(0.85, 0.62, 1.0),
        glow: new Color3(0.5, 0.2, 0.7),
      },
      {
        azimuthDeg: 110,
        elevationDeg: 18,
        angularSizeDeg: 3,
        tint: new Color3(0.6, 0.95, 1.0),
        glow: new Color3(0.2, 0.5, 0.6),
      },
    ],
  },
  fog: { color: fog, density: 0.0022 },
  lighting: {
    key: {
      azimuthDeg: 70,
      elevationDeg: 30,
      color: new Color3(0.78, 0.6, 1.0),
      intensity: 2.0,
      shadows: false,
    },
    fill: {
      sky: new Color3(0.3, 0.14, 0.4),
      ground: new Color3(0.03, 0.05, 0.06),
      intensity: 0.9,
    },
    glow: 1.0,
    exposure: 1.15,
    contrast: 1.15,
    vignette: 2.0,
  },
  floor: {
    color: new Color3(0.04, 0.03, 0.08),
    grid: { color: new Color3(0.3, 0.12, 0.5), spacing: 5, strength: 0.6 },
  },
  tube: {
    tint: new Color3(0.08, 0.4, 0.5),
    edge: new Color3(0.3, 1.0, 0.9),
    streak: new Color3(0.8, 1.0, 1.0),
    intensity: 1.05,
    support: new Color3(0.16, 0.12, 0.24),
    tunnel: new Color3(0.03, 0.02, 0.06),
  },
  ball: { color: new Color3(0.95, 0.4, 1.0), light: 1.5 },
  ui: { accent: '#5df0dc', accentSoft: 'rgba(93, 240, 220, 0.16)', accentText: '#c8fff6' },
};
