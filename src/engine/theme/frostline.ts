import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ThemeConfig } from './ThemeConfig';

const fog = new Color3(0.075, 0.095, 0.15);

/** A snowfield at night: falling snow, pines with white caps, and string lights along the tube. */
export const frostline: ThemeConfig = {
  id: 'frostline',
  name: 'Frostline',
  tagline: 'Snow on the pines and lights strung along the glass.',
  sky: {
    horizon: fog,
    band: new Color3(0.17, 0.21, 0.34),
    zenith: new Color3(0.015, 0.02, 0.06),
    starDensity: 0.03,
    bandStrength: 0.5,
    moons: [
      {
        azimuthDeg: 305,
        elevationDeg: 36,
        angularSizeDeg: 3.4,
        tint: new Color3(0.95, 0.97, 1.0),
        glow: new Color3(0.35, 0.42, 0.6),
      },
    ],
  },
  fog: { color: fog, density: 0.0026 },
  lighting: {
    key: {
      azimuthDeg: 305,
      elevationDeg: 36,
      color: new Color3(0.74, 0.82, 1.0),
      intensity: 1.9,
      shadows: false,
    },
    fill: {
      sky: new Color3(0.28, 0.34, 0.5),
      ground: new Color3(0.14, 0.15, 0.2),
      intensity: 0.9,
    },
    glow: 0.9,
    exposure: 1.1,
    contrast: 1.1,
    vignette: 1.8,
  },
  floor: {
    color: new Color3(0.3, 0.34, 0.46),
    grid: null,
  },
  tube: {
    tint: new Color3(0.16, 0.3, 0.52),
    edge: new Color3(0.6, 0.85, 1.0),
    streak: new Color3(0.9, 0.97, 1.0),
    intensity: 1,
    support: new Color3(0.22, 0.24, 0.3),
    tunnel: new Color3(0.05, 0.055, 0.08),
  },
  ball: { color: new Color3(1.0, 0.74, 0.42), light: 1.5 },
  ui: { accent: '#9fd4ff', accentSoft: 'rgba(159, 212, 255, 0.16)', accentText: '#dff0ff' },
  props: {
    weather: {
      kind: 'snow',
      color: new Color3(0.92, 0.95, 1.0),
      rate: 260,
      size: [0.07, 0.16],
      speed: [1.4, 2.4],
    },
    scatter: [
      {
        kind: 'pine',
        count: 170,
        color: new Color3(0.07, 0.16, 0.11),
        accent: new Color3(0.72, 0.78, 0.9),
        clearance: 7,
        spread: 70,
        scale: [0.7, 1.5],
      },
    ],
    lights: {
      colors: [
        new Color3(1.0, 0.84, 0.5),
        new Color3(1.0, 0.3, 0.3),
        new Color3(0.35, 1.0, 0.5),
        new Color3(0.45, 0.65, 1.0),
      ],
      spacing: 2.5,
      lift: 0.85,
      size: 0.22,
    },
  },
};
