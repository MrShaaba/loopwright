import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Lighting } from '../scene/Lighting';
import type { TrainStyle } from '../theme/ThemeConfig';
import {
  CAR_COUNT,
  CAR_SPACING,
  createSample,
  sampleTrackToRef,
  type PhysicsTrack,
} from './TrainPhysics';

/** Seat position in the front car, used by the seat camera. */
export const SEAT_OFFSET = new Vector3(0, 1.28, 0.32);

/** Four cars that follow the track frames. Built from boxes, cylinders and a sphere. */
export class Train {
  readonly root: TransformNode;
  readonly cars: TransformNode[] = [];
  private readonly meshes: Mesh[] = [];
  private readonly materials: (PBRMaterial | StandardMaterial)[] = [];
  private readonly sample = createSample();

  constructor(
    private readonly scene: Scene,
    style: TrainStyle,
    private readonly lighting: Lighting,
  ) {
    this.root = new TransformNode('train', scene);
    const body = this.pbr('trainBody', style.body, 0.35, 0.45);
    const trim = this.pbr('trainTrim', style.trim, 0.6, 0.35);
    trim.emissiveColor = style.trim.scale(0.35);
    const seat = this.pbr('trainSeat', style.seat, 0, 0.9);
    const wheel = this.pbr('trainWheel', new Color3(0.2, 0.2, 0.22), 0.8, 0.4);
    const lamp = new StandardMaterial('trainLamp', scene);
    lamp.disableLighting = true;
    lamp.emissiveColor = style.lamp.scale(1.1);
    const tail = new StandardMaterial('trainTail', scene);
    tail.disableLighting = true;
    tail.emissiveColor = new Color3(1.2, 0.15, 0.1);
    this.materials.push(lamp, tail);

    for (let i = 0; i < CAR_COUNT; i++) {
      const car = new TransformNode(`car${i}`, scene);
      car.parent = this.root;
      car.rotationQuaternion = Quaternion.Identity();
      this.cars.push(car);
      this.buildCar(car, i, { body, trim, seat, wheel, lamp, tail });
    }
  }

  private pbr(name: string, color: Color3, metallic: number, roughness: number): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = color;
    material.metallic = metallic;
    material.roughness = roughness;
    this.materials.push(material);
    return material;
  }

  private part(
    mesh: Mesh,
    parent: TransformNode,
    material: PBRMaterial | StandardMaterial,
    x: number,
    y: number,
    z: number,
  ): Mesh {
    mesh.parent = parent;
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    this.meshes.push(mesh);
    return mesh;
  }

  private buildCar(
    car: TransformNode,
    index: number,
    m: {
      body: PBRMaterial;
      trim: PBRMaterial;
      seat: PBRMaterial;
      wheel: PBRMaterial;
      lamp: StandardMaterial;
      tail: StandardMaterial;
    },
  ): void {
    const scene = this.scene;
    const chassis = this.part(
      CreateBox(`car${index}Body`, { width: 1.5, height: 0.42, depth: 2.05 }, scene),
      car,
      m.body,
      0,
      0.52,
      0,
    );
    chassis.receiveShadows = true;
    this.lighting.addCaster(chassis);
    this.part(
      CreateBox(`car${index}Floor`, { width: 1.2, height: 0.12, depth: 1.9 }, scene),
      car,
      m.seat,
      0,
      0.75,
      0,
    );
    for (const side of [-1, 1]) {
      this.part(
        CreateBox(`car${index}Stripe`, { width: 0.04, height: 0.14, depth: 1.9 }, scene),
        car,
        m.trim,
        side * 0.76,
        0.6,
        0,
      );
      this.part(
        CreateBox(`car${index}Rail`, { width: 0.06, height: 0.5, depth: 1.9 }, scene),
        car,
        m.body,
        side * 0.72,
        0.95,
        0,
      );
    }
    for (const rowZ of [0.42, -0.5]) {
      this.part(
        CreateBox(`car${index}Cushion`, { width: 1.2, height: 0.14, depth: 0.5 }, scene),
        car,
        m.seat,
        0,
        0.86,
        rowZ,
      );
      const back = this.part(
        CreateBox(`car${index}Back`, { width: 1.2, height: 0.62, depth: 0.14 }, scene),
        car,
        m.seat,
        0,
        1.15,
        rowZ - 0.3,
      );
      this.lighting.addCaster(back);
      this.part(
        CreateBox(`car${index}Headrest`, { width: 1.2, height: 0.08, depth: 0.16 }, scene),
        car,
        m.trim,
        0,
        1.5,
        rowZ - 0.3,
      );
    }
    for (const x of [-0.55, 0.55]) {
      for (const z of [-0.72, 0.72]) {
        const wheel = this.part(
          CreateCylinder(
            `car${index}Wheel`,
            { diameter: 0.34, height: 0.1, tessellation: 12 },
            scene,
          ),
          car,
          m.wheel,
          x,
          0.17,
          z,
        );
        wheel.rotation.z = Math.PI / 2;
      }
    }
    if (index === 0) {
      const nose = this.part(
        CreateCylinder(
          `car${index}Nose`,
          { diameterTop: 0.26, diameterBottom: 1.05, height: 0.72, tessellation: 4 },
          scene,
        ),
        car,
        m.body,
        0,
        0.4,
        1.36,
      );
      nose.rotation.x = Math.PI / 2;
      nose.rotation.y = Math.PI / 4;
      this.lighting.addCaster(nose);
      this.part(
        CreateSphere(`car${index}Lamp`, { diameter: 0.13, segments: 8 }, scene),
        car,
        m.lamp,
        0,
        0.52,
        1.74,
      );
    }
    if (index === CAR_COUNT - 1) {
      for (const x of [-0.5, 0.5]) {
        this.part(
          CreateBox(`car${index}Tail`, { width: 0.22, height: 0.1, depth: 0.05 }, scene),
          car,
          m.tail,
          x,
          0.6,
          -1.05,
        );
      }
    }
  }

  get frontCar(): TransformNode {
    const car = this.cars[0];
    if (!car) throw new Error('Train has no cars');
    return car;
  }

  /** Places every car on the track with the front car at arc length `s`. */
  place(track: PhysicsTrack, s: number): void {
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car) continue;
      const sample = sampleTrackToRef(track, s - i * CAR_SPACING, this.sample);
      car.position.copyFrom(sample.position);
      if (car.rotationQuaternion) {
        // Local X, Y, Z become the frame's right, up and tangent.
        Quaternion.RotationQuaternionFromAxisToRef(
          sample.right,
          sample.up,
          sample.tangent,
          car.rotationQuaternion,
        );
      }
    }
  }

  setVisible(visible: boolean): void {
    this.root.setEnabled(visible);
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      this.lighting.shadows?.removeShadowCaster(mesh);
      mesh.dispose();
    }
    for (const material of this.materials) material.dispose();
    this.root.dispose();
  }
}
