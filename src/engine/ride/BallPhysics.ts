import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { FRAME_STEP } from '../track/frames';
import type { SegmentFlags, TrackFrame } from '../track/types';

const SUBSTEP = 1 / 240;

export interface PhysicsParams {
  gravity: number;
  /** Rolling resistance as a fraction of weight. */
  rollingResistance: number;
  /** Quadratic drag per metre, applied as drag * v * |v|. */
  drag: number;
  /** The ride never drops below this base speed, m/s. */
  minSpeed: number;
  /** Nor above this one. */
  maxSpeed: number;
  /** Base speed at the start line, m/s. */
  startSpeed: number;
}

export const PHYSICS_DEFAULTS: PhysicsParams = {
  gravity: 9.81,
  rollingResistance: 0.004,
  drag: 0.00045,
  minSpeed: 8,
  maxSpeed: 42,
  startSpeed: 14,
};

export const MULTIPLIER_MIN = 0.25;
export const MULTIPLIER_MAX = 3;
export const MULTIPLIER_STEP = 0.25;
export const BOOST_FACTOR = 1.6;

/** The closed track as the physics sees it. */
export interface PhysicsTrack {
  frames: readonly TrackFrame[];
  length: number;
  step: number;
}

export function createPhysicsTrack(frames: readonly TrackFrame[], step = FRAME_STEP): PhysicsTrack {
  return { frames, length: frames.length * step, step };
}

export interface TrackSample {
  s: number;
  position: Vector3;
  tangent: Vector3;
  up: Vector3;
  right: Vector3;
  flags: SegmentFlags;
  sectionIndex: number;
}

export function createSample(): TrackSample {
  return {
    s: 0,
    position: new Vector3(),
    tangent: new Vector3(0, 0, 1),
    up: new Vector3(0, 1, 0),
    right: new Vector3(1, 0, 0),
    flags: {},
    sectionIndex: 0,
  };
}

export function wrapS(track: PhysicsTrack, s: number): number {
  const L = track.length;
  return L > 0 ? ((s % L) + L) % L : 0;
}

/** Interpolated frame at arc length `s`, written into `out`. */
export function sampleTrackToRef(track: PhysicsTrack, s: number, out: TrackSample): TrackSample {
  const n = track.frames.length;
  if (n === 0) return out;
  const wrapped = wrapS(track, s);
  const raw = wrapped / track.step;
  const i = Math.min(Math.floor(raw), n - 1);
  const f = Math.min(1, Math.max(0, raw - i));
  const a = track.frames[i] ?? track.frames[0];
  const b = track.frames[(i + 1) % n] ?? a;
  if (!a || !b) return out;
  out.s = wrapped;
  Vector3.LerpToRef(a.position, b.position, f, out.position);
  Vector3.LerpToRef(a.tangent, b.tangent, f, out.tangent);
  out.tangent.normalize();
  Vector3.LerpToRef(a.up, b.up, f, out.up);
  out.up.normalize();
  Vector3.CrossToRef(out.up, out.tangent, out.right);
  out.right.normalize();
  Vector3.CrossToRef(out.tangent, out.right, out.up);
  out.up.normalize();
  const source = f < 0.5 ? a : b;
  out.flags = source.flags;
  out.sectionIndex = source.sectionIndex;
  return out;
}

export function sampleTrack(track: PhysicsTrack, s: number): TrackSample {
  return sampleTrackToRef(track, s, createSample());
}

export interface RideState {
  /** Arc length of the ball along the loop. */
  s: number;
  /** Base speed from physics, m/s, before the multiplier. */
  v: number;
  /** Seconds of ride time; pauses do not count. */
  time: number;
  laps: number;
  /** Distance the ball has actually travelled, multiplier included, for rolling and streaks. */
  travelled: number;
}

export function createRideState(params: PhysicsParams = PHYSICS_DEFAULTS): RideState {
  return { s: 0, v: params.startSpeed, time: 0, laps: 0, travelled: 0 };
}

export function resetRide(state: RideState, params: PhysicsParams = PHYSICS_DEFAULTS): void {
  state.s = 0;
  state.v = params.startSpeed;
  state.time = 0;
  state.laps = 0;
  state.travelled = 0;
}

const SAMPLE = createSample();

function smoothSign(v: number): number {
  return Math.tanh(v / 0.25);
}

/**
 * Advances the ball by `dt` seconds at 240 Hz substeps. The base speed follows gravity along
 * the tangent minus rolling resistance and drag, clamped so the ride never stalls or runs away.
 * `multiplier` scales how fast the ball advances along the track without touching that physics.
 */
export function stepRide(
  state: RideState,
  track: PhysicsTrack,
  dt: number,
  multiplier = 1,
  params: PhysicsParams = PHYSICS_DEFAULTS,
): void {
  if (track.frames.length < 2 || track.length <= 0) return;
  let remaining = Math.min(dt, 0.25);
  while (remaining > 1e-9) {
    const h = Math.min(SUBSTEP, remaining);
    remaining -= h;
    const sample = sampleTrackToRef(track, state.s, SAMPLE);
    const g = params.gravity;
    const a =
      -g * sample.tangent.y -
      params.rollingResistance * g * smoothSign(state.v) -
      params.drag * state.v * Math.abs(state.v);
    state.v = Math.min(params.maxSpeed, Math.max(params.minSpeed, state.v + a * h));
    const advance = state.v * multiplier * h;
    const next = state.s + advance;
    if (next >= track.length) state.laps++;
    state.s = wrapS(track, next);
    state.travelled += advance;
    state.time += h;
  }
}
