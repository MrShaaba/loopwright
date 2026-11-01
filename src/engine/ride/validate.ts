import { type Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ClosureInfo } from '../track/TrackModel';
import type { TrackFrame } from '../track/types';
import {
  PHYSICS_DEFAULTS,
  createPhysicsTrack,
  createRideState,
  createSample,
  dispatchRide,
  sampleTrackToRef,
  stepRide,
  type PhysicsParams,
  type PhysicsTrack,
  type RideState,
} from './TrainPhysics';

export type MarkerKind = 'open' | 'stall' | 'lateral' | 'airtime' | 'pullout' | 'lost';

export interface ValidationMarker {
  kind: MarkerKind;
  severity: 'error' | 'warning';
  /** Arc length of the problem. */
  s: number;
  position: Vector3;
  pieceIndex: number;
  reason: string;
}

export interface RideStats {
  rideTime: number;
  maxSpeed: number;
  maxVerticalG: number;
  minVerticalG: number;
  maxLateralG: number;
}

export interface ValidationResult {
  ok: boolean;
  markers: ValidationMarker[];
  stats: RideStats;
}

const SIM_DT = 1 / 120;
const MAX_SIM_SECONDS = 400;
export const LATERAL_G_LIMIT = 2.5;
export const PULLOUT_G_LIMIT = 5;
export const AIRTIME_G_LIMIT = -1.5;

interface PieceExtreme {
  value: number;
  s: number;
  position: Vector3;
}

function better(
  current: PieceExtreme | undefined,
  value: number,
  s: number,
  position: Vector3,
  max: boolean,
): PieceExtreme {
  if (!current || (max ? value > current.value : value < current.value)) {
    return { value, s, position: position.clone() };
  }
  return current;
}

function frameIndexAt(track: PhysicsTrack, s: number): number {
  const n = track.frames.length;
  const i = Math.floor(s / track.step);
  return track.closed ? ((i % n) + n) % n : Math.min(Math.max(i, 0), n - 1);
}

/** Height of the crest ahead of `s`: the highest point before the track descends again. Null on a flat run. */
function crestAhead(track: PhysicsTrack, s: number): number | null {
  const n = track.frames.length;
  const start = frameIndexAt(track, s);
  const here = track.frames[start]?.position.y ?? 0;
  const limit = Math.min(n, Math.round(250 / track.step));
  let top = here;
  for (let k = 0; k < limit; k++) {
    const index = track.closed ? (start + k) % n : start + k;
    if (index >= n) break;
    const frame = track.frames[index];
    if (!frame) break;
    if (frame.tangent.y < -0.03) break;
    top = Math.max(top, frame.position.y);
  }
  return top - here > 0.3 ? top : null;
}

/** Top height of the most recent chain lift before `s`, or null if there is none. */
function lastLiftTop(track: PhysicsTrack, s: number): number | null {
  const n = track.frames.length;
  const start = frameIndexAt(track, s);
  let top: number | null = null;
  let seenChain = false;
  for (let k = 0; k < n; k++) {
    const index = track.closed ? (((start - k) % n) + n) % n : start - k;
    if (index < 0) break;
    const frame = track.frames[index];
    if (!frame) break;
    if (frame.flags.chain) {
      seenChain = true;
      top = top === null ? frame.position.y : Math.max(top, frame.position.y);
    } else if (seenChain) {
      break;
    }
  }
  return top;
}

function stallReason(
  track: PhysicsTrack,
  state: RideState,
  sample: ReturnType<typeof createSample>,
): string {
  if (!track.closed && state.s >= track.length - 1e-6) {
    return 'The track ends here. Close the circuit back at the station.';
  }
  const here = sample.position.y;
  const crest = crestAhead(track, state.s);
  const lift = lastLiftTop(track, state.s);
  if (crest === null) {
    return `Runs out of speed on this stretch. Add a drop before it or shorten the run.`;
  }
  const short = Math.max(0.1, crest - here);
  if (lift !== null && crest > lift) {
    return `Stalls ${short.toFixed(1)} m below the crest at ${crest.toFixed(0)} m, which is higher than the lift top at ${lift.toFixed(0)} m. Raise the lift or lower this hill.`;
  }
  if (lift !== null) {
    return `Stalls ${short.toFixed(1)} m below the crest at ${crest.toFixed(0)} m. Friction ate the margin: raise the lift by ${Math.ceil(short + 1)} m or lower this hill.`;
  }
  return `Stalls ${short.toFixed(1)} m below the crest at ${crest.toFixed(0)} m. There is no lift hill before it.`;
}

