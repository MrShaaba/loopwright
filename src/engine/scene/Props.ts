import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import type {
  LightStringConfig,
  PropConfig,
  RailConfig,
  ScatterConfig,
  SkylineConfig,
  SwimmerConfig,
  WeatherConfig,
} from '../theme/ThemeConfig';
import type { CompiledTrack } from '../track/Track';
import type { TrackFrame } from '../track/types';
import { basisMatrixToRef, TUBE_RADIUS } from '../tube/TubeView';
import { createRng, rangeFrom, type Rng } from '../util/random';
import { TAU } from '../util/math';
import { createRingSpriteTexture, createSoftDiscTexture } from './textures';

/** Props are seeded so a theme looks the same every time it is opened. */
const PROP_SEED = 4242;

interface Footprint {
  min: Vector3;
  max: Vector3;
  centre: Vector3;
}

function footprint(frames: readonly TrackFrame[]): Footprint {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const frame of frames) {
    min.minimizeInPlace(frame.position);
    max.maximizeInPlace(frame.position);
  }
  if (!Number.isFinite(min.x)) {
    min.set(-20, 0, -20);
    max.set(20, 0, 20);
  }
  return { min, max, centre: min.add(max).scale(0.5) };
}

/** Writes `count` matrices into a fresh buffer and hands it to the mesh. */
function setInstances(mesh: Mesh, matrices: readonly Matrix[]): void {
  if (matrices.length === 0) {
    mesh.isVisible = false;
    return;
  }
  const buffer = new Float32Array(matrices.length * 16);
  matrices.forEach((matrix, index) => matrix.copyToArray(buffer, index * 16));
  mesh.thinInstanceSetBuffer('matrix', buffer, 16, true);
  mesh.thinInstanceRefreshBoundingInfo();
  mesh.isVisible = true;
}

function hide(mesh: Mesh): void {
  mesh.isVisible = false;
  mesh.isPickable = false;
  mesh.receiveShadows = false;
}

/** Snow or bubbles in a box around the camera, so there is always weather in view. */
class Weather {
  private readonly system: ParticleSystem;
  private readonly texture: DynamicTexture;
  private readonly emitter = new Vector3();

  constructor(scene: Scene, config: WeatherConfig) {
    const snow = config.kind === 'snow';
    this.texture = snow
      ? createSoftDiscTexture(scene, 'weatherDisc', 32)
      : createRingSpriteTexture(scene, 'weatherRing', 32);
    const system = new ParticleSystem('weather', 3500, scene);
    system.particleTexture = this.texture;
    system.emitter = this.emitter;
    system.isLocal = false;
    const reach = 46;
    if (snow) {
      system.minEmitBox = new Vector3(-reach, 12, -reach);
      system.maxEmitBox = new Vector3(reach, 28, reach);
      system.direction1 = new Vector3(-0.35, -1, -0.35);
      system.direction2 = new Vector3(0.35, -1, 0.35);
      system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    } else {
      system.minEmitBox = new Vector3(-reach, -14, -reach);
      system.maxEmitBox = new Vector3(reach, 4, reach);
      system.direction1 = new Vector3(-0.2, 1, -0.2);
      system.direction2 = new Vector3(0.2, 1, 0.2);
      system.blendMode = ParticleSystem.BLENDMODE_ADD;
    }
    system.minEmitPower = config.speed[0];
    system.maxEmitPower = config.speed[1];
    // Long enough to cross the box; particles die quietly out of view.
    const span = 40 / config.speed[0];
    system.minLifeTime = span * 0.8;
    system.maxLifeTime = span;
    system.addSizeGradient(0, config.size[0], config.size[1]);
    system.addSizeGradient(1, config.size[0], config.size[1]);
    const { r, g, b } = config.color;
    system.color1 = new Color4(r, g, b, snow ? 0.85 : 0.5);
    system.color2 = new Color4(r, g, b, snow ? 0.6 : 0.3);
    system.colorDead = new Color4(r, g, b, 0);
    system.emitRate = config.rate;
    system.updateSpeed = 1 / 60;
    system.preWarmCycles = 240;
    system.preWarmStepOffset = 6;
    system.start();
    this.system = system;
  }

