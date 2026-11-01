import { Constants } from '@babylonjs/core/Engines/constants';
import { Material } from '@babylonjs/core/Materials/material';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { MoonSpec, SkyConfig } from '../theme/ThemeConfig';
import { DEG } from '../util/math';
import { createGlowTexture, createMoonTexture } from './textures';

const SKY_RADIUS = 900;
const MOON_DISTANCE = 820;

const vertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main(void) {
  vDir = position;
  vec4 clip = worldViewProjection * vec4(position, 1.0);
  gl_Position = clip.xyww;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 horizonColor;
uniform vec3 bandColor;
uniform vec3 zenithColor;
uniform vec3 moonDir;
uniform vec3 moonGlowColor;
uniform float starDensity;
uniform float time;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z);
}

void main(void) {
  vec3 d = normalize(vDir);
  float h = d.y;

  vec3 col = mix(horizonColor, bandColor, smoothstep(-0.03, 0.14, h));
  col = mix(col, zenithColor, smoothstep(0.09, 0.62, h));

  // Low haze that drifts slowly, keeps the horizon from reading as a flat gradient.
  float haze = noise3(d * 6.0 + vec3(time * 0.012, 0.0, 0.0)) * 0.6 + noise3(d * 15.0) * 0.4;
  col += bandColor * haze * 0.45 * (1.0 - smoothstep(0.0, 0.32, h)) * step(0.0, h);

  // A faint galactic band across the sky.
  vec3 bandNormal = normalize(vec3(0.32, 0.58, 0.75));
  float band = exp(-pow(dot(d, bandNormal) * 5.0, 2.0));
  float bandNoise = noise3(d * 9.0) * 0.55 + noise3(d * 24.0) * 0.45;
  col += vec3(0.15, 0.16, 0.26) * band * bandNoise * smoothstep(0.0, 0.2, h);

  // Atmospheric glow around the moon.
  float m = max(dot(d, moonDir), 0.0);
  col += moonGlowColor * (pow(m, 64.0) * 0.5 + pow(m, 12.0) * 0.1 + pow(m, 3.0) * 0.025);

  // Stars: one candidate per 3D cell on the dome.
  if (h > 0.0) {
    vec3 cellP = d * 90.0;
    vec3 cell = floor(cellP);
    float r = hash13(cell);
    if (r > 1.0 - starDensity) {
      vec3 jitter = vec3(hash13(cell + 1.7), hash13(cell + 3.1), hash13(cell + 5.3)) * 0.5 - 0.25;
      vec3 centre = cell + 0.5 + jitter;
      float dist = length(cellP - centre);
      float star = smoothstep(0.34, 0.03, dist);
      float twinkle = 0.72 + 0.28 * sin(time * (1.3 + 3.0 * hash13(cell + 9.0)) + r * 60.0);
      float magnitude = 0.4 + 1.2 * hash13(cell + 11.0);
      float nearMoon = 1.0 - pow(m, 6.0) * 0.85;
      col += vec3(0.8, 0.86, 1.0) * star * twinkle * magnitude * smoothstep(0.0, 0.18, h) * nearMoon;
    }
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

export function directionFromAngles(azimuthDeg: number, elevationDeg: number): Vector3 {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/** Procedural night sky: gradient dome with stars and haze, plus one disc and halo per moon. */
export class Sky {
  readonly dome: Mesh;
  readonly moons: Mesh[] = [];
  /** Meshes the glow layer must skip, otherwise the moon blooms out into a blob. */
  readonly glowExcluded: Mesh[] = [];
  private readonly material: ShaderMaterial;
  private time = 0;

  constructor(
    private readonly scene: Scene,
    config: SkyConfig,
  ) {
    this.dome = CreateSphere(
      'skyDome',
      { diameter: SKY_RADIUS * 2, segments: 24, sideOrientation: Mesh.BACKSIDE },
      scene,
    );
    this.dome.infiniteDistance = true;
    this.dome.isPickable = false;
    this.dome.applyFog = false;
    this.dome.alwaysSelectAsActiveMesh = true;

    this.material = new ShaderMaterial(
      'skyMaterial',
      scene,
      { vertexSource: vertexShader, fragmentSource: fragmentShader },
      {
        attributes: ['position'],
        uniforms: [
          'worldViewProjection',
          'horizonColor',
          'bandColor',
          'zenithColor',
          'moonDir',
          'moonGlowColor',
          'starDensity',
          'time',
        ],
      },
    );
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;
    this.material.setColor3('horizonColor', config.horizon);
    this.material.setColor3('bandColor', config.band);
    this.material.setColor3('zenithColor', config.zenith);
    this.material.setFloat('starDensity', config.starDensity);
    this.material.setFloat('time', 0);
    const keyMoon = config.moons[0];
    this.material.setVector3(
      'moonDir',
      keyMoon ? directionFromAngles(keyMoon.azimuthDeg, keyMoon.elevationDeg) : Vector3.Up(),
    );
    this.material.setColor3('moonGlowColor', keyMoon ? keyMoon.glow : Color3.Black());
    this.dome.material = this.material;

    config.moons.forEach((moon, index) => this.buildMoon(moon, index));
  }

  private buildMoon(spec: MoonSpec, index: number): void {
    const direction = directionFromAngles(spec.azimuthDeg, spec.elevationDeg);
    const radius = MOON_DISTANCE * Math.tan((spec.angularSizeDeg / 2) * DEG);

    const disc = CreateDisc(`moon${index}`, { radius, tessellation: 64 }, this.scene);
    disc.position = direction.scale(MOON_DISTANCE);
    disc.infiniteDistance = true;
    disc.billboardMode = Mesh.BILLBOARDMODE_ALL;
    disc.isPickable = false;
    disc.applyFog = false;
    disc.alwaysSelectAsActiveMesh = true;
    const discMaterial = new StandardMaterial(`moonMaterial${index}`, this.scene);
    discMaterial.disableLighting = true;
    discMaterial.diffuseColor = Color3.Black();
    // StandardMaterial adds emissiveColor to the texture, so keep the colour black and push
    // the texture level above 1 instead: the disc stays luminous after tone mapping and keeps its seas.
    discMaterial.emissiveColor = Color3.Black();
    const moonTexture = createMoonTexture(
      this.scene,
      `moonTexture${index}`,
      512,
      index * 31 + 5,
      spec.tint,
    );
    moonTexture.level = 1.45;
    discMaterial.emissiveTexture = moonTexture;
    discMaterial.fogEnabled = false;
    disc.material = discMaterial;

    const halo = CreatePlane(`moonHalo${index}`, { size: radius * 5 }, this.scene);
    halo.position = direction.scale(MOON_DISTANCE + 20);
    halo.infiniteDistance = true;
    halo.billboardMode = Mesh.BILLBOARDMODE_ALL;
    halo.isPickable = false;
    halo.applyFog = false;
    halo.alwaysSelectAsActiveMesh = true;
    const haloMaterial = new StandardMaterial(`moonHaloMaterial${index}`, this.scene);
    haloMaterial.disableLighting = true;
    haloMaterial.diffuseColor = Color3.Black();
    haloMaterial.emissiveTexture = createGlowTexture(
      this.scene,
      `moonHaloTexture${index}`,
      256,
      spec.glow.scale(0.4),
    );
    haloMaterial.opacityTexture = haloMaterial.emissiveTexture;
    haloMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;
    haloMaterial.alphaMode = Constants.ALPHA_ADD;
    haloMaterial.fogEnabled = false;
    halo.material = haloMaterial;

    this.moons.push(disc, halo);
    this.glowExcluded.push(disc, halo);
  }

  update(dt: number): void {
    this.time += dt;
    this.material.setFloat('time', this.time);
  }

  dispose(): void {
    for (const mesh of this.moons) {
      mesh.material?.dispose(true, true);
      mesh.dispose();
    }
    this.material.dispose();
    this.dome.dispose();
  }
}
