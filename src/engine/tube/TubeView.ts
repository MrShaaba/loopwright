import { Constants } from '@babylonjs/core/Engines/constants';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { FogConfig, TubeStyle } from '../theme/ThemeConfig';
import type { CompiledTrack, SectionRange } from '../track/Track';
import type { TrackFrame } from '../track/types';
import { clamp, TAU } from '../util/math';
import { tubeFragmentShader, tubeVertexShader } from './tubeShader';

export const TUBE_RADIUS = 1.5;
const TUNNEL_RADIUS = 2.1;
const SEGMENTS = 20;
/** Frames per tube ring (frames are 0.25 m apart). */
const RING_STRIDE = 2;
const LIGHT_RING_TARGET = 6;
const DASH_TARGET = 8;
const SUPPORT_SPACING = 8;
const MIN_SUPPORT_HEIGHT = 1;
/** Speed at which the streaks reach full strength, m/s. */
const STREAK_FULL_SPEED = 34;

interface Run {
  start: number;
  end: number;
  gap: boolean;
  tunnel: boolean;
}

/** Writes a world matrix whose axes are the given right, up and forward vectors. */
export function basisMatrixToRef(
  right: Vector3,
  up: Vector3,
  forward: Vector3,
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
    forward.x * scale.z,
    forward.y * scale.z,
    forward.z * scale.z,
    0,
    position.x,
    position.y,
    position.z,
    1,
    out,
  );
  return out;
}

/** Splits the loop into runs of frames that share the same gap and tunnel flags. */
export function splitRuns(frames: readonly TrackFrame[]): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;
  frames.forEach((frame, index) => {
    const gap = frame.flags.gap === true;
    const tunnel = frame.flags.tunnel === true;
    if (current?.gap === gap && current.tunnel === tunnel) {
      current.end = index;
      return;
    }
    current = { start: index, end: index, gap, tunnel };
    runs.push(current);
  });
  return runs;
}

/** The glass tube, its light rings, supports and tunnel shells, all generated from the frames. */
export class TubeView {
  readonly glass: ShaderMaterial;
  private readonly ringMaterial: StandardMaterial;
  private readonly supportMaterial: StandardMaterial;
  private readonly tunnelMaterial: StandardMaterial;
  private readonly ringBase: Mesh;
  private readonly supportBase: Mesh;
  private readonly footBase: Mesh;
  private meshes: Mesh[] = [];
  private time = 0;
  private scroll = 0;
  private length = 1;

  constructor(
    private readonly scene: Scene,
    style: TubeStyle,
    fog: FogConfig,
  ) {
    this.glass = new ShaderMaterial(
      'tubeGlass',
      scene,
      { vertexSource: tubeVertexShader, fragmentSource: tubeFragmentShader },
      {
        attributes: ['position', 'normal', 'uv'],
        uniforms: [
          'world',
          'viewProjection',
          'cameraPosition',
          'tint',
          'edgeColor',
          'streakColor',
          'ballPos',
          'ballColor',
          'time',
          'scroll',
          'speedFactor',
          'ringSpacing',
          'dashSpacing',
          'intensity',
          'highlight',
          'highlightOn',
          'fogColor',
          'fogDensity',
        ],
        needAlphaBlending: true,
      },
    );
    this.glass.backFaceCulling = false;
    this.glass.disableDepthWrite = true;
    this.glass.alphaMode = Constants.ALPHA_ADD;
    this.glass.setVector3('ballPos', new Vector3(0, -100, 0));
    this.glass.setColor3('ballColor', Color3.White());
    this.glass.setFloat('time', 0);
    this.glass.setFloat('scroll', 0);
    this.glass.setFloat('speedFactor', 0);
    this.glass.setFloat('ringSpacing', LIGHT_RING_TARGET);
    this.glass.setFloat('dashSpacing', DASH_TARGET);
    this.glass.setVector2('highlight', new Vector2(0, 0));
    this.glass.setFloat('highlightOn', 0);

    this.ringMaterial = new StandardMaterial('tubeRing', scene);
    this.ringMaterial.disableLighting = true;
    this.supportMaterial = new StandardMaterial('tubeSupport', scene);
    this.supportMaterial.specularColor = new Color3(0.08, 0.08, 0.1);
    this.tunnelMaterial = new StandardMaterial('tubeTunnel', scene);
    this.tunnelMaterial.backFaceCulling = false;
    this.tunnelMaterial.twoSidedLighting = true;
    this.tunnelMaterial.specularColor = new Color3(0.05, 0.05, 0.06);

    this.ringBase = CreateTorus(
      'tubeRingBase',
      { diameter: TUBE_RADIUS * 2 + 0.08, thickness: 0.05, tessellation: 36 },
      scene,
    );
    this.supportBase = CreateCylinder(
      'tubeSupportBase',
      { height: 1, diameter: 0.16, tessellation: 10 },
      scene,
    );
    this.footBase = CreateCylinder(
      'tubeFootBase',
      { height: 0.08, diameter: 0.7, tessellation: 16 },
      scene,
    );
    this.ringBase.material = this.ringMaterial;
    this.supportBase.material = this.supportMaterial;
    this.footBase.material = this.supportMaterial;
    for (const base of [this.ringBase, this.supportBase, this.footBase]) {
      base.isVisible = false;
      base.isPickable = false;
    }
    this.restyle(style, fog);
  }

