import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Material } from '@babylonjs/core/Materials/material';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { Trail } from '../ride/Trail';
import { createGlowTexture } from '../scene/textures';
import { directionFromAngles } from '../scene/Sky';
import type { CompiledTrack } from '../track/Track';
import { TUBE_RADIUS } from '../tube/TubeView';
import type { LoadedModel } from './ScenicLoader';
import type { ScenicWorld, SkyVariant } from './worlds';

/** Skybox radius after fitting; the cameras see to 2500 m. */
const SKY_RADIUS = 1200;
const FLARE_DISTANCE = 850;
/** How quickly the flare swells on a crest and settles after, seconds. */
const FLARE_TAU = 0.7;

export interface StageOptions {
  world: ScenicWorld;
  sky: SkyVariant | null;
  models: LoadedModel[];
  compiled: CompiledTrack;
  ballColor: Color3;
  /** Keeps a mesh out of the glow layer, which would bloom a whole skybox. */
  excludeFromGlow: (mesh: Mesh) => void;
}

interface FitTerrain {
  root: AbstractMesh;
  /** Model-space extents before fitting, to scale against the track each rebuild. */
  size: Vector3;
  min: Vector3;
}

/**
 * Everything a Scenic World puts in the scene from its models: the skybox, far scenery and the
 * terrain, plus the world's own flourishes (sun flare, ball trail). Static meshes are frozen;
 * `dispose` tears it all down for the next world.
 */
export class ScenicStage {
  private readonly scene: Scene;
  private readonly world: ScenicWorld;
  private readonly containers: AssetContainer[] = [];
  private terrain: FitTerrain | null = null;
  private flare: Mesh | null = null;
  private flareMaterial: StandardMaterial | null = null;
  private flareLevel = 0;
  private trail: Trail | null = null;

  constructor(scene: Scene, options: StageOptions) {
    this.scene = scene;
    this.world = options.world;
    const byFile = new Map(options.models.map((model) => [model.file, model]));
    const take = (file: string): LoadedModel | null => byFile.get(file) ?? null;
    const sky = options.sky ? take(options.sky.file) : null;
    if (sky) this.placeSky(sky, options.excludeFromGlow);
    const scenery = this.world.scenery ? take(this.world.scenery.file) : null;
    if (scenery && this.world.scenery) this.placeScenery(scenery, this.world.scenery);
    const terrain = this.world.terrain ? take(this.world.terrain.file) : null;
    if (terrain) this.placeTerrain(terrain);
    if (this.world.look.flare) this.buildFlare(this.world.look.flare, options.excludeFromGlow);
    if (this.world.look.ballTrail) {
      this.trail = new Trail(scene);
      this.trail.setStyle(
        {
          id: `world-${this.world.id}`,
          name: this.world.name,
          description: '',
          cost: 0,
          particles: this.world.look.ballTrail,
        },
        options.ballColor,
      );
    }
    this.rebuild(options.compiled);
  }

  private meshesOf(model: LoadedModel): Mesh[] {
    return model.container.meshes.filter(
      (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
    );
  }

  private adopt(model: LoadedModel): void {
    model.container.addAllToScene();
    this.containers.push(model.container);
    for (const mesh of model.container.meshes) {
      mesh.isPickable = false;
      mesh.receiveShadows = false;
    }
  }

  /** A sphere seen from inside: unlit, fog-free, at a fixed distance and following the camera. */
  private placeSky(model: LoadedModel, excludeFromGlow: (mesh: Mesh) => void): void {
    this.adopt(model);
    const level = this.world.look.skyLevel;
    for (const mesh of this.meshesOf(model)) {
      mesh.computeWorldMatrix(true);
      const radius = mesh.getBoundingInfo().boundingSphere.radiusWorld || 1;
      // Keep the world orientation the file gave it, but drop the parent so the scale is ours.
      mesh.setParent(null);
      mesh.position.setAll(0);
      mesh.scaling.scaleInPlace(SKY_RADIUS / radius);
      mesh.infiniteDistance = true;
      mesh.applyFog = false;
      mesh.alwaysSelectAsActiveMesh = true;
      const material = mesh.material;
      if (material instanceof PBRMaterial) {
        // Some skyboxes carry their picture as an emissive map; show it as the surface itself.
        material.albedoTexture ??= material.emissiveTexture;
        material.emissiveTexture = null;
        material.emissiveColor = Color3.Black();
        material.albedoColor = new Color3(level, level, level);
        material.unlit = true;
        material.backFaceCulling = false;
        material.fogEnabled = false;
        material.freeze();
      }
      excludeFromGlow(mesh);
    }
  }

  /** A model far off, fitted to a size and turned as the world asks. */
  private placeScenery(model: LoadedModel, placement: NonNullable<ScenicWorld['scenery']>): void {
    this.adopt(model);
    const root = model.container.rootNodes[0];
    if (root && 'position' in root) {
      const node = root as AbstractMesh;
      node.computeWorldMatrix(true);
      const { min, max } = node.getHierarchyBoundingVectors(true);
      const extent = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) || 1;
      const scale = placement.size / extent;
      const centre = min.add(max).scale(0.5 * scale);
      node.rotation.y = placement.yaw;
      node.scaling.setAll(scale);
      node.position.set(
        placement.position[0] - centre.x,
        placement.position[1] - centre.y,
        placement.position[2] - centre.z,
      );
    }
    for (const mesh of this.meshesOf(model)) {
      mesh.alwaysSelectAsActiveMesh = true;
      const material = mesh.material;
      if (material) {
        material.pointSize = placement.pointSize;
        material.fogEnabled = false;
        material.freeze();
      }
      mesh.computeWorldMatrix(true);
      mesh.freezeWorldMatrix();
    }
  }

