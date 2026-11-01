import type { Camera } from '@babylonjs/core/Cameras/camera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { createSample, sampleTrackToRef, type PhysicsTrack } from '../ride/BallPhysics';
import { clamp } from '../util/math';

export type RideView = 'inside' | 'follow';

export const RIDE_VIEWS: readonly RideView[] = ['inside', 'follow'];

export const RIDE_VIEW_LABELS: Record<RideView, string> = {
  inside: 'Inside',
  follow: 'Follow',
};

interface ViewSpec {
  /** Metres behind the ball along the track. */
  behind: number;
  /** Lift above the tube's centre line, metres. */
  lift: number;
  /** Metres ahead of the ball for the far look point. */
  lookAhead: number;
  /** How far the look target sits from the ball towards the point ahead. */
  lookBlend: number;
  fov: number;
  /** Extra field of view at full speed, radians. */
  widen: number;
  /** Time constants of the position and orientation smoothing, seconds. */
  positionTau: number;
  rotationTau: number;
}

const VIEWS: Record<RideView, ViewSpec> = {
  // Tight: just behind the ball, looking down the curve.
  inside: {
    behind: 3.1,
    lift: 0.12,
    lookAhead: 5,
    lookBlend: 0.5,
    fov: 1.05,
    widen: 0.26,
    positionTau: 0.035,
    rotationTau: 0.07,
  },
  // Further back and higher, so the ball runs ahead of you in frame.
  follow: {
    behind: 7.5,
    lift: 0.95,
    lookAhead: 4,
    lookBlend: 0.3,
    fov: 0.92,
    widen: 0.18,
    positionTau: 0.06,
    rotationTau: 0.11,
  },
};

/**
 * Rides inside the tube behind the ball, looking ahead along the curve. The up vector comes
 * from the track frame, so the view banks with turns and rolls through loops. Position and
 * orientation are smoothed exponentially, the orientation as a quaternion, which keeps the
 * camera steady when the track goes vertical. Two views share the rig: Inside and Follow.
 */
export class RideCamera {
  readonly camera: UniversalCamera;
  view: RideView = 'inside';
  private readonly behind = createSample();
  private readonly ahead = createSample();
  private readonly ball = createSample();
  private readonly ballPoint = new Vector3();
  private readonly lookAt = new Vector3();
  private readonly targetPosition = new Vector3();
  private readonly forward = new Vector3();
  private readonly up = new Vector3();
  private readonly right = new Vector3();
  private readonly targetRotation = Quaternion.Identity();
  private readonly rotation = Quaternion.Identity();
  private readonly scratch = new Vector3();
  private active = false;

  constructor(private readonly scene: Scene) {
    this.camera = new UniversalCamera('ride', new Vector3(0, 3, -5), scene);
    this.camera.minZ = 0.08;
    this.camera.maxZ = 2500;
    this.camera.fov = VIEWS.inside.fov;
    this.camera.rotationQuaternion = Quaternion.Identity();
    this.camera.inputs.clear();
  }

  get current(): Camera {
    return this.camera;
  }

  private get spec(): ViewSpec {
    return VIEWS[this.view];
  }

  setView(view: RideView): void {
    this.view = view;
  }

  cycleView(): RideView {
    const index = RIDE_VIEWS.indexOf(this.view);
    this.view = RIDE_VIEWS[(index + 1) % RIDE_VIEWS.length] ?? 'inside';
    return this.view;
  }

  /** Snaps to the ball's position and makes this the active camera. */
  activate(track: PhysicsTrack, s: number, ballPosition?: Vector3): void {
    this.active = true;
    this.solve(track, s, 0, ballPosition);
    this.camera.position.copyFrom(this.targetPosition);
    this.rotation.copyFrom(this.targetRotation);
    this.camera.rotationQuaternion?.copyFrom(this.rotation);
    this.camera.fov = this.spec.fov;
    this.scene.activeCamera = this.camera;
  }

  deactivate(): void {
    this.active = false;
  }

  private solve(track: PhysicsTrack, s: number, lift: number, ballPosition?: Vector3): void {
    const spec = this.spec;
    sampleTrackToRef(track, s - spec.behind, this.behind);
    sampleTrackToRef(track, s, this.ball);
    sampleTrackToRef(track, s + spec.lookAhead, this.ahead);
    this.behind.up.scaleToRef(spec.lift + lift, this.scratch);
    this.targetPosition.copyFrom(this.behind.position).addInPlace(this.scratch);
    // Aim between the ball itself (wherever it sits on the wall) and the centre line ahead.
    if (ballPosition) this.ballPoint.copyFrom(ballPosition);
    else this.ballPoint.copyFrom(this.ball.position).subtractInPlace(this.ball.up);
    Vector3.LerpToRef(this.ballPoint, this.ahead.position, spec.lookBlend, this.lookAt);
    this.lookAt.subtractToRef(this.targetPosition, this.forward);
    if (this.forward.lengthSquared() < 1e-8) this.forward.copyFrom(this.behind.tangent);
    this.forward.normalize();
    // Keep the frame's up but make it orthogonal to the actual viewing direction.
    this.up.copyFrom(this.behind.up);
    Vector3.CrossToRef(this.up, this.forward, this.right);
    if (this.right.lengthSquared() < 1e-8)
      Vector3.CrossToRef(this.behind.right, this.forward, this.right);
    this.right.normalize();
    Vector3.CrossToRef(this.forward, this.right, this.up);
    this.up.normalize();
    Quaternion.RotationQuaternionFromAxisToRef(
      this.right,
      this.up,
      this.forward,
      this.targetRotation,
    );
  }

  /**
   * Follows the ball. `lift` is an extra vertical offset in metres along the frame's up, for
   * airtime and squeeze; `speed` is the effective speed in m/s; `kick` is a boost pad's charge.
   */
  update(
    dt: number,
    track: PhysicsTrack,
    s: number,
    speed: number,
    reducedMotion: boolean,
    lift = 0,
    ballPosition?: Vector3,
    kick = 0,
  ): void {
    if (!this.active) return;
    const spec = this.spec;
    this.solve(track, s, lift, ballPosition);
    const kPosition = 1 - Math.exp(-dt / spec.positionTau);
    const kRotation = 1 - Math.exp(-dt / spec.rotationTau);
    Vector3.LerpToRef(this.camera.position, this.targetPosition, kPosition, this.camera.position);
    Quaternion.SlerpToRef(this.rotation, this.targetRotation, kRotation, this.rotation);
    this.rotation.normalize();
    this.camera.rotationQuaternion?.copyFrom(this.rotation);
    // Field of view opens with speed, with an extra kick while a boost pad's burst runs.
    const widen = reducedMotion
      ? 0
      : spec.widen * clamp((speed - 8) / 32, 0, 1) + 0.14 * clamp(kick, 0, 1);
    this.camera.fov += (spec.fov + widen - this.camera.fov) * (1 - Math.exp(-dt / 0.25));
  }

  dispose(): void {
    this.deactivate();
    this.camera.dispose();
  }
}
