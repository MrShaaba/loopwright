import type { Vector3 } from '@babylonjs/core/Maths/math.vector';

/** Position plus heading on the track. Yaw is around +Y (0 faces +Z, positive turns right), pitch is up from horizontal. Radians. */
export interface Pose {
  position: Vector3;
  yaw: number;
  pitch: number;
}

/** Per-segment rendering hints. Neither one changes the path or the ride. */
export interface SegmentFlags {
  /** The tube is left open here: the ball flies through the air. */
  gap?: boolean;
  /** An opaque shell wraps the tube here. */
  tunnel?: boolean;
}

/**
 * How bank is interpreted along a section. Gravity-framed sections keep "up" measured against
 * the world; transport-framed sections (loops) follow parallel transport so the view inverts.
 */
export type FrameMode = 'gravity' | 'transport';

/** A key emitted by a section, in world space. `t` runs 0 to 1 along the section by arc length. */
export interface SectionKey {
  position: Vector3;
  /** Designed bank in radians, positive rolls to the right. */
  bank: number;
  t: number;
  flags: SegmentFlags;
}

/** A section key with the track's bookkeeping attached. */
export interface TrackKey extends SectionKey {
  sectionIndex: number;
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
  sectionIndex: number;
  t: number;
  flags: SegmentFlags;
}

export interface SectionGeometry {
  keys: SectionKey[];
  exit: Pose;
  length: number;
}
