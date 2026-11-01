import { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateScreenshotAsync } from '@babylonjs/core/Misc/screenshotTools';
import { Scene } from '@babylonjs/core/scene';
import { CameraRig, type CameraMode, type CameraPreset } from './camera/CameraRig';
import { Emitter } from './events';
import { KeyRegistry, type KeyBinding } from './input/Keys';
import { Atmosphere } from './scene/Atmosphere';
import { Lighting } from './scene/Lighting';
import { PerformanceGovernor, type PerformanceSample } from './scene/Performance';
import { Sky } from './scene/Sky';
import { Terrain } from './scene/Terrain';
import type { ThemeConfig } from './theme/ThemeConfig';
import { DEG } from './util/math';

export type GameMode = 'build' | 'ride';

export interface LoadProgress {
  step: string;
  fraction: number;
}

export interface GameEvents {
  performance: PerformanceSample;
  cameraMode: CameraMode;
  mode: GameMode;
  toast: string;
}

interface GameParts {
  canvas: HTMLCanvasElement;
  engine: Engine;
  scene: Scene;
  theme: ThemeConfig;
  terrain: Terrain;
  sky: Sky;
  lighting: Lighting;
  cameras: CameraRig;
  atmosphere: Atmosphere;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function buildPresets(theme: ThemeConfig): CameraPreset[] {
  // ArcRotateCamera sits at target + radius * (cos a sin b, cos b, sin a sin b),
  // so this alpha puts the camera opposite the moon, looking towards it.
  const az = theme.lighting.key.azimuthDeg * DEG;
  const towardMoon = Math.atan2(-Math.sin(az), -Math.cos(az));
  return [
    {
      id: 'overview',
      label: 'Overview',
      alpha: towardMoon + 0.7,
      beta: 1.3,
      radius: 230,
      target: new Vector3(0, 2, 0),
    },
    {
      id: 'station',
      label: 'Station',
      alpha: towardMoon + 0.35,
      beta: 1.24,
      radius: 55,
      target: new Vector3(0, 1, 0),
    },
    {
      id: 'moonrise',
      label: 'Moonrise',
      alpha: towardMoon,
      beta: 1.93,
      radius: 95,
      target: new Vector3(0, 40, 0),
    },
  ];
}

/**
 * Owns the Babylon engine and scene. Framework-free: the UI drives it through
 * the command methods and listens on `events`.
 */
export class Game {
  readonly events = new Emitter<GameEvents>();
  readonly keys = new KeyRegistry();
  readonly engine: Engine;
  readonly scene: Scene;
  readonly theme: ThemeConfig;
  readonly terrain: Terrain;
  readonly sky: Sky;
  readonly lighting: Lighting;
  readonly cameras: CameraRig;
  readonly atmosphere: Atmosphere;
  readonly performance: PerformanceGovernor;
  mode: GameMode = 'build';
  private readonly canvas: HTMLCanvasElement;
  private readonly disposers: (() => void)[] = [];
  private disposed = false;

  private constructor(parts: GameParts) {
    this.canvas = parts.canvas;
    this.engine = parts.engine;
    this.scene = parts.scene;
    this.theme = parts.theme;
    this.terrain = parts.terrain;
    this.sky = parts.sky;
    this.lighting = parts.lighting;
    this.cameras = parts.cameras;
    this.atmosphere = parts.atmosphere;
    this.performance = new PerformanceGovernor(this.engine, (sample) =>
      this.events.emit('performance', sample),
    );
    this.cameras.onModeChange = (mode) => this.events.emit('cameraMode', mode);
    this.registerKeys();
  }

  static async create(
    canvas: HTMLCanvasElement,
    theme: ThemeConfig,
    onProgress: (progress: LoadProgress) => void,
  ): Promise<Game> {
    const report = async (step: string, fraction: number): Promise<void> => {
      onProgress({ step, fraction });
      await nextFrame();
    };

    await report('Starting the engine', 0.05);
    const engine = new Engine(
      canvas,
      true,
      { powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: true },
      true,
    );
    // Render at most 1.5x CSS pixels; the governor adapts from there.
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 1.5));
    const scene = new Scene(engine);
    scene.skipPointerMovePicking = true;