  restyle(style: TubeStyle, fog: FogConfig): void {
    this.glass.setColor3('tint', style.tint);
    this.glass.setColor3('edgeColor', style.edge);
    this.glass.setColor3('streakColor', style.streak);
    this.glass.setFloat('intensity', style.intensity);
    this.glass.setColor3('fogColor', fog.color);
    this.glass.setFloat('fogDensity', fog.density);
    this.ringMaterial.emissiveColor = style.edge.scale(0.85);
    this.supportMaterial.diffuseColor = style.support;
    this.supportMaterial.emissiveColor = style.support.scale(0.12);
    this.tunnelMaterial.diffuseColor = style.tunnel.scale(2.2);
    this.tunnelMaterial.emissiveColor = style.tunnel.scale(0.35);
  }

  /** Meshes a click can land on; each carries the frames it was built from. */
  get pickables(): readonly Mesh[] {
    return this.meshes.filter((mesh) => mesh.isPickable);
  }

  setBall(position: Vector3, color: Color3): void {
    this.glass.setVector3('ballPos', position);
    this.glass.setColor3('ballColor', color);
  }

  /** Highlights the tube between two arc lengths, or clears the highlight. */
  setHighlight(range: SectionRange | null): void {
    if (range) {
      this.glass.setVector2('highlight', new Vector2(range.s0 - 0.125, range.s1 + 0.125));
      this.glass.setFloat('highlightOn', 1);
    } else {
      this.glass.setFloat('highlightOn', 0);
    }
  }

  /** Advances the streaks and time. `speed` is the ball's effective speed in m/s. */
  update(dt: number, speed: number, reducedMotion: boolean): void {
    this.time += dt;
    const factor = clamp(speed / STREAK_FULL_SPEED, 0, 1);
    const strength = reducedMotion ? factor * 0.35 : factor;
    // Streaks scroll towards the camera a little faster than the ball moves.
    this.scroll = (this.scroll + speed * dt * (reducedMotion ? 0.3 : 0.9)) % this.length;
    this.glass.setFloat('time', this.time);
    this.glass.setFloat('scroll', this.scroll);
    this.glass.setFloat('speedFactor', strength * strength);
  }

  rebuild(track: CompiledTrack): void {
    this.clear();
    const frames = track.frames;
    if (frames.length < 4) {
      this.ringBase.isVisible = false;
      this.supportBase.isVisible = false;
      this.footBase.isVisible = false;
      return;
    }
    this.length = Math.max(track.length, 1);
    const ringSpacing = this.length / Math.max(1, Math.round(this.length / LIGHT_RING_TARGET));
    const dashSpacing = this.length / Math.max(1, Math.round(this.length / DASH_TARGET));
    this.glass.setFloat('ringSpacing', ringSpacing);
    this.glass.setFloat('dashSpacing', dashSpacing);

    const runs = splitRuns(frames);
    const closedWithoutBreaks = runs.length === 1;
    for (const run of runs) {
      if (run.gap) continue;
      const glass = this.buildRun(frames, run, TUBE_RADIUS, closedWithoutBreaks);
      glass.material = this.glass;
      glass.isPickable = true;
      glass.name = 'tubeGlass';
      this.meshes.push(glass);
      if (run.tunnel) {
        const shell = this.buildRun(frames, run, TUNNEL_RADIUS, closedWithoutBreaks);
        shell.material = this.tunnelMaterial;
        shell.isPickable = false;
        shell.name = 'tubeTunnel';
        this.meshes.push(shell);
      }
    }
    this.placeRings(frames, ringSpacing);
    this.placeSupports(frames);
  }

