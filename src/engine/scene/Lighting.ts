import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { LightingConfig } from '../theme/ThemeConfig';
import { directionFromAngles } from './Sky';

/** Moonlight with cascaded shadows and a dim hemispheric fill. */
export class Lighting {
  readonly key: DirectionalLight;
  readonly fill: HemisphericLight;
  readonly shadows: CascadedShadowGenerator | null;
  /** Unit vector pointing from the park towards the key light. */
  readonly keyDirection: Vector3;

  constructor(scene: Scene, config: LightingConfig) {
    this.keyDirection = directionFromAngles(config.key.azimuthDeg, config.key.elevationDeg);
    this.key = new DirectionalLight('moonlight', this.keyDirection.negate(), scene);
    this.key.position = this.keyDirection.scale(300);
    this.key.diffuse = config.key.color;
    this.key.specular = config.key.color.scale(0.6);
    this.key.intensity = config.key.intensity;

    this.fill = new HemisphericLight('fill', Vector3.Up(), scene);
    this.fill.diffuse = config.fill.sky;
    this.fill.groundColor = config.fill.ground;
    this.fill.specular = Color3.Black();
    this.fill.intensity = config.fill.intensity;

    if (config.key.shadows) {
      const shadows = new CascadedShadowGenerator(2048, this.key);
      shadows.numCascades = 3;
      shadows.lambda = 0.85;
      shadows.shadowMaxZ = 260;
      shadows.stabilizeCascades = true;
      shadows.depthClamp = true;
      shadows.cascadeBlendPercentage = 0.12;
      shadows.filter = ShadowGenerator.FILTER_PCF;
      shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      shadows.bias = 0.004;
      shadows.normalBias = 0.03;
      this.shadows = shadows;
    } else {
      this.shadows = null;
    }
  }

  addCaster(mesh: AbstractMesh): void {
    this.shadows?.addShadowCaster(mesh, true);
  }

  dispose(): void {
    this.shadows?.dispose();
    this.key.dispose();
    this.fill.dispose();
  }
}
