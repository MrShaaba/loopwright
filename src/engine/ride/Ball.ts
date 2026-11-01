import { Constants } from '@babylonjs/core/Engines/constants';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Material } from '@babylonjs/core/Materials/material';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Space } from '@babylonjs/core/Maths/math.axis';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { createBallTexture, createGlowTexture } from '../scene/textures';
import type { BallStyle } from '../theme/ThemeConfig';
import { TUBE_RADIUS } from '../tube/TubeView';
import type { TrackSample } from './BallPhysics';

export const BALL_RADIUS = 0.42;
/** The ball rolls on the tube floor rather than floating at its centre. */
export const FLOOR_OFFSET = TUBE_RADIUS - BALL_RADIUS - 0.05;

/** A glowing sphere that rolls along the tube floor and lights what it passes. */
export class Ball {
  readonly mesh: Mesh;
  /** A soft additive disc behind the ball: a controlled aura instead of a screen-wide bloom. */
  readonly halo: Mesh;
  readonly light: PointLight;
  readonly color = new Color3(1, 1, 1);
  private readonly material: StandardMaterial;
  private readonly haloMaterial: StandardMaterial;
  private texture: DynamicTexture | null = null;
  private haloTexture: DynamicTexture | null = null;
  private readonly scratch = new Vector3();

  constructor(
    private readonly scene: Scene,
    style: BallStyle,
  ) {
    this.mesh = CreateSphere('ball', { diameter: BALL_RADIUS * 2, segments: 28 }, scene);
    this.mesh.isPickable = false;
    this.mesh.rotationQuaternion = Quaternion.Identity();
    this.material = new StandardMaterial('ballMaterial', scene);
    this.material.specularColor = new Color3(0.35, 0.35, 0.35);
    this.material.specularPower = 48;
    this.mesh.material = this.material;
    this.light = new PointLight('ballLight', Vector3.Zero(), scene);
    this.light.parent = this.mesh;
    this.light.range = 18;

    this.halo = CreatePlane('ballHalo', { size: BALL_RADIUS * 3.4 }, scene);
    this.halo.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.halo.isPickable = false;
    this.haloMaterial = new StandardMaterial('ballHaloMaterial', scene);
    this.haloMaterial.disableLighting = true;
    this.haloMaterial.diffuseColor = Color3.Black();
    this.haloMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;
    this.haloMaterial.alphaMode = Constants.ALPHA_ADD;
    this.haloMaterial.disableDepthWrite = true;
    this.halo.material = this.haloMaterial;
    this.restyle(style);
  }

  restyle(style: BallStyle): void {
    this.color.copyFrom(style.color);
    this.texture?.dispose();
    this.texture = createBallTexture(this.scene, 'ballTexture', 256, style.color);
    this.material.diffuseColor = style.color.scale(0.35);
    this.material.emissiveTexture = this.texture;
    this.light.diffuse = style.color;
    this.light.specular = style.color.scale(0.5);
    this.light.intensity = style.light;
    this.haloTexture?.dispose();
    this.haloTexture = createGlowTexture(
      this.scene,
      'ballHaloTexture',
      128,
      style.color.scale(0.3),
    );
    this.haloMaterial.emissiveTexture = this.haloTexture;
    this.haloMaterial.opacityTexture = this.haloTexture;
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  /** Moves the ball to a track sample and rolls it by the distance travelled since the last call. */
  place(sample: TrackSample, rolled: number): void {
    sample.up.scaleToRef(-FLOOR_OFFSET, this.scratch);
    this.mesh.position.copyFrom(sample.position).addInPlace(this.scratch);
    this.halo.position.copyFrom(this.mesh.position);
    if (rolled !== 0) this.mesh.rotate(sample.right, rolled / BALL_RADIUS, Space.WORLD);
  }

  dispose(): void {
    this.light.dispose();
    this.texture?.dispose();
    this.haloTexture?.dispose();
    this.haloMaterial.dispose();
    this.halo.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
