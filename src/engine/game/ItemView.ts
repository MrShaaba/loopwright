import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';
import { FLOOR_OFFSET, radialToRef } from '../ride/Ball';
import { createSample, sampleTrackToRef, type PhysicsTrack } from '../ride/BallPhysics';
import { basisMatrixToRef, TUBE_RADIUS } from '../tube/TubeView';
import type { Item, ItemKind } from './items';

/** Colours for the four item kinds; the ring colour follows the theme's edge glow. */
export interface ItemPalette {
  ring: Color3;
  gem: Color3;
  boost: Color3;
  hazard: Color3;
}

export const DEFAULT_ITEM_PALETTE: ItemPalette = {
  ring: new Color3(1.0, 0.86, 0.45),
  gem: new Color3(1.0, 0.45, 0.95),
  boost: new Color3(0.45, 1.0, 0.6),
  hazard: new Color3(1.0, 0.3, 0.3),
};

const KINDS: readonly ItemKind[] = ['ring', 'gem', 'boost', 'hazard'];

interface Placement {
  item: Item;
  matrix: Matrix;
  /** Gems spin about this world axis. */
  axis: Vector3;
  position: Vector3;
}

/**
 * Draws the gameplay items as thin instances: rings the ball passes through, faceted gem
 * prisms that spin, arrow pads flat on the floor, and striped barriers across part of the
 * wall. Collected items are left out of the buffers until the next lap.
 */
export class ItemView {
  private readonly bases: Record<ItemKind, Mesh>;
  private readonly materials: Record<ItemKind, StandardMaterial>;
  private placements: Placement[] = [];
  private hidden = new Set<number>();
  private time = 0;
  private visible = true;
  private readonly ringColor = new Color3(1.0, 0.86, 0.45);
  private readonly sample = createSample();
  private readonly radial = new Vector3();
  private readonly spin = Quaternion.Identity();
  private readonly spinMatrix = new Matrix();
  private readonly world = new Matrix();

  constructor(scene: Scene, palette: ItemPalette = DEFAULT_ITEM_PALETTE) {
    const material = (name: string): StandardMaterial => {
      const m = new StandardMaterial(name, scene);
      m.disableLighting = true;
      return m;
    };
    this.materials = {
      ring: material('itemRing'),
      gem: material('itemGem'),
      boost: material('itemBoost'),
      hazard: material('itemHazard'),
    };
    this.bases = {
      ring: CreateTorus(
        'itemRingBase',
        { diameter: 1.2, thickness: 0.09, tessellation: 28 },
        scene,
      ),
      gem: CreatePolyhedron('itemGemBase', { type: 1, size: 0.34 }, scene),
      boost: CreateBox('itemBoostBase', { width: 1.1, height: 0.06, depth: 1.6 }, scene),
      hazard: CreateBox('itemHazardBase', { width: 1.3, height: 0.9, depth: 0.12 }, scene),
    };
    for (const kind of KINDS) {
      const base = this.bases[kind];
      base.material = this.materials[kind];
      base.isVisible = false;
      base.isPickable = false;
    }
    this.restyle(palette);
  }

  restyle(palette: ItemPalette): void {
    this.ringColor.copyFrom(palette.ring);
    this.materials.ring.emissiveColor = palette.ring.scale(0.9);
    this.materials.gem.emissiveColor = palette.gem.scale(1.1);
    this.materials.boost.emissiveColor = palette.boost.scale(0.9);
    this.materials.hazard.emissiveColor = palette.hazard.scale(1.0);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.refresh();
  }

