import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TAU } from '../../util/math';
import { Cursor } from '../cursor';
import { numberParam, type SectionDef } from './types';

/** Steepest slope of a wave run in radians, for validation. */
export function waveMaxPitch(amplitude: number, length: number, waves: number): number {
  return Math.atan((amplitude * Math.PI * waves) / Math.max(length, 1e-6));
}

export const wave: SectionDef = {
  type: 'wave',
  label: 'Wave run',
  description: 'A string of airtime hills.',
  params: [
    {
      kind: 'number',
      key: 'length',
      label: 'Length',
      min: 20,
      max: 160,
      step: 1,
      default: 60,
      unit: 'm',
    },
    { kind: 'number', key: 'waves', label: 'Waves', min: 1, max: 8, step: 1, default: 3 },
    {
      kind: 'number',
      key: 'amplitude',
      label: 'Amplitude',
      min: 1,
      max: 12,
      step: 0.5,
      default: 4,
      unit: 'm',
    },
  ],
  frame: 'gravity',
  build: (entry, params) => {
    const length = numberParam(params, 'length', 60);
    const waves = Math.round(numberParam(params, 'waves', 3));
    const amplitude = numberParam(params, 'amplitude', 4);
    const steps = Math.max(24, Math.ceil(length), waves * 16);
    return new Cursor(entry)
      .custom(
        steps,
        (u) => ({
          offset: new Vector3(length * u, (amplitude * (1 - Math.cos(TAU * waves * u))) / 2, 0),
        }),
        { yaw: entry.yaw, pitch: 0 },
      )
      .finish();
  },
};
