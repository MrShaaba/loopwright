import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { ValidationMarker } from './validate';

/** Glowing pins at validation problems: red for errors, amber for warnings. */
export class MarkerView {
  private readonly error: StandardMaterial;
  private readonly warning: StandardMaterial;
  private spheres: Mesh[] = [];
  private beams: Mesh[] = [];
  private time = 0;

  constructor(
    private readonly scene: Scene,
    private readonly heightAt: (x: number, z: number) => number,
  ) {
    this.error = this.material('markerError', new Color3(1.4, 0.18, 0.2));
    this.warning = this.material('markerWarning', new Color3(1.2, 0.75, 0.2));
  }

  private material(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.disableLighting = true;
    material.emissiveColor = color;
    return material;
  }

  show(markers: readonly ValidationMarker[]): void {
    this.clear();
    for (const marker of markers) {
      const material = marker.severity === 'error' ? this.error : this.warning;
      const top = marker.position.y + 1.6;
      const sphere = CreateSphere('marker', { diameter: 1.1, segments: 12 }, this.scene);
      sphere.position.set(marker.position.x, top, marker.position.z);
      sphere.material = material;
      sphere.isPickable = false;
      this.spheres.push(sphere);
      const ground = this.heightAt(marker.position.x, marker.position.z);
      const height = Math.max(0.5, top - ground);
      const beam = CreateCylinder(
        'markerBeam',
        { diameter: 0.1, height, tessellation: 6 },
        this.scene,
      );
      beam.position.set(marker.position.x, ground + height / 2, marker.position.z);
      beam.material = material;
      beam.isPickable = false;
      beam.freezeWorldMatrix();
      this.beams.push(beam);
    }
  }

  update(dt: number): void {
    this.time += dt;
    const scale = 1 + 0.14 * Math.sin(this.time * 4);
    for (const sphere of this.spheres) sphere.scaling.setAll(scale);
  }

  setVisible(visible: boolean): void {
    for (const mesh of [...this.spheres, ...this.beams]) mesh.setEnabled(visible);
  }

  clear(): void {
    for (const mesh of [...this.spheres, ...this.beams]) mesh.dispose();
    this.spheres = [];
    this.beams = [];
  }

  dispose(): void {
    this.clear();
    this.error.dispose();
    this.warning.dispose();
  }
}
