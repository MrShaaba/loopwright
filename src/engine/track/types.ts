import type { Vector3 } from '@babylonjs/core/Maths/math.vector';

/** Position plus heading on the track. Yaw is around +Y (0 faces +Z, positive turns right), pitch is up from horizontal. Radians. */
export interface Pose {
  position: Vector3;
  yaw: number;
  pitch: number;
}

export interface SegmentFlags {
  chain?: boolean;
  brake?: boolean;
  station?: boolean;
}

/**
 * How bank is interpreted along a piece. Gravity-framed pieces keep "up" measured against
 * the world; transport-framed pieces (loops) follow parallel transport so riders invert.
 */
export type FrameMode = 'gravity' | 'transport';

/** A key emitted by a piece, in world space. `t` runs 0 to 1 along the piece by arc length. */
export interface PieceKey {
  position: Vector3;
  /** Designed bank in radians, positive rolls to the right. */
  bank: number;
  t: number;
  flags: SegmentFlags;
}

/** A piece key with the model's bookkeeping attached. */
export interface TrackKey extends PieceKey {
  pieceIndex: number;
  frame: FrameMode;
}

/** One sample of the finished track, every 0.25 m. Everything downstream reads only these. */
export interface TrackFrame {
  s: number;
  position: Vector3;
  tangent: Vector3;
  up: Vector3;
  right: Vector3;
  /** 1 / radius of curvature in metres. */
  curvature: number;
  bank: number;
  pieceIndex: number;
  t: number;
  flags: SegmentFlags;
}

export type ParamValue = number | string;
export type PieceParams = Record<string, ParamValue>;

export interface ParamDef {
  label: string;
  options: readonly ParamValue[];
  default: ParamValue;
  /** Formats an option for the palette chip. */
  format?: (value: ParamValue) => string;
}

export type PieceCategory = 'basic' | 'hills' | 'inversions' | 'special';

export interface PieceGeometry {
  keys: PieceKey[];
  exit: Pose;
  length: number;
}

export interface PieceDef {
  id: string;
  label: string;
  category: PieceCategory;
  description: string;
  params: Record<string, ParamDef>;
  frame: FrameMode;
  /** Pieces the palette does not offer, such as the station. */
  hidden?: boolean;
  /** Returns why the piece cannot start from this pose, or null when it can. */
  check?: (entry: Pose, params: PieceParams) => string | null;
  build: (entry: Pose, params: PieceParams) => PieceGeometry;
}
