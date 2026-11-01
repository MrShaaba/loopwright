import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it } from 'vitest';
import type { PlacedPiece } from '../save/schema';
import { DEG } from '../util/math';
import { FRAME_STEP } from './frames';
import { getPiece } from './pieces';
import { STATION_ENTRY, TrackModel } from './TrackModel';
import type { TrackFrame } from './types';

const curveRight: PlacedPiece = {
  type: 'curve',
  params: { direction: 'right', radius: 14, angle: 90, bank: 'auto' },
};

/** Station 12 m, straight 8, two right curves, brake 12 plus straight 8, two right curves: back to the station. */
const ovalPieces: PlacedPiece[] = [
  { type: 'straight', params: { length: 8 } },
  curveRight,
  curveRight,
  { type: 'brake-run', params: {} },
  { type: 'straight', params: { length: 8 } },
  curveRight,
  curveRight,
];

function expectOrthonormal(frames: readonly TrackFrame[]): void {
  for (const frame of frames) {
    expect(frame.tangent.length()).toBeCloseTo(1, 6);
    expect(frame.up.length()).toBeCloseTo(1, 6);
    expect(frame.right.length()).toBeCloseTo(1, 6);
    expect(Math.abs(Vector3.Dot(frame.tangent, frame.up))).toBeLessThan(1e-6);
    expect(Math.abs(Vector3.Dot(frame.tangent, frame.right))).toBeLessThan(1e-6);
    expect(Math.abs(Vector3.Dot(frame.up, frame.right))).toBeLessThan(1e-6);
  }
}

function expectContinuous(frames: readonly TrackFrame[], closed: boolean): void {
  const n = frames.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = frames[i];
    const b = frames[(i + 1) % n];
    if (!a || !b) continue;
    expect(Vector3.Distance(a.position, b.position)).toBeLessThan(FRAME_STEP * 1.5);
    expect(Vector3.Dot(a.up, b.up)).toBeGreaterThan(0.95);
    expect(Vector3.Dot(a.tangent, b.tangent)).toBeGreaterThan(0.95);
  }
}

describe('TrackModel', () => {
  it('starts with only the station and an open circuit', () => {
    const model = new TrackModel();
    expect(model.pieces).toHaveLength(1);
    expect(model.closure.closed).toBe(false);
    expect(model.exitPose.position.z).toBeCloseTo(6, 9);
    expect(model.frames.length).toBeGreaterThan(12 / FRAME_STEP - 2);
    expect(model.frames.every((f) => f.flags.station)).toBe(true);
  });

  it('closes an oval back at the station and wraps the frames', () => {
    const model = new TrackModel();
    for (const piece of ovalPieces) model.push(piece);
    expect(model.closure.closed).toBe(true);
    expect(model.closure.distance).toBeLessThan(1e-6);
    expect(model.length).toBeCloseTo(12 + 8 + 4 * (Math.PI / 2) * 14 + 12 + 8, 6);
    expectOrthonormal(model.frames);
    expectContinuous(model.frames, true);
    const brake = model.frames.filter((f) => f.flags.brake);
    expect(brake.length).toBeGreaterThan(12 / FRAME_STEP - 4);
    expect(model.candidate(getPiece('straight'), { length: 8 }).reason).toMatch(/closed/i);
  });

  it('reports the gap of an open track', () => {
    const model = new TrackModel();
    model.push({ type: 'straight', params: { length: 16 } });
    model.push(curveRight);
    expect(model.closure.closed).toBe(false);
    expect(model.closure.distance).toBeGreaterThan(10);
    expect(model.closure.headingDeg).toBeCloseTo(90, 6);
    expect(model.pop()?.type).toBe('curve');
    expect(model.pop()?.type).toBe('straight');
    expect(model.pop()).toBeNull();
    expect(model.pieces).toHaveLength(1);
  });

  it('banks a right curve to the right and keeps straights upright', () => {
    const model = new TrackModel();
    model.push(curveRight);
    const curveFrames = model.frames.filter((f) => f.pieceIndex === 1);
    const mid = curveFrames[Math.floor(curveFrames.length / 2)];
    expect(mid).toBeDefined();
    if (!mid) return;
    // Right bank: the up vector leans towards the inside of the turn (+X for a right turn from +Z).
    expect(mid.up.x).toBeGreaterThan(0.3);
    expect(mid.up.y).toBeGreaterThan(0.5);
    const station = model.frames.filter((f) => f.pieceIndex === 0);
    for (const f of station) expect(f.up.y).toBeGreaterThan(0.999);
  });

  it('inverts riders at the top of a loop and returns upright afterwards', () => {
    const model = new TrackModel();
    model.push({ type: 'loop', params: { size: 'small' } });
    model.push({ type: 'straight', params: { length: 8 } });
    const loopFrames = model.frames.filter((f) => f.pieceIndex === 1);
    const top = loopFrames.reduce((best, f) => (f.position.y > best.position.y ? f : best));
    expect(top.up.y).toBeLessThan(-0.9);
    const after = model.frames.filter((f) => f.pieceIndex === 2);
    for (const f of after) expect(f.up.y).toBeGreaterThan(0.99);
    expectOrthonormal(model.frames);
    expectContinuous(model.frames, false);
  });

  it('rolls a corkscrew through inversion without a seam at either end', () => {
    const model = new TrackModel();
    model.push({ type: 'straight', params: { length: 4 } });
    model.push({ type: 'corkscrew', params: { direction: 'right' } });
    model.push({ type: 'straight', params: { length: 4 } });
    const twist = model.frames.filter((f) => f.pieceIndex === 2);
    expect(Math.min(...twist.map((f) => f.up.y))).toBeLessThan(-0.8);
    for (const f of model.frames.filter((frame) => frame.pieceIndex === 3))
      expect(f.up.y).toBeGreaterThan(0.99);
    expectContinuous(model.frames, false);
  });

  it('samples frames at the configured step with monotonic arc length', () => {
    const model = new TrackModel();
    model.push({ type: 'lift-hill', params: { height: 16 } });
    model.push({ type: 'drop', params: { depth: 20 } });
    for (let i = 1; i < model.frames.length; i++) {
      const a = model.frames[i - 1];
      const b = model.frames[i];
      if (!a || !b) continue;
      expect(b.s - a.s).toBeCloseTo(FRAME_STEP, 2);
    }
    const chain = model.frames.filter((f) => f.flags.chain);
    expect(chain.length).toBeGreaterThan(20);
    expect(Math.max(...chain.map((f) => f.position.y))).toBeCloseTo(
      STATION_ENTRY.position.y + 16,
      0,
    );
  });

  it('builds ghost frames for a candidate that continue from the track end', () => {
    const model = new TrackModel();
    const def = getPiece('curve');
    const candidate = model.candidate(def, {
      direction: 'left',
      radius: 8,
      angle: 45,
      bank: 'auto',
    });
    expect(candidate.reason).toBeNull();
    const ghost = model.ghostFrames(def, candidate.geometry);
    expect(ghost.length).toBeGreaterThan(4);
    expect(ghost[0]?.pieceIndex).toBe(1);
    expect(
      Vector3.Distance(ghost[0]?.position ?? Vector3.Zero(), model.exitPose.position),
    ).toBeLessThan(0.3);
    expect(ghost.every((f) => f.up.y > 0.5)).toBe(true);
    expect(getPiece('loop').check?.(model.exitPose, {})).toBeNull();
    expect(getPiece('level-out').check?.(model.exitPose, {})).toMatch(/level/i);
    expect(model.closure.pitchDeg).toBeLessThan(1 * DEG);
  });
});
