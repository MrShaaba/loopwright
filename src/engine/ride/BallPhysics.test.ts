import { describe, expect, it } from 'vitest';
import { compileTrack, createSection } from '../track/Track';
import {
  createPhysicsTrack,
  createRideState,
  feltVerticalG,
  PHYSICS_DEFAULTS,
  resetRide,
  sampleTrack,
  stepRide,
} from './BallPhysics';

function physics(sections: Parameters<typeof compileTrack>[0]) {
  return createPhysicsTrack(compileTrack(sections).frames);
}

describe('stepRide', () => {
  it('gains speed down a dive and loses it up a climb', () => {
    const track = physics([
      createSection('hill', { height: 20, length: 40, dive: true }),
      createSection('straight', { length: 20 }),
      createSection('hill', { height: 20, length: 40 }),
    ]);
    const state = createRideState();
    for (let i = 0; i < 64; i++) stepRide(state, track, 0.05);
    const afterDrop = state.v;
    expect(afterDrop).toBeGreaterThan(PHYSICS_DEFAULTS.startSpeed + 6);
    let guard = 0;
    while (sampleTrack(track, state.s).tangent.y < 0.2 && guard++ < 2000) {
      stepRide(state, track, 0.05);
    }
    const onClimb = state.v;
    for (let i = 0; i < 20; i++) stepRide(state, track, 0.05);
    expect(state.v).toBeLessThan(onClimb);
  });

  it('never drops below the minimum speed on a long climb', () => {
    const track = physics([createSection('hill', { height: 40, length: 60 })]);
    const state = createRideState();
    let minimum = Infinity;
    for (let i = 0; i < 400; i++) {
      stepRide(state, track, 0.05);
      minimum = Math.min(minimum, state.v);
    }
    expect(minimum).toBeGreaterThanOrEqual(PHYSICS_DEFAULTS.minSpeed - 1e-9);
    expect(minimum).toBeLessThan(PHYSICS_DEFAULTS.minSpeed + 0.5);
  });

  it('never exceeds the maximum speed on a long dive', () => {
    const track = physics([
      createSection('hill', { height: 40, length: 50 }),
      createSection('hill', { height: 40, length: 50, dive: true }),
      createSection('hill', { height: 40, length: 50, dive: true }),
    ]);
    const state = createRideState();
    let maximum = 0;
    for (let i = 0; i < 600; i++) {
      stepRide(state, track, 0.05);
      maximum = Math.max(maximum, state.v);
    }
    expect(maximum).toBeLessThanOrEqual(PHYSICS_DEFAULTS.maxSpeed + 1e-9);
    expect(maximum).toBeGreaterThan(30);
  });

  it('advances faster with the multiplier without changing the base speed', () => {
    const track = physics([createSection('straight', { length: 60 })]);
    const slow = createRideState();
    const fast = createRideState();
    for (let i = 0; i < 40; i++) {
      stepRide(slow, track, 0.05, 1);
      stepRide(fast, track, 0.05, 3);
    }
    expect(fast.s).toBeCloseTo(slow.s * 3, 1);
    expect(fast.v).toBeCloseTo(slow.v, 6);
    expect(fast.travelled).toBeCloseTo(slow.travelled * 3, 6);
  });

  it('counts laps as it wraps around the loop', () => {
    const track = physics([createSection('straight', { length: 20 })]);
    const state = createRideState();
    for (let i = 0; i < 100 && state.laps < 2; i++) stepRide(state, track, 0.5, 3);
    expect(state.laps).toBe(2);
    expect(state.s).toBeGreaterThanOrEqual(0);
    expect(state.s).toBeLessThan(track.length);
  });

  it('resets to the start line', () => {
    const track = physics([createSection('straight', { length: 20 })]);
    const state = createRideState();
    stepRide(state, track, 0.2);
    resetRide(state);
    expect(state).toEqual({
      s: 0,
      v: PHYSICS_DEFAULTS.startSpeed,
      time: 0,
      laps: 0,
      travelled: 0,
    });
  });
});

describe('feltVerticalG', () => {
  it('reads 1 g at any speed on a level straight', () => {
    const track = physics([createSection('straight', { length: 60 })]);
    expect(feltVerticalG(track, 20, 0)).toBeCloseTo(1, 3);
    expect(feltVerticalG(track, 20, 30)).toBeCloseTo(1, 2);
  });

  it('squeezes in a dip and lifts over a crest, more at higher speed', () => {
    const track = physics([
      createSection('straight', { length: 20 }),
      createSection('wave', { length: 80, waves: 2, amplitude: 6 }),
      createSection('straight', { length: 20 }),
    ]);
    // Crests sit a quarter wave in; troughs at the half wave.
    const crest = 20 + 20;
    const trough = 20 + 40;
    expect(feltVerticalG(track, crest, 20)).toBeLessThan(0.6);
    expect(feltVerticalG(track, trough, 20)).toBeGreaterThan(1.4);
    expect(feltVerticalG(track, crest, 30)).toBeLessThan(feltVerticalG(track, crest, 20));
    expect(feltVerticalG(track, trough, 30)).toBeGreaterThan(feltVerticalG(track, trough, 20));
  });

  it('stays positive through the top of a loop when the ball is fast enough', () => {
    const track = physics([
      createSection('straight', { length: 20 }),
      createSection('loop', { radius: 9 }),
    ]);
    // The loop's top is roughly half-way around it.
    const top = 20 + Math.PI * 9 * 1.05;
    expect(feltVerticalG(track, top, 16)).toBeGreaterThan(0.5);
    expect(feltVerticalG(track, top, 6)).toBeLessThan(0);
    expect(feltVerticalG(track, 20 + 1, 25)).toBeGreaterThan(3);
  });
});
