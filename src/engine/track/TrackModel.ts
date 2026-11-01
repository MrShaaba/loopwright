import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { PlacedPiece } from '../save/schema';
import { buildFrames } from './frames';
import { getPiece } from './pieces';
import { clonePose, makePose, poseGap } from './pose';
import type { PieceDef, PieceGeometry, PieceParams, Pose, TrackFrame, TrackKey } from './types';

/** The station is centred on the park origin, 1.2 m above the plateau. */
export const STATION_ENTRY: Pose = makePose(new Vector3(0, 1.2, -6), 0, 0);

export interface ClosureInfo {
  closed: boolean;
  distance: number;
  headingDeg: number;
  pitchDeg: number;
}

export const CLOSE_DISTANCE = 0.75;
export const CLOSE_HEADING_DEG = 8;
export const CLOSE_PITCH_DEG = 8;

export interface Candidate {
  geometry: PieceGeometry;
  reason: string | null;
}

/**
 * The track as data: an ordered list of placed pieces starting with the station.
 * Everything else here is derived from it on every change.
 */
export class TrackModel {
  readonly pieces: PlacedPiece[] = [];
  geometries: PieceGeometry[] = [];
  keys: TrackKey[] = [];
  frames: TrackFrame[] = [];
  exitPose: Pose;
  closure: ClosureInfo = { closed: false, distance: 0, headingDeg: 0, pitchDeg: 0 };
  length = 0;
  /** Increments on every rebuild so views can skip stale work. */
  version = 0;

  constructor(readonly entry: Pose = STATION_ENTRY) {
    this.exitPose = clonePose(entry);
    this.pieces.push({ type: 'station', params: {} });
    this.rebuild();
  }

  /** Replaces the whole track, ensuring the station stays first. */
  setPieces(pieces: readonly PlacedPiece[]): void {
    this.pieces.length = 0;
    const rest = pieces.filter((p) => p.type !== 'station');
    this.pieces.push(
      { type: 'station', params: {} },
      ...rest.map((p) => ({ type: p.type, params: { ...p.params } })),
    );
    this.rebuild();
  }

  push(piece: PlacedPiece): void {
    this.pieces.push({ type: piece.type, params: { ...piece.params } });
    this.rebuild();
  }

  /** Removes the last piece. The station cannot be removed. */
  pop(): PlacedPiece | null {
    if (this.pieces.length <= 1) return null;
    const removed = this.pieces.pop() ?? null;
    this.rebuild();
    return removed;
  }

  /** Builds a piece from the current track end and reports why it cannot be placed, if so. */
  candidate(def: PieceDef, params: PieceParams): Candidate {
    const geometry = def.build(this.exitPose, params);
    if (this.closure.closed) return { geometry, reason: 'The circuit is closed' };
    const reason = def.check?.(this.exitPose, params) ?? null;
    return { geometry, reason };
  }

  /** Frames for a candidate piece alone, continuous with the end of the track. */
  ghostFrames(def: PieceDef, geometry: PieceGeometry): TrackFrame[] {
    const index = this.pieces.length;
    const tail = this.keys.slice(-6).map((k) => ({ ...k }));
    const keys = this.appendKeys(tail, geometry.keys, index, def.frame);
    return buildFrames(keys, false).filter((frame) => frame.pieceIndex === index);
  }

  private appendKeys(
    into: TrackKey[],
    keys: readonly TrackKey[] | readonly PieceGeometry['keys'][number][],
    pieceIndex: number,
    frame: PieceDef['frame'],
  ): TrackKey[] {
    // The new piece's first key coincides with the previous exit; drop the older copy so the
    // join carries the new piece's attributes.
    if (into.length > 0) into.pop();
    for (const key of keys) into.push({ ...key, pieceIndex, frame });
    return into;
  }

  rebuild(): void {
    const geometries: PieceGeometry[] = [];
    const keys: TrackKey[] = [];
    let pose = clonePose(this.entry);
    let length = 0;
    this.pieces.forEach((piece, index) => {
      const def = getPiece(piece.type);
      const geometry = def.build(pose, piece.params);
      geometries.push(geometry);
      this.appendKeys(keys, geometry.keys, index, def.frame);
      pose = geometry.exit;
      length += geometry.length;
    });
    this.geometries = geometries;
    this.keys = keys;
    this.exitPose = clonePose(pose);
    this.length = length;

    const gap = poseGap(this.exitPose, this.entry);
    const closed =
      this.pieces.length > 1 &&
      gap.distance <= CLOSE_DISTANCE &&
      gap.headingDeg <= CLOSE_HEADING_DEG &&
      gap.pitchDeg <= CLOSE_PITCH_DEG;
    this.closure = { closed, ...gap };
    this.frames = buildFrames(keys, closed);
    this.version++;
  }
}
