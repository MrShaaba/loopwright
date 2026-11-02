import { Emitter } from '../events';
import {
  browserAchievementStore,
  evaluateAchievements,
  loadEarned,
  saveEarned,
  type Achievement,
  type AchievementStore,
} from './achievements';
import {
  addCollected,
  addLap,
  browserProgressStore,
  loadProgress,
  saveProgress,
  type LapRecord,
  type Progress,
  type ProgressStore,
} from './progress';
import { newlyUnlocked, type Unlockable } from './unlocks';

export interface ProgressEvents {
  progress: Progress;
  /** A skin or trail just came within reach. */
  unlock: Unlockable;
  /** An achievement was just earned. */
  achievement: Achievement;
}

export interface ProgressTrackerOptions {
  progressStore?: ProgressStore;
  achievementStore?: AchievementStore;
  /** How many themes exist, for the world tour. */
  themeCount?: number;
  /** Clock for the earned dates, for tests. */
  now?: () => string;
}

/**
 * Keeps the lifetime totals current and saved, announces anything they unlock, and checks the
 * achievement rules after every change.
 */
export class ProgressTracker {
  readonly events = new Emitter<ProgressEvents>();
  progress: Progress;
  /** Earned achievement ids with the ISO date of each. */
  earned: Map<string, string>;
  private readonly progressStore: ProgressStore;
  private readonly achievementStore: AchievementStore;
  private readonly themeCount: number;
  private readonly now: () => string;

  constructor(options: ProgressTrackerOptions = {}) {
    this.progressStore = options.progressStore ?? browserProgressStore;
    this.achievementStore = options.achievementStore ?? browserAchievementStore;
    this.themeCount = options.themeCount ?? 0;
    this.now = options.now ?? (() => new Date().toISOString());
    this.progress = loadProgress(this.progressStore);
    this.earned = loadEarned(this.achievementStore);
  }

  /** Gems and rings count as soon as they are collected. */
  collect(gems: number, rings: number): void {
    if (gems <= 0 && rings <= 0) return;
    const before = this.progress.gems;
    this.progress = addCollected(this.progress, gems, rings);
    this.commit(null);
    for (const item of newlyUnlocked(before, this.progress.gems)) this.events.emit('unlock', item);
  }

  lap(record: LapRecord): void {
    this.progress = addLap(this.progress, record);
    this.commit(record);
  }

  private commit(lap: LapRecord | null): void {
    saveProgress(this.progress, this.progressStore);
    this.events.emit('progress', this.progress);
    const fresh = evaluateAchievements(
      { lap, progress: this.progress, themeCount: this.themeCount },
      new Set(this.earned.keys()),
    );
    if (fresh.length === 0) return;
    const date = this.now();
    for (const achievement of fresh) this.earned.set(achievement.id, date);
    saveEarned(this.earned, this.achievementStore);
    for (const achievement of fresh) this.events.emit('achievement', achievement);
  }

  dispose(): void {
    this.events.clear();
  }
}