  private placeTerrain(model: LoadedModel): void {
    this.adopt(model);
    const root = model.container.rootNodes[0];
    if (!root || !('position' in root)) return;
    const node = root as AbstractMesh;
    node.computeWorldMatrix(true);
    const { min, max } = node.getHierarchyBoundingVectors(true);
    this.terrain = { root: node, size: max.subtract(min), min: min.clone() };
    for (const mesh of this.meshesOf(model)) {
      const material = mesh.material;
      if (material instanceof PBRMaterial) {
        // Snow is matt: no reflections to miss, so a standard material lit by the moon reads right.
        const plain = new StandardMaterial(`${material.name}-plain`, this.scene);
        plain.diffuseTexture = material.albedoTexture;
        plain.diffuseColor = new Color3(0.92, 0.95, 1.0);
        plain.specularColor = new Color3(0.08, 0.08, 0.1);
        plain.specularPower = 24;
        mesh.material = plain;
        plain.freeze();
      }
    }
  }

  private buildFlare(
    flare: NonNullable<ScenicWorld['look']['flare']>,
    excludeFromGlow: (mesh: Mesh) => void,
  ): void {
    const plane = CreatePlane('scenicFlare', { size: flare.size }, this.scene);
    plane.position = directionFromAngles(flare.azimuthDeg, flare.elevationDeg).scale(
      FLARE_DISTANCE,
    );
    plane.infiniteDistance = true;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    plane.applyFog = false;
    plane.alwaysSelectAsActiveMesh = true;
    const material = new StandardMaterial('scenicFlare', this.scene);
    material.disableLighting = true;
    material.diffuseColor = Color3.Black();
    const texture = createGlowTexture(this.scene, 'scenicFlare', 256, flare.color);
    material.emissiveTexture = texture;
    material.opacityTexture = texture;
    material.transparencyMode = Material.MATERIAL_ALPHABLEND;
    material.alphaMode = Constants.ALPHA_ADD;
    material.fogEnabled = false;
    material.alpha = 0.2;
    plane.material = material;
    excludeFromGlow(plane);
    this.flare = plane;
    this.flareMaterial = material;
  }

  /** Fits the terrain under a reshaped track: wide enough to pass the footprint, top clear of the tube. */
  rebuild(compiled: CompiledTrack): void {
    const terrain = this.terrain;
    const placement = this.world.terrain;
    if (!terrain || !placement) return;
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const frame of compiled.frames) {
      min.minimizeInPlace(frame.position);
      max.maximizeInPlace(frame.position);
    }
    if (!Number.isFinite(min.x)) return;
    const width = max.x - min.x + placement.margin * 2;
    const depth = max.z - min.z + placement.margin * 2;
    const scale = Math.max(width / terrain.size.x, depth / terrain.size.z, 1);
    const root = terrain.root;
    root.scaling.setAll(scale);
    const top = min.y - TUBE_RADIUS - placement.clearance;
    // The model's bounds were measured at scale 1 about its own origin; shift so its highest point
    // lands at `top` and its centre under the track's centre.
    root.position.set(
      (min.x + max.x) / 2 - (terrain.min.x + terrain.size.x / 2) * scale,
      top - (terrain.min.y + terrain.size.y) * scale,
      (min.z + max.z) / 2 - (terrain.min.z + terrain.size.z / 2) * scale,
    );
    root.computeWorldMatrix(true);
    for (const mesh of root.getChildMeshes()) {
      mesh.unfreezeWorldMatrix();
      mesh.computeWorldMatrix(true);
      mesh.freezeWorldMatrix();
    }
  }

  /** Per frame: the flare swells on crests, the world trail follows the ball. */
  update(
    dt: number,
    gVertical: number,
    ballPosition: Vector3,
    heading: Vector3,
    speed: number,
  ): void {
    if (this.flare && this.flareMaterial) {
      const target = gVertical < 0.75 ? 1 : 0;
      this.flareLevel += (target - this.flareLevel) * (1 - Math.exp(-dt / FLARE_TAU));
      this.flareMaterial.alpha = 0.18 + 0.82 * this.flareLevel;
      const size = 1 + 0.35 * this.flareLevel;
      this.flare.scaling.set(size, size, size);
    }
    this.trail?.update(ballPosition, heading, speed);
  }

  setBallColor(color: Color3): void {
    this.trail?.setBallColor(color);
  }

  dispose(): void {
    this.trail?.dispose();
    this.flareMaterial?.emissiveTexture?.dispose();
    this.flareMaterial?.dispose();
    this.flare?.dispose();
    for (const container of this.containers) {
      container.removeAllFromScene();
      container.dispose();
    }
    this.containers.length = 0;
  }
}
