import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Issue } from './validate';

/** Glowing pins at validation problems: red for errors, amber for warnings. */
export class IssueMarkers {
  private readonly error: StandardMaterial;
  private readonly warning: StandardMaterial;
  private spheres: Mesh[] = [];
  private beams: Mesh[] = [];
  private time = 0;
  private visible = true;

  constructor(private readonly scene: Scene) {
    this.error = this.material('issueError', new Color3(1.4, 0.2, 0.25));
    this.warning = this.material('issueWarning', new Color3(1.2, 0.78, 0.2));
  }

  private material(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.disableLighting = true;
    material.emissiveColor = color;
    return material;
  }

  show(issues: readonly Issue[]): void {
    this.clear();
    for (const issue of issues) {
      if (!issue.position) continue;
      const material = issue.severity === 'error' ? this.error : this.warning;
      const top = issue.position.y + 3.4;
      const sphere = CreateSphere('issuePin', { diameter: 1.2, segments: 12 }, this.scene);
      sphere.position.set(issue.position.x, top, issue.position.z);
      sphere.material = material;
      sphere.isPickable = false;
      sphere.setEnabled(this.visible);
      this.spheres.push(sphere);
      const height = Math.max(0.5, top);
      const beam = CreateCylinder(
        'issueBeam',
        { diameter: 0.1, height, tessellation: 6 },
        this.scene,
      );
      beam.position.set(issue.position.x, height / 2, issue.position.z);
      beam.material = material;
      beam.isPickable = false;
      beam.setEnabled(this.visible);
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
    this.visible = visible;
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