  update(cameraPosition: Vector3): void {
    this.emitter.copyFrom(cameraPosition);
  }

  dispose(): void {
    this.system.dispose(false);
    this.texture.dispose();
  }
}

/** Pines or kelp on the floor, kept clear of the tube. */
class Scatter {
  private readonly mesh: Mesh;
  private readonly materials: StandardMaterial[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly config: ScatterConfig,
  ) {
    this.mesh = config.kind === 'pine' ? this.buildPine() : this.buildKelp();
    hide(this.mesh);
  }

  private buildPine(): Mesh {
    const needles = new StandardMaterial('propPineNeedles', this.scene);
    needles.diffuseColor = this.config.color;
    needles.specularColor = Color3.Black();
    const snow = new StandardMaterial('propPineSnow', this.scene);
    snow.diffuseColor = this.config.accent;
    snow.specularColor = new Color3(0.1, 0.1, 0.1);
    this.materials.push(needles, snow);
    const parts: Mesh[] = [];
    const trunk = CreateCylinder(
      'trunk',
      { diameter: 0.5, height: 1.8, tessellation: 6 },
      this.scene,
    );
    trunk.position.y = 0.9;
    trunk.material = needles;
    parts.push(trunk);
    const tiers: [number, number, number][] = [
      [4.4, 3.4, 1.4],
      [3.4, 3.0, 3.6],
      [2.3, 2.6, 5.6],
    ];
    for (const [diameter, height, y] of tiers) {
      const cone = CreateCylinder(
        'tier',
        { diameterTop: 0, diameterBottom: diameter, height, tessellation: 8 },
        this.scene,
      );
      cone.position.y = y + height / 2;
      cone.material = needles;
      parts.push(cone);
      // A thin cap of snow on each tier.
      const cap = CreateCylinder(
        'cap',
        { diameterTop: 0, diameterBottom: diameter * 0.62, height: height * 0.55, tessellation: 8 },
        this.scene,
      );
      cap.position.y = y + height * 0.46 + (height * 0.55) / 2;
      cap.material = snow;
      parts.push(cap);
    }
    const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    if (!merged) throw new Error('Could not build the pine');
    merged.name = 'propPine';
    return merged;
  }

  private buildKelp(): Mesh {
    const material = new StandardMaterial('propKelp', this.scene);
    material.diffuseColor = this.config.color;
    material.emissiveColor = this.config.accent;
    material.specularColor = new Color3(0.2, 0.3, 0.3);
    material.backFaceCulling = false;
    this.materials.push(material);
    const blade = CreateCylinder(
      'propKelp',
      { diameterTop: 0.05, diameterBottom: 0.42, height: 1, tessellation: 5 },
      this.scene,
    );
    blade.position.y = 0.5;
    blade.bakeCurrentTransformIntoVertices();
    blade.material = material;
    return blade;
  }

