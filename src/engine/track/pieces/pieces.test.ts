import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it } from 'vitest';
import { DEG, TAU } from '../../util/math';
import { makePose } from '../pose';
import { defaultParams, getPiece, listPieces } from './index';
import { CORKSCREW_ADVANCE, CORKSCREW_RADIUS, LOOP_DRIFT, LOOP_STRETCH } from './inversions';

const origin = (): ReturnType<typeof makePose> => makePose(new Vector3(0, 1.2, -6), 0, 0);

describe('piece registry', () => {
  it('offers every visible piece with default params that build', () => {
    const pieces = listPieces();
    expect(pieces.map((p) => p.id)).toEqual([
      'straight',
      'curve',
      'helix',
      'slope-up',
      'slope-down',
      'level-out',
      'lift-hill',
      'drop',
      'loop',
      'corkscrew',
      'brake-run',
    ]);
    for (const def of pieces) {
      if (def.check?.(origin(), defaultParams(def))) continue;
      const geometry = def.build(origin(), defaultParams(def));
      expect(geometry.keys.length).toBeGreaterThan(1);
      expect(geometry.length).toBeGreaterThan(0);
      expect(geometry.keys[0]?.t).toBe(0);
      expect(geometry.keys.at(-1)?.t).toBeCloseTo(1, 9);
    }
  });
});

describe('straight and station', () => {
  it('advances along the heading by the requested length', () => {
    const geometry = getPiece('straight').build(makePose(new Vector3(1, 2, 3), Math.PI / 2, 0), {
      length: 16,
    });
    expect(geometry.exit.position.x).toBeCloseTo(17, 9);
    expect(geometry.exit.position.z).toBeCloseTo(3, 9);
    expect(geometry.length).toBe(16);
  });

  it('flags station keys', () => {
    const geometry = getPiece('station').build(origin(), {});
    expect(geometry.keys.every((k) => k.flags.station)).toBe(true);
    expect(geometry.exit.position.z).toBeCloseTo(6, 9);
  });
});

describe('curve', () => {
  it('returns to the start after four right-hand 90° turns', () => {
    const def = getPiece('curve');
    let pose = origin();
    for (let i = 0; i < 4; i++) {
      pose = def.build(pose, { direction: 'right', radius: 14, angle: 90, bank: 'auto' }).exit;
    }
    expect(Vector3.Distance(pose.position, origin().position)).toBeLessThan(1e-9);
    expect(pose.yaw).toBeCloseTo(TAU, 9);
    expect(pose.pitch).toBe(0);
  });

  it('turns left by decreasing yaw and mirrors the bank sign', () => {
    const def = getPiece('curve');
    const right = def.build(origin(), { direction: 'right', radius: 8, angle: 45, bank: 'auto' });
    const left = def.build(origin(), { direction: 'left', radius: 8, angle: 45, bank: 'auto' });
    expect(right.exit.yaw).toBeCloseTo(45 * DEG, 9);
    expect(left.exit.yaw).toBeCloseTo(-45 * DEG, 9);
    expect(right.exit.position.x).toBeGreaterThan(0);
    expect(left.exit.position.x).toBeLessThan(0);
    const midRight = right.keys[Math.floor(right.keys.length / 2)]?.bank ?? 0;
    const midLeft = left.keys[Math.floor(left.keys.length / 2)]?.bank ?? 0;
    expect(midRight).toBeGreaterThan(0);
    expect(midLeft).toBeCloseTo(-midRight, 9);
    expect(midRight).toBeLessThanOrEqual(60 * DEG + 1e-9);
  });

  it('keeps a flat curve unbanked', () => {
    const flat = getPiece('curve').build(origin(), {
      direction: 'right',
      radius: 14,
      angle: 90,
      bank: 'flat',
    });
    expect(flat.keys.every((k) => k.bank === 0)).toBe(true);
  });
});

