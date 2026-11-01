import type { Camera } from '@babylonjs/core/Cameras/camera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { FLOOR_OFFSET } from '../ride/Ball';
import { createSample, sampleTrackToRef, type PhysicsTrack } from '../ride/BallPhysics';
import { clamp } from '../util/math';

const BASE_FOV = 1.05;
const FOV_WIDEN = 0.26;
/** Metres behind the ball and the lift above the tube's centre line. */
const BEHIND = 3.1;
const LIFT = 0.12;
const LOOK_AHEAD = 5;
/** How far the look target sits from the ball towards the point ahead; keeps the ball in frame. */
const LOOK_BLEND = 0.5;
/** Time constants of the position and orientation smoothing, seconds. */
const POSITION_TAU = 0.035;
const ROTATION_TAU = 0.07;

/**
 * Rides inside the tube just behind the ball, looking ahead along the curve. The up vector
 * comes from the track frame, so the view banks with turns and rolls through loops. Position
 * and orientation are smoothed exponentially, the orientation as a quaternion, which keeps the
 * camera steady when the track goes vertical.
 */
export class RideCamera {
  readonly camera: UniversalCamera;
  private readonly behind = createSample();
  private readonly ahead = createSample();
  private readonly ball = createSample();
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
    this.camera.fov = BASE_FOV;
    this.camera.rotationQuaternion = Quaternion.Identity();
    this.camera.inputs.clear();
  }

  get current(): Camera {
    return this.camera;
  }

  /** Snaps to the ball's position and makes this the active camera. */
  activate(track: PhysicsTrack, s: number): void {
    this.active = true;
    this.solve(track, s);
    this.camera.position.copyFrom(this.targetPosition);
    this.rotation.copyFrom(this.targetRotation);
    this.camera.rotationQuaternion?.copyFrom(this.rotation);
    this.scene.activeCamera = this.camera;
  }

  deactivate(): void {
    this.active = false;
  }

  private solve(track: PhysicsTrack, s: number): void {
    sampleTrackToRef(track, s - BEHIND, this.behind);
    sampleTrackToRef(track, s, this.ball);
    sampleTrackToRef(track, s + LOOK_AHEAD, this.ahead);
    this.behind.up.scaleToRef(LIFT, this.scratch);
    this.targetPosition.copyFrom(this.behind.position).addInPlace(this.scratch);
    // Aim between the ball itself (which rides the tube floor) and the centre line ahead.
    this.ball.up.scaleToRef(-FLOOR_OFFSET, this.scratch);
    this.scratch.addInPlace(this.ball.position);
    Vector3.LerpToRef(this.scratch, this.ahead.position, LOOK_BLEND, this.lookAt);
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

  update(dt: number, track: PhysicsTrack, s: number, speed: number, reducedMotion: boolean): void {
    if (!this.active) return;
    this.solve(track, s);
    const kPosition = 1 - Math.exp(-dt / POSITION_TAU);
    const kRotation = 1 - Math.exp(-dt / ROTATION_TAU);
    Vector3.LerpToRef(this.camera.position, this.targetPosition, kPosition, this.camera.position);
    Quaternion.SlerpToRef(this.rotation, this.targetRotation, kRotation, this.rotation);
    this.rotation.normalize();
    this.camera.rotationQuaternion?.copyFrom(this.rotation);
    const widen = reducedMotion ? 0 : FOV_WIDEN * clamp((speed - 8) / 32, 0, 1);
    this.camera.fov += (BASE_FOV + widen - this.camera.fov) * (1 - Math.exp(-dt / 0.25));
  }

  dispose(): void {
    this.deactivate();
    this.camera.dispose();
  }
}
