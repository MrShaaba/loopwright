import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AudioEngine } from '../audio/AudioEngine';
import { Emitter } from '../events';
import type { RideController } from '../ride/RideController';
import {
  bandKey,
  loadLapTimes,
  loadScores,
  recordLapTime,
  recordScore,
  speedBand,
  type ScoreEntry,
  type SpeedBand,
} from '../save/scores';
import { GhostRecorder, sampleGhost, type GhostRecording } from './ghost';
import { loadGhost, saveGhost } from './ghostStore';
import type { GhostView } from './GhostView';
import type { CompiledTrack } from '../track/Track';
import { createPhysicsTrack, wrapTheta, type PhysicsTrack } from '../ride/BallPhysics';
import type { ItemView } from './ItemView';
import { generateItems, type Item, type ItemLayout } from './items';
import {
  createRunStats,
  gemPoints,
  hazardValueFactor,
  ringPoints,
  SCORING,
  type RunStats,
} from './scoring';

export type PlayMode = 'game' | 'time' | 'cruise';

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
  /** Best score on this track in the current speed band, or null. */
  topScore: number | null;
  band: SpeedBand;
  /** Fastest lap in this band, or null; Time Attack races its ghost. */
  bestLapTime: number | null;
  ghostAvailable: boolean;
}

export interface LapSummary {
  /** Scored lap in Game mode, or a fastest lap in Time Attack. */
  kind: 'score' | 'time';
  entry: ScoreEntry;
  /** 1-based rank in the track's table for this band, or null when it did not make the top ten. */
  rank: number | null;
  table: ScoreEntry[];
  lap: number;
  band: SpeedBand;
}

export interface SplitEvent {
  sectionIndex: number;
  /** Seconds behind (positive) or ahead (negative) of the ghost at this section. */
  delta: number;
}

export interface GameEvents {
  status: GameStatus;
  pop: PopEvent;
  layout: ItemLayout;
  summary: LapSummary;
  split: SplitEvent;
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
  private trackKey = '';
  private topScore: number | null = null;
  private band: SpeedBand = 'band1';
  /** Highest multiplier (slider times Shift boost) used so far this lap. */
  private maxMultiplier = 1;
  private sectionCount = 1;
  private recorder = new GhostRecorder(1);
  private ghost: GhostRecording | null = null;
  private bestLapTime: number | null = null;
  private lastSection = -1;

  constructor(
    compiled: CompiledTrack,
    seed: number,
    private readonly ride: RideController,
    private readonly view: ItemView,
    private readonly audio: AudioEngine,
    private readonly ghostView: GhostView,
  ) {
    this.track = createPhysicsTrack(compiled.frames);
    this.setTrack(compiled, seed);
    this.ride.events.on('lap', (lap) => this.onLap(lap.lap, lap.seconds));
  }

  /** Which track the scores belong to: the share code, so an edit starts a fresh table. */
  setTrackKey(key: string): void {
    if (key === this.trackKey) return;
    this.trackKey = key;
    this.refreshTop();
    this.emitStatus();
  }

  private refreshTop(): void {
    if (!this.trackKey) {
      this.topScore = null;
      this.bestLapTime = null;
      this.ghost = null;
      return;
    }
    const key = bandKey(this.trackKey, this.band);
    this.topScore = loadScores(key)[0]?.score ?? null;
    this.bestLapTime = loadLapTimes(`${key}|time`)[0]?.lapTime ?? null;
    this.ghost = loadGhost(`${key}|ghost`);
  }

  /** Each lap is its own scored run: record it, hand the HUD a summary, then start fresh. */
  private onLap(lap: number, seconds: number): void {
    if (this.mode === 'time') {
      this.onTimeLap(lap, seconds);
      return;
    }
    if (this.mode !== 'game') return;
    const band = speedBand(this.maxMultiplier);
    const entry: ScoreEntry = {
      score: this.stats.score,
      rings: this.stats.rings,
      gems: this.stats.gems,
      bestCombo: this.stats.bestCombo,
      topSpeed: Math.round(this.stats.topSpeedKmh),
      lapTime: seconds,
      multiplier: Number(this.maxMultiplier.toFixed(2)),
      date: new Date().toISOString(),
    };
    const result = this.trackKey
      ? recordScore(bandKey(this.trackKey, band), entry)
      : { rank: null, table: [] };
    this.events.emit('summary', {
      kind: 'score',
      entry,
      rank: result.rank,
      table: result.table,
      lap,
      band,
    });
    this.stats = createRunStats();
    this.valueFactor = 1;
    this.speedAtHit = 0;
    this.maxMultiplier = this.ride.multiplier;
    this.refreshTop();
    this.emitStatus();
  }

