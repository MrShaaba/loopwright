import type { Color3 } from '@babylonjs/core/Maths/math.color';
import type { AssetRef } from '../assets/AssetRef';
import type { ParkFile } from '../save/schema';

export interface MoonSpec {
  azimuthDeg: number;
  elevationDeg: number;
  /** Apparent diameter in degrees. The real moon is about 0.5; a stylised one reads better larger. */
  angularSizeDeg: number;
  tint: Color3;
  glow: Color3;
}

export interface SkyConfig {
  /** Colour at the horizon line; should match the fog colour so terrain fades into the sky. */
  horizon: Color3;
  /** Colour of the band just above the horizon. */
  band: Color3;
  zenith: Color3;
  /** Fraction of sky cells that hold a star, 0 to 1. */
  starDensity: number;
  moons: MoonSpec[];
}

export interface FogConfig {
  color: Color3;
  /** Exponential-squared fog density per metre. */
  density: number;
  mist: { color: Color3; alpha: number; count: number } | null;
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

export interface TerrainConfig {
  /** Side length of the square park in metres. */
  size: number;
  seed: number;
  subdivisions: number;
  hillHeight: number;
  /** Metres per noise cell; larger values give broader hills. */
  hillScale: number;
  /** Radius of the flat central build area. */
  plateauRadius: number;
  /** Extra height rising towards the park edge so the world feels enclosed. */
  rimHeight: number;
  palette: { low: Color3; high: Color3; steep: Color3; path: Color3 };
  boulders: { count: number; color: Color3 };
}

export interface TrackStyle {
  rail: Color3;
  spine: Color3;
  support: Color3;
  /** Emissive strength on the rails so the track never vanishes into the dark. */
  railGlow: number;
}

export interface PropDef {
  id: string;
  label: string;
  asset: AssetRef;
  minScale: number;
  maxScale: number;
  idle: 'none' | 'sway' | 'flicker' | 'bob';
}

export interface ScareDef {
  id: string;
  label: string;
  asset: AssetRef;
  sound: AssetRef;
  behaviour: 'burst' | 'drift' | 'loom' | 'chase';
  /** Metres from the trigger at which the scare becomes active. */
  range: number;
}

export interface AudioConfig {
  ambient: AssetRef;
  music: AssetRef;
  wind: { minPitch: number; maxPitch: number; gain: number };
  rumble: { minPitch: number; maxPitch: number; gain: number };
}

/** One of these per theme. Switching theme re-skins the same track. */
export interface ThemeConfig {
  id: string;
  name: string;
  tagline: string;
  sky: SkyConfig;
  fog: FogConfig;
  lighting: LightingConfig;
  terrain: TerrainConfig;
  track: TrackStyle;
  props: PropDef[];
  scares: ScareDef[];
  audio: AudioConfig;
  starterPark: ParkFile;
}