  build(frames: readonly TrackFrame[], rng: Rng): void {
    const { min, max } = footprint(frames);
    const spread = this.config.spread;
    const clearance2 = this.config.clearance * this.config.clearance;
    // Check against every eighth frame: two metres apart is plenty for a clearance of several.
    const guards: TrackFrame[] = [];
    for (let i = 0; i < frames.length; i += 8) {
      const frame = frames[i];
      if (frame) guards.push(frame);
    }
    const matrices: Matrix[] = [];
    const position = new Vector3();
    const scale = new Vector3();
    const right = new Vector3();
    const up = new Vector3(0, 1, 0);
    const forward = new Vector3();
    let attempts = 0;
    while (matrices.length < this.config.count && attempts < this.config.count * 12) {
      attempts++;
      const x = rangeFrom(rng, min.x - spread, max.x + spread);
      const z = rangeFrom(rng, min.z - spread, max.z + spread);
      let clear = true;
      for (const guard of guards) {
        const dx = guard.position.x - x;
        const dz = guard.position.z - z;
        // Only frames near the floor block a spot; high track passes overhead.
        if (dx * dx + dz * dz < clearance2 && guard.position.y < 9) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      const size = rangeFrom(rng, this.config.scale[0], this.config.scale[1]);
      const yaw = rng() * TAU;
      const lean = this.config.kind === 'kelp' ? rangeFrom(rng, -0.18, 0.18) : 0;
      forward.set(Math.sin(yaw), 0, Math.cos(yaw));
      up.set(Math.sin(lean) * Math.cos(yaw), Math.cos(lean), Math.sin(lean) * Math.sin(yaw));
      Vector3.CrossToRef(up, forward, right);
      right.normalize();
      Vector3.CrossToRef(right, up, forward);
      position.set(x, 0, z);
      // Kelp scales its height alone; a blade stays thin however tall it grows.
      if (this.config.kind === 'kelp') {
        const girth = rangeFrom(rng, 0.8, 1.3);
        scale.set(girth, size, girth);
      } else {
        scale.set(size, size, size);
      }
      const matrix = new Matrix();
      basisMatrixToRef(right, up, forward, position, scale, matrix);
      matrices.push(matrix);
    }
    setInstances(this.mesh, matrices);
  }

  dispose(): void {
    this.mesh.dispose();
    for (const material of this.materials) material.dispose();
  }
}

/** Small bulbs strung along the top of the tube, with the wire sagging between them. */
class LightString {
  private readonly bases: Mesh[] = [];
  private readonly materials: StandardMaterial[] = [];
  private wire: LinesMesh | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly config: LightStringConfig,
  ) {
    config.colors.forEach((color, index) => {
      const material = new StandardMaterial(`propBulb${index}`, scene);
      material.disableLighting = true;
      material.emissiveColor = color;
      this.materials.push(material);
      const bulb = CreateSphere(`propBulb${index}`, { diameter: config.size, segments: 6 }, scene);
      bulb.material = material;
      hide(bulb);
      this.bases.push(bulb);
    });
  }

  build(frames: readonly TrackFrame[]): void {
    this.wire?.dispose();
    this.wire = null;
    const perColor: Matrix[][] = this.bases.map(() => []);
    const points: Vector3[] = [];
    const position = new Vector3();
    const scale = Vector3.One();
    const step = Math.max(1, Math.round(this.config.spacing / 0.25));
    let index = 0;
    for (let i = 0; i < frames.length; i += step) {
      const frame = frames[i];
      if (!frame || frame.flags.gap || frame.flags.tunnel) continue;
      frame.up.scaleToRef(TUBE_RADIUS + this.config.lift, position).addInPlace(frame.position);
      const matrix = new Matrix();
      basisMatrixToRef(frame.right, frame.up, frame.tangent, position, scale, matrix);
      perColor[index % perColor.length]?.push(matrix);
      points.push(position.clone());
      index++;
    }
    this.bases.forEach((bulb, i) => setInstances(bulb, perColor[i] ?? []));
    // The wire: a line through the bulbs with a sag at each midpoint.
    const line: Vector3[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (!a || !b) continue;
      line.push(a);
      if (Vector3.DistanceSquared(a, b) < this.config.spacing * this.config.spacing * 4) {
        line.push(Vector3.Center(a, b).subtractFromFloats(0, this.config.spacing * 0.08, 0));
      }
    }
    if (line.length > 1) {
      this.wire = CreateLineSystem('propWire', { lines: [line] }, this.scene);
      this.wire.color = new Color3(0.2, 0.2, 0.24);
      this.wire.alpha = 0.7;
      this.wire.isPickable = false;
    }
  }

