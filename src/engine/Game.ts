import { Engine } from '@babylonjs/core/Engines/engine';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateScreenshotAsync } from '@babylonjs/core/Misc/screenshotTools';
import { Scene } from '@babylonjs/core/scene';
import { AudioEngine } from './audio/AudioEngine';
import { CameraRig, type CameraMode, type CameraPreset } from './camera/CameraRig';
import { RideCamera } from './camera/RideCamera';
import { EditController } from './edit/EditController';
import { Emitter } from './events';
import { GameController, type PlayMode } from './game/GameController';
import { GhostView } from './game/GhostView';
import { ItemView } from './game/ItemView';
import { KeyRegistry, type KeyBinding } from './input/Keys';
import { ProgressTracker } from './progress/ProgressTracker';
import { isUnlocked } from './progress/unlocks';
import { Ball } from './ride/Ball';
import { RideController } from './ride/RideController';
import { BALL_SKINS, DEFAULT_SKIN_ID, getSkin } from './ride/skins';
import { Trail } from './ride/Trail';
import { getTrail, TRAILS } from './ride/trails';
import { encodeTrack, SHARE_PARAM, shareLink } from './save/codec';
import { createTrackDoc, parseTrackDoc, type TrackDoc } from './save/schema';
import { saveTrack } from './save/storage';
import { Atmosphere } from './scene/Atmosphere';
import { Floor } from './scene/Floor';
import { Lighting } from './scene/Lighting';
import { PerformanceGovernor, type PerformanceSample } from './scene/Performance';
import { Props } from './scene/Props';
import { Sky } from './scene/Sky';
import { getTheme, hasTheme, listThemes, nextThemeId } from './theme';
import type { ThemeConfig } from './theme/ThemeConfig';
import {
  compileTrack,
  sectionAtPoint,
  type CompiledTrack,
  type SectionRange,
  type SectionSpec,
} from './track/Track';
import { TubeView } from './tube/TubeView';
import { DEG } from './util/math';
import { IssueMarkers } from './validate/IssueMarkers';
import { validateTrack, type ValidationResult } from './validate/validate';

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
  seed: number;
}

