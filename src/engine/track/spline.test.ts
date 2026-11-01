import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it } from 'vitest';
import { TAU } from '../util/math';
import { catmullRom, dedupeIndices, resampleSpline } from './spline';

function circle(radius: number, count: number): Vector3[] {
  const points: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    points.push(new Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return points;
}

describe('catmullRom', () => {
  it('passes through its inner control points', () => {
    const p0 = new Vector3(0, 0, 0);
    const p1 = new Vector3(1, 0, 0);
    const p2 = new Vector3(2, 1, 0);
    const p3 = new Vector3(3, 1, 0);
    expect(Vector3.Distance(catmullRom(p0, p1, p2, p3, 0), p1)).toBeLessThan(1e-9);
    expect(Vector3.Distance(catmullRom(p0, p1, p2, p3, 1), p2)).toBeLessThan(1e-9);
  });
});

describe('resampleSpline', () => {
  it('spaces samples evenly along a closed circle and measures its length', () => {
    const radius = 10;
    const { samples, length } = resampleSpline(circle(radius, 36), true, 0.25);
    expect(length).toBeCloseTo(TAU * radius, 1);
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i]?.position ?? Vector3.Zero();
      const b = samples[(i + 1) % samples.length]?.position ?? Vector3.Zero();
      expect(Vector3.Distance(a, b)).toBeCloseTo(length / samples.length, 2);
      expect(a.length()).toBeCloseTo(radius, 1);
    }
  });

  it('starts and ends exactly on the end points of an open path', () => {
    const points = [
      new Vector3(0, 0, 0),
      new Vector3(5, 0, 0),
      new Vector3(10, 3, 0),
      new Vector3(14, 3, 6),
    ];
    const { samples } = resampleSpline(points, false, 0.25);
    expect(
      Vector3.Distance(samples[0]?.position ?? Vector3.One(), points[0] ?? Vector3.Zero()),
    ).toBeLessThan(1e-9);
    expect(
      Vector3.Distance(samples.at(-1)?.position ?? Vector3.One(), points[3] ?? Vector3.Zero()),
    ).toBeLessThan(1e-6);
    expect(samples.at(-1)?.s).toBeGreaterThan(14);
  });

  it('reports the control segment and local parameter of each sample', () => {
    const points = [new Vector3(0, 0, 0), new Vector3(10, 0, 0), new Vector3(20, 0, 0)];
    const { samples } = resampleSpline(points, false, 1);
    const atFive = samples.find((s) => Math.abs(s.s - 5) < 0.01);
    expect(atFive?.segment).toBe(0);
    expect(atFive?.t).toBeCloseTo(0.5, 2);
    const atFifteen = samples.find((s) => Math.abs(s.s - 15) < 0.01);
    expect(atFifteen?.segment).toBe(1);
  });
});

describe('dedupeIndices', () => {
  it('drops coincident neighbours and keeps the later index', () => {
    const points = [
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(2, 0, 0),
    ];
    expect(dedupeIndices(points, false)).toEqual([0, 2, 3]);
  });

  it('drops a closing point that repeats the first one', () => {
    const points = [
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(1, 1, 0),
      new Vector3(0, 0, 0),
    ];
    expect(dedupeIndices(points, true)).toEqual([0, 1, 2]);
  });
});