  /** Lays the items out along the track. */
  rebuild(items: readonly Item[], track: PhysicsTrack): void {
    this.placements = [];
    this.hidden = new Set();
    const scale = Vector3.One();
    const forward = new Vector3();
    const upAxis = new Vector3();
    const side = new Vector3();
    for (const item of items) {
      sampleTrackToRef(track, item.s, this.sample);
      radialToRef(this.sample, item.theta, this.radial);
      const position = new Vector3();
      const matrix = new Matrix();
      const axis = this.sample.tangent.clone();
      switch (item.kind) {
        case 'ring':
          // Centred where the ball's centre passes, the hole facing along the track.
          this.radial.scaleToRef(FLOOR_OFFSET, position).addInPlace(this.sample.position);
          Vector3.CrossToRef(this.sample.tangent, this.radial, side);
          basisMatrixToRef(side, this.sample.tangent, this.radial, position, scale, matrix);
          break;
        case 'gem':
          this.radial.scaleToRef(FLOOR_OFFSET, position).addInPlace(this.sample.position);
          Vector3.CrossToRef(this.sample.tangent, this.radial, side);
          basisMatrixToRef(
            side,
            this.radial.scale(-1),
            this.sample.tangent,
            position,
            scale,
            matrix,
          );
          break;
        case 'boost':
          // Flat on the wall at that angle, arrow pointing along the track.
          this.radial.scaleToRef(TUBE_RADIUS - 0.08, position).addInPlace(this.sample.position);
          this.radial.scaleToRef(-1, upAxis);
          Vector3.CrossToRef(upAxis, this.sample.tangent, side);
          forward.copyFrom(this.sample.tangent);
          basisMatrixToRef(side, upAxis, forward, position, scale, matrix);
          break;
        case 'hazard':
          // A barrier standing on the wall, facing the oncoming ball.
          this.radial.scaleToRef(TUBE_RADIUS - 0.55, position).addInPlace(this.sample.position);
          this.radial.scaleToRef(-1, upAxis);
          Vector3.CrossToRef(upAxis, this.sample.tangent, side);
          basisMatrixToRef(side, upAxis, this.sample.tangent, position, scale, matrix);
          break;
      }
      this.placements.push({ item, matrix, axis, position });
    }
    this.refresh();
  }

  /** Hides an item (collected or hit) until `reset`. */
  hide(id: number): void {
    if (this.hidden.has(id)) return;
    this.hidden.add(id);
    this.refresh();
  }

  /** Brings every item back, for a new lap. */
  reset(): void {
    if (this.hidden.size === 0) return;
    this.hidden = new Set();
    this.refresh();
  }

  update(dt: number): void {
    this.time += dt;
    // Rings breathe on the shared material; gems spin through their own matrix buffer.
    const pulse = 0.78 + 0.22 * Math.sin(this.time * 3.2);
    this.ringColor.scaleToRef(pulse, this.materials.ring.emissiveColor);
    const gems = this.placements.filter(
      (p) => p.item.kind === 'gem' && !this.hidden.has(p.item.id),
    );
    if (!this.visible || gems.length === 0) return;
    const buffer = new Float32Array(gems.length * 16);
    gems.forEach((placement, index) => {
      Quaternion.RotationAxisToRef(placement.axis, this.time * 1.6, this.spin);
      Matrix.FromQuaternionToRef(this.spin, this.spinMatrix);
      // Spin in place: rotate about the gem's own centre.
      this.spinMatrix.setTranslationFromFloats(0, 0, 0);
      placement.matrix.multiplyToRef(this.spinMatrix, this.world);
      this.world.setTranslation(placement.position);
      this.world.copyToArray(buffer, index * 16);
    });
    this.bases.gem.thinInstanceSetBuffer('matrix', buffer, 16, true);
  }

  private refresh(): void {
    for (const kind of KINDS) {
      const base = this.bases[kind];
      const list = this.visible
        ? this.placements.filter((p) => p.item.kind === kind && !this.hidden.has(p.item.id))
        : [];
      if (list.length === 0) {
        base.isVisible = false;
        continue;
      }
      const buffer = new Float32Array(list.length * 16);
      list.forEach((placement, index) => placement.matrix.copyToArray(buffer, index * 16));
      base.thinInstanceSetBuffer('matrix', buffer, 16, true);
      base.thinInstanceRefreshBoundingInfo();
      base.isVisible = true;
    }
  }

  dispose(): void {
    for (const kind of KINDS) {
      this.bases[kind].dispose();
      this.materials[kind].dispose();
    }
  }
}
