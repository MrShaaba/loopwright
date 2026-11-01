import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AudioEngine } from '../audio/AudioEngine';
import { Emitter } from '../events';
import type { RideController } from '../ride/RideController';
import type { CompiledTrack } from '../track/Track';
import { createPhysicsTrack, wrapTheta, type PhysicsTrack } from '../ride/BallPhysics';
import type { ItemView } from './ItemView';
import { generateItems, type Item, type ItemLayout } from './items';
import { createRunStats, hazardValueFactor, ringPoints, type RunStats } from './scoring';

export type PlayMode = 'game' | 'cruise';

export interface PopEvent {
  kind: 'ring' | 'gem' | 'boost' | 'hazard' | 'miss';
  text: string;
  /** World position of the item, for the HUD to project. */
  position: Vector3;
}

export interface GameStatus {
  mode: PlayMode;
  score: number;
  combo: number;
  bestCombo: number;
  rings: number;
  ringsTotal: number;
  gems: number;
  gemsTotal: number;
  /** 1 at full worth, lower after a hazard until speed is rebuilt. */
  valueFactor: number;
  hazards: number;
  boosts: number;
}

export interface GameEvents {
  status: GameStatus;
  pop: PopEvent;
  layout: ItemLayout;
}

/** Angular reach of the ball around the tube for each kind, radians. */
const REACH = { ring: 0.58, gem: 0.6, boost: 0.7, hazard: 0.62 } as const;

/**
 * The game that sits on top of the ride: places items from the track and seed, tests the ball
 * against them as it passes, keeps score and combo, and reports pops for the HUD. In cruise
 * mode it draws nothing and scores nothing; the ride itself is untouched either way.
 */
export class GameController {
  readonly events = new Emitter<GameEvents>();
  mode: PlayMode = 'game';
  stats: RunStats = createRunStats();
  layout: ItemLayout = { seed: 1, items: [], rings: 0, gems: 0 };
  private track: PhysicsTrack;
  private lastS = 0;
  private lastLap = 0;
  private speedAtHit = 0;
  private valueFactor = 1;
  /** Items already resolved this lap, collected or missed. */
  private resolved = new Set<number>();
  private showInEditor = true;

  constructor(
    compiled: CompiledTrack,
    seed: number,
    private readonly ride: RideController,
    private readonly view: ItemView,
    private readonly audio: AudioEngine,
  ) {
    this.track = createPhysicsTrack(compiled.frames);
    this.setTrack(compiled, seed);
  }

  /** Regenerates the layout for a track and seed. */
  setTrack(compiled: CompiledTrack, seed: number): void {
    this.track = createPhysicsTrack(compiled.frames);
    this.layout = generateItems(compiled, seed);
    this.view.rebuild(this.layout.items, this.track);
    this.resetRun();
    this.events.emit('layout', this.layout);
    this.applyVisibility(false);
  }

  setMode(mode: PlayMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.resetRun();
    this.applyVisibility(this.ride.isActive);
  }

  /** Whether items show while editing. */
  setShowInEditor(show: boolean): void {
    this.showInEditor = show;
    this.applyVisibility(this.ride.isActive);
  }

  get showsInEditor(): boolean {
    return this.showInEditor;
  }

  /** Called when the ride starts, restarts or stops. */
  onRide(active: boolean): void {
    this.resetRun();
    this.applyVisibility(active);
  }

  private applyVisibility(riding: boolean): void {
    const show = this.mode === 'game' && (riding || this.showInEditor);
    this.view.setVisible(show);
  }

  private resetRun(): void {
    this.stats = createRunStats();
    this.resolved = new Set();
    this.view.reset();
    this.valueFactor = 1;
    this.speedAtHit = 0;
    this.lastS = this.ride.state.s;
    this.lastLap = this.ride.state.laps;
    this.emitStatus();
  }

  /** A new lap brings every item back; the run's score carries on. */
  private newLap(): void {
    this.resolved = new Set();
    this.view.reset();
  }

  update(): void {
    if (this.mode !== 'game' || !this.ride.isActive || this.ride.paused) return;
    const state = this.ride.state;
    if (state.laps !== this.lastLap) {
      this.lastLap = state.laps;
      this.newLap();
    }
    const speedKmh = this.ride.speed * 3.6;
    if (speedKmh > this.stats.topSpeedKmh) this.stats.topSpeedKmh = speedKmh;
    if (this.speedAtHit > 0) {
      this.valueFactor = hazardValueFactor(state.v, this.speedAtHit);
      if (this.valueFactor >= 1) this.speedAtHit = 0;
    }
    const from = this.lastS;
    const to = state.s;
    this.lastS = to;
    if (to === from) return;
    for (const item of this.layout.items) {
      if (this.resolved.has(item.id)) continue;
      if (!crossed(from, to, item.s, this.track.length)) continue;
      this.resolved.add(item.id);
      const delta = Math.abs(wrapTheta(state.theta - item.theta));
      const hit = delta <= REACH[item.kind];
      this.resolve(item, hit, speedKmh);
    }
  }

  private resolve(item: Item, hit: boolean, speedKmh: number): void {
    const position = this.positionOf(item);
    switch (item.kind) {
      case 'ring':
        if (hit) {
          const points = ringPoints(speedKmh, this.stats.combo, this.valueFactor);
          this.stats.combo++;
          this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
          this.stats.rings++;
          this.stats.score += points;
          this.view.hide(item.id);
          this.audio.chime(this.stats.combo);
          this.events.emit('pop', { kind: 'ring', text: `+${points}`, position });
        } else if (this.stats.combo > 0) {
          this.stats.combo = 0;
          this.events.emit('pop', { kind: 'miss', text: 'combo lost', position });
        }
        break;
      case 'gem':
      case 'boost':
      case 'hazard':
        // Effects for these arrive with the next step; for now they are only collected.
        if (hit) this.view.hide(item.id);
        break;
    }
    this.emitStatus();
  }

  private positionOf(item: Item): Vector3 {
    const index = Math.min(
      this.track.frames.length - 1,
      Math.max(0, Math.round(item.s / this.track.step)),
    );
    const frame = this.track.frames[index];
    if (!frame) return Vector3.Zero();
    const c = -Math.cos(item.theta);
    const sn = Math.sin(item.theta);
    return new Vector3(
      frame.position.x + (frame.up.x * c + frame.right.x * sn) * 1.03,
      frame.position.y + (frame.up.y * c + frame.right.y * sn) * 1.03,
      frame.position.z + (frame.up.z * c + frame.right.z * sn) * 1.03,
    );
  }

  status(): GameStatus {
    return {
      mode: this.mode,
      score: this.stats.score,
      combo: this.stats.combo,
      bestCombo: this.stats.bestCombo,
      rings: this.stats.rings,
      ringsTotal: this.layout.rings,
      gems: this.stats.gems,
      gemsTotal: this.layout.gems,
      valueFactor: this.valueFactor,
      hazards: this.stats.hazards,
      boosts: this.stats.boosts,
    };
  }

  private emitStatus(): void {
    this.events.emit('status', this.status());
  }

  dispose(): void {
    this.events.clear();
  }
}

/** True when moving from `from` to `to` along a loop of `length` passes arc length `at`. */
export function crossed(from: number, to: number, at: number, length: number): boolean {
  if (length <= 0) return false;
  const span = (((to - from) % length) + length) % length;
  if (span === 0 || span > length / 2) return false;
  const offset = (((at - from) % length) + length) % length;
  return offset > 0 && offset <= span;
}