  dispose(): void {
    this.wire?.dispose();
    for (const bulb of this.bases) bulb.dispose();
    for (const material of this.materials) material.dispose();
  }
}

/** Two glowing rails either side of the tube, pulsing slowly. */
class Rails {
  private readonly left: Mesh;
  private readonly right: Mesh;
  private readonly leftMaterial: StandardMaterial;
  private readonly rightMaterial: StandardMaterial;
  private time = 0;

  constructor(
    scene: Scene,
    private readonly config: RailConfig,
  ) {
    const make = (name: string, color: Color3): [Mesh, StandardMaterial] => {
      const material = new StandardMaterial(name, scene);
      material.disableLighting = true;
      material.emissiveColor = color;
      const mesh = CreateBox(name, { width: 0.09, height: 0.09, depth: 0.52 }, scene);
      mesh.material = material;
      hide(mesh);
      return [mesh, material];
    };
    [this.left, this.leftMaterial] = make('propRailLeft', config.left);
    [this.right, this.rightMaterial] = make('propRailRight', config.right);
  }

  build(frames: readonly TrackFrame[]): void {
    const leftMatrices: Matrix[] = [];
    const rightMatrices: Matrix[] = [];
    const position = new Vector3();
    const scratch = new Vector3();
    const scale = Vector3.One();
    const offset = TUBE_RADIUS + 0.22;
    for (let i = 0; i < frames.length; i += 2) {
      const frame = frames[i];
      if (!frame || frame.flags.gap) continue;
      for (const side of [-1, 1] as const) {
        frame.right.scaleToRef(side * offset, position).addInPlace(frame.position);
        frame.up.scaleToRef(-0.3, scratch);
        position.addInPlace(scratch);
        const matrix = new Matrix();
        basisMatrixToRef(frame.right, frame.up, frame.tangent, position, scale, matrix);
        (side < 0 ? leftMatrices : rightMatrices).push(matrix);
      }
    }
    setInstances(this.left, leftMatrices);
    setInstances(this.right, rightMatrices);
  }

  update(dt: number): void {
    this.time += dt;
    const pulse = 0.82 + 0.18 * Math.sin(this.time * 1.7);
    this.config.left.scaleToRef(pulse, this.leftMaterial.emissiveColor);
    this.config.right.scaleToRef(
      0.82 + 0.18 * Math.cos(this.time * 1.3),
      this.rightMaterial.emissiveColor,
    );
  }

  dispose(): void {
    this.left.dispose();
    this.right.dispose();
    this.leftMaterial.dispose();
    this.rightMaterial.dispose();
  }
}

/** A ring of towers around the track with windows lit at random. */
class Skyline {
  private readonly mesh: Mesh;
  private readonly material: StandardMaterial;
  private readonly windows: DynamicTexture;

  constructor(
    scene: Scene,
    private readonly config: SkylineConfig,
    rng: Rng,
  ) {
    this.windows = Skyline.paintWindows(scene, config, rng);
    this.material = new StandardMaterial('propSkyline', scene);
    this.material.diffuseColor = config.body;
    this.material.specularColor = Color3.Black();
    this.material.emissiveTexture = this.windows;
    this.mesh = CreateBox('propSkyline', { size: 1 }, scene);
    this.mesh.material = this.material;
    hide(this.mesh);
  }

