import { describe, expect, it } from 'vitest';
import { GHOST_INTERVAL, GhostRecorder, parseGhost, sampleGhost } from './ghost';

function recordLap(): ReturnType<GhostRecorder['finish']> {
  const recorder = new GhostRecorder(3);
  // 60 Hz frames for 6 seconds at a steady 10 m/s, moving through three sections of 20 m.
  for (let frame = 0; frame <= 360; frame++) {
    const t = frame / 60;
    const s = t * 10;
    recorder.record(t, s, Math.sin(t), Math.min(2, Math.floor(s / 20)));
  }
  return recorder.finish(6, 60);
}

describe('GhostRecorder', () => {
  it('keeps samples ten times a second, not every frame', () => {
    const recording = recordLap();
    expect(recording.times.length).toBeLessThan(80);
    expect(recording.times.length).toBeGreaterThan(55);
    for (let i = 1; i < recording.times.length - 1; i++) {
      const gap = (recording.times[i] ?? 0) - (recording.times[i - 1] ?? 0);
      expect(gap).toBeGreaterThanOrEqual(GHOST_INTERVAL - 1e-6);
    }
    expect(recording.lapTime).toBe(6);
    expect(recording.positions[recording.positions.length - 1]).toBe(60);
  });

  it('records the time each section was first entered', () => {
    const recording = recordLap();
    expect(recording.splits[0]).toBe(0);
    expect(recording.splits[1]).toBeCloseTo(2, 1);
    expect(recording.splits[2]).toBeCloseTo(4, 1);
  });

  it('marks sections that were never entered', () => {
    const recorder = new GhostRecorder(4);
    recorder.record(0, 0, 0, 0);
    recorder.record(1, 10, 0, 1);
    const recording = recorder.finish(1.5, 15);
    expect(recording.splits).toEqual([0, 1, -1, -1]);
    expect(recording.times[recording.times.length - 1]).toBe(1.5);
  });
});

describe('sampleGhost', () => {
  it('interpolates position and angle between samples and clamps at the ends', () => {
    const recording = recordLap();
    expect(sampleGhost(recording, -1).s).toBe(0);
    expect(sampleGhost(recording, 3).s).toBeCloseTo(30, 0);
    expect(sampleGhost(recording, 3.05).s).toBeCloseTo(30.5, 0);
    expect(sampleGhost(recording, 3).theta).toBeCloseTo(Math.sin(3), 1);
    expect(sampleGhost(recording, 99).s).toBe(60);
  });

  it('takes the short way round when the angle wraps', () => {
    const recording = {
      lapTime: 1,
      times: [0, 1],
      positions: [0, 10],
      thetas: [3.0, -3.0],
      splits: [0],
    };
    const mid = sampleGhost(recording, 0.5);
    expect(Math.abs(mid.theta)).toBeGreaterThan(3.1);
  });
});

describe('parseGhost', () => {
  it('accepts a recording and rejects junk', () => {
    const recording = recordLap();
    expect(parseGhost(JSON.parse(JSON.stringify(recording)))).toEqual(recording);
    expect(parseGhost(null)).toBeNull();
    expect(parseGhost({ lapTime: 3 })).toBeNull();
    expect(parseGhost({ ...recording, positions: recording.positions.slice(1) })).toBeNull();
    expect(parseGhost({ ...recording, thetas: ['a'] })).toBeNull();
  });
});
