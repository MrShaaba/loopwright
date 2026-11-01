import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DEG, TAU, smoothstep } from '../../util/math';
import { autoBank } from '../bank';
import { Cursor } from '../cursor';
import { directionParam, easedRamp, numberParam, type SectionDef } from './types';

/** Shared by the helix and the spiral: a horizontal coil with a smooth climb and eased bank. */
export function coilGeometry(
  entryYaw: number,
  direction: 'left' | 'right',
  turns: number,
  radiusAt: (u: number) => number,
  totalRise: number,
): { shape: (u: number) => { offset: Vector3; bank: number }; steps: number; exitYaw: number } {
  const s = direction === 'right' ? 1 : -1;
  const total = turns * TAU;
  const startRadius = radiusAt(0);
  // About one key per metre along the widest coil.
  const steps = Math.max(32, Math.ceil(turns * TAU * Math.max(radiusAt(0), radiusAt(1))));
  const shape = (u: number): { offset: Vector3; bank: number } => {
    const phi = total * u;
    const r = radiusAt(u);
    // The coil's centre sits one start-radius to the side of the entry; the point sits one
    // current-radius from the centre at angle phi. In the entry basis forward is x and right is z.
    const x = r * Math.sin(phi);
    const z = s * (startRadius - r * Math.cos(phi));
    const y = totalRise * easedRamp(u);
    const ease = smoothstep(0, 0.12, u) * (1 - smoothstep(0.88, 1, u));
    return { offset: new Vector3(x, y, z), bank: autoBank(r, direction) * ease };
  };
  return { shape, steps, exitYaw: entryYaw + s * total };
}

export const helix: SectionDef = {
  type: 'helix',
  label: 'Helix coil',
  description: 'Circles around a fixed radius, climbing or sinking each turn.',
  params: [
    {
      kind: 'choice',
      key: 'direction',
      label: 'Direction',
      options: ['left', 'right'],
      default: 'right',
    },
    {
      kind: 'number',
      key: 'radius',
      label: 'Radius',
      min: 6,
      max: 30,
      step: 0.5,
      default: 14,
      unit: 'm',
    },
    { kind: 'number', key: 'turns', label: 'Turns', min: 0.5, max: 3, step: 0.25, default: 1.5 },
    {
      kind: 'number',
      key: 'climb',
      label: 'Climb per turn',
      min: -20,
      max: 20,
      step: 0.5,
      default: 6,
      unit: 'm',
    },
  ],
  frame: 'gravity',
  build: (entry, params) => {
    const direction = directionParam(params);
    const radius = numberParam(params, 'radius', 14);
    const turns = numberParam(params, 'turns', 1.5);
    const climb = numberParam(params, 'climb', 6);
    const coil = coilGeometry(entry.yaw, direction, turns, () => radius, climb * turns);
    return new Cursor(entry)
      .custom(coil.steps, coil.shape, { yaw: coil.exitYaw, pitch: 0 })
      .finish();
  },
};

/** Steepest pitch in the coil for validation. */
export function coilMaxPitch(radius: number, climbPerTurn: number): number {
  const circumference = TAU * Math.max(radius, 1e-6);
  return Math.atan((Math.abs(climbPerTurn) / circumference) * (1 / 0.78));
}

export const COIL_EASE_DEG = 12 * DEG;
