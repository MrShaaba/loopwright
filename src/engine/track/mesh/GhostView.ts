import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateTube } from '@babylonjs/core/Meshes/Builders/tubeBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { TrackFrame } from '../types';
import { RAIL_GAUGE, RAIL_RADIUS, SPINE_DROP } from './TrackView';

/** Translucent preview of the piece about to be placed at the track end. */
export class GhostView {
  private readonly valid: StandardMaterial;
  private readonly invalid: StandardMaterial;
  private meshes: Mesh[] = [];

  constructor(private readonly scene: Scene) {
    this.valid = this.material('ghostValid', new Color3(1, 0.68, 0.3));
    this.invalid = this.material('ghostInvalid', new Color3(1, 0.25, 0.3));
  }

  private material(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.disableLighting = true;
    material.emissiveColor = color;
    material.alpha = 0.55;
    material.backFaceCulling = false;
    return material;
  }

  show(frames: readonly TrackFrame[], isValid: boolean): void {
    this.hide();
    if (frames.length < 2) return;
    const material = isValid ? this.valid : this.invalid;
    const left: Vector3[] = [];
    const right: Vector3[] = [];
    const spine: Vector3[] = [];
    for (const frame of frames) {
      const half = frame.right.scale(RAIL_GAUGE / 2);
      left.push(frame.position.subtract(half));
      right.push(frame.position.add(half));
      spine.push(frame.position.subtract(frame.up.scale(SPINE_DROP)));
    }
    const paths: [string, Vector3[], number][] = [
      ['ghostLeft', left, RAIL_RADIUS * 1.4],
      ['ghostRight', right, RAIL_RADIUS * 1.4],
      ['ghostSpine', spine, 0.16],
    ];
    for (const [name, path, radius] of paths) {
      const mesh = CreateTube(
        name,
        { path, radius, tessellation: 6, cap: Mesh.NO_CAP },
        this.scene,
      );
      mesh.material = material;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      this.meshes.push(mesh);
    }
  }

  hide(): void {
    for (const mesh of this.meshes) mesh.dispose();
    this.meshes = [];
  }

  dispose(): void {
    this.hide();
    this.valid.dispose();
    this.invalid.dispose();
  }
}
