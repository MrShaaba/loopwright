import type { AudioEngine } from '../audio/AudioEngine';
import type { RideCamera, RideView } from '../camera/RideCamera';
import { Emitter } from '../events';
import { loadBestLap, saveBestLap } from '../save/storage';
import type { CompiledTrack } from '../track/Track';
import type { TubeView } from '../tube/TubeView';
import { clamp } from '../util/math';
import type { Ball } from './Ball';
import {
  BOOST_FACTOR,
  BOOST_PAD,
  boostPadFactor,
  HAZARD_SPEED_KEEP,
  createPhysicsTrack,
  createRideState,
  createSample,
  feltVerticalG,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  MULTIPLIER_STEP,
  resetRide,
  sampleTrackToRef,
  stepRide,
  stepSteer,
  type PhysicsTrack,
  type RidePhase,
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
  /** Smoothed vertical g felt by the ball; 1 on level track, under 0.4 reads as airtime. */
  gVertical: number;
  phase: RidePhase;
  endless: boolean;
  /** Seconds into the current lap. */
  lapTime: number;
  lastLap: number;
  /** Best lap for this track in seconds, or null before one is recorded. */
  bestLap: number | null;
  /** 0 to 1 while a boost pad's burst is running. */
  padBoost: number;
}

export interface LapEvent {
  lap: number;
  seconds: number;
  best: boolean;
}

export interface RideEvents {
  status: RideStatus;
  active: boolean;
  lap: LapEvent;
}

const STATUS_INTERVAL = 1 / 20;
const BOOST_TAU = 0.22;
/** How far the camera lifts in airtime and drops in a squeeze, metres per g away from 1. */
const FEEL_PER_G = 0.2;
const FEEL_LIFT_MAX = 0.4;
const FEEL_SQUEEZE_MAX = 0.3;
const FEEL_TAU = 0.12;

/** Runs the ball along the track, drives the camera, the tube effects and the audio. */
export class RideController {
  readonly events = new Emitter<RideEvents>();
  readonly state: RideState = createRideState();
  multiplier = 1;
  paused = false;
  /** Keep going lap after lap, or brake to a stop after one. */
  endless = false;
  /** True while reduced motion is requested; the camera and tube read it every frame. */
  reducedMotion = false;
  private track: PhysicsTrack;
  private readonly sample = createSample();
  private boostHeld = false;
  private boost = 1;
  private steerInput = 0;
  /** Charge left from the last boost pad, 1 right after rolling over it. */
  private padCharge = 0;
  private active = false;
  private statusTimer = 0;
  private lastTravelled = 0;
  private gVertical = 1;
  private feel = 0;
  private trackKey = '';
  private bestLap: number | null = null;
  private lapsSeen = 0;

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

  /** Tells the controller which track this is, so best laps are kept per track. */
  setTrackKey(key: string): void {
    if (key === this.trackKey) return;
    this.trackKey = key;
    this.bestLap = loadBestLap(key);
    this.emitStatus();
  }

  get isActive(): boolean {
    return this.active;
  }

  get effectiveMultiplier(): number {
    return this.multiplier * this.boost * boostPadFactor(this.padCharge);
  }

  /** 0 to 1: how much of a boost pad's burst is still running. */
  get boostCharge(): number {
    return this.padCharge;
  }

  /** The smoothed Shift boost factor, 1 when not held. */
  get shiftBoost(): number {
    return this.boost;
  }

  /** A boost pad: a burst of extra speed that fades over a second or so. */
  applyBoost(): void {
    this.padCharge = 1;
    this.emitStatus();
  }

  /** A hazard: the base speed drops sharply; physics rebuilds it. Returns the speed before the hit. */
  applyHazard(): number {
    const before = this.state.v;
    this.state.v = Math.max(0, this.state.v * HAZARD_SPEED_KEEP);
    this.padCharge = 0;
    this.emitStatus();
    return before;
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
    this.lapsSeen = 0;
    this.placeBall();
    this.camera.activate(this.track, this.state.s, this.ball.position);
    this.audio.start();
    this.events.emit('active', true);
    this.emitStatus();
  }

