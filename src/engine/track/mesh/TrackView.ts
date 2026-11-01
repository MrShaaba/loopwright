import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreateTube } from '@babylonjs/core/Meshes/Builders/tubeBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Lighting } from '../../scene/Lighting';
import type { TrackStyle } from '../../theme/ThemeConfig';
import { forwardOf, horizontalForward, rightOf } from '../pose';
import { STATION_LENGTH } from '../pieces/station';
import type { Pose, TrackFrame } from '../types';

export const RAIL_GAUGE = 1.1;
export const RAIL_RADIUS = 0.085;
export const SPINE_DROP = 0.34;
const SPINE_RADIUS = 0.2;
/** Frames between ties and supports (frames are 0.25 m apart). */
const TIE_EVERY = 4;
const SUPPORT_EVERY = 16;
const MIN_SUPPORT_HEIGHT = 0.6;

/** Writes a world matrix whose axes are the frame's right, up and tangent. */
export function frameMatrixToRef(
  right: Vector3,
  up: Vector3,
  tangent: Vector3,
  position: Vector3,
  scale: Vector3,
  out: Matrix,
): Matrix {
  Matrix.FromValuesToRef(
    right.x * scale.x,
    right.y * scale.x,
    right.z * scale.x,
    0,
    up.x * scale.y,
    up.y * scale.y,
    up.z * scale.y,
    0,
    tangent.x * scale.z,
    tangent.y * scale.z,
    tangent.z * scale.z,
    0,
    position.x,
    position.y,
    position.z,
    1,
    out,
  );
  return out;
}

/** Rails, spine, ties and supports generated from the track frames, plus the station building. */
export class TrackView {
  private readonly rail: PBRMaterial;
  private readonly spine: PBRMaterial;
  private readonly tie: PBRMaterial;
  private readonly support: PBRMaterial;
  private readonly tieBase: Mesh;
  private readonly supportBase: Mesh;
  private readonly footerBase: Mesh;
  private readonly marker: TransformNode;
  private readonly stationNodes: Mesh[] = [];
  private dynamic: Mesh[] = [];

  constructor(
    private readonly scene: Scene,
    style: TrackStyle,
    private readonly lighting: Lighting,
    private readonly heightAt: (x: number, z: number) => number,
    stationEntry: Pose,
  ) {
    this.rail = new PBRMaterial('railMaterial', scene);
    this.rail.albedoColor = style.rail;
    this.rail.metallic = 0.75;
    this.rail.roughness = 0.42;
    this.rail.emissiveColor = style.rail.scale(style.railGlow);

    this.spine = new PBRMaterial('spineMaterial', scene);
    this.spine.albedoColor = style.spine;
    this.spine.metallic = 0.25;
    this.spine.roughness = 0.8;

    this.tie = new PBRMaterial('tieMaterial', scene);
    this.tie.albedoColor = style.spine.scale(1.15);
    this.tie.metallic = 0;
    this.tie.roughness = 0.92;

    this.support = new PBRMaterial('supportMaterial', scene);
    this.support.albedoColor = style.support;
    this.support.metallic = 0.1;
    this.support.roughness = 0.85;

    this.tieBase = CreateBox('tie', { width: 1.7, height: 0.08, depth: 0.26 }, scene);
    this.tieBase.material = this.tie;
    this.supportBase = CreateCylinder(
      'support',
      { height: 1, diameter: 0.28, tessellation: 10 },
      scene,
    );
    this.supportBase.material = this.support;
    this.footerBase = CreateBox('footer', { width: 1.1, height: 0.26, depth: 1.1 }, scene);
    this.footerBase.material = this.support;
    for (const base of [this.tieBase, this.supportBase, this.footerBase]) {
      base.isVisible = false;
      base.isPickable = false;
      base.receiveShadows = true;
      lighting.addCaster(base);
    }

    this.marker = this.buildMarker(style);
    this.buildStation(style, stationEntry);
  }