  /** Time Attack: the lap time is the score, and a fastest lap becomes the new ghost. */
  private onTimeLap(lap: number, seconds: number): void {
    const band = speedBand(this.maxMultiplier);
    const entry: ScoreEntry = {
      score: 0,
      rings: 0,
      gems: 0,
      bestCombo: 0,
      topSpeed: Math.round(this.stats.topSpeedKmh),
      lapTime: seconds,
      multiplier: Number(this.maxMultiplier.toFixed(2)),
      date: new Date().toISOString(),
    };
    const key = `${bandKey(this.trackKey, band)}|time`;
    const result = this.trackKey ? recordLapTime(key, entry) : { rank: null, table: [] };
    if (this.trackKey && result.rank === 1) {
      saveGhost(
        `${bandKey(this.trackKey, band)}|ghost`,
        this.recorder.finish(seconds, this.track.length),
      );
    }
    this.events.emit('summary', {
      kind: 'time',
      entry,
      rank: result.rank,
      table: result.table,
      lap,
      band,
    });
    this.recorder.reset(this.sectionCount);
    this.lastSection = -1;
    this.stats = createRunStats();
    this.maxMultiplier = this.ride.multiplier;
    this.refreshTop();
    this.emitStatus();
  }

  /** Regenerates the layout for a track and seed. */
  setTrack(compiled: CompiledTrack, seed: number): void {
    this.track = createPhysicsTrack(compiled.frames);
    this.sectionCount = compiled.ranges.length;
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
    this.ghostView.setVisible(this.mode === 'time' && riding && this.ghost !== null);
  }

  private resetRun(): void {
    this.stats = createRunStats();
    this.resolved = new Set();
    this.view.reset();
    this.valueFactor = 1;
    this.speedAtHit = 0;
    this.maxMultiplier = this.ride.multiplier;
    this.recorder.reset(this.sectionCount);
    this.lastSection = -1;
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
    if (this.mode === 'time') {
      this.updateTimeAttack();
      return;
    }
    if (this.mode !== 'game' || !this.ride.isActive || this.ride.paused) return;
    const state = this.ride.state;
    if (state.laps !== this.lastLap) {
      this.lastLap = state.laps;
      this.newLap();
    }
    const speedKmh = this.ride.speed * 3.6;
    if (speedKmh > this.stats.topSpeedKmh) this.stats.topSpeedKmh = speedKmh;
    // The band follows the slider and the Shift boost, not pad bursts, which are earned.
    const used = this.ride.multiplier * this.ride.shiftBoost;
    if (used > this.maxMultiplier) this.maxMultiplier = used;
    const band = speedBand(Math.max(this.maxMultiplier, this.ride.multiplier));
    if (band !== this.band) {
      this.band = band;
      this.refreshTop();
      this.emitStatus();
    }
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

  /** Records the lap for the ghost, replays the best ghost, and reports splits at section entries. */
  private updateTimeAttack(): void {
    if (!this.ride.isActive || this.ride.paused) return;
    const state = this.ride.state;
    if (state.phase !== 'running') return;
    const lapTime = state.time - state.lapStart;
    const speedKmh = this.ride.speed * 3.6;
    if (speedKmh > this.stats.topSpeedKmh) this.stats.topSpeedKmh = speedKmh;
    const used = this.ride.multiplier * this.ride.shiftBoost;
    if (used > this.maxMultiplier) this.maxMultiplier = used;
    const band = speedBand(Math.max(this.maxMultiplier, this.ride.multiplier));
    if (band !== this.band) {
      this.band = band;
      this.refreshTop();
      this.applyVisibility(true);
      this.emitStatus();
    }
    const sectionIndex = this.sectionAt(state.s);
    this.recorder.record(lapTime, state.s, state.theta, sectionIndex);
    if (sectionIndex !== this.lastSection) {
      const previous = this.lastSection;
      this.lastSection = sectionIndex;
      const ghostSplit = this.ghost?.splits[sectionIndex] ?? -1;
      if (previous >= 0 && ghostSplit >= 0) {
        this.events.emit('split', { sectionIndex, delta: lapTime - ghostSplit });
      }
    }
    if (this.ghost) {
      const at = sampleGhost(this.ghost, lapTime);
      this.ghostView.place(this.track, at.s, at.theta);
    }
  }

  private sectionAt(s: number): number {
    const index = Math.min(
      this.track.frames.length - 1,
      Math.max(0, Math.round(s / this.track.step)),
    );
    return this.track.frames[index]?.sectionIndex ?? 0;
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
        if (hit) {
          const points = gemPoints();
          this.stats.gems++;
          this.stats.score += points;
          this.view.hide(item.id);
          this.audio.sparkle();
          this.events.emit('pop', { kind: 'gem', text: `+${points} gem`, position });
        }
        break;
      case 'boost':
        if (hit) {
          this.stats.boosts++;
          this.view.hide(item.id);
          this.ride.applyBoost();
          this.audio.whoosh();
          this.events.emit('pop', { kind: 'boost', text: 'boost', position });
        }
        break;
      case 'hazard':
        if (hit) {
          this.stats.hazards++;
          this.stats.combo = 0;
          this.speedAtHit = this.ride.applyHazard();
          this.valueFactor = SCORING.hazardFloor;
          this.audio.thud();
          this.events.emit('pop', { kind: 'hazard', text: 'hit', position });
        }
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
      topScore: this.topScore,
      band: this.band,
      bestLapTime: this.bestLapTime,
      ghostAvailable: this.ghost !== null,
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
