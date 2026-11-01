import { describe, expect, it } from 'vitest';
import type { PlacedPiece } from '../save/schema';
import { TrackModel } from '../track/TrackModel';
import {
  CAR_SPACING,
  PHYSICS_DEFAULTS,
  createPhysicsTrack,
  createRideState,
  dispatchRide,
  resetRide,
  sampleTrack,
  stepRide,
  type PhysicsTrack,
  type RideState,
} from './TrainPhysics';

const curveRight: PlacedPiece = {
  type: 'curve',
  params: { direction: 'right', radius: 14, angle: 90, bank: 'auto' },
};

/**
 * A closed circuit with a 12 m lift and matching drop. The outbound leg is 60.15 m long,
 * so the return leg is a brake run plus a 48.15 m straight.
 */
export const hillCircuit: PlacedPiece[] = [
  { type: 'lift-hill', params: { height: 12 } },
  { type: 'drop', params: { depth: 12 } },
  curveRight,
  curveRight,
  { type: 'straight', params: { length: 48.15 } },
  { type: 'brake-run', params: {} },
  curveRight,
  curveRight,
];

function trackFrom(pieces: PlacedPiece[]): { model: TrackModel; track: PhysicsTrack } {
  const model = new TrackModel();
  for (const piece of pieces) model.push(piece);
  return { model, track: createPhysicsTrack(model.frames, model.closure.closed) };
}

function run(state: RideState, track: PhysicsTrack, seconds: number, dt = 1 / 60): void {
  for (let t = 0; t < seconds; t += dt) stepRide(state, track, dt);
}

describe('sampleTrack', () => {
  it('interpolates between frames and wraps on a closed circuit', () => {
    const { track } = trackFrom(hillCircuit);
    expect(track.closed).toBe(true);
    const a = sampleTrack(track, 1);
    const b = sampleTrack(track, 1.125);
    expect(b.position.z - a.position.z).toBeCloseTo(0.125, 3);
    const wrapped = sampleTrack(track, track.length + 1);
    expect(wrapped.position.x).toBeCloseTo(a.position.x, 6);
    expect(wrapped.position.z).toBeCloseTo(a.position.z, 6);
    expect(wrapped.flags.station).toBe(true);
    expect(sampleTrack(track, 30).flags.station).toBeFalsy();
  });

  it('places the station stop near the end of the station', () => {
    const { track } = trackFrom([]);
    expect(track.stationStop).toBeCloseTo(12 - 1.8, 0);
  });
});

