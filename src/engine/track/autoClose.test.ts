import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it } from 'vitest';
import { DEG, wrapAngle } from '../util/math';
import { buildReturn, heightProfile, planReturn, RETURN_RADIUS } from './autoClose';
import { makePose } from './pose';
import type { Pose } from './types';

const START = makePose(new Vector3(0, 3.2, 0), 0, 0);

function endHeading(keys: { position: Vector3 }[]): number {
  const a = keys[keys.length - 2]?.position ?? Vector3.Zero();
  const b = keys[keys.length - 1]?.position ?? Vector3.Zero();
  return Math.atan2(b.x - a.x, b.z - a.z);
}

function check(exit: Pose): void {
  const geometry = buildReturn(exit, START);
  const last = geometry.keys[geometry.keys.length - 1];
  expect(last).toBeDefined();
  if (!last) return;
  expect(Vector3.Distance(last.position, START.position)).toBeLessThan(1e-6);
  // Heading over the last metre should point along the start's yaw within a couple of degrees.
  expect(Math.abs(wrapAngle(endHeading(geometry.keys) - START.yaw))).toBeLessThan(2.5 * DEG);
  expect(geometry.length).toBeGreaterThan(0);
  // Every key sits above the lower of the two end heights when both pitches are level.
  if (exit.pitch === 0) {
    const floor = Math.min(exit.position.y, START.position.y) - 1e-6;
    for (const key of geometry.keys) expect(key.position.y).toBeGreaterThanOrEqual(floor);
  }
}

describe('planReturn', () => {
  it('finds a straight when the exit lines up behind the start', () => {
    const plan = planReturn(makePose(new Vector3(0, 3.2, -40), 0, 0), START);
    expect(plan.straight).toBeCloseTo(40, 6);
    expect(plan.first.angle).toBeCloseTo(0, 6);
    expect(plan.second.angle).toBeCloseTo(0, 6);
  });

  it('turns back with two arcs when the exit faces away', () => {
    const plan = planReturn(makePose(new Vector3(0, 3.2, 60), 0, 0), START);
    expect(plan.length).toBeGreaterThan(60);
    expect(plan.first.angle + plan.second.angle).toBeGreaterThan(Math.PI);
  });

  it('prefers the opposite-direction path when it is shorter', () => {
    const exit = makePose(new Vector3(2 * RETURN_RADIUS + 20, 3.2, -30), 0, 0);
    const plan = planReturn(exit, START);
    expect(plan.type === 'LSR' || plan.type === 'RSL').toBe(true);
  });
});

describe('buildReturn', () => {
  it('returns no keys when the exit already sits on the start', () => {
    expect(buildReturn(makePose(START.position.clone(), 0, 0), START).keys).toHaveLength(0);
  });

  it('lands on the start pose from many exit poses', () => {
    const cases: Pose[] = [
      makePose(new Vector3(40, 3.2, 10), 90 * DEG, 0),
      makePose(new Vector3(-55, 12, 30), -140 * DEG, 0),
      makePose(new Vector3(8, 20, 70), 180 * DEG, 0),
      makePose(new Vector3(-3, 3.2, -6), 10 * DEG, 0),
      makePose(new Vector3(120, 30, -80), 45 * DEG, 0),
      makePose(new Vector3(0, 3.2, 40), 0, 0),
      makePose(new Vector3(0.5, 3.2, -0.5), 3 * DEG, 0),
    ];
    for (const exit of cases) check(exit);
  });

  it('honours an exit pitch in the height profile', () => {
    const exit = makePose(new Vector3(30, 18, 40), 120 * DEG, -20 * DEG);
    const geometry = buildReturn(exit, START);
    const first = geometry.keys[0];
    const second = geometry.keys[1];
    expect(first && second).toBeTruthy();
    if (!first || !second) return;
    const dh = Math.hypot(
      second.position.x - first.position.x,
      second.position.z - first.position.z,
    );
    const slope = (second.position.y - first.position.y) / dh;
    expect(slope).toBeLessThan(-0.25);
    const last = geometry.keys[geometry.keys.length - 1];
    expect(last?.position.y).toBeCloseTo(START.position.y, 6);
  });

  it('spreads keys about a metre apart', () => {
    const geometry = buildReturn(makePose(new Vector3(60, 3.2, 50), 90 * DEG, 0), START);
    for (let i = 1; i < geometry.keys.length; i++) {
      const a = geometry.keys[i - 1]?.position ?? Vector3.Zero();
      const b = geometry.keys[i]?.position ?? Vector3.Zero();
      expect(Vector3.Distance(a, b)).toBeLessThan(1.5);
    }
  });
});

describe('heightProfile', () => {
  it('matches both heights and slopes', () => {
    const profile = heightProfile(10, 0.3, 4, 0, 50);
    expect(profile(0)).toBeCloseTo(10, 9);
    expect(profile(50)).toBeCloseTo(4, 9);
    expect((profile(0.01) - profile(0)) / 0.01).toBeCloseTo(Math.tan(0.3), 2);
    expect((profile(50) - profile(49.99)) / 0.01).toBeCloseTo(0, 2);
  });
});
