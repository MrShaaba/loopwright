import type { Camera } from '@babylonjs/core/Cameras/camera';
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import { Scene } from '@babylonjs/core/scene';
import type { FogConfig, LightingConfig } from '../theme/ThemeConfig';

export interface AtmosphereOptions {
  fog: FogConfig;
  lighting: LightingConfig;
  cameras: Camera[];
  glowExcluded: Mesh[];
}

/** Fog, glow and the post-processing stack. */
export class Atmosphere {
  readonly glow: GlowLayer;
  readonly pipeline: DefaultRenderingPipeline;

  constructor(scene: Scene, options: AtmosphereOptions) {
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
  }

  dispose(): void {
    this.pipeline.dispose();
    this.glow.dispose();
  }
}
