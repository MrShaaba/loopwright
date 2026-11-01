import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
// Pointer picking on the scene needs Ray's side effects registered.
import '@babylonjs/core/Culling/ray';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { clamp, lerp, shortestAngleDelta } from '../util/math';
import { Tweens, easeInOutCubic } from '../util/tween';

export type CameraMode = 'orbit' | 'fly';

export interface CameraPreset {
  id: string;
  label: string;
  alpha: number;
  beta: number;
  radius: number;
  target: Vector3;
}

export interface CameraRigOptions {
  heightAt: (x: number, z: number) => number;
  presets: CameraPreset[];
  initialPreset: string;
}

const FLY_SPEED = 0.45;
const FLY_FAST_MULTIPLIER = 3;
const KEY_CODES = { w: 87, s: 83, a: 65, d: 68, q: 81, e: 69 };

/**
 * Build-mode cameras: an orbit camera for most work and a free-fly camera for
 * walking the park. Both stay above the terrain, and presets glide the orbit camera.
 */
export class CameraRig {
  readonly orbit: ArcRotateCamera;
  readonly fly: UniversalCamera;
  mode: CameraMode = 'orbit';
  /** Called after every mode switch; the game forwards it to the UI. */
  onModeChange: ((mode: CameraMode) => void) | null = null;
  private readonly tweens = new Tweens();
  private readonly disposers: (() => void)[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
    private readonly options: CameraRigOptions,
  ) {
    const initial =
      options.presets.find((p) => p.id === options.initialPreset) ?? options.presets[0];
    if (!initial) throw new Error('CameraRig needs at least one preset');

    this.orbit = new ArcRotateCamera(
      'orbit',
      initial.alpha,
      initial.beta,
      initial.radius,
      initial.target.clone(),
      scene,
    );
    this.orbit.minZ = 0.5;
    this.orbit.maxZ = 2500;
    this.orbit.fov = 0.9;
    this.orbit.lowerRadiusLimit = 6;
    this.orbit.upperRadiusLimit = 300;
    this.orbit.lowerBetaLimit = 0.12;
    // Beyond PI/2 the camera dips under the target and looks up; update() keeps it above ground.
    this.orbit.upperBetaLimit = Math.PI - 0.25;
    this.orbit.wheelDeltaPercentage = 0.015;
    this.orbit.pinchDeltaPercentage = 0.01;
    this.orbit.useNaturalPinchZoom = true;
    this.orbit.panningSensibility = 45;
    this.orbit.panningAxis = new Vector3(1, 0, 1);
    this.orbit.panningInertia = 0.82;
    this.orbit.inertia = 0.82;
    this.orbit.allowUpsideDown = false;

    this.fly = new UniversalCamera('fly', new Vector3(0, 12, -60), scene);
    this.fly.minZ = 0.3;
    this.fly.maxZ = 2500;
    this.fly.fov = 0.95;
    this.fly.speed = FLY_SPEED;
    this.fly.angularSensibility = 2600;
    this.fly.inertia = 0.65;
    this.fly.keysUp = [KEY_CODES.w];
    this.fly.keysDown = [KEY_CODES.s];
    this.fly.keysLeft = [KEY_CODES.a];
    this.fly.keysRight = [KEY_CODES.d];
    this.fly.keysUpward = [KEY_CODES.e];
    this.fly.keysDownward = [KEY_CODES.q];

    scene.activeCamera = this.orbit;
    this.orbit.attachControl();

    const pointerObserver = scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERDOWN) return;
      this.tweens.cancelAll();
      canvas.focus();
      if (this.mode === 'fly' && document.pointerLockElement !== canvas) {
        void canvas.requestPointerLock();
      }
    });
    this.disposers.push(() => scene.onPointerObservable.remove(pointerObserver));

    const onShift = (event: KeyboardEvent): void => {
      if (event.key !== 'Shift') return;
      this.fly.speed = event.type === 'keydown' ? FLY_SPEED * FLY_FAST_MULTIPLIER : FLY_SPEED;
    };
    window.addEventListener('keydown', onShift);
    window.addEventListener('keyup', onShift);
    this.disposers.push(() => {
      window.removeEventListener('keydown', onShift);
      window.removeEventListener('keyup', onShift);
    });
  }

  get active(): Camera {
    return this.mode === 'fly' ? this.fly : this.orbit;
  }

  get cameras(): Camera[] {
    return [this.orbit, this.fly];
  }

  get presets(): readonly CameraPreset[] {
    return this.options.presets;
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.tweens.cancelAll();
    if (mode === 'fly') {
      this.fly.position.copyFrom(this.orbit.position);
      this.fly.setTarget(this.orbit.target.clone());
      this.orbit.detachControl();
      this.fly.attachControl();
      this.scene.activeCamera = this.fly;
    } else {
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      const forward = this.fly.getDirection(Vector3.Forward());
      const radius = clamp(this.orbit.radius, 25, 120);
      this.orbit.setTarget(this.fly.position.add(forward.scale(radius)));
      this.orbit.setPosition(this.fly.position.clone());
      this.fly.detachControl();
      this.orbit.attachControl();
      this.scene.activeCamera = this.orbit;
    }
    this.mode = mode;
    this.onModeChange?.(mode);
  }

  toggle(): void {
    this.setMode(this.mode === 'orbit' ? 'fly' : 'orbit');
  }

  /** Glides the orbit camera to a preset. Returns false when the preset is unknown. */
  flyTo(id: string): boolean {
    const preset = this.options.presets.find((p) => p.id === id);
    if (!preset) return false;
    if (this.mode === 'fly') this.setMode('orbit');
    const cam = this.orbit;
    cam.inertialAlphaOffset = 0;
    cam.inertialBetaOffset = 0;
    cam.inertialRadiusOffset = 0;
    cam.inertialPanningX = 0;
    cam.inertialPanningY = 0;
    const from = {
      alpha: cam.alpha,
      beta: cam.beta,
      radius: cam.radius,
      target: cam.target.clone(),
    };
    const deltaAlpha = shortestAngleDelta(from.alpha, preset.alpha);
    this.tweens.cancelAll();
    this.tweens.start({
      duration: 1.5,
      ease: easeInOutCubic,
      onUpdate: (k) => {
        cam.alpha = from.alpha + deltaAlpha * k;
        cam.beta = lerp(from.beta, preset.beta, k);
        cam.radius = lerp(from.radius, preset.radius, k);
        Vector3.LerpToRef(from.target, preset.target, k, cam.target);
      },
    });
    return true;
  }

  /** Glides the orbit camera's target to a point, keeping the current angles. */
  flyToPoint(point: Vector3, radius: number): void {
    if (this.mode === 'fly') this.setMode('orbit');
    const cam = this.orbit;
    const from = { radius: cam.radius, target: cam.target.clone() };
    const target = point.clone();
    this.tweens.cancelAll();
    this.tweens.start({
      duration: 1.1,
      ease: easeInOutCubic,
      onUpdate: (k) => {
        cam.radius = lerp(from.radius, radius, k);
        Vector3.LerpToRef(from.target, target, k, cam.target);
      },
    });
  }

  update(dt: number): void {
    this.tweens.update(dt);
    const { heightAt } = this.options;
    if (this.mode === 'fly') {
      const floor = heightAt(this.fly.position.x, this.fly.position.z) + 1.4;
      if (this.fly.position.y < floor) this.fly.position.y = floor;
      return;
    }
    const cam = this.orbit;
    const targetFloor = heightAt(cam.target.x, cam.target.z) + 0.5;
    if (cam.target.y < targetFloor) cam.target.y = targetFloor;
    const floor = heightAt(cam.position.x, cam.position.z) + 1.6;
    if (cam.position.y < floor) {
      const cosBeta = clamp((floor - cam.target.y) / cam.radius, -1, 1);
      cam.beta = Math.min(cam.beta, Math.acos(cosBeta));
    }
  }

  dispose(): void {
    this.tweens.cancelAll();
    for (const dispose of this.disposers) dispose();
    this.orbit.dispose();
    this.fly.dispose();
  }
}