describe('slopes', () => {
  it('pitches up, then level out returns to flat', () => {
    const up = getPiece('slope-up').build(origin(), {});
    expect(up.exit.pitch).toBeCloseTo(25 * DEG, 9);
    expect(up.exit.position.y).toBeGreaterThan(1.2);
    const level = getPiece('level-out').build(up.exit, {});
    expect(level.exit.pitch).toBeCloseTo(0, 9);
    expect(level.exit.position.y).toBeGreaterThan(up.exit.position.y);
  });

  it('refuses to exceed the pitch limit and to level an already level track', () => {
    const slopeUp = getPiece('slope-up');
    let pose = origin();
    expect(slopeUp.check?.(pose, {})).toBeNull();
    for (let i = 0; i < 3; i++) pose = slopeUp.build(pose, {}).exit;
    expect(slopeUp.check?.(pose, {})).toMatch(/steep/i);
    expect(getPiece('level-out').check?.(origin(), {})).toMatch(/already level/i);
  });
});

describe('lift hill and drop', () => {
  it('climbs by the requested height, exits level and flags the chain', () => {
    for (const height of [8, 16, 24]) {
      const lift = getPiece('lift-hill').build(origin(), { height });
      expect(lift.exit.position.y - 1.2).toBeCloseTo(height, 6);
      expect(lift.exit.pitch).toBeCloseTo(0, 9);
      expect(lift.keys.slice(1).every((k) => k.flags.chain)).toBe(true);
    }
  });

  it('drops by the requested depth and exits level', () => {
    for (const depth of [12, 20, 30]) {
      const start = makePose(new Vector3(0, 40, 0), 0, 0);
      const fall = getPiece('drop').build(start, { depth });
      expect(40 - fall.exit.position.y).toBeCloseTo(depth, 6);
      expect(fall.exit.pitch).toBeCloseTo(0, 9);
    }
  });

  it('needs a level entry', () => {
    const pitched = makePose(new Vector3(), 0, 20 * DEG);
    expect(getPiece('lift-hill').check?.(pitched, { height: 16 })).toMatch(/level/i);
    expect(getPiece('drop').check?.(origin(), { depth: 20 })).toBeNull();
  });
});

describe('loop', () => {
  it('rises to a stretched diameter and exits beside its entry, level and on heading', () => {
    const loop = getPiece('loop').build(origin(), { size: 'small' });
    const top = Math.max(...loop.keys.map((k) => k.position.y));
    expect(top - 1.2).toBeCloseTo(2 * LOOP_STRETCH * 8, 6);
    expect(loop.exit.position.x).toBeCloseTo(LOOP_DRIFT, 6);
    expect(loop.exit.position.z).toBeCloseTo(-6, 6);
    expect(loop.exit.yaw).toBe(0);
    expect(loop.exit.pitch).toBe(0);
    expect(getPiece('loop').frame).toBe('transport');
  });
});

describe('corkscrew', () => {
  it('rolls a full turn, exits level, and sweeps to the roll side', () => {
    const right = getPiece('corkscrew').build(origin(), { direction: 'right' });
    expect(right.exit.position.z + 6).toBeCloseTo(CORKSCREW_ADVANCE * TAU, 6);
    expect(right.exit.position.x).toBeCloseTo(CORKSCREW_RADIUS * TAU, 6);
    expect(right.keys.at(-1)?.bank).toBeCloseTo(TAU, 9);
    const left = getPiece('corkscrew').build(origin(), { direction: 'left' });
    expect(left.exit.position.x).toBeCloseTo(-CORKSCREW_RADIUS * TAU, 6);
    expect(left.keys.at(-1)?.bank).toBeCloseTo(-TAU, 9);
  });
});

describe('helix', () => {
  it('completes its turns and descends when sloped down', () => {
    const helix = getPiece('helix').build(origin(), {
      direction: 'left',
      turns: 1.5,
      slope: 'down',
    });
    expect(helix.exit.yaw).toBeCloseTo(-1.5 * TAU, 9);
    expect(helix.exit.pitch).toBeCloseTo(0, 9);
    expect(helix.exit.position.y).toBeLessThan(1.2 - 5);
    const level = getPiece('helix').build(origin(), {
      direction: 'right',
      turns: 1,
      slope: 'level',
    });
    expect(level.exit.position.y).toBeCloseTo(1.2, 9);
    expect(Vector3.Distance(level.exit.position, origin().position)).toBeLessThan(1e-9);
  });
});