describe('stepRide', () => {
  it('stays put until dispatched, then rolls out at launch speed', () => {
    const { track } = trackFrom([{ type: 'straight', params: { length: 16 } }]);
    const state = createRideState(track);
    run(state, track, 1);
    expect(state.s).toBe(track.stationStop);
    expect(state.v).toBe(0);
    expect(state.gVertical).toBeCloseTo(1, 2);
    dispatchRide(state, track);
    run(state, track, 0.5);
    expect(state.v).toBeGreaterThanOrEqual(PHYSICS_DEFAULTS.launchSpeed - 1e-6);
    run(state, track, 1);
    expect(state.phase).toBe('running');
    expect(state.leftStation).toBe(true);
  });

  it('loses speed to friction on the flat and stops at the end of an open track', () => {
    const { track } = trackFrom([
      { type: 'straight', params: { length: 16 } },
      { type: 'straight', params: { length: 16 } },
    ]);
    const state = createRideState(track);
    dispatchRide(state, track);
    run(state, track, 1.5);
    const v1 = state.v;
    run(state, track, 1.5);
    expect(state.v).toBeLessThan(v1);
    run(state, track, 30);
    expect(state.phase).toBe('stalled');
    expect(state.s).toBeCloseTo(track.length, 6);
  });

  it('converts height into speed on a drop within friction losses', () => {
    const { track } = trackFrom([
      { type: 'lift-hill', params: { height: 24 } },
      { type: 'drop', params: { depth: 20 } },
      { type: 'straight', params: { length: 4 } },
    ]);
    const state = createRideState(track);
    dispatchRide(state, track);
    let maxV = 0;
    for (let t = 0; t < 60; t += 1 / 60) {
      stepRide(state, track, 1 / 60);
      maxV = Math.max(maxV, state.v);
      if (state.phase === 'stalled') break;
    }
    const ideal = Math.sqrt(2 * 9.81 * 20);
    expect(maxV).toBeGreaterThan(ideal * 0.85);
    expect(maxV).toBeLessThan(ideal);
  });

  it('holds chain speed up the lift and never slows below it', () => {
    const { track } = trackFrom([
      { type: 'lift-hill', params: { height: 16 } },
      { type: 'straight', params: { length: 8 } },
    ]);
    const state = createRideState(track);
    dispatchRide(state, track);
    let sawChain = false;
    let minChainSpeed = Infinity;
    for (let t = 0; t < 40; t += 1 / 60) {
      stepRide(state, track, 1 / 60);
      if (state.onChain) {
        sawChain = true;
        minChainSpeed = Math.min(minChainSpeed, state.v);
      }
      if (!state.onChain && sawChain) break;
    }
    expect(sawChain).toBe(true);
    expect(minChainSpeed).toBeGreaterThanOrEqual(PHYSICS_DEFAULTS.chainSpeed - 1e-6);
    expect(state.s).toBeGreaterThan(20);
  });

  it('slows to brake speed on a brake run', () => {
    const { track } = trackFrom([
      { type: 'lift-hill', params: { height: 16 } },
      { type: 'drop', params: { depth: 12 } },
      { type: 'brake-run', params: {} },
      { type: 'straight', params: { length: 16 } },
    ]);
    const state = createRideState(track);
    dispatchRide(state, track);
    let speedOnBrake = Infinity;
    let fastest = 0;
    for (let t = 0; t < 60; t += 1 / 60) {
      stepRide(state, track, 1 / 60);
      fastest = Math.max(fastest, state.v);
      if (state.onBrake) speedOnBrake = Math.min(speedOnBrake, state.v);
      if (state.phase === 'stalled') break;
    }
    expect(fastest).toBeGreaterThan(10);
    expect(speedOnBrake).toBeGreaterThan(PHYSICS_DEFAULTS.brakeSpeed - 0.5);
    expect(speedOnBrake).toBeLessThanOrEqual(PHYSICS_DEFAULTS.brakeSpeed + 1e-6);
  });

  it('completes a lap of a closed circuit and parks back in the station', () => {
    const { track } = trackFrom(hillCircuit);
    expect(track.closed).toBe(true);
    const state = createRideState(track);
    dispatchRide(state, track);
    run(state, track, 120);
    expect(state.phase).toBe('complete');
    expect(state.lap).toBe(1);
    expect(state.s).toBeCloseTo(track.stationStop, 6);
    expect(state.v).toBe(0);
    expect(state.time).toBeGreaterThan(20);
    dispatchRide(state, track);
    expect(state.phase).toBe('launching');
    resetRide(state, track);
    expect(state.phase).toBe('idle');
  });

  it('stalls and reports it when a hill is too tall for the lift', () => {
    const { track } = trackFrom([
      { type: 'lift-hill', params: { height: 8 } },
      { type: 'drop', params: { depth: 12 } },
      { type: 'lift-hill', params: { height: 24 } },
    ]);
    const state = createRideState(track);
    dispatchRide(state, track);
    run(state, track, 60);
    // The chain hauls the train all the way to the end of the open track.
    expect(state.s).toBeCloseTo(track.length, 1);
    const tall = trackFrom([
      { type: 'slope-up', params: {} },
      { type: 'straight', params: { length: 16 } },
      { type: 'straight', params: { length: 16 } },
    ]);
    const climber = createRideState(tall.track);
    dispatchRide(climber, tall.track);
    run(climber, tall.track, 30);
    expect(climber.phase).toBe('stalled');
    expect(climber.s).toBeLessThan(tall.track.length - 5);
  });

  it('reads more than one g in a valley pull-out and less over a crest', () => {
    const { track } = trackFrom([
      { type: 'lift-hill', params: { height: 24 } },
      { type: 'drop', params: { depth: 20 } },
      { type: 'slope-up', params: {} },
      { type: 'level-out', params: {} },
      { type: 'straight', params: { length: 16 } },
    ]);
    const state = createRideState(track);
    dispatchRide(state, track);
    let maxG = 0;
    let minG = Infinity;
    for (let t = 0; t < 60; t += 1 / 60) {
      stepRide(state, track, 1 / 60);
      if (state.phase === 'running' && state.v > 3) {
        maxG = Math.max(maxG, state.gVertical);
        minG = Math.min(minG, state.gVertical);
      }
      if (state.phase === 'stalled') break;
    }
    expect(maxG).toBeGreaterThan(2);
    expect(minG).toBeLessThan(0.9);
    expect(Math.abs(state.gLateral)).toBeLessThan(0.5);
  });

  it('keeps the cars spaced along the track', () => {
    expect(CAR_SPACING).toBeGreaterThan(2);
  });
});
