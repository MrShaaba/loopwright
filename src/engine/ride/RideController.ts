import type { AudioEngine } from '../audio/AudioEngine';
import type { RideCameraMode, RideCameras } from '../camera/RideCameras';
import { Emitter } from '../events';
import type { TrackModel } from '../track/TrackModel';
import type { Train } from './Train';
import {
  createPhysicsTrack,
  createRideState,
  createSample,
  dispatchRide,
  resetRide,
  sampleTrackToRef,
  stepRide,
  type PhysicsTrack,
  type RidePhase,
  type RideState,
} from './TrainPhysics';

export interface RideStatus {
  phase: RidePhase;
  /** m/s */
  speed: number;
  gVertical: number;
  gLateral: number;
  time: number;
  lap: number;
  camera: RideCameraMode;
  onChain: boolean;
  muted: boolean;
}

export interface RideEvents {
  status: RideStatus;
  active: boolean;
}

const STATUS_INTERVAL = 1 / 15;

/** Runs the train along the track, drives the ride cameras and the audio, and reports status. */
export class RideController {
  readonly events = new Emitter<RideEvents>();
  private track: PhysicsTrack;
  private readonly state: RideState;
  private readonly sample = createSample();
  private active = false;
  private statusTimer = 0;

  constructor(
    model: TrackModel,
    readonly train: Train,
    readonly cameras: RideCameras,
    readonly audio: AudioEngine,
  ) {
    this.track = createPhysicsTrack(model.frames, model.closure.closed);
    this.state = createRideState(this.track);
    this.train.place(this.track, this.state.s);
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Rebuilds the physics track after the layout changes and parks the train in the station. */
  syncTrack(model: TrackModel): void {
    this.track = createPhysicsTrack(model.frames, model.closure.closed);
    resetRide(this.state, this.track);
    this.train.place(this.track, this.state.s);
  }

  enter(): void {
    this.active = true;
    resetRide(this.state, this.track);
    this.train.place(this.track, this.state.s);
    sampleTrackToRef(this.track, this.state.s, this.sample);
    this.cameras.activate('seat', this.sample);
    this.events.emit('active', true);
    this.events.emit('status', this.status());
  }

  exit(): void {
    this.active = false;
    resetRide(this.state, this.track);
    this.train.place(this.track, this.state.s);
    this.cameras.deactivate();
    this.audio.silence();
    this.events.emit('active', false);
    this.events.emit('status', this.status());
  }

  /** Dispatches the train. Call from a user gesture so the audio context can start. */
  start(): void {
    if (!this.active) return;
    this.audio.start();
    dispatchRide(this.state, this.track);
    this.events.emit('status', this.status());
  }

  toggleCamera(): RideCameraMode {
    sampleTrackToRef(this.track, this.state.s, this.sample);
    const mode = this.cameras.toggle(this.sample);
    this.events.emit('status', this.status());
    return mode;
  }

  toggleMute(): boolean {
    this.audio.setMuted(!this.audio.muted);
    this.events.emit('status', this.status());
    return this.audio.muted;
  }

  update(dt: number): void {
    if (!this.active) return;
    stepRide(this.state, this.track, dt);
    this.train.place(this.track, this.state.s);
    sampleTrackToRef(this.track, this.state.s, this.sample);
    this.cameras.update(dt, this.sample, this.state.v, this.state.gVertical);
    this.audio.update(this.state.v, this.state.onChain);
    this.statusTimer += dt;
    if (this.statusTimer >= STATUS_INTERVAL) {
      this.statusTimer = 0;
      this.events.emit('status', this.status());
    }
  }

  status(): RideStatus {
    return {
      phase: this.state.phase,
      speed: this.state.v,
      gVertical: this.state.gVertical,
      gLateral: this.state.gLateral,
      time: this.state.time,
      lap: this.state.lap,
      camera: this.cameras.mode,
      onChain: this.state.onChain,
      muted: this.audio.muted,
    };
  }

  dispose(): void {
    this.events.clear();
  }
}