export interface GameEvents {
  performance: PerformanceSample;
  cameraMode: CameraMode;
  mode: GameMode;
  toast: string;
  track: TrackSummary;
  reducedMotion: boolean;
  validation: ValidationResult;
  theme: ThemeConfig;
  /** A floating score pop, already projected to CSS pixels on the canvas. */
  pop: { kind: 'ring' | 'gem' | 'boost' | 'hazard' | 'miss'; text: string; x: number; y: number };
  /** The equipped ball skin and trail ids. */
  cosmetics: { skin: string; trail: string };
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
  props: Props;
  tube: TubeView;
  ball: Ball;
  trail: Trail;
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

/** m:ss.t for lap times. */
export function formatLap(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
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
  theme: ThemeConfig;
  sky: Sky;
  lighting: Lighting;
  readonly cameras: CameraRig;
  readonly rideCamera: RideCamera;
  atmosphere: Atmosphere;
  readonly floor: Floor;
  props: Props;
  readonly tube: TubeView;
  readonly ball: Ball;
  readonly trail: Trail;
  readonly audio: AudioEngine;
  readonly ride: RideController;
  readonly tracker = new ProgressTracker({ themeCount: listThemes().length });
  readonly edit: EditController;
  readonly items: ItemView;
  readonly ghostView: GhostView;
  readonly game: GameController;
  readonly markers: IssueMarkers;
  readonly performance: PerformanceGovernor;
  mode: GameMode = 'edit';
  doc: TrackDoc;
  compiled: CompiledTrack;
  validation: ValidationResult;
  reducedMotion = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly disposers: (() => void)[] = [];
  private disposed = false;
  private hashTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.props = parts.props;
    this.tube = parts.tube;
    this.ball = parts.ball;
    this.trail = parts.trail;
    this.audio = parts.audio;
    this.ride = parts.ride;
    this.doc = parts.doc;
    this.compiled = parts.compiled;
    this.validation = validateTrack(this.doc.sections, this.compiled);
    this.markers = new IssueMarkers(this.scene);
    this.markers.show(this.validation.issues);
    this.items = new ItemView(this.scene, this.itemPalette());
    this.ghostView = new GhostView(this.scene);
    this.atmosphere.glow.addExcludedMesh(this.ghostView.mesh);
    this.game = new GameController(
      this.compiled,
      this.doc.seed,
      this.ride,
      this.items,
      this.audio,
      this.ghostView,
      this.tracker,
    );
    this.game.setThemeId(this.theme.id);
    this.tracker.events.on('unlock', (item) => {
      this.toast(`Unlocked: ${item.name} ${item.kind}. Press L to open the locker.`);
    });
    this.game.events.on('pop', (pop) => {
      const point = this.project(pop.position);
      if (point)
        this.events.emit('pop', { kind: pop.kind, text: pop.text, x: point.x, y: point.y });
    });
    this.ride.events.on('active', (active) => this.game.onRide(active));
    this.ride.setTrackKey(encodeTrack(this.doc));
    this.game.setTrackKey(encodeTrack(this.doc));
    this.ride.events.on('lap', (lap) => {
      if (lap.best) this.toast(`New best lap: ${formatLap(lap.seconds)}`);
    });
    this.performance = new PerformanceGovernor(this.engine, (sample) =>
      this.events.emit('performance', sample),
    );
    this.cameras.onModeChange = (mode) => this.events.emit('cameraMode', mode);
    this.edit = new EditController((sections) => {
      this.setSections(sections);
      return { ranges: this.compiled.ranges, returnLength: this.compiled.returnLength };
    });
    this.edit.events.on('change', () => this.tube.setHighlight(this.edit.selectedRange()));
    this.edit.load(this.doc.sections);
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
    const props = new Props(scene, theme.props, compiled);

    await report('Lighting the ball', 0.8);
    const ball = new Ball(scene, theme.ball);
    // The ball fills a lot of the ride view; blooming it would wash out the whole frame.
    atmosphere.glow.addExcludedMesh(ball.mesh);
    atmosphere.glow.addExcludedMesh(ball.halo);
    const trail = new Trail(scene);
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
      props,
      tube,
      ball,
      trail,
      audio,
      ride,
      doc,
      compiled,
    });
    game.frameTrack(false);
    return game;
  }

  /** The UI tells the engine when a card is up, so Enter and Space go to the card instead. */
  modalOpen: () => boolean = () => false;

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

    // A plain click on the tube selects the section under the pointer.
    const tapObserver = this.scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP || info.event.button !== 0) return;
      if (this.mode !== 'edit' || this.cameras.mode !== 'orbit') return;
      const pickables = this.tube.pickables;
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) =>
        pickables.includes(mesh as (typeof pickables)[number]),
      );
      if (!pick.hit || !pick.pickedPoint) {
        this.edit.select(null);
        return;
      }
      const index = sectionAtPoint(this.compiled, pick.pickedPoint);
      this.edit.select(this.edit.idAt(index));
    });
    this.disposers.push(() => this.scene.onPointerObservable.remove(tapObserver));

    // Held keys: Shift boosts, left and right (or A and D) steer around the tube.
    const held = new Set<string>();
    const steerFor = (code: string): number =>
      code === 'ArrowLeft' || code === 'KeyA'
        ? -1
        : code === 'ArrowRight' || code === 'KeyD'
          ? 1
          : 0;
    const applySteer = (): void => {
      let input = 0;
      for (const code of held) input += steerFor(code);
      this.ride.setSteer(input);
    };
    const onHeldKey = (event: KeyboardEvent): void => {
      if (event.key === 'Shift') {
        this.ride.setBoost(event.type === 'keydown');
        return;
      }
      if (steerFor(event.code) === 0) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      ) {
        return;
      }
      if (event.type === 'keydown') held.add(event.code);
      else held.delete(event.code);
      if (this.mode === 'ride') event.preventDefault();
      applySteer();
    };
    const onBlur = (): void => {
      held.clear();
      this.ride.setBoost(false);
      this.ride.setSteer(0);
    };
    window.addEventListener('keydown', onHeldKey);
    window.addEventListener('keyup', onHeldKey);
    window.addEventListener('blur', onBlur);
    this.disposers.push(() => {
      window.removeEventListener('keydown', onHeldKey);
      window.removeEventListener('keyup', onHeldKey);
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
      this.edit.flush();
      this.sky.update(dt);
      this.items.update(dt);
      if (this.mode === 'ride') {
        this.ride.update(dt);
        this.game.update();
      } else {
        this.cameras.update(dt);
        this.markers.update(dt);
      }
      this.tube.update(dt, this.ride.speed, this.reducedMotion);
      this.floor.update(dt);
      const camera = this.scene.activeCamera;
      if (camera) this.props.update(dt, camera.globalPosition);
      this.trail.update(
        this.ball.position,
        this.ride.heading,
        this.mode === 'ride' ? this.ride.speed : 0,
      );
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
      seed: this.doc.seed,
    };
  }

  /** Replaces the sections, recompiles and reskins the tube. The ride keeps going if active. */
  setSections(sections: SectionSpec[], name = this.doc.name): void {
    this.doc = createTrackDoc(name, this.doc.theme, sections, this.doc.seed);
    this.compiled = compileTrack(this.doc.sections);
    this.tube.rebuild(this.compiled);
    this.props.rebuild(this.compiled);
    this.ride.syncTrack(this.compiled);
    this.ride.setTrackKey(encodeTrack(this.doc));
    this.game.setTrack(this.compiled, this.doc.seed);
    this.game.setTrackKey(encodeTrack(this.doc));
    this.validation = validateTrack(this.doc.sections, this.compiled);
    this.markers.show(this.validation.issues);
    this.persist();
    this.events.emit('track', this.summary());
    this.events.emit('validation', this.validation);
  }

  /** Autosaves and keeps the address bar's share hash current, a little after the last change. */
  private persist(): void {
    saveTrack(this.doc);
    if (this.hashTimer) clearTimeout(this.hashTimer);
    this.hashTimer = setTimeout(() => {
      this.hashTimer = null;
      try {
        history.replaceState(null, '', `#${SHARE_PARAM}=${encodeTrack(this.doc)}`);
      } catch {
        // Some embeds forbid history changes; the link button still works.
      }
    }, 400);
  }

  rename(name: string): void {
    const trimmed = name.trim().slice(0, 48) || 'Untitled';
    if (trimmed === this.doc.name) return;
    this.doc = createTrackDoc(trimmed, this.doc.theme, this.doc.sections, this.doc.seed);
    this.persist();
    this.events.emit('track', this.summary());
  }

  /** A new item layout for the same track. The seed is saved with the track. */
  reshuffleItems(): void {
    const seed = (this.doc.seed + 1 + Math.floor(Math.random() * 1000)) % 65536;
    this.setSeed(seed);
  }

  setSeed(seed: number): void {
    this.doc = createTrackDoc(this.doc.name, this.doc.theme, this.doc.sections, seed);
    this.game.setTrack(this.compiled, this.doc.seed);
    this.ride.setTrackKey(encodeTrack(this.doc));
    this.game.setTrackKey(encodeTrack(this.doc));
    this.persist();
    this.events.emit('track', this.summary());
  }

  setPlayMode(mode: PlayMode): void {
    this.game.setMode(mode);
  }

  /** Projects a world point to CSS pixels on the canvas, or null when it is behind the camera. */
  private project(point: Vector3): { x: number; y: number } | null {
    const camera = this.scene.activeCamera;
    if (!camera) return null;
    const width = this.engine.getRenderWidth();
    const height = this.engine.getRenderHeight();
    const projected = Vector3.Project(
      point,
      Matrix.IdentityReadOnly,
      this.scene.getTransformMatrix(),
      camera.viewport.toGlobal(width, height),
    );
    if (projected.z < 0 || projected.z > 1) return null;
    const scale = this.engine.getHardwareScalingLevel();
    return { x: projected.x * scale, y: projected.y * scale };
  }

  /** A link that rebuilds this track with no server. */
  shareLink(): string {
    return shareLink(this.doc, `${location.origin}${location.pathname}`);
  }

  exportJson(): string {
    return JSON.stringify(this.doc, null, 2);
  }

  /** Loads a track from JSON text. Returns false, with a toast, when the text is not a track. */
  importJson(text: string): boolean {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.toast('That file is not JSON');
      return false;
    }
    const doc = parseTrackDoc(raw);
    if (!doc || doc.sections.length === 0) {
      this.toast('That file is not a Loopwright track');
      return false;
    }
    this.loadDoc(doc);
    this.toast(`Loaded ${doc.name}`);
    return true;
  }

  /** Selects the section an issue points at and flies to it; whole-track issues frame everything. */
  showIssue(index: number): void {
    const issue = this.validation.issues[index];
    if (!issue) return;
    if (issue.sectionIndex < 0) {
      this.edit.select(null);
      this.frameTrack(true);
      return;
    }
    const id = this.edit.idAt(issue.sectionIndex);
    this.edit.select(id);
    if (issue.position) this.cameras.flyToPoint(issue.position, 46);
    else if (id) this.focusSection(id);
  }

  loadDoc(doc: TrackDoc): void {
    this.doc = createTrackDoc(doc.name, doc.theme, doc.sections, doc.seed);
    this.edit.load(doc.sections);
    if (hasTheme(doc.theme)) this.setTheme(doc.theme);
    if (this.mode === 'edit') this.frameTrack(true);
  }

  /** Glides the editor camera to a section of the tube. */
  focusSection(id: string): void {
    const range = this.edit.rangeOf(id);
    if (!range) return;
    this.flyToRange(range);
  }

  private flyToRange(range: SectionRange): void {
    const middle = this.compiled.frames[Math.round((range.s0 + range.s1) / 2 / 0.25)];
    if (!middle) return;
    const radius = Math.min(140, Math.max(32, range.length * 0.8 + 18));
    this.cameras.flyToPoint(middle.position, radius);
  }

  /** Re-skins the scene live. The track, physics and ride are untouched. */
  setTheme(id: string): void {
    if (!hasTheme(id) || id === this.theme.id) return;
    const theme = getTheme(id);
    this.theme = theme;
    this.sky.dispose();
    this.lighting.dispose();
    this.atmosphere.dispose();
    this.sky = new Sky(this.scene, theme.sky);
    this.lighting = new Lighting(this.scene, theme.lighting);
    this.atmosphere = new Atmosphere(this.scene, {
      fog: theme.fog,
      lighting: theme.lighting,
      cameras: [...this.cameras.cameras, this.rideCamera.camera],
      glowExcluded: [...this.sky.glowExcluded, this.ball.mesh, this.ball.halo, this.ghostView.mesh],
    });
    this.floor.restyle(theme.floor, theme.fog, theme.ball);
    this.props.dispose();
    this.props = new Props(this.scene, theme.props, this.compiled);
    this.tube.restyle(theme.tube, theme.fog);
    this.ball.restyle(theme.ball);
    this.trail.setBallColor(theme.ball.color);
    this.doc = createTrackDoc(this.doc.name, theme.id, this.doc.sections, this.doc.seed);
    this.items.restyle(this.itemPalette());
    this.game.setThemeId(theme.id);
    this.persist();
    this.events.emit('theme', theme);
  }

  get skinId(): string {
    return BALL_SKINS.find((skin) => skin.pattern === this.ball.pattern)?.id ?? DEFAULT_SKIN_ID;
  }

  get trailId(): string {
    return this.trail.styleId;
  }

  /** Equips a ball skin. Locked skins are refused with a toast. */
  setSkin(id: string): boolean {
    const skin = getSkin(id);
    if (!isUnlocked(skin.cost, this.tracker.progress.gems)) {
      this.toast(`${skin.name} needs ${skin.cost} gems`);
      return false;
    }
    this.ball.setPattern(skin.pattern);
    this.events.emit('cosmetics', { skin: skin.id, trail: this.trailId });
    return true;
  }

  /** Equips a trail. Locked trails are refused with a toast. */
  setTrail(id: string): boolean {
    const trail = getTrail(id);
    if (!TRAILS.includes(trail) || !isUnlocked(trail.cost, this.tracker.progress.gems)) {
      this.toast(`${trail.name} needs ${trail.cost} gems`);
      return false;
    }
    this.trail.setStyle(trail, this.ball.color);
    this.events.emit('cosmetics', { skin: this.skinId, trail: trail.id });
    return true;
  }

  private itemPalette(): { ring: Color3; gem: Color3; boost: Color3; hazard: Color3 } {
    return {
      // Rings stay gold in every theme so they never blend into the tube's own light rings.
      ring: new Color3(1.0, 0.86, 0.45),
      gem: new Color3(1.0, 0.45, 0.95),
      boost: new Color3(0.45, 1.0, 0.6),
      hazard: new Color3(1.0, 0.3, 0.3),
    };
  }

  cycleTheme(): void {
    this.setTheme(nextThemeId(this.theme.id));
    this.toast(this.theme.name);
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
      const problem = this.validation.issues.find((issue) => issue.severity === 'error');
      if (problem) {
        this.toast(problem.message);
        this.showIssue(this.validation.issues.indexOf(problem));
        return;
      }
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
        when: () => !this.modalOpen(),
        handler: () => this.requestMode('ride'),
      });
      this.keys.bind({
        scope: 'ride',
        combo,
        label: 'Back to the editor, or go again after the lap ends',
        when: () => !this.modalOpen(),
        handler: () => {
          if (this.ride.state.phase === 'complete') this.ride.restart();
          else this.requestMode('edit');
        },
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
      scope: 'edit',
      combo: 'mod+KeyZ',
      label: 'Undo',
      handler: () => {
        if (!this.edit.undo()) this.toast('Nothing to undo');
      },
    });
    for (const combo of ['shift+mod+KeyZ', 'mod+KeyY']) {
      this.keys.bind({
        scope: 'edit',
        combo,
        label: 'Redo',
        handler: () => {
          if (!this.edit.redo()) this.toast('Nothing to redo');
        },
      });
    }
    for (const combo of ['Delete', 'Backspace']) {
      this.keys.bind({
        scope: 'edit',
        combo,
        label: 'Remove the selected section',
        when: () => this.edit.selected !== null,
        handler: () => {
          if (!this.edit.remove()) this.toast('A track needs at least one section');
        },
      });
    }
    this.keys.bind({
      scope: 'edit',
      combo: 'mod+KeyD',
      label: 'Duplicate the selected section',
      when: () => this.edit.selected !== null,
      handler: () => this.edit.duplicate(),
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
      scope: 'ride',
      combo: 'KeyC',
      label: 'Switch between the Inside and Follow views',
      handler: () => this.ride.cycleView(),
    });
    this.keys.bind({
      scope: 'global',
      combo: 'KeyT',
      label: 'Next theme',
      handler: () => this.cycleTheme(),
    });
    this.keys.bind({
      scope: 'global',
      combo: 'KeyM',
      label: 'Mute or unmute sound',
      handler: () => this.toast(this.ride.toggleMute() ? 'Sound muted' : 'Sound on'),
    });
    this.keys.bind({
      scope: 'global',
      combo: 'KeyO',
      label: 'Save a photo',
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
    if (this.hashTimer) clearTimeout(this.hashTimer);
    for (const dispose of this.disposers) dispose();
    this.edit.dispose();
    this.game.dispose();
    this.tracker.dispose();
    this.trail.dispose();
    this.ghostView.dispose();
    this.items.dispose();
    this.markers.dispose();
    this.ride.dispose();
    this.audio.dispose();
    this.rideCamera.dispose();
    this.ball.dispose();
    this.tube.dispose();
    this.props.dispose();
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
