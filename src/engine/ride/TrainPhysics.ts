import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { FRAME_STEP } from '../track/frames';
import type { SegmentFlags, TrackFrame } from '../track/types';

export const CAR_COUNT = 4;
/** Metres between car centres. */
export const CAR_SPACING = 2.3;
export const TRAIN_LENGTH = CAR_SPACING * (CAR_COUNT - 1);
/** How far before the end of the station the front car comes to rest. */
const STATION_STOP_MARGIN = 1.8;
const SUBSTEP = 1 / 240;

export interface PhysicsParams {
  gravity: number;
  /** Rolling resistance as a fraction of weight. */
  rollingResistance: number;
  /** Quadratic drag per metre, applied as drag * v * |v|. */
  drag: number;
  /** Speed the chain lift holds, m/s. */
  chainSpeed: number;
  brakeDecel: number;
  /** Speed a brake run slows the train to, m/s. */
  brakeSpeed: number;
  stationDecel: number;
  /** Speed the station tyres keep an arriving train moving at until it reaches the stop, m/s. */
  stationCrawl: number;
  /** Speed the station drive wheels push the train out at, m/s. */
  launchSpeed: number;
  /** Below this speed (m/s), outside chains and stations, the train counts as stalling. */
  stallSpeed: number;
  stallSeconds: number;
}

export const PHYSICS_DEFAULTS: PhysicsParams = {
  gravity: 9.81,
  rollingResistance: 0.008,
  drag: 0.0008,
  chainSpeed: 2.6,
  brakeDecel: 12,
  brakeSpeed: 4,
  stationDecel: 3.5,
  stationCrawl: 1.5,
  launchSpeed: 3,
  stallSpeed: 0.15,
  stallSeconds: 1.5,
};

/** The track as the physics sees it. */
export interface PhysicsTrack {
  frames: readonly TrackFrame[];
  closed: boolean;
  /** Ridable length in metres. */
  length: number;
  step: number;
  /** Arc length where the front car rests in the station. */
  stationStop: number;
}

export function createPhysicsTrack(
  frames: readonly TrackFrame[],
  closed: boolean,
  step = FRAME_STEP,
): PhysicsTrack {
  const n = frames.length;
  const length = closed ? n * step : Math.max(0, n - 1) * step;
  let stationEnd = 0;
  for (let i = 0; i < n; i++) {
    if (!frames[i]?.flags.station) break;
    stationEnd = i * step;
  }
  return {
    frames,
    closed,
    length,
    step,
    stationStop: Math.max(0, stationEnd - STATION_STOP_MARGIN),
  };
}

export interface TrackSample {
  s: number;
  position: Vector3;
  tangent: Vector3;
  up: Vector3;
  right: Vector3;
  flags: SegmentFlags;
  pieceIndex: number;
}

export function createSample(): TrackSample {
  return {
    s: 0,
    position: new Vector3(),
    tangent: new Vector3(0, 0, 1),
    up: new Vector3(0, 1, 0),
    right: new Vector3(1, 0, 0),
    flags: {},
    pieceIndex: 0,
  };
}

function wrapS(track: PhysicsTrack, s: number): number {
  if (track.closed) {
    const L = track.length;
    return L > 0 ? ((s % L) + L) % L : 0;
  }
  return Math.min(Math.max(s, 0), track.length);
}

/** Interpolated frame at arc length `s`, written into `out`. */
export function sampleTrackToRef(track: PhysicsTrack, s: number, out: TrackSample): TrackSample {
  const n = track.frames.length;
  if (n === 0) return out;
  const wrapped = wrapS(track, s);
  const raw = wrapped / track.step;
  const i = Math.min(Math.floor(raw), track.closed ? n - 1 : n - 2);
  const f = Math.min(1, Math.max(0, raw - i));
  const a = track.frames[Math.max(0, i)] ?? track.frames[0];
  const b = track.frames[track.closed ? (i + 1) % n : Math.min(i + 1, n - 1)] ?? a;
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
  out.pieceIndex = source.pieceIndex;
  return out;
}

export function sampleTrack(track: PhysicsTrack, s: number): TrackSample {
  return sampleTrackToRef(track, s, createSample());
}

export type RidePhase = 'idle' | 'launching' | 'running' | 'arriving' | 'complete' | 'stalled';

export interface RideState {
  phase: RidePhase;
  /** Arc length of the front car. */
  s: number;
  /** Signed speed along the track, m/s. */
  v: number;
  /** Seconds since dispatch. */
  time: number;
  lap: number;
  leftStation: boolean;
  stallTimer: number;
  onChain: boolean;
  onBrake: boolean;
  /** Smoothed vertical g felt in the front seat; 1 at rest on level track. */
  gVertical: number;
  /** Smoothed lateral g, positive to the right. */
  gLateral: number;
  readonly previousVelocity: Vector3;
}

export function createRideState(track: PhysicsTrack): RideState {
  return {
    phase: 'idle',
    s: track.stationStop,
    v: 0,
    time: 0,
    lap: 0,
    leftStation: false,
    stallTimer: 0,
    onChain: false,
    onBrake: false,
    gVertical: 1,
    gLateral: 0,
    previousVelocity: new Vector3(),
  };
}

