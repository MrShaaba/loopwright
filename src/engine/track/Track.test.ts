import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it } from 'vitest';
import { compileTrack, createSection, sectionAtPoint, START_POSE } from './Track';

describe('compileTrack', () => {
  it('closes a simple layout with a return section and evenly spaced frames', () => {
    const track = compileTrack([
      createSection('straight', { length: 40 }),
      createSection('turn', { direction: 'right', radius: 20, angle: 90 }),
    ]);
    expect(track.frames.length).toBeGreaterThan(100);
    expect(track.ranges).toHaveLength(3);
    expect(track.ranges[2]?.type).toBe('return');
    expect(track.returnLength).toBeGreaterThan(10);
    expect(track.length).toBeCloseTo(track.frames.length * 0.25, 9);
    for (let i = 0; i < track.frames.length; i++) {
      const a = track.frames[i]?.position ?? Vector3.Zero();
      const b = track.frames[(i + 1) % track.frames.length]?.position ?? Vector3.Zero();
      expect(Vector3.Distance(a, b)).toBeLessThan(0.3);
    }
  });

  it('starts at the start pose and has contiguous section ranges that cover the loop', () => {
    const track = compileTrack([
      createSection('hill', { height: 10, length: 40 }),
      createSection('loop'),
      createSection('wave'),
    ]);
    const first = track.frames[0];
    expect(first && Vector3.Distance(first.position, START_POSE.position)).toBeLessThan(0.3);
    expect(track.ranges[0]?.s0).toBe(0);
    for (let i = 1; i < track.ranges.length; i++) {
      const previous = track.ranges[i - 1];
      const range = track.ranges[i];
      expect(range?.s0).toBeGreaterThan(previous?.s0 ?? -1);
      expect(range?.s0).toBeCloseTo((previous?.s1 ?? 0) + 0.25, 2);
    }
    expect(track.ranges[track.ranges.length - 1]?.s1).toBeCloseTo(track.length, 2);
  });

  it('keeps frames continuous in tangent and up through a loop', () => {
    const track = compileTrack([createSection('straight', { length: 20 }), createSection('loop')]);
    let inverted = false;
    for (let i = 1; i < track.frames.length; i++) {
      const a = track.frames[i - 1];
      const b = track.frames[i];
      if (!a || !b) continue;
      expect(Vector3.Dot(a.tangent, b.tangent)).toBeGreaterThan(0.98);
      expect(Vector3.Dot(a.up, b.up)).toBeGreaterThan(0.98);
      if (b.up.y < -0.9) inverted = true;
    }
    expect(inverted).toBe(true);
  });

  it('falls back to a straight when there are no sections', () => {
    const track = compileTrack([]);
    expect(track.ranges[0]?.type).toBe('straight');
    expect(track.length).toBeGreaterThan(20);
  });

  it('finds the section nearest to a point', () => {
    const track = compileTrack([
      createSection('straight', { length: 40 }),
      createSection('hill', { height: 20, length: 40 }),
    ]);
    expect(sectionAtPoint(track, new Vector3(0, 3.2, 10))).toBe(0);
    expect(sectionAtPoint(track, new Vector3(0, 23, 80))).toBe(1);
  });
});