  private buildMarker(style: TrackStyle): TransformNode {
    const root = new TransformNode('trackEnd', this.scene);
    const ring = CreateTorus(
      'trackEndRing',
      { diameter: 2.6, thickness: 0.08, tessellation: 40 },
      this.scene,
    );
    ring.parent = root;
    ring.rotation.x = Math.PI / 2;
    ring.isPickable = false;
    const material = new StandardMaterial('trackEndMaterial', this.scene);
    material.disableLighting = true;
    material.emissiveColor = style.rail.scale(1.4).add(new Color3(0.35, 0.2, 0.05));
    ring.material = material;
    return root;
  }

  private buildStation(style: TrackStyle, entry: Pose): void {
    const forward = horizontalForward(entry.yaw);
    const right = rightOf(entry.yaw);
    const centre = entry.position.add(forward.scale(STATION_LENGTH / 2));
    const ground = this.heightAt(centre.x, centre.z);
    const deckTop = entry.position.y - 0.15;
    const place = (mesh: Mesh, lateral: number, along: number, y: number): void => {
      mesh.position = centre.add(right.scale(lateral)).add(forward.scale(along));
      mesh.position.y = y;
      mesh.rotation.y = entry.yaw;
      mesh.receiveShadows = true;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      this.lighting.addCaster(mesh);
      this.stationNodes.push(mesh);
    };

    const stone = new PBRMaterial('stationStone', this.scene);
    stone.albedoColor = style.support.scale(1.6).add(new Color3(0.08, 0.08, 0.09));
    stone.metallic = 0;
    stone.roughness = 0.95;
    const wood = new PBRMaterial('stationWood', this.scene);
    wood.albedoColor = style.spine.scale(1.3).add(new Color3(0.1, 0.06, 0.03));
    wood.metallic = 0;
    wood.roughness = 0.9;

    const deckHeight = deckTop - ground;
    const deck = CreateBox(
      'stationDeck',
      { width: 2.8, height: deckHeight, depth: STATION_LENGTH + 1 },
      this.scene,
    );
    deck.material = stone;
    place(deck, -2.1, 0, ground + deckHeight / 2);

    const roofHeight = deckTop + 3.3;
    for (const lateral of [-3.3, 1.9]) {
      for (const along of [-STATION_LENGTH / 2 + 0.6, STATION_LENGTH / 2 - 0.6]) {
        const post = CreateCylinder(
          'stationPost',
          { height: roofHeight - ground, diameter: 0.26, tessellation: 10 },
          this.scene,
        );
        post.material = wood;
        place(post, lateral, along, ground + (roofHeight - ground) / 2);
      }
    }
    const roof = CreateBox(
      'stationRoof',
      { width: 6.2, height: 0.18, depth: STATION_LENGTH + 1.4 },
      this.scene,
    );
    roof.material = wood;
    place(roof, -0.7, 0, roofHeight + 0.09);
    const ridge = CreateBox(
      'stationRidge',
      { width: 0.3, height: 0.5, depth: STATION_LENGTH + 1.4 },
      this.scene,
    );
    ridge.material = wood;
    place(ridge, -0.7, 0, roofHeight + 0.43);
  }

  private clearDynamic(): void {
    for (const mesh of this.dynamic) {
      this.lighting.shadows?.removeShadowCaster(mesh);
      mesh.dispose();
    }
    this.dynamic = [];
  }

  private tube(
    name: string,
    path: Vector3[],
    radius: number,
    tessellation: number,
    material: PBRMaterial,
  ): Mesh {
    const mesh = CreateTube(name, { path, radius, tessellation, cap: Mesh.NO_CAP }, this.scene);
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    this.lighting.addCaster(mesh);
    this.dynamic.push(mesh);
    return mesh;
  }