    await report('Shaping the valley', 0.2);
    const terrain = new Terrain(scene, theme.terrain);

    await report('Raising the moon', 0.4);
    const sky = new Sky(scene, theme.sky);

    await report('Lighting the night', 0.55);
    const lighting = new Lighting(scene, theme.lighting);
    for (const caster of terrain.shadowCasters) lighting.addCaster(caster);

    await report('Placing cameras', 0.65);
    const cameras = new CameraRig(scene, canvas, {
      heightAt: (x, z) => terrain.heightAt(x, z),
      presets: buildPresets(theme),
      initialPreset: 'overview',
    });

    await report('Rolling in the fog', 0.75);
    const atmosphere = new Atmosphere(scene, {
      fog: theme.fog,
      lighting: theme.lighting,
      cameras: cameras.cameras,
      halfSize: theme.terrain.size / 2,
      seed: theme.terrain.seed,
      heightAt: (x, z) => terrain.heightAt(x, z),
      glowExcluded: sky.glowExcluded,
    });

    await report('Compiling shaders', 0.88);
    await scene.whenReadyAsync();
    await report('Opening the gates', 1);

    return new Game({ canvas, engine, scene, theme, terrain, sky, lighting, cameras, atmosphere });
  }

  /** Starts the render loop and input listeners. */
  start(): void {
    const canvas = this.canvas;
    const onContextMenu = (event: Event): void => event.preventDefault();
    canvas.addEventListener('contextmenu', onContextMenu);
    this.disposers.push(() => canvas.removeEventListener('contextmenu', onContextMenu));

    const onResize = (): void => this.engine.resize();
    window.addEventListener('resize', onResize);
    this.disposers.push(() => window.removeEventListener('resize', onResize));
    this.disposers.push(this.keys.attach(window));

    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
      this.sky.update(dt);
      this.cameras.update(dt);
      this.performance.update(dt);
      this.scene.render();
    });
  }

  get bindings(): readonly KeyBinding[] {
    return this.keys.list();
  }

  get presets(): readonly CameraPreset[] {
    return this.cameras.presets;
  }

  setCameraMode(mode: CameraMode): void {
    this.cameras.setMode(mode);
  }

  toggleCamera(): void {
    this.cameras.toggle();
  }

  flyTo(presetId: string): void {
    this.cameras.flyTo(presetId);
  }

  requestMode(mode: GameMode): void {
    if (mode === this.mode) return;
    if (mode === 'ride') {
      this.toast('Ride mode arrives in Phase 3');
      return;
    }
    this.mode = mode;
    this.keys.mode = mode;
    this.events.emit('mode', mode);
  }

  toast(text: string): void {
    this.events.emit('toast', text);
  }

  /** Saves the current view as a PNG through the browser's download flow. */
  async takePhoto(): Promise<void> {
    const data = await CreateScreenshotAsync(
      this.engine,
      this.cameras.active,
      { precision: 1 },
      'image/png',
    );
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const link = document.createElement('a');
    link.href = data;
    link.download = `loopwright-${stamp}.png`;
    link.click();
    this.toast('Photo saved to your downloads');
  }

  private registerKeys(): void {
    this.keys.bind({
      scope: 'build',
      combo: 'KeyF',
      label: 'Switch between orbit and free-fly camera',
      handler: () => this.toggleCamera(),
    });
    this.cameras.presets.forEach((preset, index) => {
      this.keys.bind({
        scope: 'build',
        combo: `Digit${index + 1}`,
        label: `Fly to ${preset.label}`,
        handler: () => this.flyTo(preset.id),
      });
    });
    this.keys.bind({
      scope: 'global',
      combo: 'KeyP',
      label: 'Save a photo of the view',
      handler: () => {
        this.takePhoto().catch((error: unknown) => {
          console.error(error);
          this.toast('Could not save the photo');
        });
      },
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.engine.stopRenderLoop();
    for (const dispose of this.disposers) dispose();
    this.atmosphere.dispose();
    this.cameras.dispose();
    this.lighting.dispose();
    this.sky.dispose();
    this.terrain.dispose();
    this.scene.dispose();
    this.engine.dispose();
    this.events.clear();
  }
}