  /** Back to the start line for another go, without leaving ride mode. */
  restart(): void {
    if (!this.active) return;
    this.paused = false;
    resetRide(this.state);
    this.lastTravelled = 0;
    this.lapsSeen = 0;
    this.padCharge = 0;
    this.gVertical = 1;
    this.feel = 0;
    this.placeBall();
    this.camera.activate(this.track, this.state.s, this.ball.position);
    this.emitStatus();
  }

  setEndless(endless: boolean): void {
    this.endless = endless;
    this.emitStatus();
  }

  exit(): void {
    this.active = false;
    this.paused = false;
    this.boostHeld = false;
    this.boost = 1;
    this.padCharge = 0;
    this.steerInput = 0;
    this.gVertical = 1;
    this.feel = 0;
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

  /** Steering input: -1 left, 0 none, 1 right. Held keys and touch buttons both feed this. */
  setSteer(input: number): void {
    this.steerInput = Math.max(-1, Math.min(1, input));
  }

  get steer(): number {
    return this.steerInput;
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
    this.setPaused(!this.paused);
    return this.paused;
  }

  setPaused(paused: boolean): void {
    if (!this.active || this.paused === paused) return;
    this.paused = paused;
    if (paused) this.audio.silence();
    this.emitStatus();
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
    if (!this.paused && this.padCharge > 0) {
      this.padCharge *= Math.exp(-dt / BOOST_PAD.tau);
      if (this.padCharge < 0.02) this.padCharge = 0;
    }
    if (!this.paused) {
      stepRide(this.state, this.track, dt, this.effectiveMultiplier, undefined, this.endless);
      if (this.state.phase === 'running') stepSteer(this.state, this.steerInput, dt);
      this.audio.update(this.speed);
      if (this.state.laps > this.lapsSeen) {
        this.lapsSeen = this.state.laps;
        this.recordLap();
      }
    }
    const rolled = this.state.travelled - this.lastTravelled;
    this.lastTravelled = this.state.travelled;
    sampleTrackToRef(this.track, this.state.s, this.sample);
    this.ball.place(this.sample, rolled, this.state.theta);
    this.updateFeel(dt);
    this.camera.update(
      dt,
      this.track,
      this.state.s,
      this.speed,
      this.reducedMotion,
      this.feel,
      this.ball.position,
      this.padCharge,
    );
    this.statusTimer += dt;
    if (this.statusTimer >= STATUS_INTERVAL) {
      this.statusTimer = 0;
      this.emitStatus();
    }
  }

  private recordLap(): void {
    const seconds = this.state.lastLap;
    const best = this.trackKey !== '' && saveBestLap(this.trackKey, seconds);
    if (best) this.bestLap = seconds;
    this.events.emit('lap', { lap: this.state.laps, seconds, best });
    this.emitStatus();
  }

  /**
   * Airtime and squeeze: the camera lifts over crests and drops in dips and loops, driven by the
   * g the ball feels at its effective speed, so the multiplier scales it. Reduced motion keeps
   * a third of it.
   */
  private updateFeel(dt: number): void {
    const k = 1 - Math.exp(-dt / FEEL_TAU);
    const g = this.paused ? 1 : feltVerticalG(this.track, this.state.s, this.speed);
    this.gVertical += (g - this.gVertical) * k;
    const raw = clamp((1 - this.gVertical) * FEEL_PER_G, -FEEL_SQUEEZE_MAX, FEEL_LIFT_MAX);
    const target = raw * (this.reducedMotion ? 0.3 : 1);
    this.feel += (target - this.feel) * k;
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
      gVertical: this.gVertical,
      phase: this.state.phase,
      endless: this.endless,
      lapTime: this.state.time - this.state.lapStart,
      lastLap: this.state.lastLap,
      bestLap: this.bestLap,
      padBoost: this.padCharge,
    };
  }

  private placeBall(): void {
    sampleTrackToRef(this.track, this.state.s, this.sample);
    this.ball.place(this.sample, 0, this.state.theta);
  }

  private emitStatus(): void {
    this.events.emit('status', this.status());
  }

  dispose(): void {
    this.events.clear();
  }
}
