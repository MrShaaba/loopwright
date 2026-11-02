import type { Color3 } from '@babylonjs/core/Maths/math.color';
import type { MusicSpec } from '../audio/music';

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
  /** Rippling light on the floor, as under water. Omit for none. */
  caustics?: { color: Color3; strength: number; scale: number };
}

/** Falling, rising or drifting particles around the camera. */
export interface WeatherConfig {
  kind: 'snow' | 'bubbles' | 'dust';
  color: Color3;
  /** Particles per second. */
  rate: number;
  /** Metres across, min and max. */
  size: [number, number];
  /** Metres per second along the fall or rise, min and max. */
  speed: [number, number];
}

/** Static things scattered on the floor, clear of the track. */
export interface ScatterConfig {
  kind: 'pine' | 'kelp';
  count: number;
  color: Color3;
  /** A second colour: snow on the pines, the glow in the kelp. */
  accent: Color3;
  /** Least distance from the tube's centre line, metres. */
  clearance: number;
  /** How far beyond the track's footprint things may stand, metres. */
  spread: number;
  /** Scale range. */
  scale: [number, number];
}

/** Small lights strung along the top of the tube. */
export interface LightStringConfig {
  colors: Color3[];
  /** Metres between lights. */
  spacing: number;
  /** Height above the tube's top, metres. */
  lift: number;
  size: number;
}

/** Two glowing rails that run beside the tube. */
export interface RailConfig {
  left: Color3;
  right: Color3;
}

/** A ring of lit buildings far off around the track. */
export interface SkylineConfig {
  count: number;
  /** Distance from the track's centre, min and max, metres. */
  distance: [number, number];
  height: [number, number];
  width: [number, number];
  body: Color3;
  /** Warm and cool window colours. */
  windows: [Color3, Color3];
}

/** Schools of small swimmers circling near the track. */
export interface SwimmerConfig {
  schools: number;
  perSchool: number;
  color: Color3;
  glow: Color3;
}

/** Decoration a theme adds around the track. All of it is looks only. */
export interface PropConfig {
  weather?: WeatherConfig;
  scatter?: ScatterConfig[];
  lights?: LightStringConfig;
  rails?: RailConfig;
  skyline?: SkylineConfig;
  swimmers?: SwimmerConfig;
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
  props?: PropConfig;
  /** The synthesised ambient bed that plays under this look when music is on. */
  music: MusicSpec;
}
