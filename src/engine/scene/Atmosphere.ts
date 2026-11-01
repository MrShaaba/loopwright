import type { Camera } from '@babylonjs/core/Cameras/camera';
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import { Scene } from '@babylonjs/core/scene';
import type { FogConfig, LightingConfig } from '../theme/ThemeConfig';
import { createRng, rangeFrom } from '../util/random';
import { createSoftDiscTexture } from './textures';

export interface AtmosphereOptions {
  fog: FogConfig;
  lighting: LightingConfig;
  cameras: Camera[];
  /** Park half-size in metres; mist is spawned across this square. */
  halfSize: number;
  seed: number;
  heightAt: (x: number, z: number) => number;
  glowExcluded: Mesh[];
}

/** Fog, ground mist, glow and the post-processing stack. */
export class Atmosphere {
  readonly glow: GlowLayer;
  readonly pipeline: DefaultRenderingPipeline;
  readonly mist: ParticleSystem | null;

  constructor(
    private readonly scene: Scene,
    options: AtmosphereOptions,
  ) {
    const { fog, lighting } = options;
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = fog.color;
    scene.fogDensity = fog.density;
    scene.clearColor = new Color4(fog.color.r, fog.color.g, fog.color.b, 1);

    this.glow = new GlowLayer('glow', scene, { blurKernelSize: 48, mainTextureRatio: 0.5 });
    this.glow.intensity = lighting.glow;
    for (const mesh of options.glowExcluded) this.glow.addExcludedMesh(mesh);

    const imageProcessing = scene.imageProcessingConfiguration;
    imageProcessing.toneMappingEnabled = true;
    imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    imageProcessing.exposure = lighting.exposure;
    imageProcessing.contrast = lighting.contrast;
    imageProcessing.vignetteEnabled = lighting.vignette > 0;
    imageProcessing.vignetteWeight = lighting.vignette;
    imageProcessing.vignetteStretch = 0.5;
    imageProcessing.vignetteColor = new Color4(0.01, 0.01, 0.03, 0);

    this.pipeline = new DefaultRenderingPipeline('pipeline', true, scene, options.cameras);
    // MSAA on the HDR target costs a quarter of the frame on integrated GPUs; FXAA alone reads fine.
    this.pipeline.samples = 1;
    this.pipeline.fxaaEnabled = true;
    this.pipeline.bloomEnabled = false;
    this.pipeline.imageProcessingEnabled = true;

    this.mist = fog.mist ? this.buildMist(options) : null;
  }

  private buildMist(options: AtmosphereOptions): ParticleSystem {
    const mist = options.fog.mist;
    if (!mist) throw new Error('Mist config missing');
    const { halfSize, heightAt } = options;
    const rng = createRng(options.seed + 99);

    const system = new ParticleSystem('mist', mist.count, this.scene);
    system.particleTexture = createSoftDiscTexture(this.scene, 'mistSprite', 128);
    system.emitter = Vector3.Zero();
    system.startPositionFunction = (_world, position) => {
      const x = rangeFrom(rng, -halfSize, halfSize);
      const z = rangeFrom(rng, -halfSize, halfSize);
      position.set(x, heightAt(x, z) + rangeFrom(rng, 0.3, 1.8), z);
    };
    system.direction1 = new Vector3(-1, 0, -0.4);
    system.direction2 = new Vector3(1, 0.04, 0.7);
    system.minEmitPower = 0.15;
    system.maxEmitPower = 0.55;
    system.gravity = Vector3.Zero();
    system.minSize = 22;
    system.maxSize = 46;
    system.minLifeTime = 16;
    system.maxLifeTime = 30;
    system.emitRate = mist.count / 24;
    system.minAngularSpeed = -0.04;
    system.maxAngularSpeed = 0.04;
    system.minInitialRotation = 0;
    system.maxInitialRotation = Math.PI * 2;
    system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    system.applyFog = true;

    const c = mist.color;
    const full = new Color4(c.r, c.g, c.b, mist.alpha);
    const faint = new Color4(c.r, c.g, c.b, mist.alpha * 0.6);
    const clear = new Color4(c.r, c.g, c.b, 0);
    system.addColorGradient(0, clear);
    system.addColorGradient(0.25, full, faint);
    system.addColorGradient(0.75, full, faint);
    system.addColorGradient(1, clear);

    system.preWarmCycles = 260;
    system.preWarmStepOffset = 6;
    system.start();
    return system;
  }

  dispose(): void {
    this.mist?.dispose();
    this.pipeline.dispose();
    this.glow.dispose();
  }
}