/** Puts the train back in the station, ready to dispatch. */
export function resetRide(state: RideState, track: PhysicsTrack): void {
  state.phase = 'idle';
  state.s = track.stationStop;
  state.v = 0;
  state.time = 0;
  state.leftStation = false;
  state.stallTimer = 0;
  state.onChain = false;
  state.onBrake = false;
  state.gVertical = 1;
  state.gLateral = 0;
  state.previousVelocity.set(0, 0, 0);
}

/** Starts the ride. A finished or stalled train is first returned to the station. */
export function dispatchRide(state: RideState, track: PhysicsTrack): void {
  if (state.phase !== 'idle') resetRide(state, track);
  state.phase = 'launching';
}

const FRONT = createSample();
const CARS: TrackSample[] = Array.from({ length: CAR_COUNT }, () => createSample());
const velocity = new Vector3();
const felt = new Vector3();

function smoothSign(v: number): number {
  return Math.tanh(v / 0.25);
}

/** Advances the ride by `dt` seconds using fixed 240 Hz substeps. */
export function stepRide(
  state: RideState,
  track: PhysicsTrack,
  dt: number,
  params: PhysicsParams = PHYSICS_DEFAULTS,
): void {
  if (track.frames.length < 2 || track.length <= 0) return;
  let remaining = Math.min(dt, 0.25);
  while (remaining > 1e-9) {
    const h = Math.min(SUBSTEP, remaining);
    remaining -= h;
    substep(state, track, h, params);
  }
}

function substep(state: RideState, track: PhysicsTrack, h: number, p: PhysicsParams): void {
  const front = sampleTrackToRef(track, state.s, FRONT);
  let meanTangentY = 0;
  let chain = false;
  for (let i = 0; i < CAR_COUNT; i++) {
    const car = sampleTrackToRef(track, state.s - i * CAR_SPACING, CARS[i] ?? FRONT);
    meanTangentY += car.tangent.y;
    chain = chain || car.flags.chain === true;
  }
  meanTangentY /= CAR_COUNT;
  const brake = front.flags.brake === true;
  const station = front.flags.station === true;
  state.onChain = chain;
  state.onBrake = brake;

  const moving =
    state.phase === 'launching' ||
    state.phase === 'running' ||
    state.phase === 'arriving' ||
    state.phase === 'stalled';

  if (moving) {
    if (state.phase === 'launching' && !station) {
      state.phase = 'running';
      state.leftStation = true;
    }
    const g = p.gravity;
    const a =
      -g * meanTangentY -
      p.rollingResistance * g * smoothSign(state.v) -
      p.drag * state.v * Math.abs(state.v);
    state.v += a * h;
    if (chain) state.v = Math.max(state.v, p.chainSpeed);
    if (state.phase === 'launching' && station) state.v = Math.max(state.v, p.launchSpeed);
    if (brake && state.v > p.brakeSpeed)
      state.v = Math.max(p.brakeSpeed, state.v - p.brakeDecel * h);

    if (state.phase === 'running' && station && state.leftStation) state.phase = 'arriving';
    if (state.phase === 'arriving') {
      const toStop = track.stationStop - state.s;
      const cap = Math.sqrt(2 * p.stationDecel * Math.max(0, toStop));
      state.v = Math.min(Math.max(state.v, p.stationCrawl), Math.max(cap, p.stationCrawl));
      if (toStop <= 0.02) {
        state.s = track.stationStop;
        state.v = 0;
        state.phase = 'complete';
        state.lap++;
      }
    }

    if (state.phase !== 'complete') {
      state.s += state.v * h;
      if (track.closed) state.s = wrapS(track, state.s);
      else if (state.s >= track.length) {
        state.s = track.length;
        state.v = 0;
        state.phase = 'stalled';
      } else if (state.s < 0) {
        state.s = 0;
        state.v = 0;
      }
    }

    if (state.phase === 'running') {
      if (state.v < -0.5 && !station) {
        state.phase = 'stalled';
      } else if (!chain && !station && Math.abs(state.v) < p.stallSpeed) {
        state.stallTimer += h;
        if (state.stallTimer >= p.stallSeconds) state.phase = 'stalled';
      } else {
        state.stallTimer = 0;
      }
    }
    state.time += h;
  } else {
    state.v = 0;
  }

  // Felt acceleration in the front seat: change in velocity plus gravity, in the seat's frame.
  front.tangent.scaleToRef(state.v, velocity);
  velocity.subtractToRef(state.previousVelocity, felt);
  felt.scaleInPlace(1 / h);
  felt.y += p.gravity;
  const gV = Vector3.Dot(felt, front.up) / p.gravity;
  const gL = Vector3.Dot(felt, front.right) / p.gravity;
  const k = 1 - Math.exp(-h / 0.12);
  state.gVertical += (gV - state.gVertical) * k;
  state.gLateral += (gL - state.gLateral) * k;
  state.previousVelocity.copyFrom(velocity);
}
