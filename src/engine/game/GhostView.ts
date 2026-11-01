import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { BALL_RADIUS, FLOOR_OFFSET, radialToRef } from '../ride/Ball';
import { createSample, sampleTrackToRef, type PhysicsTrack } from '../ride/BallPhysics';

/** A translucent twin of the ball that replays your best lap alongside you. */
export class GhostView {
  readonly mesh: Mesh;
  private readonly material: StandardMaterial;
  private readonly sample = createSample();
  private readonly radial = new Vector3();

  constructor(scene: Scene) {
    this.mesh = CreateSphere('ghostBall', { diameter: BALL_RADIUS * 2, segments: 20 }, scene);
    this.mesh.isPickable = false;
    this.mesh.applyFog = false;
    this.material = new StandardMaterial('ghostBallMaterial', scene);
    this.material.disableLighting = true;
    this.material.emissiveColor = new Color3(0.6, 0.8, 1.0);
    this.material.alpha = 0.38;
    this.material.disableDepthWrite = true;
    this.mesh.material = this.material;
    this.mesh.setEnabled(false);
  }

  setVisible(visible: boolean): void {
    this.mesh.setEnabled(visible);
  }

  place(track: PhysicsTrack, s: number, theta: number): void {
    sampleTrackToRef(track, s, this.sample);
    radialToRef(this.sample, theta, this.radial);
    this.radial.scaleToRef(FLOOR_OFFSET, this.mesh.position).addInPlace(this.sample.position);
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.dispose();
  }
}
