import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { SEAT_OFFSET } from '../ride/Train';
import type { TrackSample } from '../ride/TrainPhysics';
import { clamp } from '../util/math';

export type RideCameraMode = 'seat' | 'chase';

const SEAT_FOV = 1.12;
const CHASE_RADIUS = 17;

/** First-person seat camera with head bob, and an orbiting chase camera that follows the train. */
export class RideCameras {
  readonly seat: UniversalCamera;
  readonly chase: ArcRotateCamera;
  mode: RideCameraMode = 'seat';
  private readonly smoothUp = new Vector3(0, 1, 0);
  private readonly smoothForward = new Vector3(0, 0, 1);
  private readonly chaseTarget = new Vector3();
  private readonly scratch = new Vector3();
  private readonly smoothRight = new Vector3(1, 0, 0);
  private bobPhase = 0;
  private active = false;

  constructor(
    private readonly scene: Scene,
    private readonly heightAt: (x: number, z: number) => number,
  ) {
    this.seat = new UniversalCamera('seat', new Vector3(0, 2, 0), scene);
    this.seat.minZ = 0.1;
    this.seat.maxZ = 2500;
    this.seat.fov = SEAT_FOV;
    this.seat.rotationQuaternion = Quaternion.Identity();
    this.seat.inputs.clear();

    this.chase = new ArcRotateCamera(
      'chase',
      -Math.PI / 2,
      1.15,
      CHASE_RADIUS,
      new Vector3(0, 2, 0),
      scene,
    );
    this.chase.minZ = 0.3;
    this.chase.maxZ = 2500;
    this.chase.fov = 0.9;
    this.chase.lowerRadiusLimit = 6;
    this.chase.upperRadiusLimit = 70;
    this.chase.lowerBetaLimit = 0.15;
    this.chase.upperBetaLimit = Math.PI - 0.25;
    this.chase.wheelDeltaPercentage = 0.015;
    this.chase.panningSensibility = 0;
    this.chase.inertia = 0.8;
  }

  get cameras(): Camera[] {
    return [this.seat, this.chase];
  }

  get current(): Camera {
    return this.mode === 'seat' ? this.seat : this.chase;
  }

  /** Makes a ride camera the active one. */
  activate(mode: RideCameraMode, sample: TrackSample): void {
    this.mode = mode;
    this.active = true;
    this.chase.detachControl();
    if (mode === 'chase') {
      this.chaseTarget.copyFrom(sample.position);
      this.chase.target.copyFrom(this.chaseTarget);
      // Sit behind the train, looking along its direction of travel.
      this.chase.alpha = Math.atan2(-sample.tangent.z, -sample.tangent.x);
      this.chase.beta = 1.15;
      this.chase.radius = CHASE_RADIUS;
      this.chase.attachControl();
    } else {
      this.smoothUp.copyFrom(sample.up);
      this.smoothForward.copyFrom(sample.tangent);
    }
    this.scene.activeCamera = this.current;
  }

  toggle(sample: TrackSample): RideCameraMode {
    this.activate(this.mode === 'seat' ? 'chase' : 'seat', sample);
    return this.mode;
  }

  deactivate(): void {
    this.active = false;
    this.chase.detachControl();
  }

  update(dt: number, sample: TrackSample, speed: number, gVertical: number): void {
    if (!this.active) return;
    const kUp = 1 - Math.exp(-dt / 0.09);
    const kForward = 1 - Math.exp(-dt / 0.05);
    Vector3.LerpToRef(this.smoothUp, sample.up, kUp, this.smoothUp);
    this.smoothUp.normalize();
    Vector3.LerpToRef(this.smoothForward, sample.tangent, kForward, this.smoothForward);
    this.smoothForward.normalize();

    if (this.mode === 'seat') {
      const speedFactor = clamp(Math.abs(speed) / 15, 0, 1);
      const amp = 0.012 * speedFactor + 0.02 * clamp(Math.abs(gVertical - 1), 0, 1.5);
      this.bobPhase += dt * (1.4 + Math.abs(speed) * 0.12) * Math.PI * 2;
      const bob = Math.sin(this.bobPhase) * amp;
      const sway = Math.cos(this.bobPhase * 0.5) * amp * 0.6;
      const position = this.seat.position;
      position.copyFrom(sample.position);
      sample.up.scaleToRef(SEAT_OFFSET.y + bob, this.scratch);
      position.addInPlace(this.scratch);
      sample.tangent.scaleToRef(SEAT_OFFSET.z, this.scratch);
      position.addInPlace(this.scratch);
      sample.right.scaleToRef(sway, this.scratch);
      position.addInPlace(this.scratch);
      Vector3.CrossToRef(this.smoothUp, this.smoothForward, this.smoothRight);
      this.smoothRight.normalize();
      if (this.seat.rotationQuaternion) {
        // Local X, Y, Z become the seat's right, up and forward; the camera looks down its local Z.
        Quaternion.RotationQuaternionFromAxisToRef(
          this.smoothRight,
          this.smoothUp,
          this.smoothForward,
          this.seat.rotationQuaternion,
        );
      }
      this.seat.upVector.copyFrom(this.smoothUp);
      this.seat.fov = SEAT_FOV + 0.16 * clamp(Math.abs(speed) / 30, 0, 1);
      return;
    }

    const kTarget = 1 - Math.exp(-dt / 0.12);
    Vector3.LerpToRef(this.chaseTarget, sample.position, kTarget, this.chaseTarget);
    this.chase.target.copyFrom(this.chaseTarget);
    this.chase.target.y += 0.8;
    const floor = this.heightAt(this.chase.position.x, this.chase.position.z) + 1.2;
    if (this.chase.position.y < floor) {
      const cosBeta = clamp((floor - this.chase.target.y) / this.chase.radius, -1, 1);
      this.chase.beta = Math.min(this.chase.beta, Math.acos(cosBeta));
    }
  }

  dispose(): void {
    this.deactivate();
    this.seat.dispose();
    this.chase.dispose();
  }
}
