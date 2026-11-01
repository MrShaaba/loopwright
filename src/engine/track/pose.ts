import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DEG, wrapAngle } from '../util/math';
import type { Pose } from './types';

/** Unit direction of travel for a yaw and pitch. */
export function directionOf(yaw: number, pitch: number): Vector3 {
  const c = Math.cos(pitch);
  return new Vector3(Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c);
}

export function forwardOf(pose: Pose): Vector3 {
  return directionOf(pose.yaw, pose.pitch);
}

/** Horizontal forward, ignoring pitch. */
export function horizontalForward(yaw: number): Vector3 {
  return new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
}

/** Horizontal right-hand direction for a yaw. */
export function rightOf(yaw: number): Vector3 {
  return new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
}

export function makePose(position: Vector3, yaw = 0, pitch = 0): Pose {
  return { position: position.clone(), yaw, pitch };
}

export function clonePose(pose: Pose): Pose {
  return { position: pose.position.clone(), yaw: pose.yaw, pitch: pose.pitch };
}

export interface PoseGap {
  distance: number;
  headingDeg: number;
  pitchDeg: number;
}

/** How far pose `a` is from matching pose `b`. */
export function poseGap(a: Pose, b: Pose): PoseGap {
  return {
    distance: Vector3.Distance(a.position, b.position),
    headingDeg: Math.abs(wrapAngle(a.yaw - b.yaw)) / DEG,
    pitchDeg: Math.abs(wrapAngle(a.pitch - b.pitch)) / DEG,
  };
}
