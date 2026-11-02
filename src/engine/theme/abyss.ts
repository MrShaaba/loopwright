import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ThemeConfig } from './ThemeConfig';

const fog = new Color3(0.02, 0.1, 0.14);

/** Deep water: light rippling on the sand, kelp, schools of fish and bubbles rising past. */
export const abyss: ThemeConfig = {
  id: 'abyss',
  name: 'Abyss',
  tagline: 'Down where the light ripples and the kelp leans in.',
  sky: {
    horizon: fog,
    band: new Color3(0.03, 0.2, 0.26),
    zenith: new Color3(0.12, 0.46, 0.52),
    starDensity: 0,
    bandStrength: 0,
    moons: [
      // The sun, seen from under the surface: big, soft and teal.
      {
        azimuthDeg: 20,
        elevationDeg: 72,
        angularSizeDeg: 14,
        tint: new Color3(0.75, 1.0, 0.95),
        glow: new Color3(0.2, 0.6, 0.6),
      },
    ],
  },
  fog: { color: fog, density: 0.0034 },
  lighting: {
    key: {
      azimuthDeg: 20,
      elevationDeg: 72,
      color: new Color3(0.55, 0.95, 0.9),
      intensity: 1.8,
      shadows: false,
    },
    fill: {
      sky: new Color3(0.14, 0.4, 0.42),
      ground: new Color3(0.03, 0.08, 0.08),
      intensity: 0.9,
    },
    glow: 1.0,
    exposure: 1.15,
    contrast: 1.1,
    vignette: 2.2,
  },
  floor: {
    color: new Color3(0.1, 0.15, 0.14),
    grid: null,
    caustics: { color: new Color3(0.35, 0.8, 0.75), strength: 0.3, scale: 0.2 },
  },
  tube: {
    tint: new Color3(0.08, 0.36, 0.4),
    edge: new Color3(0.4, 1.0, 0.9),
    streak: new Color3(0.8, 1.0, 1.0),
    intensity: 1,
    support: new Color3(0.12, 0.2, 0.2),
    tunnel: new Color3(0.02, 0.05, 0.05),
  },
  ball: { color: new Color3(0.6, 1.0, 0.78), light: 1.7 },
  ui: { accent: '#4fe3c1', accentSoft: 'rgba(79, 227, 193, 0.16)', accentText: '#c9fff1' },
  props: {
    weather: {
      kind: 'bubbles',
      color: new Color3(0.7, 0.92, 1.0),
      rate: 120,
      size: [0.06, 0.22],
      speed: [0.6, 1.4],
    },
    scatter: [
      {
        kind: 'kelp',
        count: 200,
        color: new Color3(0.05, 0.24, 0.17),
        accent: new Color3(0.02, 0.1, 0.07),
        clearance: 9,
        spread: 45,
        scale: [3, 7],
      },
    ],
    swimmers: {
      schools: 7,
      perSchool: 7,
      color: new Color3(0.45, 0.65, 0.75),
      glow: new Color3(0.08, 0.18, 0.22),
    },
  },
  music: {
    root: 55,
    scale: [0, 3, 5, 7, 10],
    drone: {
      wave: 'sine',
      layers: [1, 2],
      detune: 2,
      cutoff: 300,
      lfoRate: 0.04,
      lfoDepth: 120,
      gain: 0.2,
    },
    melody: {
      wave: 'sine',
      interval: [4, 9],
      octave: 4,
      attack: 1.5,
      release: 4,
      gain: 0.05,
      glide: 1.2,
      echo: 0.7,
    },
  },
};
