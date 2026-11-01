import { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateScreenshotAsync } from '@babylonjs/core/Misc/screenshotTools';
import { Scene } from '@babylonjs/core/scene';
import { AudioEngine } from './audio/AudioEngine';
import { CameraRig, type CameraMode, type CameraPreset } from './camera/CameraRig';
import { RideCamera } from './camera/RideCamera';
import { Emitter } from './events';
import { KeyRegistry, type KeyBinding } from './input/Keys';
import { Ball } from './ride/Ball';
import { RideController } from './ride/RideController';
import { createTrackDoc, type TrackDoc } from './save/schema';
import { saveTrack } from './save/storage';
import { Atmosphere } from './scene/Atmosphere';
import { Floor } from './scene/Floor';
import { Lighting } from './scene/Lighting';
import { PerformanceGovernor, type PerformanceSample } from './scene/Performance';
import { Sky } from './scene/Sky';
import type { ThemeConfig } from './theme/ThemeConfig';
import { compileTrack, type CompiledTrack, type SectionSpec } from './track/Track';
import { TubeView } from './tube/TubeView';
import { DEG } from './util/math';

export type GameMode = 'edit' | 'ride';

export interface LoadProgress {
  step: string;
  fraction: number;
}

export interface TrackSummary {
  name: string;
  /** Metres around the loop. */
  length: number;
  sections: number;
}

export interface GameEvents {
  performance: PerformanceSample;
  cameraMode: CameraMode;
  mode: GameMode;
  toast: string;
  track: TrackSummary;
  reducedMotion: boolean;
}

interface GameParts {
  canvas: HTMLCanvasElement;
  engine: Engine;
  scene: Scene;
  theme: ThemeConfig;
  sky: Sky;
  lighting: Lighting;
  cameras: CameraRig;
  rideCamera: RideCamera;
  atmosphere: Atmosphere;
  floor: Floor;
  tube: TubeView;
  ball: Ball;
  audio: AudioEngine;
  ride: RideController;
  doc: TrackDoc;
  compiled: CompiledTrack;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

const FLAT = (): number => 0;

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
  readonly sky: Sky;
  readonly lighting: Lighting;
  readonly cameras: CameraRig;
  readonly rideCamera: RideCamera;
  readonly atmosphere: Atmosphere;
  readonly floor: Floor;
  readonly tube: TubeView;
  readonly ball: Ball;
  readonly audio: AudioEngine;
  readonly ride: RideController;
  readonly performance: PerformanceGovernor;
  mode: GameMode = 'edit';
  doc: TrackDoc;
  compiled: CompiledTrack;
  reducedMotion = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly disposers: (() => void)[] = [];
  private disposed = false;

  private constructor(parts: GameParts) {
    this.canvas = parts.canvas;
    this.engine = parts.engine;
    this.scene = parts.scene;
    this.theme = parts.theme;
    this.sky = parts.sky;
    this.lighting = parts.lighting;
    this.cameras = parts.cameras;
    this.rideCamera = parts.rideCamera;
    this.atmosphere = parts.atmosphere;
    this.floor = parts.floor;
    this.tube = parts.tube;
    this.ball = parts.ball;
    this.audio = parts.audio;
    this.ride = parts.ride;
    this.doc = parts.doc;
    this.compiled = parts.compiled;
    this.performance = new PerformanceGovernor(this.engine, (sample) =>
      this.events.emit('performance', sample),
    );
    this.cameras.onModeChange = (mode) => this.events.emit('cameraMode', mode);
    this.keys.mode = 'edit';
    this.registerKeys();
  }