/** Runs the ride physics from a standing start and reports where it goes wrong. */
export function validateTrack(
  frames: readonly TrackFrame[],
  closure: ClosureInfo,
  params: PhysicsParams = PHYSICS_DEFAULTS,
): ValidationResult {
  const markers: ValidationMarker[] = [];
  const stats: RideStats = {
    rideTime: 0,
    maxSpeed: 0,
    maxVerticalG: 1,
    minVerticalG: 1,
    maxLateralG: 0,
  };
  const track = createPhysicsTrack(frames, closure.closed);
  const last = frames[frames.length - 1];

  if (!closure.closed && last) {
    markers.push({
      kind: 'open',
      severity: 'error',
      s: track.length,
      position: last.position.clone(),
      pieceIndex: last.pieceIndex,
      reason: `Circuit is open: ${closure.distance.toFixed(1)} m and ${closure.headingDeg.toFixed(0)}° from the station.`,
    });
  }
  if (frames.length < 8) return { ok: markers.length === 0, markers, stats };

  const state = createRideState(track);
  dispatchRide(state, track);
  const sample = createSample();
  const lateral = new Map<number, PieceExtreme>();
  const pullout = new Map<number, PieceExtreme>();
  const airtime = new Map<number, PieceExtreme>();

  while (state.time < MAX_SIM_SECONDS) {
    stepRide(state, track, SIM_DT, params);
    sampleTrackToRef(track, state.s, sample);
    stats.maxSpeed = Math.max(stats.maxSpeed, state.v);
    stats.maxVerticalG = Math.max(stats.maxVerticalG, state.gVertical);
    stats.minVerticalG = Math.min(stats.minVerticalG, state.gVertical);
    stats.maxLateralG = Math.max(stats.maxLateralG, Math.abs(state.gLateral));
    const piece = sample.pieceIndex;
    if (piece > 0 && state.phase === 'running') {
      lateral.set(
        piece,
        better(lateral.get(piece), Math.abs(state.gLateral), state.s, sample.position, true),
      );
      pullout.set(
        piece,
        better(pullout.get(piece), state.gVertical, state.s, sample.position, true),
      );
      airtime.set(
        piece,
        better(airtime.get(piece), state.gVertical, state.s, sample.position, false),
      );
    }
    if (state.phase === 'stalled') {
      // Reaching the end of an open track is already reported by the open-circuit marker.
      if (!closure.closed && state.s >= track.length - 1e-6) break;
      markers.push({
        kind: 'stall',
        severity: 'error',
        s: state.s,
        position: sample.position.clone(),
        pieceIndex: piece,
        reason: stallReason(track, state, sample),
      });
      break;
    }
    if (state.phase === 'complete') break;
  }
  stats.rideTime = state.time;

  if (closure.closed && state.phase !== 'complete' && state.phase !== 'stalled') {
    markers.push({
      kind: 'lost',
      severity: 'error',
      s: state.s,
      position: sample.position.clone(),
      pieceIndex: sample.pieceIndex,
      reason: 'The train never makes it back to the station.',
    });
  }

  for (const [piece, extreme] of lateral) {
    if (extreme.value > LATERAL_G_LIMIT) {
      markers.push({
        kind: 'lateral',
        severity: 'warning',
        s: extreme.s,
        position: extreme.position,
        pieceIndex: piece,
        reason: `${extreme.value.toFixed(1)} g sideways here. Widen the radius or let the curve bank.`,
      });
    }
  }
  for (const [piece, extreme] of pullout) {
    if (extreme.value > PULLOUT_G_LIMIT) {
      markers.push({
        kind: 'pullout',
        severity: 'warning',
        s: extreme.s,
        position: extreme.position,
        pieceIndex: piece,
        reason: `${extreme.value.toFixed(1)} g in this valley. Riders grey out above 5 g; soften the pull-out.`,
      });
    }
  }
  for (const [piece, extreme] of airtime) {
    if (extreme.value < AIRTIME_G_LIMIT) {
      markers.push({
        kind: 'airtime',
        severity: 'warning',
        s: extreme.s,
        position: extreme.position,
        pieceIndex: piece,
        reason: `${extreme.value.toFixed(1)} g over this crest: hard ejector airtime. Slow the approach or round the hill.`,
      });
    }
  }

  markers.sort((a, b) => (a.severity === b.severity ? a.s - b.s : a.severity === 'error' ? -1 : 1));
  return { ok: !markers.some((m) => m.severity === 'error'), markers, stats };
}
