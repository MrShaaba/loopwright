import type { AudioEngine } from '../audio/AudioEngine';
import type { RideCamera, RideView } from '../camera/RideCamera';
import { Emitter } from '../events';
import type { CompiledTrack } from '../track/Track';
import type { TubeView } from '../tube/TubeView';
import { clamp } from '../util/math';
import type { Ball } from './Ball';
import {
  BOOST_FACTOR,
  createPhysicsTrack,
  createRideState,
  createSample,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  MULTIPLIER_STEP,
  resetRide,
  sampleTrackToRef,
  stepRide,
  type PhysicsTrack,
  type RideState,
} from './BallPhysics';

export interface RideStatus {
  /** Effective speed, m/s, multiplier and boost included. */
  speed: number;
  /** Speed the physics alone would give, m/s. */
  baseSpeed: number;
  multiplier: number;
  boost: boolean;
  paused: boolean;
  /** 0 at the start line, 1 a full lap later. */
  progress: number;
  laps: number;
  time: number;
  muted: boolean;
  view: RideView;
}

export interface RideEvents {
  status: RideStatus;
  active: boolean;
}

const STATUS_INTERVAL = 1 / 20;
const BOOST_TAU = 0.22;

/** Runs the ball along the track, drives the camera, the tube effects and the audio. */
export class RideController {
  readonly events = new Emitter<RideEvents>();
  readonly state: RideState = createRideState();
  multiplier = 1;
  paused = false;
  /** True while reduced motion is requested; the camera and tube read it every frame. */
  reducedMotion = false;
  private track: PhysicsTrack;
  private readonly sample = createSample();
  private boostHeld = false;
  private boost = 1;
  private active = false;
  private statusTimer = 0;
  private lastTravelled = 0;

  constructor(
    compiled: CompiledTrack,
    readonly ball: Ball,
    readonly camera: RideCamera,
    readonly audio: AudioEngine,
    readonly tube: TubeView,
  ) {
    this.track = createPhysicsTrack(compiled.frames);
    this.placeBall();
  }

  get isActive(): boolean {
    return this.active;
  }

  get effectiveMultiplier(): number {
    return this.multiplier * this.boost;
  }

  /** Effective speed in m/s. */
  get speed(): number {
    return this.paused ? 0 : this.state.v * this.effectiveMultiplier;
  }

  /** Rebuilds the physics track after the layout changes and puts the ball on the start line. */
  syncTrack(compiled: CompiledTrack): void {
    const previous = this.track.length > 0 ? this.state.s / this.track.length : 0;
    this.track = createPhysicsTrack(compiled.frames);
    if (this.active) {
      // Keep the ride going at the same fraction of the loop while the track reshapes.
      this.state.s = clamp(previous, 0, 0.9999) * this.track.length;
    } else {
      resetRide(this.state);
    }
    this.lastTravelled = this.state.travelled;
    this.placeBall();
  }

  enter(): void {
    this.active = true;
    this.paused = false;
    resetRide(this.state);
    this.lastTravelled = 0;
    this.placeBall();
    this.camera.activate(this.track, this.state.s);
    this.audio.start();
    this.events.emit('active', true);
    this.emitStatus();
  }

  exit(): void {
    this.active = false;
    this.paused = false;
    this.boostHeld = false;
    this.boost = 1;
    resetRide(this.state);
    this.lastTravelled = 0;
    this.placeBall();
    this.camera.deactivate();
    this.audio.silence();
    this.events.emit('active', false);
    this.emitStatus();
  }

  setMultiplier(value: number): void {
    this.multiplier = clamp(Math.round(value / 0.05) * 0.05, MULTIPLIER_MIN, MULTIPLIER_MAX);
    this.emitStatus();
  }

  nudgeMultiplier(direction: 1 | -1): void {
    this.setMultiplier(this.multiplier + direction * MULTIPLIER_STEP);
  }

  setBoost(held: boolean): void {
    if (this.boostHeld === held) return;
    this.boostHeld = held;
    this.emitStatus();
  }

  setView(view: RideView): void {
    this.camera.setView(view);
    this.emitStatus();
  }

  cycleView(): RideView {
    const view = this.camera.cycleView();
    this.emitStatus();
    return view;
  }

  togglePause(): boolean {
    if (!this.active) return false;
    this.paused = !this.paused;
    if (this.paused) this.audio.silence();
    this.emitStatus();
    return this.paused;
  }

  toggleMute(): boolean {
    this.audio.setMuted(!this.audio.muted);
    this.emitStatus();
    return this.audio.muted;
  }

  update(dt: number): void {
    if (!this.active) return;
    const target = this.boostHeld ? BOOST_FACTOR : 1;
    this.boost += (target - this.boost) * (1 - Math.exp(-dt / BOOST_TAU));
    if (!this.paused) {
      stepRide(this.state, this.track, dt, this.effectiveMultiplier);
      this.audio.update(this.speed);
    }
    const rolled = this.state.travelled - this.lastTravelled;
    this.lastTravelled = this.state.travelled;
    sampleTrackToRef(this.track, this.state.s, this.sample);
    this.ball.place(this.sample, rolled);
    this.camera.update(dt, this.track, this.state.s, this.speed, this.reducedMotion);
    this.statusTimer += dt;
    if (this.statusTimer >= STATUS_INTERVAL) {
      this.statusTimer = 0;
      this.emitStatus();
    }
  }

  status(): RideStatus {
    return {
      speed: this.speed,
      baseSpeed: this.state.v,
      multiplier: this.multiplier,
      boost: this.boostHeld,
      paused: this.paused,
      progress: this.track.length > 0 ? this.state.s / this.track.length : 0,
      laps: this.state.laps,
      time: this.state.time,
      muted: this.audio.muted,
      view: this.camera.view,
    };
  }

  private placeBall(): void {
    sampleTrackToRef(this.track, this.state.s, this.sample);
    this.ball.place(this.sample, 0);
  }

  private emitStatus(): void {
    this.events.emit('status', this.status());
  }

  dispose(): void {
    this.events.clear();
  }
}
