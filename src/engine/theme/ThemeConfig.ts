import type { Color3 } from '@babylonjs/core/Maths/math.color';

export interface MoonSpec {
  azimuthDeg: number;
  elevationDeg: number;
  /** Apparent diameter in degrees. The real moon is about 0.5; a stylised one reads better larger. */
  angularSizeDeg: number;
  tint: Color3;
  glow: Color3;
}

export interface SkyConfig {
  /** Colour at the horizon line; should match the fog colour so the floor fades into the sky. */
  horizon: Color3;
  /** Colour of the band just above the horizon. */
  band: Color3;
  zenith: Color3;
  /** Fraction of sky cells that hold a star, 0 to 1. */
  starDensity: number;
  /** Strength of the faint galactic band, 0 to 1. */
  bandStrength: number;
  moons: MoonSpec[];
}

export interface FogConfig {
  color: Color3;
  /** Exponential-squared fog density per metre. */
  density: number;
}

export interface LightingConfig {
  key: {
    azimuthDeg: number;
    elevationDeg: number;
    color: Color3;
    intensity: number;
    shadows: boolean;
  };
  fill: { sky: Color3; ground: Color3; intensity: number };
  /** Glow layer strength for emissive meshes. */
  glow: number;
  exposure: number;
  contrast: number;
  /** Vignette weight; 0 disables it. */
  vignette: number;
}

export interface FloorConfig {
  color: Color3;
  /** Grid line colour and spacing in metres; null draws a plain floor. */
  grid: { color: Color3; spacing: number; strength: number } | null;
}

export interface TubeStyle {
  /** Glass body tint. */
  tint: Color3;
  /** Fresnel edge glow and the rings. */
  edge: Color3;
  /** Speed streak colour. */
  streak: Color3;
  /** Overall brightness multiplier for the tube shader. */
  intensity: number;
  support: Color3;
  tunnel: Color3;
}

export interface BallStyle {
  color: Color3;
  /** Point light intensity cast by the ball onto opaque surfaces. */
  light: number;
}

export interface UiAccent {
  /** CSS colours. */
  accent: string;
  accentSoft: string;
  accentText: string;
}

/** One of these per theme. Switching theme re-skins the same track and never changes the ride. */
export interface ThemeConfig {
  id: string;
  name: string;
  tagline: string;
  sky: SkyConfig;
  fog: FogConfig;
  lighting: LightingConfig;
  floor: FloorConfig;
  tube: TubeStyle;
  ball: BallStyle;
  ui: UiAccent;
}