  private static paintWindows(scene: Scene, config: SkylineConfig, rng: Rng): DynamicTexture {
    const size = 256;
    const texture = new DynamicTexture('propWindows', { width: size, height: size }, scene, true);
    const context = texture.getContext();
    context.fillStyle = '#000';
    context.fillRect(0, 0, size, size);
    const columns = 8;
    const rows = 14;
    const cell = { w: size / columns, h: size / rows };
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const lit = rng() < 0.42;
        if (!lit) continue;
        const warm = rng() < 0.6;
        const tone = config.windows[warm ? 0 : 1].scale(0.55 + 0.45 * rng());
        context.fillStyle = `rgb(${Math.round(tone.r * 255)}, ${Math.round(tone.g * 255)}, ${Math.round(tone.b * 255)})`;
        context.fillRect(
          column * cell.w + cell.w * 0.25,
          row * cell.h + cell.h * 0.3,
          cell.w * 0.5,
          cell.h * 0.4,
        );
      }
    }
    texture.update(false);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.uScale = 2;
    texture.vScale = 5;
    return texture;
  }

  build(centre: Vector3, rng: Rng): void {
    const matrices: Matrix[] = [];
    const position = new Vector3();
    const scale = new Vector3();
    const right = new Vector3();
    const forward = new Vector3();
    const up = Vector3.Up();
    for (let i = 0; i < this.config.count; i++) {
      const angle = (i / this.config.count) * TAU + rangeFrom(rng, -0.04, 0.04);
      const distance = rangeFrom(rng, this.config.distance[0], this.config.distance[1]);
      const height = rangeFrom(rng, this.config.height[0], this.config.height[1]);
      const width = rangeFrom(rng, this.config.width[0], this.config.width[1]);
      const depth = rangeFrom(rng, this.config.width[0], this.config.width[1]);
      position.set(
        centre.x + Math.sin(angle) * distance,
        height / 2,
        centre.z + Math.cos(angle) * distance,
      );
      const yaw = rng() * TAU;
      forward.set(Math.sin(yaw), 0, Math.cos(yaw));
      Vector3.CrossToRef(up, forward, right);
      scale.set(width, height, depth);
      const matrix = new Matrix();
      basisMatrixToRef(right, up, forward, position, scale, matrix);
      matrices.push(matrix);
    }
    setInstances(this.mesh, matrices);
  }

  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
    this.windows.dispose();
  }
}

interface Fish {
  centre: Vector3;
  radius: number;
  rate: number;
  phase: number;
  offset: Vector3;
  size: number;
}

/** Schools of small fish circling spots near the track. */
class Swimmers {
  private readonly mesh: Mesh;
  private readonly material: StandardMaterial;
  private readonly fish: Fish[] = [];
  private readonly buffer: Float32Array;
  private readonly matrix = new Matrix();
  private readonly position = new Vector3();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly scale = new Vector3();
  private time = 0;

  constructor(scene: Scene, config: SwimmerConfig, frames: readonly TrackFrame[], rng: Rng) {
    this.material = new StandardMaterial('propFish', scene);
    this.material.diffuseColor = config.color;
    this.material.emissiveColor = config.glow;
    this.material.specularColor = new Color3(0.4, 0.5, 0.5);
    this.mesh = CreateSphere('propFish', { diameter: 1, segments: 6 }, scene);
    this.mesh.material = this.material;
    hide(this.mesh);
    for (let school = 0; school < config.schools; school++) {
      const frame = frames[Math.floor(rng() * frames.length)];
      const anchor = frame?.position ?? Vector3.Zero();
      const centre = new Vector3(
        anchor.x + rangeFrom(rng, -16, 16),
        Math.max(3, anchor.y + rangeFrom(rng, 2, 9)),
        anchor.z + rangeFrom(rng, -16, 16),
      );
      const radius = rangeFrom(rng, 5, 9);
      const rate = rangeFrom(rng, 0.25, 0.45) * (rng() < 0.5 ? -1 : 1);
      const phase = rng() * TAU;
      for (let i = 0; i < config.perSchool; i++) {
        this.fish.push({
          centre,
          radius,
          rate,
          phase: phase + rangeFrom(rng, -0.35, 0.35),
          offset: new Vector3(
            rangeFrom(rng, -1.5, 1.5),
            rangeFrom(rng, -0.8, 0.8),
            rangeFrom(rng, -1.5, 1.5),
          ),
          size: rangeFrom(rng, 0.7, 1.2),
        });
      }
    }
    this.buffer = new Float32Array(this.fish.length * 16);
    this.update(0);
    this.mesh.isVisible = this.fish.length > 0;
  }