  private buildRun(
    frames: readonly TrackFrame[],
    run: Run,
    radius: number,
    closeLoop: boolean,
  ): Mesh {
    const indices: number[] = [];
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const ringFrames: { frame: TrackFrame; s: number }[] = [];
    for (let i = run.start; i <= run.end; i += RING_STRIDE) {
      const frame = frames[i];
      if (frame) ringFrames.push({ frame, s: frame.s });
    }
    const last = frames[run.end];
    if (last && (run.end - run.start) % RING_STRIDE !== 0)
      ringFrames.push({ frame: last, s: last.s });
    if (closeLoop) {
      const first = frames[0];
      if (first) ringFrames.push({ frame: first, s: this.length });
    }

    const radial = new Vector3();
    ringFrames.forEach(({ frame, s }) => {
      for (let j = 0; j <= SEGMENTS; j++) {
        const theta = (j / SEGMENTS) * TAU;
        const c = Math.cos(theta);
        const sn = Math.sin(theta);
        radial.set(
          frame.right.x * c + frame.up.x * sn,
          frame.right.y * c + frame.up.y * sn,
          frame.right.z * c + frame.up.z * sn,
        );
        positions.push(
          frame.position.x + radial.x * radius,
          frame.position.y + radial.y * radius,
          frame.position.z + radial.z * radius,
        );
        normals.push(radial.x, radial.y, radial.z);
        uvs.push(j / SEGMENTS, s);
      }
    });
    const stride = SEGMENTS + 1;
    for (let k = 0; k < ringFrames.length - 1; k++) {
      for (let j = 0; j < SEGMENTS; j++) {
        const a = k * stride + j;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const mesh = new Mesh('tubeRun', this.scene);
    const data = new VertexData();
    data.positions = positions;
    data.normals = normals;
    data.uvs = uvs;
    data.indices = indices;
    data.applyToMesh(mesh, false);
    mesh.freezeWorldMatrix();
    return mesh;
  }

  private placeRings(frames: readonly TrackFrame[], spacing: number): void {
    const count = Math.max(1, Math.round(this.length / spacing));
    const buffer = new Float32Array(count * 16);
    const matrix = new Matrix();
    const scale = Vector3.One();
    const axis = new Vector3();
    let placed = 0;
    for (let k = 0; k < count; k++) {
      const index = Math.min(frames.length - 1, Math.round((k * spacing) / 0.25));
      const frame = frames[index];
      if (!frame || frame.flags.gap) continue;
      // A torus lies in its local XZ plane, so its local Y must be the tangent.
      frame.up.scaleToRef(-1, axis);
      basisMatrixToRef(frame.right, frame.tangent, axis, frame.position, scale, matrix);
      matrix.copyToArray(buffer, placed * 16);
      placed++;
    }
    this.ringBase.thinInstanceSetBuffer('matrix', buffer.subarray(0, placed * 16), 16, true);
    this.ringBase.isVisible = placed > 0;
    if (placed > 0) this.ringBase.thinInstanceRefreshBoundingInfo();
  }

  private placeSupports(frames: readonly TrackFrame[]): void {
    const every = Math.round(SUPPORT_SPACING / 0.25);
    const candidates = Math.floor(frames.length / every) + 1;
    const supports = new Float32Array(candidates * 16);
    const feet = new Float32Array(candidates * 16);
    const matrix = new Matrix();
    const scale = new Vector3();
    const position = new Vector3();
    const identity = Quaternion.Identity();
    let placed = 0;
    for (let i = 0; i < frames.length; i += every) {
      const frame = frames[i];
      if (!frame || frame.flags.gap || frame.up.y < 0.3) continue;
      const top = frame.position.y - TUBE_RADIUS - 0.02;
      const height = top;
      if (height < MIN_SUPPORT_HEIGHT) continue;
      scale.set(1, height, 1);
      position.set(frame.position.x, height / 2, frame.position.z);
      Matrix.ComposeToRef(scale, identity, position, matrix);
      matrix.copyToArray(supports, placed * 16);
      scale.set(1, 1, 1);
      position.set(frame.position.x, 0.04, frame.position.z);
      Matrix.ComposeToRef(scale, identity, position, matrix);
      matrix.copyToArray(feet, placed * 16);
      placed++;
    }
    this.supportBase.thinInstanceSetBuffer('matrix', supports.subarray(0, placed * 16), 16, true);
    this.footBase.thinInstanceSetBuffer('matrix', feet.subarray(0, placed * 16), 16, true);
    this.supportBase.isVisible = placed > 0;
    this.footBase.isVisible = placed > 0;
    if (placed > 0) {
      this.supportBase.thinInstanceRefreshBoundingInfo();
      this.footBase.thinInstanceRefreshBoundingInfo();
    }
  }

  private clear(): void {
    for (const mesh of this.meshes) mesh.dispose();
    this.meshes = [];
  }

  dispose(): void {
    this.clear();
    for (const base of [this.ringBase, this.supportBase, this.footBase]) base.dispose();
    this.glass.dispose();
    this.ringMaterial.dispose();
    this.supportMaterial.dispose();
    this.tunnelMaterial.dispose();
  }
}
