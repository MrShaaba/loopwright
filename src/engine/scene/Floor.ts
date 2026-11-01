import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { BallStyle, FloorConfig, FogConfig } from '../theme/ThemeConfig';

const FLOOR_SIZE = 1600;

const vertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vWorld;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = viewProjection * w;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform vec3 cameraPosition;
uniform vec3 baseColor;
uniform vec3 gridColor;
uniform float gridSpacing;
uniform float gridStrength;
uniform vec3 ballPos;
uniform vec3 ballColor;
uniform float ballLight;
uniform vec3 fogColor;
uniform float fogDensity;

void main(void) {
  vec2 g = vWorld.xz / gridSpacing;
  vec2 f = abs(fract(g - 0.5) - 0.5) / max(fwidth(g), vec2(1e-4));
  float line = 1.0 - min(min(f.x, f.y), 1.0);
  float dist = distance(cameraPosition, vWorld);
  float fade = exp(-dist * 0.009);
  vec3 col = baseColor + gridColor * line * gridStrength * fade;

  // Light from the ball, falling off with distance, so the floor glows under the ride.
  vec3 toBall = ballPos - vWorld;
  float d2 = dot(toBall, toBall);
  col += ballColor * (ballLight * 0.1) / (1.0 + d2 * 0.18);

  float fog = exp(-pow(dist * fogDensity, 2.0));
  col = mix(fogColor, col, fog);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** A flat floor at y = 0 with an anti-aliased grid that fades into the fog. */
export class Floor {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor(scene: Scene, config: FloorConfig, fog: FogConfig, ball: BallStyle) {
    this.mesh = CreateGround('floor', { width: FLOOR_SIZE, height: FLOOR_SIZE }, scene);
    this.mesh.isPickable = false;
    this.mesh.freezeWorldMatrix();
    this.material = new ShaderMaterial(
      'floorMaterial',
      scene,
      { vertexSource: vertexShader, fragmentSource: fragmentShader },
      {
        attributes: ['position'],
        uniforms: [
          'world',
          'viewProjection',
          'cameraPosition',
          'baseColor',
          'gridColor',
          'gridSpacing',
          'gridStrength',
          'ballPos',
          'ballColor',
          'ballLight',
          'fogColor',
          'fogDensity',
        ],
      },
    );
    this.material.backFaceCulling = false;
    this.material.setVector3('ballPos', new Vector3(0, -100, 0));
    this.restyle(config, fog, ball);
    this.mesh.material = this.material;
  }

  restyle(config: FloorConfig, fog: FogConfig, ball: BallStyle): void {
    this.material.setColor3('baseColor', config.color);
    this.material.setColor3('gridColor', config.grid?.color ?? Color3.Black());
    this.material.setFloat('gridSpacing', config.grid?.spacing ?? 6);
    this.material.setFloat('gridStrength', config.grid?.strength ?? 0);
    this.material.setColor3('ballColor', ball.color);
    this.material.setFloat('ballLight', ball.light);
    this.material.setColor3('fogColor', fog.color);
    this.material.setFloat('fogDensity', fog.density);
  }

  setBallPosition(position: Vector3): void {
    this.material.setVector3('ballPos', position);
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.dispose();
  }
}