  update(dt: number): void {
    this.time += dt;
    this.fish.forEach((fish, index) => {
      const a = this.time * fish.rate + fish.phase;
      const r = fish.radius;
      this.position.set(
        fish.centre.x + Math.cos(a) * r + fish.offset.x,
        fish.centre.y + Math.sin(a * 2) * 0.6 + fish.offset.y,
        fish.centre.z + Math.sin(a) * r + fish.offset.z,
      );
      this.forward.set(-Math.sin(a) * r, Math.cos(a * 2) * 1.2, Math.cos(a) * r);
      if (fish.rate < 0) this.forward.scaleInPlace(-1);
      this.forward.normalize();
      this.up.set(0, 1, 0);
      Vector3.CrossToRef(this.up, this.forward, this.right);
      this.right.normalize();
      Vector3.CrossToRef(this.forward, this.right, this.up);
      const wag = 1 + 0.12 * Math.sin(this.time * 9 + fish.phase * 3);
      this.scale.set(0.16 * fish.size, 0.26 * fish.size, 0.7 * fish.size * wag);
      basisMatrixToRef(this.right, this.up, this.forward, this.position, this.scale, this.matrix);
      this.matrix.copyToArray(this.buffer, index * 16);
    });
    if (this.fish.length > 0) this.mesh.thinInstanceSetBuffer('matrix', this.buffer, 16, false);
  }

  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
  }
}

/**
 * Everything a theme scatters around the track. Built from the compiled frames so track-hugging
 * props (lights, rails) follow every edit, and seeded so the same theme always looks the same.
 */
export class Props {
  private readonly weather: Weather | null;
  private readonly scatter: Scatter[] = [];
  private readonly lights: LightString | null;
  private readonly rails: Rails | null;
  private readonly skyline: Skyline | null;
  private swimmers: Swimmers | null = null;
  private readonly config: PropConfig;

  constructor(
    private readonly scene: Scene,
    config: PropConfig | undefined,
    compiled: CompiledTrack,
  ) {
    this.config = config ?? {};
    this.weather = this.config.weather ? new Weather(scene, this.config.weather) : null;
    for (const spec of this.config.scatter ?? []) this.scatter.push(new Scatter(scene, spec));
    this.lights = this.config.lights ? new LightString(scene, this.config.lights) : null;
    this.rails = this.config.rails ? new Rails(scene, this.config.rails) : null;
    this.skyline = this.config.skyline
      ? new Skyline(scene, this.config.skyline, createRng(PROP_SEED + 7))
      : null;
    this.rebuild(compiled);
  }

  /** Lays the props out again for a reshaped track. */
  rebuild(compiled: CompiledTrack): void {
    const frames = compiled.frames;
    const rng = createRng(PROP_SEED);
    for (const scatter of this.scatter) scatter.build(frames, rng);
    this.lights?.build(frames);
    this.rails?.build(frames);
    this.skyline?.build(footprint(frames).centre, createRng(PROP_SEED + 3));
    this.swimmers?.dispose();
    this.swimmers = this.config.swimmers
      ? new Swimmers(this.scene, this.config.swimmers, frames, createRng(PROP_SEED + 11))
      : null;
  }

  update(dt: number, cameraPosition: Vector3): void {
    this.weather?.update(cameraPosition);
    this.rails?.update(dt);
    this.swimmers?.update(dt);
  }

  dispose(): void {
    this.weather?.dispose();
    for (const scatter of this.scatter) scatter.dispose();
    this.lights?.dispose();
    this.rails?.dispose();
    this.skyline?.dispose();
    this.swimmers?.dispose();
  }
}