  rebuild(frames: readonly TrackFrame[], closed: boolean, exitPose: Pose): void {
    this.clearDynamic();
    this.marker.setEnabled(!closed);
    if (!closed) {
      this.marker.position = exitPose.position.clone();
      const forward = forwardOf(exitPose);
      this.marker.rotationQuaternion = Quaternion.FromLookDirectionLH(forward, Vector3.Up());
    }
    if (frames.length < 2) {
      this.tieBase.isVisible = false;
      this.supportBase.isVisible = false;
      this.footerBase.isVisible = false;
      return;
    }

    const left: Vector3[] = [];
    const right: Vector3[] = [];
    const spine: Vector3[] = [];
    for (const frame of frames) {
      const half = frame.right.scale(RAIL_GAUGE / 2);
      left.push(frame.position.subtract(half));
      right.push(frame.position.add(half));
      spine.push(frame.position.subtract(frame.up.scale(SPINE_DROP)));
    }
    if (closed) {
      left.push((left[0] ?? Vector3.Zero()).clone());
      right.push((right[0] ?? Vector3.Zero()).clone());
      spine.push((spine[0] ?? Vector3.Zero()).clone());
    }
    this.tube('railLeft', left, RAIL_RADIUS, 8, this.rail);
    this.tube('railRight', right, RAIL_RADIUS, 8, this.rail);
    this.tube('spine', spine, SPINE_RADIUS, 4, this.spine);

    this.placeTies(frames);
    this.placeSupports(frames);
  }

  private placeTies(frames: readonly TrackFrame[]): void {
    const count = Math.floor(frames.length / TIE_EVERY);
    const buffer = new Float32Array(count * 16);
    const matrix = new Matrix();
    const scale = Vector3.One();
    let placed = 0;
    for (let i = 0; i < count; i++) {
      const frame = frames[i * TIE_EVERY];
      if (!frame) continue;
      const position = frame.position.subtract(frame.up.scale(0.11));
      frameMatrixToRef(frame.right, frame.up, frame.tangent, position, scale, matrix);
      matrix.copyToArray(buffer, placed * 16);
      placed++;
    }
    this.tieBase.thinInstanceSetBuffer('matrix', buffer.subarray(0, placed * 16), 16, true);
    this.tieBase.isVisible = placed > 0;
    if (placed > 0) this.tieBase.thinInstanceRefreshBoundingInfo();
  }

  private placeSupports(frames: readonly TrackFrame[]): void {
    const candidates = Math.floor(frames.length / SUPPORT_EVERY) + 1;
    const supports = new Float32Array(candidates * 16);
    const footers = new Float32Array(candidates * 16);
    const matrix = new Matrix();
    const scale = new Vector3();
    const position = new Vector3();
    const identity = Quaternion.Identity();
    let placed = 0;
    for (let i = 0; i < frames.length; i += SUPPORT_EVERY) {
      const frame = frames[i];
      if (!frame || frame.up.y < 0.35) continue;
      const top = frame.position.subtract(frame.up.scale(SPINE_DROP + SPINE_RADIUS * 0.5));
      const ground = this.heightAt(top.x, top.z) - 0.05;
      const height = top.y - ground;
      if (height < MIN_SUPPORT_HEIGHT) continue;
      const thickness = 1 + Math.min(height, 40) * 0.025;
      scale.set(thickness, height, thickness);
      position.set(top.x, ground + height / 2, top.z);
      Matrix.ComposeToRef(scale, identity, position, matrix);
      matrix.copyToArray(supports, placed * 16);
      scale.set(1, 1, 1);
      position.set(top.x, ground + 0.13, top.z);
      Matrix.ComposeToRef(scale, identity, position, matrix);
      matrix.copyToArray(footers, placed * 16);
      placed++;
    }
    this.supportBase.thinInstanceSetBuffer('matrix', supports.subarray(0, placed * 16), 16, true);
    this.footerBase.thinInstanceSetBuffer('matrix', footers.subarray(0, placed * 16), 16, true);
    this.supportBase.isVisible = placed > 0;
    this.footerBase.isVisible = placed > 0;
    if (placed > 0) {
      this.supportBase.thinInstanceRefreshBoundingInfo();
      this.footerBase.thinInstanceRefreshBoundingInfo();
    }
  }

  dispose(): void {
    this.clearDynamic();
    for (const mesh of [this.tieBase, this.supportBase, this.footerBase, ...this.stationNodes]) {
      this.lighting.shadows?.removeShadowCaster(mesh);
      mesh.dispose();
    }
    this.marker.dispose(false, true);
    for (const material of [this.rail, this.spine, this.tie, this.support]) material.dispose();
  }
}
