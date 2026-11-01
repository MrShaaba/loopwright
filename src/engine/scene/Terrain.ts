import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { TerrainConfig } from '../theme/ThemeConfig';
import { lerp, smoothstep } from '../util/math';
import { hash2 } from '../util/noise';
import { createRng, rangeFrom } from '../util/random';
import { createHeightField, type HeightField } from './heightField';
import { createGrainTexture, createNormalTexture } from './textures';

/** Procedural park ground plus scattered boulders. Everything static is frozen. */
export class Terrain {
  readonly mesh: Mesh;
  readonly boulders: Mesh;
  readonly field: HeightField;

  constructor(
    private readonly scene: Scene,
    readonly config: TerrainConfig,
  ) {
    this.field = createHeightField({
      size: config.size,
      seed: config.seed,
      hillHeight: config.hillHeight,
      hillScale: config.hillScale,
      plateauRadius: config.plateauRadius,
      plateauHeight: 0,
      rimHeight: config.rimHeight,
    });
    this.mesh = this.buildGround();
    this.boulders = this.buildBoulders();
  }

  heightAt(x: number, z: number): number {
    return this.field.heightAt(x, z);
  }

  /** Meshes that should cast moon shadows. */
  get shadowCasters(): Mesh[] {
    return [this.boulders];
  }

  private buildGround(): Mesh {
    const { size, subdivisions, palette, plateauRadius, seed } = this.config;
    const ground = CreateGround('terrain', { width: size, height: size, subdivisions }, this.scene);
    const positions = ground.getVerticesData(VertexBuffer.PositionKind);
    const indices = ground.getIndices();
    if (!positions || !indices) throw new Error('Terrain ground has no geometry');

    const count = positions.length / 3;
    const colors = new Float32Array(count * 4);
    const color = new Color3();
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3] ?? 0;
      const z = positions[i * 3 + 2] ?? 0;
      const y = this.field.heightAt(x, z);
      positions[i * 3 + 1] = y;

      const slope = this.field.slopeAt(x, z);
      const r = Math.hypot(x, z);
      Color3.LerpToRef(palette.low, palette.high, smoothstep(-1.5, 7, y), color);
      Color3.LerpToRef(color, palette.steep, smoothstep(0.45, 0.95, slope), color);
      const path = 1 - smoothstep(plateauRadius * 0.85, plateauRadius * 1.35, r);
      Color3.LerpToRef(color, palette.path, path, color);
      const grain = 0.86 + 0.28 * hash2(i, 17, seed);
      colors[i * 4] = color.r * grain;
      colors[i * 4 + 1] = color.g * grain;
      colors[i * 4 + 2] = color.b * grain;
      colors[i * 4 + 3] = 1;
    }

    const normals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, normals);
    ground.setVerticesData(VertexBuffer.PositionKind, positions, false);
    ground.setVerticesData(VertexBuffer.NormalKind, normals, false);
    ground.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
    ground.refreshBoundingInfo();

    const material = new PBRMaterial('terrainMaterial', this.scene);
    material.albedoColor = Color3.White();
    material.metallic = 0;
    material.roughness = 0.96;
    material.specularIntensity = 0.3;
    const tiles = size / 11;
    const grain = createGrainTexture(this.scene, 'terrainGrain', 256, seed);
    grain.uScale = tiles;
    grain.vScale = tiles;
    material.albedoTexture = grain;
    const normalMap = createNormalTexture(this.scene, 'terrainNormal', 256, seed, 3);
    normalMap.uScale = tiles;
    normalMap.vScale = tiles;
    normalMap.level = 0.4;
    material.bumpTexture = normalMap;
    ground.material = material;

    ground.receiveShadows = true;
    ground.isPickable = true;
    ground.freezeWorldMatrix();
    return ground;
  }

  private buildBoulders(): Mesh {
    const { boulders, size, plateauRadius, seed } = this.config;
    const rock = CreateIcoSphere('boulder', { radius: 1, subdivisions: 2, flat: true }, this.scene);
    const positions = rock.getVerticesData(VertexBuffer.PositionKind);
    const indices = rock.getIndices();
    if (!positions || !indices) throw new Error('Boulder mesh has no geometry');

    // Rough up the sphere. Flat shading duplicates vertices, so the displacement is keyed on
    // the rounded position to keep shared corners attached.
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] ?? 0;
      const y = positions[i + 1] ?? 0;
      const z = positions[i + 2] ?? 0;
      const key = hash2(Math.round(x * 1000), Math.round((y * 7 + z) * 1000), seed + 23);
      const radial = 0.72 + 0.5 * key;
      positions[i] = x * radial;
      positions[i + 1] = Math.max(y * 0.72 * radial, -0.42);
      positions[i + 2] = z * radial;
    }
    const normals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, normals);
    rock.setVerticesData(VertexBuffer.PositionKind, positions, false);
    rock.setVerticesData(VertexBuffer.NormalKind, normals, false);

    const material = new PBRMaterial('boulderMaterial', this.scene);
    material.albedoColor = boulders.color;
    material.metallic = 0;
    material.roughness = 0.88;
    material.specularIntensity = 0.4;
    rock.material = material;

    const rng = createRng(seed * 7 + 1);
    const buffer = new Float32Array(boulders.count * 16);
    const scale = new Vector3();
    const position = new Vector3();
    const matrix = new Matrix();
    const limit = size * 0.47;
    let placed = 0;
    let attempts = 0;
    while (placed < boulders.count && attempts < boulders.count * 20) {
      attempts++;
      const x = rangeFrom(rng, -limit, limit);
      const z = rangeFrom(rng, -limit, limit);
      if (Math.hypot(x, z) < plateauRadius * 1.3) continue;
      const s = lerp(0.7, 3.4, Math.pow(rng(), 2.2));
      scale.set(
        s * rangeFrom(rng, 0.8, 1.3),
        s * rangeFrom(rng, 0.7, 1.1),
        s * rangeFrom(rng, 0.8, 1.3),
      );
      position.set(x, this.field.heightAt(x, z) - scale.y * 0.3, z);
      const rotation = Quaternion.FromEulerAngles(0, rangeFrom(rng, 0, Math.PI * 2), 0);
      Matrix.ComposeToRef(scale, rotation, position, matrix);
      matrix.copyToArray(buffer, placed * 16);
      placed++;
    }
    rock.thinInstanceSetBuffer('matrix', buffer.subarray(0, placed * 16), 16, true);
    rock.receiveShadows = true;
    rock.isPickable = false;
    rock.freezeWorldMatrix();
    return rock;
  }

  dispose(): void {
    this.mesh.material?.dispose(true, true);
    this.mesh.dispose();
    this.boulders.material?.dispose(true, true);
    this.boulders.dispose();
  }
}
