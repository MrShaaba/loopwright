import { describe, expect, it } from 'vitest';
import type { PlacedPiece } from '../save/schema';
import { TrackModel } from '../track/TrackModel';
import { validateTrack } from './validate';

const curveRight: PlacedPiece = {
  type: 'curve',
  params: { direction: 'right', radius: 14, angle: 90, bank: 'auto' },
};
const curveLeft: PlacedPiece = {
  type: 'curve',
  params: { direction: 'left', radius: 14, angle: 90, bank: 'auto' },
};
const hillCircuit: PlacedPiece[] = [
  { type: 'lift-hill', params: { height: 12 } },
  { type: 'drop', params: { depth: 12 } },
  curveRight,
  curveRight,
  { type: 'straight', params: { length: 48.15 } },
  { type: 'brake-run', params: {} },
  curveRight,
  curveRight,
];

function validate(pieces: PlacedPiece[]): ReturnType<typeof validateTrack> {
  const model = new TrackModel();
  for (const piece of pieces) model.push(piece);
  return validateTrack(model.frames, model.closure);
}

describe('validateTrack', () => {
  it('flags an open circuit with the gap to the station', () => {
    const result = validate([{ type: 'straight', params: { length: 16 } }, curveRight]);
    expect(result.ok).toBe(false);
    const open = result.markers.find((m) => m.kind === 'open');
    expect(open?.severity).toBe('error');
    expect(open?.reason).toMatch(/open/i);
    expect(open?.reason).toMatch(/90°/);
  });

  it('passes a closed circuit with a lift and reports ride stats', () => {
    const result = validate(hillCircuit);
    expect(result.ok).toBe(true);
    expect(result.markers.filter((m) => m.severity === 'error')).toHaveLength(0);
    expect(result.stats.rideTime).toBeGreaterThan(15);
    expect(result.stats.maxSpeed).toBeGreaterThan(10);
  });

  it('marks a stall when a loop is taller than the lift and names the heights', () => {
    const result = validate([
      { type: 'lift-hill', params: { height: 16 } },
      { type: 'drop', params: { depth: 12 } },
      { type: 'loop', params: { size: 'small' } },
      { type: 'straight', params: { length: 8 } },
    ]);
    const stall = result.markers.find((m) => m.kind === 'stall');
    expect(stall).toBeDefined();
    expect(stall?.severity).toBe('error');
    expect(stall?.reason).toMatch(/crest/i);
    expect(stall?.reason).toMatch(/lift/i);
    expect(stall?.pieceIndex).toBe(3);
    expect(stall?.position.y).toBeGreaterThan(5);
  });

  it('clears the same loop once the lift is tall enough', () => {
    const result = validate([
      { type: 'lift-hill', params: { height: 24 } },
      { type: 'drop', params: { depth: 20 } },
      { type: 'loop', params: { size: 'small' } },
      { type: 'straight', params: { length: 8 } },
    ]);
    expect(result.markers.find((m) => m.kind === 'stall')).toBeUndefined();
    expect(result.stats.minVerticalG).toBeLessThan(1);
  });

  it('explains a stall on a climb with no lift before it', () => {
    const result = validate([
      { type: 'slope-up', params: {} },
      { type: 'straight', params: { length: 16 } },
      { type: 'level-out', params: {} },
    ]);
    const stall = result.markers.find((m) => m.kind === 'stall');
    expect(stall?.reason).toMatch(/no lift hill/i);
  });

  it('warns about lateral force on a tight flat curve taken fast', () => {
    const result = validate([
      { type: 'lift-hill', params: { height: 24 } },
      { type: 'drop', params: { depth: 20 } },
      { type: 'curve', params: { direction: 'right', radius: 8, angle: 90, bank: 'flat' } },
      { type: 'straight', params: { length: 16 } },
    ]);
    const lateral = result.markers.find((m) => m.kind === 'lateral');
    expect(lateral?.severity).toBe('warning');
    expect(lateral?.pieceIndex).toBe(3);
    expect(lateral?.reason).toMatch(/sideways/i);
    expect(result.markers.indexOf(lateral ?? result.markers[0]!)).toBeGreaterThan(0);
  });

  it('sorts errors before warnings', () => {
    const result = validate([
      { type: 'lift-hill', params: { height: 24 } },
      { type: 'drop', params: { depth: 20 } },
      { type: 'curve', params: { direction: 'right', radius: 8, angle: 90, bank: 'flat' } },
      curveLeft,
    ]);
    expect(result.markers[0]?.severity).toBe('error');
    expect(result.ok).toBe(false);
  });
});

describe('validateTrack on a flat circuit', () => {
  it('reports that the train runs out of speed when there is no hill', () => {
    const result = validate([
      { type: 'straight', params: { length: 8 } },
      curveRight,
      curveRight,
      { type: 'brake-run', params: {} },
      { type: 'straight', params: { length: 8 } },
      curveRight,
      curveRight,
    ]);
    expect(result.ok).toBe(false);
    const stall = result.markers.find((m) => m.kind === 'stall');
    expect(stall?.reason).toMatch(/runs out of speed/i);
  });
});
