import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DEG } from '../util/math';
import { clonePose, directionOf, horizontalForward, rightOf } from './pose';
import type { PieceGeometry, PieceKey, Pose, SegmentFlags } from './types';

/** Metres between emitted keys. The spline resamples much finer. */
const KEY_SPACING = 1;

export interface SegmentOptions {
  flags?: SegmentFlags;
  /** Bank at local progress t in [0, 1], radians. */
  bank?: (t: number) => number;
}

/**
 * Walks a pose forward and records keys. Pieces are written as a few cursor calls,
 * so a new piece type is a short file and composite pieces are plain sequences.
 */
export class Cursor {
  pose: Pose;
  length = 0;
  private readonly keys: PieceKey[] = [];
  private readonly lengths: number[] = [];

  constructor(entry: Pose) {
    this.pose = clonePose(entry);
    this.emit(entry.position.clone(), 0, {});
  }

  private emit(position: Vector3, bank: number, flags: SegmentFlags): void {
    this.keys.push({ position, bank, t: 0, flags });
    this.lengths.push(this.length);
  }

  private steps(length: number): number {
    return Math.max(1, Math.ceil(length / KEY_SPACING));
  }

  /** Straight run at the current pitch. */
  straight(length: number, options: SegmentOptions = {}): this {
    const dir = directionOf(this.pose.yaw, this.pose.pitch);
    const start = this.pose.position.clone();
    const n = this.steps(length);
    const bank = options.bank ?? (() => 0);
    const flags = options.flags ?? {};
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.length += length / n;
      this.emit(start.add(dir.scale(length * t)), bank(t), flags);
    }
    this.pose.position = start.add(dir.scale(length));
    return this;
  }

  /** Horizontal arc at the current pitch; climbs as a helix when pitched. Radius is horizontal. */
  turn(
    radius: number,
    angleDeg: number,
    direction: 'left' | 'right',
    options: SegmentOptions = {},
  ): this {
    const s = direction === 'right' ? 1 : -1;
    const angle = angleDeg * DEG;
    const { yaw: yaw0, pitch } = this.pose;
    const start = this.pose.position.clone();
    const rise = Math.tan(pitch) * radius;
    const length = (radius * angle) / Math.cos(pitch);
    const n = this.steps(length);
    const bank = options.bank ?? (() => 0);
    const flags = options.flags ?? {};
    const at = (phi: number): Vector3 =>
      new Vector3(
        start.x + radius * s * (Math.cos(yaw0) - Math.cos(yaw0 + s * phi)),
        start.y + rise * phi,
        start.z + radius * s * (Math.sin(yaw0 + s * phi) - Math.sin(yaw0)),
      );
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.length += length / n;
      this.emit(at(angle * t), bank(t), flags);
    }
    this.pose.position = at(angle);
    this.pose.yaw += s * angle;
    return this;
  }

  /** Vertical arc that changes pitch by `deltaDeg` along the current heading. */
  pitchArc(radius: number, deltaDeg: number, options: SegmentOptions = {}): this {
    const delta = deltaDeg * DEG;
    if (Math.abs(delta) < 1e-9) return this;
    const sign = Math.sign(delta);
    const p0 = this.pose.pitch;
    const start = this.pose.position.clone();
    const forward = horizontalForward(this.pose.yaw);
    const length = radius * Math.abs(delta);
    const n = this.steps(length);
    const bank = options.bank ?? (() => 0);
    const flags = options.flags ?? {};
    const at = (psi: number): Vector3 => {
      const h = radius * sign * (Math.sin(psi) - Math.sin(p0));
      const y = radius * sign * (Math.cos(p0) - Math.cos(psi));
      return new Vector3(start.x + forward.x * h, start.y + y, start.z + forward.z * h);
    };
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.length += length / n;
      this.emit(at(p0 + delta * t), bank(t), flags);
    }
    this.pose.position = at(p0 + delta);
    this.pose.pitch = p0 + delta;
    return this;
  }

  /**
   * Arbitrary shape in the entry's local basis (forward, up, right), for loops and
   * corkscrews. `shape(u)` returns a local offset for u in [0, 1]; the exit pose is
   * supplied explicitly so snapping stays exact.
   */
  custom(
    steps: number,
    shape: (u: number) => { offset: Vector3; bank?: number },
    exit: { yaw: number; pitch: number },
    options: SegmentOptions = {},
  ): this {
    const start = this.pose.position.clone();
    const forward = horizontalForward(this.pose.yaw);
    const right = rightOf(this.pose.yaw);
    const flags = options.flags ?? {};
    const toWorld = (o: Vector3): Vector3 =>
      new Vector3(
        start.x + forward.x * o.x + right.x * o.z,
        start.y + o.y,
        start.z + forward.z * o.x + right.z * o.z,
      );
    let previous = start;
    let last = start;
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const sample = shape(u);
      const world = toWorld(sample.offset);
      this.length += Vector3.Distance(previous, world);
      this.emit(world, sample.bank ?? 0, flags);
      previous = world;
      last = world;
    }
    this.pose.position = last;
    this.pose.yaw = exit.yaw;
    this.pose.pitch = exit.pitch;
    return this;
  }

  finish(): PieceGeometry {
    const total = Math.max(this.length, 1e-9);
    const keys = this.keys.map((key, i) => ({ ...key, t: (this.lengths[i] ?? 0) / total }));
    // Flags describe the segment that starts at a key, so the entry key takes the first segment's.
    const first = keys[0];
    const second = keys[1];
    if (first && second) first.flags = second.flags;
    return { keys, exit: clonePose(this.pose), length: this.length };
  }
}