  static async create(
    canvas: HTMLCanvasElement,
    theme: ThemeConfig,
    doc: TrackDoc,
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
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 1.5));
    const scene = new Scene(engine);
    scene.skipPointerMovePicking = true;

    await report('Painting the sky', 0.2);
    const sky = new Sky(scene, theme.sky);
    const lighting = new Lighting(scene, theme.lighting);

    await report('Placing cameras', 0.35);
    const cameras = new CameraRig(scene, canvas, {
      heightAt: FLAT,
      presets: [
        {
          id: 'overview',
          label: 'Overview',
          alpha: -Math.PI / 2 - 0.6,
          beta: 1.15,
          radius: 160,
          target: new Vector3(0, 6, 40),
        },
      ],
      initialPreset: 'overview',
    });
    const rideCamera = new RideCamera(scene);

    await report('Rolling in the fog', 0.5);
    const atmosphere = new Atmosphere(scene, {
      fog: theme.fog,
      lighting: theme.lighting,
      cameras: [...cameras.cameras, rideCamera.camera],
      glowExcluded: sky.glowExcluded,
    });
    const floor = new Floor(scene, theme.floor, theme.fog, theme.ball);

    await report('Blowing the glass', 0.65);
    const tube = new TubeView(scene, theme.tube, theme.fog);
    const compiled = compileTrack(doc.sections);
    tube.rebuild(compiled);

    await report('Lighting the ball', 0.8);
    const ball = new Ball(scene, theme.ball);
    // The ball fills a lot of the ride view; blooming it would wash out the whole frame.
    atmosphere.glow.addExcludedMesh(ball.mesh);
    atmosphere.glow.addExcludedMesh(ball.halo);
    const audio = new AudioEngine();
    const ride = new RideController(compiled, ball, rideCamera, audio, tube);

    await report('Compiling shaders', 0.9);
    await scene.whenReadyAsync();
    await report('Ready', 1);

    const game = new Game({
      canvas,
      engine,
      scene,
      theme,
      sky,
      lighting,
      cameras,
      rideCamera,
      atmosphere,
      floor,
      tube,
      ball,
      audio,
      ride,
      doc,
      compiled,
    });
    game.frameTrack(false);
    return game;
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

    const onShift = (event: KeyboardEvent): void => {
      if (event.key !== 'Shift') return;
      this.ride.setBoost(event.type === 'keydown');
    };
    const onBlur = (): void => this.ride.setBoost(false);
    window.addEventListener('keydown', onShift);
    window.addEventListener('keyup', onShift);
    window.addEventListener('blur', onBlur);
    this.disposers.push(() => {
      window.removeEventListener('keydown', onShift);
      window.removeEventListener('keyup', onShift);
      window.removeEventListener('blur', onBlur);
    });

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotion = (): void => {
      this.reducedMotion = motionQuery.matches;
      this.ride.reducedMotion = motionQuery.matches;
      this.events.emit('reducedMotion', motionQuery.matches);
    };
    applyMotion();
    motionQuery.addEventListener('change', applyMotion);
    this.disposers.push(() => motionQuery.removeEventListener('change', applyMotion));

    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
      this.sky.update(dt);
      if (this.mode === 'ride') this.ride.update(dt);
      else this.cameras.update(dt);
      this.tube.update(dt, this.ride.speed, this.reducedMotion);
      this.tube.setBall(this.ball.position, this.ball.color);
      this.floor.setBallPosition(this.ball.position);
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

  summary(): TrackSummary {
    return {
      name: this.doc.name,
      length: this.compiled.length,
      sections: this.doc.sections.length,
    };
  }

  /** Replaces the sections, recompiles and reskins the tube. The ride keeps going if active. */
  setSections(sections: SectionSpec[], name = this.doc.name): void {
    this.doc = createTrackDoc(name, this.doc.theme, sections);
    this.compiled = compileTrack(this.doc.sections);
    this.tube.rebuild(this.compiled);
    this.ride.syncTrack(this.compiled);
    saveTrack(this.doc);
    this.events.emit('track', this.summary());
  }

  loadDoc(doc: TrackDoc): void {
    this.setSections(doc.sections, doc.name);
    if (this.mode === 'edit') this.frameTrack(true);
  }

  /** Points the overview preset at the whole track and optionally flies there. */
  frameTrack(fly: boolean): void {
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const frame of this.compiled.frames) {
      min.minimizeInPlace(frame.position);
      max.maximizeInPlace(frame.position);
    }
    if (!Number.isFinite(min.x)) return;
    const centre = min.add(max).scale(0.5);
    const extent = Math.max(max.x - min.x, max.z - min.z, (max.y - min.y) * 1.6, 30);
    const preset: CameraPreset = {
      id: 'overview',
      label: 'Overview',
      alpha: -Math.PI / 2 - 0.55,
      beta: 62 * DEG,
      radius: extent * 0.95 + 24,
      target: centre,
    };
    this.cameras.setPreset(preset);
    if (fly) this.cameras.flyTo('overview');
    else {
      this.cameras.orbit.alpha = preset.alpha;
      this.cameras.orbit.beta = preset.beta;
      this.cameras.orbit.radius = preset.radius;
      this.cameras.orbit.target.copyFrom(preset.target);
    }
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
      this.cameras.suspend();
      this.ride.enter();
    } else {
      this.ride.exit();
      this.cameras.resume();
    }
    this.mode = mode;
    this.keys.mode = mode;
    this.events.emit('mode', mode);
  }

  toggleMode(): void {
    this.requestMode(this.mode === 'ride' ? 'edit' : 'ride');
  }

  toast(text: string): void {
    this.events.emit('toast', text);
  }

  /** Saves the current view as a PNG through the browser's download flow. */
  async takePhoto(): Promise<void> {
    const camera = this.mode === 'ride' ? this.rideCamera.camera : this.cameras.active;
    const data = await CreateScreenshotAsync(this.engine, camera, { precision: 1 }, 'image/png');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const link = document.createElement('a');
    link.href = data;
    link.download = `loopwright-${stamp}.png`;
    link.click();
    this.toast('Photo saved to your downloads');
  }

  private registerKeys(): void {
    for (const combo of ['Enter', 'Space']) {
      this.keys.bind({
        scope: 'edit',
        combo,
        label: 'Ride',
        handler: () => this.requestMode('ride'),
      });
      this.keys.bind({
        scope: 'ride',
        combo,
        label: 'Back to the editor',
        handler: () => this.requestMode('edit'),
      });
    }
    this.keys.bind({
      scope: 'edit',
      combo: 'KeyF',
      label: 'Switch between orbit and free-fly camera',
      handler: () => this.toggleCamera(),
    });
    this.keys.bind({
      scope: 'edit',
      combo: 'Digit1',
      label: 'Frame the whole track',
      handler: () => this.frameTrack(true),
    });
    this.keys.bind({
      scope: 'ride',
      combo: 'ArrowUp',
      label: 'Speed multiplier up',
      handler: () => this.ride.nudgeMultiplier(1),
    });
    this.keys.bind({
      scope: 'ride',
      combo: 'ArrowDown',
      label: 'Speed multiplier down',
      handler: () => this.ride.nudgeMultiplier(-1),
    });
    this.keys.bind({
      scope: 'ride',
      combo: 'KeyP',
      label: 'Pause and resume',
      handler: () => this.ride.togglePause(),
    });
    this.keys.bind({
      scope: 'global',
      combo: 'KeyM',
      label: 'Mute or unmute sound',
      handler: () => this.toast(this.ride.toggleMute() ? 'Sound muted' : 'Sound on'),
    });
    this.keys.bind({
      scope: 'global',
      combo: 'KeyC',
      label: 'Capture a photo',
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
    this.ride.dispose();
    this.audio.dispose();
    this.rideCamera.dispose();
    this.ball.dispose();
    this.tube.dispose();
    this.floor.dispose();
    this.atmosphere.dispose();
    this.cameras.dispose();
    this.lighting.dispose();
    this.sky.dispose();
    this.scene.dispose();
    this.engine.dispose();
    this.events.clear();
  }
}
