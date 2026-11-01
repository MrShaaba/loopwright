import type { FrameMode, Pose, SectionGeometry } from '../types';

export type SectionType =
  'straight' | 'hill' | 'turn' | 'loop' | 'corkscrew' | 'helix' | 'spiral' | 'wave' | 'jump';

export type ParamValue = number | boolean | string;
export type SectionParams = Record<string, ParamValue>;

export type ParamSpec =
  | {
      kind: 'number';
      key: string;
      label: string;
      min: number;
      max: number;
      step: number;
      default: number;
      unit?: string;
    }
  | { kind: 'boolean'; key: string; label: string; default: boolean }
  | { kind: 'choice'; key: string; label: string; options: readonly string[]; default: string };

export interface SectionDef {
  type: SectionType;
  label: string;
  description: string;
  params: readonly ParamSpec[];
  frame: FrameMode;
  build: (entry: Pose, params: SectionParams) => SectionGeometry;
}

export function numberParam(params: SectionParams, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function booleanParam(params: SectionParams, key: string, fallback: boolean): boolean {
  const value = params[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function choiceParam<T extends string>(
  params: SectionParams,
  key: string,
  options: readonly T[],
  fallback: T,
): T {
  const value = params[key];
  return typeof value === 'string' && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function directionParam(params: SectionParams): 'left' | 'right' {
  return choiceParam(params, 'direction', ['left', 'right'] as const, 'right');
}

/**
 * Smooth ramp from 0 to 1 with zero slope at both ends: eases over the first and last `ease`
 * fraction and runs at a constant rate between. Used for every vertical blend.
 */
export function easedRamp(u: number, ease = 0.22): number {
  const e = Math.min(0.5, Math.max(1e-3, ease));
  const x = Math.min(1, Math.max(0, u));
  const norm = 1 - e;
  if (x < e) return (x * x) / (2 * e) / norm;
  if (x <= 1 - e) return (e / 2 + (x - e)) / norm;
  const r = 1 - x;
  return (1 - e - (r * r) / (2 * e)) / norm;
}
