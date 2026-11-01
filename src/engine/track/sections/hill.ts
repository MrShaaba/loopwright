import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Cursor } from '../cursor';
import { booleanParam, easedRamp, numberParam, type SectionDef } from './types';

/** Steepest slope of a hill in radians, for validation: the ramp peaks at 1 / (1 - ease) times the mean. */
export function hillMaxPitch(height: number, length: number): number {
  return Math.atan((height / Math.max(length, 1e-6)) * (1 / 0.78));
}

export const hill: SectionDef = {
  type: 'hill',
  label: 'Hill',
  description: 'Climbs or dives to a new height and levels out again.',
  params: [
    {
      kind: 'number',
      key: 'height',
      label: 'Height',
      min: 2,
      max: 40,
      step: 0.5,
      default: 12,
      unit: 'm',
    },
    {
      kind: 'number',
      key: 'length',
      label: 'Length',
      min: 10,
      max: 120,
      step: 1,
      default: 40,
      unit: 'm',
    },
    { kind: 'boolean', key: 'dive', label: 'Dive', default: false },
  ],
  frame: 'gravity',
  build: (entry, params) => {
    const height =
      numberParam(params, 'height', 12) * (booleanParam(params, 'dive', false) ? -1 : 1);
    const length = numberParam(params, 'length', 40);
    const steps = Math.max(12, Math.ceil(length));
    return new Cursor(entry)
      .custom(steps, (u) => ({ offset: new Vector3(length * u, height * easedRamp(u), 0) }), {
        yaw: entry.yaw,
        pitch: 0,
      })
      .finish();
  },
};
