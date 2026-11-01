import { Engine } from '@babylonjs/core/Engines/engine';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateScreenshotAsync } from '@babylonjs/core/Misc/screenshotTools';
import { Scene } from '@babylonjs/core/scene';
import { AudioEngine } from './audio/AudioEngine';
import { BuildController } from './build/BuildController';
import { CameraRig, type CameraMode, type CameraPreset } from './camera/CameraRig';
import { RideCameras } from './camera/RideCameras';
import { Emitter } from './events';
import { KeyRegistry, type KeyBinding } from './input/Keys';
import { Atmosphere } from './scene/Atmosphere';
import { Lighting } from './scene/Lighting';
import { PerformanceGovernor, type PerformanceSample } from './scene/Performance';
import { Sky } from './scene/Sky';
import { Terrain } from './scene/Terrain';
import { MarkerView } from './ride/MarkerView';
import { RideController } from './ride/RideController';
import { Train } from './ride/Train';
import type { ThemeConfig } from './theme/ThemeConfig';
import { GhostView } from './track/mesh/GhostView';
import { TrackView } from './track/mesh/TrackView';
import { TrackModel } from './track/TrackModel';
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
  track: TrackModel;
  build: BuildController;
  trackView: TrackView;
  ghostView: GhostView;
  ride: RideController;
  markers: MarkerView;
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
  readonly track: TrackModel;
  readonly build: BuildController;
  readonly trackView: TrackView;
  readonly ghostView: GhostView;
  readonly ride: RideController;
  readonly markers: MarkerView;
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
    this.track = parts.track;
    this.build = parts.build;
    this.trackView = parts.trackView;
    this.ghostView = parts.ghostView;
    this.ride = parts.ride;
    this.markers = parts.markers;
    this.performance = new PerformanceGovernor(this.engine, (sample) =>
      this.events.emit('performance', sample),
    );
    this.cameras.onModeChange = (mode) => this.events.emit('cameraMode', mode);
    this.build.events.on('track', () => {
      this.trackView.rebuild(this.track.frames, this.track.closure.closed, this.track.exitPose);
      this.ride.syncTrack(this.track);
    });
    this.build.events.on('validation', (result) => {
      this.markers.show(result.markers);
    });
    this.markers.show(this.build.validation.markers);
    this.build.events.on('ghost', (ghost) => {
      if (ghost) this.ghostView.show(ghost.frames, ghost.valid);
      else this.ghostView.hide();
    });
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

    const rideCameras = new RideCameras(scene, (x, z) => terrain.heightAt(x, z));

    await report('Rolling in the fog', 0.75);
    const atmosphere = new Atmosphere(scene, {
      fog: theme.fog,
      lighting: theme.lighting,
      cameras: [...cameras.cameras, ...rideCameras.cameras],
      halfSize: theme.terrain.size / 2,
      seed: theme.terrain.seed,
      heightAt: (x, z) => terrain.heightAt(x, z),
      glowExcluded: sky.glowExcluded,
    });

    await report('Laying the station', 0.82);
    const track = new TrackModel(undefined, { heightAt: (x, z) => terrain.heightAt(x, z) });
    const build = new BuildController(track);
    const trackView = new TrackView(
      scene,
      theme.track,
      lighting,
      (x, z) => terrain.heightAt(x, z),
      track.entry,
    );
    trackView.rebuild(track.frames, track.closure.closed, track.exitPose);
    const ghostView = new GhostView(scene);

    await report('Rolling out the train', 0.86);
    const train = new Train(scene, theme.train, lighting);
    const audio = new AudioEngine(theme.audio);
    const ride = new RideController(track, train, rideCameras, audio);
    const markers = new MarkerView(scene, (x, z) => terrain.heightAt(x, z));

    await report('Compiling shaders', 0.9);
    await scene.whenReadyAsync();
    await report('Opening the gates', 1);

    return new Game({
      canvas,
      engine,
      scene,
      theme,
      terrain,
      sky,
      lighting,
      cameras,
      atmosphere,
      track,
      build,
      trackView,
      ghostView,
      ride,
      markers,
    });
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

    // A plain click (no drag) on the scene snaps the previewed piece on.
    const tapObserver = this.scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP || info.event.button !== 0) return;
      if (this.mode !== 'build' || this.cameras.mode !== 'orbit') return;
      this.placePiece();
    });
    this.disposers.push(() => this.scene.onPointerObservable.remove(tapObserver));

    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
      this.sky.update(dt);
      if (this.mode === 'ride') this.ride.update(dt);
      else this.cameras.update(dt);
      this.markers.update(dt);
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

  flyToTrackEnd(): void {
    const end = this.track.exitPose.position;
    this.cameras.flyToPoint(new Vector3(end.x, end.y + 1, end.z), 42);
  }

  /** Places the selected piece, or explains why it cannot be placed. */
  placePiece(): void {
    if (!this.build.selectedId) return;
    if (this.build.place()) return;
    const reason = this.build.selection().reason;
    if (reason) this.toast(reason);
  }

  requestMode(mode: GameMode): void {
    if (mode === this.mode) return;
    if (mode === 'ride') {
      const problem = this.build.validation.markers.find((m) => m.severity === 'error');
      if (problem) {
        this.toast(problem.reason);
        this.cameras.flyToPoint(problem.position, 45);
        return;
      }
      this.build.select(null);
      this.cameras.suspend();
      this.markers.setVisible(false);
      this.ride.enter();
    } else {
      this.ride.exit();
      this.markers.setVisible(true);
      this.cameras.resume();
    }
    this.mode = mode;
    this.keys.mode = mode;
    this.events.emit('mode', mode);
  }

  /** Flies the build camera to a validation marker. */
  showMarker(index: number): void {
    const marker = this.build.validation.markers[index];
    if (!marker) return;
    this.cameras.flyToPoint(marker.position, 40);
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
      scope: 'build',
      combo: 'Digit4',
      label: 'Fly to the track end',
      handler: () => this.flyToTrackEnd(),
    });
    this.keys.bind({
      scope: 'build',
      combo: 'Enter',
      label: 'Place the previewed piece',
      handler: () => this.placePiece(),
    });
    for (const combo of ['Backspace', 'Delete']) {
      this.keys.bind({
        scope: 'build',
        combo,
        label: 'Remove the last piece',
        handler: () => {
          if (!this.build.removeLast()) this.toast('Nothing to remove');
        },
      });
    }
    this.keys.bind({
      scope: 'build',
      combo: 'mod+KeyZ',
      label: 'Undo',
      handler: () => this.build.undo(),
    });
    for (const combo of ['shift+mod+KeyZ', 'mod+KeyY']) {
      this.keys.bind({ scope: 'build', combo, label: 'Redo', handler: () => this.build.redo() });
    }
    this.keys.bind({
      scope: 'ride',
      combo: 'Space',
      label: 'Dispatch the train',
      handler: () => this.ride.start(),
    });
    this.keys.bind({
      scope: 'ride',
      combo: 'KeyC',
      label: 'Switch between seat and chase camera',
      handler: () => this.ride.toggleCamera(),
    });
    this.keys.bind({
      scope: 'global',
      combo: 'KeyM',
      label: 'Mute or unmute sound',
      handler: () => this.toast(this.ride.toggleMute() ? 'Sound muted' : 'Sound on'),
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
    this.ride.dispose();
    this.ride.audio.dispose();
    this.ride.cameras.dispose();
    this.ride.train.dispose();
    this.markers.dispose();
    this.ghostView.dispose();
    this.trackView.dispose();
    this.build.dispose();
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
