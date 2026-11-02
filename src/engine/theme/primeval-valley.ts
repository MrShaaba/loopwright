import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ThemeConfig } from './ThemeConfig';

const fog = new Color3(0.26, 0.13, 0.07);

/** A prehistoric dusk: a low orange sun, warm haze, red earth and an ember-coloured ball. */
export const primevalValley: ThemeConfig = {
  id: 'primeval-valley',
  name: 'Primeval Valley',
  tagline: 'Dusk over red earth, with the volcano still warm.',
  sky: {
    horizon: fog,
    band: new Color3(0.5, 0.22, 0.09),
    zenith: new Color3(0.05, 0.03, 0.08),
    starDensity: 0.006,
    bandStrength: 0,
    moons: [
      {
        azimuthDeg: 300,
        elevationDeg: 9,
        angularSizeDeg: 5.2,
        tint: new Color3(1.0, 0.72, 0.38),
        glow: new Color3(0.9, 0.42, 0.14),
      },
    ],
  },
  fog: { color: fog, density: 0.0024 },
  lighting: {
    key: {
      azimuthDeg: 300,
      elevationDeg: 12,
      color: new Color3(1.0, 0.72, 0.42),
      intensity: 2.6,
      shadows: false,
    },
    fill: {
      sky: new Color3(0.42, 0.24, 0.16),
      ground: new Color3(0.1, 0.05, 0.03),
      intensity: 0.9,
    },
    glow: 0.75,
    exposure: 1.1,
    contrast: 1.12,
    vignette: 1.8,
  },
  floor: {
    color: new Color3(0.16, 0.07, 0.04),
    grid: { color: new Color3(0.42, 0.2, 0.1), spacing: 8, strength: 0.22 },
  },
  tube: {
    tint: new Color3(0.5, 0.22, 0.08),
    edge: new Color3(1.0, 0.62, 0.28),
    streak: new Color3(1.0, 0.85, 0.6),
    intensity: 0.85,
    support: new Color3(0.26, 0.17, 0.1),
    tunnel: new Color3(0.06, 0.03, 0.02),
  },
  ball: { color: new Color3(1.0, 0.36, 0.1), light: 1.6 },
  ui: { accent: '#ff7a3d', accentSoft: 'rgba(255, 122, 61, 0.18)', accentText: '#ffd2b8' },
  music: {
    root: 110,
    scale: [0, 2, 5, 7, 9],
    drone: {
      wave: 'triangle',
      layers: [1, 1.5],
      detune: 5,
      cutoff: 700,
      lfoRate: 0.1,
      lfoDepth: 250,
      gain: 0.14,
    },
    melody: {
      wave: 'triangle',
      interval: [1.8, 4],
      octave: 4,
      attack: 0.15,
      release: 1.2,
      gain: 0.06,
      glide: 0.08,
      echo: 0.3,
    },
    pulse: {
      bpm: 70,
      wave: 'sine',
      cutoff: 200,
      gain: 0.25,
      pattern: [0, -1, -1, 0, -1, -1, 0, -1],
      decay: 0.35,
    },
  },
};
